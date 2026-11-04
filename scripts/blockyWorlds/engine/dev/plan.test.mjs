// node --test dev/plan.test.mjs   (the planner: The Listener with estimated timings, plus robustness)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, estimateWords, signText } from "../plan.mjs";
import { alignTokens, norm, tokens } from "../lib/planText.js";
import { extractKeys, cardFor } from "../lib/visuals.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";

const idea = EXAMPLE_IDEAS[0];
const words = estimateWords(EXAMPLE_SCRIPT);
const tl = planVideo({ script: EXAMPLE_SCRIPT, words, idea, lengthSec: 90 });
const len = (s) => s.end - s.start;

test("estimateWords: one entry per spoken word, ordered, ~260 wpm", () => {
  const n = EXAMPLE_SCRIPT.lines.reduce((a, l) => a + tokens(l.text).length, 0);
  assert.equal(words.length, n);
  for (let i = 1; i < words.length; i++) assert.ok(words[i].start >= words[i - 1].end - 1e-9);
  const speechSec = words.reduce((a, w) => a + (w.end - w.start), 0);
  assert.ok(Math.abs((n / speechSec) * 60 - 260) < 3, `pace ${(n / speechSec) * 60}`);
});

test("The Listener: checkTimeline is clean", () => {
  assert.deepEqual(checkTimeline(tl), []);
});

test("shots tile [0, duration] exactly, cut at word starts", () => {
  assert.equal(tl.shots[0].start, 0);
  assert.equal(tl.shots.at(-1).end, tl.duration);
  assert.equal(tl.duration, Math.round((words.at(-1).end + 0.4) * 1000) / 1000);
  const starts = new Set(words.map((w) => Math.round(w.start * 1000) / 1000));
  tl.shots.forEach((s, i) => {
    if (i) assert.equal(s.start, tl.shots[i - 1].end);
    if (i) assert.ok(starts.has(s.start), `shot ${i} cut at ${s.start} is not a word start`);
    assert.ok(len(s) >= 0.8 - 1e-9, `shot ${i} is ${len(s)} s`);
  });
});

test("cut pace: median shot 1.3-2.6 s", () => {
  const l = tl.shots.map(len).sort((a, b) => a - b);
  const median = l[l.length >> 1];
  assert.ok(median >= 1.3 && median <= 2.6, `median ${median}`);
});

test("every line is covered", () => {
  const covered = new Set(tl.shots.flatMap((s) => s.lines));
  EXAMPLE_SCRIPT.lines.forEach((_, i) => assert.ok(covered.has(i), `line ${i}`));
});

test("camera variety, never 3 in a row; opens on the rule sign", () => {
  assert.ok(new Set(tl.shots.map((s) => s.camera)).size >= 3);
  assert.ok(["wide", "insert"].includes(tl.shots[0].camera));
  assert.equal(tl.shots[0].insert?.text, "NO TALKING ABOVE A WHISPER");
});

test("the monster: The Listener, tall, reveals in the climax (low), flees at the end", () => {
  assert.equal(tl.monster?.name, "The Listener");
  assert.equal(tl.monster.type, "tall");
  const climax = tl.shots.filter((s) => s.part === "climax");
  assert.ok(climax.some((s) => s.monsterState?.state === "reveal" && s.camera === "low"));
  assert.ok(climax.some((s) => s.monsterState?.state === "flee"));
  assert.ok(tl.shots.filter((s) => s.part === "until").some((s) => s.monsterState?.state === "reach"));
});

test("light: day world, night from 'until', warm closer", () => {
  assert.equal(tl.shots[0].light, "day");
  assert.ok(tl.shots.filter((s) => s.part === "until" || s.part === "climax").every((s) => s.light === "night"));
  assert.ok(tl.shots.filter((s) => s.part === "closer").every((s) => s.light === "warm"));
});

test("cast: Pip, Mr. Dobbs, Mom, Dad, Bean (a baby); no Barnaby", () => {
  assert.equal(tl.cast.me.name, "Pip");
  assert.equal(tl.cast.dobbs?.name, "Mr. Dobbs");
  assert.ok(tl.cast.mom && tl.cast.dad);
  assert.equal(tl.cast.bean?.baby, true);
  assert.ok(!tl.cast.barnaby);
  assert.ok(Object.keys(tl.cast).filter((id) => id.startsWith("town")).length >= 2);
});

test("the prop is planted and paid off in hand", () => {
  const held = (part) => tl.shots.some((s) => s.part === part && s.actors.some((a) => a.id === "me" && a.hold === "whistle"));
  assert.ok(held("me") && held("climax"));
});

test("captions: every spoken word", () => {
  assert.equal(tl.captions.length, words.length);
});

test("deterministic", () => {
  assert.deepEqual(planVideo({ script: EXAMPLE_SCRIPT, words, idea, lengthSec: 90 }), tl);
});

test("robust to TTS words that don't match the script 1:1", () => {
  // drop some words, glue punctuation differently, add a stray word, and shift time
  const noisy = [];
  words.forEach((w, i) => {
    if (i % 17 === 5) return;
    noisy.push({ word: i % 11 === 0 ? w.word.toUpperCase() + "," : w.word.replace(/[.,!?]/g, ""), start: w.start * 1.07, end: w.end * 1.07 });
    if (i === 40) noisy.push({ word: "um", start: w.end * 1.07, end: w.end * 1.07 + 0.05 });
  });
  const t2 = planVideo({ script: EXAMPLE_SCRIPT, words: noisy, idea, lengthSec: 90 });
  assert.deepEqual(checkTimeline(t2), []);
  assert.equal(t2.captions.length, noisy.length);
  // the climax still starts near the right word
  const climaxLine = EXAMPLE_SCRIPT.lines.findIndex((l) => l.part === "climax");
  const want = noisy.find((w) => norm(w.word) === "ran")?.start;
  const got = t2.shots.find((s) => s.lines.includes(climaxLine))?.start;
  assert.ok(Math.abs(got - want) < 0.6, `climax at ${got}, word at ${want}`);
});

test("alignTokens interpolates misses", () => {
  const flat = ["a", "b", "c", "d"].map((n, i) => ({ line: 0, k: i, raw: n, n }));
  const out = alignTokens(flat, [{ word: "a" }, { word: "x" }, { word: "d" }]);
  assert.deepEqual(out.map((o) => o.word), [0, 1, 1, 2]);
});

test("signText for the other example rules", () => {
  assert.equal(signText(EXAMPLE_IDEAS[1].opener), "THE FLOOR IS LAVA EVERY TUESDAY");
  assert.equal(signText(EXAMPLE_IDEAS[2].opener), "NO SNEEZING");
});

// ---------------------------------------------------------------- every spoken noun gets a visual (CONTRACT addendum)
const here = path.dirname(fileURLToPath(import.meta.url));
const runDir = path.join(here, "..", "out", "listener_full");
const haveRun = fs.existsSync(path.join(runDir, "words.json")) && fs.existsSync(path.join(runDir, "script.json"));
const free = haveRun ? (() => {
  const s = JSON.parse(fs.readFileSync(path.join(runDir, "script.json"), "utf8"));
  const w = JSON.parse(fs.readFileSync(path.join(runDir, "words.json"), "utf8"));
  return { script: s.script, tl: planVideo({ script: s.script, words: w, idea: s.idea ?? idea, lengthSec: 90 }), words: w };
})() : null;

test("The Listener: zero visual misses (estimated and free-voice timings), report all OK", () => {
  assert.deepEqual(checkVisuals(tl, EXAMPLE_SCRIPT), []);
  assert.ok(tl.visualReport.every((r) => r.ok), JSON.stringify(tl.visualReport.filter((r) => !r.ok)));
  assert.equal(tl.visualReport.length, EXAMPLE_SCRIPT.lines.length);
  if (free) {
    assert.deepEqual(checkVisuals(free.tl, free.script), []);
    assert.deepEqual(checkTimeline(free.tl), []);
  }
});

for (const [name, get] of [["estimated", () => tl], ["free voice", () => free?.tl]]) {
  test(`The Listener (${name} timings): every row of listener_review.md "v2 must show"`, (t) => {
    const T = get();
    if (!T) return t.skip("no out/listener_full run");
    const of = (i) => T.shots.filter((s) => (s.lines ?? [s.line]).includes(i));
    const objs = (i) => of(i).flatMap((s) => s.objects ?? []);
    const actors = (i) => of(i).flatMap((s) => s.actors);
    const marks = (i) => of(i).flatMap((s) => [...(s.markers ?? []), ...(s.marker ? [s.marker] : [])]);
    const hasObj = (i, name, state) => objs(i).some((o) => o.name === name && (!state || o.state === state));
    const posed = (i, pose, id) => actors(i).some((a) => a.pose === pose && (!id || a.id === id));
    const isBaby = (id) => T.cast[id]?.role === "baby";
    const msg = (i) => `line ${i}: ${JSON.stringify(of(i).map((s) => ({ set: s.set, actors: s.actors, objects: s.objects, insert: s.insert, markers: s.markers ?? s.marker })))}`;

    assert.ok(marks(1).filter((m) => m.kind === "tag").length >= 2 && of(1).some((s) => s.monsterState?.spot === "tower"), msg(1));   // townsfolk name tags, the tower
    assert.ok(posed(2, "yell") && of(2).some((s) => s.monsterState && s.light === "night"), msg(2));
    assert.ok(actors(3).length >= 2 && actors(3).every((a) => a.expr === "shush"), msg(3));
    assert.ok(hasObj(4, "birthday_party") && actors(4).some((a) => a.pose === "wave" && a.expr === "shush"), msg(4));
    assert.ok(hasObj(5, "football_field"), msg(5));
    assert.ok(hasObj(6, "bakery") && posed(6, "sneeze", "dobbs"), msg(6));
    assert.ok(hasObj(7, "bakery", "for_sale"), msg(7));
    assert.ok(hasObj(8, "ice_cream_truck", "mime"), msg(8));
    assert.ok(posed(9, "yell", "me"), msg(9));
    assert.ok(hasObj(11, "car", "alarm") && posed(11, "yell", "me"), msg(11));
    assert.ok(actors(12).some((a) => a.id === "mom" && a.hold === "sock") && of(12).some((s) => s.set === "school" && s.objects?.some((o) => o.name === "photo_set") && s.actors.some((a) => a.id === "me")), msg(12));
    for (const i of [13, 17]) assert.ok(actors(i).some((a) => a.id === "bean" && isBaby("bean")) && hasObj(i, "crib"), msg(i));
    assert.ok(marks(14).some((m) => m.on === "bean" && m.text === "BEAN") && actors(14).some((a) => a.expr === "shush"), msg(14));
    assert.ok(actors(15).some((a) => a.id === "me" && a.hold === "whistle"), msg(15));
    assert.ok(actors(16).some((a) => a.id === "grandpa") && actors(16).some((a) => a.hold === "whistle"), msg(16));
    assert.ok(posed(17, "yell", "bean") && of(17).every((s) => s.light === "night"), msg(17));
    assert.ok(posed(18, "yell", "bean") && marks(18).some((m) => m.on === "bean" && m.kind === "tag"), msg(18));
    assert.ok(posed(19, "yell", "bean") && marks(19).some((m) => m.kind === "icon" && m.text === "x3"), msg(19));
    assert.ok(of(20).some((s) => s.setState?.windows === "dark") && hasObj(20, "house_front", "dark"), msg(20));
    assert.ok(actors(27).some((a) => a.id === "mom" && a.pose === "carry" && a.hold === "bean") && actors(27).some((a) => a.id === "dad" && a.hold === "sock"), msg(27));
    assert.ok(posed(28, "yell", "bean"), msg(28));
    assert.ok(hasObj(30, "stories_book") || of(30).some((s) => s.insert?.kind === "card" && /STORIES/.test(s.insert.text)), msg(30));
    assert.ok(actors(30).some((a) => a.id === "grandpa"), msg(30));
    assert.ok(of(38).some((s) => s.set === "street") && of(38).some((s) => s.set === "woods") && posed(38, "run", "me"), msg(38));
    const s39 = of(39);
    assert.ok(s39.some((s) => s.set === "school" && posed(39, "run", "me")) && s39.some((s) => s.objects?.some((o) => o.name === "bakery") && s.actors.some((a) => a.id === "me" && a.pose === "run")), msg(39));
    assert.ok(s39.every((s) => !(s.set === "school" && s.objects?.some((o) => o.name === "bakery"))), "school and bakery are two shots");
    assert.ok(of(40).some((s) => s.insert?.text === "SHH"), msg(40));
    assert.ok(actors(41).some((a) => a.id === "me" && a.pose === "blow" && a.hold === "whistle"), msg(41));
    assert.ok(of(42).some((s) => s.setState?.windows === "lit"), msg(42));
    assert.ok(posed(45, "yell", "me"), msg(45));
    assert.ok(posed(46, "yell", "me") && marks(46).some((m) => m.text === "BARNABY"), msg(46));
    assert.ok(of(48).some((s) => s.setState?.windows === "open") && hasObj(48, "house_front", "open"), msg(48));
    assert.ok(actors(49).filter((a) => a.pose === "yell").length >= 3, msg(49));
    assert.ok(actors(55).filter((a) => isBaby(a.id)).length >= 2 && objs(55).filter((o) => o.name === "crib").length >= 2 && marks(55).filter((m) => m.kind === "tag").length >= 2, msg(55));
    assert.ok(actors(56).some((a) => isBaby(a.id) && a.expr === "shush"), msg(56));
    assert.ok(actors(57).some((a) => isBaby(a.id) && a.pose === "yell") && marks(57).some((m) => m.text === "BARNABY"), msg(57));
    // the baby is a baby everywhere: never standing on the street on its own
    T.shots.forEach((s, i) => s.actors.forEach((a) => { if (isBaby(a.id)) assert.ok(s.set === "bedroom" && (s.objects ?? []).some((o) => o.name === "crib" && o.spot === a.spot), `shot ${i}: baby ${a.id} outside a crib`); }));
  });
}

test("free-voice Listener: pacing (word-start cuts, >= 0.8 s, median 1.3-2.6 s) and determinism", (t) => {
  if (!free) return t.skip("no out/listener_full run");
  const T = free.tl;
  const starts = new Set(free.words.map((w) => Math.round(w.start * 1000) / 1000));
  T.shots.forEach((s, i) => { assert.ok(len(s) >= 0.8 - 1e-9, `shot ${i} ${len(s)}`); if (i) assert.ok(starts.has(s.start), `shot ${i} cut at ${s.start}`); });
  const l = T.shots.map(len).sort((a, b) => a - b);
  assert.ok(l[l.length >> 1] >= 1.3 && l[l.length >> 1] <= 2.6);
  const s = JSON.parse(fs.readFileSync(path.join(runDir, "script.json"), "utf8"));
  assert.deepEqual(planVideo({ script: s.script, words: free.words, idea: s.idea ?? idea, lengthSec: 90 }), T);
});

test("made-up lines from other ideas: every noun on screen, never filler", () => {
  const lines = [
    "In this town, every pet can talk on Sundays.",
    "Mrs. Patel's cat runs the bakery.",
    "My dog sneezed on the ice cream truck.",
    "Every window on Maple Street went dark at midnight.",
    "Coach Reed blew his whistle at the football game.",
    "Our mayor keeps a pizza in his pocket.",
    "Grandma reads us stories by the campfire.",
    "Our school photo has a ghost in it.",
    "I hid my phone under the crib.",
    "The rain never stops on our street.",
    "Dad's car alarm goes off every morning.",
    "Then the whole town cheered.",
  ];
  const script = { title: "Made Up", lines: lines.map((text, i) => ({ part: i === 0 ? "rule" : i < 6 ? "tour" : "me", text })) };
  const T = planVideo({ script, words: estimateWords(script), idea: { mood: "funny", narrator: "Ada, a kid" } });
  assert.deepEqual(checkTimeline(T), []);
  assert.deepEqual(checkVisuals(T, script), []);
  const shows = (i, pred) => T.shots.filter((s) => s.lines.includes(i)).some(pred);
  assert.ok(shows(1, (s) => s.objects?.some((o) => o.name === "bakery")) && shows(1, (s) => s.insert?.icon === "🐈" || (s.markers ?? [s.marker]).some((m) => /CAT/.test(m?.text ?? ""))), "cat + bakery");
  assert.ok(shows(2, (s) => s.objects?.some((o) => o.name === "ice_cream_truck")), "ice cream truck");
  assert.ok(shows(3, (s) => s.setState?.windows === "dark"), "windows dark");
  assert.ok(shows(4, (s) => s.objects?.some((o) => o.name === "football_field")) && shows(4, (s) => s.actors.some((a) => a.pose === "blow" && a.hold === "whistle")), "coach blows the whistle at the game");
  assert.ok(shows(6, (s) => s.objects?.some((o) => o.name === "stories_book")) && shows(6, (s) => s.actors.some((a) => a.id === "grandma")), "grandma's stories");
  assert.ok(shows(7, (s) => s.objects?.some((o) => o.name === "photo_set") && s.set === "school"), "school photo");
  assert.ok(shows(10, (s) => s.objects?.some((o) => o.name === "car" && o.state === "alarm")) && shows(10, (s) => s.actors.some((a) => a.id === "dad")), "dad's car alarm");
  assert.ok(shows(11, (s) => s.actors.filter((a) => a.pose === "cheer").length >= 2), "the whole town cheers");
  // never filler: every shot of a line with key nouns shows at least one of them
  T.shots.forEach((s, i) => {
    const r = T.visualReport[s.line];
    if (r.nouns.length) assert.ok(s.visuals.length > 0, `shot ${i} (${s.text}) shows none of ${r.nouns.join(", ")}`);
  });
});

test("visual dictionary: keys, abstract words ignored, cards for unknown nouns", () => {
  const vw = { people: new Map(), alias: {}, narrator: "Pip", monster: null, looseNames: new Set(), prop: null };
  const labels = (t) => extractKeys(t, vw).map((k) => k.label);
  assert.deepEqual(labels("Not on purpose."), []);
  assert.deepEqual(labels("It was the first time in a long way."), []);
  assert.ok(labels("The rain fell on my umbrella.").includes("rain") && labels("The rain fell on my umbrella.").includes("umbrella"));
  assert.ok(labels("We ran past the bakery.").includes("bakery"));
  assert.ok(labels("Nobody screams here.").some((l) => /yell/.test(l)));
  assert.deepEqual(cardFor({ kind: "noun", label: "dogs", noun: "dog", icon: "🐕" }), { kind: "card", text: "DOGS", icon: "🐕" });
});

test("every example idea plans cleanly from its opener-only script (no monster for the funny ones)", () => {
  for (const id of EXAMPLE_IDEAS) {
    const script = { title: id.title, lines: [
      { part: "rule", text: id.opener }, { part: "tour", text: "You see, " + id.price },
      ...id.examples.map((t) => ({ part: "tour", text: t })), { part: "me", text: `I'm ${id.narrator.split(",")[0]}.` },
      { part: "me", text: `I keep ${id.prop}.` }, { part: "until", text: "Until one night, it all went wrong." },
      { part: "discovery", text: id.teaser }, { part: "climax", text: id.twist }, { part: "closer", text: id.closer },
    ] };
    const t = planVideo({ script, words: estimateWords(script), idea: id });
    assert.deepEqual(checkTimeline(t), [], id.title);
    if (id.title === "Lava Tuesday" || id.title === "Bless You") assert.equal(t.monster, null, id.title);
  }
});
