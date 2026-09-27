import test from "node:test";
import assert from "node:assert/strict";
import { referenceRendererPolicy, resolveReferenceOperationRenderer, KLEIN_4B, KLING_O3, SEEDREAM_5_PRO, SEEDREAM_5_PRO_AIR } from "../supabase/functions/_shared/referenceRendererPolicy.js";
import { referenceJobPayload } from "../supabase/functions/_shared/visualWorldJobs.ts";

test("all current canonical references use Kling O3 by default", () => {
  const assets = [
    { reference_type: "style_reference", angle_or_view: "canonical_style_frame" },
    { reference_type: "diagram_style_reference", angle_or_view: "canonical_diagram_style" },
    { reference_type: "location_reference", angle_or_view: "wide_establishing" },
    { reference_type: "object_reference", angle_or_view: "three_quarter_hero" },
    { reference_type: "celestial_reference", angle_or_view: "canonical_celestial_view" },
    { reference_type: "environment_reference", angle_or_view: "crop_specimen" },
  ];
  for (const asset of assets) assert.equal(referenceRendererPolicy(asset).toolKey, KLING_O3);
  assert.equal(referenceRendererPolicy({ reference_type: "character_reference", angle_or_view: "character_reference_sheet" }).toolKey, KLING_O3);
  assert.equal(resolveReferenceOperationRenderer({ operation: "edit", assetRole: "CHARACTER_PROFILE", referenceImageCount: 1 }).toolKey, SEEDREAM_5_PRO);
  assert.equal(SEEDREAM_5_PRO_AIR, "bytedance:seedream@5.0-pro");
});

test("simple canonical jobs are zero-credit 2720x1536 Kling jobs", () => {
  const job = referenceJobPayload({ id: "asset", reference_type: "object_reference", angle_or_view: "three_quarter_hero" }, {}, { user_id: "owner" }, "prompt", "free");
  assert.equal(job.tool_key, KLING_O3);
  assert.equal(job.input.width, 2720);
  assert.equal(job.input.height, 1536);
  assert.equal(job.charge_credits, 0);
  assert.equal(job.settings.credits, 0);
  assert.equal(job.max_attempts, 3);
  assert.equal(job.input.ref_images, undefined);
});
