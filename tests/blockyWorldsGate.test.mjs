// Blocky Worlds: the custom-topic gate (owner, 2026-11-07). A typed topic's script must pass the library's AI judge at
// the library's bar (judged on the script) plus every check, or get up to two targeted rewrites; the recipe picker names
// which launch recipe a story would use. All free: fakes and the mock provider.
import test from "node:test";
import assert from "node:assert/strict";
import { gateTopicScript, judgeScript, moneyMeter, passesGate, topicScript, TOPIC_GATE, writeBeats } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { ACCEPT, judgeReasons, judgeScriptPrompt, RUBRIC, scoreVerdict } from "../supabase/functions/_shared/blockyWorlds/library.js";
import { pickRecipe, RECIPE_IDS } from "../supabase/functions/_shared/blockyWorlds/recipes.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../supabase/functions/_shared/blockyWorlds/examples.js";

const TOPIC = "we live inside a giant turtle and a big bad wolf with an army of soldiers is hunting it";
const verdictOf = (n, safe = true) => scoreVerdict({ scores: Object.fromEntries(RUBRIC.map((c) => [c.id, n])), safe, better: `make it a ${n}` });
const clean = { problems: [], warnings: [] };
const script = (tag) => ({ title: tag, lines: [{ part: "rule", text: `In this town, ${tag}.` }], post: {} });

test("the judge's bar is the library's: all 4s pass, all 3s don't", () => {
  assert.equal(verdictOf(4).accepted, true);
  assert.ok(verdictOf(4).score >= ACCEPT.minScore);
  assert.equal(verdictOf(3).accepted, false);
  assert.equal(verdictOf(5, false).accepted, false);
});

test("the script judge prompt: the script is what is scored, the user's premise is named", () => {
  const p = judgeScriptPrompt(EXAMPLE_SCRIPT, { ...EXAMPLE_IDEAS[0], topic: TOPIC });
  assert.match(p, /FINISHED SCRIPT/);
  assert.ok(p.includes(TOPIC));
  assert.ok(p.includes(EXAMPLE_SCRIPT.lines[0].text));
  assert.match(p, /IDEA 1\n\{/);
  assert.doesNotMatch(judgeScriptPrompt(EXAMPLE_SCRIPT, EXAMPLE_IDEAS[0]), /USER'S OWN PREMISE/);
});

test("judgeReasons: the score vs the bar, the weak criteria and the judge's note", () => {
  const v = scoreVerdict({ scores: { ...Object.fromEntries(RUBRIC.map((c) => [c.id, 4])), twist: 2 }, safe: true, better: "end the hunt" });
  const r = judgeReasons(v);
  assert.match(r[0], new RegExp(`/100; the bar is ${ACCEPT.minScore}`));
  assert.ok(r.some((x) => /^Weak twist \(2\/5\)/.test(x)));
  assert.ok(r.some((x) => /end the hunt/.test(x)));
});

test("the gate: a passing script is not rewritten", async () => {
  let writes = 0;
  const g = await gateTopicScript({ card: {}, lengthSec: 90, script: script("a"), check: clean, steps: { writeScript: async () => { writes++; }, judgeScript: async () => ({ verdict: verdictOf(4), costUsd: 0.01 }) } });
  assert.equal(g.passed, true);
  assert.equal(g.rewrites, 0);
  assert.equal(writes, 0);
  assert.equal(g.costUsd, 0.01);
});

test("the gate: below the bar -> a rewrite told the judge's reasons and the failed checks; the passing one is kept", async () => {
  const seen = [];
  const scores = [3, 4];
  const g = await gateTopicScript({
    card: { topic: TOPIC }, lengthSec: 90, script: script("first"), check: { problems: ["The story drifted from your idea: x"], warnings: [] },
    steps: {
      writeScript: async ({ failed, previous }) => { seen.push({ failed, previous }); return { script: script("second"), check: clean, costUsd: 0.03 }; },
      judgeScript: async () => ({ verdict: verdictOf(scores.shift()), costUsd: 0.02 }),
    },
  });
  assert.equal(g.rewrites, 1);
  assert.equal(g.passed, true);
  assert.equal(g.best.script.title, "second");
  assert.equal(seen[0].previous.title, "first");
  assert.ok(seen[0].failed.includes("The story drifted from your idea: x"));
  assert.ok(seen[0].failed.some((f) => /AI judge scored the script/.test(f)));
  assert.equal(g.costUsd, 0.07);
});

test("the gate: at most two rewrites, the best version kept and reported below the bar", async () => {
  const scores = [3, 2, 3];
  let n = 0;
  const g = await gateTopicScript({
    card: {}, lengthSec: 90, script: script("v0"), check: clean,
    steps: { writeScript: async () => ({ script: script(`v${++n}`), check: clean, costUsd: 0 }), judgeScript: async () => ({ verdict: verdictOf(scores.shift()), costUsd: 0 }) },
  });
  assert.equal(TOPIC_GATE.maxRewrites, 2);
  assert.equal(g.rewrites, 2);
  assert.equal(g.passed, false);
  assert.equal(g.best.script.title, "v0"); // v2 ties v0 on score: the earlier one stays
  assert.deepEqual(g.rounds.map((r) => r.score), [verdictOf(3).score, verdictOf(2).score, verdictOf(3).score]);
});

test("the gate: a failed paid call stops it (never retried)", async () => {
  let writes = 0;
  const g = await gateTopicScript({
    card: {}, lengthSec: 90, script: script("v0"), check: clean,
    steps: { writeScript: async () => { writes++; throw Object.assign(new Error("anthropic 529"), { costUsd: 0.004 }); }, judgeScript: async () => ({ verdict: verdictOf(3), costUsd: 0 }) },
  });
  assert.equal(writes, 1);
  assert.match(g.stopped, /not retried/);
  assert.equal(g.best.script.title, "v0");
  assert.equal(g.costUsd, 0.004);
});

test("the money meter refuses a call whose worst case could pass the cap, before anything is sent", async () => {
  const m = moneyMeter(0.05);
  const realFetch = globalThis.fetch;
  let sent = 0;
  globalThis.fetch = async () => { sent++; throw new Error("no network in tests"); };
  try {
    // a beats call's worst case (6000 output tokens on Sonnet = $0.06 + input) is over $0.05
    await assert.rejects(writeBeats({ apiKey: "x", card: EXAMPLE_IDEAS[0], lengthSec: 90, meter: m, maxTokens: TOPIC_GATE.maxTokens.beats }), (e) => e.cap === true);
    assert.equal(sent, 0);
    assert.equal(m.spent, 0);
  } finally { globalThis.fetch = realFetch; }
});

test("the whole flow on the free mock: ideas -> beats -> script -> judge -> gate, with a recipe", async () => {
  const r = await topicScript({ provider: "mock", topic: TOPIC, lengthSec: 90, maxRewrites: 2 });
  assert.ok(r.card);
  assert.equal(r.card.topic, TOPIC);
  assert.equal(r.beats.length, 7);
  assert.ok(r.script.lines.length > 10);
  assert.equal(typeof r.verdict.score, "number");
  assert.ok(r.rewrites <= 2);
  assert.equal(r.passed, passesGate({ check: r.check, verdict: r.verdict }));
  assert.ok(RECIPE_IDS.includes(r.recipe.id));
  assert.equal(r.costUsd, 0);
});

test("the whole flow stops on the cap and returns what it has", async () => {
  const fake = {
    writeTopicIdeas: async () => ({ ideas: [{ ...EXAMPLE_IDEAS[0], topic: TOPIC }], costUsd: 0.003 }),
    writeBeats: async () => { throw Object.assign(new Error("money cap"), { cap: true, costUsd: 0 }); },
  };
  const r = await topicScript({ topic: TOPIC, steps: fake });
  assert.match(r.stopped, /^money cap/);
  assert.equal(r.script, null);
  assert.equal(r.costUsd, 0.003);
});

test("judgeScript on the mock gives a library-style verdict", async () => {
  const j = await judgeScript({ provider: "mock", script: EXAMPLE_SCRIPT, card: EXAMPLE_IDEAS[0] });
  assert.equal(typeof j.verdict.accepted, "boolean");
  assert.deepEqual(Object.keys(j.verdict.scores), RUBRIC.map((c) => c.id));
});

// ---------- the recipe picker ----------
test("the recipe picker: the five owner topics", () => {
  const cases = [
    [TOPIC, "creature_town_attack"],
    ["my dog got lost the day of the town's bell festival", "lost_pet_in_town"],
    ["in our town, anyone outside after 9 pm gets taken by the streetlights", "curfew_monster"],
    ["everyone in my town can fly except me", "everyone_except_me"],
    ["our town is on the back of a whale and sharks want to eat it", "creature_town_attack"],
  ];
  for (const [topic, want] of cases) {
    const r = pickRecipe({ topic });
    assert.equal(r.id, want, `${topic} -> ${r.id} ${JSON.stringify(r.scores)}`);
    assert.ok(r.reason.length > 10);
  }
});

test("the recipe picker: a hidden giant revealed, and the card's formula when the topic is vague", () => {
  assert.equal(pickRecipe({ topic: "the hill behind our school is actually a sleeping giant" }).id, "giant_reveal");
  assert.equal(pickRecipe({ topic: "pancakes", card: { opener: "In this town, everyone has a pancake hat, except me.", premise: "", twist: "", formula: "F1" } }).id, "everyone_except_me");
  assert.equal(pickRecipe({ topic: "" }).id, null);
});

test("the recipe picker reads beat features (a night monster in 'until')", () => {
  const beats = [{ part: "until", summary: "Until one night the thing in the dark came out", shows: "a dark street at midnight" }];
  const r = pickRecipe({ topic: "never whistle near the well", beats, card: { opener: "In this town, never whistle near the well.", premise: "", twist: "", formula: "F2" } });
  assert.equal(r.id, "curfew_monster");
});
