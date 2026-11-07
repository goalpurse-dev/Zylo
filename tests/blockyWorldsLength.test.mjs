// Blocky Worlds: the script lands on its length without paid rewrites (2026-11-07). A real paid test run ("dog", 60 s,
// Sonnet) came back 257 words for a 212-word cap, the first rewrite 213, and it took three extra Sonnet calls ($0.10) to
// fit. Now: per-part word AND line budgets in the prompt with a count before answering, and a free code trim
// (trimScript / trimForLength) before any rewrite. Everything here is free: no network (fetch is stubbed).
import test from "node:test";
import assert from "node:assert/strict";
import { BAND, checkScript, lengthBlock, partLines, scriptPrompt, trimScript, wordCount } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { scriptProtocolCheck, trimForLength, writeScript } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { partWords } from "../supabase/functions/_shared/blockyWorlds/protocol.js";
import { targetWords } from "../supabase/functions/_shared/blockyWorlds/config.js";
import { EXAMPLE_IDEAS } from "../supabase/functions/_shared/blockyWorlds/examples.js";

const L = (part, ...texts) => texts.map((text) => ({ part, text }));
const words = (s) => s.lines.reduce((a, l) => a + wordCount(l.text), 0);

// The real card of the "dog" run (ideas.json, picked card).
const CARD = {
  opener: "In this town, if a dog gets lost on bell festival day, the Bell Keeper rings the tower until dawn.", title: "The Bell Keeper's Ring",
  premise: "Nell's dog Biscuit vanishes on bell festival day, and the only kid who dares climb the cracked tower bell has to ring it before the whole town goes quiet.",
  price: "Every lost pet in town is gone by morning.",
  examples: ["Mrs. Pell rings a spoon on her bell and the hens all come home.", "Mr. Garnet's cat got lost once and the bells rang for a week.", "The mailman rings a tiny bell at every gate he passes."],
  narrator: "Nell, the only kid whose dog was lost on festival day and who can't stop ringing things.", prop: "Cracked brass sleigh bell",
  twist: "The Bell Keeper lost her own dog long ago, so Nell rings the cracked bell and the whole town rings with her until Biscuit comes home and the Keeper smiles.",
  teaser: "The bell only rings for the lost ones.", closer: "Here, when a dog goes missing, the whole town rings until it finds its way home.",
  formula: "F2", twistType: "T6", mood: "wholesome", setting: "town square", topic: "my dog got lost the day of the town's bell festival",
};
// The 257-word / 33-line first draft of that run. Its exact text was not saved (script.json was overwritten by the
// final rewrite, the ledger keeps only token counts), so this is a RECONSTRUCTION with the same word count, line count
// and story: the final 209-word script's lines plus the beat sheet's extra details, part sizes like the writer's overrun.
const DRAFT_257 = {
  title: "The Night Biscuit Got Lost",
  lines: [
    ...L("rule", "In this town, if a dog gets lost on bell festival day, the Bell Keeper rings the tower till dawn."),
    ...L("tour", "You see, lost pets are gone by morning.", "So everyone rings bells to call them home.", "Mrs. Pell's spoon brings her hens home.", "Mr. Garnet's lost cat got a week of bells.", "The mailman rings a tiny bell at every gate.", "Nobody here owns a quiet house."),
    ...L("me", "I'm Nell, and I can't stop ringing things.", "Doorbells, bike bells, the school bell at lunch.", "Biscuit is my best friend.", "I keep his cracked brass sleigh bell in my pocket."),
    ...L("until", "Until one night, Biscuit slipped his collar at the festival.", "I found his red collar on the cobblestones.", "Then the tower bell cracked.", "Every bell in town went quiet.", "The lanterns went out one by one.", "Nobody could call anything home."),
    ...L("discovery", "I climbed the creaky tower.", "The Keeper sat alone by the bell.", "She held a faded dog collar in her lap.", "The bell only rings for the lost ones.", "She lost her own dog long ago."),
    ...L("climax", "I pulled Biscuit's cracked sleigh bell out of my pocket.", "I swung it hard against the great bell.", "Ting. Ting.", "Rings of sound rolled across town.", "Mrs. Pell grabbed her spoon and rang.", "Mr. Garnet and the mailman rang too.", "Then Biscuit sprinted into the square, straight at me.", "Up in the tower, the Keeper smiled."),
    ...L("closer", "Now nobody rings alone anymore.", "She rings with us now.", "Here, when a dog goes missing, the whole town rings until it finds its way home."),
  ],
  post: { title: "My dog got lost on bell festival day", description: "Nell's dog Biscuit vanishes on bell festival day.", hashtags: ["#blockyworlds", "#lostdog"] },
};

test("length: the reconstructed 257-word draft is the real failure (33 lines, too long for 60 s, nothing else wrong)", () => {
  assert.equal(DRAFT_257.lines.length, 33);
  assert.equal(words(DRAFT_257), 257);
  assert.deepEqual(scriptProtocolCheck(DRAFT_257, 60, CARD).problems, ["Too long: 257 words, a 60 s video fits 212 at most."]);
});

test("length: the free trim alone brings the 257-word draft to <= 212 words and it passes every protocol check", () => {
  const t = trimForLength(DRAFT_257, 60, CARD);
  assert.ok(t.fits, `${t.words} words`);
  assert.ok(t.words <= 212 && t.words >= Math.round(targetWords(60) * BAND.written[0]), `${t.words} words in the band`);
  assert.deepEqual(scriptProtocolCheck(t.script, 60, CARD).problems, []);
  const kept = t.script.lines.map((l) => l.text);
  // the rule, every part's first line (its hook), the last line (the callback), the planted object in the climax and the truth
  assert.equal(kept[0], DRAFT_257.lines[0].text);
  assert.equal(kept.at(-1), DRAFT_257.lines.at(-1).text);
  for (const first of ["You see, lost pets are gone by morning.", "I'm Nell, and I can't stop ringing things.", "Until one night, Biscuit slipped his collar at the festival.", "I climbed the creaky tower.", "I pulled Biscuit's cracked sleigh bell out of my pocket.", "Now nobody rings alone anymore."]) assert.ok(kept.includes(first), first);
  assert.ok(kept.includes("She lost her own dog long ago."), "the twist's truth stays");
  // every part is still there, near its budget
  const used = partWords(t.script);
  for (const b of partLines(60)) assert.ok(used[b.id] >= 0.6 * b.words, `${b.id}: ${used[b.id]} of ~${b.words}`);
  // small, explainable changes: filler words and whole lines only
  assert.ok(t.changes.length <= 12 && t.changes.every((c) => c.to === null || c.to.length < c.from.length));
});

test("length: writeScript trims instead of paying for a rewrite (one call, stubbed fetch)", async () => {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const body = { model: "claude-sonnet-5-5", stop_reason: "end_turn", usage: { input_tokens: 1834, output_tokens: 1127, cache_read_input_tokens: 2505 }, content: [{ type: "text", text: JSON.stringify(DRAFT_257) }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const w = await writeScript({ apiKey: "test", provider: "anthropic", idea: CARD, lengthSec: 60 });
    assert.equal(calls, 1, "no paid rewrite");
    assert.equal(w.attempts, 1);
    assert.deepEqual(w.check.problems, []);
    assert.ok(w.check.words <= 212 && w.trimmed.length > 0);
  } finally {
    globalThis.fetch = real;
  }
});

test("length: the trim never breaks a check and never goes under the band; what it can't fix is left for the rewrite", () => {
  // 30 s (106 words max): the parts keep 60% of their budgets and two lines each, so 257 words can't fit; no new problem
  const t = trimForLength(DRAFT_257, 30, CARD);
  assert.equal(t.fits, false);
  assert.deepEqual(scriptProtocolCheck(t.script, 30, CARD).problems.filter((p) => !/^Too long/.test(p)), []);
  // already in range: untouched
  const ok = trimForLength(t.script, 90, CARD);
  assert.equal(ok.changes.length, 0);
  // the plain check (no card) works the same way
  const plain = trimScript(DRAFT_257, 60);
  assert.ok(plain.fits && !checkScript(plain.script, 60).problems.length);
});

test("length: the prompt gives per-part words AND lines, adds up, and asks for a count", () => {
  for (const s of [30, 60, 90, 120, 180]) {
    const plan = partLines(s);
    const lines = plan.reduce((a, b) => a + b.lines, 0), total = plan.reduce((a, b) => a + b.words, 0);
    assert.ok(total <= targetWords(s));
    assert.ok(Math.abs(total / lines - 7.5) < 2, `${s} s: ${total} words in ${lines} lines`);
  }
  const block = lengthBlock(60);
  assert.match(block, /LENGTH: 60 seconds = 191 to 212 words in total, in about 28 lines/);
  assert.match(block, /- tour: 5 lines, about 35 words/);
  assert.match(block, /BEFORE YOU ANSWER: count the words of every part/);
  // the beat sheet carries the plan's numbers
  const p = scriptPrompt({ idea: EXAMPLE_IDEAS[0], lengthSec: 60, beats: [{ part: "tour", summary: "s", shows: "x", words: 60 }] });
  assert.match(p, /\[tour\] s \| on screen: x \| 5 line\(s\), ~35 words/);
});
