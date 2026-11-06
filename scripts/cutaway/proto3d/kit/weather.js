// M2 kit: weather.
//  rain: streaks falling through a box at constant speed (slightly slanted), looping; intensity fades them.
//  stream: water pouring off an edge (a roof eave, a pipe outlet): a dense, narrow curtain of streaks.
//  stormLight: dims the sun, sky and environment for an overcast storm and brings them back.
//  rain {style: "ash"}: grey ash and dust flakes drifting down slowly, swaying and tumbling (fallout, ash, soot): thin
//  fast streaks read as rain, and the real bunker run's "fallout dust" looked like a rain shower (owner, 2026-11-04)
export function rain(ctx, { x0, x1, z0, z1, yTop = 14, yBot = 0, count = 900, speed = 24, slant = 0.12, len = 0.75, width = 0.03, color = "#dcebff", opacity = 0.5, style = "rain" }) {
  const { THREE, scene, rnd } = ctx;
  if (style === "ash") return ash(ctx, { x0, x1, z0, z1, yTop, yBot, count: Math.min(count, 520) });
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

function ash(ctx, { x0, x1, z0, z1, yTop, yBot, count }) {
  const { THREE, scene, rnd } = ctx;
  // flat grey flakes in a few shades (lit, so they read as solid specks, not light streaks)
  const geo = new THREE.BoxGeometry(0.16, 0.035, 0.12), mats = ["#6f7173", "#8e9092", "#4f5153"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, transparent: true, opacity: 0.95, depthWrite: true }));
  const per = Math.ceil(count / mats.length), ims = mats.map((m) => { const im = new THREE.InstancedMesh(geo, m, per); im.frustumCulled = false; im.castShadow = false; scene.add(im); return im; });
  const H = yTop - yBot;
  const D = Array.from({ length: per * mats.length }, () => ({ x: x0 + rnd() * (x1 - x0), z: z0 + rnd() * (z1 - z0), ph: rnd(), v: 1.6 + rnd() * 1.2, sw: 0.3 + rnd() * 0.5, f: 0.6 + rnd() * 0.9, s: 0.6 + rnd() * 0.9, r: rnd() * 6 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    update(t, on) {
      const shown = on > 0.01;
      ims.forEach((im, k) => { im.visible = shown; im.material.opacity = 0.95 * Math.min(1, on); });
      if (!shown) return;
      D.forEach((d, i) => {
        const im = ims[i % mats.length], j = Math.floor(i / mats.length), f = ((t * d.v) / H + d.ph) % 1, y = yTop - f * H;
        v.set(d.x + Math.sin(t * d.f + d.r) * d.sw, y, d.z + Math.cos(t * d.f * 0.8 + d.r) * d.sw * 0.6);
        q.setFromEuler(e.set(t * d.f + d.r, d.r, t * d.f * 0.7));
        im.setMatrixAt(j, m4.compose(v, q, s.setScalar(i < D.length * on ? d.s : 0)));
      });
      ims.forEach((im) => { im.instanceMatrix.needsUpdate = true; });
    },
  };
}

export function stream(ctx, { x0, x1, z, yTop, yBot, count = 70, speed = 9, color = "#cfe5ff", opacity = 0.7 }) {
  return rain(ctx, { x0, x1, z0: z - 0.06, z1: z + 0.06, yTop, yBot, count, speed, slant: 0, len: 0.9, width: 0.05, color, opacity });
}

export function stormLight(ctx, { sun, hemi, scene }) {
  const base = { sun: sun.intensity, hemi: hemi?.intensity ?? 0, env: ctx.envBase ?? scene.environmentIntensity ?? 1, bg: scene.backgroundIntensity ?? 1 };
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
