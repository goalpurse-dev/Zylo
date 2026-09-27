import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Safe Full-Episode Rebuild (2026-09-15 pass) — Part 14's UI/wiring claims
// (A-D, H, I, J, N) verified via structural source inspection, the same
// pattern longFormResumeState.test.mjs's test L already uses for a claim a
// plain Node test can't otherwise execute (React rendering, a live Supabase
// call). The money/data-integrity guarantees (E, F, G, K, L, M, O) are
// covered separately in episodeRebuild.lifecycle.sql, run against real Mars
// data and always rolled back.

const workspaceSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8");
const apiSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/generateWorkspaceApi.js", import.meta.url), "utf8");
const generateJsxSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/generate.jsx", import.meta.url), "utf8");
const startCompileSrc = fs.readFileSync(new URL("../supabase/functions/start-long-form-scene-generation/index.ts", import.meta.url), "utf8");
const rebuildFnSrc = fs.readFileSync(new URL("../supabase/functions/rebuild-long-form-episode-generation/index.ts", import.meta.url), "utf8");
const rebuildSqlSrc = fs.readFileSync(new URL("../supabase/migrations/20260930310000_long_form_episode_rebuild.sql", import.meta.url), "utf8");

/* A: previous run exists -> Rebuild action visible (only) */
test("A: the Rebuild Episode Visuals trigger is gated on episodeGenerationCommitted, never rendered unconditionally", () => {
  const line = workspaceSrc.split("\n").find((l) => l.includes("const rebuildTrigger ="));
  assert.ok(line, "rebuildTrigger definition not found");
  assert.match(line, /episodeGenerationCommitted\s*&&/);
});

test("the rebuild trigger uses a secondary outlined treatment, not the primary lime button style", () => {
  const block = workspaceSrc.slice(workspaceSrc.indexOf("const rebuildTrigger ="), workspaceSrc.indexOf("const rebuildTrigger =") + 400);
  assert.match(block, /border-white\/10/, "must use an outlined border, not a filled lime background");
  assert.doesNotMatch(block, /bg-lime-300(?!\/)/, "must not use the primary lime fill treatment");
});

/* B: modal defaults to previous tier */
test("B: RebuildEpisodeModal initializes its own tier state from the previousTier prop and resets on open", () => {
  const block = workspaceSrc.slice(workspaceSrc.indexOf("function RebuildEpisodeModal"), workspaceSrc.indexOf("function RebuildEpisodeModal") + 600);
  assert.match(block, /useState\(previousTier\)/);
  assert.match(block, /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(open\)\s*setRebuildTier\(previousTier\)/);
});

test("the workspace passes the PREVIOUS run's own tier (episodeCharge.tier), never the main sidebar's possibly-different tier state", () => {
  assert.match(workspaceSrc, /previousTier=\{episodeCharge\?\.tier\s*\?\?\s*tier\}/);
});

/* C: switching V2/V3/V4 changes the authoritative quote */
test("C: the modal's displayed total is read live from estimates[rebuildTier] — changing rebuildTier changes what's shown, never a value frozen at open time", () => {
  const block = workspaceSrc.slice(workspaceSrc.indexOf("function RebuildEpisodeModal"), workspaceSrc.indexOf("function RebuildEpisodeModal") + 2400);
  assert.match(block, /estimates\[rebuildTier\]/);
  assert.match(block, /CompactTierSelector tier=\{rebuildTier\} locked=\{false\}/, "the tier selector must be unlocked in the rebuild modal even when the main sidebar's own selector is locked");
});

/* D: frontend price === server charged price (same estimate source, same RPC) */
test("D: the frontend quote and the confirm handler both read the SAME estimates map (estimate_long_form_episode_credits) the main Generate Episode flow already uses — no independent client-side price math", () => {
  assert.match(workspaceSrc, /const rebuildEstimate = estimates\[rebuildTier\]/);
  // estimates itself is populated exactly once, from estimateLongFormSceneCredits, shared by both the main Generate flow and the rebuild modal.
  const estimatesFetchCount = (workspaceSrc.match(/estimateLongFormSceneCredits\(/g) || []).length;
  assert.equal(estimatesFetchCount, 1, "must be exactly one call site computing estimates — the rebuild modal must reuse it, not add a second independent price calculation");
});

test("D: the server RPC prices a rebuild with the EXACT SAME function Generate Episode's own charge RPC uses", () => {
  const chargeFn = rebuildSqlSrc.slice(rebuildSqlSrc.indexOf("function public.charge_long_form_episode_generation"), rebuildSqlSrc.indexOf("function public.rebuild_long_form_episode_generation"));
  const rebuildFn = rebuildSqlSrc.slice(rebuildSqlSrc.indexOf("function public.rebuild_long_form_episode_generation"));
  assert.match(chargeFn, /estimate_long_form_episode_credits\(p_project_id, p_tier\)/);
  assert.match(rebuildFn, /estimate_long_form_episode_credits\(p_project_id, p_tier\)/);
});

/* H: new scenes carry the new generation_run_id */
test("H: start-long-form-scene-generation accepts an explicit generationRunId override and threads it onto every newly inserted scene", () => {
  assert.match(startCompileSrc, /explicitGenerationRunId\s*=\s*body\?\.generationRunId/);
  const insertBlock = startCompileSrc.slice(startCompileSrc.indexOf('.from("long_form_scenes").insert('), startCompileSrc.indexOf('.from("long_form_scenes").insert(') + 400);
  assert.match(insertBlock, /generation_run_id:\s*generationRunId/);
});

test("a rebuild never in-place-mutates the previous run's SceneRenderPlan — forceNewPlanVersion computes a genuinely incremented plan_version instead of the hardcoded 1 the normal flow uses", () => {
  assert.match(startCompileSrc, /const forceNewPlanVersion = body\?\.forceNewPlanVersion === true/);
  assert.match(startCompileSrc, /const planVersion = forceNewPlanVersion \? \(nextPlanVersionByBeatId\.get\(beat\.id\) \?\? 0\) \+ 1 : 1/);
});

test("the rebuild orchestrator always passes forceNewPlanVersion:true and its own new run id to every compile batch", () => {
  // 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION"
  // pass: the literal inline `charge.newGenerationRunId` was hoisted into a
  // named `generationRunId` const (reused across the compile call, the
  // explicit authorization step, and the dispatch kick — see below) —
  // still exactly charge.newGenerationRunId, just bound once.
  assert.match(rebuildFnSrc, /const generationRunId = String\(charge\.newGenerationRunId\);/);
  assert.match(rebuildFnSrc, /forceNewPlanVersion:\s*true,\s*generationRunId,?\s*\}\)/);
});

test("the rebuild orchestrator also authorizes and kicks dispatch for its own newGenerationRunId, not just compiles", () => {
  assert.match(rebuildFnSrc, /authorizeCompiledScenesForDispatch\(admin, \{ visualWorldVersionId: worldId, beatIds, generationRunId \}\)/);
  assert.match(rebuildFnSrc, /functions\/v1\/advance-long-form-scene-generation/);
});

/* I: Generate Workspace only shows the active run's scenes */
test("I: fetchScenePlansAndScenes filters scenes by generation_run_id, never fetching every scene ever compiled for the Visual World regardless of run", () => {
  const block = apiSrc.slice(apiSrc.indexOf("export async function fetchScenePlansAndScenes"), apiSrc.indexOf("export async function fetchScenePlansAndScenes") + 700);
  assert.match(block, /\.eq\("generation_run_id", generationRunId\)/);
  assert.match(block, /\.is\("generation_run_id", null\)/, "a project with only pre-charge test scenes (null generation_run_id) must still resolve correctly");
});

// 2026-09-19 forensic fix (real Mars incident): generate.jsx used to pass
// the raw project.active_generation_charge_id pointer straight through,
// unvalidated — but that pointer is intentionally left untouched by
// adopt_visual_plan_version across a replan (billing history must survive),
// so it can point at a charge for an entirely different, superseded
// VisualPlanVersion. Real Mars reproduction: after adopting a new plan
// with zero compiled scenes, this used to scope the scenes query to the
// OLD plan's still-'charged' run, which happened to return nothing useful
// but was never validated as belonging to the CURRENT plan in the first
// place. Now scoped to the ALREADY-VALIDATED `charge` (fetchEpisodeCharge's
// own return value, which is null whenever the charge's plan doesn't match
// project.current_visual_plan_version_id) — never the raw pointer.
test("generate.jsx scopes fetchScenePlansAndScenes to the VALIDATED episode charge (never the raw, unvalidated active_generation_charge_id pointer, which can point at a charge for a superseded plan)", () => {
  assert.match(generateJsxSrc, /fetchScenePlansAndScenes\(world\.id, charge\?\.id \?\? null\)/);
  assert.doesNotMatch(generateJsxSrc, /fetchScenePlansAndScenes\(world\.id, project\.active_generation_charge_id/, "must never pass the raw, unvalidated pointer straight through again");
});

test("fetchEpisodeCharge reads the project's explicit active_generation_charge_id pointer, not a bare status='charged' filter that could match an unrelated stale row", () => {
  const block = apiSrc.slice(apiSrc.indexOf("export async function fetchEpisodeCharge"), apiSrc.indexOf("export async function fetchEpisodeCharge") + 700);
  assert.match(block, /project\?\.active_generation_charge_id/);
  assert.match(block, /\.eq\("id", project\.active_generation_charge_id\)/);
});

// 2026-09-19 forensic fix (real Mars incident): fetchEpisodeCharge must
// reject a charge whose OWN visual_plan_version_id doesn't match the
// project's CURRENT plan — adopt_visual_plan_version deliberately never
// touches active_generation_charge_id (billing history survives a
// replan), so this read path is the one place that must recognize the
// pointer can be stale relative to the plan.
test("fetchEpisodeCharge returns null when the charge's visual_plan_version_id does not match the project's current_visual_plan_version_id (a real charge for a SUPERSEDED plan, never treated as proof the current plan is generating)", () => {
  const block = apiSrc.slice(apiSrc.indexOf("export async function fetchEpisodeCharge"), apiSrc.indexOf("export async function fetchEpisodeCharge") + 700);
  assert.match(block, /data\.visual_plan_version_id !== project\.current_visual_plan_version_id/);
  assert.match(block, /return null/);
});

/* J: Visual World / canonical references are reused, never rebuilt */
test("J: the rebuild edge function never calls start-long-form-visual-world or writes to long_form_visual_world_versions/long_form_reference_assets — it only reads the existing world", () => {
  assert.doesNotMatch(rebuildFnSrc, /start-long-form-visual-world/);
  assert.doesNotMatch(rebuildFnSrc, /\.from\("long_form_visual_world_versions"\)\.(insert|update|upsert)/);
  assert.doesNotMatch(rebuildFnSrc, /\.from\("long_form_reference_assets"\)\.(insert|update|upsert)/);
});

test("J: the rebuild SQL function never touches visual_world_version_id beyond reading the project's own current pointer", () => {
  const rebuildFn = rebuildSqlSrc.slice(rebuildSqlSrc.indexOf("function public.rebuild_long_form_episode_generation"));
  assert.doesNotMatch(rebuildFn, /update public\.long_form_visual_world_versions/);
});

/* N: credit pop/balance animation matches the existing Generate Episode pattern exactly */
// 2026-09-19 billing-incident fix (real Mars report: the displayed balance
// dropped by 242 credits even though "Generate Episode" failed server-side
// and the real DB balance never moved). emitCreditSpend used to fire
// BEFORE awaiting the server call, unconditionally, with no rollback on
// failure — useProfileCredits' optimistic "pending spend" then had no real
// balance decrease to reconcile against and stayed wrong indefinitely.
// Both handlers now fire it only AFTER a confirmed, non-replayed success,
// using the server's own creditsCharged — the same pattern
// handleRetryScene/handleEditScene/handleEscalateScene already used
// correctly the whole time.
test("N: handleGenerate and handleRebuild only call emitCreditSpend AFTER a confirmed success, using the server's own creditsCharged, never before/unconditionally", () => {
  const generateBlock = workspaceSrc.slice(workspaceSrc.indexOf("const handleGenerate = async"), workspaceSrc.indexOf("const handleGenerate = async") + 1300);
  const rebuildBlock = workspaceSrc.slice(workspaceSrc.indexOf("const handleRebuild = async"), workspaceSrc.indexOf("const handleRebuild = async") + 900);
  assert.match(generateBlock, /emitCreditSpend\(result\.creditsCharged, "Long Form episode"\)/);
  assert.match(rebuildBlock, /emitCreditSpend\(result\.creditsCharged, "Episode rebuild"\)/);
  // Never fired before the await, and never unconditionally — must be
  // gated on result.ok (and never re-fire credits for an idempotent replay).
  assert.ok(generateBlock.indexOf("await onGenerateEpisode") < generateBlock.indexOf("emitCreditSpend"));
  assert.ok(rebuildBlock.indexOf("await onRebuildEpisode") < rebuildBlock.indexOf("emitCreditSpend"));
  assert.match(generateBlock, /result\.creditsCharged && !result\.alreadyCharged/);
  assert.match(rebuildBlock, /result\.creditsCharged && !result\.alreadyCharged/);
});

test("M: a credit precheck still happens before the paid call is even made — insufficient balance opens NoCreditsModal instead of an optimistic deduction", () => {
  const rebuildBlock = workspaceSrc.slice(workspaceSrc.indexOf("const handleRebuild = async"), workspaceSrc.indexOf("const handleRebuild = async") + 900);
  const noCreditsIdx = rebuildBlock.indexOf("setNoCreditsOpen(true)");
  const callIdx = rebuildBlock.indexOf("await onRebuildEpisode");
  assert.ok(noCreditsIdx > -1 && callIdx > -1 && noCreditsIdx < callIdx, "the balance check must run before the paid call, not after");
});

/* O: active pointer only switches after a fully successful setup */
test("O: the SQL function updates long_form_projects.active_generation_charge_id only AFTER the new charge row is inserted, never before", () => {
  const rebuildFn = rebuildSqlSrc.slice(rebuildSqlSrc.indexOf("function public.rebuild_long_form_episode_generation"));
  const insertIdx = rebuildFn.indexOf("insert into public.long_form_episode_generation_charges");
  const pointerUpdateIdx = rebuildFn.indexOf("active_generation_charge_id = new_id");
  assert.ok(insertIdx > -1 && pointerUpdateIdx > -1 && insertIdx < pointerUpdateIdx);
});

test("O: on the frontend, the modal closes and the workspace switches views only when result.ok is true — a failed rebuild leaves the modal open with an error, never a silent switch", () => {
  const block = workspaceSrc.slice(workspaceSrc.indexOf("const handleRebuild = async"), workspaceSrc.indexOf("const handleRebuild = async") + 900);
  assert.match(block, /if \(result\?\.ok\) \{[\s\S]{0,150}setRebuildModalOpen\(false\)/);
  assert.match(block, /setRebuildError\(result\?\.message/);
});
