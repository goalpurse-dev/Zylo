// Phase 1c shared helpers: create a throwaway test user/project, run
// Story Plan + Research for real (paid), save a research fixture, or
// replay Script from a saved fixture (zero research spend). Never deletes
// anything — Phase 1c, Process Rule 0: "Never delete test projects/users
// before I've read the report. Clean up only when I say so."
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { writeFile, readFile, mkdir } from "node:fs/promises";

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
export const VOICE = { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5" };

export async function callFn(name, accessToken, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

export async function pollUntilTerminal(table, id, terminalStatuses, { timeoutMs, intervalMs, label }) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const { data } = await admin.from(table).select("*").eq("id", id).maybeSingle();
    last = data;
    if (data && terminalStatuses.includes(data.status)) return data;
    console.log(`    ...${label}: status=${data?.status} stage=${data?.stage} (${Math.round((Date.now() - start) / 1000)}s)`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} timed out (last status=${last?.status}, stage=${last?.stage}, last_error_code=${last?.last_error_code})`);
}

export async function createTestUser(labelPrefix) {
  const email = `${labelPrefix}-${Date.now()}@zyvo-internal.test`;
  const password = randomUUID();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  const userId = created.user.id;
  const { error: profileErr } = await admin.from("profiles").upsert({ id: userId, email, credit_balance: 5000, plan_code: "free" });
  if (profileErr) throw new Error(`profile upsert failed: ${profileErr.message}`);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  return { userId, email, accessToken: signIn.session.access_token };
}

// Runs Story Plan + Research for real (paid). Returns everything needed to
// either continue into Script or save a fixture. Never advances into
// Script itself.
export async function runStoryPlanAndResearch(testCase, accessToken, userId) {
  const stageTimings = {};
  const tStory = Date.now();
  const { data: session, error: sessionErr } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  if (sessionErr) throw new Error(`discovery session insert failed: ${sessionErr.message}`);

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

  const storyPlanResult = await callFn("generate-long-form-story-plan", accessToken, { projectId });
  const storyPlan = storyPlanResult.storyPlan;
  stageTimings.storyPlanMs = Date.now() - tStory;
  console.log(`    story plan ready — "${storyPlan.recommendedTitle}" (${(stageTimings.storyPlanMs / 1000).toFixed(1)}s)`);

  const tResearch = Date.now();
  const researchStart = await callFn("start-long-form-research", accessToken, { projectId });
  const researchRow = await pollUntilTerminal("long_form_research_versions", researchStart.research.id, ["ready", "needs_attention", "failed"], { timeoutMs: 12 * 60 * 1000, intervalMs: 5000, label: "research" });
  stageTimings.researchMs = Date.now() - tResearch;
  const researchCost = researchRow.meta?.estimatedTotalCostUsd ?? 0;
  console.log(`    research: ${researchRow.status} (facts=${researchRow.fact_graph?.facts?.length ?? 0}, cost ~$${Number(researchCost).toFixed(4)}, ${(stageTimings.researchMs / 1000).toFixed(1)}s, reason=${researchRow.meta?.completionReason ?? "-"})`);

  const { data: freshProject } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  return { projectId, userId, accessToken, project: freshProject, storyPlan, researchRow, stageTimings, costs: { story: 0.015, research: researchCost } };
}

export async function saveFixture(slug, ctx) {
  await mkdir(new URL("../tests/fixtures/stickman/research/", import.meta.url), { recursive: true });
  const fixture = {
    slug,
    savedAt: new Date().toISOString(),
    project: {
      topic: ctx.project.topic,
      resolved_length_minutes: ctx.project.resolved_length_minutes,
      resolved_explanation_depth: ctx.project.resolved_explanation_depth,
      target_words: ctx.project.target_words,
      topic_model: ctx.project.topic_model,
      narrative_strategy: ctx.project.narrative_strategy,
      selected_idea_title: ctx.project.selected_idea_title,
      selected_idea_angle: ctx.project.selected_idea_angle,
    },
    storyPlan: ctx.storyPlan,
    research: {
      status: ctx.researchRow.status,
      research_plan: ctx.researchRow.research_plan,
      fact_graph: ctx.researchRow.fact_graph,
      coverage: ctx.researchRow.coverage,
      meta: ctx.researchRow.meta,
      detail: ctx.researchRow.detail,
    },
  };
  const path = new URL(`../tests/fixtures/stickman/research/${slug}.json`, import.meta.url);
  await writeFile(path, JSON.stringify(fixture, null, 2), "utf8");
  console.log(`    saved fixture tests/fixtures/stickman/research/${slug}.json`);
  return fixture;
}

export async function loadFixture(slug) {
  const path = new URL(`../tests/fixtures/stickman/research/${slug}.json`, import.meta.url);
  return JSON.parse(await readFile(path, "utf8"));
}

// Replays Script from a saved fixture with ZERO new research spend: creates
// a fresh throwaway user/project/profile/story-plan-version/research-version
// directly from the fixture's saved data (status forced to what the fixture
// recorded, or overridden), then runs the real, paid Script stage.
export async function replayScriptFromFixture(fixture, accessToken, userId, statusOverride) {
  const { data: session } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  const project = await callFn("create-long-form-project", accessToken, {
    discoverySessionId: session.id, topic: fixture.project.topic, source: "custom", selectedIdea: null,
    lengthMode: "custom", customLengthMinutes: fixture.project.resolved_length_minutes, depthMode: "custom",
    customExplanationDepth: fixture.project.resolved_explanation_depth, onScreenTextDensity: "balanced", initialStatus: "draft",
  });
  const projectId = project.id;
  await callFn("create-long-form-production-setup", accessToken, {
    projectId, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
    renderTier: "v2", targetDurationMinutes: fixture.project.resolved_length_minutes, explanationDepth: fixture.project.resolved_explanation_depth,
    voiceProvider: "elevenlabs", voiceId: VOICE.voiceId, voiceModel: VOICE.voiceModel, niche: "replay",
  });
  await admin.from("long_form_projects").update({
    topic_model: fixture.project.topic_model, narrative_strategy: fixture.project.narrative_strategy,
    target_words: fixture.project.target_words, resolved_length_minutes: fixture.project.resolved_length_minutes,
    resolved_explanation_depth: fixture.project.resolved_explanation_depth,
    selected_idea_title: fixture.project.selected_idea_title ?? null, selected_idea_angle: fixture.project.selected_idea_angle ?? null,
  }).eq("id", projectId);

  const { data: storyVersion, error: svErr } = await admin.from("long_form_story_plan_versions").insert({ project_id: projectId, version: 1, story_plan: fixture.storyPlan, generation_model: "gpt-5-mini" }).select("id").single();
  if (svErr) throw new Error(`story plan version insert failed: ${svErr.message}`);
  await admin.from("long_form_projects").update({ current_story_plan_version_id: storyVersion.id, status: "story_ready" }).eq("id", projectId);

  const { data: researchVersion, error: rvErr } = await admin
    .from("long_form_research_versions")
    .insert({
      project_id: projectId, story_plan_version_id: storyVersion.id, version: 1,
      status: statusOverride ?? fixture.research.status, stage: "finalizing",
      research_plan: fixture.research.research_plan, fact_graph: fixture.research.fact_graph, coverage: fixture.research.coverage,
      meta: fixture.research.meta, detail: fixture.research.detail, research_started_at: new Date().toISOString(), research_completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (rvErr) throw new Error(`research version insert failed: ${rvErr.message}`);
  await admin.from("long_form_projects").update({ current_research_version_id: researchVersion.id }).eq("id", projectId);

  const tScript = Date.now();
  const scriptStart = await callFn("start-long-form-script", accessToken, { projectId });
  const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 5000, label: "script(replay)" });
  const scriptMs = Date.now() - tScript;
  return { projectId, scriptRow, scriptMs };
}
