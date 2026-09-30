import test from "node:test";
import assert from "node:assert/strict";
import { createMockAdapter } from "../src/components/viral-tools/ai-fruit-story-v2/api/mock/mockAdapter.js";
import { LIMITS } from "../src/components/viral-tools/ai-fruit-story-v2/api/limits.js";
import {
  priceItems, clipPrice, animateAllPrice, estimateStory, perSecondRate, sceneCountForLength,
} from "../src/components/viral-tools/ai-fruit-story-v2/pricing/fruitV2Estimates.js";

const fast = (opts = {}) => createMockAdapter({ timeScale: 0.001, paint: null, ...opts });

/** Resolve once the story reaches one of the given statuses. */
function waitFor(api, storyId, statuses) {
  return new Promise((resolve) => {
    const off = api.subscribeStory(storyId, (story) => {
      if (statuses.includes(story.status)) { off(); resolve(story); }
    });
  });
}

// Live server quotes (tool_prices after 20260930162500_fruit_story_prices):
// picture 4, V2 5 cr/s × 5 s, V3 9 cr/s × 5 s, V4 16 cr/s × 4 s.
const PRICES = { image: 4, "clip:v2": 25, "clip:v3": 45, "clip:v4": 64 };

test("price items use the Fruit v2 keys and the server's allowed shapes", () => {
  const items = Object.fromEntries(priceItems("9:16").map((i) => [i.id, i]));
  assert.equal(items.image.tool_key, "image:fruit-story");
  assert.deepEqual(items.image.input, { width: 768, height: 1376 });
  assert.equal(items["clip:v2"].tool_key, "video:fruit-story-v2");
  assert.deepEqual(items["clip:v2"].input, { durationSec: 5, withSound: true, width: 720, height: 1280 });
  assert.deepEqual(items["clip:v4"].input, { durationSec: 4, withSound: true, width: 720, height: 1280 });
  assert.equal(priceItems("16:9").find((i) => i.id === "clip:v3").input.width, 1280);
});

test("clip prices are the rows' exact per-second rates", () => {
  assert.equal(perSecondRate("v2", PRICES), 5);
  assert.equal(perSecondRate("v3", PRICES), 9);
  assert.equal(perSecondRate("v4", PRICES), 16);
  assert.equal(clipPrice("v2", 7, PRICES), 35);
  assert.equal(clipPrice("v3", 4, PRICES), 36);
  assert.equal(clipPrice("v4", 8, PRICES), 128);
  assert.equal(clipPrice("v3", 5, {}), null);
});

test("story estimate: exact pictures + about-video", () => {
  const est = estimateStory({ lengthSec: 30, tierId: "v2", prices: PRICES });
  assert.deepEqual(est, { sceneCount: 6, pictures: 24, video: 150, total: 174 });
  assert.deepEqual(estimateStory({ lengthSec: 20, tierId: "v4", prices: PRICES }), { sceneCount: 4, pictures: 16, video: 320, total: 336 });
  assert.equal(estimateStory({ lengthSec: 30, tierId: "v2", prices: {} }).total, null);
  assert.equal(sceneCountForLength(15), 3);
  assert.equal(sceneCountForLength(120), 24);
});

test("ideas: 5 per call, only library characters", async () => {
  const api = fast();
  const chars = new Set((await api.listCharacters()).map((c) => c.id));
  for (const seed of [0, 1]) {
    const ideas = await api.getIdeas({ seed });
    assert.equal(ideas.length, LIMITS.ideasPerCall);
    for (const idea of ideas) for (const id of idea.castIds) assert.ok(chars.has(id), id);
  }
});

test("single video: pictures → animate → final, max 3 characters per scene", async () => {
  const api = fast();
  const story = await api.createStory({ source: "idea", ideaId: "idea-revenge-dinner", quality: "v2", lengthSec: 60, aspect: "9:16" });
  assert.equal(story.status, "draft");
  assert.equal(story.scenes.length, 12);
  for (const scene of story.scenes) {
    assert.ok(scene.presentIds.length >= 1 && scene.presentIds.length <= 3);
    assert.ok(scene.presentIds.includes(scene.speakerId));
    assert.ok([4, 5, 6].includes(scene.durationSec));
  }

  const ready = waitFor(api, story.id, ["pictures_ready"]);
  await api.generateScenePictures(story.id);
  const pictured = await ready;
  assert.ok(pictured.scenes.every((s) => s.imageStatus === "ready"));
  assert.equal(animateAllPrice(pictured, PRICES), pictured.scenes.reduce((sum, s) => sum + clipPrice("v2", s.durationSec, PRICES), 0));

  const clipsDone = waitFor(api, story.id, ["clips_ready"]);
  await api.animateAll(story.id);
  assert.ok((await clipsDone).scenes.every((s) => s.clipStatus === "ready" && s.clipUrl));

  const finalDone = waitFor(api, story.id, ["final_ready"]);
  await api.buildFinal(story.id, { captions: false });
  const final = await finalDone;
  assert.equal(final.final.status, "ready");
  assert.equal(final.final.captions, false);
  assert.equal(final.final.trimmedPerClipSec.length, final.scenes.length);
});

test("script mode uses the lines exactly as written", async () => {
  const api = fast();
  const script = [
    { speakerId: "mia", line: "You forgot our anniversary." },
    { speakerId: "marco", line: "I booked the restaurant, didn't I?" },
    { speakerId: "mia", line: "For her." },
  ];
  const story = await api.createStory({ source: "script", script, castIds: ["mia", "marco"], quality: "v3", lengthSec: 90, aspect: "16:9" });
  assert.deepEqual(story.scenes.map((s) => [s.speakerId, s.line]), script.map((r) => [r.speakerId, r.line]));
  await assert.rejects(
    api.createStory({ source: "script", script: [{ speakerId: "pia", line: "Hi" }, { speakerId: "mia", line: "Hey" }], castIds: ["mia"], quality: "v2", lengthSec: 30, aspect: "9:16" }),
    /speaker/,
  );
});

test("validation: cast size and prompt length", async () => {
  const api = fast();
  await assert.rejects(api.createStory({ source: "prompt", prompt: "A long enough story prompt", castIds: ["mia", "marco", "pia", "rick"], quality: "v2", lengthSec: 30, aspect: "9:16" }), /1 to 3/);
  await assert.rejects(api.createStory({ source: "prompt", prompt: "x".repeat(1001), castIds: ["mia"], quality: "v2", lengthSec: 30, aspect: "9:16" }), /1000/);
  await assert.rejects(api.createSeriesPlan({ concept: "A CEO and his intern", castIds: ["rick"], opener: "", tone: "", episodeCount: 5 }), /2 to 5/);
});

test("injected failures fire once so the retry works", async () => {
  const api = fast({ fail: "scene2,ideas" });
  await assert.rejects(api.getIdeas({}), /ideas/);
  assert.equal((await api.getIdeas({})).length, 5);

  const story = await api.createStory({ source: "idea", ideaId: "idea-reply-all", quality: "v2", lengthSec: 15, aspect: "9:16" });
  const ready = waitFor(api, story.id, ["pictures_ready"]);
  await api.generateScenePictures(story.id);
  const pictured = await ready;
  assert.equal(pictured.scenes[1].imageStatus, "failed");
  assert.ok(pictured.scenes[1].error);
  await assert.rejects(api.animateAll(story.id), /picture/);

  const fixed = waitFor(api, story.id, ["pictures_ready"]);
  await api.regenerateScene(pictured.scenes[1].id, "Bella at her desk, looking guilty");
  assert.equal((await fixed).scenes[1].imageStatus, "ready");
});

test("series: plan, episodes unlock in order", async () => {
  const api = fast();
  const series = await api.createSeriesPlan({ concept: "Two best friends, one boyfriend", castIds: ["kiki", "bella", "benny"], opener: "A reply-all email", tone: "Petty and sarcastic", episodeCount: 4 });
  assert.equal(series.episodes.length, 4);
  assert.deepEqual(series.episodes.map((e) => e.status), ["next", "locked", "locked", "locked"]);
  await assert.rejects(api.createStory({ source: "idea", seriesId: series.id, episodeNumber: 2, quality: "v2", lengthSec: 30, aspect: "9:16" }), /earlier/);

  const ep1 = await api.createStory({ source: "idea", seriesId: series.id, episodeNumber: 1, quality: "v2", lengthSec: 15, aspect: "9:16" });
  assert.equal(ep1.scenes.at(-1).title, "Cliffhanger");
  let wait = waitFor(api, ep1.id, ["pictures_ready"]);
  await api.generateScenePictures(ep1.id); await wait;
  wait = waitFor(api, ep1.id, ["clips_ready"]);
  await api.animateAll(ep1.id); await wait;
  wait = waitFor(api, ep1.id, ["final_ready"]);
  await api.buildFinal(ep1.id, { captions: true }); await wait;

  const after = await api.getSeries(series.id);
  assert.deepEqual(after.episodes.map((e) => e.status), ["made", "next", "locked", "locked"]);
  const listed = (await api.listSeries()).find((s) => s.id === series.id);
  assert.equal(listed.madeCount, 1);
});

test("recent: seeded singles and series", async () => {
  const api = fast();
  const singles = await api.listRecent({ type: "single" });
  assert.ok(singles.length >= 3);
  assert.ok(singles.every((s) => s.type === "single"));
  const series = await api.listRecent({ type: "series" });
  assert.ok(series.some((s) => s.title === "Rotten to the Core" && s.madeCount === 2 && s.episodeCount === 10));
});

test("plan copy: about how many 20 s stories a month of credits makes, from live prices only", async () => {
  const { videosPerMonth } = await import("../src/components/viral-tools/ai-fruit-story-v2/pricing/fruitV2Estimates.js");
  // 20 s on V2: 4 pictures × 4 + 20 s × 5 = 116 credits.
  assert.equal(videosPerMonth(750, 20, "v2", PRICES), 6);
  assert.equal(videosPerMonth(1600, 20, "v3", PRICES), 8);
  assert.equal(videosPerMonth(3200, 20, "v4", PRICES), 9);
  assert.equal(videosPerMonth(750, 20, "v2", {}), null, "no prices: no number");
});

test("the mock can start empty (dev preview of a new account)", async () => {
  const api = createMockAdapter({ timeScale: 0.001, paint: null, empty: true });
  assert.deepEqual(await api.listRecent({ type: "single" }), []);
});

test("the full-video price is an upper bound: script clips use the server's own clip rule; a story's total is exact", async () => {
  const { clipSecondsFor, storyTotals } = await import("../src/components/viral-tools/ai-fruit-story-v2/pricing/fruitV2Estimates.js");
  const { clipDurationSec } = await import("../supabase/functions/_shared/fruit/duration.js");
  const lines = ["Why is there a wedding cake at your engagement party, Benny?", "Okay, don't freak out, but this might actually be our wedding.", "I've had this dress hidden in that tent since noon."];
  for (const l of lines) assert.equal(clipSecondsFor(l, "v2"), clipDurationSec(l, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));
  assert.equal(clipSecondsFor(lines[1], "v4"), 6);
  const story = { quality: "v2", scenes: [6, 6, 5, 5, 5, 6].map((durationSec) => ({ durationSec })) };
  assert.deepEqual(storyTotals(story, PRICES), { pictures: 24, video: 165, total: 189 }, "The Surprise Wedding Switch: 24 + 165");
});
