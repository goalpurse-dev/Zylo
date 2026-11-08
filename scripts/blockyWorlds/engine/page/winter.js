// Blocky Worlds LOOK-FIX 2026-11-08 (owner: "#2 is a snowy town in the world bible, so the stills need snow, frost on
// windows, and night lighting"): the winter dressing of any world, switched on when the world bible / the director /
// the script says snow, winter, frost, ice or a blizzard.
//   isWinter(tl) -> bool                       (pure, tested) the bible (world.weather / season / climate / town style
//                                               text / time), a shot's weather, or the script's lines
//   makeWinter(THREE, scene, { seed }) -> W
//     W.dress(root, { skip })   snow on every upward face below `root` (ground, roofs, ledges, sills, branches): a
//                               shader blend toward packed white by the world normal; frosted window panes (the lit,
//                               emissive glass gets icy edges and a frost pattern, still glowing warm inside at night)
//     W.light(scene, mode)      cold light: a blue moon, a white snow bounce from below (call after applyLight)
//     W.update(t, camera)       falling snow around the camera, deterministic in t (a frame depends only on t + camera)
//   snowFlake(i, t, seed) -> [x, y, z] in the 0..1 box (pure, tested)

const WORDS = /\b(snow\w*|winter\w*|frost\w*|frozen|freez\w*|blizzard\w*|ice|icy|icicle\w*|sleet|christmas|yule)\b/i;

/** is this story a winter one? the bible first, then the director's shot weather, then the script's words */
export function isWinter(tl) {
  if (!tl) return false;
  const w = tl.world ?? tl.visualWorld ?? {};
  const fields = [w.weather, w.season, w.climate, w.time?.season, w.time?.weather, w.town?.style?.text, w.town?.style?.id, w.look, w.mood];
  if (fields.some((f) => typeof f === "string" && WORDS.test(f))) return true;
  if (w.winter === true || w.snow === true) return true;
  if ((tl.shots ?? []).some((s) => typeof s.weather === "string" && WORDS.test(s.weather))) return true;
  const lines = (tl.lines ?? []).map((l) => l.text ?? "").join(" ");
  const hits = lines.match(new RegExp(WORDS.source, "gi")) ?? [];
  return hits.length >= 2 || (hits.length === 1 && /\b(snow|winter|blizzard|frost)/i.test(hits[0]));
}

/** a flake's position in the unit box at time t: falls at its own speed, drifts sideways, wraps (deterministic) */
export function snowFlake(i, t, seed = 1) {
  const h = (k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233 + seed * 3.7) * 43758.5453; return x - Math.floor(x); };
  const speed = 0.06 + 0.05 * h(1), ph = h(2) * 6.283;
  const y = ((h(3) - t * speed) % 1 + 1) % 1;
  const x = (((h(4) + 0.015 * Math.sin(t * 0.9 + ph)) % 1) + 1) % 1;
  const z = (((h(5) + 0.012 * Math.cos(t * 0.7 + ph)) % 1) + 1) % 1;
  return [x, y, z];
}

export function makeWinter(THREE, scene, { seed = 1 } = {}) {
  const done = new WeakSet();
  const U = { uSnowNight: { value: 0 } }; // night: moonlit blue-grey snow, not a white floodlit sheet (no bloom glare)
  function snowPatch(mat) {
    if (done.has(mat) || !mat.isMeshStandardMaterial) return;
    done.add(mat);
    const isGlass = mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.3 && (mat.roughness ?? 1) < 0.75;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey?.bind(mat);
    if (isGlass) { mat.defines = { ...(mat.defines ?? {}), USE_UV: "" }; }
    mat.onBeforeCompile = (sh, r) => {
      prev?.call(mat, sh, r);
      sh.uniforms.uSnowNight = U.uSnowNight;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSnowN; varying vec3 vSnowP;")
        .replace("#include <project_vertex>", `#include <project_vertex>
#ifdef USE_INSTANCING
  vSnowP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vSnowN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
  vSnowP = (modelMatrix * vec4(transformed, 1.0)).xyz; vSnowN = normalize(mat3(modelMatrix) * objectNormal);
#endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSnowN; varying vec3 vSnowP; uniform float uSnowNight;")
        .replace("#include <map_fragment>", `#include <map_fragment>
{ float nz = 0.5 + 0.5 * sin(vSnowP.x * 2.3 + sin(vSnowP.z * 1.7) * 2.0) * sin(vSnowP.z * 2.9);
  float sn = smoothstep(0.38 + 0.12 * nz, 0.72, vSnowN.y);
  vec3 snowC = mix(vec3(0.74, 0.80, 0.90), vec3(0.90, 0.93, 0.97), nz);
  snowC = mix(snowC, snowC * vec3(0.48, 0.54, 0.66), uSnowNight);
  diffuseColor.rgb = mix(diffuseColor.rgb, snowC, sn); }`);
      if (isGlass) {
        sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{ vec2 fu = abs(vUv - 0.5) * 2.0; float e = max(fu.x, fu.y);
  float pat = 0.5 + 0.5 * sin(vUv.x * 46.0 + sin(vUv.y * 31.0) * 3.0) * sin(vUv.y * 41.0 + vUv.x * 9.0);
  float fr = clamp(smoothstep(0.35, 0.9, e + 0.3 * pat) + 0.25 * pat, 0.0, 1.0);
  // frost: icy blue-white feathers creeping in from the edges; the warm glow stays in the clear middle (dimmed so
  // the bloom never washes the pattern out)
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.88, 1.0) * (0.75 + 0.25 * pat), fr * 0.9);
  totalEmissiveRadiance = totalEmissiveRadiance * mix(0.4, 0.08, fr) + vec3(0.04, 0.07, 0.12) * fr; }`);
      }
    };
    mat.customProgramCacheKey = () => `${prevKey ? prevKey() : ""}|winter${isGlass ? "G" : ""}`;
    mat.needsUpdate = true;
  }
  // falling snow: a 36 x 22 x 36 m box around the camera, soft round flakes
  const N = 3000, BOX = [36, 22, 36];
  const pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d");
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#ffffff", size: 0.09, map: tex, transparent: true, depthWrite: false, opacity: 0.95 }));
  flakes.frustumCulled = false; flakes.name = "winterSnow"; flakes.renderOrder = 5; scene.add(flakes);
  const cam = new THREE.Vector3();
  return {
    flakes,
    dress(root, { skip = null } = {}) {
      root.traverse((o) => {
        if (skip?.(o)) return;
        if (!o.isMesh || o === flakes) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) snowPatch(m);
      });
    },
    light(sc, mode) {
      U.uSnowNight.value = mode === "night" ? 1 : mode === "dusk" ? 0.5 : 0;
      sc.traverse((l) => {
        if (l.isHemisphereLight) { l.groundColor.set(mode === "night" ? "#2a3658" : "#e4ecf8"); l.color.lerp(new THREE.Color(mode === "night" ? "#3a58a8" : "#dfe8ff"), 0.6); l.intensity *= mode === "night" ? 0.85 : 1.15; }
        else if (l.isDirectionalLight && mode === "night") { l.color.set("#9fb6f0"); l.intensity *= 0.8; }
      });
      if (sc.fog && mode !== "night") sc.fog.color.lerp(new THREE.Color("#dfe8f4"), 0.5);
    },
    update(t, camera) {
      camera.getWorldPosition(cam);
      // the box is anchored on a 2 m grid near the camera (no swimming with small camera drifts)
      const ox = Math.floor(cam.x / 2) * 2 - BOX[0] / 2, oy = cam.y - 6, oz = Math.floor(cam.z / 2) * 2 - BOX[2] / 2;
      for (let i = 0; i < N; i++) { const [fx, fy, fz] = snowFlake(i, t, seed); pos[i * 3] = ox + fx * BOX[0]; pos[i * 3 + 1] = oy + fy * BOX[1]; pos[i * 3 + 2] = oz + fz * BOX[2]; }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
