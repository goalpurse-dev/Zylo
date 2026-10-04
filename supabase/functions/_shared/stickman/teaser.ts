// deno-lint-ignore-file no-explicit-any
// stickman/teaser.ts — the free Long Form TEASER (free + newly signed-up users).
//
// A teaser is honest and cheap: a title, a one-line hook and 3 drawn scenes.
// It is NOT the video: no research, no fact-check, no script, no voiceover.
//   - ONE call to the cheapest model we use (gpt-4o-mini) writes the title,
//     the hook and 3 scene descriptions from the idea + the niche guidance.
//   - 3 scenes on V2 (runware:400@6), no upscale, no AI QA.
//   - Hard cap TEASER_CAP_USD per teaser: the cost is estimated BEFORE anything
//     is called and re-checked before every scene with the real spend so far;
//     if the next step could pass the cap, the teaser stops there.
// Pure helpers + the two provider calls (injected fetchers), so the whole flow
// runs the same in the edge function and in a local measuring script.
import { renderTask, STICKMAN_RENDER_TIERS } from "./renderTiers.ts";
import { STYLE_HEADER, OBJECTS_NO_FACES, AVOID_TAIL, V2_NO_TEXT_INSTRUCTION } from "./promptCompiler.ts";
import { nicheGuidanceFor } from "./nicheGuidance.ts";
import { IP_MARKS, IP_LOOKALIKE } from "./beatDirector.ts";

export const TEASER_CAP_USD = 0.02;
export const TEASER_MODEL = "gpt-4o-mini";
// OpenAI list price for gpt-4o-mini, USD per million tokens.
export const TEASER_MODEL_PRICE = { inputPerM: 0.15, outputPerM: 0.6 };
export const TEASER_MAX_OUTPUT_TOKENS = 400;
export const TEASER_SCENES = 3;
// runware:400@6, 1376x768, 8 steps: measured $0.00247 per image (renderTiers.ts). No upscale.
export const TEASER_SCENE_EST_USD = 0.0026;
export const TEASER_DAILY_LIMIT = 3; // per free account, per 24 h
export const TEASER_IP_DAILY_LIMIT = 6; // per IP address, per 24 h (several accounts behind one address)
export const TEASER_STALE_MS = 150_000; // a teaser that stopped moving for this long is marked failed

export type TeaserPlan = { title: string; hook: string; scenes: string[] };
export type TeaserInput = { topic: string; nicheId?: string | null; nicheLabel?: string | null };

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const tokenUsd = (inputTokens: number, outputTokens: number) =>
  Number(((inputTokens * TEASER_MODEL_PRICE.inputPerM + outputTokens * TEASER_MODEL_PRICE.outputPerM) / 1_000_000).toFixed(6));

export function teaserPrompt(input: TeaserInput): string {
  const g = nicheGuidanceFor(input.nicheId ?? null);
  return [
    "You write a TEASER for a narrated 2D stickman explainer video for YouTube: a title, a one-line hook and three picture descriptions. Nothing has been researched, so never state a fact, number, date or name as true: the title and the hook ask a question or tease it.",
    `Video idea: "${clean(input.topic, 300)}"`,
    input.nicheLabel ? `Niche: ${clean(input.nicheLabel, 60)}. Tone: ${clean(g.tone, 220)}` : `Tone: ${clean(g.tone, 220)}`,
    g.titleFormulas?.length ? `Title patterns that work in this niche: ${g.titleFormulas.slice(0, 3).map((t) => clean(t, 90)).join(" | ")}` : "",
    "title: at most 65 characters, a question or a curiosity gap about this exact idea, title case, no emoji, no clickbait promise the video could not keep.",
    "hook: ONE sentence of at most 140 characters, the first thing the narrator would say; a question or a scene the viewer can picture. No statistics.",
    "scenes: EXACTLY 3 pictures that would open this video, in order. Each is one sentence of at most 35 words describing a simple flat cartoon scene: which stickman characters, what they are doing, where. The artist sees ONLY that sentence, so every sentence names the era and what the people wear (\"a Roman legionary in a red tunic and iron helmet\", never just \"a soldier\"). At most four figures per picture. No text, signs, labels, logos, brands, flags, maps, real people's likenesses or split screens. Each picture must be different from the others.",
    'Return JSON: {"title": "...", "hook": "...", "scenes": ["...", "...", "..."]}',
  ].filter(Boolean).join("\n");
}

const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["title", "hook", "scenes"],
  properties: { title: { type: "string" }, hook: { type: "string" }, scenes: { type: "array", items: { type: "string" } } },
};

// The most the plan call can cost (prompt length known, output capped).
export const planMaxUsd = (prompt: string) => tokenUsd(Math.ceil(prompt.length / 3) + 60, TEASER_MAX_OUTPUT_TOKENS);
// Before anything is called: the most this teaser can cost, and whether that fits the cap.
export function teaserBudget(input: TeaserInput, cap = TEASER_CAP_USD) {
  const planMax = planMaxUsd(teaserPrompt(input));
  const estimate = Number((planMax + TEASER_SCENES * TEASER_SCENE_EST_USD).toFixed(6));
  return { planMax, sceneEach: TEASER_SCENE_EST_USD, scenes: TEASER_SCENES, estimate, cap, fits: estimate <= cap };
}
// During the run: may the next step (its estimated cost) still be started?
export const canSpend = (spentUsd: number, nextUsd: number, cap = TEASER_CAP_USD) => spentUsd + nextUsd <= cap + 1e-9;

export function normalizePlan(raw: any, input: TeaserInput): TeaserPlan {
  const scenes = (Array.isArray(raw?.scenes) ? raw.scenes : []).map((s: unknown) => clean(s, 240)).filter((s: string) => s.length >= 12)
    // A brand or a well-known character can't be drawn: that scene is described without it.
    .map((s: string) => s.replace(IP_MARKS, "a sports team").replace(IP_LOOKALIKE, "a cartoon character"))
    .slice(0, TEASER_SCENES);
  return { title: clean(raw?.title, 80) || clean(input.topic, 80), hook: clean(raw?.hook, 170), scenes };
}

// ONE mini-model call. `post` is fetch-like (injected for tests).
export async function writeTeaserPlan(openaiKey: string, input: TeaserInput, post: typeof fetch = fetch) {
  const prompt = teaserPrompt(input);
  const res = await post("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: TEASER_MODEL, temperature: 0.7, max_tokens: TEASER_MAX_OUTPUT_TOKENS, messages: [{ role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "teaser", strict: true, schema: PLAN_SCHEMA } } }),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.choices?.[0]?.message?.content) throw new Error(`teaser plan ${res.status}`);
  const inputTokens = Number(j.usage?.prompt_tokens ?? 0), outputTokens = Number(j.usage?.completion_tokens ?? 0);
  const plan = normalizePlan(JSON.parse(j.choices[0].message.content), input);
  if (plan.scenes.length < 1) throw new Error("teaser plan had no scenes");
  return { plan, inputTokens, outputTokens, usd: tokenUsd(inputTokens, outputTokens), model: TEASER_MODEL };
}

// The V2 picture: the same locked stickman style as every Long Form scene, no text in the image.
// The shared style header names helmets and display cases (rules for full
// scenes); mentioned here they get drawn into every picture, so the teaser
// keeps only the first sentence of that rule.
const TEASER_STYLE = STYLE_HEADER.replace(OBJECTS_NO_FACES, "Objects have no faces, eyes, mouths or limbs.");
export function teaserScenePrompt(description: string) {
  const positivePrompt = `${TEASER_STYLE} Scene: ${clean(description, 240)} ${V2_NO_TEXT_INSTRUCTION} One single frame, no panels.`;
  return { prompt: `${positivePrompt} ${AVOID_TAIL}`, positivePrompt, negativePrompt: AVOID_TAIL };
}
export const teaserSceneTask = (description: string) => renderTask("V2", teaserScenePrompt(description));
export const TEASER_SCENE_MODEL = STICKMAN_RENDER_TIERS.V2.model;

// Runs the whole teaser. `io` does the side effects; every real cost goes
// through io.cost before the next step is considered.
export type TeaserIo = {
  writePlan: (input: TeaserInput) => Promise<{ plan: TeaserPlan; usd: number; inputTokens: number; outputTokens: number; model: string }>;
  drawScene: (description: string, index: number) => Promise<{ imageUrl: string; usd: number; costKnown: boolean }>;
  onPlan?: (plan: TeaserPlan, spentUsd: number) => Promise<void> | void;
  onScene?: (index: number, scene: { description: string; status: "drawing" | "ready" | "failed" | "skipped"; imageUrl?: string | null }, spentUsd: number) => Promise<void> | void;
  cost?: (entry: { step: "plan" | "scene"; index?: number; usd: number; model: string; inputTokens?: number; outputTokens?: number; estimated: boolean }) => Promise<void> | void;
};
export async function runTeaser(input: TeaserInput, io: TeaserIo, cap = TEASER_CAP_USD) {
  const budget = teaserBudget(input, cap);
  if (!canSpend(0, budget.planMax, cap)) return { ok: false as const, reason: "over_cap_before_start", spentUsd: 0, budget };
  let spent = 0;
  const written = await io.writePlan(input);
  spent = Number((spent + written.usd).toFixed(6));
  await io.cost?.({ step: "plan", usd: written.usd, model: written.model, inputTokens: written.inputTokens, outputTokens: written.outputTokens, estimated: true });
  await io.onPlan?.(written.plan, spent);
  const scenes: { description: string; status: "ready" | "failed" | "skipped"; imageUrl: string | null }[] = [];
  let sceneEach = TEASER_SCENE_EST_USD;
  for (let i = 0; i < written.plan.scenes.length; i++) {
    const description = written.plan.scenes[i];
    // The cap is checked with the REAL spend so far before every picture, and
    // the next picture is assumed to cost what the dearest one so far did (a
    // price that went up must not carry the teaser past the cap).
    if (!canSpend(spent, sceneEach, cap)) {
      scenes.push({ description, status: "skipped", imageUrl: null });
      await io.onScene?.(i, { description, status: "skipped", imageUrl: null }, spent);
      continue;
    }
    await io.onScene?.(i, { description, status: "drawing" }, spent);
    try {
      const drawn = await io.drawScene(description, i);
      spent = Number((spent + drawn.usd).toFixed(6));
      sceneEach = Math.max(sceneEach, drawn.usd);
      await io.cost?.({ step: "scene", index: i, usd: drawn.usd, model: TEASER_SCENE_MODEL, estimated: !drawn.costKnown });
      scenes.push({ description, status: "ready", imageUrl: drawn.imageUrl });
      await io.onScene?.(i, { description, status: "ready", imageUrl: drawn.imageUrl }, spent);
    } catch (_e) {
      // A failed draw is charged its estimate against the cap (the provider may have billed it).
      spent = Number((spent + TEASER_SCENE_EST_USD).toFixed(6));
      scenes.push({ description, status: "failed", imageUrl: null });
      await io.onScene?.(i, { description, status: "failed", imageUrl: null }, spent);
    }
  }
  return { ok: scenes.some((s) => s.status === "ready"), plan: written.plan, scenes, spentUsd: spent, budget, underCap: spent <= cap + 1e-9 };
}

// Who may start a teaser (pure; the function supplies the facts).
export function teaserGate(f: { plan: string; emailVerified: boolean; userToday: number; ipToday: number; drawingPaused: boolean }):
  { ok: true } | { ok: false; code: string; status: number; message: string } {
  if (String(f.plan || "free").toLowerCase() !== "free") return { ok: false, code: "PAID_USER", status: 409, message: "Your plan makes the full video. Press Generate." };
  if (!f.emailVerified) return { ok: false, code: "EMAIL_NOT_VERIFIED", status: 403, message: "Confirm your email first: open the link we sent you, then press Generate again." };
  if (f.userToday >= TEASER_DAILY_LIMIT) return { ok: false, code: "DAILY_LIMIT", status: 429, message: `You've made today's ${TEASER_DAILY_LIMIT} free previews. Upgrade to make the full video, or come back tomorrow.` };
  if (f.ipToday >= TEASER_IP_DAILY_LIMIT) return { ok: false, code: "IP_LIMIT", status: 429, message: "Too many free previews from this network today. Try again tomorrow, or upgrade to make the full video." };
  if (f.drawingPaused) return { ok: false, code: "DRAWING_PAUSED", status: 503, message: "Previews are paused for a moment. Please try again in a few minutes." };
  return { ok: true };
}
