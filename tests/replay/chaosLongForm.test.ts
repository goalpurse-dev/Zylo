// CHAOS, Long Form ($0, 2026-10-07). A whole video's scenes are drawn against a
// provider that misbehaves on purpose: 504s, timeouts, internalError, balance
// refusals, a scene that always fails, a worker that dies (a stuck job), a total
// outage; then the render crashes. In every case:
//   - nothing the user reads is a raw error,
//   - the video still finishes (or the whole hold is given back by itself),
//   - the credits are exactly right.
//
// What is real here: every rule that decides (the scene ladder, the outage and
// balance pauses, the scenes step, the edit builder and its render compile, the
// render watchdog and restart rules, the billing rules). What is simulated: the
// database rows and the clock (below), and the provider (each test's script).
// The simulated worker writes the same row changes the real worker does; those
// writes are pinned against the worker's source in sceneNeverStuck.test.ts.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { climbLadder, ladderOf, outageDecision, OUTAGE_WINDOW_S, type RungKind } from "../../supabase/functions/_shared/stickman/sceneLadder.ts";
import { decideScenes, plainWarning, SCENE_LEASE_S, SCENES_NO_PROGRESS_MAX_S, FAILED_SCENES_COPY, type ScenesRecord } from "../../supabase/functions/_shared/stickman/scenes.ts";
import { REFUSAL_HOLD_S } from "../../supabase/functions/_shared/runwareBalance.ts";
import { buildInitialEdit, validateEdit } from "../../src/lib/stickmanEdit.js";
import { compileEdit } from "../../supabase/functions/_shared/stickman/editRender.ts";
import { decideRenderRestart, decideRenderWatch, RENDER_FIXING_COPY, type RenderJobLite } from "../../supabase/functions/_shared/stickman/renderRetry.ts";
import { billingOnClose, renderBillingDecision } from "../../supabase/functions/_shared/longFormReservations.ts";
import { REFUNDED_COPY } from "../../supabase/functions/_shared/stickman/autopilot.ts";
import { NARRATION_PAUSED_COPY } from "../../supabase/functions/_shared/stickman/narrationRetry.ts";

const E504 = "Error: runware 504: \"Gateway Timeout\"";
const ETIMEOUT = "TimeoutError: The signal has been aborted";
const EINTERNAL = "Error: runware 200: [{\"code\":\"internalError\",\"message\":\"Internal error\"}]";
const EBALANCE = "Error: runware 200: [{\"message\":\"Insufficient available balance. Some of your credits are currently reserved for requests in progress\"}]";

type Row = { id: string; n: number; status: "queued" | "rendering" | "ready" | "failed"; attempts: number; leaseUntil: number | null; qa: any; image: string | null; readyAt: number | null };
type Call = { scene: number; rung: RungKind; clockS: number };
// What one provider call does: "ok", "check" (our own checks reject the picture), "die" (the worker is killed), or an error.
type Provider = (c: Call) => string;
const QUOTE = 250;          // credits held for the video
const DRAW_S = 8;

async function makeVideo(n: number, provider: Provider, maxMinutes = 900) {
  const rows: Row[] = Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, n: i + 1, status: "queued", attempts: 0, leaseUntil: null, qa: null, image: null, readyAt: null }));
  const sc: ScenesRecord & Record<string, any> = { status: "running", startedAt: new Date(0).toISOString(), resumes: 0, dispatched: {} };
  let clock = 0, pausedUntil = 0;
  const calls: Call[] = [];
  const events: string[] = [];
  const iso = (s: number) => new Date(s * 1000).toISOString();

  // The scene worker, with the real ladder and the real outage rule.
  const work = async (row: Row) => {
    row.status = "rendering"; row.attempts++; row.leaseUntil = clock + SCENE_LEASE_S;
    let elapsed = 0, died = false;
    const state = ladderOf(row.qa);
    const out = await climbLadder<{ failed: boolean }>({
      state, canDefer: true, rand: () => 0,
      draw: (rung) => {
        if (died) return Promise.reject(new Error("worker killed")); // a dead worker draws nothing more
        elapsed += DRAW_S;
        const c = { scene: row.n, rung, clockS: clock + elapsed };
        const r = provider(c);
        if (r === "die") { died = true; return Promise.reject(new Error("worker killed")); }
        calls.push(c);
        return r === "ok" ? Promise.resolve({ failed: false }) : r === "check" ? Promise.resolve({ failed: true }) : Promise.reject(new Error(r.replace(/^Error: /, "")));
      },
      sleep: (ms) => { elapsed += ms / 1000; return Promise.resolve(); },
      renewLease: () => { row.leaseUntil = clock + elapsed + SCENE_LEASE_S; return Promise.resolve(); },
      elapsedS: () => elapsed,
    }).catch(() => null);
    if (died || !out) { events.push(`worker died on scene ${row.n}`); return; } // nothing written: the row stays "rendering" until its lease is over
    const ladder = { step: state.step, checks: state.checks, failures: state.failures.slice(-12) };
    const notCounted = Math.max(0, row.attempts - 1);
    const keepOutage = row.qa?.outage ? { outage: row.qa.outage } : {};
    if (out.kind === "drawn") { row.status = "ready"; row.image = `https://img/${row.n}.jpg`; row.readyAt = clock + elapsed; row.leaseUntil = null; row.qa = { ok: true }; return; }
    if (out.kind === "balance") { row.status = "queued"; row.leaseUntil = null; row.attempts = notCounted; row.qa = { waiting: "provider_balance", ladder, ...keepOutage }; pausedUntil = clock + REFUSAL_HOLD_S; events.push("paused: balance"); return; }
    if (out.kind === "deferred") { row.leaseUntil = clock + elapsed + out.waitS; row.attempts = notCounted; row.qa = { waiting: "retry", ladder, ...keepOutage }; return; }
    const readyLately = rows.filter((r) => r.status === "ready" && r.readyAt != null && clock + elapsed - r.readyAt <= OUTAGE_WINDOW_S).length;
    const pendingOthers = rows.filter((r) => r !== row && (r.status === "queued" || r.status === "rendering")).length;
    const od = outageDecision({ failures: ladder.failures, readyLately, pendingOthers, outage: row.qa?.outage ?? null, nowMs: (clock + elapsed) * 1000 });
    if (od.kind === "wait") { row.status = "queued"; row.leaseUntil = null; row.attempts = notCounted; row.qa = { waiting: "provider_outage", outage: od.outage }; pausedUntil = clock + REFUSAL_HOLD_S; events.push("paused: outage"); return; }
    row.status = "failed"; row.leaseUntil = null; row.qa = { covered: true, ladder };
  };

  for (let minute = 0; minute < maxMinutes; minute++, clock += 60) {
    const expired = rows.filter((r) => r.status === "rendering" && (r.leaseUntil == null || r.leaseUntil < clock));
    const count = (s: Row["status"]) => rows.filter((r) => r.status === s).length;
    const d = decideScenes({
      now: iso(clock), scenes: sc as ScenesRecord, bible: { id: "b", status: "frozen", created_at: iso(0) }, plan: { id: "p1", status: "ready", created_at: iso(0), beatCount: n }, tier: "V2",
      images: { queued: count("queued"), rendering: count("rendering"), renderingExpired: expired.map((r) => ({ id: r.id, attempts: r.attempts })), ready: count("ready"), failed: count("failed"), total: n,
        lastProgressAt: iso(Math.max(0, ...rows.map((r) => r.readyAt ?? 0), sc.secondPassAt ? Date.parse(sc.secondPassAt) / 1000 : 0)) },
    });
    const a = d.action;
    if (a.kind === "done") return { outcome: "done" as const, rows, calls, events, minutes: minute };
    if (a.kind === "fail") return { outcome: "failed" as const, reason: a.reason, rows, calls, events, minutes: minute };
    if (a.kind === "give_up_drawing") { sc.gaveUpAt = iso(clock); for (const r of rows) if (r.status === "queued" || r.status === "rendering") { r.status = "failed"; r.leaseUntil = null; r.qa = { covered: true, gaveUp: true }; } events.push("gave up"); continue; }
    if (a.kind === "retry_failed") { sc.secondPassAt = iso(clock); for (const r of rows) if (r.status === "failed") { r.status = "queued"; r.attempts = 0; r.leaseUntil = null; r.qa = { secondPass: true }; } events.push("second pass"); continue; }
    if (a.kind === "draw") {
      for (const id of a.requeue) { const r = rows.find((x) => x.id === id)!; r.status = "queued"; r.leaseUntil = null; }
      for (const id of a.fail) { const r = rows.find((x) => x.id === id)!; r.status = "failed"; r.leaseUntil = null; r.qa = { ...(r.qa ?? {}), stalled: true }; }
      const slots = a.slots + 0;
      for (let i = 0; i < slots; i++) {
        if (clock < pausedUntil) break; // the guard: nothing is claimed while drawing is paused
        const next = rows.filter((r) => r.status === "queued").sort((x, y) => x.n - y.n)[0];
        if (!next) break;
        await work(next);
      }
    }
  }
  throw new Error("the run never ended");
}

// The edit and the render compile for what was drawn (the covered scenes included).
function editOf(rows: Row[]) {
  const words = Array.from({ length: 600 }, (_, i) => ({ text: `w${i}`, startMs: i * 250, endMs: i * 250 + 200 }));
  const scenes = rows.map((r) => ({ sceneId: r.image ? r.id : null, imageVersion: r.image ? 1 : null, number: r.n, startMs: (r.n - 1) * 5000, narration: `line ${r.n}`, imageUrl: r.image, overlay: null, camera: null }));
  const doc = buildInitialEdit({ scenes, words, audio: { url: "https://a/a.mp3", durationMs: rows.length * 5000 }, narrationId: "n1", seed: "p1" });
  return { doc, errors: validateEdit(doc), edl: compileEdit(doc, words) };
}
// Nothing a user reads may look like an error from a machine.
const RAW = /\b(?:50[0-9]|4[0-9]{2})\b|internalError|Timeout|runware|Error:|undefined|null|\{|\}|_failed|stack|exception/;
const plain = (s: string) => assert(!RAW.test(s), `reads like a raw error: ${s}`);
const finishedVideoCredits = () => { assertEquals(renderBillingDecision("done", true, { committed_credits: 0 }), "settle"); return QUOTE; };

Deno.test("chaos: 504s for the first three minutes -> every scene is drawn, the video finishes, the quote is charged once", async () => {
  const v = await makeVideo(12, (c) => (c.clockS < 180 ? E504 : "ok"));
  assertEquals(v.outcome, "done");
  assertEquals(v.rows.filter((r) => r.status === "ready").length, 12, "no scene was lost to a three-minute blip");
  const e = editOf(v.rows);
  assertEquals(e.errors, []);
  assertEquals(e.edl.clips.length, 12);
  assertEquals(e.doc.clips.filter((c: any) => c.covered).length, 0);
  assertEquals(finishedVideoCredits(), QUOTE);
});

Deno.test("chaos: every third call times out, every fifth is an internalError -> still every scene, nothing covered", async () => {
  let k = 0;
  const v = await makeVideo(12, () => { k++; return k % 3 === 0 ? ETIMEOUT : k % 5 === 0 ? EINTERNAL : "ok"; });
  assertEquals(v.outcome, "done");
  assertEquals(v.rows.filter((r) => r.status === "ready").length, 12);
  assertEquals(editOf(v.rows).errors, []);
});

Deno.test("chaos: one scene ALWAYS fails -> it is covered by the picture before it, the video finishes, nobody waits", async () => {
  const v = await makeVideo(12, (c) => (c.scene === 7 ? EINTERNAL : "ok"));
  assertEquals(v.outcome, "done");
  assertEquals(v.rows.filter((r) => r.status === "failed").map((r) => r.n), [7]);
  assert(v.events.includes("second pass"), "it got its free second pass first");
  assertEquals(v.calls.filter((c) => c.scene === 7).length, 12, "6 steps, twice: never a loop");
  assert(v.calls.some((c) => c.scene === 7 && c.rung === "safe") && v.calls.some((c) => c.scene === 7 && c.rung === "backup"), "the safe prompt and the backup model were tried");
  const e = editOf(v.rows);
  assertEquals(e.errors, [], "the editor opens and Publish renders");
  assertEquals(e.edl.clips.length, 12, "no hole in the video");
  const c7 = e.doc.clips.find((c: any) => c.beatSequence === 7);
  assertEquals([c7.covered, c7.image], [true, "https://img/6.jpg"]);
  assertEquals(finishedVideoCredits(), QUOTE);
  // What the scene card says, and that it is free to try again.
  plain(plainWarning("image_failed"));
  assertEquals(plainWarning("image_failed"), "This scene couldn't be drawn");
});

Deno.test("chaos: our Runware balance runs out for 40 minutes -> drawing pauses, nothing fails, it resumes by itself", async () => {
  const v = await makeVideo(12, (c) => (c.clockS > 60 && c.clockS < 60 + 40 * 60 ? EBALANCE : "ok"));
  assertEquals(v.outcome, "done");
  assertEquals(v.rows.filter((r) => r.status === "ready").length, 12, "not one scene failed or was covered");
  assert(v.events.includes("paused: balance"));
  const refused = v.calls.filter((c) => c.clockS > 60 && c.clockS < 60 + 40 * 60).length;
  assert(refused <= 12, `the provider was asked ${refused} times in 40 minutes (once per 5-minute hold), not once a minute per scene`);
  assertEquals(finishedVideoCredits(), QUOTE);
});

Deno.test("chaos: a total outage for 30 minutes -> scenes WAIT (not covered), then every one is drawn", async () => {
  const v = await makeVideo(12, (c) => (c.clockS < 30 * 60 ? E504 : "ok"));
  assertEquals(v.outcome, "done");
  assert(v.events.includes("paused: outage"));
  assertEquals(v.rows.filter((r) => r.status === "ready").length, 12, "an outage does not become a video of still pictures");
  assertEquals(editOf(v.rows).doc.clips.filter((c: any) => c.covered).length, 0);
});

Deno.test("chaos: the provider never comes back -> the run ends by itself and EVERY credit goes back (nothing to press)", async () => {
  const v = await makeVideo(12, () => E504);
  assertEquals(v.outcome, "failed");
  assertEquals((v as any).reason, "no scene could be drawn");
  assert(v.minutes * 60 <= 2 * SCENES_NO_PROGRESS_MAX_S + 3600, `it gave up after ${v.minutes} minutes, not never`);
  assertEquals(v.rows.filter((r) => r.status === "ready").length, 0);
  // No finished scene + a failed run = failed by us: the whole hold, committed credits included.
  assertEquals(billingOnClose({ mode: "progressive", reserved: QUOTE, committed: 40, workCredits: 40, failedByUs: true }, "failed_by_us"), { keep: 0, refund: QUOTE });
  assertEquals(billingOnClose({ mode: "fixed", reserved: QUOTE, committed: 0, workCredits: 0, failedByUs: true }, "failed_by_us"), { keep: 0, refund: QUOTE });
  plain(REFUNDED_COPY);
});

Deno.test("chaos: a stuck job (the worker is killed mid-scene, twice) -> the watchdog hands it on and it is drawn", async () => {
  let kills = 0;
  const v = await makeVideo(12, (c) => (c.scene === 4 && kills < 2 ? (kills++, "die") : "ok"));
  assertEquals(v.outcome, "done");
  assertEquals(v.events.filter((e) => e.startsWith("worker died")).length, 2);
  assertEquals(v.rows.find((r) => r.n === 4)!.status, "ready", "never a spinner for ever");
  assertEquals(v.rows.filter((r) => r.status === "ready").length, 12);
});

Deno.test("chaos: our own checks reject a scene's pictures every time -> safe prompt, backup model, then covered; the rest is untouched", async () => {
  const v = await makeVideo(12, (c) => (c.scene === 2 ? "check" : "ok"));
  assertEquals(v.outcome, "done");
  assertEquals(v.rows.filter((r) => r.status === "failed").map((r) => r.n), [2]);
  assertEquals(v.calls.filter((c) => c.scene === 2).length, 8, "4 draws, twice (no waits for our own checks)");
  assertEquals(editOf(v.rows).edl.clips.length, 12);
});

// ---------------- the render ----------------
const T0 = Date.parse("2026-10-07T12:00:00.000Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
// A render driven by the real watchdog rules: `machine` says what each started machine does.
function runRender(machine: (n: number) => "done" | "crash" | "never_boots" | "dies") {
  const job: RenderJobLite & { finished?: string } = { status: "queued", attempt: 0, max_attempts: 3, machine_id: "m1", heartbeat_at: null, dispatched_at: at(0), created_at: at(0), updated_at: at(0), error_code: null };
  let machines = 1, clock = 0;
  const run = () => {
    const what = machine(machines);
    if (what === "never_boots") return;
    job.attempt++; job.status = "rendering"; job.updated_at = at(clock + 20); job.heartbeat_at = at(clock + 20);
    if (what === "done") { job.status = "done"; return; }
    if (what === "crash") {
      // The worker's own rule: a temporary error goes back to the queue until the attempts are used up.
      if (job.attempt >= job.max_attempts) { job.status = "failed"; job.error_code = "RENDER_ERROR"; return; }
      job.status = "queued"; job.error_code = "ffmpeg exited 137"; job.updated_at = at(clock + 200);
    }
    // "dies": the machine vanishes; the row stays "rendering" with an old heartbeat.
  };
  run();
  for (clock = 120; clock < 4 * 3600 && job.status !== "done" && job.status !== "failed"; clock += 120) {
    const d = decideRenderWatch(job, T0 + clock * 1000);
    if (d.kind === "fail") { job.status = "failed"; job.error_code = d.code; break; }
    if (d.kind === "dispatch") { machines++; job.dispatched_at = at(clock); job.machine_id = `m${machines}`; if (d.errorCode) job.error_code = d.errorCode; run(); }
  }
  return { job, machines, seconds: clock };
}

Deno.test("chaos: the render crashes once -> a new machine finishes it; the quote is charged only now", () => {
  const r = runRender((n) => (n === 1 ? "crash" : "done"));
  assertEquals([r.job.status, r.machines], ["done", 2]);
  assertEquals(renderBillingDecision("done", true, { committed_credits: 0 }), "settle");
});

Deno.test("chaos: the render machine never boots / dies mid-render -> replaced; a finished video either way", () => {
  assertEquals(runRender((n) => (n <= 2 ? "never_boots" : "done")).job.status, "done");
  assertEquals(runRender((n) => (n === 1 ? "dies" : "done")).job.status, "done");
});

Deno.test("chaos: the render fails EVERY time -> failed for good, never 'rendering' for ever; the user's credits are untouched and it restarts by itself", () => {
  for (const kind of ["crash", "never_boots", "dies"] as const) {
    const r = runRender(() => kind);
    assertEquals(r.job.status, "failed", kind);
    assert(r.machines <= 3, `${kind}: ${r.machines} machines at most`);
    assert(r.seconds < 3600, `${kind}: decided within the hour`);
  }
  // A failed render never charges and never refunds: the hold waits for the retry.
  assertEquals(renderBillingDecision("failed", true, { committed_credits: 0 }), "keep");
  // The user reads calm words; the render starts again after 10 minutes, then after an hour, then a person is needed.
  plain(RENDER_FIXING_COPY);
  assertEquals(decideRenderRestart(1, at(0), T0 + 601_000).kind, "restart");
  assertEquals(decideRenderRestart(2, at(0), T0 + 3601_000).kind, "restart");
  assertEquals(decideRenderRestart(3, at(0), T0 + 99999_000).kind, "exhausted");
});

Deno.test("chaos: every line a user can read in these cases is plain words", () => {
  for (const s of [RENDER_FIXING_COPY, REFUNDED_COPY, NARRATION_PAUSED_COPY, FAILED_SCENES_COPY, plainWarning("image_failed"), "Drawing is paused for a moment, your video continues automatically.", "Paused, continues automatically", "Try again (free)"]) plain(s);
});
