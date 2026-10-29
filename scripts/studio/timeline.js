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

/** Problems with a plan: short holds, moves that run past the end. */
export function planProblems(p, T) {
  const probs = [];
  for (const s of p) if (s.type === "hold" && s.t1 - s.t0 < MIN_HOLD - 1e-3 && s.t1 < T.total) probs.push(`hold on ${s.at} only ${(s.t1 - s.t0).toFixed(2)} s at ${s.t0.toFixed(2)}`);
  const last = p.filter((s) => s.type === "move").at(-1);
  if (last && last.t1 > T.total) probs.push(`the last move ends at ${last.t1.toFixed(2)} s, after the audio (${T.total} s)`);
  return probs;
}

export const easeInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
