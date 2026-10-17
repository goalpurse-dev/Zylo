// Content Machine: Runware image calls (backgrounds and illustrations only: the prompt always forbids
// text, letters and logos; every word on a slide is drawn by the renderer). includeCost on every task;
// the actual USD comes back in the answer. Needs a Budget Guard ticket.
import { assertTicket } from "../budgetGuard.js";

// FLUX.2 Klein 4B: the cheap, fast model the rest of the app already uses (runware:400@4).
export const IMAGE_MODEL = "runware:400@4";
export const IMAGE_ESTIMATE_USD = 0.004;   // a ceiling per image; the actual comes back from Runware
export const SIZE = Object.freeze({ width: 768, height: 1344 });   // 9:16-ish, multiples of 16
export const NO_TEXT = "no text, no letters, no words, no numbers, no captions, no watermark, no logos, no brand marks";

// Never a real person (owner, 2026-10-18): no real people, celebrities or lookalikes in any image.
export const NO_REAL_PEOPLE = "no real people, no celebrities, no public figures, no lookalikes of real people, no photographs of people";
// Backgrounds carry the text, so they have no people at all (text never crosses a face).
export const NO_PEOPLE = "no people, no faces, no human figures";

/** kind: "background" (no people at all) or "illustration" (invented characters allowed, never real ones). */
export function imagePrompt(prompt, kind = "illustration") {
  const p = String(prompt ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  const people = kind === "background" ? `${NO_PEOPLE}, ${NO_REAL_PEOPLE}` : `any character is an invented cartoon character, ${NO_REAL_PEOPLE}`;
  return `${p}. ${NO_TEXT}, ${people}.`;
}

export async function generateImage(ticket, { apiKey, prompt, kind = "illustration", baseUrl = "https://api.runware.ai", fetchImpl = fetch, model = IMAGE_MODEL, width = SIZE.width, height = SIZE.height }) {
  assertTicket(ticket, "runware");
  if (!apiKey) throw Object.assign(new Error("RUNWARE_API_KEY is not set"), { actualUsd: 0 });
  const taskUUID = crypto.randomUUID();
  const task = {
    taskType: "imageInference", taskUUID, model, positivePrompt: imagePrompt(prompt, kind), width, height,
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
