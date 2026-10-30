// Zyvo Studio timeline (owner, 2026-10-30: "one continuous video, zero visible jumps"). Pure: from timing.json
// (lines, events) it plans the camera as HOLDS joined by MOVES (whip/slide, push/crane, pull), never a hard cut:
//   - every hold lasts at least MIN_HOLD (1.2 s); moves last 0.45–0.95 s, eased, with motion blur in the renderer
//   - screen direction is fixed: the creator on the left, Zee on the right (the camera never crosses the line)
//   - fast moves get a whoosh (audio.py mixes them from moves.json)
// Used by preview.js in the browser and by node (writeMoves.mjs) for the audio.
export const MIN_HOLD = 1.2;

// Framings: camera position and look target, plus where the characters face. y-up, metres.
export const FRAMINGS = {
  // wide enough that a shrug or hands-up stays inside; aimed so the head sits below the chip and the hook pill
  creator: { pos: [-1.02, 2.1, 8.6], look: [-1.05, 2.15, 0.6], facing: "camera" },
  // the antenna stays below the chip; the creator is fully out of frame on the left
  zee: { pos: [1.25, 1.75, 8.4], look: [1.3, 1.8, 0.3], facing: "camera" },
  // the screen fills y 420..1400 and the caption sits under it; the cast stands below the phone, turned to it
  phone: { pos: [0.1, 4.63, 15.6], look: [0.1, 4.63, -3.6], facing: "phone", creep: 0.12 },
  wall: { pos: [0, 3.6, 15.0], look: [0, 5.4, -11], facing: "wall" },
};

/** The plan: [{type:"hold"|"move", t0, t1, from, to, kind}] covering 0..total. */
export function plan(T) {
  const L = T.lines, EV = Object.fromEntries(T.events.map((e) => [e.event, e.t]));
  const moves = [];
  let at = "creator", free = MIN_HOLD;            // where the camera is, and the earliest time it may move again
  const go = (to, want, dur, kind) => {
    const t0 = Math.max(want, free);
    moves.push({ type: "move", from: at, to, t0, t1: t0 + dur, kind });
    at = to; free = t0 + dur + MIN_HOLD;
  };
  const line = (i) => L[i] ?? null;
  // the M2/teaser beats, keyed off the lines and the events
  go("zee", line(0).end - 0.05, 0.45, "whip");                                    // creator -> Zee (slide right)
  go("phone", Math.max(line(1).end - 0.1, (EV.phoneOn ?? 0) + 0.3), 0.95, "push");  // Zee -> the giant phone (crane up + push)
  go("creator", line(2).start - 0.35, 0.6, "pull");                               // phone -> the creator, who turns back
  go("wall", line(3).start - 0.2, 0.85, "crane");                                 // creator -> wide back view of the wall
  if (line(5)) go("creator", line(5).start - 0.45, 0.7, "pull");                  // wall -> creator ("Okay. Show me how!")
  if (line(6)) go("zee", line(5).end - 0.05, 0.45, "whip");                       // teaser: creator -> Zee ("Part 2 tomorrow")
  // holds fill the gaps
  const out = []; let t = 0, cur = "creator";
  for (const m of moves) { if (m.t0 > t) out.push({ type: "hold", t0: t, t1: m.t0, at: cur }); out.push(m); t = m.t1; cur = m.to; }
  out.push({ type: "hold", t0: t, t1: Math.max(T.total, t + 0.5), at: cur });
  return out;
}

// M3 / per-template videos (owner, 2026-10-30): hook -> answer -> 5 steps -> twist -> objection -> payoff -> CTA.
// The phone is raised (y 5.15) so the cast stands below it in the phone shots.
export const FRAMINGS_T = {
  ...FRAMINGS,
  // the hook: the creator close up, the real video playing on the phone behind him (top right)
  hook: { pos: [-0.85, 2.05, 8.6], look: [-0.9, 2.15, 0.6], facing: "camera" },
  phone: { pos: [0.1, 4.88, 15.6], look: [0.1, 4.88, -3.6], facing: "phone" },
  steps: { pos: [-1.0, 3.0, 9.6], look: [-1.1, 2.35, -1.0], facing: "phone", creep: 0.15 },
  // Zee low in the frame, so a counter card above stays clear of the antenna
  zeeLow: { pos: [1.25, 2.2, 8.6], look: [1.3, 2.28, 0.3], facing: "camera", creep: 0.08 },
  phoneFull: { pos: [0.1, 4.9, 13.0], look: [0.1, 4.9, -3.6], facing: "phone", creep: 0.1 },
};

/** Lines by role (hook, answer, beat, tease, step1..5, twist, objection, time, site, cta); else by the old order. */
export function roles(L) {
  const by = Object.fromEntries(L.filter((l) => l.role).map((l) => [l.role, l]));
  if (Object.keys(by).length) return by;
  const old = ["hook", "answer", "beat", "step1", "step2", "step3", "step4", "step5", "twist", "objection", "time", "site", "cta"];
  return Object.fromEntries(L.map((l, i) => [old[i], l]));
}

/** The camera plan of a per-template video (by role; clips hook + payoff). */
export function planTemplate(T) {
  const L = T.lines, clip = Object.fromEntries((T.clips ?? []).map((c) => [c.name, c]));
  const R = roles(L);
  const moves = [];
  let at = "hook", free = MIN_HOLD;
  const go = (to, want, dur, kind) => { const t0 = Math.max(want, free); moves.push({ type: "move", from: at, to, t0, t1: t0 + dur, kind }); at = to; free = t0 + dur + MIN_HOLD; };
  go("phone", R.hook.end - 0.1, 0.95, "push");             // the question -> the real video plays
  go("zee", clip.hook.end - 0.05, 0.6, "pull");             // "It's simple. But..."
  go("creator", R.answer.end - 0.05, 0.45, "whip");       // "...show me."
  go("steps", R.beat.end, 0.85, "crane");                 // steps 1-5 (the website tease is said on the way)
  go("wall", R.twist.start - 0.2, 0.85, "crane");         // the twist (the template's own wall)
  go("creator", R.objection.start - 0.35, 0.7, "pull");   // "how long did that take?"
  go("zeeLow", R.objection.end - 0.05, 0.45, "whip");     // the measured time (the clock above Zee)
  go("phoneFull", R.time.end - 0.1, 1.0, "push");         // the payoff: the real result, full screen
  go("zee", clip.payoff.end, 0.7, "pull");                 // the CTA
  const out = []; let t = 0, cur = "hook";
  for (const m of moves) { if (m.t0 > t) out.push({ type: "hold", t0: t, t1: m.t0, at: cur }); out.push(m); t = m.t1; cur = m.to; }
  out.push({ type: "hold", t0: t, t1: Math.max(T.total, t + 0.5), at: cur });
  return out;
}
/** A time named in a short video's script: "<line role>.start|end", "<clip>.start|end|freeze_end", "+0.2" offsets. */
export function anchor(T, a) {
  if (typeof a === "number") return a;
  const m = String(a).match(/^([\w]+)\.(start|end|freeze_end|at)([+-][\d.]+)?$/);
  if (!m) throw new Error(`anchor "${a}": use role.start / clip.end / event.at (+/- seconds)`);
  if (m[2] === "at") {   // a cue's event ("lazy.at": when the word is said)
    const ev = T.events.find((e) => e.event === m[1]); if (!ev) throw new Error(`anchor "${a}": no event "${m[1]}"`);
    return ev.t + Number(m[3] ?? 0);
  }
  const R = roles(T.lines), clip = (T.clips ?? []).find((c) => c.name === m[1]);
  const obj = R[m[1]] ?? clip; if (!obj) throw new Error(`anchor "${a}": no line role or clip "${m[1]}"`);
  const v = m[2] === "freeze_end" ? (obj.freeze_end ?? obj.end) : obj[m[2]];
  return v + Number(m[3] ?? 0);
}

/** Short videos (Retention Engine): the camera plan is in the script ("shots": [{to, at, dur, kind}]), from "start_at". */
export function planShots(T) {
  const S = T.short, moves = [];
  let at = S.start_at ?? "phone", free = 0;
  for (const s of S.shots) {
    const t0 = Math.max(anchor(T, s.at), free);
    moves.push({ type: "move", from: at, to: s.to, t0, t1: t0 + s.dur, kind: s.kind });
    at = s.to; free = t0 + s.dur + (s.hold ?? MIN_HOLD);
  }
  const out = []; let t = 0, cur = S.start_at ?? "phone";
  for (const m of moves) { if (m.t0 > t) out.push({ type: "hold", t0: t, t1: m.t0, at: cur }); out.push(m); t = m.t1; cur = m.to; }
  out.push({ type: "hold", t0: t, t1: Math.max(T.total, t + 0.5), at: cur });
  return out;
}
/** A short video's steps: the lines marked "step" (n, card key, chip), each on screen until the next one starts. */
export function shortSteps(T) {
  const st = T.lines.filter((l) => l.step != null).map((l) => ({ n: l.step, card: l.card, chip: l.chip, line: l, t0: l.start - 0.05 }));
  st.forEach((s, i) => { s.t1 = st[i + 1]?.t0 ?? s.line.end + 0.45; });
  return st;
}
/** A short video's card frame for a step at time t: its frames spread over the line (+0.3 s), a tap 0.35 s before the next. */
export function stepFrames(step, cards) {
  const c = cards[step.card]; if (!c) return null;
  const span = Math.max(0.6, Math.min(step.t1 - step.t0, step.line.end - step.line.start + 0.3)), dur = span / c.frames.length;
  return { c, span, dur, frames: c.frames.map((f, i) => ({ f, t: step.t0 + i * dur, tapAt: c.frames.length > 1 ? (i + 1) * dur - 0.35 : 0.45 })) };
}
export const planFor = (T) => (T.short?.shots ? planShots(T) : T.template ? planTemplate(T) : plan(T));
export const framingsFor = (T) => (T.template ? FRAMINGS_T : FRAMINGS);

/** Problems with a plan: short holds, moves that run past the end. */
export function planProblems(p, T) {
  const probs = [];
  for (const s of p) if (s.type === "hold" && s.t1 - s.t0 < MIN_HOLD - 1e-3 && s.t1 < T.total) probs.push(`hold on ${s.at} only ${(s.t1 - s.t0).toFixed(2)} s at ${s.t0.toFixed(2)}`);
  const last = p.filter((s) => s.type === "move").at(-1);
  if (last && last.t1 > T.total) probs.push(`the last move ends at ${last.t1.toFixed(2)} s, after the audio (${T.total} s)`);
  return probs;
}

export const easeInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
