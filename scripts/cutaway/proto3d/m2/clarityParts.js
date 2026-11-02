// M2 kit: parts that make a sentence's action visible at phone size (the owner's car wash review, 2026-10-23):
//   settle   a tank in section where things separate: murky water fills it, sand grains sink and pile up on the floor,
//            a dark oil layer rises to the top, the water clears. channels: show (the tank walls), fill, sand, oil, clear
//   creek    a creek on the ground: banks, water with ripples that drift downstream; it can turn dirty (soap, oil)
//            and clean again. channels: show, dirty, clean
//   flow     blobs moving along any path (water running down a slope, sludge pouring through a drain, soap down a pipe),
//            over a faint ribbon that shows the route. channels: on, off
//   prop     a finishing-touch prop that belongs in its setting (setting lists in catalog.js SETTING_PROPS): kiosk,
//            vacuum, towelRack, trashCan, planter, bench, bikeRack, mailbox, pottedPlant, toolbox. channel: pop
//   canopy   a roof that always stands on its posts (never floats). channels: posts (they grow up), roof (it pops on)
const pop = (k) => Math.max(0.001, k);
// a colour setting only when it is one (a planner wrote murky: true, which three.js turned into white)
const col = (v, d) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : d);
const clamp = (v) => Math.min(1, Math.max(0, v));
const back = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2);

function tools(ctx) {
  const { THREE, std, C } = ctx;
  const add = (parent, geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const boxG = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const mat = (col, o = {}) => std({ color: C(col), roughness: 0.6, ...o });
  return { THREE, add, boxG, mat, C };
}

export function settle(ctx, p, api) {
  const { THREE, add, boxG, mat, C } = tools(ctx);
  const b = p.box ?? { x0: -1.5, x1: 1.5, y0: -3, y1: -0.6, z0: -2, z1: 0 };
  const W = b.x1 - b.x0, H = b.y1 - b.y0, D = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const root = new THREE.Group(); ctx.scene.add(root);
  // concrete by default; a plastic basin (a sump pit) with wallColor; open at the top unless lid: true (the contents must read)
  const wall = col(p.wallColor) ? mat(col(p.wallColor), { roughness: 0.45 }) : api.mat?.("concrete") ?? mat("#b9b4aa"), t = col(p.wallColor) ? 0.1 : 0.14;
  const walls = new THREE.Group(); root.add(walls);
  add(walls, boxG(W + 2 * t, t, D), wall, cx, b.y0 - t / 2, cz); // floor
  add(walls, boxG(t, H, D), wall, b.x0 - t / 2, b.y0 + H / 2, cz); add(walls, boxG(t, H, D), wall, b.x1 + t / 2, b.y0 + H / 2, cz); // sides
  add(walls, boxG(W + 2 * t, H, t), wall, cx, b.y0 + H / 2, b.z0 - t / 2); // back
  if (p.lid === true) add(walls, boxG(W + 2 * t, t, D), wall, cx, b.y1 + t / 2, cz); // lid (off by default)
  // the water: murky brown that clears to blue
  const murky = new THREE.Color(col(p.murky, "#6b5a3a")), clear = new THREE.Color(col(p.clearColor, "#3d8fd6"));
  const waterM = ctx.std({ color: murky.clone(), roughness: 0.15, transparent: true, opacity: 0.82 });
  // the layers never share a face (shared faces flickered as a sawtooth): each inset from the walls by its own amount, and
  // stacked with small gaps, sand bed, water, oil
  const water = add(root, boxG(W - 0.04, 1, D - 0.04), waterM, cx, b.y0, cz - 0.01, false);
  // sand: grains spread through the water that sink and pile up as a layer on the floor
  const sandM = mat(col(p.sandColor, "#d8b56a"), { roughness: 0.9 }), N = p.grains ?? 70, grains = [];
  for (let i = 0; i < N; i++) {
    const s = add(root, new THREE.SphereGeometry(0.07 + ((i * 7) % 5) * 0.012, 8, 6), sandM, 0, 0, 0, false);
    grains.push({ s, x: b.x0 + 0.15 + ((i * 37) % 97) / 97 * (W - 0.3), y: b.y0 + 0.3 + ((i * 53) % 89) / 89 * (H * 0.75), z: b.z1 - 0.12 - ((i * 13) % 7) / 7 * Math.min(0.6, D * 0.6), d: ((i * 29) % 31) / 31 });
  }
  // the bed and the top layer reach the cut face, in front of the water (seen through 80% water they washed out)
  const sandBed = add(root, boxG(W - 0.08, 1, D + 0.02), sandM, cx, b.y0, cz + 0.01, false);
  // oil: dark droplets that rise, and a dark layer on top
  // the top layer (oil, scum): near black and glossy, so it reads against the water and the walls
  const oilM = ctx.phys ? ctx.phys({ color: C(col(p.oilColor, "#14100c")), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }) : mat("#14100c"), drops = [];
  for (let i = 0; i < 26; i++) { const s = add(root, new THREE.SphereGeometry(0.09, 8, 6), oilM, 0, 0, 0, false); drops.push({ s, x: b.x0 + 0.2 + ((i * 41) % 83) / 83 * (W - 0.4), y: b.y0 + 0.4 + ((i * 23) % 61) / 61 * H * 0.5, z: b.z1 - 0.12 - ((i * 11) % 5) / 5 * 0.4, d: ((i * 17) % 19) / 19 }); }
  const oilLayer = add(root, boxG(W - 0.02, 1, D + 0.03), oilM, cx, b.y1, cz + 0.015, false);
  return {
    update(tt) {
      const sh = api.ch("show", tt); walls.visible = sh > 0.002; walls.scale.setScalar(pop(back(Math.min(1, sh))));
      const fill = api.cue("fill") ? clamp(api.ch("fill", tt)) : clamp(sh), level = H * fill;
      const sd = clamp(api.ch("sand", tt)), bed = H * 0.16 * sd;
      const ol = clamp(api.ch("oil", tt)), layer = Math.max(0.18, H * 0.18) * ol, top = b.y0 + level;
      // the water from just above the sand bed to just under the oil slab (its own top face, never the oil's)
      const w0 = b.y0 + (bed > 0.005 ? bed + 0.006 : 0.004), w1 = layer > 0.005 ? top - layer - 0.008 : top, wh = Math.max(0.001, w1 - w0);
      water.visible = fill > 0.01 && w1 > w0; water.scale.y = wh; water.position.y = w0 + wh / 2;
      const cl = clamp(api.ch("clear", tt)); waterM.color.copy(murky).lerp(clear, cl); waterM.opacity = 0.82 - 0.27 * cl;
      for (const g of grains) {
        const k = clamp((sd - g.d * 0.5) / 0.5); // each grain sinks over half the cue, staggered
        // (the grains show from the sand's own moment: before it, a tank full of drifting grains read as clutter)
        g.s.visible = fill > 0.3 && (!api.cue("sand") || sd > 0.001) && k < 0.98;
        g.s.position.set(g.x, g.y + (b.y0 + bed + 0.06 - g.y) * k * k, g.z);
      }
      sandBed.visible = bed > 0.005; sandBed.scale.y = Math.max(0.001, bed); sandBed.position.y = b.y0 + bed / 2;
      for (const d of drops) { const k = clamp((ol - d.d * 0.5) / 0.5); d.s.visible = fill > 0.3 && ol > 0.01 && k < 0.98; d.s.position.set(d.x, d.y + (top - layer - 0.05 - d.y) * k, d.z); }
      oilLayer.visible = layer > 0.005 && fill > 0.3; oilLayer.scale.y = Math.max(0.001, layer); oilLayer.position.y = top - layer / 2;
    },
  };
}

export function creek(ctx, p, api) {
  if (p.axis === "z") return stream(ctx, p, api);
  const { THREE, add, boxG, mat } = tools(ctx);
  // it runs along x at the front edge, so the cut face shows it in section: a channel of water in the soil
  const w = p.width ?? 2.4, x0 = p.x0 ?? 4, x1 = p.x1 ?? 14, z = p.z ?? -w / 2 - 0.02, y = p.y ?? 0.03, L = x1 - x0, depth = p.depth ?? 0.7;
  const root = new THREE.Group(); ctx.scene.add(root);
  const bank = mat("#6b5536", { roughness: 0.95 });
  add(root, boxG(L, 0.14, 0.4), bank, (x0 + x1) / 2, y + 0.03, z - w / 2 - 0.2);
  add(root, boxG(L, 0.16, w + 0.4), bank, (x0 + x1) / 2, y - depth - 0.04, z); // the bed under the water (the face shows the water in section)
  const clean = new THREE.Color(col(p.color, "#2f8fd8")), dirty = new THREE.Color(col(p.dirtyColor, "#8a7a3e"));
  const wM = ctx.std({ color: clean.clone(), roughness: 0.08, metalness: 0.1, emissive: new THREE.Color("#0d3a66"), emissiveIntensity: 0.25, transparent: true, opacity: 0.92 });
  // its front just in front of the soil's face (behind it, the face hid the section and only a pale strip showed on top)
  const water = add(root, boxG(L, depth, w + 0.06), wM, (x0 + x1) / 2, y - depth / 2 + 0.04, z + 0.03, false);
  const rip = ctx.std({ color: new THREE.Color("#e8f6ff"), roughness: 0.3, transparent: true, opacity: 0.85 }), ripples = [];
  for (let i = 0; i < 40; i++) { const r = add(root, new THREE.BoxGeometry(0.45, 0.012, 0.06), rip, 0, y + 0.07, z - w / 2 + 0.15 + ((i * 7) % 11) / 11 * (w - 0.3), false); ripples.push({ r, ph: i / 40 }); }
  const foamM = ctx.std({ color: new THREE.Color("#f4efe2"), roughness: 0.9 }), foam = [];
  for (let i = 0; i < 18; i++) { const f = add(root, new THREE.SphereGeometry(0.12 + (i % 3) * 0.04, 8, 6), foamM, 0, y + 0.08, z - w / 2 + 0.2 + ((i * 5) % 9) / 9 * (w - 0.4), false); f.scale.y = 0.4; foam.push({ f, ph: (i * 0.137) % 1 }); }
  const dir = p.dir ?? 1;
  return {
    update(tt) {
      const sh = clamp(api.ch("show", tt)); root.visible = sh > 0.002; root.scale.set(1, Math.max(0.001, sh), 1);
      const dk = clamp(api.ch("dirty", tt) - api.ch("clean", tt));
      wM.color.copy(clean).lerp(dirty, dk);
      for (const q of ripples) { const u = (tt * 0.25 + q.ph) % 1; q.r.position.x = dir > 0 ? x0 + 0.3 + u * (L - 0.6) : x1 - 0.3 - u * (L - 0.6); q.r.visible = sh > 0.5; }
      for (const q of foam) { const u = (tt * 0.2 + q.ph) % 1; q.f.position.x = dir > 0 ? x0 + 0.3 + u * (L - 0.6) : x1 - 0.3 - u * (L - 0.6); q.f.visible = dk > 0.15; q.f.scale.setScalar(pop(dk)); q.f.scale.y = 0.4 * dk; }
    },
  };
}

// a stream beside the setting that runs toward the camera (axis "z"): a channel in the lawn from far back to the face,
// grassy banks with stones, ripples drifting toward the viewer; the face shows it in section (water over its bed)
function stream(ctx, p, api) {
  const { THREE, add, boxG, mat } = tools(ctx);
  const w = p.width ?? 2.6, d = p.depth ?? 0.8, x = p.x ?? 17, z0 = p.z0 ?? -26, L = -z0, y = p.y ?? 0.02;
  const root = new THREE.Group(); ctx.scene.add(root);
  const bank = mat("#6b5536", { roughness: 0.95 }), grass = mat("#5f9a3c", { roughness: 0.9 }), stone = mat("#8d8a84", { roughness: 0.85 });
  // the bed under the water and the banks on both sides (grass on top, soil faces), reaching the cut face
  add(root, boxG(w + 0.6, 0.2, L), bank, x, y - d - 0.1, z0 / 2 + 0.02);
  for (const s of [-1, 1]) { add(root, boxG(0.5, 0.22, L), grass, x + s * (w / 2 + 0.25), y + 0.08, z0 / 2 + 0.02); add(root, boxG(0.3, d + 0.1, L), bank, x + s * (w / 2 + 0.15), y - d / 2, z0 / 2 + 0.03); }
  for (let i = 0; i < 18; i++) { const s = add(root, new THREE.DodecahedronGeometry(0.16 + (i % 3) * 0.06, 0), stone, x + (i % 2 ? 1 : -1) * (w / 2 - 0.05 + ((i * 7) % 3) * 0.08), y + 0.06, -0.8 - ((i * 37) % 23) / 23 * (L - 2)); s.rotation.set(i, i * 2, 0); s.scale.y = 0.6; }
  const clean = new THREE.Color(col(p.color, "#2f8fd8")), dirty = new THREE.Color(col(p.dirtyColor, "#8a8a6e"));
  const wM = ctx.std({ color: clean.clone(), roughness: 0.08, metalness: 0.1, emissive: new THREE.Color("#0d3a66"), emissiveIntensity: 0.25, transparent: true, opacity: 0.92 });
  // the water's front just in front of the soil face, so the section reads as water in a channel
  add(root, boxG(w, d, L + 0.03), wM, x, y - d / 2 + 0.04, z0 / 2 + 0.015, false);
  const rip = ctx.std({ color: new THREE.Color("#e8f6ff"), roughness: 0.3, transparent: true, opacity: 0.85 }), ripples = [];
  for (let i = 0; i < 40; i++) { const r = add(root, new THREE.BoxGeometry(0.06, 0.012, 0.45), rip, x - w / 2 + 0.2 + ((i * 7) % 11) / 11 * (w - 0.4), y + 0.07, 0, false); ripples.push({ r, ph: i / 40 }); }
  const foamM = ctx.std({ color: new THREE.Color("#f4efe2"), roughness: 0.9 }), foam = [];
  for (let i = 0; i < 22; i++) { const f = add(root, new THREE.SphereGeometry(0.12 + (i % 3) * 0.04, 8, 6), foamM, x - w / 2 + 0.25 + ((i * 5) % 9) / 9 * (w - 0.5), y + 0.08, 0, false); f.scale.y = 0.4; foam.push({ f, ph: (i * 0.137) % 1 }); }
  return {
    update(tt) {
      const sh = clamp(api.ch("show", tt)); root.visible = sh > 0.002; root.scale.set(1, Math.max(0.001, sh), 1);
      const dk = clamp(api.ch("dirty", tt) - api.ch("clean", tt));
      wM.color.copy(clean).lerp(dirty, dk);
      // downstream is toward the camera; the dirt spreads from the pipe's outfall (near the face) with the current
      for (const q of ripples) { const u = (tt * 0.12 + q.ph) % 1; q.r.position.z = z0 + 0.4 + u * (L - 0.8); q.r.visible = sh > 0.5; }
      for (const q of foam) { const u = (tt * 0.1 + q.ph) % 1; q.f.position.z = -0.4 - u * Math.min(L - 1, 6); q.f.visible = dk > 0.15; q.f.scale.setScalar(pop(dk)); q.f.scale.y = 0.4 * dk; }
    },
  };
}

export function flow(ctx, p, api) {
  const { THREE } = ctx;
  const pts = (p.path ?? [[0, 0.1, 0], [3, 0.1, 0]]).map((q) => new THREE.Vector3(...q));
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1), L = curve.getLength();
  // water that starts in the air (a hose, a nozzle) is a spray: pale drops fanning out, no tube (a blue tube of blobs
  // in front of a blue wall read as the hose itself)
  const spray = p.look === "spray" || ((p.look ?? "water") === "water" && pts[0].y > 0.5);
  const look = spray ? ["#e4f5ff", 0.1] : { water: ["#4aa3e8", 0.15], sludge: ["#3b2a1a", 0.35], soap: ["#f1f6fa", 0.4], oil: ["#1d1712", 0.1], mud: ["#6b4a2a", 0.6] }[p.look ?? "water"] ?? ["#4aa3e8", 0.15];
  const m = ctx.std({ color: new THREE.Color(look[0]), roughness: look[1], ...(spray ? { emissive: new THREE.Color("#9fd8ff"), emissiveIntensity: 0.35 } : {}) });
  const ribbonM = ctx.std({ color: new THREE.Color(look[0]), roughness: 0.3, transparent: true, opacity: 0.5 });
  const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, pts.length * 12), Math.max(0.22, p.size ?? 0.22) * 0.6, 8, false), ribbonM); ctx.scene.add(ribbon);
  const R0 = spray ? 0.11 : Math.max(0.22, p.size ?? 0.22), N = spray ? Math.max(p.count ?? 0, Math.round(L * 14)) : p.count ?? Math.max(14, Math.round(L * 4)), blobs = [];
  // each drop's own sideways direction: the spray widens toward its end (a cone up to 0.45 m across)
  for (let i = 0; i < N; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(R0 * (0.85 + ((i * 7) % 5) * 0.08), 10, 8), m); s.castShadow = false; ctx.scene.add(s); const a = i * 2.39996; blobs.push({ s, ph: spray ? (i * 0.618034) % 1 : i / N, off: spray ? new THREE.Vector3(Math.cos(a), Math.sin(a), Math.cos(a * 1.7)).multiplyScalar(0.45 * (((i * 13) % 7) / 6)) : null }); }
  return {
    update(tt) {
      const on = clamp(api.ch("on", tt) - api.ch("off", tt));
      ribbon.visible = !spray && on > 0.02; ribbonM.opacity = 0.5 * on;
      for (const b of blobs) {
        const u = (tt * (p.speed ?? 2.4) / L + b.ph) % 1;
        // the blobs reach only as far as the flow has got (it starts at the top of the path)
        b.s.visible = on > 0.02 && u <= Math.min(1, on * 1.2);
        b.s.position.copy(curve.getPointAt(u)); if (b.off) b.s.position.addScaledVector(b.off, u); b.s.scale.setScalar(pop(Math.min(1, on * 1.5)));
      }
    },
  };
}

// the props, built from boxes and cylinders at their base (y = the floor top); all stand on the ground
const PROP_TYPES = {
  kiosk(g, k) { k.add(g, k.boxG(0.5, 1.0, 0.4), k.mat("#2d3236"), 0, 0.5, 0); k.add(g, k.boxG(0.7, 0.6, 0.45), k.mat("#e9edf0"), 0, 1.3, 0); k.add(g, k.boxG(0.45, 0.32, 0.03), k.ctx.std({ color: k.C("#4fb0ff"), emissive: k.C("#4fb0ff"), emissiveIntensity: 0.7 }), 0, 1.36, 0.24, false); k.add(g, k.boxG(0.18, 0.03, 0.04), k.mat("#111"), 0.15, 1.12, 0.24, false); },
  vacuum(g, k) { k.add(g, k.boxG(0.8, 1.6, 0.6), k.mat("#f0c419", { roughness: 0.4 }), 0, 0.8, 0); k.add(g, k.boxG(0.82, 0.2, 0.62), k.mat("#c8372f"), 0, 1.7, 0); const h = k.add(g, new k.THREE.TorusGeometry(0.45, 0.06, 8, 24, Math.PI * 1.4), k.mat("#2d3236"), 0.45, 1.3, 0.2, false); h.rotation.z = -0.6; k.add(g, k.boxG(0.12, 0.35, 0.12), k.mat("#2d3236"), 0.75, 0.9, 0.25); },
  towelRack(g, k) { for (const x of [-0.6, 0.6]) k.add(g, k.boxG(0.08, 1.4, 0.08), k.mat("#c9cdd2", { metalness: 0.6, roughness: 0.3 }), x, 0.7, 0); k.add(g, k.boxG(1.3, 0.06, 0.06), k.mat("#c9cdd2", { metalness: 0.6, roughness: 0.3 }), 0, 1.35, 0); ["#3a7bd5", "#e9c46a", "#c8372f"].forEach((c, i) => k.add(g, k.boxG(0.32, 0.6, 0.04), k.mat(c, { roughness: 0.9 }), -0.4 + i * 0.4, 1.05, 0.04)); },
  trashCan(g, k) { k.add(g, new k.THREE.CylinderGeometry(0.32, 0.28, 0.9, 16), k.mat("#3a5f4a"), 0, 0.45, 0); k.add(g, new k.THREE.CylinderGeometry(0.35, 0.35, 0.08, 16), k.mat("#2d3236"), 0, 0.94, 0); },
  planter(g, k) { k.add(g, k.boxG(1.2, 0.5, 0.6), k.mat("#a8743f"), 0, 0.25, 0); for (const x of [-0.35, 0, 0.35]) k.add(g, new k.THREE.SphereGeometry(0.3, 12, 10), k.mat("#4f9a3c", { roughness: 0.9 }), x, 0.7, 0); },
  bench(g, k) { const w = k.mat("#a8743f"), i = k.mat("#2d3236"); k.add(g, k.boxG(1.8, 0.08, 0.5), w, 0, 0.5, 0); k.add(g, k.boxG(1.8, 0.4, 0.06), w, 0, 0.8, -0.22); for (const x of [-0.8, 0.8]) k.add(g, k.boxG(0.08, 0.5, 0.45), i, x, 0.25, 0); },
  bikeRack(g, k) { for (const x of [-0.6, 0, 0.6]) { const a = k.add(g, new k.THREE.TorusGeometry(0.35, 0.04, 8, 20, Math.PI), k.mat("#c9cdd2", { metalness: 0.6 }), x, 0.02, 0); a.rotation.y = Math.PI / 2; } },
  mailbox(g, k) { k.add(g, k.boxG(0.1, 1.0, 0.1), k.mat("#5a4632"), 0, 0.5, 0); k.add(g, k.boxG(0.3, 0.3, 0.55), k.mat("#2f5f9e"), 0, 1.12, 0); },
  pottedPlant(g, k) { k.add(g, new k.THREE.CylinderGeometry(0.25, 0.2, 0.4, 14), k.mat("#c0584a"), 0, 0.2, 0); for (let i = 0; i < 5; i++) k.add(g, new k.THREE.SphereGeometry(0.18, 10, 8), k.mat("#4f9a3c", { roughness: 0.9 }), Math.cos(i) * 0.12, 0.55 + (i % 2) * 0.12, Math.sin(i) * 0.12); },
  // the topic props (2026-10-29): the finishing touches that complete the thing itself
  rocks(g, k) {
    // stones along the edge of an area [w, d] (a pond's rim), centred on pos
    // (open: the sides left without stones: "front" at the cut face, where stones would float on the water seen in section)
    const [w, d] = k.p.size ?? [4, 3], open = [].concat(k.p.open ?? []), n = Math.max(10, Math.round((w + d) * 2.2)), m = [k.mat("#8d8a82", { roughness: 0.95 }), k.mat("#a7a39a", { roughness: 0.95 }), k.mat("#76736c", { roughness: 0.95 })];
    for (let i = 0; i < n; i++) {
      const u = i / n, per = 2 * (w + d), s = u * per, [x, z] = s < w ? [-w / 2 + s, d / 2] : s < w + d ? [w / 2, d / 2 - (s - w)] : s < 2 * w + d ? [w / 2 - (s - w - d), -d / 2] : [-w / 2, -d / 2 + (s - 2 * w - d)];
      if ((open.includes("front") && z >= d / 2 - 1e-6) || (open.includes("back") && z <= -d / 2 + 1e-6) || (open.includes("left") && x <= -w / 2 + 1e-6) || (open.includes("right") && x >= w / 2 - 1e-6)) continue;
      const r = 0.22 + ((i * 7) % 5) * 0.05, st = k.add(g, new k.THREE.DodecahedronGeometry(r, 0), m[i % 3], x, r * 0.55, z); st.scale.y = 0.6; st.rotation.y = i * 1.3;
    }
  },
  lilyPads(g, k) {
    // pads floating on a water surface [w, d] (pos y = the water top), a pink flower on some
    const [w, d] = k.p.size ?? [3, 2], pad = k.mat("#3f9a3c", { roughness: 0.6 }), fl = k.mat("#f2a7c3", { roughness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const x = -w / 2 + 0.4 + ((i * 0.37) % 1) * (w - 0.8), z = -d / 2 + 0.3 + ((i * 0.61) % 1) * (d - 0.6), r = 0.32 + (i % 3) * 0.08;
      k.add(g, new k.THREE.CylinderGeometry(r, r, 0.03, 18, 1, false, 0.4, Math.PI * 2 - 0.5), pad, x, 0.02, z, false);
      if (i % 2 === 0) for (let j = 0; j < 5; j++) { const p = k.add(g, new k.THREE.ConeGeometry(0.07, 0.18, 6), fl, x + Math.cos(j * 1.26) * 0.07, 0.1, z + Math.sin(j * 1.26) * 0.07, false); p.rotation.z = Math.cos(j * 1.26) * 0.6; p.rotation.x = -Math.sin(j * 1.26) * 0.6; }
    }
  },
  fish(g, k) {
    // orange fish swimming slow circles in a water box [w, d] (pos y = mid-water)
    const [w, d] = k.p.size ?? [3, 2], body = [k.mat("#f08a24", { roughness: 0.4 }), k.mat("#f6f1e8", { roughness: 0.4 })], fish = [];
    for (let i = 0; i < 5; i++) {
      const f = new k.THREE.Group(); g.add(f);
      const b = k.add(f, new k.THREE.SphereGeometry(0.16, 12, 10), body[i % 4 === 3 ? 1 : 0], 0, 0, 0, false); b.scale.set(1.8, 0.8, 0.7);
      const t = k.add(f, new k.THREE.ConeGeometry(0.12, 0.2, 4), body[0], -0.33, 0, 0, false); t.rotation.z = Math.PI / 2;
      fish.push({ f, ph: i / 5, rx: w * (0.25 + (i % 3) * 0.06), rz: d * (0.2 + (i % 2) * 0.08), y: (i % 3 - 1) * 0.15 });
    }
    k.anim.push((tt) => { for (const q of fish) { const a = (tt * 0.25 + q.ph) * Math.PI * 2; q.f.position.set(Math.cos(a) * q.rx, q.y, Math.sin(a) * q.rz); q.f.rotation.y = -a - Math.PI / 2; } });
  },
  rinkLines(g, k) {
    // the painted markings on an ice sheet [w, d] (pos y = the ice top): a red centre line, two blue lines, a centre circle
    const [w, d] = k.p.size ?? [6, 4], red = k.mat("#d23a33", { roughness: 0.4 }), blue = k.mat("#2e62c9", { roughness: 0.4 });
    k.add(g, k.boxG(0.12, 0.01, d * 0.96), red, 0, 0.006, 0, false);
    for (const x of [-w * 0.2, w * 0.2]) k.add(g, k.boxG(0.12, 0.01, d * 0.96), blue, x, 0.006, 0, false);
    const c = k.add(g, new k.THREE.TorusGeometry(Math.min(w, d) * 0.18, 0.04, 6, 40), blue, 0, 0.01, 0, false); c.rotation.x = Math.PI / 2;
    for (const x of [-w * 0.42, w * 0.42]) k.add(g, k.boxG(0.06, 0.01, d * 0.96), red, x, 0.006, 0, false);
  },
  goalNets(g, k) {
    // two small goals facing each other across [w, d]: red frames, white mesh
    const [w] = k.p.size ?? [6, 4], red = k.mat("#d23a33", { metalness: 0.3, roughness: 0.4 }), net = k.ctx.std({ color: k.C("#f4f4f4"), roughness: 0.9, transparent: true, opacity: 0.55 });
    for (const sx of [-1, 1]) {
      const q = new k.THREE.Group(); q.position.x = sx * w * 0.42; q.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(q);
      for (const x of [-0.45, 0.45]) k.add(q, k.boxG(0.06, 0.5, 0.06), red, x, 0.25, 0);
      k.add(q, k.boxG(0.96, 0.06, 0.06), red, 0, 0.5, 0);
      k.add(q, k.boxG(0.9, 0.46, 0.02), net, 0, 0.24, -0.25, false); k.add(q, k.boxG(0.9, 0.02, 0.26), net, 0, 0.48, -0.12, false);
    }
  },
  floodLight(g, k) {
    // a tall pole with a lamp head aimed down
    const pole = k.mat("#5f666b", { metalness: 0.6, roughness: 0.4 });
    k.add(g, new k.THREE.CylinderGeometry(0.07, 0.09, 4.2, 12), pole, 0, 2.1, 0);
    const h = k.add(g, k.boxG(0.8, 0.35, 0.3), k.mat("#2d3236"), 0, 4.3, 0.15); h.rotation.x = 0.5;
    const lens = k.add(g, k.boxG(0.7, 0.25, 0.04), k.ctx.std({ color: k.C("#fff7d6"), emissive: k.C("#fff2b8"), emissiveIntensity: 1.6 }), 0, 4.22, 0.3, false); lens.rotation.x = 0.5;
  },
  crosswalk(g, k) {
    // white stripes across a road [w, d] (pos y = the road top); the stripes run along d
    const [w, d] = k.p.size ?? [6, 3], m = k.mat("#f4f4ef", { roughness: 0.7 }), n = Math.max(4, Math.round(w / 0.9));
    for (let i = 0; i < n; i++) k.add(g, k.boxG(0.45, 0.012, d), m, -w / 2 + 0.45 + i * ((w - 0.9) / (n - 1)), 0.008, 0, false);
  },
  stopLine(g, k) { const [w] = k.p.size ?? [3]; k.add(g, k.boxG(w, 0.012, 0.35), k.mat("#f4f4ef", { roughness: 0.7 }), 0, 0.008, 0, false); },
  streetSign(g, k) {
    // a green street-name sign on a pole (text: its name)
    k.add(g, new k.THREE.CylinderGeometry(0.05, 0.05, 2.8, 10), k.mat("#5f666b", { metalness: 0.6 }), 0, 1.4, 0);
    const cv = typeof document !== "undefined" ? document.createElement("canvas") : null; let face = k.mat("#1f7a4a");
    if (cv) { cv.width = 512; cv.height = 128; const c = cv.getContext("2d"); c.fillStyle = "#1f7a4a"; c.fillRect(0, 0, 512, 128); c.strokeStyle = "#ffffff"; c.lineWidth = 8; c.strokeRect(8, 8, 496, 112); c.fillStyle = "#ffffff"; c.font = "bold 72px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(k.p.text ?? "MAIN ST").slice(0, 12), 256, 68); const t = new k.THREE.CanvasTexture(cv); t.colorSpace = k.THREE.SRGBColorSpace; face = k.ctx.std({ map: t, roughness: 0.5 }); }
    k.add(g, k.boxG(1.3, 0.32, 0.04), face, 0, 2.7, 0.04);
  },
  stairs(g, k) {
    // a straight stair rising +x from pos (the bottom step) to height h, width w; with a handrail
    const h = k.p.h ?? 2.6, w = k.p.w ?? 1.0, n = Math.max(4, Math.round(h / 0.19)), run = 0.27, m = k.mat("#b9906a", { roughness: 0.7 }), rail = k.mat("#5f666b", { metalness: 0.5 });
    for (let i = 0; i < n; i++) k.add(g, k.boxG(run, (h / n) * (i + 1), w), m, run / 2 + i * run, ((h / n) * (i + 1)) / 2, 0);
    const len = Math.hypot(n * run, h), r = k.add(g, k.boxG(len, 0.05, 0.05), rail, (n * run) / 2, h / 2 + 0.9, -w / 2 + 0.04); r.rotation.z = Math.atan2(h, n * run);
    for (const x of [0.1, n * run - 0.1]) k.add(g, k.boxG(0.05, 0.9, 0.05), rail, x, (x / (n * run)) * h + 0.45, -w / 2 + 0.04);
  },
  ceilingLight(g, k) {
    // a pendant lamp hanging from a ceiling at height h above pos (pos y = the floor): a cord, a shade, a glowing bulb
    // (drawn large enough to read in a wide shot: a 0.35 m shade was a speck)
    const h = k.p.h ?? 2.6, drop = k.p.drop ?? 0.7;
    k.add(g, new k.THREE.CylinderGeometry(0.03, 0.03, drop, 6), k.mat("#2d3236"), 0, h - drop / 2, 0, false);
    k.add(g, new k.THREE.ConeGeometry(0.6, 0.5, 18, 1, true), k.mat("#2d3236", { roughness: 0.5 }), 0, h - drop - 0.2, 0);
    k.add(g, new k.THREE.SphereGeometry(0.22, 12, 10), k.ctx.std({ color: k.C("#fff6d8"), emissive: k.C("#ffe9a8"), emissiveIntensity: 2.2 }), 0, h - drop - 0.42, 0, false);
    const L = new k.THREE.PointLight(0xffe2a8, 2.2, 8); L.position.set(0, h - drop - 0.6, 0); g.add(L);
  },
  steppingStones(g, k) {
    // flat stones in a line along x over length w (a path to the thing)
    const [w] = k.p.size ?? [3], m = k.mat("#9a968d", { roughness: 0.9 }), n = Math.max(3, Math.round(w / 0.75));
    for (let i = 0; i < n; i++) { const s = k.add(g, new k.THREE.CylinderGeometry(0.28 + (i % 2) * 0.05, 0.3, 0.08, 9), m, -w / 2 + 0.3 + i * ((w - 0.6) / (n - 1)), 0.04, (i % 2 ? 0.12 : -0.12)); s.rotation.y = i; }
  },
  toolbox(g, k) { k.add(g, k.boxG(0.7, 0.35, 0.35), k.mat("#c8372f"), 0, 0.18, 0); k.add(g, k.boxG(0.3, 0.05, 0.05), k.mat("#2d3236"), 0, 0.42, 0); },
};
export const PROP_NAMES = Object.keys(PROP_TYPES);
export function prop(ctx, p, api) {
  const k = { ...tools(ctx), ctx, p, anim: [] };
  const g = new k.THREE.Group(); g.position.set(...(p.pos ?? [0, 0, 0])); g.rotation.y = p.rotY ?? 0; ctx.scene.add(g);
  (PROP_TYPES[p.type] ?? PROP_TYPES.planter)(g, k);
  const s0 = p.scale ?? 1;
  return { update(tt) { const v = back(clamp(api.ch("pop", tt))); g.visible = v > 0.002; g.scale.setScalar(pop(v * s0)); for (const f of k.anim) f(tt); } };
}

export function canopy(ctx, p, api) {
  const { THREE, add, boxG, mat } = tools(ctx);
  const x0 = p.x0 ?? -3, x1 = p.x1 ?? 3, z0 = p.z0 ?? -5, z1 = p.z1 ?? -1, y = p.y ?? 0, h = p.h ?? 4, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const postM = mat(p.postColor ?? "#c9cdd2", { metalness: 0.6, roughness: 0.3 }), roofM = mat(p.color ?? "#f2f4f6", { roughness: 0.5 });
  const posts = [];
  for (const x of [x0 + 0.15, x1 - 0.15]) for (const z of [z0 + 0.15, z1 - 0.15]) posts.push(add(ctx.scene, boxG(0.2, h, 0.2), postM, x, y + h / 2, z));
  const roof = add(ctx.scene, boxG(x1 - x0 + 0.4, 0.3, z1 - z0 + 0.4), roofM, cx, y + h + 0.15, cz);
  roofM.transparent = true;
  return {
    update(tt) {
      const ps = clamp(api.ch("posts", tt)), rf = back(clamp(api.ch("roof", tt))), gh = clamp(api.ch("ghost", tt));
      for (const q of posts) { q.visible = ps > 0.002; q.scale.y = pop(ps); q.position.y = y + (h * ps) / 2; }
      roof.visible = rf > 0.002 && ps > 0.95; roof.scale.setScalar(pop(rf));
      // (see-through while a later sentence looks at what is under it: layoutRules 16)
      roofM.opacity = 1 - 0.82 * gh; roofM.depthWrite = gh < 0.05; roof.castShadow = gh < 0.5;
    },
  };
}

/** a drain grate set into the floor: a dark frame with slots, a little proud of the slab so it reads from the side */
export function grate(ctx, p, api) {
  const { THREE, add, boxG, mat } = tools(ctx);
  const [x, y, z] = p.pos ?? [0, 0.1, -1.5], w = p.width ?? 1.6, d = p.depth ?? 0.8;
  const g = new THREE.Group(); g.position.set(x, y, z); ctx.scene.add(g);
  const iron = mat("#22262a", { metalness: 0.6, roughness: 0.4 });
  add(g, boxG(w, 0.06, d), iron, 0, 0.03, 0);
  const slot = mat("#050505", { roughness: 1 });
  const n = Math.max(3, Math.round(w / 0.18));
  for (let i = 0; i < n; i++) add(g, boxG(0.07, 0.065, d - 0.16), slot, -w / 2 + 0.14 + (i * (w - 0.28)) / (n - 1), 0.035, 0, false);
  return { update(tt) { const v = back(clamp(api.ch("show", tt))); g.visible = v > 0.002; g.scale.setScalar(pop(v)); } };
}

export const CLARITY_CHANNELS = {
  grate: ["show"],
  settle: ["show", "fill", "sand", "oil", "clear"],
  creek: ["show", "dirty", "clean"],
  flow: ["on", "off"],
  prop: ["pop"],
  canopy: ["posts", "roof", "ghost"],
};
