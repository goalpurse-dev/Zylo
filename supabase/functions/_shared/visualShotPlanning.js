import { matchClaimToRange, resolveClaimVisualType } from "./narrationVisualContract.ts";
import { bindEpisodeSemantics, sequenceEpisode, DIRECTOR_RELIABILITY_VERSION } from "./visualDirectorReliability.js";
import { applyDuplicateRenderGate } from "./scenePromptQuality.ts";
import { WORDS_PER_MINUTE } from "../../../src/lib/longFormPipelineConstants.ts";

// A zero-provider editorial pass. Semantic boundaries come from punctuation,
// subject/action transitions and visual vocabulary. Word weights only estimate
// timing inside those boundaries; long ideas get explicit camera/graphic changes.
//
// v2 fixes a real over-triggering bug found auditing a real 115-beat episode
// (Mars/"Behind the Scenes" survival explainer): the PROGRAMMATIC_GRAPHIC/
// DIAGRAM/MAP/COMPARISON keyword regexes below fire on ordinary vocabulary
// ("checklist", "status", "forecast", "schedule", "log") even inside a
// STORY_ILLUSTRATION/CHARACTER/ENVIRONMENT macro where that vocabulary
// describes a character INTERACTING with something (a real story beat), not
// a cut to an information graphic. Real incident: the episode's opening
// sequence (a person waking and checking a tablet) classified 9 of its 13
// shots as PROGRAMMATIC_GRAPHIC purely because the narration says
// "checklist" and "status icons", leaving only ONE actual illustrated shot
// in the episode's entire first ~2 minutes — exactly the "cheap reuse, not
// intelligent reuse" failure mode this planner must avoid. Fix: the graphic-
// triggering keyword matches are now gated to macros the Visual Director
// itself already scoped as an explainer (DIAGRAM/MAP/COMPARISON/
// PROGRAMMATIC_GRAPHIC/TIMELINE) — inside those macros the behavior is
// unchanged (still appropriately graphic-heavy); inside a STORY/CHARACTER/
// ENVIRONMENT macro, the same vocabulary now falls through to
// OBJECT_DETAIL/ENVIRONMENT/CHARACTER (a photographic crop/reuse/edit of the
// established scene — e.g. "the tablet in their hands" becomes a CROP close-
// up, not a text card) exactly like any other story vocabulary would.
// Verified against the real Mars plan: PROGRAMMATIC_GRAPHIC dropped from 63
// to 26 of 115 beats (the 26 remaining are precisely the four macros the
// Visual Director itself already classified DIAGRAM/COMPARISON/
// PROGRAMMATIC_GRAPHIC — a genuine radiation-budget explainer, two dust-
// forecast/ops comparisons, and the end-of-sol procedural closeout), GENERATE
// stayed effectively flat (10 vs 11 — confirming the real story has ~10
// distinct visual setups, not too few), and EDIT rose from 5 to 19 as
// reclassified shots correctly became state-changes on an established image
// instead of a graphic card. A version bump is required (not just an in-
// place edit) because this changes existing plans' output for the same
// input — refineVisualSequences below skips reprocessing a plan whose
// shotPlannerVersion already matches, so old plans keep their prior
// classification unless deliberately reprocessed.
export const SHOT_PLANNER_VERSION = "semantic-shots-v9";
// 2026-09-22 "semantic fragment" fix — real Atlantis incident: a single
// coherent idea ("geologists evaluate whether deposits indicate rapid
// inundation or gradual deposition", 11 words) got shot-split purely from
// its real spoken DURATION suggesting N shots, then divided by raw word-
// index proportion into N roughly-equal chunks with zero regard for
// meaning — "geologists evaluate" | "whether deposits" | "indicate rapid" |
// "inundation or" | "gradual deposition". The existing wordCount cap below
// only prevented a shot from having ZERO real words (a crash-class bug);
// it never stopped a shot from having 2-4 meaningless ones. A visual beat
// needs enough semantic content that a director could answer "what should
// the viewer actually SEE during this idea" — duration is a guide, meaning
// is authoritative.
const MIN_WORDS_PER_SHOT = 6;
const GRAPHICS = new Set(["DIAGRAM", "MAP", "COMPARISON", "PROGRAMMATIC_GRAPHIC", "TIMELINE"]);
const round = value => Math.round(value * 1000) / 1000;
export function semanticRanges(segment) {
  const text = segment.text ?? "";
  const boundaries = new Set([0, text.length]);
  const matcher = /[.!?](?:[”"']?)(?=\s+[A-Z]|$)|;|\s[—–]\s|,(?=\s+(?:then|while|before|after|but|so|because|and (?:the|a|an|it|they|he|she))\b)/g;
  for (const match of text.matchAll(matcher)) boundaries.add(match.index + match[0].length);
  const points = [...boundaries].sort((a,b)=>a-b);
  const ranges = [];
  for (let i=1;i<points.length;i++) {
    let start=points[i-1], end=points[i];
    while (/\s/.test(text[start] ?? "") && start<end) start++;
    while (/\s/.test(text[end-1] ?? "") && end>start) end--;
    if (end>start) ranges.push({segmentId:segment.id,startChar:start,endChar:end,text:text.slice(start,end)});
  }
  return ranges;
}
// On-Screen Text / Explainer Density (Part 2/3/4, 2026-09-15 content-
// grounding pass) — deliberately does NOT touch macroIsExplainer (widening
// that gate is exactly the "9 of 13 shots misclassified" incident the module
// header documents). Density only re-weights which of the ALREADY-explainer-
// scoped keyword buckets get trusted: the broadest, most content-agnostic
// bucket (icons/checklist/readout/forecast/budget/schedule/log/flags/
// status/margins/indicators/recorded — the one most prone to over-
// triggering on ordinary vocabulary) is the lever. MINIMAL requires it to
// co-occur with an explicit informational cue before trusting it as a
// graphic; FREQUENT trusts it exactly as readily as today (BALANCED, the
// default, is IDENTICAL to the pre-existing behavior — zero regression risk
// for every project that predates this setting).
const EXPLICIT_INFO_CUE=/\b(exactly|precisely|specifically|in order|step by step|the numbers?|the data|the readout shows|reads?:)\b/i;
export function visualFocus(text, macro, density="balanced") {
  const value=text.toLowerCase();
  // Graphic-triggering keyword matches are only trusted inside a macro the
  // Visual Director already scoped as an explainer — see the module-level
  // comment above for the real incident this gate fixes.
  const macroIsExplainer=GRAPHICS.has(macro.visualType);
  if (macroIsExplainer) {
    if (/\b(compare|versus|tradeoffs?|trade-offs?|instead of|extra forty|24 hours)\b/.test(value)) return {type:"COMPARISON",shot:"WIDE",focus:"Compare the narrated alternatives",target:10};
    if (/\b(map|geography|route across|route to|distance between)\b/.test(value) && macro.visualType==="MAP") return {type:"MAP",shot:"WIDE",focus:"Reveal the narrated route",target:10};
    if (/\b(loops?|flow|airflow|recycling|cause|scrubbers ramp|dose.rate)\b/.test(value)) return {type:"DIAGRAM",shot:"MEDIUM",focus:"Trace the narrated mechanism",target:10};
    const genericInfoMatch=/\b(icons?|checklist|readout|forecast|budget|schedule|log|flags|status|margins?|indicators?|recorded)\b/.test(value);
    if (genericInfoMatch) {
      if (density!=="minimal" || EXPLICIT_INFO_CUE.test(value)) return {type:"PROGRAMMATIC_GRAPHIC",shot:"CLOSE",focus:"Reveal the relevant information in order",target:8.5};
      // MINIMAL, no explicit cue: this range does NOT earn a graphic — unlike
      // the generic fallback below (which defaults an unmatched range inside
      // an explainer macro to the MACRO's own graphic type), explicitly
      // route it to an illustrated framing of the same content instead of
      // silently falling through to a graphic anyway.
      return {type:"STORY_ILLUSTRATION",shot:"MEDIUM",focus:"Illustrate the narrated moment instead of a graphic card",target:8};
    }
  }
  if (/\b(valve|filter|seals?|hands|tablet|sensor|pump|cup|tea|tool)\b/.test(value)) return {type:"OBJECT_DETAIL",shot:"DETAIL",focus:"Isolate the narrated object or action",target:5.5};
  if (/\b(outside|window|horizon|landscape|bay|room|habitat|greenhouse)\b/.test(value)) return {type:"ENVIRONMENT",shot:"WIDE",focus:"Establish the narrated surroundings",target:8.5};
  if (/\b(wakes?|alarm|sleep|ritual|share|social|fatigue|relief)\b/.test(value)) return {type:"CHARACTER",shot:"CLOSE",focus:"Stay with the human moment",target:8};
  // FREQUENT: a stat-shaped phrase (a number, a percent, an explicit
  // duration/comparison figure) is worth a beat of its own attention even
  // OUTSIDE an explainer-scoped macro — the one place density is allowed to
  // surface a graphic opportunity the macro-level classification didn't
  // already anticipate. Never applies at minimal/balanced.
  if (density==="frequent" && !macroIsExplainer && /\b\d+(\.\d+)?\s?(%|percent|x|times|minutes?|hours?|days?|degrees?)\b/.test(value)) {
    return {type:"PROGRAMMATIC_GRAPHIC",shot:"CLOSE",focus:"Call out the narrated number",target:7};
  }
  return {type:macroIsExplainer?macro.visualType:"STORY_ILLUSTRATION",shot:"MEDIUM",focus:"Follow the narrated action",target:8};
}

// ============================ Freshness / visual-density engine ============================
// Real incident (production-density audit, 2026-09-14): the OLD render-
// method rule gave each MACRO exactly one baseSetupKey and let only its
// very first shot become GENERATE — every other shot in that macro (often
// 10+ shots for a 100+ second macro) mechanically cascaded through CROP
// (odd split-index) / EDIT (narrow action-verb regex) / REUSE (everything
// else). Simulated against the real Mars 115-beat plan, that produced only
// 10 fresh images and 30 REUSE/30 CROP for a 13.5-minute episode — visually
// closer to a slideshow than an illustrated documentary. This engine
// replaces that mechanical cascade with a chronological, stateful decision
// per shot: a single base image is only allowed to carry so much screen
// time / so many consecutive derived shots before the planner is forced to
// refresh it (a new GENERATE), and any shot with a materially different
// composition/state gets a real EDIT rather than being quietly folded into
// REUSE. REUSE becomes what it should always have been: the exceptional
// case (an intentional callback), not the default fallback.
//
// Thresholds are quality guardrails (Part 2 of that task), not hard quotas
// — nothing here forces an exact count, it only stops a single image from
// silently carrying more of the episode than it should.
const STATE_CHANGE_VERBS=/\b(turn|swap|replace|walk|check|inspect|adjust|stamp|clear|isolate|vent|exercise|light|ignite|open|close|shift|change|grow|fade|darken|brighten|warm|cool|arrive|leave|stand|sit|kneel|lean|point|reach|grab|release|drop|dim|flicker|flare|surge|drain|fill|empty|rise|fall|approach|retreat)\w*\b/i;
const CALLBACK_HINT=/payoff|callback|comparison|earlier|again|return/i;
const REUSE_COOLDOWN_SECONDS=40;
const MAX_BASE_STRETCH_SECONDS=20;
const MAX_BASE_STRETCH_SECONDS_OPENING=9;
const CONSECUTIVE_SAME_SOURCE_LIMIT=1;
const OPENING_WINDOW_SECONDS=60;

export function narrationTextOf(beat) {
  if (beat.shotNarrationText) return beat.shotNarrationText;
  const idx=beat.informationToCommunicate.indexOf(": ");
  return idx>=0?beat.informationToCommunicate.slice(idx+2):beat.informationToCommunicate;
}

// When a range genuinely must become multiple shots, prefer cutting at a
// natural phrase boundary near the proportional cut point rather than a
// raw word-index chop — "...rapid inundation | or gradual deposition" reads
// as two real ideas; "...indicate rapid | inundation or gradual..." does
// not. Only ever snaps WITHIN a small window of the proportional point, so
// this never meaningfully distorts the requested shot count/timing.
const PHRASE_BOUNDARY_WORD = /^(and|or|but|while|then|because|which|who|that|so)$/i;
const PHRASE_BOUNDARY_SNAP_WINDOW = 3;
function nearestPhraseBoundaryIndex(words, targetWordIndex) {
  // The range's own true start/end must never move — only INTERNAL cut
  // points between shots are eligible to snap to a nearby phrase boundary.
  if (targetWordIndex <= 0 || targetWordIndex >= words.length) return targetWordIndex;
  for (let offset = 0; offset <= PHRASE_BOUNDARY_SNAP_WINDOW; offset += 1) {
    for (const candidate of [targetWordIndex - offset, targetWordIndex + offset]) {
      if (candidate <= 0 || candidate >= words.length) continue;
      if (PHRASE_BOUNDARY_WORD.test(words[candidate].text)) return candidate;
    }
  }
  return targetWordIndex;
}
function splitRangeForShots(range, count) {
  if (count <= 1) return [{ ...range }];
  const text = range.text ?? "";
  const words = [...text.matchAll(/\S+/g)].map((m) => ({ index: m.index, text: m[0] }));
  if (!words.length) return Array.from({ length: count }, () => ({ ...range }));
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const firstWord = words[nearestPhraseBoundaryIndex(words, Math.floor(i * words.length / count))];
    const nextWord = words[nearestPhraseBoundaryIndex(words, Math.floor((i + 1) * words.length / count))];
    let localStart = firstWord?.index ?? 0;
    let localEnd = i === count - 1 ? text.length : (nextWord?.index ?? text.length);
    // Persist ranges that point at the exact stored slice. Keeping separator
    // whitespace outside the range avoids a mismatch between `.trim()`ed shot
    // narration and the source characters identified by startChar/endChar.
    while (localStart < localEnd && /\s/.test(text[localStart])) localStart += 1;
    while (localEnd > localStart && /\s/.test(text[localEnd - 1])) localEnd -= 1;
    result.push({
      ...range,
      startChar: range.startChar + localStart,
      endChar: range.startChar + localEnd,
      text: text.slice(localStart, localEnd),
    });
  }
  return result;
}

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// this used to consider EVERY macro-level candidate entity, including
// DIAGRAM_SUBJECT ones (a dialogue voice like "Timaeus (dialogue)", an
// abstract graphic concept like an on-screen bullet list — see
// visualWorldStyle.ts's own "DIAGRAM_SUBJECT rows deliberately do not
// become subject-by-subject images" design, which never generates a
// reference image OR a physical description for them). When a shot's own
// narration didn't literally mention any candidate by name, the fallback
// silently picked "the first entity in the macro's list" — which could be
// (and live evidence showed, repeatedly, WAS) a DIAGRAM_SUBJECT entity. That
// entity's bare, ungrounded id then became the beat's on-screen [SUBJECT]
// with zero reference and zero physical description, and the raster model
// invented an unrelated blob/mascot to satisfy "a subject must be here."
// Excluding DIAGRAM_SUBJECT entities from candidacy — whether genuinely
// mentioned by name or only reachable via the positional fallback — means a
// raster (GENERATE/EDIT) shot can never be anchored on something that was
// never meant to be photographed in the first place; it instead falls
// through to a real illustratable entity, the macro's own location, or (via
// buildShotIntent's own existing fallback chain) the claim's plain-text
// primarySubject / a generic honest phrase. This is entity-CATEGORY-driven,
// never a name/keyword special case, so it generalizes to any topic.
export function shotEntityIds(plan, macro, narrationText, claim, part) {
  const registry = new Map((plan.entityRegistry ?? []).map((entity) => [entity.id, entity]));
  const candidates = [...new Set([...(macro.primaryEntityIds ?? []), ...(macro.supportingEntityIds ?? [])])]
    .filter((id) => registry.get(id)?.category !== "DIAGRAM_SUBJECT");
  const haystack = `${narrationText} ${claim?.primarySubject ?? ""}`.toLowerCase();
  const mentioned = candidates.filter((id) => {
    const entity = registry.get(id);
    return [entity?.name, entity?.id].filter(Boolean).some((name) => haystack.includes(String(name).toLowerCase()));
  });
  if (mentioned.length) return mentioned;
  return part === 0 ? candidates.slice(0, 2) : candidates.slice(0, 1);
}

function buildShotIntent({ plan, macro, claim, focus, focusStep, narrationText, part, totalParts, shotSize, priorBeat, preferMacroSubject }) {
  const spoken = narrationText.replace(/[;—–]\s*$/, ".");
  const entityIds = shotEntityIds(plan, macro, narrationText, claim, part);
  // See focusFromClaim's comment — when this macro is one of several sharing
  // the same narration segment/claim, its OWN entities/location are the real
  // signal for what's on screen; the claim's single shared primarySubject
  // would otherwise flatten every sibling macro onto the same subject.
  const subject = preferMacroSubject
    ? (entityIds[0] ?? macro.locationId ?? claim?.primarySubject ?? "the narrated subject")
    : (claim?.primarySubject ?? entityIds[0] ?? macro.locationId ?? "the narrated subject");
  // 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
  // `subject` above is frequently a raw entity registry id (entityIds[0] —
  // compileEpisodeBeat downstream depends on it staying that way to resolve
  // focalEntityId, so it must never be changed here), but visualDelta is
  // free-form prompt/UI TEXT that gets persisted verbatim and fed straight
  // into the compiled image prompt. Resolve a display form for text
  // construction only, exactly like episodePreflight.ts's own focalSubject/
  // displaySubject fix, so a raw id never reaches the model unresolved.
  const registryForDisplay = new Map((plan.entityRegistry ?? []).map((entity) => [entity.id, entity]));
  const displaySubject = registryForDisplay.get(subject)?.name ?? subject;
  const stateChange = /\b(appear|disappear|gone|stop|start|begin|end|open|close|turn|change|shift|dark|light|warm|cool|freeze|melt|move|fall|rise|reach|fail|restore)\w*\b/i.test(narrationText);
  const visualDelta = part === 0
    ? `Establish ${displaySubject} in the state described for this narration span.`
    : stateChange
      ? "Change only the subject state described in this narration span."
      : "Move attention from the previous shot to the new subject or action described now.";
  return {
    shotPurpose: `Help the viewer understand this exact narration moment (${focusStep}).`,
    subject,
    actionOrState: spoken,
    visualDelta,
    composition: { shotSize, progressionStep: part + 1, progressionTotal: totalParts },
    entities: entityIds,
    referenceEntityIds: entityIds,
    location: part === 0 ? (macro.locationId ?? null) : null,
    priorShotId: priorBeat?.id ?? null,
  };
}

// 2026-09-23 "systemic production stabilization" pass, Item B/H — real
// Atlantis finding: the bare `|\d` alternation classified ANY requiredVisualFact
// containing so much as a single digit anywhere as "text-shaped" (a real
// Chapter 1 claim: "on-screen bullet list: 'beyond the Pillars of Heracles',
// 'fertile plains', 'harbors/walls/canals', '9000' chronological marker',
// 'earthquake and flood'" — a genuine multi-item visual-content fact, routed
// away from shotRequiredVisualFacts purely because it happens to mention the
// number 9000). This is the exact reason compileGraphicSpec's own per-beat
// fix (beatFacts) had nothing to consume for that claim's sibling beats,
// even after the fix — assignSpanRequirements never gave any of them a
// distinct fact in the first place. Removed the bare-digit trigger; the
// remaining keyword list (an actual text/caption/label/title/number/
// statistic being READ or WRITTEN on screen) is a real, deliberate signal a
// stray digit never was.
const TEXT_SHAPED_REQUIREMENT = /\b(text|captions?|labels?|titles?|numbers?|statistics?|reads?|writes?|showing\s+["“'])\b/i;
function overlapScore(a, b) {
  const words = (value) => new Set(String(value ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const left = words(a), right = words(b);
  if (!left.size) return 0;
  let hits = 0;
  for (const word of left) if (right.has(word)) hits += 1;
  return hits / left.size;
}

// Narration-contract requirements belong to a span. Assign each one to the
// single shot that best covers it; never stamp the whole list onto every
// child. Text-shaped facts become overlay requirements and stay out of the
// raster prompt. An explicitly recommended exact overlay also gets one
// lifetime slot per claim.
export function assignSpanRequirements(beats, claims) {
  const claimsById = new Map((claims ?? []).map((claim) => [claim.claimId, claim]));
  const beatsByClaim = new Map();
  for (const beat of beats) {
    beat.shotRequiredVisualFacts = [];
    beat.spanRequirementIdsSatisfied = [];
    beat.textOverlay = null;
    if (!beat.narrationClaimId) continue;
    if (!beatsByClaim.has(beat.narrationClaimId)) beatsByClaim.set(beat.narrationClaimId, []);
    beatsByClaim.get(beat.narrationClaimId).push(beat);
  }
  for (const [claimId, claimBeats] of beatsByClaim) {
    const claim = claimsById.get(claimId);
    if (!claim) continue;
    for (const [index, fact] of (claim.requiredVisualFacts ?? []).entries()) {
      const ranked = [...claimBeats].sort((a, b) => overlapScore(fact, b.shotNarrationText ?? b.informationToCommunicate) - overlapScore(fact, a.shotNarrationText ?? a.informationToCommunicate));
      const target = ranked[0];
      if (!target) continue;
      target.spanRequirementIdsSatisfied.push(`${claimId}:required:${index}`);
      if (TEXT_SHAPED_REQUIREMENT.test(fact)) {
        target.overlayRequirement = { source: "span_required_visual_fact", text: fact, renderInRaster: false };
      } else {
        target.shotRequiredVisualFacts.push(fact);
      }
    }
    const overlay = claim.textOverlayCandidate;
    if (overlay?.recommended && overlay.semanticText?.trim()) {
      const target = [...claimBeats].sort((a, b) => overlapScore(overlay.semanticText, b.shotNarrationText) - overlapScore(overlay.semanticText, a.shotNarrationText))[0];
      if (target) target.textOverlay = { text: overlay.semanticText.trim(), persistence: "once", sourceClaimId: claimId, renderInRaster: false };
    }
  }
  return beats;
}

// ============================ Semantic render-method policy (2026-09-15 "Visual Director rebuild") ============================
// Section 2's new priority order: NARRATION MEANING -> TEACHING GOAL ->
// BEST VISUAL FORM -> PERCEPTUAL NOVELTY -> CONTINUITY REQUIREMENT ->
// REFERENCE REQUIREMENTS -> CHEAPEST VALID RENDER METHOD -> PROVIDER. Cost
// is LAST: EDIT is never chosen merely because it's cheaper, only when the
// Narration Visual Contract's own continuityRequirement says this beat is a
// genuine "same base composition + localized state change" (Section 6).
// When a beat carries no contract claim (no contract was compiled for this
// project), every one of these NEW checks is a no-op and behavior is
// BYTE-IDENTICAL to the pre-existing freshness engine below — this is an
// ADDITIVE semantic layer, not a replacement, so every project that
// predates the Narration Visual Contract keeps its exact prior planning.
const REPETITION_DEBT_LIMIT = 3; // Section 7: "after 3 similar forms, diversity pressure increases" — a real threshold chosen from that explicit guidance, not invented independently.

// STRONG diversity signal (Section 10): the contract's own primarySubject
// changed. A subject change is never something EDIT/REUSE/CROP can honestly
// represent — it always means a new visual setup, regardless of what the
// legacy visualType/camera-family heuristics below would have concluded.
function subjectChanged(beat, priorState) {
  return Boolean(priorState?.lastPrimarySubject && beat.primarySubject && priorState.lastPrimarySubject !== beat.primarySubject);
}
// STRONG diversity signal: the contract's preferred visual FORM changed
// (e.g. CHARACTER_ACTION -> DIAGRAM) and the contract itself does not claim
// this is a continuation (continuityRequirement HIGH is the only case where
// a form can legitimately "continue" — e.g. ENVIRONMENT_DETAIL before/after
// a state change keeps the same form on purpose).
function visualFormChanged(beat, priorState) {
  return Boolean(priorState?.lastContractVisualForm && beat.contractVisualForm && priorState.lastContractVisualForm !== beat.contractVisualForm && beat.continuityRequirement !== "HIGH");
}

// Mutates each beat's renderMethod/shotStrategy/baseSetupKey/
// deltaInstruction plus explainable diversity metadata, in real
// chronological order (beats must already be time-sorted). Graphic beats
// are left exactly as pass one classified them but still get to interrupt/
// reset an overstretched setup's freshness clock, so a graphic beat
// genuinely counts as a palate-cleanser rather than dead time layered on
// top of an already-stale image.
// 2026-09-19 "fix graphic rhythm" V1 fix, Section 5 of the task brief: real
// Mars finding — standalone PROGRAMMATIC_GRAPHIC beats formed 5-9-beat
// decks (53-61, 96-98, 123-127) because nothing capped how many could run
// consecutively; every beat the Visual Director scoped as an explainer
// macro became a graphic unconditionally. Two beats is the hard ceiling —
// a 3rd+ consecutive graphic downgrades to the normal photographic
// classification below (never silently dropped, never forced into an
// awkward non-graphic treatment of genuinely graphic content — it just
// takes its turn once the cluster limit resets). The one exception:
// beat.intentionalVisualComparison (a deliberately defined comparison/
// build sequence, the exact "allow exceptions" case the brief names) is
// never capped — Section 10's own signal for "this repetition is
// intentional" already exists and is reused here, never duplicated.
const MAX_CONSECUTIVE_GRAPHICS = 2;

export function assignRenderStrategies(beats) {
  const setupState=new Map(); // active setup key -> freshness state
  const activeKeyForBase=new Map(); // candidateBaseKey -> current active (possibly suffixed) key
  const suffixCounter=new Map();
  let consecutiveGraphics=0;

  for (const beat of beats) {
    const graphicCapped=GRAPHICS.has(beat.visualType) && consecutiveGraphics>=MAX_CONSECUTIVE_GRAPHICS && !beat.intentionalVisualComparison;
    const graphic=GRAPHICS.has(beat.visualType) && !graphicCapped;
    beat.graphicClusterCapped=graphicCapped; // diagnostic: this beat WOULD have been a graphic but the consecutive-cluster cap redirected it to a fresh illustrated composition instead
    consecutiveGraphics=graphic?consecutiveGraphics+1:0;
    const candidateBase=beat.candidateBaseKey;

    if (graphic) {
      beat.renderMethod="PROGRAMMATIC_GRAPHIC";
      beat.shotStrategy=beat.visualType==="DIAGRAM"?"DIAGRAM":beat.visualType==="MAP"?"MAP":beat.visualType==="COMPARISON"?"COMPARISON":"TEXT_INFOGRAPHIC";
      beat.baseSetupKey=null;
      beat.deltaInstruction=null;
      beat.graphicReason=`Narration matched an explainer/graphic pattern inside a ${beat.visualType} sequence — the Visual Director already scoped this macro as an explainer.`;
      beat.freshnessDecision="graphic";
      beat.diversityReason="graphic_interruption_resets_debt";
      beat.meaningfulStateDelta=false;
      beat.sourceReuseCount=0;
      beat.secondsSinceSourceLastUsed=null;
      beat.intentionalCallback=false;
      // A graphic interruption resets the underlying setup's stretch clock
      // AND its repetition debt — the next photographic shot on that base
      // gets a full fresh allowance rather than inheriting stale
      // accumulated duration or debt.
      const activeKey=activeKeyForBase.get(candidateBase);
      const state=activeKey&&setupState.get(activeKey);
      if (state) setupState.set(activeKey,{...state,screenTimeSinceFresh:0,consecutiveDerived:0,repetitionDebt:0,consecutiveEditsOnSetup:0});
      continue;
    }

    const duration=beat.estimatedEndSeconds-beat.estimatedStartSeconds;
    const opening=beat.estimatedStartSeconds<OPENING_WINDOW_SECONDS;
    const text=narrationTextOf(beat);
    const isDetail=beat.visualType==="OBJECT_DETAIL"||beat.shotSize==="DETAIL";
    const stateChangeVerb=STATE_CHANGE_VERBS.test(text);

    let activeKey=activeKeyForBase.get(candidateBase);
    const priorState=activeKey?setupState.get(activeKey):null;

    const materialFocusChange=Boolean(priorState&&priorState.lastFocusType&&priorState.lastFocusType!==beat.visualType);
    const subjectChangedFlag=subjectChanged(beat,priorState);
    const visualFormChangedFlag=visualFormChanged(beat,priorState);
    const stretchLimit=opening?MAX_BASE_STRETCH_SECONDS_OPENING:MAX_BASE_STRETCH_SECONDS;
    const overStretched=Boolean(priorState&&priorState.screenTimeSinceFresh>=stretchLimit);
    const overConsecutive=Boolean(priorState&&priorState.consecutiveDerived>=CONSECUTIVE_SAME_SOURCE_LIMIT);
    const debtExceeded=Boolean(priorState&&priorState.repetitionDebt>=REPETITION_DEBT_LIMIT);
    const secondsSinceLastUsed=priorState?round(beat.estimatedStartSeconds-priorState.lastUsedEnd):null;
    const cooldownSatisfied=secondsSinceLastUsed==null||secondsSinceLastUsed>=REUSE_COOLDOWN_SECONDS||beat.visualType==="COMPARISON";
    const isCallback=Boolean(priorState&&!overStretched&&!overConsecutive&&cooldownSatisfied&&CALLBACK_HINT.test(beat.narrativeFunction??""));

    // Section 6's real narrowing of EDIT: a state-change VERB alone is no
    // longer sufficient. When this beat carries a contract claim, EDIT is
    // only valid when the claim itself says continuityRequirement is
    // MEDIUM/HIGH (a genuine "same base composition, localized state
    // change" per the contract's own semantic judgment) — a claim that
    // explicitly says NONE/LOW continuity is NOT an edit candidate even if
    // the narration happens to contain a state-change verb (e.g. "she
    // stands and walks to a different room" contains "stand"/"walk" but is
    // a new composition, not a localized edit — continuityRequirement NONE
    // correctly overrides the verb match). Beats with NO contract claim
    // keep the exact prior verb-only behavior (backward compatible).
    const contractBlocksEdit=beat.continuityRequirement==="NONE"||beat.continuityRequirement==="LOW";
    // 2026-09-19 "fix EDIT abuse" V1 fix, Section 4: a contract claim that
    // explicitly reports no real before/after distinction (hasContractStateChange
    // === false, set in refineVisualSequences from claim.stateBefore/
    // stateAfter) means the claimed "state change" is trivial (same pose,
    // same frame, a tiny cosmetic difference) — never a valid EDIT trigger
    // even if the narration verb regex matched. undefined (no claim at all)
    // is a no-op, same backward-compatible pattern every other contract
    // signal here already follows.
    const contractDeniesTrivialEdit=beat.hasContractStateChange===false;
    // Section 4's chain rule: "maximum BASE FRAME -> one EDIT. Then require
    // a new composition." One EDIT already happened on this setup
    // (consecutiveEditsOnSetup>=1) and this would be a SECOND consecutive
    // EDIT off the same base — only allowed for an explicit before/during/
    // after progression (beat.hasTemporalProgression, from the contract's
    // own temporalClaims — never inferred from the verb regex alone).
    const editChainCapped=Boolean(priorState&&priorState.consecutiveEditsOnSetup>=1&&!beat.hasTemporalProgression);
    const stateChange=stateChangeVerb&&!contractBlocksEdit&&!contractDeniesTrivialEdit&&!editChainCapped;

    const freshEvent=()=>{const n=(suffixCounter.get(candidateBase)??1)+1;suffixCounter.set(candidateBase,n);return `${candidateBase}__${n}`;};
    let method,freshnessDecision,diversityReason;
    if (!priorState) {
      method="GENERATE";freshnessDecision="new_setup";diversityReason="first_occurrence";
    } else if (subjectChangedFlag) {
      // STRONG (Section 10): the narration's own primary subject changed —
      // never representable as an edit/reuse/crop of the old subject.
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="subject_change_new_setup";diversityReason=`primarySubject changed (${priorState.lastPrimarySubject} -> ${beat.primarySubject})`;
    } else if (visualFormChangedFlag) {
      // STRONG: the contract's preferred visual FORM changed and the
      // contract itself doesn't claim this is a continuation.
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="visual_form_change_new_setup";diversityReason=`visual form changed (${priorState.lastContractVisualForm} -> ${beat.contractVisualForm})`;
    } else if (materialFocusChange) {
      // Legacy composition-family change (ENVIRONMENT vs CHARACTER vs
      // OBJECT_DETAIL vs STORY_ILLUSTRATION) — the pre-contract safety net,
      // still checked for beats with no contract claim or whose claim
      // didn't flag a form/subject change itself.
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="composition_change_new_setup";diversityReason="legacy visualType family changed";
    } else if (overStretched) {
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="stretch_refresh";diversityReason=`screen time on this setup exceeded ${stretchLimit}s without a refresh`;
    } else if (debtExceeded) {
      // Section 7/10: three or more consecutive weakly-differentiated
      // derived shots on this setup — force a fresh composition even
      // though no single signal above tripped, because the ACCUMULATED
      // similarity itself is now the problem (repetition debt).
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="diversity_break_repetition_debt";diversityReason=`repetitionDebt reached ${priorState.repetitionDebt} (limit ${REPETITION_DEBT_LIMIT}) — too many weakly-differentiated shots in a row`;
    } else if (editChainCapped&&(stateChangeVerb||overConsecutive)) {
      // Section 4's V1 rule, applied uniformly BEFORE either EDIT path below
      // gets a chance to fire again: one EDIT already happened on this exact
      // setup and this beat would otherwise become a second consecutive one
      // (whether via a direct state-change verb or as a chain-breaker) with
      // no explicit before/during/after progression to justify a third
      // related state. "Then require a new composition" — a fresh GENERATE,
      // never another EDIT stacked on the same base.
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="edit_chain_capped";diversityReason="a second consecutive EDIT on this setup was blocked (V1 rule: base frame -> one EDIT, then a new composition, unless the contract signals an explicit before/during/after progression)";
    } else if (isDetail&&!stateChange&&!opening) {
      method="CROP";freshnessDecision="crop_within_frame";diversityReason="framing-only change, no state/subject/form change";
    } else if (overConsecutive&&stateChange) {
      // Too many consecutive exact-pixel derivations off one frame — break
      // the chain with a state-changing EDIT rather than a whole new base
      // image, but ONLY when the contract doesn't itself say this beat
      // needs no continuity (in which case GENERATE, not EDIT, is correct
      // — see the fallback below).
      method="EDIT";freshnessDecision="consecutive_chain_broken";diversityReason="too many consecutive derived shots off one frame; contract permits continuity";
    } else if (stateChange) {
      // Section 6: EDIT means SAME BASE COMPOSITION + LOCALIZED STATE
      // CHANGE. Reached only when nothing above forced a fresh composition
      // AND (contractBlocksEdit is false) the contract's own
      // continuityRequirement is MEDIUM/HIGH or no contract claim exists.
      method="EDIT";freshnessDecision="edit_state_change";diversityReason=beat.continuityRequirement?`contract continuityRequirement=${beat.continuityRequirement}, localized state change`:"narration verb indicates a localized state change (no contract claim for this range)";
    } else if (isCallback) {
      method="REUSE";freshnessDecision="intentional_reuse";diversityReason="narrativeFunction indicates a deliberate callback/comparison";
    } else if (stateChangeVerb&&contractBlocksEdit) {
      // Section 9: "action materially changes... force new GENERATE." The
      // narration itself signals a real action/state change (the verb
      // matched) but the contract says this is NOT a mere localized
      // continuation of the prior setup (continuityRequirement NONE/LOW) —
      // that combination means something is genuinely changing beyond what
      // EDIT is for, so it earns a fresh composition rather than silently
      // falling through to REUSE (which is reserved for a beat with no
      // detected change signal at all — see the final fallback below).
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="contract_requires_fresh_composition";diversityReason=`continuityRequirement=${beat.continuityRequirement} but narration signals a real action/state change — not a mere continuation`;
    } else if (overConsecutive&&contractBlocksEdit) {
      // The consecutive-chain limit was hit (a chain-breaking EDIT would
      // normally follow) but the contract itself says this beat needs no
      // continuity — escalate to a fresh composition instead of forcing an
      // EDIT the contract explicitly didn't ask for. Deliberately scoped to
      // ONLY this case (chain-break blocked): continuityRequirement LOW/
      // NONE alone, with no other signal at all, is NOT reason enough to
      // force a fresh composition — REUSE/CROP remain valid for a beat that
      // genuinely doesn't need to look any different, never a forced GENERATE
      // just because it would need less provider work (Section 2: render
      // method is decided by semantics first, the provider/expense
      // implication comes last).
      activeKey=freshEvent();
      method="GENERATE";freshnessDecision="contract_requires_fresh_composition";diversityReason=`continuityRequirement=${beat.continuityRequirement ?? "n/a"} blocks the chain-breaking EDIT that would otherwise apply here`;
    } else {
      method="REUSE";freshnessDecision="default_reuse_no_signal";diversityReason="no subject/form/composition/state change detected";
    }

    activeKeyForBase.set(candidateBase,activeKey??candidateBase);
    const finalKey=activeKeyForBase.get(candidateBase);
    beat.baseSetupKey=finalKey;
    beat.shotStrategy=method==="GENERATE"?"NEW_SETUP":method==="CROP"?"DETAIL":"REUSE_WITH_DELTA";
    beat.renderMethod=method;
    beat.deltaInstruction=method==="EDIT"?text:null;
    beat.freshnessDecision=freshnessDecision;
    beat.diversityReason=diversityReason;
    beat.meaningfulStateDelta=materialFocusChange||stateChange||subjectChangedFlag||visualFormChangedFlag;
    beat.sourceReuseCount=priorState?priorState.useCount:0;
    beat.secondsSinceSourceLastUsed=secondsSinceLastUsed;
    beat.intentionalCallback=freshnessDecision==="intentional_reuse";
    beat.graphicReason=null;
    beat.repetitionDebt=method==="GENERATE"?0:(priorState?.repetitionDebt??0);
    beat.sameBaseRunLength=method==="GENERATE"?1:(priorState?.sameBaseRunLength??0)+1;
    beat.sameVisualFormRunLength=(priorState?.lastContractVisualForm===beat.contractVisualForm&&beat.contractVisualForm)?(priorState?.sameVisualFormRunLength??0)+1:1;

    // The stretch clock and the consecutive-identical-pixels counter reset
    // on ANY genuinely new render (GENERATE or EDIT) — real new pixels were
    // just shown either way — but only REUSE/CROP (truly identical or
    // near-identical pixels) ever increment the consecutive-identical
    // counter. Repetition debt (Section 7/10) is a SEPARATE, coarser
    // signal: it increments for any derived shot (REUSE/CROP/EDIT) whose
    // continuity is NOT explicitly HIGH (i.e. not a deliberately justified
    // state-comparison edit) — a legitimate "machine ON -> same composition
    // OFF" HIGH-continuity edit does not accrue debt at all (Section 7's
    // explicit exception), while a same-form REUSE/CROP with no such
    // justification does.
    const isFreshRender=method==="GENERATE"||method==="EDIT";
    const isJustifiedContinuity=method==="EDIT"&&beat.continuityRequirement==="HIGH";
    const base=setupState.get(finalKey);
    setupState.set(finalKey,{
      screenTimeSinceFresh:isFreshRender?0:(base?.screenTimeSinceFresh??0)+duration,
      consecutiveDerived:isFreshRender?0:(base?.consecutiveDerived??0)+1,
      // Section 4 "fix EDIT abuse": tracked SEPARATELY from consecutiveDerived
      // (which EDIT deliberately resets, since it IS a fresh render) — this
      // counts how many EDITs in a row have accumulated on this exact setup,
      // resetting only on a genuine GENERATE (a real new base composition).
      consecutiveEditsOnSetup:method==="GENERATE"?0:method==="EDIT"?(base?.consecutiveEditsOnSetup??0)+1:(base?.consecutiveEditsOnSetup??0),
      repetitionDebt:method==="GENERATE"?0:isJustifiedContinuity?(base?.repetitionDebt??0):(base?.repetitionDebt??0)+1,
      sameBaseRunLength:beat.sameBaseRunLength,
      sameVisualFormRunLength:beat.sameVisualFormRunLength,
      useCount:(base?.useCount??0)+1,
      lastFocusType:beat.visualType,
      lastPrimarySubject:beat.primarySubject??base?.lastPrimarySubject,
      lastContractVisualForm:beat.contractVisualForm??base?.lastContractVisualForm,
      lastUsedEnd:beat.estimatedEndSeconds,
    });
  }
}
// Section 8 of the 2026-09-16 "production invariants" pass: a deterministic
// composition fingerprint built from whatever fields are ALREADY decided at
// shot-planning time (before the Scene Director's later camera-framing/
// focal-subject judgment even runs) — deliberately coarse-grained rather
// than waiting for compile-time detail, because the whole point is to catch
// a stagnant sequence BEFORE any provider spend, not after a post-render
// perceptual hash. baseSetupKey/shotSize/visualForm/primarySubject are
// exactly the fields the real shot 28/29/30 incident shared identically
// across all three beats despite three different render strategies.
// 2026-09-19 "add the global sequencer" V1 fix, Section 3: enriched with
// character binding (primaryEntityIds — "the same recurring characters are
// in frame") and environment (locationId) on top of the existing four
// fields — the task's own explicit list of "meaningful planning features"
// beyond raw setup/shot-size/visual-type labels. Sorted+joined so two
// beats with the same cast in a different array order still match.
export function buildCompositionFingerprint(beat) {
  return {
    baseSetupKey:beat.baseSetupKey??null,
    shotSize:beat.shotSize??null,
    visualForm:beat.contractVisualForm??beat.visualType??null,
    primarySubject:beat.primarySubject??null,
    characterIds:[...(beat.primaryEntityIds??[])].sort().join(",")||null,
    locationId:beat.locationId??null,
    action:beat.semanticAction??null,
    cameraFraming:beat.cameraFraming??null,
  };
}

// STRONG-signal-only equality (Section 8's own weighting: "subject/
// composition/camera/visual-form = strong") — every one of these fields
// must match for two beats to count as "the same shot" to a viewer.
// A null baseSetupKey (a graphic beat) never matches anything, including
// another null — two unrelated graphics sharing "no setup" isn't a
// repetition signal.
export function fingerprintsNearIdentical(a,b) {
  if (!a.baseSetupKey||!b.baseSetupKey) return false;
  return a.shotSize===b.shotSize&&a.visualForm===b.visualForm&&a.primarySubject===b.primarySubject&&a.characterIds===b.characterIds&&a.locationId===b.locationId&&a.action===b.action&&a.cameraFraming===b.cameraFraming;
}

// 2026-09-19 "add the global sequencer" V1 fix, Section 3's own rolling-
// window targets: within 5 beats, aim for >=3 meaningfully different
// compositions and >=2 shot sizes; within 8, aim for real visual-form
// variety. Deliberately DIAGNOSTIC only (added to densityDiagnostics.errors,
// never mutates the plan) — these are "target"/"when narration permits"
// language in the brief, softer than the hard 3-window/4-window/graphic-
// cluster rules above, which DO mutate. Reported so a genuinely stagnant
// stretch is visible without risking an aggressive, undertested rewrite of
// beats the softer signal isn't confident enough to force a fresh
// composition on.
export function checkRollingWindowVariety(beats) {
  const photographic=beats.filter(b=>!GRAPHICS.has(b.visualType));
  const errors=[];
  for (let i=0;i+4<photographic.length;i++) {
    const window=photographic.slice(i,i+5);
    const fingerprints=window.map(buildCompositionFingerprint);
    const distinctCompositions=new Set(fingerprints.map(f=>JSON.stringify(f))).size;
    const distinctShotSizes=new Set(window.map(b=>b.shotSize)).size;
    if (distinctCompositions<3) errors.push({code:"low_composition_variety_5window",beatId:window[0].id,distinctCompositions});
    if (distinctShotSizes<2) errors.push({code:"low_shot_size_variety_5window",beatId:window[0].id,distinctShotSizes});
  }
  for (let i=0;i+7<photographic.length;i++) {
    const window=photographic.slice(i,i+8);
    const distinctVisualForms=new Set(window.map(b=>b.contractVisualForm??b.visualType)).size;
    if (distinctVisualForms<2) errors.push({code:"low_visual_form_variety_8window",beatId:window[0].id,distinctVisualForms});
  }
  return errors;
}

// Section 9: "no 3 consecutive final beats may have essentially the same
// subject+camera+composition+action+visual form... at least one must
// materially change" — scans every 3-beat window of the NON-graphic beats
// (a graphic interruption is already its own diversity signal, never part
// of the stagnation this rule targets) and forces the MIDDLE beat to a
// fresh GENERATE composition when all three fingerprints match, UNLESS
// Section 10's explicit intentionalVisualComparison exception applies to
// any beat in the window. Mutates beats in place, same convention as
// assignRenderStrategies.
function enforceExactFingerprintWindow(photographic) {
  for (let i=0;i+2<photographic.length;i++) {
    const [a,b,c]=[photographic[i],photographic[i+1],photographic[i+2]];
    if (a.intentionalVisualComparison||b.intentionalVisualComparison||c.intentionalVisualComparison) continue;
    if (b.diversityForced) continue; // already broken by an earlier window's fix
    const fa=buildCompositionFingerprint(a),fb=buildCompositionFingerprint(b),fc=buildCompositionFingerprint(c);
    if (fingerprintsNearIdentical(fa,fb)&&fingerprintsNearIdentical(fb,fc)) {
      const freshKey=`${b.candidateBaseKey??b.baseSetupKey}__diversity_${b.id}`;
      b.renderMethod="GENERATE";
      b.shotStrategy="NEW_SETUP";
      b.baseSetupKey=freshKey;
      b.deltaInstruction=null;
      b.freshnessDecision="sequence_diversity_break";
      b.diversityReason=`sequence_diversity_forced: this beat and its immediate neighbors shared an identical composition fingerprint (baseSetupKey/shotSize/visualForm/primarySubject) with no intentionalVisualComparison — at least one had to materially change`;
      b.diversityForced=true;
      b.cameraFraming="Reverse three-quarter view focused on the narrated action";
      b.shotSize=b.shotSize==="WIDE"?"CLOSE":"WIDE";
    }
  }
}

// 2026-09-18 "production visual reliability v2" pass, Section 7 — a
// COARSER, LONGER-RANGE companion to the strict 3-window fingerprint check
// above: even when individual shots vary enough to dodge the strict
// 3-in-a-row identity check (a slightly different shotSize here, a
// different pose note there), the SAME base visual setup persisting for 5
// or 8 shots straight is still the real "visually stagnant" defect the
// brief names ("too many frames from the same source image"). Checked on
// baseSetupKey ALONE (not the full fingerprint) — deliberately coarser,
// since the point here is raw run-length on one setup, not composition
// identity. Forces a break at the window's midpoint, once per window,
// never re-breaking a beat an earlier (smaller) window already fixed.
function enforceLongRunWindow(photographic, windowSize) {
  for (let i=0;i+windowSize-1<photographic.length;i++) {
    const window=photographic.slice(i,i+windowSize);
    if (window.some(b=>b.intentionalVisualComparison||b.diversityForced)) continue;
    const key=window[0].baseSetupKey;
    if (!key) continue;
    if (!window.every(b=>b.baseSetupKey===key)) continue;
    const mid=window[Math.floor(windowSize/2)];
    const freshKey=`${mid.candidateBaseKey??mid.baseSetupKey}__diversity_longrun_${mid.id}`;
    mid.renderMethod="GENERATE";
    mid.shotStrategy="NEW_SETUP";
    mid.baseSetupKey=freshKey;
    mid.deltaInstruction=null;
    mid.freshnessDecision="sequence_diversity_break_long_run";
    mid.diversityReason=`sequence_diversity_forced_long_run: ${windowSize} consecutive beats shared the same base visual setup with no intentional continuity reason — the viewer would perceive this as the same shot held far too long`;
    mid.diversityForced=true;
    mid.cameraFraming="Wide oblique view connecting the narrated subject to its environment";
    mid.shotSize="WIDE";
  }
}

// The one entry point every caller uses — runs the strict 3-window check
// first (catches near-identical neighbors), then the coarser 5- and
// 8-window long-run checks (catches a setup that persists too long even
// while varying slightly shot to shot). Order matters: a beat the 3-window
// pass already fixed is skipped by the long-run passes (diversityForced),
// so a single stagnant run is never "fixed" twice with conflicting fresh
// keys.
// 2026-09-19 "add the global sequencer" V1 fix: window 4 added to the
// default set — real Mars finding, the exact reported bug (4+ consecutive
// beats sharing one base setup: 5-8, 26-29, 88-91, 114-117, 118-121) fell
// through the gap between the strict 3-window check and the coarser 5/8
// long-run checks. Precisely targeted, minimal addition (enforceLongRunWindow
// is already generic over window size) rather than a new mechanism.
export function enforceSequenceDiversity(beats, windowSizes=[3,4,5,8]) {
  const photographic=beats.filter(b=>b.renderMethod!=="PROGRAMMATIC_GRAPHIC");
  enforceExactFingerprintWindow(photographic);
  for (const size of windowSizes) {
    if (size===3) continue; // already covered by the strict fingerprint pass above
    enforceLongRunWindow(photographic, size);
  }
}

// Redistributes an already-computed duration split into FEWER buckets,
// preserving the exact total (never drops or invents time) — used when a
// range has fewer real words than the timing-only split wanted shots, so
// the word-based cap never leaves a gap in the timeline.
function mergeDurationsToCount(durations,targetCount) {
  if (targetCount>=durations.length) return durations;
  const merged=Array.from({length:targetCount},()=>0);
  durations.forEach((d,i)=>{merged[Math.min(targetCount-1,Math.floor(i*targetCount/durations.length))]+=d;});
  return merged;
}
function splitDuration(duration,target,maxDuration) {
  const count=Math.max(1,Math.round(duration/target),Math.ceil(duration/maxDuration));
  // Uneven holds give emphasis to the idea before moving into its detail.
  const weights=Array.from({length:count},(_,i)=>i===0?1.12:i===count-1?.88:i%2?1.06:.94);
  const total=weights.reduce((a,b)=>a+b,0);
  const durations=weights.map(w=>duration*w/total);
  if (Math.max(...durations)>maxDuration) return splitDuration(duration,target*.85,maxDuration);
  return durations;
}
// Matches the Script pipeline's own WORDS_PER_MINUTE exactly (see
// advance-long-form-script's computeEstimatedDurationSeconds) — narration
// timing must be derived from the SAME formula the Script itself uses for
// its own authoritative estimatedDurationSeconds, not reinvented here.
// Phase 0, Section C.1 — imported from the shared constants module above.
const countWords = text => (text.match(/\S+/g) ?? []).length;

// NARRATION IS THE MASTER CLOCK. Each segment's real duration comes from its
// CURRENT actual word count — never from the segment's own stored
// `estimatedSeconds` field, which is a one-time model self-report written
// whenever that segment was last drafted/revised/expanded/rewritten and
// never refreshed afterward (exactly the class of staleness
// advance-long-form-script's own attachChapterMetrics comment already
// documents for chapter aggregates — see computeEstimatedDurationSeconds's
// comment there: "never summed from per-segment estimatedSeconds, a model
// self-report, not a measurement"). Real incident: a 2,028-word/811s script
// (computeEstimatedDurationSeconds = 2028/150*60 = 811.2) had per-segment
// estimatedSeconds summing to only 585s (stale from before a length
// expansion and a conservative rewrite added words to many segments), and
// the Visual Director's own macro-level estimatedStartSeconds/EndSeconds —
// untethered from either number — summed to 570s. Word-count-based
// per-segment durations sum to exactly 811.2s, matching the script's own
// authoritative total by construction.
function buildSegmentWindows(segments) {
  const windows = new Map();
  let cursor = 0;
  for (const s of segments) {
    const duration = (countWords(s.text) / WORDS_PER_MINUTE) * 60;
    windows.set(s.id, { start: cursor, end: cursor + duration, duration });
    cursor += duration;
  }
  return windows;
}

// Distributes each segment's real duration among the items that reference
// it, via a running cursor per segment (not by mapping each item's own
// character offset independently against the full segment). The
// independent-mapping approach was tried first and produces small but real
// gaps between adjacent items: semanticRanges trims leading/trailing
// whitespace off each range, so range N's endChar and range N+1's startChar
// are rarely exactly equal — mapped independently, that whitespace becomes
// a ~0.05-0.1s dead-air gap at every range boundary (visualDensity's own
// timing_gap_or_overlap check correctly caught this). A running cursor
// distributes the segment's FULL real duration with zero gaps by
// construction — no leftover whitespace time unaccounted for — while still
// giving each item a proportional share of that segment's real window.
// `items`: [{segmentId, weight}], in the order they should be laid out.
// Returns a parallel array of {start, end, duration}.
function distributeAcrossSegments(items, segmentWindows) {
  const bySegment = new Map();
  items.forEach((item, i) => {
    if (!bySegment.has(item.segmentId)) bySegment.set(item.segmentId, []);
    bySegment.get(item.segmentId).push(i);
  });
  const result = new Array(items.length);
  for (const [segmentId, indices] of bySegment) {
    const win = segmentWindows.get(segmentId) ?? { start: 0, end: 0, duration: 0 };
    const totalWeight = indices.reduce((sum, i) => sum + items[i].weight, 0) || 1;
    let cursor = win.start;
    for (const i of indices) {
      const share = items[i].weight / totalWeight;
      const duration = share * win.duration;
      result[i] = { start: cursor, end: cursor + duration, duration };
      cursor += duration;
    }
  }
  return result;
}

// Part 9 (2026-09-15 semantic-grounding pass): when a Narration Visual
// Contract claim covers this exact range, it is AUTHORITATIVE — it replaces
// visualFocus's own regex guess entirely, never just nudges it. This is the
// "remove fragile reasoning responsibilities from regexes where the
// contract now supplies authoritative meaning" instruction: the contract
// already worked out negation/comparison/cause-effect/story-vs-explainer
// from real semantic understanding, which the keyword regexes below could
// only ever approximate. When no claim covers this range (no contract was
// compiled for this project, or the range falls in a compilation gap),
// visualFocus's existing regex behavior is the unchanged fallback — fully
// backward compatible with every project that predates this system.
// 2026-09-22 "macro over-planning" fix (Layer B) — real Atlantis incident:
// when several sibling macro beats are all linked to the SAME narration
// segment (a long segment the Visual Director deliberately gave multiple
// genuinely distinct visual ideas — reception history, cognitive mechanics,
// candidate sites, methodology, evidence contrast, payoff — each with its
// own real informationToCommunicate/narrativeFunction/visualType), every one
// of their shots still matched the SAME contract claim (claims key off
// segment, not macro) and focusFromClaim/buildShotIntent unconditionally
// preferred the CLAIM's single shared visualCommunicationGoal/primarySubject
// over each macro's own already-differentiated content. The result: six
// macros with six real ideas compiled to nearly-identical [VISUAL PURPOSE]/
// [SUBJECT] prompt sections, differing only in a raw narration-text
// fragment — a genuine duplicate at the image level despite correct macro
// planning. `firstClause` keeps the override short (matches the rest of
// this prompt section's own brevity) rather than dumping the whole macro
// description in.
function firstClause(text) {
  const match = /^[^.!?]*[.!?]/.exec(String(text ?? "").trim());
  return (match ? match[0] : text ?? "").trim();
}
function focusFromClaim(claim, density, macro, preferMacro) {
  const type = preferMacro && macro?.visualType ? macro.visualType : resolveClaimVisualType(claim, density);
  const graphic = GRAPHICS.has(type);
  return {
    type,
    shot: graphic ? "CLOSE" : type === "ENVIRONMENT" ? "WIDE" : type === "OBJECT_DETAIL" ? "DETAIL" : "MEDIUM",
    focus: preferMacro && macro?.informationToCommunicate ? firstClause(macro.informationToCommunicate) : claim.visualCommunicationGoal,
    target: graphic ? 8.5 : type === "OBJECT_DETAIL" ? 5.5 : 8,
  };
}

export function refineVisualSequences(source, script, density="balanced", contractClaims=null) {
  if (source.shotPlannerVersion===SHOT_PLANNER_VERSION && (!contractClaims || source.directorReliabilityVersion===DIRECTOR_RELIABILITY_VERSION)) return structuredClone(source);
  const plan=structuredClone(source);
  const macroItems=plan.visualSequences ?? plan.visualBeats ?? [];
  const segments=script.narrationSegments ?? [];
  const segmentMap=new Map(segments.map(s=>[s.id,s]));
  const segmentWindows=buildSegmentWindows(segments);
  // A narration segment may be referenced by several macro beats. Older
  // expansion replayed the segment's complete semantic range list inside
  // every macro, creating parallel sequences with identical narration and
  // prompts. Partition each segment's ordered semantic ranges across its
  // linked macros once, preserving chronology and complete coverage.
  const assignedRangesByMacro=new Map(macroItems.map(macro=>[macro.id,[]]));
  // Layer B tracking: does this macro share a narration segment with any
  // OTHER macro? See focusFromClaim/buildShotIntent's own comments for why
  // this matters — a macro with real siblings must never let a segment-wide
  // contract claim flatten its own distinct subject/purpose onto theirs.
  const macroHasSiblings=new Map(macroItems.map(macro=>[macro.id,false]));
  for (const segment of segments) {
    const linked=macroItems.filter(macro=>(macro.narrationSegmentIds??[]).includes(segment.id));
    if (!linked.length) continue;
    if (linked.length>1) for (const m of linked) macroHasSiblings.set(m.id,true);
    const ranges=semanticRanges(segment);
    for (let i=0;i<ranges.length;i++) {
      const target=linked[Math.min(linked.length-1,Math.floor(i*linked.length/Math.max(ranges.length,1)))];
      assignedRangesByMacro.get(target.id).push(ranges[i]);
    }
  }
  const visualBeats=[], visualSequences=[], established=new Set(), productionAssets=new Map(), sketchContexts=new Map();
  for (const macro of macroItems) {
    let ranges=assignedRangesByMacro.get(macro.id) ?? [];
    // Backward-compatible fallback for malformed plans whose macro points to
    // a missing segment; the existing explicit error below remains intact.
    if (!ranges.length) ranges=(macro.narrationSegmentIds ?? []).flatMap(id=>semanticRanges(segmentMap.get(id) ?? {id,text:""}));
    if (!ranges.length) throw new Error("Sequence has no linked narration");
    // Real, absolute time window for each range BEFORE any merging — each
    // range's proportional (by character length) share of ITS OWN segment's
    // real window, laid out with a running cursor so a segment's ranges are
    // gap-free (see distributeAcrossSegments). Two ranges from DIFFERENT
    // segments never share a duration pool, so a macro spanning several
    // segments times each one against its own real audio window rather
    // than one invented macro-wide total.
    const rangeWindows=distributeAcrossSegments(ranges.map(r=>({segmentId:r.segmentId,weight:r.endChar-r.startChar})),segmentWindows);
    ranges.forEach((range,i)=>{range.realStart=rangeWindows[i].start;range.realEnd=rangeWindows[i].end;});
    // Avoid sub-second fragments from punctuation; merge adjacent short ideas,
    // retaining exact source character spans and never crossing segment identity.
    const merged=[];
    for (const range of ranges) {
      const previous=merged.at(-1);
      if (previous && previous.segmentId===range.segmentId && (range.realEnd-range.realStart<2.5 || previous.realEnd-previous.realStart<2.5)) {
        previous.endChar=range.endChar; previous.text=segmentMap.get(range.segmentId).text.slice(previous.startChar,range.endChar);
        previous.realEnd=range.realEnd;
      } else merged.push({...range});
    }
    ranges=merged;
    const sequenceId=`sequence_${macro.id}`, shotIds=[];
    const macroBeatsStartIndex=visualBeats.length;
    const sceneKey=macro.baseSetupKey??macro.locationId??macro.id;
    if(!sketchContexts.has(sceneKey)) sketchContexts.set(sceneKey,{key:sceneKey,environment:macro.informationToCommunicate});
    const characterCount=(plan.entityRegistry??[]).filter(e=>e.category==="CHARACTER"&&[...(macro.primaryEntityIds??[]),...(macro.supportingEntityIds??[])].includes(e.id)).length;
    for (let unitIndex=0;unitIndex<ranges.length;unitIndex++) {
      const range=ranges[unitIndex];
      const claim=contractClaims?matchClaimToRange(contractClaims,range.segmentId,range.text):null;
      const hasSiblings=macroHasSiblings.get(macro.id)===true;
      const focus=claim?focusFromClaim(claim,density,macro,hasSiblings):visualFocus(range.text,macro,density);
      const graphic=GRAPHICS.has(focus.type);
      const unitDuration=Math.max(range.realEnd-range.realStart,0.01);
      let cursor=range.realStart;
      const durationsRaw=splitDuration(unitDuration,focus.target,focus.type==="OBJECT_DETAIL"?7:graphic?12:10);
      // A range this short in real seconds can still be very short in WORDS
      // (a real Atlantis bug: a range split into as many shots as its
      // duration suggested, more than it had distinct words, gave
      // splitRangeForShots two shot boundaries landing on the same word —
      // a genuine zero-width narrationRange, then a zero-duration shot that
      // failed visualDensity's hard shot_duration floor). Never split a
      // range into more shots than it has words — merge the excess
      // duration buckets down (same total, fewer/wider shots) rather than
      // producing a shot with no real text at all.
      const wordCount=(range.text.match(/\S+/g)??[]).length || 1;
      // A shot count that leaves fewer than MIN_WORDS_PER_SHOT words per
      // shot on average is a semantic-fragment risk, not just a timing
      // preference — cap it below the old (crash-only) wordCount ceiling.
      const meaningfulShotCap=Math.max(1,Math.floor(wordCount/MIN_WORDS_PER_SHOT));
      const shotCountCeiling=Math.min(wordCount,meaningfulShotCap);
      const durations=durationsRaw.length<=shotCountCeiling?durationsRaw:mergeDurationsToCount(durationsRaw,shotCountCeiling);
      const shotRanges=splitRangeForShots(range,durations.length);
      for (let part=0;part<durations.length;part++) {
        const shotRange=shotRanges[part];
        const shotNarrationText=shotRange.text || range.text;
        const id=`${macro.id}_shot_${shotIds.length+1}`;
        const base=macro.baseSetupKey ?? `${macro.locationId ?? macro.id}_establishing`;
        const setupKey=graphic?null:base;
        const first=setupKey && !established.has(setupKey);
        const isDetail=focus.type==="OBJECT_DETAIL" || (part>0 && !graphic && part%2===1);
        const shotSize=isDetail?(durations[part]<=7?"DETAIL":"CLOSE"):focus.shot;
        const action=/\b(turn|swap|replace|walk|check|inspect|adjust|stamp|clear|isolate|vent|exercise|appear|disappear|change|darken|cool|warm|freeze|move|reach)\w*\b/i.test(shotNarrationText);
        const method=graphic?"PROGRAMMATIC_GRAPHIC":first?"GENERATE":isDetail?"CROP":action?"EDIT":"REUSE";
        const strategy=graphic?(focus.type==="DIAGRAM"?"DIAGRAM":focus.type==="MAP"?"MAP":focus.type==="COMPARISON"?"COMPARISON":"TEXT_INFOGRAPHIC"):first?"NEW_SETUP":isDetail?"DETAIL":"REUSE_WITH_DELTA";
        // A macro whose assigned narration didn't collapse into ONE
        // contiguous unit (short-fragment merging above only merges
        // ADJACENT sub-second ranges) can reach part===0 more than once —
        // once per surviving unit. Only the macro's true FIRST shot across
        // every unit should get the "establishing" focus text; a later
        // unit's own part 0 must not repeat it (the same class of
        // duplicate-visual bug focusFromClaim/buildShotIntent's sibling-
        // macro fix above closes, one level down).
        const isMacroFirstShot=unitIndex===0&&part===0;
        // A downstream pass sanitizes literal shot-index numbers out of the
        // compiled prompt (never leak "2/3" as if it were narrated content),
        // which otherwise collapsed every progressive-reveal step of the
        // SAME graphic down to the byte-identical phrase "the narrated
        // quantity/the narrated quantity" — a real duplicate at the image
        // level even though each step reveals genuinely different content.
        // A short snippet of THIS step's own narration keeps steps visually
        // distinct after that sanitization.
        const revealSnippet=shotNarrationText.split(/\s+/).slice(0,6).join(" ");
        const focusStep=isMacroFirstShot?focus.focus:graphic?`Progressively reveal the next part of this explanation (${part+1}/${durations.length}) — now showing: ${revealSnippet}`:isDetail?"Move attention to a closer detail within the same setup":"Return to the subject in context as this action continues";
        const motionSuggestion=graphic?"Progressive reveal of the elements named in the narration":isDetail?"Slow push into the relevant object within the established frame":action?"Show the narrated action progressing while the camera stays anchored":"Gentle pan across the established composition toward the narrated focus";
        const intent=buildShotIntent({plan,macro,claim,focus,focusStep,narrationText:shotNarrationText,part,totalParts:durations.length,shotSize,priorBeat:visualBeats.at(-1),preferMacroSubject:hasSiblings});
        const beat={...structuredClone(macro),...intent,id,sequenceId,sourceMacroBeatId:macro.id,sequenceIndex:visualBeats.length+1,
          narrationSegmentIds:[shotRange.segmentId],narrationRanges:[{segmentId:shotRange.segmentId,startChar:shotRange.startChar,endChar:shotRange.endChar}],
          shotNarrationText,
          // Part 10: lets the SceneRenderPlan compiler re-fetch this exact
          // claim (by id, from the project's current contract row) and
          // compile its MUST SHOW/MUST NOT SHOW facts into the image prompt
          // — never persisted as the full claim object here, keeping
          // VisualBeats exactly as light as before for beats with no claim.
          narrationClaimId:claim?claim.claimId:null,
          // Section 2/6/9/10 (2026-09-15 Visual Director rebuild): the raw
          // semantic signals assignRenderStrategies (below, run as a
          // second pass over all visualBeats) uses to decide render
          // method — undefined for any beat with no matching claim, which
          // keeps that beat on the exact pre-existing regex-only behavior.
          primarySubject:claim?claim.primarySubject:undefined,
          continuityRequirement:claim?claim.continuityRequirement:undefined,
          contractVisualForm:claim?claim.preferredVisualForms?.[0]:undefined,
          // Section 10 (2026-09-16 "production invariants" pass): a
          // legitimate same-composition before/after ("normal power ->
          // power failure") must survive the new sequence-diversity rule
          // below rather than being forced apart just because it looks
          // repetitive. Requires BOTH signals — a real comparisonClaims
          // entry (not just any COMPARISON claimType) AND HIGH continuity
          // (the contract's own signal that this really is "same setup, one
          // state changes") — a COMPARISON between two different LOCATIONS,
          // for instance, would not have HIGH continuity and correctly
          // stays subject to the normal diversity rule.
          intentionalVisualComparison:Boolean(claim?.comparisonClaims?.length&&claim.continuityRequirement==="HIGH"),
          comparisonDimension:claim?.comparisonClaims?.length&&claim.continuityRequirement==="HIGH"?claim.comparisonClaims[0].slice(0,60):undefined,
          // 2026-09-19 "fix EDIT abuse" (Section 4): a claim with a real
          // stateBefore/stateAfter pair (and they actually differ) reports a
          // genuinely visible state change worth an EDIT ("sleeping ->
          // sitting upright", "door closed -> door open"); a claim that
          // exists but reports no such distinction (both empty, or
          // identical) means the "change" the narration verb regex matched
          // is trivial — same pose/frame/lighting. undefined (no claim at
          // all) is the same backward-compatible no-op as every sibling
          // field above.
          hasContractStateChange:claim?Boolean(claim.stateBefore&&claim.stateAfter&&claim.stateBefore!==claim.stateAfter):undefined,
          // A real, explicit before/during/after progression (the contract's
          // own temporalClaims) is the ONLY thing allowed to justify a
          // second consecutive EDIT on the same setup (Section 4's "third
          // related state" exception) — never inferred from the verb regex.
          hasTemporalProgression:claim?Boolean(claim.temporalClaims?.length):undefined,
          estimatedStartSeconds:round(cursor),estimatedEndSeconds:round(cursor+durations[part]),
          informationToCommunicate:`${intent.shotPurpose}: ${intent.actionOrState}`,
          visualType:focus.type,shotSize,shotStrategy:strategy,renderMethod:method,baseSetupKey:setupKey,candidateBaseKey:base,
          deltaInstruction:strategy==="REUSE_WITH_DELTA"?intent.visualDelta:null,motionSuggestion,
          visualChange:{kind:graphic?"progressive_graphic":isDetail?"camera_crop":action?"subject_action":"camera_pan",step:part+1,totalSteps:durations.length},
          sketchContext:{...sketchContexts.get(sceneKey),characterCount},timingSource:"narration_estimate",requiresAudioReconciliation:true};
        cursor+=durations[part];
        visualBeats.push(beat);shotIds.push(id);
        if (first) {established.add(setupKey);productionAssets.set(setupKey,{setupKey,establishingShotId:id,locationId:macro.locationId,entityIds:[...(macro.primaryEntityIds??[]),...(macro.supportingEntityIds??[])]});}
      }
    }
    // Snap the macro's last shot to the REAL end of its last referenced
    // range (floating-point cleanup only — no longer to macro.estimatedEndSeconds,
    // which was exactly the invented value this whole fix stops trusting).
    visualBeats.at(-1).estimatedEndSeconds=round(ranges.at(-1).realEnd);
    const macroRealStart=visualBeats[macroBeatsStartIndex].estimatedStartSeconds;
    const macroRealEnd=visualBeats.at(-1).estimatedEndSeconds;
    visualSequences.push({...structuredClone(macro),id:sequenceId,sourceMacroBeatId:macro.id,purpose:macro.informationToCommunicate,shotIds,estimatedStartSeconds:macroRealStart,estimatedEndSeconds:macroRealEnd});
  }
  // NARRATION IS THE MASTER CLOCK for ORDER too, not just duration: the
  // Visual Director's own macro listing order doesn't guarantee its macros
  // cover narration chronologically (real incident: one macro of 14 covered
  // a segment that chronologically precedes its predecessor's, undetected
  // because the old cursor-chaining approach never referenced real segment
  // position at all). Every beat now carries its own correct real time
  // independent of array position, so sorting by it — never trusting the
  // macro's authored order for the FINAL timeline — is what actually
  // guarantees "first shot starts at ~0, no gaps, no overlaps."
  visualBeats.sort((a,b)=>a.estimatedStartSeconds-b.estimatedStartSeconds);
  visualBeats.forEach((b,i)=>{b.sequenceIndex=i+1;});
  if (contractClaims) assignSpanRequirements(visualBeats, contractClaims);
  // The freshness/novelty engine needs real chronological order to reason
  // about screen-time stretch and reuse cooldowns — it runs AFTER the
  // narration-driven sort above, replacing the placeholder renderMethod/
  // shotStrategy/baseSetupKey each beat was given while its timing was
  // still being built.
  if (contractClaims) plan.castLedger = bindEpisodeSemantics(visualBeats, plan.entityRegistry ?? [], contractClaims);
  assignRenderStrategies(visualBeats);
  // Section 7-10 of the 2026-09-16 "production invariants" pass: real Mars
  // incident — shots 28/29/30 used three DIFFERENT render strategies
  // (GENERATE/REUSE/EDIT) yet read as the exact same shot to a viewer
  // (same character, room, workstation, camera, pose). assignRenderStrategies'
  // own repetition-debt/consecutive-derivation counters (above) track HOW a
  // shot was produced, not whether three shots in a row actually LOOK
  // different — a viewer doesn't know or care that shot 30 was "only" an
  // EDIT rather than a REUSE. This runs as a genuinely separate pass, after
  // strategy assignment, specifically to catch that gap.
  enforceSequenceDiversity(visualBeats);
  if (contractClaims) {
    sequenceEpisode(visualBeats);
    plan.directorReliabilityVersion = DIRECTOR_RELIABILITY_VERSION;
  }
  // A final deterministic economic/quality guard: if two paid GENERATE
  // beats still express the same semantic job after the narration-driven
  // expansion, retain the later timeline beat but derive it from the first
  // via EDIT/CROP/REUSE. Camera-size wording alone never buys a new render.
  applyDuplicateRenderGate(visualBeats);
  // Rebuild productionAssets from the FINAL strategy assignment — the old
  // per-macro "first shot" bookkeeping above is no longer authoritative
  // once assignRenderStrategies can both promote a later shot to GENERATE
  // (a stretch/consecutive refresh) and give a macro's nominal first shot a
  // different final method than pass one guessed.
  productionAssets.clear();
  for (const beat of visualBeats) {
    if (beat.renderMethod!=="GENERATE"||!beat.baseSetupKey) continue;
    productionAssets.set(beat.baseSetupKey,{setupKey:beat.baseSetupKey,establishingShotId:beat.id,locationId:beat.locationId,entityIds:[...(beat.primaryEntityIds??[]),...(beat.supportingEntityIds??[])]});
  }
  plan.visualSequences=visualSequences;
  plan.visualBeats=visualBeats;
  // Payoffs now address the shot layer; original macro reasoning remains on sequences.
  const firstByMacro=new Map(visualSequences.map(s=>[s.sourceMacroBeatId,s.shotIds[0]]));
  plan.sequencePayoffs=structuredClone(source.visualPayoffs ?? []);
  plan.visualPayoffs=(source.visualPayoffs ?? []).map(p=>({...p,setupBeatId:firstByMacro.get(p.setupBeatId)??p.setupBeatId,payoffBeatId:p.payoffBeatId?(firstByMacro.get(p.payoffBeatId)??p.payoffBeatId):null}));
  plan.productionAssets=[...productionAssets.values()];
  plan.shotPlannerVersion=SHOT_PLANNER_VERSION;
  plan.timingSource="narration_estimate";
  plan.requiresAudioReconciliation=true;
  plan.densityDiagnostics=visualDensity(plan);
  return plan;
}
// The type/motionSuggestion-based max-duration rule mirrors visualDensity's
// own formula exactly (see below) — reused here so a shot this function
// stretches is checked against the SAME ceiling that would otherwise fail
// it downstream, and re-split locally rather than ever shipping an
// over-limit static shot.
function shotDurationLimit(beat) {
  const graphic = GRAPHICS.has(beat.visualType);
  if (beat.visualType === "OBJECT_DETAIL" || beat.shotSize === "DETAIL") return 7;
  return beat.motionSuggestion ? 15 : (graphic ? 10 : 10);
}
function shotDurationTarget(beat) {
  if (beat.visualType === "OBJECT_DETAIL" || beat.shotSize === "DETAIL") return 5.5;
  if (GRAPHICS.has(beat.visualType)) return 8.5;
  return 8;
}

// Retimes an ALREADY shot-planned visualBeats array (shotPlannerVersion
// already set — refineVisualSequences has run, whether just now or in an
// earlier pass that predates this fix) against the narration's real,
// current per-segment word-count timing. Exists separately from
// refineVisualSequences because that function decides shot BOUNDARIES from
// the real duration as it builds them; this one repairs a plan whose shot
// boundaries already exist (and whose relative pacing inside each narration
// range is still worth keeping — see the proportional-rescale comment
// below) but whose absolute timestamps drifted from the narration's real
// clock — e.g. a legacy plan generated before this fix, or (structurally)
// a script that was edited again after this plan was built. Always safe to
// run on an already-correct plan: rescaling real-to-real is a no-op.
export function retimeVisualBeats(source, script) {
  const plan = structuredClone(source);
  const segments = script.narrationSegments ?? [];
  const segmentWindows = buildSegmentWindows(segments);
  const beats = plan.visualBeats ?? [];

  // Group consecutive sibling shots that came from splitting ONE semantic
  // narration range together (same source macro beat + identical
  // narrationRanges[0]) — every shot split from that range shares the exact
  // same {segmentId,startChar,endChar} (see refineVisualSequences), so only
  // the GROUP's relative internal proportions (which already encode
  // splitDuration's intentional uneven pacing) are meaningful; each sibling
  // must never be independently re-windowed to the full range.
  const groups = [];
  let current = null;
  for (const beat of beats) {
    const r = beat.narrationRanges?.[0];
    const key = r ? `${beat.sourceMacroBeatId ?? ""}:${r.segmentId}:${r.startChar}:${r.endChar}` : Symbol();
    if (current && current.key === key) current.beats.push(beat);
    else { current = { key, range: r, beats: [beat] }; groups.push(current); }
  }

  // Real window for each GROUP (not each individual beat) — one running
  // cursor per segment across all its groups, same gap-free distribution as
  // refineVisualSequences uses for fresh plans (see distributeAcrossSegments
  // for why independent per-group character-position mapping isn't used:
  // trimmed whitespace between adjacent ranges would leave small dead-air
  // gaps at every group boundary).
  const groupWindows = distributeAcrossSegments(
    groups.map((g) => (g.range ? { segmentId: g.range.segmentId, weight: g.range.endChar - g.range.startChar } : { segmentId: "__none__", weight: 0 })),
    segmentWindows
  );

  const idRemap = new Map(); // old beat id -> [new beat id(s), in order] — for payoff/shotIds fixups
  const retimedBeats = [];
  groups.forEach((group, groupIndex) => {
    if (!group.range) { retimedBeats.push(...group.beats); return; }
    const realStart = groupWindows[groupIndex].start;
    const realDuration = Math.max(groupWindows[groupIndex].duration, 0.01);

    const oldDurations = group.beats.map((b) => Math.max(b.estimatedEndSeconds - b.estimatedStartSeconds, 0.001));
    const oldTotal = oldDurations.reduce((a, b) => a + b, 0);

    let cursor = realStart;
    group.beats.forEach((beat, i) => {
      const share = oldDurations[i] / oldTotal;
      const newDuration = share * realDuration;
      const limit = shotDurationLimit(beat);
      if (newDuration <= limit + 0.01) {
        idRemap.set(beat.id, [beat.id]);
        retimedBeats.push({ ...beat, estimatedStartSeconds: round(cursor), estimatedEndSeconds: round(cursor + newDuration) });
        cursor += newDuration;
      } else {
        // Retiming this shot alone would leave it static too long — split it
        // deterministically (no model call) using the same splitDuration
        // logic the initial shot planner itself uses for exactly this
        // decision, against this beat's own type-appropriate target/limit.
        const parts = splitDuration(newDuration, shotDurationTarget(beat), limit);
        const newIds = [];
        parts.forEach((partDuration, p) => {
          const newId = p === 0 ? beat.id : `${beat.id}_r${p + 1}`;
          newIds.push(newId);
          retimedBeats.push({ ...beat, id: newId, estimatedStartSeconds: round(cursor), estimatedEndSeconds: round(cursor + partDuration), sketchContext: beat.sketchContext });
          cursor += partDuration;
        });
        idRemap.set(beat.id, newIds);
      }
    });
    retimedBeats.at(-1).estimatedEndSeconds = round(groupWindows[groupIndex].end);
  });

  // Same "narration is the master clock for order too" correction as
  // refineVisualSequences — a legacy plan's groups are visited in the
  // original macro-authored order, which may not be chronological.
  retimedBeats.sort((a, b) => a.estimatedStartSeconds - b.estimatedStartSeconds);
  retimedBeats.forEach((b, i) => { b.sequenceIndex = i + 1; });
  plan.visualBeats = retimedBeats;

  // Sequences' shotIds/timestamps must reflect any ids a re-split introduced.
  for (const seq of plan.visualSequences ?? []) {
    seq.shotIds = (seq.shotIds ?? []).flatMap((id) => idRemap.get(id) ?? [id]);
    const seqBeats = retimedBeats.filter((b) => seq.shotIds.includes(b.id));
    if (seqBeats.length) {
      seq.estimatedStartSeconds = Math.min(...seqBeats.map((b) => b.estimatedStartSeconds));
      seq.estimatedEndSeconds = Math.max(...seqBeats.map((b) => b.estimatedEndSeconds));
    }
  }
  // Payoffs address the shot layer — a re-split payoff/setup beat is
  // remapped to its FIRST resulting sub-shot (same id in the p===0 case
  // above, so this is a no-op unless that exact beat needed splitting).
  const remapPayoffId = (id) => (id ? idRemap.get(id)?.[0] ?? id : id);
  plan.visualPayoffs = (plan.visualPayoffs ?? []).map((p) => ({ ...p, setupBeatId: remapPayoffId(p.setupBeatId), payoffBeatId: remapPayoffId(p.payoffBeatId) }));

  plan.timingSource = "narration_estimate";
  plan.requiresAudioReconciliation = true;
  plan.densityDiagnostics = visualDensity(plan);
  return plan;
}

export function visualDensity(plan) {
  const beats=plan.visualBeats ?? [];
  const durations=beats.map(b=>b.estimatedEndSeconds-b.estimatedStartSeconds);
  const totalDurationSeconds=round(durations.reduce((a,b)=>a+b,0));
  const errors=[];
  for(let i=0;i<beats.length;i++) {
    const b=beats[i], d=durations[i];
    const graphic=GRAPHICS.has(b.visualType);
    const limit=b.visualType==="OBJECT_DETAIL"||b.shotSize==="DETAIL"?7:graphic?(b.motionSuggestion?15:10):(b.motionSuggestion?15:10);
    if (d<=0 || d>limit+.01) errors.push({code:"shot_duration",beatId:b.id,duration:d,limit});
    if (i && Math.abs(b.estimatedStartSeconds-beats[i-1].estimatedEndSeconds)>.05) errors.push({code:"timing_gap_or_overlap",beatId:b.id});
    if (!(b.narrationSegmentIds?.length)) errors.push({code:"missing_narration",beatId:b.id});
  }
  const averageBeatDuration=round(totalDurationSeconds/Math.max(beats.length,1));
  if (!beats.length || averageBeatDuration>12) errors.push({code:"insufficient_visual_density"});
  const bins={under4:0,from4to8:0,from8to12:0,from12to15:0,over15:0};
  for (const duration of durations) bins[duration<4?"under4":duration<=8?"from4to8":duration<=12?"from8to12":duration<=15?"from12to15":"over15"]++;
  // 2026-09-19 "add the global sequencer" V1 fix: checkRollingWindowVariety's
  // findings are reported as `varietyWarnings`, deliberately kept OUT of
  // `errors`/`passed` — these are the brief's own softer "target"/"when
  // narration permits" rolling-window checks, never a hard planning-failure
  // gate the way shot_duration/missing_narration are. A plan can still
  // finalize with warnings here; they exist to be visible in a report, not
  // to block production the way the hard 3/4-window and graphic-cluster
  // mutations above already do.
  const varietyWarnings=checkRollingWindowVariety(beats);
  return {passed:errors.length===0,totalDurationSeconds,visualBeatCount:beats.length,sequenceCount:plan.visualSequences?.length??0,averageBeatDuration,maxBeatDuration:round(Math.max(0,...durations)),durationDistribution:bins,expectedBaseImages:beats.filter(b=>b.renderMethod==="GENERATE").length,expectedEdits:beats.filter(b=>b.renderMethod==="EDIT").length,expectedReuse:beats.filter(b=>b.renderMethod==="REUSE").length,expectedCrops:beats.filter(b=>b.renderMethod==="CROP").length,expectedProgrammaticGraphics:beats.filter(b=>b.renderMethod==="PROGRAMMATIC_GRAPHIC").length,errors,varietyWarnings};
}
