// Kit: the street setting's road (the owner's decision of 2026-10-25, from the creator's traffic light: street topics look
// along the road, with lanes, a stop line, a crosswalk and cars). One place for its numbers, shared by the backdrop
// (kit/backdrops.js draws it) and the layout rules (m2/layoutRules.js keeps parts off it and puts the signal on its
// corner). The road runs along z, from the front edge of the ground (z 0) to the cross street behind the shops; the camera
// (home view, from +z) looks along it. Cars driving away from the camera (-z) keep to the right: the +x lane.
export const ROAD_W = 7.4;
export const STREET_BACK = -15; // the shop fronts, further back than the old -8 so the road has room for two queued cars

/** the road's numbers: road { x (centre), w, side (-1: left of the cut, 1: right) }; cut the world's cut */
export function streetRoad({ cut = null, road = {}, back = STREET_BACK } = {}) {
  const w = road.w ?? ROAD_W, side = road.side ?? -1;
  const cx = road.x ?? (cut ? (side > 0 ? cut.x1 + 1.4 + w / 2 : cut.x0 - 1.4 - w / 2) : -6);
  return {
    cx, w, x0: cx - w / 2, x1: cx + w / 2, back, side,
    laneOut: +(cx + w / 4).toFixed(3), laneIn: +(cx - w / 4).toFixed(3), // away from the camera / toward it
    stopZ: +(back + 2.4).toFixed(3), crossZ: [+(back + 0.4).toFixed(3), +(back + 2.0).toFixed(3)],
    curbOut: side > 0 ? cx - w / 2 : cx + w / 2, // the curb on the cut's side (where the signal stands)
  };
}
