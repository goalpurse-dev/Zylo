// Blocky Worlds: the STORY FORMULA (owner, 2026-11-12): "In this town, [rule]." -> a result-first hook inside 5 s -> 2-3
// vignettes in their own places -> a "But..." pivot with a number -> an escalation that doubles, short sentences, sound
// words -> "Then I noticed something" -> a 2-6 word button; ~4.3 words a second. All free: pure helpers.
import test from "node:test";
import assert from "node:assert/strict";
import { FORMULA, FORMULA_PREFIX, FORMULA_TEXT, biggestNumber, formulaLines, formulaProblems, hasNumber, soundCues } from "../supabase/functions/_shared/blockyWorlds/formula.js";
import { SOUND_WORDS, sfxTags } from "../supabase/functions/_shared/blockyWorlds/sfxTags.js";
import { normalizeScript, wordCount } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { BEAT_PART, BEAT_SHEET_TEXT, beatBudgets } from "../supabase/functions/_shared/blockyWorlds/beatSheet.js";
import { HYBRID_LINES_SYSTEM, HYBRID_PLAN_SYSTEM, hybridChecks, hybridPlanSchema, planText } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";
import { problemSpots } from "../supabase/functions/_shared/blockyWorlds/protocol.js";
import { PACE, targetWords } from "../supabase/functions/_shared/blockyWorlds/config.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
// our own test story (a keyhole town), ~370 words: every formula part present
const RAW = [
  ["rule", "In this town, you must never knock on a door after sunset."],
  ["origin", "And right now I'm hanging from a chimney, screaming at a goat!"],
  ["origin", "You see, every door in town remembers who knocked."],
  ["neighbours", "Mrs. Dobb hides in her kitchen and answers through the letterbox."],
  ["neighbours", "Mr. Fitch sleeps in his garage, behind eleven locks."],
  ["neighbours", "Old Tamsin sells soup in the market and never opens the hatch."],
  ["me", "But I live in a house with fifty doors."],
  ["me", "Then there's me, Pip, the clumsiest knocker in town."],
  ["ally", "My aunt Bea caught me tapping on a wall."],
  ["ally", "She said, \"A door only hears what you say twice.\""],
  ["trigger", "Then one sunset the wind blew my door open."],
  ["trigger", "Knock. Knock. Something knocked back."],
  ["trigger", "One door rattled. Then ten. Then a hundred!"],
  ["adults", "Mr. Fitch bolted his garage. Bang! Bang!"],
  ["adults", "The doors laughed at his locks."],
  ["adults", "Mrs. Dobb stuffed her letterbox with socks."],
  ["adults", "Pop! The socks flew out."],
  ["adults", "Old Tamsin threw soup at the hatch."],
  ["adults", "Splat! The hatch opened anyway."],
  ["adults", "Two hundred doors rattled at once."],
  ["adults", "Thud! The whole street shook."],
  ["adults", "Every goat on the roofs started to scream."],
  ["save", "Then I noticed something."],
  ["save", "A door only hears what you say twice."],
  ["save", "So I knocked twice on the biggest door."],
  ["save", "Knock. Knock."],
  ["save", "Then I said, \"Goodnight.\" Twice."],
  ["save", "Goodnight. Goodnight."],
  ["save", "Every door sighed and went quiet."],
  ["save", "The goats stopped screaming."],
  ["save", "The street was so still I heard a snail."],
  ["save", "Nobody knocked. Nobody was knocked at."],
  ["callback", "Aunt Bea's door? Still knocking."],
];
const SCRIPT = normalizeScript({ title: "t", lines: RAW.map(([beat, text]) => ({ beat, part: BEAT_PART[beat], text })) });
const edit = (fn) => { const s = clone(SCRIPT); fn(s.lines); return s; };
const text = (s, re) => formulaProblems(s, 90).filter((p) => re.test(p));

test("pace: ~4.3 words a second, a 1:30 video is ~385 words, ~70 words in the first 15 s", () => {
  assert.equal(PACE.targetWpm, 257);
  assert.ok(Math.abs(targetWords(90) - 385) <= 2);
  assert.ok(Math.abs(FORMULA.wordsPerSec - 4.3) < 0.05);
  assert.ok(Math.abs(FORMULA.wordsPerSec * 15 - 70) < 8);
  // the budgets add up inside the band for every length
  for (const len of [30, 60, 90, 120, 180]) assert.ok(beatBudgets(len).reduce((a, b) => a + b.words, 0) <= targetWords(len), `${len}`);
});

test("sound words: only short fragments are tagged, normalizeScript fills line.sfx from the text", () => {
  assert.deepEqual(sfxTags("Boom! The door flew open."), ["boom"]);
  assert.deepEqual(sfxTags("Knock. Knock."), ["knock", "knock"]);
  assert.deepEqual(sfxTags("Crash, bang, thud!"), ["crash", "bang", "thud"]);
  assert.deepEqual(sfxTags("Creeeak."), ["creak"]);
  assert.deepEqual(sfxTags("I heard a knock at the door."), [], "an ordinary word in a longer sentence is no sound cue");
  assert.deepEqual(sfxTags("Nothing here."), []);
  assert.ok(SOUND_WORDS.every((w) => /^[a-z]+$/.test(w)));
  const s = normalizeScript({ lines: [{ part: "rule", text: "In this town, x." }, { part: "tour", text: "Poof! Gone." }, { part: "tour", text: "Just words." }] });
  assert.deepEqual(s.lines[1].sfx, ["poof"]);
  assert.ok(!("sfx" in s.lines[2]), "a line without sound words has no sfx key");
  // an edited line is re-tagged from its new text
  assert.deepEqual(normalizeScript({ lines: [{ part: "tour", text: "Bang. Bang.", sfx: ["stale"] }] }).lines[0].sfx, ["bang", "bang"]);
  assert.ok(soundCues(SCRIPT).length >= 8);
  assert.deepEqual(soundCues(SCRIPT).slice(0, 2).map((c) => c.word), ["knock", "knock"]);
});

test("numbers: digits and number words count; the biggest one is read", () => {
  assert.ok(hasNumber("ten minutes") && hasNumber("zero curtains") && hasNumber("4 stairs") && !hasNumber("many stairs"));
  assert.equal(biggestNumber("Two houses. Then twenty. Then two hundred!"), 200);
  assert.equal(biggestNumber("a thousand windows"), 1000);
  assert.equal(biggestNumber("1,200 runners"), 1200);
  assert.equal(biggestNumber("nobody"), 0);
});

test("formula: a script that does every part has no note", () => {
  assert.deepEqual(formulaProblems(SCRIPT, 90), []);
  assert.deepEqual(formulaProblems({ lines: [] }, 90), [], "too short to judge");
});

test("formula: the hook (line 2): first person, an exclamation, inside the first 5 seconds", () => {
  assert.equal(text(edit((l) => { l[1].text = "The goats screamed at the chimney."; }), /no result-first hook/).length, 1);
  assert.equal(text(edit((l) => { l[1].text = "Is that a goat on the chimney?"; }), /no result-first hook/).length, 1);
  // a long opener pushes the hook past 6 s
  const late = text(edit((l) => { l[0].text = "In this town, you must never knock on any door at all after the sun has gone down for the night."; }), /hook comes too late/);
  assert.equal(late.length, 1);
  assert.match(late[0], /\(line 2\)$/);
  assert.equal(text(edit((l) => { l[1].text = "And right now I'm hanging from a chimney far above the whole sleepy town, screaming at a goat!"; }), /hook is \d+ words/).length, 1);
});

test("formula: the 'But' pivot: present, with a number, about 15 s in", () => {
  assert.equal(text(edit((l) => { l[6].text = "I live in a house with fifty doors."; }), /no "But\.\.\." pivot/).length, 1);
  assert.equal(text(edit((l) => { l[6].text = "But I live in a house with so many doors."; }), /no number/).length, 1);
  assert.equal(text(edit((l) => { l.splice(2, 0, ...Array.from({ length: 5 }, () => ({ ...l[2], text: "The doors here are very old and very quiet at night." }))); }), /pivot comes after/).length, 1);
});

test("formula: the vignettes need their own places", () => {
  const same = edit((l) => { l[3].text = "Mrs. Dobb hides in her kitchen and answers through the letterbox."; l[4].text = "Mr. Fitch sleeps in his kitchen, behind eleven locks."; l[5].text = "Old Tamsin sells soup from her kitchen and never opens the hatch."; });
  const p = text(same, /OWN places/);
  assert.equal(p.length, 1);
  assert.match(p[0], /\(lines 4, 5, 6\)$/);
});

test("formula: the escalation: short sentences, a sound word every 12 s, numbers that grow", () => {
  assert.equal(text(edit((l) => { l[13].text = "Mr. Fitch bolted his garage door with every single lock he owned and then some more locks too."; }), /short sentences/).length, 1);
  const quiet = edit((l) => { l.forEach((x) => { if (x.beat === "adults" || x.beat === "trigger") { x.text = x.text.replace(/\b(Bang|Pop|Splat|Thud|Knock)[.!]/g, "Oh."); delete x.sfx; } }); });
  assert.equal(text(quiet, /sound word/).length, 1);
  const flat = edit((l) => { l[12].text = "One door rattled. Then one. Then one."; l[17].text = "One bowl of soup flew."; l[19].text = "One door rattled at once."; });
  assert.equal(text(flat, /numbers .* do not grow/).length, 1);
});

test("formula: 'Then I noticed something' and the 2 to 6 word button", () => {
  assert.equal(text(edit((l) => { l[22].text = "Then I remembered the rule."; }), /Then I noticed something/).length, 1);
  assert.equal(text(edit((l) => { l[32].text = "Aunt Bea's door is still knocking on everybody else's house tonight."; }), /button/).length, 1);
  assert.equal(text(edit((l) => { l[32].text = "Still knocking."; }), /button/).length, 0);
  assert.equal(text(edit((l) => { l[32].text = "Knocking."; }), /button/).length, 1);
});

test("formula notes ride the existing checks: advisory (the button is HARD), and Fix it finds their lines", () => {
  const bad = edit((l) => { l[1].text = "The goats screamed at the chimney."; l[32].text = "Aunt Bea's door is still knocking on everybody else's house tonight."; });
  const c = hybridChecks({ script: bad, skeleton: {}, card: null, examples: [], lengthSec: 90 });
  const notes = c.advisory.filter((x) => x.startsWith(FORMULA_PREFIX));
  assert.equal(notes.length, 1, "the hook note is advisory");
  const hard = c.hard.filter((x) => x.startsWith(FORMULA_PREFIX));
  assert.equal(hard.length, 1, "the button length is hard");
  assert.match(hard[0], /the button must be 2 to 6 words/);
  const spots = problemSpots(bad, [...notes, ...hard]);
  assert.deepEqual(spots.map((s) => [s.part, s.fix, s.lines]), [["tour", "part", [1]], ["closer", "part", [32]]]);
  assert.deepEqual(formulaLines("Formula: x (lines 9, 10)"), [8, 9]);
  assert.deepEqual(formulaLines("Formula: no lines here"), []);
  // a note without lines goes to the whole-script rewrite
  assert.equal(problemSpots(SCRIPT, [`${FORMULA_PREFIX} there is no "But..." pivot line.`])[0].fix, "rewrite");
});

test("prompts: both writers carry the formula, the plan asks for the hook, places, pivot and button", () => {
  for (const sys of [HYBRID_PLAN_SYSTEM, HYBRID_LINES_SYSTEM]) {
    assert.ok(sys.includes(FORMULA_TEXT), "the formula text");
    assert.match(sys, /In this town, /);
    assert.match(sys, /RESULT-FIRST HOOK/);
    assert.match(sys, /Then I noticed something/);
  }
  assert.ok(BEAT_SHEET_TEXT.includes("SOUND WORD"));
  assert.match(HYBRID_PLAN_SYSTEM, /2 to 6 word BUTTON/);
  assert.match(HYBRID_LINES_SYSTEM, /Line two is the RESULT-FIRST HOOK/);
  assert.doesNotMatch(HYBRID_LINES_SYSTEM, /Line two usually starts "You see,"/);
  const props = hybridPlanSchema().properties;
  assert.ok(props.hook && props.pivot);
  assert.ok(props.neighbours.items.properties.place);
  assert.match(planText({ ally: { name: "A", who: "w", line: "l" }, hook: "I fell!", pivot: "But I had ten.", neighbours: [{ name: "Mr. X", joke: "j", shows: "s", place: "kitchen" }], beats: [] }), /RESULT-FIRST HOOK[\s\S]*I fell![\s\S]*"BUT" PIVOT[\s\S]*place: kitchen/);
  assert.equal(wordCount("In this town, a b."), 5);
});

test("result screen: a small tip names the TikTok sound 'Numbers' by TEMPOREX", async () => {
  const { readFileSync } = await import("node:fs");
  const panel = readFileSync(new URL("../src/components/viral-tools/blocky-worlds/ResultPanel.jsx", import.meta.url), "utf8");
  assert.match(panel, /data-testid="bw-sound-tip">Tip: add &lsquo;Numbers&rsquo; by TEMPOREX in TikTok when you post\.<\/p>/);
});

// ---------- the sound library: the writer may only use sound words we have a sound for ----------
import { SOUND_ALLOWED, SOUND_NEAR } from "../supabase/functions/_shared/blockyWorlds/soundLibrary.js";
import { mapNearSounds } from "../supabase/functions/_shared/blockyWorlds/sfxTags.js";

test("sound library: the server list mirrors the engine's SOUND_SFX (only the sounds being added may differ)", async () => {
  const { SOUND_SFX } = await import("../scripts/blockyWorlds/engine/lib/audioPlan.js");
  const engine = Object.keys(SOUND_SFX);
  const BEING_ADDED = ["beep", "buzz", "hiss", "fizz", "boing", "squeak", "poof"]; // delete a word here once the engine has it
  for (const w of engine) assert.ok(SOUND_ALLOWED.includes(w), `the engine has a sound for "${w}": add it to soundLibrary.js SOUND_ALLOWED`);
  for (const w of SOUND_ALLOWED) assert.ok(engine.includes(w) || BEING_ADDED.includes(w), `"${w}" is allowed but the engine has no sound for it`);
  assert.equal(new Set(SOUND_ALLOWED).size, SOUND_ALLOWED.length);
  for (const [from, to] of Object.entries(SOUND_NEAR)) assert.ok(SOUND_ALLOWED.includes(to), `${from} -> ${to} must land on an allowed sound`);
  // the animal and eating sounds wait for the owner's OK
  for (const w of ["meow", "woof", "moo", "quack", "oink", "ribbit", "gulp", "munch", "slurp"]) assert.ok(!SOUND_ALLOWED.includes(w), w);
});

test("sound library: near-misses are mapped, other off-list sound words are flagged for Fix it, the prompt lists the allowed words", () => {
  assert.equal(mapNearSounds("Bam! The door flew open."), "Bang! The door flew open.");
  assert.equal(mapNearSounds("Thunk. Thunk."), "Thud. Thud.");
  assert.equal(mapNearSounds("I thought bam was a funny word."), "I thought bam was a funny word.", "long sentences are left alone");
  assert.deepEqual(normalizeScript({ lines: [{ part: "tour", text: "Bam! Whiz!" }] }).lines[0].sfx, ["bang", "whoosh"]);
  const withMeow = edit((l) => { l[13].text = "Mr. Fitch bolted his garage. Meow!"; });
  const p = text(withMeow, /no sound in our library/);
  assert.equal(p.length, 1);
  assert.match(p[0], /meow/);
  assert.match(p[0], /\(line 14\)$/);
  assert.equal(problemSpots(withMeow, p)[0].fix, "part");
  for (const w of SOUND_ALLOWED) assert.ok(FORMULA_TEXT.includes(w), w);
  assert.ok(!FORMULA_TEXT.includes("slurp"));
});

// ---------- the callback button is hard, with a free fallback; sounds fit their objects; kitCheck sees escalation props ----------
import { buttonFallback, buttonProblems, soundObjectProblems } from "../supabase/functions/_shared/blockyWorlds/formula.js";
import { partFixPrompt } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { fixPart } from "../supabase/functions/_shared/blockyWorlds/llm.js";

test("button: 2 to 6 words AND a call back to the rule or the hook, hard in the hybrid writer", () => {
  assert.deepEqual(buttonProblems(SCRIPT), []);
  const dogs = edit((l) => { l[0].text = "In this town, the dogs walk us."; l[1].text = "And right now I'm being dragged by a huge dog!"; l[32].text = "Now Big Moss walks with me, and the dogs walk no one."; });
  assert.equal(buttonProblems(dogs).length, 1, "11 words: too long");
  const noEcho = edit((l) => { l[32].text = "Sit, Big Moss. Good boy."; });
  assert.match(buttonProblems(noEcho).join(), /does not call back the rule or the hook/);
  assert.equal(buttonProblems(edit((l) => { l[1].text = "And right now I'm being dragged by a huge dog!"; l[32].text = "Sit, Big Moss. Good dog."; })).length, 0, "dog echoes the hook");
  const c = hybridChecks({ script: dogs, skeleton: {}, card: null, examples: [], lengthSec: 90 });
  assert.ok(c.hard.some((x) => /the button must be 2 to 6 words/.test(x)));
});

test("button fallback: the last short sentence becomes the button, preferring one that calls back the rule or hook", () => {
  const ctx = ["In this town, the dogs walk us.", "And right now I'm being dragged by a huge dog!", "You see, leashes go on people."];
  assert.deepEqual(buttonFallback(["Now Big Moss walks with me, and the dogs walk no one. Sit, Big Moss. Good boy."], ctx), ["Now Big Moss walks with me, and the dogs walk no one. Good boy."].flatMap(() => ["Now Big Moss walks with me, and the dogs walk no one. Sit, Big Moss.", "Good boy."]).slice(0, 2));
  // a sentence that echoes wins over a later one that does not
  assert.deepEqual(buttonFallback(["The street went quiet again tonight. The dogs walk no one. Good boy."], ctx), ["The street went quiet again tonight. Good boy.", "The dogs walk no one."]);
  assert.deepEqual(buttonFallback(["Short one."], ctx), ["Short one."], "already a button: untouched");
  assert.deepEqual(buttonFallback(["One long sentence that has no short sentence anywhere inside it at all."], ctx).length, 1);
});

test("fixPart: names the button length and target, and falls back to the split when the model misses (mock-free: stubbed fetch)", async () => {
  const lines = SCRIPT.lines;
  const p = partFixPrompt({ script: SCRIPT, indexes: [lines.length - 1], reasons: ["x"] });
  assert.match(p, /THE LAST LINE IS THE BUTTON: it must be 2 to 6 words/);
  assert.match(p, /call back the rule/);
  assert.doesNotMatch(partFixPrompt({ script: SCRIPT, indexes: [3], reasons: ["x"] }), /THE LAST LINE IS THE BUTTON/);
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ model: "claude-haiku-5-5", stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "text", text: JSON.stringify({ lines: ["Nobody knocked tonight, and every door stayed asleep. Good door."] }) }] }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const bad = edit((l) => { l[32].text = "Aunt Bea's door? It kept knocking on every house in town all night long."; });
    const r = await fixPart({ apiKey: "k", script: bad, indexes: [32], reasons: ["Formula: the last line is a 13-word line; the button must be 2 to 6 words"], card: null, lengthSec: 90 });
    assert.equal(r.script.lines.at(-1).text, "Good door.", "the split-off button");
    assert.ok(r.script.lines.at(-2).text.startsWith("Nobody knocked"));
  } finally { globalThis.fetch = real; }
});

test("sound fits its object: a whistle with a beep is flagged for Fix it; a door with a slam is fine", () => {
  const whistle = edit((l) => { l[13].text = "Coach Tamsin blew her whistle."; l[14].text = "Beep!"; });
  const p = soundObjectProblems(whistle);
  assert.equal(p.length, 1);
  assert.match(p[0], /"beep" does not fit the whistle/);
  assert.match(p[0], /\(line 15\)$/);
  assert.equal(problemSpots(whistle, p)[0].fix, "part");
  assert.deepEqual(soundObjectProblems(edit((l) => { l[13].text = "The door swung wide."; l[14].text = "Slam!"; })), []);
  assert.equal(soundObjectProblems(edit((l) => { l[13].text = "Glass everywhere."; l[14].text = "Beep!"; })).length, 1);
  assert.ok(text(whistle, /does not fit the whistle/).length === 1, "part of formulaProblems");
});

test("kitCheck is consulted for escalation lines: a prop the block world lacks, named there, is flagged in launch (board) mode", () => {
  const sword = edit((l) => { l[19].text = "A hundred swords hung on the wall."; });
  const c = hybridChecks({ script: sword, skeleton: {}, card: null, examples: [], lengthSec: 90, board: true });
  assert.ok([...c.hard, ...c.advisory].some((x) => /sword/i.test(x) && /can't show/.test(x)), JSON.stringify([...c.hard, ...c.advisory].filter((x) => /sword/i.test(x))));
});
