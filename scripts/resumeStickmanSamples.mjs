// Phase 1, Section 6 — resume the 3 Stickman projects already created by
// generateStickmanSamples.mjs (Story Plan already done, Research already
// in flight) rather than paying for fresh Story Plan + Research a second
// time. Reduced scope per the user's explicit choice: complete 2-3 samples
// within the (already-partially-spent, ~$0.93) $2 total cap, not all 5.
//
// Resets the existing throwaway test user's password (service-role only;
// no email sent) to get a fresh session, then polls Research (much longer
// timeout than the first attempt used) and Script to completion for the
// given project ids, in order, stopping if the running total would exceed
// the remaining budget.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TEST_USER_ID = "eb6d7b8f-35e0-4657-89c5-ef63d89714ec";
const ALREADY_SPENT_USD = 0.93; // sum of the 3 research rows' estimatedTotalCostUsd at the point the first run was stopped
const MAX_TOTAL_SPEND_USD = 2.0;
const REMAINING_BUDGET_USD = MAX_TOTAL_SPEND_USD - ALREADY_SPENT_USD;

// Ordered by how much sunk research cost each already has — cheapest path
// to 2-3 finished samples is finishing what's already deepest into Research,
// not starting fresh ones.
const PROJECTS = [
  { projectId: "ca6b897d-a502-42f8-bd9f-ac59661ea9c2", title: "What Did Ancient Humans Do After Dark?", niche: "ancient_humans_prehistory", minutes: 10 },
  { projectId: "37c8dffe-bd4d-4aa8-82a4-429cf211277f", title: "The Psychology of Overthinking", niche: "psychology_human_behavior", minutes: 8 },
  { projectId: "d9796bb6-e9d0-4059-83f4-f8874e51283b", title: "Why Don't We Eat Lions?", niche: "why_dont_we_eat_x", minutes: 9 },
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

function renderMarkdown({ title, niche, minutes, storyPlan, scriptRow, doc, actualWords, targetWordsReal, hard, warn, cost, researchCost, scriptCost, wallMs }) {
  const lines = [];
  lines.push(`# ${doc.title ?? storyPlan.recommendedTitle}`);
  lines.push("");
  lines.push(`- Requested topic: ${title}`);
  lines.push(`- Niche: ${niche}`);
  lines.push(`- Target length: ${minutes} minutes`);
  lines.push(`- Status: ${scriptRow.status}`);
  lines.push(`- Words: ${actualWords} actual / ${targetWordsReal} target`);
  lines.push(`- Hard check failures: ${hard.length}`);
  lines.push(`- Warnings: ${warn.length}`);
  lines.push(`- Cost: research ~$${Number(researchCost).toFixed(4)} + script ~$${Number(scriptCost).toFixed(4)} = ~$${cost.toFixed(4)}`);
  lines.push(`- Wall-clock time (this resumed run, research completion + script): ${(wallMs / 1000).toFixed(1)}s`);
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

async function main() {
  await mkdir(new URL("../docs/phase1/samples/", import.meta.url), { recursive: true });

  const password = randomUUID();
  const { error: pwErr } = await admin.auth.admin.updateUserById(TEST_USER_ID, { password });
  if (pwErr) throw new Error(`could not reset test user password: ${pwErr.message}`);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email: `phase1-stickman-test-1790357058619@zyvo-internal.test`, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  const accessToken = signIn.session.access_token;
  console.log(`Signed in as ${TEST_USER_ID}. Remaining budget: $${REMAINING_BUDGET_USD.toFixed(4)}\n`);

  const results = [];
  let spentThisRun = 0;

  for (const p of PROJECTS) {
    if (spentThisRun >= REMAINING_BUDGET_USD) {
      console.log(`STOPPING before "${p.title}": this run has already spent $${spentThisRun.toFixed(4)} of the $${REMAINING_BUDGET_USD.toFixed(4)} remaining budget.`);
      results.push({ ...p, skipped: true });
      continue;
    }
    const wallStart = Date.now();
    console.log(`=== ${p.title} (${p.niche}, ${p.minutes} min) ===`);
    try {
      const { data: project } = await admin.from("long_form_projects").select("current_story_plan_version_id, target_words").eq("id", p.projectId).maybeSingle();
      const { data: storyVersion } = await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", project.current_story_plan_version_id).maybeSingle();
      const storyPlan = storyVersion.story_plan;

      const { data: existingResearch } = await admin.from("long_form_research_versions").select("id,status").eq("project_id", p.projectId).order("version", { ascending: false }).limit(1).maybeSingle();

      const researchRow = await pollUntilTerminal("long_form_research_versions", existingResearch.id, ["ready", "needs_attention", "failed"], { timeoutMs: 20 * 60 * 1000, intervalMs: 8000, label: "research" });
      const researchCost = researchRow.meta?.estimatedTotalCostUsd ?? 0;
      console.log(`  research: ${researchRow.status} (cost ~$${Number(researchCost).toFixed(4)})`);
      if (researchRow.status === "failed") {
        results.push({ ...p, error: `research failed: ${researchRow.last_error_code}`, wallMs: Date.now() - wallStart, cost: researchCost });
        spentThisRun += researchCost;
        continue;
      }
      await admin.from("long_form_projects").update({ current_research_version_id: researchRow.id }).eq("id", p.projectId);

      const scriptStart = await callFn("start-long-form-script", accessToken, { projectId: p.projectId });
      const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 6000, label: "script" });
      const scriptCost = scriptRow.meta?.estimatedTotalCostUsd ?? 0;
      const cost = researchCost + scriptCost;
      spentThisRun += cost;
      const wallMs = Date.now() - wallStart;

      const doc = scriptRow.script_document ?? {};
      const actualWords = doc.actualWords ?? null;
      const targetWordsReal = project?.target_words ?? null;
      const hard = doc.checkResults?.hard ?? [];
      const warn = doc.checkResults?.warn ?? [];

      console.log(`  script: ${scriptRow.status} — ${actualWords}/${targetWordsReal} words, ${hard.length} hard issue(s), ${warn.length} warning(s), cost ~$${cost.toFixed(4)}, ${(wallMs / 1000).toFixed(1)}s`);

      const slug = slugify(p.title);
      const md = renderMarkdown({ title: p.title, niche: p.niche, minutes: p.minutes, storyPlan, scriptRow, doc, actualWords, targetWordsReal, hard, warn, cost, researchCost, scriptCost, wallMs });
      await writeFile(new URL(`../docs/phase1/samples/${slug}.md`, import.meta.url), md, "utf8");
      console.log(`  saved docs/phase1/samples/${slug}.md`);

      results.push({ ...p, status: scriptRow.status, actualWords, targetWords: targetWordsReal, hardCount: hard.length, warnCount: warn.length, cost, researchCost, scriptCost, wallMs, slug });
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      results.push({ ...p, error: e.message, wallMs: Date.now() - wallStart });
    }
    console.log("");
  }

  console.log("=== SUMMARY (this resumed run) ===");
  for (const r of results) {
    if (r.skipped) { console.log(`- ${r.title}: SKIPPED (remaining budget reached)`); continue; }
    if (r.error) { console.log(`- ${r.title}: ERROR — ${r.error}`); continue; }
    console.log(`- ${r.title}: ${r.status} — ${r.actualWords}/${r.targetWords} words, ${r.hardCount} hard / ${r.warnCount} warn, $${r.cost.toFixed(4)}, ${(r.wallMs / 1000).toFixed(1)}s`);
  }
  console.log(`\nSpent this resumed run: $${spentThisRun.toFixed(4)}`);
  console.log(`Grand total including the first (stopped) run's $${ALREADY_SPENT_USD.toFixed(4)}: $${(spentThisRun + ALREADY_SPENT_USD).toFixed(4)}`);

  await writeFile(new URL("../docs/phase1/samples/_resume_summary.json", import.meta.url), JSON.stringify({ results, spentThisRun, alreadySpent: ALREADY_SPENT_USD }, null, 2), "utf8");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
