// AI Fruit Story v2 series (stage 3g): outline planner and episode prompts, offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSeriesPrompt, runSeriesPlanner, seriesSchema, validateSeriesOutline } from "../supabase/functions/_shared/fruit/series.js";
import { buildPlannerPrompt, validatePlan } from "../supabase/functions/_shared/fruit/planner.js";
import { episodeStatuses } from "../supabase/functions/_shared/fruit/storyState.js";

const LIB = new Map(JSON.parse(fs.readFileSync(new URL("../data/fruit-characters/library.json", import.meta.url), "utf8")).map((c) => [c.id, c]));
const cast = ["gloria", "rick", "bella", "linda"].map((id) => LIB.get(id));
const input = { concept: "An office where the receptionist knows everyone's secrets and sells them.", cast, opener: "Caught at the office", tone: "Petty and sarcastic", episodeCount: 3 };

const ep = (n, who) => ({ title: `Episode ${n} Trouble`, summary: `${who} discovers the glass office hides more than one secret, and the whole floor starts picking sides before lunch.`, cliffhanger: `${who} opens the door and freezes at who is inside.` });
const good = {
  title: "Glass Walls",
  logline: "A receptionist with nineteen years of office secrets starts selling them, and the boss is her first customer.",
  bible: "Gloria Grape is the receptionist who has seen everything for nineteen years. Rick Crisp is the married boss hiding an affair. Bella Berry is the new assistant caught in the middle. Linda Lemon runs HR and wants Gloria gone. Gloria's secret notebook drives every episode.",
  locations: [
    { id: "s1", description: "The glass-walled corner office with a big desk and the city skyline behind it" },
    { id: "s2", description: "The front reception desk with a ringing phone, a candy bowl and a visitor log" },
  ],
  characters: [
    { id: "gloria", role: "the receptionist who knows everything", prop: "a pink notebook", catchphrase: "Nineteen years, honey." },
    { id: "rick", role: "the boss hiding an affair", prop: "a second phone", catchphrase: "Let's circle back." },
    { id: "bella", role: "the new assistant caught between", prop: "a coffee tray", catchphrase: "I just started here!" },
    { id: "linda", role: "HR, out to get Gloria", prop: "a red clipboard", catchphrase: "Noted." },
  ],
  setups: [{ clue: "Rick's second phone buzzes in his desk drawer during the meeting", plantedIn: 1, paidOffIn: 3 }],
  episodes: [ep(1, "Gloria"), ep(2, "Rick and Bella"), ep(3, "Linda")],
};

test("series prompt: cast, the user's idea fenced as data, opener, tone and episode count", () => {
  const { system, user } = buildSeriesPrompt(input);
  assert.match(system, /Roles never change between episodes/);
  assert.match(user, /- gloria: Gloria Grape, the grape woman/);
  assert.match(user, /<<<\nAn office where/);
  assert.match(user, /EPISODE 1 OPENS ON: Caught at the office/);
  assert.match(user, /Write exactly 3 episodes\./);
  assert.deepEqual(seriesSchema().required, ["title", "logline", "bible", "locations", "characters", "setups", "episodes"]);
  assert.ok(user.includes("Wears (fixed): a leopard-print cardigan"));
});

test("outline validation: counts, lengths, every cast member has a role and appears", () => {
  assert.deepEqual(validateSeriesOutline(good, input).errors, []);
  const noLinda = { ...good, bible: good.bible.replace("Linda Lemon runs HR and wants Gloria gone.", "HR is watching."), episodes: [ep(1, "Gloria"), ep(2, "Rick"), ep(3, "Bella")] };
  const errs = validateSeriesOutline(noLinda, input).errors.join("\n");
  assert.match(errs, /bible must give every cast member a fixed role \(missing: Linda Lemon\)/);
  assert.match(errs, /every cast member must appear in at least one episode \(missing: Linda Lemon\)/);
  assert.match(validateSeriesOutline({ ...good, episodes: good.episodes.slice(0, 2) }, input).errors.join(), /exactly 3 episodes/);
});

test("series planner: one repair with the exact problems, then success", async () => {
  const calls = [];
  const llm = async (req) => { calls.push(req); return { data: calls.length === 1 ? { ...good, episodes: good.episodes.slice(0, 2) } : good }; };
  const { outline, attempts } = await runSeriesPlanner({ ...input, llm });
  assert.equal(attempts, 2);
  assert.match(calls[1].user, /IT HAS THESE PROBLEMS[\s\S]*exactly 3 episodes/);
  assert.deepEqual(outline.episodes.map((e) => e.number), [1, 2, 3]);
});

test("episode prompt: bible, earlier episodes, pick up the last cliffhanger, land this one", () => {
  const series = { title: good.title, logline: good.logline, bible: good.bible, previous: [{ number: 1, ...good.episodes[0] }], episode: { number: 2, ...good.episodes[1] } };
  const { user } = buildPlannerPrompt({ source: "episode", cast, lengthSec: 15, quality: "v2", series });
  assert.match(user, /SERIES BIBLE \(roles and relationships are fixed\):\nGloria Grape is the receptionist/);
  assert.match(user, /PREVIOUS EPISODES:\nEp 1 "Episode 1 Trouble"/);
  assert.match(user, /Scene 1 must pick up directly from the last cliffhanger: Gloria opens the door/);
  assert.match(user, /The last scene must deliver this episode's cliffhanger: Rick and Bella opens the door/);
  assert.match(user, /not every series character has to appear/);
});

test("an episode doesn't need every series character; a single story does", () => {
  const out = {
    title: "The Glass Door", locations: [{ id: "loc1", description: "A glass-walled corner office with a desk, city skyline behind the windows", timeOfDay: "late afternoon", lighting: "warm golden sunlight through the glass" }],
    scenes: [
      { speakerId: "gloria", line: "Nineteen years at that desk, and nobody ever locks this door.", presentIds: ["gloria", "rick"], locationId: "loc1", action: "leans on the doorframe", emotion: "smug", shot: "medium close-up", placement: "", beat: "Caught" },
      { speakerId: "rick", line: "Gloria, whatever you think you saw, you didn't see it.", presentIds: ["rick", "gloria"], locationId: "loc1", action: "straightens his tie", emotion: "panicked", shot: "close-up", placement: "", beat: "Denial" },
      { speakerId: "gloria", line: "Then you won't mind me telling Linda about it, Rick.", presentIds: ["gloria", "rick"], locationId: "loc1", action: "taps her phone", emotion: "gleeful", shot: "medium close-up", placement: "", beat: "Threat" },
    ],
  };
  const ctx = { cast, sceneCount: 3, quality: "v2", lengthSec: 15 };
  assert.ok(!validatePlan(out, { ...ctx, source: "episode" }).errors.some((e) => /cast member/.test(e)));
  assert.ok(validatePlan(out, { ...ctx, source: "prompt" }).errors.some((e) => /cast member bella must appear/.test(e)));
});

test("episodes unlock in order: made, then exactly one next", () => {
  const eps = [{ number: 1, story_id: "s1" }, { number: 2, story_id: "s2" }, { number: 3 }].map((e) => ({ title: "", summary: "", cliffhanger: "", ...e }));
  const st = episodeStatuses(eps, new Map([["s1", "final_ready"], ["s2", "pictures_ready"]]));
  assert.deepEqual(st.map((e) => e.status), ["made", "next", "locked"]);
  assert.equal(st[1].storyId, "s2");
});

test("series bible: locations s1.., a role + prop + catchphrase per character, setups planted before they pay off", async () => {
  const { setupsFor } = await import("../supabase/functions/_shared/fruit/series.js");
  const { outline } = validateSeriesOutline(good, input);
  assert.deepEqual(outline.locations.map((l) => l.id), ["s1", "s2"]);
  assert.equal(outline.characters.find((c) => c.id === "rick").prop, "a second phone");
  assert.deepEqual(setupsFor(outline.setups, 1), { plant: ["Rick's second phone buzzes in his desk drawer during the meeting"], payOff: [] });
  assert.deepEqual(setupsFor(outline.setups, 3).payOff.length, 1);
  const bad = validateSeriesOutline({ ...good, locations: [{ id: "x", description: "a room" }], characters: good.characters.slice(0, 3), setups: [{ clue: "the phone buzzes in the drawer again", plantedIn: 3, paidOffIn: 2 }] }, input).errors.join(" | ");
  assert.match(bad, /use 2 to 5 series locations/);
  assert.match(bad, /location ids must be s1, s2, s3/);
  assert.match(bad, /characters: give linda a role, prop and catchphrase/);
  assert.match(bad, /plantedIn must be an earlier episode than paidOffIn/);
});

test("episode prompt carries the series bible: locations to reuse, props + catchphrases, clues due, where the last episode ended", () => {
  const series = {
    title: good.title, logline: good.logline, bible: good.bible, previous: [{ number: 1, ...good.episodes[0] }], episode: { number: 2, ...good.episodes[1] },
    locations: good.locations, characters: good.characters, setups: { plant: [], payOff: ["the second phone buzzes in the drawer"] },
    lastEnd: { characters: [{ id: "gloria", where: "at the office door", feeling: "smug" }, { id: "rick", where: "behind his desk", feeling: "panicked" }], props: ["the second phone"] },
  };
  const { user } = buildPlannerPrompt({ source: "episode", cast, lengthSec: 15, quality: "v2", series });
  assert.ok(user.includes("SERIES LOCATIONS"));
  assert.ok(user.includes("- s1: The glass-walled corner office"));
  assert.ok(user.includes('- rick: the boss hiding an affair; prop: a second phone; catchphrase: "Let\'s circle back."'));
  assert.ok(user.includes("PAY OFF THIS CLUE in this episode (it was planted earlier): the second phone buzzes in the drawer"));
  assert.ok(user.includes("WHERE THE LAST EPISODE ENDED (scene 1 continues from exactly here): gloria: at the office door, smug; rick: behind his desk, panicked. Props in play: the second phone."));
});

test("an episode's locations must point at series locations (or be new); endState is returned for the next episode", () => {
  const loc = { id: "loc1", description: "A glass-walled corner office with a desk, city skyline behind the windows", timeOfDay: "late afternoon", lighting: "warm golden sunlight through the glass" };
  const scenes = [
    { speakerId: "gloria", line: "Nineteen years at that desk, and nobody knocks first.", presentIds: ["gloria", "rick"], locationId: "loc1", action: "leans on the doorframe", emotion: "smug", shot: "chest-up", placement: "", beat: "Caught" },
    { speakerId: "rick", line: "Gloria, whatever you think you saw, you didn't.", presentIds: ["rick", "gloria"], locationId: "loc1", action: "straightens his tie", emotion: "panicked", shot: "close-up", placement: "", beat: "Denial" },
    { speakerId: "gloria", line: "Then you won't mind me telling Linda, Rick.", presentIds: ["gloria", "rick"], locationId: "loc1", action: "taps her phone", emotion: "gleeful", shot: "chest-up", placement: "", beat: "Threat" },
  ];
  const roles = [{ id: "gloria", role: "the receptionist" }, { id: "rick", role: "the boss" }];
  const endState = { characters: [{ id: "gloria", where: "in the office doorway", feeling: "gleeful" }], props: ["her phone"] };
  const ctx = { cast, sceneCount: 3, quality: "v2", lengthSec: 15, source: "episode", seriesLocationIds: ["s1", "s2"] };
  const ok = validatePlan({ title: "The Door", locations: [{ ...loc, seriesLocationId: "s1" }], roles, scenes, endState }, ctx);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.plan.locations[0].seriesLocationId, "s1");
  assert.deepEqual(ok.plan.endState, endState);
  const bad = validatePlan({ title: "The Door", locations: [{ ...loc, seriesLocationId: "s9" }], roles, scenes, endState }, ctx);
  assert.match(bad.errors.join(" | "), /seriesLocationId must be one of s1, s2 or ""/);
});
