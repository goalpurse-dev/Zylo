// Zyvo Studio: short-video scripts (the Retention Engine, owner 2026-10-30) for audio.py + short.js, as
// makeScript(recipe, kit): the recipe picks the structure (V1–V5), the end trigger and the loop; the kit is one REAL
// creation (its moments, its upscaled frames, what was measured about it). Built from blocks: the existing paid voice
// takes (reused, trimmed at a word: "Step two: pick an idea" -> "Pick an idea") and the three trigger lines.
// Every claim is measured (3:50 from the first click: only a live recorded run has it) or on the fact sheet (150 fruit
// characters). A reused creation of the owner's has no measured time: its videos make no time claim.
//   node shortScripts.mjs <out dir>         writes the five first experiments (v1_result_first.json ... v5_cliffhanger.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VOICES = {
  default: "eleven",
  eleven: {
    creator: { id: "bIHbv24MWmeRgasZH58o", name: "Will - Relaxed Optimist (young, natural)", stability: 0.4, style: 0.35, speed: 1.05 },
    zee: { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica - Playful, Bright, Warm", stability: 0.35, style: 0.5, speed: 1.05 },
  },
};
const W = "#ffffff", Y = "Y";

/** The first experiments' creation: "Ten Years Out of Date", made live on the internal account (230.2 s measured). */
export const TEN_YEARS = {
  file: "video/m3/ten-years-out-of-date.mp4", hq_dir: "video/m3/hq", duration: 22.9, phone_skip: [[15.2, 19.0]], measured: 230, input: "the same idea card", title: "Ten Years Out of Date",
  // the real result's moments (cut points from its scene changes and the sound itself)
  moments: {
    angle: { in: 4.06, out: 8.08, note: "the cherry close up: 'That's just, um, a really good angle.'" },
    jobs: { in: 8.1, out: 11.5, note: "the lemon, arms crossed: 'You've had three jobs since that photo, Bing.'" },
    pizzas: { in: 12.08, out: 14.85, note: "the cherry panics: 'My date thinks I still deliver pizzas, okay?'" },
    ending: { in: 19.0, out: 22.35, note: "the ending: 'Too late, she's walking in right now.' + the lemon's smirk (after the line naming Google)" },
  },
  frame0: { V1: "angle", V2: "pizzas", V3: "jobs", V4: "angle", V5: "pizzas" },
  ending_sfx: [[2.95, "sparkle"]],
  hooks: { V1: "I MADE THIS IN|*UNDER 4 MINUTES*", V2: "THIS FRUIT DRAMA|TOOK *3:50* TO MAKE", V5: "HE LIED ON HIS|*DATING PROFILE*" },
  open_loops: { V1: ["WAIT TILL SHE ", "WALKS IN 👀"] },
  notes: {
    V1: "'ONE sentence' is not true for this run (an idea card was clicked), so the hook uses the measured time",
    V3: "the owner's line 'POV: you found the site that makes these fruit videos' is 10 words; cut to 7 (the frame-0 rule)",
  },
};

// the lines (takes under the scratchpad: studio-m7 = the Fruit v3 takes, studio-m5 = the M3 v1 takes, short = the triggers)
const q = { role: "q", who: "creator", take: "studio-m7/takes/line01.mp3", text: "Yo Zyvo, how do you make a video like this?", key: ["this?"], expr: "thinking", pose: "pointUpL" };
const answer = { role: "answer", who: "zee", take: "studio-m7/takes/line02.mp3", text: "It's simple. But most people are too lazy to actually do it.", key: ["lazy"], expr: "smug", pose: "rest",
  cues: [{ word: 3, event: "lazy", sfx: "pop" }] };   // the chip turns to "TOO LAZY" as she says it (a visual change mid-line)
const step = (n, take, text, key, card, chip, extra = {}) => ({ role: `s${n}`, who: "zee", take: `studio-m7/takes/${take}`, from_word: 2, text, key: [key], expr: "happy", pose: n === 1 ? "point" : "rest", step: n, card, chip, ...extra });
const steps = (kit) => ({
  nav: (n) => step(n, "line05.mp3", "Short Form, then AI Fruit Story.", "Fruit", "step1", ["SHORT FORM → ", "AI FRUIT STORY"]),
  // a typed re-entry ("Describe it") is said as such: the screen and the words match
  idea: (n) => (kit.input === "typed into Describe it"
    ? { ...step(n, "line04.mp3", "Pick an idea. Or write your own.", "own.", "step2", ["IDEA OR ", "YOUR OWN"]), take: "studio-m5/takes/line04.mp3" }
    : step(n, "line06.mp3", "Pick an idea and a length.", "idea", "step2", ["IDEA + ", "LENGTH"])),
  pics: (n) => step(n, "line07.mp3", "Check every scene picture.", "picture.", "step3", ["SCENE ", "PICTURES"]),
  anim: (n) => step(n, "line08.mp3", "Animate. They talk, with sound.", "Animate.", "step4", ["", "ANIMATE"]),
  final: (n) => step(n, "line09.mp3", "Make the final video.", "final", "step5", ["FINAL ", "VIDEO"], kit.measured ? { badge: kit.measured } : {}),
});
const twist = { role: "twist", who: "zee", take: "studio-m7/takes/line10.mp3", text: "And there are a hundred and fifty fruit characters to cast.", key: ["fifty"], expr: "smug", pose: "point",
  cues: [{ word: 2, event: "wall", sfx: "sparkle" }, { word: 3, event: "counter" }, { word: 8, event: "counterEnd", sfx: "pop" }] };
const objection = { role: "objection", who: "creator", take: "studio-m7/takes/line11.mp3", text: "Okay, how long did that take?", key: ["long"], expr: "shocked", pose: "shrug" };
const time = { role: "time", who: "zee", take: "studio-m7/takes/line12.mp3", text: "Three minutes, fifty seconds. First click to final video.", key: ["fifty"], expr: "smug", pose: "rest",
  cues: [{ word: 0, event: "timer", sfx: "tick" }, { word: 3, event: "timerEnd", sfx: "pop" }] };
const site = { role: "site", who: "zee", take: "studio-m7/takes/line13.mp3", text: "It's called Zyvo. tryzyvo.com, link in bio.", say: "It's called Zyvo. Try zyvo dot com, link in bio.", key: ["tryzyvo.com,"], expr: "happy", pose: "point",
  cues: [{ word: 3, event: "site", sfx: "sparkle" }, { word: 4, event: "bio", sfx: "pop" }] };
const siteShort = { ...site, from_word: 3, text: "tryzyvo.com, link in bio.", say: "Try zyvo dot com, link in bio.", cues: [{ word: 0, event: "site", sfx: "sparkle" }, { word: 1, event: "bio", sfx: "pop" }] };
// ONE engagement trigger at the end, rotated (owner): comment / repost / save
export const CTA = {
  comment: { line: { role: "cta", who: "zee", take: "studio-m7/takes/line14.mp3", text: "Comment FRUIT if you're actually gonna try it.", key: ["FRUIT"], expr: "happy", pose: "wave", cues: [{ word: 0, event: "cta", sfx: "pop" }] }, cta: { id: "comment_fruit", kind: "comment", chip: "COMMENT FRUIT" } },
  repost: { line: { role: "cta", who: "zee", take: "short/takes/send_friend.mp3", text: "Send this to that friend.", key: ["friend."], expr: "smug", pose: "wave", cues: [{ word: 0, event: "cta", sfx: "pop" }] }, cta: { id: "repost_friend", kind: "repost", chip: "SEND TO THAT FRIEND" } },
  save: { line: { role: "cta", who: "zee", take: "short/takes/save_later.mp3", text: "Save this for later.", key: ["Save"], expr: "happy", pose: "wave", cues: [{ word: 0, event: "cta", sfx: "pop" }] }, cta: { id: "save_later", kind: "save", chip: "SAVE FOR LATER" } },
};
const loopChip = (at, a, b) => ({ at, parts: [[a, W], [b, Y]] });
const idx = (lines, role) => lines.findIndex((l) => l.role === role);
const hookWords = (h) => h.replace(/[|*]/g, " ").split(/\s+/).filter(Boolean).length;
/** A story title as a frame-0 hook: up to 7 words, two rows, the last two words yellow. */
export function titleHook(title) {
  const w = String(title ?? "").toUpperCase().replace(/[^A-Z0-9'’ ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 7);
  if (w.length < 2) return "WAIT FOR|*THE ENDING*";
  const cut = Math.ceil(w.length / 2), key = w.length - Math.min(2, w.length - 1);
  return `${w.slice(0, cut).join(" ")}|${w.slice(cut).map((x, i) => (cut + i >= key ? `*${x}*` : x)).join(" ")}`.replace(/\*\s\*/g, " ").replace(/\* \*/g, " ");
}

/** One short-video script: recipe {variant V1–V5, end_trigger, loop} × kit (one real creation). */
export function makeScript(recipe, kit = TEN_YEARS) {
  const V = recipe.variant, S = steps(kit), timed = !!kit.measured;
  const moment = (name) => kit.moments[name] ?? kit.moments.open;
  const open = (extra) => ({ name: "open", file: kit.file, ...moment(kit.frame0?.[V] ?? "open"), at: "start", post: 0.12, duck_db: 10, fullscreen: true, enter: "cut", punch: [0.5, 2.1], ...extra });
  const payoff = (after) => ({ name: "payoff", file: kit.file, ...moment("ending"), after_line: after, pre: 0.35, post: 0.02, duck_db: 24, fullscreen: true, enter: "grow", ...(kit.ending_sfx ? { sfx_at: kit.ending_sfx } : {}), pays_loop: { parts: [["THE ", W], ["ENDING 👀", Y]] } });
  const ol = (at) => loopChip(at, ...(kit.open_loops?.[V] ?? ["WAIT FOR THE ", "ENDING 👀"]));
  const lazyChips = [{ from: "answer.start", to: "lazy.at", parts: [["IT'S ", W], ["SIMPLE", Y]] }, { from: "lazy.at", to: "s1.start", parts: [["MOST PEOPLE ARE ", W], ["TOO LAZY", Y]] }];
  const made = (to) => ({ from: "twist.start", to, parts: [["MADE WITH ", W], ["ZYVO", Y]] });
  const tail = [{ to: "phoneFull", at: "payoff.start-1.15", dur: 0.85, kind: "push" }, { to: "zee", at: "payoff.end+0.05", dur: 0.6, kind: "pull" }];
  const toWall = { to: "wall", at: "twist.start-0.25", dur: 0.8, kind: "crane" }, toSteps = { to: "steps", at: "s1.start-0.55", dur: 0.7, kind: "crane" };
  let v;
  if (V === "V1") {   // RESULT-FIRST: the funniest real moment full screen on frame 0; fast steps; 25–30 s
    const lines = [q, S.nav(1), S.idea(2), S.pics(3), S.anim(4), S.final(5), twist, site];
    v = { variant: "v1_result_first", title: timed ? "Studio V1 · Result first: I made this in under 4 minutes" : `Studio V1 · Result first: ${kit.title}`,
      recipe: { variant: "V1", hook_type: "result_first", length_s: [25, 30], loop: true, frame0: kit.frame0?.V1 ?? "open", open_loop: kit.open_loops?.V1 ? "wait till she walks in → the ending" : "wait for the ending → the ending", ...(kit.notes?.V1 ? { note: kit.notes.V1 } : {}) },
      length_target: [25, 30], steps_total: 5,
      clips: [open({ hook: kit.hooks?.V1 ?? "I MADE THIS|IN *5 STEPS*", open_loop: ol(1.2) }), payoff(idx(lines, "twist"))], lines,
      shots: [{ to: "hook", at: "open.end+0.02", dur: 0.55, kind: "pull" }, toSteps, toWall, ...tail],
      chips: [{ from: "q.start", to: "s1.start", parts: [["HOW DO YOU MAKE ", W], ["THIS?", Y]] }, made("payoff.start")] };
  } else if (V === "V2") {   // FAST 20 s: hook clip -> 3 fast steps -> payoff -> reveal
    const lines = [S.idea(1), S.anim(2), S.final(3), siteShort];
    v = { variant: "v2_fast20", title: timed ? "Studio V2 · Fast 20 s: this fruit drama took 3:50 to make" : `Studio V2 · Fast 20 s: ${kit.title}`,
      recipe: { variant: "V2", hook_type: "result_first_fast", length_s: [15, 20], loop: true, frame0: kit.frame0?.V2 ?? "open", open_loop: "wait for the ending → the ending" },
      length_target: [15, 20], steps_total: 3, tempo: 1.1,
      clips: [open({ hook: kit.hooks?.V2 ?? "THIS WHOLE DRAMA|IS *AI-MADE*", punch: [0.45, 1.9], open_loop: ol(1.0) }), payoff(idx(lines, "s3"))], lines,
      shots: [{ to: "steps", at: "open.end+0.02", dur: 0.65, kind: "crane" }, { to: "phoneFull", at: "payoff.start-1.1", dur: 0.8, kind: "push" }, { to: "zee", at: "payoff.end+0.05", dur: 0.55, kind: "pull" }],
      chips: [] };
  } else if (V === "V3") {   // POV over the real result, then a fast tour
    const lines = [answer, S.nav(1), S.idea(2), S.pics(3), S.anim(4), S.final(5), twist, site];
    v = { variant: "v3_pov", title: timed ? "Studio V3 · POV: you found the fruit video site" : `Studio V3 · POV: ${kit.title}`,
      recipe: { variant: "V3", hook_type: "pov", length_s: [25, 30], loop: true, frame0: kit.frame0?.V3 ?? "open", open_loop: "wait for the ending → the ending", ...(kit.notes?.V3 ? { note: kit.notes.V3 } : {}) },
      length_target: [25, 30], steps_total: 5,
      clips: [open({ hook: "POV: YOU FOUND THE|*FRUIT VIDEO* SITE", open_loop: ol(1.2) }), payoff(idx(lines, "twist"))], lines,
      shots: [{ to: "zee", at: "open.end+0.02", dur: 0.55, kind: "pull" }, toSteps, toWall, ...tail],
      chips: [...lazyChips, made("payoff.start")] };
  } else if (V === "V4") {   // STUDIO DIALOGUE, FASTER: the real clip big at 0.0, 30–35 s (the clock only when measured)
    const lines = [q, answer, S.nav(1), S.idea(2), S.pics(3), S.anim(4), S.final(5), twist, ...(timed ? [objection, time] : []), site];
    v = { variant: "v4_studio_fast", title: timed ? "Studio V4 · Studio dialogue, faster: how do you make this?" : `Studio V4 · How do you make this? ${kit.title}`,
      recipe: { variant: "V4", hook_type: "question", length_s: [30, 35], loop: true, frame0: kit.frame0?.V4 ?? "open", open_loop: "website at the end → the website", open_loop_paid_by: "site" },
      length_target: timed ? [30, 35] : [25, 32], steps_total: 5, tempo: 1.15,
      clips: [open({ hook: "HOW DO YOU|MAKE *THIS?*", open_loop: loopChip(1.2, "WEBSITE AT THE ", "END 👀") }), payoff(idx(lines, timed ? "time" : "twist"))], lines,
      shots: [{ to: "hook", at: "open.end+0.02", dur: 0.55, kind: "pull" }, { to: "zee", at: "answer.start-0.1", dur: 0.45, kind: "whip" }, toSteps, toWall,
        ...(timed ? [{ to: "creator", at: "objection.start-0.35", dur: 0.6, kind: "pull" }, { to: "zeeLow", at: "objection.end-0.05", dur: 0.45, kind: "whip" }, { to: "phoneFull", at: "payoff.start-1.1", dur: 0.85, kind: "push" }] : [tail[0]]), tail[1]],
      chips: [{ from: "q.start", to: "answer.start", parts: [["HOW DO YOU MAKE ", W], ["THIS?", Y]] }, ...lazyChips,
        ...(timed ? [made("objection.start"), { from: "objection.start", to: "payoff.start", parts: [["FIRST CLICK → ", W], ["FINAL VIDEO", Y]] }] : [made("payoff.start")])] };
  } else if (V === "V5") {   // CLIFFHANGER: the most dramatic line, a freeze "how does this end?", the steps, the ending
    const lines = [answer, S.nav(1), S.idea(2), S.pics(3), S.anim(4), S.final(5), twist, site];
    v = { variant: "v5_cliffhanger", title: timed ? "Studio V5 · Cliffhanger: how does this end?" : `Studio V5 · Cliffhanger: ${kit.title}`,
      recipe: { variant: "V5", hook_type: "cliffhanger", length_s: [25, 30], loop: true, frame0: kit.frame0?.V5 ? `${kit.frame0.V5} + freeze` : "open + freeze", open_loop: "how does this end? → the ending" },
      length_target: [25, 30], steps_total: 5,
      clips: [open({ hook: kit.hooks?.V5 ?? titleHook(kit.title), punch: [0.45, 1.9], open_loop: loopChip(1.1, "HOW DOES THIS ", "END? 👀"), freeze: { secs: 1.25, text: "HOW DOES|THIS *END?*" } }), payoff(idx(lines, "twist"))], lines,
      shots: [{ to: "zee", at: "open.freeze_end+0.02", dur: 0.55, kind: "pull" }, toSteps, toWall, ...tail],
      chips: [...lazyChips, made("payoff.start")] };
  } else throw new Error(`unknown variant ${V}`);
  const hook = v.clips[0].hook;
  if (hookWords(hook) > 7) throw new Error(`the frame-0 hook "${hook}" is over 7 words`);
  const trigger = recipe.end_trigger ?? { V1: "comment", V2: "save", V3: "repost", V4: "comment", V5: "repost" }[V];
  const loop = recipe.loop !== false;
  return {
    template: "ai_fruit_story", voices: VOICES, tempo: 1.15, squeeze: 0.18, lead: 0, gap_speaker: 0.14, gap_same: 0.08, tail: 0.55, music_db_under: 14,
    phone_full: true, phone_range: [0.0, kit.duration], hq_dir: kit.hq_dir, phone_skip: kit.phone_skip ?? [], max_gap: 0.4, start_at: "phone", ...(loop ? { loop_end: { secs: 0.5 } } : {}),
    counter: { value: 150, label: "FRUIT CHARACTERS", fact: "fruit_characters" }, ...(timed ? { timer: { seconds: kit.measured, label: "FIRST CLICK → FINAL VIDEO", source: "fruitRun summary.json (measured live)" } } : {}),
    ...v, lines: [...v.lines, CTA[trigger].line], cta: CTA[trigger].cta,
    recipe: { ...v.recipe, loop, end_trigger: trigger, cta: CTA[trigger].cta.id, ...(recipe.experiment_of ? { experiment_of: recipe.experiment_of, changes: recipe.changes } : {}) },
  };
}

export const STARTERS = [{ variant: "V1", end_trigger: "comment" }, { variant: "V2", end_trigger: "save" }, { variant: "V3", end_trigger: "repost" }, { variant: "V4", end_trigger: "comment" }, { variant: "V5", end_trigger: "repost" }];

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const outDir = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "scripts", "short");
  fs.mkdirSync(outDir, { recursive: true });
  for (const r of STARTERS) {
    const v = makeScript(r, TEN_YEARS), f = path.join(outDir, `${v.variant}.json`);
    fs.writeFileSync(f, JSON.stringify(v, null, 1));
    console.log(`${v.variant}: ${v.lines.length} lines, hook "${v.clips[0].hook}" (${hookWords(v.clips[0].hook)} words), trigger ${v.recipe.end_trigger} -> ${f}`);
  }
  // the two new trigger lines (ElevenLabs, Jessica): 45 characters, made 2026-10-30 ($0.0040)
  fs.writeFileSync(path.join(outDir, "new_lines.json"), JSON.stringify({ voices: VOICES, lines: [CTA.save.line, CTA.repost.line].map((l) => ({ who: l.who, text: l.text, file: path.basename(l.take) })) }, null, 1));
}
