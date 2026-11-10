// One full TEST VIDEO through the production roles on RunPod (2026-11-10, owner-approved for script #2, cap $0.60):
//   1. role "prepare" on RunPod (runpod/worker.mjs: the Sonnet story director || the ElevenLabs voice (the template's
//      RunPod secrets), the builder, planVideo (simple look + pacing), the AI shot review, the FOUR pre-render checks
//      (never bypassed: any miss stops the run), music A, the simple-look SFX + mix)
//   2. the four checks again here on the downloaded timeline (must be 0)
//   3. the chunks on RunPod + the mux (runpod/dispatch.mjs, no paid retry: --retries 0)
// Files live in a private storage test folder kept for the run (a re-run reuses the take: never a second paid voice).
// Without --yes: the plan only. Spend -> <out>/spend.jsonl; every paid step's real cost in <out>/costs.json.
//   node dev/simple/videoRun.mjs --script <results.json> --pick 2 --out <dir> [--chunks 4] [--cap 0.6] [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rpClient, storage, loadEnv, billed, logSpend, endpointInfo, RATE } from "../../runpod/client.mjs";
import { checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../../plan.mjs";
import { loadScript } from "./planScript.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds");
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = arg("out"), file = arg("script"), CAP = Number(arg("cap", 0.6)), K = Number(arg("chunks", 4));
if (!out || !file) { console.error("usage: node dev/simple/videoRun.mjs --script <file> --pick n --out <dir> [--yes]"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const say = (...a) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${a.join(" ")}`; console.log(l); fs.appendFileSync(path.join(out, "run.log"), l + "\n"); };
const { script, idea } = loadScript(file, arg("pick"));
const chars = script.lines.map((l) => String(l.text).trim()).join("\n").length;
const costs = fs.existsSync(path.join(out, "costs.json")) ? JSON.parse(fs.readFileSync(path.join(out, "costs.json"), "utf8")) : {};
const saveCosts = () => fs.writeFileSync(path.join(out, "costs.json"), JSON.stringify(costs, null, 1));
const spent = () => Object.values(costs).reduce((a, b) => a + (Number(b) || 0), 0);
// the purse: voice (worst 0.5 ElevenLabs credits / char), the director (Sonnet, worst ~$0.10), review + builder caps,
// the RunPod prepare + chunks
// the builder's cap must cover at least one design call's worst case (Sonnet object design ~/usr/bin/bash.065: a /usr/bin/bash.06 cap built
// nothing and the run stopped CRITICAL_UNBUILT, 2026-11-10); --builder-usd sets it
const B = { voiceWorst: +(chars * 0.5 * 0.0002).toFixed(4), director: 0.1, review: 0.04, builder: Number(arg("builder-usd", 0.15)), prepareRunpod: 0.06, chunks: 0.12 };
say(`plan: "${script.title}" ${script.lines.length} lines, ${chars} chars; worst case $${Object.values(B).reduce((a, b) => a + b, 0).toFixed(3)} (cap $${CAP})`);
if (!argv.includes("--yes")) { say("dry run: nothing sent (add --yes)"); process.exit(0); }

const env = loadEnv();
const st = storage(env, `blocky-worlds-test/video/${path.basename(out)}`);
const rp = rpClient();
const minBuild = endpointInfo().build ?? null;
const F = ["voice.mp3", "take.json", "timeline.json", "mix.m4a", "visual-check.json", "production.json", "direction.json", "shot-review.json"];

async function libraryRows() {
  try {
    const { snapshotRows, LIBRARY_SNAPSHOT } = await import(pathToFileURL(path.join(SHARED, "render.js")).href);
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/blocky_worlds_assets?select=id,kind,name,name_key,aliases,keys,blueprint,still_path,status,uses&status=eq.live&order=uses.desc,updated_at.desc&limit=${LIBRARY_SNAPSHOT.rows}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!r.ok) { say(`library snapshot skipped: HTTP ${r.status}`); return []; }
    return snapshotRows(await r.json());
  } catch (e) { say(`library snapshot skipped: ${e.message}`); return []; }
}

// ---------------------------------------------------------------- 1. prepare on RunPod
if (!fs.existsSync(path.join(out, "timeline.json"))) {
  const haveTake = !!(await st.get("take.json")), haveDirection = !!(await st.get("direction.json")); // a re-run pays for neither again
  const up = {}; for (const f of F) up[f] = await st.signPut(f);
  const library = await libraryRows();
  const job = {
    role: "prepare", mode: "gpu", runId: `test-${path.basename(out)}`, jobId: `prepare-${path.basename(out)}`, attempt: 1, ...(minBuild ? { minBuild } : {}),
    prepare: {
      script, idea, lengthSec: 90, music: "A",
      director: { provider: "anthropic", model: "claude-sonnet-5-5", ...(haveDirection ? { stored: await st.signGet("direction.json") } : {}) },
      builder: { provider: "anthropic", library, budget: { maxUsd: B.builder } },
      review: { provider: "anthropic", model: "claude-haiku-5-5", budget: { maxUsd: B.review } },
      voice: haveTake ? { get: { mp3: await st.signGet("voice.mp3"), take: await st.signGet("take.json") } } : { put: { mp3: up["voice.mp3"], take: up["take.json"] } },
      out: { timeline: up["timeline.json"], mix: up["mix.m4a"], visualCheck: up["visual-check.json"], production: up["production.json"], direction: up["direction.json"], shotReview: up["shot-review.json"] },
      limits: { prepareSec: 420 },
    },
  };
  say(`prepare: library ${library.length} rows, take ${haveTake ? "reused (no new voice)" : "new (ElevenLabs)"}, director list ${haveDirection ? "reused" : "new"}, builder cap ${B.builder}; build ${minBuild}`);
  const id = await rp.submit({ job });
  say(`prepare job ${id}`);
  const s = await rp.wait(id, { maxSec: 900, pollMs: 4000 });
  const b = billed(s);
  logSpend(out, `Blocky Worlds #2 video prepare ${id} (${s.status})`, b);
  costs[costs.prepareRunpod != null ? "prepareRunpod2" : "prepareRunpod"] = b.usd;
  const o = s.output ?? {};
  fs.writeFileSync(path.join(out, "prepare-result.json"), JSON.stringify({ status: s.status, error: s.error ?? null, output: o }, null, 1));
  if (o.voice?.costUsd != null && !o.voice?.reused) costs.voice = o.voice.costUsd;
  if (!o.voice && !haveTake) { const t = await st.get("take.json"); if (t) costs.voice = JSON.parse(t).costUsd ?? costs.voice; } // a failed prepare still bought the take
  if (o.spend) { costs[haveDirection ? "directorRerun" : "director"] = o.spend.directorUsd ?? 0; costs.builder = o.spend.builderUsd ?? 0; costs.review = o.spend.reviewUsd ?? o.planned?.review?.costUsd ?? 0; }
  saveCosts();
  say(`prepare ${s.status}: billed ${b.seconds} s $${b.usd}; voice $${o.voice?.costUsd ?? "?"}; spend ${JSON.stringify(o.spend ?? null)}; spent so far $${spent().toFixed(4)}`);
  if (!(s.status === "COMPLETED" && o.ok)) { say(`STOPPED: prepare failed: ${o.code ?? ""} ${String(s.error ?? o.error ?? "").slice(0, 1500)}`); process.exit(1); }
  for (const f of F) { const buf = await st.get(f); if (buf) fs.writeFileSync(path.join(out, f), buf); }
}

// ---------------------------------------------------------------- 2. the four checks here too (never bypassed)
const tl = JSON.parse(fs.readFileSync(path.join(out, "timeline.json"), "utf8"));
const checks = { timeline: checkTimeline(tl).filter((p) => !/unknown built asset/.test(p)), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) };
fs.writeFileSync(path.join(out, "checks.json"), JSON.stringify(checks, null, 1));
const n = Object.values(checks).reduce((a, b) => a + b.length, 0);
say(`checks: ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}; look ${tl.look}; ${tl.shots.length} shots, ${tl.duration} s; pacing ${JSON.stringify(tl.pacing?.after ?? null)}`);
if (n) { say("STOPPED: a pre-render check failed (no render)"); process.exit(1); }

// ---------------------------------------------------------------- 3. chunks + mux (no paid retry)
const est = (K * (15 + 33) + (tl.duration * 24) * 0.06) * RATE;
if (spent() + est > CAP) { say(`STOPPED: the render estimate $${est.toFixed(3)} would take the spend $${spent().toFixed(3)} over $${CAP}`); process.exit(1); }
say(`render: ${K} chunks, estimate $${est.toFixed(3)}`);
const r = spawnSync(process.execPath, [path.join(ENGINE, "runpod/dispatch.mjs"), "--run", out, "--out", path.join(out, "runpod"), "--chunks", String(K), "--retries", "0", "--max-chunk-sec", "600", "--yes"], { cwd: ENGINE, encoding: "utf8", maxBuffer: 1 << 26 });
fs.writeFileSync(path.join(out, "dispatch.log"), `${r.stdout}\n${r.stderr}`);
const last = String(r.stdout).trim().split(/\r?\n/).at(-1);
let d = null; try { d = JSON.parse(last); } catch { /* no summary */ }
costs.chunks = d?.usd ?? null; saveCosts();
say(`dispatch exit ${r.status}; ${d ? `$${d.usd}, wall ${d.wallS} s` : last?.slice(0, 300)}; total spent $${spent().toFixed(4)}`);
if (r.status !== 0) { say("STOPPED: the render failed (no paid retry)"); process.exit(1); }
say(`DONE: ${path.join(out, "runpod", "final.mp4")}`);
