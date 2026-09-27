// deno-lint-ignore-file no-explicit-any
// visualPlanSemanticBindingRepair.ts — 2026-09-23 "final targeted Atlantis
// Visual Plan repair" pass. Generic, topic-agnostic repair for beats whose
// PERSISTED semantic/entity bindings are invalid under the now-fixed
// architecture (shotEntityIds/sequenceEpisode no longer PRODUCE these
// defects for any future plan — this module repairs a plan that was
// authored/adopted BEFORE those fixes existed).
//
// Detects and repairs exactly the defect classes confirmed by reading real
// persisted Atlantis data:
//   - a DIAGRAM_SUBJECT entity (a dialogue voice, an abstract graphic
//     concept — no reference, no physical description anywhere in the
//     Visual World) is the beat's raster (GENERATE/EDIT) subject
//   - a HERO/RECURRING CHARACTER is tagged in primaryEntityIds/
//     supportingEntityIds (and will therefore have its identity reference
//     routed by requiredReferenceLookups — sceneRenderPlan.ts) on a beat
//     whose real subject is something else entirely
//   - the subject field is an entity id that was never added to the
//     entity-tagging fields the reference resolver actually reads
//   - the subject field looks like an entity id but resolves to nothing in
//     the registry at all (a dangling/broken reference)
//   - a beat was pacing-downgraded from PROGRAMMATIC_GRAPHIC to a raster
//     illustration (graphicClusterCapped) with no illustratable fallback,
//     or its claim's own preferred visual form is inherently graphic/
//     multi-fact and can never reduce to a single raster illustration
//     without either an incoherent image or baked-in forbidden text
//   - a raster beat has no illustratable subject at all
//   - the beat's own display/summary text exposes a raw internal id token
//
// This module NEVER rewrites the deterministic shot-expansion pipeline and
// NEVER touches narration, timing, Story Plan, Research, or approved
// references — it operates entirely on an ALREADY-EXPANDED plan's
// visualBeats, choosing ONLY from each shot's own already-authored
// candidate entities (never inventing a new one), and asks an LLM text
// call (no image/video provider ever touched) to re-judge the correct
// visual representation for each defective beat from its own narration
// meaning.

export const GRAPHIC_SHAPED_VISUAL_FORMS = new Set([
  "DIAGRAM", "ANNOTATED_DIAGRAM", "PROCESS", "CAUSE_EFFECT", "COMPARISON", "BEFORE_AFTER",
  "MAP", "TIMELINE", "CHART", "SYMBOLIC_POSITIVE", "SYMBOLIC_NEGATION", "TEXT_EMPHASIS", "NUMBER_EMPHASIS",
]);
const ENTITY_ID_TOKEN = /^(?:ent|obj|loc)_[a-z0-9_]+$/i;
const RAW_ENTITY_TOKEN_ANYWHERE = /\b(?:ent|obj|loc)_[a-z0-9_]+\b/i;

export type SemanticBindingDefect = { beatId: string; sourceMacroBeatId: string | null; reasons: string[] };

function isDiagramSubject(entitiesById: Map<string, any>, id: string): boolean {
  return entitiesById.get(id)?.category === "DIAGRAM_SUBJECT";
}

/**
 * Scans every beat in the plan and reports the ones whose persisted
 * semantic/entity bindings are invalid under the current (fixed)
 * architecture. Pure, deterministic, reads only structural fields (entity
 * category, render method, tagged ids) — no entity name, topic, or
 * project-specific string appears anywhere in this logic.
 */
export function detectSemanticBindingDefects(plan: any): SemanticBindingDefect[] {
  const entitiesById = new Map<string, any>((plan.entityRegistry ?? []).map((e: any) => [e.id, e]));
  const defects: SemanticBindingDefect[] = [];
  for (const beat of plan.visualBeats ?? []) {
    const isRaster = beat.renderMethod === "GENERATE" || beat.renderMethod === "EDIT";
    const primaryIds: string[] = beat.primaryEntityIds ?? [];
    const supportingIds: string[] = beat.supportingEntityIds ?? [];
    const allTaggedIds = [...new Set([...primaryIds, ...supportingIds])];
    const subjectIsEntityId = typeof beat.subject === "string" && entitiesById.has(beat.subject);
    const subjectEntity = subjectIsEntityId ? entitiesById.get(beat.subject) : null;
    const reasons: string[] = [];

    if (isRaster && subjectEntity?.category === "DIAGRAM_SUBJECT") reasons.push("DIAGRAM_SUBJECT_AS_RASTER_SUBJECT");
    if (isRaster && subjectIsEntityId && !allTaggedIds.includes(beat.subject)) reasons.push("SUBJECT_NOT_IN_ENTITY_TAGS");

    if (isRaster) {
      const routedCharacterIds = allTaggedIds.filter((id) => {
        const e = entitiesById.get(id);
        return e?.category === "CHARACTER" && (e.importance === "HERO" || e.importance === "RECURRING");
      });
      const unrelatedRoutedCharacters = routedCharacterIds.filter((id) => id !== beat.subject);
      if (unrelatedRoutedCharacters.length && subjectEntity?.category !== "CHARACTER") reasons.push("UNRELATED_CHARACTER_REFERENCE_WILL_BE_ROUTED");
    }

    if (typeof beat.subject === "string" && ENTITY_ID_TOKEN.test(beat.subject) && !entitiesById.has(beat.subject)) reasons.push("UNRESOLVABLE_ENTITY_TOKEN");

    const shortLabel = ["TEXT_EMPHASIS", "NUMBER_EMPHASIS"].includes(beat.contractVisualForm) && beat.exactText;
    const graphicShapedButNotShortLabel = GRAPHIC_SHAPED_VISUAL_FORMS.has(beat.contractVisualForm) && !shortLabel;
    if (beat.graphicClusterCapped === true) {
      const illustratableTagged = allTaggedIds.filter((id) => !isDiagramSubject(entitiesById, id));
      const hasIllustratableFallback = illustratableTagged.length > 0 || Boolean(beat.locationId);
      if (!hasIllustratableFallback || graphicShapedButNotShortLabel) reasons.push("INCORRECTLY_PACING_DOWNGRADED_GRAPHIC");
    } else if (isRaster && graphicShapedButNotShortLabel) {
      reasons.push("GRAPHIC_SHAPED_CONTENT_RENDERED_AS_RASTER");
    }

    if (isRaster) {
      const illustratableTagged = allTaggedIds.filter((id) => !isDiagramSubject(entitiesById, id));
      const noFallback = !illustratableTagged.length && !beat.locationId;
      const subjectUnusable = !beat.subject || ENTITY_ID_TOKEN.test(beat.subject) || subjectEntity?.category === "DIAGRAM_SUBJECT";
      if (noFallback && subjectUnusable) reasons.push("NO_ILLUSTRATABLE_SUBJECT");
    }

    if (RAW_ENTITY_TOKEN_ANYWHERE.test(String(beat.displaySubjectHint ?? "")) || RAW_ENTITY_TOKEN_ANYWHERE.test(String(beat.informationToCommunicate ?? ""))) {
      reasons.push("DISPLAY_TEXT_EXPOSES_INTERNAL_TOKEN");
    }

    if (reasons.length) defects.push({ beatId: beat.id, sourceMacroBeatId: beat.sourceMacroBeatId ?? null, reasons });
  }
  return defects;
}

export type SemanticBindingRepairRegion = { regionId: string; macroSequenceIds: string[]; beatIds: string[]; reason: string };

/**
 * Groups defective beats by their owning macro for candidate-entity scoping
 * (a macro's own primaryEntityIds/supportingEntityIds is the candidate pool
 * every one of its shots draws from), but — unlike the sibling focal-subject-
 * repetition repair, where the WHOLE macro's subject-assignment PATTERN is
 * itself the defect — a structural binding defect here is independent per
 * beat. `beatIds` is therefore ONLY the beats actually flagged defective,
 * NEVER every sibling in the macro. Real Atlantis regression this fixes:
 * grouping by whole macro swept two perfectly valid, zero-cost REUSE beats
 * (never flagged, never touched by any of this module's rules) into a
 * region alongside their genuinely defective GENERATE siblings — the repair
 * schema only offers GENERATE/PROGRAMMATIC_GRAPHIC, so both REUSE beats were
 * silently force-converted into new paid GENERATE calls despite never
 * having anything wrong with them, violating "preserve unaffected beats
 * byte-for-byte."
 */
export function groupSemanticBindingDefectsIntoRegions(defects: SemanticBindingDefect[], plan: any): SemanticBindingRepairRegion[] {
  if (!defects.length) return [];
  const beatsById = new Map((plan.visualBeats ?? []).map((b: any) => [b.id, b]));
  const macroOrder: string[] = [];
  const seenMacro = new Set<string>();
  for (const b of [...(plan.visualBeats ?? [])].sort((a: any, c: any) => a.sequenceIndex - c.sequenceIndex)) {
    if (b.sourceMacroBeatId && !seenMacro.has(b.sourceMacroBeatId)) { seenMacro.add(b.sourceMacroBeatId); macroOrder.push(b.sourceMacroBeatId); }
  }
  const defectiveBeatIdsByMacro = new Map<string, string[]>();
  const reasonsByMacro = new Map<string, Set<string>>();
  for (const d of defects) {
    if (!d.sourceMacroBeatId || !beatsById.has(d.beatId)) continue;
    defectiveBeatIdsByMacro.set(d.sourceMacroBeatId, [...(defectiveBeatIdsByMacro.get(d.sourceMacroBeatId) ?? []), d.beatId]);
    const set = reasonsByMacro.get(d.sourceMacroBeatId) ?? new Set<string>();
    for (const r of d.reasons) set.add(r);
    reasonsByMacro.set(d.sourceMacroBeatId, set);
  }
  return macroOrder.filter((m) => defectiveBeatIdsByMacro.has(m)).map((macroId) => {
    const defectiveIds = new Set(defectiveBeatIdsByMacro.get(macroId));
    // Sorted by sequenceIndex (matching the macro's own shot order), never
    // by defect-detection order.
    const orderedDefectiveIds = (plan.visualBeats ?? [])
      .filter((b: any) => b.sourceMacroBeatId === macroId && defectiveIds.has(b.id))
      .sort((a: any, c: any) => a.sequenceIndex - c.sequenceIndex)
      .map((b: any) => b.id);
    return {
      regionId: `semantic_repair_${macroId}`,
      macroSequenceIds: [macroId],
      beatIds: orderedDefectiveIds,
      reason: [...(reasonsByMacro.get(macroId) ?? [])].join("; "),
    };
  }).filter((r) => r.beatIds.every((id: string) => beatsById.has(id)));
}

/* ============================ LLM repair schema/instructions ============================ */
const REPAIR_ILLUSTRATED_VISUAL_TYPES = ["STORY_ILLUSTRATION", "ENVIRONMENT", "CHARACTER", "OBJECT_DETAIL"];

export function buildSemanticBindingRepairSchema(beatIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["shots"],
    properties: {
      shots: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["beatId", "narrationMeaning", "renderMethod", "focalEntityId", "displaySubject", "visualType"],
          properties: {
            beatId: { type: "string", enum: beatIds },
            narrationMeaning: { type: "string", description: "One short sentence: what THIS shot's own specific narration text is actually saying." },
            renderMethod: { type: "string", enum: ["GENERATE", "PROGRAMMATIC_GRAPHIC"], description: "GENERATE for a real photographic/illustrated scene with a coherent visual subject. PROGRAMMATIC_GRAPHIC ONLY when the shot's real content is inherently textual/numeric/diagrammatic/a multi-item list/a comparison — content that cannot be honestly conveyed as a photographic illustration without either an incoherent image or forbidden baked-in text." },
            focalEntityId: { type: ["string", "null"], description: "For renderMethod=GENERATE only: the id of the ONE entity (from this shot's own listed candidate entities) that best visualizes this exact narration moment, or null when no listed entity is the right visual. Always null when renderMethod=PROGRAMMATIC_GRAPHIC. NEVER an entity whose category is DIAGRAM_SUBJECT — that category has no reference image and no physical description anywhere and must never be a raster shot's on-screen subject." },
            displaySubject: { type: "string", description: "Short, plain, human-readable description of what the viewer sees. 3-10 words. Never an internal id, never internal planning language." },
            visualType: { type: "string", enum: [...REPAIR_ILLUSTRATED_VISUAL_TYPES, "PROGRAMMATIC_GRAPHIC"], description: "Must be PROGRAMMATIC_GRAPHIC when renderMethod is PROGRAMMATIC_GRAPHIC; otherwise one of the illustrated types." },
          },
        },
      },
    },
  };
}

export const SEMANTIC_BINDING_REPAIR_INSTRUCTIONS = `You are repairing a small region of an already-approved documentary video's shot plan. Each listed shot currently has an INVALID persisted visual binding — for example, its on-screen subject is a concept that was never meant to be photographed (a dialogue voice, an abstract graphic idea), or a character's reference image will be routed onto a shot that isn't actually about that character, or the shot was forced into a photographic illustration even though its real content is a list/diagram/number that can't be honestly drawn as a photo.

For EACH shot, read ONLY that shot's own narration text and decide the correct, honest visual treatment:

1. Decide renderMethod first:
   - GENERATE: a real photographic/illustrated scene exists — pick the ONE entity (from this shot's own candidate list) that is the true visual subject, or null if the right visual is a location/concept/detail with no single entity as its subject.
   - PROGRAMMATIC_GRAPHIC: the shot's real content is inherently textual/numeric/a list/a diagram/a comparison — content no photograph can honestly show without either an incoherent image or baked-in forbidden text. Do not choose this merely for pacing variety — only when the content itself demands it.

2. NEVER choose a DIAGRAM_SUBJECT-category entity as a GENERATE shot's focalEntityId — that category has no reference image and no physical description anywhere in this project, and doing so is exactly the bug you are fixing.

3. NEVER choose an entity merely because it is convenient, the narrator, the protagonist, the first-listed, or the most common — choose the entity that genuinely best visualizes THIS shot's own specific narration text, or PROGRAMMATIC_GRAPHIC, or null.

4. Choose focalEntityId ONLY from the candidate entities listed for that specific shot. Never invent a new entity, and never choose one from a different shot's list.

5. Never invent narrative content that isn't in the narration text you're given. Never contradict a shot's own narration.`;

/** Same per-shot input shape as the focal-subject repair, plus the contract signals (contractVisualForm/exactText) needed to judge GENERATE vs PROGRAMMATIC_GRAPHIC. Candidate entities are scoped to each shot's OWN macro — never a global list. */
export function buildSemanticBindingRepairInput(region: SemanticBindingRepairRegion, plan: any, entityRegistryById: Map<string, any>, referenceAvailabilityByEntityId: Map<string, boolean>) {
  const beatsById = new Map((plan.visualBeats ?? []).map((b: any) => [b.id, b]));
  const macrosBySourceId = new Map((plan.visualSequences ?? []).map((s: any) => [s.sourceMacroBeatId, s]));
  const orderedBeats = region.beatIds.map((id) => beatsById.get(id)).filter(Boolean) as any[];

  const describeCandidates = (macro: any) => {
    const ids = [...new Set([...(macro?.primaryEntityIds ?? []), ...(macro?.supportingEntityIds ?? [])])] as string[];
    return ids.map((id) => {
      const e = entityRegistryById.get(id);
      if (!e) return null;
      return { id: e.id, name: e.name, category: e.category, referenceAvailable: Boolean(referenceAvailabilityByEntityId.get(e.id)) };
    }).filter(Boolean);
  };

  // Since region.beatIds is now ONLY the defective beats (never every
  // sibling), a repaired beat's immediate, non-defective neighbors in the
  // FULL plan sequence are supplied as read-only narrative context (same
  // purpose as the focal-subject repair's own contextBeforeRegion/
  // contextAfterRegion) — enough for continuity awareness without ever
  // asking the model to reconsider anything about them.
  const allBeatsSorted = [...(plan.visualBeats ?? [])].sort((a: any, c: any) => a.sequenceIndex - c.sequenceIndex);
  const firstBeat = orderedBeats[0];
  const lastBeat = orderedBeats[orderedBeats.length - 1];
  const beforeBeat = firstBeat ? allBeatsSorted.filter((b) => b.sequenceIndex < firstBeat.sequenceIndex).slice(-1)[0] : null;
  const afterBeat = lastBeat ? allBeatsSorted.find((b) => b.sequenceIndex > lastBeat.sequenceIndex) : null;

  return {
    regionReason: region.reason,
    contextBeforeRegion: beforeBeat ? { displaySubject: beforeBeat.subject, renderMethod: beforeBeat.renderMethod, narrationText: beforeBeat.shotNarrationText ?? "" } : null,
    contextAfterRegion: afterBeat ? { displaySubject: afterBeat.subject, renderMethod: afterBeat.renderMethod, narrationText: afterBeat.shotNarrationText ?? "" } : null,
    shots: orderedBeats.map((b) => {
      const macro = macrosBySourceId.get(b.sourceMacroBeatId);
      return {
        beatId: b.id,
        macroPurpose: macro?.purpose ?? null,
        narrativeFunction: b.narrativeFunction ?? macro?.narrativeFunction ?? null,
        narrationText: b.shotNarrationText || b.actionOrState || "",
        currentSubject: b.subject ?? null,
        currentRenderMethod: b.renderMethod,
        contractVisualForm: b.contractVisualForm ?? null,
        hasExactTextCandidate: Boolean(b.exactText),
        candidateEntities: describeCandidates(macro),
      };
    }),
  };
}

/**
 * Merges the LLM's repaired shots back into a deep clone of the plan.
 * Rebuilds EVERY entity-tagging field consistently from the chosen
 * focalEntityId (never leaves primaryEntityIds/entities/referenceEntityIds
 * pointing at a stale, previously-tagged entity — the exact bug the prior
 * focal-subject repair introduced and this pass fixes). Only subject/
 * display/visualType/renderMethod/entity-tagging/provenance fields are
 * touched — timing, narration ranges, baseSetupKey, forbidden elements,
 * factual constraints, and every other authored field are copied verbatim.
 */
export function mergeSemanticBindingRepairIntoPlan(plan: any, region: SemanticBindingRepairRegion, repairedShots: any[], sourceVisualPlanVersionId: string) {
  const repairedById = new Map(repairedShots.map((s: any) => [s.beatId, s]));
  const next = structuredClone(plan);
  let changedCount = 0;
  next.visualBeats = (next.visualBeats ?? []).map((beat: any) => {
    if (!region.beatIds.includes(beat.id)) return beat;
    const repaired = repairedById.get(beat.id);
    if (!repaired) return { ...beat, preservedFromParent: true, repairRegionId: region.regionId };
    changedCount++;
    const isGraphic = repaired.renderMethod === "PROGRAMMATIC_GRAPHIC";
    const newFocalEntityId: string | null = isGraphic ? null : (repaired.focalEntityId || null);
    return {
      ...beat,
      subject: isGraphic ? repaired.displaySubject : (newFocalEntityId || repaired.displaySubject),
      displaySubjectHint: repaired.displaySubject,
      narrationMeaning: repaired.narrationMeaning,
      renderMethod: repaired.renderMethod,
      visualType: isGraphic ? "PROGRAMMATIC_GRAPHIC" : (REPAIR_ILLUSTRATED_VISUAL_TYPES.includes(repaired.visualType) ? repaired.visualType : beat.visualType),
      // The claim-derived contractVisualForm/exactText fields described the
      // OLD, invalid assignment's preference — real Atlantis finding: left
      // untouched, they caused this SAME repair's own detector to re-flag
      // an already-repaired GENERATE beat as GRAPHIC_SHAPED_CONTENT_
      // RENDERED_AS_RASTER forever (contractVisualForm never changes on its
      // own), preventing convergence. This repair's renderMethod decision
      // already took contractVisualForm/exactText into account as INPUT —
      // once decided, that decision is authoritative and the stale claim
      // preference must never be re-litigated against it again.
      contractVisualForm: null,
      primarySubject: repaired.displaySubject,
      entities: newFocalEntityId ? [newFocalEntityId] : [],
      primaryEntityIds: newFocalEntityId ? [newFocalEntityId] : [],
      supportingEntityIds: [],
      referenceEntityIds: newFocalEntityId ? [newFocalEntityId] : [],
      castBindings: newFocalEntityId
        ? [{ characterId: newFocalEntityId, lookId: "canonical", action: repaired.narrationMeaning, expression: "narration-appropriate", screenPosition: "focal" }]
        : [],
      // The stale pacing-cap marker (and the reason text explaining a
      // downgrade that no longer applies) must never survive a repair that
      // just re-decided renderMethod from scratch.
      graphicClusterCapped: false,
      graphicReason: null,
      repairReason: region.reason,
      sourceVisualPlanVersionId,
      sourceBeatId: beat.id,
      repairRegionId: region.regionId,
      repairMethod: "semantic_binding_llm_repair",
      preservedFromParent: false,
    };
  });
  return { plan: next, changedCount, unchangedInRegionCount: region.beatIds.length - changedCount };
}
