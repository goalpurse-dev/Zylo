// node --test scripts/blockyWorlds/blenderKit/director.test.mjs   (pure helpers only: no model call, no key)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planLocations, tileShots, salvageJson, planProblems, MIN_LOCATIONS, shotCamera, shotProblems, mentionsHero, heroOf, cameraWallProblem, cameraPositions, giantSuspect, HERO_MIN_SHARE, SCREEN_SHARE_CAP, bodyCharacters, giantCameraProblems, CHAR_BOX } from "./director.mjs";

// the hero is named in most shot descs (the plan check wants the hero in at least half the shots)
const shotsAt = (locs) => locs.map((location, i) => ({ id: i + 1, w0: i, desc: i % 3 === 2 ? "the crowd gasps" : "Mo runs", location }));
const good = {
  shots: shotsAt([...Array(25).fill("hero room"), ...Array(15).fill("main street"), ...Array(14).fill("big hall"), ...Array(6).fill("hero room")]),
  style_sheet: [{ name: "Mo", hero: true, outfit: "yellow-black stripes", colors: "yellow and black stripes" }, { name: "Pip", hero: false, outfit: "orange", colors: "orange shirt" }],
  anchors: ["Hero room"],
};

test("the plan check passes a plan with 3+ locations, ~50 cuts a minute, one hero, distinct colours and a returning anchor", () => {
  assert.deepEqual(planProblems(good, 72), []);
});

test("the plan check names every broken rule", () => {
  const p = planProblems({ shots: shotsAt(Array(30).fill("cabin")), style_sheet: [{ name: "A", hero: true, colors: "red" }, { name: "B", hero: true, colors: "Red" }], anchors: [] }, 72);
  assert.ok(p.some((x) => /location/.test(x)));
  assert.ok(p.some((x) => /cuts a minute/.test(x)));
  assert.ok(p.some((x) => /2 hero/.test(x)));
  assert.ok(p.some((x) => /share the colours/.test(x)));
  assert.ok(p.some((x) => /no anchors/.test(x)));
});

test("an anchor that never comes back in the last 15% fails", () => {
  const plan = { ...good, shots: shotsAt([...Array(30).fill("hero room"), ...Array(15).fill("main street"), ...Array(15).fill("big hall")]) };
  assert.ok(planProblems(plan, 72).some((x) => /comes back in the ending/.test(x)));
});

const words = Array.from({ length: 12 }, (_, i) => ({ word: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));

test("the plan check counts distinct locations (case and spacing ignored, empty ignored)", () => {
  assert.equal(MIN_LOCATIONS, 3);
  const r = planLocations([{ location: "Cabin aisle" }, { location: "cabin  AISLE" }, { location: "Cockpit" }, { location: "" }, {}]);
  assert.deepEqual(r, { n: 2, list: ["cabin aisle", "cockpit"] });
  assert.equal(planLocations([{ location: "cabin" }, { location: "cockpit" }, { location: "wing" }]).n, 3);
});

test("tiling keeps each shot's location, starts at word 0, and merges shots under 0.35 s", () => {
  const t = tileShots([{ id: 1, w0: 2, desc: "a", location: "wing" }, { id: 2, w0: 4, desc: "b", location: "cockpit" }, { id: 3, w0: 5, desc: "c", location: "cabin" }], words);
  assert.equal(t.shots[0].w0, 0);
  assert.deepEqual(t.shots.map((s) => s.location), ["wing", "cockpit", "cabin"]);
  const short = tileShots([{ id: 1, w0: 0, desc: "a" }, { id: 2, w0: 1, desc: "b" }], [{ word: "a", start: 0, end: 0.1 }, { word: "b", start: 0.2, end: 0.3 }, { word: "c", start: 1, end: 1.2 }]);
  assert.deepEqual(short.merged, [2]);
});

test("a cut-off JSON answer keeps every complete shot", () => {
  const v = salvageJson('{"shots":[{"id":1,"body":"a"},{"id":2,"body":"b"},{"id":3,"bo');
  assert.deepEqual(v.shots.map((s) => s.id), [1, 2]);
});

// ---------------------------------------------------------------- camera + cast rules (owner 2026-11-14)
const spotBody = (place, spot, extra = "") => `ZW_INFO = zw_build("${place}", t0, t1, ZW_STORY_DRESS)\ncam = Cam(); zw_spot(cam, "${place}", "${spot}", t0, t1)\n${extra}`;
const S = (n, location = "downtown_street", desc = "Mo waves") => Array.from({ length: n }, (_, i) => ({ id: i + 1, w0: i, desc, location }));

test("the plan check wants the hero named in at least half the shot descs", () => {
  const sheet = [{ name: "Mo", hero: true, colors: "yellow and black" }, { name: "Pip", hero: false, colors: "orange" }];
  const shots = shotsAt([...Array(25).fill("hero room"), ...Array(15).fill("main street"), ...Array(14).fill("big hall"), ...Array(6).fill("hero room")]);
  assert.deepEqual(planProblems({ shots, style_sheet: sheet, anchors: ["Hero room"] }, 72), []);
  const few = shots.map((s, i) => ({ ...s, desc: i < 20 ? "Mo runs" : "the street" }));
  assert.ok(planProblems({ shots: few, style_sheet: sheet, anchors: ["Hero room"] }, 72).some((x) => /hero Mo is named in only 20 of 60/.test(x)));
});

test("the hero is found by name, first name or identifier, never inside another word", () => {
  assert.ok(mentionsHero("Mo trips over the cat", "Mo"));
  assert.ok(mentionsHero("mo(t0, t1, 'shock')", "Mo"));
  assert.ok(!mentionsHero("the moon rises", "Mo"));
  assert.ok(mentionsHero("k = captain_pip(t0, t1)", "Captain Pip"));
  assert.ok(mentionsHero("Captain waves", "Captain Pip"));
  assert.ok(!mentionsHero("anything", ""));
  assert.equal(heroOf([{ name: "A", hero: false }, { name: "Mo", hero: true }]), "Mo");
  assert.equal(heroOf([]), null);
});

test("the camera key: a library spot, a literal cam.key, or the first camera call with the location", () => {
  assert.equal(shotCamera(spotBody("downtown_street", "close")), "spot:downtown_street/close");
  assert.equal(shotCamera("cam = Cam()\ncam.key(t0, (1, 2, 3), (4, 5, 6), lens=30)", "Cabin"), "key:cabin:1,2,3>4,5,6");
  assert.equal(shotCamera("cam.push(t0, t1, (0, 4, 4), 9, 7, yaw=10)", "cabin"), "push:cabin:t0,t1,(0,4,4),9,7,yaw=10)");
  assert.equal(shotCamera("k = mo(t0, t1)"), null);
});

test("the shot check flags the same camera spot twice in a row, never a change of spot or place", () => {
  const shots = S(4);
  const bodies = { 1: spotBody("downtown_street", "wide"), 2: spotBody("downtown_street", "wide"), 3: spotBody("downtown_street", "close"), 4: spotBody("downtown_plaza", "close") };
  const p = shotProblems({ shots, bodies, hero: "Mo" });
  assert.deepEqual(Object.keys(p), ["2"]);
  assert.match(p[2], /same camera spot as shot 1/);
  // the same custom push in two different locations is fine; in the same location it is a repeat
  const push = "cam.push(t0, t1, (0, 4, 4), 9, 7, yaw=10)";
  assert.deepEqual(shotProblems({ shots: [{ id: 1, location: "cabin", desc: "Mo" }, { id: 2, location: "cockpit", desc: "Mo" }], bodies: { 1: push, 2: push }, hero: "Mo" }), {});
  assert.ok(shotProblems({ shots: [{ id: 1, location: "cabin", desc: "Mo" }, { id: 2, location: "cabin", desc: "Mo" }], bodies: { 1: push, 2: push }, hero: "Mo" })[2]);
});

test("the shot check asks for the hero in enough shots, spread over the video", () => {
  const shots = S(10).map((s, i) => ({ ...s, desc: i < 2 ? "Mo waves" : "the street" }));
  const bodies = Object.fromEntries(shots.map((s, i) => [s.id, spotBody("downtown_street", ["wide", "close"][i % 2])]));
  const p = shotProblems({ shots, bodies, hero: "Mo" });
  const flagged = Object.keys(p).map(Number);
  assert.equal(flagged.length, Math.ceil(10 * HERO_MIN_SHARE) - 2);
  assert.ok(flagged.every((id) => id > 2) && flagged[0] === 3 && flagged.at(-1) >= 8, `spread: ${flagged}`);
  assert.ok(Object.values(p).every((t) => /hero Mo is in only 2 of 10/.test(t)));
  // a body that calls the hero's helper counts
  const withBody = { ...bodies, 3: `${bodies[3]}\nk = mo(t0, t1)`, 4: `${bodies[4]}\nk = mo(t0, t1)`, 5: `${bodies[5]}\nk = mo(t0, t1)` };
  assert.deepEqual(shotProblems({ shots, bodies: withBody, hero: "Mo" }), {});
  assert.deepEqual(shotProblems({ shots, bodies, hero: null }), {});
});

test("the shot check flags a literal camera inside a wall or a building of a library place", () => {
  assert.match(cameraWallProblem("living_room", [8.6, 0, 5]), /wall of living_room/);
  assert.match(cameraWallProblem("kitchen", [0, 0, 9.5]), /floor or the ceiling/);
  assert.equal(cameraWallProblem("kitchen", [0, -12, 5]), "");               // in front of the open side: fine
  assert.match(cameraWallProblem("downtown_street", [18, 40, 5]), /inside a building/);
  assert.equal(cameraWallProblem("downtown_street", [18, 40, 40]), "");      // above the roofs: fine
  assert.equal(cameraWallProblem("brick_alley", [-20, 70, 4]), "");          // the alley is open
  assert.match(cameraWallProblem("brick_street", [-20, 30, 4]), /inside a building/);
  assert.match(cameraWallProblem("suburb_street", [0, 24, 5]), /inside a building/);
  assert.equal(cameraWallProblem("moon", [0, 0, 5]), "");
  assert.deepEqual(cameraPositions("cam.key(t0, (1.5, -2, 4.8), (0, 0, 4))\ncam.key(t1, (2, -2.5, 4.8), (0, 0, 4))"), [[1.5, -2, 4.8], [2, -2.5, 4.8]]);
  const shots = [{ id: 1, location: "living_room", desc: "Mo sits" }];
  assert.match(shotProblems({ shots, bodies: { 1: 'zw_build("living_room", t0, t1)\ncam = Cam()\ncam.key(t0, (8.7, 0, 5), (0, 0, 3))' }, hero: "Mo" })[1], /blocked by a wall/);
});

test("every TESTED camera spot of the world library passes the wall check (worlds.py and the director agree)", () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "worlds", "worlds.py"), "utf8");
  const block = src.slice(src.indexOf("ZW_SPOTS = {"), src.indexOf("ZW_DRESS_DEFAULT"));
  let n = 0;
  for (const m of block.matchAll(/"(\w+)": \{(.*)\},?\n/g)) {
    for (const s of m[2].matchAll(/"(\w+)": \(\(([-\d., ]+)\)/g)) {
      const pos = s[2].split(",").map(Number);
      assert.equal(cameraWallProblem(m[1], pos), "", `${m[1]} ${s[1]} ${pos}`);
      n++;
    }
  }
  assert.ok(n >= 50, `found ${n} spots`);
});

test("the giant-prop suspect: one flat region over the screen-share cap with few edges; face close-ups and busy frames pass", () => {
  assert.equal(SCREEN_SHARE_CAP, 0.4);
  assert.ok(giantSuspect({ lflat: 0.7, ledge: 0.05 }));
  assert.ok(!giantSuspect({ lflat: 0.56, ledge: 0.2 }));    // a face close-up (measured on the v2 world stills)
  assert.ok(!giantSuspect({ lflat: 0.3, ledge: 0.05 }));
  assert.ok(!giantSuspect({ cflat: 0.9 }));                  // old preview stats without the lower-frame numbers
});

// ---------------------------------------------------------------- giant camera rules (owner 2026-11-14)
test("the characters of a body: sizes from scale=, root.scale and zw_grow (the bigger size), positions from pose(loc=)", () => {
  const c = bodyCharacters([
    "zo = chars.kid(3)", "zo.pose(t0, loc=(0, 40, 0), rot=0)", "zw_grow(zo, t0, t1, 1.0, 6.0)",
    "bob = Char(\"Bob\", shirt=\"#ff0000\", scale=2.5)", "bob.pose(t0, loc=(10, 40, 0))",
    "kid2 = chars.kid(4)", "kid2.root.scale = (0.5, 0.5, 0.5)", "kid2.pose(t0, loc=(-6, 30, 0.3))",
  ].join("\n"));
  assert.equal(c.zo.size, 6);
  assert.deepEqual(c.zo.locs, [[0, 40, 0]]);
  assert.equal(c.bob.size, 2.5);
  assert.equal(c.kid2.size, 1);           // a shrink below 1 keeps the kid box (the bigger size counts)
});

test("the giant camera check BLOCKS a camera inside a grown character and too close to a giant's face, never a safe one", () => {
  const giant = "zo = chars.kid(3)\nzo.pose(t0, loc=(0, 40, 0))\nzw_grow(zo, t0, t1, 1.0, 6.0)\ncam = Cam()\n";
  // the old kid-size close-up camera, 5 units in front: inside a size-6 body (box x +-9.6, y +-6, z 0..32.4)
  assert.match(giantCameraProblems(`${giant}cam.key(t0, (1.0, 35.0, 4.6), (0, 40, 4.4), lens=30)`)[0], /INSIDE zo \(size 6\)/);
  // outside the box but 12 units from a size-6 face (3 head sizes = 25.2): too close
  assert.match(giantCameraProblems(`${giant}cam.key(t0, (0, 25, 27.6), (0, 40, 27.6), lens=50)`)[0], /from zo's face .* at least 25\.2 away/);
  // the zw_giant_cam "face" distance (4.4 x size = 26.4 at the face height) and further: fine
  assert.deepEqual(giantCameraProblems(`${giant}cam.key(t0, (0, 8, 27.6), (0, 40, 27.6), lens=50)`), []);
  // street level looking up from 35 units: fine
  assert.deepEqual(giantCameraProblems(`${giant}cam.key(t0, (4, 5, 2.2), (0, 40, 21.6), lens=22)`), []);
  // a kid-size character keeps the old rules: 5 units in front at head height is fine
  assert.deepEqual(giantCameraProblems("k = chars.kid(3)\nk.pose(t0, loc=(0, 40, 0))\ncam.key(t0, (1.0, 35.0, 4.6), (0, 40, 4.4))"), []);
  assert.match(giantCameraProblems("k = chars.kid(3)\nk.pose(t0, loc=(0, 40, 0))\ncam.key(t0, (0.5, 40.3, 4.6), (0, 45, 4.4))")[0], /INSIDE k/);
});

test("the shot check blocks the shot that puts the camera inside a character", () => {
  const body = "zo = chars.kid(3)\nzo.pose(t0, loc=(0, 40, 0))\nzw_grow(zo, t0, t1, 1.0, 6.0)\ncam = Cam()\ncam.key(t0, (1.0, 35.0, 4.6), (0, 40, 4.4))";
  const p = shotProblems({ shots: [{ id: 1, desc: "Zo grows", location: "downtown_street" }], bodies: { 1: body }, hero: "Zo" });
  assert.match(p[1], /BLOCKED \(camera inside/);
});

test("worlds.py: zw_giant_cam keeps every view outside the character's box at every size; the Blender guard wraps V.build", () => {
  // the same distances as worlds.py zw_giant_cam (face: max(4.5, 4.4 s) at the face height; hero: 4.5 s + 8 at z 2.2; full: 9 s + 6)
  for (const s of [0.5, 1, 2, 4, 6, 10, 16]) {
    const views = { face: [Math.max(4.5, 4.4 * s), 4.6 * s], hero: [4.5 * s + 8, 2.2], full: [9 * s + 6, 2.6 * s + 2] };
    for (const [v, [d, z]] of Object.entries(views)) {
      assert.deepEqual(giantCameraProblems(`g = chars.kid(1)\ng.pose(t0, loc=(0, 0, 0))\nzw_grow(g, t0, t1, ${s}, ${s})\ncam.key(t0, (0, ${-d}, ${z}), (0, 0, 1))`), [], `${v} at size ${s}`);
    }
  }
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "worlds", "worlds.py"), "utf8");
  assert.match(src, /d, z, tgt, lens = max\(4\.5, 4\.4 \* size\), 4\.6 \* size, head, 50/);
  assert.match(src, /d, z, tgt, lens = 4\.5 \* size \+ 8, 2\.2,/);
  assert.match(src, /raise RuntimeError\("CAMERA INSIDE A CHARACTER/);
  assert.match(src, /V\.build = zw_guarded_build/);
  assert.equal(CHAR_BOX.z, 5.4);
});
