// Blocky Stories final video (stage 3f): the machine job and what its report does (offline).
import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalJob, finalMachineConfig, finalPath, storyUpdateForReport, FINAL_MACHINE } from "../supabase/functions/_shared/blocky/final.js";
import { stepBlocker } from "../supabase/functions/_shared/blocky/storyState.js";

const story = { id: "st1", aspect: "9:16" };
const scenes = [
  { idx: 1, line: "Second line.", clip_status: "ready", clip_url: "https://x/2.mp4" },
  { idx: 0, line: "First line, exact.", clip_status: "ready", clip_url: "https://x/1.mp4" },
];

test("the job lists every clip in scene order with its exact line as the caption", () => {
  const job = buildFinalJob({ story, scenes, callId: "c-123456789", captions: true, uploadUrl: "u", callbackUrl: "cb", token: "t" });
  assert.deepEqual(job.clips, [{ url: "https://x/1.mp4", line: "First line, exact." }, { url: "https://x/2.mp4", line: "Second line." }]);
  assert.equal(job.captions, true);
  assert.equal(buildFinalJob({ story, scenes, callId: "c", captions: false }).captions, false);
  assert.throws(() => buildFinalJob({ story, scenes: [{ ...scenes[0], clip_status: "failed" }], callId: "c" }), /every scene needs a clip/);
});

test("machine: render-worker image, runs blockyFinal once and is destroyed, 4 dedicated CPUs", () => {
  const job = buildFinalJob({ story, scenes, callId: "abcdef12-3456", captions: true, uploadUrl: "u", callbackUrl: "cb", token: "t" });
  const m = finalMachineConfig({ image: "registry.fly.io/zyvo-render:blocky-final", job });
  assert.match(m.name, /^blocky-final-abcdef12-/);
  assert.deepEqual(m.config.init.cmd, ["node", "src/blockyFinal.mjs"]);
  assert.equal(m.config.auto_destroy, true);
  assert.deepEqual(m.config.restart, { policy: "no" });
  assert.deepEqual(m.config.guest, FINAL_MACHINE);
  assert.deepEqual(JSON.parse(m.config.env.BLOCKY_FINAL_JOB), job);
  assert.equal(finalPath("u1", "st1", "c1"), "blocky/u1/st1/final-c1.mp4");
});

test("a report makes the story final_ready, or sends it back to clips_ready with a free-retry message", () => {
  assert.deepEqual(storyUpdateForReport({ ok: true, trimmedSec: 3.95, trimmedPerClip: [1.2, 1.2, 1.56] }, "https://x/final.mp4", "retry"), {
    status: "final_ready", final_status: "ready", final_url: "https://x/final.mp4", final_error: null, final_trimmed_sec: 3.95, final_trimmed_per_clip: [1.2, 1.2, 1.56],
  });
  assert.deepEqual(storyUpdateForReport({ ok: false, error: "ffmpeg exited 1" }, null, "We couldn't join your clips."), { status: "clips_ready", final_status: "failed", final_error: "We couldn't join your clips." });
});

test("final needs every clip; it can be rebuilt from final_ready", () => {
  const ready = [{ clipStatus: "ready" }, { clipStatus: "ready" }];
  assert.equal(stepBlocker("final", { status: "clips_ready" }, ready), null);
  assert.equal(stepBlocker("final", { status: "final_ready" }, ready), null);
  assert.match(stepBlocker("final", { status: "animating" }, ready), /Animate every scene first/);
  assert.match(stepBlocker("final", { status: "clips_ready" }, [{ clipStatus: "ready" }, { clipStatus: "failed" }]), /Every scene needs a clip/);
});
