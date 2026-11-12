import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LENGTHS, NARRATOR, PACE, targetWords } from "../supabase/functions/_shared/blockyWorlds/config.js";
import { narratorProblems, ttsBody, VOICE_RANGES, alignmentWords } from "../supabase/functions/_shared/blockyWorlds/voice.js";
import { fixOpener, hasOpener, openerProblem } from "../supabase/functions/_shared/blockyWorlds/opener.js";
import { safetyProblems, topicProblem } from "../supabase/functions/_shared/blockyWorlds/safety.js";
import { FORMULA_IDS, MOOD_IDS, MOOD_TWISTS, slotsForBatch } from "../supabase/functions/_shared/blockyWorlds/formulas.js";
import { cardOf, ideaProblems, normalizeIdea, usableIdeas, ideasSchema, batchPrompt, topicPrompt, IDEAS_PER_BATCH } from "../supabase/functions/_shared/blockyWorlds/ideas.js";
import { checkScript, estimateSeconds, narrationOf, normalizeScript, paceClean, partBudgets, PART_IDS, scriptFromText, scriptPrompt, scriptSchema, SCRIPT_SYSTEM, wordCount } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../supabase/functions/_shared/blockyWorlds/examples.js";
import { costOf, mockScriptFor, providerFrom, writeIdeas, writeScript, writeTopicIdeas, repairOpener } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { CREDIT, fullCostUsd, PRICE_ROWS, PRICES, videoCredits } from "../supabase/functions/_shared/blockyWorlds/pricing.js";
import { decide, DEFAULT_SETTINGS } from "../supabase/functions/_shared/blockyWorlds/guard.js";
import { accessFor, canRemoveEndCard, canWrite, endCardFor } from "../supabase/functions/_shared/blockyWorlds/access.js";
import { ERRORS, STATUSES, STATUS_LABELS } from "../supabase/functions/_shared/blockyWorlds/contract.js";

// ---------- the narrator (the owner's pick, 2026-11-03) ----------

test("narrator: Little Dude II on Multilingual v2 at the owner's settings, inside the API's ranges", () => {
  assert.equal(NARRATOR.voiceId, "fBD19tfE58bkETeiwUoC");
  assert.equal(NARRATOR.model, "eleven_multilingual_v2");
  assert.deepEqual({ ...NARRATOR.settings }, { stability: 1, similarity_boost: 0.7, style: 0, use_speaker_boost: true, speed: 1.2 });
  assert.deepEqual(narratorProblems(), []);
  assert.equal(NARRATOR.settings.speed, VOICE_RANGES.speed[1], "speed is at the API's maximum");
});

test("narrator: out-of-range settings are refused before any call", () => {
  const bad = (patch) => narratorProblems({ ...NARRATOR, settings: { ...NARRATOR.settings, ...patch } });
  assert.match(bad({ speed: 1.3 }).join(), /speed 1.3 is outside 0.7-1.2/);
  assert.match(bad({ stability: 1.1 }).join(), /stability/);
  assert.match(bad({ similarity_boost: -0.1 }).join(), /similarity_boost/);
  assert.match(bad({ style: 2 }).join(), /style/);
  assert.match(narratorProblems({ ...NARRATOR, voiceId: "short" }).join(), /voiceId/);
});

test("narrator: the request body carries exactly the config", () => {
  const b = ttsBody("In this town, hello.");
  assert.equal(b.model_id, "eleven_multilingual_v2");
  assert.deepEqual(b.voice_settings, { stability: 1, similarity_boost: 0.7, style: 0, use_speaker_boost: true, speed: 1.2 });
  const words = alignmentWords({ characters: [..."Hi yo"], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5] });
  assert.deepEqual(words.map((w) => w.w), ["Hi", "yo"]);
});

// ---------- the hard rule: "In this town, " only (owner, 2026-11-08) ----------

test("opener: only the exact \"In this town, \" opener passes", () => {
  assert.ok(hasOpener("In this town, everyone has wings."));
  assert.ok(hasOpener("In this town, every house has a chalk line."));
  for (const bad of ["In this world, everyone has wings.", "In this village, ...", "In my town, x", "in this world, x", "in this town, x", "In this town everyone", "Everyone in this town has wings.", "In this town,"]) assert.ok(!hasOpener(bad), bad);
  assert.equal(openerProblem("In this town, yes."), null);
  assert.match(openerProblem("Once upon a time"), /must start with "In this town, "/);
  assert.match(openerProblem("In this world, yes."), /must start/);
});

test("opener: an old \"In this world, \" line gets just those words swapped by code", () => {
  assert.equal(fixOpener("In this world, we live in a giant turtle and a wolf army is hunting it."), "In this town, we live in a giant turtle and a wolf army is hunting it.");
  assert.equal(fixOpener("In this world, I'm the only kid without a hat."), "In this town, I'm the only kid without a hat.");
});

test("opener: near misses are fixed by code, anything else needs a rewrite", () => {
  assert.equal(fixOpener("In my town, you have to be home early."), "In this town, you have to be home early.");
  assert.equal(fixOpener("in this village: nobody whistles."), "In this town, nobody whistles.");
  assert.equal(fixOpener("In this kingdom, the smallest rule."), "In this town, the smallest rule.");
  assert.equal(fixOpener("In my world, Everyone gets a power."), "In this town, everyone gets a power.");
  assert.equal(fixOpener("Everyone in this town whispers."), null);
  assert.equal(fixOpener("In this town,"), null);
});

// ---------- originality and safety ----------

test("safety: famous stories, the platform and gore are refused; everyday phrases are not", () => {
  assert.match(safetyProblems("In this town, it's like City of Ember.").join(), /famous story/);
  assert.match(safetyProblems("We met a man called Guy at the door.").join(), /famous story/);
  assert.match(safetyProblems("The noob jumped on the obby.").join(), /game platform/);
  assert.match(safetyProblems("Roblox servers").join(), /game platform/);
  assert.match(safetyProblems("There was blood everywhere.").join(), /PG/);
  assert.deepEqual(safetyProblems("It follows the name over the hill. Inside out and upside down."), []);
  assert.equal(topicProblem("a haunted pool"), null);
  assert.equal(topicProblem("minecraft but scary"), null, "a game's name in a topic is fine: the script check refuses the name itself");
  assert.match(topicProblem("x"), /Type a topic/);
  assert.ok(topicProblem("a bloody murder"));
});

// ---------- the idea engine ----------

test("ideas: every batch is six different formula/twist pairs, each twist allowed for its mood", () => {
  for (let seed = 0; seed < 12; seed++) for (const mood of [null, ...MOOD_IDS]) {
    const slots = slotsForBatch(seed, IDEAS_PER_BATCH, mood);
    assert.equal(slots.length, IDEAS_PER_BATCH);
    assert.equal(new Set(slots.map((s) => s.formula + s.twist)).size, IDEAS_PER_BATCH);
    for (const s of slots) {
      assert.ok(FORMULA_IDS.includes(s.formula));
      assert.ok(MOOD_TWISTS[s.mood].includes(s.twist), `${s.twist} in ${s.mood}`);
      if (mood) assert.equal(s.mood, mood);
    }
  }
  assert.notDeepEqual(slotsForBatch(0), slotsForBatch(1), "'More ideas' gives different slots");
});

test("ideas: the hand-written examples pass every check; broken ideas are dropped", () => {
  for (const idea of EXAMPLE_IDEAS) assert.deepEqual(ideaProblems(normalizeIdea(idea)), [], idea.title);
  const good = EXAMPLE_IDEAS[1], slots = [{ formula: good.formula, twist: good.twistType }];
  assert.equal(usableIdeas({ ideas: [good] }, slots).length, 1);
  assert.equal(usableIdeas({ ideas: [{ ...good, opener: "Once, a town had lava." }] }, slots).length, 0, "no opener");
  assert.equal(usableIdeas({ ideas: [{ ...good, opener: "In my town, the floor is lava every Tuesday." }] }, slots).length, 1, "near-miss opener fixed");
  assert.equal(usableIdeas({ ideas: [{ ...good, premise: "Like the obby in Roblox." }] }, slots).length, 0, "platform term");
  assert.equal(usableIdeas({ ideas: [{ ...good, examples: ["one"] }] }, slots).length, 0, "three examples");
  assert.equal(usableIdeas({ ideas: [good] }, slots, [good.opener]).length, 0, "already shown");
  const card = cardOf(normalizeIdea(good), "id-1");
  assert.ok(!("twist" in card) && !("closer" in card), "the twist stays on the server");
  assert.equal(card.opener, good.opener);
});

test("ideas: the prompts name the slots and the topic; the schema has no array limits", () => {
  const { slots, text } = batchPrompt({ seed: 2, avoid: ["In this town, old idea."] });
  for (const s of slots) assert.ok(text.includes(`formula ${s.formula}`) && text.includes(`twist ${s.twist}`));
  assert.ok(text.includes("In this town, old idea."));
  assert.ok(topicPrompt({ topic: "my cat" }).text.includes('"my cat"'));
  assert.ok(!JSON.stringify(ideasSchema()).includes("maxItems") && !JSON.stringify(scriptSchema()).includes("maxItems"));
});

// ---------- the script: the pace (~260 words a minute from short lines) and the checks ----------

test("script: the example script (340 words, ~79 s at the formula pace) passes at 80 s, and is too long for 70 s", () => {
  const s = normalizeScript(EXAMPLE_SCRIPT), c = checkScript(s, 80, "written");
  assert.deepEqual(c.problems, []);
  assert.ok(Math.abs(c.words - targetWords(80)) / targetWords(80) < 0.08, `${c.words} words`);
  const lens = s.lines.slice(1).map((l) => wordCount(l.text)).sort((a, b) => a - b);
  assert.ok(lens[Math.floor(lens.length / 2)] <= 8, "median line is short");
  assert.ok(c.seconds > 70 && c.seconds <= 82, `${c.seconds} s`);
  assert.match(checkScript(s, 70, "written").problems.join(), /Too long: 340 words, a 70 s video fits 300 at most/);
  // the story formula (2026-11-12): ~4.3 words a second after the engine's 1.25x speed-up, a 1:30 video is ~385 words
  assert.equal(PACE.targetWpm, 257);
  assert.equal(targetWords(60), 257);
  assert.ok(Math.abs(targetWords(90) - 385) <= 2, `${targetWords(90)}`);
  assert.equal(partBudgets(120).reduce((a, b) => a + b.words, 0) >= targetWords(120) - 5, true);
  assert.ok(SCRIPT_SYSTEM.includes("Barnaby"), "the style sample is in the writer's prompt");
  assert.ok(!SCRIPT_SYSTEM.includes("90-second script"), "the sample's length is never presented as the target");
});

test("script: a 1:30 script lands on 1:30 at the formula pace (~257 wpm after the speed-up), never over the target", () => {
  // 2026-11-06: 342 words (target 330, +6% allowed) ran 95.8 s at the old pace; 2026-11-12 the engine speeds the voice up
  const MEASURED_WPM = 257;
  for (const s of LENGTHS) {
    const most = Math.round(targetWords(s) * 1.0);
    assert.ok((most / MEASURED_WPM) * 60 <= s + 1, `${s} s: ${most} words would run ${((most / MEASURED_WPM) * 60).toFixed(1)} s`);
    assert.ok(partBudgets(s).reduce((a, b) => a + b.words, 0) <= targetWords(s), `${s} s: the part budgets stay inside the band`);
  }
  assert.equal(targetWords(90), 386);
  const lines = (n) => Array.from({ length: Math.ceil(n / 8) }, (_, i) => ({ part: "own", text: Array.from({ length: Math.min(8, n - i * 8) }, () => "word").join(" ") + "." }));
  assert.match(checkScript({ lines: [{ part: "rule", text: "In this town, x." }, ...lines(400)] }, 90).problems.join(), /Too long/);
  assert.match(scriptPrompt({ idea: EXAMPLE_IDEAS[0], lengthSec: 90 }), /LENGTH: 90 seconds = 347 to 386 words in total, in about \d+ lines\. Never more than 386 words/);
});

test("script: pausing punctuation is cleaned out, meaning kept", () => {
  assert.equal(paceClean("Then — just like that — it stopped; nobody moved... (not even Dad): silence"), "Then, just like that, it stopped. Nobody moved. Not even Dad. Silence.");
  assert.equal(paceClean("Heavy… soaked… stuck"), "Heavy. Soaked. Stuck.");
  assert.equal(paceClean("“Hey rope boy, need a lift?”"), '"Hey rope boy, need a lift?"');
  assert.equal(paceClean("Ten-year-old kids"), "Ten-year-old kids.", "hyphens inside words stay");
});

test("script: the checks catch a wrong opener, wrong length, long lines, parts out of order and banned names", () => {
  const base = normalizeScript(EXAMPLE_SCRIPT);
  const swap = (i, text) => ({ ...base, lines: base.lines.map((l, k) => (k === i ? { ...l, text } : l)) });
  assert.match(checkScript(swap(0, "Once upon a time there was a whisper town."), 90).problems.join(), /must start/);
  assert.match(checkScript(base, 60).problems.join(), /Too long/);
  assert.match(checkScript(base, 120).problems.join(), /Too short/);
  assert.match(checkScript(swap(5, "This line is far far far far far far far far far far far far far far far far too long."), 90).problems.join(), /Line 6 has/);
  const shuffled = { ...base, lines: [base.lines[0], ...base.lines.slice(1).reverse()] };
  assert.match(checkScript(shuffled, 90).problems.join(), /out of order/);
  assert.match(checkScript(swap(3, "It was just like Free Guy."), 90).problems.join(), /famous story/);
  assert.match(checkScript(swap(3, "Suddenly, it rained."), 90).warnings.join(), /Suddenly/);
});

test("script: the user's own script is split into lines and checked more loosely (no parts needed)", () => {
  const own = scriptFromText("In this town, nobody sleeps. You see, the beds are alive!\n\nThey walk at night. And they're hungry?", "Beds");
  assert.deepEqual(own.lines.map((l) => l.text), ["In this town, nobody sleeps.", "You see, the beds are alive!", "They walk at night.", "And they're hungry?"]);
  assert.ok(own.lines.every((l) => l.part === "own"));
  const c = checkScript(own, 60, "own");
  assert.match(c.problems.join(), /Too short/);
  assert.ok(!/Missing parts/.test(c.problems.join()));
  const longOwn = scriptFromText(narrationOf(EXAMPLE_SCRIPT));
  assert.deepEqual(checkScript(longOwn, 90, "own").problems, []);
  assert.equal(estimateSeconds([{ text: "a b c" }]), Number(((3 / 257) * 60).toFixed(1)));
});

test("script: the prompt carries the idea, the word budget and the rewrite note", () => {
  const p = scriptPrompt({ idea: EXAMPLE_IDEAS[1], lengthSec: 120, previous: normalizeScript(EXAMPLE_SCRIPT), note: "make it funnier" });
  assert.ok(p.includes(`${targetWords(120)} words`) && p.includes("make it funnier") && p.includes("[rule] In this town"));
  assert.deepEqual(PART_IDS, ["rule", "tour", "me", "until", "discovery", "climax", "closer"]);
});

// ---------- the free mock flow (no network) ----------

test("mock: ideas, topic ideas, a script and an opener fix, with no call and no cost", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("no network in mock mode"); };
  try {
    assert.equal(providerFrom("mock"), "mock");
    assert.equal(providerFrom(""), "anthropic");
    const a = await writeIdeas({ provider: "mock", seed: 3 });
    assert.equal(a.ideas.length, IDEAS_PER_BATCH);
    assert.equal(a.costUsd, 0);
    const t = await writeTopicIdeas({ provider: "mock", topic: "my cat" });
    assert.equal(t.ideas.length, 3);
    const s = await writeScript({ provider: "mock", idea: a.ideas[0], lengthSec: 90 });
    assert.deepEqual(s.check.problems, []);
    assert.ok(hasOpener(s.script.lines[0].text));
    const s60 = await writeScript({ provider: "mock", idea: a.ideas[0], lengthSec: 60 });
    assert.deepEqual(s60.check.problems, [], "the mock script is sized to the length");
    assert.ok(!s60.check.warnings.some((w) => /\(mock\) Too (long|short)/.test(w)), "and fits it (no length problem hidden as a warning)");
    const o = await repairOpener({ provider: "mock", line: "Every night the lights go out." });
    assert.equal(o.line, "In this town, every night the lights go out.");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("llm: costs from usage at Sonnet 5.5 / Haiku 5.5 list prices", () => {
  assert.equal(costOf("claude-sonnet-5-5", { input_tokens: 1e6 }), 2);
  assert.equal(costOf("claude-sonnet-5-5", { output_tokens: 1e6 }), 10);
  assert.equal(costOf("claude-haiku-5-5", { input_tokens: 1e6, output_tokens: 1e6 }), 0.6);
});

// ---------- pricing, caps, access, contract ----------

test("pricing: 1 credit = $0.01 of our full cost, whole credits, and the migration rows match", () => {
  for (const s of LENGTHS) {
    assert.ok(Number.isInteger(PRICES[s]) && PRICES[s] > 0);
    assert.ok(PRICES[s] * CREDIT.ourUsd >= fullCostUsd(s) && PRICES[s] * CREDIT.ourUsd < fullCostUsd(s) + CREDIT.ourUsd);
    assert.equal(videoCredits(s), PRICES[s]);
  }
  for (let i = 1; i < LENGTHS.length; i++) assert.ok(PRICES[LENGTHS[i - 1]] < PRICES[LENGTHS[i]], "longer costs more");
  // the slider: 30 s to 3 min in 10 s steps; the first three lengths' prices are pinned (the owner applied them)
  assert.deepEqual(LENGTHS, [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180]);
  assert.deepEqual([PRICES[60], PRICES[90], PRICES[120]], [47, 62, 78]);
  assert.throws(() => videoCredits(20));
  assert.throws(() => videoCredits(95));
  const sql = readFileSync(new URL("../supabase/migrations/20261205100000_blocky_worlds_lengths.sql", import.meta.url), "utf8");
  for (const r of PRICE_ROWS) assert.ok(new RegExp(`\\('${r.tool_key}', NULL, ${r.flat_credits}, NULL,`).test(sql), `${r.tool_key} = ${r.flat_credits} in the migration`);
  assert.equal(PRICE_ROWS.length, LENGTHS.length);
  assert.ok(sql.includes(`CHECK (length_sec BETWEEN ${LENGTHS[0]} AND ${LENGTHS.at(-1)} AND length_sec % 10 = 0)`), "lengths in the table checks");
  const first = readFileSync(new URL("../supabase/migrations/20261201100000_blocky_worlds.sql", import.meta.url), "utf8");
  for (const s of [60, 90, 120]) assert.ok(first.includes(`('blocky-worlds:video-${s}', NULL, ${PRICES[s]}, NULL,`), `${s} s unchanged since the first migration`);
});

test("script: every length from 30 s to 3 min fits all seven parts (budgets add up; the sized mock passes its checks)", () => {
  for (const s of LENGTHS) {
    const b = partBudgets(s), sum = b.reduce((a, x) => a + x.words, 0), target = targetWords(s);
    assert.ok(Math.abs(sum - target) <= 2, `${s} s: budgets ${sum} vs ${target}`);
    assert.ok(b.find((x) => x.id === "rule").words >= 14, "the opener gets room");
    const c = checkScript(normalizeScript(mockScriptFor(s)), s, "written");
    assert.deepEqual(c.problems, [], `${s} s: ${c.problems.join("; ")}`);
  }
  assert.ok(checkScript(normalizeScript(mockScriptFor(90)), 95).problems.some((p) => /30 to 180 seconds/.test(p)));
});

test("guard: the same rules as Cutaway's; writing skips the per-user video limits", () => {
  const counts = { spent_24h: 1, user_running: 2, user_starts_1h: 0 };
  assert.equal(decide(DEFAULT_SETTINGS, counts, 0.5).code, "LIMIT");
  assert.equal(decide(DEFAULT_SETTINGS, counts, 0.5, { kind: "writing" }).ok, true);
  assert.equal(decide(DEFAULT_SETTINGS, null, 0.1).code, "BUSY", "fails closed");
  assert.equal(decide(DEFAULT_SETTINGS, { spent_24h: 19.9 }, 0.5).reason, "the emergency cap");
  assert.equal(decide(DEFAULT_SETTINGS, { spent_24h: 0 }, 0.1, { envOff: true }).code, "BUSY");
});

test("access: ideas for everyone signed in, scripts and videos for paid plans, end card off from Pro", () => {
  assert.equal(canWrite("free"), false);
  assert.equal(canWrite("starter"), true);
  assert.equal(canWrite("affiliate"), true);
  assert.equal(canRemoveEndCard("starter"), false);
  assert.equal(canRemoveEndCard("pro"), true);
  assert.equal(canRemoveEndCard("affiliate"), false);
  assert.equal(endCardFor("pro", true), false);
  assert.equal(endCardFor("starter", true), true);
  assert.equal(accessFor({ signedIn: false }), "guest");
  assert.equal(accessFor({ signedIn: true, planCode: "free" }), "free");
  assert.equal(accessFor({ signedIn: true, planCode: null }), "unknown");
});

test("contract: every status has a label; every error has a status and a message", () => {
  for (const s of STATUSES) assert.ok(STATUS_LABELS[s]);
  for (const [k, v] of Object.entries(ERRORS)) assert.ok(v.status >= 400 && v.message, k);
});
