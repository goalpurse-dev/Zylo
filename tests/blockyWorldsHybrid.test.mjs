// Blocky Worlds: the hybrid writer (owner, 2026-11-08): Opus plans, Sonnet writes the lines, one draft; checks about
// meaning (hard: opener, length, real copying, premise lost; the rest advisory); the judge as feedback only; the
// anti-copy fix for contractions ("I've" is no name). All free (fakes, no network).
import test from "node:test";
import assert from "node:assert/strict";
import { namesIn, copyProblems } from "../supabase/functions/_shared/blockyWorlds/antiCopy.js";
import { skeletonProblems, isException } from "../supabase/functions/_shared/blockyWorlds/skeleton.js";
import { topicProblems, mentions, topicElements } from "../supabase/functions/_shared/blockyWorlds/topic.js";
import { hybridChecks, hybridPlanSchema, planCard, planText, premiseLost, hybridLinesPrompt, hybridPlanPrompt, HYBRID_LINES_SYSTEM, HYBRID_PLAN_SYSTEM, CLUE_SPOTS, lengthNumbers, SHORT_GRACE } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";
import { writeHybrid, writeHybridPlan, rewriteHybrid, hybridPlanRequest, hybridLinesRequest, requestBody, systemBlocks, costOf, worstCaseUsd, draftCheck, HYBRID } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { BLOCKED_WORDS, safetyProblems } from "../supabase/functions/_shared/blockyWorlds/safety.js";
import { examplesBlock } from "../supabase/functions/_shared/blockyWorlds/broad.js";
import { examplesFor, examplesByIds, REFERENCE_TEXTS } from "../supabase/functions/_shared/blockyWorlds/referenceTexts.js";
import { RECIPE_IDS } from "../supabase/functions/_shared/blockyWorlds/recipes.js";
import { APP_HYBRID, callLogLines, hybridBeats, hybridCard, hybridChecksRow, runCard, stripForLibrary } from "../supabase/functions/_shared/blockyWorlds/hybridApp.js";
import { readFileSync } from "node:fs";
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

test("the plan call: Opus 5.5 at low effort, examples first then the rules, both cached (5-minute TTL by default)", async () => {
  const real = globalThis.fetch;
  let body = null;
  globalThis.fetch = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ model: "claude-opus-5-5", usage: { input_tokens: 1000, output_tokens: 2000 }, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(PLAN) }] }) }; };
  let r;
  try { r = await writeHybridPlan({ apiKey: "x", topic: TOPIC, examples: [{ id: "r", text: "In this town, ..." }], lengthSec: 90 }); } finally { globalThis.fetch = real; }
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.output_config.effort, "low");
  assert.equal(HYBRID.plan.effort, "low");
  assert.equal(body.max_tokens, HYBRID.plan.maxTokens);
  assert.match(body.system[0].text, /REFERENCE EXAMPLES/);
  assert.equal(body.system[1].text, HYBRID_PLAN_SYSTEM);
  assert.deepEqual(body.system.map((b) => b.cache_control), [{ type: "ephemeral" }, { type: "ephemeral" }]);
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

// ---------- production (owner, 2026-11-08): the app's writer, the prompts, the cache, the pad check ----------
const words = (s) => s.lines.reduce((a, l) => a + l.text.split(/\s+/).filter(Boolean).length, 0);
/** SCRIPT with middle lines dropped until it is just under the band's minimum (a little short). */
function slightlyShort(lengthSec = 90) {
  const { lo } = lengthNumbers(lengthSec), s = clone(SCRIPT);
  for (const part of ["until", "climax", "tour", "discovery", "me"]) {
    while (words(s) >= lo) {
      const i = s.lines.findLastIndex((l, k) => l.part === part && k > 0 && s.lines[k - 1].part === part && s.lines.filter((m) => m.part === part).length > 2);
      if (i < 0) break;
      s.lines.splice(i, 1);
    }
  }
  return s;
}
const reply = (model, data, usage = { input_tokens: 100, output_tokens: 100 }) => ({ ok: true, json: async () => ({ model, usage, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(data) }] }) });
async function withFetch(replies, fn) {
  const real = globalThis.fetch, bodies = [];
  globalThis.fetch = async (_u, init) => { const b = JSON.parse(init.body); bodies.push(b); return replies(b, bodies.length); };
  try { return { result: await fn(), bodies }; } finally { globalThis.fetch = real; }
}
const JUDGE_OK = { verdicts: [{ scores: Object.fromEntries(RUBRIC.map((c) => [c.id, 4])), safe: true, better: "sharper closer" }] };

test("production flow through the API shape: Opus plans, then Sonnet writes, both at low effort; the fix reads the lines call's exact prefix", async () => {
  const short = { ...clone(SCRIPT), lines: SCRIPT.lines.slice(0, 20), skeleton: MAP };
  const { result: r, bodies } = await withFetch((b, n) => (n === 1 ? reply("claude-opus-5-5", PLAN) : n === 2 ? reply(b.model, short) : n === 3 ? reply(b.model, { ...clone(SCRIPT), skeleton: MAP }) : reply(b.model, JUDGE_OK)),
    () => writeHybrid({ apiKey: "x", topic: TOPIC, examples: examplesFor("rigged_system"), lengthSec: 90 }));
  assert.deepEqual(bodies.map((b) => b.model), ["claude-opus-5-5", "claude-sonnet-5-5", "claude-sonnet-5-5", "claude-sonnet-5-5"]);
  assert.deepEqual(bodies.slice(0, 3).map((b) => b.output_config.effort), ["low", "low", "low"]);
  // the fix: same model, effort, schema and system bytes as the lines call (a cache read, not a second write)
  assert.equal(JSON.stringify(bodies[2].system), JSON.stringify(bodies[1].system));
  assert.equal(JSON.stringify(bodies[2].output_config), JSON.stringify(bodies[1].output_config));
  assert.match(bodies[2].messages[0].content, /IT FAILED THESE HARD CHECKS/);
  assert.equal(r.fixed, true);
  assert.equal(bodies.filter((b) => /IT FAILED THESE HARD CHECKS/.test(b.messages[0].content)).length, 1);
  assert.equal(r.feedback.feedbackOnly, true);
});

test("cache: the cached prefix is byte-identical across calls (other topic, length, picked idea, plan); only the user message changes", () => {
  const ex = examplesFor("curfew_monster");
  const a = hybridPlanRequest({ topic: TOPIC, recipe: { id: "curfew_monster", what: "x" }, examples: ex, lengthSec: 90 });
  const b = hybridPlanRequest({ topic: "In this town, never whistle after dark.", recipe: { id: "curfew_monster", what: "x" }, examples: examplesFor("curfew_monster"), lengthSec: 150, idea: card() });
  const body = (q, model) => requestBody({ model, system: q.system, user: q.user, schema: {}, effort: "low", maxTokens: 9000 });
  assert.equal(JSON.stringify(body(a, "claude-opus-5-5").system), JSON.stringify(body(b, "claude-opus-5-5").system));
  assert.notEqual(a.user, b.user);
  assert.ok(!a.system.join("").includes(TOPIC) && !b.system.join("").includes("whistle after dark"), "nothing per call in the system blocks");
  assert.match(b.user, /THE IDEA THE USER PICKED/);
  const l1 = hybridLinesRequest({ plan: PLAN, topic: TOPIC, examples: ex, lengthSec: 90 });
  const l2 = hybridLinesRequest({ plan: { ...PLAN, title: "Other" }, topic: "x", examples: ex, lengthSec: 60, previous: SCRIPT, failed: ["Too short"], note: "funnier" });
  assert.equal(JSON.stringify(systemBlocks(l1.system)), JSON.stringify(systemBlocks(l2.system)));
  // examples first, then the rules; a breakpoint on each; 1 h only when asked, "off" none at all
  assert.match(l1.system[0], /^REFERENCE EXAMPLES/);
  assert.equal(l1.system[1], HYBRID_LINES_SYSTEM);
  assert.deepEqual(systemBlocks(l1.system, { ttl: "1h" }).map((x) => x.cache_control), [{ type: "ephemeral", ttl: "1h" }, { type: "ephemeral", ttl: "1h" }]);
  assert.ok(systemBlocks(l1.system, { ttl: "off" }).every((x) => !x.cache_control));
  assert.equal(HYBRID.cacheTtl, "5m");
  // the same recipe always gives the same examples (stable bytes), and the fix runs at the lines call's effort
  assert.equal(examplesBlock(examplesFor("curfew_monster")), examplesBlock(ex));
  assert.equal(HYBRID.fix.effort, HYBRID.lines.effort);
  assert.equal(HYBRID.fix.model, HYBRID.lines.model);
});

test("cache: every cached block is over the 512-token minimum of Opus 5.5 and Sonnet 5.5 (at 4.5 characters a token)", () => {
  const min = 512 * 4.5;
  for (const id of RECIPE_IDS) {
    const ex = examplesFor(id);
    assert.ok(ex.length >= 2, id);
    assert.ok(examplesBlock(ex).length > min, `${id}: ${examplesBlock(ex).length}`);
  }
  assert.ok(HYBRID_PLAN_SYSTEM.length > min, `plan rules ${HYBRID_PLAN_SYSTEM.length}`);
  assert.ok(HYBRID_LINES_SYSTEM.length > min, `lines rules ${HYBRID_LINES_SYSTEM.length}`);
});

test("reference texts: the bundled copy matches the transcripts it was built from", () => {
  for (const id of Object.keys(REFERENCE_TEXTS)) {
    const t = JSON.parse(readFileSync(new URL(`../reference/blocky-worlds/analysis/${id}/transcript.json`, import.meta.url), "utf8"));
    assert.equal(REFERENCE_TEXTS[id], (t.segments ?? []).map((s) => String(s.text ?? "").trim()).filter(Boolean).join(" "), id);
  }
  assert.equal(examplesByIds(["nope", Object.keys(REFERENCE_TEXTS)[0]]).length, 1);
});

test("prompts: every safety-blocked word is named in BOTH the plan and the lines system prompts", () => {
  const all = [...BLOCKED_WORDS.famous, ...BLOCKED_WORDS.platform, ...BLOCKED_WORDS.gore];
  assert.ok(all.length > 80);
  for (const w of all) {
    assert.ok(HYBRID_PLAN_SYSTEM.includes(w), `plan: ${w}`);
    assert.ok(HYBRID_LINES_SYSTEM.includes(w), `lines: ${w}`);
  }
  assert.match(HYBRID_PLAN_SYSTEM, /NEVER USE THESE WORDS/);
  assert.match(HYBRID_LINES_SYSTEM, /coin bank/);
  // the list is the check's own: what the prompt names, the check throws out
  for (const w of ["piggy", "doors", "blood", "stable", "roblox"]) assert.ok(safetyProblems(`I saw the ${w} today.`).length, w);
});

test("prompts: a firm length at both ends; the plan gets exact line intents per part, the writer the band, line count and a count", () => {
  for (const len of [30, 90, 180]) {
    const n = lengthNumbers(len);
    const plan = hybridPlanPrompt({ topic: TOPIC, lengthSec: len });
    assert.ok(plan.includes(`${n.lo} to ${n.hi} spoken words = ${n.lines} lines`), `${len}`);
    for (const b of n.parts) assert.ok(plan.split("\n").includes(`- ${b.id}: ${b.lines}`), `${len} ${b.id}`);
    assert.match(plan, /count the line intents/);
    const lines = hybridLinesPrompt({ plan: PLAN, topic: TOPIC, lengthSec: len });
    assert.ok(lines.includes(`AT LEAST ${n.lo} and AT MOST ${n.hi} words in total, in ${n.lines} lines`), `${len}`);
    assert.match(lines, /BEFORE YOU ANSWER: count the words of every line/);
    assert.equal(n.parts.reduce((a, b) => a + b.lines, 0), n.lines);
  }
  assert.match(HYBRID_LINES_SYSTEM, /HARD RULE AT BOTH ENDS/);
});

test("pad check: a little short (within 10% of the minimum) is only flagged, no fix call; shorter is hard (the one fix)", async () => {
  const { lo } = lengthNumbers(90), s = slightlyShort(90);
  assert.ok(words(s) < lo && words(s) >= Math.ceil(lo * (1 - SHORT_GRACE)), `${words(s)} words`);
  const c = hybridChecks({ script: s, skeleton: MAP, card: card(), lengthSec: 90 });
  assert.ok(!c.hard.some((x) => /short/i.test(x)), JSON.stringify(c.hard));
  assert.ok(c.advisory.some((x) => /^A bit short:/.test(x)));
  const calls = [];
  await writeHybrid({ topic: TOPIC, lengthSec: 90, steps: fakes([s], calls) });
  assert.deepEqual(calls, ["plan", "lines", "judge:true"]);
  // the real 2026-11-08 case: 264 words for a 286 minimum is now flagged, not a $0.034 fix
  assert.ok(264 >= Math.ceil(lo * (1 - SHORT_GRACE)));
  const short = { ...clone(SCRIPT), lines: SCRIPT.lines.slice(0, 20) };
  assert.ok(hybridChecks({ script: short, skeleton: MAP, card: card(), lengthSec: 90 }).hard.some((x) => /^Too short/.test(x)));
});

test("judge never gates in the app: its score is saved as feedback, the problems are the hard checks only", async () => {
  const calls = [];
  const r = await writeHybrid({ topic: TOPIC, examples: [], lengthSec: 90, steps: fakes([slightlyShort(90)], calls, 1) });
  const row = hybridChecksRow(r);
  assert.deepEqual(row.problems, []);
  assert.equal(row.kind, "hybrid");
  assert.ok(row.feedback.score < 20);
  assert.ok(row.warnings.some((x) => /^A bit short/.test(x)));
  // the app's re-check (quote / start) of a hybrid draft: the same split, advisory notes never block
  const c = hybridCard(r, { id: "rigged_system" });
  assert.deepEqual(draftCheck(slightlyShort(90), 90, "hybrid", c).problems, []);
  assert.ok(draftCheck({ ...clone(SCRIPT), lines: SCRIPT.lines.slice(0, 20) }, 90, "hybrid", c).problems.some((x) => /^Too short/.test(x)));
});

test("rewrite of a hybrid draft: ONE Sonnet call from the saved plan with the previous lines, the failed checks and the note", async () => {
  const seen = [];
  const r = await rewriteHybrid({ plan: PLAN, card: card(), lengthSec: 90, previous: SCRIPT, failed: ["Too short: 200 words"], note: "funnier", steps: { writeHybridLines: async (a) => { seen.push(a); return { script: clone(SCRIPT), skeleton: MAP, costUsd: 0.03, usage: { input: 2000, cacheRead: 5000, cacheWrite: 0, output: 1500 } }; } } });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].note, "funnier");
  assert.deepEqual(seen[0].failed, ["Too short: 200 words"]);
  assert.deepEqual(r.checks.hard, []);
  assert.equal(r.costUsd, 0.03);
  const r2 = await rewriteHybrid({ plan: PLAN, card: card(), steps: { writeHybridLines: async () => { throw Object.assign(new Error("anthropic 400 credit balance"), { balance: true, costUsd: 0 }); } } });
  assert.equal(r2.failure.balance, true);
  assert.equal(r2.script, null);
});

test("cost: per-call tokens (input / cache read / cache write / output) priced per model, 1-hour writes at 2x", () => {
  assert.equal(costOf("claude-opus-5-5", { input_tokens: 1000, cache_read_input_tokens: 10000, cache_creation_input_tokens: 0, output_tokens: 1000 }), 0.026);
  assert.equal(costOf("claude-sonnet-5-5", { input_tokens: 0, cache_creation_input_tokens: 1000000, output_tokens: 0 }), 2.5);
  assert.equal(costOf("claude-sonnet-5-5", { cache_creation_input_tokens: 1000000, cache_creation: { ephemeral_1h_input_tokens: 1000000 } }), 4);
  assert.ok(worstCaseUsd("claude-opus-5-5", 9000, 8000, "1h") > worstCaseUsd("claude-opus-5-5", 9000, 8000));
  const lines = callLogLines({ userId: "u", action: "writeScript", calls: { plan: { model: "claude-opus-5-5", usd: 0.05, usage: { input: 900, cacheRead: 5000, cacheWrite: 0, output: 2000 } }, fix: null } });
  assert.equal(lines.length, 1);
  assert.deepEqual([lines[0].input, lines[0].cacheRead, lines[0].cacheWrite, lines[0].output, lines[0].usd], [900, 5000, 0, 2000, 0.05]);
});

test("app: the plan stays with the draft (not on the run, not in the library); beats in the draft's shape; a cap above a full write's worst case", () => {
  const r = { card: card(), plan: PLAN, references: [{ id: "a" }, { id: "b" }] };
  const c = hybridCard(r, { id: "rigged_system" });
  assert.deepEqual(c.hybrid.refs, ["a", "b"]);
  assert.equal(runCard(c).hybrid, undefined);
  assert.equal(runCard(c).prop, c.prop);
  assert.equal(stripForLibrary(c).topic, undefined);
  assert.equal(stripForLibrary(c).hybrid, undefined);
  assert.equal(hybridBeats(PLAN, 90).length, 7);
  const worst = worstCaseUsd(HYBRID.plan.model, HYBRID.plan.maxTokens, 8000) + worstCaseUsd(HYBRID.lines.model, HYBRID.lines.maxTokens, 10000) + worstCaseUsd(HYBRID.fix.model, HYBRID.fix.maxTokens, 12000) + worstCaseUsd("claude-sonnet-5-5", HYBRID.judge.maxTokens, 4000);
  assert.ok(worst < APP_HYBRID.capUsd, `worst ${worst}`);
  assert.equal(APP_HYBRID.judge, true);
});
