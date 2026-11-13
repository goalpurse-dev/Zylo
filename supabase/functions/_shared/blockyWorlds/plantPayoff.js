// Blocky Worlds: PLANT & PAYOFF (owner, 2026-11-14). Every setup in a story (a detail, an object, a rule, a kindness, a line of advice)
// must PAY OFF later, and at least 3 setups must return in the ENDING. The writer lists its setups with the map (each: what, a
// quote of the plant line, a quote of the payoff line); this free check finds both by meaning, in order, and flags the unpaid ones
// ("cut it or pay it off": Fix it). Pure. Advisory notes that name their lines.
import { contentWords } from "./library.js";

export const SETUP_MIN_RETURNING = 3;
/** The share of the script's last lines that counts as "the ending" for a payoff (the last 30%). */
export const ENDING_SHARE = 0.3;
const PREFIX = "Formula:";

/** The map's setups schema (both styles). */
export const setupsSchemaProps = () => {
  const s = { type: "string" };
  return { setups: { type: "array", items: { type: "object", additionalProperties: false, required: ["what", "plant", "payoff"], properties: { what: s, plant: s, payoff: s } } } };
};
export const SETUPS_TEXT = `SETUPS AND PAYOFFS (return them in the map as "setups"): list EVERY setup of the story (a small detail, an object, a rule, a kindness, a line of advice, a number) as { what, plant: a SHORT EXACT QUOTE (3 to 10 words) of the line that plants it, payoff: a SHORT EXACT QUOTE of the later line where it pays off }. At least 3 setups must return in the ENDING (the last third). A setup that never pays off must be CUT from the story, not listed.`;

/** The index of the line that holds a quote (by meaning: 60% of the quote's content words), searching from `from`; -1 when none. */
export function lineOfQuote(lines, quote, from = 0) {
  const q = contentWords(quote);
  if (!q.length) return -1;
  for (let i = from; i < lines.length; i++) {
    const t = new Set(contentWords(lines[i].text));
    if (q.filter((w) => t.has(w)).length / q.length >= 0.6) return i;
  }
  return -1;
}

/**
 * The plant-and-payoff table of a script: [{ what, plantAt, payoffAt, paid, inEnding }] (0-based line indexes, -1 = not found).
 */
export function plantPayoffTable(script, setups) {
  const lines = script?.lines ?? [];
  const endFrom = Math.floor(lines.length * (1 - ENDING_SHARE));
  return (setups ?? []).map((s) => {
    const plantAt = lineOfQuote(lines, s?.plant);
    const payoffAt = plantAt >= 0 ? lineOfQuote(lines, s?.payoff, plantAt + 1) : -1;
    return { what: String(s?.what ?? "").slice(0, 80), plant: String(s?.plant ?? ""), payoff: String(s?.payoff ?? ""), plantAt, payoffAt, paid: payoffAt >= 0, inEnding: payoffAt >= endFrom && payoffAt >= 0 };
  });
}

/** The notes: too few setups, a setup that never pays off, fewer than 3 returning in the ending. [] when the setups are not given. */
export function plantPayoffProblems(script, setups) {
  if (!Array.isArray(setups)) return [];
  const lines = script?.lines ?? [];
  if (lines.length < 6) return [];
  const table = plantPayoffTable(script, setups);
  const out = [];
  const tag = (i) => `(line ${i + 1})`;
  if (table.length < SETUP_MIN_RETURNING) out.push(`${PREFIX} the story lists only ${table.length} setup${table.length === 1 ? "" : "s"}; plant at least ${SETUP_MIN_RETURNING} (a detail, an object, a rule, a line of advice) that pay off in the ending.`);
  for (const t of table) {
    if (t.plantAt < 0) continue;
    if (!t.paid) out.push(`${PREFIX} the setup "${t.what}" never pays off: pay it off in the ending or cut it from the story. ${tag(t.plantAt)}`);
  }
  const returning = table.filter((t) => t.inEnding).length;
  if (table.length >= SETUP_MIN_RETURNING && returning < SETUP_MIN_RETURNING) out.push(`${PREFIX} only ${returning} setup${returning === 1 ? "" : "s"} return in the ending; at least ${SETUP_MIN_RETURNING} must (the last third of the story pays off what the first two thirds planted). ${tag(lines.length - 1)}`);
  return out;
}

/** The table as printable lines (the report). */
export const plantPayoffText = (script, setups) => plantPayoffTable(script, setups).map((t) => `- ${t.what}: planted line ${t.plantAt + 1}${t.paid ? `, pays off line ${t.payoffAt + 1}${t.inEnding ? " (ending)" : ""}` : ", NEVER PAID"}`).join("\n");
