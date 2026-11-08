// Blocky Worlds SHOT FLOW passes (VISUAL-FIX 2026-11-08, owner's review of step-2 #1), run by planVideo after the
// recipe pass, each change kept only when the pre-render checks are no worse:
//   storyShapePass(tl, { check })  the storyPatterns mini-sequences where the beat calls for them (until / climax:
//                                  reaction > threat > reaction; discovery: reveal > reaction > consequence) and a wide of
//                                  the world / town at least every ~12 s (storyPatterns recurringWide 5-12 s)
//   cameraMovePass(tl)             every real shot moves (the recipe slot's move, else a slow push in); static only
//                                  when a recipe slot says so
//   duplicateCastProblems(tl)      one person = one cast id = one look (checkTimeline fails a duplicate)
import { rolesOf, isAnchorWide, loadStoryPatterns } from "./storyPatterns.js";
import { camMoveOf } from "./camMove.js";

const isCard = (s) => !s || s.camera === "insert" || !!s.insert;
const total = (c) => Object.values(c ?? {}).reduce((a, b) => a + b, 0);
const noWorse = (a, b) => !a || !b || Object.keys(b).every((k) => (a[k] ?? 0) <= (b[k] ?? 0));
const clone = (x) => JSON.parse(JSON.stringify(x));
const key = (x) => String(x ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
const EPIC_OK = (s) => /^creature:/.test(s.set ?? "") || (s.giants ?? []).length || (s.crowds ?? []).length;

/** one person = one cast id: two ids with the same name (or a second narrator) are a duplicate */
export function duplicateCastProblems(tl) {
  const out = [], by = new Map();
  for (const [id, c] of Object.entries(tl?.cast ?? {})) {
    const n = key(c?.name); if (!n) continue;
    if (!by.has(n)) by.set(n, []); by.get(n).push(id);
  }
  for (const [n, ids] of by) if (ids.length > 1) out.push(`cast: "${n}" is ${ids.length} people (${ids.join(", ")}): one person = one cast id = one look`);
  return out;
}

/**
 * A thing the planner left unshown that the kit DOES build under the head-noun guard (lib/critical.js kitFor: "Fennick
 * tower" -> the stacked block tower, "gold penthouse" -> the penthouse) goes into its shot as a scene object; kept per
 * shot only when the checks are no worse.
 */
export function kitNeedsPass(tl, { check = null, kitFor = null } = {}) {
  const report = { shown: 0, reverted: 0 };
  if (!kitFor || !tl?.shots?.length) return report;
  let base = check ? check(tl) : null;
  for (let i = 0; i < tl.shots.length; i++) {
    const s = tl.shots[i];
    if (isCard(s) || !s.unshown?.length) continue;
    const snap = clone(s);
    let changed = false;
    for (const u of [...s.unshown]) {
      const k = kitFor(u);
      if (k?.kind !== "object") continue;
      if (!(s.objects ?? []).some((o) => o.name === k.name)) {
        const big = /tower|penthouse|house|castle|bakery/.test(k.name);
        s.objects = [...(s.objects ?? []), { name: k.name, spot: big ? "back" : (s.objects ?? []).length ? "left" : "right", facing: "camera" }];
      }
      s.unshown = s.unshown.filter((x) => x !== u);
      s.needs = (s.needs ?? []).filter((n) => String(n.label).toLowerCase() !== u);
      changed = true;
    }
    if (!changed) continue;
    if (!s.unshown.length) delete s.unshown;
    if (s.needs && !s.needs.length) delete s.needs;
    const now = check ? check(tl) : null;
    if (noWorse(now, base)) { base = now; report.shown++; }
    else { tl.shots[i] = snap; report.reverted++; }
  }
  return report;
}

/** every real shot gets a move (kept: a caps move, a recipe camMove incl. a slot's "static") */
export function cameraMovePass(tl) {
  let added = 0;
  for (const s of tl?.shots ?? []) {
    if (isCard(s)) { delete s.camMove; continue; }
    if (s.move) { delete s.camMove; continue; }
    if (s.camMove) continue;
    s.camMove = camMoveOf("push_in", ["until", "climax"].includes(s.part) ? "medium" : "slow");
    added++;
  }
  return { added };
}

const REACT_FACE = { until: "scared", climax: "surprised", discovery: "surprised" };
const STRONG = new Set(["run", "climb", "throw", "fall", "jump", "fight", "kick", "ride", "drive", "swim", "fly", "dig", "build", "push", "hug", "eat", "sneeze", "blow", "yell", "carry"]);

/** the person in a shot who can react (the narrator first), when their pose is free (not the line's own action) */
function reactor(s) {
  const all = s.actors ?? [];
  const pick = (as) => as.find((a) => a.id === "me") ?? as.find((a) => a.id === s.focus) ?? as[0] ?? null;
  // a free person first (no held thing, no action of the line's own); else anyone (the checks undo a lost action)
  return pick(all.filter((a) => !STRONG.has(a.pose ?? "stand") && !a.hold)) ?? pick(all.filter((a) => !STRONG.has(a.pose ?? "stand"))) ?? pick(all);
}

/** dress shot s as a reaction (a face: closeup / medium on the reactor, a reaction pose) -> true when it could */
function makeReaction(s, beat) {
  const a = reactor(s);
  if (!a) return false;
  a.pose = beat === "until" ? "scared" : "look_up";
  a.expr = REACT_FACE[beat] ?? "surprised";
  s.focus = a.id;
  s.camera = (s.actors ?? []).length >= 2 ? "medium" : "closeup";
  s.seq = "reaction";
  return true;
}
const HARD = new Set(["threat", "reveal", "cause"]);

/** a threat / reveal / cause shot: the story's danger or discovery on screen (a monster, a giant, a shaking place, the thing) */
function keyRole(s, roles, i) {
  const r = roles[i];
  if (["threat", "reveal", "cause", "consequence"].includes(r)) return r;
  if ((s.part === "until" || s.part === "climax") && ((s.giants ?? []).some((g) => g.id !== "world") || s.monsterState)) return "threat";
  if (s.part === "discovery" && /^thing:/.test(String(s.subject ?? "")) && !(s.actors ?? []).some((a) => a.id === s.focus)) return "reveal";
  if ((s.part === "until" || s.part === "climax") && (/^thing:/.test(String(s.subject ?? "")) || s.shake || s.beat) && !(s.actors ?? []).some((a) => a.id === s.focus)) return "threat";
  return null;
}

/** split shot i at its middle into two shots (same content), when it is long enough; -> the second index or -1 */
function splitShot(tl, i, minShot = 0.75) {
  const s = tl.shots[i];
  if (!s || s.end - s.start < 2 * minShot) return -1;
  const mid = Math.round(((s.start + s.end) / 2) * 1000) / 1000;
  const b = clone(s); b.start = mid; s.end = mid;
  for (const k of ["beat", "tethers", "siege", "fx", "acts"]) delete b[k];
  b.seed = ((s.seed ?? 1) * 7 + 3) % 1000;
  tl.shots.splice(i + 1, 0, b);
  return i + 1;
}

/**
 * The story shape. A mini-sequence: around a key shot K (threat / reveal) of until / discovery / climax, the shots next
 * to it become reactions (a face), split off a long key shot when no neighbour can react; a key shot is directed as
 * its role (s.seq). Then the recurring wide: a gap > maxGap s without a wide of the world / town turns its best shot
 * into the wide (establish / aerial over a creature world or crowd, else the set's wide). Kept per change only when
 * check(tl) counts are no worse.
 */
export function storyShapePass(tl, { check = null, patterns = loadStoryPatterns(), maxMini = 2 } = {}) {
  const report = { mini: 0, wides: 0, reverted: 0, splits: 0 };
  if (!tl?.shots?.length) return report;
  let base = check ? check(tl) : null;
  const tryChange = (fn) => {
    const snap = clone(tl.shots);
    const ok = fn();
    if (!ok) { tl.shots = snap; return false; }
    const now = check ? check(tl) : null;
    if (noWorse(now, base)) { base = now; return true; }
    tl.shots = snap; report.reverted++; return false;
  };
  // 1. mini-sequences, per beat
  const perBeat = { until: ["reaction", "threat", "reaction"], climax: ["reaction", "threat", "reaction"], discovery: ["reveal", "reaction", "consequence"] };
  for (const beat of Object.keys(perBeat)) {
    let made = 0, lastK = -10;
    for (let i = 0; i < tl.shots.length && made < maxMini; i++) {
      const s = tl.shots[i];
      if (s.part !== beat || isCard(s) || i - lastK < 4) continue;
      const roles = rolesOf(tl.shots);
      const kr = keyRole(s, roles, i);
      if (!kr) continue;
      const done = tryChange(() => {
        const K = tl.shots[i];
        if (beat === "discovery") {
          // reveal > reaction > consequence: the reveal, a face after it, then the place it changes (a wide)
          K.seq = "reveal";
          let j = i + 1, n = tl.shots[j];
          if (!n || isCard(n) || n.part !== beat || !reactor(n)) { j = splitShot(tl, i); n = tl.shots[j]; if (j < 0 || !reactor(n)) return false; report.splits++; }
          if (!makeReaction(n, beat)) return false;
          const c = tl.shots[j + 1];
          if (c && !isCard(c) && c.part === beat) { c.seq = "consequence"; if (!isAnchorWide(c)) c.camera = EPIC_OK(c) ? "establish" : "wide"; }
          return true;
        }
        // reaction > threat > reaction
        K.seq = "threat";
        let p = tl.shots[i - 1];
        let ki = i;
        if (!p || isCard(p) || p.part !== beat || !reactor(p) || HARD.has(roles[i - 1])) {
          // the threat shot's own first half becomes the first reaction (when a person can react in it)
          if (!reactor(K)) return false;
          const j = splitShot(tl, i); if (j < 0) return false; report.splits++;
          p = tl.shots[i]; ki = j; tl.shots[ki].seq = "threat";
        }
        if (!makeReaction(p, beat)) return false;
        let n = tl.shots[ki + 1];
        if (!n || isCard(n) || n.part !== beat || !reactor(n) || HARD.has(rolesOf(tl.shots)[ki + 1])) {
          const K2 = tl.shots[ki]; if (!reactor(K2)) return false;
          const j = splitShot(tl, ki); if (j < 0) return false; report.splits++;
          n = tl.shots[j];
        }
        return makeReaction(n, beat);
      });
      if (done) { made++; report.mini++; lastK = i; i += 2; }
    }
  }
  // 2. the recurring wide (storyPatterns recurringWide: 5-12 s)
  const maxGap = Math.max(6, patterns?.patterns?.recurringWide?.everySecMax ?? 12);
  const T = tl.duration ?? tl.shots.at(-1).end;
  for (let guard = 0; guard < 40; guard++) {
    const wides = tl.shots.filter((s) => isAnchorWide(s));
    const marks = [0, ...wides.map((s) => s.start), T];
    let gapAt = -1;
    for (let k = 1; k < marks.length; k++) if (marks[k] - marks[k - 1] > maxGap + 1e-6) { gapAt = marks[k - 1]; break; }
    if (gapAt < 0) break;
    // candidates: shots starting 5..maxGap s after the last wide, not cards, not a mini-sequence face; the best: a
    // crowd / no-person shot, then a person shot with nothing in hand, closest to ~9 s
    const cands = tl.shots.map((s, i) => [s, i]).filter(([s]) => !isCard(s) && s.seq !== "reaction" && s.seq !== "threat" && s.start >= gapAt + 4 && s.start <= gapAt + maxGap)
      .sort(([a], [b]) => {
        const sc = (s) => Math.abs(s.start - (gapAt + 8.5)) + ((s.crowds ?? []).length || !(s.actors ?? []).length ? 0 : 1.5) + ((s.actors ?? []).some((x) => x.hold) ? 2 : 0);
        return sc(a) - sc(b);
      });
    let ok = false;
    for (const [, i] of cands) {
      ok = tryChange(() => { const s = tl.shots[i]; s.camera = EPIC_OK(s) ? ((s.crowds ?? []).length ? "aerial" : "establish") : "wide"; s.seq = s.seq ?? "establish"; s.camMove = camMoveOf("push_in", "slow"); delete s.move; return true; });
      if (ok) { report.wides++; break; }
    }
    if (!ok) break; // nothing in that gap can be a wide without breaking a check: the report keeps the gap
  }
  report.after = base;
  return report;
}
