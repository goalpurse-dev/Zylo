// deno-lint-ignore-file no-explicit-any
// stickman/types.ts — 2026-10-02 "narration-first / audio-first
// architecture" pass. Type skeleton only — no builder/compiler/director
// implements these yet. Grounded in the verified architecture report: the
// recipe-level Style Contract is a static constant (never per-project data,
// stored nowhere in the DB — parallel to how STYLE_PRESETS in
// visualWorldStyle.ts are code constants, not rows); the Production Bible is
// the one new per-project versioned artifact (see the note on
// long_form_production_bibles below); BeatContract[] lives inside the
// EXISTING long_form_visual_plan_versions.visual_plan.visualBeats[] JSONB
// array — no new container.
import type { TimingSource } from "../visualRecipe.ts";

/* ============================ Style Contract (static, code-level) ============================
 * Recipe-versioned, never project data. STICKMAN_DOODLE_EXPLAINER_V1 is a
 * literal code constant (to be authored in stickman/styleContract.ts, not
 * built this pass) analogous to visualWorldStyle.ts's STYLE_PRESETS map —
 * the same insertion point compileScenePrompt already uses for the
 * documentary path's [STYLE LOCK] block.
 */
export type StickmanStyleContract = {
  recipe: "STICKMAN_DOODLE_EXPLAINER";
  version: number;
  compiledStyleHeader: string; // ~90 words, inserted verbatim into every prompt
  compiledAvoidTail: string; // routed to negativePrompt when the renderer supports it (see IMAGE_MODEL_CAPABILITIES), else appended
  expressionModifiersAllowed: string[]; // the ONLY face additions permitted beyond the base construction
  textTreatment: { style: string; maxWords: number; defaultMode: "NO_TEXT" };
  forbiddenStyles: string[];
};

/* ============================ Production Bible (new, per-project, versioned) ============================
 * Recommended storage: a new, small table `long_form_production_bibles`
 * (id, project_id, script_version_id, generation_profile_id, recipe_version,
 * bible_version, status['draft'|'frozen'], bible jsonb, created_at) —
 * mirrors the existing long_form_visual_world_versions/long_form_
 * narration_contract_versions versioned-artifact pattern. NOT created by
 * this pass (schema-design only, per the instruction to design/report
 * rather than migrate further this same turn) — this type describes the
 * `bible` jsonb column's shape once that table exists.
 */
export type ContinuityMode = "HERO" | "ENSEMBLE" | "SUBJECT" | "NONE";
export type CastTier = "HERO" | "RECURRING" | "ROLE_ARCHETYPE" | "INCIDENTAL" | "CROWD";

export type CastMember = {
  id: string; // internal only, never reaches provider text
  tier: CastTier;
  subjectType: "human" | "animal" | "object_character" | "celestial" | "machine";
  role: string; // plain-language narrative role, e.g. "second-person viewer avatar, modern era"
  identityAnchors: string[]; // 4-6 discrete, QA-checkable features
  blocks: {
    identity: string; // canonical prose, inserted WORD-FOR-WORD, never re-authored per beat
    full: string;
    handsOnly: string;
    backView: string;
    tinyInFrame: string;
  };
  outfitVariants: { key: string; when: string; identity: string }[]; // each a FULL replacement block, never a patch like "same but in pajamas"
  expressionBaseline: string;
  realPerson: { name: string; policy: "GENERIC_ROLE_FIGURE_NO_LIKENESS" } | null;
};

export type Setting = {
  id: string;
  identity: string;
  eraGeo: string;
  palette: string[];
  layers: { background: string; midground: string; foreground: string };
  signatureObjects: string[];
  variants: { key: string; block: string; lighting: string }[]; // each a FULL canonical block
  forbiddenLeakage: string[]; // auto-populated from OTHER settings in this same project, never a global list
};

export type Prop = {
  id: string;
  canonicalBlock: string;
  appearsInBeatIds: string[]; // >= 2 required to earn a locked block at all
};

export type Motif = {
  id: string;
  plantBeatId: string;
  payoffBeatIds: string[];
  canonicalConcept: string;
  canonicalComposition: string;
  canonicalText: string | null;
  reusePolicy: "RERENDER_SAME_PROMPT" | "REUSE_IMAGE" | "VARIATION";
};

export type StickmanProductionBible = {
  recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1";
  bibleVersion: number;
  continuityMode: ContinuityMode;
  cast: CastMember[];
  settings: Setting[];
  props: Prop[];
  motifs: Motif[];
  textRules: { defaultMode: "NO_TEXT"; maxTextBeatsPerMinute: number; reservedStrings: string[] };
  lintVocabulary: { forbiddenTerms: string[] }; // project-specific leakage terms, e.g. era-bound vocabulary from a DIFFERENT case
};

/* ============================ BeatContract (lives inside the EXISTING visual_plan.visualBeats[]) ============================
 * No new container. A Stickman project's visualBeats[] items carry this
 * shape instead of the legacy VisualBeat shape — the Visual Plan table,
 * versioning, and adoption gates are unchanged.
 */
export type TextIntentMode = "NO_TEXT" | "SHORT_TEXT_ALLOWED" | "PROGRAMMATIC_TEXT_REQUIRED";

export type TextIntent = {
  mode: TextIntentMode;
  primary: { string: string; zone: "TOP_THIRD" | "CENTER" | "CUSTOM"; style: "RECIPE_HEADLINE" } | null;
  secondary: { string: string; on: string }[];
  reservedZone: "BOTTOM_SIXTH" | null; // PROGRAMMATIC only
};

export type BeatContract = {
  beatId: string;

  // Section F: narrative timing is the master clock, not a guess made before
  // it. narrationSegmentIds is the same join-key PATTERN NarrationClaim
  // already uses against script_document.narrationSegments[].
  narrationSegmentIds: string[];
  narration: string; // exact script excerpt — must remain visible/auditable beside the planned visual (Section G)
  audioStartSeconds: number;
  audioEndSeconds: number;
  timingSource: TimingSource; // ESTIMATED until the Phase 1.5 TTS stage exists for this project; TTS_ALIGNED once it does — same field either way, never a schema change to switch

  visualConcept: string; // THE key field — "what should the viewer see that makes this exact narration instantly understandable or emotionally stronger", never "X appears in the scene"
  userSummary: string; // shorter, plain-language version shown in the UI — never an internal id or planner phrase
  treatment: string; // e.g. STORY_SCENE | CHARACTER_REACTION | POV_SHOT | ... (see the Stickman audit's Section 7.1 list)

  subjects: { castId: string; presence: "full" | "handsOnly" | "backView" | "tinyInFrame"; action: string; expression: string }[];
  incidentals: string[];
  settingId: string;
  settingVariant: string;
  props: string[];
  composition: { camera: string; framing: string; layout: string };
  textIntent: TextIntent;
  motif: { motifId: string; role: "PLANT" | "PAYOFF" } | null;

  renderPolicy: "FRESH" | "REUSE_MOTIF" | "DETERMINISTIC_GRAPHIC" | "COMPOSITE_SPLIT";

  // Reproducibility — every scene must trace back to the exact configuration
  // that produced it (Section C).
  productionBibleVersionId: string;
  generationProfileId: string;
};
