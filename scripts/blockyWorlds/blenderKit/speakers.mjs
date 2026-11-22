// Blender kit engine: CAPTIONS COLOURED PER SPEAKER (owner 2026-11-14). The narrator is white; each speaking character
// has their own colour, the same all video. THE SCRIPT FORMAT (script.json, what the writer marks):
//   line.speaker = "Ott"            the words INSIDE double quotes in that line are Ott's ("..." or “...”); the rest of the
//                                   line stays the narrator's. A line with a speaker and no quotes is all that speaker's.
//   line.quotes = ["Gran", "Mo"]    optional: the speaker of each quoted part in order (an exchange inside one line)
//   script.speakers = { "Ott": "#7FE3FF" }   optional fixed colours; anyone else gets the next palette colour in order of
//                                   first appearance. "narrator" / "me" / no speaker = white.
// The narrator still reads every word (one voice); only the caption colour changes.
//   captionColors(script, words) -> { colors: [hex | null per word], legend: { name: hex }, speakers: [name | null per word] }
// (round 3, owner 2026-11-22: the speaker's name goes in a small tag above their spoken words, like the replica)
export const NARRATOR = null; // white (the kit's caption colour)
export const PALETTE = Object.freeze(["#FFE14D", "#7FE3FF", "#FF8FD8", "#8CFF7A", "#FFB04D", "#C9A2FF", "#FF6B6B", "#6BFFD9"]);
const OPEN = /^["“]/, CLOSE = /["”][.,!?;:…]*$/;

export function captionColors(script, words) {
  const lines = script?.lines ?? [];
  const counts = lines.map((l) => String(l.text).trim().split(/\s+/).filter(Boolean).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const colors = words.map(() => NARRATOR);
  const speakers = words.map(() => null);
  const legend = {};
  if (total !== words.length) return { colors, legend, speakers, exact: false }; // the words do not match the lines: all white
  const fixed = Object.fromEntries(Object.entries(script.speakers ?? {}).map(([k, v]) => [k.trim().toLowerCase(), String(v)]));
  let next = 0;
  const colorOf = (name) => {
    const k = String(name).trim().toLowerCase();
    if (!k || ["narrator", "me", "i"].includes(k)) return NARRATOR;
    if (!legend[name]) legend[name] = fixed[k] && /^#[0-9a-f]{6}$/i.test(fixed[k]) ? fixed[k].toUpperCase() : PALETTE[next++ % PALETTE.length];
    return legend[name];
  };
  let w = 0;
  lines.forEach((l, li) => {
    const toks = String(l.text).trim().split(/\s+/).filter(Boolean);
    const c = l.speaker ? colorOf(l.speaker) : NARRATOR;
    const nameOf = (n) => (n && !['narrator', 'me', 'i'].includes(String(n).trim().toLowerCase()) ? String(n).trim() : null);
    // line.quotes = ["Grandpa", "Milo", "Grandpa"]: the speaker of each quoted part in order (a dialogue exchange inside
    // one line); a part past the list keeps line.speaker
    const qs = Array.isArray(l.quotes) ? l.quotes : [];
    const quoted = toks.some((t) => OPEN.test(t) || /["“”]/.test(t));
    let inQ = false, q = -1, qc = c;
    toks.forEach((t, k) => {
      let mine;
      if (!quoted) mine = c;
      else {
        const opens = OPEN.test(t) && !inQ, closes = CLOSE.test(t) && (inQ || opens);
        if (opens) { q++; qc = qs[q] ? colorOf(qs[q]) : c; }
        mine = inQ || opens ? qc : NARRATOR;
        speakers[w + k] = inQ || opens ? nameOf(qs[q] ?? l.speaker) : null;
        if (opens) inQ = true;
        if (closes) inQ = false;
      }
      colors[w + k] = mine;
      if (!quoted) speakers[w + k] = nameOf(l.speaker);
    });
    w += counts[li];
  });
  return { colors, legend, speakers, exact: true };
}
