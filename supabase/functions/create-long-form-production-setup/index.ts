// deno-lint-ignore-file no-explicit-any
// create-long-form-production-setup/index.ts — 2026-10-02 "one project
// commitment" pass, Section 4/5/6/7.
//
// The real backend of the new IDEA/SETUP stage's single "CREATE VIDEO ·
// N credits" button. Does exactly three things, in order, and only the
// first two touch anything that must stay consistent:
//   1. Computes the deterministic upper-bound project quote (Section 9).
//   2. Freezes the Production Profile snapshot (create_long_form_generation_
//      profile — built in the prior pass) so every downstream stage reads
//      locked settings, never live/mutable project columns.
//   3. Reserves exactly that quote's total against the user's real balance
//      (reserve_long_form_project_credits — built this pass), idempotent by
//      (project, profile) so a double-click can never reserve twice.
//
// If step 3 fails (most commonly INSUFFICIENT_CREDITS) after step 2 already
// succeeded, no money has moved — the project simply has a fresh, unfunded
// Production Profile version sitting as "active." A retry (or a Setup
// change) creates its own new profile version, which is exactly the
// existing supersede-on-create behavior working as designed; nothing needs
// manual cleanup.
//
// NEVER calls Runware/Kling/any image or video provider. NEVER runs the
// Production Bible builder or TTS — those are separate, later stages that
// read this profile once it exists.
//
// POST { projectId, visualRecipe, recipeVersion, visualStylePreset?, renderTier,
//        targetDurationMinutes, researchDepth?, explanationDepth?, voiceProvider?,
//        voiceId?, voiceModel?, pacingProfile?, generationMode? }
// Returns { ok:true, generationProfileId, reservationId, quote, reservedCredits, alreadyReserved }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { estimateLongFormProjectQuote, type RenderTier } from "../_shared/longFormProjectQuote.ts";
import { RECIPE_BEATS_PER_MINUTE } from "../../../src/lib/longFormPipelineConstants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Phase 0, Section C.2 — RECIPE_BEATS_PER_MINUTE now comes from the shared
// constants module (the frontend's own "~N scenes" estimate reads the same
// map, so the two can never independently drift again). Stickman's Beat
// Director design targets 3-5 seconds/beat; 15 beats/minute is that range's
// midpoint (4s/beat).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const visualRecipe = String(body?.visualRecipe ?? "").trim();
  const recipeVersion = String(body?.recipeVersion ?? "").trim();
  const renderTier = String(body?.renderTier ?? "").trim() as RenderTier;
  const targetDurationMinutes = Number(body?.targetDurationMinutes);
  if (!projectId) return err(req, "Missing projectId", 400);
  if (!visualRecipe || !recipeVersion) return err(req, "Missing visualRecipe/recipeVersion", 400);
  if (!["v2", "v3", "v4"].includes(renderTier)) return err(req, "Invalid renderTier", 400);
  if (!(targetDurationMinutes > 0)) return err(req, "Invalid targetDurationMinutes", 400);

  const beatsPerMinute = RECIPE_BEATS_PER_MINUTE[recipeVersion];
  if (!beatsPerMinute) return err(req, `Unknown recipe version: ${recipeVersion}`, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("id,user_id,status").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const quote = estimateLongFormProjectQuote({ targetDurationMinutes, renderTier, beatsPerMinute });

  const { data: profile, error: profileError } = await admin.rpc("create_long_form_generation_profile", {
    p_project_id: projectId, p_user_id: user.id,
    p_settings: {
      visualRecipe, recipeVersion, visualStylePreset: body?.visualStylePreset ?? null, renderTier,
      targetDurationMinutes, researchDepth: body?.researchDepth ?? null, explanationDepth: body?.explanationDepth ?? null,
      voiceProvider: body?.voiceProvider ?? null, voiceId: body?.voiceId ?? null, voiceModel: body?.voiceModel ?? null,
      pacingProfile: body?.pacingProfile ?? null, generationMode: body?.generationMode ?? "full_episode",
      // 2026-10-02 "Production Setup redesign" pass, Section 4 — niche has no
      // dedicated column anywhere in this schema yet; raw_setup_snapshot is
      // exactly the field this table's own migration comment reserves for
      // "anything collected at Setup that hasn't earned its own column yet."
      // Never read back as authoritative by anything except this profile's
      // own history — research/story/Bible context reads it from here, not
      // from a second parallel store.
      niche: body?.niche ?? null,
      compilerVersions: { projectQuoteEstimator: "v1" },
    },
  });
  if (profileError) {
    const status = profileError.message?.includes("FORBIDDEN") ? 403 : profileError.message?.includes("PROJECT_NOT_FOUND") ? 404
      : profileError.message?.includes("INCOMPLETE_SETUP") || profileError.message?.includes("INVALID_TIER") ? 400 : 500;
    return err(req, "Could not save your production settings.", status, { reason: profileError.message });
  }

  const { data: reservation, error: reservationError } = await admin.rpc("reserve_long_form_project_credits", {
    p_project_id: projectId, p_user_id: user.id, p_generation_profile_id: profile.id,
    p_reserved_credits: quote.totalCredits, p_breakdown: quote.breakdown,
  });
  if (reservationError) {
    const status = reservationError.message?.includes("INSUFFICIENT_CREDITS") ? 402
      : reservationError.message?.includes("RESERVATION_ALREADY_ACTIVE_FOR_DIFFERENT_PROFILE") ? 409 : 500;
    const friendly = status === 402 ? `Not enough credits — this video needs ${quote.totalCredits}.`
      : status === 409 ? "An existing production is already reserved for this project — resolve it before starting a new one."
      : "Could not reserve credits for this video.";
    return err(req, friendly, status, { quote });
  }

  // 2026-10-03 "fixes round 3" pass, Section 1 — the exact moment a project
  // becomes real: reservation just succeeded, so flip it out of 'draft' now,
  // atomically with nothing else in between. fetchUserLongFormProjects
  // (project.js) excludes status='draft', so this is the one line that makes
  // a project appear in "Your Long Form Videos" — never page load, never a
  // failed/partial Setup attempt.
  if (project.status === "draft") {
    await admin.from("long_form_projects").update({ status: "planning" }).eq("id", projectId);
  }

  return ok(req, {
    ok: true, generationProfileId: profile.id, reservationId: reservation.id,
    quote, reservedCredits: reservation.reserved_credits,
    alreadyReserved: reservation.committed_credits > 0 || reservation.status !== "reserved",
  });
});
