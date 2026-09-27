// Phase 1 "Stickman Script Mode" — Section 6: generate 5 real end-to-end
// Stickman scripts (Story Plan -> Research -> Script) through the ACTUAL
// production edge functions (not a bypass), bounded to a total spend cap.
// Creates one throwaway, clearly-labeled test user + profile (deleted at
// the end along with all 5 test projects) rather than reusing any real
// account. Never generates TTS/narration audio, never advances past Script.
//
// Usage: node scripts/generateStickmanSamples.mjs
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
const MAX_TOTAL_SPEND_USD = 2.0;
const VOICE = { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5" }; // Josh, the app's own default

const TEST_CASES = [
  { title: "What Did Ancient Humans Do After Dark?", niche: "ancient_humans_prehistory", minutes: 10 },
  { title: "The Psychology of Overthinking", niche: "psychology_human_behavior", minutes: 8 },
  { title: "Why Don't We Eat Lions?", niche: "why_dont_we_eat_x", minutes: 9 },
  { title: "What If the Moon Disappeared?", niche: "what_if_hypotheticals", minutes: 12 },
  { title: "Why Your Phone Is Designed to Be Addictive", niche: "technology_attention_economy", minutes: 10 },
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
    console.log(`  ...${label}: status=${data?.status} stage=${data?.stage} attempt=${data?.stage_attempt ?? "-"} (${Math.round((Date.now() - start) / 1000)}s elapsed)`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms (last status=${last?.status}, stage=${last?.stage}, last_error_code=${last?.last_error_code})`);
}

async function main() {
  await mkdir(new URL("../docs/phase1/samples/", import.meta.url), { recursive: true });

  const email = `phase1-stickman-test-${Date.now()}@zyvo-internal.test`;
  const password = randomUUID();
  console.log(`Creating throwaway test user ${email}...`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  const userId = created.user.id;

  // A DB-side trigger auto-creates a bare profiles row on auth user creation
  // (confirmed by a unique-violation on a plain insert here) — upsert to set
  // this test user's credit_balance regardless of whether that row already exists.
  const { error: profileErr } = await admin.from("profiles").upsert({ id: userId, email, credit_balance: 5000, plan_code: "free" });
  if (profileErr) throw new Error(`profile upsert failed: ${profileErr.message}`);

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  const accessToken = signIn.session.access_token;
  console.log(`Signed in as ${userId}.\n`);

  const results = [];
  let totalSpend = 0;

  for (const testCase of TEST_CASES) {
    if (totalSpend >= MAX_TOTAL_SPEND_USD) {
      console.log(`\nSTOPPING before "${testCase.title}": cumulative spend $${totalSpend.toFixed(4)} already at/over the $${MAX_TOTAL_SPEND_USD} cap.`);
      results.push({ ...testCase, skipped: true });
      continue;
    }

    const wallStart = Date.now();
    console.log(`=== ${testCase.title}  (${testCase.niche}, ${testCase.minutes} min) ===`);
    let projectId = null;
    try {
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
      console.log(`  project ${projectId} created (topic: "${testCase.title}")`);

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
      console.log(`  production setup created (recipe=stickman, niche=${testCase.niche})`);

      const storyPlanResult = await callFn("generate-long-form-story-plan", accessToken, { projectId });
      const storyPlan = storyPlanResult.storyPlan;
      console.log(`  story plan ready — title: "${storyPlan.recommendedTitle}", ${storyPlan.chapters.length} sections`);

      const researchStart = await callFn("start-long-form-research", accessToken, { projectId });
      const researchRow = await pollUntilTerminal("long_form_research_versions", researchStart.research.id, ["ready", "needs_attention", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 6000, label: "research" });
      const researchCost = researchRow.meta?.estimatedTotalCostUsd ?? researchRow.meta?.estimatedModelCostUsd ?? 0;
      console.log(`  research: ${researchRow.status} (cost ~$${Number(researchCost).toFixed(4)})`);
      if (researchRow.status === "failed") {
        results.push({ ...testCase, projectId, error: `research failed: ${researchRow.last_error_code}`, wallMs: Date.now() - wallStart, cost: researchCost });
        totalSpend += researchCost;
        continue;
      }

      const scriptStart = await callFn("start-long-form-script", accessToken, { projectId });
      const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 6 * 60 * 1000, intervalMs: 6000, label: "script" });
      const scriptCost = scriptRow.meta?.estimatedTotalCostUsd ?? 0;
      const cost = researchCost + scriptCost;
      totalSpend += cost;
      const wallMs = Date.now() - wallStart;

      const doc = scriptRow.script_document ?? {};
      const actualWords = doc.actualWords ?? null;
      const { data: projectRow } = await admin.from("long_form_projects").select("target_words").eq("id", projectId).maybeSingle();
      const targetWordsReal = projectRow?.target_words ?? null;
      const hard = doc.checkResults?.hard ?? [];
      const warn = doc.checkResults?.warn ?? [];

      console.log(`  script: ${scriptRow.status} — ${actualWords}/${targetWordsReal} words, ${hard.length} hard issue(s), ${warn.length} warning(s), cost ~$${cost.toFixed(4)}, ${(wallMs / 1000).toFixed(1)}s`);

      const slug = slugify(testCase.title);
      const md = renderMarkdown({ testCase, storyPlan, scriptRow, doc, actualWords, targetWordsReal, hard, warn, cost, researchCost, scriptCost, wallMs });
      await writeFile(new URL(`../docs/phase1/samples/${slug}.md`, import.meta.url), md, "utf8");
      console.log(`  saved docs/phase1/samples/${slug}.md`);

      results.push({ ...testCase, projectId, status: scriptRow.status, actualWords, targetWords: targetWordsReal, hardCount: hard.length, warnCount: warn.length, cost, wallMs, slug });
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      results.push({ ...testCase, projectId, error: e.message, wallMs: Date.now() - wallStart });
    }
    console.log("");
  }

  console.log("=== CLEANUP: deleting the 5 test projects ===");
  for (const r of results) {
    if (r.projectId) {
      try {
        await callFn("delete-long-form-project", accessToken, { projectId: r.projectId });
        console.log(`  deleted project ${r.projectId}`);
      } catch (e) {
        console.error(`  could not delete project ${r.projectId}: ${e.message}`);
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    if (r.skipped) { console.log(`- ${r.title}: SKIPPED (spend cap reached)`); continue; }
    if (r.error) { console.log(`- ${r.title}: ERROR — ${r.error}`); continue; }
    console.log(`- ${r.title}: ${r.status} — ${r.actualWords}/${r.targetWords} words, ${r.hardCount} hard / ${r.warnCount} warn, $${r.cost.toFixed(4)}, ${(r.wallMs / 1000).toFixed(1)}s`);
  }
  console.log(`\nTotal spend: $${totalSpend.toFixed(4)} (cap was $${MAX_TOTAL_SPEND_USD})`);

  await writeFile(new URL("../docs/phase1/samples/_summary.json", import.meta.url), JSON.stringify({ results, totalSpend }, null, 2), "utf8");
}

function renderMarkdown({ testCase, storyPlan, scriptRow, doc, actualWords, targetWordsReal, hard, warn, cost, researchCost, scriptCost, wallMs }) {
  const lines = [];
  lines.push(`# ${doc.title ?? storyPlan.recommendedTitle}`);
  lines.push("");
  lines.push(`- Requested topic: ${testCase.title}`);
  lines.push(`- Niche: ${testCase.niche}`);
  lines.push(`- Target length: ${testCase.minutes} minutes`);
  lines.push(`- Status: ${scriptRow.status}`);
  lines.push(`- Words: ${actualWords} actual / ${targetWordsReal} target`);
  lines.push(`- Hard check failures: ${hard.length}`);
  lines.push(`- Warnings: ${warn.length}`);
  lines.push(`- Cost: research ~$${Number(researchCost).toFixed(4)} + script ~$${Number(scriptCost).toFixed(4)} = ~$${cost.toFixed(4)}`);
  lines.push(`- Wall-clock time: ${(wallMs / 1000).toFixed(1)}s`);
  lines.push("");
  lines.push("## Callback plan (Story Plan)");
  lines.push("```json");
  lines.push(JSON.stringify(storyPlan.callbackPlan ?? null, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Thumbnail concept");
  lines.push("```json");
  lines.push(JSON.stringify(doc.thumbnailConcept ?? storyPlan.thumbnailConcept ?? null, null, 2));
  lines.push("```");
  lines.push("");
  lines.push(`## Callback quotes`);
  lines.push(`- Plant: ${JSON.stringify(doc.plantQuote ?? null)}`);
  lines.push(`- Payoff: ${JSON.stringify(doc.payoffQuote ?? null)}`);
  lines.push("");
  lines.push("## Full narration");
  lines.push("");
  const sectionsById = new Map((doc.chapters ?? []).map((c) => [c.chapterId, c]));
  const bySection = new Map();
  for (const seg of doc.narrationSegments ?? []) {
    if (!bySection.has(seg.chapterId)) bySection.set(seg.chapterId, []);
    bySection.get(seg.chapterId).push(seg);
  }
  for (const chapter of doc.chapters ?? []) {
    lines.push(`### ${chapter.title} (${chapter.role ?? "?"}) — ${chapter.actualWords ?? "?"} words`);
    if (chapter.subQuestion) lines.push(`*Sub-question: ${chapter.subQuestion}*`);
    lines.push("");
    for (const seg of bySection.get(chapter.chapterId) ?? []) {
      lines.push(seg.text);
      lines.push("");
    }
  }
  lines.push("## Hard check failures");
  lines.push("```json");
  lines.push(JSON.stringify(hard, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Warnings");
  lines.push("```json");
  lines.push(JSON.stringify(warn, null, 2));
  lines.push("```");
  return lines.join("\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
