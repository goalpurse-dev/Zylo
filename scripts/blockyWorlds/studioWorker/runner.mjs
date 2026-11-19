// Blocky Worlds STUDIO WORKER: one claimed run, start to end. Every outside thing comes in through `deps`, so the free
// tests run the whole flow with fakes (tests/blockyWorldsStudio.test.mjs) and the worker runs it with the real steps
// (steps.mjs: the Studio v3 code in scripts/blockyWorlds/studio/, imported, never changed).
//
//   voice -> plan (+ the mix) -> directing / previews / checking / fixing (ONE Sonnet director, ONE fix round) ->
//   rendering (the final on RunPod, parallel) -> finishing (the web copy + poster, the upload) -> done
//
// THE LIMITS (studio.js STUDIO), checked BEFORE every paid step through the Studio ledger's check():
//   the run cap ($4: voice + model + RunPod) and the agent cap ($3: the director + the checker) per video;
//   the run's deadline (hardMin from the claim); a run the sweeper (or a restart) ended stops before its next paid step;
//   the paid switch and the template's emergency cap (guard.js decide on blocky_worlds_settings + blocky_worlds_guard),
//   read again before the voice and before the director.
// ANY failure: the run is failed ONCE and refunded ONCE (studioRuns.js failRun); what was spent is in the cost ledger.
// THE CUSTOMER'S TEXT is untrusted DATA: it is cleaned (studio.js sanitizeScript) and goes to the director only as the
// <story_script> data block of studio/prompt.mjs; the director's system prompt, its four tools and the shot-code
// whitelist validator (studio/validate.mjs) are fixed in code and nothing in a script can change them.
import fs from "node:fs";
import path from "node:path";
import { sanitizeScript, STUDIO, STUDIO_STATUS, studioPct, stageForStep, studioLimitMin } from "../../../supabase/functions/_shared/blockyWorlds/studio.js";
import { makeStudioRuns } from "../../../supabase/functions/_shared/blockyWorlds/studioRuns.js";
import { paths } from "../../../supabase/functions/_shared/blockyWorlds/render.js";
import { decide } from "../../../supabase/functions/_shared/blockyWorlds/guard.js";
import { buildsForRun } from "./assets.mjs";
import { packResume, readVoiceResult, resumePath, saveVoiceResult, unpackResume } from "./resume.mjs";

/** a stop the runner means (its code is the run's error_code) */
export class StudioStop extends Error {
  constructor(code, message) { super(message); this.name = "StudioStop"; this.code = code; }
}

/** the Studio ledger's cost keys -> the cost ledger's stage + provider */
export const COST_KEYS = Object.freeze({
  voice: { stage: "voice", provider: "elevenlabs", model: "eleven_v3" },
  agent: { stage: "director", provider: "anthropic", model: STUDIO.model },
  agent_check: { stage: "checker", provider: "anthropic", model: STUDIO.model },
  runpod_preview: { stage: "previews", provider: "runpod", model: STUDIO.endpoint },
  runpod_final: { stage: "final", provider: "runpod", model: STUDIO.endpoint },
});

/** an error -> the run's error_code (a provider out of money pauses new starts for 10 min: guard.js) */
export function failCode(e) {
  const code = String(e?.code ?? ""), msg = String(e?.message ?? e ?? "");
  if (e instanceof StudioStop) return code;
  if (/credit balance|insufficient_quota|quota_exceeded|payment required|\b402\b/i.test(msg)) return "PROVIDER_BALANCE";
  if (["CAP", "AGENT_CAP", "RESERVE"].includes(code)) return "CAP";
  // a model answer cut off by the output limit (after its continuations): the director failed; refunded once like any failure
  if (e?.truncated || code === "TRUNCATED" || /output truncated|cut off at the output limit/i.test(msg)) return "DIRECTOR_FAILED";
  if (code === "MODEL" || code === "REFUSED") return "DIRECTOR_FAILED";
  if (code === "PREVIEW") return "PREVIEW_FAILED";
  return "STUDIO_FAILED";
}

/**
 * deps: { db, steps, storage, makeLedger, workerId, workDir, now?, log?, control?, timers?, keepWork? }
 *   db       studioRuns.js's shape + gateState(userId) + ledger(run, rows)
 *   steps    { voice, plan, mix, direct, final, outputs } (steps.mjs)
 *   storage  { upload(path, file, contentType) }
 *   makeLedger(dir, { capUsd, agentCapUsd }) -> the Studio ledger (studio/ledger.mjs)
 *   control  { stop: null | { code, message } } (the worker sets it on SIGTERM)
 * -> { ok, code?, message?, files?, costUsd, stages }
 */
export async function runStudioRun(run, deps, cfg = STUDIO) {
  const { db, steps, storage, makeLedger, workerId, now = () => Date.now(), log = (m) => console.log(`[studio ${run.id.slice(0, 8)}] ${m}`), control = { stop: null }, timers = { set: setInterval, clear: clearInterval } } = deps;
  const runs = makeStudioRuns({ db, now, log });
  const iso = () => new Date(now()).toISOString();
  const dir = path.join(deps.workDir, run.id);
  fs.mkdirSync(dir, { recursive: true });
  // THE TIME LIMIT (owner 2026-11-16, studio.js studioLimitMin): the hard max from the claim, progress or not; past the
  // soft limit (scaled with the length) only when nothing moved for progressStaleMin. Never while it still moves.
  const started = Date.parse(run.claimed_at ?? "") || now(), deadline = started + (cfg.hardMin ?? 120) * 60000;
  const soft = started + studioLimitMin(run, cfg) * 60000;
  const st = { stage: run.studio_stage ?? "voice", stopped: null, checks: 0, booked: {}, seq: 0, stages: [], lastStop: null, writing: Promise.resolve(), movedAt: now(), videoFile: null, delivered: false };

  const timeUp = () => (now() > deadline ? `not done ${cfg.hardMin} min after the claim (the hard max)` : now() > soft && now() - st.movedAt > (cfg.progressStaleMin ?? 25) * 60000 ? `past its ${studioLimitMin(run, cfg)} min limit with no progress for ${Math.round((now() - st.movedAt) / 60000)} min` : null);
  const stopNow = () => {
    if (control.stop && !st.stopped) st.stopped = control.stop;
    if (!st.stopped) { const why = timeUp(); if (why) st.stopped = { code: "TIMEOUT", message: why }; }
    if (st.stopped) throw new StudioStop(st.stopped.code, st.stopped.message);
  };
  // THE LATE-VIDEO RESCUE (owner 2026-11-16: 2947e875's finish was done 1 min after the sweeper failed it, then the folder
  // was deleted): once the video exists, only a shutdown stops it; a time-out or a run ended elsewhere still gets its
  // video uploaded and marked Ready (refund kept)
  const stopShutdown = () => {
    if (control.stop) throw new StudioStop(control.stop.code, control.stop.message);
  };
  // the stage on the run row (forward only); a row the worker no longer holds (failed by the sweeper) stops the run
  const write = (patch) => {
    st.writing = st.writing.then(async () => {
      try { if (!(await db.updateRun(run.id, { ...patch, heartbeat_at: iso() }, { notTerminal: true, worker: workerId }))) st.stopped ??= { code: "STOPPED", message: "the run was ended elsewhere (the sweeper, or a restart)" }; }
      catch (e) { log(`row update failed (the next one retries): ${e?.message ?? e}`); }
    });
    return st.writing;
  };
  const ORDER = Object.keys(STUDIO_STATUS);
  const toStage = (stage) => {
    if (stage === st.stage && st.stages.length) return st.writing;
    st.movedAt = now();
    // after live progress (the Blender pipeline) the stage only moves forward (the runner's own "rendering" after the
    // pipeline's "finishing" is skipped)
    if (st.progressed && ORDER.indexOf(stage) < ORDER.indexOf(st.stage)) return st.writing;
    st.stage = stage; st.stages.push(stage);
    log(`stage ${stage}`);
    return write({ studio_stage: stage, status: STUDIO_STATUS[stage], pct: studioPct(stage), stage_at: iso() });
  };
  // LIVE PROGRESS from the Blender pipeline (blenderKit/progress.mjs): the stage, a percent that only goes up, the
  // ceiling the page may creep to and what is happening; kept in the run's `render` jsonb (unused by Studio runs: the
  // old pipeline's state), written at most every few seconds by the steps' timer
  const progress = (p) => {
    if (!p?.stage || !STUDIO_STATUS[p.stage]) return st.writing;
    const moved = p.stage !== st.stage;
    if (moved) { st.stage = p.stage; st.stages.push(p.stage); log(`stage ${p.stage} (${p.pct}%)`); }
    st.progressed = true;
    if (p.lineAt) st.movedAt = Math.max(st.movedAt, Number(p.lineAt));
    return write({ studio_stage: p.stage, status: STUDIO_STATUS[p.stage], pct: Math.floor(p.pct), ...(moved ? { stage_at: iso() } : {}), render: { progress: { stage: p.stage, pct: p.pct, ceil: p.ceil, detail: String(p.detail ?? "").slice(0, 120), at: iso(), ...(p.lineAt ? { lineAt: new Date(p.lineAt).toISOString() } : {}) } } });
  };
  // the Studio ledger every studio module gets: the same object (its caps, costs, log), with a check() that first stops
  // paid work once the run is over and moves the progress screen to the step being paid for
  // a run may carry a LOWER cap of its own (card.cap_usd, set only by our own tools: the Milo golden test, $3); never higher
  const capUsd = Math.min(cfg.runCapUsd, Number(run.card?.cap_usd) > 0 ? Number(run.card.cap_usd) : Infinity);
  const L0 = makeLedger(dir, { capUsd, agentCapUsd: Math.min(cfg.agentCapUsd, capUsd) });
  const L = Object.create(L0);
  L.check = (name, worstUsd, opts) => {
    stopNow();
    if (/^checker/.test(String(name))) st.checks++;
    const s = stageForStep(name, { round: Math.max(0, st.checks - (/^checker/.test(String(name)) ? 1 : 0)) });
    if (s) toStage(s);
    return L0.check(name, worstUsd, opts);
  };
  // what was spent since the last booking -> the cost ledger (one row per key and booking: a retried write adds nothing)
  const book = async () => {
    const rows = [];
    for (const [k, usd] of Object.entries(L0.costs ?? {})) {
      const meta = COST_KEYS[k] ?? { stage: k, provider: "other", model: null };
      const d = +(Number(usd) - (st.booked[k] ?? 0)).toFixed(6);
      if (d > 0) { rows.push({ ...meta, usd: d, units: {}, ref: `studio:${k}:${++st.seq}` }); st.booked[k] = Number(usd); }
    }
    if (rows.length) await db.ledger(run, rows);
  };
  // the paid switch + the emergency cap (the run itself is already counted in spent_24h from its charge)
  const gate = async (where) => {
    const g = await db.gateState(run.user_id);
    const d = decide(g?.settings, g?.counts, 0, { kind: "studio" });
    if (!d.ok) throw new StudioStop("PAUSED", `${where}: ${d.reason}`);
  };
  const beat = timers.set(() => { write({}).catch(() => {}); }, cfg.heartbeatSec * 1000);
  const t0 = now(), took = {};
  const timed = async (name, fn) => { const a = now(); try { return await fn(); } finally { took[name] = +((now() - a) / 1000).toFixed(1); } };

  // "TRY AGAIN" (owner 2026-11-18, resume.mjs): a retry run continues from the failed run's saved parts
  const resumeOf = run.resume_of ?? run.card?.resume_of ?? null;
  let resumed = false;
  try {
    const script = sanitizeScript({ title: run.title, lines: run.lines });
    if (!script.lines.length) throw new StudioStop("BAD_JOB", "the run has no script lines");
    const card = run.card ?? {};
    stopNow();
    if (resumeOf && storage?.download) {
      try {
        const buf = await storage.download(resumePath({ ...run, id: resumeOf }));
        if (buf?.length) { const files = (deps.unpackResume ?? unpackResume)(buf, dir); resumed = true; log(`resume: ${files.length} saved parts of run ${String(resumeOf).slice(0, 8)} restored`); }
        else log(`resume: run ${String(resumeOf).slice(0, 8)} has no saved parts: a fresh start`);
      } catch (e) { log(`resume skipped (a fresh start): ${e?.message ?? e}`); }
    }
    await gate("before the voice");
    await toStage("voice");
    // a restored take is reused (no second paid voice)
    const kept = resumed ? readVoiceResult(dir) : null;
    if (kept) log("resume: the voice take is reused");
    const voice = kept ?? await timed("voice", () => steps.voice({ script, dir, L, run }));
    if (!kept) saveVoiceResult(dir, voice);
    await book();
    stopNow();
    await toStage("plan");
    const base = await timed("plan", () => steps.plan({ script, card, words: voice.words, lengthSec: run.length_sec, dir }));
    const mix = await timed("mix", () => steps.mix({ tl0: base.tl0, script, voiceWav: voice.wav, dir }));
    stopNow();
    await gate("before the director");
    await toStage("directing");
    // the things the kit lacks (the run's Studio builds), each with its approved Studio-library entry when there is one:
    // the director's brief lists them as delimited data + each approved build's code (agent.mjs libraryBrief)
    const builds = await (deps.buildsForRun ?? buildsForRun)(run, script).catch((e) => { log(`builds skipped: ${e?.message ?? e}`); return { builds: [], assets: {} }; });
    if (builds.builds.length) log(`builds: ${builds.builds.map((b) => `${b.name} (${b.kind})`).join(", ")}; library hits: ${Object.keys(builds.assets).length}`);
    const directed = await timed("direct", () => steps.direct({ tl0: base.tl0, script, dir, L, card, builds: builds.builds, resume: resumed, onProgress: progress, log: (m) => { if (/stopping/.test(String(m))) st.lastStop = String(m); log(m); } }));
    await book();
    if (!directed?.plan?.shots?.length || !directed?.plan?.bible?.homes) {
      stopNow(); // the director stops quietly when a check refused its next call: the reason is here
      const why = st.lastStop ?? directed?.report?.finished?.reason ?? "no cut was written";
      throw Object.assign(new StudioStop(/credit balance|insufficient|quota/i.test(why) ? "PROVIDER_BALANCE" : "DIRECTOR_FAILED", `the director wrote no cut: ${why}`.slice(0, 600)));
    }
    // the Blender engine made the final inside `direct` (directed.blender): from here only a shutdown stops it (THE
    // LATE-VIDEO RESCUE); the three.js engine still checks the limits before paying for its final
    if (directed.blender) { st.videoFile = path.join(dir, "blender", "final.mp4"); stopShutdown(); } else stopNow();
    await toStage("rendering");
    const fin = await timed("final", () => steps.final({ plan: directed.plan, tl0: base.tl0, script, dir, L, mix: mix?.file ?? path.join(dir, "mix.m4a") }));
    st.videoFile = fin?.final ?? null;
    await book();
    stopShutdown();
    await toStage("finishing");
    const out = await timed("outputs", () => steps.outputs({ final: fin.final, dir, maxBytes: cfg.maxUploadBytes }));
    const P = paths(run);
    let noMusic = null;
    await timed("upload", async () => {
      await storage.upload(P.final, out.final, "video/mp4");
      await storage.upload(P.webFinal, out.web, "video/mp4");
      await storage.upload(P.poster, out.poster, "image/jpeg");
      // THE NO-MUSIC COPY (owner 2026-11-19): voice + SFX only; never fatal (the video is delivered without it)
      if (fin.noMusic && fs.existsSync(fin.noMusic) && fs.statSync(fin.noMusic).size <= cfg.maxUploadBytes) {
        try { await storage.upload(P.noMusic, fin.noMusic, "video/mp4"); noMusic = P.noMusic; } catch (e) { log(`no-music upload skipped: ${e?.message ?? e}`); }
      }
    });
    // the owner's Details: the director's summary (never the conversation, never the customer's script again)
    try { if (directed.report) await storage.upload(`${P.final.replace(/final\.mp4$/, "")}studio-report.json`, Buffer.from(JSON.stringify({ report: summary(directed.report), took, costs: L0.costs })), "application/json"); } catch (e) { log(`report upload skipped: ${e?.message ?? e}`); }
    stopShutdown();
    const files = { final: P.final, web: P.webFinal, poster: P.poster, ...(noMusic ? { noMusic } : {}), durationSec: out.durationSec ?? null, bytes: out.bytes ?? null };
    await st.writing;
    const done = await db.updateRun(run.id, { status: "done", pct: 100, files, finished_at: iso(), stage_at: iso(), heartbeat_at: iso(), error_code: null, error_message: null, studio_stage: null }, { notTerminal: true, worker: workerId });
    if (!done) {
      // THE LATE VIDEO: the run was failed (and refunded) elsewhere while the video was being made: it is still delivered
      // as Ready, the refund is kept (no re-charge), the note says so; the sweeper's ready email goes out as usual
      const prev = await db.getRun(run.id).catch(() => null);
      const note = `late video: finished after the run was stopped (${prev?.error_code ?? "ended elsewhere"}); the refund of ${prev?.credits_refunded ?? 0} credits is kept`;
      const rescued = db.rescueRun ? await db.rescueRun(run.id, { status: "done", pct: 100, files, finished_at: iso(), stage_at: iso(), heartbeat_at: iso(), error_code: null, error_message: note.slice(0, 500), studio_stage: null, notified_at: null, render: { late: { at: iso(), after: prev?.error_code ?? null, refundKept: prev?.credits_refunded ?? 0 } } }, { worker: workerId }).catch((e) => { log(`late rescue failed: ${e?.message ?? e}`); return null; }) : null;
      if (!rescued) throw new StudioStop("STOPPED", "the run was ended elsewhere before it could be marked done");
      st.delivered = true;
      log(`LATE READY: ${note}`);
      return { ok: true, late: true, files, costUsd: L0.total(), stages: st.stages, took };
    }
    st.delivered = true;
    log(`DONE in ${Math.round((now() - t0) / 1000)} s, $${L0.total()} (${JSON.stringify(took)})`);
    return { ok: true, files, costUsd: L0.total(), stages: st.stages, took };
  } catch (e) {
    const code = failCode(e), message = String(e?.message ?? e).slice(0, 2000);
    await book().catch((x) => log(`cost booking failed: ${x?.message ?? x}`));
    await st.writing.catch(() => {});
    // failed + refunded once (a run the sweeper already failed: nothing happens here)
    const failed = await runs.failRun(run, code, message, { worker: workerId }).catch((x) => { log(`fail write failed (the sweeper refunds it): ${x?.message ?? x}`); return false; });
    // the parts a "Try again" continues from (never on a shutdown: the run is picked up again as it is)
    if (!st.videoFile && storage?.upload && !control.stop) {
      try {
        const buf = (deps.packResume ?? packResume)(dir, log);
        if (buf) { await storage.upload(resumePath(run), buf, "application/gzip"); log(`saved the parts for Try again (${Math.round(buf.length / 1024)} KB)`); }
      } catch (x) { log(`saving the parts for Try again failed (a retry starts fresh): ${x?.message ?? x}`); }
    }
    log(`${failed ? "FAILED" : "stopped"} ${code}: ${message.slice(0, 300)}`);
    return { ok: false, code, message, costUsd: L0.total(), stages: st.stages, took };
  } finally {
    timers.clear(beat);
    // the folder goes only once the video is delivered (uploaded + Ready), or when no video was made
    const keep = !st.delivered && Boolean(st.videoFile) && fs.existsSync(st.videoFile);
    if (st.delivered && steps.cleanup) await steps.cleanup({ dir, log }).catch((e) => log(`cleanup skipped: ${e?.message ?? e}`));
    if (!deps.keepWork && !keep) fs.rmSync(dir, { recursive: true, force: true });
    else if (keep) log(`KEPT ${dir}: a made video was not delivered (${st.videoFile})`);
  }
}

/** the director report's small part (rounds, the best version, the finish reason) */
export function summary(r) {
  // the Blender report adds the gate with the FULL weak-shot list (owner 2026-11-18) + the shots still failing
  return { ...(r.gate !== undefined ? { title: r.title ?? null, shots: r.shots ?? null, total: r.total ?? null, gate: r.gate, weakShots: r.gate?.list ?? [], stillFailing: r.stillFailing ?? {} } : {}), model: r.model, rounds: r.rounds, calls: r.calls, checkerCalls: r.checkerCalls, sec: r.sec, finished: r.finished ?? null, best: r.best ?? null, history: (r.history ?? []).map((h) => ({ round: h.round, failingLines: h.failingLines, blocked: h.blocked, gate: h.gate, usd: h.usd, sec: h.sec })) };
}
