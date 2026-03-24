// supabase/functions/runware-video/runware.ts
// Runware VIDEO helper (launch + poll)

type RunwareLaunchArgs = {
  subject: string;
  width: number;
  height: number;
  durationSec: number;
  referenceImages?: string[] | null;
  airTag: string;
};

export type RunwareLaunchResult = { jobId: string };

export type RunwarePollResult =
  | { status: "queued" | "running" }
  | { status: "failed"; error?: string }
  | { status: "succeeded"; url: string };

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

async function postJson(body: unknown) {
  const res = await fetch(TASKS_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
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
    const size = Number(res.headers.get("content-length") || 0);
    return size > 0 && size <= 10 * 1024 * 1024;
  } catch {
    return false;
  }
}

/* ================= LAUNCH ================= */

export async function launchRunwareVideo(args: RunwareLaunchArgs): Promise<RunwareLaunchResult> {
  const taskUUID = crypto.randomUUID();

  const task: Record<string, unknown> = {
    taskType: "videoInference",
    taskUUID,
    model: args.airTag,
    positivePrompt: args.subject,
    duration: args.durationSec,
    numberResults: 1,
    outputType: "URL",
    outputFormat: "MP4",
    includeCost: true,
  };

  /* ================= FILTER REFERENCE IMAGES ================= */

  const rawRefs = (args.referenceImages ?? []).filter(Boolean);

  const safeRefs: string[] = [];

  for (const url of rawRefs) {
    if (await isUnder10MB(url)) {
      safeRefs.push(url);
    }
  }

  if (safeRefs.length > 0) {
    task.inputs = {
      frameImages: safeRefs.map((url) => ({ image: url })),
    };
  }

  /* ================= SIZE HANDLING ================= */

  const isKling = args.airTag.startsWith("klingai:");
  const hasInputs = safeRefs.length > 0;

  if (isKling) {
    if (hasInputs) {
      // 🔥 Kling WITH reference images
      task.resolution = "720p"; // REQUIRED by Runware
    } else {
      // 🔥 Kling WITHOUT reference images
      task.width = args.width;
      task.height = args.height;
    }
  } else {
    // other models
    task.width = args.width;
    task.height = args.height;
  }

  /* ================= SEND ================= */

  const { res, text, json } = await postJson([task]);

  if (!res.ok) {
    throw new Error(`Runware launch failed (${res.status}): ${text}`);
  }

  const providerJobId =
    json?.data?.[0]?.taskUUID ||
    json?.data?.[0]?.id ||
    taskUUID;

  return { jobId: String(providerJobId) };
}

/* ================= POLL ================= */

export async function pollRunware(jobId: string): Promise<RunwarePollResult> {
  const payload = [{ taskType: "getResponse", taskUUID: jobId }];

  const { res, text, json } = await postJson(payload);

  if (!res.ok) {
    return { status: "failed", error: `poll failed (${res.status}): ${text}` };
  }

  const first = json?.data?.[0] ?? json;
  const raw = String(first?.status || "").toLowerCase();

  if (!raw || raw === "queued" || raw === "pending") return { status: "queued" };
  if (raw === "running" || raw === "processing") return { status: "running" };

  if (raw.includes("fail") || raw === "error") {
    return { status: "failed", error: first?.error?.message ?? "provider failed" };
  }

  const url = pickVideoUrl(json);
  if (!url) return { status: "failed", error: "completed but no video url" };

  return { status: "succeeded", url };
}