// STUDIO MODE: the board world's map in numbers (page/simple/board.js + boardPlaces.js constants, read-only copies), shared
// by the page adapter (studio/page/studioBoard.js) and the free Node pre-check (studio/shotCheck.mjs). Plain JS, no THREE.
// Metres; y up; the street runs along x; the house fronts face +z; the cameras on the street look toward -z.
export const W = Object.freeze({
  HZ: -7, HX0: -45, HDX: 15, HW: 9, FL: 3.2,                   // house fronts at z = HZ, x = HX0 + i * HDX, 9 m wide, 2 floors
  WIN: [[-2.4, 0.9], [2.4, 0.9], [-2.4, 4.1], [2.4, 4.1]],      // window [x offset, sill y] (0, 1 ground floor; 2, 3 upstairs)
  WW: 1.6, WH: 1.7,
  ROOMZ: 110, RDX: 22, RX0: -60,                                  // room k at (RX0 + k * RDX, 0, ROOMZ)
  CURB_Z: -3.5, PAVE_Y: 0.18,                                     // the house-side pavement edge (the curb), pavement top
  PLACES: { school: [-320, 0, 0], woods: [320, 0, 0], park: [0, 0, -260], shop: [0, 0, 260] },
  PLACE_MARKS: {                                                  // local marks (shop / park exact; school / woods approximate)
    park: { center: [0, 0, 0], left: [-1.2, 0, 0.4], right: [1.2, 0, 0.4], back: [0.3, 0, -3], far: [0, 0, -16], door: [-2.6, 0, 2] },
    shop: { center: [0.2, 0, 0.2], left: [-1.2, 0, -0.6], right: [1.4, 0, 0.4], back: [-1.2, 0, -2.3], far: [0, 0, -3], door: [3.4, 0, 2.6] },
    school: { center: [0, 0, 0], left: [-1.5, 0, 0], right: [1.5, 0, 0], back: [0, 0, -3], far: [0, 0, -5], door: [3, 0, 2] },
    woods: { center: [0, 0, 0], left: [-1.5, 0, 0], right: [1.5, 0, 0], back: [0, 0, -4], far: [0, 0, -12], door: [0, 0, 4] },
  },
  ROOM_MARKS: { window: [-1.2, -2.2], center: [0.4, -0.2], door: [-2.6, 1.6], painting: [-2.55, -0.55], bed: [0.6, -0.9] },
});

/** the houses' order: the owners sorted by their home index (the board builds house i for the i-th owner) */
export const ownersOf = (homes) => Object.entries(homes ?? {}).sort((a, b) => a[1] - b[1]).map(([o]) => o);

/** a house's numbers in world space: { x, z, door, front, win: [[x,y,z] x4], curb } (the window centres) */
export function houseInfo(homes, owner) {
  const i = ownersOf(homes).indexOf(owner);
  if (i < 0) return null;
  const x = W.HX0 + i * W.HDX, z = W.HZ;
  return { i, x, z, door: [x, 0, z + 0.4], front: [x, 3.2, z], curb: [x, W.PAVE_Y, W.CURB_Z], win: W.WIN.map(([dx, y]) => [x + dx, y + W.WH / 2, z]) };
}
/** a point in an owner's room (local: x -3.5..3.5 across, z -3 (the window wall) .. 3, y 0 floor .. 3.2 ceiling) */
export function roomPoint(homes, owner, lx = 0, ly = 0, lz = 0) {
  const k = ownersOf(homes).indexOf(owner);
  if (k < 0) return null;
  return [W.RX0 + k * W.RDX + lx, ly, W.ROOMZ + lz];
}
/** a place's mark in world space (school, woods, park, shop) */
export function placePoint(name, mark = "center") {
  const o = W.PLACES[name]; if (!o) return null;
  const m = W.PLACE_MARKS[name]?.[mark] ?? W.PLACE_MARKS[name]?.center ?? [0, 0, 0];
  return [o[0] + m[0], o[1] + m[1], o[2] + m[2]];
}
/** a street slot n (0..9): on the road side of the curb, left to right */
export const streetPoint = (n = 0) => [-44 + Number(n) * 9, W.PAVE_Y, 1.6];
