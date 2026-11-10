// The simple-style test's shots (page/simple/simple.js spec). 9:16 at 1080x1920; the sheet is its own grid.
// Town layout: road along x (z = 0, 7.5 m wide), north sidewalk z -3.75..-6.75, north house fronts at z -10.5,
// BAKERY x -2..6, SCHOOL x 19..33 (front z -12), characters stand on the north sidewalk (z -5.3) facing +z.
const SW = -5.3;
const trio = (pose = ["wave", "idle", "point"], face = ["happy", "grin", "surprised"]) => [
  { id: "juno", at: [-2.25, SW + 0.2], rot: 0.25, pose: pose[0], face: face[0] },
  { id: "pip", at: [-1.2, SW], rot: 0, pose: pose[1], face: face[1] },
  { id: "bram", at: [-0.15, SW + 0.25], rot: -0.3, pose: pose[2], face: face[2] },
];
const wide = { cam: [38, 17, 0.5], look: [-20, 0, -1.5], fov: 55, shadowAt: [12, 0, -2], shadowSize: 60 };
const medium = { cam: [-1.1, 1.45, 0.6], look: [-1.2, 1.2, SW], fov: 50, shadowSize: 22 };
const close = (id, x, z, rot, face, pose = "idle", light = "day") => ({ chars: [{ id, at: [x, z], rot, pose, face }], cam: [x + 0.45, 1.85, z + 3.0], look: [x, 1.66, z], fov: 36, dof: { focus: 3.0, aperture: 0.012 }, shadowSize: 14, light });

export const SHOTS = [
  { label: "day_wide_town", light: "day", chars: trio(["walk", "wave", "idle"]), ...wide },
  { label: "day_medium_trio", light: "day", chars: trio(), ...medium },
  { label: "day_close_pip_happy", ...close("pip", -1.2, SW, 0, "happy") },
  { label: "day_close_juno_surprised", ...close("juno", -6.0, SW, 0.15, "surprised", "scared") },
  { label: "day_close_bram_angry", ...close("bram", 12.0, SW, -0.2, "angry", "point") },
  { label: "day_walk_juno_bakery", light: "day", chars: [{ id: "juno", at: [-0.5, SW], rot: Math.PI / 2, pose: "walk", face: "happy" }], cam: [3.2, 1.6, 0.8], look: [-0.2, 1.7, -6.5], fov: 50, shadowSize: 22 },
  { label: "day_school_cheer", light: "day", chars: [{ id: "pip", at: [24.6, SW], rot: 0.1, pose: "cheer", face: "laugh" }, { id: "juno", at: [26.0, SW - 0.3], rot: 0, pose: "cheer", face: "grin" }, { id: "bram", at: [27.4, SW], rot: -0.15, pose: "wave", face: "happy" }], cam: [26, 1.9, 7.5], look: [26, 3.6, -12], fov: 52, shadowSize: 30 },
  { label: "night_wide_town", light: "night", chars: [], ...wide },
  { label: "night_medium_trio_scared", light: "night", chars: trio(["scared", "scared", "point"], ["scared", "shocked", "worried"]), ...medium },
  { label: "night_close_pip_scared", ...close("pip", -1.2, SW, 0, "scared", "scared", "night") },
  { label: "sheet_pip_expressions", sheet: true, light: "day", char: { id: "pip", at: [-1.2, SW], rot: 0, pose: "idle" }, cam: [-1.05, 1.8, -3.55], look: [-1.2, 1.74, SW], fov: 30, dof: { focus: 1.76 }, shadowSize: 10, cols: 4, cell: 400 },
  // the same with the mood LUT (lib/data/colourGrade.json; fitted on the old look: provisional)
  { label: "LUT_day_wide_town", light: "day", lut: "day", chars: trio(["walk", "wave", "idle"]), ...wide },
  { label: "LUT_day_medium_trio", light: "day", lut: "day", chars: trio(), ...medium },
  { label: "LUT_day_close_pip_happy", lut: "day", ...close("pip", -1.2, SW, 0, "happy") },
  { label: "LUT_night_wide_town", light: "night", lut: "night", chars: [], ...wide },
];
