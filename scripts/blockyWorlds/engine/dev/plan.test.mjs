// node --test dev/plan.test.mjs   (the planner: The Listener with estimated timings, plus robustness)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, estimateWords, signText, subjectOf } from "../plan.mjs";
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
    // rows find their line by its text (the example script was trimmed 58 -> 46 lines: a row whose line was cut is skipped)
    const L = (text) => (T.lines ?? []).findIndex((l) => l.text === text);
    const row = (text, check) => { const i = L(text); if (i >= 0) check(i); };
    const of = (i) => T.shots.filter((s) => (s.lines ?? [s.line]).includes(i));
    const objs = (i) => of(i).flatMap((s) => s.objects ?? []);
    const actors = (i) => of(i).flatMap((s) => s.actors);
    const marks = (i) => of(i).flatMap((s) => [...(s.markers ?? []), ...(s.marker ? [s.marker] : [])]);
    const hasObj = (i, name, state) => objs(i).some((o) => o.name === name && (!state || o.state === state));
    const posed = (i, pose, id) => actors(i).some((a) => a.pose === pose && (!id || a.id === id));
    const isBaby = (id) => T.cast[id]?.role === "baby";
    const msg = (i) => `line ${i} (${T.lines[i].text}): ${JSON.stringify(of(i).map((s) => ({ set: s.set, actors: s.actors, objects: s.objects, insert: s.insert, markers: s.markers ?? s.marker })))}`;
    const ok = (text, pred) => row(text, (i) => assert.ok(pred(i), msg(i)));

    ok("You see, it only listens for names.", (i) => marks(i).filter((m) => m.kind === "tag").length >= 2 && of(i).some((s) => s.monsterState?.spot === "tower"));   // townsfolk name tags, the tower
    ok("Say yours too loud, and it comes down that night.", (i) => posed(i, "yell") && of(i).some((s) => s.monsterState && s.light === "night"));
    ok("So nobody here talks out loud.", (i) => actors(i).length >= 2 && actors(i).every((a) => a.expr === "shush"));
    ok("Birthday parties are all in sign language.", (i) => hasObj(i, "birthday_party") && actors(i).some((a) => a.pose === "wave" && a.expr === "shush"));
    ok("Our football team has never heard a cheer.", (i) => hasObj(i, "football_field"));
    ok("Mr. Dobbs sneezed his own name in the bakery once.", (i) => hasObj(i, "bakery") && posed(i, "sneeze", "dobbs"));
    ok("Now the bakery's for sale.", (i) => hasObj(i, "bakery", "for_sale"));
    ok("Even the ice cream truck plays its song in mime.", (i) => hasObj(i, "ice_cream_truck", "mime"));
    ok("I'm Pip, and I'm the loudest kid in town.", (i) => posed(i, "yell", "me"));
    ok("I just have a voice like a car alarm.", (i) => hasObj(i, "car", "alarm") && posed(i, "yell", "me"));
    ok("Mom taped a sock over my mouth for my school photo.", (i) => actors(i).some((a) => a.id === "mom" && a.hold === "sock") && of(i).some((s) => s.set === "school" && s.objects?.some((o) => o.name === "photo_set") && s.actors.some((a) => a.id === "me")));
    for (const text of ["My best friend is my baby sister.", "Until one night, Bean learned to scream."]) ok(text, (i) => actors(i).some((a) => a.id === "bean" && isBaby("bean")) && hasObj(i, "crib"));
    ok("We call her Bean. Her real name's a secret.", (i) => marks(i).some((m) => m.on === "bean" && m.text === "BEAN") && actors(i).some((a) => a.expr === "shush"));
    ok("And in my pocket, I keep Grandpa's old brass whistle.", (i) => actors(i).some((a) => a.id === "me" && a.hold === "whistle"));
    ok("He said it was the loudest thing in town. Until me.", (i) => actors(i).some((a) => a.id === "grandpa") && actors(i).some((a) => a.hold === "whistle"));
    ok("Until one night, Bean learned to scream.", (i) => posed(i, "yell", "bean") && of(i).every((s) => s.light === "night"));
    ok("She screamed her own secret name.", (i) => posed(i, "yell", "bean") && marks(i).some((m) => m.on === "bean" && m.kind === "tag"));
    ok("Three times. At the top of her lungs.", (i) => posed(i, "yell", "bean") && marks(i).some((m) => m.kind === "icon" && m.text === "x3"));
    ok("Every window on our street went dark.", (i) => of(i).some((s) => s.setState?.windows === "dark") && hasObj(i, "house_front", "dark"));
    ok("Mom grabbed Bean. Dad grabbed the sock.", (i) => actors(i).some((a) => a.id === "mom" && a.pose === "carry" && a.hold === "bean") && actors(i).some((a) => a.id === "dad" && a.hold === "sock"));
    ok("Bean screamed her name again.", (i) => posed(i, "yell", "bean"));
    ok("That's when I remembered Grandpa's stories.", (i) => (hasObj(i, "stories_book") || of(i).some((s) => s.insert?.kind === "card" && /STORIES/.test(s.insert.text))) && actors(i).some((a) => a.id === "grandpa"));
    ok("I ran out the back door and up the far hill.", (i) => of(i).some((s) => s.set === "street") && of(i).some((s) => s.set === "woods") && posed(i, "run", "me"));
    row("Past the school. Past the bakery.", (i) => {
      const s39 = of(i);
      assert.ok(s39.some((s) => s.set === "school" && posed(i, "run", "me")) && s39.some((s) => s.objects?.some((o) => o.name === "bakery") && s.actors.some((a) => a.id === "me" && a.pose === "run")), msg(i));
      assert.ok(s39.every((s) => !(s.set === "school" && s.objects?.some((o) => o.name === "bakery"))), "school and bakery are two shots");
    });
    ok("Past the sign that just says Shh.", (i) => of(i).some((s) => s.insert?.text === "SHH"));
    ok("At the top, I blew Grandpa's whistle.", (i) => actors(i).some((a) => a.id === "me" && a.pose === "blow" && a.hold === "whistle"));
    ok("Lights flicked on in every house.", (i) => of(i).some((s) => s.setState?.windows === "lit"));
    ok("And I yelled a name nobody owns.", (i) => posed(i, "yell", "me"));
    ok("Barnaby!", (i) => posed(i, "yell", "me") && marks(i).some((m) => m.text === "BARNABY"));
    ok("Then every window in town flew open.", (i) => of(i).some((s) => s.setState?.windows === "open") && hasObj(i, "house_front", "open"));
    ok("And the whole town yelled it with me.", (i) => actors(i).filter((a) => a.pose === "yell").length >= 3);
    ok("Now every baby here gets two names.", (i) => actors(i).filter((a) => isBaby(a.id)).length >= 2 && objs(i).filter((o) => o.name === "crib").length >= 2 && marks(i).filter((m) => m.kind === "tag").length >= 2);
    ok("One for whispering.", (i) => actors(i).some((a) => isBaby(a.id) && a.expr === "shush"));
    ok("And Barnaby, for screaming.", (i) => actors(i).some((a) => isBaby(a.id) && a.pose === "yell") && marks(i).some((m) => m.text === "BARNABY"));
    // the owner's subject fix: the last lines are the monster's, and Barnaby is never a tag on the narrator there
    for (const text of ["It turned away from our house.", "It walked right past me, up and over the hill.", "Still looking for Barnaby."]) {
      ok(text, (i) => of(i).every((s) => s.subject === "monster" && s.monsterState && s.focus === "monster"));
      ok(text, (i) => !marks(i).some((m) => m.on === "me" && /BARNABY/.test(m.text)));
    }
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

// ---------------------------------------------------------------- subjects (the owner's fix 1): who each line is about
const paidDir = path.join(here, "..", "out", "paid1");
const paid = fs.existsSync(path.join(paidDir, "words.json")) && fs.existsSync(path.join(paidDir, "script.json")) ? (() => {
  const s = JSON.parse(fs.readFileSync(path.join(paidDir, "script.json"), "utf8"));
  return planVideo({ script: s.script ?? s, words: JSON.parse(fs.readFileSync(path.join(paidDir, "words.json"), "utf8")), idea: s.idea ?? idea, lengthSec: 90 });
})() : null;

for (const [name, get] of [["estimated", () => tl], ["free voice", () => free?.tl], ["paid voice", () => paid]]) {
  test(`The Listener (${name} timings): every shot's subject is on screen and featured; checkSubjects clean`, (t) => {
    const T = get();
    if (!T) return t.skip("no run folder");
    assert.deepEqual(checkSubjects(T), []);
    assert.deepEqual(checkVisuals(T, { lines: T.lines }), []);
    assert.deepEqual(checkTimeline(T), []);
    const L = (text) => T.lines.findIndex((l) => l.text === text);
    const shotsOf = (text) => T.shots.filter((s) => (s.lines ?? [s.line]).includes(L(text)) && s.camera !== "insert");
    const want = {
      "It turned away from our house.": "monster", "It walked right past me, up and over the hill.": "monster", "Still looking for Barnaby.": "monster",
      "She screamed her own secret name.": "bean", "He said it was the loudest thing in town. Until me.": "grandpa", "Mom grabbed Bean. Dad grabbed the sock.": "mom",
      "The Listener can't see. It can't smell.": "monster", "It never needed Bean.": "monster", "Until one night, Bean learned to scream.": "bean",
      "We call her Bean. Her real name's a secret.": "group", "Every window on our street went dark.": "thing:windows", "I ran out the back door and up the far hill.": "me",
      "Now every baby here gets two names.": "babies",
    };
    for (const [text, id] of Object.entries(want)) if (L(text) >= 0) assert.equal(T.lines[L(text)].subject, id, text);
    for (const text of ["It turned away from our house.", "It walked right past me, up and over the hill.", "Still looking for Barnaby."]) {
      for (const s of shotsOf(text)) assert.ok(s.subject === "monster" && s.monsterState && s.focus === "monster", `${text}: ${JSON.stringify(s)}`);
    }
    // "It walked right past me": both in frame, the monster featured
    for (const s of shotsOf("It walked right past me, up and over the hill.")) assert.ok(s.actors.some((a) => a.id === "me"), "the kid it passes is in frame");
    for (const s of shotsOf("She screamed her own secret name.")) assert.ok(s.subject === "bean" && s.focus === "bean" || s.focus === "object", JSON.stringify(s));
    for (const s of shotsOf("He said it was the loudest thing in town. Until me.").filter((s) => /He said/.test(s.text))) assert.ok(s.focus === "grandpa" && s.actors.some((a) => a.id === "grandpa"));
    // "Mom grabbed Bean.": Mom featured, Bean in frame (in her arms)
    const mom = shotsOf("Mom grabbed Bean. Dad grabbed the sock.").find((s) => s.subject === "mom" || (s.subjectWith ?? []).includes("mom"));
    assert.ok(mom && mom.actors.some((a) => a.id === "mom" && a.hold === "bean"), JSON.stringify(mom));
    if (mom.subject === "mom") assert.equal(mom.focus, "mom");
    // Barnaby is never a tag on the narrator in the monster's lines; every shot records a subject
    for (const s of T.shots) {
      assert.ok("subject" in s, `shot without subject: ${s.text}`);
      if (s.subject === "monster") assert.ok(!(s.markers ?? (s.marker ? [s.marker] : [])).some((m) => m.on === "me" && /BARNABY/.test(m.text) && !(s.subjectWith ?? []).includes("me")), s.text);
    }
    // the report's subject column
    assert.ok(T.visualReport.every((r) => typeof r.subject === "string" && r.subject.length));
  });
}

test("subjectOf: pronouns by gender and recency, it = monster or a thing (never a person), fragments carry on", () => {
  const ctx = { people: { patel: "Mrs. Patel", reed: "Coach Reed", rosa: "Rosa", otto: "Otto", zib: "Zib" }, narrator: "Ada", monster: null };
  const s = (text) => subjectOf(text, ctx);
  assert.equal(s("Mrs. Patel lost her cat.").id, "patel");
  assert.equal(s("She looked everywhere.").id, "patel");
  assert.equal(s("Coach Reed found it in the bakery.").id, "reed");
  const he = s("He gave it back to her.");
  assert.equal(he.id, "reed"); assert.deepEqual(he.with, ["patel"]);
  assert.equal(s("Then Rosa saw Otto.").id, "rosa");
  assert.equal(s("He waved.").id, "otto");
  assert.equal(s("She tripped over a pumpkin.").id, "rosa");
  assert.equal(s("It rolled down the hill.").id, "thing:pumpkin");
  assert.equal(s("Zib laughed.").id, "zib");
  assert.equal(s("She laughed too.").id, "rosa", "an unknown-gender name is never guessed as she");
  assert.equal(s("The whole school cheered.").id, "group");
  assert.equal(s("Every window on Maple Street went dark.").id, "thing:windows");
  assert.equal(s("Our mayor keeps a pizza in his pocket.").id, "someone");
  assert.equal(s("I hid my phone under the crib.").id, "me");
  assert.equal(s("Not on purpose.").id, "me");

  // a monster story: "it" is the monster after it acted, a thing when one was just named and "it" is a state
  const m = { people: { mom: "Mom", grandpa: "Grandpa", bean: "Bean" }, alias: { sister: "bean", baby: "bean" }, narrator: "Pip", monster: { key: "yeti", name: "The Yeti" } };
  const y = (text) => subjectOf(text, m);
  assert.equal(y("The Yeti came down the mountain.").id, "monster");
  assert.equal(y("Grandpa grabbed his lantern.").id, "grandpa");
  assert.equal(y("It was the brightest light in town.").id, "thing:lantern");
  assert.equal(y("It sniffed the air.").id, "monster");
  const past = y("It stomped right past Mom.");
  assert.equal(past.id, "monster"); assert.deepEqual(past.with, ["mom"]);
  assert.equal(y("Still looking for Barnaby.").id, "monster");
  assert.equal(y("My little sister giggled.").id, "bean");
  assert.equal(y("She waved at it.").id, "bean");
  assert.equal(y("Its eyes glowed.").id, "monster");
  assert.equal(y("We all held our breath.").id, "group");
  assert.ok(y("It never came back.").absent);
});

test("made-up story: pronoun subjects are on screen and featured, never someone else", () => {
  const lines = ["In this town, every cat wears a bell.", "Mrs. Patel lost her cat.", "She looked everywhere.", "Coach Reed found it in the bakery.", "He gave it back to her.", "Then the whole town cheered."];
  const script = { title: "Bell Town", lines: lines.map((text, i) => ({ part: i === 0 ? "rule" : i < 3 ? "tour" : "me", text })) };
  const T = planVideo({ script, words: estimateWords(script), idea: { mood: "funny", narrator: "Ada, a kid" } });
  assert.deepEqual(checkSubjects(T), []);
  assert.deepEqual(checkTimeline(T), []);
  assert.deepEqual(T.lines.map((l) => l.subject), ["thing:cat", "patel", "patel", "reed", "reed", "group"]);
  const at = (i) => T.shots.filter((s) => s.lines.includes(i) && s.camera !== "insert");
  assert.ok(at(2).every((s) => s.focus === "patel" && s.actors.some((a) => a.id === "patel")), "She looked everywhere: Mrs. Patel");
  assert.ok(at(4).some((s) => s.focus === "reed" && s.actors.some((a) => a.id === "patel")), "He gave it back to her: Reed featured, Patel in frame");
});
