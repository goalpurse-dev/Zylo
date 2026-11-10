// Blocky Worlds engine: the locked look's post chain (look/scene.js, key "L"): N8AO ambient occlusion, UnrealBloom,
// OutputPass (ACES + sRGB), then the punchy grade (saturation, contrast, warmth). setLight() switches the per-light
// values: "day" = the locked look exactly, "night" = the look's night values, "warm" = the golden-hour ending.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { N8AOPass } from "n8ao";
import { RIGS, gradeFor, frameStats, onTarget } from "/lib/setThemes.js"; // SETS-V2: rigs + the per-shot auto grade
import { makeRigLayer } from "/page/lighting.js";
import { LUTPass } from "three/addons/postprocessing/LUTPass.js";
import { moodFor, lutRGBA, loadGrade } from "/lib/colourGrade.js";

// GRADE 2026-11-10 (owner: "per-mood colour grade / 3D LUT that maps our render's colour distribution onto the
// reference's ... apply it to every shot automatically"): the mood LUTs (lib/colourGrade.js, fitted offline by
// lookgate/colourFit.py) load once with the module; the LUT pass is the chain's last pass, so it sees exactly what
// the fit's stills showed. ?nolut=1 turns it off (render the stills for a re-fit with --query nolut=1).
const GRADE_DATA = await loadGrade();

// per light: AO intensity, bloom (strength, radius, threshold), grade (sat, con, warm). day/night = look/scene.js L/Ln.
// GATE-V3 2026-11-10: the bloom thresholds of the plastic look. The old ones (day 1.6, night 0.85, warm 1.3, dusk 1.0,
// dawn 1.2) were set for the dark photo-textured world; the bright plastic ground under the stronger sun sits above them
// over whole floors and UnrealBloom added the floor back as a white glare over the lower half of every outdoor still
// (RunPod stills: 50-70% of the frame over 240, the same with the LUT and the auto grade off). Now only emissives,
// practical bulbs and small glints bloom (owner: "soft bloom on emissives"); the neon rig keeps its own low threshold.
export const POST = {
  day: { ao: 2.0, bloom: [0.22, 0.45, 4.0], sat: 1.58, con: 1.24, warm: 0.035 },
  night: { ao: 1.2, bloom: [0.5, 0.45, 2.2], sat: 1.15, con: 1.08, warm: -0.02 },
  warm: { ao: 1.8, bloom: [0.3, 0.45, 3.5], sat: 1.5, con: 1.2, warm: 0.07 },
  // WORLD-LOOK 2026-11-06: dusk / dawn (page/lighting.js)
  dusk: { ao: 1.5, bloom: [0.4, 0.45, 2.6], sat: 1.3, con: 1.14, warm: 0.03 },
  dawn: { ao: 1.6, bloom: [0.3, 0.45, 3.0], sat: 1.3, con: 1.12, warm: 0.01 },
};

const GRADE = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.58 }, con: { value: 1.24 }, warm: { value: 0.035 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat, con, warm; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, sat); col = (col - 0.5) * con + 0.5; col *= vec3(1.0 + warm, 1.0 + warm * 0.3, 1.0 - warm); gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }",
};

/** the renderer exactly as the locked look sets it up (1080x1920, pixel ratio 1, ACES, sRGB, PCF soft shadows) */
export function makeRenderer(W, H) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.86; // the sets' applyLight may change it
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** { composer, setLight(name), render() }; ?nopost=1 renders without the chain (debug), ?noao=1 drops the AO */
export function makePost({ renderer, scene, camera, W, H, query = new URLSearchParams() }) {
  const composer = new EffectComposer(renderer); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (!query.has("noao")) {
    ao = new N8AOPass(scene, camera, W, H);
    ao.configuration.aoRadius = 1.2; ao.configuration.distanceFalloff = 1; ao.configuration.halfRes = false;
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), ...POST.day.bloom);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE);
  composer.addPass(grade);
  // the mood LUT (one Data3DTexture per mood, built on first use); off until a shot is set
  const useLut = !query.has("nolut") && !!GRADE_DATA;
  const lutPass = new LUTPass({ intensity: 1 });
  lutPass.enabled = false;
  composer.addPass(lutPass);
  const LUTS = new Map();
  const lutTex = (mood) => {
    if (!LUTS.has(mood)) {
      const l = lutRGBA(GRADE_DATA, mood) ?? lutRGBA(GRADE_DATA, "day");
      let tex = null;
      if (l) {
        tex = new THREE.Data3DTexture(l.data, l.size, l.size, l.size);
        tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
        tex.unpackAlignment = 1; tex.needsUpdate = true;
      }
      LUTS.set(mood, tex);
    }
    return LUTS.get(mood);
  };
  const plain = query.has("nopost");
  const setLight = (name) => {
    const p = POST[name];
    if (!p) throw new Error(`post.js: unknown light "${name}" (${Object.keys(POST).join(" | ")})`);
    if (ao) ao.configuration.intensity = p.ao;
    [bloom.strength, bloom.radius, bloom.threshold] = p.bloom;
    grade.uniforms.sat.value = p.sat; grade.uniforms.con.value = p.con; grade.uniforms.warm.value = p.warm;
  };
  setLight("day");

  // SETS-V2 2026-11-09 (owner D + F, LOOK-TARGET): per shot the RIG (page/lighting.js makeRigLayer: fill, hemi tint,
  // practicals) and the AUTO GRADE toward the rig's target (brightness ~0.65-0.72 by day, contrast ~0.52, the beige /
  // orange cast pulled back; lib/setThemes.js gradeFor). The grade is measured ONCE per shot, at the shot's first frame
  // (the engine renders shot.start first: renderAt(.., { calib })), so every chunk of a parallel render grades a shot
  // the same. Everything is applied on top of whatever set the uniforms (setLight, the winter bloom, a flashback) and
  // restored right after the render. ?nograde=1 turns the auto grade off.
  const auto = !query.has("nograde");
  const GRADES = new Map();
  const N = { expo: 1, sat: 1, warm: 0, con: 1 };
  let cur = null, rigLayer = null;
  const probe = document.createElement("canvas"); probe.width = 36; probe.height = 64;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  const setShot = (si, shot, S, t = 0) => {
    cur = { si, shot, t };
    // the shot's mood LUT (a flashback keeps its own look); the auto grade below is measured BEFORE the LUT
    const tex = useLut && shot?.grade !== "flashback" ? lutTex(moodFor(shot)) : null;
    if (tex) lutPass.lut = tex;
    lutPass.enabled = !!tex;
    rigLayer ??= makeRigLayer(THREE, scene);
    rigLayer.sync({ shot, S, t });
  };
  const needsGrade = (si) => auto && !plain && !GRADES.has(si);
  const applyLook = (g) => {
    const sh = cur.shot, rig = RIGS[sh.rig], rp = rig?.post ?? {};
    const u = grade.uniforms, b0 = [bloom.strength, bloom.threshold], g0 = [u.sat.value, u.con.value, u.warm.value], e0 = renderer.toneMappingExposure;
    if (sh.grade !== "flashback") {
      u.sat.value = g0[0] * (rp.satK ?? 1) * g.sat;
      u.con.value = g0[1] * (rp.conK ?? 1) * g.con;
      u.warm.value = g0[2] + (rp.warmAdd ?? 0) + g.warm;
      bloom.strength = b0[0] * (rp.bloomK ?? 1);
      if (rp.bloomTh) bloom.threshold = Math.min(b0[1], rp.bloomTh);
    }
    renderer.toneMappingExposure = e0 * (rig?.expoK ?? 1) * g.expo;
    return () => { [bloom.strength, bloom.threshold] = b0; [u.sat.value, u.con.value, u.warm.value] = g0; renderer.toneMappingExposure = e0; };
  };
  const measure = () => { pctx.drawImage(renderer.domElement, 0, 0, 36, 64); return frameStats(pctx.getImageData(0, 0, 36, 64).data); };
  const shoot = (g) => { const undo = applyLook(g); composer.render(); undo(); };
  const render = () => {
    if (plain) return renderer.render(scene, camera);
    if (!cur) return composer.render();
    rigLayer?.frame(camera);
    let g = GRADES.get(cur.si);
    if (!g && auto) {
      // calibrate: the rig's look without a grade, measured; one refine pass when the first guess is still off.
      // Measured without the mood LUT (the LUT is fitted on auto-graded stills, it comes after)
      const lutOn = lutPass.enabled; lutPass.enabled = false;
      shoot(N); const st = measure();
      g = gradeFor(st, cur.shot.rig);
      shoot(g); const st2 = measure();
      if (!onTarget(st2, cur.shot.rig)) g = gradeFor(st2, cur.shot.rig, g);
      GRADES.set(cur.si, { ...g, before: st, after1: st2 });
      lutPass.enabled = lutOn;
    }
    shoot(g ?? N);
  };
  return { composer, setLight, bloom, render, setShot, needsGrade, grades: GRADES, rigInfo: () => rigLayer?.info() ?? null,
    moodInfo: () => (cur ? { mood: moodFor(cur.shot), lut: lutPass.enabled } : null) };
}
