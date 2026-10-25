// M2: the voice safety check (free): the take transcribed locally (transcribe.py, faster-whisper) and compared word by
// word with the script. A missing word, an extra word (a garble like "and in mind", a stutter like "car, car") or a
// different word fails it; only an ending heard differently ("reclaim"/"reclaimed") is let through, as a note.
//   node m2/voiceCheck.mjs voice.mp3 script.json FFMPEG   (prints the result)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** words as compared: lower case, no punctuation, "%" as "percent", spelled-out numbers as digits ("one hundred forty" -> "140") */
export function normWords(text) {
  // an abbreviation said as letters is one word: "U.S." and "U S" both become "us", as the script's "US" (the production
  // Landfill test of 2026-10-25 failed both takes on "490 US landfills" heard as "U.S.")
  const t0 = String(text).replace(/\b((?:[A-Za-z]\.){2,})/g, (m) => m.replace(/\./g, "")).replace(/\b[A-Z](?: [A-Z])+\b/g, (m) => m.replace(/ /g, ""));
  // a number's thousands written any way is one number: "1,500", "1 500" and "1.500" are all 1500 (the production Pond
  // test of 2026-10-25 failed both takes on "1,500" heard as "1 500")
  const raw = t0.toLowerCase().replace(/%/g, " percent ").replace(/\b(\d{1,3})[, .](?=\d{3}\b)/g, "$1").replace(/\b(\d{1,3})[, .](?=\d{3}\b)/g, "$1").replace(/[–—-]/g, " ").replace(/[^a-z0-9.' ]+/g, " ").replace(/\.(?!\d)/g, " ").replace(/'/g, "").split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (!(w in UNITS || w in TENS || (w === "hundred" && out.length && /^\d+$/.test(out.at(-1))) || w === "thousand")) { out.push(w); continue; }
    // a run of number words
    let total = 0, cur = 0, j = i;
    for (; j < raw.length; j++) {
      const x = raw[j];
      if (x in UNITS) cur += UNITS[x]; else if (x in TENS) cur += TENS[x]; else if (x === "hundred") cur = (cur || 1) * 100; else if (x === "thousand") { total += (cur || 1) * 1000; cur = 0; } else if (x === "and" && j + 1 < raw.length && (raw[j + 1] in UNITS || raw[j + 1] in TENS)) continue; else break;
    }
    out.push(String(total + cur)); i = j - 1;
  }
  return out;
}

const stem = (w) => w.replace(/(ing|ed|es|s|d)$/, "");
// an unstressed little word heard as another ("the French in French drain" heard "and"): a mishearing, noted, not failed
// (a missing or an extra word still fails, little or not)
const LITTLE = new Set(["a", "an", "the", "in", "and", "on", "of", "to", "at", "or", "is", "it", "as"]);

/** script words vs heard words: the edit path, and what it found */
export function compareWords(scriptText, heardText) {
  const a = normWords(scriptText), b = normWords(heardText);
  const n = a.length, m = b.length, D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const same = (x, y) => x === y || (x.length > 3 && stem(x) === stem(y));
  // two short words that start alike, one heard for the other ("Add a grass cap" heard "at a grass cap"): a mishearing
  // of an unstressed sound, noted; a missing or an extra word still fails
  const minor = (x, y) => same(x, y) || (LITTLE.has(x) && LITTLE.has(y)) || (x.length <= 3 && y.length <= 3 && x[0] === y[0] && x.match(/[aeiouy]/)?.[0] === y.match(/[aeiouy]/)?.[0] && x.length > 1 && !/\d/.test(x + y));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 1));
  const problems = [], notes = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) (minor(a[i - 1], b[j - 1]) ? notes : problems).unshift(`"${a[i - 1]}" heard as "${b[j - 1]}" (after "${a.slice(Math.max(0, i - 4), i - 1).join(" ")}")`);
      i--; j--;
    } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { problems.unshift(`missing "${a[i - 1]}" (after "${a.slice(Math.max(0, i - 4), i - 1).join(" ")}")`); i--; }
    else { problems.unshift(`extra "${b[j - 1]}" (after "${a.slice(Math.max(0, i - 3), i).join(" ")}")`); j--; }
  }
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
