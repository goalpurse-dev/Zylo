// M2: the kit catalog the scene planner reads: the world, every part kind with its settings, its verbs, and the
// materials. A planner may only use what is here (the layout check refuses anything else).
import { VERBS } from "./verbs.js";
import { MATERIAL_NAMES } from "./materials.js";

// the finishing touches each setting allows ("Add a ..." sentences): a prop out of place (grass at a car wash) is refused
export const SETTING_PROPS = Object.freeze({
  yard: ["shrubs", "youngTrees", "fence", "grass", "prop:mailbox", "prop:planter", "prop:bench"],
  park: ["shrubs", "youngTrees", "fence", "grass", "prop:bench", "prop:trashCan", "prop:planter", "prop:bikeRack"],
  street: ["prop:bench", "prop:trashCan", "prop:planter", "prop:bikeRack", "prop:mailbox"],
  carwash: ["prop:kiosk", "prop:vacuum", "prop:towelRack", "prop:trashCan", "canopy"],
  garage: ["prop:toolbox", "prop:trashCan", "prop:pottedPlant", "prop:bikeRack"],
  room: ["prop:pottedPlant", "prop:trashCan"],
  plain: ["prop:planter", "prop:trashCan"],
});
export const WORLD_DOC = `THE WORLD (units are about 1 m; y up, the cut face is the plane z = 0 facing the camera, ground surface y = 0)
- A lawn and a house behind a cutaway of the ground. The viewer sees the ground in section on the face z = 0:
  soil strata down to y = -26, a stony band with a glossy groundwater film at y -11 to -14, roots, rocks.
- world.cut {x0, x1, z0, depth}: ONE box cut dug into the ground, open on the face (it runs from z0 < 0 to z = 0).
  The ground mesh has a hole there. Everything the video builds in the ground goes in or next to the cut.
  Examples: landfill pit {x0:-5, x1:5, z0:-8, depth:6}; French drain trench along the house {x0:-11.4, x1:0.8, z0:-2, depth:3.6}.
  A narrow deep shaft (a well) is fine: {x0:-0.7, x1:0.7, z0:-1.4, depth:13}. Keep |x| <= 14, depth <= 20, z0 >= -10.
- world.house [x, 0, z]: the house (11 wide, 6.5 deep, 9.4 tall with its roof; default [-8, 0, -30], far behind).
  world.porch false removes its porch (when a trench runs along its front). The house must not overlap the cut.
- world.trees [[x, z, scale?], [x, z, scale?]]: the two big trees; world.road [x, 0.01, z]: the road (it runs along z).
- world.roots {pad, to}: roots near the cut move right of x = to;  world.rocksAvoid [[x0, x1, y0, y1], ...]: no rocks
  or roots on the face in these boxes (pipe runs, pits you will build in the face).
- THE SETTING: pick the one that fits the topic; the videos must not all look the same.
  The yard (the default: lawn, house, trees, road) suits things around a house: drains, wells, septic tanks, pools, gutters.
  world.backdrop {type: "street", sign: "SHOP NAME", lampX, benchX}: a sidewalk over the cut ground in front of shop fronts,
    with taller buildings behind. It suits city things: a vending machine, a fire hydrant, a manhole, a bus stop, a storm drain.
    The sidewalk top is y 0.12, so props stand at y 0.12, and the world's cut is left open in it.
  world.backdrop {type: "park", lampX, benchX}: a gravel path, a bench and a lamp on the lawn. It suits a playground, a fountain, a pond.
  world.backdrop {type: "garage", x (0), back (-9), color}: a concrete driveway (top y 0.08) up to a garage with its door half open
    (lit shelves and a workbench inside), the side of the house to its left. It suits a car, a garage door, a water heater, a sump.
  world.backdrop {type: "room", x0 (-9), x1 (9), back (-7), h (4.2), windowX, chairX}: a room in section: a wood floor (top y 0.12)
    over the cut ground, a back wall with a window, the left wall, the ceiling and a roof slice; an armchair, a lamp, a rug.
    It suits things inside a home: an air conditioner, a radiator, a toilet, a sump pump in the floor, a smoke detector.
    Use it for every basement or indoor topic (a sump pump, a water heater, a furnace): the cut below its floor is the basement.
  world.backdrop {type: "carwash", x0 (-7), x1 (7), back (-8), h (5.2), sign, color}: a car wash bay: a wet concrete floor (top
    y 0.1) whose drain is the cut, a tiled back wall, the left wall, a canopy with the lit sign. It suits a car wash, a garage pit.
  The interior settings (room, carwash) and the garage replace the yard: set house, worker, moreTrees and road to false.
  A car, a machine or a person stands on solid floor beside the cut, never over its open hole (the cut is the ground in section).
- SETTING PROPS: the "Add ..." finishing touches come only from the setting's list: yard: shrubs, young trees, a fence, a grass cap, a mailbox, a planter, a bench; park: shrubs, young trees, a fence, grass, a bench, a trash can, a planter, a bike rack; street: a bench, a trash can, a planter, a bike rack, a mailbox; carwash: a payment kiosk, a vacuum station, a towel rack, a trash can, a canopy; garage: a toolbox, a trash can, a potted plant, a bike rack; room: a potted plant, a trash can. Never grass or bushes at a car wash, a street, a garage or a room.
- REALISTIC SETTINGS: nothing natural where it would not be. A creek, a stream or a pond never lies on a paved floor
  (a car wash lot, a sidewalk, a garage, a room): it is a stream beside the setting on the grass (creek axis "z"), and
  water running off the floor reaches it the real way: across the floor to a storm drain grate, down a pipeRun in the cut
  face, out into the stream. In the street, garage, room and car wash, dug dirt is taken away (it never stays as a pile).
- NOTHING FLOATS: every part rests on the ground, the floor or another part. A roof is a canopy (it has its posts). Pipes start and end at a part, the ground or the cut face.
  world.house false removes the house; world.worker false removes the worker figure (keep it only if the topic has a worker);
    world.moreTrees false removes the four far trees; world.road false removes the far road. With a backdrop, set all four to false.
- The soil shading helpers soilLeak (landfill seeps, murky groundwater), wetBand (a wet band round the cut) and soak
  (water soaking down from a soak pit) paint the face itself.`;

// per kind: what it is, its params, and notes. Positions are world coordinates.
export const KIND_DOCS = {
  settle: ["any open container seen in section (a septic tank, an oil-water separator, a sump basin, a settling pit): its walls and floor pop in, water fills it, sand or sludge grains SINK and pile up on the floor, a dark oil or scum layer RISES to the top, the water clears. Use it whenever a sentence needs a tank, a basin or a pit that holds something", "box {x0,x1,y0,y1,z0,z1} (the inside, seen at the face: z1 = 0), wallColor (a plastic basin, e.g. #2f6fb0; default concrete), lid (false: keep it open so the layers read), murky, clearColor", "verbs show (the tank walls), fill, sink (the sand falls), float (the oil rises), clear"],
  creek: ["a creek on the ground with banks and ripples drifting downstream; it can turn dirty (soap, oil) and clean again. Use it whenever a sentence names a creek, a river or a stream", "in a yard or a park: x0, x1 (its length, along x; beside the cut, not over it), width (2.4), depth (0.7), y (the ground top), dir (1 or -1); it runs along the front edge, so the face shows it in section. Beside a paved setting (a car wash, a street, a garage): axis \"z\", x (its centre, past the paved floor: a car wash lot ends at x 13, a street at 26), z0 (its far end, -26), width (2.6), depth (0.8): a stream on the grass running toward the camera, the face shows it in section; water from the lot reaches it through a grate (storm drain) and a pipeRun in the cut face", "verbs show, dirty, clean"],
  flow: ["blobs moving along a path over a faint ribbon: water running across a slab to a drain or down to a creek, sludge pouring through a drain or a pipe, soap down a slope. Use it for every 'runs', 'pours', 'flows' action", "path [[x,y,z],...] (from where it starts to where it ends), look water|spray (a hose or nozzle jet: pale drops fanning out; water that starts in the air is a spray)|sludge|soap|oil|mud, size (0.16), speed, count", "verbs start, stop"],
  prop: ["a finishing-touch prop that belongs in the setting (see SETTING PROPS): it stands on the floor", "type (one of the setting's list), pos [x, y, z] (y = the floor top), rotY, scale (1)", "verb show"],
  grate: ["a dark slotted drain grate set into a slab or the floor (the drain the water and sludge run into)", "pos [x, y, z] (y = the slab top), width (1.6), depth (0.8)", "verb show"],
  canopy: ["a roof or canopy that stands on four posts (a roof must never float): the posts grow up, then the roof goes on", "x0, x1, z0, z1, y (the floor top), h (the post height, 4), color", "verb build"],
  car: ["a small car that drives in along x, stops, and drives on (wheels turn)", "pos [x, y, z] (where it stops; y = the setting's floor top), from (x, default pos - 16), to (x), color, scale (1)", "verbs arrive, leave; give each car an id (a carWash names its car)"],
  carWash: ["a car wash's machine over the bay: a spray arch and two spinning side brushes; it puts foam on the car in the bay", "pos [x, y, z] (the bay centre, where the car stops), width (3.6), height (3.4), car (the car part's id)", "verbs show (the arch), spray, stopSpray, brushes, close (brushes swing in), open, spin, foam, rinse"],
  trafficLight: ["a traffic signal on a pole, and the wire loop sawn into the road in front of it (seen in the cut) that feels a car's metal", "pos [x, y, z], height (5), loop [x, z, w, d] (the loop's centre and size, in the road over the cut)", "verbs show, red, yellow, green (switch lamps), loop (the wire loop appears), pulse (its field rings), stopPulse"],
  hydrant: ["a dry-barrel fire hydrant: the body above ground, the barrel down to the main valve deep below (in section at the face), the drain hole at the valve", "pos [x, y, z] (y = the sidewalk top), depth (3.2: the valve below the frost line), color", "verbs show, barrel, open (the stem turns, the valve opens), fill (water rises in the barrel), spray, close, drain (the barrel empties through the drain hole), stopDrain"],
  atm: ["a cash machine cut open on its right side: screen, keypad, card slot, the cassettes inside a safe, the belt up to the cash slot", "pos [x, y, z] (its base centre), color", "verbs show, screen, card, safe, cassettes, pick (a note travels from a cassette to the slot), cash"],
  vendingMachine: ["a vending machine on the lawn, cut open on its right side (coils, motors, coin chute, bin, drop sensor, cooler, lit header)", "pos [x, y, z] (its base centre; it faces the camera), color, header (the lit sign text)", "channels show, snacks, slot, steal, glass, coils, coin, spinA/spinB (turns), fallA/fallB, beam, cooler, light; give it a focus box"],
  miniMachines: ["a crowd of small drink machines popping up across the lawn", "area [x0, x1, z0, z1], count", "channels pop (a ramp: they pop one by one within it), gone"],
  dig: ["dig the world cut open (a plug sinks, dirt clumps fly to a mound)", "mound {x, z, rx, rz, h} (beside the cut, on the lawn), clumps (150), dark (true for a narrow shaft under 2.5 wide: its inside is shaded so the hole reads)", "channels dig, refill. Always the first beat."],
  panels: ["anchored boxes that wipe in from one side (liners, clay walls, covers, caps)", "panels: [{ch, mat, size [sx,sy,sz], anchor [ax,ay,az] (-1/0/1: the side it grows from), pos [x,y,z] (the anchor point), axis 'x'|'y'|'z' (the growing axis) or null (pops in), vis (0), r (0.04), uv [u,v]?}]", "each panel names its own channel ch; verbs: grow (with ch), pop (with ch)"],
  box: ["a plain static box (a foundation, a slab)", "mat, size [sx,sy,sz], pos [x,y,z] (its center), r (0.04), receiveShadow", "no verbs"],
  bags: ["a layer of trash bags that falls in and can lift out of the way and settle back", "area {x0,x1,z0,z1}, h (1.6), grid [5,4], n0, y0 (its floor), stagger, dur, fromAbove {xScale, y} or fromTruck {part, x, y, dz}", ""],
  dumpTruck: ["a dump truck that drives in along z, tips its bed and drives away", "x", "base {z: -40, load: 1}"],
  pipeRun: ["a solid pipe along a path of points that grows at constant speed (joints at bends)", "path [[x,y,z],...], r (0.24), radial, jointR, joints (true), mat (pipeWhite)", "pipes in the face sit at z = -0.06 (seen in section)"],
  pipeRunFlow: ["dark liquid dots running along a pipeRun", "pipe (a pipeRun id), count, size, speed, dz, mat (juice)", ""],
  tank: ["a cylindrical tank that pops in", "pos [x,0,z] (its base), r (1.3), h (2.6), bands [y...], mat (tankBlue)", ""],
  riser: ["a vertical pipe rising from y0 to y1", "x, z, y0, y1, r (0.2), mat (metal)", ""],
  boxPop: ["a box that pops in (a wellhead, a pump head, a valve, a meter)", "size [sx,sy,sz], pos [x,y,z] (center), r, mat", ""],
  flare: ["a cartoon gas flame with a glow and a warm light", "pos [x,y,z] (its base), intensity (30)", ""],
  bubbles: ["gas bubbles rising through a layer of the face", "x0, x1, y0, y1, z (-0.15), count, speed", ""],
  machine: ["a generator / pump box (grey with an orange band) that pops in", "pos [x,0,z], rotY", ""],
  fence: ["fence posts that pop in one after another, then rails", "x0, x1, step, zBack, sideStart, zFront, railZ", ""],
  youngTrees: ["small trees that pop in one after another", "trees [[x, z, scale]], stagger", ""],
  sheet: ["a printed newspaper page that rises out of the ground and sinks back", "masthead, date, headline, from [x,y,z], to [x,y,z], sink", ""],
  book: ["a book (canvas cover text) that rises out of the ground and sinks back", "w, h, bg, book true, spine, lines [{text, font, color, y} | {rule:true, y, color}], from, to, rot [rx,ry,rz]", ""],
  flag: ["a flag on a pole that pops in, gets a red 'no' cross, and goes", "at [x,0,z], colors [3 stripes], w, h, pole", "for a myth-bust about a country or a name"],
  shrubs: ["round bushes that pop in staggered (finishing touches)", "list [[x, z, scale]], stagger", ""],
  sign: ["the end card sign (Make videos like this with Zyvo)", "at [x,y,z] (on the lawn in front of the house, clear of the cut), rotY, scale (1.3-1.5)", "ALWAYS include one; it pops by itself after the voice"],
  crack: ["a dark crack that grows across a wall", "points [[x,y,z],...] (on the wall surface), r", ""],
  drops: ["mud lumps dropping onto a surface and stopping there", "x0, x1, count, fromY, landY, z, mat (mud)", ""],
  water: ["water filling a box (a flooded ditch, a full shaft); it sinks into gravel if `gravel` names a gravel part", "box {x0,x1,y0,y1,z0,z1}, gravel?, mat (water)", ""],
  gravel: ["a gravel fill with real pebbles on its face, stones pouring in, a water level inside, and a lift (to lay a pipe under it)", "box, faceBox (box inset, z1 0.04), pourBox, pourFrom, pourCount, water? (a water part), waterTop, waterSpan, drainDrop, mat (gravel), pebbleMat (pebbles)", ""],
  soakPit: ["a gravel soak pit in the face with pebbles and a water level", "box, faceBox, mat (gravelPit), pebbleMat (pebblesPit)", "base {wetY: box.y0}"],
  wipe: ["a block that wipes in along an axis (a soil cap, a grass strip, a slab, a concrete seal)", "box {x0,x1,y0,y1,z0,z1}, mat, axis ('x'|'y'|'z'), r, uvScale", ""],
  wrap: ["filter fabric wrapping a fill", "box, opts {thick, sides ['back','floor','top','left','right'], along 'x'|'z', stagger, dur}, mat (fabric)", ""],
  pipe: ["a perforated or solid pipe along a path, grown at constant speed", "path [[x,y,z],...], opts {r (0.3), color, perforated (false), holeSpacing}", "pipes in the face sit at z = -0.06; a vertical pipe is a path of 2 points"],
  pipeFlow: ["blue water dots running inside a kit pipe", "pipe (a pipe id), opts {count, size, offset [0,0,0.33]}, speed", ""],
  puddles: ["flat water patches on the lawn that spread and dry up", "list [[x, z, rx, rz]], rise [stagger], fall [stagger]", ""],
  rain: ["rain streaks over the scene", "x0, x1, z0, z1, yTop, yBot, count, width, opacity", ""],
  stream: ["water pouring off an edge (a roof eave, a pipe outlet)", "x0, x1, z, yTop, yBot, count", ""],
  light: ["the sun and sky: a storm (overcast) and a quick 'time passes' dip", "storm (true if the layout has a storm)", "include one 'light' part"],
  lawnWet: ["the lawn going dark and wet in the rain", "{}", ""],
  soilLeak: ["landfill seeps painted on the face and the murky groundwater", "x1, x2, murkX", "base {y1: -6, y2: -6}"],
  wetBand: ["a dark wet band in the soil round the cut", "cx, halfW, bottom", ""],
  soak: ["water soaking down from a soak pit toward the groundwater", "x0, x1, top", "base {front: top}"],
  arrows: ["pulsing white block arrows (in the face, or flat on a surface)", "list [{at [x,y,z], dir [dx,dy], travel, phase}], opts {scale, speed, flat}", "the explainer layer: show where something moves"],
  outline: ["a glowing yellow outline traced around the named part", "points [[x,y,z],...] (in front of the face: z 0.06-0.12), opts {r, closed}", "for the 'This is a…' sentence"],
  seepFlow: ["murky dots seeping down the face and spreading in the groundwater", "count, width, y0, fall, floor", ""],
};

export function catalogText() {
  const kinds = Object.entries(KIND_DOCS).map(([k, [what, params, notes]]) => {
    const verbs = Object.keys(VERBS[k] ?? {});
    return `- ${k}: ${what}\n    params: ${params}${notes ? `\n    notes: ${notes}` : ""}\n    verbs: ${verbs.length ? verbs.join(", ") : k === "panels" ? "grow (ch), pop (ch)" : "(none)"}`;
  });
  return `${WORLD_DOC}\n\nPART KINDS\n${kinds.join("\n")}\n\nMATERIALS (the only names a 'mat' may use)\n${MATERIAL_NAMES.join(", ")}\n\nSOUND LIBRARY (sfx 'lib' names)\ndirt (digging, pouring), drip (seeping), water_rush (water flowing in a pipe or flooding), flame, motor_hum (a pump or machine running); rain is only the rain bed (audio.rain)`;
}
