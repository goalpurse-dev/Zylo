// Blocky Worlds planner: text helpers (owner: PLANNER). Tokens, word-timing alignment, the silent word estimate.
// Pure, deterministic, Node + browser.

/** A word reduced to its letters/digits, lowercase ("Bakery's," -> "bakerys"). */
export const norm = (w) => String(w ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]/g, "");

/** The spoken tokens of a line, with their raw text (punctuation attached). Empty tokens (a lone dash) are dropped. */
export const tokens = (text) => String(text ?? "").trim().split(/\s+/).filter((w) => norm(w));

/** Syllables in a word (vowel groups, a silent final e dropped); at least 1. Digits count one per digit. */
export function syllables(word) {
  const w = norm(word);
  if (!w) return 1;
  if (/^\d+$/.test(w)) return Math.max(1, w.length * 1.5);
  let s = (w.match(/[aeiouy]+/g) || []).length;
  if (/[^aeiou]e$/.test(w) && !/[^aeiou]le$/.test(w) && s > 1) s -= 1;
  if (/(ed)$/.test(w) && !/[td]ed$/.test(w) && s > 1) s -= 1;
  return Math.max(1, s);
}

const round = (x) => Math.round(x * 1000) / 1000;

/**
 * A silent fallback for word timings: per-word durations from syllable counts, scaled so the whole script runs at
 * `wpm` words a minute (before gaps), with a 0.12 s gap after every sentence end (. ! ? and every line end).
 */
export function estimateWords(script, wpm = 260) {
  const all = [];
  for (const line of script?.lines ?? []) {
    const toks = tokens(line.text ?? line);
    toks.forEach((w, i) => all.push({ word: w, sentenceEnd: i === toks.length - 1 || /[.!?]["']?$/.test(w) }));
  }
  if (!all.length) return [];
  const totalSyl = all.reduce((a, w) => a + syllables(w.word), 0);
  const perSyl = ((all.length * 60) / wpm) / totalSyl;
  let t = 0;
  return all.map((w) => {
    const start = t, end = t + syllables(w.word) * perSyl;
    t = end + (w.sentenceEnd ? 0.12 : 0);
    return { word: w.word, start: round(start), end: round(end) };
  });
}

/**
 * Aligns script tokens to TTS words by normalized text (longest common subsequence), tolerant of misses, extra words
 * and punctuation. Returns for every script token the index of its word (matched or interpolated), monotone.
 * flat: [{ line, k, raw, n }]; words: [{ word, start, end }].
 */
export function alignTokens(flat, words) {
  const A = flat.map((t) => t.n), B = words.map((w) => norm(w.word));
  const n = A.length, m = B.length;
  const out = new Array(n).fill(-1);
  if (!n || !m) return out.map((_, i) => ({ word: Math.max(0, Math.min(m - 1, i)), matched: false }));
  // LCS table (n, m ~ a few hundred: fine).
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    L[i][j] = A[i] && A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  for (let i = 0, j = 0; i < n && j < m;) {
    if (A[i] && A[i] === B[j]) { out[i] = j; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  // Interpolate the misses between matched neighbours.
  const matched = out.map((v) => v >= 0);
  for (let i = 0; i < n; i++) {
    if (out[i] >= 0) continue;
    let p = i - 1; while (p >= 0 && !matched[p]) p--;
    let q = i + 1; while (q < n && !matched[q]) q++;
    const lo = p >= 0 ? out[p] : -1, hi = q < n ? out[q] : m;
    const frac = (i - p) / (q - p);
    out[i] = Math.min(m - 1, Math.max(0, Math.round(lo + (hi - lo) * frac)));
  }
  for (let i = 1; i < n; i++) if (out[i] < out[i - 1]) out[i] = out[i - 1];
  return out.map((v, i) => ({ word: v, matched: matched[i] }));
}
