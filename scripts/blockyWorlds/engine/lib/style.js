// Blocky Worlds STYLE RULES (REBUILD agent, 2026-11-06): what the turtle target (147.6 s, 115 shots, a viral video of
// our format) does that our videos did not, as code. The prose version and the judgement-only rules are in
// docs/blocky-worlds-protocol.md "8. Style rules"; the director's prompt carries the judgement ones (lib/director/design.js).
// Pure (Node + browser), never throws.
//   motionPass(tl, { check }) -> { moved, reverted }   PLANNER: a giant left "idle" walks unless its shot's words say it
//       stops / waits / hides / sleeps / freezes (target: 100% of shots move; ours: 60%). A change that adds a check
//       problem is undone.
//   styleReport(tl) -> { metrics, problems: [{ rule, msg, shots? }] }   ADVISORY: the mechanical rules measured on a
//       plan (planVideo stores it as tl.style; the run report shows it). Not part of checkTimeline: a style miss never
//       fails a run, it tells the planner work where it falls short of the reference.

import { mixReport, GRAMMAR } from "./shotGrammar.js";

export const STYLE = Object.freeze({
  openerSec: 5, openerShots: 3,            // R1 the opener: >= 3 shots in the first 5 s (target: 4)
  creatureShare: 0.6,                       // R2 a creature story shows a giant in >= 60% of its time (target 72%)
  maxShot: 3.7, medianShot: 2.0,            // R3 pace: no shot over 3.7 s but the last; median <= 2 s (target 1.16 s)
  nightShare: 0.35,                         // R5 daylight default: <= 35% night unless the script is about the night
  staticShare: 0.2,                         // R6 motion: <= 20% of shots with nothing moving
  onsetShare: 0.9, onsetEps: 0.08,          // R7 cuts on word onsets: >= 90% of cuts within 80 ms of a word start
  closeGiantShare: 0.35,                    // R8 close / low cameras on giants: >= 35% of giant-focus shots
});

const STILL_WORDS = /\b(stop(?:ped|s)?|still|froze|freezes?|frozen|wait(?:ed|s|ing)?|hid(?:es|ing)?|hide|sle(?:pt|eps?|eping)|asleep|rest(?:ed|s|ing)?|lay|lying|stood|stands?|sat|sits?|watch(?:ed|es|ing)?|stare[ds]?|staring|refus\w*|calm)\b/i;
const NIGHT_WORDS = /\b(night|midnight|dark|moon|stars?|dusk|evening|nightfall)\b/i;
// verbs the target always SHOWS as an action shot (never a card)
const ACTION_VERBS = /\b(ran|run|runs|lunged|clamped|bit|bites|shook|shakes|collapsed|fell|fired|fires|sprinted|grabbed|climbed|blew|snapped|broke|charged|attacked|jumped|threw|pushed|pulled|crashed|exploded|flew|swam|chased|smashed|stomped|roared|howled|slid|kicked|caught)\b/i;

const isCreature = (s) => /^creature:/.test(s.set ?? "");
const wordsOf = (tl, s) => (tl.captions ?? []).filter((c) => c.start >= s.start - 1e-6 && c.start < s.end - 1e-6).map((c) => c.word).join(" ");
const dur = (s) => Math.max(0, (s.end ?? 0) - (s.start ?? 0));
const isCard = (s) => s.camera === "insert" || !!s.insert;
const showsGiant = (s) => !isCard(s) && ((s.giants ?? []).length > 0 || /^(giant:|world$)/.test(s.focus ?? "") || (isCreature(s) && ["establish", "aerial", "giant_close", "hero_low", "duel"].includes(s.camera)));
// (the shot's camMove counts: lib/camMove.js, every real shot gets one since VISUAL-FIX 2026-11-08; 2026-11-09)
const moves = (s) => !!(s.move || (s.camMove && s.camMove.type !== "static") || s.beat || s.shake || s.tilt || (s.giants ?? []).some((g) => g.action && g.action !== "idle") || (s.crowds ?? []).some((c) => c.action && c.action !== "stand") || (s.actors ?? []).some((a) => a.pose && !["stand", "sit", "sleep"].includes(a.pose)) || (s.tethers ?? []).some((t) => ["snap", "fire", "swing"].includes(t.state)) || (s.siege ?? []).length || (s.fx ?? []).length || (s.acts ?? []).length);

export function motionPass(tl, { check = null } = {}) {
  const res = { moved: 0, reverted: 0 };
  const count = () => (check ? check(tl).length : 0);
  let base = count();
  for (const s of tl?.shots ?? []) {
    if (isCard(s) || !(s.giants ?? []).some((g) => (g.action ?? "idle") === "idle")) continue;
    if (STILL_WORDS.test(wordsOf(tl, s))) continue;
    const before = s.giants.map((g) => g.action);
    // the world creature walks (its town sways along); another giant walks unless it is the target of an attack beat
    s.giants.forEach((g) => { if ((g.action ?? "idle") === "idle" && g.role !== "target" && !g.move) g.action = "walk"; });
    const now = count();
    if (now > base) { s.giants.forEach((g, i) => { g.action = before[i]; }); res.reverted++; continue; }
    base = now; res.moved++;
  }
  return res;
}

export function styleReport(tl) {
  const shots = tl?.shots ?? [], problems = [], N = shots.length || 1, T = Math.max(1e-6, tl?.duration ?? shots.at(-1)?.end ?? 0);
  const script = (tl?.lines ?? []).map((L) => L.text ?? "").join(" ");
  const creatureStory = shots.some(isCreature);
  // R1 the opener
  const opener = shots.filter((s) => s.start < STYLE.openerSec - 1e-6).length;
  if (T >= 30 && opener < STYLE.openerShots) problems.push({ rule: "R1 opener", msg: `${opener} shot(s) in the first ${STYLE.openerSec} s (want >= ${STYLE.openerShots}: foot / flank close, aerial over the town, the creature walking, a fly-through)` });
  if (creatureStory && shots[0] && !showsGiant(shots[0])) problems.push({ rule: "R1 opener", msg: "shot 1 does not show the creature the world lives on", shots: [0] });
  // R2 the creature is the subject
  const gShare = shots.filter(showsGiant).reduce((a, s) => a + dur(s), 0) / T;
  if (creatureStory && gShare < STYLE.creatureShare) problems.push({ rule: "R2 creature share", msg: `a giant / the creature is on screen ${(gShare * 100).toFixed(0)}% of the time (want >= ${STYLE.creatureShare * 100}%)` });
  // R3 pace
  const long = shots.map((s, i) => [s, i]).filter(([s, i]) => i < shots.length - 1 && dur(s) > STYLE.maxShot + 1e-6).map(([, i]) => i);
  if (long.length) problems.push({ rule: "R3 pace", msg: `${long.length} shot(s) longer than ${STYLE.maxShot} s`, shots: long });
  const ds = shots.map(dur).sort((a, b) => a - b), median = ds.length ? ds[Math.floor(ds.length / 2)] : 0;
  if (median > STYLE.medianShot) problems.push({ rule: "R3 pace", msg: `median shot ${median.toFixed(2)} s (want <= ${STYLE.medianShot} s; the reference cuts ~2 times a sentence, median 1.16 s)` });
  // R4 a verb is shown, never carded
  const cardVerb = [];
  (tl?.lines ?? []).forEach((L, li) => {
    const own = shots.filter((s) => (s.lines ?? [s.line]).includes(li));
    if (own.length && own.every(isCard) && ACTION_VERBS.test(L.text ?? "")) cardVerb.push(li);
  });
  if (cardVerb.length) problems.push({ rule: "R4 verb not card", msg: `line(s) ${cardVerb.join(", ")}: an action verb shown only by a card` });
  // R5 daylight default
  const night = shots.filter((s) => s.light === "night").reduce((a, s) => a + dur(s), 0) / T;
  if (!NIGHT_WORDS.test(script) && night > STYLE.nightShare) problems.push({ rule: "R5 daylight", msg: `${(night * 100).toFixed(0)}% night with no night in the script` });
  // R6 motion always
  const still = shots.map((s, i) => [s, i]).filter(([s]) => !isCard(s) && !moves(s)).map(([, i]) => i);
  if (still.length / N > STYLE.staticShare) problems.push({ rule: "R6 motion", msg: `${still.length} of ${N} shots have nothing moving (no camera move, giant / crowd / person action, beat or effect)`, shots: still });
  // R7 cuts on word onsets
  const starts = (tl?.captions ?? []).map((c) => c.start);
  const cuts = shots.slice(1).map((s) => s.start), onset = cuts.filter((t) => starts.some((w) => Math.abs(w - t) <= STYLE.onsetEps)).length;
  if (cuts.length && starts.length && onset / cuts.length < STYLE.onsetShare) problems.push({ rule: "R7 cut on onsets", msg: `${onset} of ${cuts.length} cuts land on a word start (want >= ${STYLE.onsetShare * 100}%)` });
  // R8 close / low cameras on giants
  const gf = shots.filter((s) => /^(giant:|world$)/.test(s.focus ?? "") && !isCard(s)), close = gf.filter((s) => ["giant_close", "hero_low"].includes(s.camera)).length;
  if (gf.length >= 5 && close / gf.length < STYLE.closeGiantShare) problems.push({ rule: "R8 close giant cameras", msg: `${close} of ${gf.length} giant shots are close / low (want >= ${STYLE.closeGiantShare * 100}%)` });
  // R9-R11 SHOT GRAMMAR v2 (owner 2026-11-09, lib/shotGrammar.js): the framing mix, crowd shots, readable faces
  let mix = null;
  try { mix = mixReport(tl); } catch { mix = null; }
  if (mix && mix.n >= 10) {
    const offs = Object.entries(mix.off).filter(([, d]) => Math.abs(d) > GRAMMAR.tol + 1e-9);
    if (offs.length) problems.push({ rule: "R9 framing mix", msg: offs.map(([k, d]) => `${k} ${Math.round(mix.share[k] * 100)}% (target ${Math.round(mix.target[k] * 100)}%)`).join(", ") });
    if (mix.crowd.share > GRAMMAR.crowdMax + 1e-9) problems.push({ rule: "R10 crowd shots", msg: `${mix.crowd.shots} crowd shot(s), ${Math.round(mix.crowd.share * 100)}% (max ${GRAMMAR.crowdMax * 100}%)` });
    if (mix.crowd.standing.length) problems.push({ rule: "R10 crowd shots", msg: `${mix.crowd.standing.length} crowd shot(s) where everyone just stands`, shots: mix.crowd.standing });
    if (mix.faces.bad.length) problems.push({ rule: "R11 faces", msg: `${mix.faces.bad.length} of ${mix.faces.shots} character shots without a readable face`, shots: mix.faces.bad.map((b) => b.shot) });
  }
  return {
    metrics: { mix, shots: shots.length, median: +median.toFixed(2), openerShots: opener, creatureShare: +gShare.toFixed(2), nightShare: +night.toFixed(2), staticShare: +(still.length / N).toFixed(2), onsetShare: cuts.length ? +(onset / cuts.length).toFixed(2) : 1, closeGiantShare: gf.length ? +(close / gf.length).toFixed(2) : null },
    problems,
  };
}
