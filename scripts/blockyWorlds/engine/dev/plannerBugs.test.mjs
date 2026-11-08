// PLANNER-BUGS 2026-11-08 (owner's review of step 2B): giants never people, role words / nicknames merge into the named
// person, animals keep an animal look, props by head noun in their sense, the world object opens the story.
import test from "node:test";
import assert from "node:assert/strict";
import { roleDuplicateProblems, scriptRelations } from "../plan.mjs";
import { headAt } from "../lib/propSense.js";
import { worldObject, kitCoversAll } from "../lib/critical.js";
import { buildWorldBible, worldBibleProblems } from "../lib/worldBible.js";
import { heldIndex } from "../lib/catalog.js";

test("a role word next to the named person is a duplicate; the script ties it", () => {
  const tl = { cast: { me: { name: "Wren" }, odette: { name: "Grandma Odette" }, grandma: { name: "Grandma" } }, lines: [{ text: "I'm Wren." }] };
  assert.equal(roleDuplicateProblems(tl).length, 1);
  const tl2 = { cast: { me: { name: "Tobin" }, wren: { name: "Wren" }, sister: { name: "Sister" } }, lines: [{ text: "My big sister Wren checks every curtain." }] };
  assert.match(roleDuplicateProblems(tl2)[0], /Sister.*Wren/);
  const tl3 = { cast: { me: { name: "Tilly" }, squeak: { name: "Squeak" } }, lines: [{ text: "Kids call me Squeak." }] };
  assert.match(roleDuplicateProblems(tl3)[0], /nickname/);
  const tl4 = { cast: { me: { name: "Pip" }, wolf: { name: "Wolf" } }, giants: { wolf: {} }, lines: [] };
  assert.match(roleDuplicateProblems(tl4)[0], /giant/);
});

test("scriptRelations: 'my big sister Wren' and a 'Grandma Odette' title", () => {
  const world = { people: new Map([["me", { name: "Tobin" }], ["wren", { name: "Wren" }], ["odette", { name: "Grandma Odette" }]]), alias: {}, scriptLines: ["My big sister Wren checks every curtain."] };
  scriptRelations(world);
  assert.equal(world.alias.sister, "wren");
  assert.equal(world.alias.grandma, "odette");
});

test("head nouns in their sense", () => {
  const t = (s) => s.toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean);
  assert.equal(headAt(t("My chipped blue coin bank holds one button."), "coin"), -1);
  assert.ok(headAt(t("My chipped blue coin bank holds one button."), "bank") >= 0);
  assert.equal(headAt(t("Inside, a feather duster was tied to the bell."), "feather"), -1);
  assert.equal(headAt(t("Nobody ever rang a wrong note."), "note", "rang bells"), -1);
  assert.equal(headAt(t("The turtle's steps slowed."), "steps"), -1);
  assert.equal(heldIndex().get("coin"), "coin");
  assert.equal(heldIndex().get("duster"), "feather_duster");
  assert.equal(heldIndex().get("mirror"), "hand_mirror");
});

test("the world object: a landmark the opening names, else the creature world", () => {
  const p = { props: [{ id: "stilts", name: "tall stilt houses with coin gauges", size: "landmark" }, { id: "cottage", name: "Odette's cottage", size: "big" }] };
  assert.equal(worldObject({ production: p, script: { lines: [{ text: "In this town, the poor live on the ground." }, { text: "Every stilt grows with the coins inside." }] } }).id, "stilts");
  const c = { worlds: [{ id: "in", kind: "creature", creature: { species: "turtle", relation: "inside" } }], creatures: [{ id: "giant_turtle", species: "turtle" }], props: [] };
  assert.equal(worldObject({ production: c, script: { lines: [{ text: "In this town, we live inside a giant turtle." }] } }).kind, "creature");
  assert.equal(kitCoversAll("tall stilt houses with coin gauges", "house_front", ["house", "houses"]), false);
  assert.equal(kitCoversAll("tower steps", "stairs", ["stairs", "steps"]), true);
});

test("an animal of the cast has an animal look in the bible", () => {
  const production = { cast: [{ id: "me", name: "Tuli", kind: "human", role: "narrator", look: "teal hoodie" }, { id: "biscuit", name: "Biscuit", kind: "animal", species: "dog", look: "little brown dog, red collar" }], props: [], worlds: [], creatures: [], lines: [] };
  const bible = buildWorldBible({ production, script: { lines: [{ text: "My dog Biscuit." }] }, title: "t" });
  assert.equal(bible.cast.biscuit.look.animal, true);
  assert.equal(bible.cast.biscuit.look.species, "dog");
  assert.equal(bible.cast.biscuit.look.top, undefined);
  assert.equal(worldBibleProblems({ world: bible, shots: [] }).filter((p) => /animal/.test(p)).length, 0);
});
