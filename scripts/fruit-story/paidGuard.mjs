// Dev kill switch + budget for every AI Fruit Story Phase 3 test script.
//
// Paid calls are BLOCKED unless FRUIT_ALLOW_PAID=1 is set for that one run.
// Every paid call must reserve() its expected cost first: the reservation is
// refused if it would pass the stage cap or the Phase 3 total. Real costs are
// recorded in data/fruit-phase3/spend.json (local, git-excluded).
//
//   const budget = openBudget("3d");
//   budget.reserve(0.0337, "scene 1 picture");   // throws before any spend over a cap
//   ... call ...
//   budget.record(realCostUsd, "scene 1 picture");
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LEDGER = path.join(ROOT, "data/fruit-phase3/spend.json");

export const PHASE3_TOTAL_USD = 4.0;
export const STAGE_CAPS_USD = Object.freeze({ "3b": 0, "3c": 0.4, "3d": 0.4, "3e": 1.8, "3f": 0.1, "3g": 0.3 });

export class PaidCallBlocked extends Error {}

export function paidCallsAllowed() {
  return process.env.FRUIT_ALLOW_PAID === "1";
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  } catch {
    return { entries: [] };
  }
}

export function openBudget(stage) {
  if (!(stage in STAGE_CAPS_USD)) throw new Error(`unknown stage ${stage}`);
  const ledger = load();
  const spent = (s) => ledger.entries.filter((e) => !s || e.stage === s).reduce((sum, e) => sum + e.usd, 0);
  let reserved = 0;
  const save = () => {
    fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  };
  return {
    stage,
    spentStage: () => spent(stage),
    spentTotal: () => spent(null),
    /** Throws PaidCallBlocked if paid calls are off or the call could pass a cap. */
    reserve(expectedUsd, label) {
      if (!paidCallsAllowed()) throw new PaidCallBlocked(`Paid calls are blocked (set FRUIT_ALLOW_PAID=1 for this run): ${label}`);
      const stageAfter = spent(stage) + reserved + expectedUsd;
      const totalAfter = spent(null) + reserved + expectedUsd;
      if (stageAfter > STAGE_CAPS_USD[stage] + 1e-9) throw new PaidCallBlocked(`Stage ${stage} cap $${STAGE_CAPS_USD[stage]} would be passed ($${stageAfter.toFixed(4)}): ${label}`);
      if (totalAfter > PHASE3_TOTAL_USD + 1e-9) throw new PaidCallBlocked(`Phase 3 total $${PHASE3_TOTAL_USD} would be passed ($${totalAfter.toFixed(4)}): ${label}`);
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
      return `stage ${stage}: $${spent(stage).toFixed(4)} of $${STAGE_CAPS_USD[stage]} · Phase 3 total: $${spent(null).toFixed(4)} of $${PHASE3_TOTAL_USD}`;
    },
  };
}
