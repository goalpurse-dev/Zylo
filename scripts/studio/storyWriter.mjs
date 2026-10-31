// Zyvo Studio: the script writer v2 (Master Prompt v2), for the worker's jobs. One model call through the Budget Guard:
// a viewer-problem hook, a visual for every line, the viewer's objections, a tip most people skip, an early and a big
// payoff, one end trigger. Facts only from the fact sheet, the creation itself, or stamped as opinion. A script that fails
// the checks (no visual, Zyvo in the hook, too similar to a recent one) is rewritten once, then the job fails.
// A2 (famous-AI bridge) really asks Claude first and logs the prompt and the answer in the script.
import fs from "node:fs";
import path from "node:path";
import { createMessage, estimateUsd } from "file:///C:/Users/Public/Zylo-contentmachine/supabase/functions/_shared/contentMachine/providers/anthropic.js";
import { assembleStory, validateStory, similarity, CTA_LINES, STICKER_SPOTS } from "./storyScripts.mjs";

const MODEL = process.env.STUDIO_WRITER_MODEL ?? "claude-sonnet-5-5";
const VISUAL = { type: ["object", "null"], additionalProperties: false, required: ["kind", "text", "sub", "value", "label", "n", "title", "from"], properties: {
  kind: { type: "string", enum: ["sign", "roll", "tag", "clock", "timeline", "bubble", "conveyor", "trophy", "tiles", "idea"] },
  text: { type: ["string", "null"] }, sub: { type: ["string", "null"] }, value: { type: ["number", "null"] }, label: { type: ["string", "null"] }, n: { type: ["integer", "null"] }, title: { type: ["string", "null"] }, from: { type: ["string", "null"] },
} };
const LINE = { type: "object", additionalProperties: false, required: ["who", "text", "key", "expr", "pose", "shot", "visual", "screen", "sticker", "stamp", "keep"], properties: {
  who: { type: "string", enum: ["creator", "zee"] }, text: { type: "string" }, key: { type: "string" },
  expr: { type: "string", enum: ["neutral", "happy", "sad", "shocked", "smug", "thinking"] },
  pose: { type: "string", enum: ["rest", "point", "pointUp", "pointUpL", "shrug", "handsUp", "wave", "chin"] },
  shot: { type: "string", enum: ["two_shot", "creator_close", "zee_close", "low_hero", "high_wide", "side_left", "side_right", "prop_focus"] },
  visual: VISUAL, screen: { anyOf: [{ type: "string", enum: ["s_menu", "s_ideas", "s_length", "s_pictures", "s_anim", "s_final", "typed"] }, { type: "null" }] }, sticker: { type: ["string", "null"] }, stamp: { type: ["string", "null"] }, keep: { type: "boolean" },
} };
const SCHEMA = { type: "object", additionalProperties: false, required: ["title", "search_title", "caption", "hashtags", "hook_type", "headline", "chip", "lines", "early_payoff_after", "big_payoff_after", "end_line", "end_chip"], properties: {
  title: { type: "string" }, search_title: { type: "string" }, caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, hook_type: { type: "string" },
  headline: { type: "string" }, chip: { type: "string" }, lines: { type: "array", items: LINE }, early_payoff_after: { type: ["integer", "null"] }, big_payoff_after: { type: "integer" }, end_line: { type: "string" }, end_chip: { type: "string" },
} };

const SYSTEM = (facts) => `You write scripts for short vertical videos on Zyvo's own account (Zyvo makes AI videos). Two 3D characters talk on a bright set: "creator", the viewer's stand-in, confused and expressive, who asks the viewer's questions and objections; and "zee", a calm, funny expert.

THE CORE RULE: viewer problem -> story -> Zyvo as the answer. In the first 2 seconds a stranger must see why they should care. Zyvo is NEVER in the hook or the headline; it appears at the end only ("Made with Zyvo. tryzyvo.com, link in bio." is added for you, so do not write it).

Structure: a hook (line 1 names the viewer's problem or curiosity) -> stakes and a promise ("the last one is what most people skip") -> escalating answers, one piece of information every 3-5 seconds -> the creator's objections ("But I can't edit", "Is it free?") -> a tip most people skip -> an early glimpse of the real result within about 15 seconds -> the big real result near the end.

Every line MUST have a visual that SHOWS it: a prop ("visual"), a real app screen ("screen" with a short "sticker"), or "keep": true to stay on the previous line's visual (short reactions only). Props: sign {text, sub}; roll {value, label} (a number rolling up, only real numbers); tag {text, sub}; clock {text}; timeline {text} (a messy edit collapsing into one button); bubble {text, from}; conveyor {text} (an idea becoming a video); trophy {text}; tiles (the creation's real pictures); idea {n, title, text}. Prop text must be 1-5 words so it reads on a phone. Screens: s_menu (Home menu, Short Form > AI Fruit Story), s_ideas (ready ideas), s_length (length + the credit cost shown up front), s_pictures (checking scene pictures), s_anim (clips animating), s_final (the finished video), typed (this creation's idea typed in). Vary "shot" (at least 4 different ones); never the same shot for more than 2 lines in a row.

Honesty, always:
- Claims about Zyvo ONLY from this fact sheet: ${facts}
- A number that is not on the sheet needs a real source in "stamp"; an opinion is stamped "My read, not a study." Never invent numbers, users, reviews or testimonials.
- A fact about one tool (Blocky Stories, Long Form, the image generator) is NOT a fact about another: this video is about AI Fruit Story unless told otherwise.
- Video on Zyvo needs a paid plan: if price comes up, say so.
- Name Claude, ChatGPT, Gemini, CapCut, TikTok or YouTube only in true statements; never imply a partnership.
- The story shown is a finished one; do not say it was made in a certain time.

Write spoken lines short and natural, about 8-16 words, 170-190 words per minute when spoken. Numbers as words ("a hundred and fifty"). "key" is one word of the line, spelled as in the line, to colour in the caption. headline: a bold question or promise of at most 7 words in capitals with the key words between asterisks, and no Zyvo. chip: 2-4 words. early_payoff_after and big_payoff_after: the 0-based index of the line after which the real clip plays (early may be null in short videos). end_line: ONE end trigger of the kind asked for. end_chip: 2-4 capitals. caption: a natural caption with the search phrase. search_title: what someone would type in search.`;

const brief = (recipe, angle, kit, length, prior, a2) => `Write one video.
Angle ${angle.key}, "${angle.name}": ${angle.viewer_gets}. Zyvo's role: ${angle.zyvo_role}. Shape: ${angle.structure}.
Example hooks (patterns; write a NEW one): ${(angle.hooks ?? []).join(" | ")}
Length: ${length} seconds in total (about ${Math.round(parseInt(length.split("-")[1], 10) * 2.4)} spoken words at most, the clips take the rest). End trigger: ${recipe.end_trigger}.
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

/** Writes and checks one script. Returns {script, usd}. recent: scripts of the batch and the last 14 days. */
export async function writeStory({ guard, apiKey, facts, recipe, angle, kit, kitKey, recent = [] }) {
  const factText = facts.map((f) => f.claim).join("; ");
  const prior = recent.flatMap((s) => s.lines.map((l) => l.text));
  let usd = 0, a2 = null, lastProblems = [];
  if (recipe.angle === "A2") { a2 = await askClaude({ guard, key: apiKey, kit }); usd += a2.usd; }
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = brief(recipe, angle, kit, recipe.length_bucket, prior, a2) + (lastProblems.length ? `\nYour last draft was rejected: ${lastProblems.join("; ")}. Fix that.` : "");
    const r = await guard.spend("anthropic", "studio.write_script", estimateUsd({ model: MODEL, inputTokens: 3000, outputTokens: 2500 }), async (ticket) => {
      const out = await createMessage(ticket, { apiKey, request: { model: MODEL, max_tokens: 6000, system: SYSTEM(factText), messages: [{ role: "user", content: user }], output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } } } });
      return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
    }, { lane: "studio", live: true });
    usd += r.actualUsd ?? 0;
    const w = JSON.parse(r.result.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    const script = assembleWritten(w, recipe, kit, kitKey);
    if (a2) script.claude_log = a2;
    lastProblems = validateStory(script);
    const sim = similarity([script, ...recent]).filter((x) => x.a === script.variant && x.share > 0.3);
    if (sim.length) lastProblems.push(`it shares over 30% of its lines with ${sim[0].b}`);
    if (!lastProblems.length) return { script, usd };
  }
  throw new Error(`the script failed its checks: ${lastProblems.join("; ").slice(0, 300)}`);
}

function assembleWritten(w, recipe, kit, kitKey) {
  const shots = kit.moments.shots.filter((s) => !s.brand), payoff = (name, a, b, after, extra = {}) => ({ name, file: kit.file, in: +(a.a + 0.02).toFixed(2), out: +(b.b - 0.04).toFixed(2), hq_dir: kit.hq_dir, fullscreen: true, enter: "grow", pre: 0.5, post: 0.1, duck_db: 22, after_line: after, ...extra });
  const n = w.lines.length;
  const lines = w.lines.map((l, i) => {
    const out = { who: l.who, text: l.text, key: [l.key], expr: l.expr, pose: l.pose, shot: l.shot, role: `l${i}` };
    if (l.stamp) out.stamp = l.stamp;
    if (l.keep && !l.visual && !l.screen) out.keep = true;
    if (l.screen) { const spot = STICKER_SPOTS[l.screen] ?? { x: 0.5, y: 0.5, ty: 0.1 }; out.screen = { file: l.screen === "typed" ? "typed.jpg" : `${l.screen}.jpg`, sticker: l.sticker ? { text: l.sticker, ...spot } : null }; }
    else if (l.visual) {
      const v = Object.fromEntries(Object.entries(l.visual).filter(([, x]) => x != null));
      if (v.kind === "tiles") v.images = kit.scene_images.slice(0, 3).map((p) => `/work/media/${path.basename(p)}`);
      if (v.kind === "conveyor") v.image = `/work/media/${path.basename(kit.scene_images[0])}`;
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
    title: w.title, world: recipe.world, music_bpm: 86 + Math.floor(Math.random() * 24), music_shift: Math.floor(Math.random() * 7) - 3, creation: kitKey,
    recipe: { angle: recipe.angle, hook_type: w.hook_type, length_bucket: recipe.length_bucket, famous_name: !!recipe.famous_name, end_trigger: recipe.end_trigger },
    headline: { text: w.headline, chip: w.chip, secs: 8 }, lines: [...lines, { ...SITE_LINE, shot: "zee_close", visual: { kind: "sign", text: "tryzyvo.com", sub: "link in bio" } }], clips, end: c,
    search_title: w.search_title, caption: w.caption, hashtags: w.hashtags,
  }, { [kitKey]: kit }, kit.story.id);
}
const SITE_LINE = { who: "zee", text: "Made with Zyvo. tryzyvo.com, link in bio.", say: "Made with Zyvo. Try zyvo dot com, link in bio.", key: ["tryzyvo.com,"], expr: "happy", pose: "point", role: "site", cues: [{ word: 3, event: "site", sfx: "sparkle" }, { word: 4, event: "bio", sfx: "pop" }] };

/** The recent scripts this laptop rendered (the batch's and the last 14 days'), for the similarity check. */
export function recentScripts(kitsDir, days = 14) {
  const out = [], cut = Date.now() - days * 864e5;
  if (!fs.existsSync(kitsDir)) return out;
  for (const k of fs.readdirSync(kitsDir)) { const j = path.join(kitsDir, k, "jobs"); if (!fs.existsSync(j)) continue;
    for (const d of fs.readdirSync(j)) { const f = path.join(j, d, "script.json"); if (fs.existsSync(f) && fs.statSync(f).mtimeMs > cut) { try { const s = JSON.parse(fs.readFileSync(f, "utf8")); if (s.recipe?.angle) out.push(s); } catch { /* a half-written file */ } } } }
  return out;
}
