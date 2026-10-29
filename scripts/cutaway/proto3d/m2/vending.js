// M2 kit: a vending machine, cut open on its right side so the viewer sees the coils, the motors, the coin chute, the
// bin and the cooler. It stands on the lawn facing the camera (+z). Local frame: base centre at `pos`, front at +z.
// Channels (all 0..1 unless noted):
//   show (the cabinet pops in), snacks (they pop onto the shelves), slot (coin slot + keypad), steal (a snack is
//   taken out of the open box), glass (the glass front slides up), coils (the spirals appear), coin (a coin goes in
//   and down the chute), spinA / spinB (turns of the two vending coils, any number), fallA / fallB (the front snack of
//   that coil falls to the bin), beam (the drop sensor's light beam), cooler (compressor + condenser pop in), light
//   (the lit header)
// and miniMachines: a crowd of small drink machines popping up across the lawn; channels pop, gone.

const W = 2.0, H = 3.2, D = 1.5;               // the cabinet
const GX0 = -0.92, GX1 = 0.42;                 // the glass area (x); the coin panel sits right of it
const COLS = [-0.73, -0.39, -0.05, 0.27], ROWS = [2.55, 2.0, 1.45, 0.92]; // coil centres (x) and shelf heights (y)
const CZ0 = -0.6, CZ1 = 0.52, PITCH = 0.22, CR = 0.13; // coil from back to front, its pitch and radius
const EDGE = 0.56;                              // the shelf's front edge (z)
const SNACK_Z = [0.4, 0.18, -0.04, -0.26];      // snacks between the coil loops, front first
const COLORS = ["#f2c230", "#e8572d", "#2f7de0", "#38b04a", "#9b4fd1", "#f08a24", "#e23b6a", "#22b8c8"];
const A = { row: 1, col: 1 }, B = { row: 0, col: 2 }, STEAL = { row: 2, col: 0 };

function label(THREE, text, w = 1024, h = 180, bg = "#fff6d8", fg = "#c0302a") {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  // too long a label is made smaller evenly, never squeezed (kit/signText.js)
  const font = (px) => `900 ${px}px 'Arial Black', Arial, sans-serif`;
  let px = Math.round(h * 0.62); g.font = font(px); const tw = g.measureText(text).width; if (tw > w * 0.92) px = Math.floor((px * w * 0.92) / tw);
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font(px); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function vendingMachine(ctx, p, api) {
  const { THREE, scene, std, phys, C, RoundedBoxGeometry } = ctx;
  const root = new THREE.Group(); root.position.set(...(p.pos ?? [0, 0.02, -1.3])); root.rotation.y = p.rotY ?? 0; scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const add = (parent, geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const rb = (sx, sy, sz, r = 0.03) => new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sx * 0.45, sy * 0.45, sz * 0.45));
  const red = phys({ color: C(p.color ?? "#cf3a32"), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const cutEdge = std({ color: C("#f3e3c2"), roughness: 0.7 });
  const inner = std({ color: C("#8b929b"), roughness: 0.75 });
  const steel = std({ color: C("#c9ced4"), roughness: 0.28, metalness: 0.85 });
  const dark = std({ color: C("#1c1f24"), roughness: 0.6 });
  // the cabinet: back, left side, top, bottom, kick plate; the right side is cut away (a pale cut edge shows where)
  add(body, rb(W, H, 0.08), red, 0, H / 2, -D / 2 + 0.04);
  add(body, rb(0.08, H, D), red, -W / 2 + 0.04, H / 2, 0);
  add(body, rb(W, 0.1, D), red, 0, H - 0.05, 0);
  add(body, rb(W, 0.12, D), red, 0, 0.06, 0);
  add(body, rb(0.06, H, 0.06), cutEdge, W / 2 - 0.03, H / 2, D / 2 - 0.03);
  add(body, rb(0.06, H, 0.06), cutEdge, W / 2 - 0.03, H / 2, -D / 2 + 0.03);
  add(body, rb(0.06, 0.06, D), cutEdge, W / 2 - 0.03, H - 0.03, 0);
  add(body, rb(0.06, 0.06, D), cutEdge, W / 2 - 0.03, 0.03, 0);
  add(body, new THREE.BoxGeometry(W - 0.16, H - 0.2, 0.02), inner, 0, H / 2, -D / 2 + 0.09, false);
  // the front frame around the glass, the coin panel, the bin flap
  add(body, rb(W, 0.42, 0.1), red, 0, H - 0.21, D / 2 - 0.05);             // header (the light goes on it)
  add(body, rb(W, 0.62, 0.1), red, 0, 0.31, D / 2 - 0.05);                 // below the glass, around the bin
  add(body, rb(0.1, H, 0.1), red, -W / 2 + 0.05, H / 2, D / 2 - 0.05);
  add(body, rb(0.5, H - 1.0, 0.1), red, 0.71, 0.62 + (H - 1.0) / 2, D / 2 - 0.05);
  // shelves (thin trays)
  for (const y of ROWS) add(body, rb(GX1 - GX0, 0.035, 1.25, 0.01), steel, (GX0 + GX1) / 2, y - CR - 0.03, -0.03);
  // the bin: a dark opening behind a clear flap, at the bottom front
  const bin = add(body, new THREE.BoxGeometry(GX1 - GX0, 0.34, 0.5), dark, (GX0 + GX1) / 2, 0.36, 0.42, false);
  const flap = add(body, new THREE.BoxGeometry(GX1 - GX0 - 0.1, 0.3, 0.02), phys({ color: C("#cfe0ee"), transparent: true, opacity: 0.35, roughness: 0.05 }), (GX0 + GX1) / 2, 0.38, D / 2 + 0.012, false);
  // a light inside, so the cut-open side reads
  const inLight = new THREE.PointLight(0xfff4e0, 3.5, 3.2, 1.5); inLight.position.set(0.55, 1.8, 0.1); body.add(inLight);
  body.scale.setScalar(0);

  // snacks on every coil
  const snackGeo = rb(0.22, 0.3, 0.1, 0.02);
  const snacks = [];
  ROWS.forEach((y, r) => COLS.forEach((x, c) => {
    const list = SNACK_Z.map((z, k) => { const m = add(body, snackGeo, std({ color: C(COLORS[(r * 4 + c + k * 3) % COLORS.length]), roughness: 0.45 }), x, y + 0.01, z); m.scale.setScalar(0); return { m, z0: z, k }; });
    snacks.push({ r, c, list, x, y });
  }));
  const coilOf = (rc) => snacks.find((s) => s.r === rc.row && s.c === rc.col);
  // the coils (helices along z) and their motors at the back
  const helix = (() => { const pts = []; const turns = (CZ1 - CZ0) / PITCH; for (let i = 0; i <= 160; i++) { const u = i / 160, a = u * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * CR, Math.sin(a) * CR, CZ0 + u * (CZ1 - CZ0))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.018, 8, false); })();
  const coils = [], motors = [];
  for (const s of snacks) {
    const g = new THREE.Group(); g.position.set(s.x, s.y, 0); body.add(g);
    const m = new THREE.Mesh(helix, steel); m.castShadow = true; g.add(m); g.scale.setScalar(0.001); g.visible = false;
    coils.push({ g, s });
    const mo = add(body, new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16), dark, s.x, s.y, CZ0 - 0.07); mo.rotation.x = Math.PI / 2; mo.scale.setScalar(0);
    motors.push(mo);
  }
  // the glass front, sliding up from the bottom
  const glassG = new THREE.PlaneGeometry(GX1 - GX0, ROWS[0] - ROWS[3] + 0.75); glassG.translate(0, (ROWS[0] - ROWS[3] + 0.75) / 2, 0);
  const glass = add(body, glassG, std({ color: C("#e6f1fa"), transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false }), (GX0 + GX1) / 2, 0.62, D / 2 - 0.02, false);
  glass.renderOrder = 3; glass.visible = false;
  // the coin slot, keypad and the coin with its chute
  const slotG = new THREE.Group(); slotG.position.set(0.71, 1.95, D / 2 + 0.005); body.add(slotG); slotG.scale.setScalar(0);
  add(slotG, rb(0.3, 0.5, 0.04), dark, 0, 0, 0);
  add(slotG, rb(0.05, 0.16, 0.05), steel, 0.06, 0.12, 0.02);
  for (let i = 0; i < 9; i++) add(slotG, rb(0.07, 0.05, 0.03, 0.01), std({ color: C("#e9e4d8"), roughness: 0.5 }), -0.08 + (i % 3) * 0.08, -0.06 - Math.floor(i / 3) * 0.08, 0.025);
  const chute = add(body, new THREE.CylinderGeometry(0.035, 0.035, 1.2, 10), std({ color: C("#9aa1aa"), roughness: 0.4, metalness: 0.5 }), 0.77, 1.3, 0.55); chute.scale.setScalar(0);
  const coinBox = add(body, rb(0.24, 0.2, 0.24), dark, 0.77, 0.62, 0.45); coinBox.scale.setScalar(0);
  const coin = add(body, new THREE.CylinderGeometry(0.06, 0.06, 0.014, 24), phys({ color: C("#e7c04a"), roughness: 0.25, metalness: 1 }), 0, 0, 0); coin.visible = false;
  const coinPath = [[0.77, 2.07, D / 2 + 0.6], [0.77, 2.07, D / 2 + 0.02], [0.77, 1.9, 0.55], [0.77, 0.72, 0.45]].map((q) => new THREE.Vector3(...q));
  // the drop sensor: a red beam across the top of the bin
  const beam = add(body, new THREE.BoxGeometry(GX1 - GX0 - 0.04, 0.016, 0.016), new THREE.MeshBasicMaterial({ color: "#ff2b2b", transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), (GX0 + GX1) / 2, 0.6, 0.6, false);
  beam.renderOrder = 6; beam.visible = false;
  const beamEyes = [GX0 + 0.01, GX1 - 0.01].map((x) => { const e = add(body, rb(0.05, 0.07, 0.05, 0.01), dark, x, 0.6, 0.6); e.scale.setScalar(0); return e; });
  // the cooler: compressor and a zigzag condenser in the bottom back, a fan
  const cool = new THREE.Group(); body.add(cool); cool.scale.setScalar(0);
  add(cool, new THREE.CylinderGeometry(0.17, 0.17, 0.3, 24), dark, 0.25, 0.32, -0.42);
  { const pts = []; for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(-0.75 + i * 0.12, 0.2 + (i % 2) * 0.32, -0.62)); add(cool, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0), 120, 0.025, 8, false), std({ color: C("#3a86e0"), roughness: 0.35, metalness: 0.4 }), 0, 0, 0); }
  const fan = new THREE.Group(); fan.position.set(0.62, 0.36, -0.42); cool.add(fan);
  for (let i = 0; i < 4; i++) { const b = add(fan, new THREE.BoxGeometry(0.04, 0.26, 0.015), steel, 0, 0, 0); b.rotation.z = (i * Math.PI) / 2; }
  // the lit header
  const head = add(body, new THREE.PlaneGeometry(W - 0.3, 0.3), new THREE.MeshStandardMaterial({ map: label(THREE, p.header ?? "SNACKS & DRINKS"), emissive: new THREE.Color("#fff3c4"), emissiveIntensity: 0, roughness: 0.4 }), 0, H - 0.21, D / 2 + 0.006, false);
  const glow = new THREE.PointLight(0xffe7b0, 0, 4, 1.6); glow.position.set(0, H - 0.1, D / 2 + 0.5); body.add(glow);

  const pop = (k) => Math.max(0.001, k);
  return {
    update(t) {
      const show = api.ch("show", t); body.scale.setScalar(pop(show)); body.visible = show > 0.002;
      const sn = api.ch("snacks", t), coilsK = api.ch("coils", t);
      coils.forEach((c, i) => { c.g.visible = coilsK > 0.002; c.g.scale.setScalar(pop(coilsK)); motors[i].scale.setScalar(pop(coilsK)); });
      const steal = api.ch("steal", t);
      const spin = { A: api.ch("spinA", t), B: api.ch("spinB", t) }, fall = { A: api.ch("fallA", t), B: api.ch("fallB", t) };
      for (const s of snacks) {
        const which = s === coilOf(A) ? "A" : s === coilOf(B) ? "B" : null, turns = which ? spin[which] : 0;
        if (which) coils.find((c) => c.s === s).g.rotation.z = -turns * Math.PI * 2;
        for (const q of s.list) {
          const k = Math.max(0, Math.min(1, sn * 4 - q.k * 0.5 - (s.r * 4 + s.c) * 0.04));
          q.m.scale.setScalar(pop(k)); q.m.visible = k > 0.002;
          let z = q.z0 + turns * PITCH, y = s.y + 0.01, rx = 0;
          if (z > EDGE - 0.05) { const lean = Math.min(1, (z - (EDGE - 0.05)) / 0.12); rx = lean * 0.65; y -= lean * 0.06; }
          if (which && q.k === 0) {
            const f = fall[which];
            if (f > 0) { const e = f * f; z = Math.max(z, EDGE + 0.06); y = s.y + (0.28 - s.y) * e; rx = 0.65 + f * 2.2; z += f * 0.02; }
          }
          if (s === coilOf(STEAL) && q.k === 0 && steal > 0) { z = q.z0 + steal * 1.6; y = s.y + Math.sin(steal * Math.PI) * 0.5 + steal * 0.3; rx = -steal * 3; q.m.position.x = s.x + steal * 2.4; q.m.visible = steal < 0.98; }
          else q.m.position.x = s.x;
          q.m.position.set(q.m.position.x, y, z); q.m.rotation.set(rx, 0, 0);
        }
      }
      const gl = api.ch("glass", t); glass.visible = gl > 0.002; glass.scale.y = pop(gl); flap.visible = gl > 0.5;
      const sl = api.ch("slot", t); slotG.scale.setScalar(pop(sl)); chute.scale.setScalar(pop(sl)); coinBox.scale.setScalar(pop(sl));
      const cn = api.ch("coin", t);
      coin.visible = cn > 0 && cn < 1;
      if (coin.visible) { const seg = Math.min(2.999, cn * 3), i = Math.floor(seg), u = seg - i; coin.position.copy(coinPath[i]).lerp(coinPath[i + 1], u); coin.rotation.set(Math.PI / 2, 0, cn * 10); }
      const bm = api.ch("beam", t); beam.visible = bm > 0.01; beam.material.opacity = Math.min(1, bm) * (0.75 + 0.25 * Math.sin(t * 14)); beamEyes.forEach((e) => e.scale.setScalar(pop(Math.min(1, bm * 3))));
      const co = api.ch("cooler", t); cool.scale.setScalar(pop(co)); fan.rotation.z = t * 9;
      const li = api.ch("light", t); head.material.emissiveIntensity = li * 0.9; glow.intensity = li * 6;
    },
  };
}

/** a crowd of small drink machines popping up across the lawn (the "how many" beat); channels pop, gone */
export function miniMachines(ctx, p, api) {
  const { THREE, scene, std, C, RoundedBoxGeometry, rnd } = ctx;
  const cols = ["#cf3a32", "#2f7de0", "#f2f2ee", "#38b04a", "#f2c230"];
  const items = [];
  const [x0, x1, z0, z1] = p.area ?? [-12, 12, -16, -5];
  const n = p.count ?? 60;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); let x = x0 + rnd() * (x1 - x0); const z = z0 + rnd() * (z1 - z0); if (p.avoid && x > p.avoid[0] && x < p.avoid[1]) x = x < (p.avoid[0] + p.avoid[1]) / 2 ? p.avoid[0] - 0.5 - rnd() : p.avoid[1] + 0.5 + rnd(); g.position.set(x, p.y ?? 0, z); g.rotation.y = (rnd() - 0.5) * 0.5; scene.add(g);
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.2, 0.5, 2, 0.05), std({ color: C(cols[i % cols.length]), roughness: 0.4 })); m.position.y = 0.6; m.castShadow = true; g.add(m);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), std({ color: C("#dbeaf5"), roughness: 0.1, emissive: C("#cfe6ff"), emissiveIntensity: 0.25 })); w.position.set(-0.05, 0.7, 0.26); g.add(w);
    g.scale.setScalar(0.001); g.visible = false;
    items.push({ g, d: rnd() });
  }
  return {
    update(t) {
      const c = api.cue("pop"), gone = api.ch("gone", t);
      for (const it of items) {
        let k = 0;
        if (c) { const a = c.t0 + it.d * Math.max(0.01, c.t1 - c.t0 - 0.35), u = Math.min(1, Math.max(0, (t - a) / 0.35)); k = u <= 0 ? 0 : u >= 1 ? 1 : 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2; }
        k *= 1 - gone;
        it.g.visible = k > 0.002; it.g.scale.setScalar(Math.max(0.001, k));
      }
    },
  };
}

export const VENDING_CHANNELS = { vendingMachine: ["show", "snacks", "slot", "steal", "glass", "coils", "coin", "spinA", "fallA", "spinB", "fallB", "beam", "cooler", "light"], miniMachines: ["pop", "gone"] };
// world-space boxes of the machine's regions (for shots), from its position
export function vendingBoxes(pos = [0, 0.02, -1.3]) {
  const [px, py, pz] = pos, b = (x0, y0, z0, x1, y1, z1) => ({ min: [px + x0, py + y0, pz + z0], max: [px + x1, py + y1, pz + z1] });
  return {
    whole: b(-W / 2, 0, -D / 2, W / 2, H, D / 2),
    glass: b(GX0, ROWS[3] - 0.2, -0.6, GX1, ROWS[0] + 0.25, D / 2),
    coilA: b(COLS[A.col] - 0.3, ROWS[A.row] - 0.35, -0.6, COLS[A.col] + 0.3, ROWS[A.row] + 0.3, D / 2),
    coilB: b(COLS[B.col] - 0.3, ROWS[B.row] - 0.35, -0.6, COLS[B.col] + 0.3, ROWS[B.row] + 0.3, D / 2),
    slot: b(0.4, 1.6, 0, 1.0, 2.3, D / 2 + 0.3),
    coinRun: b(COLS[A.col] - 0.3, 0.4, -0.6, 1.0, 2.35, D / 2 + 0.3),
    bin: b(GX0, 0.1, 0, GX1, 1.3, D / 2 + 0.1),
    cooler: b(-W / 2, 0, -D / 2, W / 2, 0.9, D / 2),
    outlineA: [[COLS[A.col] - 0.2, ROWS[A.row] - 0.2], [COLS[A.col] + 0.2, ROWS[A.row] + 0.2]].map(([x, y]) => [px + x, py + y]),
  };
}
