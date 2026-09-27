// thirty-days-script/index.ts
// AI watches the actual rendered scene clips, then writes one continuous
// short-form story grounded in what's literally on screen. Eight cue fragments
// preserve clip-level sync without turning the narration into eight summaries.
// POST { generationId, universe, premise, hook, scenes: [{index, day, title}],
//        clips: [{index, videoUrl, durationSec}], clipPrompts: [{index, prompt}],
//        clipFrames: [{clip, sampleIndex, timeSec, imageUrl}] }
// Returns { hook, narration, clips, words, segments, clipSegments, fallback }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyEpisodeFromRenderedScenes } from "../_shared/thirtyDaysSeriesEngine.js";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "content-type": "application/json",
};

type SceneCtx = { index?: number; day?: number; dayScene?: number; title?: string; beatType?: string; protagonistAction?: string; storyDevelopment?: string; mainAction?: string; visualEvent?: string; visualObservation?: string; startState?: string; endState?: string; continuityFromPrevious?: string; setupForNext?: string; timeOfDay?: string };
type ClipCtx  = { index?: number; videoUrl?: string | null; durationSec?: number };
type ClipPrompt = { index: number; prompt: string };
type ClipFrame = { clip?: number; sampleIndex?: number; timeSec?: number; imageUrl?: string | null };
type ScriptClip = { clip: number; text: string };
type ScriptClaim = { claim: string; supportedByPreviousStory: boolean; supportedByCurrentPlan: boolean; supportedByVisuals: boolean };
type SeriesNarrationScene = { scene: number; day: number; narration: string };
type SeriesEpisodeScript = {
  episode_title: string;
  hook: string;
  day_split_after_scene: number;
  scenes: SeriesNarrationScene[];
  cliffhanger_thread: string;
};

const CLIP_COUNT = 8;
const LEGACY_CLIP_COUNT = 7;
const SAMPLES_PER_CLIP = 3;
// Hook + narration TOTAL word budget — not narration alone. A 44s Ninjago
// test clip proved denser scripts crowd out the visuals; keep this tight.
const HOOK_MIN_WORDS = 7;
const HOOK_MAX_WORDS = 10;
// The word budget is derived from the ACTUAL rendered visual duration, never
// a fixed number — provider clip length legitimately drifts 5.0-6.0s per
// clip (see probeClipDuration), so a fixed 80-100 word target (tuned for
// ~35s of clips) silently produced narration far shorter than a 42s episode,
// leaving a long silent tail the 0.85-1.15 playback-rate stretch can't hide.
// These rates are calibrated to this app's actual ElevenLabs settings
// (eleven_flash_v2_5, speed 0.92) at roughly 125-155 words per minute.
const WORDS_PER_SEC_MIN = 2.05;
const WORDS_PER_SEC_MAX = 2.55;
const TOTAL_WORDS_ABSOLUTE_FLOOR = 50;
const TOTAL_WORDS_ABSOLUTE_CEILING = 170;

function wordBudgetFor(visualDurationSec: number) {
  const min = Math.max(TOTAL_WORDS_ABSOLUTE_FLOOR, Math.round(visualDurationSec * WORDS_PER_SEC_MIN));
  const max = Math.min(TOTAL_WORDS_ABSOLUTE_CEILING, Math.max(min + 12, Math.round(visualDurationSec * WORDS_PER_SEC_MAX)));
  const ceiling = Math.min(TOTAL_WORDS_ABSOLUTE_CEILING + 10, max + 8);
  return { min, max, ceiling };
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function firstWords(value: string, limit: number) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, Math.max(0, limit)).join(" ");
}

function cleanLine(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const SERIES_BANNED_PHRASE = /\b(?:I felt|I sensed|the atmosphere thickened|the stakes felt higher|a surge of hope|I could sense|little did I know)\b/i;
const SERIES_STOCK_LEAD = /^(?:With the pressure building|Before I could catch my breath|I had to move fast|Everything shifted when|That was the moment|With no time to waste|By the end)\b/i;
const SERIES_DANGLING_WORD = /\b(?:and|the|a|of|to|with|so|but|that|as)[.!?]?$/i;
const SERIES_RESOLUTION = /\b(?:finally|at last|we were safe|it was over|the danger was gone|everything was over)\b/i;
const SERIES_PRESENT_TENSE = /\bI\s+(?:am|feel|sense|look|throw|run|see|hear|touch|ask|tell|lead|try|kneel|whisper|nod|reach|step|explain)\b/i;
const SERIES_CLIFFHANGER_ACTION = /\b(?:arrived|appeared|opened|emerged|approached|cracked|vanished|missing|shadow|footsteps|alarm|warning|called my name|froze|stopped|screamed|shattered|roared|moved|grabbed|collapsed|went dark|lit up|answered|was watching|stood behind)\b/i;
const TITLE_STOP_WORDS = new Set(["a", "an", "and", "at", "for", "from", "in", "into", "of", "on", "the", "to", "under", "with"]);
const DAY_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty"];

function normalizedText(value: unknown) {
  return cleanLine(value).toLowerCase().replace(/[^a-z0-9é]+/gi, " ").trim();
}

function narrationOutsideDialogue(value: unknown) {
  return cleanLine(value)
    .replace(/[“"][^”"]*[”"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleWords(value: unknown) {
  return normalizedText(value).split(/\s+/).filter((word) => word.length > 2 && !TITLE_STOP_WORDS.has(word));
}

function mentionsDay(value: unknown, day: number) {
  const word = DAY_WORDS[day] || String(day);
  return new RegExp(`\\bday\\s+(?:${day}|${word.replace("-", "[- ]")})\\b`, "i").test(cleanLine(value));
}

function beginsWithDayCue(value: unknown, day: number) {
  const word = DAY_WORDS[day] || String(day);
  return new RegExp(`^day\\s+(?:${day}|${word.replace("-", "[- ]")})[.!?]`, "i").test(cleanLine(value));
}

function previousNarrationLines(priorEpisodes: any[]) {
  return priorEpisodes.flatMap((episode) => {
    const storedClips = episode?.narration_take?.captionScript?.scenes || episode?.narration_take?.captionScript?.clips;
    if (Array.isArray(storedClips)) return storedClips.map((item: any) => cleanLine(item?.narration || item?.text)).filter(Boolean);
    return String(episode?.narration || "").split(/\n+/).map(cleanLine).filter(Boolean);
  });
}

function validateSeriesEpisodeScript(candidate: SeriesEpisodeScript, input: {
  startDay: number;
  endDay: number;
  previousTitles: string[];
  previousHooks: string[];
  previousLines: string[];
  previousNarration: string;
}) {
  const issues: string[] = [];
  const title = cleanLine(candidate?.episode_title);
  const hook = cleanLine(candidate?.hook);
  const scenes = Array.isArray(candidate?.scenes) ? candidate.scenes : [];
  const titleTokens = titleWords(title);
  const previousTitleTokens = new Set(input.previousTitles.flatMap(titleWords));
  const hookWords = wordCount(hook);

  if (wordCount(title) < 2 || wordCount(title) > 5) issues.push("episode_title must contain 2-5 words.");
   if (titleTokens.some((word) => previousTitleTokens.has(word))) issues.push("episode_title reuses a significant word from an earlier title.");
  if (hookWords < 3 || hookWords >= 12) issues.push("hook must be under 12 words and still express a concrete conflict.");
  if (/^what if\b/i.test(hook)) issues.push('hook must not begin with "What if".');
  if (!mentionsDay(hook, input.startDay)) issues.push(`hook must naturally identify Day ${input.startDay}.`);
  if (input.previousHooks.some((previous) => normalizedText(previous) === normalizedText(hook))) issues.push("hook duplicates an earlier episode hook.");
  if (![3, 4].includes(Number(candidate?.day_split_after_scene))) issues.push("day_split_after_scene must be 3 or 4.");
  if (scenes.length !== 7) issues.push("exactly seven narrated scenes are required.");

  const seenScenes = new Set<number>();
  const previousLineSet = new Set(input.previousLines.map(normalizedText));
  for (const [index, scene] of scenes.entries()) {
    const expectedScene = index + 1;
    const narration = cleanLine(scene?.narration);
    const proseOutsideDialogue = narrationOutsideDialogue(narration);
    const words = wordCount(narration);
    if (Number(scene?.scene) !== expectedScene || seenScenes.has(Number(scene?.scene))) issues.push(`scene ${expectedScene} has an invalid scene number.`);
    seenScenes.add(Number(scene?.scene));
    if (words < 10 || words > 18) issues.push(`scene ${expectedScene} must contain 10-18 words; received ${words}.`);
    if (!/[.!?]$/.test(narration)) issues.push(`scene ${expectedScene} must end with complete punctuation.`);
    if (SERIES_DANGLING_WORD.test(narration)) issues.push(`scene ${expectedScene} ends in a dangling word or clause.`);
    if (SERIES_BANNED_PHRASE.test(narration)) issues.push(`scene ${expectedScene} contains a banned phrase.`);
    if (SERIES_STOCK_LEAD.test(narration)) issues.push(`scene ${expectedScene} begins with a removed stock transition.`);
    if (SERIES_PRESENT_TENSE.test(proseOutsideDialogue)) issues.push(`scene ${expectedScene} breaks first-person past tense.`);
    if (/\b(?:you|your|yours|yourself)\b/i.test(proseOutsideDialogue)) issues.push(`scene ${expectedScene} addresses the viewer instead of using first person.`);
    if (previousLineSet.has(normalizedText(narration))) issues.push(`scene ${expectedScene} duplicates narration from an earlier episode.`);
    const expectedDay = input.startDay === input.endDay || expectedScene <= Number(candidate.day_split_after_scene) ? input.startDay : input.endDay;
    if (Number(scene?.day) !== expectedDay) issues.push(`scene ${expectedScene} has the wrong day number.`);
  }

  if (scenes[0] && /^(?:As|With)\b/i.test(cleanLine(scenes[0].narration))) issues.push("scene 1 must cold-open mid-action, never with As or With.");
  if (input.endDay > input.startDay && scenes.length === 7) {
    const splitIndex = Number(candidate.day_split_after_scene);
    if (!beginsWithDayCue(scenes[splitIndex]?.narration, input.endDay)) issues.push(`the first scene after the split must open with a spoken Day ${input.endDay} cue.`);
  }
  const finalNarration = cleanLine(scenes[6]?.narration);
  if (SERIES_RESOLUTION.test(finalNarration)) issues.push("scene 7 resolves or summarizes the episode instead of ending on a cliffhanger.");
  if (!/[?]$/.test(finalNarration) && !SERIES_CLIFFHANGER_ACTION.test(finalNarration)) {
    issues.push("scene 7 needs an unanswered question, interrupted reveal, or arriving threat.");
  }
  if (!cleanLine(candidate?.cliffhanger_thread)) issues.push("cliffhanger_thread is required.");

  const totalWords = hookWords + scenes.reduce((sum, scene) => sum + wordCount(cleanLine(scene?.narration)), 0);
  if (totalWords < 100 || totalWords > 115) issues.push(`the complete spoken episode must contain 100-115 words; received ${totalWords}.`);
  const currentNarration = scenes.map((scene) => cleanLine(scene?.narration)).join("\n");
  if (input.previousNarration && normalizedText(currentNarration) === normalizedText(input.previousNarration)) issues.push("the regenerated narration is identical to the saved draft.");
  return issues;
}

const INTERNAL_NARRATION_TOKEN = /\b(?:qa[_ -]?unavailable|qa[_ -]?warning|qa[_ -]?failed|verified usable|identity[_ -]?drift|pov[_ -]?violation|near[_ -]?duplicate|scene[_ -]?\d+[_ -]?character[_ -]?entity[_ -]?missing)\b/i;
const NARRATION_TIME_BRIDGE = /\b(?:next (?:day|morning)|following morning|overnight|slept|sleep|rested|woke|waking|after (?:a|the) night|by (?:dawn|sunrise)|at (?:dawn|sunrise)|daybreak|hours later|after (?:the )?(?:journey|trip|travel|wait|recovery|treatment))\b/i;
const META_VISUAL_DESCRIPTION = /\b(?:the image (?:shows|depicts)|the (?:scene|frame) (?:shows|depicts)|a (?:wide|close|medium) shot|a LEGO scene depicting|scene depicting|rendered (?:scene|image)|minifigures?, including)\b/i;

function storyFact(value: unknown) {
  const fact = cleanLine(value);
  return fact && !INTERNAL_NARRATION_TOKEN.test(fact) && !META_VISUAL_DESCRIPTION.test(fact) ? fact : "";
}

const stringArray = (value: unknown) => Array.isArray(value) ? value.map(cleanLine).filter(Boolean) : [];
const uniqueStrings = (values: string[]) => [...new Set(values.filter(Boolean))];

function accumulatedSeriesState(series: any, priorEpisodes: any[], currentEpisode: any) {
  const verifiedState = series?.verified_story_state || series?.current_story_state || {};
  const summaryFor = (episode: any) => {
    const planned = episode?.episode_summary || {};
    const verified = episode?.verified_episode || {};
    // Rendered/verified events are the only trustworthy source for a recap.
    // Planner prose can be stale or describe a beat that the final clips did
    // not actually show.
    return {
      ...planned,
      ...verified,
      events: stringArray(verified.events).length ? stringArray(verified.events) : stringArray(planned.events),
    };
  };
  const summaries = priorEpisodes.map(summaryFor).filter(Boolean);
  const previous = priorEpisodes.at(-1) || null;
  const previousSummary = previous ? summaryFor(previous) : null;
  const introduced = uniqueStrings(summaries.flatMap((summary) => stringArray(summary.charactersIntroduced)));
  const companions = uniqueStrings(summaries.flatMap((summary) => stringArray(summary.companions)));
  const acquisitionDay = Number(series?.master_story_bible?.growthArc?.acquisitionDay);
  const previousEndDay = Number(previous?.end_day || 0);
  if (series?.master_story_bible?.growthArc?.identity && acquisitionDay > 0 && acquisitionDay <= previousEndDay) {
    companions.push(cleanLine(series.master_story_bible.growthArc.identity));
  }
  const introducedMysteries = uniqueStrings(summaries.flatMap((summary) => stringArray(summary.mysteriesIntroduced)));
  const resolvedMysteries = new Set(summaries.flatMap((summary) => stringArray(summary.mysteriesResolved)).map((value) => value.toLowerCase()));
  return {
    previousEpisode: previous,
    previousEpisodeSummary: previousSummary,
    previousEpisodeCliffhanger: cleanLine(previous?.cliffhanger_thread || previous?.cliffhanger || previousSummary?.cliffhanger),
    endingLocation: cleanLine(previousSummary?.endingLocation)
      || stringArray(previousSummary?.locationsVisited).at(-1) || "",
    protagonistState: cleanLine(previous?.episode_summary?.protagonistState),
    companions: uniqueStrings([...(verifiedState.entities || []).filter((entity: any) => ["companion", "teammate", "pet"].includes(entity.entityType) && entity.status !== "inactive").map((entity: any) => entity.displayName), ...companions]),
    cast: uniqueStrings([...(verifiedState.entities || []).filter((entity: any) => entity.status !== "inactive").map((entity: any) => entity.displayName), ...introduced, ...companions]),
    relationships: uniqueStrings([...(Object.values(verifiedState.relationships || {}).map(cleanLine)), ...summaries.flatMap((summary) => [
      ...stringArray(summary.relationships), ...stringArray(summary.relationshipChanges),
    ])]),
    items: uniqueStrings([...stringArray(verifiedState.inventory), ...summaries.flatMap((summary) => [...stringArray(summary.items), ...stringArray(summary.itemsChanged)])]),
    abilities: uniqueStrings([...stringArray(verifiedState.abilities), ...summaries.flatMap((summary) => [...stringArray(summary.abilities), ...stringArray(summary.powersChanged)])]),
    knownInformation: uniqueStrings(summaries.flatMap((summary) => [
      ...stringArray(summary.knownInformation), ...stringArray(summary.events), ...stringArray(summary.mysteriesResolved),
    ])),
    unresolvedMysteries: uniqueStrings([
      ...summaries.flatMap((summary) => stringArray(summary.unresolvedMysteries)),
      ...introducedMysteries.filter((mystery) => !resolvedMysteries.has(mystery.toLowerCase())),
    ]),
    currentEpisodePlan: currentEpisode?.story_plan || {},
    currentEpisode,
    verifiedStoryState: verifiedState,
    currentVerifiedEpisode: currentEpisode?.verified_episode ? {
      ...currentEpisode.verified_episode,
      events: stringArray(currentEpisode.verified_episode.events).map(storyFact).filter(Boolean),
      observations: (currentEpisode.verified_episode.observations || []).filter((item: any) => storyFact(item?.observation)),
    } : null,
    currentRenderObservations: (currentEpisode?.render_observations || []).filter((item: any) => storyFact(item?.observation)),
  };
}

function previousEpisodeMainPayoff(summary: any, cliffhanger: unknown) {
  const events = stringArray(summary?.events).map(storyFact).filter(Boolean);
  const irreversible = /\b(?:caught|catch|rescued|rescue|saved|save|earned|earn|found|find|discovered|discover|joined|join|befriended|befriend|formed|form|unlocked|unlock|defeated|defeat|escaped|escape)\b/i;
  return toFirstPersonPast(events.find((event) => irreversible.test(event)) || events.at(-1) || cliffhanger);
}

// A series' identity must be immediately clear in every episode. This is
// deliberately fixed rather than generated from a previous-event summary:
// summaries are internal data and were the source of malformed hooks such as
// "what me discovered".
function seriesEpisodeHook(franchise: string, episodeNumber: number) {
  return `What if you went to ${cleanLine(franchise)} for 30 Days? Episode ${Math.max(1, Number(episodeNumber) || 1)}.`;
}

function toFirstPerson(value: unknown) {
  return cleanLine(value)
    .replace(/^You and ([A-Z][A-Za-z0-9'’-]+)\b/, "$1 and I")
    .replace(/\byourself\b/gi, "myself")
    .replace(/\byours\b/gi, "mine")
    .replace(/\byour\b/gi, "my")
    .replace(/\bwhere you are\b/gi, "where I was")
    .replace(/\b(?:as|when|while|after|before|because|if) you\b/gi, (match) => `${match.split(/\s+/)[0]} I`)
    .replace(/\band you\b/gi, "and I")
    .replace(/^You\b/i, "I")
    .replace(/\byou\b/gi, "me");
}

function toFirstPersonPast(value: unknown) {
  return toFirstPerson(value)
    .replace(/\bwhat is happening\b/gi, "what was happening")
    .replace(/\band knock\b/gi, "and knocked")
    .replace(/\bit(?:'|’)s safe\b/gi, "it was safe")
    .replace(/\blets me\b/gi, "let me")
    .replace(/\boffers me\b/gi, "offered me")
    .replace(/^I look\b/i, "I looked")
    .replace(/^I squint\b/i, "I squinted")
    .replace(/^I reach\b/i, "I reached")
    .replace(/^I introduce\b/i, "I introduced")
    .replace(/^I move\b/i, "I moved")
    .replace(/^I approach\b/i, "I approached")
    .replace(/^I whisper\b/i, "I whispered")
    .replace(/^I wake\b/i, "I woke")
    .replace(/^I rush\b/i, "I rushed")
    .replace(/^I rescue\b/i, "I rescued")
    .replace(/^I catch\b/i, "I caught")
    .replace(/^I meet\b/i, "I met")
    .replace(/^I find\b/i, "I found")
    .replace(/^I hold\b/i, "I held")
    .replace(/^I decide\b/i, "I decided")
    .replace(/^I manage\b/i, "I managed")
    .replace(/^I calm\b/i, "I calmed")
    .replace(/^I enter\b/i, "I entered")
    .replace(/^I earn\b/i, "I earned")
    .replace(/^I arrive\b/i, "I arrived");
}

function fallbackNarration(universe: string, premise: string, scenes: SceneCtx[]) {
  const goal = firstWords(premise || `survive thirty days in ${universe}`, 5);
  const hook = `Could I ${firstWords(goal, 4)} in just thirty days?`;
  const ordered = scenes.slice().sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
  const day = (index: number, fallback: number) => Number(ordered[index]?.day) || fallback;
  if (ordered.length === LEGACY_CLIP_COUNT) {
    return {
      hook,
      clips: [
        { clip: 1, text: `Day ${day(0, 1)}, I entered ${universe} with one impossible goal.` },
        { clip: 2, text: `But then my first challenge proved I wasn't ready.` },
        { clip: 3, text: `A few days later, one risky move gave us a chance.` },
        { clip: 4, text: `That's when everything changed and our progress collapsed.` },
        { clip: 5, text: `By Day ${day(4, 20)}, I was cornered and ready to quit.` },
        { clip: 6, text: `So we risked everything on one final, desperate plan.` },
        { clip: 7, text: `On Day ${day(6, 30)}, it worked—I finally managed to ${goal}.` },
      ],
    };
  }
  const clips = [
    { clip: 1, text: `Day ${day(0, 1)}, I entered ${universe} with one impossible goal.` },
    { clip: 2, text: `But then my first challenge proved I wasn't ready.` },
    { clip: 3, text: `By Day ${day(2, 10)}, one risky move finally gave us a chance.` },
    { clip: 4, text: `For the first time, our plan worked and the enemy retreated.` },
    { clip: 5, text: `Everything changed on Day ${day(4, 20)}, when we uncovered the real threat.` },
    { clip: 6, text: `The discovery cost us everything, and I nearly gave up.` },
    { clip: 7, text: `So we risked everything on one final, desperate plan.` },
    { clip: 8, text: `On Day ${day(7, 30)}, it worked—I finally managed to ${goal}.` },
  ];
  return { hook, clips };
}

function normalizeScriptClips(value: unknown, clipCount = CLIP_COUNT, wordTargets: number[] = []) {
  if (!Array.isArray(value)) return [];
  const byClip = new Map<number, ScriptClip>();
  for (const raw of value) {
    const item = raw as { clip?: unknown; text?: unknown };
    const clip = Number(item?.clip);
    const text = cleanLine(item?.text);
    if (Number.isInteger(clip) && clip >= 1 && clip <= clipCount && text) byClip.set(clip, { clip, text });
  }
  const clips = Array.from({ length: clipCount }, (_, index) => byClip.get(index + 1)).filter(Boolean) as ScriptClip[];
  if (clips.length !== clipCount) return [];
  return clips.every((clip, index) => {
    const words = wordCount(clip.text);
    // TTS reads line boundaries as pauses. A line that begins in lowercase is
    // a chopped continuation ("joins us...", "of light...") and causes the
    // exact stilted narration reported in Series mode.
    const target = Number(wordTargets[index] || 0);
    const min = index === 0 && target > 0 && target < 6 ? 2 : 6;
    const max = target > 0 ? Math.min(15, target + 2) : 15;
    return words >= min && words <= max && !/^[a-z]/.test(clip.text.trim());
  }) ? clips : [];
}

function clipWordTargets(clips: ClipCtx[], clipCount: number, hook: string, seriesMode: boolean) {
  const durationByIndex = new Map(clips.map((clip) => [Number(clip.index), Math.max(1, Number(clip.durationSec) || 5)]));
  const hookWords = seriesMode ? wordCount(hook) : 0;
  return Array.from({ length: clipCount }, (_, index) => {
    const spokenCapacity = Math.max(1, Math.min(15, Math.round((durationByIndex.get(index) ?? 5) * 2.2)));
    // The fixed spoken hook plays at the start of Scene 1, so it consumes
    // Scene 1's word budget rather than making that first scene overrun.
    if (index === 0 && hookWords) return Math.max(2, Math.min(15, spokenCapacity - hookWords));
    return Math.max(6, spokenCapacity);
  });
}

function normalizeClaims(value: unknown): ScriptClaim[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw: any) => ({
    claim: cleanLine(raw?.claim),
    supportedByPreviousStory: raw?.supportedByPreviousStory === true,
    supportedByCurrentPlan: raw?.supportedByCurrentPlan === true,
    supportedByVisuals: raw?.supportedByVisuals === true,
  })).filter((claim) => claim.claim);
}

function storyViolations(hook: string, scriptClips: ScriptClip[], seriesMode: boolean, wordMin: number, wordMax: number, seriesStartDay = 1, seriesEndDay = 2, wordTargets: number[] = []) {
  const narration = scriptClips.map((clip) => clip.text).join(" ");
  const fullScript = `${hook} ${narration}`.trim();
  const totalWords = wordCount(fullScript);
  const dayStarts = scriptClips.filter((clip) => /^(?:day|by day|on day)\s+\d+\b/i.test(clip.text)).length;
  const dayMarkers = fullScript.match(/\b(?:days?|by day|on day)\s+\d+\b/gi)?.length ?? 0;
  const causalMatches = narration.match(/\b(?:but then|a few days later|that(?:'|’)s when|by day|everything changed when|so (?:we|i) had no choice|because|which meant|until|after that|then)\b/gi)?.length ?? 0;
  const genericMoral = /(?:journey was (?:the )?(?:real|true) victory|real prize|friends we made|what truly mattered|learned that|realized (?:that )?.{0,30}(?:journey|friendship|believe)|victory (?:was|is)n?'?t about)/i.test(scriptClips.at(-1)?.text ?? "");
  const malformedNarration = /\bwhat me\b|\b(?:professor|oak) and i oak\b|\b(?:i|we) (?:has|have) discovered\b|\b(?:the|a) glowing\s*[.!?]?$|\b(?:following closely by|a look|the eclipse's effects on pokemon)\s*[.!?]?$/i;
  const sceneCaptionStarts = scriptClips.filter((clip) => /^(?:now it(?:'|’)s day|that(?:'|’)s when|a little later|the next morning|but then|because of that|finally)\b/i.test(clip.text)).length;
  const brokenSeriesGrammar = /\b(?:i both|i all|my faces)\b|\bfocusing on\s*[.!?]|\bas\s+[A-Z][A-Za-z'-]{2,}\s*[.!?]/i.test(narration);
  const choppedCue = scriptClips.some((clip) => /^[a-z]/.test(clip.text.trim())
    || /^(?:[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)?)\.\s+(?:I|he|she|they|joins|walks|looks|steps|turns|scans|nods)\b/.test(clip.text.trim()));
  const clipTimingMismatch = wordTargets.some((target, index) => {
    const count = wordCount(scriptClips[index]?.text || "");
    const minimum = index === 0 && target < 6 ? 2 : Math.max(6, target - 2);
    return count < minimum || count > Math.min(15, target + 2);
  });
  // A series episode should mention each calendar day it covers exactly
  // once, right at that day's transition — never zero (no structure at all)
  // and never more than once per day (a "By Day 1... By Day 1..." checklist).
  // The old fixed limit of 5 was tuned for the standalone 30-day story (which
  // legitimately spans a whole month); a fixed 2 was closer but still wrong
  // for a 3- or 5-day-per-episode series. This now scales with the actual
  // number of days the episode covers, counted across hook+narration
  // together since the hook's day mention is one of the real markers, not a
  // freebie outside the budget.
  const seriesDayCount = seriesEndDay - seriesStartDay + 1;
  const dayStartLimit = seriesMode ? Math.min(3, seriesDayCount) : 5;
  const dayMarkerLimit = seriesMode ? Math.min(3, seriesDayCount) : 5;
  // Locked to first-person "I/me" only — a stray "you"/"we"/"your"/"our" mid
  // narration is exactly the mixed-person bug seen live ("So you approach..."
  // spliced into an "I" story). Checked as a real word, not a substring, so
  // it doesn't false-positive on words like "your" inside "yourself" — wait,
  // "yourself" legitimately contains "your"; \b(?:you|your|we|our|us)\b only
  // matches the standalone word, which is exactly the pronoun we're banning.
  const mixedPerson = seriesMode
    ? /\b(?:you|your|yours|yourself)\b/i.test(narration)
    : /\b(?:you|your|yours|we|our|ours|us)\b/i.test(fullScript);
  const violations: string[] = [];
  if (INTERNAL_NARRATION_TOKEN.test(fullScript)) violations.push("Internal QA/status tokens must never appear in viewer-facing narration.");
  if (totalWords < wordMin || totalWords > wordMax) violations.push(`The complete hook and narration must be ${wordMin}-${wordMax} words.`);
  if (mixedPerson) violations.push(seriesMode
    ? 'Series narration must stay in viewer-first-person: use I/me/my, with we/us/our allowed only for the protagonist and established companions; never address the viewer as you/your.'
    : 'Narration must use "I/me" only — remove every "you"/"we"/"your"/"our" and rewrite that clause in first person.');
  if (dayStarts > dayStartLimit) violations.push(seriesMode ? "Too many cue lines open with Day/By Day/On Day — it reads like a timeline checklist instead of one flowing story." : "Five or more cue lines begin with Day, so it reads like a timeline list.");
  if (dayMarkers > dayMarkerLimit) violations.push(seriesMode ? `Use at most ${dayMarkerLimit} explicit day markers for this episode.` : "Use no more than five day markers in the whole narration.");
  if (seriesMode) {
    const countDay = (day: number) => fullScript.match(new RegExp(`\\bDay\\s+${day}\\b`, "gi"))?.length ?? 0;
    if (seriesDayCount <= 2) {
      for (let day = seriesStartDay; day <= seriesEndDay; day += 1) {
        if (countDay(day) !== 1) violations.push(`Series narration must mark Day ${day} exactly once.`);
      }
    } else if (countDay(seriesStartDay) !== 1 || countDay(seriesEndDay) !== 1) {
      violations.push(`Longer Series episodes must mark Day ${seriesStartDay} and Day ${seriesEndDay} exactly once; intermediate day markers are optional.`);
    }
    if (seriesDayCount === 2) {
      const secondDayCue = scriptClips.findIndex((clip) => new RegExp(`\\bDay\\s+${seriesEndDay}\\b`, "i").test(clip.text));
      if (secondDayCue !== 3 && secondDayCue !== 4) {
        violations.push(`Day ${seriesEndDay} must begin around the middle of the episode, in cue 4 or 5, so it cannot be cut off at the ending.`);
      } else {
        const bridgeText = `${scriptClips[Math.max(0, secondDayCue - 1)]?.text || ""} ${scriptClips[secondDayCue]?.text || ""}`;
        if (!NARRATION_TIME_BRIDGE.test(bridgeText)) {
          violations.push(`The Day ${seriesStartDay} to Day ${seriesEndDay} transition needs a believable spoken time bridge, not just a new day label.`);
        }
      }
    }
  }
  if (causalMatches < 2) violations.push("The story needs at least two explicit causal transitions.");
  if (genericMoral) violations.push("The ending is a generic moral instead of the concrete payoff.");
  if (malformedNarration.test(narration)) violations.push("Narration contains a malformed or incomplete sentence; rewrite every cue as clear, natural spoken English.");
  if (META_VISUAL_DESCRIPTION.test(fullScript)) violations.push("Narration is describing an image instead of telling the story; replace camera/image wording with a first-person action and consequence.");
  if (seriesMode && sceneCaptionStarts >= 5) violations.push("Narration is seven scene captions instead of one continuous episode story; preserve the causal chain with complete sentences in each timing cue.");
  if (brokenSeriesGrammar) violations.push("Narration contains broken grammar (for example, 'I both', 'I all', 'my faces', 'focusing on.', or 'as Lloyd.'); rewrite it as natural spoken English.");
  if (choppedCue) violations.push("A timing cue starts or ends in the middle of a sentence/name. Every cue must be a complete grammatical spoken sentence.");
  if (clipTimingMismatch) violations.push("One or more cues do not fit their actual scene duration; rewrite to the supplied per-clip word budgets.");
  return violations;
}

function seriesContinuityViolations(hook: string, scriptClips: ScriptClip[], claims: ScriptClaim[], franchise: string, context: any) {
  const fullScript = `${hook} ${scriptClips.map((clip) => clip.text).join(" ")}`;
  const firstBeat = `${hook} ${scriptClips.slice(0, 2).map((clip) => clip.text).join(" ")}`.toLowerCase();
  const previousFacts = [
    context?.previousEpisodeCliffhanger,
    ...stringArray(context?.previousEpisodeSummary?.events),
    context?.endingLocation,
    ...stringArray(context?.companions),
  ].join(" ").toLowerCase();
  const anchorTerms = uniqueStrings(previousFacts.replace(/[^a-z0-9é\s]/gi, " ").split(/\s+/)
    .filter((word) => word.length >= 5 && !["episode", "pokemon", "pokémon", "legendary", "protagonist", "nearby", "world"].includes(word)));
  const vaguePattern = /\b(?:everything suddenly changed|only ally i could trust|first plan hit a bigger problem|one dangerous new plan|clue i had been missing|immediate danger (?:was|is) (?:finally )?stopped)\b/gi;
  const issues: string[] = [];
  const episodeNumber = Number(context?.currentEpisode?.episode_number || 1);
  const requiredHook = seriesEpisodeHook(franchise, episodeNumber);
  if (hook !== requiredHook) issues.push(`Series hook must be exactly "${requiredHook}".`);
  const namedEntities = uniqueStrings([
    ...stringArray(context?.companions), ...stringArray(context?.cast),
    ...stringArray(context?.currentEpisodePlan?.worldBible?.characters),
    ...(Array.isArray(context?.currentEpisodePlan?.scenes)
      ? context.currentEpisodePlan.scenes.flatMap((scene: any) => [...stringArray(scene?.characters), cleanLine(scene?.location)])
      : []),
  ]).filter((entity) => entity.length >= 4 && entity.toLowerCase() !== "you");
  if (context?.previousEpisode && anchorTerms.length && !anchorTerms.some((term) => firstBeat.includes(term))) {
    issues.push("The opening does not concretely reference the previous episode's ending, cast, location, or consequence.");
  }
  if (episodeNumber > 1 && !new RegExp(`^Now it(?:'|’)s Day ${Number(context?.currentEpisode?.start_day)}\\b`, "i").test(scriptClips[0]?.text || "")) {
    issues.push("Later episodes must begin cue one with the single spoken current-day transition.");
  }
  if (cleanLine(franchise) && !fullScript.toLocaleLowerCase().includes(cleanLine(franchise).toLocaleLowerCase())) {
    issues.push(`The resolved franchise name "${franchise}" must appear exactly as stored.`);
  }
  if (franchise === "Pokémon" && /\bpokemon go\b/i.test(fullScript)) issues.push('Use the resolved franchise name "Pokémon", not "Pokemon go".');
  if ((fullScript.match(vaguePattern) || []).length >= 2) issues.push("Two or more vague filler sentences appear without concrete nouns, actions, and consequences.");
  if (claims.length < scriptClips.length) issues.push("The claim audit must cover every narration cue.");
  if (claims.some((claim) => !claim.supportedByPreviousStory && !claim.supportedByCurrentPlan && !claim.supportedByVisuals)) {
    issues.push("At least one narration claim is unsupported by previous story, current plan, and rendered visuals.");
  }
  if (claims.some((claim) => namedEntities.some((entity) => claim.claim.toLowerCase().includes(entity.toLowerCase())) && !claim.supportedByVisuals)) {
    issues.push("A named character, companion, object, or location is narrated without support from the rendered visual evidence.");
  }
  return issues;
}

function buildClipAlignedTiming(hook: string, scriptClips: ScriptClip[], clips: ClipCtx[]) {
  const durationByIndex = new Map(clips.map((clip) => [Number(clip.index), Math.max(1, Number(clip.durationSec) || 5)]));
  const words: { word: string; start: number; end: number; clip: number }[] = [];
  const segments: { text: string; start: number; end: number; clip: number }[] = [];
  const clipSegments: { clip: number; text: string; start: number; end: number }[] = [];
  let cursor = 0;
  for (const scriptClip of scriptClips) {
    const duration = durationByIndex.get(scriptClip.clip - 1) ?? 5;
    const start = cursor;
    const end = cursor + duration;
    const text = scriptClip.clip === 1 ? `${hook} ${scriptClip.text}`.trim() : scriptClip.text;
    const tokens = text.split(/\s+/).filter(Boolean);
    const spokenStart = start + 0.08;
    const spokenEnd = Math.max(spokenStart + 0.2, end - 0.08);
    const secondsPerWord = (spokenEnd - spokenStart) / Math.max(tokens.length, 1);
    const timedWords = tokens.map((word, index) => ({
      word,
      start: Number((spokenStart + index * secondsPerWord).toFixed(2)),
      end: Number((spokenStart + (index + 1) * secondsPerWord).toFixed(2)),
      clip: scriptClip.clip,
    }));
    words.push(...timedWords);
    for (let index = 0; index < timedWords.length; index += 4) {
      const group = timedWords.slice(index, index + 4);
      segments.push({ text: group.map((item) => item.word).join(" "), start: group[0].start, end: group[group.length - 1].end, clip: scriptClip.clip });
    }
    clipSegments.push({ clip: scriptClip.clip, text, start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) });
    cursor = end;
  }
  return { words, segments, clipSegments, timingVersion: 4, timingSource: "thirty-days-rendered-clip-plan" };
}

function isMissingRpc(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "42883" || code === "PGRST202" || /could not find the function|does not exist/i.test(message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")   return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  let body: {
    generationId?: string; universe?: string; premise?: string; hook?: string;
    scenes?: SceneCtx[]; clips?: ClipCtx[]; clipPrompts?: ClipPrompt[]; clipFrames?: ClipFrame[];
    visualDurationSec?: number;
    shortenFrom?: { hook?: string; narration?: string };
    expandFrom?: { hook?: string; narration?: string };
    forceRegenerate?: boolean;
    previousNarration?: string;
    voiceId?: string;
    mode?: "single" | "series"; seriesId?: string; startDay?: number; endDay?: number;
    episodeId?: string; previousCliffhanger?: string; nextEpisodeTease?: string; forbiddenFutureBeats?: unknown[];
  } = {};
  try { body = await req.json(); } catch { /* empty body handled below */ }

  const forceRegenerate = body.forceRegenerate === true;
  const previousNarration = forceRegenerate ? cleanLine(body.previousNarration) : "";
  const narrationFingerprint = (value: string) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const generationId = String(body.generationId ?? "").trim();
  if (!generationId) return new Response(JSON.stringify({ error: "Missing generationId" }), { status: 400, headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  const { error: reserveError } = await supabase.rpc("reserve_thirty_days_service_request", {
    p_generation_id: generationId,
    p_kind: "script",
  });
  let reservationMade = !reserveError;
  if (reserveError && isMissingRpc(reserveError)) {
    const { data: ownedGeneration, error: ownershipError } = await supabase
      .from("thirty_days_generations")
      .select("id")
      .eq("id", generationId)
      .maybeSingle();
    if (ownershipError || !ownedGeneration) {
      return new Response(JSON.stringify({ error: "Creation access denied" }), { status: 403, headers: CORS });
    }
    reservationMade = false;
    console.warn("[thirty-days-script] service request RPC missing; continuing after RLS ownership check");
  } else if (reserveError) {
    const limited = String(reserveError.message ?? "").includes("SERVICE_LIMIT_REACHED");
    return new Response(JSON.stringify({ error: limited ? "Script regeneration limit reached for this creation" : "Creation access denied" }), { status: limited ? 429 : 403, headers: CORS });
  }

  const releaseReservation = async () => {
    if (!reservationMade) return;
    await admin.rpc("release_thirty_days_service_request", { p_generation_id: generationId, p_kind: "script" });
    reservationMade = false;
  };

  const { data: storedGeneration, error: generationError } = await admin
    .from("thirty_days_generations")
    .select("id,user_id,generation_mode,series_id,series_episode_id,universe,premise,hook,scenes")
    .eq("id", generationId).eq("user_id", user.id).maybeSingle();
  if (generationError || !storedGeneration) {
    await releaseReservation();
    return new Response(JSON.stringify({ error: "Creation access denied" }), { status: 403, headers: CORS });
  }

  const seriesMode = storedGeneration.generation_mode === "series_episode";
  let trustedSeriesContext: any = null;
  if (seriesMode) {
    const { data: series } = await admin.from("thirty_days_series")
      .select("id,user_id,title,universe,premise,days_per_episode,franchise_resolution,master_story_bible,hidden_future_beats,reference_library,entity_registry,roadmap_beats,pacing_state,verified_story_state,current_story_state,next_episode_tease")
      .eq("id", storedGeneration.series_id).eq("user_id", user.id).maybeSingle();
    const { data: initialEpisode } = await admin.from("thirty_days_series_episodes")
      .select("id,series_id,episode_number,start_day,end_day,title,hook,story_plan,state_delta,verified_episode,render_observations,verification_status,cliffhanger,cliffhanger_thread,day_split_after_scene,next_episode_tease,narration,narration_take,status")
      .eq("id", storedGeneration.series_episode_id).eq("user_id", user.id).maybeSingle();
    let episode = initialEpisode;
    if (!series || !episode || episode.series_id !== series.id) {
      await releaseReservation();
      return new Response(JSON.stringify({ error: "Series continuity context is missing" }), { status: 409, headers: CORS });
    }
    if (episode.verification_status !== "verified" || !Array.isArray(episode.verified_episode?.events) || !episode.verified_episode.events.length) {
      try {
        const verified = verifyEpisodeFromRenderedScenes({ episodeId: episode.id, plan: episode.story_plan || {}, scenes: storedGeneration.scenes || [] });
        const { data: committed, error: commitError } = await admin.rpc("service_commit_thirty_days_series_episode", {
          p_episode_id: episode.id,
          p_verified_episode: { ...verified, nextEpisodeSetup: episode.story_plan?.nextEpisodeTease || null },
          p_state_delta: episode.state_delta || episode.story_plan?.stateDelta || {},
          p_thumbnail_url: storedGeneration.scenes?.[0]?.imageUrl || null,
        });
        if (commitError) throw commitError;
        episode = committed;
      } catch (verificationError) {
        await releaseReservation();
        return new Response(JSON.stringify({ error: `Series narration verification could not finish: ${String((verificationError as Error)?.message || verificationError)}` }), { status: 409, headers: CORS });
      }
    }
    const { data: priorEpisodes } = await admin.from("thirty_days_series_episodes")
      .select("episode_number,start_day,end_day,title,hook,episode_summary,verified_episode,cliffhanger,cliffhanger_thread,next_episode_tease,narration,narration_take")
      .eq("series_id", series.id).eq("status", "completed").lt("episode_number", episode.episode_number)
      .order("episode_number", { ascending: true });
    const continuity = accumulatedSeriesState(series, priorEpisodes || [], episode);
    if (episode.episode_number > 1 && (!continuity.previousEpisodeSummary
      || !stringArray(continuity.previousEpisodeSummary.events).length
      || !continuity.previousEpisodeCliffhanger
      || Number(continuity.previousEpisode?.end_day) !== Number(episode.start_day) - 1)) {
      await releaseReservation();
      return new Response(JSON.stringify({ error: "Previous episode continuity is required before Series narration can be written" }), { status: 409, headers: CORS });
    }
    trustedSeriesContext = { series, episode, priorEpisodes: priorEpisodes || [], ...continuity };
    await admin.from("thirty_days_series_episodes").update({ tts_version: 2 }).eq("id", episode.id);
  }

  const resolvedWorldBible = trustedSeriesContext?.series?.master_story_bible?.worldBible || trustedSeriesContext?.episode?.story_plan?.worldBible || {};
  const universe = cleanLine(seriesMode ? (trustedSeriesContext.series.franchise_resolution?.resolvedFranchise || resolvedWorldBible.franchise || resolvedWorldBible.world || trustedSeriesContext.series.universe) : (body.universe ?? "this world")).slice(0, 120);
  const premise  = cleanLine(seriesMode ? trustedSeriesContext.series.premise : body.premise).slice(0, 300);
  const seriesStartDay = seriesMode ? Number(trustedSeriesContext.episode.start_day) : Math.max(1, Number(body.startDay) || Number(body.scenes?.[0]?.day) || 1);
  const seriesEndDay = seriesMode ? Number(trustedSeriesContext.episode.end_day) : Math.max(seriesStartDay, Number(body.endDay) || Number(body.scenes?.at(-1)?.day) || seriesStartDay);
  const previousCliffhanger = cleanLine(seriesMode ? trustedSeriesContext.previousEpisodeCliffhanger : body.previousCliffhanger).slice(0, 400);
  const nextEpisodeTease = cleanLine(seriesMode ? trustedSeriesContext.episode.next_episode_tease : body.nextEpisodeTease).slice(0, 400);
  const forbiddenFutureBeats = seriesMode
    ? (trustedSeriesContext.series.hidden_future_beats || []).filter((beat: any) => Number(beat.revealDay) > seriesEndDay)
    : (Array.isArray(body.forbiddenFutureBeats) ? body.forbiddenFutureBeats : []);
  const plannedHook = cleanLine(seriesMode ? trustedSeriesContext.episode.hook : body.hook).slice(0, 200);
  const trustedScenes = seriesMode
    ? (Array.isArray(storedGeneration.scenes) && storedGeneration.scenes.length ? storedGeneration.scenes : trustedSeriesContext.episode.story_plan?.scenes)
    : body.scenes;
  const requestedSceneCount = Array.isArray(trustedScenes) ? trustedScenes.length : 0;
  const clipCount = requestedSceneCount === LEGACY_CLIP_COUNT ? LEGACY_CLIP_COUNT : CLIP_COUNT;
  const visualDurationSec = Number(body.visualDurationSec) > 0 ? Number(body.visualDurationSec) : clipCount * 5;
  const wordBudget = wordBudgetFor(visualDurationSec);
  const shortenFrom = body.shortenFrom && (body.shortenFrom.hook || body.shortenFrom.narration)
    ? { hook: cleanLine(body.shortenFrom.hook), narration: cleanLine(body.shortenFrom.narration) }
    : null;
  const expandFrom = !shortenFrom && body.expandFrom && (body.expandFrom.hook || body.expandFrom.narration)
    ? { hook: cleanLine(body.expandFrom.hook), narration: cleanLine(body.expandFrom.narration) }
    : null;
  const scenes = Array.isArray(trustedScenes) ? trustedScenes : [];
  const clipPrompts = Array.isArray(body.clipPrompts) ? body.clipPrompts : [];
  const submittedFrames = (Array.isArray(body.clipFrames) ? body.clipFrames : [])
    .filter((frame) => {
      const clip = Number(frame?.clip);
      const sample = Number(frame?.sampleIndex);
      return clip >= 1 && clip <= clipCount
        && sample >= 1 && sample <= SAMPLES_PER_CLIP
        && typeof frame?.imageUrl === "string"
        && frame.imageUrl.startsWith("data:image/");
    })
    .sort((a, b) => Number(a.clip) - Number(b.clip) || Number(a.sampleIndex) - Number(b.sampleIndex))
    .slice(0, clipCount * SAMPLES_PER_CLIP);
  const submittedCoverage = new Set(submittedFrames.map((frame) => Number(frame.clip)));
  const storedSceneFrames: ClipFrame[] = seriesMode ? scenes
    .filter((scene: any) => Number.isInteger(Number(scene?.index)) && /^https:\/\//i.test(String(scene?.imageUrl || "")))
    .map((scene: any) => ({ clip: Number(scene.index) + 1, sampleIndex: 1, timeSec: 0, imageUrl: String(scene.imageUrl) })) : [];
  const clipFrames = submittedCoverage.size === clipCount ? submittedFrames : storedSceneFrames;
  const renderedCoverage = new Set(clipFrames.map((frame) => Number(frame.clip)));
  const hasRenderedFrames = seriesMode ? renderedCoverage.size === clipCount : clipFrames.length === clipCount * SAMPLES_PER_CLIP;
  if (seriesMode && !hasRenderedFrames && !shortenFrom && !expandFrom) {
    await releaseReservation();
    return new Response(JSON.stringify({ error: "Every Series scene needs rendered visual evidence before narration can be written" }), { status: 409, headers: CORS });
  }

  if (seriesMode) {
    const episodeNumber = Math.floor((seriesStartDay - 1) / Math.max(1, Number(trustedSeriesContext.series.days_per_episode) || 1)) + 1;
    const priorEpisodes = trustedSeriesContext.priorEpisodes || [];
    const previousTitles = priorEpisodes.map((episode: any) => cleanLine(episode.title)).filter(Boolean);
    const previousHooks = priorEpisodes.map((episode: any) => cleanLine(episode.hook)).filter(Boolean);
    const priorLines = previousNarrationLines(priorEpisodes);
    const savedNarration = cleanLine(trustedSeriesContext.episode.narration || previousNarration);
    const verifiedSceneDescriptions = scenes.map((scene: any, index: number) => ({
      scene: index + 1,
      plannedDay: Number(scene.day) || seriesStartDay,
      title: cleanLine(scene.title),
      visibleAction: cleanLine(scene.visualObservation || scene.mainAction || scene.protagonistAction || scene.storyDevelopment || scene.visualEvent),
      startState: cleanLine(scene.startState),
      endState: cleanLine(scene.endState),
      continuity: cleanLine(scene.continuityFromPrevious),
      characters: Array.isArray(scene.characters) ? scene.characters.map(cleanLine).filter(Boolean) : [],
      location: cleanLine(scene.location),
    }));
    const systemPrompt = [
      `You write one complete episode of a viral 30 Days short-form series for young viewers who scroll away the instant a line is confusing or slow.`,
      `Write the full episode as one continuous story, then divide that story into exactly seven scene beats. Never write seven independent captions.`,
      `Use first person and past tense consistently. Use concrete physical action and observable detail.`,
      `Scene 1 is a cold open mid-action. Never begin Scene 1 with "As" or "With" and never waste it on setup or scenery.`,
      `Scenes 2-5 must each reveal information, raise the stakes, or add an obstacle. Scene 6 is the turn that reframes the episode.`,
      `Scene 7 is an unresolved cliffhanger: an unanswered question, interrupted reveal, or arriving threat. Never resolve, summarize, or end on a feeling.`,
      `Never use: "I felt", "I sensed", "the atmosphere thickened", "the stakes felt higher", "a surge of hope", "I could sense", or "little did I know".`,
      `Never use the removed stock leads: "With the pressure building", "Before I could catch my breath", "I had to move fast", "Everything shifted when", "That was the moment", "With no time to waste", or "By the end".`,
      `Use real franchise vocabulary naturally and preserve every supplied character name, identity, relationship, pronoun, and spelling exactly. Never explain the franchise to outsiders.`,
      `Every scene narration must be a complete sentence of 10-18 words and end in punctuation. Never cut or slice a sentence.`,
      `For dependable timing, write EXACTLY 14 spoken words in each scene narration and 7-10 words in the hook. Count contractions as one word.`,
      `The hook plus all seven narration lines must total 100-115 spoken words.`,
      `The exact allocation above produces 105-108 total spoken words. Count every word before returning JSON.`,
      `Return JSON matching the supplied schema and nothing else.`,
    ].join("\n");
    const basePrompt = [
      `SERIES PREMISE: ${premise}`,
      `FRANCHISE: ${universe}`,
      `EPISODE NUMBER: ${episodeNumber} (derived from the stored episode position; do not renumber it)`,
      `COVERED DAYS: ${seriesStartDay === seriesEndDay ? `Day ${seriesStartDay}` : `Days ${seriesStartDay}-${seriesEndDay}`}`,
      `PERSISTENT REFERENCES AND FIXED SPELLINGS: ${JSON.stringify(trustedSeriesContext.series.reference_library || [])}`,
      `PERSISTENT ENTITY REGISTRY: ${JSON.stringify(trustedSeriesContext.series.entity_registry || [])}`,
      `WORLD BIBLE: ${JSON.stringify(trustedSeriesContext.series.master_story_bible?.worldBible || {})}`,
      `RUNNING SUMMARY OF EVERY PREVIOUS EPISODE: ${JSON.stringify(priorEpisodes.map((episode: any) => ({
        episode: episode.episode_number,
        days: [episode.start_day, episode.end_day],
        title: episode.title,
        summary: episode.verified_episode || episode.episode_summary,
        cliffhangerThread: episode.cliffhanger_thread || episode.cliffhanger,
      })))}`,
      `UNRESOLVED THREAD FROM THE PREVIOUS EPISODE: ${previousCliffhanger || "none; this is Episode 1"}`,
      `ALL PREVIOUS TITLES (do not reuse any significant word): ${JSON.stringify(previousTitles)}`,
      `ALL PREVIOUS HOOKS (do not repeat): ${JSON.stringify(previousHooks)}`,
      `CURRENT APPROVED EPISODE PLAN: ${JSON.stringify(trustedSeriesContext.currentEpisodePlan || {})}`,
      `SEVEN RENDERED SCENE DESCRIPTIONS IN ORDER: ${JSON.stringify(verifiedSceneDescriptions)}`,
      `FORBIDDEN FUTURE REVEALS: ${JSON.stringify(forbiddenFutureBeats)}`,
      `Write a unique 2-5 word episode_title naming this episode's specific event without sharing a significant word with an earlier title.`,
      `Write a unique hook under 12 words. It must mention Day ${seriesStartDay} naturally and open on this episode's concrete tension or question. Never begin it with "What if you went to".`,
      `WORD ALLOCATION: write exactly 14 words for each of the seven narration lines and 7-10 words for the hook. Count the words yourself before returning JSON.`,
      `Pick day_split_after_scene as 3 or 4. Scenes through that number are Day ${seriesStartDay}; later scenes are Day ${seriesEndDay}. The first later scene must begin with a spoken cue such as "Day ${DAY_WORDS[seriesEndDay] || seriesEndDay}."`,
      `Return: {"episode_title":"...","hook":"...","day_split_after_scene":3,"scenes":[{"scene":1,"day":${seriesStartDay},"narration":"..."}],"cliffhanger_thread":"the exact unresolved question, reveal, or threat carried forward"}`,
      forceRegenerate ? `This is a fresh-draft request. Produce genuinely new phrasing and structure; do not return the stored draft.` : "",
    ].filter(Boolean).join("\n\n");

    let validationFeedback = "";
    let lastIssues: string[] = [];
    const maxSeriesAttempts = 4;
    for (let attempt = 1; attempt <= maxSeriesAttempts; attempt += 1) {
      const prompt = `${basePrompt}${validationFeedback}`;
      console.log(`[thirty-days-script] EPISODE ${episodeNumber} FULL PROMPT ATTEMPT ${attempt}\n${systemPrompt}\n\n${prompt}`);
      const requestContent: any[] = [{ type: "text", text: prompt }];
      if (hasRenderedFrames) {
        for (const frame of clipFrames) {
          requestContent.push({ type: "text", text: `Rendered evidence for Scene ${frame.clip}, sample ${frame.sampleIndex}:` });
          requestContent.push({ type: "image_url", image_url: { url: String(frame.imageUrl), detail: "low" } });
        }
      }

      let seriesResponse: Response;
      try {
        seriesResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: hasRenderedFrames ? "gpt-4o" : "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: hasRenderedFrames && attempt === 1 ? requestContent : prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "thirty_days_series_episode_script",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    episode_title: { type: "string", description: "A unique 2-5 word title." },
                    hook: { type: "string", description: "A 7-10 word hook that naturally says the stored start day." },
                    day_split_after_scene: { type: "integer", enum: [3, 4] },
                    scenes: {
                      type: "array", minItems: 7, maxItems: 7,
                      items: {
                        type: "object", additionalProperties: false,
                        properties: {
                          scene: { type: "integer", minimum: 1, maximum: 7 },
                          day: { type: "integer", minimum: 1, maximum: 30 },
                          narration: { type: "string", description: "One complete, visually grounded sentence of exactly 14 spoken words." },
                        },
                        required: ["scene", "day", "narration"],
                      },
                    },
                    cliffhanger_thread: { type: "string" },
                  },
                  required: ["episode_title", "hook", "day_split_after_scene", "scenes", "cliffhanger_thread"],
                },
              },
            },
            max_tokens: 1400,
            temperature: forceRegenerate ? 0.85 : 0.7,
          }),
        });
      } catch (error) {
        lastIssues = [`Writer request failed: ${String((error as Error)?.message || error)}`];
        validationFeedback = `\n\nTHE LAST ATTEMPT FAILED. Rewrite the entire episode and fix: ${lastIssues.join("; ")}`;
        continue;
      }

      const raw = seriesResponse.ok
        ? String((await seriesResponse.json())?.choices?.[0]?.message?.content || "")
        : await seriesResponse.text().catch(() => "");
      console.log(`[thirty-days-script] EPISODE ${episodeNumber} RAW JSON ATTEMPT ${attempt}\n${raw}`);
      if (!seriesResponse.ok) {
        lastIssues = [`Writer returned HTTP ${seriesResponse.status}.`];
        validationFeedback = `\n\nTHE LAST ATTEMPT FAILED. Rewrite the entire episode and satisfy every rule.`;
        continue;
      }

      let candidate: SeriesEpisodeScript;
      try {
        const parsed = JSON.parse(raw);
        candidate = {
          episode_title: cleanLine(parsed.episode_title),
          hook: cleanLine(parsed.hook),
          day_split_after_scene: Number(parsed.day_split_after_scene),
          scenes: Array.isArray(parsed.scenes) ? parsed.scenes.map((scene: any) => ({
            scene: Number(scene.scene), day: Number(scene.day), narration: cleanLine(scene.narration),
          })) : [],
          cliffhanger_thread: cleanLine(parsed.cliffhanger_thread),
        };
      } catch (error) {
        lastIssues = [`Response was not valid JSON: ${String((error as Error)?.message || error)}`];
        validationFeedback = `\n\nTHE LAST ATTEMPT FAILED. Return valid JSON only and rewrite the entire episode.`;
        continue;
      }

      lastIssues = validateSeriesEpisodeScript(candidate, {
        startDay: seriesStartDay,
        endDay: seriesEndDay,
        previousTitles,
        previousHooks,
        previousLines: priorLines,
        previousNarration: savedNarration,
      });
      if (lastIssues.length) {
        console.warn(`[thirty-days-script] EPISODE ${episodeNumber} VALIDATION ATTEMPT ${attempt}`, lastIssues);
        validationFeedback = [
          `\n\nTHE DRAFT BELOW WAS REJECTED. Return the entire corrected JSON object, not commentary.`,
          `Keep every visually grounded event, but directly edit the rejected lines and recount every line.`,
          `REJECTED DRAFT JSON: ${JSON.stringify(candidate)}`,
          `FIX EVERY ISSUE:`,
          `- ${lastIssues.join("\n- ")}`,
          `FINAL COUNT CHECK: hook 7-10 words; each scene exactly 14 words; combined total 105-108 words.`,
        ].join("\n");
        continue;
      }

      const scriptClips = candidate.scenes.map((scene) => ({ clip: scene.scene, text: scene.narration }));
      const narration = candidate.scenes.map((scene) => scene.narration).join("\n");
      const responsePayload = {
        episode_title: candidate.episode_title,
        episodeTitle: candidate.episode_title,
        hook: candidate.hook,
        narration,
        day_split_after_scene: candidate.day_split_after_scene,
        daySplitAfterScene: candidate.day_split_after_scene,
        scenes: candidate.scenes,
        cliffhanger_thread: candidate.cliffhanger_thread,
        cliffhangerThread: candidate.cliffhanger_thread,
        clips: scriptClips,
        ...buildClipAlignedTiming(candidate.hook, scriptClips, Array.isArray(body.clips) ? body.clips : []),
        fallback: false,
        ttsVersion: 3,
      };
      const draftTake = {
        draft: true,
        hook: candidate.hook,
        narration,
        script: `${candidate.hook} ${narration}`.trim(),
        voiceId: cleanLine(body.voiceId),
        captionScript: responsePayload,
        audioUrl: null,
        createdAt: new Date().toISOString(),
      };
      const { error: generationSaveError } = await admin.from("thirty_days_generations").update({
        title: candidate.episode_title,
        hook: candidate.hook,
        narration_script: `${candidate.hook} ${narration}`.trim(),
        narration_take: draftTake,
        updated_at: new Date().toISOString(),
      }).eq("id", generationId).eq("user_id", user.id);
      const { error: episodeSaveError } = await admin.from("thirty_days_series_episodes").update({
        title: candidate.episode_title,
        hook: candidate.hook,
        narration,
        narration_take: draftTake,
        cliffhanger_thread: candidate.cliffhanger_thread,
        cliffhanger: candidate.cliffhanger_thread,
        day_split_after_scene: candidate.day_split_after_scene,
        tts_version: 3,
        updated_at: new Date().toISOString(),
      }).eq("id", trustedSeriesContext.episode.id).eq("user_id", user.id);
      if (generationSaveError || episodeSaveError) {
        await releaseReservation();
        console.error("[thirty-days-script] narration persistence failed", generationSaveError || episodeSaveError);
        return new Response(JSON.stringify({ error: "The episode script was written but could not be saved to its episode." }), { status: 500, headers: CORS });
      }
      return new Response(JSON.stringify(responsePayload), { status: 200, headers: CORS });
    }

    await releaseReservation();
    return new Response(JSON.stringify({
      error: `The full episode did not pass narration quality checks after ${maxSeriesAttempts} drafts.`,
      validation: lastIssues,
    }), { status: 422, headers: CORS });
  }

  const dayByIndex = new Map<number, { day: number; dayScene: number; title: string; action: string; startState: string; endState: string; continuity: string; timeOfDay: string }>();
  for (const scene of scenes) {
    const idx = Number(scene.index ?? -1);
    if (idx >= 0) dayByIndex.set(idx, {
      day: Number(scene.day) || idx + 1,
      dayScene: Number(scene.dayScene) || idx % 2 + 1,
      title: cleanLine(scene.title),
      action: cleanLine(scene.mainAction || scene.protagonistAction || scene.storyDevelopment),
      startState: cleanLine(scene.startState),
      endState: cleanLine(scene.endState),
      continuity: cleanLine(scene.continuityFromPrevious),
      timeOfDay: cleanLine(scene.timeOfDay),
    });
  }

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } };
  const userContent: ContentPart[] = [];

  const seriesRange = seriesStartDay === seriesEndDay ? `Day ${seriesStartDay}` : `Days ${seriesStartDay}-${seriesEndDay}`;
  const seriesDayCount = seriesEndDay - seriesStartDay + 1;
  const seriesEpisodeNumber = seriesMode ? Number(trustedSeriesContext.episode.episode_number || 1) : 0;
  const fixedSeriesHook = seriesMode ? seriesEpisodeHook(universe, seriesEpisodeNumber) : "";
  const perClipWordTargets = clipWordTargets(Array.isArray(body.clips) ? body.clips : [], clipCount, fixedSeriesHook, seriesMode);
  const approvedEpisodeStory = seriesMode ? cleanLine(trustedSeriesContext.episode.story_plan?.episodeStory) : "";
  const seriesContinuityBlock = seriesMode ? [
    `TRUSTED SERIES CONTINUITY (loaded server-side; mandatory, never replace it with assumptions):`,
    `Resolved franchise name: ${universe}`,
    `Resolution audit: ${JSON.stringify(trustedSeriesContext.series.franchise_resolution)}`,
    `Series bible: ${JSON.stringify(trustedSeriesContext.series.master_story_bible?.worldBible || {})}`,
    `Master 30-day roadmap: ${JSON.stringify(trustedSeriesContext.series.master_story_bible?.roadmap || [])}`,
    `Current day range: ${seriesRange}`,
    `Previous episode structured summary: ${JSON.stringify(trustedSeriesContext.previousEpisodeSummary)}`,
    `Previous episode cliffhanger: ${previousCliffhanger || "none — this is Episode 1"}`,
    `Current protagonist state: ${trustedSeriesContext.protagonistState || "series beginning"}`,
    `Persistent entities and active forms: ${JSON.stringify(trustedSeriesContext.series.entity_registry || [])}`,
    `Verified story state: ${JSON.stringify(trustedSeriesContext.verifiedStoryState || {})}`,
    `Allowed roadmap slice: ${JSON.stringify((trustedSeriesContext.series.roadmap_beats || []).filter((beat: any) => Number(beat.notBeforeDay || 1) <= seriesEndDay && Number(beat.mustResolveByDay || 30) >= seriesStartDay))}`,
    `Current verified episode story events: ${JSON.stringify(trustedSeriesContext.currentVerifiedEpisode?.events || [])}`,
    `APPROVED CONTINUOUS EPISODE STORY (this is the narration's primary source; scenes only illustrate it): ${approvedEpisodeStory || "No stored story yet—derive one continuous causal episode from the current plan before writing timing cues."}`,
    `Current companions/cast: ${JSON.stringify({ companions: trustedSeriesContext.companions, cast: trustedSeriesContext.cast, relationships: trustedSeriesContext.relationships })}`,
    `Current inventory/items/powers: ${JSON.stringify({ items: trustedSeriesContext.items, abilities: trustedSeriesContext.abilities })}`,
    `Unresolved mysteries: ${JSON.stringify(trustedSeriesContext.unresolvedMysteries)}`,
    `Known information: ${JSON.stringify(trustedSeriesContext.knownInformation)}`,
    `Current episode plan: ${JSON.stringify(trustedSeriesContext.currentEpisodePlan)}`,
    `Validated next-episode tease: ${nextEpisodeTease || "none — resolve the final episode"}`,
    `Every episode uses the same fixed series hook. The first narration cue, not the hook, continues the previous episode's ending. Planned episode story + previous continuity + actual visual evidence are the only allowed sources of story claims.`,
  ].join("\n") : "";
  const openingTask = seriesMode
    ? `You are writing ONE viral episode of an ongoing "30 Days in ${universe}" series. This episode covers only ${seriesRange}.`
    : `You are writing a viral TikTok/Shorts voiceover for a "30 Days in ${universe}" short story.`;
  const hookTask = seriesMode
    ? `1. "hook": return this EXACT text, with no recap or variation: "${fixedSeriesHook}".`
    : `1. "hook": one punchy sentence asking "What would happen if..." framed around the premise, naming "${universe}" by name, ${HOOK_MIN_WORDS}-${HOOK_MAX_WORDS} words (or reuse this exact hook if it already fits: "${plannedHook || "none provided"}").`;
  const arcRule = seriesMode
    ? `• Build one episode-sized causal chain: HOOK → SETUP → DEVELOPMENT → PROBLEM/CHANGE → TURN → MINI-PAYOFF → STORY-LINKED CLIFFHANGER. Only discuss information available by ${seriesRange}.`
    : `• Build one irreversible causal chain: GOAL → SETBACK → ESCALATION → CLIMAX → PAYOFF. Events must depend on what came before, so the lines could not be rearranged without breaking the story.`;
  const endingRule = seriesMode
    ? (seriesEndDay >= 30
      ? `• This is the final episode: resolve the original 30-day premise concretely and do not tease Day 31.`
      : `• End on this planned, story-linked anticipation beat without inventing a random threat: ${nextEpisodeTease || "use the final rendered scene"}. Give viewers a concrete reason to watch the next episode.`)
    : `• The climax and final line MUST answer the hook's actual question. If the goal is to beat Ash, explicitly say whether Ash was beaten. Never substitute a generic moral like "the journey was the real victory."`;

  userContent.push({
    type: "text",
    text: [
      shortenFrom
        ? `You previously wrote this ${seriesMode ? "series episode" : `"30 Days in ${universe}" voiceover`}, but it ran longer than the actual finished video (${visualDurationSec.toFixed(1)}s of visuals). SHORTEN it without changing events or revealing future information.\nPREVIOUS HOOK: ${shortenFrom.hook}\nPREVIOUS NARRATION: ${shortenFrom.narration}`
        : expandFrom
        ? `You previously wrote this ${seriesMode ? "series episode" : `"30 Days in ${universe}" voiceover`}, but it was too short and left silent video at the end of the actual finished video (${visualDurationSec.toFixed(1)}s of visuals). EXPAND it to reach the word target below WITHOUT changing events, inventing new facts, or padding with filler — add more concrete sensory/emotional detail to the existing beats, or one extra short causal beat if needed.\nPREVIOUS HOOK: ${expandFrom.hook}\nPREVIOUS NARRATION: ${expandFrom.narration}`
        : openingTask,
      `Premise: ${premise || "(see scene timeline below)"}. The narrator is the viewer-insert protagonist and tells this as what happened to them.`,
      forceRegenerate ? `FRESH-DRAFT REQUEST: Write genuinely new narration now. Preserve only supported events, but use a different sentence structure, transitions, phrasing, and emotional angle from the prior draft. Do not return a line-by-line rewrite.` : "",
      seriesMode
        ? `The finished episode is ${visualDurationSec.toFixed(1)} seconds across exactly ${clipCount} silent clips covering only ${seriesRange}.`
        : clipCount === CLIP_COUNT
        ? `The finished video is ${visualDurationSec.toFixed(1)} seconds of visuals — eight silent clips played back-to-back: two scenes each for Day 1, Day 10, Day 20, and Day 30.`
        : `This restored legacy creation has ${visualDurationSec.toFixed(1)} seconds of visuals across seven silent clips played back-to-back.`,
      seriesContinuityBlock,
      ``,
      `SCENE / DAY TIMELINE (this is what actually got rendered — trust it over the premise if they conflict):`,
      ...Array.from(dayByIndex.entries())
        .sort(([a], [b]) => a - b)
        .map(([idx, scene]) => `• Clip ${idx + 1} — Day ${scene.day}, scene ${scene.dayScene}, ${scene.timeOfDay || "time unspecified"}: ${scene.title || "(untitled scene)"}. START: ${scene.startState || "unspecified"}. ACTION: ${scene.action}. END: ${scene.endState || "unspecified"}. CONTINUITY: ${scene.continuity || "direct continuation"}.`),
      ``,
      `TASK: Write two things —`,
      hookTask,
      `2. "clips": exactly ${clipCount} objects numbered 1-${clipCount}. These are timing cues, NOT independent scene summaries. First write one compelling continuous story in your head from the APPROVED CONTINUOUS EPISODE STORY, then divide it into sequential, complete spoken sentences. Every cue must start with a capital letter and be one grammatical, self-contained sentence—never split a sentence, name, quote, or clause between cues. Narrate only the action visible in that clip; do not mention an action before or after its scene.`,
      `EXACT SPOKEN WORD BUDGET BY CLIP (calculated from the actual rendered clip durations; the fixed hook already uses Scene 1 time): ${perClipWordTargets.map((target, index) => `Clip ${index + 1}: ${target} words`).join(" | ")}. Stay within two words of each target.`,
      ``,
      `RULES:`,
      `• HOOK + NARRATION COMBINED MUST be ${wordBudget.min}-${wordBudget.max} words TOTAL — this is calibrated to fill all ${visualDurationSec.toFixed(1)}s of the actual finished video, not just a scene or two. The hook is included. Natural storytelling matters more than mentioning every scene or day.`,
      `• Use short, simple sentences. No complicated lore dumps, no long descriptions, no filler adjectives.`,
      seriesMode ? `• The COMPLETE narration must be polished grammatical spoken English. Every timing cue must independently be a complete sentence; never create fragments or broken prose such as "I both", "I all", "my faces", "focusing on.", "as Lloyd.", "Nova. I...", "joins us...", or "of light...".` : `• Every cue must be one complete grammatical sentence with a clear subject and finished action—never trail off as a fragment such as "a look" or "following closely by my".`,
      `• Write like someone excitedly telling a friend what happened—not reading bullet points from a timeline.`,
      seriesMode
        ? `• Use viewer-first-person narration throughout: I/me/my. We/us/our is allowed only when it clearly means the protagonist plus an established companion or cast member. Never address the viewer as you/your, and never switch perspective.`
        : `• Use first-person "I/me" narration ONLY, and lock it for the entire hook + narration — never switch to "you" or "we" anywhere, even for a single clause. Establish the protagonist and concrete goal immediately. Never narrate the crisis as a detached canon-only summary.`,
      `• Name "${universe}" by name once, naturally, in the hook or the very first line — enough that a viewer immediately understands exactly what world/franchise this is, never so much it reads like a label. Never leave the world unnamed and only implied by character names or props.`,
      `• Use the real, specific named characters from the scene timeline (never generic terms like "the ninja" or "an ally" when a real name is available).`,
      `• Keep the viewer protagonist causally involved across the whole story and include the emotional relationship anchor with the world/cast.`,
      seriesMode
        ? seriesDayCount <= 2
          ? `• This Series episode covers ${seriesRange}. Explicitly mark each covered day exactly once: ${Array.from({ length: seriesDayCount }, (_, offset) => `Day ${seriesStartDay + offset}`).join(" then ")}. Day ${seriesEndDay} must begin around cue 4 or 5—not in the final cue—and the transition must briefly state the real time bridge stored in the scene plan (for example, Oak let me sleep there; the next morning...). Preserve the causal chain across the time skip instead of abruptly changing topics.`
          : `• This Series episode covers ${seriesRange}. Explicitly mark Day ${seriesStartDay} and Day ${seriesEndDay} exactly once. You may mark one useful intermediate day, but do not announce all ${seriesDayCount} days like a checklist.`
        : `• Use only 3-5 day markers across the ENTIRE narration, and prefer natural transitions ("the next day," "a week later") over a bare "Day X." label. Never narrate every cue as "Day X. [scene summary]." Use timeline day numbers in order and do not invent new ones.`,
      arcRule,
      `• Connect events naturally with phrases such as "but then...", "a few days later...", "that's when...", "by Day 10...", "everything changed when...", or "so we had no choice but...". Use at least two explicit causal transitions.`,
      `• Describe concrete actions and their consequences. Avoid generic summaries such as "planning strategies", "training hard", "learning new skills", or "joined forces with friends" unless the visuals require them—and then say exactly what the characters did.`,
      seriesMode ? `• Ban vague filler such as "everything suddenly changed", "the only ally I could trust", "our plan hit a bigger problem", "one dangerous new plan", "the clue I had been missing", and "the immediate danger was stopped" unless the same sentence names the concrete character/object, action, and consequence.` : ``,
      seriesMode
        ? `• The seven rendered scenes support one mini-story; do not narrate Scene 1, then Scene 2, then Scene 3. Story/lore clarity beats visual-description coverage. Do not summarize future days or the entire 30-day arc.`
        : clipCount === CLIP_COUNT
        ? `• Mirror what's actually in the scene timeline, but omit secondary beats when necessary. Treat each same-day pair as event → consequence and do not flatten the story into eight equal updates.`
        : `• Mirror what's actually in the legacy scene timeline, but omit secondary beats when necessary. Do not flatten the story into equal timeline updates.`,
      `• Never describe camera angles, lighting, or "watch as" narration. Speak like someone telling a friend what happened, not describing a video.`,
      `• Never say "the image shows", "scene depicting", "wide shot", "minifigures including", or any other production/visual-analysis language. Translate the visible moment into a natural first-person action, reaction, or consequence.`,
      endingRule,
      seriesMode ? `• FORBIDDEN FUTURE BEATS — never reveal or name these before their planned day: ${JSON.stringify(forbiddenFutureBeats)}` : `• End with the concrete outcome/payoff shown or required by the premise, expressed with energy and specificity.`,
      seriesMode
        ? `• Before returning, audit every meaningful narration claim. Return JSON only: {"hook":"...","clips":[{"clip":1,"text":"..."},...],"claims":[{"claim":"...","supportedByPreviousStory":true,"supportedByCurrentPlan":true,"supportedByVisuals":false},...]}. Every claim needs at least one true support field; unsupported major claims must be repaired before return.`
        : `• Return JSON only: {"hook":"...","clips":[{"clip":1,"text":"..."},...,{"clip":8,"text":"..."}]}.`,
      hasRenderedFrames
        ? `Below is actual rendered visual evidence for every one of the ${clipCount} clips, in order (${clipFrames.length} frame${clipFrames.length === 1 ? "" : "s"} total). Use it to confirm what really rendered. Only mention a named character, object, or event when the visual evidence supports it; if a planned detail did not clearly render, narrate around it instead of inventing visibility.`
        : clipPrompts.length
        ? `No rendered frames were available; use the clip action descriptions below instead.`
        : ``,
      ...(clipPrompts.length && !hasRenderedFrames
        ? clipPrompts.slice(0, clipCount).map((cp) => `Clip ${cp.index + 1} action: ${String(cp.prompt).slice(0, 500)}`)
        : []),
    ].filter(Boolean).join("\n"),
  });

  if (hasRenderedFrames) {
    for (const frame of clipFrames) {
      const day = dayByIndex.get(Number(frame.clip) - 1)?.day ?? frame.clip;
      userContent.push({
        type: "text",
        text: `ACTUAL RENDER — clip ${frame.clip} (Day ${day}), sample ${frame.sampleIndex}, about ${Number(frame.timeSec).toFixed(1)}s into the clip:`,
      });
      userContent.push({ type: "image_url", image_url: { url: String(frame.imageUrl), detail: "low" } });
    }
    userContent.push({ type: "text", text: `Return the hook and ${clipCount} clip-aligned narration lines now:` });
  }

  const makeScriptResponse = (hook: string, scriptClips: ScriptClip[], fallback = false, claimAudit: ScriptClaim[] = []) => new Response(
    JSON.stringify({
      hook,
      narration: scriptClips.map((clip) => clip.text).join("\n"),
      clips: scriptClips,
      ...(seriesMode ? { claims: claimAudit } : {}),
      ...buildClipAlignedTiming(hook, scriptClips, Array.isArray(body.clips) ? body.clips : []),
      fallback,
      ...(seriesMode ? { ttsVersion: 2 } : {}),
    }),
    { status: 200, headers: CORS },
  );

  const fallbackBase = seriesMode ? null : fallbackNarration(universe, premise, scenes);
  const fallback = fallbackBase;
  // A regeneration must never overwrite the visible draft with the same
  // deterministic fallback.  If the model is unavailable, preserving the
  // current draft is much safer than pretending the button made a new one.
  const fallbackIsUnchanged = Boolean(
    forceRegenerate
    && fallback
    && narrationFingerprint(fallback.clips.map((clip) => clip.text).join(" ")) === narrationFingerprint(previousNarration),
  );
  const fallbackResponse = () => fallback && !fallbackIsUnchanged
    ? makeScriptResponse(fallback.hook, fallback.clips, true, "claims" in fallback ? fallback.claims : [])
    : new Response(JSON.stringify({
      error: fallbackIsUnchanged
        ? "A fresh narration draft could not be produced yet. Your current narration was kept unchanged—please try Regenerate prompt again."
        : "Narration could not be grounded in enough verified visual facts; retry episode verification",
    }), { status: 409, headers: CORS });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: hasRenderedFrames ? "gpt-4o" : "gpt-4o-mini",
        messages: [{ role: "user", content: hasRenderedFrames ? userContent : userContent[0].text }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "thirty_days_voiceover",
            strict: true,
            schema: {
              type: "object",
              properties: {
                hook: { type: "string" },
                clips: {
                  type: "array",
                  minItems: clipCount,
                  maxItems: clipCount,
                  items: {
                    type: "object",
                    properties: { clip: { type: "integer" }, text: { type: "string" } },
                    required: ["clip", "text"],
                    additionalProperties: false,
                  },
                },
                ...(seriesMode ? {
                  claims: {
                    type: "array", minItems: clipCount, maxItems: clipCount,
                    items: { type: "object", additionalProperties: false,
                      properties: {
                        claim: { type: "string" }, supportedByPreviousStory: { type: "boolean" },
                        supportedByCurrentPlan: { type: "boolean" }, supportedByVisuals: { type: "boolean" },
                      },
                      required: ["claim", "supportedByPreviousStory", "supportedByCurrentPlan", "supportedByVisuals"],
                    },
                  },
                } : {}),
              },
              required: seriesMode ? ["hook", "clips", "claims"] : ["hook", "clips"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: seriesMode ? 1400 : 700,
        temperature: forceRegenerate ? 0.8 : 0.5,
      }),
    });
  } catch (error) {
    await releaseReservation();
    console.error("[thirty-days-script] OpenAI request failed:", error);
    return fallbackResponse();
  }

  if (!res.ok) {
    await releaseReservation();
    const text = await res.text().catch(() => "");
    console.error("[thirty-days-script] OpenAI error:", res.status, text.slice(0, 300));
    return fallbackResponse();
  }

  const json = await res.json();
  const content = String(json.choices?.[0]?.message?.content ?? "").trim();
  let hook = "";
  let scriptClips: ScriptClip[] = [];
  let claims: ScriptClaim[] = [];
  // Kept separately from the strictly-validated scriptClips: normalizeScriptClips
  // is all-or-nothing (one clip a word outside 6-15 rejects every clip), which
  // previously meant a single malformed clip skipped the critic/repair pass
  // entirely and fell straight to the generic template — a "one strike and
  // you're out" bug identical in shape to the series planner's own first-draft
  // validation bug. The critic gets a real draft to fix instead of nothing.
  let rawClips: { clip: number; text: string }[] = [];
  try {
    const parsed = JSON.parse(content);
    hook = seriesMode
      ? seriesEpisodeHook(universe, seriesEpisodeNumber)
      : cleanLine(parsed?.hook);
    scriptClips = normalizeScriptClips(parsed?.clips, clipCount, perClipWordTargets);
    claims = normalizeClaims(parsed?.claims);
    if (Array.isArray(parsed?.clips)) {
      rawClips = parsed.clips
        .map((item: any) => ({ clip: Number(item?.clip), text: cleanLine(item?.text) }))
        .filter((item: any) => Number.isInteger(item.clip) && item.text);
    }
  } catch (error) {
    console.error("[thirty-days-script] invalid structured response:", error, content.slice(0, 300));
  }

  const totalWords = wordCount(hook) + scriptClips.reduce((sum, clip) => sum + wordCount(clip.text), 0);
  const usable = hook.length > 0 && scriptClips.length === clipCount && totalWords <= wordBudget.ceiling;
  // Only a total loss (no hook AND no clips at all) skips straight to the
  // template — anything with at least a hook or some clips gets a real shot
  // at the critic/repair pass below before giving up.
  if (!usable && !hook && !rawClips.length) {
    await releaseReservation();
    console.error("[thirty-days-script] first draft totally unusable (total words:", totalWords, "):", content.slice(0, 300));
    return fallbackResponse();
  }

  // One semantic critic pass catches failures that word counts cannot: eight
  // rearrangeable summaries, a missing causal chain, or an ending that dodges
  // the hook — and, per the fix above, also repairs a merely malformed first
  // draft (wrong clip count/length) instead of that alone forcing a fallback.
  const deterministicIssues = usable
    ? [
      ...storyViolations(hook, scriptClips, seriesMode, wordBudget.min, wordBudget.max, seriesStartDay, seriesEndDay, perClipWordTargets),
      ...(seriesMode ? seriesContinuityViolations(hook, scriptClips, claims, universe, trustedSeriesContext) : []),
      ...(forceRegenerate && narrationFingerprint(scriptClips.map((clip) => clip.text).join(" ")) === narrationFingerprint(previousNarration) ? ["Regeneration repeated the saved narration instead of producing a fresh draft."] : []),
    ]
    : [`The previous draft was structurally invalid (wrong clip count or a clip outside the 6-15 word range) — rewrite it as exactly ${clipCount} valid clips of 6-15 words each.`];
  const timeline = Array.from(dayByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([idx, scene]) => `Clip ${idx + 1}, Day ${scene.day} scene ${scene.dayScene}, ${scene.timeOfDay || "time unspecified"}: ${scene.title || "untitled"}. START: ${scene.startState}. ACTION: ${scene.action}. END: ${scene.endState}. CONTINUITY: ${scene.continuity}.`)
    .join("\n");
  const criticPrompt = [
    `You are the final critic for a ${seriesMode ? "single episode in an ongoing 30 Days series" : "30 Days short-form voiceover"}. Inspect the COMPLETE story, not each timing cue separately.`,
    seriesMode
      ? `Episode contract: cover only ${seriesRange}; resolved franchise is exactly "${universe}"; continue from ${JSON.stringify(trustedSeriesContext.previousEpisodeSummary || "series setup")} and cliffhanger "${previousCliffhanger || "series setup"}"; use current plan ${JSON.stringify(trustedSeriesContext.currentEpisodePlan)}; end only toward "${nextEpisodeTease || "the current plan's final beat"}"; never expose ${JSON.stringify(forbiddenFutureBeats)}.`
      : `Original premise/hook requirement: ${premise || plannedHook || `spend 30 days in ${universe}`}`,
    `Rendered timeline:\n${timeline}`,
    forceRegenerate ? `This is an explicit fresh-draft request. Retain only supported events while using a genuinely different structure, phrasing, and transitions from the prior draft.` : "",
    `Candidate hook: ${hook || "(missing — write one that satisfies the hook requirements)"}`,
    `Candidate timing cues:\n${(usable ? scriptClips : rawClips).map((clip) => `${clip.clip}. ${clip.text}`).join("\n") || "(none returned — write all clips fresh from the rendered timeline)"}`,
    deterministicIssues.length ? `Deterministic failures already found:\n- ${deterministicIssues.join("\n- ")}` : `No deterministic formatting failures were found; still perform the semantic checks below.`,
    `Reject the candidate if ANY condition is true:`,
    `- it contains internal system language such as qa_unavailable, qa_failed, qa_warning, verified usable, identity_drift, or another status/error code;`,
    seriesMode ? `- the hook is not exactly "${seriesEpisodeHook(universe, seriesEpisodeNumber)}";` : ``,
    `- the world "${universe}" is never named anywhere in the hook or narration, so a viewer could not tell what franchise/world this is from character names or props alone;`,
    `- narration perspective is mixed — any use of "you"/"your" in narration cues, or "we"/"our" without an established companion; the Episode 1 rhetorical "What if you..." hook is allowed;`,
    seriesMode ? (seriesDayCount <= 2
      ? `- Day ${seriesStartDay}${seriesEndDay === seriesStartDay ? "" : ` and Day ${seriesEndDay}`} are not each marked exactly once; Day ${seriesEndDay} begins later than cue 5; the day change lacks the scene plan's believable time bridge; or the day beats read like independent summaries;`
      : `- Day ${seriesStartDay} and Day ${seriesEndDay} are not each marked exactly once, more than one optional intermediate day is marked, or the day beats read like independent summaries;`) : `- five or more sentences/cues begin with "Day";`,
    `- it reads as independent scene summaries instead of one continuous story;`,
    seriesMode ? `- five or more timing cues start with scene-caption connectors such as "That's when", "A little later", "But then", "Because of that", or "Finally"; preserve continuous causality with complete sentences per clip instead;` : "",
    `- any cue has broken grammar, a wrong pronoun/verb pairing, repeated/reordered names, or an incomplete noun phrase. Examples to reject and rewrite: "what me discovered", "Professor and I Oak", "with Nova and the glowing", "following closely by my", or "a look";`,
    `- it has no causal transitions;`,
    seriesMode ? `- it lacks a concrete mini-payoff or ends without one specific, unresolved danger, discovery, decision, arrival, or question that makes the next episode necessary;` : `- its climax/final line does not concretely resolve the original hook;`,
    `- it ends with a generic moral rather than the actual outcome;`,
    `- its events could be rearranged without making the narration sound wrong;`,
    `- the hook plus narration is outside ${wordBudget.min}-${wordBudget.max} total words;`,
    seriesMode ? `- it narrates future days, reveals a forbidden future beat, or reads like a morning/noon/afternoon checklist.` : `- it uses more than five day markers.`,
    ...(seriesMode ? [
      `- its opening does not logically continue the previous episode's stored ending;`,
      `- it conflicts with the stored protagonist/cast/relationship/item/ability/mystery state;`,
      `- it uses "Pokemon go" or another title instead of the resolved franchise name "${universe}";`,
      `- two or more sentences use vague filler without a specific noun, action, and consequence;`,
      `- it mentions an undefined character, object, power, or future reveal unsupported by previous story, current plan, or actual rendered frames;`,
      `- the final tease is unsupported by the roadmap, an established mystery, or the current episode ending;`,
      `- Day ${seriesEndDay} does not causally follow Day ${seriesStartDay};`,
      `- its claim audit is missing, incomplete, or contains a claim with all three support fields false;`,
    ] : []),
    seriesMode
      ? `If it fails, rewrite it ONCE from the APPROVED CONTINUOUS EPISODE STORY plus trusted continuity and current plan. Preserve visual facts and build previous-cliffhanger consequence → Day ${seriesStartDay} action/consequence → ${seriesEndDay === seriesStartDay ? "mini-payoff" : `an explicit earned time bridge around cue 4 or 5 → Day ${seriesEndDay} escalation/mini-payoff`} → supported cliffhanger. The bridge must say what allowed time to pass (sleep, next morning, travel, recovery, or waiting) and continue the same causal chain. Use I/me/my throughout; we/us/our only for established companions; never you/your. Make the complete narration polished, grammatical spoken English; every timing cue must be a complete sentence that starts with a capital letter, never a chopped continuation, and never seven scene captions. Use the required exact day markers, name "${universe}" once naturally, reveal no future secret, and make events impossible to rearrange. Make the final cue leave one sharply specific unanswered threat or question from the rendered ending, so the viewer feels compelled to watch the next episode. Return a claim audit for every cue.`
      : `If it fails, rewrite it ONCE. Preserve visual facts, but build a clear goal → setback → escalation → climax → payoff with concrete actions and consequences. Use pure first-person "I/me" throughout — no "you"/"we"/"your"/"our" anywhere. Use 3-5 day markers maximum, name "${universe}" once naturally in the hook or first line, and include at least two causal transitions. The final line must explicitly answer the hook.`,
    `Return the final accepted version, whether unchanged or rewritten, as JSON only. Keep exactly ${clipCount} 6-15-word timing cues that form one continuous story.`,
  ].join("\n\n");

  try {
    const criticRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: criticPrompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "thirty_days_voiceover_critic",
            strict: true,
            schema: {
              type: "object",
              properties: {
                hook: { type: "string" },
                clips: {
                  type: "array",
                  minItems: clipCount,
                  maxItems: clipCount,
                  items: {
                    type: "object",
                    properties: { clip: { type: "integer" }, text: { type: "string" } },
                    required: ["clip", "text"],
                    additionalProperties: false,
                  },
                },
                ...(seriesMode ? {
                  claims: {
                    type: "array", minItems: clipCount, maxItems: clipCount,
                    items: { type: "object", additionalProperties: false,
                      properties: {
                        claim: { type: "string" }, supportedByPreviousStory: { type: "boolean" },
                        supportedByCurrentPlan: { type: "boolean" }, supportedByVisuals: { type: "boolean" },
                      },
                      required: ["claim", "supportedByPreviousStory", "supportedByCurrentPlan", "supportedByVisuals"],
                    },
                  },
                } : {}),
              },
              required: seriesMode ? ["hook", "clips", "claims"] : ["hook", "clips"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: seriesMode ? 1500 : 800,
        temperature: forceRegenerate ? 0.75 : (deterministicIssues.length ? 0.55 : 0.25),
      }),
    });

    if (criticRes.ok) {
      const criticJson = await criticRes.json();
      const criticContent = String(criticJson.choices?.[0]?.message?.content ?? "").trim();
      const corrected = JSON.parse(criticContent);
      const correctedHook = seriesMode
        ? seriesEpisodeHook(universe, seriesEpisodeNumber)
        : cleanLine(corrected?.hook);
      const correctedClips = normalizeScriptClips(corrected?.clips, clipCount, perClipWordTargets);
      const correctedClaims = normalizeClaims(corrected?.claims);
      const correctedIssues = correctedHook && correctedClips.length === clipCount
        ? [
          ...storyViolations(correctedHook, correctedClips, seriesMode, wordBudget.min, wordBudget.max, seriesStartDay, seriesEndDay, perClipWordTargets),
          ...(seriesMode ? seriesContinuityViolations(correctedHook, correctedClips, correctedClaims, universe, trustedSeriesContext) : []),
          ...(forceRegenerate && narrationFingerprint(correctedClips.map((clip) => clip.text).join(" ")) === narrationFingerprint(previousNarration) ? ["Regeneration repeated the saved narration instead of producing a fresh draft."] : []),
        ]
        : ["Critic returned an invalid structure."];
      if (correctedIssues.length === 0) return makeScriptResponse(correctedHook, correctedClips, false, correctedClaims);
      console.error("[thirty-days-script] critic output failed validation:", correctedIssues);
    } else {
      console.error("[thirty-days-script] critic request failed:", criticRes.status, (await criticRes.text().catch(() => "")).slice(0, 300));
    }
  } catch (error) {
    console.error("[thirty-days-script] critic failed:", error);
  }

  if (deterministicIssues.length === 0) return makeScriptResponse(hook, scriptClips, false, claims);
  await releaseReservation();
  return fallbackResponse();
});
