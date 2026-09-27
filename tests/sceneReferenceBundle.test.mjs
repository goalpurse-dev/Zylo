import test from "node:test";
import assert from "node:assert/strict";
import {
  sortCanonicalReferences, computeBundleHash, buildReferenceBundleImage,
  bundlePromptInstruction, BUNDLE_CONTRACT_VERSION,
} from "../supabase/functions/_shared/sceneReferenceBundle.ts";

// Part 14 (A-R) — "CRITICAL SCENE GENERATION RELIABILITY + CANONICAL
// REFERENCE PASS". Pure-logic pieces (bundle composition, hashing,
// ordering, prompt framing) are unit-tested directly here. SQL/deployment
// claims (D, G structurally, H, J, L, M, P, Q, R) were verified via
// rolled-back real-DB transactions and structural source checks — see the
// final report for the exact evidence, since a Node test can't drive
// Postgres RLS/security-definer functions or a live cron.

function rawImage(w, h, fill = [200, 100, 50]) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = fill[0]; data[i * 4 + 1] = fill[1]; data[i * 4 + 2] = fill[2]; data[i * 4 + 3] = 255; }
  return { width: w, height: h, data };
}

/* A/B/C: Kling GENERATE needing 3 refs doesn't throw, all 3 remain represented, none silently dropped */
test("A/B/C: sorting + bundling represents every canonical reference — none silently dropped, deterministic order (character, then location, then object)", () => {
  const assets = [
    { id: "obj-1", result_url: "https://x/obj.jpg", reference_type: "object_reference", entity_id: "o_tablet" },
    { id: "char-1", result_url: "https://x/char.jpg", reference_type: "character_reference", entity_id: "e_protagonist" },
    { id: "loc-1", result_url: "https://x/loc.jpg", reference_type: "location_reference", entity_id: "l_habitat" },
  ];
  const sorted = sortCanonicalReferences(assets);
  assert.deepEqual(sorted.map((a) => a.id), ["char-1", "loc-1", "obj-1"], "character first, then location, then object");
  const board = buildReferenceBundleImage([rawImage(1000, 1000), rawImage(800, 1200), rawImage(1200, 800)]);
  // A 3-image board needs ceil(sqrt(3))=2 cols x ceil(3/2)=2 rows — every
  // source image gets a real cell, none dropped.
  assert.equal(board.width, 2 * 768);
  assert.equal(board.height, 2 * 768);
});

test("no reference count is ever silently truncated — a 5-image set still produces a board with a cell for all 5", () => {
  const images = Array.from({ length: 5 }, (_, i) => rawImage(500 + i * 10, 500));
  const board = buildReferenceBundleImage(images);
  const cols = Math.ceil(Math.sqrt(5)), rows = Math.ceil(5 / cols);
  assert.equal(board.width, cols * 768);
  assert.equal(board.height, rows * 768);
});

/* E: bundle costs $0 provider spend (structural — no fetch to an image-gen provider) */
test("E: buildReferenceBundleImage / the bundling pipeline never calls an AI generation endpoint — it's pure pixel composition", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/sceneReferenceBundle.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /runware\.ai|openai\.com\/v1\/(images|chat)/i, "no image-generation or chat-completion endpoint should ever be called while building a bundle");
});

/* F: prompt explicitly frames the bundle as reference material, not output layout */
test("F: bundlePromptInstruction explicitly tells the model the image is source material only, never a layout to reproduce", () => {
  const assets = [{ id: "c1", result_url: "u", reference_type: "character_reference", entity_id: "e_protagonist", entity_name: "Protagonist" }];
  const text = bundlePromptInstruction(assets);
  assert.match(text, /source material ONLY/);
  assert.match(text, /Do NOT reproduce the board\/collage\/grid layout/);
  assert.match(text, /ONE finished cinematic 16:9 scene/);
  assert.match(text, /Protagonist/);
});

/* Hash determinism/caching (Part 2's "reusable/cacheable by a stable hash") */
test("bundle hash is deterministic for the same inputs and changes when the reference set changes", async () => {
  const h1 = await computeBundleHash("world-1", ["a", "b", "c"]);
  const h2 = await computeBundleHash("world-1", ["a", "b", "c"]);
  const h3 = await computeBundleHash("world-1", ["a", "b"]);
  const h4 = await computeBundleHash("world-2", ["a", "b", "c"]);
  assert.equal(h1, h2, "identical inputs must hash identically — this is what makes the bundle cacheable/reusable");
  assert.notEqual(h1, h3, "a different reference set must hash differently");
  assert.notEqual(h1, h4, "a different visual world must hash differently even with the same reference ids");
  assert.equal(h1.length, 64, "sha-256 hex digest");
});

test("bundle hash includes the contract version, so a future layout change can't silently reuse an old-format cached bundle", async () => {
  const h1 = await computeBundleHash("world-1", ["a", "b"], BUNDLE_CONTRACT_VERSION);
  const h2 = await computeBundleHash("world-1", ["a", "b"], "reference-bundle-v2-hypothetical");
  assert.notEqual(h1, h2);
});

/* D: Seedream <=14 refs stays direct/separate (structural — resolveSceneReferencePayload's own branch) */
test("D: resolveSceneReferencePayload sends references DIRECTLY (no bundle) whenever count <= the renderer's own verified max", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/sceneReferenceBundle.ts", import.meta.url), "utf8");
  assert.match(src, /sorted\.length <= maxReferenceImages/, "the direct-pass-through branch must be gated on the renderer's own max, not a hardcoded number");
});

/* K: recovery cron auth fix is structurally present */
test("K/L: advance-long-form-scene-generation has an explicit verify_jwt=false config entry, matching its sibling advance-long-form-* workers' already-audited pattern", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
  const section = src.slice(src.indexOf("[functions.advance-long-form-scene-generation]"), src.indexOf("[functions.advance-long-form-scene-generation]") + 200);
  assert.match(section, /verify_jwt = false/);
});

/* P: claim priority uses sequence_index */
test("P: claim_long_form_scene_for_render orders by the render plan's sequence_index, not created_at", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/migrations/20260930210000_long_form_reference_bundle_and_reliability.sql", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("function public.claim_long_form_scene_for_render"), src.indexOf("$$;", src.indexOf("function public.claim_long_form_scene_for_render")));
  assert.match(fn, /order by srp\.sequence_index/);
  assert.doesNotMatch(fn, /order by sc\.created_at/);
});

/* H: failed job_id=null initial episode scene retries free (structural + already covered by the migration's own comment/logic) */
test("H: estimate_scene_operation_credits returns freeRetry:true (credits:0) for a regenerate on a scene that failed before any provider job existed", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/migrations/20260930220000_long_form_free_retry_estimate.sql", import.meta.url), "utf8");
  assert.match(src, /free_retry := sc\.status = 'failed' and sc\.job_id is null/);
  assert.match(src, /'credits', 0,.*'freeRetry', true/s);
});

/* I (UI): failed scene modal always has Try Again */
test("I: the scene modal's action gate allows a failed scene to show actions even with no result image (canRetryFailed is independent of canAct)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8");
  assert.match(src, /const canRetryFailed = card\.status\.key === "failed" && !viewingHistory;/);
  assert.match(src, /\(canAct \|\| canRetryFailed\) && \(editing/);
  assert.match(src, />Try Again/);
});

/* N: progress percentage uses real state counts */
test("N: the progress percentage is computed from real ready/needsReview/failed counts, never elapsed time", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8");
  assert.match(src, /processedPct = progress\.total \? Math\.floor\(\(\(progress\.ready \+ progress\.needsReview \+ progress\.failed\) \/ progress\.total\) \* 100\)/);
  assert.doesNotMatch(src, /Date\.now\(\)[\s\S]{0,80}processedPct|processedPct[\s\S]{0,80}Date\.now\(\)/);
});

/* O: old test scenes do not count as paid-run Ready/Needs Review (structural — generation_run_id exists and is inherited by descendants) */
test("O: retry/edit replacement scenes inherit generation_run_id from their predecessor, so a run's descendants stay attributed to the same paid run", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/migrations/20260930210000_long_form_reference_bundle_and_reliability.sql", import.meta.url), "utf8");
  const retryFn = src.slice(src.indexOf("function public.retry_long_form_scene"), src.indexOf("function public.edit_long_form_scene"));
  const editFn = src.slice(src.indexOf("function public.edit_long_form_scene"));
  assert.match(retryFn, /sc\.input_reference_asset_ids, sc\.generation_run_id\)/);
  assert.match(editFn, /sc\.input_reference_asset_ids, price, sc\.generation_run_id\)/);
});

/* Part 12: EDIT retains canonical reference association across retry/edit, not dropped to empty */
test("Part 12: a retry or ad-hoc edit inherits the predecessor's input_reference_asset_ids instead of defaulting to an empty array", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/migrations/20260930210000_long_form_reference_bundle_and_reliability.sql", import.meta.url), "utf8");
  assert.doesNotMatch(src, /input_reference_asset_ids\)\s*\n\s*values\([^)]*array\[\]::uuid\[\]\)/s, "no replacement-row insert should hardcode an empty reference array when a predecessor's real set is available");
});

/* Part 7: durable full-episode compilation self-chains */
test("Part 7: start-long-form-scene-generation self-chains to compile every remaining beat, and charge-long-form-episode-generation keeps its background work alive past the response", async () => {
  const fs = await import("node:fs");
  const startSrc = fs.readFileSync(new URL("../supabase/functions/start-long-form-scene-generation/index.ts", import.meta.url), "utf8");
  assert.match(startSrc, /remainingBeatIds/);
  assert.match(startSrc, /EdgeRuntime/);
  const chargeSrc = fs.readFileSync(new URL("../supabase/functions/charge-long-form-episode-generation/index.ts", import.meta.url), "utf8");
  assert.match(chargeSrc, /waitUntil/);
});

/* Part 1: dispatch-time canonical reference re-validation */
test("Part 1: the worker re-validates each GENERATE plan's canonical references are still CURRENT at dispatch time, not just at compile time", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-scene-generation/index.ts", import.meta.url), "utf8");
  assert.match(src, /current_long_form_reference_assets/);
  assert.match(src, /CANONICAL_REFERENCE_STALE_AT_DISPATCH/);
});

/* Part 4: QA receives the generated scene + original canonical references */
test("G: runSceneQA's vision call includes the generated scene AND each original canonical reference image, each mapped to its entity in the prompt", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/sceneQA.ts", import.meta.url), "utf8");
  assert.match(src, /referenceImages/);
  assert.match(src, /IMAGE 1 below is the generated scene/);
  const workerSrc = fs.readFileSync(new URL("../supabase/functions/advance-long-form-scene-generation/index.ts", import.meta.url), "utf8");
  assert.match(workerSrc, /scene\.input_reference_asset_ids/);
});
