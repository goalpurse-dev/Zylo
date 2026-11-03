// Blocky Worlds: the HARD RULE (owner, 2026-11-03). Every video starts with "In this world, ..." or "In this town, ...".
// The writer is told so, and this code enforces it on every script: generated, rewritten or the user's own.

export const OPENERS = Object.freeze(["In this world, ", "In this town, "]);
export const OPENER_RE = /^In this (world|town), \S/;

/** True when the line starts with one of the two openers, exactly (capital I, a comma, then the rule). */
export const hasOpener = (line) => OPENER_RE.test(String(line ?? ""));

// Near misses the code can fix without a rewrite: the same rule, a different place word or "my".
const NEAR = [
  [/^\s*in\s+(this|my|our)\s+world\s*[,:;.\-—]*\s*/i, "In this world, "],
  [/^\s*in\s+(this|my|our)\s+(town|village|city|kingdom|neighbou?rhood|street|country|land|school)\s*[,:;.\-—]*\s*/i, "In this town, "],
];

/**
 * A first line that breaks the rule, fixed by code when it is a near miss ("In my town ...", "in this village: ...").
 * Returns the fixed line, or null when the line needs a rewrite (the writer's opener step does that).
 */
export function fixOpener(line) {
  const t = String(line ?? "").trim();
  if (hasOpener(t)) return t;
  for (const [re, opener] of NEAR) {
    if (!re.test(t)) continue;
    const rest = t.replace(re, "").trim();
    if (!rest) return null;
    const fixed = opener + rest.charAt(0).toLowerCase() + rest.slice(1);
    return hasOpener(fixed) ? fixed : null;
  }
  return null;
}

/** The first line's problem, or null. */
export function openerProblem(line) {
  if (hasOpener(line)) return null;
  return `The first line must start with "In this world, " or "In this town, " (it starts "${String(line ?? "").trim().slice(0, 30)}").`;
}
