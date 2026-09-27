// Phase 1c, Section 4 — re-run the same 5 topics/niches/lengths as the
// original Phase 1 sample batch (scripts/generateStickmanSamples.mjs), now
// against the fixed research pipeline (merged verify + live-URL proof
// instead of the broken citations check, raised $0.45 ceiling, Section 3's
// length gate). Saves a research fixture per topic (Process Rule 0: never
// deletes anything) and a docs/phase1/samples/<slug>.md sample file with
// facts/sources, cost by stage, and time by stage. Hard-stops the batch
// before exceeding the $3.00 total ceiling — never spends past it, and
// reports honestly on whatever got done within budget.
import { createTestUser, runStoryPlanAndResearch, saveFixture, callFn, pollUntilTerminal, admin } from "./phase1cLib.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const TOPICS = [
  { title: "What Did Ancient Humans Do After Dark?", niche: "ancient_humans_prehistory", minutes: 10 },
  { title: "The Psychology of Overthinking", niche: "psychology_human_behavior", minutes: 8 },
  { title: "Why Don't We Eat Lions?", niche: "why_dont_we_eat_x", minutes: 9 },
  { title: "What If the Moon Disappeared?", niche: "what_if_hypotheticals", minutes: 12 },
  { title: "Why Your Phone Is Designed to Be Addictive", niche: "technology_attention_economy", minutes: 10 },
];

const TOTAL_BUDGET_USD = 3.0;
const STORY_PLAN_COST_ESTIMATE = 0.015; // this function has no cost telemetry of its own — same estimate Phase 1b used

export function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function fetchSourcesById(researchVersionId) {
  const { data } = await admin.from("long_form_research_sources").select("id, url, title").eq("research_version_id", researchVersionId);
  return new Map((data ?? []).map((s) => [s.id, s]));
}

export function renderSampleMarkdown({ testCase, storyPlan, researchRow, scriptRow, sourcesById, costs, timingsMs, targetWords }) {
  const doc = scriptRow?.script_document;
  const lines = [];
  lines.push(`# ${doc?.title ?? storyPlan.recommendedTitle}`);
  lines.push("");
  lines.push(`- Requested topic: ${testCase.title}`);
  lines.push(`- Niche: ${testCase.niche}`);
  lines.push(`- Target length: ${testCase.minutes} minutes`);
  lines.push(`- Research status: ${researchRow.status}${researchRow.meta?.completionReason ? ` (${researchRow.meta.completionReason})` : ""}`);
  lines.push(`- Script status: ${scriptRow ? scriptRow.status : "not attempted"}`);
  if (doc) {
    const ratio = targetWords ? Math.round(((doc.actualWords ?? 0) / targetWords) * 100) : null;
    lines.push(`- Words: ${doc.actualWords ?? "?"} actual / ${targetWords ?? "?"} target${ratio != null ? ` (${ratio}%)` : ""}`);
  }
  const hard = doc?.checkResults?.hard ?? [];
  const warn = doc?.checkResults?.warn ?? [];
  if (doc) {
    lines.push(`- Hard check failures: ${hard.length}`);
    lines.push(`- Warnings: ${warn.length}`);
  }
  lines.push("");
  lines.push("## Cost breakdown");
  lines.push(`- Story Plan: ~$${costs.storyPlan.toFixed(4)} (estimated — this function has no cost telemetry of its own)`);
  lines.push(`- Research: ~$${costs.research.toFixed(4)} (measured)`);
  if (scriptRow) lines.push(`- Script: ~$${costs.script.toFixed(4)} (measured)`);
  lines.push(`- **Total: ~$${costs.total.toFixed(4)}**`);
  lines.push("");
  lines.push("## Wall-clock time by stage");
  lines.push(`- Story Plan: ${(timingsMs.storyPlan / 1000).toFixed(1)}s`);
  lines.push(`- Research: ${(timingsMs.research / 1000).toFixed(1)}s`);
  if (timingsMs.script != null) lines.push(`- Script: ${(timingsMs.script / 1000).toFixed(1)}s`);
  lines.push(`- **Total: ${(timingsMs.total / 1000).toFixed(1)}s**`);
  lines.push("");

  if (!doc) {
    lines.push("## Script not attempted");
    lines.push("");
    lines.push(`Research finished with ${researchRow.fact_graph?.facts?.length ?? 0} facts, below STICKMAN_MIN_FACTS. Detail: \`${JSON.stringify(researchRow.detail)}\``);
    return lines.join("\n");
  }

  lines.push("## Callback plan (Story Plan)");
  lines.push("```json");
  lines.push(JSON.stringify(storyPlan.callbackPlan ?? null, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Callback quotes");
  lines.push(`- Plant: ${JSON.stringify(doc.plantQuote ?? null)}`);
  lines.push(`- Payoff: ${JSON.stringify(doc.payoffQuote ?? null)}`);
  lines.push("");
  lines.push("## Thumbnail concept");
  lines.push("```json");
  lines.push(JSON.stringify(doc.thumbnailConcept ?? storyPlan.thumbnailConcept ?? null, null, 2));
  lines.push("```");
  lines.push("");

  lines.push("## Full narration script (plain text, exactly as it would be sent to TTS)");
  lines.push("");
  const orderedSegments = [...(doc.narrationSegments ?? [])].sort((a, b) => {
    const ca = doc.chapters.findIndex((c) => c.chapterId === a.chapterId);
    const cb = doc.chapters.findIndex((c) => c.chapterId === b.chapterId);
    return ca - cb || a.sequenceIndex - b.sequenceIndex;
  });
  lines.push(orderedSegments.map((s) => s.text).join(" "));
  lines.push("");

  lines.push("## Narration by section");
  lines.push("");
  const bySection = new Map();
  for (const seg of doc.narrationSegments ?? []) {
    if (!bySection.has(seg.chapterId)) bySection.set(seg.chapterId, []);
    bySection.get(seg.chapterId).push(seg);
  }
  for (const chapter of doc.chapters ?? []) {
    const segs = (bySection.get(chapter.chapterId) ?? []).sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    const words = segs.reduce((sum, s) => sum + (s.text ?? "").trim().split(/\s+/).filter(Boolean).length, 0);
    lines.push(`### ${chapter.title} (${chapter.role ?? "?"}) — ${words} words`);
    if (chapter.subQuestion) lines.push(`*Sub-question: ${chapter.subQuestion}*`);
    lines.push("");
    for (const seg of segs) {
      lines.push(seg.text);
      lines.push("");
    }
  }

  const facts = researchRow.fact_graph?.facts ?? [];
  lines.push(`## Research facts used (${facts.length})`);
  lines.push("");
  for (const f of facts) {
    const src = sourcesById.get(f.sourceIds?.[0]);
    const link = src ? `[${src.title || src.url}](${src.url})` : "(source unavailable)";
    lines.push(`- **${f.claim}** — *${f.classification}, ${f.confidence} confidence* — ${link}`);
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
  const { userId, accessToken } = await createTestUser("phase1c-samples");
  console.log(`Test user created: ${userId}\n`);

  // Resume support (a transient network drop killed the first attempt mid-batch,
  // after topic 1's research+partial-script spend had already landed): --skip=N
  // skips the first N topics, --spent=X seeds the running total so the $3.00
  // ceiling still accounts for spend from an earlier, already-recorded partial run.
  const skipArg = process.argv.find((a) => a.startsWith("--skip="));
  const spentArg = process.argv.find((a) => a.startsWith("--spent="));
  const skipCount = skipArg ? Number(skipArg.split("=")[1]) : 0;
  let spent = spentArg ? Number(spentArg.split("=")[1]) : 0;
  const results = [];

  for (const testCase of TOPICS.slice(skipCount)) {
    const slug = slugify(testCase.title);
    if (spent >= TOTAL_BUDGET_USD) {
      console.log(`STOPPING before "${testCase.title}": already spent $${spent.toFixed(4)} of the $${TOTAL_BUDGET_USD.toFixed(2)} total budget.`);
      results.push({ title: testCase.title, slug, skipped: true, reason: "budget_exhausted_before_start" });
      continue;
    }

    console.log(`=== ${testCase.title} (${testCase.niche}, ${testCase.minutes} min) ===`);
    const wallStart = Date.now();
    try {
      const ctx = await runStoryPlanAndResearch(testCase, accessToken, userId);
      await saveFixture(slug, ctx);
      const researchCost = ctx.researchRow.meta?.estimatedTotalCostUsd ?? 0;
      spent += STORY_PLAN_COST_ESTIMATE + researchCost;

      const insufficientFacts = ctx.researchRow.meta?.completionReason === "insufficient_facts_below_minimum";
      if (insufficientFacts) {
        console.log(`  research below STICKMAN_MIN_FACTS (${ctx.researchRow.fact_graph?.facts?.length ?? 0} facts) — script correctly blocked, no hallucinated script.`);
        const md = renderSampleMarkdown({
          testCase, storyPlan: ctx.storyPlan, researchRow: ctx.researchRow, scriptRow: null,
          sourcesById: new Map(), costs: { storyPlan: STORY_PLAN_COST_ESTIMATE, research: researchCost, script: 0, total: STORY_PLAN_COST_ESTIMATE + researchCost },
          timingsMs: { storyPlan: ctx.stageTimings.storyPlanMs, research: ctx.stageTimings.researchMs, script: null, total: Date.now() - wallStart },
          targetWords: ctx.project.target_words,
        });
        await writeFile(new URL(`../docs/phase1/samples/${slug}.md`, import.meta.url), md, "utf8");
        results.push({ title: testCase.title, slug, success: true, scripted: false, factCount: ctx.researchRow.fact_graph?.facts?.length ?? 0, researchCost, spentSoFar: spent });
        continue;
      }

      await admin.from("long_form_projects").update({ current_research_version_id: ctx.researchRow.id }).eq("id", ctx.projectId);
      const tScript = Date.now();
      const scriptStart = await callFn("start-long-form-script", accessToken, { projectId: ctx.projectId });
      const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 5000, label: "script" });
      const scriptMs = Date.now() - tScript;
      const scriptCost = scriptRow.meta?.estimatedTotalCostUsd ?? 0;
      spent += scriptCost;

      console.log(`  script: ${scriptRow.status}, words=${scriptRow.script_document?.actualWords}/${ctx.project.target_words}, hard=${scriptRow.script_document?.checkResults?.hard?.length ?? "?"}, warn=${scriptRow.script_document?.checkResults?.warn?.length ?? "?"}, cost~$${scriptCost.toFixed(4)}`);

      const sourcesById = await fetchSourcesById(ctx.researchRow.id);
      const md = renderSampleMarkdown({
        testCase, storyPlan: ctx.storyPlan, researchRow: ctx.researchRow, scriptRow, sourcesById,
        costs: { storyPlan: STORY_PLAN_COST_ESTIMATE, research: researchCost, script: scriptCost, total: STORY_PLAN_COST_ESTIMATE + researchCost + scriptCost },
        timingsMs: { storyPlan: ctx.stageTimings.storyPlanMs, research: ctx.stageTimings.researchMs, script: scriptMs, total: Date.now() - wallStart },
        targetWords: ctx.project.target_words,
      });
      await writeFile(new URL(`../docs/phase1/samples/${slug}.md`, import.meta.url), md, "utf8");

      results.push({
        title: testCase.title, slug, success: true, scripted: true, status: scriptRow.status,
        factCount: ctx.researchRow.fact_graph?.facts?.length ?? 0,
        actualWords: scriptRow.script_document?.actualWords, targetWords: ctx.project.target_words,
        hard: scriptRow.script_document?.checkResults?.hard?.length ?? 0, warn: scriptRow.script_document?.checkResults?.warn?.length ?? 0,
        researchCost, scriptCost, spentSoFar: spent,
      });
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
      results.push({ title: testCase.title, slug, success: false, error: e.message, spentSoFar: spent });
    }
    console.log(`  running total spend: $${spent.toFixed(4)}\n`);
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nTotal spend: $${spent.toFixed(4)}`);
  await writeFile(new URL("../docs/phase1/samples/_phase1c_summary.json", import.meta.url), JSON.stringify({ results, totalSpend: spent }, null, 2), "utf8");
}

// Guard against running the whole paid batch as a side effect of importing
// renderSampleMarkdown/fetchSourcesById/slugify elsewhere (real incident:
// a one-off script importing these triggered a full extra topic-1 run).
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
}
