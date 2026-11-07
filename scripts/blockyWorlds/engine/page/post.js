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

// per light: AO intensity, bloom (strength, radius, threshold), grade (sat, con, warm). day/night = look/scene.js L/Ln.
export const POST = {
  day: { ao: 2.0, bloom: [0.22, 0.45, 1.6], sat: 1.58, con: 1.24, warm: 0.035 },
  night: { ao: 1.2, bloom: [0.5, 0.45, 0.85], sat: 1.15, con: 1.08, warm: -0.02 },
  warm: { ao: 1.8, bloom: [0.3, 0.45, 1.3], sat: 1.5, con: 1.2, warm: 0.07 },
  // WORLD-LOOK 2026-11-06: dusk / dawn (page/lighting.js)
  dusk: { ao: 1.5, bloom: [0.4, 0.45, 1.0], sat: 1.3, con: 1.14, warm: 0.03 },
  dawn: { ao: 1.6, bloom: [0.3, 0.45, 1.2], sat: 1.3, con: 1.12, warm: 0.01 },
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.22, 0.45, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE);
  composer.addPass(grade);
  const plain = query.has("nopost");
  const setLight = (name) => {
    const p = POST[name];
    if (!p) throw new Error(`post.js: unknown light "${name}" (${Object.keys(POST).join(" | ")})`);
    if (ao) ao.configuration.intensity = p.ao;
    [bloom.strength, bloom.radius, bloom.threshold] = p.bloom;
    grade.uniforms.sat.value = p.sat; grade.uniforms.con.value = p.con; grade.uniforms.warm.value = p.warm;
  };
  setLight("day");
  return { composer, setLight, render: () => (plain ? renderer.render(scene, camera) : composer.render()) };
}
