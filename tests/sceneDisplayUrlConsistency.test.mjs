import test from "node:test";
import assert from "node:assert/strict";
import { resolveSceneDisplayUrl, resolveSceneBaseUrl, buildSceneCards } from "../src/pages/workspace/long-form/sceneCardModel.js";
import { readFile } from "node:fs/promises";

// 2026-09-22 "FINAL stabilization pass" §11 — real Atlantis finding: a
// scene with base_result_url = clean base and final_result_url = the
// overlay-composited frame (overlay_applied:true) showed the composited
// text on its CARD but the text disappeared the instant its MODAL opened —
// different UI surfaces independently resolved different URL fields for the
// exact same scene. Fixed with ONE central resolver every surface must call.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("§11: resolveSceneDisplayUrl prefers final_result_url over result_url — the overlay-composited frame is the default display", () => {
  const scene = { result_url: "https://x/base.png", final_result_url: "https://x/final.png", overlay_applied: true };
  assert.equal(resolveSceneDisplayUrl(scene), "https://x/final.png");
});

test("§11: resolveSceneDisplayUrl falls back to result_url when there is no overlay (Final equals Base by construction)", () => {
  const scene = { result_url: "https://x/base.png", final_result_url: null };
  assert.equal(resolveSceneDisplayUrl(scene), "https://x/base.png");
});

test("§11: resolveSceneDisplayUrl is null-safe for a scene with no result at all (queued/failed)", () => {
  assert.equal(resolveSceneDisplayUrl(null), null);
  assert.equal(resolveSceneDisplayUrl({}), null);
});

test("§11: resolveSceneBaseUrl returns the clean base even when a different overlay frame is the current display", () => {
  const scene = { result_url: "https://x/base.png", base_result_url: "https://x/base.png", final_result_url: "https://x/final.png", overlay_applied: true };
  assert.equal(resolveSceneBaseUrl(scene), "https://x/base.png");
  assert.equal(resolveSceneDisplayUrl(scene), "https://x/final.png", "base and display resolve to genuinely different URLs once an overlay exists");
});

test("§11: resolveSceneBaseUrl falls back to the resolved display url for a scene compiled before base_result_url existed", () => {
  const scene = { result_url: "https://x/only.png" };
  assert.equal(resolveSceneBaseUrl(scene), "https://x/only.png");
});

test("§11: buildSceneCards' thumbnailUrl uses the same resolver (never a separate final/result_url fallback chain)", () => {
  const beats = [{ id: "b1", sequenceIndex: 1, informationToCommunicate: "x" }];
  const scenes = new Map([["b1", { id: "s1", status: "succeeded", qa_status: "approved", result_url: "https://x/base.png", final_result_url: "https://x/final.png" }]]);
  const cards = buildSceneCards(beats, new Map(), scenes, new Map());
  assert.equal(cards[0].thumbnailUrl, "https://x/final.png");
});

test("§11: GenerateWorkspace's modal preview and fullscreen lightbox both read the shared resolver, never previewScene.result_url directly", async () => {
  const text = await source("src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(text, /const previewUrl = resolveSceneDisplayUrl\(previewScene\);/);
  assert.doesNotMatch(text, /previewScene\?\.result_url/, "no surface may read result_url off previewScene directly anymore");
  assert.doesNotMatch(text, /previewScene\.result_url/);
});

test("§11: the scene-history thumbnail strip also uses the shared resolver per history item, not s.result_url directly", async () => {
  const text = await source("src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(text, /resolveSceneDisplayUrl\(s\)/);
});
