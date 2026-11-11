// M2: the camera rules of the competitor look round (the owner's rules 12, 13 and 14 of 2026-11-11, after studying the
// top storm drain / roof / tunnel / well / sewer videos: their camera never leaves the world and never cuts, it travels
// along the water's path to the next problem, dives into a macro of each fix's mechanism and pulls back wide again):
//   12 ONE WORLD, ONE CONTINUOUS SHOT: between lines the camera travels (a smooth, speed-limited move) to where the next
//      problem is, along layout.story.flow when the plan has one (roof -> gutter -> downspout -> drain), never a cut;
//   13 CLOSE / WIDE RHYTHM: each fix line dives into a macro of its mechanism (the part its cue names), the next line pulls
//      back; a new view every 2-4 s, no framing held over RULES.holdMax s (a drift that barely changes it does not count);
//   14 FRAMING: the part a line is about fills 40-60% of the frame, low and close on the close shots, and stays out of the
//      caption band.
// Custom layouts only (codeShots, approved !== true, no hand-made camera): a premade video keeps the camera the owner
// approved. The free check of these rules is cameraRuleChecks in m2/checks.mjs. Pure math: runs in node and in the page.
import { focusOf, focusOfId } from "./focus.js";
import { subjectBox } from "./framing.js";

// holdMax: the longest framing (s); fill: the line's part as a share of the frame (the larger of its width and height
// share, so a downspout standing the frame's height counts as filling it); macroFill: a macro's part at least this;
// lowElev / midElev: a close shot's camera elevation (degrees; the base view is 22) and a pulled-back one's; yaw: the
// side step (degrees) a rhythm shot takes so it is a new view, under the 20 degree turn limit between keys;
// travel: a move between lines takes travel.min-travel.max s at most travel.speed view-distances per second, starting
// travel.lead of its length before the line; caption: the caption band (compile.mjs puts captions at 0.52, or moves a word
// off a part to 0.42-0.84 by tl.captionY)
export const RULES = Object.freeze({
  holdMax: 4, holdAim: 3.2, fill: [0.4, 0.6], fillAim: 0.5, macroFill: 0.5, lowElev: 12, midElev: 28, yaw: 9,
  travel: { min: 0.6, max: 1.5, speed: 1.4, lead: 0.4, perStop: 0.3 }, caption: { y: 0.52, half: 0.05, x: [0.15, 0.85] },
});
export const FIX = /^fix\d*$/;
// never re-cut: the opening, the "This is a…" line, the end (variety.js keeps the same exclusions)
export const SKIP_ROLES = new Set(["hook", "name", "finish", "congrats"]);

/** the rules apply: a planned (custom) layout, not a premade one, with the code framing its shots */
export function cameraRulesOn(layout) {
  if (typeof process !== "undefined" && process.env?.CUTAWAY_CAMRULES === "0") return false;
  return !!layout?.codeShots && layout.approved !== true && !layout.camera?.home && !layout.camera?.keys?.length;
}

/** a padded piece of a designed part: at least 25% of the machine each way (a thin rod alone was a flat grey frame) */
function pieceBox(layout, main, node) {
  const cut = layout.world?.cut ?? null, b = focusOfId(new Map(layout.parts.map((p) => [p.id, p])), `${main.id}.${node}`, cut), mb = focusOf(main, cut);
  if (!b || !mb) return b ?? null;
  const c = b.min.map((v, i) => (v + b.max[i]) / 2), h = b.min.map((v, i) => Math.max((b.max[i] - v) / 2, 0.125 * (mb.max[i] - mb.min[i])));
  return { min: c.map((v, i) => +(v - h[i]).toFixed(3)), max: c.map((v, i) => +(v + h[i]).toFixed(3)) };
}

/**
 * What a line is about, as a box: its beat's shows.p (a piece "washer.valve" by its own box); a designed part shown whole
 * whose beat moves one of its pieces: that piece (the mechanism, not the whole machine). { id, box } or null.
 */
export function lineSubject(layout, role) {
  const beat = (layout.beats ?? []).find((b) => b.s === role), id = beat?.shows?.p;
  if (!id) return null;
  const parts = new Map((layout.parts ?? []).map((p) => [p.id, p])), cut = layout.world?.cut ?? null;
  const p = parts.get(String(id).split(".")[0]); if (!p) return null;
  if (String(id).includes(".")) { const b = p.kind === "rig" ? pieceBox(layout, p, String(id).split(".").slice(1).join(".")) : focusOfId(parts, id, cut); return b ? { id: String(id), box: b } : null; }
  if (p.kind === "rig") {
    const acted = (beat.do ?? []).filter((a) => a.p === p.id).map((a) => (p.params?.nodes ?? []).find((n) => (n.moves ?? []).some((m) => m.name === a.v))).find(Boolean);
    const b = acted && pieceBox(layout, p, acted.id);
    if (b) return { id: `${p.id}.${acted.id}`, box: b };
  }
  const b = focusOf(p, cut);
  return b ? { id: p.id, box: b } : null;
}

/**
 * The macro's region of a line's part (rule 13): the part itself when it is small; a big or long one (a 15 m pipe, a parking
 * lot: framed whole at half the width it is the wide shot again, the free sweep of 2026-11-11) gives a cube of side `side`
 * round its point nearest to where the story comes from (the line before's part: the water arrives there), else round
 * its middle. side: 3 m or a quarter of the build's width, whichever is bigger.
 */
export function macroRegion(box, from = null, buildWidth = 12) {
  const side = Math.max(3, 0.25 * buildWidth), ext = box.max.map((v, i) => v - box.min[i]);
  if (Math.max(ext[0], ext[2]) <= side * 1.2) return box;
  const c = box.min.map((v, i) => (v + box.max[i]) / 2), aim = from ? from.min.map((v, i) => (v + from.max[i]) / 2) : c;
  const p = aim.map((v, i) => Math.min(box.max[i], Math.max(box.min[i], v)));
  const h = side / 2, out = { min: [0, 0, 0], max: [0, 0, 0] };
  for (let i = 0; i < 3; i++) {
    if (ext[i] <= side) { out.min[i] = box.min[i]; out.max[i] = box.max[i]; continue; }
    const lo = Math.min(Math.max(p[i] - h, box.min[i]), box.max[i] - side);
    out.min[i] = +lo.toFixed(3); out.max[i] = +(lo + side).toFixed(3);
  }
  return out;
}

/** a fix line's macro box: its part's macro region, coming from the part of the line before it (roles: the lines in order) */
export function macroBoxFor(layout, roles, role) {
  const sub = lineSubject(layout, role); if (!sub) return null;
  const i = roles.indexOf(role), prev = i > 0 ? lineSubject(layout, roles[i - 1]) : null, sb = subjectBox(layout);
  return macroRegion(sub.box, prev?.box ?? null, sb ? Math.max(sb.max[0] - sb.min[0], sb.max[2] - sb.min[2]) : 12);
}

/** the places of layout.story.flow (part ids, or {p}), in order, with their boxes (unknown ones left out) */
export function flowPlaces(layout) {
  const parts = new Map((layout.parts ?? []).map((p) => [p.id, p])), cut = layout.world?.cut ?? null, out = [];
  for (const f of Array.isArray(layout.story?.flow) ? layout.story.flow : []) {
    const id = typeof f === "string" ? f : f?.p ?? f?.part ?? f?.id; if (!id) continue;
    const b = focusOfId(parts, String(id), cut); if (b) out.push({ id: String(id), box: b });
  }
  return out;
}

/**
 * The rhythm shots for a custom layout (rule 13): { shots: [{ box, focus, t, at, rhythm: "macro" | "close" | "mid" }],
 * notes }. A fix line dives into its mechanism on the word its part acts on (a short line: its own shot becomes the
 * macro, marked on that shot); then any stretch of a line (not the opening, the name line or the end) held longer than
 * RULES.holdAim gets a new view of the line's part, alternately close and pulled back.
 * tracks: the compiled channels (to find when the part acts); sentences: [{role, t0, t1}]; shots: the shots so far.
 */
export function rhythmShots(layout, tracks, sentences, shots) {
  const out = [], notes = [];
  if (!cameraRulesOn(layout)) return { shots: out, notes };
  const GAP = 1.4; // a travel (0.6-1.5 s) must land and be seen before the next one
  const cuts = () => [...shots, ...out].map((s) => s.t).sort((a, b) => a - b);
  const free = (t) => cuts().every((c) => Math.abs(c - t) >= GAP);
  const main = (layout.parts ?? []).find((p) => p.main) ?? null;
  let alt = 0;
  for (const s of sentences) {
    if (SKIP_ROLES.has(s.role) || !(s.t1 > s.t0)) continue;
    const sub = lineSubject(layout, s.role) ?? (main ? (() => { const b = focusOf(main, layout.world?.cut ?? null); return b ? { id: main.id, box: b } : null; })() : null);
    if (!sub) continue;
    if (FIX.test(s.role)) {
      // the moment its part acts: its first motion anchored to this line
      const base = sub.id.split(".")[0];
      const acts = Object.entries(tracks ?? {}).filter(([k]) => k.split(".")[0] === base).flatMap(([, tr]) => tr.ramps ?? []).filter((r) => r.s === s.role && r.amp !== 0).map((r) => r.t0);
      const tAct = acts.length ? Math.min(...acts) : s.t0 + 0.8;
      const t = +Math.min(Math.max(tAct - 0.3, s.t0 + 0.9), s.t1 - 0.6).toFixed(3);
      if (t > s.t0 + 0.8 && free(t)) { out.push({ box: macroBoxFor(layout, sentences.map((x) => x.role), s.role) ?? sub.box, focus: [sub.id], t, at: { s: s.role }, rhythm: "macro" }); notes.push(`rhythm: ${s.role} dives into a macro of ${sub.id} at ${t.toFixed(2)} s`); }
      else {
        // (a line too short for a travel and a dive: its own shot is the macro)
        const own = shots.find((x) => x.at?.s === s.role && !x.hero && Math.abs(x.t - s.t0) < 0.6);
        if (own) { own.rhythm = "macro"; own.box = macroBoxFor(layout, sentences.map((x) => x.role), s.role) ?? sub.box; own.focus = [sub.id]; notes.push(`rhythm: ${s.role}'s own shot is the macro of ${sub.id}`); }
      }
    }
    // a framing held longer than holdAim inside this line: a new view (close, then pulled back) at the middle of the stretch
    // (from the last cut before the line: a hold that began in the line before counts too)
    for (let guard = 0; guard < 6; guard++) {
      const cs = cuts(), prev = cs.filter((c) => c <= s.t0 + 0.05).at(-1) ?? s.t0;
      const pts = [Math.max(prev, s.t0 - RULES.holdAim + GAP), ...cs.filter((c) => c > s.t0 + 0.05 && c < s.t1), s.t1];
      const long = pts.findIndex((c, i) => i && c - pts[i - 1] > RULES.holdAim);
      if (long < 0) break;
      const t = +Math.max(s.t0 + 0.3, (pts[long - 1] + pts[long]) / 2).toFixed(3);
      if (t - pts[long - 1] < GAP * 0.85 || pts[long] - t < GAP * 0.85) break;
      out.push({ box: sub.box, focus: [sub.id], t, at: { s: s.role }, rhythm: alt++ % 2 ? "mid" : "close" });
      notes.push(`rhythm: ${s.role} gets a ${out.at(-1).rhythm} view of ${sub.id} at ${t.toFixed(2)} s (held over ${RULES.holdAim} s)`);
    }
  }
  return { shots: out, notes };
}

/**
 * two camera keys ({pos, tgt}) show the same framing: the view turns 8 degrees or less, the distance changes by under a
 * quarter and the aim moves under a fifth of the distance (the hold's 10% creep and 4 degree orbit stay the same framing)
 */
export function sameView(a, b) {
  const da = a.pos.map((v, i) => v - a.tgt[i]), db = b.pos.map((v, i) => v - b.tgt[i]), la = Math.hypot(...da), lb = Math.hypot(...db);
  const turn = (Math.acos(Math.max(-1, Math.min(1, da.reduce((s, v, i) => s + v * db[i], 0) / (la * lb)))) * 180) / Math.PI;
  return turn <= 8 && Math.abs(Math.log(lb / la)) <= Math.log(1.25) && Math.hypot(...a.tgt.map((v, i) => v - b.tgt[i])) <= 0.2 * la;
}

/** how much of the frame width a screen rectangle fills (clipped to the frame) */
export function fillOf(r) {
  if (!r || r.behind) return 0;
  return Math.max(0, Math.min(1, r.x1) - Math.max(0, r.x0));
}
/**
 * the fill rule (14) met: 40-60% of the width (with a little slack), or a part too tall and thin to be 40% wide whole
 * standing 75% of the frame's height or more (a well casing, a downspout: held whole, the 2026-10-30 well run)
 */
export function fillMet(r, slack = [0, 0]) {
  const w = fillOf(r); if (!(w > 0)) return false;
  const h = Math.min(1, r.y1) - Math.max(0, r.y0);
  return (w >= RULES.fill[0] - slack[0] && w <= RULES.fill[1] + slack[1]) || (w < RULES.fill[0] && h >= 0.75);
}
