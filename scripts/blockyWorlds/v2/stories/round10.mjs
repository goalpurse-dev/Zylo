// Round 10's story ("The Light in Its Pocket", reference/blocky-worlds/round10/story/script.json), converted BY HAND to
// v2 shot rows on Stage A (plan step 2): the same 22 lines, our cast, one row per shot.
const me = (spot, face, o = {}) => ({ id: "me", spot, face, facing: o.facing ?? "street", pose: o.pose, holds: o.holds, hands: o.hands });
const gp = (spot, face, o = {}) => ({ id: "grandpa", spot, face, facing: o.facing ?? "street", pose: o.pose, holds: o.holds, hands: o.hands });
const AT_CR = { to: "cr_path_end" };

export const STORY = {
  title: "The Light in Its Pocket",
  lines: [
    "In this town, every time your porch light goes out, a monster comes.",
    "It's a tall shadow called Max, and it hates light.",
    "The only way to stay safe? Keep your light on all night.",
    "My grandpa's the man who fixes every porch light.",
    "Every evening, he walks down the street with a bucket of bulbs.",
    "Click! Every light on the street comes on.",
    "Then he got to our porch.",
    "He looked in his bucket. Empty!",
    "Fzzt! Our porch light went out.",
    "Max climbed out of the drain.",
    "It walked straight up to our porch.",
    "Grandpa stepped in front of me, shaking.",
    "Then it whispered,",
    "Your light's out.",
    "I took out my flashlight. Click!",
    "But I didn't shine it at Max.",
    "Keep your light on all night.",
    "So I slipped the flashlight into Max's pocket.",
    "Now Max had a light on!",
    "Whoosh! It ran away from itself.",
    "In the morning, Grandpa brought new bulbs and hugged me.",
    "But at night, there's a glowing shadow running round town.",
  ].map((text) => ({ text })),
  cast: { me: { name: "Me", spec: "me" }, grandpa: { name: "Grandpa", spec: "grandpa" }, creature: { name: "Max", spec: "shadow" } },
  aliases: { me: ["I", "me"], grandpa: ["grandpa", "he"], creature: ["max", "monster", "shadow", "it"], porch_light: ["porch light"], bucket: ["bucket", "bulbs"], flashlight: ["flashlight"], drain: ["drain"] },
  props: { bucket: { kind: "bucket", hands: "R" }, flashlight: { kind: "flashlight", hands: "R" } },
  rule: { object: "porch_light", start: "on", change_words: ["out", "off", "on", "lit", "comes", "came"] },
  rows: [
    // the hook (0-1.5 s): the narrator, big and turned to us, the porch light on beside him
    { line: 1, scene: 0, time: "sunset", cam: { type: "medium", subject: ["me"], with: ["porch_light"] }, people: [me("porch_right", "neutral")], props: { porch_light: "on" } },
    { line: 1, scene: 0, time: "sunset", cam: { type: "insert", subject: ["porch_light"] }, people: [], props: { porch_light: "on" } },
    { line: 1, scene: 9, time: "night", cam: { type: "eyes", subject: ["creature"] }, people: [], creature: { spot: "cr_across", face: "shadow_stare", facing: { to: "house" } } },
    { line: 2, scene: 9, time: "night", cam: { type: "wide", subject: ["creature"] }, people: [], creature: { spot: "cr_fence", face: "shadow_narrow", facing: { to: "house" } } },
    // our street at sunset
    { line: 3, scene: 1, time: "sunset", cam: { type: "close", subject: ["me"] }, people: [me("pave_mid", "thinking")], props: { porch_light: "on" } },
    { line: 4, scene: 1, time: "sunset", cam: { type: "medium", subject: ["grandpa"] }, people: [gp("pave_left", "happy", { holds: "bucket" })], props: { porch_light: "on" } },
    { line: 5, scene: 1, time: "sunset", cam: { type: "side", subject: ["grandpa"] }, people: [gp("pave_far", "happy", { pose: "walk", holds: "bucket", facing: { to: "house" } })] },
    { line: 6, scene: 1, time: "sunset", cam: { type: "wide", subject: ["me"] }, people: [me("pave_mid", "big_smile"), gp("pave_far", "happy", { holds: "bucket" })], props: { porch_light: "on", street_lamps: true } },
    // the porch at night
    { line: 7, scene: 2, time: "night", cam: { type: "two", subject: ["grandpa", "me"] }, people: [gp("step", "happy", { holds: "bucket", facing: { to: "me" } }), me("porch_left", "happy", { facing: { to: "grandpa" } })], props: { porch_light: "on" } },
    { line: 8, scene: 2, time: "night", cam: { type: "close", subject: ["grandpa"] }, people: [gp("step", "terrified", { pose: "hold_box", holds: "bucket", hands: "both", facing: { to: "porch_left" } })], props: { porch_light: "on", bucket: "off" } },
    { line: 9, scene: 2, time: "night", cam: { type: "insert", subject: ["porch_light"] }, people: [], props: { porch_light: "off" } },
    { line: 9, scene: 2, time: "night", cam: { type: "close", subject: ["me"] }, people: [me("porch_left", "scared", { facing: { to: "step" } })], props: { porch_light: "off" } },
    { line: 10, scene: 3, time: "night", cam: { type: "wide", subject: ["creature"] }, people: [], creature: { spot: "cr_road_south", face: "shadow_stare", facing: { to: "house" } }, props: { drain: true } },
    { line: 11, scene: 2, time: "night", cam: { type: "wide", subject: ["creature"] }, people: [], creature: { spot: "cr_path_end", face: "shadow_narrow", facing: { to: "house" } }, props: { porch_light: "off" } },
    { line: 12, scene: 2, time: "night", touch: true, cam: { type: "medium", subject: ["grandpa", "me"] }, people: [gp("porch_front", "scared", { pose: "shield", facing: AT_CR }), me("porch_door", "scared", { facing: AT_CR })], props: { porch_light: "off" } },
    { line: 13, scene: 2, time: "night", cam: { type: "eyes", subject: ["creature"] }, people: [], creature: { spot: "cr_path_end", face: "shadow_narrow", facing: { to: "house" } } },
    { line: 14, scene: 2, time: "night", touch: true, cam: { type: "medium", subject: ["grandpa", "me"], side: "left" }, people: [gp("porch_front", "worried", { pose: "shield", facing: AT_CR }), me("porch_door", "terrified", { facing: AT_CR })], props: { porch_light: "off" } },
    { line: 15, scene: 2, time: "night", cam: { type: "close", subject: ["me"] }, people: [me("porch_door", "angry", { holds: "flashlight", pose: "hold_stick", facing: AT_CR })], props: { porch_light: "off" } },
    { line: 16, scene: 2, time: "night", cam: { type: "medium", subject: ["me", "creature"] }, people: [me("porch_door", "thinking", { holds: "flashlight", facing: AT_CR })], creature: { spot: "cr_path_end", face: "shadow_narrow", facing: { to: "house" } } },
    { line: 17, scene: 2, time: "night", cam: { type: "medium", subject: ["me"], side: "left" }, people: [me("porch_door", "angry", { holds: "flashlight", facing: AT_CR })] },
    { line: 18, scene: 2, time: "night", cam: { type: "medium", subject: ["me"], side: "right" }, people: [me("porch_door", "smug", { pose: "reach", holds: "flashlight", facing: AT_CR })] },
    { line: 18, scene: 2, time: "night", cam: { type: "medium", subject: ["creature"], side: "left" }, people: [], creature: { spot: "cr_path_end", face: "shadow_wide", facing: { to: "house" }, holds: "flashlight" } },
    { line: 19, scene: 2, time: "night", cam: { type: "wide", subject: ["creature"], side: "right" }, people: [], creature: { spot: "cr_path_end", face: "shadow_wide", pose: "lean", facing: { to: "house" }, holds: "flashlight" } },
    { line: 20, scene: 4, time: "night", cam: { type: "wide", subject: ["creature"] }, people: [], creature: { spot: "cr_road_far", face: "shadow_wide", pose: "run", facing: "street", holds: "flashlight" } },
    // the porch in the morning: the hug, seen three-quarter
    { line: 21, scene: 5, time: "morning", touch: true, cam: { type: "two", subject: ["grandpa", "me"] }, people: [gp("porch_hug", "big_smile", { pose: "hug", holds: "bucket", facing: { to: "me" } }), me("porch_left", "big_smile", { pose: "hug", facing: { to: "grandpa" } })] },
    { line: 22, scene: 4, time: "night", cam: { type: "wide", subject: ["creature"] }, people: [], creature: { spot: "cr_across", face: "shadow_wide", pose: "run", facing: "street", holds: "flashlight" } },
  ],
};
