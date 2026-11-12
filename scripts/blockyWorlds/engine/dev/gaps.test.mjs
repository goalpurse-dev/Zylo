// GAPS agent (2026-11-05): the actions, giant behaviours and animal motions the real stress run asked for most.
//   node --test dev/gaps.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { supports } from "../lib/capabilities.js";
import { POSES_N, ACTION_WORDS } from "../lib/director/vocab.js";
import { GIANT_ACTIONS } from "../lib/epic.js";
import { ANIMAL_STATES } from "../lib/catalog.js";
import { extractKeys, OBJECT_CATALOG } from "../lib/visuals.js";
import { planVideo, estimateWords, checkTimeline, checkVisuals, checkSubjects, checkProduction, POSES, pairHugs } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";

test("every character action the director can ask for is a ready pose", () => {
  for (const a of Object.keys(ACTION_WORDS)) assert.ok(POSES_N.includes(a), a);
  assert.deepEqual(supports("character.action", { action: Object.keys(ACTION_WORDS) }).unsupported, []);
  assert.deepEqual([...POSES].sort(), [...POSES_N].filter((p) => p !== "cover_mouth").sort());
});

test("giants: the asked behaviours are ready; animals and built creatures move", () => {
  for (const b of ["reach", "sleep", "lurk", "reveal", "carry", "eat", "fly", "climb", "flee", "howl", "dig"]) {
    assert.ok(GIANT_ACTIONS.includes(b), b);
    assert.deepEqual(supports("giant", { behaviour: b }).unsupported, [], b);
  }
  for (const b of ["walk", "fly", "run", "sleep", "swim", "carry", "eat", "howl"]) assert.deepEqual(supports("creature.animal", { behaviour: b }).unsupported, [], b);
  for (const b of ["walk", "run", "reach", "carry", "swim", "fly"]) assert.deepEqual(supports("creature.built", { behaviour: b }).unsupported, [], b);
  for (const s of ["walk", "fly", "sleep", "swim"]) assert.ok(OBJECT_CATALOG.dog.states.includes(s) && ANIMAL_STATES.includes(s));
});

test("a verb gets its pose only when a person does it", () => {
  const vw = { people: new Map(), alias: {}, looseNames: new Set(), narrator: "Pip" };
  const rules = (t) => extractKeys(t, vw).filter((k) => k.kind === "rule").map((k) => `${k.rule}${k.pose ? `:${k.pose}` : ""}`);
  assert.deepEqual(rules("I hugged Mom."), ["grab:hug"]);
  assert.deepEqual(rules("I climbed the stalks."), ["walk:climb"]);
  assert.ok(rules("We swam to shore.").includes("swim"));
  assert.ok(!rules("Snow fell all night.").includes("fall"));     // not a person
  assert.ok(!rules("Then I fell asleep.").includes("fall"));      // falling asleep is sleep
  assert.ok(!rules("The fog eats your sneeze.").includes("eat"));
});

test("a hug pairs two people face to face", () => {
  const actors = [{ id: "me", pose: "hug", facing: "camera" }, { id: "mom", pose: "talk", facing: "camera", expr: "neutral" }];
  pairHugs(actors);
  assert.equal(actors[1].pose, "hug"); assert.equal(actors[0].facing, "mom"); assert.equal(actors[1].facing, "me");
});

test("a story using the new actions plans clean, with and without the director", async () => {
  const script = { title: "Hug Day", lines: [
    { part: "rule", text: "In this town, you hug your neighbor before the bell." },
    { part: "tour", text: "Grandma climbs the ladder to ring it." },
    { part: "me", text: "I'm Pip, and I jumped the fence to be first." },
    { part: "until", text: "Until one night, a giant owl was sleeping on the bell tower." },
    { part: "discovery", text: "It reached down and grabbed the bell." },
    { part: "climax", text: "I threw my shoe and it flew away." },
    { part: "closer", text: "Now we hug the owl too." }] };
  const idea = { title: "Hug Day", mood: "wholesome", setting: "a small town", prop: "a shoe" };
  for (const direction of [null, await directStory({ script, idea, provider: "mock", exists: () => true })]) {
    const tl = planVideo({ script, words: estimateWords(script), idea, lengthSec: 30, direction, exists: () => true });
    assert.deepEqual(checkTimeline(tl), []); assert.deepEqual(checkVisuals(tl, script), []); assert.deepEqual(checkSubjects(tl), []);
    if (direction) assert.deepEqual(checkProduction(tl), []);
    const poses = new Set(tl.shots.flatMap((s) => (s.actors ?? []).map((a) => a.pose)));
    for (const p of ["hug", "climb", "jump", "throw"]) assert.ok(poses.has(p), `${p} in ${[...poses]}`);
  }
});
