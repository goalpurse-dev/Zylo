// deno-lint-ignore-file no-explicit-any
// stickman/renderTiers.ts — the locked Stickman scene-image tiers (Phase 4b,
// decided by the Phase 4a bake-off). Stickman recipe only; the legacy
// tiers live elsewhere and are untouched.
//
//   V2  FLUX.2 [klein] 9B KV, 8 steps — ALL on-screen text as a programmatic overlay
//       (FLUX never renders text) + Real-ESRGAN upscale.
//   V3  Nano Banana 2 Lite — SHORT_TEXT rendered by the model and OCR-checked;
//       on a mismatch one retry, then a clean re-render + programmatic overlay.
//   V4  V3 + premium: best-of-2 for hook beats (first 30 s) and SHORT_TEXT
//       beats, a stricter QA threshold with one auto-retry.
// No reference images (Round B showed no gain). The call sites are injected,
// so the whole flow is testable offline.

import { textKindOf } from "./headlines.ts";

export type Tier = "V2" | "V3" | "V4";
export type TierConfig = {
  model: string;
  width: number;
  height: number;
  params: Record<string, unknown>;
  negativePrompt: boolean; // send the avoid tail as negativePrompt (else it is appended to the prompt)
  text: "overlay" | "model";
  ocrRetries: number; // model-rendered text: re-renders on an OCR mismatch before falling back to overlay
  bestOf: number;
  bestOfFor: ("hook" | "short_text")[];
  qa: "code" | "standard" | "strict"; // "code": free checks only (decodes, dimensions, not blank)
  qaRetries: number;
  referenceImages: false;
  upscale: true;
};

const V3: TierConfig = { model: "google:nano-banana@2-lite", width: 1376, height: 768, params: {}, negativePrompt: false, text: "model", ocrRetries: 1, bestOf: 1, bestOfFor: [], qa: "standard", qaRetries: 0, referenceImages: false, upscale: true };
export const STICKMAN_RENDER_TIERS: Record<Tier, TierConfig> = {
  // V2 steps 8 (Phase 4c tuning: vs 4 steps fewer duplicate-shield artifacts and
  // cleaner limbs, $0.00247 + $0.0006 upscale per image; the 9B Base was 2.5x the
  // price and 5x slower, native 2048x1152 drew filled sleeves and rougher lines).
  V2: { model: "runware:400@6", width: 1376, height: 768, params: { steps: 8, CFGScale: 3.5, acceleration: "high" }, negativePrompt: true, text: "overlay", ocrRetries: 0, bestOf: 1, bestOfFor: [], qa: "code", qaRetries: 1, referenceImages: false, upscale: true },
  V3,
  V4: { ...V3, bestOf: 2, bestOfFor: ["hook", "short_text"], qa: "strict", qaRetries: 1 },
};

// Tried in the Phase 4a bake-off or ruled out, and NOT used for Stickman.
export const EXCLUDED_STICKMAN_MODELS = ["google:4@3 (Nano Banana 2)", "recraft:v4@0 (Recraft V4)", "alibaba:qwen-image@2512 (Qwen-Image)", "Kling", "Seedream"];

export const HOOK_MS = 30_000;

// QA default (Phase 4b calibration on the 50 labeled bake-off images):
// gpt-4o-mini at detail "high" on a 768 px downscale transcribes text well —
// the text verdict is computed IN CODE from its OCR (93% agreement with the
// by-eye labels). No judge reached 80% on style (gpt-4o-mini 69% with zero
// false passes, Claude Haiku 4.5 48% and malformed tool output on 24/45 at a
// higher cost), so style / cast / concept are advisory: logged and used to
// rank candidates, never to gate. Re-calibrate before making them gate.
export const STICKMAN_QA = {
  model: "gpt-4o-mini",
  detail: "high" as const,
  imageWidth: 768,
  gating: ["text"] as const,
  advisory: ["style", "cast", "concept"] as const,
  textVerdict: "ocr_exact_match_in_code",
  calibration: { labeledImages: 50, textAgreementOcr: 0.93, styleAgreement: 0.69, haikuStyleAgreement: 0.48, haikuTextAgreementOcr: 0.9, costPerImageUsd: 0.0022, haikuCostPerImageUsd: 0.0035 },
};

// A beat's text contract for this tier. V2 never lets the model draw text:
// SHORT_TEXT becomes PROGRAMMATIC with the top zone kept clear for the overlay.
// Phase 6c-polish: text has a KIND (stickman/headlines.ts). HEADLINE text
// (stats, years, key words, the question) is ALWAYS Zyvo's code overlay, on
// every tier. IN_SCENE text (a sign, a label, a book title) is drawn by the
// model on V3/V4 (OCR-checked, then a clean re-render + overlay on a
// mismatch) and left blank on V2. A PROGRAMMATIC beat with text is a headline.
export function contractForTier(tier: Tier, contract: any, opts: { forceOverlay?: boolean } = {}): { contract: any; overlayText: string | null } {
  const t = contract.textIntent ?? { mode: "NO_TEXT", text: null };
  const text = String(t.text ?? "").trim();
  const hasText = (t.mode === "SHORT_TEXT" || t.mode === "PROGRAMMATIC") && text.length > 0;
  if (!hasText) return { contract, overlayText: null };
  const kind = textKindOf(contract);
  const overlayTier = STICKMAN_RENDER_TIERS[tier].text === "overlay";
  if (kind === "HEADLINE" || opts.forceOverlay) {
    return { contract: { ...contract, textIntent: { mode: "PROGRAMMATIC", text, zone: "top", kind } }, overlayText: text };
  }
  // IN_SCENE: the model draws it on V3/V4; on V2 the object is drawn blank.
  if (overlayTier) return { contract: { ...contract, textIntent: { mode: "NO_TEXT", text: null, kind, blankSurface: true } }, overlayText: null };
  return { contract, overlayText: null };
}

// Compiler options per tier. V2 draws no letters or digits at all (Phase 4d:
// FLUX wrote "blim", "1948 1948" and label scribbles next to the overlay).
// Phase 6e-fix: the no-writing rule on EVERY tier — V3/V4 printed prop names as
// garbled labels in 25 of 148 f90160bc frames. Only a beat whose words belong
// in the picture (IN_SCENE SHORT_TEXT on V3/V4) lets the model draw text.
export function compileOptionsFor(tier: Tier, contract?: any): { noTextAnywhere: boolean } {
  if (STICKMAN_RENDER_TIERS[tier].text === "overlay") return { noTextAnywhere: true };
  return { noTextAnywhere: contract ? contract.textIntent?.mode !== "SHORT_TEXT" : false };
}
// One automatic re-render when the QA reads words on a beat that should have none (V3/V4).
export const STRAY_TEXT_RETRIES = 1;

export function candidatesFor(tier: Tier, beat: { startMs: number; contract: any }): number {
  const c = STICKMAN_RENDER_TIERS[tier];
  const hook = c.bestOfFor.includes("hook") && beat.startMs < HOOK_MS;
  const text = c.bestOfFor.includes("short_text") && beat.contract?.textIntent?.mode === "SHORT_TEXT";
  return hook || text ? c.bestOf : 1;
}

// FLUX adds flames to horns and helmets on its own (Phase 4a/4b): keep fire
// out of the negative prompt's reach only when the concept actually asks for it.
const FIRE_IN_CONCEPT = /\b(fire\w*|flames?|flaming|burn\w*|torch(es)?|blaz\w*|embers?)\b/i;
export function negativeFor(compiled: { negativePrompt: string }, contract?: any): string {
  return contract && FIRE_IN_CONCEPT.test(String(contract.visualConcept ?? "")) ? compiled.negativePrompt : `${compiled.negativePrompt} Also avoid: flames, fire.`;
}

// The Runware task for one render of a compiled prompt.
export function renderTask(tier: Tier, compiled: { prompt: string; positivePrompt: string; negativePrompt: string }, contract?: any) {
  const c = STICKMAN_RENDER_TIERS[tier];
  return {
    taskType: "imageInference", model: c.model, width: c.width, height: c.height, numberResults: 1,
    outputType: "URL", outputFormat: "JPG", outputQuality: 95, deliveryMethod: "sync", includeCost: true,
    positivePrompt: c.negativePrompt ? compiled.positivePrompt : compiled.prompt,
    ...(c.negativePrompt ? { negativePrompt: negativeFor(compiled, contract) } : {}),
    ...c.params,
  };
}

// OCR comparison ignores case, spacing and punctuation ("BAYREUTH 1876" = "Bayreuth, 1876").
export const normalizeText = (s: string) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
export const textMatches = (expected: string, ocr: string) => normalizeText(ocr).includes(normalizeText(expected)) && normalizeText(expected).length > 0;

// soft: a quality flag (e.g. near-blank) — it gets the retry, but never fails the beat.
export type QaVerdict = { pass: boolean; score: number; ocrText: string; notes?: string; soft?: boolean };
export type RenderDeps = {
  // textIntent: the text as the COMPILER resolved it (a text-leak conversion can turn NO_TEXT into SHORT_TEXT).
  compile: (contract: any) => { prompt: string; positivePrompt: string; negativePrompt: string; textIntent?: any };
  render: (task: any) => Promise<{ imageURL: string; cost: number }>;
  qa: (imageURL: string, contract: any, strict: boolean) => Promise<QaVerdict & { cost: number }>;
  postProcess: (imageURL: string, tier: Tier) => Promise<{ bytes: Uint8Array; cost: number }>;
  overlay: (bytes: Uint8Array, text: string) => Promise<Uint8Array>;
  // V2: free code checks instead of AI QA (decodes, dimensions, not blank).
  codeCheck?: (imageURL: string) => Promise<QaVerdict & { cost: number }>;
};
export type RenderLog = { step: string; imageURL?: string; cost: number; qa?: QaVerdict };
// base: the 1920x1080 image BEFORE any text overlay (the overlay is stored as an editable layer).
export type RenderResult = { tier: Tier; imageURL: string; final: Uint8Array; base: Uint8Array; overlayText: string | null; log: RenderLog[]; cost: number; failed: boolean; retries: number };

// One beat through its tier: render (best-of-N) -> QA -> text policy -> upscale -> overlay.
export async function renderBeat(tier: Tier, beat: { startMs: number; contract: any }, deps: RenderDeps): Promise<RenderResult> {
  const cfg = STICKMAN_RENDER_TIERS[tier];
  const log: RenderLog[] = [];
  const strict = cfg.qa === "strict";
  // Apply the tier's text policy to the text as the compiler resolves it — so
  // a "labeled MYTH" conversion is overlaid on V2 and OCR-checked on V3/V4.
  const resolved = deps.compile(beat.contract).textIntent;
  const base = resolved ? { ...beat.contract, textIntent: resolved } : beat.contract;
  let { contract, overlayText } = contractForTier(tier, base);
  const wantsModelText = contract.textIntent?.mode === "SHORT_TEXT";

  const renderOnce = async (c: any, step: string) => {
    const r = await deps.render(renderTask(tier, deps.compile(c), c));
    const q = cfg.qa === "code" ? await deps.codeCheck!(r.imageURL) : await deps.qa(r.imageURL, c, strict);
    log.push({ step, imageURL: r.imageURL, cost: r.cost + q.cost, qa: q });
    return { imageURL: r.imageURL, qa: q as QaVerdict };
  };
  const pickBest = async (c: any, n: number, label: string) => {
    const shots = [];
    for (let i = 0; i < n; i++) shots.push(await renderOnce(c, n > 1 ? `${label} ${i + 1}/${n}` : label));
    return shots.sort((a, b) => b.qa.score - a.qa.score)[0];
  };

  let best = await pickBest(contract, candidatesFor(tier, beat), "render");
  // Stricter QA (V4): one automatic retry when the best candidate fails.
  for (let i = 0; i < cfg.qaRetries && !best.qa.pass; i++) {
    const again = await renderOnce(contract, "qa retry");
    if (again.qa.score > best.qa.score) best = again;
  }
  // Phase 6e-fix: stray text (words on a beat that should have none) gets one
  // automatic re-render on V3/V4; a still-wrong frame is flagged by the worker.
  if (cfg.qa !== "code" && !wantsModelText) {
    for (let i = 0; i < STRAY_TEXT_RETRIES && normalizeText(best.qa.ocrText) !== ""; i++) {
      const again = await renderOnce(contract, "stray text retry");
      if (normalizeText(again.qa.ocrText) === "" || again.qa.score > best.qa.score) best = again;
    }
  }
  // Model-rendered text (V3/V4): OCR must match; one retry, then a clean
  // re-render with the top zone kept clear + programmatic overlay.
  if (wantsModelText) {
    const expected = String(contract.textIntent.text ?? "");
    for (let i = 0; i < cfg.ocrRetries && !textMatches(expected, best.qa.ocrText); i++) {
      const again = await renderOnce(contract, "ocr retry");
      if (textMatches(expected, again.qa.ocrText) || again.qa.score > best.qa.score) best = again;
    }
    if (!textMatches(expected, best.qa.ocrText)) {
      ({ contract, overlayText } = contractForTier(tier, base, { forceOverlay: true }));
      best = await renderOnce(contract, "clean re-render for overlay");
    }
  }
  // One continuous frame: a picture split by a divider gets one re-render (every tier).
  if ((best.qa as any).split) {
    const again = await renderOnce(contract, "split frame retry");
    if (!(again.qa as any).split || again.qa.score > best.qa.score) best = again;
  }
  const split = !!(best.qa as any).split;
  const retries = log.filter((l) => l.step.includes("retry") || l.step.includes("re-render")).length;
  // A render that still fails the free code checks after its retry is not upscaled.
  if (cfg.qa === "code" && !best.qa.pass && !best.qa.soft) return { tier, imageURL: best.imageURL, final: new Uint8Array(), base: new Uint8Array(), overlayText, log, cost: log.reduce((s, l) => s + l.cost, 0), failed: true, retries, split };
  const post = await deps.postProcess(best.imageURL, tier);
  log.push({ step: "upscale 1920x1080", cost: post.cost });
  const final = overlayText ? await deps.overlay(post.bytes, overlayText) : post.bytes;
  if (overlayText) log.push({ step: "programmatic text overlay", cost: 0 });
  return { tier, imageURL: best.imageURL, final, base: post.bytes, overlayText, log, cost: log.reduce((s, l) => s + l.cost, 0), failed: false, retries, split };
}
