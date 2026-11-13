// STUDIO MODE: the BLOCKING pixel + geometry check of every preview frame (no AI, free). The page measures each tile
// (bundle.mjs renderSheet: 72 x 128 luminance mean / spread / edge density / the biggest 16-level bucket). Safety only
// (owner 2026-11-13): black, a flat wall, one colour, a dark slab; no framing rules.
// Thresholds calibrated on run 1's final frames (2026-11-12): they catch its black frames (#24 m6, #27 m23), blank walls
// (#17 e0.026, #46 e0.026) and dark creature slabs (#43, #49, #53) and pass its normal night and close-up frames.
export const PX = Object.freeze({ blackMean: 28, minEdge: 0.03, maxFlat: 0.72, slab: { mean: 45, flat: 0.4, edge: 0.06 }, slab25: 0.25, near: 0.18, heroVsCreature: 0.35 });

/** a tile's blocking problems: [string] (empty = fine) */
export function tileProblems(tile) {
  const out = [];
  if (!tile) return ["no frame came back"];
  if (tile.mean < PX.blackMean) out.push(`mostly black (luminance ${tile.mean})`);
  else if (tile.edge < PX.minEdge) out.push(`a flat wall / one colour with no detail (edges ${tile.edge})`);
  else if (tile.flat > PX.maxFlat) out.push(`${Math.round(tile.flat * 100)}% of the frame is one colour`);
  else if (tile.mean < PX.slab.mean && tile.flat > PX.slab.flat && tile.edge < PX.slab.edge) out.push(`a dark slab fills the frame (luminance ${tile.mean}, ${Math.round(tile.flat * 100)}% one colour)`);
  // the foreground-slab geometry (preview frames; calibrated on test B 2026-11-13: one roof / wall / built thing seen at a
  // slant over 25% of the frame, or anything within 3 m of the lens over 18%); the fixed checker is told to flag the rest
  if (tile.geo?.slab > PX.slab25) out.push(`a slab (one roof, wall or built thing seen at a slant) fills ${Math.round(tile.geo.slab * 100)}% of the frame: move the camera or the thing`);
  else if (tile.geo?.near > PX.near) out.push(`something right in front of the lens covers ${Math.round(tile.geo.near * 100)}% of the frame: move the camera or the thing`);
  if (tile.geo?.noCamera) out.push("the cut's code set no camera (it threw?)");
  return out;
}

/** the frame checks that need the cut (owner 2026-11-13): an EMPTY frame (no person, creature or built thing in view; a
 *  cut whose staging sets down props / animals is skipped: those live in the set) and the HERO TINY in a climax cut */
export function cutFrameProblems(tile, cut, { climaxFrom = Infinity, hero = "me" } = {}) {
  const out = [], g = tile?.geo;
  if (!g || g.noCamera || !cut) return out;
  const anyone = Object.values(g.people ?? {}).some((v) => v > 0.02) || (g.creature ?? 0) > 0.01 || (g.things ?? 0) > 0.01;
  if (!anyone && !(cut.props ?? []).length && !(cut.animals ?? []).length) out.push("an empty frame: no character and nothing named in view (only walls / roofs / background)");
  const heroIn = (cut.people ?? []).some((p) => p.id === hero) || (cut.codePeople ?? []).includes(hero);
  const min = ["wide", "low"].includes(cut.camType) ? 0.08 : 0.12;
  if (cut.line >= climaxFrom && heroIn && (g.people?.[hero] ?? 0) < min) out.push(`the hero is tiny or out of frame in a climax cut (${Math.round((g.people?.[hero] ?? 0) * 100)}% of the frame height, needs ${Math.round(min * 100)}%)`);
  // NEVER TINY NEXT TO THE CREATURE (owner 2026-11-13, test A2's night): in a climax cut with both on screen, the hero's
  // on-screen height is at least PX.heroVsCreature of the creature's (put the hero nearer the lens: over the shoulder)
  else if (cut.line >= climaxFrom && heroIn && (g.people?.[hero] ?? 0) > 0 && (g.creatureH ?? 0) > 0.05 && g.people[hero] < PX.heroVsCreature * g.creatureH) out.push(`the hero is tiny next to the creature (${Math.round(g.people[hero] * 100)}% of the frame height vs the creature's ${Math.round(g.creatureH * 100)}%; needs at least ${Math.round(PX.heroVsCreature * 100)}% of its size on screen: bring the hero nearer the lens, over the shoulder toward the creature)`);
  return out;
}
