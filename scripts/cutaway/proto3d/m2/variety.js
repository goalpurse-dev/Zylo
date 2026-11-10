// M2: shot variety for a machine indoors (the owner's review of the real dishwasher run, 2026-11-10: "no same framing for
// more than about 4 s; in machines alternate wide -> close-up inside -> detail, the arm spinning, the heater glowing, with
// the fast moves from step B"). Every sentence's own shot stays the wide one; this adds, inside a sentence:
//   - a DETAIL cut onto the machine's piece that starts moving (a spin, a swing, a spray, a heater coming on), on its move
//   - else, when a framing would hold longer than HOLD s, a CLOSE-UP inside the machine halfway through
// Only planned layouts (codeShots) whose main part is a designed machine (rig) in an indoor setting; never a premade video
// (approved: true; every planned layout carries template: true, so that is no premade marker)
// (the owner approved those as they are), never the opening, the "This is a…" line or the ending.
export const HOLD = 3.6;
const INDOOR = new Set(["room", "kitchen", "workshop", "garage", "laundry", "bathroom", "basement", "utility"]);
const MOVING = new Set(["spin", "swing", "slide", "flow", "heat", "chill", "burn", "pump", "shake", "fill", "light", "blink", "extend", "crank", "track", "follow", "snap"]);
const SKIP = new Set(["hook", "name", "finish", "congrats"]);
import { focusOf, focusOfId } from "./focus.js";
const GAP = 1.3; // seconds between two cuts at least (the director's MOVE.minGap is 1.2)

/** shots to add (each {focus, width, zone, t, at, variety}) and notes */
export function varietyShots(layout, tracks, sentences, shots) {
  const out = [], notes = [];
  // (CUTAWAY_VARIETY=0 turns it off: for a before/after)
  if (typeof process !== "undefined" && process.env?.CUTAWAY_VARIETY === "0") return { shots: out, notes };
  if (!layout?.codeShots || layout.approved === true || layout.camera?.keys?.length) return { shots: out, notes };
  const type = layout.world?.backdrop?.type;
  const main = (layout.parts ?? []).find((p) => p.main) ?? null;
  if (!INDOOR.has(type) || main?.kind !== "rig") return { shots: out, notes };
  // each moving move of the machine: which piece moves, and when it starts
  const nodeOf = new Map();
  for (const n of main.params?.nodes ?? []) for (const m of n.moves ?? []) if (MOVING.has(m.type)) nodeOf.set(m.name, n.id);
  const starts = [];
  for (const [name, node] of nodeOf) for (const r of tracks[`${main.id}.${name}`]?.ramps ?? []) if (r.amp > 0 && !r.auto) starts.push({ t: r.t0, node, name });
  starts.sort((a, b) => a.t - b.t);
  // a piece is framed with some of the machine round it: at least 40% of the machine each way (a thin rod alone filled the
  // stove's frame as a flat grey surface, 2026-11-10)
  const byId = new Map(layout.parts.map((p) => [p.id, p])), cut = layout.world?.cut ?? null, mb = focusOf(main, cut);
  const pieceBox = (node) => {
    const b = focusOfId(byId, `${main.id}.${node}`, cut); if (!b || !mb) return null;
    const c = b.min.map((v, i) => (v + b.max[i]) / 2), h = b.min.map((v, i) => Math.max((b.max[i] - v) / 2, 0.2 * (mb.max[i] - mb.min[i])));
    return { min: c.map((v, i) => +(v - h[i]).toFixed(3)), max: c.map((v, i) => +(v + h[i]).toFixed(3)) };
  };
  const cuts = () => [...shots, ...out].map((s) => s.t).sort((a, b) => a - b);
  const free = (t) => cuts().every((c) => Math.abs(c - t) >= GAP);
  for (const s of sentences) {
    if (SKIP.has(s.role) || !(s.t1 > s.t0)) continue;
    // (only a line about the machine itself: a cut to a piece lost the washer's rpm gauge that line was about)
    const beat = (layout.beats ?? []).find((b) => b.s === s.role);
    if (beat?.shows?.p && String(beat.shows.p).split(".")[0] !== main.id) continue;
    // a detail on the first piece that starts moving in this sentence (not in its first 0.5 s: the sentence's own wide
    // shot lands first; not in its last 0.9 s: the next sentence's shot follows)
    const mv = starts.find((m) => m.t >= s.t0 + 0.5 && m.t <= s.t1 - 0.9 && free(m.t - 0.15));
    if (mv) {
      const pb = pieceBox(mv.node); if (!pb) continue;
      out.push({ box: pb, focus: [`${main.id}.${mv.node}`], width: 0.62, zone: "center", t: +Math.max(0, mv.t - 0.15).toFixed(3), at: { s: s.role }, variety: "detail" });
      notes.push(`variety: ${s.role} cuts to a detail of ${main.id}.${mv.node} (${mv.name}) at ${(mv.t - 0.15).toFixed(2)} s`);
      continue;
    }
    // a framing held longer than HOLD: a close-up inside the machine halfway through it, on the piece this sentence acts on
    // (a shot of the whole machine is pulled back to hold it whole: it would be the wide shot again)
    const before = cuts().filter((c) => c <= s.t1), last = before.length ? before.at(-1) : 0;
    if (s.t1 - Math.max(last, s.t0) > HOLD) {
      const t = +(Math.max(last, s.t0) + (s.t1 - Math.max(last, s.t0)) / 2).toFixed(3);
      const acted = (beat?.do ?? []).filter((a) => a.p === main.id).map((a) => (main.params?.nodes ?? []).find((n) => (n.moves ?? []).some((m) => m.name === a.v))).find(Boolean);
      const pb = acted && pieceBox(acted.id);
      if (pb && free(t)) { out.push({ box: pb, focus: [`${main.id}.${acted.id}`], width: 0.8, zone: "center", t, at: { s: s.role }, variety: "close" }); notes.push(`variety: ${s.role} gets a close-up of ${main.id}.${acted.id} at ${t.toFixed(2)} s (held over ${HOLD} s)`); }
    }
  }
  return { shots: out, notes };
}
