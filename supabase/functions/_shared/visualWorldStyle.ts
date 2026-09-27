import { compileIsolatedSheetEdit } from "./characterSheetContract.js";
// deno-lint-ignore-file no-explicit-any
// Shared between advance-long-form-visual-world and (later) scene
// generation — the StyleBible preset registry (Part 6 of the Style Picker
// milestone), the deterministic reference-view rules that don't need an LLM
// to decide, and the deterministic prompt compiler. None of this calls
// OpenAI — the Reference Planner's own LLM call (in
// advance-long-form-visual-world) supplies only the two things code
// genuinely cannot derive: canonical appearance identity and
// factual/forbidden constraints per entity.
//
// V1 shipped with exactly one hardcoded style ("Zyvo Illustrated
// Documentary"). The Style Picker milestone turns that into a real,
// user-selectable registry — STYLE_PRESETS below — without touching
// anything downstream: compileReferencePrompt already took `styleSpec` as a
// parameter, so it works unchanged with whichever preset the caller passes.
// ZYVO_STYLE_SPEC is kept as a compatibility alias to the same object it
// always pointed at (bold_cartoon_documentary, the new default) so any
// existing caller that hasn't been updated to read the project's actual
// selected style keeps working byte-for-byte as before.
//
// Frontend mirror: src/pages/workspace/long-form/stylePresets.js carries the
// same ids/names/fields for the Look-page picker UI — Deno edge functions
// and the Vite browser bundle can't literally share one module, so that
// file is a deliberate, clearly-labeled copy of the display-relevant
// subset, not a second/different styling system. Keep both in sync.

// 2026-09-22 "FINAL stabilization pass" §12 — real Atlantis finding:
// programmatic graphics (PROGRAMMATIC_GRAPHIC cards and the deterministic
// exact-text overlay chip) always drew from ONE fixed light/dark palette
// (graphicTemplates.ts's own hardcoded PALETTES) — a generic black-
// rectangle-white-text look completely detached from whichever art style
// the episode actually selected. graphicPalette is the concrete color
// tokens the graphics-layer renderer needs (background/ink/accent/etc.),
// hand-derived from each preset's own described palette/mood so every
// preset's graphics genuinely look like part of that preset's visual
// system rather than a generic subtitle/debug UI.
export type GraphicPalette = { bg: [number, number, number]; ink: [number, number, number]; muted: [number, number, number]; positive: [number, number, number]; negative: [number, number, number]; accent: [number, number, number]; track: [number, number, number] };

export type StylePreset = {
  id: string;
  version: number;
  name: string;
  summary: string;
  bestFor: string[];
  linework: string;
  shading: string;
  texture: string;
  palette: string;
  faceConstruction: string;
  bodyProportions: string;
  environmentDetail: string;
  lighting: string;
  perspective: string;
  diagramGrammar: string;
  mapGrammar: string;
  negativeConstraints: string[];
  graphicPalette: GraphicPalette;
};

export type StyleBible = {
  styleId: string;
  family: string;
  lineWeight: string;
  contourStyle: string;
  shapeLanguage: string;
  detailLevel: string;
  shadingStyle: string;
  textureStyle: string;
  paletteMode: "content_dependent";
  saturation: string;
  contrast: string;
  backgroundTreatment: string;
  characterProportions: string;
  facialStyle: string;
  environmentStyle: string;
  objectStyle: string;
  diagramStyle: string;
  historicalAdaptation: string;
  realismLevel: string;
  colorPolicy: string;
};

export function createStyleBible(style: StylePreset): StyleBible {
  return {
    styleId: `${style.id}:v${style.version}`,
    family: style.name,
    lineWeight: style.linework,
    contourStyle: style.linework,
    shapeLanguage: style.bodyProportions,
    detailLevel: style.environmentDetail,
    shadingStyle: style.shading,
    textureStyle: style.texture,
    paletteMode: "content_dependent",
    saturation: style.palette,
    contrast: "Clear subject/background separation and thumbnail readability.",
    backgroundTreatment: style.environmentDetail,
    characterProportions: style.bodyProportions,
    facialStyle: style.faceConstruction,
    environmentStyle: style.environmentDetail,
    objectStyle: `Readable silhouettes and materials rendered with ${style.linework}`,
    diagramStyle: style.diagramGrammar,
    historicalAdaptation: "Preserve era-appropriate materials, clothing, architecture and natural colors without forcing a global monochrome palette.",
    realismLevel: style.summary,
    colorPolicy: "Color is determined by the subject and setting. Preserve the style's visual grammar, never copy a fixed palette from an unrelated sample and never force grayscale unless the selected style explicitly requires it.",
  };
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  bold_cartoon_documentary: {
    id: "bold_cartoon_documentary",
    version: 1,
    name: "Classic 2D Documentary",
    summary: "Simplified 2D cartoon-documentary style — thick confident outlines, rounded simplified forms, and a restrained flat-shaded palette. Not hyper-realistic, not painterly, not a richly detailed illustration, not childish preschool cartoon, not generic corporate flat vector art.",
    bestFor: ["History", "Survival", "Engineering", "Culture", "Geography", "How people lived"],
    linework: "Thick, confident black outlines on every silhouette edge, with minimal interior detail lines — construction stays simple, never intricate. No sketchy cross-hatching, no photorealistic edge rendering.",
    shading: "Flat cel-shading only, 1-2 tonal steps per surface (base, occasional shadow) — no painterly gradients, no soft airbrushed shading, no hard outline on the shadow shapes themselves.",
    texture: "A light, uniform paper/canvas grain overlay across the whole image — subtle enough to never read as noise or damage, present enough to avoid a flat vector-art look. No rich material/fabric texture rendering.",
    palette: "Flat, readable hues — avoid neon/oversaturated color. Favor 2-4 dominant hues plus neutrals per scene so the image reads instantly, even at thumbnail size.",
    faceConstruction: "Simple economical faces — few clean lines for eyes/brows/mouth, clearly readable expression. Avoid hyper-detailed photographic facial rendering and avoid oversized preschool-cartoon eyes.",
    bodyProportions: "Rounded, simplified forms with strong, instantly-readable silhouettes — costume/clothing indicated simply and schematically (a few clean shapes/colors), never rich fabric or material detail. Not chibi, not hyper-stylized anime.",
    environmentDetail: "Simple, readable environments with clear foreground/background separation and minimal set-dressing — only what is essential to read the location. Never rich, densely detailed, or poster-like scenic illustration.",
    lighting: "Directional, motivated lighting with a clear implied light source and soft flat shadow shapes — never flat/shadowless, never harsh studio-flash lighting, never dramatic cinematic lighting.",
    perspective: "Consistent one-to-two-point perspective per scene, eye-level or slightly low-angle by default for a grounded, cinematic feel.",
    diagramGrammar: "Diagrams use the same bold linework/palette as narrative scenes, never a generic flat corporate-infographic look. Labels and callouts are added programmatically in the video layer — never baked into the image.",
    mapGrammar: "Maps use a hand-illustrated cartographic style, not literally aged/parchment unless the topic calls for it. Place names and route lines are added programmatically — never baked into the image.",
    // Kept intentionally short — this array is repeated verbatim inside
    // EVERY scene/reference prompt's own [FORBIDDEN ELEMENTS] section
    // (already a non-droppable-until-late budget tier), so it is not the
    // place to carry the newer painterly/historical-poster/scenic-detail
    // prohibitions — those live in compileFullStyleLock's own hardcoded
    // "Do not:" sentence and the style-reference template instead, where
    // they cost nothing extra since that text was already being sent.
    negativeConstraints: ["not hyper-realistic / photographic", "not childish preschool cartoon", "not generic corporate flat vector art", "no 3D-render look", "no anime/manga stylization"],
    graphicPalette: { bg: [250, 247, 240], ink: [30, 30, 36], muted: [120, 116, 108], positive: [70, 140, 90], negative: [190, 70, 60], accent: [196, 90, 60], track: [225, 218, 205] },
  },
  simple_outline_explainer: {
    id: "simple_outline_explainer",
    version: 1,
    name: "Simple Story Cartoon",
    summary: "Extremely readable, simplified 2D explainer style — thin-to-medium outlines, minimal anatomy, flat color, minimal shading. Built for maximum clarity and cheap, consistent rendering.",
    bestFor: ["History", "Economics", "Survival", "What-if", "Curiosity", "Educational"],
    linework: "Thin-to-medium black outlines, uniform weight. No cross-hatching, no variable-weight ink detail.",
    shading: "Minimal to no shading — flat color fills with at most one soft shadow shape per surface.",
    texture: "Clean, texture-free flat surfaces — no paper grain, no noise overlay.",
    palette: "Flat, simplified color palette — 2-3 dominant hues plus neutrals, high contrast for instant readability at thumbnail size.",
    faceConstruction: "Very simple faces — minimal line construction for eyes/brows/mouth, clear expression with the fewest lines possible.",
    bodyProportions: "Minimal, simplified anatomy — simplified limbs and torso, strong clean silhouettes, no anatomical detail beyond what's needed to read the pose.",
    environmentDetail: "Simplified environment layers — a few clear shapes establishing the setting, never a busy or cluttered background.",
    lighting: "Flat, even lighting — no dramatic shadow shapes, clarity over mood.",
    perspective: "Simple, mostly frontal or three-quarter compositions — avoid complex perspective that would need extra linework to read clearly.",
    diagramGrammar: "Diagrams use the same simplified linework/palette as narrative scenes. Labels and callouts are added programmatically — never baked into the image.",
    mapGrammar: "Maps use the same simplified flat style. Place names and route lines are added programmatically — never baked into the image.",
    negativeConstraints: ["not hyper-realistic / photographic", "no painterly texture", "no dense cross-hatching", "no 3D-render look", "no anime/manga stylization", "no busy/cluttered backgrounds"],
    graphicPalette: { bg: [252, 252, 250], ink: [20, 20, 24], muted: [130, 130, 134], positive: [50, 150, 90], negative: [210, 60, 60], accent: [40, 110, 200], track: [220, 220, 222] },
  },
  polished_vector_cartoon: {
    id: "polished_vector_cartoon",
    version: 1,
    name: "Bright Modern Cartoon",
    summary: "Clean, polished commercial vector-animation style — geometric forms, bold saturated colors, larger expressive eyes, and smooth controlled shading. A modern, high-production YouTube-explainer feel.",
    bestFor: ["Science", "Technology", "History", "High-curiosity explainers", "Educational content"],
    linework: "Clean, uniform-weight vector outlines with rounded corners — precise and geometric, never sketchy.",
    shading: "Smooth, controlled gradient/cel-shading with soft-edged highlights — polished commercial-animation feel.",
    texture: "Clean, texture-free vector surfaces — no grain, no noise overlay.",
    palette: "Bold, saturated, bright colors — high-contrast and vivid, designed to pop at thumbnail size.",
    faceConstruction: "Larger, expressive eyes with clean simple brow/mouth shapes — friendly, approachable, commercial-animation faces.",
    bodyProportions: "Clean geometric proportions with very clean, simplified silhouettes — polished, not chibi.",
    environmentDetail: "Clean geometric environments with clear layered depth — purposeful, uncluttered, commercial-explainer set-dressing.",
    lighting: "Soft, even studio-style lighting with gentle gradient shading — bright and inviting, never harsh or moody.",
    perspective: "Clean, simple perspective — mostly eye-level, designed for clarity over drama.",
    diagramGrammar: "Diagrams use the same clean geometric linework/palette as narrative scenes. Labels and callouts are added programmatically — never baked into the image.",
    mapGrammar: "Maps use the same clean geometric vector style. Place names and route lines are added programmatically — never baked into the image.",
    negativeConstraints: ["not hyper-realistic / photographic", "no painterly texture", "no grain/noise overlay", "no muted/desaturated palette", "no anime/manga stylization"],
    graphicPalette: { bg: [255, 255, 255], ink: [24, 24, 30], muted: [140, 140, 150], positive: [40, 190, 120], negative: [235, 70, 90], accent: [90, 70, 230], track: [230, 230, 238] },
  },
  wojak_documentary_hybrid: {
    id: "wojak_documentary_hybrid",
    version: 1,
    name: "Meme Documentary",
    summary: "Deliberately simple recurring-character style over richer, more detailed environments — strong subject/background contrast built for excellent character consistency at low cost.",
    bestFor: ["Economics", "Internet culture", "Psychology", "Finance", "Survival", "Speculative topics"],
    linework: "Simple, minimal black linework on characters — flat, uniform-weight lines with minimal interior detail.",
    shading: "Flat character rendering — no shading on the character itself; richer, more naturalistic shading is reserved for the background environment.",
    texture: "Flat, texture-free character rendering against a more textured/detailed background — deliberate contrast is part of the style.",
    palette: "Simple, muted character palette against a richer, more varied background palette.",
    faceConstruction: "Minimal face construction — deliberately simple, recurring, near-iconic facial features, consistent across every appearance.",
    bodyProportions: "Simple, minimal anatomy — the character stays visually consistent and iconic rather than naturalistic.",
    environmentDetail: "Richer, more detailed environments than the character occupying them — strong subject/environment contrast is the point of this style.",
    lighting: "Naturalistic environment lighting; the character itself stays flat/unlit for contrast.",
    perspective: "Straightforward compositions that keep the recurring character clearly readable against the richer background.",
    diagramGrammar: "Diagrams use the richer background rendering style, not the flat character style. Labels and callouts are added programmatically — never baked into the image.",
    mapGrammar: "Maps use the richer background rendering style. Place names and route lines are added programmatically — never baked into the image.",
    negativeConstraints: ["not hyper-realistic / photographic", "character must never gain shading/detail the background doesn't", "no anime/manga stylization", "no 3D-render look"],
    graphicPalette: { bg: [235, 230, 220], ink: [40, 38, 34], muted: [130, 124, 114], positive: [90, 140, 90], negative: [170, 80, 70], accent: [150, 120, 90], track: [210, 202, 188] },
  },
  painterly_storybook_documentary: {
    id: "painterly_storybook_documentary",
    version: 1,
    name: "Illustrated History",
    summary: "Premium painterly 2D storybook style — textured brushwork, richer lighting, semi-realistic anatomy, and a warm cinematic palette for an atmospheric, historical feel.",
    bestFor: ["History", "Mythology", "Ancient civilizations", "Biographies", "Folklore", "Sleep/documentary channels"],
    linework: "Soft, painterly edges rather than hard ink outlines — form is built through brushwork and light, not line.",
    shading: "Rich painterly gradients and multiple tonal steps — soft, blended shadow shapes rather than flat cel-shading.",
    texture: "Visible textured brushwork across the whole image — canvas-like, giving a hand-painted storybook feel.",
    palette: "Warm, cinematic palette — golden-hour and firelight tones favored, deep atmospheric shadows.",
    faceConstruction: "Semi-realistic, softly painted faces with believable expression — more detailed than a flat cartoon but still clearly illustrated, not photographic.",
    bodyProportions: "Semi-realistic anatomy and proportions — believable, grounded human figures rendered with painterly softness.",
    environmentDetail: "Richly detailed, atmospheric environments with strong depth and lighting — cinematic historical set-dressing.",
    lighting: "Dramatic, motivated lighting (firelight, golden hour, moonlight) with soft painterly shadow falloff.",
    perspective: "Cinematic composition, often slightly low-angle, favoring atmosphere and grandeur over strict geometric precision.",
    diagramGrammar: "Diagrams use the same painterly linework/palette as narrative scenes, softened rather than sharp — never a flat corporate-infographic look. Labels and callouts are added programmatically — never baked into the image.",
    mapGrammar: "Maps use a hand-painted historical-cartography style. Place names and route lines are added programmatically — never baked into the image.",
    negativeConstraints: ["not hyper-realistic / photographic", "not flat vector cartoon", "no clean hard-edged cel-shading", "no anime/manga stylization", "no 3D-render look"],
    graphicPalette: { bg: [46, 32, 24], ink: [245, 230, 205], muted: [180, 160, 130], positive: [130, 170, 90], negative: [200, 90, 70], accent: [214, 138, 60], track: [80, 60, 45] },
  },
  documentary_collage: {
    id: "documentary_collage",
    version: 1,
    name: "Documentary Collage",
    summary: "Paper-cutout collage style — layered maps, documents, and illustrated/photo-like inserts assembled with subtle shadows, giving an intentionally-assembled investigative-documentary feel.",
    bestFor: ["Business", "Corporate stories", "Investigations", "History", "Biographies", "Scandals", "Timelines"],
    linework: "Clean-edged paper-cutout shapes rather than continuous ink linework — edges read as cut paper, not drawn lines.",
    shading: "Subtle drop shadows beneath layered paper elements to imply depth — no painterly or cel-shading on the shapes themselves.",
    texture: "Visible paper/document/collage texture on every layer — a deliberately assembled, tactile look.",
    palette: "Muted, document-like palette (aged paper, ink, restrained accent colors) with occasional bolder cutout accents.",
    faceConstruction: "Simplified, cutout-style facial features — illustrated or photo-collage inserts, never fully photographic.",
    bodyProportions: "Simplified cutout-shape proportions — figures read as assembled paper pieces, not fully rendered anatomy.",
    environmentDetail: "Layered maps, documents, and illustrated inserts compose the environment — intentionally assembled rather than a single continuous scene.",
    lighting: "Flat lighting per layer with subtle cast shadows between layers implying physical stacking — no single unified light source.",
    perspective: "Flattened, collage-style composition — layered elements at varied scales rather than strict single-point perspective.",
    diagramGrammar: "Diagrams ARE the collage — maps, documents, and cutout pieces double as the diagram grammar. Labels and callouts are added programmatically — never baked into the image.",
    mapGrammar: "Maps are literal layered paper-document elements within the collage. Place names and route lines are added programmatically — never baked into the image.",
    negativeConstraints: ["not hyper-realistic / photographic", "not a single continuous painted scene", "no anime/manga stylization", "no 3D-render look", "minor inconsistency between layers is acceptable and intentional"],
    graphicPalette: { bg: [238, 230, 210], ink: [45, 40, 32], muted: [140, 132, 116], positive: [80, 130, 90], negative: [180, 70, 60], accent: [180, 60, 50], track: [210, 198, 175] },
  },
};

export const DEFAULT_STYLE_PRESET_ID = "bold_cartoon_documentary";

export function getStylePreset(id: string | null | undefined): StylePreset {
  return STYLE_PRESETS[id ?? ""] ?? STYLE_PRESETS[DEFAULT_STYLE_PRESET_ID];
}

// Mirrors the frontend's stylePresets.js toVersionedId/parseVersionedId
// exactly (see that file's own comment — presets are versioned so a future
// prompt-quality edit never silently changes what an existing project was
// actually built from). project.visual_style_preset is stored versioned
// (e.g. "bold_cartoon_documentary:v1"); this resolves it to the real
// StylePreset the same way the Look page's picker does, rather than the
// separate/legacy style_key concept Visual World shipped with in V1.
export function getStylePresetForProject(versionedId: string | null | undefined): StylePreset {
  const [id] = String(versionedId ?? "").split(":v");
  return getStylePreset(id);
}

// Compatibility alias — every existing caller that imports ZYVO_STYLE_SPEC
// keeps getting exactly the same object shape it always did, now sourced
// from the preset registry instead of a standalone literal. Unchanged
// behavior for any code not yet updated to read a project's actual
// selected style.
export const ZYVO_STYLE_SPEC = STYLE_PRESETS[DEFAULT_STYLE_PRESET_ID];

/* ============================ CharacterIdentitySpec (character-reference architecture redesign) ============================ */
// Root-cause fix for three real, observed Mars failures: (1) the 3/4
// identity master got contaminated with a Mars room + generated badge text,
// (2) a Qwen-edited Profile looked like a different person, (3) Face
// rendered as basically the same composition as 3/4 instead of a distinct
// reference. All three trace back to the SAME structural gap: canonicalSpec
// was one free-text prose string that could (and did) smuggle in
// occupation/environment framing ("a Mars habitat technician...") which
// competed with the deterministic no-environment/no-text instructions, and
// nothing forced Profile/Face's prompt to restate the SAME concrete face/
// body/outfit facts as the master, so the renderer had nothing anchoring it
// beyond a shared reference image. CharacterIdentitySpec is a STRICT,
// additionalProperties:false structured object with ONLY appearance fields
// — no occupation, no role, no environment field exists in this schema at
// all, so there is nothing for the LLM to smuggle a workplace/setting
// description into. It is IDENTITY-VARIABLE (Part 2): distinct per
// character, orthogonal to StyleSpec, which stays STYLE-CONSTANT (same
// artist, different people) and is never duplicated here.
export type CharacterOutfitSpec = {
  baseGarment: string; colors: string; collar: string; sleeves: string; pockets: string; belt: string; shoes: string; accessories: string; abstractPatches: string;
};
export type CharacterIdentitySpec = {
  apparentAge: string; sexPresentation: string;
  faceShape: string; faceWidth: string; jawShape: string; chinShape: string;
  noseShape: string; noseSize: string; eyeShape: string; eyeSpacing: string; eyebrowShape: string; earShape: string;
  hairline: string; hairstyle: string; hairColor: string; facialHair: string; skinTone: string;
  heightImpression: string; shoulderWidth: string; torsoBuild: string; limbBuild: string;
  distinguishingFeatures: string[]; silhouetteSignature: string;
  outfitSpec: CharacterOutfitSpec;
};

const OUTFIT_SPEC_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["baseGarment", "colors", "collar", "sleeves", "pockets", "belt", "shoes", "accessories", "abstractPatches"],
  properties: {
    baseGarment: { type: "string" }, colors: { type: "string" }, collar: { type: "string" }, sleeves: { type: "string" }, pockets: { type: "string" },
    belt: { type: "string" }, shoes: { type: "string" }, accessories: { type: "string" },
    abstractPatches: { type: "string", description: "Blank/abstract-icon description only — never lettering, names or numbers." },
  },
};

// Exported so the Reference Planner's per-entity schema (below) and any
// future caller (Character Pack QA, scene-reference planning) share one
// definition rather than two schemas silently drifting apart.
export const CHARACTER_IDENTITY_SPEC_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["apparentAge", "sexPresentation", "faceShape", "faceWidth", "jawShape", "chinShape", "noseShape", "noseSize", "eyeShape", "eyeSpacing", "eyebrowShape", "earShape", "hairline", "hairstyle", "hairColor", "facialHair", "skinTone", "heightImpression", "shoulderWidth", "torsoBuild", "limbBuild", "distinguishingFeatures", "silhouetteSignature", "outfitSpec"],
  properties: {
    apparentAge: { type: "string" }, sexPresentation: { type: "string" },
    faceShape: { type: "string" }, faceWidth: { type: "string" }, jawShape: { type: "string" }, chinShape: { type: "string" },
    noseShape: { type: "string" }, noseSize: { type: "string" }, eyeShape: { type: "string" }, eyeSpacing: { type: "string" }, eyebrowShape: { type: "string" }, earShape: { type: "string" },
    hairline: { type: "string" }, hairstyle: { type: "string" }, hairColor: { type: "string" }, facialHair: { type: "string" }, skinTone: { type: "string" },
    heightImpression: { type: "string" }, shoulderWidth: { type: "string" }, torsoBuild: { type: "string" }, limbBuild: { type: "string" },
    distinguishingFeatures: { type: "array", items: { type: "string" }, maxItems: 5 },
    silhouetteSignature: { type: "string" },
    outfitSpec: OUTFIT_SPEC_SCHEMA,
  },
};

// Deterministic, structured identity block — replaces free-prose
// canonicalSpec as the primary source for [ENTITY IDENTITY] whenever a
// spec exists, precisely so environment/occupation language has no field to
// live in. Field order here is also the KEEP-list order compileGeometryEdit
// (referenceRendererPolicy.js) renders for Profile/Back edits, so the same
// concrete facts get restated at every derived-view dispatch, not just the
// identity master's own generation.
export function renderIdentitySpecBlock(spec: CharacterIdentitySpec): string[] {
  const o = spec.outfitSpec;
  return [
    `Apparent age: ${spec.apparentAge}. Presentation: ${spec.sexPresentation}.`,
    `Face: ${spec.faceShape}, ${spec.faceWidth} width, ${spec.jawShape} jaw, ${spec.chinShape} chin.`,
    `Nose: ${spec.noseShape}, ${spec.noseSize}. Eyes: ${spec.eyeShape}, ${spec.eyeSpacing} spacing. Eyebrows: ${spec.eyebrowShape}. Ears: ${spec.earShape}.`,
    `Hair: ${spec.hairstyle}, ${spec.hairColor}, hairline ${spec.hairline}. Facial hair: ${spec.facialHair}. Skin tone: ${spec.skinTone}.`,
    `Build: ${spec.heightImpression} height impression, ${spec.shoulderWidth} shoulders, ${spec.torsoBuild} torso, ${spec.limbBuild} limbs.`,
    spec.distinguishingFeatures?.length ? `Distinguishing features: ${spec.distinguishingFeatures.join("; ")}.` : "",
    `Silhouette signature: ${spec.silhouetteSignature}.`,
    `Outfit: ${o.baseGarment} in ${o.colors}. Collar: ${o.collar}. Sleeves: ${o.sleeves}. Pockets: ${o.pockets}. Belt: ${o.belt}. Shoes: ${o.shoes}. Accessories: ${o.accessories}. Any patch/insignia: ${o.abstractPatches} (blank or abstract-icon only — never lettering or numbers).`,
  ].filter(Boolean);
}

// Best-effort deterministic head/shoulders region for a 1024x1024 full-body
// CHARACTER_IDENTITY_3Q master (see referenceJobPayload's fixed 1024x1024
// output size). "Full body head to toe... fully inside the frame with
// generous margins" (CHARACTER_VIEW_FRAMING.three_quarter_neutral) puts the
// head in roughly the top third for a centered standing figure — this is an
// approximation, not a computed detection, and is deliberately documented
// as such rather than presented as precise. If real crops consistently miss
// the head, this is the constant to retune, not the crop mechanism itself.
export const FACE_CROP_RECT = Object.freeze({ x: 288, y: 32, width: 448, height: 448 });

/* ============================ Deterministic view rules (Part 5) ============================ */
// No LLM call needed for any of this — see the milestone spec's "try
// zero-LLM derivation first" principle. HERO/RECURRING/INCIDENTAL and
// LOCATION/OBJECT/VEHICLE rules are simple, fixed policy; camera anchors
// for a LOCATION are read directly from the Visual Plan's own
// continuityGroups (already decided by the Visual Director LLM call when
// it built the storyboard) rather than re-asked of a second model.

// The CHARACTER angles this codebase generates, as a strict enum (never a
// loose string appended to a prompt) — see CHARACTER_VIEW_FRAMING for the
// full per-role contract each one compiles to. IDENTITY_3Q is every
// character's canonical anchor; every other role is derived FROM it
// (dependsOnAngle) rather than an independent generation — see the
// dependency-graph section below. HERO gets the richer pack (a real
// character sheet: 3/4, Profile, Back, Face, Outfit detail); RECURRING
// keeps the smaller 3/4+Face pack. ACTION_POSE exists in the contract but is
// deliberately never auto-included by deriveRequiredViews below — it's
// explicitly optional ("only if the Visual Plan actually benefits from
// one"), and this deterministic, no-LLM function has no reliable signal to
// judge that; a future step with more context (or an explicit user choice)
// can add it, but an unconditional quota was explicitly ruled out.
export const CHARACTER_REFERENCE_ROLES = {
  three_quarter_neutral: { role: "CHARACTER_IDENTITY_3Q", dependsOnAngle: null as string | null },
  front_full_body: { role: "CHARACTER_FRONT_FULL", dependsOnAngle: null as string | null },
  profile: { role: "CHARACTER_PROFILE", dependsOnAngle: "three_quarter_neutral" },
  back: { role: "CHARACTER_BACK", dependsOnAngle: "three_quarter_neutral" },
  face_closeup: { role: "CHARACTER_FACE", dependsOnAngle: "three_quarter_neutral" },
  expression_neutral: { role: "CHARACTER_EXPRESSION_NEUTRAL", dependsOnAngle: null as string | null },
  expression_happy: { role: "CHARACTER_EXPRESSION_HAPPY", dependsOnAngle: null as string | null },
  expression_worried: { role: "CHARACTER_EXPRESSION_WORRIED", dependsOnAngle: null as string | null },
  expression_shocked: { role: "CHARACTER_EXPRESSION_SHOCKED", dependsOnAngle: null as string | null },
  expression_angry_focused: { role: "CHARACTER_EXPRESSION_FOCUSED", dependsOnAngle: null as string | null },
  outfit_detail: { role: "CHARACTER_OUTFIT_DETAIL", dependsOnAngle: "three_quarter_neutral" },
  action_pose: { role: "CHARACTER_ACTION_POSE", dependsOnAngle: "three_quarter_neutral" },
  // Character sheet pack v4 (2026-09-11, same day, second revision):
  // v3 made every sheet an independent from-spec generation with NO
  // dependency between them — this was deliberate (see the superseded
  // comment in git history) but caused a real, visible incident: the
  // Identity/Outfit sheet got a fresh, correct 3-view layout, and Face/
  // Profile-Silhouette — generated independently from the SAME text spec
  // but different random seeds — drifted into a VISIBLY DIFFERENT-LOOKING
  // character. Text-only identity description is not enough to keep three
  // separate generations looking like the same person. Face and Profile/
  // Silhouette are now DERIVED from the accepted Identity/Outfit sheet via
  // a Qwen Image Edit Plus identity-preserving transformation (single
  // reference image, explicit "do not copy composition" instruction — see
  // compileDerivedSheetEdit) rather than an independent text-to-image call.
  // dependsOnAngle here is enforced at TWO levels: the claim-gate (must be
  // ACCEPTED before claimable, restored in migration 20260911160000) and
  // the actual reference-image conditioning during dispatch.
  identity_outfit_sheet: { role: "CHARACTER_IDENTITY_OUTFIT_SHEET", dependsOnAngle: null as string | null },
  face_sheet: { role: "CHARACTER_FACE_SHEET", dependsOnAngle: "identity_outfit_sheet" },
  profile_silhouette_sheet: { role: "CHARACTER_PROFILE_SILHOUETTE_SHEET", dependsOnAngle: "identity_outfit_sheet" },
  // One canonical character sheet (2026-09-13, major simplification):
  // authoritative for CURRENT generation — see deriveRequiredViews above.
  // Independent generation, no dependency on anything else, no derived
  // sub-assets. Everything above this line (component pack, 3-role sheet
  // pack, and further below, the original flat taxonomy) is history-only.
  character_reference_sheet: { role: "CHARACTER_REFERENCE_SHEET", dependsOnAngle: null as string | null },
  // Component-based HERO pack (replaces the multi-view SHEET roles above) —
  // real incident this fixes: FLUX.2 Klein 9B repeatedly, provably could not
  // obey "3 views in one image" (every identity_outfit_sheet/face_sheet/
  // profile_silhouette_sheet attempt rendered a single frontal view instead
  // of a 3-panel layout, across 4 separate live Mars attempts). The model
  // should never be responsible for composing a multi-panel layout — each
  // component view is its OWN canonical ReferenceAsset, generated/edited
  // independently, and the "sheet" the user sees is a PROGRAMMATIC UI
  // composition of 3 real assets, never a 4th AI-generated image. Three
  // logical groups, 9 total component roles for a HERO:
  //   identity_outfit_three_quarter (anchor, no dependency)
  //   identity_outfit_side / identity_outfit_back (Qwen geometry edit, depend on the anchor)
  //   face_front (deterministic crop of the anchor — same "it's the same pixels" guarantee as the old face-crop mechanism)
  //   face_side / face_back (Qwen geometry edit, depend on the anchor)
  //   silhouette_front / silhouette_side / silhouette_back (ADOPTED — zero-cost aliases of the identity_outfit trio, since "full-body front/side/back" is the same shot whether it's framed as identity or silhouette; see referenceRendererPolicy's ADOPT method)
  identity_outfit_three_quarter: { role: "IDENTITY_OUTFIT_THREE_QUARTER", dependsOnAngle: null as string | null },
  identity_outfit_side: { role: "IDENTITY_OUTFIT_SIDE", dependsOnAngle: "identity_outfit_three_quarter" },
  identity_outfit_back: { role: "IDENTITY_OUTFIT_BACK", dependsOnAngle: "identity_outfit_three_quarter" },
  face_front: { role: "FACE_FRONT", dependsOnAngle: "identity_outfit_three_quarter" },
  face_side: { role: "FACE_SIDE", dependsOnAngle: "identity_outfit_three_quarter" },
  face_back: { role: "FACE_BACK", dependsOnAngle: "identity_outfit_three_quarter" },
  silhouette_front: { role: "SILHOUETTE_FRONT", dependsOnAngle: "identity_outfit_three_quarter" },
  silhouette_side: { role: "SILHOUETTE_SIDE", dependsOnAngle: "identity_outfit_side" },
  silhouette_back: { role: "SILHOUETTE_BACK", dependsOnAngle: "identity_outfit_back" },
};
// Angles that function as "the identity anchor" for their entity — the old
// single-view 3Q anchor, the multi-view sheet, and the new component-based
// three-quarter are all structurally equivalent for gating purposes:
// exactly one exists per entity, and everything else in that entity's pack
// depends on it being qa-approved.
export const IDENTITY_ANCHOR_ANGLES = ["three_quarter_neutral", "identity_outfit_sheet", "identity_outfit_three_quarter"];
// silhouette_* never dispatch to a renderer — they ADOPT (zero-cost alias,
// see referenceRendererPolicy's ADOPT method) the already-accepted
// identity_outfit_* component for the SAME orientation, since duplicating
// an identical full-body shot under a second label would be pure waste.
export const ADOPT_SOURCE_ANGLE: Record<string, string> = {
  silhouette_front: "identity_outfit_three_quarter",
  silhouette_side: "identity_outfit_side",
  silhouette_back: "identity_outfit_back",
};

export type RequiredView = { referenceType: string; angle: string; purpose: string; importance?: string };

// 2026-09-20 "plants aren't characters" / "celestial bodies aren't generic
// objects" fix — real incident: entity_id "plants" was persisted with
// reference_type "character_reference", producing a full character-sheet
// generation (a humanoid mascot) for crops. The Visual Director's entity
// category (CHARACTER/LOCATION/IMPORTANT_OBJECT/VEHICLE_MACHINE/
// DIAGRAM_SUBJECT) is free-form LLM judgment with no deterministic
// guardrail afterward — this is that guardrail. Purely name-keyword based
// (no new LLM call): a biological-but-non-human entity mistakenly tagged
// CHARACTER is reclassified to ECOSYSTEM; a celestial body (however the
// planner tagged it — LOCATION/OBJECT/DIAGRAM_SUBJECT/CHARACTER are all
// observed real mistagging targets) is reclassified to CELESTIAL. Genuine
// LOCATION entities are left untouched by the celestial check so a real
// place (Earth's own surface, a lab, a city) keeps its existing camera-
// anchor-driven treatment.
const ECOSYSTEM_NAME_PATTERN = /\b(plants?|crops?|forests?|phytoplankton|algae|trees?|vegetation|flora|kelp|coral|moss|fungus|fungi|ecosystems?)\b/i;
const CELESTIAL_NAME_PATTERN = /\b(sun|moon|earth|planets?|stars?|comets?|asteroids?|galaxy|galaxies)\b/i;
export function resolveEffectiveEntityCategory(entity: { category: string; name?: string }): string {
  const name = entity.name ?? "";
  if (entity.category === "CHARACTER" && ECOSYSTEM_NAME_PATTERN.test(name)) return "ECOSYSTEM";
  if (entity.category !== "LOCATION" && CELESTIAL_NAME_PATTERN.test(name)) return "CELESTIAL";
  return entity.category;
}

// 2026-09-20 "stop generating near-duplicate refs" fix — real incident:
// Earth's own continuityGroups.cameraAnchors produced SIX separate camera
// labels (wide_heliocentric_overview, medium_earth_close,
// tangent_vector_insert, insert_sun_disk, wide_earth_sun_full,
// orbit_plane_sideview) that are visually near-identical globe shots. This
// never calls an LLM to judge similarity — it's a deterministic two-pass
// filter: (1) reorder candidates so genuine ESTABLISHING/canonical shots and
// ORBIT/SYSTEM relationship shots are considered before generic inserts/
// details/diagram-style cutaways (the least identity-critical category);
// (2) greedily keep an anchor only if it does NOT share 2+ significant
// words with an anchor already kept, capped at MAX_LOCATION_VIEWS total.
const MAX_LOCATION_VIEWS = 3;
const LOCATION_VIEW_TIER_PATTERNS: [RegExp, number][] = [
  [/\b(wide|overview|establishing|full|close|medium|canonical)\b/, 0],
  [/\b(orbit|system|heliocentric|relationship)\b/, 1],
];
function locationAnchorTier(anchor: string): number {
  // Real bug caught in testing: anchor labels are underscore_separated, and
  // "_" is a \w word character in JS regex — "\bwide\b" never matches
  // "wide_heliocentric_overview" because there's no actual boundary between
  // "wide" and "_heliocentric" (both are word characters). Normalize
  // underscores/punctuation to spaces FIRST, same as anchorTokens already
  // does, so \b actually finds real word boundaries.
  const normalized = anchor.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  for (const [pattern, tier] of LOCATION_VIEW_TIER_PATTERNS) if (pattern.test(normalized)) return tier;
  return 2; // inserts/details/diagram-style cutaways — lowest priority, first to be dropped by the cap
}
function anchorTokens(anchor: string): Set<string> {
  return new Set(anchor.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 4));
}
export function dedupeLocationAnchors(anchors: string[]): string[] {
  const ordered = anchors
    .map((anchor, i) => ({ anchor, i, tier: locationAnchorTier(anchor) }))
    .sort((a, b) => a.tier - b.tier || a.i - b.i)
    .map((x) => x.anchor);
  const kept: string[] = [];
  const keptTokens = new Set<string>();
  for (const anchor of ordered) {
    if (kept.length >= MAX_LOCATION_VIEWS) break;
    const tokens = anchorTokens(anchor);
    let overlap = 0;
    for (const t of tokens) if (keptTokens.has(t)) overlap++;
    if (overlap >= 2) continue; // near-duplicate of something already kept
    kept.push(anchor);
    for (const t of tokens) keptTokens.add(t);
  }
  return kept;
}

export function deriveRequiredViews(entity: { id: string; category: string; name?: string; importance: string; referenceNeeded: boolean }, continuityGroups: any[]): RequiredView[] {
  if (!entity.referenceNeeded) return [];
  const effectiveCategory = resolveEffectiveEntityCategory(entity);

  // 2026-09-20: plants/crops/forests/phytoplankton are an ecosystem/
  // environment reference, never a character-sheet layout just because the
  // entity is living/biological. One clean specimen/environment view — no
  // humanoid turnaround sheet, no front/3-4/side/back/face-closeup grid.
  if (effectiveCategory === "ECOSYSTEM") {
    const name = entity.name ?? entity.id;
    const views: RequiredView[] = [];
    if (/\b(crops?|agriculture|farm(?:ing)?)\b/i.test(name)) views.push({ referenceType: "environment_reference", angle: "crop_specimen", purpose: "Canonical crop specimen" });
    if (/\b(forests?|trees?|woodland|vegetation|flora)\b/i.test(name)) views.push({ referenceType: "environment_reference", angle: "forest_vegetation", purpose: "Canonical forest vegetation" });
    if (/\b(phytoplankton|algae|kelp)\b/i.test(name)) views.push({ referenceType: "environment_reference", angle: "phytoplankton_specimen", purpose: "Canonical phytoplankton environment" });
    return views.length ? views : [{ referenceType: "environment_reference", angle: "environment_specimen", purpose: "Canonical ecosystem specimen" }];
  }

  // 2026-09-20: Sun/Moon/planets/etc. get their own canonical-appearance
  // view — never the generic "three_quarter_hero" object framing (which
  // reads as meaningless "hero" language for a celestial body) and never a
  // multi-angle character-style turnaround.
  if (effectiveCategory === "CELESTIAL") {
    const name = entity.name ?? entity.id;
    if (/\bearth\b/i.test(name)) return [
      { referenceType: "celestial_reference", angle: "earth_full_disk", purpose: "Earth full-disk identity" },
      { referenceType: "celestial_reference", angle: "earth_atmosphere_limb", purpose: "Earth atmosphere and limb identity" },
      { referenceType: "celestial_reference", angle: "earth_surface_texture", purpose: "Earth surface texture identity" },
    ];
    return [{ referenceType: "celestial_reference", angle: "canonical_celestial_view", purpose: "Canonical celestial appearance reference" }];
  }

  if (effectiveCategory === "CHARACTER") {
    // ONE canonical character reference sheet (2026-09-13, major
    // simplification; ENFORCED 2026-09-22 "cheap reference system" pass —
    // real Atlantis incident: this branch had drifted back to emitting 5
    // separate structural views PLUS, for HERO characters, 5 MORE separate
    // expression views — 10 independent paid generations for one
    // character, each a weaker, less-constrained prompt than the
    // already-built compileCanonicalCharacterSheet compiler, which bakes
    // front/side/back/action-pose AND a 5-expression strip into ONE image
    // on a plain background. That compiler (angle "character_reference_
    // sheet") was fully built and already the target of a dedicated compile
    // branch (compileReferencePrompt) and QA contract (validateCompiled
    // ReferencePrompt's CHARACTER_REFERENCE_SHEET role) — it just was never
    // actually requested here. One character = one generated image = one
    // source of truth, exactly as the comment already promised.
    if (entity.importance === "HERO" || entity.importance === "RECURRING") {
      const core = [{ referenceType: "character_reference", angle: "character_reference_sheet", purpose: "Canonical character reference sheet (all views + expressions, one image)", importance: entity.importance }];
      validateRequiredViews(entity, core);
      return core;
    }
    return []; // INCIDENTAL — no canonical reference by default
  }

  if (effectiveCategory === "LOCATION") {
    // Treat like an animation set: only the camera anchors the storyboard
    // actually uses, read straight from continuityGroups — never an
    // automatic fixed number of angles.
    const anchors = new Set<string>();
    for (const group of continuityGroups ?? []) {
      if (group.locationId !== entity.id) continue;
      for (const anchor of group.cameraAnchors ?? []) anchors.add(anchor);
    }
    if (anchors.size === 0) {
      return [{ referenceType: "location_reference", angle: "wide_establishing", purpose: "Primary establishing anchor (no specific camera anchors found in the storyboard)" }];
    }
    // 2026-09-20: collapse near-identical camera-anchor labels (see
    // dedupeLocationAnchors' own comment) — a real place worth locking
    // needs 1-3 genuinely distinct canonical views, not one per label the
    // storyboard happened to invent.
    // A Visual World location is a cheap spatial identity anchor, not a
    // camera-angle pack. One strong establishing view is enough for scene
    // generation; shot-specific angles belong to the storyboard/scene
    // prompt.
    const [primaryAnchor] = dedupeLocationAnchors(Array.from(anchors));
    return [{ referenceType: "location_reference", angle: primaryAnchor, purpose: `Primary reusable storyboard anchor: ${primaryAnchor}` }];
  }

  if (effectiveCategory === "IMPORTANT_OBJECT" || effectiveCategory === "VEHICLE_MACHINE") {
    // referenceNeeded on this entity already encodes the Visual Director's
    // own "is this repeated/identity-sensitive/important enough" judgment
    // (Part 5 item 15) — by the time we're here that gate has already
    // passed, so one hero angle is the V1 default.
    return [{ referenceType: "object_reference", angle: "three_quarter_hero", purpose: "Primary canonical identity anchor" }];
  }

  return [];
}

export const REFERENCE_PLAN_BUDGET = {
  characterSheets: 7,
  locationSheets: 4,
  objectSheets: 3,
  // Style is an authoritative structured StyleBible. A paid random style
  // image is neither required nor useful enough to reserve budget for.
  styleAnchors: 0,
  diagramStyleSheets: 1,
  maxAssets: 16,
} as const;

const referencePriorityScore = (value: unknown) => ({ high: 3, medium: 2, low: 1 }[String(value ?? "").toLowerCase()] ?? 0);
const importanceScore = (value: unknown) => ({ HERO: 3, RECURRING: 2, INCIDENTAL: 1 }[String(value ?? "").toUpperCase()] ?? 0);

// Deterministic episode budget. DIAGRAM_SUBJECT rows deliberately do not
// become subject-by-subject images: one synthetic diagram-style sheet is
// added by the planner when any are present.
export function applyReferencePlanningBudget<T extends { id: string; category: string; name?: string; importance: string; referenceNeeded: boolean; referencePriority?: unknown }>(entities: T[]) {
  const requested = (entities ?? []).filter((entity) => entity.referenceNeeded);
  const diagramStyleNeeded = requested.some((entity) => resolveEffectiveEntityCategory(entity) === "DIAGRAM_SUBJECT");
  const ranked = [...requested]
    .filter((entity) => resolveEffectiveEntityCategory(entity) !== "DIAGRAM_SUBJECT")
    .sort((a, b) => referencePriorityScore(b.referencePriority) - referencePriorityScore(a.referencePriority)
      || importanceScore(b.importance) - importanceScore(a.importance)
      || String(a.id).localeCompare(String(b.id)));
  const selected: T[] = [];
  const categoryCounts = { CHARACTER: 0, LOCATION: 0, SUPPORT: 0 };
  for (const entity of ranked) {
    const category = resolveEffectiveEntityCategory(entity);
    const bucket = category === "CHARACTER" ? "CHARACTER" : category === "LOCATION" ? "LOCATION" : "SUPPORT";
    const cap = bucket === "CHARACTER" ? REFERENCE_PLAN_BUDGET.characterSheets : bucket === "LOCATION" ? REFERENCE_PLAN_BUDGET.locationSheets : REFERENCE_PLAN_BUDGET.objectSheets;
    if (categoryCounts[bucket] >= cap) continue;
    categoryCounts[bucket] += 1;
    selected.push(entity);
  }
  const reserved = REFERENCE_PLAN_BUDGET.styleAnchors + (diagramStyleNeeded ? REFERENCE_PLAN_BUDGET.diagramStyleSheets : 0);
  return { selected: selected.slice(0, Math.max(0, REFERENCE_PLAN_BUDGET.maxAssets - reserved)), diagramStyleNeeded, requestedCount: requested.length };
}

export function validateRequiredViews(entity: { id: string; category: string; name?: string; importance: string }, views: RequiredView[]): void {
  const keys = views.map((v) => `${v.referenceType}:${v.angle}`);
  if (new Set(keys).size !== keys.length) throw new Error(`REFERENCE_VIEW_CONTRACT_VIOLATION: duplicate view for ${entity.id}`);
  const effective = resolveEffectiveEntityCategory(entity);
  if (effective === "LOCATION" && views.length > 3) throw new Error(`REFERENCE_VIEW_CONTRACT_VIOLATION: location ${entity.id} exceeds 3 views`);
  if (effective === "CELESTIAL") {
    const earth = /\bearth\b/i.test(entity.name ?? entity.id);
    if ((earth && views.length > 3) || (!earth && views.length > 1)) throw new Error(`REFERENCE_VIEW_CONTRACT_VIOLATION: celestial view cap exceeded for ${entity.id}`);
  }
  if (effective === "ECOSYSTEM" && views.some((v) => v.referenceType === "character_reference")) throw new Error(`REFERENCE_VIEW_CONTRACT_VIOLATION: ecosystem ${entity.id} cannot use character references`);
  if ((effective === "IMPORTANT_OBJECT" || effective === "VEHICLE_MACHINE") && views.length > 2) throw new Error(`REFERENCE_VIEW_CONTRACT_VIOLATION: object ${entity.id} exceeds 2 views`);
}

/* ============================ Deterministic prompt compiler (Part 9) ============================ */
// The LLM authors the canonical spec ONCE per entity; code turns it into
// every actual image prompt. No per-image OpenAI call, ever.

/* ============================ Economics projection (Part 16) ============================ */
// Pure, deterministic — runs once the Reference Planner's asset count is
// known, BEFORE any actual rendering. Uses the REAL configured per-image
// cost for the model this codebase already has wired up for V2
// (image:flux.base / runware:400@4, see src/lib/providers.ts). V3/V4 use
// the closest already-configured real Runware entries in this codebase
// (image:flux.max) as a stand-in — the exact models named in the milestone
// spec (Kling IMAGE O3, Seedream 5.0 Pro, Recraft V4.1, Qwen Image Edit
// Plus) are NOT yet in this codebase's provider registry, so their real
// per-image cost is unknown rather than guessed; `isPlaceholder` marks
// which figures that applies to.
export const REFERENCE_COST_MODEL_USD = {
  v2: { costUsd: 0.028, sourceToolKey: "image:kling.o3", isPlaceholder: false },
  v3: { costUsd: 0.028, sourceToolKey: "image:kling.o3", isPlaceholder: false },
  v4: { costUsd: 0.07, sourceToolKey: "image:flux.max", isPlaceholder: true }, // real V4 model (Seedream 5.0 Pro) not yet configured — same stand-in
};

export function estimateReferenceCosts(referenceCount: number) {
  const round = (n: number) => Number(n.toFixed(4));
  return {
    referenceCount,
    v2: { totalUsd: round(referenceCount * REFERENCE_COST_MODEL_USD.v2.costUsd), ...REFERENCE_COST_MODEL_USD.v2 },
    v3: { totalUsd: round(referenceCount * REFERENCE_COST_MODEL_USD.v3.costUsd), ...REFERENCE_COST_MODEL_USD.v3 },
    v4: { totalUsd: round(referenceCount * REFERENCE_COST_MODEL_USD.v4.costUsd), ...REFERENCE_COST_MODEL_USD.v4 },
  };
}

// Per-role framing text — a strict generation contract, not a loose string
// appended to a prompt. Real incident this fixes: the 3/4 and Face views
// for the same character rendered as near-identical full-body compositions,
// and Profile wasn't a true 90-degree side view — because the old framing
// instructions were thin ("Head and shoulders only" / a single sentence)
// and easy for the model to drift away from. Each block below is a complete,
// self-contained set of framing requirements per CHARACTER_IDENTITY_3Q /
// CHARACTER_PROFILE / CHARACTER_FACE — see CHARACTER_REFERENCE_ROLES for the
// angle->role mapping. validateCompiledReferencePrompt (below) checks the
// COMPILED prompt actually contains this block's required phrases before
// any dispatch, so a future edit to this function can't silently regress
// back to a generic prompt without the validator catching it.
// Shared boilerplate every multi-view sheet repeats — Part 8's own required
// wording, verbatim: same single fictional character three times, only
// camera orientation changes, plain white/light-neutral background, no
// environment, no readable text of any kind.
// Character sheet pack v3 (2026-09-11): a real manual test proved FLUX CAN
// compose 3 correct views of the SAME character in ONE image — the model is
// not the limitation. The prior wording (still visible in git history)
// buried this exact same 3-view instruction under ~2000 chars of [STYLE
// LOCK]/[ENTITY IDENTITY] boilerplate that came FIRST in the compiled
// prompt; compileCharacterSheetPrompt below is a dedicated compiler (NOT
// the generic compileReferencePrompt ordering) that puts the layout
// contract first, verbatim-close to the manually-proven structure, and
// injects identity/style AFTER it.
export const SHEET_PROMPT_CONTRACT_VERSION = "character_sheet_v3";
export const SHEET_PROMPT_COMPILER_VERSION = "2026-09-character-sheet-v3";
type SheetRoleSpec = { framingLabel: string; left: string; center: string; right: string; compositionExtra: string[]; purposeLine: string };
const SHEET_ROLE_SPECS: Record<string, SheetRoleSpec> = {
  identity_outfit_sheet: {
    framingLabel: "FULL-BODY",
    left: "three-quarter front view, approximately 45 degrees, full body from head to shoes.",
    center: "strict 90-degree side profile, full body, exactly one eye visible, clear nose and chin silhouette, full body from head to shoes.",
    right: "strict back view, full body, face completely hidden, back of head and back of clothing clearly visible, full body from head to shoes.",
    compositionExtra: ["feet fully visible", "full body head to shoes in every view — no crop at any point"],
    purposeLine: "Purpose: canonical identity, clothing construction and body proportions reference — not a finished scene.",
  },
  face_sheet: {
    framingLabel: "HEAD-AND-SHOULDERS",
    left: "front face, direct eye contact with camera, head and shoulders only.",
    center: "strict 90-degree side profile of the face, exactly one eye visible, clear nose-lips-chin silhouette, head and shoulders only.",
    right: "rear / back-of-head view, face completely hidden, back of hairstyle and neck/collar visible, head and shoulders only.",
    compositionExtra: ["head and shoulders only in every view", "no torso below the shoulders", "no hands", "no full body"],
    purposeLine: "Purpose: facial identity and head construction reference — no body or environment emphasis.",
  },
  profile_silhouette_sheet: {
    framingLabel: "FULL-BODY",
    left: "straight front view (not three-quarter), full body from head to shoes, facing the camera directly.",
    center: "strict 90-degree side profile, full body from head to shoes, genuinely rotated to a true side-on silhouette.",
    right: "strict rear view, full body from head to shoes, facing completely away from camera.",
    compositionExtra: ["feet fully visible", "full body head to shoes in every view — no crop at any point", "arms relaxed at the sides"],
    purposeLine: "Purpose: body proportions, silhouette and scene consistency reference.",
  },
};
function compileCharacterSheetPrompt(args: {
  styleSpec: typeof ZYVO_STYLE_SPEC;
  entityName: string;
  canonicalSpec: string;
  identitySpec?: CharacterIdentitySpec | null;
  view: RequiredView;
  factualConstraints?: string[];
  forbiddenElements?: string[];
}): string {
  const { styleSpec, entityName, canonicalSpec, identitySpec, view, factualConstraints, forbiddenElements } = args;
  const spec = SHEET_ROLE_SPECS[view.angle];
  const lines: string[] = [
    `Professional 2D animation character model sheet, ${styleSpec.summary}`,
    "",
    `CREATE ONE SINGLE IMAGE CONTAINING EXACTLY THREE ${spec.framingLabel} VIEWS OF THE SAME EXACT CHARACTER, arranged horizontally from left to right.`,
    "",
    "LEFT VIEW:", spec.left,
    "",
    "CENTER VIEW:", spec.center,
    "",
    "RIGHT VIEW:", spec.right,
    "",
    "IMPORTANT: these are NOT three different people. They are the SAME CHARACTER repeated three times from three different camera angles.",
    "",
    "STRICT CONSISTENCY:",
    "identical face structure,", "identical hairstyle,", "identical hair color,", "identical facial hair,",
    "identical body proportions,", "identical clothing construction,", "identical pocket placement,",
    "identical accessories,", "identical shoes.",
    "",
    "COMPOSITION:",
    "three separate standing figures,", "equal scale,", "equal spacing,",
    ...spec.compositionExtra.map((l) => `${l},`),
    "nothing cropped,", "neutral relaxed pose,", "plain warm off-white studio background,",
    "no environment,", "no room,", "no scenery,", "no furniture,", "no props.",
    "",
    "NO TEXT OR LABELS ANYWHERE.",
    "Do not write FRONT, SIDE, BACK.",
    "No names, letters, numbers, logos, badges, captions, UI or watermark.",
    "",
    spec.purposeLine,
  ];
  lines.push("", "[CHARACTER IDENTITY]", `${entityName}${identitySpec ? "" : `: ${canonicalSpec}`}`);
  if (identitySpec) lines.push(...renderIdentitySpecBlock(identitySpec));
  lines.push("", "[STYLE]", `Linework: ${styleSpec.linework}`, `Shading: ${styleSpec.shading}`, `Texture: ${styleSpec.texture}`, `Palette: ${styleSpec.palette}`, `Lighting: ${styleSpec.lighting}`);
  if (factualConstraints?.length) lines.push("", "[FACTUAL CONSTRAINTS]", ...factualConstraints.map((c) => `- ${c}`));
  const forbidden = [...styleSpec.negativeConstraints, ...(forbiddenElements ?? []), "readable text", "letters", "numbers", "names", "logos", "badges containing lettering", "signage", "numerical displays", "labels", "watermark", "captions"];
  lines.push("", "[FORBIDDEN ELEMENTS]", ...forbidden.map((f) => `- ${f}`), "If the costume or design logically includes a badge, patch, tag or panel, render it as a BLANK or abstract/icon-only graphic — never with legible lettering or numbers of any kind.");
  return lines.join("\n");
}

// Character sheet pack v4 (2026-09-11, second revision): Face and Profile/
// Silhouette are no longer independent from-spec generations (v3's own
// choice, which caused a real, visibly-different-looking-character
// incident) — they are now a Qwen Image Edit Plus identity-preserving
// TRANSFORMATION of the single accepted Identity/Outfit sheet. Reuses the
// SAME SHEET_ROLE_SPECS layout contract as compileCharacterSheetPrompt
// (identical LEFT/CENTER/RIGHT text, so validateCompiledReferencePrompt's
// existing per-role checks apply unchanged to either compiler) — only the
// FRAMING sentences differ: this version explicitly tells the model the
// supplied reference defines identity ONLY and its own composition must
// NOT be copied, per the real incident of reference-conditioned FLUX/Qwen
// calls biasing toward reproducing a source image's pose/framing.
export function compileDerivedSheetEdit(view: RequiredView, styleSummary: string | undefined, _identitySpec?: CharacterIdentitySpec | null): string {
  return compileIsolatedSheetEdit(view.angle, styleSummary);
}

// One canonical character sheet (2026-09-13, major simplification):
// composition-first, exactly matching the manually-proven wording — the
// [CHARACTER SHEET CONTRACT] block leads, before any identity/style/
// forbidden-elements text, so the layout requirement is never buried.
// HERO gets 6 panels (front/side/back/face/outfit-detail/action-pose,
// 2 rows x 3 columns); RECURRING gets 4 (front/side/back/face, one row).
// Independent generation — no reference image, no derived sub-assets, no
// cross-character dependency of any kind.
// v2-kling (2026-09-13): moved the canonical sheet renderer from FLUX Klein
// to Kling IMAGE O3 — direct Runware evidence showed Kling substantially
// better suited to this exact "one image, many correct views of one
// character" use case. The contract itself was loosened to match: Klein
// needed a rigid, near-pixel grid spelled out explicitly or it would ignore
// the layout instruction entirely; Kling's own examples show it composing a
// professional model sheet from a semantic description of WHAT views are
// required, without needing an exact row/column diagram. QA now treats grid
// placement as soft (see runCharacterReferenceSheetQA) — the prompt should
// match that leniency rather than asking for something the QA layer no
// longer enforces.
// 2026-09-19 "richer expression coverage" pass (item 4): replaces the old
// single static "face close-up" with a compact 5-expression panel (neutral,
// happy, concerned, focused, surprised/stressed) plus an explicit action
// pose for every recurring/HERO character — real product ask: "current
// sheets are too limited" for downstream scene generation, which regularly
// needs a character reacting, not just standing neutrally. Deliberately
// kept as ONE additional panel region (a small headshot strip), never 5
// separate full panels — the task's own "do not make this noisy, keep it
// clean and production-usable" instruction. Bumping this version string is
// exactly what makes the stale-reuse guard (isStaleCharacterSheetAsset,
// advance-long-form-visual-world/index.ts) correctly treat every
// PRE-EXISTING sheet — including ones already on the current renderer/style
// contract — as needing a fresh regeneration under this new template,
// rather than being silently reused as "already compatible."
export const CHARACTER_SHEET_CONTRACT_VERSION = "canonical-sheet-v4-expression-panel";
// Real incident (2026-09-14, "FINAL CHARACTER REFERENCE POLISH"): the v2
// contract, even after trimming, still ran 1950-2270 chars unclamped for a
// real Mars character and relied on a blind slice() to fit — which cut mid-
// sentence into STYLE/OUTFIT and (for one live case) truncated a NEGATIVE
// line to "...not a futuristic 'cyborg me" without any indication anything
// was missing. Two changes here: (1) the contract itself is now far more
// compact (Part 4's professional-model-sheet language, no six/four-panel
// grid counting, action pose no longer requested), and (2) any remaining
// overflow drops WHOLE, LEAST-ESSENTIAL SECTIONS in the priority order the
// task specified (layout > identity > outfit > style > prohibitions) rather
// than ever slicing mid-sentence — see assembleWithinBudget below.
const KLING_SHEET_PROMPT_TARGET_MAX = 1650; // normal target ceiling (Part 3: "~1300-1650 normally")
const KLING_SHEET_PROMPT_HARD_MAX = 1900; // safety margin under Runware's verified 2000-char clamp
// Section-dropping IS deterministic whole-section removal, never a mid-
// string slice: try the fullest assembly first, then progressively drop the
// single least-essential piece (in the specified priority order) until the
// result fits — every step here removes an entire section/sentence.
function assembleWithinBudget(build: (drop: { prohibitions?: boolean; distinguishingFeatures?: boolean }) => string): string {
  // Part 7 of the 2026-09-14 fix: STYLE LOCK is no longer a droppable tier —
  // it moved to a first-class, always-included position right after the
  // layout contract. Only the generic forbidden-list tail and (as a last
  // resort) the identitySpec's own optional distinguishing-features line
  // remain droppable.
  const attempts = [
    {},
    { prohibitions: true },
    { prohibitions: true, distinguishingFeatures: true },
  ];
  let last = build({});
  for (const drop of attempts) {
    const candidate = build(drop);
    last = candidate;
    if (candidate.length <= KLING_SHEET_PROMPT_HARD_MAX) return candidate;
  }
  return last; // pathological case: even the barest assembly exceeds the hard max — return it as-is rather than slice mid-sentence
}
function characterSheetLayout(importance: string | undefined): string {
  // Item 4: front/side/back full-body + an action pose are now standard for
  // EVERY recurring/HERO character (previously action-pose was HERO-only) —
  // scene generation regularly needs a character mid-action, not just
  // standing neutrally, regardless of narrative importance. HERO keeps its
  // extra outfit/costume detail panel on top of this shared base.
  // 2026-09-22 real incidents from live Kling output: (1) two of the four
  // body panels came back as near-duplicate angles (two backs, no distinct
  // side view) — numbering the views and explicitly forbidding a repeated
  // angle targets that directly; (2) hair color and even illustration
  // technique (one panel monochrome/engraved, the rest flat color) drifted
  // between panels of the SAME sheet — "same colors throughout" alone
  // wasn't a strong enough anchor, so this now says so panel-by-panel and
  // names the specific things that must never vary; (3) a plural/role-
  // sounding entity name (e.g. "Geologists") got rendered as multiple
  // different people instead of one individual — an explicit "exactly ONE
  // person, never a group" instruction guards against that regardless of
  // how the entity happens to be named.
  const baseViews = "1) full-body front view, 2) strict side view, 3) full-body back view, 4) one action pose (4 distinct angles, never repeat one), plus a small 5-expression strip";
  const requiredViews = importance === "HERO" ? `${baseViews}, and one outfit/costume detail` : baseViews;
  // Item 4/5's own explicit target list, kept to ONE compact sentence — a
  // small strip (never 5 separate full panels) so richer expression
  // coverage doesn't turn the sheet noisy. "Neutral" doubles as the sheet's
  // own neutral portrait, so no separate face/neutral panel is needed.
  return `Professional 2D animation character reference sheet of exactly ONE person, never a group even if the name sounds plural. One landscape image, the SAME EXACT INDIVIDUAL every panel: ${requiredViews}. Expression strip: 5 small same-size head-and-shoulders portraits in one row: neutral, happy, concerned, focused, surprised or stressed; other views stay neutral. Every panel identical: same face, hair color, skin tone, outfit/colors, same illustration technique — never a different art style or a monochrome/sketch panel among colored ones. Plain warm off-white background, no environment, no story scene, no captions, no panel labels, no watermark. Compact layout, uncropped, no large blank regions.`;
}
// Part 7 of the 2026-09-14 "FINAL VISUAL WORLD POLISH" fix: the selected
// project style must be a first-class HARD input, compiled near the FRONT
// of the prompt (right after the layout contract, before any identity
// detail) — real evidence: some Kling outputs drifted slightly more
// realistic/smooth than the location references, which get the exact same
// styleSpec but via a different compile path. Built generically from the
// EXISTING StylePreset fields (summary + negativeConstraints) rather than a
// Classic-2D-Documentary-only special case, so every current and future
// preset gets the same hard lock automatically — no separate per-preset
// text to maintain.
export const STYLE_LOCK_CONTRACT_VERSION = "style-lock-v1";
export function compileStyleLock(styleSpec: typeof ZYVO_STYLE_SPEC): string {
  // Every preset's own `summary` already ends with its own "Not X, not Y"
  // clause (see STYLE_PRESETS above) — restating both that AND the full
  // negativeConstraints list would just duplicate 2-3 of the same
  // prohibitions inside an already-tight char budget. Keep only summary's
  // first sentence (the positive description) and let negativeConstraints
  // — the more complete, precisely-phrased list — own the "Do not" half.
  const positiveDescription = styleSpec.summary.split(/\.\s+/)[0];
  const negatives = (styleSpec.negativeConstraints ?? []).join("; ");
  return `STYLE LOCK — ${styleSpec.name}: ${positiveDescription}.${negatives ? ` Do not: ${negatives}.` : ""}`;
}
// 2026-09-19 "full style lock in every fresh generation" V1 fix — real
// finding: compileStyleLock above is deliberately compact (name + one
// sentence + negatives) for prompts that are ALREADY carrying a full
// [IDENTITY] breakdown of their own (character sheets). Scene GENERATE
// prompts (compileScenePrompt, sceneRenderPlan.ts) have no such identity
// block competing for budget and were using this same short form —
// concretely observed drifting into "black-and-white line art"/"technical
// schematic"/"infographic" renders because the model only ever saw one
// sentence of style guidance per scene. This extracts the SAME full-field
// breakdown already proven correct for character/location references
// (previously inlined only in compileReferencePrompt's generic branch, see
// the [STYLE LOCK] block below it) into one shared, reusable function so
// scene prompts get the complete compact style contract too — never a
// second, competing style-description system.
export function compileFullStyleLock(styleSpec: typeof ZYVO_STYLE_SPEC): string {
  // 2026-09-22 "cheap reference system" pass — real Atlantis incident:
  // observed output drifted semi-realistic / painterly / scene-based /
  // historical-poster-art despite this style lock, because nothing here
  // actually named those specific failure modes as forbidden. Tightened
  // toward the simplified, low-detail "documentary explainer" construction
  // the product actually wants — simple silhouettes and costume indication,
  // never a rich painterly illustration.
  if (styleSpec.id === "bold_cartoon_documentary") return [
    `STYLE LOCK — ${styleSpec.name}.`,
    "Linework: confident black outlines, minimal interior lines.",
    "Shading: flat cel, 1–2 tones, no gradients.",
    "Texture: subtle paper grain.",
    "Palette: 2–4 restrained hues plus neutrals, natural colors, never grayscale.",
    "Proportions: rounded simplified forms, clean silhouette, simple faces/costume.",
    "Lighting: directional, soft shadows.",
    "Perspective: coherent one/two-point, eye level.",
    "Do not: photorealism, painterly/semi-realistic, poster art, rich scenic detail, 3D, anime, preschool cartoon or corporate vector art.",
  ].join(" ");
  const lines = [
    `STYLE LOCK — ${styleSpec.name}`, styleSpec.summary,
    `Linework: ${styleSpec.linework}`, `Shading: ${styleSpec.shading}`, `Texture: ${styleSpec.texture}`,
    `Palette: ${styleSpec.palette} Color stays content-dependent; never force grayscale or copy an unrelated sample palette.`, `Proportions: ${styleSpec.bodyProportions}`,
  ];
  if (styleSpec.lighting) lines.push(`Lighting: ${styleSpec.lighting}`);
  if (styleSpec.perspective) lines.push(`Perspective: ${styleSpec.perspective}`);
  const negatives = (styleSpec.negativeConstraints ?? []).join("; ");
  if (negatives) lines.push(`Do not: ${negatives}.`);
  return lines.join(" ");
}
export function compileCanonicalCharacterSheet(args: {
  importance?: string;
  styleSpec: typeof ZYVO_STYLE_SPEC;
  entityName: string;
  canonicalSpec: string;
  identitySpec?: CharacterIdentitySpec | null;
  forbiddenElements?: string[];
}): string {
  const { importance, styleSpec, entityName, canonicalSpec, identitySpec, forbiddenElements } = args;
  // Real incident (2026-09-14): factualConstraints (Story/Research-authored
  // scene behavior — "visible performing scheduled maintenance", "operating
  // a scrubber") used to be injected into this prompt. Character Reference
  // Sheets are IDENTITY assets, not storyboard scenes — scene behavior
  // encouraged Kling to add props/actions/scene-like content that has no
  // business in a canonical identity reference. Deliberately NOT a
  // parameter of this function anymore; scene-specific behavior belongs to
  // Scene Generation later, never here.
  return assembleWithinBudget((drop) => {
    // STYLE LOCK now sits right after the contract, ahead of IDENTITY —
    // and, unlike the old [STYLE] section, is never dropped under budget
    // pressure. It is exactly as "first-class" as the layout contract
    // itself; only distinguishing-features and the generic forbidden-list
    // tail remain droppable when a verbose identitySpec runs long.
    // 2026-09-20 "keep the selected style locked" fix — real gap: the
    // character sheet (the single highest-detail-sensitivity Visual World
    // asset) was using compileStyleLock's deliberately COMPACT form (name +
    // one sentence + negatives only — no linework/shading/texture/palette/
    // lighting/perspective), while compileReferencePrompt's own generic
    // branch below already inlines that full field breakdown for every
    // other reference type. That made the character sheet the LEAST
    // style-specified asset instead of the most identity-critical one —
    // compileFullStyleLock is the exact shared compiler already built to
    // carry the complete style contract (see its own comment), so every
    // Kling reference (sheet, location, object, celestial, environment) now
    // authors from the SAME full style breakdown, never a bare style name.
    const lines: string[] = ["[CHARACTER SHEET CONTRACT]", characterSheetLayout(importance), "", "[STYLE LOCK]", compileFullStyleLock(styleSpec)];
    lines.push("", "[IDENTITY]", `${entityName}${identitySpec ? "" : `: ${canonicalSpec}`}`);
    if (identitySpec) {
      const o = identitySpec.outfitSpec;
      lines.push(
        `Age ${identitySpec.apparentAge}, ${identitySpec.sexPresentation} presentation.`,
        `Face: ${identitySpec.faceShape}, ${identitySpec.faceWidth} width, ${identitySpec.jawShape} jaw, ${identitySpec.chinShape} chin.`,
        `Nose: ${identitySpec.noseShape}, ${identitySpec.noseSize}. Eyes: ${identitySpec.eyeShape}, ${identitySpec.eyeSpacing} spacing. Eyebrows: ${identitySpec.eyebrowShape}. Ears: ${identitySpec.earShape}.`,
        `Hair: ${identitySpec.hairstyle}, ${identitySpec.hairColor}, hairline ${identitySpec.hairline}. Facial hair: ${identitySpec.facialHair}. Skin tone: ${identitySpec.skinTone}.`,
        `Build: ${identitySpec.heightImpression} height impression, ${identitySpec.shoulderWidth} shoulders, ${identitySpec.torsoBuild} torso, ${identitySpec.limbBuild} limbs.`,
        !drop.distinguishingFeatures && identitySpec.distinguishingFeatures?.length ? `Distinguishing features: ${identitySpec.distinguishingFeatures.join("; ")}.` : "",
      );
      lines.push("", "[OUTFIT]", `${o.baseGarment} in ${o.colors}. Collar: ${o.collar}. Sleeves: ${o.sleeves}. Pockets: ${o.pockets}. Belt: ${o.belt}. Shoes: ${o.shoes}. Accessories: ${o.accessories}. Patches: ${o.abstractPatches}.`);
    }
    // This compact core is never droppable: the dispatch validator checks
    // the same canonical negative contract for every asset class.
    lines.push("", "[CANONICAL REFERENCE NEGATIVE CONTRACT]", "NO collage or unrelated subjects. NO readable text, labels, logos or watermarks. NO narrative action or scenic environment.");
    if (!drop.prohibitions && forbiddenElements?.length) lines.push("Additional forbidden elements: " + forbiddenElements.join("; ") + ".");
    return lines.join("\n");
  });
}

const CHARACTER_VIEW_FRAMING: Record<string, string[]> = {
  front_full_body: [
    "CHARACTER_FRONT_FULL — one isolated full-body character, straight-on front view.",
    "Exactly one instance. Full body head to shoes, both feet visible, neutral standing pose, arms relaxed.",
    "Same exact identity, canonical outfit, proportions, colors and accessories as the three-quarter identity anchor.",
  ],
  front_full_body: [
    "CHARACTER_FRONT_FULL — one isolated full-body character, straight-on front view.",
    "Exactly one instance. Full body head to shoes, both feet visible, neutral standing pose, arms relaxed.",
    "Same exact identity, canonical outfit, proportions, colors and accessories as the three-quarter identity anchor.",
  ],
  // Component-based HERO pack's anchor — identical contract to
  // three_quarter_neutral below (same role, new taxonomy). identity_outfit_
  // side/back and face_side/back are Qwen geometry EDITS compiled by
  // compileGeometryEdit in referenceRendererPolicy.js, not here — this map
  // only covers independently-generated views. face_front is a
  // deterministic crop and silhouette_* are zero-cost adopts, so neither
  // ever reaches compileReferencePrompt in normal operation; face_front's
  // entry below exists only as a defensive fallback.
  identity_outfit_three_quarter: [
    "IDENTITY_OUTFIT_THREE_QUARTER — canonical identity anchor. This image answers ONE question: who is this person? It must NOT answer \"what does a finished scene look like\".",
    "FULL BODY, HEAD TO TOE. Both feet/boots must be visible inside the frame with generous margins above the head and below the feet.",
    "This is NOT a portrait, NOT a headshot, NOT a bust/waist-up crop, NOT cropped at the chest or belt. The entire standing figure — head, torso, both arms, both legs, both feet — must fit inside the frame.",
    "If in doubt, zoom the camera OUT further rather than closer — the whole body being small in frame is correct; the body being cropped at any point is wrong.",
    "True three-quarter orientation: body and face both turned approximately 45 degrees toward the camera — not fully frontal, not a side profile.",
    "Neutral standing pose, arms relaxed at sides. No crop, no props, no action pose.",
    "Full silhouette must read clearly at a glance.",
    "Consistent clothing exactly matching the canonical identity described above.",
    "This is a REFERENCE SHEET, not a scene. Absolutely NO story environment of any kind: no room, no habitat, no cockpit, no console, no workstation, no vehicle interior, no outdoor set, no props unless they are literally worn as part of the character's own clothing/equipment.",
  ],
  face_front: [
    "FACE_FRONT — head-and-shoulders identity reference, straight-on face.",
    "Both eyes visible. Neutral expression. Hair fully visible.",
    "Crop from upper chest upward — head and shoulders only, no torso, no hands, no full body.",
    "Plain warm-white background. No environment, no readable text.",
  ],
  three_quarter_neutral: [
    "CHARACTER_IDENTITY_3Q — canonical identity anchor. This image answers ONE question: who is this person? It must NOT answer \"what does a finished scene look like\".",
    "FULL BODY, HEAD TO TOE. Both feet/boots must be visible inside the frame with generous margins above the head and below the feet.",
    "This is NOT a portrait, NOT a headshot, NOT a bust/waist-up crop, NOT cropped at the chest or belt. The entire standing figure — head, torso, both arms, both legs, both feet — must fit inside the frame.",
    "If in doubt, zoom the camera OUT further rather than closer — the whole body being small in frame is correct; the body being cropped at any point is wrong.",
    "True three-quarter orientation: body and face both turned approximately 45 degrees toward the camera — not fully frontal, not a side profile.",
    "Neutral standing pose, arms relaxed at sides. No crop, no props, no action pose.",
    "Full silhouette must read clearly at a glance.",
    "Consistent clothing exactly matching the canonical identity described above.",
    "This is a REFERENCE SHEET, not a scene. Absolutely NO story environment of any kind: no room, no habitat, no cockpit, no console, no workstation, no vehicle interior, no outdoor set, no props unless they are literally worn as part of the character's own clothing/equipment.",
  ],
  // Real incident this hardens against: a derived Profile rendered as
  // essentially another 3/4/frontal shot — the identity-conditioning
  // reference image (see stageGenerating's dependency lookup) appears to
  // bias FLUX.2 Klein 9B KV toward reproducing the anchor's own camera
  // angle/composition, not just its identity, and this codebase has no
  // verified strength/weight parameter for Runware's referenceImages input
  // to dial that down (checked runware-image's actual task payload — it
  // passes inputs.referenceImages with no accompanying strength field, and
  // inventing one without documentation would violate this fix's own "do
  // not invent provider parameters" constraint). Prompt text is therefore
  // the ONLY verified lever available, so this block is deliberately
  // longer, more repetitive and more explicit than a normal instruction —
  // every sentence attacks the same failure mode from a different angle.
  profile: [
    "STRICT SIDE PROFILE CHARACTER REFERENCE.",
    "CHARACTER_PROFILE — the character's head and torso are rotated approximately 90 degrees from camera, NOT a three-quarter view, NOT a frontal view.",
    "Head and upper torso/shoulders only, eye-level camera.",
    "Show a clear nose and chin silhouette projecting from the face.",
    "Only ONE eye should be clearly visible — the far eye and far cheek must be fully hidden behind the head.",
    "The far cheek/ear must not read as a frontal pose — if both eyes or both cheeks are visible, this is WRONG.",
    "Do not use frontal orientation. Do not use three-quarter orientation. Do not reproduce the identity reference image's own camera angle — this view's camera angle must be genuinely different from the reference image, rotated a further ~45-90 degrees further round than a three-quarter view.",
    "Preserve the SAME character identity, hairstyle, facial structure, outfit, body proportions and illustration style from the identity reference — only the camera angle changes, nothing about the person themselves.",
    "Neutral reference composition. No environmental storytelling, no background scene, no props being used.",
  ],
  back: [
    "CHARACTER_BACK — rear view of the character, camera behind the subject.",
    "The character faces directly away from camera; the face must NOT be visible at all.",
    "Show the outfit's back silhouette (jacket/vest back panel, pack or gear worn on the back if part of the canonical identity) and the back of the hairstyle clearly.",
    "Do not reproduce the identity reference image's own camera angle — this is the opposite side of the character from the identity anchor.",
    "Do not use frontal, three-quarter or profile orientation — camera is directly behind the subject.",
    "Preserve the SAME character identity, hairstyle, outfit, body proportions and illustration style from the identity reference.",
    "Neutral reference composition. No environmental storytelling.",
  ],
  face_closeup: [
    "CHARACTER_FACE — tight front-facing head-and-shoulders portrait.",
    "Face occupies most of the frame; camera faces the subject directly (not three-quarter, not profile).",
    "Neutral expression, direct eye contact with the camera.",
    "NO full body, NO hands, NO torso below the shoulders visible in frame.",
    "Do not reproduce the identity reference image's own camera angle or crop — this is a genuinely tighter, more frontal framing than the identity anchor.",
    "Same exact identity as the canonical reference — same face shape, hair, skin tone and any distinguishing features.",
  ],
  expression_neutral: ["One isolated front-facing face close-up of the same exact character with a neutral expression. Head and shoulders only."],
  expression_happy: ["One isolated front-facing face close-up of the same exact character with a natural happy expression. Head and shoulders only."],
  expression_worried: ["One isolated front-facing face close-up of the same exact character with a worried expression. Head and shoulders only."],
  expression_shocked: ["One isolated front-facing face close-up of the same exact character with a shocked expression. Head and shoulders only."],
  expression_angry_focused: ["One isolated front-facing face close-up of the same exact character with an angry, focused expression. Head and shoulders only."],
  expression_neutral: ["One isolated front-facing face close-up of the same exact character with a neutral expression. Head and shoulders only."],
  expression_happy: ["One isolated front-facing face close-up of the same exact character with a natural happy expression. Head and shoulders only."],
  expression_worried: ["One isolated front-facing face close-up of the same exact character with a worried expression. Head and shoulders only."],
  expression_shocked: ["One isolated front-facing face close-up of the same exact character with a shocked expression. Head and shoulders only."],
  expression_angry_focused: ["One isolated front-facing face close-up of the same exact character with an angry, focused expression. Head and shoulders only."],
  outfit_detail: [
    "CHARACTER_OUTFIT_DETAIL — clothing and equipment reference, not a portrait.",
    "Show the character's typical outfit and recurring accessories clearly and legibly — fabric, layering, fasteners, tool/equipment attachments — at a scale where construction details actually read.",
    "The character's face may be partially out of frame or de-emphasized; the OUTFIT is the subject of this reference.",
    "Same exact outfit, colors, materials and accessories as the canonical identity — this documents the SAME clothing, not a new design.",
    "Avoid readable generated lettering on any patch, tag or panel — a blank or abstract/icon-only patch is fine, legible text is not.",
  ],
  action_pose: [
    "CHARACTER_ACTION_POSE — the character performing a characteristic action relevant to their role, full body visible.",
    "Same exact identity, outfit and proportions as the canonical identity — only the pose changes.",
    "Neutral, uncluttered background — the pose and silhouette are the subject, not a scene.",
  ],
};

function compileCharacterView(view: RequiredView): string[] {
  return CHARACTER_VIEW_FRAMING[view.angle] ?? [
    // Any future character angle not yet in the contract above still gets a
    // safe, explicit default rather than silently falling through to
    // nothing — never a bare "view.purpose" with no framing instruction.
    "Full body head to toe, fully inside the frame with generous margins. Neutral standing pose. No crop, no props.",
  ];
}

function compileLocationView(view: RequiredView): string[] {
  if (view.angle === "location_reference_board") {
    return [
      "One coordinated LOCATION REFERENCE BOARD for the same exact place — not unrelated locations.",
      "Include a wide establishing view, a medium spatial anchor, one key architectural/environment detail, and only when useful one alternate camera anchor. Every panel must preserve the same geography, materials, palette and landmarks.",
      "No people. No labels, captions, maps, legends, arrows or readable text. This is a reusable world sheet, never a finished story scene.",
    ];
  }
  return [
    `Camera anchor: ${view.angle.replace(/_/g, " ")} — ${view.purpose}.`,
    "A reusable empty animation set from this exact camera anchor. Show continuous floor, walls/terrain, ceiling or sky structure and fixed spatial landmarks in a coherent perspective from this specific angle.",
    "Preserve the canonical room/location layout exactly as established for this location — this must be recognizably the SAME place from a different angle, not a new location.",
    "NO recurring characters and no people of any kind, unless the location's own canonical spec explicitly requires one for scale — the location itself is the subject.",
  ];
}

function compileObjectView(view: RequiredView): string[] {
  return [
    `${view.angle.replace(/_/g, " ")} — ${view.purpose}.`,
    "Isolated or minimally contextualized — clear, unambiguous silhouette of the object or one coherent equipment system.",
    "Three-quarter / orthographic-ish angle that reveals the object's real form and proportions clearly, at a consistent, recognizable scale.",
    "A coherent equipment system may include only its essential functionally connected components, such as sensor plus console or towfish plus display. Keep them together as one system, not alternate products or a comparison layout.",
    "NO people, NO unrelated objects, NO unnecessary scenery — a contextual background is only acceptable when the object's relationship to its environment is itself important to the design, and even then keep the environment minimal and secondary to the object.",
  ];
}
// 2026-09-20 "entity-aware reference views" fix — a celestial body must
// never be described with object-framing language ("three-quarter /
// orthographic-ish hero angle" reads as meaningless for the Sun or Moon).
function compileCelestialView(view: RequiredView, entityName: string): string[] {
  const subject = /\bsun\b/i.test(entityName) ? "the Sun only" : /\bmoon\b/i.test(entityName) ? "the Moon only" : /\bearth\b/i.test(entityName) ? "Earth only" : `${entityName} only`;
  return [
    `${view.angle.replace(/_/g, " ")} — ${view.purpose}.`,
    `One subject: ${subject}. The canonical, immediately recognizable appearance of this celestial body alone.`,
    "Astronomically plausible scale, lighting and color for how this body actually appears.",
    "NO people, spacecraft, vehicles, unrelated planets, moons, orbit arrows, diagrams, labels, scale bars or explanatory callouts.",
  ];
}
// A plant/ecosystem reference is a specimen/environment shot, never a
// character portrait or turnaround sheet — see resolveEffectiveEntityCategory.
function compileEnvironmentView(view: RequiredView): string[] {
  return [
    `${view.angle.replace(/_/g, " ")} — ${view.purpose}.`,
    "A clean, representative specimen/environment view at a natural scale and density for what it depicts.",
    "NO people, NO character-style posing or expression, NO turnaround/multi-panel sheet layout.",
  ];
}

export function compileReferencePrompt(args: {
  styleSpec: typeof ZYVO_STYLE_SPEC;
  visualStyleNotes?: string;
  entityName: string;
  canonicalSpec: string;
  identitySpec?: CharacterIdentitySpec | null;
  view: RequiredView;
  factualConstraints?: string[];
  forbiddenElements?: string[];
}): string {
  const { styleSpec, visualStyleNotes, entityName, canonicalSpec, identitySpec, view, factualConstraints, forbiddenElements } = args;
  // Character Reference Sheets are IDENTITY assets, not storyboard scenes —
  // factualConstraints (Story/Research-authored scene behavior) is
  // deliberately NOT forwarded to compileCanonicalCharacterSheet (Part 2 of
  // the 2026-09-14 fix); it stays available here for the legacy
  // compileCharacterSheetPrompt/geometry branches below, which are history-
  // only and untouched by this change.
  if (view.referenceType === "character_reference" && view.angle === "character_reference_sheet") {
    return compileCanonicalCharacterSheet({ importance: view.importance, styleSpec, entityName, canonicalSpec, identitySpec, forbiddenElements });
  }
  if (view.referenceType === "character_reference" && SHEET_ROLE_SPECS[view.angle]) {
    return compileCharacterSheetPrompt({ styleSpec, entityName, canonicalSpec, identitySpec, view, factualConstraints, forbiddenElements });
  }
  if (view.referenceType === "style_reference") {
    // 2026-09-22 "cheap reference system" pass — real Atlantis incident:
    // this branch used a completely different section-heading vocabulary
    // ("[DO NOT]") than validateCanonicalReferencePrompt requires
    // ("[CANONICAL REFERENCE NEGATIVE CONTRACT]", literal "NO collage" /
    // "NO readable text" / "NO narrative action") — meaning the style
    // anchor, the single simplest asset in the whole system, failed
    // validateCanonicalReferencePrompt's hard contract check on every
    // single attempt, 100% of the time, for every project, and was never
    // even dispatched to a provider. Also simplified per explicit product
    // direction: one character and (optionally) one simple prop on a
    // plain light background — never a small environment/scene fragment,
    // which only invited exactly the "poster art" / scenic drift this
    // asset exists to prevent.
    return [
      "[STYLE-ONLY REFERENCE]",
      "Create ONE extremely simple sample frame whose only purpose is to lock the selected art direction for later scenes — not a finished illustration, not a scene, not a poster.",
      "Do not depict the project's topic, named characters, factual content, diagrams, maps, or a reference-sheet/grid layout.",
      "",
      "[STYLE LOCK]",
      compileFullStyleLock(styleSpec),
      "",
      "[CONTENT]",
      "Exactly one generic, unnamed adult figure, simplified and schematic — a simple documentary-cartoon construction, not a detailed portrait. Optionally one small, simple, ordinary prop held or beside the figure if it helps show how objects render in this style. Nothing else: no second figure, no environment, no room, no landscape, no set dressing.",
      "",
      "[BACKGROUND]",
      "Plain flat white or very light neutral background. No environment, no horizon, no room, no scenery of any kind.",
      "",
      "[CANONICAL REFERENCE NEGATIVE CONTRACT]",
      "- NO infographic layout, explainer board, presentation board, educational poster, diagram, arrows, callouts or annotations",
      "- NO collage, split screen, contact sheet, multi-panel layout, duplicate subject, repeated copies or alternate views in one image",
      "- NO readable text, labels, captions, legends, logos, UI, numbers, symbols posing as text or watermarks",
      "- NO narrative action, before/after comparison, process sequence or finished story scene",
      "- NO environment, scenery, background set, or historical/poster-style composition",
      "- NO photorealism, painterly rendering, semi-realistic shading, 3D, anime, engraving or corporate vector icon style",
    ].join("\n");
  }
  if (view.referenceType === "diagram_style_reference") {
    return [
      "[DIAGRAM STYLE REFERENCE]",
      "Create one extremely simple visual-language sample for later maps, diagrams and overlays. This is a style specimen, not an information graphic and not a finished scene.",
      "",
      "[STYLE LOCK]",
      compileFullStyleLock(styleSpec),
      "",
      "[CONTENT]",
      "On a plain white or very light neutral background, show only three or four generic geometric example shapes connected by one clean line. Use flat color, bold clean outlines and minimal shading. No real-world subject matter and no project facts.",
      "",
      "[CANONICAL REFERENCE NEGATIVE CONTRACT]",
      "- NO readable text, letters, labels, captions, legends, numbers, logos, UI or watermarks",
      "- NO collage, split screen, contact sheet or unrelated alternate-view panels",
      "- NO narrative action, before/after comparison, process sequence or finished story scene",
      "- NO map names, timelines, charts, axes, measurements, arrows with labels, callouts or explanatory copy",
      "- NO poster, presentation board, educational wall chart, multi-section infographic or dense layout",
      "- NO people, scenery, narrative action, photorealism, painterly rendering or 3D",
    ].join("\n");
  }
  const lines: string[] = [];

  lines.push("[STYLE LOCK]", styleSpec.summary, `Linework: ${styleSpec.linework}`, `Shading: ${styleSpec.shading}`, `Texture: ${styleSpec.texture}`, `Palette guidance: ${styleSpec.palette}`, "Color policy: use subject- and setting-appropriate natural colors. Do not force grayscale or copy colors from an unrelated style sample.", `Lighting: ${styleSpec.lighting}`, `Perspective: ${styleSpec.perspective}`);
  // Real, directly observed contamination source (Mars protagonist Identity
  // Master validation): visualStyleNotes is a free-text "mood/palette
  // inflection" the Reference Planner writes ONCE for the whole project,
  // meant to describe finished SCENES (e.g. "warm interior lighting for
  // habitat scenes") — legitimate guidance for a LOCATION reference, but it
  // has no character-identity purpose and directly competes with a
  // character reference's own isolation requirement below ("no room, no
  // habitat" loses to an earlier, more prominent "habitat scenes... interior
  // lighting" line in the same [STYLE LOCK] block). Character/object
  // identity references never include it; only location references (whose
  // whole point IS the scene) do.
  if (visualStyleNotes && view.referenceType === "location_reference") lines.push(`Project-specific mood: ${visualStyleNotes}`);

  // Structured CharacterIdentitySpec (when present) is the source of truth
  // for [ENTITY IDENTITY] — it has no field for occupation/environment, so
  // there is nothing here for a workplace/setting description to hide in.
  // canonicalSpec is appended alongside it only as brief supporting texture
  // (e.g. narrative context a factual constraint might reference), never as
  // the primary appearance description once a structured spec exists.
  lines.push("", "[ENTITY IDENTITY]", `${entityName}${identitySpec ? "" : `: ${canonicalSpec}`}`);
  if (identitySpec) lines.push(...renderIdentitySpecBlock(identitySpec));
  // OUTFIT/MATERIAL is intentionally folded into ENTITY IDENTITY for V1 —
  // canonicalSpec already describes typical attire as part of appearance.
  // CharacterIdentity/OutfitState/PhysicalState stay conceptually separate
  // in the data model (Part 5 item 16) even though V1's single reference
  // image visually bakes in the primary outfit. The Reference Planner is
  // instructed not to describe environment/location here (see
  // REFERENCE_PLANNER_INSTRUCTIONS) — CHARACTER identity must stay decoupled
  // from LOCATION identity; this prompt's own [BACKGROUND] block below is
  // the only place background is specified, and it deliberately overrides
  // anything canonicalSpec might still say.

  lines.push(
    "",
    "[REQUESTED VIEW]",
    ...(view.referenceType === "character_reference"
      ? compileCharacterView(view)
      : view.referenceType === "location_reference"
      ? compileLocationView(view)
      : view.referenceType === "celestial_reference"
      ? compileCelestialView(view, entityName)
      : view.referenceType === "environment_reference"
      ? compileEnvironmentView(view)
      : compileObjectView(view))
  );

  lines.push("", "[PROPORTION / SHAPE RULES]", styleSpec.bodyProportions, styleSpec.faceConstruction);

  // Scene actions and exact wording remain in scene/overlay metadata; they
  // are intentionally excluded from reusable canonical image prompts.

  lines.push(
    "",
    "[BACKGROUND / CANONICAL ASSET]",
    view.referenceType === "location_reference"
      ? "A reusable empty animation set from the requested storyboard camera anchor. Show continuous floor, walls, ceiling structure and fixed spatial landmarks in a coherent wide perspective. Preserve the canonical room layout. No people, no cutaway or floating room, no studio background."
      : "Plain, seamless, muted neutral studio background ONLY — no room, no furniture, no environment of any kind, no walls, no floor detail, no location-specific geometry. CHARACTER and OBJECT identity must be established completely independent of any location — locations are established separately by their own location references. Clear subject silhouette, full subject visible with margins. No scenic distractions or dramatic cropping."
  );

  const forbidden = [
    ...styleSpec.negativeConstraints,
    ...(forbiddenElements ?? []),
    "readable text", "letters", "numbers", "names", "identification badge lettering", "logo typography", "logos", "badges containing lettering", "signage", "numerical displays", "labels", "watermark", "generated UI copy", "captions", "letters or numbers of any kind rendered into the image",
  ];
  const coordinatedBoard = view.referenceType === "location_reference" && view.angle === "location_reference_board";
  lines.push("", "[CANONICAL REFERENCE NEGATIVE CONTRACT]",
    "- NO infographic layout, explainer board, presentation board, educational poster, diagram, arrows, callouts or annotations",
    coordinatedBoard
      ? "- NO collage of unrelated subjects or places; the allowed multi-panel layout must show only coordinated views of this same exact location"
      : "- NO collage, split screen, contact sheet, multi-panel layout, duplicate subject, repeated copies or alternate views in one image",
    "- NO readable text, labels, captions, legends, logos, UI, numbers, symbols posing as text or watermarks",
    "- NO narrative action, before/after comparison, process sequence or finished story scene",
    ...forbidden.map((f) => `- ${f}`));
  if (view.referenceType === "character_reference" || view.referenceType === "object_reference") {
    lines.push("If the costume or design logically includes a badge, patch, tag or panel, render it as a BLANK or abstract/icon-only graphic — never with legible lettering or numbers of any kind.");
  }

  return lines.join("\n");
}

// Deterministic safety net (Part 4): checks the ACTUAL COMPILED prompt
// contains the framing phrases its own role contract requires, so "Face"
// can never silently compile into a generic full-body prompt again — e.g.
// if a future edit to compileReferencePrompt accidentally drops a role's
// branch. Throws rather than returning a boolean: a contract violation here
// means the prompt about to be dispatched is definitely wrong, and the
// caller should fail the stage rather than spend a provider call on it.
export function validateCompiledReferencePrompt(view: RequiredView, prompt: string): void {
  validateCanonicalReferencePrompt(prompt, view.angle);
  if (view.referenceType !== "character_reference") return;
  const role = CHARACTER_REFERENCE_ROLES[view.angle as keyof typeof CHARACTER_REFERENCE_ROLES]?.role;
  if (role === "CHARACTER_FACE") {
    if (!/face occupies most of the frame/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing CHARACTER_FACE framing`);
    if (/full body head to toe/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} compiled a full-body instruction`);
  }
  if (role === "CHARACTER_PROFILE") {
    if (!/strict side profile character reference/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing CHARACTER_PROFILE framing`);
    if (!/only one eye should be clearly visible/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing single-eye framing`);
    if (!/do not reproduce the identity reference image.s own camera angle/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing anti-anchor-copy instruction`);
    if (/true three-quarter orientation/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} compiled a three-quarter instruction`);
  }
  if (role === "CHARACTER_BACK") {
    if (!/rear view of the character/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing CHARACTER_BACK framing`);
    if (!/face must not be visible at all/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing face-hidden requirement`);
  }
  if (role === "CHARACTER_OUTFIT_DETAIL") {
    if (!/clothing and equipment reference/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing CHARACTER_OUTFIT_DETAIL framing`);
  }
  if (role === "CHARACTER_IDENTITY_3Q" || role === "IDENTITY_OUTFIT_THREE_QUARTER") {
    if (!/true three-quarter orientation/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing identity anchor framing`);
    if (!/no story environment of any kind/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing isolation-from-environment instruction`);
    if (!/not a portrait, not a headshot/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing anti-portrait-crop instruction`);
  }
  if (role === "CHARACTER_IDENTITY_OUTFIT_SHEET") {
    if (!/exactly three full-body views of the same exact character/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing model-sheet three-view instruction`);
    if (!/not three different people/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing same-identity-across-views instruction`);
    if (!/head to shoes/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing full-body instruction`);
    if (!/three-quarter front view/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing three-quarter LEFT view instruction`);
    if (!/no text or labels anywhere/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing no-generated-labels instruction`);
  }
  if (role === "CHARACTER_FACE_SHEET") {
    if (!/exactly three head-and-shoulders views of the same exact character/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing model-sheet three-view instruction`);
    if (!/no full body/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing anti-full-body instruction`);
    if (!/strict 90-degree side profile of the face/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing profile-cell instruction`);
    if (/head to shoes/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} compiled a full-body instruction`);
  }
  if (role === "CHARACTER_PROFILE_SILHOUETTE_SHEET") {
    if (!/exactly three full-body views of the same exact character/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing model-sheet three-view instruction`);
    if (!/nothing cropped/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing anti-crop instruction`);
    if (!/head to shoes/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing full-body instruction`);
    if (!/straight front view \(not three-quarter\)/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing straight-front LEFT view instruction (must differ from the Identity/Outfit sheet's three-quarter LEFT view)`);
  }
  if (role === "CHARACTER_REFERENCE_SHEET") {
    // Part 4 of the 2026-09-14 "FINAL CHARACTER REFERENCE POLISH" fix: the
    // contract no longer counts panels ("six/four distinct views") or
    // requires an action pose at all — it lists required views by name.
    // Checks updated to match; action-pose is deliberately NOT checked for
    // (its absence must never be treated as a contract violation).
    if (!/no story scene/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing no-story-scene instruction`);
    if (!/full-body front view/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing front view instruction`);
    if (!/side view/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing side view instruction`);
    if (!/full-body back view/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing back view instruction`);
    // 2026-09-19 "richer expression coverage" pass (item 4): the standalone
    // face close-up panel was replaced by a 5-expression headshot strip,
    // whose "neutral" portrait now serves the same identity-reference role
    // a dedicated face close-up used to. Check for the strip instead.
    if (!/expression strip/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing expression-strip instruction`);
    if (view.importance === "HERO") {
      if (!/outfit\/costume detail/i.test(prompt)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${view.angle} missing outfit-detail panel`);
    }
  }
}

export function validateCanonicalReferencePrompt(prompt: string, angle = "unknown"): void {
  for (const required of ["[STYLE LOCK]", "[CANONICAL REFERENCE NEGATIVE CONTRACT]", "NO collage", "NO readable text", "NO narrative action"]) {
    if (!prompt.includes(required)) throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${angle} missing ${required}`);
  }
  const positive = prompt.split("[CANONICAL REFERENCE NEGATIVE CONTRACT]")[0];
  if (/\b(?:include|write|display|render)\s+(?:the\s+)?(?:text|label|caption|wording|letters?|numbers?)\b/i.test(positive)) {
    throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${angle} requests provider-rendered text`);
  }
  if (/\b(?:infographic|explainer board|presentation board|educational poster|step-by-step sequence)\b/i.test(positive)) {
    throw new Error(`REFERENCE_CONTRACT_VIOLATION: ${angle} requests narrative/explainer composition`);
  }
}

// Structural QA expectations (Part 17) — no paid AI QA pass yet, just a
// clean, deterministic place to record what a reference SHOULD look like so
// an automated visual QA pass can check against it later. Never derived
// from the model's own output — entirely a function of the view/category,
// computed the same way requiredViews itself is.
export function deriveReferenceQAExpectations(view: RequiredView, identityAnchorAssetId?: string | null): Record<string, unknown> {
  if (view.referenceType === "character_reference") {
    const role = CHARACTER_REFERENCE_ROLES[view.angle as keyof typeof CHARACTER_REFERENCE_ROLES]?.role ?? view.angle;
    return {
      expectedFraming: role === "CHARACTER_FACE" || role.startsWith("CHARACTER_EXPRESSION_") ? "head_and_shoulders" : role === "CHARACTER_FACE_SHEET" ? "head_and_shoulders_three_views" : role === "CHARACTER_PROFILE" || role === "CHARACTER_BACK" ? "full_body" : role === "CHARACTER_IDENTITY_OUTFIT_SHEET" || role === "CHARACTER_PROFILE_SILHOUETTE_SHEET" ? "full_body_three_views" : "full_body",
      expectedOrientation: role === "CHARACTER_PROFILE" ? "side_profile_90deg" : role === "CHARACTER_BACK" ? "rear_180deg" : role === "CHARACTER_FRONT_FULL" || role === "CHARACTER_FACE" || role.startsWith("CHARACTER_EXPRESSION_") ? "frontal" : role === "CHARACTER_IDENTITY_OUTFIT_SHEET" || role === "CHARACTER_FACE_SHEET" || role === "CHARACTER_PROFILE_SILHOUETTE_SHEET" ? "front_side_back_triptych" : "three_quarter_45deg",
      expectedBackgroundMode: "neutral_studio",
      allowReadableText: false,
      profileExpected: view.angle === "profile",
      rearExpected: view.angle === "back",
      faceCropExpected: view.angle === "face_closeup",
      isMultiViewSheet: ["CHARACTER_IDENTITY_OUTFIT_SHEET", "CHARACTER_FACE_SHEET", "CHARACTER_PROFILE_SILHOUETTE_SHEET", "CHARACTER_REFERENCE_SHEET"].includes(role),
      expectedViewCount: role === "CHARACTER_REFERENCE_SHEET" ? 9 : ["CHARACTER_IDENTITY_OUTFIT_SHEET", "CHARACTER_FACE_SHEET", "CHARACTER_PROFILE_SILHOUETTE_SHEET"].includes(role) ? 3 : 1,
      expectedSubjectCount: 1,
      collageAllowed: false,
      infographicAllowed: false,
      canonicalReuseChecks: ["identity", "outfit", "orientation", "style"],
      neutralBackgroundExpected: true,
      generatedTextForbidden: true,
      generatedTextIsFailure: true,
      automatedVisionPerformed: false,
      identityAnchorId: identityAnchorAssetId ?? null,
    };
  }
  if (view.referenceType === "location_reference") {
    const isBoard = view.angle === "location_reference_board";
    return { expectedCameraAnchor: view.angle, referenceFormat: isBoard ? "LOCATION_BOARD" : "LOCATION_WIDE", charactersAllowed: false, allowReadableText: false, expectedSubjectCount: 1, coherentLocationBoardAllowed: isBoard, expectedViewCount: isBoard ? 3 : 1, collageAllowed: isBoard, infographicAllowed: false, canonicalReuseChecks: ["same_location", "layout", "landmarks", "materials", "style"] };
  }
  if (view.referenceType === "style_reference" || view.referenceType === "diagram_style_reference") {
    return { assetClass: view.referenceType === "style_reference" ? "STYLE_ANCHOR" : "DIAGRAM_STYLE_SHEET", isolationPreferred: true, allowReadableText: false, expectedSubjectCount: 1, collageAllowed: false, infographicAllowed: false, neutralBackgroundExpected: true, canonicalReuseChecks: ["style", "simplicity", "background"] };
  }
  if (view.referenceType === "object_reference") {
    return { isolationPreferred: true, allowReadableText: false, expectedSubjectCount: 1, coherentSystemAllowed: true, collageAllowed: false, infographicAllowed: false, canonicalReuseChecks: ["subject_identity", "functional_relationship", "shape", "style"] };
  }
  return { isolationPreferred: true, allowReadableText: false, expectedSubjectCount: 1, collageAllowed: false, infographicAllowed: false, canonicalReuseChecks: ["subject_identity", "shape", "style"] };
}

/* ============================ Scene-reference selection (Part 9, planning only) ============================ */
// Scene Generation does not exist yet — this is deliberately just the
// SELECTION policy for when it does, so a future scene-generation call
// never blindly feeds a character's entire reference pack for every shot.
// `orientationHint`, when a future storyboard schema carries one (e.g. a
// VisualBeat annotated "this shot shows the character from behind"), takes
// priority; failing that, this falls back to a conservative default from
// the beat's own existing shotSize/visualType fields, which is honest about
// having much weaker signal than a real orientation hint would give.
// Always includes the IDENTITY_3Q anchor — every other selected role is a
// SUPPLEMENT to it, never a replacement, since it's what all the other
// views were conditioned on in the first place.
export function resolveSceneReferenceRoles(beat: { shotSize?: string; visualType?: string }, orientationHint?: "profile" | "back" | "face" | null): string[] {
  const roles = ["three_quarter_neutral"];
  if (orientationHint === "profile") roles.push("profile");
  else if (orientationHint === "back") roles.push("back");
  else if (orientationHint === "face") roles.push("face_closeup");
  else if (beat.shotSize === "DETAIL" || beat.shotSize === "CLOSE") roles.push("face_closeup");
  // WIDE/MEDIUM/INSERT with no explicit orientation hint: IDENTITY_3Q alone
  // is the deliberate default — a general medium/wide character scene
  // doesn't need a specific alternate angle conditioning it.
  return roles;
}

/* ============================ Self-heal: missing required-view rows (reliability pass) ============================ */
// Real incident: e_protagonist's Identity/Outfit sheet got approved, but
// Face/Profile sheets had literally never been inserted as rows (a
// taxonomy change left them missing) — the frontend synthesized "Planned"
// placeholders forever, and nothing was ever wrong with claim eligibility;
// there was simply no row to claim. Once Build has run, every selected
// required view for every entity must have a real row so it can actually
// progress through WAITING_FOR_DEPENDENCY -> PENDING -> ... ("Planned"
// should only mean "the user has not requested generation yet" — Part 5).
// Pure and side-effect-free so it's independently testable; stageGenerating
// is the only caller that actually inserts the rows this returns.
export function findMissingRequiredViewRows(entities: { entityId: string; requiredViews: RequiredView[] }[], currentAssets: { entity_id: string; angle_or_view: string }[], excludedViewKeys: Set<string>): { entity_id: string; reference_type: string; angle_or_view: string }[] {
  const missing: { entity_id: string; reference_type: string; angle_or_view: string }[] = [];
  for (const entity of entities ?? []) {
    for (const view of entity.requiredViews ?? []) {
      if (excludedViewKeys.has(`${entity.entityId}:${view.angle}`)) continue;
      const exists = currentAssets.some((a) => a.entity_id === entity.entityId && a.angle_or_view === view.angle);
      if (!exists) missing.push({ entity_id: entity.entityId, reference_type: view.referenceType, angle_or_view: view.angle });
    }
  }
  return missing;
}
