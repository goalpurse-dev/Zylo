// onScreenTextGuidance.js — 2026-10-02 "Production Setup redesign" pass,
// Section 11. On-screen text is a PRODUCTION PREFERENCE, not the video's
// core idea — kept inside Advanced Settings, never a primary early decision.
//
// This is guidance metadata only: the (not-yet-built) Beat Director is what
// will actually read a project's onScreenTextDensity (already persisted on
// long_form_projects via update-long-form-project) and apply this bias when
// choosing each beat's textIntent. Nothing here enforces anything yet — it
// is deliberately NOT "force text every N frames," per the explicit
// instruction; each option is described as a soft compositional bias.
// 2026-10-02 "Create New Video" UX rework — plain, human copy only (Section
// 8): no internal enum/token names (NO_TEXT, SHORT_TEXT_ALLOWED,
// PROGRAMMATIC_TEXT_REQUIRED) ever reach the user. Those remain the real
// internal values the future Beat Director will bias toward per option —
// just never rendered anywhere.
// Text upgrade: the Stickman text pass now reads it (headlines.ts TEXT_SHARE:
// minimal ~9%, balanced ~20%, frequent ~31% of scenes).
export const ON_SCREEN_TEXT_GUIDANCE = {
  minimal: {
    label: "Minimal",
    description: "Text on about 1 in 10 scenes.",
  },
  balanced: {
    label: "Balanced",
    description: "About 1 in 5 scenes: numbers, names and questions.",
  },
  frequent: {
    label: "Frequent",
    description: "About 1 in 3 scenes, with more labels and highlights.",
  },
};

export const DEFAULT_ON_SCREEN_TEXT_DENSITY = "balanced";
