// Cutaway Explainer: what happens next to a run, as a pure function of the run and one event (a worker's callback, the
// RunPod webhook, the watchdog's look). It returns the row patch and the actions; the edge functions carry them out
// (cutaway-callback, cutaway-watchdog). Pure, so the whole retry, fallback and refund path is tested in node.
//
// The path of a video (M3_PLAN.md, built 2026-10-24):
//   1. RunPod GPU: one job makes the whole video (plan, voice and its word check, the preview gate, render, mix).
//      It uploads its plan once the gate passes (plan_ready), so nothing after that is paid for twice.
//   2. A failure on our side (no GPU, a lost or failed worker, a busy provider): one retry on RunPod.
//   3. Then the Fly CPU fallback: a plan machine (only if the plan wasn't made yet), the video split into chunks over
//      machines (each retried once), and a mix machine.
//   4. A failure the video itself caused (the plan didn't pass, the preview gate blocked it, the voice failed its word
//      check twice) or an empty provider balance: no retry, the run fails and is refunded at once.
//   5. Any failure past the retries, or 45 minutes from the start: failed and refunded, once.

export const LIMITS = Object.freeze({ attempts: 2, staleSec: 300, queueSec: 480, hardMin: 45, pieceTries: 2 });
const TERMINAL = new Set(["done", "failed"]);
const ORDER = ["queued", "script", "scene", "render", "done"];
// failures the video itself caused (or an empty balance): a second try would fail the same way
export const NO_RETRY = new Set(["GATE_FAILED", "PLAN_FAILED", "VOICE_FAILED", "PROVIDER_BALANCE", "BAD_JOB"]);

const statusOf = (stage) => ({ queued: "queued", script: "script", facts: "script", scene: "scene", voice: "scene", preview: "scene", repair: "scene", render: "render", sound: "render", finish: "render", upload: "render" })[stage] ?? null;
const later = (a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a);
const iso = (ms) => new Date(ms).toISOString();

/** failed and refunded, once; an alert when it wasn't the video's own doing */
function terminal(run, f, now) {
  const actions = [{ type: "refund" }];
  if (run.provider === "runpod" && run.provider_job_id) actions.push({ type: "cancel", provider: "runpod", jobId: run.provider_job_id });
  if (f.code === "PROVIDER_BALANCE") actions.push({ type: "alert", key: "cutaway-provider-balance", subject: "Cutaway: a provider is out of balance", text: `Run ${run.id} failed: ${f.message ?? f.code}. New videos are paused until the balance is topped up.` });
  else if (!NO_RETRY.has(f.code)) actions.push({ type: "alert", key: "cutaway-render-failed", subject: "Cutaway: a video failed on our side", text: `Run ${run.id} (${run.topic}) failed after its retries: ${f.code} ${String(f.message ?? "").slice(0, 400)}` });
  // (the stage keeps the step it failed in: the owner's Details show it)
  return { patch: { status: "failed", error_code: f.code, error_message: String(f.message ?? "").slice(0, 3500), finished_at: iso(now) }, actions };
}

/** a failure on our side: retry on RunPod once, then the Fly fallback, then fail */
export function failOrRetry(run, f, now = Date.now()) {
  if (NO_RETRY.has(f.code) || f.retryable === false) return terminal(run, f, now);
  const attempt = run.attempt ?? 1;
  if (run.provider !== "fly" && attempt < LIMITS.attempts && f.code !== "NO_GPU_SLOT") {
    return { patch: { attempt: attempt + 1, error_code: f.code, heartbeat_at: null, dispatched_at: iso(now), provider_job_id: null }, actions: [{ type: "dispatch", target: "runpod", role: "video" }] };
  }
  if (run.provider !== "fly") {
    const phase = run.plan_ready ? "chunks" : "plan";
    return { patch: { provider: "fly", attempt: attempt + 1, error_code: f.code, heartbeat_at: null, dispatched_at: iso(now), provider_job_id: null, fallback: { phase, chunks: [], tries: {} } }, actions: [phase === "plan" ? { type: "dispatch", target: "fly", role: "plan" } : { type: "dispatch", target: "fly", role: "chunks" }] };
  }
  // on the fallback: the piece that failed gets one more try
  const fb = run.fallback ?? { phase: "plan", chunks: [], tries: {} }, key = f.piece ?? fb.phase, tries = (fb.tries?.[key] ?? 1);
  if (tries < LIMITS.pieceTries) {
    const next = { ...fb, tries: { ...(fb.tries ?? {}), [key]: tries + 1 } };
    const role = key.startsWith("chunk") ? "chunk" : key;
    return { patch: { fallback: next, heartbeat_at: null, dispatched_at: iso(now), error_code: f.code }, actions: [{ type: "dispatch", target: "fly", role, ...(role === "chunk" ? { index: Number(key.slice(6)) } : {}) }] };
  }
  return terminal(run, f, now);
}

/**
 * One event: { event: "progress"|"heartbeat"|"planned"|"chunk"|"done"|"failed"|"runpod", attempt, role, ... }.
 * Returns { patch, actions }. Events of an earlier attempt only add their costs (a stale worker can't move the run).
 */
export function onEvent(run, ev, now = Date.now()) {
  const actions = [], costs = ev.costs && Object.keys(ev.costs).length ? ev.costs : null;
  if (costs) actions.push({ type: "ledger", costs, role: ev.role, attempt: ev.attempt });
  if (TERMINAL.has(run.status)) return { patch: {}, actions };
  if (ev.event !== "runpod" && Number(ev.attempt ?? 1) < Number(run.attempt ?? 1)) return { patch: {}, actions };
  const beat = { heartbeat_at: iso(now) };
  switch (ev.event) {
    case "heartbeat": return { patch: beat, actions };
    case "progress": {
      const st = statusOf(ev.stage), patch = { ...beat };
      if (st) { const s = later(run.status ?? "queued", st); if (s !== run.status) { patch.status = s; patch.stage_at = iso(now); } }
      if (ev.stage) patch.stage = ev.stage;
      if (Number.isFinite(ev.pct)) patch.pct = Math.max(0, Math.min(100, Math.round(ev.pct)));
      for (const k of ["title", "narration", "parts", "facts"]) if (ev[k] != null) patch[k] = ev[k];
      return { patch, actions };
    }
    case "planned": {
      const patch = { ...beat, plan_ready: true, frames_total: Number(ev.frames) || null, preview_frames: Number(ev.previewFrames) || 0, plan_key: ev.key ?? null };
      for (const k of ["title", "narration", "parts", "facts", "post"]) if (ev[k] != null) patch[k] = ev[k];
      if (run.status !== "render") { patch.status = later(run.status ?? "queued", "render"); patch.stage = "render"; patch.stage_at = iso(now); patch.pct = 0; }
      // the fallback's plan machine is done: the chunks next
      if (run.provider === "fly") { patch.fallback = { ...(run.fallback ?? {}), phase: "chunks" }; actions.push({ type: "dispatch", target: "fly", role: "chunks" }); }
      return { patch, actions };
    }
    case "chunk": {
      const fb = run.fallback ?? { phase: "chunks", chunks: [] };
      const chunks = (fb.chunks ?? []).map((c) => (c.index === ev.index ? { ...c, done: true } : c));
      const done = chunks.filter((c) => c.done).length, all = chunks.length && done === chunks.length;
      const patch = { ...beat, fallback: { ...fb, chunks, ...(all ? { phase: "mix" } : {}) }, pct: chunks.length ? Math.round((done / chunks.length) * 95) : run.pct };
      if (all) actions.push({ type: "dispatch", target: "fly", role: "mix" });
      return { patch, actions };
    }
    case "done":
      actions.push({ type: "settle", seconds: ev.seconds ?? null, renderer: ev.renderer ?? null }, { type: "saveLayout" });
      return { patch: { ...beat, status: "done", stage: "done", pct: 100, finished_at: iso(now), files: ev.files ?? null, renderer: ev.renderer ?? null, error_code: null, error_message: null }, actions };
    case "failed": {
      const r = failOrRetry(run, { code: ev.code ?? "RENDER_FAILED", message: ev.message, retryable: ev.retryable, piece: ev.role === "chunk" ? `chunk_${ev.index}` : ev.role === "mix" || ev.role === "plan" ? ev.role : undefined }, now);
      return { patch: r.patch, actions: [...actions, ...r.actions] };
    }
    case "runpod": {
      // the RunPod webhook: a job that ended without its worker's own "done"/"failed" (a crash, a timeout)
      // only the run's current job counts: an earlier attempt's webhook (its worker already reported the failure that
      // started this attempt) must not fail or retry the run a second time
      if (!ev.jobId || ev.jobId !== run.provider_job_id) return { patch: {}, actions };
      const st = String(ev.status ?? "").toUpperCase();
      if (st === "COMPLETED" && ev.output?.ok) return { patch: {}, actions: [...actions, { type: "verifyDone" }] };
      if (st === "COMPLETED" || ["FAILED", "CANCELLED", "TIMED_OUT"].includes(st)) {
        const r = failOrRetry(run, { code: ev.output?.code ?? (st === "TIMED_OUT" ? "TIMEOUT" : "RENDER_FAILED"), message: ev.output?.error ?? st, retryable: !NO_RETRY.has(ev.output?.code) }, now);
        return { patch: r.patch, actions: [...actions, ...r.actions] };
      }
      return { patch: {}, actions };
    }
    default: return { patch: {}, actions };
  }
}

/**
 * The watchdog's look at a running run (every 2 minutes). rp: RunPod's status of the run's job ({ status, executionTime })
 * or null when it couldn't be read.
 */
export function onWatch(run, rp, now = Date.now()) {
  if (TERMINAL.has(run.status)) return { patch: {}, actions: [] };
  const created = Date.parse(run.created_at), last = Date.parse(run.heartbeat_at ?? run.dispatched_at ?? run.created_at);
  if (now - created > LIMITS.hardMin * 60000) return terminal(run, { code: "TIMEOUT", message: `not done after ${LIMITS.hardMin} minutes` }, now);
  const stale = now - last > LIMITS.staleSec * 1000;
  if (run.provider === "fly") {
    if (!stale) return { patch: {}, actions: [] };
    const fb = run.fallback ?? {};
    const piece = fb.phase === "chunks" ? `chunk_${(fb.chunks ?? []).find((c) => !c.done)?.index ?? 0}` : fb.phase ?? "plan";
    return failOrRetry(run, { code: "LOST", message: "a fallback machine stopped reporting", piece }, now);
  }
  // RunPod
  const st = String(rp?.status ?? "").toUpperCase();
  if (st === "IN_QUEUE" && now - Date.parse(run.dispatched_at ?? run.created_at) > LIMITS.queueSec * 1000) {
    const r = failOrRetry(run, { code: "NO_GPU_SLOT", message: `no GPU for ${LIMITS.queueSec / 60} minutes` }, now);
    return { patch: r.patch, actions: [{ type: "cancel", provider: "runpod", jobId: run.provider_job_id }, ...r.actions] };
  }
  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(st)) return failOrRetry(run, { code: st === "TIMED_OUT" ? "TIMEOUT" : "RENDER_FAILED", message: `RunPod says ${st}` }, now);
  if (st === "COMPLETED") return { patch: {}, actions: [{ type: "verifyDone" }] };
  if (stale && st !== "IN_QUEUE") {
    const r = failOrRetry(run, { code: "LOST", message: "the worker stopped reporting" }, now);
    return { patch: r.patch, actions: [...(run.provider_job_id ? [{ type: "cancel", provider: "runpod", jobId: run.provider_job_id }] : []), ...r.actions] };
  }
  return { patch: {}, actions: [] };
}
