// M2: a check's own bookkeeping never fails a video (the owner's rule of 2026-10-30). The swimming pool 60 s run was
// refused after $1.72 for "chain: no entry for problem sentence 3": a "But now…" stakes line its chain never listed,
// which two paid rewrites could not fix. A problem that only says two of OUR structures don't line up (a missing entry,
// a beat with no sentence, a card's word in no sentence), or a check that crashes (an index out of range), is logged as
// a bug and skipped: no paid repair is asked for it and it never fails a run. Only real content problems can.
// Each check also rebuilds its own mapping where it can (chain.js reads problems by role; fixStory fills the chain).

const BUG = [
  /^chain: no entry for/,
  /^surprise ".*": no beat \S+$/,
  /^beat \S+: the script has no sentence with that role$/,
  /^card ".*": the word ".*" is not in sentence -?\d+$/,
  /: no such sentence$/,
  /^beat \S+: no idea$/,
  / crashed: /,
];
export const isBug = (p) => BUG.some((re) => re.test(String(p)));

/** the problems without the bookkeeping ones (those go to `bugs`) */
export function splitBugs(problems, bugs) {
  const keep = [];
  for (const p of problems ?? []) (isBug(p) ? bugs : keep).push(p);
  return keep;
}

/** a check run so that its crash is a logged bug, not a failed (and retried, re-paid) run: `fallback` is its result then */
export function guard(label, fn, bugs, fallback) {
  try { return fn(); } catch (e) {
    bugs.push(`${label} crashed: ${String(e?.message ?? e).slice(0, 300)}`);
    return typeof fallback === "function" ? fallback() : fallback;
  }
}

/** the worker's log line for each one (the harness lists them, so a free run shows every bug it met) */
export function logBugs(bugs, where = "") {
  for (const b of bugs) console.error(`[cutaway] bookkeeping bug (skipped${where ? `, ${where}` : ""}): ${b}`);
}
