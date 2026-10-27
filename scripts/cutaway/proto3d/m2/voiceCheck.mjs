// M2: the voice safety check (free): the take transcribed locally (transcribe.py, faster-whisper) and compared word by
// word with the script. Both texts are first written one way (normWords): case, punctuation, hyphens, contractions and
// compounds ("can not"/"cannot", "in to"/"into"), letters said one by one ("US"/"U.S."/"U S"), numbers in any format
// ("1,500"/"1 500"/"one thousand five hundred"/"fifteen hundred"). Then only real problems fail it (compareWords):
// a missing or extra chunk of 2+ words (a garble like "and in mind"), a repeated word ("car, car"), a wrong number, a
// different content word ("pit"/"pot"). A different little word ("a"/"the", "add"/"at"), one missing or extra word, an
// ending or a long word's spelling heard differently ("hinged"/"hinge", "Flagg"/"flag") is a note; too many notes
// (over 8% of the words) fail it too.
// The owner's rule of 2026-10-27, after three false alarms in production (each fixed one word at a time before).
//   node m2/voiceCheck.mjs voice.mp3 script.json FFMPEG   (prints the result)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { thousand: 1e3, million: 1e6, billion: 1e9 };
// a contraction, "cannot" and its like are their words ("can't", "can not" and "cannot" all read "can not"); a unit
// written short is its word
const EXPAND = { lb: "pounds", lbs: "pounds", ft: "feet", sq: "square", gal: "gallons", mph: "miles per hour", cannot: "can not", cant: "can not", dont: "do not", doesnt: "does not", didnt: "did not", isnt: "is not", arent: "are not", wasnt: "was not", werent: "were not", wont: "will not", wouldnt: "would not", shouldnt: "should not", couldnt: "could not", hasnt: "has not", havent: "have not", hadnt: "had not", its: "it is", thats: "that is", theres: "there is", whats: "what is", heres: "here is", youre: "you are", youve: "you have", youll: "you will", theyre: "they are", weve: "we have", lets: "let us" };
// the little words a listener barely hears: one heard for another, or one extra or missing, is a note ("not" and "no"
// are never little: they turn a sentence round)
const LITTLE = new Set(["a", "an", "the", "in", "on", "of", "to", "at", "or", "and", "but", "so", "is", "it", "as", "for", "with", "by", "from", "that", "this", "then", "than", "be", "are", "was", "were", "its", "their", "your", "our", "up", "out", "off", "just", "now", "there", "here", "which", "who", "also", "too", "very", "will", "has", "have", "had", "do", "does", "can", "into", "onto", "you", "we", "they", "he", "she", "them", "all"]);
const isNum = (w) => /^\d/.test(w);

/** a run of number words as one number: "one hundred forty" 140, "fifteen hundred" 1500, "nineteen fifty two" 1952 */
function numberRun(raw, i) {
  let total = 0, cur = 0, j = i, any = false;
  for (; j < raw.length; j++) {
    const x = raw[j];
    if (x in UNITS || x in TENS) {
      const v = UNITS[x] ?? TENS[x];
      // a year said in pairs: "nineteen fifty", "twenty twenty"
      if (any && cur % 100 >= 10 && cur < 100 && (v >= 10)) cur = cur * 100 + v;
      else if (any && cur % 10 !== 0 && v < 10) break; // "five six": two numbers
      else cur += v;
      any = true;
    } else if (x === "hundred" && any) cur = (cur || 1) * 100;
    else if (x in SCALES && any) { total += (cur || 1) * SCALES[x]; cur = 0; }
    else if (x === "and" && any && (raw[j + 1] in UNITS || raw[j + 1] in TENS)) continue;
    else break;
  }
  return { n: total + cur, j };
}

/** the words as compared (see the top): lower case, one spelling, numbers as digits */
export function normWords(text) {
  const raw = String(text).toLowerCase()
    .replace(/%/g, " percent ").replace(/&/g, " and ")
    // a number's thousands written any way is one number: "1,500", "1 500", "1.500", "10 ,000"
    .replace(/\b(\d{1,3})[\s  ]*[,.]?[\s  ]*(?=\d{3}\b)/g, "$1").replace(/\b(\d{1,3})[\s  ]*[,.]?[\s  ]*(?=\d{3}\b)/g, "$1")
    .replace(/[‘’]/g, "'").replace(/[-‐-―/]/g, " ").replace(/[^a-z0-9.' ]+/g, " ").replace(/\.(?!\d)/g, " ").replace(/'/g, "")
    .split(/\s+/).filter(Boolean);
  // letters said one by one are one word: "u s" (from "U.S.", "U. S.", "U-S") is "us"
  const letters = [];
  for (let i = 0; i < raw.length; i++) {
    if (/^[b-hj-z]$/.test(raw[i]) && /^[a-z]$/.test(raw[i + 1] ?? "")) { let k = i, w = ""; while (/^[a-z]$/.test(raw[k] ?? "")) w += raw[k++]; letters.push(w); i = k - 1; } else letters.push(raw[i]);
  }
  const words = letters.flatMap((w) => (EXPAND[w] ?? w).split(" "));
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // "10 thousand", "1.5 million"
    if (/^\d+(\.\d+)?$/.test(w) && words[i + 1] in SCALES) { out.push(String(Math.round(Number(w) * SCALES[words[i + 1]]))); i++; continue; }
    // "a hundred" is 100
    if (w === "a" && (words[i + 1] === "hundred" || words[i + 1] in SCALES)) { words[i] = "one"; i--; continue; }
    if (!(w in UNITS || w in TENS)) { out.push(w); continue; }
    const { n, j } = numberRun(words, i);
    out.push(String(n)); i = j - 1;
  }
  return out;
}

// an ending heard differently ("hinged" heard "hinge", "close" heard "closed", "solids" heard "solid")
const stem = (w) => w.replace(/(ing|ed|es|s|d|e)$/, "");
const ENDINGS = new Set(["s", "es", "d", "ed", "ing", "e", "r", "er", "ly"]);
const ending = (x, y) => { const [s, l] = x.length <= y.length ? [x, y] : [y, x]; return s.length >= 3 && l.startsWith(s) && ENDINGS.has(l.slice(s.length)); };
// a long word spelt one letter off ("Flagg"/"flag", "grass"/"grasp"): the transcript's spelling, not a different word
// (short words must match: "pit" heard "pot" fails)
const oneOff = (x, y) => {
  if (Math.max(x.length, y.length) < 5 || Math.abs(x.length - y.length) > 1 || x.slice(0, 2) !== y.slice(0, 2)) return false;
  let i = 0; while (x[i] === y[i]) i++;
  return x.slice(i + 1) === y.slice(i + 1) || x.slice(i + 1) === y.slice(i) || x.slice(i) === y.slice(i + 1);
};
const same = (x, y) => x === y || (x.length > 3 && !isNum(x) && !isNum(y) && (stem(x) === stem(y) || ending(x, y) || oneOff(x, y)));
// two short words that start alike, one heard for the other ("Add a grass cap" heard "at a grass cap"): an unstressed sound
const minor = (x, y) => (LITTLE.has(x) && LITTLE.has(y)) || (x.length <= 3 && y.length <= 3 && x.length > 1 && x[0] === y[0] && x.match(/[aeiouy]/)?.[0] === y.match(/[aeiouy]/)?.[0] && !/\d/.test(x + y));

/** script words vs heard words: the alignment, the real problems (fail) and the notes (pass) */
export function compareWords(scriptText, heardText, { maxNoteRate = 0.08 } = {}) {
  const a = normWords(scriptText), b = normWords(heardText), n = a.length, m = b.length;
  // edit distance where a word written as two ("ground water"/"groundwater", "box shaped"/"boxshaped") costs nothing
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const sub = (i, j) => (same(a[i - 1], b[j - 1]) ? 0 : 1);
  const join21 = (i, j) => i > 1 && j > 0 && a[i - 2] + a[i - 1] === b[j - 1];
  const join12 = (i, j) => i > 0 && j > 1 && a[i - 1] === b[j - 2] + b[j - 1];
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + sub(i, j));
    if (join21(i, j)) D[i][j] = Math.min(D[i][j], D[i - 2][j - 1]);
    if (join12(i, j)) D[i][j] = Math.min(D[i][j], D[i - 1][j - 2]);
  }
  // the path, oldest first: { op: "same"|"sub"|"miss"|"extra", s: script index, h: heard index }
  const ops = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && join21(i, j) && D[i][j] === D[i - 2][j - 1]) { ops.unshift({ op: "same", s: i - 2, h: j - 1 }); i -= 2; j--; }
    else if (i > 0 && j > 0 && join12(i, j) && D[i][j] === D[i - 1][j - 2]) { ops.unshift({ op: "same", s: i - 1, h: j - 2 }); i--; j -= 2; }
    else if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + sub(i, j)) { ops.unshift({ op: a[i - 1] === b[j - 1] || same(a[i - 1], b[j - 1]) ? (a[i - 1] === b[j - 1] ? "same" : "ending") : "sub", s: i - 1, h: j - 1 }); i--; j--; }
    else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.unshift({ op: "miss", s: i - 1, h: j }); i--; }
    else { ops.unshift({ op: "extra", s: i, h: j - 1 }); j--; }
  }
  const after = (s) => `(after "${a.slice(Math.max(0, s - 3), s).join(" ")}")`;
  const problems = [], notes = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].op === "same") continue;
    if (ops[k].op === "ending") { notes.push(`"${a[ops[k].s]}" heard as "${b[ops[k].h]}" ${after(ops[k].s)}`); continue; }
    // a run of differences side by side
    let e = k; while (e + 1 < ops.length && ["miss", "extra", "sub"].includes(ops[e + 1].op)) e++;
    const run = ops.slice(k, e + 1), at = after(run[0].s);
    const missing = run.filter((r) => r.op === "miss").map((r) => a[r.s]), extra = run.filter((r) => r.op === "extra").map((r) => b[r.h]);
    const subs = run.filter((r) => r.op === "sub").map((r) => [a[r.s], b[r.h]]);
    // a stutter: an extra word that repeats the word next to it ("a car, car")
    const repeated = run.filter((r) => r.op === "extra" && !LITTLE.has(b[r.h]) && (b[r.h] === b[r.h - 1] || b[r.h] === b[r.h + 1]));
    const gone = `${missing.length ? `missing "${missing.join(" ")}"` : ""}${missing.length && extra.length ? ", " : ""}${extra.length ? `extra "${extra.join(" ")}"` : ""}`;
    if (repeated.length) problems.push(`repeated "${repeated.map((r) => b[r.h]).join(" ")}" ${at}`);
    else if ([...missing, ...extra, ...subs.flat()].some(isNum)) problems.push(`wrong number: ${[gone, ...subs.map(([x, y]) => `"${x}" heard as "${y}"`)].filter(Boolean).join(", ")} ${at}`);
    // a chunk of 2+ words missing or extra (a garble: "and in mind, clean water" for "and clean water")
    else if (missing.length + extra.length >= 2) problems.push(`${gone} ${at}`);
    else {
      // one word missing or extra (the transcript drops or adds one now and then: "sludge and mean oil"): a note
      if (missing.length + extra.length) notes.push(`${gone} ${at}`);
      for (const [x, y] of subs) (minor(x, y) ? notes : problems).push(`${minor(x, y) ? "" : "different word: "}"${x}" heard as "${y}" ${at}`);
    }
    k = e;
  }
  if (notes.length > Math.max(3, maxNoteRate * n)) problems.push(`${notes.length} small differences in ${n} words: more than a clean take has`);
  return { ok: problems.length === 0, problems, notes, scriptWords: n, heardWords: m };
}

/** transcribe a take (free, local) and compare it with the script text */
export function checkVoice({ voice, text, ff, python = "python", model = "small.en" }) {
  const out = execFileSync(python, [path.join(here, "transcribe.py"), voice, ff, model], { maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] }).toString();
  const heard = JSON.parse(out);
  return { ...compareWords(text, heard.text), heard: heard.text, words: heard.words };
}

if (/voiceCheck\.mjs$/.test(process.argv[1] ?? "")) {
  const [voice, scriptFile, ff] = process.argv.slice(2);
  const s = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
  const r = checkVoice({ voice, text: s.sentences.map((x) => x.text).join(" "), ff });
  console.log(JSON.stringify({ ok: r.ok, problems: r.problems, notes: r.notes, heard: r.heard }, null, 1));
}
