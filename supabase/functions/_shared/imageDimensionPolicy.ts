// deno-lint-ignore-file no-explicit-any
// ONE authoritative image-dimension + reference-count policy for every
// Runware image dispatch in this codebase (Long Form scenes, Long Form
// Visual World references, and runware-image's own general-purpose
// dimension snapping for every other Zyvo tool).
//
// Real incident this closes (2026-09-13/14, two live HTTP 400s from Runware,
// taskUUID 54ce89c6-22bf-4c49-99bf-aac93084771d among them): a Long Form
// scene's EDIT operation (Qwen Image Edit Plus, runware:108@22) was
// dispatched at 2720x1536 — the GENERATE operation's (Kling IMAGE O3)
// dimensions, not Qwen's. Root cause: sceneJobs.ts's scenePromptJobPayload
// picked ONE pair of width/height constants and applied them regardless of
// which model the job actually targeted — dimensions were never resolved
// FROM the destination model, they were inherited from whatever the
// scene's overall "2720x1536 Long Form scene" convention happened to be.
// Runware's real error: "Image width must be an integer value between 512
// and 2048" for image:qwen.image-edit-plus.
//
// The fix is structural, not a one-off constant swap: every call site that
// needs image dimensions must call resolveImageRenderDimensions() with the
// ACTUAL destination model, never assume/copy a source/sibling operation's
// size. This module is also runware-image's own final provider-boundary
// defense (snapToSupportedDimensions) — the exact same table backs both the
// pre-dispatch check (Deno workers, before any provider call) and the
// last-resort snap immediately before the Runware payload is built, so
// there is exactly one place this policy can drift, not two.

export type ModelDimensionConstraint = {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  // Explicit, provider-verified width/height pairs — preferred over free-
  // form min/max clamping whenever present, since Runware's real rejection
  // ("Unsupported use of width/height parameters") for several models is
  // about not matching an exact size, not merely being in-range. An
  // `approved` entry is either directly confirmed by a real successful
  // dispatch in this codebase, or (noted per-entry) computed from a
  // confirmed bound plus the target aspect ratio pending a real
  // confirmation dispatch.
  approvedSizes: [number, number][];
  maxReferenceImages?: number;
  // True only when the height bound is inferred (mirrored from the
  // confirmed width bound) rather than itself provider-confirmed — kept
  // here so a future real test can upgrade this entry with confidence
  // rather than silently assuming this codebase already verified it.
  heightBoundInferred?: boolean;
};

// Model constants — mirrors src/lib/providers.ts's airTag values exactly
// (the source of truth for which Runware model backs which Zyvo tool_key).
export const QWEN_IMAGE_EDIT_PLUS = "runware:108@22";
export const KLING_IMAGE_O3 = "klingai:kling-image@o3";
export const FLUX2_KLEIN_9B_KV = "runware:400@6";
export const FLUX_BASE = "runware:400@4";
export const SEEDREAM_5_LITE = "bytedance:seedream@5.0-lite";
export const SEEDREAM_5_PRO = "bytedance:seedream@5.0-pro";

export const MODEL_DIMENSION_POLICY: Record<string, ModelDimensionConstraint> = {
  // Qwen Image Edit Plus — CONFIRMED by a real Runware 400 error: width must
  // be an integer 512-2048. Height bound is NOT independently confirmed;
  // mirrored from the width bound as the most common Runware convention
  // (heightBoundInferred:true) until a real dispatch proves otherwise.
  // approvedSizes: 1536x1024 is DOUBLY proven (a real successful Long Form
  // scene EDIT dispatch this session, plus the pre-existing character-sheet
  // derivation roles in referenceRendererPolicy.js); 1024x1024 is proven
  // (geometry Profile/Back edits). 1536x864 is NEW — exact 16:9 (1536 *
  // 9/16 = 864), built from the one CONFIRMED bound (width<=2048) using the
  // proven-safe 1536 width rather than untested 2048 — the correct
  // Long-Form-scene-EDIT default per Part 3's "preserve 16:9 as closely/
  // exactly as possible", but genuinely unverified against Runware
  // (no provider calls were permitted while building this policy).
  [QWEN_IMAGE_EDIT_PLUS]: {
    minWidth: 512, maxWidth: 2048, minHeight: 512, maxHeight: 2048, heightBoundInferred: true,
    approvedSizes: [[1536, 864], [1536, 1024], [1024, 1024]],
    maxReferenceImages: 3, // runware.ai/docs/models/alibaba-qwen-image-edit-plus: 1-3 referenceImages
  },
  // Kling IMAGE O3 — the three tiers providers.ts's own comment already
  // verified directly against real Runware requests (2026-09-13): 1360x768
  // and 2720x1536 bill identically ("1k"/"2k"), 5440x3072 is the "4k" tier.
  // All three are exact 16:9.
  [KLING_IMAGE_O3]: {
    minWidth: 512, maxWidth: 5440, minHeight: 512, maxHeight: 5440,
    approvedSizes: [[1360, 768], [2720, 1536], [5440, 3072]],
    maxReferenceImages: 1,
  },
  // FLUX.2 Klein 9B KV — providers.ts's own comment: "128-2048px (step 16)"
  // per Runware's docs. EVERY real production usage of this exact model in
  // this codebase (location/object references, via referenceRendererPolicy
  // .js's `ordinary` policy) has only ever dispatched at 1024x1024 — 2720x
  // 1536 (Long Form's scene convention) was NEVER actually valid for this
  // model and was never dispatched for real before this policy existed
  // (Scene Generation's own V2 tier had not yet been exercised). 2048x1152
  // is the correct exact-16:9 replacement, built from the confirmed 2048
  // width cap.
  [FLUX2_KLEIN_9B_KV]: {
    minWidth: 128, maxWidth: 2048, minHeight: 128, maxHeight: 2048,
    approvedSizes: [[2048, 1152], [1024, 1024]],
  },
  // FLUX.2 [klein] 4B — legacy sheet-derivation policy's own model, kept for
  // parity/no-regression on that (history-only) code path.
  [FLUX_BASE]: {
    minWidth: 128, maxWidth: 2048, minHeight: 128, maxHeight: 2048,
    approvedSizes: [[1536, 1024], [1024, 1024]],
  },
  // Seedream 5.0 Lite (bytedance:seedream@5.0-lite) — Part B: manually
  // verified by the user directly against Runware, NOT this codebase's own
  // dispatch. Two real successful sizes at an IDENTICAL observed cost
  // ($0.035): 2848x1600 ("Standard") and 4096x2304 ("High", exact 16:9).
  // Bounds are NOT independently confirmed beyond these two working points
  // — min/max here are a conservative envelope around them, not a verified
  // provider range; only the two approvedSizes should be trusted as truly
  // safe until more is verified. Up to 14 referenceImages is a stated hard
  // provider limit (also user-verified), enforced pre-dispatch.
  [SEEDREAM_5_LITE]: {
    minWidth: 512, maxWidth: 4096, minHeight: 512, maxHeight: 4096, heightBoundInferred: true,
    approvedSizes: [[2848, 1600], [4096, 2304]],
    maxReferenceImages: 14,
  },
  // Official Runware Seedream 5.0 Pro documentation verifies 1536x1024 as
  // the 1.5K landscape size and up to ten reference images. Keep the
  // canonical reference route on that exact documented point.
  [SEEDREAM_5_PRO]: {
    minWidth: 256, maxWidth: 16383, minHeight: 256, maxHeight: 16383,
    approvedSizes: [[1536, 1024]],
    maxReferenceImages: 10,
  },

  // ---- Ported verbatim from runware-image/index.ts's own prior local
  // SUPPORTED_DIMENSIONS table (2026-09, pre-existing, unrelated to Long
  // Form) — moved here so there is exactly one dimension table in this
  // codebase, not two. Byte-identical data; no behavior change for these
  // four models.
  "google:4@3": { // Nano Banana 2 (image:nano.2)
    minWidth: 672, maxWidth: 5504, minHeight: 672, maxHeight: 5504,
    approvedSizes: [
      [1024, 1024], [2048, 2048],
      [1264, 848], [2528, 1696], [848, 1264], [1696, 2528],
      [1200, 896], [2400, 1792], [896, 1200], [1792, 2400],
      [928, 1152], [1856, 2304], [1152, 928], [2304, 1856],
      [768, 1376], [1536, 2752], [3072, 5504], [1376, 768], [2752, 1536], [5504, 3072],
      [1584, 672], [3168, 1344],
    ],
  },
  "google:4@2": { // Nano Pro (image:nano-pro)
    minWidth: 672, maxWidth: 6336, minHeight: 672, maxHeight: 6336,
    approvedSizes: [
      [1024, 1024], [2048, 2048], [4096, 4096],
      [1264, 848], [2528, 1696], [5096, 3392], [5056, 3392],
      [848, 1264], [1696, 2528], [3392, 5096], [3392, 5056],
      [1200, 896], [2400, 1792], [4800, 3584],
      [896, 1200], [1792, 2400], [3584, 4800],
      [928, 1152], [1856, 2304], [3712, 4608],
      [1152, 928], [2304, 1856], [4608, 3712],
      [768, 1376], [1536, 2752], [3072, 5504],
      [1376, 768], [2752, 1536], [5504, 3072],
      [1548, 672], [1584, 672], [3168, 1344], [6336, 2688],
    ],
  },
  "openai:gpt-image@2": { // backs image:fruit-v2
    minWidth: 656, maxWidth: 3104, minHeight: 656, maxHeight: 3104,
    approvedSizes: [
      [1024, 1024], [2048, 2048],
      [1248, 832], [2496, 1664], [832, 1248], [1664, 2496],
      [1168, 880], [2336, 1760], [880, 1168], [1760, 2336],
      [768, 1360], [1536, 2720], [1360, 768], [2720, 1536],
      [1552, 656], [3104, 1312],
    ],
    maxReferenceImages: 4,
  },
  "openai:4@1": { // GPT Image 1.5 (image:openai)
    minWidth: 1024, maxWidth: 1536, minHeight: 1024, maxHeight: 1536,
    approvedSizes: [[1024, 1024], [1536, 1024], [1024, 1536]],
  },
};

export class ModelDimensionPolicyViolation extends Error {
  code = "MODEL_DIMENSION_POLICY_VIOLATION";
  details: Record<string, unknown>;
  constructor(details: Record<string, unknown>) {
    super(`MODEL_DIMENSION_POLICY_VIOLATION: ${JSON.stringify(details)}`);
    this.details = details;
  }
}

// Exact-match-first, then nearest-approved-aspect-ratio — mirrors runware-
// image's own prior snapToSupportedDimensions, with one correctness fix
// found by this task's own test suite: several models (Kling's 1K/2K/4K
// tiers, Nano Banana 2/Pro's own resolution families) list MULTIPLE
// approved sizes at the IDENTICAL ratio. A strict "first diff wins" loop
// silently picks whichever one happens to appear first in the array on a
// tie — for Kling that meant a caller with no exact-match request (e.g.
// requesting via targetAspectRatio alone) got snapped to the smallest 1K
// tier instead of the 2K tier this codebase actually standardizes Long
// Form scenes on. On a tied ratio, prefer the LARGER approved size —
// consistent with the "ratio-only matching would silently downsize"
// problem this function already existed to solve for exact matches.
function snapToApproved(width: number, height: number, approved: [number, number][]): [number, number] {
  const exact = approved.find(([w, h]) => w === width && h === height);
  if (exact) return exact;
  const targetRatio = width / height;
  let best = approved[0];
  let bestDiff = Infinity;
  for (const pair of approved) {
    const diff = Math.abs(pair[0] / pair[1] - targetRatio);
    if (diff < bestDiff || (diff === bestDiff && pair[0] > best[0])) { bestDiff = diff; best = pair; }
  }
  return best;
}

// The ONE authoritative resolver every dispatch path must call. The
// destination MODEL is authoritative — this function never accepts or
// infers dimensions from a "source" operation; the caller is required to
// already know which model it is dispatching to (via resolveLongFormScene
// Renderer or the equivalent Visual World role policy) before calling this.
export function resolveImageRenderDimensions(args: {
  model: string;
  operation: "generate" | "regenerate" | "edit" | string;
  targetAspectRatio?: number;
  requestedWidth?: number;
  requestedHeight?: number;
  qualityTier?: string;
}): { width: number; height: number; aspectRatio: number; source: string; model: string; operation: string } {
  const { model, operation, targetAspectRatio, requestedWidth, requestedHeight, qualityTier } = args;
  const constraint = MODEL_DIMENSION_POLICY[model];
  if (!constraint) {
    throw new ModelDimensionPolicyViolation({
      model, operation, requestedDimensions: { width: requestedWidth, height: requestedHeight },
      resolvedDimensions: null, providerConstraints: null, reason: "UNKNOWN_MODEL",
    });
  }
  let width: number, height: number;
  if (requestedWidth && requestedHeight) {
    [width, height] = snapToApproved(requestedWidth, requestedHeight, constraint.approvedSizes);
  } else if (targetAspectRatio) {
    // No explicit size requested — pick the approved size closest to the
    // target ratio (used when a caller only knows "this needs to be 16:9
    // for this model", e.g. a fresh tier selection with no prior size).
    // Reuses snapToApproved's own tie-breaking (prefer the larger size on
    // an equal-ratio tie) by treating the target ratio as a 1000:x pseudo-
    // request — same single implementation as the exact-match path above.
    [width, height] = snapToApproved(Math.round(targetAspectRatio * 1000), 1000, constraint.approvedSizes);
  } else {
    [width, height] = constraint.approvedSizes[0];
  }
  if (width < constraint.minWidth || width > constraint.maxWidth || height < constraint.minHeight || height > constraint.maxHeight) {
    throw new ModelDimensionPolicyViolation({
      model, operation, requestedDimensions: { width: requestedWidth, height: requestedHeight },
      resolvedDimensions: { width, height }, providerConstraints: constraint, qualityTier, reason: "OUT_OF_BOUNDS",
    });
  }
  return { width, height, aspectRatio: width / height, source: "renderer-policy", model, operation };
}

export function getMaxReferenceImages(model: string): number | undefined {
  return MODEL_DIMENSION_POLICY[model]?.maxReferenceImages;
}

// Hard pre-dispatch gate (Part 16: "reject >N rather than silently
// truncate"). Distinct from runware-image's own clampReferenceImages
// (kept as defense-in-depth there, unchanged for models that predate this
// policy) — this is the EARLY rejection, before any provider job is ever
// created, so a policy violation never burns a real generation attempt.
export function validateReferenceImageCount(model: string, count: number) {
  const max = getMaxReferenceImages(model);
  if (typeof max === "number" && count > max) {
    throw new ModelDimensionPolicyViolation({
      model, operation: "reference-count-check", requestedDimensions: null, resolvedDimensions: null,
      providerConstraints: { maxReferenceImages: max }, reason: "TOO_MANY_REFERENCE_IMAGES", requestedCount: count,
    });
  }
}

// The exact same algorithm as before, now backed by the shared table —
// runware-image imports THIS instead of keeping its own local copy, so
// there is exactly one implementation of "snap to nearest provider-valid
// size" in the whole codebase.
export function snapToSupportedDimensions(width: number, height: number, model: string): { width: number; height: number } {
  const constraint = MODEL_DIMENSION_POLICY[model];
  if (!constraint?.approvedSizes?.length) return { width, height };
  const [w, h] = snapToApproved(width, height, constraint.approvedSizes);
  return { width: w, height: h };
}

export function clampReferenceImageCount(refs: string[], model: string): string[] {
  const max = getMaxReferenceImages(model);
  return typeof max === "number" ? refs.slice(0, max) : refs;
}
