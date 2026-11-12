// Blocky Worlds board-only launch mode, step 1: the kit-fit helper (boardFit.js) on top of the kit manifest (boardKit.js)
// and the engine side's early check (kitCheck.js). All free: no network, no paid call.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOARD_KIT } from "../supabase/functions/_shared/blockyWorlds/boardKit.js";
import { kitCheck } from "../supabase/functions/_shared/blockyWorlds/kitCheck.js";
import {
  BOARD_PREFIX, PREMISE_PREFIX, boardFitProblems, boardOnlyFrom, boardProblemLines, canFilm, canFilmLine, fittingOnly, kitBlock,
  kitFit, kitView, launchModeFrom, moveNote, NO_VARIANT, propFilmable, propHead, scanText, VARIANT_CUES,
} from "../supabase/functions/_shared/blockyWorlds/boardFit.js";
import { creatureCheck } from "../scripts/blockyWorlds/engine/lib/storyboard.js";

const LIBRARY = JSON.parse(readFileSync(new URL("../src/components/viral-tools/blocky-worlds/dev/libraryFixture.json", import.meta.url), "utf8"));
const S = (...texts) => ({ title: "t", lines: texts.map((text) => ({ part: "own", text })) });
const filler = (n) => Array.from({ length: n }, (_, i) => `Mrs. Pell waved at me ${i + 1} times.`);

test("switches: launch mode from BLOCKY_WORLDS_LAUNCH=board or BOARD_ONLY on; both off by default", () => {
  const env = (o) => (k) => o[k] ?? "";
  assert.equal(launchModeFrom(env({})), false);
  assert.equal(boardOnlyFrom(env({})), false);
  assert.equal(launchModeFrom(env({ BLOCKY_WORLDS_LAUNCH: "board" })), true);
  assert.equal(launchModeFrom(env({ BLOCKY_WORLDS_LAUNCH: "off" })), false);
  assert.equal(boardOnlyFrom(env({ BLOCKY_WORLDS_BOARD_ONLY: "on" })), true);
  assert.equal(launchModeFrom(env({ BLOCKY_WORLDS_BOARD_ONLY: "on" })), true, "a strict render implies the pre-charge check");
  assert.equal(boardOnlyFrom(env({ BLOCKY_WORLDS_BOARD_ONLY: "maybe" })), false);
});

test("the kit view reads the manifest: places, the 5 monster looks, animals, weather, the props kit", () => {
  const v = kitView();
  assert.deepEqual(v.places.map((p) => p.id), BOARD_KIT.places.map((p) => p.id));
  assert.deepEqual(v.creatures.map((c) => c.id), BOARD_KIT.creatures.map((c) => c.id));
  assert.deepEqual(v.animals, [...BOARD_KIT.animals]);
  assert.deepEqual(v.weather, [...BOARD_KIT.weather]);
  assert.equal(v.propsFromKit, true);
  for (const p of BOARD_KIT.props) assert.ok(v.props.some((x) => x.id === p.id && p.aliases.every((a) => x.words.includes(a))), p.id);
  assert.equal(v.crowdsAtNight, false);
});

test("'What we can film' is generated from the kit, never hand-written: a kit change changes it", () => {
  const items = canFilm();
  for (const p of BOARD_KIT.places) assert.ok(items.some((x) => x.id === `place:${p.id}`), p.id);
  for (const w of BOARD_KIT.weather) assert.ok(items.some((x) => x.id === `weather:${w}`), w);
  assert.ok(items.some((x) => x.label === `${BOARD_KIT.creatures.length} monster looks`));
  assert.ok(items.some((x) => x.label === `${BOARD_KIT.animals.length} animals`));
  assert.ok(items.some((x) => x.label === "crowds by day"));
  const grown = { ...BOARD_KIT, places: [...BOARD_KIT.places, { id: "town_day", what: "the town by day", outdoor: true }], creatures: BOARD_KIT.creatures.slice(0, 2), crowdsAtNight: true };
  const g = canFilm(grown);
  assert.ok(g.some((x) => x.id === "place:town_day" && x.label === "town day"));
  assert.ok(g.some((x) => x.label === "2 monster looks"));
  assert.ok(g.some((x) => x.label === "crowds"));
  assert.match(canFilmLine(), /^streets, inside houses, /);
});

test("kitFit on the 130 live library ideas: today's fit, the blockers named, the obvious ones right", () => {
  const fits = LIBRARY.map((r) => kitFit(r.idea));
  const n = fits.filter((f) => f.fit).length;
  // 2026-11-12 measurement: 12 fit with the props kit strict (the planted object must be a kit prop); 44 without it
  assert.ok(n >= 6 && n <= 30, `fit ${n}`);
  const byOpener = (re) => LIBRARY.findIndex((r) => re.test(r.idea.opener));
  assert.equal(fits[byOpener(/mine tunnels/)].fit, false, "a mine town and a worm");
  assert.ok(fits[byOpener(/mine tunnels/)].need.some((x) => x.kind === "place"));
  assert.equal(fits[byOpener(/giant department store/)].fit, false, "a town inside a giant thing");
  assert.ok(fits[byOpener(/walk past a snowman/)].need.some((x) => x.words.some((w) => /snowm/i.test(w))), "snow on the ground / a snowman");
  // fitting ideas: a woods-edge offering with a bowl, a porch sock, a personal rain cloud with an umbrella
  for (const re of [/bowl of soup at the woods edge/, /one sock on the porch/, /personal rain cloud/]) assert.equal(fits[byOpener(re)].fit, true, String(re));
  // every row gets the same answer twice (pure), and a row filter keeps the order
  assert.deepEqual(LIBRARY.map((r) => kitFit(r.idea).fit), fits.map((f) => f.fit));
  const kept = fittingOnly(LIBRARY);
  assert.equal(kept.length, n);
  assert.deepEqual(kept.map((r) => r.id), LIBRARY.filter((_, i) => fits[i].fit).map((r) => r.id));
});

test("kitFit: details (examples, closer) are soft; a stored tag counts only for the kit version it was made for", () => {
  const idea = { opener: "In this town, nobody whistles after dark, or the Long Shadow comes.", premise: "A street at night.", price: "Your porch light goes out.", examples: ["Mr. Bo drives his truck home quietly."], twist: "I hum instead.", prop: "a flashlight", setting: "suburb street" };
  const f = kitFit(idea);
  assert.equal(f.fit, true);
  assert.ok(f.soft.some((s) => s.kind === "vehicle"));
  assert.equal(kitFit({ ...idea, setting: "underground or cave town" }).fit, false);
  assert.equal(kitFit({ ...idea, prop: "a roll of masking tape" }).fit, false, "the planted object must be filmable");
  const stored = { ...idea, kit: { version: BOARD_KIT.version, need: [{ kind: "place", value: "cave", words: ["cave"] }] } };
  assert.equal(kitFit(stored).fit, false);
  assert.equal(kitFit(stored).stored, true);
  const stale = { ...idea, kit: { version: BOARD_KIT.version - 1, need: [{ kind: "place", value: "cave", words: ["cave"] }] } };
  assert.equal(kitFit(stale).fit, true, "a tag from an older kit is recomputed");
  // a kit that grows a place makes its words fine
  const cave = { ...BOARD_KIT, places: [...BOARD_KIT.places, { id: "cave", what: "a cave", outdoor: false }] };
  assert.equal(kitFit("We all live in a cave.").fit, false);
  assert.equal(kitFit("We all live in a cave.", cave).fit, true);
});

test("planted objects: the thing itself, from the props kit, the actions or the room", () => {
  assert.equal(propHead("A roll of masking tape"), "tape");
  assert.equal(propHead("A stale bagel in her backpack"), "bagel");
  assert.equal(propHead("A paper sign reading ASK FIRST"), "sign");
  for (const p of ["a flashlight", "Grandpa's brass whistle", "a warm blanket", "A sock with a hole in the toe", "a box of birthday candles", "her umbrella", "a hammer"]) assert.equal(propFilmable(p), true, p);
  for (const p of ["A roll of masking tape", "A stale bagel in her backpack", "Mom's sewing scissors", "a jar of pepper"]) assert.equal(propFilmable(p), false, p);
});

test("the creature: the engine's monster-look words and its no-look words are the same as this file's", () => {
  const lines = (t) => [{ text: t }];
  for (const [look, text] of [["peeker", "One giant eye pressed the glass."], ["shadow", "A faceless shadow stood there."], ["grin", "Its grin got wider."], ["hat", "It tipped its tall hat."], ["many_eyes", "Six eyes opened in the dark."]]) {
    assert.ok(VARIANT_CUES[look].test(text), look);
    assert.equal(creatureCheck(lines(text), null).variant, look, `engine agrees on ${look}`);
  }
  for (const t of ["It had long tentacles.", "Slime dripped from it."]) {
    assert.ok(NO_VARIANT.test(t));
    assert.ok(creatureCheck(lines(t), null).problems.length > 0, "the engine fails it too");
    assert.ok(boardFitProblems(S("In this town, the closet monster lives in the closet.", t, ...filler(6), t)).problems.length > 0);
  }
});

test("boardFitProblems sits on kitCheck: its must-have misses block; a single mid-story mention only warns", () => {
  const vehicle = S("In this town, every kid rides the bus to the porch.", ...filler(8));
  assert.equal(kitCheck(vehicle).ok, false);
  const r1 = boardFitProblems(vehicle);
  assert.ok(r1.missing.some((m) => m.word === "bus" && m.source === "kitCheck"));
  assert.ok(r1.problems.some((p) => p.startsWith(`${BOARD_PREFIX} "bus" (line 1)`)));
  const once = S("In this town, nobody whistles after dark.", "Or the Long Shadow comes.", "Mr. Bo parks his truck.", ...filler(8));
  assert.equal(kitCheck(once).ok, true);
  const r2 = boardFitProblems(once);
  assert.deepEqual(r2.problems, []);
  assert.ok(r2.warnings.some((w) => /"truck"/.test(w)));
});

test("boardFitProblems adds what kitCheck doesn't cover (weather, crowds at night, a giant-thing town, flying) with the same rule", () => {
  const fog = S("In this town, nobody whistles after dark.", "Mr. Bo locks the door.", "The fog came down the street.", ...filler(6), "The fog rolled in again.");
  const r = boardFitProblems(fog);
  assert.equal(r.premise, false);
  assert.equal(r.problems.length, 1);
  assert.ok(r.problems[0].startsWith(`${BOARD_PREFIX} "fog" (lines 3 and 10)`));
  assert.deepEqual(boardProblemLines(r.problems[0]), [2, 9]);
  const night = S("In this town, nobody whistles after dark.", ...filler(6), "Then the crowd gathered at midnight.", "The crowd went home at midnight.");
  assert.ok(boardFitProblems(night).problems.some((p) => /crowds can be filmed by day only/.test(p)));
  const day = S("In this town, nobody whistles after dark.", ...filler(6), "In the morning the crowd cheered.", "The crowd cheered all day.");
  assert.deepEqual(boardFitProblems(day).problems, []);
  assert.ok(scanText("We float up into the sky.").needs.some((n) => n.kind === "flight"));
  assert.deepEqual(scanText("The owl flew up into the sky.").needs, [], "birds may fly");
});

test("a whole-premise miss is ONE problem with the move action; the card's planted object counts", () => {
  const cave = S("In this town, we all live in a cave under the hill.", ...filler(8));
  const r = boardFitProblems(cave);
  assert.equal(r.premise, true);
  assert.equal(r.problems.length, 1);
  assert.ok(r.problems[0].startsWith(PREMISE_PREFIX));
  assert.match(r.problems[0], /"cave"/);
  const tape = S("In this town, nobody says goodnight out loud.", ...filler(4), "I kept a roll of tape in my pocket.", ...filler(3), "I taped its mouth shut with the tape.");
  const t = boardFitProblems(tape, { prop: "A roll of masking tape" });
  assert.ok(t.problems.some((p) => p.startsWith(`${BOARD_PREFIX} "tape"`)));
  assert.deepEqual(boardFitProblems(tape, { prop: "a flashlight" }).problems, []);
});

test("the kit as writer rules: every place, look, animal and weather named; the same text every call (cacheable)", () => {
  for (const who of ["ideas", "plan", "lines"]) {
    const b = kitBlock(BOARD_KIT, who);
    assert.equal(b, kitBlock(BOARD_KIT, who));
    assert.match(b, /THE WORLD WE CAN FILM/);
    for (const c of BOARD_KIT.creatures) assert.ok(b.includes(c.what), c.id);
    for (const a of BOARD_KIT.animals) assert.ok(b.includes(a), a);
    for (const w of BOARD_KIT.weather) assert.ok(b.includes(w), w);
    for (const p of BOARD_KIT.props.slice(0, 10)) assert.ok(b.includes(p.id), p.id);
    assert.match(b, /Crowds by DAY only/);
  }
  assert.match(kitBlock(BOARD_KIT, "plan"), /name its look in the rule visual/);
  const note = moveNote([`${PREMISE_PREFIX} ("cave" and "dragon").`]);
  assert.ok(note.length <= 300);
  assert.match(note, /Keep the rule/);
  assert.match(note, /cave, dragon/);
});

// ---------------------------------------------------------------- step 2: the library filter (computed at read time)
test("library filter: in launch mode the picker only ever chooses ideas the board kit can film", async () => {
  const { pickForUser } = await import("../supabase/functions/_shared/blockyWorlds/library.js");
  const rows = LIBRARY.map((r, i) => ({ id: r.id, idea: r.idea, formula: r.idea.formula, mood: r.idea.mood, rank: 100 - i }));
  for (const mood of [null, "funny", "horror", "wholesome", "epic"]) {
    const chosen = pickForUser(fittingOnly(rows), 6, mood);
    assert.ok(chosen.every((c) => kitFit(c.idea).fit), String(mood));
    if (!mood) assert.equal(chosen.length, 6);
  }
  // the endpoint: more candidates in launch mode, filtered before pickForUser; the page learns the mode + the kit list
  const src = readFileSync(new URL("../supabase/functions/blocky-worlds-api/index.ts", import.meta.url), "utf8");
  assert.match(src, /const LIBRARY_LIMIT = LAUNCH_BOARD \? 200 : 60;/);
  assert.match(src, /p_limit: LIBRARY_LIMIT/);
  assert.match(src, /pickForUser\(LAUNCH_BOARD \? fittingOnly\(cands \?\? \[\]\) : cands \?\? \[\], IDEAS_PER_BATCH, mood\)/);
  assert.match(src, /launch: LAUNCH_BOARD \? "board" : "off", film: LAUNCH_BOARD \? canFilm\(\) : null/);
});
