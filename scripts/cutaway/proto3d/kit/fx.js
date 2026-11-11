// M2 kit: effects, so every event the narration names happens on screen (the owner's rule of 2026-11-05: "a blast"
// showed nothing). One part per effect, at a point, sized to the thing it happens to:
//   one-shot, channel "go" (0 -> 1 over its length; it plays as the channel rises and leaves what it made):
//     blast    a white-orange flash, a shockwave ring along the ground, debris flying out and falling
//     crash    an impact: a small flash, chunks knocked off, a dust puff (also: smash, snap, break, burst)
//     crack    dark jagged cracks spreading over the face from the point, a puff of dust; they stay
//     collapse chunks dropping and a rolling dust cloud (cave in, crumble)
//   states, channel "on" (they run while it is on):
//     fire     flickering flames     smoke   grey puffs rising      drip   drops falling from the point
//     splash   water spraying up     spark   electric sparks        frost  white frost crystals spreading
//     swirl    curved arrows circling (a spin)                       motes  slow drifting specks (life in a still moment)
import { clamp01 } from "./verbs.js";
import { droplets, foamPatch, ribbonGeometry, streamMaterial, waterClock, waterNew, WATER_TINTS } from "./water.js";

const rand = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * Water running off an edge (a roof's eaves, a gutter's lip, a weir) in the one water look (rule 17, 2026-11-11): a
 * translucent falling sheet x0..x1 wide at z from yTop to yBot, bowing a little outward as it falls, streaks running
 * down it, foam and a few droplets where it lands. It replaces the rain-streak curtain for custom layouts (the stream
 * kind, m2/parts.js). update(t, on)
 */
export function fallSheet(ctx, { x0 = 0, x1 = 0.4, z = 0, yTop = 2, yBot = 0, color = null } = {}) {
  const { THREE } = ctx, clock = waterClock(ctx);
  const a = Number(x0), b = Number(x1), cx = (a + b) / 2, w = Math.max(0.12, Math.abs(b - a)), h = Math.max(0.2, Number(yTop) - Number(yBot));
  const out = Math.sign(cx) || 1, bow = Math.min(0.35, h * 0.1);
  const pts = [[cx, yTop, z], [cx + out * bow * 0.6, yTop - h * 0.2, z], [cx + out * bow, yTop - h * 0.6, z], [cx + out * bow * 1.05, yBot, z]].map((q) => new THREE.Vector3(...q));
  const { geo, length } = ribbonGeometry(THREE, pts, (u) => w * (1 + 0.25 * u), { side: () => new THREE.Vector3(1, 0, 0) });
  const mat = streamMaterial(ctx, { color: color ?? "#8cc8d6", opacity: 0.85, speed: 5.5, streak: 0.8, edge: 0.75, env: 0.8 });
  const sheet = new THREE.Mesh(geo, mat); sheet.renderOrder = 5; sheet.visible = false; ctx.scene.add(sheet);
  const foot = [cx + out * bow * 1.05, Number(yBot), z];
  const foam = foamPatch(ctx, { at: foot, r: Math.max(0.25, w * 0.9) });
  const drops = droplets(ctx, { at: foot, n: 10, size: 0.03, spread: 0.45, height: 0.35, speed: 1.6 });
  return {
    update(t, on) {
      clock.set(t);
      const k = clamp01(on);
      // (it pours from the top down as it starts, and the foam begins when the water reaches the ground)
      sheet.visible = k > 0.01; mat.userData.stream.set({ on: Math.min(1, k * 1.4), reach: length * Math.min(1, k * 1.6) });
      foam.set(k > 0.6 ? (k - 0.6) / 0.4 : 0); drops.set(t, k > 0.6 ? 1 : 0);
    },
  };
}

export function fx(ctx, p, api) {
  const { THREE, C } = ctx, std = ctx.std;
  const root = new THREE.Group(); root.position.set(...(p.at ?? [0, 0, 0])); ctx.scene.add(root);
  const s = Number(p.size ?? 1), type = p.type ?? "blast";
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; root.add(m); return m; };
  const glowM = (col, op = 1) => new THREE.MeshBasicMaterial({ color: C(col), transparent: true, opacity: op, depthWrite: false, toneMapped: false });
  const solid = (col, rough = 0.9) => std({ color: C(col), roughness: rough });
  const parts = [];
  // pieces: n chunks with their own direction, speed and spin
  const chunks = (n, col, size) => Array.from({ length: n }, (_, i) => {
    const m = mesh(new THREE.BoxGeometry(size * (0.6 + rand(i, 1) * 0.8), size * (0.5 + rand(i, 2) * 0.6), size * (0.6 + rand(i, 3) * 0.7)), solid(col));
    const a = rand(i, 4) * Math.PI * 2, up = 0.4 + rand(i, 5) * 0.9, sp = 0.6 + rand(i, 6);
    return { m, d: [Math.cos(a) * sp, up, Math.sin(a) * sp * 0.6 + 0.35], r: [rand(i, 7) * 9, rand(i, 8) * 9] };
  });
  const puffs = (n, col, op) => Array.from({ length: n }, (_, i) => ({ m: mesh(new THREE.SphereGeometry(0.5 * s, 12, 10), glowM(col, op)), a: rand(i, 9) * Math.PI * 2, k: 0.5 + rand(i, 10) }));
  let update = () => {};

  if (type === "blast" || type === "crash" || type === "collapse") {
    const big = type === "blast";
    const flash = mesh(new THREE.SphereGeometry(0.6 * s, 20, 16), glowM("#fff1c2", 1)), core = mesh(new THREE.SphereGeometry(0.4 * s, 16, 12), glowM("#ff9a2e", 1));
    const ring = mesh(new THREE.TorusGeometry(1, 0.06 * s, 8, 48), glowM("#ffffff", 0.8)); ring.rotation.x = Math.PI / 2;
    const deb = chunks(big ? 18 : type === "collapse" ? 14 : 10, type === "blast" ? "#5b5148" : "#7a6a58", 0.18 * s);
    const dust = puffs(big ? 10 : 8, "#bfb2a0", 0.55);
    update = (t) => {
      const u = clamp01(api.ch("go", t)), on = u > 0.001;
      root.visible = on; if (!on) return;
      const fl = big || type === "crash" ? Math.max(0, 1 - u / 0.25) : 0;
      flash.visible = fl > 0.01; flash.scale.setScalar(0.4 + (1 - fl) * (big ? 2.4 : 1.2)); flash.material.opacity = fl;
      core.visible = fl > 0.01; core.scale.setScalar(0.5 + (1 - fl) * 1.6); core.material.opacity = fl;
      const rw = big ? Math.min(1, u / 0.6) : 0; ring.visible = big && rw < 1; ring.scale.setScalar(0.3 + rw * 4 * s); ring.material.opacity = 0.8 * (1 - rw);
      // (a blast's debris clears 1.2 s after it lands: the cubes lay on the ground to the end of the video, the owner's
      // list of 2026-11-07; a crash's or a collapse's chunks are the damage, and damage stays)
      // (and so do the chunks of a crash placed in the air: they settle at the effect's own height, so they floated beside
      // the house to the end, the electricity stand-in of 2026-11-10; on the ground they are the damage and stay)
      const airborne = !big && type === "crash" && Array.isArray(p.at) && Number(p.at[1]) > 0.6;
      const cue = api.cue("go"), fade = (big || airborne) && cue ? clamp01(1 - (t - cue.t1 - 1.2) / 0.6) : 1;
      for (const c of deb) {
        const k = type === "collapse" ? 0.3 : 1, x = c.d[0] * u * 2.2 * s * k, z = c.d[2] * u * 1.6 * s * k, y = type === "collapse" ? 1.2 * s * (1 - u) - 0.2 : Math.max(-0.1, c.d[1] * u * 2.8 * s - 4.5 * s * u * u);
        c.m.position.set(x, y, z); c.m.rotation.set(c.r[0] * u, c.r[1] * u, 0);
        c.m.visible = fade > 0.01; c.m.scale.setScalar(Math.max(0.001, fade));
      }
      dust.forEach((d, i) => { const k = clamp01(u * 1.4 - 0.1); d.m.position.set(Math.cos(d.a) * k * 1.6 * s, 0.25 * s + k * 0.6 * s * d.k, Math.sin(d.a) * k * 0.8 * s + 0.3); d.m.scale.setScalar(0.4 + k * 1.3 * d.k); d.m.material.opacity = 0.55 * (1 - k * 0.85); });
    };
  } else if (type === "crack") {
    // a few jagged lines from the point across the face (z = the point's), growing with "go", staying
    const lines = [];
    for (let j = 0; j < 5; j++) {
      const pts = [new THREE.Vector3(0, 0, 0)]; let a = (j / 5) * Math.PI * 2 + rand(j, 1);
      for (let k = 1; k <= 6; k++) { a += (rand(j, k) - 0.5) * 1.1; const last = pts[pts.length - 1]; pts.push(new THREE.Vector3(last.x + Math.cos(a) * 0.35 * s, last.y + Math.sin(a) * 0.3 * s, 0.01)); }
      const m = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0), 40, 0.035 * s, 6), new THREE.MeshBasicMaterial({ color: C("#1a1410") }));
      m.geometry.setDrawRange(0, 0); lines.push(m);
    }
    const dust = puffs(5, "#c9bca8", 0.5);
    update = (t) => {
      const u = clamp01(api.ch("go", t)); root.visible = u > 0.001; if (!root.visible) return;
      for (const m of lines) m.geometry.setDrawRange(0, Math.floor(m.geometry.index.count * u));
      dust.forEach((d, i) => { const k = clamp01(u * 2); d.m.position.set(Math.cos(d.a) * k * 0.8 * s, k * 0.4 * s, 0.25); d.m.scale.setScalar(0.3 + k * 0.6); d.m.material.opacity = 0.5 * Math.max(0, 1 - u * 1.3); });
    };
  } else {
    // the states: n particles on a loop while "on"
    const spec = {
      fire: { n: 14, col: "#ff8a1e", col2: "#ffd34d", glow: true }, smoke: { n: 10, col: "#7c7f84", glow: false }, drip: { n: 6, col: "#4aa3e8", glow: false },
      splash: { n: 16, col: "#6fb8ee", glow: false }, spark: { n: 12, col: "#fff27a", glow: true }, frost: { n: 26, col: "#eaf6ff", glow: false },
      swirl: { n: 3, col: "#ffffff", glow: false }, motes: { n: 30, col: "#fffbe8", glow: true },
    }[type] ?? { n: 10, col: "#ffffff" };
    // (a colour of its own: brown sewage drips, amber fuel, black smoke; the owner's list of 2026-11-07)
    if (typeof p.color === "string") { spec.col = p.color; spec.col2 = null; }
    // (look "drops": water as small clear droplets stretched along their flight, not blue balls; the owner on the real
    // dishwasher run, 2026-11-10. Only when asked for: a premade video keeps its approved splash)
    // (and for every custom layout, the one water look of rule 17, 2026-11-11: drops, never blue balls; a splash on the
    // ground or on water also gets foam and spreading rings under it)
    const nu = waterNew(ctx), drops = (p.look === "drops" || (nu && p.look === undefined)) && (type === "splash" || type === "drip");
    if (drops) spec.n = type === "splash" ? 30 : 14;
    const at0 = p.at ?? [0, 0, 0], splashFoam = nu && drops && type === "splash" && Number(at0[1]) < 0.2 && typeof p.color !== "string" ? foamPatch(ctx, { at: [Number(at0[0]) || 0, Number(at0[1]) || 0, Number(at0[2]) || 0], r: 0.45 * s }) : null;
    const fxClock = nu ? waterClock(ctx) : null;
    const P = Array.from({ length: spec.n }, (_, i) => {
      let geo;
      if (type === "swirl") { const curve = new THREE.EllipseCurve(0, 0, 1.1 * s, 0.7 * s, i * 2.1, i * 2.1 + 1.6); geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve.getPoints(16).map((q) => new THREE.Vector3(q.x, 0, q.y))), 24, 0.06 * s, 6); }
      else if (type === "frost") geo = new THREE.OctahedronGeometry(0.09 * s * (0.6 + rand(i, 3)), 0);
      else if (type === "spark") geo = new THREE.BoxGeometry(0.02 * s, 0.22 * s, 0.02 * s);
      else if (type === "fire") geo = new THREE.SphereGeometry(0.16 * s, 12, 10);
      else if (drops) geo = new THREE.SphereGeometry(0.03 * s * (0.7 + rand(i, 3) * 0.6), 10, 8);
      else geo = new THREE.SphereGeometry((type === "smoke" ? 0.28 : type === "motes" ? Math.min(0.075, 0.1 / Math.max(s, 0.01)) : 0.07) * s, 10, 8);
      const mat = spec.glow ? glowM(i % 2 && spec.col2 ? spec.col2 : spec.col, 0.9) : solid(spec.col, type === "frost" ? 0.3 : 0.6);
      // (smoke with more contrast against a pale sky: darker and denser, unless it was given a colour)
      // (custom layouts: clearer drops, 0.5; they read as white rice in the rain, the water round of 2026-11-11)
      if (drops) { mat.transparent = true; mat.opacity = nu ? 0.5 : 0.72; mat.roughness = 0.08; mat.depthWrite = false; if (typeof p.color !== "string") mat.color.set("#bfe4ff"); }
      if (type === "smoke") { mat.transparent = true; mat.opacity = 0.78; mat.depthWrite = false; if (typeof p.color !== "string") mat.color.set("#55585e"); }
      return { m: mesh(geo, mat), ph: rand(i, 1), a: rand(i, 2) * Math.PI * 2, k: rand(i, 4) };
    });
    update = (t) => {
      const on = clamp01(api.ch("on", t));
      if (fxClock) fxClock.set(t);
      if (splashFoam) splashFoam.set(on);
      root.visible = on > 0.01; if (!root.visible) return;
      // (a fire, sparks, a splash or drips shrink as they stop: they stayed full size until "on" was all but 0, so a stop on
      // a line's last word still showed the fire in its end frame, the lighthouse stand-in of 2026-11-10)
      if (["fire", "spark", "splash", "drip"].includes(type)) root.scale.setScalar(Math.max(0.05, on));
      P.forEach((q, i) => {
        const f = (t * (type === "smoke" ? 0.35 : type === "motes" ? 0.12 : type === "drip" ? 0.9 : 1.4) + q.ph) % 1, m = q.m;
        m.visible = true;
        if (type === "fire") { m.position.set(Math.cos(q.a) * 0.35 * s * (1 - f), f * 0.9 * s, Math.sin(q.a) * 0.2 * s); m.scale.set(1 - f * 0.7, 1.6 - f, 1 - f * 0.7); }
        else if (type === "smoke") { m.position.set(Math.sin(f * 3 + q.a) * 0.3 * s, f * 2.2 * s, 0.1); m.scale.setScalar(0.5 + f * 1.6); m.material.opacity = 0.6 * (1 - f) * on; }
        else if (drops) {
          // stretched along the way it flies: up and out, then down (a splash); straight down (a drip)
          const d = f, v = type === "splash" ? [Math.cos(q.a) * 0.9, 1.6 - 4.4 * d, Math.sin(q.a) * 0.5] : [0, -1.6, 0];
          if (type === "splash") m.position.set(Math.cos(q.a) * d * 0.9 * s, d * 1.6 * s - d * d * 2.2 * s, Math.sin(q.a) * d * 0.5 * s + 0.1);
          else m.position.set((q.k - 0.5) * 0.4 * s, -f * 1.6 * s, 0.05);
          const len = Math.hypot(...v) || 1; m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(v[0] / len, v[1] / len, v[2] / len)); m.scale.set(1, 1.8 + Math.min(1.6, len * 0.6), 1);
        }
        else if (type === "drip") { m.position.set((q.k - 0.5) * 0.4 * s, -f * 1.6 * s, 0.05); m.scale.set(1, 1.6, 1); }
        else if (type === "splash") { const d = f; m.position.set(Math.cos(q.a) * d * 0.9 * s, d * 1.6 * s - d * d * 2.2 * s, Math.sin(q.a) * d * 0.5 * s + 0.1); }
        else if (type === "spark") { m.position.set(Math.cos(q.a) * f * 0.8 * s, Math.sin(q.a) * f * 0.8 * s, 0.1); m.rotation.z = q.a + Math.PI / 2; m.visible = f < 0.6; }
        // (frost stays on the cold thing: a ring 1.4x its size wide put the dishwasher's crystals on the floor beside the
        // machine, the real run of 2026-11-10; now at most 0.8x)
        else if (type === "frost") { const r = Math.min(1, on * 1.2) * (0.15 + q.k * 0.65) * s; m.position.set(Math.cos(q.a) * r, Math.sin(q.a) * r * 0.6, 0.05); m.rotation.set(q.a, q.k * 3, 0); m.scale.setScalar(on); }
        else if (type === "swirl") { root.rotation.y = t * 2.4; m.position.set(0, i * 0.02, 0); }
        else if (type === "motes") { m.position.set((q.k - 0.5) * 3 * s + Math.sin(t * 0.9 + q.a) * 0.35 * s, ((q.ph + t * 0.22) % 1) * 2.4 * s, Math.cos(q.a) * 0.8 * s + 0.3); m.material.opacity = 0.95 * on * Math.sin(Math.PI * ((q.ph + t * 0.22) % 1)); }
      });
    };
  }
  return { group: root, update(t) { update(t); } };
}

/** the box an effect covers (the camera and the checks) */
export function fxBox(p) {
  const [x, y, z] = p.at ?? [0, 0, 0], s = Number(p.size ?? 1), r = (p.type === "blast" ? 4 : p.type === "smoke" ? 2.2 : 1.6) * s;
  return { min: [x - r, y - 0.2, z - r * 0.5], max: [x + r, y + r, z + r * 0.5] };
}
