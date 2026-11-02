// Zyvo Studio: the script writer, for the worker's jobs (owner, 2026-11-02). One story per video: one template per angle
// (storyTemplates.mjs), 4-6 lines that follow one thread, written like a person talking; either about the TOPIC (Zyvo only
// in the caption and on the end card) or about MAKING IT WITH ZYVO, never both. The owner approves the script before it
// renders. One model call through the Budget Guard; facts only from the fact sheet or the creation itself. A2 really asks
// Claude first and logs the prompt and the answer in the script.
import fs from "node:fs";
import path from "node:path";
import { createMessage, estimateUsd } from "file:///C:/Users/Public/Zylo-contentmachine/supabase/functions/_shared/contentMachine/providers/anthropic.js";
import { assembleStory, validateStory, validateThread, similarity, CTA_LINES, STICKER_SPOTS } from "./storyScripts.mjs";
import { templateFor } from "./storyTemplates.mjs";

const MODEL = process.env.STUDIO_WRITER_MODEL ?? "claude-sonnet-5-5";
const OPENER_TONE = "\"Honestly!\" he burst out, loud, worked up and emotional, right away:";
// What each template is and which real screens exist for it (scripts/studio: src_work/screens_<template>)
const TEMPLATES = {
  ai_fruit_story: { name: "AI Fruit Story", screens: { s_menu: "Home menu, Short Form > AI Fruit Story", s_ideas: "ready ideas", s_length: "length + the credit cost shown up front", s_pictures: "checking scene pictures", s_anim: "clips animating", s_final: "the finished video", typed: "this creation's idea typed in" } },
  blocky_stories: { name: "Blocky Stories", screens: { s_menu: "Home menu, Short Form > Blocky Stories", s_input: "the start screen: pick an idea, describe it or paste a script", typed: "this creation's story typed in" } },
  cutaway: { name: "Cutaway Explainer", screens: { s_menu: "Home menu, Short Form > Cutaway Explainer", s_input: "the topic box, premade topics, 30 or 60 seconds", typed: "this creation's topic typed in" } },
  long_form: { name: "Long Form", screens: { s_menu: "Home menu, Long Form", s_input: "start with a topic, or discover ideas", typed: "this creation's topic typed in" } },
};
const VISUAL = { type: ["object", "null"], additionalProperties: false, required: ["kind", "text", "sub", "value", "label", "n", "title", "from"], properties: {
  kind: { type: "string", enum: ["sign", "roll", "tag", "clock", "timeline", "bubble", "trophy", "tiles", "idea", "typed_result"] },
  text: { type: ["string", "null"] }, sub: { type: ["string", "null"] }, value: { type: ["number", "null"] }, label: { type: ["string", "null"] }, n: { type: ["integer", "null"] }, title: { type: ["string", "null"] }, from: { type: ["string", "null"] },
} };
const LINE = { type: "object", additionalProperties: false, required: ["who", "text", "key", "expr", "pose", "shot", "visual", "screen", "sticker", "stamp", "keep"], properties: {
  who: { type: "string", enum: ["creator", "zee"] }, text: { type: "string" }, key: { type: "string" },
  expr: { type: "string", enum: ["neutral", "happy", "sad", "shocked", "smug", "thinking"] },
  pose: { type: "string", enum: ["rest", "point", "pointUp", "pointUpL", "shrug", "handsUp", "wave", "chin"] },
  shot: { type: "string", enum: ["two_shot", "creator_close", "zee_close", "low_hero", "high_wide", "side_left", "side_right", "prop_focus"] },
  visual: VISUAL, screen: { anyOf: [{ type: "string", enum: ["s_menu", "s_ideas", "s_input", "s_length", "s_pictures", "s_anim", "s_final", "typed"] }, { type: "null" }] }, sticker: { type: ["string", "null"] }, stamp: { type: ["string", "null"] }, keep: { type: "boolean" },
} };
const SCHEMA = { type: "object", additionalProperties: false, required: ["title", "search_title", "caption", "hashtags", "hook_type", "headline", "chip", "lines", "clip_after", "end_line", "end_chip"], properties: {
  title: { type: "string" }, search_title: { type: "string" }, caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, hook_type: { type: "string" },
  headline: { type: "string" }, chip: { type: "string" }, lines: { type: "array", items: LINE }, clip_after: { type: "integer" }, end_line: { type: "string" }, end_chip: { type: "string" },
} };

const SYSTEM = (facts, tpl, mode) => `You write one short vertical video, spoken by two 3D characters: "creator", an ordinary person, and "zee", a calm, funny friend who knows things.

Write it like two people actually talking. It is ONE story: one thread from the first line to the last, where every line answers or follows from the line before it. Read it aloud in your head: if a line feels like a jump, or could go without anyone noticing, cut it. Short, plain words. No lists of tips, no slogans.

${mode === "topic"
    ? `This video is about the TOPIC. Every spoken line is about the topic. Never say Zyvo or Zee aloud, and never talk about tools, apps or how the video was made. Zyvo appears only in "caption" (say once, plainly, that it was made with Zyvo) and on an end card added for you. App screens are not used: "screen" is null on every line.`
    : `This video is about MAKING IT WITH ZYVO. Every spoken line is about that: what you want, what you do, what comes out. Don't drift into the subject of the video itself. Say what Zyvo is in plain words where it comes up in the thread, and use only these claims about it: ${facts}. A fact about one tool is NOT a fact about another: this video is about ${tpl.name}. Video on Zyvo needs a paid plan: if price comes up, say so. Screens available: ${Object.entries(tpl.screens).map(([k, v]) => `${k} (${v})`).join(", ")}; menu and button names go in "sticker", not in speech.`}

Line 1 is the creator, at most 10 words, with an instant feeling, and it opens the thread the rest follows. It never says Zyvo or Zee, is never "How to…" or "How do I…", and doesn't start with "Wait", "So" or "Okay". Use expr "shocked" or "sad". Give line 1 a null visual; the real picture is added. The how-to phrase goes in "caption" and "search_title" for search.

Honesty, always: only true things. No invented numbers, view counts, users, hours, money, reviews or testimonials. Name Claude, ChatGPT, Gemini, CapCut, TikTok or YouTube only in true statements, and never imply a partnership. Say facts about the topic only if the creation's own words below say them; an opinion is stamped "My read, not a study." The creation shown is a finished one; don't say it was made in a certain time.

Each line after the first shows something: a prop ("visual"), or "keep": true to stay on the line before (short reactions). Props: sign {text, sub}; tag {text, sub}; clock {text}; timeline {text}; bubble {text, from}; trophy {text}; tiles (the creation's real pictures); idea {n, title, text}; typed_result (what was typed next to what came out; filled in for you, leave its text null). Prop text is 1-5 words. Vary "shot".

Numbers as words. "key" is one word of the line, spelled as in the line. headline: 2-5 words in capitals, the key word between asterisks, no Zyvo, not a copy of line 1. chip: 2-4 words. clip_after: the 0-based index of the line after which the real clip plays. end_line: the last line, spoken by zee, ONE end trigger of the kind asked for, carrying on the same thread${mode === "topic" ? "" : ""}. end_chip: 2-4 capitals. caption: natural, with the search phrase. search_title: what someone would type in search.`;

/** What fits a length bucket: the real clip's seconds and the spoken words left beside it (about 2.6 words a second). */
export const lengthBudget = (bucket) => { const top = parseInt(String(bucket).split("-")[1], 10) || 60, clip = Math.round(Math.min(20, top * 0.3)); return { clip, words: Math.round((top - clip) * 2.6) }; };
const brief = (recipe, T, kit, clipText, prior, a2) => { const length = recipe.length_bucket, most = recipe.length_bucket === "60-90" ? 12 : 6; return `Write one video about ${T.about}.
The thread, line by line (the lines may differ, the thread may not):
${T.shape.map((s, i) => `${i + 1}. ${s}`).join("\n")}
That is 4 to ${most} lines in total, counting end_line. At most ${lengthBudget(length).words} spoken words in total, counting end_line: aim for ${lengthBudget(length).words - 6}. End trigger: ${recipe.end_trigger}.${length === "15-25" ? " The last words lead naturally back into line 1, so the video loops." : ""}
The real creation: "${kit.story.title}" (idea: ${kit.story.idea_text}). All its words, in order: ${kit.moments.shots.filter((s) => !s.brand).map((s) => `"${s.text}"`).join(" ")}
The clip the viewer sees at [clip] says: "${clipText}". The line before it must set up exactly that, and the line after it must react to exactly that.
${a2 ? `This video reports a REAL exchange with Claude. Prompt: "${a2.prompt}" Claude answered: "${a2.answer}". Quote it faithfully and do not add to what it said.` : ""}
${prior.length ? `Don't reuse these lines from recent videos: ${prior.slice(0, 40).map((x) => `"${x}"`).join(" ")}` : ""}`; };

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

/** The real clip: whole shots from the first fresh one, up to the length; a clip never stops mid-sentence if it can help it. */
function pickClip(fresh, limit) {
  const a = fresh[0]; let b = a;
  for (const s of fresh) { if (s.b - a.a <= limit) b = s; else break; }
  const out = b.b - a.a >= 3 ? b.b - 0.04 : Math.min(a.b - 0.04, a.a + limit);
  return { in: +(a.a + 0.02).toFixed(2), out: +out.toFixed(2), text: fresh.filter((s) => s.a >= a.a && s.b <= out + 0.1).map((s) => s.text).join(" ") || a.text };
}

/** What the next attempt is told: the rejected draft itself, so it can cut or fix that one instead of writing another blind. */
export const revisionNote = (problems, draft) => `\nYour last draft was rejected: ${problems.join("; ")}. Fix that and change as little else as you can. The draft, line by line:\n${draft.lines.map((l) => `${l.who}: ${l.say ?? l.text}`).join("\n")}`;

/** Writes and checks one script. Returns {script, usd}. recent: scripts of the batch and the last 14 days. */
export async function writeStory({ guard, apiKey, facts, recipe: asked, angle, kit, kitKey, recent = [], spots = {} }) {
  // 15-25 s by default, whatever length the angle had; a long tutorial only when asked for (owner, 2026-11-02)
  const recipe = { ...asked, length_bucket: asked.length_bucket === "60-90" ? "60-90" : "15-25" };
  const factText = facts.map((f) => f.claim).join("; "), tpl = TEMPLATES[kit.template] ?? TEMPLATES.ai_fruit_story, T = templateFor(recipe.angle);
  const prior = recent.flatMap((s) => s.lines.map((l) => l.text));
  // the reuse rule: different clips and never the same opening shot as an earlier video of this creation
  const shown = recent.filter((s) => s.source_story === kit.story.id).flatMap((s) => (s.clips ?? []).map((c) => [c.in, c.out]));
  const fresh = kit.moments.shots.filter((s) => !s.brand && !shown.some(([a, b]) => s.a < b && s.b > a));
  if (fresh.length < 1) throw new Error("no clip of this creation is left unshown: pick another creation");
  const clip = pickClip(fresh, lengthBudget(recipe.length_bucket).clip);
  let usd = 0, a2 = null, lastProblems = [], lastDraft = null;
  if (recipe.angle === "A2") { a2 = await askClaude({ guard, key: apiKey, kit }); usd += a2.usd; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = brief(recipe, T, kit, clip.text, prior, a2) + (lastDraft ? revisionNote(lastProblems, lastDraft) : "");
    const r = await guard.spend("anthropic", "studio.write_script", estimateUsd({ model: MODEL, inputTokens: 3000, outputTokens: 2500 }), async (ticket) => {
      const out = await createMessage(ticket, { apiKey, request: { model: MODEL, max_tokens: 6000, system: SYSTEM(factText, tpl, T.mode), messages: [{ role: "user", content: user }], output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } } } });
      return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
    }, { lane: "studio", live: true });
    usd += r.actualUsd ?? 0;
    const w = JSON.parse(r.result.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    const script = assembleWritten(w, recipe, kit, kitKey, clip, T.mode, spots);
    if (a2) script.claude_log = a2;
    lastProblems = [...validateStory(script), ...validateThread(script)];
    const sim = similarity([script, ...recent]).filter((x) => x.a === script.variant && x.share > 0.3);
    if (sim.length) lastProblems.push(`it shares over 30% of its lines with ${sim[0].b}`);
    const said = script.lines.reduce((a, l) => a + (l.say ?? l.text).trim().split(/\s+/).length, 0), budget = lengthBudget(recipe.length_bucket).words;
    if (said > budget * 1.1) lastProblems.push(`it has ${said} spoken words, too long for ${recipe.length_bucket} seconds: at most ${budget}, so cut at least ${said - budget} words`);
    if (!lastProblems.length) return { script, usd };
    lastDraft = script;
  }
  throw new Error(`the script failed its checks: ${lastProblems.join("; ").slice(0, 300)}`);
}

function assembleWritten(w, recipe, kit, kitKey, clip, mode, spots = {}) {
  const n = w.lines.length;
  const lines = w.lines.map((l, i) => {
    const out = { who: l.who, text: l.text, key: [l.key], expr: l.expr, pose: l.pose, shot: l.shot, role: `l${i}` };
    if (i === 0) Object.assign(out, { tone: OPENER_TONE, shot: "face_hook", expr: l.expr === "sad" ? "sad" : "shocked" });
    if (l.text.trim().split(/\s+/).length <= 4) out.cues = [{ word: 0, event: `react${i}`, sfx: { shocked: "react_up", sad: "react_down" }[l.expr] ?? "react_pop" }];
    if (l.stamp) out.stamp = l.stamp;
    if (l.keep && !l.visual && !l.screen) out.keep = true;
    // frame 0: a big face + the creation's real picture, whole at once (no pop-in)
    if (i === 0) { delete out.keep; out.visual = { kind: "tiles", images: [`/work/media/${path.basename(kit.scene_images[0])}`], wide: !!kit.wide, w: 1.85, crop: !kit.wide, instant: true, up: 1.03 }; return out; }
    if (l.screen) { const spot = spots[l.screen] ?? STICKER_SPOTS[l.screen] ?? { x: 0.5, y: 0.5, ty: 0.1 }; out.screen = { file: l.screen === "typed" ? "typed.jpg" : `${l.screen}.jpg`, sticker: l.sticker ? { text: l.sticker, ...spot } : null }; }
    else if (l.visual) {
      const v = Object.fromEntries(Object.entries(l.visual).filter(([, x]) => x != null));
      if (/^(creator|zee)$/i.test(v.from ?? "")) delete v.from;   // not a label a viewer should read
      if (v.kind === "tiles") v.images = kit.scene_images.slice(0, 3).map((p) => `/work/media/${path.basename(p)}`);
      if (v.kind === "typed_result") Object.assign(v, { text: String(kit.story.idea_text).slice(0, 80), image: `/work/media/${path.basename(kit.scene_images[Math.min(1, kit.scene_images.length - 1)])}`, wide: !!kit.wide, scale: 0.8 });
      out.visual = v;
    }
    return out;
  });
  const short = recipe.length_bucket === "15-25";
  const clips = [{ name: "payoff", file: kit.file, in: clip.in, out: clip.out, text: clip.text, hq_dir: kit.hq_dir, hq_ext: kit.hq_ext, wide: !!kit.wide, fullscreen: true, enter: "grow", pre: 0.5, post: 0.1, duck_db: 14, after_line: Math.max(0, Math.min(n - 1, w.clip_after)), pays_loop: true }];
  const c = CTA_LINES(recipe.end_trigger, w.end_line, w.end_chip);
  // the end card: Zyvo only here (and in the caption) when the video is about the topic
  c.line.shot = "two_shot"; c.line.visual = mode === "topic" ? { kind: "sign", text: "Made with Zyvo", sub: "tryzyvo.com" } : { kind: "sign", text: "tryzyvo.com", sub: "link in bio" };
  return assembleStory(`job_${recipe.angle}_${Date.now().toString(36)}`, {
    title: w.title, template: kit.template, world: recipe.world, music_bpm: 120, music_shift: 0, music_style: "none", no_lead: true, first_second: true, story_mode: mode, tail: short ? 0.15 : 0.5, energy: { reveal_lines: [], reveal_clips: ["payoff"] }, creation: kitKey,
    recipe: { angle: recipe.angle, hook_type: w.hook_type, length_bucket: recipe.length_bucket, famous_name: !!recipe.famous_name, end_trigger: recipe.end_trigger, story_mode: mode },
    headline: { text: w.headline, chip: w.chip, secs: short ? 2.5 : 4, size: 50 }, lines, clips, end: c,
    search_title: w.search_title, caption: w.caption, hashtags: w.hashtags,
  }, { [kitKey]: kit }, kit.story.id);
}

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
