// Snapshots one Script run's full DB context (project, story plan version,
// research version, generation profile, script row) — plus any recorded
// cassettes in the "script-cassettes" bucket — into a replay fixture.
// Read-only; zero model spend.
//   node scripts/phase1FinalSnapshotRun.mjs <scriptVersionId> <fixtureName>
import { admin } from "./phase1cLib.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const [scriptVersionId, name] = process.argv.slice(2);
if (!scriptVersionId || !name) {
  console.error("Usage: node scripts/phase1FinalSnapshotRun.mjs <scriptVersionId> <fixtureName>");
  process.exit(1);
}

const { data: script, error: sErr } = await admin.from("long_form_script_versions").select("*").eq("id", scriptVersionId).maybeSingle();
if (sErr || !script) throw new Error(`script ${scriptVersionId} not found: ${sErr?.message}`);
const { data: project } = await admin.from("long_form_projects").select("*").eq("id", script.project_id).maybeSingle();
const { data: storyPlanVersion } = await admin.from("long_form_story_plan_versions").select("*").eq("id", script.story_plan_version_id).maybeSingle();
const { data: researchVersion } = await admin.from("long_form_research_versions").select("*").eq("id", script.research_version_id).maybeSingle();
const { data: profile } = await admin.from("long_form_generation_profiles").select("*").eq("project_id", script.project_id).eq("status", "active").maybeSingle();

const cassettes = [];
const { data: files } = await admin.storage.from("script-cassettes").list(scriptVersionId, { limit: 100, sortBy: { column: "name", order: "asc" } });
for (const f of files ?? []) {
  const { data: blob } = await admin.storage.from("script-cassettes").download(`${scriptVersionId}/${f.name}`);
  if (blob) cassettes.push(JSON.parse(await blob.text()));
}

await mkdir(new URL("../tests/fixtures/stickman/replay/", import.meta.url), { recursive: true });
const out = { name, snapshotAt: new Date().toISOString(), script, project, storyPlanVersion, researchVersion, profile, cassettes };
await writeFile(new URL(`../tests/fixtures/stickman/replay/${name}.json`, import.meta.url), JSON.stringify(out, null, 2), "utf8");
console.log(`saved tests/fixtures/stickman/replay/${name}.json — status=${script.status} stage=${script.stage} words=${script.script_document?.actualWords} cassettes=${cassettes.length}`);
