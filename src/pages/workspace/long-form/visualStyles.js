// visualStyles.js — 2026-10-02 "Production Setup redesign" pass, Section 6/7.
//
// These are NOT merely frontend labels. Each style is a stable, machine-
// readable style/recipe variant id. Only `classic_flat_stickman` currently
// has a real, implemented Style Contract (styleContract.ts's
// STICKMAN_DOODLE_EXPLAINER_V1) — its visualRecipe/recipeVersion pair is
// what actually gets frozen onto the Production Profile. Every other style
// is `productionReady: false` ("Coming soon") and carries NO visualRecipe/
// recipeVersion at all — there is nothing for the UI to accidentally select
// and silently fall back to Classic Stickman, because selection of a
// non-production-ready style is disabled entirely (see ProductionSetup.jsx).
//
// previewAssetUrl points at /images/styles/<slug>.webp — the same static
// product-asset convention the existing Image Generator style picker already
// uses (see public/images/styles/cinematic.webp, dynamic.webp). The actual
// bytes at these 10 paths are real, permanently-generated Nano Banana 2 (1K,
// 16:9) art (originally produced by scripts/generateStylePreviewAssets.mjs,
// converted from PNG to webp and vendored into public/images/styles/ — see
// the deliverable report for the full slug list). All 10 share the exact
// same canonical scene (a person pointing at a diagram icon beside a
// campfire) so the visual difference is STYLE, not subject. Never
// regenerated per user — a missing/broken file here falls back to a plain
// placeholder tile in the UI (see ProductionSetup.jsx's ImageWithFallback).
const PREVIEW_BASE = "/images/styles";

export const VISUAL_STYLES = [
  {
    id: "classic_flat_stickman",
    label: "Classic Flat Stickman",
    summary: "Flat-color 2D stickman explainer — circle heads, dot eyes, stick limbs, uniform outlines, flat fills, no shading.",
    productionReady: true,
    visualRecipe: "stickman_doodle_explainer",
    recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
    previewAssetUrl: `${PREVIEW_BASE}/classic_flat_stickman.webp`,
  },
  {
    id: "crude_paint_doodle",
    label: "Crude Paint Doodle",
    summary: "Crude basic-paint-program doodle, intentionally uneven mouse-drawn outlines, rough bucket fills, amateur comedy aesthetic.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/crude_paint_doodle.webp`,
  },
  {
    id: "whiteboard_marker",
    label: "Whiteboard Marker",
    summary: "Clean white background, black marker illustrations, sparse red/blue accents, hand-drawn educational diagram aesthetic.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/whiteboard_marker.webp`,
  },
  {
    id: "chalkboard",
    label: "Chalkboard",
    summary: "Dark green/black board, white/pastel chalk illustration, slight chalk grain.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/chalkboard.webp`,
  },
  {
    id: "paper_cutout",
    label: "Paper Cut-Out",
    summary: "Layered construction-paper shapes, clean cut/torn edges, subtle paper texture, handmade layered depth.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/paper_cutout.webp`,
  },
  {
    id: "silhouette_accent",
    label: "Silhouette Accent",
    summary: "Black simplified silhouettes, flat two-tone environment, one strong accent color.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/silhouette_accent.webp`,
  },
  {
    id: "vintage_parchment_ink",
    label: "Vintage Parchment & Ink",
    summary: "Warm aged parchment, simple brown ink linework, muted flat washes, historical map/journal language.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/vintage_parchment_ink.webp`,
  },
  {
    id: "bold_flat_vector",
    label: "Bold Flat Vector",
    summary: "Rounded geometric shapes, no outlines, vibrant flat color blocks, no gradients.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/bold_flat_vector.webp`,
  },
  {
    id: "comic_doodle",
    label: "Comic Doodle",
    summary: "Bold expressive simplified ink outlines, flat colors, dynamic pose/action lines.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/comic_doodle.webp`,
  },
  {
    id: "blueprint_schematic",
    label: "Blueprint / Technical Schematic",
    summary: "Flat blue technical background, thin white schematic lines, cutaway/diagram elements.",
    productionReady: false,
    visualRecipe: null,
    recipeVersion: null,
    previewAssetUrl: `${PREVIEW_BASE}/blueprint_schematic.webp`,
  },
];

export const DEFAULT_VISUAL_STYLE_ID = "classic_flat_stickman";

export function getVisualStyle(id) {
  return VISUAL_STYLES.find((s) => s.id === id) ?? VISUAL_STYLES.find((s) => s.id === DEFAULT_VISUAL_STYLE_ID);
}

export function isStyleSelectable(style) {
  return Boolean(style?.productionReady && style?.visualRecipe && style?.recipeVersion);
}
