// node --test scripts/blockyWorlds/blenderKit/milo.test.mjs   (free: the Milo lessons' checks, no model call, no render)
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MILO_RULES, miloShotProblems, storyPlanProblems, planLines, shotProblems, inLane, evalCoord, bodyWalks, descSim, PLACE_INFO } from "./director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = (code) => spawnSync("python", ["-I", "-c", code], { encoding: "utf8" });

test("the eleven Milo rules are in the director's rule list (one line each)", () => {
  assert.equal(MILO_RULES.length, 11);
  for (const k of ["COLLISION", "SIDEWALKS", "GROUNDING", "INTRODUCE NAMED", "VEHICLES", "BIG BUILDINGS", "GAP MOMENT", "NEVER TINY", "NEAR-IDENTICAL", "TREE", "LAST LINE"]) assert.ok(MILO_RULES.some((r) => r.includes(k)), k);
});

test("lanes: the street is a lane, the sidewalks and the crosswalks are not; the sidewalk marks sit in the sidewalk's middle", () => {
  assert.equal(inLane("downtown_street", 0, 40), true);
  assert.equal(inLane("downtown_street", -7.0, 40), true);       // Milo: sidewalk_west (-8) + 1 = -7 was in the street
  assert.equal(inLane("downtown_street", 9.5, 40), false);
  assert.equal(inLane("downtown_street", 0, 1.5), false);         // the crosswalk
  assert.equal(inLane("suburb_street", 10, 0), true);
  assert.equal(inLane("living_room", 0, 0), false);
  const p = PLACE_INFO.downtown_street;
  assert.equal(inLane("downtown_street", p.sidewalk_west[0] + 1, 40), false, "one unit off the mark is still the sidewalk");
});

test("evalCoord / bodyWalks read literal and ZW_INFO-relative walks", () => {
  assert.equal(evalCoord("p[0] + 1", { p: [-9.5, 36, 0.3] }), -8.5);
  assert.equal(evalCoord("-3.5"), -3.5);
  assert.equal(evalCoord("x0 + 1"), null);
  assert.equal(evalCoord("q[0]"), null);
  const w = bodyWalks("p = ZW_INFO['sidewalk_west']\nK = townie(3, t0, t1, 'joy')\nK.walk(t0, t1, (p[0] + 1, p[1] + 10, 0), (p[0] + 1, p[1] + 14, 0), rate=2.4)", "downtown_street");
  assert.deepEqual(w, [{ who: "K", from: [-8.5, 46, 0], to: [-8.5, 50, 0] }]);
});

test("SIDEWALKS: a background walker in the street is a problem; on the sidewalk or the hero in the street is not", () => {
  const street = "ZW_INFO = zw_build('downtown_street', t0, t1, ZW_STORY_DRESS)\nK = townie(3, t0, t1, 'joy')\nK.walk(t0, t1, (0, 40, 0), (0, 50, 0))";
  assert.match(miloShotProblems({ body: street, location: "downtown_street", hero: "Milo" }).join(" "), /walks IN THE STREET/);
  const offset = "ZW_INFO = zw_build('downtown_street', t0, t1, ZW_STORY_DRESS)\np = ZW_INFO['sidewalk_west']\nK = townie(3, t0, t1)\nK.walk(t0, t1, (p[0] + 3, p[1], 0), (p[0] + 3, p[1] + 6, 0))";
  assert.match(miloShotProblems({ body: offset, location: "downtown_street" }).join(" "), /IN THE STREET/);
  const walkway = "ZW_INFO = zw_build('downtown_street', t0, t1, ZW_STORY_DRESS)\nK = townie(3, t0, t1)\nK.walk(t0, t1, (9.5, 40, 0.3), (9.5, 46, 0.3))";
  assert.deepEqual(miloShotProblems({ body: walkway, location: "downtown_street" }), []);
  const hero = "ZW_INFO = zw_build('downtown_street', t0, t1, ZW_STORY_DRESS)\nM = milo(t0, t1, 'scared')\nM.walk(t0, t1, (0, 40, 0), (0, 50, 0))";
  assert.deepEqual(miloShotProblems({ body: hero, location: "downtown_street", hero: "Milo" }), []);
});

test("COLLISION: a walk path through a standing character is a problem; around them it is not", () => {
  const through = "G = grandpa(t0, t1)\nG.pose(t0, loc=(0, 10, 0))\nK = townie(5, t0, t1)\nK.walk(t0, t1, (0, 5, 0), (0, 15, 0))";
  assert.match(miloShotProblems({ body: through, location: "living_room" }).join(" "), /passes THROUGH G/);
  const around = "G = grandpa(t0, t1)\nG.pose(t0, loc=(0, 10, 0))\nK = townie(5, t0, t1)\nK.walk(t0, t1, (3, 5, 0), (3, 15, 0))";
  assert.deepEqual(miloShotProblems({ body: around, location: "living_room" }), []);
});

test("GROUNDING: 'on the roof / table / shelf' needs zw_ground", () => {
  assert.match(miloShotProblems({ body: "M = milo(t0, t1)\nM.pose(t0, loc=(0, 0, 12))", desc: "Milo dancing on the roof of the bank" }).join(" "), /zw_ground/);
  assert.deepEqual(miloShotProblems({ body: "M = milo(t0, t1)\nzw_ground(M, t0, roof, 0, 0)", desc: "Milo dancing on the roof of the bank" }), []);
  assert.deepEqual(miloShotProblems({ body: "M = milo(t0, t1)", desc: "Milo at the table, laughing" }), []);
});

test("AT MOST 2 NEAR-IDENTICAL SHOTS IN A ROW (bodies): the third same-place, same-camera, same-action shot is flagged", () => {
  const shots = [1, 2, 3].map((id) => ({ id, w0: id, desc: "Milo laughs on the sidewalk", location: "downtown_street" }));
  const spot = (s) => `ZW_INFO = zw_build("downtown_street", t0, t1, ZW_STORY_DRESS)\ncam = Cam(); zw_spot(cam, "downtown_street", "${s}", t0, t1)\nM = milo(t0, t1)`;
  const p = shotProblems({ shots, bodies: { 1: spot("wide"), 2: spot("close"), 3: spot("street") }, hero: "Milo" });
  assert.match(p[3] ?? "", /near-identical/);
  assert.equal(p[2], undefined);
  const varied = shotProblems({ shots: [...shots.slice(0, 2), { id: 3, w0: 3, desc: "the truck skids past the bakery", location: "downtown_street" }], bodies: { 1: spot("wide"), 2: spot("close"), 3: spot("street") }, hero: "Milo" });
  assert.equal(varied[3], undefined);
  assert.ok(descSim("Milo laughs on the sidewalk", "Milo laughs on the sidewalk again") >= 0.75);
});

test("planLines maps each planned shot to the lines its words cover", () => {
  const lineOf = [0, 0, 0, 1, 1, 2, 2, 2];
  const lines = planLines([{ id: 1, w0: 0 }, { id: 2, w0: 2 }, { id: 3, w0: 5 }], lineOf, [{ text: "a" }, { text: "b" }, { text: "c" }]);
  assert.deepEqual(lines, [{ line: 0, text: "a", shots: [1, 2] }, { line: 1, text: "b", shots: [2] }, { line: 2, text: "c", shots: [3] }]);
});

const sheet = [{ name: "Milo", hero: true, colors: "green and yellow stripes" }, { name: "Grandpa", hero: false, colors: "brown" }, { name: "Mom", hero: false, colors: "pink" }];
test("the plan checks: a named character's first line shows them, the gap gets a close shot, nothing through cars, the last line literal", () => {
  const shots = [
    { id: 1, w0: 0, desc: "Milo laughs in the street", location: "downtown_street" },
    { id: 2, w0: 4, desc: "Grandpa's hand opens the joke book", location: "living_room" },
    { id: 3, w0: 8, desc: "the cement truck drives through the parked cars", location: "downtown_street" },
    { id: 4, w0: 12, desc: "the bank falls toward the crowd", location: "downtown_landmark" },
    { id: 5, w0: 16, desc: "Milo waves at the crowd", location: "downtown_landmark" },
  ];
  const lines = [
    { line: 0, text: "Every laugh, I grow.", shots: [1] },
    { line: 1, text: "Grandpa read me his joke book.", shots: [2] },
    { line: 2, text: "The truck lost its brakes.", shots: [3] },
    { line: 3, text: "The bank stopped one inch above the ground.", shots: [4] },
    { line: 4, text: "And Mom hugged my ankle forever.", shots: [5] },
  ];
  const p = storyPlanProblems({ shots, style_sheet: sheet }, lines).join("\n");
  assert.match(p, /names Grandpa for the first time/);
  assert.match(p, /tiny-gap moment/);
  assert.match(p, /THROUGH cars or people/);
  assert.match(p, /names Mom for the first time/);
  assert.match(p, /does not show the last line literally/);
  const fixed = shots.map((s) => ({ ...s }));
  fixed[1].desc = "Grandpa, full body, opens the joke book";
  fixed[2].desc = "the cement truck shoves the parked cars aside, they spin away";
  fixed[3].desc = "close low shot: the bank's edge one inch above the ground, the gap over the people";
  fixed[4].desc = "Mom hugs Milo's giant ankle, her face up close, crying with joy";
  assert.deepEqual(storyPlanProblems({ shots: fixed, style_sheet: sheet }, lines), []);
});

test("the plan checks: an important person's emotional beat framed tiny, and three near-identical planned shots", () => {
  const shots = [
    { id: 1, w0: 0, desc: "Mom hugs the ankle, tiny in the distance", location: "downtown_landmark" },
    { id: 2, w0: 1, desc: "Milo giggles at the table", location: "kitchen" },
    { id: 3, w0: 2, desc: "Milo giggles at the table", location: "kitchen" },
    { id: 4, w0: 3, desc: "Milo giggles at the table again", location: "kitchen" },
  ];
  const p = storyPlanProblems({ shots, style_sheet: sheet }, []).join("\n");
  assert.match(p, /framed tiny/);
  assert.match(p, /shots 2, 3, 4 are near-identical/);
});

test("actions.py: the crowd runs on the sidewalks and parts around the hero", () => {
  const src = path.join(HERE, "actions", "actions.py");
  const r = py(`import math, random, json\nexec(open(${JSON.stringify(src)}, encoding="utf8").read())\nprint(json.dumps([zx_crowd_x(x) for x in (-9, -6, -2, 0, 3, 7, 9)] + [zx_crowd_x(9.5, (9.0, 0, 2.5))]))`);
  assert.equal(r.status, 0, r.stderr);
  const xs = JSON.parse(r.stdout);
  for (const x of xs.slice(0, 7)) assert.ok(!inLane("downtown_landmark", x, 100), `x ${x} is in the street`);
  for (const x of xs.slice(0, 7)) assert.ok(Math.abs(x) <= 12, `x ${x} is past the sidewalk`);
  assert.ok(Math.abs(xs[7] - 9.0) >= 2.5, "parts around the hero");
});

test("worlds.py: zw_ground / zw_knock exist and the library still passes the static check", () => {
  const r = spawnSync("python", ["-I", path.join(HERE, "shotcheck.py"), path.join(HERE, "worlds", "worlds.py"), "--json"], { encoding: "utf8" });
  const out = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(out.ok, true, JSON.stringify(out.problems));
  const src = spawnSync("python", ["-I", "-c", `import ast,sys\nt=ast.parse(open(${JSON.stringify(path.join(HERE, "worlds", "worlds.py"))},encoding="utf8").read())\nprint(",".join(n.name for n in t.body if isinstance(n, ast.FunctionDef)))`], { encoding: "utf8" }).stdout;
  for (const f of ["zw_top", "zw_ground", "zw_knock"]) assert.ok(src.split(",").map((s) => s.trim()).includes(f), f);
});
