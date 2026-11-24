// IN THIS TOWN v2: STAGE B, PIECE 1: "the dining corner" (owner 2026-11-24). A room corner built by us (no town around it):
// a table, four seats, plates and food, a window with closed curtains behind the table, a warm lamp over the table, the
// open side toward -Y for the cameras. Seats are spots (people sit a body apart, their legs under the table). Units and
// the facing convention as Stage A; the floor at z = 0.
import { BODY_R, H } from "./stageA.mjs";

export const STAGE_B = {
  id: "B",
  name: "The dining corner",
  build: "dining",
  times: ["dinner", "dinner_cold"],
  open_side: [0, -1],
  table: { x0: -1.6, x1: 1.6, y0: -0.95, y1: 0.95, top: 1.1 },
  // seats: where the sitter's body is (on the chair), facing the table; head = the seated head-top height (kid / adult)
  spots: {
    seat_back:  { at: [0, 1.9, 0], tag: "seat", seat: true, face: [0, 0], head: 2.35 },     // the window behind (Mom's seat)
    seat_left:  { at: [-2.45, 0, 0], tag: "seat", seat: true, face: [0, 0], head: 2.1 },    // my seat
    seat_right: { at: [2.45, 0, 0], tag: "seat", seat: true, face: [0, 0], head: 2.1, booster: true },
    seat_front: { at: [0, -1.9, 0], tag: "seat", seat: true, face: [0, 0], head: 2.1 },    // the open side (the empty place)
    stand_kitchen: { at: [-3.4, 2.0, 0], tag: "standing" },
    stand_window: { at: [-1.75, 2.2, 0], tag: "standing, the closed curtains behind" },
  },
  creature_spots: {},
  cameras: {},
  // what stands in the way: the walls (the room is open toward -Y), the table top (people's legs go under it)
  obstacles: [
    { n: "back_wall", box: [-5.2, 5.2, 3.3, 3.6, 0, 7.5] },
    { n: "left_wall", box: [-5.6, -5.2, -5.5, 3.6, 0, 7.5] },
    { n: "right_wall", box: [5.2, 5.6, -5.5, 3.6, 0, 7.5] },
    { n: "table", box: [-1.6, 1.6, -0.95, 0.95, 0.9, 1.1], floor: false, furniture: true },
    // the chair backs (behind each seat, away from the table): a camera never looks through one
    { n: "chair_back_back", box: [-0.6, 0.6, 2.5, 2.7, 0, 2.0], furniture: true },
    { n: "chair_back_left", box: [-3.25, -3.05, -0.6, 0.6, 0, 2.0], furniture: true },
    { n: "chair_back_right", box: [3.05, 3.25, -0.6, 0.6, 0, 2.0], furniture: true },
    { n: "chair_back_front", box: [-0.75, 0.75, -2.8, -2.4, 0, 2.5], furniture: true },
  ],
  deck: { x0: -99, x1: -98, y0: -99, y1: -98 },
  props_at: { curtains: [0, 3.3, 3.6], plate_front: [0, -0.6, 1.15], plate_back: [0, 0.6, 1.15], window: [0, 3.3, 3.6], lamp: [0, 0, 5.4] },
  background: {},
};
export const SEATED_R = 0.7;   // a seated body's half-width at the table edge (the legs go under the table)
void BODY_R; void H;
