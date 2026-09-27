import { supabase } from "../../../../lib/supabaseClient";
import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { uploadForExternalFetch } from "../../../../lib/storage";

// ── Quality tiers ────────────────────────────────────────────────────────────
// Mirrors supabase/functions/thirty-days-planner/index.ts's QUALITY_TIERS —
// this copy is cosmetic (UI display/lock only); the edge function is the
// trusted server-side clamp, same pattern as every other V2/V3/V4 viral tool.
export const REFERENCE_IMAGE = { toolKey: "image:thirtydays1k", width: 768, height: 1376, credits: 5 };
export const QUALITY_TIERS = {
  "thirtydays-v2": { id: "thirtydays-v2", label: "V2", tag: "Included", description: "1K scenes · Seedance 1.5 Pro", imageToolKey: "image:thirtydays1k", imageWidth: 768, imageHeight: 1376, imageCredits: 5, videoToolKey: "video:seedance15pro", videoProvider: "runware", videoModel: "bytedance:seedance@1.5-pro", videoWidth: 496, videoHeight: 864, videoDurationSec: 5, videoCredits: 6, withSound: false, minPlan: "starter" },
  "thirtydays-v3": { id: "thirtydays-v3", label: "V3", tag: "Sharper", description: "2K scenes · Veo 3.1 Lite", imageToolKey: "image:thirtydays2k", imageWidth: 1536, imageHeight: 2752, imageCredits: 7, videoToolKey: "video:veo31lite", videoProvider: "runware", videoModel: "google:veo@3.1-lite", videoWidth: 720, videoHeight: 1280, videoDurationSec: 6, videoCredits: 18, withSound: false, minPlan: "pro" },
  "thirtydays-v4": { id: "thirtydays-v4", label: "V4", tag: "Best", description: "2K scenes · Seedance 2.0", imageToolKey: "image:thirtydays2k", imageWidth: 1536, imageHeight: 2752, imageCredits: 7, videoToolKey: "video:cartoondriveseedance720", videoProvider: "runware", videoModel: "bytedance:seedance@2.0", videoWidth: 720, videoHeight: 1280, videoDurationSec: 5, videoCredits: 80, withSound: false, minPlan: "generative" },
};
export const VISUAL_STYLES = [
  { id: "auto", label: "Franchise Accurate", shortLabel: "Auto", description: "Matches the universe's native visual language", recommended: true },
  { id: "cinematic_3d", label: "Cinematic 3D", shortLabel: "3D", description: "Polished dimensional feature-film rendering" },
  { id: "anime_accurate", label: "Anime Accurate", shortLabel: "Anime", description: "Faithful anime linework, color, and motion language" },
  { id: "realistic", label: "Realistic / Live Action", shortLabel: "Realistic", description: "Cinematic live-action reinterpretation with identities preserved" },
  { id: "dark_cinematic", label: "Dark Cinematic", shortLabel: "Dark", description: "Moody, high-contrast cinematic interpretation" },
];
export const DEFAULT_QUALITY_TIER = "thirtydays-v2";
export const DEFAULT_VISUAL_STYLE = "auto";
export const SCENE_COUNT = 8;
export const MILESTONE_DAYS = [1, 10, 20, 30];
export const SCENE_DURATION_SEC = 5;
export const REFERENCE_COUNT = 5;
export const SERVICE_BASE_CREDITS = 12;
export const VOICE_CREDITS_PER_TAKE = 3;

let runtimeQualityTiers = QUALITY_TIERS;

function normalizeTierRow(row) {
  const resolution = Number(row.image_width) >= 1536 ? "2K" : "1K";
  return {
    id: row.quality_tier,
    label: row.label,
    tag: row.quality_tier === "thirtydays-v2" ? "Included" : row.quality_tier === "thirtydays-v3" ? "Sharper" : "Best",
    description: `${resolution} scenes · ${String(row.video_model).includes("veo") ? "Veo 3.1 Lite" : String(row.video_model).includes("2.0") ? "Seedance 2.0" : "Seedance 1.5 Pro"}`,
    minPlan: row.min_plan,
    referenceToolKey: row.reference_tool_key,
    referenceWidth: Number(row.reference_width), referenceHeight: Number(row.reference_height), referenceCredits: Number(row.reference_cost_credits),
    imageToolKey: row.image_tool_key,
    imageWidth: Number(row.image_width), imageHeight: Number(row.image_height), imageCredits: Number(row.image_cost_credits),
    videoToolKey: row.video_tool_key, videoProvider: row.video_provider, videoModel: row.video_model,
    videoWidth: Number(row.video_width), videoHeight: Number(row.video_height),
    videoDurationSec: Number(row.video_duration_seconds), videoCredits: Number(row.video_cost_credits),
    withSound: Boolean(row.with_sound),
  };
}

export async function fetchThirtyDaysQualityTiers() {
  const { data, error } = await supabase.from("thirty_days_quality_tiers").select("*").order("quality_tier");
  if (error) throw error;
  const rows = (data ?? []).map(normalizeTierRow);
  if (rows.length !== 3) throw new Error("30 Days pricing is not configured");
  runtimeQualityTiers = Object.fromEntries(rows.map((tier) => [tier.id, tier]));
  return runtimeQualityTiers;
}

function tierFor(qualityId) {
  return runtimeQualityTiers[qualityId] ?? runtimeQualityTiers[DEFAULT_QUALITY_TIER] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
}

export function getThirtyDaysTier(qualityId = DEFAULT_QUALITY_TIER) {
  return tierFor(qualityId);
}

export function getServiceCredits(planCode = "starter") {
  return SERVICE_BASE_CREDITS + getThirtyDaysVoiceLimit(planCode) * VOICE_CREDITS_PER_TAKE;
}

export function getCreditBreakdown(qualityId = DEFAULT_QUALITY_TIER, referenceCount = 5, planCode = "starter") {
  const tier = tierFor(qualityId);
  const references = referenceCount * (tier.referenceCredits ?? REFERENCE_IMAGE.credits);
  const sceneImages = SCENE_COUNT * tier.imageCredits;
  const videos = SCENE_COUNT * tier.videoCredits;
  const service = getServiceCredits(planCode);
  return { referenceCount, references, sceneImages, videos, service, total: references + sceneImages + videos + service };
}

export function estimateTotalCredits(qualityId = DEFAULT_QUALITY_TIER, referenceCount = 5, planCode = "starter") {
  return getCreditBreakdown(qualityId, referenceCount, planCode).total;
}

// ── Voice roster ─────────────────────────────────────────────────────────────
// Copied (not imported) from AI Cooking Matic's WorkflowSteps.jsx VOICES —
// that array is module-private and dish-specific-adjacent, so this is a
// deliberate small duplication rather than a shared/generic refactor.
export const VOICES = [
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh",    viral: true,  traits: ["Energetic", "Youthful"], desc: "High energy — made for viral content" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi",    viral: true,  traits: ["Confident", "Bold"],     desc: "Strong, punchy delivery for hooks" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni",  viral: true,  traits: ["Warm", "Engaging"],      desc: "Friendly narrator, great for storytelling" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel",  viral: false, traits: ["Calm", "Clear"],         desc: "Balanced, natural narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella",   viral: false, traits: ["Soft", "Gentle"],        desc: "Light and approachable" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam",    viral: false, traits: ["Deep", "Authoritative"], desc: "Bold, commanding presence" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George",  viral: false, traits: ["Warm", "Narrative"],     desc: "Polished storyteller with a rich tone" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian",   viral: false, traits: ["Mature", "Smooth"],      desc: "Steady, trustworthy narration" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel",  viral: false, traits: ["Deep", "British"],       desc: "Confident presenter with a premium feel" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", viral: false, traits: ["Warm", "Friendly"],      desc: "Natural, inviting creator voice" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", viral: false, traits: ["Expressive", "Bright"],  desc: "Lively delivery for quick story videos" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice",   viral: false, traits: ["Clear", "British"],      desc: "Crisp, confident instructional voice" },
];
export function getVoice(id) {
  return VOICES.find((voice) => voice.id === id) ?? VOICES[0];
}

export const THIRTY_DAYS_VOICE_LIMITS = { starter: 2, affiliate: 2, pro: 3, generative: 5 };
export function getThirtyDaysVoiceLimit(planCode) {
  return THIRTY_DAYS_VOICE_LIMITS[String(planCode ?? "").toLowerCase()] ?? 2;
}

// ── Row normalization ────────────────────────────────────────────────────────
export function normalizeThirtyDaysGeneration(row) {
  if (!row) return row;
  return {
    ...row,
    aiIdeaMode: Boolean(row.ai_idea_mode),
    cameraMode: row.camera_mode ?? "third_person",
    worldBible: row.world_bible ?? {},
    visualReferences: Array.isArray(row.visual_references) ? row.visual_references : [],
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
    qualityTier: row.quality_tier ?? DEFAULT_QUALITY_TIER,
    visualStyle: row.visual_style ?? DEFAULT_VISUAL_STYLE,
    generationMode: row.generation_mode ?? "single",
    seriesId: row.series_id ?? null,
    seriesEpisodeId: row.series_episode_id ?? null,
    reservationStatus: row.reservation_status ?? "reserved",
    reservedCredits: Number(row.reserved_credits ?? 0),
    refundedCredits: Number(row.refunded_credits ?? 0),
    narrationScript: row.narration_script ?? null,
    narrationTake: row.narration_take ?? null,
    voiceGenerationLimit: Number(row.voice_generation_limit ?? 2),
    voiceGenerationsUsed: Number(row.voice_generations_used ?? 0),
    serviceCreditsCharged: Number(row.service_credits_charged ?? 0),
    fullVideoUrl: row.full_video_url ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// ── Planning ─────────────────────────────────────────────────────────────────
export async function fetchThirtyDaysIdea({ universe, mode = "single" }) {
  const { data, error } = await supabase.functions.invoke("thirty-days-idea", { body: { universe, mode } });
  if (error) throw new Error(await resolveFunctionErrorMessage(error, "Idea generation failed"));
  if (!data?.ok) throw new Error(data?.error || "Idea generation failed");
  return data.premise;
}

export async function beginThirtyDaysGeneration({ universe, premise, aiIdeaMode, quality = DEFAULT_QUALITY_TIER, visualStyle = DEFAULT_VISUAL_STYLE }) {
  const { data, error } = await supabase.functions.invoke("thirty-days-planner", {
    body: { universe, premise, aiIdeaMode, settings: { quality, visualStyle } },
  });
  if (error) throw new Error(await resolveFunctionErrorMessage(error, "Planning failed"));
  if (!data?.ok) throw new Error(data?.error || "Planning failed");
  return { generation: normalizeThirtyDaysGeneration(data.generation), tier: data.tier, totalAssets: data.totalAssets };
}

async function resolveFunctionErrorMessage(error, fallback) {
  try {
    const body = await error?.context?.json?.();
    const diagnostic = body?.diagnosticCode ? ` [${body.diagnosticCode}]` : "";
    return `${body?.message || body?.error || error?.message || fallback}${diagnostic}`;
  } catch {
    return error?.message || fallback;
  }
}

// ── Reference generation ─────────────────────────────────────────────────────
const REF_ROLE_COPY = {
  protagonist: "the mandatory viewer-insert YOU protagonist entering this world, full-body reference portrait, neutral standing pose, calm expression, clean neutral studio background",
  pov_hands: "the mandatory first-person YOU identity: point-of-view hands, arms, clothing/body cues in this world's rendering style, neutral background",
  core_cast_style: "a reference sheet establishing the recognizable named cast and this franchise's exact rendering style, clean neutral background",
  environment_primary: "a wide reference image of the primary iconic location, no characters, clean unobstructed view",
  environment_secondary: "a wide reference image of the secondary location, no characters, clean unobstructed view",
  antagonist: "a full-body reference portrait of the antagonist/threat, neutral pose, clean neutral background",
  companion: "a full-body reference portrait of the companion character, neutral pose, clean neutral background",
  artifact: "a clean product-style reference image of the story's key object, centered, neutral background",
  vehicle: "a clean three-quarter reference image of the vehicle, centered, neutral background",
};

// softenLevel escalates after a provider content-policy rejection: 0 =
// normal (full label/prompt/visualLock, lightly sanitized), 1 = drop the
// planner's own descriptive prompt text and keep only the role/label framing,
// 2 = the plainest possible neutral portrait/establishing-shot description.
// repairNote is set after a franchise-identity QA rejection (see
// thirty-days-reference-qa) — the opposite direction from softenLevel: it
// pushes the prompt to be MORE explicitly locked to real canon specifics,
// never softer, since the failure mode is generic drift, not a content
// policy false-positive.
export function buildReferencePrompt(reference, worldBible, softenLevel = 0, repairNote = "") {
  const roleCopy = REF_ROLE_COPY[reference.role] || "a clean reference image for this story";
  const franchiseCorrection = repairNote
    ? [`CRITICAL CORRECTION (a previous attempt at this exact reference was rejected for looking generic/off-brand): ${repairNote}`,
       `This MUST unmistakably read as the real ${worldBible?.franchise || "named franchise"} — real character identities, colors, and locations, and the franchise's real construction/rendering system. Do not invent a substitute.`]
    : [];
  const text = softenLevel >= 2
    ? [
      `Single-subject reference image: ${roleCopy}.`,
      `SUBJECT: ${reference.label}, shown plainly and neutrally.`,
      worldBible?.visualStyle ? `RENDERING STYLE: ${worldBible.visualStyle}.` : "",
      "Calm, static, non-dramatic presentation.",
      "No text, no captions, no watermark, no logo. This is a clean reference asset, not a finished movie frame.",
    ].filter(Boolean).join("\n")
    : softenLevel === 1
    ? [
      `Single-subject reference image: ${roleCopy}.`,
      `SUBJECT: ${reference.label}.`,
      `VISUAL LOCK (must stay identical every time this subject is reused): ${reference.visualLock}`,
      worldBible?.visualStyle ? `RENDERING STYLE: ${worldBible.visualStyle}.` : "",
      "Understated, clearly non-violent, non-intimate presentation.",
      "No text, no captions, no watermark, no logo. This is a clean reference asset, not a finished movie frame.",
    ].filter(Boolean).join("\n")
    : [
      ...franchiseCorrection,
      `Single-subject reference image: ${roleCopy}.`,
      `SUBJECT: ${reference.label}. ${reference.prompt}`,
      `VISUAL LOCK (must stay identical every time this subject is reused): ${reference.visualLock}`,
      worldBible?.franchise ? `FRANCHISE: ${worldBible.franchise}${worldBible?.medium ? ` — real medium/construction: ${worldBible.medium}` : ""}.` : "",
      worldBible?.hardVisualRules?.length ? `FRANCHISE STYLE RULES: ${worldBible.hardVisualRules.join(" ")}` : "",
      worldBible?.negativeRules?.length ? `AVOID: ${worldBible.negativeRules.join(" ")}` : "",
      worldBible?.visualStyle ? `RENDERING STYLE: ${worldBible.visualStyle}.` : "",
      worldBible?.styleDirective ? `SELECTED STYLE INTERPRETATION (${worldBible.styleMode || "auto"}): ${worldBible.styleDirective}` : "",
      "No text, no captions, no watermark, no logo. This is a clean reference asset, not a finished movie frame.",
    ].filter(Boolean).join("\n");
  return sanitizeThirtyDaysPrompt(text);
}

export async function generateReferenceImage({ generationId, reference, worldBible, quality = DEFAULT_QUALITY_TIER, softenLevel = 0, repairNote = "" }) {
  const tier = tierFor(quality);
  return createImageJobSimple({
    subject: buildReferencePrompt(reference, worldBible, softenLevel, repairNote),
    toolKey: tier.referenceToolKey ?? REFERENCE_IMAGE.toolKey,
    size: `${tier.referenceWidth ?? REFERENCE_IMAGE.width}x${tier.referenceHeight ?? REFERENCE_IMAGE.height}`,
    width: tier.referenceWidth ?? REFERENCE_IMAGE.width,
    height: tier.referenceHeight ?? REFERENCE_IMAGE.height,
    refImages: [],
    expectedRefSlotCount: 0,
    skipCreditCheck: true,
    billingReservation: { template: "thirty-days", generationId, assetKey: `reference:${reference.id}` },
  });
}

// A persistent-reference edit is deliberately a single image-to-image job.
// The source card is forwarded as both the provider's init image and its only
// reference slot, so the model sees the exact asset the user is editing rather
// than reconstructing it from the series bible alone.
export function buildReferenceEditPrompt(reference, editInstruction, worldBible) {
  return sanitizeThirtyDaysPrompt([
    "EDIT THE SUPPLIED REFERENCE IMAGE. Treat it as the exact source asset.",
    `REFERENCE SUBJECT: ${reference.label}. ${reference.visualLock || ""}`,
    `REQUESTED EDIT: ${String(editInstruction || "").trim()}`,
    "Make only the requested change. Preserve every unrelated subject, identity, species, form, colors, markings, clothing, pose, composition, camera, background, and rendering style from the source image.",
    worldBible?.visualStyle ? `RENDERING STYLE: ${worldBible.visualStyle}.` : "",
    "No text, captions, labels, watermark, logo, UI, split panels, collage, or extra variants. Return one clean edited image.",
  ].filter(Boolean).join("\n"));
}

export async function editReferenceImage({ generationId, reference, worldBible, quality = DEFAULT_QUALITY_TIER, editInstruction }) {
  if (!reference?.imageUrl) throw new Error("The original reference image is unavailable");
  const tier = tierFor(quality);
  return createImageJobSimple({
    subject: buildReferenceEditPrompt(reference, editInstruction, worldBible),
    toolKey: tier.referenceToolKey ?? REFERENCE_IMAGE.toolKey,
    size: `${tier.referenceWidth ?? REFERENCE_IMAGE.width}x${tier.referenceHeight ?? REFERENCE_IMAGE.height}`,
    width: tier.referenceWidth ?? REFERENCE_IMAGE.width,
    height: tier.referenceHeight ?? REFERENCE_IMAGE.height,
    initImageUrls: [reference.imageUrl],
    refImages: [reference.imageUrl],
    expectedRefSlotCount: 1,
    skipCreditCheck: true,
    billingReservation: { template: "thirty-days", generationId, assetKey: `reference:${reference.id}` },
  });
}

// Providers occasionally flag entirely innocuous action/conflict scenes as
// "explicit content" — same false-positive risk AI Fruit Story mitigates for
// its own image prompts. Softening the handful of words most likely to read
// as violent/intimate out of context costs nothing when they're absent, and
// avoids re-submitting the exact same prompt that already got rejected once.
const CONTENT_SANITIZE_MAP = [
  [/\bkill(?:ing|ed|s)?\b/gi, "defeat"],
  [/\bblood(?:y)?\b/gi, "battle-worn"],
  [/\bviolent(?:ly)?\b/gi, "intense"],
  [/\battack(?:ing|ed|s)?\b/gi, "confront"],
  [/\bweapon(?:s)?\b/gi, "gear"],
  [/\bnaked\b/gi, "unarmored"],
  [/\bseduct\w*\b/gi, "persuade"],
  [/\bsensual(?:ly)?\b/gi, "graceful"],
  [/\bintimate(?:ly)?\b/gi, "close"],
  [/\bstrip(?:ped|ping)?\b/gi, "unequip"],
];
function sanitizeThirtyDaysPrompt(text) {
  return CONTENT_SANITIZE_MAP.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), String(text || ""));
}

// ── Scene generation ─────────────────────────────────────────────────────────
// Explains every collage panel by the reference's actual role/label so the
// image model is told exactly what each panel means — never hardcoded.
// scopeNotes (planner-authored, per scene: [{referenceId, onlyUse}]) is the
// fix for a shared cast/style reference bleeding its whole group into a
// scene that only needs one member of it — references are an identity
// library, not a cast requirement, so when the planner says a scene only
// needs one name out of a multi-person reference photo, that panel's
// explanation must say so explicitly instead of leaving the model to assume
// everyone shown belongs in this shot.
export function buildCollageExplanation(referenceIds, referencesById, scopeNotes = []) {
  const refs = referenceIds.map((id) => referencesById.get(id)).filter(Boolean);
  const scopeByRefId = new Map((scopeNotes || []).filter((note) => note?.referenceId).map((note) => [note.referenceId, note.onlyUse || []]));
  const scopeLine = (ref) => {
    const onlyUse = scopeByRefId.get(ref.id);
    return onlyUse?.length ? ` This reference image may show more than one character — for THIS shot, use ONLY ${onlyUse.join(", ")}'s design from it. Do not include any other character shown in this reference.` : "";
  };
  if (refs.length <= 1) {
    const only = refs[0];
    return only ? `The supplied source is identity material for ${only.label}: ${only.visualLock}. Preserve the subject only. Ignore the source layout completely and do not copy its pose, background, camera angle, crop, composition, or lighting.${scopeLine(only)}`.trim() : "";
  }
  const panelLines = refs.map((ref, index) =>
    `Source identity ${index + 1} is for ${ref.label} (${ref.role.replace(/_/g, " ")}) — preserve only the subject's canonical identity and locked traits: ${ref.visualLock}.${scopeLine(ref)} Do NOT copy its pose, background, camera angle, crop, composition, lighting, or staging.`
  );
  return [
    `The supplied source image contains identity material only, not a layout or shot to imitate. Study each required subject separately, then discard the source layout and build the new shot entirely from the scene story below.`,
    ...panelLines,
  ].join("\n");
}

function referenceWords(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((word) => word.length >= 3));
}

export function selectSceneReferenceIds(scene, referencesById) {
  const locationWords = referenceWords(scene.location);
  const characterWords = referenceWords((scene.characters || []).join(" "));
  const propWords = referenceWords((scene.requiredProps || []).join(" "));
  const requiredEntities = new Set(["protagonist", ...(scene.requiredEntities || [])]);
  const overlaps = (source, target) => [...source].some((word) => target.has(word));
  return (scene.referenceIds || []).filter((id) => {
    const ref = referencesById.get(id);
    if (!ref) return false;
    const identityWords = referenceWords(`${ref.label || ""} ${ref.visualLock || ""}`);
    if (String(ref.role).startsWith("environment")) return overlaps(identityWords, locationWords);
    if (requiredEntities.has(ref.entityId) || id === "you" || ["protagonist", "pov_hands"].includes(ref.role)) return true;
    if (["artifact", "vehicle"].includes(ref.role)) return overlaps(identityWords, propWords);
    if (["companion", "antagonist", "core_cast_style"].includes(ref.role)) return overlaps(identityWords, characterWords);
    return false;
  }).slice(0, 4);
}

// softenLevel escalates after a provider content-policy rejection on the
// image itself: 0 = normal (LLM's full imagePrompt/action wording, lightly
// sanitized), 1 = drop the LLM's own prose and character-interaction framing,
// describe only the bare visual event, 2 = keep the same story beat but render
// it as calm, non-sensitive action. Even the final fallback must remain a
// distinct episode shot; it must never collapse into a reusable group pose.
export function buildSceneImagePrompt({ scene, worldBible, referencesById, cameraMode, softenLevel = 0, repairNote = "", previousEpisodeEndingImageUrl = null }) {
  const selectedReferenceIds = selectSceneReferenceIds(scene, referencesById);
  const collageExplanation = buildCollageExplanation(selectedReferenceIds, referencesById, scene.referenceScopeNotes || []);
  // Only meaningful for an episode's first scene, and only when the model
  // actually said this episode continues directly from the last one — never
  // claim continuity the plan itself doesn't declare.
  const continuityNote = previousEpisodeEndingImageUrl && Number(scene.index) === 0
    ? `PREVIOUS EPISODE'S EXACT ENDING (a separate reference image, attached after the identity references): this is the literal last rendered frame of the previous episode. This new scene continues from that exact moment — match the character positions, action-in-progress, framing, and environment as closely as the story requires; do not reset to a fresh establishing shot. Use it for continuity of physical state only, never for character identity (the identity references above are still authoritative for that).`
    : "";
  const shotType = scene.shotType && cameraMode !== "first_person" ? scene.shotType : null;
  const cameraLine = cameraMode === "first_person"
    ? "Camera: strict first-person POV — the viewer's own hands/body only, matching the pov_hands reference exactly. Never show the protagonist from outside."
    : shotType === "pov" ? "Camera: first-person POV for this shot only — the viewer's own hands/body, matching the pov reference exactly."
    : shotType === "over_shoulder" ? "Camera: over-the-shoulder — framed from just behind/beside the protagonist, looking at who/what they're facing."
    : shotType === "wide_action" ? "Camera: wide shot capturing the full action and environment, not a close portrait."
    : shotType === "close_up" ? "Camera: close-up on a face or reaction — tight, emotional framing, not a wide group shot."
    : shotType === "tracking" ? "Camera: tracking/moving perspective following the subject through the environment."
    : "Camera: third-person cinematic framing.";
  const sharedHeader = [
    `CREATE THIS EXACT NEXT STORY SHOT — the scene story controls the image; references only preserve identity.`,
    `OUTPUT CONTRACT (MANDATORY): return exactly ONE continuous full-frame image showing ONE moment from ONE camera. Never create a comic page, manga page, storyboard, contact sheet, split screen, diptych, triptych, collage, grid, inset frame, sequential panels, repeated poses, or multiple variations inside the image.`,
    `CANVAS INTEGRITY (MANDATORY): use one uninterrupted 9:16 canvas depicting one contiguous place and instant in time. Never divide the image horizontally or vertically, stack strips, place a mini-shot above/below/beside another shot, or show an establishing view plus a second action view in the same output.`,
    `ZERO TYPOGRAPHY CONTRACT (MANDATORY): the image contains no readable or pseudo-readable words, letters, numbers, subtitles, dialogue, speech bubbles, title cards, day/location labels, lower thirds, logos, watermarks, UI, HUD, or interface graphics. Never print the scene title, day, location, character name, or story text. Any paper, sign, door plaque, book, map, monitor, or device must be blank or use only indistinct non-linguistic marks.`,
    `DAY ${scene.day} — ${scene.title}.`,
    `LOCATION (must visibly read as this place, not a reference background): ${scene.location}. ${scene.timeOfDay ? `TIME: ${scene.timeOfDay}.` : ""}`,
    `STARTING SITUATION: ${scene.startState || scene.continuityFromPrevious || scene.storyDevelopment || ""}`,
    continuityNote,
    `ONE OBVIOUS MAIN ACTION: ${scene.mainAction || scene.visualEvent || scene.protagonistAction || ""}`,
    `VISIBLE REACTION/CONSEQUENCE: ${scene.reaction || scene.endState || ""}`,
    `LAND ON THIS END STATE: ${scene.endState || scene.setupForNext || ""}`,
    cameraLine,
    scene.camera ? `SPECIFIC FRAMING: ${scene.camera}.` : "",
    scene.characters?.length ? `ONLY THESE CHARACTERS ARE PRESENT: ${scene.characters.join(", ")}. Every listed character must be clearly visible and recognizable; do not add the rest of the franchise cast.` : "",
    `CAST-INTEGRITY CONTRACT: every depicted character must remain their own exact identity, species/form, anatomy, clothing, and role from the bound source reference. Never make one character masquerade as another, transfer a character's outfit/uniform/body to another character, turn a creature/mascot into a humanlike stand-in, or invent extra cast. The sole exception is a transformation or costume change explicitly required by this scene story.`,
    scene.requiredProps?.length ? `REQUIRED PROPS: ${scene.requiredProps.join(", ")}.` : "",
    scene.forbiddenEntities?.length ? `FORBIDDEN ENTITIES: ${scene.forbiddenEntities.join(", ")}. None may appear.` : "",
    `WORLD: ${worldBible?.world || ""}. STYLE: ${worldBible?.visualStyle || ""}.`,
    worldBible?.hardVisualRules?.length ? `FRANCHISE STYLE RULES (mandatory): ${worldBible.hardVisualRules.join(" ")}` : "",
    worldBible?.negativeRules?.length ? `AVOID: ${worldBible.negativeRules.join(" ")}` : "",
    worldBible?.styleDirective ? `SELECTED STYLE INTERPRETATION (${worldBible.styleMode || "auto"}): ${worldBible.styleDirective}` : "",
    worldBible?.viewerProtagonist ? `VIEWER PROTAGONIST (the story's mandatory central identity): ${worldBible.viewerProtagonist.identity}. VISUAL IDENTITY: ${worldBible.viewerProtagonist.visualIdentity}. Keep this exact YOU-character compositionally important.` : "",
    scene.requiredEntities?.length ? `REQUIRED ENTITY IDS: ${scene.requiredEntities.join(", ")}. Every one must match its bound reference; never substitute another entity.` : "",
    collageExplanation ? `IDENTITY REFERENCES — apply only after composing the story shot above:\n${collageExplanation}` : "",
    `COMPOSITION DIVERSITY: create a genuinely new movie/cartoon shot for this moment. Do not repeat a previous scene's pose, staging, subject placement, horizon/background layout, lens, or camera height. Adjacent scenes may share continuity, but the framing and visible action must progress.`,
    repairNote ? `PREVIOUS IMAGE WAS REJECTED — correct this specifically: ${repairNote}. Change the composition/camera/staging decisively while preserving required identities.` : "",
  ];
  const text = softenLevel >= 2
    ? [
      ...sharedHeader,
      `SCENE: a calm, non-sensitive version of this exact story beat: ${scene.mainAction || scene.visualEvent || scene.storyDevelopment || "the planned scene action"}. Preserve the specified location, character placement, and consequence. Show one simple physical action and one readable reaction; never arrange the cast as a posed group portrait.`,
      "The viewer protagonist is the through-line, never a tiny background extra.",
      "Describe an actual frame from a movie — clear visual hierarchy, foreground/background depth, strong composition, high detail.",
      "ONE SINGLE UNDIVIDED FRAME. FINAL OUTPUT CHECK: one 9:16 full-bleed frame and ZERO visible typography of any kind. No panels, borders, captions, subtitles, labels, title/location cards, speech bubbles, logos, watermarks, UI, letters, or numbers.",
    ].filter(Boolean).join("\n")
    : softenLevel === 1
    ? [
      ...sharedHeader,
      `SCENE, described in general and understated terms: ${scene.visualEvent}`,
      "The viewer protagonist is the through-line, never a tiny background extra. Keep the action understated and clearly non-violent, non-intimate.",
      "Describe an actual frame from a movie — clear visual hierarchy, foreground/background depth, strong composition, high detail.",
      "ONE SINGLE UNDIVIDED FRAME. FINAL OUTPUT CHECK: one 9:16 full-bleed frame and ZERO visible typography of any kind. No panels, borders, captions, subtitles, labels, title/location cards, speech bubbles, logos, watermarks, UI, letters, or numbers.",
    ].filter(Boolean).join("\n")
    : [
      ...sharedHeader,
      `SCENE: ${scene.storyDevelopment}`,
      `YOU ACTION (must be clearly visible or unmistakably implied): ${scene.protagonistAction || scene.storyDevelopment}`,
      `VISUAL EVENT (must be clearly depicted): ${scene.visualEvent}`,
      scene.imagePrompt,
      "The viewer protagonist is the through-line, never a tiny background extra. Show canon characters interacting with YOU rather than replacing YOU as the scene lead.",
      "Describe an actual frame from a movie — clear visual hierarchy, foreground/background depth, strong composition, high detail.",
      "ONE SINGLE UNDIVIDED FRAME. FINAL OUTPUT CHECK: one 9:16 full-bleed frame and ZERO visible typography of any kind. No panels, borders, captions, subtitles, labels, title/location cards, speech bubbles, logos, watermarks, UI, letters, or numbers.",
    ].filter(Boolean).join("\n");
  return sanitizeThirtyDaysPrompt(text);
}

export async function generateSceneImage({ generationId, scene, worldBible, referencesById, collageUrl, cameraMode, quality = DEFAULT_QUALITY_TIER, softenLevel = 0, repairNote = "", previousEpisodeEndingImageUrl = null }) {
  const tier = tierFor(quality);
  const refImages = [collageUrl, Number(scene.index) === 0 ? previousEpisodeEndingImageUrl : null].filter(Boolean);
  return createImageJobSimple({
    subject: buildSceneImagePrompt({ scene, worldBible, referencesById, cameraMode, softenLevel, repairNote, previousEpisodeEndingImageUrl }),
    toolKey: tier.imageToolKey,
    size: `${tier.imageWidth}x${tier.imageHeight}`,
    width: tier.imageWidth,
    height: tier.imageHeight,
    refImages,
    expectedRefSlotCount: refImages.length,
    skipCreditCheck: true,
    billingReservation: { template: "thirty-days", generationId, assetKey: `scene:${scene.index}:image` },
  });
}

// Lightweight vision QA gate — catches catastrophic style drift or a missing
// protagonist/franchise identity BEFORE spending video credits animating a
// bad still. Cheap and non-authoritative on its own: the caller retries the
// image once on a fail, then proceeds regardless (see spec — never block the
// whole generation on one subjective judgment), but the result is always
// surfaced to the debug reference panel, never silently discarded.
export async function checkThirtyDaysSceneQA({ generationId, imageUrl, scene, worldBible, referencesById, previousSceneImages = [] }) {
  const expectedReferences = (scene.requiredEntities || []).map((entityId) => {
    const reference = [...(referencesById?.values?.() || [])].find((ref) => ref.entityId === entityId && ref.imageUrl);
    return reference ? { entityId, referenceId: reference.id, label: reference.label, visualLock: reference.visualLock, imageUrl: reference.imageUrl } : null;
  }).filter(Boolean);
  const { data, error } = await supabase.functions.invoke("thirty-days-scene-qa", {
    body: {
      generationId,
      imageUrl,
      scene: { index: scene.index, title: scene.title, location: scene.location, characters: scene.characters, visualEvent: scene.visualEvent, mainAction: scene.mainAction, reaction: scene.reaction, camera: scene.camera, shotType: scene.shotType, protagonistAction: scene.protagonistAction },
      requiredEntities: scene.requiredEntities || [],
      forbiddenEntities: scene.forbiddenEntities || [],
      requiredProps: scene.requiredProps || [],
      expectedReferences,
      previousSceneImages: previousSceneImages.slice(-3),
      worldBible: {
        franchise: worldBible?.franchise,
        characters: worldBible?.characters,
        creatures: worldBible?.creatures,
        viewerProtagonist: worldBible?.viewerProtagonist,
        styleMode: worldBible?.styleMode,
        styleDirective: worldBible?.styleDirective,
        visualStyle: worldBible?.visualStyle,
      },
    },
  });
  if (error) {
    // A QA outage must never block generation — treat as "usable, unchecked".
    console.warn("[thirty-days] scene QA unavailable:", error);
    return { usable: true, reason: "qa_unavailable" };
  }
  return data;
}

// Franchise-identity check for a persistent reference — catches the "generic
// inspired-by substitute" failure mode (e.g. LEGO Ninjago rendered as generic
// anime ninjas) before it gets locked in and reused across the whole series.
// Same fail-open contract as scene QA: an outage never blocks generation.
export async function checkThirtyDaysReferenceQA({ generationId, imageUrl, reference, worldBible }) {
  const { data, error } = await supabase.functions.invoke("thirty-days-reference-qa", {
    body: {
      generationId,
      imageUrl,
      reference: { label: reference.label, role: reference.role, prompt: reference.prompt, visualLock: reference.visualLock },
      worldBible: {
        franchise: worldBible?.franchise,
        confidence: worldBible?.confidence,
        medium: worldBible?.medium,
        styleMode: worldBible?.styleMode,
        styleDirective: worldBible?.styleDirective,
        visualStyle: worldBible?.visualStyle,
      },
    },
  });
  if (error) {
    console.warn("[thirty-days] reference QA unavailable:", error);
    return { usable: true, reason: "qa_unavailable" };
  }
  return data;
}

// softenLevel escalates across automatic retry attempts after a provider
// content-moderation rejection: 0 = normal (LLM's full videoPrompt, lightly
// sanitized), 1 = drop the LLM's narrative wording entirely and describe only
// the bare visual event, 2 = drop the visual event's specific wording too and
// fall back to fully generic ambient motion — the safest prompt that still
// produces a moving clip from the still image.
export function buildSceneVideoPrompt(scene, durationSec = SCENE_DURATION_SEC, softenLevel = 0, nextScene = null, cameraMode = null) {
  const firstPerson = cameraMode === "first_person" || scene?.shotType === "pov";
  const immutableContract = [
    "IDENTITY LOCK — FIRST FRAME THROUGH FINAL FRAME: every visible person, creature, and object remains the exact same identity, species, evolutionary form, anatomy, colors, markings, clothing, and accessories shown in the source still. Motion and fighting are physical movement only. Never evolve, transform, morph, mutate, replace, fuse, duplicate, or introduce a new character/creature unless the scene explicitly requests that transformation.",
    "ZERO TYPOGRAPHY THROUGHOUT: never generate subtitles, captions, dialogue text, speech bubbles, title/day/location cards, lower thirds, labels, logos, watermarks, UI/HUD, or readable letters/numbers. If the source still contains accidental text, do not animate, rewrite, reveal, emphasize, or move toward it; keep it indistinct and out of attention.",
    "SOURCE-STILL CONTRACT: treat the supplied still as immutable frame zero and the identity reference for the entire clip. Preserve subject count and identity through the final frame; do not add random people or creatures.",
    "CAST-FORMAT LOCK: the source still is one shot with one cast. Through the final frame, no subject may become another character, borrow another character's clothing/body/species, become a humanlike stand-in, or change role. Keep the same single-camera visual format; never introduce a panel, cutaway, split screen, montage, or new shot.",
    "FINAL-FRAME CHECK: the last frame must still visibly contain the same source cast, identities, species/forms, wardrobe, viewpoint, and environment. The only allowed change is the requested physical action/reaction — never a semantic identity or camera-format change.",
    firstPerson ? "POV LOCK: remain strict first-person POV for the entire clip, including the final frame. The protagonist may appear only as the same hands/arms or body cues visible in the source. Never cut, orbit, pull back, reflect, or reveal a third-person face, body, back, avatar, or stand-in." : "CAMERA LOCK: preserve the intended camera grammar and never invent a viewpoint change that reveals a new protagonist.",
  ];
  const text = softenLevel >= 2
    ? [
      `Animate this still into a silent ${durationSec}-second clip. No dialogue, no on-screen text, no captions, no background music.`,
      "Gentle, natural ambient motion matching the still's framing exactly: subtle camera drift, natural environmental movement (wind, light, small background motion), characters shifting weight or breathing naturally.",
      "Keep every character and the environment exactly as shown in the still — do not add new action.",
      ...immutableContract,
    ].join("\n")
    : softenLevel === 1
    ? [
      `Animate this still into a silent ${durationSec}-second clip. No dialogue, no lip-sync, no on-screen text, no captions, no background music.`,
      `The clip should depict, in general terms: ${scene.visualEvent}.`,
      "Natural camera movement, natural character/environment motion matching the still's framing and identity exactly. Keep the action understated and clearly non-violent, non-intimate.",
      ...immutableContract,
    ].join("\n")
    : [
      `Animate this still into a silent ${durationSec}-second clip. No dialogue, no lip-sync, no on-screen text, no captions, no background music.`,
      `START: ${scene.startState || scene.continuityFromPrevious || "match the still exactly"}`,
      `ACTION: ${scene.mainAction || scene.visualEvent || scene.videoPrompt}`,
      `REACTION: ${scene.reaction || "show the visible consequence in the characters or environment"}`,
      `END: ${scene.endState || nextScene?.startState || "land on a clear changed state"}`,
      nextScene?.startState ? `NEXT-SCENE HANDOFF: end in the physical situation required by the next clip: ${nextScene.startState}` : "FINAL HANDOFF: hold the episode-ending state.",
      "Natural camera movement, natural character/environment motion matching the still's framing and identity exactly.",
      ...immutableContract,
    ].filter(Boolean).join("\n");
  return sanitizeThirtyDaysPrompt(text);
}

export async function animateScene({ generationId, scene, nextScene = null, imageUrl, quality = DEFAULT_QUALITY_TIER, paidRetry = false, softenLevel = 0, cameraMode = null }) {
  const tier = tierFor(quality);
  return createVideoJobSimple({
    subject: buildSceneVideoPrompt(scene, tier.videoDurationSec, softenLevel, nextScene, cameraMode),
    toolKey: tier.videoToolKey,
    width: tier.videoWidth,
    height: tier.videoHeight,
    durationSec: tier.videoDurationSec,
    initImageUrls: [imageUrl],
    calculatedCredits: tier.videoCredits,
    withSound: false,
    // The initial child job is covered by the generation reservation. A
    // manual retry happens after settlement (the failed clip was refunded),
    // so it is submitted as a normal 6-credit job instead of pretending the
    // closed reservation is still active. The paid price comes from the same
    // server-backed tier row used to create the immutable asset reservation.
    skipCreditCheck: !paidRetry,
    billingReservation: paidRetry ? undefined : { template: "thirty-days", generationId, assetKey: `scene:${scene.index}:video` },
  });
}

// ── Frame capture for the vision script writer ───────────────────────────────
// Generalized from AI Cooking Matic's captureCookingSpeechFrames: any clip
// array, any sample count/positions, any clip duration.
export function captureClipFrames(clip, sampleSecondsFn) {
  return new Promise((resolve) => {
    if (!clip?.videoUrl) return resolve([]);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.src = clip.videoUrl;

    const frames = [];
    let cancelled = false;
    const cleanup = () => { video.src = ""; video.remove(); };
    const finish = () => { if (!cancelled) { cancelled = true; cleanup(); resolve(frames); } };
    const timeout = setTimeout(finish, 8000);

    video.addEventListener("loadedmetadata", async () => {
      const duration = Number.isFinite(video.duration) ? video.duration : SCENE_DURATION_SEC;
      const times = sampleSecondsFn(duration);
      const canvas = document.createElement("canvas");
      canvas.width = 180; canvas.height = 320;
      const ctx = canvas.getContext("2d", { alpha: false });

      for (let i = 0; i < times.length; i += 1) {
        const t = Math.min(times[i], Math.max(0, duration - 0.05));
        await new Promise((seeked) => {
          const onSeeked = () => { video.removeEventListener("seeked", onSeeked); seeked(); };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = t;
        });
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push({ sampleIndex: i + 1, timeSec: t, imageUrl: canvas.toDataURL("image/jpeg", 0.58) });
        } catch { /* frame not readable — skip */ }
      }
      clearTimeout(timeout);
      finish();
    }, { once: true });
    video.addEventListener("error", () => { clearTimeout(timeout); finish(); }, { once: true });
  });
}

export async function captureThirtyDaysFrames(clips) {
  const sorted = [...clips].filter((c) => c.videoUrl).sort((a, b) => a.index - b.index).slice(0, SCENE_COUNT);
  const sampleSecondsFn = (duration) => [duration * 0.18, duration * 0.5, duration * 0.82];
  const results = await Promise.all(sorted.map(async (clip) => {
    const frames = await captureClipFrames(clip, sampleSecondsFn);
    return frames.map((frame) => ({ clip: clip.index + 1, ...frame }));
  }));
  return results.flat();
}

export async function fetchThirtyDaysScript({ generationId, universe, premise, hook, scenes, clips, clipPrompts, clipFrames, visualDurationSec, shortenFrom, expandFrom, forceRegenerate = false, previousNarration = "", voiceId = "", seriesContext = null }) {
  const { data, error } = await supabase.functions.invoke("thirty-days-script", {
    body: {
      generationId, universe, premise, hook,
      scenes: scenes.map((s) => ({
        index: s.index,
        day: s.day,
        dayScene: s.dayScene,
        title: s.title,
        beatType: s.beatType,
        protagonistAction: s.protagonistAction,
        storyDevelopment: s.storyDevelopment,
      })),
      clips: clips.map((c) => ({ index: c.index, videoUrl: c.videoUrl, durationSec: c.durationSec })),
      clipPrompts,
      clipFrames,
      visualDurationSec,
      shortenFrom,
      expandFrom,
      forceRegenerate,
      previousNarration,
      voiceId,
      ...(seriesContext || {}),
    },
  });
  if (error) throw new Error(await resolveFunctionErrorMessage(error, "Script writing failed"));
  return data;
}

// Real per-provider clip duration can drift from the requested 5s (5.0-6.0s
// depending on model), so the stitched runtime and TTS timing must be based
// on what actually rendered, never assumed.
export function probeClipDuration(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.onloadedmetadata = () => { resolve(Number.isFinite(video.duration) ? video.duration : SCENE_DURATION_SEC); video.remove(); };
    video.onerror = () => { resolve(SCENE_DURATION_SEC); video.remove(); };
    video.src = url;
  });
}

// ── Voice ─────────────────────────────────────────────────────────────────
export async function previewThirtyDaysVoice({ voiceId, universe, generationId }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/thirty-days-voice-preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ voice: voiceId, universe, generationId }),
  });
  if (!response.ok) throw new Error("Voice preview failed");
  return response.blob();
}

export async function generateThirtyDaysVoice({ voiceId, script, generationId }) {
  const { data, error } = await supabase.functions.invoke("thirty-days-voice-generate", {
    body: { voice: voiceId, script, generationId },
  });
  if (error) throw new Error(await resolveFunctionErrorMessage(error, "Voice generation failed"));
  return data;
}

export function thirtyDaysVoicePlaybackRate(sourceDurationSec, targetDurationSec = SCENE_COUNT * SCENE_DURATION_SEC) {
  if (!sourceDurationSec || !targetDurationSec) return 1;
  return Math.max(0.85, Math.min(1.15, sourceDurationSec / targetDurationSec));
}

export async function saveNarrationToGeneration({ generationId, voiceId, voiceLabel, script, audioBlob, durationSec, playbackRate = 1, captionScript = null }) {
  if (!generationId || !audioBlob) return null;
  const file = new File([audioBlob], `narration-${generationId}.mp3`, { type: audioBlob.type || "audio/mpeg" });
  const { url: audioUrl } = await uploadForExternalFetch(file, { prefix: "thirty-days-voice" }, true);
  const take = { voiceId, voiceLabel, script, audioUrl, durationSec, playbackRate, captionScript, createdAt: new Date().toISOString() };
  const hook = String(captionScript?.hook || "").trim();
  const narration = String(captionScript?.narration || script).trim();
  const { data, error } = await supabase.rpc("save_thirty_days_narration_draft", {
    p_generation_id: generationId,
    p_hook: hook,
    p_narration: narration,
    p_narration_take: take,
    p_episode_title: captionScript?.episodeTitle || null,
    p_cliffhanger_thread: captionScript?.cliffhangerThread || null,
    p_day_split_after_scene: captionScript?.daySplitAfterScene || null,
  });
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

export async function saveThirtyDaysNarrationDraft({ generationId, hook, narration, voiceId, captionScript }) {
  if (!generationId) return null;
  const script = `${String(hook || "").trim()} ${String(narration || "").trim()}`.trim();
  const draft = {
    draft: true,
    hook: String(hook || "").trim(),
    narration: String(narration || "").trim(),
    script,
    voiceId,
    captionScript: captionScript || null,
    audioUrl: null,
    createdAt: new Date().toISOString(),
  };
  const { data, error } = await supabase.rpc("save_thirty_days_narration_draft", {
    p_generation_id: generationId,
    p_hook: draft.hook,
    p_narration: draft.narration,
    p_narration_take: draft,
    p_episode_title: captionScript?.episodeTitle || null,
    p_cliffhanger_thread: captionScript?.cliffhangerThread || null,
    p_day_split_after_scene: captionScript?.daySplitAfterScene || null,
  });
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

// ── Progress persistence / lifecycle ─────────────────────────────────────────
export async function updateThirtyDaysProgress({ generationId, status, visualReferences = [], scenes = [] }) {
  if (!generationId) return null;
  const { data, error } = await supabase
    .from("thirty_days_generations")
    .update({ status, visual_references: visualReferences, scenes, updated_at: new Date().toISOString() })
    .eq("id", generationId)
    .select()
    .single();
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

export async function syncThirtyDaysAssets(generationId) {
  const { data, error } = await supabase.rpc("sync_thirty_days_generation_assets", {
    p_generation_id: generationId,
  });
  if (error) throw error;
  return data ?? [];
}

// Rebuild the client-facing reference/scenes projection from the immutable
// reservation assets and jobs. It is intentionally a recovery only: it never
// submits a provider request or spends another credit.
export async function recoverThirtyDaysGeneration(generationId) {
  if (!generationId) return null;
  const { data, error } = await supabase.rpc("recover_thirty_days_generation", {
    p_generation_id: generationId,
  });
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

export async function recordThirtyDaysSceneQA({ generationId, sceneIndex, jobId, usable, reason }) {
  const { data, error } = await supabase.rpc("record_thirty_days_scene_qa", {
    p_generation_id: generationId,
    p_scene_index: sceneIndex,
    p_job_id: jobId,
    p_usable: Boolean(usable),
    p_reason: String(reason || (usable ? "passed" : "qa_failed")).slice(0, 500),
  });
  if (error) throw error;
  return data;
}

export async function settleThirtyDaysGeneration({ generationId }) {
  if (!generationId) return null;
  const { data, error } = await supabase.rpc("settle_thirty_days_generation", {
    p_generation_id: generationId,
  });
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

export async function updateThirtyDaysFullVideo({ generationId, fullVideoUrl }) {
  if (!generationId) return null;
  const { data, error } = await supabase
    .from("thirty_days_generations")
    .update({ full_video_url: fullVideoUrl, status: "completed", updated_at: new Date().toISOString() })
    .eq("id", generationId)
    .select()
    .single();
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

export async function getThirtyDaysGeneration(generationId) {
  const { data, error } = await supabase.from("thirty_days_generations").select("*").eq("id", generationId).maybeSingle();
  if (error) throw error;
  return data ? normalizeThirtyDaysGeneration(data) : null;
}

export async function listThirtyDaysGenerations(limit = 8) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("thirty_days_generations")
    .select("*")
    .eq("user_id", user.id)
    // A series' internal setup generation (its one-time reference build) is
    // not a creation a user would want to revisit — only standalone single
    // videos and individual generated episodes belong in this list.
    .neq("generation_mode", "series_setup")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(normalizeThirtyDaysGeneration);
}
