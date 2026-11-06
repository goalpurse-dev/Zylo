// Blocky Worlds: the script checks a listener would agree with, "Fix it" for one part, the rewrite that is told what
// failed, and the failed-video reasons (2026-11-05, from the owner's first real test).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nounKey, problemSpots, propProblems, propReference, propWords } from "../supabase/functions/_shared/blockyWorlds/protocol.js";
import { draftCheck, fixPart, scriptProtocolCheck, writeScript } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { normalizeScript, scriptPrompt } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../supabase/functions/_shared/blockyWorlds/examples.js";
import { failReason, FAIL_TEXT } from "../supabase/functions/_shared/blockyWorlds/contract.js";

// The owner's real draft (blocky_worlds_drafts 994303ef, "The Wolf Hunts Our Turtle", 90 s), read 2026-11-05. The climax's
// first line is put back the way the writer wrote it ("a strip", no "tape"); the owner had to type "Grandma's duct tape"
// into it before Make the video unlocked.
const card = { prop: "Grandma's roll of duct tape", closer: "Everyone inside the turtle has a sticker now, and mine still says ZERO." };
const L = (part, ...texts) => texts.map((text) => ({ part, text }));
const real = {
  title: "The Wolf Hunts Our Turtle",
  lines: [
    ...L("rule", "In this world, everyone inside our giant turtle has a shell-sticker, except me.", "Mine says ZERO."),
    ...L("tour", "You see, every sticker counts down the days.", "At zero, the wolf's soldiers carry you off to him.", "He's hunted our turtle for years.", "Mrs. Pocket sneezed in the bakery once.", "Her sticker dropped to nine.", "Now she sneezes into a pillow.", "Mr. Gorp hums on the stairs.", "He has four days left.", "Our mailman delivers by shell-slide.", "Always at a whisper.", "Last week he whispered a package into a pond."),
    ...L("me", "I'm Nell, and I'm the exception.", "My sticker's blank, so the soldiers can't count me.", "I live with Grandma.", "She fixes everything with duct tape.", "That night she handed me a fresh roll.", "Silver, with a little heart on it.", "She said, \"Save it for something big.\"", "I tucked it in my belt."),
    ...L("until", "Until one night, the whole turtle shook.", "Through the gate came the wolf's soldiers.", "Square helmets. Shiny boots. Zero smiles.", "They held up scanners. Beep. Beep.", "Mr. Gorp's sticker hit zero. He'd hummed once too often.", "They dragged him toward the dark tunnel.", "Outside, two huge yellow eyes peeked over the wall.", "Then the soldiers turned toward Grandma's house."),
    ...L("discovery", "I hid behind a barrel and found the wolf's order.", "A crumpled scroll with a big paw print.", "Soldiers take anyone whose sticker reads zero.", "They don't think. They read.", "I looked at Grandma's duct tape."),
    ...L("climax", "I tore off a strip and wrote ZERO.", "Then I ran.", "Slap slap slap, all down the line.", "The soldiers scanned each other.", "Beep. Zero. Beep. Zero.", "They dropped Mr. Gorp. He kept humming.", "Then the wolf stuck his giant nose through the gate.", "I jumped and slapped the last strip right on it.", "Beep. Zero.", "They picked him up like a sofa.", "Then they carried him off to the wolf.", "He's the wolf. It got confusing."),
    ...L("closer", "The whole town cheered in the bakery.", "Grandma gave everyone a fresh sticker.", "Everyone inside the turtle has a sticker now.", "And mine still says ZERO."),
  ],
  post: { title: "The Wolf Hunts Our Turtle", description: "", hashtags: [] },
};
const withClimax = (script, texts) => ({ ...script, lines: [...script.lines.filter((l) => l.part !== "climax" && l.part !== "closer"), ...L("climax", ...texts), ...script.lines.filter((l) => l.part === "closer")] });

test("checker: the real climax that says 'a strip' (of Grandma's duct tape, named the line before) passes", () => {
  assert.deepEqual(propProblems(card, real), []);
  // the owner's typed fix passes too, and so does the script as a whole at its 90 s
  const typed = { ...real, lines: real.lines.map((l) => (l.text === "I tore off a strip and wrote ZERO." ? { ...l, text: "I tore off a strip of Grandma's duct tape and wrote ZERO." } : l)) };
  assert.deepEqual(propProblems(card, typed), []);
  assert.deepEqual(scriptProtocolCheck(real, 90, card).problems.filter((p) => /pays off|never shown/.test(p)), []);
});

test("checker: clear references count: the head noun, any distinctive word, plural, possessive, a piece of it", () => {
  assert.deepEqual(propWords(card.prop), ["roll", "duct", "tape"]);
  const climax = (t) => propProblems(card, withClimax(real, [t, "Then I ran."]));
  for (const t of ["I grabbed the tape.", "I unrolled the roll.", "Two tapes. One plan.", "The tape's end was sticky.", "I tore a strip of it and wrote ZERO.", "I tore off a strip and wrote ZERO.", "One more strip, right on his nose.", "I slapped duct on every helmet."]) {
    assert.deepEqual(climax(t), [], t);
  }
  assert.equal(nounKey("tapes"), "tape");
  assert.equal(nounKey("boxes"), "box");
  assert.equal(nounKey("berries"), "berry");
  assert.equal(nounKey("glass"), "glass");
  assert.equal(nounKey("Grandma's"), "grandma");
});

test("checker: a climax that truly ignores the object still fails", () => {
  const ignores = withClimax(real, ["Then I ran.", "The soldiers scanned each other.", "They picked him up like a sofa.", "He's the wolf. It got confusing."]);
  assert.match(propProblems(card, ignores).join(), /never pays off/);
  // the owner on their own is not the object ("Grandma hugged me" pays nothing off)
  assert.match(propProblems(card, withClimax(real, ["Grandma hugged me.", "Then I ran."])).join(), /never pays off/);
  // a piece of something else is not the object
  assert.match(propProblems(card, withClimax(real, ["I ate a piece of cake.", "Then I ran."])).join(), /never pays off/);
  // a bare "a strip" for an object strips don't come from counts only straight after the object was named
  const whistle = { prop: "Grandpa's old brass whistle" };
  assert.equal(propReference(whistle.prop, "I tore off a strip."), "bare-piece");
  const lines = [...L("me", "In my pocket I keep Grandpa's old brass whistle."), ...L("discovery", "The Listener was coming.", "It was at the door."), ...L("climax", "I tore off a strip and ran.")];
  assert.match(propProblems(whistle, { lines }).join(), /never pays off/);
  assert.deepEqual(propProblems(whistle, { lines: [...lines.slice(0, 2), ...L("discovery", "I held the whistle tight."), ...lines.slice(3)] }), []);
});

test("checker: the set-up still accepts the owner's name next to the object (as before); short object names count", () => {
  const lines = [...L("me", "I live with Grandma.", "She saves everything."), ...L("climax", "I slapped the tape on.")];
  assert.deepEqual(propProblems(card, { lines }), []);
  // "key" (3 letters) used to be ignored, so the check never ran for "Dad's key"
  assert.match(propProblems({ prop: "Dad's key" }, { lines: [...L("me", "Dad gave me his key."), ...L("climax", "I ran.")] }).join(), /never pays off/);
  assert.deepEqual(propProblems({ prop: "Dad's key" }, { lines: [...L("me", "Dad gave me his key."), ...L("climax", "I turned the key.")] }), []);
});

test("spots: each problem sits on its part (or line); the rest are fixed by a rewrite", () => {
  const ignores = withClimax(real, ["Then I ran.", "They picked him up like a sofa."]);
  const problems = [...propProblems(card, ignores), "Line 3 has 18 words (keep it under 16): \"He's hunted...\"", "The first line must start with \"In this world, \" or \"In this town, \".", "Too short: 10 words, a 90 s video needs at least 300.", 'Uses "blood". Keep it PG: suggest the danger, never show or say gore.'];
  const withGore = { ...ignores, lines: ignores.lines.map((l, i) => (i === 5 ? { ...l, text: "There was blood on the stairs." } : l)) };
  const spots = problemSpots(withGore, problems);
  const climax = withGore.lines.map((l, i) => (l.part === "climax" ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(spots.map((s) => [s.part, s.fix]), [["climax", "part"], ["tour", "part"], ["rule", "opener"], [null, "rewrite"], ["tour", "part"]]);
  assert.deepEqual(spots[0].lines, climax);
  assert.deepEqual(spots[1].lines, [2]);
  assert.deepEqual(spots[4].lines, [5]);
});

// a fake Anthropic reply (the tests never reach the network)
const reply = (data, usage = { input_tokens: 1000, output_tokens: 200 }) => new Response(JSON.stringify({ model: "claude-haiku-5-5", stop_reason: "end_turn", usage, content: [{ type: "text", text: JSON.stringify(data) }] }), { status: 200 });
async function withFetch(answers, fn) {
  const real = globalThis.fetch, seen = [];
  globalThis.fetch = async (_url, init) => { seen.push(JSON.parse(init.body)); const next = answers.shift(); if (!next) throw new Error("no more answers"); return reply(next); };
  try { return { result: await fn(), seen }; } finally { globalThis.fetch = real; }
}

test("fixPart: only the flagged part is rewritten, every other line verbatim; the whole script re-checked", async () => {
  const blocked = withClimax(real, ["Then I ran.", "Slap slap slap, all down the line.", "They picked him up like a sofa.", "Then they carried him off to the wolf.", "He's the wolf. It got confusing."]);
  const before = scriptProtocolCheck(blocked, 90, card).problems;
  const spot = problemSpots(blocked, before).find((s) => s.part === "climax");
  assert.ok(spot, "the climax is flagged");
  const fixedLines = ["I tore a strip off Grandma's duct tape.", "I wrote ZERO on it.", "Then I ran.", "Slap slap slap, all down the line.", "They picked him up like a sofa.", "Then they carried him off to the wolf.", "He's the wolf. It got confusing."];
  const { result, seen } = await withFetch([{ lines: fixedLines }], () => fixPart({ apiKey: "k", script: blocked, indexes: spot.lines, reasons: [spot.problem], card, lengthSec: 90 }));
  assert.deepEqual(result.check.problems, []);
  assert.equal(result.fixed, true);
  assert.equal(result.attempts, 1);
  assert.ok(result.costUsd > 0, "the call's cost is returned for the log");
  assert.deepEqual(result.check.problems.filter((p) => /pays off/.test(p)), []);
  // every line outside the climax is exactly as it was
  const outside = (s) => s.lines.filter((l) => l.part !== "climax").map((l) => `${l.part}|${l.text}`);
  assert.deepEqual(outside(result.script), outside(blocked));
  // the prompt says exactly what failed and which lines to replace
  const user = seen[0].messages[0].content;
  assert.match(user, /WHY THEY FAILED[\s\S]*never pays off/);
  assert.match(user, />> \d+ \[climax\] Then I ran\./);
});

test("fixPart: a fix that still fails is retried once with what is still wrong; never reported as fixed", async () => {
  const blocked = withClimax(real, ["Then I ran.", "They picked him up like a sofa.", "He's the wolf. It got confusing."]);
  const spot = problemSpots(blocked, scriptProtocolCheck(blocked, 90, card).problems).find((s) => s.part === "climax");
  const still = { lines: ["Then I ran fast.", "They picked him up like a sofa.", "He's the wolf. It got confusing."] };
  const good = { lines: ["I slapped Grandma's tape on every helmet.", "They picked him up like a sofa.", "He's the wolf. It got confusing."] };
  const two = await withFetch([still, good], () => fixPart({ apiKey: "k", script: blocked, indexes: spot.lines, reasons: [spot.problem], card, lengthSec: 90 }));
  assert.equal(two.result.attempts, 2);
  assert.equal(two.result.fixed, true);
  assert.match(two.seen[1].messages[0].content, /never pays off/, "the retry is told what is still wrong");
  const never = await withFetch([still, still], () => fixPart({ apiKey: "k", script: blocked, indexes: spot.lines, reasons: [spot.problem], card, lengthSec: 90 }));
  assert.equal(never.result.fixed, false);
  assert.match(never.result.check.problems.join(), /never pays off/, "the problem is handed back, not hidden");
});

test("fixPart: never reaches past its own part, and the free mock fixes a blocked script", async () => {
  const listener = EXAMPLE_IDEAS[0], script = normalizeScript(EXAMPLE_SCRIPT);
  const blocked = { ...script, lines: script.lines.map((l) => (l.part === "climax" && /whistle/i.test(l.text) ? { ...l, text: "Then I did the only thing I could." } : l)) };
  const problems = scriptProtocolCheck(blocked, 100, listener).problems;
  const spot = problemSpots(blocked, problems).find((s) => s.part === "climax");
  // asked with lines from two parts, only the first part's run is rewritten
  const me = blocked.lines.findIndex((l) => l.part === "me");
  const r = await fixPart({ provider: "mock", script: blocked, indexes: [me, ...spot.lines], reasons: [spot.problem], card: listener, lengthSec: 100 });
  assert.deepEqual(r.script.lines.filter((l) => l.part === "climax").map((l) => l.text), blocked.lines.filter((l) => l.part === "climax").map((l) => l.text));
  const m = await fixPart({ provider: "mock", script: blocked, indexes: spot.lines, reasons: [spot.problem], card: listener, lengthSec: 100 });
  assert.equal(m.fixed, true);
  assert.equal(m.costUsd, 0);
  assert.deepEqual(draftCheck(m.script, 100, "written", listener).problems, []);
});

test("rewrite: the writer is told exactly which checks the current version failed", async () => {
  const failed = ["The climax never pays off Grandma's roll of duct tape: the hero should win with it (name it, or use a piece of it)."];
  const p = scriptPrompt({ idea: EXAMPLE_IDEAS[0], lengthSec: 90, previous: real, failed });
  assert.match(p, /THE PREVIOUS VERSION FAILED THESE CHECKS[\s\S]*never pays off Grandma's roll of duct tape/);
  const script = { title: "x", lines: [{ part: "rule", text: "Once upon a time." }], post: { title: "x", description: "", hashtags: [] } };
  const { result, seen } = await withFetch([script, script], () => writeScript({ apiKey: "k", idea: { ...EXAMPLE_IDEAS[0] }, lengthSec: 90, previous: real, failed }));
  assert.match(seen[0].messages[0].content, /FAILED THESE CHECKS[\s\S]*duct tape/, "round 1 carries the failed checks");
  assert.match(seen[1].messages[0].content, /FIX THESE PROBLEMS/, "round 2 carries what is still wrong");
  assert.equal(result.attempts, 2);
  assert.ok(result.check.problems.length > 0, "a rewrite that still fails comes back with its problems (the page says so)");
});

test("failed videos: every error code gets plain words; unknown codes are a hiccup on our side", () => {
  assert.equal(failReason("PRODUCTION_CHECK").kind, "story");
  assert.equal(failReason("NO_GPU").kind, "busy");
  assert.equal(failReason("QUEUE_TIMEOUT").kind, "busy");
  assert.equal(failReason("PROVIDER_BALANCE").kind, "paused");
  for (const c of ["CHUNK_FAILED", "FINISH_FAILED", "PREPARE_FAILED", "JOB_TIMEOUT", "RENDER_FAILED", "DISPATCH_FAILED", "SOMETHING_NEW", null]) assert.equal(failReason(c).kind, "ours", String(c));
  assert.equal(failReason("CHUNK_FAILED").text, "Something broke on our side while building your video.");
  for (const t of Object.values(FAIL_TEXT)) assert.doesNotMatch(t, /[A-Z]{3,}_|RunPod|GPU|error/i, "no codes or jargon for customers");
});

test("one run per script: the migration's unique index covers unfinished runs only", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261205200000_blocky_worlds_one_run_per_draft.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS blocky_worlds_runs_one_active_per_draft\s+ON public\.blocky_worlds_runs \(draft_id\)\s+WHERE draft_id IS NOT NULL AND status NOT IN \('done', 'failed'\)/);
  const api = readFileSync(new URL("../supabase/functions/blocky-worlds-api/index.ts", import.meta.url), "utf8");
  assert.match(api, /one_active_per_draft/, "the API maps the index's refusal to plain words");
  assert.match(api, /action === "fixPart"/);
});
