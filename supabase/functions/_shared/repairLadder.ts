// deno-lint-ignore-file no-explicit-any
// repairLadder.ts — 2026-09-18 "production visual reliability v2" pass,
// Section 20. Real gap this closes (flagged twice in prior audits and never
// wired): sceneQA.ts's classifySceneQA has produced a real `failureType` +
// `repairStrategy` STRING since the very first QA-calibration pass, but
// nothing in the pipeline has ever consumed it to decide (a) what kind of
// repair a failure actually calls for, or (b) whether that repair costs the
// user anything. This module is that missing decision layer — a pure,
// deterministic function from failureType to a typed repair action, never
// a dispatcher itself (it does not call retry_long_form_scene or any
// provider; the caller decides whether/when to act on the decision).
//
// Kept OUT of scope deliberately (see the final report): actually
// AUTO-TRIGGERING a repair (calling GENERATE for real) is a real-spend
// action this pass's constraints (no provider calls, no credit charges)
// correctly forbid exercising live — this module makes the decision
// auditable and testable now; wiring an automatic trigger is real, future,
// separately-billed work.

export type RepairAction =
  | "LOCAL_DETERMINISTIC_CORRECTION" // e.g. re-crop/re-normalize onto the canonical 16:9 canvas from already-downloaded pixels — no provider call
  | "FRESH_GENERATE" // a real new provider call, billable at the tier's GENERATE price
  | "RETRY_LOCAL_EDIT_ONCE" // one more provider EDIT attempt, billable at the tier's EDIT price — only for a plausibly-stochastic miss
  | "DETERMINISTIC_OVERLAY" // composite the exact text/label deterministically — no provider call
  | "RECOMPILE_GRAPHIC" // recompile GraphicSpec / pick a new template or variant — no provider call
  | "NONE"; // no defined automatic repair; needs a human or a full replan

export type RepairDecision = { action: RepairAction; billable: boolean; providerCallRequired: boolean; reason: string };

// The ladder itself — Section 20's own ordering, made explicit and
// testable. Falls through to NONE for any failureType this table doesn't
// name (never guesses an action for an unrecognized failure).
const LADDER: Record<string, RepairDecision> = {
  INVALID_FINAL_FRAME_GEOMETRY: { action: "LOCAL_DETERMINISTIC_CORRECTION", billable: false, providerCallRequired: false, reason: "a geometry violation (portrait/wrong aspect/subject cropped out) is corrected deterministically from the existing pixels first; only escalates to FRESH_GENERATE if that's not possible" },
  REFERENCE_LEAKAGE: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "reference/multi-panel leakage requires a genuinely new composition with safer reference routing — no deterministic fix exists for pixels a model already rendered" },
  UNAUTHORIZED_MULTI_PANEL: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "an unauthorized split/collage composition requires a fresh, safer-referenced generation" },
  IDENTITY_DRIFT: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "character/location identity drift or cloning requires a fresh generation with corrected cast references" },
  CHARACTER_CLONE: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "distinct required roles collapsed onto one identity — needs a fresh generation once separate references exist" },
  // 2026-09-22 "FINAL stabilization pass" §2/§19 — the inverse defect from
  // CHARACTER_CLONE (one required character duplicated into multiple
  // instances, e.g. real Atlantis finding: "two Platos"). Needs a fresh
  // generation with an explicit single-instance identity anchor and count
  // constraint (episodePreflight.ts's compiled identity block already adds
  // this instruction going forward) — never a deterministic local fix.
  CHARACTER_DUPLICATION: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a required character rendered as multiple instances needs a fresh generation with an explicit single-instance identity anchor and count constraint" },
  CRITICAL_TEXT: { action: "DETERMINISTIC_OVERLAY", billable: false, providerCallRequired: false, reason: "important text belongs to the deterministic overlay layer, never another image-model attempt at rendering words" },
  GRAPHIC_RENDER_DEFECT: { action: "RECOMPILE_GRAPHIC", billable: false, providerCallRequired: false, reason: "a deterministic graphic's own layout/occupancy failure is fixed by recompiling the spec (new template/variant), never a paid re-render" },
  GRAPHIC_REPLAN_REQUIRED: { action: "RECOMPILE_GRAPHIC", billable: false, providerCallRequired: false, reason: "no safe template could represent this claim — needs a semantic replan, still zero provider cost" },
  LOW_DIVERSITY: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a near-duplicate where a real visual delta was required needs a fresh composition, not another edit of the same source" },
  REQUIRED_SUBJECT_MISSING: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a missing required subject/object needs a fresh composition using the corrected contract" },
  ACTION_OR_OBJECT_MISSING: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a missing essential action/object needs a fresh composition" },
  SEMANTIC_CONTRADICTION: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a reversed-polarity result needs a fresh composition using the corrected contract" },
  FORBIDDEN_ENTITY_PRESENT: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a forbidden entity visibly present needs a fresh composition" },
  SEVERE_CORRUPTION: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "severe corruption/anatomy artifacts need a fresh composition, never a repair edit on broken pixels" },
  STYLE_ABANDONED: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a major style mismatch needs a fresh composition" },
  SEVERE_BLUR: { action: "FRESH_GENERATE", billable: true, providerCallRequired: true, reason: "a severely degraded EDIT should re-anchor to its canonical root with a fresh composition, not another edit of an already-soft source" },
  EDIT_DELTA_NOT_DELIVERED: { action: "RETRY_LOCAL_EDIT_ONCE", billable: true, providerCallRequired: true, reason: "the requested local delta wasn't visibly delivered — one retry is reasonable if plausibly stochastic; a second miss escalates to FRESH_GENERATE (see maxEditRetries in the edit contract)" },
};

export function determineRepairAction(failureType: string | null | undefined): RepairDecision {
  if (!failureType) return { action: "NONE", billable: false, providerCallRequired: false, reason: "no failure recorded" };
  return LADDER[failureType] ?? { action: "NONE", billable: false, providerCallRequired: false, reason: `no repair rule defined for failureType "${failureType}" — needs a human/replan, never a guessed automatic action` };
}

// Section 20's own explicit rule: "do not charge a user again for a
// deterministic 0-provider-cost rerender." A billing layer can call this
// directly rather than re-deriving billable-ness from the action enum.
export function repairIsBillable(failureType: string | null | undefined): boolean {
  return determineRepairAction(failureType).billable;
}
