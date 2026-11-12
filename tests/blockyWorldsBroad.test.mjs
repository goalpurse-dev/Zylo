// Blocky Worlds: broad topics written with reference transcripts as examples (owner, 2026-11-08). The skeleton and
// twist checks, the anti-copy check, the 3-draft flow (with fakes) and the recipe picks. All free.
import test from "node:test";
import assert from "node:assert/strict";
import { skeletonProblems, lineOf } from "../supabase/functions/_shared/blockyWorlds/skeleton.js";
import { copyProblems, namesIn } from "../supabase/functions/_shared/blockyWorlds/antiCopy.js";
import { examplesBlock, RECIPE_REFERENCES, broadScriptSchema, planSchema, ANGLES } from "../supabase/functions/_shared/blockyWorlds/broad.js";
import { broadTopic, writeBroadScript, BROAD_MAX_TOKENS } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { judgeScriptPrompt, RUBRIC, scoreVerdict } from "../supabase/functions/_shared/blockyWorlds/library.js";
import { pickRecipe, RECIPE_IDS } from "../supabase/functions/_shared/blockyWorlds/recipes.js";
import { EXAMPLE_IDEAS } from "../supabase/functions/_shared/blockyWorlds/examples.js";

const L = (part, ...texts) => texts.map((text) => ({ part, text }));
const GOOD = {
  title: "The Ladder Kid",
  lines: [
    ...L("rule", "In this town, the richer you are, the higher you live."),
    ...L("tour", "You see, fall behind on rent and your floor sinks one level.", "Mrs. Albery missed one payment and woke up in the basement.", "Mr. Dunkle polishes his stilts every morning.", "Tobias the mailman delivers by kite."),
    ...L("me", "I'm Wren, the only kid on the lowest floor.", "I carry Grandpa's rusty wrench everywhere.", "It hums when the pipes groan."),
    ...L("until", "Until one night, the pipes groaned louder.", "Then the whole street tilted.", "Then the top towers began to sink."),
    ...L("discovery", "The rule was never about money.", "The towers stand on the pipes under my floor."),
    ...L("climax", "I swung Grandpa's rusty wrench at the big valve.", "The pipes groaned once more and the towers stopped."),
    ...L("closer", "Now the richer you are, the nicer you are to the lowest floor."),
  ],
  post: {},
};
const MAP = {
  price: "fall behind on rent and your floor sinks", exception: "the only kid on the lowest floor", prop: "Grandpa's rusty wrench", prop_quote: "I carry Grandpa's rusty wrench",
  neighbours: [{ name: "Mrs. Albery", quote: "Mrs. Albery missed one payment" }, { name: "Mr. Dunkle", quote: "Mr. Dunkle polishes his stilts" }, { name: "Tobias", quote: "Tobias the mailman delivers by kite" }],
  escalation: ["the pipes groaned louder", "the whole street tilted", "the top towers began to sink"],
  discovery: "The rule was never about money", twist: "The rich towers stand on the poor kid's pipes.", clue: "pipes groan", clue_quote: "It hums when the pipes groan",
  win: "I swung Grandpa's rusty wrench at the big valve", win_by: "prop",
};
const clone = (x) => JSON.parse(JSON.stringify(x));

test("skeleton: a script that does every job passes", () => {
  assert.deepEqual(skeletonProblems(GOOD, MAP), []);
});

test("skeleton: each missing job is caught", () => {
  const cases = [
    [(s, m) => { m.price = "the top towers began to sink"; }, /price/],
    [(s, m) => { m.neighbours = m.neighbours.slice(0, 2); }, /three named neighbours/],
    [(s, m) => { s.lines[5].text = "I'm Wren and I like soup."; m.exception = "I like soup"; }, /exception/],
    [(s, m) => { s.lines[6].text = "I carry a sandwich everywhere."; m.prop_quote = "I carry a sandwich"; }, /must be named in "Me"/],
    // meaning over quotes (2026-11-08): only an "until" part of fewer than three lines fails, whatever the map quotes
    [(s, m) => { m.escalation = m.escalation.slice(0, 2); s.lines.splice(10, 1); }, /three escalation steps/],
    [(s, m) => { s.lines[11].text = "The cake was never about frosting."; s.lines[12].text = "Frosting is sweet."; m.discovery = "The cake was never about frosting"; }, /about the rule/],
    [(s, m) => { s.lines.at(-1).text = "Now we all eat cake."; }, /flip or echo line 1/],
    [(s, m) => { m.clue = "a golden whistle"; m.clue_quote = "The towers stand on the pipes"; }, /^Twist: the twist is not set up earlier/],
    [(s, m) => { s.lines[14].text = "A wizard's spell lifted the towers."; }, /new magic \(wizard, spell\)/],
  ];
  for (const [mutate, want] of cases) {
    const s = clone(GOOD), m = clone(MAP);
    mutate(s, m);
    const p = skeletonProblems(s, m);
    assert.ok(p.some((x) => want.test(x)), `${want}: ${JSON.stringify(p)}`);
  }
});

test("skeleton (2026-11-08 run): a punchline quote after the named line, 'Dobbs the baker', a two-sentence quote", () => {
  const s = clone(GOOD), m = clone(MAP);
  s.lines.splice(4, 1, { part: "tour", text: "Dobbs the baker stacked his oven on level fourteen." }, { part: "tour", text: "His chimney's now taller than his house." });
  m.neighbours = [{ name: "Mrs. Albery", quote: "woke up in the basement" }, { name: "Mr. Dunkle", quote: "Mr. Dunkle polishes his stilts" }, { name: "Dobbs the baker", quote: "chimney's now taller than his house" }];
  m.discovery = "The rule was never about money. The towers stand on the pipes.";
  assert.deepEqual(skeletonProblems(s, m), []);
});

test("lineOf finds a quote word for word or by 80% of its words", () => {
  assert.equal(lineOf(GOOD.lines, "Mr. Dunkle polishes his stilts"), 3);
  assert.equal(lineOf(GOOD.lines, "Dunkle polishes his shiny stilts"), 3);
  assert.equal(lineOf(GOOD.lines, "a line that is not there at all"), -1);
  // a paraphrase running across two lines of one part (2026-11-08 run)
  assert.equal(lineOf(GOOD.lines, "The rule was never about money and the towers stand on the pipes"), 11);
});

const REF = { id: "ref1", text: "In this town, the richer you are, the higher your house is. Old Mrs. Pemberton keeps a goat on floor ninety. My neighbour Bartholomew sells clouds in jars. Then the elevator fell into the lake and the mayor was a robot all along." };
test("anti-copy: a shared 5-word run, a reference name and its twist are caught; the premise line is free", () => {
  const s = { lines: [...L("rule", "In this town, the richer you are, the higher your house is."), ...L("tour", "Bartholomew sells clouds in jars by the dozen.")] };
  const p = copyProblems({ script: s, twist: "The elevator fell into the lake and the mayor was a robot.", examples: [REF] });
  assert.deepEqual(p.map((x) => x.kind).sort(), ["lines", "names", "twist"]);
  assert.match(p.find((x) => x.kind === "lines").detail, /sells clouds in jars/);
  // the same premise in line 1 alone is allowed
  assert.deepEqual(copyProblems({ script: { lines: s.lines.slice(0, 1) }, twist: "", examples: [REF] }), []);
});

test("anti-copy: trivial runs and our own names pass", () => {
  const s = { lines: L("tour", "And then I saw that it was a big day.", "Mrs. Albery waved from the roof.") };
  assert.deepEqual(copyProblems({ script: s, twist: "The pipes hold the towers up.", examples: [REF] }), []);
  assert.deepEqual(namesIn("Grandpa's wrench. Then Mrs. Albery waved at Tobias."), ["Albery", "Tobias"]);
});

test("the examples block: the references and what must be the writer's own", () => {
  const b = examplesBlock([REF]);
  assert.match(b, /reference ref1/);
  assert.match(b, /MUST BE YOUR OWN/);
  assert.ok(b.includes(REF.text));
  for (const id of ["rigged_system", "curfew_monster", "creature_town_attack", "lost_pet_in_town", "absurd_rule_comedy"]) assert.ok(RECIPE_REFERENCES[id].length >= 2 && RECIPE_REFERENCES[id].length <= 3);
  assert.ok(broadScriptSchema().required.includes("skeleton"));
  assert.ok(planSchema().properties.card.required.includes("twist_clue"));
});

test("the script call sends the examples first and both system blocks cached", async () => {
  const real = globalThis.fetch;
  let body = null;
  globalThis.fetch = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ model: "claude-sonnet-5-5", usage: {}, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ title: "t", lines: [], post: {}, skeleton: {} }) }] }) }; };
  try {
    await writeBroadScript({ apiKey: "x", card: { ...EXAMPLE_IDEAS[0], twist_clue: "a name" }, beats: [], examples: [REF], lengthSec: 90 });
  } finally { globalThis.fetch = real; }
  assert.equal(body.system.length, 2);
  assert.match(body.system[0].text, /REFERENCE EXAMPLES/);
  assert.ok(body.system.every((b) => b.cache_control?.type === "ephemeral"));
  assert.equal(body.max_tokens, BROAD_MAX_TOKENS.script);
  assert.match(body.messages[0].content, /THE TWIST'S CLUE/);
});

test("a model comparison can override the writer's model, effort, ceiling and add a note (fallback on for Opus 5.5)", async () => {
  const real = globalThis.fetch;
  let body = null, headers = null;
  globalThis.fetch = async (_u, init) => { body = JSON.parse(init.body); headers = init.headers; return { ok: true, json: async () => ({ model: "claude-opus-5-5", usage: { output_tokens: 1000 }, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ title: "t", lines: [], post: {}, skeleton: {} }) }] }) }; };
  let r;
  try {
    r = await writeBroadScript({ apiKey: "x", card: { ...EXAMPLE_IDEAS[0], twist_clue: "a name" }, beats: [], examples: [REF], lengthSec: 90, model: "claude-opus-5-5", effort: "high", maxTokens: 16000, note: "OWNER NOTE: plant it in a neighbour joke" });
  } finally { globalThis.fetch = real; }
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.output_config.effort, "high");
  assert.equal(body.max_tokens, 16000);
  assert.match(body.messages[0].content, /OWNER NOTE: plant it in a neighbour joke$/);
  assert.equal(body.fallbacks, "default");
  assert.equal(headers["anthropic-beta"], "server-side-fallback-2026-07-01");
  assert.equal(r.costUsd, 0.02); // 1000 output tokens at $20 per million
});

test("the judge on broad topics: the premise is exempt from originality, copying is not", () => {
  const p = judgeScriptPrompt(GOOD, { title: "x" }, { exemptOriginality: true });
  assert.match(p, /THE PREMISE IS THE USER'S CHOICE/);
  assert.doesNotMatch(judgeScriptPrompt(GOOD, { title: "x" }), /THE PREMISE IS THE USER'S CHOICE/);
});

// ---------- the 3-draft flow with fakes ----------
const verdict = (n) => scoreVerdict({ scores: Object.fromEntries(RUBRIC.map((c) => [c.id, n])), safe: true, better: "-" });
const card = { ...EXAMPLE_IDEAS[0], prop: "Grandpa's rusty wrench", closer: GOOD.lines.at(-1).text, twist_clue: "pipes groan", topic: "" };
// a script of the right length for 90 s (the length check is real): GOOD padded with tour jokes
const padded = () => {
  const s = clone(GOOD);
  const extra = Array.from({ length: 28 }, (_, i) => ({ part: "tour", text: `Neighbour number ${["one", "two", "three", "four", "five", "six"][i % 6]} waves from a little window.` }));
  s.lines.splice(5, 0, ...extra);
  return s;
};

test("broadTopic: 3 drafts, a failing draft gets one fix, one still failing is discarded unjudged, the best judged is kept", async () => {
  const calls = { plan: 0, script: 0, judge: [] };
  const scripts = [padded(), { ...padded(), lines: padded().lines.slice(0, 5) }, padded(), { ...padded(), lines: padded().lines.slice(0, 5) }, { ...padded(), lines: padded().lines.slice(0, 5) }];
  const r = await broadTopic({
    topic: "", examples: [REF], lengthSec: 90, drafts: 3,
    steps: {
      writePlan: async ({ angle }) => { calls.plan++; return { card: clone(card), beats: [], problems: [], costUsd: 0.01, angle }; },
      writeBroadScript: async ({ previous }) => { calls.script++; return { script: clone(scripts.shift()), skeleton: clone(MAP), costUsd: 0.03, previous }; },
      judgeScript: async ({ exemptOriginality }) => { calls.judge.push(exemptOriginality); return { verdict: verdict([4, 3][calls.judge.length - 1] ?? 2), costUsd: 0.005 }; },
    },
  });
  assert.equal(calls.plan, 3);
  assert.equal(calls.script, 5); // draft 1 ok; draft 2 fails -> fixed -> ok; draft 3 fails -> fix fails -> discarded
  assert.deepEqual(calls.judge, [true, true]);
  assert.equal(r.drafts[1].fixed, true);
  assert.equal(r.drafts[2].discarded, "fails the checks after one fix");
  assert.equal(r.drafts[2].verdict, null);
  assert.equal(r.best.n, 1);
  assert.equal(r.costUsd, Number((3 * 0.01 + 5 * 0.03 + 2 * 0.005).toFixed(5)));
  assert.deepEqual(r.drafts.map((d) => d.angle), ANGLES);
});

test("broadTopic: a capped call stops the topic, nothing retried", async () => {
  let plans = 0;
  const r = await broadTopic({
    topic: "x", examples: [REF], drafts: 3,
    steps: { writePlan: async () => { plans++; throw Object.assign(new Error("money cap"), { cap: true, costUsd: 0 }); } },
  });
  assert.equal(plans, 1);
  assert.match(r.stopped, /^money cap/);
  assert.equal(r.best, null);
});

test("the recipe picker: the owner's 5 broad topics", () => {
  const cases = [
    ["In this town, poorer people live on the ground and richer people live higher up.", "rigged_system"],
    ["In this town, there's one rule: never look out your window after dark.", "curfew_monster"],
    ["We live inside a giant turtle and a wolf with an army is hunting it.", "creature_town_attack"],
    ["My dog got lost on the day of the town's bell festival.", "lost_pet_in_town"],
    ["In this town, whoever sneezes loudest becomes mayor for the day.", "absurd_rule_comedy"],
  ];
  for (const [t, want] of cases) assert.equal(pickRecipe({ topic: t }).id, want, t);
  assert.ok(RECIPE_IDS.includes("rigged_system") && RECIPE_IDS.includes("absurd_rule_comedy"));
});
