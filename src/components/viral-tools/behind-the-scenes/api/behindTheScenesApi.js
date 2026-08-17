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
  "the practical effect is captured at its most spectacular instant, immediately before or during impact, while the miniature underneath it stays clearly readable rather than fully obscured",
].join(". ") + ".";

const HARD_NEGATIVES =
  "No tabletop diorama, desk-scale model or model on a table with legs, no small room or low ceiling, no green screen, no sparse or oversized tracking crosses, no scene missing the full-size crew, no CGI, no 3D render, no game-engine or videogame look, no glossy Octane-style render sheen, no waxy or plastic skin, no HDR-overcooked highlights, no fantasy glow, no clean studio-photo look, no plastic or glossy toy appearance, no cartoon or cel-shaded style, no real full-size city presented as real, no recognizable franchise character or copyrighted creature design, no logos, brand names or readable signage, no captions, subtitles, on-screen text, aspect-ratio labels, AI tool names or watermark, no close-up or clearly identifiable human faces looking toward camera.";

/* =====================================================================
   DISASTER MODULES — the primary creative dial. Fields split by which
   prompt consumes them: `motion`/`hero`/`particles` describe the STILL
   IMAGE (buildImagePrompt); `primarySubject`/`actionStart`/`actionChain`/
   `videoHero`/`aftermath`/`cameraReaction` describe the 8-second VIDEO
   as one continuous causal chain (buildVideoPrompt) — deliberately
   separate from the image's hero beat, since a still-frame climax and an
   8-second escalating clip need different pacing. `exclusions` and the
   sound fields are shared by both.
   ===================================================================== */
export const DISASTERS = {
  wave: {
    id: "wave",
    label: "Giant Wave",
    icon: "🌊",
    fx: "a real in-floor water tank with a hydraulic wave machine and pressurized dump tanks",
    motion: "a towering wall of water surges horizontally across the miniature skyline, swallowing entire model blocks",
    hero: "the wave crest rises several storeys above the tallest miniature tower before crashing down across the set",
    particles: "heavy spray, white foam, drifting mist and floating miniature debris",
    exclusions: "no fire, smoke, dust, wind machines or falling snow anywhere in frame",
    primarySubject: "the advancing wave front",
    actionStart: "the hydraulic gate releases and water immediately begins surging up behind the shoreline",
    actionChain: "the first surge slams into the miniature waterfront, throwing spray sideways, as tiny boats and debris are thrown off balance and the water tears through the first row of streets, submerging low ground and undercutting the nearest buildings",
    videoHero: "a second, much larger crest overtakes the tallest miniature towers, throwing a wall of spray many storeys up against the blue chroma wall",
    aftermath: "the surge drains back through the flooded streets, foam and debris still swirling on the surface as pumps keep churning",
    cameraReaction: "the nearest crew member instinctively steps back and raises an arm against the spray",
    soundMachine: "hydraulic wave-machine gears engaging as water surges into the tank",
    soundImpact: "a deep crashing wave impact with heavy spray and rushing water",
  },
  eruption: {
    id: "eruption",
    label: "Eruption",
    icon: "🌋",
    fx: "a rigged miniature volcano cone with pressurized pyrotechnic charges and a glowing practical fluid pump",
    motion: "a churning plume of practical smoke and glowing orange practical fluid erupts upward and rolls down the miniature slopes",
    hero: "the eruption plume towers many storeys above the miniature cone, lit from within by warm orange practical lighting",
    particles: "thick smoke, glowing embers, ash and fine airborne grit",
    exclusions: "no water tank, no wind machines, no falling snow and no earthquake rigging in frame",
    primarySubject: "the erupting miniature cone",
    actionStart: "the pyrotechnic charge fires and the vent immediately bursts open with smoke and glowing fluid",
    actionChain: "the plume punches upward as glowing practical fluid rolls down the miniature slopes, igniting patches of nearby model terrain and forcing embers outward across the set",
    videoHero: "the eruption column rockets far above the miniature cone, lit orange from within, dwarfing everything below it",
    aftermath: "ash and embers continue drifting down over the smoldering slopes as smoke keeps rolling off the vent",
    cameraReaction: "the nearest crew member shields their face from the heat and steps back from the charge line",
    soundMachine: "pyrotechnic charges arming and the fluid pump spinning up",
    soundImpact: "a deep percussive eruption whump followed by a rolling rumble",
  },
  explosion: {
    id: "explosion",
    label: "Explosion",
    icon: "💥",
    fx: "compressed-air mortars and controlled pyrotechnic charges rigged beneath the miniature buildings",
    motion: "a sudden fireball and shockwave of debris blasts a miniature building apart, sending fragments outward across the set",
    hero: "the fireball and debris cloud rise well above the surrounding miniature skyline before dispersing",
    particles: "flame, thick smoke, flying debris chunks and drifting ash",
    exclusions: "no water tank, no wave machine, no falling snow and no dust-storm rigging in frame",
    primarySubject: "the exploding miniature building",
    actionStart: "the mortar charge fires and the target building bursts apart within a fraction of a second",
    actionChain: "the fireball punches outward as debris fragments scatter across neighboring blocks, smoke rolling upward while secondary chunks keep falling and bouncing off nearby model rooftops",
    videoHero: "the shockwave and debris cloud rise far above the surrounding miniature skyline in one violent burst",
    aftermath: "smoke keeps rolling off the wreckage as small embers and debris continue settling across the block",
    cameraReaction: "the nearest crew member flinches and ducks away from the blast",
    soundMachine: "a mortar charge arming with a sharp electronic beep",
    soundImpact: "a sharp percussive blast with a rolling shockwave and falling debris clatter",
  },
  tornado: {
    id: "tornado",
    label: "Tornado",
    icon: "🌪️",
    fx: "a bank of industrial fans and a rotating debris drop-tube rigged above the miniature skyline",
    motion: "a spinning column of dust and debris tracks across the miniature grid, flinging loose model pieces upward",
    hero: "the debris funnel stretches from the tank floor up past the top of the blue chroma wall, dwarfing the miniature towers",
    particles: "swirling dust, torn paper, loose debris and haze",
    exclusions: "no fire, no pyrotechnics, no water tank and no falling snow in frame",
    primarySubject: "the debris funnel",
    actionStart: "the fan bank roars to full power and the drop-tube immediately releases a spinning column of debris",
    actionChain: "the funnel tracks across the miniature grid, flinging loose model pieces upward as it clips rooftops and drags torn debris into its spin, growing wider as it crosses the block",
    videoHero: "the funnel stretches from the tank floor past the top of the blue chroma wall, dwarfing the miniature towers at its peak width",
    aftermath: "loose debris keeps swirling and settling as the fan bank winds down",
    cameraReaction: "the nearest crew member turns away and shields their eyes from the flying debris",
    soundMachine: "industrial fan blades roaring at full power",
    soundImpact: "a violent rushing wind with debris clattering against the rig",
  },
  flood: {
    id: "flood",
    label: "Flood",
    icon: "🌊",
    fx: "a slow-fill practical water system flooding the tank floor from hidden inlets around the miniature base",
    motion: "water steadily rises around the miniature foundations, submerging lower floors and drifting small debris across the surface",
    hero: "the waterline climbs several miniature storeys up the model buildings while crew wade at the tank edge to check the rigging",
    particles: "slow ripples, drifting debris and faint mist near the pumps",
    exclusions: "no pyrotechnics, no fire, no dust storm and no wind machines in frame",
    primarySubject: "the rising floodwater",
    actionStart: "the inlet valves snap open and water immediately begins surging up through the miniature foundations",
    actionChain: "the waterline climbs past the first storey as small debris drifts across the surface, submerging streets and lapping higher against the model walls with each passing second",
    videoHero: "the water climbs several miniature storeys up the tallest buildings, fully submerging their lower floors",
    aftermath: "the waterline keeps creeping higher as ripples and debris continue drifting across the flooded streets",
    cameraReaction: "the nearest crew member wades back from the rising water at the tank edge",
    soundMachine: "submersible pumps humming as the fill rate increases",
    soundImpact: "rising water sloshing against the miniature foundations",
  },
  meteor: {
    id: "meteor",
    label: "Meteor",
    icon: "☄️",
    fx: "an overhead rigged drop cable and a pressurized impact mortar aimed at the miniature skyline",
    motion: "a glowing practical projectile drops from above the soundstage and slams into the miniature grid, throwing model debris outward",
    hero: "the impact plume and dust cloud rise dramatically above the miniature skyline against the towering blue wall",
    particles: "fire, smoke, flying debris and drifting dust",
    exclusions: "no water tank, no wave machine, no falling snow and no flood water in frame",
    primarySubject: "the impact point",
    actionStart: "the drop cable releases and a glowing projectile immediately plunges toward the miniature grid",
    actionChain: "the projectile slams into the model, throwing debris outward as a shockwave ripples through neighboring blocks and secondary chunks keep raining down across the set",
    videoHero: "the impact plume and dust cloud rocket dramatically above the miniature skyline against the towering blue wall",
    aftermath: "dust and debris keep drifting down over the crater as smoke continues rising from the impact site",
    cameraReaction: "the nearest crew member ducks and shields their head from the scattering debris",
    soundMachine: "the drop cable release clunking as the rig fires",
    soundImpact: "a heavy percussive impact boom with scattering debris",
  },
  firestorm: {
    id: "firestorm",
    label: "Firestorm",
    icon: "🔥",
    fx: "controlled pyrotechnic fire bars and smoke generators lining the miniature block",
    motion: "a rolling wall of practical fire sweeps across the miniature rooftops as smoke banks billow upward",
    hero: "flame and smoke rise many storeys above the miniature skyline while crew shield their faces from the heat",
    particles: "embers, ash, thick smoke and visible heat shimmer",
    exclusions: "no water tank, no wave machine, no falling snow and no dust-storm rigging in frame",
    primarySubject: "the advancing fire front",
    actionStart: "the fire bars ignite and flame immediately rolls across the nearest miniature rooftops",
    actionChain: "the fire front sweeps forward, catching one rooftop after another as smoke banks billow upward and embers spread the flame toward neighboring blocks",
    videoHero: "flame and smoke rocket many storeys above the miniature skyline in one enormous rolling burst",
    aftermath: "smoke keeps pouring off the smoldering rooftops as embers continue drifting and settling",
    cameraReaction: "the nearest crew member shields their face and steps back from the heat",
    soundMachine: "propane igniters clicking as the fire bars light",
    soundImpact: "a steady roaring fire front with crackling debris",
  },
  blizzard: {
    id: "blizzard",
    label: "Blizzard",
    icon: "❄️",
    fx: "industrial snow cannons and wind machines rigged around the miniature perimeter",
    motion: "dense practical snow and wind sweep horizontally across the miniature skyline, piling against model rooftops",
    hero: "whiteout gusts obscure the tallest miniature towers as snow banks build rapidly at street level",
    particles: "driving snow, blown ice chips and drifting fog",
    exclusions: "no fire, no pyrotechnics, no water tank and no dust in frame",
    primarySubject: "the advancing whiteout front",
    actionStart: "the snow cannons and wind machines roar to full power and a wall of snow immediately blasts across the miniature",
    actionChain: "the whiteout sweeps forward, stripping snow off rooftops as it crosses, piling drifts against the model buildings and swallowing one block after another",
    videoHero: "a total whiteout engulfs the tallest miniature towers, snow banks building rapidly at street level",
    aftermath: "snow keeps swirling and settling over the buried streets as the wind machines wind down",
    cameraReaction: "the nearest crew member turns away and shields their face from the blast",
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
    motion: "the creature rig lumbers through the miniature grid, crushing model buildings and swatting aside toy vehicles with each motion",
    hero: "the creature towers many storeys above the miniature skyline, dwarfing both the tiny buildings and the full-size crew operating its rig",
    particles: "falling debris, dust, snapped miniature power lines and drifting smoke",
    exclusions: "no water tank, no wave machine, no snow cannons and no aircraft wire rigs unrelated to the creature shot",
    primarySubject: "the creature's interaction with the miniature skyline",
    actionStart: "the creature rig's leg immediately descends toward the miniature street",
    actionChain: "the foot strikes and nearby buildings buckle, as the creature pushes forward and one arm knocks through a tower, dust erupting as debris scatters across the block",
    videoHero: "the creature pushes fully upright above the miniature skyline, dwarfing the tiny buildings and the crew operating its rig",
    aftermath: "dust and debris keep settling over the crushed block as the creature rig holds its final position",
    cameraReaction: "the nearest crew member instinctively steps back from the rig",
    soundMachine: "the rig's servo motors engaging as the creature begins to move",
    soundImpact: "a heavy footstep thud shaking the set, followed by crumbling debris",
  },
  aircraft: {
    id: "aircraft",
    label: "Aircraft Chase",
    icon: "🚁",
    fx: "wire-rigged miniature helicopters and aircraft flown on practical cable rigs above the model, with wind machines and smoke cannons operating below",
    motion: "the miniature aircraft sweep low across the model skyline on their rig cables while practical smoke and debris chase them from below",
    hero: "the aircraft weave between miniature towers just above rooftop height, the full-size rig operators visible tensioning the flight cables",
    particles: "engine haze, drifting smoke and debris kicked up by the wind machines",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    primarySubject: "the miniature aircraft's flight path",
    actionStart: "the wire rig immediately releases and the miniature aircraft banks low across the model skyline",
    actionChain: "the aircraft sweeps between miniature towers as rotor wash kicks up dust and debris below it, weaving tighter as smoke cannons fire near its flight path",
    videoHero: "the aircraft clears the tallest miniature tower by a hair as a burst of smoke and debris erupts behind it",
    aftermath: "haze and debris keep drifting across the skyline as the aircraft rig settles to a stop",
    cameraReaction: "the nearest rig operator tenses and follows the flight path with their eyes",
    soundMachine: "wind machines spinning up beneath the flight rig",
    soundImpact: "a sharp burst of rotor wash and debris as the aircraft sweeps past",
  },
  "vehicle-chase": {
    id: "vehicle-chase",
    label: "Vehicle Chase",
    icon: "🚂",
    fx: "a motorized track rig driving miniature vehicles — trains, cars or trucks — through the model at speed while crew operate practical debris cannons alongside",
    motion: "the miniature vehicle races along its track rig through the model streets as practical debris and sparks kick up around it",
    hero: "the vehicle rig reaches full speed through the miniature set, full-size crew tracking it with a handheld camera at the tank edge",
    particles: "kicked-up dust, sparks and small debris trailing behind the vehicle rig",
    exclusions: "no water tank, no wave machine, no fire pits and no creature rig in frame",
    primarySubject: "the racing miniature vehicle",
    actionStart: "the track rig motor immediately snaps to full speed and the miniature vehicle launches down the rails",
    actionChain: "the vehicle races through the model streets as practical debris cannons fire alongside it, sparks and dust kicking up with every pass as it weaves past obstacles",
    videoHero: "the vehicle rig hits full speed through the heart of the miniature set in one continuous blur",
    aftermath: "dust and sparks keep drifting off the rails as the track rig winds down",
    cameraReaction: "the nearest crew member tracks the vehicle with a handheld camera, flinching as it passes close",
    soundMachine: "the track rig motor spinning up to speed",
    soundImpact: "a loud rattling clatter as the vehicle rig races past at full speed",
  },
  collapse: {
    id: "collapse",
    label: "Structural Collapse",
    icon: "🏢",
    fx: "rigged miniature structures — bridges, towers or cranes — wired with pyrotechnic collapse charges and pull-cables operated by the FX crew",
    motion: "the miniature structure buckles and collapses section by section as the pull-cables release and dust cannons fire",
    hero: "the structure comes down in a single dramatic collapse, throwing debris and dust many storeys above the surrounding miniature skyline",
    particles: "billowing dust, falling debris chunks and drifting concrete haze",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    primarySubject: "the collapsing miniature structure",
    actionStart: "the pull-cables release and the rigged structure immediately begins buckling",
    actionChain: "the structure gives way section by section as dust cannons fire, debris cascading downward while adjoining sections keep failing in sequence",
    videoHero: "the structure comes down in one dramatic collapse, throwing debris and dust far above the surrounding miniature skyline",
    aftermath: "dust keeps billowing off the wreckage as debris continues settling across the site",
    cameraReaction: "the nearest crew member steps back from the falling debris",
    soundMachine: "collapse charges arming along the structure",
    soundImpact: "a deep rumbling collapse with cascading debris impacts",
  },
  "ship-disaster": {
    id: "ship-disaster",
    label: "Ship Disaster",
    icon: "🚢",
    fx: "a large miniature ship model rigged on a motorized track through the FX water tank, with practical wave machines and dump tanks operating around it",
    motion: "the miniature ship carves through the tank at speed, its motorized hull throwing spray and rocking against practical waves",
    hero: "the ship rig plows through the miniature waterfront, its hull towering over nearby model docks and buildings",
    particles: "heavy spray, foam and floating miniature debris",
    exclusions: "no fire, smoke, dust, wind machines or falling snow anywhere in frame",
    primarySubject: "the ship rig's path through the harbor",
    actionStart: "the ship rig's motor immediately engages and the hull surges into the tank",
    actionChain: "the ship carves through the water as spray throws off its bow, rocking against practical waves while it bears down on the miniature docks and buildings",
    videoHero: "the ship rig plows directly through the miniature waterfront, its hull towering over the nearby model structures",
    aftermath: "spray and foam keep settling across the tank as the ship rig's wake continues rocking the harbor",
    cameraReaction: "the nearest crew member braces against the rail as spray reaches the tank edge",
    soundMachine: "the ship rig's motor engaging as it enters the tank",
    soundImpact: "a deep hull impact with heavy spray and rushing water",
  },
  avalanche: {
    id: "avalanche",
    label: "Avalanche",
    icon: "🏔️",
    fx: "an elevated snow-mass drop rig above the miniature mountain, releasing tons of practical fake snow down a chute onto the model",
    motion: "a wall of practical snow crashes down the mountain slope, swallowing the miniature village beneath it in seconds",
    hero: "the snow mass rises many storeys above the miniature rooftops as it rolls downhill, crew bracing at the tank edge",
    particles: "billowing snow powder, drifting ice chips and fine white haze",
    exclusions: "no fire, no pyrotechnics, no water tank and no dust in frame",
    primarySubject: "the advancing snow mass",
    actionStart: "the drop-chute gate immediately releases and snow begins crashing down the mountain slope",
    actionChain: "the snow mass gains speed as it rolls downhill, swallowing the miniature village a building at a time and throwing snow powder outward with every impact",
    videoHero: "the snow mass rises many storeys above the miniature rooftops as it crashes fully over the model",
    aftermath: "snow powder keeps drifting and settling over the buried village as the rig winds down",
    cameraReaction: "the nearest crew member steps back from the tank edge as the snow mass approaches",
    soundMachine: "the drop-chute gate releasing tons of practical snow",
    soundImpact: "a deep rolling rumble as the snow mass crashes over the model",
  },
  "alien-craft": {
    id: "alien-craft",
    label: "Alien Craft",
    icon: "🛸",
    fx: "a rigged miniature hovering craft suspended on wires above the model, with practical light rigs, wind machines and haze generators",
    motion: "the craft hovers and drifts above the miniature skyline on its wire rig while practical wind and light effects sweep the set",
    hero: "the craft towers over the miniature rooftops, its underside lights sweeping the model as wind machines flatten nearby structures",
    particles: "swirling haze, drifting dust and debris kicked up by the wind machines",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    primarySubject: "the hovering craft's presence over the miniature",
    actionStart: "the wire rig immediately lowers and the craft's underside lights snap on over the miniature skyline",
    actionChain: "the craft drifts lower as wind machines flatten nearby structures, its lights sweeping across the model while haze thickens around it",
    videoHero: "the craft looms directly over the miniature rooftops, its lights and wind effects dominating the entire block",
    aftermath: "haze and dust keep swirling below the craft as it holds its final position",
    cameraReaction: "the nearest crew member shields their eyes from the sweeping lights",
    soundMachine: "the wire rig's winches engaging as the craft descends",
    soundImpact: "a deep bass pulse as the craft's lights sweep across the model",
  },
  "giant-robot": {
    id: "giant-robot",
    label: "Giant Robot",
    icon: "🤖",
    fx: "a full-size hydraulic robot rig walking on a motion-control leg mechanism through the miniature grid",
    motion: "the robot rig takes slow, heavy steps through the model streets, each footfall crushing miniature buildings beneath it",
    hero: "the robot towers many storeys above the miniature skyline, its hydraulic joints hissing as the full-size crew operate the rig nearby",
    particles: "falling debris, dust and drifting hydraulic fluid haze",
    exclusions: "no water tank, no wave machine, no fire pits and no snow cannons in frame",
    primarySubject: "the robot rig's advance through the miniature grid",
    actionStart: "the hydraulic leg immediately drives downward into the first step",
    actionChain: "each footfall crushes miniature buildings as the robot advances, hydraulic joints hissing while dust and debris scatter with every stride",
    videoHero: "the robot pushes to full height above the miniature skyline, towering over the tiny buildings and the crew operating its rig",
    aftermath: "dust keeps settling over the crushed street as the robot rig holds its final pose",
    cameraReaction: "the nearest crew member steps back from the rig's controls",
    soundMachine: "hydraulic pistons engaging as the robot rig begins to move",
    soundImpact: "a heavy metallic footstep thud shaking the miniature set",
  },
  sandstorm: {
    id: "sandstorm",
    label: "Sandstorm",
    icon: "🏜️",
    fx: "industrial dust cannons and wind turbines rigged around the miniature perimeter, blasting fine sand across the set",
    motion: "a dense wall of practical sand and dust rolls across the miniature skyline, swallowing model towers one by one",
    hero: "the dust wall towers above the tallest miniature building before fully engulfing the set in haze",
    particles: "fine blown sand, dust haze and grit drifting across the frame",
    exclusions: "no fire, no water tank, no snow and no creature or vehicle rigs in frame",
    primarySubject: "the advancing dust wall",
    actionStart: "the dust cannons and wind turbines immediately roar to full power, launching a wall of sand across the miniature",
    actionChain: "the dust wall rolls forward, swallowing one miniature tower after another as it thickens, visibility dropping fast across the block",
    videoHero: "the dust wall fully engulfs the tallest miniature building, swallowing the set in haze",
    aftermath: "sand and dust keep drifting and settling as the wind turbines wind down",
    cameraReaction: "the nearest crew member turns away and pulls up a mask against the blowing sand",
    soundMachine: "wind turbines spinning up to full power",
    soundImpact: "a roaring blast of wind and sand tearing across the model",
  },
  superstorm: {
    id: "superstorm",
    label: "Superstorm",
    icon: "⚡",
    fx: "rain bars, wind turbines and a practical water tank operating together around the miniature model, with lightning-strobe rigs overhead",
    motion: "driving rain, wind and rising water hit the miniature set simultaneously as strobe lights simulate lightning overhead",
    hero: "the storm engulfs the entire miniature skyline at once, water rising at street level while wind tears at rooftops",
    particles: "heavy rain, wind-blown debris and drifting spray",
    exclusions: "no fire, no pyrotechnics, no dust and no snow in frame",
    primarySubject: "the storm engulfing the miniature skyline",
    actionStart: "the rain bars and wind turbines immediately roar to full power together, and the strobe rig fires",
    actionChain: "driving rain and rising water hit the miniature set together as wind tears at rooftops, the strobes flashing brighter with each gust",
    videoHero: "the storm fully engulfs the miniature skyline at once, water rising at street level while wind rips at the tallest towers",
    aftermath: "rain and spray keep hammering the flooded streets as the wind turbines wind down",
    cameraReaction: "the nearest crew member braces against the wind and shields their face from the rain",
    soundMachine: "wind turbines and rain bars spinning up together",
    soundImpact: "a violent crash of thunder-strobe, wind and rushing water",
  },
  "fire-tornado": {
    id: "fire-tornado",
    label: "Fire Tornado",
    icon: "🔥",
    fx: "controlled pyrotechnic fire bars paired with a rotating wind rig, spinning flame into a vertical vortex above the miniature set",
    motion: "a spinning column of practical fire tracks across the miniature grid, the wind rig twisting the flame into a rotating vortex",
    hero: "the fire vortex stretches from the tank floor past the top of the blue chroma wall, towering over the miniature skyline",
    particles: "swirling embers, smoke and drifting ash caught in the vortex",
    exclusions: "no water tank, no snow cannons and no dust storm rigs in frame",
    primarySubject: "the spinning fire vortex",
    actionStart: "the wind rig spins up and the fire bars immediately ignite into a rotating column",
    actionChain: "the vortex tightens as it tracks across the miniature grid, embers spiraling upward while it clips rooftops and drags flame across neighboring blocks",
    videoHero: "the fire vortex stretches from the tank floor past the top of the blue chroma wall, towering over the miniature skyline",
    aftermath: "embers and smoke keep swirling as the wind rig winds down and the flame settles",
    cameraReaction: "the nearest crew member shields their face and steps back from the heat",
    soundMachine: "the wind rig spinning up as the fire bars ignite",
    soundImpact: "a roaring rush of spinning flame and rattling debris",
  },
  earthquake: {
    id: "earthquake",
    label: "Earthquake",
    icon: "🏚️",
    fx: "hydraulic shaker platforms beneath the miniature model paired with a hidden ground-split rig that pulls the street apart",
    motion: "the miniature ground shakes violently as the shaker platform vibrates the model and the hidden rig splits the street open",
    hero: "a widening chasm tears through the miniature street as buildings on either side tilt and crumble into it",
    particles: "falling debris, dust and cracking pavement fragments",
    exclusions: "no fire, no water tank, no snow and no creature or aircraft rigs in frame",
    primarySubject: "the splitting miniature street",
    actionStart: "the shaker platform immediately kicks into violent motion and the ground-split rig snaps open",
    actionChain: "the street tears apart as buildings on either side tilt, cracks spreading rapidly while debris shakes loose and tumbles into the widening chasm",
    videoHero: "a widening chasm tears fully through the miniature street as buildings on either side crumble into it",
    aftermath: "dust keeps settling into the chasm as loose debris continues crumbling off the tilted buildings",
    cameraReaction: "the nearest crew member braces against the shaking rig",
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
// `capture`/`framing` describe the fixed photo composition (used by both
// prompts). `movement` is video-only — it locks down exactly how much the
// handheld phone is allowed to move, so the model can't invent cinematic
// camera work. "{{subject}}" is a literal placeholder swapped for the
// disaster's `primarySubject` at prompt-build time.
export const VANTAGES = {
  "tank-edge": {
    id: "tank-edge",
    label: "Tank Edge",
    sublabel: "Closest to the chaos",
    capture: "from ground level right beside the FX tank, low next to the crew and equipment",
    framing: "the closest crew member's shoulder or back visible at the frame edge, face turned away from camera toward the set, tangled cables and hoses crossing the foreground, rigging carts and monitors nearby",
    movement: "The phone operator remains physically planted at this exact position for the entire take. Camera movement is limited to mild natural handheld wrist sway, one small reactive recoil at the moment of the main impact, and a tiny corrective pan of no more than roughly 10-15 degrees to keep {{subject}} in frame. No orbiting, no push-in, no pull-back, no dramatic pan, no reframing into a new composition.",
  },
  gantry: {
    id: "gantry",
    label: "Gantry",
    sublabel: "Full scale reveal",
    capture: "from an elevated gantry looking down over the entire miniature set",
    framing: "a metal guardrail bar low in frame, the full tank and miniature skyline spread out below, crew visible only from behind or in silhouette on the catwalk, catwalk lighting rigs visible at the edges",
    movement: "The phone operator remains physically planted at the guardrail for the entire take, looking down over the set. Camera movement is limited to mild natural handheld wrist sway, one small reactive recoil at the moment of the main impact, and a tiny corrective pan of no more than roughly 10-15 degrees to keep {{subject}} in frame. No orbiting, no push-in, no pull-back, no dramatic pan, no reframing into a new composition.",
  },
  // Deliberately not a physical crane shot — a crew member's phone can't
  // be mounted on a crane without breaking the "accidental BTS footage"
  // premise. Kept under the "crane-follow" id (referenced by 30+ preset
  // episode ideas and any already-saved generations) but redefined as a
  // slow handheld walk instead of camera-crane movement.
  "crane-follow": {
    id: "crane-follow",
    label: "Moving Walk-By",
    sublabel: "Tracks the action",
    capture: "from a handheld phone held low, walking slowly along the tank edge",
    framing: "tangled cables and hoses crossing the foreground near the operator's feet, rigging carts and monitors passing at the frame edge, any crew glimpsed only from behind or blurred by motion",
    movement: "The phone operator walks slowly and deliberately 1-2 meters along the tank edge over the full take, phone held low, always keeping {{subject}} centered in frame. Beyond this single deliberate walking motion, camera movement is limited to mild natural handheld sway and one small reactive recoil at the moment of the main impact. No orbiting, no push-in, no pull-back, no crane-like sweep, no reframing into a new composition.",
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

  // 🎬 Bespoke story episodes — these ids have a matching BESPOKE_EPISODES
  // entry, so selecting one bypasses the generic disaster+place assembly
  // entirely in favor of a fully hand-written coherent scene. `place` and
  // `disaster` below are only fallback/display metadata (recent-creations
  // list text, disaster-grid highlight) — buildImagePrompt/buildVideoPrompt
  // read from BESPOKE_EPISODES[id] instead when the id matches.
  { id: "ep-001", label: "Helicopters vs Giant Ape", icon: "🚁", place: "A dense metropolitan avenue surrounding one tall central skyscraper", disaster: "creature", vantage: "tank-edge" },
  { id: "ep-002", label: "Giant Creature vs Downtown Convoy", icon: "🦖", place: "A downtown boulevard lined with concrete office blocks", disaster: "creature", vantage: "tank-edge" },
  { id: "ep-003", label: "Helicopter Chase Through Monster Attack", icon: "🚁", place: "A mountain metropolis squeezed between steep rock slopes", disaster: "creature", vantage: "crane-follow" },
  { id: "ep-004", label: "Sea Monster Attacks Suspension Bridge", icon: "🐙", place: "A coastal metropolis built around a long suspension bridge", disaster: "creature", vantage: "tank-edge" },
  { id: "ep-005", label: "Creature Smashes Through Airport", icon: "🦖", place: "A practical airport with runway lights and terminal buildings", disaster: "creature", vantage: "gantry" },
  { id: "ep-006", label: "Giant Ape vs Mountain Fortress", icon: "🦍", place: "A steep mountain city crowned by a weathered stone fortress", disaster: "creature", vantage: "crane-follow" },
  { id: "ep-007", label: "Winged Beast Attacks Castle City", icon: "🐉", place: "A medieval-inspired stone city with towers and narrow streets", disaster: "creature", vantage: "gantry" },
  { id: "ep-008", label: "Tentacles Rise Through Harbor City", icon: "🐙", place: "A harbor metropolis built directly into the FX tank", disaster: "creature", vantage: "tank-edge" },
  { id: "ep-009", label: "Monster Emerges Behind Tiny Stadium", icon: "🦖", place: "A sports district with an oval stadium and city blocks", disaster: "creature", vantage: "gantry" },
  { id: "ep-010", label: "Creature Stops Runaway Train", icon: "🚂", place: "A mountain railway curving through a dense settlement", disaster: "creature", vantage: "tank-edge" },
  { id: "ep-011", label: "Helicopter Chase Through Neon City", icon: "🚁", place: "A rain-wet futuristic downtown with neon-lit towers", disaster: "aircraft", vantage: "crane-follow" },
  { id: "ep-012", label: "Helicopters Circle Erupting Volcano", icon: "🚁", place: "A volcanic island metropolis around an artificial mountain", disaster: "eruption", vantage: "crane-follow" },
  { id: "ep-013", label: "Cargo Plane Skims Downtown Rooftops", icon: "✈️", place: "A dense miniature business district", disaster: "aircraft", vantage: "tank-edge" },
  { id: "ep-014", label: "Helicopter Rescue During Giant Flood", icon: "🚁", place: "A flooded downtown built into the practical tank", disaster: "flood", vantage: "gantry" },
  { id: "ep-015", label: "Airliner Emergency Over Mountain City", icon: "✈️", place: "A snowy alpine city with mountain ridges and buildings", disaster: "blizzard", vantage: "crane-follow" },
  { id: "ep-016", label: "Helicopter vs Tornado", icon: "🚁", place: "A plains metropolis beneath an enormous dust funnel", disaster: "tornado", vantage: "tank-edge" },
  { id: "ep-017", label: "Plane Flies Through Meteor Impact", icon: "✈️", place: "A metropolitan skyline behind a meteor-impact plume", disaster: "meteor", vantage: "gantry" },
  { id: "ep-018", label: "Helicopter Escapes Collapsing Dam", icon: "🚁", place: "A mountain dam above a valley settlement", disaster: "collapse", vantage: "crane-follow" },
  { id: "ep-019", label: "Cargo Plane Lands on Flooded Runway", icon: "✈️", place: "A partially submerged miniature runway", disaster: "flood", vantage: "tank-edge" },
  { id: "ep-020", label: "Helicopters Search Abandoned Snow City", icon: "🚁", place: "An abandoned alpine downtown buried in artificial snow", disaster: "blizzard", vantage: "gantry" },
  { id: "ep-021", label: "Runaway Train Through Flooded City", icon: "🚂", place: "A railway cutting through a flooded city model", disaster: "flood", vantage: "tank-edge" },
  { id: "ep-022", label: "Train Crosses Bridge During Earthquake", icon: "🚂", place: "A model bridge above a tiny valley city", disaster: "earthquake", vantage: "gantry" },
  { id: "ep-023", label: "Subway Bursts Through Downtown Street", icon: "🚇", place: "A downtown intersection with a breakaway street surface", disaster: "vehicle-chase", vantage: "tank-edge" },
  { id: "ep-024", label: "Train vs Avalanche", icon: "🚂", place: "An alpine railway hugging a steep mountain above a village", disaster: "avalanche", vantage: "crane-follow" },
  { id: "ep-025", label: "Convoy Escapes Giant Sandstorm", icon: "🚛", place: "A desert highway through a tiny roadside settlement", disaster: "sandstorm", vantage: "tank-edge" },
  { id: "ep-026", label: "Bus Jumps Collapsing Bridge", icon: "🚌", place: "A bridge with a controlled breakaway central deck", disaster: "collapse", vantage: "crane-follow" },
  { id: "ep-027", label: "Cars Escape Falling Skyscraper", icon: "🚗", place: "A downtown avenue beneath a leaning breakaway skyscraper", disaster: "collapse", vantage: "tank-edge" },
  { id: "ep-028", label: "Train Through Burning Forest Town", icon: "🚂", place: "A railway through a forest settlement with controlled flame", disaster: "firestorm", vantage: "gantry" },
  { id: "ep-029", label: "Fuel Truck Escapes Volcano", icon: "🚛", place: "A winding mountain road beneath an active volcano rig", disaster: "eruption", vantage: "crane-follow" },
  { id: "ep-030", label: "Highway Chase During Meteor Shower", icon: "🚗", place: "An elevated highway through a futuristic city", disaster: "meteor", vantage: "tank-edge" },
];

/* =====================================================================
   BESPOKE EPISODES — fully hand-written scenes, one coherent unit each,
   instead of assembling a generic disaster module against freeform place
   text. This exists because the generic assembly has a real coherence
   gap: the disaster module has no idea what terrain the user's place
   text describes, so e.g. a "collapse" disaster never actually describes
   a mountain or a dam even when the place text mentions one — it just
   says generic "rigged miniature structures." Every field here is
   specific to this one episode: `imageCore` replaces the generic
   `place + disaster.fx/motion/hero` assembly for the still image, and
   `primarySubject`/`actionChain`/`videoHero`/`aftermath`/`soundCue`
   replace the disaster module's video fields. When an episode id has a
   BESPOKE_EPISODES entry, buildImagePrompt/buildVideoPrompt use this
   content instead of the generic DISASTERS lookup — see the `episodeId`
   param on both. Vantage (camera position/movement) still layers on top
   normally either way.
   Only 30 of a planned 170 are populated so far — unlisted ids fall
   through to the generic disaster+place assembly with no error.
   ===================================================================== */
export const BESPOKE_EPISODES = {
  "ep-001": {
    label: "Helicopters vs Giant Ape",
    icon: "🚁",
    imageCore: "A dense miniature metropolitan avenue of glass-and-concrete towers surrounding one tall central skyscraper. An enormous ORIGINAL practical ape-creature animatronic climbs the side of the tiny central tower while three miniature generic movie helicopters circle on visible practical wire rigs. Giant wind machines buffet miniature rooftop debris. One helicopter banks close to the creature's shoulder while the creature reaches toward it. Full-size FX technicians operate hydraulic controls beside the miniature, making the creature's enormous scale obvious.",
    primarySubject: "the interaction between the original ape-creature rig and three miniature helicopters",
    actionChain: "\"Action!\" → helicopter rotors are already spinning and all three miniature aircraft sweep around the tower → the creature turns toward the nearest aircraft → its hydraulic arm swings across the skyline → the helicopter banks beneath the hand → rotor wash blasts miniature rooftop debris sideways → the creature's other hand tears through the upper corner of the model tower → the helicopters cross through the resulting practical dust",
    videoHero: "the creature rips away part of the miniature tower while one helicopter passes directly across the foreground and two others emerge through the dust behind it",
    aftermath: "broken miniature facade pieces continue falling, dust rolls between towers, helicopters exit laterally and the creature rig remains moving slightly as hydraulics wind down",
    soundMachine: "rotor buzz and servo/hydraulic hiss engaging together",
    soundImpact: "masonry cracking and debris impacts as the tower facade tears away",
  },
  "ep-002": {
    label: "Giant Creature vs Downtown Convoy",
    icon: "🦖",
    imageCore: "A miniature downtown boulevard lined with concrete office blocks, parking structures and tiny streetlights. An enormous ORIGINAL reptilian practical creature rig stands astride the avenue while a convoy of tiny generic movie vehicles races underneath. One huge practical foot is descending toward an intersection; compressed-air dust rigs and breakaway buildings surround the impact point.",
    primarySubject: "the descending creature foot and escaping miniature convoy",
    actionChain: "\"Action!\" → tiny vehicles are already racing → creature foot immediately descends → first vehicles clear the intersection → foot crushes the miniature roadway → practical dust bursts outward → creature pushes forward → its leg clips a breakaway building → facade collapses behind the convoy",
    videoHero: "a full creature step destroys the intersection as the last tiny vehicle narrowly clears the physical dust blast",
    aftermath: "dust spreads, loose facade pieces fall, vehicles continue away and the creature's hydraulic leg settles",
    soundMachine: "tiny engine whine and servo motors engaging",
    soundImpact: "a massive practical thud with cracking plaster and debris",
  },
  "ep-003": {
    label: "Helicopter Chase Through Monster Attack",
    icon: "🚁",
    imageCore: "A miniature mountain metropolis squeezed between steep artificial rock slopes. Two miniature helicopters fly on practical rigs through the valley while an ORIGINAL towering creature breaks through the outer edge of the model city. Dust tubes and breakaway buildings surround its path.",
    primarySubject: "two helicopters escaping the advancing creature",
    actionChain: "\"Action!\" → helicopters already sweep through the miniature valley → creature turns into their path → first helicopter banks around a tower → creature swipes and misses → second helicopter dives lower → practical rotor wash scatters dust → creature crashes through a breakaway building → both helicopters pass through the dust plume",
    videoHero: "the creature smashes the largest miniature tower while both helicopters cross opposite sides of the collapsing structure",
    aftermath: "helicopters exit, tower pieces continue dropping and practical dust hangs over the valley",
    soundMachine: "rotor buzz and the hydraulic creature rig engaging",
    soundImpact: "wind and plaster collapse with crew shouts",
  },
  "ep-004": {
    label: "Sea Monster Attacks Suspension Bridge",
    icon: "🐙",
    imageCore: "A miniature coastal metropolis built around a long suspension bridge spanning the studio's enormous in-floor water tank. Several gigantic ORIGINAL practical creature tentacles emerge physically from the tank, one curling around the miniature bridge deck while another rises behind it. Tiny generic cars remain visible on the roadway.",
    primarySubject: "the tentacle physically wrapping the miniature bridge",
    actionChain: "\"Action!\" → water is already churning → first tentacle rises → it wraps the bridge tower → cables tighten → second tentacle strikes the water → bridge deck twists → tiny cars slide → central suspension cables snap sequentially",
    videoHero: "the creature tentacle pulls the central bridge span sideways into the tank, throwing a huge practical splash upward",
    aftermath: "broken bridge pieces swing from remaining cables while water and foam continue moving around the tentacles",
    soundMachine: "water churn and mechanical rig motors engaging",
    soundImpact: "cable snaps, bridge creaks and a huge splash",
  },
  "ep-005": {
    label: "Creature Smashes Through Airport",
    icon: "🦖",
    imageCore: "A tiny practical airport with runway lights, terminal buildings, service vehicles and several generic miniature passenger aircraft. A towering ORIGINAL creature charges across the runway while breakaway terminal sections and compressed-air dust rigs sit in its path.",
    primarySubject: "creature crossing the miniature runway",
    actionChain: "\"Action!\" → miniature airport vehicles already move → creature immediately enters runway → foot crushes runway lighting → service vehicle swerves → creature shoulder hits terminal canopy → breakaway roof collapses → creature pushes through dust toward parked miniature aircraft",
    videoHero: "the creature crashes through the terminal corner as one miniature aircraft rolls across the foreground",
    aftermath: "dust drifts across runway, roof fragments continue falling and tiny vehicles continue moving",
    soundMachine: "creature hydraulics and tiny engines running",
    soundImpact: "structural cracking, heavy footsteps and debris",
  },
  "ep-006": {
    label: "Giant Ape vs Mountain Fortress",
    icon: "🦍",
    imageCore: "A steep miniature mountain city crowned by a weathered stone fortress. An enormous ORIGINAL ape-like creature climbs the artificial cliff while miniature helicopters circle on practical rigs. Small controlled practical dust bursts and breakaway fortress walls surround the summit.",
    primarySubject: "creature reaching the hilltop fortress",
    actionChain: "\"Action!\" → helicopters immediately circle → creature climbs → loose rock falls → helicopter crosses its face → creature reaches summit → hand strikes outer fortress wall → practical dust bursts → wall sections collapse down the miniature cliff",
    videoHero: "the creature rises above the fortress and tears open the main tower while helicopters pass around the debris plume",
    aftermath: "stone fragments tumble down the slope, helicopters continue circling and dust hangs above the model",
    soundMachine: "rotor rigs and hydraulic creature motion",
    soundImpact: "rock impacts and plaster wall collapse",
  },
  "ep-007": {
    label: "Winged Beast Attacks Castle City",
    icon: "🐉",
    imageCore: "A tiny medieval-inspired stone city with towers, walls and narrow streets. A huge ORIGINAL winged creature practical rig sweeps low over the miniature while industrial wind machines blast flags, dust and lightweight debris. Controlled orange practical flame effects burn safely in isolated miniature courtyards.",
    primarySubject: "winged creature sweeping across the castle miniature",
    actionChain: "\"Action!\" → wings already move → wind instantly blasts the city → creature crosses first tower → miniature banners snap sideways → rooftop pieces scatter → creature clips a breakaway turret → turret collapses → controlled courtyard flame flares",
    videoHero: "one giant wing sweep sends a huge wave of practical dust and lightweight debris across the entire castle skyline",
    aftermath: "dust and smoke drift while broken turret pieces settle and the creature exits",
    soundMachine: "wind machines and the mechanical wing rig",
    soundImpact: "stone impacts and controlled flame roar",
  },
  "ep-008": {
    label: "Tentacles Rise Through Harbor City",
    icon: "🐙",
    imageCore: "A miniature harbor metropolis built directly into the large in-floor FX tank, with tiny docks, cranes and waterfront towers. Several ORIGINAL animatronic tentacles burst through the physical water between buildings while crew operate hydraulic rigs from the tank edge.",
    primarySubject: "multiple tentacles emerging among miniature buildings",
    actionChain: "\"Action!\" → tank already ripples → first tentacle erupts → water sprays over docks → second tentacle rises beside crane → crane tips → third tentacle pushes between towers → miniature boats scatter → first tentacle sweeps through dock structures",
    videoHero: "three tentacles rise simultaneously while a harbor crane collapses into the tank, creating a giant practical splash",
    aftermath: "water sheets off tentacles, boats continue drifting and broken dock pieces float",
    soundMachine: "hydraulic rigs engaging as water erupts",
    soundImpact: "metal crane collapse and splashes",
  },
  "ep-009": {
    label: "Monster Emerges Behind Tiny Stadium",
    icon: "🦖",
    imageCore: "A huge miniature sports district with an oval stadium, parking structures and surrounding city blocks. Behind it, an ORIGINAL practical creature rig is already rising above the miniature skyline through theatrical dust and smoke.",
    primarySubject: "creature revealing itself behind the stadium",
    actionChain: "\"Action!\" → creature immediately rises → dust falls from stadium roof → creature hand grips outer structure → roof sections buckle → creature pushes forward → parking structures collapse → dust rolls across foreground",
    videoHero: "the creature towers completely over the stadium as a large roof section collapses inward",
    aftermath: "dust continues spilling from the roof while creature hydraulics slow and miniature debris settles",
    soundMachine: "hydraulic motors and deep mechanical footsteps",
    soundImpact: "roof cracking and debris impacts",
  },
  "ep-010": {
    label: "Creature Stops Runaway Train",
    icon: "🚂",
    imageCore: "A miniature mountain railway curves through a dense tiny settlement. A generic miniature locomotive speeds toward an enormous ORIGINAL creature standing across the track. Practical dust rigs and a breakaway railway embankment surround the confrontation.",
    primarySubject: "approaching train and creature blocking the railway",
    actionChain: "\"Action!\" → train is already moving fast → creature turns toward track → locomotive rounds bend → creature lowers huge hand → train brakes → sparks-like practical effects flicker near wheels → creature grips track structure → embankment fractures",
    videoHero: "locomotive stops just short as the creature tears up a section of miniature track beside it",
    aftermath: "dust settles around train, wheels stop spinning and creature hand remains over the broken railway",
    soundMachine: "locomotive clatter and braking squeal",
    soundImpact: "hydraulics and cracking miniature terrain",
  },
  "ep-011": {
    label: "Helicopter Chase Through Neon City",
    icon: "🚁",
    imageCore: "A rain-wet miniature futuristic downtown with original neon-like colored practical lighting and tall glass towers. Two generic miniature helicopters weave through the model on physical wire rigs while tiny controlled practical blast effects fire behind them.",
    primarySubject: "lead helicopter threading between miniature towers",
    actionChain: "\"Action!\" → helicopters already race forward → first banks around glass tower → second follows → rooftop dust blast erupts behind them → lead aircraft dives lower → rotor wash scatters wet street debris → another practical blast erupts farther back",
    videoHero: "both helicopters cross the foreground while a large controlled miniature blast blooms between towers behind them",
    aftermath: "smoke rolls through streets while helicopters exit and tiny debris continues falling",
    soundMachine: "rotor buzz and wire-rig movement",
    soundImpact: "a controlled blast with glass-like miniature debris",
  },
  "ep-012": {
    label: "Helicopters Circle Erupting Volcano",
    icon: "🚁",
    imageCore: "A miniature volcanic island metropolis surrounds a large artificial mountain. Several generic miniature helicopters circle on practical rigs while smoke, ash and controlled glowing practical eruption effects burst from the model volcano.",
    primarySubject: "helicopters escaping the expanding eruption plume",
    actionChain: "\"Action!\" → helicopters already circle → volcano vent bursts → ash shoots upward → first helicopter banks away → glowing practical material runs down miniature slope → second ash burst expands → helicopters cross in front of plume",
    videoHero: "the largest eruption column rises many times higher than the miniature skyline as all aircraft peel away",
    aftermath: "ash continues drifting, helicopters exit and glowing material creeps down the slope",
    soundMachine: "rotor buzz and compressed-air eruption",
    soundImpact: "a deep rumble with falling debris",
  },
  "ep-013": {
    label: "Cargo Plane Skims Downtown Rooftops",
    icon: "✈️",
    imageCore: "A generic miniature cargo aircraft on a concealed practical motion rig flies extremely low above a dense miniature business district. Rooftop antennas, vents and lightweight breakaway structures sit directly beneath its path.",
    primarySubject: "low-flying cargo aircraft",
    actionChain: "\"Action!\" → aircraft already enters frame → passes inches above first rooftop → prop/jet wash tears loose lightweight rooftop pieces → aircraft banks between towers → wingtip clips breakaway antenna → antenna tumbles → aircraft clears final building",
    videoHero: "aircraft crosses closest to camera as a line of rooftop debris erupts behind it",
    aftermath: "aircraft exits while rooftop pieces and dust continue falling",
    soundMachine: "the aircraft engine rig and wind blast",
    soundImpact: "metal rattles and debris impacts",
  },
  "ep-014": {
    label: "Helicopter Rescue During Giant Flood",
    icon: "🚁",
    imageCore: "A miniature flooded downtown built into the practical tank. A generic miniature rescue helicopter hovers on a visible production rig above rooftops while physical floodwater rushes through streets beneath it.",
    primarySubject: "hovering miniature helicopter above advancing flood",
    actionChain: "\"Action!\" → helicopter already hovers → flood immediately surges through first street → tiny debris floats past → helicopter shifts sideways → water hits lower buildings → rooftop structures shake → second surge arrives",
    videoHero: "the helicopter holds above one rooftop while the largest practical surge engulfs the blocks directly beneath it",
    aftermath: "water continues rushing, helicopter drifts away and foam/debris circle buildings",
    soundMachine: "rotors and pump machinery",
    soundImpact: "rushing water and crew calls",
  },
  "ep-015": {
    label: "Airliner Emergency Over Mountain City",
    icon: "✈️",
    imageCore: "A generic miniature passenger aircraft crosses a snowy alpine city on a physical flight rig. Giant industrial fans and snow cannons create a practical blizzard around miniature mountain ridges and buildings.",
    primarySubject: "aircraft struggling through the practical whiteout",
    actionChain: "\"Action!\" → fans roar immediately → aircraft already moves → snow blasts sideways → plane rocks subtly on rig → passes mountain ridge → snow obscures it momentarily → it reappears above miniature rooftops",
    videoHero: "aircraft emerges dramatically through the densest practical snow plume directly above the tiny city",
    aftermath: "aircraft exits while snow continues ripping across rooftops",
    soundMachine: "the aircraft engine and industrial fans",
    soundImpact: "rattling snow and crew chatter",
  },
  "ep-016": {
    label: "Helicopter vs Tornado",
    icon: "🚁",
    imageCore: "A miniature plains metropolis beneath an enormous practical dust funnel generated by industrial fans and controlled particle tubes. A generic miniature helicopter banks beside the funnel on a physical rig.",
    primarySubject: "helicopter trying to clear the practical tornado",
    actionChain: "\"Action!\" → funnel already rotates → helicopter immediately banks → dust crosses streets → lightweight miniature debris lifts → helicopter moves around funnel edge → tornado crosses roadway → debris passes behind aircraft",
    videoHero: "funnel reaches maximum density as the helicopter narrowly crosses its foreground edge",
    aftermath: "helicopter escapes while tornado continues moving through the miniature",
    soundMachine: "industrial fans and rotor buzz",
    soundImpact: "debris rattles and a deep wind roar",
  },
  "ep-017": {
    label: "Plane Flies Through Meteor Impact",
    icon: "✈️",
    imageCore: "A generic miniature aircraft crosses above a tiny metropolitan skyline while a theatrical practical meteor-impact effect erupts behind the city using compressed dust, smoke, safe light effects and breakaway terrain.",
    primarySubject: "aircraft escaping the expanding impact plume",
    actionChain: "\"Action!\" → plane already crosses → impact fires behind skyline → dust ring expands → aircraft banks → miniature rooftop debris lifts → plume grows upward → aircraft crosses in front of it",
    videoHero: "the practical impact column towers above the miniature while the aircraft passes silhouetted against it",
    aftermath: "plane exits and dust continues expanding across the model",
    soundMachine: "the aircraft engine and a compressed blast",
    soundImpact: "a deep impact with debris",
  },
  "ep-018": {
    label: "Helicopter Escapes Collapsing Dam",
    icon: "🚁",
    imageCore: "A miniature mountain dam towers above a valley settlement built into the practical water tank. A generic miniature helicopter races toward the foreground while breakaway dam sections and dump tanks release physical water behind it.",
    primarySubject: "helicopter fleeing the advancing water",
    actionChain: "\"Action!\" → helicopter already moves → first dam section cracks → water punches through → aircraft accelerates → opening widens → wall of water enters valley → buildings disappear beneath surge",
    videoHero: "the central dam section gives way and a massive physical wall of water erupts behind the escaping helicopter",
    aftermath: "helicopter clears frame while water continues consuming the miniature valley",
    soundMachine: "rotor buzz and concrete cracking",
    soundImpact: "a hydraulic release and huge water roar",
  },
  "ep-019": {
    label: "Cargo Plane Lands on Flooded Runway",
    icon: "✈️",
    imageCore: "A generic miniature cargo aircraft approaches a partially submerged miniature runway. Physical water covers the surface while tiny runway lights and airport structures remain visible around it.",
    primarySubject: "aircraft touching down through water",
    actionChain: "\"Action!\" → aircraft already descends → wheels contact flooded runway → first spray fans outward → aircraft rolls → deeper water produces larger spray → runway lights disappear beneath wake",
    videoHero: "the aircraft crosses the wettest section and throws two enormous symmetrical practical sheets of water high above the miniature",
    aftermath: "aircraft continues rolling while spray collapses back across runway",
    soundMachine: "the aircraft engine and wheel contact",
    soundImpact: "rushing spray and pump hum",
  },
  "ep-020": {
    label: "Helicopters Search Abandoned Snow City",
    icon: "🚁",
    imageCore: "A miniature abandoned alpine downtown buried in artificial snow. Two generic miniature helicopters hover above it with practical spotlights while giant fans and snow machines drive snow through empty streets.",
    primarySubject: "moving helicopter searchlights through the snow",
    actionChain: "\"Action!\" → rotors already move → spotlights sweep streets → snow immediately intensifies → first helicopter crosses between towers → second light reveals buried vehicles → wind lifts rooftop snow → whiteout grows",
    videoHero: "both searchlights converge on one central building just as a huge practical snow plume engulfs the district",
    aftermath: "helicopters drift apart while snow continues falling through the beams",
    soundMachine: "rotors and fans",
    soundImpact: "snow hiss and equipment hum",
  },
  "ep-021": {
    label: "Runaway Train Through Flooded City",
    icon: "🚂",
    imageCore: "A miniature railway cuts through a flooded city model. A generic miniature locomotive races along partially submerged tracks while physical water surges around buildings.",
    primarySubject: "moving locomotive",
    actionChain: "\"Action!\" → train already races → front wheels strike shallow floodwater → spray erupts → train crosses intersection → larger surge hits side → tiny debris spins away → locomotive pushes through",
    videoHero: "train blasts through the deepest flooded section, producing a huge practical bow wave",
    aftermath: "locomotive exits while water continues crossing tracks",
    soundMachine: "train clatter and motor whine",
    soundImpact: "water impacts and pump hum",
  },
  "ep-022": {
    label: "Train Crosses Bridge During Earthquake",
    icon: "🚂",
    imageCore: "A miniature passenger train crosses a long model bridge above a tiny valley city. Mechanical shake rigs distort the bridge while breakaway masonry and rock pieces surround the supports.",
    primarySubject: "train trying to clear the shaking bridge",
    actionChain: "\"Action!\" → bridge immediately trembles → train already moves → first support shifts → carriage rocks → masonry falls → track bends slightly → final carriage approaches far side",
    videoHero: "a bridge support partially collapses immediately after the last carriage clears it",
    aftermath: "train continues away while damaged bridge deck settles and debris falls",
    soundMachine: "train clatter and the mechanical shake rig",
    soundImpact: "structural groans and falling rubble",
  },
  "ep-023": {
    label: "Subway Bursts Through Downtown Street",
    icon: "🚇",
    imageCore: "A miniature downtown intersection contains a concealed practical subway-car rig beneath a breakaway street surface. Cracked pavement, tiny vehicles and surrounding buildings frame the eruption point.",
    primarySubject: "subway car physically breaking through the miniature roadway",
    actionChain: "\"Action!\" → street already vibrates → cracks spread → pavement lifts → subway nose bursts through → lightweight road fragments scatter → vehicle slides forward through debris",
    videoHero: "the miniature subway car fully erupts through the intersection as a large practical dust cloud expands around it",
    aftermath: "car stops while pavement pieces fall back and dust rolls outward",
    soundMachine: "underground rumble and mechanical rail noise",
    soundImpact: "breaking plaster and debris",
  },
  "ep-024": {
    label: "Train vs Avalanche",
    icon: "🚂",
    imageCore: "A miniature alpine railway hugs a steep artificial mountain above a tiny village. A generic miniature train races along the track while a huge practical snow-release rig begins collapsing behind it.",
    primarySubject: "train escaping avalanche front",
    actionChain: "\"Action!\" → train already moves → snow release immediately begins → first powder reaches track → locomotive rounds bend → avalanche accelerates → miniature trees disappear → final carriage clears ridge",
    videoHero: "enormous physical snow mass sweeps across the railway just behind the last carriage",
    aftermath: "train exits while snow continues burying tracks and village edges",
    soundMachine: "train clatter and the snow release",
    soundImpact: "deep rushing snow and wind",
  },
  "ep-025": {
    label: "Convoy Escapes Giant Sandstorm",
    icon: "🚛",
    imageCore: "A miniature desert highway passes through a tiny roadside settlement. Several generic miniature trucks race toward the foreground while giant fans push a dense practical wall of dust behind them.",
    primarySubject: "convoy outrunning the advancing dust wall",
    actionChain: "\"Action!\" → trucks already move → fans immediately intensify → dust front enters town → signs and lightweight debris whip sideways → convoy passes first buildings → dust swallows road behind them",
    videoHero: "the densest dust wall consumes the entire settlement while the final truck emerges from its leading edge",
    aftermath: "trucks continue toward foreground as dust rolls behind them",
    soundMachine: "truck motors and industrial fans",
    soundImpact: "sand and debris rattling",
  },
  "ep-026": {
    label: "Bus Jumps Collapsing Bridge",
    icon: "🚌",
    imageCore: "A generic miniature bus races along a bridge whose central deck is rigged with controlled breakaway sections. Tiny vehicles and an artificial canyon sit below.",
    primarySubject: "miniature bus crossing the failing bridge",
    actionChain: "\"Action!\" → bus already accelerates → bridge begins cracking behind it → first deck section drops → bus reaches raised break → front wheels leave surface → bus crosses small gap → rear deck collapses",
    videoHero: "bus lands on the intact far section at the exact moment the central miniature span falls away behind it",
    aftermath: "bus rolls forward while bridge pieces continue dropping into canyon",
    soundMachine: "the miniature engine and tire rumble",
    soundImpact: "bridge cracks and debris impacts",
  },
  "ep-027": {
    label: "Cars Escape Falling Skyscraper",
    icon: "🚗",
    imageCore: "A miniature downtown avenue contains several moving generic model cars while a tall breakaway skyscraper leans dramatically above the street on a controlled practical collapse rig.",
    primarySubject: "escaping cars beneath the falling miniature tower",
    actionChain: "\"Action!\" → cars already race → tower immediately begins tilting → glass-like lightweight fragments fall → cars cross intersection → facade sections peel away → tower accelerates downward",
    videoHero: "skyscraper crashes across the avenue immediately behind the final escaping car, releasing a huge practical dust cloud",
    aftermath: "cars exit while dust and building fragments continue settling",
    soundMachine: "tiny engines and a structural groan",
    soundImpact: "facade breakage and heavy miniature collapse",
  },
  "ep-028": {
    label: "Train Through Burning Forest Town",
    icon: "🚂",
    imageCore: "A miniature railway passes through a forest settlement with controlled practical flame bars safely positioned along sections of artificial vegetation and structures. A generic miniature train races through smoke.",
    primarySubject: "locomotive crossing the smoky burning miniature",
    actionChain: "\"Action!\" → train already enters → controlled flame effects rise → smoke crosses tracks → locomotive passes first burning section → wind pushes flame sideways → train emerges through denser smoke",
    videoHero: "train crosses foreground as the largest controlled flame effect rises behind the final carriage",
    aftermath: "train exits while smoke and small controlled flames remain active",
    soundMachine: "locomotive clatter and flame roar",
    soundImpact: "fan noise and crackling practical material",
  },
  "ep-029": {
    label: "Fuel Truck Escapes Volcano",
    icon: "🚛",
    imageCore: "A generic miniature tanker-style movie truck races down a winding artificial mountain road while a practical volcano rig behind it produces ash, smoke and glowing non-realistic safe FX material.",
    primarySubject: "truck descending ahead of eruption",
    actionChain: "\"Action!\" → truck already rolls downhill → volcanic vent immediately bursts → ash expands → truck rounds bend → practical glowing flow reaches upper road → dust and lightweight rocks fall behind vehicle",
    videoHero: "the largest eruption plume rises as the truck crosses the lowest foreground road",
    aftermath: "truck exits while ash continues falling and practical glow creeps down the miniature slope",
    soundMachine: "the vehicle motor and eruption blast",
    soundImpact: "rock impacts and rumble",
  },
  "ep-030": {
    label: "Highway Chase During Meteor Shower",
    icon: "🚗",
    imageCore: "A miniature elevated highway snakes through an original futuristic city while several generic miniature cars race along it. Multiple theatrical practical impact bursts erupt sequentially in empty model areas around the roadway.",
    primarySubject: "cars escaping sequential practical impacts",
    actionChain: "\"Action!\" → cars already race → first impact erupts behind them → dust crosses highway → cars change lanes → second impact fires beside distant tower → lightweight debris falls → third larger impact erupts ahead but off the roadway → convoy threads past",
    videoHero: "the largest practical impact plume rises beside the elevated highway while the cars cross directly in front of it",
    aftermath: "vehicles continue away as several dust columns expand and debris settles",
    soundMachine: "tiny engines and successive impact thumps",
    soundImpact: "compressed-air blasts and debris",
  },
};

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
    return { place: idea.place, disaster: idea.disaster, vantage: idea.vantage, episodeId: idea.id };
  }
  // "new-disaster"/"new-place" deliberately move away from whatever preset
  // was selected (if any) into generic custom territory, so the bespoke
  // episode id doesn't carry over — it wouldn't match the new combo anyway.
  if (mode === "new-disaster") {
    return { place: current.place, disaster: pickDifferent(Object.keys(DISASTERS), current.disaster), vantage: current.vantage, episodeId: null };
  }
  // "new-place"
  return { place: pickDifferent(EPISODE_IDEAS.map((idea) => idea.place), current.place), disaster: current.disaster, vantage: current.vantage, episodeId: null };
}

/* =====================================================================
   PROMPT ASSEMBLY — locked style bible + disaster module + vantage
   module + user's place description + hard negatives. The user never
   sees or edits this; they only pick the three dials above.
   ===================================================================== */
export function buildImagePrompt({ place, disaster = DEFAULT_DISASTER, vantage = DEFAULT_VANTAGE, episodeId }) {
  const cam = vantageModule(vantage);
  const bespoke = episodeId ? BESPOKE_EPISODES[episodeId] : null;

  // Bespoke episodes carry one fully hand-written, self-contained scene
  // description (imageCore) in place of the generic place+disaster
  // assembly — that's the whole point: the terrain and the disaster are
  // written together as one coherent unit instead of two disconnected
  // pieces.
  if (bespoke) {
    return [
      `A photorealistic amateur phone photograph captured ${cam.capture}, on the set of a giant blockbuster practical-effects film shoot.`,
      bespoke.imageCore,
      STYLE_BIBLE,
      `Camera framing: ${cam.framing}.`,
      "Vertical 9:16 full-bleed composition for TikTok and Reels.",
      HARD_NEGATIVES,
    ].join("\n");
  }

  const subject = String(place ?? "").trim();
  const fx = disasterModule(disaster);
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

// Normalizes generic (disaster-module) and bespoke (fully hand-written
// episode) content into one shape so buildVideoPrompt only has to
// assemble the template once. Bespoke episodes fold their action start
// into `actionChain` already (it opens with the "Action!" trigger), so
// `actionStartLine`/`exclusionsLine` are empty for them — the generic
// path supplies both.
function resolveVideoContent({ disaster, episodeId }) {
  const bespoke = episodeId ? BESPOKE_EPISODES[episodeId] : null;
  if (bespoke) {
    return {
      fxLine: "",
      primarySubject: bespoke.primarySubject,
      actionStartLine: "",
      actionChain: bespoke.actionChain,
      videoHero: bespoke.videoHero,
      aftermath: bespoke.aftermath,
      cameraReaction: "the nearest crew member instinctively braces, ducks or steps backward during the strongest impact, without becoming the focus",
      soundMachine: bespoke.soundMachine,
      soundImpact: bespoke.soundImpact,
      exclusionsLine: "",
    };
  }
  const fx = disasterModule(disaster);
  return {
    fxLine: fx.fx,
    primarySubject: fx.primarySubject,
    actionStartLine: ` Within a fraction of a second, ${fx.actionStart}.`,
    actionChain: fx.actionChain,
    videoHero: fx.videoHero,
    aftermath: fx.aftermath,
    cameraReaction: fx.cameraReaction,
    soundMachine: fx.soundMachine,
    soundImpact: fx.soundImpact,
    exclusionsLine: ` ${fx.exclusions}.`,
  };
}

// Single-take structure: everything happens in ONE unbroken phone
// recording, frame 0 locked to the hero image, "Action!" fires almost
// immediately (no establishing pause), and one continuous causal chain
// of events escalates to a hero payoff around 5.5-7s before an aftermath
// that stays visually active through the last frame. The five stages
// below (start/chain/hero/aftermath) are internal reasoning only — they
// get compiled into flowing prose, never exposed to the model as
// separate labeled shots, so nothing reads as a cut between scenes.
export function buildVideoPrompt({ place, disaster = DEFAULT_DISASTER, vantage = DEFAULT_VANTAGE, withSound = false, episodeId }) {
  const subject = String(place ?? "").trim();
  const cam = vantageModule(vantage);
  const content = resolveVideoContent({ disaster, episodeId });
  const movement = cam.movement.replaceAll("{{subject}}", content.primarySubject);
  // The "Action!" call is the single least reliable line in this whole
  // prompt — video-audio models are far better at ambient/machine/impact
  // sound than at rendering one specific spoken word on cue. Two things
  // measurably raise the odds: stating it as a strict non-optional
  // requirement (not a soft description), and placing the audio cue
  // directly beside the matching visual beat instead of burying it at
  // the very end of the prompt, after several paragraphs of unrelated
  // instructions have diluted it.
  const actionAudio = withSound
    ? ` This exact moment MUST include an audible male director's voice off-camera clearly shouting the single word "Action!" — this spoken cue is REQUIRED and non-negotiable, not optional background noise. It is immediately followed by ${content.soundMachine}, building straight into ${content.soundImpact} at the hero payoff.`
    : "";
  const audioDirection = withSound
    ? [
        "AUDIO IS PRESENT FROM FRAME ONE, never silence.",
        "Crew reactions, machinery and environmental sound stay naturally audible through the end, decaying gradually in the final 1.5 seconds — fading machinery, settling debris, crew chatter and radio calls, never total silence until the very last frame.",
        "Diegetic production audio only: no additional dialogue or narration beyond the single \"Action!\" call, no music, score or soundtrack — exactly like a phone recording accidental audio.",
      ].join(" ")
    : "NO AUDIO GENERATED. Create a completely silent video with no audio track.";

  return [
    `SINGLE UNBROKEN TAKE. ONE PHONE CAMERA. ONE PHYSICAL SET. The entire ${VIDEO_DURATION}-second video is one continuous amateur behind-the-scenes phone recording of the exact set shown in the reference image — the rebuild of "${subject}".`,
    `FRAME 0 MUST MATCH THE REFERENCE IMAGE. Treat the supplied hero image as the literal first frame of this recording. Preserve the exact miniature${content.fxLine ? `, ${content.fxLine}` : ""}, architecture, crew positions, equipment, lighting, blue chroma wall, tracking crosses, foreground objects, camera height, lens perspective and spatial relationships. Do not reinterpret the camera angle or relocate the camera.`,
    "NO CUTS. NO EDITS. NO SECOND SHOT. NO SECOND ANGLE. NO CUTAWAY. NO INSERT. NO TIME JUMP. NO TRANSITION. NO TELEPORTING CAMERA. NO RESET. Everything happens continuously in front of this same phone camera.",
    movement,
    `ACTION BEGINS IMMEDIATELY — there is no establishing pause. At the very first moment of the clip, the practical rig is already engaging as the crew triggers it.${actionAudio}${content.actionStartLine}`,
    `From roughly 0.3-5.5 seconds, one continuous physical chain reaction unfolds naturally in the same frame: ${content.actionChain}. Each event physically causes the next — there are no separate scenes or disconnected beats, and the practical effect keeps growing across the miniature while the camera stays at the same physical position.`,
    `Around 5.5-7.0 seconds, the event reaches its single biggest payoff: ${content.videoHero}. The effect rises dramatically above the tiny miniature while the enormous soundstage stays visible, reinforcing that this is a practical model being filmed by full-size crew. The only human reaction: ${content.cameraReaction}. Do not introduce new people.`,
    `From roughly 7.0-8.0 seconds, the main impact has passed but the same physical event stays active: ${content.aftermath}. Nothing resets and the camera does not change angle.`,
    audioDirection,
    `The miniature stays predominantly in the lower third of frame. The gigantic blue chroma wall and cavernous soundstage remain visible above it, and full-size crew remain visible beside the miniature as the scale reference.${content.exclusionsLine}`,
    `Composition and equipment stay consistent throughout: ${cam.framing}.`,
    "ABSOLUTELY AVOID: montage, multi-shot sequence, cinematic coverage, reverse angle, second camera, cutaway, insert shot, scene transition, time jump, camera teleportation, dramatic zoom, orbiting camera, architecture morphing, newly appearing characters, changing set layout, CGI-style transformation, text, captions, logos, UI or watermark.",
  ].join("\n");
}

export async function generateBehindTheScenesImage({ place, disaster, vantage, qualityId = DEFAULT_QUALITY_TIER, episodeId }) {
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return createImageJobSimple({
    subject: buildImagePrompt({ place, disaster, vantage, episodeId }),
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

export async function animateBehindTheScenes({ imageUrl, place, disaster, vantage, qualityId = DEFAULT_QUALITY_TIER, episodeId }) {
  if (!imageUrl) throw new Error("animateBehindTheScenes: missing imageUrl");
  const tier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  return createVideoJobSimple({
    subject: buildVideoPrompt({ place, disaster, vantage, withSound: tier.withSound, episodeId }),
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
