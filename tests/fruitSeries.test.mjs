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
  episodes: [ep(1, "Gloria"), ep(2, "Rick and Bella"), ep(3, "Linda")],
};

test("series prompt: cast, the user's idea fenced as data, opener, tone and episode count", () => {
  const { system, user } = buildSeriesPrompt(input);
  assert.match(system, /Roles never change between episodes/);
  assert.match(user, /- gloria: Gloria Grape, the grape woman/);
  assert.match(user, /<<<\nAn office where/);
  assert.match(user, /EPISODE 1 OPENS ON: Caught at the office/);
  assert.match(user, /Write exactly 3 episodes\./);
  assert.deepEqual(seriesSchema().required, ["title", "logline", "bible", "episodes"]);
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
