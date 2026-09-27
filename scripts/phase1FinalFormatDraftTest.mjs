// Phase 1 FINAL, Section 5e — draft-only format tests (chosen model, no
// research, verification/critic off via DRAFT_ONLY_TEST_MODE). Fresh Story
// Plan (real, cheap gpt-5-mini cost) + an EMPTY research version (Script's
// draft stage already treats thin/empty research as a best-effort helper,
// never a gate — see start-long-form-script's own comment), then Draft only.
// I (Claude Code) read and score the narration myself against the rubric —
// this script just runs the pipeline and prints everything needed to judge.
import { createTestUser, callFn, pollUntilTerminal, admin, VOICE } from "./phase1cLib.mjs";

const NICHE_TOPICS = {
  myth_vs_reality: "Did Vikings really wear horned helmets?",
  you_vs_x: "How would you fare against a chimpanzee in a fight?",
  timeline_history: "How did a single assassination lead to a world war?",
};

const nicheArg = process.argv[2];
if (!nicheArg || !NICHE_TOPICS[nicheArg]) {
  console.error(`Usage: node scripts/phase1FinalFormatDraftTest.mjs <${Object.keys(NICHE_TOPICS).join("|")}>`);
  process.exit(1);
}
const topic = NICHE_TOPICS[nicheArg];

async function main() {
  console.log(`=== Format draft: ${nicheArg} — "${topic}" ===`);
  const { userId, accessToken } = await createTestUser(`phase1final-format-${nicheArg}`);
  const wallStart = Date.now();

  const { data: session } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  const project = await callFn("create-long-form-project", accessToken, {
    discoverySessionId: session.id, topic, source: "custom", selectedIdea: null,
    lengthMode: "custom", customLengthMinutes: 10, depthMode: "custom", customExplanationDepth: "balanced",
    onScreenTextDensity: "balanced", initialStatus: "draft",
  });
  const projectId = project.id;

  await callFn("create-long-form-production-setup", accessToken, {
    projectId, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
    renderTier: "v2", targetDurationMinutes: 10, explanationDepth: "balanced",
    voiceProvider: "elevenlabs", voiceId: VOICE.voiceId, voiceModel: VOICE.voiceModel, niche: nicheArg,
  });

  const tStory = Date.now();
  const storyPlanResult = await callFn("generate-long-form-story-plan", accessToken, { projectId });
  const storyPlan = storyPlanResult.storyPlan;
  const storyMs = Date.now() - tStory;
  console.log(`\nstory plan ready — "${storyPlan.recommendedTitle}" (${(storyMs / 1000).toFixed(1)}s)\n`);

  console.log("=== CANDIDATE ANGLES ===");
  for (const a of storyPlan.candidateAngles ?? []) {
    console.log(`[${a.selected ? "SELECTED" : "        "}]${a.isTwistOrPayoffAngle ? " [TWIST/PAYOFF]" : ""} surprise=${a.surpriseScore} relatability=${a.relatabilityScore} visual=${a.visualPotentialScore} payoff=${a.payoffScore} — ${a.angle}`);
  }
  console.log("\n=== BEAT SHEET ===");
  let sumWords = 0;
  for (const c of storyPlan.chapters ?? []) {
    sumWords += c.targetWords ?? 0;
    console.log(`- [${c.role}] ${c.title} — ${c.targetWords} words${c.subQuestion ? ` — subQ: ${c.subQuestion}` : ""}`);
  }
  console.log(`Sum of section targetWords: ${sumWords} (video target: ${storyPlanResult.project?.target_words ?? "?"})`);

  const { data: freshProject } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();

  // "No research" — an empty, valid research version so start-long-form-script
  // proceeds; the draft stage's own fallback ("no facts found — write the
  // full script entirely from your own knowledge") is exactly what Section
  // 5e asks for.
  const { data: researchVersion, error: rvErr } = await admin
    .from("long_form_research_versions")
    .insert({
      project_id: projectId, story_plan_version_id: freshProject.current_story_plan_version_id, version: 1,
      status: "ready", stage: "finalizing",
      research_plan: { questions: [] }, fact_graph: { facts: [] }, coverage: {},
      meta: {}, detail: {}, research_started_at: new Date().toISOString(), research_completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (rvErr) throw new Error(`research version insert failed: ${rvErr.message}`);
  await admin.from("long_form_projects").update({ current_research_version_id: researchVersion.id }).eq("id", projectId);

  const tScript = Date.now();
  const scriptStart = await callFn("start-long-form-script", accessToken, { projectId });
  const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 6 * 60 * 1000, intervalMs: 5000, label: "script(draft-only)" });
  const scriptMs = Date.now() - tScript;
  const wallMs = Date.now() - wallStart;

  const doc = scriptRow.script_document;
  console.log(`\n=== RESULT ===`);
  console.log("status:", scriptRow.status, "| last_error_code:", scriptRow.last_error_code);
  console.log("generation_model:", scriptRow.generation_model);
  console.log("words:", doc?.actualWords, "/ target:", freshProject.target_words, `(${doc?.actualWords && freshProject.target_words ? Math.round((doc.actualWords / freshProject.target_words) * 100) : "?"}%)`);
  console.log("cost: story~$0.02 + draft $" + (scriptRow.meta?.estimatedTotalCostUsd ?? 0).toFixed(4), "| wall-clock:", (wallMs / 1000).toFixed(1) + "s", `(story ${(storyMs / 1000).toFixed(1)}s + draft ${(scriptMs / 1000).toFixed(1)}s)`);

  // DRAFT_ONLY_TEST_MODE stops right after a VALID draft (validateWithStickmanExtras
  // already ran with zero HARD errors, or it would have failed before reaching
  // here) — checkResults/plantQuote/payoffQuote are only computed later at final
  // validation, so they don't exist yet on this document. Draft-time warnings
  // (non-blocking) are on the row's intermediate, not the document.
  console.log("\ndraft warnings (non-blocking):", JSON.stringify(scriptRow.intermediate?.draftWarnings ?? [], null, 2));
  console.log("callbackKey:", JSON.stringify(doc?.callbackKey), "plantSegmentIndex:", doc?.plantSegmentIndex, "payoffSegmentIndex:", doc?.payoffSegmentIndex);

  console.log("\n=== FULL NARRATION ===\n");
  const bySection = new Map();
  for (const seg of doc?.narrationSegments ?? []) {
    if (!bySection.has(seg.chapterId)) bySection.set(seg.chapterId, []);
    bySection.get(seg.chapterId).push(seg);
  }
  for (const c of doc?.chapters ?? []) {
    const segs = (bySection.get(c.chapterId) ?? []).sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    console.log(`--- ${c.title} (${c.role ?? "?"}) ---`);
    for (const s of segs) console.log(s.text);
    console.log("");
  }

  console.log("projectId (kept, not deleted):", projectId, "| scriptVersionId:", scriptRow.id);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
