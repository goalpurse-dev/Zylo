// Phase 0, Section C — one shared source of truth for constants that were
// previously duplicated (and had drifted) across multiple files. Imported
// by BOTH edge functions and the frontend — Supabase edge functions in this
// repo already reach into src/lib directly (see generate-long-form-preview/
// index.ts importing queuePriority.ts, or generate-long-form-ideas
// importing longFormIdeaThumbnails.ts), so this is the one place these
// numbers live now, never re-declared at each call site.

// ============================================================================
// C.1 — words-per-minute. Previously three independent constants disagreed:
// 145 (frontend display estimate, lengthEstimates.js) vs 150 (the REAL
// generation target, duplicated in generate-long-form-story-plan/index.ts,
// advance-long-form-script/index.ts, and _shared/visualShotPlanning.js).
// 145 is now the one value everywhere — script targeting, the UI's "~N
// words" estimate, and the credit quote's word-count math all read this
// same constant, so they can never independently drift again.
// ============================================================================
export const WORDS_PER_MINUTE = 145;

// ============================================================================
// C.2 — beats (scenes) per minute for the Stickman recipe. Was ALSO
// duplicated: create-long-form-production-setup/index.ts's
// RECIPE_BEATS_PER_MINUTE map (used for the real credit quote) said 15,
// while lengthEstimates.js's SCENES_PER_MINUTE_ESTIMATE (the UI's "~N
// scenes" display) independently said 16.25 — a real production episode's
// actual rate is much closer to 15 than 16.25 (see the backend audit's
// §5/§11). The UI now reads this same map instead of its own guess.
// ============================================================================
export const RECIPE_BEATS_PER_MINUTE: Record<string, number> = {
  STICKMAN_DOODLE_EXPLAINER_V1: 15,
};

// ============================================================================
// C.3 — gpt-5-mini per-token pricing. Was duplicated verbatim across 7
// files (advance-long-form-research, advance-long-form-script,
// advance-long-form-visual-plan, advance-long-form-visual-world,
// repair-long-form-visual-plan-focal-subjects,
// repair-long-form-visual-plan-semantic-bindings,
// _shared/narrationVisualContract.ts) — one file's own comment already
// admitted this. One constant now, imported everywhere.
// ============================================================================
export const GPT5_MINI_INPUT_PER_M = 0.25;
export const GPT5_MINI_OUTPUT_PER_M = 2.0;

// ============================================================================
// C.5 — gpt-4o-mini vision QA calls (sceneQA.ts, referenceQA.ts) had NO cost
// constant at all — every other LLM call in this pipeline records an
// internal_cost_usd, QA calls silently didn't. Real OpenAI gpt-4o-mini
// pricing (per million tokens, disclosed estimate — QA calls don't log
// their own token usage today, so this is applied as a flat per-call
// estimate at a conservative ~600 input + ~150 output tokens per call,
// consistent with the low-detail image + short structured-output shape
// every QA prompt in this codebase uses).
// ============================================================================
export const GPT4O_MINI_INPUT_PER_M = 0.15;
export const GPT4O_MINI_OUTPUT_PER_M = 0.6;
export const QA_CALL_ESTIMATED_INPUT_TOKENS = 600;
export const QA_CALL_ESTIMATED_OUTPUT_TOKENS = 150;
export const QA_CALL_ESTIMATED_COST_USD = Number(
  ((QA_CALL_ESTIMATED_INPUT_TOKENS / 1_000_000) * GPT4O_MINI_INPUT_PER_M + (QA_CALL_ESTIMATED_OUTPUT_TOKENS / 1_000_000) * GPT4O_MINI_OUTPUT_PER_M).toFixed(6)
);
