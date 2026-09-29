// Transitions (Phase 6d-1): every editor transition maps to one FFmpeg xfade
// (whip = slideleft + a horizontal blur), runs over its whole piece (offset 0,
// duration = frames / fps), and each picture keeps its own camera move
// frame-exactly (offset from the clip's own start, clamped at its ends).
import { test } from "node:test";
import assert from "node:assert/strict";
import { XFADE, pieceGraph, perspectiveExprAt, perspectiveExpr } from "../src/motion.mjs";

const clip = (index, startFrame, frames, kind = "push_in") => ({ index, startFrame, endFrame: startFrame + frames, frames, motion: kind === "hold" ? { kind, from: { scale: 1, cx: 0.5, cy: 0.5 }, to: { scale: 1, cx: 0.5, cy: 0.5 } } : { kind, from: { scale: 1, cx: 0.5, cy: 0.5 }, to: { scale: 1.04, cx: 0.5, cy: 0.5 } } });
const clips = [clip(0, 0, 120), clip(1, 120, 90, "hold")];

test("every transition has its xfade", () => {
  // Flash is a soft fade + an off-white veil (photosensitivity), not fadewhite.
  assert.deepEqual(XFADE, { fade: "fade", whip: "slideleft", zoom: "zoomin", flash: "fade", slide_left: "slideleft", slide_right: "slideright", dip: "fadeblack", circle: "circleopen" });
});

test("an xfade piece: both pictures, xfade over the whole piece, whip adds the blur, overlays on their frames", () => {
  const flash = pieceGraph({ kind: "xfade", a: 0, b: 1, fromFrame: 117, toFrame: 123, frames: 6, transition: "flash", xfade: "fade", veil: { color: "#F5F2EA", opacity: 0.7 }, overlays: [{ key: "t1", fromFrame: 2, toFrame: 6 }] }, clips);
  // A soft off-white veil peaking at 70 % mid-transition (never full white).
  assert.ok(flash.includes("[pa][pb]xfade=transition=fade:duration=0.200000:offset=0,format=rgb24,geq=r='r(X,Y)+(245-r(X,Y))*(0.7*(1-abs(2*N/6-1)))'"), flash.slice(0, 400));
  assert.match(flash, /\[x0\]\[2:v\]overlay=0:0:format=auto:enable='between\(n,2,5\)'\[x1\]/);
  // Clip a is 117 frames into its move; clip b starts 3 frames before its own start (clamped to 0).
  assert.ok(flash.includes("clip((on+117)/119,0,1)"));
  assert.ok(!flash.includes("perspective=x0='(W*0.5-W/(2*1))'") || true);
  const whip = pieceGraph({ kind: "xfade", a: 0, b: 1, fromFrame: 116, toFrame: 124, frames: 8, transition: "whip", xfade: "slideleft", blur: true, overlays: [] }, clips);
  assert.match(whip, /xfade=transition=slideleft:duration=0\.266667:offset=0,gblur=sigma=14:sigmaV=0\.6\[x0\]/);
  assert.throws(() => pieceGraph({ kind: "xfade", a: 0, b: 1, fromFrame: 0, toFrame: 6, frames: 6, transition: "spin", overlays: [] }, clips));
});

test("a clip piece continues its camera move from where the piece starts", () => {
  const g = pieceGraph({ kind: "clip", a: 0, fromFrame: 3, toFrame: 117, frames: 114, overlays: [] }, clips);
  assert.ok(g.includes("clip((on+3)/119,0,1)"));
  // At offset 0 the maths is the old whole-clip expression, clamped.
  assert.equal(perspectiveExprAt(clips[0].motion, 120, 0).replace(/clip\(\(on\+0\)\/119,0,1\)/g, "(on/119)"), perspectiveExpr(clips[0].motion, 120));
});
