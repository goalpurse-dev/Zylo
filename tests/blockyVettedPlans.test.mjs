// Vetted story plans (decision 68): plans the owner writes by hand for the idea
// feature, in a plain "key: value" text format. Each block goes through the
// same checks as a plan the model writes, so it drops straight in or is told
// which line to fix.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_PLAN_SCENES, STORY_TYPE_IDS, parsePlanFile, readPlanFile, slugOf, vettedPlanFrom } from "../supabase/functions/_shared/blocky/vettedPlans.js";
import { TWIST_PATTERN_IDS, validateTwistPlan } from "../supabase/functions/_shared/blocky/twists.js";

const GOOD = `# A comment line is skipped.
title: The Admin Who Wasn't
hook: A fake admin picks on the one player he shouldn't.
type: abusive_admin
A: a player faking admin powers
B: the quiet owner of the game
premise: What happens if a player fakes admin powers to scare a quiet newcomer?
pattern: quiet_power
mechanic: owner_power
stakes: B's place on the server
clue: scene 2: while saying sorry, B turns a small gold key over in one hand
payoff: scene 5: B holds the gold key up and A, floating helplessly, drops
consequence: A is kicked from the server he pretended to run
winner: B
last line: Cute commands. Want to see real ones?
`;
const one = (text) => readPlanFile(text).report[0];
const swap = (from, to) => GOOD.replace(from, to);

test("the format: one plan per block, 'key: value' lines, characters A, B and C", () => {
  const { plans, report } = readPlanFile(GOOD);
  assert.deepEqual(report.map((r) => [r.line, r.ok, r.problems]), [[2, true, []]]);
  assert.deepEqual(plans[0], {
    slug: "the-admin-who-wasn-t", title: "The Admin Who Wasn't", hook: "A fake admin picks on the one player he shouldn't.", type: "abusive_admin",
    slots: { A: "a player faking admin powers", B: "the quiet owner of the game" }, sceneCount: 6,
    twist: "B holds the gold key up and A, floating helplessly, drops. A is kicked from the server he pretended to run",
    premise: "What happens if a player fakes admin powers to scare a quiet newcomer?", seenAs: "", emotion: "satisfaction", assumed: "", stakes: "B's place on the server",
    patternId: "quiet_power", mechanic: "owner_power", clue: "while saying sorry, B turns a small gold key over in one hand", clueScene: 2,
    payoff: "B holds the gold key up and A, floating helplessly, drops", revealScene: 5, consequence: "A is kicked from the server he pretended to run", winner: "B", finalLine: "Cute commands. Want to see real ones?",
  });
  assert.equal(DEFAULT_PLAN_SCENES, 6);
  assert.equal(STORY_TYPE_IDS.length, 10, "the ten story types of the scope");
  assert.equal(slugOf("  The Admin Who Wasn't! "), "the-admin-who-wasn-t");
  // The optional lines.
  const full = one(`${GOOD}C: a player watching\ntwist: B owns the game and has been letting the fake commands work.\nseen as: \nviewer assumes: A is an admin and B is about to be banned.\nfeeling: shock\nscenes: 8\n`.replace("payoff: scene 5", "payoff: scene 6"));
  assert.deepEqual(full.problems, []);
  assert.deepEqual([full.plan.slots.C, full.plan.twist, full.plan.emotion, full.plan.sceneCount, full.plan.assumed], ["a player watching", "B owns the game and has been letting the fake commands work.", "shock", 8, "A is an admin and B is about to be banned."]);
  // Two plans in one file; the keys are not case-sensitive.
  const two = readPlanFile(`${GOOD}\n\n${GOOD.replace("title: The Admin Who Wasn't", "TITLE: The Quiet Key").replace("last line:", "Last Line:")}`);
  assert.deepEqual(two.report.map((r) => [r.line, r.ok]), [[2, true], [19, true]]);
  assert.deepEqual(two.plans.map((p) => p.slug), ["the-admin-who-wasn-t", "the-quiet-key"]);
});

test("a hand-written plan may use what the example plans use; a model-written one may not", () => {
  const cast = [{ id: "vex", name: "Vex", tag: "Admin" }, { id: "noob", name: "Noob", tag: "New player" }];
  const plan = { premise: "What happens if a player fakes admin powers to scare a quiet newcomer?", seenAs: "", emotion: "satisfaction", roles: [], assumed: "Vex is an admin and Noob is about to be banned.", stakes: "Noob's place", patternId: "quiet_power", twist: "Noob owns the game and has been letting the fake commands work.", mechanic: "owner_power", clue: "While saying sorry, Noob turns a small gold key over in one hand.", clueScene: 2, payoff: "Noob holds the gold key up and Vex, floating helplessly, drops.", revealScene: 3, consequence: "Vex is kicked from the place he pretended to run.", winnerId: "noob", finalLine: "Cute commands. Want to see real ones?", title: "The Admin Who Wasn't" };
  const written = validateTwistPlan(plan, { cast, sceneCount: 4 });
  assert.deepEqual(written.errors, ['the plan uses "gold key", which belongs to one of the example plans; plant something of this story\'s own']);
  assert.deepEqual(written.fatal, [], "it counts against a plan; it does not end a story");
  assert.deepEqual(validateTwistPlan(plan, { cast, sceneCount: 4, generated: false }).errors, []);
  for (const borrowed of ["a pale ring worn around the head", "a painted rock", "the scammer's gem bag", "a golden key"]) assert.equal(validateTwistPlan({ ...plan, clue: `Noob is seen with ${borrowed} in one hand.`, payoff: "Noob holds it up and Vex, floating helplessly, drops." }, { cast, sceneCount: 4 }).errors.length, 1, borrowed);
});

test("each block is told exactly what to fix, by the same checks a model-written plan gets", () => {
  const problem = (text, re) => { const r = one(text); assert.equal(r.ok, false); assert.ok(r.problems.some((p) => re.test(p)), `${re} not in: ${r.problems.join(" | ")}`); };
  problem(swap("stakes: B's place on the server\n", ""), /"stakes" is missing/);
  problem(swap("type: abusive_admin", "type: funny"), /"type" must be one of: forbidden_power, glitch, scheme, countdown, abusive_admin/);
  problem(swap("pattern: quiet_power", "pattern: surprise"), new RegExp(`"pattern" must be one of: ${TWIST_PATTERN_IDS.slice(0, 3).join(", ")}`));
  problem(swap("mechanic: owner_power", "mechanic: magic"), /"mechanic" must be one of: owner_power, admin_power/);
  problem(swap("winner: B", "winner: C"), /"winner" must be A or B \(got "C"\)/);
  problem(swap("clue: scene 2: while", "clue: while"), /"clue" starts with its scene: "scene 2: what is seen or heard"/);
  problem(swap("clue: scene 2:", "clue: scene 3:"), /"clue" scene: 1 or 2/);
  problem(swap("payoff: scene 5:", "payoff: scene 6:"), /"payoff" scene: scene 4 to 5 \(the second half, and never the last scene/);
  problem(swap("payoff: scene 5: B holds the gold key up and A, floating helplessly, drops", "payoff: scene 5: A finally admits he was never an admin"), /"payoff": ".*" is someone owning up or explaining/);
  problem(swap("payoff: scene 5: B holds", "payoff: scene 5: The sign beside B glows as B holds"), /"payoff": it says "sign"; nothing is written or read on screen/);
  problem(swap("last line: Cute commands. Want to see real ones?", "last line: Guess you were never the admin here."), /"last line": it starts with "Guess"/);
  problem(swap("last line: Cute commands. Want to see real ones?", "last line: Those were cute commands, do you want to see real ones?"), /"last line": the winner's last line, 8 words or fewer \(got 11\)/);
  problem(swap("premise: What happens if", "premise: A story where"), /"premise": one sentence that starts "What happens if"/);
  problem(swap("hook: A fake admin picks on the one player he shouldn't.", "hook: Fake admin."), /"hook" is one line of 4 to 18 words \(got 2\)/);
  problem(`${GOOD}colour: red\n`, /line 16: "colour: red" is not a "key: value" line this format knows/);
  problem(`${GOOD}winner: A\n`, /line 16: "winner" is there twice/);
  problem(swap("title: The Admin Who Wasn't", "title: Just Like Roblox"), /don't name/);
  // The same title twice in one file: the second is refused, the first is kept.
  const twice = readPlanFile(`${GOOD}\n${GOOD}`);
  assert.deepEqual(twice.report.map((r) => r.ok), [true, false]);
  assert.match(twice.report[1].problems[0], /the same title as the plan on line 2/);
  assert.equal(twice.plans.length, 1);
  // A block is found where it starts, whatever came before it.
  assert.deepEqual(parsePlanFile("\n\n# notes\n\ntitle: X\nhook: Y\n").map((b) => b.line), [5]);
});

test("the importer checks a file and writes nothing unless asked, and the SQL for its table waits for the owner", () => {
  const script = fs.readFileSync(new URL("../scripts/blocky/importPlans.mjs", import.meta.url), "utf8");
  assert.match(script, /process\.argv\.includes\("--write"\)/);
  assert.match(script, /readPlanFile\(/);
  const sql = fs.readFileSync(new URL("../supabase/pending/20261027100000_blocky_story_options.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE public\.blocky_plans/);
  assert.match(sql, /CREATE TABLE public\.blocky_drafts/);
  assert.match(sql, /CREATE POLICY blocky_drafts_select_own ON public\.blocky_drafts FOR SELECT TO authenticated USING \(\(user_id = auth\.uid\(\)\)\)/);
  assert.doesNotMatch(sql, /fruit_/i, "Blocky's own tables only");
  assert.ok(!fs.existsSync(new URL("../supabase/migrations/20261027100000_blocky_story_options.sql", import.meta.url)), "not applied: it is in supabase/pending/ until the owner says go");
});
