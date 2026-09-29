// deno-lint-ignore-file no-explicit-any
// stickman/productionBible.ts — 2026-10-02 "Production Bible" pass.
//
// THE EPISODE LAYER, merged deterministically with the RECIPE layer
// (styleContract.ts). One LLM call authors ONLY what genuinely varies per
// episode (Section 4's own example: "early-human survival" gets a warm-brown
// hero in a hide wrap under a dusk palette; a modern-teenager video gets a
// hoodie and a blue/green palette — same recipe, different Bible). Every
// universal trait (flat 2D, no shading, no gradients, forbidden style list,
// text-policy defaults, graphic/camera grammar) is NEVER re-authored here —
// it is copied verbatim from STICKMAN_DOODLE_EXPLAINER_V1 by
// mergeDraftIntoBible, so no two episodes of the same recipe can ever drift
// on a trait that was supposed to be universal. This is the same
// "LLM decides creative intent once, code injects it verbatim forever after"
// principle the whole Stickman architecture is built on (Section 5).
//
// PROTAGONIST DETECTION IS SEMANTIC, NOT KEYWORD-BASED: the LLM is asked to
// reason explicitly (continuityModeReasoning) about the narrative's OWN
// structure — is there a persistent "you"/named individual the story
// follows, or is the subject a concept/mechanism/non-human entity, or an
// ensemble, or nothing recurring at all? No entity-frequency heuristic is
// used anywhere in this file. A recurring NAME (e.g. "Plato" mentioned
// several times as a source) does not by itself make a protagonist — the
// model is explicitly instructed on this exact case.

import { STICKMAN_DOODLE_EXPLAINER_V1, type StickmanRecipeStyleContract } from "./styleContract.ts";
import { GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M } from "../../../../src/lib/longFormPipelineConstants.ts";
import { youContexts, viewerEra } from "./viewerEra.ts";

/* ============================ Final, frozen Production Bible ============================ */
export type ContinuityMode = "HERO" | "ENSEMBLE" | "SUBJECT" | "NONE";
export type ColorApproach = "FULL_COLOR" | "LIMITED_PALETTE" | "MONOCHROME";

export type StyleContract = {
  medium: string; illustrationStyle: string; lineLanguage: string; shapeLanguage: string; detailLevel: string;
  shadingPolicy: string; texturePolicy: string; dimensionality: string; realismLevel: string; backgroundStrategy: string;
  colorStrategy: string; lightingStrategy: string; // the only two episode-specialized fields; everything else above is recipe-verbatim
  forbiddenStyleTraits: string[];
};

export type PaletteContract = {
  primaryColors: string[]; supportingColors: string[]; environmentPaletteRules: string; contrastRules: string;
  colorApproach: ColorApproach; monochromeJustification: string | null;
};

export type HeroContract = {
  exists: boolean;
  subjectType: "human" | "animal" | "object_character" | "celestial" | "machine" | "none";
  semanticIdentity: string; canonicalAppearance: string; headFaceConstruction: string; bodyConstruction: string;
  skinTone: string; hair: string; outfit: string; accessories: string[]; persistentIdentifyingFeatures: string[];
  bodyProportions: string; emotionalExpressionLanguage: string; forbiddenMutations: string[];
  reasoning: string; // why this episode does/doesn't have a protagonist — always populated, even when exists:false
};

export type RecurringCharacterContract = {
  identity?: StickmanIdentity;
  id: string; role: string; canonicalAppearance: string; identifyingFeatures: string[]; appearsForNarrativeReason: string;
};

// Phase 2a-fix — generic people the script keeps drawing on ("a Viking
// warrior", "an archaeologist", the viewer's own avatar for "you" lines).
// Not protagonists and not named recurring characters, but the Beat Director
// needs a stable id and one locked drawing for each — otherwise a script full
// of people produced a bible with zero cast.
export type RoleArchetypeContract = { id: string; role: string; canonicalAppearance: string; usedFor: string; identity?: StickmanIdentity; outfitVariants?: { name: string; identity: StickmanIdentity }[] };

// Phase 3 — structured canonical fields the prompt compiler inserts verbatim
// (promptCompiler.ts). Presence variants (full / hands / back / tiny) are
// derived in code from these fields; outfit changes are separate identities.
export type StickmanIdentity = { displayName: string; skinTone: string; faceMarks: string; hair: string; outfit: string; outfitShort: string; sleeves: string; build: string; signature: string };
export type SettingBlock = { family: string; name: string; variants: { name: string; background: string; midground: string; foreground: string; palette: string; signatureObjects: string; lighting: string }[] };

export type WorldContract = {
  settingFamilies: string[]; architecture: string; geography: string; era: string;
  recurringEnvironmentConstruction: string; environmentalColorRules: string; weatherTimeConventions: string | null;
  historicalScientificConstraints: string[];
  settingBlocks?: SettingBlock[];
};

export type ObjectLanguageEntry = { id: string; canonicalDescription: string; whyRecurring: string; promptBlock?: string };

export type GraphicLanguageContract = {
  backgroundBehavior: string; lineStyle: string; colorUse: string; arrowsConnectors: string;
  diagramConventions: string; comparisonLayouts: string; timelineConventions: string; mapConventions: string;
  symbolicMetaphorLanguage: string; characterUseInsideGraphics: string; whitespaceBehavior: string; overlayTextBehavior: string;
};

export type CameraLanguageContract = {
  allowedShotFamilies: string[]; framingConventions: string; visualHierarchyRules: string;
  simplicityReadabilityRules: string; whenEstablishingVsCloseupVsDiagram: string;
};

export type TextPolicyContract = { providerGeneratedTextDefault: "OFF"; exactTextHandledDownstream: true; exceptionsPolicy: string };

export type ContinuityRulesContract = { neverDrift: string[]; allowedToVary: string[]; episodeWideConsistencyRules: string[] };

export type StickmanProductionBible = {
  productionBibleVersion: number;
  recipeId: string;
  recipeVersion: string;
  visualPremise: string;
  visualTone: string;
  styleContract: StyleContract;
  palette: PaletteContract;
  continuityMode: ContinuityMode;
  hero: HeroContract;
  recurringCharacters: RecurringCharacterContract[];
  roleArchetypes: RoleArchetypeContract[];
  world: WorldContract;
  objectLanguage: ObjectLanguageEntry[];
  graphicLanguage: GraphicLanguageContract;
  cameraLanguage: CameraLanguageContract;
  textPolicy: TextPolicyContract;
  continuityRules: ContinuityRulesContract;
  factualVisualConstraints: string[];
  negativeRules: string[];
  // Lineage (Section 7) — every downstream artifact must be able to answer
  // "which exact configuration produced me."
  projectId: string;
  generationProfileId: string;
  scriptVersionId: string;
};

/* ============================ LLM draft schema (episode-specific authoring only) ============================ */
const NO_IDS = "Plain words and color NAMES only — no ids, no hex codes, no references to other entries ('see…', 'same as…').";
const STICKMAN_IDENTITY_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["displayName", "skinTone", "faceMarks", "hair", "outfit", "outfitShort", "sleeves", "build", "signature"],
  description: `The canonical stickman identity, inserted word-for-word into every image prompt this person appears in. ${NO_IDS}`,
  properties: {
    displayName: { type: "string", description: "How a prompt names this person, e.g. 'A Viking warrior', 'The viewer as a Viking raider'." },
    skinTone: { type: "string", description: "Color of the circle head, e.g. 'light warm beige'." },
    faceMarks: { type: "string", description: "Empty string, or glasses when part of the identity (e.g. 'small rectangular black glasses'). No beards, mustaches or other facial detail." },
    hair: { type: "string", description: "e.g. 'short-cropped dark brown hair'." },
    outfit: { type: "string", description: "Clothing as a flat colored SHAPE on the torso only, e.g. 'a muted ochre tunic shape on the torso with a dark brown belt line, and small dark grey rounded feet'. Arms and legs are ALWAYS thin black stick lines: never trousers, pants, long sleeves or knee boots." },
    outfitShort: { type: "string", description: "The outfit in a few words, for tiny/back views." },
    sleeves: { type: "string", description: "Leave empty: arms are thin stick lines in this style (kept for compatibility)." },
    build: { type: "string", description: "e.g. 'stocky adult proportions'." },
    signature: { type: "string", description: "The accessory/prop they carry, e.g. 'a round wooden shield and a short axe'." },
  },
};
const RECURRING_CHARACTER_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "role", "canonicalAppearance", "identifyingFeatures", "appearsForNarrativeReason", "identity"],
  properties: {
    identity: STICKMAN_IDENTITY_SCHEMA,
    id: { type: "string", description: "Short internal slug, e.g. 'elder', 'coworker' — never shown to a user or a provider." },
    role: { type: "string", description: "Plain-language narrative role, e.g. 'the protagonist's skeptical coworker'." },
    canonicalAppearance: { type: "string", description: "The FULL canonical prose description for this character, to be inserted verbatim wherever they appear — never re-authored per beat later." },
    identifyingFeatures: { type: "array", items: { type: "string" }, maxItems: 5 },
    appearsForNarrativeReason: { type: "string", description: "Why this specific character earns a locked identity contract — a real narrative reason, never just 'mentioned several times'." },
  },
};
const SETTING_BLOCK_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["family", "name", "variants"],
  properties: {
    family: { type: "string", description: "Exactly one of world.settingFamilies." },
    name: { type: "string", description: `How a prompt names the place, e.g. 'a museum gallery'. ${NO_IDS}` },
    variants: {
      type: "array", minItems: 1, maxItems: 3,
      description: "A FULL block per variant (first one named 'default'; others e.g. 'night', 'backstage') — never 'same but…'.",
      items: {
        type: "object", additionalProperties: false,
        required: ["name", "background", "midground", "foreground", "palette", "signatureObjects", "lighting"],
        properties: {
          name: { type: "string" }, background: { type: "string" }, midground: { type: "string" }, foreground: { type: "string" },
          palette: { type: "string", description: "3-4 flat color names." }, signatureObjects: { type: "string" }, lighting: { type: "string" },
        },
      },
    },
  },
};
const ROLE_ARCHETYPE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "role", "canonicalAppearance", "usedFor", "identity", "outfitVariants"],
  properties: {
    identity: STICKMAN_IDENTITY_SCHEMA,
    outfitVariants: {
      type: "array", maxItems: 2,
      description: "Only when the script shows this person in a clearly different outfit (e.g. the viewer wearing the myth's horned helmet in the cold open). Each is a FULL identity, never 'same but…'. Empty array otherwise.",
      items: { type: "object", additionalProperties: false, required: ["name", "identity"], properties: { name: { type: "string", description: "Short label, e.g. 'horned helmet'." }, identity: STICKMAN_IDENTITY_SCHEMA } },
    },
    id: { type: "string", description: "Short slug, e.g. 'viewer_viking', 'viewer_modern', 'viking_warrior', 'archaeologist'. Viewer avatars are 'viewer_<era or context>' (or exactly 'viewer' when every 'you' line shares one context)." },
    role: { type: "string", description: "Plain role, e.g. 'the viewer (second-person avatar)', 'a Viking warrior'." },
    canonicalAppearance: { type: "string", description: "FULL canonical stickman description, self-sufficient, inserted verbatim wherever this archetype appears." },
    usedFor: { type: "string", description: "Which lines/moments of the script draw on this archetype." },
  },
};
const OBJECT_LANGUAGE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "canonicalDescription", "whyRecurring", "promptBlock"],
  properties: {
    id: { type: "string" },
    canonicalDescription: { type: "string", description: "Full canonical prose for this object, inserted verbatim wherever it appears." },
    promptBlock: { type: "string", description: `ONE self-contained sentence naming the object and its look, inserted word-for-word into image prompts, e.g. 'The Gjermundbu helmet: a rounded dull-grey iron dome helmet with a goggle-shaped iron eye-and-nose guard and no horns.' ${NO_IDS}` },
    whyRecurring: { type: "string", description: "Why this object matters enough to lock (tracked across beats, symbolic, or referred back to) — never a generic prop like 'a cup' or 'a chair'." },
  },
};

const DRAFT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: [
    "visualPremise", "visualTone", "continuityMode", "continuityModeReasoning", "hero",
    "recurringCharacters", "roleArchetypes", "world", "objectLanguage", "palette",
    "colorStrategy", "lightingStrategy",
    "graphicLanguageNotes", "cameraLanguageNotes", "episodeSpecificContinuityRules",
    "factualVisualConstraints", "episodeSpecificNegativeRules",
  ],
  properties: {
    visualPremise: { type: "string", description: "One or two sentences: what visual universe does this entire episode belong to? The thing every scene prompt will implicitly share." },
    visualTone: { type: "string", description: "The emotional/atmospheric register of the visuals — e.g. 'tense and vulnerable', 'light and curious', 'clinical and precise'." },
    continuityMode: { type: "string", enum: ["HERO", "ENSEMBLE", "SUBJECT", "NONE"], description: "HERO: one persistent protagonist (a named or second-person 'you' individual the story follows). ENSEMBLE: several recurring humans, no single dominant protagonist. SUBJECT: continuity lives in a non-human subject (an animal, a planet, a device) rather than a human. NONE: a pure explainer with no persistent visual subject at all — style and generic archetypes carry every scene." },
    continuityModeReasoning: { type: "string", description: "Explain your continuityMode choice using the NARRATIVE'S OWN STRUCTURE, never keyword/frequency counting. A name or subject mentioned many times (e.g. a historical source quoted repeatedly) is NOT automatically a protagonist — only classify HERO/SUBJECT if the narrative actually FOLLOWS that entity through a throughline, not merely references it often." },
    hero: {
      type: "object", additionalProperties: false,
      required: ["exists", "subjectType", "semanticIdentity", "canonicalAppearance", "headFaceConstruction", "bodyConstruction", "skinTone", "hair", "outfit", "accessories", "persistentIdentifyingFeatures", "bodyProportions", "emotionalExpressionLanguage", "forbiddenMutations"],
      properties: {
        exists: { type: "boolean", description: "True only if continuityMode is HERO or SUBJECT and a real persistent visual protagonist/subject exists. False for ENSEMBLE or NONE." },
        subjectType: { type: "string", enum: ["human", "animal", "object_character", "celestial", "machine", "none"] },
        semanticIdentity: { type: "string", description: "The protagonist's narrative role, e.g. 'second-person viewer avatar', 'a representative early human', 'the lion as a non-human subject'. Empty string if exists is false." },
        canonicalAppearance: { type: "string", description: "The FULL canonical prose description, to be inserted verbatim wherever the full character appears. Empty string if exists is false." },
        headFaceConstruction: { type: "string" }, bodyConstruction: { type: "string" }, skinTone: { type: "string" }, hair: { type: "string" }, outfit: { type: "string" },
        accessories: { type: "array", items: { type: "string" }, maxItems: 4 },
        persistentIdentifyingFeatures: { type: "array", items: { type: "string" }, maxItems: 6, description: "4-6 discrete, QA-checkable features an image can be judged against." },
        bodyProportions: { type: "string" }, emotionalExpressionLanguage: { type: "string" },
        forbiddenMutations: { type: "array", items: { type: "string" }, maxItems: 5, description: "Specific ways this identity must never drift, e.g. 'hair color must never shift from black to brown'." },
      },
    },
    recurringCharacters: { type: "array", items: RECURRING_CHARACTER_SCHEMA, maxItems: 5, description: "ONLY genuinely recurring, visually important characters beyond the hero (if any) — never a contract for every person mentioned once." },
    roleArchetypes: { type: "array", items: ROLE_ARCHETYPE_SCHEMA, maxItems: 16, description: "Every person the script names, even once: kinds of people (e.g. a Viking warrior, an archaeologist, an opera costume designer), plus one viewer avatar ('viewer_<era>') per era/context the narration's 'you' lines use. Each gets one locked stickman drawing. Empty only if the script has no people at all." },
    world: {
      type: "object", additionalProperties: false,
      required: ["settingFamilies", "architecture", "geography", "era", "recurringEnvironmentConstruction", "environmentalColorRules", "weatherTimeConventions", "historicalScientificConstraints", "settingBlocks"],
      properties: {
        settingFamilies: { type: "array", items: { type: "string" }, maxItems: 6, description: "The small set of distinct locations this episode actually needs — collapse similar locations into one family." },
        architecture: { type: "string" }, geography: { type: "string" }, era: { type: "string" },
        recurringEnvironmentConstruction: { type: "string", description: "How environments are built visually across this episode (e.g. '2-3 flat layers: sky, midground terrain, foreground detail')." },
        environmentalColorRules: { type: "string" },
        weatherTimeConventions: { type: "string", description: "Empty string if not relevant to this episode." },
        historicalScientificConstraints: { type: "array", items: { type: "string" }, maxItems: 6, description: "Only real factual visual constraints this episode's content requires (e.g. 'no metal tools in this era') — empty array if none apply." },
        settingBlocks: { type: "array", items: SETTING_BLOCK_SCHEMA, maxItems: 6, description: "One canonical block per setting family (same order), inserted word-for-word into image prompts." },
      },
    },
    objectLanguage: { type: "array", items: OBJECT_LANGUAGE_SCHEMA, maxItems: 10, description: "Every named artifact or object the script depends on (a named helmet, a mail neck guard, a postcard, a lunchbox), plus recurring identity-critical objects — never incidental background objects." },
    palette: {
      type: "object", additionalProperties: false,
      required: ["primaryColors", "supportingColors", "environmentPaletteRules", "contrastRules", "colorApproach", "monochromeJustification"],
      properties: {
        primaryColors: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        supportingColors: { type: "array", items: { type: "string" }, maxItems: 6 },
        environmentPaletteRules: { type: "string" }, contrastRules: { type: "string" },
        colorApproach: { type: "string", enum: ["FULL_COLOR", "LIMITED_PALETTE", "MONOCHROME"], description: "Default to FULL_COLOR or LIMITED_PALETTE. Choose MONOCHROME only when the episode's own content genuinely calls for it (e.g. a deliberate noir/silhouette treatment) — never as a default and never because the topic is serious." },
        monochromeJustification: { type: "string", description: "Required, non-empty reasoning if colorApproach is MONOCHROME. Empty string otherwise." },
      },
    },
    colorStrategy: { type: "string", description: "How color is actually deployed across this episode's scenes — episode-specific, distinct from the raw palette list." },
    lightingStrategy: { type: "string", description: "How lighting/mood is conveyed across this episode's scenes (e.g. 'warm firelight at night, cool flat daylight by day')." },
    graphicLanguageNotes: {
      type: "object", additionalProperties: false,
      required: ["diagramConventions", "comparisonLayouts", "timelineConventions", "mapConventions", "symbolicMetaphorLanguage"],
      properties: {
        diagramConventions: { type: "string" }, comparisonLayouts: { type: "string" }, timelineConventions: { type: "string" },
        mapConventions: { type: "string" }, symbolicMetaphorLanguage: { type: "string", description: "What kinds of concrete visual metaphors suit THIS episode's abstract ideas, if any." },
      },
    },
    cameraLanguageNotes: {
      type: "object", additionalProperties: false,
      required: ["framingConventions", "visualHierarchyRules", "whenEstablishingVsCloseupVsDiagram"],
      properties: { framingConventions: { type: "string" }, visualHierarchyRules: { type: "string" }, whenEstablishingVsCloseupVsDiagram: { type: "string" } },
    },
    episodeSpecificContinuityRules: {
      type: "object", additionalProperties: false, required: ["neverDrift", "allowedToVary", "episodeWideConsistencyRules"],
      properties: {
        neverDrift: { type: "array", items: { type: "string" }, maxItems: 8 },
        allowedToVary: { type: "array", items: { type: "string" }, maxItems: 8 },
        episodeWideConsistencyRules: { type: "array", items: { type: "string" }, maxItems: 6 },
      },
    },
    factualVisualConstraints: { type: "array", items: { type: "string" }, maxItems: 8, description: "Only visual facts this episode's real content requires getting right — empty array if none apply. Never invent a constraint the narration doesn't support." },
    episodeSpecificNegativeRules: { type: "array", items: { type: "string" }, maxItems: 6, description: "Forbidden outcomes SPECIFIC to this episode's content, additive to the recipe's own universal list — e.g. 'the hero's era-appropriate clothing must never include modern fabric patterns'." },
  },
};

export type StickmanBibleDraft = {
  visualPremise: string; visualTone: string; continuityMode: ContinuityMode; continuityModeReasoning: string;
  hero: Omit<HeroContract, "reasoning">;
  recurringCharacters: RecurringCharacterContract[];
  roleArchetypes?: RoleArchetypeContract[];
  world: WorldContract;
  objectLanguage: ObjectLanguageEntry[];
  palette: PaletteContract;
  colorStrategy: string; lightingStrategy: string;
  graphicLanguageNotes: Pick<GraphicLanguageContract, "diagramConventions" | "comparisonLayouts" | "timelineConventions" | "mapConventions" | "symbolicMetaphorLanguage">;
  cameraLanguageNotes: Pick<CameraLanguageContract, "framingConventions" | "visualHierarchyRules" | "whenEstablishingVsCloseupVsDiagram">;
  episodeSpecificContinuityRules: ContinuityRulesContract;
  factualVisualConstraints: string[];
  episodeSpecificNegativeRules: string[];
};

/* ============================ Instructions ============================ */
export const PRODUCTION_BIBLE_INSTRUCTIONS = `You are defining the ONE-TIME visual identity for an entire video episode, for a flat 2D "stickman doodle explainer" illustration recipe. You author this ONCE for the whole episode — every downstream scene prompt will reuse your decisions verbatim, never re-inventing them. Be concrete and specific enough that a description like "short dark-brown hair" can be copied word-for-word into every scene featuring that character, twenty scenes later, without drifting into "brown messy hair" or any other paraphrase.

You are working WITHIN a fixed universal style (flat 2D, uniform thin black outlines, flat solid color fills, no shading/gradients/texture, simple stickman construction for any human figure) — do not describe or redefine that universal style; it is applied separately, deterministically, by code. Your job is everything that is SPECIFIC to this one episode's content: what world it's set in, who (if anyone) it follows, what objects and settings recur, what palette suits it, and how the episode's own graphics/comparisons/diagrams should be styled.

PROTAGONIST DETECTION IS THE MOST IMPORTANT JUDGMENT CALL YOU MAKE. Decide continuityMode from the NARRATIVE'S OWN STRUCTURE, never from how often a name or entity is mentioned:
- HERO: the narration follows one persistent individual through a throughline — a "you" placed in a scenario, or one named/implied person whose experience the story tracks (e.g. "What if YOU became a millionaire" -> yes; "How early humans survived winter" -> likely yes, a representative early human the story follows).
- ENSEMBLE: several recurring humans matter, but no single one dominates as the protagonist.
- SUBJECT: continuity lives in a non-human subject the episode is actually ABOUT and follows (an animal, a planet, a device) — not a human at all.
- NONE: a pure explainer with no persistent visual subject — style and generic role archetypes (e.g. "a scientist", drawn fresh each time it's needed) carry every scene.
A source, author, or concept mentioned repeatedly (e.g. a historical writer whose account is quoted several times) is NOT automatically a protagonist just from frequency — only classify HERO/SUBJECT if the narrative genuinely follows that entity's own throughline, not merely cites it. When in doubt between NONE and inventing a protagonist the script doesn't actually have, choose NONE — never invent a protagonist that isn't really there.

Only give a RECURRING CHARACTER a locked identity contract if they are genuinely visually important and appear across multiple beats for a real narrative reason — never for a person mentioned once or twice in passing.

ROLE ARCHETYPES are different and must NOT be skipped: every generic kind of person the script draws on (a Viking warrior, an archaeologist, a historian, an opera costume designer, a crowd member) gets one roleArchetypes entry with a locked stickman drawing, so every scene draws that role the same way. And whenever the narration places the viewer in a scene ("You're gripping a shield", "Next time you see..."), include the viewer's own stickman avatar — unless the hero IS that viewer. The viewer is era-bound: create ONE viewer avatar per era/context the "you" lines use, each with its own full canonical description (clothing, gear, hair of that era), e.g. id "viewer_viking" for "You're gripping a shield" in a Viking battle and id "viewer_modern" for bridge lines like "your Halloween costume" (the same person in present-day clothes). Present-day "you" lines (a lunchbox, a mascot, a costume, a museum, "next time you see…", "today") ALWAYS need their own viewer_modern, even when the episode opens in the past. Use id exactly "viewer" only when every "you" line shares one context. The viewer is never the hero: when the "you" avatar carries the episode, set hero.exists false and let the viewer_* archetypes carry it. Archetypes are PEOPLE only — objects (a horned helmet) belong in objectLanguage.

PROP BLOCKS FOR NAMED OBJECTS: every named artifact or object the script depends on (a named helmet, a mail neck guard, a nose guard, tourist postcards, a lunchbox) gets an objectLanguage entry whose promptBlock describes it in plain visual words — shapes, materials, colors — and avoids words the image model misreads (not \"spectacled\" but \"a goggle-shaped iron eye-and-nose guard\"). Objects never have faces. A real brand, team logo or copyrighted character is never an object block: use a generic equivalent (\"a football team's horned-helmet logo\").

CAST CHECKLIST: the input's peopleThisScriptNames lists every person that needs a roleArchetypes entry — give each exactly ONE entry (a named person covers their own role, so no separate "painter" next to the painter Gustav Malmstrom), and spend no entries on anyone not on the list except the viewer avatars. PROMPT BLOCKS: image prompts are assembled by code from your canonical text, word-for-word, and must work with NOTHING else. STICKMAN BODIES: clothing is only a flat colored shape on the torso ("a green tunic shape on the torso", "a charcoal coat shape"); arms and legs are ALWAYS thin black stick lines, so never describe trousers, pants, long sleeves or knee boots; feet are small rounded shapes that may be colored. So every archetype's "identity", every object's "promptBlock" and every world.settingBlocks entry must be fully self-contained: plain words and color NAMES (never hex codes), no ids, no "see…", "same as…" or references to other entries, and faces limited to the style (glasses only if part of the identity — no beards or mustaches). identity.displayName is plain words ("A Viking warrior", "The viewer as a Viking raider"), never the id. Each identity is ONE fixed look — no conditions ("when…", "in relevant shots"); a different look is an outfitVariant. Setting blocks describe only the PLACE (no people, no avatars); people are added per beat. Every person the script names gets a cast entry, even if mentioned only once: every kind of person (an archaeologist, a historian) and every named individual ("historian Roberta Frank", "composer Richard Wagner") gets an archetype (or a recurring character if genuinely recurring). continuityMode NONE only means there is no protagonist; it never means "no people": a script with people always produces archetypes.

Palette: default to FULL_COLOR or LIMITED_PALETTE. Only choose MONOCHROME when this specific episode's content genuinely calls for it, and always explain why — never default to grayscale just because a topic feels serious.

Every canonical prose block you write (hero appearance, a recurring character's appearance, a setting variant, an object description) must be complete and self-sufficient — it will be inserted into a scene prompt with NO other context, so it can never say "the same as before" or rely on anything outside itself.

Never invent a fact, era detail, or constraint the episode's own script/research doesn't support.`;

export function buildDraftPrompt(input: { topic: string; viewerPromise: string; narrativeStrategy: string; finalScript: string; researchNotes: string; targetAudience: string }) {
  return JSON.stringify({
    topic: input.topic,
    viewerPromise: input.viewerPromise || undefined,
    narrativeStrategy: input.narrativeStrategy || undefined,
    targetAudience: input.targetAudience || undefined,
    researchNotes: input.researchNotes || undefined,
    // Phase 4c: the cast checklist computed in code — each needs exactly one
    // roleArchetypes entry; a named person covers their own role.
    peopleThisScriptNames: requiredPeople(input.finalScript).map((p) => (p.kind === "named" ? `${p.label} (the ${p.role}; covers "${p.role}" — no separate ${p.role} entry)` : `a ${p.key} (mentioned ${p.mentions} times)`)),
    finalScript: input.finalScript,
  });
}

/* ============================ Deterministic merge: recipe (grammar) + draft (episode vocabulary) -> frozen Bible ============================ */
export function mergeDraftIntoBible(
  draft: StickmanBibleDraft,
  ctx: { productionBibleVersion: number; projectId: string; generationProfileId: string; scriptVersionId: string; recipe?: StickmanRecipeStyleContract },
): StickmanProductionBible {
  const recipe = ctx.recipe ?? STICKMAN_DOODLE_EXPLAINER_V1;

  const styleContract: StyleContract = {
    ...recipe.styleTraits,
    colorStrategy: draft.colorStrategy,
    lightingStrategy: draft.lightingStrategy,
  };

  const graphicLanguage: GraphicLanguageContract = {
    backgroundBehavior: recipe.graphicGrammar.backgroundBehavior,
    lineStyle: recipe.graphicGrammar.lineStyle,
    arrowsConnectors: recipe.graphicGrammar.arrowsConnectors,
    characterUseInsideGraphics: recipe.graphicGrammar.characterUseInsideGraphics,
    whitespaceBehavior: recipe.graphicGrammar.whitespaceBehavior,
    colorUse: draft.palette.primaryColors.length
      ? `Uses this episode's own palette (${draft.palette.primaryColors.join(", ")}) as flat fills, consistent with narrative scenes — never a separate infographic color scheme.`
      : "Uses this episode's own palette as flat fills, consistent with narrative scenes.",
    diagramConventions: draft.graphicLanguageNotes.diagramConventions,
    comparisonLayouts: draft.graphicLanguageNotes.comparisonLayouts,
    timelineConventions: draft.graphicLanguageNotes.timelineConventions,
    mapConventions: draft.graphicLanguageNotes.mapConventions,
    symbolicMetaphorLanguage: draft.graphicLanguageNotes.symbolicMetaphorLanguage,
    overlayTextBehavior: recipe.textPolicyDefaults.exceptionsPolicy,
  };

  const cameraLanguage: CameraLanguageContract = {
    allowedShotFamilies: recipe.cameraGrammar.allowedShotFamilies,
    simplicityReadabilityRules: recipe.cameraGrammar.simplicityReadabilityRules,
    framingConventions: draft.cameraLanguageNotes.framingConventions,
    visualHierarchyRules: draft.cameraLanguageNotes.visualHierarchyRules,
    whenEstablishingVsCloseupVsDiagram: draft.cameraLanguageNotes.whenEstablishingVsCloseupVsDiagram,
  };

  const textPolicy: TextPolicyContract = { ...recipe.textPolicyDefaults };

  const continuityRules: ContinuityRulesContract = {
    neverDrift: [
      "the recipe's own universal style (flat 2D, uniform outline, flat fills, no shading/gradients/texture)",
      ...draft.episodeSpecificContinuityRules.neverDrift,
    ],
    allowedToVary: draft.episodeSpecificContinuityRules.allowedToVary,
    episodeWideConsistencyRules: draft.episodeSpecificContinuityRules.episodeWideConsistencyRules,
  };

  const negativeRules = [...new Set([...recipe.universalForbiddenOutcomes, ...draft.episodeSpecificNegativeRules])];

  const hero: HeroContract = { ...draft.hero, reasoning: draft.continuityModeReasoning };

  return {
    productionBibleVersion: ctx.productionBibleVersion,
    recipeId: recipe.recipeId,
    recipeVersion: recipe.recipeVersion,
    visualPremise: draft.visualPremise,
    visualTone: draft.visualTone,
    styleContract,
    palette: draft.palette,
    continuityMode: draft.continuityMode,
    hero,
    recurringCharacters: draft.recurringCharacters,
    roleArchetypes: draft.roleArchetypes ?? [],
    world: draft.world,
    objectLanguage: draft.objectLanguage,
    graphicLanguage,
    cameraLanguage,
    textPolicy,
    continuityRules,
    factualVisualConstraints: draft.factualVisualConstraints,
    negativeRules,
    projectId: ctx.projectId,
    generationProfileId: ctx.generationProfileId,
    scriptVersionId: ctx.scriptVersionId,
  };
}

/* ============================ Deterministic validation ============================
 * Part 10's own required checks, made mechanical rather than trusted to the
 * model's judgment: protagonist logic must be internally consistent, a
 * monochrome choice must be justified, recurring-character/object lists
 * must stay small and reasoned, and no field required by the schema above
 * may be silently empty where it matters.
 */
// Script-aware cast checks (only when the final script text is supplied).
const SECOND_PERSON = /\byou(?:'re|'ve|'d|'ll)?\b|\byour\b/gi;
const PEOPLE_WORDS = /\b(people|person|man|woman|men|women|warriors?|soldiers?|raiders?|kings?|queens?|historians?|archaeologists?|scientists?|researchers?|designers?|workers?|farmers?|hunters?|doctors?|priests?|chieftains?|children|child|crowds?|audiences?|traders?|sailors?|composers?|painters?|cartoonists?|collectors?|illustrators?|anthropologists?)\b/gi;

// Role word (either case) + a capitalised full name; the name itself must be capitalised.
const NAMED_PERSON = /\b([Hh]istorian|[Cc]omposer|[Cc]artoonist|[Pp]ainter|[Aa]rchaeologist|[Dd]esigner|[Ss]cientist|[Rr]esearcher|[Kk]ing|[Qq]ueen|[Cc]hieftain|[Pp]oet|[Ww]riter|[Aa]rtist|[Ii]llustrator|[Dd]irector|[Ee]xplorer)s?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;

/* ============================ Required people (Phase 4c) ============================ */

// Words for the same kind of person count as one role.
const ROLE_SYNONYMS: Record<string, string> = { raider: "warrior", soldier: "warrior", fighter: "warrior" };
const GENERIC_PEOPLE = /^(people|person|man|men|woman|women|child|children|crowd|audience)$/;
export type RequiredPerson = { kind: "named" | "role"; key: string; label: string; role: string; mentions: number };

// The people a script names, as one checklist: every named individual
// ("historian Roberta Frank" — who also covers "historian"), plus every other
// kind of person mentioned at least twice. Once-mentioned generic roles are left out.
export function requiredPeople(scriptText: string): RequiredPerson[] {
  const out: RequiredPerson[] = [];
  const coveredRoles = new Set<string>();
  for (const m of scriptText.matchAll(NAMED_PERSON)) {
    const role = m[1].toLowerCase();
    const label = m[2];
    coveredRoles.add(ROLE_SYNONYMS[role] ?? role);
    if (!out.some((p) => p.label === label)) out.push({ kind: "named", key: label.split(/\s+/).pop()!.toLowerCase(), label, role, mentions: 1 });
  }
  const counts = new Map<string, number>();
  for (const m of scriptText.match(PEOPLE_WORDS) ?? []) {
    const base = m.toLowerCase().replace(/s$/, "");
    const k = ROLE_SYNONYMS[base] ?? base;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [k, n] of counts) if (n >= 2 && !GENERIC_PEOPLE.test(k) && !coveredRoles.has(k)) out.push({ kind: "role", key: k, label: k, role: k, mentions: n });
  return out;
}

// Who each entry IS: id, display name and the head of its role — not the
// role's prose, which mentions other people ("draws horned warriors").
const roleHead = (role: string) => String(role ?? "").split(/[(,;]| used | who | for | when /)[0];
export function castTextOf(bible: StickmanProductionBible): string {
  return [bible.hero?.semanticIdentity ?? "", ...(bible.recurringCharacters ?? []).map((c) => `${c.id} ${roleHead(c.role)}`), ...(bible.roleArchetypes ?? []).filter((a) => !/^viewer(_|$)/.test(a.id)).map((a) => `${a.id} ${roleHead(a.role)} ${a.identity?.displayName ?? ""}`)].join(" ").toLowerCase(); // viewer avatars never stand in for a role
}
export function castCovers(castText: string, p: RequiredPerson): boolean {
  if (p.kind === "named") return castText.includes(p.key);
  const synonyms = Object.entries(ROLE_SYNONYMS).filter(([, v]) => v === p.key).map(([k]) => k);
  return [p.key, ...synonyms].some((w) => castText.includes(w));
}

// Role templates for code-added cast: a torso-shape outfit, a period-neutral
// look, a plain display name. Unknown roles get the plain default.
const ROLE_TEMPLATES: Record<string, { outfit: string; outfitShort: string; signature: string; hair: string }> = {
  warrior: { outfit: "a muted ochre tunic shape on the torso with a dark brown belt line, and small dark grey rounded feet", outfitShort: "a muted ochre tunic shape", signature: "a round wooden shield and a short axe", hair: "short dark brown hair" },
  historian: { outfit: "a brown tweed jacket shape on the torso with a white collar, and small dark brown rounded feet", outfitShort: "a brown jacket shape", signature: "an open book", hair: "short grey hair" },
  composer: { outfit: "a black frock-coat shape on the torso with a white cravat, and small black rounded feet", outfitShort: "a black coat shape", signature: "a sheet of music", hair: "swept-back grey hair" },
  designer: { outfit: "a deep charcoal coat shape on the torso with a burgundy cravat, and small black rounded feet", outfitShort: "a charcoal coat shape", signature: "a rolled-up costume sketch", hair: "neat medium brown hair" },
  archaeologist: { outfit: "a khaki field-shirt shape on the torso with a dark grey tool-belt line, and small olive rounded feet", outfitShort: "a khaki shirt shape", signature: "a small trowel", hair: "short dark brown hair" },
  painter: { outfit: "a paint-spotted blue smock shape on the torso, and small dark brown rounded feet", outfitShort: "a blue smock shape", signature: "a paintbrush", hair: "wavy brown hair" },
  cartoonist: { outfit: "a white shirt shape on the torso with a dark tie line, and small black rounded feet", outfitShort: "a white shirt shape", signature: "a pencil", hair: "short black hair" },
  priest: { outfit: "a long bronze-yellow robe shape on the torso, and small brown rounded feet", outfitShort: "a bronze-yellow robe shape", signature: "a slim ritual staff", hair: "shoulder-length dark brown hair" },
};
const DEFAULT_TEMPLATE = { outfit: "a plain muted grey tunic shape on the torso, and small dark grey rounded feet", outfitShort: "a muted grey tunic shape", signature: "nothing in hand", hair: "short dark brown hair" };
const VIEWER_TEMPLATES: Record<string, { displayName: string; outfit: string; outfitShort: string; signature: string }> = {
  modern: { displayName: "The viewer today", outfit: "a plain light grey T-shirt shape on the torso, and small dark blue rounded feet", outfitShort: "a light grey T-shirt shape", signature: "nothing in hand" },
  past: { displayName: "The viewer in the story's era", outfit: "a muted forest-green tunic shape on the torso with a dark brown belt line, and small dark brown rounded feet", outfitShort: "a muted forest-green tunic shape", signature: "a round wooden shield" },
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const article = (w: string) => (/^[aeiou]/i.test(w) ? "An" : "A");

function templateEntry(id: string, role: string, displayName: string, t: { outfit: string; outfitShort: string; signature: string; hair: string }): RoleArchetypeContract {
  const identity: StickmanIdentity = { displayName, skinTone: "light warm beige", faceMarks: "", hair: t.hair, outfit: t.outfit, outfitShort: t.outfitShort, sleeves: "", build: "average adult proportions", signature: t.signature };
  return { id, role, canonicalAppearance: `${displayName}: a stickman with a light warm beige circle head, ${t.hair}, wearing ${t.outfit}; carrying ${t.signature}.`, usedFor: "Added by code: the script names this person and the bible had no entry for them.", identity, outfitVariants: [] };
}

// Code fallback after the one repair: add every still-missing required
// person and viewer context from a template (with a warning each), so a
// bible never blocks on missing cast. Stays within 16 entries.
export function addMissingCast(bible: StickmanProductionBible, scriptText: string): { bible: StickmanProductionBible; added: string[] } {
  const archetypes = [...(bible.roleArchetypes ?? [])];
  const added: string[] = [];
  const room = () => archetypes.length < 16;
  for (const p of requiredPeople(scriptText)) {
    if (!room() || castCovers(castTextOf({ ...bible, roleArchetypes: archetypes }), p)) continue;
    const t = ROLE_TEMPLATES[p.role] ?? DEFAULT_TEMPLATE;
    const entry = p.kind === "named" ? templateEntry(slug(p.label), `${p.role} ${p.label}`, `${p.label}, ${article(p.role).toLowerCase()} ${p.role}`, t) : templateEntry(slug(p.key), `a ${p.key}`, `${article(p.key)} ${p.key}`, t);
    archetypes.push(entry);
    added.push(p.label);
  }
  const heroIsViewer = bible.hero?.exists && /viewer|second.person|\byou\b/i.test(`${bible.hero.semanticIdentity} ${bible.hero.canonicalAppearance}`);
  if (!heroIsViewer) {
    const viewers = archetypes.filter((a) => a.id === "viewer" || a.id.startsWith("viewer_"));
    const contexts = youContexts(scriptText);
    for (const era of contexts.keys()) {
      if (!room() || viewers.some((v) => v.id !== "viewer" && viewerEra(v.id, v.role) === era) || (contexts.size === 1 && viewers.length)) continue;
      const t = VIEWER_TEMPLATES[era];
      const id = era === "modern" ? "viewer_modern" : "viewer_past";
      archetypes.push({ ...templateEntry(id, era === "modern" ? "the viewer today (modern)" : "the viewer in the story's era", t.displayName, { ...t, hair: "short dark brown hair" }) });
      added.push(id);
    }
  }
  return { bible: { ...bible, roleArchetypes: archetypes }, added };
}

export function validateBible(bible: StickmanProductionBible, scriptText?: string): string[] {
  const errors: string[] = [];
  const archetypes = bible.roleArchetypes ?? [];
  for (const a of archetypes) {
    if (!a.canonicalAppearance?.trim()) errors.push(`ROLE_ARCHETYPE_MISSING_APPEARANCE:${a.id}`);
  }
  if (archetypes.length > 16) errors.push("TOO_MANY_ROLE_ARCHETYPES");
  // An object filed as a person (run 4: "a prop archetype: the dramatic horned
  // helmet"). A role that names a person always passes — "a stage designer
  // who made the prop helmets" is a person (false positive in the polish check).
  const PERSON_ROLE = new RegExp(`${PEOPLE_WORDS.source}|\\b(viewer|figure|someone|member|curator|actor|singer|fan|shopper|consumer|public)\\b`, "i");
  for (const a of archetypes) {
    const role = a.role ?? "";
    if (/\bprops?\b|\bobjects?\b/i.test(role) && !PERSON_ROLE.test(role)) errors.push(`ARCHETYPE_NOT_A_PERSON:${a.id} ("${role.slice(0, 60)}") — move objects to objectLanguage`);
  }
  if (scriptText) {
    const castCount = (bible.hero?.exists ? 1 : 0) + (bible.recurringCharacters?.length ?? 0) + archetypes.length;
    const peopleMentions = (scriptText.match(PEOPLE_WORDS) ?? []).length;
    const youMentions = (scriptText.match(SECOND_PERSON) ?? []).length;
    if (castCount === 0 && (peopleMentions >= 3 || youMentions >= 5)) errors.push("NO_CAST_FOR_SCRIPT_WITH_PEOPLE — add roleArchetypes for the kinds of people the script shows (and id 'viewer' for 'you' scenes)");
    const heroIsViewer = bible.hero?.exists && /viewer|second.person|\byou\b/i.test(`${bible.hero.semanticIdentity} ${bible.hero.canonicalAppearance}`);
    // Every person the script names needs a cast entry (Phase 4c checklist,
    // shared with the draft prompt and the code fallback). SOFT: after the one
    // repair, code adds any still-missing person from a role template.
    const castText = castTextOf(bible);
    for (const p of requiredPeople(scriptText)) if (!castCovers(castText, p)) errors.push(p.kind === "named" ? `NAMED_PERSON_NOT_CAST:${p.label} — the script names ${p.role} ${p.label}; add a roleArchetypes entry for them` : `ROLE_NOT_CAST:${p.key} — the script mentions ${p.key}s ${p.mentions} time(s); add a roleArchetypes entry for them`);
    const viewerArchetypes = archetypes.filter((a) => a.id === "viewer" || a.id.startsWith("viewer_"));
    // Run 4: a viewer HERO plus viewer_viking split the "you" lines across two ids.
    if (heroIsViewer && viewerArchetypes.length) errors.push("VIEWER_DUPLICATED_AS_HERO — the viewer lives only in the viewer_* archetypes; set hero.exists false (continuityMode ENSEMBLE or NONE)");
    if (youMentions >= 5 && !heroIsViewer && !viewerArchetypes.length) errors.push("VIEWER_AVATAR_MISSING — the narration puts 'you' in scenes; add a viewer avatar ('viewer_<era>') per era/context of the 'you' lines");
    // One viewer per "you" context (run 5 made only viewer_viking, so the
    // lunchbox/"next time you see" lines showed a Viking).
    const contexts = youContexts(scriptText);
    if (!heroIsViewer && viewerArchetypes.length && contexts.size > 1) {
      // HARD only when there are fewer era avatars than contexts (structural);
      // when the count is right but a label doesn't read as that era, it's a
      // classification call → SOFT (VIEWER_ERA_UNCLEAR).
      const eraAvatars = viewerArchetypes.filter((a) => a.id !== "viewer");
      const code = eraAvatars.length < contexts.size ? "VIEWER_CONTEXT_MISSING" : "VIEWER_ERA_UNCLEAR";
      for (const [era, example] of contexts) {
        if (eraAvatars.some((a) => viewerEra(a.id, a.role) === era)) continue;
        errors.push(`${code}:${era} — "you" lines like "${example.slice(0, 90)}" happen ${era === "modern" ? "in the present day; add id viewer_modern (the same person in present-day clothes)" : "in the story's era; add a viewer_<era> avatar in period clothes"}`);
      }
    }
  }
  // Phase 3 canonical prompt blocks: every setting family needs its block
  // (structural, HARD); ids / hex / cross-references inside a block are a
  // wording call (SOFT, PROMPT_BLOCK_NOT_STANDALONE) — the compiler lints too.
  const blocks = bible.world?.settingBlocks;
  if (Array.isArray(blocks)) for (const fam of bible.world.settingFamilies ?? []) if (!blocks.some((b) => b.family === fam)) errors.push(`SETTING_BLOCK_MISSING:${fam}`);
  // Phase 3b (first real rebuild): displayName came back as the id, setting
  // blocks put cast members in the foreground, and identity fields carried
  // conditions ("in relevant shots"). Each reason is named for the repair.
  const people = [...(bible.recurringCharacters ?? []), ...archetypes];
  const idWords = people.map((p) => p.id).filter((id) => /[_\d]/.test(id));
  const hasId = (t: string) => /#[0-9a-f]{6}\b|\b(see|same as)\b|\b(cast|set|prop|viewer)_\w+/i.test(t) || idWords.some((id) => t.includes(id));
  for (const p of people) {
    const idn = (p as any).identity as StickmanIdentity | undefined;
    if (!idn) continue;
    if (/_/.test(idn.displayName) || idn.displayName === p.id) errors.push(`PROMPT_BLOCK_NOT_STANDALONE:${p.id} — displayName must be plain words (e.g. "A Viking warrior"), never the id`);
    else if (hasId(Object.values(idn).join(" "))) errors.push(`PROMPT_BLOCK_NOT_STANDALONE:${p.id} — identity has an id, hex code or cross-reference`);
    if (/\b(when|if|in relevant|where the (script|narration))\b/i.test(`${idn.outfit} ${idn.signature}`)) errors.push(`PROMPT_BLOCK_NOT_STANDALONE:${p.id} — identity must describe ONE fixed look, no conditions ("when…", "in relevant shots")`);
    // Phase 4b: clothing is a torso shape; limbs stay thin stick lines.
    const volume = `${idn.outfit} ${idn.outfitShort}`.match(/\b(trousers|pants|leggings|jeans|sleeves to the wrist|long sleeves|boots to the knee|knee[- ]high boots)\b/i);
    if (volume) errors.push(`PROMPT_BLOCK_NOT_STANDALONE:${p.id} — "${volume[0]}": clothing is a flat shape on the torso only; arms and legs stay thin black stick lines`);
  }
  for (const o of bible.objectLanguage ?? []) if (o.promptBlock && hasId(o.promptBlock)) errors.push(`PROMPT_BLOCK_NOT_STANDALONE:${o.id} — promptBlock has an id, hex code or cross-reference`);
  const castWords = people.flatMap((p) => [p.id, (p as any).identity?.displayName ?? ""]).filter(Boolean);
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const text = JSON.stringify(b.variants);
    if (hasId(text)) errors.push(`PROMPT_BLOCK_NOT_STANDALONE:${b.family} — setting block has an id, hex code or cross-reference`);
    if (castWords.some((w) => text.includes(w)) || /\b(avatar|viewer|figure|person|stickman)\b/i.test(text)) errors.push(`PROMPT_BLOCK_NOT_STANDALONE:${b.family} — a setting block describes only the place; people are added per beat`);
  }
  const ids = [...(bible.hero?.exists ? ["hero"] : []), ...(bible.recurringCharacters ?? []).map((c) => c.id), ...archetypes.map((a) => a.id), ...(bible.objectLanguage ?? []).map((o: any) => o.id)];
  for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) errors.push(`DUPLICATE_ID:${id}`);
  if (!bible.visualPremise.trim()) errors.push("EMPTY_VISUAL_PREMISE");
  if (!bible.visualTone.trim()) errors.push("EMPTY_VISUAL_TONE");
  if (!bible.hero.reasoning.trim()) errors.push("MISSING_CONTINUITY_MODE_REASONING");

  // Protagonist-logic consistency — the exact "must be semantic, not
  // keyword-based" requirement made mechanically checkable after the fact.
  if (bible.continuityMode === "NONE" && bible.hero.exists) errors.push("HERO_EXISTS_BUT_CONTINUITY_MODE_IS_NONE");
  if (bible.continuityMode === "HERO" && !bible.hero.exists) errors.push("CONTINUITY_MODE_HERO_BUT_NO_HERO_DEFINED");
  if (bible.continuityMode === "SUBJECT" && !bible.hero.exists) errors.push("CONTINUITY_MODE_SUBJECT_BUT_NO_SUBJECT_DEFINED");
  if (bible.hero.exists && !bible.hero.canonicalAppearance.trim()) errors.push("HERO_EXISTS_BUT_NO_CANONICAL_APPEARANCE");
  if (!bible.hero.exists && bible.hero.canonicalAppearance.trim()) errors.push("HERO_NOT_EXISTS_BUT_APPEARANCE_PROVIDED");

  // Palette / monochrome justification.
  if (bible.palette.colorApproach === "MONOCHROME" && !(bible.palette.monochromeJustification ?? "").trim()) {
    errors.push("MONOCHROME_WITHOUT_JUSTIFICATION");
  }
  if (bible.palette.colorApproach !== "MONOCHROME" && (bible.palette.monochromeJustification ?? "").trim()) {
    errors.push("JUSTIFICATION_PROVIDED_FOR_NON_MONOCHROME_PALETTE");
  }
  if (!bible.palette.primaryColors.length) errors.push("EMPTY_PRIMARY_PALETTE");

  // Keep the cast small and reasoned — Section 3's own explicit rule.
  if (bible.recurringCharacters.length > 6) errors.push("TOO_MANY_RECURRING_CHARACTERS");
  for (const rc of bible.recurringCharacters) {
    if (!rc.appearsForNarrativeReason.trim()) errors.push(`RECURRING_CHARACTER_MISSING_REASON:${rc.id}`);
    if (!rc.canonicalAppearance.trim()) errors.push(`RECURRING_CHARACTER_MISSING_APPEARANCE:${rc.id}`);
  }
  if (bible.objectLanguage.length > 12) errors.push("TOO_MANY_LOCKED_OBJECTS");
  for (const obj of bible.objectLanguage) {
    if (!obj.whyRecurring.trim()) errors.push(`OBJECT_MISSING_REASON:${obj.id}`);
  }

  // Recipe-derived fields must never come back empty (structural guarantee,
  // but checked anyway in case a future recipe implementation forgets one).
  if (!bible.negativeRules.length) errors.push("EMPTY_NEGATIVE_RULES");
  if (!bible.styleContract.forbiddenStyleTraits.length) errors.push("EMPTY_FORBIDDEN_STYLE_TRAITS");
  if (bible.textPolicy.providerGeneratedTextDefault !== "OFF") errors.push("TEXT_POLICY_DEFAULT_MUST_BE_OFF");

  return errors;
}

// Non-blocking observations — surfaced for a human reviewer, never used to
// fail the build or trigger a repair call (that's what validateBible is for).
export function warnBible(bible: StickmanProductionBible): string[] {
  const warnings: string[] = [];
  if (bible.continuityMode === "HERO" && bible.hero.exists && bible.hero.subjectType !== "human") {
    warnings.push("HERO_MODE_WITH_NON_HUMAN_SUBJECT_TYPE — consider whether SUBJECT mode fits this episode better.");
  }
  if (bible.continuityMode === "ENSEMBLE" && bible.recurringCharacters.length === 0 && !bible.hero.exists) {
    warnings.push("ENSEMBLE_MODE_WITH_NO_RECURRING_CHARACTERS_OR_HERO — nothing recurring was actually captured.");
  }
  return warnings;
}

/* ============================ LLM orchestration ============================ */
// Phase 0, Section C.3 — GPT5_MINI_INPUT_PER_M/OUTPUT_PER_M now imported
// from the shared constants module above.
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (typeof content?.text === "string") return content.text;
  return "";
}

async function callDraft(openaiKey: string, promptInput: string, repairNote?: string): Promise<{ draft: StickmanBibleDraft; inputTokens: number; outputTokens: number }> {
  const res = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Phase 4c: 6000 truncated the bigger bible (every named person cast,
      // identity + outfit variants per person); reasoning tokens count too.
      model: OPENAI_MODEL, reasoning: { effort: "low" }, max_output_tokens: BIBLE_MAX_OUTPUT_TOKENS, store: false,
      instructions: PRODUCTION_BIBLE_INSTRUCTIONS + (repairNote ? `\n\nYour previous attempt had these problems — fix them exactly: ${repairNote}` : ""),
      input: promptInput,
      text: { format: { type: "json_schema", name: "stickman_production_bible_draft", strict: true, schema: DRAFT_SCHEMA } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`PRODUCTION_BIBLE_CALL_FAILED: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const payload = await res.json();
  return parseDraftPayload(payload);
}

export const BIBLE_MAX_OUTPUT_TOKENS = 16000;

// A truncated or unparseable response is a named, reportable failure (it was
// an uncaught JSON.parse throw -> a bare 500 with nothing logged).
export function parseDraftPayload(payload: any): { draft: StickmanBibleDraft; inputTokens: number; outputTokens: number } {
  const usage = { inputTokens: payload?.usage?.input_tokens ?? 0, outputTokens: payload?.usage?.output_tokens ?? 0 };
  if (payload?.status === "incomplete") throw Object.assign(new Error(`PRODUCTION_BIBLE_TRUNCATED: ${payload?.incomplete_details?.reason ?? "incomplete"} after ${usage.outputTokens} output tokens`), usage);
  const text = extractOutputText(payload).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { draft: JSON.parse(text), ...usage };
  } catch {
    throw Object.assign(new Error(`PRODUCTION_BIBLE_UNPARSEABLE: ${text.length} chars, ends "${text.slice(-60)}"`), usage);
  }
}

export type ProductionBibleCompileStats = { llmCalls: number; repairCalls: number; inputTokens: number; outputTokens: number; estimatedModelCostUsd: number; latencyMs: number };

// ONE strong structured call, then deterministic merge/validate; on a
// validation failure, exactly ONE corrective call is attempted (never a
// loop) before failing closed. Mirrors compileNarrationVisualContract's own
// shape/stats so both LLM-authoring pipelines in this codebase report cost
// identically.
export async function compileStickmanProductionBible(args: {
  openaiKey: string;
  projectId: string; generationProfileId: string; scriptVersionId: string; productionBibleVersion: number;
  topic: string; viewerPromise: string; narrativeStrategy: string; finalScript: string; researchNotes: string; targetAudience: string;
  recipe?: StickmanRecipeStyleContract;
}): Promise<{ ok: true; bible: StickmanProductionBible; warnings: string[]; stats: ProductionBibleCompileStats } | { ok: false; errors: string[]; stats: ProductionBibleCompileStats }> {
  const startedAt = Date.now();
  const stats: ProductionBibleCompileStats = { llmCalls: 0, repairCalls: 0, inputTokens: 0, outputTokens: 0, estimatedModelCostUsd: 0, latencyMs: 0 };
  const promptInput = buildDraftPrompt(args);

  const first = await callDraft(args.openaiKey, promptInput);
  stats.llmCalls++; stats.inputTokens += first.inputTokens; stats.outputTokens += first.outputTokens;

  let bible = mergeDraftIntoBible(first.draft, args);
  let errors = validateBible(bible, args.finalScript);

  if (errors.length) {
    const repair = await callDraft(args.openaiKey, promptInput, errors.join("; "));
    stats.repairCalls++; stats.llmCalls++; stats.inputTokens += repair.inputTokens; stats.outputTokens += repair.outputTokens;
    bible = mergeDraftIntoBible(repair.draft, args);
    errors = validateBible(bible, args.finalScript);
  }
  // Code fallback: anyone still missing is added from a role template, with
  // a warning each — missing cast never blocks a bible (Phase 4c).
  const fallback = addMissingCast(bible, args.finalScript);
  if (fallback.added.length) {
    bible = fallback.bible;
    errors = [...validateBible(bible, args.finalScript), ...fallback.added.map((x) => `CAST_ADDED_BY_CODE:${x}`)];
  }

  stats.estimatedModelCostUsd = Number(((stats.inputTokens * GPT5_MINI_INPUT_PER_M + stats.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4));
  stats.latencyMs = Date.now() - startedAt;

  // Classification checks had their one repair; what's left is a WARN on the
  // bible, never a failed (paid) build. Only structural errors fail.
  const hard = errors.filter((e) => !isSoftBibleError(e));
  if (hard.length) return { ok: false, errors: hard, stats };
  return { ok: true, bible, warnings: [...errors, ...warnBible(bible)], stats };
}

// Keyword/classification-based checks (person vs object, role wording, era
// labels): repaired once, then kept as warnings. They prefer false negatives,
// since they gate a paid step. Everything else from validateBible is HARD.
export const SOFT_BIBLE_CODES = ["ARCHETYPE_NOT_A_PERSON", "VIEWER_DUPLICATED_AS_HERO", "VIEWER_ERA_UNCLEAR", "PROMPT_BLOCK_NOT_STANDALONE", "ROLE_NOT_CAST", "NAMED_PERSON_NOT_CAST", "CAST_ADDED_BY_CODE"];
export const isSoftBibleError = (e: string) => SOFT_BIBLE_CODES.some((c) => e === c || e.startsWith(`${c}:`) || e.startsWith(`${c} `));
