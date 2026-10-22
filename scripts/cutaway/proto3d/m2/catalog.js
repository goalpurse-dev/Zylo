// M2: the kit catalog the scene planner reads: the world, every part kind with its settings, its verbs, and the
// materials. A planner may only use what is here (the layout check refuses anything else).
import { VERBS } from "./verbs.js";
import { MATERIAL_NAMES } from "./materials.js";

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
- The soil shading helpers soilLeak (landfill seeps, murky groundwater), wetBand (a wet band round the cut) and soak
  (water soaking down from a soak pit) paint the face itself.`;

// per kind: what it is, its params, and notes. Positions are world coordinates.
export const KIND_DOCS = {
  dig: ["dig the world cut open (a plug sinks, dirt clumps fly to a mound)", "mound {x, z, rx, rz, h} (beside the cut, on the lawn), clumps (150)", "channels dig, refill. Always the first beat."],
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
