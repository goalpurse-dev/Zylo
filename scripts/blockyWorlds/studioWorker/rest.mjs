// Blocky Worlds STUDIO WORKER: the database and storage, over Supabase's REST APIs with the worker's service key (its
// own secret). The same adapter shape as studioRuns.js / the runner expect; fetchFn is injectable, so the tests run it
// against a fake with no network. Never logs a key or a header.
//   db.claim(workerId)                         blocky_worlds_claim_studio_run: the oldest queued Studio run, or null
//   db.getRun(id)  db.updateRun(id, patch, { notTerminal, worker })  db.refund(runId)  db.ledger(run, rows)
//   db.gateState(userId)                       { settings, counts } for guard.js decide (paid switch, emergency cap)
//   db.workerSeen(id, { version, busyRun })    the hello start checks (blocky_worlds_workers)
//   db.liveStudioRuns(limit)                   db.alert(key, subject, text) (a system_logs row the sweeper mails)
//   storage.upload(path, file, contentType)    into the private bucket blocky-worlds-renders
import fs from "node:fs";

const TERMINAL = "(done,failed)";
const RUNS = "/rest/v1/blocky_worlds_runs";
const ZERO_USER = "00000000-0000-0000-0000-000000000000";

export function restClient({ url, key, fetchFn = fetch, timeoutMs = 30000 }) {
  const base = String(url).replace(/\/$/, "");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  return async function call(method, path, body = undefined, extra = {}) {
    const isBuf = Buffer.isBuffer(body);
    const res = await fetchFn(`${base}${path}`, {
      method, headers: { ...headers, ...(isBuf ? {} : { "Content-Type": "application/json" }), ...extra },
      body: body === undefined ? undefined : isBuf ? body : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw Object.assign(new Error(`${method} ${path.split("?")[0]}: ${res.status} ${String(text).slice(0, 240)}`), { status: res.status });
    return data;
  };
}

export function restDb({ url, key, fetchFn = fetch, now = () => Date.now() }) {
  const call = restClient({ url, key, fetchFn });
  const iso = () => new Date(now()).toISOString();
  const id = (v) => encodeURIComponent(String(v));
  return {
    async claim(workerId) {
      const rows = await call("POST", "/rest/v1/rpc/blocky_worlds_claim_studio_run", { p_worker: workerId });
      return Array.isArray(rows) ? rows[0] ?? null : rows && typeof rows === "object" && rows.id ? rows : null;
    },
    async getRun(runId) { return (await call("GET", `${RUNS}?id=eq.${id(runId)}&select=*`))?.[0] ?? null; },
    async updateRun(runId, patch, guard = {}) {
      let q = `${RUNS}?id=eq.${id(runId)}`;
      if (guard.notTerminal) q += `&status=not.in.${TERMINAL}`;
      if (guard.worker) q += `&worker_id=eq.${id(guard.worker)}`;
      const rows = await call("PATCH", `${q}&select=id,status,worker_id`, { ...patch, updated_at: iso() }, { Prefer: "return=representation" });
      return Array.isArray(rows) ? rows[0] ?? null : null;
    },
    async refund(runId) { return Number(await call("POST", "/rest/v1/rpc/blocky_worlds_refund", { p_run: runId })) || 0; },
    /** rows with a ref are written once (unique run_id + ref); only the new ones are added to the run's cost */
    async ledger(run, rows) {
      if (!rows?.length) return 0;
      const body = rows.map((r) => ({ run_id: run.id, stage: r.stage, provider: r.provider, model: r.model ?? null, usd: r.usd, units: r.units ?? {}, ref: r.ref }));
      const saved = await call("POST", "/rest/v1/blocky_worlds_cost_ledger?on_conflict=run_id,ref", body, { Prefer: "resolution=ignore-duplicates,return=representation" });
      const add = (Array.isArray(saved) ? saved : []).reduce((a, r) => a + Number(r.usd || 0), 0);
      if (add > 0) await call("POST", "/rest/v1/rpc/blocky_worlds_add_cost", { p_run: run.id, p_usd: +add.toFixed(6) });
      return add;
    },
    async gateState(userId = ZERO_USER) {
      const [settings, counts] = await Promise.all([
        call("GET", "/rest/v1/blocky_worlds_settings?id=eq.1&select=*").then((r) => r?.[0] ?? null).catch(() => null),
        call("POST", "/rest/v1/rpc/blocky_worlds_guard", { p_user: userId }).catch(() => null),
      ]);
      return { settings, counts };
    },
    async workerSeen(workerId, { version = "dev", busyRun = null } = {}) {
      await call("POST", "/rest/v1/blocky_worlds_workers?on_conflict=id", [{ id: workerId, version, busy_run: busyRun, seen_at: iso() }], { Prefer: "resolution=merge-duplicates,return=minimal" });
    },
    async workerGone(workerId) { await call("DELETE", `/rest/v1/blocky_worlds_workers?id=eq.${id(workerId)}`).catch(() => {}); },
    async liveStudioRuns(limit = 50) { return (await call("GET", `${RUNS}?engine=eq.studio&status=not.in.${TERMINAL}&deleted_at=is.null&order=created_at&limit=${limit}&select=id,user_id,title,status,engine,created_at,claimed_at,heartbeat_at,worker_id,credits_charged,refunded_at,length_sec`)) ?? []; },
    /** the worker has no Resend key: a failure is a system_logs row; the sweeper's alert reads failed Studio runs */
    async alert(key, subject, text) {
      await call("POST", "/rest/v1/system_logs", { source: "blocky-worlds-studio", level: "error", event: String(key).slice(0, 120), message: String(subject).slice(0, 300), details: { text: String(text).slice(0, 2000) } }, { Prefer: "return=minimal" }).catch(() => {});
    },
  };
}

export function restStorage({ url, key, fetchFn = fetch, bucket = "blocky-worlds-renders" }) {
  const call = restClient({ url, key, fetchFn, timeoutMs: 300000 });
  return {
    bucket,
    /** one file (path inside the bucket), overwritten if it is there (a retried upload) */
    async upload(path, file, contentType) {
      if (!/^(prod|test)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\//i.test(path)) throw new Error(`refusing an upload outside a run folder: ${path}`);
      const bytes = Buffer.isBuffer(file) ? file : fs.readFileSync(file);
      await call("POST", `/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, bytes, { "Content-Type": contentType, "x-upsert": "true" });
      return { path, bytes: bytes.length };
    },
  };
}
