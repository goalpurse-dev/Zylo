// Preview vs worker (Phase 6d-1 polish): for every camera move, the crop
// rectangle the editor preview shows (stickmanEdit cameraAt/progressAt) and
// the one the worker's FFmpeg perspective corners select are IDENTICAL at the
// first, middle and last frame — including a piece that starts mid-clip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { perspectiveExprAt, pieceGraph } from "../src/motion.mjs";
import { motionOf, cameraAt, progressAt, cropRect, MOTIONS, PAN_SCALE } from "../../src/lib/stickmanEdit.js";

const W = 1920, H = 1080, FPS = 30;
// Evaluate the worker's corner expressions at output frame `on` (FFmpeg maths in JS).
function workerRect(m, frames, offset, on) {
  const expr = perspectiveExprAt(m, frames, offset);
  const get = (k) => expr.match(new RegExp(`${k}='([^']+)'`))[1];
  const ev = (e) => new Function("clip", "W", "H", "on", `return ${e};`)((v, a, b) => Math.min(b, Math.max(a, v)), W, H, on);
  return { x0: ev(get("x0")) / W, x1: ev(get("x1")) / W, y0: ev(get("y0")) / H, y1: ev(get("y2")) / H };
}
const close = (a, b) => Object.keys(a).every((k) => Math.abs(a[k] - b[k]) < 1e-9);

for (const kind of MOTIONS) for (const intensity of ["normal", "subtle"]) {
  test(`${kind} (${intensity}): preview crop == worker crop at frame 0 / mid / last`, () => {
    const clip = { startMs: 0, endMs: 4000 };
    const frames = 120;
    const m = motionOf(kind, clip.endMs - clip.startMs, intensity);
    for (const k of [0, 59, 119]) {
      const preview = cropRect(cameraAt(m, progressAt(clip, ((k + 0.5) * 1000) / FPS)));
      assert.ok(close(preview, workerRect(m, frames, 0, k)), `${kind} frame ${k}`);
      // A transition piece that starts 100 frames into the clip: same frame, same rect.
      if (k >= 100) assert.ok(close(preview, workerRect(m, frames, 100, k - 100)), `${kind} frame ${k} in a piece`);
    }
    // Never an edge: the crop stays inside the picture.
    for (const k of [0, 59, 119]) { const r = workerRect(m, frames, 0, k); assert.ok(r.x0 >= -1e-9 && r.x1 <= 1 + 1e-9 && r.y0 >= -1e-9 && r.y1 <= 1 + 1e-9, JSON.stringify(r)); }
  });
}

test("pans sit on the 5 % base zoom; zooms never exceed 6 %; a master is cropped, never upsampled", () => {
  assert.equal(motionOf("pan_left", 6000).from.scale, PAN_SCALE);
  assert.equal(motionOf("push_in", 60000).to.scale, 1.06);
  assert.equal(motionOf("push_in", 3000, "subtle").to.scale, 1.018);
  const clip = { index: 0, startFrame: 0, frames: 90, motion: motionOf("push_in", 3000), masterImage: "m.jpg", masterSize: { width: 2752, height: 1536 } };
  const g = pieceGraph({ kind: "clip", a: 0, fromFrame: 0, toFrame: 90, frames: 90, overlays: [] }, [clip]);
  assert.match(g, /^\[0:v\]crop=2730:1536:11:0,format=gbrp,perspective=.*,scale=1920:1080:flags=lanczos/);
});
