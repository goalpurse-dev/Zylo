import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ALL_NICHES } from "../src/pages/workspace/long-form/niches.js";
import { NICHE_GUIDANCE, DEFAULT_NICHE_GUIDANCE, nicheGuidanceFor } from "../supabase/functions/_shared/stickman/nicheGuidance.ts";
import {
  enforceStickmanTitleRules,
  findBannedLecturePhrases,
  findNumberedListEnumerations,
  checkColdOpen,
  checkQuestionCadence,
  checkSpecificity,
  checkBridging,
  checkCallback,
  checkTitleQuestionRestated,
  checkCloserRhythm,
  validateStickmanSectionShape,
} from "../supabase/functions/_shared/stickman/scriptChecks.ts";
import { isStickmanProfile, nicheFromProfile, fetchActiveGenerationProfile } from "../supabase/functions/_shared/stickman/recipeProfile.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const seg = (id, text, chapterId = "c1") => ({ id, chapterId, text });

// ============================================================================
// Niche guidance config — Phase 1, Section 1.
// ============================================================================

test("NICHE_GUIDANCE has an entry for every one of the 25 real niches in niches.js, each with a non-empty tone and evidenceTypes", () => {
  assert.equal(ALL_NICHES.length, 25, "niches.js itself should still have exactly 25 niches — update this test deliberately if that ever changes");
  for (const niche of ALL_NICHES) {
    const guidance = NICHE_GUIDANCE[niche.id];
    assert.ok(guidance, `missing NICHE_GUIDANCE entry for niche "${niche.id}"`);
    assert.ok(guidance.tone && guidance.tone.length > 10, `niche "${niche.id}" tone is too short/empty`);
    assert.ok(guidance.evidenceTypes && guidance.evidenceTypes.length > 10, `niche "${niche.id}" evidenceTypes is too short/empty`);
  }
});

test("nicheGuidanceFor falls back to DEFAULT_NICHE_GUIDANCE for an unknown/null niche, and returns the real entry for a known one", () => {
  assert.deepEqual(nicheGuidanceFor(null), DEFAULT_NICHE_GUIDANCE);
  assert.deepEqual(nicheGuidanceFor(undefined), DEFAULT_NICHE_GUIDANCE);
  assert.deepEqual(nicheGuidanceFor("not_a_real_niche"), DEFAULT_NICHE_GUIDANCE);
  assert.deepEqual(nicheGuidanceFor("space_cosmic_scale"), NICHE_GUIDANCE.space_cosmic_scale);
});

// ============================================================================
// Recipe/profile helper — Phase 1.
// ============================================================================

test("isStickmanProfile/nicheFromProfile are simple, safe reads that never throw on a missing/null profile", () => {
  assert.equal(isStickmanProfile(null), false);
  assert.equal(isStickmanProfile(undefined), false);
  assert.equal(isStickmanProfile({ recipe_version: "STICKMAN_DOODLE_EXPLAINER_V1" }), true);
  assert.equal(isStickmanProfile({ recipe_version: "something_else" }), false);
  assert.equal(nicheFromProfile(null), null);
  assert.equal(nicheFromProfile({ raw_setup_snapshot: {} }), null);
  assert.equal(nicheFromProfile({ raw_setup_snapshot: { niche: "  " } }), null);
  assert.equal(nicheFromProfile({ raw_setup_snapshot: { niche: "everyday_science" } }), "everyday_science");
});

test("fetchActiveGenerationProfile queries long_form_generation_profiles filtered to status='active' for the given project", async () => {
  const calls = [];
  const fakeAdmin = {
    from(table) {
      calls.push({ table });
      const chain = {
        select: (cols) => { calls.push({ select: cols }); return chain; },
        eq: (col, val) => { calls.push({ eq: [col, val] }); return chain; },
        maybeSingle: async () => ({ data: { id: "profile-1", recipe_version: "STICKMAN_DOODLE_EXPLAINER_V1" } }),
      };
      return chain;
    },
  };
  const profile = await fetchActiveGenerationProfile(fakeAdmin, "project-123");
  assert.equal(profile.id, "profile-1");
  assert.equal(calls[0].table, "long_form_generation_profiles");
  assert.ok(calls.some((c) => c.eq && c.eq[0] === "project_id" && c.eq[1] === "project-123"));
  assert.ok(calls.some((c) => c.eq && c.eq[0] === "status" && c.eq[1] === "active"));
});

// ============================================================================
// scriptChecks.ts — real behavioral unit tests (pure functions, no Deno-only
// imports), not just source-pattern regex.
// ============================================================================

test("enforceStickmanTitleRules: a compliant title passes through unchanged", () => {
  const { title, adjusted } = enforceStickmanTitleRules("Why Don't We Eat Horses?");
  assert.equal(title, "Why Don't We Eat Horses?");
  assert.equal(adjusted, false);
});

test("enforceStickmanTitleRules: strips colons instead of just deleting them (keeps it grammatical)", () => {
  const { title, adjusted } = enforceStickmanTitleRules("What If: The Moon Disappeared");
  assert.equal(adjusted, true);
  assert.doesNotMatch(title, /:/);
  assert.match(title, /—/);
});

test("enforceStickmanTitleRules: truncates an over-60-character title at a word boundary, never mid-word", () => {
  const long = "How Did Ancient Humans Actually Survive The Coldest Winters In Recorded History Without Fire";
  assert.ok(long.length > 60);
  const { title, adjusted } = enforceStickmanTitleRules(long);
  assert.ok(title.length <= 60, `expected <=60 chars, got ${title.length}`);
  assert.equal(adjusted, true);
  assert.ok(long.startsWith(title.replace(/[,;:.\-–—]+$/, "")), "truncation must be a clean prefix of the original, not reworded");
  assert.doesNotMatch(title, /\s$/);
});

test("findBannedLecturePhrases catches lecture/filler phrases case-insensitively and names the exact phrase", () => {
  const issues = findBannedLecturePhrases([seg("s1", "In this video we're going to explore something wild.")]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "banned_lecture_phrase");
  assert.deepEqual(issues[0].segmentIds, ["s1"]);
});

test("findBannedLecturePhrases does not false-positive on ordinary narration", () => {
  assert.deepEqual(findBannedLecturePhrases([seg("s1", "You wake up freezing, and the fire's already out.")]), []);
});

test("findNumberedListEnumerations catches (1)/(2), digit-parenthesis lists, and firstly/secondly", () => {
  assert.equal(findNumberedListEnumerations([seg("s1", "There are three reasons: (1) heat, (2) light, (3) safety.")]).length, 1);
  assert.equal(findNumberedListEnumerations([seg("s1", "1) It keeps you warm.")]).length, 1);
  assert.equal(findNumberedListEnumerations([seg("s1", "Firstly, it's expensive.")]).length, 1);
  assert.equal(findNumberedListEnumerations([seg("s1", "The fire kept them warm all night.")]).length, 0);
});

test("checkColdOpen: passes a genuine second-person cold open with no greeting/meta-question", () => {
  const segments = [seg("s1", "You're standing outside in the freezing dark, and the fire just went out. Ninety seconds is all you have before your fingers stop working.")];
  assert.deepEqual(checkColdOpen(segments), []);
});

test("checkColdOpen: HARD-fails when the first 60 words never address the viewer", () => {
  const segments = [seg("s1", "Ancient humans faced brutal winters with almost no protection from the elements at all, relying only on primitive tools and communal shelter to survive the coldest nights of the year across many regions of the world for generations without modern comforts.")];
  const issues = checkColdOpen(segments);
  assert.ok(issues.some((i) => i.code === "cold_open_no_second_person"));
});

test("checkColdOpen: HARD-fails on a greeting or a question about the video itself", () => {
  const greeting = checkColdOpen([seg("s1", "Welcome to this video about how ancient humans survived the winter.")]);
  assert.ok(greeting.some((i) => i.code === "cold_open_is_greeting_or_meta"));
  const metaQuestion = checkColdOpen([seg("s1", "Have you ever wondered what it was like to survive a prehistoric winter?")]);
  assert.ok(metaQuestion.some((i) => i.code === "cold_open_is_greeting_or_meta"));
});

test("checkQuestionCadence: flags a script with far fewer than 1 question per WORDS_PER_MINUTE words", () => {
  const longFlatText = Array.from({ length: 200 }, () => "word").join(" ");
  const issues = checkQuestionCadence([seg("s1", longFlatText)], 145);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "low_question_cadence");
});

test("checkQuestionCadence: passes a script with adequate question density", () => {
  const text = Array.from({ length: 10 }, (_, i) => `Sentence number ${i}?`).join(" ");
  assert.deepEqual(checkQuestionCadence([seg("s1", text)], 145), []);
});

test("checkSpecificity: flags low numeral density in evidence sections and any vague qualifier anywhere", () => {
  const vague = seg("s1", "This happened a long time ago and many scientists agree it was very big.", "evidence1");
  const issues = checkSpecificity([vague], new Set(["evidence1"]));
  assert.ok(issues.some((i) => i.code === "low_specificity"));
  assert.ok(issues.filter((i) => i.code === "vague_qualifier").length >= 3);
});

test("checkSpecificity: a numerically dense evidence section with no vague qualifiers passes clean", () => {
  const dense = seg("s1", "In 1347, the plague killed 25 million people across Europe in just 4 years, roughly 30 percent of the population.", "evidence1");
  assert.deepEqual(checkSpecificity([dense], new Set(["evidence1"])), []);
});

test("checkBridging: flags a script with almost no you/your references, passes one with adequate density", () => {
  const noYou = Array.from({ length: 150 }, () => "fact").join(" ");
  assert.equal(checkBridging([seg("s1", noYou)]).length, 1);
  const withYou = "Your body would react within minutes. " + Array.from({ length: 90 }, () => "word").join(" ");
  assert.deepEqual(checkBridging([seg("s1", withYou)]), []);
});

test("checkCallback: valid plant-before-payoff passes clean", () => {
  const segments = [seg("s1", "She kept a single rusted key in her pocket the whole journey."), seg("s2", "filler"), seg("s3", "That same rusted key was what finally opened the door home.")];
  assert.deepEqual(checkCallback(segments, "a single rusted key in her pocket", "That same rusted key was what finally opened the door home."), []);
});

test("checkCallback: WARNs (never throws) when quotes are missing, not found verbatim, or out of order", () => {
  const segments = [seg("s1", "the key part one"), seg("s2", "the key part two")];
  assert.equal(checkCallback(segments, null, null)[0].code, "callback_missing");
  assert.equal(checkCallback(segments, "never actually written", "the key part two")[0].code, "callback_plant_not_found");
  assert.equal(checkCallback(segments, "the key part one", "never actually written")[0].code, "callback_payoff_not_found");
  const reversed = checkCallback(segments, "the key part two", "the key part one");
  assert.ok(reversed.some((i) => i.code === "callback_order_invalid"));
});

test("checkTitleQuestionRestated: flags the title's question restated more than once", () => {
  const title = "Why Don't We Eat Horses?";
  const segments = [
    seg("s1", "Why don't we eat horses in most Western countries?"),
    seg("s2", "So why don't we eat horses even though they're perfectly edible?"),
    seg("s3", "Because of cultural history, not biology."),
  ];
  const issues = checkTitleQuestionRestated(segments, title);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "title_question_restated");
});

test("checkTitleQuestionRestated: a single natural statement of the core question is fine", () => {
  const title = "Why Don't We Eat Horses?";
  const segments = [seg("s1", "Why don't we eat horses in most Western countries?"), seg("s2", "It comes down to culture, not taste.")];
  assert.deepEqual(checkTitleQuestionRestated(segments, title), []);
});

test("checkCloserRhythm: flags a long flowing closer, passes short punchy fragments", () => {
  const longSentence = "This is a very long and winding sentence that keeps going and going without ever giving the listener a moment to breathe or absorb what was just said at all.";
  assert.equal(checkCloserRhythm([seg("s1", longSentence)]).length, 1);
  const punchy = seg("s1", "It's not luck. It's biology. And it's still happening to you, right now.");
  assert.deepEqual(checkCloserRhythm([punchy]), []);
});

test("validateStickmanSectionShape: accepts the exact required order with 3-6 evidence sections and no twist", () => {
  const sections = [
    { role: "cold_open" }, { role: "stakes" }, { role: "core_question" },
    { role: "evidence" }, { role: "evidence" }, { role: "evidence" },
    { role: "callback_payoff" }, { role: "closer" },
  ];
  assert.deepEqual(validateStickmanSectionShape(sections), []);
});

test("validateStickmanSectionShape: accepts an optional single twist right before callback_payoff", () => {
  const sections = [
    { role: "cold_open" }, { role: "stakes" }, { role: "core_question" },
    { role: "evidence" }, { role: "evidence" }, { role: "evidence" }, { role: "evidence" },
    { role: "twist" }, { role: "callback_payoff" }, { role: "closer" },
  ];
  assert.deepEqual(validateStickmanSectionShape(sections), []);
});

test("validateStickmanSectionShape: rejects too few evidence sections, wrong order, and extra trailing sections", () => {
  const tooFew = [{ role: "cold_open" }, { role: "stakes" }, { role: "core_question" }, { role: "evidence" }, { role: "evidence" }, { role: "callback_payoff" }, { role: "closer" }];
  assert.ok(validateStickmanSectionShape(tooFew).some((i) => /3-6/.test(i.message)));

  const wrongOrder = [{ role: "stakes" }, { role: "cold_open" }, { role: "core_question" }, { role: "evidence" }, { role: "evidence" }, { role: "evidence" }, { role: "callback_payoff" }, { role: "closer" }];
  assert.ok(wrongOrder.length && validateStickmanSectionShape(wrongOrder).length > 0);

  const trailing = [{ role: "cold_open" }, { role: "stakes" }, { role: "core_question" }, { role: "evidence" }, { role: "evidence" }, { role: "evidence" }, { role: "callback_payoff" }, { role: "closer" }, { role: "evidence" }];
  assert.ok(validateStickmanSectionShape(trailing).some((i) => /extra section/.test(i.message)));
});

// ============================================================================
// Legacy path completely unchanged — generate-long-form-story-plan.
// ============================================================================

test("LEGACY UNCHANGED: TOPIC_INSTRUCTIONS and STORY_INSTRUCTIONS keep their exact original wording, and the legacy branch still uses them (not a Stickman substitute)", async () => {
  const text = await source("supabase/functions/generate-long-form-story-plan/index.ts");
  // Long, distinctive verbatim substrings from the ORIGINAL prompts — an
  // edit to either prompt's actual wording would almost certainly break at
  // least one of these.
  assert.match(text, /Topic type must generalize far beyond surface domain \(history\/science\/tech alone is never a sufficient answer\)\. Think in narrative primitives instead — the SHAPE of the story, not its subject:/);
  assert.match(text, /If the user is arriving from a discovered idea, its narrativeArchetype is only a HINT of the ORIGINAL guess — you may refine it, combine it with other primitives, or override it entirely once you actually understand the topic\. Do not treat it as binding\./);
  assert.match(text, /avoid generic patterns like "The Fascinating World of\.\.\.", "Exploring\.\.\.", "Everything You Need to Know About\.\.\.", "The Ultimate Guide to\.\.\."\. Be specific — a title should promise a specific payoff a curious viewer can picture\. Return exactly one recommended title and exactly two distinct alternatives\./);
  assert.match(text, /CHAPTERS: use however many chapters this specific story actually needs \(typically 5-9\) — never force a fixed count\. Every chapter must have a real reason to exist\. Never use generic chapter titles like "Introduction", "Background", "Main Topic", "Conclusion"/);
  assert.match(text, /chapters: \{ type: "array", items: CHAPTER_SCHEMA, minItems: 5, maxItems: 9 \}/);
  // The legacy branch (isStickman === false) must call the legacy constants,
  // not the Stickman ones.
  assert.match(text, /instructions: STORY_INSTRUCTIONS,[\s\S]{0,400}text: \{ format: \{ type: "json_schema", name: "story_plan_result", strict: true, schema: STORY_PLAN_SCHEMA \} \}/);
});

test("LEGACY UNCHANGED: resolveLengthAndDepth and the topic->story call sequence are unbranched (Pass A is genuinely shared, not duplicated per recipe)", async () => {
  const text = await source("supabase/functions/generate-long-form-story-plan/index.ts");
  assert.match(text, /function resolveLengthAndDepth\(project: any, topicModel: any\)/);
  // Only ONE call to TOPIC_INSTRUCTIONS exists — Pass A is never branched.
  const topicInstructionsUses = (text.match(/instructions: TOPIC_INSTRUCTIONS,/g) ?? []).length;
  assert.equal(topicInstructionsUses, 1, "Pass A (Topic Understanding) must stay a single shared call, not duplicated for Stickman");
});

// ============================================================================
// Legacy path completely unchanged — advance-long-form-script.
// ============================================================================

test("LEGACY UNCHANGED: DRAFT_INSTRUCTIONS, CRITIC_INSTRUCTIONS, and REVISION_INSTRUCTIONS keep their exact original wording", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /NARRATION IS THE PRODUCT: the video must be worth listening to with the screen off\. Visuals come later and support the narration; you are not writing captions for images\./);
  assert.match(text, /A chapter with INCOMPLETE \(not absent\) evidence is not automatically unwritable\. If enough exists to state a true, simplified version of the chapter's core idea, write that/);
  assert.match(text, /"We don't have enough sourced material to explain this" is never acceptable narration, in any phrasing\./);
  assert.match(text, /LENGTH IS A BUDGET, NOT A QUOTA: targetWords is an approximate production budget, not a padding requirement\./);
  assert.match(text, /You are Zyvo's Script Critic\. You diagnose a finished narration draft across several independent lenses in ONE pass — you never rewrite prose yourself/);
  assert.match(text, /ANY instance of this must be reported with severity "high" regardless of how minor it seems — this is a hard blocker for readiness, not a style preference\./);
  assert.match(text, /You are Zyvo's Script Revision Director\. You are given a small set of narration segments that a Critic flagged/);
});

test("LEGACY UNCHANGED: META_LANGUAGE_PATTERNS, validateScriptDocument, and the length/call-cap constants are never touched or branched by recipe", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  // validateScriptDocument itself is called with the SAME 3-arg signature it
  // always had, from inside the new validateWithStickmanExtras wrapper — the
  // function's own body is never edited, only wrapped.
  assert.match(text, /function validateWithStickmanExtras\(doc: any, pack: ScriptEvidencePack, validFactIds: Set<string>, isStickman: boolean\): ValidationResult \{\s*const base = validateScriptDocument\(doc, pack, validFactIds\);\s*if \(!isStickman\) return base;/);
  assert.match(text, /const SEGMENT_TARGET_MIN_WORDS = 40;/);
  assert.match(text, /const SEGMENT_TARGET_MAX_WORDS = 120;/);
  assert.match(text, /const SEGMENT_HARD_MAX_WORDS = 200;/);
  assert.match(text, /const WORD_BUDGET_TOLERANCE = 0\.15;/);
  assert.match(text, /const HARD_MIN_LENGTH_RATIO = 0\.75;/);
  assert.match(text, /const MAX_SCRIPT_MODEL_CALLS = 3;/);
  assert.match(text, /const MAX_STAGE_ATTEMPTS = 3;/);
  // chapter-set fidelity invariant text unchanged.
  assert.match(text, /chapters\[\] must exactly match the Story Plan's chapter set, in order —\s*\/\/ Script never adds, drops, or reorders chapters relative to the plan\./);
});

test("STICKMAN: the bounded expand pass triggers at a tighter 10% shortfall than legacy's 25%, and a script still over 25% short after that one attempt is downgraded from ready to needs_attention with a clear reason — legacy's own 25% trigger and its non-blocking word_budget_off warning are untouched", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /const STICKMAN_LENGTH_EXPANSION_TRIGGER_RATIO = 0\.9;/);
  const finalizingFn = text.slice(text.indexOf("async function stageFinalizing"), text.indexOf("/* ============================ Dispatch"));
  // Trigger threshold is isStickman-conditional; legacy keeps HARD_MIN_LENGTH_RATIO exactly.
  assert.match(finalizingFn, /const expansionTriggerRatio = isStickman \? STICKMAN_LENGTH_EXPANSION_TRIGGER_RATIO : HARD_MIN_LENGTH_RATIO;/);
  assert.match(finalizingFn, /if \(lengthRatio < expansionTriggerRatio && expansionCallsUsed < MAX_LENGTH_EXPANSION_CALLS\) \{/);
  // Hard floor backstop: Stickman-only, downgrades ready -> needs_attention, never touches a non-ready status.
  assert.match(finalizingFn, /const lengthStillTooShort = isStickman && status === "ready" && finalLengthRatio < HARD_MIN_LENGTH_RATIO;/);
  assert.match(finalizingFn, /if \(lengthStillTooShort\) \{\s*status = "needs_attention";/);
  assert.match(finalizingFn, /more than 25% under length even after an automatic expansion attempt/);
});

test("LEGACY UNCHANGED: the legacy branch of every stage still calls the original functions/instructions when isStickman is false", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /: await runDraft\(pack, project\.narrative_strategy, storyPlan, usage\);/);
  // Phase 1 FINAL: stageCritic goes through callStickmanModel (positional
  // instructions), which forwards a non-Claude model to callStructured with
  // the identical request shape — legacy still gets gpt-5-mini + CRITIC_INSTRUCTIONS.
  // 2026-10-07: a Stickman version started on the backup model uses it (stickmanModel); legacy is untouched.
  assert.match(text, /const criticModel = isStickman \? stickmanModel\(row, STICKMAN_CRITIC_MODEL\) : OPENAI_MODEL;/);
  assert.match(text, /isStickman \? STICKMAN_CRITIC_INSTRUCTIONS : CRITIC_INSTRUCTIONS,/);
  assert.match(text, /return await callStructured\(\{ model, store: false, instructions, input, text: \{ format: \{ type: "json_schema", name: schemaName, strict: true, schema \} \} \}, timeoutMs, usage\);/);
  assert.match(text, /isStickman \? STICKMAN_REVISION_INSTRUCTIONS : REVISION_INSTRUCTIONS/);
  // runSelectiveRevision's new 5th param defaults to the legacy constant, so
  // every pre-existing call site with only 4 args is behaviorally identical.
  assert.match(text, /async function runSelectiveRevision\(doc: any, pack: ScriptEvidencePack, critic: any, usage: UsageTotals, instructions: string = REVISION_INSTRUCTIONS, model: string = OPENAI_MODEL\)/);
});

test("a legacy (non-Stickman) script_document never gets a checkResults field or Stickman-only chapter fields", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /\.\.\.\(isStickman \? \{ checkResults: \{ hard: finalValidationResult\.errors, warn: stickmanFinalWarnings \} \} : \{\}\),/);
  assert.match(text, /if \(isStickman\) \{\s*scriptDocument = enrichStickmanDocument\(scriptDocument, storyPlan\);\s*\}/);
});

// ============================================================================
// Stickman branch wiring exists and reaches every required stage.
// ============================================================================

test("STICKMAN: Story Plan branch is wired — profile fetch, title/section-shape enforcement, and the callback/thumbnail schema fields all exist", async () => {
  const text = await source("supabase/functions/generate-long-form-story-plan/index.ts");
  assert.match(text, /const profile = await fetchActiveGenerationProfile\(admin, projectId\);/);
  assert.match(text, /const isStickman = isStickmanProfile\(profile\);/);
  assert.match(text, /if \(isStickman\) \{/);
  assert.match(text, /callbackPlan: STICKMAN_CALLBACK_PLAN_SCHEMA,/);
  assert.match(text, /thumbnailConcept: STICKMAN_THUMBNAIL_CONCEPT_SCHEMA,/);
  assert.match(text, /role: \{ type: "string", enum: \["cold_open", "stakes", "core_question", "evidence", "twist", "callback_payoff", "closer"\] \}/);
  assert.match(text, /enforceStickmanTitleRules\(/);
  assert.match(text, /validateStickmanSectionShape\(storyResult\.storyPlan\.chapters\)/);
});

test("STICKMAN: Script branch is wired end to end — profile/niche fetched once and threaded into draft, critic, and revision stages", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /const profile = await fetchActiveGenerationProfile\(admin, row\.project_id\);/);
  assert.match(text, /const isStickman = isStickmanProfile\(profile\);/);
  assert.match(text, /const niche = nicheFromProfile\(profile\);/);
  assert.match(text, /await stageDraft\(admin, row, project, storyPlan, researchVersion, isStickman, niche\);/);
  assert.match(text, /await stageCritic\(admin, row, project, storyPlan, isStickman\);/);
  assert.match(text, /await stageRevision\(admin, row, project, storyPlan, isStickman, niche\);/);
  assert.match(text, /await stageFinalizing\(admin, row, project, storyPlan, isStickman\);/);
  assert.match(text, /plantQuote: \{ type: "string"/);
  assert.match(text, /payoffQuote: \{ type: "string"/);
  assert.match(text, /explanationDepth = project\.resolved_explanation_depth \?\? "balanced";/);
});

test("STICKMAN: the draft prompt carries the full a-h structure, TTS-safety, and depth-changes-density (not length) rules", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /COLD OPEN \(role: cold_open\): 2-4 sentences, second person \("You…"\), present tense, sensory, high stakes/);
  assert.match(text, /EVIDENCE UNITS \(role: evidence, one section per sub-question from the StoryPlan\): each unit is claim -> named source/);
  assert.match(text, /the total word count stays the same regardless of depth; depth changes density and pacing, not runtime\./);
  assert.match(text, /TTS-SAFE TEXT: plain spoken words only/);
  assert.match(text, /Record the EXACT sentence or clause you used for the plant as plantQuote, and the EXACT sentence or clause you used for the payoff as payoffQuote/);
});

test("STICKMAN: the critic prompt scores all 8 structure beats through the same issues[]/segmentIds mechanism the legacy critic already uses (no separate, disconnected reporting path)", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  for (const beatType of ["cold_open_weak", "stakes_weak", "core_question_unclear", "evidence_unit_weak", "question_cadence_weak", "callback_weak", "bridging_weak", "closer_weak"]) {
    assert.match(text, new RegExp(beatType), `missing structure-beat type "${beatType}" in the Stickman critic schema`);
  }
  assert.match(text, /function buildStickmanCriticSchema\(segmentIds: string\[\]\)/);
});

test("STICKMAN: script_document output shape includes sections with role/subQuestion, plantQuote/payoffQuote, thumbnailConcept, and checkResults per Phase 1 Section 5", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /return \{ \.\.\.c, role: section\?\.role \?\? null, subQuestion: section\?\.subQuestion \?\? "" \};/);
});

// ============================================================================
// The Selected Idea propagation bug fix (Production Setup).
// ============================================================================

test("ProductionSetup.jsx no longer hardcodes selectedIdea: null — a picked Discover-Ideas idea is looked up by selectedIdeaId and passed through", async () => {
  const text = await source("src/pages/workspace/long-form/ProductionSetup.jsx");
  assert.doesNotMatch(text, /selectedIdea: null,/);
  assert.match(text, /const selectedIdea = selectedIdeaId \? ideas\.find\(\(idea\) => idea\.id === selectedIdeaId\) \?\? null : null;/);
  assert.match(text, /source: selectedIdea \? "discovery" : "custom",/);
});
