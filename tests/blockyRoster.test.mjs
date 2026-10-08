// Blocky Stories: the roster of 52 avatars (scripts/blocky/roster.mjs; the list the owner approved on
// 2026-10-08). Every avatar is its own: name, role, personality, voice, main colour, signature accessory.
import test from "node:test";
import assert from "node:assert/strict";
import { ROSTER, avatarPrompt } from "../scripts/blocky/roster.mjs";
import { bannedNamesMessage } from "../supabase/functions/_shared/blocky/safety.js";

const PERSON_WORDS = /\b(\d+-year-old|years? old|aged \d+|woman|women|man|men|boys?|girls?|kids?|child|children|teen(ager)?s?|his|her|he|she)\b/i;
const unique = (list) => new Set(list).size === list.length;

test("52 avatars, every id, name, main colour, accessory, role, personality and voice its own", () => {
  assert.equal(ROSTER.length, 52);
  assert.ok(unique(ROSTER.map((a) => a.id)) && unique(ROSTER.map((a) => a.name.toLowerCase())), "ids and names");
  assert.ok(unique(ROSTER.map((a) => a.head)), "no two avatars share a main colour");
  assert.ok(unique(ROSTER.filter((a) => a.accessory).map((a) => a.accessory)), "no two avatars share an accessory");
  assert.deepEqual(ROSTER.filter((a) => !a.accessory).map((a) => a.id), ["noob"], "only the classic noob has none");
  assert.ok(unique(ROSTER.map((a) => a.tag)), "every avatar has its own role");
  assert.ok(unique(ROSTER.map((a) => a.role)), "and its own personality line");
  assert.ok(unique(ROSTER.map((a) => a.voice)), "and its own voice");
});

test("an avatar: a one-word name that is no real game, brand or creator, no age and no gender, nothing held", () => {
  for (const a of ROSTER) {
    assert.match(a.name, /^[A-Z][a-z]+$/, a.id);
    assert.equal(a.id, a.name.toLowerCase());
    assert.equal(bannedNamesMessage(`${a.name} ${a.tag} ${a.role}`), null, `${a.id}: a banned real name`);
    assert.doesNotMatch(`${a.look} ${a.face} ${a.voice} ${a.role} ${a.tag} ${a.tags.join(" ")}`, PERSON_WORDS, a.id);
    assert.match(a.torso, / torso with (no|one|two|three) [A-Za-z' -]+$/, `${a.id}: one simple torso shape`);
    if (a.accessory) assert.doesNotMatch(a.accessory, /\b(holding|holds|in (one|a) hand|sword|gun|knife|axe|bomb|weapon)\b/i, `${a.id}: worn, never held, never a weapon`);
    assert.doesNotMatch(`${a.torso} ${a.accessory ?? ""}`, /\b(letter|word|text|number|logo|brand)\b/i, a.id);
    assert.equal(a.tags.length, 3);
    const p = avatarPrompt(a);
    assert.ok(p.length < 2000, `${a.id}: the reference prompt fits (${p.length})`);
  }
});

test("no avatar wears cyan with magenta (the neon pair that is banned everywhere else)", () => {
  for (const a of ROSTER) {
    const colours = `${a.head} ${a.torso} ${a.legs} ${a.accessory ?? ""}`.toLowerCase();
    assert.ok(!(/\bcyan\b/.test(colours) && /\bmagenta\b/.test(colours)), a.id);
  }
  const glitch = ROSTER.find((a) => a.id === "glitch");
  assert.deepEqual([glitch.head, glitch.legs], ["cyan", "orange"]);
});
