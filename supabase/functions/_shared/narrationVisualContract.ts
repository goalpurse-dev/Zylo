// deno-lint-ignore-file no-explicit-any
// Narration → Visual Contract (2026-09-15 semantic-grounding pass; extended
// 2026-09-15 for the "rebuild the Visual Director around narration meaning"
// pass — see that task's Section 3/4/5 for the schema this now implements).
//
// A cheap LLM compilation stage sitting BETWEEN a ready Script and the
// deterministic shot planner (visualShotPlanning.js). Its ONLY job is
// UNDERSTANDING MEANING — negation, comparison, cause/effect, sequence,
// entities and how critical each one's identity is, which visual FORM best
// teaches the idea. It never decides timing, render strategy, reuse/edit/
// generate, repetition/diversity, or reference selection — those stay the
// deterministic planner's job (the task's own "LLM understands meaning,
// deterministic planner decides, image model renders" separation).
//
// Batched by CHAPTER (the script's own existing macro-narrative grouping —
// chapterId/sequenceIndex are already on every narration segment) rather
// than one call per beat/sentence, keeping this "batch intelligently...
// cheap" per the task's explicit ask.
//
// EXTENSION NOTE: this is the SAME contract table/pipeline built for the
// prior "semantic-grounding" task, not a parallel second concept — no new
// VisualBeat-like artifact was created. New fields were added where they
// represent genuinely new reasoning (entity criticality, continuity
// requirement, visual-form ontology, polarity-explicit claims); existing
// fields were kept where they already cover a requested concept under a
// different but equivalent name (requiredVisualFacts/forbiddenVisualFacts
// already ARE mustShow/mustNotShow; visualCommunicationGoal already IS the
// "teaching goal"; confidence already IS "semanticConfidence") — renaming
// those would have broken every existing integration point for zero real
// gain. preferredVisualModes WAS renamed to preferredVisualForms with a
// much larger ontology, because Section 5 explicitly demands a real,
// general-purpose visual-form taxonomy, not a patch to the old 10-value one.

import { GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M } from "../../../src/lib/longFormPipelineConstants.ts";

export const NARRATION_CONTRACT_COMPILER_VERSION = "narration-visual-contract-v2";

// 2026-09-18 "production visual reliability v2" pass, Section 3 — extends
// (never duplicates) this existing taxonomy with the genuinely NEW
// narrative-function values a non-documentary story/scenario needs (a
// millionaire-overnight story has HOOK/ACTION/REACTION/DECISION/
// CONSEQUENCE/SOCIAL_INTERACTION/CALLBACK beats that plain FACT/CAUSE_EFFECT/
// TRANSITION never captured) — this IS the brief's own `narrativeFunction`
// concept; claimType already served that role for the documentary-shaped
// claims this system was first built against, so it is extended in place
// rather than adding a second, overlapping "narrativeFunction" field.
export const CLAIM_TYPES = [
  "FACT", "NEGATION", "COMPARISON", "CAUSE_EFFECT", "SEQUENCE", "CONTRAST",
  "QUANTITY", "TIMELINE", "DEFINITION", "HYPOTHETICAL", "PAYOFF", "TRANSITION",
  "HOOK", "SETUP", "ACTION", "REACTION", "MECHANISM", "DECISION", "CONSEQUENCE", "SOCIAL_INTERACTION", "CALLBACK", "EMPHASIS",
] as const;
export type ClaimType = typeof CLAIM_TYPES[number];

// Section 0/4/18: a genre-agnostic content-mode classifier — DISTINCT from
// planningMode (STORY/EXPLAINER/HYBRID, a per-claim rendering-approach
// signal that already existed). contentMode is the higher-level GENRE this
// beat belongs to, driving graphic-density TENDENCIES (Section 18) never
// hard quotas — a financial-business chapter leans on screens/charts/
// comparisons more than a pure scenario-narrative chapter does. Optional:
// a claim with no contentMode falls back to today's behavior unchanged.
export const CONTENT_MODES = [
  "SCENARIO_NARRATIVE", "EDUCATIONAL_EXPLAINER", "MECHANISM_EXPLAINER", "FINANCIAL_BUSINESS",
  "SOCIAL_PSYCHOLOGY", "HYPOTHETICAL", "DOCUMENTARY", "MIXED",
] as const;
export type ContentMode = typeof CONTENT_MODES[number];

// A real, general-purpose visual-form ontology (Section 5) — generalizes
// across history/science/engineering/economics/biology/geography/survival/
// technology, never hardcoded to Mars. Each name maps to an existing
// sceneType/renderMethod the pipeline already knows how to act on
// (VISUAL_FORM_TO_LEGACY_TYPE below) — new forms with no dedicated renderer
// yet (ANNOTATED_DIAGRAM, MAP, CHART, CONCEPTUAL_METAPHOR, NUMBER_EMPHASIS,
// SYMBOLIC_POSITIVE) fall back to the closest existing type until the
// separate graphic-template-engine work builds real renderers for them —
// the CONTRACT can and should name the need now regardless.
export const VISUAL_FORMS = [
  "CHARACTER_ACTION", "CHARACTER_REACTION", "CHARACTER_INTERACTION",
  "ENVIRONMENT_ESTABLISHING", "ENVIRONMENT_DETAIL",
  "OBJECT_HERO", "OBJECT_DETAIL",
  "PROCESS", "CUTAWAY",
  "DIAGRAM", "ANNOTATED_DIAGRAM",
  "COMPARISON", "BEFORE_AFTER", "CAUSE_EFFECT",
  "MAP", "TIMELINE", "CHART",
  "SYMBOLIC_POSITIVE", "SYMBOLIC_NEGATION",
  "TEXT_EMPHASIS", "NUMBER_EMPHASIS",
  "CONCEPTUAL_METAPHOR",
] as const;
export type VisualForm = typeof VISUAL_FORMS[number];

// Deterministic educational-graphic primitives (Section 12) a FULL_GRAPHIC
// beat may want composited — named metadata for the (separately built)
// graphic-template engine, never rendered by an image model. Optional/
// advisory: a beat with no graphic form simply has an empty array here.
export const GRAPHIC_PRIMITIVES = [
  "BIG_TEXT", "ICON", "X_MARK", "CHECK", "ARROW", "CALLOUT", "LABEL",
  "PROGRESS_BAR", "TIMELINE_BAR", "MAP_MARKER", "FLOW", "COMPARE_PANEL",
  "BEFORE_AFTER_PANEL", "NUMBER", "SIMPLE_CHART", "ANNOTATED_IMAGE", "OBJECT_ISOLATION",
] as const;
export type GraphicPrimitive = typeof GRAPHIC_PRIMITIVES[number];

export const CRITICALITY_LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH", "EXACT"] as const;
export type CriticalityLevel = typeof CRITICALITY_LEVELS[number];

export type EntityRequirement = { entity: string; criticality: CriticalityLevel };

export type NarrationClaim = {
  claimId: string; // assigned deterministically by this module, never trusted from the model
  narrationSegmentIds: string[];
  narrationText: string;
  claimType: ClaimType;
  primaryConcepts: string[];

  // Section 3/5: the single main subject this claim is ABOUT — the primary
  // signal the sequence diversity director uses to detect a real subject
  // change (a strong diversity trigger) versus a lighting/palette-only
  // difference (weak).
  primarySubject: string;

  // Entities (characters/objects/locations) this claim needs, each with its
  // own identity-criticality (Section 21: identity QA and, via the
  // Reference Resolver (Section 14), how many/which canonical references
  // this beat actually needs — never "send every reference, always").
  // Replaces requiredEntities/optionalEntities/importantObjects/
  // identityRequirements from the task's own illustrative schema — one
  // array with a criticality level (NONE = present but unimportant) is a
  // cleaner shape for the exact same concept.
  entityRequirements: EntityRequirement[];
  // Entities that must NOT appear at all (distinct from criticality — a
  // forbidden entity isn't "unimportant if present", it's disqualifying).
  forbiddenEntities: string[];

  requiredVisualFacts: string[]; // "mustShow"
  forbiddenVisualFacts: string[]; // "mustNotShow"
  negativeClaims: string[];
  positiveClaims: string[];
  comparisonClaims: string[];
  causeEffectClaims: string[];
  temporalClaims: string[];
  quantitativeClaims: string[];

  entitiesMentioned: string[];
  stateBefore: string;
  stateAfter: string;
  visualCommunicationGoal: string; // "teachingGoal" — what the viewer should understand
  planningMode: "STORY" | "EXPLAINER" | "HYBRID";
  // Section 0/4/18: optional — a project that predates this field (every
  // real contract compiled so far, including Mars's) simply omits it, and
  // every consumer must treat that exactly like today's behavior. Never
  // required, never guessed by a downstream consumer.
  contentMode?: ContentMode;
  preferredVisualForms: VisualForm[];
  graphicPrimitives: GraphicPrimitive[];

  // Section 6/9: how much this beat depends on looking like a continuation
  // of what's already established (same setup, same character position,
  // same state) versus being free to look completely different. NONE/LOW
  // beats are free to GENERATE fresh; HIGH beats are exactly what EDIT
  // exists for (Section 6: "SAME BASE COMPOSITION + LOCALIZED STATE
  // CHANGE"). This is the render-method policy's primary semantic input —
  // see visualShotPlanning.js's resolveRenderMethodFromContract.
  continuityRequirement: "NONE" | "LOW" | "MEDIUM" | "HIGH";

  textOverlayCandidate: { recommended: boolean; semanticText: string; importance: "LOW" | "MEDIUM" | "HIGH" };
  allowedAmbiguity: "LOW" | "MEDIUM" | "HIGH";
  emphasis: "LOW" | "MEDIUM" | "HIGH";
  confidence: number; // "semanticConfidence"
};

const ENTITY_REQUIREMENT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["entity", "criticality"],
  properties: {
    entity: { type: "string" },
    criticality: { type: "string", enum: CRITICALITY_LEVELS as unknown as string[], description: "EXACT: the viewer must recognize this exact individual (a named hero in close-up). HIGH: clearly this entity, minor variance tolerable. MEDIUM: recognizably this kind of thing. LOW: present but generic/background is fine. NONE: mentioned but not required to visually appear at all." },
  },
};

const CLAIM_SCHEMA = {
  type: "object", additionalProperties: false,
  required: [
    "narrationSegmentIds", "narrationText", "claimType", "primaryConcepts", "primarySubject",
    "entityRequirements", "forbiddenEntities",
    "requiredVisualFacts", "forbiddenVisualFacts", "negativeClaims", "positiveClaims",
    "comparisonClaims", "causeEffectClaims", "temporalClaims", "quantitativeClaims",
    "entitiesMentioned", "stateBefore", "stateAfter",
    "visualCommunicationGoal", "planningMode", "contentMode", "preferredVisualForms", "graphicPrimitives",
    "continuityRequirement", "textOverlayCandidate", "allowedAmbiguity", "emphasis", "confidence",
  ],
  properties: {
    narrationSegmentIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    narrationText: { type: "string", description: "The exact verbatim substring of the input narration this claim covers — never paraphrased." },
    claimType: { type: "string", enum: CLAIM_TYPES as unknown as string[] },
    primaryConcepts: { type: "array", items: { type: "string" }, maxItems: 6 },
    primarySubject: { type: "string", description: "The single main subject this claim is about (a character name, an object, 'the habitat', 'Mars itself'). Used to detect real subject changes between beats." },
    entityRequirements: { type: "array", items: ENTITY_REQUIREMENT_SCHEMA, maxItems: 6, description: "Every entity (character/object/location) this beat's visual genuinely involves, each with how strictly its identity must match its canonical reference." },
    forbiddenEntities: { type: "array", items: { type: "string" }, maxItems: 4, description: "Entities/concepts that must NOT appear at all (e.g. for a negation claim about an object's absence)." },
    requiredVisualFacts: { type: "array", items: { type: "string" }, maxItems: 6, description: "What must be VISIBLY true in the resulting image (mustShow). Empty array if nothing specific is required beyond the general scene." },
    forbiddenVisualFacts: { type: "array", items: { type: "string" }, maxItems: 6, description: "What must NOT visibly appear (mustNotShow). For a NEGATION claim this must never be empty — e.g. 'no phones' requires forbidding a functioning/working phone in the character's possession, never just noting the absence in words." },
    negativeClaims: { type: "array", items: { type: "string" }, maxItems: 4, description: "Plain-language statements of what the narration says did NOT exist/happen/is NOT the case. Non-empty for claimType NEGATION." },
    positiveClaims: { type: "array", items: { type: "string" }, maxItems: 4, description: "Plain-language statements of what the narration affirms IS the case/does exist/works — the polarity opposite of negativeClaims, used later so QA can catch an accidentally-reversed polarity (e.g. narration says something FAILS but the image shows it working)." },
    comparisonClaims: { type: "array", items: { type: "string" }, maxItems: 4, description: "Plain-language statements naming BOTH sides of a comparison/contrast (e.g. 'bears have thick fur; humans do not'). Non-empty for claimType COMPARISON or CONTRAST." },
    causeEffectClaims: { type: "array", items: { type: "string" }, maxItems: 4, description: "Plain-language cause->effect statements (e.g. 'colder temperatures cause higher calorie need'). Non-empty for claimType CAUSE_EFFECT." },
    temporalClaims: { type: "array", items: { type: "string" }, maxItems: 4, description: "Plain-language statements about sequence/timing/duration (e.g. 'this happens before breakfast', 'this took decades'). Non-empty for claimType SEQUENCE or TIMELINE." },
    quantitativeClaims: { type: "array", items: { type: "string" }, maxItems: 4, description: "Plain-language statements carrying a specific number/quantity/measurement worth showing (e.g. '-30 degrees', '39 minutes longer'). Non-empty for claimType QUANTITY." },
    entitiesMentioned: { type: "array", items: { type: "string" }, maxItems: 6, description: "Concrete nouns/entities actually named or clearly implied in narrationText — never invent one that isn't in the text." },
    stateBefore: { type: "string", description: "Short description of the state before this claim, if this is a state-change claim. Empty string if not applicable." },
    stateAfter: { type: "string", description: "Short description of the state after this claim, if this is a state-change claim. Empty string if not applicable." },
    visualCommunicationGoal: { type: "string", description: "One sentence: what should the VIEWER understand from this beat's visual (the teaching goal). Never empty." },
    planningMode: { type: "string", enum: ["STORY", "EXPLAINER", "HYBRID"], description: "STORY: a cinematic character/environment beat is the right call (e.g. a physical action). EXPLAINER: a symbolic/diagrammatic/text beat communicates this better than a literal scene (e.g. an absence, a statistic, a mechanism). HYBRID: a story beat with a light explanatory accent." },
    contentMode: { type: "string", enum: CONTENT_MODES as unknown as string[], description: "The genre this beat belongs to (SCENARIO_NARRATIVE, EDUCATIONAL_EXPLAINER, MECHANISM_EXPLAINER, FINANCIAL_BUSINESS, SOCIAL_PSYCHOLOGY, HYPOTHETICAL, DOCUMENTARY, MIXED) — drives graphic-density TENDENCIES downstream, never a hard quota. Pick whichever genre this specific beat reads as, even within a mixed-genre episode." },
    preferredVisualForms: { type: "array", items: { type: "string", enum: VISUAL_FORMS as unknown as string[] }, minItems: 1, maxItems: 3, description: "Concrete visual forms that would teach this claim well, most-preferred first — the actual visual-form ontology, not a style preference." },
    graphicPrimitives: { type: "array", items: { type: "string", enum: GRAPHIC_PRIMITIVES as unknown as string[] }, maxItems: 5, description: "Deterministic graphic elements this beat's visual would benefit from if rendered as a programmatic graphic (empty if this is a pure photographic/illustrated beat)." },
    continuityRequirement: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH"], description: "How much this beat needs to look like a continuation of the immediately preceding setup. HIGH = a genuine localized state-change on the SAME composition (e.g. a screen turning from green to red) — this is what EDIT is for. NONE/LOW = free to look completely different." },
    textOverlayCandidate: {
      type: "object", additionalProperties: false, required: ["recommended", "semanticText", "importance"],
      properties: {
        recommended: { type: "boolean", description: "Would a short on-screen word/phrase genuinely help THIS claim on its own merits (not 'would text density allow it' — that is decided later, separately)?" },
        semanticText: { type: "string", description: "<=5 words, e.g. 'NO SIGNAL', '-30°C', '24 HOURS'. Empty string if recommended is false." },
        importance: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], description: "How much the text itself (not just the visual) matters to understanding. Empty/LOW if recommended is false." },
      },
    },
    allowedAmbiguity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], description: "How much visual ambiguity/looseness QA should tolerate for this claim. LOW for a precise factual/negation claim; HIGH for an atmospheric or emotional beat with no single correct depiction." },
    emphasis: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], description: "How much this single claim matters to the episode's understanding — HIGH claims should not be quietly folded into a busier neighboring shot." },
    confidence: { type: "number", description: "0-1, this model's own confidence in this claim's classification (semantic confidence)." },
  },
};

const RESPONSE_SCHEMA = { type: "object", additionalProperties: false, required: ["claims"], properties: { claims: { type: "array", items: CLAIM_SCHEMA } } };

// The instructions are the real load-bearing artifact here — every rule in
// the task spec (negation/polarity-first-class, comparisons must show both
// sides, preserve causality, story-vs-explainer routing, text density is
// presentation-frequency-only, entity criticality drives reference need not
// vice versa) is encoded as an explicit instruction, not left to the
// model's own judgment of "seems reasonable."
export const NARRATION_CONTRACT_INSTRUCTIONS = `You are a semantic analyst preparing narration for a visual director. You do NOT design shots, choose cameras, or decide render strategy — you extract what each piece of narration actually MEANS and what it visually requires, so a separate deterministic system can decide the visuals, repetition budget and rendering.

For the supplied narration segments (in order), break the text into semantic CLAIMS — one claim per distinct idea. A claim can span part of one segment, a whole segment, or (rarely) bridge two adjacent segments when they express one continuous idea (e.g. a comparison split across two sentences). Do not create a claim for every clause — merge tightly-related clauses into one claim when they serve one visual idea, split them when they don't.

CRITICAL — LOGICAL POLARITY MUST BE FIRST-CLASS:
When narration says something did NOT exist, was NOT available, NOT possible, or otherwise negates a state ("no phones", "no internet", "couldn't call for help", "didn't have thick fur", "without electricity, the machine stops"), classify it NEGATION and ALWAYS populate forbiddenVisualFacts with the specific thing that must NOT visibly appear working/present/possessed/succeeding. "No phone service" must forbid a phone shown successfully connecting/working — never just note the absence in prose and let a generic scene through; a negation is not satisfied by omission alone. Conversely, when narration affirms something DOES work/exist/happen, populate positiveClaims — this lets a later check catch an accidentally-reversed polarity (image shows the opposite of what the words say). Common polarity pairs to watch for: available/unavailable, on/off, safe/unsafe, before/after, increase/decrease, present/absent, works/fails.

COMPARISON / CONTRAST:
When narration compares two things (explicitly with "unlike/versus/compared to" or implicitly by juxtaposing two states), classify COMPARISON or CONTRAST and populate comparisonClaims naming BOTH sides plainly. The visual should show the relationship (e.g. a split composition), not two independent, disconnected images.

CAUSE AND EFFECT:
When narration describes one thing causing another ("as X fell, Y rose", "X meant Y"), classify CAUSE_EFFECT and populate causeEffectClaims with the cause and the effect, preserving the causal direction.

SEQUENCE / TIMELINE / QUANTITY:
When narration describes an order of events, a duration, or "for most of history" type framing, classify SEQUENCE or TIMELINE and populate temporalClaims. When narration carries a specific number/measurement worth seeing, classify QUANTITY and populate quantitativeClaims.

CONTENT MODE (genre, not topic):
This system generates far more than history/science documentaries — scenario stories ("what if you woke up as a millionaire"), financial/business explainers, social/psychology narratives, and mechanism explainers all use the exact same claim structure. Classify contentMode per beat from what the narration is actually doing here, not the video's overall theme: a recurring-character scene ("she reaches for her phone") is SCENARIO_NARRATIVE even inside an otherwise EDUCATIONAL_EXPLAINER video; a chart/number beat inside a survival story is FINANCIAL_BUSINESS or MECHANISM_EXPLAINER depending on what it explains. Use MIXED only when a single beat genuinely straddles two genres equally.

ENTITIES AND IDENTITY CRITICALITY:
List every entity (character/object/location) this beat's visual genuinely involves in entityRequirements, each with a criticality: EXACT (the viewer must recognize this specific individual — a named hero in close-up), HIGH (clearly this entity, minor variance tolerable), MEDIUM (recognizably this kind of thing), LOW (present but generic/background is fine), or NONE (mentioned in the narration but not required to visually appear). Be honest and minimal — do not mark something EXACT or HIGH just because it's mentioned; a location glimpsed in the background of a close-up is usually LOW, not HIGH. This directly controls how many canonical reference images a beat actually needs — inflating criticality has a real cost.

CONTINUITY REQUIREMENT:
Judge continuityRequirement on whether THIS claim is a genuine continuation of an already-established setup with a LOCALIZED state change (HIGH — e.g. "the screen turns red", "the door closes") versus something that can and should look like a fresh composition (NONE/LOW — a new subject, a new action, a new location, a new teaching point). Do not default to HIGH; most narration beats introduce something new enough to warrant LOW or NONE. Reserve HIGH for narration that is EXPLICITLY about a state changing on the same thing (before/after of the identical setup).

VISUAL FORM:
Choose preferredVisualForms from the given ontology based on what would TEACH this idea most clearly — a physical human action is usually CHARACTER_ACTION/CHARACTER_REACTION/CHARACTER_INTERACTION; an absence or symbolic fact is often SYMBOLIC_NEGATION/SYMBOLIC_POSITIVE or a DIAGRAM; a comparison is COMPARISON/BEFORE_AFTER; a causal chain is CAUSE_EFFECT; a stat is NUMBER_EMPHASIS or CHART; a duration/history-spanning claim is TIMELINE. Do not overcorrect into diagrams for everything — genuine physical human action stays CHARACTER_ACTION/CHARACTER_REACTION.

TEXT/GRAPHIC CANDIDATES:
Judge textOverlayCandidate.recommended purely on whether a short phrase would genuinely clarify THIS claim on its own merits — never based on how "text-heavy" the video should feel; that is a separate, later decision. Keep semanticText genuinely short (<=5 words). List graphicPrimitives only when this beat's best visual form is itself a programmatic graphic.

Never invent an entity, object, or fact not present in or directly implied by the narration text you were given. narrationText must be an exact verbatim excerpt, not a paraphrase.`;

export function buildContractPrompt(segments: { id: string; text: string }[]) {
  return JSON.stringify({ segments: segments.map((s) => ({ id: s.id, text: s.text })) });
}

// ============================ Deterministic validation ============================
export type ClaimValidationContext = { validSegmentIds: Set<string>; seenClaimIds: Set<string> };

export function validateClaim(claim: NarrationClaim, ctx: ClaimValidationContext): string[] {
  const errors: string[] = [];
  if (ctx.seenClaimIds.has(claim.claimId)) errors.push(`DUPLICATE_CLAIM_ID: ${claim.claimId}`);
  if (!claim.narrationSegmentIds.length || claim.narrationSegmentIds.some((id) => !ctx.validSegmentIds.has(id))) {
    errors.push(`UNKNOWN_NARRATION_SEGMENT_ID: ${claim.claimId}`);
  }
  if (!claim.visualCommunicationGoal || !claim.visualCommunicationGoal.trim()) errors.push(`EMPTY_COMMUNICATION_GOAL: ${claim.claimId}`);
  if (claim.claimType === "NEGATION" && claim.forbiddenVisualFacts.length === 0 && claim.negativeClaims.length === 0) {
    errors.push(`NEGATION_MISSING_FORBIDDEN_FACTS: ${claim.claimId}`);
  }
  if ((claim.claimType === "COMPARISON" || claim.claimType === "CONTRAST") && claim.comparisonClaims.length === 0) {
    errors.push(`COMPARISON_MISSING_BOTH_SIDES: ${claim.claimId}`);
  }
  if (claim.claimType === "CAUSE_EFFECT" && claim.causeEffectClaims.length === 0) {
    errors.push(`CAUSE_EFFECT_MISSING_CLAIM: ${claim.claimId}`);
  }
  // A forbidden entity that is ALSO listed as a required entity is a
  // self-contradiction the model must never produce.
  const forbiddenLower = new Set(claim.forbiddenEntities.map((e) => e.toLowerCase()));
  if (claim.entityRequirements.some((r) => forbiddenLower.has(r.entity.toLowerCase()))) {
    errors.push(`ENTITY_BOTH_REQUIRED_AND_FORBIDDEN: ${claim.claimId}`);
  }
  // Cheap hallucination guard: every mentioned entity should actually surface
  // somewhere in the claim's own quoted narrationText — a mention that
  // appears nowhere in the text it was extracted from is fabricated, not
  // "implied." Case-insensitive, tolerant of simple pluralization.
  const haystack = claim.narrationText.toLowerCase();
  for (const entity of claim.entitiesMentioned) {
    const needle = entity.toLowerCase().replace(/s$/, "");
    if (needle && !haystack.includes(needle) && !haystack.includes(`${needle}s`)) errors.push(`UNVERIFIABLE_ENTITY(${entity}): ${claim.claimId}`);
  }
  return errors;
}

// ============================ Compilation ============================
// Phase 0, Section C.3 — this WAS the file whose own comment admitted "one
// source of truth for this model's $/token would be nicer" — that source of
// truth now exists (src/lib/longFormPipelineConstants.ts), imported below.
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (typeof content?.text === "string") return content.text;
  return "";
}

export type ContractCompileStats = { llmCalls: number; repairCalls: number; inputTokens: number; outputTokens: number; estimatedModelCostUsd: number; latencyMs: number; batches: number; droppedClaims: number };

async function callResponses(openaiKey: string, segments: { id: string; text: string }[]): Promise<{ claims: any[]; inputTokens: number; outputTokens: number }> {
  const res = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL, reasoning: { effort: "low" }, max_output_tokens: 12000, store: false,
      instructions: NARRATION_CONTRACT_INSTRUCTIONS,
      input: buildContractPrompt(segments),
      text: { format: { type: "json_schema", name: "narration_visual_contract", strict: true, schema: RESPONSE_SCHEMA } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`NARRATION_CONTRACT_CALL_FAILED: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const payload = await res.json();
  const parsed = JSON.parse(extractOutputText(payload).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  return { claims: parsed.claims ?? [], inputTokens: payload.usage?.input_tokens ?? 0, outputTokens: payload.usage?.output_tokens ?? 0 };
}

// Groups CONSECUTIVE segments (already in sequenceIndex order) into batches
// bounded by character count — chapter boundaries are respected (never
// merged across chapters, since a chapter is the script's own real
// narrative-macro unit) but a very long chapter still splits into more than
// one call rather than risking one oversized, unreliable completion.
const MAX_BATCH_CHARS = 2200;
export function batchSegmentsByChapter(segments: { id: string; chapterId: string; sequenceIndex: number; text: string }[]): { id: string; text: string }[][] {
  const sorted = [...segments].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const batches: { id: string; text: string }[][] = [];
  let current: { id: string; text: string }[] = [];
  let currentChapter: string | null = null;
  let currentChars = 0;
  for (const seg of sorted) {
    const startsNewChapter = currentChapter !== null && seg.chapterId !== currentChapter;
    const overBudget = currentChars + seg.text.length > MAX_BATCH_CHARS;
    if (current.length && (startsNewChapter || overBudget)) { batches.push(current); current = []; currentChars = 0; }
    current.push({ id: seg.id, text: seg.text });
    currentChars += seg.text.length;
    currentChapter = seg.chapterId;
  }
  if (current.length) batches.push(current);
  return batches;
}

export type ContractBatchResult = {
  claims: NarrationClaim[];
  llmCalls: number;
  repairCalls: number;
  inputTokens: number;
  outputTokens: number;
  droppedClaims: number;
};

// 2026-09-20 durable-contract-compilation fix, extracted unchanged from
// compileNarrationVisualContract's own per-batch loop body — this is now the
// SINGLE unit of billable, checkpointable work (one chapter batch: one call,
// one optional bounded repair call), called once per invocation by
// advance-long-form-visual-plan's own resumable ensureNarrationContract so a
// worker that dies mid-compile only ever loses the ONE in-flight batch, never
// every batch already persisted. compileNarrationVisualContract below still
// exists as the plain synchronous all-batches-in-one-call convenience for
// callers that don't need resumability (analyze-long-form-narration-contract).
export async function compileContractBatch(
  batch: { id: string; text: string }[],
  openaiKey: string,
  validSegmentIds: Set<string>
): Promise<ContractBatchResult> {
  let result = await callResponses(openaiKey, batch);
  let llmCalls = 1;
  let repairCalls = 0;
  let inputTokens = result.inputTokens;
  let outputTokens = result.outputTokens;

  let assigned = assignClaimIds(result.claims, batch);
  let errorsByIndex = assigned.map((c) => validateClaim(c, { validSegmentIds, seenClaimIds: new Set() }));
  const anyInvalid = errorsByIndex.some((e) => e.length > 0);

  if (anyInvalid) {
    // ONE bounded repair call — never a critic loop. Tell the model
    // exactly what was wrong; if it still can't fix a claim, that one
    // claim is dropped rather than failing the whole batch or retrying
    // indefinitely.
    const errorSummary = assigned.map((c, i) => (errorsByIndex[i].length ? `${c.narrationText.slice(0, 80)} -> ${errorsByIndex[i].join(", ")}` : null)).filter(Boolean).join("\n");
    try {
      const repaired = await callResponses(openaiKey, [...batch, { id: "__repair_notes__", text: `Fix these problems from your previous answer and resubmit ALL claims for this same input:\n${errorSummary}` }]);
      llmCalls++; repairCalls++; inputTokens += repaired.inputTokens; outputTokens += repaired.outputTokens;
      assigned = assignClaimIds(repaired.claims, batch);
      errorsByIndex = assigned.map((c) => validateClaim(c, { validSegmentIds, seenClaimIds: new Set() }));
    } catch {
      // Repair call itself failed (network/timeout) — fall through and
      // drop whatever is still invalid from the ORIGINAL response below.
    }
  }

  const claims: NarrationClaim[] = [];
  let droppedClaims = 0;
  const seenInBatch = new Set<string>();
  for (let i = 0; i < assigned.length; i++) {
    const claim = assigned[i];
    const errors = validateClaim(claim, { validSegmentIds, seenClaimIds: seenInBatch });
    if (errors.length) { droppedClaims++; console.error("[narrationVisualContract] dropping invalid claim after repair:", claim.claimId, errors); continue; }
    seenInBatch.add(claim.claimId);
    claims.push(claim);
  }
  return { claims, llmCalls, repairCalls, inputTokens, outputTokens, droppedClaims };
}

export async function compileNarrationVisualContract(args: {
  segments: { id: string; chapterId: string; sequenceIndex: number; text: string }[];
  openaiKey: string;
}): Promise<{ claims: NarrationClaim[]; stats: ContractCompileStats }> {
  const startedAt = Date.now();
  const validSegmentIds = new Set(args.segments.map((s) => s.id));
  const batches = batchSegmentsByChapter(args.segments);
  const claims: NarrationClaim[] = [];
  const stats: ContractCompileStats = { llmCalls: 0, repairCalls: 0, inputTokens: 0, outputTokens: 0, estimatedModelCostUsd: 0, latencyMs: 0, batches: batches.length, droppedClaims: 0 };
  const seenClaimIds = new Set<string>();

  for (const batch of batches) {
    const batchResult = await compileContractBatch(batch, args.openaiKey, validSegmentIds);
    stats.llmCalls += batchResult.llmCalls;
    stats.repairCalls += batchResult.repairCalls;
    stats.inputTokens += batchResult.inputTokens;
    stats.outputTokens += batchResult.outputTokens;
    for (const claim of batchResult.claims) {
      if (seenClaimIds.has(claim.claimId)) { stats.droppedClaims++; continue; }
      seenClaimIds.add(claim.claimId);
      claims.push(claim);
    }
    stats.droppedClaims += batchResult.droppedClaims;
  }

  stats.estimatedModelCostUsd = Number(((stats.inputTokens * GPT5_MINI_INPUT_PER_M + stats.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4));
  stats.latencyMs = Date.now() - startedAt;
  const coveredSegments = new Set(claims.flatMap(c => c.narrationSegmentIds));
  if (stats.droppedClaims || args.segments.some(s => !coveredSegments.has(s.id))) {
    throw new Error("NARRATION_CONTRACT_INCOMPLETE: repair semantic claims before planning");
  }
  return { claims, stats };
}

// Deterministic — never trust an LLM-supplied id for uniqueness ("duplicate
// claim IDs rejected"). Assigned from this batch's own first segment + an
// in-batch index, so two batches can never collide either (different
// segments -> different prefix).
function assignClaimIds(rawClaims: any[], batch: { id: string }[]): NarrationClaim[] {
  const prefix = batch[0]?.id ?? "unknown";
  return rawClaims.map((c, i) => ({ ...c, claimId: `${prefix}__c${i + 1}` }));
}

// ============================ Shot-planner integration ============================
// Matches a semantic range (a sub-segment slice visualFocus already
// computed via semanticRanges) to the claim that actually covers it: same
// segment, and the range's text is substantially contained within the
// claim's own quoted narrationText. Falls back to null (caller keeps its
// existing regex-based classification) rather than guessing — a contract is
// additive/authoritative when it covers a range, never a forced override
// when it doesn't.
// 2026-09-20 "fix claim coverage" pass — real Mars finding: the strict
// substring-containment check below (hay.includes(needle) / needle.includes
// (hay)) requires the shot planner's own semanticRanges() slice to align
// CHARACTER-FOR-CHARACTER with the contract compiler's own quoted
// narrationText for a claim — the two were chunked independently (the
// contract compiler groups by semantic claim boundaries; the shot planner
// splits by punctuation/clause regex), so even a trivial whitespace,
// punctuation, or partial-sentence difference (a range spanning only part
// of a claim's quoted span, or a claim quoting slightly more/less than one
// range) silently returned zero match — this is exactly what produced most
// of the real "33 uncovered narration beats" incident. Fix: score every
// candidate claim by real WORD overlap (order-insensitive, tokenized) and
// accept the best-scoring one once it clears a real (not zero) overlap
// threshold — a genuine ~40%+ shared-word ratio in either direction is
// strong evidence the range is part of what this claim describes, without
// requiring exact substring alignment. Never invents a match with no real
// textual relationship: a candidate with essentially no shared words still
// scores 0 and is never returned. Multiple beats legitimately sharing one
// claim (a claim's span covering several narrower shot-planner ranges) is
// an intended outcome, not a bug — matchClaimToRange has never enforced
// one-claim-per-beat uniqueness.
const WORD_SPLIT = /[^a-z0-9]+/;
function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(WORD_SPLIT).filter((w) => w.length > 1));
}
function wordOverlapRatio(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  // Ratio relative to the SMALLER set — a short range fully contained in a
  // much longer claim (or vice versa) should still score near 1.0, not be
  // penalized for the size mismatch itself.
  return shared / Math.min(a.size, b.size);
}
const CLAIM_MATCH_MIN_OVERLAP = 0.4;
export function matchClaimToRange(claims: NarrationClaim[], segmentId: string, rangeText: string): NarrationClaim | null {
  const candidates = claims.filter((c) => c.narrationSegmentIds.includes(segmentId));
  if (!candidates.length) return null;
  const needle = rangeText.trim().toLowerCase();
  if (!needle) return null;
  const needleWords = tokenize(needle);
  let best: NarrationClaim | null = null;
  let bestScore = 0;
  for (const claim of candidates) {
    const hay = claim.narrationText.toLowerCase();
    // Exact substring containment (the original, still-fastest signal) is
    // scored as a perfect match — kept first so the common case (claim and
    // range boundaries genuinely do align) is unaffected by tokenization.
    let score = 0;
    if (hay.includes(needle) || needle.includes(hay)) score = 1;
    else score = wordOverlapRatio(needleWords, tokenize(hay));
    if (score > bestScore) { bestScore = score; best = claim; }
  }
  return bestScore >= CLAIM_MATCH_MIN_OVERLAP ? best : null;
}

// Maps a claim's planningMode/preferredVisualForms to one of the EXISTING
// sceneType/visualType vocabulary the shot planner and render-plan compiler
// already know how to act on today — this is the lookup that replaces
// regex guessing, not a new rendering feature. Forward-compatible names
// with no dedicated renderer yet fall back to the closest EXISTING type
// until the separate graphic-template-engine work lands.
const VISUAL_FORM_TO_LEGACY_TYPE: Record<VisualForm, string> = {
  CHARACTER_ACTION: "STORY_ILLUSTRATION", CHARACTER_REACTION: "STORY_ILLUSTRATION", CHARACTER_INTERACTION: "STORY_ILLUSTRATION",
  ENVIRONMENT_ESTABLISHING: "ENVIRONMENT", ENVIRONMENT_DETAIL: "ENVIRONMENT",
  OBJECT_HERO: "OBJECT_DETAIL", OBJECT_DETAIL: "OBJECT_DETAIL",
  PROCESS: "DIAGRAM", CUTAWAY: "OBJECT_DETAIL",
  DIAGRAM: "DIAGRAM", ANNOTATED_DIAGRAM: "DIAGRAM",
  COMPARISON: "COMPARISON", BEFORE_AFTER: "COMPARISON", CAUSE_EFFECT: "DIAGRAM",
  MAP: "PROGRAMMATIC_GRAPHIC", TIMELINE: "TIMELINE", CHART: "PROGRAMMATIC_GRAPHIC",
  SYMBOLIC_POSITIVE: "PROGRAMMATIC_GRAPHIC", SYMBOLIC_NEGATION: "PROGRAMMATIC_GRAPHIC",
  TEXT_EMPHASIS: "PROGRAMMATIC_GRAPHIC", NUMBER_EMPHASIS: "PROGRAMMATIC_GRAPHIC",
  CONCEPTUAL_METAPHOR: "STORY_ILLUSTRATION",
};
export function legacyVisualTypeForClaim(claim: NarrationClaim): string {
  return VISUAL_FORM_TO_LEGACY_TYPE[claim.preferredVisualForms[0]] ?? "STORY_ILLUSTRATION";
}

// Visual forms where the explainer/graphic treatment IS the semantic point
// of the claim — Section 13's own carve-out ("all three [density levels]
// must communicate the same semantic claim... a concept like 'no fur' may
// naturally become a labeled comparison even under MINIMAL") names exactly
// these categories. Never downgraded by density.
const DENSITY_ESSENTIAL_FORMS = new Set<VisualForm>([
  "SYMBOLIC_NEGATION", "SYMBOLIC_POSITIVE", "COMPARISON", "BEFORE_AFTER", "CAUSE_EFFECT", "DIAGRAM", "ANNOTATED_DIAGRAM",
]);
const TEXT_FORWARD_FORMS = new Set<VisualForm>(["TEXT_EMPHASIS", "NUMBER_EMPHASIS"]);

// Density-aware resolution (Section 13): text density changes PRESENTATION
// FREQUENCY only — applied HERE, after the claim's own meaning has already
// been extracted independent of density. A STORY-mode claim is never
// touched by density (story context wins). A claim whose preferred form is
// semantically essential (see above) keeps its treatment regardless of
// density. Everything else is gated: MINIMAL folds non-essential explainer
// beats back to plain illustration, and a purely text-forward form
// (TEXT_EMPHASIS/NUMBER_EMPHASIS) is only offered at balanced/frequent.
export function resolveClaimVisualType(claim: NarrationClaim, density: "minimal" | "balanced" | "frequent" = "balanced"): string {
  if (claim.planningMode === "STORY") return "STORY_ILLUSTRATION";
  const essential = claim.preferredVisualForms.some((f) => DENSITY_ESSENTIAL_FORMS.has(f));
  if (!essential && density === "minimal") return "STORY_ILLUSTRATION";
  let forms = claim.preferredVisualForms;
  if (density === "minimal") forms = forms.filter((f) => !TEXT_FORWARD_FORMS.has(f));
  const chosen = forms[0] ?? claim.preferredVisualForms[0];
  return VISUAL_FORM_TO_LEGACY_TYPE[chosen] ?? "STORY_ILLUSTRATION";
}

// ============================ Renderer prompt integration ============================
// Compiles a claim down to a SHORT block for the image prompt — never the
// raw JSON. Only emitted when there is something genuinely load-bearing to
// say (a real negation/requirement) — a plain FACT claim with nothing
// forbidden adds nothing here, keeping ordinary prompts exactly as compact
// as they were before this system existed.
export function compileClaimRendererNotes(claim: NarrationClaim | null): string | null {
  if (!claim) return null;
  const lines: string[] = [];
  if (claim.requiredVisualFacts.length) lines.push(`MUST SHOW: ${claim.requiredVisualFacts.join("; ")}`);
  if (claim.forbiddenVisualFacts.length) lines.push(`MUST NOT SHOW: ${claim.forbiddenVisualFacts.join("; ")}`);
  if (claim.forbiddenEntities.length) lines.push(`FORBIDDEN: ${claim.forbiddenEntities.join("; ")}`);
  if (claim.comparisonClaims.length) lines.push(`COMPARISON: ${claim.comparisonClaims.join("; ")}`);
  if (claim.causeEffectClaims.length) lines.push(`CAUSE/EFFECT: ${claim.causeEffectClaims.join("; ")}`);
  if (!lines.length) return null;
  lines.push(`COMMUNICATION GOAL: ${claim.visualCommunicationGoal}`);
  return lines.join("\n");
}
