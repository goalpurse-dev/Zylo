// In This Town: WHAT MAY STOP A PAID USER (owner, 2026-11-17, after "The Town Where Lies Grow Animal Noses" was stuck at
// the Script step on a style rule). Only REAL BLOCKERS stop "Make my video":
//   - unsafe content, famous stories' names, a game platform's terms (safety.js: 'Uses "..."')
//   - real brands and stories with nothing to show (studioBuilds.js: "We can't film ...")
//   - the board-only launch mode's "can't film" misses (boardFit.js), an empty script, and a script far too long for
//     one video (the one price covers about 90 s; ~2.5 minutes of narration is refused)
// EVERYTHING ELSE is a STYLE NOTE, never a block. The page SHOWS only the concrete ones a user can act on line by line
// (SHOWN_NOTES: the town line, a long / comma-heavy line, the last line "button"), each with a free "Fix this line".
// The rest (beat timing, formula pacing, story shape, plant & payoff, topic drift, the length band, name counts, copy
// notes) is the WRITER'S internal feedback: kept in the draft's checks, never shown (several contradicted each other or
// fired on the writer's own correct output: "But..." pivot vs "But one day", "never" counted as a name).
// The writers' own internal checks are unchanged (they still fix what they call hard before they return).
import { STUDIO_BLOCK_PREFIX } from "./studioBuilds.js";
import { BOARD_PREFIX, PREMISE_PREFIX } from "./boardFit.js";
import { problemSpots } from "./protocol.js";
import { TOWN_LINE_PREFIX } from "./opener.js";

/** the most narration one video takes (s): the flat price is ~90 s of video; well past that is refused, not trimmed */
export const MAX_SCRIPT_SEC = 150;
export const TOO_LONG_PREFIX = "This script is too long for one video";

const BLOCKER_RES = [/^Uses "/, /^The script is empty/, new RegExp(`^${STUDIO_BLOCK_PREFIX}`), new RegExp(`^${BOARD_PREFIX}`), new RegExp(`^${PREMISE_PREFIX}`), new RegExp(`^${TOO_LONG_PREFIX}`)];
// owner 2026-11-18: only the notes a user would care about (and Fix this line can really fix): the town line. Commas,
// line lengths and the formula's button stay the writer's own feedback (never shown).
const SHOWN_RES = [/^Say "in this town"/];
/** true for a style note the page shows (with "Fix this line") */
export const isShownNote = (p) => SHOWN_RES.some((re) => re.test(String(p ?? "")));
/** true for a problem that may stop a paid user */
export const isBlocker = (p) => BLOCKER_RES.some((re) => re.test(String(p ?? "")));

/**
 * A check (draftCheck / checkScript shape) as the page and "Make my video" see it: problems = real blockers only;
 * notes = the style problems that used to block (each gets "Fix this line"); warnings = notes + the old advisory
 * warnings. Idempotent (a gated check gated again is the same).
 */
export function paidGate(check = {}) {
  const all = [...(check.problems ?? []), ...(check.notes ?? [])];
  const blockers = [...new Set(all.filter(isBlocker))];
  if ((check.seconds ?? 0) > MAX_SCRIPT_SEC && !blockers.some((p) => p.startsWith(TOO_LONG_PREFIX))) {
    blockers.push(`${TOO_LONG_PREFIX} (about ${Math.round(check.seconds)} s of narration; one video holds about 90 s). Shorten it or press Rewrite.`);
  }
  const notes = [...new Set(all.filter((p) => !isBlocker(p)))];
  const warnings = [...new Set([...notes, ...(check.warnings ?? []).filter((w) => !notes.includes(w) && !isBlocker(w))])];
  return { ...check, problems: blockers, notes, warnings, shown: warnings.filter(isShownNote) };
}

/**
 * Which lines a note is about, for its "Fix this line" button: "Line 7 ..." / "(line 7)" / "(lines 3, 4)" / "lines 3-5",
 * else the old spot map (protocol.js problemSpots). [] = no single line (the button is not shown; Rewrite is).
 */
export function noteLines(note, lines = []) {
  const n = String(note ?? ""), out = new Set();
  if (n.startsWith(TOWN_LINE_PREFIX) && lines.length) return lines.length > 1 ? [0, 1] : [0];
  const lead = n.match(/^Lines? (\d+)\b/);
  if (lead) out.add(Number(lead[1]) - 1);
  for (const m of n.matchAll(/\blines? (\d+(?:\s*(?:,|and|to|-|–)\s*\d+)*)/gi)) {
    const nums = m[1].split(/\s*(?:,|and)\s*/);
    for (const part of nums) {
      const r = part.match(/^(\d+)\s*(?:to|-|–)\s*(\d+)$/);
      if (r) { for (let k = Number(r[1]); k <= Math.min(Number(r[2]), Number(r[1]) + 6); k++) out.add(k - 1); }
      else if (/^\d+$/.test(part)) out.add(Number(part) - 1);
    }
  }
  if (!out.size) for (const i of problemSpots({ lines }, [n])[0]?.lines ?? []) out.add(i);
  return [...out].filter((i) => Number.isInteger(i) && i >= 0 && i < lines.length).sort((a, b) => a - b).slice(0, 4);
}

/** the notes with their lines, for the page: [{ text, lines }] (lines [] = no Fix this line) */
export const noteSpots = (gated, lines = []) => (gated.shown ?? (gated.warnings ?? []).filter(isShownNote)).map((text) => ({ text, lines: noteLines(text, lines) }));
