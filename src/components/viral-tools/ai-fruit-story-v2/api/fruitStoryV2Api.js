// AI Fruit Story v2 — data contract.
//
// The UI talks ONLY to the functions exported here. They run on the real
// backend (./supabaseAdapter.js) by default. Only the dev preview
// (?fruitV2Preview=1) and tests install the in-memory mock
// (./mock/mockAdapter.js) with setFruitStoryV2Adapter, so real accounts never
// see mock data. Every function is async unless noted.

import { createSupabaseAdapter } from "./supabaseAdapter.js";
//
// ── Types ────────────────────────────────────────────────────────────────
//
/**
 * A library character. Ideas, prompts, scripts and series may only use these.
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} name         "Mia Mango"
 * @property {string} fruit        "mango"
 * @property {string} tag          Short role label shown on chips: "Wife", "Boss"
 * @property {string} role         One-line personality: "Calm, patient schemer"
 * @property {"female"|"male"} gender
 * @property {string} refImageUrl  Locked reference image (same look in every scene)
 * @property {string} voiceStyle   e.g. "calm, low, deliberate"
 * @property {string} [emoji]      Fallback glyph when no image is available
 * @property {number} [hue]        Fallback avatar background hue (0–360)
 */

/**
 * @typedef {Object} Idea
 * @property {string} id
 * @property {string} title
 * @property {string} summary      One line
 * @property {string[]} castIds    2–3 library character ids
 */

/**
 * @typedef {"v2"|"v3"|"v4"} QualityTier
 * @typedef {"9:16"|"16:9"} Aspect
 * @typedef {"queued"|"generating"|"ready"|"failed"} ImageStatus
 * @typedef {"none"|"queued"|"generating"|"ready"|"failed"} ClipStatus
 */

/**
 * One scene = one character saying one line. At most 3 characters present.
 * @typedef {Object} Scene
 * @property {string} id
 * @property {number} index        0-based order
 * @property {string} title        "Caught red-handed"
 * @property {string} speakerId
 * @property {string} line
 * @property {string[]} presentIds 1–3 character ids in the frame (speaker included)
 * @property {number} durationSec  Clip length for this line
 * @property {ImageStatus} imageStatus
 * @property {string|null} imageUrl
 * @property {string} imagePrompt  Editable description the picture was made from
 * @property {ClipStatus} clipStatus
 * @property {string|null} clipUrl
 * @property {string|null} error   Plain-language reason when a step failed
 */

/**
 * @typedef {Object} FinalVideo
 * @property {"none"|"building"|"ready"|"failed"} status
 * @property {string|null} url
 * @property {number} trimmedSec   Silence removed between lines
 * @property {boolean} captions
 * @property {number[]} [trimmedPerClipSec] Silence trimmed after each clip (for the timeline)
 * @property {string|null} [error]
 */

/**
 * @typedef {"draft"|"pictures"|"pictures_ready"|"animating"|"clips_ready"|"building"|"final_ready"|"failed"} StoryStatus
 *   draft          script written, no pictures requested yet
 *   pictures       scene pictures being made
 *   pictures_ready every picture finished (some may have failed)
 *   animating      clips being made
 *   clips_ready    every clip finished (some may have failed)
 *   building       final video being joined
 *   final_ready    final video ready
 *   failed         the story itself could not be written
 */

/**
 * @typedef {Object} Story
 * @property {string} id
 * @property {string} title
 * @property {string[]} castIds
 * @property {QualityTier} quality
 * @property {number} lengthSec
 * @property {Aspect} aspect
 * @property {StoryStatus} status
 * @property {Scene[]} scenes
 * @property {FinalVideo} final
 * @property {string} [seriesId]
 * @property {number} [episodeNumber]
 * @property {string} createdAt    ISO timestamp
 */

/**
 * @typedef {Object} ScriptLine
 * @property {string} speakerId
 * @property {string} line
 */

/**
 * @typedef {Object} CreateStoryInput
 * @property {"idea"|"prompt"|"script"} source
 * @property {string} [ideaId]         source="idea"
 * @property {string} [prompt]         source="prompt", max 1000 chars
 * @property {ScriptLine[]} [script]   source="script", used exactly as written: one scene per line,
 *                                     2+ lines, at most 3 distinct speakers, all library characters
 * @property {string[]} [castIds]      1–3 for single videos. Idea: taken from the idea. Script:
 *                                     optional, the distinct speakers when omitted
 * @property {QualityTier} quality
 * @property {number} lengthSec        15–120 in 5 s steps (script: derived from the lines)
 * @property {Aspect} aspect
 * @property {string} [seriesId]
 * @property {number} [episodeNumber]
 */

/**
 * @typedef {"made"|"next"|"locked"} EpisodeStatus
 * @typedef {Object} Episode
 * @property {number} number       1-based
 * @property {string} title
 * @property {string} summary      What happens
 * @property {string} cliffhanger  "Ends on: …"
 * @property {EpisodeStatus} status
 * @property {string} [storyId]    Set once the episode has been started
 */

/**
 * @typedef {Object} Series
 * @property {string} id
 * @property {string} title
 * @property {string} logline
 * @property {string[]} castIds    2–5
 * @property {Episode[]} episodes
 * @property {string} createdAt
 */

/**
 * @typedef {Object} SeriesPlanInput
 * @property {string} concept
 * @property {string[]} castIds    2–5
 * @property {string} opener       Episode 1 opening moment
 * @property {string} tone
 * @property {number} episodeCount 3–10
 */

/**
 * @typedef {Object} RecentSingle
 * @property {"single"} type
 * @property {string} id           Story id
 * @property {string} title
 * @property {string[]} castIds
 * @property {number} lengthSec
 * @property {string[]} thumbUrls  Up to 3 scene pictures
 * @property {StoryStatus} status
 * @property {string} createdAt
 *
 * @typedef {Object} RecentSeries
 * @property {"series"} type
 * @property {string} id           Series id
 * @property {string} title
 * @property {string[]} castIds
 * @property {number} episodeCount
 * @property {number} madeCount
 * @property {string[]} thumbUrls
 * @property {string} createdAt
 */

/**
 * The backend the UI runs against. Phase 3 implements this interface.
 * @typedef {Object} FruitStoryV2Adapter
 * @property {boolean} [isMock]
 * @property {() => Promise<Character[]>} listCharacters
 * @property {(opts: {seed?: number}) => Promise<Idea[]>} getIdeas  Exactly 5 per call
 * @property {(input: CreateStoryInput) => Promise<Story>} createStory
 * @property {(storyId: string) => Promise<Story>} generateScenePictures
 * @property {(sceneId: string, instruction: string) => Promise<Story>} editScene
 * @property {(sceneId: string, prompt: string) => Promise<Story>} regenerateScene
 * @property {(storyId: string) => Promise<Story>} animateAll
 * @property {(sceneId: string) => Promise<Story>} regenerateClip
 * @property {(storyId: string, opts: {captions: boolean}) => Promise<Story>} buildFinal
 * @property {(storyId: string) => Promise<Story>} getStory
 * @property {(storyId: string, onChange: (story: Story) => void) => () => void} subscribeStory  Sync; returns unsubscribe
 * @property {() => Promise<RecentSeries[]>} listSeries
 * @property {(input: SeriesPlanInput) => Promise<Series>} createSeriesPlan
 * @property {(seriesId: string) => Promise<Series>} getSeries
 * @property {(opts: {type: "single"|"series"}) => Promise<(RecentSingle|RecentSeries)[]>} listRecent
 */

// Limits shared by the UI and every adapter live in ./limits.js.
export { LIMITS } from "./limits.js";

// ── Adapter wiring ───────────────────────────────────────────────────────

/** @type {FruitStoryV2Adapter|null} Created on first use, so a module reload can't fall back to mock data. */
let adapter = null;
const current = () => adapter ?? (adapter = createSupabaseAdapter());

/** Phase 3: install the real backend. Tests can install a fresh mock. */
export function setFruitStoryV2Adapter(next) {
  adapter = next;
}

/** True while the UI is running on mock data (nothing is charged or saved). */
export function isMockBackend() {
  return current().isMock === true;
}

/** @returns {Promise<Character[]>} */
export const listCharacters = () => current().listCharacters();
/** @param {{seed?: number}} [opts] @returns {Promise<Idea[]>} */
export const getIdeas = (opts = {}) => current().getIdeas(opts);
/** @param {CreateStoryInput} input @returns {Promise<Story>} */
export const createStory = (input) => current().createStory(input);
/** @param {string} storyId @returns {Promise<Story>} */
export const generateScenePictures = (storyId) => current().generateScenePictures(storyId);
/** @param {string} sceneId @param {string} instruction @returns {Promise<Story>} */
export const editScene = (sceneId, instruction) => current().editScene(sceneId, instruction);
/** @param {string} sceneId @param {string} prompt @returns {Promise<Story>} */
export const regenerateScene = (sceneId, prompt) => current().regenerateScene(sceneId, prompt);
/** @param {string} storyId @returns {Promise<Story>} */
export const animateAll = (storyId) => current().animateAll(storyId);
/** @param {string} sceneId @returns {Promise<Story>} */
export const regenerateClip = (sceneId) => current().regenerateClip(sceneId);
/** @param {string} storyId @param {{captions: boolean}} opts @returns {Promise<Story>} */
export const buildFinal = (storyId, opts) => current().buildFinal(storyId, opts);
/** @param {string} storyId @returns {Promise<Story>} */
export const getStory = (storyId) => current().getStory(storyId);
/** Synchronous. @param {string} storyId @param {(story: Story) => void} onChange @returns {() => void} unsubscribe */
export const subscribeStory = (storyId, onChange) => current().subscribeStory(storyId, onChange);
/** @returns {Promise<RecentSeries[]>} */
export const listSeries = () => current().listSeries();
/** @param {SeriesPlanInput} input @returns {Promise<Series>} */
export const createSeriesPlan = (input) => current().createSeriesPlan(input);
/** @param {string} seriesId @returns {Promise<Series>} */
export const getSeries = (seriesId) => current().getSeries(seriesId);
/** @param {{type: "single"|"series"}} opts */
export const listRecent = (opts) => current().listRecent(opts);
