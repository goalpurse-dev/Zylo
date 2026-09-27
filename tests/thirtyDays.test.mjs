import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("30 Days collage cache preserves semantic reference order", () => {
  const source = read("src/components/viral-tools/thirty-days/utils/referenceCollage.js");
  assert.match(source, /refs\.map\(\(r\) => r\.id\)\.join\("\|"\)/);
  assert.doesNotMatch(source, /refs\.map\(\(r\) => r\.id\)\.slice\(\)\.sort\(\)/);
  assert.match(source, /if \(!uploaded\.wasPublic\)/);
});

test("30 Days visual children are reservation-backed zero-charge jobs", () => {
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  assert.equal((api.match(/skipCreditCheck: true/g) || []).length, 2);
  assert.match(api, /skipCreditCheck: !paidRetry/);
  assert.equal((api.match(/template: "thirty-days"/g) || []).length, 3);

  const worker = read("supabase/functions/job-worker/index.ts");
  assert.match(worker, /authorize_thirty_days_asset_job/);
  assert.match(worker, /billing_reservation_rejected/);

  const pricingMigration = read("supabase/migrations/20260824000000_thirty_days_video_reservation_pricing.sql");
  assert.match(pricingMigration, /billing_reservation,template.*thirty-days/s);
  assert.match(pricingMigration, /generation\.reservation_status = 'reserved'/);
  assert.match(pricingMigration, /asset\.tool_key = NEW\.tool_key/);
  assert.match(pricingMigration, /NEW\.charge_credits := 0/);
  assert.doesNotMatch(pricingMigration, /CREATE OR REPLACE FUNCTION public\.enforce_cooking_job_pricing/);

  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  assert.match(hook, /Invalid or inactive 30 Days asset reservation/);
  assert.match(hook, /videoJobId = null/);
});

test("30 Days billing migration removes client prices and count-based refunds", () => {
  const migration = read("supabase/migrations/20260823174354_thirty_days_billing_security.sql");
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.begin_thirty_days_generation\([\s\S]*?TO service_role;/);
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.begin_thirty_days_generation\([\s\S]{0,500}p_cost/);
  assert.match(migration, /sum\(cost_credits\) FILTER \(WHERE status IN \('failed', 'canceled'\)\)/);
  assert.doesNotMatch(migration, /p_completed_assets\s*\/\s*p_total_assets/);
  assert.match(migration, /UNIQUE \(generation_id, operation\)/);
});

test("30 Days tiers use database-backed image and video engines", () => {
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  assert.match(api, /REFERENCE_IMAGE = \{ toolKey: "image:thirtydays1k", width: 768, height: 1376, credits: 5 \}/);
  assert.match(api, /thirtydays-v2[\s\S]{0,500}videoToolKey: "video:seedance15pro"[\s\S]{0,200}videoCredits: 6[\s\S]{0,100}withSound: false/);
  assert.match(api, /thirtydays-v3[\s\S]{0,500}videoToolKey: "video:veo31lite"[\s\S]{0,200}videoDurationSec: 6[\s\S]{0,100}videoCredits: 18/);
  assert.match(api, /thirtydays-v4[\s\S]{0,500}videoToolKey: "video:cartoondriveseedance720"[\s\S]{0,200}videoCredits: 80/);
  assert.match(api, /from\("thirty_days_quality_tiers"\)/);

  const migration = read("supabase/migrations/20260824200941_thirty_days_styles_and_quality_tiers.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.thirty_days_quality_tiers/);
  assert.match(migration, /'video:veo31lite'.*'google:veo@3\.1-lite'.*6, 18, false/s);
  assert.match(migration, /'video:cartoondriveseedance720'.*'bytedance:seedance@2\.0'.*5, 80, false/s);
  assert.match(migration, /v_reference_count \* v_tier\.reference_cost_credits[\s\S]*8 \* v_tier\.image_cost_credits[\s\S]*8 \* v_tier\.video_cost_credits/);
  assert.match(migration, /COALESCE\(\(v_job\.input->>'withSound'\)::boolean, true\) <> v_tier\.with_sound/);
});

test("30 Days uses four milestone days with two independently billed scenes each", () => {
  const planner = read("supabase/functions/thirty-days-planner/index.ts");
  assert.match(planner, /const SCENE_COUNT = 8/);
  assert.match(planner, /MILESTONE_DAYS = \[1, 1, 10, 10, 20, 20, 30, 30\]/);
  assert.match(planner, /dayScene/);
  assert.match(planner, /TWO-BEAT DAYS/);
  assert.match(planner, /turning_point/);

  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  assert.match(api, /export const SCENE_COUNT = 8/);
  assert.match(api, /SCENE_COUNT \* tier\.imageCredits/);
  assert.match(api, /SCENE_COUNT \* tier\.videoCredits/);

  const migration = read("supabase/migrations/20260824192853_thirty_days_eight_scene_mode.sql");
  assert.match(migration, /CHECK \(scene_index BETWEEN 0 AND 7\)/);
  assert.match(migration, /v_scene_count <> 8/);
  assert.match(migration, /INVALID_MILESTONE_STRUCTURE/);
  assert.match(migration, /ARRAY\[1, 1, 10, 10, 20, 20, 30, 30\]/);

  const results = read("src/components/viral-tools/thirty-days/ThirtyDaysResults.jsx");
  assert.match(results, /\[1, 10, 20, 30\]/);
  assert.match(results, /Four milestone days with two connected scenes each/);
  assert.match(results, /Scene \{index \+ 1\}/);

  const page = read("src/pages/workspace/ThirtyDays.jsx");
  assert.match(page, /clips\.length !== expectedSceneCount/);
  assert.match(page, /clips\.length === expectedSceneCount/);
});

test("30 Days results render only real planner scenes and diagnose reservation failures", () => {
  const results = read("src/components/viral-tools/thirty-days/ThirtyDaysResults.jsx");
  assert.doesNotMatch(results, /Your story will appear here/);
  assert.doesNotMatch(results, /Array\.from\(\{ length: 7/);
  assert.match(results, /groupScenesByMilestone/);
  assert.match(results, /dayGroups\.map/);
  assert.match(results, /Creating your 30-day story/);
  assert.match(results, /Reference preparation/);
  assert.match(results, /onRetry/);

  const planner = read("supabase/functions/thirty-days-planner/index.ts");
  assert.match(planner, /MIGRATION_MISMATCH/);
  assert.match(planner, /reservation failed/);
});

test("30 Days fallback, TTS ceiling, and navigation are wired", () => {
  const planner = read("supabase/functions/thirty-days-planner/index.ts");
  for (const id of ["ref_protagonist", "ref_cast_style", "ref_environment", "ref_environment_secondary"]) {
    assert.match(planner, new RegExp(id));
  }
  const script = read("supabase/functions/thirty-days-script/index.ts");
  assert.match(script, /TOTAL_WORDS_IDEAL_MIN = 80/);
  assert.match(script, /TOTAL_WORDS_IDEAL_MAX = 100/);
  assert.match(script, /TOTAL_WORDS_HARD_CEILING = 105/);

  for (const file of [
    "src/App.jsx",
    "src/components/workspace/CreateMenu.jsx",
    "src/components/workspace/toolshell.jsx",
    "src/components/workspace/MobileBottomNav.jsx",
    "src/pages/workspace/layout.jsx",
    "src/data/routeSeoPolicy.js",
  ]) assert.match(read(file), /\/workspace\/thirty-days/);
});

test("30 Days matches the lime template shell, keeps Generate visible, and reuses Lego community previews", () => {
  const builder = read("src/components/viral-tools/thirty-days/ThirtyDaysBuilder.jsx");
  assert.match(builder, /border-lime-300/);
  assert.match(builder, /bg-lime-300/);
  assert.match(builder, /fixed bottom-\[calc\(72px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(builder, /lg:static lg:shrink-0/);
  assert.doesNotMatch(builder, /violet|fuchsia/);

  const results = read("src/components/viral-tools/thirty-days/ThirtyDaysResults.jsx");
  assert.match(results, /const demoVideo = "\/library\/lego\.mp4"/);
  assert.match(results, /const demoVideoTwo = "\/library\/lego2\.mp4"/);
  assert.doesNotMatch(results, /assets\/home\/latest\/video/);
  assert.doesNotMatch(results, /violet|fuchsia/);

  const voice = read("src/components/viral-tools/thirty-days/ThirtyDaysVoiceStep.jsx");
  assert.doesNotMatch(voice, /violet|fuchsia/);
});

test("30 Days quality tiers stay in one row and failed clips have a paid video-only retry", () => {
  const builder = read("src/components/viral-tools/thirty-days/ThirtyDaysBuilder.jsx");
  const picker = read("src/components/viral-tools/thirty-days/ThirtyDaysQualityPicker.jsx");
  const upgradeModal = read("src/components/viral-tools/thirty-days/ThirtyDaysUpgradeModal.jsx");
  assert.match(picker, /grid grid-cols-3 gap-1\.5/);
  assert.match(picker, /h-11/);
  assert.doesNotMatch(picker, /scenes/);
  assert.doesNotMatch(builder, /Fixed for V1/);
  assert.match(picker, /setUpgradeTier\(tier\)/);
  assert.match(upgradeModal, /Upgrade to \{planLabel\}/);
  assert.match(builder, /estimateTotalCredits\(quality, REFERENCE_COUNT, planCode\)/);
  assert.match(builder, /ThirtyDaysCreditBadge value=\{generationCredits\}/);

  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  assert.match(api, /REFERENCE_COUNT = 5/);
  assert.match(api, /paidRetry = false/);
  assert.match(api, /skipCreditCheck: !paidRetry/);
  assert.match(api, /billingReservation: paidRetry \? undefined/);

  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  assert.match(hook, /const retryVideo = useCallback/);
  assert.match(hook, /paidRetry: true/);
  assert.match(hook, /videoRetryLocksRef/);

  const results = read("src/components/viral-tools/thirty-days/ThirtyDaysResults.jsx");
  assert.match(results, /allowVideoRetry && scene\.videoStatus === "failed" && scene\.imageUrl/);
  assert.match(results, /generation\?\.reservationStatus !== "reserved"/);
  assert.match(results, /Regenerate video · \{retryCredits\} credits/);
  assert.match(results, /onRetryVideo\?\.\(scene\.index\)/);
});

test("30 Days enforces a viewer-insert protagonist from idea through QA and narration", () => {
  const idea = read("supabase/functions/thirty-days-idea/index.ts");
  assert.match(idea, /V1 CORE RULE: the viewer-insert protagonist is mandatory/);
  assert.match(idea, /ensureViewerPremise/);
  assert.match(idea, /Never make a canon character the sole protagonist/);

  const planner = read("supabase/functions/thirty-days-planner/index.ts");
  assert.match(planner, /V1 VIEWER-INSERT CONTRACT/);
  assert.match(planner, /viewerProtagonist/);
  assert.match(planner, /protagonistAction/);
  assert.match(planner, /Reference 1 must use role/);
  assert.match(planner, /const REF_COUNT = 5/);
  assert.match(planner, /minItems: REF_COUNT, maxItems: REF_COUNT/);
  assert.match(planner, /scene\?\.referenceIds\?\.\[0\] !== viewerRef\.id/);
  assert.match(planner, /input: JSON\.stringify\(plan\)/);
  assert.match(planner, /deterministicCriticIssues\(plan\)\.length\) plan = fallbackPlan/);

  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  assert.match(api, /VIEWER PROTAGONIST \(the story's mandatory central identity\)/);
  assert.match(api, /YOU ACTION \(must be clearly visible or unmistakably implied\)/);
  assert.match(api, /never a tiny background extra/);

  const job = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  assert.match(job, /const next = planned\.generation/);
  assert.doesNotMatch(job, /planned\.generation, premise: resolvedPremise/);

  const qa = read("supabase/functions/thirty-days-scene-qa/index.ts");
  assert.match(qa, /Mandatory viewer protagonist/);
  assert.match(qa, /visibly present \(or unmistakably implied/);

  const script = read("supabase/functions/thirty-days-script/index.ts");
  assert.match(script, /first-person viewer-insert narration/);
  assert.match(script, /I entered \$\{universe\}/);
});

test("30 Days persists and propagates all five visual styles", () => {
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  for (const style of ["auto", "cinematic_3d", "anime_accurate", "realistic", "dark_cinematic"]) assert.match(api, new RegExp(`id: "${style}"`));
  assert.match(api, /settings: \{ quality, visualStyle \}/);
  assert.match(api, /SELECTED STYLE INTERPRETATION/);

  const planner = read("supabase/functions/thirty-days-planner/index.ts");
  assert.match(planner, /const STYLE_DIRECTIVES/);
  assert.match(planner, /Franchise Accurate/);
  assert.match(planner, /styleMode: visualStyle/);
  assert.match(planner, /Never erase recognizable franchise identity/);

  const qa = read("supabase/functions/thirty-days-scene-qa/index.ts");
  assert.match(qa, /Required visual style mode/);
  assert.match(qa, /preserving franchise identity/);

  const migration = read("supabase/migrations/20260824200941_thirty_days_styles_and_quality_tiers.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS visual_style/);
  assert.match(migration, /visual_style IN \('auto', 'cinematic_3d', 'anime_accurate', 'realistic', 'dark_cinematic'\)/);
});

test("30 Days idea generation runs an eight-candidate viral tournament", () => {
  const idea = read("supabase/functions/thirty-days-idea/index.ts");
  assert.match(idea, /const CANDIDATE_COUNT = 8/);
  for (const key of ["hookClarity", "curiosityGap", "immediateStakes", "visualSpectacle", "viewerInsert", "franchiseRecognition", "milestoneEscalation", "sceneDiversity", "emotionalAnchor", "day20Reveal", "day30Payoff", "commentPotential", "seriesPotential", "thumbnailClarity"]) assert.match(idea, new RegExp(`"${key}"`));
  assert.match(idea, /deterministicRejection/);
  assert.match(idea, /generic_activity/);
  assert.match(idea, /sort\(\(a: any, b: any\) => Number\(b\.total/);
  assert.match(idea, /const EXAMPLE_BANK/);
});

test("30 Days video dispatch forces sound off and protects paid retry prices", () => {
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  assert.match(api, /withSound: false/);
  assert.doesNotMatch(api, /withSound: tier\.withSound/);

  const normalGenerator = read("src/components/VideoGenerator/Generate.jsx");
  assert.match(normalGenerator, /const V3_KEY = "video:veo31lite"/);
  const providers = read("src/lib/providers.ts");
  const veoBlock = providers.match(/"video:veo31lite": \{[\s\S]*?\n  \},/)?.[0] ?? "";
  const seedanceBlock = providers.match(/"video:cartoondriveseedance720": \{[\s\S]*?\n  \},/)?.[0] ?? "";
  assert.match(veoBlock, /generator:\s+"Veo 3\.1 Lite"/);
  assert.match(veoBlock, /baseCreditsPerSecond:\s+3/);
  assert.match(seedanceBlock, /airTag:\s+"bytedance:seedance@2\.0"/);
  assert.match(seedanceBlock, /baseCreditsPerSecond:\s+16/);

  const edge = read("supabase/functions/runware-video/index.ts");
  assert.match(edge, /toolKey: "video:veo31lite"[\s\S]{0,100}credits: 18/);
  assert.match(edge, /toolKey: "video:cartoondriveseedance720"[\s\S]{0,100}credits: 80/);
});

test("30 Days automatically builds and persists a rendered-clip-synced TTS draft", () => {
  const script = read("supabase/functions/thirty-days-script/index.ts");
  assert.match(script, /const SAMPLES_PER_CLIP = 3/);
  assert.match(script, /normalizeScriptClips/);
  assert.match(script, /buildClipAlignedTiming/);
  assert.match(script, /thirty-days-rendered-clip-plan/);
  assert.match(script, /minItems: clipCount/);
  assert.match(script, /one continuous story/);
  assert.match(script, /Use only 3-5 day markers/);
  assert.match(script, /GOAL → SETBACK → ESCALATION → CLIMAX → PAYOFF/);
  assert.match(script, /storyViolations/);
  assert.match(script, /Five or more cue lines begin with Day/);
  assert.match(script, /critic output failed validation/);
  assert.match(script, /rewrite it ONCE/);

  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  assert.match(api, /duration \* 0\.18, duration \* 0\.5, duration \* 0\.82/);
  assert.match(api, /saveThirtyDaysNarrationDraft/);
  assert.match(api, /narration_take: draft/);

  const voice = read("src/components/viral-tools/thirty-days/ThirtyDaysVoiceStep.jsx");
  assert.match(voice, /Writing narration from the actual clips/);
  assert.match(voice, /saveThirtyDaysNarrationDraft/);
  assert.match(voice, /Second-by-second sync/);
  assert.match(voice, /scriptTiming\.clipSegments/);
  assert.match(voice, /thirtyDaysVoicePlaybackRate/);
  assert.match(voice, /const regeneratePrompt = async/);
  assert.match(voice, /Regenerate prompt/);
  assert.match(voice, /Regenerating the story from the finished clips/);
  assert.match(voice, /New AI-synced narration ready/);

  const page = read("src/pages/workspace/ThirtyDays.jsx");
  assert.match(page, /voicePlaybackRate: Number\(take\.playbackRate\) \|\| 1/);
  assert.match(page, /onDraftReady/);
});
