// SCENES step B: the scene pass (shots inside their scenes, house state, set pieces) and the script pronoun checks
import test from "node:test";
import assert from "node:assert/strict";
import { pieceEvents, sceneProblems } from "../lib/scenePass.js";
import { housesAt } from "../lib/scenes.js";
import { orphanPronouns, pronounProblems } from "../lib/scriptChecks.js";

test("a cut line leaves its pronoun orphaned", () => {
  const original = ["Mr. Hollis grabbed boards.", "He nailed them over a painting of a boat.", "The real window was behind him."];
  assert.equal(orphanPronouns({ original, kept: [original[0], original[1], original[2]] }).length, 0);
  assert.ok(orphanPronouns({ original, kept: [original[2]] }).length >= 1);
  assert.equal(pronounProblems(["Nell taped a sock to her window.", "She waited."]).length, 0);
});

test("a set piece on the houses becomes a house event when the list has none", () => {
  const scenes = [{ id: "s1", from: 0, to: 3, location: "main_street", time: "night", setPieces: [{ kind: "windows_glow", lines: [1, 2] }] }];
  const ev = pieceEvents(scenes, []);
  assert.deepEqual(ev.map((e) => [e.line, e.set.light]), [[1, "glow_white"], [3, "default"]]);
  const list = { houses: {}, houseEvents: ev };
  assert.equal(housesAt(list, 2)["*"].light, "glow_white");
  assert.equal(housesAt(list, 3)["*"].light, "default");
  assert.equal(pieceEvents(scenes, [{ line: 1, owners: ["*"], set: { light: "glow_white" } }]).length, 0);
});

test("continuity: a shot out of its scene is a problem unless its line is a marked aside", () => {
  const scenes = [{ id: "s1", from: 0, to: 1, location: "main_street", time: "night", setPieces: [] }];
  const tl = { scenes, shots: [{ line: 0, set: "street", light: "night", scene: "s1" }, { line: 1, set: "woods", light: "day", scene: "s1" }] };
  assert.equal(sceneProblems(tl).length, 2);
  tl.shots[1].sceneAside = "line 1 names another place";
  assert.equal(sceneProblems(tl).length, 0);
});
