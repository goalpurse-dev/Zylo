// Blocky Worlds GATE (2026-11-09): the prepare job's HARD STILL GATE + automatic re-plan (lib/vision/gatePass.js
// gateShots, the same ladder: action -> reaction -> world wide -> a borrowed passing framing, each change re-checked by
// the pre-render checks) driven from the laptop, every still rendered on RunPod (dev/runpodStills.mjs timelineStills).
// For look-gate rounds on stored plans: no AI calls, RunPod only (spends money: without --yes it only prints the plan).
//   node dev/gateRunpod.mjs --timeline <tl.json> [--script <script.json>] --out <dir> [--rounds 2] [--workers 3] [--seed <pass-1 manifest.json>] [--yes]
// Writes <out>/timeline.json (the re-planned timeline), <out>/gate.json (gateShots' report + spend),
// <out>/stills/NNN_sNN.jpg (the still of every shot's FINAL framing: the gate passes' stills by shot content, the
// shots no pass rendered (inserts) in one last job), <out>/passes/* (every pass's stills), <out>/spend.jsonl.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { timelineStills, splitPicks } from "./runpodStills.mjs";
import { shotAt } from "../runpod/stillsRole.mjs";
import { endpointInfo, estimate } from "../runpod/client.mjs";
import { gateShots, shotKey } from "../lib/vision/gatePass.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** gateShots' still renderer on RunPod: renderTimeline(subTl, picks) -> { stills: [{ key, idx, shotKey, gate, error }] } */
export function runpodGateRenderer({ out, workers = 3, minBuild = null, log = console.log, stills = timelineStills, seed = null } = {}) {
  const files = new Map(); // shot content key -> the latest local still of it
  const spent = { usd: 0, seconds: 0, jobs: 0, passes: 0 };
  return {
    files, spent,
    async renderTimeline(subTl, picks, { name = "pass" } = {}) {
      const dir = path.join(out, "passes", `${String(++spent.passes).padStart(2, "0")}_${String(name).replace(/[^\w-]+/g, "_")}`);
      const P = picks.map((p) => ({ t: p.t, label: `g${p.idx}`, shot: shotAt(subTl, p.t) }));
      // --seed: the first pass already rendered (same timeline, an image that renders these shots the same; e.g. the
      // laptop lost the network while polling, or only one set changed): the seed's stills stand in for pass 1; picks it
      // does not cover (left out of the seed on purpose: their set changed) are rendered now and merged
      const has = (p) => seed?.stills.find((s) => s.label === p.label && s.local);
      const fromSeed = spent.passes === 1 && seed ? P.filter(has) : [];
      const rest = P.filter((p) => !fromSeed.includes(p));
      const fresh = rest.length ? await stills({ tl: subTl, picks: rest, out: dir, workers, minBuild, log }) : { stills: [], usd: 0, seconds: 0, jobs: 0 };
      const r = { ...fresh, stills: [...fromSeed.map(has), ...fresh.stills] };
      if (fromSeed.length) log(`pass 1: ${fromSeed.length} stills from the seed, ${rest.length} rendered`);
      spent.usd += r.usd; spent.seconds += r.seconds; spent.jobs += r.jobs;
      return {
        stills: picks.map((p, k) => {
          const s = r.stills.find((x) => x.label === P[k].label);
          const key = shotKey(subTl.shots[P[k].shot]);
          if (s?.local) files.set(key, s.local);
          return { key: p.key, idx: p.idx, shotKey: key, gate: s?.gate ?? null, ...(s ? (s.error ? { error: s.error } : {}) : { error: "no still" }) };
        }),
      };
    },
    close: async () => {},
  };
}

/** the gate + the final stills of one timeline -> { tl, report, spent, missing } */
export async function gateTimeline({ tl, script = null, out, rounds = 2, workers = 3, minBuild = null, minutes = 40, seed = null, log = console.log }) {
  fs.mkdirSync(path.join(out, "stills"), { recursive: true });
  let check = null;
  if (script) {
    const plan = await import(pathToFileURL(path.join(here, "..", "plan.mjs")).href);
    const { checksFor } = await import(pathToFileURL(path.join(here, "..", "lib", "vision", "index.js")).href);
    check = checksFor(plan, script);
  }
  const R = runpodGateRenderer({ out, workers, minBuild, log, seed });
  const { report } = await gateShots({ tl, stills: R, check, until: Date.now() + minutes * 60000, rounds, log: (m) => log(`gate: ${m}`) });
  // the final framing of every shot: a gate pass's still of that exact content, else rendered now (inserts, unmeasured)
  const name = (i) => `${String(i).padStart(3, "0")}_s${String(i).padStart(2, "0")}.jpg`;
  const missing = tl.shots.map((s, i) => (R.files.has(shotKey(s)) ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    const r = await timelineStills({ tl, picks: missing.map((i) => ({ shot: i, label: `s${String(i).padStart(2, "0")}`, t: +((tl.shots[i].start + tl.shots[i].end) / 2).toFixed(3) })), out: path.join(out, "passes", "final"), workers, minBuild, log });
    R.spent.usd += r.usd; R.spent.seconds += r.seconds; R.spent.jobs += r.jobs;
    for (const s of r.stills) if (s.local && s.shot != null) R.files.set(shotKey(tl.shots[s.shot]), s.local);
  }
  tl.shots.forEach((s, i) => { const f = R.files.get(shotKey(s)); if (f) fs.copyFileSync(f, path.join(out, "stills", name(i))); });
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(tl, null, 1));
  fs.writeFileSync(path.join(out, "gate.json"), JSON.stringify({ report, spent: R.spent, rendered: missing }, null, 1));
  return { tl, report, spent: R.spent, missing };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const out = arg("out"), tlFile = arg("timeline");
  if (!out || !tlFile) { console.error("usage: node dev/gateRunpod.mjs --timeline <tl.json> [--script <script.json>] --out <dir> [--rounds 2] [--workers 3] [--yes]"); process.exit(2); }
  const tl = JSON.parse(fs.readFileSync(tlFile, "utf8"));
  const script = arg("script") ? JSON.parse(fs.readFileSync(arg("script"), "utf8")) : null;
  const workers = Number(arg("workers", 3));
  const e = estimate({ jobs: splitPicks(tl.shots, workers).length, stills: tl.shots.length });
  console.log(`plan: gate ${tl.shots.length} shots of ${path.basename(tlFile)} on RunPod (first pass ~$${e.usd}, then the re-plan passes of the failing shots)`);
  if (!argv.includes("--yes")) { console.log("dry run: nothing sent (add --yes)"); process.exit(0); }
  let minBuild = null; try { minBuild = endpointInfo().build ?? null; } catch { /* none */ }
  const seed = arg("seed") ? JSON.parse(fs.readFileSync(arg("seed"), "utf8")) : null; // a manifest.json whose stills carry label + local + gate
  const r = await gateTimeline({ tl, script, out, rounds: Number(arg("rounds", 2)), workers, minBuild, seed });
  const rep = r.report;
  console.log(`gate: ${rep.shots.filter((x) => x.first !== "pass" && x.first !== "unmeasured").length} failed first, ${rep.fixed.length} fixed, ${rep.unresolved.length} unresolved (${rep.unresolved.filter((u) => u.hard).length} hard)${rep.error ? `, error ${rep.error}` : ""}; ${r.missing.length} shots rendered after; spent $${r.spent.usd.toFixed(4)} (${r.spent.seconds.toFixed(0)} s, ${r.spent.jobs} jobs) -> ${path.resolve(out)}`);
  for (const u of rep.unresolved) console.log(`  unresolved s${u.shot} ${u.codes.join("+")}: ${(u.reasons ?? []).join("; ").slice(0, 200)}`);
}
