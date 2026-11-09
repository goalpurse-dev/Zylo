// Blocky Worlds sets: the three lights. "day" = the locked look (look/scene.js, key L): clear-sky HDRI for reflections,
// the blue sky dome with procedural clouds, the warm sun with one shadow map, a hemisphere fill. "night" = the look's
// Ln: moonlit HDRI, a dark blue sky with stars and a moon, a cold moon light, and the set's warm practical lights
// (street lamps, the bedside lamp, the hallway lights). "warm" = a golden-hour ending: low orange sun, long shadows,
// a peach horizon. One shadow-casting light per set; switching is undone completely by dispose().
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RIGS } from "../lib/setThemes.js"; // SETS-V2: the lighting rigs (makeRigLayer)

const HDR = { day: "/assets/ph/hdri/kloofendal_43d_clear_puresky.hdr", night: "/assets/ph/hdri/moonlit_golf.hdr" };
const ENV = new Map();
/** load both sky HDRIs once (buildSet awaits this, so applyLight can stay synchronous) */
export function preloadEnv(THREE) {
  const loader = new RGBELoader();
  return Promise.all(Object.entries(HDR).map(([k, url]) => {
    if (!ENV.has(k)) ENV.set(k, loader.loadAsync(url).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; ENV.set(k + "!", t); return t; }));
    return ENV.get(k);
  }));
}

let LIGHT_GEN = 0;
/** how many base light switches so far (the rig layer re-syncs on a change) */
export const lightGen = () => LIGHT_GEN;

/** per light: everything that is not set-specific */
const MODES = {
  day: {
    env: "day", envI: 0.55, exposure: 0.86,
    sky: { zen: "#0b52d0", hor: "#4ea6f2", k: 1.0, clouds: 1, cloudLit: "#ffffff", cloudShade: "#c7d1e6", sunCol: "#fff2d6", sunGlow: 0.25 },
    fog: ["#6aa6e0", 220, 3200],
    sun: { color: "#ffe2b0", intensity: 4.3, dir: [30, 40, 34] },
    hemi: ["#cfe6ff", "#8a7a52", 0.45],
  },
  night: {
    env: "night", envI: 0.2, exposure: 0.9,
    sky: { zen: "#020718", hor: "#13234a", k: 1.0, clouds: 0, cloudLit: "#2a3a66", cloudShade: "#0c1430", sunCol: "#9fb6ff", sunGlow: 0.0 },
    fog: ["#16244c", 30, 260],
    sun: { color: "#8fa8ff", intensity: 0.85, dir: [-30, 50, -20] },
    hemi: ["#2c3f78", "#07070f", 0.22],
    stars: 1, moon: true, windows: 1,
  },
  // WORLD-LOOK 2026-11-06: dusk (after sunset: deep blue zenith, orange-pink horizon, first stars, windows lit) and
  // dawn (before sunrise: pale rose horizon, cool soft light, last stars fading)
  dusk: {
    env: "night", envI: 0.32, exposure: 0.95,
    sky: { zen: "#14204e", hor: "#e07a4e", k: 1.0, clouds: 0.55, cloudLit: "#f2a07a", cloudShade: "#4a3a66", sunCol: "#ff8a4a", sunGlow: 0.8 },
    fog: ["#6a5a7a", 220, 2600],
    sun: { color: "#ff9a5a", intensity: 1.6, dir: [40, 6, -12] },
    hemi: ["#8a8ac8", "#3a2a2a", 0.5],
    stars: 0.45, windows: 0.8,
  },
  dawn: {
    env: "day", envI: 0.25, exposure: 0.9,
    sky: { zen: "#3a5aa0", hor: "#f4b0a0", k: 1.0, clouds: 0.6, cloudLit: "#ffd0c0", cloudShade: "#8a8ab0", sunCol: "#ffc090", sunGlow: 0.7 },
    fog: ["#c8b4c0", 260, 3000],
    sun: { color: "#ffc8a0", intensity: 2.2, dir: [-40, 8, -20] },
    hemi: ["#c8d0f0", "#4a4048", 0.5],
    stars: 0.2, windows: 0.5,
  },
  warm: {
    env: "day", envI: 0.32, exposure: 0.9,
    sky: { zen: "#2a5ed0", hor: "#ff9a52", k: 1.0, clouds: 0.9, cloudLit: "#ffd6a8", cloudShade: "#e0877a", sunCol: "#ffb35c", sunGlow: 1.0 },
    fog: ["#f0a06a", 260, 3200],
    sun: { color: "#ffa04a", intensity: 4.2, dir: [42, 11, -6] },
    hemi: ["#ffd8b0", "#5e4636", 0.42],
    windows: 0.5,
  },
};
/** every light the engine knows (day | night | warm | dusk | dawn) */
export const LIGHT_MODES = Object.freeze(Object.keys(MODES));
/**
 * WORLD-LOOK: ONE source of truth per shot. Everything that must match the time of day (sky, fog colour, stars, moon,
 * window glow) comes from the shot's light through this table; sets give only distances (rig.fogDist) and their own
 * practicals. timeLook(name) -> { fog: colour, windows: 0..1 (lit windows / lamps), stars: 0..1, moon, sky }
 */
export function timeLook(name) {
  const M = MODES[name] ?? MODES.day;
  return { fog: M.fog[0], windows: M.windows ?? 0, stars: M.stars === true ? 1 : Number(M.stars) || 0, moon: !!M.moon, sky: { ...M.sky }, sunDir: M.sun.dir.slice() };
}

const SKY_VS = "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_FS = `uniform vec3 zen, hor, cloudLit, cloudShade, sunDir, sunCol; uniform float k, clouds, sunGlow; varying vec3 vP;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
  void main(){
    vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(hor, zen, pow(smoothstep(0.0, 0.55, h), 0.8));
    float sg = max(dot(d, normalize(sunDir)), 0.0);
    col += sunCol * (pow(sg, 6.0) * 0.55 + pow(sg, 900.0) * 4.0) * sunGlow;
    vec2 uv = d.xz / (h + 0.12) * 1.6;
    float c = fbm(uv + vec2(3.1, 7.7)); float m = smoothstep(0.52, 0.72, c) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.55, 0.9, h)) * clouds;
    float shade = fbm(uv * 1.7 + vec2(9.0, 2.0));
    vec3 cloud = mix(cloudShade, cloudLit * 1.05, smoothstep(0.35, 0.7, shade)) + sunCol * pow(sg, 4.0) * 0.35 * sunGlow;
    gl_FragColor = vec4(mix(col, cloud, m) * k, 1.0);
  }`;

/**
 * applyLight(name, { THREE, scene, renderer, set }) -> { dispose() }
 * The set (from buildSet) may carry `rig`: { shadow: { center, half, far }, indoor tweaks, fog per mode, sun dirs per
 * mode, practicals(mode) -> Light[], onLight(mode) }.
 */
export function applyLight(name, ctx) {
  const { THREE, scene, renderer, set } = ctx;
  const M = MODES[name];
  if (!M) throw new Error(`applyLight: unknown light "${name}" (${Object.keys(MODES).join(" | ")})`);
  const rig = set?.rig ?? {};
  LIGHT_GEN++; // SETS-V2: the rig layer re-syncs after every base light switch
  const prev = { fog: scene.fog, background: scene.background, environment: scene.environment, envI: scene.environmentIntensity, bgI: scene.backgroundIntensity, envRot: scene.environmentRotation?.clone(), exposure: renderer.toneMappingExposure };
  const added = [], disposables = [];
  const add = (o, parent = scene) => { parent.add(o); added.push(o); return o; };

  // sky dome (+ stars and moon at night)
  const env = ENV.get(M.env + "!");
  if (!env) console.warn("applyLight: sky HDRI not loaded yet (buildSet preloads it)");
  scene.environment = env ?? null;
  scene.environmentIntensity = M.envI * (rig.envScale?.[name] ?? rig.envScale?.all ?? 1);
  if (scene.environmentRotation) scene.environmentRotation.set(0, 2.2, 0);
  scene.background = new THREE.Color(M.sky.hor);
  const sunDirArr = rig.sunDir?.[name] ?? M.sun.dir;
  const sunDir = new THREE.Vector3(...sunDirArr).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zen: { value: new THREE.Color(M.sky.zen) }, hor: { value: new THREE.Color(M.sky.hor) }, k: { value: M.sky.k }, clouds: { value: M.sky.clouds },
      cloudLit: { value: new THREE.Color(M.sky.cloudLit) }, cloudShade: { value: new THREE.Color(M.sky.cloudShade) },
      sunDir: { value: sunDir.clone() }, sunCol: { value: new THREE.Color(M.sky.sunCol) }, sunGlow: { value: M.sky.sunGlow },
    },
    vertexShader: SKY_VS, fragmentShader: SKY_FS,
  });
  const dome = add(new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), skyMat));
  dome.renderOrder = -1; dome.frustumCulled = false; disposables.push(dome.geometry, skyMat);
  // rig.enclosed: a closed shell / cave (inside a giant creature): no stars or moon, they would read as open sky
  if (M.stars && !rig.enclosed) {
    const n = 1400, pos = new Float32Array(n * 3); let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const th = rnd() * Math.PI * 2, ph = 0.1 + rnd() * 1.35; pos.set([Math.cos(th) * Math.cos(ph) * 900, Math.sin(ph) * 900, Math.sin(th) * Math.cos(ph) * 900], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 2.0, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 * (M.stars === true ? 1 : Number(M.stars)) });
    const stars = add(new THREE.Points(sg, sm)); stars.frustumCulled = false; disposables.push(sg, sm);
  }
  if (M.moon && !rig.enclosed) {
    const mg = new THREE.CircleGeometry(16, 48), mm = new THREE.MeshBasicMaterial({ color: "#eef1ff", fog: false });
    const moonDisc = add(new THREE.Mesh(mg, mm));
    const md = new THREE.Vector3(...(rig.moonAt ?? [-0.32, 0.5, -0.8])).normalize();
    moonDisc.position.copy(md.multiplyScalar(800)); moonDisc.lookAt(0, 0, 0); disposables.push(mg, mm);
    const hg = new THREE.CircleGeometry(48, 48), hm = new THREE.MeshBasicMaterial({ color: "#6f86c8", transparent: true, opacity: 0.18, fog: false, depthWrite: false });
    const halo = add(new THREE.Mesh(hg, hm)); halo.position.copy(moonDisc.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0); disposables.push(hg, hm);
  }

  // fog
  // rig.fogDist: the set gives only the distances, the colour is the light's (sky and fog always match)
  const fd = rig.fogDist?.[name] ?? rig.fogDist?.all ?? null;
  const fog = rig.fog?.[name] ?? (fd ? [M.fog[0], fd[0], fd[1]] : rig.indoor ? null : M.fog);
  // a fog whose far end is not well past its near end fogs EVERY pixel to one colour (turtle run 1620fc3e: a 30 m
  // turtle's inside had near 45 / far 41 m: every day shot inside was a flat beige frame, every night one black)
  scene.fog = fog ? new THREE.Fog(fog[0], fog[1], Math.max(fog[2], fog[1] * 2.5, fog[1] + 60)) : null;

  // the sun / the moon: the one shadow-casting light, its box fitted to the set
  const sh = rig.shadow ?? { center: [0, 0, 0], half: 25, far: 160 };
  const c = new THREE.Vector3(...sh.center);
  const sunI = (rig.sunScale?.[name] ?? 1) * M.sun.intensity;
  const sun = add(new THREE.DirectionalLight(rig.sunColor?.[name] ?? M.sun.color, sunI));
  sun.position.copy(c).addScaledVector(sunDir, 70); sun.target.position.copy(c); add(sun.target);
  sun.castShadow = sunI > 0.01;
  const ms = sh.map ?? 2048;
  sun.shadow.mapSize.set(ms, ms);
  Object.assign(sun.shadow.camera, { left: -sh.half, right: sh.half, top: sh.half, bottom: -sh.half, near: 1, far: sh.far ?? 160 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  disposables.push({ dispose: () => sun.shadow.map?.dispose() });

  const hs = rig.hemiScale?.[name] ?? 1, hc = rig.hemi?.[name] ?? M.hemi;
  add(new THREE.HemisphereLight(hc[0], hc[1], hc[2] * hs));

  // the set's own lights (practicals) and glowing materials
  if (rig.practicals) for (const l of rig.practicals(name) ?? []) { add(l, set.root); if (l.target && l.target.parent == null) add(l.target, set.root); }
  rig.onLight?.(name);

  renderer.toneMappingExposure = rig.exposure?.[name] ?? M.exposure;

  return {
    name,
    dispose() {
      for (const o of added) o.parent?.remove(o);
      for (const d of disposables) d.dispose?.();
      scene.fog = prev.fog; scene.background = prev.background; scene.environment = prev.environment;
      scene.environmentIntensity = prev.envI; scene.backgroundIntensity = prev.bgI;
      if (prev.envRot && scene.environmentRotation) scene.environmentRotation.copy(prev.envRot);
      renderer.toneMappingExposure = prev.exposure;
      added.length = 0;
    },
  };
}

// ------------------------------------------------------------------------------------------------ SETS-V2 rig layer
/**
 * SETS-V2 2026-11-09 (owner F: "LIGHTING RIGS per mood: day, sunset, night-with-practicals, neon/emissive + bloom,
 * interior warm, alarm red. Never flat beige, never unreadably dark"). A layer ON TOP of the base light (applyLight):
 * a camera-side FILL (soft, no shadow: faces and a tower's front never read as a dark slab), a rig HEMISPHERE tint, and
 * up to four PRACTICAL point lights placed from the place (the theme dressing's lanterns / fire / neon first, else the
 * rig's side / other side / rim / back positions round the group): warm key + cool rim at night, magenta + cyan for
 * neon, a pulsing red for an alarm. The light COUNT never changes (no shader recompiles between shots); unused = 0.
 *   makeRigLayer(THREE, scene) -> { sync({ shot, S, t }), frame(camera, t), info() }
 */
export function makeRigLayer(THREE, scene) {
  const fill = new THREE.DirectionalLight("#ffffff", 0); fill.castShadow = false; fill.name = "rig:fill";
  const hemi = new THREE.HemisphereLight("#ffffff", "#000000", 0); hemi.name = "rig:hemi";
  const pts = [0, 1, 2, 3].map((i) => { const l = new THREE.PointLight("#ffffff", 0, 18, 1.6); l.castShadow = false; l.name = `rig:p${i}`; return l; });
  scene.add(fill, fill.target, hemi, ...pts);
  let key = null, rig = RIGS.day, base = [], fogBase = null, fogGen = -1, indoorK = 1;
  const V = () => new THREE.Vector3();
  function sync({ shot, S, t = 0 }) {
    const rid = RIGS[shot?.rig] ? shot.rig : null;
    const c = S?.spots?.center;
    const k = `${LIGHT_GEN}|${rid}|${shot?.placeId ?? ""}|${c ? c.toArray().map((x) => x.toFixed(1)).join() : ""}|${S?.themePracticals?.length ?? 0}`;
    if (k !== key) {
      key = k; rig = rid ? RIGS[rid] : null;
      // fog tint (neon / alarm): from the base light's fog colour, restored when the rig has none
      if (scene.fog && fogGen !== LIGHT_GEN) { fogGen = LIGHT_GEN; fogBase = scene.fog.color.clone(); }
      if (scene.fog && fogBase) scene.fog.color.copy(fogBase).lerp(new THREE.Color(rig?.fogTint ?? fogBase), rig?.fogTint ? 0.6 : 0);
      indoorK = S?.indoor ? 0.6 : 1;
      if (!rig || !c) { fill.intensity = 0; hemi.intensity = 0; for (const p of pts) p.intensity = 0; base = []; return; }
      fill.color.set(rig.fill[0]); fill.intensity = rig.fill[1] * (S?.indoor ? 0.8 : 1);
      if (rig.hemi) { hemi.color.set(rig.hemi[0]); hemi.groundColor.set(rig.hemi[1]); hemi.intensity = rig.hemi[2]; } else hemi.intensity = 0;
      // where the practicals stand (world space): the dressing's own lamps first, then the rig's positions
      const mount = S.actorMount?.() ?? null, W = (v) => (mount ? mount.localToWorld(v.clone()) : v.clone());
      const cw = W(c), fw = W(S.spots.far ?? c.clone().add(new THREE.Vector3(0, 0, -10)));
      const d = fw.clone().sub(cw).setY(0); if (d.lengthSq() < 1e-4) d.set(0, 0, -1); d.normalize();
      const l = new THREE.Vector3(-d.z, 0, d.x), sc = S.indoor ? 0.45 : 1;
      const at = { side: cw.clone().addScaledVector(l, 3 * sc).addScaledVector(d, 1 * sc).setY(cw.y + 2.6 * (S.indoor ? 0.8 : 1)), otherSide: cw.clone().addScaledVector(l, -3 * sc).setY(cw.y + 2.6 * (S.indoor ? 0.8 : 1)), rim: cw.clone().addScaledVector(d, 3.5 * sc).setY(cw.y + 3 * (S.indoor ? 0.75 : 1)), back: cw.clone().addScaledVector(d, 7 * sc).addScaledVector(l, -2 * sc).setY(cw.y + 3) };
      const prac = [...(S.themePracticals ?? [])].sort((a, b) => a.pos.distanceTo(cw) - b.pos.distanceTo(cw)).filter((p) => p.pos.distanceTo(cw) < 16);
      base = [];
      pts.forEach((p, i) => {
        const spec = rig.points[i];
        const pr = spec && spec.at !== "rim" ? prac.shift() : null; // a lantern of the dressing stands in for a side key
        if (!spec) { p.intensity = 0; return; }
        p.position.copy(pr?.pos ?? at[spec.at] ?? at.side);
        // GATE 2026-11-09 (#4 night square: white blobs on the tower / walls): a dressing lantern hangs on a wall; its light
        // stands 1.2 m out from it toward the street (a point light against a wall burns a hot spot into it)
        if (pr) { const o = new THREE.Vector3(cw.x - p.position.x, 0, cw.z - p.position.z); if (o.lengthSq() > 1e-4) p.position.addScaledVector(o.normalize(), 1.2); p.position.y += 0.3; }
        // GATE 2026-11-09 (#4 belfry: a lantern 1.4 m from the face blew it white): never closer than 2.2 m (horizontal)
        // to the subject spot, and at least 2.2 m up
        const hx = p.position.x - cw.x, hz = p.position.z - cw.z, hd = Math.hypot(hx, hz);
        if (hd < 2.2) { const k = hd > 0.05 ? 2.2 / hd : 0; p.position.x = cw.x + (k ? hx * k : l.x * 2.2); p.position.z = cw.z + (k ? hz * k : l.z * 2.2); }
        p.position.y = Math.max(p.position.y, cw.y + 2.2);
        p.color.set(rid === "neon" || rid === "alarm_red" ? spec.colour : pr?.colour ?? spec.colour);
        p.distance = S.indoor ? 9 : 18;
        base[i] = spec.k * indoorK; p.intensity = base[i];
      });
    }
    // the alarm pulses (deterministic in t)
    if (rig) rig.points.forEach((spec, i) => { if (spec.pulse && pts[i]) pts[i].intensity = (base[i] ?? 0) * (0.55 + 0.45 * Math.sin(t * Math.PI * 2 * spec.pulse)); });
  }
  const fwd = V(), up = V(), right = V();
  /** every frame, after the camera is set: the fill stands just above / beside the camera, aimed along its view */
  function frame(camera) {
    if (!fill.intensity) return;
    camera.updateMatrixWorld();
    camera.getWorldDirection(fwd); up.set(0, 1, 0); right.crossVectors(fwd, up).normalize();
    fill.position.copy(camera.position).addScaledVector(up, 2.5).addScaledVector(right, 1.5).addScaledVector(fwd, -2);
    fill.target.position.copy(camera.position).addScaledVector(fwd, 12);
    fill.target.updateMatrixWorld();
  }
  return { sync, frame, info: () => ({ key, rig: rig?.label ?? null, fill: fill.intensity, points: pts.map((p) => +p.intensity.toFixed(2)) }) };
}
