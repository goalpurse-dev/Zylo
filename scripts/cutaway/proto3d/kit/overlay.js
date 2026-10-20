// M2 kit: the explainer layer, drawn over the scene (no tone mapping, no depth write), as on the landfill.
//  arrows: block arrows that travel along their direction and pulse (about one cycle per second);
//  outline: a glowing tube traced around a named part on its "This is a…" line.
import { clamp01 } from "./verbs.js";

let arrowGeo = null;
function arrowGeometry(THREE) {
  if (arrowGeo) return arrowGeo;
  const s = new THREE.Shape(); s.moveTo(-0.16, 0.5); s.lineTo(0.16, 0.5); s.lineTo(0.16, 0.0); s.lineTo(0.38, 0.0); s.lineTo(0, -0.5); s.lineTo(-0.38, 0.0); s.lineTo(-0.16, 0.0); s.lineTo(-0.16, 0.5);
  arrowGeo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  return arrowGeo;
}

/** list: [{ at: [x, y, z], dir: [dx, dy], travel = 1.2, phase = 0 }] — arrows lie in the plane facing +z;
 *  flat: true lays them on a horizontal surface (dir is then [dx, dz]), e.g. on water, pointing at a wall */
export function arrows(ctx, list, { color = "#ffffff", scale = 1.25, speed = 0.9, flat = false } = {}) {
  const { THREE, scene } = ctx;
  const geo = arrowGeometry(THREE);
  const items = list.map((a, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    m.scale.set(scale * (a.scale ?? 1), scale * (a.scale ?? 1), 1);
    const [dx, dy] = a.dir; const n = Math.hypot(dx, dy);
    if (flat) { m.rotation.order = "XYZ"; m.rotation.set(-Math.PI / 2, 0, Math.atan2(-dy, dx) + Math.PI / 2); } // in the xz plane: local +y maps to world -z
    else m.rotation.z = Math.atan2(dy, dx) + Math.PI / 2; // the shape points down (-y)
    m.renderOrder = 5; scene.add(m);
    return { m, a, d: [dx / n, dy / n], phase: a.phase ?? (i % 2) * 0.5 };
  });
  return {
    update(t, on) {
      for (const it of items) {
        const ph = (t * speed + it.phase) % 1, k = (it.a.travel ?? 1.2) * ph;
        if (flat) it.m.position.set(it.a.at[0] + it.d[0] * k, it.a.at[1], it.a.at[2] + it.d[1] * k);
        else it.m.position.set(it.a.at[0] + it.d[0] * k, it.a.at[1] + it.d[1] * k, it.a.at[2]);
        it.m.material.opacity = clamp01(on) * Math.sin(ph * Math.PI) * 0.95; it.m.visible = on > 0.01;
      }
    },
  };
}

export function outline(ctx, points, { color = "#ffd34d", r = 0.11, closed = false } = {}) {
  const { THREE, scene } = ctx;
  const P = points.map((p) => new THREE.Vector3(...p)); if (closed) P.push(P[0].clone());
  const path = new THREE.CurvePath(); for (let i = 0; i < P.length - 1; i++) path.add(new THREE.LineCurve3(P[i], P[i + 1]));
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, 40 * (P.length - 1), r, 10, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.renderOrder = 6; scene.add(m);
  return { update(t, on) { m.visible = on > 0.01; m.material.opacity = on * (0.85 + 0.15 * Math.sin(t * 9)); } };
}
