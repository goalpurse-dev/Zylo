// Blocky Worlds pipeline: in-memory / on-disk stand-ins for the runtime's adapters (renderRuntime.js), so the whole
// production state machine runs for free, with no network: tests/blockyWorldsRender.test.mjs and dev/pipelineDryRun.mjs.
//   memoryDb({ now })          the tables (runs, jobs, ledger) with the same guards as renderSupabase.ts
//   fileStorage(root)          signed URLs are file:// URLs under root (the worker reads and writes them as it would https)
//   scriptedRunPod()           records every /run; the test plays RunPod's part (webhooks) itself
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const TERMINAL = ["done", "failed"], LIVE = ["sent", "running"];
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

export function memoryDb({ now = () => Date.now() } = {}) {
  const runs = new Map(), jobs = new Map(), ledgerRows = [], refunds = [], alerts = [];
  const iso = () => new Date(now()).toISOString();
  return {
    runs, jobsMap: jobs, ledgerRows, refunds, alerts,
    /** a charged run, as blocky_worlds_start_run leaves it */
    addRun(fields = {}) {
      const r = { id: randomUUID(), user_id: randomUUID(), env: "test", status: "queued", pct: 0, created_at: iso(), stage_at: iso(), length_sec: 90, title: "Test", lines: [], card: {}, credits_charged: 62, credits_refunded: 0, refunded_at: null, cost_usd: 0, render: null, planned_at: null, voice_ready: false, files: null, end_card: true, ...fields };
      runs.set(r.id, r); return clone(r);
    },
    async getRun(id) { return clone(runs.get(id) ?? null); },
    async liveRuns(limit) { return [...runs.values()].filter((r) => !TERMINAL.includes(r.status)).slice(0, limit).map(clone); },
    async updateRun(id, patch, guard = {}) {
      const r = runs.get(id);
      if (!r) return null;
      if (guard.notTerminal && TERMINAL.includes(r.status)) return null;
      if (guard.plannedNull && r.planned_at) return null;
      Object.assign(r, clone(patch), { updated_at: iso() });
      return clone(r);
    },
    async jobs(runId) { return [...jobs.values()].filter((j) => j.run_id === runId).sort((a, b) => a.seq - b.seq).map(clone); },
    async getJob(id) { return clone(jobs.get(id) ?? null); },
    async insertJob(row) {
      for (const j of jobs.values()) if (j.run_id === row.run_id && j.role === row.role && j.idx === row.idx && j.attempt === row.attempt) return null;
      const j = { id: randomUUID(), seq: jobs.size, state: "sent", stage: null, pct: 0, provider_job_id: null, started_at: null, heartbeat_at: null, finished_at: null, gpu_seconds: null, error_code: null, error_message: null, output: null, created_at: iso(), ...clone(row) };
      jobs.set(j.id, j); return clone(j);
    },
    async updateJob(id, patch, guard = {}) {
      const j = jobs.get(id);
      if (!j) return null;
      if (guard.live && !LIVE.includes(j.state)) return null;
      Object.assign(j, clone(patch), { updated_at: iso() });
      return clone(j);
    },
    async jobsMissingCost(limit) { return [...jobs.values()].filter((j) => j.gpu_seconds == null && j.provider_job_id && j.finished_at && now() - Date.parse(j.finished_at) > 60000).slice(0, limit).map(clone); },
    async ledger(run, rows) {
      let add = 0;
      for (const row of rows) {
        if (ledgerRows.some((l) => l.run_id === run.id && l.ref === row.ref)) continue;
        ledgerRows.push({ run_id: run.id, ...clone(row) }); add += Number(row.usd) || 0;
      }
      const r = runs.get(run.id); if (r) r.cost_usd = +(Number(r.cost_usd) + add).toFixed(6);
      return add;
    },
    async refund(runId) {
      const r = runs.get(runId);
      if (!r || r.refunded_at || !(r.credits_charged > 0)) return 0;
      r.refunded_at = iso(); r.credits_refunded = r.credits_charged; refunds.push(runId);
      return r.credits_charged;
    },
    async alert(key, subject, text) { alerts.push({ key, subject, text }); },
  };
}

export function fileStorage(root) {
  fs.mkdirSync(root, { recursive: true });
  const file = (p) => path.join(root, ...p.split("/"));
  return {
    root, file,
    async signPut(p) { fs.mkdirSync(path.dirname(file(p)), { recursive: true }); return pathToFileURL(file(p)).href; },
    async signGet(p) { return fs.existsSync(file(p)) ? pathToFileURL(file(p)).href : null; },
    async readText(p) { return fs.existsSync(file(p)) ? fs.readFileSync(file(p), "utf8") : null; },
    async remove(list) { for (const p of list) fs.rmSync(file(p), { force: true }); },
    write(p, data) { fs.mkdirSync(path.dirname(file(p)), { recursive: true }); fs.writeFileSync(file(p), data); },
    exists(p) { return fs.existsSync(file(p)); },
  };
}

/** RunPod that only records: the test answers for it (webhook bodies through runtime.handleCallback) */
export function scriptedRunPod() {
  const sent = [], cancelled = [], statuses = new Map();
  return {
    sent, cancelled, statuses, configured: true,
    async run(body) { const id = `rp-${sent.length + 1}`; sent.push({ id, ...body, job: body.input.job }); return { id }; },
    async status(id) { return statuses.get(id) ?? { id, status: "IN_PROGRESS" }; },
    async cancel(id) { cancelled.push(id); },
    /** the last job sent for a role (and chunk index) */
    last(role, idx = null) { return [...sent].reverse().find((s) => s.job.role === role && (idx == null || s.job.chunk?.index === idx)); },
    query(s) { return Object.fromEntries(new URL(s.webhook).searchParams.entries()); },
  };
}
