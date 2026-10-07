// CHAOS: Runware answers "serviceOverloaded" with retryAfter 60 ($0, 2026-10-08).
//
// 7 Oct 2026, 17:24:27 UTC: ten idea-thumbnail requests went out in the same
// second, Runware refused all ten (serviceOverloaded, "retryAfter": 60), none
// was tried again, the ten pictures stayed failed and the brand-new user left.
//
// Here the same batch runs against a stub that answers exactly that. The rules
// that decide are the real ones (_shared/modelOverload.ts, the sweeper's
// decideStuckJob, the scene ladder); the queue, the clock and the provider are
// simulated. In every case: no picture fails, nobody is charged before a
// picture exists, and the provider is not hammered while it is overloaded.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { BATCH_MAX_PER_MODEL, CLOSED, gate, HIGH_DEMAND_COPY, HIGH_DEMAND_ENDED_COPY, onOverload, onSuccess, overBatchCap, overloadedTooLong, OVERLOAD_BACKUP_MODEL, OVERLOAD_JITTER_S, OVERLOAD_SWITCH_AFTER_S, parseOverload, waitWithJitter, type Breaker } from "../../supabase/functions/_shared/modelOverload.ts";
import { decideStuckJob } from "../../supabase/functions/_shared/stuckJobs.ts";
import { classifyFailure, climbLadder, ladderOf } from "../../supabase/functions/_shared/stickman/sceneLadder.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
// What Runware sent (the user's example task 1774ec16-…): HTTP 500 on its side, 429 at our door.
const OVERLOADED = { errors: [{ code: "serviceOverloaded", message: "The service is temporarily unavailable due to high demand. Please try again later.", taskUUID: "1774ec16-565c-474b-9206-89cdc3c816fa", retryAfter: 60 }] };
const MODEL = "runware:400@6", BACKUP = "runware:400@4";

Deno.test("the provider's own retryAfter is read and waited, plus 0-15 s of jitter", () => {
  assertEquals(parseOverload(500, OVERLOADED), { overloaded: true, retryAfterS: 60 });
  assertEquals(parseOverload(429, OVERLOADED).retryAfterS, 60);
  assertEquals(parseOverload(429, { errors: [{ message: "The service is temporarily unavailable due to high demand." }] }), { overloaded: true, retryAfterS: 60 }, "no retryAfter given: a minute");
  assertEquals(parseOverload(503, "upstream busy", "30").retryAfterS, 30, "the Retry-After header counts too");
  assertEquals(parseOverload(429, { errors: [{ code: "serviceOverloaded", retryAfter: 9999 }] }).retryAfterS, 300, "never longer than 5 minutes at a time");
  // The scene worker's error text carries it too.
  assertEquals(parseOverload(0, `Error: runware 429: ${JSON.stringify(OVERLOADED.errors)}`).retryAfterS, 60);
  // Other errors are not overloads.
  for (const [s, p] of [[400, { errors: [{ code: "invalidPositivePrompt", message: "Invalid prompt" }] }], [500, { errors: [{ code: "internalError", message: "Internal error" }] }], [402, { errors: [{ message: "Insufficient credits" }] }]] as const) assertEquals(parseOverload(s, p).overloaded, false, JSON.stringify(p));
  assertEquals([waitWithJitter(60, () => 0), waitWithJitter(60, () => 1)], [60, 75]);
  assertEquals(OVERLOAD_JITTER_S, 15);
});

Deno.test("the breaker: one overload pauses every new request to that model, then it resumes 1 -> 2 -> normal", () => {
  const T = Date.parse("2026-10-07T17:24:27.000Z");
  let b: Breaker = onOverload(CLOSED, 60, T, () => 0);
  assertEquals(b, { until: "2026-10-07T17:25:27.000Z", since: "2026-10-07T17:24:27.000Z", ramp: 1 });
  // Nine more refusals in the same second don't stack the wait, and don't restart the clock of the run.
  for (let i = 0; i < 9; i++) b = onOverload(b, 60, T + 100, () => 0);
  assertEquals([b.until, b.since], ["2026-10-07T17:25:27.100Z", "2026-10-07T17:24:27.000Z"]);
  assertEquals(gate(b, T + 30_000, 0), { allow: false, waitS: 31, why: "paused" });
  // The pause is over: ONE request, the others wait for it.
  assertEquals(gate(b, T + 61_000, 0), { allow: true });
  assertEquals(gate(b, T + 61_000, 1), { allow: false, waitS: 5, why: "ramp" });
  // It came back: two at a time.
  b = onSuccess(b);
  assertEquals(b.ramp, 2);
  assertEquals([gate(b, T + 70_000, 1).allow, gate(b, T + 70_000, 2).allow], [true, false]);
  // And again: normal.
  b = onSuccess(b);
  assertEquals(b, CLOSED);
  assertEquals(gate(b, T + 80_000, 7), { allow: true });
});

// ---------------- the whole batch, simulated ----------------
type Job = { id: number; user: string; status: "queued" | "sent" | "done"; retryAt: number; claimedAt: number; doneAt: number; model: string; overloadWaits: number; failed: boolean; charged: number };
function runBatch(o: { jobs: number; overloadedUntilS: (model: string) => number; users?: number; price?: number; maxS?: number }) {
  const breakers: Record<string, Breaker> = { [MODEL]: CLOSED, [BACKUP]: CLOSED };
  const jobs: Job[] = Array.from({ length: o.jobs }, (_, i) => ({ id: i + 1, user: `u${i % (o.users ?? 1)}`, status: "queued", retryAt: 0, claimedAt: 0, doneAt: 0, model: MODEL, overloadWaits: 0, failed: false, charged: 0 }));
  const requests: { t: number; model: string; job: number; overloaded: boolean }[] = [];
  const alerts: string[] = [];
  let maxInFlight = 0;
  const T0 = Date.parse("2026-10-07T17:24:27.000Z");
  for (let t = 0; t <= (o.maxS ?? 1800); t++) {
    const nowMs = T0 + t * 1000;
    // pictures that came back
    for (const j of jobs) if (j.status === "sent" && j.doneAt <= t) { j.status = "done"; j.charged = o.price ?? 0; const b = breakers[j.model]; if (!(b.until && nowMs < Date.parse(b.until))) breakers[j.model] = onSuccess(b); }
    // the dispatcher (job-worker): every queued job whose wait is over
    for (const j of jobs.filter((x) => x.status === "queued" && x.retryAt <= t)) {
      let model = MODEL;
      const backup = OVERLOAD_BACKUP_MODEL[model];
      if (backup && overloadedTooLong(breakers[model], nowMs)) { if (!alerts.includes(model)) alerts.push(model); model = backup; }
      const inFlight = jobs.filter((x) => x.status === "sent");
      const g = gate(breakers[model], nowMs, inFlight.length);
      if (!g.allow) { j.retryAt = t + g.waitS; continue; }
      if (overBatchCap(inFlight.filter((x) => x.user === j.user).length)) { j.retryAt = t + 5; continue; }
      // sent
      const overloaded = t < o.overloadedUntilS(model);
      requests.push({ t, model, job: j.id, overloaded });
      if (overloaded) {
        const p = parseOverload(500, OVERLOADED);
        assert(p.overloaded);
        breakers[model] = onOverload(breakers[model], p.retryAfterS, nowMs, () => 0.5);
        j.overloadWaits++;
        j.retryAt = Math.ceil((Date.parse(breakers[model].until!) - T0) / 1000);
        // What the sweeper would do with it meanwhile: nothing (its wait is not over).
        assertEquals(decideStuckJob({ status: "queued", created_at: new Date(T0).toISOString(), claimed_at: null, retry_after: breakers[model].until }, nowMs + 1000, { paused: false, canRecheck: false }), "none");
      } else {
        j.status = "sent"; j.model = model; j.claimedAt = t; j.doneAt = t + 6;
        maxInFlight = Math.max(maxInFlight, jobs.filter((x) => x.status === "sent").length);
      }
    }
    if (jobs.every((j) => j.status === "done")) return { jobs, requests, alerts, maxInFlight, seconds: t };
  }
  return { jobs, requests, alerts, maxInFlight, seconds: -1 };
}

Deno.test("chaos: the 17:24 batch again, overloaded for 50 s -> two requests meet the overload (not ten), nothing more until retryAfter is over, all ten pictures arrive", () => {
  const r = runBatch({ jobs: 10, overloadedUntilS: () => 50 });
  assert(r.seconds > 0, "the batch finished");
  assertEquals(r.jobs.filter((j) => j.status === "done").length, 10, "ten of ten pictures (on 7 Oct: none)");
  assertEquals(r.jobs.filter((j) => j.failed).length, 0, "no picture failed");
  const refused = r.requests.filter((q) => q.overloaded);
  assert(refused.length <= BATCH_MAX_PER_MODEL, `${refused.length} requests met the overload (on 7 Oct: 10)`);
  // After the first refusal NOTHING is sent until retryAfter (60 s) + jitter is over.
  const firstRefusal = refused[0].t, next = r.requests.find((q) => q.t > firstRefusal)!;
  assert(next.t - firstRefusal >= 60, `the next request came ${next.t - firstRefusal} s later`);
  assert(next.t - firstRefusal <= 60 + OVERLOAD_JITTER_S + 1);
  // It resumes gradually: one request alone first, and never more than 2 at once for this batch.
  const resumed = r.requests.filter((q) => !q.overloaded);
  assert(resumed[1].t >= resumed[0].t + 6, "the second waits for the first to come back");
  assertEquals(r.maxInFlight, 2);
  assertEquals(r.alerts, [], "a minute of overload is nobody's email");
  assert(r.seconds < 180, `done in ${r.seconds} s`);
});

Deno.test("chaos: a batch of ten is never more than 2 requests at once to one model, overload or not", () => {
  const calm = runBatch({ jobs: 10, overloadedUntilS: () => 0 });
  assertEquals([calm.maxInFlight, calm.jobs.filter((j) => j.status === "done").length, calm.requests.length], [2, 10, 10]);
  assertEquals(BATCH_MAX_PER_MODEL, 2);
  // Two users' batches don't hold each other up: 2 each.
  assertEquals(runBatch({ jobs: 10, users: 2, overloadedUntilS: () => 0 }).maxInFlight, 4);
});

Deno.test("chaos: overload waits are not retries, and nothing is charged before the picture exists", () => {
  const r = runBatch({ jobs: 10, overloadedUntilS: () => 200, price: 1 });
  assertEquals(r.jobs.filter((j) => j.status === "done").length, 10);
  assert(r.jobs.some((j) => j.overloadWaits >= 2), "a job waited through several overload answers and was still not failed");
  assertEquals(r.jobs.reduce((a, j) => a + j.charged, 0), 10, "one credit per delivered picture, charged at delivery");
  // While it lasted: one probe per retryAfter, never a burst.
  const during = r.requests.filter((q) => q.overloaded);
  assert(during.length <= 5, `${during.length} requests in 200 s of overload`);
  for (let i = 2; i < during.length; i++) assert(during[i].t - during[i - 1].t >= 60);
  // The picture is charged only by the pipeline's completion rule, never at submit.
  assertMatch(read("supabase/migrations/20260802010000_generation_job_safety.sql"), /v_charged := public\.charge_job_credits\(p_job_id\);/);
});

Deno.test("chaos: the model stays overloaded for more than 5 minutes -> new requests go to its backup model, the owner is told once, every picture arrives", () => {
  const r = runBatch({ jobs: 10, overloadedUntilS: (m) => (m === MODEL ? 3600 : 0), maxS: 1200 });
  assertEquals(r.jobs.filter((j) => j.status === "done").length, 10);
  assertEquals(r.alerts, [MODEL], "one alert");
  const firstBackup = r.requests.find((q) => q.model === BACKUP)!;
  assert(firstBackup.t > OVERLOAD_SWITCH_AFTER_S && firstBackup.t < OVERLOAD_SWITCH_AFTER_S + 90, `switched after ${firstBackup.t} s`);
  assert(r.jobs.every((j) => j.model === BACKUP), "all ten were drawn by the backup model");
  assert(r.requests.filter((q) => q.model === MODEL && q.t > firstBackup.t).length === 0, "the overloaded model is left alone");
  assertEquals(OVERLOAD_BACKUP_MODEL[MODEL], BACKUP);
});

Deno.test("chaos: Long Form scenes — an overloaded model is a wait, not a step of the scene's ladder", async () => {
  const msg = `runware 429: ${JSON.stringify(OVERLOADED.errors)}`;
  assertEquals(classifyFailure(`Error: ${msg}`), "overload");
  assertEquals(classifyFailure("Error: runware 504: \"Gateway Timeout\""), "provider", "a timeout is still a normal retry");
  const state = ladderOf(null);
  let draws = 0;
  const out = await climbLadder<{ failed: boolean }>({
    state, canDefer: true, rand: () => 0, elapsedS: () => 8,
    draw: () => { draws++; return Promise.reject(new Error(msg)); },
    sleep: () => Promise.resolve(), renewLease: () => Promise.resolve(),
  });
  assertEquals(out, { kind: "overloaded", result: null, retryAfterS: 60 });
  assertEquals([draws, state.step, state.failures.length], [1, 0, 0], "one request, then it stops: no retry burst, no step used, no failure counted");
});

Deno.test("what the user reads while waiting, and the wiring", () => {
  assertEquals(HIGH_DEMAND_COPY, "High demand, continuing in a moment.");
  for (const s of [HIGH_DEMAND_COPY, HIGH_DEMAND_ENDED_COPY]) assert(!/\d{3}|runware|error|overload|fail/i.test(s), s);
  const img = read("supabase/functions/runware-image/index.ts");
  // An overloaded answer: the job waits (queued, a fresh task id), the breaker opens. No in-process retry burst.
  assertMatch(img, /if \(overload\.overloaded\) \{\s+await waitForOverloadedModel\(sb, jobId, airTag, overload\.retryAfterS, "create", createResult\.status\);\s+return;/);
  assertMatch(img, /status: "queued", progress: 0, retry_after: breaker\.until, provider_task_id: null, submission_state: "pending", lease_expires_at: null,/);
  assertMatch(img, /waiting: "high_demand", overload: \{ since, waits: Number\(settings\?\.overload\?\.waits \?\? 0\) \+ 1, retryAfterS \}/);
  assert(!/CREATE_RETRY|createTry/.test(img), "the fixed 5/20/60 s retry of 7 Oct is gone: it sent the rest of a batch into the overload");
  assertMatch(img, /await recordSuccess\(sb, toolKey\)/);
  const w = read("supabase/functions/job-worker/index.ts");
  assertMatch(w, /const g = gate\(breaker, nowMs, ahead\.length\);/);
  assertMatch(w, /const batchFull = overBatchCap\(ahead\.filter\(\(r: any\) => r\.user_id === job\.user_id\)\.length\);/);
  assertMatch(w, /if \(backup && \(overloadedTooLong\(breaker, nowMs\) \|\|/);
  assertEquals(w.match(/airTag: overloadAirTag \?\? provider\.airTag,/g)?.length, 3, "the backup model is used for the request; the tool and its price stay the user's");
  assertMatch(w, /return json\(req, \{ ok: true, status: "queued", highDemand: !g\.allow, message: !g\.allow \? HIGH_DEMAND_COPY :/);
  // A job that waited 30 minutes with no backup ends plainly and uncharged.
  assertMatch(w, /await failAndRefundJob\(sbAdmin, jobId, "PROVIDER_BUSY", HIGH_DEMAND_ENDED_COPY\);/);
  const sc = read("supabase/functions/render-long-form-scene/index.ts");
  assertMatch(sc, /const useBackupModel = overloadedTooLong\(breaker, Date\.now\(\)\);/);
  assertMatch(sc, /const opened = await recordOverload\(admin, cfg\.model, out\.retryAfterS,/);
  // The idea thumbnails panel says it.
  assertMatch(read("src/pages/workspace/long-form/DiscoveryPanels.jsx"), /High demand, continuing in a moment · /);
  assertMatch(read("src/pages/workspace/long-form/new.jsx"), /highDemand: row\.status === "queued" && row\.settings\?\.waiting === "high_demand"/);
});
