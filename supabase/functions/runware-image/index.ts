// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ===================== ENV ===================== */
const RUNWARE_KEY  = Deno.env.get("RUNWARE_API_KEY")!;
const RUNWARE_BASE = "https://api.runware.ai/v1/air";
const TASKS_URL    = `${RUNWARE_BASE}/tasks`;

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY")!;

/* ===================== CONFIG ===================== */
const MAX_RUNTIME_MS   = 5 * 60 * 1000; // 5 min — within edge-fn wall-clock limit
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS        = Math.floor(MAX_RUNTIME_MS / POLL_INTERVAL_MS);
const FETCH_TIMEOUT_MS = 30_000;

const CORS_HEADERS = {
  "access-control-allow-origin":  "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey",
};

/* ===================== HELPERS ===================== */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeSb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/**
 * Safe RPC — never chain .catch() on sb.rpc() in Supabase Edge Runtime.
 * Always await + try/catch + destructure { data, error }.
 */
async function safeRpc(
  sb: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ data: unknown; error: unknown }> {
  try {
    const { data, error } = await sb.rpc(name, args);
    if (error) {
      console.error(`[runware-image] RPC ${name} failed:`, JSON.stringify(error).slice(0, 200));
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error(`[runware-image] RPC ${name} threw:`, String((err as any)?.message ?? err));
    return { data: null, error: err };
  }
}

/**
 * Safe fetch: AbortController timeout + read body as text first, then JSON.parse.
 * Never leaves the response body unread (prevents connection issues).
 */
async function safeFetch(
  url: string,
  options: RequestInit,
): Promise<{ ok: boolean; status: number; text: string; json: any }> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res  = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {
      if (text.length) console.warn("[runware-image] non-JSON body:", text.slice(0, 200));
    }
    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

async function safeFetchRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<{ ok: boolean; status: number; text: string; json: any }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try { return await safeFetch(url, options); }
    catch (e) {
      lastErr = e;
      console.warn(`[runware-image] fetch attempt ${attempt + 1} failed:`, String(e));
      if (attempt < maxRetries - 1) await sleep(2000);
    }
  }
  throw lastErr;
}

/**
 * Robust URL extractor — handles GPT Image 2 and all other
 * Runware response shapes. Only returns real image URLs/data URIs, never
 * arbitrary links from error payloads such as documentation URLs.
 */
function isLoadableImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url || url === "undefined" || url === "null" || url.startsWith("[object ")) return false;
  if (/^data:image\//i.test(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === "runware.ai" && path.includes("/docs/")) return false;

    return (
      host === "im.runware.ai" ||
      path.includes("/image/") ||
      path.includes("/storage/v1/object/") ||
      /\.(png|jpe?g|webp|gif|avif)$/i.test(path)
    );
  } catch {
    return false;
  }
}

function extractImageUrl(obj: any): string | null {
  if (!obj) return null;

  const candidates: (string | undefined)[] = [
    // Direct fields
    obj?.imageDataURI,
    obj?.imageBase64Data ? `data:image/png;base64,${obj.imageBase64Data}` : undefined,
    obj?.imageURL,
    obj?.imageUrl,
    obj?.image_url,
    obj?.url,
    // Nested in output
    obj?.output?.imageDataURI,
    obj?.output?.imageBase64Data ? `data:image/png;base64,${obj.output.imageBase64Data}` : undefined,
    obj?.output?.imageURL,
    obj?.output?.imageUrl,
    obj?.output?.image_url,
    obj?.output?.url,
    obj?.output?.dataURI,
    obj?.output?.dataUri,
    // data array (most Runware responses)
    obj?.data?.[0]?.imageDataURI,
    obj?.data?.[0]?.imageBase64Data ? `data:image/png;base64,${obj.data[0].imageBase64Data}` : undefined,
    obj?.data?.[0]?.imageURL,
    obj?.data?.[0]?.imageUrl,
    obj?.data?.[0]?.image_url,
    obj?.data?.[0]?.url,
    obj?.data?.[0]?.dataURI,
    obj?.data?.[0]?.dataUri,
    obj?.data?.[0]?.outputs?.[0]?.imageURL,
    obj?.data?.[0]?.outputs?.[0]?.imageUrl,
    obj?.data?.[0]?.outputs?.[0]?.image_url,
    obj?.data?.[0]?.outputs?.[0]?.url,
    obj?.data?.[0]?.outputs?.[0]?.dataURI,
    obj?.data?.[0]?.outputs?.[0]?.dataUri,
    // results array
    obj?.results?.[0]?.imageDataURI,
    obj?.results?.[0]?.imageBase64Data ? `data:image/png;base64,${obj.results[0].imageBase64Data}` : undefined,
    obj?.results?.[0]?.imageURL,
    obj?.results?.[0]?.imageUrl,
    obj?.results?.[0]?.image_url,
    obj?.results?.[0]?.url,
    obj?.results?.[0]?.dataURI,
    obj?.results?.[0]?.dataUri,
    // data as single object
    obj?.data?.imageDataURI,
    obj?.data?.imageBase64Data ? `data:image/png;base64,${obj.data.imageBase64Data}` : undefined,
    obj?.data?.imageURL,
    obj?.data?.imageUrl,
    obj?.data?.image_url,
    obj?.data?.url,
    obj?.data?.dataURI,
    obj?.data?.dataUri,
    obj?.data?.outputs?.[0]?.imageURL,
    obj?.data?.outputs?.[0]?.imageUrl,
    obj?.data?.outputs?.[0]?.image_url,
    obj?.data?.outputs?.[0]?.url,
    obj?.data?.outputs?.[0]?.dataURI,
    obj?.data?.outputs?.[0]?.dataUri,
  ];

  const url = candidates.find(isLoadableImageUrl);
  if (url) return url.trim();

  const seen = new Set<any>();
  const scan = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string") {
      if (isLoadableImageUrl(value)) return value.trim();
      return null;
    }
    if (typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = scan(item);
        if (found) return found;
      }
      return null;
    }

    const preferredKeys = [
      "result_url",
      "resultUrl",
      "imageURL",
      "imageUrl",
      "image_url",
      "url",
      "dataURI",
      "dataUri",
    ];
    for (const key of preferredKeys) {
      const found = scan(value[key]);
      if (found) return found;
    }
    for (const key of Object.keys(value)) {
      const found = scan(value[key]);
      if (found) return found;
    }
    return null;
  };

  return scan(obj);
}

function getRunwareError(obj: any): { code?: string; message: string } | null {
  const raw =
    obj?.errors?.[0] ??
    obj?.error ??
    obj?.data?.find?.((item: any) => String(item?.status ?? "").toLowerCase() === "error")?.error ??
    obj?.data?.find?.((item: any) => String(item?.status ?? "").toLowerCase() === "error") ??
    null;

  if (!raw) return null;

  return {
    code: raw.code ?? raw.errorCode ?? raw.status,
    message: raw.message ?? raw.error ?? "Runware image generation failed.",
  };
}

async function pollRunwareResponse(taskUUID: string) {
  return safeFetch(TASKS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RUNWARE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ taskType: "getResponse", taskUUID }]),
  });
}

async function uploadImageToRunware(publicUrl: string): Promise<string> {
  const result = await safeFetchRetry(TASKS_URL, {
    method:  "POST",
    headers: { Authorization: `Bearer ${RUNWARE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify([{
      taskType: "imageUpload",
      taskUUID: crypto.randomUUID(),
      image:    publicUrl,
    }]),
  });

  if (!result.ok || !result.json?.data?.[0]?.imageURL) {
    console.error("[runware-image] imageUpload response body", {
      sourceUrl: publicUrl,
      status: result.status,
      body: result.text.slice(0, 1000),
      json: result.json,
    });
    throw new Error(`imageUpload failed (${result.status}): ${result.text.slice(0, 200)}`);
  }
  return result.json.data[0].imageURL;
}

async function chargeJobCredits(
  sb: ReturnType<typeof createClient>,
  jobId: string,
) {
  const { data: job } = await sb
    .from("jobs").select("user_id, settings").eq("id", jobId).single();
  if (!job?.user_id) return;

  const { data: profile } = await sb
    .from("profiles").select("plan_code").eq("id", job.user_id).single();

  const isFree = (profile?.plan_code || "free").toLowerCase() === "free";

  if (isFree) {
    const { error } = await sb.from("image_generations").insert({ user_id: job.user_id });
    if (error) console.error("[runware-image] free usage log failed:", error);
  } else {
    const credits = Number(job.settings?.credits ?? 0);
    if (credits > 0) {
      await safeRpc(sb, "deduct_credits", { uid: job.user_id, amount: credits });
    }
  }
}

/* ===================== BACKGROUND JOB PROCESSOR =====================
   This function runs entirely inside EdgeRuntime.waitUntil, so the HTTP
   handler returns 202 immediately. The long polling happens here without
   holding any HTTP connection open.
===================================================================== */

/**
 * Builds the `inputs` object for a Runware task.
 * Accepts already-uploaded Runware CDN URLs.
 * Returns undefined when there are no valid refs (so `task.inputs` is omitted).
 */
function buildReferenceInputs(
  refs: string[],
): { referenceImages: string[] } | undefined {
  if (!Array.isArray(refs) || refs.length === 0) return undefined;
  const valid = refs.filter(
    (url) => typeof url === "string" && url.trim().startsWith("https://"),
  );
  return valid.length > 0 ? { referenceImages: valid } : undefined;
}

async function processRunwareImageJob(body: any): Promise<void> {
  const {
    jobId,
    airTag,
    prompt,
    referenceImages = [],
    settings        = {},
  } = body;

  const sb = makeSb();

  // 5% — job accepted, starting work
  void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 5 });

  const fruitModel = settings?.provider_hint?.settings?.fruitModel ?? null;
  const isFruitModel =
    settings?.tool_key === "image:fruit-v2" ||
    settings?.tool_key === "image:fruit-v3" ||
    fruitModel === "zyvo-v2" ||
    fruitModel === "zyvo-v3";
  const openAiSettings = settings?.provider_hint?.settings ?? {};
  const openAiQuality =
    settings?.quality ||
    openAiSettings?.quality ||
    (settings?.tool_key === "image:fruit-v3" || fruitModel === "zyvo-v3" ? "medium" : "low");
  const requestedWidth = Number(settings?.width ?? 1024);
  const requestedHeight = Number(settings?.height ?? 1024);
  const isFruitV3 = settings?.tool_key === "image:fruit-v3" || fruitModel === "zyvo-v3";
  const fruitV3Dims = requestedWidth >= requestedHeight
    ? { width: 1920, height: 1088 }
    : { width: 1088, height: 1920 };

  /* ── Upload reference images ── */
  console.log("[runware-image] received referenceImages", {
    jobId,
    count:   referenceImages.length,
    entries: referenceImages,
  });

  const runwareRefs: string[] = [];
  for (const url of referenceImages) {
    if (typeof url !== "string" || !url.trim()) {
      console.warn("[runware-image] ref skipped — not a string:", String(url).slice(0, 80));
      continue;
    }
    if (!url.startsWith("https://")) {
      console.error("[runware-image] ref upload FAILED:", {
        url,
        error: "Reference URL is not HTTPS",
      });
      continue;
    }
    if (false && !url.startsWith("https://")) {
      console.warn("[runware-image] ref skipped — not HTTPS:", url.slice(0, 100));
      continue;
    }
    try {
      console.log("[runware-image] uploading ref to Runware:", url);
      const rwUrl = await uploadImageToRunware(url);
      console.log("[runware-image] ref uploaded OK →", rwUrl.slice(0, 100));
      runwareRefs.push(rwUrl);
    } catch (e) {
      console.error("[runware-image] ref upload FAILED:", {
        url,
        error: String((e as any)?.message ?? e),
      });
    }
  }

  console.log("[runware-image] runwareRefs after upload", {
    jobId,
    uploaded: runwareRefs.length,
    total:    referenceImages.length,
  });

  // 10% — refs uploaded
  void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 10 });

  /* ── Build Runware task ── */
  if (isFruitModel && referenceImages.length > 0 && runwareRefs.length === 0) {
    const message = "All fruit story references failed to upload";
    console.error("[runware-image]", message, { jobId, referenceImages });
    await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: message });
    return;
  }

  // Fruit models use GPT Image 2 with multiple Runware-uploaded references.
  // Non-fruit models keep the legacy string outputType + PNG format.
  const task: any = {
    taskType:       "imageInference",
    taskUUID:       crypto.randomUUID(),
    model:          airTag,
    positivePrompt: prompt,
    width:          isFruitV3 ? fruitV3Dims.width : requestedWidth,
    height:         isFruitV3 ? fruitV3Dims.height : requestedHeight,
    numberResults:  1,
    outputType:     isFruitModel ? ["URL"] : "URL",
    ...(isFruitModel
      ? {
          includeCost: true,
          skipResponse: settings?.skipResponse ?? openAiSettings?.skipResponse ?? true,
          deliveryMethod: settings?.deliveryMethod ?? openAiSettings?.deliveryMethod ?? "async",
          outputQuality: settings?.outputQuality ?? openAiSettings?.outputQuality ?? 85,
        }
      : { outputFormat: "PNG" }),
  };

  // Attach uploaded reference images via the shared helper.
  // buildReferenceInputs returns undefined when refs is empty → task.inputs is omitted.
  const refInputs = buildReferenceInputs(runwareRefs);
  if (refInputs) task.inputs = refInputs;

  // Keep our existing quality setting for OpenAI models (quality: "low" for fruit-v2)
  if (airTag.startsWith("openai:")) {
    task.providerSettings = {
      openai: { quality: isFruitModel ? openAiQuality : (openAiSettings?.quality ?? "high") },
    };
  }

  if (isFruitModel && referenceImages.length > 0 && !task.inputs?.referenceImages?.length) {
    console.error("[runware-image] FRUIT REF LOST BEFORE RUNWARE", {
      originalRefs: referenceImages,
      uploadedRefs: runwareRefs,
      task,
    });
    await safeRpc(sb, "finish_job_failed", {
      p_id: jobId,
      p_error: "Fruit references lost before Runware payload",
    });
    return;
  }

  // Verify refs made it into the final payload
  console.log("[runware-image] final task refs", {
    taskUUID:         task.taskUUID,
    model:            task.model,
    hasInputs:        !!task.inputs,
    referenceImages:  task.inputs?.referenceImages ?? [],
  });
  console.log("[runware-image] FULL TASK PAYLOAD", JSON.stringify(task).slice(0, 3000));

  /* ── Submit task to Runware ── */
  const createResult = await safeFetchRetry(TASKS_URL, {
    method:  "POST",
    headers: { Authorization: `Bearer ${RUNWARE_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify([task]),
  });

  if (!createResult.ok || createResult.json?.errors?.length) {
    const message =
      createResult.json?.errors?.[0]?.message ||
      `Runware rejected task (${createResult.status}): ${createResult.text.slice(0, 200)}`;
    console.error("[runware-image] task creation failed:", message);
    await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: message });
    return;
  }

  // Prefer Runware's assigned taskUUID; fall back to ours
  const providerId =
    createResult.json?.data?.[0]?.taskUUID ??
    createResult.json?.data?.[0]?.id ??
    task.taskUUID;

  console.log("[runware-image] Runware accepted, providerId:", providerId);

  // 15% — task accepted by Runware
  void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 15 });

  /* ── Instant success (sync models return URL in create response) ── */
  const immediate = extractImageUrl(createResult.json);
  if (immediate) {
    console.log("[runware-image] FULL SUCCESS RESPONSE", JSON.stringify(createResult.json).slice(0, 3000));
    console.log("[runware-image] final image url (instant):", immediate.slice(0, 100));
    console.log("[runware-image] calling finish_job_success", { jobId });
    const { data, error } = await safeRpc(sb, "finish_job_success", {
      p_id:     jobId,
      p_url:    immediate,
      p_output: createResult.json,
    });
    console.log("[runware-image] finish_job_success result", { data, error: String(error ?? "null") });
    await chargeJobCredits(sb, jobId);
    return;
  }

  /* ══════════════════════════════════════════════════════════
     POLLING LOOP
     Runs entirely in the background (inside EdgeRuntime.waitUntil).
     Progress: 15% → 90% over MAX_RUNTIME_MS, bumped every 10 polls.
  ══════════════════════════════════════════════════════════ */

  const start = Date.now();

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const elapsed = Date.now() - start;
    if (elapsed > MAX_RUNTIME_MS) break;

    // Non-blocking progress bump
    if (i % 10 === 0) {
      const progress = Math.min(90, 15 + Math.round((elapsed / MAX_RUNTIME_MS) * 75));
      void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: progress });
    }

    let pollResult: { ok: boolean; status: number; text: string; json: any };
    try {
      pollResult = await pollRunwareResponse(providerId);
    } catch (e) {
      console.warn(`[runware-image] poll ${i} network error:`, String(e));
      continue;
    }

    const url = extractImageUrl(pollResult.json);
    const pollStatus = String(pollResult.json?.status ?? pollResult.json?.data?.[0]?.status ?? "").toLowerCase();
    const runwareError = getRunwareError(pollResult.json);

    console.log("[runware-image] poll result", {
      jobId,
      poll: i,
      httpStatus: pollResult.status,
      runwareStatus: pollStatus,
      hasImageUrl: !!url,
      errorCode: runwareError?.code ?? null,
    });

    if (url) {
      console.log("[runware-image] FULL SUCCESS RESPONSE", JSON.stringify(pollResult.json).slice(0, 3000));
      console.log("[runware-image] final image url:", url.slice(0, 100));
      console.log("[runware-image] calling finish_job_success", { jobId });
      const { data, error } = await safeRpc(sb, "finish_job_success", {
        p_id:     jobId,
        p_url:    url,
        p_output: pollResult.json,
      });
      console.log("[runware-image] finish_job_success result", { data, error: String(error ?? "null") });
      await chargeJobCredits(sb, jobId);
      return;
    }

    // Log full response shape when there's no URL (helps debug GPT Image 2 format)
    if (!pollResult.json) {
      console.warn("[runware-image] poll returned no JSON, raw:", pollResult.text.slice(0, 300));
      continue;
    }

    const errorCode =
      runwareError?.code ??
      pollResult.json?.errorCode ??
      pollResult.json?.data?.[0]?.errorCode;

    if (errorCode === "failedTaskTimeout") {
      console.log("[runware-image] Runware failedTaskTimeout — still processing, continuing");
      continue;
    }

    if (runwareError) {
      const message = `${runwareError.code ? `${runwareError.code}: ` : ""}${runwareError.message}`;
      console.error("[runware-image] Runware returned error:", message);
      await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: message });
      return;
    }

    // Runware sometimes emits transient "failed" before the result is ready
    if (pollStatus === "failed") {
      console.log("[runware-image] transient failed status — ignoring");
      continue;
    }
  }

  /* ── Final timeout ── */
  console.error("[runware-image] max runtime reached, no result received for jobId:", jobId);
  await safeRpc(sb, "finish_job_failed", {
    p_id:    jobId,
    p_error: "Image generation timed out after 5 minutes. Please try again.",
  });
}

/* ===================== HTTP HANDLER =====================
   Returns 202 immediately.
   All polling runs in the background via EdgeRuntime.waitUntil.
========================================================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let jobId: string | null = null;

  try {
    const body = await req.json();
    jobId = body?.jobId ?? null;

    if (!jobId || !body?.airTag || !body?.prompt) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: jobId, airTag, prompt" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Start background processing — does NOT block the HTTP response
    EdgeRuntime.waitUntil(
      processRunwareImageJob(body).catch(async (err) => {
        console.error("[runware-image] background process threw:", err);
        // processRunwareImageJob already calls finish_job_failed for known errors;
        // this catch is a final safety net for unexpected throws
        try {
          const sb = makeSb();
          await safeRpc(sb, "finish_job_failed", {
            p_id:    jobId!,
            p_error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
          });
        } catch { /* ignore */ }
      }),
    );

    // Return 202 immediately — caller (job-worker) does not wait for image generation
    return new Response(
      JSON.stringify({ ok: true, accepted: true, jobId }),
      { status: 202, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("[runware-image] handler error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to accept job request." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
