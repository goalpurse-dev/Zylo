// Phase 1g, Section 5 — model A/B. Generates ONE fresh Story Plan + reuses
// the saved research-lite fixture (as helper facts), then runs Script
// TWICE against the SAME project/story-plan/research: once for whichever
// model config is currently active (pass "A" or "B" as the run label —
// the caller is responsible for setting/unsetting the
// LONG_FORM_STICKMAN_{DRAFT,REVISION,CRITIC}_MODEL secrets between runs).
// Usage: node scripts/phase1gABTest.mjs <slug> <A|B> [projectId]
// First call (A) creates the project and prints its id; pass that id as
// the 3rd arg for the B call so both runs share the same Story Plan.
import { createTestUser, loadFixture, callFn, pollUntilTerminal, admin, VOICE } from "./phase1cLib.mjs";

const slug = process.argv[2] ?? "why-don-t-we-eat-lions";
const runLabel = process.argv[3] ?? "A";
const existingProjectId = process.argv[4];

async function main() {
  const fixture = await loadFixture(slug);
  const testCase = { title: fixture.project.topic, niche: "why_dont_we_eat_x", minutes: fixture.project.resolved_length_minutes };

  let projectId = existingProjectId;
  let storyPlan;
  let accessToken;

  if (!projectId) {
    console.log(`=== RUN ${runLabel}: fresh Story Plan for "${testCase.title}" ===`);
    const created = await createTestUser("phase1g-ab-test");
    accessToken = created.accessToken;
    const { data: session } = await admin.from("long_form_discovery_sessions").insert({ user_id: created.userId }).select("id").single();
    const project = await callFn("create-long-form-project", accessToken, {
      discoverySessionId: session.id, topic: testCase.title, source: "custom", selectedIdea: null,
      lengthMode: "custom", customLengthMinutes: testCase.minutes, depthMode: "custom", customExplanationDepth: "balanced",
      onScreenTextDensity: "balanced", initialStatus: "draft",
    });
    projectId = project.id;
    await callFn("create-long-form-production-setup", accessToken, {
      projectId, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
      renderTier: "v2", targetDurationMinutes: testCase.minutes, explanationDepth: "balanced",
      voiceProvider: "elevenlabs", voiceId: VOICE.voiceId, voiceModel: VOICE.voiceModel, niche: testCase.niche,
    });
    const storyPlanResult = await callFn("generate-long-form-story-plan", accessToken, { projectId });
    storyPlan = storyPlanResult.storyPlan;
    console.log(`story plan ready — "${storyPlan.recommendedTitle}"\n`);

    const { data: freshProject } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
    const newEvidenceChapterIds = (storyPlan.chapters ?? []).filter((c) => c.role === "evidence").map((c) => c.id);
    const remappedFacts = (fixture.research.fact_graph?.facts ?? []).map((f) => ({ ...f, chapterIds: newEvidenceChapterIds }));
    const remappedFactGraph = { ...fixture.research.fact_graph, facts: remappedFacts };
    const { data: researchVersion, error: rvErr } = await admin
      .from("long_form_research_versions")
      .insert({
        project_id: projectId, story_plan_version_id: freshProject.current_story_plan_version_id, version: 1,
        status: fixture.research.status, stage: "finalizing",
        research_plan: fixture.research.research_plan, fact_graph: remappedFactGraph, coverage: fixture.research.coverage,
        meta: fixture.research.meta, detail: fixture.research.detail, research_started_at: new Date().toISOString(), research_completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (rvErr) throw new Error(`research version insert failed: ${rvErr.message}`);
    await admin.from("long_form_projects").update({ current_research_version_id: researchVersion.id }).eq("id", projectId);

    console.log("=== BEAT SHEET ===");
    for (const c of storyPlan.chapters ?? []) console.log(`- [${c.role}] ${c.title} — ${c.targetWords} words`);
    console.log("");

    // Need a fresh access token tied to this SAME project's owning user for
    // run B later (a new process invocation won't have the closure'd
    // accessToken) — store it in the project row's own scratch space isn't
    // available, so print it for the caller to reuse, and also persist via
    // a throwaway file the orchestrating shell command can source.
    await admin.from("long_form_projects").update({}).eq("id", projectId); // no-op, just confirms row exists
    console.log("PROJECT_ID=" + projectId);
    console.log("ACCESS_TOKEN=" + accessToken);
  } else {
    console.log(`=== RUN ${runLabel}: reusing project ${projectId} ===`);
    accessToken = process.env.PHASE1G_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Set PHASE1G_ACCESS_TOKEN env var to the access token printed by run A");
  }

  const wallStart = Date.now();
  const scriptStart = await callFn("start-long-form-script", accessToken, { projectId, regenerate: Boolean(existingProjectId) });
  const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 5000, label: `script(${runLabel})` });
  const wallMs = Date.now() - wallStart;

  const { data: project } = await admin.from("long_form_projects").select("target_words").eq("id", projectId).maybeSingle();
  const doc = scriptRow.script_document;
  const { data: fullRow } = await admin.from("long_form_script_versions").select("critic_result, script_document, meta, last_error_code, detail").eq("id", scriptRow.id).maybeSingle();

  console.log(`\n=== RUN ${runLabel} RESULT ===`);
  console.log("status:", scriptRow.status, scriptRow.status === "failed" ? `(${fullRow.last_error_code})` : "");
  if (scriptRow.status === "failed") console.log("detail:", JSON.stringify(fullRow.detail, null, 2));
  console.log("words:", doc?.actualWords, "/ target:", project.target_words, `(${doc?.actualWords && project.target_words ? Math.round((doc.actualWords / project.target_words) * 100) : "?"}%)`);
  console.log("cost by stage:", JSON.stringify((fullRow.meta?.callLedger ?? []).map((e) => ({ stage: e.stage, model: e.model, cost: e.estimatedCostUsd }))));
  console.log("total cost: $" + (fullRow.meta?.estimatedTotalCostUsd ?? 0).toFixed(4), "| wall-clock:", (wallMs / 1000).toFixed(1) + "s");
  console.log("critic scores:", JSON.stringify(fullRow.critic_result?.scores), "overall:", fullRow.critic_result?.overallScore, "verdict:", fullRow.critic_result?.overallVerdict);
  console.log("weakestSections:", JSON.stringify(fullRow.critic_result?.weakestSections, null, 2));
  console.log("HARD failures:", JSON.stringify(doc?.checkResults?.hard ?? [], null, 2));
  console.log("WARN count:", doc?.checkResults?.warn?.length, JSON.stringify(doc?.checkResults?.warn ?? [], null, 2));
  console.log("researchWarnings:", JSON.stringify(doc?.researchWarnings ?? [], null, 2));
  console.log("plantQuote:", JSON.stringify(doc?.plantQuote), "payoffQuote:", JSON.stringify(doc?.payoffQuote));

  console.log(`\n=== RUN ${runLabel} FULL NARRATION ===\n`);
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

  console.log(`projectId (kept, not deleted): ${projectId} | scriptVersionId: ${scriptRow.id}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
