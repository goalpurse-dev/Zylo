// node --test scripts/blockyWorlds/blenderKit/actions/actions.test.mjs   (free: geometry + static checks, no render)
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ZX_CATCH, ZX_KNEEL, catchPlan, catchSpots, ACTIONS, NEXT_ACTIONS, actionDocs, actionsSource, ACTIONS_PY } from "./actions.mjs";
import { clearRayProblem, cameraWallProblem } from "../director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = (code) => spawnSync("python", ["-I", "-c", code], { encoding: "utf8" });

test("actions.py and actions.mjs share the same numbers and the same catch geometry", () => {
  const src = actionsSource();
  for (const [k, v] of Object.entries(ZX_CATCH)) assert.match(src, new RegExp(`"${k}": ${v.toFixed(1)}`), `ZX_CATCH.${k}`);
  for (const [k, v] of Object.entries(ZX_KNEEL)) assert.match(src, new RegExp(`"${k}": ${v}`), `ZX_KNEEL.${k}`);
  const r = py(`import math, random, json\nexec(open(${JSON.stringify(ACTIONS_PY)}, encoding="utf8").read())\np = zx_catch_plan(7.0)\nprint(json.dumps({"theta": p["theta"], "edge_y": p["edge_y"], "root": p["root"], "hand_top": p["hand_top"]}))`);
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout), j = catchPlan(7);
  assert.ok(Math.abs(p.theta - j.theta) < 1e-6 && Math.abs(p.edge_y - j.edgeY) < 1e-6 && Math.abs(p.root[1] - j.root[1]) < 1e-6);
});

test("the catch: the building stops resting on the kneeling giant's hands, low over the street, the giant in the open street", () => {
  const p = catchPlan(7);
  assert.ok(p.theta > 55 && p.theta < 75, `theta ${p.theta}`);
  assert.ok(p.handTop < 12, `the caught edge is low: ${p.handTop}`); // a little over a kid's height (5.2): the crowd runs under it
  const [x, y] = p.root;
  assert.ok(Math.abs(x) < 4 && y > 130 && y < 150, `root ${p.root}`);
  assert.equal(cameraWallProblem("downtown_landmark", [x, y, 1]), "");
});

test("every catch spot stands in open space, sees its target along a clear line, and stays out of the kneeling giant", () => {
  const p = catchPlan(7), s = p.size, [rx, ry] = p.root;
  // the kneeling giant's box: arms out to x +-2.1 s, from the legs (2.5 s behind) to the hands (fwd + 0.5 s), up to the head
  const inGiant = ([x, y, z]) => Math.abs(x - rx) < 2.1 * s && y > ry - 2.5 * s && y < ry + 1.55 * s + 0.5 * s && z < 4.2 * s;
  for (const [name, [loc, tgt]] of Object.entries(catchSpots(p))) {
    assert.equal(cameraWallProblem("downtown_landmark", loc), "", `${name} camera in a wall`);
    assert.equal(clearRayProblem("downtown_landmark", loc, tgt), "", `${name} line blocked`);
    // "door" films the cheer: the giant STANDS then (arms down): the standing box (x +-1.6 s, y +-1.0 s)
    const inside = name === "door" ? Math.abs(loc[0] - rx) < 1.6 * s && Math.abs(loc[1] - ry) < 1.0 * s : inGiant(loc);
    assert.equal(inside, false, `${name} camera inside the giant`);
  }
});

test("the static check passes actions.py (no imports, no banned names) and the catalog / docs are complete", () => {
  const r = spawnSync("python", ["-I", path.join(HERE, "..", "shotcheck.py"), ACTIONS_PY, "--json"], { encoding: "utf8" });
  const out = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(out.ok, true, JSON.stringify(out.problems));
  const c = ACTIONS.find((a) => a.id === "catch");
  assert.deepEqual(c.phases, ["tip", "fall", "catch", "strain", "set", "cheer"]);
  for (const sp of c.spots) assert.match(actionsSource(), new RegExp(`"${sp}"`));
  assert.match(actionDocs(), /zx_catch_plan/);
  assert.ok(NEXT_ACTIONS.length >= 6 && NEXT_ACTIONS.every((a) => a.effortH > 0 && a.stillsUsd > 0));
});

test("face_kneel looks down OVER the caught building's top corner (preview 2: a level camera had its band across the face)", () => {
  const p = catchPlan(7), a = (p.theta * Math.PI) / 180;
  // the bank's top-back corner (pivot-local y 14, z 27) at the catch angle
  const cy = ZX_CATCH.pivot_y + 14 * Math.cos(a) - 27 * Math.sin(a), cz = 14 * Math.sin(a) + 27 * Math.cos(a);
  const [loc, tgt] = catchSpots(p).face_kneel;
  const u = (cy - loc[1]) / (tgt[1] - loc[1]);
  assert.ok(u > 0 && u < 1, "the corner lies between the camera and the face");
  const z = loc[2] + (tgt[2] - loc[2]) * u;
  assert.ok(z > cz + 0.5, `the line passes ${(z - cz).toFixed(2)} over the corner`);
});
