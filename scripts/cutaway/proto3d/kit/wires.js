// Kit: power lines (scene language v2, phase 2: the power lines test case). A "wires" part hangs cables between points
// (a pylon's insulators, a pole's crossarm, a house's meter), each span sagging like a real one, several wires side by
// side; "live" sends bright current pulses along them, "off" leaves them dark, "snap" drops one span. Channels: show
// (the wires are strung), live, snap. Pure functions first (Node), the builder last.
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** the settings: points [[x, y, z], ...] (2+), sag (metres at mid-span), count (wires side by side), spacing (along z) */
export function wiresSpec(p = {}) {
  const pts = (Array.isArray(p.points) && p.points.length >= 2 ? p.points : [[-8, 8, -3], [8, 8, -3]]).map((q) => [num(q[0], 0), num(q[1], 8), num(q[2], -3)]);
  return { pts, sag: num(p.sag, 0.9), count: Math.max(1, Math.min(4, Math.round(num(p.count, 2)))), spacing: num(p.spacing, 0.6), color: p.color ?? "#1d2024", glow: p.glow ?? "#ffe36a" };
}
/** a point on span i at u (0..1): a parabola sagging below the straight line */
export function spanPoint(s, i, u, off = 0) {
  const a = s.pts[i], b = s.pts[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - s.sag * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u + off];
}
export function wiresBox(p = {}) {
  const s = wiresSpec(p), xs = s.pts.map((q) => q[0]), ys = s.pts.map((q) => q[1]), zs = s.pts.map((q) => q[2]);
  return { min: [Math.min(...xs), Math.min(...ys) - s.sag - 0.3, Math.min(...zs) - s.spacing * s.count], max: [Math.max(...xs), Math.max(...ys) + 0.3, Math.max(...zs) + s.spacing * s.count] };
}

// ---------------- the page ----------------
export function buildWires(ctx, p = {}) {
  const { THREE } = ctx, s = wiresSpec(p), group = new THREE.Group(); ctx.scene.add(group);
  const wireM = ctx.std({ color: new THREE.Color(s.color), roughness: 0.4, metalness: 0.6 });
  const pulseM = new THREE.MeshBasicMaterial({ color: new THREE.Color(s.glow), toneMapped: false });
  const spans = [], pulses = [];
  for (let i = 0; i < s.pts.length - 1; i++) for (let w = 0; w < s.count; w++) {
    const off = (w - (s.count - 1) / 2) * s.spacing;
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, k) => new THREE.Vector3(...spanPoint(s, i, k / 16, off))));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.035, 6), wireM); m.castShadow = true; group.add(m);
    spans.push({ m, i, curve });
    for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pulseM); d.visible = false; group.add(d); pulses.push({ d, curve, ph: k / 4 + w * 0.13, i }); }
  }
  const n = s.pts.length - 1;
  return {
    group,
    update(t, ch = {}) {
      const shown = ch.show == null ? 1 : Math.max(0, Math.min(1, ch.show)), live = Math.max(0, Math.min(1, ch.live ?? 0)), snap = Math.max(0, Math.min(1, ch.snap ?? 0));
      for (const sp of spans) {
        // strung span by span; a snapped first span drops to the ground
        sp.m.visible = shown * n > sp.i + 0.05;
        sp.m.position.y = sp.i === 0 ? -snap * 6 : 0; sp.m.rotation.z = sp.i === 0 ? snap * 0.15 : 0;
      }
      for (const q of pulses) { const on = live > 0.05 && shown * n > q.i + 0.5 && !(q.i === 0 && snap > 0.1); q.d.visible = on; if (on) q.d.position.copy(q.curve.getPointAt((t * 0.55 + q.ph) % 1)); }
    },
  };
}
