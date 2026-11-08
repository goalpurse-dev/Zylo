// Blocky Worlds: stills rendered on RunPod (no local GPU; 2026-11-08: the laptop only edits code). Without --yes it only
// prints the plan and the estimate; with --yes it spends money on RunPod (ask the owner first: paid-run budget rule).
//   node dev/runpodStills.mjs --timeline <timeline.json> (--times 0.5,3,... | --shots all|0,4,7) [--w 540 --h 960]
//                              [--captions] [--whole] --out <dir> [--workers 3] [--yes]
//      by default the worker renders only the picked shots back to back (the page loads only their sets: much faster);
//      --whole (or --captions) renders on the full timeline
//   node dev/runpodStills.mjs --objects <specs.json> --out <dir> [--size 768] [--yes]
//      specs.json: [{ kind: "object"|"world", spec, light?, view?: { yaw, el }, size?, label? }] (or { items: [...] });
//      a bare blueprint list ([{ parts: ... }]) is read as objects
// Timeline stills: the timeline goes to a private test folder in storage (bucket generated, blocky-worlds-test/stills/<ts>),
// every still to a signed upload URL + a manifest per job; big lists are split across up to --workers jobs (one page
// load each: a list under ~15 stills stays in one job, cheaper); everything is downloaded to --out, then the test folder
// is deleted. Object stills come back inline (runpod/stillRendererRunpod.mjs). Billed seconds -> <out>/spend.jsonl.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rpClient, storage, loadEnv, billed, estimate, logSpend, endpointInfo } from "../runpod/client.mjs";
import { resolvePicks, fileNames } from "../runpod/stillsRole.mjs";

/** picks -> up to `workers` groups (at least perJob picks each, so small lists stay in one page load) */
export function splitPicks(picks, workers = 3, perJob = 15) {
  const k = Math.max(1, Math.min(workers, Math.ceil(picks.length / perJob)));
  const out = Array.from({ length: k }, () => []);
  // contiguous runs (neighbouring shots share sets: each job's page loads fewer of them)
  picks.forEach((p, i) => out[Math.min(k - 1, Math.floor((i * k) / picks.length))].push(p));
  return out;
}

export function parsePicks(tl, { times = null, shots = null }) {
  if (times) return resolvePicks(tl, String(times).split(",").map((x) => x.trim()).filter(Boolean).map((t) => ({ t: Number(t) })));
  if (!shots || shots === "all") return resolvePicks(tl, "all");
  return resolvePicks(tl, String(shots).split(",").map((x) => ({ shot: Number(x) })));
}

/** the timeline stills on RunPod -> { stills: [{ label, file (local), ... }], usd, seconds, jobs } */
export async function timelineStills({ tl, picks, w = 540, h = 960, captions = false, whole = false, out, workers = 3, rp = rpClient(), store = null, minBuild = null, log = console.log }) {
  fs.mkdirSync(out, { recursive: true });
  const st = store ?? storage(loadEnv(), `blocky-worlds-test/stills/${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const groups = splitPicks(picks, workers), results = [];
  let seconds = 0, usd = 0;
  try {
    await st.put("timeline.json", JSON.stringify(tl), "application/json");
    const timelineUrl = await st.signGet("timeline.json");
    await Promise.all(groups.map(async (g, gi) => {
      const names = fileNames(g); // the worker names the files the same way
      const uploads = {};
      for (const nm of names) uploads[nm] = await st.signPut(`j${gi}/${nm}`);
      const job = { role: "stills", mode: "gpu", ...(minBuild ? { minBuild } : {}), stills: { timelineUrl, picks: g.map((p) => ({ t: p.t, label: p.label, ...(p.shot != null ? { shot: p.shot } : {}) })), w, h, captions, whole, out: { uploads, manifest: await st.signPut(`j${gi}/manifest.json`) } } };
      let stt = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const id = await rp.submit({ job });
        log(`job ${gi + 1}/${groups.length}: ${id} (${g.length} stills, try ${attempt})`);
        stt = await rp.wait(id, { maxSec: 600, pollMs: 2000 });
        const b = billed(stt); seconds += b.seconds; usd += b.usd;
        logSpend(out, `Blocky Worlds stills ${id} (${stt.status}, ${g.length} stills)`, b);
        if (stt.status === "COMPLETED" && stt.output?.ok) break;
        log(`job ${id}: ${stt.status} ${stt.output?.code ?? ""} ${String(stt.output?.error ?? stt.error ?? "").slice(0, 300)}`);
        if (!(stt.output?.code === "NO_GPU" || stt.output?.code === "STALE_WORKER")) break;
      }
      if (!(stt.status === "COMPLETED" && stt.output?.ok)) throw new Error(`stills job ${gi + 1} failed: ${stt.status} ${stt.output?.code ?? ""} ${String(stt.output?.error ?? stt.error ?? "").slice(0, 300)}`);
      for (const s of stt.output.stills) {
        if (!s.file) { results.push({ ...s, job: gi }); continue; }
        const buf = await st.get(`j${gi}/${s.file}`);
        const local = path.join(out, `${groups.length > 1 ? `j${gi}_` : ""}${s.file}`);
        if (buf) fs.writeFileSync(local, buf);
        results.push({ ...s, job: gi, local: buf ? local : null });
      }
      log(`job ${gi + 1}: ${stt.output.stills.length} stills, page load ${stt.output.loadMs} ms, renderer ${String(stt.output.renderer).slice(0, 60)}, worker timing ${JSON.stringify(stt.output.timing)}${stt.output.guard?.length ? `, flat guard ${JSON.stringify(stt.output.guard)}` : ""}`);
    }));
  } finally {
    const n = await st.cleanup().catch((e) => { log(`cleanup failed: ${e.message}`); return 0; });
    log(`deleted ${n} test files`);
  }
  results.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ stills: results, jobs: groups.length, seconds: +seconds.toFixed(1), usd: +usd.toFixed(5) }, null, 1));
  return { stills: results, jobs: groups.length, seconds: +seconds.toFixed(1), usd: +usd.toFixed(5) };
}

export function readObjectItems(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(j) ? j : j.items ?? [];
  return list.map((x, i) => (x?.spec ? x : { kind: "object", spec: x, label: x?.name ? String(x.name) : `object${i + 1}` }));
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d), GO = argv.includes("--yes");
  const out = arg("out");
  if (!out || (!arg("timeline") && !arg("objects"))) { console.error("usage: node dev/runpodStills.mjs --timeline <tl.json> (--times a,b | --shots all|ids) [--w 540 --h 960] --out <dir> [--yes]\n       node dev/runpodStills.mjs --objects <specs.json> --out <dir> [--size 768] [--yes]"); process.exit(2); }
  let minBuild = null; try { minBuild = endpointInfo().build ?? null; } catch { /* none */ }
  if (arg("timeline")) {
    const tl = JSON.parse(fs.readFileSync(arg("timeline"), "utf8"));
    const picks = parsePicks(tl, { times: arg("times"), shots: arg("shots") });
    const groups = splitPicks(picks, Number(arg("workers", 3)));
    const e = estimate({ jobs: groups.length, stills: picks.length });
    console.log(`plan: ${picks.length} stills of ${path.basename(arg("timeline"))} (${tl.shots.length} shots, ${tl.duration} s) at ${arg("w", 540)}x${arg("h", 960)} in ${groups.length} job(s) [${groups.map((g) => g.length).join(", ")}]`);
    console.log(`estimate: ~${e.seconds} GPU-seconds billed, ~$${e.usd} (worst case ${groups.length * 2} jobs x 600 s = $${(groups.length * 2 * 600 * 0.58 / 3600).toFixed(2)})`);
    if (!GO) { console.log("dry run: nothing sent (add --yes)"); process.exit(0); }
    const r = await timelineStills({ tl, picks, w: Number(arg("w", 540)), h: Number(arg("h", 960)), captions: argv.includes("--captions"), whole: argv.includes("--whole"), out, workers: Number(arg("workers", 3)), minBuild });
    const bad = r.stills.filter((s) => s.bad || s.error);
    console.log(`${r.stills.filter((s) => s.local).length}/${picks.length} stills -> ${path.resolve(out)}; ${bad.length ? `flagged: ${bad.map((s) => `${s.label} ${s.error ?? `flat ${s.flat} detail ${s.detail}`}`).join("; ")}; ` : ""}billed ${r.seconds} s = $${r.usd} (${r.jobs} job(s))`);
  } else {
    const items = readObjectItems(arg("objects"));
    const e = estimate({ jobs: Math.ceil(items.length / 8), objects: items.length });
    console.log(`plan: ${items.length} object/world stills in ${Math.ceil(items.length / 8)} job(s); estimate ~${e.seconds} GPU-seconds, ~$${e.usd}`);
    if (!GO) { console.log("dry run: nothing sent (add --yes)"); process.exit(0); }
    const { makeStillRenderer } = await import("../runpod/stillRendererRunpod.mjs");
    const r = await makeStillRenderer({ outDir: out, size: Number(arg("size", 768)), minBuild });
    const res = await Promise.allSettled(items.map((it, i) => r.render(it.kind ?? "object", it.spec, { light: it.light, view: it.view, size: it.size, name: it.label ?? `object${i + 1}` })));
    await r.close();
    res.forEach((x, i) => console.log(x.status === "fulfilled" ? `${x.value.file} ${x.value.w}x${x.value.h}${x.value.bad ? " FLAGGED" : ""}${x.value.problems.length ? ` problems: ${x.value.problems.join("; ")}` : ""}` : `item ${i}: ${x.reason.message}`));
    console.log(`billed ${r.spent.seconds} s = $${r.spent.usd} (${r.spent.jobs} job(s))`);
  }
}
