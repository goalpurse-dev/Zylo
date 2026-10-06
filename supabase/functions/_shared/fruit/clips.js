// Clip requests for AI Fruit Story v2: image-to-video with the scene picture
// as the first frame and native audio. The prompt is built once, stored on
// the scene/job and sent byte-for-byte; it never gets cut (tiers shorten the
// wording by design, and tests prove the worst case fits).
import { FRUIT_MODELS, videoModel } from "./models.js";
import { SERVER_LIMITS } from "./limits.js";
import { clipDurationSec } from "./duration.js";
import { pronounOf, toneOf, withSubject } from "./wording.js";
import { shotOf } from "./shots.js";

export const CLIP_PROMPT_MAX = SERVER_LIMITS.maxClipPromptChars;   // 1,500 (Veo accepts 3,000)

const CAMERA_MOVE = {
  "close-up": "a very slow push-in on the speaker's face",
  "medium close-up": "a slow push-in toward the speaker",
  "chest-up": "a gentle, slow dolly-in",
};

// Seedance pushes in hard: its "slow push-in" ended in an extreme close-up that
// cropped the forehead ("The Bill", clip 4), so it gets an almost still camera.
export const STILL_CAMERA = "almost still, locked off: no zoom and no push-in, at most a barely noticeable drift";
const isSeedance = (quality) => /seedance/i.test(videoModel(quality).air);
const cameraFor = (quality, shot) => (isSeedance(quality) ? STILL_CAMERA : CAMERA_MOVE[shotOf(shot)]);

// Seedance 2.0 makes multi-shot clips unless told not to (3e: a cut lost the last word).
export const NO_CUT = "One continuous shot, no cuts. The speaker keeps facing the camera until the line ends.";

/** A built clip prompt with its camera sentence swapped for the almost still one. */
export const stillCamera = (prompt) => String(prompt).replace(/Camera: [^.]*\./, `Camera: ${STILL_CAMERA}.`);

const sex = (c) => (c.gender === "female" ? "woman" : "man");
const voiceOf = (c) => c.voice_style ?? c.voiceStyle;

function build(tier, { scene, speaker, others, quality }) {
  const listeners = others.map((c) => `${c.name} (the ${c.fruit} ${sex(c)})`).join(" and ");
  const where = scene.placement && tier === 0 ? ` Positions: ${scene.placement.replace(/\.$/, "")}.` : "";
  const parts = [
    `${speaker.name}, the ${speaker.fruit} ${sex(speaker)} facing the camera, says in ${pronounOf(speaker)} ${voiceOf(speaker)} voice, delivered in ${toneOf(scene.emotion)}: "${scene.line}"`,
    `Only ${speaker.name} speaks, lips moving in sync with every word.${others.length ? ` ${listeners} ${others.length > 1 ? "stay" : "stays"} silent with ${others.length > 1 ? "mouths" : "mouth"} closed, reacting only with small expressions.` : ""}${where}`,
    `${withSubject(speaker.name, speaker, scene.action)}.`,
    `Camera: ${cameraFor(quality, scene.shot)}.`,
    NO_CUT,
    tier <= 1 ? "Keep every character, outfit and the setting exactly as in the first frame. Smooth, natural motion; no warping or melting." : "Keep everything exactly as in the first frame.",
    `Audio: only ${speaker.name}'s voice saying the line, with quiet room tone. No music. No subtitles, captions or on-screen text. Plain unbranded props, no logos.`,
  ];
  return parts.join(" ");
}

/** The clip prompt (tiers: full, no placement, minimal). Never cut. quality picks the camera wording (Seedance: almost still). */
export function buildClipPrompt({ scene, library, quality = "v2" }) {
  const speaker = library.get(scene.speakerId);
  if (!speaker) throw new Error(`unknown character ${scene.speakerId}`);
  const others = scene.presentIds.filter((id) => id !== scene.speakerId).map((id) => library.get(id)).filter(Boolean);
  for (const tier of [0, 1, 2]) {
    const prompt = build(tier, { scene, speaker, others, quality });
    if (prompt.length <= CLIP_PROMPT_MAX) return prompt;
  }
  throw new Error(`clip prompt over ${CLIP_PROMPT_MAX} chars even at the shortest tier`);
}

/** The Runware task for one clip, per model (request shapes match the ones live in production). */
export function clipTask({ quality, prompt, imageUrl, aspect, durationSec }) {
  const m = videoModel(quality);
  const [width, height] = m.sizes[aspect];
  if (m.audio === "alibaba") {
    return {
      taskType: "videoInference", model: m.air, positivePrompt: prompt, width, height, duration: durationSec,
      numberResults: 1, outputType: "URL", outputFormat: "MP4",
      providerSettings: { alibaba: { audio: true } },
      inputs: { frameImages: [imageUrl] },
    };
  }
  if (m.audio === "google") {
    return {
      taskType: "videoInference", model: m.air, positivePrompt: prompt, width, height, duration: durationSec, fps: 24,
      numberResults: 1, outputType: "URL", outputFormat: "mp4", outputQuality: 85,
      providerSettings: { google: { generateAudio: true, enhancePrompt: true } },
      frameImages: [{ inputImage: imageUrl }],
    };
  }
  return {
    taskType: "videoInference", model: m.air, positivePrompt: prompt, width, height, duration: durationSec,
    numberResults: 1, outputType: "URL", outputFormat: "MP4", outputQuality: 95,
    settings: { audio: true },
    inputs: { frameImages: [imageUrl] },
  };
}

/**
 * The fallback task for a failed clip: same prompt, first frame, size and
 * length on the tier's fallback model (V2: Wan -> Seedance 2.0 Mini). Null if
 * the tier has no fallback or the request already is the fallback.
 */
export function fallbackClipTask(request) {
  const tier = Object.entries(FRUIT_MODELS.video).find(([, m]) => m.air === request.model && m.fallback);
  if (!tier) return null;
  const firstFrame = request.inputs?.frameImages?.[0] ?? request.frameImages?.[0]?.inputImage;
  const aspect = request.width > request.height ? "16:9" : "9:16";
  // The fallback model gets its own camera wording (Wan's push-in is too strong on Seedance).
  const prompt = isSeedance(tier[1].fallback) ? stillCamera(request.positivePrompt) : request.positivePrompt;
  return clipTask({ quality: tier[1].fallback, prompt, imageUrl: firstFrame, aspect, durationSec: request.duration });
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
  return { prompt, sent: prompt, request, priceInput: { durationSec: duration, width: request.width, height: request.height, withSound: true } };
}
