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
import { sanitizeScript, STUDIO, STUDIO_STATUS, studioPct, stageForStep } from "../../../supabase/functions/_shared/blockyWorlds/studio.js";
import { makeStudioRuns } from "../../../supabase/functions/_shared/blockyWorlds/studioRuns.js";
import { paths } from "../../../supabase/functions/_shared/blockyWorlds/render.js";
import { decide } from "../../../supabase/functions/_shared/blockyWorlds/guard.js";
import { buildsForRun } from "./assets.mjs";

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
  const started = Date.parse(run.claimed_at ?? "") || now(), deadline = started + cfg.hardMin * 60000;
  const st = { stage: run.studio_stage ?? "voice", stopped: null, checks: 0, booked: {}, seq: 0, stages: [], lastStop: null, writing: Promise.resolve() };

  const stopNow = () => {
    if (control.stop && !st.stopped) st.stopped = control.stop;
    if (!st.stopped && now() > deadline) st.stopped = { code: "TIMEOUT", message: `not done ${cfg.hardMin} min after the claim` };
    if (st.stopped) throw new StudioStop(st.stopped.code, st.stopped.message);
  };
  // the stage on the run row (forward only); a row the worker no longer holds (failed by the sweeper) stops the run
  const write = (patch) => {
    st.writing = st.writing.then(async () => {
      try { if (!(await db.updateRun(run.id, { ...patch, heartbeat_at: iso() }, { notTerminal: true, worker: workerId }))) st.stopped ??= { code: "STOPPED", message: "the run was ended elsewhere (the sweeper, or a restart)" }; }
      catch (e) { log(`row update failed (the next one retries): ${e?.message ?? e}`); }
    });
    return st.writing;
  };
  const toStage = (stage) => {
    if (stage === st.stage && st.stages.length) return st.writing;
    st.stage = stage; st.stages.push(stage);
    log(`stage ${stage}`);
    return write({ studio_stage: stage, status: STUDIO_STATUS[stage], pct: studioPct(stage), stage_at: iso() });
  };
  // the Studio ledger every studio module gets: the same object (its caps, costs, log), with a check() that first stops
  // paid work once the run is over and moves the progress screen to the step being paid for
  const L0 = makeLedger(dir, { capUsd: cfg.runCapUsd, agentCapUsd: cfg.agentCapUsd });
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

  try {
    const script = sanitizeScript({ title: run.title, lines: run.lines });
    if (!script.lines.length) throw new StudioStop("BAD_JOB", "the run has no script lines");
    const card = run.card ?? {};
    stopNow();
    await gate("before the voice");
    await toStage("voice");
    const voice = await timed("voice", () => steps.voice({ script, dir, L, run }));
    await book();
    stopNow();
    await toStage("plan");
    const base = await timed("plan", () => steps.plan({ script, card, words: voice.words, lengthSec: run.length_sec, dir }));
    const mix = await timed("mix", () => steps.mix({ tl0: base.tl0, script, voiceWav: voice.wav, dir }));
    stopNow();
    await gate("before the director");
    await toStage("directing");
    // the things the kit lacks (the run's Studio builds) + any ready asset from the Studio library -> the director's note
    const builds = await (deps.buildsForRun ?? buildsForRun)(run, script).catch((e) => { log(`builds skipped: ${e?.message ?? e}`); return { builds: [], assets: {}, note: "" }; });
    if (builds.builds.length) log(`builds: ${builds.builds.map((b) => `${b.name} (${b.kind})`).join(", ")}; library hits: ${Object.keys(builds.assets).length}`);
    const directed = await timed("direct", () => steps.direct({ tl0: base.tl0, script, dir, L, briefNote: builds.note || null, builds: builds.builds, assets: builds.assets, log: (m) => { if (/stopping/.test(String(m))) st.lastStop = String(m); log(m); } }));
    await book();
    stopNow(); // the director stops quietly when a check refused its next call: the reason is here
    if (!directed?.plan?.shots?.length || !directed?.plan?.bible?.homes) {
      const why = st.lastStop ?? directed?.report?.finished?.reason ?? "no cut was written";
      throw Object.assign(new StudioStop(/credit balance|insufficient|quota/i.test(why) ? "PROVIDER_BALANCE" : "DIRECTOR_FAILED", `the director wrote no cut: ${why}`.slice(0, 600)));
    }
    await toStage("rendering");
    const fin = await timed("final", () => steps.final({ plan: directed.plan, tl0: base.tl0, script, dir, L, mix: mix?.file ?? path.join(dir, "mix.m4a") }));
    await book();
    stopNow();
    await toStage("finishing");
    const out = await timed("outputs", () => steps.outputs({ final: fin.final, dir, maxBytes: cfg.maxUploadBytes }));
    const P = paths(run);
    await timed("upload", async () => {
      await storage.upload(P.final, out.final, "video/mp4");
      await storage.upload(P.webFinal, out.web, "video/mp4");
      await storage.upload(P.poster, out.poster, "image/jpeg");
    });
    // the owner's Details: the director's summary (never the conversation, never the customer's script again)
    try { if (directed.report) await storage.upload(`${P.final.replace(/final\.mp4$/, "")}studio-report.json`, Buffer.from(JSON.stringify({ report: summary(directed.report), took, costs: L0.costs })), "application/json"); } catch (e) { log(`report upload skipped: ${e?.message ?? e}`); }
    stopNow();
    const files = { final: P.final, web: P.webFinal, poster: P.poster, durationSec: out.durationSec ?? null, bytes: out.bytes ?? null };
    await st.writing;
    const done = await db.updateRun(run.id, { status: "done", pct: 100, files, finished_at: iso(), stage_at: iso(), heartbeat_at: iso(), error_code: null, error_message: null, studio_stage: null }, { notTerminal: true, worker: workerId });
    if (!done) throw new StudioStop("STOPPED", "the run was ended elsewhere before it could be marked done");
    log(`DONE in ${Math.round((now() - t0) / 1000)} s, $${L0.total()} (${JSON.stringify(took)})`);
    return { ok: true, files, costUsd: L0.total(), stages: st.stages, took };
  } catch (e) {
    const code = failCode(e), message = String(e?.message ?? e).slice(0, 2000);
    await book().catch((x) => log(`cost booking failed: ${x?.message ?? x}`));
    await st.writing.catch(() => {});
    // failed + refunded once (a run the sweeper already failed: nothing happens here)
    const failed = await runs.failRun(run, code, message, { worker: workerId }).catch((x) => { log(`fail write failed (the sweeper refunds it): ${x?.message ?? x}`); return false; });
    log(`${failed ? "FAILED" : "stopped"} ${code}: ${message.slice(0, 300)}`);
    return { ok: false, code, message, costUsd: L0.total(), stages: st.stages, took };
  } finally {
    timers.clear(beat);
    if (!deps.keepWork) fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** the director report's small part (rounds, the best version, the finish reason) */
function summary(r) {
  return { model: r.model, rounds: r.rounds, calls: r.calls, checkerCalls: r.checkerCalls, sec: r.sec, finished: r.finished ?? null, best: r.best ?? null, history: (r.history ?? []).map((h) => ({ round: h.round, failingLines: h.failingLines, blocked: h.blocked, gate: h.gate, usd: h.usd, sec: h.sec })) };
}
