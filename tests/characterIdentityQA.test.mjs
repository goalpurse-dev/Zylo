import test from "node:test";
import assert from "node:assert/strict";
import { referenceRendererPolicy, acceptedIdentityAnchor, currentApprovedAsset, canonicalReference, compileGeometryEdit } from "../supabase/functions/_shared/referenceRendererPolicy.js";
import { referenceJobPayload } from "../supabase/functions/_shared/visualWorldJobs.ts";
import { resolveDisplayStatus, referenceProgress, currentReferenceAssets } from "../src/pages/workspace/long-form/visualWorldPlanning.js";
import { compileReferencePrompt, ZYVO_STYLE_SPEC, FACE_CROP_RECT, renderIdentitySpecBlock } from "../supabase/functions/_shared/visualWorldStyle.ts";

const world = "world", entity = "hero";
const master = { id: "master", visual_world_version_id: world, entity_id: entity, reference_type: "character_reference", angle_or_view: "three_quarter_neutral", generation_type: "provider", status: "succeeded", result_url: "https://x/master.png" };
const face = { id: "face", visual_world_version_id: world, entity_id: entity, reference_type: "character_reference", angle_or_view: "face_closeup", generation_type: "deterministic_crop", status: "succeeded", result_url: "https://x/face.png", qa_status: "approved" };
const profileTarget = { id: "profile", visual_world_version_id: world, entity_id: entity, reference_type: "character_reference", angle_or_view: "profile", input_reference_asset_ids: ["master"] };

// Face Detail is now a separate Seedream Pro canonical asset derived from
// the approved identity anchor.
test("Face resolves to a Seedream Pro derived-image policy", () => {
  const policy = referenceRendererPolicy({ reference_type: "character_reference", angle_or_view: "face_closeup" });
  assert.equal(policy.toolKey, "image:seedream5pro");
  assert.equal(policy.requiresIdentityAnchor, true);
  const job = referenceJobPayload({ ...profileTarget, angle_or_view: "face_closeup" }, {}, { user_id: "owner" }, "x", "free", master.result_url);
  assert.equal(job.tool_key, "image:seedream5pro");
});

// B/C — Profile cannot dispatch without an approved Identity Master;
// rejected/pending masters (and old turnaround rejects) never count.
test("Profile/Back dispatch require an accepted (qa-approved) Identity Master", () => {
  assert.equal(acceptedIdentityAnchor([], profileTarget), null, "no master at all");
  assert.equal(acceptedIdentityAnchor([{ ...master, qa_status: "pending" }], profileTarget), null, "master still under review");
  assert.equal(acceptedIdentityAnchor([{ ...master, qa_status: "rejected" }], profileTarget), null, "master rejected by QA");
  assert.equal(acceptedIdentityAnchor([master], profileTarget).id, "master", "qa_status:null (legacy/no-QA row) is treated as approved");
  assert.equal(acceptedIdentityAnchor([{ ...master, qa_status: "approved" }], profileTarget).id, "master");
  assert.throws(() => referenceJobPayload({ ...profileTarget, input_reference_asset_ids: [] }, {}, {}, "x", "free"), /ANCHOR_REQUIRED/);
});

// E/F — scene-reference-style resolution only selects qa_status:'approved'
// (or legacy null); rejected/pending never selectable downstream.
test("currentApprovedAsset only selects usable references", () => {
  assert.equal(currentApprovedAsset([{ ...master, qa_status: "rejected" }], entity, "three_quarter_neutral"), null);
  assert.equal(currentApprovedAsset([{ ...master, qa_status: "pending" }], entity, "three_quarter_neutral"), null);
  assert.equal(currentApprovedAsset([master], entity, "three_quarter_neutral").id, "master");
  assert.equal(currentApprovedAsset([{ ...master, qa_status: "approved" }], entity, "three_quarter_neutral").id, "master");
});

// D — a succeeded generation is never auto-approved into "Ready" — the UI
// must show "Needs review" for a QA-rejected row, board membership (Part 16
// "never silently vanished") is preserved via canonicalReference/currentReferenceAssets.
test("QA rejection shows Needs review, not Ready — and stays visible on the board", () => {
  const rejectedProfile = { ...profileTarget, status: "succeeded", result_url: "https://x/profile.png", qa_status: "rejected" };
  assert.deepEqual(resolveDisplayStatus(rejectedProfile, []), { key: "needs_review", label: "Needs review" });
  assert.deepEqual(resolveDisplayStatus({ ...rejectedProfile, qa_status: "approved" }, []), { key: "ready", label: "Ready" });
  assert.deepEqual(resolveDisplayStatus({ ...rejectedProfile, qa_status: null }, []), { key: "checking", label: "Checking…" });
  assert.ok(canonicalReference(rejectedProfile), "still a real board row — QA rejection is a status, not a deletion");
  assert.deepEqual(currentReferenceAssets([rejectedProfile]).map((a) => a.id), ["profile"]);
  const progress = referenceProgress([rejectedProfile, { ...master, id: "m2", qa_status: "approved" }]);
  assert.equal(progress.ready, 1, "only the approved master counts as ready");
  assert.equal(progress.needsReview, 1);
});

// Multi-reference geometry payload (Part 6): master + face, verified within
// Qwen's documented 1-3 referenceImages range.
test("geometry job payload accepts a dual reference (master + face crop)", () => {
  const job = referenceJobPayload(profileTarget, {}, { user_id: "owner" }, "prompt", "free", [master.result_url, face.result_url]);
  assert.deepEqual(job.input.ref_images, [master.result_url, face.result_url]);
});

// Regression: compileGeometryEdit must render the ACTUAL character's
// identity spec, not a hardcoded costume ("jumpsuit"/"watch") that was
// wrong for any character not wearing one.
test("compileGeometryEdit uses the real CharacterIdentitySpec, not hardcoded wardrobe", () => {
  const spec = { apparentAge: "early 30s", sexPresentation: "male", faceShape: "narrow oval", faceWidth: "narrow", jawShape: "angular", chinShape: "pointed", noseShape: "straight", eyeShape: "narrow", eyebrowShape: "thick straight", hairstyle: "swept-back", hairColor: "brown", facialHair: "short stubble", skinTone: "olive", heightImpression: "tall", shoulderWidth: "average", torsoBuild: "lean", outfitSpec: { baseGarment: "field vest", colors: "olive and tan" } };
  const prompt = compileGeometryEdit(profileTarget, ZYVO_STYLE_SPEC.summary, spec, 1);
  assert.match(prompt, /field vest/i);
  assert.match(prompt, /narrow oval/i);
  assert.doesNotMatch(prompt, /jumpsuit/i);
  assert.doesNotMatch(prompt, /watch\/accessories/i);
  const dualPrompt = compileGeometryEdit(profileTarget, ZYVO_STYLE_SPEC.summary, spec, 2);
  assert.match(dualPrompt, /REFERENCE 1: full outfit/i);
});

// CharacterIdentitySpec renders as a structured block with no occupation/
// environment field for one to hide in, and canonicalSpec prose is dropped
// from [ENTITY IDENTITY] once a structured spec exists.
test("structured identity spec drives [ENTITY IDENTITY], not free canonicalSpec prose", () => {
  const spec = { apparentAge: "40s", sexPresentation: "female", faceShape: "square", faceWidth: "wide", jawShape: "broad", chinShape: "square", noseShape: "broad", noseSize: "medium", eyeShape: "round", eyeSpacing: "wide", eyebrowShape: "thin", earShape: "small", hairline: "low", hairstyle: "cropped", hairColor: "grey", facialHair: "none", skinTone: "dark", heightImpression: "short", shoulderWidth: "broad", torsoBuild: "stocky", limbBuild: "sturdy", distinguishingFeatures: ["scar above left brow"], silhouetteSignature: "compact and broad", outfitSpec: { baseGarment: "coverall", colors: "grey and orange", collar: "high", sleeves: "rolled", pockets: "many", belt: "wide", shoes: "boots", accessories: "gloves", abstractPatches: "blank rectangular patch, no lettering" } };
  const view = { referenceType: "character_reference", angle: "three_quarter_neutral", purpose: "x" };
  const prompt = compileReferencePrompt({ styleSpec: ZYVO_STYLE_SPEC, entityName: "Controller", canonicalSpec: "a Mars habitat power controller wearing a coverall", identitySpec: spec, view });
  assert.match(prompt, /scar above left brow/i);
  assert.match(prompt, /coverall/i);
  assert.doesNotMatch(prompt, /habitat power controller/i, "occupation/environment prose must not leak in once a structured spec exists");
  const block = renderIdentitySpecBlock(spec);
  assert.ok(block.some((l) => /square/.test(l)));
});

// Deterministic crop rect stays within a 1024x1024 master.
test("FACE_CROP_RECT fits inside the 1024x1024 Identity Master canvas", () => {
  assert.ok(FACE_CROP_RECT.x >= 0 && FACE_CROP_RECT.y >= 0);
  assert.ok(FACE_CROP_RECT.x + FACE_CROP_RECT.width <= 1024);
  assert.ok(FACE_CROP_RECT.y + FACE_CROP_RECT.height <= 1024);
});
