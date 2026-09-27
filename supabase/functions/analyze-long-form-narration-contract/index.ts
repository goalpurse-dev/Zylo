// deno-lint-ignore-file no-explicit-any
// analyze-long-form-narration-contract/index.ts
//
// Part 14 of the 2026-09-15 semantic-grounding pass: "First: A. build the
// new contract architecture, B. run the semantic compiler against Mars in
// ANALYSIS/TEST MODE, C. produce a projected new visual interpretation,
// D. show me concrete examples. Do NOT replace its current VisualPlan
// automatically."
//
// This compiles a REAL Narration Visual Contract from a project's current
// READY script (a real, cheap gpt-5-mini text call — genuinely executed,
// its cost/tokens/latency are meant to be reported, unlike the image-
// provider calls this task explicitly forbids) and persists it as a new,
// versioned row. It NEVER sets project.current_narration_contract_version_id
// itself (analysisOnly is always true here — there is no production call
// site yet that would consume that pointer to compile NEW scenes; wiring a
// project over to "live" is a deliberate future step, not implied by
// building/testing this architecture) and never touches VisualPlan/Visual
// World/scenes in any way — this is a pure read(script)-then-write(new
// contract row) operation.
//
// Also returns a projectedComparison: for every claim, what the OLD purely-
// regex-based visualFocus (visualShotPlanning.js) would have classified the
// same narration text as, versus what the contract now says — the
// "projected new visual interpretation" the task asks to see concretely.
//
// POST { projectId }
// Returns { ok:true, contractVersionId, claims, stats, projectedComparison, chapterCount, segmentCount }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { compileNarrationVisualContract, NARRATION_CONTRACT_COMPILER_VERSION, resolveClaimVisualType, matchClaimToRange } from "../_shared/narrationVisualContract.ts";
import { visualFocus, semanticRanges } from "../_shared/visualShotPlanning.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  if (!OPENAI_KEY) return err(req, "OPENAI_API_KEY not configured", 500);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("id, user_id, current_script_version_id, current_visual_plan_version_id").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!project.current_script_version_id) return err(req, "This project has no ready script yet", 400);

  const { data: scriptRow } = await admin.from("long_form_script_versions").select("id, status, script_document").eq("id", project.current_script_version_id).maybeSingle();
  if (!scriptRow || scriptRow.status !== "ready" || !scriptRow.script_document) return err(req, "This project's script is not ready", 400);

  const segments: any[] = scriptRow.script_document.narrationSegments ?? [];
  if (!segments.length) return err(req, "This script has no narration segments", 400);

  const { data: versionRow } = await admin.from("long_form_narration_contract_versions").select("version").eq("project_id", projectId).eq("script_version_id", scriptRow.id).order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = (versionRow?.version ?? 0) + 1;

  const { data: inserted, error: insertError } = await admin.from("long_form_narration_contract_versions").insert({
    project_id: projectId, script_version_id: scriptRow.id, version: nextVersion, status: "compiling", compiler_version: NARRATION_CONTRACT_COMPILER_VERSION, model: "gpt-5-mini",
  }).select("id").single();
  if (insertError || !inserted) return err(req, "Could not start contract compilation", 500);

  let result;
  try {
    result = await compileNarrationVisualContract({ segments, openaiKey: OPENAI_KEY });
  } catch (error) {
    await admin.from("long_form_narration_contract_versions").update({ status: "failed", last_error_code: String(error).slice(0, 200), last_error_at: new Date().toISOString() }).eq("id", inserted.id);
    return err(req, "Contract compilation failed", 500, { code: "COMPILE_FAILED" });
  }

  await admin.from("long_form_narration_contract_versions").update({ status: "ready", claims: result.claims, stats: result.stats, updated_at: new Date().toISOString() }).eq("id", inserted.id);

  // Projected comparison (Part 14.C/D): reuse visualShotPlanning's OWN
  // semanticRanges to get the exact same sub-segment slices the real
  // planner would produce, then show OLD (pure regex) vs NEW (contract)
  // classification side by side for every one of them.
  const segmentMap = new Map(segments.map((s: any) => [s.id, s]));
  const projectedComparison: any[] = [];
  for (const segment of segments) {
    const ranges = semanticRanges(segmentMap.get(segment.id) ?? { id: segment.id, text: "" });
    for (const range of ranges) {
      const claim = matchClaimToRange(result.claims, range.segmentId, range.text);
      const oldFocus = visualFocus(range.text, { visualType: "STORY_ILLUSTRATION" });
      projectedComparison.push({
        segmentId: range.segmentId, narrationText: range.text,
        oldVisualType: oldFocus.type,
        newVisualType: claim ? resolveClaimVisualType(claim, "balanced") : null,
        claimType: claim?.claimType ?? null, planningMode: claim?.planningMode ?? null,
        forbiddenVisualFacts: claim?.forbiddenVisualFacts ?? [], comparisonClaims: claim?.comparisonClaims ?? [], causeEffectClaims: claim?.causeEffectClaims ?? [],
        visualCommunicationGoal: claim?.visualCommunicationGoal ?? null,
      });
    }
  }

  const chapterCount = new Set(segments.map((s: any) => s.chapterId)).size;
  return ok(req, {
    ok: true, contractVersionId: inserted.id, claims: result.claims, stats: result.stats,
    projectedComparison, chapterCount, segmentCount: segments.length,
    note: "ANALYSIS MODE — no project pointer was updated, no VisualPlan/Visual World/scenes were touched.",
  });
});
