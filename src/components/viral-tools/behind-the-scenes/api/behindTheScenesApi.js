import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { supabase } from "../../../../lib/supabaseClient";
import { getAllowedVideoModels as sharedGetAllowedVideoModels, PLAN_LABELS } from "../../../../lib/planGating";

export { PLAN_LABELS };

export const VIDEO_DURATION = 8;

export const QUALITY_TIERS = {
  "bts-v2": {
    id: "bts-v2",
    label: "V2",
    tag: "Fastest",
    description: "2K image · 720p video",
    imageToolKey: "image:bts2k",
    imageResolution: "2k",
    imageWidth: 768,
    imageHeight: 1376,
    imageCredits: 7,
    videoToolKey: "video:seedance15pro",
    videoWidth: 720,
    videoHeight: 1280,
    videoCredits: 42,   // 5.25 credits/s (with sound) × 8s — measured rate
    withSound: true,
  },
  "bts-v3": {
    id: "bts-v3",
    label: "V3",
    tag: "Premium",
    description: "4K image · 720p video",
    imageToolKey: "image:bts4kpro",
    imageResolution: "4k",
    imageWidth: 1536,
    imageHeight: 2752,
    imageCredits: 10,
    videoToolKey: "video:btsseedance720",
    videoWidth: 720,
    videoHeight: 1280,
    videoCredits: 128,  // 16 credits/s (measured — no audio surcharge) × 8s
    withSound: true,
  },
  "bts-v4": {
    id: "bts-v4",
    label: "V4",
    tag: "Professional",
    description: "4K image · 1080p video",
    imageToolKey: "image:bts4kmax",
    imageResolution: "4k",
    imageWidth: 1536,
    imageHeight: 2752,
    imageCredits: 10,
    videoToolKey: "video:btsseedance1080",
    videoWidth: 1080,
    videoHeight: 1920,
    videoCredits: 320,  // 40 credits/s (extrapolated no-surcharge) × 8s
    withSound: true,
  },
};

// Every tier always generates with sound — crew chatter and practical set
// noise are core to the "accidental BTS phone footage" concept, so audio
// is never optional here (unlike Cartoon Drive By's silent tiers).

export const DEFAULT_QUALITY_TIER = "bts-v2";

export const QUALITY_TIER_MIN_PLAN = {
  "bts-v2": "starter",
  "bts-v3": "pro",
  "bts-v4": "generative",
};

export function getAllowedQualityTiers(planCode) {
  return sharedGetAllowedVideoModels(planCode, QUALITY_TIER_MIN_PLAN);
}

export function calcCredits(qualityId = DEFAULT_QUALITY_TIER) {
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return tier.imageCredits + tier.videoCredits;
}

/* =====================================================================
   LOCKED STYLE BIBLE — this never changes between generations. It is
   what makes every "Behind the Scenes" output recognizably the same
   fictional production, regardless of what place/disaster the user
   picks. Only the disaster module and camera vantage below are allowed
   to vary the wording; everything here is fixed.
   ===================================================================== */
const STYLE_BIBLE = [
  "a tiny handcrafted practical miniature city model built from real physical materials — weathered foam, wood, plaster, paint and metal — sitting inside an absolutely enormous aircraft-hangar-scale film soundstage",
  "a colossal blue chroma-key wall towers many storeys behind and around the miniature, extending far outside the top and sides of the frame",
  "the studio floor is covered in dense small orange VFX tracking crosses",
  "full-size human FX crew, some in generic dark 'EFFECTS CREW' or grey 'SPECIAL EFFECTS' tees, stand or work right beside the miniature, clearly dwarfing the tiny buildings — they are visibly as tall as entire miniature towers, proving the scale through body height and posture. They read as a distant row or small working group near the rig, not close-up portraits, and their faces are never the focus: shown from behind, in profile looking away, backlit in silhouette, or obscured by headsets, safety glasses and caps — anonymous crew, not identifiable individuals",
  "camera cranes, dolly track, thick coiled cables, hydraulic rigs, monitor carts, sandbags and other real film-production equipment are visible around the set",
  "flat cool LED studio lighting, realistic sensor grain, minor exposure clipping and small handheld imperfections consistent with amateur behind-the-scenes phone footage — not a polished commercial photograph",
  "composition keeps the miniature and its practical disaster confined to the lower third of the frame, leaving a huge empty upper two-thirds of soundstage and towering blue wall visible above it, its top and side edges never fully contained in frame",
  "the disaster effect itself is entirely physical and practical, rigged and operated by the visible crew — never a digital or CGI effect",
].join(". ") + ".";

const HARD_NEGATIVES =
  "No tabletop diorama, desk-scale model or model on a table with legs, no small room or low ceiling, no green screen, no sparse or oversized tracking crosses, no scene missing the full-size crew, no CGI, no 3D render, no game-engine or videogame look, no glossy Octane-style render sheen, no waxy or plastic skin, no HDR-overcooked highlights, no fantasy glow, no clean studio-photo look, no plastic or glossy toy appearance, no cartoon or cel-shaded style, no real full-size city presented as real, no logos, brand names or readable signage, no captions, subtitles, on-screen text, aspect-ratio labels, AI tool names or watermark, no close-up or clearly identifiable human faces looking toward camera.";

/* =====================================================================
   DISASTER MODULES — the primary creative dial. Each entry supplies the
   practical FX rig, how it moves across the miniature, the "hero" scale
   beat that sells the reveal, particle detail, an exclusion list (so
   unrelated disaster gear doesn't leak into frame), and the sound design
   fragments used to build the video's audio direction.
   ===================================================================== */
export const DISASTERS = {
  wave: {
    id: "wave",
    label: "Giant Wave",
    icon: "🌊",
    fx: "a real in-floor water tank with a hydraulic wave machine and pressurized dump tanks",
    precursor: "the water is already pulling back through the miniature streets in an unnatural retreating surge, pumps already rumbling under the tank and small boats or debris already rocking on the surface",
    motion: "a towering wall of water surges horizontally across the miniature skyline, swallowing entire model blocks",
    hero: "the wave crest rises several storeys above the tallest miniature tower before crashing down across the set",
    particles: "heavy spray, white foam, drifting mist and floating miniature debris",
    exclusions: "no fire, smoke, dust, wind machines or falling snow anywhere in frame",
    soundAmbience: "a steady pump hum and distant water circulation",
    soundMachine: "hydraulic wave-machine gears engaging as water surges into the tank",
    soundImpact: "a deep crashing wave impact with heavy spray and rushing water",
  },
  eruption: {
    id: "eruption",
    label: "Eruption",
    icon: "🌋",
    fx: "a rigged miniature volcano cone with pressurized pyrotechnic charges and a glowing practical fluid pump",
    precursor: "the miniature cone is already trembling faintly, thin practical smoke already leaking from the vent and a dull orange glow already flickering inside",
    motion: "a churning plume of practical smoke and glowing orange practical fluid erupts upward and rolls down the miniature slopes",
    hero: "the eruption plume towers many storeys above the miniature cone, lit from within by warm orange practical lighting",
    particles: "thick smoke, glowing embers, ash and fine airborne grit",
    exclusions: "no water tank, no wind machines, no falling snow and no earthquake rigging in frame",
    soundAmbience: "a low pressurized hiss from the charge lines",
    soundMachine: "pyrotechnic charges arming and the fluid pump spinning up",
    soundImpact: "a deep percussive eruption whump followed by a rolling rumble",
  },
  explosion: {
    id: "explosion",
    label: "Explosion",
    icon: "💥",
    fx: "compressed-air mortars and controlled pyrotechnic charges rigged beneath the miniature buildings",
    precursor: "thin smoke is already leaking from the target miniature building and warning lights on the mortar rig are already flashing",
    motion: "a sudden fireball and shockwave of debris blasts a miniature building apart, sending fragments outward across the set",
    hero: "the fireball and debris cloud rise well above the surrounding miniature skyline before dispersing",
    particles: "flame, thick smoke, flying debris chunks and drifting ash",
    exclusions: "no water tank, no wave machine, no falling snow and no dust-storm rigging in frame",
    soundAmbience: "a tense quiet with faint rigging creaks",
    soundMachine: "a mortar charge arming with a sharp electronic beep",
    soundImpact: "a sharp percussive blast with a rolling shockwave and falling debris clatter",
  },
  tornado: {
    id: "tornado",
    label: "Tornado",
    icon: "🌪️",
    fx: "a bank of industrial fans and a rotating debris drop-tube rigged above the miniature skyline",
    precursor: "the fan bank is already spinning up, loose dust and debris already skittering across the miniature rooftops in the rising draft",
    motion: "a spinning column of dust and debris tracks across the miniature grid, flinging loose model pieces upward",
    hero: "the debris funnel stretches from the tank floor up past the top of the blue chroma wall, dwarfing the miniature towers",
    particles: "swirling dust, torn paper, loose debris and haze",
    exclusions: "no fire, no pyrotechnics, no water tank and no falling snow in frame",
    soundAmbience: "a rising drone from the fan bank spinning up",
    soundMachine: "industrial fan blades roaring at full power",
    soundImpact: "a violent rushing wind with debris clattering against the rig",
  },
  flood: {
    id: "flood",
    label: "Flood",
    icon: "🌊",
    fx: "a slow-fill practical water system flooding the tank floor from hidden inlets around the miniature base",
    precursor: "water is already rising faster than normal through the miniature foundations, submersible pumps already rumbling under the tank",
    motion: "water steadily rises around the miniature foundations, submerging lower floors and drifting small debris across the surface",
    hero: "the waterline climbs several miniature storeys up the model buildings while crew wade at the tank edge to check the rigging",
    particles: "slow ripples, drifting debris and faint mist near the pumps",
    exclusions: "no pyrotechnics, no fire, no dust storm and no wind machines in frame",
    soundAmbience: "the steady trickle and gurgle of inlet valves",
    soundMachine: "submersible pumps humming as the fill rate increases",
    soundImpact: "rising water sloshing against the miniature foundations",
  },
  meteor: {
    id: "meteor",
    label: "Meteor",
    icon: "☄️",
    fx: "an overhead rigged drop cable and a pressurized impact mortar aimed at the miniature skyline",
    precursor: "a faint mechanical whir already comes from the overhead drop rig, a dim glow already visible high above the miniature grid",
    motion: "a glowing practical projectile drops from above the soundstage and slams into the miniature grid, throwing model debris outward",
    hero: "the impact plume and dust cloud rise dramatically above the miniature skyline against the towering blue wall",
    particles: "fire, smoke, flying debris and drifting dust",
    exclusions: "no water tank, no wave machine, no falling snow and no flood water in frame",
    soundAmbience: "a faint mechanical whir from the overhead drop cable",
    soundMachine: "the drop cable release clunking as the rig fires",
    soundImpact: "a heavy percussive impact boom with scattering debris",
  },
  firestorm: {
    id: "firestorm",
    label: "Firestorm",
    icon: "🔥",
    fx: "controlled pyrotechnic fire bars and smoke generators lining the miniature block",
    precursor: "thin smoke already curls from the fire bars, a faint orange glow already flickering along the miniature rooftops",
    motion: "a rolling wall of practical fire sweeps across the miniature rooftops as smoke banks billow upward",
    hero: "flame and smoke rise many storeys above the miniature skyline while crew shield their faces from the heat",
    particles: "embers, ash, thick smoke and visible heat shimmer",
    exclusions: "no water tank, no wave machine, no falling snow and no dust-storm rigging in frame",
    soundAmbience: "the low roar of gas lines feeding the fire bars",
    soundMachine: "propane igniters clicking as the fire bars light",
    soundImpact: "a steady roaring fire front with crackling debris",
  },
  blizzard: {
    id: "blizzard",
    label: "Blizzard",
    icon: "❄️",
    fx: "industrial snow cannons and wind machines rigged around the miniature perimeter",
    precursor: "the snow cannons are already spitting stray particles and loose snow is already skittering off miniature rooftops in the rising wind",
    motion: "dense practical snow and wind sweep horizontally across the miniature skyline, piling against model rooftops",
    hero: "whiteout gusts obscure the tallest miniature towers as snow banks build rapidly at street level",
    particles: "driving snow, blown ice chips and drifting fog",
    exclusions: "no fire, no pyrotechnics, no water tank and no dust in frame",
    soundAmbience: "a cold, thin wind hiss from the fan bank idling",
    soundMachine: "snow cannons pressurizing and wind machines spinning up",
    soundImpact: "a driving blast of wind and snow rattling loose set pieces",
  },

  // The 12 modules below extend the original 8 elemental disasters into
  // creature, vehicle and set-piece "movie shoot" territory — same locked
  // fields, same prompt assembly, just a wider range of practical rigs.
  creature: {
    id: "creature",
    label: "Giant Creature",
    icon: "🦖",
    fx: "a full-size FX crew operating a towering original creature rig alongside miniature toy vehicles, helicopters and debris scattered across the set",
    precursor: "the creature rig's hydraulics are already hissing and trembling, fine dust already sifting from nearby miniature rooftops",
    motion: "the creature rig lumbers through the miniature grid, crushing model buildings and swatting aside toy vehicles with each motion",
    hero: "the creature towers many storeys above the miniature skyline, dwarfing both the tiny buildings and the full-size crew operating its rig",
    particles: "falling debris, dust, snapped miniature power lines and drifting smoke",
    exclusions: "no water tank, no wave machine, no snow cannons and no aircraft wire rigs unrelated to the creature shot",
    soundAmbience: "a low mechanical whir from the creature rig's hydraulics idling",
    soundMachine: "the rig's servo motors engaging as the creature begins to move",
    soundImpact: "a heavy footstep thud shaking the set, followed by crumbling debris",
  },
  aircraft: {
    id: "aircraft",
    label: "Aircraft Chase",
    icon: "🚁",
    fx: "wire-rigged miniature helicopters and aircraft flown on practical cable rigs above the model, with wind machines and smoke cannons operating below",
    precursor: "the miniature aircraft's rotor is already spinning on its wire rig, rotor wash already disturbing loose dust below",
    motion: "the miniature aircraft sweep low across the model skyline on their rig cables while practical smoke and debris chase them from below",
    hero: "the aircraft weave between miniature towers just above rooftop height, the full-size rig operators visible tensioning the flight cables",
    particles: "engine haze, drifting smoke and debris kicked up by the wind machines",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    soundAmbience: "a faint rotor hum from the rigged models",
    soundMachine: "wind machines spinning up beneath the flight rig",
    soundImpact: "a sharp burst of rotor wash and debris as the aircraft sweeps past",
  },
  "vehicle-chase": {
    id: "vehicle-chase",
    label: "Vehicle Chase",
    icon: "🚂",
    fx: "a motorized track rig driving miniature vehicles — trains, cars or trucks — through the model at speed while crew operate practical debris cannons alongside",
    precursor: "the track rig motor is already humming and building speed, the miniature vehicle already trembling on its rails",
    motion: "the miniature vehicle races along its track rig through the model streets as practical debris and sparks kick up around it",
    hero: "the vehicle rig reaches full speed through the miniature set, full-size crew tracking it with a handheld camera at the tank edge",
    particles: "kicked-up dust, sparks and small debris trailing behind the vehicle rig",
    exclusions: "no water tank, no wave machine, no fire pits and no creature rig in frame",
    soundAmbience: "a faint mechanical hum from the track rig motor idling",
    soundMachine: "the track rig motor spinning up to speed",
    soundImpact: "a loud rattling clatter as the vehicle rig races past at full speed",
  },
  collapse: {
    id: "collapse",
    label: "Structural Collapse",
    icon: "🏢",
    fx: "rigged miniature structures — bridges, towers or cranes — wired with pyrotechnic collapse charges and pull-cables operated by the FX crew",
    precursor: "the rigged structure is already creaking under tension, fine dust already sifting from its joints",
    motion: "the miniature structure buckles and collapses section by section as the pull-cables release and dust cannons fire",
    hero: "the structure comes down in a single dramatic collapse, throwing debris and dust many storeys above the surrounding miniature skyline",
    particles: "billowing dust, falling debris chunks and drifting concrete haze",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    soundAmbience: "a faint creak from the rigged structure under tension",
    soundMachine: "collapse charges arming along the structure",
    soundImpact: "a deep rumbling collapse with cascading debris impacts",
  },
  "ship-disaster": {
    id: "ship-disaster",
    label: "Ship Disaster",
    icon: "🚢",
    fx: "a large miniature ship model rigged on a motorized track through the FX water tank, with practical wave machines and dump tanks operating around it",
    precursor: "the ship rig's motor is already churning water at the tank edge, waves already lapping harder than normal against the miniature docks",
    motion: "the miniature ship carves through the tank at speed, its motorized hull throwing spray and rocking against practical waves",
    hero: "the ship rig plows through the miniature waterfront, its hull towering over nearby model docks and buildings",
    particles: "heavy spray, foam and floating miniature debris",
    exclusions: "no fire, smoke, dust, wind machines or falling snow anywhere in frame",
    soundAmbience: "a steady pump hum and distant water circulation",
    soundMachine: "the ship rig's motor engaging as it enters the tank",
    soundImpact: "a deep hull impact with heavy spray and rushing water",
  },
  avalanche: {
    id: "avalanche",
    label: "Avalanche",
    icon: "🏔️",
    fx: "an elevated snow-mass drop rig above the miniature mountain, releasing tons of practical fake snow down a chute onto the model",
    precursor: "loose snow is already sliding and hissing down the drop-chute above the mountain model, a faint rumble already building",
    motion: "a wall of practical snow crashes down the mountain slope, swallowing the miniature village beneath it in seconds",
    hero: "the snow mass rises many storeys above the miniature rooftops as it rolls downhill, crew bracing at the tank edge",
    particles: "billowing snow powder, drifting ice chips and fine white haze",
    exclusions: "no fire, no pyrotechnics, no water tank and no dust in frame",
    soundAmbience: "a distant rumble from the snow rig's release mechanism arming",
    soundMachine: "the drop-chute gate releasing tons of practical snow",
    soundImpact: "a deep rolling rumble as the snow mass crashes over the model",
  },
  "alien-craft": {
    id: "alien-craft",
    label: "Alien Craft",
    icon: "🛸",
    fx: "a rigged miniature hovering craft suspended on wires above the model, with practical light rigs, wind machines and haze generators",
    precursor: "the craft rig's underside lights are already flickering and sweeping, wind machines already stirring dust below it",
    motion: "the craft hovers and drifts above the miniature skyline on its wire rig while practical wind and light effects sweep the set",
    hero: "the craft towers over the miniature rooftops, its underside lights sweeping the model as wind machines flatten nearby structures",
    particles: "swirling haze, drifting dust and debris kicked up by the wind machines",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    soundAmbience: "a low electronic hum from the craft rig's light system",
    soundMachine: "the wire rig's winches engaging as the craft descends",
    soundImpact: "a deep bass pulse as the craft's lights sweep across the model",
  },
  "giant-robot": {
    id: "giant-robot",
    label: "Giant Robot",
    icon: "🤖",
    fx: "a full-size hydraulic robot rig walking on a motion-control leg mechanism through the miniature grid",
    precursor: "the robot rig's hydraulic joints are already hissing and flexing, fine dust already falling from miniature rooftops beneath its feet",
    motion: "the robot rig takes slow, heavy steps through the model streets, each footfall crushing miniature buildings beneath it",
    hero: "the robot towers many storeys above the miniature skyline, its hydraulic joints hissing as the full-size crew operate the rig nearby",
    particles: "falling debris, dust and drifting hydraulic fluid haze",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    soundAmbience: "a low hydraulic hiss from the robot rig idling",
    soundMachine: "hydraulic pistons engaging as the robot rig begins to move",
    soundImpact: "a heavy metallic footstep thud shaking the miniature set",
  },
  sandstorm: {
    id: "sandstorm",
    label: "Sandstorm",
    icon: "🏜️",
    fx: "industrial dust cannons and wind turbines rigged around the miniature perimeter, blasting fine sand across the set",
    precursor: "the dust cannons are already hissing, fine sand already drifting across the miniature streets in the rising wind",
    motion: "a dense wall of practical sand and dust rolls across the miniature skyline, swallowing model towers one by one",
    hero: "the dust wall towers above the tallest miniature building before fully engulfing the set in haze",
    particles: "fine blown sand, dust haze and grit drifting across the frame",
    exclusions: "no fire, no water tank, no snow and no creature or vehicle rigs in frame",
    soundAmbience: "a low hiss from the dust cannons idling",
    soundMachine: "wind turbines spinning up to full power",
    soundImpact: "a roaring blast of wind and sand tearing across the model",
  },
  superstorm: {
    id: "superstorm",
    label: "Superstorm",
    icon: "⚡",
    fx: "rain bars, wind turbines and a practical water tank operating together around the miniature model, with lightning-strobe rigs overhead",
    precursor: "the rain bars are already misting and the wind turbines already spinning up, strobe rigs already flickering faintly overhead",
    motion: "driving rain, wind and rising water hit the miniature set simultaneously as strobe lights simulate lightning overhead",
    hero: "the storm engulfs the entire miniature skyline at once, water rising at street level while wind tears at rooftops",
    particles: "heavy rain, wind-blown debris and drifting spray",
    exclusions: "no fire, no pyrotechnics, no dust and no snow in frame",
    soundAmbience: "a steady patter of rain bars warming up",
    soundMachine: "wind turbines and rain bars spinning up together",
    soundImpact: "a violent crash of thunder-strobe, wind and rushing water",
  },
  "fire-tornado": {
    id: "fire-tornado",
    label: "Fire Tornado",
    icon: "🔥",
    fx: "controlled pyrotechnic fire bars paired with a rotating wind rig, spinning flame into a vertical vortex above the miniature set",
    precursor: "the fire bars are already glowing and the wind rig already spinning up around them, smoke already curling upward in a slow twist",
    motion: "a spinning column of practical fire tracks across the miniature grid, the wind rig twisting the flame into a rotating vortex",
    hero: "the fire vortex stretches from the tank floor past the top of the blue chroma wall, towering over the miniature skyline",
    particles: "swirling embers, smoke and drifting ash caught in the vortex",
    exclusions: "no water tank, no snow cannons and no dust storm rigs in frame",
    soundAmbience: "a low roar from the fire bars and wind rig idling together",
    soundMachine: "the wind rig spinning up as the fire bars ignite",
    soundImpact: "a roaring rush of spinning flame and rattling debris",
  },
  earthquake: {
    id: "earthquake",
    label: "Earthquake",
    icon: "🏚️",
    fx: "hydraulic shaker platforms beneath the miniature model paired with a hidden ground-split rig that pulls the street apart",
    precursor: "the shaker platform is already humming beneath the model, fine dust already sifting off miniature rooftops",
    motion: "the miniature ground shakes violently as the shaker platform vibrates the model and the hidden rig splits the street open",
    hero: "a widening chasm tears through the miniature street as buildings on either side tilt and crumble into it",
    particles: "falling debris, dust and cracking pavement fragments",
    exclusions: "no fire, no water tank, no snow and no creature or aircraft rigs in frame",
    soundAmbience: "a low rumble from the shaker platform idling",
    soundMachine: "hydraulic shakers engaging as the platform ramps up",
    soundImpact: "a deep grinding rumble as the ground splits and debris crashes down",
  },
};

export const DEFAULT_DISASTER = "wave";

function disasterModule(id) {
  return DISASTERS[id] ?? DISASTERS[DEFAULT_DISASTER];
}

/* =====================================================================
   CAMERA VANTAGE MODULES — the secondary, optional dial. Controls where
   the "crew member's phone" is standing when the shot is captured.
   ===================================================================== */
export const VANTAGES = {
  "tank-edge": {
    id: "tank-edge",
    label: "Tank Edge",
    sublabel: "Closest to the chaos",
    capture: "from ground level right beside the FX tank, low next to the crew and equipment",
    framing: "the closest crew member's shoulder or back visible at the frame edge, face turned away from camera toward the set, tangled cables and hoses crossing the foreground, rigging carts and monitors nearby",
  },
  gantry: {
    id: "gantry",
    label: "Gantry",
    sublabel: "Full scale reveal",
    capture: "from an elevated gantry looking down over the entire miniature set",
    framing: "a metal guardrail bar low in frame, the full tank and miniature skyline spread out below, crew visible only from behind or in silhouette on the catwalk, catwalk lighting rigs visible at the edges",
  },
  "crane-follow": {
    id: "crane-follow",
    label: "Crane Follow",
    sublabel: "Most cinematic",
    capture: "from a camera crane sweeping low over the miniature during the impact",
    framing: "the crane arm and cable rigging faintly visible at the frame edge, any crew glimpsed only from behind or blurred by motion, subtle motion blur on nearby equipment as the crane moves",
  },
};

export const DEFAULT_VANTAGE = "tank-edge";

function vantageModule(id) {
  return VANTAGES[id] ?? VANTAGES[DEFAULT_VANTAGE];
}

/* =====================================================================
   EPISODE IDEAS — preconfigured place + disaster + vantage combos, one
   per disaster module. These are what make the template feel like a
   repeatable series format instead of a single generator: they power
   the "Trending Episode Ideas" chips, "Surprise Me", and the
   post-generation "make the next episode" shortcuts.
   ===================================================================== */
export const EPISODE_IDEAS = [
  // 🌊 Wave
  { id: "wave-harbor", label: "Giant Wave vs Neon Harbor", icon: "🌊", place: "A neon-lit harbor metropolis of glass towers along the waterfront", disaster: "wave", vantage: "tank-edge" },
  { id: "wave-island", label: "Giant Wave vs Island Resort", icon: "🌊", place: "A tropical island resort town of white stucco villas and palm-lined promenades", disaster: "wave", vantage: "crane-follow" },
  { id: "wave-fishing-port", label: "Giant Wave vs Fishing Port", icon: "🌊", place: "A foggy northern fishing port of weathered timber docks and steep-roofed warehouses", disaster: "wave", vantage: "gantry" },
  { id: "wave-boardwalk", label: "Giant Wave vs Boardwalk City", icon: "🌊", place: "A sun-bleached seaside boardwalk city of pastel arcade buildings and a wooden pier", disaster: "wave", vantage: "tank-edge" },

  // 🌋 Eruption
  { id: "eruption-mountain", label: "Eruption vs Mountain City", icon: "🌋", place: "A mountainside city of terraced stone buildings climbing a steep slope", disaster: "eruption", vantage: "tank-edge" },
  { id: "eruption-island", label: "Eruption vs Volcanic Island Town", icon: "🌋", place: "A tropical volcanic island town of thatched roofs and black-sand shoreline streets", disaster: "eruption", vantage: "crane-follow" },
  { id: "eruption-hillside", label: "Eruption vs Andean Hillside Town", icon: "🌋", place: "A steep hillside town of colorful stacked stone houses", disaster: "eruption", vantage: "gantry" },
  { id: "eruption-monastery", label: "Eruption vs Cliffside Monastery Town", icon: "🌋", place: "A cliffside monastery town of whitewashed stone buildings perched above a ravine", disaster: "eruption", vantage: "tank-edge" },

  // 💥 Explosion
  { id: "explosion-downtown", label: "Explosion vs Downtown Block", icon: "💥", place: "A dense Mediterranean-style harbor metropolis of pale stone towers", disaster: "explosion", vantage: "tank-edge" },
  { id: "explosion-industrial", label: "Explosion vs Industrial Dockyard", icon: "💥", place: "A gritty industrial dockyard district of rusted warehouses and shipping cranes", disaster: "explosion", vantage: "crane-follow" },
  { id: "explosion-market", label: "Explosion vs Neon Night Market", icon: "💥", place: "A dense neon night-market district of stacked signage and narrow alleys", disaster: "explosion", vantage: "gantry" },
  { id: "explosion-highrise", label: "Explosion vs Glass High-Rise Block", icon: "💥", place: "A dense glass high-rise business block of mirrored office towers", disaster: "explosion", vantage: "tank-edge" },

  // 🌪️ Tornado
  { id: "tornado-coast", label: "Tornado vs Coastal Skyline", icon: "🌪️", place: "A dense coastal skyline of pale stone towers along a harbor promenade", disaster: "tornado", vantage: "gantry" },
  { id: "tornado-prairie", label: "Tornado vs Prairie Grain Town", icon: "🌪️", place: "A flat prairie grain-town skyline of tall silos and a wide main street", disaster: "tornado", vantage: "tank-edge" },
  { id: "tornado-suburb", label: "Tornado vs Suburban Cul-de-Sac", icon: "🌪️", place: "A quiet suburban miniature town of pitched-roof houses along curved streets", disaster: "tornado", vantage: "crane-follow" },
  { id: "tornado-motel-strip", label: "Tornado vs Roadside Motel Strip", icon: "🌪️", place: "A sun-faded roadside motel strip of neon signs and single-storey buildings", disaster: "tornado", vantage: "gantry" },

  // 🌊 Flood
  { id: "flood-river", label: "Flood vs Old River City", icon: "🌊", place: "A historic European river city with domed rooftops and stone bridges", disaster: "flood", vantage: "gantry" },
  { id: "flood-delta", label: "Flood vs Delta Stilt City", icon: "🌊", place: "A low-lying delta city of houses raised on wooden stilts above the water", disaster: "flood", vantage: "tank-edge" },
  { id: "flood-canal", label: "Flood vs Canal Old Town", icon: "🌊", place: "A canal-laced old town of narrow brick townhouses and arched footbridges", disaster: "flood", vantage: "crane-follow" },
  { id: "flood-lowland", label: "Flood vs Lowland Farm Village", icon: "🌊", place: "A lowland farm village of thatched cottages behind a low earthen levee", disaster: "flood", vantage: "gantry" },

  // ☄️ Meteor
  { id: "meteor-desert", label: "Meteor vs Desert City", icon: "☄️", place: "A desert skyline of sand-colored towers and wind-carved spires", disaster: "meteor", vantage: "crane-follow" },
  { id: "meteor-observatory", label: "Meteor vs Mountain Observatory Town", icon: "☄️", place: "A snow-capped mountain observatory town of white domes and stone lodges", disaster: "meteor", vantage: "tank-edge" },
  { id: "meteor-outpost", label: "Meteor vs Salt-Flat Outpost", icon: "☄️", place: "A flat salt-plain research outpost of low metal buildings and antenna towers", disaster: "meteor", vantage: "gantry" },
  { id: "meteor-canyon", label: "Meteor vs Canyon Rim Town", icon: "☄️", place: "A canyon-rim frontier town of red-rock buildings along a dusty ridge", disaster: "meteor", vantage: "crane-follow" },

  // 🔥 Firestorm
  { id: "firestorm-downtown", label: "Firestorm vs Dense Downtown", icon: "🔥", place: "A dense futuristic downtown of tall glass megatowers", disaster: "firestorm", vantage: "crane-follow" },
  { id: "firestorm-vineyard", label: "Firestorm vs Hillside Vineyard Town", icon: "🔥", place: "A dry hillside vineyard town of terracotta-roofed stone villas", disaster: "firestorm", vantage: "tank-edge" },
  { id: "firestorm-timber", label: "Firestorm vs Old Timber District", icon: "🔥", place: "A wooden old-town timber district of tightly packed clapboard buildings", disaster: "firestorm", vantage: "gantry" },
  { id: "firestorm-ranch", label: "Firestorm vs Ranchland Township", icon: "🔥", place: "A dusty ranchland township of low wooden storefronts along a wide dirt road", disaster: "firestorm", vantage: "tank-edge" },

  // ❄️ Blizzard
  { id: "blizzard-mountain", label: "Blizzard vs Mountain City", icon: "❄️", place: "A mountain city of steep-roofed stone buildings above a frozen valley", disaster: "blizzard", vantage: "gantry" },
  { id: "blizzard-fjord", label: "Blizzard vs Nordic Fjord Town", icon: "❄️", place: "A fjord town of timber houses lining a narrow frozen inlet", disaster: "blizzard", vantage: "crane-follow" },
  { id: "blizzard-alpine", label: "Blizzard vs Alpine Ski Town", icon: "❄️", place: "A high-altitude alpine ski town of chalets and a central bell tower", disaster: "blizzard", vantage: "tank-edge" },
  { id: "blizzard-tundra", label: "Blizzard vs Tundra Outpost", icon: "❄️", place: "A remote tundra outpost of insulated metal buildings on a frozen plain", disaster: "blizzard", vantage: "gantry" },

  // 🦖 Giant Creature
  { id: "creature-01", label: "Helicopters vs Giant Ape", icon: "🚁", place: "A dense downtown of tall glass towers around a wide central plaza", disaster: "creature", vantage: "tank-edge" },
  { id: "creature-02", label: "Giant Creature vs Downtown Convoy", icon: "🦖", place: "A busy downtown avenue lined with mid-rise office towers", disaster: "creature", vantage: "gantry" },
  { id: "creature-03", label: "Helicopter Chase Through Monster Attack", icon: "🚁", place: "A mountainside city of terraced stone buildings", disaster: "creature", vantage: "crane-follow" },
  { id: "creature-04", label: "Sea Monster vs Suspension Bridge", icon: "🐙", place: "A harbor city spanned by a tall suspension bridge", disaster: "creature", vantage: "tank-edge" },
  { id: "creature-05", label: "Creature Smashes Through Airport", icon: "🦖", place: "A flat airport-district skyline of low terminal buildings and control towers", disaster: "creature", vantage: "gantry" },
  { id: "creature-06", label: "Giant Ape vs Mountain Fortress", icon: "🦍", place: "A mountain city crowned by a stone hilltop fortress", disaster: "creature", vantage: "crane-follow" },
  { id: "creature-07", label: "Winged Beast Attacks Castle City", icon: "🐉", place: "A medieval castle city of stone ramparts and narrow lanes", disaster: "creature", vantage: "tank-edge" },
  { id: "creature-08", label: "Tentacles Rise Through Harbor City", icon: "🐙", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "creature", vantage: "gantry" },
  { id: "creature-09", label: "Monster Emerges Behind Tiny Stadium", icon: "🦖", place: "A stadium district skyline surrounding a huge miniature arena", disaster: "creature", vantage: "crane-follow" },
  { id: "creature-10", label: "Creature Stops Runaway Train", icon: "🚂", place: "A dense railway city crossed by elevated tracks", disaster: "creature", vantage: "tank-edge" },

  // 🚁 Airborne
  { id: "aircraft-01", label: "Helicopter Chase Through Neon City", icon: "🚁", place: "A neon-lit futuristic downtown with tall glass megatowers", disaster: "aircraft", vantage: "gantry" },
  { id: "aircraft-02", label: "Helicopters Circle Erupting Volcano", icon: "🚁", place: "A tropical volcanic island town of thatched roofs and black-sand streets", disaster: "eruption", vantage: "crane-follow" },
  { id: "aircraft-03", label: "Cargo Plane Skims Downtown Rooftops", icon: "✈️", place: "A dense mid-rise downtown of flat rooftops and water towers", disaster: "aircraft", vantage: "tank-edge" },
  { id: "aircraft-04", label: "Helicopter Rescue During Giant Flood", icon: "🚁", place: "A historic river city with domed rooftops and stone bridges", disaster: "flood", vantage: "gantry" },
  { id: "aircraft-05", label: "Airliner Emergency Over Mountain City", icon: "✈️", place: "A snow-capped mountain city of steep-roofed stone buildings", disaster: "blizzard", vantage: "crane-follow" },
  { id: "aircraft-06", label: "Helicopter vs Tornado", icon: "🚁", place: "A flat prairie town skyline of tall silos and a wide main street", disaster: "tornado", vantage: "tank-edge" },
  { id: "aircraft-07", label: "Plane Flies Through Meteor Impact", icon: "✈️", place: "A desert skyline of sand-colored towers and wind-carved spires", disaster: "meteor", vantage: "gantry" },
  { id: "aircraft-08", label: "Helicopter Escapes Collapsing Dam", icon: "🚁", place: "A mountain valley town below a tall concrete dam", disaster: "collapse", vantage: "crane-follow" },
  { id: "aircraft-09", label: "Cargo Plane Lands on Flooded Runway", icon: "✈️", place: "A coastal airport skyline of low terminal buildings", disaster: "flood", vantage: "tank-edge" },
  { id: "aircraft-10", label: "Helicopters Search Abandoned Snow City", icon: "🚁", place: "A mountain city of steep-roofed stone buildings above a frozen valley", disaster: "blizzard", vantage: "gantry" },

  // 🚂 Runaway Vehicles
  { id: "vehicle-01", label: "Runaway Train Through Flooded City", icon: "🚂", place: "A historic river city with domed rooftops and stone bridges", disaster: "vehicle-chase", vantage: "crane-follow" },
  { id: "vehicle-02", label: "Train Crosses Bridge During Earthquake", icon: "🚂", place: "A dense downtown spanned by a tall railway bridge", disaster: "earthquake", vantage: "tank-edge" },
  { id: "vehicle-03", label: "Subway Bursts Through Downtown Street", icon: "🚇", place: "A dense underground-transit downtown of narrow city blocks", disaster: "vehicle-chase", vantage: "gantry" },
  { id: "vehicle-04", label: "Train vs Avalanche", icon: "🚂", place: "A mountain city of steep-roofed stone buildings above a frozen valley", disaster: "avalanche", vantage: "crane-follow" },
  { id: "vehicle-05", label: "Convoy Escapes Giant Sandstorm", icon: "🚛", place: "A desert highway town of low sand-colored buildings", disaster: "sandstorm", vantage: "tank-edge" },
  { id: "vehicle-06", label: "Bus Jumps Collapsing Bridge", icon: "🚌", place: "A dense harbor city spanned by a tall suspension bridge", disaster: "collapse", vantage: "gantry" },
  { id: "vehicle-07", label: "Cars Escape Falling Skyscraper", icon: "🚗", place: "A dense glass high-rise business block of mirrored office towers", disaster: "collapse", vantage: "crane-follow" },
  { id: "vehicle-08", label: "Train Through Burning Forest Town", icon: "🚂", place: "A wooden old-town timber district surrounded by dense forest", disaster: "firestorm", vantage: "tank-edge" },
  { id: "vehicle-09", label: "Fuel Truck Escapes Volcano", icon: "🚛", place: "A mountainside city of terraced stone buildings climbing a steep slope", disaster: "eruption", vantage: "gantry" },
  { id: "vehicle-10", label: "Highway Chase During Meteor Shower", icon: "🚗", place: "A desert highway skyline of low sand-colored buildings", disaster: "meteor", vantage: "crane-follow" },

  // 🌉 Massive Destruction
  { id: "collapse-01", label: "Suspension Bridge Snaps During Giant Wave", icon: "🌉", place: "A harbor city spanned by a tall suspension bridge", disaster: "wave", vantage: "tank-edge" },
  { id: "collapse-02", label: "Skyscraper Falls Across Downtown Avenue", icon: "🏢", place: "A dense glass high-rise business block of mirrored office towers", disaster: "collapse", vantage: "gantry" },
  { id: "collapse-03", label: "Construction Crane Falls Between Towers", icon: "🏗️", place: "A half-built downtown of construction cranes and mid-rise towers", disaster: "collapse", vantage: "crane-follow" },
  { id: "collapse-04", label: "Observation Tower Collapses Into Harbor", icon: "🗼", place: "A waterfront city crowned by a tall observation tower", disaster: "collapse", vantage: "tank-edge" },
  { id: "collapse-05", label: "Stadium Roof Collapses During Storm", icon: "🏟️", place: "A stadium district skyline surrounding a huge miniature arena", disaster: "superstorm", vantage: "gantry" },
  { id: "collapse-06", label: "Mountain Splits Above Tiny Village", icon: "🏔️", place: "A small mountain village of stone cottages beneath a steep ridge", disaster: "earthquake", vantage: "crane-follow" },
  { id: "collapse-07", label: "Bridge Collapses Under Runaway Train", icon: "🌉", place: "A dense railway city crossed by a tall iron bridge", disaster: "collapse", vantage: "tank-edge" },
  { id: "collapse-08", label: "Two Towers Collide During Earthquake", icon: "🏢", place: "A dense downtown of tall glass towers and a wide central avenue", disaster: "earthquake", vantage: "gantry" },
  { id: "collapse-09", label: "Elevated Highway Pancakes Through Downtown", icon: "🛣️", place: "A dense downtown crossed by an elevated highway", disaster: "collapse", vantage: "crane-follow" },
  { id: "collapse-10", label: "Cliffside Fortress Falls Into Sea", icon: "🏰", place: "A cliffside coastal town crowned by a stone fortress", disaster: "collapse", vantage: "tank-edge" },

  // 🌊 Water Movie Sets
  { id: "water-01", label: "Cruise Ship vs Giant Wave", icon: "🚢", place: "A dense coastal metropolis of pale stone towers along a harbor promenade", disaster: "ship-disaster", vantage: "gantry" },
  { id: "water-02", label: "Ocean Liner Crashes Into Harbor", icon: "🛳️", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "ship-disaster", vantage: "crane-follow" },
  { id: "water-03", label: "Flood Explodes Out of Subway Entrance", icon: "🚇", place: "A dense underground-transit downtown of narrow city blocks", disaster: "flood", vantage: "tank-edge" },
  { id: "water-04", label: "Wave Overtakes Bridge Traffic", icon: "🌉", place: "A coastal city spanned by a long low bridge", disaster: "wave", vantage: "gantry" },
  { id: "water-05", label: "Dam Break Above Mountain City", icon: "🏙️", place: "A mountain valley town below a tall concrete dam", disaster: "flood", vantage: "crane-follow" },
  { id: "water-06", label: "Container Ship Swept Into Downtown", icon: "🚢", place: "A dense downtown of tall glass towers along the waterfront", disaster: "ship-disaster", vantage: "tank-edge" },
  { id: "water-07", label: "Island Resort Disappears Under Wave", icon: "🏝️", place: "A tropical island resort town of white stucco villas and palm-lined promenades", disaster: "wave", vantage: "gantry" },
  { id: "water-08", label: "Rooftop Rescue During Flood", icon: "🚁", place: "A historic river city with domed rooftops and stone bridges", disaster: "flood", vantage: "crane-follow" },
  { id: "water-09", label: "Enormous Sea Creature Surfaces Beside City", icon: "🐋", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "creature", vantage: "tank-edge" },
  { id: "water-10", label: "Harbor Chain Reaction", icon: "⚓", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "ship-disaster", vantage: "gantry" },

  // ❄️ Frozen Blockbusters
  { id: "frozen-01", label: "Helicopter Rescue in Whiteout", icon: "🚁", place: "A mountain city of steep-roofed stone buildings above a frozen valley", disaster: "blizzard", vantage: "crane-follow" },
  { id: "frozen-02", label: "Avalanche Buries Mountain Resort", icon: "🏔️", place: "A high-altitude alpine ski town of chalets and a central bell tower", disaster: "avalanche", vantage: "tank-edge" },
  { id: "frozen-03", label: "Frozen Bridge Breaks Under Convoy", icon: "🌉", place: "A fjord town of timber houses lining a narrow frozen inlet", disaster: "collapse", vantage: "gantry" },
  { id: "frozen-04", label: "Plane Lands During Impossible Blizzard", icon: "✈️", place: "A remote tundra outpost of insulated metal buildings on a frozen plain", disaster: "blizzard", vantage: "crane-follow" },
  { id: "frozen-05", label: "Instant Freeze Hits Downtown", icon: "🏙️", place: "A dense downtown of tall glass towers and a wide central avenue", disaster: "blizzard", vantage: "tank-edge" },
  { id: "frozen-06", label: "Ice Creature Emerges From Mountain", icon: "🧊", place: "A mountain city of steep-roofed stone buildings above a frozen valley", disaster: "creature", vantage: "gantry" },
  { id: "frozen-07", label: "Cable Cars Swing During Avalanche", icon: "🚠", place: "A high-altitude alpine ski town of chalets and a central bell tower", disaster: "avalanche", vantage: "crane-follow" },
  { id: "frozen-08", label: "Snowstorm Buries Entire Village", icon: "🏚️", place: "A small mountain village of stone cottages beneath a steep ridge", disaster: "blizzard", vantage: "tank-edge" },
  { id: "frozen-09", label: "Frozen Railway Bridge Collapse", icon: "🚂", place: "A fjord town of timber houses lining a narrow frozen inlet", disaster: "collapse", vantage: "gantry" },

  // ☄️ Sci-Fi Movie Sets
  { id: "scifi-01", label: "Massive Alien Machine Over Downtown", icon: "🛸", place: "A dense futuristic downtown of tall glass megatowers", disaster: "alien-craft", vantage: "crane-follow" },
  { id: "scifi-02", label: "Meteor Hits Behind Tiny Skyline", icon: "☄️", place: "A dense coastal metropolis of pale stone towers along a harbor promenade", disaster: "meteor", vantage: "tank-edge" },
  { id: "scifi-03", label: "Giant Robot Walks Through Harbor", icon: "🤖", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "giant-robot", vantage: "gantry" },
  { id: "scifi-04", label: "Alien Craft Crashes Into Desert City", icon: "🛸", place: "A desert skyline of sand-colored towers and wind-carved spires", disaster: "alien-craft", vantage: "crane-follow" },
  { id: "scifi-05", label: "Energy Storm Hits Futuristic City", icon: "⚡", place: "A neon-lit futuristic downtown with tall glass megatowers", disaster: "superstorm", vantage: "tank-edge" },
  { id: "scifi-06", label: "Two Giant Robots Fight Over Tiny Downtown", icon: "🤖", place: "A dense downtown of tall glass towers and a wide central avenue", disaster: "giant-robot", vantage: "gantry" },
  { id: "scifi-07", label: "Portal Opens Above Mountain City", icon: "🌌", place: "A mountainside city of terraced stone buildings climbing a steep slope", disaster: "alien-craft", vantage: "crane-follow" },
  { id: "scifi-08", label: "UFO Abduction Over Tiny Farm Town", icon: "🛸", place: "A flat prairie grain-town skyline of tall silos and a wide main street", disaster: "alien-craft", vantage: "tank-edge" },
  { id: "scifi-09", label: "Meteor Splashes Into Harbor", icon: "☄️", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "meteor", vantage: "gantry" },
  { id: "scifi-10", label: "Robot Emerges From Flooded City", icon: "🤖", place: "A historic river city with domed rooftops and stone bridges", disaster: "giant-robot", vantage: "crane-follow" },

  // 🔥 Practical Action Set Pieces
  { id: "action-01", label: "Helicopter Escapes Refinery Explosion", icon: "🚁", place: "A gritty industrial refinery district of tanks, pipes and gantries", disaster: "explosion", vantage: "tank-edge" },
  { id: "action-02", label: "Train Races Through Exploding Tunnel", icon: "🚂", place: "A dense railway city crossed by elevated tracks", disaster: "vehicle-chase", vantage: "gantry" },
  { id: "action-03", label: "Car Chase Through Collapsing Market", icon: "🚗", place: "A dense neon night-market district of stacked signage and narrow alleys", disaster: "vehicle-chase", vantage: "crane-follow" },
  { id: "action-04", label: "Convoy Crosses Burning Bridge", icon: "🚛", place: "A coastal city spanned by a long low bridge", disaster: "firestorm", vantage: "tank-edge" },
  { id: "action-05", label: "Factory Chain-Reaction Explosion", icon: "🏭", place: "A gritty industrial dockyard district of rusted warehouses and shipping cranes", disaster: "explosion", vantage: "gantry" },
  { id: "action-06", label: "Rooftop Extraction During Firestorm", icon: "🚁", place: "A dense futuristic downtown of tall glass megatowers", disaster: "firestorm", vantage: "crane-follow" },
  { id: "action-07", label: "Armored Convoy vs Falling Buildings", icon: "🚗", place: "A dense downtown of tall glass towers and a wide central avenue", disaster: "collapse", vantage: "tank-edge" },
  { id: "action-08", label: "Train Bursts Through Burning Station", icon: "🚂", place: "A wooden old-town timber district of tightly packed clapboard buildings", disaster: "firestorm", vantage: "gantry" },
  { id: "action-09", label: "Crane Rescue During Tower Collapse", icon: "🏗️", place: "A half-built downtown of construction cranes and mid-rise towers", disaster: "collapse", vantage: "crane-follow" },
  { id: "action-10", label: "Cargo Ship Escapes Exploding Harbor", icon: "🚢", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "explosion", vantage: "tank-edge" },

  // 🌪️ Impossible Natural Disasters
  { id: "combo-01", label: "Twin Tornadoes Trap Downtown", icon: "🌪️", place: "A dense downtown of tall glass towers and a wide central avenue", disaster: "tornado", vantage: "gantry" },
  { id: "combo-02", label: "Volcano Erupts Beneath Snow City", icon: "🌋", place: "A mountain city of steep-roofed stone buildings above a frozen valley", disaster: "eruption", vantage: "crane-follow" },
  { id: "combo-03", label: "Giant Wave Hits During Tornado", icon: "🌊", place: "A dense coastal skyline of pale stone towers along a harbor promenade", disaster: "wave", vantage: "tank-edge" },
  { id: "combo-04", label: "Meteor Triggers Giant Wave", icon: "☄️", place: "A dense coastal metropolis of pale stone towers along a harbor promenade", disaster: "meteor", vantage: "gantry" },
  { id: "combo-05", label: "Eruption Triggers Avalanche", icon: "🌋", place: "A mountainside city of terraced stone buildings climbing a steep slope", disaster: "eruption", vantage: "crane-follow" },
  { id: "combo-06", label: "Sandstorm Swallows Neon City", icon: "🏜️", place: "A neon-lit futuristic downtown with tall glass megatowers", disaster: "sandstorm", vantage: "tank-edge" },
  { id: "combo-07", label: "Superstorm Over Island City", icon: "⚡", place: "A tropical island resort town of white stucco villas and palm-lined promenades", disaster: "superstorm", vantage: "gantry" },
  { id: "combo-08", label: "Earthquake Splits Harbor in Half", icon: "🏚️", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "earthquake", vantage: "crane-follow" },
  { id: "combo-09", label: "Dam Break During Blizzard", icon: "🌊", place: "A mountain valley town below a tall concrete dam", disaster: "flood", vantage: "tank-edge" },
  { id: "combo-10", label: "Fire Tornado Through Desert City", icon: "🔥", place: "A desert skyline of sand-colored towers and wind-carved spires", disaster: "fire-tornado", vantage: "gantry" },

  // 🎬 "How Did They Film That?" Episodes
  { id: "showcase-01", label: "Monster Footstep Shot", icon: "🦖", place: "A dense downtown of tall glass towers and a wide central avenue", disaster: "creature", vantage: "crane-follow" },
  { id: "showcase-02", label: "Helicopter Almost Hits the Camera", icon: "🚁", place: "A neon-lit futuristic downtown with tall glass megatowers", disaster: "aircraft", vantage: "tank-edge" },
  { id: "showcase-03", label: "Train Crashes Through Building", icon: "🚂", place: "A dense railway city crossed by elevated tracks", disaster: "vehicle-chase", vantage: "gantry" },
  { id: "showcase-04", label: "Tentacle Grabs a Helicopter", icon: "🐙", place: "A dense harbor city of cranes, warehouses and waterfront towers", disaster: "creature", vantage: "crane-follow" },
  { id: "showcase-05", label: "Ship Slides Through Downtown", icon: "🚢", place: "A dense downtown of tall glass towers along the waterfront", disaster: "ship-disaster", vantage: "tank-edge" },
  { id: "showcase-06", label: "Creature Throws a Tiny Train", icon: "🦖", place: "A dense railway city crossed by elevated tracks", disaster: "creature", vantage: "gantry" },
  { id: "showcase-07", label: "Three Helicopters Circle a Rooftop Monster", icon: "🚁", place: "A dense downtown of tall glass towers and a wide central avenue", disaster: "creature", vantage: "crane-follow" },
  { id: "showcase-08", label: "Giant Robot Steps Over Moving Train", icon: "🤖", place: "A dense railway city crossed by elevated tracks", disaster: "giant-robot", vantage: "tank-edge" },
  { id: "showcase-09", label: "Winged Creature Blasts Through Snowstorm", icon: "🐉", place: "A mountain city of steep-roofed stone buildings above a frozen valley", disaster: "creature", vantage: "gantry" },
  { id: "showcase-10", label: "Everything Goes Wrong on the Movie Set", icon: "🎬", place: "A dense downtown of tall glass towers along the waterfront", disaster: "creature", vantage: "crane-follow" },
];

function pickDifferent(pool, exclude) {
  const options = pool.filter((item) => item !== exclude);
  const list = options.length ? options : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function randomEpisodeIdea(excludeId) {
  const pool = excludeId ? EPISODE_IDEAS.filter((idea) => idea.id !== excludeId) : EPISODE_IDEAS;
  const list = pool.length ? pool : EPISODE_IDEAS;
  return list[Math.floor(Math.random() * list.length)];
}

// Powers the post-generation "make the next episode" shortcuts — keeps one
// dial fixed and rolls a new value for the other, or goes fully random.
export function nextEpisodeValues(mode, current = {}) {
  if (mode === "surprise") {
    const idea = randomEpisodeIdea();
    return { place: idea.place, disaster: idea.disaster, vantage: idea.vantage };
  }
  if (mode === "new-disaster") {
    return { place: current.place, disaster: pickDifferent(Object.keys(DISASTERS), current.disaster), vantage: current.vantage };
  }
  // "new-place"
  return { place: pickDifferent(EPISODE_IDEAS.map((idea) => idea.place), current.place), disaster: current.disaster, vantage: current.vantage };
}

/* =====================================================================
   PROMPT ASSEMBLY — locked style bible + disaster module + vantage
   module + user's place description + hard negatives. The user never
   sees or edits this; they only pick the three dials above.
   ===================================================================== */
export function buildImagePrompt({ place, disaster = DEFAULT_DISASTER, vantage = DEFAULT_VANTAGE }) {
  const subject = String(place ?? "").trim();
  const fx = disasterModule(disaster);
  const cam = vantageModule(vantage);

  return [
    `A photorealistic amateur phone photograph captured ${cam.capture}, on the set of a giant blockbuster practical-effects film shoot.`,
    `The miniature under attack is a rebuild of this idea, translated into convincing tiny real-world architecture and materials — weathered stone, painted wood, aged metal, glass and terrain — while preserving its unmistakable silhouette: ${subject}. It must read as a handcrafted physical model, not a real full-size place.`,
    STYLE_BIBLE,
    `Practical disaster in progress: ${fx.fx}. ${fx.motion}. ${fx.hero}.`,
    `Visible particles and atmosphere: ${fx.particles}.`,
    `Camera framing: ${cam.framing}. ${fx.exclusions}.`,
    "Vertical 9:16 full-bleed composition for TikTok and Reels.",
    HARD_NEGATIVES,
  ].join("\n");
}

// Beat timing follows a strict rule: an 8-second clip can never spend its
// first few seconds waiting for something to happen. Every beat below
// keeps machinery, crew and atmosphere already in motion — nothing sits
// idle "establishing" the scene before the practical effect earns its
// runtime. Structure is TENSION → TRIGGER → MAIN EVENT → ESCALATION →
// AFTERMATH, with the biggest visual beat landing around 5-6s, not at
// the very end.
export function buildVideoPrompt({ place, disaster = DEFAULT_DISASTER, vantage = DEFAULT_VANTAGE, withSound = false }) {
  const subject = String(place ?? "").trim();
  const fx = disasterModule(disaster);
  const cam = vantageModule(vantage);
  const audioDirection = withSound
    ? [
        `AUDIO STARTS AT 0.0s, never silence: ${fx.soundAmbience} and machinery already running under the precursor activity from the very first frame.`,
        `A crew member calls "Action!" around 0.8-1.0s, and ${fx.soundMachine} immediately — no pause between the call and the sound — building straight into ${fx.soundImpact} through the hero escalation.`,
        "In the final 1.5 seconds the effect decays naturally: fading machinery, settling debris, crew reactions and radio chatter — never total silence until the very last frame.",
        "No voices delivering dialogue or narration, no music, score or soundtrack — only practical set noise and crew chatter, exactly like a phone recording accidental audio.",
      ].join(" ")
    : "NO AUDIO GENERATED. Create a completely silent video with no audio track.";

  return [
    `Animate this image into one continuous ${VIDEO_DURATION}-second photorealistic vertical behind-the-scenes shot ${cam.capture}. Use the EXACT same miniature, enormous in-floor FX tank, blue chroma wall, orange tracking crosses, full-size crew, camera equipment and ${fx.fx} from the hero image — this is the same physical set, only in motion, not a new scene.`,
    `IMPORTANT PACING: motion from the FIRST FRAME — no static opening, no dead air, no long establishing shot, no delayed action. Visible precursor activity begins at 0.0s, "Action!" occurs around 0.8-1.0s, the main practical effect begins immediately after and continuously escalates, reaches its largest hero moment around 5-6s, and remains visibly active through the final frame.`,
    `0.0-0.8s — ACTIVE ESTABLISH: the rebuild of "${subject}" is already alive, nothing here is static. ${fx.precursor}. The handheld phone is already slightly moving, and crew are already in motion — checking rigging, signaling to each other or bracing at their stations.`,
    `0.8-1.2s — TRIGGER: a crew member calls "Action!" almost immediately, and the practical rig fires within the same beat — ${fx.fx} engages instantly, with no pause between the call and the effect.`,
    `1.2-4.5s — MAIN EVENT: ${fx.motion}. New physical interactions keep developing roughly every half-second — debris, spray, structural failure or particles constantly changing. Crew react in real time, flinching, bracing or calling out, and the camera follows instinctively — still shooting ${cam.capture}.`,
    `4.5-6.5s — HERO ESCALATION: the effect does not plateau, it gets BIGGER. ${fx.hero}. This is the single largest visual beat of the entire clip, selling the scale contrast between the tiny model and the full-size crew and studio.`,
    `6.5-8.0s — ACTIVE AFTERMATH: the peak passes but motion never stops. ${fx.particles} keep drifting, settling and moving, damaged sections of the miniature keep shifting, crew move toward the tank to assess it, and machinery is audibly winding down as the camera resettles toward a loop-ready frame — the scene stays alive until the final frame.`,
    `${fx.exclusions}.`,
    `Camera framing stays consistent throughout: ${cam.framing}. The camera never leaves this vantage and never cuts.`,
    "No zoom toward the miniature beyond natural crane/handheld movement already described, no scene change, no morphing architecture, no added characters beyond the established crew, no text, captions, logos, UI or watermark.",
    audioDirection,
  ].join("\n");
}

export async function generateBehindTheScenesImage({ place, disaster, vantage, qualityId = DEFAULT_QUALITY_TIER }) {
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return createImageJobSimple({
    subject: buildImagePrompt({ place, disaster, vantage }),
    toolKey: tier.imageToolKey,
    resolution: tier.imageResolution,
    size: `${tier.imageWidth}x${tier.imageHeight}`,
    width: tier.imageWidth,
    height: tier.imageHeight,
    refImages: [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: tier.imageCredits,
    project_id: null,
  });
}

export async function animateBehindTheScenes({ imageUrl, place, disaster, vantage, qualityId = DEFAULT_QUALITY_TIER }) {
  if (!imageUrl) throw new Error("animateBehindTheScenes: missing imageUrl");
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return createVideoJobSimple({
    subject: buildVideoPrompt({ place, disaster, vantage, withSound: tier.withSound }),
    toolKey: tier.videoToolKey,
    width: tier.videoWidth,
    height: tier.videoHeight,
    durationSec: VIDEO_DURATION,
    initImageUrls: [imageUrl],
    calculatedCredits: tier.videoCredits,
    withSound: tier.withSound,
  });
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt ?? null,
    qualityId: row.quality_id ?? row.qualityId ?? DEFAULT_QUALITY_TIER,
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    videoUrl: row.video_url ?? row.videoUrl ?? null,
  };
}

export async function createBehindTheScenesGeneration({ place, disaster, vantage, qualityId, imageUrl, videoUrl, status }) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) throw new Error("Must be signed in");

  const { data, error } = await supabase
    .from("behind_the_scenes_generations")
    .insert({
      user_id: userData.user.id,
      place: String(place ?? "").trim(),
      disaster: disaster || DEFAULT_DISASTER,
      vantage: vantage || DEFAULT_VANTAGE,
      quality_id: qualityId || DEFAULT_QUALITY_TIER,
      status: status || (videoUrl ? "completed" : "generating"),
      image_url: imageUrl ?? null,
      video_url: videoUrl ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeRow(data);
}

// Patches the in-flight row created at the start of a run — keeps a
// generation restorable from Recent Creations even if the tab closes or the
// user resets mid-run, instead of only ever saving on successful completion.
export async function updateBehindTheScenesGeneration(id, { imageUrl, videoUrl, status } = {}) {
  if (!id) return null;
  const patch = {};
  if (imageUrl !== undefined) patch.image_url = imageUrl;
  if (videoUrl !== undefined) patch.video_url = videoUrl;
  if (status !== undefined) patch.status = status;
  if (Object.keys(patch).length === 0) return null;

  const { data, error } = await supabase
    .from("behind_the_scenes_generations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeRow(data);
}

export async function listBehindTheScenesGenerations(limit = 8) {
  const { data, error } = await supabase
    .from("behind_the_scenes_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeRow);
}
