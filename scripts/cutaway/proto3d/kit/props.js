// M2 kit: small props that pop in on their word.
//  paperProp: a printed sheet or book cover (canvas text) that rises out of the ground or the trash (landfill
//    newspaper, French drain book); flagProp: a 3-stripe flag on a pole with an optional red "no" cross;
//  shrubs: a row of round bushes that pop in staggered (finishing touches); puddle: a flat water patch that spreads;
//  crack: a jagged dark line that grows across a wall; endSign: the Zyvo end card sign in the diorama.
import { pop, span, eOut, eIn } from "./verbs.js";

function canvasTex(THREE, w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

/** lines: [{ text, font, color, y }] in a 512-wide canvas; book = true gives it a cover thickness */
export function paperProp(ctx, { w = 1.8, h = 2.4, bg = "#efe6cf", lines = [], book = false, spine = "#5a3a22" }) {
  const { THREE, scene } = ctx;
  const ch = Math.round(512 * h / w);
  const map = canvasTex(THREE, 512, ch, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 512, ch); if (book) { g.strokeStyle = "#c9a54a"; g.lineWidth = 8; g.strokeRect(26, 26, 460, ch - 52); } g.textAlign = "center"; for (const l of lines) { if (l.rule) { g.fillStyle = l.color ?? "#2a2622"; g.fillRect(60, l.y, 392, 4); continue; } g.fillStyle = l.color ?? "#2a2622"; g.font = l.font; g.fillText(l.text, 256, l.y, 460); } });
  const face = new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
  const edge = new THREE.MeshStandardMaterial({ color: book ? spine : bg, roughness: 0.8 });
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, book ? 0.28 : 0.02), [edge, edge, edge, edge, face, edge]); body.castShadow = true; g.add(body);
  return {
    group: g,
    /** rise from `from` to `to` (world positions) starting at a; sink back at b (optional) */
    update(t, a, from, to, b = Infinity, rot = [-0.15, -0.35, 0]) {
      const up = eOut(span(t, a - 0.1, a + 0.6)), dn = eIn(span(t, b - 0.1, b + 0.4));
      const s = pop(t, a - 0.1, 0.45) * (1 - dn);
      g.visible = s > 0.002; g.scale.setScalar(Math.max(0.001, s));
      g.position.set(from[0] + (to[0] - from[0]) * up, from[1] + (to[1] - from[1]) * up - 2.5 * dn, from[2] + (to[2] - from[2]) * up);
      g.rotation.set(rot[0] + 0.06 * Math.sin(t * 1.3), rot[1] + 0.05 * Math.sin(t * 0.9), rot[2] + 0.04 * Math.sin(t * 1.1));
    },
  };
}

export function flagProp(ctx, { at, colors = ["#1f4fa8", "#ffffff", "#d7262e"], w = 1.8, h = 1.2, pole = 2.6 }) {
  const { THREE, scene } = ctx;
  const g = new THREE.Group(); g.position.set(...at); g.visible = false; scene.add(g);
  const pm = new THREE.MeshStandardMaterial({ color: "#d9dde2", roughness: 0.35, metalness: 0.6 });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, pole, 12), pm); p.position.y = pole / 2; p.castShadow = true; g.add(p);
  const map = canvasTex(THREE, 300, 200, (c) => colors.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 100, 0, 100, 200); }));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 16, 4), new THREE.MeshStandardMaterial({ map, roughness: 0.7, side: THREE.DoubleSide }));
  cloth.position.set(w / 2 + 0.05, pole - h / 2 - 0.05, 0); cloth.castShadow = true; g.add(cloth);
  const base = cloth.geometry.attributes.position.array.slice();
  // the red cross ("not France") floats in front of the flag
  const xm = new THREE.MeshBasicMaterial({ color: "#ff2b2b", toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false });
  const X = new THREE.Group(); X.position.set(w / 2 + 0.05, pole - h / 2 - 0.05, 0.3); g.add(X);
  for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w * 1.35, 0.22, 0.05), xm); b.rotation.z = s * Math.atan2(h, w); b.renderOrder = 6; X.add(b); }
  return {
    group: g,
    update(t, a, crossAt = Infinity, goneAt = Infinity) {
      const s = pop(t, a, 0.4) * (1 - eIn(span(t, goneAt - 0.1, goneAt + 0.3)));
      g.visible = s > 0.002; g.scale.setScalar(Math.max(0.001, s));
      const pa = cloth.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = base[i * 3] + w / 2; pa.setZ(i, 0.12 * x * Math.sin(x * 3 - t * 6)); } pa.needsUpdate = true; cloth.geometry.computeVertexNormals();
      const xs = pop(t, crossAt, 0.3); X.visible = xs > 0.002; X.scale.setScalar(Math.max(0.001, xs));
    },
  };
}

export function shrubs(ctx, list, { mats }) {
  const { THREE, scene, rnd, mergeVertices } = ctx;
  const items = list.map(([x, z, s = 1], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(0); scene.add(g);
    for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(mergeVertices(new THREE.IcosahedronGeometry((0.45 + rnd() * 0.2) * s, 3)), mats[(i + k) % mats.length]); l.geometry.computeVertexNormals(); const a = rnd() * 6.28; l.position.set(Math.cos(a) * 0.3 * s, (0.4 + rnd() * 0.25) * s, Math.sin(a) * 0.3 * s); l.castShadow = l.receiveShadow = true; g.add(l); }
    return g;
  });
  return { update(t, a, stagger = 0.08) { items.forEach((g, i) => g.scale.setScalar(pop(t, a + i * stagger, 0.35))); } };
}

export function puddle(ctx, { x, z, rx = 1.2, rz = 0.8, y = 0.02, mat }) {
  const { THREE, scene } = ctx;
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.visible = false; m.renderOrder = 2; scene.add(m);
  { const p = m.geometry.attributes.position; for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)); const k = 1 + 0.12 * Math.sin(a * 3 + x) + 0.08 * Math.sin(a * 5 + z); p.setXY(i, p.getX(i) * k, p.getY(i) * k); } }
  return { set(k) { m.visible = k > 0.01; m.scale.set(rx * Math.max(0.001, k), rz * Math.max(0.001, k), 1); } };
}

/** a crack on a wall plane: points in world space, grows from the first point */
export function crack(ctx, points, { color = "#1b1712", r = 0.045, halo = true } = {}) {
  const { THREE, scene } = ctx;
  const P = points.map((p) => new THREE.Vector3(...p));
  const path = new THREE.CurvePath(); for (let i = 0; i < P.length - 1; i++) path.add(new THREE.LineCurve3(P[i], P[i + 1]));
  const geo = new THREE.TubeGeometry(path, 24 * P.length, r, 6, false);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1 })); m.visible = false; scene.add(m);
  // (a pale edge just behind it: a dark crack on the dark soil face of the free ice rink run could not be seen; halo:
  // false leaves it out)
  const hgeo = halo ? new THREE.TubeGeometry(path, 24 * P.length, r * 2.3, 6, false) : null;
  const h = hgeo ? new THREE.Mesh(hgeo, new THREE.MeshStandardMaterial({ color: "#f4ead2", emissive: "#f4ead2", emissiveIntensity: 0.25, roughness: 1 })) : null;
  // (the dark line steps forward and the pale edge stays on the surface: an edge pushed back sank into the soil face)
  if (h) { h.position.z = 0.05; m.position.z = 0.05 + r * 1.6; h.visible = false; scene.add(h); }
  const total = geo.index.count, htotal = hgeo?.index.count ?? 0;
  return { set(k) { m.visible = k > 0.001; geo.setDrawRange(0, Math.floor((total * Math.min(1, k)) / 6) * 6); if (h) { h.visible = m.visible; hgeo.setDrawRange(0, Math.floor((htotal * Math.min(1, k)) / 6) * 6); } } };
}

export function endSign(ctx, { at, rotY = 0.3, scale = 1.5, postsReceiveShadow = false }) {
  const { THREE, scene } = ctx;
  const sign = new THREE.Group(); sign.position.set(...at); sign.rotation.y = rotY; sign.scale.setScalar(0); scene.add(sign);
  const t = canvasTex(THREE, 1024, 560, (g) => {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 1024, 560); g.fillStyle = "#22c55e"; g.fillRect(0, 0, 1024, 26); g.fillRect(0, 534, 1024, 26);
    g.textAlign = "center"; g.fillStyle = "#14181c"; g.font = "900 92px 'Arial Black', Arial, sans-serif"; g.fillText("Make videos", 512, 168); g.fillText("like this with", 512, 272);
    g.fillStyle = "#16a34a"; g.font = "900 112px 'Arial Black', Arial, sans-serif"; g.fillText("Zyvo", 512, 392);
    g.fillStyle = "#3a434c"; g.font = "700 64px Arial, sans-serif"; g.fillText("tryzyvo.com", 512, 488);
  });
  const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }), edge = new THREE.MeshStandardMaterial({ color: "#e9e4d8", roughness: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.06, 0.18), [edge, edge, edge, edge, face, edge]); board.position.y = 3.2; board.castShadow = true; sign.add(board);
  for (const x of [-2.1, 2.1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.0, 12), new THREE.MeshStandardMaterial({ color: "#7a5236", roughness: 0.8 })); p.position.set(x, 1.0, -0.05); p.castShadow = true; p.receiveShadow = postsReceiveShadow; sign.add(p); }
  return { update(t, a, on = true) { sign.visible = on; sign.scale.setScalar(scale * pop(t, a, 0.45)); } };
}
