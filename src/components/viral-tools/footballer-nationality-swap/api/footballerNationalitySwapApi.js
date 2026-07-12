import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";

/* ── Constants ──────────────────────────────────────────────── */
export const IMAGE_TOOL_KEY = "image:fruit-v2";
// Native-audio video model — required since every scene ends with a spoken line.
export const VIDEO_TOOL_KEY   = "video:veo31lite";
export const IMAGE_CREDITS    = 2;                 // ~$0.013 cost x2 = ~2 credits
export const VIDEO_CREDITS    = 30;                // 5 cr/s x 6s — Veo 3.1 Lite + audio
export const VIDEO_DURATION   = 6;                 // Veo 3.1 Lite — supported: 4s / 6s / 8s
export const IMAGE_W          = 768;
export const IMAGE_H          = 1376;
// Must be one of Veo 3.1 Lite's allowed resolutions (720x1280, 1280x720,
// 1920x1080, 1080x1920) — Runware rejects anything else with "unsupportedModelResolution".
export const VIDEO_W          = 720;
export const VIDEO_H          = 1280;

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
export function buildImagePrompt({ footballer, nationality, expression = "confident", videoStyle = "stadium-tunnel" }) {
  const expressionText = EXPRESSION_DESCRIPTIONS[expression] ?? EXPRESSION_DESCRIPTIONS.confident;
  const backgroundText = VIDEO_STYLE_BACKGROUNDS[videoStyle] ?? VIDEO_STYLE_BACKGROUNDS["stadium-tunnel"];

  return (
    `Photorealistic sports media-day photograph of a fictional alternate-universe professional footballer, ` +
    `an original character reimagined in the style of ${footballer.trim()}, now representing ${nationality.trim()}. ` +
    `He stands centered, directly facing the camera, medium-full shot, shoulders square to the lens. ` +
    `He wears an authentic-looking ${nationality.trim()} national-team-style football jersey in that nation's traditional colors. ` +
    `He holds a plain blank white rectangular player ID card at chest height with both hands, angled slightly toward the camera — the card has no readable text or logos. ` +
    `His expression shows ${expressionText}. Behind him: ${backgroundText}. ` +
    `Sharp studio-quality lighting, crisp focus, high detail, vertical 9:16 composition, no on-screen text, no UI, no watermark.`
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
export async function generateFootballerImage({ imagePrompt }) {
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
export async function animateFootballerClip({ imageUrl, videoPrompt }) {
  if (!imageUrl) throw new Error("animateFootballerClip: missing imageUrl");
  return createVideoJobSimple({
    subject:           videoPrompt,
    toolKey:           VIDEO_TOOL_KEY,
    width:             VIDEO_W,
    height:            VIDEO_H,
    durationSec:       VIDEO_DURATION,
    initImageUrls:     [imageUrl],
    calculatedCredits: VIDEO_CREDITS,
    withSound:         true,
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

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt ?? null,
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
  };
}
