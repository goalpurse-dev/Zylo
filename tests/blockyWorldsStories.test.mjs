// Blocky Worlds: the story overhaul of 2026-11-14: never reuse the examples' pieces + fresh names + the used-names log, plant and
// payoff, the two story styles (funny chaos / dark twist), speakers on dialogue lines, the judge's 8 criteria and the idea engine
// (a pool of ~40, near-duplicates rejected, the log of ideas given out). All free: pure helpers and fakes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BANNED_CONCEPTS, BANNED_NAMES, FRESH_NAMES, bannedConcepts, bannedNamesIn, bannedProblems, freshNames, freshNamesBlock, namesUsedBy } from "../supabase/functions/_shared/blockyWorlds/bans.js";
import { lineOfQuote, plantPayoffProblems, plantPayoffTable } from "../supabase/functions/_shared/blockyWorlds/plantPayoff.js";
import { DARK_BEATS, DARK_PART, DARK_TEXT, darkLinesSchema, darkPlanSchema, darkProblems, darkWithParts } from "../supabase/functions/_shared/blockyWorlds/dark.js";
import { CRITERIA_IDS, STORY_JUDGE_SYSTEM } from "../supabase/functions/_shared/blockyWorlds/storyJudge.js";
import { IDEA_POOL_SYSTEM, POOL_SIZE, cardFromPoolIdea, defaultCorpus, filterIdeas, ideaJudgeSchema, ideaKey, readIdeaScores, topIdeas } from "../supabase/functions/_shared/blockyWorlds/ideaEngine.js";
import { writeDark, writeIdeaPool } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { normalizeScript } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { namedCharacters, FORMULA_TEXT } from "../supabase/functions/_shared/blockyWorlds/formula.js";
import { REFERENCE_TEXTS } from "../supabase/functions/_shared/blockyWorlds/referenceTexts.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../supabase/functions/_shared/blockyWorlds/examples.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const L = (...texts) => texts.map((text) => ({ text }));

test("bans: the examples' pieces (sneezing, cat allergy, pepper, teleporting, laughing floats, face-wearing monsters, spy and wall, radio to mom) fail; the topic's own words are exempt", () => {
  const cases = {
    sneezing: "Every sneeze makes the plane jump.", "cat allergy": "I'm allergic to the cat.", pepper: "A pepper jar fell.", teleporting: "Sneezing teleports you.",
    "laughing floats": "When you laugh you float up.", "face-wearing monsters": "At the door they take off their faces and hang them on hooks.",
    "spy behind the wall": "They sent me as a spy.", "radio to mom": "Every night I radio my mom.", "hunters and cage": "The hunters come back with a cage.",
  };
  for (const [id, text] of Object.entries(cases)) assert.ok(bannedConcepts(L(text)).some((c) => c.id === id), `${id}: ${text}`);
  assert.deepEqual(bannedConcepts(L("The plane hummed. Seat belts clicked.")), []);
  assert.deepEqual(bannedConcepts(L("Every sneeze makes the plane jump."), "In this town, sneezing is a sport."), [], "the customer's own topic may sneeze");
  const p = bannedProblems({ lines: L("Opening.", "Mrs. Pell sneezed. Achoo!") });
  assert.equal(p.length, 2);
  assert.match(p.join("\n"), /reuses a piece of the examples \(sneezing/);
  assert.match(p.join("\n"), /reuses character names .*pell/);
  assert.ok(BANNED_CONCEPTS.length >= 15);
});

test("bans: every character name of the references, the examples and the library fixture is on the banned list", () => {
  const texts = [...Object.values(REFERENCE_TEXTS), ...EXAMPLE_SCRIPT.lines.map((l) => l.text), ...EXAMPLE_IDEAS.flatMap((i) => [i.opener, i.narrator, ...(i.examples ?? [])])];
  const fixture = JSON.parse(read("src/components/viral-tools/blocky-worlds/dev/libraryFixture.json"));
  for (const row of fixture) texts.push(row.idea?.opener ?? "", row.idea?.narrator ?? "", ...(row.idea?.examples ?? []));
  const found = new Set();
  for (const t of texts) for (const m of String(t).matchAll(/\b(?:Mr|Mrs|Ms|Miss|Dr|Captain|Coach|Grandpa|Grandma|Aunt|Uncle)\.?\s+([A-Z][a-z]+)/g)) found.add(m[1].toLowerCase());
  const missing = [...found].filter((n) => !BANNED_NAMES.includes(n));
  // titled surnames of the library are too many to hold by hand: the list must hold the ones the owner named and the kit's
  for (const n of ["pell", "dorran", "hollis", "fenwick", "wim", "nell", "quibble", "huxworth", "pickle", "whiskers", "gus", "leo", "ames", "jude"]) assert.ok(BANNED_NAMES.includes(n), n);
  assert.ok(missing.length < 40, `the library has ${missing.length} more titled names; they are caught by the library near-duplicate check, not the name list`);
});

test("fresh names: deterministic per seed, never banned, never in the used-names log, four per story", () => {
  const a = freshNames({ n: 4, seed: "plane" }), b = freshNames({ n: 4, seed: "plane" }), c = freshNames({ n: 4, seed: "tower" });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(new Set(a).size, 4);
  for (const n of a) { assert.ok(FRESH_NAMES.includes(n)); assert.ok(!BANNED_NAMES.includes(n.toLowerCase())); }
  const used = a.slice(0, 2);
  const d = freshNames({ n: 4, seed: "plane", used });
  for (const n of used) assert.ok(!d.includes(n), `${n} was used already`);
  assert.match(freshNamesBlock(a), new RegExp(a[0]));
  assert.ok(FRESH_NAMES.every((n) => !BANNED_NAMES.includes(n.toLowerCase())));
  assert.deepEqual(namesUsedBy(["Mrs. Lumi waved.", `Then ${FRESH_NAMES[0]} left.`]).sort(), ["lumi", FRESH_NAMES[0].toLowerCase()].sort());
});

test("names: titles and mid-sentence capitals count, sentence starts and sound words do not (max 3 + me)", () => {
  const n = namedCharacters("Cake hit the ceiling. Mrs. Lumi laughed. Captain Brook waved. Then there's me, Kestrel. Bang! Grandpa Wren came.");
  assert.deepEqual([...n].sort(), ["brook", "kestrel", "lumi", "wren"]);
});

test("plant and payoff: setups are found by meaning, in order; unpaid ones and fewer than 3 in the ending are flagged for Fix it", () => {
  const lines = L("I hid a red button.", "Mom taught me to count to nine.", "A kind old dog slept on my porch.", "The clock struck ten.", "Rain fell on the roof.", "Nothing happened for a week.", "I counted to nine.", "The dog barked at the door.", "I pressed the red button.", "The roof leaked.");
  const script = { lines };
  const setups = [
    { what: "the red button", plant: "I hid a red button", payoff: "I pressed the red button" },
    { what: "counting to nine", plant: "taught me to count to nine", payoff: "I counted to nine" },
    { what: "the dog", plant: "kind old dog slept on my porch", payoff: "The dog barked at the door" },
    { what: "the clock", plant: "The clock struck ten", payoff: "The clock struck eleven" },
  ];
  const t = plantPayoffTable(script, setups);
  assert.deepEqual(t.map((x) => x.paid), [true, true, true, false]);
  assert.deepEqual(t.map((x) => x.inEnding), [true, false, true, false], "line 7 of 10 is before the last 30%");
  const p = plantPayoffProblems(script, setups);
  assert.equal(p.length, 2);
  assert.ok(p.some((x) => /the setup "the clock" never pays off/.test(x)));
  assert.ok(p.some((x) => /only 2 setups return in the ending/.test(x)), "counting to nine pays off before the last 30%");
  assert.match(p.find((x) => /clock/.test(x)), /\(line 4\)$/);
  assert.equal(lineOfQuote(lines, "no such words anywhere"), -1);
  // fewer than 3 returning in the ending
  const few = plantPayoffProblems(script, setups.slice(0, 2).concat([{ what: "roof", plant: "Rain fell on the roof", payoff: "Nothing happened for a week" }]));
  assert.ok(few.some((x) => /only 1 setup return in the ending/.test(x)), few.join("|"));
  assert.deepEqual(plantPayoffProblems(script, undefined), [], "no setups given: no note");
  assert.ok(plantPayoffProblems(script, setups.slice(0, 2)).some((x) => /lists only 2 setups/.test(x)));
});

// ---------- the dark twist style ----------
const DARK = [
  ["secret", "In this town, I'm the only one who keeps a candle lit."],
  ["rule", "You see, in this town, whoever sleeps in the light is taken."],
  ["details", "Every house has one window painted shut."], ["details", "The bakery sells bread with no crust."], ["details", "Dogs walk backwards at dusk."],
  ["rules", "My rules are simple. Never blink first. Never name the sleepers."],
  ["love", "Only Wren stayed kind to me."], ["love", "Wren left a wick on my step each morning."], ["love", "Wren patched my coat with blue thread."],
  ["clock", "The big bell rings in three nights."],
  ["gutpunch", "Then my sister's window went dark."], ["gutpunch", "I did not cry."],
  ["hope", "Wren took my hand. We ran for the old tower."], ["hope", "I told Wren where the last candles hide."],
  ["twist", "Wren lit every candle at once."], ["twist", "The blue thread was a map."], ["twist", "Every wick I got had been counted."],
  ["ending", "\"Goodnight, sweetheart,\" Wren whispered. \"Keep the light on.\""],
];
const darkScript = () => normalizeScript(darkWithParts({ title: "t", lines: DARK.map(([beat, text]) => ({ beat, text })), post: { title: "t" } }));

test("dark style: the beats, the parts, the prompt, the schemas (lines carry a speaker)", () => {
  assert.deepEqual([...DARK_BEATS], ["secret", "rule", "details", "rules", "love", "clock", "gutpunch", "hope", "twist", "ending"]);
  for (const b of DARK_BEATS) assert.ok(DARK_PART[b]);
  for (const bit of ["A SECRET + A DANGER", "slightly wrong", "ONE CHARACTER TO LOVE", "TICKING CLOCK", "GUT PUNCH", "FALSE HOPE", "HOLY TWIST", "CHILLING CALLBACK IN DIALOGUE", "FINAL IMAGE", "SETUPS AND PAYOFFS"]) assert.ok(DARK_TEXT.includes(bit), bit);
  assert.ok(darkPlanSchema().required.includes("setups") && darkPlanSchema().required.includes("loved"));
  assert.deepEqual(darkLinesSchema().properties.lines.items.required, ["beat", "text", "speaker"]);
  assert.ok(darkLinesSchema().properties.map.properties.setups);
  const s = darkScript();
  assert.equal(s.lines[0].part, "rule");
  assert.equal(s.lines.at(-1).part, "closer");
  assert.ok(s.lines.every((l) => l.beat));
});

test("dark style checks: the 'in this town' phrase in the first 2 sentences, banned pieces and soft endings are hard; dialogue at the end is advised", () => {
  const ok = darkProblems(darkScript(), 20, { topic: "" });
  assert.deepEqual(ok.hard.filter((x) => !/^Too (short|long)/.test(x)), [], JSON.stringify(ok.hard));
  const noTown = darkScript(); noTown.lines[0] = { ...noTown.lines[0], text: "I'm the only one who keeps a candle lit." }; noTown.lines[1] = { ...noTown.lines[1], text: "Sleeping in the light gets you taken." };
  assert.ok(darkProblems(noTown, 20).hard.some((x) => /must be said within the first 2 sentences/.test(x)));
  const banned = darkScript(); banned.lines[3] = { ...banned.lines[3], text: "Mrs. Pell sneezed in the bakery." };
  assert.ok(darkProblems(banned, 20).hard.some((x) => /reuses/.test(x)));
  const soft = darkScript(); soft.lines[soft.lines.length - 1] = { ...soft.lines.at(-1), text: "We learned that love and family keep us together." };
  assert.ok(darkProblems(soft, 20).hard.some((x) => /the ending is soft or abstract/.test(x)));
  assert.ok(darkProblems(soft, 20).advisory.some((x) => /DIALOGUE/.test(x)));
  assert.ok(darkProblems(darkScript(), 150).hard.some((x) => /^Too short/.test(x)), "a 150 s video needs ~640 words");
});

test("speakers: a line with dialogue carries its speaker through normalizeScript; none for the narrator", () => {
  const s = normalizeScript({ lines: [{ part: "rule", text: "In this town, x.", speaker: "" }, { part: "closer", text: "\"Keep the light on,\" Wren whispered.", speaker: "Wren" }] });
  assert.equal(s.lines[0].speaker, undefined);
  assert.equal(s.lines[1].speaker, "Wren");
  assert.match(DARK_TEXT + read("supabase/functions/_shared/blockyWorlds/dark.js"), /SPEAKERS/);
  assert.match(read("supabase/functions/_shared/blockyWorlds/hybrid.js"), /SPEAKERS/);
});

test("judge: eight criteria for both styles", () => {
  assert.deepEqual([...CRITERIA_IDS], ["hook", "rule", "examples", "stake", "plantpay", "twist", "lastline", "visible"]);
  assert.match(STORY_JUDGE_SYSTEM, /DARK TWIST/);
  assert.match(STORY_JUDGE_SYSTEM, /FUNNY CHAOS/);
  assert.ok(FORMULA_TEXT.includes("NEVER REUSE THE EXAMPLES"));
});

// ---------- the dark writer with fakes (no network) ----------
test("writeDark: plan, three versions, one judge call, the best kept, every version saved with text and scores", async () => {
  const realFetch = globalThis.fetch;
  const bodies = [];
  const plan = { title: "t", premise: "p", secret_line: DARK[0][1], rule: DARK[1][1], details: ["a", "b", "c"], hero_rules: ["x", "y"], loved: { name: "Wren", who: "w", kindnesses: ["k1", "k2", "k3"], secret_truth: "s" }, clock: "c", gut_punch: "g", false_hope: "f", twist: "t", last_line: "l", final_image: "i", names: ["Wren"], setups: [{ what: "w", plant_idea: "p", payoff_idea: "q" }], beats: [] };
  const lines = (drop) => ({ title: "t", lines: DARK.filter((_, i) => i !== drop).map(([beat, text]) => ({ beat, text, speaker: beat === "ending" ? "Wren" : "" })), post: { title: "t", description: "d", hashtags: ["a"] }, map: { setups: [{ what: "wick", plant: "Wren left a wick on my step", payoff: "Every wick I got had been counted" }, { what: "blue thread", plant: "Wren patched my coat with blue thread", payoff: "The blue thread was a map" }, { what: "candles", plant: "keeps a candle lit", payoff: "Wren lit every candle at once" }], loved_name: "Wren", twist_line: "x", last_line: "y" } });
  const judge = { versions: [1, 2, 3].map((v) => ({ version: v, hook: 5 + v, rule: 6, examples: 6, stake: 6, plantpay: 6, twist: 6 + v, lastline: 6, visible: 6, note: `n${v}` })), best: 3 };
  const answers = [plan, lines(-1), lines(2), lines(3), judge];
  globalThis.fetch = async (_u, init) => { bodies.push(JSON.parse(init.body)); const data = answers.shift(); return new Response(JSON.stringify({ model: "claude-sonnet-5-5", stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "text", text: JSON.stringify(data) }] }), { status: 200, headers: { "content-type": "application/json" } }); };
  let r;
  try { r = await writeDark({ apiKey: "k", topic: "In this town, the higher you live, the richer you are.", lengthSec: 20 }); } finally { globalThis.fetch = realFetch; }
  assert.equal(r.failure, undefined, JSON.stringify(r.failure));
  assert.equal(r.style, "dark");
  assert.equal(r.versions.length, 3);
  for (const v of r.versions) { assert.ok(v.script.lines.length > 5); for (const id of CRITERIA_IDS) assert.equal(typeof v.scores[id], "number"); assert.ok(v.setups.length === 3); }
  assert.equal(r.pick, 3, "version 3 has the highest score and passes the same checks");
  assert.equal(bodies.length, 5, "one plan, three versions, one judge");
  assert.equal(r.names.length, 4);
  assert.equal(r.script.lines.at(-1).speaker, "Wren");
});

// ---------- the idea engine ----------
const IDEAS = [
  { hook: "I just got my homework back from the moon!", rule: "In this town, homework you forget grows legs and walks home alone.", style: "funny", twist: "The class pet is the homework's teacher.", source: "school", visual: "a worksheet with sneakers" },
  { hook: "Nobody in this town has ever seen my shadow.", rule: "In this town, shadows are rented by the hour from the lamp man.", style: "dark", twist: "The lamp man's own shadow is the landlord.", source: "fears", visual: "a long coat of shadows on a hook" },
  { hook: "My whole street is holding its breath!", rule: "In this town, nobody may breathe out while the baker's bread is rising.", style: "funny", twist: "The bread is a giant lung.", source: "food", visual: "a street of puffed cheeks" },
];
test("idea engine: the pool prompt (Opus, ~40, every source, banned pieces), the filter rejects banned pieces and near-duplicates, cards carry hook / style / twist teaser", () => {
  assert.equal(POOL_SIZE, 40);
  for (const bit of ["everyday", "myths and fairy tales", "INSPIRED by movies, series and games", "Never use a real game", "NEVER REUSE THE EXAMPLES", "NEVER REUSE THESE"]) assert.ok(IDEA_POOL_SYSTEM.includes(bit) || IDEA_POOL_SYSTEM.toLowerCase().includes(bit.toLowerCase()), bit);
  const pool = [
    ...IDEAS,
    { hook: "x", rule: "In this town, sneezing makes you teleport.", style: "funny", twist: "t", source: "body", visual: "v" },
    { hook: "x", rule: "In this town, homework you forget grows legs and walks home alone!", style: "funny", twist: "t2", source: "school", visual: "v" },
    { hook: "x", rule: "Everyone here lives in a plane.", style: "funny", twist: "t", source: "x", visual: "v" },
    { hook: "x", rule: "In this town, every mirror owes you one wish and Mrs. Pell collects it.", style: "funny", twist: "t", source: "x", visual: "v" },
    { hook: "x", rule: "In this town, the richer you are, the higher your house is.", style: "funny", twist: "t", source: "x", visual: "v" },
  ];
  const { kept, rejected } = filterIdeas(pool, { corpus: defaultCorpus(), given: ["In this town, nobody may breathe out while bread is rising."] });
  assert.deepEqual(kept.map((x) => x.rule), [IDEAS[0].rule, IDEAS[1].rule], "the log of ideas given out removes the bread idea");
  const why = rejected.map((r) => r.why).join("|");
  assert.match(why, /sneezing/);
  assert.match(why, /near-duplicate of another idea in this pool/);
  assert.match(why, /must start with 'In this town, '/);
  assert.match(why, /banned name \(Pell\)/);
  assert.match(why, /near-duplicate of something we already have/, "the reference premise 'richer you are, the higher' is already ours");
  const card = cardFromPoolIdea(IDEAS[1]);
  assert.equal(card.hook, IDEAS[1].hook);
  assert.equal(card.style, "dark");
  assert.equal(card.twistTeaser, IDEAS[1].twist);
  assert.equal(card.mood, "horror");
  assert.equal(card.opener, IDEAS[1].rule);
  assert.equal(cardFromPoolIdea(IDEAS[0]).mood, "funny");
  assert.equal(ideaKey(IDEAS[0]), ideaKey({ rule: IDEAS[0].rule }));
});

test("idea engine: the judge's rows become totals; the best N (or the best 1 for 'AI can decide') are kept", () => {
  assert.deepEqual(ideaJudgeSchema().properties.scores.items.required, ["n", "hook", "rule", "visual", "twist", "fit", "fresh"]);
  const sc = readIdeaScores({ scores: [{ n: 2, hook: 9, rule: 9, visual: 9, twist: 9, fit: 9, fresh: 9 }, { n: 1, hook: 5, rule: 5, visual: 5, twist: 5, fit: 5, fresh: 5 }] }, 3);
  assert.equal(sc[1].total, 90);
  assert.equal(sc[0].total, 50);
  assert.equal(sc[2].total, 0);
  assert.deepEqual(topIdeas(IDEAS, sc, 2).map((x) => x.hook), [IDEAS[1].hook, IDEAS[0].hook]);
  assert.equal(topIdeas(IDEAS, sc, 1).length, 1);
});

test("writeIdeaPool (fakes): Opus pool, free filter, one judge call, the best N with cards; 'decide' keeps one", async () => {
  const calls = [];
  const steps = {
    pool: async (a) => { calls.push(a.model); return { data: { ideas: IDEAS }, costUsd: 0.1, usage: {} }; },
    judge: async (a) => { calls.push(a.model); return { data: { scores: [{ n: 1, hook: 5, rule: 5, visual: 5, twist: 5, fit: 5, fresh: 5 }, { n: 2, hook: 9, rule: 9, visual: 9, twist: 9, fit: 9, fresh: 9 }, { n: 3, hook: 7, rule: 7, visual: 7, twist: 7, fit: 7, fresh: 7 }] }, costUsd: 0.02, usage: {} }; },
  };
  const r = await writeIdeaPool({ count: 2, steps });
  assert.deepEqual(calls, ["claude-opus-5-5", "claude-sonnet-5-5"], "the best model for the pool, a judge after");
  assert.equal(r.pool, 3);
  assert.deepEqual(r.ideas.map((x) => x.hook), [IDEAS[1].hook, IDEAS[2].hook]);
  assert.ok(r.ideas.every((x) => x.card.hook && x.card.style && x.card.twistTeaser));
  assert.equal(r.costUsd, 0.12);
  assert.equal((await writeIdeaPool({ count: 1, steps })).ideas.length, 1);
  assert.equal((await writeIdeaPool({ count: 1, given: [IDEAS[0].rule, IDEAS[1].rule, IDEAS[2].rule], steps })).ideas.length, 0, "everything was given out: nothing to give");
});

test("wiring + migration: the ideas action uses the engine (Studio default, BLOCKY_WORLDS_IDEA_ENGINE), logs what it gives; the log tables are a migration, not applied", () => {
  const api = read("supabase/functions/blocky-worlds-api/index.ts");
  assert.match(api, /const IDEA_ENGINE = \(flag\("BLOCKY_WORLDS_IDEA_ENGINE"\) === "on" \|\| \(STUDIO_ON && flag\("BLOCKY_WORLDS_IDEA_ENGINE"\) !== "off"\)\) && PROVIDER === "anthropic"/);
  assert.match(api, /if \(IDEA_ENGINE && topic == null\)/);
  assert.match(api, /count: decideOne \? 1 : IDEAS_PER_BATCH/);
  assert.match(api, /from\("blocky_worlds_idea_log"\)\.upsert\(/);
  const sql = read("supabase/migrations/20261215100000_blocky_worlds_idea_name_log.sql");
  assert.match(sql, /NOT APPLIED/);
  for (const bit of ["blocky_worlds_idea_log", "rule_key text NOT NULL UNIQUE", "blocky_worlds_name_log", "ENABLE ROW LEVEL SECURITY", "blocky_worlds_log_names"]) assert.ok(sql.includes(bit), bit);
});

test("2026-11-14 run lessons: 'float up' rules are banned (the kit's laughing-floats), a chilling smile or a warm coin is no soft ending", () => {
  assert.ok(bannedConcepts(L("Then you float up until someone pulls you down.")).length === 1);
  assert.equal(bannedConcepts(L("The cloud floated away. So did his boots.")).length, 0);
  const s = { lines: L("In this town, I'm the only kid afraid to go up.", "You see, in this town, higher up means richer.", "a", "b", "c", "d", "e", "f", "A warm coin fell on the empty street.", "Grandma stood inside, smiling.", "\"Stand tall for me, Jasper.\"") };
  assert.ok(!darkProblems(s, 20).hard.some((x) => /the ending is soft/.test(x)));
});
