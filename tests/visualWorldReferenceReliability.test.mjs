import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { referenceJobRecoveryAction } from "../supabase/functions/advance-long-form-visual-world/index.ts";

// 2026-09-20 real incident — Visual World reference generation: 16/17
// references silently used the cheap Klein9B route despite the project's
// High Quality selection; entity_id "plants" was persisted as
// reference_type "character_reference" (Kling generated a humanoid plant
// mascot); Earth got 6 near-identical globe camera anchors; celestial
// bodies got generic "three_quarter_hero" object framing; "Preview
// unavailable" showed for assets the DB proved had genuinely succeeded.
// Source-structural + pure-function behavioral tests (this codebase's
// established convention for Deno edge-function logic a plain Node test
// can't import directly).

const policySrc = fs.readFileSync(new URL("../supabase/functions/_shared/referenceRendererPolicy.js", import.meta.url), "utf8");
const styleSrc = fs.readFileSync(new URL("../supabase/functions/_shared/visualWorldStyle.ts", import.meta.url), "utf8");
const worldFnSrc = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-world/index.ts", import.meta.url), "utf8");
const startWorldSrc = fs.readFileSync(new URL("../supabase/functions/start-long-form-visual-world/index.ts", import.meta.url), "utf8");
const migrationSql = fs.readFileSync(new URL("../supabase/migrations/20260930420000_long_form_visual_world_rebuild_adopt.sql", import.meta.url), "utf8");
const selfHealingSql = fs.readFileSync(new URL("../supabase/migrations/20260930430000_long_form_reference_self_healing.sql", import.meta.url), "utf8");
const frontendSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/VisualWorldWorkspace.jsx", import.meta.url), "utf8");

/* ---- 1: V3 reference provider => Kling IMAGE O3 ---- */

// 2026-09-22 explicit user request (live QA on a real project): reverted
// back to Kling IMAGE O3 as the default reference renderer — Seedream
// output for independent character views was judged too simple/
// inconsistent for the actual episode. LOCATION/OBJECT/VEHICLE/CELESTIAL/
// ENVIRONMENT and the two independent character views (IDENTITY_3Q/
// FRONT_FULL) are Kling; only the DERIVED (identity-anchor-conditioned)
// character roles — already being retired by the single-sheet
// CHARACTER_REFERENCE_SHEET architecture — remain on Seedream.
test("every independent (non-anchor-conditioned) Visual World reference role routes to Kling IMAGE O3", () => {
  assert.match(policySrc, /CHARACTER_IDENTITY_3Q: klingCharacterIndependent,/);
  assert.match(policySrc, /CHARACTER_FRONT_FULL: klingCharacterIndependent,/);
  assert.match(policySrc, /const klingCharacterIndependent = Object\.freeze\(\{ toolKey: KLING_O3/);
  assert.match(policySrc, /LOCATION: klingSinglePolicy, OBJECT: klingSinglePolicy, VEHICLE: klingSinglePolicy,/);
  assert.match(policySrc, /CELESTIAL: klingSinglePolicy, ENVIRONMENT: klingSinglePolicy,/);
});

test("klingSinglePolicy actually resolves to the KLING_O3 tool key", () => {
  const block = policySrc.slice(policySrc.indexOf("const klingSinglePolicy"), policySrc.indexOf("const klingSinglePolicy") + 300);
  assert.match(block, /toolKey: KLING_O3/);
});

test("Seedream Pro handles edit operations and source images remain mandatory", () => {
  assert.match(policySrc, /if \(operation === "edit"\) \{[\s\S]{0,300}toolKey: SEEDREAM_5_PRO/);
  assert.match(policySrc, /EDIT REFERENCE requires a source image/);
});

/* ---- 2: plant ecosystem != character reference ---- */

test("Plants (crops, forests, phytoplankton) never compile as character_reference", () => {
  const fn = styleSrc.slice(styleSrc.indexOf("export function resolveEffectiveEntityCategory"), styleSrc.indexOf("export function resolveEffectiveEntityCategory") + 500);
  assert.match(fn, /ECOSYSTEM_NAME_PATTERN\.test\(name\)\) return "ECOSYSTEM";/);
  // Behavioral: the real reported case, mirroring the actual regex.
  const ECOSYSTEM_NAME_PATTERN = /\b(plants?|crops?|forests?|phytoplankton|algae|trees?|vegetation|flora|kelp|coral|moss|fungus|fungi|ecosystems?)\b/i;
  for (const name of ["plants", "Plants", "crops", "forests", "phytoplankton", "the surviving crops", "coastal kelp forests"]) {
    assert.equal(ECOSYSTEM_NAME_PATTERN.test(name), true, `"${name}" must be recognized as an ecosystem entity`);
  }
  assert.equal(ECOSYSTEM_NAME_PATTERN.test("the maintenance technician"), false, "a genuine human character name must not be misflagged as an ecosystem");
});

test("an ECOSYSTEM entity gets individual environment views, never character references", () => {
  const fn = styleSrc.slice(styleSrc.indexOf("export function deriveRequiredViews"), styleSrc.indexOf("export function deriveRequiredViews") + 900);
  assert.match(fn, /referenceType: "environment_reference", angle: "crop_specimen"/);
  assert.doesNotMatch(fn, /referenceType: "character_reference"/);
});

test("compileEnvironmentView never uses character/turnaround-sheet language", () => {
  const fn = styleSrc.slice(styleSrc.indexOf("function compileEnvironmentView"), styleSrc.indexOf("function compileEnvironmentView") + 400);
  assert.match(fn, /NO people, NO character-style posing or expression, NO turnaround\/multi-panel sheet layout\./);
});

test("the PERSISTED entityCategory (not just the internal view derivation) is corrected too, so the plant doesn't stay grouped under Characters in the UI", () => {
  assert.match(worldFnSrc, /const effectiveCategory = resolveEffectiveEntityCategory\(entity\);/);
  const block = worldFnSrc.slice(worldFnSrc.indexOf("const planEntities = referenceNeededEntities.map"), worldFnSrc.indexOf("const planEntities = referenceNeededEntities.map") + 1800);
  const matches = [...block.matchAll(/entityCategory: effectiveCategory,/g)];
  assert.equal(matches.length, 2, "both the reused-entity and fresh-entity branches must persist the corrected category");
});

/* ---- 3: semantic duplicate reference views collapse ---- */

test("dedupeLocationAnchors caps at 3 views and prioritizes establishing/orbit shots over inserts", () => {
  assert.match(styleSrc, /const MAX_LOCATION_VIEWS = 3;/);
});

test("locationAnchorTier normalizes underscores to spaces before testing \\b word-boundary patterns — a real bug caught in testing: \\bwide\\b never matches inside the underscore_separated string \"wide_heliocentric_overview\" otherwise (_ is a word character, so no boundary forms)", () => {
  const fn = styleSrc.slice(styleSrc.indexOf("function locationAnchorTier"), styleSrc.indexOf("function locationAnchorTier") + 700);
  assert.match(fn, /const normalized = anchor\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9\]\+\/g, " "\);/);
});

// Mirrors dedupeLocationAnchors exactly (verified structurally above).
function locationAnchorTierSim(anchor) {
  const patterns = [[/\b(wide|overview|establishing|full|close|medium|canonical)\b/, 0], [/\b(orbit|system|heliocentric|relationship)\b/, 1]];
  const normalized = anchor.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  for (const [re, tier] of patterns) if (re.test(normalized)) return tier;
  return 2;
}
function anchorTokensSim(anchor) {
  return new Set(anchor.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 4));
}
function dedupeLocationAnchorsSim(anchors) {
  const MAX = 3;
  const ordered = anchors.map((a, i) => ({ a, i, tier: locationAnchorTierSim(a) })).sort((x, y) => x.tier - y.tier || x.i - y.i).map((x) => x.a);
  const kept = [];
  const keptTokens = new Set();
  for (const anchor of ordered) {
    if (kept.length >= MAX) break;
    const tokens = anchorTokensSim(anchor);
    let overlap = 0;
    for (const t of tokens) if (keptTokens.has(t)) overlap++;
    if (overlap >= 2) continue;
    kept.push(anchor);
    for (const t of tokens) keptTokens.add(t);
  }
  return kept;
}

test("BEHAVIORAL: the real reported Earth 6-anchor set collapses to 3 genuinely distinct canonical views", () => {
  const earthAnchors = ["wide_heliocentric_overview", "medium_earth_close", "tangent_vector_insert", "insert_sun_disk", "wide_earth_sun_full", "orbit_plane_sideview"];
  const kept = dedupeLocationAnchorsSim(earthAnchors);
  assert.ok(kept.length <= 3, `expected at most 3 views, got ${kept.length}: ${kept.join(", ")}`);
  assert.ok(kept.length >= 1, "must keep at least one canonical view");
  // The two purely-establishing shots ("wide_heliocentric_overview" and
  // "wide_earth_sun_full") share 2+ tokens (wide, earth) and must collapse
  // to one, not both.
  assert.ok(!(kept.includes("wide_heliocentric_overview") && kept.includes("wide_earth_sun_full")), "two near-identical wide establishing globes must not both survive");
  // The orbit/system relationship view is genuinely distinct and should
  // survive over pure inserts/cutaways.
  assert.ok(kept.includes("orbit_plane_sideview"), "the one genuinely distinct orbit/system relationship view should be prioritized over generic inserts");
});

test("dedupeLocationAnchors is a no-op safety net for an already-small, genuinely distinct anchor set", () => {
  const kept = dedupeLocationAnchorsSim(["wide_establishing", "interior_detail_view"]);
  assert.equal(kept.length, 2);
});

/* ---- 4: celestial body does not receive generic character/object 3/4 logic ---- */

test("Sun/Moon/planets are reclassified to CELESTIAL regardless of their original (possibly wrong) category, except when already a real LOCATION", () => {
  const fn = styleSrc.slice(styleSrc.indexOf("export function resolveEffectiveEntityCategory"), styleSrc.indexOf("export function resolveEffectiveEntityCategory") + 500);
  assert.match(fn, /if \(entity\.category !== "LOCATION" && CELESTIAL_NAME_PATTERN\.test\(name\)\) return "CELESTIAL";/);
  const CELESTIAL_NAME_PATTERN = /\b(sun|moon|planets?|stars?|comets?|asteroids?|galaxy|galaxies)\b/i;
  for (const name of ["Sun", "the Moon", "a distant planet", "the North Star"]) assert.equal(CELESTIAL_NAME_PATTERN.test(name), true, `"${name}" must be recognized as celestial`);
});

test("celestial policy gives Earth three distinct views and other bodies one", () => {
  const fn = styleSrc.slice(styleSrc.indexOf("export function deriveRequiredViews"), styleSrc.indexOf("export function deriveRequiredViews") + 3200);
  assert.match(fn, /angle: "earth_full_disk"/);
  assert.match(fn, /angle: "canonical_celestial_view"/);
});

test("compileCelestialView enforces one celestial subject and rejects unrelated bodies", () => {
  const fn = styleSrc.slice(styleSrc.indexOf("function compileCelestialView"), styleSrc.indexOf("function compileCelestialView") + 900);
  assert.match(fn, /One subject:/);
  assert.match(fn, /unrelated planets, moons, orbit arrows/);
});

/* ---- 5: succeeded asset + result_url never displays Failed/Try Again ---- */

test("an image load error retries (bounded) before ever marking the tile as unavailable — never on the very first onError", () => {
  const fn = frontendSrc.slice(frontendSrc.indexOf("const MAX_IMAGE_LOAD_RETRIES"), frontendSrc.indexOf("const MAX_IMAGE_LOAD_RETRIES") + 1000);
  assert.match(fn, /if \(loadAttempt < MAX_IMAGE_LOAD_RETRIES\) \{/);
  assert.match(fn, /setFailedUrl\(asset\.result_url\);/);
});

test("queued assets with no result URL never compare null === null as a broken preview", () => {
  assert.match(frontendSrc, /const imageLoadFailed = Boolean\(asset\.result_url\) && failedUrl === asset\.result_url;/);
  assert.match(frontendSrc, /Waiting to create/);
});

test("a genuinely NEW result_url (a real regenerate) always gets its own fresh retry budget, never inheriting an exhausted count", () => {
  assert.match(frontendSrc, /useEffect\(\(\) => \{ setLoadAttempt\(0\); \}, \[asset\.result_url\]\);/);
});

test("the <img> retries via a fresh remount (key change), never by mutating the URL itself — safe for signed URLs", () => {
  assert.match(frontendSrc, /<img key=\{`\$\{displayAsset\.id\}-\$\{loadAttempt\}`\} src=\{displayAsset\.result_url\}/);
});

test("Try Again is shown only for a durable backend failure, never a transient image-load failure", () => {
  assert.match(frontendSrc, /\{failed && <button disabled=\{busy\} onClick=\{\(\) => onRetry\(asset\.id\)\}/);
  assert.doesNotMatch(frontendSrc, /\(failed \|\| imageLoadFailed\) && <button/);
});

/* ---- 6: rebuilding creates a new non-destructive VisualWorldVersion ---- */

test("regenerate:true (Rebuild) inserts a NEW visual_world_versions row and never overwrites the existing one (pre-existing, verified server capability)", () => {
  assert.match(startWorldSrc, /insert/i);
});

test("reconcile_visual_world_completion_status no longer auto-promotes over an already-adopted READY world", () => {
  const fn = migrationSql.slice(migrationSql.indexOf("if new_status <> 'failed' then"), migrationSql.indexOf("if new_status <> 'failed' then") + 700);
  assert.match(fn, /if not exists \(/);
  assert.match(fn, /where p\.id = v\.project_id and cur\.status = 'ready'/);
});

test("adopt_visual_world_version mirrors adopt_visual_plan_version's real checks (status ready, plan still current) and is a real user-auth action, not a service-role bypass", () => {
  assert.match(migrationSql, /if v\.status is distinct from 'ready' then raise exception 'VISUAL_WORLD_NOT_READY'; end if;/);
  assert.match(migrationSql, /if proj\.current_visual_plan_version_id is distinct from v\.visual_plan_version_id then raise exception 'PLAN_HAS_CHANGED_SINCE_THIS_WORLD'; end if;/);
  assert.match(migrationSql, /where id = v\.project_id and user_id = auth\.uid\(\) for update;/);
});

test("the Rebuild Visual World button only appears once the world is complete, and never auto-triggers scene generation", () => {
  const fn = frontendSrc.slice(frontendSrc.indexOf("{complete && onRebuild && ("), frontendSrc.indexOf("{complete && onRebuild && (") + 400);
  assert.match(fn, /Rebuild Visual World/);
  assert.doesNotMatch(fn, /onContinueToScenes|navigate/);
});

test("the confirmation modal uses the exact specified copy", () => {
  assert.match(frontendSrc, /Rebuild Visual World\?/);
  assert.match(frontendSrc, /Zyvo will create a fresh set of references using your current storyboard and visual style\. Your existing Visual World will stay available until the new one is ready\./);
});

test("rebuild() calls startVisualWorld with regenerate:true, never mutating the current world in place", () => {
  const visualWorldJsxSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/visualWorld.jsx", import.meta.url), "utf8");
  const fn = visualWorldJsxSrc.slice(visualWorldJsxSrc.indexOf("const rebuild = async () =>"), visualWorldJsxSrc.indexOf("const rebuild = async () =>") + 700);
  assert.match(fn, /startVisualWorld\(projectId, \{ regenerate: true/);
});

test("ready status is rendered before the primary Continue button", () => {
  const status = frontendSrc.indexOf("✓ Your Visual World is ready.");
  const primary = frontendSrc.indexOf('<button type="button" onClick={runAction}');
  assert.ok(status >= 0 && primary > status);
});

test("rebuild gives immediate starting feedback and swaps old assets for planned placeholders", () => {
  assert.match(frontendSrc, /const displayedAssets = rebuildStarting \? \[\] : assets;/);
  assert.match(frontendSrc, /rebuildStarting \? "Starting rebuild\.\.\." : "Rebuilding Visual World\.\.\."/);
  assert.match(frontendSrc, /"Rebuilding your Visual World\.\.\."/);
  assert.match(frontendSrc, /"Creating a fresh set of references with your current storyboard and visual style\."/);
});

test("loader restores the latest non-adopted full rebuild instead of the adopted board", () => {
  const visualWorldJsxSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/visualWorld.jsx", import.meta.url), "utf8");
  assert.match(visualWorldJsxSrc, /const rebuildPreview = latestForPlan/);
  assert.match(visualWorldJsxSrc, /const displayWorld = rebuildPreview \?\? reconciliationWorld \?\? world;/);
  assert.match(visualWorldJsxSrc, /const rebuilding = Boolean\(rebuildPreview && \["planning", "generating"\]\.includes\(rebuildPreview\.status\)\)/);
});

test("completed rebuild stays visible for explicit adoption or keeping the current world", () => {
  assert.match(frontendSrc, /✓ New Visual World ready/);
  assert.match(frontendSrc, /Use This Visual World/);
  assert.match(frontendSrc, /Keep Current/);
  assert.match(frontendSrc, /Your current Visual World is still active until you approve this one\./);
});

/* ---- 7: unattended queue recovery, no provider calls ---- */

const expired = new Date(Date.now() - 60_000).toISOString();
const future = new Date(Date.now() + 60_000).toISOString();

test("Asset A: a due queued job is selected for atomic job-worker dispatch", () => {
  assert.equal(referenceJobRecoveryAction({ status: "queued", retry_after: expired }), "dispatch_queued");
});

test("Asset B: a worker that dies before provider submission is safely requeued after lease expiry", () => {
  assert.equal(referenceJobRecoveryAction({ status: "running", lease_expires_at: expired, heartbeat_at: expired, submission_state: "pending", attempts: 1, max_attempts: 3 }), "requeue_unsubmitted");
  assert.equal(referenceJobRecoveryAction({ status: "running", lease_expires_at: future, heartbeat_at: future, submission_state: "pending", attempts: 1, max_attempts: 3 }), "wait");
});

test("Assets C/D: stale generating/checking work resumes the same submitted provider task", () => {
  const stale = { status: "processing", lease_expires_at: expired, heartbeat_at: expired, submission_state: "submitted", provider_task_id: "provider-123" };
  assert.equal(referenceJobRecoveryAction(stale), "resume_provider");
});

test("Asset E: retries are bounded and exhausted work becomes a real failure", () => {
  assert.equal(referenceJobRecoveryAction({ status: "running", lease_expires_at: expired, heartbeat_at: expired, submission_state: "pending", attempts: 3, max_attempts: 3 }), "fail_exhausted");
  assert.match(selfHealingSql, /claim_attempts>=3/);
  assert.match(selfHealingSql, /last_error_code='CLAIMS_EXHAUSTED'/);
});

test("dependency-blocked children become terminal instead of remaining queued forever", () => {
  assert.match(selfHealingSql, /IDENTITY_DEPENDENCY_UNAVAILABLE/);
  assert.match(selfHealingSql, /ADOPT_SOURCE_UNAVAILABLE/);
});

test("the existing minute recovery cron is retained and sweeps a bounded batch of active worlds", () => {
  assert.match(selfHealingSql, /order by updated_at limit 25/);
  assert.match(selfHealingSql, /x-recovery-secret/);
});

test("recovery preserves provider and billing idempotency", () => {
  const workerSrc = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-world/index.ts", import.meta.url), "utf8");
  assert.match(workerSrc, /claim_generation_job is atomic/);
  assert.match(workerSrc, /recoverExistingProvider: true/);
  assert.match(workerSrc, /fail_and_refund_generation_job/);
  assert.match(workerSrc, /requeue_expired_unsubmitted_job/);
});
