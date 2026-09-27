// Phase 1b "Stickman Research-Lite" — Section 3: regenerate the same 5
// samples as Phase 1, now through Research-Lite instead of the documentary
// pipeline that failed on all 3 attempted topics last time. Bounded to a
// $2.00 total spend cap; retries a topic once (within budget) if it fails.
// Creates one throwaway, clearly-labeled test user + profile (deleted at
// the end along with all 5 test projects). Never generates TTS/narration
// audio.
//
// Usage: node scripts/generatePhase1bSamples.mjs
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
// Validation-only run after the search/extraction budget-split fix: the
// user approved validating on 1-2 topics within the ~$0.55 remaining under
// the original $2 cap (the first full 5-topic batch + diagnosis already
// spent ~$1.45), not a fresh full 5-topic re-run. Picking the 2 cheapest
// topics from the first run ($0.2366 + $0.2408 = $0.4774) to stay safely
// within what's left.
const MAX_TOTAL_SPEND_USD = 0.55;
const VOICE = { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5" }; // Josh, the app's own default

const TEST_CASES = [
  { title: "Why Don't We Eat Lions?", niche: "why_dont_we_eat_x", minutes: 9 },
  { title: "The Psychology of Overthinking", niche: "psychology_human_behavior", minutes: 8 },
];

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function callFn(name, accessToken, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

async function pollUntilTerminal(table, id, terminalStatuses, { timeoutMs, intervalMs, label }) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const { data } = await admin.from(table).select("*").eq("id", id).maybeSingle();
    last = data;
    if (data && terminalStatuses.includes(data.status)) return data;
    console.log(`    ...${label}: status=${data?.status} stage=${data?.stage} (${Math.round((Date.now() - start) / 1000)}s)`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms (last status=${last?.status}, stage=${last?.stage}, last_error_code=${last?.last_error_code})`);
}

// generate-long-form-story-plan has no cost/meta telemetry of its own (no
// ledger, no persisted token usage) — disclosed honestly as an estimate
// rather than invented precision. Typical observed 2-call gpt-5-mini
// structured-planning cost elsewhere in this codebase (see the "planning"
// ledger entries in Research's own meta) is ~$0.01-0.02 for a similarly
// shaped pass; reported as such in the sample markdown, never as a measured
// figure.
const ESTIMATED_STORY_PLAN_COST_USD = 0.015;

async function runTopicOnce(testCase, accessToken, userId) {
  const stageTimings = {};
  let projectId = null;

  const tStory = Date.now();
  const { data: session, error: sessionErr } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  if (sessionErr) throw new Error(`discovery session insert failed: ${sessionErr.message}`);

  const project = await callFn("create-long-form-project", accessToken, {
    discoverySessionId: session.id,
    topic: testCase.title,
    source: "custom",
    selectedIdea: null,
    lengthMode: "custom",
    customLengthMinutes: testCase.minutes,
    depthMode: "custom",
    customExplanationDepth: "balanced",
    onScreenTextDensity: "balanced",
    initialStatus: "draft",
  });
  projectId = project.id;

  await callFn("create-long-form-production-setup", accessToken, {
    projectId,
    visualRecipe: "stickman_doodle_explainer",
    recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
    renderTier: "v2",
    targetDurationMinutes: testCase.minutes,
    explanationDepth: "balanced",
    voiceProvider: "elevenlabs",
    voiceId: VOICE.voiceId,
    voiceModel: VOICE.voiceModel,
    niche: testCase.niche,
  });

  const storyPlanResult = await callFn("generate-long-form-story-plan", accessToken, { projectId });
  const storyPlan = storyPlanResult.storyPlan;
  stageTimings.storyPlanMs = Date.now() - tStory;
  console.log(`    story plan ready — title: "${storyPlan.recommendedTitle}", ${storyPlan.chapters.length} sections (${(stageTimings.storyPlanMs / 1000).toFixed(1)}s)`);

  const tResearch = Date.now();
  const researchStart = await callFn("start-long-form-research", accessToken, { projectId });
  const researchRow = await pollUntilTerminal("long_form_research_versions", researchStart.research.id, ["ready", "needs_attention", "failed"], { timeoutMs: 12 * 60 * 1000, intervalMs: 5000, label: "research-lite" });
  stageTimings.researchMs = Date.now() - tResearch;
  const researchCost = researchRow.meta?.estimatedTotalCostUsd ?? 0;
  console.log(`    research-lite: ${researchRow.status} (cost ~$${Number(researchCost).toFixed(4)}, ${(stageTimings.researchMs / 1000).toFixed(1)}s, ${researchRow.meta?.actualWebSearchToolCalls ?? 0} search calls)`);
  if (researchRow.status === "failed") {
    return { success: false, stage: "research", error: researchRow.last_error_code, projectId, stageTimings, costs: { story: ESTIMATED_STORY_PLAN_COST_USD, research: researchCost, script: 0 } };
  }
  await admin.from("long_form_projects").update({ current_research_version_id: researchRow.id }).eq("id", projectId);

  const tScript = Date.now();
  const scriptStart = await callFn("start-long-form-script", accessToken, { projectId });
  const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 5000, label: "script" });
  stageTimings.scriptMs = Date.now() - tScript;
  const scriptCost = scriptRow.meta?.estimatedTotalCostUsd ?? 0;
  console.log(`    script: ${scriptRow.status} (cost ~$${Number(scriptCost).toFixed(4)}, ${(stageTimings.scriptMs / 1000).toFixed(1)}s)`);
  if (scriptRow.status === "failed") {
    return { success: false, stage: "script", error: scriptRow.last_error_code, projectId, stageTimings, costs: { story: ESTIMATED_STORY_PLAN_COST_USD, research: researchCost, script: scriptCost } };
  }

  // Resolve fact sourceIds -> URLs from the persisted sources table (the
  // durable, deduped provenance record stageFinalizing writes for both
  // pipelines identically).
  const { data: sourceRows } = await admin.from("long_form_research_sources").select("id,url,title,source_type,quality_tier").eq("research_version_id", researchRow.id);
  const sourceById = new Map((sourceRows ?? []).map((s) => [s.id, s]));
  const facts = (researchRow.fact_graph?.facts ?? []).map((f) => ({
    claim: f.claim,
    classification: f.classification,
    confidence: f.confidence,
    sources: (f.sourceIds ?? []).filter((id) => id !== "__none__").map((id) => sourceById.get(id)).filter(Boolean),
  }));

  return {
    success: true,
    projectId,
    storyPlan,
    researchRow,
    scriptRow,
    facts,
    stageTimings,
    costs: { story: ESTIMATED_STORY_PLAN_COST_USD, research: researchCost, script: scriptCost },
  };
}

function renderMarkdown(testCase, result) {
  const { storyPlan, scriptRow, facts, stageTimings, costs } = result;
  const doc = scriptRow.script_document ?? {};
  const totalCost = costs.story + costs.research + costs.script;
  const totalMs = stageTimings.storyPlanMs + stageTimings.researchMs + stageTimings.scriptMs;
  const hard = doc.checkResults?.hard ?? [];
  const warn = doc.checkResults?.warn ?? [];

  const lines = [];
  lines.push(`# ${doc.title ?? storyPlan.recommendedTitle}`);
  lines.push("");
  lines.push(`- Requested topic: ${testCase.title}`);
  lines.push(`- Niche: ${testCase.niche}`);
  lines.push(`- Target length: ${testCase.minutes} minutes`);
  lines.push(`- Status: ${scriptRow.status}`);
  lines.push(`- Words: ${doc.actualWords} actual / ${scriptRow.script_document?.targetWords ?? "n/a"} target (see project.target_words)`);
  lines.push(`- Hard check failures: ${hard.length}`);
  lines.push(`- Warnings: ${warn.length}`);
  lines.push("");
  lines.push(`## Cost breakdown`);
  lines.push(`- Story Plan: ~$${costs.story.toFixed(4)} (estimated — this function has no cost telemetry of its own)`);
  lines.push(`- Research-Lite: ~$${costs.research.toFixed(4)} (measured)`);
  lines.push(`- Script: ~$${costs.script.toFixed(4)} (measured)`);
  lines.push(`- **Total: ~$${totalCost.toFixed(4)}**`);
  lines.push("");
  lines.push(`## Wall-clock time by stage`);
  lines.push(`- Story Plan: ${(stageTimings.storyPlanMs / 1000).toFixed(1)}s`);
  lines.push(`- Research-Lite: ${(stageTimings.researchMs / 1000).toFixed(1)}s`);
  lines.push(`- Script: ${(stageTimings.scriptMs / 1000).toFixed(1)}s`);
  lines.push(`- **Total: ${(totalMs / 1000).toFixed(1)}s**`);
  lines.push("");
  lines.push(`## Callback plan (Story Plan)`);
  lines.push("```json");
  lines.push(JSON.stringify(storyPlan.callbackPlan ?? null, null, 2));
  lines.push("```");
  lines.push("");
  lines.push(`## Callback quotes`);
  lines.push(`- Plant: ${JSON.stringify(doc.plantQuote ?? null)}`);
  lines.push(`- Payoff: ${JSON.stringify(doc.payoffQuote ?? null)}`);
  lines.push("");
  lines.push(`## Thumbnail concept`);
  lines.push("```json");
  lines.push(JSON.stringify(doc.thumbnailConcept ?? storyPlan.thumbnailConcept ?? null, null, 2));
  lines.push("```");
  lines.push("");
  lines.push(`## Full narration script (plain text, exactly as it would be sent to TTS)`);
  lines.push("");
  const bySection = new Map();
  for (const seg of doc.narrationSegments ?? []) {
    if (!bySection.has(seg.chapterId)) bySection.set(seg.chapterId, []);
    bySection.get(seg.chapterId).push(seg);
  }
  const fullNarrationLines = [];
  for (const chapter of doc.chapters ?? []) {
    for (const seg of bySection.get(chapter.chapterId) ?? []) fullNarrationLines.push(seg.text);
  }
  lines.push(fullNarrationLines.join(" "));
  lines.push("");
  lines.push(`## Narration by section`);
  lines.push("");
  for (const chapter of doc.chapters ?? []) {
    lines.push(`### ${chapter.title} (${chapter.role ?? "?"}) — ${chapter.actualWords ?? "?"} words`);
    if (chapter.subQuestion) lines.push(`*Sub-question: ${chapter.subQuestion}*`);
    lines.push("");
    for (const seg of bySection.get(chapter.chapterId) ?? []) {
      lines.push(seg.text);
      lines.push("");
    }
  }
  lines.push(`## Research facts used (${facts.length})`);
  lines.push("");
  for (const f of facts) {
    const sourceList = f.sources.length ? f.sources.map((s) => `[${s.title || s.url}](${s.url})`).join(", ") : "(no source — dropped by evidence discipline if unused)";
    lines.push(`- **${f.claim}** — *${f.classification}, ${f.confidence} confidence* — ${sourceList}`);
  }
  lines.push("");
  lines.push(`## Hard check failures (${hard.length})`);
  lines.push("```json");
  lines.push(JSON.stringify(hard, null, 2));
  lines.push("```");
  lines.push("");
  lines.push(`## Warnings (${warn.length})`);
  lines.push("```json");
  lines.push(JSON.stringify(warn, null, 2));
  lines.push("```");
  return lines.join("\n");
}

async function main() {
  await mkdir(new URL("../docs/phase1/samples/", import.meta.url), { recursive: true });

  const email = `phase1b-research-lite-test-${Date.now()}@zyvo-internal.test`;
  const password = randomUUID();
  console.log(`Creating throwaway test user ${email}...`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  const userId = created.user.id;
  const { error: profileErr } = await admin.from("profiles").upsert({ id: userId, email, credit_balance: 5000, plan_code: "free" });
  if (profileErr) throw new Error(`profile upsert failed: ${profileErr.message}`);

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  const accessToken = signIn.session.access_token;
  console.log(`Signed in as ${userId}.\n`);

  const results = [];
  let totalSpend = 0;
  const projectIdsToClean = [];

  for (const testCase of TEST_CASES) {
    if (totalSpend >= MAX_TOTAL_SPEND_USD) {
      console.log(`STOPPING before "${testCase.title}": cumulative spend $${totalSpend.toFixed(4)} already at/over the $${MAX_TOTAL_SPEND_USD} cap.`);
      results.push({ title: testCase.title, skipped: true });
      continue;
    }

    console.log(`=== ${testCase.title} (${testCase.niche}, ${testCase.minutes} min) ===`);
    let attempt = await runTopicOnce(testCase, accessToken, userId).catch((e) => ({ success: false, stage: "exception", error: e.message, projectId: null, stageTimings: {}, costs: { story: 0, research: 0, script: 0 } }));
    if (attempt.projectId) projectIdsToClean.push(attempt.projectId);
    totalSpend += (attempt.costs?.story ?? 0) + (attempt.costs?.research ?? 0) + (attempt.costs?.script ?? 0);

    if (!attempt.success && totalSpend < MAX_TOTAL_SPEND_USD) {
      console.log(`  FAILED at stage "${attempt.stage}" (${attempt.error}) — retrying once...`);
      const retry = await runTopicOnce(testCase, accessToken, userId).catch((e) => ({ success: false, stage: "exception", error: e.message, projectId: null, stageTimings: {}, costs: { story: 0, research: 0, script: 0 } }));
      if (retry.projectId) projectIdsToClean.push(retry.projectId);
      totalSpend += (retry.costs?.story ?? 0) + (retry.costs?.research ?? 0) + (retry.costs?.script ?? 0);
      attempt = retry;
    }

    if (!attempt.success) {
      console.log(`  FINAL RESULT: FAILED at stage "${attempt.stage}": ${attempt.error}\n`);
      results.push({ title: testCase.title, niche: testCase.niche, success: false, stage: attempt.stage, error: attempt.error });
      continue;
    }

    const slug = slugify(testCase.title);
    const md = renderMarkdown(testCase, attempt);
    await writeFile(new URL(`../docs/phase1/samples/${slug}.md`, import.meta.url), md, "utf8");
    const doc = attempt.scriptRow.script_document ?? {};
    const totalCost = attempt.costs.story + attempt.costs.research + attempt.costs.script;
    console.log(`  saved docs/phase1/samples/${slug}.md — ${attempt.scriptRow.status}, ${doc.actualWords} words, $${totalCost.toFixed(4)}\n`);
    results.push({
      title: testCase.title,
      niche: testCase.niche,
      success: true,
      slug,
      status: attempt.scriptRow.status,
      actualWords: doc.actualWords,
      hardCount: doc.checkResults?.hard?.length ?? 0,
      warnCount: doc.checkResults?.warn?.length ?? 0,
      cost: totalCost,
      wallMs: attempt.stageTimings.storyPlanMs + attempt.stageTimings.researchMs + attempt.stageTimings.scriptMs,
    });
  }

  console.log("=== CLEANUP: deleting test projects ===");
  for (const projectId of projectIdsToClean) {
    try {
      await callFn("delete-long-form-project", accessToken, { projectId });
      console.log(`  deleted project ${projectId}`);
    } catch (e) {
      console.error(`  could not delete project ${projectId}: ${e.message}`);
    }
  }
  console.log("Deleting throwaway test user...");
  const { error: delUserErr } = await admin.auth.admin.deleteUser(userId);
  if (delUserErr) console.error(`  could not delete test user: ${delUserErr.message}`);
  else console.log(`  deleted test user ${userId}`);

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    if (r.skipped) { console.log(`- ${r.title}: SKIPPED (spend cap reached)`); continue; }
    if (!r.success) { console.log(`- ${r.title}: FAILED at ${r.stage} — ${r.error}`); continue; }
    console.log(`- ${r.title}: ${r.status} — ${r.actualWords} words, ${r.hardCount} hard / ${r.warnCount} warn, $${r.cost.toFixed(4)}, ${(r.wallMs / 1000).toFixed(1)}s`);
  }
  console.log(`\nTotal spend: $${totalSpend.toFixed(4)} (cap was $${MAX_TOTAL_SPEND_USD})`);

  await writeFile(new URL("../docs/phase1/samples/_phase1b_summary.json", import.meta.url), JSON.stringify({ results, totalSpend }, null, 2), "utf8");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
