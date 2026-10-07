// Every other tool: charged only for what was delivered, never stuck, never a raw error (2026-10-07).
//
// What the audit of 4-7 Oct and the survey after it found on the shared `jobs`
// pipeline (image and video generators, Seedance, the template tools):
//   - a video is charged at launch; when its worker's polling window ended the
//     job was only flagged, and NOTHING on the server ever came back to it:
//     three Seedance clips (90 credits) and ten older jobs (441 credits) stayed
//     charged and "processing" for ever;
//   - an image for a user with no credits was drawn (we paid), the charge then
//     failed and the job hung at 98 % for ever (456 jobs since August);
//   - a temporary provider error at launch failed the job at once, and a failed
//     status read refunded a video that was still being made;
//   - jobs.error, shown to the user as it is, carried "Runware launch failed (504)".
// CHAOS for these tools is at the end: a stuck job, with the credits counted.
// All $0: the real rules, a simulated clock, source checks of the wiring.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { decideStuckJob, failureRate, PAUSED_COPY, RECHECK_AFTER_S, REDISPATCH_QUEUED_AFTER_S, REFUND_AFTER_S, STUCK_COPY, SWEEP_CREATED_AFTER_DEFAULT, type JobLite } from "../../supabase/functions/_shared/stuckJobs.ts";
import { GENERIC_FAILURE, OUT_OF_CREDITS, plainJobError } from "../../supabase/functions/_shared/jobErrors.ts";
import { SCENE_CONCURRENCY, SCENES_TOTAL_MAX } from "../../supabase/functions/_shared/stickman/scenes.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const T0 = Date.parse("2026-10-07T12:00:00.000Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
const job = (o: Partial<JobLite> = {}): JobLite => ({ status: "processing", created_at: at(0), claimed_at: at(5), retry_after: null, ...o });
const decide = (j: Partial<JobLite>, nowS: number, o: Partial<{ paused: boolean; canRecheck: boolean }> = {}) => decideStuckJob(job(j), T0 + nowS * 1000, { paused: false, canRecheck: true, ...o });

Deno.test("a job that stopped moving: asked again at 15 minutes, refunded at 30 (it used to stay charged for ever)", () => {
  assertEquals([RECHECK_AFTER_S, REFUND_AFTER_S], [900, 1800]);
  assertEquals(decide({}, 600), "none", "its own worker still has time");
  assertEquals(decide({}, 905 + 5), "recheck");
  assertEquals(decide({}, 1700), "recheck");
  assertEquals(decide({}, 1810), "recheck_then_refund", "one last look, then the refund");
  // A job the provider can't be asked about (an image; a video with no provider task yet).
  assertEquals(decide({}, 1000, { canRecheck: false }), "none");
  assertEquals(decide({}, 1810, { canRecheck: false }), "refund");
  assertEquals(decide({ status: "running", claimed_at: null }, 1810, { canRecheck: false }), "refund");
  // Finished jobs are never touched.
  for (const status of ["succeeded", "failed", "canceled"]) assertEquals(decide({ status }, 99999), "none");
});

Deno.test("a queued job nobody is working on is dispatched again; while the provider is paused it WAITS and its clock does not run", () => {
  const queued = { status: "queued", claimed_at: null };
  assertEquals(decide(queued, REDISPATCH_QUEUED_AFTER_S - 10), "none");
  assertEquals(decide(queued, REDISPATCH_QUEUED_AFTER_S + 10), "redispatch");
  assertEquals(decide(queued, 1810), "refund", "30 minutes in the queue: ended, anything charged goes back");
  // Paused (balance guard): held, however old.
  assertEquals(decide(queued, 5000, { paused: true }), "hold");
  // The sweeper stamps retry_after on every held job each minute, so after a 2-hour pause the job is young again.
  assertEquals(decide({ ...queued, retry_after: at(7200) }, 7200 + 60), "none");
  assertEquals(decide({ ...queued, retry_after: at(7200) }, 7200 + 130), "redispatch");
  // A job backed off into the future is left alone.
  assertEquals(decide({ ...queued, retry_after: at(400) }, 300), "none");
});

Deno.test("what the user reads when a job fails is plain words, never the provider's error", () => {
  for (const raw of ["Runware launch failed (504)", "Runware Seedance launch failed (402)", "poll failed (500): {\"errors\":[...]}", "PROVIDER_SUBMISSION_REJECTED", "TimeoutError: The signal has been aborted", "internalError", "fetch failed https://api.runware.ai/v1", "", "x".repeat(300)]) {
    assertEquals(plainJobError("PROVIDER_SUBMISSION_REJECTED", raw), GENERIC_FAILURE, raw);
  }
  assertEquals(plainJobError("INSUFFICIENT_CREDITS", "INSUFFICIENT_CREDITS"), OUT_OF_CREDITS);
  // Words written for the user are kept as they are.
  const safety = "The provider couldn't generate this request because of its safety rules. Try changing the prompt or image.";
  assertEquals(plainJobError("PROVIDER_SAFETY_REJECTION", safety), safety);
  assertEquals(plainJobError("STUCK_TIMEOUT", STUCK_COPY), STUCK_COPY);
  for (const s of [GENERIC_FAILURE, OUT_OF_CREDITS, STUCK_COPY, PAUSED_COPY]) assert(!/\d{3}|runware|error|fail/i.test(s), s);
});

Deno.test("the failure rate: an email above 20 % in 10 minutes, only when there is enough work to mean something", () => {
  assertEquals(failureRate({ ok: 8, failed: 3 }).alert, true);
  assertEquals(failureRate({ ok: 8, failed: 2 }).alert, false, "exactly 20 % is not above it");
  assertEquals(failureRate({ ok: 1, failed: 4 }).alert, false, "five jobs are not a rate");
  assertEquals(failureRate({ ok: 0, failed: 0 }), { alert: false, share: 0, total: 0 });
});

Deno.test("wiring: the sweeper runs every minute, only on new work, and reports what it refunded", () => {
  const sw = read("supabase/functions/generation-sweeper/index.ts");
  assertMatch(sw, /const action = decideStuckJob\(j, nowMs, \{ paused: paused && RUNWARE_FNS\.has\(String\(fn\)\), canRecheck \}\);/);
  assertMatch(sw, /const canRecheck = fn === "\/functions\/v1\/runware-video" && !!j\.provider_task_id;/);
  // The refund is the pipeline's own atomic rule (it refunds once, only what was charged).
  assertMatch(sw, /admin\.rpc\("fail_and_refund_generation_job", \{ p_job_id: j\.id, p_error_code: STUCK_ERROR_CODE, p_error: STUCK_COPY, p_provider_task_id: null \}\)/);
  assertMatch(sw, /if \(after && \["queued", "running", "processing"\]\.includes\(after\.status\)\) await refund\(/, "refunded only if the last look did not finish it");
  // Old work is never touched as a side effect of turning this on.
  assertEquals(SWEEP_CREATED_AFTER_DEFAULT, "2026-10-07T00:00:00.000Z");
  assertEquals(sw.match(/\.gte\("created_at", CREATED_AFTER\)/g)?.length, 2);
  // A cancelled job that was charged is refunded; the owner hears of stuck jobs and of a high failure rate.
  assertMatch(sw, /admin\.rpc\("refund_job_credits", \{ p_job_id: j\.id \}\)/);
  assertMatch(sw, /await alertOnce\(admin, "stuck_jobs", 900,/);
  assertMatch(sw, /await alertOnce\(admin, `failure_rate:\$\{name\}`, 1800,/);
  // A re-check is a status read on the video function, never a new paid submission.
  assertMatch(sw, /post\("runware-video", \{ jobId: j\.id, action: "reconcile",/);
  // It is started by the per-minute sweep that already exists (no cron of its own).
  assertMatch(read("supabase/functions/advance-long-form-autopilot/index.ts"), /background\(fetch\(fn\("generation-sweeper"\)/);
  // One alert per period: the log is the memory.
  assertMatch(read("supabase/functions/_shared/adminAlert.ts"), /\.eq\("source", "ops-alert"\)\.eq\("event", key\)\.gte\("created_at", since\)\.limit\(1\)/);
});

Deno.test("wiring: no credits is said before we pay the provider; a paused provider means the job waits; a finished image never hangs at 98 %", () => {
  const w = read("supabase/functions/job-worker/index.ts");
  assertMatch(w, /if \(job\.type === "image" && !isReservationJob && Number\(job\.charge_credits \?\? 0\) > 0\) \{[\s\S]{0,400}await failAndRefundJob\(sbAdmin, jobId, "INSUFFICIENT_CREDITS", OUT_OF_CREDITS\);/);
  assertMatch(w, /if \(guard\.paused\) \{[\s\S]{0,300}return json\(req, \{ ok: true, status: "queued", paused: true, message: PAUSED_COPY \}, 202\);/);
  assertMatch(w, /p_error: plainJobError\(code, message\)/);
  const img = read("supabase/functions/runware-image/index.ts");
  assertMatch(img, /if \(completed !== true\) \{[\s\S]{0,500}p_error_code: "INSUFFICIENT_CREDITS"/);
});

Deno.test("wiring: a temporary launch error is retried (5 s, 20 s, 60 s); a failed status read is not a failed video", () => {
  const v = read("supabase/functions/runware-video/index.ts");
  assertMatch(v, /const TRANSIENT_LAUNCH = \/\\\(\(\?:429\|500\|502\|503\|504\)\\\)\/;/);
  assertMatch(v, /const TRANSIENT_LAUNCH_WAITS_MS = \[5_000, 20_000, 60_000\];/);
  assertMatch(v, /attempt--; \/\/ not one of the 402 attempts/);
  assertMatch(v, /const shown = plainJobError\(patch\.error_code, raw\);/);
  assertMatch(v, /await markOutOfBalance\(sb as any, `video launch refused:/, "the first balance refusal pauses Runware work and emails the owner");
  const rw = read("supabase/functions/runware-video/runware.ts");
  assertMatch(rw, /if \(res\.status === 429 \|\| res\.status >= 500\) throw new Error\(`poll unavailable \(\$\{res\.status\}\)`\);/);
});

Deno.test("wiring: thumbnails are swept without the user; scene concurrency is capped per video and in total (config)", () => {
  const th = read("supabase/functions/long-form-thumbnails/index.ts");
  assertMatch(th, /if \(action === "sweep_all"\) \{/);
  assertMatch(th, /\.update\(\{ credits_charged: 0 \}\)\.eq\("id", r\.id\)\.eq\("credits_charged", r\.credits_charged\)\.select\("id"\)/, "claim first: refunded once");
  assertEquals([SCENE_CONCURRENCY, SCENES_TOTAL_MAX], [6, 30]);
  const sc = read("supabase/functions/_shared/stickman/scenes.ts");
  assertMatch(sc, /envInt\("LONG_FORM_SCENES_PER_VIDEO", 6\)/);
  assertMatch(sc, /envInt\("LONG_FORM_SCENES_TOTAL", 30\)/);
  assertMatch(read("supabase/functions/render-long-form-scene/index.ts"), /if \(\(drawingNow \?\? 0\) >= SCENES_TOTAL_MAX\) return ok\(req, \{ ok: true, claimed: false, busy: true \}\);/);
  // The shared pipeline's caps were already config (8 images / 8 videos / 15 in total).
  const w = read("supabase/functions/job-worker/index.ts");
  for (const name of ["RUNWARE_IMAGE_MAX_CONCURRENT", "RUNWARE_VIDEO_MAX_CONCURRENT", "RUNWARE_TOTAL_MAX_CONCURRENT"]) assert(w.includes(name), name);
});

// ---------------- CHAOS: a stuck job, with the credits counted ----------------
// The pipeline's own money rules (charge once at launch, refund once, a refunded job can never
// be completed), as the SQL has them, on one in-memory job; the sweeper's real rule drives it.
function world(price: number, balance: number) {
  const j: any = { status: "queued", created_at: at(0), claimed_at: null, retry_after: null, charged: false, refunded: false, delivered: false, late: 0 };
  const led: string[] = [];
  return {
    j, led, get balance() { return balance; },
    launch(nowS: number) { j.status = "processing"; j.claimed_at = at(nowS); if (!j.charged && !j.refunded) { balance -= price; j.charged = true; led.push("charge"); } },
    complete() { if (!["running", "processing"].includes(j.status) || j.refunded) { j.late++; return false; } j.status = "succeeded"; j.delivered = true; return true; },
    failAndRefund() { if (!["queued", "running", "processing"].includes(j.status)) return false; if (j.charged && !j.refunded) { balance += price; j.charged = false; j.refunded = true; led.push("refund"); } j.status = "failed"; return true; },
  };
}
// One sweeper minute: what the rule says, done to the job. `provider` answers a re-check.
function sweep(w: ReturnType<typeof world>, nowS: number, provider: "running" | "done" | "failed", canRecheck = true) {
  const a = decideStuckJob(w.j, T0 + nowS * 1000, { paused: false, canRecheck });
  if (a === "redispatch") w.launch(nowS);
  if (a === "recheck" || a === "recheck_then_refund") { if (provider === "done") w.complete(); else if (provider === "failed") w.failAndRefund(); }
  if (a === "refund" || (a === "recheck_then_refund" && ["queued", "running", "processing"].includes(w.j.status))) w.failAndRefund();
  return a;
}

Deno.test("chaos: a video the provider never finishes -> refunded at 30 minutes, once; a late delivery changes nothing", () => {
  const w = world(27, 100);
  w.launch(5);
  assertEquals(w.balance, 73, "charged at launch");
  for (let s = 60; s <= 2400; s += 60) sweep(w, s, "running");
  assertEquals([w.j.status, w.balance, w.led], ["failed", 100, ["charge", "refund"]]);
  for (let s = 2460; s <= 4000; s += 60) sweep(w, s, "done");
  assertEquals(w.complete(), false, "the provider delivers late: rejected");
  assertEquals([w.balance, w.j.delivered, w.led.length], [100, false, 2], "never charged again, never refunded twice");
});

Deno.test("chaos: the worker died but the provider DID finish -> the 15-minute look delivers it; the user pays once", () => {
  const w = world(27, 100);
  w.launch(5);
  for (let s = 60; s <= 2400; s += 60) sweep(w, s, s < 900 ? "running" : "done");
  assertEquals([w.j.status, w.j.delivered, w.balance, w.led], ["succeeded", true, 73, ["charge"]]);
});

Deno.test("chaos: a job lost before it was ever picked up -> dispatched again by the sweeper, then finishes", () => {
  const w = world(5, 20);
  assertEquals(sweep(w, 60, "running"), "none");
  assertEquals(sweep(w, 130, "running"), "redispatch");
  assertEquals(w.j.status, "processing");
  w.complete();
  assertEquals([w.j.status, w.balance, w.led], ["succeeded", 15, ["charge"]]);
});

Deno.test("chaos: a stuck image (never charged) is ended at 30 minutes with nothing to refund", () => {
  const w = world(1, 3);
  w.j.status = "processing"; w.j.claimed_at = at(5); // images are charged only when finished
  for (let s = 60; s <= 2400; s += 60) sweep(w, s, "running", false);
  assertEquals([w.j.status, w.balance, w.led], ["failed", 3, []]);
});

Deno.test("the money rules those tests assume are the database's own", () => {
  const sql = read("supabase/migrations/20260802010000_generation_job_safety.sql");
  // A refunded or finished job can never be completed (a late result is recorded and dropped).
  assertMatch(sql, /IF v_job\.status NOT IN \('running','processing'\) OR v_job\.credits_refunded_at IS NOT NULL OR/);
  assertMatch(sql, /'completion_rejected'/);
  // The refund: only from an unfinished job, only if charged and not yet refunded, with a unique ledger line.
  assertMatch(sql, /IF v_job\.status NOT IN \('queued','running','processing'\) OR/);
  assertMatch(sql, /IF \(v_job\.credits_charged_at IS NOT NULL OR COALESCE\(v_job\.charged,false\)\) AND v_job\.credits_refunded_at IS NULL THEN/);
  assertMatch(sql, /p_job_id::text \|\| ':refund'\) ON CONFLICT DO NOTHING;/);
  // 2AM: a reservation nobody settled is settled by the server (applied 7 Oct 2026).
  const twoAm = read("supabase/migrations/20261027110000_two_am_stale_reservations.sql");
  assertMatch(twoAm, /if v_open > 0 then continue; end if;/);
  assertMatch(twoAm, /v_refund := public\.two_am_refund_for\(g\.reserved_credits, v_completed\);/);
  assertMatch(twoAm, /and created_at >= p_created_after/);
});

Deno.test("an image request the provider did not take (429 / 503 'high demand') is tried again; anything else is still never resubmitted", () => {
  // 7 Oct 2026, 17:24 UTC: Runware answered ten thumbnail requests with 429 and all ten failed at once.
  const img = read("supabase/functions/runware-image/index.ts");
  assertMatch(img, /const CREATE_RETRY_STATUS = new Set\(\[429, 503\]\);/);
  assertMatch(img, /const CREATE_RETRY_WAITS_MS = \[5_000, 20_000, 60_000\];/);
  assertMatch(img, /if \(createResult && !createResult\.ok && CREATE_RETRY_STATUS\.has\(createResult\.status\) && createTry < CREATE_RETRY_WAITS_MS\.length\) \{/);
  // A lost response (no answer at all) falls through to polling the reserved task id, as before.
  assertMatch(img, /"task_submit_response_lost"/);
  assert(!/CREATE_RETRY_STATUS = new Set\(\[[^\]]*(500|502|504)/.test(img), "an answer that may mean 'taken' is not retried");
});

// ---------------- Part 4: never run dry, know first ----------------
import { guardDecision, reserveFor, PROVIDER_USD_PER_CREDIT } from "../../supabase/functions/_shared/runwareBalance.ts";

Deno.test("the balance guard counts the work in flight: 6-7 Oct's $5.54 with requests in progress is a PAUSE, not 'above the threshold'", () => {
  const now = "2026-10-06T23:01:00.000Z";
  const row = { threshold_usd: 15, balance_usd: 40, checked_at: null, paused: false, paused_since: null, alerted_at: null };
  // $40 in the account, nothing running: fine.
  assertEquals(guardDecision(row, 40, now, 0).paused, false);
  // $40 in the account, $30 of it already needed by clips being made: only $10 is free -> pause, alert once.
  const reserve = reserveFor({ jobCredits: 2400, fruitCredits: 400, scenes: 6 });
  assert(reserve > 29 && reserve < 31, String(reserve));
  assertEquals(guardDecision(row, 40, now, reserve), { paused: true, pausedSince: now, alert: true, resumed: false });
  // The night of the outage, with the old $3 threshold: $5.54 read as fine. Counting what was in flight it is not.
  assertEquals(guardDecision({ ...row, threshold_usd: 3 }, 5.54, now, 0).paused, false);
  assertEquals(guardDecision({ ...row, threshold_usd: 3 }, 5.54, now, 3).paused, true);
  // A balance that can't be read never pauses or resumes anything.
  assertEquals(guardDecision({ ...row, paused: true, paused_since: "x" }, null, now, 99).paused, true);
  assertEquals(PROVIDER_USD_PER_CREDIT, 0.0107);
  const g = read("supabase/functions/_shared/runwareBalance.ts");
  assertMatch(g, /const d = guardDecision\(row as GuardRow, balance, now, reserve\.usd\);/);
});

Deno.test("the admin page's data: the owner only, read-only, never an email or a prompt", () => {
  const o = read("supabase/functions/ops-status/index.ts");
  assertMatch(o, /if \(!adminEmails\(\)\.includes\(String\(user\.email \?\? ""\)\.toLowerCase\(\)\)\) return err\(req, "Not allowed", 403\);/);
  assertMatch(o, /\[Deno\.env\.get\("ALERT_EMAIL"\), Deno\.env\.get\("CONTACT_TO_EMAIL"\), \.\.\.\(Deno\.env\.get\("ADMIN_EMAILS"\) \?\? ""\)\.split\(","\)\]/);
  assert(!/\.(insert|update|delete|upsert)\(|\.rpc\(/.test(o), "it changes nothing");
  assert(!/select\("[^"]*\b(email|prompt|input|settings)\b/.test(o), "no personal data is read");
  assert(o.includes("return ok(req, { ok: true, at: now, provider, failures, stuck, today });"), "the four parts the page shows");
  const page = read("src/pages/admin/Ops.jsx");
  for (const id of ["ops-provider", "ops-failures", "ops-stuck", "ops-today", "ops-denied"]) assert(page.includes(`"${id}"`), id);
  assertMatch(read("src/App.jsx"), /<Route path="\/admin\/ops" element=\{<OpsPage \/>\} \/>/);
});
