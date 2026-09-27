// Frontend mirror of supabase/functions/_shared/visualWorldStyle.ts's
// STYLE_PRESETS — same ids, names, versions, and descriptive fields. Deno
// edge functions and this Vite browser bundle can't literally share one
// module, so this is a deliberate, labeled copy of the display-relevant
// subset (not a second/different styling system) for the Look page's Style
// Picker UI. Keep both files in sync when a preset is added or edited.
//
// `sketchTheme` is frontend-only — it drives the zero-cost, schematic
// Director Storyboard sketches (StoryboardSketch.jsx) so a style choice
// gives instant visual feedback before any real image is ever generated.
// It intentionally does NOT try to simulate real generated artwork — only
// palette, stroke weight, and paper/background treatment shift; the sketch
// stays schematic either way.
//
// `previewAsset` — the curated, static, one-time-generated card image (Part
// 5: never generated per-request). Real assets now exist for all 6 launch
// presets (Nano Banana 2, 2K, see STYLE_PREVIEW_PROMPTS.md for the exact
// prompt used per style) — imported as local files so Vite fingerprints/
// hashes them like any other build asset.

import classic2dDocumentary from "../../../assets/longform/classic-2d-documentary.png";
import simpleStoryCartoon from "../../../assets/longform/simple-story-cartoon.png";
import brightModernCartoon from "../../../assets/longform/bright-modern-cartoon.png";
import memeDocumentary from "../../../assets/longform/meme-documentary.png";
import illustratedHistory from "../../../assets/longform/illustrated-history.png";
import documentaryCollage from "../../../assets/longform/documentary-collage.png";

export const STYLE_PRESETS = [
  {
    id: "bold_cartoon_documentary",
    version: 1,
    name: "Classic 2D Documentary",
    descriptors: ["Clear", "Expressive", "Bold"],
    bestFor: ["History", "Survival", "Engineering", "Culture"],
    summary: "Thick confident outlines, rounded cartoon forms, restrained flat shading. The versatile documentary default.",
    isDefault: true,
    previewAsset: classic2dDocumentary,
    sketchTheme: { paper: "#e7e7d6", structureFill: "#dce0ca", structureStroke: "#8a9980", strokeWidth: 3, person: "#526a60", personStroke: "#344e43", device: "#455f54", accent: "#a38745", cornerStyle: "soft" },
  },
  {
    id: "simple_outline_explainer",
    version: 1,
    name: "Simple Story Cartoon",
    descriptors: ["Minimal", "Readable", "Fast"],
    bestFor: ["History", "Economics", "Survival", "Educational"],
    summary: "Thin-to-medium outlines, minimal anatomy, flat color, minimal shading — extremely readable and consistent.",
    isDefault: false,
    previewAsset: simpleStoryCartoon,
    sketchTheme: { paper: "#f0f1e8", structureFill: "#e6e9d8", structureStroke: "#b7c0a5", strokeWidth: 1.5, person: "#7c9184", personStroke: "#5c7267", device: "#8a9a80", accent: "#9aa885", cornerStyle: "sharp" },
  },
  {
    id: "polished_vector_cartoon",
    version: 1,
    name: "Bright Modern Cartoon",
    descriptors: ["Bright", "Polished", "Commercial"],
    bestFor: ["Science", "Technology", "High-curiosity explainers"],
    summary: "Clean geometric forms, bold saturated colors, smooth controlled shading — a polished YouTube-explainer feel.",
    isDefault: false,
    previewAsset: brightModernCartoon,
    sketchTheme: { paper: "#eef6ff", structureFill: "#d6ecff", structureStroke: "#5aa9e6", strokeWidth: 2.5, person: "#3b82c4", personStroke: "#2a5f92", device: "#4a90d9", accent: "#f5a623", cornerStyle: "round" },
  },
  {
    id: "wojak_documentary_hybrid",
    version: 1,
    name: "Meme Documentary",
    descriptors: ["Iconic", "Simple", "Contrast"],
    bestFor: ["Economics", "Internet culture", "Finance"],
    summary: "A deliberately simple recurring character against richer environments — strong subject/background contrast.",
    isDefault: false,
    previewAsset: memeDocumentary,
    sketchTheme: { paper: "#e9e5da", structureFill: "#d8cdb6", structureStroke: "#6b6255", strokeWidth: 2, person: "#c9b896", personStroke: "#3a352c", device: "#8f8470", accent: "#b5502f", cornerStyle: "sharp" },
  },
  {
    id: "painterly_storybook_documentary",
    version: 1,
    name: "Illustrated History",
    descriptors: ["Painterly", "Warm", "Cinematic"],
    bestFor: ["History", "Mythology", "Biographies", "Folklore"],
    summary: "Textured brushwork, richer lighting, semi-realistic anatomy, and a warm cinematic palette. A premium visual language.",
    isDefault: false,
    previewAsset: illustratedHistory,
    sketchTheme: { paper: "#efe1c8", structureFill: "#e2c9a0", structureStroke: "#8a6b3f", strokeWidth: 2.5, person: "#a3703f", personStroke: "#5c3e1f", device: "#8f6f43", accent: "#c98a3e", cornerStyle: "soft" },
  },
  {
    id: "documentary_collage",
    version: 1,
    name: "Documentary Collage",
    descriptors: ["Layered", "Editorial", "Assembled"],
    bestFor: ["Business", "Investigations", "Scandals", "Timelines"],
    summary: "Paper cutout shapes, layered maps and documents, subtle shadows — an intentionally assembled documentary look.",
    isDefault: false,
    previewAsset: documentaryCollage,
    sketchTheme: { paper: "#e4ddce", structureFill: "#cfc4a8", structureStroke: "#5f584a", strokeWidth: 2, person: "#8f8266", personStroke: "#3f3a2e", device: "#a89b7c", accent: "#7a6a4a", cornerStyle: "sharp" },
  },
];

export const DEFAULT_STYLE_PRESET_ID = "bold_cartoon_documentary";

export function getStylePreset(id) {
  return STYLE_PRESETS.find((s) => s.id === id) ?? STYLE_PRESETS.find((s) => s.id === DEFAULT_STYLE_PRESET_ID);
}

// The versioned id string persisted on the project row (e.g.
// "bold_cartoon_documentary:v1") — see PART 19 of the Style Picker
// milestone: presets are versioned so a future prompt-quality edit (v2)
// never silently changes what an existing project's Visual World was
// actually built from.
export function toVersionedId(preset) {
  return `${preset.id}:v${preset.version}`;
}
export function parseVersionedId(versionedId) {
  const [id, versionPart] = String(versionedId ?? "").split(":v");
  return { id, version: Number(versionPart) || 1 };
}
