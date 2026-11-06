// Zyvo Studio recipe "Rage hook" (owner, 2026-11-02: the raging creator was the best video yet). A creator yells a real
// frustration on frame 0, Zee answers in two words, the real clip plays, three real steps, the real measured time, the real
// result, an excited last line. One recipe file per video in recipes/; any template. See recipes/README.md.
//   node rageHook.mjs <recipe.json> script     writes the two scripts ($0)
//   node rageHook.mjs <recipe.json> takes      3 takes of the yell, keeps the most intense; the other lines (paid, under recipe.cap_usd)
//   node rageHook.mjs <recipe.json> render     renders the bleeped main file and the uncensored one ($0, local)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assembleStory, VOICES } from "./storyScripts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.resolve(HERE, "../../content/studio-worker");
const PER_CHAR = 0.0002;
// the settings that won the first video: the v3 model yells, the usual one measured 5 to 9 dB quieter
export const YELL_TAGS = "[shouting] [furious]", REACT_TAGS = "[shocked] [shouting]", EXCITED_TAGS = "[excited] [loud]", PAIN_TAGS = "[frustrated] [sighs]";
const FAST = 1.22;   // Zee's steps and last line

const tap = (word, x, y) => ({ word, event: `tap|${x}|${y}`, sfx: "click" });

/** The two scripts of a recipe: { censored, raw }. They differ only by the bleep. */
export function rageHookScript(R) {
  const yellWords = R.yell.text.split(/\s+/), swear = yellWords.findIndex((w) => w.toLowerCase().startsWith(R.yell.swear));
  if (swear < 0) throw new Error(`the yell has no "${R.yell.swear}"`);
  if (R.clips.length !== 2) throw new Error("a Rage hook has two clips: the first and the result");
  const lines = [
    { who: "creator", text: R.yell.text, key: [R.yell.key], expr: "angry", pose: R.yell.pose ?? "rage", shake: 0.7, shot: "rage_hook", role: "yell", visual: { instant: true, up: 1.32, scale: 1.05, ...R.yell.prop } },
    { who: "zee", text: R.calm, key: ["Watch."], expr: "smug", pose: "pointUp", shot: "zee_close", role: "calm", listen: "angry" },
    { who: "creator", text: R.reaction, key: [R.reaction.split(/\s+/).at(-1)], expr: "shocked", pose: "handsUp", shot: "creator_close", role: "how", listen: "shocked", snap_start: true },
    ...R.steps.map((s, i) => ({ who: "zee", text: s.text, key: [s.key], expr: "happy", role: `s${i + 1}`, tempo: FAST, ...(i === 0 ? { shot: "two_shot" } : {}),
      screen: { file: s.screen, chip: `STEP ${i + 1}` }, cues: [...(s.taps ?? []).map((t) => tap(...t)), ...(s.flips ?? []).map(([word, file]) => ({ word, event: `flip|${file}`, sfx: "tick" }))] })),
    { who: "creator", text: "How long did that take?", key: ["long"], expr: "shocked", pose: "chin", shot: "creator_close", role: "long", visual: { kind: "none" } },
    { who: "zee", text: R.time.say, key: [R.time.key], expr: "smug", pose: "point", shot: "zee_close", role: "time", listen: "shocked",
      visual: { kind: "roll", value: R.time.seconds, format: "clock", secs: 0.8, scale: 0.78, up: 1.35, label: R.time.label } },
    { who: "creator", text: R.excited, key: [R.excited_key], expr: "happy", pose: "pointUpL", shot: "end_two", role: "making", visual: { kind: "none" } },
  ];
  const n = lines.length - 3;   // the "how long" line's index + 1: the result clip follows the answer
  const clip = (c, after, extra) => ({ name: c.name, file: R.creation.file, in: c.in, out: c.out, hq_dir: R.creation.hq_dir, ...(R.creation.hq_ext ? { hq_ext: R.creation.hq_ext } : {}), fullscreen: true, enter: "grow", pre: 0.32, post: 0.08, duck_db: 7, after_line: after, ...extra });
  const s = assembleStory(R.key, {
    title: R.title, template: R.template, world: R.world ?? "studio", music_bpm: 128, music_shift: 0, music_style: R.music === false ? "none" : "drive", music_db_under: 12, no_lead: true, first_second: true, tail: 0.25, creation: "this",
    energy: R.music === false ? { reveal_lines: [], reveal_clips: [] } : { reveal_lines: [], reveal_clips: [], from_frame0: true, hard_stop: { line: 1, word: R.calm.split(/\s+/).length - 1, clip: 0 } },
    recipe: { angle: "A5", hook_type: "rage_hook", length_bucket: "25-30", famous_name: false, end_trigger: "comment" },
    lines, clips: [clip(R.clips[0], 1), clip(R.clips[1], n + 1, { pre: 0.8 })],
    end: { line: { who: "zee", text: R.end.text, key: R.end.key, expr: "happy", pose: "wave", role: "cta", tempo: FAST, cues: [{ word: R.end.name_word, event: "site", sfx: "sparkle" }, { word: R.end.comment_word, event: "cta", sfx: "pop" }] }, cta: { id: `comment_${R.key}`, kind: "comment", chip: R.end.chip } },
    caption: R.caption,
  }, { this: { hq_dir: R.creation.hq_dir } }, R.creation.id);
  delete s.headline;   // no title card: the yell is the hook
  // the screens and the "none" prop bring no pop of their own
  for (const l of s.lines) if (l.screen || l.visual?.kind === "none") l.cues = l.cues.filter((c) => !c.event.startsWith("show"));
  // 25-30 s with no words cut
  Object.assign(s, { lufs_target: -15, squeeze: 0.14, gap_speaker: 0.12, gap_same: 0.08, voices: VOICES });
  // Zee answers fast after the creator: the camera may leave the close-up early here
  for (const m of s.shots) if (m.at.startsWith("long.") || m.at.startsWith("how.")) m.hold = 0.5;
  // assembleStory ends on two_shot: this recipe ends higher, and stays there
  s.lines.at(-1).shot = "end_two"; s.shots = s.shots.filter((m) => !m.at.startsWith("cta."));
  return { raw: s, censored: { ...s, bleep: { line: 0, word: swear, show: R.yell.show } } };
}

/** Rage hook v2 (owner, 2026-11-03: pain hooks hold 40-45% at 3 s, result-first 32%): 20-25 s. Mid-yell on frame 0 with a
 *  slam; "Watch." then 0.5 s of total silence; the real result (a full sentence) on a beat drop and a bass hit; three
 *  numbered steps, real screens BIG, a whoosh each; a real number revealed on a bass hit; the creator's punchline; the
 *  name and an easy comment question; the last frame whips back to the raging creator, so the end leads into frame 0.
 *  { raw, censored }: censored is null when the yell has no swear. */
export function rageHookV2(R) {
  const swear = R.yell.swear ? R.yell.text.split(/\s+/).findIndex((w) => w.toLowerCase().replace(/^\W+/, "").startsWith(R.yell.swear)) : -1;
  if (R.yell.swear && swear < 0) throw new Error(`the yell has no "${R.yell.swear}"`);
  if (R.steps.length < 2 || R.steps.length > 3) throw new Error("a Rage hook has two or three steps");
  const tempo = R.step_tempo ?? 1.12;   // ~3 s a step
  // "pain" (owner, 2026-11-04: the pain hook held best on Blocky): a personal problem, said low and fed up, no yell, no slam;
  // "confident" (2026-11-05, the "unpopular opinion" debate hook): said calmly and sure, straight to camera
  const pain = R.yell.mood === "pain", calmHook = pain || R.yell.mood === "confident", mood = pain ? "sad" : R.yell.mood === "confident" ? "smug" : "angry";
  const lines = [
    { who: "creator", text: R.yell.text, key: [R.yell.key], expr: mood, pose: R.yell.pose ?? (pain ? "grabHead" : calmHook ? "point" : "rage"), shake: calmHook ? 0 : 0.8, shot: "rage_hook", role: "yell", visual: { instant: true, up: 1.32, scale: 1.05, ...(R.yell.prop ?? { kind: "none" }) } },
    { who: "zee", text: R.calm ?? "Watch.", key: [(R.calm ?? "Watch.").split(/\s+/).at(-1)], expr: "smug", pose: "pointUp", shot: "zee_close", role: "calm", listen: mood },
    ...R.steps.map((s, i) => ({ who: "zee", text: s.text, key: [s.key], expr: "happy", role: `s${i + 1}`, tempo, ...(i === 0 ? { shot: "two_shot" } : {}),
      screen: { file: s.screen, chip: `STEP ${i + 1}`, big: true, ...(s.sticker ? { sticker: s.sticker } : {}) },
      cues: [{ word: 0, event: `step${i + 1}`, sfx: "whoosh" }, ...(s.taps ?? []).map((t) => tap(...t)), ...(s.flips ?? []).map(([word, file]) => ({ word, event: `flip|${file}`, sfx: "tick" }))] })),
    // the real number and the punchline are optional: no measured time for a creation, no time line (owner, 2026-11-04)
    ...(R.reveal ? [{ who: "zee", text: R.reveal.text, key: [R.reveal.key], expr: "smug", pose: "point", shot: "zee_close", role: "reveal", listen: "shocked", tempo,
      visual: { kind: "roll", secs: 0.8, scale: 0.78, up: 1.35, ...R.reveal.visual } }] : []),
    ...(R.punchline ? [{ who: "creator", text: R.punchline.text, key: [R.punchline.key], expr: R.punchline.expr ?? "shocked", pose: R.punchline.pose ?? "handsUp", shot: "creator_close", role: "punch", visual: { kind: "none" } }] : []),
  ];
  const revealAt = lines.findIndex((l) => l.role === "reveal");
  // the end: a comment question (default), or a reason to save or share (owner, 2026-11-04: saves and shares are low)
  const trigger = R.end.trigger ?? "comment";
  const c = R.clip;
  // the result plays on a device in the scene, in its own shape (owner, 2026-11-03): a wide Long Form video on a TV, the rest on a phone
  const clip = { name: "result", file: R.creation.file, in: c.in, out: c.out, hq_dir: R.creation.hq_dir, ...(R.creation.hq_ext ? { hq_ext: R.creation.hq_ext } : {}), frame: c.frame ?? (R.template === "long_form" ? "tv" : "phone"), enter: "grow", pre: 0.5, post: 0.1, duck_db: 7, after_line: 1 };
  const last = R.end.text.split(/\s+/).length - 1;
  // no music unless a recipe asks for it (owner, 2026-11-03, after hearing the first four): the slam, the silence and the bass hits stay
  const music = R.music === true;
  const s = assembleStory(R.key, {
    title: R.title, template: R.template, world: R.world ?? "studio", music_bpm: 128, music_shift: 0, music_style: music ? "drive" : "none", music_db_under: 12, no_lead: true, first_second: true, tail: 0.5, creation: "this",
    // "Watch." stops the beat (with music) and is followed by silence; the clip's first frame brings a bass hit; the reveal gets its own
    energy: { reveal_lines: revealAt >= 0 ? [revealAt] : [], reveal_clips: [], from_frame0: true, slam: !calmHook, scratch: false, hard_stop: { line: 1, word: (R.calm ?? "Watch.").split(/\s+/).length - 1, clip: 0 } },
    recipe: { angle: R.angle ?? "RH", angle_name: R.angle_name ?? (pain ? "Pain hook" : "Rage hook"), hook_type: R.hook_type ?? (pain ? "pain" : "rage_hook"), length_bucket: R.length_bucket ?? "20-25", famous_name: false, end_trigger: trigger },
    lines, clips: [clip],
    // the ending is Zee's by default; a recipe may give it to the creator (the debate hook asks the viewer back)
    end: { line: { who: R.end.who ?? "zee", text: R.end.text, key: R.end.key, expr: "happy", pose: R.end.who === "creator" ? "pointUpL" : "wave", role: "cta", tempo,
      cues: [...(R.end.name_word != null ? [{ word: R.end.name_word, event: "site", sfx: "sparkle" }] : []), { word: R.end.cta_word ?? R.end.comment_word, event: "cta", sfx: "pop" }, ...(R.end.who === "creator" ? [] : [{ word: last, event: `act|creator|${mood}|3` }])] }, cta: { id: `${trigger}_${R.key}`, kind: trigger, chip: R.end.chip } },
    caption: R.caption, hashtags: R.hashtags, search_title: R.search_title,
  }, { this: { hq_dir: R.creation.hq_dir } }, R.creation.id);
  // no title card: the yell is the hook. The hidden headline is never drawn; it keeps the approval form (which always sends
  // a headline) and the Queue's hook field working
  s.headline = { text: R.yell.text, hidden: true };
  // with no time or punchline, the last step's screen must leave as the ending starts
  if (!R.reveal && !R.punchline) s.lines.at(-1).visual = { kind: "none" };
  for (const l of s.lines) if (l.screen || l.visual?.kind === "none") l.cues = l.cues.filter((x) => !x.event.startsWith("show"));
  Object.assign(s, { lufs_target: -15, squeeze: 0.14, gap_speaker: 0.12, gap_same: 0.08, voices: VOICES, claims: R.claims ?? [], preset: "rage_hook" });
  // short lines after the steps: the camera follows each speaker at once (the 2 s minimum hold would leave it behind)
  for (const m of s.shots) if (/^(reveal|punch|cta)\./.test(m.at)) m.hold = 0.5;
  // during the silence after "Watch." the camera pulls back to both of them, under the device, and stays for the steps
  for (const m of s.shots) if (m.at.startsWith("s1.")) Object.assign(m, { at: "calm.end+0.02", dur: 0.45, hold: 0.5 });
  for (const m of s.shots) if (m.at.startsWith("calm.")) m.hold = 0.2;   // short: the pull back to both must land as the device appears
  // the end: up to both faces for the name, then a whip back into the raging creator (frame 0) as the video loops
  for (const m of s.shots) if (m.at.startsWith("cta.")) m.to = "end_two";
  s.lines.at(-1).shot = "end_two";
  if (R.end.tags) s.lines.at(-1).voice_tags = R.end.tags;
  s.shots.push({ to: "rage_hook", at: "cta.end+0.08", dur: 0.3, kind: "whip", hold: 0 });
  s.loop_back = 0.08;   // story.js: the creator back in the yell, the end chips gone
  return { raw: s, censored: swear >= 0 ? { ...s, bleep: { line: 0, word: swear, show: R.yell.show } } : null };
}

/** "Guess how long this took" (owner, 2026-11-05, a comment game): no characters, no studio. Frame 0 is the real result
 *  full screen with its own sound and the big question; quick cuts of real moments (one montage file of whole sentences)
 *  over a ticking clock; a 0.5 s freeze; a clock rolls to the REAL measured time, "made with Zyvo"; one spoken line. */
export function guessHowLong(R) {
  const M = R.montage, dur = M.out - M.in, freeze = R.freeze_secs ?? 0.5;
  const lines = [];
  const s = assembleStory(R.key, {
    title: R.title, template: R.template, world: R.world ?? "studio", music_bpm: 128, music_shift: 0, music_style: "none", music_db_under: 12, no_lead: true, first_second: false, tail: 0.02, creation: "this",
    energy: { reveal_lines: [], reveal_clips: [], from_frame0: true, slam: false, scratch: false },
    recipe: { angle: "GH", angle_name: "Guess how long", hook_type: "guess_how_long", length_bucket: R.length_bucket ?? "12-15", famous_name: false, end_trigger: "comment" },
    lines,
    clips: [{ name: "montage", file: M.file, in: M.in, out: M.out, hq_dir: M.hq_dir, hq_ext: "png", at: "start", fullscreen: true, enter: "cut", headline: true, duck_db: 0, post: 0,
      punch: M.cuts ?? [], sfx_at: [[0.0, `clock:${dur.toFixed(2)}`]], freeze: { secs: freeze }, voice_over: dur + freeze, clip_gain: 1.0 }],
    end: { line: { who: "zee", text: R.end.text, key: R.end.key, expr: "happy", pose: "wave", role: "cta", timer2d: { seconds: R.time.seconds, label: R.time.label },
      cues: [{ word: 0, event: "timer", sfx: "tick" }, { word: R.end.cta_word ?? 0, event: "cta", sfx: "pop" }] }, cta: { id: `comment_${R.key}`, kind: "comment", chip: R.end.chip } },
    caption: R.caption, hashtags: R.hashtags, search_title: R.search_title,
  }, { this: { hq_dir: M.hq_dir } }, R.creation.id);
  // the big question on frame 0, over the real footage, until the freeze
  s.headline = { text: R.hook, secs: dur, size: R.hook_size ?? 96 };
  s.lines.at(-1).visual = { kind: "none" };
  s.lines.at(-1).cues = s.lines.at(-1).cues.filter((x) => !x.event.startsWith("show"));
  Object.assign(s, { lufs_target: -15, gap_speaker: 0.12, gap_same: 0.08, voices: VOICES, claims: R.claims ?? [], preset: "rage_hook", no_yell: true });
  return { raw: s, censored: null };
}
/** "My first AI video vs my latest" (owner, 2026-11-05): the creator, embarrassed, over the real first clip on a phone;
 *  their answer; a 1 s hold (a rising tone, a countdown tag, silence just before); the real latest clip cuts in full
 *  screen on a bass hit; the name and a share reason. Both clips are the owner's own creations, dated by month only. */
export function firstVsLatest(R) {
  const [first, latest] = R.clips;
  const answerWords = R.answer.text.split(/\s+/).length;
  const lines = [
    { who: "creator", text: R.yell.text, key: [R.yell.key], expr: "sad", pose: R.yell.pose ?? "shrug", shot: "rage_hook", role: "yell", visual: { kind: "none" } },
    { who: "creator", text: R.answer.text, key: [R.answer.key], expr: "smug", pose: "pointUp", shot: "creator_close", role: "answer", voice_tags: "[proud] [confident]",
      visual: { kind: "tag", text: R.countdown ?? "3 · 2 · 1" }, cues: [{ word: answerWords - 1, event: "countdown", sfx: "riser:1.0" }] },
  ];
  const clip = (c, after, extra) => ({ name: c.name, file: c.file, in: c.in, out: c.out, hq_dir: c.hq_dir, hq_ext: c.hq_ext ?? "png", stamp: c.stamp, duck_db: 7, post: 0.1, after_line: after, ...extra });
  const s = assembleStory(R.key, {
    title: R.title, template: R.template, world: R.world ?? "studio", music_bpm: 128, music_shift: 0, music_style: "none", music_db_under: 12, no_lead: true, first_second: true, tail: latest.voice_over != null ? 0.02 : 0.5, creation: "this",
    // the latest clip's first frame is the bass drop; the 0.4 s before it go silent (the freeze)
    energy: { reveal_lines: [], reveal_clips: [latest.name], from_frame0: true, slam: false, scratch: false },
    recipe: { angle: "FL", angle_name: "First vs latest", hook_type: "first_vs_latest", length_bucket: R.length_bucket ?? "15-20", famous_name: false, end_trigger: R.end.trigger ?? "repost" },
    lines,
    clips: [clip(first, 0, { frame: "phone", enter: "grow", pre: 0.3 }), clip(latest, 1, { fullscreen: true, enter: "cut", pre: 1.1, ...(latest.voice_over != null ? { voice_over: latest.voice_over, clip_gain: latest.clip_gain ?? 0.3 } : {}) })],
    end: { line: { who: "zee", text: R.end.text, key: R.end.key, expr: "happy", pose: "wave", role: "cta", cues: [{ word: R.end.name_word, event: "site", sfx: "sparkle" }, { word: R.end.cta_word, event: "cta", sfx: "pop" }] }, cta: { id: `${R.end.trigger ?? "repost"}_${R.key}`, kind: R.end.trigger ?? "repost", chip: R.end.chip } },
    caption: R.caption, hashtags: R.hashtags, search_title: R.search_title,
  }, { this: { hq_dir: latest.hq_dir } }, R.creation.id);
  s.headline = { text: R.yell.text, hidden: true };
  for (const l of s.lines) if (l.visual?.kind === "none") l.cues = l.cues.filter((x) => !x.event.startsWith("show"));
  s.lines.at(-1).visual = { kind: "none" };
  Object.assign(s, { lufs_target: -15, squeeze: 0.14, gap_speaker: 0.12, gap_same: 0.08, voices: VOICES, claims: R.claims ?? [], preset: "rage_hook" });
  // the camera pulls back to both of them as the first clip's phone appears (a close-up puts the phone over the face)
  s.shots.unshift({ to: "two_shot", at: "yell.end+0.02", dur: 0.4, kind: "pull", hold: 0.5 });
  s.lines.at(-1).shot = "end_two";
  return { raw: s, censored: null };
}

/** A recipe's scripts, by its structure. */
export const rageScripts = (R) => (R.structure === "v2" ? rageHookV2(R) : R.structure === "first_vs_latest" ? firstVsLatest(R) : R.structure === "guess_how_long" ? guessHowLong(R) : rageHookScript(R));
export const RECIPES_DIR = path.join(HERE, "recipes");
/** The one-click presets (Studio tab): the v2 recipes. */
export function rageRecipes(dir = RECIPES_DIR) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((R) => R.structure === "v2").map((R) => ({ key: R.key, title: R.title, template: R.template, creation: R.creation.title, creation_id: R.creation.id, yell: R.yell.text }));
}
export const loadRecipe = (key, dir = RECIPES_DIR) => {
  const f = fs.readdirSync(dir).find((x) => x.endsWith(".json") && JSON.parse(fs.readFileSync(path.join(dir, x), "utf8")).key === key);
  if (!f) throw new Error(`no Rage hook recipe "${key}"`);
  return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
};

/** What each paid take is. Three takes of the yell (as the script now says it), then every other line once. */
export function rageTakes(R, S) {
  const shout = (text) => text.toUpperCase().replace(/[.!?…]+$/, "") + "!!!";
  const creator = { voice: S.voices.eleven.creator.id, model: "eleven_v3", stability: 0 };
  const zee = { voice: S.voices.eleven.zee.id, model: null, stability: 0.6, style: 0.2, speed: 1.05 };
  const tags = (l) => l.voice_tags ?? (l.role === "how" ? REACT_TAGS : l.role === "punch" ? R.punchline?.tags ?? REACT_TAGS : EXCITED_TAGS);
  // a pain hook is said, not yelled: fed up and a little embarrassed, as written; a recipe may set its own tags
  // no creator opening (the "guess how long" game: the footage opens it): every line once, Zee's voice
  if (!R.yell) return S.lines.map((l, i) => ({ file: `line${String(i + 1).padStart(2, "0")}.mp3`, text: l.say ?? l.text, ...(l.who === "zee" ? zee : creator) }));
  const first = R.yell.tags ? `${R.yell.tags} ${S.lines[0].text}` : R.yell.mood === "pain" ? `${PAIN_TAGS} ${S.lines[0].text}` : `${YELL_TAGS} ${shout(S.lines[0].text)}`;
  return [
    ...["a", "b", "c"].map((k) => ({ file: `yell_${k}.mp3`, text: first, ...creator })),
    ...S.lines.slice(1).map((l, i) => {
      const file = `line${String(i + 2).padStart(2, "0")}.mp3`;
      if (l.who === "zee") return { file, text: l.say ?? l.text, ...zee };
      return { file, text: `${tags(l)} ${l.text}`, ...creator };
    }),
  ];
}

/** The paid takes through the Budget Guard (skips takes already made), then line 1 = the most intense yell. -> { usd } */
export async function makeRageTakes({ R, S, dir, guard, cap, log = console.log }) {
  for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  fs.mkdirSync(dir, { recursive: true });
  const V2 = fs.readFileSync(path.join(HERE, "elevenTakes.mjs"), "utf8").match(/model_id: "([^"]+)"/)[1];   // the model every calm line uses
  const jobs = rageTakes(R, S).filter((j) => !fs.existsSync(path.join(dir, j.file)));
  const worst = jobs.reduce((a, j) => a + j.text.length, 0) * PER_CHAR;
  log(`${jobs.length} takes, worst case $${worst.toFixed(4)}, cap $${cap}`);
  if (worst > cap) throw new Error(`the voices would cost up to $${worst.toFixed(2)}, over the $${cap} cap`);
  let total = 0;
  for (const j of jobs) {
    const r = await guard.spend("other", "studio.voice_lines", j.text.length * PER_CHAR, async () => {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${j.voice}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text: j.text, model_id: j.model ?? V2, voice_settings: { stability: j.stability, similarity_boost: 0.75, ...(j.style != null ? { style: j.style, use_speaker_boost: true } : {}), ...(j.speed != null ? { speed: j.speed } : {}) } }) });
      if (!res.ok) throw new Error(`${j.file}: ${res.status} ${(await res.text()).slice(0, 240)}`);
      const chars = Number(res.headers.get("character-cost")) || j.text.length;
      fs.writeFileSync(path.join(dir, j.file), Buffer.from(await res.arrayBuffer()));
      return { result: chars, actualUsd: chars * PER_CHAR };
    }, { lane: "studio", live: true });
    total += r.actualUsd ?? 0;
    log(`${j.file}: ${r.result} characters`);
  }
  if (jobs.length) fs.appendFileSync(path.join(dir, "cost.log"), `${new Date().toISOString()} ${jobs.length} takes $${total.toFixed(4)}\n`);
  log(`spent $${total.toFixed(4)}`);
  if (!R.yell) return { usd: total };   // no yell takes to choose between
  // the most intense yell: loudest and highest (measureTakes.py)
  const scores = JSON.parse(execFileSync("python", [path.join(HERE, "measureTakes.py"), ...["a", "b", "c"].map((k) => path.join(dir, `yell_${k}.mp3`))], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  const best = scores.sort((a, b) => b.score - a.score)[0];
  for (const x of scores) log(`${path.basename(x.file)}: ${x.seconds} s, ${x.lufs} LUFS, pitch ${x.pitch} Hz, score ${x.score}: "${x.text}"`);
  fs.copyFileSync(best.file, path.join(dir, "line01.mp3"));
  log(`line 1 is ${path.basename(best.file)}`);
  return { usd: total };
}

function render(R) {
  const win = (p) => p.replace(/\\/g, "/");
  const out = path.resolve(HERE, "../..", R.out_dir); fs.mkdirSync(out, { recursive: true });
  const env = { ...process.env, STUDIO_SCRATCH: win(path.join(WORKER, "scratch")), PICS_DIR: win(path.join(WORKER, "pool")), PROTO_DIR: win(path.join(WORKER, "proto")), SCREENS: win(path.join(WORKER, "src_work", R.screens)), MEDIA: "/nonexistent" };
  for (const [script, suffix] of [["script.json", "bleep"], ["script_raw.json", "uncensored"]]) {
    if (!fs.existsSync(path.join(WORKER, "scratch", "story", R.key, script))) continue;
    const work = path.join(WORKER, "scratch", `${R.key}_${suffix}`); fs.mkdirSync(work, { recursive: true });
    const log = execFileSync("bash", [path.join(HERE, "buildStory.sh"), win(path.join(WORKER, "scratch", "story", R.key, script)), win(work), win(path.join(out, `${R.key}_${suffix}.mp4`))], { env, encoding: "utf8", maxBuffer: 1e8 });
    console.log(log.split("\n").filter((l) => /rendered|SAFE|^eleven|PROBLEM|rror/.test(l)).map((l) => l.slice(0, 500)).join("\n"));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, step] = process.argv.slice(2);
  const R = JSON.parse(fs.readFileSync(file, "utf8")), dir = path.join(WORKER, "scratch", "story", R.key);
  fs.mkdirSync(dir, { recursive: true });
  const { raw, censored } = rageScripts(R);
  if (censored) fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(censored, null, 1));
  fs.writeFileSync(path.join(dir, "script_raw.json"), JSON.stringify(raw, null, 1));
  if (step === "script") console.log(raw.lines.map((l, i) => `${i + 1} ${l.who} ${l.shot ?? "-"}: ${l.text}`).join("\n"));
  else if (step === "takes") {
    const { admin } = await import("file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs");
    const { createBudgetGuard } = await import("../../supabase/functions/_shared/contentMachine/budgetGuard.js");
    const { createStore } = await import("../../supabase/functions/_shared/contentMachine/store.js");
    await makeRageTakes({ R, S: raw, dir, guard: createBudgetGuard({ store: createStore(admin()) }), cap: R.cap_usd });
    setTimeout(() => process.exit(0), 300);
  } else if (step === "render") render(R);
  else throw new Error("the step: script, takes or render");
}
