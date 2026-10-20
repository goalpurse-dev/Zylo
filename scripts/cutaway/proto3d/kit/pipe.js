// M2 kit: a pipe along any path of points. It grows along its length at constant speed (the account's "grow along
// a path"), optionally perforated (rows of dark holes), with flow dots that travel inside it once it is built.
// Segments running along the cut face sit half in the face (z ≈ -0.06), so the viewer sees them in section.
import { clamp01 } from "./verbs.js";

let holeTex = null;
function holes(THREE, base = "#eef0f2") {
  if (holeTex) return holeTex;
  const c = document.createElement("canvas"); c.width = 128; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, 128, 64); g.fillStyle = "#2a2622";
  for (const u of [0.125, 0.375, 0.625, 0.875]) { g.beginPath(); g.arc(u * 128, 32, 9, 0, Math.PI * 2); g.fill(); }
  holeTex = new THREE.CanvasTexture(c); holeTex.colorSpace = THREE.SRGBColorSpace; holeTex.wrapS = holeTex.wrapT = THREE.RepeatWrapping; holeTex.anisotropy = 8;
  return holeTex;
}

export function pipePath(ctx, points, { r = 0.24, color = "#eef0f2", perforated = false, holeSpacing = 0.55, joints = true } = {}) {
  const { THREE, scene } = ctx;
  const pts = points.map((p) => new THREE.Vector3(...p));
  const segs = []; let length = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1], len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r, r, 1, 28, 1, false); g.translate(0, 0.5, 0);
    const mat = new THREE.MeshPhysicalMaterial({ color: perforated ? "#ffffff" : color, roughness: 0.3, clearcoat: 0.5 });
    if (perforated) { mat.map = holes(THREE, color).clone(); mat.map.needsUpdate = true; mat.map.repeat.set(1, len / holeSpacing); }
    const m = new THREE.Mesh(g, mat); m.position.copy(A); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = true; m.visible = false; scene.add(m);
    const j = joints && i < pts.length - 2 ? new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 20, 12), new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.5 })) : null;
    if (j) { j.position.copy(B); j.visible = false; scene.add(j); }
    segs.push({ m, j, from: length, len, A, B, mat }); length += len;
  }
  const at = (d) => { for (const s of segs) if (d <= s.from + s.len) return s.A.clone().lerp(s.B, clamp01((d - s.from) / s.len)); return pts.at(-1).clone(); };
  let grown = 0;
  return {
    length, at, segs,
    /** grown length, 0..length */
    grow(len) {
      grown = Math.max(0, Math.min(length, len));
      for (const s of segs) {
        const f = clamp01((grown - s.from) / s.len); s.m.visible = f > 0; s.m.scale.set(1, Math.max(0.001, f) * s.len, 1);
        if (s.mat.map) s.mat.map.repeat.set(1, Math.max(0.001, f) * s.len / holeSpacing);
        if (s.j) s.j.visible = f >= 1;
      }
    },
    grown: () => grown,
    /** flow dots travelling along the pipe (only where it is already built); offset pushes them to the visible side */
    flow({ count = 16, size = 0.12, color = "#3f8fe8", offset = [0, 0, 0.22], from = 0 } = {}) {
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.3 }), count); im.renderOrder = 4; scene.add(im);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), off = new THREE.Vector3(...offset);
      return {
        update(t, on, speed = 3.0) {
          const L = length - from;
          for (let i = 0; i < count; i++) {
            const d = from + ((t * speed + (i / count) * L) % L), p = at(d).add(off);
            const k = on > 0.01 && d < grown ? on * size : 0;
            im.setMatrixAt(i, m4.compose(p, q, s.setScalar(k)));
          }
          im.instanceMatrix.needsUpdate = true;
        },
      };
    },
  };
}
