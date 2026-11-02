// Zyvo Studio: the script writer v2 (Master Prompt v2), for the worker's jobs. One model call through the Budget Guard:
// a viewer-problem hook, a visual for every line, the viewer's objections, a tip most people skip, an early and a big
// payoff, one end trigger. Facts only from the fact sheet, the creation itself, or stamped as opinion. A script that fails
// the checks (no visual, the friend rules, too similar to a recent one) is rewritten, then the job fails.
// A2 (famous-AI bridge) really asks Claude first and logs the prompt and the answer in the script.
// The friend rules (owner, 2026-11-02, content/studio-notes/LEARNINGS.md): line 1 is a disappointed "Zyvo…" + the problem;
// what Zyvo is in plain words before any step; at most 3 big moments; "what I typed" next to "what came out"; and a
// fast model that reads only the transcript must be able to say what Zyvo is and what to do next (one rewrite if not).
import fs from "node:fs";
import path from "node:path";
import { createMessage, estimateUsd } from "file:///C:/Users/Public/Zylo-contentmachine/supabase/functions/_shared/contentMachine/providers/anthropic.js";
import { assembleStory, validateStory, validateFriend, similarity, CTA_LINES, STICKER_SPOTS } from "./storyScripts.mjs";

const MODEL = process.env.STUDIO_WRITER_MODEL ?? "claude-sonnet-5-5";
const FAST_MODEL = process.env.STUDIO_FAST_MODEL ?? "claude-haiku-5-5";
const OPENER_TONE = "\"Ugh,\" he sighed, disappointed and frustrated, and said in a let-down voice:";
// What each template is and which real screens exist for it (scripts/studio: src_work/screens_<template>)
const TEMPLATES = {
  ai_fruit_story: { name: "AI Fruit Story", screens: { s_menu: "Home menu, Short Form > AI Fruit Story", s_ideas: "ready ideas", s_length: "length + the credit cost shown up front", s_pictures: "checking scene pictures", s_anim: "clips animating", s_final: "the finished video", typed: "this creation's idea typed in" } },
  blocky_stories: { name: "Blocky Stories", screens: { s_menu: "Home menu, Short Form > Blocky Stories", s_input: "the start screen: pick an idea, describe it or paste a script", typed: "this creation's story typed in" } },
  cutaway: { name: "Cutaway Explainer", screens: { s_menu: "Home menu, Short Form > Cutaway Explainer", s_input: "the topic box, premade topics, 30 or 60 seconds", typed: "this creation's topic typed in" } },
  long_form: { name: "Long Form", screens: { s_menu: "Home menu, Long Form", s_input: "start with a topic, or discover ideas", typed: "this creation's topic typed in" } },
};
const VISUAL = { type: ["object", "null"], additionalProperties: false, required: ["kind", "text", "sub", "value", "label", "n", "title", "from"], properties: {
  kind: { type: "string", enum: ["sign", "roll", "tag", "clock", "timeline", "bubble", "conveyor", "trophy", "tiles", "idea", "typed_result"] },
  text: { type: ["string", "null"] }, sub: { type: ["string", "null"] }, value: { type: ["number", "null"] }, label: { type: ["string", "null"] }, n: { type: ["integer", "null"] }, title: { type: ["string", "null"] }, from: { type: ["string", "null"] },
} };
const LINE = { type: "object", additionalProperties: false, required: ["who", "text", "key", "expr", "pose", "shot", "visual", "screen", "sticker", "stamp", "keep"], properties: {
  who: { type: "string", enum: ["creator", "zee"] }, text: { type: "string" }, key: { type: "string" },
  expr: { type: "string", enum: ["neutral", "happy", "sad", "shocked", "smug", "thinking"] },
  pose: { type: "string", enum: ["rest", "point", "pointUp", "pointUpL", "shrug", "handsUp", "wave", "chin"] },
  shot: { type: "string", enum: ["two_shot", "creator_close", "zee_close", "low_hero", "high_wide", "side_left", "side_right", "prop_focus"] },
  visual: VISUAL, screen: { anyOf: [{ type: "string", enum: ["s_menu", "s_ideas", "s_input", "s_length", "s_pictures", "s_anim", "s_final", "typed"] }, { type: "null" }] }, sticker: { type: ["string", "null"] }, stamp: { type: ["string", "null"] }, keep: { type: "boolean" },
} };
const SCHEMA = { type: "object", additionalProperties: false, required: ["title", "search_title", "caption", "hashtags", "hook_type", "headline", "chip", "lines", "big_moments", "early_payoff_after", "big_payoff_after", "end_line", "end_chip"], properties: {
  big_moments: { type: "array", items: { type: "integer" } },
  title: { type: "string" }, search_title: { type: "string" }, caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, hook_type: { type: "string" },
  headline: { type: "string" }, chip: { type: "string" }, lines: { type: "array", items: LINE }, early_payoff_after: { type: ["integer", "null"] }, big_payoff_after: { type: "integer" }, end_line: { type: "string" }, end_chip: { type: "string" },
} };

const SYSTEM = (facts, tpl) => `You write scripts for short vertical videos on Zyvo's own account (Zyvo makes AI videos). Two 3D characters talk on a bright set: "creator", the viewer's stand-in, confused and expressive, who asks the viewer's questions and objections; and "zee", a calm, funny expert.

THE OPENING overrides the angle's shape for line 1. Line 1 is the creator, let down and frustrated, starting with the AI's name and an ellipsis, then the problem in the same breath: "Zyvo… why does my video look like everyone else's?" or "Zee… I've been trying for hours." An instant emotion and a problem in the first second. Use expr "sad" or "shocked" and the shot "creator_close". Say "Claude…" instead ONLY when the video is really about using Claude (angle A2). The frustration must be true to life and carry no invented number: no made-up view counts, hours or money. The headline names the viewer's problem and has no Zyvo in it.

EXPLAIN LIKE A FRIEND. The viewer has never heard of Zyvo and doesn't know the words. Within the first 3 lines, before any step or screen, Zee says what Zyvo is in plain words, using the words website and video: Zyvo is a website where you type an idea and it makes the whole video for you. Steps are what you do and why, in everyday words. Menu and button names go ONLY in "sticker"; never speak them (never say "Short Form", "Long Form", "Blocky Stories", "AI Fruit Story", "Cutaway Explainer", "sidebar" or "menu"; say "the explainer one" or "the blocky one" instead). The creator asks at least 2 of the viewer's confused questions in their own words ("Wait, what's that?", "But I can't edit, so what do I do?"); Zee answers simply, and any new idea gets an everyday comparison ("it's like..."). Say the cost honestly and plainly when price comes up. Include "the mistake everybody makes" or "the tip most people skip".

At most 3 big moments: "big_moments" is the 0-based indexes of 1 or 2 lines that are real reveals (the music cuts out before them and a bass hit lands on them); the real clip is one more. Exactly one line uses the visual "typed_result" (what I typed next to what came out; its words and picture are filled in with the real ones, so leave its text null). Keep other lines plain so those moments stand out. Add reactions: short lines of 1-4 words from the creator ("Wait, what?", "That's it?") with a matching expr; each gets a sound. Just before the end, one short joke that calls back to line 1.

THE STORY: viewer problem -> Zyvo as the answer ("Made with Zyvo. tryzyvo.com, link in bio." is added for you, so do not write it).

Structure: the opening -> what Zyvo is -> stakes and a promise ("the last one is what most people skip") -> escalating answers, one piece of information every 3-5 seconds -> the creator's objections -> a tip most people skip -> an early glimpse of the real result within about 15 seconds -> the big real result near the end.

Every line MUST have a visual that SHOWS it: a prop ("visual"), a real app screen ("screen" with a short "sticker"), or "keep": true to stay on the previous line's visual (short reactions only). Props: sign {text, sub}; roll {value, label} (a number rolling up, only real numbers); tag {text, sub}; clock {text}; timeline {text} (a messy edit collapsing into one button); bubble {text, from}; conveyor {text} (an idea becoming a video); trophy {text}; tiles (the creation's real pictures); idea {n, title, text}; typed_result (what I typed next to what came out). Prop text must be 1-5 words so it reads on a phone. Screens available (use ONLY these): ${Object.entries(tpl.screens).map(([k, v]) => `${k} (${v})`).join(", ")}. Vary "shot" (at least 4 different ones); never the same shot for more than 2 lines in a row.

Honesty, always:
- Claims about Zyvo ONLY from this fact sheet: ${facts}
- A number that is not on the sheet needs a real source in "stamp"; an opinion is stamped "My read, not a study." Never invent numbers, users, reviews or testimonials.
- A fact about one tool is NOT a fact about another: this video is about ${tpl.name}.
- Video on Zyvo needs a paid plan: if price comes up, say so.
- Name Claude, ChatGPT, Gemini, CapCut, TikTok or YouTube only in true statements; never imply a partnership.
- The story shown is a finished one; do not say it was made in a certain time.

Write spoken lines short and natural, about 8-16 words, 170-190 words per minute when spoken. Numbers as words ("a hundred and fifty"). "key" is one word of the line, spelled as in the line, to colour in the caption. headline: a bold question or promise of at most 7 words in capitals with the key words between asterisks, and no Zyvo. chip: 2-4 words. early_payoff_after and big_payoff_after: the 0-based index of the line after which the real clip plays (early may be null in short videos). end_line: ONE end trigger of the kind asked for. end_chip: 2-4 capitals. caption: a natural caption with the search phrase. search_title: what someone would type in search.`;

/** What fits a length bucket: the real clip's seconds and the spoken words left beside it (about 2.6 words a second). */
export const lengthBudget = (bucket) => { const top = parseInt(String(bucket).split("-")[1], 10) || 60, clip = Math.round(Math.min(20, top * 0.3)); return { clip, words: Math.round((top - clip) * 2.6) }; };
const brief = (recipe, angle, kit, length, prior, a2) => `Write one video.
Angle ${angle.key}, "${angle.name}": ${angle.viewer_gets}. Zyvo's role: ${angle.zyvo_role}. Shape: ${angle.structure}.
Example hooks (patterns; write a NEW one): ${(angle.hooks ?? []).join(" | ")}
Length: ${length} seconds in total: at most ${lengthBudget(length).words - 15} spoken words in "lines" (the real clip, the closing line and the end trigger take the rest). End trigger: ${recipe.end_trigger}.
The real creation it shows: "${kit.story.title}" (${kit.story.length_sec} s, idea: ${kit.story.idea_text}). Its lines, in order: ${kit.moments.shots.filter((s) => !s.brand).map((s) => `"${s.text}"`).join(" ")}
${a2 ? `This video reports a REAL exchange with Claude. Prompt: "${a2.prompt}" Claude answered: "${a2.answer}". Quote it faithfully and do not add to what it said.` : ""}
${prior.length ? `Do NOT reuse these hooks or lines from recent videos: ${prior.slice(0, 40).map((x) => `"${x}"`).join(" ")}` : ""}`;

/** A real question to Claude for an A2 video: its answer becomes part of the script, and both are logged. */
async function askClaude({ guard, key, kit }) {
  const prompt = `I want to make a short AI drama video about this idea: "${kit.story.idea_text}". In one honest sentence: would you bet on it going viral on TikTok, and why?`;
  const r = await guard.spend("anthropic", "studio.a2_question", 0.002, async (ticket) => {
    const out = await createMessage(ticket, { apiKey: key, request: { model: MODEL, max_tokens: 200, messages: [{ role: "user", content: prompt }] } });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, { lane: "studio", live: true });
  const answer = r.result.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return { prompt, answer, model: MODEL, asked_at: new Date().toISOString(), usd: r.actualUsd ?? 0 };
}

const FRESH_SCHEMA = { type: "object", additionalProperties: false, required: ["what_is_zyvo", "what_next"], properties: { what_is_zyvo: { type: ["string", "null"] }, what_next: { type: ["string", "null"] } } };
/** Passes when a stranger could say that Zyvo makes videos, and where to go next. */
export const freshPasses = (a) => /\bvideos?\b/i.test(a?.what_is_zyvo ?? "") && /\b(zyvo|tryzyvo|link|bio|website|site)\b/i.test(a?.what_next ?? "");
/** The fresh viewer: a fast model that sees only the words of the video. */
async function freshViewer({ guard, apiKey, script }) {
  const transcript = script.lines.map((l) => l.text).join("\n");
  const r = await guard.spend("anthropic", "studio.fresh_viewer", estimateUsd({ model: FAST_MODEL, inputTokens: 700, outputTokens: 120 }), async (ticket) => {
    const out = await createMessage(ticket, { apiKey, request: { model: FAST_MODEL, max_tokens: 300, system: "You have never heard of Zyvo. You get only the transcript of a short video. Using only what it says, answer in one short sentence each: What is Zyvo? What would you do next? If the transcript doesn't make an answer clear, give null for it.", messages: [{ role: "user", content: transcript }], output_config: { format: { type: "json_schema", schema: FRESH_SCHEMA } } } });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, { lane: "studio", live: true });
  return { answers: JSON.parse(r.result.content.filter((b) => b.type === "text").map((b) => b.text).join("")), usd: r.actualUsd ?? 0 };
}

/** Writes and checks one script. Returns {script, usd}. recent: scripts of the batch and the last 14 days. */
export async function writeStory({ guard, apiKey, facts, recipe, angle, kit, kitKey, recent = [], spots = {} }) {
  const factText = facts.map((f) => f.claim).join("; "), tpl = TEMPLATES[kit.template] ?? TEMPLATES.ai_fruit_story;
  const prior = recent.flatMap((s) => s.lines.map((l) => l.text));
  // the reuse rule: different clips and never the same opening shot as an earlier video of this creation
  const shown = recent.filter((s) => s.source_story === kit.story.id).flatMap((s) => (s.clips ?? []).map((c) => [c.in, c.out]));
  let usd = 0, a2 = null, lastProblems = [], freshFailed = false;
  if (recipe.angle === "A2") { a2 = await askClaude({ guard, key: apiKey, kit }); usd += a2.usd; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = brief(recipe, angle, kit, recipe.length_bucket, prior, a2) + (lastProblems.length ? `\nYour last draft was rejected: ${lastProblems.join("; ")}. Fix that.` : "");
    const r = await guard.spend("anthropic", "studio.write_script", estimateUsd({ model: MODEL, inputTokens: 3000, outputTokens: 2500 }), async (ticket) => {
      const out = await createMessage(ticket, { apiKey, request: { model: MODEL, max_tokens: 6000, system: SYSTEM(factText, tpl), messages: [{ role: "user", content: user }], output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } } } });
      return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
    }, { lane: "studio", live: true });
    usd += r.actualUsd ?? 0;
    const w = JSON.parse(r.result.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    const script = assembleWritten(w, recipe, kit, kitKey, shown, spots);
    if (a2) script.claude_log = a2;
    lastProblems = [...validateStory(script), ...validateFriend(script)];
    const sim = similarity([script, ...recent]).filter((x) => x.a === script.variant && x.share > 0.3);
    if (sim.length) lastProblems.push(`it shares over 30% of its lines with ${sim[0].b}`);
    const said = script.lines.reduce((a, l) => a + (l.say ?? l.text).trim().split(/\s+/).length, 0), budget = lengthBudget(recipe.length_bucket).words;
    if (said > budget * 1.1) lastProblems.push(`it has ${said} spoken words, too long for ${recipe.length_bucket} seconds: at most ${budget}`);
    if (lastProblems.length) continue;
    const fresh = await freshViewer({ guard, apiKey, script });
    usd += fresh.usd; script.fresh_viewer = { ...fresh.answers, model: FAST_MODEL, rewritten: freshFailed };
    if (freshPasses(fresh.answers)) return { script, usd };
    if (freshFailed) throw new Error(`the fresh-viewer check failed after one rewrite: ${JSON.stringify(fresh.answers).slice(0, 240)}`);
    freshFailed = true;
    lastProblems = [`someone reading only the transcript answered "What is Zyvo?" with ${JSON.stringify(fresh.answers.what_is_zyvo)} and "What would you do next?" with ${JSON.stringify(fresh.answers.what_next)}. Say plainly that Zyvo is a website that makes videos, and where to go`];
  }
  throw new Error(`the script failed its checks: ${lastProblems.join("; ").slice(0, 300)}`);
}

function assembleWritten(w, recipe, kit, kitKey, shown = [], spots = {}) {
  const fresh = kit.moments.shots.filter((s) => !s.brand && !shown.some(([a, b]) => s.a < b && s.b > a));
  if (fresh.length < 1) throw new Error("no clip of this creation is left unshown: pick another creation");
  // short on fresh shots: one payoff only; each stays under a sensible length
  const shots = fresh.length >= 2 ? fresh : [fresh[0], fresh[0]], payoff = (name, a, b, after, extra = {}) => ({ name, file: kit.file, in: +(a.a + 0.02).toFixed(2), out: +Math.min(b.b - 0.04, a.a + lengthBudget(recipe.length_bucket).clip).toFixed(2), hq_dir: kit.hq_dir, hq_ext: kit.hq_ext, wide: !!kit.wide, fullscreen: true, enter: "grow", pre: 0.5, post: 0.1, duck_db: 14, after_line: after, ...extra });
  const n = w.lines.length;
  // at most 3 big moments: the real clip + up to 2 lines; each line gets room for the music to cut out before it
  const reveal_lines = [...new Set(w.big_moments ?? [])].filter((i) => i > 0 && i < n).slice(0, 2);
  const lines = w.lines.map((l, i) => {
    const out = { who: l.who, text: l.text, key: [l.key], expr: l.expr, pose: l.pose, shot: l.shot, role: `l${i}` };
    if (i === 0) out.tone = OPENER_TONE;
    if (reveal_lines.includes(i)) out.pause_before = 0.4;
    if (l.text.trim().split(/\s+/).length <= 4) out.cues = [{ word: 0, event: `react${i}`, sfx: { shocked: "react_up", sad: "react_down" }[l.expr] ?? "react_pop" }];
    if (l.stamp) out.stamp = l.stamp;
    if (l.keep && !l.visual && !l.screen) out.keep = true;
    if (l.screen) { const spot = spots[l.screen] ?? STICKER_SPOTS[l.screen] ?? { x: 0.5, y: 0.5, ty: 0.1 }; out.screen = { file: l.screen === "typed" ? "typed.jpg" : `${l.screen}.jpg`, sticker: l.sticker ? { text: l.sticker, ...spot } : null }; }
    else if (l.visual) {
      const v = Object.fromEntries(Object.entries(l.visual).filter(([, x]) => x != null));
      if (/^(creator|zee)$/i.test(v.from ?? "")) delete v.from;   // not a label a viewer should read
      if (i === 0) Object.assign(v, { scale: 0.72, up: 0.7 });   // under the headline, which holds through the opening
      if (v.kind === "tiles") v.images = kit.scene_images.slice(0, 3).map((p) => `/work/media/${path.basename(p)}`);
      if (v.kind === "conveyor") v.image = `/work/media/${path.basename(kit.scene_images[0])}`;
      if (v.kind === "typed_result") Object.assign(v, { text: String(kit.story.idea_text).slice(0, 80), image: `/work/media/${path.basename(kit.scene_images[Math.min(1, kit.scene_images.length - 1)])}`, wide: !!kit.wide, scale: 0.8 });
      out.visual = v;
    }
    return out;
  });
  const clips = [];
  const early = shots.length > 2 && w.early_payoff_after != null && w.early_payoff_after >= 0 && w.early_payoff_after < n - 1 ? w.early_payoff_after : null;
  if (early != null) clips.push(payoff("glimpse", shots[0], shots[0], early, { post: 0.1 }));
  const big = Math.min(n - 1, Math.max(w.big_payoff_after, (early ?? -1) + 1));
  clips.push(payoff("payoff", shots[early != null ? 1 : 0], shots.at(-1), big, { pays_loop: true }));
  const c = CTA_LINES(recipe.end_trigger, w.end_line, w.end_chip);
  return assembleStory(`job_${recipe.angle}_${Date.now().toString(36)}`, {
    title: w.title, template: kit.template, world: recipe.world, music_bpm: 116 + Math.floor(Math.random() * 16), music_shift: Math.floor(Math.random() * 7) - 3, music_db_under: 7, energy: { reveal_lines, reveal_clips: ["payoff"] }, creation: kitKey,
    recipe: { angle: recipe.angle, hook_type: w.hook_type, length_bucket: recipe.length_bucket, famous_name: !!recipe.famous_name, end_trigger: recipe.end_trigger },
    headline: { text: w.headline, chip: w.chip, secs: 8 }, lines: [...lines, { ...SITE_LINE, shot: "zee_close", visual: { kind: "sign", text: "tryzyvo.com", sub: "link in bio" } }], clips, end: c,
    search_title: w.search_title, caption: w.caption, hashtags: w.hashtags,
  }, { [kitKey]: kit }, kit.story.id);
}
const SITE_LINE = { who: "zee", text: "Made with Zyvo. tryzyvo.com, link in bio.", say: "Made with Zyvo. Try zyvo dot com, link in bio.", key: ["tryzyvo.com,"], expr: "happy", pose: "point", role: "site", cues: [{ word: 3, event: "site", sfx: "sparkle" }, { word: 4, event: "bio", sfx: "pop" }] };

/** The recent scripts this laptop rendered (the batch's and the last 14 days'), for the similarity check. */
export function recentScripts(kitsDir, days = 14) {
  const out = [], cut = Date.now() - days * 864e5;
  // the hand-written first batch counts too
  const batch = new URL("./scripts/story/", import.meta.url);
  if (fs.existsSync(batch)) for (const f of fs.readdirSync(batch)) { const p = new URL(f, batch); if (f.endsWith(".json") && fs.statSync(p).mtimeMs > cut) out.push(JSON.parse(fs.readFileSync(p, "utf8"))); }
  if (!fs.existsSync(kitsDir)) return out;
  for (const k of fs.readdirSync(kitsDir)) { const j = path.join(kitsDir, k, "jobs"); if (!fs.existsSync(j)) continue;
    for (const d of fs.readdirSync(j)) { const f = path.join(j, d, "script.json"); if (fs.existsSync(f) && fs.statSync(f).mtimeMs > cut) { try { const s = JSON.parse(fs.readFileSync(f, "utf8")); if (s.recipe?.angle) out.push(s); } catch { /* a half-written file */ } } } }
  return out;
}
