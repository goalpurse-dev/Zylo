import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveReferenceOperationRenderer, resolveAssetRoleKey, referenceRendererPolicy, QWEN, KLEIN_4B, KLING_O3, SEEDREAM_5_PRO,
} from "../supabase/functions/_shared/referenceRendererPolicy.js";
import { referenceJobPayload } from "../supabase/functions/_shared/visualWorldJobs.ts";
import { selectCurrentVisualWorldAssets, referenceProgress } from "../src/pages/workspace/long-form/visualWorldPlanning.js";

// Part 20 test matrix (A-N) for the 2026-09-13 CRITICAL VISUAL WORLD
// RELIABILITY + GENERATE/EDIT ROUTING FIX. Backend-lifecycle items that need
// a live DB (E/F/G/H/I/J: reconciliation, orphan recovery, self-heal,
// idempotency, lease expiry, failure isolation) were verified this session
// via direct pg_get_functiondef / live-row audits against the real Mars
// project rather than re-implemented as offline unit tests here — see the
// final report. This file covers everything that is a pure function of its
// inputs: the renderer-routing contract (A-D), the shared current-asset
// selector (K/L), the progress denominator (N), and the style-preview
// import paths (M).

const world = "world", entity = "hero";
const sheetAsset = (over = {}) => ({ id: "a1", reference_type: "character_reference", angle_or_view: "character_reference_sheet", entity_id: entity, ...over });

test("A: Regenerate (operation=generate/regenerate) on the canonical character sheet resolves to Kling IMAGE O3, never Qwen (V3 renderer, 2026-09-13)", () => {
  const resolved = resolveReferenceOperationRenderer({ operation: "regenerate", assetRole: "CHARACTER_REFERENCE_SHEET", referenceImageCount: 0 });
  assert.equal(resolved.toolKey, KLING_O3);
  assert.notEqual(resolved.toolKey, QWEN);
});

test("B: Regenerate must send ZERO reference images, no exceptions (2026-09-14 retraction — a real maintenance-tech sheet showed Kling over-copying a single supplied reference instead of generating fresh)", () => {
  assert.doesNotThrow(() => resolveReferenceOperationRenderer({ operation: "regenerate", assetRole: "CHARACTER_REFERENCE_SHEET", referenceImageCount: 0 }));
  assert.throws(() => resolveReferenceOperationRenderer({ operation: "regenerate", assetRole: "CHARACTER_REFERENCE_SHEET", referenceImageCount: 1 }), /RENDERER_POLICY_VIOLATION/, "even a single reference image must never be allowed on Regenerate — this is a fresh generation, not an edit");
  assert.throws(() => resolveReferenceOperationRenderer({ operation: "regenerate", assetRole: "CHARACTER_REFERENCE_SHEET", referenceImageCount: 2 }), /RENDERER_POLICY_VIOLATION/);
  // Every OTHER independent-generation role keeps the same zero-image
  // invariant.
  assert.throws(() => resolveReferenceOperationRenderer({ operation: "regenerate", assetRole: "LOCATION", referenceImageCount: 1 }), /RENDERER_POLICY_VIOLATION/);
});

test("C: Edit Reference resolves to Seedream 5.0 Pro with a source image", () => {
  const resolved = resolveReferenceOperationRenderer({ operation: "edit", assetRole: "CHARACTER_REFERENCE_SHEET", referenceImageCount: 1 });
  assert.equal(resolved.toolKey, SEEDREAM_5_PRO);
});

test("D: Edit Reference requires exactly a real source image — zero images is a fail-loud violation", () => {
  assert.throws(() => resolveReferenceOperationRenderer({ operation: "edit", assetRole: "CHARACTER_REFERENCE_SHEET", referenceImageCount: 0 }), /RENDERER_POLICY_VIOLATION/);
});

test("real incident this closes: referenceJobPayload for a character-sheet asset with no edit_instruction dispatches Kling O3 with zero ref_images", () => {
  const asset = sheetAsset();
  const job = referenceJobPayload(asset, {}, { user_id: "u1" }, "prompt", "free", null);
  assert.equal(job.tool_key, KLING_O3);
  assert.equal(job.input.ref_images, undefined);
});

test("2026-09-14 retraction: referenceJobPayload for a Regenerate (no edit_instruction) throws if ANY reference image is supplied, even from an approved predecessor — the prior 'optional identity reference' allowance is gone", () => {
  const asset = sheetAsset({ replaces_asset_id: "predecessor1" });
  assert.throws(() => referenceJobPayload(asset, {}, { user_id: "u1" }, "prompt", "free", "https://example.com/approved-predecessor.png"), /RENDERER_POLICY_VIOLATION/);
});

test("referenceJobPayload for the SAME role with edit_instruction dispatches Seedream Pro with the source image", () => {
  const asset = sheetAsset({ edit_instruction: "make the jacket red", replaces_asset_id: "parent1", input_reference_asset_ids: ["parent1"] });
  const job = referenceJobPayload(asset, {}, { user_id: "u1" }, "prompt", "free", "https://example.com/parent.png");
  assert.equal(job.tool_key, SEEDREAM_5_PRO);
  assert.deepEqual(job.input.ref_images, ["https://example.com/parent.png"]);
});

test("resolveAssetRoleKey correctly maps the canonical sheet angle for the renderer resolver's own lookup", () => {
  assert.equal(resolveAssetRoleKey(sheetAsset()), "CHARACTER_REFERENCE_SHEET");
  assert.equal(referenceRendererPolicy(sheetAsset()).toolKey, KLING_O3);
});

test("the retired identity_outfit_sheet role is untouched by the Kling migration — still Klein 4B", () => {
  const legacyAsset = { id: "a2", reference_type: "character_reference", angle_or_view: "identity_outfit_sheet", entity_id: entity };
  assert.equal(referenceRendererPolicy(legacyAsset).toolKey, KLEIN_4B);
});

test("K/L: selectCurrentVisualWorldAssets — the ONE selector behind both Reference Board and All References — excludes retired-taxonomy rows never reachable from the current reference plan", () => {
  const legacyFace = { id: "legacy-face", entity_id: entity, angle_or_view: "face_sheet", status: "succeeded", qa_status: "approved", result_url: "old-face.png" };
  const legacyProfile = { id: "legacy-profile", entity_id: entity, angle_or_view: "profile_silhouette_sheet", status: "succeeded", qa_status: "approved", result_url: "old-profile.png" };
  const currentSheet = { id: "sheet1", entity_id: entity, angle_or_view: "character_reference_sheet", status: "succeeded", qa_status: "approved", result_url: "new.png" };
  const entities = [{ entityId: entity, requiredViews: [{ angle: "character_reference_sheet" }] }];
  const scoped = selectCurrentVisualWorldAssets(entities, [legacyFace, legacyProfile, currentSheet]);
  assert.equal(scoped.length, 1, "only the current single-sheet role may appear — historical Face/Profile rows must never leak into either view");
  assert.equal(scoped[0].id, "sheet1");
});

test("N: referenceProgress's denominator is built from the same requiredViews-scoped selector, not raw asset-row count", () => {
  const legacyRow = { id: "legacy1", entity_id: entity, angle_or_view: "identity_outfit_sheet", status: "succeeded", qa_status: "approved", result_url: "old.png" };
  const currentSheet = { id: "sheet1", entity_id: entity, angle_or_view: "character_reference_sheet", status: "succeeded", qa_status: "approved", result_url: "new.png" };
  const entities = [{ entityId: entity, requiredViews: [{ angle: "character_reference_sheet" }] }];
  const progress = referenceProgress([legacyRow, currentSheet], entities);
  assert.equal(progress.total, 1);
  assert.equal(progress.ready, 1);
});

test("M: every style preset's previewAsset import path resolves to a real file on disk (Vite-safe imports, no runtime-constructed /src/assets/... string)", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const stylePresetsPath = path.join(__dirname, "..", "src", "pages", "workspace", "long-form", "stylePresets.js");
  const source = fs.readFileSync(stylePresetsPath, "utf8");
  const importLines = [...source.matchAll(/^import\s+\w+\s+from\s+"([^"]+\.png)";$/gm)];
  assert.ok(importLines.length >= 6, "expected at least the 6 launch presets' preview imports");
  for (const [, relativeImportPath] of importLines) {
    const resolved = path.resolve(path.dirname(stylePresetsPath), relativeImportPath);
    assert.ok(fs.existsSync(resolved), `${relativeImportPath} must resolve to a real file (Vite import, not a runtime-constructed path)`);
  }
  assert.doesNotMatch(source, /`\/src\/assets|"\/src\/assets/, "must never construct a /src/assets/... URL at runtime");
});
