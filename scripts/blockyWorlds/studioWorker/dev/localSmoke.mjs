// Blocky Worlds STUDIO WORKER: a FREE local run of the worker's runner with the REAL steps on an earlier Studio run's
// files (its paid take is reused, so the voice step makes no call; the director's plan and the final mp4 are read from
// that run; RunPod and Anthropic are never called). Memory tables, files written to a local folder instead of storage.
//   node scripts/blockyWorlds/studioWorker/dev/localSmoke.mjs --from <studio run dir> --out <empty dir>
// Checks: sanitizeScript + voice (pace.mjs on the reused take) + the base plan + the mix + the final's free checks and
// the page bundle (as steps.final, without RunPod) + outputs (the size fit, web copy, poster) + the upload paths + the
// done row + the cost booking.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { makeSteps } from "../steps.mjs";
import { runStudioRun } from "../runner.mjs";
import { ledger } from "../../studio/ledger.mjs";
import { derive } from "../../studio/agent.mjs";
import { assemble, allChecks } from "../../studio/assemble.mjs";
import { makeStudioBundle } from "../../studio/bundle.mjs";

const argv = process.argv.slice(2), arg = (k) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : null);
const from = path.resolve(arg("from")), out = path.resolve(arg("out"));
fs.mkdirSync(out, { recursive: true });
const script = JSON.parse(fs.readFileSync(path.join(from, "results.json"), "utf8")).results[0].script;
const card = JSON.parse(fs.readFileSync(path.join(from, "results.json"), "utf8")).results[0].card ?? {};
const run = { id: randomUUID(), user_id: randomUUID(), env: "test", engine: "studio", status: "voice", studio_stage: "voice", worker_id: "smoke", claimed_at: new Date().toISOString(), title: script.title, lines: script.lines, card, length_sec: 60, credits_charged: 108 };

// the paid take of the earlier run, where the voice step looks for it (same text: no new take, no key needed)
const vdir = path.join(out, "work", run.id, "voice");
fs.mkdirSync(vdir, { recursive: true });
for (const f of ["take.json", "voice.mp3"]) fs.copyFileSync(path.join(from, "voice", f), path.join(vdir, f));

const rows = { run: { ...run }, ledger: [], refunds: 0, uploads: [] };
const db = {
  async updateRun(id, patch, guard) { if (guard?.notTerminal && ["done", "failed"].includes(rows.run.status)) return null; Object.assign(rows.run, patch); return { id }; },
  async refund() { rows.refunds++; return 108; },
  async ledger(r, list) { rows.ledger.push(...list); return list.reduce((a, x) => a + x.usd, 0); },
  async gateState() { return { settings: { paid_calls: true, daily_cap_usd: 20 }, counts: { spent_24h: 1 } }; },
};
const storage = { async upload(p, file) { const dst = path.join(out, "bucket", p); fs.mkdirSync(path.dirname(dst), { recursive: true }); if (Buffer.isBuffer(file)) fs.writeFileSync(dst, file); else fs.copyFileSync(file, dst); rows.uploads.push(p); return { path: p }; } };
const real = makeSteps({ anthropicKey: "not-used", elevenKey: "not-used" });
const steps = {
  ...real,
  async voice(a) {
    // the reused take: elevenVoice finds take.json with the same text and makes no call
    const take = JSON.parse(fs.readFileSync(path.join(vdir, "take.json"), "utf8"));
    const text = a.script.lines.map((l) => String(l.text).trim()).join("\n");
    if (take.text !== text) throw new Error("the sanitized script differs from the take's text: pick a run whose lines have no < > or double spaces");
    return real.voice(a);
  },
  async direct() { return { plan: JSON.parse(fs.readFileSync(path.join(from, "studio.json"), "utf8")), report: JSON.parse(fs.readFileSync(path.join(from, "director-report.json"), "utf8")) }; },
  async final({ plan, tl0, script: s }) {
    const res = derive(plan, tl0), { tl, problems } = assemble(tl0, plan), ac = allChecks(tl, s, plan);
    const code = await makeStudioBundle({ timeline: tl, shots: Object.fromEntries(plan.shots.map((x) => [x.id, x.code])), assets: plan.assets, homes: plan.bible?.homes ?? {}, creatures: plan.creatures ?? [], captions: true });
    console.log(`final (free part): ${tl.shots.length} cuts, gate ${ac.gate}, ${problems.length} timing problem(s), ${Object.values(res).filter((r) => !r.ok && !r.motionOnly).length} bad code; bundle ${(code.length / 1e6).toFixed(2)} MB (RunPod not called)`);
    return { final: path.join(from, "final", "final.mp4") };
  },
};
const t0 = Date.now();
const r = await runStudioRun(run, { db, steps, storage, makeLedger: ledger, workerId: "smoke", workDir: path.join(out, "work"), keepWork: true, log: (m) => console.log(`  ${m}`) });
console.log(JSON.stringify({ ok: r.ok, code: r.code, message: r.message, stages: r.stages, took: r.took, status: rows.run.status, files: rows.run.files, uploads: rows.uploads, ledger: rows.ledger.map((l) => `${l.stage} $${l.usd}`), refunds: rows.refunds, sec: Math.round((Date.now() - t0) / 1000) }, null, 1));
process.exit(r.ok ? 0 : 1);
