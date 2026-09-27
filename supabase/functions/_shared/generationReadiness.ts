// Plain-language, actionable readiness messages/issues shared by quote and
// charge. generationReadinessMessage is the ORIGINAL single-string form,
// kept for any caller that only wants a sentence. classifyReadinessIssues*
// below is the 2026-09-22 "structured readiness issues" upgrade: every
// caller that shows the user a warning card should use these instead — they
// carry WHICH SUBSYSTEM is actually broken (never a generic "Visual World
// needs attention" for a storyboard problem) and, for storyboard issues,
// exactly which beat ids are affected so the UI can route there and
// highlight them, instead of sending the user to rebuild an unrelated stage.
export function generationReadinessMessage(reason: string, count = 0) {
  if (reason === "required_references_missing") return `${count || 1} required reference${count === 1 ? " is" : "s are"} missing or still need review.`;
  if (reason === "world_plan_mismatch") return "The adopted Visual World belongs to an older storyboard.";
  if (reason === "visual_plan_not_ready") return "The storyboard has not been finalized.";
  if (reason === "world_not_ready" || reason === "visual_world_missing") return "The current Visual World is not ready.";
  if (reason.startsWith("CLAIM_MISSING")) return "A storyboard shot is missing its narration claim. Rebuild the storyboard before generating.";
  if (reason.includes("REFERENCE")) return "A required canonical reference cannot be resolved for a planned shot.";
  if (reason.includes("CROP")) return "A detail crop cannot be produced safely. Rebuild the storyboard to use a generated shot.";
  if (reason.includes("EXACT_TEXT")) return "A planned text treatment cannot fit safely. Rebuild the storyboard with shorter text.";
  if (reason.includes("DUPLICATE_GENERATE_PROMPT")) return "Two planned shots resolve to the same visual. Rebuild the storyboard before generating.";
  return "A planned shot cannot be compiled. Rebuild the storyboard before generating.";
}

export type ReadinessSubsystem = "visual_world" | "storyboard" | "scene_plan" | "billing";
export type ReadinessAction = "COMPLETE_VISUAL_WORLD" | "UPDATE_VISUAL_WORLD" | "FIX_STORYBOARD" | "FINISH_STORYBOARD" | "REPAIR_SCENE_PLAN";
export type ReadinessIssue = {
  code: string;
  subsystem: ReadinessSubsystem;
  severity: "blocking";
  title: string;
  message: string;
  affectedBeatIds: string[];
  chapterId: string | null;
  recommendedAction: ReadinessAction;
  repairScope: "affected_beats_only" | "visual_world" | "full_rebuild";
  canAutoRepair: boolean;
};

// Never a generic label — every recommendedAction maps to exactly one CTA
// string, and every CTA implies exactly one destination page.
export const READINESS_ACTION_LABEL: Record<ReadinessAction, string> = {
  COMPLETE_VISUAL_WORLD: "Complete Visual World",
  UPDATE_VISUAL_WORLD: "Update Visual World",
  FIX_STORYBOARD: "Fix Storyboard",
  FINISH_STORYBOARD: "Finish Storyboard",
  REPAIR_SCENE_PLAN: "Repair Scene Plan",
};
export const READINESS_ACTION_ROUTE: Record<ReadinessAction, "visual_world" | "storyboard"> = {
  COMPLETE_VISUAL_WORLD: "visual_world",
  UPDATE_VISUAL_WORLD: "visual_world",
  FIX_STORYBOARD: "storyboard",
  FINISH_STORYBOARD: "storyboard",
  REPAIR_SCENE_PLAN: "storyboard",
};

// The visual-world-compatibility check (long_form_visual_world_compatibility)
// bundles several genuinely different failure reasons under one RPC — this
// is what tells them apart into the right subsystem/CTA rather than always
// saying "Update Visual World".
export function classifyVisualWorldReadinessReason(reason: string, missingCount = 0): ReadinessIssue {
  if (reason === "required_references_missing") {
    return {
      code: "REQUIRED_REFERENCES_MISSING", subsystem: "visual_world", severity: "blocking",
      title: "Visual World needs attention",
      message: generationReadinessMessage(reason, missingCount),
      affectedBeatIds: [], chapterId: null,
      recommendedAction: "COMPLETE_VISUAL_WORLD", repairScope: "visual_world", canAutoRepair: false,
    };
  }
  if (reason === "world_plan_mismatch") {
    return {
      code: "WORLD_PLAN_MISMATCH", subsystem: "visual_world", severity: "blocking",
      title: "Visual World needs attention",
      message: generationReadinessMessage(reason),
      affectedBeatIds: [], chapterId: null,
      recommendedAction: "UPDATE_VISUAL_WORLD", repairScope: "visual_world", canAutoRepair: false,
    };
  }
  // The storyboard/VisualPlan itself hasn't been finalized yet — this is a
  // Look/Storyboard-stage state, never a Visual World problem, even though
  // long_form_visual_world_compatibility is the RPC that surfaces it.
  if (reason === "visual_plan_not_ready" || reason === "no_current_plan") {
    return {
      code: "VISUAL_PLAN_NOT_READY", subsystem: "storyboard", severity: "blocking",
      title: "Storyboard needs attention",
      message: generationReadinessMessage("visual_plan_not_ready"),
      affectedBeatIds: [], chapterId: null,
      recommendedAction: "FINISH_STORYBOARD", repairScope: "full_rebuild", canAutoRepair: false,
    };
  }
  return {
    code: "VISUAL_WORLD_NOT_READY", subsystem: "visual_world", severity: "blocking",
    title: "Visual World needs attention",
    message: generationReadinessMessage(reason),
    affectedBeatIds: [], chapterId: null,
    recommendedAction: "UPDATE_VISUAL_WORLD", repairScope: "visual_world", canAutoRepair: false,
  };
}

// preflightEpisode's own errors (episodePreflight.ts / scenePromptQuality.ts)
// — beat-compile failures and DUPLICATE_GENERATE_PROMPT collisions. These
// are ALWAYS a storyboard or scene-plan problem, never Visual World: by the
// time preflightEpisode runs, long_form_visual_world_compatibility has
// already confirmed the Visual World itself is ready.
export function classifyPreflightErrors(errors: { beatId: string | null; reason: string }[], beatsById?: Map<string, any>): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const duplicateErrors = errors.filter((e) => e.reason.startsWith("DUPLICATE_GENERATE_PROMPT"));
  const otherErrors = errors.filter((e) => !e.reason.startsWith("DUPLICATE_GENERATE_PROMPT"));

  if (duplicateErrors.length) {
    const beatIds = new Set<string>();
    for (const e of duplicateErrors) {
      if (e.beatId) beatIds.add(e.beatId);
      const earlierBeatId = e.reason.split(":")[1];
      if (earlierBeatId) beatIds.add(earlierBeatId);
    }
    const affectedBeatIds = [...beatIds];
    const chapterId = beatsById && affectedBeatIds.length ? beatsById.get(affectedBeatIds[0])?.chapterId ?? null : null;
    issues.push({
      code: "DUPLICATE_VISUAL_RESOLUTION", subsystem: "storyboard", severity: "blocking",
      title: "Storyboard needs attention",
      message: affectedBeatIds.length === 2
        ? `${affectedBeatIds[0]} and ${affectedBeatIds[1]} currently resolve to nearly the same visual despite representing different narration moments.`
        : `${affectedBeatIds.length} shots currently resolve to nearly the same visual as another nearby shot despite representing different narration moments.`,
      affectedBeatIds, chapterId,
      recommendedAction: "FIX_STORYBOARD", repairScope: "affected_beats_only", canAutoRepair: false,
    });
  }

  // Every remaining reason string is a genuine per-beat compile failure.
  // Group by a coarse category (never expose the raw code to the user) so
  // 40 beats failing the same way become one issue, not 40.
  const byCategory = new Map<string, { beatIds: string[]; message: string; action: ReadinessAction; subsystem: ReadinessSubsystem }>();
  for (const e of otherErrors) {
    const reason = e.reason;
    let key: string, message: string, action: ReadinessAction, subsystem: ReadinessSubsystem;
    if (reason.startsWith("CLAIM_MISSING")) {
      key = "CLAIM_MISSING"; subsystem = "storyboard"; action = "FINISH_STORYBOARD";
      message = "A storyboard shot is missing its narration claim.";
    } else if (reason.includes("CROP")) {
      key = "CROP"; subsystem = "scene_plan"; action = "REPAIR_SCENE_PLAN";
      message = "A detail crop cannot be produced safely from its source shot.";
    } else if (reason.includes("EXACT_TEXT")) {
      key = "EXACT_TEXT"; subsystem = "scene_plan"; action = "REPAIR_SCENE_PLAN";
      message = "A planned text treatment cannot fit safely.";
    } else if (reason.includes("REFERENCE")) {
      key = "REFERENCE"; subsystem = "scene_plan"; action = "REPAIR_SCENE_PLAN";
      message = "A required canonical reference cannot be resolved for a planned shot.";
    } else {
      key = "COMPILE_FAILED"; subsystem = "storyboard"; action = "FIX_STORYBOARD";
      message = "A planned shot cannot be compiled.";
    }
    const bucket = byCategory.get(key) ?? { beatIds: [], message, action, subsystem };
    if (e.beatId) bucket.beatIds.push(e.beatId);
    byCategory.set(key, bucket);
  }
  for (const [code, bucket] of byCategory) {
    const chapterId = beatsById && bucket.beatIds.length ? beatsById.get(bucket.beatIds[0])?.chapterId ?? null : null;
    issues.push({
      code, subsystem: bucket.subsystem, severity: "blocking",
      title: bucket.subsystem === "scene_plan" ? "Scene plan needs attention" : "Storyboard needs attention",
      message: bucket.beatIds.length > 1 ? `${bucket.message} (${bucket.beatIds.length} shots affected)` : bucket.message,
      affectedBeatIds: bucket.beatIds, chapterId,
      recommendedAction: bucket.action, repairScope: "affected_beats_only", canAutoRepair: false,
    });
  }
  return issues;
}
