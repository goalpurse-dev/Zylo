// In This Town (owner, 2026-11-17): a paid user is never blocked on a style note; one town-line rule; settings in our
// library worlds. Free, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkScript } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { townLineProblem } from "../supabase/functions/_shared/blockyWorlds/opener.js";
import { isBlocker, isShownNote, noteLines, noteSpots, paidGate } from "../supabase/functions/_shared/blockyWorlds/paidGate.js";
import { fixLines, draftCheck } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { topicElements } from "../supabase/functions/_shared/blockyWorlds/topic.js";
import { SETTINGS, SETTING_RULE } from "../supabase/functions/_shared/blockyWorlds/formulas.js";
import { topicPrompt } from "../supabase/functions/_shared/blockyWorlds/ideas.js";
import { ADAPT, checkStoryText } from "../supabase/functions/_shared/blockyWorlds/adapt.js";

const L = (...t) => t.map((text) => ({ part: "tour", text }));

test("town line: 'in this town' / 'in this world' anywhere in the first 2 lines; a result-first hook passes", () => {
  assert.equal(townLineProblem(L("And I just led my whole town out of a snail's mouth!", "You see, in this town, every lie turns your nose into an animal.")), null);
  assert.equal(townLineProblem(L("In this town, lies grow noses.")), null);
  assert.equal(townLineProblem(L("Wow!", "In this world, lies grow noses.")), null);
  assert.match(townLineProblem(L("Wow!", "I fell.", "You see, in this town, x.")), /^Say "in this town"/);
  // the writer's line 2 is never flagged as long or comma-heavy for its own "You see, in this town," words
  const w = checkScript({ lines: L("And I just led my whole town out!", "You see, in this town, every single lie turns your nose into a different animal.") }, 80, "own").warnings;
  assert.ok(!w.some((x) => /^Line 2 /.test(x)), w.join(" | "));
});

test("paid gate: only unsafe / brand / famous / nothing-to-film / empty / far too long block; style is a note", () => {
  assert.ok(isBlocker('Uses "gore", keep it PG.') && isBlocker("We can't film \"nike\" (line 3): it's a real brand.") && isBlocker("The script is empty."));
  for (const p of ['Say "in this town" (or "in this world") in the first 2 lines.', "Too short: 300 words", "Formula: the button does not call back the hook. (line 30)", "Line 5 has 18 words (keep it under 16)"]) assert.ok(!isBlocker(p), p);
  const g = paidGate({ problems: ['Say "in this town" (or "in this world") in the first 2 lines.', 'Uses "gore". Keep it PG.'], warnings: ["Line 3 is long (13 words).", "Beat sheet: ally starts at 39%."], seconds: 80 });
  assert.deepEqual(g.problems, ['Uses "gore". Keep it PG.']);
  assert.equal(g.notes.length, 1);
  assert.deepEqual(g.shown, ['Say "in this town" (or "in this world") in the first 2 lines.'], "only the notes a user cares about are shown (2026-11-18: no comma / length / formula notes)");
  assert.deepEqual(paidGate(g).problems, g.problems, "idempotent");
  assert.match(paidGate({ problems: [], warnings: [], seconds: 200 }).problems[0], /too long for one video/);
  for (const n of ["Formula: the last line is a 9-word line; the button must be 2 to 6 words. (line 30)", "Line 2 has more than one comma.", "Line 3 is long (13 words)."]) assert.ok(!isShownNote(n), n);
});

test("note lines: 'Line 7', '(lines 3, 4)', the town line -> lines 1-2", () => {
  const lines = L("a", "b", "c", "d", "e", "f", "g", "h");
  assert.deepEqual(noteLines("Line 7 is long (13 words).", lines), [6]);
  assert.deepEqual(noteLines("Formula: the button must be short. (lines 3, 4)", lines), [2, 3]);
  assert.deepEqual(noteLines('Say "in this town" (or "in this world") in the first 2 lines.', lines), [0, 1]);
  assert.deepEqual(noteSpots({ shown: ["Line 2 has more than one comma."] }, lines), [{ text: "Line 2 has more than one comma.", lines: [1] }]);
});

test("Fix this line: the town line is fixed in code (free), only that line changes", async () => {
  const script = { title: "t", lines: L("And I just floated over the bakery!", "Every lie makes you float.", "Mia lied about her homework.", "She hit the ceiling."), post: {} };
  const note = paidGate(draftCheck(script, 60, "own", null)).shown.find((x) => /in this town/.test(x));
  assert.ok(note);
  const r = await fixLines({ provider: "mock", script, indexes: [0, 1], note, lengthSec: 60, kind: "own", gate: paidGate });
  assert.equal(r.ok, true);
  assert.equal(r.costUsd, 0);
  assert.equal(r.script.lines[1].text, "You see, in this town, every lie makes you float.");
  assert.deepEqual(r.script.lines.filter((_, i) => i !== 1), script.lines.filter((_, i) => i !== 1));
});

test("settings: our library worlds; 'in this town' is never read as a setting (the snail-shell bug)", () => {
  assert.ok(SETTINGS.some((s) => /^downtown/.test(s)) && SETTINGS.some((s) => /^suburb/.test(s)) && SETTINGS.some((s) => /^brick city/.test(s)));
  assert.ok(!SETTINGS.some((s) => /inside something giant|underwater|castle/.test(s)));
  assert.deepEqual(topicElements("In this town, every time you lie, your nose turns into a different animal.").filter((e) => e.setting), []);
  assert.deepEqual(topicElements("we live inside a giant turtle").filter((e) => e.setting).map((e) => e.key), ["turtle"]);
  const p = topicPrompt({ topic: "In this town, every time you lie, your nose turns into a different animal." }).text;
  assert.ok(!p.includes("we live inside X") && p.includes(SETTING_RULE));
});

test("Explain more: the story box takes up to ~3,000 characters, never the 200-character topic rule", () => {
  assert.equal(ADAPT.maxChars, 3000);
  const long = "My best friend Zara fibs all day and fits in a teacup. ".repeat(40);
  assert.ok(long.length > 2000 && long.length < 3000);
  assert.equal(checkStoryText(long).ok, true);
  const api = fs.readFileSync("supabase/functions/blocky-worlds-api/index.ts", "utf8");
  assert.ok(!/topicProblem\(text\.text/.test(api), "adaptStory no longer runs the topic length rule on the story");
});
