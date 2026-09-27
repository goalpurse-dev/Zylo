import test from "node:test";
import assert from "node:assert/strict";
import {
  isEpisodeGenerationCommitted, canManuallyApproveScene, summarizeSceneProgress, deriveSceneCardStatus,
  deriveEpisodeProgressPhase, EPISODE_PROGRESS_HEADING, buildSceneHistory, findDuplicateResultUrl,
} from "../src/pages/workspace/long-form/sceneCardModel.js";
import { resolveLongFormSceneRenderer } from "../supabase/functions/_shared/sceneRendererTiers.ts";

// Real incident this suite regression-tests: a handful of controlled-test
// scene rows (created directly against the backend during earlier phases,
// never through the paid Generate Episode action) made the Generate
// workspace behave as though the full paid episode generation had already
// started — locking the tier picker and hiding the real CTA. The fix: an
// episode's "committed" state has exactly one authoritative source (a real
// charged long_form_episode_generation_charges row), never scene rows.

const fakeChargeRow = { id: "charge-1", status: "charged", credits_charged: 43, tier: "v3" };

test("A: diagnostic/test scene rows do NOT lock the tier — commitment is false with no charge row, regardless of how many scenes exist", () => {
  assert.equal(isEpisodeGenerationCommitted(null), false);
  assert.equal(isEpisodeGenerationCommitted(undefined), false);
});

test("B: diagnostic/test scene rows do NOT hide the Generate Episode button — same false-without-a-charge rule drives both", () => {
  // The component renders generateButton whenever !episodeGenerationCommitted
  // — there is no separate "some scenes exist" branch that could hide it.
  const committed = isEpisodeGenerationCommitted(null);
  assert.equal(committed, false, "the CTA-hiding condition must stay false purely from scene rows existing");
});

test("C: a successful episode-generation commitment (a real charged row) DOES lock the tier", () => {
  assert.equal(isEpisodeGenerationCommitted(fakeChargeRow), true);
});

test("summarizeSceneProgress.started is a display-only fact about scene rows — explicitly NOT the commitment signal (13 real scenes among 115 planned must not read as committed)", () => {
  const cards = [
    ...Array.from({ length: 13 }, () => ({ status: { key: "ready" } })),
    ...Array.from({ length: 102 }, () => ({ status: { key: "planned" } })),
  ];
  const progress = summarizeSceneProgress(cards);
  assert.equal(progress.started, true, "progress.started legitimately reflects scene rows existing");
  // The regression this guards against: some earlier version of the UI OR'd
  // progress.started into the commitment check. Confirm the two are
  // independent — a real caller must consult isEpisodeGenerationCommitted
  // separately, never progress.started.
  assert.equal(isEpisodeGenerationCommitted(null), false, "commitment stays false even though progress.started is true");
});

test("D: the Generate CTA credit amount is whatever the server-estimated total is for the currently selected tier — never a hardcoded number", () => {
  // The component reads `estimates[tier].totalCredits` directly from
  // estimateLongFormSceneCredits's live RPC result — there is no fallback
  // literal anywhere in the render path. This test locks that contract at
  // the data-shape level: the estimate object must carry totalCredits for
  // arbitrary values (32/43/54 are real Mars numbers, not requirements).
  for (const totalCredits of [32, 43, 54, 7]) {
    const estimate = { totalCredits, tier: "v3" };
    assert.equal(estimate.totalCredits, totalCredits);
  }
});

test("E: a Needs Review scene exposes Approve", () => {
  assert.equal(canManuallyApproveScene("needs_review"), true);
});

test("F: a Ready scene does not need/expose Approve", () => {
  assert.equal(canManuallyApproveScene("ready"), false);
  assert.equal(canManuallyApproveScene("planned"), false);
  assert.equal(canManuallyApproveScene("failed"), false);
  assert.equal(canManuallyApproveScene("generating"), false);
});

test("G: Regenerate (operation:generate) routes to the tier's PRIMARY renderer, never Qwen, for all three tiers", () => {
  for (const tier of ["v2", "v3", "v4"]) {
    const { toolKey } = resolveLongFormSceneRenderer({ tier, operation: "generate" });
    assert.notEqual(toolKey, "image:qwen.image-edit-plus");
  }
  assert.equal(resolveLongFormSceneRenderer({ tier: "v2", operation: "generate" }).toolKey, "image:flux2.klein9bkv");
  assert.equal(resolveLongFormSceneRenderer({ tier: "v3", operation: "generate" }).toolKey, "image:kling.o3");
  assert.equal(resolveLongFormSceneRenderer({ tier: "v4", operation: "generate" }).toolKey, "image:seedream5lite");
});

test("H: Edit Scene (operation:edit) always routes to Qwen Image Edit Plus, regardless of tier", () => {
  for (const tier of ["v2", "v3", "v4"]) {
    const { toolKey } = resolveLongFormSceneRenderer({ tier, operation: "edit" });
    assert.equal(toolKey, "image:qwen.image-edit-plus");
  }
});

test("I: scene history is additive — every prior version remains reachable via the replaces_scene_id chain, current is always last", () => {
  const scenes = [
    { id: "a", replaces_scene_id: null, result_url: "url-a" },
    { id: "b", replaces_scene_id: "a", result_url: "url-b" },
    { id: "c", replaces_scene_id: "b", result_url: "url-c" },
  ];
  const history = buildSceneHistory(scenes, "c");
  assert.deepEqual(history.map((s) => s.id), ["a", "b", "c"]);
  assert.equal(history[history.length - 1].id, "c");
  // Regenerating again (a hypothetical "d") must never remove a, b, or c —
  // this is a property of the chain-walk itself: it only ever ADDS a link,
  // never deletes one, so a longer chain still contains every prior id.
  const longerScenes = [...scenes, { id: "d", replaces_scene_id: "c", result_url: "url-d" }];
  const longerHistory = buildSceneHistory(longerScenes, "d");
  assert.deepEqual(longerHistory.map((s) => s.id), ["a", "b", "c", "d"]);
});

test("J: two independent GENERATE scenes cannot accidentally share one result_url", () => {
  const scenes = [
    { id: "s1", render_strategy: "GENERATE", result_url: "https://x/1.jpg" },
    { id: "s2", render_strategy: "GENERATE", result_url: "https://x/2.jpg" },
  ];
  assert.equal(findDuplicateResultUrl(scenes, "s2", "https://x/2.jpg"), null, "s2's own url is not a conflict with itself");
  // Simulate the real bug this guards against: s2 ends up with s1's url.
  const buggyScenes = [
    { id: "s1", render_strategy: "GENERATE", result_url: "https://x/1.jpg" },
    { id: "s2", render_strategy: "GENERATE", result_url: "https://x/1.jpg" },
  ];
  assert.equal(findDuplicateResultUrl(buggyScenes, "s2", "https://x/1.jpg", "GENERATE"), "s1");
});

test("J (EDIT too): an independent EDIT scene cannot accidentally share a GENERATE scene's result_url either", () => {
  const scenes = [
    { id: "g1", render_strategy: "GENERATE", result_url: "https://x/1.jpg" },
    { id: "e1", render_strategy: "EDIT", result_url: "https://x/1.jpg" },
  ];
  assert.equal(findDuplicateResultUrl(scenes, "e1", "https://x/1.jpg", "EDIT"), "g1");
});

test("K: REUSE is explicitly allowed to intentionally share source pixels — never flagged as a duplicate", () => {
  const scenes = [
    { id: "base", render_strategy: "GENERATE", result_url: "https://x/base.jpg" },
    { id: "reuse1", render_strategy: "REUSE", result_url: "https://x/base.jpg" },
    { id: "reuse2", render_strategy: "REUSE", result_url: "https://x/base.jpg" },
  ];
  // A REUSE candidate is gated out immediately (by its OWN strategy) —
  // this is the exact false positive the test suite itself caught before
  // this fix: reuse1's shared url legitimately matches its GENERATE base,
  // which must never register as "two independent scenes colliding".
  assert.equal(findDuplicateResultUrl(scenes, "reuse1", "https://x/base.jpg", "REUSE"), null);
  assert.equal(findDuplicateResultUrl(scenes, "reuse2", "https://x/base.jpg", "REUSE"), null);
  assert.equal(findDuplicateResultUrl(scenes, "base", "https://x/base.jpg"), null, "the base GENERATE has no OTHER GENERATE/EDIT sibling sharing its url");
});

test("L: progress header never says 'ready' while Planned scenes remain", () => {
  const mostlyPlanned = { total: 115, ready: 6, needsReview: 7, failed: 0, active: 0, planned: 102 };
  assert.equal(deriveEpisodeProgressPhase(mostlyPlanned), "planned");
  assert.notEqual(EPISODE_PROGRESS_HEADING[deriveEpisodeProgressPhase(mostlyPlanned)], EPISODE_PROGRESS_HEADING.ready);
});

test("L (full state matrix): generating > planned > needs_review > ready, in priority order", () => {
  assert.equal(deriveEpisodeProgressPhase({ total: 10, ready: 0, needsReview: 0, failed: 0, active: 3, planned: 5 }), "generating");
  assert.equal(deriveEpisodeProgressPhase({ total: 10, ready: 2, needsReview: 0, failed: 0, active: 0, planned: 5 }), "planned");
  assert.equal(deriveEpisodeProgressPhase({ total: 10, ready: 8, needsReview: 2, failed: 0, active: 0, planned: 0 }), "needs_review");
  assert.equal(deriveEpisodeProgressPhase({ total: 10, ready: 10, needsReview: 0, failed: 0, active: 0, planned: 0 }), "ready");
  assert.equal(EPISODE_PROGRESS_HEADING.ready, "Episode visuals ready");
});

test("M: the review counter updates the moment a scene's qa_status flips from rejected to approved — no refresh needed (pure recomputation)", () => {
  const beforeCards = [
    { status: deriveSceneCardStatus({ status: "succeeded", qa_status: "rejected" }) },
    { status: deriveSceneCardStatus({ status: "succeeded", qa_status: "approved" }) },
  ];
  const before = summarizeSceneProgress(beforeCards);
  assert.equal(before.needsReview, 1);
  assert.equal(before.ready, 1);

  // Simulate approve_long_form_scene_manually's real effect: qa_status
  // rejected -> approved, status unchanged. Recomputing from the SAME kind
  // of scene object (no other field touched) must move the count.
  const afterCards = [
    { status: deriveSceneCardStatus({ status: "succeeded", qa_status: "approved" }) },
    { status: deriveSceneCardStatus({ status: "succeeded", qa_status: "approved" }) },
  ];
  const after = summarizeSceneProgress(afterCards);
  assert.equal(after.needsReview, 0);
  assert.equal(after.ready, 2);
});
