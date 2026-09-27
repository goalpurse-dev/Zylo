// Phase 1 FINAL, Section 6 — acceptance runs. FULL pipeline (fresh Story
// Plan, research [fixture-reused or freshly run], claim verification,
// critic, possible selective revision), chosen model (Claude Sonnet 5,
// the compiled-in default). One at a time. Never deletes anything.
//
// Resume mode: `node scripts/phase1FinalAcceptance.mjs --resume <scriptVersionId>`
// re-attaches to a run already in progress server-side (the pipeline
// self-chains on the server, so a killed local poller doesn't stop it) and
// prints the same report — no new spend.
import { createTestUser, loadFixture, callFn, pollUntilTerminal, admin, VOICE } from "./phase1cLib.mjs";
import { execFileSync } from "node:child_process";

// Phase 1 FINISH rule: $0.70 per run, Anthropic + OpenAI, all stages.
const PER_RUN_CAP_USD = 0.7;
const STORY_PLAN_ESTIMATE_USD = 0.02; // generate-long-form-story-plan has no usage tracking (2 gpt-5-mini calls)

const CASES = {
  "ancient-humans": { mode: "fixture", slug: "what-did-ancient-humans-do-after-dark", niche: "ancient_humans_prehistory", title: "What Did Ancient Humans Do After Dark?" },
  "overthinking": { mode: "fixture", slug: "the-psychology-of-overthinking", niche: "psychology_human_behavior", title: "The Psychology of Overthinking" },
  "lions": { mode: "fixture", slug: "why-don-t-we-eat-lions", niche: "why_dont_we_eat_x", title: "Why Don't We Eat Lions?" },
  "moon": { mode: "fresh", niche: "what_if_hypotheticals", title: "What If the Moon Disappeared?" },
  "phone": { mode: "fresh", niche: "technology_attention_economy", title: "Why Your Phone Is Designed to Be Addictive" },
};

const TERMINAL = ["ready", "needs_attention", "needs_research", "failed"];

async function report(scriptVersionId, timings = {}) {
  const { data: scriptRow } = await admin.from("long_form_script_versions").select("*").eq("id", scriptVersionId).maybeSingle();
  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", scriptRow.project_id).maybeSingle();
  const doc = scriptRow.script_document;

  console.log(`\n=== RESULT ===`);
  console.log("status:", scriptRow.status, "| last_error_code:", scriptRow.last_error_code, "| stage:", scriptRow.stage);
  console.log("generation_model:", scriptRow.generation_model, "| critic_model:", scriptRow.critic_model, "| revision_model:", scriptRow.revision_model);
  console.log("words:", doc?.actualWords, "/ target:", project.target_words, `(${doc?.actualWords && project.target_words ? Math.round((doc.actualWords / project.target_words) * 100) : "?"}%)`);
  const scriptCost = scriptRow.meta?.estimatedTotalCostUsd ?? 0;
  const researchCost = timings.researchCost ?? 0;
  const ledger = scriptRow.meta?.callLedger ?? [];
  const byProvider = { anthropic: 0, openai: STORY_PLAN_ESTIMATE_USD + researchCost };
  for (const l of ledger) byProvider[String(l.model).startsWith("claude-") ? "anthropic" : "openai"] += l.estimatedCostUsd ?? 0;
  const total = byProvider.anthropic + byProvider.openai;
  console.log(`cost: story plan ~$${STORY_PLAN_ESTIMATE_USD.toFixed(2)} (est) + research $${researchCost.toFixed(4)} + script $${scriptCost.toFixed(4)} = $${total.toFixed(4)}`);
  console.log(`cost by provider: Anthropic $${byProvider.anthropic.toFixed(4)} | OpenAI $${byProvider.openai.toFixed(4)}`);
  console.log("cost by stage:", ledger.map((l) => `${l.stage}(${l.model})=$${Number(l.estimatedCostUsd).toFixed(4)}`).join(", "));
  if (total > PER_RUN_CAP_USD) console.log(`!!! PER-RUN CAP EXCEEDED: $${total.toFixed(4)} > $${PER_RUN_CAP_USD}`);
  if (timings.wallMs != null) {
    console.log("wall-clock:", (timings.wallMs / 1000).toFixed(1) + "s", `(story ${((timings.storyMs ?? 0) / 1000).toFixed(1)}s + research ${((timings.researchMs ?? 0) / 1000).toFixed(1)}s + script ${((timings.scriptMs ?? 0) / 1000).toFixed(1)}s)`);
  } else {
    const started = new Date(scriptRow.created_at).getTime();
    console.log(`script wall-clock (row created -> now): ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
  console.log("callLedger:", JSON.stringify(scriptRow.meta?.callLedger, null, 2));

  console.log("\ncritic overallScore:", scriptRow.critic_result?.overallScore, "| overallVerdict:", scriptRow.critic_result?.overallVerdict);
  console.log("critic scores:", JSON.stringify(scriptRow.critic_result?.scores));
  console.log("weakestSections:", JSON.stringify(scriptRow.critic_result?.weakestSections, null, 2));

  console.log("\nHARD failures:", JSON.stringify(doc?.checkResults?.hard ?? [], null, 2));
  console.log("WARN count:", doc?.checkResults?.warn?.length ?? 0);
  console.log(JSON.stringify(doc?.checkResults?.warn ?? [], null, 2));
  console.log("\nqualitySummary:", JSON.stringify(doc?.qualitySummary ?? {}, null, 2));
  console.log("researchWarnings:", JSON.stringify(doc?.researchWarnings ?? [], null, 2));
  console.log("plantQuote:", JSON.stringify(doc?.plantQuote));
  console.log("payoffQuote:", JSON.stringify(doc?.payoffQuote));

  if (scriptRow.status === "failed") {
    console.log("\nFAILURE DETAIL:", JSON.stringify(scriptRow.detail, null, 2)?.slice(0, 4000));
  }

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

  console.log("projectId (kept, not deleted):", scriptRow.project_id, "| scriptVersionId:", scriptRow.id);
}

async function run(key) {
  const testCase = CASES[key];
  console.log(`=== ACCEPTANCE: ${key} — "${testCase.title}" (${testCase.mode}) ===`);
  const { userId, accessToken } = await createTestUser(`phase1final-accept-${key}`);
  await admin.from("profiles").update({ credit_balance: 200000 }).eq("id", userId);
  const wallStart = Date.now();

  const fixture = testCase.mode === "fixture" ? await loadFixture(testCase.slug) : null;
  const minutes = fixture?.project.resolved_length_minutes ?? 10;

  const { data: session } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  const project = await callFn("create-long-form-project", accessToken, {
    discoverySessionId: session.id, topic: testCase.title, source: "custom", selectedIdea: null,
    lengthMode: "custom", customLengthMinutes: minutes, depthMode: "custom", customExplanationDepth: "balanced",
    onScreenTextDensity: "balanced", initialStatus: "draft",
  });
  const projectId = project.id;
  console.log("projectId:", projectId);

  await callFn("create-long-form-production-setup", accessToken, {
    projectId, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
    renderTier: "v2", targetDurationMinutes: minutes, explanationDepth: "balanced",
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
  }
  console.log(`Sum of section targetWords: ${sumWords}`);

  const { data: freshProject } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();

  let researchMs = 0;
  let researchCost = 0;

  if (testCase.mode === "fixture") {
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
    console.log(`\nresearch: reused fixture "${testCase.slug}" (${remappedFacts.length} facts remapped onto ${newEvidenceChapterIds.length} evidence chapters)`);
  } else {
    const tResearch = Date.now();
    const researchStart = await callFn("start-long-form-research", accessToken, { projectId });
    const researchRow = await pollUntilTerminal("long_form_research_versions", researchStart.research.id, ["ready", "needs_attention", "failed"], { timeoutMs: 12 * 60 * 1000, intervalMs: 5000, label: "research" });
    researchMs = Date.now() - tResearch;
    researchCost = researchRow.meta?.estimatedTotalCostUsd ?? 0;
    console.log(`\nresearch: ${researchRow.status} (facts=${researchRow.fact_graph?.facts?.length ?? 0}, cost ~$${Number(researchCost).toFixed(4)}, ${(researchMs / 1000).toFixed(1)}s, reason=${researchRow.meta?.completionReason ?? "-"})`);
    if (researchRow.status === "failed") throw new Error("research failed");

    // Per-run cap: the script engine's predictive gate gets whatever is left
    // of $0.70 after the story plan and the research actually spent.
    const scriptCap = Number((PER_RUN_CAP_USD - STORY_PLAN_ESTIMATE_USD - researchCost).toFixed(2));
    console.log(`setting script cap to $${scriptCap} and redeploying the engine so it is live before Script starts`);
    execFileSync("npx", ["supabase", "secrets", "set", `LONG_FORM_MAX_STICKMAN_SCRIPT_COST_USD=${scriptCap}`], { stdio: "ignore", shell: true });
    execFileSync("npx", ["supabase", "functions", "deploy", "advance-long-form-script"], { stdio: "ignore", shell: true });
  }

  const tScript = Date.now();
  const scriptStart = await callFn("start-long-form-script", accessToken, { projectId });
  console.log("scriptVersionId:", scriptStart.script.id, "(use --resume with this id if this poller dies)");
  await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, TERMINAL, { timeoutMs: 12 * 60 * 1000, intervalMs: 5000, label: "script" });
  const scriptMs = Date.now() - tScript;

  await report(scriptStart.script.id, { storyMs, researchMs, scriptMs, researchCost, wallMs: Date.now() - wallStart });

  // Freeze the run (DB context + recorded cassettes) as an offline replay
  // fixture — a failed run is diagnosed from this, never by paying again.
  execFileSync(process.execPath, ["scripts/phase1FinalSnapshotRun.mjs", scriptStart.script.id, `accept-${key}-${Date.now()}`], { stdio: "inherit" });
}

async function main() {
  if (process.argv[2] === "--resume") {
    const id = process.argv[3];
    console.log(`=== RESUMING script ${id} ===`);
    await pollUntilTerminal("long_form_script_versions", id, TERMINAL, { timeoutMs: 12 * 60 * 1000, intervalMs: 5000, label: "script" });
    await report(id);
    return;
  }
  const key = process.argv[2];
  if (!key || !CASES[key]) {
    console.error(`Usage: node scripts/phase1FinalAcceptance.mjs <${Object.keys(CASES).join("|")}> | --resume <scriptVersionId>`);
    process.exit(1);
  }
  await run(key);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
