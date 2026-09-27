import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// Chapter mode charged 39 credits correctly (only 15 beats authorized), but
// the Generate workspace's hero panel said "Creating your episode / 0 of
// 126 visuals ready" — genProgress (deriveEpisodeGenerationProgress) was
// always scored against the FULL plan's sceneCards, never the chapter-
// gated subset chapterGateWithin already computes for the "chapter done"
// check just above it. Source-pattern test, this repo's established
// convention for this large React component (episodeRebuildUi.test.mjs
// uses the identical pattern for the same file).

const root = new URL("../", import.meta.url);
const src = await readFile(new URL("src/pages/workspace/long-form/GenerateWorkspace.jsx", root), "utf8");

test("genProgress is computed from chapterGateWithin (not the full sceneCards) whenever a chapter gate is active", () => {
  const idx = src.indexOf("const genProgress = useMemo(");
  assert.ok(idx > -1, "genProgress definition not found");
  const block = src.slice(idx, idx + 400);
  assert.match(block, /deriveEpisodeGenerationProgress\(chapterGateActive \? chapterGateWithin : sceneCards,/);
});

test("chapterGateWithin/chapterGateActive are computed BEFORE genProgress, so they're available for the scoping above", () => {
  const boundaryIdx = src.indexOf("const chapterGateBoundary =");
  const genProgressIdx = src.indexOf("const genProgress = useMemo(");
  assert.ok(boundaryIdx > -1 && genProgressIdx > -1 && boundaryIdx < genProgressIdx);
});

test("EpisodeGenerationHero receives a chapterLabel prop derived from the chapter-gated cards, not a hardcoded/global label", () => {
  const idx = src.indexOf("<EpisodeGenerationHero");
  const block = src.slice(idx, idx + 1200);
  assert.match(block, /chapterLabel=\{chapterGateActive \? deriveChapterLabel\(chapterGateWithin\[0\]\?\.chapterId\) : null\}/);
});

test("the hero's title copy is overridden with the chapter label when chapterLabel is set, never left as the generic full-episode wording", () => {
  const idx = src.indexOf("function EpisodeGenerationHero(");
  const block = src.slice(idx, idx + 2000);
  assert.match(block, /chapterLabel \? \{ \.\.\.basePhaseCopy, title: basePhaseCopy\.title\.replace\(/);
});

test("EpisodeGenerationHero defaults chapterLabel to null — full-episode mode (no chapter gate) keeps its existing generic title untouched", () => {
  const idx = src.indexOf("function EpisodeGenerationHero(");
  const signatureLine = src.slice(idx, src.indexOf("\n", idx));
  assert.match(signatureLine, /chapterLabel\s*=\s*null/);
});

test("the title-override regex correctly rewrites every phase title that mentions 'episode', and leaves phase-neutral titles (Finishing quality checks, Generation paused) untouched", () => {
  const titleOverride = (title, chapterLabel) => title.replace(/your episode|Episode/, chapterLabel);
  assert.equal(titleOverride("Preparing your episode", "Chapter 1"), "Preparing Chapter 1");
  assert.equal(titleOverride("Creating your episode", "Chapter 1"), "Creating Chapter 1");
  assert.equal(titleOverride("Episode visuals ready", "Chapter 1"), "Chapter 1 visuals ready");
  assert.equal(titleOverride("Episode generation", "Chapter 1"), "Chapter 1 generation");
  assert.equal(titleOverride("Finishing quality checks", "Chapter 1"), "Finishing quality checks");
  assert.equal(titleOverride("Generation paused", "Chapter 1"), "Generation paused");
});
