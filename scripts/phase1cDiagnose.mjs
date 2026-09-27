// Phase 1c, Section 1 — run one topic end to end with the fixed research
// pipeline, save the fixture regardless of outcome, and print the FULL
// script failure detail (not just the error code) if it fails.
import { createTestUser, runStoryPlanAndResearch, saveFixture, callFn, pollUntilTerminal, admin } from "./phase1cLib.mjs";

const testCase = { title: process.argv[2] ?? "Why Don't We Eat Lions?", niche: process.argv[3] ?? "why_dont_we_eat_x", minutes: Number(process.argv[4] ?? 9) };
const slug = testCase.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function main() {
  const { userId, accessToken } = await createTestUser("phase1c-diagnose");
  console.log(`=== ${testCase.title} ===`);
  const ctx = await runStoryPlanAndResearch(testCase, accessToken, userId);
  await saveFixture(slug, ctx);

  if (ctx.researchRow.status === "needs_attention" && ctx.researchRow.meta?.completionReason === "insufficient_facts_below_minimum") {
    console.log("Research below STICKMAN_MIN_FACTS — script correctly blocked. detail:", JSON.stringify(ctx.researchRow.detail));
    return;
  }

  await admin.from("long_form_projects").update({ current_research_version_id: ctx.researchRow.id }).eq("id", ctx.projectId);
  const scriptStart = await callFn("start-long-form-script", accessToken, { projectId: ctx.projectId });
  const scriptRow = await pollUntilTerminal("long_form_script_versions", scriptStart.script.id, ["ready", "needs_attention", "needs_research", "failed"], { timeoutMs: 8 * 60 * 1000, intervalMs: 5000, label: "script" });

  console.log("\n=== SCRIPT RESULT ===");
  console.log("status:", scriptRow.status);
  console.log("actualWords:", scriptRow.script_document?.actualWords, "target:", ctx.project.target_words);
  if (scriptRow.status === "failed") {
    console.log("last_error_code:", scriptRow.last_error_code);
    console.log("FULL DETAIL:", JSON.stringify(scriptRow.detail, null, 2));
  } else {
    console.log("checkResults.hard:", JSON.stringify(scriptRow.script_document?.checkResults?.hard, null, 2));
    console.log("checkResults.warn count:", scriptRow.script_document?.checkResults?.warn?.length);
  }
  console.log("\nprojectId (kept, not deleted):", ctx.projectId);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
