// ROUND 9 PART 1 (owner 2026-11-23): THE CHALK-LINE REPLICA on the round 8 continuous-take system. INTERNAL ONLY: never
// posted, never a template; the reference stays in the git-ignored reference folder, only what we learn goes into the
// engine. The script word for word, the owner's roblox-story voice at 1.3x, the cuts on the same words as the reference,
// every reference shot's subject size / camera height / move matched (measured: zc_measure), the stills in ONE GPU job
// compared with the reference frames by eye (no paid vision), at most 2 fix rounds, one low-quality preview and a
// side-by-side video (the reference re-timed shot by shot to our voice).
//   node --env-file=.env.local scripts/blockyWorlds/round9/replica9.mjs --out reference/blocky-worlds/round9/replica --yes [--stills r0] [--video]
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { castVoice } from "../engine/voice/castVoice.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";
import { captionColors } from "../blenderKit/speakers.mjs";
import { ledger } from "../studio/ledger.mjs";
import { timedWords } from "../blenderKit/sceneCards.mjs";
import { compileTakes, lockLooks, applyCard, initialState } from "../blenderKit/takes.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const ROOT = path.join(HERE, "..", "..", "..");
const REF = path.join(ROOT, "reference", "blocky-worlds");
const A = path.join(REF, "analysis", "7698966230471953677");
const REFVID = path.join(REF, "videos", "snaptik_7698966230471953677_v3.mp4");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 1.1));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const save = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));
const load = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) : null);
if (!has("yes")) { say(`replica: dry run (add --yes); spent $${L.total()}`); process.exit(0); }
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");

// ---- 1. THE SCRIPT, word for word (the reference transcript), all told by the narrator
const TR = JSON.parse(fs.readFileSync(path.join(A, "transcript.json"), "utf8"));
const script = { title: "The Chalk Line (replica)", lines: TR.segments.map((g) => ({ text: g.words.map((w) => w.w.trim()).join(" "), speaker: "narrator" })) };
const refWords = TR.segments.flatMap((g) => g.words.map((w) => ({ w: w.w.trim(), s: w.s, e: w.e })));
save("script.json", script);

// ---- the voice: the owner's roblox-story narrator at 1.3x
const VD = path.join(OUT, "voice");
let V = has("fake-voice") ? { words: refWords.map((w) => ({ word: w.w, start: w.s, end: w.e })), duration: 65.9 } : load("voice_1.3.json");
if (!V) {
  L.check("voice", 0.3);
  const r = await castVoice({ script, voices: {}, outDir: VD, apiKey: process.env.ELEVENLABS_KEY ?? process.env.ELEVENLABS_API_KEY, log: say });
  L.add("voice", r.costUsd);
  fs.copyFileSync(r.wav, path.join(VD, "voice_1.3.wav"));
  V = { words: r.words, duration: r.duration };
  save("voice_1.3.json", V);
  say(`voice: ${r.duration.toFixed(1)} s at 1.3x (the reference: 65.9 s); $${r.costUsd}`);
}
const tw = timedWords(script, V.words.map((w) => ({ word: w.word, start: w.start, end: w.end })));
if (tw.length !== refWords.length) throw new Error(`word count ${tw.length} vs the reference ${refWords.length}`);
const lines = script.lines.map((l, i) => {
  const ws = tw.map((w, j) => ({ ...w, j })).filter((w) => w.line === i + 1);
  return { text: l.text, speaker: "narrator", start: ws[0].start, end: ws.at(-1).end, words: ws.map((w) => ({ word: w.word, start: w.start })), w0: ws[0].j };
});
lines.forEach((Ln, i) => { Ln.next = lines[i + 1]?.start ?? Ln.end + 0.25; });

// ---- 2. THE REFERENCE SHOTS -> OUR CUTS ON THE SAME WORDS. ref_h = the subject's share of the frame height I measured
// on the reference's mid frames (round9/replica/ref/ref_mid_*.jpg); our cut = the closest recipe
const SH = JSON.parse(fs.readFileSync(path.join(A, "shots.json"), "utf8")).shots;
const SPEC = {
  2: ["aerial", [], "push_in", null], 3: ["medium", ["dad"], "push_in", 0.45], 4: ["two", ["dad", "me"], "push_in", 0.55],
  5: ["low", ["me", "ball#lawn"], "push_in", 0.3], 6: ["insert", ["dog#lawn", "chalk_line#dog_lawn"], "push_in", 0.25], 7: ["top", ["chalk_line#dog_lawn"], "top_down", 0.6],
  8: ["low", ["car#kerb"], "push_in", 0.25], 9: ["top", ["chalk_line#car_kerb"], "top_down", 0.75], 10: ["medium", ["guy", "pizza_box#guy"], "push_in", 0.65],
  11: ["street", [], "push_in", null], 12: ["high", ["chalk_line#house"], "push_in", null], 13: ["legs", ["me", "chalk_line#house"], "push_in", 1.0], 14: ["medium", ["me"], "push_in", 0.7],
  15: ["medium", ["dad"], "track", 0.45], 16: ["two", ["dad", "me"], "push_in", 0.6], 17: ["close", ["dad"], "push_in", 0.8], 18: ["street", [], "track", null],
  20: ["medium", ["me"], "push_in", 0.7], 21: ["high", ["chalk_line#house"], "push_in", null], 22: ["medium", ["dad"], "push_in", 0.55], 23: ["medium", ["dad"], "tilt_up", 0.4],
  25: ["close", ["dad"], "push_in", 0.7], 26: ["medium", ["dad"], "push_in", 0.35], 27: ["street", [], "push_in", null], 28: ["close", ["me"], "push_in", 0.75],
  29: ["low", ["monster"], "track", 0.9], 30: ["wide", ["dad"], "push_in", 0.2], 31: ["low", ["dad", "monster"], "push_in", 0.5], 32: ["medium", ["me"], "push_in", 0.45],
  33: ["medium", ["me", "chalk#dad"], "push_in", 0.7], 34: ["medium", ["me"], "push_in", 0.6], 35: ["low", ["me", "monster"], "track", 0.6], 36: ["low", ["monster", "me"], "push_in", 0.9],
  37: ["low", ["me", "monster"], "track", 0.55], 38: ["top", ["chalk_line#monster"], "top_down", null], 39: ["low", ["monster", "me"], "tilt_up", 1.0], 40: ["low", ["me", "monster"], "tilt_up", 0.6],
  41: ["legs", ["monster", "chalk_line#monster"], "push_in", 1.0], 42: ["wide", ["monster", "chalk_line#monster"], "push_in", 0.6], 43: ["medium", ["me"], "tilt_up", 0.7], 44: ["low", ["monster"], "tilt_up", 1.0],
  45: ["wide", ["monster", "roof#monster"], "push_in", 0.6], 46: ["low", ["monster", "roof#monster"], "push_in", 0.8], 47: ["low", ["roof#monster"], "tilt_up", 0.9],
  48: ["two", ["crowd0", "crowd1"], "push_in", 0.5], 49: ["wide", ["monster", "chalk_line#monster"], "push_in", 0.4], 50: ["close", ["monster"], "static", 1.0],
};
const REFV = { 3: 0.45, 4: 0.55, 5: 0.45, 6: 0.55, 7: 0.55, 8: 0.55, 9: 0.5, 10: 0.5, 13: 0.35, 14: 0.5, 15: 0.45, 16: 0.55, 17: 0.5, 20: 0.45, 22: 0.5, 23: 0.4, 25: 0.45, 26: 0.5, 28: 0.5, 29: 0.45, 30: 0.55, 31: 0.6, 32: 0.45, 33: 0.5, 34: 0.5, 35: 0.6, 36: 0.5, 37: 0.5, 39: 0.5, 40: 0.6, 41: 0.55, 42: 0.5, 43: 0.5, 44: 0.5, 45: 0.45, 46: 0.45, 47: 0.45, 48: 0.6, 49: 0.5, 50: 0.5 };
// each reference shot starts on the first word that begins at (or just before) its first frame
const wordAt = (t) => { const i = refWords.findIndex((w) => w.s >= t - 0.12); return i < 0 ? refWords.length - 1 : i; };
const refCuts = [];
for (const s of SH) {
  if (!SPEC[s.n]) continue;
  const wi = s.n === 2 ? 0 : wordAt(s.t0);
  if (refCuts.length && refCuts.at(-1).wi >= wi) continue;   // two reference cuts on one word: the first one stays
  refCuts.push({ n: s.n, wi, refT0: s.t0, refT1: s.t1, spec: SPEC[s.n] });
}
for (let k = 0; k < refCuts.length; k++) refCuts[k].refT1 = k + 1 < refCuts.length ? SH.find((s) => s.n === refCuts[k + 1].n).t0 : 65.9;

const NEEDS = {
  2: ["aerial camera (high, down the road at an angle)", "low brick houses + big lawns", "chalk line round every house", "dusk light", "the dark suburb (brick, tiles, porches, chimneys, driveways, fences, bins, pines, kerbs, slabs, crossing, hills)"], 3: ["dad (older, moustache, balding, white t-shirt, pajamas)", "crouch drawing pose", "a small chalk stick in the fist", "line appears behind the chalk", "matte chalk line (not glowing)"],
  4: ["dad", "kid (red)", "two-shot keeping both faces"], 5: ["kid", "ball outside the line", "chalk line"], 6: ["dog (full size)", "chalk circle round the dog"], 7: ["top-down camera", "dog in its circle"], 8: ["car parallel to the kerb", "straight chalk box"], 9: ["top-down camera", "car in its box"],
  10: ["pizza delivery guy (dark hair, red uniform)", "pizza box (two hands)", "dusk light"], 11: ["low brick house at night", "dim windows"], 12: ["high camera over a house", "the house's chalk line"], 13: ["kid's legs at the line", "low camera"], 14: ["kid worried face"], 15: ["dad", "track move"], 16: ["dad + kid", "give the chalk"], 17: ["dad close", "talking"],
  18: ["storm: dark sky", "rain streaks you can see"], 20: ["kid in the rain", "rain streaks"], 21: ["the line washing away (fades, streaks)"], 22: ["dad's panic run in the rain"], 23: ["dad holding chalk", "tilt up"], 25: ["chalk melting in the hand (disappears)"], 26: ["rain stops"], 27: ["street lamps going out one by one"],
  28: ["kid startled by a window"], 29: ["the monster: black, thin, jointed, taller than the lamps, glowing eyes", "the monster's own walk (slow, stiff, arms dragging, head tilting)"], 30: ["dad on the lawn, small"], 31: ["dad in front, the monster coming", "low camera near the kid looking up"], 32: ["the kid's sprint"], 33: ["chalk out of the pocket", "a small chalk stick in the fist"], 34: ["kid looking at dad"],
  35: ["kid + monster legs, low"], 36: ["kid running round the monster's legs", "the kid + monster camera (both in frame)"], 37: ["the kid's bent-over chalk run", "the circle growing behind the chalk"], 38: ["top-down: the closed circle round the monster's feet"], 39: ["the monster reaching down", "tilt", "the kid + monster camera (both in frame)"], 40: ["kid inside the circle, the giant hand"],
  41: ["a faint wall shimmer where the hand hits", "a ripple where the hand hits", "only the monster's legs + hanging arms"], 42: ["the monster standing in its circle"], 43: ["kid to camera"], 44: ["the monster's silhouette, eyes"], 45: ["morning light", "the monster in its circle"], 46: ["a roof on posts sized to the monster", "low camera up"], 47: ["the roof, tilt up"],
  48: ["kids playing at night (a crowd, lit)"], 49: ["high wide: the monster in its ring in the street"], 50: ["the monster's head close, still"],
};
const BUILT9B = ["aerial camera (high, down the road at an angle)", "low brick houses + big lawns", "crouch drawing pose", "line appears behind the chalk", "dad (older, moustache, balding, white t-shirt, pajamas)", "dog (full size)", "car parallel to the kerb", "straight chalk box", "pizza delivery guy (dark hair, red uniform)", "pizza box (two hands)", "high camera over a house", "dim windows", "rain streaks you can see", "storm: dark sky", "the line washing away (fades, streaks)", "dad's panic run in the rain", "the kid's sprint", "the kid's bent-over chalk run", "the circle growing behind the chalk", "the monster: black, thin, jointed, taller than the lamps, glowing eyes", "the monster's own walk (slow, stiff, arms dragging, head tilting)", "the invisible wall flashing up from the line", "a ripple where the hand hits", "only the monster's legs + hanging arms", "a roof on posts sized to the monster", "kids playing at night (a crowd, lit)", "chalk line round every house", "the town rule checked on every shot (inside a closed line)", "the dark suburb (brick, tiles, porches, chimneys, driveways, fences, bins, pines, kerbs, slabs, crossing, hills)", "a small chalk stick in the fist", "matte chalk line (not glowing)", "a faint wall shimmer where the hand hits", "the kid + monster camera (both in frame)"];
const needs = Object.entries(NEEDS).map(([n, xs]) => ({ ref: Number(n), needs: xs.map((x) => ({ need: x, status: BUILT9B.includes(x) ? "build (built in round 9b)" : "have" })) }));
fs.writeFileSync(path.join(OUT, "have_build.json"), JSON.stringify(needs, null, 1));
fs.writeFileSync(path.join(OUT, "have_build.md"), ["# The chalk-line replica: what every shot needs", "", "| ref shot | needs | have / build |", "|---|---|---|", ...needs.flatMap((x) => x.needs.map((y, i) => `| ${i ? "" : x.ref} | ${y.need} | ${y.status} |`))].join("\n"));

// ---- 3. THE PLAN + THE LINE CARDS (the story's actions; the code checks them against the state)
const plan = {
  title: script.title, house_rings: true, low_houses: true, rings_around: ["dog#lawn", "car#kerb", "car#kerb2", "car#kerb3"],
  rule_check: { times: ["night", "storm"], what: "at night every person, pet and car that is safe is INSIDE a closed chalk line",
    outside: { 2: ["ball#lawn"], 7: ["me", "dad"], 8: ["me", "dad"], 9: ["me", "dad"], 10: ["me", "dad"], 11: ["me", "dad", "monster"], 12: ["me", "dad", "monster"], 13: ["me", "dad", "monster"], 14: ["me", "dad", "monster"], 15: ["me", "dad", "monster"], 16: ["me", "dad"], 17: ["me", "dad"], 19: ["me", "dad"], 20: ["me", "dad"], 21: ["me", "dad"] } },
  cast: [{ name: "Me", kid: true, hair: "spiky", hair_color: "#d4381c", shirt: "#d62a1e", pants: "#c42a1c" }, { name: "Dad", kid: false, hair: "short", hair_color: "#5a3a1e", shirt: "#f4f4f4", pants: "#7fa8e0", style: "dad" }, { name: "Guy", kid: false, hair: "short", hair_color: "#1a1a1a", shirt: "#c0392b", pants: "#a93226" }],
  monster: { present: true, style: "shadow", size: 4 },
  rule: { sentence: "a chalk line makes a house", object: { thing: "chalk_line", where: "on_ground" } },
  stage: { suburb_street: { camera_side: "front", marks: { Me: "@-3,18", Dad: "@1.5,18.6", Guy: "@4,10.5", "pizza_box#guy": "@4,10.5", "car#kerb2": "@-22,4.2", "car#kerb3": "@26,-4.2", "ball#lawn": "@5,12.5", "dog#lawn": "@-14,13.5", "car#kerb": "@12,4.2", "chalk#dad": "@0,15" } } },
  scenes: [[1, 1, "sunset"], [2, 3, "night"], [4, 4, "sunset"], [5, 6, "night"], [7, 8, "storm"], [9, 17, "night"], [18, 18, "morning"], [19, 21, "night"]].map(([a, b, t], i) => ({ id: i + 1, lines: [a, b], place: "suburb_street", time: t, busy: "empty" })),
  props: [{ kind: "chalk", size: 1.0 }, { kind: "ball", size: 1.7 }, { kind: "dog", size: 1.9 }, { kind: "car", size: 1.0 }, { kind: "roof", size: 1.6 }],
};
const A_ = (who, d, o = {}) => ({ who, do: d, target: "", to: "", text: "", on_word: 0, ...o });
const ACTS = {
  1: [A_("dad", "draw_line", { target: "chalk_line#house", on_word: 3 })],
  2: [A_("me", "turn_to", { target: "ball#lawn", on_word: 7 })],
  4: [A_("guy", "shake_head", { on_word: 2 }), A_("guy", "exit", { on_word: 17 })],
  5: [A_("me", "look_around", { on_word: 0 })],
  6: [A_("dad", "draw_line", { target: "chalk_line#house", on_word: 3 }), A_("dad", "give", { target: "me", on_word: 12 })],
  7: [A_("dad", "talk", { on_word: 0 }), A_("chalk_line#house", "wash_away", { target: "chalk_line#house", on_word: 17 })],
  8: [A_("dad", "run_to", { to: "@3,11", text: "panic", on_word: 1 }), A_("chalk#dad2", "appear", { target: "chalk#dad2", to: "dad", on_word: 0 }), A_("dad", "pick_up", { target: "chalk#dad2", on_word: 0 }), A_("chalk#dad2", "disappear", { target: "chalk#dad2", on_word: 9 })],
  9: [A_("monster", "switch_all_off", { target: "lamps", text: "one by one", on_word: 6 })],
  10: [A_("me", "shiver", { on_word: 5 })],
  11: [A_("monster", "enter", { to: "@-6,1.5", on_word: 0 })],
  12: [A_("monster", "walk_to", { to: "@1,3.2", on_word: 6 }), A_("dad", "turn_to", { target: "monster", on_word: 7 })],
  13: [A_("me", "run_to", { to: "@-2,6.5", text: "sprint", on_word: 1 }), A_("me", "turn_to", { target: "dad", on_word: 12 })],
  14: [A_("me", "draw_around", { target: "monster", on_word: 1 })],
  15: [A_("monster", "turn_to", { target: "me", on_word: 1 }), A_("monster", "point", { target: "me", on_word: 3 })],
  16: [A_("monster", "hit_wall", { on_word: 2 })],
  18: [A_("roof#monster", "appear", { target: "roof#monster", to: "monster", on_word: 5 })],
  19: [A_("me", "cheer", { on_word: 3 }), A_("monster", "crowd", { text: "play", on_word: 2 })],
};
const FACES = { 2: { me: "scared" }, 5: { me: "scared" }, 7: { me: "sad" }, 8: { dad: "shocked" }, 10: { me: "terrified" }, 12: { dad: "scared" }, 13: { me: "determined" }, 14: { me: "determined" }, 15: { me: "terrified" }, 16: { me: "smirk" }, 19: { me: "happy" } };
const looks = lockLooks(plan.cast);
const sceneOf = (n) => plan.scenes.find((x) => n >= x.lines[0] && n <= x.lines[1]);
let S = initialState(plan);
// the chalk the dad gives me / the second chalk: owned things in their hands from the stage map
const cards = [], states = [], problems = [];
for (let n = 1; n <= lines.length; n++) {
  const cuts = refCuts.filter((c) => c.wi >= lines[n - 1].w0 && c.wi < lines[n - 1].w0 + lines[n - 1].words.length)
    .map((c) => ({ from_word: c.wi - lines[n - 1].w0, shot: c.spec[0], show: c.spec[1], move: c.spec[2], ref: c.n }));
  // a line with no reference cut of its own continues the cut before (no new cut)
  const card = { line: n, actions: ACTS[n] ?? [], faces: FACES[n] ?? {}, cuts };
  states[n] = S;
  const r = applyCard(S, card, { place: sceneOf(n).place, line: lines[n - 1], plan });
  if (r.problems.length) problems.push(...r.problems.map((p) => `line ${n}: ${p}`));
  cards.push({ ...card, actions: r.applied });
  S = r.state;
}
states[lines.length + 1] = S;
say(`cards: ${refCuts.length} cuts on the reference's words (${SH.length} reference shots; ${SH.length - refCuts.length} merged: under a word apart); THE STATE CHECK: ${problems.length} problem(s)${problems.length ? `: ${problems.join(" | ")}` : ""}`);
save("cards.json", { cards, refCuts, problems });

// ---- 4. THE TAKES + THE SHOTS (a line without a cut continues the cut before: the shots tile on the cut words only)
const T = compileTakes({ plan, cards: cards.map((c, i) => (c.cuts.length || i === 0 ? c : { ...c, cuts: [] })), states, lines, looks });
T.shots.forEach((s, k) => { s.ta = k === 0 ? 0 : tw[s.w0].start; s.tb = s.w1 == null ? tw.at(-1).end + 0.25 : tw[s.w1].start; s.ref = refCuts[k]?.n; s.refh = refCuts[k]?.spec?.[3]; s.refT0 = refCuts[k]?.refT0; s.refT1 = refCuts[k]?.refT1; s.frac = s.refh ? Math.min(0.95, s.refh) : null; s.v = REFV[s.ref] ?? null; if (s.ref === 30) s.side = 160; });
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py", "worlds/effects.py", "worlds/stage.py", "worlds/stage9.py", "worlds/stage9b.py", "worlds/stage9c.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const HEAD = (title) => [`"""${title}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, ""];
const ind = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
save("shots.json", T.shots.map(({ id, line, shot, show, move, ta, tb, ref, refh, refT0, refT1 }) => ({ id, line, shot, show, move, ta, tb, ref, refh, refT0, refT1 })));

// ---- 5. THE STILLS: one per cut (its middle), ONE GPU job, low quality
const B = 70;
async function stills(tag) {
  const dir = path.join(OUT, `stills_${tag}`);
  if (fs.existsSync(path.join(dir, "done.json"))) return JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8"));
  fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
  const N = T.shots.length;
  const ruleOn = (s) => (plan.rule_check?.times ?? []).includes(plan.scenes.find((x) => x.id === s.scene)?.time);
  const allowed = (line) => (plan.rule_check?.outside?.[line] ?? []).map((x) => String(x).toLowerCase());
  const body = (s, k) => [`o = (t0 + t1) / 2.0 - ${((s.ta + s.tb) / 2).toFixed(3)}`, `H = take_${s.scene}(o)`, T.cutCall(s, `o + ${s.ta.toFixed(3)}`, `o + ${s.tb.toFixed(3)}`, `S${k + 2}`), ...(ruleOn(s) ? [`zs_rule_check(H, ${JSON.stringify(allowed(s.line))}, (t0 + t1) / 2.0, "R${k + 2}")`] : [])].join("\n");
  const src = [...HEAD(`Replica stills ${tag}`), "ZW_PREVIEW.update(pct=30, samples=6)", "", ...Object.values(T.takes), "",
    `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
    ...T.shots.map((s, k) => `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, ${JSON.stringify(`ref shot ${s.ref}`)})\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n${ind(body(s, k))}\n`)].join("\n");
  const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
  if (!sc.ok) throw new Error(`static check: ${JSON.stringify(sc.problems.slice(0, 5))}`);
  fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
  fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
  fs.writeFileSync(path.join(dir, "video", "script.txt"), "replica stills\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
  if (has("check-only")) { say(`stills ${tag}: static check ok (${N}), not sent`); process.exit(0); }
  const limit = N * 30 + 300;
  L.check(`stills ${tag}`, (limit + BOOT_S) * RATE);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round9-replica-${tag}-${Date.now().toString(36)}`, log: say });
  pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  const r = await R.job(`replica ${tag} (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: T.shots.map((_, k) => k + 2).join(","), perSheet: 90, cols: 10, samples: 6, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_stills" });
  if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(`stills failed: ${String(r.error).slice(0, 300)}`); }
  await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
  await R.cleanup().catch(() => {});
  pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  const pngs = {};
  for (const f of fs.readdirSync(path.join(dir, "preview"))) { const m = f.match(/^shot_(\d+)\.png$/); if (m) pngs[Number(m[1]) - 1] = path.join(dir, "preview", f); }
  const meas = {};
  for (const g of r.output.gate ?? []) { const m = String(g).match(/^ZW_FRAMED\|S(\d+)\|measure\|h=([\d.]+) v=([\d.]+) u=([\d.]+) camz=([-\d.]+)/); if (m) meas[Number(m[1]) - 1] = { h: +m[2], v: +m[3], u: +m[4], camz: +m[5] }; }
  const out = { pngs, meas, failed: r.output.failed ?? {}, gate: r.output.gate ?? [] };
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify(out, null, 1));
  say(`stills ${tag}: ${Object.keys(pngs).length}/${N}, ${Object.keys(out.failed).length} crashed${Object.keys(out.failed).length ? `: ${JSON.stringify(out.failed).slice(0, 500)}` : ""}; spent $${L.total()}`);
  return out;
}

// ---- 6. THE COMPARISON (free): the reference's mid frame next to ours, the measured subject size vs the reference's
// the last round's (r5) positions under the same rule (in code: the house's line, the dog's circle, the car's box, the
// suburb's own unboxed parked cars near the stage)
function ruleBefore() {
  const inRect = (p, a) => p[0] > a[0] && p[0] < a[2] && p[1] > a[1] && p[1] < a[3];
  const house = [-9, 16.5, 9, 34.5];
  const scenes5 = [[1, 1, "sunset"], [2, 6, "night"], [7, 8, "storm"], [9, 17, "night"], [18, 18, "morning"], [19, 21, "night"]];
  const time = (n) => scenes5.find(([a, b]) => n >= a && n <= b)[2];
  const pos = (who, n) => who === "me" ? (n >= 13 ? [-2, 6.5] : [-3, 11]) : who === "dad" ? (n >= 8 ? [3, 11] : [0, 15]) : who === "guy" ? (n <= 4 ? [9, 11] : null) : null;
  const per = [];
  for (const s of T.shots) {
    if (!["night", "storm"].includes(time(s.line))) continue;
    const allow = new Set((plan.rule_check.outside[s.line] ?? []).map((x) => x.toLowerCase()));
    if (s.line === 4) allow.add("guy");
    const br = [];
    for (const who of ["me", "dad", "guy"]) { const q = pos(who, s.line); if (q && !allow.has(who) && !inRect(q, house)) br.push(who); }
    br.push("parked car (-14, 3.2) unboxed", "parked car (22, -3.2) unboxed");
    per.push({ ref: s.ref, breaks: br });
  }
  return { total: per.reduce((a, x) => a + x.breaks.length, 0), shots: per.length, perShot: per };
}
function compare(tag, r) {
  const rows = T.shots.map((s, k) => ({ k: k + 1, ref: s.ref, line: s.line, refPng: path.join(A, "frames", `s${String(s.ref).padStart(3, "0")}_mid.jpg`), ours: r.pngs[k + 1] ?? null, refh: s.refh, h: r.meas[k + 1]?.h ?? null, camz: r.meas[k + 1]?.camz ?? null, spec: `${s.shot} ${s.show.join("+")} ${s.move}` }));
  const vr = fs.existsSync(path.join(OUT, `verdicts_${tag}.json`)) ? JSON.parse(fs.readFileSync(path.join(OUT, `verdicts_${tag}.json`), "utf8")) : {};
  const pics = rows.filter((x) => x.ours).map((x) => x.ours);
  const flat = pics.length ? JSON.parse(pyRun(fs.readFileSync(path.join(HERE, "flatcheck9.py"), "utf8"), ...pics) || "{}") : {};
  const refs = rows.map((x) => x.refPng);
  const lumaRef = JSON.parse(pyRun("import sys,json\nfrom PIL import Image, ImageStat\nprint(json.dumps({p: ImageStat.Stat(Image.open(p).convert('L').resize((54,96))).mean[0]/255 for p in sys.argv[1:]}))", ...refs) || "{}");
  const luma = pics.length ? JSON.parse(pyRun("import sys,json\nfrom PIL import Image, ImageStat\nprint(json.dumps({p: ImageStat.Stat(Image.open(p).convert('L').resize((54,96))).mean[0]/255 for p in sys.argv[1:]}))", ...pics) || "{}") : {};
  for (const x of rows) {
    const m = r.meas[x.k] ?? null;
    x.v = m?.v ?? null; x.refv = REFV[x.ref] ?? null;
    const why = [];
    const rb = (r.gate ?? []).filter((g) => String(g).startsWith(`ZW_GATE|R${x.k + 1}|`) && String(g).includes("|rule_break|")).map((g) => String(g).split("|")[2]);
    x.rule = rb;
    if (rb.length) why.push(`RULE BREAK: ${rb.join(", ")} outside a closed chalk line`);
    if (!x.ours) why.push("no still");
    else {
      if ((luma[x.ours] ?? 1) < Math.max(0.035, 0.45 * (lumaRef[x.refPng] ?? 0.1))) why.push(`black frame (${(luma[x.ours] ?? 0).toFixed(2)} vs the reference ${(lumaRef[x.refPng] ?? 0).toFixed(2)})`);
      if ((flat[x.ours] ?? 0) > 0.45) why.push("a flat surface fills the frame");
      if (x.refh != null) {
        if (x.h == null || x.h < 0.05) why.push("the subject is not in the frame");
        else if (Math.abs(x.h - Math.min(1, x.refh)) > 0.1) why.push(`size ${x.h.toFixed(2)} vs ${Math.min(1, x.refh).toFixed(2)}`);
        if (x.refv != null && x.v != null && Math.abs(x.v - x.refv) > 0.1) why.push(`position ${x.v.toFixed(2)} vs ${x.refv.toFixed(2)}`);
      }
      const vd = vr[x.ref];
      if (!vd) why.push("not yet checked by eye");
      else if (!vd.ok) why.push(`by eye: ${vd.note}`);
    }
    x.pass = !why.length; x.why = why.join("; ");
  }
  const within = rows.filter((x) => x.pass).length;
  const after = rows.reduce((a, x) => a + (x.rule?.length ?? 0), 0);
  fs.writeFileSync(path.join(OUT, `rule_${tag}.json`), JSON.stringify({ after, perShot: rows.filter((x) => x.rule?.length).map((x) => ({ ref: x.ref, breaks: x.rule })), before: ruleBefore() }, null, 1));
  say(`THE RULE: ${after} break(s) in this round's shots (in the engine); the last round's positions: ${ruleBefore().total} (the same rule in code)`);
  const measured = rows.length;
  fs.writeFileSync(path.join(OUT, `compare_${tag}.json`), JSON.stringify({ rows, within, measured }, null, 1));
  pyRun(fs.readFileSync(path.join(HERE, "compare9.py"), "utf8"), path.join(OUT, `compare_${tag}.json`), path.join(OUT, `compare_${tag}.jpg`));
  say(`compare ${tag}: ${within}/${measured} shots pass ALL the conditions (in frame, size + position within 10%, not black, not flat, the key prop seen by eye) -> compare_${tag}*.jpg`);
  return { within, measured };
}

const tag = arg("stills", "r0");
const r = await stills(tag);
const cmp = compare(tag, r);
save(`report_${tag}.json`, { ...cmp, cuts: T.shots.length, refShots: SH.length, stateProblems: problems.length, spent: L.total() });
if (!has("video")) process.exit(0);

// ---- 7. THE LOW-QUALITY PREVIEW + THE SIDE-BY-SIDE (the reference re-timed shot by shot to our voice)
const PV = path.join(OUT, "preview"); fs.mkdirSync(path.join(PV, "video", "audio"), { recursive: true });
const segs = path.join(PV, "segments"); fs.mkdirSync(segs, { recursive: true });
const vsrc = [...HEAD("Replica preview"), "ZW_PREVIEW.update(pct=30, samples=6)", "", ...Object.values(T.takes), "",
  ...T.shots.map((s) => `@S(${s.id}, ${s.w0}, ${s.w1 ?? "None"}, ${JSON.stringify(`ref ${s.ref}: ${s.shot} ${s.show.join("+")}`)})\ndef s${String(s.id).padStart(3, "0")}(t0, t1):\n${ind(`H = take_${s.scene}(0.0)\n${T.cutCall(s)}`)}\n`)].join("\n");
const vsc = staticCheck(vsrc, path.join(PV, "video", "shots.py"));
if (!vsc.ok) throw new Error(`video static check: ${JSON.stringify(vsc.problems.slice(0, 5))}`);
fs.writeFileSync(path.join(PV, "video", "shots.py"), vsrc);
const twv = tw.map((w) => ({ word: w.word, start: w.start, end: w.end }));
fs.writeFileSync(path.join(PV, "video", "audio", "words.json"), JSON.stringify(twv));
fs.copyFileSync(path.join(VD, "voice_1.3.wav"), path.join(PV, "video", "audio", "voice.wav"));
fs.writeFileSync(path.join(PV, "video", "script.txt"), "replica\n");
const frames = shotFrames(vsrc, twv);
const groups = splitShots(frames, 3);
const vlimit = (g) => Math.ceil(g.n * 0.7) + 45 * g.ids.length + 300;
const vworst = groups.reduce((a, g) => a + (vlimit(g) + BOOT_S) * RATE, 0);
say(`preview: ${frames.length} shots, ${frames.reduce((a, x) => a + x.n, 0)} frames, ${groups.length} chunks; worst case $${vworst.toFixed(3)}`);
L.check("preview", vworst);
const VR = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round9-replica-preview-${Date.now().toString(36)}`, log: say });
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(PV, "v.tgz"), path.join(PV, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await VR.putFile("v.tgz", path.join(PV, "v.tgz"), "application/gzip");
const vurl = await VR.signGet("v.tgz");
const vres = await Promise.all(groups.map(async (g, i) => {
  const name = `seg${i}.mp4`;
  if (fs.existsSync(path.join(segs, name))) return { ok: true };
  const rr = await VR.job(`replica chunk ${i} (${g.n})`, { role: "render", slug: "preview", videoUrl: vurl, shots: g.ids.join(","), f0: g.f0, f1: g.f1, samples: 6, upload: await VR.signPuts(name, 4) }, { maxRunSec: vlimit(g), ledgerKey: "runpod_preview_video" });
  if (!rr.ok) return { ok: false, error: String(rr.error).slice(0, 500) };
  await VR.fetchParts(name, rr.output.upload.parts, path.join(segs, name));
  return { ok: true };
}));
await VR.cleanup().catch(() => {});
if (vres.some((x) => !x.ok)) throw new Error(`preview chunks failed: ${vres.filter((x) => !x.ok).map((x) => x.error).join(" | ")}`);
fs.writeFileSync(path.join(segs, "list.txt"), groups.map((_, i) => `file 'seg${i}.mp4'`).join("\n"));
const vraw = path.join(PV, "raw.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(segs, "list.txt"), "-c", "copy", vraw]);
const cap = captionColors(script, V.words);
fs.writeFileSync(path.join(PV, "colors.json"), JSON.stringify(cap.colors));
fs.writeFileSync(path.join(PV, "speakers.json"), JSON.stringify(cap.speakers));
fs.writeFileSync(path.join(PV, "words_voice.json"), JSON.stringify(V.words));
pyRun("import sys,json\nsys.path.insert(0,sys.argv[1])\nimport finishx\nw=json.load(open(sys.argv[2],encoding='utf-8'))\nc=json.load(open(sys.argv[3],encoding='utf-8'))\ns=json.load(open(sys.argv[4],encoding='utf-8'))\nopen(sys.argv[5],'w',encoding='utf-8').write(finishx.captions_ass(w,c,'Arial Black',s))", KIT, path.join(PV, "words_voice.json"), path.join(PV, "colors.json"), path.join(PV, "speakers.json"), path.join(PV, "captions.ass"));
const ass = path.join(PV, "captions.ass").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
const ours = path.join(OUT, "replica_preview.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", vraw, "-i", path.join(VD, "voice_1.3.wav"), "-filter_complex", `[0:v]scale=540:960,subtitles='${ass}'[v]`, "-map", "[v]", "-map", "1:a", "-shortest", "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", ours]);
// the reference re-timed: each reference shot stretched to our cut's length, so both sides cut on the same word
const parts = T.shots.map((s, k) => ({ a: s.refT0 ?? 0, b: s.refT1 ?? 65.9, d: s.tb - s.ta, k }));
const filt = parts.map((p) => `[0:v]trim=start=${p.a.toFixed(3)}:end=${p.b.toFixed(3)},setpts=(PTS-STARTPTS)*${(p.d / Math.max(0.05, p.b - p.a)).toFixed(4)},scale=540:960,fps=30[r${p.k}]`).join(";") + `;${parts.map((p) => `[r${p.k}]`).join("")}concat=n=${parts.length}:v=1:a=0[ref]`;
const refT = path.join(PV, "ref_retimed.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", REFVID, "-filter_complex", filt, "-map", "[ref]", "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", refT]);
const sbs = path.join(OUT, "replica_side_by_side.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", refT, "-i", ours, "-filter_complex", "[0:v][1:v]hstack=inputs=2[v]", "-map", "[v]", "-map", "1:a", "-shortest", "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", sbs]);
say(`replica preview: ${ours}; side by side: ${sbs}; spent $${L.total()}`);
void py;
