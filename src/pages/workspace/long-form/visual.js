// Naming/architecture anchor for the future VisualBeat Director / Entity
// Registry / Canonical Reference pipeline. Nothing here is wired up or
// persisted yet — no VisualBeat generation, entity extraction, reference
// generation, or scene rendering exists. This module exists so these
// concepts have a stable name and shape before Visual work starts, instead
// of each later phase inventing its own vocabulary. Full reasoning in
// VISUAL_ARCHITECTURE.md alongside this file.
//
// Engineering order: Research (current) → Script Engine → Visual
// Interpretation/VisualBeat Director → minimal Look/Visual Bible → canonical
// references → scene generation/editing → TTS/Audio → timeline/render. This
// file is schema groundwork only — it does not move that order forward.

// What kind of thing a VisualEntity is. Drives what reference strategy
// applies (see VISUAL_ARCHITECTURE.md "Reference generation is
// storyboard-driven").
export const ENTITY_CATEGORIES = ["CHARACTER", "LOCATION", "IMPORTANT_PROP_OR_OBJECT", "VEHICLE_OR_MACHINE", "DIAGRAM_SUBJECT"];

// How much reference investment an entity earns. Never shown to the user —
// an internal classification driving reference generation, not a label.
export const ENTITY_IMPORTANCE = ["HERO", "RECURRING", "INCIDENTAL"];

// One shared Visual Director, weighted differently per mode — not separate
// codebases. The Narrative/Topic system recommends a mode; the Visual
// Director determines the actual per-beat mix.
export const VISUAL_MODES = ["STORY", "EXPLAINER", "HYBRID"];

// Minimum V1 set. ARCHIVAL_STYLE/TIMELINE/CUTAWAY are later additions, not
// yet needed.
export const SHOT_STRATEGIES = ["NEW_SETUP", "REUSE_WITH_DELTA", "INSERT", "DETAIL", "DIAGRAM", "MAP", "COMPARISON", "TEXT_INFOGRAPHIC"];

// How a shot's image actually gets produced. GENERATE is the expensive
// default to avoid — EDIT/REUSE/CROP/COMPOSITE/PROGRAMMATIC_GRAPHIC are the
// cost-saving alternatives the Visual Director should prefer whenever a shot
// doesn't need a brand-new generation.
export const RENDER_METHODS = ["GENERATE", "EDIT", "REUSE", "CROP", "COMPOSITE", "PROGRAMMATIC_GRAPHIC"];

export const SHOT_SIZES = ["WIDE", "MEDIUM", "CLOSE", "DETAIL", "INSERT"];

/**
 * Conceptual shapes for the future Visual pipeline (not implemented):
 *
 * VisualBeat {
 *   id, chapterId, sequenceIndex, narrationSegmentIds, timing: { startMs, endMs },
 *
 *   meaning: {
 *     visualPurpose,             // why this beat exists at all (see the six-question test in VISUAL_ARCHITECTURE.md)
 *     narrativeFunction,
 *     informationToCommunicate,  // WHAT the image must convey — never a literal sentence restatement
 *     revealConstraints,         // anti-spoiler: don't show a secret before narration reveals it
 *   },
 *
 *   grammar: {
 *     visualType,                // e.g. character moment / diagram / map / insert
 *     shotStrategy,              // one of SHOT_STRATEGIES
 *   },
 *
 *   continuity: {
 *     continuityGroupId,         // links to a ContinuityGroup
 *     inheritedWorldStateId,     // the WorldState this beat inherits from, not resets
 *     worldStateMutations,       // what this beat changes going forward
 *   },
 *
 *   composition: { shotSize, cameraNotes },   // one of SHOT_SIZES + free-form direction
 *
 *   generation: { renderMethod, baseImageRef },  // one of RENDER_METHODS + what it edits/reuses from, if any
 *
 *   motion: { technique, holdMs },   // push/pan/crop/focal-emphasis/overlay, never a rigid timer
 *
 *   quality: {
 *     criticalElements,          // must appear
 *     forbiddenElements,         // must not appear
 *     factualVisualClaims,       // ties back to FactGraph evidence — see "Research-grounded art direction"
 *   },
 * }
 *
 * ContinuityGroup {
 *   id, entityIds,               // which entities share this continuity thread (e.g. "the ship interior scenes")
 *   description,
 * }
 *
 * WorldState (sparse — only topic-relevant fields are ever set) {
 *   id, continuityGroupId, previousWorldStateId,  // inherited, not reset
 *   temporal, environment, characterState, propState, vehicleState,
 * }
 *
 * VisualEntity {
 *   id, category,                // one of ENTITY_CATEGORIES
 *   importance,                  // one of ENTITY_IMPORTANCE
 *   name,
 *   referenceNeedScore,          // conceptual: recurrence × screenProminence × identitySensitivity × narrativeImportance × driftRisk — never user-exposed
 *   factGraphRefs,                // evidence fact IDs / source IDs this entity's art direction is grounded in
 *   artDirectionConstraints,      // e.g. "avoid unsupported popular myths"
 * }
 *
 * CharacterIdentity { id, entityId, description, referenceImages: [{ pose, imageRef }] }   // 3/4 front neutral + profile + face closeup (+ optional rear 3/4) — never a full turnaround sheet
 * OutfitState       { id, entityId, description, referenceImageRef }
 * PhysicalState     { id, entityId, description, referenceImageRef }   // Rendered Character = CharacterIdentity + OutfitState + PhysicalState
 *
 * CanonicalReference {
 *   id,                          // e.g. "character_viking_01", "outfit_viking_winter_01"
 *   entityId, kind,              // identity | outfit | physicalState | location | prop
 *   imageRef, approvedAt,        // immutable once approved — the machine-readable identity source of truth
 * }
 *
 * VisualPayoff {
 *   id, entityId, setupBeatId, payoffBeatId, description,   // e.g. cracked boots shown early, failing later
 * }
 *
 * SceneQAResult {
 *   beatId, dimensions: {
 *     beatAdherence, characterIdentity, outfitState, locationIdentity,
 *     worldStateContinuity, requiredProps, forbiddenElements,
 *     factualCorrectness, style, composition, textArtifacts,
 *   },
 *   attempt,                     // 1 = normal, 2 = targeted correction, 3 = alternate strategy, then accept-above-floor or flag for manual review
 *   verdict,
 * }
 */
