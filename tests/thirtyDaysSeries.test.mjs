import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  activeReferenceForEntity,
  alignSceneDayToEntityIntroductions,
  assignSceneReferences,
  availableRoadmapBeats,
  buildInitialEntityRegistry,
  buildVideoContinuityPrompt,
  coerceFranchiseResolution,
  mergeStoryState,
  repairLegacySeries,
  validateConsumedBeats,
} from "../supabase/functions/_shared/thirtyDaysSeriesEngine.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Series mode is additive and the style cards use dark green unselected states", () => {
  const page = read("src/pages/workspace/ThirtyDays.jsx");
  const switcher = read("src/components/viral-tools/thirty-days/ThirtyDaysModeSwitch.jsx");
  const styles = read("src/components/viral-tools/thirty-days/VisualStyleSelector.jsx");
  assert.match(switcher, /Single Video/);
  assert.match(switcher, /Series/);
  assert.match(page, /mode === "series"/);
  assert.match(page, /ThirtyDaysBuilder/);
  assert.match(styles, /border-emerald-950\/80 bg-\[#090D0B\]/);
  assert.doesNotMatch(styles, /border-white\/8 bg-white/);
});

test("Series persistence uses normalized tables, ownership RLS, indexes, and lazy episode history", () => {
  const migration = read("supabase/migrations/20260825145731_thirty_days_series_mode.sql");
  const results = read("src/components/viral-tools/thirty-days/ThirtyDaysSeriesResults.jsx");
  assert.match(migration, /CREATE TABLE public\.thirty_days_series \(/);
  assert.match(migration, /CREATE TABLE public\.thirty_days_series_episodes \(/);
  assert.match(migration, /USING \(\(SELECT auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /thirty_days_series_user_active/);
  assert.match(migration, /thirty_days_series_episodes_series_number/);
  assert.match(results, /preload="metadata"/);
  assert.doesNotMatch(results, /episodes\.map[\s\S]{0,500}<video/);
});

test("Master planner stores flexible arcs and future secrets without writing 30 scripts", () => {
  const planner = read("supabase/functions/thirty-days-series-planner/index.ts");
  assert.match(planner, /Days 1-5 arrival\/discovery/);
  assert.match(planner, /16-20 revelation and serious setback/);
  assert.match(planner, /hiddenFutureBeats/);
  assert.match(planner, /allowedSetup/);
  assert.match(planner, /SERIES BIBLE, not 30 complete scripts/);
  assert.match(planner, /reference 1 must be YOU/);
  assert.match(planner, /minItems: 5, maxItems: 5/);
  assert.match(planner, /refs\.length !== 5/);
  // A bare role word ("companion", "artifact") as a setup reference id
  // permanently collides with any future episode's own newReferences entry
  // for that same role — enforced deterministically, not just via prompt.
  assert.match(planner, /function ensureUniqueReferenceIds/);
  assert.match(planner, /ensureUniqueReferenceIds\(plan\.visualReferences\)/);
});

test("Episode planner enforces seven-scene mini-stories, critic repair, and spoiler gates", () => {
  const planner = read("supabase/functions/thirty-days-series-episode-planner/index.ts");
  assert.match(planner, /minItems: 7, maxItems: 7/);
  assert.match(planner, /hook", "setup", "development", "complication", "turn", "payoff", "cliffhanger/);
  assert.match(planner, /FORBIDDEN FUTURE BEATS/);
  assert.match(planner, /FUTURE_BEAT_SPOILED/);
  assert.match(planner, /if \(!critic\.pass\)/);
  assert.match(planner, /every score is at least 7/);
  assert.match(planner, /PROGRESSIVE PLACE MEMORY/);
  assert.match(planner, /at most ONE environment\/location reference/);
  assert.match(planner, /newReferences may contain up to 3/);
  assert.match(planner, /Keep the diagnostic code in server logs only/);
  assert.doesNotMatch(planner, /\(\$\{code\}\)/);
});

test("Series billing is progressive, server-priced, retry-aware, and never reserves 30 episodes", () => {
  const migration = read("supabase/migrations/20260825145731_thirty_days_series_mode.sql");
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysSeriesApi.js");
  assert.match(migration, /v_total := v_ref_count \* v_tier\.reference_cost_credits \+ v_setup_service/);
  assert.match(migration, /v_ref_count <> 5/);
  assert.match(migration, /v_scene_count \* v_tier\.image_cost_credits/);
  assert.match(migration, /v_scene_count \* v_tier\.video_cost_credits/);
  assert.doesNotMatch(migration, /30 \* v_tier\.video_cost_credits/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /EPISODE_ALREADY_ACTIVE/);
  assert.match(migration, /reopen_thirty_days_series_video_retry/);
  assert.match(migration, /retry_count BETWEEN 0 AND 1/);
  assert.match(api, /SERIES_SCENE_COUNT \* Number\(tier\.videoCredits/);
});

test("Series narration is clip-synced, episode-sized, continuous, and spoiler-aware", () => {
  const script = read("supabase/functions/thirty-days-script/index.ts");
  const voice = read("src/components/viral-tools/thirty-days/ThirtyDaysVoiceStep.jsx");
  assert.match(script, /mode\?: "single" \| "series"/);
  assert.match(script, /storedGeneration\.generation_mode === "series_episode"/);
  assert.match(script, /Write the full episode as one continuous story, then divide that story into exactly seven scene beats/);
  assert.match(script, /RUNNING SUMMARY OF EVERY PREVIOUS EPISODE/);
  assert.match(script, /PERSISTENT REFERENCES AND FIXED SPELLINGS/);
  assert.match(script, /UNRESOLVED THREAD FROM THE PREVIOUS EPISODE/);
  assert.match(script, /ALL PREVIOUS TITLES \(do not reuse any significant word\)/);
  assert.match(script, /FORBIDDEN FUTURE REVEALS/);
  assert.match(script, /Previous episode continuity is required before Series narration can be written/);
  assert.match(script, /resolvedWorldBible\.franchise/);
  assert.match(script, /hook plus all seven narration lines must total 100-115 spoken words/i);
  assert.match(script, /scene \$\{expectedScene\} must contain 10-18 words/);
  assert.match(script, /cliffhanger_thread/);
  assert.match(script, /EPISODE \$\{episodeNumber\} FULL PROMPT ATTEMPT/);
  assert.match(script, /EPISODE \$\{episodeNumber\} RAW JSON ATTEMPT/);
  assert.match(voice, /seriesContext/);
  assert.match(voice, /elevenlabs-alignment-per-rendered-clip/);
});

test("Episode planner requires the immediately previous structured state and persists full continuity memory", () => {
  const planner = read("supabase/functions/thirty-days-series-episode-planner/index.ts");
  assert.match(planner, /PREVIOUS EPISODE — REQUIRED CONTINUITY INPUT/);
  assert.match(planner, /MASTER 30-DAY ROADMAP/);
  assert.match(planner, /\.order\("episode_number", \{ ascending: true \}\)/);
  assert.match(planner, /Number\(previousEpisode\.end_day\) !== startDay - 1/);
  for (const field of ["endingLocation", "companions", "relationships", "items", "abilities", "knownInformation", "unresolvedMysteries", "nextEpisodeSetup"]) {
    assert.match(planner, new RegExp(`\\b${field}\\b`));
  }
});

test("Pokémon Days 3-4 proposed narration is concrete, first-person, and day-continuous", () => {
  const proposed = [
    "Day 3 in Pokémon, the Team Rocket grunts from last night finally made their move.",
    "Blaze stayed beside me while I confronted them in Central Park.",
    "They admitted they wanted the Legendary Pokémon's power for themselves.",
    "So I drilled Blaze's Ember until the flame stopped wavering.",
    "Professor Willow arrived and warned me their attack was already coming.",
    "Day 4, my Pokédex caught a strange signal across the park.",
    "Blaze and I followed it until a glowing figure appeared ahead.",
    "The Legendary Pokémon turned toward me, and I froze before making my move.",
  ].join(" ");
  assert.equal((proposed.match(/\bDay 3\b/g) || []).length, 1);
  assert.equal((proposed.match(/\bDay 4\b/g) || []).length, 1);
  assert.match(proposed, /Team Rocket/);
  assert.match(proposed, /Blaze/);
  assert.match(proposed, /Professor Willow/);
  assert.match(proposed, /Pokédex/);
  assert.doesNotMatch(proposed, /\b(?:you|your)\b/i);
  assert.doesNotMatch(proposed, /everything suddenly changed|only ally I could trust|dangerous new plan/i);
});

function advanceFixture({ daysPerEpisode, summaries }) {
  const state = { currentDay: 0, protagonist: summaries[0].protagonist, relationships: new Set(), team: new Set() };
  summaries.forEach((summary, index) => {
    const start = state.currentDay + 1;
    const end = Math.min(30, start + daysPerEpisode - 1);
    assert.deepEqual(summary.daysCovered, Array.from({ length: end - start + 1 }, (_, offset) => start + offset));
    assert.equal(summary.protagonist, state.protagonist);
    summary.relationships.forEach((value) => state.relationships.add(value));
    summary.team.forEach((value) => state.team.add(value));
    assert.ok(summary.cliffhanger && (index === summaries.length - 1 || summary.nextResolvesPrevious));
    state.currentDay = end;
  });
  return state;
}

test("Ninjago Day 1, Day 2, and Day 3 fixture preserves YOU, relationships, and ordered continuity", () => {
  const state = advanceFixture({ daysPerEpisode: 1, summaries: [
    { daysCovered: [1], protagonist: "white-skull green-armored skeleton ninja", relationships: ["Lloyd distrusts YOU"], team: [], cliffhanger: "signal outside monastery", nextResolvesPrevious: true },
    { daysCovered: [2], protagonist: "white-skull green-armored skeleton ninja", relationships: ["Lloyd investigates with YOU"], team: [], cliffhanger: "signal opens a tunnel", nextResolvesPrevious: true },
    { daysCovered: [3], protagonist: "white-skull green-armored skeleton ninja", relationships: ["Lloyd trusts YOU with the map"], team: [], cliffhanger: "map points beneath the city", nextResolvesPrevious: true },
  ] });
  assert.equal(state.currentDay, 3);
  assert.equal(state.relationships.size, 3);
});

test("Pokémon Days 1-2, 3-4, and 5-6 fixture keeps the trainer and accumulated team", () => {
  const state = advanceFixture({ daysPerEpisode: 2, summaries: [
    { daysCovered: [1, 2], protagonist: "red-jacket viewer trainer", relationships: ["Eevee chooses YOU"], team: ["Eevee"], cliffhanger: "Ash offers a battle", nextResolvesPrevious: true },
    { daysCovered: [3, 4], protagonist: "red-jacket viewer trainer", relationships: ["Eevee protects YOU"], team: ["Eevee", "Pidgey"], cliffhanger: "Pidgey spots Team Rocket", nextResolvesPrevious: true },
    { daysCovered: [5, 6], protagonist: "red-jacket viewer trainer", relationships: ["Eevee accepts the new teammate"], team: ["Eevee", "Pidgey"], cliffhanger: "Team Rocket steals the badge", nextResolvesPrevious: true },
  ] });
  assert.equal(state.currentDay, 6);
  assert.deepEqual([...state.team].sort(), ["Eevee", "Pidgey"]);
});

test("Series v2 persists a canonical resolution boundary without silently narrowing the property", () => {
  const resolution = coerceFranchiseResolution("  Pokémon  ", {
    resolvedFranchise: "Pokémon", resolvedProperty: "general Pokémon universe", resolvedWorld: "Pokémon",
    confidence: 0.98, aliases: ["Pokemon"], candidates: [{ name: "Pokémon", confidence: 0.98, reason: "exact franchise" }],
  });
  assert.equal(resolution.rawUserInput, "Pokémon");
  assert.equal(resolution.normalizedInput, "pokémon");
  assert.equal(resolution.resolvedProperty, "general Pokémon universe");
  assert.doesNotMatch(resolution.resolvedProperty, /go/i);
  const migration = read("supabase/migrations/20260829120000_thirty_days_series_story_engine_v2.sql");
  for (const field of ["raw_user_input", "normalized_input", "franchise_resolution", "series_schema_version", "roadmap_version", "entity_registry_version"]) assert.match(migration, new RegExp(field));
});

test("entity-driven references preserve the active companion form and never substitute labels", () => {
  const entities = [
    { entityId: "protagonist", entityType: "protagonist", status: "active" },
    { entityId: "companion_blaze", entityType: "companion", status: "active", currentForm: "Charmeleon" },
  ];
  const references = [
    { id: "you", entityId: "protagonist", version: 1, activeFromDay: 1 },
    { id: "ref_blaze_v1", entityId: "companion_blaze", version: 1, activeFromDay: 1 },
    { id: "ref_blaze_v2", entityId: "companion_blaze", version: 2, activeFromDay: 15, supersedes: "ref_blaze_v1" },
    { id: "ref_unrelated", entityId: "professor", version: 1, activeFromDay: 1 },
  ];
  assert.equal(activeReferenceForEntity("companion_blaze", references, 14).id, "ref_blaze_v1");
  assert.equal(activeReferenceForEntity("companion_blaze", references, 15).id, "ref_blaze_v2");
  const scene = assignSceneReferences({ day: 15, requiredEntities: ["companion_blaze"] }, entities, references, 15);
  assert.deepEqual(scene.referenceIds, ["you", "ref_blaze_v2"]);
  assert.throws(() => assignSceneReferences({ day: 15, requiredEntities: ["professor"] }, entities, references, 15), /UNKNOWN_REQUIRED_ENTITY/);
});

test("assignSceneReferences rejects a requiredEntity that is not active for the scene day", () => {
  const entities = [
    { entityId: "protagonist", entityType: "protagonist", status: "active" },
    { entityId: "companion_eevee", entityType: "companion", status: "active", introducedDay: 2 },
  ];
  const references = [
    { id: "you", entityId: "protagonist", version: 1, activeFromDay: 1 },
    { id: "companion", entityId: "companion_eevee", version: 1, activeFromDay: 2 },
  ];
  // Day 1, before the companion's introducedDay/activeFromDay of 2 — the
  // reference genuinely exists, it just isn't active yet for this scene.
  // A model day/entity mismatch must be repaired by the planner. Silently
  // dropping the entity would produce a scene that names a character but
  // generates without that character's identity reference.
  assert.throws(
    () => assignSceneReferences({ day: 1, requiredEntities: ["companion_eevee"] }, entities, references, 1),
    /ENTITY_REFERENCE_NOT_ACTIVE:companion_eevee:day_1:active_from_2/,
  );
  // Day 2 onward, the same requirement resolves normally.
  const scene = assignSceneReferences({ day: 2, requiredEntities: ["companion_eevee"] }, entities, references, 2);
  assert.deepEqual(scene.referenceIds, ["you", "companion"]);
});

test("episode scenes align to required entity introduction days inside the episode", () => {
  const entities = [
    { entityId: "protagonist", entityType: "protagonist", introducedDay: 1 },
    { entityId: "companion_eevee", entityType: "companion", introducedDay: 2 },
  ];
  const aligned = alignSceneDayToEntityIntroductions(
    { day: 1, requiredEntities: ["companion_eevee"] },
    entities,
    1,
    2,
  );
  assert.equal(aligned.day, 2);
  assert.equal(aligned.timingAdjustedFromDay, 1);
  assert.throws(
    () => alignSceneDayToEntityIntroductions(
      { day: 1, requiredEntities: ["companion_eevee"] },
      [{ ...entities[1], introducedDay: 3 }],
      1,
      2,
    ),
    /ENTITY_INTRODUCED_AFTER_EPISODE:companion_eevee/,
  );
});

test("assignSceneReferences resolves an entity's own given name, not just its type or entityId", () => {
  const entities = [
    { entityId: "protagonist", entityType: "protagonist", status: "active" },
    { entityId: "companion_eevee", entityType: "companion", status: "active", displayName: "Eevee", canonicalType: "Eevee", visualIdentity: "Nova — an Eevee you rescue and name" },
  ];
  const references = [
    { id: "you", entityId: "protagonist", version: 1, activeFromDay: 1 },
    { id: "companion", entityId: "companion_eevee", version: 1, activeFromDay: 1 },
  ];
  const scene = assignSceneReferences({ day: 1, requiredEntities: ["nova"] }, entities, references, 1);
  assert.deepEqual(scene.requiredEntities, ["protagonist", "companion_eevee"]);
  assert.deepEqual(scene.referenceIds, ["you", "companion"]);
});

test("assignSceneReferences resolves a persistent reference id back to its bound entity", () => {
  const entities = [
    { entityId: "protagonist", entityType: "protagonist", status: "active" },
    { entityId: "companion_eevee", entityType: "companion", status: "active", displayName: "Eevee" },
  ];
  const references = [
    { id: "you", entityId: "protagonist", version: 1, activeFromDay: 1 },
    { id: "ref_companion_eevee_v1", entityId: "companion_eevee", version: 1, activeFromDay: 1 },
  ];
  const scene = assignSceneReferences(
    { day: 3, requiredEntities: ["ref_companion_eevee_v1"] },
    entities,
    references,
    3,
  );
  assert.deepEqual(scene.requiredEntities, ["protagonist", "companion_eevee"]);
  assert.deepEqual(scene.referenceIds, ["you", "ref_companion_eevee_v1"]);
});

test("buildInitialEntityRegistry extracts a leading given name before its species/type clause", () => {
  const entities = buildInitialEntityRegistry({
    worldBible: {}, visualReferences: [{ id: "you", role: "protagonist" }],
    seriesBible: { growthArc: { type: "companion", identity: "Nova — an Eevee you rescue and name", acquisitionDay: 2 } },
  });
  const companion = entities.find((entity) => entity.entityType === "companion");
  assert.equal(companion.displayName, "Nova");
  assert.equal(companion.canonicalType, "Eevee");
  assert.equal(companion.entityId, "companion_nova");
});

test("assignSceneReferences normalizes the 'you'/'YOU' protagonist alias to entityId protagonist", () => {
  const entities = [{ entityId: "protagonist", entityType: "protagonist", status: "active" }];
  const references = [{ id: "you", entityId: "protagonist", version: 1, activeFromDay: 1 }];
  const scene = assignSceneReferences({ day: 1, requiredEntities: ["YOU"], forbiddenEntities: ["you"] }, entities, references, 1);
  assert.deepEqual(scene.requiredEntities, ["protagonist"]);
  assert.deepEqual(scene.forbiddenEntities, ["protagonist"]);
  assert.deepEqual(scene.referenceIds, ["you"]);
});

test("assignSceneReferences resolves a generic category word to the single matching entity, but not when ambiguous", () => {
  const entities = [
    { entityId: "protagonist", entityType: "protagonist", status: "active" },
    { entityId: "companion_bulbasaur", entityType: "companion", status: "active" },
  ];
  const references = [
    { id: "you", entityId: "protagonist", version: 1, activeFromDay: 1 },
    { id: "ref_bulbasaur_v1", entityId: "companion_bulbasaur", version: 1, activeFromDay: 1 },
  ];
  const scene = assignSceneReferences({ day: 1, requiredEntities: ["companion"] }, entities, references, 1);
  assert.deepEqual(scene.requiredEntities, ["protagonist", "companion_bulbasaur"]);
  // A second same-type entity with NO reference yet (introduced this same
  // episode via newReferences/entityChanges) must not make the established,
  // already-referenced one ambiguous — "companion" should still resolve to
  // companion_bulbasaur, not throw.
  const withNewUnreferencedCompanion = [...entities, { entityId: "companion_pidgey", entityType: "companion", status: "active" }];
  const sceneWithNew = assignSceneReferences({ day: 1, requiredEntities: ["companion"] }, withNewUnreferencedCompanion, references, 1);
  assert.deepEqual(sceneWithNew.requiredEntities, ["protagonist", "companion_bulbasaur"]);
  // Two same-type entities that BOTH already have a locked reference is
  // genuinely ambiguous and must still throw rather than guess.
  const withTwoReferencedCompanions = [...references, { id: "ref_pidgey_v1", entityId: "companion_pidgey", version: 1, activeFromDay: 1 }];
  assert.throws(() => assignSceneReferences({ day: 1, requiredEntities: ["companion"] }, withNewUnreferencedCompanion, withTwoReferencedCompanions, 1), /UNKNOWN_REQUIRED_ENTITY/);
});

test("story state is merged by explicit deltas so omitted entities survive", () => {
  const previous = {
    entities: [{ entityId: "protagonist", status: "active" }, { entityId: "companion_blaze", status: "active", currentForm: "Charmander" }],
    inventory: ["map"], abilities: ["Ember"], consumedBeatIds: ["arrival"], events: ["Blaze joined"],
  };
  const next = mergeStoryState(previous, {
    entityChanges: [], relationshipChanges: { companion_blaze: "trusted" },
    inventoryChanges: { added: ["badge"], removed: [] }, abilityChanges: { learned: ["Smokescreen"], lost: [] },
    mysteryChanges: {}, roadmapBeatsConsumed: ["first_win"], locationChange: "Cerulean City", newEvents: [],
  }, { episodeId: "ep2", events: ["Blaze protected the protagonist"], verifiedAt: "2026-08-29T00:00:00Z" });
  assert.equal(next.entities.find((entity) => entity.entityId === "companion_blaze").currentForm, "Charmander");
  assert.deepEqual(next.inventory.sort(), ["badge", "map"]);
  assert.deepEqual(next.consumedBeatIds, ["arrival", "first_win"]);
});

test("roadmap gates keep major reveals locked until their eligible window", () => {
  const beats = [
    { beatId: "foundation", notBeforeDay: 1, mustResolveByDay: 5 },
    { beatId: "day20_reveal", notBeforeDay: 18, mustResolveByDay: 22 },
  ];
  const early = availableRoadmapBeats(beats, 3, 4, []);
  assert.deepEqual(early.available.map((beat) => beat.beatId), ["foundation"]);
  assert.throws(() => validateConsumedBeats(["day20_reveal"], early.available), /ROADMAP_BEAT_LOCKED/);
  assert.doesNotThrow(() => validateConsumedBeats(["day20_reveal"], availableRoadmapBeats(beats, 19, 20, []).available));
});

test("video prompts explicitly hand each clip's end state into the next scene", () => {
  const prompt = buildVideoContinuityPrompt({ startState: "YOU and Lloyd enter the tunnel", mainAction: "the map lights up", reaction: "Lloyd shields his eyes", endState: "a green door opens" }, { startState: "YOU and Lloyd stand before the open green door" }, 5);
  assert.match(prompt, /START: YOU and Lloyd enter the tunnel/);
  assert.match(prompt, /ACTION: the map lights up/);
  assert.match(prompt, /REACTION: Lloyd shields his eyes/);
  assert.match(prompt, /END: a green door opens/);
  assert.match(prompt, /NEXT-SCENE HANDOFF/);
  assert.match(prompt, /CAST-FORMAT LOCK/);
  assert.match(prompt, /FINAL-FRAME CHECK/);
});

for (const fixture of [
  { universe: "Pokémon", franchise: "Pokémon", growthArc: { type: "companion", identity: "a Charmander named Blaze", acquisitionDay: 1 }, ref: { id: "ref_blaze_v1", role: "companion", label: "Blaze the Charmander", visualLock: "orange Charmander", prompt: "Blaze" }, expectedType: "companion" },
  { universe: "Ninjago", franchise: "LEGO Ninjago", growthArc: { type: "power", identity: "the elemental power of Wind", acquisitionDay: 1 }, ref: { id: "ref_wind_v1", role: "artifact", label: "Wind power", visualLock: "green wind spiral", prompt: "Wind power" }, expectedType: "power" },
  { universe: "Hogwarts", franchise: "Harry Potter", growthArc: { type: "tool", identity: "a rowan wand named Rowan", acquisitionDay: 1 }, ref: { id: "ref_rowan_v1", role: "artifact", label: "Rowan wand", visualLock: "rowan wood wand", prompt: "Rowan wand" }, expectedType: "item" },
]) {
  test(`${fixture.universe} legacy repair creates generic persistent entity memory`, () => {
    const repaired = repairLegacySeries({ universe: fixture.universe, current_day: 0, master_story_bible: { worldBible: { franchise: fixture.franchise, world: fixture.franchise, confidence: 0.9, viewerProtagonist: { visualIdentity: "locked YOU" } }, growthArc: fixture.growthArc, roadmap: [] }, hidden_future_beats: [], reference_library: [{ id: "you", role: "protagonist", label: "YOU", prompt: "YOU", visualLock: "locked YOU" }, fixture.ref], current_story_state: {} });
    assert.equal(repaired.franchiseResolution.resolvedFranchise, fixture.franchise);
    assert.ok(repaired.entityRegistry.some((entity) => entity.entityType === fixture.expectedType));
    assert.ok(repaired.verifiedStoryState.entities.length >= 2);
  });
}

test("browser completion cannot submit planner prose as canon", () => {
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysSeriesApi.js");
  const migration = read("supabase/migrations/20260829120000_thirty_days_series_story_engine_v2.sql");
  assert.match(api, /episodeSummary is intentionally ignored/);
  assert.match(api, /thirty-days-series-episode-commit/);
  assert.doesNotMatch(api, /rpc\("complete_thirty_days_series_episode"/);
  assert.match(migration, /service_commit_thirty_days_series_episode/);
  assert.match(migration, /EPISODE_MEDIA_NOT_VERIFIED/);
});

test("Series scene images are story-first and treat references as identity-only", () => {
  const browserApi = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  const background = read("supabase/functions/thirty-days-generation-advance/index.ts");
  for (const source of [browserApi, background]) {
    assert.match(source, /CREATE THIS EXACT NEXT STORY SHOT/);
    assert.match(source, /ONE OBVIOUS MAIN ACTION/);
    assert.match(source, /VISIBLE REACTION\/CONSEQUENCE/);
    assert.match(source, /Do NOT copy|Do not copy/);
    assert.match(source, /pose, background, camera/);
    assert.match(source, /COMPOSITION DIVERSITY/);
    assert.ok(source.indexOf("CREATE THIS EXACT NEXT STORY SHOT") < source.indexOf("IDENTITY REFERENCES — apply only after composing"));
  }
});

test("Series creates one undivided image per scene and never auto-generates a QA variation", () => {
  const browserApi = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  const background = read("supabase/functions/thirty-days-generation-advance/index.ts");
  const qa = read("supabase/functions/thirty-days-scene-qa/index.ts");
  const lock = read("supabase/migrations/20260830223000_thirty_days_single_asset_job_lock.sql");
  for (const source of [browserApi, background]) {
    assert.match(source, /exactly ONE continuous full-frame image/);
    assert.match(source, /comic page, manga page, storyboard, contact sheet/);
    assert.match(source, /ONE SINGLE UNDIVIDED FRAME/);
    assert.match(source, /CANVAS INTEGRITY/);
    assert.match(source, /CAST-INTEGRITY CONTRACT/);
  }
  const sceneImageHelper = hook.slice(
    hook.indexOf("async function generateSceneImageWithEscalation"),
    hook.indexOf("async function animateSceneWithEscalation"),
  );
  assert.match(sceneImageHelper, /liveScenes\?\.\(\)/);
  assert.doesNotMatch(sceneImageHelper, /generationRef\.current/);
  assert.doesNotMatch(sceneImageHelper, /MAX_IMAGE_ATTEMPTS|for \(let attempt/);
  assert.doesNotMatch(background, /scene\.qaRepaired/);
  assert.match(qa, /SINGLE-FRAME GATE/);
  assert.match(qa, /CANVAS GATE/);
  assert.match(qa, /CAST-INTEGRITY GATE/);
  assert.match(sceneImageHelper, /qa\?\.usable === false/);
  assert.match(background, /const qaRejected = qa\.status !== "unavailable" && qa\.usable === false/);
  assert.match(lock, /ASSET_JOB_ALREADY_ACTIVE/);
  assert.match(lock, /v_asset\.job_id <> p_job_id/);
});

test("V4 scene stills use Nano Banana 2K instead of the costly 4K variant", () => {
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  const migration = read("supabase/migrations/20260830224500_thirty_days_v4_scene_images_2k.sql");
  assert.match(api, /"thirtydays-v4"[^\n]+imageToolKey: "image:thirtydays2k"[^\n]+imageWidth: 1536[^\n]+imageHeight: 2752[^\n]+imageCredits: 7/);
  assert.match(migration, /WHERE quality_tier = 'thirtydays-v4'/);
  assert.match(migration, /image_tool_key = 'image:thirtydays2k'/);
  assert.doesNotMatch(migration, /image_tool_key = 'image:thirtydays4k'/);
});

test("Series filters environment references by the exact scene location", () => {
  const browserApi = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  const background = read("supabase/functions/thirty-days-generation-advance/index.ts");
  for (const source of [browserApi, background]) {
    assert.match(source, /selectSceneReferenceIds/);
    assert.match(source, /startsWith\("environment"\)/);
    assert.match(source, /overlaps\(identityWords, locationWords\)/);
    assert.match(source, /requiredProps/);
  }
});

test("Series completion can recover an episode through the generation's immutable forward link", () => {
  const commit = read("supabase/functions/thirty-days-series-episode-commit/index.ts");
  assert.match(commit, /series_episode_id/);
  assert.match(commit, /thirty_days_generations/);
});

test("pre-animation QA rejects wrong identities and near-duplicate earlier scenes", () => {
  const qa = read("supabase/functions/thirty-days-scene-qa/index.ts");
  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  const background = read("supabase/functions/thirty-days-generation-advance/index.ts");
  assert.match(qa, /DUPLICATE GATE/);
  assert.match(qa, /nearDuplicate/);
  assert.match(qa, /duplicateOfSceneIndex/);
  assert.match(qa, /wrong species\/form\/person is a catastrophic identity failure/);
  assert.match(qa, /previousSceneImages/);
  assert.match(hook, /qa\?\.nearDuplicate !== true/);
  assert.match(hook, /for \(const runScene of sceneTasks\) await runScene\(\)/);
  assert.doesNotMatch(hook, /await Promise\.all\(sceneTasks\)/);
  assert.match(background, /comparison images are earlier scenes/);
  assert.match(background, /near_duplicate:/);
});

test("episode planner hard-gates stagnant locations, repeated cameras, and unbound named characters", () => {
  const planner = read("supabase/functions/thirty-days-series-episode-planner/index.ts");
  assert.match(planner, /STORY-FIRST VISUAL DIRECTION/);
  assert.match(planner, /EPISODE_LOCATION_STAGNATION/);
  assert.match(planner, /EPISODE_ACTIONS_TOO_SIMILAR/);
  assert.match(planner, /CAMERA_REPEATED_THREE_TIMES/);
  assert.match(planner, /CHARACTER_ENTITY_MISSING/);
  assert.match(planner, /REQUIRED_ENTITY_MISSING/);
});

test("episode planner preserves colliding new entity references and synthesizes any required missing identity", () => {
  const planner = read("supabase/functions/thirty-days-series-episode-planner/index.ts");
  assert.match(planner, /renamed colliding new reference/);
  assert.match(planner, /referenceIdRemaps/);
  assert.match(planner, /nextReferenceId\(reference\.entityId \|\| reference\.label \|\| oldId/);
  assert.match(planner, /synthesized missing required entity reference/);
  assert.match(planner, /activeReferenceForEntity\(entity\.entityId, allReferences, endDay\)/);
  assert.match(planner, /newReferences\.length >= 3 \|\| allReferences\.length >= 40/);
  assert.match(planner, /"canon_character"/);
  assert.match(planner, /duplicateEntityVersion/);
  assert.match(planner, /dropping duplicate entity\/version reference/);
  assert.match(planner, /\["", "null", "none", "undefined"\]/);
});

test("episode planner registers named visible characters omitted from the entity delta", () => {
  const planner = read("supabase/functions/thirty-days-series-episode-planner/index.ts");
  assert.match(planner, /findEntityForCharacter/);
  assert.match(planner, /registered missing visible character entity/);
  assert.match(planner, /canon_character_\$\{slug\(characterName\)\}/);
  assert.match(planner, /plan\.stateDelta\.entityChanges\.push/);
  assert.match(planner, /scene\.requiredEntities\.push\(entity\.entityId\)/);
});

test("only the latest Series episode can be deleted and deletion never refunds credits", () => {
  const migration = read("supabase/migrations/20260830120000_thirty_days_delete_latest_series_episode.sql");
  const repairMigration = read("supabase/migrations/20260830130000_thirty_days_preserve_restore_series_references.sql");
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysSeriesApi.js");
  const page = read("src/pages/workspace/ThirtyDays.jsx");
  const results = read("src/components/viral-tools/thirty-days/ThirtyDaysSeriesResults.jsx");
  const sidebar = read("src/components/viral-tools/thirty-days/ThirtyDaysSeriesSidebar.jsx");
  const modal = read("src/components/viral-tools/thirty-days/ThirtyDaysDeleteEpisodeModal.jsx");
  assert.match(migration, /delete_latest_thirty_days_series_episode/);
  assert.match(migration, /ORDER BY episode_number DESC/);
  assert.match(migration, /DELETE_ONLY_LATEST_EPISODE/);
  assert.match(migration, /deletion_refund_credits integer NOT NULL DEFAULT 0 CHECK \(deletion_refund_credits = 0\)/);
  assert.match(migration, /thirty_days_series_episode_deletions_user_time/);
  assert.doesNotMatch(migration, /credit_balance\s*=\s*credit_balance\s*\+/);
  assert.match(migration, /merge_thirty_days_story_state/);
  assert.match(migration, /status IN \('queued', 'running', 'processing'\)/);
  assert.match(migration, /v_restore_references jsonb;/);
  assert.doesNotMatch(migration, /v_restore_references jsonb := '\[\]'::jsonb/);
  assert.match(repairMigration, /restore_thirty_days_series_references/);
  assert.match(repairMigration, /delete_latest_thirty_days_series_episode_v2/);
  assert.match(repairMigration, /v_series := public\.restore_thirty_days_series_references\(v_series\.id\)/);
  assert.match(repairMigration, /REVOKE ALL ON FUNCTION public\.delete_latest_thirty_days_series_episode\(uuid\)[\s\S]*FROM authenticated/);
  assert.doesNotMatch(repairMigration, /credit_balance\s*=\s*credit_balance\s*\+/);
  assert.match(api, /deleteLatestSeriesEpisode/);
  assert.match(api, /delete_latest_thirty_days_series_episode_v2/);
  assert.match(api, /restoreSeriesReferences/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /ThirtyDaysDeleteEpisodeModal/);
  assert.match(page, /setFocusedEpisodeId\(null\)/);
  assert.match(page, /restorePersistentReferences/);
  assert.match(results, /latestEpisodeId/);
  assert.match(results, /Delete latest episode/);
  assert.match(results, /Trash2/);
  assert.match(modal, /Credits will not be refunded/);
  assert.match(modal, /fixed inset-0 z-\[300\]/);
  assert.match(modal, /border-lime-300/);
  assert.match(modal, /Yes, delete episode/);
  assert.match(sidebar, /Restore references/);
  assert.match(sidebar, /onRestoreReferences/);
});

test("persistent Series references have safe delete, duplicate cleanup, and one-slot regeneration", () => {
  const migration = read("supabase/migrations/20260831030000_thirty_days_series_reference_replacement.sql");
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysSeriesApi.js");
  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  const page = read("src/pages/workspace/ThirtyDays.jsx");
  const sidebar = read("src/components/viral-tools/thirty-days/ThirtyDaysSeriesSidebar.jsx");
  const modal = read("src/components/viral-tools/thirty-days/ThirtyDaysDeleteReferenceModal.jsx");

  assert.match(migration, /remove_thirty_days_series_reference/);
  assert.match(migration, /duplicate_removed/);
  assert.match(migration, /placeholder_created/);
  assert.match(migration, /awaiting_regeneration/);
  assert.match(migration, /generation_mode IN \('single', 'series_setup', 'series_episode', 'series_reference'\)/);
  assert.match(migration, /begin_thirty_days_series_reference_regeneration/);
  assert.match(migration, /v_cost := v_tier\.reference_cost_credits/);
  assert.match(migration, /commit_thirty_days_series_reference_regeneration/);
  assert.match(migration, /v_asset\.status <> 'succeeded'/);
  assert.match(migration, /'entity:' \|\| \(ref->>'entityId'\) \|\| ':v'/);
  assert.match(migration, /SET reference_library = v_merged_references,[\s\S]*entity_registry = v_entities/);
  assert.match(migration, /SERIES_REFERENCE_BUSY/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.remove_thirty_days_series_reference/);
  assert.doesNotMatch(migration, /credit_balance\s*=\s*credit_balance\s*\+/);

  assert.match(api, /removeSeriesReference/);
  assert.match(api, /beginSeriesReferenceRegeneration/);
  assert.match(api, /commitSeriesReferenceRegeneration/);
  assert.match(hook, /regenerateSeriesReference/);
  assert.match(hook, /generationMode === "series_reference"|series_reference/);
  assert.match(page, /deletePersistentReference/);
  assert.match(page, /regeneratePersistentReference/);
  assert.match(sidebar, /Trash2/);
  assert.match(sidebar, /awaiting_regeneration/);
  assert.match(sidebar, /\? "Generating" : "Generate"/);
  assert.doesNotMatch(sidebar, /displayedReferences\.slice\(0, 6\)/);
  assert.match(modal, /Credits will not be refunded/);
  assert.match(modal, /Finished episodes will stay unchanged/);
  assert.match(modal, /border-lime-300/);
});

test("persistent Series reference edits use the displayed image as one source and replace only after success", () => {
  const migration = read("supabase/migrations/20260831110000_thirty_days_series_reference_image_edits.sql");
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  const seriesApi = read("src/components/viral-tools/thirty-days/api/thirtyDaysSeriesApi.js");
  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  const sidebar = read("src/components/viral-tools/thirty-days/ThirtyDaysSeriesSidebar.jsx");

  assert.match(migration, /begin_thirty_days_series_reference_edit/);
  assert.match(migration, /v_cost := v_tier\.reference_cost_credits/);
  assert.match(migration, /sourceImageUrl/);
  assert.match(migration, /INVALID_EDIT_INSTRUCTION/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.begin_thirty_days_series_reference_edit/);
  assert.match(api, /buildReferenceEditPrompt/);
  assert.match(api, /initImageUrls: \[reference\.imageUrl\]/);
  assert.match(api, /refImages: \[reference\.imageUrl\]/);
  assert.match(api, /Return one clean edited image/);
  assert.match(seriesApi, /beginSeriesReferenceEdit/);
  assert.match(hook, /editSeriesReference/);
  assert.match(sidebar, /Edit this reference/);
  assert.match(sidebar, /original stays saved/);
  assert.match(sidebar, /<span>Edit<\/span>/);
});

test("persistent Series reference edits retain a selectable original-to-edit history", () => {
  const migration = read("supabase/migrations/20260831120000_thirty_days_series_reference_edit_history.sql");
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysSeriesApi.js");
  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  const page = read("src/pages/workspace/ThirtyDays.jsx");
  const sidebar = read("src/components/viral-tools/thirty-days/ThirtyDaysSeriesSidebar.jsx");

  assert.match(migration, /commit_thirty_days_series_reference_edit/);
  assert.match(migration, /select_thirty_days_series_reference_image/);
  assert.match(migration, /imageHistory/);
  assert.match(migration, /original:/);
  assert.match(migration, /edit:/);
  assert.match(migration, /REFERENCE_IMAGE_VERSION_NOT_FOUND/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.select_thirty_days_series_reference_image/);
  assert.match(api, /commitSeriesReferenceEdit/);
  assert.match(api, /selectSeriesReferenceImage/);
  assert.match(hook, /commitSeriesReferenceEdit/);
  assert.match(page, /selectPersistentReferenceImage/);
  assert.match(sidebar, /Reference image versions/);
  assert.match(sidebar, /selectedImageId/);
  assert.match(sidebar, /backdrop-blur-2xl/);
  assert.match(sidebar, /◈ \{credits\}/);
});

test("Series narration rejects internal statuses and generates episode-specific hooks", () => {
  const script = read("supabase/functions/thirty-days-script/index.ts");
  const voiceStep = read("src/components/viral-tools/thirty-days/ThirtyDaysVoiceStep.jsx");
  assert.match(script, /INTERNAL_NARRATION_TOKEN/);
  assert.match(script, /hook must be under 12 words and still express a concrete conflict/);
  assert.match(script, /hook must not begin with "What if"/);
  assert.match(script, /hook duplicates an earlier episode hook/);
  assert.match(script, /SERIES_BANNED_PHRASE/);
  assert.match(script, /SERIES_RESOLUTION/);
  assert.doesNotMatch(script, /function freshFallbackTake/);
  assert.doesNotMatch(script, /function clipSized/);
  assert.match(voiceStep, /hasInternalStatus/);
  assert.match(voiceStep, /savedNarrationText/);
  assert.match(voiceStep, /!hasInternalStatus\(savedNarrationText\)/);
  assert.match(voiceStep, /!hasInternalStatus\(generation\?\.narrationScript\)/);
  assert.match(voiceStep, /generation\?\.narrationScript \|\| ""/);
});

test("two-day episodes earn a balanced calendar transition instead of cutting Day 2 off", () => {
  const planner = read("supabase/functions/thirty-days-series-episode-planner/index.ts");
  const script = read("supabase/functions/thirty-days-script/index.ts");
  assert.match(planner, /CALENDAR CONTINUITY \(hard requirement/);
  assert.match(planner, /first Day \$\{endDay\} scene must be Scene 4 or Scene 5/);
  assert.match(planner, /validateCalendarContinuity/);
  assert.match(planner, /EPISODE_DAY_TRANSITION_UNBALANCED/);
  assert.match(planner, /DAY_TRANSITION_UNMOTIVATED/);
  assert.match(planner, /DAY_TRANSITION_PATTERN/);
  assert.match(script, /day_split_after_scene/);
  assert.match(script, /enum: \[3, 4\]/);
  assert.match(script, /beginsWithDayCue/);
  assert.match(script, /the first scene after the split must open with a spoken Day/);
});

test("Series episode selection and narration persistence are keyed to the episode record", () => {
  const page = read("src/pages/workspace/ThirtyDays.jsx");
  const voice = read("src/components/viral-tools/thirty-days/ThirtyDaysVoiceStep.jsx");
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  const migration = read("supabase/migrations/20260903191905_persist_series_episode_narration.sql");
  assert.match(page, /key=\{activeEpisode\?\.id \|\| job\.generation\?\.id\}/);
  assert.match(page, /job\.generation\?\.id === activeEpisode\.generationId/);
  assert.match(page, /setAutoDraftEpisodeId\(null\); job\.cancel\(\)/);
  assert.match(voice, /Narration not generated yet/);
  assert.match(api, /save_thirty_days_narration_draft/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /cliffhanger_thread/);
  assert.match(migration, /day_split_after_scene/);
});

test("new episode planning never labels the result panel with the previous episode", () => {
  const page = read("src/pages/workspace/ThirtyDays.jsx");
  const results = read("src/components/viral-tools/thirty-days/ThirtyDaysSeriesResults.jsx");
  assert.match(page, /setFocusedEpisodeId\(null\); job\.cancel\(\)/);
  assert.match(page, /setFocusedEpisodeId\(created\.episode\.id\)/);
  assert.match(results, /const awaitingNewEpisode = planning && !focusedEpisodeId/);
  assert.match(results, /const selected = awaitingNewEpisode\s*\? null/);
  assert.match(results, /selected \? `\$\{formatEpisodeRange\(selected\.startDay, selected\.endDay\)\} · \$\{selected\.title\}` : next\.label/);
});

test("an episode's first scene is visually anchored to the previous episode's actual last frame, not just text continuity", () => {
  const api = read("src/components/viral-tools/thirty-days/api/thirtyDaysApi.js");
  const seriesApi = read("src/components/viral-tools/thirty-days/api/thirtyDaysSeriesApi.js");
  const hook = read("src/components/viral-tools/thirty-days/hooks/useThirtyDaysJob.js");
  const background = read("supabase/functions/thirty-days-generation-advance/index.ts");
  // Both api layers expose the same lookup: the previous completed episode's
  // final scene image, keyed off the CURRENT episode's own row id (never an
  // episode number the caller would have to track separately).
  assert.match(seriesApi, /export async function getPreviousEpisodeEndingImage\(seriesId, currentSeriesEpisodeId\)/);
  assert.match(background, /async function getPreviousEpisodeEndingImage\(admin: any, seriesId: string, currentSeriesEpisodeId: string \| null\)/);
  // Episode 1 (or no previous completed episode yet) must never fabricate an anchor.
  assert.match(seriesApi, /if \(!seriesId \|\| !currentSeriesEpisodeId\) return null/);
  assert.match(seriesApi, /if \(episodeNumber <= 1\) return null/);
  // The image prompt explains what the extra reference is FOR (continuity of
  // physical state), and explicitly not identity — the collage/identity refs
  // stay authoritative for who's who.
  for (const source of [api, background]) {
    assert.match(source, /PREVIOUS EPISODE'S EXACT ENDING/);
    assert.match(source, /do not reset to a fresh establishing shot/);
    assert.match(source, /never for character identity/);
  }
  // Only scene 0 of a series episode ever receives it — never single-video
  // generations, never later scenes within the same episode.
  assert.match(api, /previousEpisodeEndingImageUrl && Number\(scene\.index\) === 0/);
  assert.match(background, /previousEpisodeEndingImageUrl && Number\(scene\.index\) === 0/);
  assert.match(hook, /initialGeneration\.generationMode === "series_episode"\s*\n\s*\? await getPreviousEpisodeEndingImage/);
});
