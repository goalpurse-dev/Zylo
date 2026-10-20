// M2 kit: weather.
//  rain: streaks falling through a box at constant speed (slightly slanted), looping; intensity fades them.
//  stream: water pouring off an edge (a roof eave, a pipe outlet): a dense, narrow curtain of streaks.
//  stormLight: dims the sun, sky and environment for an overcast storm and brings them back.
export function rain(ctx, { x0, x1, z0, z1, yTop = 14, yBot = 0, count = 900, speed = 24, slant = 0.12, len = 0.75, width = 0.03, color = "#dcebff", opacity = 0.5 }) {
  const { THREE, scene, rnd } = ctx;
  const geo = new THREE.BoxGeometry(width, len, width);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
  const im = new THREE.InstancedMesh(geo, mat, count); im.renderOrder = 3; im.frustumCulled = false; scene.add(im);
  const H = yTop - yBot;
  const D = Array.from({ length: count }, () => ({ x: x0 + rnd() * (x1 - x0), z: z0 + rnd() * (z1 - z0), ph: rnd(), v: speed * (0.85 + rnd() * 0.3) }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -slant), v = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    update(t, on) {
      mat.opacity = opacity * Math.min(1, on); im.visible = on > 0.01;
      if (!im.visible) return;
      D.forEach((d, i) => { const f = ((t * d.v) / H + d.ph) % 1, y = yTop - f * H; v.set(d.x + slant * (yTop - y) * 0.5, y, d.z); im.setMatrixAt(i, m4.compose(v, q, s.setScalar(i < count * on ? 1 : 0))); });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

export function stream(ctx, { x0, x1, z, yTop, yBot, count = 70, speed = 9, color = "#cfe5ff", opacity = 0.7 }) {
  return rain(ctx, { x0, x1, z0: z - 0.06, z1: z + 0.06, yTop, yBot, count, speed, slant: 0, len: 0.9, width: 0.05, color, opacity });
}

export function stormLight(ctx, { sun, hemi, scene }) {
  const base = { sun: sun.intensity, hemi: hemi?.intensity ?? 0, env: scene.environmentIntensity ?? 1, bg: scene.backgroundIntensity ?? 1 };
  return {
    /** k = 0 clear .. 1 full storm */
    set(k) {
      sun.intensity = base.sun * (1 - 0.72 * k);
      if (hemi) hemi.intensity = base.hemi * (1 - 0.3 * k);
      scene.environmentIntensity = base.env * (1 - 0.42 * k);
      scene.backgroundIntensity = base.bg * (1 - 0.5 * k);
    },
  };
}
