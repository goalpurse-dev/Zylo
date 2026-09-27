// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EPISODE_PLAN_VERSION,
  activeReferenceForEntity,
  alignSceneDayToEntityIntroductions,
  assignSceneReferences,
  availableRoadmapBeats,
  pacingForDay,
  repairLegacySeries,
  slug,
  validateConsumedBeats,
} from "../_shared/thirtyDaysSeriesEngine.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const SCORE_KEYS = ["hook", "visualVariety", "stakes", "emotionalProgression", "franchiseRecognition", "protagonistInvolvement", "miniPayoff", "cliffhanger", "continuity", "comprehension", "sceneVariety"];
const WORLD_BIBLE_SCHEMA = { type: "object", additionalProperties: false,
  required: ["world", "franchise", "visualStyle", "hardVisualRules", "negativeRules", "viewerProtagonist", "characters", "locations"],
  properties: {
    world: { type: "string" }, franchise: { type: "string" }, visualStyle: { type: "string" },
    hardVisualRules: { type: "array", items: { type: "string" } }, negativeRules: { type: "array", items: { type: "string" } },
    viewerProtagonist: { type: "object", additionalProperties: false,
      required: ["identity", "visualIdentity", "goal", "emotionalAnchor"],
      properties: { identity: { type: "string" }, visualIdentity: { type: "string" }, goal: { type: "string" }, emotionalAnchor: { type: "string" } } },
    characters: { type: "array", items: { type: "string" } }, locations: { type: "array", items: { type: "string" } },
  } };

const REF_SCHEMA = { type: "object", additionalProperties: false, required: ["id", "entityId", "version", "activeFromDay", "supersedes", "role", "label", "prompt", "visualLock"], properties: {
  id: { type: "string" }, entityId: { type: "string" }, version: { type: "integer" }, activeFromDay: { type: "integer" }, supersedes: { type: ["string", "null"] },
  role: { type: "string" }, label: { type: "string" }, prompt: { type: "string" }, visualLock: { type: "string" },
} };
const SHOT_TYPES = ["third_person", "pov", "over_shoulder", "wide_action", "close_up", "tracking"];
const REFERENCE_SCOPE_SCHEMA = { type: "object", additionalProperties: false, required: ["referenceId", "onlyUse"], properties: {
  referenceId: { type: "string" }, onlyUse: { type: "array", items: { type: "string" } },
} };
const SCENE_SCHEMA = { type: "object", additionalProperties: false,
  required: ["index", "day", "title", "beatType", "location", "timeOfDay", "characters", "requiredEntities", "forbiddenEntities", "requiredProps", "referenceIds", "referenceScopeNotes", "shotType", "camera", "startState", "mainAction", "reaction", "endState", "continuityFromPrevious", "setupForNext", "protagonistAction", "storyDevelopment", "visualEvent", "imagePrompt", "videoPrompt"],
  properties: {
    index: { type: "integer", minimum: 0, maximum: 6 }, day: { type: "integer", minimum: 1, maximum: 30 }, title: { type: "string" },
    beatType: { type: "string", enum: ["hook", "setup", "development", "complication", "turn", "payoff", "cliffhanger"] },
    location: { type: "string" }, timeOfDay: { type: "string" }, characters: { type: "array", items: { type: "string" } },
    requiredEntities: { type: "array", items: { type: "string" } }, forbiddenEntities: { type: "array", items: { type: "string" } }, requiredProps: { type: "array", items: { type: "string" } },
    referenceIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
    referenceScopeNotes: {
      type: "array", items: REFERENCE_SCOPE_SCHEMA,
      description: "For any referenceId in this scene whose OWN reference image depicts more characters than this scene's `characters` list needs (e.g. a shared cast-sheet reference), add {referenceId, onlyUse}. onlyUse names exactly which characters from that reference actually belong in this shot. Empty array when every referenced image is already scoped to just this scene's cast.",
    },
    shotType: { type: "string", enum: SHOT_TYPES, description: "Varies scene to scene within a third_person episode (mix third_person/over_shoulder/wide_action/close_up/tracking, with pov used only occasionally for impact) so the episode doesn't read as one repeated composition. Ignored/treated as pov for a strict first_person episode." },
    startState: { type: "string", description: "What is concretely true — location, who's present, immediate physical situation — the instant this scene begins. Must equal (or be the direct, obvious continuation of) the PREVIOUS scene's endState." },
    endState: { type: "string", description: "What is concretely true the instant this scene ends. The NEXT scene's startState must follow from this." },
    mainAction: { type: "string" }, reaction: { type: "string" }, continuityFromPrevious: { type: "string" }, setupForNext: { type: "string" }, camera: { type: "string" },
    protagonistAction: { type: "string" }, storyDevelopment: { type: "string" }, visualEvent: { type: "string" }, imagePrompt: { type: "string" }, videoPrompt: { type: "string" },
  } };
// OpenAI's strict structured-output mode rejects an open string-keyed map
// (`additionalProperties` set to a schema instead of `false`) at any depth —
// every "object" must declare its exact properties. relationshipChanges,
// mysteryChanges, and each entity's relationships are genuinely open-ended
// (any entityId/concept), so they're modeled here as arrays of closed
// {key, value} pairs for the wire schema; normalizeEpisodePlan converts them
// back to plain objects immediately after parsing so every downstream
// consumer (mergeStoryState, the SQL merge RPC, TTS) keeps reading a plain
// keyed object exactly as before.
const KEY_VALUE_SCHEMA = (keyField: string, valueField: string) => ({
  type: "array", items: { type: "object", additionalProperties: false,
    required: [keyField, valueField], properties: { [keyField]: { type: "string" }, [valueField]: { type: "string" } } },
});
const STATE_DELTA_SCHEMA = { type: "object", additionalProperties: false,
  required: ["entityChanges", "relationshipChanges", "inventoryChanges", "abilityChanges", "mysteryChanges", "roadmapBeatsConsumed", "locationChange", "newEvents"],
  properties: {
    entityChanges: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["entityId", "entityType", "canonicalType", "displayName", "introducedDay", "status", "currentForm", "visualIdentity", "referenceId", "abilities", "relationships"],
      properties: { entityId: { type: "string" }, entityType: { type: "string" }, canonicalType: { type: "string" }, displayName: { type: "string" }, introducedDay: { type: "integer" }, status: { type: "string" }, currentForm: { type: "string" }, visualIdentity: { type: "string" }, referenceId: { type: ["string", "null"] }, abilities: { type: "array", items: { type: "string" } }, relationships: KEY_VALUE_SCHEMA("entityId", "relationship") } } },
    relationshipChanges: KEY_VALUE_SCHEMA("entityId", "relationship"),
    inventoryChanges: { type: "object", additionalProperties: false, required: ["added", "removed"], properties: { added: { type: "array", items: { type: "string" } }, removed: { type: "array", items: { type: "string" } } } },
    abilityChanges: { type: "object", additionalProperties: false, required: ["learned", "lost"], properties: { learned: { type: "array", items: { type: "string" } }, lost: { type: "array", items: { type: "string" } } } },
    mysteryChanges: KEY_VALUE_SCHEMA("mystery", "status"),
    roadmapBeatsConsumed: { type: "array", items: { type: "string" } }, locationChange: { type: ["string", "null"] }, newEvents: { type: "array", items: { type: "string" } },
  } };
const SUMMARY_SCHEMA = { type: "object", additionalProperties: false,
  required: ["daysCovered", "endingLocation", "protagonistState", "companions", "relationships", "items", "abilities", "events", "knownInformation", "relationshipChanges", "charactersIntroduced", "locationsVisited", "injuriesOrDamage", "itemsChanged", "powersChanged", "mysteriesIntroduced", "mysteriesResolved", "unresolvedMysteries", "cliffhanger", "nextEpisodeSetup", "visualStateChanges", "futurePromises"],
  properties: {
    daysCovered: { type: "array", items: { type: "integer" } }, endingLocation: { type: "string" }, protagonistState: { type: "string" },
    companions: { type: "array", items: { type: "string" } }, relationships: { type: "array", items: { type: "string" } },
    items: { type: "array", items: { type: "string" } }, abilities: { type: "array", items: { type: "string" } },
    events: { type: "array", items: { type: "string" } }, knownInformation: { type: "array", items: { type: "string" } },
    relationshipChanges: { type: "array", items: { type: "string" } }, charactersIntroduced: { type: "array", items: { type: "string" } }, locationsVisited: { type: "array", items: { type: "string" } },
    injuriesOrDamage: { type: "array", items: { type: "string" } }, itemsChanged: { type: "array", items: { type: "string" } }, powersChanged: { type: "array", items: { type: "string" } },
    mysteriesIntroduced: { type: "array", items: { type: "string" } }, mysteriesResolved: { type: "array", items: { type: "string" } },
    unresolvedMysteries: { type: "array", items: { type: "string" } }, cliffhanger: { type: "string" }, nextEpisodeSetup: { type: "string" },
    visualStateChanges: { type: "array", items: { type: "string" } }, futurePromises: { type: "array", items: { type: "string" } },
  } };
const SCORE_PROPERTIES = Object.fromEntries(SCORE_KEYS.map((key) => [key, { type: "integer", minimum: 1, maximum: 10 }]));
const PLAN_SCHEMA = { name: "thirty_days_series_episode", strict: true, schema: {
  type: "object", additionalProperties: false,
  required: ["startDay", "endDay", "title", "hook", "cameraMode", "worldBible", "episodeStory", "newReferences", "scenes", "stateDelta", "episodeSummary", "cliffhanger", "nextEpisodeTease", "viralScores"],
  properties: {
    startDay: { type: "integer" }, endDay: { type: "integer" }, title: { type: "string" }, hook: { type: "string" }, cameraMode: { type: "string", enum: ["third_person", "first_person"] },
    worldBible: WORLD_BIBLE_SCHEMA, episodeStory: { type: "string" },
    newReferences: { type: "array", minItems: 0, maxItems: 3, items: REF_SCHEMA },
    scenes: { type: "array", minItems: 7, maxItems: 7, items: SCENE_SCHEMA },
    stateDelta: STATE_DELTA_SCHEMA,
    episodeSummary: SUMMARY_SCHEMA, cliffhanger: { type: "string" }, nextEpisodeTease: { type: "string" },
    viralScores: { type: "object", additionalProperties: false, required: SCORE_KEYS, properties: SCORE_PROPERTIES },
  },
} };
const CRITIC_SCHEMA = { name: "thirty_days_series_episode_critic", strict: true, schema: {
  type: "object", additionalProperties: false, required: ["pass", "violations", "scores"], properties: {
    pass: { type: "boolean" }, violations: { type: "array", items: { type: "string" } },
    scores: { type: "object", additionalProperties: false, required: SCORE_KEYS, properties: SCORE_PROPERTIES },
  },
} };

async function callJson(prompt: string, schema: any, temperature: number, maxTokens: number) {
  const response = await fetch(OPENAI_CHAT, { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: schema } }),
    // The scene schema grew (startState/endState/shotType/referenceScopeNotes
    // per scene) — 35s was already close to the line before; give this more
    // headroom rather than risk hitting the exact "Signal timed out" bug just
    // fixed in the series planner for the same reason (bigger schema, same budget).
    signal: AbortSignal.timeout(50_000) });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 400)}`);
  const payload = await response.json();
  return JSON.parse(String(payload?.choices?.[0]?.message?.content || "{}"));
}

const STOPWORDS = new Set(["a", "an", "the", "named", "of", "and", "with", "its", "his", "her", "your"]);
function significantWords(text: string): string[] {
  return String(text ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function findEntityForCharacter(name: any, entities: any[]) {
  if (String(name || "").trim().toLowerCase() === "you") {
    return entities.find((entity: any) => entity.entityId === "protagonist") || null;
  }
  const words = significantWords(name);
  if (!words.length) return null;
  return entities.find((entity: any) => {
    const identityWords = new Set(significantWords(`${entity.displayName || ""} ${entity.canonicalType || ""} ${entity.visualIdentity || ""}`));
    return words.some((word) => identityWords.has(word));
  }) || null;
}

// Whether a reference already represents the growth-arc entity, matched by
// shared given-name word rather than plain substring containment — plain
// containment only worked in the acquisition direction ("Charmander named
// Blaze" containing a reference labeled "Blaze"), but broke the moment the
// entity evolves and gets a NEW reference labeled e.g. "Blaze the
// Charmeleon" (no longer literally contained in the original identity
// string). Both labels share the token "blaze", which is what actually
// identifies it as the same persistent entity across a design change.
// References are appended chronologically, so scanning to the END and
// returning the LAST match naturally prefers the newest (post-evolution)
// reference over a stale pre-evolution one with the same name token.
function growthArcReferenceId(arc: any, references: any[]): string | null {
  const arcWords = new Set(significantWords(arc?.identity));
  if (!arcWords.size) return null;
  let match: string | null = null;
  for (const ref of references || []) {
    if (significantWords(ref?.label).some((word) => arcWords.has(word))) match = ref?.id ?? match;
  }
  return match;
}

function growthArcDirective(series: any, startDay: number, endDay: number) {
  const arc = series?.master_story_bible?.growthArc;
  if (!arc?.identity) return "";
  const milestones = Array.isArray(arc.milestones) ? arc.milestones : [];
  const dueMilestones = milestones.filter((m: any) => Number(m.day) >= startDay && Number(m.day) <= endDay);
  const pastMilestones = milestones.filter((m: any) => Number(m.day) < startDay);
  const majorGrowthDay = Number(arc.majorGrowthDay);
  const crossesMajorGrowth = majorGrowthDay >= startDay && majorGrowthDay <= endDay;
  const acquisitionDay = Number(arc.acquisitionDay);
  const crossesAcquisition = acquisitionDay >= startDay && acquisitionDay <= endDay;
  const existingRefId = growthArcReferenceId(arc, series?.reference_library || []);

  return `PERSISTENT GROWTH ARC (mandatory — this is the throughline real franchise fans are actually watching for, never skip or ignore it): the protagonist's ${arc.type} is "${arc.identity}", acquired on day ${arc.acquisitionDay}. It must appear in this episode with its exact established identity — never a different companion/power/skill.
${existingRefId && !crossesMajorGrowth
  ? `Its persistent reference id is already "${existingRefId}" — EVERY scene where it appears this episode MUST include that exact id in referenceIds (never omit it, never create another reference for it). Its visual design is locked to that reference; do not redescribe it differently.`
  : !existingRefId
  ? `CRITICAL — IT HAS NO PERSISTENT REFERENCE YET: if it appears in ANY scene this episode (it almost certainly must, since this is central to the whole series), you MUST add exactly one entry to newReferences for it this episode, with a stable descriptive label containing its given name (so future episodes can find and reuse it), and every scene featuring it must include that new reference's id in referenceIds. Skipping this is the single most damaging mistake possible — without a locked reference, its design will visibly change at random every time it's drawn, in this episode and every one after it.`
  : ""}
${crossesAcquisition ? `THIS EPISODE MUST DEPICT THE ACQUISITION AS AN ON-SCREEN EVENT the protagonist witnesses and reacts to — triggered by something concrete (an encounter, an accident, a gift, a discovery). It must never simply already be true when the episode starts; show the exact moment it happens. Do NOT name or explain its full nature yet unless informationRelease says this episode's range has reached its nameRevealDay/fullyUnderstoodDay — an early acquisition can be visually strange/unexplained (a glow, a strange creature, an odd sensation) even while it is clearly established as real.` : ""}
${pastMilestones.length ? `Already developed so far: ${pastMilestones.map((m: any) => m.development).join("; ")}.` : ""}
${crossesMajorGrowth
  ? `THIS EPISODE MUST DEPICT THE MAJOR GROWTH MOMENT: ${arc.majorGrowthDescription}. Build at least one scene, ideally the payoff or turn beat, around this transformation actually happening on-screen. ${existingRefId ? `THE DESIGN CHANGES HERE: this is a deliberate visual transformation, not drift — add exactly one new entry to newReferences for its POST-transformation form (label must still contain its given name, e.g. "Blaze the Charmeleon", so it's still recognized as the same persistent entity going forward). Show the transformation actually happening on-screen in this episode (the trigger, the moment it changes), then every scene THIS episode and every episode after that shows it AFTER the transformation must use the NEW reference id — never the old pre-transformation one again.` : `Since it has no reference yet at all, its first-ever reference (see above) should already reflect this evolved/transformed form, since that's how it's acquired.`}`
  : dueMilestones.length
    ? `This episode should show visible incremental progress matching: ${dueMilestones.map((m: any) => m.development).join("; ")}.`
    : `This episode should show at least one small, concrete moment of training/bonding/practice with it, even briefly — it must never disappear from the story.`}`;
}

// Mirrors the hiddenFutureBeats allowed/forbidden split, but for PACING
// named concepts within the story that's already public (not secret plot
// twists) — the actual bug this fixes: nothing stopped an episode from
// naming/explaining a mystery object on day 1 just because it wasn't a
// "secret." A concept can appear unnamed before its nameRevealDay, but the
// literal name/explanation is forbidden until then.
function informationReleaseDirective(series: any, endDay: number) {
  const entries: any[] = series?.master_story_bible?.informationRelease || [];
  if (!entries.length) return "";
  const nameable = entries.filter((e) => Number(e.nameRevealDay) <= endDay);
  const understood = entries.filter((e) => Number(e.fullyUnderstoodDay) <= endDay);
  const unnamed = entries.filter((e) => Number(e.firstAppearanceDay) <= endDay && Number(e.nameRevealDay) > endDay);
  const notYetAppeared = entries.filter((e) => Number(e.firstAppearanceDay) > endDay);
  return `INFORMATION RELEASE (mandatory pacing — this is what the current failure mode looks like without it: naming/explaining something the viewer hasn't earned yet):
${unnamed.length ? `May appear ON SCREEN but its NAME/explanation is FORBIDDEN until a later episode — show it as strange/unexplained (a glow, an odd symbol, an unnamed sensation), never say or write its actual name: ${JSON.stringify(unnamed.map((e) => e.concept))}.` : ""}
${nameable.length && !understood.some((u) => nameable.includes(u)) ? `May be named now but NOT fully explained yet — a character can say its name without anyone explaining what it truly is: ${JSON.stringify(nameable.filter((e) => !understood.includes(e)).map((e) => e.concept))}.` : ""}
${understood.length ? `May be named and explained in full now: ${JSON.stringify(understood.map((e) => e.concept))}.` : ""}
${notYetAppeared.length ? `Must NOT appear at all yet, in any form: ${JSON.stringify(notYetAppeared.map((e) => e.concept))}.` : ""}`;
}

// Only injected for the very first episode. The same planner recipe used for
// episode 18 previously ran unchanged for episode 1, which is exactly why
// episode 1 opened mid-story with unnamed lore already in full effect — a
// first-time viewer has nothing to onboard from. Expressed as beat ROLES so
// it stays franchise-agnostic, never hardcoded content.
function episodeOneDirective(series: any) {
  const arrival = series?.master_story_bible?.worldBible?.viewerProtagonist?.arrival;
  return `EPISODE 1 SPECIAL RULES (this is the viewer's very first exposure to this series — nothing may be assumed known):
- Scene 1: dramatize the actual arrival${arrival ? ` (${arrival})` : ""} — YOU entering this world, not already mid-adventure.
- Scene 2: YOU realize/orient where you are. Confusion or disorientation is appropriate here.
- Scene 3: first encounter with exactly ONE recognizable character — not the whole cast. Do not introduce more people than this one meeting needs.
- Scene 4: that character's genuine reaction to YOU — distrust, curiosity, suspicion, or help. This is a relationship starting at zero, not one that already has history.
- Scene 5: one small, concrete, EXPLICABLE problem occurs — not the series' central conflict, not a named mystery, just an inciting incident a first-time viewer can immediately follow.
- Scene 6: YOU are meaningfully, causally involved in handling it — this is what earns the character's trust/attention, not something granted for free.
- Scene 7: temporary safety, OR the first glimpse of a larger mystery — strictly per INFORMATION RELEASE above, meaning unnamed/unexplained if that's what the pacing schedule says.
- End on exactly one concrete hook into day 2+. Do not let scene 1-2 already contain the series' central mystery object, the full cast, or the final threat — those are earned across many later episodes, not given away immediately.`;
}

function episodePrompt(series: any, previous: any[], startDay: number, endDay: number, repair = "") {
  const availableSecrets = (series.hidden_future_beats || []).filter((beat: any) => Number(beat.revealDay) <= endDay);
  const forbiddenSecrets = (series.hidden_future_beats || []).filter((beat: any) => Number(beat.revealDay) > endDay);
  const consumedBeatIds = series.verified_story_state?.consumedBeatIds || series.pacing_state?.consumedBeatIds || [];
  const beatWindow = availableRoadmapBeats(series.roadmap_beats || [], startDay, endDay, consumedBeatIds);
  const pacing = pacingForDay(endDay);
  const existingEnvironmentCount = (series.reference_library || []).filter((reference: any) => String(reference?.role || "").startsWith("environment")).length;
  // A series that has only its launch setting by Day 3+ is visually stuck.
  // Make the next chapter earn a real, reusable place rather than allowing
  // every early episode to quietly remain in the starter backdrop.
  const needsFirstPlaceExpansion = startDay >= 3 && existingEnvironmentCount <= 1;
  return `You are directing ONE 35-42 second episode in a persistent 30 Days short-form series.

SERIES: ${series.title}
WORLD/PREMISE: ${series.universe} — ${series.premise}
AUTHORITATIVE FRANCHISE RESOLUTION (never reinterpret or narrow): ${JSON.stringify(series.franchise_resolution)}
EPISODE RANGE: Day ${startDay}${endDay === startDay ? "" : ` through Day ${endDay}`} — this is a SMALL SLICE of a much longer 30-day story (episode ${Math.ceil(startDay / Number(series.days_per_episode || 1))} of about ${Math.ceil(30 / Number(series.days_per_episode || 1))}). Treat it as a sneak peek chapter, not a self-contained movie: advance the plot only as much as ${endDay - startDay + 1} day(s) out of 30 warrants, resolve nothing that belongs to a later roadmap phase, and do not compress major reveals or the climax into an early episode just because it would be satisfying on its own.
SERIES BIBLE: ${JSON.stringify(series.master_story_bible)}
${growthArcDirective(series, startDay, endDay)}
${informationReleaseDirective(series, endDay)}
${startDay === 1 ? episodeOneDirective(series) : ""}
CURRENT VERIFIED STORY STATE (persistent truth; omission never deletes entities): ${JSON.stringify(series.verified_story_state || series.current_story_state)}
PERSISTENT ENTITY REGISTRY (use entityId in requiredEntities): ${JSON.stringify(series.entity_registry)}
ENTITY-BOUND REFERENCES (referenceIds are assigned from requiredEntities, never by label guessing): ${JSON.stringify(series.reference_library)}
CURRENT PACING GATE: ${JSON.stringify({ ...series.pacing_state, ...pacing })}
AVAILABLE ROADMAP BEATS (stateDelta.roadmapBeatsConsumed may contain ONLY these ids): ${JSON.stringify(beatWindow.available)}
LOCKED ROADMAP BEATS (do not consume or reveal): ${JSON.stringify(beatWindow.locked)}
MASTER 30-DAY ROADMAP: ${JSON.stringify(series.master_story_bible?.roadmap || [])}
PREVIOUS EPISODE — REQUIRED CONTINUITY INPUT: ${JSON.stringify(previous.at(-1) || null)}
EARLIER COMPLETED EPISODES (oldest to newest): ${JSON.stringify(previous.slice(0, -1))}
SECRETS ALLOWED TO BE REVEALED NOW: ${JSON.stringify(availableSecrets)}
FORBIDDEN FUTURE BEATS (internal continuity only; NEVER mention, imply too specifically, put in narration, or expose in image/video prompts): ${JSON.stringify(forbiddenSecrets)}
${repair ? `REPAIR FEEDBACK FROM THE CRITIC: ${repair}` : ""}

STORY COMES BEFORE SHOTS (non-negotiable): FIRST write episodeStory as one polished 90-125 word, first-person spoken mini-episode that a viewer can understand with their eyes closed. It must naturally continue the previous cliffhanger, explain the goal/cause/consequence, carry Day ${startDay} into Day ${endDay} through an earned transition, and end with the one concrete unanswered question that makes the next episode necessary. This is the approved narration source—not seven scene captions. Never use camera/image language. Ban fragments and broken phrasing such as "I both", "I all", "my faces", "focusing on.", or "as Lloyd.". THEN split THAT SAME STORY into exactly seven visually distinct illustrative scenes in order with beat types: hook, setup, development, complication, turn, payoff, cliffhanger. The seven scenes are visual support for episodeStory: they must never invent a disconnected beat, and a sentence in episodeStory may span more than one scene. Every scene must feature YOU as a consequential protagonist and use the persistent "you" reference first. Across 2/3/5-day episodes, connect days causally instead of summarizing each day. When this is not Episode 1, Scene 1 MUST be the concrete consequence of the PREVIOUS EPISODE's cliffhanger/end state; it may not reset, reintroduce the premise, or begin an unrelated adventure.

CALENDAR CONTINUITY (hard requirement — a day label is not a story beat): scene.day values must be nondecreasing and every day from ${startDay} through ${endDay} must receive real screen time. Never put the final covered day only on Scene 7. For a two-day, seven-scene episode, choose the natural story hinge near the middle: the first Day ${endDay} scene must be Scene 4 or Scene 5, leaving 3-4 connected scenes on EACH day. End Day ${startDay} at a stable pause after the current immediate action resolves, then begin Day ${endDay} with an explicit, believable time bridge grounded in the story—such as sleeping overnight, the next morning, completed travel, recovery, waiting for news, or another earned passage of time. Preserve the causal chain across that bridge: the new day must continue the same goal/consequence, not reset the episode or start an unrelated event. Never relabel two consecutive shots from the same uninterrupted morning/action as different days merely to satisfy the range.

STORY-FIRST VISUAL DIRECTION (hard requirement): design each image from scene story → exact location → only present characters → one main action → visible reaction → camera/framing. Persistent references come LAST and preserve identity/form only. Never inherit a reference image's pose, background, camera, composition, or lighting. An environment/location reference may be required only when this exact scene occurs at that location. Do not keep using an earlier beach/street/room reference after the story has moved somewhere else.

VISUAL PROGRESSION: the seven images must read as seven consecutive shots from an episode, not seven posters or variations of one key art image. Normally change framing, staging, and action between every adjacent scene. Move to a new location/sub-location whenever the story says the characters travel or enter somewhere. Do not write the same location string for five or more scenes. Avoid centered group poses, repeated character placement, repeated horizon/background layouts, and the same camera height/lens across the episode.

REQUIRED CHARACTER BINDING: every named person/creature/item in characters that must be visible needs its entityId in requiredEntities and an active entity-bound reference. If a newly introduced recurring character has no entity/reference, create it in stateDelta.entityChanges plus newReferences before scene generation. forbiddenEntities explicitly lists identities that must not appear. Never substitute an unrelated cast/environment reference.

REFERENCE BUDGET (hard production limit): an image can receive at most FOUR persistent reference images total, including the mandatory "you" reference. Therefore every scene may show at most THREE additional individually locked subjects/places. Never cram the full cast, a mentor, a creature, a landmark, and an artifact into one shot. Split that beat across the seven-shot sequence: establish the place, then show the people, then show the object/reaction. characters and requiredEntities must contain only identities visibly present in that single frame. A shared core-cast style reference is one visual anchor, not permission to list every member of the cast as individually present.

SEQUENTIAL CONTINUITY (mandatory — plan all seven scenes as ONE continuous shot list, never as seven independent beats): write startState and endState for every scene. Scene N+1's startState must be the direct, obvious physical and informational continuation of scene N's endState — same location unless endState explicitly describes leaving it, same characters present unless endState explicitly describes someone arriving/departing, same objects/injuries/knowledge carried forward. A reader should be able to reconstruct one unbroken sequence of events from startState/endState alone, with no unexplained jumps.

PLACE-TO-PLACE CONTINUITY (mandatory): never teleport the story between places. If Scene N+1 is at a different named place, Scene N's endState must explicitly show the characters deciding to go there and leaving/travelling toward that exact place; Scene N+1's startState must explicitly show their arrival, entry, or first sight of that same named place. For example: end "we head for the old church beyond town" → next start "we arrive at the old church and push through its doors." If a new named place will recur, create its environment_primary newReference and use it only from the arrival scene onward. A courtyard-to-the-building's-door or indoor-to-outside transition may reuse one known place reference; do not manufacture a new reference for a trivial camera move.

SHOT VARIETY (mandatory): assign shotType per scene. In a third_person episode, vary shotType across the seven scenes (mix third_person/over_shoulder/wide_action/close_up/tracking; use pov only occasionally, for one or two scenes where seeing through YOUR eyes actually matters) — do not default every scene to the same composition or let more than two consecutive scenes share a shotType. In a strict first_person episode, shotType may stay pov throughout since that is the deliberate format.

The episode must work as its own TikTok: immediate hook (prefer resolving the previous cliffhanger), concrete problem before halfway, escalating consequences, meaningful mini-payoff, and a story-linked tease for the next episode. For every non-final episode, Scene 7 is an OPEN LOOP, never a tidy conclusion: stage the unanswered question visibly in its endState/setupForNext (a discovered clue that changes the goal, an imminent choice, a threatening arrival, a reversal, an incomplete message, a disappearance, or a new consequence). The small episode problem may be paid off, but the final image and final line must make a viewer feel "I need to know what happens next." cliffhanger, nextEpisodeTease, and Scene 7's unresolved physical state must describe the SAME specific open question—no generic "more danger awaits" filler. No walking/training/talking filler, checklist narration, random cliffhanger, repetitive location/action/framing, or future spoilers. The final episode on Day 30 resolves the premise and has no fake next-day tease.

PROGRESSIVE PLACE MEMORY: after Days 1–2, add ZERO OR ONE environment/location reference when this episode enters a meaningful named place that has not already got a matching persistent environment reference and could recur later (a lab, town, base, route, arena, school, hideout, ship, forest, etc.). It must be a location entity with role "environment_primary", a stable location-based entityId, activeFromDay equal to this episode's start day, and a label/prompt naming the place. Do not make one for a generic repeated backdrop or merely because a scene happens outdoors. Reuse the exact existing environment reference when the story returns to a known place, even many episodes later. The library is an accumulating series memory, not a six-image moodboard: only attach the specific place reference to scenes that occur there.
${needsFirstPlaceExpansion ? `PLACE EXPANSION REQUIRED THIS EPISODE: the library only has its launch setting so far. Continue the prior cliffhanger first, then have the story meaningfully enter ONE fresh, named, recurring place before the cliffhanger (for example a route, forest, lab, gym/training ground, hideout, harbor, or equivalent appropriate to this franchise). You MUST add exactly one environment_primary newReference for that place and use it only for its matching scenes. This is not permission to replace established places; it grows the persistent place memory so future episodes can deliberately return here.` : ""}

newReferences may contain up to 3 genuinely new recurring references: at most TWO character/object identity references plus at most ONE environment/location reference described above. Only create one when it is actually needed. Every new reference MUST bind to an entityId and version; transformations supersede the previous reference. Never recreate an existing active reference. The persistent library may grow across all 30 days.

ENTITY TIMING (mandatory): PERSISTENT ENTITY REGISTRY entries each carry an introducedDay. Never put an entityId in a scene's requiredEntities for any scene whose day is earlier than that entity's introducedDay — its reference is not active yet and the scene will be rejected. If this episode is the one where an entity is acquired/met (introducedDay falls inside this episode's day range), only scenes on or after that exact day may require it; earlier scenes in the same episode must build up to that moment without already featuring it.

STRUCTURED PROMPTS (mandatory shape for imagePrompt/videoPrompt — this is what makes a clip feel like a moment in a story instead of a poster): each must clearly contain, in order: (1) the startState as the opening framing, (2) one clear mainAction — an active, directional thing happening, never a static pose, (3) a visible reaction from another character or the environment, (4) the endState as where the frame/clip lands. Avoid: everyone facing the camera, symmetrical group standing, an artifact centered like a product photo, or a repeated identical camera angle from the previous scene. Only the characters this scene's 'characters' field actually lists should be composed into the shot — do not add other cast members just because they exist in the world.

REFERENCE SCOPING (mandatory when a referenced image depicts more people than this scene needs): if any id in referenceIds points to a reference whose own image shows multiple characters (a shared cast/style reference) but this scene's 'characters' list is a subset of them, add an entry to referenceScopeNotes: {referenceId, onlyUse: [the specific names actually needed]}. Leave referenceScopeNotes empty when every referenced image already matches this scene's cast exactly.

VISUAL IDENTITY LOCK (mandatory — this is the single biggest thing that breaks franchise trust): if ANY character, creature, companion, vehicle, or object appears in more than one scene this episode, it MUST be a reference — either an existing id from PERSISTENT REFERENCES or a newReference introduced here — and every scene showing it MUST include that exact reference id in referenceIds. Never describe the same recurring entity differently scene to scene (e.g. a newly-caught creature drawn as its baby form in one scene and its evolved form in the next) unless the story is explicitly and deliberately depicting a transformation as one of this episode's beats, in which case that transformation is itself the story event: show the trigger on-screen, update the reference's prompt/visualLock to the new form starting from that scene, and never revert it afterward. A recurring entity's design must otherwise stay pixel-for-pixel identical to its established visualLock in every scene.

stateDelta declares ONLY proposed changes caused by this episode. It never replaces the full truth object. Persistent entities survive omission. roadmapBeatsConsumed may contain only AVAILABLE ROADMAP BEATS. episodeSummary is a pre-render editorial summary only; it is not canon until media verification. viralScores must honestly score the episode. Return JSON only.`;
}

const BEATS = ["hook", "setup", "development", "complication", "turn", "payoff", "cliffhanger"];

// index/beatType/day-range and startDay/endDay are pure bookkeeping the model
// can drift on for no real reason (off-by-one day, reordered beat) — force
// them to the only values that were ever going to be correct rather than
// rejecting a whole episode plan over it. referenceIds is the other thing
// worth auto-fixing here rather than crashing the whole request over: a
// hallucinated/misremembered id or a missing leading "you" is a mechanical
// slip, not a genuine story problem, and the growing prompt (continuity,
// shot variety, information-release pacing, reference scoping) gives the
// model more chances to slip on this pure bookkeeping field. Only genuinely
// semantic problems (a MISSING reference for a named character, spoiler
// leaks, a missing tease) are left for validate() to actually reject, since
// those need the model to try again, not a formula.
// Converts the OpenAI-strict-mode-compatible {key, value}[] wire shape back
// into the plain keyed object mergeStoryState/the SQL merge RPC/TTS expect —
// see the KEY_VALUE_SCHEMA comment above for why the wire shape differs.
function pairsToObject(pairs: any, keyField: string, valueField: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of Array.isArray(pairs) ? pairs : []) {
    const key = String(pair?.[keyField] ?? "").trim();
    if (key) out[key] = String(pair?.[valueField] ?? "");
  }
  return out;
}

function normalizeEpisodePlan(plan: any, series: any, startDay: number, endDay: number) {
  plan.startDay = startDay;
  plan.endDay = endDay;
  if (plan.stateDelta) {
    // Same "you" vs. "protagonist" confusion as requiredEntities/
    // forbiddenEntities (see assignSceneReferences' resolveEntityId), but in
    // a field that was never normalized: an entityChanges entry declaring
    // entityId "you" creates a brand-new, bogus entity distinct from the
    // real "protagonist" one (since entities are matched by exact id), which
    // then shadows the real protagonist for every scene's own entity
    // resolution — any exact-id match short-circuits before the "you" alias
    // fallback ever runs. Normalized here, once, before that entity list is
    // even built.
    const dealiasYou = (id: unknown) => String(id ?? "").trim().toLowerCase() === "you" ? "protagonist" : id;
    plan.stateDelta.relationshipChanges = pairsToObject(plan.stateDelta.relationshipChanges, "entityId", "relationship");
    plan.stateDelta.mysteryChanges = pairsToObject(plan.stateDelta.mysteryChanges, "mystery", "status");
    for (const change of plan.stateDelta.entityChanges || []) {
      change.entityId = dealiasYou(change.entityId);
      change.relationships = pairsToObject(change.relationships, "entityId", "relationship");
    }
  }
  // begin_thirty_days_series_episode hard-rejects any newReference whose id
  // already exists in the series' reference_library (correctly — a new
  // reference must never silently shadow an old one under the same id).
  // The initial 5 setup references can end up with generic, role-shaped ids
  // ("companion", "artifact") rather than unique slugs, so a model that
  // reuses the same natural word for a "new" reference collides with an
  // existing one it was actually told not to re-declare (see
  // growthArcDirective's "never create another reference for it"). Drop the
  // collision here rather than letting the whole episode fail on it: the
  // existing reference already covers that entity, so the redundant
  // newReference carries no information the episode actually needs.
  const existingReferences = Array.isArray(series.reference_library) ? series.reference_library : [];
  const usedReferenceIds = new Set(existingReferences.map((ref: any) => String(ref?.id || "")).filter(Boolean));
  const nextReferenceId = (entityId: any, version = 1) => {
    const base = `ref_${slug(entityId || "entity")}_v${Math.max(1, Number(version) || 1)}`;
    let candidate = base;
    let suffix = 2;
    while (usedReferenceIds.has(candidate)) candidate = `${base}_${suffix++}`;
    usedReferenceIds.add(candidate);
    return candidate;
  };

  // An LLM sometimes gives a genuinely new entity reference the same id as
  // a setup reference (for example a location/cast sheet and a newly
  // introduced character both becoming `professor_oak`). The previous code
  // dropped the new reference solely because the id collided, leaving the
  // new entity with no identity image and causing ENTITY_REFERENCE_REQUIRED.
  // Keep truly redundant same-entity declarations out, but deterministically
  // rename every real collision and retain its entity binding.
  const referenceIdRemaps = new Map<string, string>();
  const newReferences: any[] = [];
  for (const rawReference of Array.isArray(plan.newReferences) ? plan.newReferences : []) {
    const reference = { ...rawReference };
    const isEnvironment = String(reference.role || "").startsWith("environment") || String(reference.entityId || "").startsWith("location_");
    if (isEnvironment && (startDay <= 2 || newReferences.some((item: any) => String(item.role || "").startsWith("environment") || String(item.entityId || "").startsWith("location_")))) {
      continue;
    }
    if (["", "null", "none", "undefined"].includes(String(reference.supersedes ?? "").trim().toLowerCase())) {
      reference.supersedes = null;
    }
    const oldId = String(reference.id || "");
    if (!oldId) reference.id = nextReferenceId(reference.entityId || reference.label || "entity", reference.version);
    const duplicateEntityVersion = [...existingReferences, ...newReferences].find((item: any) =>
      Boolean(reference.entityId)
      && item?.entityId === reference.entityId
      && Number(item?.version || 1) === Number(reference.version || 1)
    );
    if (duplicateEntityVersion && !reference.supersedes) {
      referenceIdRemaps.set(`${reference.entityId || ""}\u0000${oldId}`, duplicateEntityVersion.id);
      console.warn(`[thirty-days-series-episode-planner] dropping duplicate entity/version reference "${oldId}"; ${reference.entityId} v${Number(reference.version || 1)} already uses "${duplicateEntityVersion.id}"`);
      continue;
    }
    const collision = existingReferences.find((item: any) => item?.id === oldId)
      || newReferences.find((item: any) => item?.id === oldId);
    if (oldId && collision) {
      const sameEntity = Boolean(reference.entityId) && collision.entityId === reference.entityId;
      const redundant = sameEntity
        && !reference.supersedes
        && Number(reference.version || 1) <= Number(collision.version || 1);
      if (redundant) {
        console.warn(`[thirty-days-series-episode-planner] dropping redundant new reference "${oldId}" already bound to ${reference.entityId}`);
        continue;
      }
      reference.id = nextReferenceId(reference.entityId || reference.label || oldId, reference.version);
      if (!sameEntity && reference.supersedes === oldId) reference.supersedes = null;
      referenceIdRemaps.set(`${reference.entityId || ""}\u0000${oldId}`, reference.id);
      console.warn(`[thirty-days-series-episode-planner] renamed colliding new reference "${oldId}" to "${reference.id}"`);
    } else if (oldId) {
      usedReferenceIds.add(oldId);
    }
    newReferences.push(reference);
  }
  for (const change of plan.stateDelta?.entityChanges || []) {
    const remapped = referenceIdRemaps.get(`${change.entityId || ""}\u0000${change.referenceId || ""}`);
    if (remapped) change.referenceId = remapped;
  }

  let allReferences = [...existingReferences, ...newReferences];
  const entities = [...(series.entity_registry || [])];
  // Older/setup-generated libraries can contain a perfectly usable
  // persistent reference whose entity binding was never copied into the
  // entity registry.  A planner then sees a scene mention the reference id
  // (e.g. `monastery_of_spinjitzu`), resolves it to its bound entity id, and
  // wrongly aborts with UNKNOWN_REQUIRED_ENTITY.  A stored reference is
  // authoritative identity data, so materialize its missing registry entry
  // once and carry it forward in this episode's state delta.
  const entityTypeForReference = (reference: any) => {
    const role = String(reference?.role || "");
    if (role.startsWith("environment")) return "location";
    if (["protagonist", "companion", "teammate", "canon_character", "antagonist", "creature", "pet", "item", "artifact", "vehicle"].includes(role)) return role;
    return "canon_character";
  };
  plan.stateDelta = plan.stateDelta || {};
  plan.stateDelta.entityChanges = Array.isArray(plan.stateDelta.entityChanges) ? plan.stateDelta.entityChanges : [];
  for (const reference of allReferences) {
    const entityId = String(reference?.entityId || "").trim();
    if (!entityId || entities.some((entity: any) => entity.entityId === entityId)) continue;
    const entity = {
      entityId,
      entityType: entityTypeForReference(reference),
      canonicalType: String(reference.label || reference.role || entityId),
      displayName: String(reference.label || entityId),
      introducedDay: Math.max(1, Number(reference.activeFromDay || 1)),
      status: "active",
      currentForm: String(reference.label || entityId),
      visualIdentity: String(reference.visualLock || reference.prompt || "Persistent reference identity."),
      referenceId: reference.id,
      abilities: [],
      relationships: {},
    };
    entities.push(entity);
    plan.stateDelta.entityChanges.push(entity);
  }
  for (const change of plan.stateDelta?.entityChanges || []) {
    if (!entities.some((entity: any) => entity.entityId === change.entityId)) {
      const reference = allReferences.find((ref: any) => ref.entityId === change.entityId);
      entities.push({ ...change, entityType: reference?.role || "canon_character", displayName: reference?.label || change.entityId });
    }
  }

  // "companion", "antagonist", and similar role words are ordinary prose,
  // not stable runtime ids.  If exactly one active entity has that role,
  // resolve the word before the visible-character repair pass. Otherwise the
  // latter invents a bogus new character literally named "companion" and a
  // second reference image; scenes then animate against that generic image
  // instead of the real locked Eevee/Nova (or equivalent in any franchise).
  const resolveRoleAlias = (value: any) => {
    const raw = String(value || "").trim();
    const lower = raw.toLowerCase();
    if (!raw || entities.some((entity: any) => entity.entityId === raw) || lower === "you") return lower === "you" ? "protagonist" : raw;
    const candidates = entities.filter((entity: any) => entity.status !== "inactive" && String(entity.entityType || "").toLowerCase() === lower);
    return candidates.length === 1 ? candidates[0].entityId : raw;
  };
  for (const scene of Array.isArray(plan.scenes) ? plan.scenes : []) {
    scene.requiredEntities = [...new Set((scene.requiredEntities || []).map(resolveRoleAlias))];
    scene.forbiddenEntities = [...new Set((scene.forbiddenEntities || []).map(resolveRoleAlias))];
    scene.characters = (scene.characters || []).map((name: any) => {
      const entityId = resolveRoleAlias(name);
      const entity = entities.find((item: any) => item.entityId === entityId);
      return entity && String(name || "").trim().toLowerCase() === String(entity.entityType || "").toLowerCase()
        ? (entity.displayName || name)
        : name;
    });
  }

  // The model can list a fully named visible character but forget the
  // matching stateDelta.entityChanges entry (e.g. "Professor Samuel Oak").
  // Register that character deterministically, reuse any declared unknown
  // requiredEntity id/new-reference binding that clearly names the same
  // character, and attach the entity to every scene where it appears. This
  // repairs structured bookkeeping only; the model's story and cast stay the
  // source of truth, and the normal reference/billing caps still apply.
  for (const scene of Array.isArray(plan.scenes) ? plan.scenes : []) {
    scene.requiredEntities = Array.isArray(scene.requiredEntities) ? scene.requiredEntities : [];
    for (const characterName of Array.isArray(scene.characters) ? scene.characters : []) {
      let entity = findEntityForCharacter(characterName, entities);
      if (!entity) {
        const characterWords = new Set(significantWords(characterName));
        const matchingDeclaredId = scene.requiredEntities.find((id: any) => {
          if (entities.some((item: any) => item.entityId === id)) return false;
          return significantWords(id).some((word) => characterWords.has(word));
        });
        const matchingNewReference = newReferences.find((ref: any) =>
          significantWords(`${ref.label || ""} ${ref.prompt || ""}`).some((word) => characterWords.has(word))
        );
        const entityId = String(matchingDeclaredId || matchingNewReference?.entityId || `canon_character_${slug(characterName)}`);
        const introducedDay = Math.min(endDay, Math.max(startDay, Number(scene.day || startDay)));
        const existingReference = allReferences.find((ref: any) => ref.entityId === entityId);
        entity = {
          entityId,
          entityType: "canon_character",
          canonicalType: String(characterName),
          displayName: String(characterName),
          introducedDay,
          status: "active",
          currentForm: String(characterName),
          visualIdentity: `Franchise-accurate canonical identity and design for ${String(characterName)}.`,
          referenceId: existingReference?.id || null,
          abilities: [],
          relationships: {},
        };
        entities.push(entity);
        plan.stateDelta.entityChanges.push({ ...entity });
        console.warn(`[thirty-days-series-episode-planner] registered missing visible character entity "${entityId}" for "${characterName}"`);
      }
      if (!scene.requiredEntities.includes(entity.entityId)) scene.requiredEntities.push(entity.entityId);
    }
  }

  // Final deterministic safety net: if the draft requires a visual entity
  // but neither the restored setup library nor the model's newReferences has
  // an entity-bound image, create the missing single-subject reference before
  // scene assignment. This is generic across franchises and still respects
  // the two-new-reference episode cap and normal server-side billing.
  const visualEntityTypes = new Set(["protagonist", "companion", "teammate", "canon_character", "antagonist", "creature", "pet", "item", "artifact", "vehicle", "location"]);
  const requiredEntityIds = new Set((plan.scenes || []).flatMap((scene: any) => scene.requiredEntities || []).map((id: any) => String(id || "").trim()));
  for (const entity of entities) {
    if (!requiredEntityIds.has(String(entity.entityId)) || !visualEntityTypes.has(String(entity.entityType))) continue;
    if (activeReferenceForEntity(entity.entityId, allReferences, endDay)) continue;
    if (newReferences.length >= 3 || allReferences.length >= 40) throw new Error(`ENTITY_REFERENCE_REQUIRED:${entity.entityId}`);
    const version = Math.max(1, ...allReferences.filter((ref: any) => ref.entityId === entity.entityId).map((ref: any) => Number(ref.version || 1) + 1));
    const id = nextReferenceId(entity.entityId, version);
    const reference = {
      id,
      entityId: entity.entityId,
      version,
      activeFromDay: Math.max(1, Number(entity.introducedDay || startDay)),
      supersedes: null,
      role: entity.entityType,
      label: `${entity.displayName || entity.entityId} — ${entity.canonicalType || entity.entityType}`,
      prompt: `Single-subject persistent identity reference for ${entity.displayName || entity.entityId}, canonically ${entity.canonicalType || entity.entityType}. ${entity.visualIdentity || "Preserve the franchise-accurate canonical design."}`,
      visualLock: entity.visualIdentity || `${entity.displayName || entity.entityId} must remain the same canonical identity and form in every reuse.`,
    };
    newReferences.push(reference);
    allReferences = [...allReferences, reference];
    entity.referenceId = id;
    const change = (plan.stateDelta?.entityChanges || []).find((item: any) => item.entityId === entity.entityId);
    if (change) change.referenceId = id;
    console.warn(`[thirty-days-series-episode-planner] synthesized missing required entity reference "${id}" for ${entity.entityId}`);
  }
  plan.newReferences = newReferences;
  // A location reference is deliberately optional and never represents a
  // character. Attach it only where its own meaningful location words match
  // the current scene. This lets a Day 25 scene reuse a Day 3 lab/base/route
  // without leaking every accumulated reference into every prompt.
  const environmentReferenceForScene = (scene: any) => {
    const locationWords = new Set(significantWords(scene.location));
    if (!locationWords.size) return null;
    return allReferences
      .filter((reference: any) => String(reference?.role || "").startsWith("environment"))
      .map((reference: any) => ({ reference, score: significantWords(`${reference.label || ""} ${reference.prompt || ""}`).filter((word) => locationWords.has(word)).length }))
      .filter(({ score }: any) => score > 0)
      .sort((a: any, b: any) => b.score - a.score || Number(b.reference.activeFromDay || 1) - Number(a.reference.activeFromDay || 1))[0]?.reference || null;
  };
  plan.scenes = (Array.isArray(plan.scenes) ? plan.scenes : []).slice(0, 7).map((scene: any, index: number) => {
    const normalized = {
      ...scene,
      index,
      beatType: BEATS[index],
      day: Math.min(endDay, Math.max(startDay, Number(scene.day) || startDay)),
      referenceScopeNotes: Array.isArray(scene.referenceScopeNotes)
        ? scene.referenceScopeNotes.filter((note: any) => note?.referenceId && allReferences.some((ref: any) => ref.id === note.referenceId))
        : [],
    };
    const timingAligned = alignSceneDayToEntityIntroductions(normalized, entities, startDay, endDay);
    const assigned = assignSceneReferences(timingAligned, entities, allReferences, timingAligned.day);
    const environment = environmentReferenceForScene(timingAligned);
    return environment
      ? { ...assigned, referenceIds: [...new Set([...assigned.referenceIds, environment.id])].slice(0, 4) }
      : assigned;
  });
  // Calendar placement and the hand-off between shots are deterministic
  // production rules, not creative choices.  Leaving either to the model
  // made otherwise usable plans fail the whole episode reservation (most
  // visibly on a fresh Days 1-2 series).  Keep the model's story, but make
  // the seven-scene timeline mechanically valid before it reaches validate.
  if (endDay === startDay + 1 && plan.scenes.length === 7) {
    plan.scenes.forEach((scene: any, index: number) => {
      scene.day = index < 3 ? startDay : endDay;
    });
    const beforeBoundary = plan.scenes[2];
    const afterBoundary = plan.scenes[3];
    const overnightBridge = `After a tense night of waiting, the next morning begins with the consequence of: ${String(beforeBoundary.endState || beforeBoundary.mainAction || "the previous discovery")}`;
    beforeBoundary.setupForNext = [String(beforeBoundary.setupForNext || "").trim(), "The night passes while the unresolved situation remains."].filter(Boolean).join(" ");
    afterBoundary.continuityFromPrevious = [overnightBridge, String(afterBoundary.continuityFromPrevious || "").trim()].filter(Boolean).join(" ");
  }
  for (let index = 0; index < plan.scenes.length; index += 1) {
    const scene = plan.scenes[index];
    scene.requiredEntities = [...new Set((scene.requiredEntities || []).map((id: any) => String(id || "").trim()).filter(Boolean))];
    scene.forbiddenEntities = (scene.forbiddenEntities || []).filter((id: any) => !scene.requiredEntities.includes(String(id || "").trim()));
    scene.startState = String(scene.startState || scene.mainAction || scene.visualEvent || "The immediate situation continues.").trim();
    scene.endState = String(scene.endState || scene.mainAction || scene.visualEvent || scene.startState).trim();
    if (index === 0) continue;
    const previous = plan.scenes[index - 1];
    // Include the exact previous physical state.  This avoids false
    // rejections caused by the model using synonyms in adjacent fields while
    // preserving its own continuation explanation after it.
    const handoff = `Continuing directly from: ${String(previous.endState || previous.mainAction || "the prior moment").trim()}.`;
    scene.startState = `${handoff} ${scene.startState}`.trim();
    scene.continuityFromPrevious = [handoff, String(scene.continuityFromPrevious || "").trim()].filter(Boolean).join(" ");
  }
  plan.episodePlanVersion = EPISODE_PLAN_VERSION;
  return plan;
}

// Catches the exact failure mode that breaks franchise trust: a recurring
// character/creature (e.g. a caught starter) named in a scene's own
// structured `characters` list, but that scene's referenceIds forgot to
// include the matching reference id — meaning the image generator never saw
// the locked reference photo for that appearance and had to invent a fresh
// design from text alone, which is how "Charmander" quietly becomes
// "Torchic" a few scenes later. Matches against the model's own declared
// `characters` field (not free-text prompts), so false positives are rare —
// this small reference pool (<=10 total) rarely has colliding names.
// Restricted to person/creature-like roles: a `characters` entry like "Team
// Rocket" was previously substring-matching the ENVIRONMENT reference
// labeled "Team Rocket Hideout" and demanding the location reference id for
// a scene that only needed the faction as a concept, not that specific
// place — environment/artifact/vehicle references describe places/objects,
// never who's in a scene, so they can never satisfy a `characters` entry.
const CHARACTER_LIKE_ROLES = new Set(["protagonist", "pov_hands", "core_cast_style", "antagonist", "companion", "teammate", "canon_character", "creature", "pet"]);
function labelIndex(series: any, newReferences: any[]) {
  const all = [...(series.reference_library || []), ...(newReferences || [])];
  return all
    .filter((ref: any) => ref?.id && CHARACTER_LIKE_ROLES.has(ref?.role) && String(ref?.label || "").trim().length >= 4)
    .map((ref: any) => [String(ref.label).toLowerCase().trim(), ref.id as string] as [string, string]);
}

function findReferenceIdForName(name: string, index: [string, string][]) {
  const needle = String(name || "").toLowerCase().trim();
  if (needle.length < 3) return null;
  for (const [label, id] of index) {
    if (label === needle || label.includes(needle) || needle.includes(label)) return id;
  }
  return null;
}

const DAY_TRANSITION_PATTERN = /\b(?:next (?:day|morning)|following morning|overnight|slept|sleep|rested|woke|waking|night passed|after (?:a|the) night|by (?:dawn|sunrise)|at (?:dawn|sunrise)|daybreak|hours later|after (?:the )?(?:journey|trip|travel|wait|recovery|treatment))\b/i;

function validateCalendarContinuity(scenes: any[], startDay: number, endDay: number) {
  const days = scenes.map((scene) => Number(scene.day));
  if (days[0] !== startDay || days.at(-1) !== endDay) {
    throw new Error(`EPISODE_DAY_COVERAGE_INVALID:${startDay}-${endDay}`);
  }
  for (let index = 1; index < days.length; index += 1) {
    if (days[index] < days[index - 1]) throw new Error(`SCENE_${index}_DAY_ORDER_REVERSED`);
  }
  for (let day = startDay; day <= endDay; day += 1) {
    if (!days.includes(day)) throw new Error(`EPISODE_DAY_MISSING:${day}`);
  }
  if (endDay === startDay + 1) {
    const firstSecondDayScene = days.indexOf(endDay);
    if (firstSecondDayScene !== 3 && firstSecondDayScene !== 4) {
      throw new Error(`EPISODE_DAY_TRANSITION_UNBALANCED:first Day ${endDay} scene must be Scene 4 or Scene 5`);
    }
  } else if (endDay > startDay && days.indexOf(endDay) >= scenes.length - 1) {
    throw new Error(`EPISODE_FINAL_DAY_CUT_OFF:${endDay}`);
  }
  for (let index = 1; index < scenes.length; index += 1) {
    if (days[index] === days[index - 1]) continue;
    const bridge = [scenes[index - 1].endState, scenes[index - 1].setupForNext, scenes[index].continuityFromPrevious, scenes[index].startState]
      .map((value) => String(value || "")).join(" ");
    if (!DAY_TRANSITION_PATTERN.test(bridge)) {
      throw new Error(`SCENE_${index}_DAY_TRANSITION_UNMOTIVATED:Day ${days[index - 1]} to Day ${days[index]} needs an explicit earned time bridge`);
    }
  }
}

function validate(plan: any, series: any, startDay: number, endDay: number) {
  if (plan.scenes?.length !== 7) throw new Error("EPISODE_SCENES_MISSING");
  const episodeStory = String(plan.episodeStory || "").trim();
  if (episodeStory.length < 180 || /\b(?:i both|i all|my faces|the image (?:shows|depicts)|scene depicting|wide shot)\b/i.test(episodeStory)
    || /\b(?:focusing on|as\s+[A-Z][A-Za-z'-]{2,})\s*[.!?]$/i.test(episodeStory)) {
    throw new Error("EPISODE_STORY_NOT_SPOKEN_NARRATION");
  }
  validateCalendarContinuity(plan.scenes, startDay, endDay);
  const ids = new Set([...(series.reference_library || []).map((ref: any) => ref.id), ...(plan.newReferences || []).map((ref: any) => ref.id)]);
  plan.scenes.forEach((scene: any) => {
    if (scene.referenceIds?.[0] !== "you" || scene.referenceIds.some((id: string) => !ids.has(id))) throw new Error("EPISODE_REFERENCE_INVALID");
  });
  const index = labelIndex(series, plan.newReferences);
  const episodeEntities = [...(series.entity_registry || []), ...(plan.stateDelta?.entityChanges || [])];
  for (const scene of plan.scenes) {
    for (const name of scene.characters || []) {
      const expectedId = findReferenceIdForName(name, index);
      if (expectedId && !(scene.referenceIds || []).includes(expectedId)) {
        throw new Error(`SCENE_${scene.index}_MISSING_REFERENCE: scene ${scene.index} lists character "${name}" but referenceIds omits the already-established reference id "${expectedId}" for it — every appearance of a recurring character/creature must include its locked reference id or its design will visibly drift.`);
      }
      const expectedEntity = findEntityForCharacter(name, episodeEntities);
      if (!expectedEntity) throw new Error(`SCENE_${scene.index}_CHARACTER_ENTITY_MISSING:${name}`);
      if (!(scene.requiredEntities || []).includes(expectedEntity.entityId)) throw new Error(`SCENE_${scene.index}_REQUIRED_ENTITY_MISSING:${expectedEntity.entityId}`);
    }
  }
  for (let index = 1; index < plan.scenes.length; index += 1) {
    const previousWords = new Set(significantWords(plan.scenes[index - 1].endState));
    const currentWords = significantWords(`${plan.scenes[index].startState} ${plan.scenes[index].continuityFromPrevious}`);
    if (!currentWords.some((word) => previousWords.has(word))) throw new Error(`SCENE_${index}_CONTINUITY_DISCONNECTED`);
    if ((plan.scenes[index].requiredEntities || []).some((id: string) => (plan.scenes[index].forbiddenEntities || []).includes(id))) {
      throw new Error(`SCENE_${index}_ENTITY_REQUIRED_AND_FORBIDDEN`);
    }
  }
  // Variety is enforced by the critic/rewrite loop.  It is deliberately not
  // a reservation-blocking database invariant: a story set in one landmark
  // can still be perfectly valid, and a quality retry must never strand a
  // user before any episode exists.
  const consumed = series.verified_story_state?.consumedBeatIds || series.pacing_state?.consumedBeatIds || [];
  const beatWindow = availableRoadmapBeats(series.roadmap_beats || [], startDay, endDay, consumed);
  validateConsumedBeats(plan.stateDelta?.roadmapBeatsConsumed || [], beatWindow.available);
  // The named-character check above can only catch a reference being
  // OMITTED — it's silent when no matching reference exists ANYWHERE yet,
  // which is exactly how the growth-arc companion could appear in scenes for
  // an entire episode (or several) with zero locked reference at all,
  // producing a visibly different creature/design every single time it's
  // drawn. This is the single most damaging possible continuity failure, so
  // it gets its own hard, unconditional gate.
  const arc = series.master_story_bible?.growthArc;
  if (arc?.identity) {
    const arcName = String(arc.identity).toLowerCase();
    const appearsThisEpisode = plan.scenes.some((scene: any) => (scene.characters || []).some((name: string) => {
      const needle = String(name).toLowerCase().trim();
      return needle.length >= 3 && arcName.includes(needle);
    }));
    if (appearsThisEpisode && !growthArcReferenceId(arc, [...(series.reference_library || []), ...(plan.newReferences || [])])) {
      throw new Error(`GROWTH_ARC_MISSING_REFERENCE: "${arc.identity}" appears as a character in this episode but has no matching reference in PERSISTENT REFERENCES or newReferences — add exactly one newReference for it this episode (label must contain its given name) so its design locks instead of changing at random every time it's drawn.`);
    }
  }
  const serialized = JSON.stringify({ scenes: plan.scenes, hook: plan.hook, cliffhanger: plan.cliffhanger, tease: plan.nextEpisodeTease }).toLowerCase();
  for (const beat of series.hidden_future_beats || []) {
    if (Number(beat.revealDay) > endDay && String(beat.secret || "").length > 15 && serialized.includes(String(beat.secret).toLowerCase())) throw new Error("FUTURE_BEAT_SPOILED");
  }
  // A concept can be named right at its nameRevealDay's episode, but never in
  // an earlier one — this is the actual bug (unearned lore named on day 1),
  // distinct from hiddenFutureBeats which only guards plot-twist secrets.
  for (const entry of series.master_story_bible?.informationRelease || []) {
    const concept = String(entry?.concept || "").trim();
    if (concept.length > 2 && Number(entry?.nameRevealDay) > endDay && serialized.includes(concept.toLowerCase())) {
      throw new Error(`INFORMATION_RELEASED_TOO_EARLY: "${concept}" is named/written in this episode but its nameRevealDay (${entry.nameRevealDay}) is later than this episode's range (through day ${endDay}) — keep it unexplained (a glow, a symbol, an unnamed sensation) instead of naming it.`);
    }
  }
  for (const scene of plan.scenes) {
    if (!String(scene.startState || "").trim() || !String(scene.endState || "").trim()) {
      throw new Error(`SCENE_${scene.index}_MISSING_CONTINUITY_STATE: every scene needs a concrete startState and endState.`);
    }
  }
  if (endDay < series.total_days) {
    const ending = plan.scenes.at(-1) || {};
    const cliffhanger = String(plan.cliffhanger || plan.episodeSummary?.cliffhanger || "").trim();
    const tease = String(plan.nextEpisodeTease || plan.episodeSummary?.nextEpisodeSetup || "").trim();
    const finalState = `${ending.endState || ""} ${ending.setupForNext || ""}`.trim();
    if (cliffhanger.length < 12 || tease.length < 12 || finalState.length < 20) throw new Error("NEXT_EPISODE_TEASE_MISSING");
  }
}

function criticPrompt(plan: any, forbidden: any[], informationRelease: any[], startDay: number, endDay: number) {
  const notYetNameable = (informationRelease || []).filter((e: any) => Number(e.nameRevealDay) > endDay).map((e: any) => e.concept);
  return `Act as a ruthless viral episode critic. episodeStory is the spoken, continuous mini-episode; the seven scenes merely illustrate it. Reject if episodeStory sounds like seven scene captions, could have its sentences reordered without breaking cause/effect, fails to continue the previous ending, uses image/camera language, has broken grammar, is vague filler rather than specific lore, or fails to make Day ${startDay} cause Day ${endDay}. Reject if the opening is weak; nothing changes before halfway; visuals repeat; the episode is mostly walking/training/talking; YOU is removable; there is no concrete problem, mini-payoff, continuity, or story-linked cliffhanger; it reads like a day summary/list; it reveals any forbidden future beat; or any recurring character/creature/companion/object that appears in multiple scenes is described inconsistently across those scenes' referenceIds/imagePrompt/videoPrompt (e.g. a creature drawn as a different evolution/form in different scenes) without that exact change being the episode's own deliberate on-screen story beat.

ENDING RETENTION (critical for every episode before Day 30): reject if Scene 7 resolves the whole episode into safety/celebration/normalcy, if it merely says a vague threat remains, or if the scene's endState, plan.cliffhanger, and nextEpisodeTease do not point to the same concrete unanswered question. The viewer must see the unresolved thing happen in the final frame and feel compelled to continue. A mini-payoff is required, but it must CAUSE the next urgent question rather than erase it. Day 30 alone may fully resolve the premise.

COMPREHENSION (critical): ${startDay === 1 ? "Imagine a viewer who has seen no other episode. Reject if this first episode opens mid-adventure, introduces more than one new character before scene 3, or assumes trust/history that has not been earned on screen." : "This is a later chapter, so it MUST rely on the supplied previous episode and begin with its consequence. Do not reject an established companion, item, location, or mystery merely because it was introduced earlier; instead reject resets, contradictions, or unexplained NEW lore."} Reject if any of these concepts — not yet allowed to be named this far into the story — are named or explained anyway: ${JSON.stringify(notYetNameable)}.

SCENE VARIETY (new): reject if 4 or more of the 7 scenes share essentially the same composition (same shotType, same character grouping, same framing), if the same object/artifact is centered like a product photo in more than one scene, if the full cast appears together in scenes that only needed 1-2 people, or if consecutive scenes' startState/endState don't visibly chain into each other.

CALENDAR CONTINUITY: reject if a covered day is only a label rather than meaningful story time; if the final day begins only in Scene 7; if a two-day episode does not place its day boundary between Scenes 3-4 or Scenes 4-5; or if the boundary lacks an explicit earned bridge such as overnight sleep, the next morning, completed travel, recovery, or waiting. The event before the time bridge must reach a stable pause, and the event after it must continue its consequence instead of resetting the plot. Reject two uninterrupted shots from the same morning/action being assigned different days.

FORBIDDEN FUTURE BEATS: ${JSON.stringify(forbidden)}
EPISODE: ${JSON.stringify(plan)}

Score hook, visual variety, stakes, emotional progression, franchise recognition, protagonist involvement, mini-payoff, cliffhanger, continuity, comprehension, and scene variety from 1-10. pass only if every score is at least 7 and there are no spoilers. Return JSON only.`;
}

// Internal error codes (UNKNOWN_REQUIRED_ENTITY:x, SCENE_2_CONTINUITY_DISCONNECTED,
// FUTURE_BEAT_SPOILED, etc.) are exactly that — internal, meant for the
// repair-retry prompt and server logs, never for a user watching a progress
// bar. The raw code is always logged server-side (see the catch block);
// this maps the handful of genuinely distinct failure shapes to something a
// user can act on. Keep the diagnostic code in server logs only; exposing
// registry/reference ids in the product makes a recoverable planner retry
// look like a broken user project.
function friendlyEpisodeError(message: string): string {
  if (/EPISODE_SCENES_MISSING|EPISODE_REFERENCE_INVALID|EPISODE_DAY_|EPISODE_FINAL_DAY_|SCENE_.*_DAY_|SCENE_.*_MISSING_REFERENCE|SCENE_.*_CONTINUITY_DISCONNECTED|SCENE_.*_MISSING_CONTINUITY_STATE|SCENE_.*_ENTITY_REQUIRED_AND_FORBIDDEN|UNKNOWN_REQUIRED_ENTITY|ENTITY_REFERENCE_REQUIRED|ENTITY_REFERENCE_NOT_ACTIVE|ENTITY_INTRODUCED_AFTER_EPISODE|GROWTH_ARC_MISSING_REFERENCE|SCENE_REFERENCE_CAP_EXCEEDED/.test(message)) {
    return "This episode's story didn't come together cleanly. No credits were used — please try generating it again.";
  }
  if (/FUTURE_BEAT_SPOILED|INFORMATION_RELEASED_TOO_EARLY/.test(message)) {
    return "This episode accidentally revealed something meant for later. No credits were used — please try generating it again.";
  }
  if (/ROADMAP_BEAT_LOCKED/.test(message)) {
    return "This episode tried to skip ahead in the story faster than the roadmap allows. No credits were used — please try generating it again.";
  }
  if (/NEXT_EPISODE_TEASE_MISSING/.test(message)) {
    return "This episode didn't set up a clear next-episode hook. No credits were used — please try generating it again.";
  }
  if (/SERIES_NOT_READY|SERIES_COMPLETE|EPISODE_ALREADY_ACTIVE|INVALID_EPISODE_RANGE/.test(message)) {
    return "This series isn't ready for the next episode right now — refresh and check its status.";
  }
  return "Episode planning hit an unexpected issue. No credits were used — please try again.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return reply({ ok: false, error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const seriesId = String(body.seriesId || "");
  let { data: series, error } = await admin.from("thirty_days_series").select("*").eq("id", seriesId).eq("user_id", user.id).single();
  if (error || !series) return reply({ ok: false, error: "Series not found" }, 404);
  if (Number(series.series_schema_version || 1) < 2 || !Array.isArray(series.entity_registry) || !series.entity_registry.length) {
    const repaired = repairLegacySeries(series);
    const { data: repairedRow, error: repairError } = await admin.from("thirty_days_series").update({
      franchise_resolution: repaired.franchiseResolution,
      raw_user_input: repaired.franchiseResolution.rawUserInput,
      normalized_input: repaired.franchiseResolution.normalizedInput,
      entity_registry: repaired.entityRegistry,
      reference_library: repaired.referenceLibrary,
      verified_story_state: repaired.verifiedStoryState,
      roadmap_beats: repaired.roadmapBeats,
      pacing_state: repaired.pacingState,
      series_schema_version: 2,
      roadmap_version: 2,
      entity_registry_version: 1,
    }).eq("id", series.id).select("*").single();
    if (repairError) return reply({ ok: false, error: `Legacy Series repair failed: ${repairError.message}` }, 409);
    series = repairedRow;
  }
  if (series.current_day >= series.total_days) return reply({ ok: false, error: "Series is complete" }, 409);
  const startDay = Number(series.current_day) + 1;
  const endDay = Math.min(Number(series.total_days), startDay + Number(series.days_per_episode) - 1);
  const { data: prior } = await admin.from("thirty_days_series_episodes")
    .select("episode_number,start_day,end_day,title,episode_summary,cliffhanger,next_episode_tease")
    .eq("series_id", seriesId).eq("status", "completed")
    .order("episode_number", { ascending: true });
  if (startDay > 1) {
    const previousEpisode = prior?.at(-1);
    if (!previousEpisode || Number(previousEpisode.end_day) !== startDay - 1
      || !Array.isArray(previousEpisode.episode_summary?.events)
      || !String(previousEpisode.cliffhanger || previousEpisode.episode_summary?.cliffhanger || "").trim()) {
      return reply({ ok: false, error: "Previous episode continuity is missing; this episode was not planned." }, 409);
    }
  }
  try {
    // A structural/semantic miss on the first draft gets one repair pass too
    // — not just critic rejections — so a single off-target reference id
    // doesn't 500 the whole request when the model could just fix it. This
    // covers normalizeEpisodePlan itself (via assignSceneReferences) as well
    // as validate(): an unresolved/unknown requiredEntity id is exactly the
    // kind of mechanical slip a retry can fix, not a reason to hard-fail.
    let plan: any;
    try {
      plan = normalizeEpisodePlan(await callJson(episodePrompt(series, prior || [], startDay, endDay), PLAN_SCHEMA, 0.65, 7000), series, startDay, endDay);
      validate(plan, series, startDay, endDay);
    } catch (firstError) {
      plan = normalizeEpisodePlan(await callJson(episodePrompt(series, prior || [], startDay, endDay, String((firstError as any)?.message || firstError)), PLAN_SCHEMA, 0.45, 7000), series, startDay, endDay);
      validate(plan, series, startDay, endDay);
    }
    const forbidden = (series.hidden_future_beats || []).filter((beat: any) => Number(beat.revealDay) > endDay);
    const informationRelease = series.master_story_bible?.informationRelease || [];
    let critic = await callJson(criticPrompt(plan, forbidden, informationRelease, startDay, endDay), CRITIC_SCHEMA, 0.15, 1200);
    // Two repair passes, same rewrite-with-feedback loop each time. A strict
    // 9-dimension critic that must score every axis >=7 can plausibly reject
    // several honest attempts in a row — this must never hard-fail the whole
    // request the way EPISODE_CRITIC_REJECTED used to. Credits are only
    // spent once begin_thirty_days_series_episode runs below, so accepting
    // the last structurally-valid draft here costs nothing extra; it just
    // stops the user from being stuck with no episode at all.
    for (let attempt = 0; attempt < 2 && !critic.pass; attempt++) {
      const repaired = normalizeEpisodePlan(await callJson(episodePrompt(series, prior || [], startDay, endDay, (critic.violations || []).join("; ")), PLAN_SCHEMA, 0.45, 7000), series, startDay, endDay);
      try {
        validate(repaired, series, startDay, endDay);
      } catch {
        continue; // keep the last known-good plan/critic if this repair reintroduced a structural problem
      }
      plan = repaired;
      critic = await callJson(criticPrompt(plan, forbidden, informationRelease, startDay, endDay), CRITIC_SCHEMA, 0.1, 1200);
    }
    if (!critic.pass) {
      console.warn("[thirty-days-series-episode-planner] accepting episode despite critic rejection after retries:", critic.violations);
    }
    plan.viralScores = critic.scores;
    plan.worldBible.styleMode = series.visual_style;
    plan.worldBible.styleDirective = series.visual_style === "auto"
      ? "Preserve the franchise's native visual language."
      : `Apply ${String(series.visual_style).replaceAll("_", " ")} consistently without changing canon identities.`;
    const { data: episode, error: reserveError } = await admin.rpc("begin_thirty_days_series_episode", { p_user_id: user.id, p_series_id: seriesId, p_episode_plan: plan });
    if (reserveError) throw reserveError;
    await admin.from("thirty_days_series").update({ planning_error: null }).eq("id", seriesId).eq("user_id", user.id);
    const { error: episodeVersionError } = await admin.from("thirty_days_series_episodes").update({
      state_delta: plan.stateDelta || {}, episode_plan_version: EPISODE_PLAN_VERSION,
    }).eq("id", episode.id);
    if (episodeVersionError) throw episodeVersionError;
    const { data: generation, error: generationError } = await admin.from("thirty_days_generations").select("*").eq("id", episode.generation_id).single();
    if (generationError) throw generationError;
    return reply({ ok: true, episode, generation, critic });
  } catch (caught) {
    console.error("[thirty-days-series-episode-planner]", caught);
    const message = String((caught as any)?.message || caught);
    // Keep a private, per-series diagnostic for support and automatic repair.
    // The browser keeps receiving the friendly copy below; the raw internal
    // code is never exposed to a creator, but it means a failed request is
    // observable and fixable instead of becoming an unrepeatable mystery.
    await admin.from("thirty_days_series").update({ planning_error: `episode_planner:${message.slice(0, 900)}` }).eq("id", seriesId).eq("user_id", user.id);
    return reply({ ok: false, error: message.includes("INSUFFICIENT_CREDITS") ? "INSUFFICIENT_CREDITS" : friendlyEpisodeError(message) }, 500);
  }
});
