// MISSING PLACES (owner 2026-11-16): a place the script names that the library lacks (the hill) is built simply in a host
// library place; never replaced by an unrelated one (the plane for "Zs poking through the clouds"). Free.
import test from "node:test";
import assert from "node:assert/strict";
import { PLACE_BUILDS, placeBuildsIn, unrelatedPlace, EXOTIC } from "../supabase/functions/_shared/blockyWorlds/placeBuilds.js";
import { autoScenePlan } from "../supabase/functions/_shared/blockyWorlds/scenePlan.js";
import { pickLocation, locationById } from "../supabase/functions/_shared/blockyWorlds/locations.js";
import { actionPlanProblems, planLines } from "../scripts/blockyWorlds/blenderKit/director.mjs";
import { cleanScenes, notesBrief } from "../scripts/blockyWorlds/blenderKit/notes.mjs";

const YAWN = ["And I just yawned the mayor asleep on her own hill!", "Nappers sleep on the hill.", "Then there's me, Kestrel, with nine giant Zs poking through the clouds.", "Birdie and the Nappers rolled our brass bell up the hill.", "I climbed past snoring Wakers, all the way up."];

test("every missing place has a library host and a simple recipe from the existing helpers", () => {
  for (const b of PLACE_BUILDS) {
    assert.ok(locationById(b.host), `${b.id}: host ${b.host}`);
    assert.ok(b.recipe.length > 40 && b.words.includes(b.id), b.id);
  }
  assert.deepEqual(placeBuildsIn("Grandpa rolled downhill").map((b) => b.id), ["hill"]);
  assert.deepEqual(placeBuildsIn("the hilltop and the river").map((b) => b.id), ["hill", "river"]);
  assert.deepEqual(placeBuildsIn("I chill"), []);
  assert.match(PLACE_BUILDS.find((b) => b.id === "hill").recipe, /grassy HILL.*PATH.*trees.*town street below/s);
});

test("the scene-plan picker: the hill goes to its host, the clouds never to a plane", () => {
  assert.equal(pickLocation("Nappers sleep on the hill."), "downtown_landmark");
  assert.notEqual(pickLocation("nine giant Zs poking through the clouds"), "sky_airliner");
  assert.equal(pickLocation("our airplane was flying high in the sky"), "sky_airliner");
  const plan = autoScenePlan(YAWN.map((text) => ({ text })));
  assert.ok(plan.scenes.every((s) => s.location !== "sky_airliner"), JSON.stringify(plan.scenes));
  assert.equal(plan.scenes[0].location, "downtown_landmark");
});

test("unrelated places: a plane / the moon only on a line that names them", () => {
  assert.equal(unrelatedPlace("sky_airliner", "Zs poking through the clouds"), true);
  assert.equal(unrelatedPlace("sky_airliner", "our plane dropped"), false);
  assert.equal(unrelatedPlace("moon", "a rocket to the moon"), false);
  assert.equal(unrelatedPlace("downtown_street", "anything"), false);
  assert.ok(Object.keys(EXOTIC).every((k) => locationById(k)));
});

test("the free plan check: the hill must be shown on its lines, a plane for the clouds is blocked", () => {
  const lineOf = YAWN.map((_, i) => i);
  const L = (shots) => planLines(shots, lineOf, YAWN.map((text) => ({ text })));
  const bad = [
    { id: 1, w0: 0, desc: "Kestrel yawns, the mayor flops asleep", location: "downtown_landmark" },
    { id: 2, w0: 1, desc: "Nappers snoring on pillows", location: "downtown_plaza" },
    { id: 3, w0: 2, desc: "a plane flying over the clouds, Kestrel waves", location: "sky_airliner" },
    { id: 4, w0: 3, desc: "Birdie pushes the bell", location: "downtown_landmark" },
    { id: 5, w0: 4, desc: "Kestrel climbs past snoring Wakers", location: "downtown_landmark" },
  ];
  const p = actionPlanProblems({ shots: bad, style_sheet: [{ name: "Kestrel", role: "", hero: true }, { name: "Birdie", role: "the mayor" }] }, L(bad));
  assert.ok(p.some((x) => /line L0 names the hill .*BUILD it in downtown_landmark/.test(x)), p.join("\n"));
  assert.ok(p.some((x) => /line L1 names the hill/.test(x)));
  assert.ok(p.some((x) => /shot 3 is in sky_airliner .*UNRELATED/.test(x)));
  const good = bad.map((s) => ({ ...s, ...(s.id === 3 ? { desc: "Kestrel with a tower of nine Zs reaching the clouds", location: "downtown_street" } : {}), ...([1, 2, 4].includes(s.id) ? { desc: `${s.desc} on the grassy hill` } : {}) }));
  assert.deepEqual(actionPlanProblems({ shots: good, style_sheet: [{ name: "Kestrel", role: "", hero: true }, { name: "Birdie", role: "the mayor" }] }, L(good)).filter((x) => /hill|UNRELATED/.test(x)), []);
});

test("the auto notes: missing places with their recipes; the scene cleaner swaps an unrelated plane for the right place", () => {
  const b = notesBrief({ card: {}, script: { lines: YAWN.map((text) => ({ text })) }, locations: [] });
  assert.match(b, /MISSING PLACES[\s\S]*- hill -> in downtown_landmark: a grassy HILL/);
  const ids = new Set(["downtown_landmark", "downtown_street", "sky_airliner"]);
  const c = cleanScenes([{ from: 0, to: 1, location: "downtown_landmark" }, { from: 2, to: 2, location: "sky_airliner" }, { from: 3, to: 4, location: "downtown_landmark" }], 5, ids, YAWN);
  assert.deepEqual(c.scenes.map((s) => s.location), ["downtown_landmark"]);
  assert.deepEqual(c.scenes[0].lines, [0, 4]);
});
