// THE REPLICA FINAL (owner 2026-11-22, internal only): ONE final render at normal quality (the kit's final mode, chunks
// in parallel), then everything else LOCAL (free): the chunks joined, the voice, the captions like the reference (2-4
// words, white bold in the middle, one yellow key word, a small name tag NOAH / MOM above spoken lines), a slight
// vignette, the fade to black, and the side-by-side (reference left, ours right). Hard cap: $3 for the whole test.
//   node --env-file=.env.local scripts/blockyWorlds/replica/final.mjs --dir <replica dir> [--chunks 4] [--yes]
//   node scripts/blockyWorlds/replica/final.mjs --dir <replica dir> --finish-only      (local: captions, look, side-by-side)
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";
import { PREAMBLE, placeCards } from "./cards.mjs";
import { LIB_FILES } from "./libFiles.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const DIR = path.resolve(arg("dir"));
const OUT = path.join(DIR, "final"); fs.mkdirSync(path.join(OUT, "video", "audio"), { recursive: true });
const L = ledger(DIR, { capUsd: 3, agentCapUsd: 3 });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(DIR, "run.log"), l + "\n"); };
const words = JSON.parse(fs.readFileSync(path.join(DIR, "voice", "words.json"), "utf8"));
const P = placeCards(words);
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const LIB = LIB_FILES.map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n") + "\n\n" + PREAMBLE;

// ---- 1. the GPU final (skipped when the segments are already here)
const segs = path.join(OUT, "segments");
if (!has("finish-only")) {
  const src = ['"""Replica final"""', "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "",
    ...P.map((x, k) => `@S(${x.k}, ${x.w0}, ${x.w1 ?? "None"}, ${JSON.stringify(`card ${x.k}: ${x.card.what}`.slice(0, 120))})\ndef s${String(x.k).padStart(3, "0")}(t0, t1):\n${x.py.split("\n").map((l) => `    ${l}`).join("\n")}\n`)].join("\n");
  const sc = staticCheck(src, path.join(OUT, "video", "shots.py"));
  if (!sc.ok) { console.error(JSON.stringify(sc.problems.slice(0, 6), null, 1)); process.exit(1); }
  fs.writeFileSync(path.join(OUT, "video", "shots.py"), src);
  fs.writeFileSync(path.join(OUT, "video", "audio", "words.json"), JSON.stringify(words));
  fs.copyFileSync(path.join(DIR, "voice", "voice.wav"), path.join(OUT, "video", "audio", "voice.wav"));
  fs.writeFileSync(path.join(OUT, "video", "script.txt"), "replica\n");
  const frames = shotFrames(src, words);
  const groups = splitShots(frames, Number(arg("chunks", 4)));
  const total = frames.reduce((a, s) => a + s.n, 0);
  const limit = (g) => Math.ceil(g.n * 1.6) + 420;
  const worst = groups.reduce((a, g) => a + (limit(g) + BOOT_S) * RATE, 0);
  say(`final: ${frames.length} shots, ${total} frames (${(total / 30).toFixed(1)} s) in ${groups.length} chunks; worst case $${worst.toFixed(3)}; spent $${L.total()} of $3`);
  if (!has("yes")) process.exit(0);
  L.check("final render", worst);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/replica-final-${Date.now().toString(36)}`, log: say });
  py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(OUT, "v.tgz"), path.join(OUT, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(OUT, "v.tgz"), "application/gzip");
  const url = await R.signGet("v.tgz");
  fs.mkdirSync(segs, { recursive: true });
  const res = await Promise.all(groups.map(async (g, i) => {
    const name = `seg${i}.mp4`;
    if (fs.existsSync(path.join(segs, name))) return { ok: true, i };
    const r = await R.job(`final chunk ${i} (${g.n} frames)`, { role: "render", slug: "replica", videoUrl: url, shots: g.ids.join(","), f0: g.f0, f1: g.f1, upload: await R.signPuts(name, 4) }, { maxRunSec: limit(g), ledgerKey: "runpod_final" });
    if (!r.ok) return { ok: false, i, error: String(r.error).slice(0, 400) };
    await R.fetchParts(name, r.output.upload.parts, path.join(segs, name));
    return { ok: true, i, sPerFrame: r.output.sPerFrame };
  }));
  await R.cleanup().catch(() => {});
  const bad = res.filter((x) => !x.ok);
  if (bad.length) throw new Error(`final chunks failed: ${bad.map((b) => `${b.i}: ${b.error}`).join(" | ")}`);
  say(`final chunks done (${res.map((r) => r.sPerFrame).join(" / ")} s a frame); spent $${L.total()} of $3`);
  fs.writeFileSync(path.join(segs, "list.txt"), groups.map((_, i) => `file 'seg${i}.mp4'`).join("\n"));
}

// ---- 2. the captions (ASS), like the reference
const KEY = new Set(["10", "pm", "9:59", "neighbors", "curtains", "doors", "lights", "nobody", "noah", "disappeared", "moved", "away", "10:03", "bedroom", "window", "streetlight", "same", "closer", "directly", "three", "words", "lied", "suddenly", "door", "open", "behind", "outside", "gone", "terrifying", "neighbor", "house", "my"]);
const TAGS = [["your mom lied", "NOAH", "&H00B87AFF&"], ["i told you never to look outside", "MOM", "&H00A8B32A&"]];
const clean = (w) => String(w).toLowerCase().replace(/[^a-z0-9:]/g, "");
const groups = [];
let cur = [];
for (const w of words) {
  cur.push(w);
  const end = /[.,!?…"]$/.test(w.word) || /\.\.\.$/.test(w.word);
  if (cur.length >= 3 || (end && cur.length >= 2) || (end && /[.!?]"?$/.test(w.word))) { groups.push(cur); cur = []; }
}
if (cur.length) groups.push(cur);
const assT = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${s}`; };
const fullText = words.map((w) => clean(w.word)).join(" ");
const tagOf = (g) => { const at = words.indexOf(g[0]); for (const [phrase, tag, col] of TAGS) { const p = fullText.indexOf(phrase); if (p < 0) continue; const startIdx = fullText.slice(0, p).split(" ").filter(Boolean).length; const n = phrase.split(" ").length; if (at >= startIdx && at < startIdx + n) return { tag, col }; } return null; };
const lines = [];
groups.forEach((g, gi) => {
  const t0 = g[0].start, t1 = gi + 1 < groups.length ? groups[gi + 1][0].start : g.at(-1).end + 0.4;
  const keyIdx = (() => { const ks = g.map((w, i) => (KEY.has(clean(w.word)) && clean(w.word) !== "my" ? i : -1)).filter((i) => i >= 0); return ks.length ? ks.at(-1) : -1; })();
  const shout = /^(noah|my house)$/.test(g.map((w) => clean(w.word)).join(" ")) ? true : false;
  const txt = g.map((w, i) => { const s = w.word.replace(/^"|"$/g, "").replace(/\.\.\.$/, "..."); const u = (clean(w.word) === "noah" && gi > 10) || (gi === groups.length - 1 && /my|house/.test(clean(w.word))) ? s.toUpperCase() : s; return i === keyIdx ? `{\\c&H00D7FF&}${u}{\\c&HFFFFFF&}` : u; }).join(" ");
  const tg = tagOf(g);
  if (tg) lines.push(`Dialogue: 0,${assT(t0)},${assT(t1)},Tag,,0,0,0,,{\\an5\\pos(540,1060)\\c${tg.col}}${tg.tag}`);
  lines.push(`Dialogue: 0,${assT(t0)},${assT(t1)},Cap,,0,0,0,,{\\an5\\pos(540,1130)}${txt}`);
  void shout;
});
const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,Arial Black,98,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,8,3,5,50,50,0,1\nStyle: Tag,Arial Black,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,1,0,1,5,1,5,50,50,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lines.join("\n")}\n`;
fs.writeFileSync(path.join(OUT, "captions.ass"), ass);
say(`captions: ${groups.length} groups, ${lines.filter((l) => l.includes(",Tag,")).length} name tags`);

// ---- 3. the finish (local): join, voice, vignette, captions, fade to black at the reference's length; side-by-side
const raw = path.join(OUT, "ours_raw.mp4");
ff(["-f", "concat", "-safe", "0", "-i", path.join(segs, "list.txt"), "-c", "copy", raw]);
const refDur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(DIR, "reference.mp4")]).toString());
const ours = path.join(OUT, "ours.mp4");
const assPath = path.join(OUT, "captions.ass").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
ff(["-i", raw, "-i", path.join(DIR, "voice", "voice.wav"), "-filter_complex",
  `[0:v]scale=1080:1920,tpad=stop_mode=clone:stop_duration=3,trim=duration=${refDur.toFixed(2)},vignette=PI/5,subtitles='${assPath}',fade=t=out:st=${(refDur - 0.9).toFixed(2)}:d=0.9[v];[1:a]apad,atrim=duration=${refDur.toFixed(2)}[a]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", ours]);
const sbs = path.join(OUT, "side_by_side.mp4");
ff(["-i", path.join(DIR, "reference.mp4"), "-i", ours, "-filter_complex", "[0:v]scale=540:960,setsar=1[l];[1:v]scale=540:960,setsar=1[r];[l][r]hstack=inputs=2[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", sbs]);
say(`done: ${ours} + ${sbs}; spent $${L.total()} of $3`);
