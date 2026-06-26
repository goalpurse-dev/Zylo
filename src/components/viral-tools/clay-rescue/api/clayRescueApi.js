import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";

/* ── Constants ──────────────────────────────────────────────── */
export const IMAGE_TOOL_KEY  = "image:fruit-v2";
// Sound ON  → Veo 3.1 Lite   (native audio, $0.05/s)
// Sound OFF → Seedance 1.5 Pro (no audio, much cheaper)
export const VIDEO_TOOL_KEY         = "video:veo31lite";     // with sound
export const VIDEO_TOOL_KEY_SILENT  = "video:seedance15pro"; // without sound
export const IMAGE_CREDITS          = 2;                     // ~$0.013 cost × 2 = ~2 credits
export const VIDEO_CREDITS_SOUND    = 30;                    // 5 cr/s × 6s — Veo 3.1 Lite + audio
export const VIDEO_CREDITS_NO_SOUND = 8;                     // Seedance 1.5 Pro flat rate (original)
export const VIDEO_CREDITS          = VIDEO_CREDITS_SOUND;   // legacy alias
export const VIDEO_DURATION         = 7;                     // Seedance (silent) — 7s supported
export const VIDEO_DURATION_SOUND   = 6;                     // Veo 3.1 Lite — supported: 4s / 6s / 8s
export const IMAGE_W         = 768;
export const IMAGE_H         = 1376;
export const VIDEO_W         = 496;
export const VIDEO_H         = 864;

export const LENGTH_OPTIONS = [
  { value: "30s", label: "30 sec", scenes: 4 },  // 7s × 4 = 28s
  { value: "45s", label: "45 sec", scenes: 6 },  // 7s × 6 = 42s
];

function buildCausalVideoPrompt({ problem, fix, fixAction, resolvedState, reaction }) {
  return (
    `6-second vertical miniature claymation. FIRST FRAME is the crisis: ${problem} is still fully visible and clay people are scared. ` +
    `LAST FRAME must be the solved celebration: ${resolvedState}. ` +
    `Exact timing: 0-2s show the unsolved crisis clearly, no smiles. 2-3s giant realistic hand enters with ${fix}. ` +
    `3-5s the hand performs the fix: ${fixAction} The problem must visibly move, vanish, dry up, seal, melt, or get cleared on screen. ` +
    `By second 5 the original problem is completely gone. 5-6s only after it is gone: ${reaction}. ` +
    `Preserve the clay world, camera angle, tiny characters, handmade texture, and lighting, but DO NOT preserve the problem object or water/fire/spill/blockage. ` +
    `Removing the problem is required, not a continuity error. If any problem remains visible, characters stay worried and do not celebrate. No text, no UI, no watermark. ` +
    SOUND_DIRECTION
  );
}

function makeSmartScenario({
  tag,
  problem,
  fix,
  setting,
  crisisDetail,
  fixAction,
  resolvedState,
  reaction,
}) {
  return {
    tag,
    problem,
    fix,
    fixAction,
    resolvedState,
    reaction,
    problemImagePrompt:
      `${BASE_STYLE}. ${setting}. Crisis: ${problem}. ` +
      `${crisisDetail} Tiny clay people are scared, pointing, freezing, running, or clinging to each other. ` +
      `Make the problem large, obvious, and still unsolved. No one is happy yet. Macro claymation drama, expressive faces.`,

    fixImagePrompt: buildFinalFramePrompt({ problem, fix, fixAction, resolvedState, reaction }),
    videoPrompt: buildCausalVideoPrompt({ problem, fix, fixAction, resolvedState, reaction }),
  };
}

const EXTRA_AI_SCENARIOS = [
  { tag: "road-hole-sticker", problem: "Giant hole in the road", fix: "simple sticker patch", setting: "A tiny clay town road has a huge dark pothole swallowing the street", crisisDetail: "Tiny clay cars are stopped at the edge and villagers peer into the deep hole in panic.", fixAction: "The hand peels and presses a bright sticker patch directly over the giant road hole, flattening it like magic.", resolvedState: "the road is smooth and continuous, the hole is fully covered, cars can cross safely", reaction: "cars roll across the sticker patch while villagers jump and wave" },
  { tag: "train-rock", problem: "Train stuck under fallen rock", fix: "two fingers lift the rock", setting: "A tiny clay mountain railway is blocked by a fallen rock pinning a little train", crisisDetail: "Passengers press tiny faces to the train windows and conductors wave helplessly.", fixAction: "The hand pinches the fallen rock with two fingers and lifts it straight upward away from the train.", resolvedState: "the track is clear, the train is unpinned, no rock remains on the rails", reaction: "the train starts moving and passengers cheer through the windows" },
  { tag: "bubble-village", problem: "Tiny village drowning in soap bubbles", fix: "pin pops the bubble pile", setting: "A tiny clay village is buried under a towering mountain of shiny soap bubbles", crisisDetail: "Villagers are trapped inside transparent bubbles with worried faces.", fixAction: "The hand lowers a pin and taps the bubble pile, popping bubbles in a fast chain reaction.", resolvedState: "the bubble pile is gone, houses and streets are fully visible and dry", reaction: "villagers stumble out amazed, then bounce with joy" },
  { tag: "watermelon-street", problem: "Giant watermelon blocking the street", fix: "spoon scoops it away piece by piece", setting: "A tiny clay city street is completely blocked by an enormous watermelon wedge", crisisDetail: "Traffic is jammed behind the fruit and pedestrians are trapped on both sides.", fixAction: "The hand uses a spoon to scoop the watermelon away in huge clean chunks.", resolvedState: "the street is open, only a tiny harmless watermelon smear remains off to the side", reaction: "cars pass through and villagers clap at the absurd rescue" },
  { tag: "whirlpool-boat", problem: "Tiny boat spinning in a whirlpool", fix: "straw redirects the water", setting: "A tiny clay boat spins helplessly in a swirling whirlpool beside a miniature dock", crisisDetail: "Sailors cling to the mast while the circular water pulls them inward.", fixAction: "The hand places a straw into the water and redirects the spinning current away from the boat.", resolvedState: "the whirlpool is gone, the water is calm, the boat floats safely beside the dock", reaction: "the sailors stand up, wave hats, and celebrate on deck" },
  { tag: "bee-swarm", problem: "Bees swarming around villagers", fix: "flower pot moved away by hand", setting: "A tiny clay village square is overwhelmed by a buzzing swarm of bees", crisisDetail: "Villagers duck under tables while bees circle a flower pot in the middle of the square.", fixAction: "The hand gently picks up the flower pot and moves it far away from the villagers.", resolvedState: "the bee swarm follows the flower pot off-screen, the square is clear", reaction: "villagers peek out, realize the bees are gone, then cheer" },
  { tag: "bridge-popsicle", problem: "Village bridge snapped in half", fix: "popsicle stick bridge", setting: "A tiny clay river bridge is snapped in half, separating villagers on both banks", crisisDetail: "People reach across the gap but cannot cross the rushing water below.", fixAction: "The hand lays a clean popsicle stick across the broken bridge gap.", resolvedState: "the popsicle stick forms a stable bridge, the gap is fully crossed", reaction: "villagers cross safely and hug on the other side" },
  { tag: "rolling-boulder", problem: "Huge boulder rolling toward houses", fix: "fingertip stops it", setting: "A huge clay boulder rolls downhill toward tiny houses", crisisDetail: "Villagers flee as the boulder gets close to the first house.", fixAction: "The hand lowers one fingertip and stops the boulder instantly like it weighs nothing.", resolvedState: "the boulder is motionless and held safely away from all houses", reaction: "villagers turn back, stare in disbelief, then explode into cheers" },
  { tag: "fountain-sponge", problem: "Overflowing fountain flooding the plaza", fix: "sponge dropped into the water", setting: "A tiny clay plaza is flooding from an overflowing fountain", crisisDetail: "Water spreads across the plaza around benches, carts, and panicked villagers.", fixAction: "The hand drops a sponge into the fountain water and presses it down.", resolvedState: "the flood water is fully absorbed, plaza stones are dry, the fountain is calm", reaction: "villagers splash-free dance on the dry plaza" },
  { tag: "pizza-cars", problem: "Giant pizza slice falls onto cars", fix: "fork lifts it away", setting: "A giant clay pizza slice has fallen across tiny parked cars", crisisDetail: "Drivers are trapped beneath stringy cheese and villagers gasp from the sidewalk.", fixAction: "The hand slides a fork under the pizza slice and lifts it cleanly away.", resolvedState: "the cars are uncovered, the road is clear, no cheese blocks the street", reaction: "drivers climb out and celebrate around the fork shadow" },
  { tag: "honey-spill", problem: "Tiny people trapped behind sticky honey spill", fix: "paper towel wipes it up", setting: "A glossy golden honey spill blocks a tiny clay marketplace street", crisisDetail: "Villagers are stuck behind the sticky puddle and one shoe is glued to the ground.", fixAction: "The hand presses a paper towel onto the honey and wipes it away in one sweep.", resolvedState: "the honey is gone, the street is clean, no sticky puddle remains", reaction: "villagers run across the clean street and cheer" },
  { tag: "candle-fire", problem: "Giant candle fire spreading in town", fix: "human hand blows it out", setting: "A giant candle flame towers beside tiny clay town buildings", crisisDetail: "The flame spreads warm glow and smoke toward roofs as villagers panic.", fixAction: "The hand leans in and blows a visible gust of air at the candle flame.", resolvedState: "the flame is fully out, smoke fades, buildings are dark and safe", reaction: "villagers point at the extinguished wick, then jump with relief" },
  { tag: "apple-market", problem: "Apple rolling downhill toward market stalls", fix: "fingertip gently stops the apple", setting: "A huge red apple rolls downhill toward tiny clay market stalls", crisisDetail: "Vendors clutch their carts as the apple barrels toward them.", fixAction: "The hand places a fingertip in front of the apple and gently stops it.", resolvedState: "the apple is still, the market stalls are untouched, the path is safe", reaction: "vendors throw tiny clay vegetables in the air with joy" },
  { tag: "sandstorm-brush", problem: "Sandstorm burying tiny desert village", fix: "small brush sweeps sand away", setting: "A tiny clay desert village is half buried by blowing sand", crisisDetail: "Only rooftops and frightened faces poke through drifting dunes.", fixAction: "The hand uses a small brush to sweep the sand away from houses and streets.", resolvedState: "the village is uncovered, doors and paths are clear, the sandstorm has stopped", reaction: "villagers emerge from doorways and celebrate in the sunlight" },
  { tag: "book-gate", problem: "Giant book blocks the town gate", fix: "hand lifts the book corner", setting: "A giant book has fallen over the entrance gate of a tiny clay town", crisisDetail: "Villagers are trapped inside while travelers wait outside helplessly.", fixAction: "The hand lifts one corner of the book and slides it away from the gate.", resolvedState: "the town gate is fully open and no book blocks the entrance", reaction: "both groups rush through the gate and cheer together" },
  { tag: "puddle-ruler", problem: "Tiny people stranded across a puddle", fix: "ruler bridge", setting: "A wide puddle separates tiny clay people from their homes", crisisDetail: "The puddle looks like a lake to them and no one can cross.", fixAction: "The hand places a ruler across the puddle as a straight bridge.", resolvedState: "the ruler spans the puddle securely, everyone has a dry path", reaction: "villagers walk across the ruler and celebrate on both sides" },
  { tag: "hail-bowl", problem: "Hailstones smashing tiny farm", fix: "bowl flipped over as shelter", setting: "Large hailstones crash down onto a tiny clay farm", crisisDetail: "Farmers cover their heads as hail dents crops and fences.", fixAction: "The hand flips a bowl upside down over the farm like a protective dome.", resolvedState: "hail bounces harmlessly off the bowl, the farm underneath is safe", reaction: "farmers dance under the clear shelter" },
  { tag: "noodle-traffic", problem: "Giant noodle tangles up traffic", fix: "chopsticks lift it away", setting: "A giant noodle is tangled around tiny cars at a clay intersection", crisisDetail: "Drivers are stuck in loops of noodle and traffic cannot move.", fixAction: "The hand uses chopsticks to pinch the noodle and lift it away in one long strand.", resolvedState: "cars are untangled, lanes are clear, no noodle remains on the road", reaction: "traffic flows and drivers wave from windows" },
  { tag: "leaking-dam", problem: "Leaking dam threatening the village", fix: "tape plugs the crack", setting: "A tiny clay dam has a dangerous crack spraying water toward a village", crisisDetail: "Villagers stack tiny sandbags as water jets through the crack.", fixAction: "The hand presses a strip of tape over the leaking crack until the spray stops.", resolvedState: "the dam crack is sealed, no water sprays out, the village is dry", reaction: "villagers drop the sandbags and cheer at the sealed dam" },
  { tag: "leaf-sunlight", problem: "Giant leaf blocks all sunlight from crops", fix: "hand lifts the leaf away", setting: "A giant leaf casts a dark shadow over a tiny clay crop field", crisisDetail: "Farmers look worried at drooping crops hidden from sunlight.", fixAction: "The hand lifts the giant leaf upward and away from the field.", resolvedState: "bright sunlight reaches every crop and the plants stand tall", reaction: "farmers spin and cheer as the field glows" },
  { tag: "donut-town", problem: "Giant donut rolls through town", fix: "pencil stops it like a barrier", setting: "A giant donut rolls down a tiny clay main street", crisisDetail: "Villagers scatter as the donut threatens carts and houses.", fixAction: "The hand lays a pencil across the road, stopping the donut like a barrier.", resolvedState: "the donut is stopped, the street is protected, no buildings are hit", reaction: "villagers pop out from hiding and celebrate beside the pencil" },
  { tag: "runway-grape", problem: "Tiny airport runway blocked by one grape", fix: "spoon flicks the grape away", setting: "A single giant grape blocks a tiny clay airport runway", crisisDetail: "A tiny plane waits helplessly while ground crew panic around the grape.", fixAction: "The hand uses a spoon to flick the grape off the runway.", resolvedState: "the runway is completely clear and the plane has a safe path", reaction: "the plane rolls forward as ground crew cheer" },
  { tag: "ice-cube-street", problem: "Giant ice cube freezing the street", fix: "warm cup of water melts it", setting: "A giant ice cube freezes a tiny clay street in blue frost", crisisDetail: "Villagers slip on ice and cars are frozen in place.", fixAction: "The hand pours warm water from a cup over the ice cube.", resolvedState: "the ice cube melts away, frost disappears, the street is dry and safe", reaction: "villagers skate one last happy spin, then cheer on dry pavement" },
  { tag: "spaghetti-maze", problem: "Tiny people trapped in a maze of spaghetti", fix: "fork lifts the spaghetti out", setting: "A maze of giant spaghetti strands traps tiny clay people in a town square", crisisDetail: "Villagers wander between noodle walls unable to escape.", fixAction: "The hand twirls a fork into the spaghetti maze and lifts all strands upward.", resolvedState: "the square is clear, all spaghetti is gone, every villager can exit", reaction: "villagers run into open space and celebrate" },
  { tag: "pillow-houses", problem: "Giant pillow smothers little houses", fix: "hand lifts the pillow corner", setting: "A giant pillow has landed over tiny clay houses", crisisDetail: "Only chimneys and tiny waving hands peek out from under the soft pillow.", fixAction: "The hand lifts the pillow corner and pulls the pillow away from the houses.", resolvedState: "all houses are uncovered, upright, and safe", reaction: "families step out of doorways and cheer at the lifted pillow" },
  { tag: "rain-cloud-umbrella", problem: "Huge rain cloud over one tiny farm", fix: "umbrella placed above it", setting: "A single dark rain cloud pours water over one tiny clay farm", crisisDetail: "The farmer stands soaked while crops drown in muddy puddles.", fixAction: "The hand places an open umbrella above the farm, blocking the rain instantly.", resolvedState: "rain stops hitting the farm, puddles recede, crops stand safe under the umbrella", reaction: "the farmer shakes off water and celebrates under the umbrella" },
  { tag: "shoe-road", problem: "Giant shoe blocks the whole road", fix: "hand picks it up and moves it away", setting: "A giant shoe sits across the entire tiny clay road", crisisDetail: "Cars and pedestrians are stuck on both sides of the huge shoe.", fixAction: "The hand grips the shoe and lifts it away from the road.", resolvedState: "the road is fully open with no shoe blocking traffic", reaction: "traffic flows and pedestrians cheer across the open road" },
  { tag: "popcorn-avalanche", problem: "Popcorn avalanche falling down a hill", fix: "bowl catches the popcorn", setting: "A popcorn avalanche tumbles down a hill toward a tiny clay village", crisisDetail: "Villagers run as popcorn kernels bounce toward houses.", fixAction: "The hand places a bowl at the bottom of the hill, catching the entire avalanche.", resolvedState: "all popcorn is contained in the bowl, no kernels threaten the village", reaction: "villagers gather around the bowl and cheer with relief" },
  { tag: "cookie-crumbs", problem: "Giant cookie crumbles trap villagers", fix: "brush sweeps crumbs aside", setting: "Huge cookie crumbs collapse into a tiny clay street and trap villagers", crisisDetail: "People are stuck between crumb boulders while dust fills the road.", fixAction: "The hand uses a brush to sweep the cookie crumbs aside in clean strokes.", resolvedState: "the street is clear, villagers are free, crumbs are piled safely off-road", reaction: "freed villagers jump and wave from the clean street" },
  { tag: "marble-square", problem: "Giant marble stuck in town square", fix: "fingertip flicks it away", setting: "A giant glass marble is stuck in the center of a tiny clay town square", crisisDetail: "Villagers cannot cross the square and carts are blocked around it.", fixAction: "The hand flicks the marble gently with one fingertip, rolling it out of the square.", resolvedState: "the town square is open, no marble blocks the plaza", reaction: "villagers flood into the square and celebrate" },
];

// Added to AI_SCENARIOS after the base scenario bank is declared.

export function calcCredits(sceneCount, withSound = true) {
  const videoCredits = withSound ? VIDEO_CREDITS_SOUND : VIDEO_CREDITS_NO_SOUND;
  return sceneCount * (IMAGE_CREDITS * 2 + videoCredits);
}

/* ─────────────────────────────────────────────────────────────
   SOUND DIRECTION  (Veo 3.1 Fast generates native audio)
   Rules:
   • Physical / diegetic sounds only — touching, moving, clay
   • Water / liquid sounds for relevant scenarios
   • Crowd cheering AT THE END once rescue is complete
   • Absolutely NO background music, NO score, NO soundtrack
───────────────────────────────────────────────────────────── */
const SOUND_DIRECTION =
  "AUDIO DIRECTION: diegetic sounds only — no background music, no score, no soundtrack ever. " +
  "During the crisis (0-2s): ambient tension sounds — distant rumbling, dripping, crackling, or wind depending on the disaster. " +
  "Tiny clay characters gasp, whimper, or cry out in fear. " +
  "During the rescue (2-5s): physical hands-on sounds — soft clay squelching as the giant hand grips and moves things, " +
  "tapping, scraping, splashing, or crunching depending on what the fix item is. " +
  "For water scenarios: realistic water sounds — rushing, absorbing, draining. " +
  "FINALE AUDIO (5-6s) — THIS IS THE MOST IMPORTANT PART: " +
  "the entire crowd of tiny clay people erupts into a massive joyful cheer the INSTANT the rescue is complete. " +
  "It sounds like a stadium — a huge wave of voices all shouting together: " +
  "\"HEYYY! AYYY! YAYYY!\" — pure euphoric crowd noise, overlapping voices, people screaming with happiness. " +
  "Arms are raised, mouths open wide. The cheer builds and peaks. " +
  "It must feel like the most satisfying crowd reaction imaginable — loud, warm, chaotic joy. " +
  "This crowd cheer is the emotional payoff of the entire video and must be unmistakable.";

/* ─────────────────────────────────────────────────────────────
   STYLE CONSTANTS
   Updated per pro feedback: emphasise handmade clay texture,
   macro photography look, avoid "Pixar" which pushes to CGI gloss.
───────────────────────────────────────────────────────────── */
const BASE_STYLE =
  "miniature claymation diorama, handmade polymer clay characters, " +
  "visible soft clay texture, tiny handcrafted props, macro photography look, " +
  "realistic shallow depth of field, cinematic lighting, " +
  "whimsical emotional expressions, highly detailed miniature set, " +
  "vertical 9:16, no text, no UI, no watermark";

// Injected at the start of every Image B prompt
const IMAGE_B_ANCHOR =
  "Use Image A as the exact visual reference. " +
  "Preserve the same camera angle, same composition, same character count, same character positions, " +
  "same environment, same background layout, same lighting direction, same color palette, " +
  "same clay texture, and same miniature scale. " +
  "Do not redesign the scene. Only add the giant realistic human hand and the rescue item. " +
  "Show the fix in progress — not fully finished — so the video has something satisfying to complete. " +
  "Keep the rescue item simple, funny, and visually obvious. " +
  "Shift the tiny clay characters' expressions from fear or sadness into amazement, hope, and relief. ";

const FINAL_IMAGE_ANCHOR =
  "Use Image A as the exact visual reference for camera angle, environment, background layout, lighting, color palette, clay texture, and miniature scale. " +
  "Allow the tiny clay characters to move into relieved celebration poses. " +
  "CRITICAL: do not preserve the crisis object, water, fire, spill, crack, swarm, storm, or blockage. Removing the problem is the required edit. " +
  "Create the final solved frame of the rescue, not a mid-action frame. ";

function buildFinalFramePrompt({ problem, fix, fixAction, resolvedState, reaction }) {
  return (
    `${FINAL_IMAGE_ANCHOR}` +
    `The giant realistic human hand and ${fix} have just completed the rescue: ${fixAction} ` +
    `Final solved state: ${resolvedState}. The original problem "${problem}" is completely gone or neutralized. ` +
    `Show the clay people only now reacting with relief and happiness: ${reaction}. ` +
    `No remaining danger, no unresolved water/fire/blockage/spill/crack. ${BASE_STYLE}.`
  );
}

// Standard 7-second video structure (used as the closing paragraph of every video prompt)
const VIDEO_STRUCTURE =
  "Create a 6-second vertical miniature claymation animation using Image A as the opening state " +
  "and Image B as the target rescue state. " +
  "The fix effect must be MASSIVELY OVERDONE and absurdly powerful — this absurd contrast IS the comedy. " +
  "WHAT TO PRESERVE (must not change): the buildings, street layout, characters, camera angle, clay art style, and lighting direction. " +
  "WHAT MUST CHANGE (this is required and allowed): the problem element — flood water, fire, earthquake crack — " +
  "MUST visually disappear completely during the video. This is not a violation of scene consistency; removing the problem IS the goal. " +
  "The video follows this causal chain: " +
  "0–2s: crisis is fully visible and intense — characters show fear and panic. " +
  "2–3s: giant realistic human hand enters from above holding the fix item. " +
  "3–5s: fix item is applied — the problem element physically disappears as a direct result. " +
  "Show the water being absorbed and the ground becoming dry. Show the fire being extinguished and the building going dark. " +
  "The problem MUST be gone by second 5 — the camera does not need to stay on a flooded or burning scene. " +
  "5–6s: scene is safe, problem is 100% gone, clay characters celebrate explosively — jumping, bouncing, arms raised, huge smiles. " +
  "Celebration starts ONLY after the problem has visually left the frame. " +
  "No text, no UI, no watermark. " +
  SOUND_DIRECTION;

const CAUSAL_RESCUE_RULES =
  "STRICT CAUSALITY RULES: The video must follow problem first, hand second, fix third, celebration last. " +
  "0-2s: show the crisis clearly with scared clay people. " +
  "2-3s: the giant hand enters holding the fix item. " +
  "3-5s: the fix visibly solves the problem on screen. The active danger must be completely gone by second 5. " +
  "5-7s: only after the problem is gone, clay people react with relief, happiness, and celebration. " +
  "If any water, fire, blockage, spill, crack, swarm, storm, or other danger remains visible, characters must stay worried and must not celebrate. ";

/* ─────────────────────────────────────────────────────────────
   AI SCENARIO BANK  (8 hand-authored scenes)
───────────────────────────────────────────────────────────── */
const AI_SCENARIOS = [
  {
    tag: "flood",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay village cobblestone street is being flooded — ` +
      `muddy brown water rises past doorways of little handmade clay houses. ` +
      `Five tiny clay villagers stand on doorsteps and windowsills with wide terrified eyes, arms raised, mouths open in panic. ` +
      `One clings to a lamppost, another holds a tiny sandbag uselessly. ` +
      `Swirling dark water, debris floating past. Dramatic crisis mood, adorable handmade clay characters, ` +
      `visible clay fingerprints on props, macro photography depth of field.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand enters from the top holding an oversized yellow kitchen sponge. ` +
      `The sponge is just touching the floodwater — you can see water beginning to absorb into it, the water level starting to drop. ` +
      `The clay villagers below stare up in awe, mid-reaction, arms just beginning to reach upward in disbelief. ` +
      `The rescue is in progress, not finished. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand presses a sponge into the floodwater. ` +
      `The flood water IS ALLOWED TO AND MUST disappear — this is required, not a scene violation. ` +
      `Show the water level visibly dropping as the sponge absorbs it, until the cobblestones are completely dry and visible. ` +
      `The scene goes from flooded street to dry clean cobblestone street — this transition IS the point of the video. ` +
      `The effect is absurdly overdone: one sponge removes all the water instantly. ` +
      `Zero water on the ground before anyone smiles. Then full joyful celebration.`,
  },
  {
    tag: "homeless",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay alleyway at night. One small sad clay elderly figure ` +
      `sits hunched on cold stone steps, wrapped in torn thin newspaper, visibly shivering. ` +
      `Light snow falls on their clay shoulders. A small tilted cardboard sign beside them. ` +
      `Dim distant lamplight, empty clay streets, deeply expressive sad clay eyes, downturned clay mouth. ` +
      `Cold blue-grey lighting, lonely emotional scene, visible handmade clay textures.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand descends gently from above, beginning to drape a thick warm red wool blanket around the clay figure's shoulders. ` +
      `The blanket is mid-wrap — oversized, soft-looking, warm-coloured. ` +
      `The tiny clay person is just beginning to look upward, a small hopeful expression forming on their clay face. ` +
      `The lighting is starting to shift from cold blue-grey to warm amber. The miracle is happening. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand slowly lowers a large warm red wool blanket and wraps it around the shivering clay figure. ` +
      `The scene's lighting transitions from cold blue-grey to warm amber as the blanket is placed. ` +
      `The clay figure looks up with glistening grateful eyes then breaks into a huge bouncing celebration.`,
  },
  {
    tag: "fire",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay bakery on a cobblestone street ablaze — ` +
      `bright orange and yellow clay flames burst from the roof and windows, dark clay smoke curling upward. ` +
      `Six tiny clay firefighters outside with miniature hoses, nothing coming out, completely panicked and useless. ` +
      `Tiny clay townspeople behind them with hands over their mouths in horror. ` +
      `Dramatic warm crisis lighting, urgent emotional expressions, handmade clay textures, macro depth of field.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand enters holding a single tiny glass of water between thumb and forefinger. ` +
      `The hand is tilting the glass — the water is mid-pour, a thin stream falling toward the flames. ` +
      `The closest flames are just beginning to hiss and shrink where the water touches. ` +
      `The clay firefighters below are frozen mid-motion, jaws starting to drop in disbelief. ` +
      `Rescue in progress. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand tips a tiny glass of water onto the building fire. ` +
      `The fire IS ALLOWED TO AND MUST go out — this is required, not a scene violation. ` +
      `Show the flames physically shrinking and disappearing as the water hits them, until the building is completely dark and unlit. ` +
      `The scene goes from blazing fire to dark extinguished building — this transition IS the point of the video. ` +
      `The effect is absurdly overdone: one tiny glass removes all the fire instantly. ` +
      `Zero flames, zero embers, zero glow anywhere before anyone smiles. Then full joyful celebration.`,
  },
  {
    tag: "earthquake",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay town square splitting apart from an earthquake — ` +
      `a dramatic jagged crack runs down the cobblestone street separating two groups of clay figures. ` +
      `Clay buildings tilt, lamp posts lean, debris falls. ` +
      `On each side of the crack, small clay figures reach desperately toward each other across the gap, unable to cross. ` +
      `Terror and longing on their clay faces. Dramatic crisis, handmade clay textures, macro depth.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand enters holding a large colourful band-aid, ` +
      `just beginning to press it down across the crack in the ground — one end fixed, the other still being pressed down. ` +
      `The crack beneath the placed end is visibly starting to seal. ` +
      `The clay figures on both sides stare at the band-aid with wide stunned eyes, arms beginning to lower in amazement. ` +
      `Fix in progress. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand places a large brightly coloured band-aid across the earthquake crack — ` +
      `the ground seals beneath it, the shaking stops. ` +
      `Clay figures from both sides step onto the band-aid bridge and reach each other in tearful reunion, then celebrate.`,
  },
  {
    tag: "traffic",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay city intersection in total gridlock — ` +
      `dozens of tiny brightly coloured clay cars jammed bumper to bumper in all directions. ` +
      `Tiny clay drivers lean out of windows looking furious and impatient. ` +
      `One small clay bus blocking the entire centre intersection. Clay traffic lights all red. ` +
      `Comic chaos energy, handmade clay textures, macro photography depth of field.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand enters from above, two fingers beginning to pinch the single blocking clay bus. ` +
      `The bus is lifting mid-air — just off the ground, still above the intersection. ` +
      `Below, the nearest cars can already see the gap opening and are beginning to inch forward. ` +
      `The clay drivers watching have jaws dropping, hands frozen mid-gesture. ` +
      `Rescue in progress. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand pinches the blocking clay bus between two fingers and lifts it cleanly away — ` +
      `instantly below, all traffic begins flowing. ` +
      `The angry clay drivers transform into cheering, bouncing figures waving their arms in joy.`,
  },
  {
    tag: "drought",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay farm with severely cracked dry earth — ` +
      `fields split with deep drought cracks, plants wilted and drooping, harsh cloudless sky. ` +
      `A tiny clay farmer kneels in dry dirt holding a small empty watering can upside down. ` +
      `Their face shows heartbreak — sunken clay eyes, downturned mouth. ` +
      `Nearby tiny clay villagers watch the dead crops helplessly. Dusty, desperate scene, handmade clay textures.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand enters holding a large glass eyedropper filled with glowing water. ` +
      `One perfect glistening drop is just leaving the dropper tip, falling in slow motion toward the cracked soil. ` +
      `Where it is about to land, one small plant is already beginning to straighten, a single green sprout emerging from the crack. ` +
      `The clay farmer looks upward, eyes wide, mouth just beginning to open in wonder. ` +
      `The miracle is starting. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand squeezes a glass eyedropper — one perfect water drop falls in slow motion. ` +
      `Where it lands, plants shoot upright instantly, flowers bloom, the cracked earth seals in a ripple of life. ` +
      `The clay farmer leaps to their feet spinning with joy, villagers bounce and cheer.`,
  },
  {
    tag: "storm",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay harbour in a violent storm — enormous clay waves crash over the sea wall, ` +
      `flooding the harbour. Tiny clay fishing boats tossed and sinking. ` +
      `Clay fishermen on the docks cling to ropes and posts, soaked and terrified with wide panicked expressions. ` +
      `Lightning bolts in clay sky, swirling dark storm clouds. Dramatic and urgent, handmade clay textures, macro depth.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand enters holding an enormous open umbrella, ` +
      `just arriving above the harbour — the canopy is mid-open, covering half the harbour. ` +
      `Under the umbrella's shadow the rain is already stopping and the nearest wave is beginning to calm. ` +
      `Outside the umbrella's edge, the storm still rages. ` +
      `The fishermen are loosening their grip on the ropes, slowly looking upward in stunned disbelief. ` +
      `Rescue in progress. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand opens an enormous umbrella above the harbour — ` +
      `under it, rain stops, waves settle, perfect calm spreads while the storm rages outside the umbrella's edge. ` +
      `The clay fishermen stand up straight, look at each other, then burst into joyful bouncing celebration.`,
  },
  {
    tag: "trapped",
    problemImagePrompt:
      `${BASE_STYLE}. A tiny clay mine with a cave-in — a massive clay boulder has rolled and sealed the mine entrance. ` +
      `Behind the boulder, tiny clay miners press their faces against narrow gaps, reaching small clay hands through the cracks. ` +
      `Outside, their clay families stand with arms stretched toward the boulder, unable to move it. ` +
      `Faces full of anguish and desperation. Dark dramatic scene, handmade clay textures, macro depth of field.`,

    fixImagePrompt:
      `${IMAGE_B_ANCHOR}` +
      `The giant realistic human hand enters from above, one single fingertip just making contact with the enormous boulder, ` +
      `beginning to push it — the boulder is starting to shift, a sliver of light appearing at the mine entrance edge. ` +
      `The clay miners inside are pressing toward the opening light. ` +
      `The families outside are frozen in stunned disbelief as the boulder begins to move from a single fingertip. ` +
      `Rescue just beginning. ${BASE_STYLE}.`,

    videoPrompt:
      `${VIDEO_STRUCTURE} ` +
      `Specific action: the hand's single fingertip flicks the enormous boulder aside effortlessly — ` +
      `it rolls away, flooding the mine entrance with light. ` +
      `Miners stumble out into daylight, families rush toward them, everyone celebrates in tearful joyful reunion.`,
  },
];

/* ── Manual mode template builders ─────────────────────────── */
const BASE_SCENARIO_METADATA = {
  flood: {
    problem: "Flood",
    fix: "oversized yellow kitchen sponge",
    fixAction: "The hand presses the sponge into the muddy flood water and the sponge drinks the water down fast.",
    resolvedState: "dry clean cobblestones are visible, no flood water remains anywhere in the street",
    reaction: "villagers jump on the dry street, arms raised, huge relieved smiles",
  },
  homeless: {
    problem: "Cold homeless clay person",
    fix: "warm red blanket",
    fixAction: "The hand wraps the warm blanket around the shivering clay person.",
    resolvedState: "the person is warm, no longer shivering, sitting safely in warm amber light",
    reaction: "the rescued person smiles with grateful tears while nearby villagers cheer gently",
  },
  fire: {
    problem: "Building fire",
    fix: "tiny glass of water",
    fixAction: "The hand pours water onto the flames and every flame hisses out.",
    resolvedState: "the bakery is dark and safe, zero flames, zero embers, zero orange glow",
    reaction: "firefighters and villagers cheer only after the building is fully extinguished",
  },
  earthquake: {
    problem: "Earthquake crack splitting the street",
    fix: "large colorful band-aid",
    fixAction: "The hand presses the band-aid across the crack and the ground seals underneath.",
    resolvedState: "the street crack is sealed, shaking has stopped, both sides are connected safely",
    reaction: "separated villagers cross and celebrate together",
  },
  traffic: {
    problem: "Gridlocked traffic blocked by a bus",
    fix: "two fingers lifting the bus",
    fixAction: "The hand pinches the blocking bus and lifts it completely out of the intersection.",
    resolvedState: "the intersection is clear and traffic lanes are open",
    reaction: "drivers wave from moving cars and cheer",
  },
  drought: {
    problem: "Drought killing a tiny farm",
    fix: "glass eyedropper of water",
    fixAction: "The hand releases one water drop and life ripples through the field.",
    resolvedState: "cracked earth is sealed, plants stand tall, flowers bloom",
    reaction: "the farmer and villagers bounce with joy around the revived crops",
  },
  storm: {
    problem: "Violent storm flooding a tiny harbor",
    fix: "enormous umbrella",
    fixAction: "The hand opens the umbrella above the harbor and the storm calms under it.",
    resolvedState: "rain is blocked, waves are calm, boats float safely, harbor water is no longer dangerous",
    reaction: "fishermen stand safely on the dock and celebrate",
  },
  trapped: {
    problem: "Mine entrance blocked by a boulder",
    fix: "single fingertip",
    fixAction: "The fingertip pushes the boulder completely away from the mine entrance.",
    resolvedState: "the mine entrance is open, bright daylight enters, no boulder blocks the exit",
    reaction: "miners reunite with families and everyone celebrates",
  },
};

AI_SCENARIOS.forEach((scenario) => {
  const metadata = BASE_SCENARIO_METADATA[scenario.tag];
  if (!metadata) return;
  Object.assign(scenario, metadata, {
    fixImagePrompt: buildFinalFramePrompt(metadata),
    videoPrompt: buildCausalVideoPrompt(metadata),
  });
});

AI_SCENARIOS.push(...EXTRA_AI_SCENARIOS.map(makeSmartScenario));

function buildManualPrompts(problem, fix) {
  const p = (problem || "disaster").trim();
  const f = (fix     || "solution").trim();

  const problemImagePrompt =
    `${BASE_STYLE}. A tiny clay miniature village experiencing a dramatic crisis: ${p}. ` +
    `Multiple tiny expressive clay characters with wide eyes and exaggerated emotions react — ` +
    `some panicking, some pointing helplessly, some clinging to each other. ` +
    `The problem feels urgent and serious to the tiny clay world. ` +
    `Rich scene detail, cinematic composition, visible handmade clay fingerprints on all props, ` +
    `emotional clay faces full of worry, macro photography depth of field.`;

  const fixAction = `The giant realistic human hand uses ${f} directly on ${p}, physically clearing or neutralizing it.`;
  const resolvedState = `${p} is completely gone or made harmless, the tiny clay world is safe, clean, open, and calm`;
  const reaction = "the tiny clay people celebrate with relief, smiles, raised arms, and excited bouncing";

  return {
    problemImagePrompt,
    fixImagePrompt: buildFinalFramePrompt({ problem: p, fix: f, fixAction, resolvedState, reaction }),
    videoPrompt: buildCausalVideoPrompt({ problem: p, fix: f, fixAction, resolvedState, reaction }),
  };

  const fixImagePrompt =
    `${IMAGE_B_ANCHOR}` +
    `The giant realistic human hand descends from above the top of the frame, ` +
    `holding or using a ${f} to directly address the ${p}. ` +
    `Show the fix in progress — the ${f} is mid-action, the crisis is just beginning to resolve. ` +
    `The scale contrast between the enormous real hand and the tiny clay world should feel like a miracle. ` +
    `${BASE_STYLE}.`;

  const videoPrompt =
    `${VIDEO_STRUCTURE} ${CAUSAL_RESCUE_RULES}` +
    `Specific causal action: a giant realistic human hand descends holding a ${f} and applies it directly to the ${p}. ` +
    `Show the ${f} visibly and physically causing the ${p} to disappear — the cause and effect must be clear on screen. ` +
    `The ${p} must be completely gone before any clay character shows happiness. ` +
    `Celebration is the final event, triggered only by the problem being fully resolved.`;

  return { problemImagePrompt, fixImagePrompt, videoPrompt };
}

// Returns a shuffled array of AI_SCENARIOS indices — call once per generation session
export function getShuffledScenarioOrder() {
  const indices = AI_SCENARIOS.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export function buildScenePrompts(problem, fix, sceneIndex = 0, aiMode = false, scenarioOrder = null) {
  if (aiMode) {
    const order  = scenarioOrder ?? AI_SCENARIOS.map((_, i) => i);
    const picked = order[sceneIndex % order.length];
    const s      = AI_SCENARIOS[picked];
    return {
      problemImagePrompt: s.problemImagePrompt,
      fixImagePrompt:     s.fixImagePrompt,
      videoPrompt:        s.videoPrompt,
      problem:            s.problem ?? s.tag ?? problem,
      fix:                s.fix ?? fix,
      tag:                s.tag ?? null,
    };
  }
  return buildManualPrompts(problem, fix);
}

/* ── Image generation ───────────────────────────────────────── */
export async function generateProblemImage({ problemImagePrompt }) {
  return createImageJobSimple({
    subject: problemImagePrompt,
    toolKey: IMAGE_TOOL_KEY,
    size: `${IMAGE_W}x${IMAGE_H}`,
    width: IMAGE_W,
    height: IMAGE_H,
    refImages: [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: IMAGE_CREDITS,
    project_id: null,
    providerHint: {
      engine: "runware", mode: "t2i", edgeFn: "/functions/v1/runware-image", airTag: "openai:gpt-image@2",
      settings: { quality: "low", fruitModel: "zyvo-v2", skipResponse: true, deliveryMethod: "async", outputQuality: 85 },
    },
  });
}

export async function generateFixImage({ fixImagePrompt, problemImageUrl }) {
  const refImages = problemImageUrl ? [problemImageUrl] : [];
  return createImageJobSimple({
    subject: fixImagePrompt,
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

/* ── Video generation ───────────────────────────────────────── */
export async function animateSceneClip({ fixImageUrl, problemImageUrl, videoPrompt, withSound = true }) {
  if (!fixImageUrl) throw new Error("animateSceneClip: missing fixImageUrl");
  const initImageUrls = problemImageUrl
    ? [problemImageUrl, fixImageUrl]
    : [fixImageUrl];
  return createVideoJobSimple({
    subject:           videoPrompt,
    toolKey:           withSound ? VIDEO_TOOL_KEY : VIDEO_TOOL_KEY_SILENT,
    width:             VIDEO_W,
    height:            VIDEO_H,
    durationSec:       withSound ? VIDEO_DURATION_SOUND : VIDEO_DURATION,
    initImageUrls,
    calculatedCredits: withSound ? VIDEO_CREDITS_SOUND : VIDEO_CREDITS_NO_SOUND,
    withSound:         withSound,
  });
}

/* ── Supabase persistence ───────────────────────────────────── */
export async function createClayRescueGeneration({ lengthId, scenes }) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) throw new Error("Must be signed in");

  const savedScenes = (scenes ?? [])
    .filter((s) => s.fixUrl || s.imageUrl || s.problemUrl || s.videoUrl)
    .map((s, i) => ({
      index:      s.index ?? i,
      problem:    s.problem ?? "",
      fix:        s.fix ?? "",
      problemUrl: s.problemUrl ?? null,
      fixUrl:     s.fixUrl ?? s.imageUrl ?? null,  // hook stores fix image as imageUrl
      videoUrl:   s.videoUrl ?? null,
    }));

  if (!savedScenes.length) throw new Error("No scenes to save");

  const { data, error } = await supabase
    .from("clay_rescue_generations")
    .insert({ user_id: userData.user.id, length_id: lengthId ?? null, status: "completed", scenes: savedScenes })
    .select("*").single();

  if (error) throw new Error(error.message);
  return normalizeRow(data);
}

export async function listClayRescueGenerations(limit = 8) {
  const { data, error } = await supabase
    .from("clay_rescue_generations").select("*")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeRow);
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt ?? null,
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
  };
}
