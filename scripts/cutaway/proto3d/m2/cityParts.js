// M2 kit: the city parts for the non-home topics (NON_HOME_CATALOG.md). Each stands facing the camera (+z) at `pos`
// (its base centre), built once from boxes and cylinders in the R1 materials, animated by channels (0..1 unless noted):
//   car          a small car. drive (0: `from` x, 1: at pos), leave (0..1: on to `to` x), wheels turn with the motion
//   carWash      the bay's machine: a spray arch and two side brushes. arch (pop), spray (water from the nozzles),
//                brushes (pop), close (the brushes swing in to the car), spin (turns), foam (foam on the car), rinse
//   trafficLight a signal on a pole, and the wire loop cut into the road in front of it. show, red, yellow, green
//                (the lamps), loop (the wire loop appears in the road's cut), pulse (its field rings while a car sits on it)
//   hydrant      a dry-barrel fire hydrant: the body above ground, the barrel down to the valve deep below (in section at
//                the face). show, barrel (grows down), stem (the stem turns), valve (opens), water (rises in the barrel),
//                spray (out of the nozzle), drain (the drain hole at the valve weeps)
//   atm          a cash machine cut open on its right side: the screen, keypad, card slot, the cassettes in the safe,
//                the pick and the belt. show, screen, card (goes in), safe (the safe walls), cassettes (pop), pick (a
//                note travels from the cassette up the belt to the slot), cash (the notes come out)
const pop = (k) => Math.max(0.001, k);
const clamp = (v) => Math.min(1, Math.max(0, v));

function parts(ctx) {
  const { THREE, std, phys, C, RoundedBoxGeometry } = ctx;
  const add = (parent, geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const rb = (sx, sy, sz, r = 0.05) => new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sx * 0.45, sy * 0.45, sz * 0.45));
  const cylG = (r, h, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg);
  const steel = std({ color: C("#c9ced4"), roughness: 0.28, metalness: 0.85 }), dark = std({ color: C("#1c1f24"), roughness: 0.6 });
  const glow = (col, k = 0) => std({ color: C(col), emissive: C(col), emissiveIntensity: k, roughness: 0.3 });
  return { THREE, std, phys, C, add, rb, cylG, steel, dark, glow };
}

export function car(ctx, p, api) {
  const { THREE, phys, C, add, rb, cylG, dark, glow } = parts(ctx);
  const root = new THREE.Group(); ctx.scene.add(root);
  const [px, py, pz] = p.pos ?? [0, 0.1, -2], from = p.from ?? px - 16, to = p.to ?? px + 16, s = p.scale ?? 1;
  root.scale.setScalar(s);
  const paint = phys({ color: C(p.color ?? "#2f7de0"), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const glass = std3(ctx, "#bcd8ea");
  add(root, rb(4.2, 0.8, 1.9, 0.25), paint, 0, 0.75, 0);
  add(root, rb(2.4, 0.75, 1.7, 0.25), paint, -0.2, 1.45, 0);
  add(root, rb(2.2, 0.55, 1.75, 0.15), glass, -0.2, 1.47, 0, false);
  for (const x of [1.95, -1.95]) add(root, rb(0.1, 0.25, 0.5, 0.05), x > 0 ? glow("#fff3c4", 0.6) : glow("#d93a32", 0.4), x + (x > 0 ? 0.08 : -0.08), 0.85, 0.55);
  const wheels = [];
  for (const x of [1.35, -1.35]) for (const z of [0.85, -0.85]) { const w = add(root, cylG(0.42, 0.32, 20), dark, x, 0.42, z); w.rotation.x = Math.PI / 2; wheels.push(w); }
  // the foam a car wash puts on it (a carWash part drives it through api.shared)
  const foamMat = std3(ctx, "#ffffff", 0.9), foam = [];
  for (let i = 0; i < 26; i++) { const f = add(root, new THREE.SphereGeometry(0.28 + (i % 3) * 0.08, 10, 8), foamMat, -1.9 + (i % 9) * 0.48, 1.2 + ((i * 7) % 5) * 0.16, -0.7 + ((i * 5) % 3) * 0.7, false); f.visible = false; foam.push(f); }
  const shine = paint.clearcoat;
  ctx.shared = ctx.shared ?? {}; ctx.shared[`car:${p.id ?? "car"}`] = { root, foam, paint };
  return {
    update(t) {
      const dv = api.ch("drive", t), lv = api.ch("leave", t);
      const x = from + (px - from) * clamp(dv) + (to - px) * clamp(lv);
      root.position.set(x, py, pz); root.visible = dv > 0.001 && lv < 0.999;
      for (const w of wheels) w.rotation.y = -x / (0.42 * s);
      const f = ctx.shared[`car:${p.id ?? "car"}`].foamK ?? 0;
      foam.forEach((m, i) => { const k = clamp(f * 1.6 - (i / foam.length) * 0.6); m.visible = k > 0.01; m.scale.setScalar(pop(k)); });
      paint.clearcoat = shine * (1 - 0.6 * f);
    },
  };
}
function std3(ctx, col, rough = 0.15) { return ctx.std({ color: ctx.C(col), roughness: rough, transparent: rough < 0.5, opacity: rough < 0.5 ? 0.75 : 1 }); }

export function carWash(ctx, p, api) {
  const { THREE, std, C, add, rb, cylG, steel } = parts(ctx);
  const root = new THREE.Group(); root.position.set(...(p.pos ?? [0, 0.1, -2])); ctx.scene.add(root);
  const W = p.width ?? 3.6, H = p.height ?? 3.4;
  const arch = new THREE.Group(); root.add(arch);
  for (const sx of [-1, 1]) add(arch, rb(0.3, H, 0.3, 0.06), steel, sx * W / 2, H / 2, 0);
  add(arch, rb(W + 0.3, 0.3, 0.3, 0.06), steel, 0, H, 0);
  const nozzles = [];
  for (let i = 0; i < 7; i++) { const x = -W / 2 + 0.3 + (i * (W - 0.6)) / 6; nozzles.push(add(arch, cylG(0.07, 0.18, 10), std({ color: C("#2d3236"), roughness: 0.5 }), x, H - 0.24, 0.05)); }
  const water = std({ color: C("#9fd3f5"), roughness: 0.1, transparent: true, opacity: 0.7, emissive: C("#bfe6ff"), emissiveIntensity: 0.2 });
  const drops = [];
  for (let i = 0; i < 90; i++) { const d = add(arch, new THREE.BoxGeometry(0.03, 0.32, 0.03), water, 0, 0, 0, false); d.userData = { x: -W / 2 + 0.3 + (i % 7) * ((W - 0.6) / 6) + ((i * 13) % 5 - 2) * 0.05, ph: (i * 0.137) % 1, z: ((i * 7) % 5 - 2) * 0.18 }; drops.push(d); }
  // the brushes: tall soft cylinders (many thin strips round a core) on the two sides, in front of the arch
  const brushes = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * (W / 2 + 0.2), 0, 1.2); root.add(g);
    const core = new THREE.Group(); core.position.y = 0.2; g.add(core);
    const mat = std({ color: C(sx < 0 ? "#2f7de0" : "#d93a32"), roughness: 0.9 });
    for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2, s = add(core, new THREE.BoxGeometry(0.06, H - 0.6, 0.42), mat, Math.cos(a) * 0.38, (H - 0.6) / 2, Math.sin(a) * 0.38); s.rotation.y = -a; }
    add(g, cylG(0.06, H + 0.1, 10), steel, 0, (H + 0.1) / 2, 0);
    brushes.push({ g, core, sx });
  }
  return {
    update(t) {
      const ar = api.ch("arch", t); arch.scale.setScalar(pop(ar)); arch.visible = ar > 0.002;
      const sp = api.ch("spray", t);
      for (const d of drops) { const u = (t * 1.6 + d.userData.ph) % 1; d.visible = sp > 0.02 && ar > 0.5; d.position.set(d.userData.x, H - 0.35 - u * (H - 0.5), d.userData.z + u * 0.3); d.material.opacity = 0.7 * Math.min(1, sp); }
      const br = api.ch("brushes", t), cl = api.ch("close", t), spin = api.ch("spin", t);
      for (const b of brushes) { b.g.visible = br > 0.002; b.g.scale.setScalar(pop(br)); b.g.position.x = b.sx * (W / 2 + 0.2 - cl * (W / 2 - 1.15)); b.core.rotation.y = b.sx * spin * Math.PI * 2; }
      // the car in the bay takes the foam (p.car names it)
      const c = ctx.shared?.[`car:${p.car ?? "car"}`]; if (c) c.foamK = clamp(api.ch("foam", t) - api.ch("rinse", t));
    },
  };
}

export function trafficLight(ctx, p, api) {
  const { THREE, std, C, add, rb, cylG, dark, glow } = parts(ctx);
  const root = new THREE.Group(); const [x, y, z] = p.pos ?? [4, 0.1, -1]; root.position.set(x, y, z); ctx.scene.add(root);
  const H = p.height ?? 5, olive = std({ color: C("#3b4232"), roughness: 0.6 });
  const body = new THREE.Group(); root.add(body);
  add(body, cylG(0.12, H, 14), olive, 0, H / 2, 0);
  add(body, rb(0.9, 2.5, 0.6, 0.1), std({ color: C("#f0c419"), roughness: 0.5 }), 0, H + 1.0, 0.1);
  const lamps = ["#e0352b", "#f2b01e", "#2fbf5a"].map((col, i) => {
    const m = add(body, new THREE.CylinderGeometry(0.28, 0.28, 0.1, 22), glow(col, 0), 0, H + 1.8 - i * 0.8, 0.42, false); m.rotation.x = Math.PI / 2;
    add(body, rb(0.75, 0.08, 0.4, 0.03), dark, 0, H + 2.15 - i * 0.8, 0.55);
    return m;
  });
  const light = new THREE.PointLight(0xffffff, 0, 6); light.position.set(0, H + 1, 1.2); body.add(light);
  // the loop: a rectangle of wire in a saw cut in the road (just under the surface), at loop [x, z, w, d]
  const [lx, lz, lw, ld] = p.loop ?? [x - 3, -1.2, 2, 1.6];
  const wire = glow("#ff7a1a", 0.0), loopG = new THREE.Group(); loopG.position.set(lx, -0.04, lz); ctx.scene.add(loopG);
  for (const [sx, sz, w, d] of [[0, -ld / 2, lw, 0.06], [0, ld / 2, lw, 0.06], [-lw / 2, 0, 0.06, ld], [lw / 2, 0, 0.06, ld]]) add(loopG, new THREE.BoxGeometry(w, 0.06, d), wire, sx, 0, sz, false);
  add(loopG, new THREE.BoxGeometry(0.06, 0.06, Math.abs(lz) + 0.1), wire, lw / 2, -0.03, ld / 2 + Math.abs(lz) / 2, false); // the lead to the face (seen in section)
  const ringMat = std({ color: C("#ffb347"), emissive: C("#ff9a2e"), emissiveIntensity: 0.8, transparent: true, opacity: 0.6, roughness: 0.4 });
  const rings = [0, 1, 2].map(() => { const r = add(loopG, new THREE.TorusGeometry(1, 0.03, 6, 40), ringMat, 0, 0.3, 0, false); r.rotation.x = Math.PI / 2; return r; });
  return {
    update(t) {
      const sh = api.ch("show", t); body.scale.setScalar(pop(sh)); body.visible = sh > 0.002;
      const ks = ["red", "yellow", "green"].map((c) => clamp(api.ch(c, t)));
      lamps.forEach((m, i) => { m.material.emissiveIntensity = 0.05 + ks[i] * 1.6; });
      light.intensity = Math.max(...ks) * 3; light.color.set(ks[2] > 0.5 ? 0x2fbf5a : ks[1] > 0.5 ? 0xf2b01e : 0xe0352b);
      const lp = api.ch("loop", t); loopG.visible = lp > 0.002; loopG.scale.set(pop(lp), 1, pop(lp)); wire.emissiveIntensity = 0.2 + lp * 0.5;
      const pu = api.ch("pulse", t);
      rings.forEach((r, i) => { const u = (t * 0.9 + i / 3) % 1; r.visible = pu > 0.02 && lp > 0.5; r.scale.setScalar(0.5 + u * Math.max(lw, ld) * 0.8); r.position.y = 0.15 + u * 0.9; r.material.opacity = 0.6 * (1 - u) * Math.min(1, pu); });
    },
  };
}

export function hydrant(ctx, p, api) {
  const { THREE, std, C, add, cylG, steel } = parts(ctx);
  const [x, y, z] = p.pos ?? [0, 0.12, -0.5], depth = p.depth ?? 3.2;
  const root = new THREE.Group(); root.position.set(x, y, z); ctx.scene.add(root);
  const red = ctx.phys({ color: C(p.color ?? "#d4352b"), roughness: 0.35, clearcoat: 0.5 }), cap = std({ color: C("#f2c230"), roughness: 0.4 });
  const body = new THREE.Group(); root.add(body);
  add(body, cylG(0.32, 1.1, 22), red, 0, 0.55, 0); add(body, cylG(0.42, 0.12, 22), red, 0, 0.06, 0);
  add(body, new THREE.SphereGeometry(0.34, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, 1.1, 0);
  const nut = add(body, cylG(0.08, 0.16, 5), cap, 0, 1.5, 0);
  for (const a of [-1, 1]) { const n = add(body, cylG(0.12, 0.28, 16), red, a * 0.4, 0.72, 0); n.rotation.z = Math.PI / 2; const c = add(body, cylG(0.14, 0.06, 16), cap, a * 0.55, 0.72, 0); c.rotation.z = Math.PI / 2; }
  const front = add(body, cylG(0.17, 0.3, 16), red, 0, 0.65, 0.38); front.rotation.x = Math.PI / 2;
  // below ground, in section at the face: the barrel (a pipe cut in half), the stem, the valve, the drain hole
  const under = new THREE.Group(); under.position.z = -z - 0.06; root.add(under);
  const barrel = add(under, cylG(0.3, depth, 22), std({ color: C("#9aa0a6"), roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), 0, -depth / 2, 0);
  const stem = add(under, cylG(0.05, depth, 8), steel, 0, -depth / 2, 0.08);
  const valve = add(under, cylG(0.34, 0.16, 22), std({ color: C("#2d3236"), roughness: 0.5 }), 0, -depth, 0.02);
  add(under, cylG(0.4, 0.3, 22), std({ color: C("#6d747b"), roughness: 0.5, metalness: 0.4 }), 0, -depth - 0.25, 0);
  const waterMat = std({ color: C("#3d8fd6"), roughness: 0.1, transparent: true, opacity: 0.8, emissive: C("#3d8fd6"), emissiveIntensity: 0.15 });
  const col = add(under, cylG(0.26, 1, 18), waterMat, 0, -depth, 0.1, false);
  const sprayMat = std({ color: C("#9fd3f5"), roughness: 0.1, transparent: true, opacity: 0.8 }), jets = [];
  for (let i = 0; i < 40; i++) jets.push({ m: add(root, new THREE.SphereGeometry(0.09, 8, 6), sprayMat, 0, 0, 0, false), ph: i / 40 });
  const weep = []; for (let i = 0; i < 8; i++) weep.push({ m: add(under, new THREE.SphereGeometry(0.06, 8, 6), waterMat, 0.36, -depth + 0.1, 0.1, false), ph: i / 8 });
  return {
    update(t) {
      const sh = api.ch("show", t); body.scale.setScalar(pop(sh)); body.visible = sh > 0.002;
      const ba = api.ch("barrel", t); under.visible = ba > 0.002; under.scale.y = pop(ba);
      nut.rotation.y = api.ch("stem", t) * Math.PI * 6;
      const vo = clamp(api.ch("valve", t)); valve.position.y = -depth - vo * 0.3;
      const w = clamp(api.ch("water", t)), h = Math.max(0.01, w * (depth + 0.3)); col.visible = w > 0.01; col.scale.y = h; col.position.y = -depth - 0.2 + h / 2;
      const sp = api.ch("spray", t);
      for (const j of jets) { const u = (t * 1.4 + j.ph) % 1; j.m.visible = sp > 0.02; j.m.position.set(0, 0.65 - u * u * 1.2 + u * 0.4, 0.5 + u * 3.2 * Math.min(1, sp)); }
      const dr = api.ch("drain", t);
      for (const d of weep) { const u = (t * 0.8 + d.ph) % 1; d.m.visible = dr > 0.02; d.m.position.set(0.36 + u * 0.5, -depth + 0.1 - u * 0.5, 0.1); }
    },
  };
}

export function atm(ctx, p, api) {
  const { THREE, std, C, add, rb, glow } = parts(ctx);
  const root = new THREE.Group(); root.position.set(...(p.pos ?? [0, 0.12, -1])); ctx.scene.add(root);
  const W = 1.6, H = 2.6, D = 1.2;
  const shell = ctx.phys({ color: C(p.color ?? "#3a4654"), roughness: 0.4, clearcoat: 0.4 }), cutEdge = std({ color: C("#f3e3c2"), roughness: 0.7 });
  const body = new THREE.Group(); root.add(body);
  add(body, rb(W, H, 0.08), shell, 0, H / 2, -D / 2 + 0.04);
  add(body, rb(0.08, H, D), shell, -W / 2 + 0.04, H / 2, 0);
  add(body, rb(W, 0.1, D), shell, 0, H - 0.05, 0);
  add(body, rb(W, 1.4, 0.08), shell, 0, 1.9, D / 2 - 0.04);
  add(body, new THREE.BoxGeometry(0.04, H, D), cutEdge, W / 2, H / 2, 0, false);
  const screen = add(body, rb(0.8, 0.55, 0.04, 0.02), glow("#4fb0ff", 0), -0.1, 2.15, D / 2 + 0.01, false);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) add(body, rb(0.12, 0.09, 0.04, 0.02), std({ color: C("#d8dde2"), roughness: 0.4 }), -0.32 + c * 0.16, 1.7 - r * 0.12, D / 2 + 0.01);
  add(body, rb(0.3, 0.05, 0.05, 0.01), std({ color: C("#111"), roughness: 0.5 }), 0.35, 1.75, D / 2 + 0.01); // card slot
  add(body, rb(0.5, 0.06, 0.06, 0.01), std({ color: C("#111"), roughness: 0.5 }), -0.1, 1.3, D / 2 + 0.01); // cash slot
  const card = add(root, rb(0.26, 0.02, 0.16, 0.01), std({ color: C("#f2c230"), roughness: 0.3 }), 0.35, 1.75, D / 2 + 0.3, false);
  // the safe: thick grey walls round the lower half; the cassettes in it; the belt up to the cash slot
  const safe = new THREE.Group(); root.add(safe);
  const sMat = std({ color: C("#8b929b"), roughness: 0.55, metalness: 0.3 });
  add(safe, rb(W - 0.1, 0.15, D - 0.1), sMat, 0, 1.08, 0); add(safe, rb(W - 0.1, 0.15, D - 0.1), sMat, 0, 0.08, 0); add(safe, rb(0.15, 1.1, D - 0.1), sMat, -W / 2 + 0.15, 0.58, 0);
  add(safe, rb(0.12, 1.1, D - 0.1), sMat, W / 2 - 0.08, 0.58, 0); // the safe door, seen in section
  const cassettes = [0, 1, 2].map((i) => { const g = new THREE.Group(); g.position.set(-0.35 + i * 0.36, 0.35, 0); safe.add(g); add(g, rb(0.32, 0.4, 0.8, 0.03), std({ color: C("#2d3236"), roughness: 0.5 }), 0, 0, 0); for (let k = 0; k < 6; k++) add(g, new THREE.BoxGeometry(0.26, 0.04, 0.6), std({ color: C("#7cbf6a"), roughness: 0.8 }), 0, -0.12 + k * 0.05, 0); return g; });
  const belt = add(body, rb(0.08, 1.2, 0.08, 0.02), std({ color: C("#111"), roughness: 0.6 }), 0.55, 0.9, 0.2);
  const note = add(root, new THREE.BoxGeometry(0.26, 0.02, 0.14), std({ color: C("#7cbf6a"), roughness: 0.8 }), 0, 0, 0, false);
  const out = [0, 1, 2, 3].map(() => add(root, new THREE.BoxGeometry(0.34, 0.015, 0.16), std({ color: C("#7cbf6a"), roughness: 0.8 }), -0.1, 1.3, D / 2, false));
  const path = [[-0.35, 0.6, 0], [0.55, 0.6, 0.2], [0.55, 1.3, 0.2], [-0.1, 1.3, D / 2 + 0.05]].map((v) => new THREE.Vector3(...v));
  return {
    update(t) {
      const sh = api.ch("show", t); body.scale.setScalar(pop(sh)); body.visible = sh > 0.002;
      screen.material.emissiveIntensity = api.ch("screen", t) * 0.9;
      const cd = clamp(api.ch("card", t)); card.visible = cd > 0.01 && cd < 0.99; card.position.z = D / 2 + 0.3 - cd * 0.35;
      const sf = api.ch("safe", t); safe.visible = sf > 0.002; safe.scale.setScalar(pop(sf));
      const cs = api.ch("cassettes", t); cassettes.forEach((g, i) => { const k = clamp(cs * 1.5 - i * 0.25); g.scale.setScalar(pop(k)); g.visible = k > 0.002; });
      belt.visible = sf > 0.5;
      const pk = clamp(api.ch("pick", t)); note.visible = pk > 0.01 && pk < 0.99;
      if (note.visible) { const seg = Math.min(2.999, pk * 3), i = Math.floor(seg); note.position.copy(path[i]).lerp(path[i + 1], seg - i); }
      const ca = api.ch("cash", t); out.forEach((m, i) => { const k = clamp(ca * 1.4 - i * 0.12); m.visible = k > 0.01; m.position.set(-0.1, 1.3 + i * 0.02, D / 2 + k * 0.18); });
    },
  };
}

export const CITY_CHANNELS = {
  car: ["drive", "leave"],
  carWash: ["arch", "spray", "brushes", "close", "spin", "foam", "rinse"],
  trafficLight: ["show", "red", "yellow", "green", "loop", "pulse"],
  hydrant: ["show", "barrel", "stem", "valve", "water", "spray", "drain"],
  atm: ["show", "screen", "card", "safe", "cassettes", "pick", "cash"],
};
