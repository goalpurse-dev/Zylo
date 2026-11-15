// ACTION LIBRARY (owner 2026-11-15): reusable, tested "action moments" (actions.py: the rig, the animation, the camera
// spots), cataloged here so the director can pick one. The geometry below MIRRORS actions.py (ZX_CATCH / ZX_KNEEL and
// the spot formulas): actions.test.mjs checks both agree and that every spot is a clear, open-street view.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ACTIONS_PY = path.join(HERE, "actions.py");
export const actionsSource = () => fs.readFileSync(ACTIONS_PY, "utf8");

export const ZX_CATCH = Object.freeze({ pivot_y: 171.0, edge_z: 24.0, front: -0.5, size: 7.0, phi: 40.0 });
export const ZX_KNEEL = Object.freeze({ hip: 0.5, shoulder: 1.55, arm: 1.55, hand: 0.5 });
const rad = (d) => (d * Math.PI) / 180;
export function kneelHand(size, phi) {
  const a = rad(phi);
  return { fwd: ZX_KNEEL.arm * Math.sin(a) * size, top: (ZX_KNEEL.hip + ZX_KNEEL.shoulder - ZX_KNEEL.arm * Math.cos(a) + ZX_KNEEL.hand) * size };
}
export function catchAngle(handTop, edgeZ = ZX_CATCH.edge_z, front = ZX_CATCH.front) {
  let lo = 0, hi = 90;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2, a = rad(mid); if (front * Math.sin(a) + edgeZ * Math.cos(a) > handTop) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function catchPlan(size = ZX_CATCH.size, phi = ZX_CATCH.phi, x = 0) {
  const h = kneelHand(size, phi), theta = catchAngle(h.top), a = rad(theta);
  const edgeY = ZX_CATCH.pivot_y + ZX_CATCH.front * Math.cos(a) - ZX_CATCH.edge_z * Math.sin(a);
  return { size, phi, theta, handTop: h.top, edgeY, root: [x, edgeY - h.fwd, 0] };
}
/** the catch's camera spots (mirror of zx_catch_spot): { spot: [loc, target] } */
export function catchSpots(plan = catchPlan()) {
  const [rx, ry] = plan.root, s = plan.size;
  return {
    street: [[6, ry - 36, 3], [0, ry + 18, 14]],
    front_high: [[12, ZX_CATCH.pivot_y + 25, 52], [rx, ry + 2, 3.7 * s]],
    front_left_high: [[-14, ZX_CATCH.pivot_y + 25, 48], [rx, ry + 2, 3.7 * s]],
    face_kneel: [[rx + 1, ry + 4.4 * s, (ZX_KNEEL.hip + 2.35) * s + 2 * s], [rx, ry, (ZX_KNEEL.hip + 2.35) * s + 0.15 * s]],
    side: [[11, ry - 34, 10], [-2, ry + 16, 18]],
    door: [[10, ZX_CATCH.pivot_y - 6, 4], [2, ry + 5, 1.3 * s]],
  };
}

// THE CATALOG the director reads (the plan brief / the fix rounds): what each moment is, its phases, its spots, the call
export const ACTIONS = Object.freeze([
  Object.freeze({
    id: "catch",
    label: "Giant catches a toppling building",
    about: "a building tips and falls toward the street (a crowd running below); a giant kneels in front of it, reaches out and catches its top edge just above the people; his straining face; he sets it back upright, gently; people run out cheering, someone hugs his ankle",
    places: ["downtown_landmark"],
    needs: "a building parented to ONE pivot empty at its front-bottom edge (e.g. pivot (0, 171, 0) for a bank at y 178) whose +X rotation tips it toward the street; the landmark dress set to none",
    phases: ["tip", "fall", "catch", "strain", "set", "cheer"],
    spots: ["street", "front_high", "front_left_high", "face_kneel", "side", "door"],
    usage: [
      "plan = zx_catch_plan(7.0)                      # the giant's size; plan['theta'] = the catch angle, plan['root'] = where he kneels",
      "tip:    zx_topple(piv, t0, t1, 0, 35, 'tip'); zx_crowd('cr', 8, t0, t1, 168, 120); zx_catch_spot(cam, 'street', plan, t0, t1)   # the hero is still kid-size",
      "fall:   zx_topple(piv, t0, t1, 35, plan['theta'], 'fall'); zx_catch_pose(M, t0, plan, reach=True); zx_catch_pose(M, t1, plan); zx_crowd(...); zx_catch_spot(cam, 'front_high', plan, t0, t1)",
      "catch:  zx_topple(piv, t0, t1, plan['theta'], plan['theta'], 'set'); zx_catch_pose(M, t0, plan); zx_catch_spot(cam, 'side', plan, t0, t1)   # the building held over the street, over his shoulder",
      "strain: the same hold; M.face(t0, eyes='squint', mouth='grimace'); zx_catch_spot(cam, 'face_kneel', plan, t0, t1)   # (zw_giant_cam assumes a standing giant)",
      "set:    zx_topple(piv, t0, t1, plan['theta'], 0, 'set'); zx_catch_pose(M, t0, plan); M.pose(t1, armL=(150, 10), armR=(150, 10)); zx_catch_spot(cam, 'front_left_high', plan, t0, t1)   # or 'side'",
      "cheer:  zx_stand(M, t0, plan); zx_crowd('out', 10, t0, t1, 168, 150, 'joy'); zx_hug(mom, t0, t1, (0.5 * plan['size'], plan['root'][1] + 0.5 * plan['size']), (0, 168)); zx_catch_spot(cam, 'door', plan, t0, t1)",
      "zx_crowd runs the crowd ON THE SIDEWALKS (Milo lesson: never down the street); avoid=(x, y, r) parts it around the hero; street=True only when the line itself puts the crowd in the street",
      "every zx_ call takes the shot's t0 / t1; grow the giant with zw_grow(M, t0, t0 + 0.05, size, size) right after creating him",
    ],
  }),
]);

/** the director's docs for the action library (pasted into the instructions in library mode) */
export function actionDocs() {
  return ["THE ACTION LIBRARY (actions.py is already in the file after the world library): TESTED action moments; when a line shows one of these moments, use it (its phases, one per shot, and its camera spots) instead of staging it yourself.",
    ...ACTIONS.flatMap((a) => [`- ${a.id}: ${a.label}: ${a.about}. Places: ${a.places.join(", ")}. Needs: ${a.needs}. Phases: ${a.phases.join(" -> ")}. Spots: ${a.spots.join(", ")}.`, ...a.usage.map((u) => `    ${u}`)])].join("\n");
}

// THE NEXT MOMENTS to build the same way (owner 2026-11-15: listed, not built): effort = free code + the stills that
// test the spots (preview renders at ~$0.004 a shot)
export const NEXT_ACTIONS = Object.freeze([
  { id: "fall", what: "a character or object falls from a height and lands (a stumble, a dive, a drop from a roof): the drop, the impact squash, the dust, a low reaction spot", effortH: 3, stillsUsd: 0.05 },
  { id: "crash", what: "a vehicle hits something (truck into steps / a wall / a hydrant): the approach, the impact frame with a shake and debris, the aftermath wide", effortH: 4, stillsUsd: 0.06 },
  { id: "chase", what: "one runs, another follows down a street: tracking spots that keep both in frame, cut-ins of feet / faces, the near-miss", effortH: 5, stillsUsd: 0.08 },
  { id: "grow_shrink", what: "a character grows or shrinks on a pop: the size ladder, the cameras that rescale each step, street props for scale", effortH: 3, stillsUsd: 0.05 },
  { id: "explode", what: "something bursts (a cake, a balloon, a machine): the build-up shake, the flash and the pieces, the covered-in-it reaction", effortH: 4, stillsUsd: 0.06 },
  { id: "flood_fill", what: "a room / street fills up (water, foam, balls): the rising level, the floating props, the head-above-the-surface spot", effortH: 5, stillsUsd: 0.08 },
  { id: "fly_lift", what: "a character or a house lifts off (balloons, a jet pack): the take-off, the rising aerial with the town below, the landing", effortH: 4, stillsUsd: 0.06 },
  { id: "crowd_cheer", what: "a crowd pours out and cheers / lifts the hero: the run-out, the jumping wave, the hero carried, a confetti spot", effortH: 2, stillsUsd: 0.04 },
]);
