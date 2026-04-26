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

/* ================= LAUNCH ================= */

export async function launchRunwareVideo(
  args: RunwareLaunchArgs,
): Promise<RunwareLaunchResult> {
  const taskUUID = crypto.randomUUID();

  const task: Record<string, unknown> = {
    taskType: "videoInference",
    taskUUID,
    model: args.airTag,
    positivePrompt: args.subject,
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

  const rawRefs = (args.referenceImages ?? []).filter(Boolean).map(String);
  const safeRefs: string[] = [];

  for (const url of rawRefs) {
    if (await isUnder10MB(url)) {
      safeRefs.push(url);
    } else {
      console.warn("[runware-video] Dropped ref over 10MB or unreachable:", url);
    }
  }

  const hasInputs = safeRefs.length > 0;

  /* ================= REFERENCE INPUTS ================= */

  // Correct Runware format for image-to-video references.
  if (hasInputs) {
    task.inputs = {
      frameImages: safeRefs.map((url) => ({ image: url })),
    };
  } else if (rawRefs.length > 0) {
    console.warn("[runware-video] References were provided but none passed safety checks");
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

  console.log("[runware-video] FINAL TASK", JSON.stringify(task, null, 2));

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
  const payload = [
    {
      taskType: "getResponse",
      taskUUID: jobId,
      numberResults: 1,
    },
  ];

  const { res, text, json } = await postJson(payload);

  if (!res.ok) {
    return {
      status: "failed",
      error: `poll failed (${res.status}): ${text}`,
    };
  }

  const first = json?.data?.[0] ?? json;
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
      error:
        first?.error?.message ||
        first?.errors?.[0]?.message ||
        JSON.stringify(first?.errors || first?.error || "provider failed"),
    };
  }

  const url = pickVideoUrl(json);

  // Async jobs can temporarily have no URL yet.
  if (!url) {
    return { status: "queued" };
  }

  return { status: "succeeded", url };
}