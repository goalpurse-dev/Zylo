// stickman/renderChunks.ts — Phase 6f parallel render: split the timeline's
// pieces into contiguous ranges with about the same number of frames each
// (one chunk job + one machine per range). Pure; used by long-form-render.
export function chunkPieces(pieces: { frames: number }[], n: number): [number, number][] {
  const total = pieces.reduce((a, p) => a + p.frames, 0);
  const out: [number, number][] = [];
  let from = 0, acc = 0;
  pieces.forEach((p, i) => {
    acc += p.frames;
    if (out.length < n - 1 && acc >= (total * (out.length + 1)) / n && i + 1 < pieces.length) { out.push([from, i + 1]); from = i + 1; }
  });
  out.push([from, pieces.length]);
  return out.filter(([a, b]) => b > a);
}
