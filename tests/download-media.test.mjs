import test from "node:test";
import assert from "node:assert/strict";
import { mediaMimeType, isMobileSaveEnvironment } from "../src/lib/downloadMedia.ts";

test("media MIME prefers a trustworthy response content type", () => {
  assert.equal(mediaMimeType("image.webp", "image/png; charset=binary"), "image/png");
  assert.equal(mediaMimeType("video.mp4", "video/mp4"), "video/mp4");
});

test("media MIME falls back to the requested filename", () => {
  assert.equal(mediaMimeType("scene.jpg", "application/octet-stream"), "image/jpeg");
  assert.equal(mediaMimeType("clip.mov", ""), "video/quicktime");
});

test("server-side rendering is not classified as a mobile save environment", () => {
  assert.equal(isMobileSaveEnvironment(), false);
});
