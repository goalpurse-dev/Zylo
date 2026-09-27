// 2026-10-02 "real narration audio master timeline" pass — Section 14 live
// validation. Fresh synthetic test fixture only (NOT Atlantis). Exercises
// the REAL deployed edge functions end to end: create profile (free) ->
// insert a synthetic locked script -> lock-long-form-script (real, fires
// Bible + TTS in parallel) -> poll for completion -> verify -> re-call to
// prove idempotency (no second provider call). A small real ElevenLabs +
// OpenAI cost is authorized for this validation; zero image/video calls;
// zero user credits charged (no reservation is created for this test
// project at all).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const TEST_EMAIL = "upwardlift6@gmail.com";

async function mintSession() {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAIL });
  if (error) throw error;
  const anon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY ?? SERVICE_KEY);
  const { data: verify, error: verifyError } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
  if (verifyError) throw verifyError;
  return { accessToken: verify.session.access_token, userId: verify.session.user.id };
}

async function callFn(name, accessToken, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, apikey: process.env.SUPABASE_ANON_KEY ?? SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

// 2026-10-02 Stage 1 re-run — extended to ~198 words (was ~83, too short to
// clear the 60-90s target) so real ElevenLabs synthesis lands in-range. Kept
// the same prehistoric-fire narrative (now with a stat, a comparison, a
// reveal, and a callback to the opening image) since Stage 2's Beat Director
// test reuses this exact fixture and needs real semantic texture to segment
// against, not just a duration placeholder.
const TEST_SCRIPT_SEGMENTS = [
  { id: "seg1", chapterId: "ch1", text: "You're lying on packed dirt, your back against a cold rock." },
  { id: "seg2", chapterId: "ch1", text: "Somewhere behind you, in the dark grass, something is moving." },
  { id: "seg3", chapterId: "ch1", text: "You can't see it, but it can absolutely see you." },
  { id: "seg4", chapterId: "ch1", text: "This was ordinary life for most of human history — a hundred and sixty thousand years of nights just like this one." },
  { id: "seg5", chapterId: "ch1", text: "Our ancestors didn't sleep eight uninterrupted hours." },
  { id: "seg6", chapterId: "ch1", text: "They slept in fragments, one eye effectively open, ready to run at any moment." },
  { id: "seg7", chapterId: "ch1", text: "Then fire changed everything, but not by making the darkness disappear." },
  { id: "seg8", chapterId: "ch1", text: "It simply drew a small circle of safety, and taught an entire species to trust the edge of the light." },
  { id: "seg9", chapterId: "ch1", text: "Suddenly, a group could sleep at the same time, instead of taking turns watching for predators." },
  { id: "seg10", chapterId: "ch1", text: "That single change freed up thousands of hours every year — hours that used to be spent just surviving the night." },
  { id: "seg11", chapterId: "ch1", text: "Some researchers think those extra hours are exactly where storytelling, language, and even early art were born." },
  { id: "seg12", chapterId: "ch1", text: "The same flickering light that kept the predators away also lit the very first campfire conversations." },
  { id: "seg13", chapterId: "ch1", text: "So the next time you see a campfire, you're not just looking at warmth." },
  { id: "seg14", chapterId: "ch1", text: "You're looking at the machine that quietly built the human mind." },
];

async function main() {
  console.log("Minting a real test session...");
  const { accessToken, userId } = await mintSession();
  console.log("Session minted for user:", userId);

  console.log("\nCreating fresh synthetic test project (NOT Atlantis)...");
  const { data: discoverySession, error: discoveryError } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  if (discoveryError) throw discoveryError;
  const { data: project, error: projectError } = await admin.from("long_form_projects").insert({
    user_id: userId, format: "2d_explainer", topic: "[ENGINEERING TEST FIXTURE] TTS Master Timeline Validation",
    status: "draft", discovery_session_id: discoverySession.id,
  }).select("id").single();
  if (projectError) throw projectError;
  const projectId = project.id;
  console.log("Test project:", projectId);

  console.log("\nCreating Production Profile (zero cost — no reservation created for this test)...");
  const { data: profile, error: profileError } = await admin.rpc("create_long_form_generation_profile", {
    p_project_id: projectId, p_user_id: userId,
    p_settings: {
      visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1", renderTier: "v3",
      targetDurationMinutes: 1, voiceProvider: "elevenlabs", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5",
    },
  });
  if (profileError) throw profileError;
  console.log("Generation profile:", profile.id, "voice:", profile.voice_id);

  console.log("\nInserting a synthetic FINAL script version (bypassing the real research/story/critic pipeline — out of scope for this engineering test)...");
  const { data: storyPlan, error: storyPlanError } = await admin.from("long_form_story_plan_versions").insert({
    project_id: projectId, version: 1, story_plan: { note: "synthetic fixture for TTS engineering validation" }, generation_model: "test-fixture",
  }).select("id").single();
  if (storyPlanError) throw storyPlanError;
  const { data: research, error: researchError } = await admin.from("long_form_research_versions").insert({
    project_id: projectId, story_plan_version_id: storyPlan.id, version: 1, status: "ready",
  }).select("id").single();
  if (researchError) throw researchError;
  const totalWords = TEST_SCRIPT_SEGMENTS.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
  const { data: scriptVersion, error: scriptError } = await admin.from("long_form_script_versions").insert({
    project_id: projectId, story_plan_version_id: storyPlan.id, research_version_id: research.id, version: 1, status: "ready", stage: "finalizing",
    script_document: { title: "TTS Validation Fixture", narrationSegments: TEST_SCRIPT_SEGMENTS, chapters: [{ id: "ch1", title: "Test Chapter" }], actualWords: totalWords, estimatedDurationSeconds: Math.round((totalWords / 150) * 60) },
  }).select("id").single();
  if (scriptError) throw scriptError;
  await admin.from("long_form_projects").update({ current_script_version_id: scriptVersion.id }).eq("id", projectId);
  console.log("Script version:", scriptVersion.id, `(${totalWords} words, ${TEST_SCRIPT_SEGMENTS.length} segments)`);

  console.log("\n=== Calling REAL lock-long-form-script (fires Bible + TTS in parallel) ===");
  const lockResult = await callFn("lock-long-form-script", accessToken, { projectId });
  console.log("lock-long-form-script response:", lockResult.status, JSON.stringify(lockResult.json));
  if (!lockResult.ok) throw new Error("Lock failed: " + JSON.stringify(lockResult.json));

  console.log("\nPolling for Bible + Narration completion...");
  let bible = null, narration = null;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180_000) {
    if (!bible) {
      const { data } = await admin.from("long_form_production_bibles").select("*").eq("project_id", projectId).eq("status", "frozen").maybeSingle();
      if (data) bible = data;
    }
    if (!narration) {
      const { data } = await admin.from("long_form_narration_audio_versions").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
      if (data && ["ready", "alignment_failed", "failed"].includes(data.status)) narration = data;
    }
    if (bible && narration) break;
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\n=== BIBLE RESULT ===");
  console.log(bible ? { id: bible.id, version: bible.bible_version, llmCalls: bible.llm_calls, cost: bible.estimated_model_cost_usd, visualPremise: bible.bible?.visualPremise } : "TIMED OUT waiting for Bible");

  console.log("\n=== NARRATION RESULT ===");
  if (!narration) { console.log("TIMED OUT waiting for narration"); process.exit(1); }
  console.log({ id: narration.id, status: narration.status, audioUrl: narration.audio_url, durationSeconds: narration.audio_duration_seconds, internalCostUsd: narration.internal_cost_usd, narrationSegmentCount: narration.narration?.length ?? 0 });

  if (narration.status !== "ready") {
    console.error("Narration did not reach 'ready' status:", narration.status, narration.last_error_code);
    process.exit(1);
  }

  // Verify: all segments mapped, no gaps/overlaps.
  console.log("\n=== SEGMENT TIMING VERIFICATION ===");
  const timings = narration.narration;
  let gapsOrOverlaps = 0;
  for (let i = 1; i < timings.length; i++) {
    const prevEnd = timings[i - 1].endSeconds;
    const curStart = timings[i].startSeconds;
    if (Math.abs(curStart - prevEnd) > 0.05) { gapsOrOverlaps++; console.log(`  Gap/overlap between segment ${i - 1} and ${i}: prevEnd=${prevEnd}, curStart=${curStart}`); }
  }
  console.log(`All ${TEST_SCRIPT_SEGMENTS.length} segments mapped: ${timings.length === TEST_SCRIPT_SEGMENTS.length}`);
  console.log(`Gaps/overlaps detected: ${gapsOrOverlaps}`);
  console.log("Example mapped segment:", JSON.stringify(timings[1], null, 2));

  // Refresh/reload simulation: re-fetch the same row.
  const { data: reloaded } = await admin.from("long_form_narration_audio_versions").select("id,status,audio_url").eq("id", narration.id).maybeSingle();
  console.log("\n=== REFRESH/RELOAD CHECK ===");
  console.log("Same artifact on reload:", reloaded.id === narration.id && reloaded.audio_url === narration.audio_url);

  // Idempotency: call generate-long-form-narration-audio AGAIN with identical lineage.
  console.log("\n=== IDEMPOTENCY CHECK (rerun with identical lineage) ===");
  const rerun = await callFn("generate-long-form-narration-audio", accessToken, { projectId });
  console.log("Rerun response:", rerun.status, JSON.stringify(rerun.json));
  console.log("alreadyGenerated:true (no new provider call):", rerun.json?.alreadyGenerated === true);
  console.log("Same narrationAudioVersionId returned:", rerun.json?.narrationAudioVersionId === narration.id);

  const { count: versionCountAfterRerun } = await admin.from("long_form_narration_audio_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  console.log("Total narration_audio_versions rows for this project (must stay 1):", versionCountAfterRerun);

  console.log("\n=== BEAT DIRECTOR READINESS OBJECT ===");
  const readiness = await callFn("get-long-form-beat-director-readiness", accessToken, { projectId });
  console.log(JSON.stringify(readiness.json, null, 2));

  console.log("\n=== TEST PROJECT ID (for reference/cleanup) ===");
  console.log(projectId);
}

main().catch((e) => { console.error("LIVE TEST FAILED:", e); process.exit(1); });
