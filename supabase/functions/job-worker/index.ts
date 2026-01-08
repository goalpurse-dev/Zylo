// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { launchRunwareVideo, pollRunware } from "./runware.ts";

/* ============================ CORS & helpers ============================ */

const BUILD_TAG = "job-worker " + new Date().toISOString();

function corsHeaders(req: Request): Headers {
  const origin = req.headers.get("Origin") || "*";
  const reqHeaders =
    req.headers.get("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type";

  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": reqHeaders,
    "access-control-max-age": "86400",
    "content-type": "application/json",
    vary: "Origin",
  });
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });

const fail = (req: Request, msg: string, status = 500) =>
  json(req, { ok: false, error: msg }, status);

function creditsForVideoDuration(priceRow: any, durationSec: number): number {
  if (!priceRow?.pricing) return 0;

  const p = priceRow.pricing;
  if (durationSec <= 5) return p.per5 ?? 0;
  if (durationSec <= 10) return p.per10 ?? 0;

  // fallback future durations
  return p.per10 ?? p.per5 ?? 0;
}



// Call this same function again in a few seconds
async function scheduleNextTick(jobId: string) {
  // optional tiny delay so we don't hammer Runware
  await new Promise((r) => setTimeout(r, 1000));

  await fetch(`${SUPABASE_URL}/functions/v1/job-worker`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // use service key so the worker can see everything
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ jobId }), // <-- tell worker which job to poll
  }).catch(() => {});
}

/* =============================== ENV =================================== */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

/* ===================== FAL (image fallback) ============================ */

const FAL_BASE = "https://fal.run";
const FAL_KEY = Deno.env.get("FAL_API_KEY") || "";
const MODEL_V2 = Deno.env.get("FAL_MODEL_V2") || "fal-ai/flux/dev";
const MODEL_V3 = Deno.env.get("FAL_MODEL_V3") || "fal-ai/flux/dev";
const MODEL_V4 = Deno.env.get("FAL_MODEL_V4") || "fal-ai/flux-pro";

type FalSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

function falSizeToken(sizeStr?: string | null): FalSize {
  const allowed = new Set<FalSize>([
    "square_hd",
    "square",
    "portrait_4_3",
    "portrait_16_9",
    "landscape_4_3",
    "landscape_16_9",
  ]);
  if (!sizeStr) return "square_hd";
  const s = sizeStr.toLowerCase().trim() as FalSize;
  return allowed.has(s) ? s : "square_hd";
}

function tierParams(model: string, tier: string) {
  const isSchnell = model.includes("/schnell");
  if (isSchnell) return {};
  if (tier === "zylo-v4") return { num_inference_steps: 30, guidance_scale: 3.5 };
  return { num_inference_steps: 24, guidance_scale: 3.5 };
}

async function falRunOnce(model: string, input: Record<string, any>) {
  if (!FAL_KEY) throw new Error("Missing FAL_API_KEY");

  const start = await fetch(`${FAL_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!start.ok) {
    throw new Error(`fal start ${start.status}: ${await start.text()}`);
  }

  const j = await start.json();

  const direct =
    j?.image?.url ||
    j?.images?.[0]?.url ||
    j?.output?.image?.url ||
    j?.output?.images?.[0]?.url ||
    null;

  if (direct) return { url: direct, raw: j };

  const request_id = j?.request_id || j?.requestId || null;
  if (!request_id) throw new Error("fal: no url or request_id in response");

  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const rs = await fetch(
      `${FAL_BASE}/v1/get/${encodeURIComponent(request_id)}`,
      { headers: { Authorization: `Key ${FAL_KEY}` } },
    );

    if (!rs.ok) {
      throw new Error(`fal poll ${rs.status}: ${await rs.text()}`);
    }

    const data = await rs.json();
    const url =
      data?.image?.url ||
      data?.images?.[0]?.url ||
      data?.output?.image?.url ||
      data?.output?.images?.[0]?.url ||
      null;

    if (url) return { url, raw: data };

    if (data.status === "failed") {
      throw new Error(data.error?.message || "fal run failed");
    }
  }

  throw new Error("fal timeout");
}

/* =========================== misc helpers ============================== */

function parseSizeWH(size: string): [number, number] {
  const m = (size || "").match(/(\d+)\s*[x×]\s*(\d+)/i);
  return m
    ? [Math.max(64, +m[1]), Math.max(64, +m[2])]
    : [1024, 1024];
}

function safeErr(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/* ---- Runware image-safe sizing ---- */

type Aspect16 = "1:1" | "9:16" | "16:9";

function aspectFromSize(size: string): Aspect16 {
  const [w, h] = parseSizeWH(size);
  const r = w / h;
  if (Math.abs(r - 1) < 0.15) return "1:1";
  if (r < 1) return "9:16";
  return "16:9";
}

function getRunwareImageSize(toolKey: string, aspect: Aspect16) {
  if (toolKey === "t2i:v2") {
    switch (aspect) {
      case "1:1":
        return { width: 1024, height: 1024 };
      case "9:16":
        return { width: 768, height: 1344 };
      case "16:9":
      default:
        return { width: 1344, height: 768 };
    }
  }
  if (toolKey === "t2i:v3") {
    switch (aspect) {
      case "1:1":
        return { width: 1024, height: 1024 };
      case "9:16":
        return { width: 720, height: 1280 };
      case "16:9":
      default:
        return { width: 1280, height: 720 };
    }
  }

  switch (aspect) {
    case "1:1":
      return { width: 1024, height: 1024 };
    case "9:16":
      return { width: 720, height: 1280 };
    case "16:9":
    default:
      return { width: 1280, height: 720 };
  }
}

/* ====================== Runware video helpers ========================== */

/**
 * Map your internal tiers -> AIR tags.
 * Adjust if you change providers/pricing.
 */
const VIDEO_AIRTAG_BY_TIER: Record<string, string> = {
  "zylo-v1": Deno.env.get("RUNWARE_T2V_V1_AIRTAG") || "bytedance:2@2",
  "zylo-v2": Deno.env.get("RUNWARE_T2V_V2_AIRTAG") || "bytedance:2@2",
  "zylo-v3": Deno.env.get("RUNWARE_T2V_V3_AIRTAG") || "bytedance:2@2",
  "zylo-v4": Deno.env.get("RUNWARE_T2V_V4_AIRTAG") || "klingai:6@1",
};

/**
 * Compute a valid width/height pair for the Runware video models.
 * Uses the allowed matrix from their docs.
 */
function pickRunwareVideoSize(
  aspect: "16:9" | "9:16" | "1:1",
): { width: number; height: number } {
  // Keep it simple & valid:
  switch (aspect) {
    case "1:1":
      return { width: 960, height: 960 }; // 960x960 is allowed
    case "9:16":
      return { width: 704, height: 1248 }; // allowed list
    case "16:9":
    default:
      return { width: 1248, height: 704 }; // allowed list
  }
}

/**
 * Launch a Runware AIR video task for the given job.
 * Uses job.id as taskUUID so polling is straightforward.
 */
async function launchRunwareVideoForJob(jobRow: any): Promise<string> {
  const tier = (jobRow?.settings?.tier || "zylo-v2").toString();
  const aspect = (jobRow?.input?.aspect || "9:16") as "16:9" | "9:16" | "1:1";
  const durationSec = Math.max(
    1,
    Math.ceil(jobRow?.input?.durationSec ?? 5),
  );
  const audio = !!jobRow?.input?.audio;

  const basePrompt =
    jobRow?.input?.subject ||
    jobRow?.input?.prompt ||
    jobRow?.input?.topic ||
    jobRow?.prompt ||
    "short cinematic video";

  const subject = `${basePrompt}, cinematic, smooth motion, high detail, professional lighting, sharp focus`;

  const airTag =
    VIDEO_AIRTAG_BY_TIER[tier] || VIDEO_AIRTAG_BY_TIER["zylo-v2"];

  const { width, height } = pickRunwareVideoSize(aspect);

  const seedFrames: string[] = [
    jobRow?.input?.product?._url ||
      jobRow?.input?.product?.image_url ||
      null,
    jobRow?.input?.avatar_meta?.image_url || null,
    jobRow?.input?.initImageUrl || null,
  ].filter(Boolean) as string[];

  const frameImages =
    seedFrames.length > 0
      ? [
          {
            inputImage: seedFrames[0],
            frame: "first",
          },
        ]
      : undefined;

  const payload = [
    {
      taskType: "videoInference",
      taskUUID: jobRow.id, // align provider id with our job id
      airTag,
      positivePrompt: subject,
      duration: durationSec,
      width,
      height,
      numberResults: 1,
      ...(frameImages ? { frameImages } : {}),
      // audio flag is ignored if model doesn't support it
    },
  ];

  const { ok, json, status, text } = await launchRunwareVideo(payload);

  if (!ok) {
    throw new Error(
      `Runware launch failed (${status}): ${
        (json && JSON.stringify(json)) || text
      }`,
    );
  }

  const task =
    (json?.data && json.data[0]) ||
    (Array.isArray(json) ? json[0] : null);

  const providerJobId: string =
    task?.taskUUID || task?.id || jobRow.id;

  return providerJobId;
}

/**
 * Poll a Runware AIR task and map into {status,url,error}.
 */
async function pollRunwareVideo(
  providerJobId: string,
): Promise<{ status: "running" | "succeeded" | "failed"; url?: string | null; error?: string | null }> {
  const { ok, json, status, text } = await pollRunware(providerJobId);

  if (!ok) {
    return {
      status: "failed",
      error: `Runware poll http ${status}: ${
        (json && JSON.stringify(json)) || text
      }`,
    };
  }

  const task =
    (json?.data && json.data[0]) ||
    (Array.isArray(json) ? json[0] : null) ||
    json;

  if (!task) {
    return { status: "running" };
  }

  const tStatus = (task.status || task.taskStatus || "").toLowerCase();

  if (tStatus === "failed" || tStatus === "error") {
    const msg =
      task.error?.message ||
      task.message ||
      text ||
      "Runware reported failure";
    return { status: "failed", error: msg };
  }

 if (
  tStatus === "success" ||      // ← Runware actual response
  tStatus === "succeeded" ||
  tStatus === "completed"
) {
    // Try multiple common shapes
    let url: string | null =
      task.videoURL ||
      task.result?.videoURL ||
      task.url ||
      task.result_url ||
      null;

    if (!url && Array.isArray(task.outputs)) {
      const vid =
        task.outputs.find(
          (o: any) =>
            typeof o?.url === "string" &&
            (o.mimeType?.includes("mp4") || o.type === "video"),
        ) || task.outputs[0];
      if (vid?.url) url = vid.url;
    }

    if (!url) {
      try {
        const deep = JSON.stringify(task);
        const m = deep.match(
          /https?:\/\/[^\s"']+\.(?:mp4|webm|mov|m4v)/i,
        );
        url = m ? m[0] : null;
      } catch {
        // ignore
      }
    }

    if (!url) {
      return {
        status: "failed",
        error: "provider completed but no video URL found",
      };
    }

    return { status: "succeeded", url };
  }

  // queued / running / processing
  return { status: "running" };
}

/* ====================== credit helpers (DB) ============================ */

function priceKeyFor(jobRow: any): {
  tool_key: string;
  model: string | null;
} {
  // AD STUDIO PRICING (NEVER T2V)
  if (jobRow?.input?.ad?.creative === true || jobRow?.tool_key === "ad-studio") {
    return {
      tool_key: "ads",
      model: jobRow?.input?.ad?.modelKey || null,
    };
  }

  // PRODUCT PHOTOS
  const toolHint = (
    jobRow?.settings?.tool ||
    jobRow?.input?.tool ||
    jobRow?.tool_key ||
    ""
  )
    .toString()
    .toLowerCase();

  if (toolHint === "product-photo" || toolHint === "photos") {
    return { tool_key: "photos", model: null };
  }

  // NORMAL T2V VIDEO (NOT AD)
  if (jobRow.type === "video") {
    const tier = (jobRow?.settings?.tier || "zylo-v2").toString();
    const tk =
      tier === "zylo-v4"
        ? "t2v:v4"
        : tier === "zylo-v3"
        ? "t2v:v3"
        : "t2v:v2";
    return { tool_key: tk, model: null };
  }

  // IMAGES
  if (jobRow.type === "image") {
    const tier = (jobRow?.settings?.tier || "zylo-v2").toString();
    const tk =
      tier === "zylo-v4"
        ? "t2i:v4"
        : tier === "zylo-v3"
        ? "t2i:v3"
        : "t2i:v2";
    return { tool_key: tk, model: null };
  }

  // fallback
  return { tool_key: "t2i:v2", model: null };
}



async function ensureJobChargeCredits(
  sbAdmin: ReturnType<typeof createClient>,
  jobRow: any,
): Promise<number> {
  // 🚫 Product Photos are PRE-PAID in jobs.ts → NEVER auto-charge here
  const toolHint = (
    jobRow?.settings?.tool ||
    jobRow?.input?.tool ||
    jobRow?.tool_key ||
    ""
  )
    .toString()
    .toLowerCase();

  if (toolHint === "product-photo" || toolHint === "photos") {
    return 0;
  }

  // If job already has charge_credits, don't touch it
  const existing = Number(jobRow.charge_credits ?? 0);
  if (existing > 0) return existing;

  const { tool_key } = priceKeyFor(jobRow);

  const { data: priceRow, error } = await sbAdmin
    .from("app_provider_prices")
    .select("credits, pricing")
    .eq("tool_key", tool_key)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error || !priceRow) {
    console.log(
      "ensureJobChargeCredits: no active price row for",
      tool_key,
      error?.message || "",
    );
    return 0;
  }

  let amt = 0;

  // ---------- VIDEO: duration-based pricing ----------
  if (jobRow.type === "video") {
    const duration = Math.round(jobRow?.input?.durationSec ?? 5);
    const pricing = (priceRow as any).pricing || {};

    if (duration <= 5 && typeof pricing.per5 === "number") {
      amt = pricing.per5;
    } else if (duration <= 10 && typeof pricing.per10 === "number") {
      amt = pricing.per10;
    } else {
      amt = Number(priceRow.credits ?? 0);
    }
  } else {
    // ---------- NON-VIDEO ----------
    amt = Number(priceRow.credits ?? 0);
  }

  if (!amt || amt <= 0) {
    console.log(
      "ensureJobChargeCredits: price row has zero credits for",
      tool_key,
      "type=",
      jobRow.type,
    );
    return 0;
  }

  // Persist on job
  await sbAdmin
    .from("jobs")
    .update({
      charge_credits: amt,
      tool_key,
    })
    .eq("id", jobRow.id);

  jobRow.charge_credits = amt;
  return amt;
}





async function ensureSufficientCredits(
  sbAdmin: ReturnType<typeof createClient>,
  jobRow: any,
): Promise<{ ok: boolean; msg?: string }> {
  const amount = Number(jobRow.charge_credits ?? 0);
  if (!amount || amount <= 0) {
    return { ok: true };
  }

  const { data: prof, error: profErr } = await sbAdmin
    .from("profiles")
    .select("credit_balance")
    .eq("id", jobRow.user_id)
    .single();

  if (profErr || !prof) {
    console.error(
      "ensureSufficientCredits: profile fetch error",
      profErr?.message,
    );
    return {
      ok: false,
      msg: "Unable to read credits. Please try again.",
    };
  }

  const have = Number(prof.credit_balance ?? 0);
  if (have < amount) {
    return {
      ok: false,
      msg: `Insufficient credits (need ${amount}, have ${have})`,
    };
  }

  return { ok: true };
}

async function chargeJobIfNeeded(
  sbAdmin: ReturnType<typeof createClient>,
  jobId: string,
) {
  const { data: job, error: jobErr } = await sbAdmin
    .from("jobs")
    .select(
      "id,user_id,type,input,settings,tool_key,model,charge_credits",
    )
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.error("chargeJobIfNeeded: load job error", jobErr?.message);
    return;
  }

  const amount = Number(job.charge_credits ?? 0);
  if (!amount || amount <= 0) {
    console.log(
      "chargeJobIfNeeded: no charge_credits set, skipping",
      job.id,
      amount,
    );
    return;
  }

  const { data: existing, error: existingErr } = await sbAdmin
    .from("credit_ledger")
    .select("id")
    .eq("job_id", job.id)
    .maybeSingle();

  if (existingErr) {
    console.error(
      "chargeJobIfNeeded: ledger lookup error",
      existingErr.message,
    );
    return;
  }
  if (existing) {
    console.log("chargeJobIfNeeded: already charged", job.id);
    return;
  }

  const { data: prof, error: profErr } = await sbAdmin
    .from("profiles")
    .select("credit_balance")
    .eq("id", job.user_id)
    .single();

  if (profErr || !prof) {
    console.error(
      "chargeJobIfNeeded: profile fetch error",
      profErr?.message,
    );
    return;
  }

  const current = Number(prof.credit_balance ?? 0);
  const next = current - amount;

  const { tool_key, model } = priceKeyFor(job);

  const ledgerId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${job.id}-${Date.now()}`;

  const { error: ledgerErr } = await sbAdmin.from("credit_ledger").insert({
    id: ledgerId,
    user_id: job.user_id,
    job_id: job.id,
    idempotency_key: job.id,
    delta: -amount,
    type: "job",
    reason: {
      source: "job-worker",
      tool_key,
      model,
      build: BUILD_TAG,
    },
  });

  if (ledgerErr) {
    console.error(
      "chargeJobIfNeeded: ledger insert error",
      ledgerErr.message,
    );
    return;
  }

  const { error: updErr } = await sbAdmin
    .from("profiles")
    .update({ credit_balance: next })
    .eq("id", job.user_id);

  if (updErr) {
    console.error(
      "chargeJobIfNeeded: profile update error",
      updErr.message,
    );
    return;
  }

  console.log(
    `chargeJobIfNeeded: charged ${amount} (balance ${current} -> ${next}) for job ${job.id}`,
  );
}

/* ================================ MAIN ================================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    if (req.method !== "POST") return fail(req, "Method not allowed", 405);
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      return fail(
        req,
        "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SERVICE_ROLE_KEY",
        500,
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      debug?: boolean;
    };
    const manualJobId = body?.jobId;

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

    

    // Debug probe
    if (body?.debug) {
      const probe = await sbAdmin.rpc("bump_job_progress", {
        p_id: "00000000-0000-0000-0000-000000000000",
        p_progress: 0,
      });
      return json(req, {
        ok: true,
        build: BUILD_TAG,
        env: {
          hasUrl: !!SUPABASE_URL,
          hasAnon: !!ANON_KEY,
          hasService: !!SERVICE_ROLE_KEY,
        },
        canCallRpc: !probe.error,
        rpcError: probe.error?.message ?? null,
      });
    }

    /* ------------------------ Choose target job ------------------------ */

    let targetId = manualJobId;
    if (!targetId) {
     const { data: oldest, error: qErr } = await sbAdmin
  .from("jobs")
  .select("id,status")
  .eq("status", "queued")
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();


      if (qErr) return fail(req, `query error: ${qErr.message}`, 500);
      if (!oldest) {
        return json(req, {
          ok: true,
          build: BUILD_TAG,
          message: "no queued jobs",
        });
      }
      targetId = oldest.id;
    }

    // Try to claim job
    const { error: claimErr } = await sbAdmin.rpc("claim_job", {
      p_id: targetId,
    });
    if (claimErr) {
      console.log("claim_job error:", claimErr.message);
    }

    /* ----------------------- Load job after claim ---------------------- */

    const { data: jobRow, error: loadErr } = await sbAdmin
      .from("jobs")
      .select(
        "id,user_id,type,input,settings,output,progress,status,charge_credits,tool_key,model",
      )
      .eq("id", targetId)
      .single();

    if (loadErr || !jobRow) {
      return fail(req, `load job error: ${loadErr?.message}`, 500);
    }

    // Ensure charge_credits is set (no-op / logging if 0)
    await ensureJobChargeCredits(sbAdmin, jobRow);

    // Ensure they have enough credits
    const creditCheck = await ensureSufficientCredits(sbAdmin, jobRow);
    if (!creditCheck.ok) {
      await sbAdmin.rpc("finish_job_fail", {
        p_id: targetId,
        p_error: creditCheck.msg,
      });
      return json(
        req,
        {
          ok: false,
          build: BUILD_TAG,
          id: targetId,
          message: "insufficient credits",
        },
        402,
      );
    }



      /* =========================== AD VIDEO ============================ */
if (jobRow?.tool_key === "ad-studio" || jobRow?.input?.ad?.creative) {
  try {
    // progress bar
    await sbAdmin.rpc("bump_job_progress", {
      p_id: targetId,
      p_progress: 10,
    });

    const fnUrl = `${SUPABASE_URL}/functions/v1/runware-ad-video`;
    const payload = {
      jobId: targetId,
      ad: jobRow?.input?.ad,
      product: jobRow?.input?.product,
      avatar_meta: jobRow?.input?.avatar_meta,
      meta: jobRow?.input?.meta,
    };

    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {}, // or nothing at all
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok || data?.error) {
      const msg =
        data?.error ||
        `runware-ad-video error (status ${res.status})`;

      await sbAdmin.rpc("finish_job_fail", {
        p_id: targetId,
        p_error: msg,
      });

      return json(req, {
        ok: false,
        build: BUILD_TAG,
        id: targetId,
        message: msg,
      });
    }

    await chargeJobIfNeeded(sbAdmin, targetId);

    await sbAdmin.rpc("finish_job_success", {
      p_id: targetId,
      p_url: data.url ?? null,
      p_output: {
        provider: "runware",
        tool: "ad-studio",
        result: data,
      },
    });

    return json(req, {
      ok: true,
      build: BUILD_TAG,
      id: targetId,
      result_url: data.url ?? null,
    });
  } catch (e) {
    const msg = `runware-ad-video provider error: ${safeErr(e)}`;
    await sbAdmin.rpc("finish_job_fail", {
      p_id: targetId,
      p_error: msg,
    });
    return json(req, {
      ok: false,
      build: BUILD_TAG,
      id: targetId,
      message: msg,
    });
  }
}

    /* =============================== SWITCH ============================ */

    switch (jobRow.type) {
      /* ============================== VIDEO ============================ */
     /* ============================== VIDEO ============================ */
case "video": {
  // ❗ Reload job because runware-video updated the row only milliseconds ago
  const { data: fresh, error: freshErr } = await sbAdmin
    .from("jobs")
    .select("*")
    .eq("id", targetId)
    .single();

  const jobSafe = fresh || jobRow;

  const providerJobId =
    jobSafe?.output?.providerJobId ||
    jobSafe?.output?.jobId ||
    jobSafe?.output?.runwareJobId ||
    jobSafe?.settings?.provider_job_id ||
    null;

  if (!providerJobId) {
    const msg =
      "Video job missing providerJobId. Launch must be via /runware-video.";
    await sbAdmin.rpc("finish_job_fail", {
      p_id: targetId,
      p_error: msg,
    });
    return json(req, {
      ok: false,
      build: BUILD_TAG,
      id: targetId,
      message: msg,
    });
  }
  try {
    const poll = await pollRunwareVideo(providerJobId);

    /* ------------------ SUCCESS ------------------ */
    if (poll.status === "succeeded") {
      await chargeJobIfNeeded(sbAdmin, targetId);

      await sbAdmin.rpc("finish_job_success", {
        p_id: targetId,
        p_url: poll.url ?? null,
        p_output: {
          provider: "runware",
          providerJobId,
          lastPoll: poll,
        },
      });

      // bump to 100
      await sbAdmin.rpc("bump_job_progress", {
        p_id: targetId,
        p_progress: 100,
      });

      return json(req, {
        ok: true,
        build: BUILD_TAG,
        id: targetId,
        result_url: poll.url ?? null,
      });
    }

    /* ------------------ FAILURE ------------------ */
    if (poll.status === "failed") {
      await sbAdmin.rpc("finish_job_fail", {
        p_id: targetId,
        p_error: poll.error || "provider failed",
      });
      return json(req, {
        ok: false,
        build: BUILD_TAG,
        id: targetId,
        message: poll.error || "provider failed",
      });
    }

       /* ------------------ STILL RUNNING ------------------ */

    // Smooth 30-step cinematic progress ladder (10 → 97)
    const PROGRESS_LADDER = [
      10, 13, 16, 19, 22, 25, 28, 31, 34, 37,
      40, 43, 46, 49, 52, 55, 58, 61, 64, 67,
      70, 73, 76, 79, 82, 85, 88, 91, 94, 97,
    ];

    // use the fresh row we just loaded, not the original snapshot
    const current = Number(jobSafe?.progress ?? 0);
    const next = PROGRESS_LADDER.find((p) => p > current) ?? 97;

    await sbAdmin.rpc("bump_job_progress", {
      p_id: targetId,
      p_progress: next,
    });

    // schedule another poll for THIS job
    await scheduleNextTick(targetId);

    return json(req, {
      ok: true,
      build: BUILD_TAG,
      id: targetId,
      message: "polling",
    });
  } catch (e) {
    await sbAdmin.rpc("finish_job_fail", {
      p_id: targetId,
      p_error: `provider poll error: ${safeErr(e)}`,
    });
    return json(req, {
      ok: false,
      build: BUILD_TAG,
      id: targetId,
      message: "provider poll error",
    });
  }
}

      /* ============================== IMAGE ============================ */
      case "image": {
        const tier = jobRow?.settings?.tier || "zylo-v2";
        const size = (jobRow?.settings?.size || "1024x1024") as string;
        const hint = jobRow?.settings?.provider_hint || null;

        const toolHint = (
          jobRow?.settings?.tool ||
          jobRow?.input?.tool ||
          jobRow?.tool_key ||
          ""
        )
          .toString()
          .toLowerCase();

        // PRODUCT PHOTOS → Runware Kontext
        if (toolHint === "product-photo" || toolHint === "photos") {
          await sbAdmin.rpc("bump_job_progress", {
            p_id: targetId,
            p_progress: 10,
          });

          try {
            const fnUrl = `${SUPABASE_URL}/functions/v1/runware-product-photo`;
            const payload = {
              toolKey: "product-photo",
              ...jobRow.input,
              userId: jobRow.user_id,
            };

            const res = await fetch(fnUrl, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                apikey: ANON_KEY,
                authorization: `Bearer ${ANON_KEY}`,
              },
              body: JSON.stringify(payload),
            });

            const data: any = await res.json().catch(() => ({}));

            if (!res.ok || !data?.ok) {
              const msg =
                data?.error ||
                `runware-product-photo error (status ${res.status})`;
              await sbAdmin.rpc("finish_job_fail", {
                p_id: targetId,
                p_error: msg,
              });
              return json(req, {
                ok: false,
                build: BUILD_TAG,
                id: targetId,
                message: msg,
              });
            }

            await chargeJobIfNeeded(sbAdmin, targetId);

            await sbAdmin.rpc("finish_job_success", {
              p_id: targetId,
              p_url: data.url ?? null,
              p_output: {
                provider: "runware",
                tool: "product-photo",
                imageId: data.imageId ?? null,
                seed: data.seed ?? null,
              },
            });

            return json(req, {
              ok: true,
              build: BUILD_TAG,
              id: targetId,
              result_url: data.url ?? null,
            });
          } catch (e) {
            const msg = `product-photo provider error: ${safeErr(e)}`;
            await sbAdmin.rpc("finish_job_fail", {
              p_id: targetId,
              p_error: msg,
            });
            return json(req, {
              ok: false,
              build: BUILD_TAG,
              id: targetId,
              message: msg,
            });
          }
        }

        // Runware t2i path (if configured via provider_hint)
        const baseNeg =
          jobRow?.input?.negative ||
          "text, letters, watermark, logo, caption, blurry, low-res, oversharpen, artifact";

        const negative =
          tier === "zylo-v3"
            ? baseNeg +
              ", no watermark, no logo, no branding, no text overlay, no stamps"
            : baseNeg;

        const subject =
          jobRow?.input?.subject ||
          jobRow?.input?.topic ||
          "simple subject";

        const prompt = `${subject}, clean composition, sharp focus, high detail, no watermark, no logo. Avoid: ${negative}`;

        if (hint?.engine === "runware" && hint?.mode === "t2i") {
          const derivedTier = (jobRow?.settings?.tier || "zylo-v2").toString();
          const toolKey =
            derivedTier === "zylo-v4"
              ? "t2i:v4"
              : derivedTier === "zylo-v3"
              ? "t2i:v3"
              : "t2i:v2";

          const aspect = aspectFromSize(size);
          const { width, height } = getRunwareImageSize(toolKey, aspect);

          await sbAdmin.rpc("bump_job_progress", {
            p_id: targetId,
            p_progress: 10,
          });

          const fnUrl = `${SUPABASE_URL}${
            hint?.edgeFn || "/functions/v1/runware-image"
          }`;

          await chargeJobIfNeeded(sbAdmin, targetId);

          await fetch(fnUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              apikey: ANON_KEY,
              authorization: `Bearer ${ANON_KEY}`,
            },
            body: JSON.stringify({
              jobId: targetId,
              userId: jobRow.user_id,
              airTag: hint.airTag,
              mode: "t2i",
              prompt,
              imageUrl: jobRow?.input?.initImageUrl || null,
              settings: {
                ...(hint?.settings || {}),
                width,
                height,
              },
            }),
          }).catch(() => {});

          return json(req, {
            ok: true,
            build: BUILD_TAG,
            id: targetId,
            message: "image job started (runware)",
          });
        }

        // FAL / default
        await sbAdmin.rpc("bump_job_progress", {
          p_id: targetId,
          p_progress: 10,
        });

        const model =
          tier === "zylo-v4"
            ? MODEL_V4
            : tier === "zylo-v3"
            ? MODEL_V3
            : MODEL_V2;

        let resultUrl = "about:blank";

        try {
          const r = await falRunOnce(model, {
            prompt,
            image_size: falSizeToken(size),
            ...(tierParams(model, tier)),
            ...(jobRow?.input?.initImageUrl
              ? { image_url: jobRow.input.initImageUrl }
              : {}),
          });
          resultUrl = r.url || resultUrl;
        } catch (e) {
          await sbAdmin.rpc("finish_job_fail", {
            p_id: targetId,
            p_error: `provider error: ${safeErr(e)}`,
          });
          return json(req, {
            ok: false,
            build: BUILD_TAG,
            id: targetId,
            message: "provider error",
          });
        }

        await chargeJobIfNeeded(sbAdmin, targetId);

        await sbAdmin.rpc("finish_job_success", {
          p_id: targetId,
          p_url: resultUrl,
          p_output: {
            provider: "fal.run",
            model,
            image_size: falSizeToken(size),
          },
        });

        return json(req, {
          ok: true,
          build: BUILD_TAG,
          id: targetId,
          result_url: resultUrl,
        });
      }

      /* ============================ FALLBACK ============================ */
      default: {
        await sbAdmin.rpc("finish_job_fail", {
          p_id: targetId,
          p_error: `Unsupported job type: ${jobRow.type}`,
        });
        return json(
          req,
          {
            ok: false,
            build: BUILD_TAG,
            id: targetId,
            message: "unsupported job type",
          },
          400,
        );
      }
    }
  } catch (e) {
    console.error("unhandled", e);
    return fail(req, `unhandled: ${safeErr(e)}`, 500);
  }
});
