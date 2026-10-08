// Blocky Stories: the check of an avatar reference picture (avatarCheck.js) and the reference prompt it
// checks against (scripts/blocky/roster.mjs). No model is called here.
import test from "node:test";
import assert from "node:assert/strict";
import { avatarCheckPrompt, avatarCheckSchema, avatarVerdict, checkAvatar, pickBest } from "../supabase/functions/_shared/blocky/avatarCheck.js";
import { ROSTER, avatarPrompt } from "../scripts/blocky/roster.mjs";

const GOOD = {
  figures: 1, fullBody: true, frontView: true, cubeHead: true, neck: false, boxTorso: true, blockArms: true, hands: false, twoLegBlocks: true, hipOrFeet: false,
  flatFace: true, teethTongueLipsNose: false, headColourRight: true, torsoRight: true, legsRight: true, faceRight: true, accessoryRight: true, accessoryBlocky: true,
  extras: "", readableText: "", logos: false, brickToyLook: false, humanLook: false, plainWhiteBackground: true, sharpness: 5, notes: "",
};
const vex = ROSTER.find((a) => a.id === "vex");
const noob = ROSTER.find((a) => a.id === "noob");

test("a clean reference scores 100 and passes", () => {
  assert.deepEqual(avatarVerdict(GOOD), { ok: true, score: 100, hard: [], soft: [], problems: [] });
});

test("the owner's list: hands, legs, neck, cube head, colours, accessories each count", () => {
  for (const [change, word] of [[{ hands: true }, "hands"], [{ neck: true }, "neck"], [{ cubeHead: false }, "cube"], [{ twoLegBlocks: false }, "leg"], [{ headColourRight: false }, "colour"], [{ teethTongueLipsNose: true }, "tongue"]]) {
    const v = avatarVerdict({ ...GOOD, ...change });
    assert.equal(v.ok, false);
    assert.ok(v.score <= 40, `${word}: an unusable picture scores at most 40 (${v.score})`);
    assert.match(v.hard.join(" "), new RegExp(word));
  }
  const acc = avatarVerdict({ ...GOOD, accessoryRight: false });
  assert.deepEqual([acc.ok, acc.score, acc.soft], [true, 88, ["the accessory is missing or wrong"]]);
  const many = avatarVerdict({ ...GOOD, accessoryRight: false, accessoryBlocky: false, torsoRight: false, frontView: false });
  assert.deepEqual([many.ok, many.score], [false, 58], "enough small faults fail it too");
  assert.equal(avatarVerdict({ ...GOOD, sharpness: 3 }).score, 96);
});

test("a usable picture always beats an unusable one, and the best of four is picked", () => {
  const worstUsable = avatarVerdict({ ...GOOD, frontView: false, boxTorso: false, blockArms: false, hipOrFeet: true, torsoRight: false, legsRight: false, faceRight: false, sharpness: 1 });
  const bestUnusable = avatarVerdict({ ...GOOD, neck: true });
  assert.ok(bestUnusable.score <= 40 && avatarVerdict({ ...GOOD, accessoryRight: false, frontView: false }).score > bestUnusable.score);
  assert.ok(worstUsable.score >= 0);
  const four = [avatarVerdict({ ...GOOD, neck: true }), avatarVerdict({ ...GOOD, frontView: false }), avatarVerdict(GOOD), avatarVerdict(GOOD)];
  assert.equal(pickBest(four), 2, "the highest score; a tie goes to the earlier one");
  assert.equal(pickBest([null, four[1]]), 1, "a check that could not run is skipped");
  assert.equal(pickBest([]), -1);
  assert.equal(avatarVerdict(null).ok, false, "no answer is not a pass");
});

test("the check is told the avatar's own look, and an avatar with no accessory must have none", () => {
  const p = avatarCheckPrompt(vex);
  assert.match(p, /ONE blocky game avatar called Vex/);
  assert.match(p, /white cube head and white block arms/);
  assert.match(p, /a tall black top hat/);
  assert.match(avatarCheckPrompt(noob), /no hat, hair or accessory at all/);
  assert.doesNotMatch(`${p} ${avatarCheckPrompt(noob)}`, /\b(?:boy|girl|kid|child|man|woman|male|female)\b/i);
  const s = avatarCheckSchema();
  assert.deepEqual(s.required, Object.keys(s.properties));
  assert.equal(s.additionalProperties, false);
});

test("the reference prompt carries the four fixes: cube head with flat faces, front view, no tongue, blocky hair and accessories", () => {
  for (const a of ROSTER) {
    const p = avatarPrompt(a);
    assert.match(p, /seen straight from the front/, a.id);
    assert.match(p, /The head is a cube: six flat faces and straight edges/, a.id);
    assert.match(p, /no teeth, no tongue/, a.id);
    if (a.accessory) assert.match(p, /built from a few simple solid blocks with flat faces/, a.id);
    else assert.doesNotMatch(p, /Hair, hats and every accessory/, a.id);
    assert.match(p, /Body construction: the torso is one plain rectangular box/, a.id);
    assert.doesNotMatch(p, /\b(?:toy avatar|boy|girl|kid|child)\b/i, a.id);
  }
});

test("checkAvatar logs the call with its cost and returns the verdict", async () => {
  const rows = [];
  const admin = { from: () => ({ insert: async (row) => { rows.push(row); } }) };
  const out = await checkAvatar({ admin, apiKey: "k", imageUrl: "https://example.test/a.jpg", avatar: vex, fetchLlm: async (o) => { assert.equal(o.user[1].image_url, "https://example.test/a.jpg"); return { data: { ...GOOD, neck: true }, costUsd: 0.0012, httpStatus: 200, usage: {} }; } });
  assert.deepEqual([out.verdict.ok, out.costUsd, rows.length, rows[0].purpose, rows[0].cost_usd, rows[0].ok], [false, 0.0012, 1, "avatar_check", 0.0012, true]);
  await assert.rejects(checkAvatar({ admin, apiKey: "k", imageUrl: "x", avatar: vex, fetchLlm: async () => { throw new Error("down"); } }), /down/);
  assert.equal(rows[1].ok, false);
});
