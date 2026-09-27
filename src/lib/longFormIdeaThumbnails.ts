// Shared config + deterministic prompt assembly for Long Form's "idea
// thumbnails" feature (ProductionSetup.jsx's ideas grid). Imported by BOTH
// the client (ProductionSetup.jsx, for display/pricing copy) and the two
// edge functions that generate ideas/thumbnails — Supabase edge functions in
// this repo already reach into src/lib directly (see
// generate-long-form-preview/index.ts importing queuePriority.ts), so this
// is the one place the price/model/mode live, never duplicated.

// Final-polish round 4, Section 4, COST — kept as named config per the
// explicit instruction, not inlined as magic numbers at each call site.
export const FIRST_IDEA_BATCH_IS_FREE = true;
export const REGENERATE_IDEAS_COST = 2; // credits — regenerates ideas text AND their thumbnails together
export const REFRESH_THUMBNAILS_COST = 2; // credits — thumbnails only, when the style changed since the ideas were generated

// Flux 9B (FLUX.2 [klein] 9B KV) — see src/lib/providers.ts's
// "image:flux2.klein9bkv" entry for the verified airTag/cost. Kept as one
// named constant (not hardcoded at each call site) so the model can be
// swapped later without touching prompt/job-submission code.
export const THUMBNAIL_IMAGE_TOOL_KEY = "image:flux2.klein9bkv";
export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;

// IN_IMAGE: Flux draws the headline text itself (unreliable spelling on
// smaller/faster models — see the report's test-batch results).
// OVERLAY: Flux draws only the scene with the top third left as plain flat
// background; the headline is rendered in code on top of the image
// (ProductionSetup.jsx's ThumbnailHeadlineOverlay), guaranteeing correct
// spelling. Default per the product decision pending the test-batch result.
export const THUMBNAIL_HEADLINE_MODE = "OVERLAY"; // "IN_IMAGE" | "OVERLAY"

// Per-style thumbnail prompt header. Only classic_flat_stickman is
// production-ready today (see visualStyles.js's isStyleSelectable) — every
// other style is null here too, matching that file's own
// visualRecipe/recipeVersion: null pattern for "coming soon" styles, so
// there's nothing for a not-yet-implemented style to silently fall back to.
export const STYLE_THUMBNAIL_HEADERS: Record<string, string> = {
  classic_flat_stickman:
    "YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9. Bold, simple, and very high contrast so it reads instantly at 120 pixels wide. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing as simple flat color shapes. Thumbnail faces are exaggerated for impact: large round white eyes with black pupils, thick strongly angled eyebrows, and a big expressive mouth — the emotion must be extreme and readable at tiny size.",
};

export interface ThumbnailConcept {
  headline: string;
  scene: string;
}

// The ONE place the final Runware prompt is assembled — always from a fixed
// per-style header + the LLM-written concept + these fixed text rules. The
// LLM never sees or writes the style block; this function is the only
// caller that may combine them, so the two can never drift or leak into
// each other. Returns null when the style has no header yet (not
// production-ready) — callers must treat that as "can't generate", not
// silently fall back to a different style's look.
export function buildThumbnailPrompt(
  styleId: string,
  concept: ThumbnailConcept,
  mode: string = THUMBNAIL_HEADLINE_MODE
): string | null {
  const header = STYLE_THUMBNAIL_HEADERS[styleId];
  if (!header) return null;
  const scene = (concept?.scene ?? "").trim();
  const headline = (concept?.headline ?? "").trim();

  if (mode === "IN_IMAGE") {
    return [
      header,
      `Scene: ${scene}`,
      `Bold text in the top third reading exactly "${headline}", in heavy bold rounded all-caps yellow letters with a thick black outline. No other text anywhere in the image.`,
      "Flat 2-3 tone background. No boxes, panels, frames, or blank rectangles.",
    ].join(" ");
  }

  // OVERLAY — no text drawn by the model at all; the top third is kept
  // plain so code-rendered text (ThumbnailHeadlineOverlay) reads cleanly
  // over it once composited in the browser.
  return [
    header,
    `Scene: ${scene}`,
    "No text, letters, words, or numbers anywhere in the image. Keep the top third of the frame as plain, uncluttered flat background — no characters, objects, or fine detail up there — it stays empty for text to be added afterward.",
    "Flat 2-3 tone background. No boxes, panels, frames, or blank rectangles.",
  ].join(" ");
}
