// deno-lint-ignore-file no-explicit-any
// advance-long-form-scene-generation/index.ts
//
// The durable Scene Generation worker — same crash-safe shape as every
// other long-form worker in this codebase (claim/lease via SKIP LOCKED,
// self-chained dispatch, a standing per-minute recovery cron covers crashes/
// timeouts/worker restarts). One scene claimed and progressed per
// invocation; the caller (start-long-form-scene-generation, retry/edit
// endpoints, or the recovery cron) re-invokes this until nothing claimable
// remains. Reuses the EXISTING jobs/job-worker/runware-image pipeline for
// real GENERATE/EDIT provider calls — REUSE/CROP/PROGRAMMATIC_GRAPHIC never
// touch that pipeline at all (Part 44: zero provider calls for zero-cost
// strategies, enforced structurally by branching before any job is ever
// built, not just by convention).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureSceneJob, sceneJobResult } from "../_shared/sceneJobs.ts";
import { fetchAndDecodeImage, decodeImage, encodePng, compositeOverlay, drawRect, drawText, measureText, type RawImage } from "../_shared/sceneCompositor.ts";
import { runSceneQA, classifySceneQA } from "../_shared/sceneQA.ts";
import { computePerceptualHash, hammingDistance, NEAR_DUPLICATE_HAMMING_THRESHOLD, computeSharpness, classifyBlurSeverity, classifyVisualDelta, hasMaterialVisualDelta, detectStructuralReferenceLeakage } from "../_shared/sceneVisualAnalysis.ts";
import { getStylePresetForProject } from "../_shared/visualWorldStyle.ts";
import { resolveLongFormSceneRenderer } from "../_shared/sceneRendererTiers.ts";
import { getMaxReferenceImages } from "../_shared/imageDimensionPolicy.ts";
import { resolveSceneReferencePayload } from "../_shared/sceneReferenceBundle.ts";
import { isValidFinalAspectRatio, LONG_FORM_FINAL_ASPECT_RATIO } from "../_shared/sceneRenderPlan.ts";
import { classifyTextImportance, criticalExactTextOf, compileGraphicSpec, selectNextVariant, variantCountFor, resolveGraphicClaim, escalateToListLayout } from "../_shared/graphicSpec.ts";
import { compositeExactTextLabel, renderGraphicCard } from "../_shared/graphicTemplates.ts";
import { determineRepairAction } from "../_shared/repairLadder.ts";
import { classifyStyleRepairStage, fetchConsecutiveFailureChain, findStyleReinforcementReferenceUrl, styleReinforcementReferenceInstruction, STYLE_REINFORCEMENT_NEGATIVE_SUFFIX } from "../_shared/styleRepairLadder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";
const RECOVERY_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const SCENE_PAUSED = (Deno.env.get("LONG_FORM_SCENE_PAUSED") ?? "").trim().toLowerCase() === "true";
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Postgrest/RPC errors are plain objects, not Error instances — a bare
// `String(error)` on those collapses to "[object Object]" and hides the
// real cause. Mirrors advance-long-form-visual-plan's stringifyStageError.
function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [e.message, e.code, e.details, e.hint].filter((v) => typeof v === "string" && v.length);
    if (parts.length) return parts.join(" | ");
    try { return JSON.stringify(error); } catch { return String(error); }
  }
  return String(error);
}

async function dispatchNext(visualWorldVersionId: string) {
  await fetch(SELF_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId }) }).catch(() => {});
}

// Latency optimization only (mirrors advance-long-form-visual-world's own
// identical comment/call) — a separate jobs sweep eventually owns recovery
// regardless, but kicking job-worker directly means a freshly-enqueued
// GENERATE/EDIT job doesn't sit "queued" until that sweep gets to it.
async function kickJobWorker(jobId: string) {
  const dispatch = fetch(`${SUPABASE_URL}/functions/v1/job-worker`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) }).catch((e) => console.error("Scene job dispatch failed", e));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(dispatch);
  else await dispatch;
}

// 2026-09-23 "systemic production stabilization" pass, Item E — called
// after EVERY point a scene can reach a terminal state (QA recorded either
// way, or a zero-cost scene's own direct status update), regardless of which
// of the several code paths below got it there. A no-op for any normal
// chapter/episode scene (close_long_form_sample_generation_if_done only
// ever acts on a charge whose sample_beat_ids is non-null) and a no-op until
// every one of a sample's own few beats is actually terminal — safe to call
// speculatively and repeatedly rather than trying to enumerate every exact
// "this was the last one" moment by hand.
async function closeSampleIfDone(admin: any, generationRunId: string | null | undefined) {
  if (!generationRunId) return;
  await admin.rpc("close_long_form_sample_generation_if_done", { p_generation_run_id: generationRunId })
    .catch((e: any) => console.error("[advance-long-form-scene-generation] close_long_form_sample_generation_if_done failed (non-fatal):", generationRunId, e));
}

// Crash-safe reconciliation (Part: "a provider-successful job must never be
// lost") — mirrors reconcileNonterminalAssets exactly: poll the jobs table
// for any scene whose job hasn't been written back yet, and finish QA for
// any succeeded-but-unQA'd scene, on every single invocation before any
// new claim.
async function reconcileNonterminal(admin: any, visualWorldVersionId: string) {
  const { data: inFlight } = await admin.from("long_form_scenes").select("*").eq("visual_world_version_id", visualWorldVersionId).not("job_id", "is", null).in("status", ["running"]);
  for (const scene of inFlight ?? []) {
    const { data: job } = await admin.from("jobs").select("id,status,result_url,output,created_at,updated_at").eq("id", scene.job_id).maybeSingle();
    const result = sceneJobResult(job);
    if (!result) continue;
    const { error } = await admin.from("long_form_scenes").update({ ...result, updated_at: new Date().toISOString() }).eq("id", scene.id).eq("job_id", scene.job_id);
    if (error) throw error;
    Object.assign(scene, result);
    // A genuine provider-side failure (job dispatched, ran, never produced a
    // usable image — sceneJobResult never sets cost_usd for these) — refund
    // whatever this attempt's row was charged. Idempotent no-op if nothing
    // was charged or it was already refunded. Distinct from a job that
    // SUCCEEDED but later fails QA (Needs Review) — that charge stands,
    // since a real image was produced and real compute was consumed.
    if (result.status === "failed") {
      await admin.rpc("refund_scene_operation_charge_if_failed", { p_scene_id: scene.id }).catch((e: any) => console.error("[advance-long-form-scene-generation] refund failed:", scene.id, e));
      await closeSampleIfDone(admin, scene.generation_run_id);
    }
  }
  const { data: needsQa } = await admin.from("long_form_scenes").select("*").eq("visual_world_version_id", visualWorldVersionId).eq("status", "succeeded").is("qa_status", null).in("render_strategy", ["GENERATE", "EDIT", "CROP"]);
  for (const scene of needsQa ?? []) await runQaCheckpoint(admin, scene);
}

// 2026-09-22 "FINAL stabilization pass" §8 — real Atlantis finding:
// classifyTextImportance(claim) is a pure function of the CLAIM alone, so
// every GENERATE/EDIT scene attached to the same narration claim
// independently derived criticalTextRequired=true and independently
// composited the SAME exact string onto itself — this is why "9000 YEARS
// BEFORE SOLON" got stamped repeatedly across many sequential scenes
// sharing one claim. Exact text needs exactly ONE owner per claim. Rather
// than a persisted flag (which could go stale if beats are added/replanned
// later), ownership is determined live and deterministically: among every
// render plan sharing this claim, the earliest by sequence_index that is
// actually capable of carrying the text (GENERATE/EDIT can composite a
// raster overlay; PROGRAMMATIC_GRAPHIC already carries it as a first-class
// structured field) is the owner — ties broken by plan id for stability.
// REUSE/CROP/COMPOSITE plans never compete for ownership: they inherit
// already-processed pixels from a source, never composite their own text.
async function isDesignatedTextOverlayOwner(admin: any, plan: any): Promise<boolean> {
  if (!plan?.narration_claim_id || !plan?.narration_contract_version_id) return true;
  const { data: siblings } = await admin.from("long_form_scene_render_plans").select("id, sequence_index, render_strategy")
    .eq("visual_world_version_id", plan.visual_world_version_id)
    .eq("narration_claim_id", plan.narration_claim_id)
    .eq("narration_contract_version_id", plan.narration_contract_version_id);
  const carriers = (siblings ?? []).filter((s: any) => ["GENERATE", "EDIT", "PROGRAMMATIC_GRAPHIC"].includes(s.render_strategy));
  if (!carriers.length) return true;
  const owner = [...carriers].sort((a: any, b: any) => (a.sequence_index - b.sequence_index) || String(a.id).localeCompare(String(b.id)))[0];
  return owner.id === plan.id;
}

async function runQaCheckpoint(admin: any, scene: any) {
  const { data: plan } = await admin.from("long_form_scene_render_plans").select("*").eq("id", scene.scene_render_plan_id).maybeSingle();
  const { data: project } = await admin.from("long_form_projects").select("visual_style_preset").eq("id", plan?.project_id).maybeSingle();
  const styleSpec = getStylePresetForProject(project?.visual_style_preset);
  const expectations = plan?.qa_expectations ?? {};
  let url = scene.final_result_url ?? scene.result_url;

  // Structural duplicate-output guard (real reliability requirement, not a
  // Scene Director change): two INDEPENDENT GENERATE/EDIT scenes ending up
  // with the identical provider result_url would mean a dispatch/
  // reconciliation bug attached one provider output to two scenes — never
  // legitimate (unlike REUSE/CROP/COMPOSITE, where sharing/deriving from a
  // source is the whole point and is never flagged here). Caught BEFORE the
  // paid vision QA call, so a detected duplicate costs nothing extra: no
  // hidden auto-retry, no second generation — just an honest Needs Review
  // with a reason the user can act on via the normal Regenerate button.
  if (["GENERATE", "EDIT"].includes(scene.render_strategy) && url) {
    // Compare against BOTH GENERATE and EDIT siblings, not just same-
    // strategy ones — an EDIT output landing identical to an unrelated
    // GENERATE's output (or vice versa) is exactly as much a bug as two
    // GENERATE outputs colliding. REUSE/CROP/COMPOSITE siblings are never
    // fetched here at all: sharing a source's pixels is their whole point.
    const { data: siblings } = await admin.from("long_form_scenes").select("id, result_url, render_strategy")
      .eq("visual_world_version_id", scene.visual_world_version_id).in("render_strategy", ["GENERATE", "EDIT"])
      .eq("status", "succeeded").neq("id", scene.id);
    const currentSiblings = [];
    for (const sib of siblings ?? []) {
      const { data: replacement } = await admin.from("long_form_scenes").select("id").eq("replaces_scene_id", sib.id).maybeSingle();
      if (!replacement) currentSiblings.push(sib);
    }
    const conflict = currentSiblings.find((s: any) => s.result_url === url);
    if (conflict) {
      const dupResult = { approved: false, reasons: [`Duplicate of another independently generated scene (${conflict.id}).`], duplicateOfSceneId: conflict.id };
      const { error: dupError } = await admin.rpc("record_scene_qa_result", { p_scene_id: scene.id, p_approved: false, p_qa_result: dupResult });
      if (dupError) throw dupError;
      await closeSampleIfDone(admin, scene.generation_run_id);
      return;
    }
  }

  // Part 4: QA must actually SEE the canonical references, not just judge
  // against a text description — always the ORIGINAL individual reference
  // images (scene.input_reference_asset_ids, persisted at compile time),
  // never only the combined SceneReferenceBundle a GENERATE dispatch may
  // have used for the provider call itself.
  let referenceImages: { url: string; label: string; kind: string }[] = [];
  if (scene.input_reference_asset_ids?.length) {
    const { data: refs } = await admin.from("long_form_reference_assets").select("id,result_url,reference_type,entity_id").in("id", scene.input_reference_asset_ids);
    referenceImages = (refs ?? []).filter((r: any) => r.result_url).map((r: any) => ({ url: r.result_url, label: r.entity_id ?? r.id, kind: r.reference_type ?? "reference" }));
  }
  // 2026-09-22 "FINAL stabilization pass" §1 — style-continuity evidence.
  // Real requirement: QA must use (1) the structured Style Bible (see
  // buildSceneQAPrompt's styleDimensions), (2) canonical Visual World
  // references (above), and (3) when available, an already-APPROVED scene
  // from the same episode/continuity group, as real visual evidence of what
  // "on style" actually looks like for THIS episode — never the old
  // generated global "style anchor" asset (explicitly not resurrected;
  // canonical refs + approved episode frames are the real evidence now).
  if (plan?.continuity_group_id || plan?.visual_world_version_id) {
    try {
      let styleQuery = admin.from("long_form_scenes").select("id,result_url,scene_render_plan_id,long_form_scene_render_plans!inner(continuity_group_id, qa_expectations)")
        .eq("visual_world_version_id", scene.visual_world_version_id).eq("status", "succeeded").eq("qa_status", "approved")
        .in("render_strategy", ["GENERATE", "EDIT"]).neq("id", scene.id).not("result_url", "is", null)
        .order("updated_at", { ascending: false }).limit(1);
      if (plan?.continuity_group_id) styleQuery = styleQuery.eq("long_form_scene_render_plans.continuity_group_id", plan.continuity_group_id);
      const { data: styleExemplars } = await styleQuery;
      const exemplar = styleExemplars?.[0];
      if (exemplar?.result_url) {
        // §15 — a character-safe "approved appearance anchor": once an
        // image passes strict identity+style QA, it may ALSO serve later
        // scenes needing the SAME recurring/hero character as real visual
        // continuity evidence — additive to (never a replacement for) the
        // canonical identity board. Detected here by real overlap between
        // this scene's and the exemplar's own compiled requiredCharacterIds
        // (deriveSceneQAExpectations's already-established field), never a
        // new free-text heuristic. An unapproved scene can never become an
        // exemplar for anything — the query above already requires
        // qa_status='approved'.
        const exemplarPlan = Array.isArray(exemplar.long_form_scene_render_plans) ? exemplar.long_form_scene_render_plans[0] : exemplar.long_form_scene_render_plans;
        const exemplarCharacters: string[] = exemplarPlan?.qa_expectations?.requiredCharacterIds ?? [];
        const thisSceneCharacters: string[] = expectations.requiredCharacterIds ?? [];
        const sharedCharacter = exemplarCharacters.find((c: string) => thisSceneCharacters.includes(c));
        referenceImages = [...referenceImages, sharedCharacter
          ? { url: exemplar.result_url, label: `already-approved appearance anchor for ${sharedCharacter} (same episode)`, kind: "character_reference" }
          : { url: exemplar.result_url, label: "already-approved episode frame (style continuity only, not identity)", kind: "style_reference" }];
      }
    } catch (e) {
      console.error("[advance-long-form-scene-generation] style-continuity/appearance-anchor reference lookup failed (non-fatal, QA proceeds without it):", scene.id, e);
    }
  }

  // Section 20/21 (2026-09-15 Visual Director rebuild): the beat's own
  // Narration Visual Contract claim, when one exists — supplies polarity
  // claims for semantic-contradiction checking and the highest entity
  // criticality this scene actually needs, so identity QA is weighted by
  // importance instead of holding a background extra to a hero's bar.
  let qaContext: { primaryEntityCriticality?: string; negativeClaims?: string[]; positiveClaims?: string[]; forbiddenEntities?: string[]; criticalTextRequired?: boolean; hasVerifiedOverlay?: boolean; shotSize?: string | null; multiCharacterReferenceConstrained?: boolean; unreferencedCharacterNames?: string[]; referencesSupplied?: boolean } = {
    shotSize: plan?.composition?.shotSize ?? null,
    // 2026-09-19 clone-root-cause pass: carried straight through from the
    // compile-time decision (deriveSceneQAExpectations) — QA never
    // re-derives this itself, it only knows what the compiler already
    // determined about this beat's reference-slot capacity.
    multiCharacterReferenceConstrained: Boolean(expectations.multiCharacterReferenceConstrained),
    unreferencedCharacterNames: expectations.unreferencedCharacterNames ?? [],
  };
  let claim: any = null;
  // Part 4 of the 2026-09-17 "fix PROGRAMMATIC_GRAPHIC" pass: resolve the
  // claim against THIS plan's own pinned narration_contract_version_id
  // column, never project.current_narration_contract_version_id — the same
  // "don't blindly attach latest" rule applies to QA context exactly as
  // much as it does to graphic/prompt compilation, for the identical
  // reason (a project's "current" pointer can move, or sit NULL, entirely
  // independently of what this specific plan was actually compiled from).
  if (plan?.narration_claim_id && plan?.narration_contract_version_id) {
    const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("claims").eq("id", plan.narration_contract_version_id).maybeSingle();
    claim = (contractRow?.claims ?? []).find((c: any) => c.claimId === plan.narration_claim_id) ?? null;
    if (claim) {
      const rank: Record<string, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, EXACT: 4 };
      const top = (claim.entityRequirements ?? []).reduce((best: string, r: any) => (rank[r.criticality] > rank[best] ? r.criticality : best), "NONE");
      qaContext = { ...qaContext, primaryEntityCriticality: top, negativeClaims: claim.negativeClaims, positiveClaims: claim.positiveClaims, forbiddenEntities: claim.forbiddenEntities };
    }
  }

  // 2026-09-22 "FINAL stabilization pass" §9 — PHASE 1: BASE QA evaluates
  // ONLY the clean base image, before any overlay is even considered. Real
  // Atlantis finding this replaces: the old single-pass ordering composited
  // the deterministic exact-text overlay onto the pixels BEFORE vision QA
  // ever ran — so a base that was always going to hard-fail on identity/
  // style/composition still paid the cost of building and storing an
  // overlay it would never need, and "hasVerifiedOverlay" could only ever
  // describe an image QA had NOT yet independently judged. Geometry
  // auto-correction (zero-cost, deterministic — Sections 3/4/6, 2026-09-16
  // "production invariants" pass) now targets the BASE layer
  // (base_result_url) for the same reason: it corrects the base frame
  // itself, never an overlay concern, and must happen before Phase 1 judges
  // it. Only attempted for GENERATE/EDIT: CROP/COMPOSITE and
  // PROGRAMMATIC_GRAPHIC already guarantee valid geometry at creation time
  // in processZeroCostScene (or fail loudly there).
  let baseUrl = scene.base_result_url ?? scene.result_url;
  let outputImgForLocalAnalysis: RawImage | null = null;
  let geometryAutoCorrected = false;
  if (baseUrl) {
    try {
      outputImgForLocalAnalysis = await fetchAndDecodeImage(baseUrl);
      if (!isValidFinalAspectRatio(outputImgForLocalAnalysis.width, outputImgForLocalAnalysis.height) && ["GENERATE", "EDIT"].includes(scene.render_strategy)) {
        const corrected = cropRegion(outputImgForLocalAnalysis, "center_detail");
        if (isValidFinalAspectRatio(corrected.width, corrected.height)) {
          const path = `long-form/scenes/${scene.id}-geometry-fix.png`;
          const { error: uploadError } = await admin.storage.from("generated").upload(path, encodePng(corrected), { contentType: "image/png", upsert: true });
          if (uploadError) throw uploadError;
          const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);
          await admin.from("long_form_scenes").update({ base_result_url: publicUrl.publicUrl, final_result_url: publicUrl.publicUrl, updated_at: new Date().toISOString() }).eq("id", scene.id);
          baseUrl = publicUrl.publicUrl;
          scene.base_result_url = baseUrl;
          scene.final_result_url = baseUrl;
          outputImgForLocalAnalysis = corrected;
          geometryAutoCorrected = true;
        }
      }
    } catch (e) {
      console.error("[advance-long-form-scene-generation] geometry pre-check/decode failed (non-fatal, QA will judge the un-corrected image):", scene.id, e);
    }
  }

  // §8: the claim may well be CRITICAL_EXACT_TEXT, but that text belongs to
  // exactly one designated carrier scene — every other scene sharing the
  // same claim must NOT also be told it's required to carry it.
  const claimRequiresExactText = classifyTextImportance(claim) === "CRITICAL_EXACT_TEXT";
  qaContext.criticalTextRequired = claimRequiresExactText && await isDesignatedTextOverlayOwner(admin, plan);
  // hasVerifiedOverlay is ALWAYS false at Phase 1 — no overlay has been (or
  // ever will be, at this point) built yet. Phase 1 always judges the base
  // exactly as produced, never a post-overlay frame.
  qaContext.hasVerifiedOverlay = false;
  // §14: reference-leakage can only be a real defect when a reference was
  // actually supplied to the model in the first place — real Atlantis
  // finding: a scene with reference_asset_ids=[] was still classified
  // REFERENCE_LEAKAGE. "REFERENCE_LEAKAGE impossible when no reference was
  // used."
  qaContext.referencesSupplied = referenceImages.length > 0;

  // 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
  // a single vision-QA infra hiccup (a transient API/network error, not a
  // real content judgment) used to be recorded as a hard qa_status=
  // 'rejected' immediately. That poisoned every downstream REUSE/CROP
  // dependent (they refuse to inherit from a rejected source — correctly,
  // for a REAL rejection) even though nothing about the actual image was
  // ever judged bad — real evidence: Shot 1 hit QA_UNAVAILABLE, and its
  // REUSE dependent (Shot 2) failed with REUSE_SOURCE_REJECTED as a direct,
  // avoidable consequence. Important: runSceneQA (sceneQA.ts) already
  // swallows its own network/parse errors internally and returns a normal
  // `{failureType:"QA_UNAVAILABLE", reasons:["qa_unavailable"], ...}`
  // result rather than throwing — so retrying only on a thrown exception
  // would never actually catch this case. Retrying is keyed on the result's
  // own failureType instead (the exception catch stays too, as defense in
  // depth for anything upstream of runSceneQA's own try/catch, e.g.
  // buildSceneQAPrompt). A bounded number of immediate retries absorbs a
  // transient blip at zero extra cost (this is a vision QA call on an
  // ALREADY-generated image, never a new paid provider generation). If QA
  // is genuinely unavailable even after retrying, this now returns WITHOUT
  // recording any verdict at all — qa_status stays null (this codebase's
  // own existing convention for "not yet independently checked," already
  // treated as fine by REUSE/CROP and by deriveSceneCardStatus's "Checking…"
  // state) rather than a false hard rejection. reconcileNonterminal already
  // sweeps every succeeded scene with qa_status IS NULL on every future
  // invocation, so this scene gets a genuine QA verdict automatically the
  // next time the pipeline runs — never left permanently unresolved, and
  // never blocking a REUSE dependent on a failure that was never real.
  const QA_UNAVAILABLE_MAX_ATTEMPTS = 3;
  let result: any = null;
  for (let attempt = 1; attempt <= QA_UNAVAILABLE_MAX_ATTEMPTS; attempt++) {
    try {
      result = await runSceneQA({
        imageUrl: baseUrl, sceneType: plan?.scene_type ?? "STORY_SCENE",
        requiredCharacterNames: expectations.requiredCharacterIds ?? [], locationName: expectations.requiredLocationId ?? null,
        shotSize: plan?.composition?.shotSize ?? "MEDIUM", expectedAction: plan?.communication_goal ?? "", styleName: styleSpec.name,
        // §1: the vision model compares against the ACTUAL structured Style
        // Bible dimensions (linework/shading/texture/palette/negative
        // constraints), not just a bare style name — see buildSceneQAPrompt.
        styleDimensions: { linework: styleSpec.linework, shading: styleSpec.shading, texture: styleSpec.texture, palette: styleSpec.palette, negativeConstraints: styleSpec.negativeConstraints },
        referenceImages, qaContext,
      });
      if (result?.failureType !== "QA_UNAVAILABLE") break;
      console.error(`[advance-long-form-scene-generation] vision QA reported unavailable (attempt ${attempt}/${QA_UNAVAILABLE_MAX_ATTEMPTS}):`, scene.id);
      result = null;
    } catch (qaError) {
      console.error(`[advance-long-form-scene-generation] vision QA call threw (attempt ${attempt}/${QA_UNAVAILABLE_MAX_ATTEMPTS}):`, scene.id, qaError);
    }
  }
  if (!result) {
    console.error("[advance-long-form-scene-generation] QA unavailable after retries — leaving qa_status null for a later reconciliation pass, never a false rejection:", scene.id);
    return;
  }

  // Section 4/6: the one authoritative 16:9 final-frame invariant, checked
  // against REAL decoded pixel dimensions of the BASE (possibly
  // auto-corrected) frame — never trusted from a provider's reported size
  // or a compile-time assumption. Real Mars incident: shot 19 shipped as a
  // literal 907x1536 portrait PNG that no check anywhere caught before this.
  if (outputImgForLocalAnalysis) {
    result.finalFrameGeometryValid = isValidFinalAspectRatio(outputImgForLocalAnalysis.width, outputImgForLocalAnalysis.height);
    if (!result.finalFrameGeometryValid) {
      result.reasons = [...(result.reasons ?? []), `Final frame is ${outputImgForLocalAnalysis.width}x${outputImgForLocalAnalysis.height} (not 16:9) — every Long Form scene must ship a 16:9 final frame.`];
    } else if (geometryAutoCorrected) {
      result.reasons = [...(result.reasons ?? []), "Final frame geometry was automatically corrected to 16:9 (zero-cost local crop) before review."];
    }
  }
  // Section 3: deterministic reference-leakage BACKSTOP, independent of the
  // vision model's own (occasionally wrong — see shot 32's real false
  // negative) judgment. Only relevant when this scene's dispatch actually
  // used a composited reference bundle (reference_bundle_id set) — after
  // the Section 1/2 routing fix this should be rare, but must still be
  // caught on sight whenever it happens.
  if (outputImgForLocalAnalysis && scene.reference_bundle_id) {
    try {
      const { data: bundle } = await admin.from("long_form_scene_reference_bundles").select("source_reference_asset_ids").eq("id", scene.reference_bundle_id).maybeSingle();
      const sourceIds: string[] = bundle?.source_reference_asset_ids ?? [];
      if (sourceIds.length) {
        const { data: sourceAssets } = await admin.from("long_form_reference_assets").select("id,result_url").in("id", sourceIds);
        const bySortedId = new Map((sourceAssets ?? []).map((a: any) => [a.id, a.result_url]));
        const orderedUrls = sourceIds.map((id) => bySortedId.get(id)).filter(Boolean) as string[];
        const bundleSourceImages = await Promise.all(orderedUrls.map((u) => fetchAndDecodeImage(u)));
        const structural = detectStructuralReferenceLeakage(outputImgForLocalAnalysis, bundleSourceImages);
        if (structural.leaked) {
          result.referenceLeakageDetected = true;
          result.reasons = [...(result.reasons ?? []), `Deterministic check: a region of the output closely matches reference-bundle source image #${(structural.matchedSourceIndex ?? 0) + 1} (Hamming distance ${structural.distance}) — the reference board likely bled into the final frame.`];
        }
      }
    } catch (e) {
      console.error("[advance-long-form-scene-generation] structural reference-leakage check failed (non-fatal):", scene.id, e);
    }
  }
  if (result.finalFrameGeometryValid === false || result.referenceLeakageDetected) Object.assign(result, classifySceneQA(result, qaContext));

  // Local, zero-provider-cost EDIT-quality signals (Part 9/12/13,
  // 2026-09-15 pass): the real Mars audit found EDIT scenes that are
  // near-identical to their source and Qwen outputs visibly softer than
  // their source — neither is something the vision QA prompt above can
  // reliably self-report (it never sees the SOURCE image side by side), so
  // it's measured deterministically here and merged into the same result
  // before the one final approval recompute.
  if (scene.render_strategy === "EDIT" && plan?.source_scene_render_plan_id && baseUrl) {
    try {
      const source = await admin.rpc("current_scene_for_render_plan", { p_scene_render_plan_id: plan.source_scene_render_plan_id }).then((r: any) => r.data);
      const sourceUrl = source?.result_url ?? source?.final_result_url;
      if (sourceUrl && outputImgForLocalAnalysis) {
        const [outputImg, sourceImg] = [outputImgForLocalAnalysis, await fetchAndDecodeImage(sourceUrl)];
        const distance = hammingDistance(computePerceptualHash(outputImg), computePerceptualHash(sourceImg));
        // Ground truth is the pixel comparison, not the compiled instruction
        // text — real Mars evidence (see NEAR_DUPLICATE_HAMMING_THRESHOLD's
        // comment) found the instruction text alone is not a reliable enough
        // signal (many genuinely trivial "increase contrast" edits phrase
        // themselves in ways a keyword classifier both over- and under-
        // matches). classifyVisualDelta is still run to annotate WHY a
        // trivial edit happened when it did (surfaced in `reasons`, useful
        // for a human reviewing the flagged scene), but it does not gate
        // whether visualDeltaSatisfied blocks approval.
        const categories = classifyVisualDelta(String(plan?.director_meta?.editInstruction ?? plan?.director_meta?.continuityNote ?? ""));
        result.duplicateSimilarity = 1 - distance / 64;
        result.visualDeltaSatisfied = distance >= NEAR_DUPLICATE_HAMMING_THRESHOLD;
        const outputSharpness = computeSharpness(outputImg);
        const sourceSharpness = computeSharpness(sourceImg);
        result.blurSeverity = classifyBlurSeverity(outputSharpness, sourceSharpness);
        if (result.visualDeltaSatisfied === false) {
          const weakInstruction = !hasMaterialVisualDelta(categories);
          result.reasons = [...(result.reasons ?? []), `Near-identical to its source image (${Math.round((1 - distance / 64) * 100)}% similar)${weakInstruction ? " — its own edit instruction only asked for a lighting/contrast/legibility change, not a material visual delta" : ""}.`];
        }
        if (result.blurSeverity === "major") result.reasons = [...(result.reasons ?? []), "Visibly softer/blurrier than its own source image."];
        // Re-classify (not just re-approve) — blurSeverity/visualDeltaSatisfied
        // were only just set above, AFTER runSceneQA's own initial
        // classification ran, so result.severity/failureType would
        // otherwise go stale relative to the refreshed approved value.
        // Passes qaContext (not {}, a real bug this pass fixes) — without
        // it, this re-classification silently lost the identity-criticality/
        // polarity context the FIRST classification (inside runSceneQA) had
        // already been given, even though nothing about qaContext changed.
        Object.assign(result, classifySceneQA(result, qaContext));
      }
    } catch (e) {
      console.error("[advance-long-form-scene-generation] local visual analysis failed (non-fatal):", scene.id, e);
    }
  }

  // §9 PHASE 1 gate: a base that fails QA never proceeds to overlay
  // compositing — "a failed base image never receives an overlay." The
  // recorded qa_result/qa_status describes the BASE exactly as evaluated;
  // final_result_url is left equal to base_result_url (already true by
  // construction — nothing to build on top of a rejected base).
  if (!result.approved) {
    // 2026-09-22 "FINAL stabilization pass" §19 — the repair-ladder DECISION
    // (determineRepairAction) has existed since the "production visual
    // reliability v2" pass but was never actually consumed anywhere in the
    // live pipeline. Attaching it here makes the decision reach the
    // persisted row (surfaced to the UI's Regenerate flow and to any future
    // dispatcher) without itself triggering anything — a BILLABLE repair
    // (FRESH_GENERATE/RETRY_LOCAL_EDIT_ONCE) always stays a decision the
    // user acts on via the existing Regenerate button, never an automatic
    // paid provider call; only genuinely zero-cost repairs (geometry
    // auto-correction above, deterministic overlay/graphic recompilation
    // elsewhere) self-heal automatically, and each of those already runs at
    // most once per scene by construction — never a loop.
    const repair = determineRepairAction(result.failureType ?? null);
    (result as any).repairAction = repair.action;
    (result as any).repairBillable = repair.billable;
    // 2026-09-23 "systemic production stabilization" pass, Item A — "No
    // infinite regeneration loops." A style failure gets up to 2 bounded,
    // automatically-reinforced retries (the dispatch-time block above); once
    // a THIRD consecutive style failure lands on the SAME shot, silently
    // offering another identical-looking "Regenerate" is no longer an
    // honest repair path — force requiresReview so the UI's own existing
    // "Needs review" (a genuine human decision) vs "Needs fix" (try again)
    // distinction (sceneCardModel.js) tells the truth about this shot.
    if (result.failureType === "STYLE_ABANDONED") {
      const chain = [result.failureType as string, ...(await fetchConsecutiveFailureChain(admin, scene.replaces_scene_id))];
      if (classifyStyleRepairStage(chain) === "NEEDS_FIX") (result as any).requiresReview = true;
    }
    const { error } = await admin.rpc("record_scene_qa_result", { p_scene_id: scene.id, p_approved: result.approved, p_qa_result: result });
    if (error) throw error;
    await closeSampleIfDone(admin, scene.generation_run_id);
    return;
  }

  // §9 PHASE 2: the base passed — NOW, and only now, apply the deterministic
  // exact-text overlay. §8's ownership check already narrowed this to the
  // one designated carrier scene for this claim; PROGRAMMATIC_GRAPHIC
  // already carries exact text as a first-class structured field and
  // REUSE/CROP inherit an already-processed source, so neither reaches here.
  if (qaContext.criticalTextRequired && !scene.overlay_applied && ["GENERATE", "EDIT"].includes(scene.render_strategy) && baseUrl) {
    try {
      const exactText = criticalExactTextOf(claim)!;
      const baseImg = outputImgForLocalAnalysis ?? await fetchAndDecodeImage(baseUrl);
      // §12: the deterministic overlay chip inherits the project's actual
      // Style Bible colors — never the generic hardcoded dark palette —
      // so it reads as part of the same visual system as the episode.
      const composited = compositeExactTextLabel(baseImg, exactText, "dark", styleSpec.graphicPalette);
      // §9 PHASE 3: deterministic overlay validation against ITS OWN
      // contract (correct geometry preserved) — never a second vision call,
      // and never a generic "is there readable text" judgment (that text is
      // intentional and will always be there).
      if (!isValidFinalAspectRatio(composited.width, composited.height)) {
        throw new Error(`OVERLAY_VALIDATION_FAILED: composited frame is ${composited.width}x${composited.height}, not 16:9`);
      }
      const path = `long-form/scenes/${scene.id}-overlay.png`;
      const { error: uploadError } = await admin.storage.from("generated").upload(path, encodePng(composited), { contentType: "image/png", upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);
      await admin.from("long_form_scenes").update({ final_result_url: publicUrl.publicUrl, overlay_applied: true, updated_at: new Date().toISOString() }).eq("id", scene.id);
    } catch (e) {
      // Fails open to the clean, already-approved base — never blocks
      // delivery of a scene that legitimately passed Phase 1 just because
      // the deterministic overlay step hit an error. final_result_url stays
      // the approved base, overlay_applied stays false.
      console.error("[advance-long-form-scene-generation] deterministic overlay compositing/validation failed (non-fatal — the approved base still ships without the overlay):", scene.id, e);
    }
  }

  const { error } = await admin.rpc("record_scene_qa_result", { p_scene_id: scene.id, p_approved: result.approved, p_qa_result: result });
  if (error) throw error;
  await closeSampleIfDone(admin, scene.generation_run_id);
}

// Zero-cost strategies (Part 44: never a provider call) — REUSE copies the
// source scene's pixels verbatim and inherits its QA (already approved, so
// re-running QA on identical pixels would be pure waste); CROP/COMPOSITE
// derive new pixels from the source via the compositor and get a fresh
// (still cheap, non-generative) QA pass; PROGRAMMATIC_GRAPHIC renders a
// standalone graphic card with no photographic base at all (Part 12/13 —
// these beats carry no baseSetupKey in the real storyboard, they are
// full-screen graphics by the Visual Director's own design, not overlays
// on a scene).
// 2026-09-19 "activate the repair ladder — but safely" pass (Section 6):
// the ONLY automatic repair this dispatch ever attempts — a
// GRAPHIC_RENDER_DEFECT is exactly repairLadder.ts's own RECOMPILE_GRAPHIC
// action (`determineRepairAction("GRAPHIC_RENDER_DEFECT").billable === false`),
// meaning it is safe to retry with zero provider calls and zero credits.
// Bounded to a handful of the SAME template's alternate variants (never a
// different template/semantic replan, and never more attempts than the
// template actually has variants) so a genuinely unfixable claim still
// fails fast into Needs Review instead of looping. Only ever swaps among
// deterministic local renders of an already-compiled structured spec — no
// FRESH_GENERATE, no image-generation credit, ever triggered from here.
export async function renderGraphicCardWithAutoRepair(admin: any, plan: any, spec: any, graphicPalette?: any): Promise<{ card: RawImage; issues: string[]; finalSpec: any; variantSwapped: boolean }> {
  let currentSpec = spec;
  let result = renderGraphicCard(currentSpec, graphicPalette);
  if (!result.issues.length) return { card: result.img, issues: [], finalSpec: currentSpec, variantSwapped: false };

  const totalVariants = variantCountFor(currentSpec);
  const maxAttempts = Math.min(Math.max(totalVariants - 1, 0), 3);
  if (maxAttempts <= 0) return { card: result.img, issues: result.issues, finalSpec: currentSpec, variantSwapped: false };

  const resolved = await resolveGraphicClaim(admin, plan);
  if ("error" in resolved) return { card: result.img, issues: result.issues, finalSpec: currentSpec, variantSwapped: false };

  let variantIndex = currentSpec.variantIndex ?? 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    variantIndex = selectNextVariant(variantIndex, totalVariants);
    const compileResult = compileGraphicSpec(resolved.claim, { theme: "light", backgroundMode: "light", variantIndex, contractVersionId: resolved.contractVersionId, beatFacts: plan.composition?.beatFacts ?? null });
    if (!compileResult.ok) break;
    currentSpec = compileResult.spec;
    result = renderGraphicCard(currentSpec, graphicPalette);
    if (!result.issues.length) return { card: result.img, issues: [], finalSpec: currentSpec, variantSwapped: true };
  }

  // 2026-09-23 "systemic production stabilization" pass, Item B — every
  // same-template variant STILL overflowed. The deterministic fix is never
  // to keep shrinking text or give up on a squeezed card; it's to lay the
  // SAME already-decided content out in a genuinely more spacious template
  // (BULLET_LIST). Bounded to exactly one extra attempt — never a second
  // escalation, never a loop — so a truly unfixable case still fails fast
  // into Needs Review instead of looping.
  const escalated = escalateToListLayout(currentSpec);
  if (escalated) {
    const escalatedResult = renderGraphicCard(escalated, graphicPalette);
    if (!escalatedResult.issues.length) return { card: escalatedResult.img, issues: [], finalSpec: escalated, variantSwapped: true };
    if (escalatedResult.issues.length < result.issues.length) return { card: escalatedResult.img, issues: escalatedResult.issues, finalSpec: escalated, variantSwapped: true };
  }
  return { card: result.img, issues: result.issues, finalSpec: currentSpec, variantSwapped: false };
}

async function processZeroCostScene(admin: any, scene: any, plan: any) {
  if (plan.render_strategy === "REUSE") {
    const source = await admin.rpc("current_scene_for_render_plan", { p_scene_render_plan_id: plan.source_scene_render_plan_id }).then((r: any) => r.data);
    if (!source || source.status !== "succeeded" || !source.result_url) throw new Error("REUSE_SOURCE_NOT_READY");
    // 2026-09-22 "FINAL stabilization pass" §3 — real Atlantis finding: this
    // branch previously hardcoded qa_status:"approved" on every REUSE copy
    // regardless of the source's ACTUAL qa_status, so a REUSE of a QA-
    // REJECTED source was marked approved with the false reason "zero-cost
    // reuse of an already-approved scene." A REUSE can never outlive its
    // source's QA outcome: if the source is currently rejected, the
    // dependent must fail with a distinct, honestly-classified error
    // (SOURCE_REJECTED, never confused with "not ready yet") rather than
    // silently inheriting an approval that never happened. The SQL claim
    // gate (claim_long_form_scene_for_render) now also refuses to claim a
    // REUSE/CROP/COMPOSITE scene while its source is qa_status='rejected',
    // so this check is defense-in-depth for anything already claimed before
    // that source was rejected out from under it — never the primary gate.
    // A null qa_status (legacy rows predating QA tracking, or REUSE/CROP
    // sources that are never independently re-checked) is treated as
    // approved, matching this codebase's existing convention elsewhere
    // (e.g. acceptedIdentityAnchor in referenceRendererPolicy.js).
    if (source.qa_status === "rejected") throw new Error("REUSE_SOURCE_REJECTED");
    await admin.from("long_form_scenes").update({ status: "succeeded", result_url: source.result_url, base_result_url: source.base_result_url ?? source.result_url, final_result_url: source.result_url, qa_status: source.qa_status ?? "approved", qa_result: { inheritedFrom: source.id, reason: source.qa_status === "approved" ? "zero-cost reuse of an already-approved scene" : "zero-cost reuse of a source with no independently recorded QA status" }, cost_usd: 0, render_model: source.render_model, updated_at: new Date().toISOString() }).eq("id", scene.id);
    return;
  }
  if (plan.render_strategy === "CROP" || plan.render_strategy === "COMPOSITE") {
    const source = await admin.rpc("current_scene_for_render_plan", { p_scene_render_plan_id: plan.source_scene_render_plan_id }).then((r: any) => r.data);
    if (!source || source.status !== "succeeded" || !source.result_url) throw new Error(`${plan.render_strategy}_SOURCE_NOT_READY`);
    // §3 (continued): a CROP/COMPOSITE still runs its OWN fresh QA on its
    // output below (via runQaCheckpoint), but it must never even attempt to
    // build derived pixels from a source image whose identity/style/content
    // already failed QA — the same "never inherit from a rejected source"
    // invariant as REUSE, just enforced before the crop instead of after.
    if (source.qa_status === "rejected") throw new Error(`${plan.render_strategy}_SOURCE_REJECTED`);
    const base = await fetchAndDecodeImage(source.result_url);
    const cropped = plan.render_strategy === "CROP" ? cropRegion(base, plan.composition?.cropRegion ?? "center_detail") : base;
    // Section 4/6 hard safety net: cropRegion() is now built to always
    // produce a true 16:9 window, but this scene must never ship a bad
    // frame silently even if a future change to that function (or an
    // unrecognized region string reaching some future fallback) broke that
    // guarantee — fail loudly (scene marked failed, refunded, retryable)
    // rather than ship an invalid final frame the way shot 19 did.
    if (plan.render_strategy === "CROP" && !isValidFinalAspectRatio(cropped.width, cropped.height)) {
      throw new Error(`INVALID_FINAL_FRAME_GEOMETRY: crop produced ${cropped.width}x${cropped.height}, not 16:9`);
    }
    const png = encodePng(cropped);
    const path = `long-form/scenes/${scene.id}.png`;
    const { error: uploadError } = await admin.storage.from("generated").upload(path, png, { contentType: "image/png", upsert: true });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);
    await admin.from("long_form_scenes").update({ status: "succeeded", result_url: publicUrl.publicUrl, base_result_url: publicUrl.publicUrl, final_result_url: publicUrl.publicUrl, cost_usd: 0, updated_at: new Date().toISOString() }).eq("id", scene.id);
    const { data: freshScene } = await admin.from("long_form_scenes").select("*").eq("id", scene.id).single();
    await runQaCheckpoint(admin, freshScene);
    return;
  }
  if (plan.render_strategy === "PROGRAMMATIC_GRAPHIC") {
    const { data: project } = await admin.from("long_form_projects").select("visual_style_preset").eq("id", plan.project_id).maybeSingle();
    const styleSpec = getStylePresetForProject(project?.visual_style_preset);
    const spec = plan.overlay_spec;
    // 2026-09-17 "long-form quality pass" (Part 2/3): a NEW-shape structured
    // spec (version:1, a real `template`) goes through the six-template
    // engine; any OLDER-shape row (from before this pass — {type:"BIG_TEXT"|
    // "LABEL", text, ...}) still renders exactly as before via the
    // pre-existing generic card, so no historical Mars row's stored plan
    // needs touching. Never a silent third shape — anything that's neither
    // is a genuine compile-time bug, not something this dispatch guesses at.
    const isStructuredSpec = spec && typeof spec === "object" && spec.version === 1 && typeof spec.template === "string";
    let finalSpec = spec;
    let variantSwapped = false;
    const { card, overflowed, issues } = isStructuredSpec
      ? await (async () => { const r = await renderGraphicCardWithAutoRepair(admin, plan, spec, styleSpec.graphicPalette); finalSpec = r.finalSpec; variantSwapped = r.variantSwapped; return { card: r.card, overflowed: false, issues: r.issues }; })()
      : (() => { const r = renderProgrammaticGraphicCard(spec, styleSpec); return { card: r.img, overflowed: r.overflowed, issues: r.overflowed ? ["legacy card overflowed even at minimum layout scale"] : [] }; })();
    if (variantSwapped) {
      // Persist the variant that actually worked so a later manual "Try
      // Another Layout" click (or a future auto-repair pass) starts from
      // reality, never re-attempting a variant already proven broken.
      await admin.from("long_form_scene_render_plans").update({ overlay_spec: finalSpec, updated_at: new Date().toISOString() }).eq("id", plan.id);
    }
    if (!isValidFinalAspectRatio(card.width, card.height)) throw new Error(`INVALID_FINAL_FRAME_GEOMETRY: graphic card produced ${card.width}x${card.height}, not 16:9`);
    const png = encodePng(card);
    const path = `long-form/scenes/${scene.id}.png`;
    const { error: uploadError } = await admin.storage.from("generated").upload(path, png, { contentType: "image/png", upsert: true });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);
    // Part 10/11 of the 2026-09-17 "fix PROGRAMMATIC_GRAPHIC" pass: a
    // programmatic graphic's `issues` list is DETERMINISTIC ground truth —
    // we know exactly what we attempted to draw, so there is no vision-QA
    // ambiguity to soften here the way there is for a generated photo. A
    // real Mars incident this closes: "blank Shot 63 was approved" and
    // "corrupted Shots 54/55 were approved" — both would have produced a
    // real `issues` entry (BLANK_OR_NEAR_BLANK_OUTPUT / an overflow) under
    // this renderer and are now a genuine HARD_FAIL, never silently
    // shipped and never merely flagged for optional review.
    const hasIssues = overflowed || issues.length > 0;
    await admin.from("long_form_scenes").update({
      status: "succeeded", result_url: publicUrl.publicUrl, base_result_url: publicUrl.publicUrl, final_result_url: publicUrl.publicUrl, overlay_applied: true,
      qa_status: hasIssues ? "rejected" : "approved",
      qa_result: hasIssues
        ? { approved: false, severity: "HARD_FAIL", requiresReview: false, failureType: "GRAPHIC_RENDER_DEFECT", repairStrategy: "regenerate a new treatment/variant, or shorten the underlying claim's text", reasons: issues.length ? issues : ["Overlay text did not fit even at the minimum layout scale and was truncated."] }
        : { approved: true, severity: "AUTO_READY", requiresReview: false, reason: "deterministic programmatic graphic — structural validation passed" },
      cost_usd: 0, updated_at: new Date().toISOString(),
    }).eq("id", scene.id);
    return;
  }
  throw new Error(`UNKNOWN_ZERO_COST_STRATEGY: ${plan.render_strategy}`);
}

// plan_code lives on `profiles` (keyed by user id), never on
// `long_form_projects` itself — mirrors advance-long-form-visual-world's
// own `admin.from("profiles").select("plan_code").eq("id", project.user_id)`
// lookup exactly.
async function resolveOwnerAndPlanCode(admin: any, projectId: string): Promise<{ userId: string; planCode: string }> {
  const { data: project, error } = await admin.from("long_form_projects").select("user_id").eq("id", projectId).maybeSingle();
  if (error) throw error;
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", project.user_id).maybeSingle();
  return { userId: project.user_id, planCode: profile?.plan_code ?? "free" };
}

// Section 5/6 of the 2026-09-16 "production invariants" pass — this
// function used to take a literal 1/3-width, full-height (or full-width,
// half-height) slice of the source and ship THAT narrow rectangle as the
// final frame, with no aspect-ratio correction at all. Real Mars incident:
// shot 19 shipped as a literal 907x1536 PORTRAIT PNG from exactly the
// `right_third` region on a 2720x1536 source ((2720*2/3, 0, 2720/3, 1536) —
// confirmed by directly decoding the shipped file). CROP means "editorially
// reframe the existing source while STILL outputting a full 16:9 frame,"
// never "take any narrow rectangle" — so every named region here is now a
// window whose OWN aspect ratio is already 16:9 (just repositioned/
// reframed within the source), never a slice with some other shape. A
// region string this table doesn't recognize (or `center_detail`, which by
// definition asks to isolate something smaller than the full frame) still
// falls back to a same-shaped, tighter-zoomed 16:9 window centered on the
// source, never a non-16:9 shape under any input.
export function cropRegion(img: RawImage, region: string): RawImage {
  // A 16:9 window at `zoom`x the source's own scale (zoom=1 is the widest
  // possible 16:9 window this source can offer without stretching — the
  // full frame, since every real source here is already 16:9 itself),
  // horizontally offset by `biasX` (-1=hard left, 0=center, 1=hard right)
  // and vertically by `biasY` — always clamped fully inside the source.
  const fullW = Math.min(img.width, img.height * LONG_FORM_FINAL_ASPECT_RATIO);
  const window = (zoom: number, biasX: number, biasY: number): [number, number, number, number] => {
    const w = fullW / zoom;
    const h = w / LONG_FORM_FINAL_ASPECT_RATIO;
    const x = ((img.width - w) / 2) * (1 + biasX);
    const y = ((img.height - h) / 2) * (1 + biasY);
    return [x, y, w, h];
  };
  const regions: Record<string, [number, number, number, number]> = {
    left_third: window(1.3, -1, 0), center_third: window(1.3, 0, 0), right_third: window(1.3, 1, 0),
    top_half: window(1.15, 0, -1), bottom_half: window(1.15, 0, 1),
    center_detail: window(1.6, 0, 0),
  };
  const [x, y, w, h] = (regions[region] ?? regions.center_detail).map(Math.round);
  const data = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const start = ((y + row) * img.width + x) * 4;
    data.set((img.data as Uint8Array).subarray(start, start + w * 4), row * w * 4);
  }
  return { width: w, height: h, data };
}

// Wraps text to fit maxWidth (in glyph-scale units) using measureText's own
// fixed-width-glyph metric, so wrapping and rendering never disagree about
// how wide a line actually is.
export function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(candidate, scale).width > maxWidth && current) { lines.push(current); current = word; }
    else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

// Section 15 of the 2026-09-16 "production invariants" pass: fits `lines`
// of `text` at the LARGEST scale (down from `startScale`, floored at
// `minScale`) that keeps every wrapped line's width within `maxWidth` AND
// the whole block's height within `maxHeight` — the deterministic "no
// clipping" preflight the spec asks for, run BEFORE compositing rather than
// discovered after the fact. Returns overflowed:true only when even the
// floor scale can't fit (rare — the floor is deliberately small), which the
// caller uses to route this graphic to NEEDS_REVIEW instead of silently
// shipping clipped/overflowing text.
export function fitTextToZone(text: string, startScale: number, minScale: number, maxWidth: number, maxHeight: number): { lines: string[]; scale: number; overflowed: boolean } {
  for (let scale = startScale; scale >= minScale; scale -= Math.max(1, Math.round(startScale * 0.08))) {
    const lines = wrapText(text, scale, maxWidth);
    const lineHeight = measureText("M", scale).height + Math.round(scale * 1.5);
    const fitsWidth = lines.every((l) => measureText(l, scale).width <= maxWidth);
    if (fitsWidth && lines.length * lineHeight <= maxHeight) return { lines, scale, overflowed: false };
  }
  // Even the floor scale overflows — last resort: floor scale, word-boundary
  // truncated with an ellipsis, flagged so the caller escalates to review
  // rather than trusting this looks fine.
  const words = text.split(/\s+/).filter(Boolean);
  let truncated = "";
  for (const word of words) {
    const candidate = truncated ? `${truncated} ${word}` : word;
    if (measureText(`${candidate}…`, minScale).width > maxWidth) break;
    truncated = candidate;
  }
  return { lines: wrapText(`${truncated || words[0] || ""}…`, minScale, maxWidth), scale: minScale, overflowed: true };
}

// Honors the overlaySpec compileOverlaySpec (sceneRenderPlan.ts) actually
// produces — placement (upper/lower third), a safe-zone box, and textStyle
// (casing/alignment/outline/shadow) — rather than always dead-centering one
// unwrapped uppercase line regardless of what was compiled. Two dedicated
// layouts (NUMBER_EMPHASIS, COMPARE — Section 12/13) render actual distinct
// compositions rather than falling back to the same centered-text card;
// every other requested template (ICON_STATEMENT, SYMBOLIC_NEGATION,
// PROGRESS/BUDGET, CAUSE_EFFECT, TIMELINE, MAP, FLOW, SIMPLE_CHART,
// ANNOTATED_OBJECT) still falls back to the BIG_TEXT/LABEL layout below —
// real, deliberate follow-up work, not silently claimed as done (see the
// final report).
export function renderProgrammaticGraphicCard(overlaySpec: any, styleSpec: any): { img: RawImage; overflowed: boolean } {
  const width = 2720, height = 1536;
  const bg: [number, number, number] = [24, 26, 32];
  const data = new Uint8Array(width * height * 4);
  const img: RawImage = { width, height, data };
  drawRect(img, 0, 0, width, height, bg, 255);

  const rawText = String(overlaySpec?.text ?? "");
  if (!rawText) return { img, overflowed: false };

  const textStyle = overlaySpec?.textStyle ?? {};
  const safeZone = overlaySpec?.safeZone ?? { xPct: 6, yPct: 6, widthPct: 88, heightPct: 26 };
  const placement = overlaySpec?.placement ?? "upper_third";
  const isPrimary = overlaySpec?.hierarchy === "primary" || textStyle.weight === "bold";
  const text = textStyle.casing === "sentence" ? rawText : rawText.toUpperCase();

  // A thin accent bar identifies this as a designed information card (not
  // just centered text on a flat rectangle) and cheaply signals hierarchy —
  // thicker/brighter for a primary (BIG_TEXT) card than a secondary LABEL.
  const accent: [number, number, number] = [140, 220, 90];
  drawRect(img, 0, 0, width, isPrimary ? 14 : 8, accent, 255);

  const zoneX = Math.round((safeZone.xPct / 100) * width);
  const zoneWidth = Math.round((safeZone.widthPct / 100) * width);
  const zoneHeight = Math.round((safeZone.heightPct / 100) * height);

  if (overlaySpec?.type === "NUMBER_EMPHASIS") {
    // Section 12's own example: "MAX EVA TIME / 2 HOURS" should teach the
    // number in under a second — one huge number, one short unit/label
    // underneath, never the full sentence at one uniform size.
    const match = text.match(/^([\d.,%+-]+\s*\S*)\s*(.*)$/);
    const numberPart = (match?.[1] ?? text).trim();
    const labelPart = (match?.[2] ?? "").trim();
    const numberFit = fitTextToZone(numberPart, Math.max(3, Math.round(width / 12)), 8, zoneWidth, Math.round(zoneHeight * 0.7));
    const labelFit = labelPart ? fitTextToZone(labelPart, Math.max(3, Math.round(width / 46)), 6, zoneWidth, Math.round(zoneHeight * 0.3)) : { lines: [], scale: 0, overflowed: false };
    const numberLineHeight = measureText("M", numberFit.scale).height + Math.round(numberFit.scale * 1.5);
    const labelLineHeight = labelPart ? measureText("M", labelFit.scale).height + Math.round(labelFit.scale * 1.2) : 0;
    const blockHeight = numberFit.lines.length * numberLineHeight + labelFit.lines.length * labelLineHeight;
    let blockTop = Math.round((height - blockHeight) / 2);
    numberFit.lines.forEach((line, i) => {
      const { width: lw } = measureText(line, numberFit.scale);
      drawText(img, line, Math.round((width - lw) / 2), blockTop + i * numberLineHeight, numberFit.scale, [255, 255, 255], { outline: true, shadow: true });
    });
    blockTop += numberFit.lines.length * numberLineHeight + Math.round(numberFit.scale * 0.4);
    labelFit.lines.forEach((line, i) => {
      const { width: lw } = measureText(line, labelFit.scale);
      drawText(img, line, Math.round((width - lw) / 2), blockTop + i * labelLineHeight, labelFit.scale, [180, 220, 255], { outline: false, shadow: true });
    });
    return { img, overflowed: numberFit.overflowed || labelFit.overflowed };
  }

  if (overlaySpec?.type === "COMPARE" && /\s(?:vs\.?|versus|\/|compared to)\s/i.test(text)) {
    // A real split composition (Section 12: "the visual should show the
    // relationship... not two independent, disconnected images") rather
    // than one run-on sentence — a center divider, one side per label.
    const [leftRaw, rightRaw] = text.split(/\s(?:vs\.?|versus|\/|compared to)\s/i);
    const colWidth = Math.round(zoneWidth / 2) - Math.round(width * 0.02);
    drawRect(img, Math.round(width / 2) - 2, Math.round(height * 0.2), 4, Math.round(height * 0.6), [90, 100, 120], 255);
    [{ text: leftRaw, x: zoneX }, { text: rightRaw, x: Math.round(width / 2) + Math.round(width * 0.02) }].forEach(({ text: side, x }) => {
      const fit = fitTextToZone((side ?? "").trim(), Math.max(3, Math.round(width / 26)), 6, colWidth, Math.round(zoneHeight * 1.4));
      const lineHeight = measureText("M", fit.scale).height + Math.round(fit.scale * 1.5);
      const top = Math.round((height - fit.lines.length * lineHeight) / 2);
      fit.lines.forEach((line, i) => {
        const { width: lw } = measureText(line, fit.scale);
        drawText(img, line, x + Math.round((colWidth - lw) / 2), top + i * lineHeight, fit.scale, [255, 255, 255], { outline: true, shadow: true });
      });
    });
    return { img, overflowed: false };
  }

  const startScale = Math.max(3, Math.round(width / (isPrimary ? 30 : 42)));
  const { lines, scale, overflowed } = fitTextToZone(text, startScale, Math.max(3, Math.round(startScale * 0.4)), zoneWidth, zoneHeight);
  const lineHeight = measureText("M", scale).height + Math.round(scale * 1.5);
  const blockHeight = lines.length * lineHeight;

  // upper_third centers the text block within the top safeZone band;
  // lower_third mirrors that against the bottom of the frame — everything
  // else (a bare "center" placement, or an unrecognized value) falls back
  // to true vertical center, same as the old unconditional behavior.
  let blockTop: number;
  if (placement === "upper_third") blockTop = Math.round((zoneHeight - blockHeight) / 2) + Math.round(height * 0.06);
  else if (placement === "lower_third") blockTop = height - Math.round(height * 0.06) - zoneHeight + Math.round((zoneHeight - blockHeight) / 2);
  else blockTop = Math.round((height - blockHeight) / 2);

  const alignment = textStyle.alignment ?? "center";
  lines.forEach((line, i) => {
    const { width: lw } = measureText(line, scale);
    const lx = alignment === "left" ? zoneX : alignment === "right" ? zoneX + zoneWidth - lw : Math.round((width - lw) / 2);
    drawText(img, line, lx, blockTop + i * lineHeight, scale, [255, 255, 255], { outline: Boolean(textStyle.outline), shadow: textStyle.shadow !== false });
  });
  return { img, overflowed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = req.headers.get("x-cron-secret");
  const recoveryOnly = Boolean(RECOVERY_SECRET && req.headers.get("x-recovery-secret") === RECOVERY_SECRET);
  if ((!ADVANCE_SECRET || secret !== ADVANCE_SECRET) && !recoveryOnly) return json({ error: "Unauthorized" }, 401);
  if (SCENE_PAUSED) return json({ paused: true, claimed: false });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  let visualWorldVersionId = body?.visualWorldVersionId ? String(body.visualWorldVersionId) : null;

  if (!visualWorldVersionId) {
    // Global recovery sweep (cron, no specific target): find ANY world with
    // claimable scene work outstanding.
    const { data: candidate } = await admin.from("long_form_scenes").select("visual_world_version_id").in("status", ["pending", "running"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!candidate) return json({ claimed: false });
    visualWorldVersionId = candidate.visual_world_version_id;
  }

  try {
    await reconcileNonterminal(admin, visualWorldVersionId);

    const { data: claimedRows, error: claimError } = await admin.rpc("claim_long_form_scene_for_render", { p_visual_world_version_id: visualWorldVersionId });
    if (claimError) throw claimError;
    const scene = claimedRows?.[0];
    if (!scene) return json({ claimed: false, reconciled: true });

    // 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION"
    // pass — defense-in-depth authorization gate (§9: "Provider dispatch
    // should require something equivalent to generation_authorized = true
    // ... without explicit authorization, provider dispatch must return
    // without creating a job"). The PRIMARY safety mechanism is
    // compile-long-form-scenes never inserting a claimable status at all
    // (AWAITING_GENERATION, not 'pending') — this is a SECOND, independent
    // check at the dispatch function itself, in case a 'pending' scene
    // ever reaches this point with no valid backing charge (e.g. legacy
    // rows, a future bug in some other caller). A scene whose
    // generation_run_id doesn't resolve to a currently-charged, non-paused
    // run is put back exactly as claim_long_form_scene_for_render found it
    // (never left claimed-but-stuck) and this invocation exits — no
    // provider job, no dispatch, ever, for an unauthorized scene. This is
    // project/version-scoped, deliberately never a global environment flag.
    if (scene.generation_run_id) {
      const { data: run } = await admin.from("long_form_episode_generation_charges").select("status,is_paused").eq("id", scene.generation_run_id).maybeSingle();
      if (!run || run.status !== "charged" || run.is_paused) {
        await admin.from("long_form_scenes").update({ status: "awaiting_generation", claim_attempts: Math.max(0, (scene.claim_attempts ?? 1) - 1), lease_until: null, job_id: null }).eq("id", scene.id);
        console.error("[advance-long-form-scene-generation] refusing unauthorized dispatch — scene reverted to awaiting_generation:", scene.id, "generation_run_id:", scene.generation_run_id);
        return json({ claimed: false, unauthorized: true });
      }
    } else {
      // A claimed scene with NO generation_run_id at all has never been
      // authorized by any charge — never dispatched, ever, regardless of
      // status. Reverted the same way, never left stuck claimed.
      await admin.from("long_form_scenes").update({ status: "awaiting_generation", claim_attempts: Math.max(0, (scene.claim_attempts ?? 1) - 1), lease_until: null, job_id: null }).eq("id", scene.id);
      console.error("[advance-long-form-scene-generation] refusing dispatch for a scene with no generation_run_id — reverted to awaiting_generation:", scene.id);
      return json({ claimed: false, unauthorized: true });
    }

    try {
      const { data: plan, error: planError } = await admin.from("long_form_scene_render_plans").select("*").eq("id", scene.scene_render_plan_id).maybeSingle();
      if (planError) throw planError;
      if (!plan) throw new Error("SCENE_RENDER_PLAN_MISSING");

      if (["REUSE", "CROP", "COMPOSITE", "PROGRAMMATIC_GRAPHIC"].includes(plan.render_strategy)) {
        await processZeroCostScene(admin, scene, plan);
        await closeSampleIfDone(admin, scene.generation_run_id);
      } else if (plan.render_strategy === "GENERATE") {
        const { userId, planCode } = await resolveOwnerAndPlanCode(admin, plan.project_id);
        let referenceUrls: string[] = [];
        let promptSuffix: string | null = null;
        // Hoisted out of the reference-resolution branch below (2026-09-23
        // Item A) — the style-reinforcement block further down needs the
        // renderer's own reference-capacity limit regardless of whether this
        // beat carries any canonical Visual World references at all (a pure
        // environment/establishing shot can legitimately have none).
        const { renderModel } = resolveLongFormSceneRenderer({ tier: (plan.render_tier ?? "v3") as any, operation: "generate" });
        const maxRefs = getMaxReferenceImages(renderModel);
        if (plan.reference_asset_ids?.length) {
          // Dispatch-time re-validation (Part 1) — a reference resolved at
          // COMPILE time can go stale before dispatch (regenerated,
          // rejected, superseded): re-check every one against the SAME
          // "current" definition compile used (current_long_form_reference_
          // assets — not replaced, not stale, succeeded, not rejected)
          // rather than trusting a bare id->result_url lookup, which would
          // happily hand back a superseded row's still-existing URL.
          const { data: current } = await admin.rpc("current_long_form_reference_assets", { p_visual_world_version_id: scene.visual_world_version_id });
          const currentById = new Map((current ?? []).filter((r: any) => r.is_ready).map((r: any) => [r.id, r]));
          const resolved = plan.reference_asset_ids.map((id: string) => currentById.get(id)).filter(Boolean);
          if (resolved.length !== plan.reference_asset_ids.length) throw new Error("CANONICAL_REFERENCE_STALE_AT_DISPATCH");

          // Provider-aware payload (Part 2/3): Kling's own verified limit is
          // 1 reference image, but a real scene often needs several — never
          // silently truncate. resolveSceneReferencePayload sends the
          // canonical refs directly whenever the renderer's own limit
          // covers them, or composites a deterministic, $0, cacheable
          // SceneReferenceBundle (one image) otherwise.
          const canonicalAssets = resolved.map((r: any) => ({ id: r.id, result_url: r.result_url, reference_type: r.reference_type, entity_id: r.entity_id }));
          const payload = await resolveSceneReferencePayload({ admin, renderModel, maxReferenceImages: maxRefs, visualWorldVersionId: scene.visual_world_version_id, canonicalReferenceAssets: canonicalAssets });
          referenceUrls = payload.referenceUrls;
          promptSuffix = payload.promptInstruction;
        }
        const roleRules = (plan.director_meta?.referenceRoles ?? []).map((ref: any, index: number) => `Reference ${index + 1} is ${String(ref.role ?? "OBJECT_REFERENCE").replace(/_/g, " ")}${ref.represents ? ` for ${ref.represents}` : ""}. Use it only for that role. Do not copy framing, layout, background, embedded text, labels, diagrams, UI, borders, or reference-sheet arrangement.`).join("\n");
        let dispatchSuffix = [promptSuffix, roleRules].filter(Boolean).join("\n\n") || null;
        let negativePrompt = plan.director_meta?.negativePrompt ?? null;
        // 2026-09-23 "systemic production stabilization" pass, Item A — a
        // bounded, deterministic style-reinforcement ladder for a shot that
        // has already come back with QA's own styleMismatchSeverity:"major"
        // (failureType STYLE_ABANDONED) on its immediately preceding
        // attempt(s). This is NEVER auto-triggered — it only ever fires when
        // the user has already clicked Regenerate (this dispatch is the
        // retried scene's own claim), and it never adds a style reference as
        // a DEFAULT for every generation (episodePreflight.ts's own §
        // documents why that was deliberately never resurrected) — only as a
        // bounded repair for a shot that has PROVEN it drifts, capped at 2
        // reinforced attempts before this shot's failures stop being
        // silently retriable (see the QA-recording block below).
        if (scene.replaces_scene_id) {
          const priorFailures = await fetchConsecutiveFailureChain(admin, scene.replaces_scene_id);
          if (classifyStyleRepairStage(priorFailures) === "REINFORCE" && referenceUrls.length < maxRefs) {
            const reinforcementUrl = await findStyleReinforcementReferenceUrl(admin, scene, plan);
            if (reinforcementUrl) {
              referenceUrls = [...referenceUrls, reinforcementUrl];
              dispatchSuffix = [dispatchSuffix, styleReinforcementReferenceInstruction(referenceUrls.length)].filter(Boolean).join("\n\n");
              negativePrompt = [negativePrompt, STYLE_REINFORCEMENT_NEGATIVE_SUFFIX].filter(Boolean).join(" ");
            }
          }
        }
        await kickJobWorker(await ensureSceneJob(admin, scene, userId, plan.image_prompt, planCode, plan.render_tier ?? "v3", referenceUrls, dispatchSuffix, negativePrompt));
      } else if (plan.render_strategy === "EDIT") {
        const { userId, planCode } = await resolveOwnerAndPlanCode(admin, plan.project_id);
        let sourceUrl: string | null = null;
        // A plan-driven EDIT (source_scene_render_plan_id set) always edits
        // FROM that fixed source, regardless of replaces_scene_id — a retry
        // of this same EDIT operation also sets replaces_scene_id (to the
        // failed/previous attempt of THIS shot), which must never be
        // mistaken for the thing being edited. Only when there is no plan-
        // level source (an ad-hoc user "Edit Scene" action layered onto a
        // GENERATE-origin plan) does replaces_scene_id mean the source.
        if (plan.source_scene_render_plan_id) {
          const { data: source } = await admin.rpc("current_scene_for_render_plan", { p_scene_render_plan_id: plan.source_scene_render_plan_id });
          sourceUrl = source?.result_url ?? null;
        } else if (scene.replaces_scene_id) {
          const { data: prior } = await admin.from("long_form_scenes").select("result_url").eq("id", scene.replaces_scene_id).maybeSingle();
          sourceUrl = prior?.result_url ?? null;
        }
        if (!sourceUrl) throw new Error("EDIT_SOURCE_IMAGE_NOT_READY");
        await kickJobWorker(await ensureSceneJob(admin, scene, userId, plan.image_prompt, planCode, plan.render_tier ?? "v3", [sourceUrl], null, plan.director_meta?.negativePrompt ?? null));
      } else {
        throw new Error(`UNKNOWN_RENDER_STRATEGY: ${plan.render_strategy}`);
      }

      await dispatchNext(visualWorldVersionId);
      return json({ claimed: true, id: scene.id, renderStrategy: plan.render_strategy });
    } catch (sceneError) {
      const message = stringifyError(sceneError);

      // EMERGENCY PAUSE race window: this scene was claimed a moment before
      // its generation run was paused. enqueue_long_form_scene_job() already
      // released it back to 'pending' with the claim attempt uncounted and
      // no job ever created — never treat this as a failure. No "failed"
      // status, no refund (nothing was charged for this attempt to refund),
      // and no further self-chaining: the next claim on this same paused
      // world will find nothing eligible and stop on its own.
      if (message.includes("GENERATION_PAUSED")) {
        console.log("[advance-long-form-scene-generation] scene released, generation paused:", scene.id);
        return json({ claimed: true, id: scene.id, paused: true });
      }

      // A failure AFTER a successful claim must not sit on a 4-minute lease
      // waiting to be reclaimed — mark it failed immediately (with the real
      // error) so it surfaces in the UI right away and can be retried. This
      // never burns a provider retry attempt for a pre-dispatch validation
      // error: no job was ever created (job_id stays null), so retry_long_
      // form_scene's own branch resumes the SAME row rather than spending a
      // fresh provider call.
      console.error("[advance-long-form-scene-generation] scene failed:", scene.id, message);
      await admin.from("long_form_scenes").update({ status: "failed", lease_until: null, last_error_code: message.slice(0, 200), last_error_at: new Date().toISOString() }).eq("id", scene.id);
      // Pre-dispatch failure (validation, missing reference, unknown
      // strategy, enqueue failure — job_id was never set): refund this
      // attempt's charge, if any. See the matching refund call in
      // reconcileNonterminal for the genuine-provider-failure case.
      await admin.rpc("refund_scene_operation_charge_if_failed", { p_scene_id: scene.id }).catch((e: any) => console.error("[advance-long-form-scene-generation] refund failed:", scene.id, e));
      await closeSampleIfDone(admin, scene.generation_run_id);
      await dispatchNext(visualWorldVersionId);
      return json({ claimed: true, id: scene.id, failed: true, error: message });
    }
  } catch (error) {
    const message = stringifyError(error);
    console.error("[advance-long-form-scene-generation] failure:", message);
    return json({ claimed: false, error: message }, 200);
  }
});
