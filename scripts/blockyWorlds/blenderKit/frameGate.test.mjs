import test from "node:test";
import assert from "node:assert/strict";
import { parseGate, gateProblems } from "./frameGate.mjs";
import { creatureTease } from "./director.mjs";

const log = [
  "shot 3 ok",
  "ZW_LOOK|downtown_street|day|Standard|exposure 0.0",
  "ZW_GATE|3|Kid3|face_cut|head u -0.10-0.40 v 0.20-0.45",
  "ZW_GATE|4|Kid6|face_under_captions|head v 0.60-0.80",
  "ZW_GATE|5|Monster|monster_wall|covers 96% of the frame, crosses 4 edges",
  "ZW_GATE|6|Monster|monster_wall|covers 90% of the frame, crosses 3 edges",
  "random line",
].join("\n");

test("parseGate: only the ZW_GATE lines", () => {
  const g = parseGate(log);
  assert.equal(g.length, 4);
  assert.deepEqual(g[0], { shot: 3, name: "Kid3", kind: "face_cut", why: "head u -0.10-0.40 v 0.20-0.45" });
});

test("faces cut or under the captions fail; a monster wall fails unless the desc is a hint", () => {
  const shots = [{ id: 3, desc: "Mia close" }, { id: 4, desc: "two friends" }, { id: 5, desc: "the monster roars" }, { id: 6, desc: "only its shadow on the wall" }];
  const { problems } = gateProblems({ gate: parseGate(log), shots, tease: creatureTease });
  assert.match(problems[3], /CUT by the frame edge/);
  assert.match(problems[4], /UNDER THE CAPTIONS/);
  assert.match(problems[5], /flat wall/);
  assert.equal(problems[6], undefined);
});

test("a monster never shown in full flags a shot, even when every shot is a hint", () => {
  const shots = [{ id: 6, desc: "only its shadow on the wall" }];
  const { problems } = gateProblems({ gate: parseGate(log), shots, tease: creatureTease });
  assert.match(problems[6], /never shown in full/);
});

test("shown once (this round or before) clears the at-least-once rule", () => {
  const shots = [{ id: 6, desc: "only its shadow on the wall" }, { id: 7, desc: "the monster" }];
  const gate = [...parseGate(log), { shot: 7, name: "Monster", kind: "monster_shown", why: "covers 40%" }];
  const r = gateProblems({ gate, shots, tease: creatureTease });
  assert.equal(r.problems[6], undefined);
  assert.equal(r.shown.Monster, 7);
  assert.equal(gateProblems({ gate: parseGate(log), shots: [{ id: 6, desc: "only its shadow on the wall" }], tease: creatureTease, shownBefore: { Monster: 2 } }).problems[6], undefined);
});
