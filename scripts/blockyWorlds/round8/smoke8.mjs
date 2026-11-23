// ROUND 8 ENGINE SMOKE TEST (paid, ~$0.03): a tiny two-scene take (day + night) with the new pieces (the shadow monster
// climbing out of the big drain, a bell in a hand, a ball that appears, a sign, all lamps off, windows opening, star eyes,
// a sweat drop, the cameras wide / insert / close / low tilt-up / top-down / medium push-in) -> 8 stills.
//   node --env-file=.env.local scripts/blockyWorlds/round8/smoke8.mjs --out reference/blocky-worlds/round8/smoke --yes
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { applyCard, compileTakes, initialState, lockLooks } from "../blenderKit/takes.mjs";
import { normalPlan } from "../blenderKit/director3.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(OUT, { capUsd: 0.2, agentCapUsd: 0.2 });
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
if (!has("yes")) { say("smoke: dry run (add --yes)"); process.exit(0); }

const plan = normalPlan({
  cast: [{ name: "Me", kid: true, hair: "spiky" }, { name: "Ben", kid: true, hair: "messy" }],
  monster: { present: true, style: "shadow", size: 3.8 },
  rule: { sentence: "Ring the bell.", object: { thing: "bell", where: "in_hand", who: "Ben", what_it_does: "keeps it away" } },
  stage: [{ place: "suburb_street", camera_side: "front", monster_starts_here: false, marks: [{ who: "Me", mark: "left" }, { who: "Ben", mark: "right" }, { who: "drain_grate", mark: "front" }] }],
  scenes: [{ id: 1, from_line: 1, to_line: 2, place: "suburb_street", time: "day", busy: "empty" }, { id: 2, from_line: 3, to_line: 3, place: "suburb_street", time: "night", busy: "empty" }],
  props: [{ kind: "bell", size: 1 }],
}, { title: "smoke", lines: [] });
const lines = [
  { text: "In this town, Ben rings his bell.", start: 0.0, end: 2.0, next: 2.1, w0: 0 },
  { text: "I grab a ball and Ben laughs.", start: 2.1, end: 4.0, next: 4.2, w0: 7 },
  { text: "Then the monster climbs out of the drain!", start: 4.2, end: 6.4, next: 6.6, w0: 14 },
].map((l) => ({ ...l, words: l.text.split(" ").map((w, i) => ({ word: w, start: l.start + i * 0.28 })) }));
const cards = [
  { line: 1, actions: [{ who: "ben", do: "wave", on_word: 3 }, { who: "ben", do: "sign", text: "RING IT", on_word: 4 }], faces: { ben: "happy", me: "happy" }, cuts: [{ from_word: 0, shot: "wide", show: ["ben", "bell", "me"], move: "push_in" }, { from_word: 4, shot: "insert", show: ["bell"], move: "push_in" }] },
  { line: 2, actions: [{ who: "ball", do: "appear", target: "ball", to: "me", on_word: 2 }, { who: "me", do: "pick_up", target: "ball", on_word: 3 }, { who: "ben", do: "laugh", on_word: 5 }, { who: "ben", do: "star_eyes", on_word: 5 }], faces: { ben: "laughing", me: "happy" }, cuts: [{ from_word: 0, shot: "medium", show: ["me", "ball"], move: "push_in" }, { from_word: 4, shot: "close", show: ["ben"], move: "static" }] },
  { line: 3, actions: [{ who: "monster", do: "switch_all_off", target: "lamps", on_word: 0 }, { who: "monster", do: "windows_open", target: "windows", on_word: 1 }, { who: "monster", do: "climb_out", target: "drain_grate", to: "front", on_word: 2 }, { who: "me", do: "sweat", on_word: 4 }], faces: { me: "terrified", ben: "scared" }, cuts: [{ from_word: 0, shot: "low", show: ["monster", "ben"], move: "tilt_up" }, { from_word: 6, shot: "top", show: ["drain_grate"], move: "top_down" }] },
].map((c) => ({ ...c, actions: c.actions.map((a) => ({ target: "", to: "", text: "", ...a })) }));
let S = initialState(plan);
const states = [];
cards.forEach((c, i) => { states[i + 1] = S; const r = applyCard(S, c, { place: "suburb_street", line: lines[i], plan }); if (r.problems.length) throw new Error(r.problems.join(" | ")); cards[i] = { ...c, actions: r.applied }; S = r.state; });
states[4] = S;
const T = compileTakes({ plan, cards, states, lines, looks: lockLooks(plan.cast) });
const tw = lines.flatMap((l) => l.words);
T.shots.forEach((s, k) => { s.ta = k === 0 ? 0 : tw[s.w0].start; s.tb = s.w1 == null ? 6.6 : tw[s.w1].start; });
const at = [[1, 0.5, 0], [1, 1.5, 1], [1, 2.9, 2], [1, 3.7, 3], [2, 5.0, 4], [2, 5.6, 4], [2, 6.3, 5], [2, 4.4, 4]];
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py", "worlds/effects.py", "worlds/stage.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const N = at.length, B = 60;
const src = ['"""Round 8 smoke"""', "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "", 'ZW_RULE.update({"thing": "bell", "heads": 1.3, "where": "over_head", "how": "pop", "glow": True})', "", ...Object.values(T.takes), "",
  `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
  ...at.map(([sc, t, si], k) => { const s = T.shots[si]; return `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, "smoke ${k}")\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n    o = (t0 + t1) / 2.0 - ${t}\n    H = take_${sc}(o)\n    ${T.cutCall(s, `o + ${s.ta.toFixed(3)}`, `o + ${s.tb.toFixed(3)}`)}\n`; })].join("\n");
const dir = path.join(OUT, "video"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
const sc = staticCheck(src, path.join(dir, "shots.py"));
if (!sc.ok) throw new Error(JSON.stringify(sc.problems.slice(0, 5)));
fs.writeFileSync(path.join(dir, "shots.py"), src);
fs.writeFileSync(path.join(dir, "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
fs.writeFileSync(path.join(dir, "script.txt"), "smoke\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "audio", "voice.wav")]);
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const limit = N * 30 + 240;
L.check("smoke", (limit + BOOT_S) * RATE);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round8-smoke-${Date.now().toString(36)}`, log: say });
py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(OUT, "v.tgz"), dir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(OUT, "v.tgz"), "application/gzip");
const r = await R.job(`round8 smoke (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: at.map((_, k) => k + 2).join(","), perSheet: 90, cols: 8, samples: 12, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_preview" });
if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(`smoke failed: ${String(r.error).slice(0, 600)}`); }
await R.fetchParts("p.tgz", r.output.upload.parts, path.join(OUT, "p.tgz"));
await R.cleanup().catch(() => {});
py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(OUT, "p.tgz"), OUT);
fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ failed: r.output.failed ?? {}, gate: (r.output.gate ?? []).filter((g) => /ZW_GATE|ZW_FRAMED\|.\|cut|ZW_SWITCH/.test(g)) }, null, 1));
say(`smoke: ${Object.keys(r.output.failed ?? {}).length} crashed ${JSON.stringify(r.output.failed ?? {}).slice(0, 900)}; spent $${L.total()}`);
