// The render and the voice never leave a video stuck (2026-10-07).
//
// RENDER. Machines run one job and exit. A job the worker put back in the queue
// after a temporary error was then called "the server couldn't start" by the
// watchdog and failed; a job whose machine died on its last attempt stayed
// "rendering" for ever. Now every such job gets a new machine, a render that
// failed for good alerts the owner, the user reads that it is being fixed, and
// it starts again by itself (after 10 minutes, then after an hour).
//
// VOICE. One failed call to the voice provider failed the video and gave the
// hold back. Now the voice is paused and tried again by itself for up to six
// hours; only then (or for a request the provider will never take) does it fail.
// All $0: pure rules + source checks.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { decideRenderRestart, decideRenderWatch, renderAlert, QUEUED_NO_MACHINE_S, RENDER_AUTO_RESTARTS, RENDER_BOOT_TRIES, RENDER_FIXING_COPY, RESTART_REFUSED, STALE_S, type RenderJobLite } from "../../supabase/functions/_shared/stickman/renderRetry.ts";
import { classifyNarrationFailure, decideNarrationFailure, narrationAlert, NARRATION_PAUSE_MAX_S, NARRATION_PAUSE_WAITS_S, NARRATION_PAUSED_COPY } from "../../supabase/functions/_shared/stickman/narrationRetry.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const T0 = Date.parse("2026-10-07T12:00:00.000Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
const job = (o: Partial<RenderJobLite> = {}): RenderJobLite => ({ status: "queued", attempt: 0, max_attempts: 3, machine_id: "m1", heartbeat_at: null, dispatched_at: at(0), created_at: at(-1), updated_at: at(-1), error_code: null, ...o });
const watch = (o: Partial<RenderJobLite>, nowS: number) => decideRenderWatch(job(o), T0 + nowS * 1000);

Deno.test("render: a job put back in the queue after a temporary error gets a NEW machine at once (it used to be failed)", () => {
  // Claimed at 20 s, crashed at 200 s: the worker set it back to queued and its machine exited.
  const requeued = { status: "queued", attempt: 1, updated_at: at(200), error_code: "ffmpeg exited 137" };
  assertEquals(watch(requeued, 210), { kind: "dispatch", why: "requeued" });
  assertEquals(watch({ ...requeued, attempt: 2, updated_at: at(900), dispatched_at: at(400) }, 905), { kind: "dispatch", why: "requeued" });
  // Its attempts used up (the worker normally reports that itself): failed, never left queued.
  assertEquals(watch({ ...requeued, attempt: 3 }, 210), { kind: "fail", code: "ATTEMPTS_EXHAUSTED" });
  // The new machine was just started: wait for it.
  assertEquals(watch({ ...requeued, dispatched_at: at(210) }, 240), { kind: "none" });
});

Deno.test("render: a machine that never claimed its job is replaced, 3 machines at most, then the job fails", () => {
  assertEquals(watch({}, QUEUED_NO_MACHINE_S - 10), { kind: "none" });
  assertEquals(watch({}, QUEUED_NO_MACHINE_S + 10), { kind: "dispatch", why: "boot_retry", errorCode: "WORKER_BOOT_RETRY_1" });
  assertEquals(watch({ error_code: "WORKER_BOOT_RETRY_1" }, QUEUED_NO_MACHINE_S + 10), { kind: "dispatch", why: "boot_retry", errorCode: "WORKER_BOOT_RETRY_2" });
  assertEquals(watch({ error_code: "WORKER_BOOT_RETRY_2" }, QUEUED_NO_MACHINE_S + 10), { kind: "fail", code: "WORKER_BOOT_FAILED" });
  assertEquals(RENDER_BOOT_TRIES, 3);
  // No machine at all (Fly refused the start): asked again, free, as before.
  assertEquals(watch({ machine_id: null }, QUEUED_NO_MACHINE_S + 10), { kind: "dispatch", why: "no_machine" });
});

Deno.test("render: a machine that died mid-render is replaced; on the last attempt the job FAILS (it used to stay 'rendering' for ever)", () => {
  const running = { status: "rendering", attempt: 1, heartbeat_at: at(100), updated_at: at(100) };
  assertEquals(watch(running, 100 + STALE_S - 5), { kind: "none" });
  assertEquals(watch(running, 100 + STALE_S + 5), { kind: "dispatch", why: "stale" });
  assertEquals(watch({ ...running, attempt: 3 }, 100 + STALE_S + 5), { kind: "fail", code: "ATTEMPTS_EXHAUSTED" });
  assertEquals(watch({ status: "done" }, 9999), { kind: "none" });
});

Deno.test("render: failed for good -> started again by itself after 10 minutes, then after an hour, then it waits for a person", () => {
  const restart = (failedToday: number, sinceS: number) => decideRenderRestart(failedToday, at(0), T0 + sinceS * 1000);
  assertEquals(restart(1, 300), { kind: "wait", inS: 300 });
  assertEquals(restart(1, 601), { kind: "restart", number: 1 });
  assertEquals(restart(2, 601), { kind: "wait", inS: 2999 });
  assertEquals(restart(2, 3601), { kind: "restart", number: 2 });
  assertEquals(restart(3, 99999), { kind: "exhausted" });
  assertEquals(RENDER_AUTO_RESTARTS, 2);
  // The owner's email says which it is.
  const first = renderAlert({ projectId: "p", jobId: "j", errorCode: "RENDER_CHECKS_FAILED", workerReason: "The rendered video failed its timing checks.", attempt: 1, maxAttempts: 3, failedToday: 1 });
  assertMatch(first.subject, /^Zyvo: a render failed for good \(RENDER_CHECKS_FAILED\)$/);
  assertMatch(first.text, /2 automatic restarts left/);
  assertMatch(first.text, /Worker said: The rendered video failed its timing checks\./);
  const last = renderAlert({ projectId: "p", jobId: "j", errorCode: "ATTEMPTS_EXHAUSTED", workerReason: null, attempt: 3, maxAttempts: 3, failedToday: 3 });
  assertMatch(last.subject, /needs you$/);
  assertMatch(last.text, /will NOT start again by itself/);
  assertEquals(RENDER_FIXING_COPY, "We're fixing your render, it will continue automatically.");
});

Deno.test("render wiring: the watchdog acts on the rules; a failure for good alerts the owner and never shows the user a raw reason", () => {
  const w = read("supabase/functions/long-form-render/index.ts");
  assertMatch(w, /const d = decideRenderWatch\(j as any, now\);/);
  assert(!/queuedLate/.test(w) && !/The render server couldn't start/.test(w), "the old 'couldn't start' failure is gone");
  assertMatch(w, /await finish\(j\.parent_job_id \?\? j\.id, d\.code\);/, "a failed chunk fails its whole render through the one finish path");
  assertMatch(w, /\.\.\.\(d\.errorCode \? \{ error_code: d\.errorCode \} : \{\}\)/, "the boot-retry count is kept on the job");
  // The automatic restart: only the newest job, only ours, never for a refunded project, never every minute.
  assertMatch(w, /if \(!newest \|\| newest\.id !== list\[0\]\.id\) continue;/);
  assertMatch(w, /if \(list\[0\]\.user_reason !== RENDER_FIXING_COPY\) continue;/);
  assertMatch(w, /if \(hold\?\.status === "released"\) continue;/);
  assertMatch(w, /if \(String\(list\[0\]\.error_code \?\? ""\)\.startsWith\(RESTART_REFUSED\)\) continue;/);
  assertEquals(RESTART_REFUSED, "RESTART_REFUSED:");
  assertMatch(w, /fixing: job\.status === "failed" && job\.user_reason === RENDER_FIXING_COPY,/);
  const f = read("supabase/functions/finish-long-form-render/index.ts");
  assertMatch(f, /const userReason = terminal \? RENDER_FIXING_COPY : /);
  assertMatch(f, /alerted = await alertAdmin\(mail\.subject, mail\.text, "render"\);/);
  // The per-minute sweep reaches the watchdog while a failed render waits for its restart.
  const a = read("supabase/functions/advance-long-form-autopilot/index.ts");
  assertMatch(a, /if \(count\) background\(fetch\(fn\("long-form-render"\), \{[^\n]*body: JSON\.stringify\(\{ action: "watchdog" \}\)/);
  // A failed render never touches the user's credits (retried free).
  assertMatch(read("supabase/functions/_shared/longFormReservations.ts"), /return outcome === "done" \? "settle" : "keep";/);
});

const E = (status: number, body = "") => `NARRATION_TTS_PROVIDER_FAILED: ${status} ${body}`;
Deno.test("voice: what kind of failure it was", () => {
  for (const m of [E(429, "too_many_concurrent_requests"), E(500), E(502), E(503, "system_busy"), "TimeoutError: The signal has been aborted", "NARRATION_TTS_MISSING_AUDIO", "NARRATION_TTS_MISSING_ALIGNMENT", "UNKNOWN_ERROR", "TypeError: error sending request"]) assertEquals(classifyNarrationFailure(m), "transient", m);
  for (const m of [E(401, "{\"detail\":{\"status\":\"quota_exceeded\"}}"), E(401, "invalid_api_key"), E(402), E(403), E(400, "quota_exceeded")]) assertEquals(classifyNarrationFailure(m), "account", m);
  for (const m of [E(400, "voice_not_found"), E(404), E(422, "invalid text")]) assertEquals(classifyNarrationFailure(m), "input", m);
});

Deno.test("voice: the provider is down -> paused, tried again with growing waits, never failed; the owner hears after the third pause", () => {
  let paused: any = null;
  const waits: number[] = [], alerts: (string | null)[] = [];
  let nowMs = T0;
  for (let i = 0; i < 8; i++) {
    const d = decideNarrationFailure({ message: E(503), paused, nowMs });
    assertEquals(d.kind, "pause");
    if (d.kind !== "pause") break;
    waits.push(d.waitS); alerts.push(d.alert);
    paused = { since: d.since, tries: d.tries };
    nowMs += d.waitS * 1000 + 15_000;
  }
  assertEquals(waits, [30, 60, 120, 300, 600, 600, 600, 600]);
  assertEquals(NARRATION_PAUSE_WAITS_S, [30, 60, 120, 300, 600]);
  assertEquals(alerts, [null, null, "down", null, null, null, null, null], "one email, not one per try");
  assertEquals(paused.since, new Date(T0).toISOString(), "the pause keeps its start");
  // Six hours later it is given up (and the hold goes back by itself).
  assertEquals(decideNarrationFailure({ message: E(503), paused, nowMs: T0 + NARRATION_PAUSE_MAX_S * 1000 + 1000 }), { kind: "fail", why: "paused_too_long" });
});

Deno.test("voice: our own account (no credits, bad key) pauses too and the owner is emailed at once; a request the provider won't take fails fast", () => {
  const first = decideNarrationFailure({ message: E(401, "quota_exceeded"), paused: null, nowMs: T0 });
  assertEquals([first.kind, (first as any).alert, (first as any).waitS], ["pause", "account", 30]);
  assertEquals((decideNarrationFailure({ message: E(401, "quota_exceeded"), paused: { since: at(0), tries: 1 }, nowMs: T0 + 40_000 }) as any).alert, null);
  assertEquals(decideNarrationFailure({ message: E(400, "voice_not_found"), paused: null, nowMs: T0 }).kind, "pause");
  assertEquals(decideNarrationFailure({ message: E(400, "voice_not_found"), paused: { since: at(0), tries: 2 }, nowMs: T0 + 100_000 }), { kind: "fail", why: "input" });
  assertMatch(narrationAlert("account", { projectId: "p", rowId: "r", message: E(401, "quota_exceeded"), tries: 1 }).text, /OUR ElevenLabs account/);
  assertMatch(narrationAlert("failed", { projectId: "p", rowId: "r", message: E(400), tries: 2 }).subject, /hold released/);
  assertEquals(NARRATION_PAUSED_COPY, "Paused for a moment, continues automatically.");
});

Deno.test("voice wiring: paused rows stay 'generating' with a lease, the hold is untouched, the pause is not an attempt", () => {
  const g = read("supabase/functions/generate-long-form-narration-audio/index.ts");
  const catchBlock = g.slice(g.indexOf("} catch (e) {"), g.indexOf("Deno.serve"));
  const pause = catchBlock.slice(catchBlock.indexOf('if (d.kind === "pause") {'), catchBlock.indexOf("status: \"failed\""));
  assert(pause.length > 200);
  assert(!/status:/.test(pause.replace(/hold\?\.status/g, "")), "the row's status is not changed by a pause");
  assert(!/releaseReservationIfActive|refundAddon/.test(pause), "nothing is refunded by a pause");
  assertMatch(pause, /lease_until: new Date\(nowMs \+ d\.waitS \* 1000\)\.toISOString\(\)/);
  assertMatch(pause, /attempts: Math\.max\(0, Number\(meta\.attempts \?\? 1\) - 1\), phase: "paused"/);
  assertMatch(pause, /return;/);
  // One quick retry in the same worker, only for a temporary error that failed fast.
  assertMatch(g, /if \(!fast \|\| classifyNarrationFailure\(e instanceof Error \? e\.message : String\(e\)\) !== "transient"\) throw e;/);
  // For good: a paid re-record is refunded once; only the project's FIRST voice gives the hold back.
  assertMatch(catchBlock, /await refundAddon\(admin, owner\.user_id, addon, "voice_rerecord_failed"/);
  assertMatch(catchBlock, /if \(!earlier\) await releaseReservationIfActive\(admin, projectId, "narration_failed", logEvent\);/);
  // The watchdog that resumes stalled voice rows resumes paused ones (same query: generating + lease over).
  const a = read("supabase/functions/advance-long-form-autopilot/index.ts");
  assertMatch(a, /\.eq\("status", "generating"\)\.lt\("lease_until", new Date\(\)\.toISOString\(\)\)/);
  // A voice that failed for good: the screen says the credits are back (no Retry to find).
  assertMatch(a, /ap\.failedReason = "the voiceover failed";[\s\S]{0,400}await releaseIfNoVideoPossible\(projectId, ap, "the voiceover failed", now\);/);
  assertMatch(a, /if \(hold\?\.status === "released"\) ap\.holdReleasedAt = now;/);
  // The page can say "paused".
  assertMatch(read("supabase/functions/get-long-form-narration-status/index.ts"), /paused: row\?\.status === "generating" && row\?\.provider_metadata\?\.phase === "paused",/);
});
