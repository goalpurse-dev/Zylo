// In This Town round 3 (owner 2026-11-22): the living world (world states from the story), character voices, name tags.
import test from "node:test";
import assert from "node:assert/strict";
import { worldProblems, threatArc, dressOf, worldText, cardWorldProblems, worldOf, DEFAULTS } from "../supabase/functions/_shared/blockyWorlds/worldState.js";
import { voiceParts, pickVoices, VOICE_TYPES, spokenText, PACE } from "../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { lineRange, writer2Problems } from "../supabase/functions/_shared/blockyWorlds/writer2.js";
import { captionColors } from "../scripts/blockyWorlds/blenderKit/speakers.mjs";
import { tempoFor } from "../scripts/blockyWorlds/engine/voice/eleven.mjs";
import { compileScene } from "../scripts/blockyWorlds/blenderKit/cards.mjs";
import { NARRATOR } from "../supabase/functions/_shared/blockyWorlds/config.js";

const W = (o = {}) => ({ busy: "busy", walkers: "walking", extras: [], cars: "driving", windows: "lit", curtains: "open", threat: "none", outside: [], ...o });
const town = { rule: "nobody goes outside after dark", habits: [], effects: [{ when: "night", no_people_outside: true, no_moving_cars: true, windows: "dark", curtains: "closed", hurry_home: false }, { when: "sunset", no_people_outside: false, no_moving_cars: false, windows: "any", curtains: "any", hurry_home: true }] };

test("world: the town's rule catches a night street that is not empty, moving cars, lit windows, open curtains", () => {
  const plan = { town, lines: [{ line: 1, time: "day", place: "suburb_street", world: W() }, { line: 2, time: "night", place: "suburb_street", world: W({ busy: "quiet", cars: "driving" }) }] };
  const p = worldProblems(plan);
  assert.ok(p.some((x) => /line 2.*nobody is outside/.test(x)));
  assert.ok(p.some((x) => /line 2.*no car moves/.test(x)));
  assert.ok(p.some((x) => /line 2.*windows dark/.test(x)));
  assert.ok(p.some((x) => /line 2.*curtains closed/.test(x)));
  assert.ok(!p.some((x) => /line 1/.test(x)), "the day is free (lively defaults)");
  const ok = { town, lines: [{ line: 1, time: "night", place: "suburb_street", world: W({ busy: "empty", walkers: "none", cars: "parked", windows: "dark", curtains: "closed" }) }, { line: 2, time: "sunset", place: "suburb_street", world: W({ busy: "normal", walkers: "hurrying" }) }] };
  assert.deepEqual(worldProblems(ok), []);
  assert.ok(worldProblems({ town, lines: [{ line: 3, time: "sunset", world: W({ busy: "normal" }) }] }).some((x) => /hurry home/.test(x)));
});

test("world: the threat arc: react -> the next line in the same place is relief (after)", () => {
  const plan = threatArc({ lines: [{ line: 1, place: "a", world: W({ threat: "near" }) }, { line: 2, place: "a", world: W({ threat: "react" }) }, { line: 3, place: "a", world: W() }, { line: 4, place: "b", world: W() }] });
  assert.deepEqual(plan.lines.map((l) => l.world.threat), ["near", "react", "after", "none"]);
});

test("world: the dress for the engine, the text for the picture check, the outside check", () => {
  const w = { time: "night", ...W({ busy: "empty", walkers: "none", cars: "parked", windows: "dark", curtains: "closed", outside: ["Noah"] }) };
  assert.deepEqual(dressOf(w), { time: "night", windows: "dark", curtains: "closed", faces: "dot", busy: "empty", walkers: "none", extras: [], cars: "parked", threat: "none" });
  assert.deepEqual(dressOf(w, { indoor: true }), { time: "night", windows: "dark", curtains: "closed", faces: "dot" });
  assert.match(worldText(w), /EMPTY/); assert.match(worldText(w), /PARKED ONLY/); assert.match(worldText(w), /windows DARK/); assert.match(worldText(w), /FAIL the picture/);
  const card = { start: { people: [{ who: "Noah", mark: "center", pose: "stand" }, { who: "Mia", mark: "left", pose: "stand" }] }, end: { people: [] } };
  const p = cardWorldProblems(card, w, { castNames: ["Noah", "Mia"] });
  assert.equal(p.length, 1); assert.match(p[0], /Mia is outside/);
  assert.deepEqual(cardWorldProblems(card, w, { castNames: ["Noah", "Mia"], indoor: true }), []);
  assert.equal(worldOf({ lines: [{ line: 1, time: "sunset" }] }, 1).walkers, DEFAULTS.sunset.walkers);
});

test("world: the compiled scene builds its place with the world state (and the dot-face end face)", () => {
  const card = { start: { place: "suburb_street", time: "night", camera: { type: "wide", side: "front" }, people: [{ who: "Noah", mark: "center", pose: "stand", face: "neutral", looks_at: "camera" }], props: [] },
    end: { place: "suburb_street", time: "night", camera: { type: "medium", side: "front" }, people: [{ who: "Noah", mark: "center", pose: "stand", face: "scared", looks_at: "camera" }], props: [] }, motion: [] };
  const scene = { start: 0, end: 2, wordList: [{ word: "a", start: 0 }] };
  const py = compileScene(card, { plan: { cast: [{ name: "Noah" }] }, scene, world: { time: "night", ...W({ busy: "empty", walkers: "none", cars: "parked", windows: "dark", curtains: "closed" }) } });
  assert.match(py, /zw_build\("suburb_street", t0, t1, \{"time": ?"night".*"busy": ?"empty".*"cars": ?"parked"/s);
  assert.match(py, /zw_face_at\(noah_0, /);
  assert.doesNotMatch(py, /\.face\(/);
});

test("voices: narrator parts and quoted parts by speaker, in order; the same voice joins; quotes stripped for the voice", () => {
  const script = { lines: [{ text: "In this town, nobody goes out at night.", speaker: "" }, { text: 'Noah looked at me and said, "Your mom lied."', speaker: "Noah" }, { text: '"Get inside now!"', speaker: "Mom" }, { text: "I ran inside.", speaker: "" }] };
  const parts = voiceParts(script);
  assert.deepEqual(parts.map((p) => p.who), ["narrator", "Noah", "Mom", "narrator"]);
  assert.equal(parts[1].text, '"Your mom lied."');
  assert.equal(parts[0].text, "In this town, nobody goes out at night. Noah looked at me and said,");
  assert.equal(spokenText(parts[2].text), "Get inside now!");
  const n = parts.reduce((a, p) => a + p.n, 0);
  assert.equal(n, script.lines.map((l) => l.text.split(/\s+/).length).reduce((a, b) => a + b, 0), "every word in exactly one part");
});

test("voices: one voice per character, the plan's type first, a SAVED choice always wins; the narrator stays the owner's", () => {
  const cast = [{ name: "Me" }, { name: "Noah", kid: true, voice_type: "whisper" }, { name: "Mom", kid: false, voice_type: "mom" }, { name: "Lily", kid: true }];
  const a = pickVoices(cast, {});
  assert.equal(a.voices.Noah.type, "whisper"); assert.equal(a.voices.Mom.type, "mom"); assert.equal(a.voices.Lily.type, "kid_girl");
  assert.equal(a.voices.Me, undefined);
  const b = pickVoices([{ name: "noah", voice_type: "kid_boy" }], a.store);
  assert.equal(b.voices.noah.type, "whisper", "the saved voice wins (same character = same voice in later videos)");
  assert.equal(VOICE_TYPES.narrator.voiceId, "NUklOYr6pNs1RxzJVQB5");
  for (const [k, v] of Object.entries(VOICE_TYPES)) assert.equal(v.settings.speed, 1.2, `${k} is made at 1.2`);
  assert.equal(PACE, 1.25);
});

test("pace: made at 1.2, sped up to 1.25 after (atempo 1.0417), never 1.2 x 1.25", () => {
  assert.equal(tempoFor(NARRATOR), 1.0417);
  assert.equal(tempoFor(VOICE_TYPES.mom), 1.0417);
});

test("captions: a speaker's words carry their name (the tag), the narrator's none", () => {
  const script = { lines: [{ text: "He said,", speaker: "" }, { text: '"Your mom lied."', speaker: "Noah" }] };
  const words = ["He", "said,", '"Your', "mom", 'lied."'].map((w) => ({ word: w }));
  const c = captionColors(script, words);
  assert.deepEqual(c.speakers, [null, null, "Noah", "Noah", "Noah"]);
  assert.ok(c.colors[2] && !c.colors[0]);
});

test("writer: a 40 s story is 14-19 lines; the quoted line is required when asked", () => {
  assert.deepEqual(lineRange(40), [14, 19]);
  assert.deepEqual(lineRange(90), [32, 38]);
  const s = { opening: "rule_first", rule_again_line: 2, lines: Array.from({ length: 16 }, (_, i) => ({ text: i ? "We go home." : "In this town, every night, nobody goes out.", speaker: "" })), cast: [], self_test: ["a", "b", "c"], kid_gets_it: true };
  assert.ok(writer2Problems(s, { lengthSec: 40, needQuote: true }).some((x) => /QUOTED/.test(x)));
  s.lines[5] = { text: '"Get inside now!"', speaker: "Mom" };
  assert.deepEqual(writer2Problems(s, { lengthSec: 40, needQuote: true }), []);
});
