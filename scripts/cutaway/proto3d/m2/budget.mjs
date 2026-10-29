// M2: one video's spending limit, enforced inside the run (the owner's rule of 2026-10-28: the paid check of that day
// went over its cap because the cap was only checked between videos). Every paid call asks first with what it could
// cost at most; one that could pass the cap is refused before it is sent, and the run stops (refunded as BUDGET).
// The cap: CUTAWAY_RUN_CAP_USD, or setRunCap() (the worker sets the job's capUsd). No cap: Infinity.
let cap = Number(process.env.CUTAWAY_RUN_CAP_USD) || Infinity, spent = 0;
// what one call can cost at most, by label (measured on the paid runs of 2026-10-26/28, with headroom)
const WORST = [[/beats plan|scene plan/, 0.5], [/beats repair|scene repair|preview repair/, 0.4], [/fact research/, 0.15], [/fact-check/, 0.08], [/vision/, 0.1], [/voice/, 0.08], [/words|re-anchor|post text|kit check/, 0.04]];
export const worstOf = (label) => WORST.find(([re]) => re.test(label))?.[1] ?? 0.2;
export function setRunCap(usd) { if (Number(usd) > 0) cap = Number(usd); }
export function spentSoFar() { return spent; }
/** before a paid call: refused if its worst case would pass the run's cap */
export function allow(label) {
  if (spent + worstOf(label) > cap) throw Object.assign(new Error(`over the run's $${cap} cap: $${spent.toFixed(3)} spent, "${label}" could cost up to $${worstOf(label)}`), { code: "BUDGET", retryable: false });
}
/** after a paid call: what it cost */
export function add(usd) { spent += Number(usd) || 0; }
