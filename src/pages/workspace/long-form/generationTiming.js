// Honest elapsed/ETA support for the shared generation experience. No fake
// countdowns — see GenerationExperience.jsx. Ranges below are conservative
// defaults derived from REAL stage timings observed during this
// engagement's own controlled Research/Script/VisualPlan test runs
// (meta.timings on real research/script/visual-plan version rows), not
// guesses. As real production samples accumulate, replace
// STAGE_DURATION_MINUTES with a rolling median/p80 computed from
// meta.timings across recent versions — the shape here (a {low, high}
// minute range per stage) is deliberately already what that computation
// would produce, so swapping the data source later needs no UI change.
//
// Story Plan has no real telemetry from this engagement yet (that
// milestone predates the work this file's estimates are drawn from) — its
// range is a conservative placeholder, clearly called out below, not a
// measured value.
export const STAGE_DURATION_MINUTES = {
  story: {
    understanding_topic: { low: 0.3, high: 1 },
    narrative_strategy: { low: 0.3, high: 1 },
    structuring: { low: 0.2, high: 0.5 },
  },
  research: {
    // planningMs observed ~41-50s
    planning: { low: 0.7, high: 1.5 },
    // initialSearchMs observed ~108-158s across 3 concurrent-batch rounds
    initial_search: { low: 2, high: 4 },
    // extractionMs observed ~139s batched
    initial_extraction: { low: 1.5, high: 3 },
    // coverageMs observed ~40s
    coverage_review: { low: 0.5, high: 1.5 },
    // gapSearchMs observed ~113s — only occurs if the critic found real gaps
    gap_search: { low: 1.5, high: 3 },
    // finalExtractionMs observed ~68s
    final_extraction: { low: 1, high: 2 },
    // finalCoverageMs observed ~43s
    final_coverage_review: { low: 0.5, high: 1.5 },
    finalizing: { low: 0.05, high: 0.2 },
    // Targeted repair stages — observed repair_planning ~8s, repair_search
    // ~50-180s (1-4 targeted queries), repair_extraction+merge and
    // repair_coverage each broadly similar to their full-research
    // equivalents but on far less content.
    repair_planning: { low: 0.2, high: 0.5 },
    repair_search: { low: 1, high: 3 },
    repair_extraction: { low: 1, high: 2 },
    repair_coverage: { low: 0.5, high: 1.5 },
  },
  script: {
    // draft observed ~60-140s
    draft: { low: 1, high: 2.5 },
    // critic observed ~40-75s
    critic: { low: 0.7, high: 1.5 },
    // revision only runs when the critic asked for it
    revision: { low: 0.7, high: 1.5 },
    finalizing: { low: 0.05, high: 0.2 },
  },
  visualPlan: {
    // the one main call observed ~60-65s end to end
    planning: { low: 1, high: 2 },
    finalizing: { low: 0.05, high: 0.2 },
  },
};

// stageOrder: the FULL ordered list of stage keys this run could pass
// through (already filtered to what's actually relevant — e.g. gap stages
// only included once a run has actually reached them, same "never claim an
// optional stage will definitely occur" rule the checklist itself follows).
// currentStageKey: the real persisted current stage.
// Returns null if the personality/stage isn't recognized (caller should
// fall back to no ETA rather than guessing).
export function estimateRemainingMinutes(personality, stageOrder, currentStageKey) {
  const table = STAGE_DURATION_MINUTES[personality];
  if (!table) return null;
  const currentIndex = stageOrder.indexOf(currentStageKey);
  if (currentIndex === -1) return null;

  const remainingStages = stageOrder.slice(currentIndex);
  let low = 0;
  let high = 0;
  for (const stage of remainingStages) {
    const range = table[stage];
    if (!range) continue;
    low += range.low;
    high += range.high;
  }
  return { low: Math.round(low * 10) / 10, high: Math.round(high * 10) / 10 };
}

export function formatEtaRange({ low, high }) {
  const fmt = (n) => (n < 1 ? `${Math.round(n * 60)}s` : `${Math.round(n)} min`);
  if (low <= 0 && high <= 0) return null;
  return `~${fmt(low)}–${fmt(high)}`;
}

export function formatElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
