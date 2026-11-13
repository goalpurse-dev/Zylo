// node --test scripts/blockyWorlds/blenderKit/workerSteps.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { pickSteps } from "./workerSteps.mjs";

const studio = { name: "studio" }, blender = { name: "blender" };
const run = (user_id) => ({ id: "r1", user_id });

test("off by default: no setting -> Studio for everyone, the owner too", () => {
  assert.equal(pickSteps(run("owner-1"), { studio, blender, env: {} }), studio);
  assert.equal(pickSteps(run("owner-1"), { studio, blender, env: { BLOCKY_WORLDS_BLENDER_OWNER_IDS: "owner-1" } }), studio);
});

test("the engine switch alone is not enough: no owner list -> Studio", () => {
  assert.equal(pickSteps(run("owner-1"), { studio, blender, env: { BLOCKY_WORLDS_RENDER_ENGINE: "blender" } }), studio);
});

test("switch + owner list: only the listed owners get Blender", () => {
  const env = { BLOCKY_WORLDS_RENDER_ENGINE: " Blender ", BLOCKY_WORLDS_BLENDER_OWNER_IDS: "owner-1, owner-2" };
  assert.equal(pickSteps(run("owner-1"), { studio, blender, env }), blender);
  assert.equal(pickSteps(run("owner-2"), { studio, blender, env }), blender);
  assert.equal(pickSteps(run("customer-9"), { studio, blender, env }), studio);
  assert.equal(pickSteps(run(null), { studio, blender, env }), studio);
  assert.equal(pickSteps(run(""), { studio, blender, env: { ...env, BLOCKY_WORLDS_BLENDER_OWNER_IDS: "," } }), studio);
});

test("any other engine value keeps Studio", () => {
  assert.equal(pickSteps(run("owner-1"), { studio, blender, env: { BLOCKY_WORLDS_RENDER_ENGINE: "studio", BLOCKY_WORLDS_BLENDER_OWNER_IDS: "owner-1" } }), studio);
});
