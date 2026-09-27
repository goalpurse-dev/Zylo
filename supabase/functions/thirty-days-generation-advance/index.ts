// deno-lint-ignore-file no-explicit-any
// thirty-days-generation-advance/index.ts
//
// Background worker for 30 Days Series. Everything about this template was
// previously client-driven: the browser tab polled/sequenced every
// reference and scene job itself, so closing the tab mid-generation left
// data intact (nothing is lost) but nothing FURTHER happened until the user
// reopened the app. This function is invoked periodically by pg_cron (see
// 20260827130000_thirty_days_background_advance.sql) and nudges forward any
// series generation that's gone quiet for 90+ seconds, independent of
// whether any browser tab is open.
//
// Deliberately incremental, not a full replay of the client's rich
// escalation logic: each tick does cheap status checks on everything already
// in flight (and immediately reacts — records success/failure, runs QA, one
// repair attempt) but submits at most ONE brand-new job per generation per
// tick. A 7-scene episode takes on the order of a dozen ticks (roughly a
// dozen minutes at the recommended 1-minute schedule) to fully materialize —
// that's an acceptable trade for a function that must stay fast and never
// time out. Two known, disclosed simplifications versus the live client
// path: (1) no multi-panel reference collage — a scene image uses its first
// resolved reference directly, since collage compositing needs a browser
// canvas; (2) no content-policy softenLevel escalation ladder — one QA
// repair attempt covers franchise-identity drift, but a raw provider safety
// rejection is left for the user to retry manually when they reopen the app.
// Narration/final-video stitching is NOT part of this worker at all: an
// episode is considered done once all 7 scene videos succeed (narration is
// optional, added later by the user — see complete_thirty_days_series_episode).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildVideoContinuityPrompt, verifyEpisodeFromRenderedScenes } from "../_shared/thirtyDaysSeriesEngine.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const ADVANCE_SECRET = Deno.env.get("THIRTY_DAYS_ADVANCE_SECRET") ?? "";
const MAX_GENERATIONS_PER_TICK = 5;
const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

const reply = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* ============================ Prompt building ============================ */
// Ported from src/components/viral-tools/thirty-days/api/thirtyDaysApi.js —
// duplicated rather than shared since edge functions can't import browser
// client code (it depends on the browser supabase client + DOM/canvas).

const CONTENT_SANITIZE_MAP: [RegExp, string][] = [
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
function sanitizePrompt(text: string) {
  return CONTENT_SANITIZE_MAP.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), String(text || ""));
}

const REF_ROLE_COPY: Record<string, string> = {
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

function buildReferencePrompt(reference: any, worldBible: any, repairNote = "") {
  const roleCopy = REF_ROLE_COPY[reference.role] || "a clean reference image for this story";
  const franchiseCorrection = repairNote
    ? [`CRITICAL CORRECTION (a previous attempt at this exact reference was rejected for looking generic/off-brand): ${repairNote}`,
       `This MUST unmistakably read as the real ${worldBible?.franchise || "named franchise"} — real character identities, colors, and locations, and the franchise's real construction/rendering system. Do not invent a substitute.`]
    : [];
  const text = [
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
  return sanitizePrompt(text);
}

function buildCollageExplanation(referenceIds: string[], referencesById: Map<string, any>) {
  const refs = referenceIds.map((id) => referencesById.get(id)).filter(Boolean);
  if (refs.length <= 1) {
    const only = refs[0];
    return only ? `The supplied source is identity material for ${only.label}: ${only.visualLock}. Preserve the subject only. Ignore the source layout completely and do not copy its pose, background, camera angle, crop, composition, or lighting.` : "";
  }
  const panelLines = refs.map((ref: any, index: number) =>
    `Source identity ${index + 1} is for ${ref.label} (${String(ref.role).replace(/_/g, " ")}) — preserve only the subject's locked traits: ${ref.visualLock}. Do NOT copy its pose, background, camera, composition, or lighting.`
  );
  return [
    `The supplied source image contains identity material only, not a layout or shot to imitate. Study each required subject separately, then discard the source layout and build the new shot entirely from the scene story.`,
    ...panelLines,
  ].join("\n");
}

function selectSceneReferenceIds(scene: any, referencesById: Map<string, any>) {
  const words = (value: any) => new Set(String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((word) => word.length >= 3));
  const locationWords = words(scene.location);
  const characterWords = words((scene.characters || []).join(" "));
  const propWords = words((scene.requiredProps || []).join(" "));
  const requiredEntities = new Set(["protagonist", ...(scene.requiredEntities || [])]);
  const overlaps = (source: Set<string>, target: Set<string>) => [...source].some((word) => target.has(word));
  return (scene.referenceIds || []).filter((id: string) => {
    const ref = referencesById.get(id);
    if (!ref) return false;
    const identityWords = words(`${ref.label || ""} ${ref.visualLock || ""}`);
    if (String(ref.role).startsWith("environment")) return overlaps(identityWords, locationWords);
    if (requiredEntities.has(ref.entityId) || id === "you" || ["protagonist", "pov_hands"].includes(ref.role)) return true;
    if (["artifact", "vehicle"].includes(ref.role)) return overlaps(identityWords, propWords);
    if (["companion", "antagonist", "core_cast_style"].includes(ref.role)) return overlaps(identityWords, characterWords);
    return false;
  }).slice(0, 4);
}

function buildSceneImagePrompt({ scene, worldBible, referencesById, cameraMode, repairNote = "", previousEpisodeEndingImageUrl = null }: any) {
  const collageExplanation = buildCollageExplanation(selectSceneReferenceIds(scene, referencesById), referencesById);
  // Mirrors thirtyDaysApi.js's buildSceneImagePrompt (browser) — only
  // meaningful for an episode's first scene, and only when a previous
  // episode's actual last frame is available to anchor it against.
  const continuityNote = previousEpisodeEndingImageUrl && Number(scene.index) === 0
    ? `PREVIOUS EPISODE'S EXACT ENDING (a separate reference image, attached after the identity references): this is the literal last rendered frame of the previous episode. This new scene continues from that exact moment — match the character positions, action-in-progress, framing, and environment as closely as the story requires; do not reset to a fresh establishing shot. Use it for continuity of physical state only, never for character identity (the identity references above are still authoritative for that).`
    : "";
  const cameraLine = cameraMode === "first_person"
    ? "Camera: strict first-person POV — the viewer's own hands/body only, matching the pov_hands reference exactly. Never show the protagonist from outside."
    : scene.shotType === "pov" ? "Camera: first-person POV for this shot only."
    : scene.shotType === "over_shoulder" ? "Camera: over-the-shoulder from behind/beside the protagonist."
    : scene.shotType === "wide_action" ? "Camera: wide action shot showing movement and environment."
    : scene.shotType === "close_up" ? "Camera: close-up on the key reaction, not a group portrait."
    : scene.shotType === "tracking" ? "Camera: dynamic tracking perspective following the action."
    : "Camera: third-person cinematic framing.";
  const text = [
    `CREATE THIS EXACT NEXT STORY SHOT — story, location, action, and camera control the composition; references preserve identity only.`,
    `OUTPUT CONTRACT (MANDATORY): return exactly ONE continuous full-frame image showing ONE moment from ONE camera. Never create a comic page, manga page, storyboard, contact sheet, split screen, diptych, triptych, collage, grid, inset frame, sequential panels, repeated poses, or multiple variations inside the image.`,
    `CANVAS INTEGRITY (MANDATORY): use one uninterrupted 9:16 canvas depicting one contiguous place and instant in time. Never divide the image horizontally or vertically, stack strips, place a mini-shot above/below/beside another shot, or show an establishing view plus a second action view in the same output.`,
    `ZERO TYPOGRAPHY CONTRACT (MANDATORY): no readable or pseudo-readable words, letters, numbers, subtitles, speech bubbles, title cards, day/location labels, lower thirds, logos, watermarks, UI, HUD, or interface graphics. Never print the scene title/day/location/name. Papers, signs, plaques, books, maps, monitors, and devices must be blank or contain only indistinct non-linguistic marks.`,
    `DAY ${scene.day} — ${scene.title}.`,
    `LOCATION (must visibly read as this place): ${scene.location}. ${scene.timeOfDay ? `TIME: ${scene.timeOfDay}.` : ""}`,
    `STARTING SITUATION: ${scene.startState || scene.continuityFromPrevious || scene.storyDevelopment || ""}`,
    continuityNote,
    `ONE OBVIOUS MAIN ACTION: ${scene.mainAction || scene.visualEvent || scene.protagonistAction || ""}`,
    `VISIBLE REACTION/CONSEQUENCE: ${scene.reaction || scene.endState || ""}`,
    `LAND ON THIS END STATE: ${scene.endState || scene.setupForNext || ""}`,
    cameraLine,
    scene.camera ? `SPECIFIC FRAMING: ${scene.camera}.` : "",
    scene.characters?.length ? `ONLY THESE CHARACTERS ARE PRESENT: ${scene.characters.join(", ")}. Every listed character must be clearly visible and recognizable; do not add the rest of the cast.` : "",
    `CAST-INTEGRITY CONTRACT: every depicted character must remain their own exact identity, species/form, anatomy, clothing, and role from the bound source reference. Never make one character masquerade as another, transfer a character's outfit/uniform/body to another character, turn a creature/mascot into a humanlike stand-in, or invent extra cast. The sole exception is a transformation or costume change explicitly required by this scene story.`,
    scene.requiredProps?.length ? `REQUIRED PROPS: ${scene.requiredProps.join(", ")}.` : "",
    scene.forbiddenEntities?.length ? `FORBIDDEN ENTITIES: ${scene.forbiddenEntities.join(", ")}. None may appear.` : "",
    `WORLD: ${worldBible?.world || ""}. STYLE: ${worldBible?.visualStyle || ""}.`,
    worldBible?.hardVisualRules?.length ? `FRANCHISE STYLE RULES (mandatory): ${worldBible.hardVisualRules.join(" ")}` : "",
    worldBible?.negativeRules?.length ? `AVOID: ${worldBible.negativeRules.join(" ")}` : "",
    worldBible?.styleDirective ? `SELECTED STYLE INTERPRETATION (${worldBible.styleMode || "auto"}): ${worldBible.styleDirective}` : "",
    worldBible?.viewerProtagonist ? `VIEWER PROTAGONIST (the story's mandatory central identity): ${worldBible.viewerProtagonist.identity}. VISUAL IDENTITY: ${worldBible.viewerProtagonist.visualIdentity}. Keep this exact YOU-character compositionally important.` : "",
    scene.requiredEntities?.length ? `REQUIRED ENTITY IDS: ${scene.requiredEntities.join(", ")}. Match every entity to its bound reference; never substitute.` : "",
    collageExplanation ? `IDENTITY REFERENCES — apply only after composing the story shot above:\n${collageExplanation}` : "",
    `COMPOSITION DIVERSITY: make this a genuinely new next shot. Do not repeat previous pose, staging, subject placement, background layout, lens, or camera height.`,
    repairNote || scene.qaReason ? `PREVIOUS IMAGE WAS REJECTED — correct this specifically: ${repairNote || scene.qaReason}. Render only the one requested instant at normal full-frame scale; do not use a before/after, training-step, action-sequence, comparison, or any stacked/split layout. Change composition/camera/staging decisively while preserving identity.` : "",
    `SCENE: ${scene.storyDevelopment}`,
    `YOU ACTION (must be clearly visible or unmistakably implied): ${scene.protagonistAction || scene.storyDevelopment}`,
    `VISUAL EVENT (must be clearly depicted): ${scene.visualEvent}`,
    scene.imagePrompt,
    "The viewer protagonist is the through-line, never a tiny background extra. Show canon characters interacting with YOU rather than replacing YOU as the scene lead.",
    "Describe an actual frame from a movie — clear visual hierarchy, foreground/background depth, strong composition, high detail.",
    "ONE SINGLE UNDIVIDED FRAME. FINAL OUTPUT CHECK: one 9:16 full-bleed frame and ZERO visible typography of any kind. No panels, borders, captions, subtitles, labels, title/location cards, speech bubbles, logos, watermarks, UI, letters, or numbers.",
  ].filter(Boolean).join("\n");
  return sanitizePrompt(text);
}

function buildSceneVideoPrompt(scene: any, nextScene: any, durationSec: number, cameraMode?: string | null) {
  return sanitizePrompt(buildVideoContinuityPrompt(scene, nextScene, durationSec, cameraMode));
}

/* ============================ Job creation ============================ */

function planPriority(planCode?: string | null) {
  const plan = String(planCode || "").toLowerCase().trim();
  if (plan === "generative") return 1;
  if (plan === "pro") return 2;
  if (plan === "starter") return 3;
  return 9;
}

async function dispatchJob(jobId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/job-worker`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
  } catch (error) {
    console.warn("[thirty-days-generation-advance] job-worker dispatch failed", jobId, String(error));
  }
}

async function insertJob(admin: any, params: {
  userId: string; planCode: string; type: "image" | "video"; toolKey: string; subject: string;
  width: number; height: number; durationSec?: number; refImages?: string[];
  generationId: string; assetKey: string;
}) {
  const jobId = crypto.randomUUID();
  const billing_reservation = { template: "thirty-days", generationId: params.generationId, assetKey: params.assetKey };
  const input: any = params.type === "image"
    ? {
      tool: "image", subject: params.subject, style: null, creation_type: "photo", negative: "",
      brand: { id: null, use_palette: false }, init_image_url: null,
      ref_images: params.refImages && params.refImages.length ? params.refImages : undefined,
      width: params.width, height: params.height, billing_reservation,
    }
    : {
      tool: "video", creation_type: "video", subject: params.subject, durationSec: params.durationSec,
      ref_images: params.refImages ?? [], withSound: false,
      width: params.width, height: params.height, billing_reservation,
    };
  const settings: any = {
    tool_key: params.toolKey, size: `${params.width}x${params.height}`, credits: 0, charged: false,
    priceUSD: 0, creation_type: params.type === "image" ? "photo" : "video",
  };
  const { data, error } = await admin.from("jobs").insert({
    id: jobId, user_id: params.userId, type: params.type, tool_key: params.toolKey, project_id: null,
    prompt: params.subject, settings, input, status: "queued", progress: 0,
    charge_credits: 0, charged: false, priority: planPriority(params.planCode), plan_code: params.planCode || "free",
    provider: "runware", attempts: 0, max_attempts: 5, retry_after: new Date().toISOString(),
  }).select("*").single();
  if (error) throw error;
  await dispatchJob(jobId);
  return data;
}

async function getJobRow(admin: any, jobId: string) {
  const { data } = await admin.from("jobs").select("id, status, result_url, error").eq("id", jobId).maybeSingle();
  return data;
}

/* ============================ QA (inline) ============================ */
// Same checks/prompts as thirty-days-reference-qa / thirty-days-scene-qa,
// inlined so this worker doesn't need to forward a user JWT for their
// ownership-check RLS query (there isn't one — this runs as service role).

async function visionQA(imageUrl: string, prompt: string, identityImages: string[] = [], comparisonImages: string[] = []): Promise<{ usable: boolean; reason: string; observedEvent: string; identityChecks: any[]; status: string; nearDuplicate: boolean; duplicateOfSceneIndex: number | null; similarityReason: string }> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl, detail: "low" } }, ...identityImages.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } })), ...comparisonImages.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } }))] }],
        response_format: { type: "json_schema", json_schema: { name: "qa", strict: true, schema: { type: "object", properties: { usable: { type: "boolean" }, reason: { type: "string" }, observedEvent: { type: "string" }, nearDuplicate: { type: "boolean" }, duplicateOfSceneIndex: { type: ["integer", "null"] }, similarityReason: { type: "string" }, multiPanel: { type: "boolean" }, identityChecks: { type: "array", items: { type: "object", additionalProperties: false, properties: { entityId: { type: "string" }, matched: { type: "boolean" }, observedIdentity: { type: "string" } }, required: ["entityId", "matched", "observedIdentity"] } } }, required: ["usable", "reason", "observedEvent", "nearDuplicate", "duplicateOfSceneIndex", "similarityReason", "multiPanel", "identityChecks"], additionalProperties: false } } },
        max_tokens: 300,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { usable: true, reason: "qa_unavailable", observedEvent: "", identityChecks: [], status: "unavailable", nearDuplicate: false, duplicateOfSceneIndex: null, similarityReason: "" };
    const json = await res.json();
    const parsed = JSON.parse(String(json.choices?.[0]?.message?.content ?? "{}"));
    return { usable: parsed?.usable !== false && parsed?.nearDuplicate !== true && parsed?.multiPanel !== true, reason: String(parsed?.reason ?? "").slice(0, 200), observedEvent: String(parsed?.observedEvent ?? "").slice(0, 600), identityChecks: parsed?.identityChecks || [], status: "checked", nearDuplicate: parsed?.nearDuplicate === true, multiPanel: parsed?.multiPanel === true, duplicateOfSceneIndex: Number.isInteger(parsed?.duplicateOfSceneIndex) ? parsed.duplicateOfSceneIndex : null, similarityReason: String(parsed?.similarityReason ?? "").slice(0, 300) };
  } catch (error) {
    console.warn("[thirty-days-generation-advance] QA error", String(error));
    return { usable: true, reason: "qa_unavailable", observedEvent: "", identityChecks: [], status: "unavailable", nearDuplicate: false, duplicateOfSceneIndex: null, similarityReason: "" };
  }
}

async function checkReferenceQA(imageUrl: string, reference: any, worldBible: any) {
  const confidence = Number(worldBible?.confidence ?? 0);
  if (confidence < 0.6) return { usable: true, reason: "not_a_recognized_franchise" };
  const prompt = [
    `You are a fast franchise-identity quality gate for an AI-generated PERSISTENT REFERENCE IMAGE, about to be locked in and reused across an entire video series. Do NOT deeply critique the art. Just answer one question: does this image actually look like the real, specific franchise named below, or does it look like a generic "inspired by" substitute?`,
    `Franchise: ${worldBible.franchise || "(unspecified)"} (resolved confidence: ${confidence}).`,
    `Real construction/rendering system this franchise actually uses: ${worldBible.medium || "(unspecified)"}.`,
    `This reference's subject: "${reference.label || ""}" (role: ${reference.role || ""}).`,
    `What it was asked to depict: ${reference.prompt || "(unspecified)"}`,
    `Non-negotiable visual lock it must satisfy: ${reference.visualLock || "(unspecified)"}`,
    `Selected style interpretation: ${worldBible.styleMode || "auto"} — ${worldBible.styleDirective || worldBible.visualStyle || "preserve the franchise's native visual language"}.`,
    `Check: does this image read as unmistakably the real ${worldBible.franchise || "named franchise"} — real character identities/colors, real locations, and the franchise's real construction/rendering system — or does it look like an off-brand, generic, unrelated substitute wearing the franchise's theme? Style reinterpretation is fine as long as the underlying identity is still clearly that franchise.`,
    `Return JSON only: {"usable": true} if recognizably real (allowing legitimate style reinterpretation), or {"usable": false, "reason": "short specific reason"} if generic/off-brand.`,
  ].join("\n");
  return visionQA(imageUrl, prompt);
}

async function checkSceneQA(imageUrl: string, scene: any, worldBible: any, referencesById: Map<string, any>, previousScenes: any[] = []) {
  const expectedCharacters = (scene.characters ?? []).filter(Boolean).slice(0, 8);
  const expectedRefs = selectSceneReferenceIds(scene, referencesById).map((id: string) => referencesById.get(id)).filter((ref: any) => ref?.imageUrl).slice(0, 4);
  const comparisons = previousScenes.filter((item: any) => Number(item.index) < Number(scene.index) && item.imageUrl).sort((a: any, b: any) => Number(a.index) - Number(b.index)).slice(-3);
  const prompt = [
    `You are a fast quality gate for an AI-generated scene image, about to be spent on video animation credits. Do NOT deeply critique the art. Just answer: is this image broadly usable?`,
    `Franchise: ${worldBible.franchise || "(unspecified)"}.`,
    `Planned scene: "${scene.title || ""}" at "${scene.location || ""}". Key visual event: ${scene.visualEvent || "(unspecified)"}.`,
    `Mandatory viewer protagonist: ${worldBible.viewerProtagonist?.identity || "YOU, the viewer-insert protagonist"}.`,
    expectedCharacters.length ? `Expected characters/creatures that should be identifiable if present: ${expectedCharacters.join(", ")}.` : "",
    scene.requiredEntities?.length ? `Required entity IDs: ${scene.requiredEntities.join(", ")}.` : "",
    scene.forbiddenEntities?.length ? `Forbidden entity IDs: ${scene.forbiddenEntities.join(", ")}.` : "",
    expectedRefs.length ? `Source identity image order: ${expectedRefs.map((ref: any, index: number) => `image ${index + 2} = ${ref.entityId || ref.id}, ${ref.label}, ${ref.visualLock}`).join(" | ")}.` : "",
    comparisons.length ? `After identity images, comparison images are earlier scenes: ${comparisons.map((item: any) => `scene ${Number(item.index) + 1}`).join(", ")}. They are for duplicate detection only.` : "",
    `Check exact identity, species/form/version, protagonist, action, props, and environment. A wrong recurring identity is a hard failure. Describe only what is actually visible in observedEvent.`,
    `CAST-INTEGRITY GATE: set usable=false if any character masquerades as another, has another character's clothing/body/species/role, a creature or mascot is turned into a humanlike stand-in, an unplanned character appears, or a required character's exact form is wrong. Allow only a transformation/costume change explicitly required by the planned scene.`,
    `SINGLE-FRAME GATE: a comic page, manga page, storyboard, contact sheet, split screen, collage, grid, inset, sequential panels, or multiple variations inside one image is unusable.`,
    `CANVAS GATE: set multiPanel=true and usable=false ONLY if visible borders, dividers, insets, or separate framed images divide the canvas horizontally/vertically, stack it into strips, or contain an establishing shot plus a second moment. A vertical triptych of three stacked shots is multiPanel=true. Several characters, creatures, or objects in one uninterrupted location are one scene, NOT panels.`,
    `Set nearDuplicate=true and usable=false if this substantially repeats an earlier scene's background view, pose, subject placement, camera angle, staging, lighting motif, and composition. Shared identity alone is not duplication; same-location continuity is allowed only when framing/action/staging visibly progress.`,
  ].filter(Boolean).join("\n");
  const result = await visionQA(imageUrl, prompt, expectedRefs.map((ref: any) => ref.imageUrl), comparisons.map((item: any) => item.imageUrl));
  // Vision can describe a correct custom-named companion as its species
  // ("Nova" as "Eevee"), or infer details a POV reference does not show.
  // Those are useful editorial notes but far too brittle to discard paid
  // media. Only objectively unusable canvas defects may hard-stop a scene.
  const structuralDefect = result.nearDuplicate || result.multiPanel === true || /\b(split[- ]?screen|split[- ]?panel|comic page|manga page|storyboard|contact sheet|collage|grid|inset(?: panel)?|divided canvas|stacked strips|separate framed images|triptych|three[- ]panel|three[- ]strip|panel layout|horizontal (?:divider|split|border)|vertical (?:divider|split|border)|watermark|readable text|caption|subtitle|speech bubble|logo|ui\/hud)\b/i.test(result.reason || "");
  return { ...result, usable: structuralDefect ? false : true };
}

// Service-role mirror of thirtyDaysSeriesApi.js's getPreviousEpisodeEndingImage
// — see that function's comment for why this exists. Duplicated rather than
// shared for the same reason as buildSceneImagePrompt (edge functions can't
// import browser client code).
async function getPreviousEpisodeEndingImage(admin: any, seriesId: string, currentSeriesEpisodeId: string | null): Promise<string | null> {
  if (!seriesId || !currentSeriesEpisodeId) return null;
  const { data: current } = await admin.from("thirty_days_series_episodes").select("episode_number").eq("id", currentSeriesEpisodeId).maybeSingle();
  const episodeNumber = Number(current?.episode_number || 0);
  if (episodeNumber <= 1) return null;
  const { data: previousEpisode } = await admin.from("thirty_days_series_episodes")
    .select("generation_id").eq("series_id", seriesId).eq("episode_number", episodeNumber - 1).eq("status", "completed").maybeSingle();
  if (!previousEpisode?.generation_id) return null;
  const { data: previousGeneration } = await admin.from("thirty_days_generations").select("scenes").eq("id", previousEpisode.generation_id).maybeSingle();
  const scenes = Array.isArray(previousGeneration?.scenes) ? previousGeneration.scenes : [];
  return scenes.at(-1)?.imageUrl || null;
}

/* ============================ Per-generation tick ============================ */

async function advanceGeneration(admin: any, generation: any, tiers: Record<string, any>, profiles: Record<string, string>) {
  // Rebuild the UI projection from durable jobs before deciding whether a
  // reference needs work. This makes a provider completion survive browser
  // suspension: no duplicate request and no false "failed" reference card.
  const { data: recovered, error: recoveryError } = await admin.rpc("service_recover_thirty_days_generation", {
    p_generation_id: generation.id,
  });
  if (recoveryError) throw recoveryError;
  generation = recovered || generation;
  const tier = tiers[generation.quality_tier];
  if (!tier) return { skipped: "no_tier" };
  const planCode = profiles[generation.user_id] || "free";
  const worldBible = generation.world_bible || {};
  const refs: any[] = Array.isArray(generation.visual_references) ? [...generation.visual_references] : [];
  const scenes: any[] = Array.isArray(generation.scenes) ? [...generation.scenes] : [];
  let changed = false;
  let submittedThisTick = false;

  // ---- references ----
  for (const ref of refs) {
    if (ref.status === "succeeded" && ref.imageUrl) continue;
    if (ref.jobId && ["queued", "running", "retrying"].includes(ref.status)) {
      const job = await getJobRow(admin, ref.jobId);
      if (job && TERMINAL.has(job.status)) {
        changed = true;
        if (job.status === "succeeded" && job.result_url) {
          if (!ref.qaRepaired) {
            const qa = await checkReferenceQA(job.result_url, ref, worldBible);
            if (qa.usable === false) {
              const repairJob = await insertJob(admin, {
                userId: generation.user_id, planCode, type: "image", toolKey: tier.reference_tool_key,
                subject: buildReferencePrompt(ref, worldBible, qa.reason),
                width: tier.reference_width, height: tier.reference_height,
                generationId: generation.id, assetKey: `reference:${ref.id}`,
              });
              ref.jobId = repairJob.id; ref.status = "retrying"; ref.qaRepaired = true; ref.error = null;
              continue;
            }
          }
          ref.imageUrl = job.result_url; ref.status = "succeeded"; ref.error = null; ref.progress = 100;
        } else {
          ref.status = "failed"; ref.error = job?.error || "Reference generation failed"; ref.imageUrl = null;
        }
      }
      continue;
    }
    if (!submittedThisTick) {
      const job = await insertJob(admin, {
        userId: generation.user_id, planCode, type: "image", toolKey: tier.reference_tool_key,
        subject: buildReferencePrompt(ref, worldBible),
        width: tier.reference_width, height: tier.reference_height,
        generationId: generation.id, assetKey: `reference:${ref.id}`,
      });
      ref.jobId = job.id; ref.status = "queued"; ref.error = null;
      submittedThisTick = true; changed = true;
    }
  }

  // ---- scenes (episodes only; series_setup has no scenes) ----
  const referencesById = new Map(refs.map((ref) => [ref.id, ref]));
  // Fetched once per tick, only when actually needed (scene 0 not yet
  // submitted/succeeded) — mirrors the browser path in useThirtyDaysJob.js
  // so an episode continues visually from wherever the previous one ended
  // instead of resetting to a fresh establishing shot.
  const scene0 = scenes.find((s: any) => Number(s.index) === 0);
  const previousEpisodeEndingImageUrl = generation.generation_mode === "series_episode" && scene0 && !(scene0.imageStatus === "succeeded" && scene0.imageUrl)
    ? await getPreviousEpisodeEndingImage(admin, generation.series_id, generation.series_episode_id)
    : null;
  for (const scene of scenes) {
    const imageDone = scene.imageStatus === "succeeded" && scene.imageUrl;
    const imageFailed = scene.imageStatus === "failed";
    if (imageDone && scene.qaStatus === "unavailable") {
      const qa = await checkSceneQA(scene.imageUrl, scene, worldBible, referencesById, scenes);
      if (qa.status !== "unavailable") {
        changed = true;
        scene.qaStatus = "passed";
        scene.qaReason = qa.nearDuplicate
          ? `qa_warning:near_duplicate:${qa.similarityReason || "repeats an earlier scene"}`
          : qa.usable ? qa.reason : `qa_warning:${qa.reason || "visual mismatch"}`;
        scene.visualObservation = qa.observedEvent || null;
        scene.identityChecks = qa.identityChecks || [];
        scene.duplicateOfSceneIndex = qa.duplicateOfSceneIndex;
        scene.compositionSimilarityReason = qa.similarityReason || null;
        await admin.from("thirty_days_generation_assets").update({
          qa_status: scene.qaStatus,
          qa_observations: { observedEvent: qa.observedEvent, identityChecks: qa.identityChecks, nearDuplicate: qa.nearDuplicate, duplicateOfSceneIndex: qa.duplicateOfSceneIndex, similarityReason: qa.similarityReason },
          status: "succeeded",
          error: null,
        }).eq("generation_id", generation.id).eq("asset_key", `scene:${scene.index}:image`);
      }
    }
    if (!imageDone && !imageFailed) {
      if (scene.imageJobId && ["queued", "running", "retrying"].includes(scene.imageStatus)) {
        const job = await getJobRow(admin, scene.imageJobId);
        if (job && TERMINAL.has(job.status)) {
          changed = true;
          if (job.status === "succeeded" && job.result_url) {
            {
              const qa = await checkSceneQA(job.result_url, scene, worldBible, referencesById, scenes);
              const qaRejected = qa.status !== "unavailable" && qa.usable === false;
              scene.qaStatus = qa.status === "unavailable" ? "unavailable" : qaRejected ? "failed" : "passed";
              scene.qaReason = qa.nearDuplicate
                ? `qa_warning:near_duplicate:${qa.similarityReason || "repeats an earlier scene"}`
                : qaRejected ? `hard_qa:${qa.reason || "visual mismatch"}` : qa.reason;
              scene.visualObservation = qa.observedEvent || null;
              scene.identityChecks = qa.identityChecks || [];
              scene.duplicateOfSceneIndex = qa.duplicateOfSceneIndex;
              scene.compositionSimilarityReason = qa.similarityReason || null;
              await admin.from("thirty_days_generation_assets").update({
                qa_status: scene.qaStatus,
                qa_observations: { observedEvent: qa.observedEvent, identityChecks: qa.identityChecks, nearDuplicate: qa.nearDuplicate, duplicateOfSceneIndex: qa.duplicateOfSceneIndex, similarityReason: qa.similarityReason },
                status: "succeeded",
                error: null,
              }).eq("generation_id", generation.id).eq("asset_key", `scene:${scene.index}:image`);
              if (qaRejected) {
                // A machine-detected composition/identity miss must repair
                // itself once while the original generation reservation is
                // still open. Sending a user to a paid retry button for a
                // bad provider result both feels broken and left episodes
                // stuck waiting on unrelated scenes. The second rejection is
                // still surfaced honestly for a deliberate user retry.
                if (!scene.qaRepaired) {
                  const repairNote = qa.nearDuplicate
                    ? `near-duplicate of Scene ${Number(qa.duplicateOfSceneIndex) + 1}: ${qa.similarityReason || qa.reason || "use a distinct composition"}`
                    : qa.reason || "single-frame and identity mismatch";
                  const repairRefImages = scene.collageUrl ? [scene.collageUrl] : selectSceneReferenceIds(scene, referencesById).map((id: string) => referencesById.get(id)?.imageUrl).filter(Boolean).slice(0, 4);
                  if (Number(scene.index) === 0 && previousEpisodeEndingImageUrl) repairRefImages.push(previousEpisodeEndingImageUrl);
                  const repairJob = await insertJob(admin, {
                    userId: generation.user_id, planCode, type: "image", toolKey: tier.image_tool_key,
                    subject: buildSceneImagePrompt({ scene, worldBible, referencesById, cameraMode: generation.camera_mode, repairNote, previousEpisodeEndingImageUrl: Number(scene.index) === 0 ? previousEpisodeEndingImageUrl : null }),
                    width: tier.image_width, height: tier.image_height, refImages: repairRefImages,
                    generationId: generation.id, assetKey: `scene:${scene.index}:image`,
                  });
                  await admin.from("thirty_days_generation_assets").update({
                    job_id: repairJob.id, status: "retrying", error: null,
                  }).eq("generation_id", generation.id).eq("asset_key", `scene:${scene.index}:image`);
                  scene.imageJobId = repairJob.id;
                  scene.imageStatus = "retrying";
                  scene.videoStatus = "planned";
                  scene.qaRepaired = true;
                  scene.error = null;
                  continue;
                }
                scene.imageStatus = "failed";
                scene.videoStatus = "failed";
                scene.error = `Image rejected after an automatic correction: ${qa.reason || "visual mismatch"}. Use Regenerate image to replace it.`;
                scene.imageProgress = 100;
                continue;
              }
            }
            scene.imageUrl = job.result_url; scene.imageStatus = "succeeded"; scene.error = null; scene.imageProgress = 100;
          } else {
            scene.imageStatus = "failed"; scene.videoStatus = "failed"; scene.error = job?.error || "Scene image generation failed";
          }
        }
        continue;
      }
      // Not yet started — only submit once its anchor reference is ready.
      const requiredRefs = selectSceneReferenceIds(scene, referencesById).map((id: string) => referencesById.get(id));
      if (!requiredRefs.length || requiredRefs.some((ref: any) => !ref?.imageUrl)) continue;
      const isFirstScene = Number(scene.index) === 0;
      const refImages = scene.collageUrl ? [scene.collageUrl] : requiredRefs.map((ref: any) => ref.imageUrl).slice(0, 4);
      if (isFirstScene && previousEpisodeEndingImageUrl) refImages.push(previousEpisodeEndingImageUrl);
      if (!submittedThisTick) {
        const job = await insertJob(admin, {
          userId: generation.user_id, planCode, type: "image", toolKey: tier.image_tool_key,
          subject: buildSceneImagePrompt({ scene, worldBible, referencesById, cameraMode: generation.camera_mode, previousEpisodeEndingImageUrl: isFirstScene ? previousEpisodeEndingImageUrl : null }),
          width: tier.image_width, height: tier.image_height, refImages,
          generationId: generation.id, assetKey: `scene:${scene.index}:image`,
        });
        scene.imageJobId = job.id; scene.imageStatus = "queued"; scene.error = null;
        submittedThisTick = true; changed = true;
      }
      continue;
    }
    if (imageFailed) { if (scene.videoStatus !== "failed") { scene.videoStatus = "failed"; changed = true; } continue; }

    // Image is done — advance the video.
    const videoDone = scene.videoStatus === "succeeded" && scene.videoUrl;
    const videoFailed = scene.videoStatus === "failed";
    if (videoDone) continue;
    if (scene.videoJobId && ["queued", "running", "retrying"].includes(scene.videoStatus)) {
      const job = await getJobRow(admin, scene.videoJobId);
      if (job && TERMINAL.has(job.status)) {
        changed = true;
        if (job.status === "succeeded" && job.result_url) {
          scene.videoUrl = job.result_url; scene.videoStatus = "succeeded"; scene.videoError = null; scene.videoProgress = 100;
        } else {
          scene.videoStatus = "failed"; scene.videoError = job?.error || "Animation failed";
        }
      }
      continue;
    }
    if (videoFailed) continue; // leave failed clips for the user's manual retry (paid retry path)
    if (!submittedThisTick) {
      const job = await insertJob(admin, {
        userId: generation.user_id, planCode, type: "video", toolKey: tier.video_tool_key,
        subject: buildSceneVideoPrompt(scene, scenes[Number(scene.index) + 1] || null, tier.video_duration_seconds, generation.camera_mode),
        width: tier.video_width, height: tier.video_height, durationSec: tier.video_duration_seconds,
        refImages: [scene.imageUrl],
        generationId: generation.id, assetKey: `scene:${scene.index}:video`,
      });
      scene.videoJobId = job.id; scene.videoStatus = "queued"; scene.videoError = null;
      submittedThisTick = true; changed = true;
    }
  }

  if (changed) {
    await admin.from("thirty_days_generations").update({ visual_references: refs, scenes }).eq("id", generation.id);
  }

  const allRefsTerminal = refs.every((r) => ["succeeded", "failed"].includes(r.status));
  const isSetup = generation.generation_mode === "series_setup";
  const allQaChecked = isSetup || scenes.every((scene) => scene.imageStatus === "failed" || ["passed", "unavailable"].includes(scene.qaStatus));
  const allScenesTerminal = isSetup || scenes.every((s) =>
    s.imageStatus === "failed" || (s.videoStatus === "succeeded" && s.videoUrl) || s.videoStatus === "failed");

  if (allRefsTerminal && allScenesTerminal && allQaChecked) {
    const { error: settleError } = await admin.rpc("service_settle_thirty_days_generation", { p_generation_id: generation.id });
    if (settleError) { console.warn("[thirty-days-generation-advance] settle failed", generation.id, settleError.message); return { changed, settled: false }; }
    if (isSetup) {
      const { error } = await admin.rpc("service_complete_thirty_days_series_setup", { p_series_id: generation.series_id });
      if (error) console.warn("[thirty-days-generation-advance] setup completion pending:", error.message);
    } else {
      const successScenes = scenes.filter((s) => s.videoStatus === "succeeded" && s.videoUrl).length;
      if (successScenes === scenes.length && scenes.length > 0) {
        const verified = verifyEpisodeFromRenderedScenes({ episodeId: generation.series_episode_id, plan: { scenes }, scenes });
        const { data: episodeRow } = await admin.from("thirty_days_series_episodes").select("state_delta,story_plan").eq("id", generation.series_episode_id).single();
        const { error } = await admin.rpc("service_commit_thirty_days_series_episode", {
          p_episode_id: generation.series_episode_id,
          p_verified_episode: { ...verified, nextEpisodeSetup: episodeRow?.story_plan?.nextEpisodeTease || null },
          p_state_delta: episodeRow?.state_delta || episodeRow?.story_plan?.stateDelta || {},
          p_thumbnail_url: scenes[0]?.imageUrl || null,
        });
        if (error) console.warn("[thirty-days-generation-advance] episode completion pending:", error.message);
      }
    }
    return { changed, settled: true };
  }
  return { changed, settled: false };
}

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  if (!ADVANCE_SECRET || req.headers.get("x-cron-secret") !== ADVANCE_SECRET) {
    return reply({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: claimed, error: claimError } = await admin.rpc("claim_stale_thirty_days_generations", { p_limit: MAX_GENERATIONS_PER_TICK });
  if (claimError) {
    console.error("[thirty-days-generation-advance] claim failed", claimError);
    return reply({ ok: false, error: "claim failed" }, 500);
  }
  if (!claimed?.length) return reply({ ok: true, processed: 0 });

  const { data: tierRows } = await admin.from("thirty_days_quality_tiers").select("*");
  const tiers = Object.fromEntries((tierRows || []).map((row: any) => [row.quality_tier, row]));

  const userIds = [...new Set(claimed.map((g: any) => g.user_id))];
  const { data: profileRows } = await admin.from("profiles").select("id, plan_code").in("id", userIds);
  const profiles = Object.fromEntries((profileRows || []).map((row: any) => [row.id, row.plan_code]));

  const results = [];
  for (const generation of claimed) {
    try {
      const outcome = await advanceGeneration(admin, generation, tiers, profiles);
      results.push({ id: generation.id, ...outcome });
    } catch (error) {
      console.error("[thirty-days-generation-advance] tick failed", generation.id, String(error));
      results.push({ id: generation.id, error: String(error) });
    } finally {
      await admin.rpc("release_thirty_days_advance_claim", { p_generation_id: generation.id }).catch(() => {});
    }
  }
  return reply({ ok: true, processed: results.length, results });
});
