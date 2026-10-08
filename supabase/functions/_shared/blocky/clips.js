// Clip requests for Blocky Stories: image-to-video with the scene picture
// as the first frame and native audio. The prompt is built once, stored on
// the scene/job and sent byte-for-byte; it never gets cut (tiers shorten the
// wording by design, and tests prove the worst case fits).
import { nextVideoModel, videoModel } from "./models.js";
import { SERVER_LIMITS } from "./limits.js";
import { clipDurationSec } from "./duration.js";
import { withSubject } from "./wording.js";
import { inFrameIds, shotSpec } from "./shots.js";
import { CLIP } from "./look.js";

export const CLIP_PROMPT_MAX = SERVER_LIMITS.maxClipPromptChars;   // 1,500 (Veo accepts 3,000)

// Grok pushed in so hard that the listener left the frame (test clip, 2026-10-08): it gets a push-in that
// barely moves. P-Video is calm by itself and gets the same words.
export const GENTLE_CAMERA = "a very slow, slight push-in that stops early: every character stays fully in frame, at almost the same size, from the first frame to the last";
// Veo 3.1 Lite cut to its own framing right after the first frame (same test): it keeps the picture's.
export const LOCKED_CAMERA = "locked off on the first frame's exact framing for the whole clip: no zoom, no push-in, no pan, no re-framing, no new angle";
/** The camera sentence for a model (pricing.js#CLIP_MODELS.camera): only "move" follows the shot. */
const cameraFor = (model, shot) => (model.camera === "gentle" ? GENTLE_CAMERA : model.camera === "locked" ? LOCKED_CAMERA : shotSpec(shot).camera);

// What a model got wrong on a real Blocky scene, said to that model only, right after who speaks.
const MODEL_NOTES = {
  // Grok: pale teeth-like bands across the mouth decal. Naming them ("no teeth, no pale bands") did not
  // remove them in the 720p test clip (2026-10-08): the scene picture it started from already had an open
  // mouth with a tongue, and the model animates what it is given. So the note says only what the mouth IS;
  // the bands themselves are fixed in the pictures (the library's flat-mouth references). Not yet re-tested.
  grok: "The mouth stays one flat, solid dark shape printed on the face like a sticker, from the first frame to the last.",
  // Veo 3.1 Lite: a mouth with teeth and a tongue, and both faces changed by the end (angry eyes, a frown).
  "veo-lite": "The mouth is a flat printed decal that only changes its outline: no teeth, no tongue, no inside of a mouth. Every face keeps the first frame's eyes, eyebrows and expression until the last frame; nothing on a face moves but the speaker's mouth decal.",
};

// The models make multi-shot clips unless told not to (3e: a cut lost the last word).
export const NO_CUT = "One continuous shot, no cuts. The speaker keeps facing the camera until the line ends.";

/** A built clip prompt with its camera sentence swapped for the one the next model needs. */
export const withCamera = (prompt, model) => (model.camera === "move" ? String(prompt) : String(prompt).replace(/Camera: [^.]*\./, `Camera: ${cameraFor(model)}.`));

function build(tier, { scene, speaker, others, model }) {
  const listeners = others.map((c) => `${c.name} (${CLIP.kind(c)})`).join(" and ");
  const where = scene.placement && tier === 0 ? ` Positions: ${scene.placement.replace(/\.$/, "")}.` : "";
  const parts = [
    `${speaker.name}, ${CLIP.kind(speaker)} facing the camera, ${CLIP.says(speaker, scene)}: "${scene.line}"`,
    `${CLIP.speaking(speaker)}${others.length ? CLIP.silent(others, listeners) : ""}${where}`,
    ...(MODEL_NOTES[model.request] ? [MODEL_NOTES[model.request]] : []),
    `${withSubject(speaker.name, speaker, scene.action)}.`,
    `Camera: ${cameraFor(model, scene.shot)}.`,
    NO_CUT,
    tier <= 1 ? CLIP.keep : CLIP.keepShort,
    `Audio: only ${speaker.name}'s voice saying the line, with quiet room tone. No music. No subtitles, captions or on-screen text. Plain unbranded props, no logos.`,
  ];
  return parts.join(" ");
}

/** The clip prompt (tiers: full, no placement, minimal). Never cut. quality picks the model, and the model its camera wording and notes. */
export function buildClipPrompt({ scene, library, quality = "v2" }) {
  const speaker = library.get(scene.speakerId);
  if (!speaker) throw new Error(`unknown character ${scene.speakerId}`);
  // Who is in the frame with the speaker (nobody in a reaction shot).
  const others = inFrameIds(scene).slice(1).map((id) => library.get(id)).filter(Boolean);
  for (const tier of [0, 1, 2]) {
    const prompt = build(tier, { scene, speaker, others, model: videoModel(quality) });
    if (prompt.length <= CLIP_PROMPT_MAX) return prompt;
  }
  throw new Error(`clip prompt over ${CLIP_PROMPT_MAX} chars even at the shortest tier`);
}

/**
 * The Runware task for one clip, per request shape (pricing.js#CLIP_MODELS.request). The shapes are the ones
 * that made the test clips on 2026-10-08 (grok, pvideo, veo-lite) and the one live since 2026-09-30 (google).
 * model: the clip model; without it, the model that makes the tier's clips.
 */
export function clipTask({ quality, model = videoModel(quality), prompt, imageUrl, aspect, durationSec }) {
  const m = model;
  const base = { taskType: "videoInference", model: m.air, positivePrompt: prompt, duration: durationSec, numberResults: 1, outputType: "URL" };
  const firstFrame = { frameImages: [{ image: imageUrl, frame: "first" }] };
  // Grok and P-Video take a resolution name and their size from the frame image: sent width/height are refused.
  if (m.request === "grok") return { ...base, outputFormat: "MP4", resolution: m.resolution, inputs: firstFrame };
  if (m.request === "pvideo") return { ...base, outputFormat: "MP4", resolution: m.resolution, settings: { audio: true }, inputs: firstFrame };
  const [width, height] = m.sizes[aspect];
  if (m.request === "veo-lite") {
    // enhancePrompt off: the prompt is sent as written, so "keep the first frame's framing and faces" isn't rewritten away.
    return { ...base, outputFormat: "MP4", width, height, providerSettings: { google: { generateAudio: true, enhancePrompt: false } }, inputs: firstFrame };
  }
  if (m.request === "google") {
    return {
      ...base, width, height, fps: 24, outputFormat: "mp4", outputQuality: 85,
      providerSettings: { google: { generateAudio: true, enhancePrompt: true } },
      frameImages: [{ inputImage: imageUrl }],
    };
  }
  throw new Error(`no request shape for ${m.air}`);
}

/** The first frame of a clip request, whichever shape it has. */
export function firstFrameOf(request) {
  const f = request?.inputs?.frameImages?.[0] ?? request?.frameImages?.[0];
  return typeof f === "string" ? f : f?.image ?? f?.inputImage ?? null;
}

/**
 * The next try for a clip that failed, timed out or came back with drawn subtitles: the same line, first
 * frame and length on the next model of the tier's chain (pricing.js#TIERS: V2 Grok → P-Video-2; V3 Veo 3.1
 * Lite → P-Video-2; V4 Veo 3.1 Fast → Veo 3.1 Lite → P-Video-2). Null when the request's model is the last
 * of its chain, so it can't loop.
 */
export function fallbackClipTask(request) {
  const next = nextVideoModel(request.model);
  if (!next) return null;
  const aspect = request.width > request.height ? "16:9" : "9:16";   // only read by models that are sent a size
  // The next model gets its own camera wording.
  return clipTask({ model: next, prompt: withCamera(request.positivePrompt, next), imageUrl: firstFrameOf(request), aspect, durationSec: request.duration });
}

/**
 * Builder for steps.js. quality/durationSec can be overridden (admin tests only).
 * Returns {prompt, sent, request, priceInput}.
 */
export function buildClipRequest({ story, scene, library, quality = story.quality, durationSec }) {
  if (!scene.imageUrl) throw new Error("a clip needs the scene picture");
  const m = videoModel(quality);
  const duration = durationSec ?? clipDurationSec(scene.line, m.durations);
  if (!m.durations.includes(duration)) throw new Error(`duration ${duration}s not allowed for ${quality}`);
  const prompt = buildClipPrompt({ scene, library, quality });
  const request = clipTask({ quality, prompt, imageUrl: scene.imageUrl, aspect: story.aspect, durationSec: duration });
  // Priced at the size the clip is delivered at (Grok and P-Video take theirs from the picture; the final render scales).
  const [width, height] = m.sizes[story.aspect];
  return { prompt, sent: prompt, request, priceInput: { durationSec: duration, width, height, withSound: true } };
}
