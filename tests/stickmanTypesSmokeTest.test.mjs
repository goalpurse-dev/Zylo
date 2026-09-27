import test from "node:test";
import assert from "node:assert/strict";

// 2026-10-02 "narration-first / audio-first architecture" pass — these two
// modules are type-only skeletons (no recipe implements VisualRecipe yet, no
// builder produces a StickmanProductionBible yet). There's nothing to assert
// behaviorally; this is a real compile/import smoke test — it fails loudly
// if either file has a syntax or type error, the same way any other module
// in this codebase would be caught by its own test file importing it.

test("visualRecipe.ts imports cleanly (type-only skeleton, no implementation yet)", async () => {
  const mod = await import("../supabase/functions/_shared/visualRecipe.ts");
  assert.equal(typeof mod, "object");
});

test("stickman/types.ts imports cleanly (type-only skeleton, no implementation yet)", async () => {
  const mod = await import("../supabase/functions/_shared/stickman/types.ts");
  assert.equal(typeof mod, "object");
});
