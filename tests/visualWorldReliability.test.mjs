import test from "node:test";
import assert from "node:assert/strict";
import { findMissingRequiredViewRows } from "../supabase/functions/_shared/visualWorldStyle.ts";
import { acceptedIdentityAnchor } from "../supabase/functions/_shared/referenceRendererPolicy.js";
import { referenceProgress, resolveDisplayStatus } from "../src/pages/workspace/long-form/visualWorldPlanning.js";

const entities = [
  { entityId: "hero", requiredViews: [{ referenceType: "character_reference", angle: "identity_outfit_sheet" }, { referenceType: "character_reference", angle: "face_sheet" }, { referenceType: "character_reference", angle: "profile_silhouette_sheet" }] },
];

// A/self-heal — real incident: a taxonomy change left face_sheet/
// profile_silhouette_sheet with zero DB rows even though identity_outfit_
// sheet existed and was approved; the frontend synthesized "Planned"
// placeholders forever. findMissingRequiredViewRows is the pure diff
// stageGenerating uses to insert the real rows it's missing.
test("A — self-heal detects every required view with zero rows, not just non-terminal ones", () => {
  const current = [{ entity_id: "hero", angle_or_view: "identity_outfit_sheet" }];
  const missing = findMissingRequiredViewRows(entities, current, new Set());
  assert.deepEqual(missing.map((m) => m.angle_or_view).sort(), ["face_sheet", "profile_silhouette_sheet"]);
});

test("self-heal respects excluded views and never re-adds a row that already exists", () => {
  const current = [{ entity_id: "hero", angle_or_view: "identity_outfit_sheet" }, { entity_id: "hero", angle_or_view: "face_sheet" }];
  const missing = findMissingRequiredViewRows(entities, current, new Set(["hero:profile_silhouette_sheet"]));
  assert.deepEqual(missing, []);
});

// L — old/superseded/off-taxonomy rows must never inflate the denominator.
test("L — referenceProgress denominator is scoped to CURRENTLY required roles, not every non-superseded row", () => {
  const assets = [
    // stale OLD-taxonomy rows for the same entity — canonical, nothing
    // supersedes them within their own (abandoned) taxonomy, but they are
    // no longer a selected role.
    { id: "old1", entity_id: "hero", angle_or_view: "three_quarter_neutral", status: "succeeded", result_url: "x.png" },
    { id: "old2", entity_id: "hero", angle_or_view: "profile", status: "succeeded", result_url: "x.png" },
    // the one real current-taxonomy row
    { id: "new1", entity_id: "hero", angle_or_view: "identity_outfit_sheet", status: "succeeded", result_url: "x.png", qa_status: "approved" },
  ];
  const unscoped = referenceProgress(assets);
  assert.equal(unscoped.total, 3, "without entity context, old rows are indistinguishable from real ones");
  const scoped = referenceProgress(assets, entities);
  assert.equal(scoped.total, 1, "with entity context, only identity_outfit_sheet counts — face/profile sheets have no rows yet");
  assert.equal(scoped.ready, 1);
});

// E/F/G — accepted identity survives a regenerate; only promotes once the
// new candidate is itself approved (JS mirror of the SQL fix).
test("E/F/G — accepted identity survives regenerate; promotes only when the new candidate is approved", () => {
  const approved = { id: "old", visual_world_version_id: "w", entity_id: "hero", reference_type: "character_reference", angle_or_view: "identity_outfit_sheet", generation_type: "provider", status: "succeeded", result_url: "old.png", qa_status: "approved", created_at: "2026-01-01T00:00:00Z" };
  const target = { visual_world_version_id: "w", entity_id: "hero" };
  // E: regenerating creates a fresh, not-yet-reviewed candidate.
  const candidatePending = { ...approved, id: "new", replaces_asset_id: "old", qa_status: null, created_at: "2026-01-02T00:00:00Z" };
  assert.equal(acceptedIdentityAnchor([approved, candidatePending], target)?.id, "old", "old approved identity must remain the anchor while the new candidate is unreviewed");
  // F: candidate rejected — accepted pointer stays on the old one.
  const candidateRejected = { ...candidatePending, qa_status: "rejected" };
  assert.equal(acceptedIdentityAnchor([approved, candidateRejected], target)?.id, "old");
  // G: candidate approved — atomic promotion to the new one.
  const candidateApproved = { ...candidatePending, qa_status: "approved" };
  assert.equal(acceptedIdentityAnchor([approved, candidateApproved], target)?.id, "new");
});

// B/C — dependency wait never consumes a claim/provider attempt: the
// dependent row simply isn't returned as an accepted anchor, and its own
// claim_attempts are untouched by this check (verified structurally: the
// resolver takes no asset-mutating action, only reads).
test("B/C — dependency-unresolved sheet reads Waiting for identity, and checking it never touches claim_attempts", () => {
  const identity = { id: "id1", entity_id: "hero", angle_or_view: "identity_outfit_sheet", status: "succeeded", result_url: "x.png", qa_status: "pending" };
  const faceSheet = { id: "f1", entity_id: "hero", reference_type: "character_reference", angle_or_view: "face_sheet", status: "pending", claim_attempts: 0 };
  const before = JSON.stringify(faceSheet);
  const result = resolveDisplayStatus(faceSheet, [identity]);
  assert.equal(result.key, "waiting_for_identity");
  assert.equal(JSON.stringify(faceSheet), before, "resolving display status must be a pure read, never mutate claim bookkeeping");
});

// P — truthful state labels match the authoritative vocabulary.
test("P — lifecycle labels match the authoritative state table", () => {
  assert.equal(resolveDisplayStatus({ status: "planned" }).label, "Planned");
  assert.equal(resolveDisplayStatus({ status: "pending" }).label, "Queued");
  assert.equal(resolveDisplayStatus({ status: "running", job_id: null }).label, "Starting…");
  assert.equal(resolveDisplayStatus({ status: "running", job_id: "j1" }).label, "Generating…");
  assert.equal(resolveDisplayStatus({ status: "failed" }).label, "Needs another try");
  assert.equal(resolveDisplayStatus({ status: "succeeded", result_url: "x.png", qa_status: "rejected" }).label, "Needs review");
  assert.equal(resolveDisplayStatus({ status: "succeeded", result_url: "x.png", qa_status: null }).label, "Ready");
  assert.equal(resolveDisplayStatus({ status: "succeeded", result_url: "x.png", qa_status: "approved" }).label, "Ready");
});
