// STUDIO MODE: the BLOCKING pixel + geometry check of every preview frame (no AI, free). The page measures each tile
// (bundle.mjs renderSheet: 72 x 128 luminance mean / spread / edge density / the biggest 16-level bucket). Safety only
// (owner 2026-11-13): black, a flat wall, one colour, a dark slab; no framing rules.
// Thresholds calibrated on run 1's final frames (2026-11-12): they catch its black frames (#24 m6, #27 m23), blank walls
// (#17 e0.026, #46 e0.026) and dark creature slabs (#43, #49, #53) and pass its normal night and close-up frames.
export const PX = Object.freeze({ blackMean: 28, minEdge: 0.03, maxFlat: 0.72, slab: { mean: 45, flat: 0.4, edge: 0.06 } });

/** a tile's blocking problems: [string] (empty = fine) */
export function tileProblems(tile) {
  const out = [];
  if (!tile) return ["no frame came back"];
  if (tile.mean < PX.blackMean) out.push(`mostly black (luminance ${tile.mean})`);
  else if (tile.edge < PX.minEdge) out.push(`a flat wall / one colour with no detail (edges ${tile.edge})`);
  else if (tile.flat > PX.maxFlat) out.push(`${Math.round(tile.flat * 100)}% of the frame is one colour`);
  else if (tile.mean < PX.slab.mean && tile.flat > PX.slab.flat && tile.edge < PX.slab.edge) out.push(`a dark slab fills the frame (luminance ${tile.mean}, ${Math.round(tile.flat * 100)}% one colour)`);
  if (tile.geo?.noCamera) out.push("the cut's code set no camera (it threw?)");
  return out;
}
