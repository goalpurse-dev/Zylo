// node --test scripts/blockyWorlds/blenderKit/rp.test.mjs   (pure GPU pricing helpers: no job, no key)
import test from "node:test";
import assert from "node:assert/strict";
import { GPU, RATE, BOOT_S, finalEstimate, previewEstimate, fitLimits } from "./rp.mjs";

test("the final is priced from the measured s/frame x the margin, not the cancel limits", () => {
  // a 96 s video: 2896 frames at the widened measured speed (0.95 s a frame, the slow end of 0.65-0.99) x the margin
  const e = finalEstimate({ frames: 2896, chunks: 6, dur: 96.5 });
  assert.equal(e, +((2896 * GPU.sPerFrame * GPU.margin + 3 * BOOT_S + GPU.finishS(96.5) * GPU.margin + BOOT_S) * RATE).toFixed(4));
  assert.ok(GPU.sPerFrame >= 0.95, "widened to the slow workers");
  assert.ok(previewEstimate({ shots: 42, jobs: 3 }) < 0.15);
});

test("fitLimits: the hard limits when the money covers them; scaled toward the floors when not; null when even the floors do not fit", () => {
  const hard = [800, 800, 700], floor = [400, 400, 300];
  const all = fitLimits({ hard, floor, roomUsd: 10 });
  assert.deepEqual(all, { limits: hard, f: 1 });
  const need = (lim) => lim.reduce((a, x) => a + (x + BOOT_S) * RATE, 0);
  const room = need(floor) + 0.5 * (need(hard) - need(floor));
  const mid = fitLimits({ hard, floor, roomUsd: room });
  assert.ok(mid.f > 0.45 && mid.f < 0.55, `f ${mid.f}`);
  assert.ok(need(mid.limits) <= room + 1e-9, "the fitted limits never pass the money left");
  mid.limits.forEach((x, i) => assert.ok(x >= floor[i] && x <= hard[i]));
  assert.equal(fitLimits({ hard, floor, roomUsd: need(floor) - 0.01 }), null);
});

import { chunkLimitS, chunkFloorS, finishLimitS, finishFloorS, LIMIT_FACTOR } from "./rp.mjs";
test("the job limits scale with the video and the measured speed (the 96 s finish that ran over 631 s gets ~1150 s)", () => {
  assert.ok(finishLimitS({ dur: 96.5 }) >= 900, `finish ${finishLimitS({ dur: 96.5 })}`);
  assert.ok(finishLimitS({ dur: 180 }) > finishLimitS({ dur: 96.5 }) && finishLimitS({ dur: 60 }) < finishLimitS({ dur: 96.5 }));
  assert.ok(finishFloorS({ dur: 96.5 }) > 631, "the floor covers the measured slow finish");
  // the slowest measured chunk: 529 frames at 0.925 s and 464 at 0.986 s: both well inside their limits
  assert.ok(chunkLimitS({ frames: 529, shots: 15 }) > 529 * 0.99 * 1.4);
  assert.ok(chunkLimitS({ frames: 1000, shots: 15 }) > chunkLimitS({ frames: 500, shots: 15 }));
  assert.ok(chunkFloorS({ frames: 464 }) > 457, "the floor covers the measured 457 s chunk");
  assert.ok(LIMIT_FACTOR >= 1.5);
});
