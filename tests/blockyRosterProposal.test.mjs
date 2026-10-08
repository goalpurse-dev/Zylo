// Blocky Stories: the proposed 28 avatars (scripts/blocky/rosterProposal.mjs) follow the roster's rules, so
// that an approved list can move into the roster as it is. No picture is made from the proposal.
import test from "node:test";
import assert from "node:assert/strict";
import { ROSTER, avatarPrompt } from "../scripts/blocky/roster.mjs";
import { FULL_ROSTER, PROPOSED } from "../scripts/blocky/rosterProposal.mjs";
import { bannedNamesMessage } from "../supabase/functions/_shared/blocky/safety.js";

const PERSON_WORDS = /\b(\d+-year-old|years? old|aged \d+|woman|women|man|men|boys?|girls?|kids?|child|children|teen(ager)?s?|his|her|he|she)\b/i;
const unique = (list) => new Set(list).size === list.length;

test("52 avatars: 24 in the roster and 28 proposed, every id, name, main colour and accessory its own", () => {
  assert.equal(ROSTER.length, 24);
  assert.equal(PROPOSED.length, 28);
  assert.ok(FULL_ROSTER.length >= 50);
  assert.ok(unique(FULL_ROSTER.map((a) => a.id)) && unique(FULL_ROSTER.map((a) => a.name.toLowerCase())), "ids and names");
  assert.ok(unique(FULL_ROSTER.map((a) => a.head)), "no two avatars share a main colour");
  const worn = FULL_ROSTER.filter((a) => a.accessory).map((a) => a.accessory);
  assert.ok(unique(worn), "no two avatars share an accessory");
  assert.equal(FULL_ROSTER.filter((a) => !a.accessory).length, 1, "only the classic noob has none");
  assert.ok(unique(FULL_ROSTER.map((a) => a.tag)), "every avatar has its own role");
  assert.ok(unique(FULL_ROSTER.map((a) => a.role)), "and its own personality line");
  assert.ok(unique(FULL_ROSTER.map((a) => a.voice)), "and its own voice");
});

test("a proposed avatar: a one-word name that is no real game, brand or creator, no age and no gender, nothing held", () => {
  for (const a of PROPOSED) {
    assert.match(a.name, /^[A-Z][a-z]+$/, a.id);
    assert.equal(a.id, a.name.toLowerCase());
    assert.equal(bannedNamesMessage(`${a.name} ${a.tag} ${a.role}`), null, `${a.id}: a banned real name`);
    assert.doesNotMatch(`${a.look} ${a.face} ${a.voice} ${a.role} ${a.tag} ${a.tags.join(" ")}`, PERSON_WORDS, a.id);
    assert.match(a.torso, / torso with (one|two|three) [A-Za-z' -]+ shapes?$/, `${a.id}: one simple torso shape`);
    assert.doesNotMatch(a.accessory, /\b(holding|holds|in (one|a) hand|sword|gun|knife|axe|bomb|weapon)\b/i, `${a.id}: worn, never held, never a weapon`);
    assert.doesNotMatch(`${a.torso} ${a.accessory}`, /\b(letter|word|text|number|logo|brand)\b/i, a.id);
    assert.equal(a.tags.length, 3);
    const p = avatarPrompt(a);
    assert.ok(p.length < 2000, `${a.id}: the reference prompt fits (${p.length})`);
    assert.doesNotMatch(p.replace(/no brick-toy minifigures/, ""), /toy/i, a.id);
  }
});
