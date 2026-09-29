// Phase 6a — user-facing text hygiene.
//
// 1. Encoding: models emit characters many UI fonts can't draw (U+2011
//    non-breaking hyphen rendered as "□" in "Hunter‑gatherer"), and text that
//    passed through a Windows-1252 decode arrives as C1 controls (U+0092 for
//    ’ — "You□re") or mojibake ("Youâ€™re"). Real typographic apostrophes,
//    quotes and dashes (’ “ ” – —) are KEPT — they're valid UTF-8 and
//    every system font draws them.
// 2. Never show internal/planner text: "(research to confirm…)" notes.
const CP1252_C1 = { "\u0091": "‘", "\u0092": "’", "\u0093": "“", "\u0094": "”", "\u0096": "–", "\u0097": "—", "\u0085": "…" };
const MOJIBAKE = [["â€™", "’"], ["â€˜", "‘"], ["â€œ", "“"], ["â€\u009d", "”"], ["â€“", "–"], ["â€”", "—"], ["â€¦", "…"], ["Ã©", "é"]];

export function cleanText(text) {
  let s = String(text ?? "");
  for (const [bad, good] of MOJIBAKE) s = s.split(bad).join(good);
  s = s.replace(/[\u0085\u0091-\u0097]/g, (c) => CP1252_C1[c] ?? "");
  s = s.replace(/[‐‑‒]/g, "-").replace(/[   ]/g, " ");
  s = s.replace(/[\u0080-\u009F�]/g, "");
  return s;
}

// Planner notes that must never reach a user.
const PLANNER_NOTE = /\s*\((?:[^()]*\b(?:research|confirm|verify|verification|to be checked|tbd|todo|source needed|citation needed|placeholder)\b[^()]*)\)/gi;
export function cleanUserText(text) {
  return cleanText(text).replace(PLANNER_NOTE, "").replace(/\s{2,}/g, " ").trim();
}
