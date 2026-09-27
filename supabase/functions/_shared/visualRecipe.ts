// deno-lint-ignore-file no-explicit-any
// visualRecipe.ts — 2026-10-02 "narration-first / audio-first architecture"
// pass, Section K / prior Stickman audit Section 11.
//
// Skeleton only — no recipe implements this yet, and nothing calls it yet.
// This is the shared interface future recipes (Stickman first, then
// cinematic/anime/etc.) plug into, so a project's `visual_recipe` field
// (long_form_generation_profiles.visual_recipe) can dispatch to the right
// implementation without a scattered if/else at every call site. The
// existing "legacy" documentary/cinematic path (episodePreflight.ts's
// compileEpisodeBeat + sceneRenderPlan.ts's compileScenePrompt +
// visualShotPlanning.js's macro/shot planner) is NOT being refactored into
// this shape by this pass — it keeps working completely unchanged. Only a
// NEW recipe (Stickman) is expected to implement this interface; the legacy
// path can be wrapped later, as its own separate, deliberate migration, if
// ever useful.
//
// Every hook receives the frozen, versioned inputs it needs and nothing it
// would have to independently re-fetch or re-derive — no hook reaches into
// mutable project columns; the caller resolves those once from
// long_form_generation_profiles (see 20261002100000_long_form_generation_
// profile.sql) and passes them down explicitly. This is the same
// "authoritative object at every transition" principle already established
// for the existing pipeline (Task 5's Item H).

// Real per-beat timing provenance — every BeatContract must declare which
// kind of timing it carries, since Long Form has NO real per-word TTS today
// (confirmed: WORDS_PER_MINUTE=150 estimation in three independent places —
// advance-long-form-script/index.ts, generate-long-form-story-plan/
// index.ts, _shared/visualShotPlanning.js). ESTIMATED must remain fully
// supported so a recipe can ship before the new TTS stage (Phase 1.5)
// exists; TTS_ALIGNED must never require a schema change to adopt later —
// only a different value in this same field, on the same NarrationSegment/
// BeatContract shape.
export type TimingSource = "ESTIMATED" | "TTS_ALIGNED";

export type NarrationSegmentTiming = {
  segmentId: string;
  startSeconds: number;
  endSeconds: number;
  timingSource: TimingSource;
};

// The resolved, immutable production configuration every recipe hook reads
// from — one row of long_form_generation_profiles, never a live re-read of
// long_form_projects' own (mutable) columns.
export type GenerationProfile = {
  id: string;
  projectId: string;
  visualRecipe: string;
  recipeVersion: string;
  visualStylePreset: string | null;
  renderTier: "v2" | "v3" | "v4";
  rendererPolicyVersion: string;
  targetDurationMinutes: number;
  voiceProvider: string | null;
  voiceId: string | null;
  voiceModel: string | null;
  pacingProfile: string | null;
  generationMode: "full_episode" | "chapter_at_a_time";
  compilerVersions: Record<string, string>;
};

export interface VisualRecipe {
  readonly id: string; // e.g. "stickman_doodle_explainer"
  readonly version: string; // e.g. "STICKMAN_DOODLE_EXPLAINER_V1"

  // Static/deterministic — no LLM call, no per-project state. Returns the
  // recipe's own compiled Style Header + Avoid tail (see stickman/types.ts's
  // StickmanStyleContract for the concrete shape this recipe uses).
  styleContract(): unknown;

  // ONE LLM pass. Input is the FINAL, locked script (status:'ready') plus
  // its narrationSegments — never a draft. Output is validated, then frozen
  // via its own versioned table (see stickman implementation), never
  // embedded loosely inside the Visual Plan.
  buildBible(input: { admin: any; profile: GenerationProfile; scriptDocument: any }): Promise<unknown>;

  // Beat Director. Input includes the frozen bible AND real segment timing
  // (NarrationSegmentTiming[], ESTIMATED or TTS_ALIGNED) — never invents an
  // image-slot count before narration/timing exist. Output beats are written
  // into the SAME long_form_visual_plan_versions.visual_plan.visualBeats[]
  // container the legacy path already uses (no new container).
  directBeats(input: { admin: any; profile: GenerationProfile; bible: unknown; scriptDocument: any; segmentTimings: NarrationSegmentTiming[] }): Promise<unknown[]>;

  // Deterministic compile — same beat+bible+profile always produces the
  // byte-identical ProviderRequest. Reuses the existing render-plan/scene
  // row creation in compile-long-form-scenes; only the PROMPT ASSEMBLY
  // itself is recipe-specific.
  compile(input: { beat: unknown; bible: unknown; profile: GenerationProfile; rendererCapability: unknown }): { prompt: string; negativePrompt: string | null; referenceAssetIds: string[] };

  // Vision-judge rubric/prompt text only — never a different classification
  // structure. The caller still runs classifySceneQA (_shared/sceneQA.ts)
  // unchanged; this only supplies what question the judge is asked.
  qaRubric(input: { beat: unknown; bible: unknown }): unknown;

  // Which renderer this recipe prefers, given the real, measured
  // RendererCapability records (_shared/sceneRendererTiers.ts /
  // imageDimensionPolicy.ts's IMAGE_MODEL_CAPABILITIES) — never a
  // recipe-hardcoded model id.
  rendererPolicy(): unknown;

  // Whether/when this recipe escalates to a reference image for a given
  // entity — default OFF for Stickman, with the explicit escape hatch the
  // Stickman audit already confirmed the reference pipeline supports
  // (requiredReferenceLookups already returns [] for any entity with
  // referenceNeeded:false — no new bypass code needed, just this policy
  // deciding the flag).
  referencePolicy(): unknown;
}
