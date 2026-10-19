// Content Machine: the Zyvo brand account (content lane "zyvo", owner 2026-10-19). Product-forward carousels that
// show what Zyvo does. Honesty: every claim comes from the Zyvo fact sheet (cm_facts) and cites its fact key; only
// real Zyvo outputs from the asset library; never a generated picture; never another tool's name or features.
import { ZYVO_KINDS } from "./slides/templates.js";

// Never name competitors or other tools on the brand account (a program backstop; the compliance check covers the rest).
export const COMPETITORS = /\b(capcut|descript|eleven ?labs|invideo|pictory|synthesia|heygen|runway(ml)?|pika|sora|veo|kling|midjourney|canva|opus ?clip|submagic|veed|vidiq|tubebuddy|fliki|lumen5|clipchamp|kapwing|hailuo|seedance|luma|higgsfield|hedra|vizard|chatgpt|openai|gemini|leonardo|ideogram|dall-?e|stable diffusion)\b/i;

// How each Zyvo-lane format is built from the Zyvo slide kinds (4–6 slides: the benefit hook, proof, the CTA button).
export const ZYVO_FORMAT_GUIDE = `- feature_hero: slide 1 feature_hero (a big benefit headline, 2–3 real outputs each with a style/tool label, one callout with an arrow); then 2–4 proof slides (spotlight, style_grid, template_showcase); last cta_button.
- style_grid: slide 1 feature_hero or spotlight (the hook); a style_grid slide "Pick a look": 4–8 real outputs, each labelled with its style or template; optional spotlight; last cta_button.
- how_it_works: slide 1 feature_hero (the hook); ui_prompt with label "1" (a one-line idea typed in the prompt box); ui_checklist with label "2" (3–5 things Zyvo does, ONLY as on the fact sheet); ui_result with label "3" (one real output as the finished video); last cta_button.
- feature_spotlight: slide 1 feature_hero or spotlight; 2–4 spotlight slides, ONE feature each (real outputs of that feature + one claim from the sheet); last cta_button.
- prompt_result: slide 1 feature_hero; 2–3 prompt_result slides: the asset's RECORDED prompt (listed with the asset as prompt "…") exactly as written, then that output. Only assets with a recorded prompt; never invent a prompt; last cta_button.
- template_showcase: slide 1 feature_hero; template_showcase slides of real outputs from the short-form templates, each labelled with its template name; last cta_button.
- by_hand_vs_zyvo: slide 1 feature_hero; a by_hand slide: items = the manual steps (script, voice-over, finding visuals, editing…; time only in general words like "hours", never a made-up number), items_right = what Zyvo does instead (from the sheet); a spotlight with real outputs; last cta_button. Never name any other tool.`;

// "not_feature" facts are what Zyvo does NOT do: listed so they're never claimed, never citable.
export const citable = (facts) => (facts ?? []).filter((f) => f.category !== "not_feature");
const factsText = (facts) => {
  const yes = citable(facts), no = (facts ?? []).filter((f) => f.category === "not_feature");
  if (!yes.length) return "(the fact sheet is empty: say nothing specific about Zyvo)";
  return [...yes.map((f) => `- [${f.key}] ${f.claim}${f.detail ? ` (${f.detail})` : ""}`),
    ...(no.length ? ["NOT FEATURES (never claim or imply these):", ...no.map((f) => `- ${f.claim}`)] : [])].join("\n");
};

/** The Zyvo lane's writer system prompt (cached). */
export function zyvoWriteSystem({ brandRules, library, assetsLine, playbook = "", trends = "", facts = [] }) {
  return `You write product carousels (TikTok / Instagram photo carousels, also cut into a Shorts/Reels video) for ZYVO'S OWN BRAND ACCOUNT. Every post shows what Zyvo does, clearly and concretely, with real Zyvo outputs. You follow the recipe (format, hook type, platform, text density, slide count) exactly.

THE ZYVO FACT SHEET (the ONLY things you may claim about Zyvo; cite them):
${factsText(facts)}

BRAND RULES (follow strictly):
${brandRules}

FORMATS:
${ZYVO_FORMAT_GUIDE}
${library.hooks?.length ? `HOOK TYPES:\n${library.hooks.map((h) => `- ${h.key}: ${h.name}. ${h.description}`).join("\n")}` : ""}

${assetsLine}
${playbook?.trim() ? `\nPLAYBOOK (what has worked for THIS account; follow it unless the recipe says otherwise):\n${playbook.trim()}\n` : ""}${trends?.trim() ? `\nTRENDS (today's scout; use only what fits, never copy anyone's content or design):\n${trends.trim()}\n` : ""}
SLIDE KINDS (use only these): ${ZYVO_KINDS.join(", ")}.
HOW TO WRITE IT:
- 4–6 slides. Slide 1 = the benefit hook (feature_hero, spotlight, style_grid or template_showcase). The middle = proof and features. The last slide = cta_button: headline (a short invitation) and body = the button text, e.g. "Make your first video →". The renderer adds tryzyvo.com, "Link in bio" and the Zyvo footer.
- Every slide except cta_button lists in fact_ids the keys of the facts its words rely on (at least one). A claim that isn't on the sheet is not allowed: no speeds, user counts, earnings, reviews, "best", "#1", no features you can't cite.
- Pictures: ONLY real outputs from the ASSET LIBRARY, in assets [{asset_id, label}] (label: the style or tool, 1–3 words, e.g. "AI Fruit Story", "Clay Rescue", "Stickman"). Never an image_prompt. asset_id stays null; tool stays null; is_zyvo is true on every slide.
- ui_prompt: prompt = a one-line idea a user would type (an idea, not a claim). ui_checklist: items = 3–5 short lines, each one a fact from the sheet. ui_result: one real output in assets.
- feature_hero: callout = one short line with the strongest proof point from the sheet (it gets an arrow).
- headline ≤ 60 characters, body ≤ 140, items ≤ 5 of ≤ 40 characters. Wrap ONE key phrase of a headline in *asterisks* for the accent colour.
- Plain, confident, second person ("you"). Never name, compare with or copy another tool or company.
- tools_checked: []. ai_label_required: false unless a picture is photoreal AI imagery.
Return only the JSON object.`;
}

const MIN_ASSETS = { feature_hero: 2, style_grid: 4, template_showcase: 2, spotlight: 1, ui_result: 1, prompt_result: 1, by_hand: 1, cta_button: 0, ui_prompt: 0, ui_checklist: 0 };
const HOOK_KINDS = ["feature_hero", "spotlight", "style_grid", "template_showcase"];

/** Program checks for a Zyvo-lane slideshow. opts: { assetRefs: Set, assetPrompts: Map(ref → prompt), factKeys: Set }. */
export function zyvoProblems(s, recipe, opts = {}) {
  const p = [];
  if (!s || !Array.isArray(s.slides)) return ["no slides"];
  const n = s.slides.length;
  if (n < 4 || n > 6) p.push(`${n} slides (the Zyvo account uses 4–6)`);
  if (!HOOK_KINDS.includes(s.slides[0]?.kind)) p.push(`slide 1 must be the benefit hook (${HOOK_KINDS.join(" / ")})`);
  if (s.slides[n - 1]?.kind !== "cta_button") p.push("the last slide must be the cta_button");
  s.slides.forEach((x, i) => {
    const at = `slide ${i + 1}`;
    if (!ZYVO_KINDS.includes(x.kind)) p.push(`${at}: ${x.kind} isn't a Zyvo-account slide kind`);
    if (!String(x.headline ?? "").trim()) p.push(`${at}: no headline`);
    if (String(x.headline ?? "").replace(/\*/g, "").length > 70) p.push(`${at}: headline too long`);
    if (String(x.body ?? "").length > 160) p.push(`${at}: text too long`);
    if ((x.items ?? []).length > 5 || (x.items_right ?? []).length > 5) p.push(`${at}: too many items`);
    if (String(x.image_prompt ?? "").trim()) p.push(`${at}: the Zyvo account shows only real Zyvo outputs (no image_prompt)`);
    if (x.tool) p.push(`${at}: no tool cards on the Zyvo account`);
    const assets = (x.assets ?? []).filter((a) => a?.asset_id);
    for (const a of assets) if (opts.assetRefs && !opts.assetRefs.has(String(a.asset_id))) p.push(`${at}: asset ${a.asset_id} is not in the library`);
    if (assets.length < (MIN_ASSETS[x.kind] ?? 0)) p.push(`${at}: ${x.kind} needs at least ${MIN_ASSETS[x.kind]} real outputs`);
    if (x.kind === "ui_prompt" && !String(x.prompt ?? "").trim()) p.push(`${at}: ui_prompt needs the typed idea (prompt)`);
    if (x.kind === "ui_checklist" && ((x.items ?? []).length < 3)) p.push(`${at}: ui_checklist needs 3–5 lines`);
    if (x.kind === "prompt_result") {
      const known = assets[0] ? opts.assetPrompts?.get(String(assets[0].asset_id)) : null;
      if (!known) p.push(`${at}: prompt_result only with an asset whose real prompt is recorded`);
      else if (String(x.prompt ?? "").trim() !== known.trim()) p.push(`${at}: the prompt must be the asset's recorded prompt, exactly`);
    }
    if (x.kind !== "cta_button") {
      const keys = (x.fact_ids ?? []).filter(Boolean);
      if (!keys.length) p.push(`${at}: cite the fact(s) it relies on (fact_ids)`);
      for (const k of keys) if (opts.factKeys && !opts.factKeys.has(String(k))) p.push(`${at}: fact ${k} is not on the fact sheet`);
    }
    const words = [x.headline, x.body, x.label, x.callout, x.prompt, ...(x.items ?? []), ...(x.items_right ?? []), ...(x.assets ?? []).map((a) => a?.label)].join(" ");
    const hit = COMPETITORS.exec(words);
    if (hit) p.push(`${at}: names another tool ("${hit[0]}"): never on the Zyvo account`);
  });
  if (!Number.isInteger(s.virality_score) || s.virality_score < 1 || s.virality_score > 10) p.push("virality_score out of 1–10");
  return p;
}

/** The compliance instructions the packager adds for a Zyvo-lane post (it also gets the fact sheet). */
export function zyvoComplianceText(facts) {
  return `THIS IS ZYVO'S BRAND ACCOUNT. THE ZYVO FACT SHEET (every claim about Zyvo on the slides and in your captions must match one of these; anything else is a problem):
${factsText(facts)}
Also a problem: naming or comparing with any other tool or company; a picture that isn't a real Zyvo output; a number or time saving not on the sheet.`;
}

/** A dry run's Zyvo-lane slideshow (no model called). */
export function mockZyvoSlideshow(recipe, assets = [], facts = []) {
  const a = assets.slice(0, 4).map((x) => ({ asset_id: x.ref, label: x.tool ? x.tool.replace(/_/g, " ") : "Zyvo" }));
  const f = facts.slice(0, 1).map((x) => x.key);
  const S = (kind, headline, extra = {}) => ({ kind, headline, body: null, label: null, items: [], items_right: [], tool: null, image_prompt: null, asset_id: null, assets: [], prompt: null, callout: null, fact_ids: f, is_zyvo: true, ...extra });
  return {
    title: `DRY RUN · Zyvo · ${recipe.format}`, topic: recipe.topic ?? "dry run", hook: "DRY RUN hook", hypothesis: `dry run: ${recipe.format}`,
    slides: [
      S("feature_hero", "DRY RUN: one idea in, a *finished video* out", { assets: a.slice(0, 3), callout: "Mocked: nothing was spent" }),
      S("spotlight", "Example feature", { assets: a.slice(0, 1), body: "A placeholder line." }),
      S("ui_prompt", "Type one idea", { label: "1", prompt: "A day in the life of a medieval baker" }),
      S("cta_button", "Try it", { body: "Make your first video →", fact_ids: [] }),
    ],
    tools_checked: [], ai_label_required: false, why_it_could_go_viral: "dry run", virality_score: 5,
  };
}
