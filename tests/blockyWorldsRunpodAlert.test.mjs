// RunPod low-balance alert for the Blender engine (2026-11-15): with BLOCKY_WORLDS_RENDER_ENGINE=blender a balance under
// BLENDER_FLOOR_USD is red (an instant alert) even while Blocky Worlds is owner-only; off: unchanged (shown, never red)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLENDER_FLOOR_USD, blenderOnFrom, instantAlerts, judge, servicesFor } from "../supabase/functions/_shared/opsHealth.js";

const rp = (opts) => servicesFor(opts).find((s) => s.id === "runpod");
const state = (balance) => ({ reachable: true, balance, unit: "usd", perDay: 0.2 });

test("the switch reads the engine secret", () => {
  assert.equal(blenderOnFrom("blender"), true);
  assert.equal(blenderOnFrom(" Blender "), true);
  assert.equal(blenderOnFrom("studio"), false);
  assert.equal(blenderOnFrom(undefined), false);
});

test("Blender off: owner-only RunPod stays never-red (as before)", () => {
  const s = rp({});
  assert.equal(s.ownerOnly, true);
  assert.equal(s.ownerFloorUsd, undefined);
  const j = judge(s, state(4));
  assert.deepEqual(j.red, []);
  assert.ok(j.info.length, "shown as info");
});

test("Blender on: under the floor is red and becomes an instant alert; above it is fine", () => {
  const s = rp({ blenderOn: true });
  assert.equal(s.ownerFloorUsd, BLENDER_FLOOR_USD);
  assert.match(s.does, /sp338bavcw2gtn/);
  const low = judge(s, state(BLENDER_FLOOR_USD - 3));
  assert.ok(low.red.some((x) => x.includes(`$${BLENDER_FLOOR_USD}`)), JSON.stringify(low));
  assert.equal(instantAlerts([{ service: s, state: state(BLENDER_FLOOR_USD - 3), judged: low }]).length, 1);
  assert.deepEqual(judge(s, state(BLENDER_FLOOR_USD + 40)).red, []);
});

test("Blocky Worlds open to users: red as before, with the higher floor when Blender is on", () => {
  assert.equal(rp({ runpodLive: true }).ownerOnly, false);
  assert.equal(rp({ runpodLive: true }).minBalanceUsd, 10);
  assert.equal(rp({ runpodLive: true, blenderOn: true }).minBalanceUsd, BLENDER_FLOOR_USD);
});

test("ops-health passes the engine switch to servicesFor", () => {
  const src = readFileSync(new URL("../supabase/functions/ops-health/index.ts", import.meta.url), "utf8");
  assert.match(src, /blenderOn: blenderOnFrom\(env\("BLOCKY_WORLDS_RENDER_ENGINE"\)\)/);
});
