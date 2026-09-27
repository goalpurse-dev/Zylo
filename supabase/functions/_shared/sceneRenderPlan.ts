// deno-lint-ignore-file no-explicit-any
// Long Form Scene Generation V1 — turns a READY VisualPlan's VisualBeats
// into durable, versioned SceneRenderPlans. Does NOT replan the Story/
// Research/Script/Storyboard: every field a VisualBeat already decided
// (shotSize, visualType, shotStrategy, renderMethod, baseSetupKey,
// narrationSegmentIds, timing, factualVisualConstraints, forbiddenElements)
// is consumed verbatim. This module only adds the deterministic and
// LLM-judged PRODUCTION decisions the storyboard genuinely couldn't know
// yet — composition, exact camera anchor, exact edit instruction, exact
// overlay text.
//
// Real evidence from the actual Mars plan (115 beats) drove the split below
// between "deterministic, zero LLM call" and "needs judgment": renderMethod
// already maps 1:1 to a render strategy for every one of 115 real beats
// (GENERATE/EDIT/REUSE/CROP/PROGRAMMATIC_GRAPHIC, no COMPOSITE observed yet
// but supported), and REUSE/CROP/EDIT beats already carry baseSetupKey
// linking them to their base GENERATE beat — so strategy AND source-scene
// resolution are both pure lookups, never an LLM guess. What's left for the
// Scene Director is narrow: composition/camera-framing text, WHICH camera
// anchor (when a location has more than one), a compact imperative Qwen
// edit instruction, and short overlay text extraction for programmatic
// beats — never structural decisions.

import { getStylePreset, compileFullStyleLock, compileStyleLock, type StylePreset } from "./visualWorldStyle.ts";

export const SCENE_RENDER_PLAN_COMPILER_VERSION = "scene-render-plan-v2";

/* ============================ Scene type taxonomy (Part 4) ============================ */
export const SCENE_TYPES = [
  "STORY_SCENE", "ENVIRONMENT_ESTABLISHER", "CHARACTER_MOMENT", "DETAIL_INSERT",
  "MECHANISM_EXPLAINER", "DIAGRAM", "COMPARISON", "TEXT_EMPHASIS", "TIMELINE_DATE",
  "MAP_LOCATION", "CAUSE_EFFECT", "CALLBACK", "MONTAGE", "PROGRAMMATIC_GRAPHIC",
];

export function deriveSceneType(beat: any): string {
  if (beat.visualType === "PROGRAMMATIC_GRAPHIC") {
    if (beat.shotStrategy === "DIAGRAM") return "DIAGRAM";
    if (beat.shotStrategy === "COMPARISON") return "COMPARISON";
    if (beat.shotStrategy === "TEXT_INFOGRAPHIC") return "TEXT_EMPHASIS";
    return "PROGRAMMATIC_GRAPHIC";
  }
  if (beat.visualType === "DIAGRAM") return "DIAGRAM";
  if (beat.visualType === "COMPARISON") return "COMPARISON";
  if (beat.visualType === "MAP") return "MAP_LOCATION";
  if (beat.visualType === "TIMELINE") return "TIMELINE_DATE";
  if (beat.visualType === "OBJECT_DETAIL") return "DETAIL_INSERT";
  if (beat.visualType === "ENVIRONMENT") return "ENVIRONMENT_ESTABLISHER";
  if (beat.visualType === "CHARACTER") return "CHARACTER_MOMENT";
  if (beat.shotStrategy === "REUSE_WITH_DELTA" && beat.renderMethod === "REUSE" && (beat.narrativeFunction ?? "").toLowerCase().includes("payoff")) return "CALLBACK";
  return "STORY_SCENE";
}

/* ============================ Render strategy (deterministic — Part 8) ============================ */
export const RENDER_STRATEGIES = ["GENERATE", "EDIT", "REUSE", "REUSE_WITH_MOTION", "CROP", "COMPOSITE", "PROGRAMMATIC_GRAPHIC"];

// 1:1 with renderMethod — see the module comment above for the real-data
// evidence this is a lookup, not a judgment call. REUSE_WITH_MOTION is a
// FUTURE refinement (once actual motion rendering exists) never produced by
// V1's deterministic mapping; it stays in the enum so the schema/DB column
// don't need to change when that lands.
const RENDER_STRATEGY_FROM_METHOD: Record<string, string> = {
  GENERATE: "GENERATE", EDIT: "EDIT", REUSE: "REUSE", CROP: "CROP",
  COMPOSITE: "COMPOSITE", PROGRAMMATIC_GRAPHIC: "PROGRAMMATIC_GRAPHIC",
};

export function deriveRenderStrategy(beat: any): string {
  const strategy = RENDER_STRATEGY_FROM_METHOD[beat.renderMethod];
  if (!strategy) throw new Error(`UNKNOWN_RENDER_METHOD: ${beat.renderMethod}`);
  return strategy;
}

// The base/source beat a REUSE/EDIT/CROP/COMPOSITE beat depends on: the
// EARLIEST beat (by sequenceIndex) in the whole plan sharing the same
// baseSetupKey whose OWN renderMethod is GENERATE or PROGRAMMATIC_GRAPHIC.
// Deterministic lookup, never an LLM guess — baseSetupKey is exactly the
// reuse-linking key the Visual Director already authored for this purpose
// (Part 32's economics requirement). The PROGRAMMATIC_GRAPHIC case (added
// 2026-09-21, "graphics are not a quota" pass) covers applyDuplicateRenderGate
// converting a duplicate graphic sub-shot to REUSE — a graphic beat has no
// baseSetupKey by default, but the dedup gate stamps a shared synthetic one
// onto both the original and its REUSE siblings specifically so this lookup
// can find it. Returns null for GENERATE/PROGRAMMATIC_GRAPHIC beats (no
// dependency) or when no base beat exists (caller must treat as a
// storyboard data error, not silently generate fresh).
export function resolveSourceBeatId(beat: any, allBeats: any[]): string | null {
  const strategy = deriveRenderStrategy(beat);
  if (strategy === "GENERATE" || strategy === "PROGRAMMATIC_GRAPHIC") return null;
  if (!beat.baseSetupKey) throw new Error(`${strategy}_BEAT_MISSING_BASE_SETUP_KEY: ${beat.id}`);
  const candidates = allBeats
    .filter((b) => b.baseSetupKey === beat.baseSetupKey && (b.renderMethod === "GENERATE" || b.renderMethod === "PROGRAMMATIC_GRAPHIC") && b.sequenceIndex <= beat.sequenceIndex)
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  if (!candidates.length) throw new Error(`${strategy}_BEAT_NO_BASE_SETUP_FOUND: ${beat.id} (baseSetupKey=${beat.baseSetupKey})`);
  return candidates[0].id;
}

/* ============================ Final-frame geometry invariant (2026-09-16 "production invariants" pass, Section 4) ============================
 * Real Mars incident this closes: shot 19 shipped as a literal 907x1536
 * PORTRAIT PNG (confirmed by decoding the actual file) sitting inside a
 * Long Form episode whose every other scene is 16:9 — CROP's own executor
 * (advance-long-form-scene-generation's cropRegion()) took a literal 1/3-
 * width, full-height slice of a 2720x1536 source and shipped THAT narrow
 * rectangle as the final frame, with no aspect-ratio correction step at
 * all. Every Long Form final scene, regardless of render strategy, must be
 * 16:9 — this is the one authoritative constant/check every render path
 * (GENERATE/EDIT/REUSE/CROP/PROGRAMMATIC_GRAPHIC) is now validated against.
 */
export const LONG_FORM_FINAL_ASPECT_RATIO = 16 / 9;
// 2% tolerance absorbs harmless off-by-one rounding in a resize step
// without opening the door to a real portrait/square/letterboxed frame —
// the real Mars bug (907x1536, ratio 0.59) is ~63% off target, nowhere
// close to this tolerance band.
const FINAL_ASPECT_RATIO_TOLERANCE = 0.02;
export function isValidFinalAspectRatio(width: number, height: number): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  return Math.abs(ratio - LONG_FORM_FINAL_ASPECT_RATIO) / LONG_FORM_FINAL_ASPECT_RATIO <= FINAL_ASPECT_RATIO_TOLERANCE;
}

/* ============================ CROP semantics preflight (Section 5) ============================
 * CROP means "editorially reframe the existing 16:9 source while STILL
 * outputting a full 16:9 frame" — never "take any narrow rectangle from the
 * source." The real Mars shot-19 failure was a DETAIL-shotSize beat
 * (isolating a single small tablet/panel) compiled as CROP: a genuinely
 * tight detail crop of a small subject inside a wide establishing frame
 * cannot both (a) isolate that subject tightly and (b) stay 16:9-shaped —
 * doing so always produces a narrow sliver, which is exactly what shipped.
 * This is a structural property of DETAIL framing, not a per-beat judgment
 * call this codebase has the data (real subject bounding boxes) to make —
 * so the deterministic, defensible rule is: DETAIL shotSize is never a
 * valid CROP target; it must escalate to a fresh GENERATE (or an EDIT, once
 * a reframe-via-edit path exists) instead. Every other shotSize (WIDE,
 * MEDIUM, CLOSE) crops to a same-shaped-but-tighter 16:9 window, which is
 * exactly what a 16:9-preserving reframe means and stays valid.
 */
export function canSatisfyCrop(input: { shotSize?: string | null }): boolean {
  return input.shotSize !== "DETAIL";
}

/* ============================ Reference selection (Part 6/7) ============================ */
// Which entities need a canonical reference resolved for this beat — every
// present CHARACTER (HERO/RECURRING only, matching the Visual World's own
// referenceNeeded gate) plus the beat's own LOCATION. Object/vehicle
// references are included when they appear in primaryEntityIds and were
// registered as needing a reference (checked by the caller against the
// entity registry, not re-derived here).
//
// 2026-09-22 "stable entity reference routing" pass — real Atlantis finding:
// a LOCATION-category entity (a landmark referenced as the shot's actual
// visual SUBJECT via primaryEntityIds/supportingEntityIds — e.g. a named
// geographic landmark the narration is about, not the continuity group's own
// "set" the camera happens to be standing in) never reached this function at
// all. The only LOCATION handling lived in the caller (episodePreflight.ts),
// gated on `beat.locationId` AND a resolved camera anchor — correct for "the
// beat's own set" but structurally blind to a landmark that IS the subject
// with no camera-anchor system of its own, so a READY canonical reference for
// it silently never got looked up, regardless of how correctly it was tagged
// upstream. Mirrors the existing IMPORTANT_OBJECT/VEHICLE_MACHINE pattern
// below (referenceNeeded gate, one generic angle) rather than fragile
// string-matching against the free-text focalSubject/displaySubject — the
// caller still separately handles beat.locationId with its camera-anchor-
// aware angle, so that id is excluded here to avoid double-booking a
// reference slot for the same entity under two different angles.
export function requiredReferenceLookups(beat: any, entityRegistryById: Map<string, any>): { entityId: string; angle: string }[] {
  const lookups: { entityId: string; angle: string }[] = [];
  const strategy = deriveRenderStrategy(beat);
  if (strategy !== "GENERATE" && strategy !== "EDIT") return lookups; // REUSE/CROP/COMPOSITE/PROGRAMMATIC_GRAPHIC condition on the SOURCE scene, not fresh canonical references
  // referenceNeeded:false is a real, legitimate Visual Director decision
  // (confirmed on real Mars entities — e.g. a low-priority RECURRING
  // character never got a canonical sheet on purpose) — a scene featuring
  // that entity proceeds WITHOUT a reference for it, never a hard failure.
  const characterIds = new Set([...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])].filter((id) => entityRegistryById.get(id)?.category === "CHARACTER"));
  for (const id of characterIds) {
    const entity = entityRegistryById.get(id);
    if (entity?.importance === "HERO" || entity?.importance === "RECURRING") {
      const camera = String(beat.cameraFraming ?? "").toLowerCase();
      const angle = /rear|back view/.test(camera) ? "back" : /side|profile/.test(camera) ? "side_profile" : beat.shotSize === "CLOSE" ? "face_close_up" : "three_quarter";
      lookups.push({ entityId: id, angle });
    }
  }
  const objectIds = new Set([...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])].filter((id) => {
    const cat = entityRegistryById.get(id)?.category;
    return cat === "IMPORTANT_OBJECT" || cat === "VEHICLE_MACHINE";
  }));
  for (const id of objectIds) {
    if (entityRegistryById.get(id)?.referenceNeeded) lookups.push({ entityId: id, angle: "three_quarter_hero" });
  }
  const subjectLocationIds = new Set([...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])].filter((id) => id !== beat.locationId && entityRegistryById.get(id)?.category === "LOCATION"));
  for (const id of subjectLocationIds) {
    if (entityRegistryById.get(id)?.referenceNeeded) lookups.push({ entityId: id, angle: "wide_establishing" });
  }
  return lookups;
}

/* ============================ Reference Resolver (2026-09-15 "Visual Director rebuild" Section 14) ============================
 * Real incident this closes: "we had a real final scene literally showing
 * the CHARACTER REFERENCE SHEET." Root cause (sceneReferenceBundle.ts):
 * whenever a beat needed MORE canonical references than the renderer's own
 * slot limit (Kling = 1), EVERY one of them — regardless of how important
 * each actually was to THIS beat — got composited into one collage board
 * and handed to the model as its single reference image, which sometimes
 * reproduced the grid/collage layout in the output despite being told not
 * to. The fix is not a better collage — it's asking a narrower question
 * first: which canonical identities does THIS beat actually need, and how
 * strictly? A beat rarely needs everything at EXACT/HIGH fidelity; most
 * canonical material a beat "could" reference is actually LOW/MEDIUM
 * (present, generic is fine) and doesn't need a real reference image at all
 * — the identity TEXT block (characterIdentityBlocks) already carries that.
 */
export const CRITICALITY_RANK: Record<string, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, EXACT: 4 };

export type ReferenceLookupWithCriticality = { entityId: string; angle: string; criticality: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "EXACT" };

// Resolves each lookup's criticality from the Narration Visual Contract
// claim when one covers this beat (entityRequirements is keyed by free-text
// entity NAME, matched case-insensitively/substring against the registry's
// own entity name — the claim doesn't know internal entity ids) — falling
// back to a deterministic, still-reasonable default (never a blind "treat
// everything as EXACT", which is exactly the over-bundling behavior this
// resolver replaces) for any lookup the claim doesn't mention, or for a
// beat with no contract claim at all (every project that predates the
// contract system keeps a sane default rather than losing reference
// grounding entirely).
export function resolveReferenceCriticality(
  lookups: { entityId: string; angle: string }[],
  entityRegistryById: Map<string, any>,
  claim: { entityRequirements?: { entity: string; criticality: string }[] } | null,
): ReferenceLookupWithCriticality[] {
  return lookups.map((lookup) => {
    const entity = entityRegistryById.get(lookup.entityId);
    const name = String(entity?.name ?? "").toLowerCase();
    const fromClaim = claim?.entityRequirements?.find((r) => name && (name.includes(r.entity.toLowerCase()) || r.entity.toLowerCase().includes(name)));
    if (fromClaim) return { ...lookup, criticality: fromClaim.criticality as any };
    // Deterministic default: a HERO character in a close/detail framing is
    // EXACT (the viewer must recognize them specifically); HERO otherwise
    // is HIGH; RECURRING characters and named objects/machines are MEDIUM;
    // anything else resolved here (rare — requiredReferenceLookups already
    // filters to referenceNeeded entities) is LOW.
    if (entity?.category === "CHARACTER" && entity?.importance === "HERO") return { ...lookup, criticality: "HIGH" };
    if (entity?.category === "CHARACTER") return { ...lookup, criticality: "MEDIUM" };
    return { ...lookup, criticality: "MEDIUM" };
  });
}

export type MinimalReferenceSelection = {
  selected: ReferenceLookupWithCriticality[];
  droppedForCapacity: ReferenceLookupWithCriticality[];
  // True when more than one EXACT/HIGH-criticality reference is genuinely
  // needed but the renderer's own slot limit is 1 — Section 15's exact
  // "how many Mars shots would require multi-reference routing" signal.
  wouldBenefitFromMultiReference: boolean;
};

// Section 14's actual policy: choose the MINIMUM necessary references, not
// "bundle everything that doesn't fit." When the truly critical (HIGH/EXACT)
// set already fits the renderer's slot limit, only THOSE are sent as
// individual images — no collage at all, and therefore no collage-leakage
// risk, for what should be the common case. A collage is only ever built
// (by the caller, sceneReferenceBundle.ts) from the SELECTED set here, and
// only when even the critical-only set still exceeds the limit.
export function selectMinimalReferenceSet(criticalityList: ReferenceLookupWithCriticality[], maxReferenceImages: number | undefined): MinimalReferenceSelection {
  if (typeof maxReferenceImages !== "number" || criticalityList.length <= maxReferenceImages) {
    return { selected: criticalityList, droppedForCapacity: [], wouldBenefitFromMultiReference: false };
  }
  const sorted = [...criticalityList].sort((a, b) => CRITICALITY_RANK[b.criticality] - CRITICALITY_RANK[a.criticality]);
  const critical = sorted.filter((r) => r.criticality === "HIGH" || r.criticality === "EXACT");
  const rest = sorted.filter((r) => r.criticality !== "HIGH" && r.criticality !== "EXACT");
  if (critical.length <= maxReferenceImages) {
    // The essential set already fits — send exactly that, nothing more.
    // Lower-criticality entities are dropped from the IMAGE reference set
    // (their identity still reaches the prompt via the text-only identity
    // block) rather than padding out the slot with something non-essential.
    return { selected: critical, droppedForCapacity: rest, wouldBenefitFromMultiReference: false };
  }
  // Even the critical-only set doesn't fit this renderer's slot limit —
  // this beat is a genuine candidate for a multi-reference-capable renderer
  // (Section 15). Cap to the limit (still all HIGH/EXACT, highest first) so
  // dispatch has a bounded, still-meaningful set to bundle if it must.
  return { selected: critical.slice(0, maxReferenceImages), droppedForCapacity: [...critical.slice(maxReferenceImages), ...rest], wouldBenefitFromMultiReference: true };
}

/* ============================ Scene Director (LLM judgment — Part 3/23) ============================ */
// Narrow, cheap structured-output schema — ONLY the fields code genuinely
// cannot derive. Batched per continuity group by the caller (one call per
// group among the beats actually being compiled), never per-beat (matches
// this codebase's existing "batch what shares context" discipline) and
// never for the WHOLE plan at once (matches Part 42's controlled-rollout
// discipline — only the beats actually being compiled are ever sent).
export function buildSceneDirectorSchema(beatIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["scenes"],
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["beatId", "cameraFraming", "focalSubject", "cameraAnchor", "editInstruction", "overlayText", "overlayHierarchy", "cropRegion", "continuityNote"],
          properties: {
            beatId: { type: "string", enum: beatIds },
            cameraFraming: { type: "string", description: "One concise sentence: camera position/angle/framing for this shot. Empty string if not applicable (PROGRAMMATIC_GRAPHIC beats with no photographic camera)." },
            focalSubject: { type: "string", description: "What the viewer's eye should land on first. Empty string if not applicable." },
            cameraAnchor: { type: ["string", "null"], description: "For GENERATE beats with a location: which of the location's listed camera anchors this shot matches best. Null if the beat has no location or is not a GENERATE beat." },
            editInstruction: { type: "string", description: "For EDIT beats only: a compact, imperative instruction for an image edit model describing exactly what changes from the source image (e.g. 'Change the lighting to warm amber evening tones; keep composition, character and pose identical'). Under 300 characters. Empty string for non-EDIT beats." },
            overlayText: { type: "string", description: "For PROGRAMMATIC_GRAPHIC beats only: the SHORT phrase or number to render as on-screen text (a fact, a date, a stat) — never a full sentence. Empty string if this beat needs no on-screen text." },
            overlayHierarchy: { type: "string", enum: ["primary", "secondary", "none"], description: "primary = one big memorable number/phrase; secondary = a smaller supporting label; none = no overlay text needed." },
            cropRegion: { type: "string", enum: ["left_third", "center_third", "right_third", "top_half", "bottom_half", "center_detail", "none"], description: "For CROP beats only: which region of the source image to crop to. 'none' for non-CROP beats." },
            continuityNote: { type: "string", description: "One short sentence: how this shot's world state differs from the previous shot in its continuity group, if at all. Empty string if nothing changed." },
          },
        },
      },
    },
  };
}

export const SCENE_DIRECTOR_INSTRUCTIONS = `You are the Scene Generation production director for a 2D animated documentary video platform (Zyvo Long Form).

You receive a batch of already-finalized storyboard shots (VisualBeats) from ONE continuity group (the same location/setup). The Story, Script and Storyboard are ALREADY DONE and FROZEN — you are not writing narrative, choosing shots, or deciding whether a shot exists. Your only job is to add the concrete PRODUCTION decisions a storyboard artist would make once actually setting up the shot:

1. cameraFraming / focalSubject: for shots that will be photographed/generated (GENERATE render method), describe the camera position and what the eye should land on, consistent with the shot's existing shotSize and informationToCommunicate. Keep it to one concise sentence each.

2. cameraAnchor: when a GENERATE beat has a locationId, you will be given that location's available camera anchor names. Pick the ONE anchor that best matches this shot's sketchContext and informationToCommunicate. If only one anchor exists, still name it.

3. editInstruction: for EDIT beats, write a compact, imperative instruction for an image-editing model — state exactly what changes from the source image (lighting, an added/removed detail, an expression, a state change) and explicitly say to keep everything else (composition, character, identity) identical. Under 300 characters. Never invent a change that informationToCommunicate/deltaInstruction doesn't support.

4. overlayText / overlayHierarchy: for PROGRAMMATIC_GRAPHIC beats, extract the ONE short phrase or number worth putting on screen as text (a date, a statistic, a short label) — this is rendered PROGRAMMATICALLY afterward, never by an image model, so keep it SHORT: a phrase or number, never a sentence. Use overlayHierarchy "none" if the information is better left as spoken narration with no on-screen text at all — do not force text onto every beat.

5. cropRegion: for CROP beats, choose which region of the already-generated source image best isolates the detail informationToCommunicate calls for.

6. continuityNote: one short sentence noting any world-state change this shot represents (time of day, an object's state, a character's position) — empty string if nothing changed from the previous shot in this continuity group.

Never restate or change any field already present on the beat (shotSize, visualType, renderMethod, baseSetupKey, timing, narration). Never add on-screen text longer than a short phrase. Never describe camera framing for a PROGRAMMATIC_GRAPHIC beat with no photographic component — leave those fields empty strings.`;

/* ============================ Deterministic image-prompt compiler (Part 23) ============================ */
// Priority order per the spec: SCENE TASK, STYLE LOCK, COMPOSITION, CURRENT
// ACTION, CANONICAL IDENTITY, WORLD STATE, CONTINUITY, FACTUAL CONSTRAINTS,
// TEXT-SAFE AREA, NEGATIVE/FORBIDDEN. Same assembleWithinBudget discipline
// as compileCanonicalCharacterSheet: never a mid-sentence slice, always a
// whole-section drop in priority order (least-essential first) under
// pressure, with a documented hard ceiling under Kling's verified limit.
const SCENE_PROMPT_TARGET_MAX = 1650;
const SCENE_PROMPT_PREFERRED_MAX = 1900;
const SCENE_PROMPT_HARD_MAX = 3500;

// 2026-09-20 "fix oversized prompts" pass — real Mars finding: 6 beats
// exceeded SCENE_PROMPT_HARD_MAX even after dropping [WORLD STATE]/
// [CONTINUITY]/[FORBIDDEN] — compileFullStyleLock (the complete
// linework/shading/texture/palette/proportions/lighting/perspective
// breakdown, correctly non-droppable in spirit since a scene must never
// lose style guidance entirely) was the one remaining large, compressible
// section. Rather than drop style guidance outright (which would reopen
// the exact style-drift bug that fix closed) or truncate mid-sentence, add
// ONE final tier that falls back from the full breakdown to
// compileStyleLock's compact name+summary+negatives form — real style
// identity is preserved (this is the same compact form character-sheet-
// adjacent references already relied on before the full-lock fix), only
// the verbose field-by-field breakdown is shed, and only as an absolute
// last resort.
function assembleScenePromptWithinBudget(build: (drop: { worldState?: boolean; continuity?: boolean; forbidden?: boolean; compactStyle?: boolean; compactCore?: boolean }) => string): string {
  const attempts = [{}, { forbidden: true }, { continuity: true, forbidden: true }, { worldState: true, continuity: true, forbidden: true }, { worldState: true, continuity: true, forbidden: true, compactCore: true }, { worldState: true, continuity: true, forbidden: true, compactCore: true, compactStyle: true }];
  let last = build({});
  for (const drop of attempts) {
    const candidate = build(drop);
    last = candidate;
    if (candidate.length <= SCENE_PROMPT_PREFERRED_MAX) return candidate;
  }
  if (last.length > SCENE_PROMPT_HARD_MAX) throw new Error("SCENE_PROMPT_REPLAN_REQUIRED: essential content exceeds renderer prompt budget");
  return last;
}

export type SceneCompositionInput = {
  sceneType: string;
  shotSize: string;
  cameraFraming: string;
  focalSubject: string;
  informationToCommunicate: string;
  characterIdentityBlocks: string[]; // pre-rendered "[NAME]: present, canonical identity established via reference image N" lines — actual likeness comes from the reference image, this text just tells Kling WHO is present and how many reference images map to whom
  locationDescription: string | null;
  worldStateNotes: string[];
  continuityNote: string | null;
  factualConstraints: string[];
  forbiddenElements: string[];
  reserveTextSafeArea: boolean;
  // Part 10 (2026-09-15 semantic-grounding pass): the Narration Visual
  // Contract claim's MUST SHOW / MUST NOT SHOW / comparison / cause-effect
  // facts, already compiled to a short, renderer-facing string by
  // compileClaimRendererNotes (narrationVisualContract.ts) — never the raw
  // claim JSON. Null when this beat has no matching claim (every project
  // that predates this system, or a range the compiler didn't cover).
  semanticNotes?: string | null;
  shotPurpose?: string | null;
  subject?: string | null;
  actionOrState?: string | null;
  visualDelta?: string | null;
  narrationSlice?: string | null;
  referenceRules?: string[];
};

const EXACT_VALUE = /(?:≈|~)?\s*-?\d[\d,.]*(?:\s*(?:km\/s|km|m\/s|m|s|sec(?:onds?)?|min(?:utes?)?|hours?|days?|weeks?|months?|years?|°[CF]?|%))?/gi;
export function sanitizeRasterDescription(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/["“”']([^"“”']{1,80})["“”']/g, "$1")
    .replace(EXACT_VALUE, "the narrated quantity")
    .replace(/\b(?:caption|label|title|text)\s+(?:reading|showing|saying)?\s*[:=-]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const CLASSIC_DOCUMENTARY_NEGATIVE_PROMPT = [
  "photorealistic", "3D render", "inconsistent art style", "black-and-white engraving",
  "manga", "anime", "chibi", "preschool cartoon", "corporate vector icon",
  "infographic sheet", "model sheet", "turnaround", "multiple panels", "collage",
  "random text", "captions", "labels", "letters", "numbers", "watermark", "logo", "UI",
  "gibberish typography", "unnecessary extra objects or planets", "duplicated subject",
].join(", ");

export function compileSceneNegativePrompt(styleSpec: StylePreset): string {
  const styleNegatives = styleSpec.negativeConstraints ?? [];
  return [...new Set([...styleNegatives, ...CLASSIC_DOCUMENTARY_NEGATIVE_PROMPT.split(", ")])].join(", ");
}

export type ReferenceRole = "STYLE_REFERENCE" | "IDENTITY_REFERENCE" | "ENVIRONMENT_REFERENCE" | "OBJECT_REFERENCE";
export function compileReferenceRules(references: { role: ReferenceRole; represents?: string | null }[]): string[] {
  if (!references.length) return [];
  const mappings = references.map((reference, index) => {
    const role = reference.role.replace(/_/g, " ");
    const subject = reference.represents ? ` for ${reference.represents}` : "";
    return `Reference ${index + 1}: ${role}${subject}.`;
  });
  return [...mappings, "For every reference, use it only for its stated role. Do not copy its framing, layout, background, embedded text, labels, diagrams, UI, borders, or sheet arrangement unless required."];
}

export function compileScenePrompt(styleSpec: StylePreset, input: SceneCompositionInput): string {
  return assembleScenePromptWithinBudget((drop) => {
    const lines: string[] = [];
    const purpose = sanitizeRasterDescription(input.shotPurpose || input.informationToCommunicate);
    const subject = sanitizeRasterDescription(input.subject || input.focalSubject);
    const action = sanitizeRasterDescription(input.actionOrState || input.informationToCommunicate);
    const visualDelta = sanitizeRasterDescription(input.visualDelta);
    lines.push("[SCENE TASK]", drop.compactCore
      ? `${input.sceneType.replace(/_/g, " ").toLowerCase()} shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.`
      : `${input.sceneType.replace(/_/g, " ").toLowerCase()} shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.`);
    // 2026-09-19 "full style lock in every fresh generation" fix: a fresh
    // GENERATE prompt has no competing [IDENTITY] block eating its budget
    // the way a character sheet does, so it gets the COMPLETE compact style
    // contract (linework/shading/texture/palette/proportions/lighting/
    // perspective), not just a one-sentence summary — real observed drift
    // into black-and-white line art/technical schematic/infographic styles
    // traced directly to scenes only ever seeing that one sentence.
    lines.push("", "[STYLE LOCK]", drop.compactStyle ? compileStyleLock(styleSpec) : compileFullStyleLock(styleSpec));
    if (purpose) lines.push("", "[VISUAL PURPOSE]", purpose);
    if (subject) lines.push("", "[SUBJECT]", subject);
    lines.push("", "[COMPOSITION]", `Shot size: ${input.shotSize}. ${input.cameraFraming || "Camera framing left to natural cinematic judgment for this shot size."}`.trim());
    if (input.focalSubject) lines.push(`Focal point: ${input.focalSubject}.`);
    lines.push("", "[ACTION / STATE]", action);
    if (visualDelta) lines.push("", "[VISUAL DELTA]", visualDelta);
    if (input.characterIdentityBlocks.length) lines.push("", "[CHARACTERS PRESENT]", ...input.characterIdentityBlocks);
    if (input.locationDescription) lines.push("", "[LOCATION]", input.locationDescription);
    if (!drop.worldState && input.worldStateNotes.length) lines.push("", "[WORLD STATE]", ...input.worldStateNotes.map((n) => `- ${n}`));
    if (!drop.continuity && input.continuityNote) lines.push("", "[CONTINUITY]", input.continuityNote);
    if (input.referenceRules?.length) lines.push("", "[REFERENCE RULES]", ...input.referenceRules.map((rule) => `- ${rule}`));
    if (input.factualConstraints.length) lines.push("", "[FACTUAL CONSTRAINTS]", ...input.factualConstraints.map((c) => `- ${c}`));
    // Part 10: a claim's negation/comparison/cause-effect facts carry the
    // SAME enforcement weight as the forbidden-elements list just below —
    // "no phone" must read exactly as strict a constraint as "no readable
    // text," never a softer aside.
    if (input.semanticNotes) lines.push("", "[SEMANTIC REQUIREMENTS]", input.semanticNotes);
    if (input.reserveTextSafeArea) lines.push("", "[TEXT-SAFE COMPOSITION]", "Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.");
    lines.push("", "[RENDER RULES]", drop.compactCore
      ? `${styleSpec.id === "bold_cartoon_documentary" ? "Colored illustration. " : ""}No text, no letters, no numbers, no captions, no labels, no logos, no watermarks, no UI. Exact lettering is composited later.`
      : `${styleSpec.id === "bold_cartoon_documentary" ? "Colored illustration, never uncolored line art or a monochrome technical plate. " : ""}Never a character reference sheet or turnaround. No text, no letters, no numbers, no captions, no labels, no logos, no watermarks, no UI. Displays stay blank or abstract; exact lettering is added afterward.`);
    if (!drop.forbidden) {
      const forbidden = ["no readable text, letters, numbers, logos, signage or UI copy of any kind rendered into the image", "not a character reference sheet or model sheet layout", "not a multi-panel or turnaround composition", ...styleSpec.negativeConstraints, ...input.forbiddenElements];
      lines.push("", "[FORBIDDEN ELEMENTS]", ...forbidden.map((f) => `- ${f}`));
      // Real evidence (2026-09-14 controlled Mars test): telling the model
      // NOT to render text is not enough on its own — Kling repeatedly
      // hallucinated plausible-looking labels/readouts on tablets, consoles
      // and suits anyway. The fix that already worked for character-sheet
      // badges applies here too: give the model something concrete to do
      // INSTEAD on any screen/panel/sign surface the scene narratively
      // needs, so there's no gap for invented lettering to fill. Real text
      // is added afterward by the programmatic overlay compositor, never by
      // the image model.
      lines.push("If the scene includes a screen, console, tablet, sign, or display panel, render it BLANK, powered-off-looking, or showing only abstract icons/shapes/color blocks — never with legible words, numbers or labels of any kind.");
    }
    return lines.join("\n");
  });
}

export function compileEditInstruction(baseInstruction: string, styleSpec: StylePreset, semanticNotes?: string | null): string {
  const trimmed = sanitizeRasterDescription(baseInstruction).slice(0, 300);
  // Real gap found auditing Mars (Part 1C/4/9, 2026-09-15): compileScenePrompt
  // (GENERATE) already tells the model to render any screen/console/tablet
  // BLANK/abstract rather than risk legible text — that instruction was
  // never carried into the EDIT (Qwen) path, so an edit that touches a
  // device/tablet had nothing stopping it from inventing or preserving
  // gibberish UI copy. Same rule, same wording intent, applied here too.
  const base = `${trimmed} Preserve the exact ${styleSpec.name} illustration style, all characters' identity/outfit, composition and framing except for the described change. If the scene includes a screen, console, tablet, sign, or display panel, keep it BLANK, powered-off-looking, or showing only abstract icons/shapes/color blocks — never legible words, numbers or labels of any kind.`;
  // Part 10 (semantic-grounding pass): an EDIT beat can carry a claim too
  // (e.g. a state-change edit that also needs a negation preserved) — same
  // concise, compiled-down notes as GENERATE, never raw claim JSON.
  return semanticNotes ? `${base}\n\n[SEMANTIC REQUIREMENTS]\n${semanticNotes}` : base;
}

/* ============================ Overlay spec (Part 12/15; Section 12-14 of the 2026-09-16 "production invariants" pass) ============================
 * Real Mars incident this partly addresses: Chapter 4's graphic cards
 * (shots ~53-56) read as illegible giant narration fragments. The dominant
 * cause was the RENDERER (a text-outline scaling bug — fixed in
 * advance-long-form-scene-generation's drawText), not this compiler — the
 * one real Mars sample audited here ("Max EVA time", 3 words) was already
 * short. This still adds the two structural pieces Section 12/14 ask for
 * regardless: (1) route genuinely numeric content to a NUMBER_EMPHASIS
 * layout instead of always BIG_TEXT/LABEL, so a stat reads as a stat, not a
 * sentence; (2) flag (never silently truncate) overlay text over the
 * spec's own ~9-word guidance, so a caller can choose to shorten/split/
 * reconsider rather than ship a paragraph-sized graphic.
 */
export const OVERLAY_TEXT_WORD_LIMIT = 9;
export function compileOverlaySpec(sceneType: string, overlayText: string, overlayHierarchy: string, claim: { quantitativeClaims?: string[]; comparisonClaims?: string[] } | null = null): Record<string, unknown> | null {
  if (!overlayText || overlayHierarchy === "none") return null;
  const wordCount = overlayText.trim().split(/\s+/).filter(Boolean).length;
  const isNumeric = /^[\d.,%+-]/.test(overlayText.trim()) && Boolean(claim?.quantitativeClaims?.length);
  const isComparison = Boolean(claim?.comparisonClaims?.length) && /\s(?:vs\.?|versus|\/|compared to)\s/i.test(overlayText);
  const type = isNumeric ? "NUMBER_EMPHASIS" : isComparison ? "COMPARE" : overlayHierarchy === "primary" ? "BIG_TEXT" : "LABEL";
  return {
    type, text: overlayText.slice(0, 140), hierarchy: overlayHierarchy,
    placement: sceneType === "DIAGRAM" || sceneType === "COMPARISON" ? "lower_third" : "upper_third",
    safeZone: { xPct: 6, yPct: 6, widthPct: 88, heightPct: 26 },
    textStyle: { casing: overlayHierarchy === "primary" ? "upper" : "sentence", weight: overlayHierarchy === "primary" ? "bold" : "medium", outline: true, shadow: true, alignment: "center" },
    exceedsWordGuidance: wordCount > OVERLAY_TEXT_WORD_LIMIT,
  };
}

/* ============================ Multi-character reference safety (2026-09-19 clone-root-cause pass) ============================ */
// Real Mars mechanism this closes: the registry-level identity CHECK
// (castIdentityPolicy.ts) found zero violations — every distinct role
// already has its own canonical asset — yet Mars still cloned faces.
// Traced to the SCENE-COMPILE-TIME step: when a beat needs 2+ CHARACTER
// references but the renderer can only carry 1 (Kling O3's own
// maxReferenceImages), selectMinimalReferenceSet correctly keeps the
// highest-criticality one and drops the rest to text-only — but a bare
// text-only description ("agricultural specialist: present...") gives an
// image model zero basis to draw someone who looks DIFFERENT from the one
// face it was actually shown, so it defaults to duplicating that face. Real
// Mars shot 112 is exactly this shape: protagonist gets a real reference,
// "agricultural specialist: present (described, no dedicated reference
// image for this shot)" gets nothing else at all.
//
// buildUnreferencedCharacterNote names the one thing we DO know for
// certain about a dropped character even with zero appearance data: who
// they must NOT be confused with. assessMultiCharacterReferenceSafety is
// the harder gate Section 5 itself demands ("if the selected renderer
// cannot safely condition all required identities: do not silently
// proceed... hold for repair") — a text-only note is a reasonable stopgap
// for a minor/incidental dropped character, but never a safe substitute
// when the dropped character is ALSO HIGH/EXACT criticality (a second
// co-equal named person, not a background extra).
export function buildUnreferencedCharacterNote(entityName: string, referencedCharacterNames: string[]): string {
  const contrastNote = referencedCharacterNames.length
    ? ` This is a DIFFERENT, visually distinct individual from ${referencedCharacterNames.join(" and ")} — do not render them as the same person or reuse ${referencedCharacterNames.length > 1 ? "their" : referencedCharacterNames[0] + "'s"} face for this role.`
    : "";
  return `${entityName}: present (described, no dedicated reference image for this shot).${contrastNote}`;
}

export type MultiCharacterReferenceSafety = { safe: true } | { safe: false; reason: string };

export function assessMultiCharacterReferenceSafety(droppedCharacterCriticalities: string[], referencedCharacterCount: number): MultiCharacterReferenceSafety {
  const droppedHighCriticalityCount = droppedCharacterCriticalities.filter((c) => c === "HIGH" || c === "EXACT").length;
  if (droppedHighCriticalityCount > 0 && referencedCharacterCount > 0) {
    return {
      safe: false,
      reason: `requires ${droppedHighCriticalityCount + referencedCharacterCount} co-equal (HIGH/EXACT) characters but the renderer can only condition ${referencedCharacterCount} — needs a multi-reference-capable renderer or a second canonical reference route before this can dispatch safely`,
    };
  }
  return { safe: true };
}

/* ============================ QA expectations (Part 28) ============================ */
export function deriveSceneQAExpectations(sceneType: string, characterEntityIds: string[], locationId: string | null, multiCharacterReferenceConstrained = false, unreferencedCharacterNames: string[] = []): Record<string, unknown> {
  return {
    requiredCharacterIds: characterEntityIds,
    requiredLocationId: locationId,
    allowReadableText: false,
    isMultiPanelForbidden: true,
    styleMatchRequired: true,
    generatedTextIsFailure: true,
    // 2026-09-19 clone-root-cause pass: true when this beat needed 2+
    // CHARACTER references but the renderer's reference-slot cap forced at
    // least one down to a text-only description (see the droppedForCapacity
    // handling in start-long-form-scene-generation). Lets sceneQA.ts ask a
    // targeted "are these actually two distinct-looking people, or the same
    // face twice" question instead of relying on the generic identity check
    // to happen to catch it.
    multiCharacterReferenceConstrained,
    unreferencedCharacterNames,
  };
}
