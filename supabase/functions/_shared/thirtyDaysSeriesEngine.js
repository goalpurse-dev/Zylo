// Pure, provider-independent continuity rules shared by Series planners,
// browser helpers, background advancement, and deterministic tests.
export const SERIES_SCHEMA_VERSION = 2;
export const ROADMAP_VERSION = 2;
export const ENTITY_REGISTRY_VERSION = 1;
export const EPISODE_PLAN_VERSION = 2;
export const TTS_VERSION = 2;

const ENTITY_TYPES = new Set([
  "protagonist", "companion", "teammate", "canon_character", "antagonist",
  "creature", "pet", "item", "artifact", "power", "vehicle", "location",
]);
const VISUAL_ENTITY_TYPES = new Set([
  "protagonist", "companion", "teammate", "canon_character", "antagonist",
  "creature", "pet", "item", "artifact", "vehicle", "location",
]);

export function slug(value, fallback = "entity") {
  const normalized = String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return normalized || fallback;
}

export function normalizeFranchiseInput(rawUserInput) {
  return String(rawUserInput || "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function coerceFranchiseResolution(rawUserInput, candidate = {}) {
  const raw = normalizeFranchiseInput(rawUserInput);
  const normalized = raw.toLocaleLowerCase("en-US");
  const candidates = Array.isArray(candidate.candidates) ? candidate.candidates.slice(0, 5) : [];
  const resolvedFranchise = String(candidate.resolvedFranchise || candidate.canonicalFranchise || raw).trim() || raw;
  const resolvedProperty = String(candidate.resolvedProperty || candidate.canonicalProperty || resolvedFranchise).trim();
  return {
    rawUserInput: raw,
    normalizedInput: normalized,
    resolvedFranchise,
    resolvedProperty,
    resolvedWorld: String(candidate.resolvedWorld || resolvedProperty).trim(),
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)),
    aliases: [...new Set((candidate.aliases || []).map((value) => String(value).trim()).filter(Boolean))].slice(0, 12),
    candidates,
    rationale: String(candidate.rationale || "").slice(0, 600),
  };
}

function inferGrowthIdentity(growthArc = {}) {
  const identity = String(growthArc.identity || "").trim();
  if (!identity) return null;
  // A leading "Name — description" / "Name, description" shape (e.g. "Nova
  // — an Eevee you rescue and name") puts the given name BEFORE the
  // species/type clause the other patterns below look for — without this,
  // "an Eevee" would be mistaken for the name and "Nova" dropped entirely,
  // even though the story (and every reference/prompt) actually calls the
  // entity Nova throughout.
  const leading = identity.match(/^([A-Z][\w'-]{1,30})\s*[-–—,:]\s*/);
  const rest = leading ? identity.slice(leading[0].length) : identity;
  const named = rest.match(/(?:named|called)\s+["']?([A-Z][\w'-]{1,30})/i)?.[1];
  const canonical = rest.match(/\b(?:a|an|the)\s+([A-Z][\w'-]{2,30})/i)?.[1]
    || rest.split(/\s+/).find((part) => /^[A-Z][\w'-]{2,30}$/.test(part));
  return {
    displayName: leading?.[1] || named || canonical || identity.slice(0, 60),
    canonicalType: canonical || leading?.[1] || identity.slice(0, 80),
  };
}

function referenceMatchesEntity(reference, entity) {
  const haystack = `${reference?.label || ""} ${reference?.visualLock || ""} ${reference?.prompt || ""}`.toLowerCase();
  return [entity.displayName, entity.canonicalType].filter(Boolean)
    .some((value) => haystack.includes(String(value).toLowerCase()));
}

export function buildInitialEntityRegistry(plan = {}) {
  const world = plan.worldBible || plan.seriesBible?.worldBible || {};
  const growthArc = plan.seriesBible?.growthArc || {};
  const references = Array.isArray(plan.visualReferences) ? plan.visualReferences : [];
  const protagonistRef = references.find((ref) => ref.id === "you") || references.find((ref) => ref.role === "protagonist");
  const entities = [{
    entityId: "protagonist",
    entityType: "protagonist",
    canonicalType: "viewer protagonist",
    displayName: "YOU",
    status: "active",
    introducedDay: 1,
    currentForm: "viewer protagonist",
    visualIdentity: world.viewerProtagonist?.visualIdentity || protagonistRef?.visualLock || "",
    referenceId: protagonistRef?.id || "you",
    abilities: [],
    relationships: {},
  }];
  const growth = inferGrowthIdentity(growthArc);
  if (growth) {
    const type = growthArc.type === "companion" ? "companion"
      : growthArc.type === "power" ? "power"
      : growthArc.type === "tool" ? "item" : "artifact";
    const entity = {
      entityId: `${type}_${slug(growth.displayName)}`,
      entityType: type,
      canonicalType: growth.canonicalType,
      displayName: growth.displayName,
      status: "active",
      introducedDay: Number(growthArc.acquisitionDay || 1),
      currentForm: growth.canonicalType,
      visualIdentity: String(growthArc.identity || ""),
      referenceId: null,
      abilities: [],
      relationships: { protagonist: type === "companion" ? "new companion" : "possessed by protagonist" },
    };
    const match = references.find((ref) => referenceMatchesEntity(ref, entity));
    if (match) entity.referenceId = match.id;
    entities.push(entity);
  }
  return entities;
}

export function bindReferencesToEntities(references = [], entities = []) {
  const bound = references.map((reference, index) => {
    const exact = entities.find((entity) => entity.referenceId === reference.id);
    const inferred = exact || entities.find((entity) => referenceMatchesEntity(reference, entity));
    const entityId = inferred?.entityId || (reference.id === "you" ? "protagonist" : `reference_subject_${slug(reference.id || index)}`);
    return {
      ...reference,
      referenceId: reference.referenceId || reference.id,
      entityId,
      version: Math.max(1, Number(reference.version || 1)),
      activeFromDay: Math.max(1, Number(reference.activeFromDay || inferred?.introducedDay || 1)),
      supersedes: reference.supersedes || null,
    };
  });
  return bound;
}

export function ensureVisuallyRequiredEntityReferences(plan = {}) {
  const entities = buildInitialEntityRegistry(plan);
  let references = bindReferencesToEntities(plan.visualReferences || [], entities);
  for (const entity of entities) {
    if (!VISUAL_ENTITY_TYPES.has(entity.entityType) || entity.referenceId) continue;
    const replaceIndex = references.findIndex((ref, index) => index > 0 && ["environment_secondary", "artifact", "core_cast_style"].includes(ref.role));
    if (replaceIndex < 0) throw new Error(`ENTITY_REFERENCE_REQUIRED:${entity.entityId}`);
    const id = `ref_${slug(entity.displayName)}_v1`;
    references[replaceIndex] = {
      id, referenceId: id, entityId: entity.entityId, version: 1, activeFromDay: entity.introducedDay,
      supersedes: null, role: entity.entityType === "companion" ? "companion" : "artifact",
      label: `${entity.displayName} — ${entity.canonicalType}`,
      prompt: `Single-subject persistent identity reference for ${entity.displayName}, canonically ${entity.canonicalType}. ${entity.visualIdentity}`,
      visualLock: entity.visualIdentity || `${entity.displayName} must remain the same canonical identity and form in every reuse.`,
    };
    entity.referenceId = id;
  }
  return { entities, references };
}

export function activeReferenceForEntity(entityId, references = [], day = 1) {
  return references.filter((ref) => ref.entityId === entityId && Number(ref.activeFromDay || 1) <= day)
    .sort((a, b) => Number(b.version || 1) - Number(a.version || 1))[0] || null;
}

// A generated episode may place an established entity into a scene one day
// before that entity's canonical introduction. Its reference correctly stays
// inactive until the introduction, so move only that scene forward inside
// the current episode window instead of misreporting a missing reference.
export function alignSceneDayToEntityIntroductions(scene = {}, entities = [], startDay = 1, endDay = 30) {
  const requiredIds = [...new Set(["protagonist", ...(scene.requiredEntities || [])].map((id) =>
    String(id || "").trim().toLowerCase() === "you" ? "protagonist" : String(id || "").trim()
  ))];
  const requiredEntities = requiredIds
    .map((id) => entities.find((entity) => entity.entityId === id))
    .filter(Boolean);
  const originalDay = Math.max(startDay, Number(scene.day || startDay));
  const earliestValidDay = requiredEntities.reduce(
    (day, entity) => Math.max(day, Number(entity.introducedDay || 1)),
    originalDay,
  );
  if (earliestValidDay > endDay) {
    const future = requiredEntities.find((entity) => Number(entity.introducedDay || 1) > endDay);
    throw new Error(`ENTITY_INTRODUCED_AFTER_EPISODE:${future?.entityId || "unknown"}`);
  }
  return earliestValidDay === Number(scene.day)
    ? scene
    : { ...scene, day: earliestValidDay, timingAdjustedFromDay: Number(scene.day || startDay) };
}

// Models reliably paraphrase an entityId instead of copying it verbatim from
// PERSISTENT ENTITY REGISTRY, even when the exact string is right there in
// the prompt — confirmed live in three distinct shapes for the same
// underlying habit: the pronoun ("you" for "protagonist" — the reference id
// "you" vs. entity id "protagonist" is a real distinction every prompt
// blurs by calling the character YOU), the category word ("companion" for
// "companion_bulbasaur"), and the character's own given name ("nova" for
// "companion_eevee", when the entity's own identity text reads "Nova — an
// Eevee..."). A structured-output enum can't be constrained to a per-series
// runtime id list, so this resolves the general pattern — refers to an
// entity by any natural handle for it — rather than patching one wording at
// a time: exact id match, then the fixed protagonist alias, then the single
// entity matching by type or by name/description, preferring (when
// ambiguous) whichever candidate is already bound to a persistent
// reference, since a bare/generic word almost always means the established
// entity, not one just introduced this same episode.
function pickUnambiguousEntity(candidates, references) {
  if (candidates.length === 1) return candidates[0].entityId;
  if (candidates.length > 1) {
    const withReference = candidates.filter((entity) => references.some((ref) => ref.entityId === entity.entityId));
    if (withReference.length === 1) return withReference[0].entityId;
  }
  return null;
}

function resolveEntityId(id, entities, references) {
  const raw = String(id || "").trim();
  if (!raw) return raw;
  if (entities.some((entity) => entity.entityId === raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === "you") return "protagonist";
  // requiredEntities is supposed to contain entity ids, but structured
  // generation occasionally copies the adjacent persistent reference id
  // instead (for example `ref_companion_eevee_v1`). That id is not unknown:
  // the reference already has the authoritative entity binding. Resolve it
  // before trying fuzzy name/type aliases so a valid locked identity cannot
  // make the entire episode fail planning.
  const reference = references.find((item) =>
    String(item?.id || item?.referenceId || "").trim().toLowerCase() === lower
  );
  if (reference?.entityId && entities.some((entity) => entity.entityId === reference.entityId)) {
    return reference.entityId;
  }
  if (lower.length < 3) return raw;
  const byType = pickUnambiguousEntity(entities.filter((entity) => entity.entityType === lower), references);
  if (byType) return byType;
  const byMention = pickUnambiguousEntity(entities.filter((entity) =>
    [entity.displayName, entity.canonicalType, entity.visualIdentity]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(lower))
  ), references);
  if (byMention) return byMention;
  return raw;
}

export function assignSceneReferences(scene, entities = [], references = [], day = 1) {
  const normalizeEntityId = (id) => resolveEntityId(id, entities, references);
  const candidateEntities = [...new Set(["protagonist", ...(scene.requiredEntities || []).map(normalizeEntityId)])];
  const forbiddenEntities = (scene.forbiddenEntities || []).map(normalizeEntityId);
  const requiredEntities = [];
  const resolved = [];
  for (const entityId of candidateEntities) {
    const entity = entities.find((item) => item.entityId === entityId && item.status !== "inactive");
    if (!entity) throw new Error(`UNKNOWN_REQUIRED_ENTITY:${entityId}`);
    if (entity.entityType === "location") {
      const locationWords = new Set(slug(scene.location || "").split("_").filter((word) => word.length >= 3));
      const entityWords = slug(`${entity.displayName || ""} ${entity.canonicalType || ""}`).split("_").filter((word) => word.length >= 3);
      if (!entityWords.some((word) => locationWords.has(word))) {
        // A structured draft can carry a previously used place in
        // requiredEntities after the story moves somewhere new. That is not a
        // planning failure: omit the stale location anchor so the new shot is
        // composed from its own location, while character/object identity
        // references remain locked. A genuine new recurring place is added by
        // the planner as its own environment entity/reference.
        continue;
      }
    }
    const reference = activeReferenceForEntity(entityId, references, day);
    if (!reference && VISUAL_ENTITY_TYPES.has(entity.entityType)) {
      const futureReference = references
        .filter((ref) => ref.entityId === entityId)
        .sort((a, b) => Number(a.activeFromDay || 1) - Number(b.activeFromDay || 1))[0];
      if (futureReference) {
        throw new Error(`ENTITY_REFERENCE_NOT_ACTIVE:${entityId}:day_${day}:active_from_${Number(futureReference.activeFromDay || 1)}`);
      }
      throw new Error(`ENTITY_REFERENCE_REQUIRED:${entityId}`);
    }
    requiredEntities.push(entityId);
    if (reference) resolved.push(reference.id || reference.referenceId);
  }
  if (resolved.length > 4) throw new Error(`SCENE_REFERENCE_CAP_EXCEEDED:${requiredEntities.join(",")}`);
  return { ...scene, requiredEntities, forbiddenEntities, referenceIds: [...new Set(resolved)].slice(0, 4) };
}

export function pacingForDay(day) {
  const value = Math.max(1, Math.min(30, Number(day || 1)));
  if (value <= 5) return { arcPhase: "entry_foundation", tensionLevel: 1, maxAntagonistRevealLevel: 1, maxMysteryProgress: 20 };
  if (value <= 10) return { arcPhase: "early_progression", tensionLevel: 2, maxAntagonistRevealLevel: 2, maxMysteryProgress: 40 };
  if (value <= 15) return { arcPhase: "mystery_escalation", tensionLevel: 3, maxAntagonistRevealLevel: 3, maxMysteryProgress: 60 };
  if (value <= 20) return { arcPhase: "major_reveal_loss", tensionLevel: 4, maxAntagonistRevealLevel: 4, maxMysteryProgress: 80 };
  if (value <= 25) return { arcPhase: "recovery_preparation", tensionLevel: 4, maxAntagonistRevealLevel: 5, maxMysteryProgress: 90 };
  if (value <= 29) return { arcPhase: "final_escalation", tensionLevel: 5, maxAntagonistRevealLevel: 5, maxMysteryProgress: 100 };
  return { arcPhase: "climax_payoff", tensionLevel: 5, maxAntagonistRevealLevel: 5, maxMysteryProgress: 100 };
}

export function buildStructuredRoadmapBeats(plan = {}) {
  const beats = [];
  for (const entry of plan.seriesBible?.roadmap || []) {
    const idealStart = Number(entry.startDay || 1);
    const idealEnd = Number(entry.endDay || idealStart);
    beats.push({
      beatId: `phase_${slug(entry.purpose || `${idealStart}_${idealEnd}`)}`,
      type: idealEnd === 30 ? "climax_payoff" : idealStart >= 16 && idealStart <= 20 ? "major_reveal_or_loss" : "phase_progression",
      notBeforeDay: idealStart,
      idealDayRange: [idealStart, idealEnd],
      mustResolveByDay: idealEnd,
      status: "locked",
      description: entry.purpose || "",
      allowedDevelopments: entry.allowedDevelopments || [],
    });
  }
  for (const entry of plan.seriesBible?.informationRelease || []) {
    beats.push({
      beatId: `information_${slug(entry.concept)}`,
      type: "staged_information_release",
      notBeforeDay: Number(entry.firstAppearanceDay || 1),
      idealDayRange: [Number(entry.nameRevealDay || entry.firstAppearanceDay || 1), Number(entry.fullyUnderstoodDay || entry.nameRevealDay || 30)],
      mustResolveByDay: Number(entry.fullyUnderstoodDay || 30),
      status: "locked",
      concept: entry.concept,
      stages: {
        firstAppearanceDay: Number(entry.firstAppearanceDay || 1),
        nameRevealDay: Number(entry.nameRevealDay || 1),
        fullyUnderstoodDay: Number(entry.fullyUnderstoodDay || 30),
      },
    });
  }
  for (const entry of plan.hiddenFutureBeats || []) {
    beats.push({
      beatId: entry.id || `future_${slug(entry.secret)}`,
      type: "major_reveal",
      notBeforeDay: Number(entry.revealDay || 30),
      idealDayRange: [Number(entry.revealDay || 30), Math.min(30, Number(entry.revealDay || 30) + 3)],
      mustResolveByDay: Math.min(30, Number(entry.revealDay || 30) + 5),
      status: "locked",
      secret: entry.secret,
      allowedSetup: entry.allowedSetup,
    });
  }
  return beats;
}

export function availableRoadmapBeats(beats = [], startDay, endDay, consumed = []) {
  const consumedSet = new Set(consumed);
  const available = [];
  const locked = [];
  for (const beat of beats) {
    if (consumedSet.has(beat.beatId) || beat.status === "consumed") continue;
    const notBefore = Number(beat.notBeforeDay || 1);
    const mustBy = Number(beat.mustResolveByDay || 30);
    if (notBefore <= endDay && mustBy >= startDay) available.push(beat);
    else locked.push(beat);
  }
  return { available, locked };
}

export function validateConsumedBeats(consumedIds = [], available = []) {
  const allowed = new Set(available.map((beat) => beat.beatId));
  const illegal = consumedIds.filter((id) => !allowed.has(id));
  if (illegal.length) throw new Error(`ROADMAP_BEAT_LOCKED:${illegal.join(",")}`);
}

const mergeUnique = (left = [], right = []) => [...new Set([...(left || []), ...(right || [])])];

export function mergeStoryState(previous = {}, delta = {}, verified = {}) {
  const priorEntities = Array.isArray(previous.entities) ? previous.entities : [];
  const changes = Array.isArray(delta.entityChanges) ? delta.entityChanges : [];
  const entities = priorEntities.map((entity) => ({ ...entity }));
  for (const change of changes) {
    const index = entities.findIndex((entity) => entity.entityId === change.entityId);
    if (index < 0) entities.push({ ...change });
    else entities[index] = { ...entities[index], ...change, relationships: { ...(entities[index].relationships || {}), ...(change.relationships || {}) } };
  }
  return {
    ...previous,
    entities,
    relationships: { ...(previous.relationships || {}), ...(delta.relationshipChanges || {}) },
    inventory: mergeUnique(previous.inventory, delta.inventoryChanges?.added).filter((item) => !(delta.inventoryChanges?.removed || []).includes(item)),
    abilities: mergeUnique(previous.abilities, delta.abilityChanges?.learned).filter((item) => !(delta.abilityChanges?.lost || []).includes(item)),
    mysteries: { ...(previous.mysteries || {}), ...(delta.mysteryChanges || {}) },
    currentLocation: delta.locationChange || previous.currentLocation || null,
    events: mergeUnique(previous.events, verified.events || delta.newEvents),
    consumedBeatIds: mergeUnique(previous.consumedBeatIds, delta.roadmapBeatsConsumed),
    lastVerifiedEpisodeId: verified.episodeId || previous.lastVerifiedEpisodeId || null,
    lastVerifiedAt: verified.verifiedAt || previous.lastVerifiedAt || null,
  };
}

export function verifyEpisodeFromRenderedScenes({ episodeId, plan, scenes = [] }) {
  const successful = scenes.filter((scene) => scene.imageStatus === "succeeded" && scene.videoStatus === "succeeded" && scene.qaStatus !== "failed");
  if (!successful.length) throw new Error("NO_VERIFIED_SCENES");
  const plannedByIndex = new Map((plan.scenes || []).map((scene) => [Number(scene.index), scene]));
  const events = successful.map((rendered) => {
    const planned = plannedByIndex.get(Number(rendered.index)) || rendered;
    // QA observations describe pixels ("a LEGO scene depicting...") and
    // can be fragmentary. They are audit data, not story beats or narration
    // source material. Canon uses the authored causal action instead.
    return String(planned.mainAction || planned.protagonistAction || planned.storyDevelopment || planned.visualEvent || "").trim();
  }).filter(Boolean);
  if (!events.length) throw new Error("VERIFIED_EVENTS_EMPTY");
  return {
    episodeId,
    events,
    observations: successful.map((scene) => ({ sceneIndex: Number(scene.index), observation: scene.visualObservation || scene.qaReason || "verified usable" })),
    verifiedSceneIndexes: successful.map((scene) => Number(scene.index)),
    verifiedAt: new Date().toISOString(),
  };
}

export function buildVideoContinuityPrompt(scene, nextScene, durationSec = 5, cameraMode = null) {
  const firstPerson = cameraMode === "first_person" || scene?.shotType === "pov";
  const isEpisodeCliffhanger = scene?.beatType === "cliffhanger" && !nextScene;
  return [
    `Animate this still into a silent ${durationSec}-second clip. No dialogue, lip-sync, captions, text, or music.`,
    `START: ${scene.startState || scene.continuityFromPrevious || "Match the source still exactly."}`,
    `ACTION: ${scene.mainAction || scene.visualEvent || scene.videoPrompt || "One clear physical action occurs."}`,
    `REACTION: ${scene.reaction || "Show the visible character or environmental consequence."}`,
    `END: ${scene.endState || nextScene?.startState || "Land on a clear changed state."}`,
    nextScene?.startState ? `NEXT-SCENE HANDOFF: Finish in a composition and physical state that directly supports: ${nextScene.startState}` : isEpisodeCliffhanger
      ? "FINAL CLIFFHANGER: end on a concrete, visibly unresolved discovery, danger, decision, arrival, signal, disappearance, or reversal. Give a small payoff from this episode, but do NOT solve the larger question or return everyone to safety; the last frame must make the next episode feel necessary."
      : "FINAL HANDOFF: hold the episode's concrete ending state.",
    "IDENTITY LOCK — FIRST FRAME THROUGH FINAL FRAME: every visible person, creature, and object remains the exact same identity, species, evolutionary form, anatomy, colors, markings, clothing, and accessories shown in the source still. Motion and fighting are physical movement only. Never evolve, transform, morph, mutate, replace, fuse, duplicate, or introduce a new character/creature unless the scene explicitly requests that transformation.",
    "ZERO TYPOGRAPHY THROUGHOUT: never generate subtitles, captions, dialogue text, speech bubbles, title/day/location cards, lower thirds, labels, logos, watermarks, UI/HUD, or readable letters/numbers. If the source contains accidental text, do not animate, rewrite, reveal, emphasize, or move toward it; keep it indistinct and out of attention.",
    "SOURCE-STILL CONTRACT: preserve the source subject count and every identity through the final frame. Do not add random people or creatures.",
    "CAST-FORMAT LOCK: the source still is one shot with one cast. Through the final frame, no subject may become another character, borrow another character's clothing/body/species, become a humanlike stand-in, or change role. Keep the same single-camera visual format; never introduce a panel, cutaway, split screen, montage, or new shot.",
    "FINAL-FRAME CHECK: the last frame must still visibly contain the same source cast, identities, species/forms, wardrobe, viewpoint, and environment. The only allowed change is the requested physical action/reaction — never a semantic identity or camera-format change.",
    firstPerson ? "POV LOCK: remain strict first-person POV for the entire clip, including the final frame. Show only the same hands/arms or body cues present in the source; never cut, orbit, pull back, reflect, or reveal a third-person protagonist or stand-in." : "CAMERA LOCK: preserve the intended camera grammar and never invent a viewpoint change that reveals a new protagonist.",
  ].join("\n");
}

export function repairLegacySeries(series = {}) {
  const plan = {
    worldBible: series.master_story_bible?.worldBible || series.master_story_bible || {},
    seriesBible: series.master_story_bible || {},
    visualReferences: series.reference_library || [],
  };
  const entities = buildInitialEntityRegistry(plan);
  const references = bindReferencesToEntities(plan.visualReferences, entities);
  const priorState = series.verified_story_state || series.current_story_state || {};
  return {
    franchiseResolution: coerceFranchiseResolution(series.universe, {
      resolvedFranchise: plan.worldBible.franchise || series.universe,
      resolvedProperty: plan.worldBible.world || plan.worldBible.franchise || series.universe,
      resolvedWorld: plan.worldBible.world || series.universe,
      confidence: plan.worldBible.confidence || 0,
      rationale: "Legacy row repaired from its persisted world bible.",
    }),
    entityRegistry: entities,
    referenceLibrary: references,
    verifiedStoryState: { ...priorState, entities: Array.isArray(priorState.entities) ? priorState.entities : entities },
    roadmapBeats: buildStructuredRoadmapBeats({ seriesBible: plan.seriesBible, hiddenFutureBeats: series.hidden_future_beats || [] }),
    pacingState: { ...pacingForDay(Math.max(1, Number(series.current_day || 0) + 1)), consumedBeatIds: priorState.consumedBeatIds || [] },
  };
}
