// Blocky Worlds: THE STORY SHAPE (owner 2026-11-15, after the Milo video). Every writer (hybrid plan + lines, the dark
// twist plan + lines; patternNotes carries it) follows these seven parts in this order, ON TOP of the existing rules
// (the result-first hook, "You see, in this town, ...", the bans, setup / payoff, the judge, the dark-twist style).
// storyShapeProblems is the free check: notes with SHAPE_PREFIX (advisory: they go to "Fix it", never a paid rewrite on
// their own).
export const STORY_SHAPE = Object.freeze([
  Object.freeze({ id: "rule", name: "THE RULE", job: "the one simple, impossible rule of this town, said plainly (\"You see, in this town, ...\"), right after the result-first hook" }),
  Object.freeze({ id: "life", name: "LIFE UNDER IT", job: "2-3 quick, funny, visible examples of everyday life under the rule (named neighbours, jobs, places)" }),
  Object.freeze({ id: "kid", name: "THE ONE KID", job: "the narrator is the ONE exception: the worst at the rule, the only one without it, the one it hurts (\"Except me.\" / \"Then there's me.\")" }),
  Object.freeze({ id: "oneday", name: "BUT ONE DAY…", job: "the turn: one day the rule breaks, goes too far or the kid breaks it (\"But one day...\", \"Until...\", \"Then one morning...\")" }),
  Object.freeze({ id: "crisis", name: "THE CRISIS", job: "it escalates in three visible steps to the biggest, filmable danger, everyone in town sees it" }),
  Object.freeze({ id: "twist", name: "A TWIST", job: "the kid wins with the rule itself, or the truth about the rule flips what we saw (\"Then I noticed something.\")" }),
  Object.freeze({ id: "ending", name: "CLIFFHANGER / HOLY-TWIST ENDING", job: "the last line is a cliffhanger (a new problem, a question, something right behind) or a holy twist that changes the meaning of the start; a short callback to the rule or the hook" }),
]);
export const SHAPE_PREFIX = "Shape:";

/** the prompt block every writer gets */
export function storyShapeBlock() {
  return `THE STORY SHAPE (owner rule, in this order; the existing rules still apply: the result-first hook, "You see, in this town", the bans, setup and payoff):\n${STORY_SHAPE.map((p, i) => `${i + 1}. ${p.name}: ${p.job}`).join("\n")}`;
}

const textOf = (l) => String(l?.text ?? l ?? "");
const KID = /\b(except (?:me|for me)|then there(?:'|’)?s me|but (?:not )?me\b|i(?:'|’)?m the only|i was the only|i am the only|everyone but me|all but me|not me\b|i couldn(?:'|’)?t|i never could|i was the worst|i(?:'|’)?m the worst|my (?:\w+ )?was (?:the )?(?:smallest|lowest|quietest|worst))/i;
const ONEDAY = /\b(but one (?:day|night|morning|afternoon|evening)|one (?:day|night|morning|afternoon)|until (?:one|the day|today|yesterday|last)|then one|that(?:'|’)?s when|everything changed|that (?:day|night|morning) )/i;
const CRISIS = /\b(scream\w*|run\w*|crash\w*|fall\w*|toppl\w*|explod\w*|chas\w*|panic\w*|flood\w*|everyone|whole town|the entire|straight (?:toward|at|for)|no brakes|too (?:big|fast|late)|bigger|faster|louder|help)\b/i;
const TWIST = /\b(then i noticed|i noticed|turns out|it turns out|i realized|i realised|the truth|all along|wasn(?:'|’)?t (?:a|the|about)|never (?:was|were)|that(?:'|’)?s why|actually|the real reason)\b/i;
const HOOKY = /[?…]|\.\.\.|\b(behind (?:me|us)|again|next|now|still|tomorrow|someone|something|who|what|but|wait|then)\b/i;

/** the free shape check -> [note]: the one kid, the "one day" turn, the crisis, the twist, the ending in the right order */
export function storyShapeProblems(script) {
  const lines = (script?.lines ?? []).map(textOf).filter((t) => t.trim());
  const n = lines.length;
  if (n < 6) return [];
  const at = (re, from = 0, to = n) => { for (let i = Math.max(0, from); i < Math.min(n, to); i++) if (re.test(lines[i])) return i; return -1; };
  const out = [];
  const kid = at(KID, 1, Math.ceil(n * 0.5));
  if (kid < 0) out.push(`${SHAPE_PREFIX} THE ONE KID is missing in the first half: one line that makes the narrator the exception ("Except me." / "Then there's me." / "I'm the only one who ...").`);
  const turn = at(ONEDAY, Math.max(1, kid), Math.ceil(n * 0.7));
  if (turn < 0) out.push(`${SHAPE_PREFIX} the "BUT ONE DAY…" turn is missing: after the kid, one line turns the story ("But one day...", "Until one night...", "Then one morning...").`);
  const from = turn >= 0 ? turn + 1 : Math.floor(n * 0.4);
  const crisisLines = lines.slice(from, Math.ceil(n * 0.9)).filter((t) => CRISIS.test(t)).length;
  if (crisisLines < 2) out.push(`${SHAPE_PREFIX} THE CRISIS is thin: after the turn, escalate in visible steps to the biggest danger everyone sees (found ${crisisLines} crisis line(s)).`);
  const twist = at(TWIST, Math.floor(n * 0.45), n);
  if (twist < 0) out.push(`${SHAPE_PREFIX} A TWIST is missing in the second half: the kid wins with the rule itself, or the truth about the rule flips what we saw ("Then I noticed something.").`);
  const last = lines[n - 1];
  if (!HOOKY.test(last)) out.push(`${SHAPE_PREFIX} the ending is closed: end on a CLIFFHANGER (a new problem, a question, something right behind) or a HOLY TWIST that changes the start ("${last.slice(0, 50)}").`);
  return out;
}
