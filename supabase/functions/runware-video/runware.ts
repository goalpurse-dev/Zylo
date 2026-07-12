// supabase/functions/runware-video/runware.ts
// Runware VIDEO helper (launch + poll)

type RunwareLaunchArgs = {
  subject: string;
  width?: number;
  height?: number;
  resolution?: string;
  durationSec: number;
  referenceImages?: string[] | null;
  airTag: string;
  withSound?: boolean;
  /** Our internal job id — purely for log correlation, never sent to Runware. */
  jobId?: string;
};

export type RunwareLaunchResult = { jobId: string };

export type RunwarePollResult =
  | { status: "queued" | "running" }
  | { status: "failed"; error?: string; code?: string }
  | { status: "succeeded"; url: string };

/* ================= LOGGING =================
   Structured, greppable lines for Supabase → Edge Functions → runware-video
   → Logs. Every line starts with an icon + [runware] + event name so a scroll
   through the log feed reads like a timeline instead of noise.
================================================= */

function rwLog(level: "info" | "warn" | "error", event: string, ctx: Record<string, unknown> = {}) {
  const icon = level === "error" ? "🔴" : level === "warn" ? "🟠" : "🔵";
  const line = `${icon} [runware] ${event}`;
  const detail = JSON.stringify({ ts: new Date().toISOString(), ...ctx });

  if (level === "error") console.error(line, detail);
  else if (level === "warn") console.warn(line, detail);
  else console.log(line, detail);
}

/* ================= ENV ================= */

const RW_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
if (!RW_KEY) throw new Error("RUNWARE_API_KEY not set");

const BASE =
  (Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "");

const TASKS_URL = `${BASE}/v1/air/tasks`;

function headers(): Headers {
  return new Headers({
    Authorization: `Bearer ${RW_KEY}`,
    "Content-Type": "application/json",
  });
}

async function postJson(body: unknown, jobId?: string) {
  let res: Response;

  try {
    res = await fetch(TASKS_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Network-level failure (DNS, timeout, connection reset) — this is
    // invisible in the old code because it just threw with no context.
    rwLog("error", "network_failure", {
      jobId,
      message: (e as Error)?.message ?? String(e),
      url: TASKS_URL,
    });
    throw e;
  }

  const text = await res.text();

  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    rwLog("error", "runware_http_error", {
      jobId,
      status: res.status,
      body: text.slice(0, 2000),
    });
  }

  return { res, text, json };
}

function pickVideoUrl(obj: any): string | null {
  const d0 = obj?.data?.[0] ?? obj?.data ?? obj ?? {};

  return (
    d0?.videoURL ||
    d0?.url ||
    d0?.result?.videoURL ||
    d0?.outputs?.[0]?.videoURL ||
    null
  );
}

/* ================= HELPERS ================= */

async function isUnder10MB(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD" });

    if (!res.ok) return false;

    const sizeHeader = res.headers.get("content-length");

    // Some CDN/storage URLs do not return content-length.
    // Do not drop the image if size is missing.
    if (!sizeHeader) return true;

    const size = Number(sizeHeader);

    return size > 0 && size <= 10 * 1024 * 1024;
  } catch {
    // Do not drop refs just because HEAD failed.
    return true;
  }
}

function safeRunwarePositivePrompt(positivePrompt: unknown, max = 1450): string {
  const safePositivePrompt = String(positivePrompt || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  if (safePositivePrompt.length < 2) {
    throw new Error("Video prompt is empty or too short");
  }

  return safePositivePrompt;
}

/* ================= LAUNCH ================= */

export async function launchRunwareVideo(
  args: RunwareLaunchArgs,
): Promise<RunwareLaunchResult> {
  const taskUUID = crypto.randomUUID();
  const rawRefs = (args.referenceImages ?? []).filter(Boolean).map(String);
  const safePositivePrompt = safeRunwarePositivePrompt(args.subject);

  if (args.airTag === "google:veo@3.1-lite") {
    const refs = rawRefs.slice(0, 2);

    const task: Record<string, unknown> = {
      taskType:       "videoInference",
      model:          "google:veo@3.1-lite",
      positivePrompt: safePositivePrompt,
      width:          args.width  ?? 1280,
      height:         args.height ?? 720,
      duration:       args.durationSec,
      numberResults:  1,
      includeCost:    true,
      providerSettings: {
        google: {
          generateAudio:    args.withSound ?? true,
          personGeneration: "allow_all",
        },
      },
      taskUUID,
    };

    if (refs.length > 0) {
      // frameImages must be plain URL strings, not { image, frame } objects
      task.inputs = { frameImages: refs };
    }

    rwLog("info", "launch_request", { jobId: args.jobId, model: "veo-3.1-lite", width: task.width, height: task.height, duration: task.duration, promptPreview: safePositivePrompt.slice(0, 140) });
    const { res, text, json } = await postJson([task], args.jobId);
    if (!res.ok) throw new Error(`Runware launch failed (${res.status}): ${text}`);
    const providerJobId = json?.data?.[0]?.taskUUID || json?.data?.[0]?.id || taskUUID;
    rwLog("info", "launch_success", { jobId: args.jobId, model: "veo-3.1-lite", providerJobId });
    return { jobId: String(providerJobId) };
  }

  if (args.airTag === "alibaba:wan@2.6-flash") {
    const task = {
      taskType: "videoInference",
      model: "alibaba:wan@2.6-flash",
      width: args.width ?? 1080,
      height: args.height ?? 1920,
      duration: args.durationSec,
      numberResults: 1,
      includeCost: true,
      positivePrompt: safePositivePrompt,
      inputs: {
        referenceImages: rawRefs.slice(0, 1),
      },
      taskUUID,
    };

    rwLog("info", "launch_request", { jobId: args.jobId, model: "wan-2.6-flash", width: task.width, height: task.height, duration: task.duration, promptPreview: safePositivePrompt.slice(0, 140) });
    const { res, text, json } = await postJson([task], args.jobId);
    if (!res.ok) throw new Error(`Runware launch failed (${res.status}): ${text}`);
    const providerJobId = json?.data?.[0]?.taskUUID || json?.data?.[0]?.id || taskUUID;
    rwLog("info", "launch_success", { jobId: args.jobId, model: "wan-2.6-flash", providerJobId });
    return { jobId: String(providerJobId) };
  }

  if (args.airTag === "google:3@3") {
    const task = {
      taskType: "videoInference",
      duration: args.durationSec,
      fps: 24,
      model: "google:3@3",
      outputFormat: "mp4",
      height: args.height ?? 1920,
      width: args.width ?? 1080,
      numberResults: 1,
      includeCost: true,
      outputQuality: 85,
      providerSettings: {
        google: {
          generateAudio: true,
          enhancePrompt: true,
        },
      },
      frameImages: rawRefs.slice(0, 1).map((url) => ({ inputImage: url })),
      positivePrompt: safePositivePrompt,
      taskUUID,
    };

    rwLog("info", "launch_request", { jobId: args.jobId, model: "google-3@3", width: task.width, height: task.height, duration: task.duration, promptPreview: safePositivePrompt.slice(0, 140) });
    const { res, text, json } = await postJson([task], args.jobId);
    if (!res.ok) throw new Error(`Runware launch failed (${res.status}): ${text}`);
    const providerJobId = json?.data?.[0]?.taskUUID || json?.data?.[0]?.id || taskUUID;
    rwLog("info", "launch_success", { jobId: args.jobId, model: "google-3@3", providerJobId });
    return { jobId: String(providerJobId) };
  }

  /* ── Seedance 2.0 Fast ── */
  if (args.airTag === "bytedance:seedance@2.0-fast") {
    const task: Record<string, unknown> = {
      taskType:      "videoInference",
      model:         "bytedance:seedance@2.0-fast",
      positivePrompt: safePositivePrompt,
      width:         args.width  ?? 496,
      height:        args.height ?? 864,
      duration:      args.durationSec,
      numberResults: 1,
      includeCost:   true,
      outputQuality: 95,
      settings: { audio: args.withSound ?? false },
      taskUUID,
    };

    const refs      = rawRefs.slice(0, 5); // max 5 reference images
    if (refs.length > 0) {
      task.inputs = { frameImages: refs };   // plain URL strings
    }

    rwLog("info", "launch_request", { jobId: args.jobId, model: "seedance-2.0-fast", width: task.width, height: task.height, duration: task.duration, promptPreview: safePositivePrompt.slice(0, 140) });
    const { res, text, json } = await postJson([task], args.jobId);
    if (!res.ok) throw new Error(`Runware Seedance 2.0 Fast launch failed (${res.status}): ${text}`);
    const providerJobId = json?.data?.[0]?.taskUUID || json?.data?.[0]?.id || taskUUID;
    rwLog("info", "launch_success", { jobId: args.jobId, model: "seedance-2.0-fast", providerJobId });
    return { jobId: String(providerJobId) };
  }

  /* ── Seedance 1.5 Pro ── */
  if (args.airTag === "bytedance:seedance@1.5-pro") {
    // Valid range: 4–12 seconds (Runware rejects anything outside this)
    const clampedDuration = Math.min(12, Math.max(4, Math.round(args.durationSec)));
    const task: Record<string, unknown> = {
      taskType:      "videoInference",
      fps:           24,
      model:         "bytedance:seedance@1.5-pro",
      outputFormat:  "mp4",
      height:        args.height ?? 864,
      width:         args.width  ?? 496,
      numberResults: 1,
      includeCost:   true,
      outputQuality: 85,
      providerSettings: {
        bytedance: { cameraFixed: false, audio: args.withSound ?? false },
      },
      positivePrompt: safePositivePrompt,
      taskUUID,
      duration: clampedDuration,
    };

    if (rawRefs.length > 0) {
      // Plain URL strings — same format confirmed working for Seedance models
      task.inputs = { frameImages: rawRefs.slice(0, 2) };
    }

    rwLog("info", "launch_request", { jobId: args.jobId, model: "seedance-1.5-pro", width: task.width, height: task.height, duration: task.duration, promptPreview: safePositivePrompt.slice(0, 140) });
    const { res, text, json } = await postJson([task], args.jobId);
    if (!res.ok) throw new Error(`Runware Seedance launch failed (${res.status}): ${text}`);
    const providerJobId = json?.data?.[0]?.taskUUID || json?.data?.[0]?.id || taskUUID;
    rwLog("info", "launch_success", { jobId: args.jobId, model: "seedance-1.5-pro", providerJobId });
    return { jobId: String(providerJobId) };
  }

  const task: Record<string, unknown> = {
    taskType: "videoInference",
    taskUUID,
    model: args.airTag,
    positivePrompt: safePositivePrompt,
    duration: args.durationSec,
    numberResults: 1,
    outputType: "URL",
    outputFormat: "mp4",
    outputQuality: 85,
    includeCost: true,

    // Prevents launch request from hanging until video is done.
    deliveryMethod: "async",
  };

  /* ================= MODEL FLAGS ================= */

  const isKlingPro = args.airTag === "klingai:kling-video@3-pro";
  const isKling = args.airTag.startsWith("klingai:");
  const isMiniMax = args.airTag.includes("minimax");

  /* ================= FILTER REFERENCE IMAGES ================= */

  const safeRefs: string[] = [];

  for (const url of rawRefs) {
    if (await isUnder10MB(url)) {
      safeRefs.push(url);
    } else {
      rwLog("warn", "ref_image_dropped", { jobId: args.jobId, reason: "over_10mb_or_unreachable", url });
    }
  }

  const hasInputs = safeRefs.length > 0;

  /* ================= REFERENCE INPUTS ================= */

  // Correct Runware format for image-to-video references.
  if (hasInputs) {
    task.inputs = {
      frameImages: safeRefs.slice(0, 1).map((url) => ({ image: url })),
    };
  } else if (rawRefs.length > 0) {
    rwLog("warn", "ref_images_all_dropped", { jobId: args.jobId });
  }

  /* ================= SIZE HANDLING ================= */

  if (isMiniMax) {
    // MiniMax / Hailou accepts only "768p" or "1080p".
    task.resolution = args.resolution === "1080p" ? "1080p" : "768p";

    // MiniMax should not receive width/height.
    delete task.width;
    delete task.height;
  } else if (isKlingPro) {
    // Kling Pro with refs: frameImages already set, no explicit dimensions needed.
    // Kling Pro without refs: use explicit dimensions.
    if (!hasInputs) {
      task.width = args.width;
      task.height = args.height;
    }

    task.CFGScale = 0.5;
    task.providerSettings = {
      klingai: {
        sound: args.withSound ?? false,
      },
    };
  } else if (isKling) {
    // Kling Standard with refs requires resolution string.
    if (hasInputs) {
      task.resolution = "720p";
    } else {
      task.width = args.width;
      task.height = args.height;
    }
  } else {
    // Default models use explicit dimensions.
    task.width = args.width;
    task.height = args.height;
  }

  /* ================= SEND ================= */

  rwLog("info", "launch_request", { jobId: args.jobId, model: args.airTag, width: task.width, height: task.height, resolution: task.resolution, duration: task.duration, promptPreview: safePositivePrompt.slice(0, 140) });

  const { res, text, json } = await postJson([task], args.jobId);

  if (!res.ok) {
    throw new Error(`Runware launch failed (${res.status}): ${text}`);
  }

  const providerJobId =
    json?.data?.[0]?.taskUUID ||
    json?.data?.[0]?.id ||
    taskUUID;

  rwLog("info", "launch_success", { jobId: args.jobId, model: args.airTag, providerJobId });

  return { jobId: String(providerJobId) };
}

/* ================= ERROR EXTRACTION =================
   Runware's failure payloads aren't shaped consistently — sometimes the
   error is a single object under `error`, sometimes an array under
   `errors`, sometimes nested one level deeper under `response`. Content-
   policy rejections (e.g. Vertex AI blocking a Veo prompt) can also arrive
   with no top-level `status` field at all, which used to fall through to
   "queued" and just burn the poll budget until the 320s timeout. Check
   every known shape up front, regardless of `status`.
================================================= */

function firstTruthy<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const v of values) if (v) return v;
  return undefined;
}

function extractRunwareError(first: any): { message: string; code?: string } | null {
  const candidate = firstTruthy(
    first?.error,
    Array.isArray(first?.errors) ? first?.errors?.[0] : first?.errors,
    first?.response?.error,
    Array.isArray(first?.response?.errors) ? first?.response?.errors?.[0] : first?.response?.errors,
  );

  if (!candidate) return null;

  const message =
    candidate?.message ||
    candidate?.additionalDetails?.responseContent ||
    (typeof candidate === "string" ? candidate : JSON.stringify(candidate));

  const code = candidate?.errorCode || candidate?.code;

  return { message: String(message), code: code ? String(code) : undefined };
}

/* ================= POLL ================= */

export async function pollRunware(providerJobId: string, ourJobId?: string): Promise<RunwarePollResult> {
  const payload = [
    {
      taskType: "getResponse",
      taskUUID: providerJobId,
      numberResults: 1,
    },
  ];

  const { res, text, json } = await postJson(payload, ourJobId);

  if (!res.ok) {
    return {
      status: "failed",
      error: `poll failed (${res.status}): ${text}`,
    };
  }

  const first = json?.data?.[0] ?? json;

  // Check for an error payload before trusting `status` — some failure
  // shapes (content-policy rejections in particular) omit `status` entirely.
  const errInfo = extractRunwareError(first);
  if (errInfo) {
    rwLog("error", "provider_rejected_video", {
      jobId: ourJobId,
      providerJobId,
      code: errInfo.code ?? null,
      message: errInfo.message,
      raw: JSON.stringify(first).slice(0, 1000),
    });
    return { status: "failed", error: errInfo.message, code: errInfo.code };
  }

  const raw = String(first?.status || "").toLowerCase();

  if (!raw || raw === "queued" || raw === "pending") {
    return { status: "queued" };
  }

  if (raw === "running" || raw === "processing") {
    return { status: "running" };
  }

  if (raw.includes("fail") || raw === "error") {
    return {
      status: "failed",
      error: "provider failed",
    };
  }

  const url = pickVideoUrl(json);

  // Async jobs can temporarily have no URL yet.
  if (!url) {
    return { status: "queued" };
  }

  return { status: "succeeded", url };
}
