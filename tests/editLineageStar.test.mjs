import test from "node:test";
import assert from "node:assert/strict";
import { resolveSourceBeatId } from "../supabase/functions/_shared/sceneRenderPlan.ts";

// Section 8/26 (G) of the "rebuild the Visual Director" pass (2026-09-15):
// "edit -> edit -> second edit re-anchors to generation root OR escalates."
// This locks in a finding already verified empirically against real Mars
// data in an earlier session (all 42 real EDIT scenes have chainDepth===1)
// as a genuine regression test: resolveSourceBeatId always anchors an
// EDIT/CROP/REUSE beat to the EARLIEST GENERATE beat sharing its
// baseSetupKey — NEVER to a prior EDIT — so a star (root -> many edits) is
// structurally the only shape possible; a chain (edit -> edit -> edit)
// cannot occur even if three consecutive beats all resolve to EDIT.

function beat(overrides) {
  return { id: "b", baseSetupKey: "setup1", sequenceIndex: 0, renderMethod: "GENERATE", ...overrides };
}

test("G: three consecutive EDIT beats sharing one baseSetupKey ALL resolve to the SAME root GENERATE beat, never chaining edit->edit->edit", () => {
  const allBeats = [
    beat({ id: "root", renderMethod: "GENERATE", sequenceIndex: 1 }),
    beat({ id: "edit1", renderMethod: "EDIT", sequenceIndex: 2 }),
    beat({ id: "edit2", renderMethod: "EDIT", sequenceIndex: 3 }),
    beat({ id: "edit3", renderMethod: "EDIT", sequenceIndex: 4 }),
  ];
  const source1 = resolveSourceBeatId(allBeats[1], allBeats);
  const source2 = resolveSourceBeatId(allBeats[2], allBeats);
  const source3 = resolveSourceBeatId(allBeats[3], allBeats);
  assert.equal(source1, "root");
  assert.equal(source2, "root", "edit2 must anchor to the ORIGINAL root, not to edit1 — this is the star shape, never a chain");
  assert.equal(source3, "root", "edit3 must ALSO anchor to the same original root");
});

test("a GENERATE beat has no source at all (it IS the root)", () => {
  const root = beat({ id: "root", renderMethod: "GENERATE" });
  assert.equal(resolveSourceBeatId(root, [root]), null);
});

test("a REUSE/CROP beat sharing the same baseSetupKey also anchors directly to the root GENERATE beat, never to an intervening EDIT", () => {
  const allBeats = [
    beat({ id: "root", renderMethod: "GENERATE", sequenceIndex: 1 }),
    beat({ id: "edit1", renderMethod: "EDIT", sequenceIndex: 2 }),
    beat({ id: "crop1", renderMethod: "CROP", sequenceIndex: 3 }),
    beat({ id: "reuse1", renderMethod: "REUSE", sequenceIndex: 4 }),
  ];
  assert.equal(resolveSourceBeatId(allBeats[2], allBeats), "root");
  assert.equal(resolveSourceBeatId(allBeats[3], allBeats), "root");
});

test("a beat with no baseSetupKey resolution possible (no GENERATE beat exists yet for this setup) throws a clear, named error rather than silently anchoring to nothing", () => {
  const allBeats = [beat({ id: "orphan_edit", renderMethod: "EDIT", baseSetupKey: "never_established", sequenceIndex: 1 })];
  assert.throws(() => resolveSourceBeatId(allBeats[0], allBeats), /NO_BASE_SETUP_FOUND/);
});
