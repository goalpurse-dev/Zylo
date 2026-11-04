// Blocky Worlds sets: the three lights. "day" = the locked look (look/scene.js, key L): clear-sky HDRI for reflections,
// the blue sky dome with procedural clouds, the warm sun with one shadow map, a hemisphere fill. "night" = the look's
// Ln: moonlit HDRI, a dark blue sky with stars and a moon, a cold moon light, and the set's warm practical lights
// (street lamps, the bedside lamp, the hallway lights). "warm" = a golden-hour ending: low orange sun, long shadows,
// a peach horizon. One shadow-casting light per set; switching is undone completely by dispose().
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

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
    sky: { zen: "#020718", hor: "#1c3470", k: 1.0, clouds: 0, cloudLit: "#2a3a66", cloudShade: "#0c1430", sunCol: "#9fb6ff", sunGlow: 0.0 },
    fog: ["#16244c", 30, 260],
    sun: { color: "#8fa8ff", intensity: 0.85, dir: [-30, 50, -20] },
    hemi: ["#2c3f78", "#07070f", 0.22],
    stars: true, moon: true,
  },
  warm: {
    env: "day", envI: 0.32, exposure: 0.9,
    sky: { zen: "#2a5ed0", hor: "#ff9a52", k: 1.0, clouds: 0.9, cloudLit: "#ffd6a8", cloudShade: "#e0877a", sunCol: "#ffb35c", sunGlow: 1.0 },
    fog: ["#f0a06a", 260, 3200],
    sun: { color: "#ffa04a", intensity: 4.2, dir: [42, 11, -6] },
    hemi: ["#ffd8b0", "#5e4636", 0.42],
  },
};

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
  if (!M) throw new Error(`applyLight: unknown light "${name}" (day | night | warm)`);
  const rig = set?.rig ?? {};
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
  if (M.stars) {
    const n = 1400, pos = new Float32Array(n * 3); let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const th = rnd() * Math.PI * 2, ph = 0.1 + rnd() * 1.35; pos.set([Math.cos(th) * Math.cos(ph) * 900, Math.sin(ph) * 900, Math.sin(th) * Math.cos(ph) * 900], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 2.0, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 });
    const stars = add(new THREE.Points(sg, sm)); stars.frustumCulled = false; disposables.push(sg, sm);
  }
  if (M.moon) {
    const mg = new THREE.CircleGeometry(16, 48), mm = new THREE.MeshBasicMaterial({ color: "#eef1ff", fog: false });
    const moonDisc = add(new THREE.Mesh(mg, mm));
    const md = new THREE.Vector3(...(rig.moonAt ?? [-0.32, 0.5, -0.8])).normalize();
    moonDisc.position.copy(md.multiplyScalar(800)); moonDisc.lookAt(0, 0, 0); disposables.push(mg, mm);
    const hg = new THREE.CircleGeometry(48, 48), hm = new THREE.MeshBasicMaterial({ color: "#6f86c8", transparent: true, opacity: 0.18, fog: false, depthWrite: false });
    const halo = add(new THREE.Mesh(hg, hm)); halo.position.copy(moonDisc.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0); disposables.push(hg, hm);
  }

  // fog
  const fog = rig.fog?.[name] ?? (rig.indoor ? null : M.fog);
  scene.fog = fog ? new THREE.Fog(fog[0], fog[1], fog[2]) : null;

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
