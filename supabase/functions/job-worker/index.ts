// supabase/functions/job-worker/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProviderLink } from "../../../src/lib/providers.ts";

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

/* ============================ MAIN ============================ */

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

    const body = (await req.json().catch(() => ({}))) as { jobId?: string };

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    /* ---------- concurrency guard ---------- */
    // Env-configurable limits so we can tune without redeploy
    const IMAGE_MAX = Number(Deno.env.get("RUNWARE_IMAGE_MAX_CONCURRENT") ?? 3);
    const VIDEO_MAX = Number(Deno.env.get("RUNWARE_VIDEO_MAX_CONCURRENT") ?? 1);
    const TOTAL_MAX = Number(Deno.env.get("RUNWARE_TOTAL_MAX_CONCURRENT") ?? 3);

    /* ---------- pick job ---------- */
    let jobId = body.jobId;

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

      if (error) return fail(req, `DB query error: ${error.message}`, 500);
      if (!data?.id) return json(req, { ok: true, message: "no queued jobs" });

      jobId = data.id;
    }

    // claim job (safe if already claimed elsewhere)
    try {
      await sbAdmin.rpc("claim_job", { p_id: jobId });
    } catch {
      // ignore claim race
    }

    const { data: job, error: jobErr } = await sbAdmin
      .from("jobs")
      .select("id,user_id,type,input,settings,tool_key,status,progress,prompt")
      .eq("id", jobId)
      .single();

    if (jobErr) return fail(req, `Job load error: ${jobErr.message}`, 500);
    if (!job) return fail(req, "Job not found", 404);

    if (job.status !== "queued" && job.status !== "running" && job.status !== "processing") {
      // already done or canceled
      return json(req, { ok: true, id: jobId, message: "job not runnable", status: job.status });
    }

    if (job.type !== "image" && job.type !== "video") {
      return fail(req, `Unsupported job type: ${job.type}`, 400);
    }

    if (!job.tool_key) {
      return fail(req, "Missing tool_key on job row", 400);
    }

    const provider = getProviderLink(job.tool_key);
    if (!provider || provider.provider !== "runware") {
      return fail(req, "Unsupported provider", 400);
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

      console.log(`[job-worker] firing ${job.type} job ${jobId} → ${provider.edgeFn}`);

    console.log("[job-worker] accepting handoff", {
      jobId,
      type: job.type,
      tool_key: job.tool_key,
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
            // Forward the original user JWT so runware-image passes JWT verification.
            // Using SERVICE_ROLE_KEY here causes UNAUTHORIZED_INVALID_JWT_FORMAT.
            "authorization": incomingAuth,
            "apikey":        incomingApiKey,
          },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        console.error("[job-worker] handoff fetch threw:", String(fetchErr));
        // Mark the job failed — runware-image never received the request
        try {
          await sbAdmin.rpc("finish_job_failed", {
            p_id:    jobId,
            p_error: `Handoff fetch error: ${String(fetchErr)}`,
          });
        } catch (rpcErr) {
          console.error("[job-worker] finish_job_failed threw:", String(rpcErr));
        }
        return;
      }

      // Fully consume the body so the TCP socket is released cleanly
      let txt = "";
      try { txt = await r.text(); } catch { /* ignore */ }

      if (r.ok) {
        console.log(`[job-worker] handoff accepted ${r.status}:`, txt.slice(0, 120));
      } else {
        console.error(`[job-worker] handoff failed ${r.status}:`, txt.slice(0, 200));

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
          // Back-off delays: 30s → 90s → 3min → 7min → 15min
          const DELAYS = [30_000, 90_000, 180_000, 420_000, 900_000];
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
              console.error("[job-worker] finish_job_failed threw:", String(rpcErr));
            }
            console.log(`[job-worker] Job ${jobId} exhausted ${attempts}/${maxAttempts} retries — marked failed`);
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

            console.log(`[job-worker] Requeued job ${jobId} attempt ${attempts}/${maxAttempts}, retry after ${retryAfter}`);
          }
        } else {
          // Non-retryable error — mark failed immediately
          try {
            await sbAdmin.rpc("finish_job_failed", {
              p_id:    jobId,
              p_error: `Handoff rejected (${r.status}): ${txt.slice(0, 150)}`,
            });
          } catch (rpcErr) {
            console.error("[job-worker] finish_job_failed threw:", String(rpcErr));
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
    console.error(e);
    return fail(req, `Unhandled error: ${String(e)}`, 500);
  }

  
});
