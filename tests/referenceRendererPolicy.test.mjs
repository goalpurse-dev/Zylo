import test from "node:test";
import assert from "node:assert/strict";
import { referenceRendererPolicy, acceptedIdentityAnchor, compileGeometryEdit, savedReferenceModelLabel, QWEN, KLEIN } from "../supabase/functions/_shared/referenceRendererPolicy.js";
import { referenceJobPayload, ensureReferenceJob } from "../supabase/functions/_shared/visualWorldJobs.ts";
import { currentReferenceAssets } from "../src/pages/workspace/long-form/visualWorldPlanning.js";
const target = { id: "profile", visual_world_version_id: "world", entity_id: "hero", reference_type: "character_reference", angle_or_view: "profile", input_reference_asset_ids: ["anchor"] };
const anchor = { ...target, id: "anchor", angle_or_view: "three_quarter_neutral", generation_type: "provider", status: "succeeded", result_url: "https://example.com/accepted.png" };
test("role policy: Profile/Back use Qwen; identity, face, outfit and environments use Klein", () => {
  for (const angle of ["profile", "back"]) assert.equal(referenceRendererPolicy({ ...target, angle_or_view: angle }).toolKey, QWEN);
  for (const angle of ["three_quarter_neutral", "face_closeup", "outfit_detail"]) assert.equal(referenceRendererPolicy({ ...target, angle_or_view: angle }).toolKey, KLEIN);
  for (const type of ["location_reference", "object_reference", "vehicle_reference"]) assert.equal(referenceRendererPolicy({ ...target, reference_type: type }).toolKey, KLEIN);
});
test("missing/failed/pending identity blocks geometry; rejected turnaround never wins", () => {
  assert.equal(acceptedIdentityAnchor([], target), null);
  assert.equal(acceptedIdentityAnchor([{ ...anchor, status: "failed" }], target), null);
  assert.equal(acceptedIdentityAnchor([{ ...anchor, qa_expectations: { reviewStatus: "pending" } }], target), null);
  const rejected = { ...anchor, id: "crop", generation_type: "deterministic_crop", qa_expectations: { reviewStatus: "rejected" } };
  assert.equal(acceptedIdentityAnchor([rejected], target), null);
  assert.equal(acceptedIdentityAnchor([anchor, rejected], target).id, "anchor");
  assert.throws(() => referenceJobPayload(target, {}, {}, "edit", "free"), /ANCHOR_REQUIRED/);
  assert.throws(() => referenceJobPayload({ ...target, input_reference_asset_ids: [] }, {}, {}, "edit", "free", anchor.result_url), /ANCHOR_REQUIRED/);
});
test("Qwen payload has exactly the accepted image, one attempt and zero credits", () => {
  const prompt = compileGeometryEdit(target);
  const job = referenceJobPayload(target, { renderer_tool_key: KLEIN }, { user_id: "owner" }, prompt, "free", anchor.result_url);
  assert.equal(job.tool_key, QWEN);
  assert.deepEqual(job.input.ref_images, [anchor.result_url]);
  assert.equal(job.max_attempts, 1);
  assert.equal(job.charge_credits, 0);
  assert.equal(job.settings.credits, 0);
  assert.equal(job.input.width, 1024);
  assert.ok(prompt.length <= 2000, "adapter must not truncate instructions");
  assert.match(prompt, /EDIT THE PROVIDED/);
  assert.match(prompt, /90-DEGREE SIDE PROFILE/);
  assert.match(prompt, /ONE eye/);
  assert.match(prompt, /No Mars room/);
});
test("pending/rejected edits preserve current profile; approved edit preserves replacement history", () => {
  const old = { ...target, id: "old", status: "succeeded", result_url: "old.png" };
  const candidate = { ...target, id: "new", status: "succeeded", result_url: "new.png", generation_type: "role_edit_experiment", qa_expectations: { reviewStatus: "pending" } };
  assert.deepEqual(currentReferenceAssets([old, candidate]), [old]);
  const approved = { ...candidate, replaces_asset_id: old.id, qa_expectations: { reviewStatus: "approved" } };
  const history = [old, approved];
  assert.deepEqual(currentReferenceAssets(history), [approved]);
  assert.equal(history[0].result_url, "old.png");
  assert.equal(savedReferenceModelLabel({ render_model: "runware:108@22" }), "Qwen Image Edit Plus");
});
test("remount/repeated enqueue retains one immutable job", async () => {
  const jobs = new Map();
  const db = { rpc: async (_, { p_asset_id, p_job }) => { if (!jobs.has(p_asset_id)) jobs.set(p_asset_id, p_job); return { data: p_asset_id }; } };
  const run = () => ensureReferenceJob(db, target, {}, { user_id: "owner" }, compileGeometryEdit(target), "free", anchor.result_url);
  await Promise.all([run(), run(), run()]);
  assert.equal(jobs.size, 1);
});
