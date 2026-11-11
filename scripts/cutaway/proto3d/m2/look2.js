// The competitor look for custom videos (the owner's rules 15 and 22, the look round of 2026-11-11): the top channels'
// videos are near-photoreal Blender renders: a low warm golden-hour sun with crisp contact shadows, natural (far less
// saturated) colour, a soft haze only on far things, a shallow focus on close-ups and a little blur when the camera
// sweeps. Ours read as a toy (flat saturated colour, everything sharp and still). This file is that look, as settings
// and post passes for the render page (real.js as patched by m2/makePage.mjs); makePage turns it on only for a custom
// layout (layout.approved !== true): the approved premade videos render exactly as they were approved.
// Everything here is deterministic: no clock, no random numbers; the camera of the previous frame comes from the
// timeline at t - 1/fps, so a frame rendered on its own (a still, a chunk on another server) is the same frame.

/** the light per mood for the new look (overrides over the mood's own LOOK settings; noon becomes golden hour) */
export const LIGHT2 = Object.freeze({
  // the competitor storm drain: the sun low (about 22 degrees) from the front right, warm; a softer warm sky fill and a
  // cool bounce from the ground side, so the shadow side stays readable but is not flat
  noon: { exposure: 1.0, env: 0.6, bgHdri: true, sun: ["#ffc488", 3.7, [27, 13, 19]], hemi: 0.22, hemiCols: ["#ffe2c0", "#56606e"], bloom: 0.16 },
  storm: { exposure: 0.95, bloom: 0 },
  dusk: { exposure: 1.05, bloom: 0.22 },
  night: { exposure: 1.0, bloom: 0.5 },
  fire: { exposure: 0.98, bloom: 0.45 },
});

/** the post settings per mood: haze colour (linear, near the sky's horizon brightness), its strength; the grade */
export const POST2 = Object.freeze({
  // sat: the grade's saturation (the R1 page ran 1.38; the competitors measure much lower); warm / cool: the split tone
  noon: { haze: [0.78, 0.82, 0.88], hazeMax: 0.4, sat: 1.06, curve: 0.12, warm: 0.045, cool: 0.03, vig: 0.22 },
  storm: { haze: [0.34, 0.37, 0.41], hazeMax: 0.55, sat: 0.75, curve: 0.1, warm: 0.0, cool: 0.04, vig: 0.28 },
  dusk: { haze: [0.95, 0.66, 0.46], hazeMax: 0.4, sat: 1.06, curve: 0.12, warm: 0.045, cool: 0.03, vig: 0.26 },
  night: { haze: [0.035, 0.05, 0.1], hazeMax: 0.5, sat: 0.85, curve: 0.1, warm: 0.02, cool: 0.05, vig: 0.34 },
  fire: { haze: [0.62, 0.3, 0.14], hazeMax: 0.45, sat: 0.95, curve: 0.12, warm: 0.04, cool: 0.02, vig: 0.3 },
});

// depth of field: the background blur (in pixels at 1080 wide) of a detail shot; none from this field width (metres
// across the frame at the focus distance) up, all of it at and below DOF_FULL (the director's narrowest field is 4 m)
export const DOF = Object.freeze({ maxPx: 11, full: 5, none: 13, deadZone: 0.1, taps: 20 });
// motion blur: a 120-degree shutter (a third of the frame's move), at most 14 px, off under 1.2 px of move at the frame's
// corners (it was 180 degrees and 36 px: the re-planned storm drain's travelling lines smeared past reading, and the picture
// checker judges single frames, 2026-11-11)
export const MBLUR = Object.freeze({ shutter: 0.33, maxPx: 14, minPx: 1.2, taps: 14, fps: 30 });
// haze: starts this far behind the focus point (and never nearer than 1.7x the focus distance), a 1/e distance of FAR
export const HAZE = Object.freeze({ behind: 25, mult: 1.7, far: 110 });

const num = (v, d) => (Number.isFinite(v) ? v : d);
// debug knobs for look tuning only (?l2tone=aces|agx, l2sat, l2curve, l2warm, l2exp): no video page sets them
const knob = (k) => { try { const v = new URLSearchParams(globalThis.location?.search ?? "").get(k); return v == null ? null : v; } catch { return null; } };

/** the new look's light over the mood's LOOK settings (in the page: THREE, its LOOK object, the mood's name) */
export function lightFor(THREE, LOOK, mood) {
  const L = LIGHT2[mood] ?? {};
  Object.assign(LOOK, L);
  // ACES with the grade below pulling the saturation down (tried AgX: it rolled the whole frame to a milky grey, and the
  // cut soil lost its depth; ACES at saturation 0.95-1.06 kept the soil brown and the sky clean, 2026-11-11)
  LOOK.tone = knob("l2tone") === "agx" ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  if (knob("l2exp")) LOOK.exposure = Number(knob("l2exp"));
  return LOOK;
}

/** crisp sun shadows: pipes, grates and small parts cast clean contact shadows (a tighter box, less bias) */
export function tuneSun(sun, lite = false) {
  try {
    const s = sun.shadow;
    s.mapSize.set(lite ? 2048 : 4096, lite ? 2048 : 4096);
    // (a low sun stretches each texel along the ground; a tighter box gives that back. The kit's builds sit within about
    // 25 m of the cut; far houses beyond it lose only their own shadows, which the haze softens anyway)
    Object.assign(s.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 160 });
    s.camera.updateProjectionMatrix();
    // (less normal offset than the R1 page's 0.03: thin parts' shadows touch where they stand; the small constant bias
    // keeps the low sun's grazing light from shadow acne)
    s.bias = -0.00035; s.normalBias = 0.02;
  } catch (e) { console.error(`[cutaway-bug] look2 sun: ${e?.message ?? e}`); }
}

const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const DEPTH_HEAD = `
uniform sampler2D tDepth; uniform float cNear, cFar;
float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return (cNear * cFar) / ((cFar - cNear) * d - cFar); }
float dist(vec2 uv){ return -viewZ(uv); }
`;

/**
 * The depth passes, in the linear HDR stage (after the ambient occlusion, before the "This is a…" outline, so the glow
 * stays sharp): haze on far things (and a storm's grey sky), depth of field on close-ups, camera motion blur.
 * env: { THREE, ShaderPass, composer, camera, depthTexture, W, H, mood }
 */
export function addDepthPasses({ THREE, ShaderPass, UnrealBloomPass, composer, camera, depthTexture, W, H, mood, sun, bloom = 0 }) {
  const P = POST2[mood] ?? POST2.noon;
  const haze = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: depthTexture }, cNear: { value: camera.near }, cFar: { value: camera.far }, hStart: { value: 40 }, hFar: { value: HAZE.far }, hMax: { value: P.hazeMax }, hCol: { value: new THREE.Vector3(...P.haze) }, storm: { value: 0 }, stormSky: { value: new THREE.Vector3(...POST2.storm.haze) } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float hStart, hFar, hMax, storm; uniform vec3 hCol, stormSky; varying vec2 vUv;
      ${DEPTH_HEAD}
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float d = texture2D(tDepth, vUv).x;
        vec3 hc = mix(hCol, stormSky, storm);
        if (d >= 0.99999) {
          // the sky: under a storm cue it goes overcast grey (the HDRI stays blue however dim it is)
          float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
          c.rgb = mix(c.rgb, stormSky * (0.55 + 0.6 * l), storm * 0.85);
        } else {
          float z = dist(vUv);
          float h = hMax * (1.0 - exp(-max(0.0, z - hStart) / hFar));
          c.rgb = mix(c.rgb, hc, h);
        }
        gl_FragColor = c;
      }`,
  });
  const dof = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: depthTexture }, cNear: { value: camera.near }, cFar: { value: camera.far }, focus: { value: 10 }, kPx: { value: 0 }, dead: { value: DOF.deadZone }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float focus, kPx, dead; uniform vec2 px; varying vec2 vUv;
      ${DEPTH_HEAD}
      float coc(float z){ float e = abs(z - focus) / max(z, 0.01); return kPx * clamp((e - dead) / (1.0 - dead), 0.0, 1.0); }
      void main(){
        vec4 c0 = texture2D(tDiffuse, vUv);
        float z0 = dist(vUv), cc = coc(z0);
        vec3 acc = c0.rgb; float ws = 1.0;
        // a golden-angle disc of ${DOF.taps} taps out to the largest blur; a farther sample never blurs over a nearer,
        // sharper centre (no background halo round the subject)
        for (int i = 0; i < ${DOF.taps}; i++) {
          float fi = float(i);
          float r = sqrt((fi + 0.5) / ${DOF.taps}.0) * kPx;
          float a = fi * 2.39996323;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * r * px;
          float zs = dist(uv), cs = coc(zs);
          float ce = zs > z0 ? min(cs, cc) : cs;
          float w = clamp(ce - r + 1.0, 0.0, 1.0);
          acc += texture2D(tDiffuse, uv).rgb * w; ws += w;
        }
        gl_FragColor = vec4(acc / ws, c0.a);
      }`,
  });
  const mb = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: depthTexture }, cNear: { value: camera.near }, cFar: { value: camera.far }, invVP: { value: new THREE.Matrix4() }, prevVP: { value: new THREE.Matrix4() }, shutter: { value: MBLUR.shutter }, maxUv: { value: MBLUR.maxPx / W } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform mat4 invVP, prevVP; uniform float shutter, maxUv; varying vec2 vUv;
      uniform sampler2D tDepth;
      void main(){
        float d = texture2D(tDepth, vUv).x;
        // this pixel's world point (the sky: a far point on its ray), seen by the previous frame's camera
        vec4 ndc = vec4(vUv * 2.0 - 1.0, min(d, 0.9999) * 2.0 - 1.0, 1.0);
        vec4 wp = invVP * ndc; wp /= wp.w;
        vec4 pp = prevVP * wp; vec2 puv = pp.xy / pp.w * 0.5 + 0.5;
        vec2 v = (vUv - puv) * shutter;
        float l = length(v); if (l > maxUv) v *= maxUv / l;
        vec3 acc = vec3(0.0);
        for (int i = 0; i < ${MBLUR.taps}; i++) { float k = (float(i) + 0.5) / ${MBLUR.taps}.0 - 0.5; acc += texture2D(tDiffuse, vUv - v * k).rgb; }
        gl_FragColor = vec4(acc / ${MBLUR.taps}.0, 1.0);
      }`,
  });
  dof.enabled = false; mb.enabled = false;
  for (const p of [haze, dof, mb]) composer.addPass(p);
  // gentle bloom on bright speculars only (threshold over white), here before the "This is a…" glow: after it, the bloom
  // turned the yellow outline into a blazing box (the traffic light controller, 2026-11-11)
  if (bloom > 0 && UnrealBloomPass) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), bloom, 0.5, 1.6));

  const prevCam = camera.clone(), tmp = new THREE.Vector3(), vp = new THREE.Matrix4(), corners = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  // (the sun's own strength before any light cue: read once here, so a frame rendered on its own sees the same weather)
  const baseSun = sun?.intensity || 1;
  return {
    passes: { haze, dof, mb },
    /** per frame, after the timeline moved the camera: run = the M2 runtime (focusAt, poseAt), camT the camera's time */
    update(run, camT) {
      try {
        camera.updateMatrixWorld();
        const tgt = run.focusAt?.(camT);
        const f = tgt ? Math.max(0.5, camera.position.distanceTo(tmp.set(...tgt))) : 30;
        // haze: only behind the build, however far back the camera stands
        haze.uniforms.hStart.value = Math.max(f * HAZE.mult, f + HAZE.behind);
        // the weather: how far a light cue has dimmed the sun from its first frame (a storm cue, a dip, night)
        const k = sun ? Math.min(1, Math.max(0, 1 - sun.intensity / baseSun)) : 0;
        haze.uniforms.storm.value = mood === "night" ? 0 : Math.min(1, k * 1.2);
        // depth of field: from the shot size (the field across the frame at the focus distance)
        const field = 2 * f * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
        const s = Math.min(1, Math.max(0, (DOF.none - field) / (DOF.none - DOF.full)));
        const kPx = DOF.maxPx * (W / 1080) * s * s * (3 - 2 * s);
        dof.enabled = kPx > 0.5; dof.uniforms.focus.value = f; dof.uniforms.kPx.value = kPx;
        // motion blur: the previous frame's camera from the timeline; off when the frame's corners move under minPx
        let moved = 0;
        if (run.poseAt) {
          run.poseAt(camT - 1 / MBLUR.fps, prevCam); prevCam.updateMatrixWorld();
          vp.multiplyMatrices(prevCam.projectionMatrix, prevCam.matrixWorldInverse);
          for (const [x, y] of corners) {
            tmp.set(x * 0.9, y * 0.9, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(f).add(camera.position);
            const a = tmp.clone().project(camera), b = tmp.applyMatrix4(vp);
            moved = Math.max(moved, Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) / 2);
          }
        }
        mb.enabled = moved * MBLUR.shutter >= MBLUR.minPx;
        if (mb.enabled) { mb.uniforms.prevVP.value.copy(vp); mb.uniforms.invVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert(); }
        for (const p of [haze, dof]) { p.uniforms.cNear.value = camera.near; p.uniforms.cFar.value = camera.far; }
        return { focus: f, field, dofPx: kPx, movePx: moved, storm: k };
      } catch (e) {
        // (a bad value never stops a video: the plain frame, no focus or blur)
        dof.enabled = false; mb.enabled = false;
        console.error(`[cutaway-bug] look2 update: ${e?.message ?? e}`);
        return null;
      }
    },
  };
}

/**
 * The grade, after the tone mapping (display colour): saturation toward natural, a gentle S-curve, warm highlights and
 * slightly cool shadows, a light vignette. Replaces the R1 page's saturation boost and its heavy vignette.
 */
export function addGrade({ THREE, ShaderPass, composer, mood, W, H }) {
  const P = { ...(POST2[mood] ?? POST2.noon) };
  for (const k of ["sat", "curve", "warm", "cool", "vig"]) if (knob("l2" + k)) P[k] = Number(knob("l2" + k));
  const g = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, sat: { value: num(P.sat, 0.94) }, curve: { value: num(P.curve, 0.2) }, warm: { value: num(P.warm, 0.03) }, cool: { value: num(P.cool, 0.03) }, vig: { value: num(P.vig, 0.22) }, aspect: { value: W / H }, storm: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, curve, warm, cool, vig, aspect, storm; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        c.rgb = mix(vec3(l), c.rgb, sat * (1.0 - 0.3 * storm));
        // a storm stays readable: the shadows lift as the sun dims (the re-planned storm drain rains through all 25 lines
        // and its cut went near black; the competitor's rain keeps a bright, lit cut, 2026-11-11)
        c.rgb = pow(max(c.rgb, vec3(0.0)), vec3(1.0 / (1.0 + 0.5 * storm)));
        vec3 s = c.rgb * c.rgb * (3.0 - 2.0 * c.rgb);
        c.rgb = mix(c.rgb, s, curve);
        float hi = smoothstep(0.45, 0.9, l), lo = 1.0 - smoothstep(0.05, 0.45, l);
        c.rgb += hi * warm * (1.0 - storm) * vec3(1.0, 0.35, -0.6) + lo * cool * vec3(-0.5, 0.0, 0.8);
        vec2 q = (vUv - 0.5) * vec2(aspect, 1.0) * 1.7;
        c.rgb *= 1.0 - vig * smoothstep(0.35, 1.0, dot(q, q));
        gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
      }`,
  });
  composer.addPass(g);
  return g;
}

/** the mood of a custom video: outdoor settings (a street, a park) follow the story's words too; a "storm drain" or a
 *  "storm sewer" names a thing, not the weather (the competitor storm drain is a golden evening) */
export function moodFor2(layout, moods, moodFor) {
  try {
    if (layout?.world?.mood && moods[layout.world.mood]) return layout.world.mood;
    const bd = layout?.world?.backdrop?.type;
    const outdoor = !bd || bd === "street" || bd === "park" || bd === "carwash";
    const clean = (s) => String(s ?? "").replace(/storm[ _-]?(drain|sewer|water|grate|pipe)s?/gi, "rain$1");
    const m = moodFor({ ...layout, world: outdoor ? { ...layout.world, backdrop: undefined } : layout.world, title: clean(layout?.title), key: clean(layout?.key) });
    return moods[m] ? m : "noon";
  } catch { return "noon"; }
}
