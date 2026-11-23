// Round 9f (owner 2026-11-23): acting as plan data + a check, time of day as state, scene-start marks, the new verbs
import test from "node:test";
import assert from "node:assert/strict";
import { actingProblems, autoActing, timeProblems, sceneStartMarks, isMark, ACTIONS8, SHOTS8 } from "../scripts/blockyWorlds/blenderKit/takes.mjs";

const plan = (acting) => ({ scenes: [{ id: 1, lines: [1, 2], place: "st", time: "night" }], acting });
const states = [null, { st: { people: { me: { here: true } }, monster: { here: false } } }, { st: { people: { me: { here: true } }, monster: { here: true } } }];
const lines = [{ text: "a" }, { text: "b" }];

test("a neutral face next to the monster fails the acting check", () => {
  const p = plan({ danger_over: {}, lines: { 1: { me: { feel: "calm", look_at: "street", want: "x" } }, 2: { me: { feel: "calm", look_at: "street", want: "x" }, monster: { feel: "hungry", look_at: "me", want: "x" } } } });
  const out = actingProblems(p, lines, states);
  assert.equal(out.length, 1);
  assert.match(out[0], /line 2: me can see the monster/);
});

test("scared and looking at the monster passes; after the danger is over any feel passes", () => {
  const ok = { me: { feel: "scared", look_at: "monster", want: "x" }, monster: { feel: "hungry", look_at: "me", want: "x" } };
  assert.equal(actingProblems(plan({ lines: { 1: { me: { feel: "calm", look_at: "dad", want: "x" } }, 2: ok } }), lines, states).length, 0);
  const after = { me: { feel: "confident", look_at: "monster", want: "x" }, monster: { feel: "angry", look_at: "me", want: "x" } };
  assert.equal(actingProblems(plan({ danger_over: { me: 2 }, lines: { 1: { me: { feel: "calm", look_at: "dad", want: "x" } }, 2: after } }), lines, states).length, 0);
});

test("a character on stage with no acting fails; autoActing fills it (scared at the monster)", () => {
  const p = plan({ lines: {} });
  assert.ok(actingProblems(p, lines, states).length >= 2);
  autoActing(p, lines, states);
  assert.equal(p.acting.lines[2].me.feel, "scared");
  assert.equal(p.acting.lines[2].me.look_at, "monster");
  assert.equal(actingProblems(p, lines, states).length, 0);
});

test("the time of day changes only on a line that says so", () => {
  const sc = [{ lines: [1, 1], time: "sunset" }, { lines: [2, 2], time: "night" }, { lines: [3, 3], time: "sunset" }];
  assert.equal(timeProblems({ scenes: sc }, [{ text: "a" }, { text: "after the sun goes down" }, { text: "he stops at 6," }]).length, 0);
  const bad = timeProblems({ scenes: sc }, [{ text: "a" }, { text: "because a chalk line" }, { text: "x" }]);
  assert.equal(bad.length, 2);
});

test("a scene after a time skip starts with people at new marks; the new marks, verbs and shots exist", () => {
  const S = { st: { people: { dad: { here: true, mark: "@1,2" } } } };
  const S2 = sceneStartMarks(S, { place: "st", marks: { Dad: "door" } });
  assert.equal(S2.st.people.dad.mark, "door");
  assert.equal(S.st.people.dad.mark, "@1,2");
  for (const m of ["door", "door_side", "line_front"]) assert.ok(isMark(m));
  for (const a of ["back_away", "hide", "try_draw", "put_in_pocket", "take_out"]) assert.ok(a in ACTIONS8);
  for (const k of ["hand", "behind", "lamps"]) assert.ok(SHOTS8.includes(k));
});

test("round 9g: an exception starts ON its word (at: word) or its line (at: line); watching sends nobody out", async () => {
  const { ruleExceptions } = await import("../scripts/blockyWorlds/blenderKit/takes.mjs");
  const lines = [{ text: "So I ran outside, I pulled the chalk out" }, { text: "Now kids play outside after dark" }];
  const plan = { rule_check: { exceptions: [{ who: "me", from_line: 1, to_line: 2, because: "I ran outside", at: "word" }, { who: "kid", from_line: 2, to_line: 2, because: "kids play outside after dark", at: "line" }, { who: "dad", from_line: 1, to_line: 1, because: "I watched our line wash away" }] } };
  const X = ruleExceptions(plan, lines);
  assert.equal(X.fromWord[1].me, 1);
  assert.equal(X.fromWord[2].kid, 0);
  assert.equal(X.invalid.length, 1);
  assert.deepEqual(X.outside[2], ["me", "kid"]);
});
