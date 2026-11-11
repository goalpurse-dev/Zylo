// The competitor story rules (the owner's study of 5 top videos, 2026-11-11): m2/storyRules.js, salvage rule 11.
import test from "node:test";
import assert from "node:assert/strict";

const R = await import("../scripts/cutaway/proto3d/m2/storyRules.js");
const { salvagePlan } = await import("../scripts/cutaway/proto3d/m2/salvage.mjs");

// a storm drain in the competitor's shape, 30 s: 5 loops along the flow, the ball recurring, the hook's street at the end
const roles = ["hook", "problem", "fix1", "problem2", "fix2", "problem3", "fix3", "name", "problem4", "fix4", "problem5", "fix5", "finish", "congrats"];
const text = {
  hook: "If you cut a hole in your street, the rain has somewhere to go.",
  problem: "But the hole fills up, and your street becomes a swimming pool.",
  fix1: "So you connect a pipe to carry the water away.",
  problem2: "But the flat pipe leaves water sitting underground.",
  fix2: "So you slope the pipe downhill toward the river.",
  problem3: "But the moving water brings leaves and a tennis ball.",
  fix3: "So you add a grate over the hole.",
  name: "This is a catch basin.",
  problem4: "But the grate sends it all on, and the river rises.",
  fix4: "So you put a hinged flap gate over the outlet.",
  problem5: "But with the gate shut, the rain floods the street again.",
  fix5: "So you add a pump that pushes it out.",
  finish: "Bury the pipes, pave the street, and let it rain.",
  congrats: "Congratulations, you have built a storm drain.",
};
const sentences = roles.map((role) => ({ role, text: text[role] }));
const beats = roles.map((s) => ({ s, do: [], shots: [] }));
beats[0].shows = { p: "street", does: "a hole is cut in the street" };
beats[2].do = [{ p: "pipe", v: "grow", w: "pipe" }];
beats[4].do = [{ p: "pipe", v: "grow", w: "slope" }];
beats[4].shows = { p: "pipe", does: "the moving water runs down the sloped pipe" };
beats[3].do = [{ p: "ball", v: "show", w: "water" }];
beats[5].do = [{ p: "ball", v: "ride", w: "ball" }];
beats[6].do = [{ p: "grate", v: "show", w: "grate" }, { p: "ball", v: "sit", w: "grate" }];
beats[9].do = [{ p: "flap", v: "show", w: "flap" }, { p: "flap", v: "swing", w: "flap" }];
beats[11].do = [{ p: "pump", v: "show", w: "pump" }, { p: "ball", v: "ride", w: "pushes" }];
beats[12].do = [{ p: "street", v: "pave", w: "pave" }];
beats[13].shots = [{ focus: ["ball", "street"] }];
const L = { title: "storm drain", beats, parts: ["street", "pipe", "ball", "grate", "flap", "pump"].map((id) => ({ id, kind: id === "ball" ? "token" : "rig" })) };
const at = ["street", "pipe", "pipe", "river", "street"];
const story = { title: "storm drain", flow: ["street", "pipe", "river"], recurring: { p: "ball", what: "a tennis ball" },
  chain: roles.filter((r) => /^problem/.test(r)).map((problem, k) => ({ problem, at: at[k], scale: ["street", "street", "street", "river", "river"][k] })) };

test("story rules: a competitor-shaped 30 s storm drain passes every rule", () => {
  const r = R.storyRuleProblems(L, story, sentences, 30);
  assert.deepEqual(r.problems, []);
  assert.equal(r.stats.loops, 5); assert.equal(r.stats.hookReturns, true); assert.equal(r.stats.names, 1);
});

test("story rules: each rule names what to fix", () => {
  const p = (L2, st, S, len = 30) => R.storyRuleProblems(L2, st, S, len).problems.join("\n");
  assert.match(p(L, story, sentences, 60), /rule 3 \(many short loops\): 5 But\/So loops; a 60 s video needs 10-12/);
  assert.match(p(L, { ...story, flow: [] }, sentences), /rule 1 \(follow the flow\)/);
  const back = { ...story, chain: story.chain.map((c, k) => ({ ...c, at: ["river", "street", "pipe", "street", "pipe"][k] })) };
  assert.match(p(L, back, sentences), /rule 1: the problems go back up the flow/);
  const S2 = sentences.map((s) => (s.role === "problem5" ? { ...s, text: "But now the rain floods the street again." } : s));
  assert.match(p(L, story, S2), /rule 2 \(the fix causes the next problem\): problem5/);
  const S4 = sentences.map((s) => (s.role === "finish" ? { ...s, text: "Add a bench and a trash can by the road." } : s));
  const L4 = { ...L, beats: L.beats.map((b) => (b.s === "finish" || b.s === "congrats" ? { ...b, do: [], shots: [] } : b)) };
  assert.match(p(L4, story, S4), /rule 4 \(hook = ending\)/);
  const L6 = { ...L, parts: [...L.parts, { id: "river", kind: "waterBody" }], beats: L.beats.map((b) => (b.s === "problem4" ? { ...b, do: [{ p: "river", v: "show" }] } : b)) };
  assert.match(p(L6, story, sentences), /rule 6 \(plant early\): river/);
  const L7 = { ...L, beats: L.beats.map((b) => (/^problem/.test(b.s) ? { ...b, state: { text: "FLOODED" } } : b)) };
  assert.match(p(L7, story, sentences), /rule 7 \(physical disasters\): 5 red labels/);
  assert.match(p(L, { ...story, recurring: { p: "duck" } }, sentences), /rule 8 \(one recurring prop\)/);
  const S9 = sentences.map((s) => (/^(fix|problem)[45]$/.test(s.role) ? { ...s, text: "This is a flap gate on the river outlet pipe." } : s));
  assert.match(p(L, story, S9), /rule 9: 5 "This is a…" lines/);
  const S3 = sentences.map((s) => (s.role === "fix2" ? { ...s, text: "So you slope the long concrete pipe downhill all the way from the street to the river bank." } : s));
  assert.match(p(L, story, S3), /rule 3 \(short sentences\): fix2 \(18 words\)/);
});

test("rule 10, action on the word: a state change moves to the verb that says it, free, and only forward", () => {
  const L10 = { beats: [{ s: "fix1", do: [{ p: "flap", v: "swing", w: "water" }, { p: "flap", v: "swingBack", w: "water" }] }], parts: [{ id: "flap", kind: "rig" }] };
  const S10 = [{ role: "fix1", text: "Water flowing out pushes it open, water pushing in forces it shut." }];
  const r = R.actOnTheWord(L10, S10, () => "swing");
  assert.deepEqual(r.layout.beats[0].do.map((a) => a.w), ["open", "shut"]);
  assert.equal(r.notes.length, 2);
  assert.deepEqual(R.actOnTheWord({ ...L10, approved: true }, S10, () => "swing").notes, [], "premade never changes");
});

test("rule 11, salvage never breaks the chain: a problem caused by a dropped fix goes with it, as a pair", () => {
  const sp = salvagePlan(roles, ["fix4"]);
  assert.ok(sp.drop.includes("fix4") && sp.drop.includes("problem4"));
  assert.ok(sp.drop.includes("problem5") && sp.drop.includes("fix5"), "problem5 was caused by fix4's flap gate");
  assert.ok(sp.keep.includes("problem3") && sp.keep.includes("fix3"));
});
