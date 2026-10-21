// M2: channels and anchors, shared by the compiler (node) and the page runtime (browser).
// A channel's value at t = base + the sum of its ramps; a ramp rises by `amp` from t0 to t1 with an easing.
import { clamp01, eBack, eIn, eInOut, eOut } from "../kit/verbs.js";

export const EASES = Object.freeze({
  lin: (u) => u,
  out: eOut, //            cubic ease-out
  in2: eIn, //             quadratic ease-in (the `span ** 2` of the hand-built code)
  inOut: eInOut, //        cubic ease-in-out
  back: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : eBack(u)), // a pop with overshoot (exactly 0 before, 1 after: the kit pop)
  bump: (u) => Math.sin(Math.PI * u), // 0 -> 1 -> 0 (a light dip)
  step: (u) => (u > 0 ? 1 : 0),
});

/** u in [0, 1] of a ramp at t (a ramp with t1 <= t0 is a step at t0). */
export function rampU(r, t, shift = 0) {
  const t0 = r.t0 + shift, t1 = r.t1 + shift;
  if (!(t1 > t0)) return t >= t0 ? 1 : 0;
  return clamp01((t - t0) / (t1 - t0));
}

export function rampValue(r, t, shift = 0) {
  const u = rampU(r, t, shift);
  if (r.e === "step") return u > 0 ? r.amp : 0;
  const f = EASES[r.e] ?? EASES.lin;
  return r.amp * f(u);
}

export function channelValue(track, t, shift = 0) {
  if (!track) return 0;
  let v = track.base ?? 0;
  for (const r of track.ramps) v += rampValue(r, t, shift);
  return v;
}

// ---------- anchors (the compiler resolves them; the runtime only sees seconds) ----------

const clean = (w) => String(w ?? "").toLowerCase().replace(/[^a-z0-9']/g, "");

/**
 * Resolve an anchor to seconds.
 *  {abs: 2.5}                 seconds
 *  {w: "lay", n: 1, o: 0.02}  the n-th word "lay" of the script (punctuation ignored), + o
 *  {s: "fix1", w: "lay"}      the word "lay" in the sentence whose role is "fix1" (planner templates), + o
 *  {mark: "signPop"}          speechEnd | signPop | lengthEnd | lengthNoEnd, + o
 * `exact: true` on a {w} anchor matches the word with its punctuation ("landfill." vs "landfill").
 */
export function resolveAnchor(a, ctx) {
  if (a == null) throw new Error("missing anchor");
  const o = Number(a.o ?? 0);
  if (a.abs != null) return Number(a.abs) + o;
  if (a.mark) {
    const v = ctx.marks?.[a.mark];
    if (!Number.isFinite(v)) throw new Error(`unknown mark ${a.mark}`);
    return v + o;
  }
  if (a.w != null) {
    const words = a.s != null ? wordsOfSentence(ctx, a.s) : ctx.words;
    const want = a.exact ? String(a.w) : clean(a.w);
    let k = 0;
    for (const w of words) {
      const got = a.exact ? w.w : clean(w.w);
      if (got === want && ++k === (a.n ?? 1)) return w.s + o;
    }
    throw new Error(`anchor word not found: ${JSON.stringify(a)}`);
  }
  throw new Error(`bad anchor ${JSON.stringify(a)}`);
}

function wordsOfSentence(ctx, role) {
  const s = ctx.sentences?.find((x) => x.role === role || x.id === role);
  if (!s) throw new Error(`no sentence with role ${role}`);
  return ctx.words.slice(s.w0, s.w1 + 1);
}

/** Split the voice's words into sentences (a word ending in . ! or ? closes one) with their word index ranges. */
export function sentencesOf(words, roles = []) {
  const out = []; let w0 = 0;
  words.forEach((w, i) => {
    if (/[.!?]["”']?$/.test(w.w) || i === words.length - 1) {
      out.push({ id: `s${out.length + 1}`, role: roles[out.length] ?? null, w0, w1: i, t0: words[w0].s, t1: w.e, text: words.slice(w0, i + 1).map((x) => x.w).join(" ") });
      w0 = i + 1;
    }
  });
  return out;
}
