// AI Fruit Story v2 final-screen extras (offline): upload package, cover scene, series overlays.
import test from "node:test";
import assert from "node:assert/strict";
import { cleanPackage, packagePrompt, writeUploadPackage } from "../supabase/functions/_shared/fruit/uploadPackage.js";
import { buildFinalJob, coverScene, overlayTexts, storyUpdateForReport } from "../supabase/functions/_shared/fruit/final.js";
import { toStory } from "../supabase/functions/_shared/fruit/storyState.js";

test("upload package: episodes point to the next part; hashtags cleaned to 5-8; the pinned comment is a question", async () => {
  const p = packagePrompt({ title: "Caught at Dinner", lines: [{ speaker: "Maya Mango", line: "Why is Kai here?" }], episode: { number: 1, seriesTitle: "Date Night Disaster", nextNumber: 2, nextTitle: "The Ring Box" } });
  assert.match(p, /This is episode 1 of the series "Date Night Disaster"\. The next episode is Part 2: "The Ring Box"; the caption must point to it\./);
  const { pkg, problems } = cleanPackage({ title: "She Caught Him Mid-Date", caption: "Part 2 drops next.", pinnedComment: "Was Maya right to call him out?", hashtags: ["FruitDrama", "#aistory", "# drama ", "##cheating", "#pov", "bad tag!", "#storytime"] });
  assert.deepEqual(problems, []);
  assert.deepEqual(pkg.hashtags, ["#fruitdrama", "#aistory", "#drama", "#cheating", "#pov", "#storytime"]);
  assert.deepEqual(cleanPackage({ title: "x", caption: "y", pinnedComment: "No question here.", hashtags: ["#a1", "#b2"] }).problems, ["hashtags: 5 to 8 needed", "pinnedComment must be a question"]);
  const rows = [];
  const out = await writeUploadPackage({
    admin: { from: () => ({ insert: async (r) => { rows.push(r); return {}; } }) }, apiKey: "k", ids: { story_id: "s" },
    input: { title: "T", lines: [{ speaker: "A", line: "B" }] },
    fetchLlm: async () => ({ data: { title: "T", caption: "C", pinnedComment: "Q?", hashtags: ["#a1", "#b2", "#c3", "#d4", "#e5"] }, request: {}, response: {}, httpStatus: 200, costUsd: 0.0008, usage: {} }),
  });
  assert.equal(out.caption, "C");
  assert.equal(rows[0].purpose, "upload_package");
  assert.equal(rows[0].cost_usd, 0.0008);
});

test("cover: the most dramatic scene by emotion, the later one on a tie, only scenes with a picture", () => {
  const scenes = [
    { idx: 0, emotion: "curious", image_url: "a" },
    { idx: 1, emotion: "furious", image_url: "b" },
    { idx: 2, emotion: "shocked", image_url: "c" },
    { idx: 3, emotion: "furious and hurt", image_url: null },
  ];
  assert.equal(coverScene(scenes).idx, 1);
  assert.equal(coverScene([{ idx: 0, emotion: "calm", image_url: "a" }, { idx: 1, emotion: "tired", image_url: "b" }]).idx, 1, "no drama: the last scene");
});

test("cover: a picture the check flagged is skipped (Caught at Dinner scene 1 drew Piper with a human head)", () => {
  const scenes = [
    { idx: 0, emotion: "shocked", image_url: "a", image_check: "failed" },
    { idx: 1, emotion: "smug", image_url: "b", image_check: "passed" },
    { idx: 2, emotion: "calm", image_url: "c", image_check: "none" },
  ];
  assert.equal(coverScene(scenes).idx, 1);
  assert.equal(coverScene(scenes.map((s) => ({ ...s, image_check: "failed" }))).idx, 0, "all flagged: still a cover");
});

test("series overlays: Part N + next episode card; last episode and singles", () => {
  assert.deepEqual(overlayTexts({ partLabel: true, endCard: true, episodeNumber: 2, nextTitle: "The Welcome Party" }), { part: "Part 2", end: "Part 3: The Welcome Party\nFollow for more" });
  assert.deepEqual(overlayTexts({ partLabel: true, endCard: true, episodeNumber: 3, nextTitle: null }), { part: "Part 3", end: "Follow for more" });
  assert.deepEqual(overlayTexts({ partLabel: false, endCard: true }), { part: null, end: "Part 2 coming soon\nFollow for more" });
  const job = buildFinalJob({ story: { id: "s", aspect: "9:16" }, scenes: [{ idx: 0, clip_status: "ready", clip_url: "u", line: "l" }], callId: "c", captions: true, overlays: { part: null, end: null }, cover: { imageUrl: "p", title: "T" } });
  assert.equal(job.overlays, undefined, "no overlays when both are off");
  assert.deepEqual(job.cover, { imageUrl: "p", title: "T" });
  assert.equal(storyUpdateForReport({ ok: true, cover: true }, "v", "x", "c.jpg").cover_url, "c.jpg");
  assert.equal(storyUpdateForReport({ ok: true, cover: false }, "v", "x", "c.jpg").cover_url, undefined);
});

test("the story's final carries the series options (on for new episodes) and the cover", () => {
  const row = (over) => ({ id: "s", title: "t", cast_ids: [], quality: "v2", length_sec: 15, aspect: "9:16", status: "clips_ready", final_status: "none", series_id: null, ...over });
  assert.deepEqual([toStory(row({}), []).final.partLabel, toStory(row({ series_id: "x" }), []).final.partLabel], [false, true]);
  const built = toStory(row({ series_id: "x", final_status: "ready", final_part_label: false, final_end_card: true, cover_url: "c.jpg" }), []).final;
  assert.deepEqual([built.partLabel, built.endCard, built.coverUrl], [false, true, "c.jpg"]);
});
