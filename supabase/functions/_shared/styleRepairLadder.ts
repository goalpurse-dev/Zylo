// deno-lint-ignore-file no-explicit-any
// styleRepairLadder.ts — 2026-09-23 "systemic production stabilization"
// pass, Item A.
//
// Real Atlantis finding: QA's vision model ALREADY correctly detects style
// drift (styleMismatchSeverity:"major", classified as failureType
// STYLE_ABANDONED by sceneQA.ts's classifySceneQA) on every drifted shot —
// the gap is downstream of detection, not in it. repairLadder.ts's
// determineRepairAction has always mapped STYLE_ABANDONED to a plain
// FRESH_GENERATE, identically to every other "just try again" failure: the
// next Regenerate click resends the EXACT SAME prompt/references and hopes
// for a better random roll, with no stronger style lock ever applied, and no
// bound on how many times a user can click the same losing move.
//
// This module is the missing decision layer for THAT specific failure
// family — pure and DB-independent (identical shape to repairLadder.ts's own
// determineRepairAction: a deterministic function from already-known state
// to a decision, never a dispatcher itself). The caller supplies the
// consecutive chain of this exact shot's own prior QA failureTypes, most
// recent first (already available via the scene's own replaces_scene_id
// lineage — see fetchConsecutiveFailureChain below).
//
// Bounded ladder, per the explicit product requirement ("bounded automatic
// repair... No infinite regeneration loops"):
//   attempt 1 (no prior style failure yet)      -> NONE       (nothing to reinforce yet)
//   attempt 2 (1 consecutive STYLE_ABANDONED)    -> REINFORCE  (one stronger style/reference retry)
//   attempt 3 (2 consecutive STYLE_ABANDONED)    -> REINFORCE  (the explicitly-allowed "optional second retry")
//   attempt 4+ (3+ consecutive STYLE_ABANDONED)  -> NEEDS_FIX  (stop silently retrying — surface for human review)
export type StyleRepairStage = "NONE" | "REINFORCE" | "NEEDS_FIX";

export function classifyStyleRepairStage(priorFailureTypesMostRecentFirst: (string | null | undefined)[]): StyleRepairStage {
  let consecutive = 0;
  for (const failureType of priorFailureTypesMostRecentFirst) {
    if (failureType === "STYLE_ABANDONED") consecutive++;
    else break; // only an UNBROKEN run of style failures counts — a shot that failed for a different reason in between, then drifted on style again, starts a fresh count.
  }
  if (consecutive === 0) return "NONE";
  if (consecutive <= 2) return "REINFORCE";
  return "NEEDS_FIX";
}

// Walks the scene's own replaces_scene_id lineage backward (oldest edits of
// THIS shot, never a different shot) collecting each prior attempt's
// recorded qa_result.failureType, most-recent-first, bounded to maxDepth —
// this ladder only ever needs to distinguish 0/1/2/3+ consecutive failures,
// never the whole history.
export async function fetchConsecutiveFailureChain(admin: any, replacesSceneId: string | null | undefined, maxDepth = 4): Promise<(string | null)[]> {
  const chain: (string | null)[] = [];
  let cursor = replacesSceneId ?? null;
  for (let i = 0; i < maxDepth && cursor; i++) {
    const { data: prior } = await admin.from("long_form_scenes").select("qa_result,replaces_scene_id").eq("id", cursor).maybeSingle();
    if (!prior) break;
    chain.push(prior.qa_result?.failureType ?? null);
    cursor = prior.replaces_scene_id ?? null;
  }
  return chain;
}

// The additive, bounded reference-role instruction for the ONE style
// reference this ladder ever adds — explicit about what it controls
// (rendering technique only) and what it must NEVER leak (subject, pose,
// composition, framing) so it can never regress into the "literal sample
// pixels incorrectly force their subject or palette" incident
// episodePreflight.ts's own comment already warns about. Generic — names no
// style, no project, no subject.
export function styleReinforcementReferenceInstruction(referenceIndex: number): string {
  return `Reference ${referenceIndex} is a STYLE reference only, from an already-approved scene in this same episode — match its rendering technique (linework, shading, texture, palette, overall finish) exactly. Do not copy its subject, characters, pose, composition, framing, or background. The subject and action for THIS shot come only from the instructions above.`;
}

// The one additional reference this ladder is allowed to add at REINFORCE
// stage: the most recently approved GENERATE/EDIT scene from the same
// continuity group (falling back to the same Visual World when no
// continuity group is set) — the identical CLASS of evidence
// advance-long-form-scene-generation's own QA-side lookup already treats as
// trustworthy style evidence (an unapproved scene can never qualify; the
// query requires qa_status='approved'). Kept as its own query, separate from
// the QA-side lookup, because that one also does character-appearance-anchor
// matching this ladder deliberately does not — a reinforcement reference is
// ALWAYS style-only here, never re-purposed as an identity reference, so it
// can never regress into "literal sample pixels forced an unrelated subject"
// regardless of whether it happens to share a character with this shot.
export async function findStyleReinforcementReferenceUrl(admin: any, scene: any, plan: any): Promise<string | null> {
  if (!plan?.continuity_group_id && !plan?.visual_world_version_id) return null;
  try {
    let q = admin.from("long_form_scenes").select("id,result_url,scene_render_plan_id,long_form_scene_render_plans!inner(continuity_group_id)")
      .eq("visual_world_version_id", scene.visual_world_version_id).eq("status", "succeeded").eq("qa_status", "approved")
      .in("render_strategy", ["GENERATE", "EDIT"]).neq("id", scene.id).not("result_url", "is", null)
      .order("updated_at", { ascending: false }).limit(1);
    if (plan?.continuity_group_id) q = q.eq("long_form_scene_render_plans.continuity_group_id", plan.continuity_group_id);
    const { data } = await q;
    return data?.[0]?.result_url ?? null;
  } catch (e) {
    console.error("[styleRepairLadder] style reinforcement reference lookup failed (non-fatal, dispatch proceeds without it):", scene?.id, e);
    return null;
  }
}

// A generic, per-style-preset-agnostic reinforcement of the negative-style
// language already in every prompt (visualWorldStyle.ts's own
// negativeConstraints) — never names a specific style, subject, or project;
// just states the invariant more forcefully for a shot that has already
// drifted once.
export const STYLE_REINFORCEMENT_NEGATIVE_SUFFIX = "This shot previously rendered in the wrong visual style. Do not deviate from the required rendering technique described above in any way — no different linework weight, no different shading model, no different level of realism, no different medium.";
