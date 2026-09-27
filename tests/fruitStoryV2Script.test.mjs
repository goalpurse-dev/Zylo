import test from "node:test";
import assert from "node:assert/strict";
import { parseScript, matchCharacter } from "../src/components/viral-tools/ai-fruit-story-v2/script/parseScript.js";
import { CHARACTERS } from "../src/components/viral-tools/ai-fruit-story-v2/api/mock/mockData.js";
import { createMockAdapter } from "../src/components/viral-tools/ai-fruit-story-v2/api/mock/mockAdapter.js";

const fast = () => createMockAdapter({ timeScale: 0.001, paint: null });

test("matches names to library characters: full name, first name, any word, case-insensitive", () => {
  assert.equal(matchCharacter("Mia", CHARACTERS), "mia");
  assert.equal(matchCharacter("mia mango", CHARACTERS), "mia");
  assert.equal(matchCharacter("MARCO", CHARACTERS), "marco");
  assert.equal(matchCharacter("Pina", CHARACTERS), "pina"); // "Big Pina"
  assert.equal(matchCharacter("Mango", CHARACTERS), null); // Mia Mango and Marco Mango: ambiguous
  assert.equal(matchCharacter("Zed", CHARACTERS), null);
});

test("parses one scene per 'Name: line' and derives the cast from the speakers", () => {
  const p = parseScript("Mia: Tonight has to be perfect.\n\nMarco: Work was crazy, sorry I'm late.\nmia: You're wearing her cologne.", CHARACTERS);
  assert.equal(p.sceneCount, 3);
  assert.deepEqual(p.speakerIds, ["mia", "marco"]);
  assert.deepEqual(p.script.map((l) => l.speakerId), ["mia", "marco", "mia"]);
  assert.equal(p.script[1].line, "Work was crazy, sorry I'm late.");
  assert.equal(p.blocker, null);
});

test("lines without 'Name:' get a hint and don't count; times aren't mistaken for names", () => {
  const p = parseScript("Mia: Hi.\nno speaker here\nMarco: Dinner is at 10:30, right?\nThen Mia said: hello", CHARACTERS);
  assert.equal(p.sceneCount, 2);
  assert.deepEqual(p.lines.map((l) => l.status), ["ok", "no-name", "ok", "no-name"]);
  assert.equal(p.script[1].line, "Dinner is at 10:30, right?");
});

test("unmatched names block Next until assigned", () => {
  const text = "Zed: Where were you?\nMia: Out.";
  const before = parseScript(text, CHARACTERS);
  assert.deepEqual(before.unmatched, ["Zed"]);
  assert.match(before.blocker, /Choose who "Zed" is/);
  const after = parseScript(text, CHARACTERS, { zed: "walt" });
  assert.equal(after.blocker, null);
  assert.deepEqual(after.speakerIds, ["walt", "mia"]);
});

test("needs 2+ lines and at most 3 speakers; long lines are flagged", () => {
  assert.match(parseScript("Mia: Hi.", CHARACTERS).blocker, /at least two lines/);
  const four = parseScript("Mia: a\nMarco: b\nPia: c\nRick: d", CHARACTERS);
  assert.equal(four.tooManySpeakers, true);
  assert.match(four.blocker, /at most 3/);
  const long = parseScript(`Mia: ${"word ".repeat(21)}\nMarco: ok`, CHARACTERS);
  assert.equal(long.lines[0].long, true);
  assert.equal(long.lines[1].long, false);
  assert.equal(long.blocker, null); // a soft warning, not a blocker
});

test("mock createStory(script) derives the cast from the speakers", async () => {
  const api = fast();
  const { script } = parseScript("Mia: Tonight has to be perfect.\nMarco: Work was crazy, sorry I'm late.\nPia: Hi, Marco.", CHARACTERS);
  const story = await api.createStory({ source: "script", script, quality: "v2", lengthSec: 30, aspect: "9:16" });
  assert.deepEqual(story.castIds, ["mia", "marco", "pia"]);
  assert.deepEqual(story.scenes.map((s) => [s.speakerId, s.line]), script.map((r) => [r.speakerId, r.line]));
  for (const s of story.scenes) assert.ok(s.presentIds.length <= 3);
});

test("mock createStory(script) rejects 4+ speakers and non-library speakers", async () => {
  const api = fast();
  const four = ["mia", "marco", "pia", "rick"].map((speakerId) => ({ speakerId, line: "Hello." }));
  await assert.rejects(api.createStory({ source: "script", script: four, quality: "v2", lengthSec: 30, aspect: "9:16" }), /at most 3/);
  await assert.rejects(
    api.createStory({ source: "script", script: [{ speakerId: "nobody", line: "Hi." }, { speakerId: "mia", line: "Hey." }], quality: "v2", lengthSec: 30, aspect: "9:16" }),
    /character library/,
  );
});

test("story step unblocks once the script is ready (blocker null is not 'missing')", async () => {
  const { storyStepBlocker } = await import("../src/components/viral-tools/ai-fruit-story-v2/rules.js");
  const single = { method: "script", castIds: [] };
  const ready = parseScript("Mia: Hi.\nMarco: Hey.", CHARACTERS);
  assert.equal(storyStepBlocker(single, ready), null);
  assert.match(storyStepBlocker(single, parseScript("Mia: Hi.", CHARACTERS)), /at least two lines/);
});
