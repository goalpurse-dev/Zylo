// Blocky Worlds: NO PICTURE CARDS OR BADGES (owner, PERMANENT rule 2026-11-07; replaces "a picture card as the last
// resort"). Never a sign / board with a word or an icon, a word / icon badge on a person, a name tag, an "x3" counter or
// a rule sign. A real in-world sign that is part of a building (a shop sign on the bakery) is the set's, not ours.
// When a line's thing can't be shown (not in the kit / library / builder, or the budget is spent) the shot is the
// closest REAL shot instead, in this order:
//   (a) the line's character doing the line's action (the line's own shot of its subject, the verb's pose)
//   (b) a reaction shot (who the line is about, else the narrator, with the fitting expression)
//   (c) a wide of the world (the creature world from outside, else the line's place wide with its people)
// What was not shown is written on the shot (shot.unshown = [labels]) for the logs and the review, never on screen;
// the checks read it as excused (lib/opening.js waivedHas). Pure.
//   isCardShot(s), textMarkers(s), addUnshown(s, ...labels)
//   cardProblems(shots) -> [string]          (checkTimeline: any card / sign / badge / tag / counter anywhere)
//   noCards(shots, { worlds, used }) -> { cards, badges }   (the safety net: every insert -> a real shot, every text
//                                                             marker gone; idempotent)

export const isCardShot = (s) => !!s && (s.camera === "insert" || !!s.insert || s.focus === "insert");
/** markers that draw a word or an icon (a name tag, a badge, a counter, a note): only the ring (no text) is allowed */
export const textMarkers = (s) => [s?.marker, ...(s?.markers ?? [])].filter((m) => m && m.kind !== "ring");
const words = (t) => String(t ?? "").replace(/\p{Extended_Pictographic}|️|‍/gu, " ").replace(/\s+/g, " ").trim();

export function addUnshown(s, ...labels) {
  const l = labels.flat().map((x) => words(x).toLowerCase()).filter((x) => x.length > 1);
  if (s && l.length) s.unshown = [...new Set([...(s.unshown ?? []), ...l])];
  return s;
}

export function cardProblems(shots) {
  const out = [];
  (shots ?? []).forEach((s, i) => {
    if (isCardShot(s)) out.push(`shot ${i}: a picture card / sign ("${words(s.insert?.text ?? s.insert?.label ?? "")}"): NO CARDS, ever (lib/cards.js)`);
    for (const m of textMarkers(s)) out.push(`shot ${i}: a ${m.kind === "tag" ? "name tag" : "badge"} ("${words(m.text)}") on ${m.on}: NO BADGES, ever (lib/cards.js)`);
  });
  return out;
}

const EXPR_OF = [[/\b(scream\w*|scared|afraid|terrified|monster|hunt\w*|chas\w*|run|ran|fled)\b/, "scared"], [/\b(cried|cry|tears|sad|lost|gone|never came back|alone)\b/, "sad"],
  [/\b(laugh\w*|smil\w*|happy|love|best|party|cheer\w*|hooray)\b/, "happy"], [/\b(angry|mad|furious|yell\w*|shout\w*)\b/, "angry"]];
const exprFor = (text) => EXPR_OF.find(([re]) => re.test(String(text ?? "").toLowerCase()))?.[1] ?? "surprised";
const okCam = (shots, i, c) => !((shots[i - 1]?.camera === c && shots[i - 2]?.camera === c) || (shots[i - 1]?.camera === c && shots[i + 1]?.camera === c) || (shots[i + 1]?.camera === c && shots[i + 2]?.camera === c));
const pickCam = (shots, i, list) => list.find((c) => okCam(shots, i, c)) ?? list[0];
const PLACE_KEYS = ["set", "light", "place", "worldSpot", "worldBase", "worldAliases", "townSeed"];

/** the insert shot i becomes the closest real shot (a) / (b) / (c); returns the kind used */
export function closestRealShot(shots, i, opts = {}) { return realShot(shots, i, opts); }
function realShot(shots, i, { worlds = null, used = null, cast = null } = {}) {
  const inCast = (id) => !cast || !!cast[id];
  const s = shots[i];
  const lost = [s.insert?.text, ...(s.visuals ?? [])].filter(Boolean);
  const real = (x) => x && !isCardShot(x);
  const near = [];
  for (let d = 1; d < shots.length; d++) for (const j of [i - d, i + d]) if (real(shots[j])) near.push(shots[j]);
  const sameLine = near.filter((x) => x.line === s.line);
  const place = sameLine[0] ?? near[0] ?? null;
  const base = { ...s };
  delete base.insert; delete base.markers; delete base.visuals; delete base.need;
  Object.assign(base, { marker: null, monsterState: null, objects: undefined });
  delete base.objects;
  if (place) for (const k of PLACE_KEYS) if (place[k] !== undefined) base[k] = Array.isArray(place[k]) ? [...place[k]] : place[k]; else delete base[k];
  const clone = (a) => ({ ...a, hold: a.hold ?? null });
  let kind;
  const doer = sameLine.find((x) => (x.actors ?? []).length);
  const subj = s.subject && !/^(group|babies|someone|monster|thing:)/.test(String(s.subject)) ? s.subject : null;
  if (doer) {
    // (a) the line's character doing the line's action: its own shot's people, poses and things, a fresh camera
    Object.assign(base, { actors: doer.actors.map(clone), subject: doer.subject ?? s.subject ?? null, focus: doer.focus === "insert" ? "group" : doer.focus });
    if (doer.objects?.length) base.objects = doer.objects.map((o) => ({ ...o }));
    for (const k of ["giants", "crowds", "monsterState"]) if (doer[k]) base[k] = JSON.parse(JSON.stringify(doer[k]));
    if (base.focus === "object" && !base.objects?.length) base.focus = base.actors[0]?.id ?? "group";
    base.camera = pickCam(shots, i, base.actors.length === 1 ? ["closeup", "medium", "wide"] : ["medium", "wide", "closeup"].filter((c) => c !== doer.camera).concat(doer.camera));
    kind = "action";
  } else if ((subj && inCast(subj)) || place?.actors?.some((a) => inCast(a.id))) {
    // (b) a reaction: who the line is about, else the narrator / the nearest person, with the fitting face
    const who = subj && inCast(subj) ? subj : (place.actors.find((a) => a.id === "me" && inCast("me")) ?? place.actors.find((a) => inCast(a.id))).id;
    base.actors = [{ id: who, spot: "center", pose: "stand", expr: exprFor(s.text), facing: "camera", hold: null }];
    base.focus = who; base.subject = s.subject ?? who;
    used?.add?.(who);
    base.camera = pickCam(shots, i, ["closeup", "medium", "wide"]);
    kind = "reaction";
  } else {
    // (c) a wide of the world: the creature world from outside, else the place wide with people living in it
    const outsideId = Object.entries(worlds ?? {}).find(([, w]) => w?.view === "outside" && w.creature !== "none")?.[0];
    if (outsideId && i > 0) Object.assign(base, { set: `creature:${outsideId}`, camera: pickCam(shots, i, ["establish", "aerial", "wide"]), focus: "world", actors: [], giants: [{ id: "world", action: worlds[outsideId].water ? "swim" : "walk" }], subject: null });
    else {
      const ids = cast ? [...Object.keys(cast).filter((id) => /^town/.test(id)), ...Object.keys(cast).filter((id) => !/^town/.test(id) && !cast[id].baby)].slice(0, 2) : ["town1", "town2"];
      base.actors = ids.map((id, k) => ({ id, spot: k ? "right" : "left", pose: "walk", expr: "happy", facing: k ? "left" : "right", hold: null }));
      for (const id of ids) used?.add?.(id);
      Object.assign(base, { focus: "group", subject: s.subject && /^(group|someone)$/.test(s.subject) ? s.subject : null, camera: pickCam(shots, i, ["wide", "medium"]) });
    }
    kind = "world";
  }
  if (!base.subject && base.subject !== null) base.subject = null;
  addUnshown(base, lost);
  shots[i] = base;
  return kind;
}

/**
 * The safety net (run after every stage that may still make one: the planner's end, the builder's apply, the vision
 * re-plan): every card / sign insert becomes the closest real shot, every word / icon marker goes (its word joins
 * shot.unshown). -> { cards, badges, how: [kinds] }
 */
export function noCards(shots, opts = {}) {
  let cards = 0, badges = 0;
  const how = [];
  for (let i = 0; i < (shots ?? []).length; i++) {
    const s = shots[i];
    if (isCardShot(s)) {
      cards++;
      const lost = [s.insert?.text, ...(s.visuals ?? [])].filter(Boolean);
      const needs = [...(s.needs ?? []), ...(s.need ? [{ ...s.need, host: "self" }] : [])];
      // (a) first: the card was cut out of a shot of its own line: its time goes back to that shot (the line's character
      // doing the line's action), unless that makes the same camera 3 times in a row
      const nb = [shots[i - 1], shots[i + 1]].find((x) => x && !isCardShot(x) && x.line === s.line && (x.actors ?? []).length);
      const rest = nb ? shots.filter((x) => x !== s) : null, j = nb ? rest.indexOf(nb) : -1;
      if (nb && !(rest[j - 1]?.camera === nb.camera && rest[j - 2]?.camera === nb.camera) && !(rest[j - 1]?.camera === nb.camera && rest[j + 1]?.camera === nb.camera) && !(rest[j + 1]?.camera === nb.camera && rest[j + 2]?.camera === nb.camera)) {
        nb.start = Math.min(nb.start, s.start); nb.end = Math.max(nb.end, s.end);
        if (s.lines && JSON.stringify(s.lines) !== JSON.stringify(nb.lines ?? [nb.line])) nb.lines = [...new Set([...(nb.lines ?? [nb.line]), ...s.lines])].sort((a, b) => a - b);
        addUnshown(nb, lost);
        if (needs.length) nb.needs = [...(nb.needs ?? []), ...needs];
        shots.splice(i, 1); i--;
        how.push("action");
        continue;
      }
      how.push(realShot(shots, i, opts));
      if (needs.length) shots[i].needs = [...(shots[i].needs ?? []), ...needs];
      delete shots[i].need;
    }
    const t = textMarkers(shots[i]);
    if (t.length) {
      const x = shots[i];
      addUnshown(x, t.map((m) => m.text));
      const keep = [x.marker, ...(x.markers ?? [])].filter((m, k, l) => m && m.kind === "ring" && l.findIndex((y) => y && y.on === m.on && y.kind === m.kind) === k);
      x.marker = keep[0] ?? null;
      if (keep.length > 1) x.markers = keep; else delete x.markers;
      badges += t.length;
    }
  }
  return { cards, badges, how };
}

// ---- the old card / badge picture helpers: page/kit/props.js still imports them for its (switched-off) card and
// badge textures (NO_CARDS draws neither); kept so the page loads

/** the generic "something" icons the planner uses when it has no picture: they say nothing, the word says more */
export const GENERIC_ICONS = new Set(["✨", "★", "⭐", "❓", "❔", "!", "?"]);
const PICTO = /\p{Extended_Pictographic}/u;

/**
 * cardPicture(text, icon, draws) -> "emoji" | "word" | "title"
 *   emoji: a real emoji the browser draws in colour (draws(icon) === true) on the disc
 *   word:  a short word on the disc (an icon that is a word, or the text's first word when there is no text line)
 *   title: no disc: the card's text big over the whole board
 */
export function cardPicture(text, icon, draws = () => true) {
  const ic = String(icon ?? "").trim(), hasText = !!String(text ?? "").trim();
  if (ic && PICTO.test(ic)) return !GENERIC_ICONS.has(ic) && draws(ic) ? "emoji" : hasText ? "title" : "word";
  if (ic && !GENERIC_ICONS.has(ic)) return "word";
  return hasText ? "title" : "word";
}

/** the word drawn on the disc for "word" (an icon word, else the text's first word, else "?") */
export function cardWord(text, icon) {
  const ic = String(icon ?? "").trim();
  if (ic && !PICTO.test(ic) && !GENERIC_ICONS.has(ic)) return ic.toUpperCase();
  return (String(text ?? "").trim().split(/\s+/)[0] || "?").toUpperCase();
}

/** a badge ("🚪 DOOR"): the emoji only when it draws, else the word alone (never a blank badge) */
export function badgeParts(text, draws = () => true) {
  const m = String(text ?? "").match(/(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*)/u);
  const em = m?.[0] ?? null, rest = em ? String(text).replace(em, "").trim() : String(text ?? "").trim();
  const ok = !!em && !GENERIC_ICONS.has(em) && draws(em);
  return { emoji: ok ? em : null, word: rest || (ok ? "" : "!") };
}
