import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";
import { getAllowedVideoModels as sharedGetAllowedVideoModels, PLAN_LABELS } from "../../../../lib/planGating";

export { PLAN_LABELS };

/* ── Constants ──────────────────────────────────────────────── */
export const IMAGE_TOOL_KEY          = "image:fruit-v2";
export const IMAGE_FALLBACK_TOOL_KEY = "image:nano.2";   // Nano Banana 2 @ 1k = 5 credits
export const IMAGE_FALLBACK_RES      = "1k";
export const IMAGE_CREDITS           = 2;
export const IMAGE_FALLBACK_CREDITS  = 4;
export const IMAGE_W                 = 768;
export const IMAGE_H                 = 1376;
export const IMAGE_FALLBACK_W        = 384;
export const IMAGE_FALLBACK_H        = 688;

// Three video tiers, gated by plan — same models as Clay Rescue. Video
// credits are tuned so the BLENDED per-scene margin (1 image @ 2cr/$0.010423
// + 1 video clip) lands at ~50%, not just the video's own margin.
export const VIDEO_MODELS = {
  "face-v2": {
    id: "face-v2",
    label: "V2",
    tag: "Cheapest",
    description: "480p — NO AUDIO GENERATED",
    toolKey: "video:seedance15pro",
    width: 496,
    height: 864,
    duration: 5,
    credits: 5,            // measured $0.0607656/5s → blended per-scene margin ~49.2%
    withSound: false,
  },
  "face-v3": {
    id: "face-v3",
    label: "V3",
    tag: "Premium",
    description: "720p — includes audio",
    toolKey: "video:viduq3turbo720",
    width: 720,
    height: 1280,
    duration: 5,
    credits: 17,           // measured $0.17875/5s → blended per-scene margin ~50.2%
    withSound: true,
  },
  "face-v4": {
    id: "face-v4",
    label: "V4",
    tag: "Professional",
    description: "1080p — includes audio",
    toolKey: "video:viduq3turbo1080",
    width: 1080,
    height: 1920,
    duration: 5,
    credits: 20,           // measured $0.21125/5s → blended per-scene margin ~49.6%
    withSound: true,
  },
};
export const DEFAULT_VIDEO_MODEL = "face-v2";

// Plan gating — which video models each plan tier can use.
export const VIDEO_MODEL_MIN_PLAN = {
  "face-v2": "starter",
  "face-v3": "pro",
  "face-v4": "generative",
};

export function getAllowedVideoModels(planCode) {
  return sharedGetAllowedVideoModels(planCode, VIDEO_MODEL_MIN_PLAN);
}

export async function generateFaceAsmrCharacterNames({ count }) {
  const safeCount = Math.max(1, Math.min(9, Number(count) || 1));
  const { data, error } = await supabase.functions.invoke("face-asmr-characters", {
    body: { count: safeCount },
  });
  if (error) throw error;

  const names = Array.isArray(data?.names)
    ? data.names.map((name) => String(name || "").trim()).filter(Boolean)
    : [];

  if (!names.length) throw new Error("No names returned");
  return names.slice(0, safeCount);
}

export async function createFaceAsmrGeneration({ scenes, lengthId, backgroundId }) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) throw new Error("Must be signed in");

  const savedScenes = (scenes ?? [])
    .filter((s) => s.imageUrl || s.videoUrl)
    .map((s, i) => ({
      index: s.index ?? i,
      imageUrl: s.imageUrl ?? null,
      videoUrl: s.videoUrl ?? null,
    }));

  if (!savedScenes.length) throw new Error("No Face ASMR scenes to save");

  const { data, error } = await supabase
    .from("face_asmr_generations")
    .insert({
      user_id:       userData.user.id,
      title:         "Viral Video",
      scene_count:   savedScenes.length,
      length_id:     lengthId ?? null,
      background_id: backgroundId ?? null,
      status:        "completed",
      scenes:        savedScenes,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeFaceAsmrGeneration(data);
}

export async function listFaceAsmrGenerations(limit = 8) {
  const { data, error } = await supabase
    .from("face_asmr_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeFaceAsmrGeneration);
}

function normalizeFaceAsmrGeneration(row) {
  if (!row) return null;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt ?? null,
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
  };
}

/* ── Fixed video prompt ──────────────────────────────────────── */
export const FACE_VIDEO_PROMPT =
  "Two hands entering frame and aggressively kneading and mashing the entire face like soft dough, " +
  "deep compression folding and stretching deformation, cheeks spreading across the surface, " +
  "facial features heavily distorted then slowly bouncing back, " +
  "oddly satisfying ASMR motion, ultra realistic physics simulation.";

/* ── Background id → prompt text ────────────────────────────── */
const BG_PROMPT = {
  "white-marble":   "clean white marble",
  "black-marble":   "black marble",
  "light-oak":      "light oak wood",
  "dark-walnut":    "dark walnut wood",
  "brushed-steel":  "brushed steel",
  "frosted-glass":  "frosted glass",
  "concrete":       "polished concrete",
  "white-ceramic":  "white ceramic",
  "travertine":     "travertine stone",
  "matte-black":    "matte black stone",
};

/* ── Image prompt builder ────────────────────────────────────── */
/* ── Sanitize descriptions that trigger content filters ────── */
function sanitizeSubject(description) {
  if (!description?.trim()) return "a face";
  // Replace names of political figures that GPT Image 2 blocks
  const BLOCKED = /\b(trump|biden|obama|putin|xi jinping|modi|boris johnson|macron|kim jong|zelensky|pelosi|clinton|bush|reagan)\b/gi;
  const sanitized = description.replace(BLOCKED, (match) => `a person inspired by ${match}`);
  return sanitized.trim();
}

export function buildFaceImagePrompt(description, backgroundId) {
  const bgText  = BG_PROMPT[backgroundId] ?? "clean white marble";
  const subject = sanitizeSubject(description);

  return (
    `${subject} as a surreal slime face, head made of glossy semi-transparent jelly-like slime, ` +
    `preserving realistic skin tone, eye color, and lip color, ` +
    `soft gooey texture, wet shine, smooth melted contours, ` +
    `only the head visible, clean outline, no surrounding slime puddle, no spilled slime, ` +
    `${bgText} background, ` +
    `top-down composition, soft studio lighting, ultra detailed, 8k`
  );
}

/* ── Fallback: Nano Banana 2 @ 1k (5 credits) ───────────────── */
export async function generateFaceImageFallback({ description, imagePreview, backgroundId }) {
  const prompt    = buildFaceImagePrompt(description, backgroundId);
  const refImages = imagePreview ? [imagePreview] : [];

  return createImageJobSimple({
    subject:               prompt,
    toolKey:               IMAGE_FALLBACK_TOOL_KEY,
    resolution:            IMAGE_FALLBACK_RES,
    size:                  `${IMAGE_FALLBACK_W}x${IMAGE_FALLBACK_H}`,
    width:                 IMAGE_FALLBACK_W,
    height:                IMAGE_FALLBACK_H,
    refImages,
    expectedRefSlotCount:  refImages.length,
    chargeCreditsOverride: IMAGE_FALLBACK_CREDITS,
    project_id:            null,
  });
}

/* ── Start a single image job ────────────────────────────────── */
export async function generateFaceImage({ description, imagePreview, backgroundId }) {
  const prompt   = buildFaceImagePrompt(description, backgroundId);
  const refImages = imagePreview ? [imagePreview] : [];

  const job = await createImageJobSimple({
    subject:              prompt,
    toolKey:              IMAGE_TOOL_KEY,
    size:                 `${IMAGE_W}x${IMAGE_H}`,
    width:                IMAGE_W,
    height:               IMAGE_H,
    refImages,
    expectedRefSlotCount: refImages.length,
    chargeCreditsOverride: IMAGE_CREDITS,
    project_id:           null,
    providerHint: {
      engine:  "runware",
      mode:    "t2i",
      edgeFn:  "/functions/v1/runware-image",
      airTag:  "openai:gpt-image@2",
      settings: {
        quality:        "low",
        fruitModel:     "zyvo-v2",
        skipResponse:   true,
        deliveryMethod: "async",
        outputQuality:  85,
      },
    },
  });

  return job;
}

/* ── Start a single video job ────────────────────────────────── */
export async function animateFaceClip({ imageUrl, videoModel = DEFAULT_VIDEO_MODEL }) {
  if (!imageUrl) throw new Error("animateFaceClip: missing imageUrl");

  const model = VIDEO_MODELS[videoModel] ?? VIDEO_MODELS[DEFAULT_VIDEO_MODEL];

  const job = await createVideoJobSimple({
    subject:           FACE_VIDEO_PROMPT,
    toolKey:           model.toolKey,
    width:             model.width,
    height:            model.height,
    durationSec:       model.duration,
    initImageUrls:     [imageUrl],
    calculatedCredits: model.credits,
    withSound:         model.withSound,
  });

  return job;
}
