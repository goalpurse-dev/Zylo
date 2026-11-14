// node --test scripts/blockyWorlds/blenderKit/rp.test.mjs   (pure GPU pricing helpers: no job, no key)
import test from "node:test";
import assert from "node:assert/strict";
import { GPU, RATE, BOOT_S, finalEstimate, previewEstimate, fitLimits } from "./rp.mjs";

test("the final is priced from the measured s/frame x the margin, not the cancel limits", () => {
  // a 96 s video: 2896 frames; measured 0.66 s a frame -> ~$0.45 real, priced ~$0.60 (the old reserve: $0.94)
  const e = finalEstimate({ frames: 2896, chunks: 6, dur: 96.5 });
  assert.ok(e > 0.5 && e < 0.7, `final ${e}`);
  assert.equal(e, +((2896 * 0.66 * GPU.margin + 3 * BOOT_S + (60 + 2 * 96.5) * GPU.margin + BOOT_S) * RATE).toFixed(4));
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
