// IN THIS TOWN v2: THE LOW-QUALITY PREVIEW VIDEO of a place storyboard (placeStory.mjs): voice sample B, every row a
// shot on its words (row 1 the town aerial over "In this town"), the motion of the place builder (camera glides and
// pushes, idle life, blinks, falling rain / things), one-word captions, a hard cut to black. Like previewVideo.mjs for
// the curtains story. Refuses to run unless the storyboard passed every check (free checks + every still).
//   node --env-file=.env.local scripts/blockyWorlds/v2/placeVideo.mjs --name keys --yes [--cap 1.5]
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";
import { captionColors } from "../blenderKit/speakers.mjs";
import { castVoice } from "../engine/voice/castVoice.mjs";
import { NARRATOR_SAMPLES } from "./voices.mjs";
import { STAGE_A } from "./stageA.mjs";
import { STAGE_B } from "./stageB.mjs";
import { CHARACTERS, NEIGHBOURS, EXTRA_SPECS } from "./characters.mjs";
import { allPlaces, loadPlace, placePayload } from "./placeKit.mjs";
import { withBig } from "./places/bigthings.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const NAME = arg("name", "keys");
const ROOT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", "night-build");
const OUT = path.join(ROOT, `story_${NAME}`);
const L = ledger(path.join(ROOT, "ledger"), { capUsd: Number(arg("night_cap", 10)), agentCapUsd: Number(arg("cap", 1.5)) });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
const script = J("script.json"), result = J("result.json");
// THE GATE: every check of the storyboard passed
if (result.check_problems.length || result.render_fails.length || result.pass !== result.stills) { say(`VIDEO REFUSED: the storyboard has ${result.check_problems.length} free-check problem(s) and ${result.render_fails.length} failed still(s)`); process.exit(1); }
const stills = J(fs.existsSync(path.join(OUT, "stills_b.json")) ? "stills_b.json" : "stills_a.json");
if (!has("yes")) { say(`dry run: ${stills.length} shots (nothing sent; add --yes)`); process.exit(0); }

// ---- 1. the voice (sample B: the owner's roblox-story voice on multilingual v2)
const VD = path.join(OUT, "voice"); fs.mkdirSync(VD, { recursive: true });
let V = fs.existsSync(path.join(OUT, "voice_b.json")) ? J("voice_b.json") : null;
if (!V) {
  L.check("voice", 0.25, { agent: true });
  const r = await castVoice({ script: { lines: script.lines.map((l) => ({ text: l.text, speaker: "narrator" })) }, voices: { narrator: { narrator: NARRATOR_SAMPLES.b } }, pace: 1.2, outDir: VD, apiKey: process.env.ELEVENLABS_KEY ?? process.env.ELEVENLABS_API_KEY, log: say });
  V = { wav: r.wav, words: r.words, duration: r.duration };
  L.add("voice", Number(r.costUsd ?? 0.12));
  fs.writeFileSync(path.join(OUT, "voice_b.json"), JSON.stringify(V));
}
const words = V.words.map((w) => ({ word: w.word ?? w.text, start: w.start, end: w.end }));
// ---- 2. each line's words, each row's first word (row 1 = the aerial over the first three words)
const lineStart = [];
let wi = 0;
for (const l of script.lines) { lineStart.push(wi); wi += l.text.split(/\s+/).filter(Boolean).length; }
lineStart.push(words.length);
const byLine = {};
stills.forEach((s, k) => { const li = Number(s.opt.label.split("L")[1]); (byLine[li] ??= []).push(k); });
const w0 = new Array(stills.length);
for (const [li, ks] of Object.entries(byLine)) {
  const a = lineStart[li - 1], b = Math.max(a + 1, lineStart[li]);
  ks.forEach((k, j) => { w0[k] = li === "1" && j === 1 && ks.length > 1 ? Math.min(a + 3, b - 1) : a + Math.floor(((b - a) * j) / ks.length); });
}
// ---- 3. the shots file (the same place builder as the stills)
const places = await allPlaces();
const payloads = {};
for (const s of stills) if (!payloads[s.place]) { const [t, bk] = s.place.split("+"); payloads[s.place] = placePayload(loadPlace(bk ? withBig(places[t], ...bk.split(".")) : places[t])); }
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = ["stage_v2.py", "char_v2.py", "set_v2.py", "things_v2.py", "giants_v2.py", "acting_v2.py"].map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n\n");
const HEX = fs.readFileSync(path.join(HERE, "assets", "zyvo_badge96.hex"), "utf8").trim();
const N = stills.length;
const src = [`"""In This Town v2: ${script.title} (preview video)"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector, Euler", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", `ZV_STAGES["A"] = ${py(STAGE_A)}`, `ZV_STAGES["B"] = ${py(STAGE_B)}`, `ZC_SPECS.update(${py({ ...CHARACTERS, ...NEIGHBOURS, ...EXTRA_SPECS })})`, `ZV_BADGE_HEX = ${JSON.stringify(HEX)}`,
  ...Object.entries(payloads).map(([id, p]) => `ZV_PLACES[${py(id)}] = ${py(p)}`), "ZW_PREVIEW.update(pct=30, samples=6)", "",
  ...stills.map((s, k) => `@S(${k + 1}, ${k === 0 ? 0 : w0[k]}, ${k + 1 < N ? w0[k + 1] : "None"}, ${JSON.stringify(s.opt.label)})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n    zv_place_test(${py(s.place)}, ${py(s.cam)}, ${py(s.time)}, ${py(s.weather)}, t0, t1, ${py(s.opt)})\n`)].join("\n");
const PV = path.join(OUT, "preview");
fs.mkdirSync(path.join(PV, "video", "audio"), { recursive: true });
const segs = path.join(PV, "segments"); fs.mkdirSync(segs, { recursive: true });
const sc = staticCheck(src, path.join(PV, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 5))}`); process.exit(1); }
fs.writeFileSync(path.join(PV, "video", "shots.py"), src);
fs.writeFileSync(path.join(PV, "video", "audio", "words.json"), JSON.stringify(words));
fs.copyFileSync(V.wav, path.join(PV, "video", "audio", "voice.wav"));
fs.writeFileSync(path.join(PV, "video", "script.txt"), "video\n");
const frames = shotFrames(src, words);
const groups = splitShots(frames, 3);
const vlimit = (g) => Math.ceil(g.n * 0.6) + 45 * g.ids.length + 300;
const worst = groups.reduce((a, g) => a + (vlimit(g) + BOOT_S) * RATE, 0);
say(`preview: ${N} shots, ${groups.reduce((a, g) => a + g.n, 0)} frames in ${groups.length} chunks; worst case $${worst.toFixed(3)}; night spent $${L.total()}`);
L.check("preview video", worst);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-${NAME}-preview-${Date.now().toString(36)}`, log: say });
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(PV, "v.tgz"), path.join(PV, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(PV, "v.tgz"), "application/gzip");
const url = await R.signGet("v.tgz");
const res = await Promise.all(groups.map(async (g, i) => {
  const name = `seg${i}.mp4`;
  if (fs.existsSync(path.join(segs, name))) return { ok: true };
  const r = await R.job(`preview chunk ${i} (${g.n} frames)`, { role: "render", slug: "preview", videoUrl: url, shots: g.ids.join(","), f0: g.f0, f1: g.f1, samples: 6, upload: await R.signPuts(name, 4) }, { maxRunSec: vlimit(g), ledgerKey: "runpod_preview_video" });
  if (!r.ok) return { ok: false, error: String(r.error).slice(0, 600) };
  await R.fetchParts(name, r.output.upload.parts, path.join(segs, name));
  return { ok: true, sPerFrame: r.output.sPerFrame };
}));
await R.cleanup().catch(() => {});
const bad = res.filter((x) => !x.ok);
if (bad.length) { say(`chunks FAILED: ${bad.map((b) => b.error).join(" | ")}`); process.exit(1); }
fs.writeFileSync(path.join(segs, "list.txt"), groups.map((_, i) => `file 'seg${i}.mp4'`).join("\n"));
const raw = path.join(PV, "raw.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(segs, "list.txt"), "-c", "copy", raw]);
const cap = captionColors({ lines: script.lines.map((l) => ({ text: l.text, speaker: "narrator" })) }, V.words);
fs.writeFileSync(path.join(PV, "colors.json"), JSON.stringify(cap.colors));
fs.writeFileSync(path.join(PV, "speakers.json"), JSON.stringify(cap.speakers));
fs.writeFileSync(path.join(PV, "words_voice.json"), JSON.stringify(V.words));
pyRun("import sys,json\nsys.path.insert(0,sys.argv[1])\nimport finishx\nw=json.load(open(sys.argv[2],encoding='utf-8'))\nc=json.load(open(sys.argv[3],encoding='utf-8'))\ns=json.load(open(sys.argv[4],encoding='utf-8'))\nopen(sys.argv[5],'w',encoding='utf-8').write(finishx.captions_ass(w,c,'Arial Black',s))", KIT, path.join(PV, "words_voice.json"), path.join(PV, "colors.json"), path.join(PV, "speakers.json"), path.join(PV, "captions.ass"));
const ass = path.join(PV, "captions.ass").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
const lastEnd = V.words.at(-1).end, hold = +(lastEnd + 0.6).toFixed(2), total = +(hold + 1.2).toFixed(2);
const out = path.join(ROOT, `preview_${NAME}_lowq.mp4`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-i", V.wav, "-filter_complex",
  `[0:v]scale=540:960,tpad=stop_mode=clone:stop_duration=3,trim=duration=${hold},setpts=PTS-STARTPTS,subtitles='${ass}',tpad=stop_mode=add:color=black:stop_duration=1.2[v];[1:a]apad,atrim=duration=${total}[a]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out]);
say(`preview: ${out} (${total} s); night spent $${L.total()}`);
