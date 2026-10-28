// M2: the timeline compiler. A layout (parts, cues, camera, audio) + the voice's real word times -> timeline.json
// with every anchor resolved to seconds. $0, no network.
//   node m2/compile.mjs <layout.json> <words.json> <speechEndSec> <out timeline.json> [roles.json]
import fs from "node:fs";
import { resolveAnchor, sentencesOf } from "./curves.js";
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
export const AMBIENCE_OF = Object.freeze({ yard: "yard", street: "street", park: "park", garage: "garage", room: "room", carwash: "carwash" });

/**
 * The name label (the creator's newer videos, 2026-10-25: "INDUCTIVE LOOP" in caps on screen as the line names it): the
 * naming line ("This is a signal controller.") gets a short card with the name, from its first word, for 1.6 s. Not
 * when a number card is up then, and not for a name too long to read at a glance (over 22 letters).
 */
export function nameCards(sentences, words, cards = []) {
  const out = [];
  for (const s of sentences) {
    const m = /\bthis is (?:an? |the |your )?([a-z][a-z' -]*?)(?=[,.!?;]|$| that | which | and | but )/i.exec(s.text ?? "");
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
  [/\bcracks?\b/i, "CRACKED"], [/\bdies?\b|\bdying\b/i, "DYING"], [/\bstinks?\b|\bsmells?\b/i, "STINKS"], [/\bheavy\b|\bweighs\b/i, "TOO HEAVY"],
  [/\bhot\b|\boverheat/i, "TOO HOT"], [/\bdirty\b|\bmurky\b|\bgreen water\b/i, "DIRTY"], [/\bdrowns?\b|\bsoggy\b|\bwaterlogged\b/i, "SOAKED"],
];
export function stateCards(sentences, words, beats = [], cards = []) {
  const out = [];
  for (const s of sentences) {
    if (!/^problem/.test(s.role ?? "")) continue;
    const own = beats.find((b) => b.s === s.role)?.state;
    let text = own?.text ?? (typeof own === "string" ? own : null), word = own?.w ?? null;
    if (!text) for (const [re, label] of STATE_WORDS) { const m = re.exec(s.text ?? ""); if (m) { text = label; word = m[0].split(/\s+/)[0]; break; } }
    if (!text || text.length > 14) continue;
    const key = String(word ?? "").toLowerCase().replace(/[^a-z']/g, "");
    const w = key && words.find((x) => x.s >= s.t0 - 0.01 && x.s <= s.t1 + 0.01 && x.w.toLowerCase().replace(/[^a-z']/g, "").startsWith(key));
    const t = w ? w.s : s.t0 + 0.4, e = Math.max(t + 1.2, s.t1);
    // (it sits higher than the number cards, so both can be up: "80 LB" and "TOO HEAVY")
    if (cards.some((c) => c.kind === "state" && c.s < e && c.e > t)) continue;
    out.push({ text: text.toUpperCase(), s: +t.toFixed(3), e: +e.toFixed(3), kind: "state" });
  }
  return out;
}

// The hold (the owner's rule of 2026-10-28, from the examples: the crane mast stays tilted, the elevator hangs mid-fall):
// in a layout with hold: true, a beat's motion runs to 70% of its travel by 75% of its line and holds there, the rest
// after the line ends; the check frames are taken during the hold (the tail ramp is marked so previewTimes skips it).
// Only motions: a part's visibility and switches keep their timing.
const HOLD_CH = { car: ["drive", "leave"], traffic: ["pile", "go"], dumpTruck: ["tip"], cabinet: ["open"], counter: ["count"] };
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

export function compile(layout0, words, speechEnd, { roles = [] } = {}) {
  // a planner layout says what happens as beats (kit verbs on words) and shots; they become cues here
  const beats = expandBeats(layout0);
  const layout = { ...layout0, cues: [...(layout0.cues ?? []), ...beats.cues], shots: [...(layout0.shots ?? []), ...beats.shots] };
  const sign = layout.parts.find((p) => p.kind === "sign");
  if (sign && !layout.cues.some((c) => c.p === sign.id && c.c === "pop")) layout.cues.push({ p: sign.id, c: "pop", a: { mark: "signPop" }, e: "step" });
  const problems = validateLayout(layout);
  if (problems.length) throw new Error(`layout ${layout.key}: ${problems.join("; ")}`);
  const sentences = sentencesOf(words, roles);
  const marks = marksFor(words, speechEnd);
  const exact = layout.anchorMatch === "exact";
  const ctx = { words, sentences, marks };
  const at = (a) => resolveAnchor(exact && a.w != null && a.exact == null ? { ...a, exact: true } : a, ctx);

  const tracks = {};
  for (const p of layout.parts) for (const [ch, base] of Object.entries(p.base ?? {})) tracks[`${p.id}.${ch}`] = { base, ramps: [] };
  for (const c of layout.cues) {
    const key = `${c.p}.${c.c}`;
    const t0 = at(c.a);
    const t1 = c.b ? at(c.b) : c.d != null ? t0 + Number(c.d) : t0;
    // (s: the sentence whose words it is anchored to, so the preview moment knows this beat's motions from the next one's)
    const r = { t0: +t0.toFixed(4), t1: +t1.toFixed(4), amp: c.amp ?? 1, e: c.e ?? (c.b || c.d != null ? "lin" : "step"), ...(c.a?.s ? { s: c.a.s } : {}) };
    const sen = layout.hold && c.a?.s && holdable(layout.parts.find((p) => p.id === c.p), c.c) ? sentences.find((x) => x.role === c.a.s) : null;
    (tracks[key] ??= { base: 0, ramps: [] }).ramps.push(...(sen ? holdRamps(r, sen) : [r]));
  }
  // a switch is on or off (a lamp, a signal's cycle): in time order, an "on" while on or an "off" while off does nothing
  // (the steps add up: two "red"s made red 2, and the next "green" left it lit)
  for (const p of layout.parts) for (const ch of SWITCHES[p.kind] ?? []) {
    const tr = tracks[`${p.id}.${ch}`]; if (!tr) continue;
    let s = Math.min(1, Math.max(0, tr.base ?? 0));
    for (const r of [...tr.ramps].sort((a, b) => a.t0 - b.t0)) { const next = Math.min(1, Math.max(0, s + r.amp)); r.amp = +(next - s).toFixed(4); s = next; }
  }

  const keysFor = (which) => (layout.camera?.keys ?? []).filter((k) => !k.only || k.only === which).map((k) => [+at(k.at).toFixed(4), k.pos, k.tgt]);
  let camera, director = null;
  if (layout.camera?.keys?.length) camera = { end: keysFor("end"), noend: keysFor("noend") };
  else {
    const shots = layout.shots.map((s) => ({ ...s, t: at(s.at) })).sort((a, b) => a.t - b.t);
    director = directCamera(layout, shots, marks);
    // every sentence's showing part at least 12% wide and in the frame while it acts: a shot on it where the camera
    // would miss it (then the camera is directed once more)
    const extra = [];
    for (const b of layout.beats ?? []) {
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
      const own = qb ? { box: qb, width: 0.9, zone: "center" } : { focus: [b.shows.p], type: w < 0.05 && !flat ? "close" : "mid", ...(flat ? { view: "high" } : {}) };
      if (r.behind || w < 0.12 || r.x1 < 0.05 || r.x0 > 0.95 || targetOut) extra.push({ ...(target ? { box: arrival(), width: 0.85, zone: "center" } : own), t: Math.max(0, t - 0.1), at: { s: b.s }, auto: true });
    }
    // an auto shot takes the place of a planned shot just before it (closer than a move's gap it would be dropped),
    // starting at that shot's time
    const kept = shots.filter((s) => { const e = extra.find((x) => s.t <= x.t && x.t - s.t < MOVE.minGap); if (e) e.t = Math.min(e.t, s.t); return !e; });
    // an auto shot just before the NEXT sentence's own shot gives way to it (the camera cannot move twice that fast, and
    // the next sentence's planned shot was the one dropped: a storm drain's catch basin was never framed)
    for (let i = extra.length - 1; i >= 0; i--) if (kept.some((s) => s.at?.s !== extra[i].at?.s && s.t > extra[i].t && s.t - extra[i].t < MOVE.minGap)) extra.splice(i, 1);
    if (extra.length) director = directCamera(layout, [...kept, ...extra].sort((a, b) => a.t - b.t), marks);
    camera = { end: director.end, noend: director.noend };
  }
  const audio = layout.audio ?? {};
  const cards = (audio.cards ?? []).map((c) => ({ text: c.text, s: at(c.at), e: at(c.at) + (c.d ?? 1.8) }));
  cards.push(...nameCards(sentences, words, cards));
  // the red state labels on problem lines, for a planner layout (premade keeps its approved cards)
  if (layout.hold) cards.push(...stateCards(sentences, words, layout.beats ?? [], cards));
  return {
    key: layout.key,
    marks,
    lengthSec: marks.lengthEnd,
    sentences: sentences.map(({ id, role, t0, t1, text }) => ({ id, role, t0, t1, text })),
    tracks,
    camera,
    director: director && { notes: director.notes, frames: director.frames },
    audio: {
      sfx: (audio.sfx ?? []).map((s) => ({ lib: s.lib, start: +at(s.at).toFixed(3), duration: s.d ?? 1.4 })),
      chimes: (audio.chimes ?? []).map((a) => +at(a).toFixed(3)),
      cards,
      rain: audio.rain ? { from: at(audio.rain.from), to: at(audio.rain.to), underDb: audio.rain.underDb ?? 24 } : null,
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
