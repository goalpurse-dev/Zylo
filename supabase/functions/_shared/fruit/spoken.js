// Did the voice say the line? Compares a clip's transcript with the written
// line and tells a REAL difference (a dropped name, an added word, "knowed"
// for "know") from the noise speech-to-text adds (20 for twenty, Blue for
// Blu, gray for grey, Perrie for Perry). Pure; used by the clip check
// (clipCheck.js) and to decide what a caption shows (final.js).

const clean = (w) => String(w ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
/** Words: lower-case, hyphens split ("whisper-fighting", "Anti-Dot"), punctuation gone. */
export const spokenTokens = (text) => String(text ?? "").replace(/[-–—/]/g, " ").split(/\s+/).map(clean).filter(Boolean);

// Numbers and units are written many ways ("$11,000", "eleven thousand dollars", "8 a.m."): never compared.
const NUMBERISH = new Set(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million", "billion", "dollar", "dollars", "buck", "bucks", "quid", "pound", "pounds", "euro", "euros", "percent", "am", "pm", "oclock"]);
const isNumberish = (w) => /\d/.test(w) || NUMBERISH.has(w);
// Small words the voice swallows or the transcript guesses ("shoes are brand new" heard as "shoes a brand new").
const SMALL = new Set(["a", "an", "the", "is", "are", "am", "was", "were", "be", "do", "does", "did", "to", "of", "in", "on", "at", "it", "its", "i", "im", "id", "ill", "ive", "you", "your", "youre", "he", "hes", "she", "shes", "we", "they", "and", "or", "but", "so", "that", "thats", "this", "for", "oh", "uh", "um", "ah", "eh", "hm", "hmm", "mm", "yeah", "yo", "ha", "just", "got", "have", "has", "had", "would", "will", "what", "whats", "my", "me", "not", "no", "up", "if", "as", "with", "from"]);

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** The consonants that carry a word's sound: "perry" and "perrie" → "pr", "grey" and "gray" → "gr". */
const skeleton = (w) => w[0] + w.slice(1).replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1");

/** The same word as heard: equal, one letter apart, or the same consonants (a spelling the transcript chose). */
export function sameWord(a, b) {
  if (a === b) return true;
  const long = Math.max(a.length, b.length);
  if (long >= 4 && levenshtein(a, b) <= 1) return true;
  return long >= 3 && Math.abs(a.length - b.length) <= 2 && a[0] === b[0] && skeleton(a) === skeleton(b);
}

/**
 * @param {string} line        the written line
 * @param {string} transcript  what speech-to-text heard
 * @returns {{same:boolean, missing:string[], added:string[]}}
 *   missing: content words of the line the voice never said; added: content words it said that aren't in the line.
 */
export function spokenDiff(line, transcript) {
  const content = (text) => spokenTokens(text).filter((w) => !isNumberish(w) && !SMALL.has(w));
  const L = content(line), T = content(transcript);
  // Longest common subsequence under sameWord, so order matters and each heard word is used once.
  const dp = Array.from({ length: L.length + 1 }, () => new Array(T.length + 1).fill(0));
  for (let i = L.length - 1; i >= 0; i--) for (let j = T.length - 1; j >= 0; j--) {
    dp[i][j] = sameWord(L[i], T[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const usedL = new Set(), usedT = new Set();
  for (let i = 0, j = 0; i < L.length && j < T.length;) {
    if (sameWord(L[i], T[j])) { usedL.add(i); usedT.add(j); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  let missing = L.filter((_, i) => !usedL.has(i));
  let added = T.filter((_, j) => !usedT.has(j));
  // One heard word for two written ones or the reverse ("Auntie Dot" → "antidot"): compare them joined.
  if (missing.length && added.length && sameWord(missing.join(""), added.join(""))) { missing = []; added = []; }
  return { same: missing.length === 0 && added.length === 0, missing, added };
}

/** Short reason for logs and job notes, or "" when the line was spoken as written. */
export function spokenProblem(line, transcript) {
  const d = spokenDiff(line, transcript);
  if (d.same) return "";
  const parts = [];
  if (d.missing.length) parts.push(`not said: ${d.missing.join(", ")}`);
  if (d.added.length) parts.push(`added: ${d.added.join(", ")}`);
  return `the voice changed the line (${parts.join("; ")})`;
}
