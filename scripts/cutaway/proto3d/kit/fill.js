// M2 kit: things that fill a cut.
//  fillBlock: a block whose top rises from y0 to y1 (gravel, a water body, a soil cap); lift() raises the whole
//    block out of the way while a part is laid under it (the landfill's bag lift, kept by the owner).
//  pour: particles (stones, crumbs, drops) raining onto a rising surface.
//  wettable: a water level inside any material (below it the colour turns wet and blue-ish), for gravel or soil.
import { span, eIn, clamp01 } from "./verbs.js";

export function wettable(ctx, mat, { color = "#3d7fd8", amount = 0.55, key = "wet" } = {}) {
  const { THREE } = ctx;
  const u = { uWetY: { value: -1e4 }, uWetOn: { value: 0 }, uWetC: { value: new THREE.Color(color) } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, u);
    // world position, including the instance transform for instanced parts (pebbles)
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWw;").replace("#include <project_vertex>", "#include <project_vertex>\n#ifdef USE_INSTANCING\nvWw = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvWw = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWw; uniform float uWetY, uWetOn; uniform vec3 uWetC;")
      .replace("#include <color_fragment>", `#include <color_fragment>
      float wetK = (1.0 - smoothstep(uWetY - 0.05, uWetY + 0.05, vWw.y)) * uWetOn;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + uWetC * 0.45, wetK * ${amount.toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => `${key}-${mat.uuid}`;
  return { set(y, on = 1) { u.uWetY.value = y; u.uWetOn.value = on; } };
}

export function fillBlock(ctx, { x0, x1, z0, z1, y0, y1, mat, r = 0.05, castShadow = true }) {
  const { THREE, scene, RoundedBoxGeometry } = ctx;
  const w = x1 - x0, d = z1 - z0, h = y1 - y0;
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w * 0.45, h * 0.45, d * 0.45)); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2); m.castShadow = castShadow; m.receiveShadow = true; m.visible = false; scene.add(m);
  // world-planar UVs so textures don't stretch with the level
  { const uv = g.attributes.uv, p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const X = p.getX(i) + (x0 + x1) / 2, Y = p.getY(i) + y0, Z = p.getZ(i) + (z0 + z1) / 2; uv.setXY(i, ay > 0.5 ? X / 2 : ax > 0.5 ? Z / 2 : X / 2, ay > 0.5 ? Z / 2 : Y / 2); } }
  let level = 0, lift = 0;
  const apply = () => { m.visible = level > 0.002; m.scale.y = Math.max(0.001, level); m.position.y = y0 + lift; };
  return {
    mesh: m,
    /** 0..1 of the full height */
    set(k) { level = clamp01(k); apply(); },
    lift(dy) { lift = dy; apply(); },
    top: () => y0 + lift + level * h,
  };
}

/** a block that wipes in along one axis from its low edge (a soil cap, a grass strip, a slab): set(0..1) */
export function wipeBlock(ctx, { x0, x1, y0, y1, z0, z1, mat, axis = "x", r = 0.06, uvScale = 0.5 }) {
  const { THREE, scene, RoundedBoxGeometry } = ctx;
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
  g.translate(axis === "x" ? w / 2 : 0, axis === "y" ? h / 2 : 0, axis === "z" ? d / 2 : 0);
  { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * uvScale, uv.getY(i) * Math.max(d, h) * uvScale); }
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.visible = false; scene.add(m);
  m.position.set(axis === "x" ? x0 : (x0 + x1) / 2, axis === "y" ? y0 : (y0 + y1) / 2, axis === "z" ? z0 : (z0 + z1) / 2);
  return { mesh: m, set(k) { m.visible = k > 0.002; m.scale[axis] = Math.max(0.001, clamp01(k)); } };
}

/** real pebbles on the cut face (z1) and on the top surface of a gravel fill, so gravel reads as gravel at phone size.
 *  set(top, lift): face pebbles show up to the fill's top; the top layer rides on it. */
export function pebbles(ctx, { x0, x1, y0, y1, z0, z1, size = [0.11, 0.2], mat, geo }) {
  const { THREE, scene, rnd } = ctx;
  const face = [], top = [];
  for (let y = y0 + 0.1; y < y1; y += 0.17) for (let x = x0 + 0.08; x < x1 - 0.05; x += 0.19) face.push({ x: x + (rnd() - 0.5) * 0.1, y: y + (rnd() - 0.5) * 0.06, z: z1 - 0.02 + rnd() * 0.04, s: size[0] + rnd() * (size[1] - size[0]), r: [rnd() * 6, rnd() * 6, rnd() * 6] });
  for (let z = z0 + 0.12; z < z1 - 0.05; z += 0.22) for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.22) top.push({ x: x + (rnd() - 0.5) * 0.14, z: z + (rnd() - 0.5) * 0.14, dy: (rnd() - 0.5) * 0.05, s: size[0] + rnd() * (size[1] - size[0]), r: [rnd() * 6, rnd() * 6, rnd() * 6] });
  const imF = new THREE.InstancedMesh(geo, mat, face.length), imT = new THREE.InstancedMesh(geo, mat, top.length);
  for (const im of [imF, imT]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), E = new THREE.Euler();
  return {
    set(topY, lift = 0, on = 1) {
      face.forEach((p, i) => { const k = on && p.y + lift < topY + 0.02 ? p.s : 0; imF.setMatrixAt(i, m4.compose(v.set(p.x, p.y + lift, p.z), q.setFromEuler(E.set(...p.r)), s.set(k, k * 0.8, k * 0.7))); });
      top.forEach((p, i) => { const k = on && topY > y0 + 0.05 ? p.s : 0; imT.setMatrixAt(i, m4.compose(v.set(p.x, topY + p.dy, p.z), q.setFromEuler(E.set(...p.r)), s.set(k, k * 0.6, k))); });
      imF.instanceMatrix.needsUpdate = imT.instanceMatrix.needsUpdate = true;
    },
  };
}

export function pour(ctx, { x0, x1, z0, z1, yFrom, count = 120, geo, mat, size = [0.08, 0.2] }) {
  const { THREE, scene, rnd } = ctx;
  const im = new THREE.InstancedMesh(geo, mat, count); im.castShadow = true; scene.add(im);
  const P = Array.from({ length: count }, () => ({ x: x0 + rnd() * (x1 - x0), z: z0 + rnd() * (z1 - z0), ph: rnd(), s: size[0] + rnd() * (size[1] - size[0]), rx: rnd() * 6, ry: rnd() * 6 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), E = new THREE.Euler();
  return {
    /** stones fall between a and b onto the surface at surfaceY(t); each takes `fall` seconds */
    update(t, a, b, surfaceY, fall = 0.55) {
      P.forEach((p, i) => {
        const start = a + p.ph * (b - a - fall), u = span(t, start, start + fall);
        if (u <= 0 || u >= 1) { m4.makeScale(0, 0, 0); }
        else { const yEnd = surfaceY(start + fall); v.set(p.x, yFrom + (yEnd - yFrom) * eIn(u), p.z); q.setFromEuler(E.set(p.rx + u * 3, p.ry, 0)); m4.compose(v, q, s.setScalar(p.s)); }
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
