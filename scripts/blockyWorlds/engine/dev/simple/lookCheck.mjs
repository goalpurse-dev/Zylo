// SIMPLE-LOOK check stills of a REAL planned timeline on RunPod, through the production engine page (page-code-in-job:
// dev/simple/bundle.mjs on the image's simpleStills role; no image rebuild). Without --yes: the plan + estimate only.
//   node dev/simple/lookCheck.mjs --tl <timeline.json> --recipe <recipe.json> --out <dir> [--since <image commit>] [--yes]
// recipe: [{ label, shot: i, frac?: 0.5, light?: "day", set?: ..., camera?: ..., patch?: {...} }
//          | { label, synth: { ...a shot }, dur?: 2, cast?: { id: spec } }]   (synth shots are appended after the video)
// Every patched / synthetic shot is a COPY in the job's timeline (the planned file is not changed).
import fs from "node:fs";
import path from "node:path";
import { rpClient, storage, loadEnv, billed, logSpend, RATE } from "../../runpod/client.mjs";
import { simpleFileNames } from "../../runpod/simpleRole.mjs";
import { makeBundle, changedFiles } from "./bundle.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const r3 = (x) => Math.round(x * 1000) / 1000;

export function lookTimeline(tl0, recipe, { w = 1080, h = 1920 } = {}) {
  const tl = JSON.parse(JSON.stringify(tl0));
  tl.width = w; tl.height = h; tl.captions = [];
  const picks = [];
  for (const r of recipe) {
    if (r.synth) {
      const start = r3(tl.duration), dur = r.dur ?? 2;
      const s = { line: tl.shots.at(-1).line, lines: [tl.shots.at(-1).line], part: "closer", set: "street", light: "day", camera: "wide", focus: "group", actors: [], monsterState: null, insert: null, marker: null, seed: 7, text: r.label, ...r.synth, start, end: r3(start + dur) };
      tl.shots.push(s); tl.duration = r3(start + dur);
      if (r.cast) Object.assign(tl.cast, r.cast);
      picks.push({ label: r.label, t: r3(start + dur * (r.frac ?? 0.5)) });
      continue;
    }
    const s = tl.shots[r.shot];
    if (!s) throw new Error(`recipe ${r.label}: no shot ${r.shot}`);
    if (r.light || r.set || r.camera || r.patch) {
      // a variant: the shot copied to the end with the change
      const start = r3(tl.duration), dur = s.end - s.start;
      const c = { ...JSON.parse(JSON.stringify(s)), ...(r.light ? { light: r.light } : {}), ...(r.set ? { set: r.set } : {}), ...(r.camera ? { camera: r.camera } : {}), ...(r.patch ?? {}), start, end: r3(start + dur) };
      tl.shots.push(c); tl.duration = r3(start + dur);
      picks.push({ label: r.label, t: r3(start + dur * (r.frac ?? 0.5)) });
    } else picks.push({ label: r.label, t: r3(s.start + (s.end - s.start) * (r.frac ?? 0.5)) });
  }
  return { tl, picks };
}

if (process.argv[1] && /lookCheck\.mjs$/.test(process.argv[1])) {
  const tlFile = arg("tl"), recipeFile = arg("recipe"), out = arg("out");
  if (!tlFile || !recipeFile || !out) { console.error("usage: node dev/simple/lookCheck.mjs --tl <timeline.json> --recipe <recipe.json> --out <dir> [--yes]"); process.exit(2); }
  const { tl, picks } = lookTimeline(JSON.parse(fs.readFileSync(tlFile, "utf8")), JSON.parse(fs.readFileSync(recipeFile, "utf8")));
  const files = [...new Set(["/page/engine.js", ...changedFiles(arg("since", "d1df4998"))])];
  const code = makeBundle({ timeline: tl, files });
  const est = 25 + 4 + picks.length * 2.5;
  console.log(`plan: ${picks.length} stills, ${files.length} page modules in the bundle (${(code.length / 1024).toFixed(0)} KB); estimate ~${est.toFixed(0)} GPU-s = ~$${(est * RATE).toFixed(4)} (worst case ${arg("max-sec", 420)} s = $${(Number(arg("max-sec", 420)) * RATE).toFixed(3)})`);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "bundle.js"), code);
  fs.writeFileSync(path.join(out, "picks.json"), JSON.stringify(picks, null, 1));
  if (!argv.includes("--yes")) { console.log("dry run: nothing sent (add --yes)"); process.exit(0); }
  const st = storage(loadEnv(), `blocky-worlds-test/simple-engine/${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const rp = rpClient();
  try {
    const shots = picks.map((p) => ({ label: p.label, t: p.t }));
    const names = simpleFileNames(shots), uploads = {};
    for (const n of names) uploads[n] = await st.signPut(n);
    const job = { role: "simpleStills", mode: "gpu", simple: { code, shots, out: { uploads } } };
    const id = await rp.submit({ job });
    console.log(`job ${id}`);
    const stt = await rp.wait(id, { maxSec: Number(arg("max-sec", 420)), pollMs: 2000 }); // --max-sec: the job is cancelled after this (bounds the spend)
    const b = billed(stt);
    logSpend(out, `Blocky Worlds simple-look engine stills ${id} (${stt.status}, ${shots.length} stills)`, b);
    console.log(`status ${stt.status}; billed ${b.seconds} s = $${b.usd}`);
    if (!(stt.status === "COMPLETED" && stt.output?.ok)) { console.log(JSON.stringify(stt.output ?? stt).slice(0, 3000)); process.exit(1); }
    const o = stt.output;
    console.log(`renderer ${String(o.renderer).slice(0, 80)}; load ${o.loadMs} ms; timing ${JSON.stringify(o.timing)}${o.errors?.length ? `; page errors ${o.errors.join(" | ").slice(0, 1500)}` : ""}`);
    for (const s of o.stills) {
      if (!s.file) { console.log(`  ${s.label}: ERROR ${s.error}`); continue; }
      const buf = await st.get(s.file);
      if (buf) fs.writeFileSync(path.join(out, s.file), buf);
      console.log(`  ${s.file} mean ${s.mean} ${s.ms} ms`);
    }
    fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ job: id, billed: b, ...o }, null, 1));
  } finally {
    const n = await st.cleanup().catch(() => 0);
    console.log(`deleted ${n} test files`);
  }
}
