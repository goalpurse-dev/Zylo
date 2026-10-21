// M2: the timeline compiler. A layout (parts, cues, camera, audio) + the voice's real word times -> timeline.json
// with every anchor resolved to seconds. $0, no network.
//   node m2/compile.mjs <layout.json> <words.json> <speechEndSec> <out timeline.json> [roles.json]
import fs from "node:fs";
import { resolveAnchor, sentencesOf } from "./curves.js";
import { validateLayout } from "./format.js";

// The end card rule (owner-approved 2026-10-20): the sign pops 0.4 s after the voice audibly stops (measured from
// the audio, not the aligner), pops over 0.45 s and holds 1.75 s. Without the end card: a 1.5 s calm hold.
export const END = Object.freeze({ gap: 0.4, pop: 0.45, hold: 1.75, noEndHold: 1.5 });

export function marksFor(words, speechEnd) {
  const voiceEnd = words.at(-1).e;
  const signPop = +(speechEnd + END.gap).toFixed(3);
  return { speechEnd, voiceEnd, signPop, lengthEnd: +(signPop + END.pop + END.hold).toFixed(3), lengthNoEnd: +(speechEnd + END.noEndHold).toFixed(3) };
}

export function compile(layout, words, speechEnd, { roles = [] } = {}) {
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
  const audio = layout.audio ?? {};
  const cards = (audio.cards ?? []).map((c) => ({ text: c.text, s: at(c.at), e: at(c.at) + (c.d ?? 1.8) }));
  return {
    key: layout.key,
    marks,
    lengthSec: marks.lengthEnd,
    sentences: sentences.map(({ id, role, t0, t1, text }) => ({ id, role, t0, t1, text })),
    tracks,
    camera: { end: keysFor("end"), noend: keysFor("noend") },
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
