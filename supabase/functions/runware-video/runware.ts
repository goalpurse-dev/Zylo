// supabase/functions/runware-video/runware.ts
// Generic Runware VIDEO launcher for Zylo

type TierId = "zylo-v1" | "zylo-v2" | "zylo-v3" | "zylo-v4";
type Aspect = "16:9" | "9:16" | "1:1";
type Resolution = "720p" | "1080p";

export type RunwareLaunchArgs = {
  tier: TierId;
  subject: string;
  aspect: Aspect;
  resolution: Resolution;
  durationSec: number;
  initImageUrl?: string | string[] | null;
  audio?: boolean | null;
  airTag?: string | null;
  model?: string | null;
};

export type RunwareLaunchResult = { jobId: string };

export type RunwarePollResult =
  | { status: "queued" | "running" }
  | { status: "failed"; error?: string }
  | { status: "succeeded"; url?: string };

/* ------------------ Config ------------------ */

const RW_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
if (!RW_KEY) throw new Error("RUNWARE_API_KEY not set");

const USER_BASE = (Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai")
  .replace(/\/+$/, "");
const BASE_V1 = `${USER_BASE}/v1`;
const TASKS_URL = `${BASE_V1}/air/tasks`;

function rwHeaders(): Headers {
  return new Headers({
    Authorization: `Bearer ${RW_KEY}`,
    "Content-Type": "application/json",
  });
}

/* ------------------ Utils ------------------ */

async function postJson(
  url: string,
  body: unknown,
): Promise<{ json: any; status: number; ok: boolean; text: string }> {
  const r = await fetch(url, {
    method: "POST",
    headers: rwHeaders(),
    body: JSON.stringify(body ?? {}),
  });

  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {}

  return { json, status: r.status, ok: r.ok, text };
}

function pick<T = any>(...vals: Array<T | undefined | null>): T | undefined {
  for (const v of vals) if (v != null) return v as T;
  return undefined;
}

function normalizeInitSources(src?: string | string[] | null): string[] {
  const arr = Array.isArray(src) ? src : src ? [src] : [];
  return arr.map(v => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

/* ------------------ Tier model map ------------------ */

type TierSpec = { air: string; durations: number[] };

export const AIR_BY_TIER: Record<TierId, TierSpec> = {
  "zylo-v1": { air: "bytedance:2@2", durations: [5, 10] },
  "zylo-v2": { air: "bytedance:2@2", durations: [5, 10] },
  "zylo-v3": { air: "bytedance:2@2", durations: [5, 10] },
  "zylo-v4": { air: "klingai:6@1", durations: [5, 10] },
};

/* ------------------ Dimensions ------------------ */
// v4 MUST BE EXACT RUNWARE ACCEPTED RESOLUTIONS.

function dims(aspect: Aspect, resolution: Resolution) {
  // v4 Kling resolutions
  if (resolution === "1080p") {
    if (aspect === "9:16") return { width: 1080, height: 1920 };
    if (aspect === "16:9") return { width: 1920, height: 1080 };
    return { width: 1440, height: 1440 };
  }

  // 720p — for v3
  if (resolution === "720p") {
    if (aspect === "9:16") return { width: 704, height: 1248 };
    if (aspect === "16:9") return { width: 1248, height: 704 };
    return { width: 960, height: 960 };
  }

  // Default fallback (should never hit)
  return { width: 1080, height: 1920 };
}

/* ------------------ frameImages ------------------ */

function buildFrameImages(sources: string[]) {
  if (!sources.length) return [];

  if (sources.length === 1) {
    return [{ inputImage: sources[0], frame: "first" }];
  }

  const out = [{ inputImage: sources[0], frame: "first" }];

  for (let i = 1; i < sources.length - 1; i++) {
    out.push({ inputImage: sources[i] });
  }

  out.push({
    inputImage: sources[sources.length - 1],
    frame: "last",
  });

  return out;
}

/* ------------------ Launch ------------------ */

export async function launchRunwareVideo(
  args: RunwareLaunchArgs,
): Promise<RunwareLaunchResult> {

  const tierSpec = AIR_BY_TIER[args.tier];
  if (!tierSpec) throw new Error(`Unknown tier ${args.tier}`);

  const subject = args.subject.trim();
  if (!subject) throw new Error("Missing subject prompt");

  const duration = tierSpec.durations.includes(args.durationSec)
    ? args.durationSec
    : tierSpec.durations[0];

  const fromModel = args.model?.trim();
  const fromAirTag = args.airTag?.trim();
  const looksLikeAir =
    !!fromModel && /^[a-z0-9_-]+:\d+@\d+$/i.test(fromModel);

  const model = (looksLikeAir ? fromModel : undefined) ?? fromAirTag ?? tierSpec.air;

  const initSources = normalizeInitSources(args.initImageUrl);
  const { width, height } = dims(args.aspect, args.resolution);

  const taskUUID = crypto.randomUUID();

  console.log("[runware-video] launching", {
    tier: args.tier,
    model,
    duration,
    aspect: args.aspect,
    resolution: args.resolution,
    width,
    height,
    initSources,
  });

  // Base payload
  const task: Record<string, unknown> = {
    taskType: "videoInference",
    taskUUID,
    model,
    positivePrompt: subject,
    duration,
    numberResults: 1,
    outputType: "URL",
    outputFormat: "MP4",
    includeCost: true,
    outputQuality: 85,
  };

  // ONLY send width/height if NO frameImages (Runware rule)
// ---------- Frame images + resolution rules ----------
if (initSources.length > 0) {
  // Add reference images
  task.frameImages = buildFrameImages(initSources);

  if (args.tier !== "zylo-v4") {
    // v1 / v2 / v3 REQUIRE width+height even with frameImages
    task.width = width;
    task.height = height;
  }

} else {
  // No reference → ALWAYS include width/height
  task.width = width;
  task.height = height;
}

  const { json, status, ok, text } = await postJson(TASKS_URL, [task]);

  if (!ok) {
    console.error("[runware-video] launch error", {
      status,
      body: text?.slice?.(0, 900),
    });

    throw new Error(`Runware error ${status}: ${text?.slice?.(0, 900)}`);
  }

  const first =
    json?.data?.[0] ||
    json?.[0] ||
    json;

  const jobId =
    pick(first?.taskUUID, first?.id, json?.taskUUID, json?.id) ||
    taskUUID;

  return { jobId: String(jobId) };
}

/* ------------------ Polling ------------------ */

export async function pollRunware(jobId: string): Promise<RunwarePollResult> {
  const payload = [{ taskType: "getResponse", taskUUID: jobId }];

  const { json, status, ok, text } = await postJson(TASKS_URL, payload);

  if (!ok) {
    console.error("[runware-video] poll error", { status, text });
    return { status: "failed", error: `poll failed ${status}` };
  }

  const first =
    json?.data?.[0] ||
    json?.[0] ||
    json;

  const raw = String(first?.status || first?.state || "")
    .toLowerCase();

  if (!raw || raw === "queued" || raw === "pending") return { status: "queued" };
  if (raw === "running" || raw === "processing") return { status: "running" };

  if (raw.includes("fail") || raw === "error") {
    const msg =
      first?.error?.message ||
      first?.error ||
      first?.message ||
      "provider failed";

    console.error("[runware-video] provider failure", { jobId, msg });
    return { status: "failed", error: msg };
  }

  const url =
    pick(
      first?.videoURL,
      first?.result?.videoURL,
      first?.url,
      first?.result_url,
    ) ||
    (() => {
      try {
        const deep = JSON.stringify(first);
        const match =
          deep.match(/https?:\/\/[^\s"']+\.(mp4|webm|mov|m4v)/i);
        return match ? match[0] : undefined;
      } catch {
        return undefined;
      }
    })();

  if (!url) {
    console.error("[runware-video] completed but no URL found", { jobId });
    return { status: "failed", error: "completed but no video url" };
  }

  return { status: "succeeded", url };
}
