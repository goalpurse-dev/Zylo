// Blocky Worlds shot review: what each narration line must SHOW, taken from the story (the script, the story
// director's production list, the user's premise), never from the plan: the review must not confirm the planner's own
// reading (run turtle2: "his" became a person "Grandpa His", checkVisuals said 100%, a human found 23% truly matched).
//   lineRequirements(tl, { script, premise }) -> [{ line, text, prevText, who, whoHint, people, nouns, action, place,
//                                                   time, emotion, moving, shots: [shot index] }]
//   stillPicks(tl, { lines? , maxPerLine }) -> [{ key, line, shot, t }]  the frames to judge (timeline seconds)
// Pure: no network, no Chrome.

export const MOVE_RE = /\b(run|runs|ran|running|walk|walks|walked|walking|march|marches|marched|marching|chase|chases|chased|chasing|charge|charges|charged|charging|flee|flees|fled|fleeing|fall|falls|fell|falling|swim|swims|swam|swimming|jump|jumps|jumped|jumping|climb|climbs|climbed|climbing|fly|flies|flew|flying|dance|danced|dancing|stomp|stomps|stomped|stomping|crash|crashed|shake|shook|shaking|spin|spun|spinning|swing|swung|slide|slid|sliding|roll|rolled|rolling|drag|dragged|carry|carried|pull|pulled|push|pushed|throw|threw|thrown|kick|kicked|attack|attacked|hunt|hunts|hunted|hunting|rush|rushed|race|raced|sprint|sprinted|wave|waved|shiver|shivered|tremble|trembled|pound|pounded|bang|banged|knock|knocked|drive|drove|ride|rode)\b/i;
export const EMO_RE = /\b(scared|afraid|fear\w*|terrif\w*|panic\w*|nervous|worried|happy|glad|smil\w*|laugh\w*|sad|cry|cried|tears|lonely|left out|angry|mad|furious|proud|brave|lucky|surprised|shock\w*|excited|calm|quiet|silent|bored|sleepy|yawn\w*|shiver\w*|trembl\w*|gasp\w*|grin\w*|frown\w*)\b/gi;
const NIGHT_RE = /\b(night|midnight|dark|darkness|moon|moonlight|stars|torch|torches|lantern|bedtime|asleep)\b/i;
const DAWN_RE = /\b(dawn|sunrise|sunset|dusk|evening)\b/i;
const FEMALE_RE = /\b(mrs|ms|miss|mom|mum|mother|grandma|granny|nana|aunt|sister|queen|princess|lady|girl|woman|she|her|madam|dame)\b/i;
const MALE_RE = /\b(mr|dad|father|grandpa|grandad|uncle|brother|king|prince|lord|sir|boy|man|he|his|him)\b/i;
const NOT_A_THING = new Set(["world", "cast"]);
const LIGHT_WORD = { day: "daytime", night: "night", warm: "evening / sunset light" };

const r2 = (x) => Math.round(x * 100) / 100;
const cap = (s, n = 120) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** the line spans: tl.lines (planner, from the voice timings), else the shots' own line numbers */
export function lineSpans(tl) {
  if (Array.isArray(tl.lines) && tl.lines.length && tl.lines.every((L) => Number.isFinite(L?.start) && Number.isFinite(L?.end))) return tl.lines.map((L, i) => ({ line: i, start: L.start, end: L.end, text: L.text ?? "" }));
  const by = new Map();
  for (const s of tl.shots ?? []) for (const li of s.lines ?? [s.line]) {
    if (!Number.isInteger(li)) continue;
    const o = by.get(li) ?? { line: li, start: s.start, end: s.end, text: s.text ?? "" };
    o.start = Math.min(o.start, s.start); o.end = Math.max(o.end, s.end); by.set(li, o);
  }
  return [...by.values()].sort((a, b) => a.line - b.line);
}

/** the shots that show (part of) a line, with the overlap */
export function shotsOfLine(tl, span) {
  return (tl.shots ?? []).map((s, i) => ({ s, i, a: Math.max(s.start, span.start), b: Math.min(s.end, span.end) })).filter((x) => x.b - x.a > 0.05);
}

function genderOf(id, name, tl) {
  const g = tl.visualWorld?.gender?.[id];
  if (g === "f") return "female"; if (g === "m") return "male";
  const n = String(name ?? "");
  if (FEMALE_RE.test(n)) return "female"; if (MALE_RE.test(n)) return "male";
  return null;
}

/** "Mrs. Oddy (an adult woman)" from a cast id / a production item */
function describePerson(id, tl, item = null) {
  const c = tl.cast?.[id];
  const narrator = id === "me";
  const name = narrator ? `${c?.name ?? tl.visualWorld?.narrator ?? "the narrator"} (the narrator, "I / me")` : (item?.name ?? c?.name ?? id);
  const role = c?.role === "baby" ? "a baby" : c?.elder ? "an old" : c?.role === "kid" ? "a kid" : c?.role === "adult" ? "an adult" : null;
  const g = genderOf(id, item?.name ?? c?.name, tl);
  const looks = role ? `${role}${g ? (role === "a kid" ? (g === "female" ? " girl" : " boy") : g === "female" ? " woman" : " man") : role === "an old" ? " person" : ""}` : g ?? null;
  return { id, name: cap(name, 60), hint: looks };
}

/**
 * Per line, what the frames must show. The production list (tl.production.perLine, the story director's reading) gives
 * who / things / world / light; without it the line text is all there is (the judge reads it).
 */
export function lineRequirements(tl, { script = null, premise = null } = {}) {
  const spans = lineSpans(tl);
  const per = tl.production?.perLine ?? [];
  const texts = (i) => cap(script?.lines?.[i]?.text ?? tl.lines?.[i]?.text ?? spans.find((s) => s.line === i)?.text ?? "", 300);
  return spans.map((span) => {
    const i = span.line, p = per.find((x) => x?.line === i) ?? per[i] ?? null, text = texts(i);
    const req = p?.required ?? [];
    const subjectId = p?.subject || tl.lines?.[i]?.subject || null;
    const subjItem = req.find((r) => r.id === subjectId) ?? null;
    let who = null;
    if (subjectId && (tl.cast?.[subjectId] || subjItem?.kind === "cast")) who = describePerson(subjectId, tl, subjItem);
    else if (subjItem) who = { id: subjectId, name: cap(subjItem.name, 60), hint: subjItem.kind };
    const people = req.filter((r) => r.kind === "cast" && r.id !== subjectId).map((r) => describePerson(r.id, tl, r)).map((d) => `${d.name}${d.hint ? ` (${d.hint})` : ""}`);
    const nouns = [...new Set(req.filter((r) => !NOT_A_THING.has(r.kind) && r.id !== subjectId).map((r) => cap(r.name, 50)).filter(Boolean))].slice(0, 6);
    const world = req.find((r) => r.kind === "world");
    const place = cap(world?.name ?? (tl.worlds && Object.keys(tl.worlds).length ? `the story's world (${premise ?? Object.values(tl.worlds)[0]?.creature ?? ""})` : ""), 80) || null;
    const light = p?.light ?? (NIGHT_RE.test(text) ? "night" : DAWN_RE.test(text) ? "warm" : null);
    const emotion = [...new Set((text.match(EMO_RE) ?? []).map((w) => w.toLowerCase()))].join(", ") || null;
    const shots = shotsOfLine(tl, span).map((x) => x.i);
    return {
      line: i, text, prevText: i > 0 ? texts(i - 1) : null, start: r2(span.start), end: r2(span.end),
      // the storyboard's IMAGE PROMPT of each shot of the line (lib/shotPrompts.js paramsFromPrompts): what the still must show
      imagePrompts: (tl.shots ?? []).filter((x) => x.line === i && x.board?.prompt?.image).map((x) => cap(x.board.prompt.image, 400)).slice(0, 3),
      who, people, nouns, place, time: light ? LIGHT_WORD[light] ?? light : null, light,
      emotion, moving: MOVE_RE.test(text), action: (text.match(MOVE_RE) ?? [])[0]?.toLowerCase() ?? null, shots,
    };
  });
}

/**
 * The frames to judge: per line, each shot's middle within the line (a moving line, or a single shot longer than 3 s:
 * two frames, at 25% / 75%, so "static" can be judged); at most maxPerLine a line (first / middle / last shots).
 * `only` (a Set of shot indices) restricts to the shots of a later round.
 */
export function stillPicks(tl, { lines = null, maxPerLine = 4, only = null, moving = null } = {}) {
  const spans = lineSpans(tl), out = [];
  for (const span of spans) {
    if (lines && !lines.has(span.line)) continue;
    let list = shotsOfLine(tl, span);
    if (only) list = list.filter((x) => only.has(x.i));
    if (!list.length) continue;
    const isMoving = moving ? moving(span.line) : MOVE_RE.test(span.text ?? tl.lines?.[span.line]?.text ?? "");
    const picks = [];
    for (const x of list) {
      const len = x.b - x.a;
      if ((isMoving && len >= 1.0) || (list.length === 1 && len > 3)) picks.push({ shot: x.i, t: x.a + len * 0.25, part: "a" }, { shot: x.i, t: x.a + len * 0.75, part: "b" });
      else picks.push({ shot: x.i, t: x.a + len * 0.5, part: "" });
    }
    let keep = picks;
    if (picks.length > maxPerLine) {
      // keep one frame of the first, the middle and the last shot first, then fill
      const idx = new Set([0, picks.length - 1, picks.length >> 1]);
      for (let k = 0; idx.size < maxPerLine && k < picks.length; k++) idx.add(k);
      keep = picks.filter((_, k) => idx.has(k));
    }
    for (const p of keep) out.push({ key: `L${span.line}-s${p.shot}${p.part}`, line: span.line, shot: p.shot, t: r2(p.t) });
  }
  return out;
}

/** a copy of the timeline for stills: no captions, a small frame */
export function stillTimeline(tl, { size = 768 } = {}) {
  const c = JSON.parse(JSON.stringify(tl));
  const H = size, W = Math.round((size * (tl.width ?? 1080)) / (tl.height ?? 1920) / 2) * 2;
  c.width = W; c.height = H; c.captions = [];
  return c;
}

/**
 * Only the given shots, re-timed back to back (cast, worlds, giants, assets, monster kept), so a re-render loads only
 * their sets. -> { tl, map(shotIndex, t) -> sub time }
 */
export function subTimeline(tl, shotIdx) {
  const c = JSON.parse(JSON.stringify({ ...tl, shots: [] }));
  const keep = [...new Set(shotIdx)].filter((i) => tl.shots[i]).sort((a, b) => a - b);
  let at = 0;
  const offs = new Map();
  c.shots = keep.map((i) => {
    const s = JSON.parse(JSON.stringify(tl.shots[i])), d = s.end - s.start;
    offs.set(i, at - s.start);
    s.start = at; s.end = at + d; at += d;
    return s;
  });
  c.duration = Math.max(0.5, at);
  c.captions = [];
  return { tl: c, map: (i, t) => t + (offs.get(i) ?? 0) };
}
