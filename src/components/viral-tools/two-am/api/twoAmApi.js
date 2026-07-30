import { createImageJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";
import { getAllowedVideoModels as sharedGetAllowedQualityTiers, PLAN_LABELS } from "../../../../lib/planGating";

export { PLAN_LABELS };

export const TWO_AM_IMAGE_COUNT = 6;

// V2/V3/V4 quality tiers — same Nano Banana 2 engine at 1K/2K/4K (9:16).
// Dedicated tool_keys (not the shared image:nano.2 used by the standalone
// Image Generator) so job-worker's plan gate on V3/V4 can't leak into that
// ungated tool. Real width/height per Runware's 9:16 resolution table —
// V3(2K)/V4(4K) previously shared one hardcoded 1536x2752 size (actually
// the 4K pixel dimensions) while only charging the 2K credit price; this
// fixes that mismatch by giving each tier its true resolution.
export const IMAGE_QUALITY_TIERS = {
  "twoam-v2": {
    id: "twoam-v2", label: "V2", tag: "Fastest",
    description: "1K — quick generation",
    toolKey: "image:twoam1k", width: 384, height: 688, creditsPerImage: 5,
  },
  "twoam-v3": {
    id: "twoam-v3", label: "V3", tag: "Balanced",
    description: "2K — sharper detail",
    toolKey: "image:twoam2k", width: 768, height: 1376, creditsPerImage: 7,
  },
  "twoam-v4": {
    id: "twoam-v4", label: "V4", tag: "Max detail",
    description: "4K — maximum detail",
    toolKey: "image:twoam4k", width: 1536, height: 2752, creditsPerImage: 10,
  },
};
export const DEFAULT_IMAGE_QUALITY = "twoam-v2";

// Plan gating — which quality tiers each plan tier can use. Enforced for
// real inside the two-am-planner edge function (server already resolves
// plan_code from the DB) and, for the single-scene regenerate path which
// goes through the normal client -> job-worker pipeline, via job-worker's
// PLAN_GATED_TOOLS map on the dedicated twoam2k/4k tool_keys above.
export const IMAGE_QUALITY_MIN_PLAN = {
  "twoam-v2": "starter",
  "twoam-v3": "pro",
  "twoam-v4": "generative",
};

export function getAllowedImageQualities(planCode) {
  return sharedGetAllowedQualityTiers(planCode, IMAGE_QUALITY_MIN_PLAN);
}

export function totalCreditsForQuality(qualityId) {
  const tier = IMAGE_QUALITY_TIERS[qualityId] ?? IMAGE_QUALITY_TIERS[DEFAULT_IMAGE_QUALITY];
  return tier.creditsPerImage * TWO_AM_IMAGE_COUNT;
}

// Legacy fixed constants — kept for any stale imports, now mirroring the
// default (V2) tier rather than the old hardcoded 2K/42-credit setup.
export const TWO_AM_CREDITS_PER_IMAGE = IMAGE_QUALITY_TIERS[DEFAULT_IMAGE_QUALITY].creditsPerImage;
export const TWO_AM_TOTAL_CREDITS = totalCreditsForQuality(DEFAULT_IMAGE_QUALITY);
export const TWO_AM_TOOL_KEY = IMAGE_QUALITY_TIERS[DEFAULT_IMAGE_QUALITY].toolKey;
export const TWO_AM_IMAGE_WIDTH = IMAGE_QUALITY_TIERS[DEFAULT_IMAGE_QUALITY].width;
export const TWO_AM_IMAGE_HEIGHT = IMAGE_QUALITY_TIERS[DEFAULT_IMAGE_QUALITY].height;

export async function createTwoAmPlan({ prompt, settings }) {
  const { data, error } = await supabase.functions.invoke("two-am-planner", {
    body: { prompt, settings },
  });
  if (error) {
    let message = error.message || "Planning failed";
    try {
      const context = await error.context?.json?.();
      message = context?.error || message;
    } catch {
      // Supabase invoke errors do not always expose a JSON response body.
    }
    throw new Error(message);
  }
  if (!data?.ok || !data?.generation) throw new Error(data?.error || "Planning failed");
  return data;
}

function styleDirective(style) {
  switch (style) {
    case "anime":
      return "VISUAL DIRECTION — ANIME ACCURATE: Strict 2D cel-shaded anime art style with hand-drawn animation linework and flat cel shading. Not photorealistic, not 3D rendered.";
    case "realistic":
      return "VISUAL DIRECTION — REALISTIC: Photorealistic live-action cinematography. True-to-life textures, lighting and anatomy, shot like a real photograph or film still. Not illustrated, not animated, not cel-shaded.";
    case "dreamcore":
      return "VISUAL DIRECTION — DREAMCORE: Hazy, surreal, liminal-space atmosphere with a soft glow and gentle blur. Slightly uncanny dreamlike quality, muted washed-out color grade.";
    case "cinematic":
      return "VISUAL DIRECTION — CINEMATIC: Dramatic film-still composition with anamorphic lens character, bold color grading and directional lighting like a blockbuster movie frame.";
    default:
      return "";
  }
}

function nostalgiaDirective(nostalgia) {
  const value = Number(nostalgia);
  if (!Number.isFinite(value)) return "";
  if (value <= 0.25) return "NOSTALGIA INTENSITY — SUBTLE: Mostly clean and grounded. Only a faint nostalgic warmth, minimal haze or grain.";
  if (value <= 0.5) return "NOSTALGIA INTENSITY — LIGHT: A gentle nostalgic glow and warmth without overwhelming the scene.";
  if (value <= 0.75) return "NOSTALGIA INTENSITY — STRONG: Noticeably warm nostalgic haze, soft glow, faint film grain, memory-like softness.";
  return "NOSTALGIA INTENSITY — DREAMLIKE: Deeply nostalgic, hazy soft-focus glow, heavy warm film grain, blurred memory-like quality, emotionally overwhelming wistful atmosphere.";
}

function recognizabilityDirective(worldBible, sceneCharacters) {
  if (sceneCharacters.length) return "";
  const pool = [
    ...(Array.isArray(worldBible?.creatures) ? worldBible.creatures : []),
    ...(Array.isArray(worldBible?.characters) ? worldBible.characters : []),
    ...(Array.isArray(worldBible?.recurringProps) ? worldBible.recurringProps : []),
    ...(Array.isArray(worldBible?.architecture) ? worldBible.architecture : []),
  ].filter(Boolean);
  if (!pool.length) return "";
  return `RECOGNIZABILITY REQUIREMENT: This scene was not assigned a named character, so it must instead include at least one other instantly recognizable, unmistakable signal of this exact source material — a canonical creature/species, a signature recurring prop, or an iconic building/landmark. Pull from: ${pool.slice(0, 10).join(", ")}. A fan glancing at this image for one second must recognize the franchise immediately. Never produce a generic frame that could belong to any other anime, game or franchise.`;
}

export function buildRegenerationPrompt({ worldBible, scene, randomSeed, settings }) {
  const sceneDetail = String(scene.userDetail || scene.user_detail || "").trim();
  const sceneCharacters = Array.isArray(scene.characters) ? scene.characters.filter(Boolean) : [];
  const excludedSceneDetails = Array.isArray(scene.excludedUserDetails)
    ? scene.excludedUserDetails.filter(Boolean)
    : Array.isArray(scene.excluded_user_details)
    ? scene.excluded_user_details.filter(Boolean)
    : [];
  return [
    "Vertical 9:16 portrait. Regenerate this single frame from a nostalgic 2AM slideshow.",
    `WORLD BIBLE: ${JSON.stringify(worldBible)}`,
    `SCENE TO PRESERVE: ${scene.title}. ${scene.activity}. Location: ${scene.location}. Characters: ${sceneCharacters.join(", ") || "none required"}.`,
    sceneCharacters.length
      ? "Every character named above must be clearly visible, unmistakably identifiable by their signature colors, costume and design, and prominent in the composition — not a tiny, ambiguous, or obscured background figure."
      : "",
    `VARIATION SEED: ${randomSeed}-${crypto.randomUUID()}.`,
    "Keep the exact same universe, era, character designs, world design, night palette and lighting language, but use a meaningfully different camera angle, staging and foreground detail.",
    styleDirective(settings?.style),
    nostalgiaDirective(settings?.nostalgia),
    recognizabilityDirective(worldBible, sceneCharacters),
    sceneDetail
      ? `MANDATORY REQUEST FOR THIS ONE FRAME ONLY: ${sceneDetail}. Do not turn it into a recurring detail.`
      : "",
    excludedSceneDetails.length
      ? `RESERVED FOR OTHER FRAMES — DO NOT SHOW HERE: ${excludedSceneDetails.join(" | ")}.`
      : "",
    "Faithful source appearance, natural unposed behavior, clean high-detail composition, strong depth, approximately 2 AM, quiet nostalgic cozy slightly liminal mood.",
    "Designed for a vertical TikTok or Reels slideshow. No captions. No text. No logos. No watermark. Full-bleed vertical 9:16 portrait frame edge-to-edge, no letterboxing, no pillarboxing, no borders.",
  ].filter(Boolean).join("\n");
}

export async function regenerateTwoAmScene({ worldBible, scene, randomSeed, settings }) {
  // Regenerate at the SAME tier the generation was created at (server-clamped
  // and stored in settings.quality by two-am-planner) — not whatever the
  // picker currently shows, so a scene can't be re-rolled at a higher tier
  // than the one actually paid for.
  const tier = IMAGE_QUALITY_TIERS[settings?.quality] ?? IMAGE_QUALITY_TIERS[DEFAULT_IMAGE_QUALITY];
  return createImageJobSimple({
    subject: buildRegenerationPrompt({ worldBible, scene, randomSeed, settings }),
    toolKey: tier.toolKey,
    size: `${tier.width}x${tier.height}`,
    width: tier.width,
    height: tier.height,
    chargeCreditsOverride: tier.creditsPerImage,
  });
}

export async function updateTwoAmGeneration(generationId, patch) {
  const { data, error } = await supabase
    .from("two_am_generations")
    .update(patch)
    .eq("id", generationId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function settleTwoAmGeneration(generationId, completedScenes) {
  const { data, error } = await supabase.rpc("settle_two_am_generation", {
    p_generation_id: generationId,
    p_completed_scenes: completedScenes,
  });
  if (error) throw error;
  return data;
}

export async function listTwoAmGenerations(limit = 8, userId = null) {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    resolvedUserId = user?.id ?? null;
  }
  if (!resolvedUserId) return [];
  const { data, error } = await supabase
    .from("two_am_generations")
    .select("*")
    .eq("user_id", resolvedUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getTwoAmGeneration(generationId) {
  const { data, error } = await supabase
    .from("two_am_generations")
    .select("*")
    .eq("id", generationId)
    .single();
  if (error) throw error;
  return data;
}

export function mapTwoAmGeneration(row) {
  return {
    id: row.id,
    userPrompt: row.user_prompt,
    franchise: row.franchise,
    world: row.world,
    era: row.era,
    anchorCharacter: row.anchor_character,
    settings: row.settings ?? {},
    worldBible: row.world_bible ?? {},
    randomSeed: row.random_seed,
    scenes: row.scenes ?? [],
    status: row.status,
    createdAt: row.created_at,
    reservedCredits: row.reserved_credits ?? null,
  };
}
