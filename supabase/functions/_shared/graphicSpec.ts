// deno-lint-ignore-file no-explicit-any
// graphicSpec.ts — 2026-09-17 "long-form quality pass" (external review),
// Parts 1/3/4.
//
// PART 1: separates VISUAL FORM (what the viewer needs to understand) from
// RENDER STRATEGY (how Zyvo obtains the pixels) explicitly and durably. The
// existing 22-value VisualForm ontology (narrationVisualContract.ts) stays
// exactly as-is (it is more granular, and rewriting it would break every
// already-compiled beat/plan that references it) — this adds a SMALLER,
// compact "family" grouping on top, the one the task's own review names
// verbatim, with a documented one-directional mapping. GRAPHIC is
// deliberately never a member of either list — it is a render strategy
// (PROGRAMMATIC_GRAPHIC), asserted nowhere here as a visual form.
//
// PART 3: structured graphic specs. A graphic renderer must consume
// EXPLICIT factual fields (a value, a unit, an icon name, a polarity) that
// were decided once, deterministically, at compile time — never raw
// narration text handed to the renderer to reformat, and never a value the
// renderer itself invents. Every compiler function below only ever COPIES
// fields already present on the NarrationClaim; it never fabricates a
// number, date, label or causal link that wasn't already there.
import type { NarrationClaim, VisualForm } from "./narrationVisualContract.ts";
import type { IconName } from "./sceneCompositor.ts";

/* ============================ Part 1: VisualForm family ============================ */
export const VISUAL_FORM_FAMILIES = [
  "SITUATION_ACTION", "OBJECT_DETAIL", "SYMBOL_NEGATION", "QUANTITY_RESOURCE",
  "COMPARISON_CHANGE", "ANNOTATED_MECHANISM", "CAUSE_PROCESS", "SPACE_TIME", "EMPHASIS",
] as const;
export type VisualFormFamily = typeof VISUAL_FORM_FAMILIES[number];

// One-directional, documented mapping from the granular 22-value ontology
// down to the compact 9-family taxonomy the review names. SYMBOLIC_POSITIVE
// shares SYMBOL_NEGATION's family on purpose — a checkmark/affirmation icon
// is the exact same "symbol + polarity" shape as a negation, just the
// opposite polarity (the graphic SPEC's own `polarity` field, not the
// family, is what actually distinguishes them at render time).
const VISUAL_FORM_TO_FAMILY: Record<VisualForm, VisualFormFamily> = {
  CHARACTER_ACTION: "SITUATION_ACTION", CHARACTER_REACTION: "SITUATION_ACTION", CHARACTER_INTERACTION: "SITUATION_ACTION",
  ENVIRONMENT_ESTABLISHING: "SITUATION_ACTION", ENVIRONMENT_DETAIL: "SITUATION_ACTION",
  OBJECT_HERO: "OBJECT_DETAIL", OBJECT_DETAIL: "OBJECT_DETAIL", CUTAWAY: "ANNOTATED_MECHANISM",
  PROCESS: "CAUSE_PROCESS", CAUSE_EFFECT: "CAUSE_PROCESS",
  DIAGRAM: "ANNOTATED_MECHANISM", ANNOTATED_DIAGRAM: "ANNOTATED_MECHANISM",
  COMPARISON: "COMPARISON_CHANGE", BEFORE_AFTER: "COMPARISON_CHANGE",
  MAP: "SPACE_TIME", TIMELINE: "SPACE_TIME", CHART: "QUANTITY_RESOURCE",
  SYMBOLIC_POSITIVE: "SYMBOL_NEGATION", SYMBOLIC_NEGATION: "SYMBOL_NEGATION",
  TEXT_EMPHASIS: "EMPHASIS", NUMBER_EMPHASIS: "QUANTITY_RESOURCE",
  CONCEPTUAL_METAPHOR: "EMPHASIS",
};
export function visualFormFamilyOf(form: VisualForm | undefined | null): VisualFormFamily {
  return (form && VISUAL_FORM_TO_FAMILY[form]) || "SITUATION_ACTION";
}
// The family this claim's PREFERRED visual form maps to — the one field a
// caller should use to decide "does this beat want a graphic-shaped
// treatment", never `renderMethod`/`renderStrategy`, which is a completely
// separate decision (Part 1's whole point: SITUATION_ACTION can be EDIT or
// GENERATE; OBJECT_DETAIL can be CROP, EDIT or GENERATE, depending on
// whether the detail already exists in the source at usable resolution —
// see canSatisfyCrop's `sourceEstablishesDetail` parameter in
// sceneRenderPlan.ts).
export function primaryVisualFormFamily(claim: Pick<NarrationClaim, "preferredVisualForms">): VisualFormFamily {
  return visualFormFamilyOf(claim.preferredVisualForms?.[0]);
}

/* ============================ Part 4: exact-text policy ============================ */
// CRITICAL_EXACT_TEXT must always be rendered deterministically (this
// module's graphic specs, or a real post-generation composite — see Part 6
// in advance-long-form-scene-generation/index.ts). INCIDENTAL_AI_TEXT may
// exist in generated imagery only when it carries no fact the viewer needs.
export type TextImportance = "CRITICAL_EXACT_TEXT" | "INCIDENTAL_AI_TEXT";

// A claim's own textOverlayCandidate (narrationVisualContract.ts) already
// asks the contract-compiler LLM the right question ("would a short overlay
// genuinely help, and how important is the TEXT itself") — this function
// just applies the review's own bright-line rule on top of that judgment,
// deterministically: HIGH importance + a real (non-empty) semanticText is
// always CRITICAL_EXACT_TEXT; anything else is incidental. A claim with no
// textOverlayCandidate at all (pre-dates this system) is always incidental
// — never invents a criticality the contract never asserted.
export function classifyTextImportance(claim: Pick<NarrationClaim, "textOverlayCandidate"> | null | undefined): TextImportance {
  const candidate = claim?.textOverlayCandidate;
  if (candidate?.recommended && candidate.importance === "HIGH" && candidate.semanticText?.trim()) return "CRITICAL_EXACT_TEXT";
  return "INCIDENTAL_AI_TEXT";
}
// The exact string that must ship verbatim for a CRITICAL_EXACT_TEXT claim
// — never re-derived or reformatted by the graphic renderer.
export function criticalExactTextOf(claim: Pick<NarrationClaim, "textOverlayCandidate"> | null | undefined): string | null {
  return classifyTextImportance(claim) === "CRITICAL_EXACT_TEXT" ? claim!.textOverlayCandidate!.semanticText.trim() : null;
}

/* ============================ Part 3: structured graphic specs ============================
 * 2026-09-17 "fix the PROGRAMMATIC_GRAPHIC / educational-explainer system"
 * pass — extends (never replaces) yesterday's GraphicSpec architecture.
 * TEXT_STATEMENT is renamed TEXT_EMPHASIS to match this task's own operator
 * naming (still the same deliberately-plain, last-resort, real-rendered
 * template — never the forbidden giant-pixel-text pattern). Four new
 * operators added: PROCESS (an icon chain — "radiation dose -> allowance ->
 * EVA time" — distinct from CAUSE_EFFECT's text-only steps), TIMELINE,
 * BEFORE_AFTER, SIMPLE_STAT.
 */
export const GRAPHIC_TEMPLATES = [
  "SYMBOL_NEGATION", "QUANTITY_RESOURCE", "COMPARISON", "ANNOTATED_SUBJECT", "CAUSE_EFFECT", "RESOURCE_BAR",
  "PROCESS", "TIMELINE", "BEFORE_AFTER", "SIMPLE_STAT",
  // 2026-09-23 "systemic production stabilization" pass, Item B: the
  // confirmed missing template family — a real multi-item list/checklist
  // claim (Atlantis's own "Pillars of Heracles" account: island size, harbors/
  // canals, the earthquake/inundation, "9000 years before Solon") fit NONE
  // of the other ten well, so compileGraphicSpec fell through pattern-
  // matching branches that don't apply and produced a degenerate PROCESS
  // diagram instead. Row-per-item, word-wrapped layout — genuinely built for
  // MORE and LONGER text than the single-line templates above, and (see
  // escalateToListLayout below) the generic zero-cost escalation target when
  // any other template's own content can't fit even at minimum size.
  "BULLET_LIST",
  // A deliberately plain, ALWAYS-valid template — the "explicit validated
  // alternative" Part 2 requires instead of ever silently falling back to
  // the old giant-pixel-text card. Still goes through the exact same real
  // font/anti-aliasing/safe-zone pipeline as every other template — it is a
  // genuinely different, clean layout, never the forbidden pattern, just
  // the simplest of the eleven, and (Part 2 of THIS pass) never reached by
  // silent collapse — see compileGraphicSpec's own doc comment below.
  "TEXT_EMPHASIS",
] as const;
export type GraphicTemplate = typeof GRAPHIC_TEMPLATES[number];

// Part 5/7: every structured spec carries its own treatment identity so
// Regenerate can deterministically pick a DIFFERENT one (never re-drawing
// the identical treatment) without needing an LLM call. `backgroundMode`
// generalizes yesterday's `theme` (kept as an alias below for the fields
// that already shipped) — STYLE_MATCHED is a real third mode the renderer
// resolves against the project's own style preset at render time.
export type BackgroundMode = "light" | "dark" | "styleMatched";
type SpecBase = {
  version: 1; claimId: string | null; theme: "light" | "dark"; backgroundMode: BackgroundMode;
  treatmentId: string; variantIndex: number;
  // Part 4: which EXACT Narration Contract version this spec's semantics
  // were pinned to — never re-resolved to "whatever is current" later.
  // Null only for a spec compiled with no contract at all (pre-contract
  // projects), never for "the caller couldn't be bothered to pass it."
  contractVersionId: string | null;
};
export type SymbolNegationSpec = SpecBase & { template: "SYMBOL_NEGATION"; icon: IconName; label: string | null; polarity: "unavailable" | "prohibited" | "absent" | "affirmed" };
export type QuantityResourceSpec = SpecBase & { template: "QUANTITY_RESOURCE"; value: string; unit: string | null; label: string | null; icon: IconName | null; qualifier: string | null };
export type ComparisonSpec = SpecBase & { template: "COMPARISON"; leftLabel: string; rightLabel: string; leftValue: string | null; rightValue: string | null };
export type AnnotatedSubjectSpec = SpecBase & { template: "ANNOTATED_SUBJECT"; subjectIcon: IconName; subjectLabel: string | null; annotations: string[] };
export type CauseEffectSpec = SpecBase & { template: "CAUSE_EFFECT"; steps: string[] };
export type ResourceBarSpec = SpecBase & { template: "RESOURCE_BAR"; label: string; value: string; unit: string | null; fraction: number };
export type TextEmphasisSpec = SpecBase & { template: "TEXT_EMPHASIS"; text: string };
// PROCESS: an ICON chain (subject -> operator -> outcome), the Shot-53 fix
// — "what transforms into what," never a fabricated number. Each step is
// {icon, label} — label is a short (<=4 word) name for the stage, never a
// value compileGraphicSpec invented.
export type ProcessStep = { icon: IconName; label: string };
export type ProcessSpec = SpecBase & { template: "PROCESS"; steps: ProcessStep[] };
export type TimelineSpec = SpecBase & { template: "TIMELINE"; markers: { label: string; position: number }[] };
export type BeforeAfterSpec = SpecBase & { template: "BEFORE_AFTER"; beforeLabel: string; afterLabel: string; beforeIcon: IconName | null; afterIcon: IconName | null };
export type SimpleStatSpec = SpecBase & { template: "SIMPLE_STAT"; value: string; label: string | null };
// BULLET_LIST: a genuine multi-item list — each item is {icon, text}, never
// more than 6 shown (a card that has to hold more than that needs a
// replan/split, not smaller and smaller rows — overflowCount reports how
// many were dropped, always shown to the viewer as "+N MORE" rather than
// silently discarded). `title` is optional short context above the list.
export type BulletListItem = { icon: IconName; text: string };
export type BulletListSpec = SpecBase & { template: "BULLET_LIST"; title: string | null; items: BulletListItem[]; overflowCount: number };
export type GraphicSpec =
  | SymbolNegationSpec | QuantityResourceSpec | ComparisonSpec | AnnotatedSubjectSpec | CauseEffectSpec | ResourceBarSpec
  | TextEmphasisSpec | ProcessSpec | TimelineSpec | BeforeAfterSpec | SimpleStatSpec | BulletListSpec;

// Part 5: deterministic variant selection — no LLM call needed for a normal
// "try another layout." Each template's real variant space is just "which
// icon/composition choice for the same fact" — kept intentionally small and
// honest (most templates genuinely only have 1-3 meaningfully different
// icon/layout choices for a given fact; padding this out with fake
// variety would itself be a form of the "invented" content Part 3 forbids).
const VARIANT_ICON_POOLS: Partial<Record<GraphicTemplate, IconName[]>> = {
  SYMBOL_NEGATION: ["warning", "cross", "generic"],
};
export function variantCountFor(spec: Pick<GraphicSpec, "template">): number {
  return VARIANT_ICON_POOLS[spec.template]?.length ?? 2; // every template supports at least a light/dark background swap as its 2nd "variant"
}
// Picks the next variant index, deliberately skipping the immediately
// previous one whenever more than one is available (Part 5: "must
// intentionally avoid the immediately previous treatment when >1 valid
// treatment exists"). Deterministic: same (treatmentId, previousVariant)
// pair always advances the same way — no randomness, so a retried/duplicate
// call is idempotent rather than surprising.
export function selectNextVariant(previousVariantIndex: number, totalVariants: number): number {
  if (totalVariants <= 1) return 0;
  return (previousVariantIndex + 1) % totalVariants;
}
// A stable identity for "this fact, told this way" — same claim+template
// always yields the same treatmentId, so switching variants never looks
// like switching to an unrelated fact.
export function treatmentIdFor(claimId: string | null, template: GraphicTemplate): string {
  return `${claimId ?? "no-claim"}::${template}`;
}

const RESOURCE_ICON_BY_KEYWORD: [RegExp, IconName][] = [
  [/oxygen|air|breath/i, "oxygen"], [/water|hydration|drink/i, "water"],
  [/power|battery|energy|electric/i, "power"], [/time|hour|minute|day|clock/i, "clock"],
  [/phone|call|signal|communicat/i, "phone"], [/person|crew|astronaut|human/i, "person"],
];
function inferIcon(text: string): IconName {
  for (const [re, icon] of RESOURCE_ICON_BY_KEYWORD) if (re.test(text)) return icon;
  return "generic";
}
// A raw `.slice(0, n)` can cut a real word in half (a real defect found
// compiling Mars's own claims: "THE OPERATIONS OFFICER C..."). Truncates at
// the last whole word that fits instead — never a fabricated ellipsis
// mid-word, and never longer than the caller's real limit.
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.4 ? cut.slice(0, lastSpace) : cut).trim();
}
// Extracts {value, unit} from a quantitative claim string ("3 days", "-30°C",
// "50%", "24 hours") — a small, deterministic parse, never a guess: if no
// clean number is found, the caller falls back to a different template
// rather than this function inventing a value.
function parseQuantity(text: string): { value: string; unit: string | null } | null {
  const match = text.match(/(?:≈|~)?\s*(-?[\d,]+(?:\.\d+)?)\s*(°?[A-Za-z]+(?:\/[A-Za-z]+)?|%|s)?/);
  if (!match) return null;
  return { value: match[1], unit: match[2]?.trim() || null };
}

// A claim describes a DERIVATION/CONVERSION ("X determines Y", "X converts
// into Y", "X translates to Y") rather than a plain cause->effect statement
// — the real Shot 53 pattern ("radiation dose determines the maximum EVA
// time"). This is exactly the case Part 3 requires a real visual
// explanation for, without ever inventing the number: an icon chain
// (PROCESS), not a text card.
//
// 2026-09-23 "systemic production stabilization" pass — real Atlantis
// finding: "limit"/"budget" are common ORDINARY-PROSE words ("...or simply
// the limits of the Greek world" matched and wrongly triggered a PROCESS
// diagram with no real derivation in the sentence at all). Removed both —
// the remaining words are specific enough to real derivation/conversion
// language that they rarely false-positive on narrative prose. Kept as a
// bare word list rather than requiring a fixed phrase, since a real
// derivation claim is phrased too many different ways to enumerate.
const DERIVATION_PATTERN = /\b(determin|convert|translat|calculat|allow(?:ance|ed)?)\w*\b/i;
// Even the narrower word list above can still fire on a sentence that only
// happens to use one of these verbs without describing a real two-concept
// derivation (e.g. "the calculation was never published"). Requires some
// independent, already-structured signal that a genuine subject->outcome
// relationship exists before trusting a bare regex match on free narration
// text — never applied to derivationSource drawn from causeEffectClaims
// (already structured) or an explicit "A -> B" textOverlayCandidate.
function hasDerivationStructuralSupport(claim: Pick<NarrationClaim, "causeEffectClaims" | "quantitativeClaims" | "primaryConcepts" | "textOverlayCandidate">): boolean {
  return Boolean(
    claim.causeEffectClaims?.length || claim.quantitativeClaims?.length || (claim.primaryConcepts?.length ?? 0) >= 2
    || /->|→/.test(claim.textOverlayCandidate?.semanticText ?? ""),
  );
}
// The middle connector step of a PROCESS derivation must reflect what the
// claim ACTUALLY said transforms subject into outcome, never one fixed word
// for every topic — real Atlantis bug: this was hardcoded literally as
// "LIMIT" regardless of the matched verb, so a "convert"/"translate" claim
// about an entirely unrelated topic still rendered a card that said LIMIT.
function deriveConnectorLabel(matchedVerb: string | undefined): string {
  const lower = (matchedVerb ?? "").toLowerCase();
  if (/^determin/.test(lower)) return "DETERMINES";
  if (/^convert/.test(lower)) return "CONVERTS TO";
  if (/^translat/.test(lower)) return "TRANSLATES TO";
  if (/^calculat/.test(lower)) return "CALCULATES";
  if (/^allow/.test(lower)) return "ALLOWS";
  return "LEADS TO";
}

export type CompileGraphicSpecResult = { ok: true; spec: GraphicSpec } | { ok: false; code: "GRAPHIC_REPLAN_REQUIRED"; reason: string };

// The ONE authoritative compiler — every field on the returned spec is
// copied from `claim`, never invented. On success, `template` is always one
// of GRAPHIC_TEMPLATES (Part 2: "never silently produce garbage"). On
// failure (Part 2/3), returns `{ok:false, code:"GRAPHIC_REPLAN_REQUIRED"}`
// instead of ever forcing a claim with no real usable content into
// TEXT_EMPHASIS — that template is a deliberate choice for a genuinely
// short, punchy, well-grounded fact, never a dumping ground for "the
// compiler couldn't figure this out."
//
// `variantIndex` (Part 5) selects among a template's real icon/composition
// choices for the SAME fact — "Try Another Layout" passes a different
// index; a fresh compile always starts at 0. `contractVersionId` (Part 4)
// is stamped onto the spec verbatim for durable provenance — this function
// never resolves it itself, the caller must have already pinned it.
export function compileGraphicSpec(claim: NarrationClaim, opts: {
  theme?: "light" | "dark"; backgroundMode?: BackgroundMode; variantIndex?: number; contractVersionId: string | null;
  // 2026-09-23 "systemic production stabilization" pass, Item B — the
  // per-beat authoritative fact set (visualShotPlanning.js's
  // assignSpanRequirements already distributes a shared claim's
  // requiredVisualFacts across its sibling beats, one/few facts per beat, by
  // real narration-span overlap; that per-beat assignment previously went
  // uncomputed by this function entirely). When present and non-empty, this
  // IS what this specific beat's card must show — takes priority over every
  // whole-claim pattern match below, so beats sharing one claim get
  // genuinely distinct graphics instead of all independently re-deriving
  // the identical claim-level spec. A beat assigned no distinct fact of its
  // own (a pure connective/establishing beat with nothing new to add) omits
  // this and falls through to the existing whole-claim logic unchanged —
  // applyDuplicateRenderGate may then legitimately REUSE it against a
  // sibling, which is the correct "hold this same visual" behavior, not a
  // regression of this fix.
  beatFacts?: string[] | null;
}): CompileGraphicSpecResult {
  const theme = opts.theme ?? "light";
  const backgroundMode = opts.backgroundMode ?? theme;
  const variantIndex = opts.variantIndex ?? 0;
  const mk = (template: GraphicTemplate) => ({ version: 1 as const, claimId: claim.claimId ?? null, theme, backgroundMode, variantIndex, contractVersionId: opts.contractVersionId, treatmentId: treatmentIdFor(claim.claimId ?? null, template) });
  const exactText = criticalExactTextOf(claim);
  const negationIconPool = VARIANT_ICON_POOLS.SYMBOL_NEGATION!;

  const explicitlySymbolicNegation = claim.preferredVisualForms?.includes("SYMBOLIC_NEGATION")
    || claim.graphicPrimitives?.includes("CROSS")
    || claim.graphicPrimitives?.includes("PROHIBITION");
  const hasStrongerGraphicSemantics = Boolean(
    claim.quantitativeClaims?.length || claim.comparisonClaims?.length || claim.causeEffectClaims?.length
    || claim.temporalClaims?.length || (claim.stateBefore && claim.stateAfter && claim.stateBefore !== claim.stateAfter)
  );
  // Skipped for an explicit negation/prohibition claim — that polarity
  // (unavailable/prohibited/absent) is safety-critical and already
  // correctly handled below; per-beat fact text must never override it.
  if (!explicitlySymbolicNegation) {
    const beatFacts = (opts.beatFacts ?? []).map((f) => (f ?? "").trim()).filter(Boolean);
    if (beatFacts.length) {
      const shown = beatFacts.slice(0, 6).map((f) => truncateAtWord(f, 46));
      const title = claim.primaryConcepts?.[0] ? truncateAtWord(claim.primaryConcepts[0], 30)
        : claim.visualCommunicationGoal ? truncateAtWord(claim.visualCommunicationGoal, 30) : null;
      return {
        ok: true,
        spec: { ...mk("BULLET_LIST"), template: "BULLET_LIST", title, items: shown.map((text) => ({ icon: inferIcon(text), text })), overflowCount: Math.max(0, beatFacts.length - shown.length) },
      };
    }
  }
  if (explicitlySymbolicNegation && !hasStrongerGraphicSemantics) {
    const subject = claim.forbiddenVisualFacts?.[0] ?? claim.negativeClaims?.[0] ?? claim.primaryConcepts?.[0] ?? claim.primarySubject;
    const inferred = inferIcon(subject ?? "");
    const icon = variantIndex === 0 ? inferred : negationIconPool[variantIndex % negationIconPool.length];
    return { ok: true, spec: { ...mk("SYMBOL_NEGATION"), template: "SYMBOL_NEGATION", icon, label: exactText ?? (subject ? truncateAtWord(subject, 24).toUpperCase() : null), polarity: "unavailable" } };
  }
  // Shot-53 fix: a derivation/conversion claim gets a real icon-chain
  // PROCESS diagram — never a fabricated number, never collapsed to text.
  // Real bug found compiling Mars's own Shot-53 claim: splitting the raw
  // NARRATION SENTENCE on the derivation verb produced meaningless
  // fragments ("BEFORE ANY" / "THAT INTO A") — the sentence's grammar
  // doesn't line up with a clean two-concept split. The claim already
  // carries exactly the right short concept labels
  // (textOverlayCandidate.semanticText, often authored as "X -> Y"; failing
  // that, primaryConcepts) — those are preferred, and splitting the raw
  // sentence is now the LAST resort, only for a claim with neither.
  const derivationSource = claim.causeEffectClaims?.[0] ?? (DERIVATION_PATTERN.test(claim.narrationText ?? "") ? claim.narrationText : null);
  if (derivationSource && DERIVATION_PATTERN.test(derivationSource) && hasDerivationStructuralSupport(claim)) {
    let subjectText: string | undefined, outcomeText: string | undefined;
    const overlayArrowSplit = claim.textOverlayCandidate?.semanticText?.split(/->|→/).map((s) => s.trim()).filter(Boolean);
    if (overlayArrowSplit && overlayArrowSplit.length >= 2) {
      [subjectText, outcomeText] = overlayArrowSplit;
    } else if ((claim.primaryConcepts?.length ?? 0) >= 2) {
      subjectText = claim.primaryConcepts![0];
      outcomeText = claim.primaryConcepts![claim.primaryConcepts!.length - 1];
    } else {
      const parts = derivationSource.split(/\bdetermin\w*\b|\bconverts?\b|\btranslat\w*\b|->|→/i).map((s) => s.trim()).filter(Boolean);
      subjectText = parts[0] ?? claim.primarySubject ?? claim.primaryConcepts?.[0] ?? "input";
      outcomeText = parts[1] ?? claim.visualCommunicationGoal ?? "outcome";
    }
    const connectorLabel = deriveConnectorLabel(derivationSource.match(DERIVATION_PATTERN)?.[0]);
    const steps: ProcessStep[] = [
      { icon: inferIcon(subjectText), label: truncateAtWord(subjectText, 14).toUpperCase() },
      { icon: "generic", label: connectorLabel },
      { icon: inferIcon(outcomeText), label: truncateAtWord(outcomeText, 14).toUpperCase() },
    ];
    return { ok: true, spec: { ...mk("PROCESS"), template: "PROCESS", steps } };
  }
  // A punchy, fact-shaped affirmation ("power IS restored", "signal is
  // back") suits a symbol+checkmark card; a longer NARRATIVE sentence
  // ("the operations officer checks the manifest daily") does not — a real
  // gap found compiling Mars's own claims, where this branch previously
  // fired on any positiveClaims text regardless of shape and produced a
  // mismatched icon/label. The word-count guard is a coarse but honest
  // proxy: short facts stay here, longer narrative claims fall through
  // instead of a bad forced fit.
  if (claim.positiveClaims?.length && !claim.quantitativeClaims?.length && !claim.comparisonClaims?.length && claim.positiveClaims[0].trim().split(/\s+/).length <= 8) {
    const subject = claim.positiveClaims[0] ?? claim.primaryConcepts?.[0];
    return { ok: true, spec: { ...mk("SYMBOL_NEGATION"), template: "SYMBOL_NEGATION", icon: inferIcon(subject ?? ""), label: exactText ?? (subject ? truncateAtWord(subject, 24).toUpperCase() : null), polarity: "affirmed" } };
  }
  // RESOURCE_BAR is checked BEFORE the generic quantitative branch below —
  // a real dead-code bug found writing this compiler's own tests: RESOURCE_
  // BAR also requires quantitativeClaims to be set, so if the plain
  // QUANTITY_RESOURCE check ran first it would always win, making
  // RESOURCE_BAR structurally unreachable. graphicPrimitives explicitly
  // naming PROGRESS_BAR/TIMELINE_BAR is a stronger, more specific signal
  // than "any claim with a number in it" and deserves priority.
  if (claim.graphicPrimitives?.includes("PROGRESS_BAR") || claim.graphicPrimitives?.includes("TIMELINE_BAR")) {
    const parsed = claim.quantitativeClaims?.length ? parseQuantity(claim.quantitativeClaims[0]) : null;
    if (parsed) return { ok: true, spec: { ...mk("RESOURCE_BAR"), template: "RESOURCE_BAR", label: truncateAtWord(claim.primaryConcepts?.[0] ?? claim.visualCommunicationGoal ?? "", 24), value: parsed.value, unit: parsed.unit, fraction: 0.5 } };
  }
  if (claim.quantitativeClaims?.length) {
    const parsed = parseQuantity(exactText ?? claim.quantitativeClaims[0]);
    if (parsed) {
      // variant 1 for a quantitative fact: the SAME exact value, told as a
      // one-line stat instead of an icon+value+label card — a real,
      // distinct layout, never a different (invented) number.
      if (variantIndex % 2 === 1) {
        return { ok: true, spec: { ...mk("SIMPLE_STAT"), template: "SIMPLE_STAT", value: parsed.unit ? `${parsed.value} ${parsed.unit}` : parsed.value, label: truncateAtWord(claim.visualCommunicationGoal || claim.primaryConcepts?.[0] || "", 40) || null } };
      }
      return { ok: true, spec: { ...mk("QUANTITY_RESOURCE"), template: "QUANTITY_RESOURCE", value: parsed.value, unit: parsed.unit, label: truncateAtWord(claim.visualCommunicationGoal || claim.primaryConcepts?.[0] || "", 40) || null, icon: inferIcon(claim.quantitativeClaims[0] + " " + (claim.primaryConcepts?.join(" ") ?? "")), qualifier: null } };
    }
  }
  // 2026-09-20 "fix unsupported graphic claim" pass — real Mars finding
  // (claim s16__c3, "CO2 returned to nominal over the following hours"):
  // a claim can carry a perfectly clean before/after semantic via its OWN
  // stateBefore/stateAfter fields (populated by the contract compiler
  // specifically for this purpose) while comparisonClaims stays empty
  // (comparisonClaims is for an explicit two-sided COMPARISON claimType,
  // not every state-change claim) — the BEFORE_AFTER branch below only
  // ever checked comparisonClaims, so a claim exactly like this one fell
  // all the way through to the TEXT_EMPHASIS fallback and then failed that
  // too (see the word-count fix further down). Checked BEFORE
  // comparisonClaims since a real stateBefore/After pair is the more
  // direct, already-normalized signal for exactly this template.
  // Scoped to !comparisonClaims?.length so an existing claim that already
  // matches via the comparisonClaims branch below (with its own variant-
  // dependent COMPARISON/BEFORE_AFTER split) is completely unaffected —
  // this is purely an ADDITIONAL path for claims comparisonClaims-based
  // matching doesn't cover, never a change to already-working behavior.
  if (!claim.comparisonClaims?.length && claim.stateBefore && claim.stateAfter && claim.stateBefore !== claim.stateAfter) {
    return { ok: true, spec: { ...mk("BEFORE_AFTER"), template: "BEFORE_AFTER", beforeLabel: truncateAtWord(claim.stateBefore, 16), afterLabel: truncateAtWord(claim.stateAfter, 16), beforeIcon: null, afterIcon: null } };
  }
  if (claim.comparisonClaims?.length) {
    const [leftRaw, rightRaw] = splitComparison(claim.comparisonClaims[0]);
    if (leftRaw && rightRaw) {
      // BEFORE_AFTER is COMPARISON's sibling for a temporal/state claim
      // (continuityRequirement HIGH signals "same subject, one state
      // changes" — exactly what before/after means, versus a COMPARISON of
      // two genuinely different things). Truncation length dropped from
      // 24/30 (Section 20 real data: "one long paired EVA" / "several short
      // trips" both overflowed their column even at the renderer's minimum
      // font size) — a two-column layout has real, narrower per-side width
      // than a full-width template, and needs a tighter budget to match.
      if (claim.continuityRequirement === "HIGH" && variantIndex % 2 === 1) {
        return { ok: true, spec: { ...mk("BEFORE_AFTER"), template: "BEFORE_AFTER", beforeLabel: truncateAtWord(leftRaw, 16), afterLabel: truncateAtWord(rightRaw, 16), beforeIcon: null, afterIcon: null } };
      }
      return { ok: true, spec: { ...mk("COMPARISON"), template: "COMPARISON", leftLabel: truncateAtWord(leftRaw, 16), rightLabel: truncateAtWord(rightRaw, 16), leftValue: null, rightValue: null } };
    }
  }
  if (claim.causeEffectClaims?.length) {
    // Truncation length dropped from 28 to 16 — real Mars data ("regional
    // dust mobilization", "cut solar insolation over") still overflowed a
    // multi-step layout's per-slot width at 28 chars even at the
    // renderer's minimum font size; N steps sharing the card width need a
    // real per-step budget, not a full-width one.
    const steps = claim.causeEffectClaims.slice(0, 4).map((s) => truncateAtWord(s, 16));
    if (steps.length >= 2) return { ok: true, spec: { ...mk("CAUSE_EFFECT"), template: "CAUSE_EFFECT", steps } };
    const split = claim.causeEffectClaims[0]?.split(/\bcauses?\b|\bmeant\b|->|→/i).map((s) => s.trim()).filter(Boolean);
    if (split && split.length >= 2) return { ok: true, spec: { ...mk("CAUSE_EFFECT"), template: "CAUSE_EFFECT", steps: split.slice(0, 4).map((s) => truncateAtWord(s, 16)) } };
  } else {
    // 2026-09-21 "graphics are not a quota" pass: a claim that never got a
    // structured causeEffectClaims entry (e.g. an inline/synthesized claim
    // that only ever populated textOverlayCandidate) can still carry an
    // obvious causal chain in its own narrationText — general English
    // connectives, never a domain-specific keyword, and only ones strong
    // enough to be unambiguous (unlike "so"/"but", which are too common and
    // would misfire on ordinary narrative sentences). Only used when EVERY
    // resulting segment is substantial (>=3 words) — a weak/ambiguous split
    // falls through to a later template rather than forcing a bad fit.
    const causalSplit = String(claim.narrationText ?? "")
      .split(/\bbecause\b|\bresults? in\b|\bleads? to\b|\bresisted by\b|\bcaused? by\b|\btherefore\b|\bas a result\b/i)
      .map((s) => s.trim().replace(/^[,;:.\s]+|[,;:.\s]+$/g, "")).filter(Boolean);
    if (causalSplit.length >= 2 && causalSplit.every((s) => s.split(/\s+/).length >= 3)) {
      return { ok: true, spec: { ...mk("CAUSE_EFFECT"), template: "CAUSE_EFFECT", steps: causalSplit.slice(0, 4).map((s) => truncateAtWord(s, 16)) } };
    }
  }
  if (claim.temporalClaims?.length) {
    const markers = claim.temporalClaims.slice(0, 5).map((t, i, arr) => ({ label: truncateAtWord(t, 20), position: arr.length > 1 ? i / (arr.length - 1) : 0.5 }));
    if (markers.length >= 2) return { ok: true, spec: { ...mk("TIMELINE"), template: "TIMELINE", markers } };
  } else {
    // Same deterministic-fallback principle as CAUSE_EFFECT above, for an
    // explicit sequential narration ("First... then... finally...") with no
    // structured temporalClaims entry — general English sequence markers,
    // never a domain-specific word list.
    const sequenceSplit = String(claim.narrationText ?? "")
      .split(/\bfirst\b|\bthen\b|\bnext\b|\bafter that\b|\bfinally\b/i)
      .map((s) => s.trim().replace(/^[,;:.\s]+|[,;:.\s]+$/g, "")).filter(Boolean);
    if (sequenceSplit.length >= 2 && sequenceSplit.every((s) => s.split(/\s+/).length >= 3)) {
      const markers = sequenceSplit.slice(0, 5).map((t, i, arr) => ({ label: truncateAtWord(t, 20), position: arr.length > 1 ? i / (arr.length - 1) : 0.5 }));
      return { ok: true, spec: { ...mk("TIMELINE"), template: "TIMELINE", markers } };
    }
  }
  if (claim.graphicPrimitives?.includes("ANNOTATED_IMAGE") || claim.graphicPrimitives?.includes("CALLOUT") || claim.preferredVisualForms?.includes("ANNOTATED_DIAGRAM")) {
    const annotations = (claim.requiredVisualFacts ?? []).slice(0, 4).map((f) => truncateAtWord(f, 24));
    if (annotations.length) return { ok: true, spec: { ...mk("ANNOTATED_SUBJECT"), template: "ANNOTATED_SUBJECT", subjectIcon: inferIcon(claim.primarySubject ?? ""), subjectLabel: claim.primarySubject ? truncateAtWord(claim.primarySubject, 24) : null, annotations } };
  }
  // Deliberate last resort — TEXT_EMPHASIS, chosen (not collapsed into) ONLY
  // when there is real, short, usable content. Part 2: a claim with
  // nothing safely representable must NOT be forced into text at all.
  //
  // 2026-09-20 "fix unsupported graphic claim" pass — real bug: this used
  // to be one ?? chain (exactText ?? visualCommunicationGoal ?? ...),
  // meaning the FIRST candidate that merely EXISTS wins the length check —
  // if that candidate happens to be long (e.g. a full-sentence
  // visualCommunicationGoal), the whole branch fails even when a later,
  // genuinely short candidate (primaryConcepts[0], or exactText itself)
  // would have fit fine. Now tries EVERY real candidate, in the same
  // priority order as before, and uses the first one that actually fits —
  // never inventing text, only choosing among what the claim already has.
  const emphasisCandidates = [exactText, claim.visualCommunicationGoal, claim.primaryConcepts?.[0], claim.narrationText].filter((t): t is string => Boolean(t && t.trim()));
  const emphasisText = emphasisCandidates.find((t) => t.trim().split(/\s+/).length <= 12);
  if (emphasisText) {
    return { ok: true, spec: { ...mk("TEXT_EMPHASIS"), template: "TEXT_EMPHASIS", text: truncateAtWord(emphasisText, 60) } };
  }
  return { ok: false, code: "GRAPHIC_REPLAN_REQUIRED", reason: `No template could safely represent claim ${claim.claimId ?? "(no id)"} without inventing content — narration was too long/unstructured for any of the ${GRAPHIC_TEMPLATES.length} known templates.` };
}

// Real bug found writing this compiler's own tests: requiring a space on
// BOTH sides of the separator (`\s(?:...)\s`) misses the extremely common
// "clause; clause" phrasing, where a semicolon has a space AFTER it but
// never before ("the panel was clean; the panel is now dust-covered").
// Semicolon is handled as its own case (optional trailing space only);
// vs/versus/compared-to still require real word boundaries either side.
function splitComparison(text: string): [string | null, string | null] {
  const parts = text.split(/\s+(?:vs\.?|versus|compared to)\s+|;\s*/i);
  if (parts.length >= 2) return [parts[0].trim(), parts[1].trim()];
  return [null, null];
}

// Part 2's own validation gate — callers (the compile-time planner) can use
// this to decide whether compileGraphicSpec found a genuinely well-grounded
// template (a real value/comparison/cause-chain from the claim) versus fell
// all the way through to the generic TEXT_EMPHASIS fallback, which is
// still valid, deliberate output but worth knowing about at a glance
// (surfaced in the dry-run report's per-template breakdown).
export function isFallbackSpec(spec: GraphicSpec): boolean {
  return spec.template === "TEXT_EMPHASIS";
}

// 2026-09-23 "systemic production stabilization" pass, Item B — the text
// fragments a given spec was already built from, regardless of template.
// Never invents anything; only reads fields the spec already carries.
export function extractListItemsFromSpec(spec: GraphicSpec): string[] {
  switch (spec.template) {
    case "PROCESS": return spec.steps.map((s) => s.label);
    case "CAUSE_EFFECT": return spec.steps;
    case "TIMELINE": return spec.markers.map((m) => m.label);
    case "COMPARISON": return [spec.leftLabel, spec.rightLabel, spec.leftValue, spec.rightValue].filter((x): x is string => Boolean(x));
    case "BEFORE_AFTER": return [spec.beforeLabel, spec.afterLabel];
    case "ANNOTATED_SUBJECT": return spec.annotations;
    case "QUANTITY_RESOURCE": return [spec.label, spec.unit ? `${spec.value} ${spec.unit}` : spec.value].filter((x): x is string => Boolean(x));
    case "RESOURCE_BAR": return [spec.label, spec.unit ? `${spec.value} ${spec.unit}` : spec.value].filter((x): x is string => Boolean(x));
    case "SIMPLE_STAT": return [spec.label, spec.value].filter((x): x is string => Boolean(x));
    case "SYMBOL_NEGATION": return spec.label ? [spec.label] : [];
    case "TEXT_EMPHASIS": return [spec.text];
    case "BULLET_LIST": return spec.items.map((i) => i.text);
    default: return [];
  }
}

// The generic, zero-provider-cost "choose a more appropriate layout" fix
// Item B requires: when a compiled spec's OWN content can't fit its chosen
// template even at minimum size (checked by the caller via renderGraphicCard's
// `issues`), the deterministic answer is never to keep shrinking text — it is
// to re-lay out the SAME already-decided content in the one template built
// for more/longer items (BULLET_LIST's wrapped, row-per-item layout). Never
// claim/subject-specific: works from whatever extractListItemsFromSpec finds
// on ANY template. Returns null when there's genuinely nothing to escalate
// (already BULLET_LIST, or the spec carries no text at all).
export function escalateToListLayout(spec: GraphicSpec): BulletListSpec | null {
  if (spec.template === "BULLET_LIST") return null;
  const items = extractListItemsFromSpec(spec).map((t) => t.trim()).filter(Boolean);
  if (!items.length) return null;
  const shown = items.slice(0, 6).map((text) => ({ icon: inferIcon(text), text: truncateAtWord(text, 46) }));
  return {
    version: 1, claimId: spec.claimId, theme: spec.theme, backgroundMode: spec.backgroundMode, variantIndex: 0,
    contractVersionId: spec.contractVersionId, treatmentId: treatmentIdFor(spec.claimId, "BULLET_LIST"),
    template: "BULLET_LIST", title: null, items: shown, overflowCount: Math.max(0, items.length - shown.length),
  };
}

/* ============================ Part 4: contract-claim trust validation ============================
 * "Validate claim narration segment IDs + chapter + claim semantics before
 * trusting the contract claim." A claimId match alone is not enough — a
 * stale/mismatched claim (e.g. from a DIFFERENT contract version that
 * happens to reuse the same claimId string) must never be silently used.
 */
export function validatePinnedClaim(beat: { narrationSegmentIds?: string[]; chapterId?: string | null }, claim: Pick<NarrationClaim, "narrationSegmentIds"> & { chapterId?: string | null }): { valid: true } | { valid: false; reason: string } {
  const beatSegments = new Set(beat.narrationSegmentIds ?? []);
  const overlap = (claim.narrationSegmentIds ?? []).some((id) => beatSegments.has(id));
  if (!overlap) return { valid: false, reason: "CLAIM_SEGMENT_MISMATCH: the pinned claim's narrationSegmentIds do not overlap this beat's own narrationSegmentIds" };
  if (beat.chapterId != null && claim.chapterId != null && beat.chapterId !== claim.chapterId) {
    return { valid: false, reason: "CLAIM_CHAPTER_MISMATCH: the pinned claim belongs to a different chapter than this beat" };
  }
  return { valid: true };
}

// 2026-09-19 "activate the repair ladder — but safely" pass (Section 6):
// extracted verbatim from retry-long-form-scene's own "Try Another Layout"
// handler so BOTH the manual retry endpoint and the fully-automatic
// zero-cost repair dispatch in advance-long-form-scene-generation (a real
// GRAPHIC_RENDER_DEFECT discovered right after the deterministic card
// renders, before it ever reaches the user) resolve the exact same claim
// the exact same way — never two slightly-different "which claim covers
// this beat" implementations drifting apart. Finds the trustworthy contract
// claim for a PROGRAMMATIC_GRAPHIC recompile: for a scene that already has
// a structured spec, this is just re-fetching the SAME claim its own plan
// row already points to (a pure variant swap, no new semantics). For a
// legacy/null spec, there is no existing narration_claim_id/
// narration_contract_version_id to trust, so this recovers one the ONLY
// safe way Part 4 allows: read the VisualPlan's OWN pinned contract version
// (never "whatever's current"), then match by real narration-segment
// overlap (validatePinnedClaim) — never a guess.
export async function resolveGraphicClaim(admin: any, plan: any): Promise<{ claim: any; contractVersionId: string } | { error: string }> {
  if (plan.narration_claim_id && plan.narration_contract_version_id) {
    const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("claims").eq("id", plan.narration_contract_version_id).maybeSingle();
    const claim = (contractRow?.claims ?? []).find((c: any) => c.claimId === plan.narration_claim_id);
    if (claim) return { claim, contractVersionId: plan.narration_contract_version_id };
  }
  const { data: planVersionRow } = await admin.from("long_form_visual_plan_versions").select("visual_plan").eq("id", plan.visual_plan_version_id).maybeSingle();
  const pinnedContractVersionId: string | null = planVersionRow?.visual_plan?.narrationContractVersionId ?? null;
  if (!pinnedContractVersionId) return { error: "GRAPHIC_REPLAN_REQUIRED: this project has no pinned narration contract to upgrade from" };
  const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("claims").eq("id", pinnedContractVersionId).maybeSingle();
  const candidates: any[] = contractRow?.claims ?? [];
  const beatShape = { narrationSegmentIds: plan.narration_segment_ids ?? [], chapterId: plan.chapter_id ?? null };
  const matched = candidates.find((c) => validatePinnedClaim(beatShape, c).valid);
  if (!matched) return { error: "GRAPHIC_REPLAN_REQUIRED: no contract claim covers this beat's narration span" };
  return { claim: matched, contractVersionId: pinnedContractVersionId };
}
