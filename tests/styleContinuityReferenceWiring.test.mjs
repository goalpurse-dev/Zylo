import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "FINAL stabilization pass" §1 — QA must use (1) the structured
// Style Bible, (2) canonical Visual World references, and (3) when
// available, already-approved scenes from the same episode/continuity
// group as style-continuity evidence — explicitly NEVER the old generated
// global "style anchor" asset. Source-pattern test for the wiring inside
// advance-long-form-scene-generation (no fetch-mock harness in this repo
// for this file, matching its own established testing convention).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function styleContinuityBlock(text) {
  const start = text.indexOf("style-continuity evidence");
  const end = text.indexOf("Section 20/21 (2026-09-15 Visual Director rebuild)", start);
  return text.slice(start, end);
}

test("§1: an already-approved GENERATE/EDIT scene from the SAME episode is looked up as style-continuity evidence, scoped by visual_world_version_id and qa_status=approved", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const block = styleContinuityBlock(text);
  assert.match(block, /\.eq\("visual_world_version_id", scene\.visual_world_version_id\)\.eq\("status", "succeeded"\)\.eq\("qa_status", "approved"\)/);
  assert.match(block, /\.in\("render_strategy", \["GENERATE", "EDIT"\]\)/);
  assert.match(block, /kind: "style_reference"/);
});

test("§1: no old generated global 'style anchor' asset table/concept is resurrected — the style-continuity lookup reads long_form_scenes only, never a style-anchor asset table", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.doesNotMatch(text, /style_anchor_asset|styleAnchorAssetId|STYLE_ANCHOR_ASSET/);
});

test("§1: the style-continuity lookup is non-fatal (wrapped in try/catch) — a lookup failure never blocks QA from running", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const block = styleContinuityBlock(text);
  assert.match(block, /catch \(e\) \{/);
  assert.match(block, /non-fatal, QA proceeds without it/);
});

test("§15: an approved exemplar sharing a required character with the current scene is upgraded to kind:'character_reference' (a real approved appearance anchor), never left as style-only", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const block = styleContinuityBlock(text);
  assert.match(block, /const sharedCharacter = exemplarCharacters\.find\(\(c: string\) => thisSceneCharacters\.includes\(c\)\);/);
  assert.match(block, /kind: "character_reference"/);
  assert.match(block, /already-approved appearance anchor for \$\{sharedCharacter\}/);
});

test("§15: the appearance-anchor match is derived from the ALREADY-COMPILED requiredCharacterIds field on both scenes' render plans — never a new free-text/string-similarity heuristic", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const block = styleContinuityBlock(text);
  assert.match(block, /exemplarPlan\?\.qa_expectations\?\.requiredCharacterIds/);
  assert.match(block, /expectations\.requiredCharacterIds/);
});
