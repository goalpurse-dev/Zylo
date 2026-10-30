// M2: a paid video is never thrown away at the gate (the owner's rule of 2026-10-30: the swimming pool 60 s run was
// refused after $1.40, voice paid, for "hook, flood, stakes, problem3, fix5"). When frames still fail after the repairs:
//   - the hook, the "This is a…" line, the first problem and the first fix are reworded to say what their frames show;
//   - every other failing beat is dropped (stakes, flood, an extra problem with its fixes, an extra fix with its problem,
//     a myth with its fact, a fact with its proof), so the story chain stays whole;
//   - the voice is spliced, not bought again: a dropped sentence is cut out of the paid take (free), a reworded one is
//     voiced alone and put in its place (about $0.06);
// then only the reworded beats are looked at again. The video fails only if the hook or the name still fails.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { sentencesOf } from "./curves.js";

export const ESSENTIAL = ["hook", "name", "congrats"];
const REWORD_ONLY = ["hook", "name", "problem", "fix1", "congrats"];
const num = (r) => Number(/^\D+(\d+)$/.exec(r)?.[1] ?? 1);

/** what to do with the failing beats: { reword: [roles], drop: [roles] } (roles in script order) */
export function salvagePlan(roles, failing) {
  const drop = new Set(), reword = [];
  const nextProblem = (i) => { const j = roles.findIndex((r, k) => k > i && /^problem/.test(r)); return j < 0 ? roles.length : j; };
  const prevProblem = (i) => { for (let k = i - 1; k >= 0; k--) if (/^problem/.test(roles[k])) return k; return -1; };
  for (const r of failing) {
    if (REWORD_ONLY.includes(r)) { reword.push(r); continue; }
    const i = roles.indexOf(r); if (i < 0) continue;
    drop.add(r);
    if (/^problem\d/.test(r)) for (let k = i + 1; k < nextProblem(i); k++) if (/^fix\d/.test(roles[k]) && num(roles[k]) >= 2) drop.add(roles[k]);
    if (/^fix\d/.test(r) && num(r) >= 2) {
      const p = prevProblem(i);
      // the problem it fixed goes too when no other fix of it is left (an extra problem only, never the first)
      if (p >= 0 && roles[p] !== "problem" && !roles.slice(p + 1, nextProblem(p)).some((x) => /^fix/.test(x) && !drop.has(x))) drop.add(roles[p]);
    }
    if (r === "myth") drop.add("mythFact"); if (r === "mythFact") drop.add("myth");
    if (r === "fact") drop.add("factProof");
  }
  // an extra problem left with no fix after it (its fix went with another problem: "So you add chlorine" fixed the green
  // water and the overflow) goes too: a story never ends a problem unsolved
  // (only when a fix was dropped, and up to the next problem still kept: two problems in a row can share the fix after them)
  const nextKept = (i) => { const j = roles.findIndex((r, k) => k > i && /^problem/.test(r) && !drop.has(r)); return j < 0 ? roles.length : j; };
  for (let changed = [...drop].some((r) => /^fix/.test(r)); changed;) {
    changed = false;
    roles.forEach((r, i) => {
      if (!/^problem\d/.test(r) || drop.has(r)) return;
      if (!roles.slice(i + 1, nextKept(i)).some((x) => /^fix/.test(x) && !drop.has(x))) { drop.add(r); changed = true; }
    });
  }
  const keep = roles.filter((r) => !drop.has(r));
  return { reword: roles.filter((r) => reword.includes(r)), drop: roles.filter((r) => drop.has(r)), keep };
}

/**
 * The script and the layout without the dropped beats, and without anything anchored to their sentences (cards, sounds,
 * chimes, a shot of another beat, the rain's start: an anchor left on a dropped sentence stopped the compile)
 */
export function dropFrom(script, layout, drop) {
  const gone = new Set(drop), keepS = (s) => !gone.has(s);
  const sentences = script.sentences.filter((s) => keepS(s.role));
  // an object anchored to a dropped sentence ({ s: role }, or holding one: { at: { s } }, { from: { s }, to }) goes; in
  // an array the item goes, elsewhere the field that holds it
  const anchored = (o) => !!o && typeof o === "object" && !Array.isArray(o) && (gone.has(o.s) && typeof o.s === "string" || Object.values(o).some((v) => v && typeof v === "object" && !Array.isArray(v) && gone.has(v.s)));
  const clean = (o) => {
    if (Array.isArray(o)) return o.filter((x) => !anchored(x)).map(clean);
    if (!o || typeof o !== "object") return o;
    const out = {};
    for (const [k, v] of Object.entries(o)) { if (anchored(v)) continue; out[k] = clean(v); }
    return out;
  };
  const { beats, roles, ...rest } = layout;
  return {
    script: { ...script, sentences, cards: (script.cards ?? []).filter((c) => keepS(script.sentences[c.sentence]?.role)).map((c) => ({ ...c, sentence: sentences.indexOf(script.sentences[c.sentence]) })) },
    layout: { ...clean(rest), beats: clean((beats ?? []).filter((b) => keepS(b.s))), ...(roles ? { roles: roles.filter(keepS) } : {}) },
  };
}

/**
 * The voice spliced by sentence: each kept sentence from the paid take (its words and the pause after it), a reworded
 * one from its own new take. pieces: [{ file, words, role }] per sentence of the new script, in order, where file/words
 * are the take it comes from. Returns { voice, words }.
 */
export function spliceVoice({ ff, pieces, out }) {
  fs.mkdirSync(out, { recursive: true });
  const segs = [], words = [];
  let at = 0;
  for (const p of pieces) {
    const S = sentencesOf(p.words), s = S[p.index];
    if (!s) throw new Error(`splice: the take has no sentence ${p.index}`);
    // from its first word to the next sentence's first word (or 0.45 s after its last word)
    const t0 = Math.max(0, s.t0 - 0.04), t1 = S[p.index + 1] ? Math.max(s.t1 + 0.12, S[p.index + 1].t0 - 0.04) : s.t1 + 0.45;
    segs.push({ file: p.file, t0, t1 });
    for (const w of p.words.slice(s.w0, s.w1 + 1)) words.push({ ...w, s: +(at + w.s - t0).toFixed(3), e: +(at + w.e - t0).toFixed(3) });
    at += t1 - t0;
  }
  const files = [...new Set(segs.map((s) => s.file))];
  const fc = segs.map((g, i) => `[${files.indexOf(g.file)}:a]atrim=start=${g.t0.toFixed(3)}:end=${g.t1.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.004,afade=t=out:st=${Math.max(0, g.t1 - g.t0 - 0.006).toFixed(3)}:d=0.006[a${i}]`).join(";") + `;${segs.map((_, i) => `[a${i}]`).join("")}concat=n=${segs.length}:v=0:a=1[o]`;
  const voice = path.join(out, "voice.mp3");
  execFileSync(ff, ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", fc, "-map", "[o]", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", voice]);
  fs.writeFileSync(path.join(out, "voice.words.json"), JSON.stringify(words));
  return { voice, words };
}
