// ROUND 4: THE MOTION REEL (owner 2026-11-22): every action of the motion library (worlds/motion.py) 2.5-3 s, LOW
// quality (a third of the resolution, few samples), all in ONE GPU job; each action's name burned in locally (free).
//   node --env-file=.env.local scripts/blockyWorlds/round4/motionReel.mjs --out <dir> [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); const dir = path.join(OUT, "motion_reel"); fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
const L = ledger(OUT, { capUsd: 2, agentCapUsd: 2 });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };

const DAY = `{"time": "day", "busy": "quiet", "walkers": "walking", "extras": [], "cars": "parked", "windows": "lit", "curtains": "open", "threat": "none", "faces": "dot"}`;
const A = `{"skin": "#f1dfc6", "shirt": "#ff6fa8", "pants": "#2f3f7a", "hair": "bun", "hair_color": "#3a2418", "face": "girl", "kid": True}`;
const B = `{"skin": "#d9b48f", "shirt": "#3a7bd5", "pants": "#2b2b2b", "hair": "spiky", "hair_color": "#151212", "face": "kid", "kid": True}`;
const front = (x = 0, d = 16) => `zr_key(cam, t0, t1, (${x}, ${10 - d}, 4.2), (${x}, 10.0, 3.1), (${x}, ${10 - d + 0.6}, 4.2), (${x}, 10.0, 3.1), lens=30)`;
const track = (x0, x1) => `zr_key(cam, t0, t1, (${x0}, -1.0, 3.6), (${x0 + 2}, 10.0, 2.6), (${x1}, -1.0, 3.6), (${x1 + 2}, 10.0, 2.6), lens=26)`;
const one = (body, cam = front()) => `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\na = zw_person("Ava", ${A}, (0.0, 10.0, 0.0), 0.0, t0)\n${body}\n${cam}`;
const two = (body, cam = `zr_key(cam, t0, t1, (0.0, -10.0, 4.4), (0.0, 10.0, 3.0), (0.0, -9.4, 4.4), (0.0, 10.0, 3.0), lens=26)`) => `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\na = zw_person("Ava", ${A}, (-3.0, 10.0, 0.0), 90.0, t0)\nb = zw_person("Ben", ${B}, (3.0, 10.0, 0.0), -90.0, t0)\n${body}\n${cam}`;
const DEMOS = [
  ["WALK (steps on the ground, arms opposite)", 3.0, `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\na = zw_person("Ava", ${A}, (-6.0, 10.0, 0.0), 90.0, t0)\nzm_walk(a, t0 + 0.1, t1 - 0.1, (6.0, 10.0, 0.0), turn=False)\n${track(-7, 5)}`],
  ["RUN", 2.5, `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\na = zw_person("Ava", ${A}, (-9.0, 10.0, 0.0), 90.0, t0)\nzm_walk(a, t0 + 0.1, t1 - 0.1, (9.0, 10.0, 0.0), run=True, turn=False)\n${track(-10, 8)}`],
  ["TURN (the head leads)", 2.5, one(`zm_turn(a, t0 + 0.3, 170.0)\nzm_turn(a, t0 + 1.4, 0.0)`)],
  ["LOOK AROUND", 2.5, one(`zm_look_around(a, t0 + 0.2, t1 - 0.1)`)],
  ["SIT DOWN + STAND UP", 3.0, one(`zm_sit(a, t0 + 0.2)\nzm_stand_up(a, t0 + 1.8)`)],
  ["LIE DOWN", 2.5, one(`zm_lie(a, t0 + 0.3)`, front(0, 18))],
  ["READ A BOOK", 2.5, one(`zm_read(a, t0 + 0.1, t1)`)],
  ["LOOK AT A PHONE", 2.5, one(`zm_phone(a, t0 + 0.1, t1)`)],
  ["KICK A BALL", 2.5, `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\na = zw_person("Ava", ${A}, (-3.0, 10.0, 0.0), 90.0, t0)\nball = zm_ball("ball", (-1.9, 10.0, 0.45))\nzm_kick(a, t0 + 0.8, ball, (7.0, 10.5, 0.45))\nzr_key(cam, t0, t1, (0.5, -6.0, 4.2), (0.5, 10.0, 2.6), (1.5, -5.6, 4.2), (1.5, 10.0, 2.6), lens=24)`],
  ["THROW + CATCH", 3.0, two(`ball = zm_play_catch(a, b, t0, t1)`)],
  ["WAVE", 2.5, one(`zm_wave(a, t0 + 0.2, t1 - 0.2)\nzw_emote(a, t0, t1, "happy")`)],
  ["POINT", 2.5, one(`zm_hold(a, t0 + 0.2)\nzw_point(a, t0 + 0.6, (9.0, 2.0, 2.0))`)],
  ["TALK WITH THE HANDS", 2.5, one(`zm_talk(a, t0 + 0.1, t1)\nzw_emote(a, t0, t1, "happy", talk=True)`)],
  ["NOD + SHAKE THE HEAD", 3.0, one(`zm_nod(a, t0 + 0.3, 2)\nzm_shake_head(a, t0 + 1.6, 3)`)],
  ["PICK UP + CARRY", 3.0, `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\na = zw_person("Ava", ${A}, (-5.0, 10.0, 0.0), 90.0, t0)\nbx = zw_thing("box", (-3.8, 10.0, 0.0), size=1.2)\nzm_carry(a, t0 + 0.1, t1 - 0.1, (4.0, 10.0, 0.0), bx)\n${track(-6, 2)}`],
  ["OPEN + CLOSE A DOOR", 3.0, `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\nd = zp_door((0.0, 12.6, 0.0), 0.0, "#c0392b")\na = zw_person("Ava", ${A}, (1.4, 11.0, 0.0), 180.0, t0)\nzm_door(a, t0 + 0.3, d, True)\nzm_door(a, t0 + 1.7, d, False)\nzr_key(cam, t0, t1, (4.0, 1.0, 4.6), (0.6, 12.0, 3.0), lens=26)`],
  ["JUMP", 2.5, one(`zm_jump(a, t0 + 0.4)\nzm_jump(a, t0 + 1.5)`)],
  ["FALL OVER", 2.5, one(`zm_fall(a, t0 + 0.6)\nzw_emote(a, t0, t1, "shocked")`, front(0, 15))],
  ["HIDE + PEEK", 3.0, `ZW_INFO = zw_build("suburb_street", t0, t1, ${DAY})\ncam = Cam()\ncr = zw_thing("crate", (2.0, 10.0, 0.0), size=2.6)\na = zw_person("Ava", ${A}, (-4.0, 10.0, 0.0), 90.0, t0)\nzm_hide_peek(a, t0, t1, cr)\nzw_emote(a, t0, t1, "scared")\nzr_key(cam, t0, t1, (0.0, -3.0, 4.2), (1.0, 10.5, 2.4), lens=26)`],
  ["SCARED SHAKING", 2.5, one(`zw_emote(a, t0, t1, "scared")\nzm_shiver(a, t0 + 0.1, t1)`)],
  ["CHEER", 2.5, one(`zw_emote(a, t0, t1, "happy")\nzm_cheer(a, t0 + 0.4)`)],
  ["CRY", 2.5, one(`zw_emote(a, t0, t1, "sad")\nzm_cry(a, t0 + 0.1, t1)`)],
  ["HUG", 2.5, two(`zm_hug(a, b, t0 + 0.3, t1)\nzw_emote(a, t0, t1, "happy")\nzw_emote(b, t0, t1, "happy")`)],
  ["IDLE LIFE (breathing, blinks, weight shifts)", 3.0, two(`zw_emote(a, t0, t1, "neutral")`)],
  ["STREET GLIDE (a busy day)", 3.0, `ZW_INFO = zw_build("suburb_street", t0, t1, {"time": "day", "busy": "busy", "walkers": "walking", "extras": ["pairs", "bags", "kids_playing", "dogs", "birds"], "cars": "driving", "windows": "lit", "curtains": "open", "threat": "none", "faces": "dot"})\ncam = Cam()\nzw_establish(cam, t0, t1, "suburb_street", "glide")`],
  ["LOW DRONE (dusk, people hurrying home)", 3.0, `ZW_INFO = zw_build("downtown_street", t0, t1, {"time": "sunset", "busy": "normal", "walkers": "hurrying", "extras": ["bags"], "cars": "driving", "windows": "some", "curtains": "open", "threat": "none", "faces": "dot"})\ncam = Cam()\nzw_establish(cam, t0, t1, "downtown_street", "drone")`],
  ["FOLLOW WALK", 3.0, `ZW_INFO = zw_build("suburb_street", t0, t1, {"time": "day", "busy": "normal", "walkers": "walking", "extras": ["pairs", "dogs"], "cars": "driving", "windows": "lit", "curtains": "open", "threat": "none", "faces": "dot"})\ncam = Cam()\na = zw_person("Ava", ${A}, (-24.0, 8.2, 0.0), 90.0, t0)\nzm_walk(a, t0, t1, (-12.0, 8.2, 0.0), turn=False)\nzw_establish(cam, t0, t1, "suburb_street", follow=a)`],
];
// the timeline: shot k from its start to the next; 6 placeholder words a shot (the talking mouth needs words)
const starts = []; { let t = 0; for (const d of DEMOS) { starts.push(+t.toFixed(3)); t += d[1]; } starts.push(+t.toFixed(3)); }
const words = []; DEMOS.forEach((d, k) => { for (let j = 0; j < 6; j++) words.push({ word: j ? `w${k}_${j}` : `s${k}`, start: +(starts[k] + (j * d[1]) / 6).toFixed(3), end: +(starts[k] + ((j + 0.7) * d[1]) / 6).toFixed(3) }); });
words.push({ word: "end", start: starts.at(-1), end: starts.at(-1) + 0.3 });
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const src = ['"""Round 4 motion reel"""', "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "",
  'ZW_PREVIEW.update(pct=30, samples=6)', "",
  ...DEMOS.map((d, k) => `@S(${k + 1}, ${k * 6}, ${k + 1 < DEMOS.length ? (k + 1) * 6 : "None"}, ${JSON.stringify(d[0])})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n${d[2].split("\n").map((l) => `    ${l}`).join("\n")}\n`)].join("\n");
const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
if (!sc.ok) { console.error(JSON.stringify(sc.problems.slice(0, 6), null, 1)); process.exit(1); }
fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(words));
fs.writeFileSync(path.join(dir, "video", "script.txt"), "motion reel\n");
const total = starts.at(-1);
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(total + 0.5), path.join(dir, "video", "audio", "voice.wav")]);
const f0 = 1, f1 = Math.round(total * 30);
const limit = Math.ceil(f1 * 0.45) + DEMOS.length * 8 + 300;
say(`motion reel: ${DEMOS.length} actions, ${total.toFixed(1)} s (${f1} frames) in ONE job; worst case $${((limit + BOOT_S) * RATE).toFixed(3)}; spent $${L.total()}`);
if (!has("yes")) process.exit(0);
L.check("motion reel", (limit + BOOT_S) * RATE);
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round4-reel-${Date.now().toString(36)}`, log: say });
const TAR = "import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)";
const UNTAR = "import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')";
py(TAR, path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
if (has("stills")) {   // a cheap crash check first: the middle frame of every action (the preview role)
  const q = await R.job("reel stills", { role: "preview", slug: "reel", videoUrl: await R.signGet("v.tgz"), shots: DEMOS.map((_, k) => k + 1).join(","), perSheet: 30, cols: 10, samples: 6, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: DEMOS.length * 30 + 300, ledgerKey: "runpod_preview" });
  if (q.ok) { await R.fetchParts("p.tgz", q.output.upload.parts, path.join(dir, "p.tgz")); py(UNTAR, path.join(dir, "p.tgz"), path.join(dir, "stills")); }
  await R.cleanup().catch(() => {});
  const failed = Object.fromEntries(Object.entries(q.output?.failed ?? {}).map(([k, v]) => [k, String(v).split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300)]));
  console.log(JSON.stringify({ ok: q.ok, error: q.ok ? null : String(q.error).slice(0, 500), failed, spent: L.total() }, null, 1));
  process.exit(0);
}
const r = await R.job(`motion reel (${f1} frames)`, { role: "render", slug: "reel", videoUrl: await R.signGet("v.tgz"), shots: DEMOS.map((_, k) => k + 1).join(","), f0, f1, samples: 6, upload: await R.signPuts("reel.mp4", 4) }, { maxRunSec: limit, ledgerKey: "runpod_reel" });
if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(`reel: ${String(r.error).slice(0, 900)}`); }
await R.fetchParts("reel.mp4", r.output.upload.parts, path.join(dir, "reel_raw.mp4"));
await R.cleanup().catch(() => {});
// the labels (local, free)
const font = "C\\:/Windows/Fonts/arialbd.ttf";
const dt = DEMOS.map((d, k) => `drawtext=fontfile='${font}':text='${String(k + 1)}. ${d[0].replace(/[':,]/g, "")}':x=(w-tw)/2:y=h*0.06:fontsize=h/34:fontcolor=white:borderw=3:bordercolor=black:enable='between(t,${starts[k]},${starts[k + 1]})'`).join(",");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(dir, "reel_raw.mp4"), "-vf", dt, "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", path.join(dir, "motion_reel.mp4")]);
say(`motion reel: ${path.join(dir, "motion_reel.mp4")} (${r.output.frames} frames, ${r.output.sPerFrame} s a frame, render ${r.output.renderS} s); spent $${L.total()}`);
