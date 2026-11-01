// M2: the part kinds a layout can use. Each kind builds its objects once and moves them every frame from its
// channels (m2/curves.js). The landfill kinds are the approved anim_full.js code and the French drain kinds wrap the
// approved kit parts, so a golden layout re-renders the approved video. A planner may only use these kinds.
//
// A kind is (ctx, params, api) => { update(t), ...anything other parts may read }.
//   api.ch(name, t, shift)   a channel's value (shift moves its cues later, for staggered elements)
//   api.cue(name)            the channel's first cue {t0, t1} (for parts that take their own start and end)
//   api.cues(name)           all of the channel's cues
//   api.other(id, name, t)   another part's channel;  api.part(id) another part's object and params
//   api.mat(name)            a named material (m2/materials.js);  api.endCard  whether the end card is shown
import { clamp01, eBack, eIn, eInOut, eOut, pop, span } from "../kit/verbs.js";
import { digCut } from "../kit/digCut.js";
import { fillBlock, pebbles, pour, wipeBlock } from "../kit/fill.js";
import { pipePath } from "../kit/pipe.js";
import { arrows, outline } from "../kit/overlay.js";
import { rain, stream } from "../kit/weather.js";
import { wrapSheet } from "../kit/sheet.js";
import { crack, endSign, flagProp, paperProp, puddle, shrubs } from "../kit/props.js";
import { EASES, rampU } from "./curves.js";
import { miniMachines, VENDING_CHANNELS, vendingMachine } from "./vending.js";
import { atm, cabinet, car, carWash, CITY_CHANNELS, counter, hydrant, traffic, trafficLight } from "./cityParts.js";
import { canopy, CLARITY_CHANNELS, creek, flow, grate, prop, settle } from "./clarityParts.js";
import { rig } from "./rig.js";

const V3 = (THREE, a) => new THREE.Vector3(...a);
// the pebble shape (the French drain gravel): made once, shared by every gravel and soak pit part
function stoneGeometry(ctx) {
  if (ctx.sharedGeo.stone) return ctx.sharedGeo.stone;
  const { THREE, mergeVertices } = ctx;
  const s = mergeVertices(new THREE.IcosahedronGeometry(1, 1)); const q = s.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < q.count; i++) { v.fromBufferAttribute(q, i); v.multiplyScalar(1 + 0.18 * Math.sin(v.x * 5 + v.y * 3)); q.setXYZ(i, v.x, v.y * 0.8, v.z); }
  s.computeVertexNormals();
  return (ctx.sharedGeo.stone = s);
}
const noWet = { set() {} };
// a cue with its start (and end) moved by s0 (and s1): for elements that start one after another
const shifted = (r, t, s0, s1 = s0) => {
  const t0 = r.t0 + s0, t1 = r.t1 + s1;
  const u = t1 > t0 ? clamp01((t - t0) / (t1 - t0)) : t >= t0 ? 1 : 0;
  return r.amp * (r.e === "step" ? (u > 0 ? 1 : 0) : (EASES[r.e] ?? EASES.lin)(u));
};

export const KINDS = {
  // ================= machines (the vending machine, cut open) =================
  vendingMachine, miniMachines,
  // a part the scene planner designs from building blocks when the kit has none (rig.js: a garage door, a rain barrel)
  rig,
  // the city parts (cityParts.js): a car, a car wash's arch and brushes, a traffic light and its road loop, a hydrant, an ATM
  car, carWash, trafficLight, hydrant, atm, traffic, counter, cabinet,
  // parts that make a sentence's action visible (clarityParts.js): separation in a tank, a creek, a flow along a path,
  // setting props, a roof on its posts
  settle, creek, flow, prop, canopy, grate,

  // ================= ground =================

  /** a box cut dug open (the cut itself is the world's: world.cut); channels: dig, refill */
  dig(ctx, p, api) {
    const cut = { ...ctx.cut, ...(p.cut ?? {}) };
    const d = digCut(ctx, { x0: cut.x0, x1: cut.x1, z0: cut.z0, z1: 0, depth: cut.depth, mound: p.mound, clumps: p.clumps ?? 150, dirtMat: api.mat(p.mat ?? "dirt"), margin: p.margin, endY: p.endY, arc: p.arc, uvFlip: p.uvFlip });
    // dark: a narrow shaft (a well) would read as part of the face; its inside is shaded dark as it opens
    let shade = null;
    if (p.dark) {
      const { THREE, scene } = ctx, w = cut.x1 - cut.x0;
      shade = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 1, 0.02), new THREE.MeshStandardMaterial({ color: "#24180f", roughness: 1 }));
      shade.geometry.translate(0, -0.5, 0); shade.position.set((cut.x0 + cut.x1) / 2, 0, cut.z0 + 0.015); shade.visible = false; scene.add(shade);
    }
    return {
      update(t) {
        // haul (the street, garage, room, car wash): the dug dirt is taken away right after the dig, the pile never stays
        const c = api.cue("dig"), r = api.cue("refill"); d.update(t, c.t0, c.t1, p.haul ? [c.t1 + 0.3, c.t1 + 1.5] : r ? [r.t0, r.t1] : null);
        if (shade) { const k = Math.min(1, Math.max(0, (t - c.t0) / Math.max(0.01, c.t1 - c.t0))); shade.visible = k > 0.01; shade.scale.y = Math.max(0.001, k * cut.depth); }
      },
    };
  },

  /** anchored boxes that wipe in along an axis (clay base, liner, soil covers, a grass cap); each panel names its channel */
  panels(ctx, p, api) {
    const { THREE, scene, RoundedBoxGeometry } = ctx;
    const list = p.panels.map((q) => {
      const [sx, sy, sz] = q.size, [ax, ay, az] = q.anchor ?? [0, 0, 0];
      const g = new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(q.r ?? 0.04, Math.min(sx, sy, sz) * 0.45)); g.translate(ax * sx / 2, ay * sy / 2, az * sz / 2);
      if (q.uv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * q.uv[0], uv.getY(i) * q.uv[1]); }
      const o = new THREE.Mesh(g, api.mat(q.mat ?? p.mat)); o.castShadow = o.receiveShadow = true; o.visible = false; o.position.set(...q.pos); scene.add(o);
      return { o, q };
    });
    return {
      update(t) {
        for (const { o, q } of list) {
          const k = api.ch(q.ch, t);
          o.visible = k > (q.vis ?? 0);
          if (q.axis) o.scale[q.axis] = Math.max(0.001, k);
        }
      },
    };
  },

  /** a plain box (a foundation, a slab, a wall); no channels */
  box(ctx, p, api) {
    const o = ctx.box(api.mat(p.mat), ...p.size, ...p.pos, ctx.scene, p.r ?? 0.04);
    if (p.receiveShadow) o.receiveShadow = true;
    return { update() {} };
  },

  // ================= trash, trucks, layers =================

  /** a layer of trash bags that falls in (from the truck, or from above), lifts out of the way and settles back */
  bags(ctx, p, api) {
    const { THREE, scene, rnd, bagGeo } = ctx;
    const mats = api.mat("bags");
    const { x0: IX0, x1: IX1, z0: IZ0, z1: IZ1 } = p.area, BAGH = p.h ?? 1.6, [NX, NZ] = p.grid ?? [5, 4];
    const out = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const cw = (IX1 - IX0) / NX, cd = (IZ1 - IZ0) / NZ, w = cw * (0.98 + rnd() * 0.08), d = cd * (0.98 + rnd() * 0.08), h = BAGH * (0.9 + rnd() * 0.12);
      const g = new THREE.Group(); g.visible = false; scene.add(g);
      const m = mats[(i * 2 + j * 3 + (p.n0 ?? 0)) % mats.length];
      const b = new THREE.Mesh(bagGeo(w, h, d, rnd() * 10), m); b.castShadow = b.receiveShadow = true; g.add(b);
      if (rnd() < 0.5) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), m); k.position.set((rnd() - 0.5) * 0.3, h / 2 + 0.15, (rnd() - 0.5) * 0.3); k.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); k.castShadow = true; g.add(k); }
      out.push({ g, h, x: IX0 + cw * (i + 0.5), z: IZ0 + cd * (j + 0.5), n: out.length, spin: (rnd() - 0.5) * 2, y0: p.y0 });
    }
    const st = p.stagger ?? 0.035, DUR = p.dur ?? 0.6, up = p.liftStagger?.up ?? 0.008, dn = p.liftStagger?.down ?? 0.012;
    return {
      update(t) {
        const c = api.cue("drop"); if (!c) return;
        let from = null;
        if (p.fromTruck) from = new THREE.Vector3(p.fromTruck.x ?? 0, p.fromTruck.y, api.other(p.fromTruck.part, "z", c.t0) + p.fromTruck.dz);
        // the settle offset: lifts (amp > 0 starts staggered by `up`, amp < 0 by `down`) and raises (staggered by `down`)
        const lifts = api.cues("lift"), raises = api.cues("raise");
        for (const b of out) {
          const rel = c.t0 + b.n * st;
          if (t < rel) { b.g.visible = false; continue; }
          b.g.visible = true;
          const src = from ?? new THREE.Vector3(b.x * (p.fromAbove?.xScale ?? 0.6), p.fromAbove?.y ?? 7, b.z);
          const rest = b.y0 + b.h / 2, u = span(t, rel, rel + DUR);
          let x = b.x, y = rest, z = b.z, rx = 0, ry = 0;
          if (u < 1) { const ex = eOut(u), ey = u * u; x = src.x + (b.x - src.x) * ex; z = src.z + (b.z - src.z) * ex; y = src.y + (rest - src.y) * ey + Math.sin(u * Math.PI) * 1.0; rx = b.spin * (1 - u) * 0.6; ry = b.spin * u * 0.4; }
          else { let s = 0; for (const r of lifts) s += shifted(r, t, b.n * (r.amp >= 0 ? up : dn), 0); for (const r of raises) s += shifted(r, t, b.n * dn, 0); y = rest + s; }
          let sq = 0; const k = span(t, rel + DUR, rel + DUR + 0.25); if (k > 0 && k < 1) sq = Math.sin(k * Math.PI) * 0.15;
          b.g.position.set(x, y, z); b.g.rotation.set(rx, ry, 0); b.g.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
        }
      },
    };
  },

  /** a dump truck that drives in, tips its bed and drives away; channels: z (its position), tip, load (1 = loaded) */
  dumpTruck(ctx, p, api) {
    const { THREE, scene, box, cyl, P, bagGeo } = ctx;
    const mats = api.mat("bags");
    const truck = new THREE.Group(); scene.add(truck);
    box(P.chassis, 2.4, 0.5, 7.2, 0, 1.0, 0, truck, 0.08);
    { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.6, 0); sh.lineTo(2.6, 1.3); sh.lineTo(2.1, 2.4); sh.lineTo(0, 2.4); sh.lineTo(0, 0);
      const cg = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }); cg.translate(0, 0, -1.3); cg.rotateY(Math.PI / 2);
      const cab = new THREE.Mesh(cg, P.truck); cab.position.set(0, 1.25, -1.4); cab.castShadow = true; truck.add(cab);
      box(P.glass, 2.3, 0.95, 0.06, 0, 3.15, -3.75, truck, 0.02).rotation.x = -0.42; for (const x of [-1.33, 1.33]) box(P.glass, 0.05, 0.85, 1.5, x, 3.05, -2.4, truck, 0.02);
      box(P.chassis, 2.2, 0.8, 0.1, 0, 1.75, -4.02, truck, 0.03); box(P.rim, 2.7, 0.3, 0.3, 0, 1.1, -4.15, truck, 0.08); }
    const wheels = [];
    for (const [x, z] of [[-1.3, -2.5], [1.3, -2.5], [-1.3, 1.4], [1.3, 1.4], [-1.3, 2.8], [1.3, 2.8]]) { const w = new THREE.Group(); w.position.set(x, 0.62, z); truck.add(w); cyl(P.tyre, 0.62, 0.55, 0, 0, 0, w, "x", 32); cyl(P.rim, 0.34, 0.57, 0, 0, 0, w, "x", 24); box(P.chassis, 0.6, 0.12, 0.5, 0, 0, 0, w, 0.03); wheels.push(w); }
    const pivot = new THREE.Group(); pivot.position.set(0, 1.3, 3.6); truck.add(pivot);
    const bed = new THREE.Group(); bed.position.set(0, 0, -2.3); pivot.add(bed);
    box(P.bed, 2.7, 0.22, 4.6, 0, 0.11, 0, bed, 0.05); for (const x of [-1.3, 1.3]) box(P.bed, 0.14, 1.5, 4.6, x, 0.85, 0, bed, 0.05); box(P.bed, 2.7, 1.8, 0.14, 0, 0.95, -2.25, bed, 0.05);
    for (let k = -1.5; k <= 1.6; k += 0.75) for (const x of [-1.39, 1.39]) box(P.bed, 0.06, 1.3, 0.12, x, 0.85, k, bed, 0.02);
    const load = [[-0.45, 0.8, -1.1, 0], [0.55, 0.75, -0.1, 1], [0, 1.4, -0.6, 2]].map(([x, y, z, k]) => { const b = new THREE.Mesh(bagGeo(1.25, 0.95, 1.25, k * 3), mats[k]); b.position.set(x, y, z); b.castShadow = true; bed.add(b); return b; });
    return {
      update(t) {
        const z = api.ch("z", t);
        truck.position.set(p.x ?? 0, 0, z); pivot.rotation.x = api.ch("tip", t); wheels.forEach((w) => { w.rotation.x = -z * 1.6; });
        const loaded = api.ch("load", t) > 0.5; load.forEach((b) => { b.visible = loaded; });
      },
    };
  },

  // ================= pipes, tanks, flows =================

  /** a solid pipe along a path that grows at constant speed (joints at the bends); channel: grow (0..1) */
  pipeRun(ctx, p, api) {
    const { THREE, scene } = ctx;
    const pts = p.path.map((q) => V3(THREE, q)), mat = api.mat(p.mat ?? "pipeWhite");
    const segs = []; let length = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1], len = A.distanceTo(B);
      const g = new THREE.CylinderGeometry(p.r, p.r, 1, p.radial ?? 24); g.translate(0, 0.5, 0);
      const m = new THREE.Mesh(g, mat); m.position.copy(A); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = true; m.visible = false; scene.add(m);
      let j = null;
      if (p.joints !== false) { j = new THREE.Mesh(new THREE.SphereGeometry(p.jointR ?? p.r * 1.2, 20, 12), mat); j.position.copy(B); j.visible = false; scene.add(j); }
      segs.push({ m, j, from: length, len, A, B }); length += len;
    }
    const at = (d) => { let acc = 0; for (let i = 0; i < pts.length - 1; i++) { const A = pts[i], B = pts[i + 1], len = A.distanceTo(B); if (d <= acc + len) return A.clone().lerp(B, (d - acc) / len); acc += len; } return pts.at(-1).clone(); };
    let grown = 0;
    return {
      length, at, grown: () => grown,
      update(t) {
        grown = api.ch("grow", t) * length;
        segs.forEach((sg) => { const f = clamp01((grown - sg.from) / sg.len); sg.m.visible = f > 0; sg.m.scale.set(1, Math.max(0.001, f) * sg.len, 1); if (sg.j) sg.j.visible = f >= 1; });
      },
    };
  },

  /** liquid running along a pipeRun (only where it is built); channel: on */
  pipeRunFlow(ctx, p, api) {
    const { THREE, scene } = ctx;
    const pipe = api.part(p.pipe).obj, N = p.count ?? 14;
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(p.size ?? 0.13, 10, 8), api.mat(p.mat ?? "juice"), N); im.renderOrder = 4; scene.add(im);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3();
    return {
      update(t) {
        const on = api.ch("on", t), L = pipe.length, grow = pipe.grown();
        for (let i = 0; i < N; i++) { const d = ((t * (p.speed ?? 3.2) + i / N * L) % L); const q = pipe.at(d); q.z += p.dz ?? 0.22; const s = on > 0.01 && d < grow ? on : 0; im.setMatrixAt(i, m4.compose(q, q4.identity(), s4.setScalar(s))); }
        im.instanceMatrix.needsUpdate = true;
      },
    };
  },

  /** a tank that pops in; channel: pop */
  tank(ctx, p, api) {
    const { THREE, scene, cyl, P } = ctx;
    const mat = api.mat(p.mat ?? "tankBlue"), r = p.r ?? 1.3, h = p.h ?? 2.6;
    const g = new THREE.Group(); g.position.set(...p.pos); scene.add(g); g.scale.setScalar(0);
    cyl(mat, r, h, 0, h / 2, 0, g, "y", 48);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r + 0.02, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat); cap.scale.y = 0.3; cap.position.y = h; g.add(cap);
    for (const yy of p.bands ?? [0.5, 2.0]) { const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 8, 48), P.chassis); band.rotation.x = Math.PI / 2; band.position.y = yy; g.add(band); }
    return { update(t) { g.scale.setScalar(api.ch("pop", t)); } };
  },

  /** a vertical pipe rising from y0 to y1; channel: grow */
  riser(ctx, p, api) {
    const { THREE, scene } = ctx;
    const g = new THREE.CylinderGeometry(p.r ?? 0.2, p.r ?? 0.2, 1, p.radial ?? 20); g.translate(0, 0.5, 0);
    const m = new THREE.Mesh(g, api.mat(p.mat ?? "metal")); m.position.set(p.x, p.y0, p.z); m.castShadow = true; m.visible = false; scene.add(m);
    return { update(t) { const k = api.ch("grow", t); m.visible = k > 0; m.scale.set(1, Math.max(0.001, k * (p.y1 - p.y0)), 1); } };
  },

  /** a box that pops in (a wellhead, a valve, a meter); channel: pop */
  boxPop(ctx, p, api) {
    const o = ctx.box(api.mat(p.mat ?? "chassis"), ...p.size, ...p.pos, ctx.scene, p.r ?? 0.1); o.scale.setScalar(0);
    return { update(t) { o.scale.setScalar(api.ch("pop", t)); } };
  },

  /** a gas flare: a layered cartoon flame with a halo and a warm light; channel: pop */
  flare(ctx, p, api) {
    const { THREE, scene, C } = ctx;
    const flameG = new THREE.Group(); flameG.position.set(...p.pos); scene.add(flameG); flameG.scale.setScalar(0);
    const tear = (w, h) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * Math.pow(1 - t, 0.55), t * h)); } return new THREE.LatheGeometry(pts, 32); };
    const fm = (c, o) => new THREE.MeshBasicMaterial({ color: C(c), toneMapped: false, transparent: true, opacity: o, depthWrite: false });
    [[0.3, 0.9, "#fff1a0", 1, 1], [0.5, 1.6, "#ffb02a", 0.8, 2], [0.72, 2.4, "#ff6410", 0.5, 3]].forEach(([w, h, c, o, ord]) => { const f = new THREE.Mesh(tear(w, h), fm(c, o)); f.renderOrder = ord; flameG.add(f); });
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const gg = cv.getContext("2d"); const rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, "rgba(255,200,90,1)"); rg.addColorStop(0.3, "rgba(255,150,40,0.5)"); rg.addColorStop(1, "rgba(255,120,30,0)"); gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
    const gt = new THREE.CanvasTexture(cv); gt.colorSpace = THREE.SRGBColorSpace; const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); halo.position.set(0, 0.9, 0); halo.scale.set(4.2, 4.2, 1); flameG.add(halo);
    const light = new THREE.PointLight(0xffa040, 0, 12, 1.5); light.position.set(p.pos[0], p.pos[1] + 0.85, p.pos[2]); scene.add(light);
    return { update(t) { const fl = api.ch("pop", t); flameG.scale.set(fl * (1 + 0.06 * Math.sin(t * 13)), fl * (1 + 0.1 * Math.sin(t * 9 + 1)), fl); light.intensity = (p.intensity ?? 30) * Math.min(1, fl); } };
  },

  /** gas bubbles rising through a layer in the cut face; channel: on */
  bubbles(ctx, p, api) {
    const { THREE, scene, rnd } = ctx;
    const N = p.count ?? 46, im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), api.mat("gasBubbles"), N); im.renderOrder = 4; scene.add(im);
    const data = Array.from({ length: N }, () => ({ x: p.x0 + 0.4 + rnd() * (p.x1 - p.x0 - 0.8), z: p.z ?? -0.15, ph: rnd(), s: 0.07 + rnd() * 0.08, w: rnd() * 6 }));
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
    return {
      update(t) {
        const on = api.ch("on", t);
        data.forEach((d, i) => { const ph = (t * (p.speed ?? 0.35) + d.ph) % 1; const y = p.y0 + 0.3 + ph * (p.y1 - p.y0); const x = d.x + 0.15 * Math.sin(t * 2 + d.w); const s = on > 0.01 ? d.s * Math.sin(ph * Math.PI) * on : 0; im.setMatrixAt(i, m4.compose(v4.set(x, y, d.z), q4.identity(), s4.setScalar(s))); });
        im.instanceMatrix.needsUpdate = true;
      },
    };
  },

  /** a generator box that pops in; channel: pop */
  machine(ctx, p, api) {
    const { THREE, scene, box, cyl } = ctx;
    const g = new THREE.Group(); g.position.set(...p.pos); g.rotation.y = p.rotY ?? 0; scene.add(g); g.scale.setScalar(0);
    box(api.mat("machineBody"), 2.6, 1.7, 1.7, 0, 0.85, 0, g, 0.1); box(api.mat("machineBand"), 2.62, 0.22, 1.72, 0, 1.25, 0, g, 0.04); cyl(api.mat("metal"), 0.12, 1.0, 0.8, 2.2, -0.3, g, "y", 12);
    return { update(t) { g.scale.setScalar(api.ch("pop", t)); } };
  },

  // ================= finishing touches and props =================

  /** fence posts that pop in one after another, then the rails; channels: pop (per post, staggered), rails */
  fence(ctx, p, api) {
    const { box, scene } = ctx;
    const postM = api.mat("post"), railM = api.mat("rail");
    const posts = [];
    for (let x = p.x0; x <= p.x1 + 0.01; x += p.step) posts.push([x, p.zBack]);
    for (let z = p.zBack + p.sideStart; z <= p.zFront + 0.001; z += p.step) { posts.push([p.x0, z]); posts.push([p.x1, z]); }
    const items = posts.map(([x, z], i) => { const o = box(postM, 0.16, 1.15, 0.16, x, 0.58, z, scene, 0.04); o.scale.setScalar(0); return { o, i }; });
    const zm = (p.zBack + p.zFront + p.sideStart) / 2, zl = p.zFront - p.zBack;
    const rails = [box(railM, p.x1 - p.x0 + 0.0, 0.1, 0.06, (p.x0 + p.x1) / 2, 0.8, p.zBack, scene, 0.02), box(railM, p.x1 - p.x0, 0.1, 0.06, (p.x0 + p.x1) / 2, 0.45, p.zBack, scene, 0.02), box(railM, 0.06, 0.1, p.railLen ?? zl, p.x0, 0.8, p.railZ ?? zm, scene, 0.02), box(railM, 0.06, 0.1, p.railLen ?? zl, p.x1, 0.8, p.railZ ?? zm, scene, 0.02), box(railM, 0.06, 0.1, p.railLen ?? zl, p.x0, 0.45, p.railZ ?? zm, scene, 0.02), box(railM, 0.06, 0.1, p.railLen ?? zl, p.x1, 0.45, p.railZ ?? zm, scene, 0.02)];
    rails.forEach((r) => { r.visible = false; });
    return {
      update(t) {
        items.forEach(({ o, i }) => o.scale.setScalar(api.ch("pop", t, i * (p.stagger ?? 0.025))));
        const on = api.ch("rails", t) > 0.5; rails.forEach((r) => { r.visible = on; });
      },
    };
  },

  /** young trees that pop in one after another; channel: pop (staggered) */
  youngTrees(ctx, p, api) {
    const { THREE, scene, cyl, P, rnd, mergeVertices } = ctx;
    const trees = p.trees.map(([x, z, s]) => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); cyl(P.trunk, 0.16 * s * 2, 2.2 * s * 2, 0, 1.1 * s * 2, 0, g, "y", 10);
      for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(mergeVertices(new THREE.IcosahedronGeometry((0.8 + rnd() * 0.3) * s * 2, 3)), k % 2 ? P.leaf : P.leaf2); l.geometry.computeVertexNormals(); const a = rnd() * 6.28; l.position.set(Math.cos(a) * 0.4 * s * 2, (2.4 + rnd() * 0.6) * s * 2, Math.sin(a) * 0.4 * s * 2); l.castShadow = true; g.add(l); }
      g.scale.setScalar(0); return g; });
    return { update(t) { trees.forEach((g, i) => g.scale.setScalar(api.ch("pop", t, i * (p.stagger ?? 0.12)))); } };
  },

  /** a printed sheet (a newspaper) that rises out of the trash, sways, and sinks back; channels: up, down, pop */
  sheet(ctx, p, api) {
    const { THREE, scene, std } = ctx;
    const tex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 680; const g = c.getContext("2d");
      g.fillStyle = "#efe6cf"; g.fillRect(0, 0, 512, 680); g.fillStyle = "#2a2622"; g.font = "bold 50px Georgia, serif"; g.textAlign = "center"; g.fillText(p.masthead ?? "THE DAILY NEWS", 256, 74, 470);
      g.fillRect(28, 92, 456, 4); g.font = "bold 30px Georgia, serif"; g.fillText(p.date ?? "", 256, 132, 440); g.font = "bold 38px Georgia, serif"; g.fillText(p.headline ?? "", 256, 196, 460);
      g.fillStyle = "#6b6358"; for (let col = 0; col < 3; col++) for (let r = 0; r < 26; r++) g.fillRect(34 + col * 154, 226 + r * 16, 136 - (r % 5 === 4 ? 50 : 0), 7);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.26, 8, 8), std({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
    { const q = paper.geometry.attributes.position; for (let i = 0; i < q.count; i++) q.setZ(i, 0.05 * Math.sin(q.getX(i) * 2.2) + 0.04 * Math.cos(q.getY(i) * 1.7)); paper.geometry.computeVertexNormals(); }
    paper.castShadow = true; paper.visible = false; scene.add(paper);
    const [fx, fy, fz] = p.from, [, ty, tz] = p.to;
    return {
      update(t) {
        const pu = api.ch("up", t), pd = api.ch("down", t);
        paper.visible = pu > 0 && pd < 1;
        paper.position.set(fx, fy + (ty - fy) * pu - (p.sink ?? 3.4) * pd, fz + (tz - fz) * pu);
        paper.rotation.set(-0.25 + 0.15 * Math.sin(t * 1.3), 0.25 * (1 - pu) + 0.06 * Math.sin(t * 0.9), 0.08 * Math.sin(t * 1.1));
        paper.scale.setScalar(Math.max(0.001, api.ch("pop", t) * (1 - pd)));
      },
    };
  },

  /** a book (cover text) that rises out of the ground and sinks back (kit paperProp); channels: up, down (steps) */
  book(ctx, p, api) {
    const b = paperProp(ctx, p);
    // (a book whose "up" never comes stays away: no cue was a stopped page)
    return { update(t) { const u = api.cue("up"), d = api.cue("down"); b.update(t, u ? u.t0 : Infinity, p.from, p.to, d ? d.t0 : Infinity, p.rot); } };
  },

  /** a flag that pops in, gets a red "no" cross, then goes (kit flagProp); channels: show, cross, gone (steps) */
  flag(ctx, p, api) {
    const f = flagProp(ctx, p);
    return { update(t) { f.update(t, api.cue("show")?.t0 ?? Infinity, api.cue("cross")?.t0 ?? Infinity, api.cue("gone")?.t0 ?? Infinity); } };
  },

  /** bushes that pop in staggered (kit shrubs); channel: start (a step) */
  shrubs(ctx, p, api) {
    const s = shrubs(ctx, p.list, { mats: [api.mat("leaf"), api.mat("leaf2")] });
    return { update(t) { const c = api.cue("start"); if (c) s.update(t, c.t0, p.stagger ?? 0.09); } };
  },

  /** the end card sign (kit endSign); channel: pop (a step at signPop) */
  sign(ctx, p, api) {
    const s = endSign(ctx, p);
    return { update(t) { s.update(t, api.cue("pop").t0, api.endCard); } };
  },

  /** a crack that grows across a wall (kit crack); channel: grow */
  crack(ctx, p, api) {
    const c = crack(ctx, p.points, { r: p.r });
    return { update(t) { c.set(api.ch("grow", t)); } };
  },

  /** mud lumps dropping onto a surface and stopping there; channels: fall (each lump offset by its own delay), gone */
  drops(ctx, p, api) {
    const { THREE, scene, rnd } = ctx;
    const N = p.count ?? 22, im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), api.mat(p.mat ?? "mud"), N); im.renderOrder = 4; scene.add(im);
    const data = Array.from({ length: N }, (_, i) => ({ x: p.x0 + 0.6 + (i + rnd() * 0.6) * (p.x1 - p.x0 - 1.2) / N, ph: rnd() * 0.35, s: (p.size ?? 1) * (0.07 + rnd() * 0.04) }));
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
    return {
      update(t) {
        const c = api.cue("fall"), on = 1 - api.ch("gone", t);
        data.forEach((d, i) => { const u = c ? rampU(c, t, d.ph) : 0; const y = (p.fromY ?? 0.7) + (p.landY + d.s - (p.fromY ?? 0.7)) * eIn(u); const k = u > 0 ? d.s * on : 0; im.setMatrixAt(i, m4.compose(v4.set(d.x, y, p.z ?? 0.16), q4, s4.set(k, k * (u >= 1 ? 0.7 : 1), k))); });
        im.instanceMatrix.needsUpdate = true;
      },
    };
  },

  // ================= water, gravel, fills =================

  /** water filling a cut (a flooded ditch, a pond, a pool); channels: flood (0..1 of its height; drain takes it down),
   *  gone (a step: hidden after), dirty / clean (still water going algae green, or dirtyColor, and clear again) */
  water(ctx, p, api) {
    // its own copy of the material only when this plan turns it green (so it never tints other water; the premade
    // videos' water keeps the shared material exactly as approved)
    const tints = Boolean(api.cue("dirty") || api.cue("clean")), shared = api.mat(p.mat ?? "water");
    const mat = tints ? shared.clone() : shared, base = mat.color.clone(), dirtyC = new ctx.THREE.Color(typeof p.dirtyColor === "string" ? p.dirtyColor : "#4e7d2c");
    const w = fillBlock(ctx, { ...p.box, mat, r: p.r ?? 0.02, castShadow: false });
    w.mesh.renderOrder = 2;
    return {
      mesh: w.mesh, top: w.top,
      update(t) {
        const gravK = p.gravel ? api.other(p.gravel, "fill", t) : 0;
        w.set(clamp01(api.ch("flood", t)) * (1 - 0.5 * gravK)); // as gravel fills the cut, the water sinks into it
        if (tints) mat.color.copy(base).lerp(dirtyC, clamp01(api.ch("dirty", t) - api.ch("clean", t)));
        const gone = api.cue("gone"); if (gone && t >= gone.t0) w.mesh.visible = false;
      },
    };
  },

  /** a gravel fill with real pebbles on its section, stones pouring in, a water level inside, and a lift (to lay a pipe
   *  under it); channels: fill, lift, squash, drain (the water level going down), pour (when the stones fall) */
  gravel(ctx, p, api) {
    const { THREE, mergeVertices } = ctx;
    const g = fillBlock(ctx, { ...p.box, mat: api.mat(p.mat ?? "gravel"), r: 0.04 });
    const stoneGeo = stoneGeometry(ctx);
    const face = pebbles(ctx, { ...p.faceBox, mat: api.mat(p.pebbleMat ?? "pebbles"), geo: stoneGeo });
    const stones = pour(ctx, { ...p.pourBox, yFrom: p.pourFrom ?? 6.5, count: p.pourCount ?? 260, geo: stoneGeo, mat: api.mat("stones"), size: [0.09, 0.19] });
    const wet = api.wetter(p.mat ?? "gravel") ?? noWet, wetP = api.wetter(p.pebbleMat ?? "pebbles") ?? noWet;
    const depth = -p.box.y0;
    return {
      top: g.top,
      update(t) {
        const gravK = api.ch("fill", t), lift = api.ch("lift", t), squash = api.ch("squash", t);
        g.set(gravK * (1 - squash)); g.lift(lift);
        const flood = p.water ? api.other(p.water, "flood", t) : 0, lvl = flood * (1 - 0.5 * gravK);
        const wy = Math.max(-depth - 0.1, p.waterTop - (1 - lvl) * p.waterSpan - p.drainDrop * api.ch("drain", t));
        wet.set(wy + lift, gravK > 0.02 ? 1 : 0); wetP.set(wy + lift, gravK > 0.02 ? 1 : 0);
        face.set(g.top(), lift, gravK > 0.01 ? 1 : 0);
        if (p.water) { const w = api.part(p.water).obj; w.mesh.visible = w.mesh.visible && (gravK < 0.02 || w.top() > g.top() + 0.01 || lift > 0.05); }
        const c = api.cue("pour"); if (c) stones.update(t, c.t0, c.t1, () => g.top() + 0.05);
      },
    };
  },

  /** a gravel soak pit in the cut face with pebbles and a water level; channels: grow, wetY, wetOn */
  soakPit(ctx, p, api) {
    const w = wipeBlock(ctx, { ...p.box, mat: api.mat(p.mat ?? "gravelPit"), axis: "y", r: 0.05 });
    const face = pebbles(ctx, { ...p.faceBox, mat: api.mat(p.pebbleMat ?? "pebblesPit"), geo: stoneGeometry(ctx) });
    const wet = api.wetter(p.mat ?? "gravelPit") ?? noWet, wetP = api.wetter(p.pebbleMat ?? "pebblesPit") ?? noWet;
    return {
      update(t) {
        const k = api.ch("grow", t); w.set(k); face.set(p.box.y0 + (p.box.y1 - p.box.y0) * k, 0, k > 0.01 ? 1 : 0);
        const y = api.ch("wetY", t), on = api.ch("wetOn", t) > 0.5 ? 1 : 0; wet.set(y, on); wetP.set(y, on);
      },
    };
  },

  /** a block that wipes in along an axis (a soil cap, a grass strip) (kit wipeBlock); channel: grow */
  wipe(ctx, p, api) {
    const w = wipeBlock(ctx, { ...p.box, mat: api.mat(p.mat), axis: p.axis ?? "x", r: p.r ?? 0.06, uvScale: p.uvScale ?? 0.5 });
    return { update(t) { w.set(api.ch("grow", t)); } };
  },

  /** filter fabric wrapping a fill (kit wrapSheet); channel: start (a step) */
  wrap(ctx, p, api) {
    const s = wrapSheet(ctx, p.box, { ...p.opts, mat: api.mat(p.mat ?? "fabric") });
    return { update(t) { const c = api.cue("start"); s.update(t, c ? c.t0 : Infinity); } };
  },

  /** a perforated (or solid) pipe along a path, grown at constant speed (kit pipePath); channel: grow */
  pipe(ctx, p, api) {
    const k = pipePath(ctx, p.path, p.opts ?? {});
    return { kit: k, length: k.length, update(t) { k.grow(k.length * api.ch("grow", t)); } };
  },

  /** water dots running inside a kit pipe; channel: on */
  pipeFlow(ctx, p, api) {
    const f = api.part(p.pipe).obj.kit.flow(p.opts ?? {});
    return { update(t) { f.update(t, api.ch("on", t), p.speed ?? 3.4); } };
  },

  /** flat water patches that spread and dry up (kit puddle); channels: rise, fall (staggered per puddle) */
  puddles(ctx, p, api) {
    const list = p.list.map(([x, z, rx, rz]) => puddle(ctx, { x, z, rx, rz, mat: api.mat(p.mat ?? "puddle") }));
    const rs = p.rise ?? [0.3, 0.2], fs = p.fall ?? [0.2, 0];
    return {
      update(t) {
        const r = api.cue("rise"), f = api.cue("fall");
        list.forEach((q, i) => q.set((r ? shifted(r, t, i * rs[0], i * rs[1]) : 0) * (1 - (f ? shifted(f, t, i * fs[0], i * fs[1]) : 0))));
      },
    };
  },

  // ================= weather, light, soil =================

  rain(ctx, p, api) { const r = rain(ctx, p); return { update(t) { r.update(t, api.ch("on", t)); } }; },
  stream(ctx, p, api) { const r = stream(ctx, p); return { update(t) { r.update(t, api.ch("on", t)); } }; },

  /** the sun, sky and environment: a quick dip ("decades later"), an overcast storm, and night ("at 3 a.m.": the sun
   *  down, the sky dark, every lamp and lens glowing against it); channels: dip, storm, night */
  light(ctx, p, api) {
    const { sun, hemi, scene } = ctx;
    const base = { sun: sun.intensity, hemi: hemi?.intensity ?? 0, env: 1.0, bg: scene.backgroundIntensity ?? 1 };
    return {
      update(t) {
        const dip = api.ch("dip", t), k = api.ch("storm", t), nt = Math.min(1, Math.max(0, api.ch("night", t)));
        sun.intensity = base.sun * (1 - 0.75 * dip) * (1 - 0.72 * k) * (1 - 0.9 * nt);
        if (hemi) hemi.intensity = base.hemi * (1 - 0.55 * dip) * (1 - 0.3 * k) * (1 - 0.7 * nt);
        scene.environmentIntensity = base.env * (1 - 0.6 * dip) * (1 - 0.42 * k) * (1 - 0.75 * nt);
        if (k > 0 || p.storm || nt > 0 || p.night) scene.backgroundIntensity = base.bg * (1 - 0.5 * k) * (1 - 0.8 * nt);
      },
    };
  },

  /** the lawn going dark and wet in the rain; channel: amount */
  lawnWet(ctx, p, api) { return { update(t) { ctx.WET_LAWN.value = api.ch("amount", t); } }; },

  /** liquid seeping down the cut face (two seeps) and clouding the groundwater; channels: y1, a1, y2, a2, murk, murkA */
  soilLeak(ctx, p, api) {
    const U = ctx.soilU;
    // the groundwater film clouds where the seep reaches it (the landfill's murk)
    if (ctx.waterMesh) ctx.waterMesh.material.onBeforeCompile = (sh) => { sh.uniforms.uMurk = U.uMurk; sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW2;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW2 = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vW2; uniform vec3 uMurk;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat md = abs(vW2.x - uMurk.x) + (-11.0 - vW2.y) * 0.6; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.24, 0.07), clamp((uMurk.y - md) / 2.0, 0.0, 1.0) * uMurk.z);"); };
    return {
      update(t) {
        U.uLeak.value.set(p.x1 ?? 3.0, api.ch("y1", t), api.ch("a1", t), 0);
        U.uLeak2.value.set(p.x2 ?? 1.4, api.ch("y2", t), api.ch("a2", t), 0);
        U.uMurk.value.set(p.murkX ?? 0, Math.max(0, api.ch("murk", t)), api.ch("murkA", t));
      },
    };
  },

  /** a dark wet band in the soil around a cut; channel: amount */
  wetBand(ctx, p, api) { return { update(t) { ctx.soilU.uWet.value.set(p.cx, p.halfW, p.bottom, api.ch("amount", t)); } }; },

  /** water soaking down from a soak pit toward the groundwater; channels: front (its lowest y), on */
  soak(ctx, p, api) { return { update(t) { ctx.soilU.uSoak.value.set(p.x0, p.x1, p.top, api.ch("front", t)); ctx.soilU.uSoakOn.value = api.ch("on", t); } }; },

  // ================= the explainer layer =================

  /** pulsing arrows (in the face, or flat on a surface) (kit arrows); channel: on */
  arrows(ctx, p, api) { const a = arrows(ctx, p.list, p.opts ?? {}); return { update(t) { a.update(t, api.ch("on", t)); } }; },

  /** a glowing outline traced around a named part (kit outline); channel: on */
  outline(ctx, p, api) { const o = outline(ctx, p.points, p.opts ?? {}); return { update(t) { o.update(t, api.ch("on", t)); } }; },

  /** murky dots seeping down the cut face and spreading in the groundwater; channel: on */
  seepFlow(ctx, p, api) {
    const { THREE, scene, rnd } = ctx;
    const N = p.count ?? 70, im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), api.mat("seepDots"), N); im.renderOrder = 4; scene.add(im);
    const data = Array.from({ length: N }, () => ({ x: (rnd() - 0.5) * (p.width ?? 4.4), ph: rnd(), side: rnd() < 0.5 ? -1 : 1, spread: 2 + rnd() * 8, s: 0.08 + rnd() * 0.09 }));
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
    const y0 = p.y0 ?? -6.2, fall = p.fall ?? 6.2, floor = p.floor ?? -11.2;
    return {
      update(t) {
        const on = api.ch("on", t);
        data.forEach((d, i) => { const ph = (t * 0.55 + d.ph) % 1; let x = d.x * (1 - ph * 0.2), y = y0 - ph * fall; if (y < floor) { const k = (floor - y) / 1.2; y = floor - k * 0.6; x = d.x + d.side * d.spread * k; } const s = on > 0.01 ? d.s * (0.6 + 0.4 * Math.sin(ph * Math.PI)) * on : 0; im.setMatrixAt(i, m4.compose(v4.set(x, y, 0.12), q4.identity(), s4.set(s, s, s))); });
        im.instanceMatrix.needsUpdate = true;
      },
    };
  },
};

// The channels each kind reads (for the format check and the planner's instructions).
export const KIND_CHANNELS = {
  ...VENDING_CHANNELS,
  ...CITY_CHANNELS,
  rig: ["pop"], // and one channel per move of its recipe (rig.js rigChannels)
  ...CLARITY_CHANNELS,
  dig: ["dig", "refill"], panels: ["*"], box: [], bags: ["drop", "lift", "raise"], dumpTruck: ["z", "tip", "load"],
  pipeRun: ["grow"], pipeRunFlow: ["on"], tank: ["pop"], riser: ["grow"], boxPop: ["pop"], flare: ["pop"], bubbles: ["on"], machine: ["pop"],
  fence: ["pop", "rails"], youngTrees: ["pop"], sheet: ["up", "down", "pop"], book: ["up", "down"], flag: ["show", "cross", "gone"], shrubs: ["start"], sign: ["pop"], crack: ["grow"], drops: ["fall", "gone"],
  water: ["flood", "gone", "dirty", "clean"], gravel: ["fill", "lift", "squash", "drain", "pour"], soakPit: ["grow", "wetY", "wetOn"], wipe: ["grow"], wrap: ["start"], pipe: ["grow"], pipeFlow: ["on"], puddles: ["rise", "fall"],
  rain: ["on"], stream: ["on"], light: ["dip", "storm", "night"], lawnWet: ["amount"], soilLeak: ["y1", "a1", "y2", "a2", "murk", "murkA"], wetBand: ["amount"], soak: ["front", "on"],
  arrows: ["on"], outline: ["on"], seepFlow: ["on"],
};
