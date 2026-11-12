// Blocky Worlds SETS-V2 (2026-11-09, owner D + F): SET PALETTES and LIGHTING RIGS. Pure data + pure functions, used by
// the world bible (lib/worldBible.js: each place gets a theme preset, each shot a rig), the page (page/sets/themes.js
// dresses a place with the theme's signature props; page/lighting.js layers the rig; page/post.js grades every shot
// toward the rig's exposure / saturation target) and the free look measure (dev/setsV2Measure.mjs).
// Owner: "each world-bible place gets a theme preset (palette, signature props, lighting rig, density). A story moves
// through 3-6 different places, so no single room dominates. Saturation/brightness target from the reference (median
// saturation ~0.38, brightness ~0.74)." / "LIGHTING RIGS per mood: day, sunset, night-with-practicals, neon/emissive +
// bloom, interior warm, alarm red. Never flat beige, never unreadably dark."
//
//   THEMES[id]            { label, kinds[], indoor, palette: { walls[], accents[], ground, trim }, props[], density,
//                           rigs: { day, warm, dusk, dawn, night } (rig per base light), neon? }
//   RIGS[id]              { label, target: { bright, sat }, fill: [colour, k], hemi: [sky, ground, k] | null,
//                           points: [{ colour, k, at }], post: { satK, conK, warmAdd, bloomK, bloomTh }, fogTint, expoK }
//   storyStyle(text)      -> null | "castle" | "cave" | "desert" | "neon" | "harbour" | "winter"   (the story's era / style)
//   themeFor(kind, { style, text, weather }) -> theme id
//   rigFor({ theme, light, text }) -> rig id
//   frameStats(rgba)      -> { bright, sat, warm, clip, dark }   median HSV V / S of a frame (the reference's measure)
//   gradeFor(stats, rig)  -> { expo, sat, warm }   the per-shot auto grade (multipliers toward the rig's target)
//   DENSITY               props per place by density
//   MAX_PLACE_SHARE       0.4: no place holds more than ~40% of a story's time when the lines allow it

export const MAX_PLACE_SHARE = 0.34; // LOOK-TARGET (coordinator 2026-11-09): 4-8 places per story, >= 3 per minute
export const DENSITY = Object.freeze({ sparse: { outdoor: 7, indoor: 4 }, normal: { outdoor: 12, indoor: 6 }, dense: { outdoor: 18, indoor: 9 } });

// the reference's look (owner: 19 TikTok refs measured, median saturation ~0.38, median brightness ~0.74); per rig a
// mood-right target around it: night / neon / alarm stay dark-ish but readable, never under ~0.4
export const REF_LOOK = Object.freeze({ bright: 0.70, sat: 0.38, contrast: 0.525, beigeHeavyPct: 4, hueEntropy: 1.83 }); // LOOK-TARGET (coordinator, 2026-11-09, lookgate/measure.mjs on ref 7706161704)

// ------------------------------------------------------------------------------------------------ the rigs
// PLASTIC-WORLD 2026-11-10 (owner: "bright sun key light + sky fill + rim light ... bloom only on emissives ... night =
// deep blue with strong coloured practical lights, never muddy"): every rig has a RIM ([colour, k], page/lighting.js
// makeRigLayer), a stronger camera-side fill, cool / coloured bounce instead of beige-brown, the night practicals in
// clear colours (warm orange key, blue rim, pink back); neon blooms only its emissives (threshold 0.85, was 0.55)
export const RIGS = Object.freeze({
  day: { label: "day", target: { bright: 0.68, sat: 0.38, contrast: 0.52 }, fill: ["#ffffff", 0.3], hemi: null, rim: ["#eaf4ff", 1.5], points: [], post: {}, fogTint: null, expoK: 1 },
  golden: { label: "golden / sunset", target: { bright: 0.62, sat: 0.42, contrast: 0.52 }, fill: ["#ffe0c0", 0.4], hemi: ["#ffc8a0", "#5a5a8a", 0.25], rim: ["#ffd8a8", 1.6], points: [{ colour: "#ffb35c", k: 10, at: "side" }], post: { satK: 1.04, warmAdd: -0.01 }, fogTint: null, expoK: 1 },
  night_practicals: { label: "night with practicals", target: { bright: 0.5, sat: 0.38, contrast: 0.55 }, fill: ["#a8c0ff", 0.5], hemi: ["#3a5ae0", "#141c50", 0.45], rim: ["#7aa8ff", 1.4], points: [{ colour: "#ffa040", k: 22, at: "side" }, { colour: "#4a9aff", k: 18, at: "rim" }, { colour: "#ff6ab8", k: 10, at: "back" }] /* GATE 2026-11-09: was 34 / 26 / 18 (hot spots, blown faces at night) */, post: { satK: 1.18, bloomK: 1.15 }, fogTint: null, expoK: 1.05 },
  neon: { label: "neon / emissive + bloom", target: { bright: 0.46, sat: 0.48, contrast: 0.58 }, fill: ["#c8a8ff", 0.35], hemi: ["#5a2a9a", "#0a1830", 0.4], rim: ["#28e0ff", 1.6], points: [{ colour: "#ff3cc8", k: 40, at: "side" }, { colour: "#28e0ff", k: 40, at: "otherSide" }, { colour: "#8a5cff", k: 22, at: "rim" }], post: { satK: 1.28, warmAdd: -0.03, bloomK: 2.2, bloomTh: 0.85 }, fogTint: "#2a1446", expoK: 1 },
  interior_warm: { label: "interior warm", target: { bright: 0.64, sat: 0.38, contrast: 0.5 }, fill: ["#e0ecff", 0.4], hemi: ["#d8e8ff", "#c87a4a", 0.3], rim: ["#d8e8ff", 1.0], points: [{ colour: "#ffcf8a", k: 16, at: "side" }, { colour: "#bcd4ff", k: 10, at: "rim" }], post: { satK: 1.1, warmAdd: -0.035 }, fogTint: null, expoK: 0.96 },
  alarm_red: { label: "alarm red", target: { bright: 0.44, sat: 0.46, contrast: 0.58 }, fill: ["#ffb0a8", 0.3], hemi: ["#ff3a2a", "#200808", 0.45], rim: ["#ff4a3a", 1.2], points: [{ colour: "#ff2a1a", k: 50, at: "side", pulse: 1.6 }, { colour: "#ff4a2a", k: 30, at: "rim", pulse: 1.6 }], post: { satK: 1.2, warmAdd: 0.01, bloomK: 1.5 }, fogTint: "#3a0a0c", expoK: 1 },
});
export const RIG_IDS = Object.freeze(Object.keys(RIGS));
const OUT_RIGS = { day: "day", warm: "golden", dusk: "golden", dawn: "golden", night: "night_practicals" };
const IN_RIGS = { day: "interior_warm", warm: "interior_warm", dusk: "interior_warm", dawn: "interior_warm", night: "interior_warm" };
const NEON_RIGS = { day: "day", warm: "golden", dusk: "neon", dawn: "golden", night: "neon" };

// ------------------------------------------------------------------------------------------------ the themes
// props: page/sets/themes.js PROP_MAKERS ids. palette walls / accents: saturated storybook colours, never all beige.
const T = (o) => Object.freeze({ density: "normal", indoor: false, rigs: OUT_RIGS, ...o });
// PLASTIC-WORLD 2026-11-10 (owner: "Big clean colour areas: primary red/blue/yellow, bright green grass, clear sky blue,
// cyan/magenta neon ... Kill beige: no beige floors/walls/ground as defaults; warm colours used as accents"): every
// palette is a bright saturated toy palette (walls: saturation >= 0.35, or a clean light white / grey plastic); grounds
// are bright grass, clean light stone, toy wood, or a deep night blue; never beige / brown. dev/plastic.test.mjs checks it.
export const THEMES = Object.freeze({
  suburb: T({ label: "suburb street", kinds: ["street"], palette: { walls: ["#ffd54a", "#5ab0f0", "#ff7a6a", "#6cd46a"], accents: ["#e8323c", "#2a6ae0", "#ffc21a"], ground: "#56c63e", trim: "#ffffff" }, props: ["mailbox", "flowerpot", "bench", "lamppost", "bush", "bin"], density: "normal" }),
  village_street: T({ label: "village street", kinds: ["street"], palette: { walls: ["#ffb02a", "#4a90e8", "#5ccc5a", "#ff6a4a"], accents: ["#e8323c", "#2a6ae0", "#ffd21a"], ground: "#c8d0dc", trim: "#ffffff" }, props: ["flowerpot", "barrel", "crate", "lamppost", "bunting", "cart", "bench"], density: "normal" }),
  market_square: T({ label: "market square", kinds: ["square", "market"], palette: { walls: ["#ffb02a", "#4a90e8", "#e8504a", "#5ccc5a"], accents: ["#e8323c", "#2a6ae0", "#22c46a", "#ffc21a"], ground: "#d0d8e4", trim: "#ffffff" }, props: ["stall", "crate", "barrel", "bunting", "lanternString", "flowerpot", "cart", "banner"], density: "dense" }),
  belfry: T({ label: "belfry / tower top", kinds: ["tower"], palette: { walls: ["#d8604a", "#6a84c8"], accents: ["#e8323c", "#ffd21a", "#2a6ae0"], ground: "#b8c2d2", trim: "#ffffff" }, props: ["banner", "lantern", "ropeCoil", "crate"], density: "sparse" }),
  home_interior: T({ label: "home interior", kinds: ["home"], indoor: true, rigs: IN_RIGS, palette: { walls: ["#7ac4f0", "#8ae0a0", "#ffa08a", "#b88af0"], accents: ["#e8323c", "#2a6ae0", "#ffc21a", "#22c46a"], ground: "#e3852f", trim: "#ffffff" }, props: ["rug", "plant", "floorLamp", "shelf", "picture", "stringLights"], density: "normal" }),
  bedroom: T({ label: "kid's bedroom", kinds: ["home"], indoor: true, rigs: IN_RIGS, palette: { walls: ["#5a9af0", "#9a7af0", "#4ac4b8"], accents: ["#ffd21a", "#ff4a6a", "#22c46a"], ground: "#e3852f", trim: "#ffffff" }, props: ["poster", "stringLights", "toyBox", "plant", "rug", "floorLamp"], density: "normal" }),
  school: T({ label: "school", kinds: ["school", "classroom"], indoor: true, rigs: IN_RIGS, palette: { walls: ["#7ac0f8", "#ffd23a", "#8ae0a0"], accents: ["#e8323c", "#2a6ae0", "#ffc21a", "#22c46a"], ground: "#e9eef6", trim: "#ffffff" }, props: ["poster", "banner", "plant", "shelf", "picture"], density: "normal" }),
  workshop: T({ label: "workshop", kinds: ["workshop"], indoor: true, rigs: IN_RIGS, palette: { walls: ["#5a8ad0", "#e8703a", "#4ab08a"], accents: ["#ffc21a", "#e8323c", "#2a6ae0"], ground: "#7a8aa8", trim: "#2a3a5a" }, props: ["workbench", "toolWall", "crate", "barrel", "gear", "floorLamp"], density: "dense" }),
  bakery: T({ label: "bakery", kinds: ["bakery"], indoor: true, rigs: IN_RIGS, palette: { walls: ["#ff9ab0", "#ffd23a", "#8ae0a0"], accents: ["#e8323c", "#ffb02a", "#ffffff"], ground: "#e9eef6", trim: "#ffffff" }, props: ["breadShelf", "oven", "crate", "plant", "picture"], density: "dense" }),
  street_night: T({ label: "street at night", kinds: ["street"], palette: { walls: ["#4a6ae0", "#8a4ae0", "#2ab0b0"], accents: ["#ffa020", "#ff4a9a", "#40d0ff"], ground: "#2a3466", trim: "#1a2050" }, props: ["lamppost", "lantern", "bin", "bench", "bush"], density: "normal" }),
  forest_edge: T({ label: "forest edge", kinds: ["woods"], palette: { walls: ["#2fb24c", "#58d03e"], accents: ["#ffd21a", "#ff4a5a", "#ffffff"], ground: "#56c63e", trim: "#9a5a2c" }, props: ["mushroom", "log", "rock", "bush", "flowers", "lantern"], density: "normal" }),
  park: T({ label: "town park", kinds: ["park"], palette: { walls: ["#4cc43c", "#8ad83a"], accents: ["#ff4a5a", "#ffd21a", "#2a6ae0"], ground: "#56c63e", trim: "#ffffff" }, props: ["bench", "flowers", "lamppost", "bush", "fountain", "flowerpot"], density: "normal" }),
  creature_back_street: T({ label: "street on the creature", kinds: ["street", "stairs", "rooftop", "deck"], palette: { walls: ["#ffb02a", "#4a90e8", "#5ccc5a", "#ff7a6a"], accents: ["#e8323c", "#ffd21a", "#2a6ae0"], ground: "#c8d0dc", trim: "#ffffff" }, props: ["bunting", "lanternString", "banner", "flowerpot", "crate"], density: "sparse" }),
  creature_outside: T({ label: "the land around the creature", kinds: ["outside"], palette: { walls: ["#4cc43c"], accents: ["#ffd21a"], ground: "#56c63e", trim: "#9a5a2c" }, props: [], density: "sparse" }),
  castle: T({ label: "castle", kinds: ["street", "square", "tower"], palette: { walls: ["#d8e0ec", "#c4cede"], accents: ["#e8323c", "#2a6ae0", "#ffd21a", "#8a3ad0"], ground: "#c8d0dc", trim: "#3a64c0" }, props: ["banner", "torch", "stall", "barrel", "crate", "shield", "bunting"], density: "dense" }),
  cave_camp: T({ label: "cave camp", kinds: ["cave"], palette: { walls: ["#5a6ab0", "#7a5ab0"], accents: ["#ff8a2a", "#ffd21a", "#e8323c"], ground: "#4a5478", trim: "#2a3060" }, props: ["campfire", "tent", "rock", "crate", "torch", "log"], density: "dense", rigs: { day: "night_practicals", warm: "night_practicals", dusk: "night_practicals", dawn: "night_practicals", night: "night_practicals" } }),
  desert_ruins: T({ label: "desert / ruins", kinds: ["desert"], palette: { walls: ["#ffc23a", "#f0a030"], accents: ["#2a6ae0", "#e8323c", "#22c46a", "#40d0ff"], ground: "#ffd64f", trim: "#c86a20" }, props: ["hieroglyphWall", "obelisk", "palm", "pot", "pyramid", "rock"], density: "normal" }),
  neon_city: T({ label: "neon city", kinds: ["city"], neon: true, rigs: NEON_RIGS, palette: { walls: ["#2a3aa0", "#5a2ab0", "#1a6a9a"], accents: ["#ff3cc8", "#28e0ff", "#a0ff3c", "#ffe03c"], ground: "#22285a", trim: "#101840" }, props: ["neonSign", "neonStrip", "holoPillar", "bin", "lamppost"], density: "dense" }),
  harbour: T({ label: "harbour", kinds: ["harbour", "deck"], palette: { walls: ["#4a90e8", "#ff7a6a", "#ffd23a", "#5ad0d0"], accents: ["#e8323c", "#ffffff", "#2a6ae0"], ground: "#c8d0dc", trim: "#ffffff" }, props: ["bollard", "ropeCoil", "nets", "crate", "barrel", "anchor", "lantern"], density: "normal" }),
  back_lane: T({ label: "back lane", kinds: ["lane"], palette: { walls: ["#3a7ae0", "#22b0a0", "#8a5ae0", "#ff6a4a"], accents: ["#ffd21a", "#ff7ab0", "#ffffff"], ground: "#9aa6c0", trim: "#2a3466" }, props: ["washingLine", "bin", "crate", "flowerpot", "lantern", "bush"], density: "normal" }),
  snowy_street: T({ label: "snowy street", kinds: ["street", "square"], palette: { walls: ["#e8403a", "#2a6ae0", "#22a65a", "#ffa82a"], accents: ["#e8323c", "#22c46a", "#ffd21a"], ground: "#f4f8ff", trim: "#ffffff" }, props: ["lamppost", "lanternString", "snowman", "crate", "bench", "bush"], density: "normal" }),
});
export const THEME_IDS = Object.freeze(Object.keys(THEMES));

// ------------------------------------------------------------------------------------------------ choosing
const STYLE_WORDS = [
  ["neon", /\b(neon|robots?|cyber\w*|futur\w*|hover\w*|holo\w*|skyscrapers?|android|spaceport|year 3\d{3}|city lights)\b/],
  ["castle", /\b(castle|kingdom|king|queen|knights?|princess|prince|throne|dragon|moat|drawbridge|royal)\b/],
  ["desert", /\b(desert|pyramids?|egypt\w*|pharaoh|mumm(y|ies)|sand dunes?|dunes?|oasis|sphinx|hieroglyph\w*|tomb)\b/],
  ["cave", /\b(caves?|cavern|underground|mines?|miners?|tunnels?)\b/],
  ["harbour", /\b(harbou?r|port|docks?|pier|fisherm[ae]n|boats?|ships?|lighthouse|wharf)\b/],
];
const lowTxt = (s) => ` ${String(s ?? "").toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ")} `;
/** the story's era / style from its words (two hits, or one in the director's world text) -> a style id | null */
export function storyStyle(text, strongText = "") {
  const t = lowTxt(text), st = lowTxt(strongText);
  let best = null, bestN = 0;
  for (const [id, re] of STYLE_WORDS) {
    const g = new RegExp(re.source, "g");
    const n = (t.match(g) ?? []).length + 2 * (st.match(g) ?? []).length;
    if (n >= 2 && n > bestN) { best = id; bestN = n; }
  }
  return best;
}

/**
 * A place kind (a bible spot kind: street, square, market, tower, home, school, classroom, woods, park, deck, stairs,
 * rooftop, outside, + cave, desert, city, harbour, bakery, workshop) + the story's style -> a theme id.
 * opts: { style, text (the place's own words / name), weather ("snow"), onCreature (a street on a giant creature) }
 */
export function themeFor(kind, { style = null, text = "", weather = null, onCreature = false } = {}) {
  const t = lowTxt(text);
  if (kind === "outside") return "creature_outside";
  if (/\b(bakery|baker|bread)\b/.test(t) && (kind === "home" || kind === "market" || kind === "bakery")) return "bakery";
  if (/\b(workshop|garage|forge|smithy|inventor|lab)\b/.test(t) || kind === "workshop") return "workshop";
  if (kind === "bakery") return "bakery";
  if (kind === "cave" || style === "cave" && (kind === "woods" || kind === "outside")) return "cave_camp";
  if (kind === "desert" || (style === "desert" && ["street", "square", "market", "woods", "park"].includes(kind))) return "desert_ruins";
  if (kind === "city" || (style === "neon" && ["street", "square", "market", "park", "rooftop"].includes(kind))) return "neon_city";
  if (kind === "harbour" || (style === "harbour" && (kind === "deck" || kind === "park"))) return "harbour";
  if (style === "castle" && ["street", "square", "market", "tower"].includes(kind)) return kind === "tower" ? "belfry" : "castle";
  if (kind === "home") return /\b(kitchen|living room|dinner|table|hall)\b/.test(t) ? "home_interior" : "bedroom";
  if (kind === "school" || kind === "classroom") return "school";
  if (kind === "tower") return "belfry";
  if (kind === "woods") return "forest_edge";
  if (kind === "park") return "park";
  if (kind === "lane") return style === "neon" ? "neon_city" : "back_lane"; // SETS-V2: the back lane
  if (weather === "snow" && kind === "street") return "snowy_street";
  if (kind === "square" || kind === "market") return "market_square";
  if (onCreature) return "creature_back_street";
  if (kind === "deck" || kind === "stairs" || kind === "rooftop") return "creature_back_street";
  return /\b(village|cottage|timber|stone|medieval|plaster|terracotta|thatch\w*|tiles?)\b/.test(t) ? "village_street" : "suburb";
}

const ALARM = /\b(alarms?|sirens?|emergency|red alert|evacuat\w*|lockdown|blaring|klaxon)\b/;
/** a shot's rig from its place theme, its base light and its line's words */
export function rigFor({ theme = null, light = "day", text = "" } = {}) {
  const th = THEMES[theme];
  if (ALARM.test(lowTxt(text))) return "alarm_red";
  const map = th?.rigs ?? OUT_RIGS;
  return map[light] ?? OUT_RIGS[light] ?? "day";
}

// ------------------------------------------------------------------------------------------------ measuring + grading
const median = (arr, n) => { if (!n) return 0; const a = arr.subarray(0, n).sort(); return a[n >> 1]; };
/**
 * A frame's look, the reference measure: median HSV value (brightness) and median HSV saturation over every pixel of a
 * small downsample (RGBA bytes); warm = mean (r - b) / 255 (the orange cast); clip = share near white; dark = share
 * near black.
 */
export function frameStats(rgba) {
  const n = Math.floor(rgba.length / 4);
  const V = new Float32Array(n), S = new Float32Array(n);
  const hb = new Float64Array(12);
  let warm = 0, clip = 0, dark = 0, beige = 0, coloured = 0;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const v = mx / 255, s = mx > 0 ? (mx - mn) / mx : 0;
    V[i] = v; S[i] = s;
    warm += (r - b) / 255;
    if (mx >= 250) clip++;
    if (mx < 26) dark++;
    // hue in degrees (the look gate's lookgate/measure.py: beige = hue 20-50, s 0.12-0.6, v >= 0.5; families of 30 deg)
    let h = 0;
    if (mx > mn) { const d = mx - mn; h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    if (h >= 20 && h <= 50 && s >= 0.12 && s <= 0.6 && v >= 0.5) beige++;
    if (s > 0.2 && v > 0.15) { hb[Math.floor(h / 30) % 12]++; coloured++; }
  }
  const Vs = Float32Array.from(V).sort();
  const contrast = n ? Vs[Math.floor(0.9 * (n - 1))] - Vs[Math.floor(0.1 * (n - 1))] : 0;
  let ent = 0, top = 0;
  for (const c of hb) { if (!c) continue; const p = c / coloured; ent -= p * Math.log2(p); top = Math.max(top, p); }
  return { bright: +median(V, n).toFixed(4), sat: +median(S, n).toFixed(4), warm: +(n ? warm / n : 0).toFixed(4), clip: +(n ? clip / n : 0).toFixed(4), dark: +(n ? dark / n : 0).toFixed(4),
    beige: +(n ? beige / n : 0).toFixed(4), contrast: +contrast.toFixed(4), hueEntropy: +ent.toFixed(3), hueTopShare: +top.toFixed(3) };
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/**
 * The per-shot auto grade toward the rig's target (deterministic: the same stats give the same grade).
 *   expo  multiplier on the tone-mapping exposure (ACES compresses highlights: a damped power, clamped 0.6..1.9)
 *   sat   multiplier on the grade's saturation (0.8..1.4)
 *   warm  added to the grade's warmth (negative pulls an orange / beige cast back; golden + alarm keep theirs)
 * A small dead band keeps shots already on target untouched. prev: the grade the stats were measured with (refine).
 */
export function gradeFor(stats, rigId = "day", prev = null) {
  const rig = RIGS[rigId] ?? RIGS.day;
  const tb = rig.target.bright, ts = rig.target.sat;
  const p = prev ?? { expo: 1, sat: 1, warm: 0, con: 1 };
  const b = Math.max(stats.bright, 0.03), s = Math.max(stats.sat, 0.04);
  let expo = p.expo;
  if (Math.abs(b - tb) > 0.035) expo = p.expo * Math.pow(tb / b, b > tb ? 1.25 : 1.1);
  if (stats.clip > 0.2) expo *= 0.88; // blown highlights (the warm ending): bring them back even when the median is fine
  if (stats.dark > 0.45 && tb >= 0.4) expo *= 1.12; // half the frame black: never unreadably dark
  // saturation is NOT our problem (LOOK-TARGET: ours 0.40-0.47 vs ref 0.38): only a gentle pull, both ways
  let sat = p.sat;
  if (Math.abs(s - ts) > 0.04) sat = p.sat * Math.pow(ts / s, 0.6);
  // FLAT LIGHT (LOOK-TARGET: contrast p90-p10 ref 0.525, ours 0.29-0.49): the grade's contrast toward the rig's target
  let con = p.con ?? 1;
  const tc = rig.target.contrast ?? 0.52, c = stats.contrast;
  if (Number.isFinite(c) && c < tc - 0.04) con = con * Math.min(1.3, Math.pow(tc / Math.max(c, 0.15), 0.7));
  if (Number.isFinite(c) && c > tc + 0.18) con = con * 0.94;
  let warm = p.warm;
  const keepsWarm = rigId === "golden" || rigId === "alarm_red";
  // the reference's cast is ~0.035 (lookref, 67 shots); ours measured 0.15-0.24 (step-3 stills): the beige / orange look
  if (!keepsWarm && stats.warm > 0.07) warm = p.warm - Math.min(0.08, (stats.warm - 0.06) * 0.6);
  if (keepsWarm && stats.warm > 0.2) warm = p.warm - Math.min(0.05, (stats.warm - 0.2) * 0.4); // even a sunset is not one orange
  // BEIGE MONOTONY (LOOK-TARGET: beige-heavy frames ref 4%, ours 41-70%): a frame over ~25% beige is cooled a little more
  if (!keepsWarm && (stats.beige ?? 0) > 0.25) warm -= Math.min(0.03, ((stats.beige ?? 0) - 0.25) * 0.1);
  return { expo: +clamp(expo, 0.6, 1.9).toFixed(3), sat: +clamp(sat, 0.85, 1.15).toFixed(3), warm: +clamp(warm, -0.1, 0.02).toFixed(3), con: +clamp(con, 0.9, 1.3).toFixed(3) };
}
/** true when the stats are on the rig's target (no refine pass needed) */
export const onTarget = (stats, rigId = "day") => { const r = RIGS[rigId] ?? RIGS.day; return Math.abs(stats.bright - r.target.bright) <= 0.07 && stats.clip <= 0.25; };
