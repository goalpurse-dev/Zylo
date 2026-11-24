// IN THIS TOWN v2: THE VIDEO of a planned + voiced story: every row a shot on its word times, the motion (camera push-in,
// blinks, a living hold, reactions a beat late, walks that start before the cut), the voice, one-word captions, the
// stickers on their words, and a hard cut to black after the last line (owner 2026-11-24).
//   preview (30% size, few samples):  node --env-file=.env.local scripts/blockyWorlds/v2/previewVideo.mjs --name curtains --yes [--cap 2]
//   the 1080p final (full quality):   ... --name curtains --final --yes [--chunks 4]
//   a frame-by-frame test (3 s of some shots, preview quality, no sound): ... --name curtains --shots 1,25 --yes
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";
import { captionColors } from "../blenderKit/speakers.mjs";
import { STAGE_A } from "./stageA.mjs";
import { STAGE_B } from "./stageB.mjs";
import { CHARACTERS, NEIGHBOURS, mimicOf } from "./characters.mjs";
import { rowPython } from "./shots.mjs";
import { stickerFilter } from "./stickers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const NAME = arg("name", "mimic_mom");
const FINAL = has("final");
const TEST = arg("shots") ? arg("shots").split(",").map(Number) : null;
const OUT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", `story_${NAME}`);
const CAP = Number(arg("cap", 2));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const story = JSON.parse(fs.readFileSync(path.join(HERE, "stories", `${NAME}.json`), "utf8"));
const V = JSON.parse(fs.readFileSync(path.join(OUT, "voice.json"), "utf8"));
const TW = JSON.parse(fs.readFileSync(path.join(OUT, "timed_words.json"), "utf8"));
const S = { ...STAGE_A, cameras: {} };
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = ["stage_v2.py", "char_v2.py"].map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n\n");
const HEX = fs.readFileSync(path.join(HERE, "assets", "zyvo_badge96.hex"), "utf8").trim();
const ind = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
const rows = story.rows;
const src = [`"""In This Town v2: ${story.title} (${FINAL ? "final" : "preview"} video)"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector, Euler", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", `ZV_STAGES["A"] = ${py(STAGE_A)}`, `ZV_STAGES["B"] = ${py(STAGE_B)}`, `ZC_SPECS.update(${py({ ...CHARACTERS, ...NEIGHBOURS, mimic_mom: mimicOf(CHARACTERS.mom), mimic_dad: mimicOf(CHARACTERS.dad) })})`, `ZV_BADGE_HEX = ${JSON.stringify(HEX)}`,
  FINAL ? "" : "ZW_PREVIEW.update(pct=30, samples=6)", "",
  ...rows.map((r, k) => `@S(${k + 1}, ${k === 0 ? 0 : r.w0}, ${r.w1 ?? "None"}, ${JSON.stringify(`row ${k + 1} line ${r.line}`)})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n${ind(rowPython(S, story, r))}\n`)].join("\n");
const PV = path.join(OUT, FINAL ? "final" : TEST ? `test_${TEST.join("_")}` : "preview");
fs.mkdirSync(path.join(PV, "video", "audio"), { recursive: true });
const segs = path.join(PV, "segments"); fs.mkdirSync(segs, { recursive: true });
const sc = staticCheck(src, path.join(PV, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 5))}`); process.exit(1); }
fs.writeFileSync(path.join(PV, "video", "shots.py"), src);
const twv = TW.map((w) => ({ word: w.word, start: w.start, end: w.end }));
fs.writeFileSync(path.join(PV, "video", "audio", "words.json"), JSON.stringify(twv));
fs.copyFileSync(V.wav, path.join(PV, "video", "audio", "voice.wav"));
fs.writeFileSync(path.join(PV, "video", "script.txt"), "video\n");
const frames = shotFrames(src, twv);
// the test: the first 3 s (90 frames) of each named shot, one chunk each
const groups = TEST ? frames.filter((f) => TEST.includes(f.id)).map((f) => ({ ids: [f.id], f0: f.f0, f1: Math.min(f.f1, f.f0 + 89), n: Math.min(f.n, 90) })) : splitShots(frames, FINAL ? Number(arg("chunks", 4)) : 2);
const vlimit = (g) => (FINAL ? Math.ceil(g.n * 1.6) + 420 : Math.ceil(g.n * 0.5) + 40 * g.ids.length + 300);
const worst = groups.reduce((a, g) => a + (vlimit(g) + BOOT_S) * RATE, 0);
say(`${FINAL ? "FINAL" : TEST ? "test" : "preview"}: ${groups.reduce((a, g) => a + g.ids.length, 0)} shots, ${groups.reduce((a, g) => a + g.n, 0)} frames in ${groups.length} chunks; worst case $${worst.toFixed(3)}; spent $${L.total()}`);
if (!has("yes")) process.exit(0);
L.check(FINAL ? "final video" : "preview video", worst);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-${NAME}-${FINAL ? "final" : "preview"}-${Date.now().toString(36)}`, log: say });
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(PV, "v.tgz"), path.join(PV, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(PV, "v.tgz"), "application/gzip");
const url = await R.signGet("v.tgz");
const res = await Promise.all(groups.map(async (g, i) => {
  const name = `seg${i}.mp4`;
  if (fs.existsSync(path.join(segs, name))) return { ok: true };
  const r = await R.job(`${FINAL ? "final" : "preview"} chunk ${i} (${g.n} frames)`, { role: "render", slug: FINAL ? "final" : "preview", videoUrl: url, shots: g.ids.join(","), f0: g.f0, f1: g.f1, ...(FINAL ? {} : { samples: 6 }), upload: await R.signPuts(name, 4) }, { maxRunSec: vlimit(g), ledgerKey: FINAL ? "runpod_final" : "runpod_preview_video" });
  if (!r.ok) return { ok: false, error: String(r.error).slice(0, 600) };
  await R.fetchParts(name, r.output.upload.parts, path.join(segs, name));
  return { ok: true, sPerFrame: r.output.sPerFrame };
}));
await R.cleanup().catch(() => {});
const bad = res.filter((x) => !x.ok);
if (bad.length) { say(`chunks FAILED: ${bad.map((b) => b.error).join(" | ")}`); process.exit(1); }
if (TEST) { say(`test segments: ${segs}; spent $${L.total()}`); process.exit(0); }
fs.writeFileSync(path.join(segs, "list.txt"), groups.map((_, i) => `file 'seg${i}.mp4'`).join("\n"));
const raw = path.join(PV, "raw.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(segs, "list.txt"), "-c", "copy", raw]);
// captions (one word at a time) + the stickers on their words
const script = { lines: story.lines.map((l) => ({ text: l.text, speaker: l.speaker === "mimic" ? "Mimic" : "narrator" })) };
const cap = captionColors(script, V.words);
fs.writeFileSync(path.join(PV, "colors.json"), JSON.stringify(cap.colors));
fs.writeFileSync(path.join(PV, "speakers.json"), JSON.stringify(cap.speakers));
fs.writeFileSync(path.join(PV, "words_voice.json"), JSON.stringify(V.words));
pyRun("import sys,json\nsys.path.insert(0,sys.argv[1])\nimport finishx\nw=json.load(open(sys.argv[2],encoding='utf-8'))\nc=json.load(open(sys.argv[3],encoding='utf-8'))\ns=json.load(open(sys.argv[4],encoding='utf-8'))\nopen(sys.argv[5],'w',encoding='utf-8').write(finishx.captions_ass(w,c,'Arial Black',s))", KIT, path.join(PV, "words_voice.json"), path.join(PV, "colors.json"), path.join(PV, "speakers.json"), path.join(PV, "captions.ass"));
const ass = path.join(PV, "captions.ass").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
const [W, H] = FINAL ? [1080, 1920] : [540, 960];
const stk = rows.filter((r) => r.sticker).map((r) => stickerFilter(r.sticker, { W, H, enable: `between(t,${r.t0.toFixed(2)},${Math.min(r.t1, r.t0 + 1.6).toFixed(2)})` }));
// the end: hold the last picture 0.6 s after the last word, then a hard cut to black for 1.2 s (no fade)
const lastEnd = V.words.at(-1).end, hold = +(lastEnd + 0.6).toFixed(2), total = +(hold + 1.2).toFixed(2);
const out = path.join(OUT, FINAL ? "final_1080p.mp4" : "preview_lowq.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-i", V.wav, "-filter_complex",
  `[0:v]scale=${W}:${H},tpad=stop_mode=clone:stop_duration=3,trim=duration=${hold},setpts=PTS-STARTPTS${stk.length ? "," + stk.join(",") : ""},subtitles='${ass}',tpad=stop_mode=add:color=black:stop_duration=1.2[v];[1:a]apad,atrim=duration=${total}[a]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", FINAL ? "18" : "23", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", FINAL ? "160k" : "128k", "-movflags", "+faststart", out]);
say(`${FINAL ? "final" : "preview"}: ${out} (${total} s; ${res.map((x) => x.sPerFrame).filter(Boolean).join(" / ")} s a frame); spent $${L.total()}`);
