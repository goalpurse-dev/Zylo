// M2: the named materials parts use (built on first use, then shared). The values are the approved videos' own:
// the landfill (anim_full.js) and the French drain (anim_drain.js). A planner may only name these.
import { wettable } from "../kit/fill.js";

export function materialRegistry(ctx) {
  const { THREE, std, phys, PBR, tex, C, P, grassM, soilM } = ctx;
  const cache = new Map();
  // the real look (owner's rules 16 and 18, 2026-11-11: "concrete, brushed metal, white PVC, brick, shingles and asphalt with
  // real texture, not flat plastic colours"): a custom layout's named materials come from the surface library below, at
  // real-world scale. A premade layout (approved: true, ctx.realLook false) keeps every material exactly as approved.
  const real = ctx.realLook === true ? REAL_NAMES : {};
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
      // (a surface that cannot be built falls back to the approved material: a bad texture never stops a video)
      const r = real[name];
      let m = null;
      if (r) { try { m = surfaces(ctx).get(r[0], r[1], r[2]); } catch (e) { console.error(`[cutaway-bug] surface ${name}: ${e?.message ?? e}`); } }
      cache.set(name, m ?? make[name]());
    }
    return cache.get(name);
  };
  return { get, wetter: (name) => wetters.get(get(name)), names: Object.keys(make) };
}

export const MATERIAL_NAMES = ["liner", "linerRim", "bags", "clay", "soilCover", "pipeWhite", "tankBlue", "metal", "dirt", "post", "rail", "juice", "seepDots", "gasBubbles", "machineBody", "machineBand", "concrete", "water", "puddle", "gravel", "gravelPit", "pebbles", "pebblesPit", "stones", "fabric", "mud", "grass", "soil", "chassis", "leaf", "leaf2"];

// ================= the surface library (owner's rules 16 and 18, 2026-11-11) =================
// The competitors' parts read as real things because each is made of something: cast concrete, brushed or galvanised
// metal, white PVC, brick, wood, shingles, asphalt, plaster, tiles. Ours were flat plastic colours. One library, used by
// every custom-layout part kind and rig shape: a surface kind + the planned colour gives a physically based material whose
// texture is laid at its real-world size (metres per tile), whatever the part's geometry or UVs: it is projected from the
// part's own axes (triplanar, scaled by the object's scale, so it sticks to a moving part and a 10 m wall shows ten slabs
// where a 1 m box shows one). Textures are Poly Haven CC0 (fetchAssets.mjs); metals and plastics are drawn in code.
// Water is the WATER helper's; houses, cars, trees and people the MODELS helper's.
//   kind: what the thing is made of;  tex: texture id (or proc: a drawn texture);  size: metres per tile;
//   base: the material's own colour, mix: how much of the planned colour goes into it (0 = its own, 1 = the planned);
//   own: how much of the texture's own colour shows (brick's red and mortar); sat: the most saturation a planned colour
//   keeps (natural colours, not toy ones); rough / metal / coat (clearcoat); nrm: bump strength; wet: how much rain darkens
//   and glosses it (asphalt shines when it rains)
export const SURFACES = {
  concrete: { tex: "concrete_wall_008", size: 2.4, base: "#bdb9b1", mix: 0.3, rough: 0.9, nrm: 0.9, wet: 1, sat: 0.2 },
  stone: { tex: "concrete_wall_008", size: 0.7, base: "#a39c90", mix: 0.45, rough: 0.85, nrm: 1.2, wet: 1, sat: 0.3 },
  brushed: { proc: "brushed", size: 0.7, base: "#bcc1c6", mix: 0.45, rough: 0.38, metal: 0.6, sat: 0.3 },
  galvanised: { proc: "spangle", size: 0.35, base: "#b8bec2", mix: 0.3, rough: 0.5, metal: 0.45, sat: 0.2, wet: 0.5 },
  paint: { proc: "grain", size: 0.5, base: null, mix: 1, rough: 0.42, metal: 0.12, coat: 0.3, sat: 0.85 },
  plastic: { proc: "grain", size: 0.4, base: null, mix: 1, rough: 0.45, coat: 0.15, sat: 0.9 },
  pvc: { proc: "grain", size: 0.4, base: "#eceeea", mix: 0, rough: 0.33, coat: 0.35, sat: 0 },
  rubber: { proc: "grain", size: 0.25, base: null, mix: 1, rough: 0.88, sat: 0.6 },
  brick: { tex: "brick_wall_02", size: 1.4, base: "#9a5a44", mix: 0.25, own: 0.85, rough: 0.88, nrm: 1, wet: 1, sat: 0.6 },
  wood: { tex: "rough_wood", size: 1.2, base: "#9a7650", mix: 0.65, own: 0.25, rough: 0.78, nrm: 0.8, wet: 0.8, sat: 0.55 },
  shingles: { tex: "grey_roof_01", size: 2.6, base: "#5b5d60", mix: 0.4, rough: 0.86, nrm: 1.1, wet: 1, sat: 0.45 },
  asphalt: { tex: "asphalt_02", size: 4, base: "#4f5154", mix: 0.2, rough: 0.92, nrm: 0.8, wet: 1.2, sat: 0.2 },
  plaster: { tex: "white_stucco", size: 2, base: "#e8e2d6", mix: 0.85, rough: 0.92, nrm: 0.6, wet: 0.6, sat: 0.5 },
  tiles: { tex: "interior_tiles", size: 1.6, base: "#e9e3d8", mix: 0.6, own: 0.4, rough: 0.3, nrm: 0.6, sat: 0.5 },
  dirt: { tex: "brown_mud_dry", size: 1.5, base: "#6a4e38", mix: 0, own: 0.5, rough: 0.95, nrm: 1, wet: 1, sat: 0.6 },
};
export const SURFACE_KINDS = Object.keys(SURFACES);
// the textures' own average colour (linear), measured once (scratchpad tools/texsheet.py, 2026-11-11): the texture then only
// adds detail around the planned colour instead of tinting it
const TEX_AVG = {
  concrete_wall_008: [0.271, 0.241, 0.163], brick_wall_02: [0.384, 0.296, 0.198], rough_wood: [0.149, 0.124, 0.096], grey_roof_01: [0.098, 0.095, 0.086],
  asphalt_02: [0.103, 0.101, 0.089], white_stucco: [0.687, 0.659, 0.639], interior_tiles: [0.414, 0.322, 0.239], brown_mud_dry: [0.177, 0.105, 0.045],
};
// the textures a custom layout's surfaces need (fetchAssets.mjs downloads them; a test keeps the two lists in step)
export const SURFACE_TEXTURES = [...new Set(Object.values(SURFACES).map((s) => s.tex).filter(Boolean))];
// the approved names a planner uses, as surfaces in a custom layout ([kind, colour]); names left out keep their approved
// material (water, juice, liners, bags, gravel with its water level, the world's grass and soil)
const REAL_NAMES = {
  concrete: ["concrete", "#c4c0b8"], pipeWhite: ["pvc", "#eceeea"], tankBlue: ["plastic", "#4a8fa6"], metal: ["brushed", "#b8bdc2"],
  machineBody: ["paint", "#c9cdd2"], machineBand: ["paint", "#e0802a"], post: ["wood", "#d8d0c0"], rail: ["wood", "#d8d0c0"],
  stones: ["stone", "#b5ada0"], chassis: ["asphalt", "#3d3f42"], dirt: ["dirt", "#6a4e38"], linerRim: ["galvanised", "#9aa3ad"],
};

/**
 * which surface a thing is made of (pure: the free tests call it), from its words (a rig node or part name, a shape's
 * name), then its look. A material word always wins ("chimney" is brick, a "shingle" row shingles, whatever the look);
 * a thing word only where the look says nothing about the stuff (paint, plastic, none): a "frame" of look wood stays wood.
 */
const MATERIAL_WORDS = [
  [/shingle|roof ?tile|roofing/i, "shingles"], [/brick|chimney/i, "brick"], [/asphalt|road ?surface|tarmac/i, "asphalt"],
  [/\btiles?\b|tiled/i, "tiles"], [/plaster|stucco/i, "plaster"], [/concrete|cement|culvert|manhole|footing|foundation|catch ?basin|kerb|curb/i, "concrete"],
  [/galvani[sz]ed/i, "galvanised"], [/\bpvc\b/i, "pvc"], [/steel|iron|alumin/i, "brushed"], [/timber|wooden|plank/i, "wood"],
];
const THING_WORDS = [
  [/chamber|slab|wall\b/i, "concrete"], [/gutter|downspout|flashing|duct/i, "galvanised"], [/drain ?pipe|sewer ?pipe|waste ?pipe|\bpipe/i, "pvc"],
  [/grate|grill|frame|pump|valve|flap|bracket|bolt|hinge/i, "brushed"], [/beam|rafter|joist|post|deck|truss|stud/i, "wood"],
];
const LOOK_SURFACES = { metal: "brushed", plastic: "plastic", wood: "wood", rubber: "rubber", paint: "paint", concrete: "concrete" };
export function surfaceKind({ look, words = "", surface } = {}) {
  if (SURFACES[surface]) return surface;
  if (look === "glass") return null;
  const w = String(words ?? "");
  for (const [re, k] of MATERIAL_WORDS) if (re.test(w)) return k;
  if (!look || look === "paint" || look === "plastic") for (const [re, k] of THING_WORDS) if (re.test(w)) return k;
  return LOOK_SURFACES[look] ?? null;
}

// the drawn textures (seeded: the same pixels every render): brushed streaks, galvanised spangle, a fine grain
function drawn(kind) {
  if (typeof document === "undefined") return null;
  let seed = { brushed: 7, spangle: 13, grain: 29 }[kind] ?? 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const N = kind === "brushed" ? 512 : 256, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"), img = g.createImageData(N, N), d = img.data;
  const put = (i, v) => { const b = Math.max(0, Math.min(255, v)) | 0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = b; d[i * 4 + 3] = 255; };
  if (kind === "brushed") {
    // long horizontal streaks: each row a slowly varying brightness, plus scattered longer scratches
    const row = Array.from({ length: N }, () => (rnd() - 0.5) * 26);
    for (let y = 0; y < N; y++) { let v = row[y]; for (let x = 0; x < N; x++) { v = v * 0.985 + (rnd() - 0.5) * 3.2; put(y * N + x, 168 + v); } }
  } else if (kind === "spangle") {
    // zinc crystals: flat patches of slightly different brightness (nearest of 70 seeds, wrapped)
    const S = Array.from({ length: 70 }, () => [rnd() * N, rnd() * N, (rnd() - 0.5) * 18]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let best = 1e9, v = 0;
      for (const [sx, sy, sv] of S) { const dx = Math.min(Math.abs(x - sx), N - Math.abs(x - sx)), dy = Math.min(Math.abs(y - sy), N - Math.abs(y - sy)), q = dx * dx + dy * dy; if (q < best) { best = q; v = sv; } }
      put(y * N + x, 170 + v + (rnd() - 0.5) * 8);
    }
  } else {
    for (let i = 0; i < N * N; i++) put(i, 180 + (rnd() - 0.5) * 12);
  }
  g.putImageData(img, 0, 0);
  // its average, linear (the detail is divided by it)
  let s = 0; for (let i = 0; i < N * N; i++) s += Math.pow(d[i * 4] / 255, 2.2);
  return { canvas: c, avg: s / (N * N) };
}

const TRI_VERT_HEAD = "varying vec3 vTriP;\nvarying vec3 vTriN;\nvarying vec3 vTriAx;\nvarying vec3 vTriAy;\nvarying vec3 vTriAz;\n";
const TRI_VERT = `
  vec3 triS = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  mat3 triM = normalMatrix;
  #ifdef USE_INSTANCING
    triS *= vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    triM = normalMatrix * mat3(instanceMatrix);
  #endif
  triS = max(triS, vec3(1e-4));
  vTriP = transformed * triS;
  vTriN = objectNormal / triS;
  vTriAx = triM[0] * triS.x; vTriAy = triM[1] * triS.y; vTriAz = triM[2] * triS.z;`;
const TRI_FRAG_HEAD = TRI_VERT_HEAD + "uniform float uTriS;\nuniform vec3 uTriAvg;\nuniform float uTriOwn;\nuniform float uTriWetK;\nuniform float uTriWet;\n";
const TRI_MAP = `
  vec3 triN = normalize(vTriN);
  vec3 triW = pow(abs(triN), vec3(4.0)); triW /= (triW.x + triW.y + triW.z);
  vec2 triUX = vTriP.zy * uTriS, triUY = vTriP.xz * uTriS, triUZ = vTriP.xy * uTriS;
  vec3 triA = texture2D(map, triUX).rgb * triW.x + texture2D(map, triUY).rgb * triW.y + texture2D(map, triUZ).rgb * triW.z;
  vec3 triDet = clamp(triA / max(uTriAvg, vec3(0.002)), 0.0, 3.0);
  float triL = dot(uTriAvg, vec3(0.2126, 0.7152, 0.0722));
  vec3 triOwnC = triA * (dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / max(triL, 0.002));
  diffuseColor.rgb = mix(diffuseColor.rgb * triDet, triOwnC, uTriOwn);
  float triDL = dot(triDet, vec3(0.2126, 0.7152, 0.0722));
  float triWet = clamp(uTriWet * uTriWetK * (0.45 + 0.55 * smoothstep(0.2, 0.8, triN.y)), 0.0, 1.0);
  diffuseColor.rgb *= 1.0 - 0.38 * triWet;`;
const TRI_ROUGH = `
  float roughnessFactor = roughness * clamp(1.18 - 0.22 * triDL, 0.6, 1.4);
  roughnessFactor = mix(roughnessFactor, 0.1, triWet * 0.85);`;
const TRI_NORMAL = `
  #ifdef USE_NORMALMAP
    vec3 triNf = triN * faceDirection;
    vec3 tnX = texture2D(normalMap, triUX).xyz * 2.0 - 1.0; tnX.xy *= normalScale;
    vec3 tnY = texture2D(normalMap, triUY).xyz * 2.0 - 1.0; tnY.xy *= normalScale;
    vec3 tnZ = texture2D(normalMap, triUZ).xyz * 2.0 - 1.0; tnZ.xy *= normalScale;
    tnX = vec3(tnX.xy + triNf.zy, abs(tnX.z) * triNf.x);
    tnY = vec3(tnY.xy + triNf.xz, abs(tnY.z) * triNf.y);
    tnZ = vec3(tnZ.xy + triNf.xy, abs(tnZ.z) * triNf.z);
    vec3 triNP = normalize(tnX.zyx * triW.x + tnY.xzy * triW.y + tnZ.xyz * triW.z);
    normal = normalize(normalize(vTriAx) * triNP.x + normalize(vTriAy) * triNP.y + normalize(vTriAz) * triNP.z);
  #endif`;

/** lays a material's map (and normal map) on by the part's own axes at `size` metres per tile (see the library above) */
function triplanar(m, { size, avg, own = 0, wetK = 0, wetU }) {
  const u = { uTriS: { value: 1 / size }, uTriAvg: { value: avg }, uTriOwn: { value: own }, uTriWetK: { value: wetK }, uTriWet: wetU };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + TRI_VERT_HEAD).replace("#include <begin_vertex>", "#include <begin_vertex>" + TRI_VERT);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + TRI_FRAG_HEAD)
      .replace("#include <map_fragment>", TRI_MAP).replace("#include <roughnessmap_fragment>", TRI_ROUGH).replace("#include <normal_fragment_maps>", TRI_NORMAL);
  };
  m.customProgramCacheKey = () => "surfTri";
  m.userData.surface = u;
  return m;
}

/**
 * the surface library of a page (one per page, on ctx): get(kind, colour) a shared material, make(kind, colour) a new
 * one (a rig shape that glows or frosts changes its own). An unknown kind or a missing texture falls back to a plain
 * material in the planned colour (crash-proof: a look never stops a video).
 */
export function surfaces(ctx) {
  if (ctx.__surfaces) return ctx.__surfaces;
  const { THREE } = ctx, C = (h) => new THREE.Color(h);
  const wetU = ctx.wetU ?? { value: 0 }, drawnTex = new Map(), cache = new Map();
  const proc = (kind) => {
    if (!drawnTex.has(kind)) {
      const d = drawn(kind);
      if (!d) { drawnTex.set(kind, null); return null; }
      const t = new THREE.CanvasTexture(d.canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      drawnTex.set(kind, { t, avg: [d.avg, d.avg, d.avg] });
    }
    return drawnTex.get(kind);
  };
  const colourOf = (S, colour) => {
    const want = new THREE.Color(); try { want.set(colour ?? S.base ?? "#bbbbbb"); } catch { want.set(S.base ?? "#bbbbbb"); }
    // natural colours: a toy-bright planned colour keeps at most S.sat of its saturation
    const hsl = {}; want.getHSL(hsl); if (hsl.s > S.sat) want.setHSL(hsl.h, S.sat, hsl.l);
    return S.base ? C(S.base).lerp(want, S.mix) : want;
  };
  function make(kind, colour, opts = {}) {
    const S = SURFACES[kind];
    if (!S) return ctx.std({ color: C(colour ?? "#bbbbbb"), roughness: 0.6 });
    let col = colourOf(S, colour);
    // white or grey PVC (not tan): a pipe's planned colour picks one of the two
    // (a strongly coloured pipe, a red gas line, a blue water line, stays its colour as plastic)
    if (kind === "pvc") { const h = {}; C(colour ?? "#eceeea").getHSL(h); if (h.s > 0.35 && h.l > 0.12 && h.l < 0.88) return make("plastic", colour, opts); col = C(h.l < 0.45 ? "#8f9498" : "#eceeea"); }
    const o = { color: col, roughness: S.rough, metalness: S.metal ?? 0, ...opts };
    let map = null, avg = null, normalMap = null;
    if (S.tex) { map = ctx.tex(S.tex, "diff"); normalMap = ctx.tex(S.tex, "nor", 1, false); avg = TEX_AVG[S.tex] ?? [0.25, 0.25, 0.25]; }
    else { const d = proc(S.proc); if (d) { map = d.t; avg = d.avg; } }
    const m = S.coat && ctx.phys ? ctx.phys({ ...o, clearcoat: S.coat, clearcoatRoughness: 0.25 }) : ctx.std(o);
    if (!map) return m;
    m.map = map; if (normalMap) { m.normalMap = normalMap; m.normalScale.set(S.nrm ?? 1, S.nrm ?? 1); }
    return triplanar(m, { size: S.size, avg: new THREE.Vector3(...avg), own: S.own ?? 0, wetK: S.wet ?? 0, wetU });
  }
  const get = (kind, colour, opts = {}) => {
    const k = `${kind}|${colour}|${JSON.stringify(opts)}`;
    if (!cache.has(k)) cache.set(k, make(kind, colour, opts));
    return cache.get(k);
  };
  return (ctx.__surfaces = { get, make, kind: surfaceKind });
}

/**
 * rain soaks the world (owner's rule 18, 2026-11-11: "wet soil near water, a flood, a leak, rain turns darker and shinier
 * over time"; the competitors' asphalt shines in the rain): each rain part registers its on-channel here, and every
 * frame the soak is computed from all of them at that moment (deterministic: never from the last frame). The soak builds
 * over 8 s of rain and dries over 12 s after. It drives the soil face (kit/digCut.js) and every wettable surface.
 * Custom layouts only (ctx.realLook); returns the frame function, or null.
 */
export function rainSoak(ctx, on) {
  if (ctx.realLook !== true || !ctx.wetU) return null;
  const all = (ctx.__rainOn ??= []); all.push(on);
  const one = (f, t) => { let s = 0; for (let k = 0; k < 24; k++) { const v = Number(f(t - k * 0.5)); s += Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; } return Math.min(1, (s * 0.5) / 8); };
  return (t) => { let m = 0; for (const f of all) m = Math.max(m, one(f, t)); ctx.wetU.value = m; };
}

/** a custom layout's surface for a kit part, or the part's approved material in a premade layout (or if it fails);
 * fresh: its own material (the part changes it: a side, an opacity) */
export function realOr(ctx, kind, colour, approved, fresh = false) {
  if (ctx?.realLook !== true) return approved;
  try { return fresh ? surfaces(ctx).make(kind, colour) : surfaces(ctx).get(kind, colour); } catch (e) { console.error(`[cutaway-bug] surface ${kind}: ${e?.message ?? e}`); return approved; }
}

/**
 * the surface of a kit prop drawn from a colour and its finish (pure: the free tests call it): metal by its metalness,
 * rough grey stuff is concrete, rough brown earth is dirt, a warm tan-brown is wood, the rest painted. null: keep the
 * plain material (near-black slots and shadows, glass, lights). For the kit's own little props (benches, planters, poles)
 * that have no material name, only a colour (2026-11-11).
 */
export function guessSurface(colour, { metalness = 0, roughness = 0.6, transparent, emissive, opacity } = {}) {
  if (transparent || emissive || (opacity != null && opacity < 1)) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(colour ?? "")); if (!m) return null;
  const v = parseInt(m[1], 16), r = (v >> 16) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h = 0; if (mx !== mn) h = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; h *= 60;
  if (l < 0.06) return null;
  if (metalness >= 0.5) return roughness <= 0.32 ? "brushed" : "galvanised";
  if (roughness >= 0.85 && s < 0.18) return "concrete";
  if (roughness >= 0.85 && h >= 15 && h <= 45 && l < 0.4) return "dirt";
  if (h >= 18 && h <= 42 && s >= 0.3 && s <= 0.75 && l >= 0.25 && l <= 0.62) return "wood";
  return "paint";
}
