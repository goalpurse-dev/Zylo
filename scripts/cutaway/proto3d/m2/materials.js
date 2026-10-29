// M2: the named materials parts use (built on first use, then shared). The values are the approved videos' own:
// the landfill (anim_full.js) and the French drain (anim_drain.js). A planner may only name these.
import { wettable } from "../kit/fill.js";

export function materialRegistry(ctx) {
  const { THREE, std, phys, PBR, tex, C, P, grassM, soilM } = ctx;
  const cache = new Map();
  const make = {
    // landfill
    liner: () => phys({ color: C("#272c34"), roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: C("#8a96a8") }),
    linerRim: () => std({ color: C("#9aa3ad"), roughness: 0.4 }),
    bags: () => ["#3b6a3c", "#2c4a2e", "#3d4047", "#344250", "#4a6e40"].map((c) => phys({ color: C(c), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: C("#b8c8bc") })),
    clay: () => std({ map: tex("excavated_soil_wall", "diff", 0.5), color: C("#e9a46c"), roughness: 0.72, normalMap: tex("excavated_soil_wall", "nor", 0.5, false) }),
    soilCover: () => PBR("brown_mud_dry", 1, { color: C("#9a7656") }),
    pipeWhite: () => phys({ color: C("#eef0f2"), roughness: 0.3, clearcoat: 0.5 }),
    tankBlue: () => phys({ color: C("#4a9fb3"), roughness: 0.4, metalness: 0.15, clearcoat: 0.4 }),
    metal: () => std({ color: C("#9aa1aa"), roughness: 0.35, metalness: 0.5 }),
    dirt: () => PBR("brown_mud_dry", 0.6, { color: C("#e0b890") }),
    post: () => std({ color: C("#f4efe4"), roughness: 0.6 }),
    rail: () => std({ color: C("#f4efe4"), roughness: 0.6 }),
    juice: () => std({ color: C("#4a3b18"), roughness: 0.5 }),
    seepDots: () => std({ color: C("#4a3b18"), roughness: 0.6 }),
    gasBubbles: () => phys({ color: C("#d9f0a0"), transparent: true, opacity: 0.55, roughness: 0.1, clearcoat: 1 }),
    machineBody: () => std({ color: C("#cfd4da"), roughness: 0.5, metalness: 0.3 }),
    machineBand: () => std({ color: C("#f08a24"), roughness: 0.5 }),
    // French drain
    concrete: () => PBR("beige_wall_001", 0.5, { color: C("#e4e2dd") }),
    water: () => phys({ color: C("#3a86e0"), transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false }),
    puddle: () => phys({ color: C("#4c8fd8"), transparent: true, opacity: 0.55, roughness: 0.03, clearcoat: 1, depthWrite: false }),
    gravel: () => wet(PBR("gravel", 1, { color: C("#f2eee6") }), "gravel"),
    gravelPit: () => wet(PBR("gravel", 1, { color: C("#f2eee6") }), "well"),
    pebbles: () => wet(std({ color: C("#cbc4b6"), roughness: 0.65 }), "pebble"),
    pebblesPit: () => wet(std({ color: C("#cbc4b6"), roughness: 0.65 }), "wellpeb"),
    stones: () => std({ color: C("#cfc6b4"), roughness: 0.8 }),
    fabric: () => std({ color: C("#fbfbf6"), roughness: 0.85, emissive: C("#3a3a36"), emissiveIntensity: 0.5 }),
    mud: () => std({ color: C("#4f3520"), roughness: 0.85 }),
    // the world's own
    grass: () => grassM,
    soil: () => soilM,
    chassis: () => P.chassis,
    leaf: () => P.leaf,
    leaf2: () => P.leaf2,
  };
  // a material with a water level inside it (kit/fill.js wettable): the level setter is kept with it
  const wetters = new Map();
  function wet(mat, key) { wetters.set(mat, wettable({ THREE }, mat, { key })); return mat; }
  const get = (name) => {
    if (!cache.has(name)) {
      if (!make[name]) throw new Error(`unknown material ${name}`);
      cache.set(name, make[name]());
    }
    return cache.get(name);
  };
  return { get, wetter: (name) => wetters.get(get(name)), names: Object.keys(make) };
}

export const MATERIAL_NAMES = ["liner", "linerRim", "bags", "clay", "soilCover", "pipeWhite", "tankBlue", "metal", "dirt", "post", "rail", "juice", "seepDots", "gasBubbles", "machineBody", "machineBand", "concrete", "water", "puddle", "gravel", "gravelPit", "pebbles", "pebblesPit", "stones", "fabric", "mud", "grass", "soil", "chassis", "leaf", "leaf2"];
