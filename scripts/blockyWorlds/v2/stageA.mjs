// IN THIS TOWN v2 (plan docs/in-this-town-plan.md, step 1): STAGE A "Our street" AS DATA.
// The set is worlds.py's suburb (zw_suburb) with the hero house = zw_house(8, x=0, north side) at the town scale
// (town.py: people 0.55, house walls 1.5x taller). Spots, cameras and obstacles are measured from zw_house / zw_suburb's
// own numbers (worlds.py:999-1107). People stand only on these spots; cameras sit only at these positions.
// Units: Blender units; x along the street, y toward the hero house (front wall y=18), z up.

export const BODY_R = 1.1;      // a person's half-width at the town scale (calibrated by the Blender test's measured dims)
export const MIN_GAP = 2.4;     // two people's spot centres are at least this far apart
export const H = { kid: 3.04, adult: 3.5, creature: 8.5 };   // measured on the step-1 render   // standing heights (head at ~0.88 H)
export const CREATURE_R = 2.2;

export const STAGE_A = {
  id: "A",
  name: "Our street",
  place: "suburb_street",              // the zw_build place
  remove: ["zw_hrail8", "zw_hrail28"], // the hero porch's rails (round 10: rails across every body on the porch)
  times: ["day", "sunset", "night", "storm", "morning"],
  // ---- where people may stand: [x, y, z(ground), tag]; tags are what the rule checks against
  spots: {
    porch_door:  { at: [0, 16.8, 0.6], tag: "porch", on: "deck" },
    porch_left:  { at: [-1.4, 16.0, 0.6], tag: "porch", on: "deck" },
    porch_right: { at: [1.4, 16.0, 0.6], tag: "porch", on: "deck" },
    step:        { at: [0, 13.2, 0.0], tag: "lawn" },
    gate:        { at: [0, 10.8, 0.0], tag: "lawn" },
    pave_left:   { at: [-2.8, 8.0, 0.25], tag: "pavement" },
    pave_mid:    { at: [0, 8.0, 0.25], tag: "pavement" },
    pave_right:  { at: [2.8, 8.0, 0.25], tag: "pavement" },
    pave_far:    { at: [-13, 8.0, 0.25], tag: "pavement" },
    road_left:   { at: [-5, 2.5, 0.06], tag: "road" },
    road_mid:    { at: [0, 2.5, 0.06], tag: "road" },
    road_right:  { at: [5, 2.5, 0.06], tag: "road" },
  },
  // ---- where the creature may stand (always behind the people as the camera sees them, with a clear gap)
  creature_spots: {
    cr_road_far:   { at: [-18, 0, 0] },
    cr_road_south: { at: [0, -3.5, 0] },
    cr_house_side: { at: [10.5, 15.5, 0] },
  },
  // ---- named camera positions: loc, target, lens; `people` = the spots it is made for, `creature` = its creature spot
  cameras: {
    house_wide:      { loc: [7, -2, 5], tgt: [0, 15, 3.5], lens: 22, shot: "wide", people: ["porch_left", "porch_right"] },
    porch_two:       { loc: [0, 11.6, 2.9], tgt: [0, 16.3, 2.4], lens: 24, shot: "two", people: ["porch_left", "porch_right"] },
    porch_door_med:  { loc: [0.6, 12.6, 2.7], tgt: [0, 16.8, 2.6], lens: 32, shot: "medium", people: ["porch_door"] },
    porch_low:       { loc: [1.5, 12.2, 0.9], tgt: [0, 16.5, 3.6], lens: 20, shot: "low", people: ["porch_door"] },
    from_porch:      { loc: [0.8, 16.4, 3.0], tgt: [0, 4, 2.0], lens: 24, shot: "medium", people: ["gate"], creature: "cr_road_south" },
    pave_two:        { loc: [2, -1.5, 2.2], tgt: [0, 8, 2.0], lens: 24, shot: "two", people: ["pave_left", "pave_mid"] },
    pave_close:      { loc: [0.4, 4.6, 2.5], tgt: [0, 8, 2.6], lens: 40, shot: "close", people: ["pave_mid"] },
    street_dark:     { loc: [5.5, 9, 2.4], tgt: [-16, 1, 4], lens: 19, fixed: true, shot: "medium", people: ["pave_mid"], creature: "cr_road_far" },
    step_med:        { loc: [2.5, 11.6, 2.6], tgt: [0, 13.2, 2.4], lens: 28, shot: "medium", people: ["step"] },
    house_side_cr:   { loc: [-3, 12.0, 2.2], tgt: [4, 14, 3.5], lens: 20, shot: "medium", people: ["step"], creature: "cr_house_side" },
  },
  // ---- what stands in the way (from zw_house(8, 0, +1) and zw_suburb); z1 = top. "deck" is a floor, not a wall.
  deck: { x0: -5, x1: 5, y0: 14.4, y1: 18 },
  obstacles: [
    { n: "house", box: [-7, 7, 18, 30, 0, 19.5] },
    { n: "deck_edge", box: [-5, 5, 14.4, 18, 0, 0.6], floor: true },
    { n: "post_l", cyl: [-4.6, 14.7, 0.22, 9.0] },
    { n: "post_r", cyl: [4.6, 14.7, 0.22, 9.0] },
    { n: "porch_roof", box: [-5.4, 5.4, 14.0, 18.2, 6.0, 10.2] },
    { n: "hedge_l", box: [-6.1, -3.1, 13.0, 14.2, 0, 1.6] },
    { n: "hedge_r", box: [3.1, 6.1, 13.0, 14.2, 0, 1.6] },
    { n: "flowers_l", cyl: [-3.6, 12.6, 0.6, 0.6] },
    { n: "flowers_r", cyl: [3.6, 12.6, 0.6, 0.6] },
    { n: "tree", cyl: [-7.5, 14, 1.5, 8.0] },
    { n: "fence_l", box: [-6.6, -1.85, 10.8, 11.2, 0, 2.2] },
    { n: "fence_r", box: [1.85, 6.6, 10.8, 11.2, 0, 2.2] },
    { n: "mailbox", cyl: [6.6, 10.4, 0.5, 3.3] },
    { n: "lamp_l", cyl: [-10, 10.2, 0.3, 9.0] },
    { n: "lamp_r", cyl: [10, 10.2, 0.3, 9.0] },
    { n: "house_s", box: [5, 19, -30, -18, 0, 19.5] },
  ],
  // ---- the tested actions this stage ships with (plan section 1); the Blender test proves each one
  actions: {
    people: ["stand", "walk_to_spot", "run_to_spot", "crouch", "point", "hold_up", "look_at", "turn_to", "wave", "cheer", "shiver", "hands_head", "sit_step", "knock"],
    creature: ["enter_from_dark", "walk_to_spot", "loom", "leave_into_dark"],
    props: ["state_change", "pop_in", "vanish"],
  },
};
