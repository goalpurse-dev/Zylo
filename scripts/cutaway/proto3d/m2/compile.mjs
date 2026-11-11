// M2: the timeline compiler. A layout (parts, cues, camera, audio) + the voice's real word times -> timeline.json
// with every anchor resolved to seconds. $0, no network.
//   node m2/compile.mjs <layout.json> <words.json> <speechEndSec> <out timeline.json> [roles.json]
import fs from "node:fs";
import { resolveAnchor, sentencesOf } from "./curves.js";
import { fillGaps, motionGaps, storyFx } from "./storyFx.js";
import { varietyShots } from "./variety.js";
import { reportBug, soft } from "./bookkeeping.js";
import { KIND_CHANNELS } from "./parts.js";
const KIND_OK = (k) => !!KIND_CHANNELS[k];
import { validateLayout } from "./format.js";
import { expandBeats } from "./verbs.js";
import { focusOf, signalQueueBox, union } from "./focus.js";
import { directCamera, cameraAt, projectBox, MOVE } from "./director.js";

// The end card rule (owner-approved 2026-10-20): the sign pops 0.4 s after the voice audibly stops (measured from
// the audio, not the aligner), pops over 0.45 s and holds 1.75 s. Without the end card: a 1.5 s calm hold.
export const END = Object.freeze({ gap: 0.4, pop: 0.45, hold: 1.75, noEndHold: 1.5 });

export function marksFor(words, speechEnd) {
  const voiceEnd = words.at(-1).e;
  const signPop = +(speechEnd + END.gap).toFixed(3);
  return { speechEnd, voiceEnd, signPop, lengthEnd: +(signPop + END.pop + END.hold).toFixed(3), lengthNoEnd: +(speechEnd + END.noEndHold).toFixed(3) };
}

// the channels that are on/off switches (compile: they never stack past on or below off)
export const SWITCHES = Object.freeze({ trafficLight: ["red", "yellow", "green", "cycle", "flash", "fast"] });

// a setting's ambience file (makeAmbience.mjs): one per setting, the yard's for anything else
export const AMBIENCE_OF = Object.freeze({ yard: "yard", street: "street", park: "park", garage: "garage", room: "room", carwash: "carwash", kitchen: "room", workshop: "garage" });

/**
 * The name label (the creator's newer videos, 2026-10-25: "INDUCTIVE LOOP" in caps on screen as the line names it): the
 * naming line ("This is a signal controller.") gets a short card with the name, from its first word, for 1.6 s. Not
 * when a number card is up then, and not for a name too long to read at a glance (over 22 letters).
 */
export function nameCards(sentences, words, cards = []) {
  const out = [];
  for (const s of sentences) {
    // (a second name line may end "...is a skimmer": the card says which box it is, the owner's review of 2026-10-31)
    const m = /\bthis is (?:an? |the |your )?([a-z][a-z' -]*?)(?=[,.!?;]|$| that | which | and | but )/i.exec(s.text ?? "") ?? (/^name[23]$/.test(s.role ?? "") ? /\b(?:is|are) (?:an? |the )?([a-z][a-z' -]*?)[.!?]?$/i.exec(s.text ?? "") : null);
    if (!m) continue;
    const name = m[1].trim().replace(/\s+/g, " ");
    if (!name || name.length > 22 || name.split(" ").length > 3) continue;
    const first = name.split(" ")[0].toLowerCase();
    const w = words.find((x) => x.s >= s.t0 - 0.01 && x.s <= s.t1 + 0.01 && x.w.toLowerCase().replace(/[^a-z']/g, "") === first);
    const t = w ? w.s : s.t0 + 0.4, e = t + 1.6;
    if (cards.some((c) => c.s < e && c.e > t)) continue;
    out.push({ text: name.toUpperCase(), s: +t.toFixed(3), e: +e.toFixed(3), kind: "name" });
  }
  return out;
}

/**
 * The red state label (the examples' "TOO FAST", "NO POWER", "BROKEN", studied 2026-10-28): a problem line's card, on its
 * problem word, held to the end of the line so any frame of it reads the state. The beat's own `state` ({text, w}) when the
 * planner gave one, else one from the line's words (STATE_WORDS).
 */
export const STATE_WORDS = [
  [/\btoo fast\b/i, "TOO FAST"], [/\btoo slow\b/i, "TOO SLOW"], [/\bno power\b|\bpower (?:goes|is) out\b/i, "NO POWER"],
  [/\bcrash|\bbump|\bslam|\brear-end/i, "CRASH!"], [/\bsnaps?\b|\bbreaks?\b|\bbroke/i, "BROKEN"], [/\bjams?\b|\bstuck\b/i, "STUCK"],
  [/\bpiles? up\b|\bbacks? up\b/i, "JAMMED"], [/\bflood|\boverflow/i, "FLOODED"], [/\bleaks?\b|\bseeps?\b/i, "LEAKING"],
  [/\bclog/i, "CLOGGED"], [/\bfreez|\bfrozen\b/i, "FROZEN"], [/\bmelt/i, "MELTING"], [/\brots?\b|\brotting\b/i, "ROTTING"],
  [/\bcracks?\b/i, "CRACKED"], [/\bdies?\b|\bdying\b/i, "DYING"], [/\bstinks?\b|\bsmells?\b/i, "STINKS"], [/\btoo heavy\b|\bweighs\b/i, "TOO HEAVY"],
  [/\bhot\b|\boverheat|\bheats?\b/i, "TOO HOT"], [/\bdirty\b|\bmurky\b|\bturns? green\b|\bgreen water\b|\balgae\b/i, "DIRTY"], [/\bdrowns?\b|\bsoggy\b|\bwaterlogged\b/i, "SOAKED"],
  // (the free pond run: "heavy rain" was labelled TOO HEAVY, and "soaks into the soil" and "spills over" got no label)
  [/\bsoaks? (?:in|away|into)\b|\bdrains? away\b/i, "EMPTY"], [/\bspills?\b/i, "OVERFLOW"],
];
export function stateCards(sentences, words, beats = [], cards = []) {
  const out = [];
  for (const [i, s] of sentences.entries()) {
    if (!/^problem/.test(s.role ?? "")) continue;
    const own = beats.find((b) => b.s === s.role)?.state;
    let text = own?.text ?? (typeof own === "string" ? own : null), word = own?.w ?? null;
    if (!text) for (const [re, label] of STATE_WORDS) { const m = re.exec(s.text ?? ""); if (m) { text = label; word = m[0].split(/\s+/)[0]; break; } }
    if (!text || text.length > 14) continue;
    const key = String(word ?? "").toLowerCase().replace(/[^a-z']/g, "");
    const w = key && words.find((x) => x.s >= s.t0 - 0.01 && x.s <= s.t1 + 0.01 && x.w.toLowerCase().replace(/[^a-z']/g, "").startsWith(key));
    // (to the line's end, never into the fix that follows: a DIRTY label 1.2 s from a late word sat on the fix's frame)
    const next = sentences[i + 1]?.t0 ?? Infinity, t = w ? w.s : s.t0 + 0.4, e = Math.min(Math.max(t + 0.7, s.t1 + 0.1), next - 0.05);
    if (cards.some((c) => c.kind === "state" && c.s < e && c.e > t)) continue;
    // labels never pile up (the owner's rule of 2026-10-30: LEAKING, 20,000 TONS and the caption stood on the house
    // together): a number or name card up at that moment goes first and the state follows it, or stays away if under
    // 0.8 s of the line is left
    let t1 = t;
    for (const c of [...cards].filter((x) => x.kind !== "state").sort((a, b) => a.s - b.s)) if (c.s < e && c.e > t1) t1 = c.e + 0.05;
    if (e - t1 < 0.8) continue;
    out.push({ text: text.toUpperCase(), s: +t1.toFixed(3), e: +e.toFixed(3), kind: "state" });
  }
  return out;
}

// The hold (the owner's rule of 2026-10-28, from the examples: the crane mast stays tilted, the elevator hangs mid-fall):
// in a layout with hold: true, a beat's motion runs to 70% of its travel by 75% of its line and holds there, the rest
// after the line ends; the check frames are taken during the hold (the tail ramp is marked so previewTimes skips it).
// Only motions: a part's visibility and switches keep their timing. (Not a counter: the number it says must be reached;
// held at 70% a "6 inches an hour" gauge read 4, free harness 2026-10-28.)
const HOLD_CH = { car: ["drive", "leave"], traffic: ["pile", "go"], dumpTruck: ["tip"], cabinet: ["open"] };
const RIG_HOLD = new Set(["slide", "swing", "track", "extend", "snap", "fill"]);
function holdable(part, ch) {
  if (!part) return false;
  if (part.kind === "rig") return (part.params?.nodes ?? []).some((n) => (n.moves ?? []).some((m) => m.name === ch && RIG_HOLD.has(m.type)));
  return (HOLD_CH[part.kind] ?? []).includes(ch);
}
export function holdRamps(r, s) {
  const dur = s.t1 - s.t0, len = r.t1 - r.t0;
  if (dur < 1 || len < 0.25 || r.amp <= 0 || r.e === "step" || r.e === "bump" || r.t1 <= s.t0 + 0.75 * dur) return [r];
  const t0 = Math.max(s.t0 + 0.1, Math.min(r.t0, s.t1 - 1.0)), tA = Math.max(t0 + 0.35, Math.min(t0 + 0.7 * len, s.t0 + 0.75 * dur));
  return [{ ...r, t0: +t0.toFixed(4), t1: +tA.toFixed(4), amp: +(r.amp * 0.7).toFixed(4), e: "out" }, { ...r, t0: +s.t1.toFixed(4), t1: +(s.t1 + Math.max(0.3, 0.3 * len)).toFixed(4), amp: +(r.amp * 0.3).toFixed(4), e: "inOut", tail: true }];
}

/** the camera when the director crashes: one fixed high three-quarter view of the subject (or the cut) */
function plainCamera(layout, marks) {
  const parts = layout.parts.filter((p) => p.main), cut = layout.world?.cut;
  let box = null; for (const p of parts) { try { box = focusOf(p, cut); } catch {} if (box) break; }
  if (!box) box = cut ? { min: [cut.x0, -cut.depth, cut.z0], max: [cut.x1, 0, 0] } : { min: [-5, 0, -6], max: [5, 3, 0] };
  const c = box.min.map((v, i) => (v + box.max[i]) / 2), r = Math.max(4, ...box.max.map((v, i) => v - box.min[i])) * 1.4;
  const pos = [+(c[0] + r * 0.35).toFixed(3), +(c[1] + r * 0.75).toFixed(3), +(c[2] + r * 1.2).toFixed(3)], tgt = c.map((v) => +v.toFixed(3)), end = marks.lengthEnd ?? 30;
  const keys = [[0, pos, tgt], [end, pos, tgt]];
  return { end: keys, noend: keys, notes: ["the plain camera (the director crashed)"], frames: [] };
}

export function compile(layout0, words, speechEnd, { roles = [] } = {}) {
  // what the narration says happens on screen (storyFx.js: the event words, the "Add ..." line), on a planned layout
  // (its beats); the layout itself gets the parts it adds, so the page has them (CUTAWAY_STORYFX=0 turns it off)
  // (not an approved layout with its own camera path: the owner approved those as they are)
  const fxOn = process.env.CUTAWAY_STORYFX !== "0" && Array.isArray(layout0.beats) && layout0.beats.length && roles.length && (layout0.codeShots || !layout0.camera);
  // (the still-moment life of an earlier compile, saved with the plan, goes: it is filled again below from today's rules,
  // and a second auto_life1 next to the old one was a duplicate id; 10 saved plans still carried the old dust specks)
  if (fxOn && Array.isArray(layout0.parts)) { layout0.parts = layout0.parts.filter((p) => !/^auto_life\d+$/.test(p.id)); if (Array.isArray(layout0.cues)) layout0.cues = layout0.cues.filter((c) => !/^auto_life\d+$/.test(String(c.p))); }
  const story = fxOn ? soft("story effects", () => storyFx(layout0, sentencesOf(words, roles).map((s) => ({ role: s.role, text: s.text }))), { notes: [], stats: {} }) : { notes: [], stats: {} };
  // (a position or size that is not three numbers gets safe ones: a NaN or a word in the main subject's position stopped
  // the page, the crash sweep of 2026-11-05; each is our bug, logged, and the part is drawn at the fallback)
  soft("part numbers", () => {
    const fixed = [];
    for (const p of layout0.parts ?? []) for (const k of ["pos", "at", "size"]) {
      const v = p.params?.[k];
      if (Array.isArray(v) && v.length === 3 && v.some((x) => !Number.isFinite(Number(x)) || x === null || x === "")) { p.params[k] = v.map((x) => (x === null || x === "" || !Number.isFinite(Number(x)) ? (k === "size" ? 1 : 0) : Number(x))); fixed.push(`${p.id}.${k}`); }
    }
    // (a path or a list of points: entries that are not three numbers are dropped, and one point left gets a second just
    // beside it: a line needs two)
    for (const p of layout0.parts ?? []) for (const k of ["path", "points"]) {
      const v = p.params?.[k]; if (!Array.isArray(v) || (k === "points" && p.kind !== "outline")) continue;
      const ok = v.filter((q) => Array.isArray(q) && q.length === 3 && q.every((x) => x !== null && x !== "" && Number.isFinite(Number(x)))).map((q) => q.map(Number));
      if (ok.length === 1) ok.push([ok[0][0] + 0.05, ok[0][1], ok[0][2]]);
      if (ok.length !== v.length || ok.some((q, i) => q !== v[i])) { if (ok.length >= 2 || v.length) { p.params[k] = ok; if (ok.length !== v.length) fixed.push(`${p.id}.${k}`); } }
    }
    if (fixed.length) reportBug("part numbers (not numbers, set to safe ones)", new Error(fixed.join(", ")));
  }, null);
  // a planner layout says what happens as beats (kit verbs on words) and shots; they become cues here
  const beats = expandBeats(layout0, { lenient: true });
  const layout = { ...layout0, cues: [...(layout0.cues ?? []), ...beats.cues], shots: [...(layout0.shots ?? []), ...beats.shots] };
  const sign = layout.parts.find((p) => p.kind === "sign");
  if (sign && !layout.cues.some((c) => c.p === sign.id && c.c === "pop")) layout.cues.push({ p: sign.id, c: "pop", a: { mark: "signPop" }, e: "step" });
  let problems = validateLayout(layout);
  const notes = [];
  if (problems.length) {
    const bad = new Set(problems.map((p) => /^cue (\d+) /.exec(p)).filter(Boolean).filter((m) => !/unknown easing/.test(problems.find((p) => p.startsWith(`cue ${m[1]} `)) ?? "")).map((m) => Number(m[1])));
    layout.cues = layout.cues.map((c) => (c.e != null && /unknown easing/.test(problems.find((p) => p.startsWith(`cue ${layout.cues.indexOf(c)} `)) ?? "") ? { ...c, e: "lin" } : c)).filter((_, i) => !bad.has(i));
    notes.push(...problems.filter((p) => /^cue \d+ /.test(p)).map((p) => `fixed: ${p}`));
    problems = validateLayout(layout);
  }
  // (the owner's rule of 2026-11-05: an optional thing never stops a video. A shot on a part or piece that is not there
  // loses that name, and a shot left with none is dropped; no shot at all frames the main subject; a part of an unknown
  // kind, or a second one with the same id, is left out. Each is our bug, logged. The crash sweep's 284 crashes.)
  if (problems.some((p) => /^shot \d+: |^camera needs|^part \S+: (unknown kind|duplicate id|bad id)/.test(p))) {
    const badPart = new Set(problems.map((p) => /^part (\S+): (unknown kind|duplicate id)/.exec(p)?.[1]).filter(Boolean));
    if (badPart.size) {
      const seen = new Set();
      layout.parts = layout.parts.filter((p) => { const keep = p.main || !(badPart.has(p.id) && (seen.has(p.id) || !KIND_OK(p.kind))) ; const first = !seen.has(p.id); seen.add(p.id); return keep && (first || p.main); });
      layout.cues = layout.cues.filter((c) => layout.parts.some((p) => p.id === c.p));
    }
    const pieceOk = (id) => { const [pid, node] = String(id).split("."), p = layout.parts.find((q) => q.id === pid); if (!p) return false; if (!node) return true; return p.kind === "rig" && (p.params?.nodes ?? []).some((n) => n?.id === node); };
    // (a piece that is not there: the whole part instead, when the part is)
    const fixId = (id) => (id === "home" || pieceOk(id) ? id : layout.parts.some((q) => q.id === String(id).split(".")[0]) ? String(id).split(".")[0] : null);
    layout.shots = layout.shots.map((s) => { if (s.focus === "home" || !Array.isArray(s.focus)) return s; const f = [...new Set(s.focus.map(fixId).filter(Boolean))]; return f.length ? { ...s, focus: f } : null; }).filter(Boolean);
    if (!layout.shots.length && !(layout.camera?.keys?.length >= 2)) { const m = layout.parts.find((p) => p.main) ?? layout.parts.find((p) => !["light", "sign", "rain"].includes(p.kind)); layout.shots = [{ focus: m ? [m.id] : "home", at: { s: roles[0] ?? null } }].map((s) => (s.at.s ? s : { ...s, at: { abs: 0 } })); }
    reportBug("the layout (repaired before the timeline: bad shots or parts left out)", new Error(problems.filter((p) => /^shot |^camera|^part /.test(p)).join("; ").slice(0, 280)));
    problems = validateLayout(layout);
  }
  if (problems.length) throw new Error(`layout ${layout.key}: ${problems.join("; ")}`);
  const sentences = sentencesOf(words, roles);
  const marks = marksFor(words, speechEnd);
  const exact = layout.anchorMatch === "exact";
  const ctx = { words, sentences, marks };
  const at = (a) => {
    try { return resolveAnchor(exact && a.w != null && a.exact == null ? { ...a, exact: true } : a, ctx); } catch (e) {
      if (!/anchor word not found/.test(e.message) || a.s == null) throw e;
      notes.push(`${a.s}: "${a.w}" is not said, so it fires at the sentence start`);
      const { w, n, exact: _x, ...rest } = a; return resolveAnchor(rest, ctx);
    }
  };

  const tracks = {};
  for (const p of layout.parts) for (const [ch, base] of Object.entries(p.base ?? {})) tracks[`${p.id}.${ch}`] = { base, ramps: [] };
  for (const c of layout.cues) soft(`cue ${c.p}.${c.c}`, () => {
    const key = `${c.p}.${c.c}`;
    // (in a planned layout, nothing the "Add ..." line adds appears before that line starts: a young tree led in 0.7 s
    // early, layoutRules 7, popped up beside the gauge during the line before; free ice rink run, 2026-10-28)
    const finS = layout.hold && c.a?.s === "finish" ? sentences.find((x) => x.role === "finish") : null;
    const raw0 = at(c.a), t0 = finS ? Math.max(raw0, finS.t0 - 0.05) : raw0;
    const t1 = Math.max(t0, c.b ? at(c.b) + (t0 - raw0) : c.d != null ? t0 + Number(c.d) : t0);
    // (s: the sentence whose words it is anchored to, so the preview moment knows this beat's motions from the next one's)
    const r = { t0: +t0.toFixed(4), t1: +t1.toFixed(4), amp: c.amp ?? 1, e: c.e ?? (c.b || c.d != null ? "lin" : "step"), ...(c.a?.s ? { s: c.a.s } : {}) };
    const sen = layout.hold && c.a?.s && holdable(layout.parts.find((p) => p.id === c.p), c.c) ? sentences.find((x) => x.role === c.a.s) : null;
    (tracks[key] ??= { base: 0, ramps: [] }).ramps.push(...(sen ? holdRamps(r, sen) : [r]));
  }, null);
  // a designed part (rig) that no beat ever shows is in the world from the first frame (a re-planned washing machine whose
  // plan never said "show" rendered an empty laundry room, 2026-11-11; plant early, rule 6). Custom plans only
  if (layout.approved !== true) for (const p of layout.parts) if (p.kind === "rig" && !tracks[`${p.id}.pop`]?.ramps?.length && !(p.base && "pop" in p.base)) tracks[`${p.id}.pop`] = { base: 1, ramps: [] };
  // a state change said on its line's last word ("…turns it to mud", "…turns green": rule 10, action on the word) is
  // complete by that line's end, so the line's own frames show it; its 1 s ramp ran on into the next line and the pool's
  // mud and algae never showed in their own line (the owner, 2026-11-11: dirty water must clearly read as dirty, then
  // visibly clear). Custom plans only; at least 0.3 s, never moved earlier than its word
  if (layout.approved !== true) for (const [key, tr] of Object.entries(tracks)) {
    if (!/\.(dirty|clean|clear|flood|fill|freeze|murk)$/.test(key)) continue;
    for (const r of tr.ramps ?? []) {
      const sen = r.s ? sentences.find((x) => x.role === r.s) : null;
      if (sen && r.t1 > sen.t1 && r.t0 < sen.t1 - 0.05) r.t1 = +Math.max(r.t0 + 0.3, sen.t1).toFixed(4);
    }
  }
  // a switch is on or off (a lamp, a signal's cycle): in time order, an "on" while on or an "off" while off does nothing
  // (the steps add up: two "red"s made red 2, and the next "green" left it lit)
  // (in a planned layout a water level is kept between empty and full the same way: a trickle then a full drain left it
  // below empty, and the next trickle never showed; free basement run, 2026-10-28)
  for (const p of layout.parts) for (const ch of [...(SWITCHES[p.kind] ?? []), ...(layout.hold && p.kind === "water" ? ["flood"] : [])]) {
    const tr = tracks[`${p.id}.${ch}`]; if (!tr) continue;
    let s = Math.min(1, Math.max(0, tr.base ?? 0));
    for (const r of [...tr.ramps].sort((a, b) => a.t0 - b.t0)) { const next = Math.min(1, Math.max(0, s + r.amp)); r.amp = +(next - s).toFixed(4); s = next; }
  }
  // (in a planned layout a move that reverses the one before it on the same channel waits until that one is done: ramps
  // add up, so a door closing over 1.4 s and opening 0.6 s later cancelled out and never visibly closed; the 60 s free
  // garage door run of 2026-10-30)
  if (layout.hold) for (const tr of Object.values(tracks)) {
    const rs = [...tr.ramps].sort((a, b) => a.t0 - b.t0);
    for (let i = 1; i < rs.length; i++) {
      const a = rs[i - 1], b = rs[i];
      if (Math.sign(a.amp) && Math.sign(b.amp) === -Math.sign(a.amp) && b.t0 < a.t1 && a.t1 > a.t0) { const d = b.t1 - b.t0; b.t0 = +a.t1.toFixed(4); b.t1 = +(a.t1 + d).toFixed(4); }
    }
  }
  // a designed part's piece is shown once: a show while it is already shown (or a hide while hidden) is dropped. Its
  // value went to 2 and the piece was drawn twice its size: the dishwasher's grime, "shown" again where the planner meant
  // to take it away, hung outside the glass (the real run of 2026-11-10)
  soft("pieces shown twice", () => {
    for (const p of layout.parts ?? []) {
      if (p.kind !== "rig") continue;
      for (const m of (p.params?.nodes ?? []).flatMap((n) => n.moves ?? []).filter((m) => m.type === "appear")) {
        const tr = tracks[`${p.id}.${m.name}`]; if (!tr?.ramps?.length) continue;
        let v = tr.base ?? 0; const keep = [];
        for (const r of [...tr.ramps].sort((a, b) => a.t0 - b.t0)) {
          if ((r.amp > 0 && v >= 0.99) || (r.amp < 0 && v <= 0.01)) { notes.push(`${p.id}.${m.name}: a second ${r.amp > 0 ? "show" : "hide"} at ${r.t0.toFixed(2)} s dropped (it was already ${r.amp > 0 ? "shown" : "hidden"})`); continue; }
          keep.push(r); v += r.amp;
        }
        tr.ramps = keep;
      }
    }
  }, null);
  // the "Add ..." line is over before "Congratulations": nothing it plays runs on into that line (the bunker rerun's decay
  // counter counted on 0.5 s into it)
  const finS = fxOn ? sentences.find((x) => x.role === "finish") : null, conS = finS ? sentences.find((x) => x.role === "congrats") : null;
  if (finS && conS) soft("Add line end", () => { for (const tr of Object.values(tracks)) for (const r of tr.ramps) if (r.s === "finish" && r.t1 > conS.t0 - 0.05 && r.t0 < conS.t0) r.t1 = +Math.max(r.t0 + 0.04, conS.t0 - 0.05).toFixed(4); }, null);
  // never a still moment: a stretch of more than storyFx GAP s with nothing moving gets life (the shown part's own
  // motion again, or drifting specks), from the first word to the last
  const gaps = fxOn ? soft("still moments", () => motionGaps(layout, tracks, sentences, { from: sentences[0]?.t0 ?? 0, to: sentences.at(-1)?.t1 }), []) : [];
  if (gaps.length) story.notes.push(...soft("still moments fill", () => fillGaps(layout, tracks, sentences, gaps), []));
  story.stats.gaps = gaps.length;
  notes.push(...story.notes);

  const keysFor = (which) => (layout.camera?.keys ?? []).filter((k) => !k.only || k.only === which).map((k) => [+at(k.at).toFixed(4), k.pos, k.tgt]);
  let camera, director = null;
  if (layout.camera?.keys?.length) camera = { end: keysFor("end"), noend: keysFor("noend") };
  else {
    const shots = layout.shots.map((s) => soft(`shot at ${JSON.stringify(s.at)}`, () => ({ ...s, t: at(s.at) }), null)).filter(Boolean).sort((a, b) => a.t - b.t);
    // a machine indoors: detail cuts and close-ups inside its sentences, no framing held over ~4 s (variety.js)
    soft("shot variety", () => { const v = varietyShots(layout, tracks, sentences, shots); shots.push(...v.shots); shots.sort((a, b) => a.t - b.t); notes.push(...v.notes); }, null);
    director = soft("camera director", () => directCamera(layout, shots, marks), () => plainCamera(layout, marks));
    // every sentence's showing part at least 12% wide and in the frame while it acts: a shot on it where the camera
    // would miss it (then the camera is directed once more)
    const extra = [];
    soft("camera: showing parts in frame", () => { for (const b of layout.beats ?? []) {
      if (!b.shows || b.s === "congrats") continue;
      const part = layout.parts.find((p) => p.id === b.shows.p); let box = null; try { box = part && focusOf(part, layout.world?.cut); } catch {}
      const act = (b.do ?? []).find((a) => a.p === b.shows.p); if (!box || !act) continue;
      let t; try { t = at({ s: b.s, ...(act.w ? { w: act.w } : {}), ...(act.o ? { o: act.o } : {}) }); } catch { continue; }
      const k = cameraAt(director.end, t + 0.6), r = projectBox(k.pos, k.tgt, box), w = Math.min(1, r.x1) - Math.max(0, r.x0);
      // a flow must be seen arriving: whatever it flows into (a creek, a tank, a grate) is in the frame too
      let target = null;
      if (part.kind === "flow") { const end = part.params?.path?.at(-1); target = end && layout.parts.find((q) => { if (q === part || ["flow", "light", "rain", "sign"].includes(q.kind)) return false; let qb = null; try { qb = focusOf(q, layout.world?.cut); } catch {} return qb && end.every((v, i) => v >= qb.min[i] - 0.5 && v <= qb.max[i] + 0.5); }); }
      // a drain it runs into leads on: a pipe starting under the grate carries it to where that pipe ends (a stream)
      const chain = [];
      if (target?.kind === "grate") {
        const g = target.params?.pos ?? [0, 0, 0], pipe = layout.parts.find((q) => q.kind === "pipeRun" && Array.isArray(q.params?.path) && Math.abs(q.params.path[0][0] - g[0]) < 1 && q.params.path[0][1] < g[1] + 0.2);
        const pend = pipe?.params.path.at(-1), end2 = pend && layout.parts.find((q) => { if (q === pipe || q === target || ["flow", "light", "rain", "sign", "pipeRunFlow"].includes(q.kind)) return false; let qb = null; try { qb = focusOf(q, layout.world?.cut); } catch {} return qb && pend.every((v, i) => v >= qb.min[i] - 0.5 && v <= qb.max[i] + 0.5); });
        if (pipe && end2) { chain.push(pipe.id); target = end2; }
      }
      let tr = null; if (target) { try { tr = projectBox(k.pos, k.tgt, focusOf(target, layout.world?.cut)); } catch {} }
      // at least half of what it flows into is in the frame (an edge just touching the frame is not seeing it arrive)
      const targetOut = tr && (tr.behind || Math.min(1, tr.x1) - Math.max(0, tr.x0) < Math.min(0.15, (tr.x1 - tr.x0) * 0.5));
      // a flow seen arriving: its last stretch, the pipe it runs on in and where it ends (the whole run, arch to stream, put
      // the camera so far back that the stream was a speck)
      const arrival = () => {
        const path = part.params.path, tail = path.slice(Math.floor(path.length * 0.5)), bs = [...chain.map((id) => layout.parts.find((q) => q.id === id)), target].map((q) => { try { return focusOf(q, layout.world?.cut); } catch { return null; } }).filter(Boolean);
        const pad = 0.6, tb = { min: [0, 1, 2].map((i) => Math.min(...tail.map((q) => q[i])) - pad), max: [0, 1, 2].map((i) => Math.max(...tail.map((q) => q[i])) + pad) };
        return union([tb, ...bs]);
      };
      // a flat thing on the ground (a loop glowing in the road, a puddle) is seen from above; a queue of cars along a street
      // is seen end on, so its shot frames the signal it waits at (both went low into the lane, behind a parked car)
      const sigP = part.kind === "traffic" ? layout.parts.find((q) => q.kind === "trafficLight") : null, flat = box.max[1] - box.min[1] < 0.35;
      const qb = sigP && signalQueueBox(sigP, part, layout.world?.cut);
      // (and everything the beat's own shot names with it: a shot of the showing part alone dropped the rest, a meter framed
      // without the fish it measured; the owner's round of 2026-10-28)
      const named = [...new Set([b.shows.p, ...(b.shots ?? []).flatMap((x) => (Array.isArray(x.focus) ? x.focus : [])).filter((id) => id !== "home" && layout.parts.some((q) => q.id === String(id).split(".")[0]))])];
      // (a planned layout shows the part with the main subject, never alone: a grey box filling the screen, review of 2026-10-31)
      const mainP = layout.codeShots ? layout.parts.find((q) => q.main)?.id : null;
      const own = qb ? { box: qb, width: 0.9, zone: "center" } : mainP ? { focus: [...new Set([...named, mainP])], width: 0.94 } : named.length > 1 ? { focus: named, width: 0.8, ...(flat ? { view: "high" } : {}) } : { focus: [b.shows.p], type: w < 0.05 && !flat ? "close" : "mid", ...(flat ? { view: "high" } : {}) };
      if (r.behind || w < (layout.codeShots ? 0.05 : 0.12) || r.x1 < 0.05 || r.x0 > 0.95 || targetOut) extra.push({ ...(target ? { box: arrival(), width: 0.85, zone: "center" } : own), t: Math.max(0, t - 0.1), at: { s: b.s }, auto: true });
    }
    // an auto shot takes the place of a planned shot just before it (closer than a move's gap it would be dropped),
    // starting at that shot's time
    const kept = shots.filter((s) => { const e = extra.find((x) => s.t <= x.t && x.t - s.t < MOVE.minGap); if (e) e.t = Math.min(e.t, s.t); return !e; });
    // an auto shot just before the NEXT sentence's own shot gives way to it (the camera cannot move twice that fast, and
    // the next sentence's planned shot was the one dropped: a storm drain's catch basin was never framed)
    for (let i = extra.length - 1; i >= 0; i--) if (kept.some((s) => s.at?.s !== extra[i].at?.s && s.t > extra[i].t && s.t - extra[i].t < MOVE.minGap)) extra.splice(i, 1);
    if (extra.length) director = directCamera(layout, [...kept, ...extra].sort((a, b) => a.t - b.t), marks);
    }, null);
    camera = { end: director.end, noend: director.noend };
  }
  const audio = layout.audio ?? {};
  const cards = (audio.cards ?? []).map((c) => soft(`card ${c.text}`, () => ({ text: c.text, s: at(c.at), e: at(c.at) + (c.d ?? 1.8) }), null)).filter(Boolean);
  cards.push(...soft("name cards", () => nameCards(sentences, words, cards), []));
  // the red state labels on problem lines, for a planner layout (premade keeps its approved cards)
  if (layout.hold) cards.push(...soft("state cards", () => stateCards(sentences, words, layout.beats ?? [], cards), []));
  // a caption never sits on a counter or gauge (the owner's review of 2026-10-31): a word said while one is up in the
  // caption's band goes to the first free band instead (planned layouts; the approved ones keep theirs)
  const captionY = {};
  if (layout.codeShots && camera?.end?.length) soft("caption bands", () => {
    // (and a prop to read: the caption sat on the newspaper and the book)
    const counters = layout.parts.filter((p) => ["counter", "book", "sheet"].includes(p.kind)).map((p) => ({ box: focusOf(p, layout.world?.cut), show: tracks[`${p.id}.${p.kind === "counter" ? "show" : "up"}`], gone: p.kind === "counter" ? null : tracks[`${p.id}.down`] })).filter((c) => c.box);
    const onAt = (tr, t) => { let v = tr?.base ?? 0; for (const r of tr?.ramps ?? []) if (t >= r.t1) v += r.amp; else if (t > r.t0) v += r.amp * (t - r.t0) / Math.max(0.01, r.t1 - r.t0); return v > 0.5; };
    // (and the part the line is about: the caption sat on the washing machine; step A of the batch-2 look study, 2026-11-05)
    const showsBox = new Map();
    for (const b of layout.beats ?? []) { const p = b.shows && layout.parts.find((q) => q.id === b.shows.p); if (!p) continue; try { showsBox.set(b.s, focusOf(p, layout.world?.cut)); } catch {} }
    words.forEach((w, i) => {
      const k = cameraAt(camera.end, w.s), line = sentences.find((x) => w.s >= x.t0 - 1e-6 && w.s < x.t1 + 1e-6), own = line && showsBox.get(line.role);
      const up = [...counters.filter((c) => onAt(c.show, w.s) && !onAt(c.gone, w.s)).map((c) => c.box), ...(own ? [own] : [])].map((b) => projectBox(k.pos, k.tgt, b)).filter((r) => !r.behind && r.x1 > 0.2 && r.x0 < 0.8);
      const hits = (y) => up.some((r) => r.y0 < y + 0.04 && r.y1 > y - 0.04);
      if (hits(0.52)) { const y = [0.68, 0.76, 0.42, 0.84].find((b) => !hits(b)); if (y) captionY[i] = y; }
    });
  }, null);
  return {
    key: layout.key,
    marks,
    story: story.stats,
    ...(Object.keys(captionY).length ? { captionY } : {}),
    lengthSec: marks.lengthEnd,
    sentences: sentences.map(({ id, role, t0, t1, text }) => ({ id, role, t0, t1, text })),
    tracks,
    camera,
    director: director && { notes: director.notes, frames: director.frames },
    ...(notes.length ? { fixes: notes } : {}),
    audio: {
      sfx: (audio.sfx ?? []).map((s) => soft(`sound ${s.lib}`, () => ({ lib: s.lib, start: +at(s.at).toFixed(3), duration: s.d ?? 1.4 }), null)).filter(Boolean),
      chimes: (audio.chimes ?? []).map((a) => soft("chime", () => +at(a).toFixed(3), null)).filter((x) => x != null),
      cards,
      rain: audio.rain ? soft("rain sound", () => ({ from: at(audio.rain.from), to: at(audio.rain.to), underDb: audio.rain.underDb ?? 24 }), null) : null,
      // the setting's sound bed under the whole video (render-worker/assets/sfx/amb-<setting>.mp3; the creator's
      // traffic light runs a road rumble under the voice), unless the layout turns it off
      ambience: audio.ambience === false ? null : { setting: AMBIENCE_OF[layout.world?.backdrop?.type ?? "yard"] ?? "yard", underDb: audio.ambienceUnderDb ?? 20 },
    },
  };
}

if (/compile\.mjs$/.test(process.argv[1] ?? "")) {
  const [layoutFile, wordsFile, speechEnd, out, rolesFile] = process.argv.slice(2);
  {
    const layout = JSON.parse(fs.readFileSync(layoutFile, "utf8"));
    const words = JSON.parse(fs.readFileSync(wordsFile, "utf8"));
    const roles = rolesFile ? JSON.parse(fs.readFileSync(rolesFile, "utf8")) : [];
    const tl = compile(layout, words, Number(speechEnd), { roles });
    fs.writeFileSync(out, JSON.stringify(tl, null, 1));
    console.log(`${layout.key}: ${Object.keys(tl.tracks).length} channels, ${tl.camera.end.length} camera keys, ${tl.lengthSec} s`);
  }
}
