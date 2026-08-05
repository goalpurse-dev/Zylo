import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";
import { getAllowedVideoModels as sharedGetAllowedVideoModels, PLAN_LABELS } from "../../../../lib/planGating";

export { PLAN_LABELS };

export const QUALITY_TIERS = {
  "cartoon-drive-v2": {
    id: "cartoon-drive-v2",
    label: "V2",
    tag: "Fastest",
    description: "2K image · 720p video",
    imageToolKey: "image:cartoondrive2k",
    imageResolution: "2k",
    imageWidth: 768,
    imageHeight: 1376,
    imageCredits: 7,
    videoToolKey: "video:seedance15pro",
    videoWidth: 720,
    videoHeight: 1280,
    videoCredits: 25,
    withSound: false,
  },
  "cartoon-drive-v3": {
    id: "cartoon-drive-v3",
    label: "V3",
    tag: "Premium",
    description: "4K image · 720p video",
    imageToolKey: "image:cartoondrive4kpro",
    imageResolution: "4k",
    imageWidth: 1536,
    imageHeight: 2752,
    imageCredits: 10,
    videoToolKey: "video:cartoondriveseedance720",
    videoWidth: 720,
    videoHeight: 1280,
    videoCredits: 160,
    withSound: false,
  },
  "cartoon-drive-v4": {
    id: "cartoon-drive-v4",
    label: "V4",
    tag: "Professional",
    description: "4K image · 1080p video",
    imageToolKey: "image:cartoondrive4kmax",
    imageResolution: "4k",
    imageWidth: 1536,
    imageHeight: 2752,
    imageCredits: 10,
    videoToolKey: "video:cartoondriveseedance1080",
    videoWidth: 1080,
    videoHeight: 1920,
    videoCredits: 400,
    withSound: false,
  },
};

export const DEFAULT_QUALITY_TIER = "cartoon-drive-v2";
export const VIDEO_DURATION = 10;

export const QUALITY_TIER_MIN_PLAN = {
  "cartoon-drive-v2": "starter",
  "cartoon-drive-v3": "pro",
  "cartoon-drive-v4": "generative",
};

export function getAllowedQualityTiers(planCode) {
  return sharedGetAllowedVideoModels(planCode, QUALITY_TIER_MIN_PLAN);
}

export function calcCredits(qualityId = DEFAULT_QUALITY_TIER) {
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return tier.imageCredits + tier.videoCredits;
}

const MOOD_COPY = {
  "golden-dusk": "golden dusk with a warm amber sky, long shadows and sun flare",
  "pink-sunset": "a dreamy pink sunset with rose-colored clouds and soft pastel light",
  "purple-twilight": "purple twilight with deep violet clouds, cool shadows and the last warm horizon glow",
  "fiery-red": "a fiery red sunset with dramatic crimson clouds and hot orange light",
};

const VEHICLE_DIRECTIONS = {
  car: {
    capture: "from the front passenger seat of a real modern car",
    framing: "a realistic car side-window edge, upper roof liner, lower door trim, passenger-side mirror and restrained reflections in slightly tinted glass",
    foreground: "asphalt shoulder, roadside grass, fence posts and utility poles",
    motion: "natural car suspension movement with small road vibrations and gentle handheld phone sway",
    exclusions: "No bus seats, train window, railway track, carriage table or camper cabinetry",
  },
  bus: {
    capture: "from a seated passenger row inside a real moving bus",
    framing: "a large flat bus side window with a thick rubber frame, lower window sill, a subtle seat-back edge and faint cabin reflections",
    foreground: "road shoulder, guardrail, roadside grass, signs and utility poles",
    motion: "steady heavy-vehicle travel with mild body roll, soft suspension movement and restrained handheld phone sway",
    exclusions: "No car door, car side mirror, steering wheel, train window, railway track or camper cabinetry",
  },
  train: {
    capture: "from a seated passenger position inside a real moving railway carriage",
    framing: "a wide double-glazed train window with a solid rounded frame, lower sill, faint carriage reflections and only a subtle edge of the passenger seat or small window table",
    foreground: "railway ballast, trackside grass, signal posts, catenary poles and fencing beside the line",
    motion: "smooth rail travel with low-frequency carriage sway, subtle vibration and fast lateral trackside parallax",
    exclusions: "No road, asphalt shoulder, car door, side mirror, steering wheel, bus interior or camper cabinetry",
  },
  "camper van": {
    capture: "from a passenger seat beside the side window of a real moving camper van",
    framing: "a practical camper-van side window with a sturdy frame, lower sill, a restrained curtain edge and a small believable edge of warm wood cabinetry",
    foreground: "road shoulder, roadside vegetation, guardrails, fence posts and occasional utility poles",
    motion: "natural van suspension movement with gentle body roll and subtle handheld phone sway",
    exclusions: "No train window, railway track, bus seating, oversized luxury motorhome interior or impossible cabin geometry",
  },
};

function vehicleDirection(vehicle) {
  return VEHICLE_DIRECTIONS[vehicle] ?? VEHICLE_DIRECTIONS.car;
}

export function buildImagePrompt({ world, vehicle = "car", mood = "golden-dusk" }) {
  const subject = String(world ?? "").trim();
  const moodCopy = MOOD_COPY[mood] ?? MOOD_COPY["golden-dusk"];
  const vehicleCopy = vehicleDirection(vehicle);

  return [
    `A photorealistic nostalgic drive-by phone photograph captured ${vehicleCopy.capture}.`,
    `Across a vast believable real-world landscape, far away on the horizon, show an iconic cartoon or video-game destination based on this idea: ${subject}.`,
    "Translate the destination into convincing real architecture and natural materials: weathered stone, painted wood, aged metal, glass, concrete, vegetation and terrain. Preserve its unmistakable silhouette and signature physical details, but make it feel like a place that truly exists.",
    "The landmark must remain distant and relatively small in frame, softened by atmospheric haze. It must not fill the frame.",
    `Foreground ${vehicleCopy.foreground} streak horizontally with natural motion blur, while the far landmark stays crisp enough to recognize. Strong depth and believable parallax appropriate to a moving ${vehicle}.`,
    `The vehicle interior is anatomically correct and visibly frames the shot with ${vehicleCopy.framing}. The camera is a handheld phone at seated passenger eye level, looking sideways through the window. ${vehicleCopy.exclusions}.`,
    `${moodCopy}. Dreamy nostalgic atmosphere, gentle bloom, fine film grain, slightly faded colors, warm air, realistic optics and cinematic live-action photography.`,
    "Vertical 9:16 full-bleed composition for TikTok and Reels. No text, captions, subtitles, watermarks, logos or brand names. No CGI look, cartoon rendering, cel shading, toy appearance, warped architecture or impossible geometry.",
  ].join("\n");
}

export function buildVideoPrompt({ world, vehicle = "car", mood = "golden-dusk", withSound = false }) {
  const vehicleCopy = vehicleDirection(vehicle);
  const audioDirection = withSound
    ? `AUDIO: natural ${vehicle} engine hum, tire noise, wind and faint environmental ambience only. No voices, narration, dialogue, music, score or soundtrack.`
    : "NO AUDIO GENERATED. Create a completely silent video with no audio track.";

  return [
    `Animate this image into one continuous 10-second photorealistic vertical drive-by shot ${vehicleCopy.capture}. The distant destination is based on: ${String(world ?? "").trim()}. Preserve the original ${mood} lighting, the exact vehicle interior and the exact visual identity of the still image.`,
    `0-2 seconds: the ${vehicle} moves steadily forward. Nearby ${vehicleCopy.foreground} sweep quickly sideways. The distant landmark is only beginning to enter the window view.`,
    "2-5 seconds: the landmark drifts naturally into clearer view across the far horizon. Keep it distant and stable while foreground layers move much faster.",
    "5-8 seconds: hold the strongest readable view through the window. The landmark remains nearly stationary because of distance; glass reflections, atmospheric haze and sunlight move subtly.",
    "8-10 seconds: the vehicle continues forward and the landmark slides toward the rear edge of the window, beginning to disappear from view. End on natural forward motion suitable for a clean loop.",
    `Maintain physically correct parallax, realistic horizontal foreground motion blur, ${vehicleCopy.motion}, soft window reflections, cinematic haze, fine film grain and consistent geometry. Keep ${vehicleCopy.framing} stable and physically correct throughout. ${vehicleCopy.exclusions}. The camera never leaves the vehicle and never cuts.`,
    "No zoom toward the landmark, no drone movement, no scene change, no morphing buildings, no added characters, no text, captions, logos, UI or watermark.",
    audioDirection,
  ].join("\n");
}

export async function generateDriveByImage({ world, vehicle, mood, qualityId = DEFAULT_QUALITY_TIER }) {
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return createImageJobSimple({
    subject: buildImagePrompt({ world, vehicle, mood }),
    toolKey: tier.imageToolKey,
    resolution: tier.imageResolution,
    size: `${tier.imageWidth}x${tier.imageHeight}`,
    width: tier.imageWidth,
    height: tier.imageHeight,
    refImages: [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: tier.imageCredits,
    project_id: null,
  });
}

export async function animateDriveBy({ imageUrl, world, vehicle, mood, qualityId = DEFAULT_QUALITY_TIER }) {
  if (!imageUrl) throw new Error("animateDriveBy: missing imageUrl");
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return createVideoJobSimple({
    subject: buildVideoPrompt({ world, vehicle, mood, withSound: tier.withSound }),
    toolKey: tier.videoToolKey,
    width: tier.videoWidth,
    height: tier.videoHeight,
    durationSec: VIDEO_DURATION,
    initImageUrls: [imageUrl],
    calculatedCredits: tier.videoCredits,
    withSound: tier.withSound,
  });
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt ?? null,
    qualityId: row.quality_id ?? row.qualityId ?? DEFAULT_QUALITY_TIER,
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    videoUrl: row.video_url ?? row.videoUrl ?? null,
  };
}

export async function createCartoonDriveByGeneration({ world, vehicle, mood, qualityId, imageUrl, videoUrl }) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) throw new Error("Must be signed in");
  if (!imageUrl && !videoUrl) throw new Error("No result to save");

  const { data, error } = await supabase
    .from("cartoon_drive_by_generations")
    .insert({
      user_id: userData.user.id,
      world: String(world ?? "").trim(),
      vehicle: vehicle || "car",
      mood: mood || "golden-dusk",
      quality_id: qualityId || DEFAULT_QUALITY_TIER,
      status: "completed",
      image_url: imageUrl ?? null,
      video_url: videoUrl ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeRow(data);
}

export async function listCartoonDriveByGenerations(limit = 8) {
  const { data, error } = await supabase
    .from("cartoon_drive_by_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeRow);
}
