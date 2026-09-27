// deno-lint-ignore-file no-explicit-any
// repair-long-form-storyboard/index.ts — "Fix Storyboard".
//
// 2026-09-22 targeted storyboard repair. Real Atlantis incident: 37 shots
// resolved to nearly the same visual because the (deterministic, zero-LLM)
// shot-expansion pipeline split several long single-clause narration spans
// purely by spoken DURATION, cutting them into meaningless word-count
// fragments ("geologists evaluate" | "whether deposits" | "indicate rapid"
// | "inundation or" | "gradual deposition"). The root cause was fixed
// generically in visualShotPlanning.js (MIN_WORDS_PER_SHOT + phrase-boundary
// snapping, SHOT_PLANNER_VERSION bumped to semantic-shots-v5) — this
// function's ONLY job is to re-run that now-fixed, already-existing,
// already-tested deterministic pipeline against the CURRENT plan's own
// persisted macro-level visualSequences (never history, never an LLM call,
// never a provider call, never a credit charge) and, if the result
// genuinely resolves the flagged duplicates, persist it as a new
// VisualPlan version (apply_long_form_storyboard_repair) — exactly the same
// surgical, versioned, atomic-pointer-switch shape save_storyboard_edits
// already uses for a human's manual edits.
//
// This is NOT a general storyboard regenerator: visualSequences (the
// macro-level narrative beats an earlier LLM call already produced),
// entityRegistry, continuityGroups and every macro's own narrative content
// are carried through completely unchanged — only the DETERMINISTIC shot-
// splitting step is re-run, so a macro whose narration was never fragmented
// in the first place reprocesses to byte-identical output (see
// semanticFragmentRepair.test.mjs's idempotence test).
//
// POST { projectId, dryRun }
// Returns { ok, dryRun, ready, beforeBeatCount, afterBeatCount,
//   remainingDuplicateBeatIds, narrationCoverageOk, visualWorldDeltaRequired,
//   newVisualPlanVersionId? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { establishFirstSetups, normalizeNarrationCoverage, narrationCoverageIssues } from "../_shared/visualPlanDeterministic.js";
import { refineVisualSequences, retimeVisualBeats } from "../_shared/visualShotPlanning.js";
import { sequenceEpisode, validatePlanContract } from "../_shared/visualDirectorReliability.js";
import { preflightEpisode } from "../_shared/episodePreflight.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function categorize(beats: any[]) {
  return {
    totalVisualBeats: beats.length,
    estimatedBaseSetups: new Set(beats.filter((b) => b.renderMethod === "GENERATE").map((b) => b.baseSetupKey)).size,
    estimatedEdits: beats.filter((b) => b.renderMethod === "EDIT").length,
    estimatedReuseEvents: beats.filter((b) => b.renderMethod === "REUSE").length,
    estimatedCrops: beats.filter((b) => b.renderMethod === "CROP").length,
    estimatedDiagrams: beats.filter((b) => b.visualType === "DIAGRAM").length,
    estimatedMaps: beats.filter((b) => b.visualType === "MAP").length,
    estimatedProgrammaticGraphics: beats.filter((b) => b.renderMethod === "PROGRAMMATIC_GRAPHIC").length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const dryRun = Boolean(body?.dryRun);
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError || !project || project.user_id !== user.id) return err(req, "Project not found", 404);
  if (!project.current_visual_plan_version_id) return err(req, "No current storyboard to repair", 404);

  const { data: source, error: planError } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
  if (planError || !source || source.status !== "ready" || source.script_version_id !== project.current_script_version_id) {
    return err(req, "This storyboard isn't in a repairable state right now.", 422);
  }

  const { data: scriptRow } = await admin.from("long_form_script_versions").select("script_document").eq("id", source.script_version_id).maybeSingle();
  if (!scriptRow?.script_document) return err(req, "Narration script not found", 404);
  const scriptDocument = scriptRow.script_document;

  const contractVersionId = source.visual_plan?.narrationContractVersionId;
  if (!contractVersionId) return err(req, "This storyboard has no narration contract to repair against.", 422);
  const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("*").eq("id", contractVersionId).eq("project_id", projectId).maybeSingle();
  if (!contractRow || contractRow.status !== "ready" || contractRow.script_version_id !== project.current_script_version_id || !contractRow.claims?.length) {
    return err(req, "This storyboard's narration contract isn't ready.", 422);
  }

  // ---- The exact deterministic pipeline stageFinalizing already runs
  // (advance-long-form-visual-plan/index.ts), re-invoked here byte-for-byte
  // against the SAME persisted visualSequences — the only thing that
  // changed is refineVisualSequences' own internal shot-splitting logic
  // (already fixed, already tested) and its SHOT_PLANNER_VERSION, which is
  // what makes it actually reprocess a plan compiled under the old buggy
  // version instead of returning a pass-through clone.
  const textDensity = ["minimal", "balanced", "frequent"].includes(project.on_screen_text_density) ? project.on_screen_text_density : "balanced";
  const beforePlan = source.visual_plan;
  // refineVisualSequences ALWAYS overwrites each pushed visualSequences
  // entry's own `id` to `sequence_${macro.id}` (its shot ids stay keyed off
  // the ORIGINAL macro.id via sourceMacroBeatId) — feeding its own already-
  // persisted output back in as macroItems without restoring `id` first
  // double-prefixes every id on this second pass. Restore the original
  // macro id before reprocessing so shot ids/sequenceIds come out in the
  // exact same scheme the plan already uses everywhere else.
  const restoredInput = structuredClone(beforePlan);
  restoredInput.visualSequences = (restoredInput.visualSequences ?? []).map((s: any) => ({ ...s, id: s.sourceMacroBeatId }));
  const preNormalized = establishFirstSetups(restoredInput);
  const refined = refineVisualSequences(preNormalized.plan, scriptDocument, textDensity, contractRow.claims);
  const postNormalized = establishFirstSetups(refined);
  const retimed = retimeVisualBeats(postNormalized.plan, scriptDocument);
  // Narration-coverage normalizer (item 8) — a defensive safety net. Real
  // Atlantis finding: retimeVisualBeats' own local re-split (for a shot that
  // would otherwise exceed its duration limit) can itself leave two beats
  // claiming the exact same narration span — confirmed present right after
  // retiming, not before, so this MUST run after it, on the final beat
  // timing, never before. Resolves legacy corruption (an orphaned
  // duplicate-range beat, a partial overlap) deterministically instead of
  // letting it permanently block repair.
  const coverageNormalized = normalizeNarrationCoverage(retimed);
  const repairedPlan: any = coverageNormalized.plan;
  repairedPlan.narrationContractVersionId = contractVersionId;
  sequenceEpisode(repairedPlan.visualBeats);
  const contractErrors = validatePlanContract(repairedPlan, contractRow, project.current_script_version_id);
  if (contractErrors.length) return err(req, "The repaired storyboard failed narration-contract validation.", 422, { contractErrors: contractErrors.slice(0, 5) });

  // ---- Re-run the SAME authoritative Generate-readiness duplicate/compile
  // check (episodePreflight.ts) against the repaired plan, using the
  // project's current adopted Visual World exactly as Generate itself would
  // — never a different/looser check than what actually gates generation.
  const { data: compat } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: projectId });
  if (!compat?.compatible) return err(req, "Visual World isn't ready — repair the storyboard again once it is.", 422, { reason: compat?.reason });
  const [{ data: world }, { data: assets }] = await Promise.all([
    admin.from("long_form_visual_world_versions").select("*").eq("id", compat.visualWorldVersionId).maybeSingle(),
    admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", compat.visualWorldVersionId),
  ]);

  const beforeContext = { project: { ...project, scene_generation_tier: project.scene_generation_tier ?? "v3" }, plan: beforePlan, world, assets: assets ?? [], contract: contractRow };
  const afterContext = { ...beforeContext, plan: repairedPlan };
  const beforePreflight = preflightEpisode(beforeContext);
  const afterPreflight = preflightEpisode(afterContext);
  const remainingDuplicateBeatIds = [...new Set(afterPreflight.errors.filter((e: any) => e.reason.startsWith("DUPLICATE_GENERATE_PROMPT")).flatMap((e: any) => [e.beatId, e.reason.split(":")[1]]).filter(Boolean))];
  const remainingCoverageIssues = narrationCoverageIssues(repairedPlan.visualBeats, scriptDocument.narrationSegments ?? []);
  const narrationCoverageOk = remainingCoverageIssues.length === 0;
  const zeroDurationBeatIds = repairedPlan.visualBeats.filter((b: any) => b.estimatedEndSeconds <= b.estimatedStartSeconds).map((b: any) => b.id);
  // This repair mechanism only ever re-splits shots WITHIN each macro's own
  // already-established primaryEntityIds/supportingEntityIds — it can never
  // introduce an entity the Visual World doesn't already know about.
  const visualWorldDeltaRequired = false;

  const stats = {
    beforeBeatCount: beforePlan.visualBeats.length,
    afterBeatCount: repairedPlan.visualBeats.length,
    beforeDuplicateErrorCount: beforePreflight.errors.filter((e: any) => e.reason.startsWith("DUPLICATE_GENERATE_PROMPT")).length,
    afterDuplicateErrorCount: afterPreflight.errors.filter((e: any) => e.reason.startsWith("DUPLICATE_GENERATE_PROMPT")).length,
    remainingDuplicateBeatIds,
    narrationCoverageOk,
    remainingCoverageIssues,
    coverageNormalizerRemovedBeatIds: coverageNormalized.removedBeatIds,
    coverageNormalizerTrimmedBeatIds: coverageNormalized.trimmedBeatIds,
    zeroDurationBeatIds,
    visualWorldDeltaRequired,
    providerCallsMade: 0,
    creditsCharged: 0,
  };
  const ready = remainingDuplicateBeatIds.length === 0 && narrationCoverageOk && zeroDurationBeatIds.length === 0 && afterPreflight.ok;

  if (dryRun || !ready) {
    return ok(req, { ok: true, dryRun: true, ready, ...stats });
  }

  const summary = categorize(repairedPlan.visualBeats);
  const { data: dest, error: applyError } = await admin.rpc("apply_long_form_storyboard_repair", {
    p_source_id: source.id, p_user_id: user.id, p_repaired_plan: repairedPlan, p_storyboard_summary: summary,
    p_repair_meta: { repairedBeatCountBefore: stats.beforeBeatCount, repairedBeatCountAfter: stats.afterBeatCount },
  });
  if (applyError) {
    const message = applyError.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("STORYBOARD_CHANGED") ? 409 : message.includes("REPLAN_IN_PROGRESS") ? 409 : 500;
    return err(req, status === 409 ? "The storyboard changed since this repair started — please refresh and try again." : "Could not apply the storyboard repair.", status);
  }

  return ok(req, { ok: true, dryRun: false, ready: true, ...stats, newVisualPlanVersionId: dest.id });
});
