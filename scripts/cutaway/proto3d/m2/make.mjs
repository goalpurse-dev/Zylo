// M2: one command from a layout and a voice to the finished video ($0, local, GPU in headless Chrome):
//   measure the voice's end -> compile the timeline -> build the page -> render the silent video -> sound and
//   captions -> mux (+ a 576x1024 web copy). Progress lines go to stdout as `PROGRESS {"stage", "pct", ...}`.
//   node m2/make.mjs --layout L.json --voice v.mp3 --words w.json --out DIR --proto PROTO --ff FFMPEG [--roles r.json]
//        [--noend] (also the version without the end card) [--secs N] (render only the first N s, for a quick look)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compile } from "./compile.mjs";
import { makePage } from "./makePage.mjs";
import { buildAudio } from "./audio.mjs";
import { speechEnd } from "../speechEnd.mjs";
import { cameraAt, projectBox } from "./director.js";
import { placeSign } from "./framing.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const progress = (o) => console.log(`PROGRESS ${JSON.stringify(o)}`);

function run(cmd, args, opts = {}, onLine = null) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    const lines = (buf) => { for (const l of String(buf).split(/\r?\n/)) if (l.trim()) onLine?.(l); };
    p.stdout.on("data", lines); p.stderr.on("data", (d) => { err += d; lines(d); });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err.slice(-600)}`))));
  });
}

/** copy the kit and the M2 runtime into the render folder (it serves them to the page) */
export function syncProto(proto) {
  for (const dir of ["kit", "m2"]) {
    const src = path.join(here, "..", dir), dst = path.join(proto, dir);
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) if (/\.(js|mjs)$/.test(f)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
  fs.copyFileSync(path.join(here, "..", "render.mjs"), path.join(proto, "render.mjs"));
  fs.mkdirSync(path.join(proto, "m2run"), { recursive: true });
}

// the caption font (Lilita One, OFL): the approved videos took it from the research folder
// (a render server sets CUTAWAY_FONTS: the worker image keeps it in /app/fonts)
export const FONTS = process.env.CUTAWAY_FONTS ?? "C:/Users/Public/Zylo/research/seamless-niche/work/m2drain/fonts";

/** write the layout, its timeline and its page into the render folder */
export function preparePage({ layout, tl, proto }) {
  syncProto(proto);
  fs.writeFileSync(path.join(proto, "m2run", `${layout.key}.layout.json`), JSON.stringify(layout));
  fs.writeFileSync(path.join(proto, "m2run", `${layout.key}.timeline.json`), JSON.stringify(tl));
  fs.writeFileSync(path.join(proto, `m2_${layout.key}.js`), makePage(layout));
  fs.writeFileSync(path.join(proto, `m2_${layout.key}.html`), fs.readFileSync(path.join(here, "..", "full.html"), "utf8").replace('src="/full.js"', `src="/m2_${layout.key}.js"`));
}

// only: "end" | "noend" renders just that version (production renders the one the user gets); silent: { end, noend }
// silent videos already rendered (the CPU fallback's joined chunks): no render, just the sound, captions and copies
export async function makeVideo({ layout, voice, words, out, proto, ff, roles = [], noend = false, secs = null, wt = path.resolve(here, "../../../.."), fonts = FONTS, onProgress = null, only = null, silent = null }) {
  const progress = (o) => { console.log(`PROGRESS ${JSON.stringify(o)}`); onProgress?.(o); };
  const t0 = Date.now(), timing = {};
  fs.mkdirSync(out, { recursive: true });
  progress({ stage: "timeline", pct: 2 });
  const se = speechEnd(ff, voice);
  let tl = compile(layout, words, se, { roles });
  // the end card checked from the camera the video really ends on (with the real word times), and moved to a clear spot
  // if something stands between (a young tree hid half the Landfill's sign, 2026-10-28); free, before the render
  for (let i = 0; i < 2 && tl.marks?.signPop != null && tl.camera?.end; i++) {
    const k = cameraAt(tl.camera.end, tl.marks.signPop + 0.6), ps = placeSign(layout, { pos: k.pos, tgt: k.tgt }, projectBox);
    if (!ps.moved) break;
    layout = ps.layout; tl = compile(layout, words, se, { roles }); timing.signMoved = (timing.signMoved ?? 0) + 1;
  }
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(tl, null, 1));
  preparePage({ layout, tl, proto });
  timing.prepare = (Date.now() - t0) / 1000;

  const all = [["end", tl.marks.lengthEnd, ""], ...(noend || only === "noend" ? [["noend", tl.marks.lengthNoEnd, "?endcard=0"]] : [])];
  const versions = only ? all.filter(([v]) => v === only) : all;
  const share = 80 / versions.length;
  for (const [i, [v, len, q]] of versions.entries()) {
    const t1 = Date.now(), L = secs ?? len, file = path.join(out, `silent_${v}.mp4`);
    if (silent?.[v]) { if (path.resolve(silent[v]) !== path.resolve(file)) fs.copyFileSync(silent[v], file); continue; }
    progress({ stage: "render", version: v, pct: Math.round(5 + i * share) });
    await run(process.execPath, [path.join(proto, "render.mjs"), ff, file, String(L), "30"], { cwd: proto, env: { ...process.env, PAGE: `m2_${layout.key}.html${q}` } }, (line) => {
      const m = /^frame (\d+)\/(\d+)/.exec(line); if (m) progress({ stage: "render", version: v, frame: +m[1], frames: +m[2], pct: Math.round(5 + i * share + (share * m[1]) / m[2]) });
      if (/page error/.test(line)) console.log(line);
    });
    timing[`render_${v}`] = (Date.now() - t1) / 1000;
  }
  progress({ stage: "sound", pct: 86 });
  const t2 = Date.now();
  const mixes = await buildAudio({ wt, ff, timeline: tl, voice, words, out });
  timing.sound = (Date.now() - t2) / 1000;
  progress({ stage: "finish", pct: 92 });
  const t3 = Date.now();
  const fontsDir = fonts;
  if (!fs.existsSync(path.join(fontsDir, "LilitaOne-Regular.ttf"))) throw new Error(`no caption font in ${fontsDir}`);
  fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
  for (const f of fs.existsSync(fontsDir) ? fs.readdirSync(fontsDir) : []) fs.copyFileSync(path.join(fontsDir, f), path.join(out, "fonts", f));
  const files = {};
  for (const [v] of versions) {
    const final = `${layout.key}_${v}.mp4`;
    await run(ff, ["-v", "error", "-y", "-i", `silent_${v}.mp4`, "-i", `mix_${v}.mp3`, "-vf", `subtitles=${v === "end" && fs.existsSync(path.join(out, "captions_end.ass")) ? "captions_end.ass" : "captions.ass"}:fontsdir=fonts`, "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], { cwd: out });
    files[v] = path.join(out, final);
  }
  // the web copy of the version delivered (the end card version, or the clean one when only that was made)
  await run(ff, ["-v", "error", "-y", "-i", files.end ?? files[versions[0][0]], "-vf", "scale=576:1024", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", `${layout.key}-web.mp4`], { cwd: out });
  files.web = path.join(out, `${layout.key}-web.mp4`);
  timing.finish = (Date.now() - t3) / 1000;
  timing.total = (Date.now() - t0) / 1000;
  const report = { key: layout.key, speechEnd: se, marks: tl.marks, director: tl.director, mixes, files, timing };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
  progress({ stage: "done", pct: 100 });
  return report;
}

if (/make\.mjs$/.test(process.argv[1] ?? "")) {
  const a = Object.fromEntries(process.argv.slice(2).join(" ").split(/\s(?=--)/).map((s) => { const [k, ...v] = s.replace(/^--/, "").split(" "); return [k, v.join(" ") || true]; }));
  const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  const r = await makeVideo({ layout: read(a.layout), voice: a.voice, words: read(a.words), out: a.out, proto: a.proto, ff: a.ff, roles: a.roles ? read(a.roles) : [], noend: !!a.noend, secs: a.secs ? Number(a.secs) : null });
  console.log(JSON.stringify(r.timing), r.files.end);
}
export { run as runProcess };
