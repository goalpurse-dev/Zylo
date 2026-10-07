// Kill switch + budget for every Blocky Stories test script. Blocky's own:
// its own ledger, its own total, its own switch. Nothing here reads or writes
// AI Fruit Story's.
//
// Paid calls are BLOCKED unless BLOCKY_ALLOW_PAID=1 is set for that one run.
// Every paid call must reserve() its expected cost first: the reservation is
// refused if it would pass the stage cap or the $5 total. Real costs are
// recorded in data/blocky-tests/spend.json (local, git-excluded).
//
//   const budget = openBlockyBudget("looks");
//   budget.reserve(0.0337, "avatar vex");   // throws before any spend over a cap
//   ... call ...
//   budget.record(realCostUsd, "avatar vex");
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LEDGER = path.join(ROOT, "data/blocky-tests/spend.json");

/** The whole Blocky test budget (hard cap, set by the owner). */
export const BLOCKY_TOTAL_USD = 5.0;
// lipsync: test 1, 3 pictures + 3 × 5 s Wan2.6 Flash clips (approved 2026-10-06).
// tiers: test 1b, picture C again on V3 (Seedance 2.0 Mini, 5 s) and V4 (Veo 3.1 Fast, 6 s) (approved 2026-10-06).
// thumb: 2 menu thumbnail options. looks: tests 2 and 3 (avatars on Lite vs Pro, one location plate + 4 scene pictures) (approved 2026-10-06).
// looks was $0.80; lifted to $1.00 for the 4-picture re-test and the 3 Pro pictures on the corrected prompt (approved 2026-10-06).
// captions: one 4 s Wan clip with the negative prompt against drawn subtitles (approved 2026-10-08, about $0.20).
// stories: seven sample scripts, text only, for the story-quality review (approved 2026-10-08; about $0.05 each).
// twists2: the same five ideas again at 30 seconds after the twist round (approved 2026-10-08; at most $0.20 each).
export const BLOCKY_STAGE_CAPS_USD = Object.freeze({ lipsync: 1.0, tiers: 1.4, thumb: 0.15, looks: 1.0, captions: 0.3, stories: 0.7, twists2: 1.0 });

export class PaidCallBlocked extends Error {}

export function paidCallsAllowed() {
  return process.env.BLOCKY_ALLOW_PAID === "1";
}

function load(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { entries: [] };
  }
}

/** file, caps, total: for tests; scripts use the defaults. */
export function openBlockyBudget(stage, { file = LEDGER, caps = BLOCKY_STAGE_CAPS_USD, total = BLOCKY_TOTAL_USD } = {}) {
  if (!(stage in caps)) throw new Error(`unknown stage ${stage}`);
  const ledger = load(file);
  const spent = (s) => ledger.entries.filter((e) => !s || e.stage === s).reduce((sum, e) => sum + e.usd, 0);
  let reserved = 0;
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(ledger, null, 1));
  };
  return {
    stage,
    spentStage: () => spent(stage),
    spentTotal: () => spent(null),
    /** Throws PaidCallBlocked if paid calls are off or the call could pass a cap. */
    reserve(expectedUsd, label) {
      if (!paidCallsAllowed()) throw new PaidCallBlocked(`Paid calls are blocked (set BLOCKY_ALLOW_PAID=1 for this run): ${label}`);
      const stageAfter = spent(stage) + reserved + expectedUsd;
      const totalAfter = spent(null) + reserved + expectedUsd;
      if (stageAfter > caps[stage] + 1e-9) throw new PaidCallBlocked(`Stage ${stage} cap $${caps[stage]} would be passed ($${stageAfter.toFixed(4)}): ${label}`);
      if (totalAfter > total + 1e-9) throw new PaidCallBlocked(`Blocky total $${total} would be passed ($${totalAfter.toFixed(4)}): ${label}`);
      reserved += expectedUsd;
      return () => { reserved -= expectedUsd; };
    },
    /** Records the real cost of a call (after it happened), releasing its reservation. */
    record(usd, label, expectedUsd = usd) {
      reserved = Math.max(0, reserved - expectedUsd);
      ledger.entries.push({ stage, usd: Number(usd) || 0, label, at: new Date().toISOString() });
      save();
    },
    summary() {
      return `stage ${stage}: $${spent(stage).toFixed(4)} of $${caps[stage]} · Blocky total: $${spent(null).toFixed(4)} of $${total}`;
    },
  };
}
