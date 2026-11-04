// node --test dev/plan.test.mjs   (the planner: The Listener with estimated timings, plus robustness)
import { test } from "node:test";
import assert from "node:assert/strict";
import { planVideo, checkTimeline, estimateWords, signText } from "../plan.mjs";
import { alignTokens, norm, tokens } from "../lib/planText.js";
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
