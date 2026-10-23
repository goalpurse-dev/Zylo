// M2 kit: dig a box cut that opens on the cut face (a pit, a trench, a hole). The ground mesh already has the hole;
// a plug of lawn + soil face sinks while dirt clumps fly in arcs to a mound beside it, which grows as they land.
// refill() shrinks the mound again when the cut is backfilled.
import { span, eOut, eInOut, eBack, clamp01 } from "./verbs.js";

export function digCut(ctx, { x0, x1, z0, z1 = 0, depth, mound, clumps = 150, dirtMat }) {
  const { THREE, scene, grassM, soilM, rnd, mergeVertices } = ctx;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const uvPlanar = (mesh, fx, fy) => { const uv = mesh.geometry.attributes.uv, p = mesh.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, fx(p, i), fy(p, i)); };
  // the floor of the cut
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d, Math.ceil(w * 2), Math.ceil(d * 2)), soilM);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, -depth, cz); floor.receiveShadow = true; scene.add(floor);
  uvPlanar(floor, (p, i) => (p.getX(i) + cx) / 4, (p, i) => (-p.getY(i) + cz) / 4);
  // the plug: lawn top + its front face, sinking
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassM); top.rotation.x = -Math.PI / 2; top.receiveShadow = true; scene.add(top);
  uvPlanar(top, (p, i) => (p.getX(i) + cx) / 4, (p, i) => (-p.getY(i) + cz) / 4);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, 1, Math.ceil(w * 4), 24), soilM); scene.add(face);
  const clumpGeo = (() => { const g = mergeVertices(new THREE.IcosahedronGeometry(0.5, 2)); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 6) * Math.sin(v.y * 5 + 1) + 0.12 * Math.sin(v.z * 8)); p.setXYZ(i, v.x, v.y * 0.8, v.z); } g.computeVertexNormals(); return g; })();
  const NC = clumps, im = new THREE.InstancedMesh(clumpGeo, dirtMat, NC); im.castShadow = true; scene.add(im);
  const M = { x: mound.x, z: mound.z, rx: mound.rx ?? 1.6, rz: mound.rz ?? 1.3, h: mound.h ?? 1.3 };
  const data = Array.from({ length: NC }, () => ({ x: x0 + 0.2 + rnd() * (w - 0.4), z: z0 + 0.2 + rnd() * (d - 0.4), tx: M.x + (rnd() - 0.5) * M.rx * 1.6, tz: M.z + (rnd() - 0.5) * M.rz * 1.6, s: (0.2 + rnd() ** 1.5 * 0.45) * (mound.clumpScale ?? 1), r: rnd() }));
  const moundMesh = new THREE.Mesh((() => { const g = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = 1 + 0.07 * Math.sin(v.x * 7) * Math.cos(v.z * 6); p.setXYZ(i, v.x * f, v.y * f, v.z * f); } g.computeVertexNormals(); return g; })(), dirtMat);
  moundMesh.position.set(M.x, 0, M.z); moundMesh.castShadow = moundMesh.receiveShadow = true; scene.add(moundMesh);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(), AX = new THREE.Vector3(1, 0.4, 0.2).normalize();
  return {
    /** dig between t0 and t1; refill (optional [a, b]) shrinks the mound back to nothing */
    update(t, t0, t1, refill = null) {
      const dd = (tt) => -depth * eInOut(span(tt, t0, t1));
      const y = dd(t);
      top.position.set(cx, y + 0.001, cz); top.visible = y > -depth + 0.01;
      const h = Math.max(0.001, y + depth); face.scale.set(1, h, 1); face.position.set(cx, -depth + h / 2, z1 + 0.001); face.visible = h > 0.01;
      const uv = face.geometry.attributes.uv, p = face.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + cx) / 4, (-depth + (p.getY(i) + 0.5) * h) / 4);
      uv.needsUpdate = true;
      let flown = 0;
      data.forEach((c, i) => {
        const a = t0 + c.r * 0.85 * (t1 - t0), u = span(t, a, a + 0.6);
        if (u <= 0 || u >= 1) { if (u >= 1) flown++; m4.makeScale(0, 0, 0); }
        else { const y0 = dd(a), e = eOut(u); v4.set(c.x + (c.tx - c.x) * e, y0 + (0.6 - y0) * e + Math.sin(u * Math.PI) * (2.0 + depth * 0.5), c.z + (c.tz - c.z) * e); q4.setFromAxisAngle(AX, u * 4 * (c.r - 0.5)); const s = c.s * (1 - u * 0.4); m4.compose(v4, q4, s4.set(s, s, s)); }
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      const back = refill ? 1 - eInOut(span(t, refill[0], refill[1])) : 1;
      const k = (0.03 + eBack(clamp01(flown / NC))) * back;
      moundMesh.scale.set(M.rx * k, M.h * k, M.rz * k); moundMesh.visible = k > 0.005;
    },
  };
}
