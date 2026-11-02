// M3: a real failure, kept as a free test case (the owner's rule of 2026-10-30: "every real failure's saved plan and
// voice become a free test case in the harness, so the same bug can never cost money twice").
// A failed run keeps its plan (videoJob keepFailedPlan): the script with the planner's trace, which holds every paid
// reply it got (beats plan, fact research, fact-check, words, repairs), its layout, and its voice take when it had one.
// This writes them as harness answers (m2/providers.mjs: answers/<label>__<n>.json), so the run is replayed through
// the production code path for free: m3/replayFailures.mjs runs every case, and tests/cutawayFailures.test.mjs replays
// each plan in `npm test`.
//   node m3/failureCase.mjs --run <run id> [--env-file .env.local]   one run
//   node m3/failureCase.mjs --all [--since 2026-10-29] [--env-file …]  every failed run with a saved plan, not yet kept
// Reads with the service key (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from the environment or --env-file); free.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FAILURES = path.join(here, "failures");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

/** the harness answers a saved script's trace holds: one per paid reply, numbered per label as the replay counts them */
export function answersFromTrace(trace, runId) {
  const n = new Map(), out = {};
  for (const t of trace ?? []) {
    if (!t?.label || t.data == null || !("costUsd" in t || t.cached)) continue;
    const k = slug(t.label), i = (n.get(k) ?? 0) + 1; n.set(k, i);
    // (hash "*": the request may change with a fix, the reply is what the real run got)
    out[`${k}__${i}.json`] = { hash: "*", by: `real run ${runId}`, ...(t.searches != null ? { searches: t.searches } : {}), data: t.data };
  }
  return out;
}

/** a trace from the worker's steps bundle (plan/steps.json: { files: { "step_<n>_<label>.json": reply } }), for a run
 *  that stopped before its script was made */
export function traceFromSteps(files) {
  return Object.entries(files ?? {}).map(([f, r]) => ({ n: Number(/^step_(\d+)_/.exec(f)?.[1]), label: f.replace(/^step_\d+_|\.json$/g, ""), r }))
    .filter((x) => Number.isFinite(x.n)).sort((a, b) => a.n - b.n).map(({ label, r }) => ({ label, costUsd: r.costUsd ?? 0, searches: r.searches, data: r.data }));
}

/** a case folder from a run row and its saved files ({ script, layout, voice?: Buffer, words? }) */
export function writeCase(run, files, root = FAILURES) {
  const name = `${slug(run.topic_key ?? run.topic)}_${run.length_sec}s_${run.id.slice(0, 8)}`, dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, "answers"), { recursive: true });
  const answers = answersFromTrace(files.script.trace, run.id);
  for (const [f, a] of Object.entries(answers)) fs.writeFileSync(path.join(dir, "answers", f), JSON.stringify(a, null, 1));
  if (files.voice) {
    fs.writeFileSync(path.join(dir, "answers", "voice.mp3"), files.voice);
    if (files.words) fs.writeFileSync(path.join(dir, "answers", "voice.words.json"), JSON.stringify(files.words));
    fs.writeFileSync(path.join(dir, "answers", "voice__1.json"), JSON.stringify({ file: "answers/voice.mp3", ...(files.words ? { words: "answers/voice.words.json" } : {}), by: `real run ${run.id}` }, null, 1));
  }
  const spend = files.script.spend ?? [];
  fs.writeFileSync(path.join(dir, "case.json"), JSON.stringify({
    runId: run.id, topic: run.topic, lengthSec: run.length_sec, kind: run.kind, at: run.created_at,
    failed: { code: run.error_code, message: run.error_message, stage: run.stage, attempts: run.attempt },
    costUsd: run.cost_usd, answers: Object.keys(answers), voice: !!files.voice,
    // what the planner's own checks said when it stopped (the replay must not stop there again)
    problems: files.script.report?.problems ?? [],
    spend: spend.map((s) => ({ label: s.label, usd: s.costUsd, outputTokens: s.usage?.output_tokens ?? null, at: s.at })),
  }, null, 1));
  return { name, dir, answers: Object.keys(answers).length };
}

// ---------- the command ----------
if (/failureCase\.mjs$/.test(process.argv[1] ?? "")) {
  const argv = process.argv.slice(2), a = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
  const env = { ...process.env };
  if (a["env-file"]) for (const l of fs.readFileSync(a["env-file"], "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error("needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (--env-file)"); process.exit(1); }
  const H = { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY };
  const rows = async (q) => (await fetch(`${env.SUPABASE_URL}/rest/v1/cutaway_runs?${q}`, { headers: H })).json();
  const file = async (key) => { const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/cutaway-renders/${key}`, { headers: H }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; };
  const runs = a.run ? await rows(`id=eq.${a.run}&select=*`) : await rows(`status=eq.failed&created_at=gte.${a.since ?? "2026-10-29"}&order=created_at.asc&select=*`);
  const kept = new Set(fs.existsSync(FAILURES) ? fs.readdirSync(FAILURES).map((d) => d.slice(-8)) : []);
  for (const run of runs) {
    if (!a.run && kept.has(run.id.slice(0, 8))) continue;
    const dir = `${run.env ?? "prod"}/${run.user_id}/${run.id}/plan`;
    const script = await file(`${dir}/script.json`), steps = await file(`${dir}/steps.json`);
    const s = script ? JSON.parse(script.toString("utf8")) : {};
    // (the paid replies: the script's trace, else the steps bundle of a run that stopped before its script was made)
    if (!s.trace?.length && steps) s.trace = traceFromSteps(JSON.parse(steps.toString("utf8")).files);
    if (!s.trace?.length) { console.log(`${run.id} ${run.topic}: no saved plan (failed before keepFailedPlan kept one)`); continue; }
    // (a plan made by the planner's older flow, script first, before visuals first on 2026-10-27: its replies answer
    // calls the planner no longer makes)
    const first = run.kind === "custom" ? "beats plan" : "words";
    if (!s.trace.some((t) => t.label === first && t.data)) { console.log(`${run.id} ${run.topic}: made by an older planner flow (no "${first}" reply): not replayable`); continue; }
    const voice = await file(`${dir}/voice.mp3`), words = await file(`${dir}/words.json`);
    const c = writeCase(run, { script: s, voice, words: words ? JSON.parse(words.toString("utf8")) : null });
    console.log(`${run.id} ${run.topic} ${run.length_sec} s (${run.error_code}): kept as ${c.name}, ${c.answers} answers${voice ? " and its voice" : ""}`);
  }
}
