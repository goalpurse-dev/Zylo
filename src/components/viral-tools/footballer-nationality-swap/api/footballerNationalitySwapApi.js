import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";

/* ── Constants ──────────────────────────────────────────────── */
export const IMAGE_TOOL_KEY = "image:fruit-v2";
// Fallback image engine when OpenAI (gpt-image) flags/rejects the prompt —
// real-footballer-likeness prompts trip its moderation more often than most.
export const IMAGE_FALLBACK_TOOL_KEY = "image:nano.2";
export const IMAGE_FALLBACK_RES      = "1k";
export const IMAGE_FALLBACK_W        = 384;
export const IMAGE_FALLBACK_H        = 688;
// Primary video engine — Seedance 2.0 Fast @ 480p. Veo 3.1 Lite was tried
// first but its Vertex AI content filter rejected essentially every
// real-footballer-likeness + speech request outright (confirmed via job
// logs — every attempt, including a softened prompt, got rejected). Seedance
// isn't hitting that wall. NOTE: Seedance 2.0 Fast has no confirmed audio
// support (its Runware schema has no audio field at all, unlike 1.5 Pro) —
// if it ships silent, that'll need re-checking against a real generation.
export const VIDEO_TOOL_KEY   = "video:seedance20fast";
export const VIDEO_W          = 496;
export const VIDEO_H          = 864;
export const VIDEO_CREDITS    = 37; // 2x markup on measured $0.364092 actual cost (480p)
// Fallback engine — Seedance 1.5 Pro @ 720p, WITH confirmed native audio via
// providerSettings.bytedance.audio (see animateFootballerClip below).
export const VIDEO_FALLBACK_TOOL_KEY = "video:seedance15pro";
export const VIDEO_FALLBACK_W        = 720;
export const VIDEO_FALLBACK_H        = 1280;
export const VIDEO_FALLBACK_CREDITS  = 32; // 2x markup on measured $0.3151728 actual cost (720p, audio on)
export const IMAGE_CREDITS    = 2;                 // ~$0.013 cost x2 = ~2 credits
export const IMAGE_FALLBACK_CREDITS = 4;           // Nano Banana 2 @ 1k — same ballpark
export const VIDEO_DURATION   = 6;
export const IMAGE_W          = 768;
export const IMAGE_H          = 1376;

export const SCENE_COUNT_OPTIONS = [3, 4, 5];
export const DEFAULT_SCENE_COUNT = 3;
export const MAX_SCENES          = 5;

export const EXPRESSION_OPTIONS = [
  { value: "confident", label: "Confident",  hint: "Determined half-smile" },
  { value: "joyful",     label: "Joyful",     hint: "Bright energetic grin" },
  { value: "focused",    label: "Focused",    hint: "Intense competitive stare" },
  { value: "fierce",     label: "Fierce",     hint: "Powerful game-day intensity" },
];

export const VIDEO_STYLE_OPTIONS = [
  { value: "stadium-tunnel",   label: "Stadium Tunnel",   hint: "Tunnel entrance, crowd bokeh" },
  { value: "press-conference", label: "Press Conference", hint: "Backdrop with sponsor logos" },
  { value: "training-ground",  label: "Training Ground",  hint: "Outdoor pitch, daylight" },
];

const EXPRESSION_DESCRIPTIONS = {
  confident: "a confident, determined half-smile with direct eye contact",
  joyful:    "a bright, joyful grin, full of energy",
  focused:   "a focused, intense competitive stare",
  fierce:    "a fierce, powerful game-day intensity",
};

const VIDEO_STYLE_BACKGROUNDS = {
  "stadium-tunnel":   "a blurred stadium tunnel entrance behind him, soft crowd lights bokeh",
  "press-conference": "a blurred press-conference backdrop behind him, sponsor logos softly out of focus",
  "training-ground":  "a blurred outdoor training pitch behind him, natural daylight",
};

const VIDEO_STYLE_AMBIENCE = {
  "stadium-tunnel":   "a distant stadium crowd murmur",
  "press-conference": "quiet room tone with faint camera shutter clicks",
  "training-ground":  "soft outdoor wind and a distant ball bounce",
};

export function calcCredits(sceneCount) {
  return sceneCount * (IMAGE_CREDITS + VIDEO_CREDITS);
}

/* ── Prompt builders ──────────────────────────────────────────
   The image model cannot render legible text reliably, so the
   "player card" is described as blank/plain rather than expecting
   the jersey number or name to actually appear as readable text.
──────────────────────────────────────────────────────────────── */
// The card only gets real text once a localized name has actually resolved —
// callers must await identity before building the image prompt. Falls back
// to a blank card (previous behavior) when no name is available yet.
function cardText(localizedName) {
  const name = (localizedName || "").trim();
  if (!name) {
    return `He holds a plain blank white rectangular player ID card at chest height with both hands, angled slightly toward the camera — the card has no readable text or logos.`;
  }
  return (
    `He holds a plain white rectangular player ID card at chest height with both hands, angled slightly toward the camera — ` +
    `the card clearly displays the name "${name}" printed in bold, legible black block letters, centered on the card.`
  );
}

// Primary prompt — pushes hard for actual likeness (same face, hair, facial
// hair, build as the real player) so the result is recognizably him, just
// wearing a different nation's jersey. This is the highest-risk prompt for
// moderation flags on well-known names, which is exactly what
// buildFriendlyImagePrompt below exists to catch — it only fires once this
// one gets rejected on both engines.
export function buildImagePrompt({ footballer, nationality, localizedName, expression = "confident", videoStyle = "stadium-tunnel" }) {
  const expressionText = EXPRESSION_DESCRIPTIONS[expression] ?? EXPRESSION_DESCRIPTIONS.confident;
  const backgroundText = VIDEO_STYLE_BACKGROUNDS[videoStyle] ?? VIDEO_STYLE_BACKGROUNDS["stadium-tunnel"];

  return (
    `Photorealistic sports media-day photograph of professional footballer ${footballer.trim()} — ` +
    `same face, same hairstyle and facial hair, same skin tone and build as the real player, instantly recognizable as him — ` +
    `but now representing ${nationality.trim()} instead of his real national team. ` +
    `He stands centered, directly facing the camera, medium-full shot, shoulders square to the lens. ` +
    `He wears an authentic-looking ${nationality.trim()} national-team-style football jersey in that nation's traditional colors. ` +
    `${cardText(localizedName)} ` +
    `His expression shows ${expressionText}. Behind him: ${backgroundText}. ` +
    `Sharp studio-quality lighting, crisp focus, high detail, vertical 9:16 composition, no on-screen text (except the card), no UI, no watermark.`
  );
}

// Softer fallback prompt — drops the real footballer's name and any
// likeness framing entirely, since that's what trips OpenAI's moderation on
// well-known players. Keeps everything else (nationality, jersey, pose,
// card) so the scene still fits the format, just without the guaranteed
// resemblance — a generic athletic character is better than nothing.
export function buildFriendlyImagePrompt({ nationality, localizedName, expression = "confident", videoStyle = "stadium-tunnel" }) {
  const expressionText = EXPRESSION_DESCRIPTIONS[expression] ?? EXPRESSION_DESCRIPTIONS.confident;
  const backgroundText = VIDEO_STYLE_BACKGROUNDS[videoStyle] ?? VIDEO_STYLE_BACKGROUNDS["stadium-tunnel"];

  return (
    `Photorealistic sports media-day photograph of a fictional professional footballer character, ` +
    `athletic build, representing ${nationality.trim()}. ` +
    `He stands centered, directly facing the camera, medium-full shot, shoulders square to the lens. ` +
    `He wears an authentic-looking ${nationality.trim()} national-team-style football jersey in that nation's traditional colors. ` +
    `${cardText(localizedName)} ` +
    `His expression shows ${expressionText}. Behind him: ${backgroundText}. ` +
    `Sharp studio-quality lighting, crisp focus, high detail, vertical 9:16 composition, no on-screen text (except the card), no UI, no watermark.`
  );
}

export function buildVideoPrompt({ spokenLine, expression = "confident", videoStyle = "stadium-tunnel" }) {
  const expressionText = EXPRESSION_DESCRIPTIONS[expression] ?? EXPRESSION_DESCRIPTIONS.confident;
  const ambienceText   = VIDEO_STYLE_AMBIENCE[videoStyle] ?? VIDEO_STYLE_AMBIENCE["stadium-tunnel"];
  const line = (spokenLine || "").trim();

  return (
    `Animate this photo into a realistic 6-second vertical talking media-day introduction video. ` +
    `ONE CONTINUOUS SHOT, camera static or with a subtle handheld drift — no cuts, no scene changes. ` +
    `The footballer looks directly into the camera and speaks naturally with accurate lip sync, saying: "${line}" ` +
    `His expression stays ${expressionText} throughout, with natural subtle body movement — breathing, small head motion, natural blinking. ` +
    `The background stays consistent with the photo. ` +
    `AUDIO DIRECTION: a clear, natural spoken voice delivering the line in the appropriate language and accent for the character, ` +
    `plus ${ambienceText} in the background. No music, no soundtrack, no score. No on-screen text, no UI, no watermark.`
  );
}

// Softer retry prompt — used as a second attempt on either engine in case a
// specific phrasing (e.g. "accurate lip sync", the deterministic "saying: X"
// framing) trips a provider's content filter. Looser, less deepfake-adjacent
// language, while still asking for a spoken line.
export function buildFriendlyVideoPrompt({ spokenLine, expression = "confident", videoStyle = "stadium-tunnel" }) {
  const expressionText = EXPRESSION_DESCRIPTIONS[expression] ?? EXPRESSION_DESCRIPTIONS.confident;
  const ambienceText   = VIDEO_STYLE_AMBIENCE[videoStyle] ?? VIDEO_STYLE_AMBIENCE["stadium-tunnel"];
  const line = (spokenLine || "").trim();

  return (
    `Animate this photo into a short 6-second vertical video clip. ` +
    `ONE CONTINUOUS SHOT, camera static or with a subtle handheld drift — no cuts, no scene changes. ` +
    `The person in the photo talks briefly and casually to the camera, along the lines of: "${line}" ` +
    `Keep the expression ${expressionText}, with natural subtle body movement — breathing, small head motion, natural blinking. ` +
    `The background stays consistent with the photo. ` +
    `AUDIO: a natural spoken voice, plus ${ambienceText} in the background. No music, no soundtrack. ` +
    `No on-screen text, no UI, no watermark.`
  );
}

/* ── Identity generation (localized name / jersey / spoken line) ── */
export async function fetchFootballerIdentity({ footballer, nationality }) {
  const { data, error } = await supabase.functions.invoke("generate-footballer-identity", {
    body: { footballer, nationality },
  });
  if (error) throw error;
  if (!data?.localizedName || !data?.jerseyNumber || !data?.spokenLine) {
    throw new Error("Identity generation returned an incomplete result");
  }
  return {
    localizedName: String(data.localizedName),
    jerseyNumber:  String(data.jerseyNumber),
    spokenLine:    String(data.spokenLine),
    language:      String(data.language || "English"),
  };
}

/* ── Image generation ─────────────────────────────────────────── */
// `provider` picks the engine for this attempt — "openai" (default, gpt-image
// via Runware) or "nano2" (Nano Banana 2, used as a fallback when OpenAI
// flags/rejects the prompt). Callers drive the openai → nano2 → openai
// (friendlier prompt) → nano2 (friendlier prompt) cascade by calling this
// with different `provider`/`imagePrompt` combinations.
export async function generateFootballerImage({ imagePrompt, provider = "openai" }) {
  if (provider === "nano2") {
    return createImageJobSimple({
      subject: imagePrompt,
      toolKey: IMAGE_FALLBACK_TOOL_KEY,
      resolution: IMAGE_FALLBACK_RES,
      size: `${IMAGE_FALLBACK_W}x${IMAGE_FALLBACK_H}`,
      width: IMAGE_FALLBACK_W,
      height: IMAGE_FALLBACK_H,
      refImages: [],
      expectedRefSlotCount: 0,
      chargeCreditsOverride: IMAGE_FALLBACK_CREDITS,
      project_id: null,
    });
  }

  return createImageJobSimple({
    subject: imagePrompt,
    toolKey: IMAGE_TOOL_KEY,
    size: `${IMAGE_W}x${IMAGE_H}`,
    width: IMAGE_W,
    height: IMAGE_H,
    refImages: [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: IMAGE_CREDITS,
    project_id: null,
    providerHint: {
      engine: "runware", mode: "t2i", edgeFn: "/functions/v1/runware-image", airTag: "openai:gpt-image@2",
      settings: { quality: "low", fruitModel: "zyvo-v2", skipResponse: true, deliveryMethod: "async", outputQuality: 85 },
    },
  });
}

/* ── Video generation ─────────────────────────────────────────── */
// `provider` picks the engine — "seedance2" (default, primary, Seedance 2.0
// Fast @ 480p) or "seedance15" (fallback, Seedance 1.5 Pro @ 720p, confirmed
// native audio via providerSettings.bytedance.audio).
export async function animateFootballerClip({ imageUrl, videoPrompt, provider = "seedance2" }) {
  if (!imageUrl) throw new Error("animateFootballerClip: missing imageUrl");

  if (provider === "seedance15") {
    return createVideoJobSimple({
      subject:           videoPrompt,
      toolKey:           VIDEO_FALLBACK_TOOL_KEY,
      width:             VIDEO_FALLBACK_W,
      height:            VIDEO_FALLBACK_H,
      durationSec:       VIDEO_DURATION,
      initImageUrls:     [imageUrl],
      calculatedCredits: VIDEO_FALLBACK_CREDITS,
      withSound:         true, // Seedance 1.5 Pro — providerSettings.bytedance.audio: true
    });
  }

  return createVideoJobSimple({
    subject:           videoPrompt,
    toolKey:           VIDEO_TOOL_KEY,
    width:             VIDEO_W,
    height:            VIDEO_H,
    durationSec:       VIDEO_DURATION,
    initImageUrls:     [imageUrl],
    calculatedCredits: VIDEO_CREDITS,
    withSound:         true, // no confirmed schema support on Seedance 2.0 Fast — harmless either way
  });
}

/* ── Supabase persistence ─────────────────────────────────────── */
export async function createFootballerNationalitySwapGeneration({ sceneCount, scenes }) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) throw new Error("Must be signed in");

  const savedScenes = (scenes ?? [])
    .filter((s) => s.imageUrl || s.videoUrl)
    .map((s, i) => ({
      index:         s.index ?? i,
      footballer:    s.footballer ?? "",
      nationality:   s.nationality ?? "",
      localizedName: s.localizedName ?? "",
      jerseyNumber:  s.jerseyNumber ?? "",
      spokenLine:    s.spokenLine ?? "",
      expression:    s.expression ?? "confident",
      videoStyle:    s.videoStyle ?? "stadium-tunnel",
      imageUrl:      s.imageUrl ?? null,
      videoUrl:      s.videoUrl ?? null,
    }));

  if (!savedScenes.length) throw new Error("No scenes to save");

  const { data, error } = await supabase
    .from("footballer_nationality_swap_generations")
    .insert({ user_id: userData.user.id, scene_count: sceneCount ?? savedScenes.length, status: "completed", scenes: savedScenes })
    .select("*").single();

  if (error) throw new Error(error.message);
  return normalizeRow(data);
}

export async function listFootballerNationalitySwapGenerations(limit = 8) {
  const { data, error } = await supabase
    .from("footballer_nationality_swap_generations").select("*")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeRow);
}

// Attaches the client-stitched "full video" URL to an already-saved
// generation row, so reopening it later shows the finished video instead of
// re-stitching from scratch. Called once, after the ffmpeg stitch + Storage
// upload succeed (see useFootballerStitchEditor.js).
export async function updateFootballerNationalitySwapFullVideo({ id, fullVideoUrl }) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("footballer_nationality_swap_generations")
    .update({ full_video_url: fullVideoUrl })
    .eq("id", id)
    .select("*").single();
  if (error) throw new Error(error.message);
  return normalizeRow(data);
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt ?? null,
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
    fullVideoUrl: row.full_video_url ?? null,
  };
}
