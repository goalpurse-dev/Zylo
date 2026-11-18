// In This Town: THE WRITER'S CRAFT (owner 2026-11-18; our own wording). One place for:
//   RULE_TESTS + ruleScore: the six rule tests, 0-2 each, a rule is kept at RULE_MIN (9 of 12) or more
//   pickTwist(history): the twist family + reveal % for the next video, ROTATED per user (YouTube does not monetise
//     templated storylines); the log is each draft's card.craft (blocky_worlds_drafts), read newest first
//   CRAFT_PLAN_TEXT / CRAFT_LINES_TEXT: the rules for the planner and the line writer
//   planCraftProblems(plan) / craftProblems(script, lengthSec, { plan }): free checks (advisory notes, never a block)
import { TWISTS } from "./formulas.js";
import { PACE } from "./config.js";

// ---------- the six rule tests ----------
export const RULE_TESTS = Object.freeze([
  Object.freeze({ id: "clear_3s", ask: "a viewer gets the rule in 3 seconds with the sound OFF (one picture says it)" }),
  Object.freeze({ id: "object", ask: "the rule shows up as a THING on screen (a tag, a meter, a colour, a nose, a number over a head)" }),
  Object.freeze({ id: "daily_cost", ask: "it costs the narrator something EVERY DAY (school, food, friends, sleep)" }),
  Object.freeze({ id: "can_flip", ask: "it can FLIP: the same rule can turn from curse to gift (or back) for the twist" }),
  Object.freeze({ id: "comment_bait", ask: "viewers want to comment their own version (\"what would yours say?\")" }),
  Object.freeze({ id: "fresh", ask: "fresh: not \"X is deadly\", not \"everyone gets X\", not a plain monster" }),
]);
export const RULE_MIN = 9, RULE_MAX = RULE_TESTS.length * 2;
const clamp2 = (v) => Math.max(0, Math.min(2, Math.round(Number(v) || 0)));
/** { clear_3s: 2, ... } -> 0..12 (missing tests count 0) */
export const ruleScore = (scores) => RULE_TESTS.reduce((a, t) => a + clamp2(scores?.[t.id]), 0);
export const rulePasses = (scores) => ruleScore(scores) >= RULE_MIN;
export const ruleTestsText = () => RULE_TESTS.map((t) => `${t.id} (0-2): ${t.ask}`).join("; ");
/** the JSON schema of the six scores */
export const ruleScoresSchema = () => ({ type: "object", additionalProperties: false, required: RULE_TESTS.map((t) => t.id), properties: Object.fromEntries(RULE_TESTS.map((t) => [t.id, { type: "integer" }])) });

// ---------- the twist rotation ----------
// The families a twist can REVEAL mid-story (49-78%); the open-loop sting (T5) is an ending flavour, not a reveal.
export const TWIST_FAMILIES = Object.freeze(["T1", "T2", "T3", "T4", "T6"]);
export const TWIST_PCTS = Object.freeze([52, 57, 62, 67, 72, 76]);
export const TWIST_WINDOW = Object.freeze([49, 78]);
/**
 * history: the user's past drafts' card.craft, NEWEST FIRST ([{ twistFamily, twistPct }]) -> { family, pct, avoided }.
 * The family is the one used longest ago (never one of the last 3); the % is at least 8 away from the last two.
 */
export function pickTwist(history = [], { seed = Date.now() } = {}) {
  const past = (history ?? []).filter(Boolean);
  const recent = past.slice(0, 3).map((h) => h.twistFamily).filter(Boolean);
  const lastSeen = (f) => { const i = past.findIndex((h) => h.twistFamily === f); return i < 0 ? Infinity : i; };
  const fresh = TWIST_FAMILIES.filter((f) => !recent.includes(f));
  const pool = fresh.length ? fresh : [...TWIST_FAMILIES];
  const far = Math.max(...pool.map(lastSeen));
  const best = pool.filter((f) => lastSeen(f) === far);
  const family = best[Math.abs(Math.floor(seed)) % best.length];
  const lastPcts = past.slice(0, 2).map((h) => Number(h.twistPct)).filter(Number.isFinite);
  const okPcts = TWIST_PCTS.filter((p) => lastPcts.every((q) => Math.abs(p - q) >= 8));
  const pcts = okPcts.length ? okPcts : TWIST_PCTS;
  const pct = pcts[Math.abs(Math.floor(seed / 7)) % pcts.length];
  return { family, pct, avoided: recent };
}
/** the planner's instruction for this video's twist */
export function twistBlock({ family, pct }) {
  const t = TWISTS[family];
  return `THIS VIDEO'S TWIST (our rotation, so no two videos share a storyline; keep it): family ${family}${t ? ` "${t.name}": ${t.rule}` : ""} Set twistType to ${family}. The REVEAL lands at about ${pct}% of the runtime (twist.reveal_pct = ${pct}).`;
}

// ---------- the rules ----------
export const CRAFT_PLAN_TEXT = `THE CRAFT (owner rules; they come on top of the beat sheet)
- SCORE THE RULE FIRST (rule_scores, 0-2 each): ${ruleTestsText()}. Only a rule scoring ${RULE_MIN} or more of ${RULE_MAX} is written: if yours scores less, sharpen it (keep the user's topic) until it scores ${RULE_MIN}+.
- TIMING: the rule is fully clear by about 9% of the runtime; a line with "me" or "my" (the narrator's own stake) comes within the first 6 seconds; the TWIST REVEAL lands between 49% and 78% (twist.reveal_pct); the last line starts after 92%.
- THE TWIST (twist): the reveal reframes what the viewer saw (a hidden truth, the rule meaning something else, the weakness that is a strength ...). Plant at least 2 FAIR CLUES before it (twist.clues: the beat each is in and what it is), and hide one of them inside a joke or an insult so the viewer laughs past it. The save then uses what the twist revealed.
- THE MOTIF (motif): one sound, object or phrase used 3 or more times; its meaning changes each time (a joke, then a warning, then the answer), and its last use is in the FINAL line.
- CONCRETE: at least 3 concrete numbers, times or names per 100 seconds ("4:15", "nine stairs", "Mrs Pell").
- THE ENDING: the consequence, then one image or a short quote, then the callback line. The last line NEVER explains the twist. The hero solves it with an OBJECT or an ACTION we can see, and the final choice COSTS them something.
- LOGIC CHECK (logic): the 3 questions a viewer would ask ("why doesn't X just ...?") and where the script answers each one; every answer is in the script.`;

export const CRAFT_LINES_TEXT = `THE CRAFT OF THE LINES (owner rules)
- Sentences about 7 words on average, about half of them 6 words or fewer.
- Dialogue (words inside quotes) is 5 to 20% of all the words, and every quoted line is 10 words or fewer.
- At least 3 concrete numbers, times or names per 100 seconds.
- The motif of the plan comes back 3+ times, its meaning changing, its last use in the final line.
- The last line never explains the twist; the ending goes: consequence, one image or a short quote, the callback.
- Answer the plan's 3 "why doesn't X just ...?" questions in the lines.`;

// ---------- the free checks ----------
const W = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean);
const NUMBER_WORDS = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|first|second|third|half|dozen|midnight|noon)\b/i;
/** the plan's craft notes (advisory): the rule score, the twist window and clues, the motif, the logic answers */
export function planCraftProblems(plan) {
  const p = plan ?? {}, out = [];
  if (p.rule_scores && !rulePasses(p.rule_scores)) out.push(`The rule scores ${ruleScore(p.rule_scores)} of ${RULE_MAX} on the six rule tests (keep only ${RULE_MIN}+).`);
  const t = p.twist;
  if (t) {
    const pct = Number(t.reveal_pct);
    if (!Number.isFinite(pct) || pct < TWIST_WINDOW[0] || pct > TWIST_WINDOW[1]) out.push(`The twist reveal is planned at ${t.reveal_pct}%: it lands between ${TWIST_WINDOW[0]}% and ${TWIST_WINDOW[1]}%.`);
    const clues = Array.isArray(t.clues) ? t.clues : [];
    if (clues.length < 2) out.push(`The twist has ${clues.length} clue(s) before it: plant at least 2 fair clues.`);
    else if (!clues.some((c) => c?.in_joke === true)) out.push("No twist clue is hidden inside a joke or an insult.");
  }
  if (p.motif && (Array.isArray(p.motif.uses) ? p.motif.uses.length : 0) < 3) out.push(`The motif "${p.motif.thing ?? ""}" is used ${p.motif.uses?.length ?? 0} time(s): use it 3+ times, the last in the final line.`);
  if (Array.isArray(p.logic) && p.logic.filter((q) => String(q?.answer ?? "").trim()).length < 3) out.push('The logic check needs 3 answered "why doesn\'t X just ...?" questions.');
  return out;
}

/**
 * THE CRAFT CHECKS on the lines (advisory notes; the writer's prompts carry the rules): the rule and a "me/my" line early,
 * the last line after 92%, the motif 3+ times and in the last line, concrete details per 100 s, sentence lengths,
 * the dialogue share and length, a last line that explains. Times come from the word counts (the voice is ~even).
 */
export function craftProblems(script, _lengthSec = 90, { plan = null } = {}) {
  const lines = (script?.lines ?? []).map((l) => String(l?.text ?? ""));
  if (lines.length < 4) return [];
  const out = [];
  const counts = lines.map((l) => W(l).length), total = counts.reduce((a, b) => a + b, 0) || 1;
  // the times come from the script itself at the voice pace (config.js PACE: ~257 words a minute after the speed-up)
  const perWord = 60 / PACE.targetWpm, secs = Math.max(10, total * perWord);
  const startOf = (i) => counts.slice(0, i).reduce((a, b) => a + b, 0) * perWord, endOf = (i) => startOf(i + 1);
  const ruleAt = lines.findIndex((l) => /\bin this (town|world)\b/i.test(l));
  // ~9% of the runtime (8 s of a 90 s video); never under 5 s (the hook comes first)
  const ruleBy = Math.max(5, secs * 0.09);
  if (ruleAt >= 0 && endOf(ruleAt) > ruleBy + 1) out.push(`The rule is clear only at ${endOf(ruleAt).toFixed(0)} s: make it fully clear by about ${ruleBy.toFixed(0)} s (9%).`);
  const meAt = lines.findIndex((l) => /\b(me|my|mine)\b/i.test(l));
  if (meAt < 0 || endOf(meAt) > 6.5) out.push('No "me" / "my" line in the first 6 seconds: give the narrator a stake right away.');
  if (startOf(lines.length - 1) < secs * 0.92 - 0.5) out.push("The last line starts before 92% of the runtime: end on one short line.");
  const motif = String(plan?.motif?.thing ?? "").toLowerCase().split(/\s+/).filter((w) => w.length >= 3).sort((a, b) => b.length - a.length)[0];
  if (motif) {
    const uses = lines.filter((l) => l.toLowerCase().includes(motif)).length;
    if (uses < 3) out.push(`The motif "${plan.motif.thing}" comes ${uses} time(s): 3 or more, changing meaning.`);
    if (!lines.at(-1).toLowerCase().includes(motif)) out.push(`The motif "${plan.motif.thing}" is not in the final line.`);
  }
  const all = lines.join(" ");
  const concrete = (all.match(/\b\d+(?::\d\d)?\b/g) ?? []).length + W(all).filter((w) => NUMBER_WORDS.test(w)).length
    + new Set((all.match(/(?<![.!?]\s|^|")\b[A-Z][a-z]{2,}\b/g) ?? []).filter((n) => !/^(I|In|The|But|Then|And|You|So|My|We|Mom|Dad)$/.test(n))).size;
  const need = Math.ceil((3 * secs) / 100);
  if (concrete < need) out.push(`Only ${concrete} concrete number(s), time(s) or name(s): use at least ${need} for ${secs.toFixed(0)} s.`);
  const sentences = all.split(/(?<=[.!?])\s+|\n/).map((s) => W(s.replace(/["“”]/g, "")).length).filter((n) => n > 0);
  if (sentences.length >= 6) {
    const avg = sentences.reduce((a, b) => a + b, 0) / sentences.length, short = sentences.filter((n) => n <= 6).length / sentences.length;
    if (avg > 8.5) out.push(`Sentences run ${avg.toFixed(1)} words on average: aim for about 7.`);
    if (short < 0.4) out.push(`Only ${Math.round(short * 100)}% of the sentences are 6 words or fewer: about half should be.`);
  }
  const quotes = [...all.matchAll(/["“]([^"”]+)["”]/g)].map((m) => W(m[1]).length);
  const qShare = quotes.reduce((a, b) => a + b, 0) / total;
  if (qShare < 0.05 || qShare > 0.2) out.push(`Dialogue is ${Math.round(qShare * 100)}% of the words: keep it between 5% and 20%.`);
  const longQ = quotes.filter((n) => n > 10).length;
  if (longQ) out.push(`${longQ} quoted line(s) run over 10 words: keep each one short.`);
  if (/\b(because|that's why|which means|it turns out|turns out|the reason|so that's)\b/i.test(lines.at(-1))) out.push("The last line explains the twist: end on the callback, never the explanation.");
  return out;
}
