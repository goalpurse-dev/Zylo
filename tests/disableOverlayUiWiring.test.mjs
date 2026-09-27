import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "FINAL stabilization pass" §0/§10 — a MINIMAL UI affordance
// for the new zero-cost overlay-disable capability (deliberately not a
// full overlay editor — a single button reusing the existing action-button
// pattern). Source-pattern tests matching this repo's established
// convention for JSX wiring checks (see visualWorldReferenceReliability.test.mjs).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("§10: generateWorkspaceApi exposes disableSceneOverlay, calling the new edge function and never reporting a credits charge (there is none)", async () => {
  const text = await source("src/pages/workspace/long-form/generateWorkspaceApi.js");
  assert.match(text, /export async function disableSceneOverlay\(sceneId\)/);
  assert.match(text, /"disable-long-form-scene-overlay"/);
});

test("§10: generate.jsx wires onDisableSceneOverlay through the same perform() wrapper every other scene action uses", async () => {
  const text = await source("src/pages/workspace/long-form/generate.jsx");
  assert.match(text, /disableSceneOverlay/);
  assert.match(text, /onDisableSceneOverlay=\{\(sceneId\) => perform\(\(\) => disableSceneOverlay\(sceneId\)\)\}/);
});

test("§10: GenerateWorkspace threads onDisableSceneOverlay down into the SceneReviewModal as onDisableOverlay", async () => {
  const text = await source("src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(text, /onDisableSceneOverlay,? onBackToVisualWorld/);
  assert.match(text, /onDisableOverlay=\{onDisableSceneOverlay\}/);
});

test("§10: the modal's 'Remove Overlay' button is shown only for a currently-ready scene with an overlay actually applied right now, never while viewing history", async () => {
  const text = await source("src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(text, /card\.status\.key === "ready" && currentScene\?\.overlay_applied && !viewingHistory/);
  assert.match(text, /Remove Overlay/);
});
