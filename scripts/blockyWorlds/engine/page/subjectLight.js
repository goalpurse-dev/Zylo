// Blocky Worlds LOOK-FIX 2026-11-08 (owner: "the night plaque shot is dark and unreadable"): at night the subject of the
// shot (a scene object, an insert, the focus person) gets its own light, as a film set would: a soft warm key from the
// camera side, a little above (a lantern / the moon on the subject), and a cool moonlight rim from behind so its outline
// reads against the dark. Then the free pixel check (like the flat-frame guard, page/engine.js): the subject's screen box
// is sampled; when it is still too dark or too flat the key is raised (continuously, from the measured value, so a frame
// depends only on (timeline, t)) and the frame is drawn again, once.
//   const L = makeSubjectLight(THREE, scene)
//   L.aim(camera, box | null, mode)       -> true when lit (mode night / dusk and a subject); call before rendering
//   L.measure(srcCanvas, camera, box, ctx) -> { lum, contrast } of the subject's screen box (ctx: a small 2D canvas)
//   L.boost(k)                             multiply the key + rim (k from boostFor)
//   boostFor({ lum, contrast }) -> 1 (fine) or the factor to raise the key by (pure, tested)
//   screenRect(corners01) -> { x0, y0, x1, y1 } clamped to 0..1 (pure, tested)

export const NIGHT_MIN_LUM = 62;       // 0-255: the subject's mean luminance must reach this at night
export const NIGHT_MIN_CONTRAST = 14;  // its luminance spread (std dev): carved lines / windows / a face must read
const BASE = { night: 1, dusk: 0.45 };

/** how much to raise the key for a measured subject (1 = fine) */
export function boostFor(m, { minLum = NIGHT_MIN_LUM, minContrast = NIGHT_MIN_CONTRAST } = {}) {
  if (!m || !Number.isFinite(m.lum)) return 1;
  const kL = m.lum < minLum ? minLum / Math.max(6, m.lum) : 1;
  const kC = m.contrast < minContrast ? Math.min(2, minContrast / Math.max(3, m.contrast)) : 1;
  return Math.min(5, Math.max(kL, kC));
}

/** NDC corners (x, y in -1..1) -> a 0..1 rect (top-left origin), clamped; null when off screen */
export function screenRect(ndc) {
  if (!ndc?.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ndc) { const u = (x + 1) / 2, v = (1 - y) / 2; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(1, x1); y1 = Math.min(1, y1);
  return x1 - x0 < 0.01 || y1 - y0 < 0.01 ? null : { x0, y0, x1, y1 };
}

export function makeSubjectLight(THREE, scene) {
  const key = new THREE.SpotLight("#ffe0b0", 0, 0, 0.5, 0.65, 1.2);
  const rim = new THREE.SpotLight("#a8c0ff", 0, 0, 0.6, 0.6, 1.2);
  key.castShadow = false; rim.castShadow = false;
  key.name = "subjectKey"; rim.name = "subjectRim";
  scene.add(key, key.target, rim, rim.target);
  let k0 = 0, r0 = 0;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), sz = new THREE.Vector3(), right = new THREE.Vector3();
  return {
    key, rim,
    aim(camera, box, mode) {
      const base = BASE[mode] ?? 0;
      if (!box || box.isEmpty() || !base) { key.intensity = rim.intensity = 0; key.visible = rim.visible = false; return false; }
      box.getCenter(c); box.getSize(sz);
      const R = Math.max(0.3, Math.max(sz.x, sz.y, sz.z) / 2);
      camera.updateMatrixWorld();
      const cam = camera.getWorldPosition(v.set(0, 0, 0)).clone();
      right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      // key: between the camera and the subject, to one side and above (a lantern held up beside the lens)
      const toS = c.clone().sub(cam), d = Math.max(1, toS.length());
      key.position.copy(cam).addScaledVector(toS, 0.35).addScaledVector(right, Math.max(0.6, R * 0.8)).add(new THREE.Vector3(0, Math.max(0.8, R), 0));
      key.target.position.copy(c);
      const kd = key.position.distanceTo(c);
      key.angle = Math.min(1.0, Math.atan2(R * 1.5, kd) + 0.08);
      // physical lights: a low start (a lantern glow, calibrated on the night plaque stills); the pixel check raises it
      key.intensity = k0 = base * 1.1 * Math.pow(Math.max(1, kd), 1.2) * Math.max(0.6, Math.min(3, R));
      // rim: behind the subject, high, on the other side: a cool edge
      rim.position.copy(c).addScaledVector(toS.clone().setY(0).normalize(), Math.max(1.5, R * 1.6)).addScaledVector(right, -Math.max(0.8, R)).add(new THREE.Vector3(0, Math.max(1.2, R * 1.4), 0));
      rim.target.position.copy(c);
      const rd = rim.position.distanceTo(c);
      rim.angle = Math.min(1.0, Math.atan2(R * 1.5, rd) + 0.1);
      rim.intensity = r0 = base * 1.0 * Math.pow(Math.max(1, rd), 1.2) * Math.max(0.6, Math.min(3, R));
      key.visible = rim.visible = true;
      key.target.updateMatrixWorld(); rim.target.updateMatrixWorld();
      void d;
      return true;
    },
    boost(k) { key.intensity = k0 * k; rim.intensity = r0 * Math.min(2, k); },
    off() { key.intensity = rim.intensity = 0; key.visible = rim.visible = false; },
    measure(src, camera, box, ctx) {
      if (!box || box.isEmpty()) return null;
      const pts = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) { const p = new THREE.Vector3(x, y, z).project(camera); if (p.z < 1) pts.push([p.x, p.y]); }
      const r = screenRect(pts); if (!r) return null;
      const W = src.width, H = src.height, n = ctx.canvas.width;
      ctx.clearRect(0, 0, n, n);
      // the middle 70 % of the box (its edges are mostly the background)
      const ix = (r.x1 - r.x0) * 0.15, iy = (r.y1 - r.y0) * 0.15;
      ctx.drawImage(src, (r.x0 + ix) * W, (r.y0 + iy) * H, Math.max(1, (r.x1 - r.x0 - 2 * ix) * W), Math.max(1, (r.y1 - r.y0 - 2 * iy) * H), 0, 0, n, n);
      const px = ctx.getImageData(0, 0, n, n).data;
      let s = 0, s2 = 0, k = 0;
      for (let i = 0; i < px.length; i += 4) { const L = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; s += L; s2 += L * L; k++; }
      const lum = s / k, contrast = Math.sqrt(Math.max(0, s2 / k - lum * lum));
      return { lum: +lum.toFixed(1), contrast: +contrast.toFixed(1) };
    },
  };
}
