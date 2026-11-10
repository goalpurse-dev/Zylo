// Blocky Worlds PACING ON WORDS (owner 2026-11-10, the simple look's step 5): pure, deterministic, Node + browser.
//   a) faces swap on words: each actor's a.faces = [{ at, face }] (shot-local seconds, a word's start): the shot's face
//      from 0, then the face of an emotion word the moment it is spoken (lib/expressions.js classifyEmotion)
//   c) shots pinned to words: every shot starts on a word boundary (the planner cuts at word starts; checked here),
//      long shots are split at word starts (punctuation first) to ~1.4 s on average, each piece a new angle of the same
//      content; EVERY shot moves (shot.camMove: a slow push, a pan or a track/orbit, lib/camMove.js); poses keyed on
//      their verb (a.poses = [{ at, pose }]: "stand" until the verb, then the action), blended over ~0.25 s by the page
//   Each split / key is kept only when the pre-render checks (the PERMANENT RULE's) are no worse.
//   pacePass(tl, { check, target = 1.4, maxShot = 1.9 }) -> report
//   paceReport(tl) -> { shots, avg, onWords, moving, maxShot }
import { classifyEmotion } from "./expressions.js";

const r3 = (x) => Math.round(x * 1000) / 1000;
// a different angle of the same content for the second piece of a split shot (person focus)
const NEXT_CAM = { wide: "medium", medium: "closeup", closeup: "medium", low: "medium", over_shoulder: "closeup" };
const MOVES = ["push_in", "pan", "track", "push_in", "pull_out"];
const NO_SPLIT = (s) => s.giants?.length || s.crowds?.length || s.beat || s.move || s.stage || s.tethers?.length || s.siege?.length || s.fx?.length || s.camera === "insert";
// the pose a verb starts (the verb's word decides when the body moves)
const VERB_POSE = [
  [/^(point\w*)$/, "point"], [/^(wav\w*)$/, "wave"], [/^(cheer\w*|celebrat\w*|hooray)$/, "cheer"],
  [/^(scream\w*|shriek\w*|gasp\w*|hid|hide|hiding|froze|shook|shaking|trembl\w*|scared)$/, "scared"],
  [/^(look\w*|stare\w*|stared|peek\w*|glanc\w*|watch\w*)$/, "look_up"], [/^(yell\w*|shout\w*|roar\w*)$/, "yell"],
];
const KEYED_POSES = new Set(["point", "wave", "cheer", "scared", "look_up", "yell"]);
const clean = (w) => String(w ?? "").toLowerCase().replace(/[^a-z']/g, "");

function wordsIn(tl, s) { return (tl.captions ?? []).filter((w) => w.start >= s.start - 1e-6 && w.start < s.end - 1e-6); }

/** the pace numbers of a plan */
export function paceReport(tl) {
  const shots = tl?.shots ?? [], starts = new Set((tl?.captions ?? []).map((w) => Math.round(w.start * 1000)));
  const near = (t) => t < 0.01 || [...[-1, 0, 1]].some((d) => starts.has(Math.round(t * 1000) + d));
  const durs = shots.map((s) => s.end - s.start);
  return {
    shots: shots.length,
    avg: shots.length ? r3(durs.reduce((a, b) => a + b, 0) / shots.length) : 0,
    maxShot: shots.length ? r3(Math.max(...durs)) : 0,
    onWords: shots.length ? r3(shots.filter((s) => near(s.start)).length / shots.length) : 1,
    moving: shots.length ? r3(shots.filter((s) => (s.move && s.move !== "static") || (s.camMove && s.camMove.type !== "static")).length / shots.length) : 1,
    facesKeyed: shots.reduce((n, s) => n + (s.actors ?? []).filter((a) => (a.faces?.length ?? 0) > 1).length, 0),
    posesKeyed: shots.reduce((n, s) => n + (s.actors ?? []).filter((a) => (a.poses?.length ?? 0) > 1).length, 0),
  };
}

/** the best word start to split shot s at: punctuation before it first, then nearest the middle; null if none fits */
function splitPoint(tl, s, minPiece) {
  const ws = wordsIn(tl, s);
  let best = null, bs = Infinity;
  ws.forEach((w, i) => {
    if (i === 0 || w.start - s.start < minPiece || s.end - w.start < minPiece) return;
    const prev = String(ws[i - 1].word ?? "");
    const bonus = /[.!?]["']?$/.test(prev) ? 0.5 : /[,;:]$/.test(prev) ? 0.3 : 0;
    const score = Math.abs(w.start - (s.start + s.end) / 2) - bonus;
    if (score < bs) { bs = score; best = w.start; }
  });
  return best;
}

const sumChecks = (c) => (c ? Object.values(c).reduce((a, b) => a + (Array.isArray(b) ? b.length : Number(b) || 0), 0) : 0);
const worse = (a, b) => a && b && Object.keys(b).some((k) => (Array.isArray(b[k]) ? b[k].length : b[k]) > (Array.isArray(a[k]) ? a[k].length : a[k] ?? 0));

export function pacePass(tl, { check = null, target = 1.4, maxShot = 1.9, minPiece = 0.8, blendSec = 0.25 } = {}) {
  const rep = { before: paceReport(tl), splits: 0, reverted: 0, moves: 0, faceKeys: 0, poseKeys: 0 };
  let base = check ? check(tl) : null;
  // c) split long shots at word starts until the average is near the target (the longest first)
  for (let guard = 0; guard < 400; guard++) {
    const durs = tl.shots.map((s) => s.end - s.start), avg = durs.reduce((a, b) => a + b, 0) / durs.length;
    const order = tl.shots.map((s, i) => i).filter((i) => !tl.shots[i]._noSplit && !NO_SPLIT(tl.shots[i]) && durs[i] > Math.max(maxShot * (avg > target ? 0.7 : 1), 2 * minPiece)).sort((a, b) => durs[b] - durs[a]);
    if (!order.length || (avg <= target && durs.every((d, i) => d <= maxShot || tl.shots[i]._noSplit || NO_SPLIT(tl.shots[i])))) break;
    const i = order[0], s = tl.shots[i], at = splitPoint(tl, s, minPiece);
    if (at == null) { s._noSplit = true; continue; }
    const snap = JSON.stringify(tl.shots);
    const a = { ...s, end: r3(at) }, b = JSON.parse(JSON.stringify({ ...s, start: r3(at) }));
    const person = typeof s.focus === "string" && (tl.cast ?? {})[s.focus];
    if (person && NEXT_CAM[s.camera]) b.camera = NEXT_CAM[s.camera];
    b.seed = ((s.seed ?? i) * 7 + 13) % 1000;
    b.camMove = { type: MOVES[(i + 1) % MOVES.length], speed: "slow" };
    b.text = wordsIn(tl, b).map((w) => w.word).join(" ") || s.text;
    a.text = wordsIn(tl, a).map((w) => w.word).join(" ") || s.text;
    tl.shots.splice(i, 1, a, b);
    if (check) {
      const now = check(tl);
      if (worse(base, now)) { tl.shots = JSON.parse(snap); tl.shots[i]._noSplit = true; rep.reverted++; continue; }
      base = now;
    }
    rep.splits++;
  }
  for (const s of tl.shots) delete s._noSplit;
  // every shot moves (a slow push, a pan or a track round the subject)
  tl.shots.forEach((s, i) => {
    if (s.move) return;
    if (!s.camMove || s.camMove.type === "static") { s.camMove = { type: s.camera === "wide" ? "push_in" : MOVES[(i * 3 + (s.seed ?? 0)) % MOVES.length], speed: "slow" }; rep.moves++; }
  });
  // variety: two shots in a row never share the same move (a push, then a pan / track / pull...)
  for (let i = 1; i < tl.shots.length; i++) {
    const s = tl.shots[i], p = tl.shots[i - 1];
    if (s.move || !s.camMove || !p.camMove || s.camMove.type !== p.camMove.type) continue;
    const k = MOVES.indexOf(s.camMove.type);
    s.camMove = { ...s.camMove, type: MOVES.find((m, j) => j > k && m !== p.camMove.type) ?? "pan" };
    rep.moves++;
  }
  // a) faces on words + poses on their verb
  for (const s of tl.shots) {
    const ws = wordsIn(tl, s), actors = s.actors ?? [];
    if (!actors.length || !ws.length) continue;
    const subj = actors.find((a) => a.id === s.subject) ?? actors.find((a) => a.id === s.focus) ?? (actors.length === 1 ? actors[0] : null);
    for (const a of actors) {
      const keys = [{ at: 0, face: a.face ?? a.expr ?? "calm" }];
      if (a === subj || actors.length <= 2) {
        for (const w of ws) {
          const at = r3(w.start - s.start); if (at < 0.25) continue;
          const f = classifyEmotion(clean(w.word)).face;
          if (f && f !== keys.at(-1).face && at - keys.at(-1).at >= 0.35) keys.push({ at, face: f });
        }
      }
      if (keys.length > 1) { a.faces = keys; rep.faceKeys += keys.length - 1; } else delete a.faces;
      if (a === subj && KEYED_POSES.has(a.pose)) {
        const v = ws.find((w) => VERB_POSE.some(([re, p]) => p === a.pose && re.test(clean(w.word))));
        const at = v ? r3(v.start - s.start) : 0;
        if (at >= 0.35 && s.end - v.start >= blendSec + 0.2) { a.poses = [{ at: 0, pose: "stand" }, { at, pose: a.pose }]; rep.poseKeys++; } else delete a.poses;
      }
    }
  }
  if (check) {
    const now = check(tl);
    if (worse(base, now)) { for (const s of tl.shots) for (const a of s.actors ?? []) { delete a.faces; delete a.poses; } rep.keysReverted = true; }
  }
  rep.after = paceReport(tl);
  rep.checks = base ? sumChecks(base) : null;
  return rep;
}
