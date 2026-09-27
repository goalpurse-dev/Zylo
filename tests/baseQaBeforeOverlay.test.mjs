import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "FINAL stabilization pass" §9 — real Atlantis finding: the
// prior single-pass ordering composited the deterministic exact-text
// overlay onto the pixels BEFORE vision QA ever ran, so (a) a base that was
// always going to hard-fail on identity/style/composition still paid the
// cost of building an overlay it would never need, and (b) QA never
// actually judged the clean base — it judged whatever the overlay step had
// already produced. Restructured into three phases: PHASE 1 (base QA on
// base_result_url only) -> gate -> PHASE 2 (deterministic overlay, base-
// passed only) -> PHASE 3 (deterministic overlay validation, no second
// vision call). Source-pattern test — advance-long-form-scene-generation
// is a Deno edge function entrypoint with no fetch-mock harness in this
// repo, matching this file's own established testing convention (see
// runwareImageModelCapabilities.test.mjs, reuseNeverOutlivesSourceQA.test.mjs).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("§9: PHASE 1 (runSceneQA) reads baseUrl, which is resolved from base_result_url/result_url ONLY — never final_result_url, which could already carry an overlay from a prior attempt", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.match(text, /let baseUrl = scene\.base_result_url \?\? scene\.result_url;/);
  const qaCallBlock = text.slice(text.indexOf("result = await runSceneQA({"), text.indexOf("result = await runSceneQA({") + 300);
  assert.match(qaCallBlock, /imageUrl: baseUrl,/);
});

test("§9: hasVerifiedOverlay is unconditionally false going into Phase 1 QA — an overlay can never have been verified before Phase 1 even runs", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.match(text, /qaContext\.hasVerifiedOverlay = false;/);
});

test("§9: a Phase 1 rejection (!result.approved) records the QA result and returns BEFORE any overlay compositing code is reached — 'a failed base image never receives an overlay'", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const gateIndex = text.indexOf("if (!result.approved) {");
  const overlayIndex = text.indexOf('if (qaContext.criticalTextRequired && !scene.overlay_applied');
  assert.ok(gateIndex >= 0 && overlayIndex > gateIndex, "the Phase 1 approval gate must precede the overlay-compositing block in source order");
  const gateBlock = text.slice(gateIndex, overlayIndex);
  assert.match(gateBlock, /record_scene_qa_result/);
  assert.match(gateBlock, /return;/);
});

test("§9: Phase 2 overlay compositing is gated on GENERATE/EDIT + criticalTextRequired + !overlay_applied, unchanged in spirit from before, but now runs strictly AFTER the Phase 1 gate", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.match(text, /if \(qaContext\.criticalTextRequired && !scene\.overlay_applied && \["GENERATE", "EDIT"\]\.includes\(scene\.render_strategy\) && baseUrl\) \{/);
});

test("§9 PHASE 3: the composited overlay is validated against its own geometry contract (still 16:9) deterministically — never a second vision call, never a generic readable-text check", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const overlayStart = text.indexOf('if (qaContext.criticalTextRequired && !scene.overlay_applied');
  const overlayBlock = text.slice(overlayStart, text.lastIndexOf("const { error } = await admin.rpc(\"record_scene_qa_result\""));
  assert.match(overlayBlock, /OVERLAY_VALIDATION_FAILED/);
  assert.match(overlayBlock, /isValidFinalAspectRatio\(composited\.width, composited\.height\)/);
  // No second call to runSceneQA/OpenAI anywhere inside the overlay block.
  assert.doesNotMatch(overlayBlock, /runSceneQA\(/);
});

test("§9: a failed overlay composite/validation fails OPEN to the already-approved base (non-fatal) — never blocks a scene that legitimately passed Phase 1", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const overlayStart = text.indexOf('if (qaContext.criticalTextRequired && !scene.overlay_applied');
  const overlayBlock = text.slice(overlayStart, text.lastIndexOf("const { error } = await admin.rpc(\"record_scene_qa_result\""));
  assert.match(overlayBlock, /non-fatal — the approved base still ships without the overlay/);
});

test("§9: geometry auto-correction (Phase 1, pre-QA) writes to BOTH base_result_url and final_result_url — the base layer itself is what's being corrected, and Final must still equal Base with no overlay present", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.match(text, /base_result_url: publicUrl\.publicUrl, final_result_url: publicUrl\.publicUrl, updated_at: new Date\(\)\.toISOString\(\) \}\)\.eq\("id", scene\.id\);\s*\n\s*baseUrl = publicUrl\.publicUrl;/);
});
