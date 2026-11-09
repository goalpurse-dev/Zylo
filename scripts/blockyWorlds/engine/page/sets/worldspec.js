// Blocky Worlds: build an AI-designed WORLD SPEC (lib/builder/spec.js validateWorld) from procedural parts, with the
// same return shape as sets/index.js buildSet, so the engine, camera.js frameShot and lighting.js applyLight treat it
// like the four hand-built sets.
//   buildWorld(spec, ctx /* { THREE, scene?, renderer?, gltf?, tex? } */) -> { root, spots, indoor, camDir, views,
//       bounds, rig, update(t), blockers: [], problems }
// The layout every world shares (so the planner's spots mean the same thing everywhere): the camera stands at +z and
// looks down -z; the group at the centre spot; the landmark behind them (slightly off-centre so heads never hide it);
// the enclosure (a cave / a creature's insides / a room / the sea / space) closes in around a 13 m wide corridor so a
// 9:16 frame reads "inside" at once; the far spot (where a monster lurks) and the door spot (the opening) at the back.
//   Procedural parts: terrain (flat / hilly / rocky / wet), curved shells (ribs, scales, flesh, rock), a box room,
//   a sea dome and a starfield, a ring of distant hills, scatter of small props, practical lights, particles.
// Never throws on a bad spec: what is valid is built, the problems are in the result.
import { makeKit, mergeStatic, glowList, lcg } from "./util.js";
import { validateWorld } from "../../lib/builder/spec.js";
import { preloadEnv } from "../lighting.js";
import { attachDresser } from "./themes.js"; // SETS-V2

const GROUND_TEX = { grass: "leafy_grass", dirt: "brown_mud_dry", sand: "coast_sand_01", rock: "dark_rock", tiles: "interior_tiles", wood: "laminate_floor_02", gravel: "gravel" };

export async function buildWorld(rawSpec, ctx) {
  const { THREE } = ctx;
  const { spec, problems } = validateWorld(rawSpec);
  // EPIC hook: a city on / inside a giant creature goes to the EPIC agent's builder when the engine hands it in
  // (ctx.buildCreatureWorld, page/sets/creatureWorld.js; same return shape); giants / crowds are built only there
  if (spec.kind === "creature_world" && typeof ctx.buildCreatureWorld === "function") return ctx.buildCreatureWorld(spec, ctx);
  if (spec.giants?.length || spec.crowds?.length) problems.push("giants / crowds need the EPIC builder (not built here)");
  const env = preloadEnv(THREE); // the sky HDRIs applyLight needs (buildSet does the same)
  const root = new THREE.Group(); root.name = `world:${spec.name}`;
  const K = makeKit(ctx, root), { solid, mesh, bx, plane } = K;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = lcg(hash(spec.name) + 17);
  const glow = glowList(), onLight = [], updates = [];
  const E = spec.enclosure, type = E.type;
  const pal = spec.palette.length ? spec.palette : ["#6aa84f", "#a9d18e", "#e6b85c", "#8e6c4a"];
  const col = (i) => pal[i % pal.length];
  const enclosed = type !== "sky";
  // the corridor: half-width R (shells), length from the camera end (+Z0) to the far end (-Z1)
  const R = type === "room" ? 6.5 : type === "underwater" || type === "space" ? 60 : 7, Z0 = 14, Z1 = type === "room" ? 16 : 32;
  const H = type === "room" ? 4.4 : R;

  // ---------------------------------------------------------------- ground
  const gm = groundMaterial(K, spec.ground, spec.ground.shape === "wet");
  const gsize = enclosed && type !== "underwater" && type !== "space" ? [R * 2 + 2, Z0 + Z1 + 4] : [220, 220];
  const gz = enclosed && type !== "underwater" && type !== "space" ? (Z0 - Z1) / 2 : -40;
  if (spec.ground.shape === "hilly" || type === "space" || type === "underwater") {
    const g = new THREE.PlaneGeometry(gsize[0], gsize[1], 96, 96); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundY(spec, p.getX(i), p.getZ(i) + gz));
    g.computeVertexNormals();
    mesh(g, gm, { z: gz, keep: true, cast: false });
  } else plane(gsize[0], gsize[1], gm, { y: 0, z: gz, keep: true, cast: false });
  if (spec.ground.shape === "wet") for (let i = 0; i < 9; i++) { // puddles: dark glossy discs
    const x = (rnd() * 2 - 1) * 5, z = 4 - rnd() * 22;
    if (Math.abs(x) < 1.6 && z > -3) continue;
    const m = mesh(new THREE.CircleGeometry(0.6 + rnd() * 1.1, 20), solid("#1d2a36", { roughness: 0.04, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -3 }), { x, y: 0.01, z, rx: -Math.PI / 2, cast: false });
    m.scale.set(1.4, 1, 1);
  }
  if (spec.ground.shape === "rocky" || type === "cave" || type === "space") {
    const rock = type === "space" ? solid("#9a9aa2", { roughness: 0.95, flatShading: true }) : K.pbr("dark_rock", { tint: spec.ground.color });
    for (let i = 0; i < 26; i++) {
      const x = (rnd() * 2 - 1) * (enclosed && type !== "space" ? R - 1.2 : 16), z = 8 - rnd() * 40, s = 0.25 + rnd() * (Math.abs(x) > 4 ? 1.2 : 0.5);
      if (Math.abs(x) < 2.2 && z > -6) continue;
      const m = mesh(new THREE.IcosahedronGeometry(s, 0), rock, { x, y: s * 0.3, z, ry: rnd() * 6, rz: rnd() });
      m.scale.set(1.2, 0.7, 1);
    }
  }
  if (type === "space") craters(K, rnd);

  // ---------------------------------------------------------------- the enclosure
  let opening = null; // where the door spot / the bright opening is (world point on the floor)
  const shellColor = E.color ?? { cave: "#6f6458", inside_creature: "#c9566a", room: "#e8dccb" }[type] ?? col(0);
  const shellColor2 = E.color2 ?? { inside_creature: "#f3e6cf", cave: "#4a4038" }[type] ?? col(1);
  if (type === "sky") {
    hillRing(K, rnd, pal);
  } else if (type === "cave" || type === "inside_creature") {
    const mat = wallMaterial(K, E.pattern === "none" ? (type === "cave" ? "rock" : "flesh") : E.pattern, shellColor, shellColor2);
    tunnel(K, { R, Z0, Z1, mat, jag: type === "cave" ? 0.18 : 0.06, seed: rnd });
    if (E.pattern === "ribs" || type === "inside_creature" && E.pattern !== "scales") ribs(K, { R, Z0, Z1, color: shellColor2 });
    if (type === "cave") stalactites(K, { R, Z0, Z1, rnd, color: shellColor });
    if (type === "inside_creature") wallGlows(K, { R, rnd, glow, color: E.glow ?? "#ffd2e0" });
    opening = V(0, 0, -Z1 + 2);
    farLight(K, glow, { R, Z1, color: E.glow ?? (type === "cave" ? "#fff2c8" : "#ffe0b0"), mouth: E.opening === "mouth" || type === "inside_creature" && E.opening !== "none" && E.opening !== "hole", teeth: shellColor2 });
  } else if (type === "room") {
    room(K, { W: R * 2, D: Z0 + Z1, Z0, H, mat: wallMaterial(K, E.pattern === "none" ? "plaster" : E.pattern, shellColor, shellColor2), glow, opening: E.opening, color2: shellColor2 });
    opening = V(-2.6, 0, -Z1 + 0.6);
  } else if (type === "underwater") {
    dome(K, { top: E.color2 ?? "#4fc3f0", bottom: E.color ?? "#06305e" });
    seaweed(K, rnd, updates, col);
    lightShafts(K, rnd);
    opening = V(-3, 0, -8);
  } else if (type === "space") {
    starfield(K, rnd, E.color ?? "#05060f");
    planet(K, { color: col(0), color2: col(1) });
    opening = V(-3, 0, -8);
  }

  // ---------------------------------------------------------------- landmark, props, particles
  const pending = [];
  if (spec.landmark) pending.push(import("../kit/blueprint.js").then(({ buildBlueprint }) => {
    const o = buildBlueprint(spec.landmark);
    const zz = enclosed && type !== "space" && type !== "underwater" ? -Math.min(Z1 - 6, 11) : -13;
    o.position.set(type === "room" ? 0 : 2.6, groundY(spec, 2.6, zz), zz); root.add(o); keepDynamic(o);
    problems.push(...(o.userData.problems ?? []).map((p) => `landmark: ${p}`));
  }));
  const SPOT = { side_left: V(-3.4, 0, -2.2), side_right: V(3.4, 0, -2.2), back_left: V(-2.7, 0, -6.5), back_right: V(2.7, 0, -6.5), far: V(0.8, 0, -17) };
  if (spec.props.length) {
    const needObjects = spec.props.some((p) => p.kit);
    pending.push(Promise.all([import("../kit/blueprint.js"), needObjects ? import("../kit/objects.js").catch((e) => { problems.push(`kit objects: ${e.message}`); return null; }) : null]).then(([B, O]) => {
      for (const p of spec.props) {
        for (let i = 0; i < p.count; i++) {
          let o = null;
          try {
            if (p.blueprint) o = B.buildBlueprint(p.blueprint);
            else if (O) { const k = O.resolveObject(p.kit); if (k) o = O.makeObject(k, {}); else problems.push(`prop: the kit has no "${p.kit}"`); }
          } catch (e) { problems.push(`prop ${p.kit ?? p.blueprint?.name}: ${e.message}`); }
          if (!o) continue;
          let at;
          if (p.spot === "scatter") {
            for (let k = 0; k < 30; k++) {
              const x = (rnd() * 2 - 1) * (enclosed && type !== "space" && type !== "underwater" ? R - 1.6 : 14), z = 6 - rnd() * 30;
              if (Math.abs(x) < 2.4 && z > -9) continue; // the group's corridor and the camera's line stay clear
              at = V(x, 0, z); break;
            }
            at ??= V(-5, 0, -12);
          } else at = SPOT[p.spot].clone().add(V((i - (p.count - 1) / 2) * 1.6, 0, 0));
          at.y = groundY(spec, at.x, at.z);
          o.position.copy(at); o.rotation.y = Math.atan2(-at.x, 12 - at.z) * 0.6 + (p.spot === "scatter" ? (rnd() - 0.5) * 1.2 : 0);
          root.add(o); keepDynamic(o);
        }
      }
    }));
  }
  await Promise.all([...pending, env]);
  if (spec.particles !== "none") particles(K, spec.particles, updates, { R: enclosed && type !== "space" && type !== "underwater" ? R - 0.5 : 9 });

  // ---------------------------------------------------------------- lights (lighting.js applyLight reads rig)
  const L = spec.light;
  const practical = [...L.practicals];
  if (type === "inside_creature" && !practical.length) practical.push({ color: E.glow ?? "#ff9fb8", pos: [0, 4.5, -4], intensity: 10 }, { color: "#ffd0a0", pos: [0, 3, -Z1 + 4], intensity: 14 });
  if (type === "cave" && !practical.length) practical.push({ color: "#ffcf8a", pos: [-2.5, 2.4, -2], intensity: 8 });
  if (type === "room" && !practical.length) practical.push({ color: "#ffe2b0", pos: [0, H - 0.4, -3], intensity: 9 });
  const fogFor = (mode) => {
    if (spec.fog) { const d = spec.fog.density; const near = 3 + (1 - d) * 30, far = near + 18 + (1 - d) * 160; return [spec.fog.color, near, far]; }
    const base = { cave: ["#2a241e", 10, 60], inside_creature: ["#5a1f2c", 12, 55], room: null, underwater: ["#1a6fa8", 3, 34], space: ["#05060f", 60, 400], sky: null }[type];
    if (!base) return mode === "night" ? ["#16244c", 30, 260] : mode === "warm" ? ["#f0a06a", 140, 1600] : ["#9cc8ec", 120, 1600];
    return mode === "night" ? [darkenHex(base[0], 0.6), base[1] * 0.8, base[2] * 0.8] : base;
  };
  const tint = L.tint;
  const hemiFor = (mode) => {
    const sky = tint ?? { cave: "#b8a890", inside_creature: "#ffb0c0", underwater: "#8fd8ff", space: "#8890b0", room: "#fff0dc" }[type] ?? (mode === "night" ? "#2c3f78" : "#cfe6ff");
    const gnd = { inside_creature: "#5a1a28", cave: "#2a2018", underwater: "#0a2a44", space: "#101018" }[type] ?? (mode === "night" ? "#07070f" : "#8a7a52");
    const k = (enclosed ? 1.15 : mode === "night" ? 0.22 : 0.45) * L.ambient;
    return [sky, gnd, k];
  };
  const rig = {
    shadow: { center: [0, 0, -4], half: 18, far: 160, map: 2048 },
    fog: { day: fogFor("day"), night: fogFor("night"), warm: fogFor("warm") },
    hemi: { day: hemiFor("day"), night: hemiFor("night"), warm: hemiFor("warm") },
    sunScale: { day: enclosed ? (type === "space" ? 0.9 : 0.45) : 1, night: enclosed ? 0.4 : 1.2, warm: enclosed ? 0.5 : 1 },
    ...(tint ? { sunColor: { day: tint, warm: tint, night: tint } } : {}),
    envScale: { all: enclosed ? 0.6 : 1 },
    indoor: type === "room",
    practicals(mode) {
      return practical.map((p) => {
        const l = new THREE.PointLight(p.color, p.intensity * (mode === "night" ? 1.4 : mode === "warm" ? 1 : 0.8), 16, 2);
        l.position.set(...p.pos); return l;
      });
    },
    onLight(mode) { glow.apply(mode); onLight.forEach((f) => f(mode)); },
  };

  mergeStatic(THREE, root);
  if (ctx.scene && !root.parent) ctx.scene.add(root);
  const door = opening ?? V(-3.2, 0, -5);
  return attachDresser({ // SETS-V2: a built world takes a theme preset too when its words fit one (cave, desert, neon...)
    root, indoor: type === "room", spec, problems,
    spots: { center: V(0, 0, 0), left: V(-1.3, 0, 0.3), right: V(1.3, 0, 0.3), back: V(0.2, 0, -2.4), far: V(0, groundY(spec, 0, -14), -14), door: V(door.x, groundY(spec, door.x, door.z + 0.6), door.z + 0.6) },
    camDir: V(0, 0, 1), views: {},
    bounds: [new THREE.Box3(V(enclosed && R < 20 ? -R + 1.2 : -12, 0.3, -24), V(enclosed && R < 20 ? R - 1.2 : 12, enclosed && R < 20 ? H - 0.6 : 14, Z0 - 1))],
    blockers: [], rig,
    update(t) { for (const u of updates) u(t); },
  }, ctx);

  /** the floor height under (x, z) (hilly grounds rise only away from the playing area; it stays flat there) */
  function groundY(s, x, z) {
    if (!(s.ground.shape === "hilly" || type === "space" || type === "underwater")) return 0;
    const amp = type === "space" ? 1.4 : type === "underwater" ? 2.2 : 7, d = Math.hypot(x * 0.8, z > 0 ? z * 1.6 : z * 0.55);
    const k = smooth((d - 9) / 26);
    return k * amp * (0.55 + 0.45 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.07)) + k * amp * 0.3 * Math.sin(x * 0.31) * Math.sin(z * 0.27);
  }
}

// ================================================================================================== helpers
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000;
const smooth = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
function darkenHex(h, k) { const n = parseInt(h.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k)); return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`; }
function keepDynamic(o) { o.traverse((m) => { if (m.userData) delete m.userData.static; }); }

function groundMaterial(K, g, wet) {
  const { THREE } = K;
  const name = GROUND_TEX[g.material];
  if (name) { const m = K.pbr(name, { repeat: [40, 40], tint: g.color, normal: 0.7 }); if (wet) { m.roughness = 0.35; } return m; }
  const draw = {
    snow: (p, w, h, R) => { p.fillStyle = g.color; p.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { p.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.5})`; p.fillRect(R() * w, R() * h, 2, 2); } },
    flesh: (p, w, h, R) => fleshDraw(p, w, h, R, g.color, "#ffffff"),
    metal: (p, w, h, R) => { p.fillStyle = g.color; p.fillRect(0, 0, w, h); p.strokeStyle = "rgba(0,0,0,0.35)"; p.lineWidth = 2; for (let x = 0; x <= w; x += 64) { p.beginPath(); p.moveTo(x, 0); p.lineTo(x, h); p.stroke(); p.beginPath(); p.moveTo(0, x); p.lineTo(w, x); p.stroke(); } for (let i = 0; i < 16; i++) { p.fillStyle = "rgba(255,255,255,0.35)"; p.beginPath(); p.arc(8 + (i % 4) * 64 * 0.5, 8 + Math.floor(i / 4) * 32, 2, 0, 7); p.fill(); } },
    water: (p, w, h, R) => { p.fillStyle = g.color; p.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { p.strokeStyle = `rgba(255,255,255,${0.1 + R() * 0.2})`; p.beginPath(); const y = R() * h, x = R() * w; p.moveTo(x, y); p.quadraticCurveTo(x + 8, y - 4, x + 16, y); p.stroke(); } },
    moon: (p, w, h, R) => { p.fillStyle = g.color; p.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { p.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},${0.04 + R() * 0.08})`; p.fillRect(R() * w, R() * h, 3, 3); } },
  }[g.material] ?? ((p, w, h) => { p.fillStyle = g.color; p.fillRect(0, 0, w, h); });
  const R = lcg(hash(g.material + g.color));
  const t = K.canvas(256, 256, (p, w, h) => draw(p, w, h, R));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30);
  return new THREE.MeshStandardMaterial({ map: t, roughness: wet || g.material === "water" ? 0.2 : g.material === "metal" ? 0.4 : 0.92, metalness: g.material === "metal" ? 0.5 : 0 });
}

function fleshDraw(p, w, h, R, base, light) {
  p.fillStyle = base; p.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, r = 6 + R() * 22; const g = p.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(120,10,40,0.32)"); g.addColorStop(1, "rgba(120,10,40,0)"); p.fillStyle = g; p.fillRect(x - r, y - r, r * 2, r * 2); }
  p.strokeStyle = "rgba(110,20,60,0.55)"; p.lineWidth = 2.2;
  for (let i = 0; i < 14; i++) { let x = R() * w, y = R() * h; p.beginPath(); p.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; p.lineTo(x, y); } p.stroke(); }
  for (let i = 0; i < 120; i++) { p.fillStyle = `rgba(255,255,255,${R() * 0.18})`; p.beginPath(); p.arc(R() * w, R() * h, 1 + R() * 2, 0, 7); p.fill(); }
  void light;
}

/** wall materials: rock (Poly Haven), flesh, scales, ribs (= flesh), panels, bricks (Poly Haven), planks, plaster */
function wallMaterial(K, pattern, color, color2) {
  const { THREE } = K;
  if (pattern === "rock") return K.pbr("dark_rock", { repeat: [8, 4], tint: color });
  if (pattern === "bricks") return K.pbr("brick_wall_02", { repeat: [6, 2], tint: color });
  if (pattern === "plaster") return K.pbr("painted_plaster_wall", { repeat: [5, 2], tint: color });
  const R = lcg(hash(pattern + color));
  const t = K.canvas(256, 256, (p, w, h) => {
    if (pattern === "flesh" || pattern === "ribs") fleshDraw(p, w, h, R, color, color2);
    else if (pattern === "scales") {
      p.fillStyle = color2; p.fillRect(0, 0, w, h);
      const base = new THREE.Color(color), c = new THREE.Color();
      for (let r = 0; r < 9; r++) for (let k = -1; k < 9; k++) {
        const x = k * 32 + (r % 2 ? 16 : 0), y = r * 30;
        p.fillStyle = `#${c.copy(base).multiplyScalar(0.8 + R() * 0.35).getHexString()}`;
        p.beginPath(); p.moveTo(x, y); p.lineTo(x + 16, y + 10); p.lineTo(x + 16, y + 30); p.lineTo(x, y + 38); p.lineTo(x - 16, y + 30); p.lineTo(x - 16, y + 10); p.closePath(); p.fill();
        p.strokeStyle = "rgba(0,0,0,0.35)"; p.lineWidth = 2.5; p.stroke();
      }
    } else if (pattern === "panels") {
      p.fillStyle = color; p.fillRect(0, 0, w, h);
      p.strokeStyle = "rgba(0,0,0,0.4)"; p.lineWidth = 3; for (let x = 0; x <= w; x += 64) for (let y = 0; y <= h; y += 128) p.strokeRect(x + 3, y + 3, 58, 122);
      p.fillStyle = "rgba(255,255,255,0.4)"; for (let x = 10; x < w; x += 64) for (let y = 10; y < h; y += 128) { p.beginPath(); p.arc(x, y, 2.5, 0, 7); p.fill(); }
    } else if (pattern === "planks") {
      const base = new THREE.Color(color), c = new THREE.Color();
      for (let k = 0; k < 8; k++) { p.fillStyle = `#${c.copy(base).multiplyScalar(0.82 + R() * 0.3).getHexString()}`; p.fillRect(k * 32, 0, 31, h); }
      p.strokeStyle = "rgba(40,20,10,0.25)"; for (let i = 0; i < 40; i++) { const x = R() * w; p.beginPath(); p.moveTo(x, 0); p.lineTo(x + (R() - 0.5) * 6, h); p.stroke(); }
    } else { p.fillStyle = color; p.fillRect(0, 0, w, h); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(pattern === "scales" ? 10 : 6, pattern === "scales" ? 5 : 3);
  return new THREE.MeshStandardMaterial({ map: t, roughness: pattern === "flesh" || pattern === "ribs" ? 0.38 : 0.85, side: THREE.DoubleSide });
}

/** a half tube along z (walls + ceiling), jittered for rock; end cap behind the camera */
function tunnel(K, { R, Z0, Z1, mat, jag, seed }) {
  const { THREE } = K, L = Z0 + Z1;
  const g = new THREE.CylinderGeometry(R, R, L, 40, 24, true, -Math.PI / 2, Math.PI);
  g.rotateX(-Math.PI / 2); // the arc now spans the upper half (y >= 0) around the z axis
  mat.side = THREE.DoubleSide;
  const p = g.attributes.position;
  const noise = (a, b) => Math.sin(a * 3.1 + b * 0.7) * 0.5 + Math.sin(a * 7.3 - b * 1.9) * 0.3 + Math.sin(b * 2.3) * 0.2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = Math.abs(p.getY(i)), z = p.getZ(i), a = Math.atan2(y, x);
    const k = 1 + jag * noise(a, z);
    p.setXYZ(i, x * k, y * k * 1.05, z);
  }
  g.computeVertexNormals();
  K.mesh(g, mat, { z: (Z0 - Z1) / 2, cast: false, keep: true });
  const cap = new THREE.CircleGeometry(R * 1.2, 32, 0, Math.PI);
  K.mesh(cap, mat, { z: Z0, ry: Math.PI, cast: false, keep: true });
  void seed;
}
function ribs(K, { R, Z0, Z1, color }) {
  const { THREE } = K, m = K.solid(color, { roughness: 0.5 });
  const geo = new THREE.TorusGeometry(R - 0.25, 0.32, 10, 40, Math.PI);
  for (let z = Z0 - 3; z > -Z1 + 2; z -= 2.8) K.mesh(geo, m, { z, cast: false });
}
function stalactites(K, { R, Z0, Z1, rnd, color }) {
  const { THREE } = K, m = K.solid(color, { roughness: 0.9, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const a = 0.35 + rnd() * (Math.PI - 0.7), z = Z0 - 2 - rnd() * (Z0 + Z1 - 4), h = 0.6 + rnd() * 1.8;
    K.mesh(new THREE.ConeGeometry(0.18 + rnd() * 0.3, h, 6), m, { x: Math.cos(a) * (R - 0.6), y: Math.sin(a) * (R - 0.6) - h / 2, z, rx: Math.PI, cast: false });
  }
}
function wallGlows(K, { R, rnd, glow, color }) {
  const { THREE } = K;
  const m = glow.add(new THREE.MeshStandardMaterial({ color, emissive: color }), { day: 0.9, night: 2.5, warm: 1.4 });
  for (let i = 0; i < 18; i++) { const a = 0.25 + rnd() * (Math.PI - 0.5), z = 10 - rnd() * 34; K.mesh(new THREE.SphereGeometry(0.12 + rnd() * 0.18, 10, 8), m, { x: Math.cos(a) * (R - 0.25), y: Math.sin(a) * (R - 0.25), z, cast: false }); }
}
/** the bright opening at the far end; for a creature, a mouth with teeth */
function farLight(K, glow, { R, Z1, color, mouth, teeth }) {
  const { THREE } = K;
  const m = glow.add(new THREE.MeshStandardMaterial({ color, emissive: color }), { day: 2.2, night: 1.2, warm: 2.4 });
  const disc = K.mesh(new THREE.CircleGeometry(R * 0.55, 32), m, { y: R * 0.35, z: -Z1 + 0.5, cast: false, keep: true });
  disc.scale.set(1.25, 0.7, 1);
  if (mouth) {
    const tm = K.solid(teeth ?? "#fff8e8", { roughness: 0.35 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 13) * Math.PI, x = Math.cos(a) * R * 0.68, top = R * 0.35 + Math.sin(a) * R * 0.38;
      K.mesh(new THREE.ConeGeometry(0.28, 0.9, 6), tm, { x, y: top - 0.3, z: -Z1 + 0.8, rx: Math.PI });
      K.mesh(new THREE.ConeGeometry(0.28, 0.9, 6), tm, { x, y: Math.max(0.4, R * 0.35 - Math.sin(a) * R * 0.3) + 0.35, z: -Z1 + 0.8 });
    }
  }
  // the rest of the far wall (closes the tube around the opening)
  const wall = new THREE.Shape(); wall.moveTo(-R * 1.2, 0); wall.lineTo(R * 1.2, 0); wall.lineTo(R * 1.2, R * 1.2); wall.lineTo(-R * 1.2, R * 1.2); wall.closePath();
  const hole = new THREE.Path(); hole.absellipse(0, R * 0.35, R * 0.69, R * 0.385, 0, Math.PI * 2, true); wall.holes.push(hole);
  K.mesh(new THREE.ShapeGeometry(wall, 24), K.solid("#2a1418", { roughness: 0.6, side: THREE.DoubleSide }), { z: -Z1, cast: false });
}
function room(K, { W, D, Z0, H, mat, glow, opening, color2 }) {
  const { THREE } = K, zc = Z0 - D / 2;
  K.bx(W, H, 0.2, mat, { y: H / 2, z: Z0 - D, cast: false });
  K.bx(W, H, 0.2, mat, { y: H / 2, z: Z0, cast: false });
  for (const s of [-1, 1]) K.bx(0.2, H, D, mat, { x: s * W / 2, y: H / 2, z: zc, cast: false });
  K.bx(W, 0.2, D, K.solid("#f4efe6", { roughness: 0.9 }), { y: H, z: zc, cast: false });
  K.bx(W, 0.25, 0.08, K.solid(color2 ?? "#ffffff"), { y: 0.12, z: Z0 - D + 0.14 });
  if (opening === "window" || opening === "none") {
    const m = glow.add(new THREE.MeshStandardMaterial({ color: "#cfe9ff", emissive: "#bfe2ff" }), { day: 1.4, night: 0.15, warm: 1.2 }, { night: "#1a2850" });
    K.bx(2.6, 1.6, 0.06, m, { x: 2.4, y: 2.0, z: Z0 - D + 0.12, keep: true });
    K.bx(2.8, 0.1, 0.12, K.solid("#ffffff"), { x: 2.4, y: 1.16, z: Z0 - D + 0.16 });
  }
  if (opening === "door" || opening === "none" || opening === "window") {
    K.bx(1.2, 2.3, 0.08, K.solid(color2 ?? "#8a5a3a", { roughness: 0.5 }), { x: -2.6, y: 1.15, z: Z0 - D + 0.14 });
    K.bx(0.08, 0.08, 0.1, K.solid("#e0c060", { metalness: 0.8, roughness: 0.3 }), { x: -2.15, y: 1.1, z: Z0 - D + 0.22 });
  }
}
function dome(K, { top, bottom }) {
  const { THREE } = K;
  const g = new THREE.SphereGeometry(140, 32, 16), p = g.attributes.position, c = [], a = new THREE.Color(bottom), b = new THREE.Color(top), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) + 40) / 180)); t.copy(a).lerp(b, k); c.push(t.r, t.g, t.b); }
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  const m = K.mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }), { cast: false, shadow: false, keep: true });
  m.renderOrder = -0.5;
}
function lightShafts(K, rnd) {
  const { THREE } = K;
  const m = new THREE.MeshBasicMaterial({ color: "#d8f6ff", transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 7; i++) K.mesh(new THREE.CylinderGeometry(0.4, 2.4, 40, 12, 1, true), m, { x: (rnd() * 2 - 1) * 14, y: 18, z: -14 - rnd() * 20, rz: (rnd() - 0.5) * 0.4, cast: false, shadow: false, keep: true });
}
function seaweed(K, rnd, updates, col) {
  const { THREE } = K, list = [];
  for (let i = 0; i < 34; i++) {
    const x = (rnd() * 2 - 1) * 14, z = 6 - rnd() * 34; if (Math.abs(x) < 2.6 && z > -9) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); K.root.add(g);
    const n = 4 + Math.floor(rnd() * 4), m = K.solid(i % 3 ? "#2f9a5a" : col(2), { roughness: 0.6 });
    let parent = g;
    for (let k = 0; k < n; k++) { const seg = new THREE.Group(); seg.position.y = k ? 0.55 : 0; parent.add(seg); const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.14), m); b.position.y = 0.27; b.castShadow = true; seg.add(b); list.push({ seg, k, ph: rnd() * 6 }); parent = seg; }
  }
  updates.push((t) => { for (const s of list) s.seg.rotation.z = Math.sin(t * 1.3 + s.ph + s.k * 0.6) * 0.12; });
}
function starfield(K, rnd, color) {
  const { THREE } = K;
  K.mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: false }), { cast: false, shadow: false, keep: true });
  const n = 1500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const th = rnd() * Math.PI * 2, ph = rnd() * 1.4; pos.set([Math.cos(th) * Math.cos(ph) * 280, Math.sin(ph) * 280, Math.sin(th) * Math.cos(ph) * 280], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 2, sizeAttenuation: false, fog: false })); s.frustumCulled = false; K.root.add(s);
}
function planet(K, { color, color2 }) {
  const { THREE } = K;
  const t = K.canvas(256, 128, (p, w, h) => { p.fillStyle = color; p.fillRect(0, 0, w, h); p.fillStyle = color2; for (let y = 10; y < h; y += 22) p.fillRect(0, y, w, 8); });
  K.mesh(new THREE.SphereGeometry(40, 32, 20), new THREE.MeshBasicMaterial({ map: t, fog: false }), { x: -22, y: 64, z: -200, cast: false, shadow: false, keep: true });
}
function craters(K, rnd) {
  const { THREE } = K, m = K.solid("#8d8d95", { roughness: 1 });
  for (let i = 0; i < 18; i++) { const x = (rnd() * 2 - 1) * 18, z = 6 - rnd() * 40, r = 0.8 + rnd() * 2.2; if (Math.abs(x) < 2.5 && z > -6) continue; const c = K.mesh(new THREE.TorusGeometry(r, r * 0.18, 6, 24), m, { x, y: 0.02, z, rx: -Math.PI / 2 }); c.scale.set(1, 1, 0.6); }
}
function hillRing(K, rnd, pal) {
  const { THREE } = K;
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9, d = 70 + rnd() * 60, r = 14 + rnd() * 22, h = 8 + rnd() * 22;
    const m = K.mesh(new THREE.ConeGeometry(r, h, 7, 1), K.solid(pal[i % pal.length], { roughness: 1, flatShading: true }), { x: Math.cos(a) * d, y: h / 2 - 1, z: Math.sin(a) * d, cast: false, keep: true });
    m.rotation.y = rnd() * 6;
  }
}
function particles(K, kind, updates, { R }) {
  const { THREE } = K, n = 420, pos = new Float32Array(n * 3), base = [];
  const r = lcg(hash(kind));
  for (let i = 0; i < n; i++) base.push([(r() * 2 - 1) * R, r() * 8, 10 - r() * 34, r() * 6]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = K.canvas(32, 32, (p) => { const gr = p.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(kind === "bubbles" ? 0.7 : 0.4, "rgba(255,255,255,0.8)"); gr.addColorStop(1, "rgba(255,255,255,0)"); p.fillStyle = gr; p.fillRect(0, 0, 32, 32); });
  const color = { dust: "#fff1d0", bubbles: "#e8fbff", snow: "#ffffff", spores: "#d8ffb0" }[kind] ?? "#ffffff";
  const size = { dust: 0.05, bubbles: 0.12, snow: 0.09, spores: 0.08 }[kind] ?? 0.08;
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: dot, transparent: true, depthWrite: false, opacity: kind === "dust" ? 0.6 : 0.9 }));
  pts.frustumCulled = false; K.root.add(pts);
  const set = (t) => {
    for (let i = 0; i < n; i++) {
      const [x, y, z, ph] = base[i];
      let X = x, Y = y, Z = z;
      if (kind === "bubbles") { Y = (y + t * 0.7) % 8; X = x + Math.sin(t * 2 + ph) * 0.08; }
      else if (kind === "snow") { Y = 8 - ((8 - y + t * 0.8) % 8); X = x + Math.sin(t * 0.7 + ph) * 0.3; }
      else if (kind === "spores") { Y = (y + t * 0.15) % 8; X = x + Math.sin(t * 0.5 + ph) * 0.5; Z = z + Math.cos(t * 0.4 + ph) * 0.4; }
      else { X = x + Math.sin(t * 0.2 + ph) * 0.6; Y = y + Math.sin(t * 0.3 + ph) * 0.2; }
      pos[i * 3] = X; pos[i * 3 + 1] = Math.max(0.05, Y); pos[i * 3 + 2] = Z;
    }
    g.attributes.position.needsUpdate = true;
  };
  set(0); updates.push(set);
}
