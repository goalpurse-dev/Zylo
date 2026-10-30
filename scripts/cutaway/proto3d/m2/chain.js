// M2: the story chain (the owner's rule from the creator's traffic light, 2026-10-25). The problems are a CHAIN of
// escalating, visible consequences: the first lands right after the hook, every fix causes the next, bigger problem
// ("So you add X. But now X does Y"), and each one is something you can see happen (cars piling up, water flooding,
// a wall cracking), never a dry fact. Free: a code check on the script and the chain the script writer returns.
//   chain: [{ problem: sentence index, causedBy: index of the fix that caused it (-1: the hook), shows: what is seen
//            happening on screen, stakes: who or what suffers, size: 1-10, bigger every time }]

// a problem you can see happen: the words of a visible consequence (stems)
// (stops, holds red, stranded: a car held at a red light is seen; the real traffic light run of 2026-10-28 was refused
// for "the timer holds red for one lone car")
export const VISIBLE = /\b(stop|hold(?:s|ing)? (?:red|still)|stays? red|strand|trap|idl|honk|pool|soggy|saturat|squish|flood|overflow|spill|leak|seep|soak|pour|gush|burst|crack|break|broke|snap|collaps|cave|sink|sank|tip|topple|fall|crash|slam|smash|hit|pile|stack|jam|queue|line[sd]? up|back(?:s|ed)? up|stuck|wait|sit|stall|block|clog|choke|fill|drown|wash|smear|stain|stink|smell|rot|mold|rust|freez|melt|burn|smok|spark|catch(?:es)? fire|blow|explod|rise|rising|runs?(?: \w+)? (?:into|over|down|out|off)|drip|puddl|mud|green|dark|empty|dies|dead|swamp|bog|sag|bend|bulg|float|shake|rattl)/i;
// a dry fact, not a consequence: percentages, studies, "about N"
const DRY = /\b(percent|studies|research|experts|statistic|on average|according to)\b|%/i;
const STOP = new Set("get gets got put puts let lets way new old big did does the a an and but so you your it its they them this that these those now then into onto with from over under every each one two three four five some more most much many very just also only still again when while there here what which who will would can could must has have had are was were been being not no all any out off down up for of to in on at by as".split(" "));
// possessives and apostrophes go first: "a car's metal" names the car (the traffic light run of 2026-10-25 was refused
// because "car's" and "car" counted as different words)
const words = (t) => String(t).toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
const stem = (w) => w.replace(/(ings?|ed|es|s)$/, "");

// (a fix beat that opens with "But now leaves fall, so you add a grate" is still a fix: the storm drain narration of the
// free harness, 2026-10-28, was refused for it)
const isProblem = (t, role = "") => /^\s*but\b/i.test(t) && !/^fix/.test(role);
const isFix = (t) => /^\s*so\b/i.test(t);
// the problem lines: by role when the script has problem roles (a plan made from beats keys its chain by them, so a
// "But now the walls slump in" stakes line is not one and a "Then a storm blows mud in" problem3 line is: the swimming
// pool 60 s run of 2026-10-29 was refused after $1.72 for the first), else by the words ("But…")
const problemIndexes = (S) => {
  const byRole = S.some((s) => /^problem/.test(s.role ?? ""));
  return S.map((s, i) => ((byRole ? /^problem/.test(s.role ?? "") : isProblem(s.text, s.role)) ? i : -1)).filter((i) => i >= 0);
};

/**
 * The chain's problems, for a script { sentences, chain }. strict: a new layout (the roles are free); with a saved
 * layout the roles are fixed (its scene was made before this rule), so only the chain metadata, the visibility and the
 * escalation are checked.
 */
export function chainProblems(script, { strict = true, lengthSec = 30, bugs = null } = {}) {
  const P = [], S = script.sentences ?? [], chain = script.chain ?? [];
  const probs = problemIndexes(S);
  const need = lengthSec >= 60 ? 3 : 2;
  if (probs.length < need) P.push(`the story needs at least ${need} problems ("But…" sentences), each caused by the fix before it; it has ${probs.length}`);
  if (!probs.length) return P;
  if (strict) {
    // the first problem lands within the first few seconds: right after a short hook
    if (probs[0] !== 1) P.push(`the first problem ("But…") must be the second sentence, right after the hook (it is sentence ${probs[0] + 1})`);
    const hookWords = String(S[0]?.text ?? "").split(/\s+/).filter(Boolean).length;
    // (16 words is the aim; up to 18 is tolerated: about 0.5 s more before the first problem)
    if (hookWords > 18) P.push(`the hook is ${hookWords} words: keep it to 16 or fewer so the first problem lands within about 4 seconds`);
  }
  probs.forEach((pi, k) => {
    const text = S[pi].text, short = `"${text.slice(0, 50)}…"`;
    if (!VISIBLE.test(text)) P.push(`problem ${short} is not something you can see happen: say the visible consequence (it floods, cars pile up, the wall cracks)`);
    if (DRY.test(text)) P.push(`problem ${short} reads like a dry fact: make it a consequence you can see`);
    if (k === 0) return;
    // a later problem: caused by the fix just before it (no two problems in a row, no problem out of nowhere)
    let f = -1; for (let i = pi - 1; i > probs[k - 1]; i--) if (isFix(S[i].text)) { f = i; break; }
    if (f < 0) { if (strict) P.push(`problem ${short} must come after a "So you…" fix that causes it`); return; }
    // the link: it is about what that fix did ("So you add a timer. But the timer…", "But now it…")
    const fw = new Set(words(S[f].text).map(stem)), linked = words(text).some((w) => fw.has(stem(w))) || /\bnow\b/i.test(text);
    if (!linked) P.push(`problem ${short} must follow from the fix before it ("${S[f].text.slice(0, 40)}…"): name what that fix did, or say "But now…"`);
  });
  // the chain the writer returns: one entry per problem, what it shows, and bigger every time
  const byProblem = new Map(chain.map((c) => [c.problem, c]));
  // (no chain at all: an approved premade script, made before the rule; there is nothing to compare, so no check)
  for (const pi of chain.length ? probs : []) {
    const c = byProblem.get(pi);
    // (no entry is our bookkeeping, never the video's fault: logged and skipped, the owner's rule of 2026-10-30)
    if (!c) { bugs?.push(`chain: no entry for problem sentence ${pi} (${S[pi].role ?? "no role"})`); continue; }
    if (String(c.shows ?? "").split(/\s+/).filter(Boolean).length < 3) P.push(`chain: problem sentence ${pi} must say what is seen happening on screen`);
    if (String(c.stakes ?? "").split(/\s+/).filter(Boolean).length < 2) P.push(`chain: problem sentence ${pi} must say who or what suffers`);
  }
  const sizes = probs.filter((pi) => byProblem.has(pi)).map((pi) => Number(byProblem.get(pi).size));
  if (sizes.every(Number.isFinite)) for (let k = 1; k < sizes.length; k++) if (!(sizes[k] > sizes[k - 1])) { P.push(`chain: every problem must be bigger than the one before (sizes ${sizes.join(", ")})`); break; }
  return P;
}

const UNLINKED = /^problem ".*" must follow from the fix before it/;
/**
 * Free repair of the one chain problem a word can fix: a later problem that doesn't name what the fix before it did
 * gets "now" ("But at midnight, one car waits…" -> "But now, at midnight, one car waits…"), which says the fix made
 * it happen. Only where the writer's own chain says that fix caused it (causedBy), so the link is real, not invented.
 * Returns { script (a copy), linked: [sentence indexes] }.
 */
export function linkProblems(script) {
  const S = (script.sentences ?? []).map((s) => ({ ...s })), linked = [];
  const probs = problemIndexes(S);
  const causedBy = new Map((script.chain ?? []).map((c) => [c.problem, c.causedBy]));
  probs.forEach((pi, k) => {
    if (k === 0 || /\bnow\b/i.test(S[pi].text)) return;
    let f = -1; for (let i = pi - 1; i > probs[k - 1]; i--) if (isFix(S[i].text)) { f = i; break; }
    if (f < 0 || (causedBy.has(pi) && causedBy.get(pi) !== f)) return;
    const fw = new Set(words(S[f].text).map(stem));
    if (words(S[pi].text).some((w) => fw.has(stem(w)))) return;
    // (a problem line that doesn't open with "But", "Then a storm…": left as written)
    const m = S[pi].text.match(/^(\s*but)\b,?\s*(.*)$/is); if (!m) return;
    const rest = m[2], comma = /^(at|in|on|by|after|when|once|if|then|soon)\b/i.test(rest) ? "," : "";
    S[pi].text = `${m[1]} now${comma} ${rest}`;
    linked.push(pi);
  });
  return { script: { ...script, sentences: S }, linked };
}
/** Only "doesn't name the fix" problems left: linkProblems clears those. */
export const onlyUnlinked = (problems) => problems.length > 0 && problems.every((p) => UNLINKED.test(p));
