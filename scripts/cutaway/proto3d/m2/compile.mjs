// M2: the timeline compiler. A layout (parts, cues, camera, audio) + the voice's real word times -> timeline.json
// with every anchor resolved to seconds. $0, no network.
//   node m2/compile.mjs <layout.json> <words.json> <speechEndSec> <out timeline.json> [roles.json]
import fs from "node:fs";
import { resolveAnchor, sentencesOf } from "./curves.js";
import { validateLayout } from "./format.js";
import { expandBeats } from "./verbs.js";
import { focusOf } from "./focus.js";
import { directCamera, cameraAt, projectBox, MOVE } from "./director.js";

// The end card rule (owner-approved 2026-10-20): the sign pops 0.4 s after the voice audibly stops (measured from
// the audio, not the aligner), pops over 0.45 s and holds 1.75 s. Without the end card: a 1.5 s calm hold.
export const END = Object.freeze({ gap: 0.4, pop: 0.45, hold: 1.75, noEndHold: 1.5 });

export function marksFor(words, speechEnd) {
  const voiceEnd = words.at(-1).e;
  const signPop = +(speechEnd + END.gap).toFixed(3);
  return { speechEnd, voiceEnd, signPop, lengthEnd: +(signPop + END.pop + END.hold).toFixed(3), lengthNoEnd: +(speechEnd + END.noEndHold).toFixed(3) };
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
    (tracks[key] ??= { base: 0, ramps: [] }).ramps.push({ t0: +t0.toFixed(4), t1: +t1.toFixed(4), amp: c.amp ?? 1, e: c.e ?? (c.b || c.d != null ? "lin" : "step") });
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
      let tr = null; if (target) { try { tr = projectBox(k.pos, k.tgt, focusOf(target, layout.world?.cut)); } catch {} }
      // at least half of what it flows into is in the frame (an edge just touching the frame is not seeing it arrive)
      const targetOut = tr && (tr.behind || Math.min(1, tr.x1) - Math.max(0, tr.x0) < Math.min(0.15, (tr.x1 - tr.x0) * 0.5));
      if (r.behind || w < 0.12 || r.x1 < 0.05 || r.x0 > 0.95 || targetOut) extra.push({ focus: target ? [b.shows.p, target.id] : [b.shows.p], type: w < 0.05 && !target ? "close" : "mid", t: Math.max(0, t - 0.1), auto: true });
    }
    // an auto shot takes the place of a planned shot just before it (closer than a move's gap it would be dropped),
    // starting at that shot's time
    const kept = shots.filter((s) => { const e = extra.find((x) => s.t <= x.t && x.t - s.t < MOVE.minGap); if (e) e.t = Math.min(e.t, s.t); return !e; });
    if (extra.length) director = directCamera(layout, [...kept, ...extra].sort((a, b) => a.t - b.t), marks);
    camera = { end: director.end, noend: director.noend };
  }
  const audio = layout.audio ?? {};
  const cards = (audio.cards ?? []).map((c) => ({ text: c.text, s: at(c.at), e: at(c.at) + (c.d ?? 1.8) }));
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
