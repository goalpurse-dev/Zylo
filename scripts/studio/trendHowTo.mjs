// Zyvo Studio format "Trend how-to" (owner, 2026-11-03: our biggest hit, 304K views and 88% from search, was a search
// answer to a trending "how to make X" question posted while the trend was hot; this is now the main format). 20-40 s:
// frame 0 = two REAL public examples of the trend with their real view counts (credited, not ours) + a big yellow
// "HOW TO MAKE ___" title; the first spoken line, the title, the search title and the caption all carry the exact search
// phrase; then the same kind of video made with Zyvo (a real output, on a TV or a phone), 3 quick real steps, the real
// result, "link in bio". One recipe file per video in recipes/ ("structure": "trend_howto"). See recipes/README.md.
//   node trendHowTo.mjs <recipe.json>     prints the script ($0)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assembleStory, VOICES } from "./storyScripts.mjs";

const tap = (word, x, y) => ({ word, event: `tap|${x}|${y}`, sfx: "click" });

/** The script of a Trend how-to recipe. Throws when a rule of the format is broken (the search phrase, the examples). */
export function trendHowTo(R) {
  const phrase = R.search_phrase.toLowerCase();
  const has = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").includes(phrase.replace(/[^a-z0-9 ]/g, ""));
  for (const [what, s] of [["the first line", R.hook.text], ["the search title", R.search_title], ["the caption", R.caption], ["the title", R.title.join(" ")]]) if (!has(s)) throw new Error(`${what} must contain "${R.search_phrase}"`);
  if (R.examples?.length !== 2 || R.examples.some((e) => !e.url || !e.views || !e.credit || !e.checked)) throw new Error("two real examples, each with its url, views, credit and the day its views were checked");
  if (R.steps.length !== 3) throw new Error("a Trend how-to has three steps");
  if (R.urgency && !R.rising?.evidence) throw new Error("an urgency line needs the evidence that the trend is rising");
  const tempo = R.step_tempo ?? 1.12;
  const lines = [
    // frame 0: a hit on the first frame, a tick as each view count rolls up; the creator's face below reacts
    { who: "zee", text: R.hook.text, key: [R.hook.key], expr: "happy", pose: "point", shot: "split_face", role: "hook", listen: "shocked", visual: { kind: "none" },
      cues: [{ word: 0, event: "open", sfx: "hit" }, ...[1, 2, 3, 4].map((w) => ({ word: w, event: `roll${w}`, sfx: "tick" }))] },
    { who: "creator", text: R.proof.text, key: [R.proof.key], expr: "shocked", pose: "handsUp", shot: "split_face", role: "proof", visual: { kind: "none" } },
    { who: "zee", text: R.calm ?? "Watch. I made this one with Zyvo.", key: ["Zyvo."], expr: "smug", pose: "pointUp", shot: "two_shot", role: "calm", listen: "shocked" },
    ...R.steps.map((s, i) => ({ who: "zee", text: s.text, key: [s.key], expr: "happy", role: `s${i + 1}`, tempo,
      screen: { file: s.screen, chip: `STEP ${i + 1}`, big: true, ...(s.sticker ? { sticker: s.sticker } : {}) },
      cues: [{ word: 0, event: `step${i + 1}`, sfx: "whoosh" }, ...(s.taps ?? []).map((t) => tap(...t))] })),
    { who: "zee", text: R.reveal.text, key: [R.reveal.key], expr: "smug", pose: "point", shot: "zee_close", role: "reveal", listen: "shocked", tempo,
      visual: { kind: "roll", secs: 0.8, scale: 0.78, up: 1.35, ...R.reveal.visual } },
  ];
  const c = R.clip;
  const clip = { name: "result", file: R.creation.file, in: c.in, out: c.out, hq_dir: R.creation.hq_dir, ...(R.creation.hq_ext ? { hq_ext: R.creation.hq_ext } : {}), frame: c.frame ?? (R.template === "long_form" ? "tv" : "phone"), enter: "grow", pre: 0.5, post: 0.1, duck_db: 7, after_line: 2 };
  const end = R.end ?? { text: "It's called Zyvo. Link in bio.", key: ["Zyvo.", "bio."] };
  const words = end.text.split(/\s+/), nameWord = words.findIndex((w) => w.startsWith("Zyvo")), bioWord = words.findIndex((w) => w.startsWith("bio"));
  const s = assembleStory(R.key, {
    title: R.title.join(" "), template: R.template, world: R.world ?? "studio", music_bpm: 128, music_shift: 0, music_style: R.music === true ? "drive" : "none", music_db_under: 12, no_lead: true, first_second: true, tail: 0.5, creation: "this",
    // the clip's first frame and the reveal get a bass hit; no slam (nobody yells)
    energy: { reveal_lines: [lines.length - 1], reveal_clips: [], from_frame0: false, slam: false, scratch: false, hard_stop: { line: 2, word: 0, clip: 0 } },
    recipe: { angle: "TH", angle_name: "Trend how-to", hook_type: "trend_howto", length_bucket: "20-40", famous_name: false, end_trigger: "link_in_bio", trend: R.trend },
    lines, clips: [clip],
    end: { line: { who: "zee", text: end.text, key: end.key, expr: "happy", pose: "wave", role: "cta", tempo, cues: [{ word: Math.max(0, nameWord), event: "site", sfx: "sparkle" }, { word: Math.max(0, bioWord), event: "bio", sfx: "pop" }] }, cta: { id: `bio_${R.key}`, kind: "link_in_bio", chip: null } },
    caption: R.caption, hashtags: R.hashtags, search_title: R.search_title,
  }, { this: { hq_dir: R.creation.hq_dir } }, R.creation.id);
  // the frame-0 split replaces the title card; the hidden headline keeps the approval form and the Queue's hook field working
  s.headline = { text: R.title.join(" "), hidden: true };
  // the view counts roll up to the real numbers; the real result plays on the TV as soon as the split leaves
  const views = (v) => { const m = String(v).match(/([\d.]+)\s*([KMB])?/i); return Math.round(Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase()] ?? 1)); };
  s.split = { title: R.title, until_line: 2, preroll: "result", cards: R.examples.map((e) => ({ file: e.file, views: e.views, value: views(e.views), credit: e.credit })) };
  for (const l of s.lines) if (l.screen || l.visual?.kind === "none") l.cues = l.cues.filter((x) => !x.event.startsWith("show"));
  Object.assign(s, { lufs_target: -15, squeeze: 0.14, gap_speaker: 0.12, gap_same: 0.08, voices: VOICES, claims: [...(R.claims ?? []), ...R.examples.map((e) => `${e.views} views: ${e.url} (${e.credit}), checked ${e.checked}`)], preset: "trend_howto" });
  // the camera holds both of them under the device for the steps, then follows each short line at once
  for (const m of s.shots) if (/^(reveal|cta)\./.test(m.at)) m.hold = 0.5;
  for (const m of s.shots) if (m.at.startsWith("cta.")) m.to = "end_two";
  s.lines.at(-1).shot = "end_two";
  return s;
}

export const RECIPES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "recipes");
/** The Trend how-to recipes on this laptop (the Studio tab's presets list them next to the Rage hooks). */
export function trendRecipes(dir = RECIPES_DIR) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((R) => R.structure === "trend_howto").map((R) => ({ key: R.key, title: R.title.join(" "), template: R.template, creation: R.creation.title, creation_id: R.creation.id, hook: R.hook.text, trend: R.trend }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const S = trendHowTo(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
  console.log(S.lines.map((l, i) => `${i + 1} ${l.who}: ${l.text}`).join("\n"));
}
