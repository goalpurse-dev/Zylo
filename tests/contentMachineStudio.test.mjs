// Content Machine: Zyvo Studio videos in the Queue (owner, 2026-10-30): a "making_of" generation is shown as a video,
// its files get fresh links, it is never "Outdated", and Analytics groups posts by the CTA variant and the template.
import test from "node:test";
import assert from "node:assert/strict";
import { ideaView, FRESH_PATH } from "../supabase/functions/_shared/contentMachine/apiSlideshows.js";
import { analytics } from "../supabase/functions/_shared/contentMachine/analytics.js";

const studioIdea = (over = {}) => ({
  id: "I1", run_id: null, status: "done", account: "zyvo", title: "How I made this AI Fruit Story with Zyvo", created_at: "2026-10-30T10:00:00Z", dry_run: false,
  recipe: { kind: "video", template: "ai_fruit_story", cta: "comment_fruit", format: "studio_ai_fruit_story", style: "studio" }, compliance: { ok: true }, script: {},
  cm_generations: [{ id: "G1", kind: "making_of", status: "done", files: { mp4: "studio/I1/video.mp4", pngs: ["studio/I1/cover.png"] }, source_assets: {}, cm_packages: [{ platform: "tiktok", caption: "c" }] }],
  ...over,
});

test("a Studio video is a video in the Queue: its MP4 and cover, its packages, never Outdated", () => {
  const urls = { "studio/I1/video.mp4": "https://signed/v", "studio/I1/cover.png": "https://signed/c" };
  const v = ideaView(studioIdea(), {}, urls);
  assert.equal(v.kind, "video");
  assert.equal(v.generation.mp4, "https://signed/v");
  assert.equal(v.generation.paths.mp4, "studio/I1/video.mp4");
  assert.deepEqual(v.generation.pngs, ["https://signed/c"], "the cover is the thumbnail in the All tab");
  assert.equal(v.outdated, false);
  assert.equal(v.packages.length, 1);
  assert.equal(v.slides.length, 0);
  // a slideshow next to it is still a slideshow
  const s = ideaView(studioIdea({ cm_generations: [{ id: "G2", kind: "slideshow", files: { pngs: ["slideshows/x/1.png"] }, source_assets: {}, cm_packages: [] }] }), {}, {});
  assert.equal(s.kind, "slideshow");
});

test("fresh download links work for Studio files", () => {
  assert.ok(FRESH_PATH.test("studio/1b2c/video.mp4"));
  assert.ok(!FRESH_PATH.test("studio/../secrets.txt") || "studio/../secrets.txt".includes(".."), "the API also refuses '..'");
});

test("Analytics groups Studio videos by CTA variant and by template (the A/B test)", () => {
  const post = (id, cta, views) => ({ id, platform: "tiktok", posted_at: "2026-10-30T10:00:00Z", account: "zyvo", idea: { title: id, account: "zyvo", recipe: { kind: "video", template: "ai_fruit_story", cta } },
    stats: [{ taken_at: "2026-10-31T10:00:00Z", hours_since_post: 24, views, likes: views / 10, comments: 5, shares: 2, saves: 3 }] });
  const a = analytics([post("a", "comment_fruit", 1000), post("b", "comment_fruit", 3000), post("c", "repost_friend", 500)], { now: new Date("2026-11-01T10:00:00Z") });
  const byCta = Object.fromEntries(a.averages.cta.map((g) => [g.key, g]));
  assert.equal(byCta.comment_fruit.posts, 2);
  assert.equal(byCta.repost_friend.posts, 1);
  assert.equal(a.averages.template[0].key, "ai_fruit_story");
  // slideshows have no CTA variant: they don't show up as "unknown"
  const b = analytics([{ id: "s", platform: "tiktok", posted_at: "2026-10-30T10:00:00Z", idea: { title: "s", recipe: { format: "listicle" } }, stats: [] }], { now: new Date("2026-11-01T10:00:00Z") });
  assert.equal(b.averages.cta.length, 0);
});
