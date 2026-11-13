// Blender kit engine (phase 1): which frames each shot of a kit video covers, and how to split a video into K
// contiguous chunks of whole shots for K RunPod jobs. Pure: no Blender, no network.
// The kit's shots.py registers shots with @S(id, firstWord, lastWord|None, "desc"); a shot runs from the start of
// script word `firstWord` to the start of `lastWord` (None = the end of the audio + 0.25 s), exactly as the kit's
// rbx/story.py S() + tools/shotkit.py Video do. Frames: F(t) = round(t * 30) + 1 (rbx/core.py), a shot renders
// F(t0) .. F(t1) - 1 (shotkit.Video.build -> setup_render).
//   shotFrames(shotsPySource, words, fps) -> [{ id, f0, f1, n }]
//   splitShots(shots, k)                  -> [{ shots: "3-21", ids: [...], f0, f1, n }]  (contiguous, balanced by frames)

export const FPS = 30;
// Python's round(): half to even (round(154.5) == 154), unlike Math.round
export const pyRound = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };
const frameOf = (t, fps = FPS) => pyRound(t * fps) + 1;

export function shotFrames(src, words, fps = FPS) {
  if (!Array.isArray(words) || !words.length) throw new Error("words.json is empty");
  const end = words[words.length - 1].end + 0.25;
  const w = (i) => (i <= 0 ? 0 : words[i].start);
  const out = [];
  for (const m of src.matchAll(/^@S\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\w+)/gm)) {
    const id = Number(m[1]), a = Number(m[2]);
    if (m[3] !== "None" && !/^\d+$/.test(m[3])) throw new Error(`shot ${id}: last word "${m[3]}" is not a number or None`);
    const t0 = w(a), t1 = m[3] === "None" ? end : w(Number(m[3]));
    const f0 = frameOf(t0, fps), f1 = frameOf(t1, fps) - 1;
    out.push({ id, f0, f1, n: f1 - f0 + 1 });
  }
  if (!out.length) throw new Error("no @S(...) shots found in shots.py");
  out.sort((x, y) => x.id - y.id);
  for (let i = 1; i < out.length; i++) {
    if (out[i].f0 !== out[i - 1].f1 + 1) throw new Error(`shot ${out[i].id} starts at frame ${out[i].f0}, shot ${out[i - 1].id} ended at ${out[i - 1].f1}`);
  }
  if (out[0].f0 !== 1) throw new Error(`the first shot starts at frame ${out[0].f0}, not 1`);
  return out;
}

const idsLabel = (ids) => (ids.length === 1 ? String(ids[0]) : `${ids[0]}-${ids[ids.length - 1]}`);

/** K contiguous groups of whole shots; each cut is placed where the running frame total is closest to i * total / K */
export function splitShots(shots, k) {
  const K = Math.max(1, Math.min(Math.floor(k), shots.length));
  const total = shots.reduce((s, x) => s + x.n, 0);
  const cuts = [];
  let run = 0;
  for (let i = 0; i < shots.length - 1; i++) {
    run += shots[i].n;
    const want = (cuts.length + 1) * total / K;
    if (cuts.length >= K - 1) break;
    // cut after shot i when that is closer to the target than cutting after shot i + 1, and enough shots are left
    const next = run + shots[i + 1].n;
    const shotsLeft = shots.length - (i + 1), groupsLeft = K - cuts.length - 1;
    if (shotsLeft <= groupsLeft || Math.abs(run - want) <= Math.abs(next - want)) cuts.push(i + 1);
  }
  const groups = [];
  let a = 0;
  for (const c of [...cuts, shots.length]) {
    const part = shots.slice(a, c);
    const ids = part.map((s) => s.id);
    groups.push({ shots: idsLabel(ids), ids, f0: part[0].f0, f1: part[part.length - 1].f1, n: part.reduce((s, x) => s + x.n, 0) });
    a = c;
  }
  return groups;
}
