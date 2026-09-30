// AI Fruit Story v2: earlier-version (v1) stories shown read-only in Recent (offline).
import test from "node:test";
import assert from "node:assert/strict";
import { isLasting, isShowable, legacyLine, legacyRecent, legacyStory, isLegacyId } from "../src/components/viral-tools/ai-fruit-story-v2/api/legacyStories.js";

const row = {
  id: "g1", title: "Dreams of the Fruit Salad", scene_count: 2, scene_aspect: "9:16", animation_model: "fruit-v3", created_at: "2026-09-01T00:00:00Z",
  scenes: [
    { title: "The Dream", imageUrl: "https://x.supabase.co/storage/v1/object/public/a.jpg", videoUrl: "https://x.supabase.co/storage/v1/object/public/a.mp4", videoDialogue: [{ speaker: "Dreamy Apple", line: "Will I be chosen?" }, { speaker: "Flashy Strawberry", line: "It's for me!" }] },
    { title: "Old", imageUrl: "https://im.runware.ai/image/os/a01/ws/3/x.jpg", videoUrl: "https://vm.runware.ai/video/x.mp4", videoDialogue: "Just a string." },
  ],
};

test("provider temp URLs are treated as gone; stored URLs stay", () => {
  assert.equal(isLasting("https://im.runware.ai/image/x.jpg"), false);
  assert.equal(isLasting("https://x.supabase.co/storage/v1/object/public/a.jpg"), true);
  assert.equal(isShowable(row), true);
  assert.equal(isShowable({ scenes: [row.scenes[1]] }), false);
});

test("v1 dialogue arrays become readable lines, never [object Object]", () => {
  assert.equal(legacyLine(row.scenes[0]), "Dreamy Apple: Will I be chosen? / Flashy Strawberry: It's for me!");
  assert.equal(legacyLine(row.scenes[1]), "Just a string.");
});

test("a v1 story is a read-only Story with only its lasting media", () => {
  const s = legacyStory(row);
  assert.ok(isLegacyId(s.id) && s.readOnly);
  assert.equal(s.status, "clips_ready");
  assert.equal(s.quality, "v3");
  assert.deepEqual(s.scenes.map((x) => [x.imageStatus, x.clipStatus]), [["ready", "ready"], ["failed", "none"]]);
  assert.equal(s.scenes[1].imageUrl, null);
  const card = legacyRecent(row);
  assert.deepEqual(card.thumbUrls, [row.scenes[0].imageUrl]);
  assert.equal(card.legacy, true);
});
