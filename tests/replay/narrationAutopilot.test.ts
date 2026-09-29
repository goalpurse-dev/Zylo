// Phase 6b — the autopilot continues into narration (voice chosen in Step 1),
// and the SERVER watchdog (not the page) recovers a stalled narration run.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { decideNarration, NARRATION_KICK_AFTER_S, NARRATION_MAX_KICKS } from "../../supabase/functions/_shared/stickman/autopilot.ts";
import { narrationEtaSeconds, narrationLeaseMs, NARRATION_MAX_ATTEMPTS } from "../../supabase/functions/_shared/stickman/narrationAudio.ts";
import { wordsPerMinuteFor, VOICE_CALIBRATIONS } from "../../src/lib/voicePace.ts";
import { VOICE_SAMPLE_PACE } from "../../src/lib/voiceSamplePace.ts";

const T0 = "2026-09-28T18:00:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();
const row = (o: any = {}) => ({ id: "n1", status: "generating", lease_until: at(120), created_at: at(0), ...o });
const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));

Deno.test("script done -> lock (kicks TTS) -> wait -> done when narration is ready", () => {
  assertEquals(decideNarration({ now: at(0), narration: { kicks: 0 }, row: null }), { kind: "lock" });
  assertEquals(decideNarration({ now: at(30), narration: { lockedAt: at(0), kicks: 1 }, row: null }), { kind: "wait" });
  assertEquals(decideNarration({ now: at(40), narration: { lockedAt: at(0), kicks: 1 }, row: row() }), { kind: "wait" });
  assertEquals(decideNarration({ now: at(60), narration: { lockedAt: at(0), kicks: 1 }, row: row({ status: "ready" }) }), { kind: "done", narrationStatus: "ready" });
  assertEquals(decideNarration({ now: at(60), narration: {}, row: row({ status: "alignment_failed" }) }), { kind: "done", narrationStatus: "ready" });
});

Deno.test("watchdog: an expired lease is handed back to the generator (resume once, then a clear failure)", () => {
  assertEquals(decideNarration({ now: at(121), narration: { lockedAt: at(0), kicks: 1 }, row: row() }), { kind: "resume", rowId: "n1" });
  // The generator settles a second stall to failed -> the run ends with a free Retry on the Voice screen.
  assertEquals(decideNarration({ now: at(400), narration: { lockedAt: at(0), kicks: 1 }, row: row({ status: "failed" }) }), { kind: "done", narrationStatus: "failed" });
  assertEquals(NARRATION_MAX_ATTEMPTS, 2);
  // f90160bc's script (8,332 chars): lease = slow ETA + 90 s grace.
  const [lo, hi] = narrationEtaSeconds(8332);
  assert(lo >= 10 && hi > lo);
  assertEquals(narrationLeaseMs(8332), (hi + 90) * 1000);
});

Deno.test("no row after the lock: re-kick after 120 s, stop after 3 kicks (never loops forever)", () => {
  assertEquals(decideNarration({ now: at(NARRATION_KICK_AFTER_S + 1), narration: { lockedAt: at(0), kicks: 1 }, row: null }), { kind: "lock" });
  assertEquals(decideNarration({ now: at(NARRATION_KICK_AFTER_S + 1), narration: { lockedAt: at(0), kicks: NARRATION_MAX_KICKS }, row: null }), { kind: "done", narrationStatus: "failed" });
});

Deno.test("server-side recovery: cron sweeps expired narration leases; the page only displays", () => {
  const advance = read("supabase/functions/advance-long-form-autopilot/index.ts");
  assertMatch(advance, /sweepStalledNarration/);
  assertMatch(advance, /\.eq\("status", "generating"\)\.lt\("lease_until"/);
  assertMatch(advance, /resumeRowId: row\.id/);
  const status = read("supabase/functions/get-long-form-narration-status/index.ts");
  assert(!/generate-long-form-narration-audio`/.test(status), "the status endpoint must not dispatch work");
  const gen = read("supabase/functions/generate-long-form-narration-audio/index.ts");
  assertMatch(gen, /requireUserOrAutopilot\(req\)/);
  // A superseded row is closed, never re-generated (the watchdog can't start a new paid run).
  assertMatch(gen, /resumeRowId && existing\?\.id !== resumeRowId/);
  assertMatch(gen, /NARRATION_SUPERSEDED/);
  // The heartbeat keeps the attempt counter (so a second stall really is attempt 2).
  assertMatch(gen, /\.\.\.prevMeta, phase: "saving"/);
});

Deno.test("voice pace: every catalog voice is measured from its sample (scaled to script pace)", () => {
  assertEquals(Object.keys(VOICE_SAMPLE_PACE).length, 33);
  // Josh keeps his 92-word reference row.
  assertEquals(wordsPerMinuteFor({ voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5", speed: 1 }).wordsPerMinute, 146.6);
  const george = wordsPerMinuteFor({ voiceId: "JBFqnCBsd6RMkjVDRZzb", voiceModel: "eleven_flash_v2_5", speed: 1 });
  assert(george.calibrated);
  assertEquals(george.wordsPerMinute, Math.round(VOICE_SAMPLE_PACE["JBFqnCBsd6RMkjVDRZzb"].wpm * (146.6 / VOICE_SAMPLE_PACE["TxGEqnHWrfWFTfGW9XjX"].wpm) * 10) / 10);
  assertEquals(VOICE_CALIBRATIONS.length, 1 + 33);
});
