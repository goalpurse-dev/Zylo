import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { refineVisualSequences, assignSpanRequirements } from "../supabase/functions/_shared/visualShotPlanning.js";
import { applyDuplicateRenderGate, findGeneratePromptDuplicates, normalizeSemanticPrompt } from "../supabase/functions/_shared/scenePromptQuality.ts";
import { compileScenePrompt, compileSceneNegativePrompt, compileReferenceRules } from "../supabase/functions/_shared/sceneRenderPlan.ts";
import { getStylePresetForProject, compileReferencePrompt, validateCompiledReferencePrompt } from "../supabase/functions/_shared/visualWorldStyle.ts";
import { compileGraphicSpec } from "../supabase/functions/_shared/graphicSpec.ts";
import { scenePromptJobPayload } from "../supabase/functions/_shared/sceneJobs.ts";
import { groupScenesForBoard } from "../src/pages/workspace/long-form/sceneCardModel.js";
import { preparePlanForCompilation } from "../supabase/functions/_shared/episodePreflight.ts";

const style = getStylePresetForProject("bold_cartoon_documentary:v1");

test("span requirements and overlay text are fulfilled once, never copied to every child", () => {
  const beats = Array.from({ length: 7 }, (_, i) => ({ id: `b${i + 1}`, narrationClaimId: "c1", shotNarrationText: ["ordinary daylight", "the source disappears", "uncertainty", "falling question", "freeze question", "orbit question", "timeline promise"][i] }));
  const claim = { claimId: "c1", requiredVisualFacts: ["Earth in daylight", "Three question captions (feel it? freeze? fly away?)"], textOverlayCandidate: { recommended: true, importance: "HIGH", semanticText: "8:19" } };
  assignSpanRequirements(beats, [claim]);
  assert.equal(beats.filter((b) => b.shotRequiredVisualFacts.includes("Earth in daylight")).length, 1);
  assert.equal(beats.filter((b) => b.overlayRequirement?.text.includes("feel it")).length, 1);
  assert.equal(beats.filter((b) => b.textOverlay?.text === "8:19").length, 1);
});

test("shot expansion persists exact subranges plus distinct shot purpose/action/delta", () => {
  const narration = "An ordinary place rests in calm daylight before anything changes, with people moving normally and familiar objects clearly visible. Then the main source of light disappears and the environment changes. The subject remains intact while uncertainty becomes the focus. A colder state is foreshadowed without claiming an instant freeze. Motion continues along the established path rather than stopping. The final view introduces the longer mechanism-driven timeline that the explanation will follow.";
  const source = { entityRegistry: [], visualBeats: [{ id: "m1", chapterId: "ch1", narrationSegmentIds: ["s1"], informationToCommunicate: "Establish the question and its progression", visualType: "STORY_ILLUSTRATION", primaryEntityIds: [], supportingEntityIds: [], baseSetupKey: "opening" }] };
  const script = { narrationSegments: [{ id: "s1", text: narration }] };
  const claim = { claimId: "c1", narrationSegmentIds: ["s1"], narrationText: narration, primarySubject: "the subject", visualCommunicationGoal: "Establish the question", preferredVisualForms: ["CHARACTER_ACTION"], requiredVisualFacts: [], textOverlayCandidate: null, continuityRequirement: "MEDIUM" };
  const plan = refineVisualSequences(source, script, "balanced", [claim]);
  assert.ok(plan.visualBeats.length >= 5);
  assert.equal(new Set(plan.visualBeats.map((b) => b.shotNarrationText)).size, plan.visualBeats.length);
  for (const beat of plan.visualBeats) {
    assert.ok(beat.shotPurpose);
    assert.ok(beat.subject);
    assert.ok(beat.actionOrState);
    assert.ok(beat.visualDelta);
  }
});

test("duplicate GENERATE intents become derived operations before submission", () => {
  const beats = Array.from({ length: 6 }, (_, i) => ({ id: `b${i + 1}`, sequenceId: "s", sequenceIndex: i + 1, renderMethod: "GENERATE", shotStrategy: "NEW_SETUP", shotSize: i % 2 ? "WIDE" : "MEDIUM", shotPurpose: "Show the same whole sequence objective", subject: "Earth", actionOrState: "Earth and Sun with every question", visualDelta: "Only camera size changes", baseSetupKey: "base" }));
  applyDuplicateRenderGate(beats);
  assert.equal(beats.filter((b) => b.renderMethod === "GENERATE").length, 1);
  assert.ok(beats.slice(1).every((b) => ["REUSE", "CROP", "EDIT"].includes(b.renderMethod)));
});

test("duplicate gate works across tiny sequences in one chapter, reproducing the Chapter 5 failure shape", () => {
  const ideas = ["air releases stored heat", "rock conducts heat downward", "ocean stores heat", "coasts cool slowly", "geothermal heat is small"];
  const beats = Array.from({ length: 42 }, (_, i) => ({ id: `b${i + 1}`, chapterId: "ch5", sequenceId: `tiny_${i + 1}`, sequenceIndex: i + 1, renderMethod: "GENERATE", shotStrategy: "NEW_SETUP", shotSize: i % 3 ? "MEDIUM" : "WIDE", shotPurpose: "Explain thermal inertia", subject: "Earth", actionOrState: ideas[i % ideas.length], visualDelta: "Continue the explanation", baseSetupKey: `base_${i + 1}` }));
  applyDuplicateRenderGate(beats);
  assert.equal(beats.filter((beat) => beat.renderMethod === "GENERATE").length, ideas.length);
  assert.ok(beats.filter((beat) => beat.renderMethod !== "GENERATE").length >= 37);
});

test("two nearby Sun-delay shots with different narration remain distinct paid ideas", () => {
  const beats = [
    { id: "s16", chapterId: "ch2", sequenceId: "delay", sequenceIndex: 16, renderMethod: "GENERATE", shotPurpose: "Explain signal travel", subject: "Earth", actionOrState: "Information from the Sun is still travelling toward Earth", visualDelta: "Show the signal in transit", baseSetupKey: "delay_a" },
    { id: "s21", chapterId: "ch2", sequenceId: "delay", sequenceIndex: 21, renderMethod: "GENERATE", shotPurpose: "Explain signal arrival", subject: "Earth", actionOrState: "The trailing edge of the information reaches Earth", visualDelta: "Show the signal reaching Earth", baseSetupKey: "delay_b" },
  ];
  applyDuplicateRenderGate(beats);
  assert.deepEqual(beats.map((beat) => beat.renderMethod), ["GENERATE", "GENERATE"]);
});

test("legacy macro text is removed when exact Sun-like child narration is hydrated", () => {
  const narration = ["ordinary sunny day", "the Sun disappears", "Earth remains intact", "cold is foreshadowed", "orbital motion continues", "the physical timeline begins"];
  const plan = { visualBeats: narration.map((text, i) => ({ id: `sun_${i + 1}`, chapterId: "ch1", sequenceId: "opening", sequenceIndex: i + 1, narrationClaimId: "c1", informationToCommunicate: `Repeat the entire opening objective: ${text}`, renderMethod: "GENERATE", shotSize: "MEDIUM", baseSetupKey: `base_${i + 1}`, primaryEntityIds: ["Earth"] })) };
  const contract = { claims: [{ claimId: "c1", narrationText: narration.join(" "), primarySubject: "Earth", requiredVisualFacts: [], textOverlayCandidate: null }] };
  const prepared = preparePlanForCompilation(plan, contract);
  assert.equal(new Set(prepared.visualBeats.map((beat) => beat.actionOrState)).size, 6);
  assert.ok(prepared.visualBeats.every((beat) => !beat.shotPurpose.includes("entire opening objective")));
});

test("raster prompt is shot-specific, text-free, style-locked and paired with a useful negative prompt", () => {
  const prompt = compileScenePrompt(style, {
    sceneType: "STORY_SCENE", shotSize: "WIDE", cameraFraming: "wide establishing view", focalSubject: "Earth",
    informationToCommunicate: "Show Earth moving about 29.8 km/s with a label reading 29.8 km/s",
    shotPurpose: "Explain tangent motion", subject: "Earth", actionOrState: "Earth moves at 29.8 km/s", visualDelta: "Introduce tangent motion",
    characterIdentityBlocks: [], locationDescription: null, worldStateNotes: [], continuityNote: null, factualConstraints: [], forbiddenElements: [], reserveTextSafeArea: true,
    referenceRules: compileReferenceRules([{ role: "OBJECT_REFERENCE", represents: "Earth" }]),
  });
  assert.match(prompt, /\[VISUAL PURPOSE\]/);
  assert.match(prompt, /No text, no letters, no numbers/);
  assert.doesNotMatch(prompt, /29\.8/);
  assert.match(prompt, /Do not copy its framing, layout, background, embedded text/);
  const negative = compileSceneNegativePrompt(style);
  for (const term of ["photorealistic", "3D render", "engraving", "multiple panels", "gibberish typography", "duplicated subject"]) assert.match(negative, new RegExp(term, "i"));
});

test("provider payload persists the compiled negative prompt without a provider call", () => {
  const negative = compileSceneNegativePrompt(style);
  const payload = scenePromptJobPayload({ id: "scene", render_strategy: "GENERATE", scene_render_plan_id: "plan" }, "owner", "prompt", "free", "v3", [], "2026-01-01T00:00:00Z", null, negative);
  assert.equal(payload.input.negative, negative);
  assert.equal(payload.tool_key, "image:kling.o3");
});

test("Earth-speed graphic is quantitative on a light background and never a crossed-out phone", () => {
  const claim = { claimId: "speed", claimType: "NEGATION", negativeClaims: ["instant stop"], quantitativeClaims: ["29.8 km/s"], comparisonClaims: [], causeEffectClaims: [], temporalClaims: [], stateBefore: "", stateAfter: "", preferredVisualForms: ["NUMBER_EMPHASIS"], graphicPrimitives: ["NUMBER"], primaryConcepts: ["Earth speed"], primarySubject: "Earth", visualCommunicationGoal: "Show Earth tangent speed", textOverlayCandidate: { recommended: true, importance: "HIGH", semanticText: "≈29.8 km/s" } };
  const result = compileGraphicSpec(claim, { theme: "light", backgroundMode: "light", contractVersionId: "contract" });
  assert.equal(result.ok, true);
  assert.notEqual(result.spec.template, "SYMBOL_NEGATION");
  assert.equal(result.spec.backgroundMode, "light");
  assert.doesNotMatch(JSON.stringify(result.spec), /phone/i);
});

// 2026-09-22 "cheap reference system" pass — real Atlantis incident: this
// branch's own section headings never matched validateCanonicalReferencePrompt's
// hard contract, so the style anchor failed 100% of the time. Rewritten
// to satisfy that contract and to be genuinely simple (one figure, no
// scene fragment) per explicit product direction.
test("style-only reference prompt is content-neutral, simple, and satisfies the canonical negative-contract validator", () => {
  const view = { referenceType: "style_reference", angle: "canonical_style_frame", purpose: "style" };
  const prompt = compileReferencePrompt({ styleSpec: style, entityName: "Classic style anchor", canonicalSpec: "", view });
  assert.match(prompt, /STYLE-ONLY REFERENCE/);
  assert.match(prompt, /one generic, unnamed adult figure/i);
  assert.doesNotMatch(prompt, /environment fragment/i, "must never ask for a scene/environment fragment");
  assert.match(prompt, /NO readable text/);
  assert.doesNotThrow(() => validateCompiledReferencePrompt(view, prompt));
});

test("semantic duplicate assertion ignores camera/style boilerplate", () => {
  const make = (id, size) => ({ beatId: id, renderStrategy: "GENERATE", imagePrompt: `[STYLE LOCK]\ncommon style\n[COMPOSITION]\n${size}\n[ACTION / STATE]\nSame action`, plannedBeat: { id, sequenceId: "s", sequenceIndex: Number(id.slice(1)) } });
  assert.equal(normalizeSemanticPrompt(make("b1", "WIDE").imagePrompt), normalizeSemanticPrompt(make("b2", "CLOSE").imagePrompt));
  assert.equal(findGeneratePromptDuplicates([make("b1", "WIDE"), make("b2", "CLOSE")]).length, 1);
});

test("scene board flows short sequences through one responsive chapter grid", () => {
  const cards = [1, 2, 3, 4].map((n) => ({ beatId: `b${n}`, sequenceIndex: n, chapterId: "ch1", sequenceId: `tiny-${n}`, startSeconds: n - 1, endSeconds: n, narrativeFunction: `step ${n}` }));
  const groups = groupScenesForBoard(cards);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cards.length, 4);
  const ui = fs.readFileSync(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8");
  assert.match(ui, /md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4/);
});
