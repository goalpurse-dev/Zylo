// M2: the competitor story rules (the owner's study of 5 top videos, 2026-11-11: storm drain 9.4M views; roof, tunnel,
// well and sewer at 50k-200k likes). Every rule is general: a handbook rule the planner reads (STORY_RULES in
// planner.mjs) and a free code check here. Measured on the competitors' own narration (local transcripts): 68-77 s,
// 235-309 words, a "But" every 5-8 s, sentences of 11-16 words, and 4 of 5 end on the hook's own object working
// ("Bury the pipes, pave the road, and let it rain"; "open the tap, and there's your water").
//
// The plan's story carries, besides title / hero / ideas / chain / surprises:
//   flow:      ["roof", "gutter", "downspout", "yard", "street drain", "river"]: the path of what moves, in order (rule 1)
//   chain[i]:  { ..., at: the flow place where the problem happens, scale: part | thing | house | neighbours | street | town | river }
//   recurring: { p: a part id, what: "a tennis ball" }: one prop or person seen from the first third to the end (rule 8)
//
// storyRuleProblems() returns { problems, warnings, stats }: problems go to the plan's one repair round; after it the
// planner keeps them as warnings (a paid plan is never refused for a story wording rule: the owner's rule of 2026-11-03,
// five paid videos were refused for one word each). actOnTheWord() is a free fix, said in the trace.

const STOP = new Set("get gets got put puts let lets way new old big did does the a an and but so you your it its they them this that these those now then into onto with from over under every each one two three four five some more most much many very just also only still again when while there here what which who will would can could must has have had are was were been being not no all any out off down up for of to in on at by as if once soon even same other another".split(" "));
const words = (t) => String(t ?? "").toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
const stem = (w) => w.replace(/(ings?|ed|es|s)$/, "");
const stems = (t) => new Set(words(t).map(stem));
const prettyId = (id) => String(id ?? "").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
const wordCount = (t) => String(t ?? "").split(/\s+/).filter(Boolean).length;

// the voice reads about 3.77 words a second (planner.mjs LENGTH, measured on the first finished 60 s video)
export const WORDS_PER_SEC = 3.77;
// rule 3: many short loops. 60 s: 10-12 But/So loops, one about every 5 s; 30 s: 5-6
export const LOOPS = { 30: { min: 5, max: 6, maxGap: 7.5 }, 60: { min: 10, max: 12, maxGap: 8 } };
// rule 3: short sentences (the competitors average 11-16 words; the owner's range 8-15)
export const SENTENCE_WORDS = { min: 8, max: 15, hook: 16 };
const SHORT_OK = new Set(["name", "name2", "name3", "congrats", "finish"]);
// rule 5: the scale a problem reaches, smallest first
export const SCALES = ["part", "thing", "house", "neighbours", "street", "town", "river"];
const SCALE_RANK = { part: 0, thing: 1, room: 1, house: 2, yard: 2, neighbours: 3, block: 3, street: 4, road: 4, town: 5, city: 5, river: 6, region: 6, sea: 6 };
// rule 6: world pieces that are places, never built mid-story: in the world from the first frame
const WORLD_KINDS = new Set(["terrain", "waterBody", "creek"]);
const APPEAR_VERBS = new Set(["show", "build", "grow", "appear", "arrive"]);
// rule 4: what a hook's object can never be (it cannot come back working at the end): a hole, a fill, an effect, a label
export const NOT_AN_OBJECT = new Set(["dig", "gravel", "soakPit", "wrap", "settle", "crack", "fx", "flow", "pipeFlow", "pipeRunFlow", "seepFlow", "arrows", "outline", "counter", "wipe", "lawnWet", "soak", "wetBand", "soilLeak", "drops", "puddles", "rain", "light", "sign", "ambient", "bubbles"]);
// (the thing "you have" is a hole: "…you have a deep hole"; a hole cut IN something, the competitor's "If you cut a hole in your
// street", is about the street, which comes back paved)
const HOLE_HOOK = /\byou(?:'ve| have| get| end up with)\s+(?:a|an|the|your)\s+(?:[a-z]+\s+)?(?:hole|pit|trench|ditch)\b/i;
// rule 7: labels and meters that only say a problem (a red state label, a counter / gauge): at most 2 per video
export const MAX_METERS = 2;
// rule 9: "This is a..." at most 3
export const MAX_NAMES = 3;
const NAME_LINE = /^\s*(this|these|those|that) (is|are)\b/i;

/** the loop lines: problem beats, and fix beats whose own sentence carries its problem ("But leaves fall in, so you add a grate") */
export function loopIndexes(roles, sentences = null) {
  return roles.map((r, i) => (/^problem/.test(r) || (/^fix/.test(r) && /^\s*but\b/i.test(sentences?.[i]?.text ?? "")) ? i : -1)).filter((i) => i >= 0);
}
/** when each sentence starts, estimated from its words (free) */
export function startTimes(sentences) {
  let t = 0; return sentences.map((s) => { const at = t; t += wordCount(s.text) / WORDS_PER_SEC + 0.25; return at; });
}
const partsOfBeat = (b) => new Set([b?.shows?.p, ...(b?.do ?? []).map((a) => a.p), ...[b?.shot, ...(b?.shots ?? [])].flatMap((s) => (Array.isArray(s?.focus) ? s.focus : []))].filter((x) => x && x !== "home"));
// the parts a beat ADDS (appears or is built on its words): what a fix line "adds"
const addedBy = (b) => (b?.do ?? []).filter((a) => APPEAR_VERBS.has(a.v) || /^(grow|fill|pave|lay)/.test(a.v ?? "")).map((a) => a.p);

/**
 * The rules, as named fixable problems (each says what to change). L: the layout (beats, parts); story: the plan's story;
 * sentences: the narration ({role, text}, in beat order) or null; lengthSec: 30 or 60.
 */
export function storyRuleProblems(L, story = {}, sentences = null, lengthSec = 60) {
  const P = [], W = [], stats = {};
  const beats = L?.beats ?? [], roles = beats.map((b) => b.s), parts = new Map((L?.parts ?? []).map((p) => [p.id, p]));
  const S = sentences && sentences.length === roles.length ? sentences : null;
  const textOf = (i) => S?.[i]?.text ?? (story.ideas ?? []).find((x) => x.role === roles[i])?.idea ?? "";
  const n = roles.length, lim = LOOPS[lengthSec] ?? LOOPS[60];

  // 3. many short loops, about one every 5 s
  const loops = loopIndexes(roles, S);
  stats.loops = loops.length;
  if (loops.length < lim.min) P.push(`rule 3 (many short loops): ${loops.length} But/So loops; a ${lengthSec} s video needs ${lim.min}-${lim.max}, one about every 5 s. Add problem/fix beats (problem4, fix4, ...), each a short "But [what goes wrong]" and "So you [add the part]"`);
  if (S) {
    const T = startTimes(S), at = loops.map((i) => T[i]);
    const gaps = at.map((t, k) => t - (k ? at[k - 1] : 0));
    stats.maxGap = +Math.max(0, ...gaps).toFixed(1);
    if (at.length && stats.maxGap > lim.maxGap) P.push(`rule 3: ${stats.maxGap} s pass without a new problem (before "${S[loops[gaps.indexOf(Math.max(...gaps))]].text.slice(0, 40)}…"); keep one about every 5 s (at most ${lim.maxGap} s): shorten the lines in between or add a loop`);
    const long = S.filter((s) => wordCount(s.text) > (s.role === "hook" ? SENTENCE_WORDS.hook : SENTENCE_WORDS.max));
    const short = S.filter((s) => !SHORT_OK.has(s.role) && wordCount(s.text) < SENTENCE_WORDS.min - 2);
    stats.longLines = long.length;
    if (long.length) P.push(`rule 3 (short sentences): ${long.map((s) => `${s.role} (${wordCount(s.text)} words)`).join(", ")} over ${SENTENCE_WORDS.max} words (the hook ${SENTENCE_WORDS.hook}): split the thought or cut words`);
    if (short.length) W.push(`rule 3: ${short.map((s) => s.role).join(", ")} under ${SENTENCE_WORDS.min} words`);
  }

  // 1. follow the flow: the story's order is the path of what moves; each new problem happens where the flow goes next
  const flow = (Array.isArray(story.flow) ? story.flow : []).map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  stats.flow = flow.length;
  if (flow.length < (lengthSec >= 60 ? 3 : 2)) P.push(`rule 1 (follow the flow): story.flow must list the path of what moves, in order (e.g. ["roof", "gutter", "downspout", "yard", "street drain", "river"]; ${lengthSec >= 60 ? "3" : "2"} places or more); it has ${flow.length}`);
  const placeIndex = (at) => { const a = String(at ?? "").toLowerCase().trim(); if (!a) return -1; const i = flow.indexOf(a); return i >= 0 ? i : flow.findIndex((f) => f.includes(a) || a.includes(f)); };
  const chain = new Map((story.chain ?? []).map((c) => [c.problem, c]));
  const probRoles = roles.filter((r) => /^problem/.test(r));
  if (flow.length) {
    let last = -1, back = 0;
    for (const r of probRoles) {
      const c = chain.get(r), i = placeIndex(c?.at);
      if (i < 0) { P.push(`rule 1: chain ${r}: "at" must be one of the flow places (${flow.join(", ")}); it is "${c?.at ?? ""}"`); continue; }
      if (i < last) back++;
      last = Math.max(last, i);
    }
    // (one step back is allowed: a problem that sends you back up the path, the flap gate making the street flood again)
    stats.flowBack = back;
    if (back > 1) P.push(`rule 1: the problems go back up the flow ${back} times; order them along the path (${flow.join(" -> ")}), each where the flow goes next`);
  }

  // 2. the fix causes the next problem: every "But" after the first names the previous fix's part or its effect
  probRoles.forEach((r, k) => {
    if (k === 0) return;
    const i = roles.indexOf(r);
    let f = -1; for (let j = i - 1; j >= 0 && !/^problem/.test(roles[j]); j--) if (/^fix/.test(roles[j])) { f = j; break; }
    if (f < 0) { P.push(`rule 2: ${r} must come right after the "So you…" fix that causes it`); return; }
    // (the fix's words, the parts it adds, and its visible effect, its beat's shows.does: "Now the water moves. But it
    // brings leaves…" in the competitor storm drain links by the effect)
    const fixWords = new Set([...stems(textOf(f)), ...stems(beats[f]?.shows?.does), ...addedBy(beats[f]).flatMap((id) => words(prettyId(id)).map(stem)), ...words(parts.get(addedBy(beats[f])[0])?.params?.label ?? "").map(stem)]);
    ["So", "you", "add"].forEach((x) => fixWords.delete(stem(x.toLowerCase())));
    const own = [...stems(textOf(i)), ...words(chain.get(r)?.shows ?? "").map(stem)];
    if (!own.some((w) => fixWords.has(w))) P.push(`rule 2 (the fix causes the next problem): ${r} "${String(textOf(i)).slice(0, 50)}…" must name what ${roles[f]} added or its effect (${[...fixWords].slice(0, 4).join(", ")}): "So you add a flap gate. But the gate traps the rain."; "But now" alone is not enough`);
  });

  // 4. hook = ending: the hook object returns at the end, finished or working
  const hookB = beats[0], hookP = hookB?.shows?.p ?? null, endIdx = roles.map((r, i) => (r === "finish" || r === "congrats" ? i : -1)).filter((i) => i >= 0);
  const hookWords = stems(textOf(0)), topicWords = new Set([...words(story.title), ...words(story.hero), ...words(L?.title), "congratulation", "built", "build", "have", "made"].map(stem));
  const endParts = new Set(endIdx.flatMap((i) => [...partsOfBeat(beats[i])]));
  const endSays = endIdx.some((i) => [...stems(textOf(i))].some((w) => hookWords.has(w) && !topicWords.has(w)));
  const endShows = !!hookP && endParts.has(hookP);
  stats.hookReturns = endSays || endShows;
  // (the hook's object is a thing that can come back working: a dry tap, a dark lamp, a green pool; never a hole, a dig, an
  // effect or a label. The real water tower run opened on "you have a deep hole", in the dark under the lawn, and ended on
  // a tower the hole never was; the owner, 2026-11-12)
  const hookPart = hookP ? parts.get(String(hookP).split(".")[0]) : null;
  if (hookPart && NOT_AN_OBJECT.has(hookPart.kind)) P.push(`rule 4 (the hook's object): the hook shows ${hookPart.id} (${hookPart.kind}), which cannot come back working at the end; open on the thing itself, above ground, at the moment it fails or is needed (a dry tap, a dark lamp, a green pool, a flooded yard), never a hole, a dig or an effect`);
  else if (HOLE_HOOK.test(String(textOf(0) ?? ""))) P.push(`rule 4 (the hook's object): the hook "${String(textOf(0)).slice(0, 60)}" is about a hole; open on a thing that can come back working at the end (a dry tap, not "a hole")`);
  if (!endIdx.length) P.push("rule 4: the story ends with a finish line that brings the hook's object back working");
  else if (!stats.hookReturns) P.push(`rule 4 (hook = ending): the end must bring back the hook's own object${hookP ? ` (${hookP})` : ""}, finished or working ("Bury the pipes, pave the road, and let it rain"; "open the tap, and there's your water"): put it in the finish beat's shows/do and say it in the last lines`);

  // 5. scale grows (where the topic allows): a warning
  const ranks = probRoles.map((r) => SCALE_RANK[String(chain.get(r)?.scale ?? "").toLowerCase()]).filter((x) => x != null);
  stats.scale = ranks.length ? `${Math.min(...ranks)}->${Math.max(...ranks)}` : "";
  if (ranks.some((x, k) => k && x < ranks[k - 1] - 1)) W.push("rule 5 (scale grows): the problems shrink in scale; let them grow (one house, the neighbours, the street, the town, the river) where the topic allows");

  // 6. plant early: places the story needs later are in the world from the first frame
  for (const b of beats.slice(1)) for (const a of b.do ?? []) {
    const p = parts.get(a.p);
    if (p && WORLD_KINDS.has(p.kind) && APPEAR_VERBS.has(a.v)) P.push(`rule 6 (plant early): ${p.id} (${p.kind}) appears in ${b.s}; a place the story needs (a river, the sea, the ground) is in the world from the first frame: drop its "${a.v}"`);
  }
  // 7. physical disasters: labels and meters at most 2
  const labels = beats.filter((b) => b.state && String(b.state.text ?? b.state).trim()).length;
  const meters = (L?.parts ?? []).filter((p) => p.kind === "counter").length;
  stats.meters = labels + meters;
  if (labels + meters > MAX_METERS) P.push(`rule 7 (physical disasters): ${labels} red labels and ${meters} meters; at most ${MAX_METERS} in a video, only where nothing physical can show it. Show the problem as a visible consequence in close-up instead (dripping into the attic, a puddle by the wall, a gutter spilling over, a plume in the river, a collapse)`);

  // 8. one recurring prop or person, seen from the first third to the end
  const rec = story.recurring?.p ? String(story.recurring.p) : "";
  if (!rec || !parts.has(rec)) P.push(`rule 8 (one recurring prop): story.recurring.p must name a part (a token: a tennis ball, a rubber duck, a leaf; or a person) that is seen from the first third to the end${rec ? `; "${rec}" is not a part` : ""}`);
  else {
    const seen = beats.map((b, i) => (partsOfBeat(b).has(rec) ? i : -1)).filter((i) => i >= 0);
    const shownAt = beats.findIndex((b) => (b.do ?? []).some((a) => a.p === rec && APPEAR_VERBS.has(a.v)));
    const first = shownAt >= 0 ? shownAt : (seen[0] ?? 0);
    const hidden = beats.some((b) => (b.do ?? []).some((a) => a.p === rec && a.v === "hide"));
    stats.recurring = `${rec}: beats ${seen.join(",")}`;
    if (first > Math.floor(n / 3)) P.push(`rule 8: the recurring ${rec} first shows in ${roles[first]}; bring it in within the first third (by ${roles[Math.floor(n / 3)]})`);
    if (seen.length < 3) P.push(`rule 8: the recurring ${rec} is in ${seen.length} beat(s); it must come back (a shot or an action) in at least 3, the last near the end`);
    else if (seen.at(-1) < n - 3) P.push(`rule 8: the recurring ${rec} is last seen in ${roles[seen.at(-1)]}; bring it back in the last three beats`);
    if (hidden) P.push(`rule 8: the recurring ${rec} must not be hidden; it stays to the end`);
  }

  // 9. "This is a…" at most 3
  const names = S ? S.filter((s) => NAME_LINE.test(s.text)).length : roles.filter((r) => /^name/.test(r)).length;
  stats.names = names;
  if (names > MAX_NAMES) P.push(`rule 9: ${names} "This is a…" lines; at most ${MAX_NAMES}, only names viewers will repeat; the last one the relatable one ("the manholes you drive over every day")`);

  // 10. action on the word: checked and fixed free by actOnTheWord (the count of moved anchors is in the trace)
  return { problems: P, warnings: W, stats };
}

// rule 10: the state word in the sentence and the verbs that reach it ("pushes it OPEN", "forces it SHUT")
const STATE_FAMILIES = [
  { re: /^(open|opens|opened|opening)$/i, verbs: /^(open|swing|slide|extend|lift|up|raise)$/i, back: false },
  { re: /^(shut|shuts|close|closes|closed|closing|seals?|sealed)$/i, verbs: /^(close|swing|slide|extend|down|lower)$/i, back: true },
  { re: /^(on|starts?|started|lights?|lit|glows?|runs?|kicks)$/i, verbs: /^(start|on|live|lights|light|run|blink|heat|pump|spin|crank|go)$/i, back: false },
  { re: /^(off|stops?|stopped|dark|dies)$/i, verbs: /^(stop|off|dark|stopSpray)$/i, back: false },
  { re: /^(fills?|filled|filling|rises?|rising|floods?|flooded)$/i, verbs: /^(fill|rise|flood|trickle)$/i, back: false },
  { re: /^(drains?|drained|empties|emptied|falls?|drops?)$/i, verbs: /^(drain|fall|lower|drop)$/i, back: false },
  { re: /^(spins?|spun|turns?|turned|rotates?)$/i, verbs: /^(spin|crank|steer|turn)$/i, back: false },
  { re: /^(snaps?|snapped|breaks?|broke|cracks?|cracked)$/i, verbs: /^(snap|grow|go|crack)$/i, back: false },
];
const tokens = (t) => String(t ?? "").split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9'-]/g, "")).filter(Boolean);
/**
 * Rule 10, free: a part's state change fires on the sentence's state word ("pushes it OPEN"), not on the noun before it.
 * rigMoveType(part, verb) -> the rig move's type ("swing", "slide"...) or null. Returns { layout (a copy), notes }.
 */
export function actOnTheWord(L, sentences, rigMoveType = () => null) {
  const next = JSON.parse(JSON.stringify(L ?? {})), notes = [];
  const parts = new Map((next.parts ?? []).map((p) => [p.id, p]));
  if (next.approved === true) return { layout: next, notes };
  for (const b of next.beats ?? []) {
    const s = (sentences ?? []).find((x) => x.role === b.s); if (!s) continue;
    const toks = tokens(s.text), lower = toks.map((w) => w.toLowerCase());
    for (const a of b.do ?? []) {
      const p = parts.get(a.p), back = /Back$/.test(a.v ?? ""), base = back ? a.v.slice(0, -4) : a.v;
      const type = p?.kind === "rig" ? rigMoveType(p, base) : null, verb = type ?? base;
      const fam = STATE_FAMILIES.find((F) => F.verbs.test(verb) && (type ? F.back === back || !["swing", "slide", "extend"].includes(type) : true) && lower.some((w) => F.re.test(w)));
      if (!fam) continue;
      const k = lower.findIndex((w) => fam.re.test(w)); if (k < 0) continue;
      const cur = String(a.w ?? "").toLowerCase();
      if (cur === lower[k]) continue;
      // (only an earlier anchor moves: a verb already later in the line, or on a number, stays where the planner put it)
      const ci = cur ? lower.indexOf(cur) : 0;
      if (ci > k || /^\d/.test(cur)) continue;
      notes.push(`${b.s}: ${a.p} ${a.v} moved from "${a.w ?? "(start)"}" to "${toks[k]}" (rule 10, action on the word)`);
      a.w = toks[k];
    }
  }
  return { layout: next, notes };
}

/**
 * Rule 11, salvage never breaks the chain: the problems whose cause (the fix right before them) is dropped. Each must be
 * dropped with its own fix, or re-linked; salvage.mjs drops the pair (free). roles: the script's roles; drop: a Set.
 */
export function orphanedProblems(roles, drop) {
  const out = [];
  roles.forEach((r, i) => {
    if (!/^problem\d/.test(r) || drop.has(r)) return;
    let f = -1; for (let j = i - 1; j >= 0 && !/^problem/.test(roles[j]); j--) if (/^fix/.test(roles[j])) { f = j; break; }
    if (f >= 0 && drop.has(roles[f])) out.push(r);
  });
  return out;
}
