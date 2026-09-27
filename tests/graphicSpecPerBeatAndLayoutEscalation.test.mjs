import test from "node:test";
import assert from "node:assert/strict";
import { compileGraphicSpec, extractListItemsFromSpec, escalateToListLayout, GRAPHIC_TEMPLATES } from "../supabase/functions/_shared/graphicSpec.ts";
import { renderGraphicCard } from "../supabase/functions/_shared/graphicTemplates.ts";

// 2026-09-23 "systemic production stabilization" pass, Item B — real
// Atlantis finding: shots 9/10/11/14/15 all shared one narration claim
// ("Pillars of Heracles" account) and all independently compiled to the
// BYTE-IDENTICAL "PILLARS OF -> LIMIT -> CRITIAS" 3-circle PROCESS diagram,
// because (1) compileGraphicSpec was a pure function of the CLAIM alone
// (never the beat), and (2) DERIVATION_PATTERN false-positived on the word
// "limit" in ordinary prose ("...or simply the limits of the Greek world"),
// forcing a PROCESS template onto a claim that was really a multi-item
// account with no real derivation in it at all.
const pillarsClaim = {
  claimId: "seg02__inline", emphasis: "MEDIUM", claimType: "EXPLAINER", confidence: 0.8,
  narrationText: "Critias describes an island beyond the Pillars of Heracles, larger than Libya and Asia combined, or simply the limits of the Greek world as they knew it.",
  primarySubject: "the island beyond the Pillars of Heracles", primaryConcepts: ["Pillars of Heracles", "Critias"],
  positiveClaims: [], negativeClaims: [], comparisonClaims: [], causeEffectClaims: [], temporalClaims: [],
  quantitativeClaims: [], graphicPrimitives: [], preferredVisualForms: ["ANNOTATED_DIAGRAM"],
  requiredVisualFacts: [
    "an island beyond the Pillars of Heracles, larger than Libya and Asia combined",
    "fertile plains and a ring of harbors and canals",
    "a catastrophic earthquake and flood that sank it in a single day and night",
    "the account is dated to 9000 years before Solon",
  ],
  forbiddenVisualFacts: [], entitiesMentioned: [], forbiddenEntities: [], entityRequirements: [],
  narrationSegmentIds: ["seg02"], allowedAmbiguity: "MEDIUM", continuityRequirement: "LOW",
  textOverlayCandidate: { importance: "LOW", recommended: false, semanticText: "" },
  visualCommunicationGoal: "Communicate the scale and eventual fate of Plato's Atlantis account.",
};

test("BULLET_LIST is a real registered template", () => {
  assert.ok(GRAPHIC_TEMPLATES.includes("BULLET_LIST"));
});

test("DERIVATION_PATTERN no longer false-positives on ordinary prose containing 'limit'", () => {
  const result = compileGraphicSpec(pillarsClaim, { theme: "light", contractVersionId: "c1" });
  assert.notEqual(result.ok && result.spec.template, "PROCESS", "must never force a PROCESS/derivation diagram onto ordinary narrative prose that merely contains the word 'limit'");
});

test("five sibling beats sharing one claim now compile to genuinely DIFFERENT cards when assignSpanRequirements gave each a distinct fact", () => {
  const facts = pillarsClaim.requiredVisualFacts;
  const specs = facts.map((fact) => compileGraphicSpec(pillarsClaim, { theme: "light", contractVersionId: "c1", beatFacts: [fact] }));
  for (const s of specs) assert.equal(s.ok, true);
  const serialized = specs.map((s) => JSON.stringify(s.ok && s.spec));
  const distinct = new Set(serialized);
  assert.equal(distinct.size, facts.length, "each sibling beat's own assigned fact must produce a distinct spec — the exact bug that produced 5 byte-identical cards");
  for (const s of specs) assert.equal(s.ok && s.spec.template, "BULLET_LIST");
});

test("a beat with no assigned facts falls through to the existing whole-claim logic unchanged", () => {
  const withFacts = compileGraphicSpec(pillarsClaim, { theme: "light", contractVersionId: "c1", beatFacts: null });
  const withoutOpt = compileGraphicSpec(pillarsClaim, { theme: "light", contractVersionId: "c1" });
  assert.deepEqual(withFacts, withoutOpt);
});

test("beatFacts is ignored for an explicit negation/prohibition claim — polarity correctness is never overridden by per-beat fact text", () => {
  const negationClaim = {
    ...pillarsClaim, preferredVisualForms: ["SYMBOLIC_NEGATION"], negativeClaims: ["no trace of the island was ever found"],
    requiredVisualFacts: [], comparisonClaims: [], causeEffectClaims: [], temporalClaims: [], quantitativeClaims: [], stateBefore: null, stateAfter: null,
  };
  const result = compileGraphicSpec(negationClaim, { theme: "light", contractVersionId: "c1", beatFacts: ["some incidental fact"] });
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "SYMBOL_NEGATION");
});

test("BULLET_LIST caps at 6 items and reports the rest as overflowCount, never squeezing an unbounded list", () => {
  const manyFacts = Array.from({ length: 9 }, (_, i) => `fact number ${i + 1} about the island`);
  const result = compileGraphicSpec(pillarsClaim, { theme: "light", contractVersionId: "c1", beatFacts: manyFacts });
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "BULLET_LIST");
  assert.equal(result.spec.items.length, 6);
  assert.equal(result.spec.overflowCount, 3);
});

test("renderGraphicCard renders a BULLET_LIST with real content without overflow issues at typical lengths", () => {
  const result = compileGraphicSpec(pillarsClaim, { theme: "light", contractVersionId: "c1", beatFacts: [pillarsClaim.requiredVisualFacts[1]] });
  assert.equal(result.ok, true);
  const rendered = renderGraphicCard(result.spec);
  assert.deepEqual(rendered.issues, []);
});

test("renderGraphicCard flags BULLET_LIST compiled with zero items as a structural issue, never silently blank", () => {
  const spec = { version: 1, claimId: "c1", theme: "light", backgroundMode: "light", variantIndex: 0, contractVersionId: "c1", treatmentId: "t", template: "BULLET_LIST", title: null, items: [], overflowCount: 0 };
  const rendered = renderGraphicCard(spec);
  assert.ok(rendered.issues.some((i) => i.includes("BULLET_LIST requires at least 1 item")));
});

test("extractListItemsFromSpec pulls real text from every template family, never inventing content", () => {
  const process = { template: "PROCESS", steps: [{ icon: "generic", label: "A" }, { icon: "generic", label: "B" }] };
  assert.deepEqual(extractListItemsFromSpec(process), ["A", "B"]);
  const cmp = { template: "COMPARISON", leftLabel: "X", rightLabel: "Y", leftValue: null, rightValue: null };
  assert.deepEqual(extractListItemsFromSpec(cmp), ["X", "Y"]);
  const bullets = { template: "BULLET_LIST", items: [{ icon: "generic", text: "Z" }] };
  assert.deepEqual(extractListItemsFromSpec(bullets), ["Z"]);
});

test("escalateToListLayout returns null for BULLET_LIST itself (nothing to escalate to)", () => {
  const spec = { version: 1, claimId: "c1", theme: "light", backgroundMode: "light", variantIndex: 0, contractVersionId: "c1", treatmentId: "t", template: "BULLET_LIST", title: null, items: [{ icon: "generic", text: "X" }], overflowCount: 0 };
  assert.equal(escalateToListLayout(spec), null);
});

test("escalateToListLayout turns an overflowing PROCESS/TIMELINE/etc spec into a genuinely more spacious BULLET_LIST built from the SAME content", () => {
  const longSteps = { version: 1, claimId: "c1", theme: "light", backgroundMode: "light", variantIndex: 0, contractVersionId: "c1", treatmentId: "t", template: "TIMELINE", markers: [
    { label: "a very long marker label that will not fit its slot", position: 0 },
    { label: "another very long marker label that also overflows", position: 1 },
  ] };
  const escalated = escalateToListLayout(longSteps);
  assert.equal(escalated.template, "BULLET_LIST");
  assert.equal(escalated.items.length, 2);
  const rendered = renderGraphicCard(escalated);
  assert.deepEqual(rendered.issues, [], "the escalated BULLET_LIST layout must actually fit content the original template could not");
});

test("a genuine derivation claim (with real structural support) still compiles to PROCESS, with a connector label reflecting the actual matched verb", () => {
  const derivationClaim = {
    ...pillarsClaim, requiredVisualFacts: [], primaryConcepts: ["radiation dose", "maximum EVA time"],
    narrationText: "The radiation dose determines the maximum EVA time allowed for the crew.",
    quantitativeClaims: ["4 hours"],
  };
  const result = compileGraphicSpec(derivationClaim, { theme: "light", contractVersionId: "c1" });
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "PROCESS");
  assert.equal(result.spec.steps[1].label, "DETERMINES");
});
