// AI Fruit Story v2 picture check (offline): prompt, schema, verdicts, logging.
import test from "node:test";
import assert from "node:assert/strict";
import { checkPicture, checkPrompt, checkSchema, verdictOf } from "../supabase/functions/_shared/fruit/pictureCheck.js";

const expected = [{ name: "Maya Mango", fruit: "mango" }, { name: "Piper Pine", fruit: "pineapple" }, { name: "Kai Coconut", fruit: "coconut" }];
const good = () => [{ name: "Maya Mango", visible: true, hasFruitHead: true }, { name: "Piper Pine", visible: true, hasFruitHead: true }, { name: "Kai Coconut", visible: true, hasFruitHead: true }];
const answer = (over = {}) => ({ characters: good(), figuresInPicture: 3, humanHeads: 0, notes: "", ...over });

test("the check asks for each fruit head by name and counts every figure", () => {
  const p = checkPrompt(expected);
  assert.match(p, /exactly 3 characters/);
  assert.match(p, /- Piper Pine: a pineapple head/);
  assert.deepEqual(checkSchema().required, ["characters", "figuresInPicture", "humanHeads", "notes"]);
});

test("verdicts: all fruit heads passes; a human head, a missing character or an extra figure fails", () => {
  assert.deepEqual(verdictOf(answer(), expected), { ok: true, problems: [] });
  const chars = good();
  chars[1].hasFruitHead = false;
  const human = verdictOf(answer({ humanHeads: 1, characters: chars }), expected);
  assert.equal(human.ok, false);
  assert.deepEqual(human.problems, ["Piper Pine is drawn without their pineapple head", "1 human head in the picture"]);
  assert.deepEqual(verdictOf(answer({ characters: good().slice(0, 2), figuresInPicture: 2 }), expected).problems, ["Kai Coconut is missing"]);
  assert.deepEqual(verdictOf(answer({ figuresInPicture: 4 }), expected).problems, ["4 figures instead of 3"]);
  const first = good();
  first[0].name = "Maya";
  assert.equal(verdictOf(answer({ characters: first }), expected).ok, true, "first names match");
});

test("every check is logged with its cost; a failed call is logged and thrown (the engine then keeps the picture)", async () => {
  const rows = [];
  const admin = { from: () => ({ insert: async (row) => { rows.push(row); return {}; } }) };
  const ok = await checkPicture({
    admin, apiKey: "k", imageUrl: "https://x/p.jpg", expected, ids: { story_id: "s", scene_id: "c", job_id: "j", user_id: "u" },
    fetchLlm: async (req) => {
      assert.equal(req.model, "gpt-5-mini");
      assert.equal(req.user[1].type, "input_image");
      return { data: answer(), costUsd: 0.0009, httpStatus: 200, usage: { inputTokens: 1200, outputTokens: 300 }, latencyMs: 2100 };
    },
  });
  assert.equal(ok.ok, true);
  assert.equal(rows[0].purpose, "picture_check");
  assert.equal(rows[0].cost_usd, 0.0009);
  assert.equal(rows[0].job_id, "j");
  await assert.rejects(checkPicture({ admin, apiKey: "k", imageUrl: "u", expected, ids: {}, fetchLlm: async () => { throw Object.assign(new Error("openai 500"), { details: { costUsd: 0 } }); } }));
  assert.equal(rows[1].ok, false);
});

test("fruit looks come from the character library (Kai is a GREEN young coconut; leaf crowns are not hair)", async () => {
  const { FRUIT_LOOKS, headLook } = await import("../supabase/functions/_shared/fruit/fruitLooks.js");
  const { FRUITS } = await import("../scripts/fruit-characters/prompt.mjs");
  const { looksFrom } = await import("../scripts/fruit-characters/exportLooks.mjs");
  assert.deepEqual(FRUIT_LOOKS, looksFrom(FRUITS), "fruitLooks.js is in sync with prompt.mjs (run exportLooks.mjs)");
  assert.equal(headLook("coconut"), "a green young coconut head");
  assert.match(checkPrompt([{ name: "Kai Coconut", fruit: "coconut" }, { name: "Piper Pine", fruit: "pineapple" }]), /- Kai Coconut: a green young coconut head\n- Piper Pine: a pineapple head with a crown of green leaves \(part of the fruit, not hair\)/);
  const chars = [{ name: "Kai Coconut", visible: true, hasFruitHead: false }];
  assert.deepEqual(verdictOf({ characters: chars, figuresInPicture: 1, humanHeads: 0 }, [{ name: "Kai Coconut", fruit: "coconut" }]).problems, ["Kai Coconut is drawn without their green young coconut head"]);
});
