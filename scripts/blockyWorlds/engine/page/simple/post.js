// Blocky Worlds SIMPLE LOOK post chain (production; the engine uses it instead of page/post.js when timeline.look ===
// "simple"): the approved test's chain. Neutral tone mapping; an HDR clamp before any post (no Inf / NaN glints in the
// half-float targets); depth of field (BokehPass) on close-ups only, focused on the subject (engine: post.setFocus);
// bloom only at night and only above emissive levels; the mood LUT behind ONE switch (SIMPLE.lut, OFF for this look:
// owner 2026-11-10; a timeline's lookOptions.lut = true turns it on for a re-fit test). No AO, no auto grade.
// Same shape as page/post.js: makeRenderer(W, H), makePost(...) -> { composer, setLight, bloom, render, setShot,
// needsGrade, grades, rigInfo, moodInfo } + setFocus(distance).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { LUTPass } from "three/addons/postprocessing/LUTPass.js";
import { SIMPLE, tuneOf } from "./common.js";

export function makeRenderer(W, H) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function makePost({ renderer, scene, camera, W, H, query = new URLSearchParams(), tl = null }) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const clamp = new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb = clamp(c.rgb, 0.0, 12.0); if (any(isnan(c.rgb))) c.rgb = vec3(0.0); gl_FragColor = vec4(c.rgb, 1.0); }",
  });
  composer.addPass(clamp);
  const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.012, maxblur: 0.012 });
  bokeh.enabled = false;
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(Math.round(W / 4), Math.round(H / 4)), 0.6, 0.4, 1.4);
  bloom.enabled = false;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // the mood LUT: OFF for this look unless the switch (or the timeline's lookOptions.lut) says so
  const lutOn = (SIMPLE.lut || tl?.lookOptions?.lut === true) && !query.has("nolut");
  const lutPass = new LUTPass({ intensity: 1 }); lutPass.enabled = false;
  let lutMod = null;
  if (lutOn) { composer.addPass(lutPass); import("/lib/colourGrade.js").then(async (m) => { lutMod = { ...m, data: await m.loadGrade() }; }).catch(() => {}); }
  const LUTS = new Map();
  const lutTex = (mood) => {
    if (!lutMod?.data) return null;
    if (!LUTS.has(mood)) {
      const l = lutMod.lutRGBA(lutMod.data, mood) ?? lutMod.lutRGBA(lutMod.data, "day");
      let tex = null;
      if (l) { tex = new THREE.Data3DTexture(l.data, l.size, l.size, l.size); tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping; tex.unpackAlignment = 1; tex.needsUpdate = true; }
      LUTS.set(mood, tex);
    }
    return LUTS.get(mood);
  };
  const plain = query.has("nopost");
  let light = "day", cur = null;
  const setLight = (name) => {
    light = name; const T = tuneOf(name);
    bloom.enabled = SIMPLE.bloomNight && (!!T.night || name === "dusk");
    bloom.threshold = 1.4; bloom.strength = 0.6; bloom.radius = 0.4;
  };
  setLight("day");
  const setShot = (si, shot) => {
    cur = { si, shot };
    bokeh.enabled = SIMPLE.dofCloseups && shot?.camera === "closeup" && !(shot?.renderFlags ?? []).includes("no_dof");
    if (lutOn) { const tex = lutTex(lutMod?.moodFor?.(shot) ?? light); lutPass.enabled = !!tex; if (tex) lutPass.lut = tex; }
  };
  /** the subject's distance from the lens (metres): the close-up's focus plane */
  const setFocus = (d) => {
    if (!(d > 0)) return;
    bokeh.uniforms.focus.value = d;
    bokeh.uniforms.aperture.value = 0.012 / Math.max(1, d / 2.4);
    bokeh.uniforms.maxblur.value = 0.012;
    bokeh.uniforms.aspect.value = camera.aspect;
  };
  const render = () => {
    if (plain) return renderer.render(scene, camera);
    composer.render();
  };
  return { composer, setLight, bloom, render, setShot, setFocus, needsGrade: () => false, grades: new Map(), rigInfo: () => null,
    moodInfo: () => (cur ? { mood: light, lut: lutPass.enabled } : null), simple: true };
}
