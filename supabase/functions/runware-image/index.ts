// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseOverload, recordOverload, recordSuccess } from "../_shared/modelOverload.ts";
import { logEvent as persistLog, type LogLevel } from "../_shared/systemLog.ts";
import {
  ProviderReferenceError,
  assertProviderAccessibleImageUrl,
} from "../_shared/referenceImages.ts";
import { snapToSupportedDimensions, clampReferenceImageCount } from "../_shared/imageDimensionPolicy.ts";

function logEvent(level: LogLevel, event: string, ctx: Record<string, unknown> = {}) {
  const safeCtx = JSON.parse(JSON.stringify(ctx, (_key, value) =>
    typeof value === "string" ? value.replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]") : value
  ));
  const icon = level === "error" ? "🔴" : level === "warn" ? "🟠" : "🟢";
  const line = `${icon} [runware-image] ${event}`;
  const detail = JSON.stringify({ ts: new Date().toISOString(), ...safeCtx });

  if (level === "error") console.error(line, detail);
  else if (level === "warn") console.warn(line, detail);
  else console.log(line, detail);

  void persistLog("runware-image", level, event, safeCtx);
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

// The model answered "overloaded": this job WAITS (queued, uncharged, a fresh task id for its next
// try), the model's breaker is opened for everyone, and the job comes back by itself when the wait is
// over (generation-sweeper is the fallback). The user reads "High demand, continuing in a moment".
async function waitForOverloadedModel(sb: ReturnType<typeof createClient>, jobId: string, airTag: string, retryAfterS: number, where: string, httpStatus: number | null) {
  const breaker = await recordOverload(sb, airTag, retryAfterS, `${where}: serviceOverloaded, retryAfter ${retryAfterS}`);
  const { data: row } = await sb.from("jobs").select("settings").eq("id", jobId).maybeSingle();
  const settings: any = (row as any)?.settings ?? {};
  const since = settings?.overload?.since ?? new Date().toISOString();
  const { error } = await sb.from("jobs").update({
    status: "queued", progress: 0, retry_after: breaker.until, provider_task_id: null, submission_state: "pending", lease_expires_at: null,
    settings: { ...settings, provider_job_id: crypto.randomUUID(), waiting: "high_demand", overload: { since, waits: Number(settings?.overload?.waits ?? 0) + 1, retryAfterS } },
  }).eq("id", jobId).in("status", ["running", "processing"]);
  logEvent("warn", "model_overloaded_job_waits", { jobId, toolKey: airTag, where, httpStatus, retryAfterS, until: breaker.until, requeueError: error?.message ?? null });
  const waitMs = (breaker.until ? Date.parse(breaker.until) - Date.now() : retryAfterS * 1000) + 1500 + Math.round(Math.random() * 3000);
  if (waitMs > 110_000) return; // longer than this worker may stay: the sweeper dispatches it
  await sleep(Math.max(0, waitMs));
  await fetch(`${SUPABASE_URL}/functions/v1/job-worker`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) }).then((r) => r.body?.cancel()).catch(() => {});
}

function makeSb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// 2026-09-22 error-taxonomy fix — real incident: a systemic provider-
// adapter bug (unsupported parameter, broken reference transport) affecting
// every Kling O3 job in a run was flattened to the SAME generic
// PROVIDER_GENERATION_FAILED as an ordinary one-off provider hiccup, making
// it look like 13 independent image failures instead of one root cause. The
// DB/logs now keep the real, specific code; only the user-facing message
// stays friendly.
function stableImageFailure(raw: unknown): { code: string; message: string } {
  const value = String(raw ?? "");
  if (value === "REFERENCE_IMAGE_NOT_ACCESSIBLE" || value === "REFERENCE_NOT_ACCESSIBLE" || value === "REFERENCE_IMAGE_EXPIRED") {
    return {
      code: value === "REFERENCE_IMAGE_NOT_ACCESSIBLE" ? "REFERENCE_NOT_ACCESSIBLE" : value,
      message: value === "REFERENCE_IMAGE_EXPIRED"
        ? "This reference image is no longer available. Please select it again."
        : "This reference image isn't accessible. Please select it again.",
    };
  }
  if (value === "INSUFFICIENT_CREDITS") return { code: value, message: "You don't have enough credits for this generation." };
  // A required reference could not be prepared for the provider (e.g. its
  // re-upload/transport step failed) — distinct from the image simply being
  // inaccessible: the SOURCE url was fine, the TRANSPORT step to get it into
  // the provider's expected shape failed.
  if (value === "REFERENCE_TRANSPORT_FAILED" || /imageupload failed|required references? lost/i.test(value)) {
    return { code: "REFERENCE_TRANSPORT_FAILED", message: "This reference image couldn't be prepared for the provider. Please try again." };
  }
  // Runware rejects task CREATION (never reaches inference, never billed) for
  // a request parameter the selected model doesn't support — a configuration
  // bug, not a content/creative problem.
  if (/unsupported use of ['"]?\w+['"]? parameter|not supported for the selected model/i.test(value)) {
    return { code: "PROVIDER_UNSUPPORTED_PARAMETER", message: "This image couldn't be generated due to a provider configuration issue. Please try again." };
  }
  if (/safety|moderation|content.?policy|invalidprovidercontent/i.test(value)) {
    return {
      code: "PROVIDER_SAFETY_REJECTION",
      message: "The provider couldn't generate this request because of its safety rules. Try changing the prompt or image.",
    };
  }
  // Runware rejected task creation for some OTHER reason (HTTP 400/422, a
  // malformed request) — still a pre-inference rejection (safe to retry,
  // never billed), just not one of the specific configuration bugs above.
  if (/^runware rejected task/i.test(value)) {
    return { code: "PROVIDER_TASK_REJECTED", message: "The provider rejected this request. Please try again." };
  }
  return { code: "PROVIDER_GENERATION_FAILED", message: "The provider couldn't complete this generation. Please try again." };
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
    let safeArgs = args;
    if (name === "finish_job_failed" && args.p_id) {
      const failure = stableImageFailure(args.p_error);
      name = "fail_and_refund_generation_job";
      safeArgs = {
        p_job_id: args.p_id,
        p_error_code: failure.code,
        p_error: failure.message,
        p_provider_task_id: args.p_provider_task_id ?? null,
      };
    }
    const { data, error } = await sb.rpc(name, safeArgs);
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
      sourceHost: (() => { try { return new URL(publicUrl).host; } catch { return "invalid"; } })(),
      status: result.status,
      body: result.text.slice(0, 500),
    });
    throw new Error(`imageUpload failed (${result.status}): ${result.text.slice(0, 200)}`);
  }
  return result.json.data[0].imageURL;
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

// Dimension snapping and reference-count clamping now live in the shared,
// cross-function policy module (_shared/imageDimensionPolicy.ts) — see that
// file's own header comment for why (2026-09-14 Qwen 2720x1536 incident:
// the old local-only table here never covered Qwen/Kling/Klein9B/Seedream
// at all, so nothing caught an invalid Long Form dimension before it hit
// Runware). Byte-identical data/behavior for the four models this file
// already validated (Nano Banana 2, Nano Pro, GPT Image 2, GPT Image 1.5) —
// snapToSupportedDimensions/clampReferenceImageCount are imported above.

// Kling IMAGE O3 — backs the V3 canonical character_reference_sheet
// renderer (2026-09-13, image:kling.o3 in src/lib/providers.ts).
const KLING_O3_AIR = "klingai:kling-image@o3";

// 2026-09-22 "fix the provider adapter, not the topic" pass — real Atlantis
// incident, TWO separate confirmed-live bugs from treating every model as if
// it had the SAME request shape as the models this adapter was originally
// built for:
//   1. Every reference image, for every model, was unconditionally routed
//      through uploadImageToRunware (an `imageUpload` task that re-hosts the
//      image on Runware's own CDN before use). For Kling O3 this call itself
//      was rejected by Runware (invalidImage, HTTP 400) — before inference
//      ever started — even though Kling O3's own inputs.referenceImages
//      accepts an already-public HTTPS URL directly, no re-upload needed.
//   2. `negativePrompt` was attached to EVERY task whenever the caller had
//      one, with no per-model check — Runware rejects task CREATION outright
//      for Kling O3 with "Unsupported use of 'negativePrompt' parameter."
// Both are model-CAPABILITY facts, not project/topic-specific — this table
// is the one place either fact is asserted, and every other model's already-
// working request shape (upload-then-reference, negativePrompt attached)
// stays completely untouched via the default below.
type ImageModelCapabilities = {
  supportsNegativePrompt: boolean;
  referenceInputMode: "direct" | "upload";
  // When set, the folded "AVOID: …" clause (models without negativePrompt) is
  // always kept whole: the scene prompt is trimmed first so prompt + clause fit
  // this model's positivePrompt limit.
  maxPromptChars?: number;
};
const DEFAULT_IMAGE_MODEL_CAPABILITIES: ImageModelCapabilities = {
  supportsNegativePrompt: true,
  referenceInputMode: "upload",
};
// GPT Image 2 (2026-10-01): Runware rejects any negativePrompt for this
// architecture ("unsupportedArchitectureNegativePrompt … gpt_image_2"), which
// failed every image:fruit-v2 job since 22 Sep. Its exclusions ("text,
// watermark, logo, …") move into the positive prompt as an AVOID clause; its
// prompt limit is 2,500 characters. References keep the upload path.
const GPT_IMAGE_2_AIR = "openai:gpt-image@2";
const IMAGE_MODEL_CAPABILITIES: Record<string, ImageModelCapabilities> = {
  [KLING_O3_AIR]: { supportsNegativePrompt: false, referenceInputMode: "direct" },
  [GPT_IMAGE_2_AIR]: { supportsNegativePrompt: false, referenceInputMode: "upload", maxPromptChars: 2500 },
};
function imageModelCapabilities(airTag: string): ImageModelCapabilities {
  return IMAGE_MODEL_CAPABILITIES[airTag] ?? DEFAULT_IMAGE_MODEL_CAPABILITIES;
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

// Negative prompt is optional (unlike positive) — callers that don't set one
// (or the default DEFAULT_NEGATIVE_IMAGE from createImageJobSimple) still get
// a sane, trimmed string; an empty result just omits the field entirely below
// rather than sending Runware a blank negativePrompt.
function safeImageNegativePrompt(negative: unknown, max = 1000): string {
  return String(negative || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function completeRunwareImageJob(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  toolKey: string,
  sourceUrl: string,
  providerOutput: any,
  providerTaskId: string | null,
  context: Record<string, unknown> = {},
): Promise<void> {
  await safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 95 });
  const storedUrl = await persistImageResult(sb, jobId, sourceUrl);
  await safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 98 });

  const { data: completed, error } = await safeRpc(sb, "complete_generation_job", {
    p_job_id: jobId,
    p_url: storedUrl,
    p_output: providerOutput,
    p_provider_task_id: providerTaskId,
  });
  if (completed !== true) {
    // The only way a live job is refused here is a charge that failed (no credits left):
    // the job is ended with plain words instead of hanging at 98 %.
    const { data: still } = await sb.from("jobs").select("status").eq("id", jobId).maybeSingle();
    if (still && ["running", "processing"].includes(String(still.status))) {
      await safeRpc(sb, "fail_and_refund_generation_job", { p_job_id: jobId, p_error_code: "INSUFFICIENT_CREDITS", p_error: "You don't have enough credits for this. Add credits and try again.", p_provider_task_id: null });
    }
  }
  if (completed === true) {
    // A picture came back: the model's breaker (if it was open) lets one more request through at a time.
    await recordSuccess(sb, toolKey).catch(() => {});
    const { data: completedJob } = await sb.from("jobs").select("user_id").eq("id", jobId).single();
    if (completedJob?.user_id) {
      const { data: profile } = await sb.from("profiles").select("plan_code").eq("id", completedJob.user_id).single();
      if (String(profile?.plan_code ?? "free").toLowerCase() === "free") {
        const { error: usageError } = await sb.from("image_generations").insert({ user_id: completedJob.user_id });
        if (usageError) logEvent("error", "free_usage_log_failed", { jobId, userId: completedJob.user_id, message: usageError.message });
      }
    }
  }
  logEvent("info", "job_succeeded", {
    jobId,
    toolKey,
    ...context,
    accepted: completed === true,
    finishError: error ? String(error) : null,
  });
}

async function recoverExistingRunwareImageJob(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  toolKey: string,
  providerId: string,
  workerId: string,
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
        await completeRunwareImageJob(sb, jobId, toolKey, recoveredUrl, detailResponse, providerId, {
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
        await completeRunwareImageJob(sb, jobId, toolKey, recoveredUrl, pollResult.json, providerId, {
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

    await safeRpc(sb, "heartbeat_generation_job", { p_job_id: jobId, p_worker_id: workerId, p_lease_seconds: 180 });
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
    negative,
    referenceImages = [],
    settings        = {},
    recoverExistingProvider = false,
    workerId,
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
  const safeNegative = safeImageNegativePrompt(negative);
  const capabilities = imageModelCapabilities(airTag);
  const existingProviderId = String(settings?.provider_job_id || "");

  if (recoverExistingProvider && existingProviderId) {
    await recoverExistingRunwareImageJob(sb, jobId, airTag, existingProviderId, String(workerId));
    return;
  }

  /* ── Reference images: direct (already-accessible URL, no re-upload) vs
     upload (Runware's imageUpload re-hosting step) per model capability ── */
  console.log("[runware-image] received referenceImages", {
    jobId,
    count:   referenceImages.length,
    referenceInputMode: capabilities.referenceInputMode,
  });

  const runwareRefs: string[] = [];
  try {
    referenceImages.forEach((url: string) => assertProviderAccessibleImageUrl(url));
  } catch (e) {
    const code = e instanceof ProviderReferenceError ? e.code : "REFERENCE_NOT_ACCESSIBLE";
    logEvent("error", "reference_validation_rejected", { jobId, code });
    await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: code });
    return;
  }
  for (const url of referenceImages) {
    if (typeof url !== "string" || !url.trim()) {
      console.warn("[runware-image] ref skipped — not a string:", String(url).slice(0, 80));
      continue;
    }
    if (!url.startsWith("https://")) {
      logEvent("error", "ref_not_https", { jobId });
      continue;
    }
    if (capabilities.referenceInputMode === "direct") {
      // Model's inputs.referenceImages accepts an already-public HTTPS URL
      // directly — the imageUpload re-hosting step below is not just
      // unnecessary here, it's the exact call that was failing in
      // production (Runware's imageUpload endpoint rejected these images
      // with invalidImage before inference ever started).
      runwareRefs.push(url);
      continue;
    }
    try {
      const rwUrl = await uploadImageToRunware(url);
      runwareRefs.push(rwUrl);
    } catch (e) {
      logEvent("error", "ref_upload_failed", { jobId, message: String((e as any)?.message ?? e) });
    }
  }

  console.log("[runware-image] runwareRefs ready", {
    jobId,
    uploaded: runwareRefs.length,
    total:    referenceImages.length,
  });

  // 10% — refs uploaded
  void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 10 });

  /* ── Build Runware task ── */
  if (referenceImages.length !== runwareRefs.length) {
    logEvent("error", "required_references_lost", {
      jobId, toolKey: airTag, expected: referenceImages.length, uploaded: runwareRefs.length,
    });
    // The URL itself already passed assertProviderAccessibleImageUrl above —
    // reaching here means the TRANSPORT step (imageUpload re-hosting, for
    // models still in "upload" mode) failed, not that the source image is
    // inaccessible. Distinct stable code so this never looks like a bad
    // reference when it was actually a provider-transport failure.
    await safeRpc(sb, "finish_job_failed", { p_id: jobId, p_error: "REFERENCE_TRANSPORT_FAILED" });
    return;
  }

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
  // A model with no negativePrompt parameter must not simply lose those
  // exclusions (anti-text/style/reference-copying rules matter for scene
  // quality) — fold them into the positive prompt as an explicit AVOID
  // clause instead of dropping them.
  const avoidClause = `\nAVOID: ${safeNegative}`;
  const effectivePositivePrompt = safeNegative && !capabilities.supportsNegativePrompt
    ? (capabilities.maxPromptChars
      ? `${safePrompt.slice(0, Math.max(2, capabilities.maxPromptChars - avoidClause.length))}${avoidClause}`
      : safeImagePositivePrompt(`${safePrompt}${avoidClause}`))
    : safePrompt;
  const task: any = {
    taskType:       "imageInference",
    taskUUID:       providerTaskId,
    model:          airTag,
    positivePrompt: effectivePositivePrompt,
    ...(safeNegative && capabilities.supportsNegativePrompt ? { negativePrompt: safeNegative } : {}),
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
      // Kling IMAGE O3 (2026-09-13): the real, Runware-verified working
      // request for this model used JPG output at quality 95 — kept as its
      // own branch (not a global default) so every other model's proven PNG
      // behavior is untouched.
      : airTag === KLING_O3_AIR
      ? { outputFormat: "JPG", outputQuality: 95 }
      : { outputFormat: "PNG" }),
  };

  // Some models cap how many reference images they'll accept (GPT Image 2
  // allows only 1) — clamp before building the payload so Runware never
  // rejects the whole request over an "Invalid number of elements" error.
  const cappedRefs = clampReferenceImageCount(runwareRefs, airTag);
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
  const { data: reservation, error: reservationError } = await safeRpc(sb, "reserve_provider_submission", {
    p_job_id: jobId,
    p_worker_id: String(workerId),
    p_provider_task_id: providerTaskId,
  });

  if (reservationError) {
    throw new Error(`Could not reserve provider submission: ${String((reservationError as any)?.message ?? reservationError)}`);
  }
  if (reservation !== true) {
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
  //
  // 2026-10-08: an answer that says the model is OVERLOADED ("serviceOverloaded", 429 / 503, with a
  // retryAfter) is not a failure and is not retried here: the job goes back to the queue until the
  // provider's own retryAfter (+ jitter) is over, and the model's circuit breaker pauses every other
  // request to it meanwhile (_shared/modelOverload.ts). A lost response is still never resubmitted.
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
    const overload = parseOverload(createResult.status, createResult.json ?? createResult.text);
    if (overload.overloaded) {
      await waitForOverloadedModel(sb, jobId, airTag, overload.retryAfterS, "create", createResult.status);
      return;
    }
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

  await safeRpc(sb, "record_provider_submission", {
    p_job_id: jobId,
    p_worker_id: String(workerId),
    p_provider_task_id: String(providerId),
  });

  logEvent("info", "task_accepted", { jobId, toolKey: airTag, providerId });

  // 15% — task accepted by Runware
  void safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: 15 });

  /* ── Instant success (sync models return URL in create response) ── */
  const immediate = extractImageUrl(createResult?.json);
  if (immediate) {
    await completeRunwareImageJob(sb, jobId, airTag, immediate, createResult?.json, String(providerId), {
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
    if (i % 5 === 0) await safeRpc(sb, "heartbeat_generation_job", {
      p_job_id: jobId, p_worker_id: String(workerId), p_lease_seconds: 180,
    });

    if (url) {
      await completeRunwareImageJob(sb, jobId, airTag, url, pollResult.json, String(providerId), {
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
    if (errorCode === "taskNotFound") {
      continue;
    }

    if (runwareError) {
      // The task was taken and then dropped for load: the same wait as an overload at creation.
      const overload = parseOverload(0, runwareError);
      if (overload.overloaded && /overload|high demand|temporarily unavailable|capacity/i.test(`${runwareError.code ?? ""} ${runwareError.message ?? ""}`)) {
        await waitForOverloadedModel(sb, jobId, airTag, overload.retryAfterS, "poll", null);
        return;
      }
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
      await completeRunwareImageJob(sb, jobId, airTag, recoveredUrl, detailResponse, String(providerId), {
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
  await safeRpc(sb, "mark_generation_reconciliation_required", {
    p_job_id: jobId,
    p_reason: "Runware image polling window expired; provider task must be reconciled",
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
          const { data: state } = await sb.from("jobs").select("submission_state").eq("id", jobId!).maybeSingle();
          if (state?.submission_state === "pending") {
            await safeRpc(sb, "finish_job_failed", { p_id: jobId!, p_error: `Unexpected error: ${message}` });
          } else {
            await safeRpc(sb, "mark_generation_reconciliation_required", {
              p_job_id: jobId!, p_reason: "Image worker crashed after provider submission became possible",
            });
          }
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
