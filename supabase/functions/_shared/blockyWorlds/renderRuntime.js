// Blocky Worlds: the production pipeline's runtime (docs/blocky-worlds-pipeline.md). render.js decides; this file carries
// the decisions out through three adapters, so the same code runs in the edge function (renderSupabase.ts: Supabase +
// RunPod) and in the free local dry run (engine/dev/pipelineDryRun.mjs: memory + files + a fake RunPod).
//
//   db:      getRun(id), liveRuns(limit), updateRun(id, patch, { notTerminal, plannedNull }) -> row | null,
//            jobs(runId), getJob(id), insertJob(row) -> row | null (null: that attempt exists already),
//            updateJob(id, patch, { live }) -> row | null, jobsMissingCost(limit), ledger(run, rows) -> usd added,
//            refund(runId) -> credits, alert(key, subject, text)
//            optional (the shared library, lib/builder/cache.js; both guarded: a missing table never breaks a run):
//            assetLibrary(limit) -> rows (blocky_worlds_assets, live), saveAsset(row) -> boolean
//   production: { director, builder, builderMaxUsd, review, reviewMaxUsd } (render.js productionSettings: the function secrets)
//   storage: signPut(path) -> url, signGet(path, seconds?) -> url | null, readText(path) -> string | null
//   runpod:  configured, run({ input, webhook, policy }) -> { id }, status(id) -> object | null, cancel(id)
//
// Every entry point is safe to call any number of times (duplicate callbacks, the sweeper, webhook retries).
import { WORKER_BUILD } from "./renderBuild.js";
import { assetRow, BUCKET, builderSpentOf, chooseChunkCount, chunkPlan, chunkRunSec, LIBRARY_SNAPSHOT, onJobEvent, paths, prepareProduction, PRODUCTION_DEFAULTS, reconcile, RENDER, sameToken, snapshotRows, tokenFor } from "./render.js";
import { activeRenderRuns, admission } from "./renderQueue.js";

export { BUCKET };
const LIVE = ["sent", "running"];
const MAX_UPLOAD = 48e6;

// queue (2026-11-07, renderQueue.js): true = the endpoint's workers are shared oldest run first (a piece is sent to RunPod
// only while a worker is free; the rest waits in our line and goes out when a piece ends: pump) and the chunk count
// follows the load (chooseChunkCount). db.jobsOfRuns(ids) (optional) reads every live run's jobs in one query;
// runpod.health() (optional, a read-only GET) tells the K choice whether RunPod is already full.
export function makeRuntime({ db, storage, runpod, secret, callbackUrl, cfg = RENDER, now = () => Date.now(), log = (...a) => console.log("[blocky-worlds-render]", ...a), mode = "gpu", limitFrames = null, chunks = null, production = PRODUCTION_DEFAULTS, minBuild = WORKER_BUILD, queue = true }) {
  const iso = () => new Date(now()).toISOString();

  /** every live run (oldest first) and its job rows */
  async function snapshot() {
    const runs = [...((await db.liveRuns(50)) ?? [])].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const ids = runs.map((r) => r.id), jobsByRun = new Map(ids.map((id) => [id, []]));
    const rows = typeof db.jobsOfRuns === "function" ? await db.jobsOfRuns(ids) : (await Promise.all(ids.map((id) => db.jobs(id)))).flat();
    for (const j of rows ?? []) jobsByRun.get(j.run_id)?.push(j);
    return { runs, jobsByRun };
  }
  /** how many pieces this run may send now (oldest run first); Infinity when the queue is off or unreadable */
  async function roomFor(run, jobs) {
    if (!queue) return Infinity;
    try {
      const s = await snapshot();
      if (!s.runs.some((r) => r.id === run.id)) s.runs.push(run);
      s.runs = s.runs.map((r) => (r.id === run.id ? run : r));
      s.jobsByRun.set(run.id, jobs);
      return admission(s.runs, s.jobsByRun, now(), cfg).get(run.id) ?? Infinity;
    } catch (e) { log(`queue read failed, sending without it: ${e?.message ?? e}`); return Infinity; }
  }
  /** a piece ended somewhere: the oldest runs waiting in our line send what now fits */
  async function pump(exceptId = null) {
    if (!queue) return 0;
    let n = 0;
    try {
      const s = await snapshot();
      const room = admission(s.runs, s.jobsByRun, now(), cfg);
      for (const r of s.runs) if (r.id !== exceptId && (room.get(r.id) ?? 0) > 0) { await reconcileRun(r.id); n++; }
    } catch (e) { log(`pump: ${e?.message ?? e}`); }
    return n;
  }

  /** the shared library for the builder: a snapshot (the worker has no key); any error -> an empty library */
  async function library() {
    if (production?.builder !== "on" || typeof db.assetLibrary !== "function") return [];
    try { return snapshotRows(await db.assetLibrary(LIBRARY_SNAPSHOT.rows)); } catch (e) { log(`library snapshot skipped: ${e?.message ?? e}`); return []; }
  }

  // ---------- the job a worker gets: signed URLs and a callback token, never a key ----------
  async function jobInput(run, row, a, jobs) {
    const P = paths(run), token = await tokenFor(secret, run.id);
    // minBuild: a worker on an older image refuses the job before any paid work (STALE_WORKER, renderBuild.js)
    const base = { v: 1, role: a.role, runId: run.id, jobId: row.id, attempt: a.attempt, mode, callback: { url: callbackUrl, token }, ...(minBuild ? { minBuild } : {}) };
    if (a.role === "prepare") {
      // the story director + the builder (render.js prepareProduction: a retry designs only with what the earlier tries
      // left of the per-video cap; limits = the caps). A retry gets the list an earlier try stored (direction.json:
      // the director is never paid twice; a missing file is a null URL and the worker directs again).
      const prod = prepareProduction(production ?? PRODUCTION_DEFAULTS, { attempt: a.attempt, library: await library(), builderSpentUsd: builderSpentOf(jobs, a.attempt) });
      const stored = a.attempt > 1 && prod.director.provider === "anthropic" ? await Promise.resolve(storage.signGet(P.direction)).catch(() => null) : null;
      // an earlier try planned and the server split that plan into chunks (they may be rendering already): the retry
      // makes the mix from THAT timeline and plans nothing again, so the sound always matches the frames
      const resume = run.planned_at && a.attempt > 1 ? { timeline: await storage.signGet(P.timeline) } : null;
      return {
        ...base,
        prepare: {
          director: { ...prod.director, ...(stored ? { stored } : {}) }, builder: prod.builder, review: prod.review, limits: prod.limits,
          ...(resume?.timeline ? { resume } : {}),
          script: { title: run.title, lines: run.lines }, idea: run.card ?? {}, lengthSec: run.length_sec, music: cfg.music, sfx: true,
          // the paid take is bought once: a retry gets it back (render.js onJobEvent "voiced" sets voice_ready)
          voice: run.voice_ready ? { get: { mp3: await storage.signGet(P.voiceMp3), take: await storage.signGet(P.take) } } : { put: { mp3: await storage.signPut(P.voiceMp3), take: await storage.signPut(P.take) } },
          out: { timeline: await storage.signPut(P.timeline), visualCheck: await storage.signPut(P.visualCheck), production: await storage.signPut(P.production), direction: await storage.signPut(P.direction), shotReview: await storage.signPut(P.shotReview), mix: await storage.signPut(P.mix) },
        },
      };
    }
    if (a.role === "chunk") {
      return { ...base, chunk: { index: a.idx, from: a.from, to: a.to, crf: cfg.crf, maxBytes: MAX_UPLOAD, pages: 1, timeline: await storage.signGet(P.timeline), out: { seg: await storage.signPut(P.seg(a.idx, a.attempt)), web: await storage.signPut(P.web(a.idx, a.attempt)) } } };
    }
    // finish: the done try of every chunk, in order
    const segs = [], webs = [];
    for (const c of run.render.chunks) {
      const done = jobs.filter((j) => j.role === "chunk" && j.idx === c.index && j.state === "done").sort((x, y) => y.attempt - x.attempt)[0];
      if (!done) throw Object.assign(new Error(`chunk ${c.index} has no finished try`), { code: "BAD_JOB" });
      segs.push(await storage.signGet(P.seg(c.index, done.attempt)));
      webs.push(await storage.signGet(P.web(c.index, done.attempt)));
    }
    return { ...base, finish: { segs, webs, mix: await storage.signGet(P.mix), duration: run.render.duration, out: { final: await storage.signPut(P.final), web: await storage.signPut(P.webFinal), poster: await storage.signPut(P.poster) } } };
  }

  /** one new try of a piece: the row first (unique per attempt: only one caller sends it), then RunPod */
  async function dispatch(run, a, jobs) {
    const row = await db.insertJob({ run_id: run.id, role: a.role, idx: a.idx ?? 0, attempt: a.attempt, state: "sent", from_frame: a.from ?? null, to_frame: a.to ?? null, dispatched_at: iso() });
    if (!row) return true;
    try {
      if (!runpod?.configured) throw Object.assign(new Error("RunPod is not configured for Blocky Worlds"), { code: "NOT_CONFIGURED" });
      const input = await jobInput(run, row, a, jobs);
      const token = await tokenFor(secret, run.id);
      // a chunk's limit grows with its frames (render.js chunkRunSec; reconcile uses the same)
      const runLim = a.role === "chunk" && a.to > a.from ? chunkRunSec(a.to - a.from, cfg) : cfg.runSec[a.role];
      const res = await runpod.run({
        input: { job: input },
        webhook: `${callbackUrl}?src=runpod&run=${run.id}&job=${row.id}&token=${token}`,
        policy: { executionTimeout: (runLim + 60) * 1000, ttl: (cfg.queueSec + runLim + 120) * 1000 },
      });
      if (!res?.id) throw new Error(`RunPod gave no job id: ${JSON.stringify(res).slice(0, 200)}`);
      await db.updateJob(row.id, { provider_job_id: res.id, dispatched_at: iso() }, { live: true });
      const lim = input.prepare ? ` (director ${input.prepare.director.model ?? input.prepare.director.provider}, builder ${input.prepare.builder.provider} cap $${input.prepare.builder.budget.maxUsd}, library ${input.prepare.builder.library.length}, AI ceiling $${input.prepare.limits.aiMaxUsd})` : "";
      log(`run ${run.id}: ${a.role}${a.role === "chunk" ? ` ${a.idx}` : ""} try ${a.attempt} -> ${res.id}${lim}`);
      return true;
    } catch (e) {
      log(`run ${run.id}: sending ${a.role} ${a.idx ?? 0} try ${a.attempt} failed: ${e?.message ?? e}`);
      await db.updateJob(row.id, { state: "failed", finished_at: iso(), error_code: e?.code ?? "DISPATCH_FAILED", error_message: String(e?.message ?? e).slice(0, 1500) }, { live: true });
      return false;
    }
  }

  /** failed and refunded, once; every live job cancelled; the owner told */
  async function failRun(run, code, message) {
    const upd = await db.updateRun(run.id, { status: "failed", error_code: code, error_message: String(message ?? "").slice(0, 3000), finished_at: iso() }, { notTerminal: true });
    if (!upd) return false;
    let credits = 0;
    try { credits = await db.refund(run.id); } catch (e) { log(`run ${run.id}: REFUND FAILED, refund by hand: ${e?.message ?? e}`); await db.alert?.("blocky-worlds-refund-failed", "Blocky Worlds: a refund failed", `Run ${run.id}: ${e?.message ?? e}. Refund it by hand.`).catch?.(() => {}); }
    for (const j of await db.jobs(run.id)) {
      if (!LIVE.includes(j.state)) continue;
      await db.updateJob(j.id, { state: "failed", finished_at: iso(), error_code: "CANCELLED", error_message: `the run failed (${code})` }, { live: true });
      if (j.provider_job_id) await Promise.resolve(runpod?.cancel?.(j.provider_job_id)).catch(() => {});
    }
    log(`run ${run.id}: FAILED ${code} (${String(message ?? "").slice(0, 200)}), refunded ${credits} credits`);
    await Promise.resolve(db.alert?.(`blocky-worlds-${code}`, `Blocky Worlds: a video failed (${code})`, `Run ${run.id} (${run.title ?? ""}) failed: ${code} ${String(message ?? "").slice(0, 600)}. Refunded ${credits} credits.`)).catch(() => {});
    return true;
  }

  async function finishRun(run, output) {
    const P = paths(run);
    const files = { final: P.final, web: P.webFinal, poster: P.poster, durationSec: Number(output?.durationSec) || null, bytes: Number(output?.bytes) || null };
    const upd = await db.updateRun(run.id, { status: "done", pct: 100, files, finished_at: iso(), error_code: null, error_message: null, stage_at: iso() }, { notTerminal: true });
    if (!upd) return false;
    log(`run ${run.id}: DONE (${files.durationSec ?? "?"} s, ${((files.bytes ?? 0) / 1e6).toFixed(1)} MB)`);
    // the chunk files are joined into final/web now: removed (the voice, timeline and mix stay for the owner's Details)
    if (storage.remove) {
      const list = (await db.jobs(run.id)).filter((j) => j.role === "chunk").flatMap((j) => [P.seg(j.idx, j.attempt), P.web(j.idx, j.attempt)]);
      await Promise.resolve(storage.remove(list)).catch((e) => log(`run ${run.id}: chunk cleanup failed: ${e?.message ?? e}`));
    }
    return true;
  }

  /**
   * The plan passed its checks (the prepare job says "planned"): the server reads the timeline and its check report
   * from storage, checks the report again (never trusting a worker's word that the checks passed), splits the frames
   * into chunks and saves the split, once.
   */
  async function applyPlanned(run) {
    if (run.planned_at) return run;
    const P = paths(run);
    const [tlText, checkText] = await Promise.all([storage.readText(P.timeline), storage.readText(P.visualCheck)]);
    if (!tlText || !checkText) return run; // not uploaded yet: the next event or the sweeper comes back
    const check = JSON.parse(checkText);
    const misses = ["missing", "subjects", "production", "kit", "timeline"].reduce((n, k) => n + (check[k] ?? []).length, 0);
    if (misses || check.passed !== true) {
      await failRun(run, (check.missing ?? []).length ? "VISUAL_CHECK" : (check.production ?? []).length ? "PRODUCTION_CHECK" : (check.subjects ?? []).length ? "SUBJECT_CHECK" : (check.kit ?? []).length ? "KIT_MISSING" : "PLAN_FAILED", `the pre-render check report has ${misses} miss(es) or did not pass`);
      return null;
    }
    const tl = JSON.parse(tlText);
    // the chunk count from the load (chooseChunkCount): our videos still rendering + RunPod's health; the frame ranges
    // are fixed here once and saved, so every retry renders exactly the same frames
    let choice = null;
    if (queue && !chunks) {
      const frames0 = Math.min(Math.round(Number(tl.duration) * (tl.fps ?? cfg.fps)), limitFrames ?? Infinity);
      let activeRuns = 1, health = null;
      try { const s = await snapshot(); if (!s.runs.some((r) => r.id === run.id)) s.runs.push(run); activeRuns = Math.max(1, activeRenderRuns(s.runs, s.jobsByRun)); } catch { /* alone */ }
      try { health = typeof runpod?.health === "function" ? await runpod.health() : null; } catch { health = null; }
      choice = { ...chooseChunkCount({ frames: frames0, activeRuns, health, cfg }), activeRuns, health: health ? { inQueue: health.jobs?.inQueue ?? null, inProgress: health.jobs?.inProgress ?? null } : null };
    }
    const plan = chunkPlan(tl, { cfg, limitFrames, k: chunks, ...(choice ? { target: choice.k, bytesTarget: cfg.queueBytesTarget ?? cfg.chunkBytesTarget } : {}) });
    const frames = plan.at(-1).to, fps = tl.fps ?? cfg.fps;
    const p = production ?? PRODUCTION_DEFAULTS;
    const render = { frames, fps, duration: +(frames / fps).toFixed(3), fullDuration: tl.duration, shots: tl.shots?.length ?? 0, chunks: plan, production: { director: p.director, builder: p.builder, builderMaxUsd: p.builderMaxUsd, review: p.review ?? PRODUCTION_DEFAULTS.review, reviewMaxUsd: p.reviewMaxUsd ?? PRODUCTION_DEFAULTS.reviewMaxUsd }, ...(choice ? { queue: { k: choice.k, kMin: choice.kMin, kMax: choice.kMax, activeRuns: choice.activeRuns, health: choice.health, reason: choice.reason } } : {}) };
    const upd = await db.updateRun(run.id, { planned_at: iso(), render }, { notTerminal: true, plannedNull: true });
    if (upd) log(`run ${run.id}: planned, ${frames} frames in ${plan.length} chunks${choice ? ` (${choice.reason})` : ""}`);
    return upd ?? (await db.getRun(run.id));
  }

  /** look at the whole run and add what is missing (render.js reconcile) */
  async function reconcileRun(runId, depth = 0) {
    let run = await db.getRun(runId);
    if (!run) return null;
    let jobs = await db.jobs(runId);
    // a "planned" whose split was never saved (a lost callback, an unreadable timeline): applied now
    if (!run.planned_at && run.status !== "failed" && run.status !== "done" && jobs.some((j) => j.role === "prepare" && (j.stage === "mix" || j.state === "done"))) {
      const r = await applyPlanned(run);
      if (!r) return db.getRun(runId);
      run = r;
    }
    const r = reconcile(run, jobs, now(), cfg);
    for (const j of r.jobs) await db.updateJob(j.id, j.patch, { live: true });
    if (Object.keys(r.run).length) run = (await db.updateRun(runId, r.run, { notTerminal: true })) ?? run;
    let sendFailed = false;
    // the shared line: only as many pieces as there are free workers, the oldest run first (renderQueue.js admission);
    // the rest stays in our line (no row, no RunPod job) until a piece ends somewhere (pump) or the next sweep
    const wants = r.actions.filter((a) => a.type === "dispatch").length;
    let room = wants ? await roomFor(run, jobs.map((j) => { const p = r.jobs.find((x) => x.id === j.id); return p ? { ...j, ...p.patch } : j; })) : 0;
    if (wants > room) log(`run ${run.id}: ${wants - room} of ${wants} piece(s) wait in line for a free worker`);
    for (const a of r.actions) {
      if (a.type === "dispatch") { if (room <= 0) continue; room--; sendFailed = !(await dispatch(run, a, jobs)) || sendFailed; }
      else if (a.type === "cancel") await Promise.resolve(runpod?.cancel?.(a.providerJobId)).catch(() => {});
      else if (a.type === "fail") { await failRun(run, a.code, a.message); break; }
      else if (a.type === "done") await finishRun(run, a.output);
    }
    // a try that could not even be sent: decided again at once (a retry, or failed and refunded when RunPod is missing)
    if (sendFailed && depth < 3) return reconcileRun(runId, depth + 1);
    return db.getRun(runId);
  }

  /** one event on one job of a run, already authenticated */
  async function event(runId, jobId, ev) {
    const job = await db.getJob(jobId);
    if (!job || job.run_id !== runId) return { ok: false, ignored: "no such job" };
    // RunPod's webhook of a different RunPod job than this row's (a stale id): only its cost counts
    if (ev.event === "runpod" && job.provider_job_id && ev.providerJobId && ev.providerJobId !== job.provider_job_id) return { ok: true, ignored: "another RunPod job" };
    const run = await db.getRun(runId);
    if (!run) return { ok: false, ignored: "no such run" };
    // a thing the builder made for this video: into the shared library (idempotent by kind + name_key; bookkeeping,
    // never fails a run; the job and the run are untouched)
    if (ev.event === "built") {
      const row = assetRow(ev.asset, run.id);
      if (!row || typeof db.saveAsset !== "function") return { ok: true, ignored: row ? "no library" : "not an asset" };
      const saved = await Promise.resolve(db.saveAsset(row)).catch((e) => { log(`run ${run.id}: library save skipped: ${e?.message ?? e}`); return false; });
      if (saved) log(`run ${run.id}: built ${row.kind} "${row.name}" saved to the library`);
      return { ok: true, saved: Boolean(saved) };
    }
    const r = onJobEvent(job, ev, now(), cfg);
    if (r.ledger.length) {
      await db.ledger(run, r.ledger);
      const gpu = r.ledger.find((l) => l.provider === "runpod");
      if (gpu) await db.updateJob(job.id, { gpu_seconds: gpu.units.billedS }, {});
    }
    let changed = false;
    if (r.job) changed = Boolean(await db.updateJob(job.id, r.job, { live: true }));
    if (r.run) await db.updateRun(runId, r.run, { notTerminal: true });
    if (!changed) return { ok: true, ignored: r.job || ["done", "failed"].includes(job.state) ? "the job had already ended" : "nothing to change" };
    const after = await reconcileRun(runId);
    // a piece ended: its worker is free for the oldest run waiting in line (and a run that just ended frees all of its)
    if (r.job && ["done", "failed"].includes(r.job.state)) await pump(runId);
    else if (after && ["done", "failed"].includes(after.status)) await pump(runId);
    return { ok: true };
  }

  /**
   * An HTTP request to blocky-worlds-render, as { query: { src, run, job, token }, body }: a worker's event (the token in
   * the body) or RunPod's webhook (the token in the URL). -> { status, body }
   */
  async function handleCallback({ query = {}, body = {} }) {
    const fromRunPod = query.src === "runpod";
    const runId = String((fromRunPod ? query.run : body?.runId) ?? ""), jobId = String((fromRunPod ? query.job : body?.jobId) ?? "");
    const token = String((fromRunPod ? query.token : body?.token) ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(runId) || !/^[0-9a-f-]{36}$/i.test(jobId)) return { status: 400, body: { error: "bad ids" } };
    if (!secret || !sameToken(token, await tokenFor(secret, runId))) return { status: 403, body: { error: "refused" } };
    const ev = fromRunPod
      ? { event: "runpod", providerJobId: body?.id ?? null, status: body?.status, output: body?.output ?? null, error: body?.error ?? null, executionTime: body?.executionTime, delayTime: body?.delayTime }
      : { ...body, token: undefined, runId: undefined, jobId: undefined };
    if (!fromRunPod && !["progress", "voiced", "planned", "built", "done", "failed"].includes(ev.event)) return { status: 400, body: { error: "unknown event" } };
    return { status: 200, body: await event(runId, jobId, ev) };
  }

  /** the sweeper (pg_cron every minute): RunPod's view of every live job, then reconcile every running run */
  async function sweep() {
    // oldest first: the shared line gives free workers to the oldest run (renderQueue.js admission)
    const runs = [...(await db.liveRuns(50))].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    let looked = 0;
    for (const run of runs) {
      try {
        for (const j of await db.jobs(run.id)) {
          if (!LIVE.includes(j.state) || !j.provider_job_id || now() - Date.parse(j.dispatched_at) < 30000) continue;
          const st = await Promise.resolve(runpod?.status?.(j.provider_job_id)).catch(() => null);
          if (st?.status) await event(run.id, j.id, { event: "runpod", providerJobId: j.provider_job_id, status: st.status, output: st.output ?? null, error: st.error ?? null, executionTime: st.executionTime, delayTime: st.delayTime });
        }
        await reconcileRun(run.id);
        looked++;
      } catch (e) { log(`sweep ${run.id}: ${e?.message ?? e}`); }
    }
    // a finished job whose webhook never came: its GPU time read once from RunPod (the cost ledger stays whole)
    let costed = 0;
    for (const j of (await db.jobsMissingCost?.(30)) ?? []) {
      const st = await Promise.resolve(runpod?.status?.(j.provider_job_id)).catch(() => null);
      if (st && (st.executionTime || st.delayTime)) { await event(j.run_id, j.id, { event: "runpod", providerJobId: j.provider_job_id, status: st.status, output: st.output ?? null, executionTime: st.executionTime, delayTime: st.delayTime }); costed++; }
      else await db.updateJob(j.id, { gpu_seconds: 0 }, {});
    }
    return { looked, costed };
  }

  return { start: (runId) => reconcileRun(runId), reconcileRun, event, handleCallback, sweep, jobInput, pump, snapshot };
}
