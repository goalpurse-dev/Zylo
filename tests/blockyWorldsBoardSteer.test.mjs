// Blocky Worlds board-only launch mode, step 4: custom-topic steering (the kit as hard rules for the idea writer, the
// hybrid planner and the line writer; the free kit check in the hybrid checks, draftCheck and recheck; Fix it for a line
// miss, "Move it to our town" for a whole-premise miss). All free: fetch is stubbed, no paid call.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOARD_KIT } from "../supabase/functions/_shared/blockyWorlds/boardKit.js";
import { BOARD_PREFIX, PREMISE_PREFIX, kitBlock } from "../supabase/functions/_shared/blockyWorlds/boardFit.js";
import { BOARD_TOPIC_LINE, IDEAS_SYSTEM, ideasSystem, topicPrompt } from "../supabase/functions/_shared/blockyWorlds/ideas.js";
import { EXAMPLE_IDEAS } from "../supabase/functions/_shared/blockyWorlds/examples.js";
import { HYBRID_LINES_SYSTEM, HYBRID_PLAN_SYSTEM, hybridChecks, hybridLinesSystem, hybridPlanSchema, hybridPlanSystem, planCard } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";
import { draftCheck, fixPart, hybridLinesRequest, hybridPlanRequest, writeHybrid, writeTopicIdeas } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { problemSpots } from "../supabase/functions/_shared/blockyWorlds/protocol.js";

const S = (...texts) => ({ title: "t", lines: texts.map((text, i) => ({ part: i === 0 ? "rule" : i < 4 ? "tour" : "climax", text })), post: { title: "t" } });
const filler = (n) => Array.from({ length: n }, (_, i) => `Mrs. Pell waved at me ${i + 1} times.`);
const CAVE = S("In this town, we all live in a cave under the hill.", ...filler(9));
const FOG = S("In this town, nobody whistles after dark.", "The fog came down the street.", ...filler(7), "The fog rolled in again.");

test("the idea writer: launch mode swaps the settings for the kit's places and adds the kit; off is unchanged", () => {
  assert.equal(ideasSystem(), IDEAS_SYSTEM);
  const b = ideasSystem({ board: true });
  assert.ok(b.includes(kitBlock(BOARD_KIT, "ideas")));
  assert.match(b, /SETTINGS: streets; inside houses; a park \/ town square; the woods; a school classroom; a shop \(the only places/);
  assert.ok(!/canyon or cliff town|underwater or submarine/.test(b), "the old settings are gone");
  assert.match(b, /Return only the JSON object\.$/);
  assert.ok(topicPrompt({ topic: "a dragon in my school", board: true }).text.includes(BOARD_TOPIC_LINE));
  assert.ok(!topicPrompt({ topic: "a dragon in my school" }).text.includes(BOARD_TOPIC_LINE));
});

test("topic ideas in launch mode: the kit goes to the writer, only filmable worlds come back, none -> what it needs", async () => {
  const topic = "my shadow has a job";
  const { slots } = topicPrompt({ topic, seed: 0 });
  const fit = EXAMPLE_IDEAS.find((i) => /shadow goes to work/.test(i.opener));
  const mk = (over, k) => ({ ...fit, ...over, formula: slots[k].formula, twistType: slots[k].twist, mood: slots[k].mood });
  const reply = (ideas) => async (_u, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ model: "claude-haiku-5-5", usage: {}, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ideas }) }] }) }; };
  const sent = [], real = globalThis.fetch;
  try {
    globalThis.fetch = reply([mk({}, 0), mk({ opener: "In this town, my shadow works nights down in the old cave under the hill.", title: "Cave Shift" }, 1), mk({ opener: "In this town, my shadow drives the school bus to work every single night.", title: "Bus Shadow" }, 2)]);
    const r = await writeTopicIdeas({ apiKey: "test", topic, board: true });
    assert.deepEqual(r.ideas.map((i) => i.title), [fit.title]);
    assert.equal(r.unfit, null);
    assert.ok(JSON.stringify(sent[0].system).includes("THE WORLD WE CAN FILM"), "the kit is in the system prompt");
    globalThis.fetch = reply([mk({ opener: "In this town, my shadow works nights down in the old cave under the hill.", title: "Cave Shift" }, 0)]);
    const none = await writeTopicIdeas({ apiKey: "test", topic, board: true });
    assert.deepEqual(none.ideas, []);
    assert.ok(none.unfit.needs.includes("cave"));
    assert.match(none.unfit.canFilm, /^streets, /);
    // off: today's behaviour (nothing filtered)
    globalThis.fetch = reply([mk({ opener: "In this town, my shadow works nights down in the old cave under the hill.", title: "Cave Shift" }, 0)]);
    assert.equal((await writeTopicIdeas({ apiKey: "test", topic })).ideas.length, 1);
  } finally { globalThis.fetch = real; }
});

test("the hybrid planner and line writer get the kit as hard rules in launch mode; off is byte for byte the same", () => {
  assert.equal(hybridPlanSystem(), HYBRID_PLAN_SYSTEM);
  assert.equal(hybridLinesSystem(), HYBRID_LINES_SYSTEM);
  const plan = hybridPlanSystem({ board: true }), lines = hybridLinesSystem({ board: true });
  assert.ok(plan.includes(kitBlock(BOARD_KIT, "plan")));
  assert.ok(plan.indexOf("THE WORLD WE CAN FILM") > plan.indexOf("THE STORY IS IN THE PICTURE"), "right after the rule visual");
  assert.ok(lines.includes(kitBlock(BOARD_KIT, "lines")));
  assert.match(lines, /Return only the JSON object: the title/);
  const req = hybridPlanRequest({ topic: "x", board: true }), off = hybridPlanRequest({ topic: "x" });
  assert.equal(req.system[1], plan);
  assert.equal(off.system[1], HYBRID_PLAN_SYSTEM);
  assert.equal(hybridLinesRequest({ plan: {}, topic: "x", board: true }).system[1], lines);
  // the plan says its kit world and what it moved; the look is one of the 5
  const schema = hybridPlanSchema({ board: true });
  assert.deepEqual(schema.properties.world.properties.creature_look.enum, [...BOARD_KIT.creatures.map((c) => c.id), "none"]);
  assert.ok(schema.required.includes("moved"));
  assert.ok(!hybridPlanSchema().properties.world, "off: the schema is unchanged");
  const card = planCard({ rule_visual: { parameter: "p" }, ally: { line: "x" }, world: { places: ["street"], creature_look: "grin", animals: [], weather: [] }, moved: "the cave became our street at night" }, "a cave town");
  assert.equal(card.world.creature_look, "grin");
  assert.equal(card.moved, "the cave became our street at night");
});

test("writeHybrid passes the board switch and the move note to the plan and the lines (fakes)", async () => {
  const seen = {};
  const steps = {
    writeHybridPlan: async (a) => { seen.plan = a; return { plan: { beats: [] }, card: { topic: "t" }, notes: [], costUsd: 0 }; },
    writeHybridLines: async (a) => { seen.lines = a; return { script: S("In this town, nobody whistles after dark.", ...filler(9)), skeleton: {}, costUsd: 0 }; },
    judgeScript: async () => ({ verdict: { score: 70 }, costUsd: 0 }),
  };
  await writeHybrid({ topic: "t", steps, board: true, note: "Move the story into the world we can film" });
  assert.equal(seen.plan.board, true);
  assert.equal(seen.plan.note, "Move the story into the world we can film");
  assert.equal(seen.lines.board, true);
  await writeHybrid({ topic: "t", steps });
  assert.equal(seen.plan.board, undefined, "off: the call is as before");
  assert.equal(seen.plan.note, undefined);
});

test("the free kit check blocks in the hybrid checks, draftCheck (written, own, hybrid) only in launch mode", () => {
  const card = { topic: "a cave town" };
  assert.ok(hybridChecks({ script: CAVE, card: null, lengthSec: 30, board: true }).hard.some((p) => p.startsWith(PREMISE_PREFIX)));
  assert.ok(!hybridChecks({ script: CAVE, card: null, lengthSec: 30 }).hard.some((p) => p.startsWith(PREMISE_PREFIX)));
  for (const kind of ["written", "own", "hybrid"]) {
    assert.ok(draftCheck(FOG, 30, kind, kind === "hybrid" ? card : null, { board: true }).problems.some((p) => p.startsWith(`${BOARD_PREFIX} "fog"`)), kind);
    assert.ok(!draftCheck(FOG, 30, kind, kind === "hybrid" ? card : null).problems.some((p) => p.startsWith(BOARD_PREFIX)), `${kind} off`);
  }
  // the endpoint re-checks with the switch at quote / start (before the charge) and passes it to every writer
  const src = readFileSync(new URL("../supabase/functions/blocky-worlds-api/index.ts", import.meta.url), "utf8");
  assert.match(src, /draftCheck\(script, lengthSec, kindOf\(d\), PROVIDER === "mock" \? null : d\.card \?\? null, \{ board: LAUNCH_BOARD \}\)/);
  for (const fn of ["writeTopicIdeas", "writeIdeas", "writeHybrid", "rewriteHybrid", "writeScript", "fixPart"]) assert.ok(src.split("\n").some((l) => l.includes(`${fn}({`) && l.includes("board: LAUNCH_BOARD")), fn);
  assert.match(src, /const move = action === "rewrite" && body\?\.move === true;/);
});

test("where the problems sit: a line miss is Fix it on its part, a premise miss is 'move'", () => {
  const fog = draftCheck(FOG, 30, "own", null, { board: true }).problems;
  const spot = problemSpots(FOG, fog).find((s) => s.problem.startsWith(BOARD_PREFIX));
  assert.equal(spot.fix, "part");
  assert.equal(spot.part, "tour");
  assert.deepEqual(spot.lines, [1]);
  const cave = draftCheck(CAVE, 30, "own", null, { board: true }).problems;
  const move = problemSpots(CAVE, cave).find((s) => s.problem.startsWith(PREMISE_PREFIX));
  assert.deepEqual([move.fix, move.part, move.lines], ["move", null, []]);
});

test("Fix it on a line miss (free mock fixer): one part at a time, the other parts word for word, then the kit problem is gone", async () => {
  const fixOnce = async (script) => {
    const before = draftCheck(script, 30, "own", null, { board: true }).problems;
    const spot = problemSpots(script, before).find((s) => s.fix === "part" && s.problem.startsWith(BOARD_PREFIX));
    const same = problemSpots(script, before).filter((s) => s.fix === "part" && s.part === spot.part);
    const r = await fixPart({ provider: "mock", script, indexes: same.flatMap((s) => s.lines), reasons: same.map((s) => s.problem), lengthSec: 30, kind: "own", board: true });
    return { spot, r };
  };
  // "fog" in the tour (line 2) and the climax (line 10): the first Fix it is on the tour, the climax is untouched
  const one = await fixOnce(FOG);
  assert.equal(one.spot.part, "tour");
  assert.deepEqual(one.r.script.lines.slice(4).map((l) => l.text), FOG.lines.slice(4).map((l) => l.text), "the other parts are word for word");
  assert.ok(!/fog/i.test(one.r.script.lines[1].text));
  // the one left is now on the climax (its last line: a must-have); Fix it there and the script is clean
  const two = await fixOnce(one.r.script);
  assert.equal(two.spot.part, "climax");
  assert.ok(!draftCheck(two.r.script, 30, "own", null, { board: true }).problems.some((p) => p.startsWith(BOARD_PREFIX)));
});
