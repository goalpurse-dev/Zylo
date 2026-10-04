// deno-lint-ignore-file no-explicit-any
// stickman/teaser.ts — the free Long Form TEASER (free + newly signed-up users).
//
// A teaser is honest and cheap: a title, a one-line hook and 3 drawn scenes.
// It is NOT the video: no research, no fact-check, no script, no voiceover.
//   - ONE call to the cheapest model we use (gpt-4o-mini) writes the title,
//     the hook and 3 scene descriptions from the idea + the niche guidance.
//   - The hook follows the full script's cold-open rules and is checked in
//     code against the same banned phrases; a hook that breaks them gets at
//     most two tiny rewrite calls (same model), and is left out if it still
//     fails. All of it is inside the cap.
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
import { BANNED_LECTURE_PHRASES, checkColdOpen } from "./scriptChecks.ts";

export const TEASER_CAP_USD = 0.02;
export const TEASER_MODEL = "gpt-4o-mini";
// OpenAI list price for gpt-4o-mini, USD per million tokens.
export const TEASER_MODEL_PRICE = { inputPerM: 0.15, outputPerM: 0.6 };
export const TEASER_MAX_OUTPUT_TOKENS = 400;
export const TEASER_HOOK_FIXES = 2; // rewrite calls for a hook that breaks the rules, at most
export const TEASER_HOOK_FIX_MAX_OUTPUT_TOKENS = 80;
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

/* ---------- The hook: the full script's cold-open rules ---------- */
// The script check's own lists: BANNED_LECTURE_PHRASES (scriptChecks.ts, the
// Stickman check) and SLOP_PHRASES (advance-long-form-script/index.ts, the base
// check). That file is a function entrypoint and can't be imported, so its
// list is repeated here and a test keeps the two identical.
export const SCRIPT_SLOP_PHRASES = [
  "have you ever wondered", "in today's video", "before we begin", "make sure to subscribe",
  "let's delve into", "let's explore", "it is important to note", "one fascinating aspect",
  "another interesting fact", "this begs the question", "in conclusion",
];
export const HOOK_BANNED_PHRASES = [...new Set([...BANNED_LECTURE_PHRASES, ...SCRIPT_SLOP_PHRASES])];
// Lecture openers: telling the viewer to imagine something, or asking about the
// topic from outside, instead of putting them in the moment. (In a whole script
// the check tolerates two "Imagine…"; a one-line hook gets none.)
const HOOK_BAD_OPENER = /^(imagine|picture|visuali[sz]e|think of|think about|ever wonder(ed)?|what if|in a world|once upon a time|today|join us|let'?s|let us|come along|step into|step back|travel back|discover|explore|learn|find out|meet)\b/i;
const HOOK_LECTURE_ANYWHERE = /\b(imagine a world|in a world where|have you ever|did you know|ever wondered)\b/i;
export const HOOK_MAX_CHARS = 150;

// Why a hook can't be shown ([] = it follows the rules). Deterministic, $0.
export function hookIssues(hook: string): string[] {
  const text = clean(hook, 400), lower = text.toLowerCase();
  if (text.length < 25) return ["it is too short to be a scene"];
  const issues: string[] = [];
  if (text.length > HOOK_MAX_CHARS) issues.push(`it is longer than ${HOOK_MAX_CHARS} characters`);
  for (const phrase of HOOK_BANNED_PHRASES) if (lower.includes(phrase)) issues.push(`it uses the banned phrase "${phrase}"`);
  for (const sentence of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
    const opener = sentence.trim().match(HOOK_BAD_OPENER);
    if (opener) issues.push(`a sentence starts with "${opener[0]}" (it tells the viewer what to do instead of putting them in the moment)`);
  }
  const anywhere = text.match(HOOK_LECTURE_ANYWHERE);
  if (anywhere) issues.push(`it uses the lecture phrase "${anywhere[0]}"`);
  // The script's own cold-open check: second person, and no greeting / question about the video.
  for (const issue of checkColdOpen([{ id: "hook", text }])) {
    issues.push(issue.code === "cold_open_no_second_person" ? 'it never puts the viewer in the scene ("you" / "your")' : "it opens with a greeting or a question about the video");
  }
  if (text.trim().endsWith("?")) issues.push("it is a question; a cold open is a moment the viewer is standing in");
  return [...new Set(issues)];
}

const HOOK_RULES = [
  `hook: the COLD OPEN, the first thing the narrator says. ONE sentence of at most ${HOOK_MAX_CHARS - 10} characters, second person ("You…"), present tense, sensory.`,
  "Drop the viewer INTO one concrete moment of this exact idea (a body, a place, an object in their hands, a sound) and stop there. A statement, never a question. No analysis, no promise about the video.",
  'Never start with Imagine, Picture, Think of, Ever wondered, What if, Did you know, Today, Let\'s, Discover, Explore or Meet; never write "in a world where".',
  `None of these phrases anywhere: ${HOOK_BANNED_PHRASES.map((p) => `"${p}"`).join(", ")}.`,
  'The shape (an example for another video; write about THIS idea and never reuse its words): "You tighten the strap of a pack that already weighs as much as a child, and the road ahead has no end you can see."',
].join(" ");

export function teaserPrompt(input: TeaserInput): string {
  const g = nicheGuidanceFor(input.nicheId ?? null);
  return [
    "You write a TEASER for a narrated 2D stickman explainer video for YouTube: a title, a one-line hook and three picture descriptions. Nothing has been researched, so never state a fact, number, date or name as true: the title asks a question or teases it, and the hook is a scene, not a claim.",
    `Video idea: "${clean(input.topic, 300)}"`,
    input.nicheLabel ? `Niche: ${clean(input.nicheLabel, 60)}. Tone: ${clean(g.tone, 220)}` : `Tone: ${clean(g.tone, 220)}`,
    g.titleFormulas?.length ? `Title patterns that work in this niche: ${g.titleFormulas.slice(0, 3).map((t) => clean(t, 90)).join(" | ")}` : "",
    "title: at most 65 characters, a question or a curiosity gap about this exact idea, title case, no emoji, no clickbait promise the video could not keep.",
    HOOK_RULES + " No statistics, dates or names of real people.",
    "scenes: EXACTLY 3 pictures that would open this video, in order. Each is one sentence of at most 35 words describing a simple flat cartoon scene: which stickman characters, what they are doing, where. The artist sees ONLY that sentence, so every sentence names the era and what the people wear (\"a Roman legionary in a red tunic and iron helmet\", never just \"a soldier\"). At most four figures per picture. No text, signs, labels, logos, brands, flags, maps, real people's likenesses or split screens. Each picture must be different from the others.",
    'Return JSON: {"title": "...", "hook": "...", "scenes": ["...", "...", "..."]}',
  ].filter(Boolean).join("\n");
}

const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["title", "hook", "scenes"],
  properties: { title: { type: "string" }, hook: { type: "string" }, scenes: { type: "array", items: { type: "string" } } },
};

// A hook that broke the rules: a tiny rewrite call (the hook only).
export function hookFixPrompt(input: TeaserInput, hook: string, issues: string[]): string {
  return [
    `Rewrite the opening line of a narrated stickman explainer video about: "${clean(input.topic, 300)}"`,
    `The line was: "${clean(hook, 200)}"`,
    `It can't be used because ${issues.slice(0, 5).join("; ")}.`,
    HOOK_RULES,
    "Nothing has been researched: no statistics, dates or names of real people.",
    'Return JSON: {"hook": "..."}',
  ].join("\n");
}
const HOOK_SCHEMA = { type: "object", additionalProperties: false, required: ["hook"], properties: { hook: { type: "string" } } };
// The most one rewrite call can cost (its prompt is short and bounded).
export const HOOK_FIX_MAX_USD = tokenUsd(900, TEASER_HOOK_FIX_MAX_OUTPUT_TOKENS);

// The most the writing step can cost: the plan call (prompt length known,
// output capped) plus every rewrite call it may make.
export const planMaxUsd = (prompt: string) => Number((tokenUsd(Math.ceil(prompt.length / 3) + 60, TEASER_MAX_OUTPUT_TOKENS) + TEASER_HOOK_FIXES * HOOK_FIX_MAX_USD).toFixed(6));
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

// ONE mini-model call writes the plan. The hook is then checked in code; one
// that breaks the cold-open rules gets at most TEASER_HOOK_FIXES tiny rewrite
// calls, and is left out (never shown) if it still breaks them. `post` is
// fetch-like (injected for tests). The cost returned covers every call made.
export async function writeTeaserPlan(openaiKey: string, input: TeaserInput, post: typeof fetch = fetch) {
  const ask = async (content: string, maxTokens: number, name: string, schema: unknown) => {
    const res = await post("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: TEASER_MODEL, temperature: 0.7, max_tokens: maxTokens, messages: [{ role: "user", content }], response_format: { type: "json_schema", json_schema: { name, strict: true, schema } } }),
    });
    const j: any = await res.json().catch(() => null);
    if (!res.ok || !j?.choices?.[0]?.message?.content) throw new Error(`teaser ${name} ${res.status}`);
    return { json: JSON.parse(j.choices[0].message.content), inputTokens: Number(j.usage?.prompt_tokens ?? 0), outputTokens: Number(j.usage?.completion_tokens ?? 0) };
  };
  const first = await ask(teaserPrompt(input), TEASER_MAX_OUTPUT_TOKENS, "teaser", PLAN_SCHEMA);
  let inputTokens = first.inputTokens, outputTokens = first.outputTokens;
  const plan = normalizePlan(first.json, input);
  if (plan.scenes.length < 1) throw new Error("teaser plan had no scenes");
  let issues = hookIssues(plan.hook), hookFixes = 0;
  while (issues.length && hookFixes < TEASER_HOOK_FIXES) {
    hookFixes += 1;
    try {
      const fix = await ask(hookFixPrompt(input, plan.hook, issues), TEASER_HOOK_FIX_MAX_OUTPUT_TOKENS, "teaser_hook", HOOK_SCHEMA);
      inputTokens += fix.inputTokens; outputTokens += fix.outputTokens;
      plan.hook = clean(fix.json?.hook, 170);
      issues = hookIssues(plan.hook);
    } catch (_e) { break; } // a failed rewrite never fails the teaser
  }
  const hookDropped = issues.length > 0;
  if (hookDropped) plan.hook = ""; // better no opening line than a lecture line
  return { plan, inputTokens, outputTokens, usd: tokenUsd(inputTokens, outputTokens), model: TEASER_MODEL, calls: 1 + hookFixes, hookFixes, hookDropped };
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
  writePlan: (input: TeaserInput) => Promise<{ plan: TeaserPlan; usd: number; inputTokens: number; outputTokens: number; model: string; calls?: number }>;
  drawScene: (description: string, index: number) => Promise<{ imageUrl: string; usd: number; costKnown: boolean }>;
  onPlan?: (plan: TeaserPlan, spentUsd: number) => Promise<void> | void;
  onScene?: (index: number, scene: { description: string; status: "drawing" | "ready" | "failed" | "skipped"; imageUrl?: string | null }, spentUsd: number) => Promise<void> | void;
  cost?: (entry: { step: "plan" | "scene"; index?: number; usd: number; model: string; inputTokens?: number; outputTokens?: number; calls?: number; estimated: boolean }) => Promise<void> | void;
};
export async function runTeaser(input: TeaserInput, io: TeaserIo, cap = TEASER_CAP_USD) {
  const budget = teaserBudget(input, cap);
  if (!canSpend(0, budget.planMax, cap)) return { ok: false as const, reason: "over_cap_before_start", spentUsd: 0, budget };
  let spent = 0;
  const written = await io.writePlan(input);
  spent = Number((spent + written.usd).toFixed(6));
  await io.cost?.({ step: "plan", usd: written.usd, model: written.model, inputTokens: written.inputTokens, outputTokens: written.outputTokens, calls: written.calls ?? 1, estimated: true });
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
