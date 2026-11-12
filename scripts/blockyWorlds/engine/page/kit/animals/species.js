// Blocky Worlds ANIMALS (BLOCKY-ANIMALS agent, 2026-11-06): the data of the blocky animal kit. Pure data, Node +
// browser (no three.js here): one spec per species, variants, aliases, the body plans and their animations.
//
//   ANIMAL_SPECIES[name] = { plan, ref, life, giant, gait, tex, c (colours), body, neck, head, eyes, ears, legs, tail,
//                            horns, pattern, extra, variants: { name: overrides }, aliases: [words] }
//     plan   quadruped | biped | bird | fish | serpent | insect | mollusc | cephalopod | pinniped
//     ref    "length" (size = nose to rump, m) | "height" (size = standing height, m)
//     life   the kit size in metres (a pet / a scene object; small animals a touch bigger than life so they read)
//     all part numbers are design units (the builder measures the result and scales it to the asked size)
//   resolveAnimal(word)  -> { species, variant } | null   ("puppy" -> dog, "geese" -> duck/goose, "walrus" -> seal/walrus)
//   ANIMAL_PLANS[plan]   -> the actions that plan animates (page/kit/animals/animate.js)
//   specFor(species, variant) -> the merged spec (defaults <- species <- variant)
// Owner's decision 2026-11-06: no realistic / downloaded / AI models; BLOCKY animals with clear silhouettes, colour
// patterns, belly colours, expressive eyes and simple procedural textures.

export const ANIMAL_ACTIONS = Object.freeze(["idle", "walk", "run", "fly", "swim", "slither", "hop", "crawl", "roar", "attack", "head_turn", "stomp",
  "eat", "sleep", "hit", "fall", "lurk", "reach", "dig", "climb", "flee", "howl", "reveal", "carry", "slide", "float", "sit", "sniff", "bark"]); // sit / sniff / bark: PETS 2026-11-07
export const ANIMAL_EXPRS = Object.freeze(["neutral", "angry", "scared", "happy", "sleepy"]);
const COMMON = ["idle", "head_turn", "roar", "attack", "eat", "sleep", "hit", "fall", "lurk", "reach", "howl", "reveal", "carry", "slide", "float", "sit", "sniff", "bark"];
export const ANIMAL_PLANS = Object.freeze({
  quadruped: [...COMMON, "walk", "run", "stomp", "dig", "climb", "flee", "swim"],
  biped: [...COMMON, "walk", "run", "stomp", "climb", "flee", "swim"],
  bird: [...COMMON, "walk", "run", "fly", "swim", "flee"],
  fish: [...COMMON, "swim", "walk", "run", "flee"],
  serpent: [...COMMON, "slither", "walk", "run", "swim", "flee"],
  insect: [...COMMON, "crawl", "walk", "run", "flee"],
  mollusc: [...COMMON, "crawl", "walk", "run", "flee"],
  cephalopod: [...COMMON, "swim", "crawl", "walk", "run", "flee"],
  pinniped: [...COMMON, "walk", "run", "swim", "flee"],
});

// ------------------------------------------------------------------------------------------------ defaults per plan
const QUAD = {
  plan: "quadruped", ref: "length", gait: "walk", tex: "fur",
  c: { body: "#a0703f", belly: "#f1dfc0", accent: "#6b4423", nose: "#1b1b1f", inner: "#f4a9b8", hoof: null, iris: "#4a2c14", horn: "#efe4c8", sock: null, mouth: "#8a2c3a", collar: null },
  body: { len: 5, w: 2.3, h: 2.2, y: 3.3, chest: 0, hump: 0, round: 0.4, belly: 0.36 },
  neck: { len: 1.0, w: 1.15, tilt: 0.75, at: 0.42, up: 0.25 },
  head: { w: 1.9, h: 1.7, d: 1.8, snout: { len: 1.0, w: 1.0, h: 0.8, y: -0.3 }, jaw: 0.32, teeth: false, fangs: false, cheeks: 0 },
  eyes: { s: 0.5, x: 0.62, y: 0.18, pupil: "round" },
  ears: { kind: "point", s: 0.75, x: 0.62 },
  legs: { x: 0.36, zF: 0.37, zH: -0.37, w: 0.66, foot: { w: 0.78, l: 0.95, h: 0.32 }, kind: "paw", ratio: 0.5 },
  tail: { kind: "long", len: 2.2, w: 0.4, up: 0.5, segs: 4 },
  horns: null, pattern: {}, extra: {},
};
const BIRD = {
  plan: "bird", ref: "height", gait: "walk", tex: "feather",
  c: { body: "#9aa3ad", belly: "#dfe4ea", accent: "#5d6a7a", wing: "#7d8692", tip: "#2a2a30", nose: "#f2a33a", leg: "#f08a3a", iris: "#1b1b1f", head: null, mouth: "#8a2c3a" },
  body: { len: 3.2, w: 2.4, h: 2.6, y: 2.3, tilt: 0.3, round: 0.7 },
  neck: { len: 0.6, w: 1.2, tilt: 1.3 },
  head: { w: 1.7, h: 1.6, d: 1.6 },
  beak: { kind: "cone", len: 0.9, w: 0.5, h: 0.45 },
  eyes: { s: 0.42, x: 0.7, y: 0.2, pupil: "round" },
  wings: { len: 3.6, w: 1.9, fingers: 4 },
  legs: { x: 0.3, len: 2.2, w: 0.22, foot: { w: 0.9, l: 0.9, h: 0.12 }, webbed: false },
  tail: { kind: "fan", len: 1.4, w: 1.4 },
  pattern: {}, extra: {},
};
const FISH = {
  plan: "fish", ref: "length", gait: "swim", tex: "scale",
  c: { body: "#ff8a1a", belly: "#ffd8a8", accent: "#e8630f", fin: "#ffb04a", iris: "#1b1b1f", mouth: "#5a1a1a" },
  body: { len: 6, w: 1.7, h: 3.2, y: 2.0, segs: 5, taper: 0.4, round: 0.6 },
  head: { len: 1.8 },
  eyes: { s: 0.6, x: 1, y: 0.25, pupil: "round" },
  fins: { tail: "fan", tailS: 2.4, dorsal: 1.2, pect: 0.9, anal: 0.6 },
  pattern: {}, extra: {},
};
const SERP = {
  plan: "serpent", ref: "length", gait: "slither", tex: "scale",
  c: { body: "#4f9a3a", belly: "#e6dc8a", accent: "#2e6b24", iris: "#d4a017", tongue: "#e0283a", mouth: "#7a1a2a" },
  body: { segs: 14, len: 12, w: 1.3, h: 1.1 },
  head: { w: 2.0, h: 1.25, d: 2.1 },
  eyes: { s: 0.42, x: 0.85, y: 0.3, pupil: "slit" },
  pattern: {}, extra: {},
};

// ------------------------------------------------------------------------------------------------ the 30 species
export const ANIMAL_SPECIES = {
  dog: {
    ...QUAD, life: 0.95, giant: 60, aliases: ["dog", "dogs", "puppy", "puppies", "pup", "hound", "doggy", "doggo", "pet", "pets", "snowdog", "snowdogs", "retriever", "beagle", "dalmatian", "husky", "labrador", "lab", "poodle", "corgi"],
    c: { ...QUAD.c, body: "#d99a4e", belly: "#f6e2c0", accent: "#9a5a26", collar: "#e53935", iris: "#3a2210" },
    body: { ...QUAD.body, len: 4.6, w: 2.2, h: 2.1, y: 3.0, chest: 0.12 },
    head: { ...QUAD.head, w: 2.0, h: 1.9, d: 1.8, snout: { len: 1.2, w: 1.05, h: 0.85, y: -0.38 }, jaw: 0.34 },
    eyes: { ...QUAD.eyes, s: 0.56, x: 0.58 },
    ears: { kind: "flop", s: 1.0, x: 0.72 },
    tail: { kind: "up", len: 1.8, w: 0.38, up: 1.05, segs: 3 },
    variants: {
      golden: {},
      beagle: { c: { body: "#c8823e", belly: "#ffffff", accent: "#7a4a22", collar: "#1e88e5" }, pattern: { saddle: "#2a2420", muzzle: "#ffffff", tip: "#ffffff" } },
      dalmatian: { c: { body: "#fafafa", belly: "#ffffff", accent: "#1e1e22", collar: "#e53935" }, pattern: { spots: { color: "#1e1e22", n: 16, s: 0.38 } }, ears: { kind: "flop", s: 0.9, x: 0.72, color: "#1e1e22" } },
      husky: { c: { body: "#7d8794", belly: "#f4f6f8", accent: "#3e4550", collar: "#2e7d32", iris: "#3fa7e0" }, ears: { kind: "point", s: 0.8, x: 0.6 }, tail: { kind: "curl", len: 1.9, w: 0.55, up: 1.3, segs: 4 }, pattern: { mask: "#f4f6f8", muzzle: "#f4f6f8" } },
      black_lab: { c: { body: "#26262b", belly: "#33333a", accent: "#18181c", collar: "#fbc02d", iris: "#7a4a22" } },
    },
  },
  mouse: {
    ...QUAD, life: 0.32, giant: 40, aliases: ["mouse", "mice", "rat", "rats", "hamster", "hamsters", "gerbil", "gerbils", "rodent", "rodents", "guinea"],
    tex: "short",
    c: { ...QUAD.c, body: "#a3a8b0", belly: "#ece4d6", accent: "#7d838b", nose: "#ff8fa8", inner: "#ffb3c6", iris: "#111114" },
    body: { ...QUAD.body, len: 4.4, w: 2.4, h: 2.3, y: 1.9, round: 0.9 },
    neck: { len: 0.3, w: 1.6, tilt: 0.3, at: 0.46, up: 0.1 },
    head: { ...QUAD.head, w: 2.0, h: 1.8, d: 2.0, snout: { len: 1.0, w: 0.9, h: 0.7, y: -0.3, taper: true }, jaw: 0.2 },
    eyes: { s: 0.5, x: 0.56, y: 0.22, pupil: "round" },
    ears: { kind: "round", s: 1.25, x: 0.62 },
    legs: { ...QUAD.legs, w: 0.5, foot: { w: 0.62, l: 0.8, h: 0.22 }, x: 0.34 },
    tail: { kind: "thin", len: 4.2, w: 0.22, up: 0.25, segs: 6, color: "#ffb3c6" },
    extra: { whiskers: "#f6f6f6", teeth2: true },
    variants: {
      mouse: {},
      rat: { c: { body: "#7d6d5e", belly: "#c9bba8", accent: "#5a4c40" }, body: { len: 5.6, w: 2.2, h: 2.0, y: 1.8, round: 0.8 }, head: { snout: { len: 1.5, w: 0.85, h: 0.75, y: -0.35, taper: true } }, ears: { kind: "round", s: 0.85, x: 0.6 }, tail: { kind: "thin", len: 5.6, w: 0.26, up: 0.15, segs: 7, color: "#e8a4b0" } },
      hamster: { c: { body: "#e7a24f", belly: "#fff4e0", accent: "#c9802e" }, body: { len: 4.0, w: 3.2, h: 3.0, y: 2.0, round: 1.2 }, head: { w: 2.5, h: 2.2, d: 2.0, snout: { len: 0.45, w: 1.0, h: 0.6, y: -0.35 }, cheeks: 0.7 }, ears: { kind: "round", s: 0.7, x: 0.6 }, tail: { kind: "stub", len: 0.3, w: 0.3, up: 0, segs: 1 }, pattern: { muzzle: "#fff4e0" } },
    },
  },
  cat: {
    ...QUAD, life: 0.72, giant: 60, aliases: ["cat", "cats", "kitten", "kittens", "kitty", "kitties", "tomcat", "tabby", "moggy"],
    c: { ...QUAD.c, body: "#f08a2c", belly: "#ffe7cc", accent: "#b85a14", nose: "#ff8fa8", iris: "#7cc242" },
    body: { ...QUAD.body, len: 4.8, w: 2.0, h: 1.9, y: 2.7, round: 0.55 },
    neck: { len: 0.5, w: 1.0, tilt: 0.9, at: 0.44, up: 0.25 },
    head: { ...QUAD.head, w: 2.2, h: 1.9, d: 1.7, snout: { len: 0.4, w: 1.0, h: 0.6, y: -0.42 }, jaw: 0.22 },
    eyes: { s: 0.62, x: 0.52, y: 0.12, pupil: "slit" },
    ears: { kind: "point", s: 0.95, x: 0.66 },
    legs: { ...QUAD.legs, w: 0.52, foot: { w: 0.62, l: 0.72, h: 0.26 } },
    tail: { kind: "long", len: 3.6, w: 0.36, up: 1.25, segs: 6, curl: 0.5 },
    pattern: { stripes: { color: "#c0601a", n: 4 }, muzzle: "#ffe7cc", tip: null },
    extra: { whiskers: "#ffffff" },
    variants: {
      orange: {},
      black: { c: { body: "#24242a", belly: "#2c2c33", accent: "#18181c", iris: "#f2c522", nose: "#3a3a42" }, pattern: { stripes: null, muzzle: null } },
      grey: { c: { body: "#8c939c", belly: "#d9dde2", accent: "#5f6670", iris: "#f2c522" }, pattern: { stripes: { color: "#5f6670", n: 4 }, muzzle: "#e9ecef" } },
      tuxedo: { c: { body: "#26262c", belly: "#ffffff", accent: "#18181c", iris: "#7cc242" }, pattern: { stripes: null, muzzle: "#ffffff", socks: "#ffffff", bib: "#ffffff" } },
      calico: { c: { body: "#fbf6ee", belly: "#ffffff", accent: "#d47a2c", iris: "#7cc242" }, pattern: { stripes: null, spots: { color: "#e07b28", n: 6, s: 0.6, also: "#2a2a2e" }, muzzle: null } },
      white: { c: { body: "#f7f5f2", belly: "#ffffff", accent: "#e2ddd6", iris: "#3fa7e0" }, pattern: { stripes: null, muzzle: null } },
    },
  },
  pigeon: {
    ...BIRD, life: 0.42, giant: 40, aliases: ["pigeon", "pigeons", "dove", "doves", "bird", "birds", "crow", "crows", "raven", "ravens", "birdie", "sparrow", "sparrows"],
    c: { ...BIRD.c, body: "#9aa3b0", belly: "#b4bcc6", accent: "#5d6774", wing: "#a9b1bc", tip: "#2b2f36", nose: "#3a3a42", leg: "#e86a7a", iris: "#f08a1a", head: "#7d8898" },
    beak: { kind: "cone", len: 0.7, w: 0.35, h: 0.35, cere: "#f2f2f2" },
    pattern: { neck: ["#4caf7a", "#8e5fb0"], wingBars: "#2b2f36", tailBand: "#2b2f36" },
    variants: {
      pigeon: {},
      dove: { c: { body: "#f6f6f4", belly: "#ffffff", wing: "#ececea", tip: "#d8d8d4", head: "#ffffff", leg: "#ff8fa8", iris: "#1b1b1f" }, pattern: { neck: null, wingBars: null, tailBand: null } },
      crow: { c: { body: "#24242c", belly: "#2c2c36", wing: "#1e1e26", tip: "#121218", head: "#24242c", nose: "#121218", leg: "#2a2a30", iris: "#1b1b1f" }, pattern: { neck: null, wingBars: null, tailBand: null }, beak: { kind: "cone", len: 1.0, w: 0.4, h: 0.42 } },
      sparrow: { c: { body: "#a8794a", belly: "#e9dcc6", wing: "#8a5a34", tip: "#3a2a1e", head: "#7a5a3e", nose: "#3a3a42", leg: "#c9a07a", iris: "#1b1b1f" }, pattern: { neck: null, wingBars: "#f2ead8", tailBand: null, cap: "#8a8a92", bib: "#1e1e22" } },
    },
  },
  frog: {
    ...QUAD, life: 0.34, giant: 40, gait: "hop", tex: "skin", aliases: ["frog", "frogs", "toad", "toads", "froggy", "tadpole"],
    c: { ...QUAD.c, body: "#4fb548", belly: "#e8f0a0", accent: "#2e7d32", nose: "#2e7d32", iris: "#1b1b1f", mouth: "#c0394a", spot: "#2e7d32" },
    body: { len: 3.4, w: 3.6, h: 1.8, y: 1.7, chest: 0, hump: 0, round: 0.7, belly: 0.4, pitch: -0.32 },
    neck: { len: 0.1, w: 2.6, tilt: 0.2, at: 0.36, up: 0.1 },
    head: { w: 3.6, h: 1.6, d: 2.0, snout: null, jaw: 0.4, wide: true },
    eyes: { s: 0.95, x: 0.62, y: 0.75, pupil: "wide", bulge: true },
    ears: { kind: "none" },
    legs: { x: 0.44, zF: 0.36, zH: -0.3, w: 0.62, foot: { w: 1.2, l: 1.0, h: 0.2, webbed: true }, kind: "frog", ratio: 0.5, hindW: 1.0 },
    tail: { kind: "none" },
    pattern: { spots: { color: "#2e7d32", n: 8, s: 0.45 } },
    variants: { green: {}, toad: { c: { body: "#8a6e4a", belly: "#d9c7a0", accent: "#5e4a30", nose: "#5e4a30", spot: "#5e4a30" }, tex: "warts", pattern: { spots: { color: "#6b5236", n: 14, s: 0.35 } } }, tree_frog: { c: { body: "#5ed13a", belly: "#ffe066", accent: "#2e7d32", iris: "#c0392b" }, eyes: { s: 1.0, x: 0.62, y: 0.75, pupil: "slit", bulge: true }, pattern: { spots: null, sides: "#3a5fd0" } } },
  },
  yeti: {
    plan: "biped", ref: "height", gait: "walk", tex: "shag", life: 2.6, giant: 60, aliases: ["yeti", "yetis", "bigfoot", "sasquatch", "abominable", "snowman_monster", "snowbeast", "ape", "apes", "gorilla", "gorillas"],
    c: { body: "#f1f4f8", belly: "#dfe6ee", accent: "#c8d3df", face: "#7d9bc0", nose: "#3e5578", iris: "#1b1b1f", horn: "#e8e0cc", mouth: "#5a2030", hand: "#7d9bc0" },
    body: { w: 3.4, h: 3.4, d: 2.4, y: 5.0, round: 0.8 },
    head: { w: 2.3, h: 2.1, d: 2.0, face: true, snout: { len: 0.5, w: 1.2, h: 0.8, y: -0.35 }, jaw: 0.4, fangs: true },
    eyes: { s: 0.48, x: 0.5, y: 0.22, pupil: "round" },
    ears: { kind: "none" },
    horns: { kind: "yeti", s: 1 },
    arms: { len: 4.0, w: 1.0, hand: 1.0 },
    legs: { x: 0.28, w: 1.2, foot: { w: 1.2, l: 1.8, h: 0.4 }, ratio: 0.52 },
    pattern: {}, extra: { tufts: true },
    variants: { yeti: {}, bigfoot: { c: { body: "#6b4a30", belly: "#7d5a3c", accent: "#4a3220", face: "#3a2a20", nose: "#1b1b1f", hand: "#3a2a20" }, horns: null }, gorilla: { tex: "fur", c: { body: "#2c2c32", belly: "#3c3c44", accent: "#1c1c22", face: "#4a4a52", nose: "#1b1b1f", hand: "#3a3a42" }, horns: null, head: { fangs: false } } },
  },
  goat: {
    ...QUAD, life: 1.2, giant: 60, aliases: ["goat", "goats", "kid_goat", "billy", "nanny", "ram", "rams", "sheep", "lamb", "lambs", "ibex"],
    tex: "short",
    c: { ...QUAD.c, body: "#f3efe6", belly: "#ffffff", accent: "#cfc6b4", nose: "#8a7a6a", iris: "#d4a017", hoof: "#3a3430", horn: "#8a7a5a", inner: "#f0c8c0" },
    body: { ...QUAD.body, len: 4.6, w: 2.3, h: 2.2, y: 3.1 },
    neck: { len: 1.2, w: 0.95, tilt: 1.0, at: 0.42, up: 0.3 },
    head: { ...QUAD.head, w: 1.5, h: 1.6, d: 1.5, snout: { len: 1.05, w: 0.9, h: 0.85, y: -0.35 }, jaw: 0.25 },
    eyes: { s: 0.5, x: 0.7, y: 0.18, pupil: "bar" },
    ears: { kind: "side", s: 0.95, x: 0.7 },
    legs: { ...QUAD.legs, w: 0.64, foot: { w: 0.66, l: 0.66, h: 0.34 }, kind: "hoof" },
    tail: { kind: "up", len: 0.8, w: 0.36, up: 1.3, segs: 2 },
    horns: { kind: "curl", s: 1 },
    extra: { beard: "#ffffff" },
    variants: { white: {}, alpine: { c: { body: "#6b4a30", belly: "#2a2420", accent: "#2a2420", horn: "#5e5040" }, pattern: { mask: "#2a2420", socks: "#2a2420" }, extra: { beard: "#2a2420" } }, sheep: { tex: "wool", c: { body: "#f8f6f0", belly: "#ffffff", accent: "#2a2a2e", nose: "#2a2a2e", iris: "#1b1b1f" }, head: { face: "#2a2a2e" }, horns: null, extra: { beard: null, wool: true }, ears: { kind: "side", s: 0.9, x: 0.7, color: "#2a2a2e" }, pattern: { socks: "#2a2a2e" } }, ram: { horns: { kind: "ram", s: 1.1 } } },
  },
  whale: {
    ...FISH, life: 9, giant: 120, tex: "smooth", aliases: ["whale", "whales", "orca", "orcas", "humpback", "leviathan", "dolphin", "dolphins", "narwhal"],
    c: { ...FISH.c, body: "#3f6ea3", belly: "#d6e4f0", accent: "#2b5585", fin: "#2f5f94", iris: "#1b1b1f", mouth: "#5a2a3a" },
    body: { len: 10, w: 3.6, h: 3.4, y: 1.8, segs: 5, taper: 0.38, round: 1.0, headBig: true },
    head: { len: 3.4 },
    eyes: { s: 0.5, x: 1, y: -0.15, pupil: "round" },
    fins: { tail: "fluke", tailS: 3.0, dorsal: 0.35, pect: 2.0, anal: 0 },
    pattern: { grooves: "#b9cde0" },
    extra: { blowhole: true },
    variants: {
      blue: {},
      humpback: { c: { body: "#2f3640", belly: "#e6eaee", accent: "#1e242c", fin: "#e6eaee" }, fins: { tail: "fluke", tailS: 3.0, dorsal: 0.4, pect: 3.6, anal: 0 } },
      orca: { c: { body: "#16161c", belly: "#ffffff", accent: "#0e0e12", fin: "#16161c" }, fins: { tail: "fluke", tailS: 2.6, dorsal: 2.2, pect: 1.4, anal: 0 }, pattern: { grooves: null, eyePatch: "#ffffff", saddle: "#b9c0c8" }, body: { len: 8, w: 2.8, h: 2.8, y: 1.6, segs: 4, taper: 0.4, round: 0.9, headBig: false }, head: { len: 2.4 } },
      dolphin: { c: { body: "#7d9cb8", belly: "#eaf2f8", accent: "#5d7c98", fin: "#6d8ca8" }, fins: { tail: "fluke", tailS: 2.2, dorsal: 1.4, pect: 1.0, anal: 0 }, body: { len: 7, w: 1.8, h: 2.0, y: 1.4, segs: 4, taper: 0.4, round: 0.7, headBig: false, beak: true }, head: { len: 2.0 }, pattern: { grooves: null }, extra: { blowhole: false }, life: 2.4 },
    },
  },
  duck: {
    ...BIRD, life: 0.55, giant: 40, gait: "waddle", aliases: ["duck", "ducks", "duckling", "ducklings", "goose", "geese", "gosling", "mallard", "swan", "swans", "drake"],
    c: { ...BIRD.c, body: "#a8a29a", belly: "#cfc8bf", accent: "#5a4a3a", wing: "#8e877e", tip: "#2a2a30", nose: "#f2c522", leg: "#ff8f1a", head: "#1f7a4a", iris: "#1b1b1f" },
    body: { ...BIRD.body, len: 4.0, w: 2.6, h: 2.2, y: 2.0, tilt: 0.1 },
    neck: { len: 0.9, w: 1.0, tilt: 1.35 },
    head: { w: 1.5, h: 1.5, d: 1.6 },
    beak: { kind: "bill", len: 1.1, w: 0.8, h: 0.35 },
    legs: { ...BIRD.legs, len: 1.0, w: 0.28, foot: { w: 1.1, l: 1.0, h: 0.12 }, webbed: true },
    tail: { kind: "duck", len: 1.0, w: 1.2 },
    pattern: { collar: "#ffffff", chest: "#7a4a2a", speculum: "#3a5fd0" },
    variants: {
      mallard: {},
      white: { c: { body: "#fafafa", belly: "#ffffff", wing: "#f0f0f0", tip: "#e6e6e6", head: "#fafafa", nose: "#ffb020" }, pattern: { collar: null, chest: null, speculum: null } },
      goose: { c: { body: "#f6f6f4", belly: "#ffffff", wing: "#e9e9e6", tip: "#d8d8d4", head: "#f6f6f4", nose: "#ff8f1a" }, neck: { len: 2.6, w: 0.85, tilt: 1.4 }, body: { len: 4.6, w: 2.8, h: 2.4, y: 2.4, tilt: 0.15 }, legs: { len: 1.4 }, pattern: { collar: null, chest: null, speculum: null }, beak: { kind: "goose", len: 1.0, w: 0.6, h: 0.5 }, life: 0.85 },
      canada_goose: { c: { body: "#8a7a68", belly: "#e8e2d8", wing: "#6e6050", tip: "#3a3028", head: "#1e1e22", nose: "#1e1e22", leg: "#2a2a30" }, neck: { len: 2.6, w: 0.85, tilt: 1.4, color: "#1e1e22" }, body: { len: 4.6, w: 2.8, h: 2.4, y: 2.4, tilt: 0.15 }, legs: { len: 1.4 }, pattern: { collar: null, chest: null, speculum: null, chin: "#ffffff" }, beak: { kind: "goose", len: 1.0, w: 0.6, h: 0.5 }, life: 0.85 },
      duckling: { c: { body: "#ffd84a", belly: "#ffe680", wing: "#f6c935", tip: "#f0bd2a", head: "#ffd84a", nose: "#ff9f1a" }, body: { len: 3.0, w: 2.6, h: 2.6, y: 1.9, tilt: 0.05 }, head: { w: 2.0, h: 1.9, d: 1.9 }, pattern: { collar: null, chest: null, speculum: null }, tex: "fluff", life: 0.3 },
    },
  },
  fish: {
    ...FISH, life: 0.45, giant: 40, aliases: ["fish", "fishes", "goldfish", "clownfish", "carp", "koi", "trout", "salmon", "piranha", "minnow", "anglerfish", "lanternfish", "tuna", "guppy"],
    variants: {
      goldfish: {},
      clownfish: { c: { body: "#ff7a1a", belly: "#ff9a40", accent: "#1b1b1f", fin: "#ff8a2a" }, pattern: { bands: { color: "#ffffff", edge: "#1b1b1f", at: [0.18, 0.5, 0.82] } }, fins: { tail: "round", tailS: 1.8, dorsal: 1.0, pect: 0.9, anal: 0.6 } },
      blue: { c: { body: "#2f6fd6", belly: "#ffe066", accent: "#16348a", fin: "#16348a" }, pattern: { stripe: "#16348a" }, fins: { tail: "fork", tailS: 2.0, dorsal: 1.0, pect: 0.8, anal: 0.6 } },
      piranha: { c: { body: "#7d8a99", belly: "#e0442a", accent: "#5d6a7a", fin: "#5d6a7a" }, extra: { teeth: true }, fins: { tail: "fork", tailS: 2.0, dorsal: 0.8, pect: 0.7, anal: 0.6 } },
    },
  },
  ant: {
    plan: "insect", ref: "length", gait: "crawl", tex: "shiny", life: 0.3, giant: 40, aliases: ["ant", "ants", "termite", "termites", "bug", "bugs", "insect", "insects", "beetle", "beetles"],
    c: { body: "#8e2b1f", belly: "#6a1f16", accent: "#3a120c", leg: "#5a1a12", iris: "#1b1b1f", mouth: "#3a120c" },
    body: { len: 8, y: 1.5 },
    eyes: { s: 0.55, x: 0.9, y: 0.25, pupil: "compound" },
    legs: { len: 3.2, w: 0.22 },
    pattern: {}, extra: {},
    variants: { red: {}, black: { c: { body: "#26222a", belly: "#1a171e", accent: "#121014", leg: "#1a171e" } }, beetle: { c: { body: "#2e7d4f", belly: "#1e5a38", accent: "#123a24", leg: "#1a1a1e" }, extra: { beetle: true } } },
  },
  bear: {
    ...QUAD, life: 2.0, giant: 60, aliases: ["bear", "bears", "cub", "cubs", "grizzly", "teddy", "panda", "pandas", "polar_bear"],
    c: { ...QUAD.c, body: "#7a4e2a", belly: "#9a6a3e", accent: "#5a3820", nose: "#1b1b1f", iris: "#1b1b1f", muzzle: "#c49a6a" },
    body: { ...QUAD.body, len: 5.4, w: 3.2, h: 3.0, y: 3.4, chest: 0.12, hump: 0.4, round: 0.8 },
    neck: { len: 0.6, w: 1.8, tilt: 0.3, at: 0.44, up: 0.15 },
    head: { ...QUAD.head, w: 2.4, h: 2.1, d: 2.0, snout: { len: 0.9, w: 1.1, h: 0.9, y: -0.4 }, jaw: 0.34, fangs: true },
    eyes: { s: 0.42, x: 0.5, y: 0.2, pupil: "round" },
    ears: { kind: "round", s: 0.8, x: 0.64 },
    legs: { ...QUAD.legs, w: 0.95, foot: { w: 1.1, l: 1.3, h: 0.4 }, x: 0.34, claws: "#e8e0cc" },
    tail: { kind: "stub", len: 0.5, w: 0.6, up: 0.3, segs: 1 },
    pattern: { muzzle: "#c49a6a" },
    variants: {
      brown: {},
      black: { c: { body: "#26242a", belly: "#2e2c32", accent: "#18171c" }, pattern: { muzzle: "#b48a5a" } },
      polar: { c: { body: "#f4f2ea", belly: "#faf8f2", accent: "#e0dcd0", nose: "#1b1b1f" }, pattern: { muzzle: null }, head: { snout: { len: 1.1, w: 1.0, h: 0.85, y: -0.4 } }, body: { hump: 0 } },
      panda: { c: { body: "#f6f6f4", belly: "#f6f6f4", accent: "#1e1e22" }, pattern: { muzzle: null, eyePatch: "#1e1e22", socks: "#1e1e22", band: "#1e1e22" }, ears: { kind: "round", s: 0.85, x: 0.64, color: "#1e1e22" }, body: { hump: 0 } },
    },
  },
  turtle: {
    ...QUAD, life: 0.6, giant: 120, gait: "walk", tex: "skin", aliases: ["turtle", "turtles", "tortoise", "tortoises", "terrapin", "sea_turtle"],
    c: { ...QUAD.c, body: "#8aa85a", belly: "#e3d49a", accent: "#5a7a3a", nose: "#2e4a1e", iris: "#2a1a0e", shell: "#6a4a2a", shell2: "#8a6636", seam: "#2e1e10", rim: "#7a5a34", moss: "#4f6e2a", beak: "#4e4a3a", fold: "#6e8a46", headSpot: "#5f7d3a" },
    body: { len: 6.4, w: 5.4, h: 1.2, y: 1.6, round: 0.5, belly: 0.5 },
    neck: { len: 1.4, w: 1.1, tilt: 0.25, at: 0.44, up: -0.1 },
    head: { w: 1.75, h: 1.45, d: 1.9, snout: { len: 0.55, w: 1.15, h: 0.8, y: -0.18 }, jaw: 0.3, beak: true, folds: true },
    eyes: { s: 0.5, x: 0.78, y: 0.2, pupil: "round", lid: 0.32, brow: true },
    ears: { kind: "none" },
    legs: { x: 0.4, zF: 0.32, zH: -0.32, w: 0.9, foot: { w: 1.0, l: 1.1, h: 0.3 }, kind: "stump", ratio: 0.5, splay: 0.25 },
    tail: { kind: "stub", len: 0.7, w: 0.5, up: -0.2, segs: 1 },
    shell: { kind: "dome", h: 2.6 },
    pattern: { scales: true, headSpots: true, moss: 7 },
    variants: { green: {}, tortoise: { c: { body: "#a89a7a", belly: "#d9c99a", shell: "#7a5a32", shell2: "#c08a3e", seam: "#3a2a18", rim: "#8a6a3e", nose: "#4a3a2a", fold: "#8a7a5a", headSpot: "#8a7a5a" }, shell: { kind: "dome", h: 3.4 }, pattern: { moss: 3 } }, sea: { c: { body: "#a8b88a", shell: "#6a5a32", shell2: "#a88a4a", seam: "#3a2e18", rim: "#c9b07a" }, legs: { kind: "flipper" }, shell: { kind: "dome", h: 2.0 }, pattern: { moss: 0 } } },
  },
  dragon: {
    ...QUAD, life: 6, giant: 80, tex: "scale", aliases: ["dragon", "dragons", "wyvern", "drake", "wyrm", "dragonling"],
    c: { ...QUAD.c, body: "#3f9a5a", belly: "#f0d878", accent: "#2b6a40", nose: "#1b2b20", iris: "#ffcf2a", horn: "#f2ead8", wing: "#2b6a40", membrane: "#e0a040", mouth: "#c0283a", glow: "#ffb020" },
    body: { ...QUAD.body, len: 5.2, w: 2.6, h: 2.4, y: 3.4, chest: 0.15, round: 0.5, belly: 0.4 },
    neck: { len: 2.2, w: 1.2, tilt: 0.85, at: 0.44, up: 0.3, segs: 2 },
    head: { ...QUAD.head, w: 1.8, h: 1.6, d: 1.8, snout: { len: 1.6, w: 1.2, h: 0.8, y: -0.25 }, jaw: 0.36, teeth: true, fangs: true, brow: true },
    eyes: { s: 0.5, x: 0.6, y: 0.25, pupil: "slit", glow: true },
    ears: { kind: "fin", s: 0.8, x: 0.66 },
    legs: { ...QUAD.legs, w: 0.8, foot: { w: 0.95, l: 1.2, h: 0.32 }, claws: "#f2ead8" },
    tail: { kind: "dragon", len: 6.0, w: 0.9, up: 0.1, segs: 7 },
    horns: { kind: "dragon", s: 1 },
    pattern: { bellyPlates: "#d8b850" },
    extra: { wings: true, spikes: 7 },
    variants: { green: {}, red: { c: { body: "#c8382c", belly: "#f6c860", accent: "#8a1e18", wing: "#8a1e18", membrane: "#f08a3a" } }, purple: { c: { body: "#7a4ab0", belly: "#f0c8ff", accent: "#4a2a78", wing: "#4a2a78", membrane: "#b890e0", iris: "#7fe8ff", glow: "#7fe8ff" } }, black: { c: { body: "#2a2a34", belly: "#6a5a7a", accent: "#18181e", wing: "#18181e", membrane: "#5a2a3a", iris: "#ff3a2a", glow: "#ff3a2a" } } },
  },
  octopus: {
    plan: "cephalopod", ref: "height", gait: "swim", tex: "skin", life: 1.2, giant: 80, aliases: ["octopus", "octopuses", "octopi", "squid", "squids", "kraken", "krakens", "cuttlefish", "tentacle", "tentacles"],
    c: { body: "#e0587a", belly: "#ffc0cf", accent: "#b03a5a", sucker: "#ffd8e0", iris: "#1b1b1f", spot: "#c04060", mouth: "#5a1a2a" },
    body: { w: 3.6, h: 4.0, d: 3.4, y: 3.6, round: 1.2 },
    eyes: { s: 0.8, x: 0.62, y: -0.1, pupil: "bar" },
    arms: { n: 8, len: 5.0, w: 0.8, segs: 6 },
    pattern: { spots: { color: "#c04060", n: 10, s: 0.35 } }, extra: {},
    variants: {
      octopus: {},
      squid: { c: { body: "#f0f0e8", belly: "#ffd8c8", accent: "#e07a5a", sucker: "#fff0e8", spot: "#e8705a" }, body: { w: 2.4, h: 6.0, d: 2.4, y: 6.4, round: 0.8, squid: true }, arms: { n: 8, len: 3.2, w: 0.6, segs: 5, tentacles: 2 }, eyes: { s: 0.85, x: 0.75, y: -0.32, pupil: "round" } },
      kraken: { c: { body: "#5a3a8a", belly: "#b89ad8", accent: "#3a2268", sucker: "#d8c8f0", spot: "#3a2268", iris: "#ffcf2a" }, eyes: { s: 0.8, x: 0.62, y: -0.1, pupil: "slit", glow: true } },
    },
  },
  deer: {
    ...QUAD, life: 1.7, giant: 60, tex: "short", aliases: ["deer", "deers", "fawn", "doe", "stag", "stags", "buck", "reindeer", "caribou", "moose", "elk", "antlers", "antelope"],
    c: { ...QUAD.c, body: "#b7783e", belly: "#f5e6cc", accent: "#7a4a22", nose: "#1b1b1f", iris: "#1b1b1f", hoof: "#2a2420", horn: "#d8c49a", inner: "#f0c8b8" },
    body: { ...QUAD.body, len: 4.6, w: 1.9, h: 2.0, y: 4.4 },
    neck: { len: 1.9, w: 0.9, tilt: 1.05, at: 0.42, up: 0.3 },
    head: { ...QUAD.head, w: 1.3, h: 1.4, d: 1.4, snout: { len: 1.1, w: 0.8, h: 0.75, y: -0.3 }, jaw: 0.22 },
    eyes: { s: 0.52, x: 0.72, y: 0.2, pupil: "round" },
    ears: { kind: "leaf", s: 1.1, x: 0.75 },
    legs: { ...QUAD.legs, w: 0.42, foot: { w: 0.45, l: 0.5, h: 0.3 }, kind: "hoof" },
    tail: { kind: "flag", len: 0.8, w: 0.6, up: 1.2, segs: 1, under: "#ffffff" },
    horns: { kind: "antler", s: 1 },
    pattern: { rump: "#f5e6cc", muzzle: "#3a2a20" },
    variants: {
      deer: {},
      doe: { horns: null, pattern: { rump: "#f5e6cc", spots: null } },
      fawn: { horns: null, pattern: { rump: "#f5e6cc", spots: { color: "#fff4e0", n: 14, s: 0.22, top: true } }, life: 0.9 },
      reindeer: { c: { body: "#8a6a4e", belly: "#e8e0d0", accent: "#5a4430", horn: "#c8b48a", nose: "#e53935" }, horns: { kind: "antler", s: 1.35 }, pattern: { mane: "#efe8dc", rump: "#efe8dc" } },
      moose: { c: { body: "#4a3220", belly: "#6b4a30", accent: "#2e1e14", horn: "#d8c49a", nose: "#2a1a10", hoof: "#1e1610" }, body: { len: 5.0, w: 2.4, h: 2.6, y: 4.6, hump: 0.6, chest: 0.15 }, neck: { len: 1.0, w: 1.3, tilt: 0.5, at: 0.44, up: 0.3 }, head: { w: 1.5, h: 1.6, d: 1.6, snout: { len: 1.7, w: 1.1, h: 1.0, y: -0.25, droop: true } }, horns: { kind: "moose", s: 1.1 }, ears: { kind: "leaf", s: 0.9, x: 0.8 }, pattern: { rump: null, muzzle: null, socks: "#8a7a6a" }, extra: { bell: true }, tail: { kind: "stub", len: 0.4, w: 0.5, up: 0, segs: 1 }, life: 2.8 },
    },
  },
  chicken: {
    ...BIRD, life: 0.5, giant: 40, aliases: ["chicken", "chickens", "hen", "hens", "rooster", "roosters", "chick", "chicks", "cockerel", "poultry", "turkey"],
    c: { ...BIRD.c, body: "#fbfaf4", belly: "#ffffff", accent: "#e8e2d4", wing: "#efece2", tip: "#d8d2c4", nose: "#ffb020", leg: "#ffc02a", head: "#fbfaf4", comb: "#e53935", iris: "#1b1b1f" },
    body: { ...BIRD.body, len: 3.6, w: 2.8, h: 2.8, y: 2.8, tilt: 0.25 },
    neck: { len: 0.5, w: 1.3, tilt: 1.4 },
    head: { w: 1.4, h: 1.5, d: 1.4 },
    beak: { kind: "cone", len: 0.6, w: 0.45, h: 0.4 },
    legs: { ...BIRD.legs, len: 1.6, w: 0.26 },
    tail: { kind: "hen", len: 1.6, w: 1.4 },
    pattern: {}, extra: { comb: true, wattle: true },
    variants: {
      white: {},
      brown: { c: { body: "#b8662e", belly: "#c8783e", wing: "#9a4e22", tip: "#5a2a14", head: "#c8783e", accent: "#9a4e22" } },
      rooster: { c: { body: "#c8562a", belly: "#2a2a30", wing: "#8a2a1a", tip: "#1e3a6a", head: "#f0a040", accent: "#2a6a4a" }, tail: { kind: "rooster", len: 2.6, w: 1.6, color: "#1e5a3e" }, extra: { comb: "big", wattle: true }, pattern: { hackle: "#f0a040" } },
      chick: { tex: "fluff", c: { body: "#ffe066", belly: "#fff08a", wing: "#ffd84a", tip: "#ffd040", head: "#ffe066", nose: "#ff9f1a", leg: "#ff9f1a" }, body: { len: 3.0, w: 3.0, h: 3.0, y: 2.0, tilt: 0 }, head: { w: 2.2, h: 2.1, d: 2.0 }, extra: { comb: false, wattle: false }, tail: { kind: "none" }, life: 0.22 },
    },
  },
  parrot: {
    ...BIRD, life: 0.6, giant: 40, aliases: ["parrot", "parrots", "macaw", "macaws", "parakeet", "parakeets", "budgie", "cockatoo", "toucan"],
    c: { ...BIRD.c, body: "#e02a2a", belly: "#e02a2a", accent: "#c01e1e", wing: "#2a6ad8", tip: "#1e3a9a", nose: "#f4efe6", leg: "#6a6a72", head: "#e02a2a", iris: "#f2e8c0", face: "#ffffff", bar: "#ffd02a" },
    body: { ...BIRD.body, len: 2.6, w: 2.2, h: 3.0, y: 3.6, tilt: 0.75 },
    head: { w: 1.8, h: 1.8, d: 1.7 },
    beak: { kind: "hook", len: 1.0, w: 0.75, h: 1.0, lower: "#2a2a30" },
    eyes: { s: 0.4, x: 0.75, y: 0.15, pupil: "round" },
    legs: { ...BIRD.legs, len: 1.2, w: 0.3, foot: { w: 0.8, l: 0.9, h: 0.14 }, zygo: true },
    tail: { kind: "long", len: 4.4, w: 0.9 },
    pattern: { face: "#ffffff", wingBand: "#ffd02a" },
    variants: {
      scarlet: {},
      blue_gold: { c: { body: "#2a7ae0", belly: "#ffcc22", wing: "#1f62c8", tip: "#1e3a9a", head: "#2a7ae0", bar: null, nose: "#1e1e22" }, pattern: { face: "#ffffff", wingBand: null, bib: "#1e1e22" } },
      green: { c: { body: "#3ab04a", belly: "#7ad05a", wing: "#2a8a3a", tip: "#1e5ad0", head: "#3ab04a", nose: "#e8e2d4", bar: null }, pattern: { face: null, wingBand: null, cap: "#f2d43a" }, tail: { kind: "long", len: 3.0, w: 0.9 } },
      cockatoo: { c: { body: "#fafafa", belly: "#ffffff", wing: "#f2f2f2", tip: "#f6e88a", head: "#fafafa", nose: "#2a2a30" }, pattern: { face: null, wingBand: null }, extra: { crest: "#ffd84a" }, tail: { kind: "fan", len: 2.0, w: 1.4 } },
    },
  },
  shark: {
    ...FISH, life: 3.4, giant: 80, tex: "smooth", aliases: ["shark", "sharks", "megalodon", "jaws", "hammerhead"],
    c: { ...FISH.c, body: "#6f7f92", belly: "#f2f4f6", accent: "#4f5f72", fin: "#5f6f82", iris: "#121216", mouth: "#5a1a22" },
    body: { len: 10, w: 2.4, h: 2.6, y: 2.0, segs: 5, taper: 0.42, round: 0.7, pointy: true },
    head: { len: 2.8 },
    eyes: { s: 0.38, x: 1, y: 0.25, pupil: "round", dark: true },
    fins: { tail: "crescent", tailS: 3.4, dorsal: 2.4, pect: 2.0, anal: 0.5 },
    pattern: { gills: "#3a4656" }, extra: { teeth: true, frown: true },
    variants: { grey: {}, great_white: { c: { body: "#808a96", belly: "#ffffff" } }, hammerhead: { extra: { hammer: true, teeth: true } }, tiger: { c: { body: "#7a8a7a", belly: "#f0f0e8" }, pattern: { gills: "#3a4656", stripes: "#4f5a4f" } } },
  },
  pig: {
    ...QUAD, life: 1.1, giant: 60, tex: "skin", aliases: ["pig", "pigs", "piglet", "piglets", "hog", "hogs", "boar", "boars", "swine", "piggy", "warthog"],
    c: { ...QUAD.c, body: "#ffb3c1", belly: "#ffc8d3", accent: "#f08aa0", nose: "#ff8fa8", inner: "#f07a92", hoof: "#8a5a5a", iris: "#1b1b1f", nostril: "#c0506a" },
    body: { ...QUAD.body, len: 5.2, w: 3.0, h: 2.8, y: 2.6, round: 1.0 },
    neck: { len: 0.2, w: 2.2, tilt: 0.2, at: 0.46, up: 0.1 },
    head: { ...QUAD.head, w: 2.4, h: 2.2, d: 1.8, snout: { len: 0.8, w: 1.2, h: 1.0, y: -0.25, disc: true }, jaw: 0.25 },
    eyes: { s: 0.44, x: 0.55, y: 0.25, pupil: "round" },
    ears: { kind: "pig", s: 1.0, x: 0.62 },
    legs: { ...QUAD.legs, w: 0.7, foot: { w: 0.7, l: 0.7, h: 0.3 }, kind: "hoof" },
    tail: { kind: "curl", len: 1.0, w: 0.24, up: 0.6, segs: 5 },
    variants: {
      pink: {},
      spotted: { pattern: { spots: { color: "#2a2228", n: 7, s: 0.6 } } },
      boar: { tex: "fur", c: { body: "#6a4a32", belly: "#7d5a40", accent: "#4a3020", nose: "#3a2a20", inner: "#4a3020", hoof: "#1e1610", nostril: "#1e1610" }, head: { snout: { len: 1.1, w: 1.1, h: 0.9, y: -0.35, disc: true }, tusks: true }, pattern: { mane: "#3a2a1e" }, tail: { kind: "thin", len: 1.2, w: 0.2, up: -0.3, segs: 2 } },
    },
  },
  mole: {
    ...QUAD, life: 0.32, giant: 40, tex: "velvet", aliases: ["mole", "moles", "vole", "shrew", "badger", "badgers"],
    c: { ...QUAD.c, body: "#3e3a44", belly: "#4c4754", accent: "#2c2832", nose: "#ff8fa8", iris: "#1b1b1f", hand: "#ffb0bf" },
    body: { ...QUAD.body, len: 4.6, w: 2.8, h: 2.4, y: 1.8, round: 1.1 },
    neck: { len: 0.1, w: 2.0, tilt: 0.1, at: 0.46, up: 0 },
    head: { ...QUAD.head, w: 2.2, h: 1.8, d: 1.6, snout: { len: 1.0, w: 0.7, h: 0.55, y: -0.15, taper: true, color: "#ffb0bf" }, jaw: 0.15 },
    eyes: { s: 0.3, x: 0.55, y: 0.25, pupil: "tiny" },
    ears: { kind: "none" },
    legs: { ...QUAD.legs, w: 0.6, foot: { w: 0.7, l: 0.8, h: 0.2 }, x: 0.4, frontHand: { w: 1.5, l: 1.3, h: 0.25 } },
    tail: { kind: "stub", len: 0.5, w: 0.25, up: 0.2, segs: 1, color: "#ffb0bf" },
    extra: { whiskers: "#e8e8e8", nosestar: true },
    variants: { mole: {}, badger: { tex: "fur", c: { body: "#7d7d84", belly: "#2a2a2e", accent: "#1e1e22", nose: "#1e1e22", hand: "#2a2a2e" }, head: { snout: { len: 1.0, w: 0.8, h: 0.65, y: -0.2, taper: true, color: "#f6f6f4" } }, eyes: { s: 0.36, x: 0.55, y: 0.25, pupil: "round" }, ears: { kind: "round", s: 0.5, x: 0.6, color: "#f6f6f4" }, pattern: { headStripe: "#f6f6f4" }, extra: { whiskers: null, nosestar: false }, life: 0.8 } },
  },
  seagull: {
    ...BIRD, life: 0.55, giant: 40, aliases: ["seagull", "seagulls", "gull", "gulls", "albatross", "tern", "pelican", "puffin"],
    c: { ...BIRD.c, body: "#fafbfc", belly: "#ffffff", accent: "#c8d0d8", wing: "#a9b4c0", tip: "#1e1e24", nose: "#ffd02a", leg: "#f4a98a", head: "#ffffff", iris: "#f2e06a", spot: "#e53935" },
    body: { ...BIRD.body, len: 4.0, w: 2.2, h: 2.4, y: 3.2, tilt: 0.15 },
    head: { w: 1.6, h: 1.5, d: 1.6 },
    beak: { kind: "gull", len: 1.3, w: 0.42, h: 0.42 },
    wings: { len: 5.0, w: 1.8, fingers: 4 },
    legs: { ...BIRD.legs, len: 1.8, webbed: true },
    tail: { kind: "fan", len: 1.4, w: 1.4, color: "#ffffff" },
    pattern: { wingSpots: "#ffffff" },
    variants: { herring: {}, puffin: { c: { body: "#1e1e24", belly: "#ffffff", wing: "#1e1e24", tip: "#121216", head: "#1e1e24", nose: "#ff7a1a", leg: "#ff7a1a", iris: "#1b1b1f" }, pattern: { face: "#ffffff", wingSpots: null }, beak: { kind: "puffin", len: 0.9, w: 0.45, h: 1.0 }, body: { len: 3.2, w: 2.6, h: 2.8, y: 2.6, tilt: 0.5 } } },
  },
  snail: {
    plan: "mollusc", ref: "length", gait: "crawl", tex: "slime", life: 0.28, giant: 120, aliases: ["snail", "snails", "slug", "slugs", "escargot"],
    c: { body: "#d8c49a", belly: "#c4ae84", accent: "#a88c5e", iris: "#1b1b1f", shell: "#b8652e", shell2: "#f0b060", seam: "#6a3414", mouth: "#7a5a3a" },
    body: { len: 9.4, w: 2.4, h: 1.2, segs: 4 },
    head: { w: 1.8, h: 2.2, d: 1.6 },
    eyes: { s: 0.55, x: 0, y: 0, pupil: "round" },
    shell: { kind: "spiral", h: 5.6 },
    pattern: {}, extra: {},
    variants: { garden: {}, slug: { shell: { kind: "none", h: 0 }, c: { body: "#8a6a3e", belly: "#6a4a2a", accent: "#5a3a1e" } }, blue: { c: { body: "#9ab8d8", belly: "#7a98b8", accent: "#5a7898", shell: "#3a5aa0", shell2: "#8ab0e0", seam: "#1e2e5a" } } },
  },
  snake: {
    ...SERP, life: 1.8, giant: 120, aliases: ["snake", "snakes", "serpent", "serpents", "python", "cobra", "viper", "boa", "adder", "anaconda", "rattlesnake", "worm", "worms"],
    pattern: { diamonds: "#2e6b24" },
    variants: {
      green: {},
      coral: { c: { body: "#e0302a", belly: "#f0d040", accent: "#1e1e22", iris: "#1b1b1f" }, pattern: { diamonds: null, bands: ["#f6d02a", "#1e1e22", "#f6d02a"] } },
      python: { c: { body: "#c8a464", belly: "#efe4c4", accent: "#6a4a22", iris: "#d4a017" }, pattern: { diamonds: null, blotches: "#6a4a22" } },
      cobra: { c: { body: "#8a7040", belly: "#e8d8a0", accent: "#4a3a1e" }, pattern: { diamonds: null, bands: ["#4a3a1e"] }, extra: { hood: true } },
      worm: { tex: "skin", c: { body: "#e889a0", belly: "#f0a8b8", accent: "#c86a82", iris: "#1b1b1f" }, pattern: { diamonds: null, rings: "#d0788e" }, eyes: { s: 0.45, x: 0.7, y: 0.4, pupil: "round" }, extra: { noTongue: true }, life: 0.5 },
    },
  },
  seal: {
    plan: "pinniped", ref: "length", gait: "galumph", tex: "smooth", life: 1.6, giant: 60, aliases: ["seal", "seals", "walrus", "walruses", "sea_lion", "sealion", "otter", "otters", "pup_seal"],
    c: { body: "#8a939e", belly: "#c8ced6", accent: "#5d6670", nose: "#1b1b1f", iris: "#121216", spot: "#5d6670", flipper: "#5d6670", mouth: "#5a2a3a" },
    body: { len: 6.4, w: 2.6, h: 2.4, y: 1.3, segs: 3 },
    head: { w: 2.0, h: 1.9, d: 1.9, snout: { len: 0.7, w: 1.1, h: 0.8, y: -0.3 } },
    eyes: { s: 0.62, x: 0.55, y: 0.2, pupil: "big" },
    pattern: { spots: { color: "#5d6670", n: 12, s: 0.3 } }, extra: { whiskers: "#f0f0f0" },
    variants: {
      seal: {},
      walrus: { c: { body: "#b07a5a", belly: "#c48e6e", accent: "#8a5a3e", nose: "#6a3a2a", flipper: "#8a5a3e", spot: "#9a6a4a" }, body: { len: 7.2, w: 3.6, h: 3.2, y: 1.7, segs: 3 }, head: { w: 2.4, h: 2.2, d: 2.0, snout: { len: 0.9, w: 1.8, h: 1.1, y: -0.35, pad: true } }, eyes: { s: 0.36, x: 0.55, y: 0.3, pupil: "round" }, pattern: { spots: null, wrinkles: "#9a6a4a" }, extra: { tusks: true, whiskers: "#f4e8d0" }, life: 3.0 },
      sea_lion: { c: { body: "#6a4e3a", belly: "#7d5e48", accent: "#4a3426", flipper: "#4a3426" }, pattern: { spots: null } },
    },
  },
  cow: {
    ...QUAD, life: 2.2, giant: 60, tex: "short", aliases: ["cow", "cows", "calf", "calves", "bull", "bulls", "cattle", "ox", "oxen", "bison", "buffalo", "yak", "livestock", "heifer"],
    c: { ...QUAD.c, body: "#fafafa", belly: "#ffffff", accent: "#1e1e22", nose: "#ffb3c1", hoof: "#2a2420", horn: "#efe4c8", iris: "#1b1b1f", inner: "#ffb3c1", nostril: "#c06a7a" },
    body: { ...QUAD.body, len: 5.6, w: 2.8, h: 2.6, y: 3.6, round: 0.45 },
    neck: { len: 0.8, w: 1.5, tilt: 0.45, at: 0.44, up: 0.2 },
    head: { ...QUAD.head, w: 1.9, h: 1.9, d: 1.6, snout: { len: 0.9, w: 1.5, h: 1.0, y: -0.45, color: "#ffb3c1", disc: false }, jaw: 0.25 },
    eyes: { s: 0.5, x: 0.68, y: 0.22, pupil: "round" },
    ears: { kind: "side", s: 0.95, x: 0.72 },
    legs: { ...QUAD.legs, w: 0.7, foot: { w: 0.72, l: 0.7, h: 0.32 }, kind: "hoof" },
    tail: { kind: "tuft", len: 2.4, w: 0.22, up: -0.9, segs: 3, tip: "#1e1e22" },
    horns: { kind: "small", s: 1 },
    pattern: { spots: { color: "#1e1e22", n: 7, s: 0.9 }, udder: "#ffb3c1", headPatch: "#1e1e22" },
    extra: { bell: true },
    variants: {
      holstein: {},
      brown: { c: { body: "#a8683a", belly: "#c88a5a", accent: "#6a3e20" }, pattern: { spots: null, udder: "#ffb3c1", headPatch: null, muzzle: "#f0e0d0" } },
      bull: { c: { body: "#3a2a22", belly: "#4a3a30", accent: "#1e1610", nose: "#6a5a50", nostril: "#2a2018" }, horns: { kind: "bull", s: 1.2 }, pattern: { spots: null, udder: null, headPatch: null }, extra: { bell: false, ring: true }, body: { hump: 0.4, chest: 0.15 } },
      highland: { tex: "shag", c: { body: "#c8642a", belly: "#b8541e", accent: "#8a3a14", nose: "#3a2a22" }, horns: { kind: "long", s: 1.4 }, pattern: { spots: null, udder: null, headPatch: null, fringe: "#d8743a" }, extra: { bell: false } },
    },
  },
  rabbit: {
    ...QUAD, life: 0.45, giant: 40, gait: "hop", tex: "fluff", aliases: ["rabbit", "rabbits", "bunny", "bunnies", "hare", "hares", "jackrabbit", "kangaroo"],
    c: { ...QUAD.c, body: "#f6f2ec", belly: "#ffffff", accent: "#e6ddd0", nose: "#ff8fa8", inner: "#ffb3c6", iris: "#1b1b1f" },
    body: { ...QUAD.body, len: 3.8, w: 2.6, h: 2.6, y: 2.1, round: 1.0, pitch: -0.25 },
    neck: { len: 0.2, w: 1.6, tilt: 0.3, at: 0.42, up: 0.25 },
    head: { ...QUAD.head, w: 2.0, h: 1.9, d: 1.8, snout: { len: 0.4, w: 1.0, h: 0.7, y: -0.4 }, jaw: 0.2, cheeks: 0.3 },
    eyes: { s: 0.55, x: 0.62, y: 0.18, pupil: "round" },
    ears: { kind: "long", s: 1.0, x: 0.36 },
    legs: { ...QUAD.legs, w: 0.5, zF: 0.36, zH: -0.28, foot: { w: 0.6, l: 0.7, h: 0.24 }, hindFoot: { w: 0.8, l: 2.0, h: 0.3 }, kind: "rabbit" },
    tail: { kind: "puff", len: 0.8, w: 0.9, up: 0.3, segs: 1, color: "#ffffff" },
    extra: { whiskers: "#ffffff", teeth2: true },
    variants: { white: {}, brown: { c: { body: "#a8784a", belly: "#f0e2cc", accent: "#7a5430", inner: "#e8a8b0" } }, grey: { c: { body: "#9a9aa2", belly: "#ececec", accent: "#6a6a72", inner: "#ffb3c6" } }, lop: { c: { body: "#d8a870", belly: "#fff4e0" }, ears: { kind: "lop", s: 1.0, x: 0.55 } } },
  },
  wolf: {
    ...QUAD, life: 1.4, giant: 60, aliases: ["wolf", "wolves", "werewolf", "fox", "foxes", "coyote", "coyotes", "jackal", "dingo"],
    c: { ...QUAD.c, body: "#8a929c", belly: "#eef1f4", accent: "#454b54", nose: "#1b1b1f", iris: "#f2c522" },
    body: { ...QUAD.body, len: 5.0, w: 2.0, h: 2.2, y: 3.6, chest: 0.18, round: 0.4 },
    neck: { len: 1.0, w: 1.4, tilt: 0.55, at: 0.43, up: 0.25, ruff: true },
    head: { ...QUAD.head, w: 1.9, h: 1.7, d: 1.6, snout: { len: 1.5, w: 0.95, h: 0.8, y: -0.35, taper: true }, jaw: 0.3, fangs: true },
    eyes: { s: 0.5, x: 0.6, y: 0.2, pupil: "round", brow: true },
    ears: { kind: "point", s: 1.1, x: 0.6, inner: "#3a3f46" },
    legs: { ...QUAD.legs, w: 0.55, foot: { w: 0.65, l: 0.8, h: 0.3 } },
    tail: { kind: "bush", len: 2.6, w: 0.8, up: -0.4, segs: 4, tip: "#3a3f46" },
    pattern: { mask: "#eef1f4", saddle: "#4a5058", muzzle: "#eef1f4", bib: "#eef1f4", brow: "#4a5058" },
    extra: { tufts: "#6e7680" },
    variants: {
      grey: {},
      villain: { c: { body: "#4a4f58", belly: "#9aa1aa", accent: "#25282e", iris: "#ff2a1a", glow: "#ff2a1a" }, eyes: { s: 0.5, x: 0.6, y: 0.2, pupil: "slit", brow: true, glow: true }, pattern: { mask: "#9aa1aa", saddle: "#25282e", muzzle: "#9aa1aa", bib: "#9aa1aa", brow: "#25282e" }, extra: { tufts: "#33373e" }, expr: "angry" },
      arctic: { c: { body: "#f2f4f6", belly: "#ffffff", accent: "#d0d6dc", iris: "#3fa7e0" }, pattern: { mask: null, saddle: "#dde2e8", muzzle: null }, tail: { kind: "bush", len: 2.6, w: 0.8, up: -0.4, segs: 4, tip: "#e0e4e8" } },
      black: { c: { body: "#2a2a30", belly: "#3a3a42", accent: "#18181c", iris: "#ffb020" }, pattern: { mask: null, saddle: null, muzzle: "#4a4a52" }, tail: { kind: "bush", len: 2.6, w: 0.8, up: -0.4, segs: 4, tip: "#18181c" } },
      fox: { c: { body: "#e8691e", belly: "#ffffff", accent: "#2a2420", iris: "#d4a017" }, pattern: { mask: "#ffffff", saddle: null, muzzle: "#ffffff", socks: "#2a2420" }, tail: { kind: "bush", len: 3.0, w: 1.0, up: -0.2, segs: 4, tip: "#ffffff" }, body: { len: 4.4, w: 1.7, h: 1.8, y: 2.6, chest: 0.1 }, ears: { kind: "point", s: 1.15, x: 0.6, color: "#2a2420" }, life: 0.9 },
    },
  },
  elephant: {
    ...QUAD, life: 5, giant: 80, tex: "wrinkle", aliases: ["elephant", "elephants", "mammoth", "mammoths", "jumbo", "rhino", "rhinos", "hippo", "hippos", "hippopotamus"],
    c: { ...QUAD.c, body: "#9aa3ad", belly: "#aab2bb", accent: "#7d8590", nose: "#5d6670", iris: "#1b1b1f", horn: "#fbf6e9", inner: "#e8b0b8", nail: "#e8e2d4" },
    body: { ...QUAD.body, len: 5.6, w: 3.6, h: 3.4, y: 4.2, round: 0.8, belly: 0.3 },
    neck: { len: 0.3, w: 2.4, tilt: 0.2, at: 0.46, up: 0.2 },
    head: { ...QUAD.head, w: 2.6, h: 2.8, d: 2.0, snout: null, jaw: 0.3 },
    eyes: { s: 0.42, x: 0.62, y: 0.12, pupil: "round" },
    ears: { kind: "elephant", s: 1.0, x: 0.55 },
    legs: { ...QUAD.legs, w: 1.25, foot: { w: 1.4, l: 1.4, h: 0.4 }, kind: "column", x: 0.3 },
    tail: { kind: "tuft", len: 1.8, w: 0.25, up: -1.0, segs: 2, tip: "#2a2a30" },
    horns: { kind: "tusk", s: 1 },
    extra: { trunk: 4.4 },
    variants: {
      elephant: {},
      mammoth: { tex: "shag", c: { body: "#7a4e2e", belly: "#6a4228", accent: "#4a3020", nose: "#4a3020" }, horns: { kind: "mammoth", s: 1.3 }, ears: { kind: "elephant", s: 0.55, x: 0.55 }, body: { hump: 0.8 } },
      circus: { c: { blanket: "#c0392b", trim: "#f1c40f" }, extra: { trunk: 4.4, blanket: true } },
      hippo: { tex: "skin", c: { body: "#8a7a92", belly: "#d8a8b0", accent: "#6a5a72", nose: "#5a4a62" }, horns: null, ears: { kind: "round", s: 0.5, x: 0.6 }, extra: { trunk: 0 }, head: { w: 2.8, h: 2.2, d: 2.4, snout: { len: 1.4, w: 2.6, h: 1.8, y: -0.3 }, jaw: 0.5, teeth: true }, body: { len: 6.0, w: 3.8, h: 3.0, y: 2.6, round: 1.1 }, legs: { kind: "column", w: 1.1 } },
      rhino: { tex: "plate", c: { body: "#8e9196", belly: "#a2a5aa", accent: "#6e7176", nose: "#5e6166", horn: "#d8d0bc" }, horns: { kind: "rhino", s: 1 }, ears: { kind: "point", s: 0.6, x: 0.6 }, extra: { trunk: 0 }, head: { w: 2.0, h: 2.0, d: 2.4, snout: { len: 1.4, w: 1.6, h: 1.4, y: -0.3 }, jaw: 0.3 }, body: { y: 3.2 } },
    },
  },
  eagle: {
    ...BIRD, life: 0.9, giant: 60, aliases: ["eagle", "eagles", "hawk", "hawks", "falcon", "falcons", "vulture", "vultures", "owl", "owls", "kite", "condor", "griffin", "phoenix"],
    c: { ...BIRD.c, body: "#4a321e", belly: "#4a321e", accent: "#2e1e12", wing: "#3e2a1a", tip: "#1e140c", nose: "#ffc020", leg: "#ffc020", head: "#ffffff", iris: "#f2d02a" },
    body: { ...BIRD.body, len: 3.4, w: 2.8, h: 3.6, y: 3.6, tilt: 0.55 },
    head: { w: 1.9, h: 1.7, d: 1.9 },
    beak: { kind: "hook", len: 1.1, w: 0.7, h: 0.95 },
    eyes: { s: 0.42, x: 0.72, y: 0.2, pupil: "round", brow: true },
    wings: { len: 6.4, w: 2.4, fingers: 5 },
    legs: { ...BIRD.legs, len: 1.4, w: 0.42, foot: { w: 1.1, l: 1.1, h: 0.16 }, talons: "#1e1e22", feathered: true },
    tail: { kind: "fan", len: 2.0, w: 1.7, color: "#ffffff" },
    pattern: {},
    variants: {
      bald: {},
      golden: { c: { body: "#6a4422", belly: "#6a4422", wing: "#5a3a1e", head: "#c8902e", tip: "#2a1a0c", nose: "#3a3a40" }, tail: { kind: "fan", len: 2.0, w: 1.7, color: "#4a301a" } },
      hawk: { c: { body: "#8a5a32", belly: "#f2e6d0", wing: "#7a4a28", head: "#8a5a32", tip: "#3a2414" }, pattern: { breast: "#8a5a32" }, tail: { kind: "fan", len: 1.8, w: 1.5, color: "#c0582a" } },
      owl: { c: { body: "#8a6a4a", belly: "#e8d6b0", wing: "#7a5a3a", head: "#8a6a4a", tip: "#4a3424", nose: "#e8a83a", iris: "#ffb020" }, head: { w: 2.6, h: 2.2, d: 2.0, owl: true, disc: "#f0e2c4" }, eyes: { s: 0.75, x: 0.5, y: 0.1, pupil: "round", brow: false }, beak: { kind: "hook", len: 0.5, w: 0.45, h: 0.6 }, neck: { len: 0.1, w: 1.8, tilt: 1.4 }, ears: { kind: "tufts" }, pattern: { breast: "#7a5a3a" } },
    },
  },
};

// ------------------------------------------------------------------------------------------------ lookups
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export function mergeSpec(a, b) { const o = { ...a }; for (const [k, v] of Object.entries(b ?? {})) o[k] = isObj(v) && isObj(a?.[k]) ? mergeSpec(a[k], v) : v; return o; }

/** the variant words that pick a variant: "geese" -> goose, "orca" -> orca, "puppy" -> default */
const VARIANT_WORDS = {
  mouse: { rat: "rat", rats: "rat", hamster: "hamster", hamsters: "hamster", gerbil: "hamster", gerbils: "hamster", guinea: "hamster" },
  dog: { beagle: "beagle", dalmatian: "dalmatian", husky: "husky", snowdog: "husky", snowdogs: "husky", labrador: "black_lab", lab: "black_lab" },
  cat: { tabby: "orange" },
  pigeon: { dove: "dove", doves: "dove", crow: "crow", crows: "crow", raven: "crow", ravens: "crow", sparrow: "sparrow", sparrows: "sparrow" },
  frog: { toad: "toad", toads: "toad" },
  yeti: { bigfoot: "bigfoot", sasquatch: "bigfoot", ape: "gorilla", apes: "gorilla", gorilla: "gorilla", gorillas: "gorilla" },
  goat: { sheep: "sheep", lamb: "sheep", lambs: "sheep", ram: "ram", rams: "ram" },
  whale: { orca: "orca", orcas: "orca", humpback: "humpback", dolphin: "dolphin", dolphins: "dolphin" },
  duck: { goose: "goose", geese: "goose", gosling: "duckling", swan: "goose", swans: "goose", duckling: "duckling", ducklings: "duckling" },
  fish: { clownfish: "clownfish", piranha: "piranha" },
  ant: { beetle: "beetle", beetles: "beetle", bug: "beetle", bugs: "beetle" },
  bear: { panda: "panda", pandas: "panda", polar_bear: "polar" },
  turtle: { tortoise: "tortoise", tortoises: "tortoise", sea_turtle: "sea" },
  octopus: { squid: "squid", squids: "squid", kraken: "kraken", krakens: "kraken", cuttlefish: "squid" },
  deer: { moose: "moose", elk: "moose", reindeer: "reindeer", caribou: "reindeer", doe: "doe", fawn: "fawn" },
  chicken: { rooster: "rooster", roosters: "rooster", cockerel: "rooster", chick: "chick", chicks: "chick", hen: "brown", hens: "brown" },
  parrot: { cockatoo: "cockatoo", parakeet: "green", parakeets: "green", budgie: "green" },
  shark: { hammerhead: "hammerhead", megalodon: "great_white", jaws: "great_white" },
  pig: { boar: "boar", boars: "boar", warthog: "boar", hog: "boar", hogs: "boar" },
  mole: { badger: "badger", badgers: "badger" },
  seagull: { puffin: "puffin" },
  snail: { slug: "slug", slugs: "slug" },
  snake: { python: "python", boa: "python", anaconda: "python", cobra: "cobra", worm: "worm", worms: "worm" },
  seal: { walrus: "walrus", walruses: "walrus", sea_lion: "sea_lion", sealion: "sea_lion", otter: "sea_lion", otters: "sea_lion" },
  cow: { bull: "bull", bulls: "bull", ox: "bull", oxen: "bull", bison: "highland", buffalo: "highland", yak: "highland" },
  rabbit: { hare: "brown", hares: "brown", jackrabbit: "brown" },
  wolf: { fox: "fox", foxes: "fox" },
  elephant: { mammoth: "mammoth", mammoths: "mammoth", hippo: "hippo", hippos: "hippo", hippopotamus: "hippo", rhino: "rhino", rhinos: "rhino" },
  eagle: { hawk: "hawk", hawks: "hawk", falcon: "hawk", falcons: "hawk", owl: "owl", owls: "owl" },
};
let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  INDEX = new Map();
  for (const [sp, s] of Object.entries(ANIMAL_SPECIES)) {
    INDEX.set(sp, sp);
    for (const a of s.aliases ?? []) if (!INDEX.has(a)) INDEX.set(a, sp);
    for (const v of Object.keys(s.variants ?? {})) if (!INDEX.has(v)) INDEX.set(v, sp);
  }
  return INDEX;
}
/** a species word (any alias, plural, "giant_turtle", "the big snail") -> { species, variant } or null */
export function resolveAnimal(word) {
  if (word && typeof word === "object") return word.species && ANIMAL_SPECIES[word.species] ? { species: word.species, variant: word.variant ?? defaultVariant(word.species) } : null;
  const raw = String(word ?? "").toLowerCase().trim();
  if (!raw) return null;
  const idx = index();
  const tryWord = (w) => {
    if (!w) return null;
    const sp = idx.get(w) ?? idx.get(w.replace(/(es|s)$/, "")) ?? idx.get(w.replace(/s$/, ""));
    if (!sp) return null;
    const vw = VARIANT_WORDS[sp] ?? {};
    const v = vw[w] ?? vw[w.replace(/s$/, "")] ?? (ANIMAL_SPECIES[sp].variants?.[w] ? w : null);
    return { species: sp, variant: v ?? defaultVariant(sp) };
  };
  const whole = tryWord(raw.replace(/[\s-]+/g, "_"));
  if (whole) return whole;
  const ws = raw.replace(/[^a-z_ ]/g, " ").split(/[_ ]+/).filter(Boolean);
  for (const w of [...ws].reverse()) { const r = tryWord(w); if (r) return r; }
  return null;
}
export const defaultVariant = (sp) => Object.keys(ANIMAL_SPECIES[sp]?.variants ?? {})[0] ?? null;
/** the merged spec of a species + variant (a fresh object) */
export function specFor(species, variant) {
  const s = ANIMAL_SPECIES[species];
  if (!s) throw new Error(`specFor: unknown species "${species}"`);
  const v = variant ?? defaultVariant(species);
  const { variants, aliases, ...base } = s;
  return { ...mergeSpec(base, variants?.[v] ?? {}), species, variant: v };
}
export const ANIMAL_NAMES = Object.freeze(Object.keys(ANIMAL_SPECIES));
/** every action a species animates (its plan's list) */
export const actionsOf = (species) => ANIMAL_PLANS[ANIMAL_SPECIES[species]?.plan] ?? [];
