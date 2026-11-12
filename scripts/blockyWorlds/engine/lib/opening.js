// Blocky Worlds: the opening (owner, 2026-11-06; reference/blocky-worlds/ANALYSIS.md 2.1). "In this world / town..."
// shows the WORLD and the PEOPLE living in it: shot 1 is a wide / establishing shot of the world (a creature world: the
// whole giant with its town, from outside), then people living with the rule. NO sign, picture card or word badge in
// the first OPENING_SEC seconds.
//   openingRule(shots, { worlds, minShot, starts }) -> { changed }   (mutates the shots; idempotent; starts: word starts)
//     - shot 0 an insert (the rule sign / a card) -> the establishing shot: a creature story's outside / on world
//       (camera "establish", focus "world", the giant walking) else the next shot's set, wide, with its people
//     - any other insert starting in the window -> its time goes to the neighbouring shot of the same line; when that
//       line runs past the window the card moves to the line's first moment after it, else it is dropped
//     - word badges (icon markers) in the window are dropped (a rule marker on everyone, ring / tag, stays: that is the
//       rule visible in action)
//     Everything dropped is written to the shot as `waived: [label]` (checkVisuals / checkProduction count a waived
//     label as an owner-excused miss, and the report shows it)
//   openingProblems(shots) -> [string]   (checkTimeline: any insert / badge left in the window)
export const OPENING_SEC = 10;
/** the window of a video: 10 s; a test script shorter than 30 s (no real length is) gets its first third */
export const openingSec = (shots) => Math.min(OPENING_SEC, (Number(shots?.at(-1)?.end) || 0) / 3);
const EPS = 1e-6;
const isBadge = (m) => m && m.kind === "icon";
const labelOf = (ins) => String(ins?.text ?? ins?.label ?? "").trim();

export function openingProblems(shots) {
  const out = [], W = openingSec(shots);
  (shots ?? []).forEach((s, i) => {
    if (!(s.start < W - EPS)) return;
    if (s.camera === "insert" || s.insert) out.push(`shot ${i}: a ${s.insert?.kind ?? "card"} ("${labelOf(s.insert)}") in the first ${+W.toFixed(1)} s: the opening shows the world and its people (lib/opening.js)`);
    if ([s.marker, ...(s.markers ?? [])].some(isBadge)) out.push(`shot ${i}: a word badge in the first ${+W.toFixed(1)} s (lib/opening.js)`);
  });
  return out;
}

export function openingRule(shots, { worlds = null, minShot = 0.8, starts = null } = {}) {
  let changed = 0;
  const W = openingSec(shots);
  const waive = (s, ...labels) => { const l = labels.flat().filter(Boolean); if (l.length) s.unshown = [...new Set([...(s.unshown ?? []), ...l.map((x) => String(x).toLowerCase())])]; };
  // src.waiveKeys: the line keys the dropped card / sign covered (plan.mjs fills them; the report names them)
  const keysOf = (src) => { const k = src.waiveKeys ?? []; delete src.waiveKeys; return k; };
  const view = (s) => worlds?.[String(s.set ?? "").slice(9)]?.view;
  // 1. shot 0: the establishing shot of the world
  const s0 = shots[0];
  if (s0 && (s0.camera === "insert" || s0.insert)) {
    const label = labelOf(s0.insert);
    const host = shots.find((s) => s !== s0 && s.camera !== "insert");
    const outsideId = Object.entries(worlds ?? {}).find(([, w]) => w?.view === "outside" && w.creature !== "none")?.[0] ?? Object.entries(worlds ?? {}).find(([, w]) => w?.view === "on")?.[0];
    Object.assign(s0, { insert: undefined, monsterState: null, marker: null });
    delete s0.insert; delete s0.need; delete s0.markers;
    if (outsideId) Object.assign(s0, { set: `creature:${outsideId}`, camera: "establish", focus: "world", actors: [], giants: [{ id: "world", action: worlds[outsideId].water ? "swim" : "walk" }], subject: null });
    else Object.assign(s0, { set: host?.set ?? s0.set, camera: "wide", focus: "group", actors: (host?.actors ?? []).map((a) => ({ ...a, hold: a.hold ?? null })), subject: null, ...(host?.worldBase ? { worldBase: host.worldBase } : {}) });
    if (!outsideId && !s0.actors.length) s0.actors = [{ id: "town1", spot: "left", pose: "walk", expr: "happy", facing: "right", hold: null }, { id: "town2", spot: "right", pose: "walk", expr: "happy", facing: "left", hold: null }];
    waive(s0, label, keysOf(s0));
    // never the same camera 3 times in a row
    if (shots[1]?.camera === s0.camera && shots[2]?.camera === s0.camera) shots[1].camera = s0.camera === "wide" ? "medium" : "wide";
    changed++;
  }
  // 1b. NO CARDS (owner, PERMANENT 2026-11-07): the rule sign no longer takes line 0's first moment, so in a creature
  //     story the world's establishing shot does: shot 0 becomes it when line 0 has another real shot, else line 0's
  //     only shot is split at a word start (both parts >= minShot) and its first part becomes it
  const outside0 = Object.entries(worlds ?? {}).find(([, w]) => w?.view === "outside" && w.creature !== "none")?.[0];
  const isEst = (s) => s && ["establish", "aerial"].includes(s.camera) && String(s.set ?? "").startsWith("creature:");
  if (outside0 && shots[0] && !isEst(shots[0]) && shots[0].camera !== "insert" && !shots[0].insert) {
    const a = shots[0];
    const est = (s) => { Object.assign(s, { set: `creature:${outside0}`, camera: "establish", focus: "world", actors: [], monsterState: null, marker: null, giants: [{ id: "world", action: worlds[outside0].water ? "swim" : "walk" }], subject: null }); delete s.objects; delete s.markers; delete s.crowds; delete s.worldSpot; delete s.place; delete s.flashback; delete s.grade; changed++; };
    const cut = starts ? starts.filter((t) => t >= a.start + minShot - EPS && t <= a.end - minShot + EPS).sort((x, y) => Math.abs(x - (a.start + (a.end - a.start) * 0.4)) - Math.abs(y - (a.start + (a.end - a.start) * 0.4)))[0] : null;
    const b1 = shots[1];
    if (cut == null && b1 && b1.line === a.line && b1.camera !== "insert" && (a.lines ?? [a.line]).length === 1) {
      // the people of shot 0 carry on in shot 1 (the line's cast stays on screen)
      for (const x of a.actors ?? []) if (!(b1.actors ?? []).some((y) => y.id === x.id) && (b1.actors ?? []).length < 4) b1.actors = [...(b1.actors ?? []), { ...x }];
      est(a);
    } else if (cut != null) {
      {
        const b = JSON.parse(JSON.stringify(a));
        a.end = +cut.toFixed(3); b.start = a.end; b.seed = ((a.seed ?? 0) + 7) % 1000;
        if (b.camera === "wide" && shots[1]?.camera === "wide") b.camera = "medium";
        shots.splice(1, 0, b);
        est(a);
      }
    }
  }
  // 2. other inserts in the window
  for (let i = 1; i < shots.length; i++) {
    const s = shots[i];
    if (!(s.start < W - EPS)) break;
    if (s.camera !== "insert" && !s.insert) continue;
    const prev = shots[i - 1], next = shots[i + 1];
    const same = (x) => x && x.camera !== "insert" && !x.insert && x.line === s.line;
    const into = same(prev) ? prev : same(next) ? next : prev && prev.camera !== "insert" ? prev : next;
    if (!into) continue;
    // a later moment of the same line, after the window: the card moves there (cut into that shot's tail)
    const label = labelOf(s.insert), keys = keysOf(s);
    if (into.line !== s.line) into.lines = [...new Set([...(into.lines ?? [into.line]), ...(s.lines ?? [s.line])])].sort((a, b) => a - b);
    if (into === prev) prev.end = s.end; else next.start = s.start;
    shots.splice(i, 1); i--;
    // the card's room in a shot of the same line: it starts at or after the window, the shot keeps >= minShot
    // (cuts land on word starts when the planner gives them: `starts`; without them the card is dropped, not moved)
    const room = (x) => {
      const from = Math.max(W, x.start + minShot, x.end - 1.2);
      const c = starts ? starts.find((t) => t >= from - EPS && x.end - t >= minShot - EPS) : null;
      return c != null ? +c.toFixed(3) : null;
    };
    // NO CARDS (owner, PERMANENT 2026-11-07): the card never moves later in the video; what it named is unshown
    const later = null; void room;
    if (later) {
      const cut = room(later);
      const card = { ...s, start: cut, end: later.end };
      later.end = cut;
      shots.splice(shots.indexOf(later) + 1, 0, card);
    } else waive(into, label, keys);
    changed++;
  }
  // 3. word badges in the window
  for (const s of shots) {
    if (!(s.start < W - EPS)) break;
    const ms = [s.marker, ...(s.markers ?? [])].filter(Boolean);
    if (!ms.some(isBadge)) continue;
    waive(s, ms.filter(isBadge).map((m) => String(m.text ?? "").replace(/^\S+\s+/, "")), keysOf(s));
    const keep = ms.filter((m) => !isBadge(m));
    s.marker = keep[0] ?? null;
    if (keep.length > 1) s.markers = keep; else delete s.markers;
    changed++;
  }
  // never the same camera 3 times in a row (the merges above can make one)
  for (let i = 2; i < shots.length && shots[i - 2].start < W; i++) {
    const [a, b, c] = [shots[i - 2], shots[i - 1], shots[i]];
    if (a.camera === b.camera && b.camera === c.camera) b.camera = b.camera === "wide" ? "medium" : "wide";
  }
  // views stay valid: an establishing / world-focus camera only where the set has its giant
  for (const s of shots) if (s.focus === "world" && view(s) === "inside") s.focus = "group";
  return { changed };
}

/** is a requirement named `name` waived / excused on this shot? (s.waived: owner-excused; s.unshown: the NO-CARDS
 *  fallback could not show it and showed the closest real shot instead: lib/cards.js) */
export const waivedHas = (s, name) => {
  const n = String(name ?? "").toLowerCase();
  if (n.length < 3) return false;
  return [...(s.waived ?? []), ...(s.unshown ?? [])].some((w) => { const ws = String(w).toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2); return ws.length && ws.some((x) => n.includes(x) || x.includes(n)); });
};
