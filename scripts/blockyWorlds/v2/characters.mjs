// IN THIS TOWN v2: THE CHARACTER LIBRARY (data) = THE FIXED CAST. Every person is a spec on ONE base (char_v2.py ZChar):
// the same body build, face system (12 expressions, blinks), finish and checks. A spec picks proportions, hair, outfit
// and colours; the COLOURS (skin, hair, outfit) are switchable per story (recolor) so customers' families can look
// different. Our own designs; no logos except the main character's Zyvo badge.
//   body: thigh / shin / upper_arm / fore_arm / torso_w / torso_d / torso_h in local units; head = the head's scale
//   height: world units on the town stage (a kid 3.04 = the measured stage scale)

const KID_H = 3.04;
export const CHARACTERS = {
  me: {
    id: "me", default_face: "neutral", role: "the narrator (main character, every story)", fixed: true,
    height: KID_H, outfit: "hoodie", hair: "swoop", hair_top: 0.7, badge_ok: true, sleeves: "long",
    body: { thigh: 0.95, shin: 0.8, upper_arm: 0.85, fore_arm: 0.75, torso_w: 1.9, torso_d: 1.0, torso_h: 1.8, head: 1.14 },
    colors: { skin: "#F3C9A1", skin_dark: "#E2AC84", eyes: "#1B1410", brows: "#3A2216", hair: "#4A2C1C", hair_light: "#9A6440",
      top: "#FF7A1A", top_dark: "#DE5E0A", trim: "#FFF3D6", legs: "#2D4A7A", legs_dark: "#21385E", shoe: "#F4F2EC", sole: "#CFC8BC" },
  },
  sister: {
    id: "sister", default_face: "smug", role: "the little sister (cheeky)", fixed: true,
    height: KID_H * 0.75, outfit: "dungarees", hair: "pigtails", hair_top: 0.55, badge_ok: false, sleeves: "short",
    body: { thigh: 0.72, shin: 0.6, upper_arm: 0.66, fore_arm: 0.58, torso_w: 1.7, torso_d: 0.95, torso_h: 1.45, head: 1.2 },
    colors: { skin: "#F6D2B0", skin_dark: "#E8B38E", eyes: "#1B1410", brows: "#7A3418", hair: "#B5562A", hair_light: "#E8935A", accent: "#3FC1FF",
      top: "#FFE14D", top_dark: "#E8C52E", trim: "#FFFFFF", legs: "#E0368A", legs_dark: "#B32068", shoe: "#3FC1FF", sole: "#FFFFFF" },
  },
  mom: {
    id: "mom", default_face: "happy", role: "Mom (warm)", fixed: true,
    height: 3.35, outfit: "cardigan", hair: "bob", hair_top: 0.4, badge_ok: false, sleeves: "long",
    body: { thigh: 1.2, shin: 1.05, upper_arm: 1.0, fore_arm: 0.92, torso_w: 2.0, torso_d: 1.05, torso_h: 2.25, head: 1.02 },
    colors: { skin: "#E9B48C", skin_dark: "#D4966C", eyes: "#1B1410", brows: "#5A2A18", hair: "#7A3B22", hair_light: "#C27A50", under: "#FFF4E2",
      top: "#E8505B", top_dark: "#C73945", trim: "#FFF4E2", legs: "#3A4466", legs_dark: "#2C3450", shoe: "#8A4A2A", sole: "#3A2A20" },
  },
  dad: {
    id: "dad", default_face: "happy", role: "Dad (rebuilt at the kid's quality)", fixed: true,
    height: 3.5, outfit: "shirt", hair: "short", hair_top: 0.38, mustache: true, badge_ok: false, sleeves: "rolled",
    body: { thigh: 1.3, shin: 1.12, upper_arm: 1.1, fore_arm: 1.0, torso_w: 2.15, torso_d: 1.12, torso_h: 2.4, head: 1.02 },
    colors: { skin: "#C68642", skin_dark: "#A86C32", eyes: "#1B1410", brows: "#1E1A18", hair: "#1E1A18", hair_light: "#5A4E44",
      top: "#2FA37A", top_dark: "#23805F", trim: "#F2F2EE", legs: "#B59B72", legs_dark: "#8F7A58", shoe: "#5A3A24", sole: "#2A2A2A" },
  },
  mayor: {
    id: "mayor", default_face: "smug", role: "the Mayor (older, pompous: any 'town rule' scene)", fixed: true,
    height: 3.6, outfit: "suit", hair: "grey_neat", hair_top: 1.4, hat: "top", mustache: true, badge_ok: false, sleeves: "long",
    body: { thigh: 1.22, shin: 1.08, upper_arm: 1.08, fore_arm: 1.0, torso_w: 2.35, torso_d: 1.4, torso_h: 2.45, head: 1.0 },
    colors: { skin: "#F0C2A0", skin_dark: "#D9A27E", eyes: "#1B1410", brows: "#D6D6D6", hair: "#B4B4B4", hair_light: "#EDEDED", under: "#F6F4EE",
      accent: "#C8283C", sash: "#C8283C", top: "#2B3550", top_dark: "#1E2538", trim: "#D9B24A", legs: "#2B3550", legs_dark: "#1E2538", shoe: "#18181C", sole: "#0E0E10" },
  },
  grandpa: {
    id: "grandpa", default_face: "happy", role: "Grandpa (kind, a little slow)", fixed: true,
    height: 3.4, outfit: "cardigan", hair: "short", hair_top: 0.34, mustache: true, badge_ok: false, sleeves: "long",
    body: { thigh: 1.2, shin: 1.05, upper_arm: 1.05, fore_arm: 0.98, torso_w: 2.2, torso_d: 1.25, torso_h: 2.3, head: 1.02 },
    colors: { skin: "#E7B48E", skin_dark: "#CC9670", eyes: "#1B1410", brows: "#E2E2E2", hair: "#C9C9C9", hair_light: "#F2F2F2", under: "#EDE6D6",
      top: "#8A5A3C", top_dark: "#6E4530", trim: "#E8D9B0", legs: "#4E5A6A", legs_dark: "#3C4654", shoe: "#3A2A20", sole: "#1E1A18" },
  },
  // ---- the entities (kid-safe: spooky, never gory)
  shadow: {
    id: "shadow", default_face: "shadow_stare", role: "the Shadow: tall, thin, pure black in every light, two glowing eyes, long arms", fixed: true, entity: true,
    height: 8.5, mode: "shadow", outfit: "plain", hair: "none", hair_top: 0.0, badge_ok: false, sleeves: "long", head_shape: [0.78, 0.8, 1.3],
    body: { thigh: 2.3, shin: 2.2, upper_arm: 2.4, fore_arm: 2.4, torso_w: 1.15, torso_d: 0.62, torso_h: 2.9, head: 0.9 },
    colors: { skin: "#000000", skin_dark: "#000000", eyes: "#FFF0A0", brows: "#000000", hair: "#000000", hair_light: "#000000",
      top: "#000000", top_dark: "#000000", trim: "#000000", legs: "#000000", legs_dark: "#000000", shoe: "#000000", sole: "#000000" },
  },
  critter: {
    id: "critter", role: "the little creature: knee-high, round, fuzzy, big eyes; cute or grumpy", fixed: true, entity: true, kind: "critter",
    height: 0.95,
    colors: { fur: "#3CC6B8", fur_dark: "#2A9A8F", belly: "#C8F4EC" },
  },
};
// the townsfolk (background people): the base with other colours and hair
export const NEIGHBOURS = {
  nb1: { ...CHARACTERS.mom, id: "nb1", role: "a neighbour", fixed: true, hair: "bun", default_face: "happy", colors: { ...CHARACTERS.mom.colors, top: "#4C9BE8", top_dark: "#3478BF", hair: "#2A2A2A", hair_light: "#5A5A5A", legs: "#5A5A66", skin: "#8D5524", skin_dark: "#74441C" } },
  nb2: { ...CHARACTERS.dad, id: "nb2", role: "a neighbour", fixed: true, mustache: false, default_face: "neutral", colors: { ...CHARACTERS.dad.colors, top: "#E8B23C", top_dark: "#C4921E", hair: "#7A4A26", legs: "#3A3F5C", skin: "#F0C8A0", skin_dark: "#D8AA82" } },
  nb3: { ...CHARACTERS.grandpa, id: "nb3", role: "an old neighbour", fixed: true, default_face: "happy", colors: { ...CHARACTERS.grandpa.colors, top: "#6E8C4A", top_dark: "#56703A", skin: "#C68642", skin_dark: "#A86C32" } },
  nb4: { ...CHARACTERS.sister, id: "nb4", role: "a neighbour kid", fixed: true, height: 2.7, default_face: "happy", colors: { ...CHARACTERS.sister.colors, top: "#8BD3A0", legs: "#3C6FD8", legs_dark: "#2C55A8", hair: "#1E1A18", hair_light: "#4A4038", skin: "#E0AC69", skin_dark: "#C89054" } },
};
export const CRITTER_COLOURS = {
  teal: { fur: "#3CC6B8", fur_dark: "#2A9A8F", belly: "#C8F4EC" },
  pink: { fur: "#F07FB8", fur_dark: "#C9568F", belly: "#FFE0EF" },
  mustard: { fur: "#E3B23C", fur_dark: "#B98A22", belly: "#FFF0C4" },
};

// ---- THE MIMIC: a wrong copy of ANY cast member: the same body and outfit, the colours slightly off (skin greyed and
// cooled, clothes a little dull), a smile too wide, eyes that never blink, the head tilted too far (pose "tilt")
const mix = (a, b, t) => "#" + [0, 2, 4].map((i) => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - t) + parseInt(b.slice(1 + i, 3 + i), 16) * t).toString(16).padStart(2, "0")).join("");
export function mimicOf(spec) {
  const c = { ...spec.colors };
  for (const k of Object.keys(c)) {
    if (!/^#[0-9a-f]{6}$/i.test(c[k])) continue;
    c[k] = /^skin/.test(k) ? mix(c[k], "#B4C2B0", 0.32) : /^eyes$/.test(k) ? "#0A0A0A" : mix(c[k], "#8C8C96", 0.22);
  }
  const { missing_button, ...base } = spec; void missing_button;   // the copy has every button (the tell)
  return { ...base, id: `mimic_${spec.id}`, role: `the Mimic copying ${spec.id}`, mode: "mimic", badge_ok: false, colors: c };
}
/** a story's own look for a cast member (customers' families): skin / hair / outfit colours swapped, the build kept */
export function recolor(spec, colors = {}) {
  return { ...spec, colors: { ...spec.colors, ...colors } };
}

export const EXPRESSIONS = ["neutral", "happy", "big_smile", "worried", "scared", "terrified", "sad", "crying", "angry", "sleepy", "smug", "thinking"];
export const POSES = ["stand", "walk", "run", "sit", "point", "hold"];
export const SHADOW_STATES = ["stand", "lean", "reach", "peek", "eyes_only", "narrow"];
export const MIMIC_STATES = ["mimic_smile", "mimic_stare", "tilt", "mimic_copy", "too_still", "next_to_the_real_one"];
export const CRITTER_FACES = ["happy", "angry", "scared", "sleepy", "big_smile", "sad"];

// ---- NIGHT BUILD 2026-11-25: ROLES, CLASSMATES, MORE NEIGHBOURS, A BABY, THE VILLAIN MAYOR (one readable piece each,
// worn by things_v2.py zv_wear), plus stretch variants for the stretch effect. Same base, our own colours.
const C = CHARACTERS, rc = (b, id, role, colors, more = {}) => ({ ...b, id, role, fixed: true, badge_ok: false, ...more, colors: { ...b.colors, ...colors } });
export const EXTRA_SPECS = {
  teacher: rc(C.mom, "teacher", "the teacher (glasses, cardigan)", { top: "#6A994E", top_dark: "#55803D", hair: "#5A3A28" }, { hair: "bun", wear: ["glasses"], default_face: "neutral" }),
  shopkeeper: rc(C.dad, "shopkeeper", "the shopkeeper (green apron)", { top: "#F2F2EE", top_dark: "#D8D8D2", skin: "#E0AC69", skin_dark: "#C89054" }, { wear: ["apron"], mustache: false }),
  police: rc(C.dad, "police", "the police officer (navy cap with a badge)", { top: "#2B3F73", top_dark: "#1E2E58", legs: "#1E2A4A", legs_dark: "#151E36", skin: "#8D5524", skin_dark: "#74441C" }, { wear: ["police_cap"], mustache: false, default_face: "neutral" }),
  doctor: rc(C.mom, "doctor", "the doctor (white coat, stethoscope)", { top: "#F4F6FA", top_dark: "#D9DEE6", under: "#8FC3E3", hair: "#1E1A18", hair_light: "#4A4038" }, { hair: "bob", wear: ["stethoscope"], default_face: "neutral" }),
  bus_driver: rc(C.dad, "bus_driver", "the bus driver (blue cap)", { top: "#7FB3D9", top_dark: "#5E94BE", legs: "#2B3550" }, { wear: ["driver_cap"] }),
  chef: rc(C.dad, "chef", "the chef (tall white hat)", { top: "#FFFFFF", top_dark: "#E4E4E0", skin: "#F0C8A0", skin_dark: "#D8AA82" }, { wear: ["chef_hat"], mustache: true }),
  cm1: rc(C.me, "cm1", "a classmate (green hoodie)", { top: "#3FA34D", top_dark: "#2E8040", hair: "#1E1A18", hair_light: "#4A4038", skin: "#C68642", skin_dark: "#A86C32" }, { hair: "short", default_face: "happy" }),
  cm2: rc(C.sister, "cm2", "a classmate (blue dungarees, pigtails)", { top: "#FFFFFF", legs: "#3C6FD8", legs_dark: "#2C55A8", hair: "#E8C25A", hair_light: "#F4DC8A" }, { height: 2.95, default_face: "happy" }),
  cm3: rc(C.me, "cm3", "a classmate (purple hoodie)", { top: "#8E5CD9", top_dark: "#7244B8", hair: "#B5562A", hair_light: "#E8935A", skin: "#F6D2B0" }, { hair: "bob", default_face: "neutral" }),
  cm4: rc(C.me, "cm4", "a classmate (yellow hoodie, bun)", { top: "#F2C14E", top_dark: "#D9A52E", hair: "#2A2A2A", hair_light: "#5A5A5A", skin: "#8D5524", skin_dark: "#74441C" }, { hair: "bun", height: 2.9, default_face: "smug" }),
  nb5: rc(C.mom, "nb5", "a neighbour", { top: "#C58AF9", top_dark: "#A56AD9", hair: "#E8E2D8", hair_light: "#FFFFFF" }, { hair: "short", default_face: "happy" }),
  nb6: rc(C.grandpa, "nb6", "an old neighbour", { top: "#4C8FD6", top_dark: "#3474B8", skin: "#8D5524", skin_dark: "#74441C" }, { default_face: "neutral" }),
  baby: rc(C.sister, "baby", "a baby (pink bonnet)", { top: "#F6C7D8", top_dark: "#E8A8C0", legs: "#F6C7D8", legs_dark: "#E8A8C0", hair: "#C27A50" }, { height: 1.75, hair: "short", wear: ["bonnet"], default_face: "happy",
    body: { ...C.sister.body, thigh: 0.55, shin: 0.45, torso_h: 1.25, head: 1.38 } }),
  villain_mayor: rc(C.mayor, "villain_mayor", "the Mayor as the villain (dark coat, sharp grin, the same top hat)", { top: "#16161E", top_dark: "#0C0C12", legs: "#16161E", legs_dark: "#0C0C12", sash: "#7A0F1E", accent: "#7A0F1E", trim: "#8C1E2A" }, { default_face: "smug", wear: ["bow_tie"] }),
  stretch_legs: { ...C.me, id: "stretch_legs", role: "the stretch effect: very long legs", stretch: { legs: 2.4 } },
  stretch_neck: { ...C.me, id: "stretch_neck", role: "the stretch effect: a very long neck", stretch: { neck: 2.8 } },
  stretch_arms: { ...C.me, id: "stretch_arms", role: "the stretch effect: very long arms", stretch: { arms: 2.2 } },
};
export const ANIMALS = { dog: "a dog (tan, floppy ears)", cat: "a cat (grey, yellow eyes)", bird: "a bird (blue, orange beak)" };
export const ENTITIES = {
  long_one: "the Long One: a person stretched far too tall (14), too many joints, a pale blank face",
  crawler: "the Crawler: low on all fours, spider-bent limbs, its head turned upside down",
  watcher: "the Watcher: a heavy body covered in eyes that all open at once",
  hollow: "the Hollow: a townsperson with an empty dark face",
  many_arms: "the Many-Arms: a shape in a doorway, eight arms reaching round the frame",
  rain_thing: "the Rain Thing: a figure of dripping black water with a puddle",
  ghost: "a ghost: a floating white sheet with dark eyes",
  robot: "a robot: boxy metal, a red visor",
  slime: "a slime: a big green glossy blob with eyes",
  giant_critter: "the little creature, giant (7x)",
};
