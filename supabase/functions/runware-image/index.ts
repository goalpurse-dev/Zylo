// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent as persistLog, type LogLevel } from "../_shared/systemLog.ts";

function logEvent(level: LogLevel, event: string, ctx: Record<string, unknown> = {}) {
  const icon = level === "error" ? "🔴" : level === "warn" ? "🟠" : "🟢";
  const line = `${icon} [runware-image] ${event}`;
  const detail = JSON.stringify({ ts: new Date().toISOString(), ...ctx });

  if (level === "error") console.error(line, detail);
  else if (level === "warn") console.warn(line, detail);
  else console.log(line, detail);

  void persistLog("runware-image", level, event, ctx);
}

/* ===================== ENV ===================== */
const RUNWARE_KEY  = Deno.env.get("RUNWARE_API_KEY")!;
// Runware's current native REST API uses one endpoint for submission,
// getResponse polling and image uploads.
const TASKS_URL = "https://api.runware.ai/v1";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY")!;

/* ===================== CONFIG ===================== */
const MAX_RUNTIME_MS   = 5 * 60 * 1000; // 5 min — within edge-fn wall-clock limit
const POLL_INTERVAL_MS = 1500;
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
      logEvent("error", "rpc_failed", { jobId: args?.p_id, rpc: name, message: error.message });
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    logEvent("error", "rpc_threw", { jobId: args?.p_id, rpc: name, message: String((err as any)?.message ?? err) });
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

function extensionFromContentType(contentType: string | null, fallback = "png") {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("avif")) return "avif";
  if (normalized.includes("png")) return "png";
  return fallback;
}

async function persistImageResult(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  sourceUrl: string,
): Promise<string> {
  if (!/^https?:\/\//i.test(sourceUrl)) return sourceUrl;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`download failed ${res.status}`);

    const contentType = res.headers.get("content-type") || "image/png";
    const blob = await res.blob();
    const ext = extensionFromContentType(contentType);
    const path = `runware/images/${jobId}.${ext}`;

    const { error: uploadError } = await sb.storage
      .from("generated")
      .upload(path, blob, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = sb.storage.from("generated").getPublicUrl(path);
    return data?.publicUrl || sourceUrl;
  } catch (e) {
    logEvent("warn", "persist_result_failed", { jobId, message: String((e as any)?.message ?? e) });
    return sourceUrl;
  }
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

async function getRunwareTaskDetails(taskUUID: string) {
  return safeFetch(TASKS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RUNWARE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ taskType: "getTaskDetails", taskUUID }]),
  });
}

function matchingTaskEntries(payload: any, taskUUID: string): any[] {
  const entries = Array.isArray(payload?.data) ? payload.data : [];
  const matching = entries.filter((entry: any) =>
    !entry?.taskUUID || String(entry.taskUUID) === taskUUID
  );
  return matching.length ? matching : entries;
}

function providerProgress(payload: any, taskUUID: string): number | null {
  const values = matchingTaskEntries(payload, taskUUID)
    .map((entry: any) => Number(entry?.progress))
    .filter((value: number) => Number.isFinite(value));
  return values.length ? Math.max(...values) : null;
}

function providerStatus(payload: any, taskUUID: string): string {
  const statuses = matchingTaskEntries(payload, taskUUID)
    .map((entry: any) => String(entry?.status ?? "").toLowerCase())
    .filter(Boolean);
  if (statuses.includes("success")) return "success";
  if (statuses.includes("error")) return "error";
  if (statuses.includes("processing")) return "processing";
  return String(payload?.status ?? "").toLowerCase();
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
    logEvent("error", "image_upload_failed", {
      sourceUrl: publicUrl,
      status: result.status,
      body: result.text.slice(0, 500),
    });
    throw new Error(`imageUpload failed (${result.status}): ${result.text.slice(0, 200)}`);
  }
  return result.json.data[0].imageURL;
}

async function chargeJobCredits(
  sb: ReturnType<typeof createClient>,
  jobId: string,
): Promise<boolean> {
  const { data: job } = await sb
    .from("jobs").select("user_id").eq("id", jobId).single();
  if (!job?.user_id) return false;

  const { data: profile } = await sb
    .from("profiles").select("plan_code").eq("id", job.user_id).single();

  const isFree = (profile?.plan_code || "free").toLowerCase() === "free";

  if (isFree) {
    const { error } = await sb.from("image_generations").insert({ user_id: job.user_id });
    if (error) logEvent("error", "free_usage_log_failed", { jobId, userId: job.user_id, message: error.message });
    return true;
  } else {
    const { data, error } = await safeRpc(sb, "charge_job_credits", { p_job_id: jobId });
    if (error || data !== true) {
      logEvent("error", "credit_charge_failed", { jobId, userId: job.user_id, message: String(error ?? "insufficient credits") });
      return false;
    }
    return true;
  }
}

async function refundJobCredits(sb: ReturnType<typeof createClient>, jobId: string) {
  const { error } = await safeRpc(sb, "refund_job_credits", { p_job_id: jobId });
  if (error) logEvent("error", "credit_refund_failed", { jobId, message: String(error) });
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

/**
 * Several Runware/OpenAI models only accept an exact set of width×height
 * pairs and reject anything else with "Unsupported use of width/height
 * parameters" — a hard failure with no generation attempted. Snap whatever
 * the client requested to the closest supported aspect ratio per model so
 * the request is never rejected outright.
 */
const SUPPORTED_DIMENSIONS: Record<string, [number, number][]> = {
  // Nano Banana 2 (image:nano.2)
  "google:4@3": [
    [1024, 1024], [2048, 2048],
    [1264, 848], [2528, 1696], [848, 1264], [1696, 2528],
    [1200, 896], [2400, 1792], [896, 1200], [1792, 2400],
    [928, 1152], [1856, 2304], [1152, 928], [2304, 1856],
    [768, 1376], [1536, 2752], [3072, 5504], [1376, 768], [2752, 1536], [5504, 3072],
    [1584, 672], [3168, 1344],
  ],
  // Nano Pro (image:nano-pro)
  "google:4@2": [
    [1024, 1024], [2048, 2048], [4096, 4096],
    [1264, 848], [2528, 1696], [5096, 3392], [5056, 3392],
    [848, 1264], [1696, 2528], [3392, 5096], [3392, 5056],
    [1200, 896], [2400, 1792], [4800, 3584],
    [896, 1200], [1792, 2400], [3584, 4800],
    [928, 1152], [1856, 2304], [3712, 4608],
    [1152, 928], [2304, 1856], [4608, 3712],
    [768, 1376], [1536, 2752], [3072, 5504],
    [1376, 768], [2752, 1536], [5504, 3072],
    [1548, 672], [1584, 672], [3168, 1344], [6336, 2688],
  ],
  // GPT Image 2 — backs image:fruit-v2
  "openai:gpt-image@2": [
    [1024, 1024], [2048, 2048],
    [1248, 832], [2496, 1664], [832, 1248], [1664, 2496],
    [1168, 880], [2336, 1760], [880, 1168], [1760, 2336],
    [768, 1360], [1536, 2720], [1360, 768], [2720, 1536],
    [1552, 656], [3104, 1312],
  ],
  // GPT Image 1.5 (image:openai)
  "openai:4@1": [
    [1024, 1024], [1536, 1024], [1024, 1536],
  ],
};

function snapToSupportedDimensions(
  width: number,
  height: number,
  airTag: string,
): { width: number; height: number } {
  const supported = SUPPORTED_DIMENSIONS[airTag];
  if (!supported?.length) return { width, height };

  // Preserve an exact provider-supported size. Several aspect-ratio families
  // contain 1K, 2K and 4K variants with identical ratios; ratio-only matching
  // would otherwise select the first (smallest) variant and silently downsize.
  const exact = supported.find(([candidateWidth, candidateHeight]) =>
    candidateWidth === width && candidateHeight === height
  );
  if (exact) return { width: exact[0], height: exact[1] };

  const targetRatio = width / height;
  let best = supported[0];
  let bestDiff = Infinity;

  for (const pair of supported) {
    const diff = Math.abs(pair[0] / pair[1] - targetRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = pair;
    }
  }

  return { width: best[0], height: best[1] };
}

const MAX_REFERENCE_IMAGES: Record<string, number> = {
  "openai:gpt-image@2": 4,
};

function clampReferenceImages(refs: string[], airTag: string): string[] {
  const max = MAX_REFERENCE_IMAGES[airTag];
  return typeof max === "number" ? refs.slice(0, max) : refs;
}

/**
 * Mirrors safeRunwarePositivePrompt from runware-video. Runware enforces
 * model-specific length bounds (e.g. GPT Image 2 requires 2-2500 chars) and
 * rejects anything outside that range with "Invalid value for
 * 'positivePrompt' parameter" — a hard failure with no generation attempted.
 */
function safeImagePositivePrompt(prompt: unknown, max = 2000): string {
  const safe = String(prompt || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  if (safe.length < 2) {
    throw new Error("Image prompt is empty or too short");
  }

  return safe;
}

async function completeRunwareImageJob(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  toolKey: string,
  sourceUrl: string,
  providerOutput: any,
  context: Record<string, unknown> = {},
): Promise<void> {
  await safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 95 });
  const storedUrl = await persistImageResult(sb, jobId, sourceUrl);
  await safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 98 });

  const charged = await chargeJobCredits(sb, jobId);
  if (!charged) {
    await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: "INSUFFICIENT_CREDITS" });
    return;
  }

  const { error } = await safeRpc(sb, "finish_job_success", {
    p_id: jobId,
    p_url: storedUrl,
    p_output: providerOutput,
  });
  if (error) await refundJobCredits(sb, jobId);
  logEvent("info", "job_succeeded", {
    jobId,
    toolKey,
    ...context,
    finishError: error ? String(error) : null,
  });
}

async function recoverExistingRunwareImageJob(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  toolKey: string,
  providerId: string,
): Promise<void> {
  const startedAt = Date.now();
  const recoveryWindowMs = 2 * 60 * 1000;

  logEvent("info", "provider_recovery_started", { jobId, toolKey, providerId });

  for (let attempt = 0; Date.now() - startedAt < recoveryWindowMs; attempt += 1) {
    try {
      const details = await getRunwareTaskDetails(providerId);
      const detailEntry = matchingTaskEntries(details.json, providerId)[0];
      const detailResponse = detailEntry?.response ?? detailEntry ?? null;
      const recoveredUrl = extractImageUrl(detailResponse);
      if (recoveredUrl) {
        await completeRunwareImageJob(sb, jobId, toolKey, recoveredUrl, detailResponse, {
          recoveredAfterReconnect: true,
          attempt,
        });
        return;
      }
    } catch (error) {
      logEvent("warn", "provider_recovery_details_failed", {
        jobId,
        providerId,
        attempt,
        message: String((error as any)?.message ?? error),
      });
    }

    try {
      const pollResult = await pollRunwareResponse(providerId);
      const recoveredUrl = extractImageUrl(pollResult.json);
      if (recoveredUrl) {
        await completeRunwareImageJob(sb, jobId, toolKey, recoveredUrl, pollResult.json, {
          recoveredAfterReconnect: true,
          attempt,
        });
        return;
      }

      const runwareError = getRunwareError(pollResult.json);
      if (runwareError && runwareError.code !== "failedTaskTimeout" && runwareError.code !== "taskNotFound") {
        const message = `${runwareError.code ? `${runwareError.code}: ` : ""}${runwareError.message}`;
        await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: message });
        return;
      }
    } catch (error) {
      logEvent("warn", "provider_recovery_poll_failed", {
        jobId,
        providerId,
        attempt,
        message: String((error as any)?.message ?? error),
      });
    }

    await safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 98 });
    await sleep(2500);
  }

  // Keep the row recoverable. A later page open can ask Runware again instead
  // of incorrectly failing an image that may already exist at the provider.
  logEvent("warn", "provider_recovery_pending", { jobId, toolKey, providerId });
}

async function processRunwareImageJob(body: any): Promise<void> {
  const {
    jobId,
    airTag,
    prompt,
    referenceImages = [],
    settings        = {},
    recoverExistingProvider = false,
  } = body;

  const sb = makeSb();

  // 5% — job accepted, starting work
  void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 5 });

  const fruitModel = settings?.provider_hint?.settings?.fruitModel ?? null;
  const isFruitModel =
    settings?.tool_key === "image:fruit-v2" ||
    fruitModel === "zyvo-v2";
  const openAiSettings = settings?.provider_hint?.settings ?? {};
  const openAiQuality =
    settings?.quality ||
    openAiSettings?.quality ||
    "low";
  const requestedWidth = Number(settings?.width ?? 1024);
  const requestedHeight = Number(settings?.height ?? 1024);
  const { width: safeWidth, height: safeHeight } = snapToSupportedDimensions(
    requestedWidth,
    requestedHeight,
    airTag,
  );
  const safePrompt = safeImagePositivePrompt(prompt);
  const existingProviderId = String(settings?.provider_job_id || "");

  if (recoverExistingProvider && existingProviderId) {
    await recoverExistingRunwareImageJob(sb, jobId, airTag, existingProviderId);
    return;
  }

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
      logEvent("error", "ref_not_https", { jobId, url: url.slice(0, 200) });
      continue;
    }
    try {
      const rwUrl = await uploadImageToRunware(url);
      runwareRefs.push(rwUrl);
    } catch (e) {
      logEvent("error", "ref_upload_failed", { jobId, url: url.slice(0, 200), message: String((e as any)?.message ?? e) });
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
    logEvent("error", "all_refs_failed", { jobId, toolKey: airTag, refCount: referenceImages.length });
    await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: message });
    return;
  }

  // Use one deterministic provider task per database job. Large 4K images can
  // take longer than the HTTP timeout in sync mode; retrying that timed-out
  // creation POST can make Runware render the same task more than once.
  const providerTaskId = String(settings?.provider_job_id || jobId);
  const task: any = {
    taskType:       "imageInference",
    taskUUID:       providerTaskId,
    model:          airTag,
    positivePrompt: safePrompt,
    width:          safeWidth,
    height:         safeHeight,
    numberResults:  1,
    includeCost:    true,
    deliveryMethod: "async",
    outputType:     isFruitModel ? ["URL"] : "URL",
    ...(isFruitModel
      ? {
          skipResponse: settings?.skipResponse ?? openAiSettings?.skipResponse ?? true,
          outputQuality: settings?.outputQuality ?? openAiSettings?.outputQuality ?? 85,
        }
      : { outputFormat: "PNG" }),
  };

  // Some models cap how many reference images they'll accept (GPT Image 2
  // allows only 1) — clamp before building the payload so Runware never
  // rejects the whole request over an "Invalid number of elements" error.
  const cappedRefs = clampReferenceImages(runwareRefs, airTag);
  if (cappedRefs.length < runwareRefs.length) {
    logEvent("warn", "refs_capped", { jobId, toolKey: airTag, max: cappedRefs.length, provided: runwareRefs.length });
  }

  // Attach uploaded reference images via the shared helper.
  // buildReferenceInputs returns undefined when refs is empty → task.inputs is omitted.
  const refInputs = buildReferenceInputs(cappedRefs);
  if (refInputs) task.inputs = refInputs;

  // Keep our existing quality setting for OpenAI models (quality: "low" for fruit-v2)
  if (airTag.startsWith("openai:")) {
    task.providerSettings = {
      openai: { quality: isFruitModel ? openAiQuality : (openAiSettings?.quality ?? "high") },
    };
  }

  if (isFruitModel && referenceImages.length > 0 && !task.inputs?.referenceImages?.length) {
    logEvent("error", "fruit_refs_lost", { jobId, toolKey: airTag, originalCount: referenceImages.length, uploadedCount: runwareRefs.length });
    await safeRpc(sb, "finish_job_failed", {
      p_id: jobId,
      p_error: "Fruit references lost before Runware payload",
    });
    return;
  }

  /* ── Submit task to Runware ── */
  // running -> processing atomically reserves provider submission. Duplicate
  // Edge invocations cannot submit again because only one can transition the
  // row from running.
  const providerSettings = {
    ...settings,
    provider_job_id: providerTaskId,
    provider_delivery_method: "async",
  };
  const { data: reservation, error: reservationError } = await sb
    .from("jobs")
    .update({ status: "processing", settings: providerSettings })
    .eq("id", jobId)
    .eq("status", "running")
    .select("id")
    .maybeSingle();

  if (reservationError) {
    throw new Error(`Could not reserve provider submission: ${reservationError.message}`);
  }
  if (!reservation) {
    logEvent("warn", "duplicate_submission_suppressed", {
      jobId,
      toolKey: airTag,
      providerId: providerTaskId,
    });
    return;
  }

  // Creation is deliberately single-attempt. If its response is lost after
  // acceptance, poll the reserved task ID instead of submitting another paid
  // generation.
  let createResult: { ok: boolean; status: number; text: string; json: any } | null = null;
  try {
    createResult = await safeFetch(TASKS_URL, {
      method:  "POST",
      headers: { Authorization: `Bearer ${RUNWARE_KEY}`, "Content-Type": "application/json" },
      body:    JSON.stringify([task]),
    });
  } catch (error) {
    logEvent("warn", "task_submit_response_lost", {
      jobId,
      toolKey: airTag,
      providerId: providerTaskId,
      message: String((error as any)?.message ?? error),
    });
  }

  if (createResult && (!createResult.ok || createResult.json?.errors?.length)) {
    const message =
      createResult.json?.errors?.[0]?.message ||
      `Runware rejected task (${createResult.status}): ${createResult.text.slice(0, 200)}`;
    logEvent("error", "task_creation_failed", { jobId, toolKey: airTag, status: createResult.status, message });
    await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: message });
    return;
  }

  // Prefer Runware's echoed taskUUID. A lost submit response falls back to the
  // reserved deterministic ID and enters the same polling/recovery path.
  const providerId =
    createResult?.json?.data?.[0]?.taskUUID ??
    createResult?.json?.data?.[0]?.id ??
    providerTaskId;

  logEvent("info", "task_accepted", { jobId, toolKey: airTag, providerId });

  // 15% — task accepted by Runware
  void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 15 });

  /* ── Instant success (sync models return URL in create response) ── */
  const immediate = extractImageUrl(createResult?.json);
  if (immediate) {
    await completeRunwareImageJob(sb, jobId, airTag, immediate, createResult?.json, {
      instant: true,
    });
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

    let pollResult: { ok: boolean; status: number; text: string; json: any };
    try {
      pollResult = await pollRunwareResponse(providerId);
    } catch (e) {
      logEvent("warn", "poll_exception", { jobId, poll: i, message: String(e) });
      continue;
    }

    const url = extractImageUrl(pollResult.json);
    const pollStatus = providerStatus(pollResult.json, providerId);
    const reportedProgress = providerProgress(pollResult.json, providerId);
    const runwareError = getRunwareError(pollResult.json);

    const syntheticProgress = 15 + Math.round((elapsed / MAX_RUNTIME_MS) * 75);
    const progress = Math.min(
      90,
      reportedProgress === null
        ? syntheticProgress
        : 15 + Math.round(reportedProgress * 0.75),
    );
    await safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: progress });

    if (url) {
      await completeRunwareImageJob(sb, jobId, airTag, url, pollResult.json, {
        instant: false,
        poll: i,
      });
      return;
    }

    // Log full response shape when there's no URL (helps debug GPT Image 2 format)
    if (!pollResult.json) {
      logEvent("warn", "poll_no_json", { jobId, poll: i, raw: pollResult.text.slice(0, 300) });
      continue;
    }

    const errorCode =
      runwareError?.code ??
      pollResult.json?.errorCode ??
      pollResult.json?.data?.[0]?.errorCode;

    if (errorCode === "failedTaskTimeout") {
      continue;
    }
    // A submit response can be lost just before Runware registers the async
    // task. Give that reserved task ID a short recovery window rather than
    // failing the database job on the first taskNotFound poll.
    if (errorCode === "taskNotFound" && elapsed < 30_000) {
      continue;
    }

    if (runwareError) {
      const message = `${runwareError.code ? `${runwareError.code}: ` : ""}${runwareError.message}`;
      logEvent("error", "provider_failed", { jobId, toolKey: airTag, poll: i, message });
      await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: message });
      return;
    }

    // Runware sometimes emits transient "failed" before the result is ready
    if (pollStatus === "error") {
      continue;
    }
  }

  /* ── Final timeout ── */
  try {
    const details = await getRunwareTaskDetails(providerId);
    const detailEntry = matchingTaskEntries(details.json, providerId)[0];
    const detailResponse = detailEntry?.response ?? null;
    const recoveredUrl = extractImageUrl(detailResponse);
    if (recoveredUrl) {
      await completeRunwareImageJob(sb, jobId, airTag, recoveredUrl, detailResponse, {
        instant: false,
        recoveredFromTaskDetails: true,
      });
      return;
    }
  } catch (error) {
    logEvent("warn", "task_details_recovery_failed", {
      jobId,
      providerId,
      message: String((error as any)?.message ?? error),
    });
  }

  logEvent("error", "job_failed", { jobId, toolKey: airTag, reason: "timeout", elapsedMs: Date.now() - start });
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

  if (!SERVICE_KEY || req.headers.get("x-job-worker-key") !== SERVICE_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized worker handoff" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let jobId: string | null = null;

  try {
    const body = await req.json();
    jobId = body?.jobId ?? null;

    if (!jobId || !body?.airTag || !body?.prompt) {
      logEvent("warn", "request_rejected_missing_fields", { jobId, hasAirTag: !!body?.airTag, hasPrompt: !!body?.prompt });
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: jobId, airTag, prompt" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Start background processing — does NOT block the HTTP response
    EdgeRuntime.waitUntil(
      processRunwareImageJob(body).catch(async (err) => {
        const message = err instanceof Error ? err.message : String(err);
        logEvent("error", "background_process_crashed", {
          jobId,
          message,
          stack: err instanceof Error ? err.stack : undefined,
        });
        // processRunwareImageJob already calls finish_job_failed for known errors;
        // this catch is a final safety net for unexpected throws
        try {
          const sb = makeSb();
          await safeRpc(sb, "finish_job_failed", {
            p_id:    jobId!,
            p_error: `Unexpected error: ${message}`,
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
    logEvent("error", "handler_error", { jobId, message: String((e as any)?.message ?? e) });
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to accept job request." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
