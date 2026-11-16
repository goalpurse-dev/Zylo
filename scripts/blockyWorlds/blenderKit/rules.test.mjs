// node --test scripts/blockyWorlds/blenderKit/rules.test.mjs   (free: THE ACTION RULES + the auto notes helpers, owner
// 2026-11-16 after the live "The Yawn That Took the Hill": empty plaza / alley / classroom, hero and mayor barely shown,
// no hill, a plane in the clouds)
import test from "node:test";
import assert from "node:assert/strict";
import { actionPlanProblems, shotProblems, visionRuleProblems, heroSeenProblems, windowExcess, mentionsChar, roleWords, castHelpers, ACTION_RULES, planLines } from "./director.mjs";
import { cleanScenes, isAutoPlan, notesBrief, NOTES_SCHEMA } from "./notes.mjs";
import { blenderRounds } from "./workerSteps.mjs";

const cast = [
  { name: "Kestrel", role: "", hero: true, outfit: "purple hoodie", colors: "purple, yellow" },
  { name: "Birdie", role: "the mayor", hero: false, outfit: "pink robe", colors: "pink" },
  { name: "Egbert", role: "Kestrel's grandpa", hero: false, outfit: "flat cap", colors: "brown" },
];
const script = ["And I just yawned the mayor asleep on her own hill!", "Only the brass town bell in the square wakes them.", "Then there's me, Kestrel.", "Now a yawn in the square meant sleeping forever."];
// one word per line, so word index = line index
const lineOf = [0, 1, 2, 3];
const L = (shots) => planLines(shots, lineOf, script.map((text) => ({ text })));

test("the action rules are in the director's rules", () => {
  assert.equal(ACTION_RULES.length, 4);
  assert.ok(ACTION_RULES.some((r) => /NEVER REPLACES THE ACTION/.test(r)));
});

test("roles: 'the mayor' finds Birdie, 'Kestrel's grandpa' finds Egbert", () => {
  assert.deepEqual(roleWords("the mayor"), ["mayor"]);
  assert.deepEqual(roleWords("Kestrel's grandpa"), ["grandpa"]);
  assert.ok(mentionsChar("I yawned the mayor asleep", cast[1]));
  assert.ok(mentionsChar("Grandpa toots", cast[2]));
  assert.ok(!mentionsChar("the town square", cast[1]));
});

test("THE YAWN PLAN FAILS: an empty plaza, the mayor never shown, the hill never shown", () => {
  const shots = [
    { id: 1, w0: 0, desc: "Kestrel yawns a blue wave", location: "downtown_landmark" },
    { id: 2, w0: 1, desc: "wide of the plaza fountain", location: "downtown_plaza" },
    { id: 3, w0: 2, desc: "Kestrel with nine Zs", location: "downtown_street" },
    { id: 4, w0: 3, desc: "the empty plaza", location: "downtown_plaza" },
  ];
  const p = actionPlanProblems({ shots, style_sheet: cast }, L(shots), { builds: [{ name: "hill", kind: "set", lines: [0] }] });
  assert.ok(p.some((x) => /shot 2 .*only the place/.test(x)), p.join("\n"));
  assert.ok(p.some((x) => /shot 4 .*only the place/.test(x)));
  assert.ok(p.some((x) => /line L0 names Birdie/.test(x)));
  assert.ok(p.some((x) => /hill .* never shown/.test(x)));
  assert.ok(p.some((x) => /more than 1 shot in 6 without a character/.test(x)));
});

test("a plan that shows the action passes", () => {
  const shots = [
    { id: 1, w0: 0, desc: "Kestrel yawns at Birdie on the hill, Birdie flops asleep", location: "downtown_landmark" },
    { id: 2, w0: 1, desc: "the brass bell rings in the square", location: "downtown_plaza" },
    { id: 3, w0: 2, desc: "Kestrel with nine Zs over her head", location: "downtown_street" },
    { id: 4, w0: 3, desc: "Kestrel yawns, the crowd falls asleep", location: "downtown_plaza" },
  ];
  assert.deepEqual(actionPlanProblems({ shots, style_sheet: cast }, L(shots), { builds: [{ name: "hill", kind: "set", lines: [0] }] }), []);
});

test("the free shot check BLOCKS an empty body, a named character the body never calls and a desc-only hero", () => {
  const header = "def kestrel(t0, t1):\n    k = chars.Char('kestrel', shirt='#7a3cff')\n    return k\n\ndef birdie(t0, t1):\n    return chars.Char('birdie')\n\ndef bell_prop(p):\n    return box('bell', (1, 1, 1), p, mat('b', hexc('#c9a227')))\n";
  const cam = "cam = Cam(); zw_spot(cam, 'downtown_plaza', 'wide', t0, t1)";
  const shots = [1, 2, 3, 4].map((id) => ({ id, w0: id - 1, desc: ["Kestrel yawns", "Birdie on her pillows", "the plaza", "the bell"][id - 1], location: "downtown_plaza" }));
  const bodies = { 1: `ZW_INFO = zw_build('downtown_plaza', t0, t1, ZW_STORY_DRESS)\n${cam}`, 2: `K = kestrel(t0, t1)\n${cam}`, 3: `ZW_INFO = zw_build('downtown_plaza', t0, t1, ZW_STORY_DRESS)\n${cam}`, 4: `b = bell_prop((0, 0, 0))\n${cam}` };
  assert.deepEqual(castHelpers(header, cast), { people: ["kestrel", "birdie"], things: ["bell_prop"] });
  const p = shotProblems({ shots, bodies, hero: "Kestrel", styleSheet: cast, header });
  assert.match(p[1], /EMPTY|names Kestrel but the body never/);
  assert.match(p[2], /names Birdie but the body never puts Birdie/);
  assert.match(p[3], /EMPTY: only the place/);
  assert.ok(!/EMPTY/.test(p[4] ?? ""), "a named prop is not empty");
  assert.ok(Object.values(p).some((t) => /hero Kestrel is in only 1 of 4/.test(t)), "the desc alone never counts for the hero");
});

test("at most 1 shot in any 6 without a character", () => {
  assert.deepEqual(windowExcess([1, 2, 3, 4, 5, 6, 7], new Set([1, 7])), []);
  assert.deepEqual(windowExcess([1, 2, 3, 4, 5, 6, 7], new Set([2, 5])), [5]);
  assert.deepEqual(windowExcess([1, 2, 3], new Set([1, 2])), [2]);
});

test("the vision rules: an empty frame and a named character not seen fail; the hero's SEEN share", () => {
  const shots = [{ id: 1, desc: "Kestrel yawns the mayor asleep" }, { id: 2, desc: "the plaza" }, { id: 3, desc: "Kestrel and Grandpa" }];
  const p = visionRuleProblems({ shots, styleSheet: cast, answers: [{ id: 1, ok: true, people: ["Kestrel"], empty: false }, { id: 2, ok: true, people: [], empty: true }, { id: 3, ok: true, people: ["Kestrel", "Egbert"], empty: false }] });
  assert.match(p[1], /Birdie named but not clearly visible/);
  assert.match(p[2], /EMPTY FRAME/);
  assert.equal(p[3], undefined);
  const seen = { 1: ["Kestrel"], 2: [], 3: ["crowd"], 4: [] };
  const h = heroSeenProblems({ shots: [1, 2, 3, 4].map((id) => ({ id, desc: id === 4 ? "Kestrel runs" : "x" })), seen, hero: "Kestrel", styleSheet: cast });
  assert.equal(Object.keys(h).length, 1);
  assert.ok(h[4], "the shot whose desc names the hero is asked first");
  assert.deepEqual(heroSeenProblems({ shots: [{ id: 1 }, { id: 2 }], seen: { 1: ["Kestrel"], 2: [] }, hero: "Kestrel", styleSheet: cast }), {});
});

test("auto notes: the keyword plan is re-picked, an owner plan is kept; scenes are checked", () => {
  assert.equal(isAutoPlan({ scenes: [{ lines: [0, 1], location: "bedroom", auto: true }] }), true);
  assert.equal(isAutoPlan({ scenes: [{ lines: [0, 1], location: "bedroom", auto: false }] }), false);
  assert.equal(isAutoPlan(null), true);
  const ids = new Set(["downtown_plaza", "downtown_landmark"]);
  assert.deepEqual(cleanScenes([{ from: 0, to: 1, location: "downtown_landmark" }, { from: 2, to: 2, location: "downtown_landmark" }, { from: 3, to: 3, location: "downtown_plaza" }], 4, ids), { scenes: [{ lines: [0, 2], location: "downtown_landmark", auto: true }, { lines: [3, 3], location: "downtown_plaza", auto: true }] });
  assert.equal(cleanScenes([{ from: 0, to: 2, location: "downtown_plaza" }], 4, ids), null, "a gap");
  assert.equal(cleanScenes([{ from: 0, to: 3, location: "sky_airliner" }], 4, ids), null, "not in the library");
  const b = notesBrief({ card: { premise: "yawns", twist: "the hill" }, script: { lines: script.map((text) => ({ text })) }, locations: [{ id: "downtown_plaza", about: "plaza" }], builds: [{ name: "hill", kind: "set", lines: [0] }] });
  assert.match(b, /LINE BY LINE/);
  assert.match(b, /never a plane in the sky/);
  assert.match(b, /hill \(set; lines 0\)/);
  assert.deepEqual(NOTES_SCHEMA.required, ["notes", "scenes"]);
});

test("live = Milo: 2 fix rounds unless the config says otherwise", () => {
  assert.equal(blenderRounds({}), 2);
  assert.equal(blenderRounds({ blenderRounds: 1 }), 1);
  assert.equal(blenderRounds({ blenderRounds: 9 }), 2);
});
