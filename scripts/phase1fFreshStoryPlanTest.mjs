// Phase 1f, Section 5 — generate a REAL, fresh Story Plan (so angle
// selection + the beat sheet's word budgets actually run), then feed it the
// EXISTING saved research-lite fixture as helper facts (zero new research
// spend — research-lite is a helper now, never re-run for this test).
import { createTestUser, loadFixture, callFn, pollUntilTerminal, admin, VOICE } from "./phase1cLib.mjs";

const slug = process.argv[2] ?? "why-don-t-we-eat-lions";

async function main() {
  const fixture = await loadFixture(slug);
  const testCase = { title: fixture.project.topic, niche: "why_dont_we_eat_x", minutes: fixture.project.resolved_length_minutes };
  console.log(`=== Fresh Story Plan for "${testCase.title}" (research-lite fixture reused as helper facts, ${fixture.research.fact_graph?.facts?.length ?? 0} facts) ===`);

  const { userId, accessToken } = await createTestUser("phase1f-fresh-storyplan");
  const wallStart = Date.now();

  const { data: session } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  const project = await callFn("create-long-form-project", accessToken, {
    discoverySessionId: session.id, topic: testCase.title, source: "custom", selectedIdea: null,
    lengthMode: "custom", customLengthMinutes: testCase.minutes, depthMode: "custom", customExplanationDepth: "balanced",
    onScreenTextDensity: "balanced", initialStatus: "draft",
  });
  const projectId = project.id;

  await callFn("create-long-form-production-setup", accessToken, {
    projectId, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
    renderTier: "v2", targetDurationMinutes: testCase.minutes, explanationDepth: "balanced",
    voiceProvider: "elevenlabs", voiceId: VOICE.voiceId, voiceModel: VOICE.voiceModel, niche: testCase.niche,
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
    for (const p of c.picturableMoments ?? []) console.log(`    * ${p}`);
  }
  console.log(`\nSum of section targetWords: ${sumWords} (video target: ${project.target_words ?? "?"})`);

  const { data: freshProject } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();

  // Reuse the fixture's research-lite output as helper facts — no new
  // research spend. The fixture's facts carry chapterIds from the OLD
  // story plan (before angle selection existed); the fresh plan has an
  // entirely different chapter structure (new angles chose different
  // sub-questions), so those old chapterIds don't match anything here and
  // the facts would otherwise be silently orphaned (0 usable facts on
  // every new chapter). Remap them onto every new "evidence" chapter so
  // this test actually exercises "helper facts get used," rather than
  // testing angle-selection with zero facts available by accident.
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

  const tScript = Date.now();
  const scriptStart = await callFn("start-long-form-script", accessToken, { projectId });
  const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 5000, label: "script" });
  const scriptMs = Date.now() - tScript;
  const wallMs = Date.now() - wallStart;

  const doc = scriptRow.script_document;
  console.log(`\n=== RESULT ===`);
  console.log("status:", scriptRow.status);
  console.log("words:", doc?.actualWords, "/ target:", freshProject.target_words, `(${doc?.actualWords && freshProject.target_words ? Math.round((doc.actualWords / freshProject.target_words) * 100) : "?"}%)`);
  console.log("cost: story~$0.015 + script $" + (scriptRow.meta?.estimatedTotalCostUsd ?? 0).toFixed(4), "| wall-clock:", (wallMs / 1000).toFixed(1) + "s", `(story ${(storyMs / 1000).toFixed(1)}s + script ${(scriptMs / 1000).toFixed(1)}s)`);
  console.log("modelCalls:", scriptRow.meta?.claimVerifyCalls, "claimFixCalls:", scriptRow.meta?.claimFixCalls);

  const { data: fullRow } = await admin.from("long_form_script_versions").select("critic_result, script_document").eq("id", scriptRow.id).maybeSingle();
  console.log("\ncritic scores:", JSON.stringify(fullRow.critic_result?.scores));
  console.log("critic overallScore:", fullRow.critic_result?.overallScore, "overallVerdict:", fullRow.critic_result?.overallVerdict);
  console.log("weakestSections:", JSON.stringify(fullRow.critic_result?.weakestSections, null, 2));

  console.log("\nHARD failures:", JSON.stringify(doc?.checkResults?.hard ?? [], null, 2));
  console.log("WARN count:", doc?.checkResults?.warn?.length);
  console.log(JSON.stringify(doc?.checkResults?.warn ?? [], null, 2));
  console.log("\nresearchWarnings:", JSON.stringify(doc?.researchWarnings ?? [], null, 2));
  console.log("plantQuote:", JSON.stringify(doc?.plantQuote));
  console.log("payoffQuote:", JSON.stringify(doc?.payoffQuote));

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
