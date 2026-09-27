// Phase 1d test harness — replays Script from an EXISTING research fixture
// (zero new research spend) against the new write-first draft + claim
// verify/fix pipeline. Usage: node scripts/phase1dReplayTest.mjs <slug>
import { createTestUser, loadFixture, replayScriptFromFixture } from "./phase1cLib.mjs";

const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/phase1dReplayTest.mjs <fixture-slug>"); process.exit(1); }

async function main() {
  const fixture = await loadFixture(slug);
  console.log(`=== Replaying "${fixture.project.topic}" from fixture (${fixture.research.fact_graph?.facts?.length ?? 0} research-lite facts, saved ${fixture.savedAt}) ===`);
  const { userId, accessToken } = await createTestUser("phase1d-replay");
  const wallStart = Date.now();
  const { projectId, scriptRow, scriptMs } = await replayScriptFromFixture(fixture, accessToken, userId);
  const wallMs = Date.now() - wallStart;

  const doc = scriptRow.script_document;
  console.log(`\n=== RESULT ===`);
  console.log("status:", scriptRow.status);
  console.log("words:", doc?.actualWords, "/ target:", fixture.project.target_words, `(${doc?.actualWords && fixture.project.target_words ? Math.round((doc.actualWords / fixture.project.target_words) * 100) : "?"}%)`);
  console.log("cost: $" + (scriptRow.meta?.estimatedTotalCostUsd ?? 0).toFixed(4), "| wall-clock:", (wallMs / 1000).toFixed(1) + "s", "(script stage alone:", (scriptMs / 1000).toFixed(1) + "s)");
  console.log("claimVerifyCalls:", scriptRow.meta?.claimVerifyCalls, "claimFixCalls:", scriptRow.meta?.claimFixCalls, "modelCalls:", scriptRow.meta?.modelCalls);
  console.log("HARD failures:", JSON.stringify(doc?.checkResults?.hard ?? [], null, 2));
  console.log("WARN count:", doc?.checkResults?.warn?.length);
  console.log(JSON.stringify(doc?.checkResults?.warn ?? [], null, 2));
  console.log("\nclaims total:", doc?.claims?.length, "| claimVerification:", JSON.stringify(doc?.claimVerification, null, 2));
  console.log("\nresearchWarnings:", JSON.stringify(doc?.researchWarnings ?? [], null, 2));
  console.log("\nplantQuote:", JSON.stringify(doc?.plantQuote));
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
