// Blocky Worlds: the beat sheet's RULE VISUAL from the writer's plan to the director and the world bible (owner,
// 2026-11-10: "THE STORY IS IN THE PICTURE ... The world bible gets a 'rule visual' field the director must use in the
// opening and the neighbour shots"). Data only (the engine's picture comes later). All free (no network).
import test from "node:test";
import assert from "node:assert/strict";
import { planCard } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";
import { validateProduction, productionSchema } from "../scripts/blockyWorlds/engine/lib/director/spec.js";
import { directorPrompt, DIRECTOR_SYSTEM } from "../scripts/blockyWorlds/engine/lib/director/design.js";
import { linesOf } from "../scripts/blockyWorlds/engine/lib/director/mock.js";
import { ruleVisualFor, applyBible } from "../scripts/blockyWorlds/engine/lib/worldBible.js";

const PLAN = {
  title: "Low Houses Hear", opener: "In this town, poorer people live on the ground and richer people live higher up.",
  rule_visual: { parameter: "how high your house floats", description: "houses hover on ropes at heights that match their coins",
    neighbours: [{ name: "Mr. Pell", shows: "ten floors up" }, { name: "Captain Huxworth", shows: "above the clouds" }, { name: "Mrs. Quibble", shows: "just above the fence" }],
    hero: "half sunk into the mud", opening_shot: "a street of floating houses" },
  neighbours: [{ name: "Mr. Pell", joke: "j", shows: "s" }, { name: "Captain Huxworth", joke: "j", shows: "s" }, { name: "Mrs. Quibble", joke: "j", shows: "s" }],
  hero: { name: "Tilly", who: "ten", worst: "lowest", flaw: "lives in the mud" }, ally: { name: "Nub", who: "friend", line: "Low houses hear everything first.", why: "w" },
  beats: [{ beat: "rule", intent: "", shows: "", lines: [] }],
};
const card = planCard(PLAN, "In this town, poorer people live on the ground and richer people live higher up.");
const SCRIPT = { lines: [
  { part: "rule", beat: "rule", text: "In this town, poorer people live on the ground and richer people live higher up." },
  { part: "tour", beat: "origin", text: "You see, every coin lifts your house a little." },
  { part: "tour", beat: "neighbours", text: "Mr. Pell's house floats ten floors up." },
  { part: "tour", beat: "neighbours", text: "He waves at birds." },
  { part: "tour", beat: "neighbours", text: "Captain Huxworth has snow on his roof." },
  { part: "tour", beat: "neighbours", text: "Mrs. Quibble floats just above the fence." },
  { part: "me", beat: "me", text: "Then there's me. The lowest house in town." },
  { part: "until", beat: "trigger", text: "Until one day Mr. Pell's rope snapped." },
] };

test("director: the card's rule visual and planted line and each line's beat are in the prompt; the system asks for them", () => {
  const p = directorPrompt({ lines: linesOf({ script: SCRIPT }), idea: card });
  assert.match(p, /"rule_visual":\{"parameter":"how high your house floats"/);
  assert.match(p, /"who":"Mr\. Pell","shows":"ten floors up"/);
  assert.match(p, /"planted_line":"Low houses hear everything first\."/);
  assert.match(p, /^2 \[tour \/ neighbours\] Mr\. Pell's house/m);
  assert.match(DIRECTOR_SYSTEM, /bible\.rule_visual \(THE STORY IS IN THE PICTURE\)/);
  assert.match(DIRECTOR_SYSTEM, /ruleVisual \(what the rule visual shows on this line: REQUIRED on the opening lines/);
  // an old card (no rule visual) leaves the prompt as it was
  assert.doesNotMatch(directorPrompt({ lines: [{ part: "rule", text: "x" }], idea: { title: "t" } }), /rule_visual|planted_line| \/ /);
});

test("director schema + validation: bible.rule_visual and line.ruleVisual are carried (optional for old lists)", () => {
  const sch = productionSchema();
  assert.ok(sch.properties.bible.required.includes("rule_visual"));
  assert.ok(sch.properties.lines.items.required.includes("ruleVisual"));
  const raw = { worlds: [{ id: "town", kind: "outdoor" }], cast: [{ id: "me", role: "narrator" }, { id: "mr_pell", name: "Mr. Pell" }],
    bible: { rule_visual: { parameter: "house height", description: "d", values: [{ who: "Mr. Pell", shows: "ten floors" }], hero: "in the mud" } },
    lines: [{ line: 0, world: "town", subject: "me", ruleVisual: "a street of houses at many heights" }, { line: 1, world: "town", subject: "mr_pell", ruleVisual: "" }] };
  const { production } = validateProduction(raw, { lineCount: 2 });
  assert.deepEqual(production.bible.rule_visual, { parameter: "house height", description: "d", values: [{ who: "Mr. Pell", shows: "ten floors" }], hero: "in the mud" });
  assert.equal(production.lines[0].ruleVisual, "a street of houses at many heights");
  assert.equal("ruleVisual" in production.lines[1], false);
  const old = validateProduction({ worlds: [{ id: "town" }], lines: [{ line: 0, world: "town" }] }, { lineCount: 1 }).production;
  assert.equal(old.bible.rule_visual, undefined);
  assert.equal("ruleVisual" in old.lines[0], false);
});

test("world bible: the rule visual from the plan, per line on the opening, neighbour and me lines; the director's lines win", () => {
  const rv = ruleVisualFor({ script: SCRIPT, idea: card });
  assert.equal(rv.parameter, "how high your house floats");
  assert.equal(rv.hero.name, "Tilly");
  assert.equal(rv.lines[0], "houses hover on ropes at heights that match their coins");
  assert.equal(rv.lines[1], rv.lines[0]);
  assert.equal(rv.lines[2], "Mr. Pell: ten floors up");
  assert.equal(rv.lines[3], undefined); // "He waves at birds": no name, no value
  assert.equal(rv.lines[4], "Captain Huxworth: above the clouds");
  assert.equal(rv.lines[5], "Mrs. Quibble: just above the fence");
  assert.equal(rv.lines[6], "Tilly: half sunk into the mud");
  assert.equal(rv.lines[7], undefined); // the trigger names Mr. Pell, but it is not a rule-visual beat
  const withDir = ruleVisualFor({ production: { bible: { rule_visual: { parameter: "house height", description: "", values: [], hero: "" } }, lines: [{ line: 3, ruleVisual: "Mr. Pell waves from the tenth floor" }] }, script: SCRIPT, idea: card });
  assert.equal(withDir.parameter, "house height");
  assert.equal(withDir.lines[3], "Mr. Pell waves from the tenth floor");
  assert.equal(withDir.neighbours.length, 3); // the plan fills what the director left open
  assert.equal(ruleVisualFor({ script: SCRIPT, idea: { title: "old card" } }), null);
});

test("world bible: applyBible gives the shots of those lines the planner hint shot.ruleVisual", () => {
  const bible = { seed: 5, cast: {}, townsfolk: [], spots: [], places: [], town: { seed: 5, name: "t" }, ruleVisual: ruleVisualFor({ script: SCRIPT, idea: card }) };
  const tl = { cast: {}, worlds: {}, shots: [{ line: 2, set: "street", text: "x" }, { line: 3, set: "street", text: "y" }, { lines: [6], line: 6, set: "street", text: "z" }] };
  applyBible(tl, bible);
  assert.deepEqual(tl.shots[0].ruleVisual, { parameter: "how high your house floats", shows: "Mr. Pell: ten floors up" });
  assert.equal(tl.shots[1].ruleVisual, undefined);
  assert.equal(tl.shots[2].ruleVisual.shows, "Tilly: half sunk into the mud");
});
