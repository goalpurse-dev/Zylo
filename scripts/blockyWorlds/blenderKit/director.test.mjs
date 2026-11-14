// node --test scripts/blockyWorlds/blenderKit/director.test.mjs   (pure helpers only: no model call, no key)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planLocations, tileShots, salvageJson, planProblems, MIN_LOCATIONS, shotCamera, shotProblems, mentionsHero, heroOf, cameraWallProblem, cameraPositions, giantSuspect, HERO_MIN_SHARE, SCREEN_SHARE_CAP } from "./director.mjs";

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
