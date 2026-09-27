import test from "node:test";
import assert from "node:assert/strict";
import { authorizeCompiledScenesForDispatch } from "../supabase/functions/_shared/sceneGenerationAuthorization.ts";

// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass
// — §9/§10: this is the ONLY place allowed to flip a compiled
// 'awaiting_generation' scene to the claimable 'pending' status, and it must
// do so EXACTLY for the beats a real charge covers, never more, never
// resetting anything already past that point, and never proceeding at all
// against a charge that isn't currently 'charged' and unpaused.

// Minimal per-table fake admin, same lightweight convention as
// narrationContractMandatoryV1.test.mjs's own fakeAdmin — tailored to the
// specific chain shapes authorizeCompiledScenesForDispatch actually calls.
function fakeAdmin({ charge, plans = [], scenesByPlanId = {} }) {
  const updates = [];
  const from = (table) => {
    if (table === "long_form_episode_generation_charges") {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: charge ?? null, error: null }) }) }) };
    }
    if (table === "long_form_scene_render_plans") {
      return { select: () => ({ eq: () => ({ in: async () => ({ data: plans, error: null }) }) }) };
    }
    if (table === "long_form_scenes") {
      return {
        select: () => ({ eq: (_col, planId) => ({ is: () => ({ maybeSingle: async () => ({ data: scenesByPlanId[planId] ?? null, error: null }) }) }) }),
        update: (patch) => ({
          eq: (_c1, sceneId) => ({
            eq: async (_c2, expectedStatus) => {
              updates.push({ sceneId, patch, expectedStatus });
              return { error: null };
            },
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  };
  return { admin: { from }, updates };
}

test("refuses to authorize anything when the charge is not status='charged' — never touches a scene row", async () => {
  const { admin, updates } = fakeAdmin({ charge: { status: "refunded", is_paused: false }, plans: [{ id: "p1", visual_beat_id: "b1" }] });
  const result = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: "w1", beatIds: ["b1"], generationRunId: "run1" });
  assert.deepEqual(result.authorized, []);
  assert.deepEqual(result.skipped, [{ beatId: "b1", reason: "GENERATION_RUN_NOT_CHARGED" }]);
  assert.equal(updates.length, 0);
});

test("refuses to authorize anything when the charge is currently paused, even if status='charged'", async () => {
  const { admin, updates } = fakeAdmin({ charge: { status: "charged", is_paused: true } });
  const result = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: "w1", beatIds: ["b1"], generationRunId: "run1" });
  assert.deepEqual(result.skipped, [{ beatId: "b1", reason: "GENERATION_RUN_NOT_CHARGED" }]);
  assert.equal(updates.length, 0);
});

test("flips exactly the awaiting_generation scenes for the given beatIds to pending, stamping generation_run_id", async () => {
  const { admin, updates } = fakeAdmin({
    charge: { status: "charged", is_paused: false },
    plans: [{ id: "p1", visual_beat_id: "b1" }, { id: "p2", visual_beat_id: "b2" }],
    scenesByPlanId: { p1: { id: "s1", status: "awaiting_generation" }, p2: { id: "s2", status: "awaiting_generation" } },
  });
  const result = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: "w1", beatIds: ["b1", "b2"], generationRunId: "run1" });
  assert.deepEqual(result.authorized.sort(), ["b1", "b2"]);
  assert.equal(updates.length, 2);
  for (const u of updates) {
    assert.equal(u.patch.status, "pending");
    assert.equal(u.patch.generation_run_id, "run1");
    assert.equal(u.expectedStatus, "awaiting_generation");
  }
});

test("a beat not yet compiled (no render plan row) is reported skipped/NOT_COMPILED_YET, never treated as an error that stops the others", async () => {
  const { admin } = fakeAdmin({
    charge: { status: "charged", is_paused: false },
    plans: [{ id: "p1", visual_beat_id: "b1" }],
    scenesByPlanId: { p1: { id: "s1", status: "awaiting_generation" } },
  });
  const result = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: "w1", beatIds: ["b1", "b_not_compiled"], generationRunId: "run1" });
  assert.deepEqual(result.authorized, ["b1"]);
  assert.deepEqual(result.skipped, [{ beatId: "b_not_compiled", reason: "NOT_COMPILED_YET" }]);
});

test("idempotent: a scene already moved past awaiting_generation (pending/succeeded/etc) is reported alreadyAuthorized, never reset", async () => {
  const { admin, updates } = fakeAdmin({
    charge: { status: "charged", is_paused: false },
    plans: [{ id: "p1", visual_beat_id: "b1" }, { id: "p2", visual_beat_id: "b2" }],
    scenesByPlanId: { p1: { id: "s1", status: "succeeded" }, p2: { id: "s2", status: "pending" } },
  });
  const result = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: "w1", beatIds: ["b1", "b2"], generationRunId: "run1" });
  assert.deepEqual(result.authorized, []);
  assert.deepEqual(result.alreadyAuthorized.sort(), ["b1", "b2"]);
  assert.equal(updates.length, 0, "an already-progressed scene must never be written to");
});

test("an empty beatIds list is a safe no-op — never queries the charge or any table", async () => {
  let chargeQueried = false;
  const admin = { from: (table) => { if (table === "long_form_episode_generation_charges") chargeQueried = true; return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }; } };
  const result = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: "w1", beatIds: [], generationRunId: "run1" });
  assert.deepEqual(result, { authorized: [], alreadyAuthorized: [], skipped: [] });
  assert.equal(chargeQueried, false);
});
