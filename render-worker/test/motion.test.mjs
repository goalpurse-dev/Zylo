import test from "node:test";
import assert from "node:assert/strict";
import { clipGraph, perspectiveExpr } from "../src/motion.mjs";

const edl = { width: 1920, height: 1080, fps: 30 };
const hold = { kind: "hold", from: { scale: 1, cx: 0.5, cy: 0.5 }, to: { scale: 1, cx: 0.5, cy: 0.5 } };
const push = { kind: "push_in", from: { scale: 1, cx: 0.5, cy: 0.5 }, to: { scale: 1.03, cx: 0.5, cy: 0.5 } };

test("hold clips are a plain scale (no perspective); moving clips use sub-pixel perspective with cubic interpolation", () => {
  assert.ok(!clipGraph({ motion: hold, frames: 90 }, edl).includes("perspective"));
  const g = clipGraph({ motion: push, frames: 90 }, edl);
  assert.ok(g.includes("perspective=x0=") && g.includes("interpolation=cubic:eval=frame"));
  assert.ok(g.endsWith("[v]"));
});

test("the text layer is overlaid AFTER the motion, so the text never moves", () => {
  const g = clipGraph({ motion: push, frames: 90, overlayImage: "ovl.png" }, edl);
  assert.ok(g.indexOf("perspective") < g.indexOf("[bg][1:v]overlay=0:0"));
});

test("a push-in's view rectangle is the full frame at frame 0 and 1/1.03 of it at the last frame", () => {
  const e = perspectiveExpr(push, 91);
  const x0 = (on) => Function("W", "on", `return ${e.match(/x0='([^']+)'/)[1]}`)(1920, on);
  assert.ok(Math.abs(x0(0)) < 1e-9);
  assert.ok(Math.abs(x0(90) - (960 - 1920 / (2 * 1.03))) < 1e-9);
});

test("Phase 5c master: crop the FULL-RES source to 16:9 at native size, move there, ONE Lanczos scale to 2560x1440 — never upsampled past real pixels", async () => {
  const { PROFILES, crop169 } = await import("../src/motion.mjs");
  const c = crop169(2752, 1536);
  assert.deepEqual(c, { cw: 2730, ch: 1536, x: 11, y: 0 });
  const push6 = { kind: "push_in", from: { scale: 1, cx: 0.5, cy: 0.5 }, to: { scale: 1.06, cx: 0.5, cy: 0.5 } };
  const g = clipGraph({ motion: push6, frames: 180, masterSize: { width: 2752, height: 1536 } }, { width: 1920, height: 1080 }, PROFILES.master);
  assert.ok(g.startsWith("[0:v]crop=2730:1536:11:0,format=gbrp,perspective="));
  assert.ok(g.includes(",scale=2560:1440:flags=lanczos"));
  // At the tightest zoom the view is still wider than the output: downscale only.
  assert.ok(c.cw / 1.06 >= PROFILES.master.width);
  assert.ok(PROFILES.master.x264.join(" ").includes("-crf 18"));
});
