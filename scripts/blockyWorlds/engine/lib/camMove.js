// Blocky Worlds CAMERA MOVES on every shot (VISUAL-FIX 2026-11-08, owner's review of step-2 #1: "Camera is static in
// almost every shot. The references move in ~91% of shots (mostly push-ins). Every shot needs a camera move from the
// recipe."). Before this, a recipe slot's cam.move reached the shot only when it was one of the capability moves
// (orbit / tilt_up / flyover / fpv / top_down on lib/caps.js) — push_in, pull_out, track, pan (most of the recipe
// slots) were dropped in lib/recipes/apply.js engineCamera, and the page's own 3-6 % nudge reads as a still frame.
//
// shot.camMove = { type: CAM_MOVES, speed: slow|medium|fast } rides on top of ANY framing (normal, EPIC): the page
// calls applyCamMove after the camera is framed for the frame. A caps `move` (orbit, flyover...) already moves the
// camera and wins (camMove is not set next to it). Browser-pure (no imports): page/engine.js and the planner share it.
//   camMoveOf(slotMove, speed)          -> { type, speed } | null  (a recipe slot's move -> the shot's camMove)
//   applyCamMove(camera, cm, t, dur, seed)   mutates the framed camera (fov zoom / small pan / tilt), eased
//   movesReport(shots)                  -> { moving, total, pct, byType }
export const CAM_MOVES = Object.freeze(["static", "push_in", "pull_out", "track", "pan", "tilt_up"]);
export const CAM_SPEEDS = Object.freeze(["slow", "medium", "fast"]);

/** the recipe slot's move -> the camMove the page can do on any framing (a caps-only move falls back to a push in) */
export function camMoveOf(move, speed = "medium") {
  const sp = CAM_SPEEDS.includes(speed) ? speed : "medium";
  if (move === "static") return { type: "static", speed: sp };
  if (CAM_MOVES.includes(move)) return { type: move, speed: sp };
  // orbit / flyover / fpv / top_down / low_hero / shake on a framing that can't carry the caps move: the reference's
  // most common move (a push in) at the slot's speed
  return { type: "push_in", speed: sp };
}

const ease = (p) => p * p * (3 - 2 * p);
const DEG = Math.PI / 180;
const ZOOM = { slow: 0.1, medium: 0.16, fast: 0.24 };   // push in: the frame narrows by this share over the shot
const YAW = { slow: 4, medium: 6, fast: 9 };            // track / pan: degrees swept over the shot
const PITCH = { slow: 4, medium: 6, fast: 8 };          // tilt up: degrees

const hash01 = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x / 4294967296; };

/** zoom the lens so the frame is `f` times narrower (f > 1 = push in) */
function zoom(camera, f) {
  if (!(f > 0) || Math.abs(f - 1) < 1e-6) return;
  camera.fov = (2 * Math.atan(Math.tan((camera.fov * DEG) / 2) / f)) / DEG;
}

/**
 * The shot's move over an already framed camera (call it every frame, after the framing and before the shake).
 * Deterministic in (cm, t, dur, seed). Lens zooms and small rotations only: the camera never moves into a wall.
 */
export function applyCamMove(camera, cm, t = 0, dur = 1, seed = 1) {
  if (!camera || !cm || !cm.type || cm.type === "static") return camera;
  const k = ease(Math.min(1, Math.max(0, t / Math.max(1e-3, dur))));
  const sp = CAM_SPEEDS.includes(cm.speed) ? cm.speed : "medium";
  const dir = hash01(seed * 31 + 5) < 0.5 ? -1 : 1;
  // SHOT GRAMMAR v2 (2026-11-09): a hero insert's fit (0.3-1): the object framing fills the frame edge to edge, so the
  // lens first widens to `fit` of it (the object 40-70 % of the frame, never cut off at the edge), then the move runs
  const fit = Number(cm.fit);
  if (fit >= 0.3 && fit < 1) zoom(camera, fit);
  switch (cm.type) {
    case "push_in": zoom(camera, 1 + ZOOM[sp] * k); break;
    case "pull_out": zoom(camera, 1 + ZOOM[sp] * (1 - k)); break;
    case "track": camera.rotateY(dir * YAW[sp] * DEG * (k - 0.5)); zoom(camera, 1 + 0.05 * k); break;
    case "pan": camera.rotateY(dir * YAW[sp] * 1.3 * DEG * (k - 0.5)); break;
    case "tilt_up": camera.rotateX(PITCH[sp] * DEG * (k - 0.5)); zoom(camera, 1 + 0.06 * k); break;
    default: break;
  }
  camera.updateProjectionMatrix?.();
  camera.updateMatrixWorld?.();
  return camera;
}

/** a shot's move name (caps move first, then camMove), null when the camera holds still */
export function moveName(s) {
  const m = s?.move ? (typeof s.move === "string" ? s.move : s.move.type) : s?.camMove?.type ?? null;
  return m && m !== "static" ? m : null;
}

/** how many real shots (cards left out) move */
export function movesReport(shots = []) {
  const real = shots.filter((s) => s && s.camera !== "insert" && !s.insert);
  const byType = {};
  for (const s of real) { const m = moveName(s) ?? "static"; byType[m] = (byType[m] ?? 0) + 1; }
  const moving = real.filter(moveName).length;
  return { moving, total: real.length, pct: real.length ? Math.round((100 * moving) / real.length) : 0, byType };
}

/** problems of the shots' camMove fields (checkTimeline) */
export function camMoveProblems(shots = []) {
  const bad = [];
  shots.forEach((s, i) => {
    if (s?.camMove == null) return;
    if (!CAM_MOVES.includes(s.camMove.type)) bad.push(`shot ${i}: unknown camMove "${s.camMove.type}" (${CAM_MOVES.join(", ")})`);
    if (s.camMove.speed != null && !CAM_SPEEDS.includes(s.camMove.speed)) bad.push(`shot ${i}: camMove speed "${s.camMove.speed}"`);
    if (s.camMove.fit != null && !(Number(s.camMove.fit) >= 0.3 && Number(s.camMove.fit) <= 1)) bad.push(`shot ${i}: camMove fit ${s.camMove.fit} (0.3-1)`);
    if (s.move) bad.push(`shot ${i}: both a caps move and a camMove (one move per shot)`);
  });
  return bad;
}
