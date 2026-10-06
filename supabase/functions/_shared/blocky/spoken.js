// Did the voice say the line? Compares a clip's transcript with the written
// line in two steps. First it drops the noise speech-to-text adds (20 for
// twenty, Blue for Blu, gray for grey, Perrie for Perry). Then it weighs what
// is left: a dropped name or a swapped word MATTERS (the clip is made again,
// and the caption shows what was said); a slur ("knowed" for "know"), a lost
// filler or one stray sound does not. Pure; used by the clip check
// (clipCheck.js) and to decide what a caption shows (blocky-story-api).

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
 * @returns {{same:boolean, missing:string[], added:string[], matters:boolean, why:string}}
 *   missing: content words of the line the voice never said; added: content words it said that aren't in the line;
 *   matters: the difference changes what a viewer hears (see weigh); why: that difference in words.
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
  const { matters, why } = weigh(missing, added);
  return { same: missing.length === 0 && added.length === 0, missing, added, matters, why };
}

// Words a line can lose without losing its meaning ("Okay, fine" / "you get me, bruv").
const FILLER = new Set(["okay", "ok", "well", "like", "really", "right", "hey", "man", "bro", "bruv", "fam", "mate", "innit", "nah", "look", "listen", "wait", "please", "actually", "literally", "honestly", "basically", "fine", "sure", "now", "then", "there", "here"]);

/** One word bent into another form of itself: know/knowed, ask/asking. A slur, not a different word. */
const sameStem = (a, b) => {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.startsWith(short) && long.length - short.length <= 3;
};

/**
 * Does the difference MATTER: would a viewer hear a different line? Only that
 * is worth making the clip again for.
 *   matters:        a name or another content word the voice never said, or a
 *                   word swapped for a different one ("everything" → "everyone"),
 *                   or a whole extra phrase (two or more added words).
 *   doesn't matter: a word bent into another form of itself ("know" → "knowed"),
 *                   a dropped filler ("bruv", "okay"), one stray added sound
 *                   ("Ike,", a laugh). Seedance did these in 2 of its first 8
 *                   clips; remaking them would cost more than they hurt.
 */
function weigh(missing, added) {
  const extra = [...added];
  const lost = [];
  for (const w of missing) {
    const bent = extra.findIndex((x) => sameStem(w, x));
    if (bent >= 0) { extra.splice(bent, 1); continue; }   // the same word, slurred
    if (!FILLER.has(w)) lost.push(w);
  }
  const phrase = extra.filter((w) => w.length >= 4 && !FILLER.has(w));
  if (lost.length) return { matters: true, why: `not said: ${lost.join(", ")}${extra.length ? `; said instead: ${extra.join(", ")}` : ""}` };
  if (phrase.length >= 2) return { matters: true, why: `added: ${phrase.join(", ")}` };
  return { matters: false, why: "" };
}

/** Short reason for logs and job notes, or "" when the line was spoken as written (or near enough not to matter). */
export function spokenProblem(line, transcript) {
  const d = spokenDiff(line, transcript);
  return d.matters ? `the voice changed the line (${d.why})` : "";
}
