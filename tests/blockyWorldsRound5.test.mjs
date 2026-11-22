// In This Town round 5 (owner 2026-11-22): objects big + held properly, crowds + traffic with logic, the weak shots.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compileScene } from "../scripts/blockyWorlds/blenderKit/cards.mjs";
import { PACE } from "../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { NARRATOR } from "../supabase/functions/_shared/blockyWorlds/config.js";

const C = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/crowds.py", "utf8");
const W = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/worlds.py", "utf8");

test("traffic: parked cars only in driveways / at the kerb, never in a driving lane; even gaps, one speed", () => {
  const roads = C.slice(C.indexOf("ZW_ROADS = {"), C.indexOf("ZW_CARCOL"));
  const lane = (axis, x, y) => (axis === "x" ? Math.abs(y) : Math.abs(x));
  const sub = [...roads.slice(roads.indexOf('"suburb"'), roads.indexOf('"downtown"')).matchAll(/\((-?[\d.]+), (-?[\d.]+), (-?\d+)\)/g)].map((m) => m.slice(1, 3).map(Number));
  const dt = [...roads.slice(roads.indexOf('"downtown"')).matchAll(/\((-?[\d.]+), (-?[\d.]+), (-?\d+)\)/g)].map((m) => m.slice(1, 3).map(Number));
  assert.ok(sub.length >= 4 && dt.length >= 4);
  for (const [x, y] of sub) assert.ok(lane("x", x, y) >= 6.2, `suburb parked (${x}, ${y}) is off the road (driveway)`);
  for (const [x, y] of dt) assert.ok(lane("y", x, y) >= 5.8, `downtown parked (${x}, ${y}) is at the kerb, not in a lane (3.5)`);
  assert.match(C, /zw_cars\(spots, t0, t1, speed=15\.0 if mode == "leaving" else 8\.0/, "one steady speed for everyone");
  assert.match(C, /gap = \(b - a\) \/ max\(1, per\)/, "evenly spaced in the lane");
  assert.match(W, /if ZW_CROWD_ON\[0\] and "busy" in dress and zw_traffic\(t0, t1\):/, "a world-state scene uses the traffic with logic");
});

test("crowds: one way per pavement, facing the way they walk, spread along the street, standers face something real, home at dusk", () => {
  assert.match(C, /lanes=\(\(8\.0, -1\), \(-8\.0, 1\)\)/, "suburb: one lane per pavement, one way each");
  assert.match(C, /face = zw_yaw_to\(sgn, 0\.0\) if ax == "x" else zw_yaw_to\(0\.0, sgn\)/, "facing the way they walk");
  assert.match(C, /seg = \(hi - lo\) \/ k/, "spread (stratified) along the street, not clumps");
  assert.match(C, /rot=\(0, 0, zw_yaw_to\(cx - px, cy - py\)\)/, "a circle faces its own middle");
  assert.match(C, /def zw_go_home\(/); assert.match(C, /ob\.keyframe_insert\("hide_render", frame=F\(td\)\)/, "they go inside at their door");
  assert.match(W, /if ZW_CROWD_ON\[0\] and "busy" in ZW_T and seed in \(7, 9, 12\):\r?\n        return zw_crowd\(t0, t1, n\)/);
});

test("props: real sizes, held in the hands (book open in both hands, phone screen glowing, box in both arms)", () => {
  for (const k of ["book", "phone", "ball", "shoe", "bag", "box"]) assert.match(C, new RegExp(`"${k}": [\\d.]+`), k);
  assert.match(C, /def zm_open_book\(/); assert.match(C, /emit="#bfe6ff"/, "the phone screen glows");
  assert.match(C, /obj\.location = hand \+ dv \* \(0\.1 \+ size \* 0\.38\) - off/, "a grabbed thing's CENTRE goes just past the hand (not its base on the wrist)");
  assert.match(C, /ZP_TWO_HANDS = \("box", "crate", "cake", "pizza", "bucket", "book"\)/);
});

test("the compiler: a thing the words name comes into the frame (held when grabbed), next to the monster it scales up", () => {
  const fr = (people) => ({ place: "suburb_porch", time: "night", camera: { type: "medium", side: "front" }, people, props: [] });
  const card = { start: fr([{ who: "Me", mark: "center", pose: "stand", face: "happy", looks_at: "camera" }]), end: fr([]), motion: [] };
  const scene = { start: 0, end: 2, words: "I grab my ball and run inside!", wordList: [{ word: "I", start: 0 }] };
  const py = compileScene(JSON.parse(JSON.stringify(card)), { plan: { cast: [{ name: "Me" }] }, scene });
  assert.match(py, /ball_100 = zw_thing\("ball"/); assert.match(py, /zw_grab\(me_0, t0 - 0\.05, ball_100\)/);
  const gone = compileScene(JSON.parse(JSON.stringify(card)), { plan: { cast: [{ name: "Me" }] }, scene: { ...scene, words: "I run inside!" } });
  assert.match(gone, /zw_scene_cam\(cam, t0, t1, \("medium", \[me_0\], \[\], "front"\), \("medium", \[me_0\]/, "an end frame everyone left keeps the start's people in shot");
  const mcard = { start: { ...fr([{ who: "monster", mark: "back", pose: "stand", face: "happy", looks_at: "camera" }]) }, end: fr([{ who: "monster", mark: "back", pose: "stand", face: "happy", looks_at: "camera" }]), motion: [] };
  const mpy = compileScene(mcard, { plan: { cast: [], monster: { present: true, size: 3.5, style: "slime" } }, scene: { ...scene, words: "Now it plays with my shoe all night." } });
  assert.match(mpy, /zw_thing\("shoe".*\* 3\.2\)/, "a shoe next to the monster is drawn at the monster's scale");
});

test("voice: 1.3x is the default", () => {
  assert.equal(PACE, 1.3);
  assert.equal(NARRATOR.pace, 1.3);
});
