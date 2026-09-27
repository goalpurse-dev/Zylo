// deno-lint-ignore-file no-explicit-any
// Phase 1 close-out — offline proof for: visual fields dropped from the
// Stickman draft (+ output-size drop), the paid-call checkpoint (a killed
// call is logged and failed, never silently re-run), callback-as-reference,
// READY at critic >= 6.5 with stored score history, the hedging WARN,
// method jargon, and the reference-script guard. Zero API spend.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { seedDb, runPipeline, playCassette } from "./harness.ts";
import { entry, anthropicToolResponse } from "../../supabase/functions/_shared/stickman/cassette.ts";
import { snapshot, goodDraft, verifyEntries, criticEntry, failingCritic, passingCritic, revisionEntry, revisionPatch, draftEntry } from "./fixtures.ts";
import { checkCallback, findHedgingOveruse, findJargonDensity } from "../../supabase/functions/_shared/stickman/scriptChecks.ts";

const VISUAL_FIELDS = ["visualIntent", "mustShow", "mustNotShow", "entities", "locationHint", "continuityEntityIds", "exactTextOverlay", "preferredVisualForm"];
const stripVisual = (seg: any) => Object.fromEntries(Object.entries(seg).filter(([k]) => !VISUAL_FIELDS.includes(k)));
const seg = (doc: any, id: string) => doc.narrationSegments.find((s: any) => s.id === id);
const callbackText = () => seg(goodDraft(), "seg_callback").text;

async function replay(entries: any[], opts: { maxSteps?: number; snapshotOverride?: any } = {}) {
  const player = playCassette(entries);
  const { db, scriptId } = seedDb(opts.snapshotOverride ?? snapshot);
  try {
    return { ...(await runPipeline(db, scriptId, opts.maxSteps ?? 20)), player, db };
  } finally {
    player.restore();
  }
}

async function recordedDraftInput() {
  const dir = new URL("../fixtures/stickman/replay/", import.meta.url);
  const names: string[] = [];
  for await (const f of Deno.readDir(dir)) if (f.name.startsWith("accept-ancient-humans-")) names.push(f.name);
  const fixture = JSON.parse(await Deno.readTextFile(new URL(names.sort().at(-1)!, dir)));
  const draftEntryRec = fixture.cassettes.find((c: any) => c.stage === "draft").entries.find((e: any) => e.kind === "anthropic");
  return { input: draftEntryRec.response.content.find((b: any) => b.type === "tool_use").input, outputTokens: draftEntryRec.response.usage.output_tokens };
}

/* ============================ 1. Draft output size ============================ */

Deno.test("draft: schema no longer asks for visual fields; segments get empty defaults; output shrinks", async () => {
  const draft = goodDraft();
  draft.narrationSegments = draft.narrationSegments.map(stripVisual);
  const { row, player } = await replay([draftEntry(draft)], { maxSteps: 1 });

  const segSchema = player.calls[0].request.tools[0].input_schema.properties.narrationSegments.items;
  for (const f of VISUAL_FIELDS) {
    assert(!(f in segSchema.properties), `schema still has ${f}`);
    assert(!segSchema.required.includes(f), `schema still requires ${f}`);
  }
  assert(!player.calls[0].request.system[0].text.includes("VISUAL METADATA"), "prompt no longer asks for visual metadata");
  const s0 = row.script_document.narrationSegments[0];
  assertEquals([s0.visualIntent, s0.mustShow, s0.entities, s0.locationHint, s0.exactTextOverlay, s0.preferredVisualForm], ["", [], [], "", null, null]);

  // Size drop measured on the REAL recorded Sonnet 5 draft (final Ancient Humans attempt).
  const { input, outputTokens } = await recordedDraftInput();
  const before = JSON.stringify(input).length;
  const after = JSON.stringify({ ...input, narrationSegments: input.narrationSegments.map(stripVisual) }).length;
  const drop = 1 - after / before;
  console.log(`recorded draft tool output: ${before} -> ${after} chars (-${Math.round(drop * 100)}%), ~${outputTokens} -> ~${Math.round(outputTokens * (after / before))} output tokens`);
  assert(drop > 0.25, `expected >25% smaller draft output, got ${Math.round(drop * 100)}%`);
});

/* ============================ 1b. Paid-call checkpoint ============================ */

Deno.test("a draft call killed mid-flight is logged and failed on the next claim — never re-run and paid twice", async () => {
  const { db, scriptId } = seedDb(snapshot);
  // The first draft call "kills the process": from here on, no write lands.
  const killed = { ...entry(0, "draft", "anthropic", "stickman_script_draft", null), response: (() => { db.frozen = true; throw new Error("process killed"); }) as any };
  const player = playCassette([killed, draftEntry(goodDraft())]);
  try {
    await runPipeline(db, scriptId, 1);
    db.frozen = false; // the platform restarts; the recovery sweep reclaims the row
    const { row, stages } = await runPipeline(db, scriptId, 5);
    assertEquals(stages, ["draft"]);
    assertEquals(row.status, "failed");
    assertEquals(row.last_error_code, "STAGE_CALL_INTERRUPTED");
    assertEquals(row.intermediate.interruptedCall.stage, "draft");
    assertEquals(player.calls.filter((c) => c.key === "stickman_script_draft").length, 1, "exactly one paid draft call");
  } finally {
    player.restore();
  }
});

Deno.test("a draft call that fails normally (error, not a kill) is still retried — no false interruption", async () => {
  const failed = entry(0, "draft", "anthropic", "stickman_script_draft", { type: "error", error: { type: "overloaded_error", message: "overloaded" } }, 529);
  const { row, player } = await replay([failed, draftEntry(goodDraft())], { maxSteps: 2 });
  assertEquals(player.calls.filter((c) => c.key === "stickman_script_draft").length, 2);
  assertEquals(row.stage, "claim_verify");
  assert(row.last_error_code !== "STAGE_CALL_INTERRUPTED");
});

Deno.test("a stage lease outlives the longest stage (no reclaim of a live invocation)", async () => {
  const { db, scriptId } = seedDb(snapshot);
  const hold = { ...entry(0, "draft", "anthropic", "stickman_script_draft", null), response: (() => {
    const lock = db.get("long_form_script_versions", scriptId).worker_lock_until;
    assert(new Date(lock).getTime() - Date.now() > 6 * 60_000, "lease set to >6 min before the paid call");
    return anthropicToolResponse("stickman_script_draft", goodDraft());
  }) as any };
  const player = playCassette([hold]);
  try {
    await runPipeline(db, scriptId, 1);
  } finally {
    player.restore();
  }
});

/* ============================ 2. Callback = reference, not repeat ============================ */

Deno.test("callback: the payoff passes with a shared key noun; no reference still warns", () => {
  const segments = [
    { id: "a", text: "You pull your hand back. Soot on your finger, already drying." },
    { id: "b", text: "Go back to that soot. It never said what time it was made." },
    { id: "c", text: "Night was never empty. It was built." },
  ];
  assertEquals(checkCallback(segments, 0, 1, "soot on your finger"), []);
  assertEquals(checkCallback(segments, 0, 2, "soot on your finger").map((i) => i.code), ["callback_payoff_not_found"]);
});

Deno.test("callback: a critic-confirmed callback clears the deterministic callback warnings", async () => {
  const draft = goodDraft();
  draft.callbackKey = "a phrase that appears nowhere";
  const run = async (confirmed: boolean) =>
    (await replay([draftEntry(draft), ...verifyEntries(8), criticEntry({ ...passingCritic(), callbackConfirmed: confirmed })])).row;
  const confirmed = await run(true);
  const unconfirmed = await run(false);
  assert(!confirmed.script_document.checkResults.warn.some((w: any) => w.code.startsWith("callback_")));
  assert(unconfirmed.script_document.checkResults.warn.some((w: any) => w.code.startsWith("callback_")));
  assertEquals(confirmed.script_document.qualitySummary.callbackConfirmedByCritic, true);
});

Deno.test("prompts: critic is told a callback reference is not a recap; revision keeps the key noun, not the phrase", async () => {
  const { player } = await replay([
    draftEntry(goodDraft()),
    ...verifyEntries(8),
    criticEntry(failingCritic(["seg_callback"])),
    revisionEntry(revisionPatch([{ id: "seg_callback", text: callbackText() }])),
    criticEntry(passingCritic()),
  ]);
  const critic = player.calls.find((c) => c.key === "stickman_script_critic")!;
  assertStringIncludes(critic.request.system[0].text, "A CALLBACK REFERENCE IS NOT A RECAP");
  assert(critic.request.tools[0].input_schema.required.includes("callbackConfirmed"));
  const revision = player.calls.find((c) => c.key === "script_revision")!;
  assert(!revision.request.system[0].text.includes("preserve the given callbackKey phrase verbatim"));
  assert(!String(revision.request.messages[0].content).includes("must still appear verbatim"));
});

/* ============================ 3. READY at critic >= 6.5, scores stored ============================ */

Deno.test("READY: a re-critique of 6.5 ships; both critic passes are stored", async () => {
  const { row } = await replay([
    draftEntry(goodDraft()),
    ...verifyEntries(8),
    criticEntry(failingCritic()),
    revisionEntry(revisionPatch([{ id: "seg_callback", text: callbackText() }])),
    criticEntry({ ...passingCritic(), overallScore: 6.5 }),
  ]);
  assertEquals(row.status, "ready");
  assertEquals(row.script_document.qualitySummary.criticScoreHistory.map((c: any) => c.overallScore), [6, 6.5]);
});

Deno.test("READY: a final critic of 6 is still needs_attention, with the 6.5 bar in the reason", async () => {
  const { row } = await replay([
    draftEntry(goodDraft()),
    ...verifyEntries(8),
    criticEntry(failingCritic()),
    revisionEntry(revisionPatch([{ id: "seg_callback", text: callbackText() }])),
    criticEntry(failingCritic()),
  ]);
  assertEquals(row.status, "needs_attention");
  assert(row.script_document.researchWarnings.some((w: string) => w.includes("needs 6.5+ to ship")));
});

/* ============================ 4. Prompt tweaks ============================ */

Deno.test("hedging: more than 2 caution sentences is a WARN; 2 is fine", () => {
  const two = [{ id: "a", text: "A caution here, because it matters. Honestly, no, nobody has found one. The fire burned for hours." }];
  const three = [{ id: "a", text: `${two[0].text} It's worth admitting the record is thin.` }];
  assertEquals(findHedgingOveruse(two), []);
  assertEquals(findHedgingOveruse(three).map((i) => i.code), ["hedging_overuse"]);
});

Deno.test("method jargon is flagged unless translated in the same sentence", () => {
  const issues = findJargonDensity([{ id: "a", text: "Researchers pulled lipid residue and phytolith traces out of the hearth." }]);
  assert(issues.length >= 1, "untranslated method jargon flagged");
});

Deno.test("draft prompt: hedging cap and findings-not-methods rules are present", async () => {
  const { player } = await replay([draftEntry(goodDraft())], { maxSteps: 1 });
  const system = player.calls[0].request.system[0].text;
  assertStringIncludes(system, "at most 2 hedging/caution sentences");
  assertStringIncludes(system, "FINDINGS, NOT METHODS");
});

Deno.test("reference guard: a topic overlapping the gold example gets the Lions Run B exemplar instead", async () => {
  const LIONS_FIRST_LINE = "You stand beside a pickup truck at dawn";
  const GOLD_FIRST_LINE = "You're lying on packed dirt with your back against a cold rock";

  const overlapping = await replay([draftEntry(goodDraft())], { maxSteps: 1 });
  const overlapSystem = overlapping.player.calls[0].request.system[0].text;
  assertStringIncludes(overlapSystem, LIONS_FIRST_LINE);
  assert(!overlapSystem.includes(GOLD_FIRST_LINE));

  const neutral = structuredClone(snapshot);
  Object.assign(neutral.storyPlanVersion.story_plan, { recommendedTitle: "Why Is Your Phone So Hard to Put Down?", viewerPromise: "How apps keep you scrolling.", hookConcept: "Your thumb moves before you decide." });
  const other = await replay([draftEntry(goodDraft())], { maxSteps: 1, snapshotOverride: neutral });
  const otherSystem = other.player.calls[0].request.system[0].text;
  assertStringIncludes(otherSystem, GOLD_FIRST_LINE);
  assert(!otherSystem.includes(LIONS_FIRST_LINE));
});
