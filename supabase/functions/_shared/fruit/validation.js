// Input validation for the AI Fruit Story v2 API. Every function returns a
// normalized copy of the input or throws FruitError("VALIDATION", <plain
// message shown to the user>). Script lines are never changed.
import { FruitError } from "./errors.js";
import { LIMITS, SERVER_LIMITS } from "./limits.js";
import { videoModel } from "./models.js";
import { clipDurationSec, maxWordsFor, wordCount } from "./duration.js";
import { lookAlikeMessage } from "./castRules.js";
import { hooksOf, nicheOf } from "./niches/index.js";

const bad = (message) => new FruitError("VALIDATION", message, 400);
/** The template's own check of the user's words (niches/<id>.js#safety.userText), e.g. real names in Blocky Stories. Fruit has none. */
function safeText(text, niche) {
  const message = nicheOf(niche).safety?.userText?.(text);
  if (message) throw bad(message);
}
const QUALITIES = ["v2", "v3", "v4"];
const ASPECTS = ["9:16", "16:9"];

function castFrom(ids, library, min, max, { lookAlikes = true, niche } = {}) {
  if (!Array.isArray(ids) || ids.length < min || ids.length > max || new Set(ids).size !== ids.length) {
    throw bad(min === max ? `Pick ${min} characters.` : `Pick ${min} to ${max} characters.`);
  }
  for (const id of ids) {
    if (typeof id !== "string" || !library.has(id)) throw bad("One of those characters isn't in the library.");
  }
  // Two of the same fruit look the same in a close-up, unless they're relatives dressed differently.
  // (An idea's cast is fixed by the library, which its own build checks: the user can't swap it.)
  // The rule is the template's: Fruit's is castRules.js, another niche brings its own (niches/<id>.js#cast).
  const alike = lookAlikes ? (hooksOf(niche, "cast")?.lookAlikeMessage ?? lookAlikeMessage)(ids.map((id) => library.get(id))) : null;
  if (alike) throw bad(alike);
  return [...ids];
}

function common(input) {
  const quality = input?.quality;
  if (!QUALITIES.includes(quality)) throw bad("Pick V2, V3 or V4.");
  const aspect = input?.aspect;
  if (!ASPECTS.includes(aspect)) throw bad("Pick tall 9:16 or wide 16:9.");
  return { quality, aspect };
}

function lengthOf(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < LIMITS.minLengthSec || n > LIMITS.maxLengthSec || n % LIMITS.lengthStepSec !== 0) {
    throw bad(`Choose a length from ${LIMITS.minLengthSec} seconds to ${LIMITS.maxLengthSec / 60} minutes.`);
  }
  return n;
}

/**
 * @param {object} input CreateStoryInput from the contract
 * @param {Map<string, object>} library character id → character
 * @param {(ideaId: string) => ({castIds: string[]}|null)} [findIdea]
 * @param {string|object} [niche] the template (niches/); nothing = Fruit
 */
export function validateCreateStory(input, library, findIdea, niche) {
  if (!input || typeof input !== "object") throw bad("Pick an idea, describe a story, or write a script.");
  const { quality, aspect } = common(input);
  const series = input.seriesId != null
    ? (() => {
      const n = Number(input.episodeNumber);
      if (typeof input.seriesId !== "string" || !Number.isInteger(n) || n < 1 || n > LIMITS.maxEpisodes) throw bad("That episode doesn't exist.");
      return { seriesId: input.seriesId, episodeNumber: n };
    })()
    : {};

  if (series.seriesId) {
    return { source: "episode", quality, aspect, lengthSec: lengthOf(input.lengthSec), ...series };
  }

  if (input.source === "idea") {
    if (typeof input.ideaId !== "string" || !input.ideaId) throw bad("Pick an idea to continue.");
    const idea = findIdea?.(input.ideaId);
    if (!idea) throw bad("That idea isn't available anymore. Pick another one.");
    return { source: "idea", ideaId: input.ideaId, castIds: castFrom(idea.castIds, library, 2, LIMITS.maxCastSingle, { lookAlikes: false }), quality, aspect, lengthSec: lengthOf(input.lengthSec) };
  }

  if (input.source === "prompt") {
    const castIds = castFrom(input.castIds, library, 1, LIMITS.maxCastSingle, { niche });
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (prompt.length < 10) throw bad("Describe the story in a sentence or two.");
    if (prompt.length > LIMITS.maxPromptChars) throw bad(`Keep the story under ${LIMITS.maxPromptChars} characters.`);
    safeText(prompt, niche);
    return { source: "prompt", prompt, castIds, quality, aspect, lengthSec: lengthOf(input.lengthSec) };
  }

  if (input.source === "script") {
    const rows = Array.isArray(input.script) ? input.script : [];
    if (rows.length < 2) throw bad("Write at least two lines, each starting with who's talking.");
    if (rows.length > SERVER_LIMITS.maxScriptLines) throw bad(`Keep the script to ${SERVER_LIMITS.maxScriptLines} lines or fewer.`);
    const allowed = videoModel(quality).durations;
    const maxWords = maxWordsFor(allowed);
    const script = rows.map((r, i) => {
      const line = typeof r?.line === "string" ? r.line : "";
      if (!line.trim()) throw bad(`Line ${i + 1} is empty.`);
      if (line.length > SERVER_LIMITS.maxLineChars) throw bad(`Line ${i + 1} is too long. Keep each line under ${SERVER_LIMITS.maxLineChars} characters.`);
      if (typeof r.speakerId !== "string" || !library.has(r.speakerId)) throw bad("Every line needs a speaker from the character library.");
      if (wordCount(line) > maxWords) throw bad(`Line ${i + 1} is too long for one ${quality.toUpperCase()} clip. Keep it under ${maxWords} words.`);
      safeText(line, niche);
      return { speakerId: r.speakerId, line };   // exactly as written
    });
    const speakers = [...new Set(script.map((r) => r.speakerId))];
    if (speakers.length > LIMITS.maxCharactersPerScene) {
      throw bad(`Use at most ${LIMITS.maxCharactersPerScene} different speakers. This script has ${speakers.length}.`);
    }
    const castIds = Array.isArray(input.castIds) && input.castIds.length ? castFrom(input.castIds, library, 1, LIMITS.maxCastSingle, { niche }) : speakers;
    if (speakers.some((id) => !castIds.includes(id))) throw bad("Every speaker must be in the cast.");
    const lengthSec = script.reduce((sum, r) => sum + clipDurationSec(r.line, allowed), 0);
    return { source: "script", script, castIds, quality, aspect, lengthSec };
  }

  throw bad("Pick an idea, describe a story, or write a script.");
}

export function validateSeriesPlan(input, library, niche) {
  const concept = typeof input?.concept === "string" ? input.concept.trim() : "";
  if (concept.length < 6) throw bad("Describe the series in a sentence or two.");
  if (concept.length > LIMITS.maxPromptChars) throw bad(`Keep it under ${LIMITS.maxPromptChars} characters.`);
  safeText(concept, niche);
  const castIds = castFrom(input?.castIds, library, LIMITS.minCastSeries, LIMITS.maxCastSeries, { niche });
  const episodeCount = Number(input?.episodeCount);
  if (!Number.isInteger(episodeCount) || episodeCount < LIMITS.minEpisodes || episodeCount > LIMITS.maxEpisodes) {
    throw bad(`Choose ${LIMITS.minEpisodes} to ${LIMITS.maxEpisodes} episodes.`);
  }
  const opener = typeof input?.opener === "string" ? input.opener.trim().slice(0, 300) : "";
  safeText(opener, niche);
  const tone = typeof input?.tone === "string" ? input.tone.trim().slice(0, 60) : "";
  return { concept, castIds, episodeCount, opener, tone };
}

export function validateEditInstruction(instruction) {
  const text = typeof instruction === "string" ? instruction.trim() : "";
  if (!text) throw bad("Say what should change.");
  if (text.length > SERVER_LIMITS.maxEditChars) throw bad(`Keep the change under ${SERVER_LIMITS.maxEditChars} characters.`);
  return text;
}

export function validateScenePrompt(prompt) {
  const text = typeof prompt === "string" ? prompt.trim() : "";
  if (!text) throw bad("The scene description can't be empty.");
  if (text.length > SERVER_LIMITS.maxScenePromptChars) throw bad(`Keep the scene description under ${SERVER_LIMITS.maxScenePromptChars} characters.`);
  return text;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateId(value, what = "video") {
  if (typeof value !== "string" || !UUID.test(value)) throw new FruitError("NOT_FOUND", `This ${what} doesn't exist anymore.`, 404);
  return value.toLowerCase();
}
