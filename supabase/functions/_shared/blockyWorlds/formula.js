// Blocky Worlds: THE STORY FORMULA (owner, 2026-11-12). Pure: the prompt text, the numbers and the free checks.
//
//   0 s      "In this town, [rule]."            line 1, always
//   0-5 s    the RESULT-FIRST HOOK              line 2: the craziest consequence the narrator is in right now ("I" + "!")
//   ~5-15 s  2-3 VIGNETTES                      each in its OWN place, one quick joke each
//   ~15 s    the "But..." PIVOT                 puts the narrator in the worst case, with a NUMBER
//   15 s-    ESCALATION                         it doubles every 8-12 s; sentences of 3-10 words; a sound word on the hits
//   late     "Then I noticed something"         the narrator wins with the town's own rule
//   last     the BUTTON                         2-6 words, reopens the loop (a callback)
//
// Pace: ~4.3 spoken words a second of video (255-280 a minute after the engine's 1.25x speed-up), ~70 words in the first
// 15 s. config.js PACE.targetWpm holds the number; a 1:30 video is ~385 words.
//
// The checks are ADVISORY notes that start with FORMULA_PREFIX (they never block). A note names its lines like
// "(line 7)" or "(lines 9, 10)", so the page's "Fix it" can rewrite just that part (protocol.js problemSpots). What is fixed
// without asking: the sound-word tags (sfxTags.js; normalizeScript fills `line.sfx` from the text).
import { wordCount } from "./script.js";
import { PACE } from "./config.js";
import { sfxTags } from "./sfxTags.js";
import { SOUND_ALLOWED } from "./soundLibrary.js";

export const FORMULA_PREFIX = "Formula:";
export const FORMULA = Object.freeze({
  wordsPerSec: PACE.targetWpm / 60,
  hookByWords: 26,         // the hook ends by ~6 s (5 s, one second of grace)
  hookStartsByWords: 21,   // ...and starts inside the first 5 s
  hookMaxWords: 14,
  escalationMin: 3, escalationMax: 10,   // words per escalation sentence
  doubleEverySec: 12,      // one sound word per this many seconds of escalation, at least
  buttonWords: Object.freeze([2, 6]),
  vignettes: Object.freeze([2, 3]),
});

/** The formula as prompt text (both writers quote it; the same bytes every call, so it caches). */
export const FORMULA_TEXT = `THE STORY FORMULA (every script follows it; free checks read it):
- Line 1 is ALWAYS "In this town, [rule]." (8 to 14 words).
- Line 2 is the RESULT-FIRST HOOK, inside the first 5 seconds: the craziest consequence the narrator is in RIGHT NOW, first person, 5 to 12 words, ending on the most visual word and an exclamation mark ("And I just sneezed in the cockpit of a flying plane!"). It must be something our blocky world can film, and it opens a question the viewer wants answered. Never a summary, never a question.
- Then 2 or 3 VIGNETTES of the rule, each in its OWN place (a kitchen, the school, the bus stop...) with its own named neighbour and one quick joke. About 70 words in the first 15 seconds in all.
- Then the "But..." PIVOT, a line that starts with "But" and puts the narrator in the worst case of the rule, WITH A NUMBER ("But I had ten minutes and four hundred stairs.").
- Then the ESCALATION: it doubles every 8 to 12 seconds (one, ten, a hundred; two, four, eight). Sentences of 3 to 10 words. Hits get a SOUND WORD as its own short fragment of at most three words ("Boom!", "Knock. Knock.", "Crash, bang, thud!"), at least one every 12 seconds; the engine puts an effect on every one. Use ONLY these sound words, the ones we have a sound for (any other sound word is flagged): ${SOUND_ALLOWED.join(", ")}.
- Then a line that says "Then I noticed something." and the narrator WINS using the town's OWN rule (and the ally's planted line), no new magic.
- The LAST line is a BUTTON of 2 to 6 words that reopens the loop (a callback to something earlier, with a new twist on it).`;

const NUM_WORD = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen|double|twice)\b/i;
const NUM_VAL = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, dozen: 12 };
/** A number in a text: digits or a number word. */
export const hasNumber = (t) => /\d/.test(String(t ?? "")) || NUM_WORD.test(String(t ?? ""));
/** The largest number a text names (digits, "forty", "two hundred", "a thousand"), 0 when none. */
export function biggestNumber(t) {
  const s = String(t ?? "").toLowerCase();
  let best = 0;
  for (const m of s.match(/\d[\d,]*/g) ?? []) best = Math.max(best, Number(m.replace(/,/g, "")) || 0);
  const toks = s.split(/[^a-z]+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    let v = NUM_VAL[toks[i]];
    const mult = { hundred: 100, thousand: 1000, million: 1e6 };
    if (mult[toks[i]]) v = mult[toks[i]]; // "a thousand" on its own
    if (!v) continue;
    let j = i + 1;
    while (!mult[toks[i]] && mult[toks[j]]) { v *= mult[toks[j]]; j++; }
    best = Math.max(best, v);
  }
  return best;
}

const PLACE = /\b(kitchen|bedroom|bathroom|attic|cellar|basement|garage|garden|yard|backyard|porch|roof|hallway|hall|stairs|classroom|school|playground|gym|library|shop|store|market|bakery|cafe|diner|bus stop|bus|station|train|park|pond|lake|river|bridge|hill|field|farm|barn|woods|forest|street|road|alley|square|church|clinic|office|factory|pool|beach|window|living room|dining room|fence|corner)\b/gi;
const FIRST_PERSON = /\b(I|I'm|I've|I'd|I'll|my|me|we|we're|our|us)\b/;

const secs = (w) => w / FORMULA.wordsPerSec;
const fmt = (n) => Number(n.toFixed(1));
const lineWords = (lines) => lines.map((l) => wordCount(l.text));
const lineTag = (idx) => `(${idx.length === 1 ? "line" : "lines"} ${idx.map((i) => i + 1).join(", ")})`;
/** Words before line i (cumulative). */
const before = (counts, i) => counts.slice(0, i).reduce((a, b) => a + b, 0);

/**
 * The formula's free checks of a script: an array of notes (empty = the script follows the formula). Every note starts with
 * FORMULA_PREFIX and names its lines. lengthSec sizes the 15-second window for short videos.
 */
export function formulaProblems(script, lengthSec = 90) {
  const lines = script?.lines ?? [];
  if (lines.length < 4) return [];
  const out = [];
  const bad = (what, idx = []) => out.push(`${FORMULA_PREFIX} ${what}${idx.length ? ` ${lineTag(idx)}` : ""}`);
  const counts = lineWords(lines), total = counts.reduce((a, b) => a + b, 0);
  const n = lines.length;
  const hasBeats = lines.some((l) => l.beat);
  const idxOf = (id) => lines.map((l, i) => (l.beat === id ? i : -1)).filter((i) => i >= 0);
  const pct = (i) => (before(counts, i) / Math.max(1, total)) * 100;

  // 1. the hook: line 2 (or 3), first person, an exclamation, started by 5 s and done by ~6 s
  const hookAt = [1, 2].find((i) => i < n && FIRST_PERSON.test(lines[i].text) && /!["']?$/.test(lines[i].text.trim()));
  if (hookAt === undefined) bad("there is no result-first hook after the opener: line 2 should be the craziest consequence the narrator is in right now, first person, ending with an exclamation mark.", [1]);
  else {
    const start = before(counts, hookAt), end = start + counts[hookAt];
    if (start > FORMULA.hookStartsByWords || end > FORMULA.hookByWords) bad(`the hook comes too late: it ends at ${fmt(secs(end))} s (it should be inside the first 5 s). Shorten the opener or the hook.`, [hookAt]);
    if (counts[hookAt] > FORMULA.hookMaxWords) bad(`the hook is ${counts[hookAt]} words; keep it under ${FORMULA.hookMaxWords + 1}.`, [hookAt]);
    if (/\?$/.test(lines[hookAt].text.trim())) bad("the hook is a question; make it the result.", [hookAt]);
  }

  // 2. the "But..." pivot: starts with But, has a number, lands near 15 s (about 70 words in)
  const lo = Math.min(55, Math.round(total * 0.15)), hi = Math.min(95, Math.round(total * 0.28));
  const pivotAt = lines.findIndex((l, i) => i > 1 && /^but\b/i.test(l.text.trim()) && pct(i) < 50);
  if (pivotAt < 0) bad('there is no "But..." pivot line in the first half that puts the narrator in the worst case of the rule.');
  else {
    if (!hasNumber(lines[pivotAt].text)) bad('the "But..." pivot has no number; put a number on the worst case ("ten thousand runners", "four hundred stairs").', [pivotAt]);
    const w = before(counts, pivotAt);
    if (w < lo || w > hi) bad(`the "But..." pivot comes after ${w} words (${fmt(secs(w))} s); aim for ${lo} to ${hi} words (about 15 s).`, [pivotAt]);
  }

  // 3. two or three vignettes, each in its own place (before the pivot, after the hook)
  const vig = hasBeats && idxOf("neighbours").length ? idxOf("neighbours") : lines.map((_, i) => i).filter((i) => i > 1 && (pivotAt < 0 ? pct(i) < 25 : i < pivotAt));
  if (vig.length >= 2) {
    const places = vig.map((i) => new Set((lines[i].text.match(PLACE) ?? []).map((p) => p.toLowerCase())));
    const distinct = new Set(places.flatMap((s) => [...s]));
    if (distinct.size < FORMULA.vignettes[0]) bad(`the vignettes need their OWN places (found ${distinct.size === 0 ? "none named" : [...distinct].join(", ")}); put each neighbour somewhere different (a kitchen, the school, the bus stop).`, vig);
  }

  // 4. the escalation: from the pivot to the "noticed" line: short sentences, sound words, rising numbers
  const noticedAt = lines.findIndex((l, i) => i > (pivotAt < 0 ? 1 : pivotAt) && /\bnoticed\b/i.test(l.text) && pct(i) > 45);
  // the escalation starts with the trouble (the trigger beat), else right after the pivot
  const trigAt = hasBeats ? idxOf("trigger")[0] : undefined;
  const escFrom = trigAt !== undefined ? trigAt : pivotAt < 0 ? Math.round(n * 0.3) : pivotAt + 1;
  const escTo = noticedAt < 0 ? Math.round(n * 0.7) : noticedAt;
  const esc = lines.map((_, i) => i).filter((i) => i >= escFrom && i < escTo);
  if (esc.length >= 3) {
    // sentences, not lines: a line with two sentences is checked sentence by sentence
    const longOnes = esc.filter((i) => String(lines[i].text).split(/(?<=[.!?])\s+/).some((s) => wordCount(s) > FORMULA.escalationMax));
    if (longOnes.length) bad(`the escalation needs short sentences of ${FORMULA.escalationMin} to ${FORMULA.escalationMax} words; these run long.`, longOnes.slice(0, 6));
    const escSecs = secs(esc.reduce((a, i) => a + counts[i], 0));
    const need = Math.max(2, Math.floor(escSecs / FORMULA.doubleEverySec));
    const have = esc.reduce((a, i) => a + sfxTags(lines[i].text).filter((w) => SOUND_ALLOWED.includes(w)).length, 0);
    if (have < need) bad(`the escalation has ${have} sound word${have === 1 ? "" : "s"} (Boom! Whoosh! Crash!) in ${fmt(escSecs)} s; it needs at least ${need}, each as its own short fragment so the engine can put a sound effect on it.`, esc.slice(0, 6));
    const nums = esc.map((i) => ({ i, v: biggestNumber(lines[i].text) })).filter((x) => x.v > 0);
    if (nums.length >= 3) {
      const first = nums[0].v, last = nums.at(-1).v;
      if (last < first * 2) bad("the numbers in the escalation do not grow; it should double every 8 to 12 seconds (one, ten, a hundred).", nums.map((x) => x.i).slice(0, 6));
    } else if (nums.length < 1) bad("the escalation names no numbers; the situation should visibly double (two, then ten, then a hundred).", esc.slice(0, 6));
  }

  // 4b. every sound word must be one we have a sound for (close cousins were mapped already, normalizeScript)
  const offList = lines.map((l, i) => ({ i, bad: sfxTags(l.text).filter((w) => !SOUND_ALLOWED.includes(w)) })).filter((x) => x.bad.length);
  if (offList.length) bad(`these sound words have no sound in our library: ${[...new Set(offList.flatMap((x) => x.bad))].join(", ")}. Use only ${SOUND_ALLOWED.join(", ")}, or take the sound word out.`, offList.map((x) => x.i).slice(0, 6));

  // 5. "Then I noticed something": a win from the town's own rule, late
  if (noticedAt < 0 && !lines.some((l, i) => /\bnoticed something\b/i.test(l.text) && pct(i) > 45)) bad('there is no "Then I noticed something." line where the narrator wins with the town\'s own rule.');

  // 6. the button: 2 to 6 words that call back the rule or the hook
  out.push(...buttonProblems(script));
  // 7. a sound should fit the thing that makes it ("blew her whistle. Beep!" is a whistle with a beep)
  out.push(...soundObjectProblems(script));
  return out;
}

const STOP = new Set("this that with from have then they them their there were what when where into just like very over only also still even ever your about after".split(" "));
const stem = (w) => w.replace(/(?:ing|ed|es|s)$/, "");
const keyWords = (t) => new Set(String(t ?? "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem).filter((w) => w.length >= 3));
/** The hook line index (line 2 or 3: first person, ends with "!"), else 1. */
const hookIndex = (lines) => { const i = [1, 2].find((k) => k < lines.length && FIRST_PERSON.test(lines[k].text) && /!["']?$/.test(lines[k].text.trim())); return i ?? 1; };

/**
 * The BUTTON checks (HARD in the hybrid writer, hybrid.js): the last line is 2 to 6 words AND calls back the rule (line 1)
 * or the hook (a content word of either comes back). Notes start with FORMULA_PREFIX and name the line.
 */
export function buttonProblems(script) {
  const lines = script?.lines ?? [];
  if (lines.length < 4) return [];
  const n = lines.length, [lo, hi] = FORMULA.buttonWords, last = lines[n - 1].text, w = wordCount(last);
  const out = [];
  const rule = lines[0].text, hook = lines[hookIndex(lines)]?.text ?? "";
  if (w < lo || w > hi) out.push(`${FORMULA_PREFIX} the last line is a ${w}-word line; the button must be ${lo} to ${hi} words that reopen the loop and call back the rule ("${rule.slice(0, 60)}") or the hook ("${hook.slice(0, 60)}"). ${lineTag([n - 1])}`);
  const target = new Set([...keyWords(rule), ...keyWords(hook)]);
  if (![...keyWords(last)].some((k) => target.has(k))) out.push(`${FORMULA_PREFIX} the button does not call back the rule or the hook: reuse a word or picture from "${rule.slice(0, 60)}" or "${hook.slice(0, 60)}". ${lineTag([n - 1])}`);
  return out;
}

/**
 * The free fallback when a rewrite misses the length: if the final line is too long, split off its LAST short sentence
 * (2 to 6 words) as the button, preferring the last one that calls back the rule or the hook. texts: the lines' texts to
 * work on; context: the script's first lines' texts (rule, hook). Returns the new texts (the same when nothing fits).
 */
export function buttonFallback(texts, context = texts) {
  const list = [...texts];
  const last = list.at(-1);
  if (last === undefined || wordCount(last) <= FORMULA.buttonWords[1]) return list;
  const [lo, hi] = FORMULA.buttonWords;
  const parts = String(last).match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (parts.length < 2) return list;
  const target = new Set([...keyWords(context[0]), ...keyWords(context[1]), ...keyWords(context[2])]);
  const ok = (s) => wordCount(s) >= lo && wordCount(s) <= hi;
  const echoing = parts.map((s, i) => ({ s, i })).filter((x) => ok(x.s) && [...keyWords(x.s)].some((k) => target.has(k)));
  const pick = echoing.at(-1) ?? parts.map((s, i) => ({ s, i })).filter((x) => ok(x.s)).at(-1);
  if (!pick) return list;
  const rest = parts.filter((_, i) => i !== pick.i).join(" ");
  list.pop();
  if (rest) list.push(rest);
  list.push(pick.s);
  return list;
}

/** What each thing can sound like: sounds that do NOT fit it (deny lists, kept small; our library has no whistle). */
export const OBJECT_SOUNDS = Object.freeze([
  { object: /\b(whistles?|whistled|whistling)\b/i, name: "whistle", deny: ["beep", "buzz", "ding", "click", "tap", "zap", "boing", "fizz"] },
  { object: /\bdoors?\b/i, name: "door", deny: ["splash", "ding", "zap", "beep", "twang", "fizz", "boing"] },
  { object: /\b(glass|windows?|panes?|mirrors?)\b/i, name: "glass", deny: ["beep", "buzz", "twang", "zap", "plop", "fizz", "boing", "whoosh"] },
  { object: /\b(water|puddles?|ponds?|rivers?|lakes?|rain)\b/i, name: "water", deny: ["knock", "slam", "click", "beep", "buzz", "bonk", "twang"] },
]);
/** A sound word next to a thing it doesn't fit (same line, or the line before): notes for Fix it, or drop the sound word. */
export function soundObjectProblems(script) {
  const lines = script?.lines ?? [], out = [];
  lines.forEach((l, i) => {
    const tags = sfxTags(l.text);
    if (!tags.length) return;
    const around = `${lines[i - 1]?.text ?? ""} ${l.text}`;
    for (const o of OBJECT_SOUNDS) {
      const clash = tags.filter((t) => o.deny.includes(t));
      if (clash.length && o.object.test(around)) out.push(`${FORMULA_PREFIX} the sound "${[...new Set(clash)].join(", ")}" does not fit the ${o.name} in this scene; use a sound that fits what happens, or take the sound word out. ${lineTag([i])}`);
    }
  });
  return out;
}

/** Every sound word of a script, in order, as { line, word } (the engine's list; also the checks' count). */
export function soundCues(script) {
  return (script?.lines ?? []).flatMap((l, line) => sfxTags(l.text).map((word) => ({ line, word })));
}

/** The 0-based line indexes a formula note names ("(line 7)", "(lines 9, 10)"); [] when it names none. */
export function formulaLines(note) {
  const m = String(note ?? "").match(/\(lines? ([\d, ]+)\)\s*$/);
  return m ? m[1].split(",").map((x) => Number(x.trim()) - 1).filter((i) => i >= 0) : [];
}
