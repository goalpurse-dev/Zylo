import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveImageRenderDimensions, validateReferenceImageCount, snapToSupportedDimensions,
  clampReferenceImageCount, ModelDimensionPolicyViolation,
  QWEN_IMAGE_EDIT_PLUS, KLING_IMAGE_O3, FLUX2_KLEIN_9B_KV, SEEDREAM_5_LITE,
} from "../supabase/functions/_shared/imageDimensionPolicy.ts";

// Real incident regression (2026-09-13/14): a Qwen EDIT job was dispatched
// at 2720x1536 (Kling's own GENERATE size) — real Runware 400, taskUUID
// 54ce89c6-22bf-4c49-99bf-aac93084771d. "Image width must be an integer
// value between 512 and 2048."

test("A: Kling 2720x1536 -> Qwen Edit resolves safely (never 2720x1536)", () => {
  const resolved = resolveImageRenderDimensions({ model: QWEN_IMAGE_EDIT_PLUS, operation: "edit", requestedWidth: 2720, requestedHeight: 1536, targetAspectRatio: 16 / 9 });
  assert.notEqual(resolved.width, 2720);
  assert.notEqual(resolved.height, 1536);
  assert.ok(resolved.width <= 2048, `width ${resolved.width} must be <= 2048`);
  assert.ok(resolved.width >= 512, `width ${resolved.width} must be >= 512`);
  assert.equal(resolved.source, "renderer-policy");
  assert.equal(resolved.model, QWEN_IMAGE_EDIT_PLUS);
});

test("B: Qwen never receives >2048 width for ANY requested size, including huge/absurd inputs", () => {
  for (const [w, h] of [[2720, 1536], [4096, 2304], [10000, 10000], [512, 288]]) {
    const resolved = resolveImageRenderDimensions({ model: QWEN_IMAGE_EDIT_PLUS, operation: "edit", requestedWidth: w, requestedHeight: h });
    assert.ok(resolved.width <= 2048, `requested ${w}x${h} resolved to width ${resolved.width} > 2048`);
  }
});

test("C: Kling Generate keeps Kling's own proven dimensions (2720x1536 exact match passes through unchanged)", () => {
  const resolved = resolveImageRenderDimensions({ model: KLING_IMAGE_O3, operation: "generate", requestedWidth: 2720, requestedHeight: 1536 });
  assert.equal(resolved.width, 2720);
  assert.equal(resolved.height, 1536);
});

test("C (contrast): Klein 9B KV never receives Kling's 2720x1536 (exceeds its real 2048 max width) — resolves to its own approved 16:9 size", () => {
  const resolved = resolveImageRenderDimensions({ model: FLUX2_KLEIN_9B_KV, operation: "generate", targetAspectRatio: 16 / 9 });
  assert.ok(resolved.width <= 2048);
  assert.equal(resolved.width, 2048);
  assert.equal(resolved.height, 1152);
});

test("D: Seedream 2848x1600 accepted", () => {
  const resolved = resolveImageRenderDimensions({ model: SEEDREAM_5_LITE, operation: "generate", requestedWidth: 2848, requestedHeight: 1600 });
  assert.equal(resolved.width, 2848);
  assert.equal(resolved.height, 1600);
});

test("E: Seedream 4096x2304 accepted", () => {
  const resolved = resolveImageRenderDimensions({ model: SEEDREAM_5_LITE, operation: "generate", requestedWidth: 4096, requestedHeight: 2304 });
  assert.equal(resolved.width, 4096);
  assert.equal(resolved.height, 2304);
});

test("F: Seedream 14 references accepted", () => {
  assert.doesNotThrow(() => validateReferenceImageCount(SEEDREAM_5_LITE, 14));
});

test("G: Seedream 15 references rejected pre-provider", () => {
  assert.throws(() => validateReferenceImageCount(SEEDREAM_5_LITE, 15), ModelDimensionPolicyViolation);
  try {
    validateReferenceImageCount(SEEDREAM_5_LITE, 15);
  } catch (e) {
    assert.equal(e.code, "MODEL_DIMENSION_POLICY_VIOLATION");
    assert.equal(e.details.reason, "TOO_MANY_REFERENCE_IMAGES");
    assert.equal(e.details.model, SEEDREAM_5_LITE);
  }
});

test("Qwen reference count: 3 accepted, 4 rejected (runware.ai verified 1-3 range)", () => {
  assert.doesNotThrow(() => validateReferenceImageCount(QWEN_IMAGE_EDIT_PLUS, 3));
  assert.throws(() => validateReferenceImageCount(QWEN_IMAGE_EDIT_PLUS, 4), ModelDimensionPolicyViolation);
});

test("Kling reference count: 1 accepted, 2 rejected (canonical sheet Regenerate — exactly one reference maximum)", () => {
  assert.doesNotThrow(() => validateReferenceImageCount(KLING_IMAGE_O3, 1));
  assert.throws(() => validateReferenceImageCount(KLING_IMAGE_O3, 2), ModelDimensionPolicyViolation);
});

test("H: no known model can resolve an unbounded/unknown-model payload — throws a typed policy violation rather than guessing", () => {
  assert.throws(() => resolveImageRenderDimensions({ model: "some:unregistered-model", operation: "generate", requestedWidth: 1024, requestedHeight: 1024 }), ModelDimensionPolicyViolation);
});

test("snapToSupportedDimensions mirrors resolveImageRenderDimensions' snapping for the runware-image final defense — Qwen 2720x1536 never passes through unmodified", () => {
  const { width, height } = snapToSupportedDimensions(2720, 1536, QWEN_IMAGE_EDIT_PLUS);
  assert.ok(width <= 2048);
  assert.notEqual(width, 2720);
});

test("snapToSupportedDimensions is a pure pass-through for a model with no registered policy (unknown airTags are never blocked here — only resolveImageRenderDimensions enforces pre-dispatch)", () => {
  const { width, height } = snapToSupportedDimensions(999, 999, "totally:unregistered");
  assert.equal(width, 999);
  assert.equal(height, 999);
});

test("clampReferenceImageCount truncates to the model's max (defense-in-depth, mirrors runware-image's own existing GPT Image 2/Kling behavior)", () => {
  const refs = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}.jpg`);
  assert.equal(clampReferenceImageCount(refs, SEEDREAM_5_LITE).length, 14);
  assert.equal(clampReferenceImageCount(refs, KLING_IMAGE_O3).length, 1);
});

test("I: exact-match preservation — a model's own already-proven dimension is never altered merely because it's not the 'first' approved entry", () => {
  const resolved = resolveImageRenderDimensions({ model: QWEN_IMAGE_EDIT_PLUS, operation: "edit", requestedWidth: 1024, requestedHeight: 1024 });
  assert.equal(resolved.width, 1024);
  assert.equal(resolved.height, 1024);
});

test("J: no reference/dimension policy path can construct a payload for an unregistered model — every known Long Form dispatch model IS registered", () => {
  for (const model of [QWEN_IMAGE_EDIT_PLUS, KLING_IMAGE_O3, FLUX2_KLEIN_9B_KV, SEEDREAM_5_LITE]) {
    assert.doesNotThrow(() => resolveImageRenderDimensions({ model, operation: "generate", targetAspectRatio: 16 / 9 }));
  }
});

// End-to-end at the actual scene job-payload level (Part 8's exact scenario:
// source scene Kling IMAGE O3 2720x1536, operation Edit, destination Qwen
// Image Edit Plus).
test("scenePromptJobPayload: an EDIT scene (V3 tier, source was a Kling GENERATE) never carries Kling's 2720x1536 into the Qwen payload, and keeps the reference image attached", async () => {
  const { scenePromptJobPayload } = await import("../supabase/functions/_shared/sceneJobs.ts");
  const scene = { id: "11111111-1111-1111-1111-111111111111", render_strategy: "EDIT", scene_render_plan_id: "plan-1" };
  const payload = scenePromptJobPayload(scene, "user-1", "Warm the lighting", "pro", "v3", ["https://example.com/source-scene.jpg"]);
  assert.equal(payload.tool_key, "image:qwen.image-edit-plus");
  assert.notEqual(payload.input.width, 2720);
  assert.notEqual(payload.input.height, 1536);
  assert.ok(payload.input.width <= 2048);
  assert.deepEqual(payload.input.ref_images, ["https://example.com/source-scene.jpg"]);
});

test("scenePromptJobPayload: a GENERATE scene (V3 tier / Kling) keeps Kling's own proven 2720x1536, with zero reference images by default", async () => {
  const { scenePromptJobPayload } = await import("../supabase/functions/_shared/sceneJobs.ts");
  const scene = { id: "22222222-2222-2222-2222-222222222222", render_strategy: "GENERATE", scene_render_plan_id: "plan-2" };
  const payload = scenePromptJobPayload(scene, "user-1", "A wide establishing shot", "pro", "v3", []);
  assert.equal(payload.tool_key, "image:kling.o3");
  assert.equal(payload.input.width, 2720);
  assert.equal(payload.input.height, 1536);
});

test("scenePromptJobPayload: a GENERATE scene on the V2 (Klein 9B KV) tier never inherits Kling's 2720x1536 — Klein's real max width is 2048", async () => {
  const { scenePromptJobPayload } = await import("../supabase/functions/_shared/sceneJobs.ts");
  const scene = { id: "33333333-3333-3333-3333-333333333333", render_strategy: "GENERATE", scene_render_plan_id: "plan-3" };
  const payload = scenePromptJobPayload(scene, "user-1", "A wide establishing shot", "pro", "v2", []);
  assert.equal(payload.tool_key, "image:flux2.klein9bkv");
  assert.ok(payload.input.width <= 2048, `V2 GENERATE width ${payload.input.width} must respect Klein 9B KV's real 2048 max`);
});

test("H: Seedream estimated cost metadata is $0.035 for both currently verified presets (providers.ts source of truth)", async () => {
  const { KEY_LINKS } = await import("../src/lib/providers.ts");
  assert.equal(KEY_LINKS["image:seedream5lite"].costUSD, 0.035);
  assert.equal(KEY_LINKS["image:seedream5lite"].airTag, "bytedance:seedream@5.0-lite");
});

test("I: actual provider-reported cost remains authoritative after job reconciliation — sceneJobResult reads job.output.data[0].cost, never a hardcoded estimate", async () => {
  const { sceneJobResult } = await import("../supabase/functions/_shared/sceneJobs.ts");
  const job = { status: "succeeded", result_url: "https://example.com/out.png", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:05Z", output: { data: [{ cost: 0.0412 }] } };
  const result = sceneJobResult(job);
  assert.equal(result.cost_usd, 0.0412, "must reflect the REAL provider-reported cost, not the $0.035 estimate");
});

test("scenePromptJobPayload: a GENERATE scene on the V4 (Seedream 5.0 Lite) tier resolves to a verified Seedream size, never Kling's dimensions", async () => {
  const { scenePromptJobPayload } = await import("../supabase/functions/_shared/sceneJobs.ts");
  const scene = { id: "44444444-4444-4444-4444-444444444444", render_strategy: "GENERATE", scene_render_plan_id: "plan-4" };
  const payload = scenePromptJobPayload(scene, "user-1", "A wide establishing shot", "pro", "v4", []);
  assert.equal(payload.tool_key, "image:seedream5lite");
  const validSeedreamSizes = [[2848, 1600], [4096, 2304]];
  assert.ok(validSeedreamSizes.some(([w, h]) => w === payload.input.width && h === payload.input.height), `V4 resolved to ${payload.input.width}x${payload.input.height}, not a verified Seedream size`);
});
