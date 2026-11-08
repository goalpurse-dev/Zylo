// Blocky Worlds: the hybrid writer (owner, 2026-11-08): Opus plans, Sonnet writes the lines, one draft; checks about
// meaning (hard: opener, length, real copying, premise lost; the rest advisory); the judge as feedback only; the
// anti-copy fix for contractions ("I've" is no name). All free (fakes, no network).
import test from "node:test";
import assert from "node:assert/strict";
import { namesIn, copyProblems } from "../supabase/functions/_shared/blockyWorlds/antiCopy.js";
import { skeletonProblems, isException } from "../supabase/functions/_shared/blockyWorlds/skeleton.js";
import { topicProblems, mentions, topicElements } from "../supabase/functions/_shared/blockyWorlds/topic.js";
import { hybridChecks, hybridPlanSchema, planCard, planText, premiseLost, hybridLinesPrompt, HYBRID_LINES_SYSTEM, CLUE_SPOTS } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";
import { writeHybrid, writeHybridPlan, HYBRID } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { RUBRIC, scoreVerdict } from "../supabase/functions/_shared/blockyWorlds/library.js";

const L = (part, ...texts) => texts.map((text) => ({ part, text }));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TOPIC = "In this town, poorer people live on the ground and richer people live higher up.";
// a 90 s script (~300 words) that does every job
const SCRIPT = {
  title: "The Ground Holds",
  lines: [
    ...L("rule", "In this town, poorer people live on the ground and richer people live higher up."),
    ...L("tour", "You see, money lifts your house up its tower.", "Go broke and it slides down in front of everyone.",
      "Mr. Pell's porch sinks whenever someone up top gets richer.", "So we call him Mr. Puddle.",
      "Captain Huxworth sends his laundry down by parachute.", "His elevator takes three days.",
      "Mrs. Quibble on floor forty sees over the clouds.", "On her tiptoes."),
    ...L("me", "I'm Tilly. I live in the lowest house of all.", "Our front door is half underground.",
      "Grandma Opal says the ground remembers everything.", "I keep Grandpa's brass whistle on a string.",
      "He said to blow it when the ground needs to move.", "I never knew what that meant."),
    ...L("until", "Until one night the mayor threw a gold party up top.", "My doorstep sank an inch.",
      "Then our whole street sank to the rooftops.", "Then the square cracked open like an egg.",
      "Poor families grabbed their kids and ran.", "Mr. Pell's porch was gone."),
    ...L("discovery", "I slid into the crack after my doorstep.", "Down there were chains. Giant chains.",
      "Every chain ran from a ground house up to a tower.", "Our weight was holding the rich houses up.",
      "The rule was never about money.", "It was about who sinks so others can float."),
    ...L("climax", "I put Grandpa's brass whistle to my lips.", "I blew as hard as I could.",
      "Every poor family on the ground stepped off their porch at once.", "The chains went slack.",
      "The towers came down slowly. Gently. Floor by floor.", "Until every rich house sat on the ground next to ours.",
      "Mrs. Quibble stood on her tiptoes. She could see my house now.", "Nobody floated. Nobody sank."),
    ...L("closer", "Now the poorer and the richer live side by side.",
      "In this town, nobody lives higher up anymore.", "Turns out the ground was holding everyone up."),
  ],
  post: { title: "t", description: "d", hashtags: ["#a"] },
};
const MAP = {
  price: "Go broke and it slides down", exception: "I live in the lowest house of all", prop: "Grandpa's brass whistle", prop_quote: "I keep Grandpa's brass whistle",
  neighbours: [{ name: "Mr. Pell", quote: "Mr. Pell's porch sinks" }, { name: "Captain Huxworth", quote: "sends his laundry down by parachute" }, { name: "Mrs. Quibble", quote: "Mrs. Quibble on floor forty" }],
  escalation: ["My doorstep sank an inch", "our whole street sank to the rooftops", "the square cracked open"],
  discovery: "Our weight was holding the rich houses up", twist: "The poor families' weight holds the towers up.", clue: "porch sinks", clue_quote: "Mr. Pell's porch sinks whenever",
  win: "Every poor family on the ground stepped off", win_by: "rule",
};
const PLAN = {
  title: "The Ground Holds", premise: "p", opener: TOPIC, price: "Go broke and your house slides down.", teaser: "t",
  narrator: { name: "Tilly", who: "ten, from the lowest house", exception: "the lowest house of all" },
  neighbours: [{ name: "Mr. Pell", joke: "porch sinks when someone up top gets richer" }, { name: "Captain Huxworth", joke: "laundry by parachute" }, { name: "Mrs. Quibble", joke: "sees over clouds on tiptoes" }],
  prop: { object: "Grandpa's brass whistle", setup: "kept on a string", climax_job: "signals everyone to step off at once" },
  twist: { sentence: "The poor families' weight holds the towers up.", clues: [{ clue: "porch sinks", where: "neighbour1", planted_by: "Mr. Pell's porch sinks when someone gets richer" }] },
  escalation: ["doorstep sinks", "street sinks", "square cracks"], discovery: "chains", climax: { how: "everyone steps off", by: "rule" },
  closer: "In this town, nobody lives higher up anymore.", formula: "F1", twistType: "T1", mood: "epic", setting: "town square",
  beats: ["rule", "tour", "me", "until", "discovery", "climax", "closer"].map((part) => ({ part, intent: part, shows: part, lines: [part] })),
};
const card = () => planCard(PLAN, TOPIC);

// ---------- anti-copy: contractions are never names ----------
test("anti-copy (2026-11-08): \"I've\", \"I'm\", \"Don't\" are no names; a possessive keeps its name", () => {
  const n = namesIn("I've polished boots for years. I'm Pip. Don't laugh. We'll see. Mr. Pell's porch sank. Then Bogsworth sneezed.", { anyPosition: true });
  assert.ok(!n.includes("Ive") && !n.includes("Im") && !n.includes("Don") && !n.includes("Dont") && !n.includes("Well"), JSON.stringify(n));
  assert.ok(n.includes("Pell") && n.includes("Bogsworth") && n.includes("Pip"));
  const ref = { id: "r", text: "So I said, I've had enough. And Ive the giant laughed." };
  const s = { lines: L("me", "I've polished boots every day of my life.") };
  assert.deepEqual(copyProblems({ script: s, examples: [ref] }).filter((p) => p.kind === "names"), []);
  // a real shared name is still caught
  assert.equal(copyProblems({ script: { lines: L("tour", "Then Bogsworth laughed.") }, examples: [{ id: "r2", text: "My friend Bogsworth sneezed." }] })[0].kind, "names");
});

// ---------- meaning-level checks ----------
test("topic: \"poor families\" counts as the topic's \"poorer\", \"rich\" as \"richer\", \"loud\" as \"loudest\"", () => {
  const els = topicElements(TOPIC);
  const poorer = els.find((e) => e.words.includes("poorer"));
  assert.ok(mentions("Poor families grabbed their kids.", poorer));
  assert.ok(mentions("the rich houses", els.find((e) => e.words.includes("richer"))));
  const loud = topicElements("In this town, whoever sneezes loudest becomes mayor for the day.").find((e) => e.words.includes("loudest"));
  assert.ok(mentions("the loud ones won", loud));
  const s = clone(SCRIPT);
  s.lines = s.lines.map((l, i) => (i > 1 ? { ...l, text: l.text.replace(/poorer|richer/g, "x") } : l));
  assert.ok(!topicProblems(TOPIC, s).some((p) => /"poorer" never shows up/.test(p)), JSON.stringify(topicProblems(TOPIC, s)));
});

test("skeleton: the exception by meaning (\"the quietest sneezer in town\", \"everyone but me\"), the price in line 3", () => {
  for (const t of ["Pip. The quietest sneezer in town.", "Everyone gets a tower but me.", "I'm the only one who can't sneeze.", "Except me."]) assert.ok(isException(t), t);
  for (const t of ["I live near the forest.", "I'm honest."]) assert.ok(!isException(t), t);
  const s = clone(SCRIPT), m = clone(MAP);
  m.exception = "a quote that is not there";
  s.lines[9] = { part: "me", text: "I'm Tilly. The quietest kid on the ground." };
  m.price = "Mr. Pell's porch sinks"; // line 4: too late
  let p = skeletonProblems(s, m);
  assert.ok(!p.some((x) => /exception/.test(x)), JSON.stringify(p));
  assert.ok(p.some((x) => /price .* lines 1 to 3/.test(x)));
  m.price = "Go broke and it slides down"; // line 3: fine
  p = skeletonProblems(s, m);
  assert.ok(!p.some((x) => /price/.test(x)), JSON.stringify(p));
});

test("skeleton: a neighbour named anywhere in the tour counts even when the map's joke quote is off", () => {
  const m = clone(MAP);
  m.neighbours = m.neighbours.map((n) => ({ ...n, quote: "a joke quote the writer paraphrased" }));
  assert.ok(!skeletonProblems(SCRIPT, m).some((x) => /named neighbours/.test(x)));
});

// ---------- hard vs advisory ----------
test("hybrid checks: the good script has no hard problem; soft misses are advisory, never hard", () => {
  const c = hybridChecks({ script: SCRIPT, skeleton: MAP, card: card(), examples: [], lengthSec: 90 });
  assert.deepEqual(c.hard, [], JSON.stringify(c.hard));
  const s = clone(SCRIPT), m = clone(MAP);
  m.neighbours = []; m.clue_quote = "nothing";
  const c2 = hybridChecks({ script: s, skeleton: m, card: card(), examples: [], lengthSec: 90 });
  assert.deepEqual(c2.hard, []);
  assert.ok(c2.advisory.some((x) => /^Skeleton/.test(x)) && c2.advisory.some((x) => /^Twist/.test(x)));
});

test("hybrid checks: opener, length, real copying and a lost premise are hard", () => {
  const s = clone(SCRIPT);
  s.lines[0] = { part: "rule", text: "Poorer people live on the ground here." };
  assert.ok(hybridChecks({ script: s, skeleton: MAP, card: card(), lengthSec: 90 }).hard.some((x) => /^The first line must start/.test(x)));
  const short = { ...clone(SCRIPT), lines: SCRIPT.lines.slice(0, 20) };
  assert.ok(hybridChecks({ script: short, skeleton: MAP, card: card(), lengthSec: 90 }).hard.some((x) => /^Too short/.test(x)));
  const ref = { id: "ref9", text: "My uncle Huxworth always says the elevator takes three days to reach the top." };
  assert.ok(hybridChecks({ script: SCRIPT, skeleton: MAP, card: card(), examples: [ref], lengthSec: 90 }).hard.some((x) => /^Too close to reference ref9/.test(x)));
  const lost = clone(SCRIPT);
  lost.lines = lost.lines.map((l, i) => ({ ...l, text: i === 0 ? "In this town, cats wear hats on Tuesdays." : l.text.replace(/\b(poor\w*|rich\w*|ground|high\w*|up)\b/gi, "blue") }));
  assert.match(premiseLost(TOPIC, lost), /premise is lost/);
  assert.ok(hybridChecks({ script: lost, skeleton: MAP, card: card(), lengthSec: 90 }).hard.some((x) => /premise is lost/.test(x)));
  assert.equal(premiseLost(TOPIC, SCRIPT), null);
});

// ---------- the plan and the prompts ----------
test("the plan: schema carries the clues with WHERE they are planted; the card and the writer's text come from it", () => {
  const sch = hybridPlanSchema();
  assert.deepEqual(sch.properties.twist.properties.clues.items.properties.where.enum, [...CLUE_SPOTS]);
  for (const k of ["premise", "price", "neighbours", "prop", "narrator", "escalation", "discovery", "climax", "closer", "beats"]) assert.ok(sch.required.includes(k), k);
  const c = card();
  assert.equal(c.prop, "Grandpa's brass whistle");
  assert.equal(c.twist_clue, "porch sinks");
  assert.equal(c.examples.length, 3);
  assert.equal(c.topic, TOPIC);
  const t = planText(PLAN);
  assert.match(t, /"porch sinks" in Mr\. Pell's joke/);
  assert.match(hybridLinesPrompt({ plan: PLAN, topic: TOPIC, lengthSec: 90 }), /THE PLAN/);
  assert.match(HYBRID_LINES_SYSTEM, /YOU GET A PLAN/);
});

test("the plan call: Opus 5.5 at the hybrid effort, examples first, no cache write for a one-off call", async () => {
  const real = globalThis.fetch;
  let body = null;
  globalThis.fetch = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ model: "claude-opus-5-5", usage: { input_tokens: 1000, output_tokens: 2000 }, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(PLAN) }] }) }; };
  let r;
  try { r = await writeHybridPlan({ apiKey: "x", topic: TOPIC, examples: [{ id: "r", text: "In this town, ..." }], lengthSec: 90 }); } finally { globalThis.fetch = real; }
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.output_config.effort, HYBRID.plan.effort);
  assert.equal(body.max_tokens, HYBRID.plan.maxTokens);
  assert.match(body.system[0].text, /REFERENCE EXAMPLES/);
  assert.ok(body.system.every((b) => !b.cache_control));
  assert.equal(r.costUsd, 0.044); // 1000 in at $4 + 2000 out at $20 per million
  assert.equal(r.card.twist_clue, "porch sinks");
});

// ---------- the flow with fakes ----------
const verdict = (n) => scoreVerdict({ scores: Object.fromEntries(RUBRIC.map((c) => [c.id, n])), safe: true, better: "sharper closer" });
const fakes = (scripts, calls, score = 2) => ({
  writeHybridPlan: async () => { calls.push("plan"); return { plan: clone(PLAN), card: card(), notes: [], costUsd: 0.06, usage: { output: 3000 } }; },
  writeHybridLines: async ({ previous, failed, effort }) => { calls.push(previous ? `fix:${effort}:${failed.length}` : "lines"); return { script: clone(scripts.shift()), skeleton: clone(MAP), costUsd: previous ? 0.02 : 0.04, usage: {} }; },
  repairOpener: async () => { calls.push("opener"); return { line: SCRIPT.lines[0].text, costUsd: 0.001 }; },
  judgeScript: async ({ exemptOriginality }) => { calls.push(`judge:${exemptOriginality}`); return { verdict: verdict(score), costUsd: 0.01, usage: {} }; },
});

test("writeHybrid: one draft, advisory notes only -> no fix; a low judge score never triggers a rewrite", async () => {
  const calls = [];
  const s = clone(SCRIPT); s.lines.splice(-2, 2, { part: "closer", text: "Nobody floats now." });
  s.lines.splice(-1, 0, ...L("closer", "Not even the mayor.", "He tried. Twice.", "Grandma laughed so hard she sat down.", "On the ground. Where else."));
  const r = await writeHybrid({ topic: TOPIC, examples: [], lengthSec: 90, steps: fakes([SCRIPT], calls, 1) });
  assert.deepEqual(calls, ["plan", "lines", "judge:true"]);
  assert.equal(r.fixed, null);
  assert.deepEqual(r.checks.hard, []);
  assert.equal(r.feedback.feedbackOnly, true);
  assert.ok(r.feedback.score < 20);
  assert.equal(r.costUsd, 0.11);
  assert.equal(r.calls.plan.usd, 0.06);
});

test("writeHybrid: a hard failure gets exactly ONE cheap fix (low effort), even if it still fails", async () => {
  const calls = [];
  const short = { ...clone(SCRIPT), lines: SCRIPT.lines.slice(0, 20) };
  const r = await writeHybrid({ topic: TOPIC, lengthSec: 90, steps: fakes([short, short], calls) });
  assert.deepEqual(calls, ["plan", "lines", `fix:${HYBRID.fix.effort}:1`, "judge:true"]);
  assert.equal(r.fixed, false);
  assert.ok(r.firstHard.some((x) => /^Too short/.test(x)));
  const calls2 = [];
  const r2 = await writeHybrid({ topic: TOPIC, lengthSec: 90, steps: fakes([short, SCRIPT], calls2) });
  assert.equal(r2.fixed, true);
  assert.equal(calls2.filter((c) => c.startsWith("fix")).length, 1);
});

test("writeHybrid: an opener-only miss goes to the small opener call; a capped call stops the topic", async () => {
  const calls = [];
  const s = clone(SCRIPT); s.lines[0] = { part: "rule", text: "Poorer people live on the ground and richer people live higher up." };
  const r = await writeHybrid({ topic: TOPIC, lengthSec: 90, steps: fakes([s], calls) });
  assert.deepEqual(calls, ["plan", "lines", "opener", "judge:true"]);
  assert.equal(r.fixed, true);
  const r2 = await writeHybrid({ topic: TOPIC, steps: { writeHybridPlan: async () => { throw Object.assign(new Error("cap"), { cap: true, costUsd: 0 }); } } });
  assert.match(r2.stopped, /^money cap/);
  assert.equal(r2.script, null);
});
