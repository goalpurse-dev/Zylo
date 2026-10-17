// Content Machine: Runware image calls (backgrounds and illustrations only: the prompt always forbids
// text, letters and logos; every word on a slide is drawn by the renderer). includeCost on every task;
// the actual USD comes back in the answer. Needs a Budget Guard ticket.
import { assertTicket } from "../budgetGuard.js";

// FLUX.2 Klein 4B: the cheap, fast model the rest of the app already uses (runware:400@4).
export const IMAGE_MODEL = "runware:400@4";
export const IMAGE_ESTIMATE_USD = 0.004;   // a ceiling per image; the actual comes back from Runware
export const SIZE = Object.freeze({ width: 768, height: 1344 });   // 9:16-ish, multiples of 16
export const NO_TEXT = "no text, no letters, no words, no numbers, no captions, no watermark, no logos, no brand marks";

export function imagePrompt(prompt) {
  const p = String(prompt ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  return `${p}. ${NO_TEXT}.`;
}

export async function generateImage(ticket, { apiKey, prompt, baseUrl = "https://api.runware.ai", fetchImpl = fetch, model = IMAGE_MODEL, width = SIZE.width, height = SIZE.height }) {
  assertTicket(ticket, "runware");
  if (!apiKey) throw Object.assign(new Error("RUNWARE_API_KEY is not set"), { actualUsd: 0 });
  const taskUUID = crypto.randomUUID();
  const task = {
    taskType: "imageInference", taskUUID, model, positivePrompt: imagePrompt(prompt), width, height,
    numberResults: 1, outputType: "URL", outputFormat: "JPG", includeCost: true,
  };
  const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/v1`, {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify([task]), signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json().catch(() => null);
  const item = (body?.data ?? []).find((d) => d?.taskUUID === taskUUID) ?? body?.data?.[0];
  const cost = Number(item?.cost);
  if (!res.ok || !item?.imageURL) {
    const why = JSON.stringify(body?.errors ?? body?.error ?? body).slice(0, 300);
    throw Object.assign(new Error(`runware ${res.status}: ${why}`), { actualUsd: Number.isFinite(cost) ? cost : (res.ok ? null : 0) });
  }
  return { url: item.imageURL, costUsd: Number.isFinite(cost) ? cost : null, taskUUID };
}
