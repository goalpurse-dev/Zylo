// RESHOOT (owner 2026-11-15): re-render ONLY some shots of a finished run and splice them into its saved final segments
// (the GPU renders just those shots; the laptop cuts them into the chunk segments with ffmpeg and uploads the new
// segments; then `pipeline.mjs` (same command as the run) re-runs only the finish). Every paid job is priced on the
// run's ledger first; the cap is the run's cap.
//   node reshoot.mjs --run <run dir> --bodies <json {id: body}> [--header-append <py file>] --preview [--yes]
//   node reshoot.mjs --run <run dir> --bodies <json> [--header-append <py file>] --final [--chunks 6] [--yes]
// --preview: the new bodies in a preview job (the kit's preview mode + contact sheet; nothing is saved to the run)
// --final:   the new bodies are SAVED into state.json (a backup first), the shots are rendered in contiguous runs, spliced
//            into their chunk segments (crf 14), uploaded as new segment files; state.chunks points at them
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { assemble, staticCheck, shotProblems } from "./director.mjs";
import { runpod, RATE, BOOT_S, chunkLimitS } from "./rp.mjs";
import { shotFrames, splitShots } from "./plan.mjs";
import { actionsSource } from "./actions/actions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const RUN = path.resolve(arg("run")), OUT = path.join(RUN, "blender");
const state = JSON.parse(fs.readFileSync(path.join(OUT, "state.json"), "utf8"));
const L = ledger(RUN, { capUsd: Number(arg("cap", 3.5)), agentCapUsd: Number(arg("agent-cap", 2.5)) });
const SLUG = arg("slug", "milo_laugh_grow"), K = Number(arg("chunks", 6));
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] reshoot: ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "pipeline.log"), l + "\n"); };
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8", maxBuffer: 64 << 20 }); if (r.status !== 0) throw new Error(`python: ${(r.stderr || r.stdout).slice(-600)}`); return r.stdout; };
const ff = (args) => { const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 64 << 20 }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr.slice(-600)}`); };
const pyLiteral = (v) => (Array.isArray(v) ? `[${v.map(pyLiteral).join(", ")}]` : v && typeof v === "object" ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyLiteral(x)}`).join(", ")}}` : typeof v === "boolean" ? (v ? "True" : "False") : v == null ? "None" : JSON.stringify(v));

const newBodies = JSON.parse(fs.readFileSync(path.resolve(arg("bodies")), "utf8"));
const ids = Object.keys(newBodies).map(Number).sort((a, b) => a - b);
const plan = state.plan;
for (const id of ids) if (!plan.shots.some((s) => s.id === id)) throw new Error(`shot ${id} is not in the plan`);
const headerAppend = has("header-append") ? fs.readFileSync(path.resolve(arg("header-append")), "utf8") : "";
const header = plan.header + (headerAppend && !plan.header.includes(headerAppend.trim()) ? `\n\n# --- reshoot\n${headerAppend}` : "");
const bodies = { ...state.bodies, ...newBodies };
const WORLDS = fs.readFileSync(path.join(HERE, "worlds", "worlds.py"), "utf8");
const text = assemble({ title: plan.title, header: `${WORLDS}\n${actionsSource()}\nZW_STORY_DRESS = ${pyLiteral(plan.dress ?? {})}\n\n${header}`, shots: plan.shots, bodies, slug: SLUG });
const vdir = path.join(OUT, "video"), shotsFile = path.join(vdir, "shots.py");
const sc = staticCheck(text, path.join(vdir, "shots.reshoot.py")); // the run's shots.py is only replaced when a job is sent
if (!sc.ok) throw new Error(`static check: ${JSON.stringify(sc.problems.slice(0, 6))}`);
const sp = shotProblems({ shots: plan.shots.filter((s) => ids.includes(s.id)), bodies, hero: null });
say(`${ids.length} shot(s) ${ids.join(", ")}: static check ok; shot check ${Object.keys(sp).length ? JSON.stringify(sp) : "ok"}`);
if (!has("yes")) { say("dry run (add --yes)"); process.exit(0); }

const R = runpod({ L, prefix: state.rpPrefix, log: (m) => say(m) });
const tag = `rs${Date.now().toString(36)}`;
// the video tar WITHOUT the music bed (only the finish needs it): shots.py, script, words, voice
const tgz = path.join(OUT, `video_${tag}.tgz`);
fs.writeFileSync(shotsFile, text);
py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", tgz, vdir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile(`video_${tag}.tgz`, tgz, "application/gzip");
const url = await R.signGet(`video_${tag}.tgz`);

if (has("preview")) {
  const dir = path.join(OUT, "previews", tag); fs.mkdirSync(dir, { recursive: true });
  const r = await R.job(`reshoot preview (${ids.length} shots)`, { role: "preview", slug: SLUG, videoUrl: url, shots: ids.join(","), perSheet: 16, cols: 8, upload: await R.signPuts(`preview_${tag}.tgz`, 2) }, { maxRunSec: ids.length * 6 + 180, ledgerKey: "runpod_preview" });
  if (!r.ok) throw new Error(`preview failed: ${String(r.error).slice(0, 600)}`);
  await R.fetchParts(`preview_${tag}.tgz`, r.output.upload.parts, path.join(dir, "p.tgz"));
  py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  fs.writeFileSync(path.join(dir, "out.json"), JSON.stringify(r.output));
  say(`preview: failed ${JSON.stringify(Object.keys(r.output.failed ?? {}))}; sheets ${(r.output.sheets ?? []).map((s) => path.join(dir, s.file)).join(" ")}; spent $${L.total()}`);
  for (const [id, t] of Object.entries(r.output.failed ?? {})) say(`  shot ${id}: ${String(t).split("\n").slice(-3).join(" | ").slice(0, 400)}`);
  process.exit(0);
}

if (has("final")) {
  // the bodies become the run's (a backup first), so the finish (pipeline.mjs) builds the same shots.py
  fs.copyFileSync(path.join(OUT, "state.json"), path.join(OUT, `state.before-${tag}.json`));
  state.bodies = bodies; if (header !== plan.header) state.plan.header = header; save();
  const frames = shotFrames(text, JSON.parse(fs.readFileSync(path.join(vdir, "audio", "words.json"), "utf8")));
  const groups = splitShots(frames, K);
  const byId = new Map(frames.map((f) => [f.id, f]));
  // contiguous runs of the reshot shots inside each chunk
  const jobs = [];
  groups.forEach((g, gi) => {
    let cur = null;
    for (const id of g.ids) {
      if (ids.includes(id)) { if (cur) cur.ids.push(id); else jobs.push(cur = { gi, ids: [id] }); } else cur = null;
    }
  });
  for (const j of jobs) { j.f0 = byId.get(j.ids[0]).f0; j.f1 = byId.get(j.ids.at(-1)).f1; j.n = j.f1 - j.f0 + 1; }
  const worst = jobs.reduce((a, j) => a + (chunkLimitS({ frames: j.n, shots: j.ids.length }) + BOOT_S) * RATE, 0);
  L.check(`reshoot renders (${jobs.length} jobs)`, worst);
  say(`final: ${jobs.length} render job(s) ${jobs.map((j) => `[${j.ids.join(",")}] ${j.n} fr`).join(" ")}; worst $${worst.toFixed(3)}; spent $${L.total()}`);
  const segDir = path.join(OUT, "reshoot", tag); fs.mkdirSync(segDir, { recursive: true });
  const res = await Promise.all(jobs.map(async (j, k) => {
    const name = `${tag}_run${k}.mp4`;
    const r = await R.job(`reshoot render [${j.ids.join(",")}] (${j.n} frames)`, { role: "render", slug: SLUG, videoUrl: url, shots: j.ids.join(","), f0: j.f0, f1: j.f1, upload: await R.signPuts(name, 4) }, { maxRunSec: chunkLimitS({ frames: j.n, shots: j.ids.length }), ledgerKey: "runpod_final" });
    if (r.ok) { await R.fetchParts(name, r.output.upload.parts, path.join(segDir, name)); j.file = path.join(segDir, name); }
    return r;
  }));
  const bad = res.filter((r) => !r.ok);
  if (bad.length) throw new Error(`reshoot renders failed (no paid retry): ${bad.map((r) => String(r.error).slice(0, 400)).join(" | ")}`);
  // the SOURCE of the untouched frames: the run's own final without captions (local; the pipeline deletes the stored
  // segments after its finish), padded with its last frame up to the chunks' frame count (the finish trims to the audio)
  const src = path.join(OUT, "final_nocaptions.mp4");
  if (!fs.existsSync(src)) throw new Error("no final_nocaptions.mp4 to splice into");
  const NF = groups.at(-1).f1;
  const have = Number(spawnSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", src], { encoding: "utf8" }).stdout.trim());
  const pad = Math.max(0, NF - have);
  // splice: EVERY chunk gets a new segment (the source frames, the new runs cut in at their frame numbers)
  for (const [gi, g] of groups.entries()) {
    const old = state.chunks[gi] ?? {};
    const mine = jobs.filter((j) => j.gi === gi).sort((a, b) => a.f0 - b.f0);
    const inputs = [src, ...mine.map((j) => j.file)];
    const parts = [];
    let at = g.f0, label = 0;
    const fc = [`[0:v]tpad=stop_mode=clone:stop=${pad},setpts=PTS-STARTPTS[srcp]`, `[srcp]split=${mine.length + 1}${Array.from({ length: mine.length + 1 }, (_, k) => `[s${k}]`).join("")}`];
    let si = 0;
    const srcPart = (a, b) => { fc.push(`[s${si++}]trim=start_frame=${a - 1}:end_frame=${b},setpts=PTS-STARTPTS[p${label}]`); parts.push(`[p${label++}]`); };
    mine.forEach((j, k) => {
      if (j.f0 > at) srcPart(at, j.f0 - 1);
      fc.push(`[${k + 1}:v]trim=start_frame=0:end_frame=${j.n},setpts=PTS-STARTPTS[p${label}]`); parts.push(`[p${label++}]`);
      at = j.f1 + 1;
    });
    if (at <= g.f1) srcPart(at, g.f1);
    while (si < mine.length + 1) fc.push(`[s${si++}]nullsink`);
    fc.push(`${parts.join("")}concat=n=${parts.length}:v=1:a=0[out]`);
    const newName = `seg${String(gi).padStart(2, "0")}_${tag}.mp4`, newFile = path.join(segDir, newName);
    ff([...inputs.flatMap((f) => ["-i", f]), "-filter_complex", fc.join(";"), "-map", "[out]", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", newFile]);
    const n = Number(spawnSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", newFile], { encoding: "utf8" }).stdout.trim());
    if (n !== g.n) throw new Error(`chunk ${gi}: the spliced segment has ${n} frames, the chunk needs ${g.n}`);
    if (fs.statSync(newFile).size > 44 * 1024 * 1024) throw new Error(`chunk ${gi}: the spliced segment is over 44 MB`);
    await R.putFile(`${newName}.part0`, newFile, "video/mp4");
    state.chunks[gi] = { ...old, done: true, name: newName, parts: 1, reshoot: { tag, shots: mine.flatMap((j) => j.ids), was: old.name } };
    save();
    say(`chunk ${gi}: shots ${mine.flatMap((j) => j.ids).join(", ")} spliced in (${n} frames, ${(fs.statSync(newFile).size / 1e6).toFixed(1)} MB)`);
  }
  say(`done: the finish runs with pipeline.mjs (same command); spent $${L.total()}`);
}
function save() { fs.writeFileSync(path.join(OUT, "state.json"), JSON.stringify(state, null, 1)); }
