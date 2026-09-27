// Planning-only decisions: no network, persistence, billing or appearance invention.
import { criticalExactTextOf, validatePinnedClaim } from "./graphicSpec.ts";

export const DIRECTOR_RELIABILITY_VERSION = "director-reliability-v2";
const words = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const roles = [
  { canonical: /agricultur|farmer|cultivat|horticultur/, trigger: /\b(farmer|greenhouse|crop|farming|food|cultivation|nutrient|harvest|lettuce)\b/ },
  { canonical: /power|electric|energy/, trigger: /\b(battery|batteries|power|solar|electricity|electrical|energy)\b/ },
  { canonical: /maintenance|technician|mechanic/, trigger: /\b(repair|repairs|repairing|suit|mechanical|life support|seal|valve)\b/ },
];

export function resolveCanonicalCast(text, registry) {
  const cast = registry.filter(e => e.category === "CHARACTER");
  const normalized = words(text);
  const explicit = cast.filter(e => {
    const name = words(String(e.name).split(/[(/]/)[0]).replace(/\b(the|a|an)\b/g, "").trim();
    return name.length > 3 && normalized.includes(name);
  });
  if (explicit.length) return explicit.map(e => e.id);
  const ranked = roles.map(role => ({
    entity: cast.find(e => role.canonical.test(words(e.name))),
    index: normalized.search(role.trigger),
  })).filter(r => r.entity && r.index >= 0).sort((a, b) => a.index - b.index);
  return ranked.length ? [ranked[0].entity.id] : [];
}

export function canonicalizePlanCast(plan, existingCast) {
  if (!existingCast.length) return plan;
  const replacements = new Map();
  for (const entity of plan.entityRegistry ?? []) {
    if (entity.category !== "CHARACTER" || existingCast.some(e => e.id === entity.id)) continue;
    const matches = resolveCanonicalCast(entity.name, existingCast);
    if (matches.length === 1) replacements.set(entity.id, matches[0]);
  }
  const existingIds = new Set(existingCast.map(e => e.id));
  plan.entityRegistry = [...existingCast, ...(plan.entityRegistry ?? []).filter(e => !existingIds.has(e.id) && !replacements.has(e.id))];
  for (const beat of [...(plan.visualBeats ?? []), ...(plan.visualSequences ?? [])]) {
    for (const key of ["primaryEntityIds", "supportingEntityIds"]) beat[key] = [...new Set((beat[key] ?? []).map(id => replacements.get(id) ?? id))];
  }
  return plan;
}

export function bindEpisodeSemantics(beats, registry, claims) {
  const byId = new Map((claims ?? []).map(c => [c.claimId, c]));
  const entities = new Map(registry.map(e => [e.id, e]));
  const lens = registry.find(e => e.category === "CHARACTER" && e.importance === "HERO");
  const ledger = {};
  for (const beat of beats) {
    const claim = byId.get(beat.narrationClaimId);
    if (!claim) continue; // The ready gate reports gaps; never fabricate a claim.
    const text = claim.narrationText;
    const relevant = resolveCanonicalCast(text, registry);
    const hasPeople = (claim.preferredVisualForms ?? []).some(f => f.startsWith("CHARACTER")) || (relevant.length > 0 && /\b(specialist|officer|technician|farmer|crew|repair|inspect|tend|harvest|check)\w*/i.test(text));
    const castIds = hasPeople ? relevant.length ? relevant : lens ? [lens.id] : [] : [];
    const objects = [...new Set([...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])])]
      .filter(id => entities.get(id)?.category !== "CHARACTER");
    beat.primaryEntityIds = [...castIds, ...objects];
    beat.supportingEntityIds = [];
    beat.castBindings = castIds.map(characterId => ({ characterId, lookId: "canonical", action: claim.visualCommunicationGoal, expression: "narration-appropriate", screenPosition: "focal" }));
    beat.semanticAction = claim.stateAfter || claim.visualCommunicationGoal;
    beat.communicationGoal = claim.visualCommunicationGoal;
    beat.visualFormOptions = claim.preferredVisualForms;
    beat.exactText = criticalExactTextOf(claim);
    beat.reserveTextSafeArea = Boolean(beat.exactText);
    beat.cameraFraming = beat.cameraFraming || (beat.shotSize === "DETAIL" ? "Close view of the named working detail" : "Eye-level three-quarter view of the subject in its environment");
    for (const id of castIds) {
      ledger[id] ??= { chapters: [], beatIds: [] };
      if (!ledger[id].chapters.includes(beat.chapterId)) ledger[id].chapters.push(beat.chapterId);
      ledger[id].beatIds.push(beat.id);
    }
  }
  return ledger;
}

export function validatePlanContract(plan, contract, scriptVersionId) {
  const errors = [];
  if (!contract?.id || contract.status !== "ready" || contract.script_version_id !== scriptVersionId || plan.narrationContractVersionId !== contract.id) return ["NARRATION_CONTRACT_REQUIRED"];
  const claims = new Map((contract.claims ?? []).map(c => [c.claimId, c]));
  if (!claims.size) errors.push("NARRATION_CONTRACT_EMPTY");
  for (const beat of plan.visualBeats ?? []) {
    const claim = claims.get(beat.narrationClaimId);
    if (!claim) { errors.push(`CLAIM_MISSING:${beat.id}`); continue; }
    const check = validatePinnedClaim(beat, claim);
    if (!check.valid) errors.push(`CLAIM_INVALID:${beat.id}:${check.reason}`);
    if (!claim.primarySubject || !claim.visualCommunicationGoal || !claim.preferredVisualForms?.length) errors.push(`CLAIM_INCOMPLETE:${beat.id}`);
    // 2026-09-21 "graphics are not a quota" pass: a claim that doesn't fit
    // any of the 11 graphic templates (a real Atlantis incident: a long
    // multi-item checklist) is NOT a hard validation failure anymore —
    // compileEpisodeBeat (episodePreflight.ts) now gracefully downgrades
    // that one beat to a normal illustrated GENERATE scene instead (Section
    // H: "fall back to a normal illustrated scene"). Hard-failing the WHOLE
    // plan here over one beat's graphic-template mismatch would undo that
    // fallback before it ever gets a chance to run.
  }
  if (!plan.visualBeats?.length) errors.push("PLAN_EMPTY");
  return errors;
}

export function freshComposition(beat, reason, variant = 0) {
  const views = [
    ["WIDE", "Wide oblique view showing the subject and its working environment"],
    ["CLOSE", "Close side view centered on the narrated action and its immediate result"],
    ["MEDIUM", "Reverse three-quarter view connecting the subject to the narrated object"],
  ];
  const [size, framing] = views[variant % views.length];
  beat.shotSize = size;
  beat.cameraFraming = framing;
  beat.renderMethod = "GENERATE";
  beat.shotStrategy = "NEW_SETUP";
  beat.baseSetupKey = `${beat.candidateBaseKey ?? beat.id}__${reason}_${beat.id}`;
  beat.deltaInstruction = null;
  beat.diversityForced = true;
  beat.diversityReason = reason;
}

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// this pacing/rhythm cap ("no more than 2 consecutive graphics") used to
// downgrade a PROGRAMMATIC_GRAPHIC beat to a raster illustration
// unconditionally, with zero awareness of whether the beat actually had
// anything illustratable to fall back to. A macro correctly scoped by the
// Visual Director as an "explainer" run of 7 graphic beats (its own
// graphicReason literally said so) got 6 of those 7 forced into GENERATE —
// several with a DIAGRAM_SUBJECT-only focal entity (a dialogue voice, a
// bullet-list concept) and nothing else bound to the shot at all. The
// result: raster prompts with no coherent subject, which the model filled
// in with an invented character, and claims whose real content (a multi-
// item on-screen list) can never be conveyed by ANY single illustration
// without baking in forbidden text. Pacing variety is a legitimate goal but
// never at the cost of a shot with nothing real to draw — a correct-but-
// repetitive run of graphics beats an incoherent illustration every time.
const GRAPHIC_SHAPED_VISUAL_FORMS = new Set([
  "DIAGRAM", "ANNOTATED_DIAGRAM", "PROCESS", "CAUSE_EFFECT", "COMPARISON", "BEFORE_AFTER",
  "MAP", "TIMELINE", "CHART", "SYMBOLIC_POSITIVE", "SYMBOLIC_NEGATION", "TEXT_EMPHASIS", "NUMBER_EMPHASIS",
]);

// Sequencing is downstream of semantic binding, upstream of prompt compilation.
export function sequenceEpisode(beats) {
  let illustratedSinceGraphic = 3, graphicRun = 0, editRun = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const shortLabel = ["TEXT_EMPHASIS", "NUMBER_EMPHASIS"].includes(b.contractVisualForm) && b.exactText;
    const explicitPair = b.intentionalVisualComparison && graphicRun === 1;
    // A claim whose content is inherently graphic-shaped (a diagram, a
    // multi-item list, a comparison, a map...) can only safely move to an
    // illustration when it reduces to ONE short exact-text label the
    // deterministic overlay system can composite afterward (shortLabel,
    // the pre-existing narrower case) — never when it's a genuinely
    // multi-fact requirement with no single short overlay to fall back to.
    const graphicShapedButNotShortLabel = GRAPHIC_SHAPED_VISUAL_FORMS.has(b.contractVisualForm) && !shortLabel;
    // shotEntityIds (visualShotPlanning.js) already excludes DIAGRAM_SUBJECT
    // entities from beat.entities, so a non-empty list here (or a bound
    // location) means a REAL, illustratable subject exists to draw instead.
    const hasIllustratableFallback = Boolean((b.entities ?? []).length || b.locationId);
    const safeToDowngrade = !graphicShapedButNotShortLabel && hasIllustratableFallback;
    if (b.renderMethod === "PROGRAMMATIC_GRAPHIC" && safeToDowngrade && (shortLabel || graphicRun >= 2 || (illustratedSinceGraphic < 3 && !explicitPair))) {
      freshComposition(b, "graphic_spacing", i);
      b.graphicClusterCapped = true;
      b.visualType = "STORY_ILLUSTRATION";
    }
    if (b.renderMethod === "PROGRAMMATIC_GRAPHIC") { graphicRun++; illustratedSinceGraphic = 0; editRun = 0; continue; }
    graphicRun = 0; illustratedSinceGraphic++;
    if (b.exactText && ["REUSE", "CROP"].includes(b.renderMethod)) {
      const source = beats.slice(0, i).find(x => x.baseSetupKey === b.baseSetupKey && x.renderMethod === "GENERATE");
      // CROP can cut the label off; reuse with a different label needs a new treatment.
      if (b.renderMethod === "CROP" || source?.exactText !== b.exactText) freshComposition(b, "exact_text_treatment", i);
    }
    if (b.renderMethod === "EDIT") {
      const limit = b.hasTemporalProgression ? 2 : 1;
      if (!b.hasContractStateChange || !["MEDIUM", "HIGH"].includes(b.continuityRequirement) || editRun >= limit) freshComposition(b, "meaningful_edit_required", i);
    }
    editRun = b.renderMethod === "EDIT" ? editRun + 1 : 0;
    // New frames must actually change camera/composition, not only setup IDs.
    if (b.diversityForced && !b.cameraFraming?.includes("Reverse") && !b.cameraFraming?.includes("oblique")) freshComposition(b, "composition_variety", i);
    const recent = beats.slice(Math.max(0, i - 4), i + 1).filter(x => x.renderMethod !== "PROGRAMMATIC_GRAPHIC");
    if (recent.length === 5 && !b.intentionalVisualComparison) {
      const signature = x => JSON.stringify([x.primarySubject, x.castBindings?.map(c => c.characterId), x.semanticAction, x.locationId, x.shotSize, x.cameraFraming, x.contractVisualForm]);
      if (new Set(recent.map(signature)).size < 3 || new Set(recent.map(x => x.shotSize)).size < 2) freshComposition(b, "rolling_variety", i);
    }
    const eight = beats.slice(Math.max(0, i - 7), i + 1);
    if (eight.length === 8 && new Set(eight.map(x => x.contractVisualForm)).size === 1 && !b.intentionalVisualComparison) {
      const alternate = b.visualFormOptions?.find(f => f !== b.contractVisualForm && /^(CHARACTER|ENVIRONMENT|OBJECT)_/.test(f));
      if (alternate) {
        b.contractVisualForm = alternate;
        b.visualType = alternate.startsWith("ENVIRONMENT") ? "ENVIRONMENT" : alternate.startsWith("OBJECT") ? "OBJECT_DETAIL" : "STORY_ILLUSTRATION";
        freshComposition(b, "eight_beat_visual_form_variety", i);
      }
    }
    if (b.renderMethod === "CROP" && b.shotSize === "DETAIL") freshComposition(b, "detail_requires_fresh", i);
  }
  // Earlier diversity changes may replace a base; repair dependencies locally.
  const established = new Set();
  let lastComposition = null, compositionRun = 0;
  for (const b of beats) {
    if (b.renderMethod === "PROGRAMMATIC_GRAPHIC") { lastComposition = null; compositionRun = 0; continue; }
    const signature = JSON.stringify([b.primarySubject, b.primaryEntityIds, b.semanticAction, b.locationId, b.shotSize, b.cameraFraming, b.contractVisualForm]);
    compositionRun = signature === lastComposition ? compositionRun + 1 : 1;
    if (compositionRun > 2) { freshComposition(b, "three_beat_composition_limit", b.sequenceIndex); compositionRun = 1; }
    lastComposition = JSON.stringify([b.primarySubject, b.primaryEntityIds, b.semanticAction, b.locationId, b.shotSize, b.cameraFraming, b.contractVisualForm]);
    if (b.renderMethod !== "GENERATE" && !established.has(b.baseSetupKey)) freshComposition(b, "missing_base", b.sequenceIndex);
    if (b.renderMethod === "GENERATE") established.add(b.baseSetupKey);
  }
  return beats;
}
