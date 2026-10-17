// Cutaway Explainer: the Runware tasks and a small async transport
// (submit with deliveryMethod "async", then poll with getResponse).
// fetch only: the edge function and the local runner both use it.
// Same reply handling as the Blocky worker, kept as Cutaway's own copy.

import { MODELS } from "./pricing.js";
import { IMAGE_SIZE } from "./style.js";

const CONTENT_POLICY = /moderat|safety|policy|nsfw|inappropriate|prohibited|violat|content.?filter|sensitive|blocked/i;

// ---------- task bodies ----------

/** Text-to-image (the master), or an edit when references are given (states, close-ups). */
export function imageTask({ prompt, references = [] }) {
  return {
    taskType: "imageInference",
    model: MODELS.image.air,
    positivePrompt: prompt,
    width: IMAGE_SIZE.width,
    height: IMAGE_SIZE.height,
    numberResults: 1,
    outputType: "URL",
    outputFormat: "JPG",
    ...(references.length ? { inputs: { referenceImages: references.slice(0, MODELS.image.maxReferenceImages) } } : {}),
  };
}

/** Faithful upscale of a crop (image: URL or data URI). */
export function upscaleTask({ image, factor }) {
  return { taskType: "upscale", model: MODELS.upscale.air, upscaleFactor: factor, outputType: "URL", outputFormat: "JPG", inputs: { image } };
}

/**
 * One clip from keyframe N (first) to keyframe N+1 (last). Size comes from the
 * stills (9:16 -> 704x1280 at 720p); width/height are refused with frameImages.
 * Audio off. p-video has no prompt-upsampling or negative-prompt field.
 */
export function clipTask({ prompt, firstUrl, lastUrl, durationSec }) {
  return {
    taskType: "videoInference",
    model: MODELS.clip.air,
    positivePrompt: prompt.slice(0, MODELS.clip.promptMax),
    duration: durationSec,
    resolution: MODELS.clip.resolution, // 24 fps is the model's default (MODELS.clip.fps)
    outputType: "URL",
    outputFormat: "MP4",
    numberResults: 1,
    settings: { audio: false },
    inputs: { frameImages: [{ image: firstUrl, frame: "first" }, { image: lastUrl, frame: "last" }] },
  };
}

// ---------- replies ----------

/** One task's state from any Runware reply. */
export function parseReply(body, taskUUID, httpStatus = 200) {
  const errs = Array.isArray(body?.errors) ? body.errors : body?.error ? [body.error] : [];
  const err = errs.find((e) => !e?.taskUUID || e.taskUUID === taskUUID);
  if (err) {
    const message = String(err.message ?? err.errorMessage ?? err.code ?? "error");
    return { state: "error", message, contentPolicy: CONTENT_POLICY.test(message), cost: Number(err.cost ?? 0) || 0 };
  }
  if (httpStatus >= 400) return { state: "error", message: `http ${httpStatus}`, cost: 0 };
  const item = Array.isArray(body?.data) ? body.data.find((d) => d?.taskUUID === taskUUID) : null;
  if (!item) return { state: "pending" };
  const status = String(item.status ?? "").toLowerCase();
  const url = item.videoURL ?? item.imageURL ?? null;
  const cost = Number(item.cost ?? 0) || 0;
  if (status === "error" || status === "failed") {
    const message = String(item.message ?? item.error ?? status);
    return { state: "error", message, contentPolicy: CONTENT_POLICY.test(message), cost };
  }
  if (url) return { state: "success", url, cost };
  return { state: "pending", cost };
}

// ---------- transport ----------

/**
 * send(tasks[]) -> {status, body}: how the tasks reach Runware. The edge
 * function posts to api.runware.ai with its key; the local runner can do the same.
 */
export function directSender(apiKey, baseUrl = "https://api.runware.ai/v1") {
  return async (tasks) => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(tasks),
      signal: AbortSignal.timeout(60_000),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

/** Submits one task (async); returns its taskUUID, or throws with Runware's message. */
export async function submit(send, task) {
  const taskUUID = crypto.randomUUID();
  const { status, body } = await send([{ ...task, taskUUID, deliveryMethod: "async", includeCost: true }]);
  const r = parseReply(body, taskUUID, status);
  if (r.state === "error") throw Object.assign(new Error(`RUNWARE_SUBMIT: ${r.message}`), { contentPolicy: r.contentPolicy });
  // Small sync results (upscale) can come back in the submit reply already.
  return { taskUUID, early: r.state === "success" ? r : null };
}

/** Polls one task once. */
export async function poll(send, taskUUID) {
  const { status, body } = await send([{ taskType: "getResponse", taskUUID }]);
  return parseReply(body, taskUUID, status);
}
