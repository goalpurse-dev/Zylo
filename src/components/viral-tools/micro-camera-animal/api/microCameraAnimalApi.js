import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";
import { getAllowedVideoModels as sharedGetAllowedVideoModels, PLAN_LABELS } from "../../../../lib/planGating";

export { PLAN_LABELS };

/* ── Constants ──────────────────────────────────────────────── */
export const IMAGE_TOOL_KEY = "image:fruit-v2";
export const IMAGE_CREDITS  = 2;
export const REF_CREDITS    = 2;
export const IMAGE_W        = 768;
export const IMAGE_H        = 1376;

// V2 unchanged (Seedance 1.5 Pro, no audio — Micro Camera doesn't need
// sound). V3/V4 use MiniMax Hailuo 2.3 Fast instead of Vidu: MiniMax is
// cheaper and this template only ever needs ONE reference image with no
// audio, which is exactly what MiniMax is good for (Vidu is reserved for
// tools that need audio). Video credits tuned so the BLENDED per-scene
// margin (1 image @ 2cr/$0.010423 + 1 video clip) lands at ~50%.
export const VIDEO_MODELS = {
  "micro-v2": {
    id: "micro-v2",
    label: "V2",
    tag: "Cheapest",
    description: "480p — NO AUDIO GENERATED",
    toolKey: "video:seedance15pro",
    width: 496,
    height: 864,
    duration: 5,
    credits: 6,             // unchanged — measured $0.0607656/5s
    withSound: false,
  },
  "micro-v3": {
    id: "micro-v3",
    label: "V3",
    tag: "Premium",
    description: "720p — NO AUDIO GENERATED",
    toolKey: "video:microcamminimax720",
    width: 768,
    height: 1366,
    duration: 6,
    credits: 18,            // measured $0.19/6s → blended per-scene margin ~49.9%
    withSound: false,
  },
  "micro-v4": {
    id: "micro-v4",
    label: "V4",
    tag: "Professional",
    description: "1080p — NO AUDIO GENERATED",
    toolKey: "video:microcamminimax1080",
    width: 1080,
    height: 1920,
    duration: 6,
    credits: 32,            // measured $0.33/6s → blended per-scene margin ~49.9%
    withSound: false,
  },
};
export const DEFAULT_VIDEO_MODEL = "micro-v2";

// Plan gating — which video models each plan tier can use.
export const VIDEO_MODEL_MIN_PLAN = {
  "micro-v2": "starter",
  "micro-v3": "pro",
  "micro-v4": "generative",
};

export function getAllowedVideoModels(planCode) {
  return sharedGetAllowedVideoModels(planCode, VIDEO_MODEL_MIN_PLAN);
}

export const LENGTH_OPTIONS = [
  { value: "15s", label: "15 sec", scenes: 3 },
  { value: "30s", label: "30 sec", scenes: 6 },
];

export function calcCredits(sceneCount, videoModelId = DEFAULT_VIDEO_MODEL) {
  const videoCredits = (VIDEO_MODELS[videoModelId] ?? VIDEO_MODELS[DEFAULT_VIDEO_MODEL]).credits;
  return REF_CREDITS + sceneCount * (IMAGE_CREDITS + videoCredits);
}

// Which prompt indices to use per scene count.
// 3 scenes: mounting → entering → deep core (skip middle, land on the payoff)
// 6 scenes: full arc 0–5
export function getSceneIndices(sceneCount) {
  if (sceneCount === 3) return [0, 1, 5];
  return [0, 1, 2, 3, 4, 5];
}

/* ────────────────────────────────────────────────────────────────
   Animal profile database — 6 image prompts + 6 video prompts each
   Scene order (same for all animals):
     0 = External: researcher mounting camera beside burrow entrance
     1 = Entering: POV descending into tunnel, daylight fading, LED activates
     2 = Main passage: busy traffic tunnel / gallery
     3 = Nursery / brood / egg chamber
     4 = Food storage / specialized chamber
     5 = Deepest core — queen / sleeping nest / deepest retreat
──────────────────────────────────────────────────────────────── */
const PROFILES = {
  ant: {
    label: "ant",
    bodyMount: "upper thorax",
    referencePrompt:
      "Ultra-realistic macro scientific photograph of a single worker ant specimen, " +
      "close-up side-profile on sandy soil, highly detailed chitin exoskeleton, six legs, " +
      "antennae, segmented body, natural daylight, 8k reference, no camera equipment",
    imagePrompts: [
      // 0 – external mounting beside burrow entrance
      "Ultra-realistic macro wildlife research photograph of a field researcher beside a small ant nest entrance, " +
      "carefully securing a tiny micro-camera onto the upper thorax of a worker ant using a miniature visible research harness, " +
      "the camera aligned exactly with the direction of the ant's head, true scale realism, the ant anatomically accurate and sharply detailed, " +
      "the researcher's fingers visible gently handling the ant, natural sandy soil, tiny pebbles, dry grass fragments, " +
      "and nest debris around the entrance hole, natural daylight, raw scientific field documentation, " +
      "no fantasy, no cartoon look, no stylization, no cinematic lighting, highly realistic insect textures, authentic biological research setup",
      // 1 – POV entering tunnel, LED activating
      "Ultra-realistic macro biological research image of the same worker ant already inside its underground nest tunnel, " +
      "a tiny micro-camera visibly strapped to the ant's upper thorax with a secure miniature research harness, " +
      "the camera facing exactly the same direction as the ant's head, true scale realism, rough compact soil tunnel walls, " +
      "loose dirt grains, slight moisture specks, several other worker ants visible deeper in the tunnel, " +
      "the only light source is a tiny harsh LED mounted beside the lens, creating a narrow uneven beam with darkness outside it, " +
      "raw scientific field documentation, no fantasy, no stylization, no cinematic look, highly realistic insect anatomy and underground nest textures",
      // 2 – main traffic tunnel
      "Ultra-realistic macro scientific nature documentary image of a worker ant inside a busy underground ant colony traffic tunnel, " +
      "micro-camera on upper thorax, many worker ants moving in both directions, antennae touching, food fragments being carried, " +
      "branching side tunnels visible, compact soil walls, organic debris, only the narrow harsh mounted LED as light, " +
      "darkness outside the beam, authentic research footage, highly realistic insect biology",
      // 3 – nursery / brood chamber
      "Ultra-realistic macro scientific image of a worker ant entering an underground brood nursery chamber, " +
      "micro-camera on upper thorax, crowded chamber filled with white eggs, larvae, and pupae, " +
      "many worker ants tending brood piles and carrying larvae, rough earthen walls, several chamber exits visible, " +
      "only a tiny harsh LED as light, darkness beyond the beam, highly realistic insect biology",
      // 4 – food storage chamber
      "Ultra-realistic macro scientific image of a worker ant inside an underground food storage chamber, " +
      "micro-camera on upper thorax, stored seed fragments, insect remains, plant matter, and organic debris arranged naturally, " +
      "worker ants arriving and leaving, tunnel branches opening from chamber walls, compact damp soil, moisture glints, " +
      "only the mounted LED as light, darkness outside the narrow beam, authentic research documentation",
      // 5 – deep core / queen chamber
      "Ultra-realistic macro scientific research image of a worker ant reaching the deep colony core, " +
      "micro-camera on upper thorax, larger living chamber with dense worker activity, brood clusters, tunnel branches, organic debris, " +
      "a partially visible queen ant deeper in the chamber surrounded by attendants, " +
      "realistic underground darkness outside the narrow harsh LED beam, authentic underground biology",
    ],
    videoPrompts: [
      // 0
      "Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of a worker ant beside its nest entrance " +
      "while a field researcher carefully finishes attaching a tiny micro-camera to the ant's upper thorax using a miniature visible research harness, " +
      "the camera clearly facing the same direction as the ant's head, true scale realism, natural daylight, " +
      "highly realistic sandy soil, pebbles, dry grass fragments, and nest debris around the hole, " +
      "the ant is released and immediately starts walking toward the nest entrance, then by the end of the 5-second scene it begins descending underground into the hole, " +
      "realistic insect movement, no fantasy, no stylization, no cinematic look, raw biological research documentation, " +
      "no music, no narration, no dialogue, only natural sounds of tiny movement, soil contact, and subtle field ambience",
      // 1
      "Ultra-realistic mounted micro-camera POV from the same worker ant entering its underground nest, " +
      "the camera is physically strapped to the ant's upper thorax with a tiny visible research harness and faces exactly where the ant faces, " +
      "5 to 10 percent of the ant's body visible at the bottom of frame, 5-second raw scientific field footage, " +
      "the ant continues descending into the tunnel, daylight quickly fading, a tiny LED mounted beside the lens activates and becomes the only light source, " +
      "narrow harsh uneven beam, darkness outside the beam, rough soil walls, loose dirt grains, tiny collisions against tunnel edges, " +
      "slight shaking and body-driven movement only, no stabilization, no floating camera, no third-person view, " +
      "only natural sounds of footsteps, scratching, and soil friction",
      // 2
      "Ultra-realistic mounted micro-camera POV from the same worker ant moving through a busy main tunnel inside the colony, " +
      "the camera remains physically strapped to the upper thorax with a visible miniature harness and points exactly where the ant points, " +
      "5 to 10 percent of the ant visible at the bottom of frame, 5-second raw scientific field footage, " +
      "the ant moves through a crowded passage with many worker ants going in both directions, antennae touching, some ants carrying food fragments, " +
      "branching side tunnels visible, compact soil textures, organic debris, small jolts when the ant brushes the walls or bumps other ants, " +
      "the only illumination is the tiny harsh LED beside the lens, darkness outside the narrow beam, " +
      "no music, no narration, no dialogue, only natural colony sounds, foot taps, scraping, and soft impacts",
      // 3
      "Ultra-realistic mounted micro-camera POV from the same worker ant entering a brood nursery chamber, " +
      "the camera remains securely mounted on the ant's upper thorax and moves only as the ant moves, " +
      "5 to 10 percent of the ant's back visible at the bottom of frame, 5-second raw scientific field footage, " +
      "the tiny LED beside the lens is the only light source, casting a narrow harsh beam across a crowded chamber filled with eggs, larvae, and pupae, " +
      "many worker ants actively tending brood piles and carrying larvae, rough earthen walls, several chamber exits, " +
      "slight body vibrations and tiny jolts from uneven ground and contact with other ants, realistic darkness beyond the light beam, " +
      "no fantasy, no stylization, no music, no narration, no dialogue, only natural sounds of tiny footsteps, scratching, and colony movement",
      // 4
      "Ultra-realistic mounted micro-camera POV from the same worker ant moving into a lower food storage chamber, " +
      "the camera is still physically strapped to the ant's upper thorax with the visible miniature harness, facing exactly in the same direction as the ant's head, " +
      "5 to 10 percent of the ant's body visible at the bottom edge of the frame, 5-second raw scientific field footage, " +
      "unstable body-driven movement, no stabilization, the tiny mounted LED is the only light source, " +
      "revealing stored seed fragments, insect remains, plant matter, and organic debris arranged naturally in the chamber, " +
      "worker ants arriving and leaving continuously, tunnel branches opening from the chamber walls, " +
      "compact damp soil with occasional moisture glints, brief collisions causing tiny jolts, darkness outside the harsh light beam, " +
      "no music, no narration, no dialogue, only natural scraping, soil friction, and dense colony activity",
      // 5
      "Ultra-realistic mounted micro-camera POV from the same worker ant reaching the deep colony core, " +
      "the camera remains firmly mounted to the ant's upper thorax and never detaches or behaves like a floating camera, " +
      "5 to 10 percent of the ant's body visible at the bottom of frame, 5-second raw scientific field footage, " +
      "motion controlled entirely by the ant's walking and turning, the tiny LED beside the lens is the only light source, " +
      "revealing a larger living chamber with dense worker activity, brood clusters, tunnel branches, organic debris, " +
      "and a partially visible queen ant deeper in the chamber surrounded by attendants, " +
      "realistic underground darkness outside the narrow harsh beam, slight jolts from ant movement and close contact with soil and other ants, " +
      "no music, no narration, no dialogue, only natural sounds of footsteps, scratching, soft impacts, and continuous colony movement",
    ],
  },

  worm: {
    label: "worm",
    bodyMount: "upper body segment",
    referencePrompt:
      "Ultra-realistic macro photograph of an earthworm on moist natural soil, close-up view, " +
      "accurate pink-brown segmented body, glistening moisture, detailed annuli rings, natural outdoor lighting, 8k reference",
    imagePrompts: [
      // 0 – external mounting on surface
      "Ultra-realistic macro wildlife research photograph of a field researcher on moist garden soil, " +
      "carefully attaching a tiny micro-camera to the upper segment of an earthworm using a miniature visible research harness, " +
      "researcher's fingers gently handling the worm, damp dark earth, decaying leaves, small pebbles, natural daylight, " +
      "a small soil entrance hole visible nearby, raw scientific field documentation, no stylization, authentic biological research setup",
      // 1 – POV entering soil, LED activating
      "Ultra-realistic macro biological research image of the same earthworm already inside a moist soil tunnel, " +
      "tiny micro-camera strapped to upper body segment, camera facing the direction of travel, " +
      "damp compressed soil walls, organic debris, root fragments crossing the tunnel, slight moisture glistening on walls, " +
      "only a tiny harsh LED as the light source, narrow uneven beam, darkness outside it, raw research documentation",
      // 2 – main humus passage
      "Ultra-realistic macro scientific image of an earthworm moving through a rich underground humus passage, " +
      "micro-camera on upper segment, dense dark organic soil, root threads, decaying matter, " +
      "other worm channels branching off, moisture on walls, only narrow LED light, authentic underground biology",
      // 3 – root zone chamber
      "Ultra-realistic macro scientific image of an earthworm navigating a dense root zone underground, " +
      "micro-camera on upper segment, thick interwoven root network crossing the space, compressed moist earth, " +
      "small soil organisms visible, only LED illumination, darkness beyond the beam, highly realistic soil biology",
      // 4 – organic matter deposit
      "Ultra-realistic macro scientific image of an earthworm inside a deep organic deposit layer underground, " +
      "micro-camera on upper segment, dense decomposed matter, leaf fragments, fungal threads, moisture pockets, " +
      "compact dark soil walls, only tiny LED as light, raw research footage aesthetic",
      // 5 – deepest mineral layer
      "Ultra-realistic macro scientific image of an earthworm in the deepest soil layer, micro-camera on upper segment, " +
      "dense mineral soil, clay-like particles, moisture on tunnel walls, complete darkness except narrow harsh LED, " +
      "highly compressed earth, authentic deep underground research documentation",
    ],
    videoPrompts: [
      // 0
      "Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of an earthworm on moist garden soil " +
      "while a field researcher carefully finishes attaching a tiny micro-camera to the worm's upper body segment using a miniature visible research harness, " +
      "researcher's fingers gently visible, damp dark earth, decaying leaves, natural daylight, " +
      "the worm is released and begins moving toward a small soil opening, by the end of the shot it starts pushing into the ground, " +
      "realistic worm movement, no stylization, raw biological research documentation, no music, no narration, only natural field sounds",
      // 1
      "Ultra-realistic mounted micro-camera POV from the same earthworm entering its soil tunnel, " +
      "camera strapped to upper body segment facing the direction of travel, 5 to 10 percent of worm body visible at bottom of frame, " +
      "5-second raw scientific footage, surface disappearing as worm descends, soil pressing in from all sides, " +
      "tiny LED activating as only light source, narrow beam revealing moist dark soil walls, root fragments, organic debris, " +
      "slow undulating movement, no stabilization, only natural sounds of soil compression, moisture, and movement",
      // 2
      "Ultra-realistic mounted micro-camera POV from the same earthworm moving through a rich humus passage underground, " +
      "camera on upper segment, 5 to 10 percent of worm at bottom of frame, 5-second raw footage, " +
      "dense dark organic soil, root fragments passing by, moisture glistening on walls, branching worm channels visible, " +
      "only tiny LED illumination, darkness beyond the beam, slow body-driven movement, only sounds of soil and organic matter",
      // 3
      "Ultra-realistic mounted micro-camera POV from the same earthworm navigating a root zone underground, " +
      "camera on upper segment, thick roots crossing the path, compressed moist soil, small organisms visible, " +
      "only LED light, 5 to 10 percent of worm visible at bottom, 5-second raw footage, only sounds of roots and earth",
      // 4
      "Ultra-realistic mounted micro-camera POV from the same earthworm pushing through a deep organic deposit layer, " +
      "camera on upper segment, dense decomposed matter, fungal threads, moisture pockets, compact dark soil, " +
      "only tiny harsh LED, very slow movement, 5 to 10 percent of worm at bottom, 5-second raw footage, only deep soil sounds",
      // 5
      "Ultra-realistic mounted micro-camera POV from the same earthworm in the deepest mineral soil layer, " +
      "camera on upper segment, dense clay-like soil walls, complete darkness except narrow LED, very slow movement, " +
      "mineral particles visible, moisture on walls, 5 to 10 percent of worm at bottom, 5-second raw scientific footage, only deep earth sounds",
    ],
  },

  beetle: {
    label: "beetle",
    bodyMount: "pronotum",
    referencePrompt:
      "Ultra-realistic macro photograph of a ground beetle on natural soil, close-up top-down view, " +
      "detailed iridescent exoskeleton, six legs, antennae, natural lighting, 8k reference",
    imagePrompts: [
      // 0 – external mounting beside burrow entrance
      "Ultra-realistic macro wildlife research photograph of a field researcher beside a small ground beetle burrow entrance in dry soil, " +
      "carefully securing a tiny micro-camera onto the pronotum of a ground beetle using a miniature visible research harness, " +
      "researcher's fingers gently handling the beetle, natural sandy earth, small pebbles, dry debris, dark burrow opening nearby, " +
      "natural daylight, raw scientific field documentation, no stylization, authentic biological research setup",
      // 1 – POV entering burrow, LED activating
      "Ultra-realistic macro biological research image of the same ground beetle already inside its underground burrow, " +
      "tiny micro-camera strapped to pronotum, camera facing the direction of travel, sandy soil walls, pebble fragments embedded in earth, " +
      "the only light source a tiny harsh LED beside the lens, narrow uneven beam, darkness outside it, " +
      "raw scientific documentation, no stylization, highly realistic insect anatomy",
      // 2 – main burrow passage
      "Ultra-realistic macro scientific image of a ground beetle moving through its main underground burrow passage, " +
      "micro-camera on pronotum, compressed dark soil walls, decomposing organic matter, other insects visible, " +
      "branching tunnels, only narrow LED light, authentic research footage",
      // 3 – egg / nursery chamber
      "Ultra-realistic macro scientific image of a ground beetle inside an underground egg chamber, " +
      "micro-camera on pronotum, beetle eggs arranged in soil, organic matter lining the walls, moisture pockets, " +
      "only a tiny harsh LED as light, darkness beyond the beam, highly realistic insect biology",
      // 4 – food storage / prey cache
      "Ultra-realistic macro scientific image of a ground beetle in a deep underground food cache chamber, " +
      "micro-camera on pronotum, stored prey remains and organic debris arranged naturally, " +
      "compact moist soil walls, tunnel branches, only LED illumination, authentic underground documentation",
      // 5 – deepest retreat
      "Ultra-realistic macro scientific image of a ground beetle in the deepest part of its underground burrow, " +
      "micro-camera on pronotum, very compact mineral soil, near total darkness except narrow harsh LED, " +
      "raw research footage aesthetic, highly realistic insect and soil textures",
    ],
    videoPrompts: [
      // 0
      "Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of a ground beetle on dry soil beside its burrow entrance " +
      "while a field researcher carefully finishes attaching a tiny micro-camera to the beetle's pronotum using a miniature visible research harness, " +
      "natural daylight, sandy soil, pebbles, dark burrow opening visible, " +
      "the beetle is released and immediately begins walking toward the burrow, by the end of the shot it starts descending underground, " +
      "realistic insect movement, raw biological research documentation, no music, no narration, only natural field sounds",
      // 1
      "Ultra-realistic mounted micro-camera POV from the same ground beetle entering its underground burrow, " +
      "camera strapped to pronotum facing the direction of travel, 5 to 10 percent of beetle body at bottom of frame, " +
      "5-second raw scientific footage, daylight rapidly cutting off, tiny LED activating as only light source, " +
      "narrow beam revealing sandy soil walls, pebble fragments, scurrying leg movement, slight jolts from uneven ground, " +
      "no stabilization, no floating camera, only sounds of legs scratching soil and soil friction",
      // 2
      "Ultra-realistic mounted micro-camera POV from the same ground beetle moving through its main underground burrow passage, " +
      "camera on pronotum, 5 to 10 percent of beetle at bottom of frame, 5-second raw footage, " +
      "compressed soil walls, other insects encountered, organic debris, branching tunnels, only narrow LED beam, only sounds of scraping",
      // 3
      "Ultra-realistic mounted micro-camera POV from the same ground beetle entering an underground egg chamber, " +
      "camera on pronotum, beetle eggs visible in soil, organic lining, moisture pockets, only harsh LED, " +
      "5 to 10 percent of beetle at bottom, 5-second raw footage, careful movement, only soft underground sounds",
      // 4
      "Ultra-realistic mounted micro-camera POV from the same ground beetle inside a deep food cache chamber, " +
      "camera on pronotum, stored prey and organic debris, compact moist soil walls, tunnel branches, " +
      "only LED light, darkness beyond beam, 5 to 10 percent of beetle at bottom, 5-second raw footage, only underground ambient sounds",
      // 5
      "Ultra-realistic mounted micro-camera POV from the same ground beetle in the deepest part of its burrow, " +
      "camera on pronotum, dense compact soil, near total darkness except narrow LED, very slow movement, " +
      "5 to 10 percent of beetle at bottom, 5-second raw scientific footage, only deep underground sounds",
    ],
  },

  termite: {
    label: "termite",
    bodyMount: "thorax",
    referencePrompt:
      "Ultra-realistic macro photograph of a worker termite on wood surface, close-up view, " +
      "pale translucent body, six legs, antennae, detailed texture, natural lighting, 8k reference",
    imagePrompts: [
      // 0 – external mounting on wood beside gallery entrance
      "Ultra-realistic macro wildlife research photograph of a field researcher beside a wood gallery entrance, " +
      "carefully securing a tiny micro-camera onto the thorax of a worker termite using a miniature visible research harness, " +
      "researcher's fingers gently handling the termite, wood grain surface, mud tube construction nearby, " +
      "dark gallery opening visible, natural lighting, raw scientific field documentation, no stylization",
      // 1 – POV entering wood gallery, LED activating
      "Ultra-realistic macro biological research image of the same worker termite already inside a wood gallery tunnel, " +
      "tiny micro-camera strapped to thorax, camera facing direction of travel, cellulose fiber walls, " +
      "many termites visible deeper in the gallery, only a tiny harsh LED as the light source, narrow beam, darkness outside, " +
      "raw scientific documentation, highly realistic insect anatomy and wood texture",
      // 2 – main colony gallery (busy traffic)
      "Ultra-realistic macro scientific image of a worker termite inside a busy colony gallery, " +
      "micro-camera on thorax, many workers moving in both directions, food fragments, wood cell walls, mud construction, " +
      "only LED light, darkness beyond narrow beam, authentic research documentation",
      // 3 – nursery / brood gallery
      "Ultra-realistic macro scientific image of a worker termite in a nursery gallery deep inside the colony, " +
      "micro-camera on thorax, pale termite eggs and larvae visible, nurse workers tending them, mud walls, " +
      "only tiny harsh LED, darkness beyond beam, highly realistic termite biology",
      // 4 – food processing gallery
      "Ultra-realistic macro scientific image of a worker termite in a deep food processing gallery, " +
      "micro-camera on thorax, chewed cellulose fragments, fungal comb structures, mud walls, " +
      "many workers present, only LED illumination, authentic underground colony documentation",
      // 5 – royal chamber with queen
      "Ultra-realistic macro scientific image of a worker termite reaching the royal chamber deep in the colony, " +
      "micro-camera on thorax, a massive queen termite visible surrounded by many attendants, " +
      "mud-sealed royal chamber walls, intense worker activity, only harsh narrow LED, authentic biology",
    ],
    videoPrompts: [
      // 0
      "Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of a worker termite on a wood surface beside a gallery entrance " +
      "while a field researcher carefully finishes attaching a tiny micro-camera to the termite's thorax using a miniature visible research harness, " +
      "wood grain, mud tubes, dark gallery opening visible, natural lighting, " +
      "the termite is released and immediately begins moving toward the gallery entrance, by the end of the shot it starts entering underground, " +
      "raw biological research documentation, no music, no narration, only natural sounds of wood and movement",
      // 1
      "Ultra-realistic mounted micro-camera POV from the same worker termite entering its wood gallery tunnel, " +
      "camera strapped to thorax facing direction of travel, 5 to 10 percent of termite body at bottom of frame, " +
      "5-second raw scientific footage, cellulose fiber walls, many termites passing in both directions, " +
      "light cutting off, tiny LED activating as only light source, narrow beam, no stabilization, " +
      "only sounds of mandibles, tiny footsteps, and movement through cellulose",
      // 2
      "Ultra-realistic mounted micro-camera POV from the same worker termite in a busy colony gallery, " +
      "camera on thorax, many workers in both directions, food fragments, wood cell walls, " +
      "only LED beam, 5 to 10 percent of termite at bottom, 5-second raw footage, only colony sounds",
      // 3
      "Ultra-realistic mounted micro-camera POV from the same worker termite entering a nursery gallery, " +
      "camera on thorax, pale eggs and larvae visible, nurse workers tending them, mud walls, only LED, " +
      "5 to 10 percent of termite at bottom, 5-second raw footage, only soft colony movement sounds",
      // 4
      "Ultra-realistic mounted micro-camera POV from the same worker termite in a food processing gallery, " +
      "camera on thorax, chewed cellulose, fungal comb structures, mud walls, many workers, only harsh LED, " +
      "5 to 10 percent of termite at bottom, 5-second raw footage, only colony sounds",
      // 5
      "Ultra-realistic mounted micro-camera POV from the same worker termite reaching the royal chamber, " +
      "camera on thorax, massive queen visible, attendants everywhere, mud-sealed walls, only LED spotlight, " +
      "5 to 10 percent of termite at bottom, 5-second raw footage, only deep colony sounds",
    ],
  },

  spider: {
    label: "spider",
    bodyMount: "cephalothorax",
    referencePrompt:
      "Ultra-realistic macro photograph of a burrowing spider on dark soil, close-up side view, " +
      "eight legs, multiple eyes, body hair texture, natural lighting, 8k reference",
    imagePrompts: [
      // 0 – external mounting beside silk burrow entrance
      "Ultra-realistic macro wildlife research photograph of a field researcher beside a burrowing spider's silk-lined burrow entrance, " +
      "carefully securing a tiny micro-camera onto the spider's cephalothorax using a miniature visible research harness, " +
      "researcher's fingers gently visible, dark moist soil, silk lining visible around the opening, natural lighting, " +
      "raw scientific field documentation, no stylization, authentic biological research setup",
      // 1 – POV inside silk burrow, LED activating
      "Ultra-realistic macro biological research image of the same burrowing spider already inside its silk burrow, " +
      "tiny micro-camera strapped to cephalothorax, camera facing direction of travel, silk-lined walls catching light, " +
      "only a tiny harsh LED beside the lens as the light source, narrow beam, darkness outside it, " +
      "tight burrow space, raw scientific documentation, highly realistic spider anatomy and silk texture",
      // 2 – main silk chamber
      "Ultra-realistic macro scientific image of a burrowing spider in its main silk-lined underground chamber, " +
      "micro-camera on cephalothorax, silk walls illuminated by LED, prey remains visible, " +
      "total darkness beyond narrow beam, eight legs visible at frame edges, authentic research footage",
      // 3 – egg chamber
      "Ultra-realistic macro scientific image of a burrowing spider in its underground egg chamber, " +
      "micro-camera on cephalothorax, large silk egg sac visible, careful protective movement, " +
      "dense silk walls, only tiny harsh LED illumination, darkness beyond the beam, highly realistic spider biology",
      // 4 – deeper retreat / molt chamber
      "Ultra-realistic macro scientific image of a burrowing spider in a deeper section of its burrow, " +
      "micro-camera on cephalothorax, old molt skin visible along walls, dense silk wrapping, compact soil, " +
      "only narrow LED light, authentic underground documentation",
      // 5 – deepest retreat
      "Ultra-realistic macro scientific image of a burrowing spider in the deepest retreat of its burrow, " +
      "micro-camera on cephalothorax, dense silk everywhere, molt remains, total darkness except narrow harsh LED, " +
      "raw scientific footage aesthetic, highly realistic spider and silk textures",
    ],
    videoPrompts: [
      // 0
      "Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of a burrowing spider beside its silk-lined burrow entrance " +
      "while a field researcher carefully finishes attaching a tiny micro-camera to the spider's cephalothorax using a miniature visible research harness, " +
      "dark moist soil, silk entrance visible, natural lighting, eight legs visible, " +
      "the spider is released and immediately begins moving toward the burrow opening, by the end of the shot it starts descending inside, " +
      "raw biological research documentation, no music, no narration, only natural outdoor sounds",
      // 1
      "Ultra-realistic mounted micro-camera POV from the same burrowing spider descending into its silk burrow, " +
      "camera strapped to cephalothorax facing direction of travel, 5 to 10 percent of spider body at bottom of frame, " +
      "5-second raw scientific footage, silk walls catching tiny LED beam, surface cut off, tight burrow space, " +
      "no stabilization, no floating camera, only sounds of silk rustling and leg movement",
      // 2
      "Ultra-realistic mounted micro-camera POV from the same spider moving through its main silk chamber, " +
      "camera on cephalothorax, silk walls illuminated by LED, prey remains visible, legs at frame edges, " +
      "darkness beyond beam, 5 to 10 percent of spider at bottom, 5-second raw footage, only silk movement sounds",
      // 3
      "Ultra-realistic mounted micro-camera POV from the same spider entering its egg chamber, " +
      "camera on cephalothorax, large silk egg sac filling frame, careful slow movement, only LED illumination, " +
      "5 to 10 percent of spider at bottom, 5-second raw footage, only soft silk sounds",
      // 4
      "Ultra-realistic mounted micro-camera POV from the same spider in a deeper molt chamber, " +
      "camera on cephalothorax, old molt skin along walls, dense silk, compact soil, only harsh LED, " +
      "5 to 10 percent of spider at bottom, 5-second raw footage, only deep underground silence",
      // 5
      "Ultra-realistic mounted micro-camera POV from the same spider in the deepest retreat of its burrow, " +
      "camera on cephalothorax, dense silk everywhere, molt remains, total darkness except narrow LED, " +
      "very slow movement, 5 to 10 percent of spider at bottom, 5-second raw scientific footage, only deep underground silence",
    ],
  },

  cricket: {
    label: "cricket",
    bodyMount: "thorax",
    referencePrompt:
      "Ultra-realistic macro photograph of a field cricket on sandy soil, close-up side view, " +
      "long antennae, powerful hind legs, wing detail, natural outdoor lighting, 8k reference",
    imagePrompts: [
      // 0 – external mounting beside burrow entrance
      "Ultra-realistic macro wildlife research photograph of a field researcher beside a field cricket burrow entrance in sandy soil, " +
      "carefully securing a tiny micro-camera onto the cricket's thorax using a miniature visible research harness, " +
      "researcher's fingers gently handling the cricket, natural sandy soil, dry grass threads, dark burrow opening nearby, " +
      "natural daylight, long antennae visible, raw scientific field documentation, no stylization",
      // 1 – POV entering burrow, LED activating
      "Ultra-realistic macro biological research image of the same field cricket already inside its underground burrow, " +
      "tiny micro-camera strapped to thorax, camera facing direction of travel, sandy soil walls, compact earth, " +
      "only a tiny harsh LED beside the lens as the light source, narrow uneven beam, darkness outside it, " +
      "long antennae visible at frame edges, raw scientific documentation",
      // 2 – main living chamber
      "Ultra-realistic macro scientific image of a field cricket inside its main underground living chamber, " +
      "micro-camera on thorax, compact soil walls, root fragments, organic debris, only LED light, " +
      "antennae sweeping the chamber, authentic underground insect documentation",
      // 3 – escape tunnel network
      "Ultra-realistic macro scientific image of a field cricket navigating underground escape tunnel branches, " +
      "micro-camera on thorax, multiple forking passages, compact sandy soil, only narrow LED, " +
      "darkness beyond the beam, raw research footage",
      // 4 – egg-laying chamber
      "Ultra-realistic macro scientific image of a field cricket in an underground egg-laying chamber, " +
      "micro-camera on thorax, eggs deposited in soil visible, damp compact walls, only tiny harsh LED, " +
      "authentic insect biology documentation",
      // 5 – deepest retreat
      "Ultra-realistic macro scientific image of a field cricket in the deepest part of its underground burrow, " +
      "micro-camera on thorax, dense compact sandy soil, near total darkness except narrow harsh LED, " +
      "raw research footage aesthetic, highly realistic cricket and soil textures",
    ],
    videoPrompts: [
      // 0
      "Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of a field cricket on sandy soil beside its burrow entrance " +
      "while a field researcher carefully finishes attaching a tiny micro-camera to the cricket's thorax using a miniature visible research harness, " +
      "natural daylight, sandy soil, dry grass threads, dark burrow opening visible, long antennae sweeping, " +
      "the cricket is released and immediately begins moving toward the burrow, by the end of the shot it starts descending underground, " +
      "raw biological research documentation, no music, no narration, only natural outdoor sounds",
      // 1
      "Ultra-realistic mounted micro-camera POV from the same field cricket entering its underground burrow, " +
      "camera strapped to thorax facing direction of travel, 5 to 10 percent of cricket body at bottom of frame, " +
      "5-second raw scientific footage, daylight cutting off, tiny LED activating as only light source, " +
      "sandy soil walls, compact earth, powerful leg movement, slight jolts, no stabilization, " +
      "only sounds of legs scratching soil and soil friction",
      // 2
      "Ultra-realistic mounted micro-camera POV from the same field cricket inside its main living chamber underground, " +
      "camera on thorax, compact soil walls, root fragments, antennae visible at frame edges, only LED, " +
      "5 to 10 percent of cricket at bottom, 5-second raw footage, only underground ambient sounds",
      // 3
      "Ultra-realistic mounted micro-camera POV from the same cricket navigating escape tunnel branches, " +
      "camera on thorax, forking passages, compact sandy soil, only harsh LED, darkness outside beam, " +
      "5 to 10 percent of cricket at bottom, 5-second raw footage, only sounds of legs on soil",
      // 4
      "Ultra-realistic mounted micro-camera POV from the same cricket in its egg-laying chamber, " +
      "camera on thorax, eggs visible in soil, damp walls, only LED, careful movement, " +
      "5 to 10 percent of cricket at bottom, 5-second raw footage, only quiet underground sounds",
      // 5
      "Ultra-realistic mounted micro-camera POV from the same cricket in the deepest part of its burrow, " +
      "camera on thorax, dense compact soil, total darkness beyond LED, 5 to 10 percent of cricket at bottom, " +
      "5-second raw scientific footage, only deep earth sounds",
    ],
  },

  mole: {
    label: "mole",
    bodyMount: "back",
    referencePrompt:
      "Ultra-realistic macro photograph of a common mole emerging from soil, close-up view, " +
      "velvety dark fur, tiny eyes, broad digging forepaws, pink nose, natural lighting, 8k reference",
    imagePrompts: [
      // 0 – external mounting beside tunnel entrance
      "Ultra-realistic macro wildlife research photograph of a field researcher beside a mole tunnel entrance in a grassy field, " +
      "carefully securing a tiny micro-camera onto the mole's back using a miniature visible research harness, " +
      "researcher's fingers gently handling the mole, fresh displaced soil mound, grass roots, overcast daylight, " +
      "dark tunnel opening nearby, raw scientific field documentation, no stylization, authentic biological research setup",
      // 1 – POV entering tunnel, LED activating
      "Ultra-realistic macro biological research image of the same mole already inside its underground tunnel, " +
      "tiny micro-camera strapped to its back, camera facing direction of travel, compact dark earth walls, " +
      "roots and pebbles embedded in soil, only a tiny harsh LED beside the lens as light source, narrow beam, " +
      "velvety fur compressed against soil walls, darkness outside the beam, raw scientific documentation",
      // 2 – active digging passage
      "Ultra-realistic macro scientific image of a mole actively digging through its underground tunnel, " +
      "micro-camera on back, broad forepaws pushing soil forward, compact dark earth walls, earthworms encountered, " +
      "only LED illumination, darkness beyond the beam, authentic mole biology",
      // 3 – food cache nest
      "Ultra-realistic macro scientific image of a mole inside its deep underground food cache nest, " +
      "micro-camera on back, cached earthworms and grubs arranged naturally in the chamber, " +
      "grass nest lining, compact soil walls, only tiny LED as light, darkness beyond beam",
      // 4 – deeper tunnel network
      "Ultra-realistic macro scientific image of a mole navigating a deeper section of its underground tunnel network, " +
      "micro-camera on back, branching tunnel passages, root fragments, moist compact soil, " +
      "only narrow LED illumination, authentic underground mole documentation",
      // 5 – sleeping nest chamber
      "Ultra-realistic macro scientific image of a mole in its deepest sleeping nest chamber underground, " +
      "micro-camera on back, soft grass nest material lining the chamber, very compact soil walls, " +
      "only narrow harsh LED, near total darkness, raw research footage aesthetic",
    ],
    videoPrompts: [
      // 0
      "Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of a mole beside its tunnel entrance in a grassy field " +
      "while a field researcher carefully finishes attaching a tiny micro-camera to the mole's back using a miniature visible research harness, " +
      "overcast daylight, fresh soil mound, grass roots, dark tunnel opening visible, velvety fur visible, " +
      "the mole is released and immediately begins moving toward the tunnel entrance, by the end of the shot it starts descending underground, " +
      "raw biological research documentation, no music, no narration, only natural field sounds",
      // 1
      "Ultra-realistic mounted micro-camera POV from the same mole entering its underground tunnel, " +
      "camera strapped to back facing direction of travel, 5 to 10 percent of mole body at bottom of frame, " +
      "5-second raw scientific footage, earth pressing in from all sides, tiny LED activating as only light source, " +
      "roots passing by, powerful digging forepaw motion, no stabilization, " +
      "only sounds of digging, soil displacement, and body pressing through earth",
      // 2
      "Ultra-realistic mounted micro-camera POV from the same mole actively digging through its underground tunnel, " +
      "camera on back, forepaws visible pushing soil, earthworms encountered in walls, compact dark soil, only LED, " +
      "5 to 10 percent of mole at bottom, 5-second raw footage, only sounds of digging and earth movement",
      // 3
      "Ultra-realistic mounted micro-camera POV from the same mole entering its food cache nest, " +
      "camera on back, cached worms and grubs visible in chamber, grass lining, only LED, " +
      "5 to 10 percent of mole at bottom, 5-second raw footage, only soft underground sounds",
      // 4
      "Ultra-realistic mounted micro-camera POV from the same mole navigating a deeper tunnel section, " +
      "camera on back, branching passages, root fragments, moist compact soil, only harsh LED, " +
      "5 to 10 percent of mole at bottom, 5-second raw footage, only underground movement sounds",
      // 5
      "Ultra-realistic mounted micro-camera POV from the same mole in its deep sleeping nest chamber, " +
      "camera on back, soft grass nest material visible, compact soil walls, near darkness, only narrow LED, " +
      "5 to 10 percent of mole at bottom, 5-second raw footage, only deep underground silence",
    ],
  },
};

/* ── Keyword aliases ────────────────────────────────────────── */
const ALIASES = {
  "fire ant": "ant",  "carpenter ant": "ant",  "black ant": "ant",
  "red ant": "ant",   "bullet ant": "ant",      "queen ant": "ant",
  "earthworm": "worm", "earth worm": "worm",    "night crawler": "worm",
  "nightcrawler": "worm", "garden worm": "worm",
  "ground beetle": "beetle", "dung beetle": "beetle", "stag beetle": "beetle",
  "termite worker": "termite", "white ant": "termite",
  "trapdoor spider": "spider", "wolf spider": "spider", "tarantula": "spider",
  "mole cricket": "cricket",  "field cricket": "cricket",
  "common mole": "mole", "star-nosed mole": "mole",
};

/* ── Animal detection ───────────────────────────────────────── */
export function detectAnimal(input) {
  const norm = (input || "").toLowerCase().trim();

  if (PROFILES[norm]) return { ...PROFILES[norm] };

  for (const [alias, key] of Object.entries(ALIASES)) {
    if (norm === alias || norm.includes(alias)) return { ...PROFILES[key] };
  }

  for (const key of Object.keys(PROFILES)) {
    if (norm.includes(key) || key.includes(norm)) return { ...PROFILES[key] };
  }

  // Generic fallback — same 6-scene arc as named animals
  const a = norm || "insect";
  return {
    label: a,
    bodyMount: "body",
    referencePrompt:
      `Ultra-realistic macro scientific photograph of a ${a} specimen, close-up side-profile view, ` +
      `accurate anatomy and natural coloring, natural habitat surface, 8k reference sheet, no camera equipment`,
    imagePrompts: [
      // 0 – external mounting
      `Ultra-realistic macro wildlife research photograph of a field researcher beside the natural entrance of a ${a}'s underground home, ` +
      `carefully securing a tiny micro-camera onto the ${a}'s body using a miniature visible research harness, ` +
      `researcher's fingers gently visible, natural soil, pebbles, organic debris, dark entrance hole visible nearby, ` +
      `natural daylight, raw scientific field documentation, no stylization, authentic biological research setup`,
      // 1 – POV entering, LED activating
      `Ultra-realistic macro biological research image of the same ${a} already inside its underground tunnel or burrow, ` +
      `tiny micro-camera strapped to its body with a miniature harness, camera facing the direction of travel, ` +
      `compact soil or substrate walls, the only light source a tiny harsh LED beside the lens, narrow uneven beam, ` +
      `darkness outside it, raw scientific documentation, highly realistic animal anatomy`,
      // 2 – main passage
      `Ultra-realistic macro scientific image of the same ${a} moving through its main underground passage, ` +
      `micro-camera on body, compact walls, natural underground debris, branching paths visible, ` +
      `only narrow LED illumination, darkness beyond the beam, authentic research documentation`,
      // 3 – nursery / specialized chamber
      `Ultra-realistic macro scientific image of the same ${a} inside a specialized underground chamber, ` +
      `micro-camera on body, eggs or larvae or stored materials visible, natural underground textures, ` +
      `only tiny harsh LED as light, darkness beyond beam, highly realistic biology`,
      // 4 – deeper area
      `Ultra-realistic macro scientific image of the same ${a} in a deeper underground section, ` +
      `micro-camera on body, compact moist substrate, organic matter, tunnel branches, ` +
      `only LED illumination, authentic underground documentation`,
      // 5 – deepest retreat
      `Ultra-realistic macro scientific image of the same ${a} in the deepest part of its underground home, ` +
      `micro-camera on body, very compact substrate, near total darkness except narrow harsh LED, ` +
      `raw research footage aesthetic, highly realistic animal and environment textures`,
    ],
    videoPrompts: [
      // 0
      `Ultra-realistic scientific field documentation video, 5 seconds, external macro side view of a ${a} beside the entrance of its underground home ` +
      `while a field researcher carefully finishes attaching a tiny micro-camera to the ${a}'s body using a miniature visible research harness, ` +
      `natural daylight, natural soil, dark entrance hole visible, ` +
      `the ${a} is released and immediately begins moving toward the entrance, by the end of the shot it starts descending underground, ` +
      `raw biological research documentation, no music, no narration, only natural field sounds`,
      // 1
      `Ultra-realistic mounted micro-camera POV from the same ${a} entering its underground tunnel, ` +
      `camera strapped to body facing direction of travel, 5 to 10 percent of body visible at bottom of frame, ` +
      `5-second raw scientific footage, daylight cutting off, tiny LED activating as only light source, ` +
      `compact substrate walls, body-driven movement, no stabilization, no floating camera, ` +
      `only natural sounds of movement and friction`,
      // 2
      `Ultra-realistic mounted micro-camera POV from the same ${a} moving through its main underground passage, ` +
      `camera on body, 5 to 10 percent of body at bottom of frame, 5-second raw footage, ` +
      `compact walls, natural debris, only LED beam, darkness outside, body-driven movement only, only underground sounds`,
      // 3
      `Ultra-realistic mounted micro-camera POV from the same ${a} inside a specialized underground chamber, ` +
      `camera on body, eggs or stored materials visible, only harsh LED, 5 to 10 percent of body at bottom, ` +
      `5-second raw footage, careful movement, only soft underground sounds`,
      // 4
      `Ultra-realistic mounted micro-camera POV from the same ${a} in a deeper underground section, ` +
      `camera on body, compact substrate, organic matter, only LED light, 5 to 10 percent of body at bottom, ` +
      `5-second raw footage, only underground ambient sounds`,
      // 5
      `Ultra-realistic mounted micro-camera POV from the same ${a} in the deepest part of its underground home, ` +
      `camera on body, very compact substrate, total darkness except narrow LED, 5 to 10 percent of body at bottom, ` +
      `5-second raw scientific footage, only deep underground sounds`,
    ],
  };
}

/* ── Reference image ────────────────────────────────────────── */
export async function generateReferenceImage({ prompt }) {
  return createImageJobSimple({
    subject: prompt,
    toolKey: IMAGE_TOOL_KEY,
    size: `${IMAGE_W}x${IMAGE_H}`,
    width: IMAGE_W,
    height: IMAGE_H,
    refImages: [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: REF_CREDITS,
    project_id: null,
    providerHint: {
      engine: "runware", mode: "t2i", edgeFn: "/functions/v1/runware-image", airTag: "openai:gpt-image@2",
      settings: { quality: "low", fruitModel: "zyvo-v2", skipResponse: true, deliveryMethod: "async", outputQuality: 85 },
    },
  });
}

/* ── Scene image ────────────────────────────────────────────── */
export async function generateSceneImage({ prompt, referenceUrl }) {
  const refImages = referenceUrl ? [referenceUrl] : [];
  return createImageJobSimple({
    subject: prompt,
    toolKey: IMAGE_TOOL_KEY,
    size: `${IMAGE_W}x${IMAGE_H}`,
    width: IMAGE_W,
    height: IMAGE_H,
    refImages,
    expectedRefSlotCount: refImages.length,
    chargeCreditsOverride: IMAGE_CREDITS,
    project_id: null,
    providerHint: {
      engine: "runware", mode: "t2i", edgeFn: "/functions/v1/runware-image", airTag: "openai:gpt-image@2",
      settings: { quality: "low", fruitModel: "zyvo-v2", skipResponse: true, deliveryMethod: "async", outputQuality: 85 },
    },
  });
}

/* ── Animate scene clip ─────────────────────────────────────── */
export async function animateSceneClip({ imageUrl, videoPrompt, videoModel = DEFAULT_VIDEO_MODEL }) {
  if (!imageUrl) throw new Error("animateSceneClip: missing imageUrl");
  const model = VIDEO_MODELS[videoModel] ?? VIDEO_MODELS[DEFAULT_VIDEO_MODEL];
  return createVideoJobSimple({
    subject: videoPrompt,
    toolKey: model.toolKey,
    width: model.width,
    height: model.height,
    durationSec: model.duration,
    initImageUrls: [imageUrl],
    calculatedCredits: model.credits,
    withSound: model.withSound,
  });
}

/* ── Supabase persistence ───────────────────────────────────── */
export async function createMicroCameraGeneration({ animalLabel, lengthId, scenes }) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) throw new Error("Must be signed in");

  const savedScenes = (scenes ?? [])
    .filter((s) => s.imageUrl || s.videoUrl)
    .map((s, i) => ({ index: s.index ?? i, imageUrl: s.imageUrl ?? null, videoUrl: s.videoUrl ?? null }));

  if (!savedScenes.length) throw new Error("No scenes to save");

  const { data, error } = await supabase
    .from("micro_camera_generations")
    .insert({ user_id: userData.user.id, animal_label: animalLabel || "animal", length_id: lengthId ?? null, status: "completed", scenes: savedScenes })
    .select("*").single();

  if (error) throw new Error(error.message);
  return normalizeRow(data);
}

export async function listMicroCameraGenerations(limit = 8) {
  const { data, error } = await supabase
    .from("micro_camera_generations").select("*")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeRow);
}

function normalizeRow(row) {
  if (!row) return null;
  return { ...row, createdAt: row.created_at ?? row.createdAt ?? null, animalLabel: row.animal_label ?? row.animalLabel ?? "animal", scenes: Array.isArray(row.scenes) ? row.scenes : [] };
}
