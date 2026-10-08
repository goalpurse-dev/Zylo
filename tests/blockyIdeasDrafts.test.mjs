// Section 3 as one flow (decision 68): five idea cards → three versions of the
// story, shown as each is ready → the user picks one → only that one is
// polished → pictures. Vetted plans come first, with two generated alternates.
// Free for the user, with a daily limit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DAILY_DRAFTS, DAILY_IDEA_BATCHES, IDEAS_PER_BATCH, IDEAS_SYSTEM, buildIdeasPrompt, castForSlots, ideaFromPlan, ideasSchema, typesForBatch, validateIdeas } from "../supabase/functions/_shared/blocky/ideas.js";
import { VERSION_STALE_MS, draftView, shouldWrite, vettedToTwistPlan, versionCard, withNames } from "../supabase/functions/_shared/blocky/drafts.js";
import { STORY_TYPE_IDS, readPlanFile } from "../supabase/functions/_shared/blocky/vettedPlans.js";
import { validateTwistPlan } from "../supabase/functions/_shared/blocky/twists.js";
import { planVersions, polishVersion, writeVersion } from "../supabase/functions/_shared/blocky/planner.js";
import { REVIEW_RULES } from "../supabase/functions/_shared/blocky/scriptReview.js";
import { SPEAKING_SHOTS } from "../supabase/functions/_shared/blocky/shots.js";
import { ROSTER } from "../scripts/blocky/roster.mjs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const library = ["vex", "noob", "lux"].map((id) => { const a = ROSTER.find((r) => r.id === id); return { id: a.id, name: a.name, tag: a.tag, role: a.role, look: a.look, voice_style: a.voice }; });
const cast = library.slice(0, 2);

test("ideas: five a batch from five different story types; the next batch takes the other five", () => {
  assert.equal(IDEAS_PER_BATCH, 5);
  const first = typesForBatch(0), second = typesForBatch(1);
  assert.equal(new Set(first).size, 5);
  assert.deepEqual([...first, ...second].sort(), [...STORY_TYPE_IDS].sort(), "two batches cover all ten types");
  assert.notDeepEqual(typesForBatch(2), first, "and after that the split moves on");
  for (const n of [0, 1, 2, 3, 7, 19]) assert.equal(new Set(typesForBatch(n)).size, 5);
  const p = buildIdeasPrompt({ library, types: first, avoidTitles: ["The Admin Who Wasn't"] });
  assert.equal(p.system, IDEAS_SYSTEM);
  assert.match(p.user, /- vex: Vex\. Admin: /);
  assert.match(p.user, /Write exactly 5 ideas, one for each of these story types, in this order:\n1\. forbidden_power: A forbidden power with a hidden cost/);
  assert.match(p.user, /This user has already seen or made these; write nothing like them:\n- The Admin Who Wasn't/);
  // The owner's three rules for ideas, and the usual ones.
  assert.match(IDEAS_SYSTEM, /Nothing a viewer would have to READ: no idea may depend on a number, a countdown display, a leaderboard/);
  assert.match(IDEAS_SYSTEM, /hook: ONE line of 8 to 16 words[^]*hints that something is not what it seems\. It never says what\./);
  assert.match(IDEAS_SYSTEM, /A character only does what their role allows\. Only an admin or the owner can ban/);
  assert.match(IDEAS_SYSTEM, /You do not write the twist\./);
  assert.doesNotMatch(IDEAS_SYSTEM, /fruit|Roblox/i);
  assert.deepEqual(ideasSchema().properties.ideas.items.required, ["type", "title", "hook", "summary", "castIds"]);
});

test("ideas in code: an idea that needs reading, gives its ending away or uses a stranger is left out", () => {
  const types = typesForBatch(0);
  const idea = (type, over = {}) => ({ type, title: "The Borrowed Crown", hook: "Lux lends Noob a crown, and now Lux wants far more than it back.", summary: "Lux lends Noob a gold crown for one race, then demands Noob's only pet as the price of keeping it.", castIds: ["lux", "noob"], ...over });
  const good = { ideas: types.map((t) => idea(t)) };
  const r = validateIdeas(good, { library, types, seed: 3 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.ideas.map((i) => i.id), types.map((t) => `idea:3:${t}`));
  assert.ok(r.ideas.every((i) => i.vetted === false && i.castIds.length === 2));
  const bad = { ideas: [
    idea(types[0], { hook: "Noob's name drops off the leaderboard and nobody will say why it happened." }),
    idea(types[1], { summary: "Vex bans Noob for nothing, but it turns out Noob was the owner of the whole place all along." }),
    idea(types[2], { castIds: ["noob", "taz"] }),
    idea(types[3], { title: "Just Like Roblox" }),
    idea(types[3]),
    idea(types[3]),
  ] };
  const b = validateIdeas(bad, { library, types });
  assert.equal(b.ideas.length, 1, "one good idea, and the second of the same type is refused");
  assert.match(b.errors.join(" | "), /idea 1: it depends on "leaderboard", which a viewer would have to read/);
  assert.match(b.errors.join(" | "), /idea 2: "turns out" gives the ending away; write the setup only/);
  assert.match(b.errors.join(" | "), /idea 3: castIds: 2 or 3 ids from the library/);
  assert.match(b.errors.join(" | "), /idea 4: .*don't name/);
  assert.match(b.errors.join(" | "), /idea 6: type must be one of/);
  assert.match(validateIdeas({ ideas: [] }, { library, types }).errors[0], /write exactly 5 ideas/);
});

const VETTED = readPlanFile(`title: The Admin Who Wasn't
hook: A fake admin picks on the one player he shouldn't.
type: abusive_admin
A: a player faking admin powers
B: the quiet owner of the game, a new player
premise: What happens if a player fakes admin powers to scare a quiet newcomer?
pattern: quiet_power
mechanic: owner_power
stakes: B's place on the server
clue: scene 2: while saying sorry, B turns a small gold key over in one hand
payoff: scene 5: B holds the gold key up and A, floating helplessly, drops
consequence: A is kicked from the server he pretended to run
winner: B
last line: Cute commands. Want to see real ones?
`).plans[0];

test("a vetted plan becomes an idea card without its twist, and a plan for the cast with the names in", () => {
  // The card: title, hook and the premise. Never the clue, the payoff or the last line.
  const row = { slug: VETTED.slug, title: VETTED.title, hook: VETTED.hook, story_type: VETTED.type, plan: VETTED };
  const card = ideaFromPlan(row, library);
  assert.deepEqual(card, { id: "plan:the-admin-who-wasn-t", type: "abusive_admin", title: "The Admin Who Wasn't", hook: "A fake admin picks on the one player he shouldn't.", summary: "What if a player fakes admin powers to scare a quiet newcomer?", castIds: ["vex", "noob"], vetted: true });
  assert.doesNotMatch(JSON.stringify(card), /gold key|kicked|Cute commands/);
  // Who plays A, B and C: the library character whose tag fits the role's words, else the next one free.
  assert.deepEqual(castForSlots({ A: "a greedy collector", B: "a new player", C: "the admin" }, library), ["lux", "noob", "vex"]);
  assert.deepEqual(castForSlots({ A: "someone", B: "someone else" }, library), ["vex", "noob"]);
  assert.equal(castForSlots({ A: "a", B: "b", C: "c" }, library.slice(0, 2)), null, "a library that is too small");
  // A, B and C become names; "A" as the first word of a sentence stays a word.
  const names = { A: "Vex", B: "Noob" };
  assert.equal(withNames("B holds the gold key up and A, floating helplessly, drops", names), "Noob holds the gold key up and Vex, floating helplessly, drops");
  assert.equal(withNames("A is kicked from the server he pretended to run", names), "Vex is kicked from the server he pretended to run");
  assert.equal(withNames("B's place on the server", names), "Noob's place on the server");
  assert.equal(withNames("A fake admin picks on the one player he shouldn't.", names), "A fake admin picks on the one player he shouldn't.");
  assert.equal(withNames("A small key glows while B watches A and C", { ...names, C: "Lux" }), "A small key glows while Noob watches Vex and Lux");
  // The plan for this cast at 30 seconds passes the same checks as a model-written plan.
  const plan = vettedToTwistPlan(VETTED, cast, 6);
  assert.deepEqual([plan.vetted, plan.winnerId, plan.clueScene, plan.revealScene, plan.finalLine], [true, "noob", 2, 5, "Cute commands. Want to see real ones?"]);
  assert.deepEqual(plan.roles, { vex: "a player faking admin powers", noob: "the quiet owner of the game, a new player" });
  assert.equal(plan.payoff, "Noob holds the gold key up and Vex, floating helplessly, drops");
  assert.deepEqual(validateTwistPlan({ ...plan, roles: Object.entries(plan.roles).map(([id, role]) => ({ id, role })), assumed: "Vex is an admin and Noob is about to be banned." }, { cast, sceneCount: 6, generated: false }).errors, []);
  // At 20 seconds (four scenes) the payoff moves into the one scene that length allows.
  assert.equal(vettedToTwistPlan(VETTED, cast, 4).revealScene, 3);
});

test("what the page is shown of a draft: the cards, never the plans behind them", () => {
  const row = { id: "d1", status: "writing", picked: null, story_id: null, versions: [
    { n: 2, status: "ready", vetted: false, title: "Two", hook: "Hook two", lengthSec: 27, plan: { twist: "SECRET" }, script: { scenes: [] }, lines: [{ speakerId: "vex", line: "Strike two.", extra: 1 }] },
    { n: 1, status: "writing", vetted: true, title: "One", hook: "Hook one", plan: { twist: "SECRET" }, startedAt: "2026-10-08T10:00:00Z" },
    { n: 3, status: "failed", vetted: false, title: "Three", hook: "Hook three", plan: {}, error: "PLANNER_FAILED" },
  ] };
  const view = draftView(row, 4);
  assert.deepEqual(view.versions.map((v) => [v.n, v.status, v.vetted]), [[1, "writing", true], [2, "ready", false], [3, "failed", false]]);
  assert.deepEqual(view.versions[1].lines, [{ speakerId: "vex", line: "Strike two." }]);
  assert.equal(view.left, 4);
  assert.doesNotMatch(JSON.stringify(view), /SECRET|script|startedAt|PLANNER_FAILED/);
  assert.match(view.versions[2].error, /We couldn't write this version/);
  assert.ok(!("left" in draftView(row)));
  assert.deepEqual(Object.keys(versionCard(row.versions[0])).sort(), ["hook", "lengthSec", "lines", "n", "status", "title", "vetted"]);
  // One call writes a version: a second one while it is being written does nothing; a stale one may start again.
  const now = Date.parse("2026-10-08T10:01:00Z");
  assert.equal(shouldWrite({ status: "writing" }, now), true);
  assert.equal(shouldWrite({ status: "writing", startedAt: "2026-10-08T10:00:30Z" }, now), false);
  assert.equal(shouldWrite({ status: "writing", startedAt: new Date(now - VERSION_STALE_MS - 1).toISOString() }, now), true);
  assert.equal(shouldWrite({ status: "ready" }, now), false);
  assert.equal(shouldWrite(undefined, now), false);
});

/* The three stages, with a fake plan model, writer, judge and editor. */
const plan = (over = {}) => ({ roles: [{ id: "vex", role: "a player faking admin powers" }, { id: "noob", role: "the quiet owner of the game" }], assumed: "Vex is an admin and Noob is about to be banned.", stakes: "Noob's place on the server", patternId: "quiet_power", twist: "Noob owns the game and has been letting the fake commands work.", mechanic: "owner_power", clue: "While saying sorry, Noob turns a small silver whistle over in one hand.", clueScene: 2, payoff: "Noob holds the silver whistle up and Vex, floating helplessly, drops.", revealScene: 3, consequence: "Vex is kicked from the place he pretended to run.", winnerId: "noob", finalLine: "Cute commands. Want to see real ones?", title: "The Admin Who Wasn't", hook: "A fake admin picks on the one player he shouldn't.", ...over });
const three = { premise: "What happens if a player fakes admin powers to scare a quiet newcomer?", seenAs: "", emotion: "satisfaction", plans: [plan(), plan({ patternId: "backfire", title: "The Ban That Bounced", finalLine: "You said it first.", hook: "A ban is about to land on the wrong player." }), plan({ patternId: "test", title: "The Quiet Test", finalLine: "Welcome to nothing.", hook: "Someone here is being tested, and it isn't who you think." })] };
const scene = (speakerId, line, action = "points one block arm straight ahead") => ({ speakerId, line, presentIds: ["vex", "noob"], locationId: "loc1", action, emotion: "icy calm", shot: SPEAKING_SHOTS[0], placement: "", beat: "The fake ban", raises: "it gets worse" });
const script = (last = "Cute commands. Want to see real ones?") => ({ outfits: [], endState: { characters: [], props: [] }, locations: [{ id: "loc1", description: "A spawn plaza built from smooth plastic blocks with a round fountain and plain market stalls", timeOfDay: "midday", lighting: "bright even daylight", seriesLocationId: "" }], scenes: [scene("vex", "Break one more rule and you're banned. Forever."), scene("noob", "Okay. Sorry. I'll stay here.", "turns a small silver whistle over in one hand"), scene("vex", "Wait. Why am I floating? Put me down!", "floats, both arms flailing"), scene("noob", last)] });
const judge = (totals, best) => ({ best, why: "", scores: totals.map((t, i) => ({ plan: i + 1, cluePlanted: t, payoffUsesClue: t, stakes: t, flip: t, retell: t, noMagic: t, motive: t, note: "" })) });
const P = { source: "prompt", cast, lengthSec: 20, quality: "v2", prompt: "A fake admin bans the wrong player." };

test("stage 1: the plans the three cards are written from, best first by the judge", async () => {
  const log = [];
  const r = await planVersions({ ...P, llm: async (o) => { log.push(o.purpose); return { data: three, costUsd: 0.03 }; }, reviewLlm: async (o) => { log.push(o.purpose); return { data: judge([3, 5, 4], 2) }; } });
  assert.deepEqual(log, ["twist_plan", "plan_judge"], "one call for three plans, one for the judge; no script yet");
  assert.deepEqual(r.plans.map((p) => p.patternId), ["backfire", "test", "quiet_power"], "the judge's order");
  assert.deepEqual(r.plans.map((p) => p.hook), ["A ban is about to land on the wrong player.", "Someone here is being tested, and it isn't who you think.", "A fake admin picks on the one player he shouldn't."]);
  assert.deepEqual([r.judged.chosen, r.judged.order], [2, [1, 2, 0]]);
  assert.equal(r.calls.length, 1);
  // A plan the writer can't work from gets no card.
  const broken = { ...three, plans: [three.plans[0], plan({ winnerId: "taz", patternId: "backfire" }), three.plans[2]] };
  const two = await planVersions({ ...P, llm: async () => ({ data: broken }), reviewLlm: async () => ({ data: judge([4, 5, 3], 2) }) });
  assert.deepEqual(two.plans.map((p) => p.patternId), ["quiet_power", "test"]);
});

test("stage 2 writes a version without the editor; stage 3 polishes only the one that was picked", async () => {
  const twistPlan = (await planVersions({ ...P, llm: async () => ({ data: three }), reviewLlm: async () => ({ data: judge([5, 3, 3], 1) }) })).plans[0];
  // Stage 2: the draft and its repairs. The editor is never asked.
  const log = [];
  const weak = script("Only the owner can. That's me.");
  const w = await writeVersion({ ...P, llm: async (o) => { log.push(o.purpose); return { data: weak, costUsd: 0.02 }; }, reviewLlm: async () => { throw new Error("the editor must not run for a version nobody picked yet"); } }, twistPlan);
  assert.deepEqual(log, ["planner"]);
  assert.equal(w.plan.scenes[3].line, "Only the owner can. That's me.");
  assert.deepEqual(w.plan.scenes.map((s) => s.speakerId), ["vex", "noob", "vex", "noob"]);
  assert.equal(w.plan.title, "The Admin Who Wasn't");
  assert.deepEqual(w.data, weak, "the writer's own answer is kept for the polish");
  // Stage 3: from that kept answer, the editor's pass: what fails is rewritten as a patch and checked again.
  const pass = (failed) => Object.fromEntries(Object.keys(REVIEW_RULES).map((id) => [id, failed.includes(id) ? { pass: false, scene: 4, problem: `${id} fails`, fix: "fix it" } : { pass: true, scene: 0, problem: "", fix: "" }]));
  const verdicts = [["ending"], []];
  const plog = [];
  const p = await polishVersion({ ...P,
    llm: async (o) => { plog.push(o.purpose); return { data: { title: "", scenes: [{ scene: 4, speakerId: "", line: "Cute commands. Want to see real ones?", presentIds: [], action: "", placement: "", emotion: "" }] } }; },
    reviewLlm: async (o) => { plog.push(o.purpose); return { data: pass(verdicts.shift()) }; },
  }, twistPlan, w.data);
  assert.deepEqual(plog, ["script_review", "planner_rewrite", "script_review"], "no new draft: the stored one is checked, patched and checked again");
  assert.equal(p.plan.scenes[3].line, "Cute commands. Want to see real ones?");
  assert.deepEqual([p.review.ok, p.review.rewritten, p.review.rounds], [true, true, 1]);
  assert.equal(p.plan.clue, twistPlan.clue, "the story keeps its plan");
  // A stored script that is no longer usable is refused before anything is paid for.
  await assert.rejects(polishVersion({ ...P, llm: async () => { throw new Error("not reached"); }, reviewLlm: async () => ({ data: pass([]) }) }, twistPlan, { ...weak, scenes: weak.scenes.slice(0, 2) }), (e) => e.code === "PLANNER_FAILED" && /write exactly 4 scenes/.test(e.details.join(" ")));
});

test("the API: free with a daily limit, one writer per version, a pick that can't be made twice", () => {
  assert.deepEqual([DAILY_DRAFTS, DAILY_IDEA_BATCHES], [5, 20]);
  const api = read("supabase/functions/blocky-story-api/index.ts");
  for (const action of ["getIdeas", "startDraft", "writeVersion", "getDraft", "pickVersion"]) assert.match(api, new RegExp(`  async ${action}\\(ctx\\) \\{`), action);
  // The limits, counted from midnight UTC.
  assert.match(api, /if \(used >= DAILY_DRAFTS\) throw blockyError\("DAILY_LIMIT"/);
  assert.match(api, /if \(\(count \?\? 0\) >= DAILY_IDEA_BATCHES\) throw blockyError\("DAILY_LIMIT"/);
  assert.match(api, /const dayStart = \(\) => \{ const d = new Date\(\); d\.setUTCHours\(0, 0, 0, 0\); return d\.toISOString\(\); \};/);
  // Paid calls obey the switch and the daily cap like every other step.
  for (const action of ["getIdeas", "startDraft", "writeVersion", "pickVersion"]) {
    const body = api.slice(api.indexOf(`  async ${action}(ctx) {`), api.indexOf("\n  },", api.indexOf(`  async ${action}(ctx) {`)));
    assert.match(body, /await requirePaidCalls\(/, `${action} asks the paid switch`);
    assert.match(body, /requirePaid\(ctx\);/, `${action} needs a paid plan`);
  }
  // A vetted plan shows first, with two generated ones; otherwise the judge's best three.
  assert.match(api, /const chosen = vetted \? \[vetted, \.\.\.planned\.plans\.slice\(0, 2\)\] : planned\.plans\.slice\(0, 3\);/);
  // Versions are written through the one function that can't lose a version when three finish together.
  assert.match(api, /admin\.rpc\("blocky_set_draft_version", \{ p_draft_id: row\.id, p_version: v, p_cost_usd: costUsd, p_call_ids: callIds \}\)/);
  assert.match(api, /if \(row\.status === "picked" \|\| !shouldWrite\(version\)\) return draftView\(row\);/);
  // A pick made twice returns the story it already became; nothing is charged for a draft or a pick.
  assert.match(api, /if \(draft\.status === "picked" && draft\.story_id\) \{/);
  const pick = api.slice(api.indexOf("  async pickVersion(ctx) {"), api.indexOf("  async createStory(ctx) {"));
  assert.doesNotMatch(pick, /blocky_charge_step/);
  // What goes to the browser is always the card view.
  for (const action of ["startDraft", "writeVersion", "getDraft"]) assert.match(api.slice(api.indexOf(`  async ${action}(ctx) {`)), /return draftView\(row/);
});
