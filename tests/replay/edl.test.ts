// Phase 5a — the EDL: frame-accurate hard cuts from absolute ms, motion defaults.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildEdl, validateEdl, motionFor, msToFrame, cameraAt } from "../../supabase/functions/_shared/stickman/edl.ts";

const plan = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/myth-vs-reality.phase4c3.json", import.meta.url)));
const edl = buildEdl({ beats: plan.beats, audio: { path: "a.mp3", durationMs: 523416 }, imageFor: (s) => ({ image: `b${s}.jpg`, overlay: null }) });

Deno.test("EDL: one clip per beat, contiguous frames 0..end of audio, every cut = round(beat start ms) — no drift", () => {
  assertEquals(edl.clips.length, plan.beats.length);
  assertEquals(validateEdl(edl), []);
  assertEquals(edl.totalFrames, msToFrame(523416));
  for (const [i, c] of edl.clips.entries()) if (i > 0) assertEquals(c.startFrame, Math.round((plan.beats[i].startMs * 30) / 1000));
  assertEquals(edl.clips[0].startFrame, 0);
  assertEquals(edl.clips.at(-1)!.endFrame, edl.totalFrames);
  assert(edl.clips.every((c) => c.transitionIn === "cut"));
});

Deno.test("EDL motion: subtle defaults from motionIntent (push 1.00->1.06, subtle 1.03, pan across a 1.06 frame, hold)", () => {
  assertEquals(motionFor("slow push-in", 0).to.scale, 1.06);
  assertEquals(motionFor("subtle push-in", 0).to.scale, 1.03);
  assertEquals(motionFor("slow pull-back", 0).from.scale, 1.06);
  assertEquals(motionFor("hold", 0).kind, "hold");
  assertEquals(motionFor(undefined, 0).kind, "hold");
  const a = motionFor("slow pan", 0), b = motionFor("slow pan", 1);
  assert(a.from.cx < a.to.cx && b.from.cx > b.to.cx, "consecutive pans alternate direction");
  // The view never leaves the image: at scale s the centre stays within [1/(2s), 1-1/(2s)].
  for (const k of [0, 50, 99]) { const s = cameraAt(a, k, 100); assert(s.cx - 1 / (2 * s.scale) >= -1e-9 && s.cx + 1 / (2 * s.scale) <= 1 + 1e-9); }
});

Deno.test("Phase 5b motion: constant speed ~1%/s capped at 6%; overlay beats hold or push <= 2%, never pan", async () => {
  const { MOTION_MAX } = await import("../../supabase/functions/_shared/stickman/edl.ts");
  assertEquals(motionFor("slow push-in", 0, { durationMs: 2000 }).to.scale, 1.02);
  assertEquals(motionFor("slow push-in", 0, { durationMs: 9000 }).to.scale, 1 + MOTION_MAX);
  assertEquals(motionFor("subtle push-in", 0, { durationMs: 4000 }).to.scale, 1.02);
  const panOverlay = motionFor("slow pan", 0, { durationMs: 5000, hasOverlay: true });
  assertEquals(panOverlay.kind, "push_in");
  assert(panOverlay.to.scale <= 1.02);
  assert(motionFor("slow push-in", 0, { durationMs: 6000, hasOverlay: true }).to.scale <= 1.02);
  // Speed is the same for short and long clips (per second), until the cap.
  const speed = (ms: number) => (motionFor("slow push-in", 0, { durationMs: ms }).to.scale - 1) / (ms / 1000);
  assert(Math.abs(speed(2000) - speed(5000)) < 1e-9);
  for (const c of edl.clips) if (c.overlay) assert(c.motion.kind !== "pan");
});

Deno.test("Phase 5b integrity: a clip on a superseded image (or with no id/hash) blocks the render", async () => {
  const { checkImageIntegrity } = await import("../../supabase/functions/_shared/stickman/edl.ts");
  const v = (seq: number, id: string, at: string, approved = true) => ({ beatSequence: seq, versionId: id, path: `${id}.jpg`, sha256: `h-${id}`, approved, createdAt: at });
  const versions = [v(1, "a1", "2026-09-01"), v(1, "a2", "2026-09-02"), v(2, "b1", "2026-09-01"), v(2, "b2", "2026-09-03", false)];
  const two = (a: any, b: any) => ({ ...edl, clips: [{ ...edl.clips[0], ...a }, { ...edl.clips[1], ...b }] });
  assertEquals(checkImageIntegrity(two({ beatSequence: 1, imageVersionId: "a2", imageSha256: "h-a2" }, { beatSequence: 2, imageVersionId: "b1", imageSha256: "h-b1" }), versions), [], "newest APPROVED wins (b2 is not approved)");
  const bad = checkImageIntegrity(two({ beatSequence: 1, imageVersionId: "a1", imageSha256: "h-a1" }, { beatSequence: 2 }), versions);
  assertEquals(checkImageIntegrity(two({ beatSequence: 1, imageVersionId: "a2", imageSha256: "wrong" }, { beatSequence: 2, imageVersionId: "b1", imageSha256: "h-b1" }), versions), ["beat 1: image hash mismatch"]);
  assert(bad[0].includes("superseded image a1 (newest a2)"), bad.join("; "));
  assert(bad[1].includes("no image id/hash"), bad.join("; "));
});

Deno.test("Phase 5b: the render worker's motion code is identical to the EDL's (no drift between Deno and the Node container)", async () => {
  const { perspectiveExpr } = await import("../../supabase/functions/_shared/stickman/edl.ts");
  const worker = await import("../../render-worker/src/motion.mjs");
  for (const [cam, ms, ov] of [["slow push-in", 3000, false], ["slow pan", 5000, false], ["slow pan", 5000, true], ["slow pull-back", 7000, false], ["hold", 3000, false]] as const) {
    const m = motionFor(cam, 1, { durationMs: ms, hasOverlay: ov });
    assertEquals(worker.perspectiveExpr(m, 120), perspectiveExpr(m, 120));
  }
});
