// Zyvo Studio v2 scripts (Master Prompt v2, owner 2026-10-31): five genuinely different videos. The viewer's problem or
// curiosity first; Zyvo only as the answer. Every line has a visual; the creator asks the viewer's objections; facts come
// from the fact sheet, the logged run or a stamped source; each video has its own angle, world, creation, length, trigger.
// makeStory(key, kits) -> the script for audio.py + story.js. validateStory / similarity are the batch's checks.
//   node storyScripts.mjs <out dir> <kits dir>     writes the five scripts, their new voice lines and publish specs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const VOICES = {
  kokoro: { creator: { voice: "am_liam", speed: 1.05 }, zee: { voice: "af_bella", speed: 1.05 } },   // free previews only
  default: "eleven",
  eleven: {
    creator: { id: "bIHbv24MWmeRgasZH58o", name: "Will - Relaxed Optimist (young, natural)", stability: 0.38, style: 0.45, speed: 1.03 },
    zee: { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica - Playful, Bright, Warm", stability: 0.35, style: 0.5, speed: 1.03 },
  },
};
export const STORY_IDS = {
  dinner: "721f55be-3249-4d9f-9f31-c466d933831b", glass: "9f3c9af6-20b4-468f-9cd7-33d28fcda067", ken: "b102da41-abee-4e66-b4ff-c01e20bfc716",
  wedding: "3628cf86-4b61-4ed6-a6f2-8f9f2bd8961e", pairs: "c591c05d-aa52-40f8-9751-7f8cbcdfc55f",
};
const SITE = { who: "zee", text: "Made with Zyvo. tryzyvo.com, link in bio.", say: "Made with Zyvo. Try zyvo dot com, link in bio.", key: ["tryzyvo.com,"], expr: "happy", pose: "point", role: "site", cues: [{ word: 3, event: "site", sfx: "sparkle" }, { word: 4, event: "bio", sfx: "pop" }] };
const cta = (text, key, chip, kind, id) => ({ line: { who: "zee", text, key: [key], expr: "happy", pose: "wave", role: "cta", cues: [{ word: 0, event: "cta", sfx: "pop" }] }, cta: { id, kind, chip } });
const z = (text, key, extra = {}) => ({ who: "zee", text, key: [key], expr: "happy", ...extra });
const c = (text, key, extra = {}) => ({ who: "creator", text, key: [key], expr: "thinking", ...extra });
const sign = (text, extra = {}) => ({ kind: "sign", text, ...extra });
const act = (word, who, expr, secs = 1.4) => ({ word, event: `act|${who}|${expr}|${secs}` });

/** A real moment of a creation, by its shots (kit.moments.shots), kept to where the speech is. */
function clip(kit, name, from, to, extra = {}) {
  const S = kit.moments.shots, a = S[from], b = S[to];
  return { name, file: kit.file, in: +(a.a + 0.02).toFixed(2), out: +(b.b - 0.04).toFixed(2), hq_dir: kit.hq_dir, fullscreen: true, enter: "grow", pre: 0.5, post: 0.1, duck_db: 22, ...extra };
}
const media = (kit, k) => kit.scene_images.slice(0, k).map((p) => `/work/media/${path.basename(p)}`);

const STORIES = {
  // A1 · Trend teardown: why these videos work, with a real story as the example
  a1_trend_teardown: (K) => { const kit = K.dinner, img = media(kit, 3); return {
    title: "Why AI fruit videos go viral", world: "factory", music_bpm: 92, music_shift: 0, creation: "dinner",
    recipe: { angle: "A1", hook_type: "curiosity", length_bucket: "45-60", famous_name: false, end_trigger: "comment" },
    headline: { text: "WHY DO PEOPLE WATCH *FRUIT CHEAT?*", chip: "WHY FRUIT DRAMA WORKS", secs: 8 },
    lines: [
      c("Wait. Why did a fruit dating show get thirty nine million views?", "million", { expr: "shocked", pose: "handsUp", shot: "creator_close", role: "hook", stamp: "One show, reported by SAYS. Not platform data.", visual: { kind: "roll", value: 39, format: "M", label: "VIEWS ON ONE AI FRUIT SHOW", scale: 0.72, up: 0.7 }, cues: [act(9, "zee", "smug")] }),
      z("Because it's a formula. Three parts. And most people skip the third one.", "third", { expr: "smug", pose: "pointUp", shot: "two_shot", role: "stakes", listen: "thinking", visual: sign("3 PARTS", { sub: "most people skip the last", scale: 0.72, up: 0.7 }) }),
      c("Okay. Part one?", "one?", { shot: "creator_close", pose: "chin", keep: true }),
      z("Faces you can read in one second. A panicked cherry needs no backstory.", "second.", { pose: "point", shot: "prop_focus", role: "part1", listen: "happy", visual: { kind: "tiles", images: img, scale: 1 } }),
      z("Part two: someone gets caught in the very first line. No intro.", "caught", { expr: "smug", shot: "zee_close", role: "part2", visual: sign("CAUGHT IN LINE ONE", { rim: "#FF6B6B" }) }),
      c("So what's the part people skip?", "skip?", { pose: "shrug", shot: "creator_close", role: "ask3", keep: true }),
      z("Stop before it's solved. No ending means people argue in the comments.", "ending", { expr: "smug", pose: "pointUp", shot: "two_shot", role: "part3", stamp: "My read of the format, not a study.", listen: "shocked", visual: sign("NO ENDING = COMMENTS", { rim: "#FFD43B" }) }),
      z("Watch it happen. Fifteen seconds, one idea.", "Fifteen", { pose: "point", shot: "two_shot", role: "watch", visual: { kind: "conveyor", text: "IDEA", image: img[0] } }),
      { ...SITE, shot: "zee_close", visual: sign("tryzyvo.com", { sub: "link in bio" }) },
    ],
    clips: [clip(kit, "glimpse", 0, 0, { after_line: 3 }), clip(kit, "payoff", 1, kit.moments.shots.length - 1, { after_line: 7, pays_loop: true })],
    end: cta("Who's worse, Kai or Piper? Comment.", "worse,", "KAI OR PIPER?", "comment", "comment_who_worse"),
  }; },

  // A2 · Famous-AI bridge: done for real (data/a2_claude_log.json)
  a2_claude_bridge: (K) => { const kit = K.ken; return {
    title: "I asked Claude which video idea would go viral", world: "cozy", music_bpm: 86, music_shift: -2, creation: "ken",
    recipe: { angle: "A2", hook_type: "famous_name", length_bucket: "30-45", famous_name: true, end_trigger: "repost" },
    headline: { text: "I ASKED *CLAUDE* FOR A VIRAL IDEA", chip: "CLAUDE'S PICK", secs: 7 },
    lines: [
      c("I asked Claude which video idea would go viral. Then I actually made it.", "Claude", { expr: "happy", pose: "pointUpL", shot: "two_shot", role: "hook", stamp: "Real prompt and answer, logged Oct 31 2026", visual: { kind: "bubble", from: "ME, TO CLAUDE", text: "Which idea would you bet on?", scale: 0.72, up: 0.7 } }),
      z("Most people stop at the idea. Because an idea isn't a video.", "isn't", { expr: "smug", shot: "zee_close", role: "stakes", listen: "sad", visual: sign("IDEA ≠ VIDEO", { rim: "#FF6B6B", scale: 0.72, up: 0.7 }) }),
      c("It picked this one. The IT guy reads everything.", "IT", { expr: "shocked", shot: "creator_close", role: "pick", visual: { kind: "bubble", from: "CLAUDE'S PICK", text: "The IT guy reads everything", tail: "right" } }),
      z("Its reason? Everyone has an email they'd hate anyone to read.", "email", { pose: "pointUp", shot: "two_shot", role: "why", listen: "shocked", visual: { kind: "bubble", from: "CLAUDE, WORD FOR WORD", text: "everyone has an email they'd hate anyone to read", tail: "right" } }),
      c("Fine. But I can't edit. Now what?", "edit.", { expr: "sad", pose: "shrug", shot: "creator_close", role: "objection", visual: { kind: "timeline", text: "NO EDITING", at: 1.2 } }),
      z("Type it in here. That's the whole input.", "here.", { pose: "point", role: "input", screen: { file: "ken_typed.jpg", sticker: { text: "your idea goes here", x: 0.5, y: 0.45, ty: 0.2 } } }),
      z("Then pick the length. You see the credit cost before anything starts.", "cost", { role: "cost", stamp: "On the app's screen, Oct 29 2026", screen: { file: "s_length.jpg", sticker: { text: "the cost, up front", x: 0.62, y: 0.9, ty: 0.72 } } }),
      c("And that's a full video?", "full", { expr: "shocked", shot: "two_shot", role: "ask", visual: { kind: "tiles", images: media(kit, 3), scale: 0.9 } }),
      { ...SITE, shot: "zee_close", visual: sign("tryzyvo.com", { sub: "link in bio" }) },
    ],
    clips: [clip(kit, "glimpse", 0, 0, { after_line: 3, stamp: "Made earlier from this same idea" }), clip(kit, "payoff", Math.max(1, kit.moments.shots.length - 3), kit.moments.shots.length - 1, { after_line: 7, pays_loop: true, stamp: "Made earlier from this same idea" })],
    end: cta("Send this to the friend with a hundred ideas and zero videos.", "friend", "SEND TO THAT FRIEND", "repost", "repost_ideas_friend"),
  }; },

  // A6 · Tutorial in 60–90 s: the search title, real screens big, honest about the price
  a6_tutorial: (K) => { const kit = K.pairs; return {
    title: "How to make AI fruit videos", world: "studio", music_bpm: 100, music_shift: 2, creation: "pairs",
    recipe: { angle: "A6", hook_type: "search_question", length_bucket: "60-90", famous_name: false, end_trigger: "save" },
    headline: { text: "HOW TO MAKE *AI FRUIT VIDEOS*", chip: "HOW TO MAKE AI FRUIT VIDEOS", secs: 8 },
    lines: [
      c("How do you make those AI fruit videos? I can't edit, and I'm not filming myself.", "fruit", { expr: "sad", pose: "shrug", shot: "two_shot", role: "hook", visual: { kind: "clock", text: "HOURS OF EDITING?", scale: 0.72, up: 0.7 } }),
      z("You don't have to. Six steps. And step four is the tip most people skip.", "four", { expr: "smug", pose: "pointUp", shot: "zee_close", role: "stakes", listen: "happy", visual: sign("6 STEPS", { sub: "step 4 saves you money", scale: 0.8 }) }),
      z("Here's what we're making.", "making.", { pose: "point", shot: "two_shot", role: "glimpse", visual: { kind: "tiles", images: media(kit, 3), scale: 0.72, up: 0.7 } }),
      z("Step one. Short Form, then AI Fruit Story.", "Fruit", { role: "s1", screen: { file: "s_menu.jpg", sticker: { text: "tap here", x: 0.67, y: 0.39, ty: 0.86 } } }),
      z("Step two. Pick an idea. Or write your own.", "own.", { role: "s2", screen: { file: "s_ideas.jpg", sticker: { text: "pick one", x: 0.5, y: 0.42, ty: 0.14 } } }),
      c("What if my idea is bad?", "bad?", { expr: "sad", pose: "shrug", shot: "creator_close", role: "ob1", visual: sign("BAD IDEA?", { rim: "#FF6B6B" }) }),
      z("Then pick a ready one. There are a hundred and fifty characters to cast.", "fifty", { pose: "point", shot: "two_shot", role: "chars", visual: { kind: "roll", value: 150, label: "FRUIT CHARACTERS" } }),
      z("Step three. Length. For your first one, stay short: the app itself says twenty to thirty seconds.", "short:", { role: "s3", screen: { file: "s_length.jpg", sticker: { text: "start with 20–30 s", x: 0.5, y: 0.3, ty: 0.05 } } }),
      c("Is it free?", "free?", { expr: "thinking", pose: "chin", shot: "creator_close", role: "ob2", visual: { kind: "tag", text: "FREE?" } }),
      z("Honest answer: no. Video needs a paid plan. But you see the credit cost before you start.", "no.", { expr: "neutral", shot: "zee_close", role: "price", stamp: "Zyvo pricing + fact sheet, Oct 2026", visual: { kind: "tag", text: "COST UP FRONT", sub: "video needs a paid plan", color: "#BEF264" } }),
      z("Step four. Make the scene pictures, and check every single one.", "check", { role: "s4", screen: { file: "s_pictures.jpg", sticker: { text: "check these first", x: 0.5, y: 0.5, ty: 0.1 } } }),
      c("Why does that matter?", "matter?", { pose: "chin", shot: "creator_close", role: "ob3", keep: true }),
      z("Because a bad picture becomes a bad clip. Fix it now. That's the tip most people skip.", "Fix", { expr: "smug", pose: "pointUp", shot: "two_shot", role: "tip", listen: "shocked", stamp: "My tip, from making these", visual: sign("FIX PICTURES FIRST", { rim: "#FFD43B" }) }),
      z("Step five. Animate. They talk, with sound.", "Animate.", { role: "s5", screen: { file: "s_anim.jpg", sticker: { text: "each one talks", x: 0.5, y: 0.6, ty: 0.12 } } }),
      z("Step six. Make the final video. My thirty second test took three minutes, fifty seconds.", "fifty", { role: "s6", stamp: "My run, Oct 29: 230 s from first click, 159 credits", screen: { file: "s_final.jpg", sticker: { text: "3:50, first click to here", x: 0.35, y: 0.5, ty: 0.06 } } }),
      c("Okay, show me a real one.", "real", { expr: "happy", shot: "two_shot", role: "ask", visual: { kind: "conveyor", text: "IDEA", image: media(kit, 1)[0] } }),
      { ...SITE, shot: "zee_close", visual: sign("tryzyvo.com", { sub: "link in bio" }) },
    ],
    clips: [clip(kit, "glimpse", 0, 0, { after_line: 2, pre: 0.45, post: 0.1 }), clip(kit, "payoff", 1, kit.moments.shots.length - 1, { after_line: 15, pays_loop: true, stamp: "A different story, same six steps" })],
    end: cta("Save this for when you make your first one.", "Save", "SAVE THIS", "save", "save_first_one"),
  }; },

  // A7 · Idea list: real idea cards from the app, one made live
  a7_idea_list: (K) => { const kit = K.glass; const idea = (n, title, text) => ({ kind: "idea", n, title, text }); return {
    title: "5 fruit drama ideas you can steal", world: "sunny", music_bpm: 108, music_shift: 3, creation: "glass",
    recipe: { angle: "A7", hook_type: "list", length_bucket: "30-45", famous_name: false, end_trigger: "comment" },
    headline: { text: "*5 FRUIT DRAMA IDEAS* YOU CAN STEAL", chip: "5 IDEAS TO STEAL", secs: 7 },
    lines: [
      c("I want to post fruit drama, but I have zero ideas.", "zero", { expr: "sad", pose: "shrug", shot: "creator_close", role: "hook", visual: sign("0 IDEAS", { rim: "#FF6B6B", scale: 0.72, up: 0.7 }) }),
      z("Steal these. Five ideas, and number five I already made.", "Steal", { expr: "smug", pose: "pointUp", shot: "two_shot", role: "stakes", listen: "shocked", visual: sign("5 IDEAS", { sub: "free to steal", scale: 0.72, up: 0.7 }) }),
      z("One. The fake business trip. He's supposedly in Tokyo. His car is parked outside her favorite restaurant.", "car", { pose: "point", shot: "side_left", role: "i1", listen: "shocked", visual: idea(1, "The fake business trip", "He's 'in Tokyo'. His car is outside her favorite restaurant.") }),
      z("Two. The secret twin. Mia sees Marco across the street, while he's sitting next to her.", "twin.", { shot: "side_right", role: "i2", listen: "shocked", visual: idea(2, "The secret twin", "Mia sees Marco across the street. He's sitting next to her.") }),
      c("Okay, that one's good.", "good.", { expr: "happy", shot: "creator_close", role: "react", keep: true }),
      z("Three. Grandpa's love letters. None of them are to Grandma.", "None", { expr: "smug", shot: "two_shot", role: "i3", listen: "shocked", visual: idea(3, "Grandpa's love letters", "None of them are to Grandma.") }),
      z("Four. A blind date with fake photos. His profile is ten years and three jobs old.", "fake", { shot: "low_hero", role: "i4", visual: idea(4, "Blind date with fake photos", "His profile is ten years and three jobs old.") }),
      c("And five?", "five?", { expr: "thinking", pose: "chin", shot: "creator_close", role: "ask", keep: true }),
      z("Five. The door was locked. But the walls are glass.", "glass.", { expr: "smug", pose: "point", shot: "two_shot", role: "i5", stamp: "All five are ready-made ideas in the app", visual: idea(5, "The door was locked", "The office gossip walks in. The walls are glass.") }),
      { ...SITE, shot: "zee_close", visual: sign("tryzyvo.com", { sub: "link in bio" }) },
    ],
    clips: [clip(kit, "payoff", 0, kit.moments.shots.length - 1, { after_line: 8, pays_loop: true })],
    end: cta("Which one would you make? Comment a number.", "number.", "COMMENT 1 TO 5", "comment", "comment_number"),
  }; },

  // A8 · Story first: the drama itself; Zyvo only in the end card
  a8_story_first: (K) => { const kit = K.wedding; return {
    title: "She has no idea it's her wedding", world: "sunny", music_bpm: 90, music_shift: -3, creation: "wedding",
    recipe: { angle: "A8", hook_type: "story", length_bucket: "30-45", famous_name: false, end_trigger: "comment" },
    headline: { text: "SHE DOESN'T KNOW IT'S *HER WEDDING*", chip: "PART 1", secs: 6 },
    lines: [
      z("Made with Zyvo. Part two?", "two?", { pose: "wave", shot: "zee_close", role: "site", visual: sign("PART 2?", { sub: "made with Zyvo · tryzyvo.com" }), cues: [{ word: 2, event: "site", sfx: "sparkle" }] }),
    ],
    clips: [clip(kit, "open", 0, kit.moments.shots.length - 1, { at: "start", enter: "cut", post: 0.15, duck_db: 22, headline: true, punch: [0.05] })],
    end: cta("Should she say yes? Comment.", "yes?", "YES OR NO?", "comment", "comment_yes_no"),
    loop: true, no_lead: true,
  }; },
};
export const STORY_KEYS = Object.keys(STORIES);

/** The camera plan from each line's "shot": a move into it that lands as the line starts (holds >= 2 s, timeline.js). */
function shotsOf(lines, first) {
  const out = []; let at = first;
  for (const l of lines) if (l.shot && l.shot !== at) { out.push({ to: l.shot, at: `${l.role}.start-0.55`, dur: 0.85, kind: "pull" }); at = l.shot; }
  return out;
}

export function makeStory(key, kits) { return assembleStory(key, STORIES[key](kits), kits, STORY_IDS[STORIES[key](kits).creation]); }
/** Where a screen's sticker goes (its ring on the spot, the sticker near it). */
export const STICKER_SPOTS = { s_menu: { x: 0.67, y: 0.39, ty: 0.86 }, s_ideas: { x: 0.5, y: 0.42, ty: 0.14 }, s_length: { x: 0.62, y: 0.9, ty: 0.72 }, s_pictures: { x: 0.5, y: 0.5, ty: 0.1 }, s_anim: { x: 0.5, y: 0.6, ty: 0.12 }, s_final: { x: 0.35, y: 0.5, ty: 0.06 }, typed: { x: 0.5, y: 0.45, ty: 0.2 } };
/** An end trigger written by the writer, in the script's form. */
export const CTA_LINES = (kind, text, chip) => { const k = String(text).split(/\s+/)[0]; return cta(text, k, chip, kind, `${kind}_written`); };

export function assembleStory(key, s, kits, sourceId) {
  let n = 0;
  const lines = [...s.lines, s.end.line].map((l, i) => {
    const role = l.role ?? `l${i}`, take = `story/${key}/line${String(i + 1).padStart(2, "0")}.mp3`;
    const pop = l.visual || l.screen ? [{ word: 0, event: `show${++n}`, sfx: l.screen ? "tick" : "pop" }] : [];
    return { pose: "rest", ...l, role, take, cues: [...(l.cues ?? []), ...pop] };
  });
  const first = lines[0].shot ?? "two_shot";
    lines.forEach((l) => { if (l.role === "site") l.shot = "two_shot"; });   // both on screen for the reveal
  const closing = lines.at(-1); closing.shot = "two_shot";
  return {
    variant: key, title: s.title, template: s.template ?? "ai_fruit_story", voices: VOICES, world: s.world, music_bpm: s.music_bpm, music_shift: s.music_shift, no_phone: true, creation: s.creation, source_story: sourceId, search_title: s.search_title ?? null, caption: s.caption ?? null, hashtags: s.hashtags ?? null,
    lead: s.no_lead ? 0 : 0.15, gap_speaker: 0.2, gap_same: 0.16, tail: s.tail ?? 0.7, ...(s.first_second ? { first_second: true } : {}), ...(s.story_mode ? { story_mode: s.story_mode } : {}), music_db_under: s.music_db_under ?? 14, max_gap: 0.4, ...(s.energy ? { energy: s.energy, music_style: s.music_style ?? "drive" } : {}), start_at: first, hq_dir: kits[s.creation].hq_dir,
    headline: s.headline, recipe: { ...s.recipe, kind: "video", template: s.template ?? "ai_fruit_story", world: s.world, template_shown: s.template ?? "ai_fruit_story", cta: s.end.cta.id, source_story: sourceId }, cta: s.end.cta,
    ...(s.loop ? { loop_end: { secs: 0.5 } } : {}), clips: s.clips, lines, shots: shotsOf(lines, first),
    ...(s.lines.length ? {} : {}), events_extra: s.no_lead || s.energy ? [] : [{ t: 0, event: "open", sfx: "hit" }],
  };
}

/** A line with no visual is rejected (`keep` = it stays on the line before's prop); hooks are about the viewer. */
export function validateStory(s) {
  const problems = [];
  s.lines.forEach((l, i) => { if (!l.visual && !l.screen && !l.keep && l.role !== "cta" && i) problems.push(`line ${i + 1} has no visual: "${l.text}"`); });
  if (!s.lines[0].visual && !s.lines[0].screen) problems.push("the first line has no visual");
  if (!s.headline?.text) problems.push("no headline");
  if (/\bzyvo\b/i.test(s.headline?.text ?? "") || !s.energy && /\bzyvo\b/i.test(s.lines[0].text) && s.recipe.angle !== "A8") problems.push("Zyvo in the hook: it is the answer, never the hook");
  if (s.lines.filter((l) => l.role === "cta").length !== 1) problems.push("needs exactly one end trigger");
  return problems;
}

/** The one-story rules (owner, 2026-11-02; content/studio-notes/LEARNINGS.md), for written scripts. The owner reads the
 *  script before it renders, so these only catch what a template can't: the length, the first line, topic or making. */
export function validateThread(s) {
  const problems = [], L = s.lines, first = L[0], long = s.recipe.length_bucket === "60-90", most = long ? 12 : 6;
  if (L.length < 4 || L.length > most) problems.push(`it has ${L.length} lines: 4 to ${most}, counting the last line`);
  if (first.who !== "creator") problems.push("line 1 must be the creator: a big face on frame 0");
  if (/\b(zyvo|zee)\b/i.test(first.text)) problems.push(`line 1 never says Zyvo or Zee: "${first.text}"`);
  if (/^(how (to|do|can)\b|wait\b|so\b|okay\b)/i.test(first.text)) problems.push(`line 1 needs a strong first word and curiosity, not a how-to: "${first.text}"`);
  if (first.text.trim().split(/\s+/).length > 12) problems.push("line 1 is over 12 words");
  if (/^how to\b/i.test((s.headline?.text ?? "").replace(/\*/g, ""))) problems.push("the how-to goes in the caption, not the headline");
  if (s.story_mode === "topic") {
    const said = L.find((l) => /\b(zyvo|zee)\b/i.test(l.say ?? l.text));
    if (said) problems.push(`this video is about the topic: Zyvo only in the caption and on the end card, not "${said.text}"`);
    if (L.some((l) => l.screen)) problems.push("this video is about the topic: no app screens");
    if (!/\bzyvo\b/i.test(s.caption ?? "")) problems.push("the caption must say it was made with Zyvo");
  } else if (!L.some((l) => /\bzyvo\b/i.test(l.say ?? l.text))) problems.push("this video is about making it with Zyvo: a line must say so");
  return problems;
}
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
/** The largest share of one video's lines also found in another, and any shared main footage. */
export function similarity(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const A = list[i].lines.filter((l) => l.role !== "site").map((l) => norm(l.text)), B = new Set(list[j].lines.filter((l) => l.role !== "site").map((l) => norm(l.text)));
    const share = A.filter((x) => B.has(x)).length / Math.max(1, A.length);
    out.push({ a: list[i].variant, b: list[j].variant, share, sameFootage: list[i].creation === list[j].creation, sameWorld: list[i].world === list[j].world });
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [outDir, kitsDir] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const kits = Object.fromEntries(Object.entries(STORY_IDS).filter(([, id]) => fs.existsSync(path.join(kitsDir, id, "kit.json"))).map(([k, id]) => [k, JSON.parse(fs.readFileSync(path.join(kitsDir, id, "kit.json"), "utf8"))]));
  const all = [];
  let chars = 0;
  for (const key of STORY_KEYS) {
    let s; try { s = makeStory(key, kits); } catch (e) { console.log(`${key}: waiting for its kit (${e.message.slice(0, 50)})`); continue; }
    const p = validateStory(s);
    console.log(`${key}: ${s.world}, ${s.lines.length} lines, ${s.lines.reduce((a, l) => a + (l.say ?? l.text).length, 0)} chars${p.length ? ` PROBLEMS: ${p.join("; ")}` : ""}`);
    chars += s.lines.reduce((a, l) => a + (l.say ?? l.text).length, 0);
    fs.writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify(s, null, 1)); all.push(s);
  }
  console.log(`total ${chars} chars`);
  for (const r of similarity(all)) if (r.share > 0.3 || r.sameFootage) console.log(`TOO SIMILAR: ${r.a} / ${r.b} ${Math.round(r.share * 100)}% lines, same footage ${r.sameFootage}`);
}
