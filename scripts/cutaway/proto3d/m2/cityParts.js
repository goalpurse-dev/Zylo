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
import { model, nodes } from "../kit/models.js";

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
  const wheels = [];
  // a Kenney CC0 car (kit/models.js), 4.2 m long, its front toward +x like the box car; a given colour tints it (a muddy
  // car), its wheels turn as it drives. Without the model loader (the tests): the box car.
  let spin = (w, x) => { w.rotation.y = -x / (0.42 * s); };
  // a muddy car (a mud-brown colour asked for, or mud: true): its own paint with flattened mud splats on the sides and
  // the bonnet, washed off as the car wash's foam goes on
  const hsl = p.color ? new THREE.Color(p.color).getHSL({}) : null;
  const muddy = p.mud ?? (!!hsl && hsl.h > 0.03 && hsl.h < 0.15 && hsl.s > 0.15 && hsl.l < 0.5);
  const mud = [];
  let model3d = false;
  if (ctx.gltf) {
    model3d = true;
    model(ctx, `car/${p.model ?? "sedan"}.glb`, { parent: root, rotY: Math.PI / 2, size: 4.2, gloss: 0.4, ...(p.color && !muddy ? { tint: p.color } : {}) }, (g, inner) => { for (const w of nodes(inner, /^wheel/)) wheels.push(w); });
    spin = (w, x) => { w.rotation.x = -x / (0.3 * 1.65 * s); };
    if (muddy) {
      const mudM = ctx.std({ color: C(p.color ?? "#6b4a2a"), roughness: 0.95 });
      for (let i = 0; i < 22; i++) {
        const side = i % 2 ? 1 : -1, onHood = i >= 16;
        const m = add(root, new THREE.SphereGeometry(0.15 + ((i * 7) % 4) * 0.04, 10, 8), mudM, onHood ? 1.3 + (i % 3) * 0.25 : -1.7 + ((i * 5) % 8) * 0.48, onHood ? 1.18 : 0.55 + ((i * 3) % 4) * 0.16, onHood ? -0.6 + (i % 4) * 0.4 : side * 1.2, false);
        if (onHood) m.scale.set(1.6, 0.15, 1.2); else m.scale.set(1.9, 0.8, 0.12);
        mud.push(m);
      }
    }
  } else {
    const glass = std3(ctx, "#bcd8ea");
    add(root, rb(4.2, 0.8, 1.9, 0.25), paint, 0, 0.75, 0);
    add(root, rb(2.4, 0.75, 1.7, 0.25), paint, -0.2, 1.45, 0);
    add(root, rb(2.2, 0.55, 1.75, 0.15), glass, -0.2, 1.47, 0, false);
    for (const x of [1.95, -1.95]) add(root, rb(0.1, 0.25, 0.5, 0.05), x > 0 ? glow("#fff3c4", 0.6) : glow("#d93a32", 0.4), x + (x > 0 ? 0.08 : -0.08), 0.85, 0.55);
    for (const x of [1.35, -1.35]) for (const z of [0.85, -0.85]) { const w = add(root, cylG(0.42, 0.32, 20), dark, x, 0.42, z); w.rotation.x = Math.PI / 2; wheels.push(w); }
  }
  // the foam a car wash puts on it (a carWash part drives it through api.shared)
  const foamMat = std3(ctx, "#ffffff", 0.9), foam = [];
  // (on the model car, taller and wider than the box car, the foam sits higher and wider)
  const fy = model3d ? 1.75 : 1.2, fz = model3d ? 0.95 : 0.7;
  for (let i = 0; i < 26; i++) { const f = add(root, new THREE.SphereGeometry(0.28 + (i % 3) * 0.08, 10, 8), foamMat, -1.9 + (i % 9) * 0.48, fy + ((i * 7) % 5) * 0.16, -fz + ((i * 5) % 3) * fz, false); f.visible = false; foam.push(f); }
  const shine = paint.clearcoat;
  let washed = 0;
  ctx.shared = ctx.shared ?? {}; ctx.shared[`car:${p.id ?? "car"}`] = { root, foam, paint };
  return {
    update(t) {
      const dv = api.ch("drive", t), lv = api.ch("leave", t);
      // axis "z": along a street's road (layoutRules rule 9), from/to along z; turned to face where it drives, and only
      // drawn over the ground (never in the air in front of the face)
      if (p.axis === "z") {
        const z = from + (pz - from) * clamp(dv) + (to - pz) * clamp(lv);
        root.rotation.y = to < from ? Math.PI / 2 : -Math.PI / 2;
        root.position.set(px, py, z); root.visible = dv > 0.001 && lv < 0.999 && z < -0.3;
        for (const w of wheels) spin(w, z);
      } else {
        const x = from + (px - from) * clamp(dv) + (to - px) * clamp(lv);
        root.position.set(x, py, pz); root.visible = dv > 0.001 && lv < 0.999;
        for (const w of wheels) spin(w, x);
      }
      const f = ctx.shared[`car:${p.id ?? "car"}`].foamK ?? 0;
      foam.forEach((m, i) => { const k = clamp(f * 1.6 - (i / foam.length) * 0.6); m.visible = k > 0.01; m.scale.setScalar(pop(k)); });
      paint.clearcoat = shine * (1 - 0.6 * f);
      // the mud goes as the foam goes on (and stays gone): frames are rendered in any order, so it follows the foam's
      // own channel at t, never a remembered peak
      washed = clamp((ctx.shared[`car:${p.id ?? "car"}`].washK ?? 0));
      mud.forEach((m, i) => { const k = clamp(1 - washed * 1.4 + (i / mud.length) * 0.3); m.visible = k > 0.02; });
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
    // a solid body and 12 broad strips (22 thin ones with gaps between shimmered as the camera moved: the flicker check)
    add(core, cylG(0.46, H - 0.6, 24), mat, 0, (H - 0.6) / 2, 0);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, s = add(core, new THREE.BoxGeometry(0.12, H - 0.6, 0.3), mat, Math.cos(a) * 0.5, (H - 0.6) / 2, Math.sin(a) * 0.5); s.rotation.y = -a; }
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
      const c = ctx.shared?.[`car:${p.car ?? "car"}`]; if (c) { c.foamK = clamp(api.ch("foam", t) - api.ch("rinse", t)); c.washK = clamp(api.ch("foam", t)); }
    },
  };
}

// one signal head as a real one looks (the creator's newer videos, 2026-10-25): a dark three-section housing with a yellow
// retro-reflective border on its backplate, a visor over each lamp, lenses that glow when lit. Returns the lens meshes.
function signalHead(ctx, parent, x, y, z) {
  const { THREE, std, C, add, rb, glow } = parts(ctx);
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const housing = std({ color: C("#1f2427"), roughness: 0.55 }), border = std({ color: C("#f2c230"), roughness: 0.45 });
  add(g, rb(1.25, 3.0, 0.08, 0.05), border, 0, 0, -0.18);
  add(g, rb(1.08, 2.84, 0.1, 0.05), housing, 0, 0, -0.13);
  add(g, rb(0.86, 2.6, 0.5, 0.08), housing, 0, 0, 0.12);
  return ["#e0352b", "#f2b01e", "#2fbf5a"].map((col, i) => {
    const cy = 0.85 - i * 0.85;
    const lens = add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.06, 28), glow(col, 0), 0, cy, 0.39, false); lens.rotation.x = Math.PI / 2;
    // the visor: a half tube over the lens's top
    const visor = add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.42, 20, 1, true, -Math.PI / 2, Math.PI), housing, 0, cy, 0.58, true); visor.rotation.x = Math.PI / 2; visor.material.side = THREE.DoubleSide;
    return lens;
  });
}

export function trafficLight(ctx, p, api) {
  const { THREE, std, C, add, cylG, glow } = parts(ctx);
  const root = new THREE.Group(); const [x, y, z] = p.pos ?? [4, 0.1, -1]; root.position.set(x, y, z); ctx.scene.add(root);
  const H = p.height ?? 5, pole = std({ color: C("#5f666b"), roughness: 0.45, metalness: 0.6 });
  const body = new THREE.Group(); root.add(body);
  add(body, cylG(0.14, H, 16), pole, 0, H / 2, 0);
  // arm: a mast arm over the road (its length, toward armDir: -1 left, 1 right), the head hanging from its end; without
  // it the head sits on top of the pole
  const arm = p.arm ?? 0, dir = p.armDir ?? -1;
  let lamps;
  if (arm > 0.5) {
    const a = add(body, cylG(0.09, arm, 12), pole, (dir * arm) / 2, H - 0.2, 0); a.rotation.z = Math.PI / 2;
    lamps = signalHead(ctx, body, dir * (arm - 0.3), H - 1.8, 0.1);
  } else lamps = signalHead(ctx, body, 0, H + 1.4, 0.1);
  // (its glow on the road, out in front: close to the head it tinted the dark lenses beside the lit one at night)
  const light = new THREE.PointLight(0xffffff, 0, 6); light.position.set(arm > 0.5 ? dir * (arm - 0.3) : 0, arm > 0.5 ? H - 2.6 : H + 0.6, 2.6); body.add(light);
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
      let ks = ["red", "yellow", "green"].map((c) => clamp(api.ch(c, t)));
      // running on its own: a cycle (green 4 s, yellow 1.5 s, red 4.5 s, round again) or a flashing red (1 a second)
      if (api.ch("cycle", t) > 0.5) { const u = (t + (p.phase ?? 0)) % 10; ks = u < 4 ? [0, 0, 1] : u < 5.5 ? [0, 1, 0] : [1, 0, 0]; }
      if (api.ch("flash", t) > 0.5) ks = [(t % 1) < 0.5 ? 1 : 0, 0, 0];
      // an unlit lens is dark (its colour at a fifth), a lit one bright and glowing: "all red" reads as one red lamp
      lamps.forEach((m, i) => { m.userData.base = m.userData.base ?? m.material.color.clone(); m.material.color.copy(m.userData.base).multiplyScalar(0.2 + 0.8 * ks[i]); m.material.emissiveIntensity = 0.02 + ks[i] * 1.8; });
      light.intensity = Math.max(...ks) * 1.4; light.color.set(ks[2] > 0.5 ? 0x2fbf5a : ks[1] > 0.5 ? 0xf2b01e : 0xe0352b);
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

/**
 * A lane of real cars (the creator's "cars pile up"): they arrive one by one and queue behind the stop line, then drive
 * off. lane [x, zStop] (the stop line), dir (1: driving toward the camera, +z, the queue backing up down the road; -1:
 * away), n (4), gap (5.6 m bumper to bumper), y (the road top), colors. Channels: pile (0..1: car k is in its place by
 * (k+1)/n), go (0..1: they pull away past the stop line).
 */
export function traffic(ctx, p, api) {
  const { THREE, C } = parts(ctx);
  const [lx, zStop] = p.lane ?? [-6, 4], dir = p.dir ?? 1, gap = p.gap ?? 5.6, y = p.y ?? 0.12;
  // driving away from the camera, the queue backs up toward the front edge: only as many as fit on the ground
  const n = dir < 0 ? Math.max(1, Math.min(p.n ?? 4, Math.floor((-0.6 - (zStop + 2.4 + 2.1)) / gap) + 1)) : p.n ?? 4;
  const colors = p.colors ?? ["#c0392b", "#2f7de0", "#e9c46a", "#5aa469", "#8e5aa8", "#f2f2f2"];
  const cars = Array.from({ length: n }, (_, k) => {
    const g = new THREE.Group(); ctx.scene.add(g);
    if (ctx.gltf) model(ctx, `car/${["sedan", "suv", "hatchback-sports", "sedan-sports", "taxi", "suv-luxury"][k % 6]}.glb`, { parent: g, rotY: dir > 0 ? 0 : Math.PI, size: 4.2, gloss: 0.4, tint: colors[k % colors.length] });
    else { const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 4.2), ctx.std({ color: C(colors[k % colors.length]), roughness: 0.4 })); m.position.y = 0.7; g.add(m); }
    // (driving away from the camera they come in over the front edge of the ground; toward it, from far down the road)
    const slot = zStop - dir * (2.4 + k * gap);
    return { g, slot, far: dir < 0 ? Math.min(-0.4, slot + 10) : zStop - dir * (60 + k * gap) };
  });
  return {
    update(t) {
      const pl = clamp(api.ch("pile", t)), go = clamp(api.ch("go", t));
      cars.forEach((c, k) => {
        const u = clamp(pl * n - k), arrived = u > 0.001;
        let zz = c.far + (c.slot - c.far) * (1 - (1 - u) * (1 - u));
        zz += dir * go * (50 + k * gap * 0.6);
        // only over the ground (z < 0), never past the cross street behind the shops
        c.g.position.set(lx, y, zz); c.g.visible = arrived && zz < -0.3 && zz > -40;
      });
    },
  };
}

/**
 * A countdown on a dark panel (a crosswalk's walk timer, a timer box's display): the number ticks from `from` to `to` as
 * count goes 0 -> 1. pos [x, y, z] (its centre), size (0.8), color (#ff9d2e), label (optional, small, under the number).
 * Channels: show, count.
 */
export function counter(ctx, p, api) {
  const { THREE, std, C, add, rb } = parts(ctx);
  const root = new THREE.Group(); root.position.set(...(p.pos ?? [0, 2.5, -1])); ctx.scene.add(root);
  const s = p.size ?? 0.8, from = p.from ?? 9, to = p.to ?? 0, col = p.color ?? "#ff9d2e";
  add(root, rb(s * 1.2, s * 1.2, 0.2, 0.05), std({ color: C("#14171a"), roughness: 0.5 }), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(col), emissiveIntensity: 0.9, transparent: true }));
  face.position.z = 0.11; root.add(face);
  const tex = new Map();
  const texFor = (v) => {
    if (tex.has(v)) return tex.get(v);
    const cv = (typeof document !== "undefined" ? document.createElement("canvas") : null);
    if (!cv) return null;
    cv.width = cv.height = 256; const g = cv.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256); g.fillStyle = col; g.font = "bold 200px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(v), 128, 138);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; tex.set(v, t); return t;
  };
  let shown = null;
  return {
    update(t) {
      const sh = api.ch("show", t); root.visible = sh > 0.002; root.scale.setScalar(pop(sh));
      const v = Math.round(from + (to - from) * clamp(api.ch("count", t)));
      if (v !== shown) { const tx = texFor(v); if (tx) { face.material.map = tx; face.material.emissiveMap = tx; face.material.needsUpdate = true; } shown = v; }
    },
  };
}

export const CITY_CHANNELS = {
  car: ["drive", "leave"],
  carWash: ["arch", "spray", "brushes", "close", "spin", "foam", "rinse"],
  trafficLight: ["show", "red", "yellow", "green", "loop", "pulse", "cycle", "flash"],
  traffic: ["pile", "go"],
  counter: ["show", "count"],
  hydrant: ["show", "barrel", "stem", "valve", "water", "spray", "drain"],
  atm: ["show", "screen", "card", "safe", "cassettes", "pick", "cash"],
};
