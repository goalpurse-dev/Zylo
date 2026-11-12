// STUDIO MODE: the BLOCKING pixel + geometry check of every preview frame (no AI, free). The page measures each tile
// (bundle.mjs renderSheet: 72 x 128 luminance mean / spread / edge density / the biggest 16-level bucket, and the
// adapter's geometry: each visible person's on-screen height share, the creature's frame share after the cap).
// Thresholds calibrated on run 1's final frames (2026-11-12): they catch its black frames (#24 m6, #27 m23), blank walls
// (#17 e0.026, #46 e0.026) and dark creature slabs (#43, #49, #53) and pass its normal night and close-up frames.
export const PX = Object.freeze({ blackMean: 28, minEdge: 0.03, maxFlat: 0.72, slab: { mean: 45, flat: 0.4, edge: 0.06 } });
export const MIN_PERSON = Object.freeze({ wide: 0.06, low: 0.1, default: 0.14 }); // the declared person's height / frame height

/** a tile's blocking problems: [string] (empty = fine). cut: the studio cut (its declared people), camType */
export function tileProblems(tile, cut = null) {
  const out = [];
  if (!tile) return ["no frame came back"];
  if (tile.mean < PX.blackMean) out.push(`mostly black (luminance ${tile.mean})`);
  else if (tile.edge < PX.minEdge) out.push(`a flat wall / one colour with no detail (edges ${tile.edge})`);
  else if (tile.flat > PX.maxFlat) out.push(`${Math.round(tile.flat * 100)}% of the frame is one colour`);
  else if (tile.mean < PX.slab.mean && tile.flat > PX.slab.flat && tile.edge < PX.slab.edge) out.push(`a dark slab fills the frame (luminance ${tile.mean}, ${Math.round(tile.flat * 100)}% one colour)`);
  const g = tile.geo;
  if (g && g.creature > 0.6 && !/^(closeup|insert)$/.test(g.camera ?? "")) out.push(`the creature fills ${Math.round(g.creature * 100)}% of a ${g.camera} frame (max 60%: show it whole, from further back)`);
  if (g?.noCamera) out.push("the cut's code set no camera (it threw?)");
  if (g && cut) {
    const want = [...new Set([...(cut.people ?? []).map((p) => p.id), ...(cut.codePeople ?? [])])];
    if (want.length) {
      const min = MIN_PERSON[cut.camType] ?? MIN_PERSON.default;
      const best = Math.max(0, ...want.map((id) => g.people?.[id] ?? 0));
      const missing = want.filter((id) => !(g.people?.[id] > 0));
      if (best < min) out.push(`the people are too small or out of frame (largest ${Math.round(best * 100)}% of the frame height, needs ${Math.round(min * 100)}% in a ${cut.camType})`);
      else if (missing.length) out.push(`declared but not in frame: ${missing.join(", ")}`);
    }
  }
  return out;
}
