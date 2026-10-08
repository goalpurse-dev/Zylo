// Blocky Stories: what the page says a story costs (pricing/blockyEstimates.js). The numbers come from the
// server's price rows; these tests pin how they are added up, with and without the script's share.
import test from "node:test";
import assert from "node:assert/strict";
import { estimateStory, picturesStepPrice, scriptShare, storyTotals, videosPerMonth } from "../src/components/viral-tools/blocky-stories/pricing/blockyEstimates.js";

// image 4 a picture; V2 quoted at 5 s = 25 (5 a second); the script's share 15.
const PRICES = { image: 4, "clip:v2": 25, "clip:v3": 45, "clip:v4": 64, script: 15 };
const story = (source) => ({ source, quality: "v2", scenes: Array.from({ length: 6 }, () => ({ durationSec: 5 })) });

test("a story we wrote: the picture step is every picture plus the script's share", () => {
  assert.equal(picturesStepPrice(story("idea"), PRICES), 39);
  assert.equal(picturesStepPrice(story("prompt"), PRICES), 39);
  assert.deepEqual(storyTotals(story("idea"), PRICES), { pictures: 39, video: 150, total: 189 });
});

test("the user's own script carries no share", () => {
  assert.equal(scriptShare(PRICES, false), 0);
  assert.equal(picturesStepPrice(story("script"), PRICES), 24);
  assert.equal(estimateStory({ lengthSec: 30, tierId: "v2", prices: PRICES, sceneCount: 6, scripted: false }).pictures, 24);
});

test("the settings step: 30 sec of V2 is 24 + 15 for the pictures and the script, about 150 for the video", () => {
  const est = estimateStory({ lengthSec: 30, tierId: "v2", prices: PRICES });
  assert.deepEqual({ pictures: est.pictures, video: est.video, total: est.total, scriptShare: est.scriptShare }, { pictures: 39, video: 150, total: 189, scriptShare: 15 });
  assert.equal(videosPerMonth(4000, 30, "v2", PRICES), 21);
});

test("no price row for the share: 0 shown (the server charges none either)", () => {
  const prices = { ...PRICES, script: 0 };
  assert.equal(picturesStepPrice(story("idea"), prices), 24);
  assert.equal(estimateStory({ lengthSec: 30, tierId: "v2", prices }).total, 174);
});

test("until the share has loaded, nothing that includes it shows a number", () => {
  const prices = { ...PRICES, script: null };
  assert.equal(picturesStepPrice(story("idea"), prices), null);
  assert.equal(estimateStory({ lengthSec: 30, tierId: "v2", prices }).total, null);
  assert.equal(picturesStepPrice(story("script"), prices), 24, "the user's own script doesn't wait for it");
});
