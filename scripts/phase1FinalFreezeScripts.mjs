// Phase 1 FINAL, Step 3 — freeze finished scripts as permanent fixtures under
// tests/fixtures/stickman/scripts/. Phase 2 (scenes/timing) consumes these and
// must never regenerate a script to test downstream stages. Read-only.
//   node scripts/phase1FinalFreezeScripts.mjs <slug>=<scriptVersionId>[:<myScore>] ...
import { admin } from "./phase1cLib.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const specs = process.argv.slice(2).map((arg) => {
  const [slug, rest] = arg.split("=");
  const [id, myScore] = rest.split(":");
  return { slug, id, myScore: myScore ? Number(myScore) : null };
});
if (!specs.length) {
  console.error("Usage: node scripts/phase1FinalFreezeScripts.mjs <slug>=<scriptVersionId>[:<myScore>] ...");
  process.exit(1);
}

// The model columns were hardcoded before Phase 1 FINAL; the cost ledger records what actually ran.
function modelsFromLedger(script) {
  const ledger = script.meta?.callLedger ?? [];
  const pick = (prefix, fallback) => ledger.find((l) => String(l.stage).startsWith(prefix))?.model ?? fallback;
  return { draft: pick("draft", script.generation_model), critic: pick("critic", script.critic_model), revision: pick("revision", script.revision_model) };
}

await mkdir(new URL("../tests/fixtures/stickman/scripts/", import.meta.url), { recursive: true });

for (const { slug, id, myScore } of specs) {
  const { data: script } = await admin.from("long_form_script_versions").select("*").eq("id", id).maybeSingle();
  if (!script?.script_document) throw new Error(`${slug}: script ${id} missing or has no document`);
  const { data: project } = await admin.from("long_form_projects").select("id, topic, target_words, resolved_length_minutes, resolved_explanation_depth").eq("id", script.project_id).maybeSingle();
  const { data: storyPlanVersion } = await admin.from("long_form_story_plan_versions").select("id, story_plan").eq("id", script.story_plan_version_id).maybeSingle();
  const { data: profile } = await admin.from("long_form_generation_profiles").select("visual_recipe, recipe_version, raw_setup_snapshot").eq("project_id", script.project_id).eq("status", "active").maybeSingle();

  const doc = script.script_document;
  const fixture = {
    slug,
    frozenAt: new Date().toISOString(),
    source: { projectId: script.project_id, scriptVersionId: script.id, storyPlanVersionId: script.story_plan_version_id, researchVersionId: script.research_version_id },
    topic: project?.topic ?? null,
    niche: profile?.raw_setup_snapshot?.niche ?? null,
    visualRecipe: profile?.visual_recipe ?? null,
    title: doc.title ?? storyPlanVersion?.story_plan?.recommendedTitle ?? null,
    targetWords: project?.target_words ?? null,
    actualWords: doc.actualWords ?? null,
    lengthRatio: project?.target_words && doc.actualWords ? Number((doc.actualWords / project.target_words).toFixed(3)) : null,
    status: script.status,
    lastErrorCode: script.last_error_code ?? null,
    models: modelsFromLedger(script),
    criticScore: script.critic_result?.overallScore ?? null,
    criticScores: script.critic_result?.scores ?? null,
    judgedScore: myScore,
    costUsd: script.meta?.estimatedTotalCostUsd ?? null,
    callLedger: script.meta?.callLedger ?? [],
    storyPlan: storyPlanVersion?.story_plan ?? null,
    script_document: doc,
  };
  const path = new URL(`../tests/fixtures/stickman/scripts/${slug}.json`, import.meta.url);
  await writeFile(path, JSON.stringify(fixture, null, 2), "utf8");
  console.log(`froze ${slug}: ${fixture.status}, ${fixture.actualWords}/${fixture.targetWords} words, critic ${fixture.criticScore}, judged ${myScore ?? "-"}, ${fixture.models.draft}`);
}
