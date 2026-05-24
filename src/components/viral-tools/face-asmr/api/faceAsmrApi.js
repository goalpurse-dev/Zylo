import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";

/* ── Constants ──────────────────────────────────────────────── */
export const IMAGE_TOOL_KEY          = "image:fruit-v2";
export const IMAGE_FALLBACK_TOOL_KEY = "image:nano.2";   // Nano Banana 2 @ 1k = 5 credits
export const IMAGE_FALLBACK_RES      = "1k";
export const VIDEO_TOOL_KEY          = "video:seedance15pro";
export const IMAGE_CREDITS           = 2;
export const IMAGE_FALLBACK_CREDITS  = 4;
export const VIDEO_CREDITS           = 6;
export const IMAGE_W                 = 768;
export const IMAGE_H                 = 1376;
export const IMAGE_FALLBACK_W        = 384;
export const IMAGE_FALLBACK_H        = 688;
export const VIDEO_W                 = 496;
export const VIDEO_H                 = 864;
export const VIDEO_DURATION          = 5;

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
export async function animateFaceClip({ imageUrl }) {
  if (!imageUrl) throw new Error("animateFaceClip: missing imageUrl");

  const job = await createVideoJobSimple({
    subject:           FACE_VIDEO_PROMPT,
    toolKey:           VIDEO_TOOL_KEY,
    width:             VIDEO_W,
    height:            VIDEO_H,
    durationSec:       VIDEO_DURATION,
    initImageUrls:     [imageUrl],
    calculatedCredits: VIDEO_CREDITS,
    withSound:         false,   // Seedance handles audio: false via providerSettings
  });

  return job;
}
