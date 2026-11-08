// Scene language v2 phase 2: the world generators (kit/terrain.js, kit/water.js, ...), their pure parts, and the test
// cases in scripts/cutaway/proto3d/m3/testcases (the stills are checked by eye; here: they validate and frame).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { terrainModel, terrainBox, bandSurface, holeEdge, WORLD } from "../scripts/cutaway/proto3d/kit/terrain.js";
import { waterSpec, waterBox } from "../scripts/cutaway/proto3d/kit/water.js";
import { validateScene } from "../scripts/cutaway/proto3d/m2/language.js";
import { focusOf } from "../scripts/cutaway/proto3d/m2/focus.js";
import { KINDS, KIND_CHANNELS } from "../scripts/cutaway/proto3d/m2/parts.js";
import { VERBS } from "../scripts/cutaway/proto3d/m2/verbs.js";

const TC = new URL("../scripts/cutaway/proto3d/m3/testcases/", import.meta.url);

test("terrain: each block shapes the surface and the face", () => {
  const T = terrainModel({ blocks: [{ type: "cliff", at: 0, top: 6, bottom: 0, high: "left" }, { type: "gorge", x0: 8, x1: 14, depth: 5 }, { type: "pit", x0: -10, x1: -6, z0: -4, depth: 3 }, { type: "tunnel", x0: -20, x1: 20, y: -12, r: 1.5 }] });
  assert.ok(Math.abs(T.h(-5, -3) - 6) < 0.01 && Math.abs(T.h(5, -3)) < 0.01, "the cliff: high on the left, low on the right");
  assert.ok(T.h(11, -3) < -4.5, "the gorge floor is its depth down");
  assert.ok(Math.abs(T.top(-8) - 3) < 0.01, "a pit lowers the face's top edge by its depth");
  assert.ok(!T.inside(0, -12) && T.inside(0, -14), "the tunnel is a hole in the face, the soil under it is not");
  const M = terrainModel({ blocks: [{ type: "mountain", at: 0, height: 10, width: 20, crater: { r: 2, depth: 1.5 }, chamber: { y: -8, rx: 3, ry: 2 } }] });
  assert.ok(M.h(0, 0) < M.h(2.5, 0) && M.h(2.5, 0) > 7, "the crater is a bowl in the peak");
  assert.ok(!M.inside(0, -8) && M.holes.some((o) => o.vent), "the chamber and its vent are holes in the face");
  assert.ok(M.rockAt(0, -2) && !M.rockAt(15, -2), "rock on the mountain's upper slopes only");
});

test("terrain: a full-width block has no drop at the world's edge; a coast's seabed is sand", () => {
  const T = terrainModel({ blocks: [{ type: "flat", x0: -24, x1: 24, y: 2 }] });
  assert.equal(T.h(40, -3), 2);
  const C = terrainModel({ blocks: [{ type: "coast", at: 3, sea: "right", beach: 4, depth: 8 }] });
  assert.ok(C.sandy.some(([a, b]) => a <= 20 && b >= 60), "the whole sea side is sand");
  assert.ok(C.h(20, -3) < -7, "the seabed shelves down to its depth");
});

test("terrain: the soil bands cut through a gorge but arch under a mountain", () => {
  const G = bandSurface(terrainModel({ blocks: [{ type: "gorge", x0: -6, x1: 6, depth: 10 }] }), 97);
  assert.ok(Math.abs(G[48]) < 0.2, "over the gorge the band surface stays at the plateau (a closing)");
  const M = bandSurface(terrainModel({ blocks: [{ type: "mountain", at: 0, height: 10, width: 30 }] }), 97);
  assert.ok(M[48] > 8, "under a mountain the bands follow its shape");
});

test("terrain: holes snap to their edge, boxes frame the section", () => {
  const [ex, ey] = holeEdge({ type: "chamber", x: 0, y: 0, rx: 4, ry: 2 }, 3.9, 0.1);
  assert.ok(Math.abs((ex / 4) ** 2 + (ey / 2) ** 2 - 1) < 1e-6);
  const b = terrainBox({ blocks: [{ type: "mountain", at: 0, height: 10, width: 20, chamber: { y: -8, rx: 3, ry: 2 } }] });
  assert.ok(b.max[1] >= 9.5 && b.min[1] <= -10, `it holds the peak and the chamber: ${JSON.stringify(b)}`);
  assert.ok(b.min[0] >= -WORLD.X && b.max[0] <= WORLD.X);
});

test("water: the sea reaches the horizon; its box is its section", () => {
  const s = waterSpec({ body: "sea", x0: 2, x1: 24, level: -0.6 });
  assert.equal(s.x1, WORLD.FAR); assert.equal(s.waves, true);
  const b = waterBox({ body: "river", x0: -5, x1: 5, level: -0.6 }, { blocks: [{ type: "riverbed", x0: -5, x1: 5, depth: 3 }] });
  assert.ok(b.min[1] < -3 && b.max[1] > -0.6, JSON.stringify(b));
});

test("the generator kinds are registered: builder, channels, verbs, camera box", () => {
  for (const k of ["terrain", "waterBody"]) { assert.ok(KINDS[k], k); assert.ok(KIND_CHANNELS[k]?.length, k); assert.ok(VERBS[k], k); }
  for (const v of Object.values(VERBS.waterBody)) for (const r of v) assert.ok(KIND_CHANNELS.waterBody.includes(r.c), r.c);
  assert.ok(focusOf({ id: "w", kind: "waterBody", params: { x0: -3, x1: 3, level: -1 } }));
});

test("the generator test cases validate", () => {
  for (const f of fs.readdirSync(TC).filter((x) => x.endsWith(".json"))) {
    const L = JSON.parse(fs.readFileSync(new URL(f, TC), "utf8")).layout;
    assert.deepEqual(validateScene(L), [], f);
  }
});

test("building: floors stack, shafts cut their slabs, the box holds the roof", async () => {
  const { buildingSpec, slabHoles, buildingBox } = await import("../scripts/cutaway/proto3d/kit/buildings.js");
  const p = { pos: [0, 0, -1], width: 16, depth: 7, floors: [{ h: 4.5 }, { h: 4.5 }], roof: "gable", shafts: [{ type: "escalator", x: -2, w: 7, from: 0, to: 1, z: -3 }, { type: "elevator", x: 5.5, w: 2.2 }] };
  const s = buildingSpec(p);
  assert.deepEqual(s.bases, [0, 4.5]); assert.equal(s.top, 9);
  assert.equal(s.shafts[0].z, -4, "a shaft's z is from the building's front");
  const h = slabHoles(s);
  assert.equal(h.length, 2); assert.ok(h.every((o) => o.floor === 1));
  const esc = h[0]; assert.ok(esc.x1 >= -2 + 3.5 && esc.x0 > -5.5, "the escalator's opening is at its upper end (headroom)");
  assert.ok(buildingBox(p).max[1] > 9, "a gable roof rises above the top floor");
});
