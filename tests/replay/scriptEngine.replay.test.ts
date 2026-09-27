// deno-lint-ignore-file no-explicit-any
// Offline replay tests for every Script Engine fix made since the last full
// paid run. Real stage code, in-memory DB, cassette-answered model calls —
// zero API spend. Run: npm run test:replay
import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1";
import { seedDb, runPipeline, playCassette, loadEngine, shortenEvidence, setSegmentText, words } from "./harness.ts";
import {
  snapshot, roleByChapter, goodDraft, verifyEntries, verifyResponder, criticEntry, failingCritic, passingCritic,
  revisionEntry, revisionPatch, draftEntry, claimFixEntry, STAKES_LINE,
} from "./fixtures.ts";
import { findStakesOrQuestionOverrun, findUndeclaredCheckableSentences } from "../../supabase/functions/_shared/stickman/scriptChecks.ts";
import { installCassetteRecorder, installCassettePlayer } from "../../supabase/functions/_shared/stickman/cassette.ts";

const seg = (doc: any, id: string) => doc.narrationSegments.find((s: any) => s.id === id);
const callbackText = () => seg(goodDraft(), "seg_callback").text;

async function replay(entries: any[], opts: { maxSteps?: number; scriptOverrides?: any } = {}) {
  const player = playCassette(entries);
  const { db, scriptId } = seedDb(snapshot, opts.scriptOverrides);
  try {
    const result = await runPipeline(db, scriptId, opts.maxSteps ?? 20);
    return { ...result, player, db };
  } finally {
    player.restore();
  }
}

/* ============================ Full pipeline ============================ */

Deno.test("full replay: draft > verify > critic 6 > revision > RE-CRITIQUE 7.5 > ready", async () => {
  const { row, stages, player } = await replay([
    draftEntry(goodDraft()),
    ...verifyEntries(8),
    criticEntry(failingCritic()),
    revisionEntry(revisionPatch([{ id: "seg_callback", text: callbackText() }])),
    criticEntry(passingCritic()),
  ]);
  assertEquals(stages, ["draft", "claim_verify", "claim_fix", "critic", "revision", "claim_verify", "claim_fix", "critic", "finalizing"]);
  assertEquals(row.status, "ready");
  assertEquals(row.critic_result.overallScore, 7.5, "final critic_result must describe the REVISED script");
  assertEquals(row.intermediate.firstCriticResult.overallScore, 6);
  assertEquals(row.intermediate.criticPasses, 2);
  assertEquals(row.script_document.checkResults.hard, []);
  assertEquals(player.calls.filter((c) => c.key === "stickman_script_critic").length, 2);
  assertEquals(player.remaining.filter((e) => e.kind !== "openai").length, 0, "every model response consumed");
});

Deno.test("re-critique is bounded: a second low score finalizes, never a second revision", async () => {
  const { row, stages } = await replay([
    draftEntry(goodDraft()),
    ...verifyEntries(8),
    criticEntry(failingCritic()),
    revisionEntry(revisionPatch([{ id: "seg_callback", text: callbackText() }])),
    criticEntry(failingCritic()),
  ]);
  assertEquals(stages, ["draft", "claim_verify", "claim_fix", "critic", "revision", "claim_verify", "claim_fix", "critic", "finalizing"]);
  assertEquals(row.status, "needs_attention", "a 6/10 after revision is honestly not ready");
  assertEquals(row.critic_result.overallScore, 6);
});

/* ============================ Stickman limits ============================ */

Deno.test("stickman limits: 4 core calls and a predictive cost ceiling; legacy keeps 3 / $0.50", async () => {
  const { scriptBudgetGate } = await loadEngine();
  const stickman = (stage: string, modelCalls: number, cost: number) => ({ stage, script_document: { claims: [] }, meta: { modelCalls, estimatedTotalCostUsd: cost } });
  const legacy = (stage: string, modelCalls: number, cost: number) => ({ stage, script_document: { narrationSegments: [] }, meta: { modelCalls, estimatedTotalCostUsd: cost } });

  assertEquals(scriptBudgetGate(stickman("critic", 3, 0.45)), null, "re-critique (4th core call) allowed");
  assertEquals(scriptBudgetGate(stickman("critic", 4, 0.45))?.code, "MODEL_CALL_CAP_EXCEEDED");
  assertEquals(scriptBudgetGate(stickman("critic", 3, 0.60)), null, "$0.60 is fine under the $1.00 default");
  assertEquals(scriptBudgetGate(stickman("critic", 3, 0.95))?.code, "COST_CEILING_EXCEEDED", "0.95 + critic worst case > 1.00");
  assertEquals(scriptBudgetGate(stickman("finalizing", 9, 5)), null, "finalizing is never blocked");
  assertEquals(scriptBudgetGate(legacy("critic", 3, 0.1))?.code, "MODEL_CALL_CAP_EXCEEDED");
  assertEquals(scriptBudgetGate(legacy("critic", 1, 0.5))?.code, "COST_CEILING_EXCEEDED");
  assertEquals(scriptBudgetGate(legacy("critic", 1, 0.49)), null);
  // Per-run cap (Phase 1 FINAL: $0.70 total, set per run via env).
  assertEquals(scriptBudgetGate(stickman("critic", 2, 0.50), 0.62), null);
  assertEquals(scriptBudgetGate(stickman("revision", 2, 0.55), 0.62)?.code, "COST_CEILING_EXCEEDED");
});

Deno.test("cost ceiling fails the run before the stage that would breach it", async () => {
  const { row, stages, player } = await replay([], {
    scriptOverrides: { stage: "critic", script_document: { ...goodDraft(), claims: [] }, meta: { modelCalls: 1, estimatedTotalCostUsd: 0.95 } },
  });
  assertEquals(stages, ["critic"]);
  assertEquals(row.status, "failed");
  assertEquals(row.last_error_code, "COST_CEILING_EXCEEDED");
  assertEquals(player.calls.length, 0, "no model call made");
});

/* ============================ Draft-stage repairs ============================ */

Deno.test("<85% length: one repair naming the short sections, then the full draft is kept", async () => {
  const short = shortenEvidence(goodDraft(), roleByChapter, 0.45);
  const { row, player } = await replay([draftEntry(short), draftEntry(goodDraft())], { maxSteps: 1 });
  const drafts = player.calls.filter((c) => c.key === "stickman_script_draft");
  assertEquals(drafts.length, 2);
  const repairInput = String(drafts[1].request.messages[0].content);
  assertStringIncludes(repairInput, "draft_too_short");
  assertMatch(repairInput, /evidence\) has \d+ of its \d+ words/);
  assertEquals(row.meta.draftRepairReasons, ["draft_too_short"]);
  assertEquals(row.stage, "claim_verify");
  assert(row.script_document.actualWords > 1300, `kept the full repair draft (${row.script_document.actualWords})`);
});

Deno.test("<85% length never fails the run on its own: a still-short repair draft proceeds", async () => {
  const short = shortenEvidence(goodDraft(), roleByChapter, 0.45);
  const { row } = await replay([draftEntry(short), draftEntry(short)], { maxSteps: 1 });
  assertEquals(row.status, "drafting");
  assertEquals(row.stage, "claim_verify");
});

Deno.test("question cadence: the countable rule is in the draft prompt, and a question-free draft is repaired", async () => {
  const noQuestions = goodDraft();
  for (const s of noQuestions.narrationSegments) s.text = s.text.replace(/\?/g, ".");
  const { row, player } = await replay([draftEntry(noQuestions), draftEntry(goodDraft())], { maxSteps: 1 });
  const system = player.calls[0].request.system[0].text;
  assertStringIncludes(system, "EVERY evidence section contains at least 2 questions");
  assertStringIncludes(system, "count them before you finish");
  assert(row.meta.draftRepairReasons.includes("question_cadence_critical"));
});

Deno.test("stakes/core-question HARD check: a paragraph where a line belongs triggers the repair", async () => {
  const bloated = setSegmentText(goodDraft(), "seg_stakes", "Night wasn't empty time at all. It's where a huge share of human learning and bonding actually happened, around the fire, for thousands of years. A group that talked and worked by firelight had more hours to pass down what kept them alive.");
  const { row, player } = await replay([draftEntry(bloated), draftEntry(goodDraft())], { maxSteps: 1 });
  assert(row.meta.draftRepairReasons.includes("stakes_overrun"));
  assertStringIncludes(String(player.calls[1].request.messages[0].content), "stakes_overrun");
  assertEquals(seg(row.script_document, "seg_stakes").text, STAKES_LINE);
});

Deno.test("stakes/core-question check: unit thresholds", () => {
  const chapters = [{ chapterId: "st", role: "stakes" }, { chapterId: "cq", role: "core_question" }];
  const mk = (st: number, cq: number) => [{ id: "a", chapterId: "st", text: "w ".repeat(st) }, { id: "b", chapterId: "cq", text: "w ".repeat(cq) }];
  assertEquals(findStakesOrQuestionOverrun(mk(15, 25), chapters), []);
  assertEquals(findStakesOrQuestionOverrun(mk(25, 35), chapters), []);
  assertEquals(findStakesOrQuestionOverrun(mk(26, 10), chapters).map((i) => i.code), ["stakes_overrun"]);
  assertEquals(findStakesOrQuestionOverrun(mk(10, 36), chapters).map((i) => i.code), ["core_question_overrun"]);
});

/* ============================ Claim verification ============================ */

const UNDECLARED = "Archaeologist Maria Kowalski dated one of these hearths to forty-one thousand years ago using charcoal from its lowest layer.";

Deno.test("undeclared checkable claims are auto-extracted and verified", async () => {
  const draft = goodDraft();
  const s = seg(draft, "seg_hearths_2");
  s.text = `${s.text} ${UNDECLARED}`;
  const { row, player } = await replay([draftEntry(draft), ...verifyEntries(8)], { maxSteps: 2 });
  const verifyInputs = player.calls.filter((c) => c.key === "claim_verify").map((c) => String(c.request.input)).join("\n");
  assertStringIncludes(verifyInputs, "Maria Kowalski");
  const auto = row.script_document.claims.filter((c: any) => c.id.startsWith("auto_"));
  assert(auto.some((c: any) => c.sentence === UNDECLARED), "auto claim persisted onto the document");
  assert(row.intermediate.claimVerdicts.some((v: any) => v.claimId.startsWith("auto_")), "auto claim got a verdict");
  assert(row.intermediate.autoExtractedClaimCount >= 1);
});

Deno.test("auto-extraction ignores scene-setting roles and short rhetorical lines", () => {
  const found = findUndeclaredCheckableSentences(
    [{ id: "e", text: "That's your evening shift, sixty centuries early. The torch burned for sixty-one minutes before it went out in the cave." }],
    [],
  );
  assertEquals(found.map((f) => f.sentence), ["The torch burned for sixty-one minutes before it went out in the cave."]);
});

Deno.test("claim fix: unverifiable AUTO claims are left alone; a fix deleting >25% of a segment is rejected", async () => {
  const draft = goodDraft();
  const target = seg(draft, "seg_hearths_2");
  const originalText = target.text;
  target.text = `${originalText} ${UNDECLARED}`;
  const declared = draft.claims.find((c: any) => c.segmentId === "seg_hearths_2") ?? draft.claims[0];
  declared.sourceFactId = null;
  const overrides: Record<string, any> = { [declared.id]: { verdict: "unverifiable" }, auto_1: { verdict: "unverifiable" } };
  const gutted = { replacementSegments: [{ ...revisionPatch([{ id: declared.segmentId, text: "Only a stub remains." }]).replacementSegments[0] }] };
  const { row, player } = await replay([draftEntry(draft), ...verifyEntries(8, verifyResponder(overrides)), claimFixEntry(gutted)], { maxSteps: 3 });

  const fixCalls = player.calls.filter((c) => c.key === "claim_fix");
  assertEquals(fixCalls.length, 1);
  const input = String(fixCalls[0].request.input);
  const flaggedClaims = JSON.parse(input.slice(input.indexOf("FLAGGED CLAIMS FOR THESE SEGMENTS:") + 34, input.indexOf("NEIGHBORING SEGMENTS")).trim());
  assertEquals(flaggedClaims.length, 1, "only the declared claim is flagged");
  assert(!flaggedClaims.some((c: any) => c.sentence === UNDECLARED), "unverifiable auto claim must not be sent for softening");
  assertEquals(seg(row.script_document, declared.segmentId).text, seg(draft, declared.segmentId).text, "gutting fix rejected, original kept");
});

Deno.test("claim fix: a one-sentence correction of similar length is applied", async () => {
  const draft = goodDraft();
  const declared = draft.claims.find((c: any) => c.segmentId === "seg_hearths_2") ?? draft.claims[0];
  declared.sourceFactId = null;
  const before = seg(draft, declared.segmentId).text;
  const corrected = before.replace(/\.$/, ", a detail researchers later confirmed.");
  const overrides = { [declared.id]: { verdict: "corrected", correctedValue: "confirmed value" } };
  const { row } = await replay([draftEntry(draft), ...verifyEntries(8, verifyResponder(overrides)), claimFixEntry(revisionPatch([{ id: declared.segmentId, text: corrected }]))], { maxSteps: 3 });
  assertEquals(seg(row.script_document, declared.segmentId).text, corrected);
  assert(words(corrected) >= words(before));
});

/* ============================ Revision rollback ============================ */

Deno.test("revision: a HARD failure in one segment rolls back only that segment", async () => {
  const bloatedStakes = "Night wasn't empty time at all. It's where a huge share of human learning and bonding actually happened, around the fire, for thousands of years, and you still carry that.";
  const betterCallback = `${callbackText()} You still do the same thing every time you reach for a lamp.`;
  const { row, stages } = await replay([
    draftEntry(goodDraft()),
    ...verifyEntries(8),
    criticEntry(failingCritic(["seg_stakes", "seg_callback"])),
    revisionEntry(revisionPatch([{ id: "seg_stakes", text: bloatedStakes }, { id: "seg_callback", text: betterCallback }])),
    criticEntry(passingCritic()),
  ]);
  assertEquals(stages.slice(-5), ["revision", "claim_verify", "claim_fix", "critic", "finalizing"], "revision kept -> verify -> re-critique");
  assertEquals(row.intermediate.revisionRolledBackSegmentIds, ["seg_stakes"]);
  assertEquals(seg(row.script_document, "seg_stakes").text, STAKES_LINE);
  assertEquals(seg(row.script_document, "seg_callback").text, betterCallback, "the valid part of the revision survived");
  assertEquals(row.status, "ready");
});

/* ============================ Cassette record -> replay round trip ============================ */

Deno.test("recorder captures model calls (not Supabase traffic) and the player replays them", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("anthropic")) return new Response(JSON.stringify({ ok: "anthropic" }), { status: 200 });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    const rec = installCassetteRecorder(["db.example.test"]);
    rec.setStage("critic");
    await fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: JSON.stringify({ tool_choice: { name: "stickman_script_critic" } }) });
    await fetch("https://db.example.test/rest/v1/x", { method: "PATCH", body: "{}" });
    const entries = rec.drain();
    assertEquals(entries.map((e) => `${e.stage}/${e.kind}/${e.key}`), ["critic/anthropic/stickman_script_critic"]);

    const player = installCassettePlayer(entries);
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: JSON.stringify({ tool_choice: { name: "stickman_script_critic" } }) });
    assertEquals(await res.json(), { ok: "anthropic" });
    player.restore();
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* ============================ Write-first revision (run-1 root cause) ============================ */

const TWIST_NEW = "Historian Roger Ekirch found more than five hundred references to a first and second sleep in diaries, court records and medical books written before electric light.";

Deno.test("revision prompt is write-first and its schema requires declared claims", async () => {
  const { player } = await replay([
    draftEntry(goodDraft()),
    ...verifyEntries(8),
    criticEntry(failingCritic()),
    revisionEntry(revisionPatch([{ id: "seg_callback", text: callbackText() }])),
    criticEntry(passingCritic()),
  ]);
  const rev = player.calls.find((c) => c.key === "script_revision")!;
  const system = rev.request.system[0].text;
  assertStringIncludes(system, "WRITE-FIRST, VERIFIED AFTER");
  assert(!system.includes("never invent a claim that isn't supported by one of the provided facts"), "old evidence-first rule removed");
  assert(rev.request.tools[0].input_schema.required.includes("claims"));
});

Deno.test("revision claims are verified (only the NEW ones) and corrected before the re-critique", async () => {
  const draft = goodDraft();
  const twist = seg(draft, "seg_twist");
  const newTwist = `${TWIST_NEW} ${twist.text.split(/(?<=[.!?])\s+/).slice(1).join(" ")}`;
  const patch = {
    ...revisionPatch([{ id: "seg_twist", text: newTwist }]),
    claims: [{ id: "x1", claim: "Ekirch found 500+ references to segmented sleep", sentence: TWIST_NEW, segmentId: "seg_twist", sourceFactId: null }],
  };
  const correctedSentence = TWIST_NEW.replace("more than five hundred", "several hundred");
  const verifyAll = verifyResponder({ rev_1: { verdict: "corrected", correctedValue: "several hundred references" } });
  const { row, stages, player } = await replay([
    draftEntry(draft),
    ...verifyEntries(8, verifyAll),
    criticEntry(failingCritic(["seg_twist"])),
    revisionEntry(patch),
    claimFixEntry(revisionPatch([{ id: "seg_twist", text: newTwist.replace(TWIST_NEW, correctedSentence) }])),
    criticEntry(passingCritic()),
  ]);
  assertEquals(stages, ["draft", "claim_verify", "claim_fix", "critic", "revision", "claim_verify", "claim_fix", "critic", "finalizing"]);

  const verifyCalls = player.calls.filter((c) => c.key === "claim_verify");
  const draftVerifyCount = verifyCalls.findIndex((c) => String(c.request.input).includes('"rev_1"'));
  assert(draftVerifyCount > 0, "a post-revision verify batch ran");
  const postRevisionInputs = verifyCalls.slice(draftVerifyCount).map((c) => String(c.request.input)).join("\n");
  assert(!/"claimId":\s*"c\d+"/.test(postRevisionInputs), "draft claims are NOT re-verified");

  assert(row.intermediate.claimVerdicts.some((v: any) => v.claimId === "rev_1" && v.verdict === "corrected"));
  assert(row.intermediate.claimVerdicts.some((v: any) => /^c\d+$/.test(v.claimId)), "draft verdicts carried forward");
  const fixCalls = player.calls.filter((c) => c.key === "claim_fix");
  assertEquals(fixCalls.length, 1, "draft claims were all supported; only the revision's corrected claim is fixed");
  assertStringIncludes(String(fixCalls[0].request.input), "several hundred references");
  assertStringIncludes(seg(row.script_document, "seg_twist").text, "several hundred");
  assertEquals(row.status, "ready");
});

Deno.test("recorded run 1, replayed with the fix: the revision's changed sentences are now verified", async () => {
  const dir = new URL("../fixtures/stickman/replay/", import.meta.url);
  let fixture: any = null;
  // Run 1 (recorded before the write-first revision fix).
  fixture = JSON.parse(await Deno.readTextFile(new URL("accept-ancient-humans-1790449851776.json", dir)));
  assert(fixture, "run-1 snapshot present");
  const files = [...fixture.cassettes].sort((a: any, b: any) => String(a.recordedAt).localeCompare(String(b.recordedAt)));
  let n = 0;
  const recorded = files.flatMap((file: any) => file.entries.map((e: any) => ({ ...e, seq: n++ })));
  // The recording has no post-revision verify (the old code skipped it) — stub those answers.
  const player = playCassette([...recorded, ...verifyEntries(4)]);
  const { db, scriptId } = seedDb({ project: fixture.project, storyPlanVersion: fixture.storyPlanVersion, researchVersion: fixture.researchVersion, profile: fixture.profile });
  try {
    const { row, stages } = await runPipeline(db, scriptId);
    assertEquals(stages, ["draft", "claim_verify", "claim_fix", "critic", "revision", "claim_verify", "claim_fix", "critic", "finalizing"]);
    const revised = new Set<string>(row.intermediate.revisedSegmentIds);
    assert(revised.size >= 3, `recorded revision changed ${revised.size} segments`);
    const postRevisionClaims = row.script_document.claims.filter((c: any) => String(c.id).startsWith("auto_rev_"));
    assert(postRevisionClaims.length >= 1, "the revision's new specific sentences became claims");
    assert(postRevisionClaims.every((c: any) => revised.has(c.segmentId)), "only revised segments are re-checked");
    assert(postRevisionClaims.every((c: any) => row.intermediate.claimVerdicts.some((v: any) => v.claimId === c.id)), "each got a verdict");
    console.log("post-revision claims:", postRevisionClaims.map((c: any) => `${c.segmentId}: ${c.sentence.slice(0, 80)}`).join(" | "));
  } finally {
    player.restore();
  }
});
