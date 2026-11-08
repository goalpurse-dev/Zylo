// Kit: water bodies (scene language v2, phase 2; SCENE_LANGUAGE_V2.md section 3 "water"). A "waterBody" part fills the
// ground (a terrain part's, or the flat yard's) up to its level between x0 and x1: the sea against a coast, a river in a
// gorge or a riverbed, a lake behind a dam, a pool. Its surface ripples (waves on the sea), and its section shows as a
// see-through band in the cut face down to the ground under it, so a river in a gorge or the sea at a cliff reads.
// Channels: level (rise / fall / flood, metres), dirty, freeze, flow. Pure functions first (Node), the builder last.
import { WORLD, terrainModel } from "./terrain.js";

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const WATER_COLORS = Object.freeze({ sea: "#1f6fc2", river: "#2b86c9", lake: "#2f7fd0", pool: "#3fb4e6" });

/** the water's settings with their defaults; the sea reaches the horizon on its open side */
export function waterSpec(p = {}) {
  const body = ["sea", "river", "lake", "pool"].includes(p.body) ? p.body : "river";
  let x0 = num(p.x0, -6), x1 = num(p.x1, 6);
  if (body === "sea") { if (x0 <= -WORLD.X + 0.5) x0 = -WORLD.FAR; if (x1 >= WORLD.X - 0.5) x1 = WORLD.FAR; }
  return { body, x0, x1, level: num(p.level, -1), z0: num(p.z0, body === "sea" ? -WORLD.FAR : -WORLD.D), depth: num(p.depth, 3), waves: p.waves ?? body === "sea", color: p.color ?? WATER_COLORS[body], murky: !!p.murky, rise: num(p.rise, 1.5), flood: num(p.flood, 3) };
}

/** the box the camera frames: the section of the water at the face, from its bed (the terrain, or depth below) to its level */
export function waterBox(p = {}, terrain = null) {
  const s = waterSpec(p), T = terrain ? terrainModel(terrain) : null;
  const xa = Math.max(s.x0, -WORLD.X), xb = Math.min(s.x1, WORLD.X);
  let bed = s.level - s.depth;
  if (T) { bed = s.level; for (let x = xa; x <= xb; x += 0.5) bed = Math.min(bed, T.top(x)); }
  return { min: [xa, bed - 0.2, -6], max: [xb, s.level + Math.max(0, s.flood) * 0 + 0.3, 0.2] };
}

// ---------------- the page ----------------
/**
 * Builds a water body. ctx.terrain (kit/terrain.js buildTerrain) gives the ground it fills; without one the ground is flat
 * at y 0 and the water fills a basin `depth` deep. Returns { group, update(t, ch) } with ch = { level, dirty, freeze, flow }.
 */
export function buildWater(ctx, p = {}) {
  const { THREE } = ctx, s = waterSpec(p), T = ctx.terrain?.model ?? null, group = new THREE.Group(); ctx.scene.add(group);
  const ground = (x) => (T ? T.top(x) : s.level - s.depth);
  const base = new THREE.Color(s.color), dirtyC = new THREE.Color(s.murky ? "#6b5a32" : "#7a6438"), iceC = new THREE.Color("#e8f4fb");
  // the surface: a grid that ripples (waves on the sea)
  const W = s.x1 - s.x0, D = -s.z0, sx = Math.max(8, Math.min(240, Math.round(W / (s.body === "sea" ? 1.5 : 0.5)))), sz = Math.max(4, Math.min(120, Math.round(D / (s.body === "sea" ? 1.5 : 0.5))));
  const sg = new THREE.PlaneGeometry(W, D, sx, sz); sg.rotateX(-Math.PI / 2); sg.translate((s.x0 + s.x1) / 2, 0, s.z0 / 2);
  const topM = new THREE.MeshPhysicalMaterial({ color: base.clone(), transparent: true, opacity: s.murky ? 0.92 : 0.78, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
  const surf = new THREE.Mesh(sg, topM); surf.receiveShadow = true; surf.renderOrder = 3; group.add(surf);
  const sp = sg.attributes.position, rest = Float32Array.from(sp.array);
  // the section: a band in the face from the ground up to the level (columns, so its lower edge follows the ground)
  const fxs = []; for (let x = Math.max(s.x0, -WORLD.X); x <= Math.min(s.x1, WORLD.X) + 1e-6; x += 0.2) fxs.push(+x.toFixed(3));
  const fpos = [], fidx = [];
  fxs.forEach((x, i) => { fpos.push(x, ground(x), 0.025, x, 0, 0.025); if (i) { const k = i * 2; fidx.push(k - 2, k, k - 1, k, k + 1, k - 1); } });
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3)); fgeo.setIndex(fidx); fgeo.computeVertexNormals();
  const faceM = new THREE.MeshPhysicalMaterial({ color: base.clone(), transparent: true, opacity: s.murky ? 0.85 : 0.55, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, envMapIntensity: 1.4 });
  const face = new THREE.Mesh(fgeo, faceM); face.renderOrder = 4; group.add(face);
  const fp = fgeo.attributes.position;
  const setLevel = (lv) => {
    for (let i = 0; i < fxs.length; i++) { const g = ground(fxs[i]); fp.setY(i * 2, Math.min(g, lv)); fp.setY(i * 2 + 1, Math.max(lv, Math.min(g, lv))); }
    fp.needsUpdate = true;
  };
  setLevel(s.level);
  return {
    group, mesh: surf,
    update(t, ch = {}) {
      const lv = s.level + (ch.level ?? 0);
      // ripples drift with the flow; the sea's waves are taller
      const amp = s.waves ? 0.12 : 0.03, sp2 = 0.6 + 2.2 * (ch.flow ?? 0) + (s.body === "river" ? 0.8 : 0);
      for (let i = 0; i < sp.count; i++) { const x = rest[i * 3], z = rest[i * 3 + 2]; sp.setY(i, lv + amp * Math.sin(x * 0.7 - t * sp2) * Math.cos(z * 0.5 + t * 0.4) * (1 - (ch.freeze ?? 0))); }
      sp.needsUpdate = true; sg.computeVertexNormals();
      setLevel(lv);
      const d = Math.min(1, Math.max(0, ch.dirty ?? 0)), f = Math.min(1, Math.max(0, ch.freeze ?? 0));
      for (const m of [topM, faceM]) { m.color.copy(base).lerp(dirtyC, d).lerp(iceC, f); }
      topM.opacity = Math.min(1, (s.murky ? 0.92 : 0.78) + 0.2 * f + 0.15 * d); topM.roughness = 0.08 + 0.5 * f;
      faceM.opacity = Math.min(0.95, (s.murky ? 0.85 : 0.55) + 0.3 * d + 0.3 * f);
    },
  };
}
