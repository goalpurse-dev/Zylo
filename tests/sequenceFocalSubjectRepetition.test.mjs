import test from "node:test";
import assert from "node:assert/strict";
import { runEpisodeQA } from "../supabase/functions/_shared/episodeQA.ts";

// 2026-09-22 "FINAL stabilization pass" §5 — real Atlantis finding: 7
// consecutive shots each independently GENERATEd under a DIFFERENT
// baseSetupKey (the freshness engine already forced fresh compositions, so
// the existing REPEATED_SETUP_RUN check never fired) still all resolved
// composition.focalSubject="Pillars of Heracles" despite covering
// materially different narration moments (textual landmarks, destruction
// by earthquake, "9,000 years" chronology, ambiguity, translators, etc.) —
// seven variations of two towers. New FOCAL_SUBJECT_REPETITION check closes
// this gap, deliberately independent of baseSetupKey.

function scene(overrides) {
  return { id: "s", sequenceIndex: 1, renderStrategy: "GENERATE", baseSetupKey: null, resultUrl: "https://x/a.png", status: "succeeded", focalSubject: null, ...overrides };
}

test("§5: 4+ consecutive shots sharing one focalSubject, even under DIFFERENT baseSetupKeys, are flagged FOCAL_SUBJECT_REPETITION", () => {
  const scenes = Array.from({ length: 7 }, (_, i) => scene({ id: `s${i}`, sequenceIndex: i + 1, baseSetupKey: `unique_setup_${i}`, focalSubject: "Pillars of Heracles" }));
  const warnings = runEpisodeQA(scenes);
  const w = warnings.find((x) => x.code === "FOCAL_SUBJECT_REPETITION");
  assert.ok(w, "expected a FOCAL_SUBJECT_REPETITION warning");
  assert.deepEqual(w.affectedSceneIds, scenes.map((s) => s.id));
  assert.match(w.message, /Pillars of Heracles/);
});

test("§5: a genuinely varied sequence (different focalSubject every shot) is never flagged", () => {
  const scenes = Array.from({ length: 7 }, (_, i) => scene({ id: `s${i}`, sequenceIndex: i + 1, baseSetupKey: `setup_${i}`, focalSubject: `Subject ${i}` }));
  const warnings = runEpisodeQA(scenes);
  assert.equal(warnings.some((w) => w.code === "FOCAL_SUBJECT_REPETITION"), false);
});

test("§5: fewer than the threshold (3) consecutive repeats is not flagged — only a genuinely long run is", () => {
  const scenes = [
    scene({ id: "s1", sequenceIndex: 1, baseSetupKey: "a", focalSubject: "Same Subject" }),
    scene({ id: "s2", sequenceIndex: 2, baseSetupKey: "b", focalSubject: "Same Subject" }),
    scene({ id: "s3", sequenceIndex: 3, baseSetupKey: "c", focalSubject: "Same Subject" }),
    scene({ id: "s4", sequenceIndex: 4, baseSetupKey: "d", focalSubject: "Different Subject" }),
  ];
  const warnings = runEpisodeQA(scenes);
  assert.equal(warnings.some((w) => w.code === "FOCAL_SUBJECT_REPETITION"), false);
});

test("§5: scenes with no focalSubject at all (legacy/unset) never trigger a false-positive repetition warning", () => {
  const scenes = Array.from({ length: 6 }, (_, i) => scene({ id: `s${i}`, sequenceIndex: i + 1, baseSetupKey: `setup_${i}`, focalSubject: null }));
  const warnings = runEpisodeQA(scenes);
  assert.equal(warnings.some((w) => w.code === "FOCAL_SUBJECT_REPETITION"), false);
});

test("§5: same focalSubject is flagged regardless of sceneType — a differing pre-compile sceneType is NOT trusted as proof of real visual variety (kept in sync with visualPlanFocalSubjectRepair.ts's identical reasoning: it can still compile down to a plain GENERATE illustration — see §7)", () => {
  const scenes = [
    scene({ id: "s0", sequenceIndex: 1, focalSubject: "Same Subject", sceneType: "CHARACTER_MOMENT" }),
    scene({ id: "s1", sequenceIndex: 2, focalSubject: "Same Subject", sceneType: "DIAGRAM" }),
    scene({ id: "s2", sequenceIndex: 3, focalSubject: "Same Subject", sceneType: "DETAIL_INSERT" }),
    scene({ id: "s3", sequenceIndex: 4, focalSubject: "Same Subject", sceneType: "ENVIRONMENT_ESTABLISHER" }),
  ];
  const warnings = runEpisodeQA(scenes);
  assert.equal(warnings.some((w) => w.code === "FOCAL_SUBJECT_REPETITION"), true, "subject repetition is flagged even though sceneType varies per shot");
});

test("§5: is entirely independent of the existing REPEATED_SETUP_RUN check — both can fire together when both conditions genuinely hold, neither suppresses the other", () => {
  const scenes = Array.from({ length: 6 }, (_, i) => scene({ id: `s${i}`, sequenceIndex: i + 1, baseSetupKey: "same_setup", focalSubject: "Same Subject" }));
  const warnings = runEpisodeQA(scenes);
  assert.ok(warnings.some((w) => w.code === "REPEATED_SETUP_RUN"));
  assert.ok(warnings.some((w) => w.code === "FOCAL_SUBJECT_REPETITION"));
});
