// supabase/functions/job-worker/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProviderLink } from "../../../src/lib/providers.ts";
import { logEvent as persistLog, type LogLevel } from "../_shared/systemLog.ts";

function logEvent(level: LogLevel, event: string, ctx: Record<string, unknown> = {}) {
  const icon = level === "error" ? "🔴" : level === "warn" ? "🟠" : "🟢";
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    `${icon} [job-worker] ${event}`,
    JSON.stringify({ ts: new Date().toISOString(), ...ctx }),
  );
  void persistLog("job-worker", level, event, ctx);
}

/* ============================ CORS ============================ */

function corsHeaders(req: Request): Headers {
  return new Headers({
    "access-control-allow-origin": req.headers.get("Origin") || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, content-type, apikey",
    "access-control-max-age": "86400",
    "content-type": "application/json",
  });
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });

const fail = (req: Request, msg: string, status = 500) =>
  json(req, { ok: false, error: msg }, status);

/* ============================ ENV ============================ */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

/* ============================ PLAN GATING ============================
   Some tool_keys are exclusive to higher subscription tiers (e.g. Clay
   Rescue's V3/V4 video models). The UI already hides/locks these for
   ineligible plans, but that is cosmetic only — this is the actual
   enforcement point, since job-worker is the single trusted dispatcher
   every job (from every client, however it was submitted) must pass
   through before a provider is ever called or credits are charged.
   ======================================================================= */

const PLAN_TIER_ORDER = ["free", "starter", "pro", "generative"];

// tool_key -> minimum required plan tier
const PLAN_GATED_TOOLS: Record<string, string> = {
  "video:viduq3turbo720":            "pro",         // Clay Rescue V3, AI Fruit Story V3, Face ASMR V3
  "video:viduq3turbo1080":           "generative",  // Clay Rescue V4, Face ASMR V4
  "video:fruitveo31lite":            "generative",  // AI Fruit Story V4
  "video:microcamminimax720":        "pro",         // Micro Camera Animal V3
  "video:microcamminimax1080":       "generative",  // Micro Camera Animal V4
  // Footballer V3/V4 were swapped (720p Seedance turned out pricier than
  // 1080p Vidu, so the cheaper one has to be V3) — dedicated keys, gated to
  // match the TIER not the resolution.
  "video:footballerviduq3turbo1080": "pro",         // Footballer Nationality Swap V3 (now Vidu 1080p)
  "video:footballerseedance720":     "generative",  // Footballer Nationality Swap V4 (now Seedance 720p)
  "image:twoam2k":                   "pro",         // 2AM Worlds V3
  "image:twoam4k":                   "generative",  // 2AM Worlds V4
};

function planTierIndex(planCode: string | null | undefined): number {
  const code = String(planCode ?? "").toLowerCase().trim();
  const idx = PLAN_TIER_ORDER.indexOf(code);
  return idx === -1 ? 0 : idx; // unknown/guest codes are treated as the lowest tier
}

async function isToolAllowedForUser(
  sbAdmin: SB,
  userId: string,
  toolKey: string,
): Promise<{ allowed: boolean; userPlan: string; requiredPlan?: string }> {
  const requiredPlan = PLAN_GATED_TOOLS[toolKey];
  if (!requiredPlan) return { allowed: true, userPlan: "" };

  const { data: profile } = await sbAdmin
    .from("profiles")
    .select("plan_code")
    .eq("id", userId)
    .maybeSingle();

  const userPlan = String((profile as any)?.plan_code ?? "free").toLowerCase().trim();

  // Affiliates get full access regardless of tier ordering.
  if (userPlan === "affiliate") return { allowed: true, userPlan };

  const allowed = planTierIndex(userPlan) >= planTierIndex(requiredPlan);
  return { allowed, userPlan, requiredPlan };
}

/* ============================ MAIN ============================ */

type SB = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return fail(req, "Method not allowed", 405);
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return fail(req, "Missing SUPABASE_URL / SERVICE_ROLE_KEY", 500);
    }

    // Capture auth headers NOW — before any async work — so they are available
    // inside EdgeRuntime.waitUntil even if the Request object is later GC'd.
    // The provider edge function (runware-image) has JWT verification enabled
    // and expects the original user JWT, NOT the service role key.
    const incomingAuth   = req.headers.get("Authorization") || "";
    const incomingApiKey = req.headers.get("apikey")        || Deno.env.get("SUPABASE_ANON_KEY") || "";

    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      recoverExistingProvider?: boolean;
    };
    const recoverExistingProvider = body.recoverExistingProvider === true;

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // This function intentionally keeps platform JWT verification disabled so
    // queue-worker can call it with either legacy JWT or modern sb_secret keys.
    // Authenticate every request here instead, and never let one user claim or
    // dispatch another user's job.
    const bearerToken = incomingAuth.replace(/^Bearer\s+/i, "").trim();
    const isServiceRequest = Boolean(bearerToken) && bearerToken === SERVICE_ROLE_KEY;
    let authenticatedUserId: string | null = null;
    if (!isServiceRequest) {
      if (!bearerToken) return fail(req, "Authentication required", 401);
      const { data: authData, error: authError } = await sbAdmin.auth.getUser(bearerToken);
      if (authError || !authData.user) return fail(req, "Invalid authentication", 401);
      authenticatedUserId = authData.user.id;
    }

    /* ---------- concurrency guard ---------- */
    // Env-configurable limits so we can tune without redeploy
    const IMAGE_MAX = Number(Deno.env.get("RUNWARE_IMAGE_MAX_CONCURRENT") ?? 8);
    const VIDEO_MAX = Number(Deno.env.get("RUNWARE_VIDEO_MAX_CONCURRENT") ?? 8);
    const TOTAL_MAX = Number(Deno.env.get("RUNWARE_TOTAL_MAX_CONCURRENT") ?? 15);

    /* ---------- pick job ---------- */
    let jobId = body.jobId;

    if (!jobId && !isServiceRequest) {
      return fail(req, "Only the queue worker can claim an unspecified job", 403);
    }

    if (jobId && authenticatedUserId) {
      const { data: ownedJob, error: ownershipError } = await sbAdmin
        .from("jobs")
        .select("user_id")
        .eq("id", jobId)
        .maybeSingle();
      if (ownershipError) return fail(req, "Could not verify job ownership", 500);
      if (!ownedJob || ownedJob.user_id !== authenticatedUserId) {
        return fail(req, "Job not found", 404);
      }
    }

    if (!jobId) {
      // Count currently active jobs to enforce concurrency limits
      const [{ count: activeImages }, { count: activeVideos }] = await Promise.all([
        sbAdmin.from("jobs").select("id", { count: "exact", head: true })
          .eq("type", "image").in("status", ["queued", "running", "processing"]),
        sbAdmin.from("jobs").select("id", { count: "exact", head: true })
          .eq("type", "video").in("status", ["queued", "running", "processing"]),
      ]);

      const totalActive = (activeImages ?? 0) + (activeVideos ?? 0);

      if (totalActive >= TOTAL_MAX) {
        logEvent("warn", "concurrency_limit_reached", {
          activeImages, activeVideos, totalActive, totalMax: TOTAL_MAX,
        });
        return json(req, { ok: true, message: "concurrency limit reached", active: totalActive });
      }

      // Pick highest priority queued job, skipping video if video slot is full
      const canTakeVideo = (activeVideos ?? 0) < VIDEO_MAX;
      const canTakeImage = (activeImages ?? 0) < IMAGE_MAX;

      let typeFilter: string | null = null;
      if (canTakeImage && !canTakeVideo)  typeFilter = "image";
      if (canTakeVideo && !canTakeImage)  typeFilter = "video";
      // if both are available, pick whatever comes first by priority

      let query = sbAdmin
        .from("jobs")
        .select("id")
        .eq("status", "queued")
        .or("retry_after.is.null,retry_after.lte." + new Date().toISOString())
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1);

      if (typeFilter) query = query.eq("type", typeFilter);

      const { data, error } = await query.maybeSingle();

      if (error) {
        logEvent("error", "pick_job_query_failed", { message: error.message });
        return fail(req, `DB query error: ${error.message}`, 500);
      }
      if (!data?.id) return json(req, { ok: true, message: "no queued jobs" });

      jobId = data.id;
    }

    // Atomically transition queued -> running. The queued-status predicate is
    // the duplicate-dispatch guard: only one concurrent worker can update and
    // receive the row. When this worker picks an unspecified job, the query
    // above has already enforced retry_after. Explicit job IDs are newly
    // created handoffs or authorized recovery calls, so repeating retry_after
    // here is unnecessary. It also causes PostgREST to qualify the filter as
    // jobs.retry_after in the UPDATE CTE on some deployments, producing a
    // false "column jobs.retry_after does not exist" error even after the
    // column migration has been applied.
    let { data: job, error: jobErr } = await sbAdmin
      .from("jobs")
      .update({ status: "running" })
      .eq("id", jobId)
      .eq("status", "queued")
      .select("id,user_id,type,input,settings,tool_key,status,progress,prompt")
      .maybeSingle();

    if (jobErr) {
      logEvent("error", "job_claim_failed", { jobId, message: jobErr.message });
      return fail(req, `Job claim error: ${jobErr.message}`, 500);
    }
    if (!job) {
      const { data: existing } = await sbAdmin
        .from("jobs")
        .select("id,user_id,type,input,settings,tool_key,status,progress,prompt")
        .eq("id", jobId)
        .maybeSingle();
      const status = existing?.status ?? "missing";

      const canRecover = Boolean(
        recoverExistingProvider &&
        existing &&
        (
          (existing.type === "video" && ["running", "processing", "failed"].includes(String(existing.status))) ||
          (existing.type === "image" && ["running", "processing"].includes(String(existing.status)))
        ) &&
        (existing.settings as any)?.provider_job_id
      );

      if (canRecover) {
        job = existing;
        logEvent("info", "provider_poll_recovery_accepted", {
          jobId,
          status,
          providerJobId: String((existing.settings as any).provider_job_id),
        });
      } else {
        logEvent("info", "duplicate_dispatch_prevented", { jobId, status });
        return json(req, {
          ok: true,
          id: jobId,
          message: "job already claimed or not ready",
          status,
        });
      }
    }

    if (job.type !== "image" && job.type !== "video") {
      logEvent("error", "unsupported_job_type", { jobId, type: job.type });
      return fail(req, `Unsupported job type: ${job.type}`, 400);
    }

    if (!job.tool_key) {
      logEvent("error", "missing_tool_key", { jobId, userId: job.user_id });
      return fail(req, "Missing tool_key on job row", 400);
    }

    const provider = getProviderLink(job.tool_key);
    if (!provider || provider.provider !== "runware") {
      logEvent("error", "unsupported_provider", { jobId, toolKey: job.tool_key, userId: job.user_id });
      return fail(req, "Unsupported provider", 400);
    }

    // Plan gate — checked here (server-side, trusted DB read) so it can't be
    // bypassed by calling this function directly or skipping the client UI.
    // Runs before any charge or provider call, so a blocked request never
    // costs the user credits.
    const planCheck = await isToolAllowedForUser(sbAdmin, String(job.user_id), String(job.tool_key));
    if (!planCheck.allowed) {
      logEvent("warn", "plan_gate_blocked", {
        jobId, toolKey: job.tool_key, userId: job.user_id,
        userPlan: planCheck.userPlan, requiredPlan: planCheck.requiredPlan,
      });
      await sbAdmin.from("jobs").update({
        status: "failed",
        error: `PLAN_UPGRADE_REQUIRED: ${job.tool_key} requires the ${planCheck.requiredPlan} plan`,
      }).eq("id", jobId);
      return fail(req, `This model requires the ${planCheck.requiredPlan} plan`, 403);
    }

    // mark started
    try {
      await sbAdmin.rpc("bump_job_progress", {
        p_id: jobId,
        p_progress: 10,
      });
    } catch {
      // ignore
    }

    // Priority: ref_images (fruit story / explicit refs) → init_image_url (style ref) → empty
    // IMPORTANT: check length > 0, not just Array.isArray — empty arrays must fall through.
    const refFromField = Array.isArray(job.input?.ref_images) && job.input.ref_images.length > 0
      ? (job.input.ref_images as string[])
      : null;
    const referenceImages: string[] =
      refFromField ??
      (job.input?.init_image_url ? [job.input.init_image_url] : []);

    console.log("[job-worker] referenceImages forwarding", {
      jobId,
      source:          refFromField ? "ref_images" : job.input?.init_image_url ? "init_image_url" : "none",
      count:           referenceImages.length,
      hasRefImages:    !!refFromField,
      inputRefImages:  refFromField ?? [],
      firstUrl:        referenceImages[0]?.slice(0, 80) ?? null,
    });

    // Use provider.edgeFn as the source of truth
    const EDGE_FN_URL = `${SUPABASE_URL}${provider.edgeFn}`;

    // IMPORTANT:
    // - runware-image expects prompt + refs + settings (your current design)
    // - runware-video MUST be changed to accept jobId + settings and UPDATE the existing job (NOT insert a new one)
    const payload =
  job.type === "image"
    ? {
        jobId,
        airTag: provider.airTag,
        prompt: job.prompt ?? job.input?.subject ?? "",
        referenceImages,
        settings: {
          ...(job.settings ?? {}),
          width: job.input?.width,
          height: job.input?.height,
        },
        recoverExistingProvider,
      }
    : {
        jobId,
        airTag: provider.airTag,
        prompt: job.prompt ?? job.input?.subject ?? "",
        width: job.input?.width,
        height: job.input?.height,
        durationSec: job.input?.durationSec,
        referenceImages,
        withSound: job.input?.withSound ?? false,
      };

    logEvent("info", "accepting_handoff", {
      jobId,
      userId: job.user_id,
      toolKey: job.tool_key,
      type: job.type,
      status: job.status,
      providerEdgeFn: provider.edgeFn,
      airTag: provider.airTag,
    });

    // Fire the handoff without waiting for image/video generation to complete.
    // runware-image now returns 202 immediately and processes in the background.
    // waitUntil keeps this process alive long enough to log the handoff result.
    const handoffPromise = (async () => {
      let r: Response | null = null;
      try {
        r = await fetch(EDGE_FN_URL, {
          method:  "POST",
          headers: {
            "content-type": "application/json",
            // Provider functions use an explicit server-to-server secret because
            // modern Supabase service keys are not necessarily JWT formatted.
            "authorization": incomingAuth,
            "apikey":        incomingApiKey,
            "x-job-worker-key": SERVICE_ROLE_KEY,
          },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        logEvent("error", "handoff_fetch_threw", { jobId, userId: job.user_id, edgeFn: provider.edgeFn, message: String(fetchErr) });
        // Mark the job failed — runware-image never received the request
        try {
          await sbAdmin.rpc("finish_job_failed", {
            p_id:    jobId,
            p_error: `Handoff fetch error: ${String(fetchErr)}`,
          });
        } catch (rpcErr) {
          logEvent("error", "finish_job_failed_threw", { jobId, message: String(rpcErr) });
        }
        return;
      }

      // Fully consume the body so the TCP socket is released cleanly
      let txt = "";
      try { txt = await r.text(); } catch { /* ignore */ }

      if (r.ok) {
        logEvent("info", "handoff_accepted", { jobId, status: r.status });
      } else {
        logEvent("error", "handoff_failed", { jobId, userId: job.user_id, status: r.status, body: txt.slice(0, 200) });

        // 402 / insufficientCredits from Runware often means concurrency / rate-limit,
        // NOT a real empty balance. Re-queue with back-off instead of marking failed.
        let isRetryable = false;
        try {
          const errJson = JSON.parse(txt);
          const errors  = Array.isArray(errJson?.errors) ? errJson.errors : [];
          isRetryable   = errors.some((e: any) => {
            const code = String(e?.code ?? "").toLowerCase();
            const msg  = String(e?.message ?? "").toLowerCase();
            return (
              code === "insufficientcredits" ||
              msg.includes("insufficient credits") ||
              msg.includes("concurrency") ||
              msg.includes("rate limit") ||
              msg.includes("too many requests")
            );
          });
        } catch { /* non-JSON body */ }

        if (isRetryable) {
          // Short back-off so queued scenes pick up as soon as a Runware slot frees
          // 5s → 10s → 20s → 45s → 90s
          const DELAYS = [5_000, 10_000, 20_000, 45_000, 90_000];
          const { data: jobRow } = await sbAdmin
            .from("jobs")
            .select("attempts, max_attempts")
            .eq("id", jobId)
            .single()
            .catch(() => ({ data: null }));

          const attempts    = Number((jobRow as any)?.attempts    ?? 0) + 1;
          const maxAttempts = Number((jobRow as any)?.max_attempts ?? 5);

          if (attempts >= maxAttempts) {
            // Exhausted retries — mark as permanently failed
            try {
              await sbAdmin.rpc("finish_job_failed", {
                p_id:    jobId,
                p_error: `Provider busy after ${attempts} attempts: ${txt.slice(0, 150)}`,
              });
            } catch (rpcErr) {
              logEvent("error", "finish_job_failed_threw", { jobId, message: String(rpcErr) });
            }
            logEvent("error", "retries_exhausted", { jobId, userId: job.user_id, attempts, maxAttempts });
          } else {
            const delayMs    = DELAYS[Math.min(attempts - 1, DELAYS.length - 1)];
            const retryAfter = new Date(Date.now() + delayMs).toISOString();

            await sbAdmin.from("jobs").update({
              status:      "queued",
              attempts,
              error:       `Provider busy — retrying (attempt ${attempts}/${maxAttempts}): ${txt.slice(0, 150)}`,
              retry_after: retryAfter,
              updated_at:  new Date().toISOString(),
            }).eq("id", jobId).catch(() => {});

            logEvent("warn", "job_requeued", { jobId, userId: job.user_id, attempts, maxAttempts, retryAfter });
          }
        } else {
          // Non-retryable error — mark failed immediately
          try {
            await sbAdmin.rpc("finish_job_failed", {
              p_id:    jobId,
              p_error: `Handoff rejected (${r.status}): ${txt.slice(0, 150)}`,
            });
          } catch (rpcErr) {
            logEvent("error", "finish_job_failed_threw", { jobId, message: String(rpcErr) });
          }
        }
      }
    })();

    EdgeRuntime.waitUntil(handoffPromise);

    return json(req, {
      ok:      true,
      id:      jobId,
      message: "handoff fired",
      edgeFn:  provider.edgeFn,
    });
  } catch (e) {
    logEvent("error", "unhandled_error", { message: String((e as any)?.message ?? e) });
    return fail(req, `Unhandled error: ${String(e)}`, 500);
  }
});
