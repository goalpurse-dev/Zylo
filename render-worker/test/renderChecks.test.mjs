// The render's duration check counts FRAMES, not the container duration.
import test from "node:test";
import assert from "node:assert/strict";
// worker.mjs builds a Supabase client at import: dummy values (nothing is called).
process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test";
const { durationCheck } = await import("../src/worker.mjs");

test("f6ee3eb2 16:31 (Fly, ffmpeg 5.1): +35 ms container padding no longer fails a frame-exact render", () => {
  // Replayed offline from the stored chunks with ffmpeg 5.1.2 (render-worker/scripts/replayChecks.mjs).
  const d = durationCheck({ videoFrames: 15701, edlFrames: 15701, fps: 30, audioMs: 523375, containerMs: 523410 });
  assert.equal(d.pass, true);
  assert.ok(Math.abs(523410 - 523375) > 1000 / 30, "the old container-duration rule would have failed it");
  // v40 on Fly: +52 ms padding, also a pass.
  assert.equal(durationCheck({ videoFrames: 17291, edlFrames: 17291, fps: 30, audioMs: 576364, containerMs: 576416 }).pass, true);
});

test("a real timing problem still fails: a dropped frame, or video vs voice off by more than a frame", () => {
  assert.equal(durationCheck({ videoFrames: 15700, edlFrames: 15701, fps: 30, audioMs: 523375, containerMs: 523333 }).pass, false);
  assert.equal(durationCheck({ videoFrames: 15701, edlFrames: 15701, fps: 30, audioMs: 523450, containerMs: 523367 }).pass, false);
});
