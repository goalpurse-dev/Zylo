// Kit: CC0 models (Kenney's kits in proto/assets/kenney, fetched by fetchKenney.mjs; Poly Haven's models in
// proto/assets/polyhaven, fetched by fetchPolyModels.mjs; sources in ASSET_SOURCES.md), each file loaded once (through
// the page's loading manager, so no frame renders before it has arrived), cloned per use, standing on its base, casting
// and taking shadows.
//   model(ctx, "car/sedan.glb" | "polyhaven/rubber_duck_toy/rubber_duck_toy.gltf", { pos, rotY, size (the longest side
//     in metres) | scale, parent, tint, gloss, real }, onReady)
// The real look (the owner's rule 19 of 2026-11-11: realistic models restyled to ONE consistent look, no toy colours):
// on a custom video (ctx.realLook, set by m2/runtime.js when layout.approved !== true; opts.real overrides), a Kenney
// model's flat palette colours are read from its colour map into the vertices and calmed toward natural ones (less
// saturation, no pure white or black), a tint is turned into a natural paint (a car is silver, dark blue, deep red,
// never toy yellow), and cars get a clear-coated paint. Poly Haven models keep their own scanned PBR materials. A
// premade video (approved) keeps the toy-diorama look exactly as approved.

const cache = new Map();
const pixels = new Map(); // a colour map's pixels, read once per image

/** a natural version of a colour: hue kept, saturation and lightness pulled into a real material's range (pure; Node) */
export function naturalColor(hex, { sat = 0.55, minL = 0.1, maxL = 0.82 } = {}) {
  const n = parseInt(String(hex).replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  if (!Number.isFinite(n)) return "#8a8f94";
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l0 = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l0 > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  s *= sat; const l = Math.min(maxL, Math.max(minL, l0));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const hx = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return s === 0 ? `#${hx(l)}${hx(l)}${hx(l)}` : `#${hx(f(h + 1 / 3))}${hx(f(h))}${hx(f(h - 1 / 3))}`;
}
// real car paints (the competitor's streets: silver, white, graphite); a coloured toy tint keeps its hue at a real
// paint's depth (dark blue, deep red, dark green)
const CAR_PAINTS = ["#b9bdc2", "#e8e8e4", "#4a4e54"];
/** the real paint for a car's tint (pure): greys stay greys, a coloured tint keeps its hue at a real paint's depth */
export function carPaint(hex) {
  const n = parseInt(String(hex ?? "").replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(n)) return CAR_PAINTS[0];
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 40) return mx > 200 ? CAR_PAINTS[1] : mx > 120 ? CAR_PAINTS[0] : CAR_PAINTS[2];
  return naturalColor(hex, { sat: 0.5, minL: 0.18, maxL: 0.42 });
}
export const modelUrl = (file) => (String(file).startsWith("polyhaven/") ? `/assets/${file}` : `/assets/kenney/${file}`);

/** the colour of a texture at uv (its pixels read once; null when the image cannot be read) */
function sampler(image) {
  if (!image) return null;
  if (!pixels.has(image)) {
    let px = null;
    try {
      const w = image.width, h = image.height, c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
      const g = c.getContext("2d"); g.drawImage(image, 0, 0); px = { w, h, d: g.getImageData(0, 0, w, h).data };
    } catch { px = null; }
    pixels.set(image, px);
  }
  const px = pixels.get(image);
  if (!px) return null;
  // (glTF textures are not flipped: uv (0, 0) is the image's top left)
  return (u, v) => { const x = Math.min(px.w - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * px.w))), y = Math.min(px.h - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * px.h))), i = (y * px.w + x) * 4; return [px.d[i] / 255, px.d[i + 1] / 255, px.d[i + 2] / 255]; };
}

/** a Kenney mesh in the real look: its palette colours into the vertices (calmed), one PBR material (crash-proof: on
 * any failure the mesh keeps its own material) */
function realMesh(ctx, o, { car, tint }) {
  const { THREE } = ctx;
  try {
    const src = o.material, at = sampler(src.map?.image), uv = o.geometry.attributes.uv;
    if (!at || !uv) return false;
    const geo = o.geometry.clone(), n = geo.attributes.position.count, col = new Float32Array(n * 3);
    const paint = tint ? new THREE.Color(car ? carPaint(tint) : naturalColor(tint)) : car ? new THREE.Color(CAR_PAINTS[0]) : null, c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const [r, g, b] = at(uv.getX(i), uv.getY(i));
      c.setRGB(r, g, b, THREE.SRGBColorSpace);
      const hsl = {}; c.getHSL(hsl);
      // a car body's paint (the bright, coloured palette cells) takes the real paint; glass, tyres and trim stay theirs
      if (paint && hsl.l > 0.3 && (hsl.s > 0.25 || hsl.l > 0.75)) c.copy(paint);
      else c.setHSL(hsl.h, hsl.s * 0.5, Math.min(0.8, Math.max(0.03, hsl.l * 0.92)));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    o.geometry = geo;
    o.material = car
      ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.9 });
    return true;
  } catch { return false; }
}

/** a model placed in the scene (a Group, empty until the file has loaded; onReady(group, inner) then) */
export function model(ctx, file, opts = {}, onReady = null) {
  const { THREE } = ctx;
  const g = new THREE.Group();
  if (opts.pos) g.position.set(...opts.pos);
  g.rotation.y = opts.rotY ?? 0;
  (opts.parent ?? ctx.scene).add(g);
  if (!ctx.gltf) return g;
  const ph = String(file).startsWith("polyhaven/");
  // (taken when the model is asked for: the settings built before the parts keep the look they were built in)
  const real = (opts.real ?? !!ctx.realLook) && !ph;
  const car = /^car\//.test(String(file)) && !/cone|debris|box/.test(String(file));
  if (!cache.has(file)) cache.set(file, new Promise((res) => ctx.gltf(modelUrl(file), res)));
  cache.get(file).then((gltf) => {
    const inner = gltf.scene.clone(true);
    // its base on y = 0, centred in x and z; sized by its longest side (or a plain scale)
    const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
    const k = opts.size ? opts.size / Math.max(size.x, size.z) : (opts.scale ?? 1);
    inner.scale.setScalar(k);
    inner.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
    inner.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = opts.cast !== false; o.receiveShadow = true;
      if (real && realMesh(ctx, o, { car, tint: opts.tint })) return;
      // its own material (a tint must not colour every other copy); a little sheen, like the toy plastic of the props
      o.material = o.material.clone();
      if (opts.tint) o.material.color = new THREE.Color(opts.tint);
      if (ph) return; // (a scanned Poly Haven material keeps its own roughness and maps)
      // distance haze baked into the far city (a scene fog hazed the whole build too whenever the camera stood back)
      if (opts.haze) { o.material.emissive = new THREE.Color(opts.haze[0]); o.material.emissiveIntensity = opts.haze[1]; }
      o.material.roughness = opts.gloss ?? 0.55;
      o.material.envMapIntensity = 0.8;
    });
    g.add(inner);
    onReady?.(g, inner);
  });
  return g;
}

/** a model's named nodes (wheels, doors) once loaded */
export function nodes(inner, re) {
  const out = []; inner.traverse((o) => { if (re.test(o.name)) out.push(o); }); return out;
}
