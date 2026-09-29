import test from "node:test";
import assert from "node:assert/strict";
import { CHARACTERS, IDEA_SETS } from "../src/components/viral-tools/ai-fruit-story-v2/api/mock/mockData.js";
import { matchCharacter } from "../src/components/viral-tools/ai-fruit-story-v2/script/parseScript.js";

test("the mock library is the real 170-character library", () => {
  assert.equal(CHARACTERS.length, 170);
  assert.equal(CHARACTERS.filter((c) => c.collection === "uk-roadman").length, 20);
  for (const c of CHARACTERS) {
    assert.match(c.refImageUrl, /^https:\/\/.+\/storage\/v1\/object\/public\/public-assets\/fruit-characters\/[a-z-]+\/[a-z0-9-]+-a\d+\.jpg$/, c.id);
    assert.ok(c.name && c.tag && c.role && c.voiceStyle && ["female", "male"].includes(c.gender), c.id);
  }
});

test("first names are unique, so every character can be named in a script", () => {
  const firsts = CHARACTERS.map((c) => c.name.split(" ")[0].toLowerCase());
  assert.equal(new Set(firsts).size, firsts.length);
  for (const c of CHARACTERS) assert.equal(matchCharacter(c.name.split(" ")[0], CHARACTERS), c.id, c.name);
});

test("every idea uses 2–3 library characters", () => {
  const ids = new Set(CHARACTERS.map((c) => c.id));
  for (const idea of IDEA_SETS.flat()) {
    assert.ok(idea.castIds.length >= 2 && idea.castIds.length <= 3, idea.id);
    for (const id of idea.castIds) assert.ok(ids.has(id), `${idea.id}: ${id}`);
  }
});
