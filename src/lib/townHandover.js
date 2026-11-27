// In This Town from the chat (owner 2026-11-27): the plan's lines go to In This Town AS WRITTEN, then the video starts.
//   1. saveScript { lines }: In This Town's own "my script" path. No writer, no rewrite: every word the chat planned is
//      the narration (the server only checks it, like a pasted script; a line over 400 characters is split at its
//      sentence ends, never reworded).
//   2. quote: the exact price for that length, shown before anything is charged.
//   3. start: charged then, refunded by the server if the video can't be made.
// The engine is picked on the server, per account: the owner's account renders with the Three.js engine (Fly secret
// BLOCKY_WORLDS_THREEJS_OWNER_IDS on the Studio worker); every other account would get today's engine. The chat itself
// is owner-only for now (_shared/studioV2/access.js).
import { narrationOf } from "../../supabase/functions/_shared/director/storyboard.js";
import { TOWN_RANGE, townLengthOf, townPrice } from "../../supabase/functions/_shared/director/styles.js";

export const TOWN_LINE_MAX = 400;
export const TOWN_LENGTHS = TOWN_RANGE;

/** the plan's narration as In This Town lines, word for word (one line per plan line; a long one split at sentence ends) */
export function townLines(draft) {
  const out = [];
  for (const raw of narrationOf(draft).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length <= TOWN_LINE_MAX) { out.push(line); continue; }
    let cur = "";
    for (const s of line.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [line]) {
      if (cur && (cur + s).trim().length > TOWN_LINE_MAX) { out.push(cur.trim()); cur = ""; }
      cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

/** the plan's length as one In This Town length (60-120 s in 10 s steps; the same rounding as the price) */
export const townLength = townLengthOf;

/**
 * save the lines as written (the price is already known: townPrice(seconds), the number on the button and the one the
 * server charges). call = worldsCall (blocky-worlds-api). Returns { draftId, credits, lengthSec, problems }: problems are
 * In This Town's own script checks (nothing was charged).
 */
export async function prepareTown(call, draft, seconds) {
  const lengthSec = townLength(seconds);
  const credits = townPrice(lengthSec);
  const lines = townLines(draft);
  if (!lines.length) return { draftId: null, credits, lengthSec, problems: ["The plan has no lines yet."] };
  const saved = await call("saveScript", { lines: lines.map((text) => ({ text })), title: String(draft.title ?? "").slice(0, 80), lengthSec });
  return { draftId: saved.id, credits, lengthSec, problems: saved?.check?.problems ?? [] };
}

/** start the saved draft (charged now; the server refunds it if the video can't be made) */
export const startTown = (call, draftId) => call("start", { draftId });
