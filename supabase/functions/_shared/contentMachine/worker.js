// Content Machine: the worker (content-machine-worker). Called every minute by the database's tick when
// there is work, and right away by "Make slideshows" / "Run now". Only with the worker secret; anything
// else gets the same plain 404 as the admin API.
//   1. Today's automatic run, once the local time is past run_time_local (the database's unique index on
//      the daily run makes a second one impossible, even if two ticks race).
//   2. Claims due jobs and runs them (pipeline.js), a few at a time.
import { NOT_FOUND_BODY } from "./adminGuard.js";
import { runJob } from "./pipeline.js";
import { localDay } from "./spendSummary.js";
import { localToUtc } from "./localTime.js";

export const LEASE_SECONDS = 420;   // longer than the slowest job (a written slideshow with web search)
export const JOBS_PER_TICK = 4;

export function localClock(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

export function sameSecret(a, b) {
  const x = String(a ?? ""), y = String(b ?? "");
  if (!x || !y || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** Creates today's automatic run if it is due. Returns the run or null. */
export async function maybeStartDailyRun(deps) {
  const s = await deps.db.settings();
  if (s.kill_switch || !s.daily_auto_run || s.slideshows_per_day < 1) return null;
  const now = deps.now();
  if (localClock(now, s.timezone) < s.run_time_local) return null;
  const day = localDay(now, s.timezone);
  if (await deps.db.dailyRunExists(day)) return null;
  let run;
  try {
    run = await deps.db.createRun({ run_date: day, kind: "daily", status: "pending", dry_run: deps.guard.envDryRun || Boolean(s.dry_run), input: { count: s.slideshows_per_day }, started_at: now.toISOString() });
  } catch (e) {
    if (/duplicate|unique/i.test(String(e?.message))) return null;   // another tick made it first
    throw e;
  }
  await deps.db.enqueue([{ run_id: run.id, stage: "plan" }]);
  return run;
}

/** Queues today's scout (Phase 3) once the run time has passed, when the daily scout is on. Returns true if queued. */
export async function maybeStartDailyScout(deps) {
  const s = await deps.db.settings();
  if (s.kill_switch || !s.daily_scout || !deps.db.scoutQueuedSince) return false;
  const now = deps.now();
  if (localClock(now, s.timezone) < s.run_time_local) return false;
  const dayStart = localToUtc(localDay(now, s.timezone), s.timezone).toISOString();
  if (await deps.db.scoutQueuedSince(dayStart)) return false;
  await deps.db.enqueue([{ stage: "scout", payload: { live: true, daily: true }, max_attempts: 1 }]);
  return true;
}

// One tick keeps claiming the next steps (each finished step queues the next) for up to this long, so a
// slideshow goes through its 6–7 steps in one or two ticks instead of one step a minute.
export const TICK_BUDGET_MS = 150_000;
export const MAX_ROUNDS = 12;

export async function tick(deps, { clock = () => Date.now() } = {}) {
  const daily = await maybeStartDailyRun(deps);
  const scouted = await maybeStartDailyScout(deps).catch((e) => { deps.log?.(`[content-machine-worker] scout: ${e?.message ?? e}`); return false; });
  const started = clock();
  const results = [];
  for (let round = 0; round < MAX_ROUNDS && clock() - started < TICK_BUDGET_MS; round++) {
    const s = await deps.db.settings();
    if (s.kill_switch) break;
    const jobs = await deps.db.claimJobs(JOBS_PER_TICK, LEASE_SECONDS);
    if (!jobs.length) break;
    results.push(...await Promise.all(jobs.map(async (job) => {
      try { return { id: job.id, stage: job.stage, result: await runJob(job, deps) }; }
      catch (e) { deps.log?.(`[content-machine-worker] ${job.stage} ${job.id}: ${e?.message ?? e}`); return { id: job.id, stage: job.stage, result: "error" }; }
    })));
  }
  return { daily: daily?.id ?? null, scout: scouted, jobs: results };
}

export function createWorkerHandler({ secret, deps, background = (p) => p }) {
  return async function handle(req) {
    const headers = { "content-type": "application/json" };
    if (req.method !== "POST" || !sameSecret(req.headers.get("x-cm-worker-secret"), secret)) {
      return new Response(JSON.stringify(NOT_FOUND_BODY), { status: 404, headers });
    }
    const work = tick(deps).then((r) => { deps.log?.(`[content-machine-worker] ${JSON.stringify(r)}`); return r; })
      .catch((e) => deps.log?.(`[content-machine-worker] tick failed: ${e?.message ?? e}`));
    background(work);
    return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 202, headers });
  };
}
