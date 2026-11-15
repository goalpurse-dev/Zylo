// Blocky Worlds STUDIO ENGINE: what happens to a Studio run outside the worker's happy path, through one small adapter,
// so the same code runs in the sweeper (blocky-worlds-render, Deno: renderSupabase.ts studioDb), in the worker (Node:
// scripts/blockyWorlds/studioWorker/rest.mjs) and in the free tests (memory tables).
//
//   db: liveStudioRuns(limit) -> rows (engine studio, not done / failed)
//       updateRun(id, patch, { notTerminal, worker }) -> row | null   (worker: only while that worker holds the run)
//       refund(runId) -> credits (blocky_worlds_refund: once per run, a second call returns 0)
//       alert?(key, subject, text)
//       doneUnnotified?(limit) -> rows (engine studio, done, notified_at null)   markNotified?(id) -> row | null
//
// THE RULE: a run that fails is failed ONCE (the row's status moves only from a live status) and refunded ONCE (the
// refund RPC marks the row first). Whoever fails it (the worker on an error, the sweeper on a dead worker) calls failRun.
import { notifyDue, studioSweepDecision, STUDIO } from "./studio.js";

export function makeStudioRuns({ db, now = () => Date.now(), log = (...a) => console.log("[blocky-worlds-studio]", ...a), cfg = STUDIO }) {
  const iso = () => new Date(now()).toISOString();

  /** failed and refunded, once; the owner told. worker: only while that worker still holds it (null = anyone) */
  async function failRun(run, code, message, { worker = null } = {}) {
    const upd = await db.updateRun(run.id, { status: "failed", error_code: code, error_message: String(message ?? "").slice(0, 3000), finished_at: iso(), studio_stage: null }, { notTerminal: true, ...(worker ? { worker } : {}) });
    if (!upd) return false;
    let credits = 0;
    try { credits = await db.refund(run.id); }
    catch (e) {
      log(`run ${run.id}: REFUND FAILED, refund by hand: ${e?.message ?? e}`);
      await Promise.resolve(db.alert?.("blocky-worlds-refund-failed", "Blocky Worlds: a refund failed", `Studio run ${run.id}: ${e?.message ?? e}. Refund it by hand.`)).catch(() => {});
    }
    log(`run ${run.id}: FAILED ${code} (${String(message ?? "").slice(0, 200)}), refunded ${credits} credits`);
    await Promise.resolve(db.alert?.(`blocky-worlds-studio-${code}`, `Blocky Worlds Studio: a video failed (${code})`, `Run ${run.id} (${run.title ?? ""}) failed: ${code} ${String(message ?? "").slice(0, 600)}. Refunded ${credits} credits.`)).catch(() => {});
    return true;
  }

  /** the sweeper's pass: every live Studio run whose worker died, or that waited / ran too long, is failed + refunded */
  async function sweep() {
    const runs = (await db.liveStudioRuns(50)) ?? [];
    let failed = 0;
    for (const run of runs) {
      try {
        const d = studioSweepDecision(run, now(), cfg);
        if (d && (await failRun(run, d.code, d.message))) failed++;
      } catch (e) { log(`sweep ${run.id}: ${e?.message ?? e}`); }
    }
    return { looked: runs.length, failed };
  }

  /**
   * "Your video is ready" for every done Studio run that has not had it: send(run) -> true (sent, or the gate said it
   * will never send it: marked) | false (try again on the next pass). Bookkeeping: an error never breaks the sweep.
   */
  async function notifyReady(send) {
    if (typeof db.doneUnnotified !== "function" || typeof send !== "function") return { sent: 0 };
    let sent = 0;
    for (const run of (await db.doneUnnotified(20)) ?? []) {
      if (!notifyDue(run, now())) continue;
      try { if (await send(run)) { await db.markNotified(run.id); sent++; } }
      catch (e) { log(`ready email ${run.id}: ${e?.message ?? e}`); }
    }
    return { sent };
  }

  return { failRun, sweep, notifyReady };
}
