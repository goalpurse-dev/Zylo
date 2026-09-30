// AI Fruit Story v2 series location plates + continuity (offline).
import test from "node:test";
import assert from "node:assert/strict";
import { ensurePlates, lastEndOf, platePrompt, plateOf } from "../supabase/functions/_shared/fruit/plates.js";

const locations = [
  { id: "s1", description: "A candlelit restaurant with round tables and a window onto the street." },
  { id: "s2", description: "A small apartment kitchen with a fridge covered in photos" },
];

test("plates: made once per used series location, stored, logged; unused and existing ones untouched", async () => {
  const posts = [], logs = [];
  const deps = {
    post: async (tasks) => { posts.push(tasks[0]); return { httpStatus: 200, body: { data: [{ taskType: "imageInference", taskUUID: tasks[0].taskUUID, imageURL: "https://im.runware.ai/p.jpg", cost: 0.0344 }] } }; },
    store: async ({ path }) => `https://cdn.test/${path}`,
    log: async (row) => { logs.push(row); },
  };
  const out = await ensurePlates({ locations, usedIds: ["s1"], aspect: "9:16", userId: "u", seriesId: "ser", deps, uuid: () => "00000000-0000-4000-8000-000000000001" });
  assert.equal(posts.length, 1);
  assert.match(posts[0].positivePrompt, /empty background plate for an animated series: A candlelit restaurant/);
  assert.match(posts[0].positivePrompt, /no people, no characters/);
  assert.equal(plateOf(out[0], "9:16"), "https://cdn.test/fruit/u/series/ser/plate-s1-9x16.jpg");
  assert.equal(plateOf(out[1], "9:16"), null, "s2 not used this episode");
  assert.equal(logs[0].purpose, "location_plate");
  assert.equal(logs[0].cost_usd, 0.0344);
  const again = await ensurePlates({ locations: out, usedIds: ["s1"], aspect: "9:16", userId: "u", seriesId: "ser", deps });
  assert.equal(posts.length, 1, "the plate exists: nothing made");
  assert.deepEqual(again, out);
});

test("a plate that fails is skipped (pictures still work) and logged", async () => {
  const logs = [];
  const out = await ensurePlates({ locations, usedIds: ["s2"], aspect: "9:16", userId: "u", seriesId: "ser", deps: { post: async () => { throw new Error("timeout"); }, store: async () => "x", log: async (r) => logs.push(r) } });
  assert.equal(plateOf(out[1], "9:16"), null);
  assert.equal(logs[0].ok, false);
  assert.match(platePrompt("a room.", "16:9"), /^Wide 16:9 empty background plate/);
});

test("continuity: the previous episode's end state, or its last scene for older episodes", () => {
  const withEnd = { end_state: { characters: [{ id: "kai", where: "at the door", feeling: "caught" }], props: ["the ring"] } };
  assert.deepEqual(lastEndOf(withEnd, []), withEnd.end_state);
  const old = { end_state: null, locations: [{ id: "loc1", description: "a candlelit restaurant" }] };
  const scenes = [
    { idx: 0, speaker_id: "maya", present_ids: ["maya"], location_id: "loc1", placement: "", emotion: "curious" },
    { idx: 2, speaker_id: "piper", present_ids: ["piper", "kai"], location_id: "loc1", placement: "Piper stands over Kai's chair", emotion: "furious" },
  ];
  assert.deepEqual(lastEndOf(old, scenes), { characters: [{ id: "piper", where: "Piper stands over Kai's chair", feeling: "furious" }, { id: "kai", where: "Piper stands over Kai's chair", feeling: "watching" }], props: [] });
  assert.equal(lastEndOf(old, []), null);
});
