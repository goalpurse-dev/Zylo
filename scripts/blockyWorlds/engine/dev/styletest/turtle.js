// Style test: a giant tortoise built procedurally (no free rigged realistic turtle without a login): sculpted domed
// shell with scutes, growth rings and moss, wrinkled-skin PBR (CC0 Poly Haven textures), dynamic tube legs with a
// planted-foot walk (no foot sliding), neck + head with glossy eyes, orange claws. Faces +z, feet at y = 0.
import * as THREE from "three";
import { tex, rng, groundH } from "./world.js";

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** a tube along points with per-point radii; .set(points, radii) moves it (geometry kept) */
function makeTube(nPts, ring = 28, samples = 22) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(samples * (ring + 1) * 3), uv = new Float32Array(samples * (ring + 1) * 2), idx = [];
  for (let i = 0; i < samples; i++) for (let j = 0; j <= ring; j++) { const k = i * (ring + 1) + j; uv[k * 2] = j / ring * 3; uv[k * 2 + 1] = i / (samples - 1) * 4; if (i < samples - 1 && j < ring) { const a = k, b = k + ring + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); } }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  g.userData.set = (pts, radii) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    let prevN = null;
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1); curve.getPointAt(u, p); curve.getTangentAt(u, T);
      if (!prevN) { N.set(1, 0, 0); if (Math.abs(T.x) > 0.9) N.set(0, 0, 1); } else N.copy(prevN);
      B.crossVectors(T, N).normalize(); N.crossVectors(B, T).normalize(); prevN = N.clone();
      const f = u * (radii.length - 1), i0 = Math.floor(f), i1 = Math.min(radii.length - 1, i0 + 1), r = radii[i0] + (radii[i1] - radii[i0]) * (f - i0);
      for (let j = 0; j <= ring; j++) {
        const a = (j / ring) * Math.PI * 2, wob = 1 + 0.035 * Math.sin(a * 5 + i * 1.3);
        q.copy(p).addScaledVector(N, Math.cos(a) * r * wob).addScaledVector(B, Math.sin(a) * r * wob);
        pos.set([q.x, q.y, q.z], (i * (ring + 1) + j) * 3);
      }
    }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals();
  };
  return g;
}

function skinMaterial() {
  return new THREE.MeshStandardMaterial({
    map: tex("/assets/brown_mud_dry/diff.jpg", { srgb: true, rep: 1 }), normalMap: tex("/assets/brown_mud_dry/nor.jpg", { rep: 1 }),
    normalScale: new THREE.Vector2(2.2, 2.2), roughness: 0.82, color: new THREE.Color("#7c6656"),
  });
}

function shellGeometry(a, b, c) {
  const g = new THREE.SphereGeometry(1, 200, 120);
  const P = g.attributes.position, col = new Float32Array(P.count * 3);
  const seeds = [];
  for (let k = 0; k < 5; k++) { const al = -0.66 + k * 0.33; seeds.push(new THREE.Vector3(0, Math.cos(al), Math.sin(al))); }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const al = -0.58 + k * 0.39; seeds.push(new THREE.Vector3(s * 0.66, Math.cos(al) * 0.74, Math.sin(al) * 0.86).normalize()); }
  for (let k = 0; k < 24; k++) { const f = (k / 24) * Math.PI * 2; seeds.push(new THREE.Vector3(Math.cos(f), 0.16, Math.sin(f)).normalize()); }
  const R = rng(21), base = seeds.map(() => new THREE.Color().setHSL(0.07 + R() * 0.04, 0.35 + R() * 0.2, 0.05 + R() * 0.035, THREE.SRGBColorSpace));
  const d = new THREE.Vector3(), cc = new THREE.Color();
  const dark = new THREE.Color("#120c07"), moss = new THREE.Color("#4f6b22"), lip = new THREE.Color("#4a3a1c");
  for (let i = 0; i < P.count; i++) {
    d.set(P.getX(i), P.getY(i), P.getZ(i)).normalize();
    let d1 = 9, d2 = 9, i1 = 0;
    for (let s = 0; s < seeds.length; s++) { const e = d.distanceTo(seeds[s]); if (e < d1) { d2 = d1; d1 = e; i1 = s; } else if (e < d2) d2 = e; }
    const edge = d2 - d1, groove = 1 - ss(0, 0.04, edge), bulge = ss(0.0, 0.3, edge);
    const up = d.y;
    let rad = 1;
    const lipBand = Math.exp(-(((up - 0.02) / 0.09) ** 2));
    rad *= 1 + 0.07 * lipBand;
    let y = up > 0 ? up * b : up * b * 0.45;
    const disp = up > -0.05 ? 0.42 * bulge - 0.3 * groove + 0.04 * Math.sin(edge * 140) : 0;
    const x = d.x * a * rad, z = d.z * c * rad;
    const nx = d.x / a, ny = (up > 0 ? up / b : up / (b * 0.45)), nz = d.z / c, nl = Math.hypot(nx, ny, nz);
    P.setXYZ(i, x + (nx / nl) * disp, y + (ny / nl) * disp, z + (nz / nl) * disp);
    // colour: per scute base, lighter centres, growth rings, dark grooves, moss on top, a yellow-brown lip
    cc.copy(base[i1]).multiplyScalar(0.75 + 0.55 * bulge + 0.12 * Math.sin(edge * 140));
    const n = Math.sin(d.x * 9 + Math.sin(d.z * 7) * 2) * Math.sin(d.z * 11 + d.y * 5);
    cc.lerp(moss, ss(0.25, 0.75, n) * ss(0.35, 0.75, up) * 0.75);
    cc.lerp(lip, lipBand * 0.5);
    cc.lerp(dark, groove * 0.85);
    if (up < -0.05) cc.set("#3e2f1c");
    col.set([cc.r, cc.g, cc.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

function headGeometry() {
  const g = new THREE.SphereGeometry(1, 96, 64), P = g.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i) * 2.3, y = P.getY(i) * 2.1, z = P.getZ(i) * 3.2;
    const f = Math.max(0, z / 3.2); x *= 1 - 0.28 * f; y *= 1 - 0.22 * f; if (y > 0) y *= 1 + 0.1 * (1 - f);
    if (z > 1.5 && y < 0) y *= 0.85;
    P.setXYZ(i, x, y, z);
    const mouth = Math.exp(-(((y + 0.35 + 0.1 * f) / 0.08) ** 2)) * ss(0.4, 1.8, z), beak = ss(2.2, 3.1, z);
    const c = new THREE.Color(1, 1, 1).lerp(new THREE.Color("#d9b47a"), beak * 0.6).lerp(new THREE.Color("#140b06"), mouth * 0.9);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

export function makeTurtle() {
  const root = new THREE.Group(); root.name = "tortoise";
  const body = new THREE.Group(); root.add(body);
  const skin = skinMaterial();
  const headSkin = skin.clone(); headSkin.vertexColors = true; headSkin.map = skin.map.clone(); headSkin.map.repeat.set(2, 2);
  const shellMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.78, normalMap: tex("/assets/dark_rock/nor.jpg", { rep: 6 }), normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: tex("/assets/dark_rock/rough.jpg", { rep: 6 }),
  });
  const A = 13, Bh = 9.5, C = 17, SY = 13;
  const shell = new THREE.Mesh(shellGeometry(A, Bh, C), shellMat); shell.position.y = SY; shell.castShadow = shell.receiveShadow = true; body.add(shell);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial({ color: "#2e2416", roughness: 0.9 }));
  belly.scale.set(A * 0.92, 3.2, C * 0.92); belly.position.y = SY - 1.6; belly.castShadow = true; body.add(belly);
  // neck + head
  const neckGeo = makeTube(5, 32, 20); const neck = new THREE.Mesh(neckGeo, skin); neck.frustumCulled = false; neck.castShadow = neck.receiveShadow = true; body.add(neck);
  const head = new THREE.Group(); body.add(head);
  const hm = new THREE.Mesh(headGeometry(), headSkin); hm.castShadow = true; head.add(hm);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: "#050403", roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lidMat = skin;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), eyeMat); e.position.set(s * 1.62, 0.55, 1.35); head.add(e);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 12, 32), lidMat); lid.position.copy(e.position); lid.lookAt(e.position.clone().multiplyScalar(3)); head.add(lid);
  }
  // tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 24), skin); tail.rotation.x = -Math.PI / 2 - 0.5; tail.position.set(0, SY - 2.5, -C - 0.5); tail.castShadow = true; body.add(tail);
  // legs
  const clawMat = new THREE.MeshStandardMaterial({ color: "#d07a26", roughness: 0.45 });
  const legs = [
    { hip: new THREE.Vector3(-9.5, SY - 1.5, 10.5), side: -1, front: true, off: 0.25, r: [3.9, 3.4, 3.1, 3.0, 3.2] },
    { hip: new THREE.Vector3(9.5, SY - 1.5, 10.5), side: 1, front: true, off: 0.75, r: [3.9, 3.4, 3.1, 3.0, 3.2] },
    { hip: new THREE.Vector3(-9.5, SY - 2.2, -11), side: -1, front: false, off: 0.0, r: [4.2, 3.6, 3.2, 3.0, 3.2] },
    { hip: new THREE.Vector3(9.5, SY - 2.2, -11), side: 1, front: false, off: 0.5, r: [4.2, 3.6, 3.2, 3.0, 3.2] },
  ];
  for (const L of legs) {
    L.geo = makeTube(5, 30, 22); L.mesh = new THREE.Mesh(L.geo, skin); L.mesh.frustumCulled = false; L.mesh.castShadow = L.mesh.receiveShadow = true; root.add(L.mesh);
    L.foot = new THREE.Group(); root.add(L.foot);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skin); pad.scale.set(3.3, 1.3, 3.5); pad.position.y = 0.9; pad.castShadow = true; L.foot.add(pad);
    for (let k = 0; k < 5; k++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 12), clawMat); const a = (k - 2) * 0.32; cl.position.set(Math.sin(a) * 2.9, 0.55, Math.cos(a) * 3.1); cl.rotation.set(Math.PI / 2 - 0.25, 0, -a * 0.6); cl.rotation.order = "YXZ"; cl.rotation.y = a; cl.castShadow = true; L.foot.add(cl); }
  }
  root.userData = { body, head, neckGeo, legs, SY, A, C, skin };
  return root;
}

/** the walk at time t: the root moves along its +z at v (m/s) from (x0, z0) heading `yaw`; feet stay planted in stance */
export function walkTurtle(turtle, t, { start, yaw, v = 3.2, P = 2.6, duty = 0.68, lift = 2.6 }) {
  const U = turtle.userData, fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const pos = start.clone().addScaledVector(fwd, v * t);
  turtle.position.set(pos.x, groundH(pos.x, pos.z), pos.z); turtle.rotation.y = yaw;
  const stride = v * duty * P;
  const bob = 0.35 * Math.sin((t / P) * Math.PI * 4), roll = 0.018 * Math.sin((t / P) * Math.PI * 2);
  U.body.position.y = bob; U.body.rotation.z = roll; U.body.rotation.x = 0.01 * Math.sin((t / P) * Math.PI * 4 + 1);
  turtle.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(turtle.matrixWorld).invert(), wp = new THREE.Vector3();
  const strikes = [];
  for (const L of U.legs) {
    const ph = ((t / P + L.off) % 1 + 1) % 1;
    const F0 = new THREE.Vector3(L.hip.x * 1.28, 0, L.hip.z + (L.front ? 1.5 : -0.5));
    let fz, fy, ang = 0;
    if (ph < duty) { fz = F0.z + stride / 2 - stride * (ph / duty); fy = 0; }
    else { const s = (ph - duty) / (1 - duty), e = s * s * (3 - 2 * s); fz = F0.z - stride / 2 + stride * e; fy = Math.sin(Math.PI * s) * lift; ang = -Math.sin(Math.PI * s) * 0.35; }
    const foot = new THREE.Vector3(F0.x, fy, fz);
    wp.copy(foot).applyMatrix4(turtle.matrixWorld); foot.y += groundH(wp.x, wp.z) - turtle.position.y;
    const hip = L.hip.clone(); hip.y += bob;
    const top = foot.clone(); top.y += 2.0;
    const knee = hip.clone().lerp(top, 0.5); knee.x += L.side * 2.6; knee.y += 0.8; knee.z += L.front ? 1.2 : -1.0;
    const pts = [hip.clone().add(new THREE.Vector3(-L.side * 2.5, 1.2, 0)), hip, knee, top.clone().lerp(knee, 0.35), top];
    L.geo.userData.set(pts, L.r);
    L.foot.position.copy(foot); L.foot.rotation.set(ang, L.side * 0.15, 0);
    // footfall: the start of the stance
    L.phase = ph;
  }
  // neck + head: a slow look-around, head bobbing with the steps
  const sway = 0.12 * Math.sin(t * 0.9), nod = 0.25 * Math.sin((t / P) * Math.PI * 4 + 0.8);
  const hb = new THREE.Vector3(Math.sin(sway) * 6, U.SY + 1.2 + nod, U.C + 7.5);
  const pts = [new THREE.Vector3(0, U.SY - 1.0, U.C - 4), new THREE.Vector3(0, U.SY - 0.2, U.C + 0.5), new THREE.Vector3(Math.sin(sway) * 2.5, U.SY + 0.4 + nod * 0.5, U.C + 3.5), hb.clone().add(new THREE.Vector3(0, 0, -1.6)), hb];
  U.neckGeo.userData.set(pts, [4.6, 3.6, 2.8, 2.3, 2.1]);
  U.head.position.copy(hb).add(new THREE.Vector3(0, 0.2, 0.6)); U.head.rotation.set(-0.08 + nod * 0.05, sway * 1.4, 0);
  return { pos, fwd };
}

/** world-space footfalls between t0 and t1 (for dust): [{ t, pos }] */
export function turtleFootfalls(turtle, t0, t1, opts) {
  const out = [], P = opts.P ?? 2.6, duty = opts.duty ?? 0.68;
  for (const L of turtle.userData.legs) {
    for (let k = -2; k < 6; k++) {
      const tf = (k - L.off) * P; // phase 0 = stance start
      if (tf < t0 || tf > t1) continue;
      walkTurtle(turtle, tf, opts); turtle.updateMatrixWorld(true);
      const p = new THREE.Vector3(); L.foot.getWorldPosition(p); out.push({ t: tf, pos: p, front: L.front });
    }
  }
  return out;
}
