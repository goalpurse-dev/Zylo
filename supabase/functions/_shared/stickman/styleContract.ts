// deno-lint-ignore-file no-explicit-any
// stickman/styleContract.ts — 2026-10-02 "Production Bible" pass, Section 4.
//
// THE RECIPE LAYER. Universal grammar for STICKMAN_DOODLE_EXPLAINER_V1 —
// identical for every project that selects this recipe, never episode data.
// A code constant, exactly parallel to visualWorldStyle.ts's STYLE_PRESETS
// map (a StylePreset there is also a static, versioned code object, not a
// DB row) — the same insertion point compileScenePrompt already uses for
// the documentary path's [STYLE LOCK] block is where this recipe's own
// compiled header will eventually go (future compiler work, not this pass).
//
// This file answers ONLY "what never changes across every Stickman video."
// "What changes per video" (palette, hero, world, props...) is the
// Production Bible's job (productionBible.ts) — see that file's own header
// comment for why the split exists and how the two combine.

export type StyleTraits = {
  medium: string;
  illustrationStyle: string;
  lineLanguage: string;
  shapeLanguage: string;
  detailLevel: string;
  shadingPolicy: string;
  texturePolicy: string;
  dimensionality: string;
  realismLevel: string;
  backgroundStrategy: string;
  forbiddenStyleTraits: string[];
};

export type GraphicGrammar = {
  backgroundBehavior: string;
  lineStyle: string;
  arrowsConnectors: string;
  characterUseInsideGraphics: string; // explicit: characters/objects/maps ARE allowed inside a graphic — a graphic is never defined as "text card"
  whitespaceBehavior: string;
};

export type CameraGrammar = {
  allowedShotFamilies: string[];
  simplicityReadabilityRules: string;
};

export type TextPolicyDefaults = {
  providerGeneratedTextDefault: "OFF";
  exactTextHandledDownstream: true;
  exceptionsPolicy: string;
};

export type StickmanRecipeStyleContract = {
  recipeId: "stickman_doodle_explainer";
  recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1";
  styleTraits: StyleTraits;
  graphicGrammar: GraphicGrammar;
  cameraGrammar: CameraGrammar;
  textPolicyDefaults: TextPolicyDefaults;
  universalForbiddenOutcomes: string[]; // recipe-derived negative constraints, never episode-specific
};

export const STICKMAN_DOODLE_EXPLAINER_V1: StickmanRecipeStyleContract = {
  recipeId: "stickman_doodle_explainer",
  recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
  styleTraits: {
    medium: "Flat-color 2D doodle/stickman illustration",
    illustrationStyle: "Simplified stickman/doodle explainer construction — circle heads, dot eyes, stick limbs, mitten hands — never a detailed or semi-realistic character",
    lineLanguage: "Uniform thin, clean black outlines of identical weight everywhere; no sketchiness, no variable line weight, no cross-hatching",
    shapeLanguage: "Simple geometric primitives — circles, rounded rectangles, straight or gently curved lines — never intricate or organic detail",
    detailLevel: "Minimal — enough to read instantly at a glance, never busy or cluttered",
    shadingPolicy: "None — flat solid fills only, no gradients, no soft shadow rendering, no highlights",
    texturePolicy: "None — flat, texture-free surfaces throughout",
    dimensionality: "2D flat, no 3D rendering, no depth shading, no perspective distortion beyond simple flat-layer staging",
    realismLevel: "Non-realistic, iconographic — identity is carried by a handful of discrete flat features, never facial realism",
    backgroundStrategy: "2-3 flat color layers (background/midground/foreground), never a fully rendered or photographic environment",
    forbiddenStyleTraits: [
      "photorealistic or photographic rendering",
      "3D render or CGI look",
      "painterly or watercolor texture",
      "anime or manga stylization",
      "pencil-sketch or hand-drawn sketchiness",
      "cel-shading with rendered shadows",
      "gradient mesh or airbrushed shading",
      "drop shadows or glow/bloom effects",
      "realistic anatomy, fingers, or necks on stickman characters",
    ],
  },
  graphicGrammar: {
    backgroundBehavior: "Clean, uncluttered flat backgrounds (often light/white or the episode's own environment palette) — never assumed to be white-only; the Production Bible's graphic language decides per episode",
    lineStyle: "The exact same line weight and fill language as narrative scenes — a graphic must never look like a different visual universe from the story frames around it",
    arrowsConnectors: "Simple flat-filled arrow shapes and thin connector lines, same line language as everything else",
    characterUseInsideGraphics: "Stickman characters, objects, and simplified environments are explicitly ALLOWED and encouraged inside a graphic when they clarify the point — a graphic is a composition family, never a text-only template",
    whitespaceBehavior: "Generous but not empty — whitespace isolates the one idea a graphic communicates, it is never filler",
  },
  cameraGrammar: {
    allowedShotFamilies: ["WIDE", "MEDIUM", "CLOSE_UP", "OVERHEAD", "POV", "SPLIT_SCREEN", "CUTAWAY", "DIAGRAM_LAYOUT"],
    simplicityReadabilityRules: "Every frame must read clearly at thumbnail size — avoid busy multi-subject compositions unless the beat's own visual concept specifically requires comparing multiple subjects at once",
  },
  textPolicyDefaults: {
    providerGeneratedTextDefault: "OFF",
    exactTextHandledDownstream: true,
    exceptionsPolicy: "A short (<=5 word) exact phrase may be requested directly of the image model only when it is naturally part of the drawn artwork itself (e.g. a sign, a clock face) AND the configured renderer has demonstrated adequate text fidelity for this recipe — otherwise all text is composited as a deterministic overlay after the base image.",
  },
  universalForbiddenOutcomes: [
    "accidental 3D render or CGI look",
    "photorealistic drift away from flat 2D",
    "painterly, sketchy, or textured drift away from flat solid fills",
    "random or unrequested generated typography",
    "stickman construction mutating into a more detailed/realistic character mid-episode",
    "shading, gradients, or texture appearing despite the flat-fill policy",
  ],
};

export function getStickmanRecipeStyleContract(recipeVersion: string): StickmanRecipeStyleContract {
  if (recipeVersion !== STICKMAN_DOODLE_EXPLAINER_V1.recipeVersion) {
    throw new Error(`UNKNOWN_STICKMAN_RECIPE_VERSION: ${recipeVersion}`);
  }
  return STICKMAN_DOODLE_EXPLAINER_V1;
}
