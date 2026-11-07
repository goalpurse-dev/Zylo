// node --test dev/pets.test.mjs   (PETS 2026-11-07: normal-size animals as characters; free, mock director)
import test from "node:test";
import assert from "node:assert/strict";
import { checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../plan.mjs";
import { planPet } from "./petsProbe.mjs";
import { petShows, petStateFor, petLook, petsOf } from "../lib/pets.js";
import { extractKeys } from "../lib/visuals.js";
import { ANIMAL_ACTIONS, actionsOf } from "../page/kit/animals/species.js";
import { ANIMAL_STATES } from "../lib/catalog.js";

const dog = await planPet("pet_dog_bell");
const cat = await planPet("cat_roof");
const shotsOf = (tl, i) => tl.shots.filter((s) => (s.lines ?? [s.line]).includes(i) && s.camera !== "insert");
const petIn = (s, id) => (s.objects ?? []).find((o) => o.pet === id);

test("dog story: the mock director casts Biscuit as an animal character (species dog), not a prop or a person", () => {
  const c = dog.direction.production.cast.find((x) => x.id === "biscuit");
  assert.ok(c, "biscuit in the cast");
  assert.equal(c.kind, "animal");
  assert.equal(c.species, "dog");
  assert.ok(!dog.direction.production.props.some((p) => /biscuit/.test(p.name)), "no biscuit prop");
  assert.ok(!dog.tl.cast.biscuit, "not a people-kit person");
});

test("dog story: one fixed look (tl.pets) at real-world size, and every shot draws that pet", () => {
  const p = dog.tl.pets.biscuit;
  assert.equal(p.species, "dog"); assert.equal(p.kit, "dog");
  assert.ok(p.sizeM >= 0.5 && p.sizeM <= 1.0, `size ${p.sizeM}`);
  assert.equal(p.params.c.collar, "#e53935", "red collar");
  assert.equal(p.params.c.body, "#6e4423", "brown");
  assert.equal(p.params.extra?.bell, true, "the bell");
  const all = dog.tl.shots.flatMap((s) => (s.objects ?? []).filter((o) => o.pet));
  assert.ok(all.length >= 10, `${all.length} pet objects`);
  assert.ok(all.every((o) => o.pet === "biscuit" && o.name === "dog"));
});

test("dog story: Biscuit is on screen at a readable size in its lines (name, he / him pronoun leads), absent when the line says so", () => {
  for (const i of [2, 3, 5, 6, 7, 12, 14, 15, 17]) assert.ok(shotsOf(dog.tl, i).some((s) => petShows(s, "biscuit")), `line ${i}: ${dog.script.lines[i].text}`);
  assert.ok(shotsOf(dog.tl, 10).every((s) => !petIn(s, "biscuit")), "No Biscuit.");
});

test("dog story: the right actions (walk home, sniff, run, sit, bark) and shots about the dog framed at its height", () => {
  const st = (i) => shotsOf(dog.tl, i).map((s) => petIn(s, "biscuit")?.state).filter(Boolean);
  assert.ok(st(5).includes("walk")); assert.ok(st(6).includes("sniff")); assert.ok(st(7).includes("run"));
  assert.ok(st(12).includes("sit")); assert.ok(st(14).includes("bark"));
  for (const s of dog.tl.shots) {
    if (s.subject !== "thing:biscuit" || s.camera === "insert") continue;
    assert.equal(s.focus, "object", s.text); assert.equal(s.objects[0].pet, "biscuit", s.text);
    assert.ok(["low", "wide"].includes(s.camera), `${s.camera}: ${s.text}`); // at its height (not a person-height medium)
    assert.ok(!(s.actors ?? []).some((a) => /^town\d$/.test(a.id)), `no stand-in townsfolk: ${s.text}`);
  }
  assert.ok(!dog.tl.shots.some((s) => (s.actors ?? []).some((a) => a.hold === "toast")), "the name Biscuit is not a biscuit in a hand");
});

test("dog story: checkTimeline / checkVisuals / checkSubjects / checkProduction are clean", () => {
  assert.deepEqual(checkTimeline(dog.tl), []);
  assert.deepEqual(checkVisuals(dog.tl, dog.script), []);
  assert.deepEqual(checkSubjects(dog.tl), []);
  assert.deepEqual(checkProduction(dog.tl), []);
});

test("cat story: Pepper (grey, white paws) climbs, sits and hops; the pigeon is a normal-size animal that hops and flies", () => {
  const p = cat.tl.pets.pepper;
  assert.equal(p.species, "cat"); assert.equal(p.variant, "grey"); assert.equal(p.params.pattern?.socks, "#f7f5f2");
  const st = (i, id) => shotsOf(cat.tl, i).flatMap((s) => (s.objects ?? []).filter((o) => (id ? o.pet === id : o.name === "pigeon")).map((o) => o.state));
  assert.ok(st(3, "pepper").includes("climb"), "the cat climbed onto the roof");
  assert.ok(st(4, "pepper").includes("sit"), "She sat on the very edge");
  assert.ok(st(11, "pepper").includes("hop"), "Pepper jumped into my arms");
  assert.ok(st(8).includes("hop"), "the pigeon hopped"); assert.ok(st(12).includes("fly"), "the pigeon flew away");
  for (const i of [7, 8, 12]) assert.ok(shotsOf(cat.tl, i).some((s) => s.focus === "object" && s.objects[0].name === "pigeon" && !(s.actors ?? []).some((a) => /^town\d$/.test(a.id))), `pigeon line ${i}`);
  assert.deepEqual(checkTimeline(cat.tl), []);
  assert.deepEqual(checkVisuals(cat.tl, cat.script), []);
  assert.deepEqual(checkSubjects(cat.tl), []);
  assert.deepEqual(checkProduction(cat.tl), []);
});

test("pets: words -> keys, verbs -> states, looks -> params", () => {
  const vw = { people: new Map(), alias: {}, narrator: "Mia", monster: null, looseNames: new Set(), prop: null, pets: { biscuit: { id: "biscuit", name: "Biscuit", words: ["biscuit"], nouns: ["dog", "puppy"], kit: "dog", species: "dog" } } };
  assert.ok(extractKeys("Then Biscuit ran away.", vw).some((k) => k.kind === "pet" && k.id === "biscuit"));
  assert.ok(extractKeys("My little brown dog barked.", vw).some((k) => k.kind === "pet"));
  assert.ok(!extractKeys("Every dog wears a bell.", vw).some((k) => k.kind === "pet"), "every dog is generic");
  assert.ok(extractKeys("No Biscuit.", vw).find((k) => k.kind === "pet").neg);
  assert.equal(petStateFor("He sniffed the ground and barked", { species: "dog" }), "sniff");
  assert.equal(petStateFor("The pigeon flew away", { species: "pigeon" }), "fly");
  assert.equal(petStateFor("The dog flew down the stairs", { species: "dog" }), "hop");
  assert.equal(petLook("dog", "a dalmatian with a blue collar").variant, "dalmatian");
  assert.equal(petLook("dog", "a dalmatian with a blue collar").params.c.collar, "#1e88e5");
  assert.ok(petLook("cat", "a tiny kitten").sizeM < petLook("cat", "a cat").sizeM);
  assert.deepEqual(petsOf({ cast: [{ id: "rex", name: "Rex", kind: "human" }] }), {}, "people are no pets");
});

test("pets: the kit can do the pet actions (sit, sniff, bark, hop) as catalog states and rig actions", () => {
  for (const a of ["sit", "sniff", "bark"]) { assert.ok(ANIMAL_ACTIONS.includes(a)); assert.ok(actionsOf("dog").includes(a)); assert.ok(actionsOf("pigeon").includes(a)); }
  for (const s of ["sit", "sniff", "bark", "hop"]) assert.ok(ANIMAL_STATES.includes(s));
});
