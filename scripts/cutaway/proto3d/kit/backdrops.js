// Kit: settings other than the yard (the R1 world's lawn and house stay the default). A backdrop is built once,
// before the topic's parts, and uses no random numbers (so it never changes the parts' stones, bags or leaves).
//  street: a sidewalk over the lawn (with a hole where the world's cut is), shop fronts behind it with lit windows,
//    an awning and a sign, a street lamp and a bench.
//  park: a gravel path, a bench and a lamp on the lawn (the trees come from world.trees).
//  garage: a driveway up to a garage with its door half open (lit inside), the side of the house beside it.
//  room: a room in section (floor over the cut ground, back wall with a window, side wall, ceiling, roof slice).
//  carwash: a car wash bay (wet floor over the cut drain, tiled back wall, canopy on a column, lit sign).
//  kitchen: a kitchen in section (the room's shell, a tiled floor, counters and wall cabinets on both sides of an open
//    slot where the appliance being explained stands, a tiled splashback, a window over the sink, pendant lights).
//  workshop: a home workshop in section (a concrete floor, a pegboard tool wall over a workbench, a shelf with boxes,
//    a rolling tool chest, a closed roll-up door, strip lights; the middle left open for a car or a machine).

import { model } from "./models.js";
import { signTexture } from "./signText.js";
import { STREET_BACK, streetRoad } from "./street.js";

// sign lettering in the board's own proportions, never stretched (kit/signText.js)
function sign(THREE, text, bg, fg, w, h) { return signTexture(THREE, text, bg, fg, w, h); }

/** a slab over an area with a rectangular hole (the cut): up to 4 boxes */
function slabAround(ctx, mat, [x0, x1, z0, z1], y0, y1, hole) {
  const { box, scene } = ctx, h = y1 - y0, y = (y0 + y1) / 2;
  const put = (a, b, c, d) => { if (b - a > 0.01 && d - c > 0.01) { const m = box(mat, b - a, h, d - c, (a + b) / 2, y, (c + d) / 2, scene, 0.02); m.castShadow = false; } };
  if (!hole) return put(x0, x1, z0, z1);
  const [hx0, hx1, hz0, hz1] = hole;
  put(x0, x1, z0, hz0); // behind the hole
  put(x0, hx0, hz0, z1); put(hx1, x1, hz0, z1); // left and right of it
  if (hz1 < z1) put(hx0, hx1, hz1, z1);
}

/** a Poly Haven material whose texture repeats every `tile` metres over a w x h face (the box helper maps it once a face) */
// each texture's average colour (sRGB, measured): a colour asked for is the surface's average, not a darkening on top
const TEX_AVG = { painted_plaster_wall: 0.65, concrete_pavement: 0.46, brick_wall_02: 0.56, laminate_floor_02: 0.52, garage_floor: 0.42, roof_09: 0.47 };
function pbrSized(ctx, id, w, h, tile, extra = {}) {
  const { std, tex } = ctx;
  const t = (map, srgb) => { const c = tex(id, map, 1, srgb).clone(); c.repeat.set(w / tile, h / tile); c.needsUpdate = true; return c; };
  const m = std({ map: t("diff", true), normalMap: t("nor", false), roughnessMap: t("rough", false), ...extra });
  if (TEX_AVG[id] && extra.color) m.color.multiplyScalar(Math.min(3, 1 / Math.pow(TEX_AVG[id], 2.2)));
  return m;
}
/** a textured floor laid over a slab's top (around the cut's lip), the texture repeating every `tile` metres */
function floorOver(ctx, id, color, tile, [x0, x1, z0, z1], y, lip, extra = {}) {
  const { C } = ctx;
  const strip = (a, b, c, d) => { if (b - a > 0.05 && d - c > 0.05) face(ctx, pbrSized(ctx, id, b - a, d - c, tile, { color: C(color), ...extra }), b - a, d - c, (a + b) / 2, y + 0.003, (c + d) / 2, true); };
  // (a floor running on toward the camera, the apron: also the strip in front of the hole, where the slab is bare)
  if (lip) { strip(x0, x1, z0, lip[2]); strip(x0, lip[0], lip[2], z1); strip(lip[1], x1, lip[2], z1); strip(lip[0], lip[1], lip[3], z1); } else strip(x0, x1, z0, z1);
}
/** glazed square tiles with white grout, drawn here (no licence): 4 x 4 tiles a texture, each a slightly different shade */
function tileMat(ctx, color, w, h, tile = 0.6) {
  const { THREE, std, C } = ctx;
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  g.fillStyle = "#eef2f6"; g.fillRect(0, 0, 512, 512);
  const base = new THREE.Color(color), hsl = base.getHSL({});
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const k = ((i * 7 + j * 13) % 5) / 5 - 0.4, col = new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(0.9, Math.max(0.05, hsl.l + k * 0.06)));
    const x = i * 128 + 5, y = j * 128 + 5, s = 118;
    const grad = g.createLinearGradient(x, y, x + s, y + s); grad.addColorStop(0, `#${col.clone().offsetHSL(0, 0, 0.05).getHexString()}`); grad.addColorStop(1, `#${col.getHexString()}`);
    g.fillStyle = grad; g.fillRect(x, y, s, s);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(w / (tile * 4), h / (tile * 4));
  return std({ map: t, color: C("#ffffff"), roughness: 0.18, metalness: 0.02 });
}
/** a tiled floor laid over a slab's top (around the cut's lip), like floorOver but with the drawn tiles (no texture file) */
function tileFloor(ctx, color, [x0, x1, z0, z1], y, lip, tile) {
  const strip = (a, b, c, d) => { if (b - a > 0.05 && d - c > 0.05) face(ctx, tileMat(ctx, color, b - a, d - c, tile), b - a, d - c, (a + b) / 2, y + 0.003, (c + d) / 2, true); };
  // (a floor running on toward the camera, the apron: also the strip in front of the hole, where the slab is bare)
  if (lip) { strip(x0, x1, z0, lip[2]); strip(x0, lip[0], lip[2], z1); strip(lip[1], x1, lip[2], z1); strip(lip[0], lip[1], lip[3], z1); } else strip(x0, x1, z0, z1);
}
/** a pegboard: a tan hardboard with a grid of dark holes, drawn here (one hole every 5 cm would be noise at video size: 10 cm) */
function pegMat(ctx, w, h) {
  const { THREE, std, C } = ctx;
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#d2ad74"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#8a6a42";
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(i * 32 + 16, j * 32 + 16, 4, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(w / 0.8, h / 0.8);
  return std({ map: t, color: C("#ffffff"), roughness: 0.8 });
}
/** an interior's shell in section (the room's): the back wall, the left wall with its cut edge, the ceiling and the roof
 * slice, the far city; `upper`: the house's storey above it with windows (a kitchen is in a house, a workshop need not be) */
function shell(ctx, { L0, R0, back, H, top, color, outside, upper = true, ceiling = true }) {
  const { box, scene, std, PBR, C } = ctx;
  const wall = ctx.gltf ? pbrSized(ctx, "painted_plaster_wall", R0 - L0, H, 2.5, { color: C(color) }) : PBR("painted_plaster_wall", 0.25, { color: C(color) }), cutFace = std({ color: C("#f4f1ea"), roughness: 0.8 });
  box(wall, R0 - L0, H, 0.35, (L0 + R0) / 2, top + H / 2, back - 0.17, scene, 0.02);
  box(wall, 0.35, H, -back, L0 - 0.17, top + H / 2, back / 2, scene, 0.02);
  box(cutFace, 0.37, H, 0.05, L0 - 0.17, top + H / 2, 0.01, scene, 0.005); // the wall's cut edge
  // (ceiling false: an open top, so a high camera sees the back wall; nothing then hangs from it)
  if (ceiling) { box(cutFace, R0 - L0 + 0.35, 0.3, -back + 0.35, (L0 + R0) / 2 - 0.17, top + H + 0.15, back / 2 - 0.17, scene, 0.02);
    box(std({ color: C("#b5533c"), roughness: 0.8 }), R0 - L0 + 0.8, 0.35, -back + 0.8, (L0 + R0) / 2 - 0.17, top + H + 0.47, back / 2 - 0.17, scene, 0.03); }
  if (upper && ceiling) {
    const up = PBR("painted_plaster_wall", 0.25, { color: C(outside) }), hz = back - 2.2, hw = R0 - L0 + 6;
    box(up, hw, H + 5.5, 4, (L0 + R0) / 2, top + (H + 5.5) / 2, hz - 2, scene, 0.04);
    box(std({ color: C("#b5533c"), roughness: 0.8 }), hw + 1, 0.5, 5, (L0 + R0) / 2, top + H + 5.75, hz - 2, scene, 0.04);
    const g2 = std({ color: C("#bcd8ea"), emissive: C("#dfeaf3"), emissiveIntensity: 0.15, roughness: 0.15 }), f2 = std({ color: C("#f7f5ef"), roughness: 0.5 });
    for (let x = L0 - 1.5; x <= R0 + 1.5; x += 3.6) { box(f2, 1.7, 1.7, 0.1, x, top + H + 2.6, hz + 0.02, scene, 0.02); box(g2, 1.5, 1.5, 0.1, x, top + H + 2.6, hz + 0.06, scene, 0.01); }
  }
  farRow(ctx, back - 26);
}

/** a flat textured face (a wall, a floor): a plane, w x h, facing +z (or up, when `floor`) */
function face(ctx, mat, w, h, x, y, z, floor = false) {
  const { THREE, scene } = ctx;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); if (floor) m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); return m;
}

// the far city: Kenney's CC0 commercial buildings (kit/models.js), each tinted a facade colour, along a street with a
// sidewalk; light haze takes the edge off the distance (the approved videos' depth)
const CITY = [["building-c", 9, "#e8b98f"], ["building-j", 10, "#9cc3e0"], ["building-e", 11, "#e3a08a"], ["building-l", 10, "#b9d3a2"], ["building-skyscraper-a", 7, "#e9d38f"], ["building-k", 10, "#a9b8de"], ["building-m", 10, "#efc0a6"], ["building-a", 9, "#c9dcb6"]];
function city(ctx, zFront, { road: withRoad = true, x0 = -46, x1 = 46 } = {}) {
  const { THREE, scene, std, C, PBR } = ctx;
  if (withRoad) { const road = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 40, 12), PBR("asphalt_02", 8, { color: C("#8d8d8d") })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, zFront + 8); road.receiveShadow = true; scene.add(road); }
  const walk = pbrSized(ctx, "concrete_pavement", x1 - x0 + 40, 4, 2.5, { color: C("#d8d4cc") });
  const w = face(ctx, walk, x1 - x0 + 40, 4, 0, 0.06, zFront + 1, true); w.position.y = 0.06;
  // the kerb between them
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 40, 0.14, 0.25), std({ color: C("#bdb8ae"), roughness: 0.8 })); kerb.position.set(0, 0.07, zFront + 2.9); kerb.receiveShadow = true; scene.add(kerb);
  let x = x0, i = 0;
  // the distance haze is in the city's own colour (lifted toward the sky), so the setting and the cut stay crisp however
  // far back the camera stands (a scene fog washed out the whole build in wide shots, and left a flat band at the horizon)
  const HAZE = ["#b9c6d4", 0.32], HAZE_NEAR = ["#b9c6d4", 0.18];
  while (x < x1) { const [name, size, tint] = CITY[i % CITY.length]; model(ctx, `commercial/${name}.glb`, { pos: [x + size / 2, 0.06, zFront - size / 2], size, tint, gloss: 0.85, haze: HAZE }); x += size + 1.2; i++; }
  // a far skyline behind it, more hazed, so a high camera sees city to the horizon (not the yard world's striped lawn)
  // (sized for 20-24 m tall: the slim towers are four times taller than wide; a pale neutral tint, well hazed)
  const SKY = [["low-detail-building-a", 5.5], ["low-detail-building-wide-a", 19], ["low-detail-building-d", 6.2], ["low-detail-building-k", 7], ["low-detail-building-wide-b", 18], ["low-detail-building-g", 5.2]];
  for (let sx = x0 - 20, j = 0; sx < x1 + 20; j++) { const [name, size] = SKY[j % SKY.length]; model(ctx, `commercial/${name}.glb`, { pos: [sx + size / 2, 0, zFront - 26 - (j % 2) * 5], size, tint: "#d5dde4", gloss: 0.9, haze: ["#b9c6d4", 0.45] }); sx += size + 3; }
  // street trees along the far sidewalk (depth between the setting and the city)
  for (let tx = x0 + 7, j = 0; tx < x1; tx += 9.5, j++) model(ctx, `suburban/${j % 3 ? "tree-large" : "tree-small"}.glb`, { pos: [tx, 0.06, zFront + 1.6], size: j % 3 ? 4.2 : 3.2, gloss: 0.9, haze: HAZE_NEAR });
}

/** a far row of taller buildings with lit windows (z: their front), so no empty field shows behind a setting */
function farRow(ctx, zFront, opts = {}) {
  if (ctx.gltf) return city(ctx, zFront, opts);
  const { box, scene, std, C } = ctx;
    const far = [["#9fb7c9", 13], ["#d9a86c", 17], ["#8fa889", 11], ["#c27b6b", 15], ["#a99bc4", 19], ["#d8c39a", 12], ["#86a4b8", 16]];
    far.forEach(([col, h], i) => { const w = 11, x = -36 + i * 12, z = zFront; const wall = std({ color: C(col), roughness: 0.8 }); box(wall, w, h, 9, x, h / 2, z, scene, 0.05);
      const win = std({ color: C("#cfe2ef"), emissive: C("#e8f1f7"), emissiveIntensity: 0.2, roughness: 0.2 });
      for (let y = 2.2; y < h - 1; y += 2.4) for (let k = -3.6; k <= 3.6; k += 2.4) { const m = box(win, 1.2, 1.4, 0.1, x + k, y, z + 4.52, scene, 0.02); m.castShadow = false; } });
}

export function backdrop(ctx, opts) {
  const { THREE, scene, box, cyl, std, PBR, C, cut } = ctx;
  // closed (a thin slab with nothing dug: a street topic): the floor runs whole over the cut, which still places the road
  const open = cut && !opts.closed;
  const hole = open ? [cut.x0, cut.x1, cut.z0, 0] : null;
  // an indoor floor laps 6 cm over the cut edge, so the lawn turf of the cut rim never shows under it
  const lip = open ? [cut.x0 + 0.06, cut.x1 - 0.06, cut.z0 + 0.06, 0.05] : null;
  const lamp = (x, z) => { const pole = std({ color: C("#2d3236"), roughness: 0.5, metalness: 0.6 }); cyl(pole, 0.09, 5.2, x, 2.6, z, scene, "y", 12); box(pole, 0.9, 0.12, 0.12, x + 0.4, 5.15, z, scene, 0.03); const head = box(std({ color: C("#fff6dc"), emissive: C("#ffe9b0"), emissiveIntensity: 0.6, roughness: 0.3 }), 0.5, 0.18, 0.32, x + 0.8, 5.0, z, scene, 0.05); head.castShadow = false; };
  const bench = (x, z, rot = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); const wood = std({ color: C("#a8743f"), roughness: 0.7 }), iron = std({ color: C("#2d3236"), roughness: 0.5, metalness: 0.5 }); box(wood, 2.2, 0.08, 0.6, 0, 0.62, 0, g, 0.02); box(wood, 2.2, 0.5, 0.06, 0, 1.0, -0.28, g, 0.02); for (const sx of [-0.95, 0.95]) box(iron, 0.08, 0.62, 0.55, sx, 0.31, 0, g, 0.02); };
  if (opts.type === "street") {
    const walk = PBR("beige_wall_001", 0.35, { color: C("#d9d6d0") });
    // the road along the camera's view (kit/street.js; road false: the old sidewalk-only street)
    const R = opts.road === false ? null : streetRoad({ cut, road: opts.road ?? {}, back: opts.back ?? STREET_BACK });
    const top = opts.walkTop ?? 0.12, back = opts.back ?? (R ? STREET_BACK : -8);
    // apron (a thin-slab world): the sidewalk and the road run on toward the camera instead of ending at an edge
    const zf = opts.apron ? 40 : 0.04;
    slabAround(ctx, walk, [-26, 26, back, zf], -0.2, top, lip);
    if (ctx.gltf) floorOver(ctx, "concrete_pavement", "#dcd8d0", 2.4, [-26, 26, back, zf], top, lip);
    // paving joints: thin dark lines every 1.5 m along x (cheap, no texture)
    const joint = std({ color: C("#a9a49b"), roughness: 0.9 });
    for (let x = -24; x <= 24 && !ctx.gltf; x += 1.5) { if (hole && x > hole[0] - 0.1 && x < hole[1] + 0.1) continue; if (R && x > R.x0 - 0.3 && x < R.x1 + 0.3) continue; const j = box(joint, 0.04, 0.005, -back, x, top + 0.003, back / 2, scene, 0.001); j.castShadow = false; }
    if (R) {
      // asphalt from the front edge to the cross street behind the shops, raised curbs, a double yellow centre line, the
      // stop line in the lane going away, a zebra crosswalk in front of it
      const asphalt = PBR("asphalt_02", 3, { color: C("#8f8f8f") }), paint = std({ color: C("#f4f2ea"), roughness: 0.6 }), yellow = std({ color: C("#f2c230"), roughness: 0.6 });
      const len = -(back - 8.5) + zf, zc = (back - 8.5 + zf) / 2;
      const road = box(asphalt, R.w, 0.03, len, R.cx, top + 0.006, zc, scene, 0.005); road.castShadow = false; road.receiveShadow = true;
      for (const sx of [R.x0 - 0.1, R.x1 + 0.1]) { const c = box(std({ color: C("#cfccc4"), roughness: 0.7 }), 0.2, 0.16, -back + zf, sx, top + 0.06, (back + zf) / 2, scene, 0.02); c.castShadow = false; }
      for (const dx of [-0.09, 0.09]) for (let z = zf > 1 ? 30 : -0.6; z > back + 2.2; z -= 3) { if (z < R.crossZ[1] + 0.2 && z > R.crossZ[0] - 0.2) continue; const m = box(yellow, 0.1, 0.008, 2, R.cx + dx, top + 0.026, z - 1, scene, 0.002); m.castShadow = false; }
      const sl = box(paint, R.w / 2 - 0.3, 0.008, 0.45, R.laneOut, top + 0.026, R.stopZ, scene, 0.002); sl.castShadow = false;
      for (let x = R.x0 + 0.5; x < R.x1 - 0.3; x += 0.9) { const m = box(paint, 0.5, 0.008, R.crossZ[1] - R.crossZ[0], x + 0.25, top + 0.026, (R.crossZ[0] + R.crossZ[1]) / 2, scene, 0.002); m.castShadow = false; }
    }
    // the shop fronts: three buildings side by side, the middle one is the shop (with a road: on either side of it)
    const shops = opts.shops ?? (R
      ? [{ x: R.x0 - 0.8 - 5.2, w: 10.4, h: 8, color: "#7fa7c9" }, { x: R.x1 + 0.8 + 6, w: 12, h: 7.4, color: "#e9c46a", shop: true }, { x: R.x1 + 0.8 + 12 + 5.4, w: 10.5, h: 9, color: "#c0584a" }]
      : [{ x: -11, w: 9.6, h: 8, color: "#7fa7c9" }, { x: 0, w: 12, h: 7.4, color: "#e9c46a", shop: true }, { x: 11.5, w: 10.5, h: 9, color: "#c0584a" }]);
    for (const s of shops) {
      const z = back - 0.4, g = new THREE.Group(); g.position.set(s.x, top, z); scene.add(g);
      const wall = ctx.gltf ? pbrSized(ctx, s.shop ? "brick_wall_02" : "painted_plaster_wall", s.w, s.h, s.shop ? 2 : 3, { color: C(s.shop ? "#f2e2d0" : s.color) }) : PBR("painted_plaster_wall", 0.25, { color: C(s.color) });
      box(wall, s.w, s.h, 0.8, 0, s.h / 2, 0, g, 0.04);
      // window sills under the upper windows
      if (ctx.gltf) for (let x = -s.w / 2 + 1.6; x <= s.w / 2 - 1.4; x += 2.4) box(std({ color: C("#f2efe8"), roughness: 0.6 }), 1.7, 0.1, 0.25, x, s.h - 2.15, 0.5, g, 0.02);
      box(std({ color: C("#f2efe8"), roughness: 0.6 }), s.w + 0.2, 0.3, 1.0, 0, s.h + 0.15, 0, g, 0.04); // cornice
      const glass = std({ color: C("#bcd8ea"), emissive: C(s.shop ? "#ffe7b8" : "#dfeaf3"), emissiveIntensity: s.shop ? 0.5 : 0.15, roughness: 0.15 });
      const frame = std({ color: C("#2d3236"), roughness: 0.5 });
      const up = s.h - 1.25;
      for (let x = -s.w / 2 + 1.6; x <= s.w / 2 - 1.4; x += 2.4) { box(frame, 1.5, 1.7, 0.1, x, up, 0.42, g, 0.02); box(glass, 1.3, 1.5, 0.1, x, up, 0.46, g, 0.01); }
      if (s.shop) {
        box(frame, s.w - 2.4, 2.9, 0.12, -0.7, 1.75, 0.42, g, 0.02); box(glass, s.w - 2.7, 2.6, 0.12, -0.7, 1.75, 0.47, g, 0.01);
        box(std({ color: C("#3a5f4a"), roughness: 0.5 }), 1.3, 2.6, 0.14, s.w / 2 - 1.0, 1.3, 0.43, g, 0.02); // door
        // the awning: red and white stripes, tilted out over the sidewalk
        const aw = new THREE.Group(); aw.position.set(0, 3.55, 0.45); aw.rotation.x = 0.5; g.add(aw);
        for (let i = 0; i < 12; i++) box(std({ color: C(i % 2 ? "#f4f0e8" : "#c8372f"), roughness: 0.7 }), (s.w - 0.4) / 12, 0.05, 1.7, -s.w / 2 + 0.2 + (i + 0.5) * ((s.w - 0.4) / 12), 0, 0.85, aw, 0.01);
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(s.w - 2.5, 0.9), new THREE.MeshStandardMaterial({ map: sign(THREE, opts.sign ?? "CORNER STORE", "#2d3236", "#ffd34d", s.w - 2.5, 0.9), emissive: new THREE.Color("#ffe9a8"), emissiveIntensity: 0.25, roughness: 0.5 }));
        sg.position.set(0, 4.55, 0.43); g.add(sg);
      }
    }
    // behind the shops: the street and a far row of taller buildings, so no empty field shows from above
    const asphalt = PBR("asphalt_02", 6, { color: C("#9a9a9a") });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), asphalt); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, back - 8.5); road.receiveShadow = true; scene.add(road);
    farRow(ctx, back - 22, { road: false });
    // (never on the road: a lamp or a bench there moves to the sidewalk beyond the curb)
    const offRoad = (x, pad) => (R && x > R.x0 - pad && x < R.x1 + pad ? (x < R.cx ? R.x0 - pad : R.x1 + pad) : x);
    // (with a road: across it from the cut and back from the front edge, out of the camera's way down the road)
    if (R) lamp(R.side > 0 ? R.x1 + 0.8 : R.x0 - 1.6, -6); else lamp(opts.lampX ?? 6.5, -1.0);
    if (ctx.gltf && opts.parked !== false) model(ctx, "car/taxi.glb", { pos: [opts.parkedX ?? -14, 0.02, back - 6], rotY: Math.PI / 2, size: 4.2 });
    if (opts.bench !== false) bench(offRoad(opts.benchX ?? -6.5, 1.6), back + 1.4);
  } else if (opts.type === "garage") {
    // a concrete driveway up to a garage with its door half open (the lit inside: shelves, a workbench), the side of
    // the house beside it
    const conc = PBR("beige_wall_001", 0.35, { color: C("#c9c6c0") }), top = 0.08, back = opts.back ?? -9;
    slabAround(ctx, conc, [-7, 7, back, 0.04], -0.2, top, lip);
    if (ctx.gltf) floorOver(ctx, "garage_floor", "#bdbab4", 3, [-7, 7, back, 0.04], top, lip);
    farRow(ctx, back - 24);
    const g = new THREE.Group(); g.position.set(opts.x ?? 0, top, back - 3.5); scene.add(g);
    const W = 9, H = 4.4, Dd = 7;
    const wall = ctx.gltf ? pbrSized(ctx, "painted_plaster_wall", W, H, 3, { color: C(opts.color ?? "#e8dcc4") }) : PBR("painted_plaster_wall", 0.25, { color: C(opts.color ?? "#e8dcc4") }), trim = std({ color: C("#f4f1ea"), roughness: 0.6 });
    box(wall, 0.4, H, Dd, -W / 2, H / 2, 0, g, 0.03); box(wall, 0.4, H, Dd, W / 2, H / 2, 0, g, 0.03); box(wall, W, H, 0.4, 0, H / 2, -Dd / 2, g, 0.03);
    box(wall, W, 1.3, 0.4, 0, H - 0.65, Dd / 2, g, 0.03); // over the door
    const roof = ctx.gltf ? pbrSized(ctx, "roof_09", W + 0.8, Dd + 0.8, 2, { color: C("#c9876a") }) : std({ color: C("#7a4a3a"), roughness: 0.8 }); box(roof, W + 0.8, 0.35, Dd + 0.8, 0, H + 0.17, 0, g, 0.04);
    box(trim, W + 0.9, 0.18, 0.2, 0, H - 0.05, Dd / 2 + 0.25, g, 0.02);
    // its concrete floor (the lawn showed through the open door)
    box(std({ color: C("#a9a59e"), roughness: 0.9 }), W - 0.4, 0.04, Dd - 0.2, 0, 0.02, 0, g, 0.01);
    const inside = std({ color: C("#4a4f55"), emissive: C("#fff1d0"), emissiveIntensity: 0.08, roughness: 0.9 });
    box(inside, W - 0.8, H - 0.4, 0.05, 0, H / 2, -Dd / 2 + 0.23, g, 0.01);
    // the roll-up door, half open: horizontal slats in the top half of the opening
    const slat = std({ color: C("#f0eee8"), roughness: 0.5 });
    // (door false: the video builds its own door in the opening, x -4.05 to 4.05 from the garage centre, 3.1 tall)
    if (opts.door !== false) for (let i = 0; i < 4; i++) box(slat, W - 0.9, 0.36, 0.08, 0, H - 1.5 - i * 0.38, Dd / 2 - 0.05, g, 0.02);
    // inside: shelves with boxes on the back wall, a workbench, a ceiling light
    const shelf = std({ color: C("#8a6a48"), roughness: 0.7 }), boxes = ["#c8372f", "#3a7bd5", "#e9c46a", "#5aa469"];
    for (const y of [0.9, 1.7]) { box(shelf, 3.2, 0.08, 0.6, -2.4, y, -Dd / 2 + 0.6, g, 0.01); boxes.forEach((c, i) => box(std({ color: C(c), roughness: 0.7 }), 0.55, 0.45, 0.45, -3.6 + i * 0.8, y + 0.27, -Dd / 2 + 0.6, g, 0.03)); }
    box(shelf, 2.6, 0.12, 0.9, 2.4, 1.0, -Dd / 2 + 0.7, g, 0.02); for (const sx of [1.3, 3.5]) box(std({ color: C("#2d3236"), roughness: 0.5 }), 0.1, 1.0, 0.8, sx, 0.5, -Dd / 2 + 0.7, g, 0.01);
    const bulb = box(std({ color: C("#fff6dc"), emissive: C("#ffe9b0"), emissiveIntensity: 0.9 }), 0.8, 0.08, 0.3, 0, H - 0.3, 0, g, 0.02); bulb.castShadow = false;
    // the house beside the garage (its side wall and windows), so the driveway reads as a home
    const hx = (opts.x ?? 0) - W / 2 - 5.2, hw = 10, hh = 7.5;
    box(wall, hw, hh, 7, hx, top + hh / 2, back - 3.5, scene, 0.04);
    box(roof, hw + 0.8, 0.4, 7.8, hx, top + hh + 0.2, back - 3.5, scene, 0.04);
    const glass = std({ color: C("#bcd8ea"), emissive: C("#dfeaf3"), emissiveIntensity: 0.15, roughness: 0.15 }), frame = std({ color: C("#2d3236"), roughness: 0.5 });
    for (const [x, y] of [[-2.5, 2], [2.5, 2], [-2.5, 5], [2.5, 5]]) {
      box(ctx.gltf ? std({ color: C("#f7f5ef"), roughness: 0.5 }) : frame, 1.6, 1.6, 0.1, hx + x, top + y, back, scene, 0.02); box(glass, 1.4, 1.4, 0.1, hx + x, top + y, back + 0.04, scene, 0.01);
      // the approved house's blue shutters and white sills
      if (ctx.gltf) { const sh = std({ color: C("#2f5fa8"), roughness: 0.6 }); for (const sx of [-1.15, 1.15]) box(sh, 0.55, 1.6, 0.08, hx + x + sx, top + y, back + 0.06, scene, 0.02); box(std({ color: C("#f7f5ef"), roughness: 0.5 }), 1.9, 0.12, 0.3, hx + x, top + y - 0.86, back + 0.12, scene, 0.02); }
    }
    if (opts.lamp !== false) lamp(opts.lampX ?? 6.2, -1.2);
  } else if (opts.type === "room") {
    // a room in section (the creator's air-conditioner world): a wood floor over the cut ground, a back wall with a
    // window, the left wall, the ceiling and a slice of the roof on top; an armchair, a lamp and a rug
    const top = 0.12, back = opts.back ?? -7, L0 = opts.x0 ?? -9, R0 = opts.x1 ?? 9, H = opts.h ?? 4.2;
    const floor = std({ color: C("#b98a5a"), roughness: 0.6 });
    slabAround(ctx, floor, [L0, R0, back, 0.04], -0.2, top, lip); // a floor in section: it covers the turf band at the face
    if (ctx.gltf) floorOver(ctx, "laminate_floor_02", "#c4935f", 2.2, [L0, R0, back, 0.04], top, lip, { roughness: 0.45 });
    const plank = std({ color: C("#9c6f44"), roughness: 0.7 });
    for (let x = L0 + 0.6; x < R0 && !ctx.gltf; x += 0.6) { if (hole && x > hole[0] - 0.05 && x < hole[1] + 0.05) continue; const j = box(plank, 0.03, 0.004, -back, x, top + 0.002, back / 2, scene, 0.001); j.castShadow = false; }
    const wall = ctx.gltf ? pbrSized(ctx, "painted_plaster_wall", R0 - L0, H, 2.5, { color: C(opts.color ?? "#e9e1cf") }) : PBR("painted_plaster_wall", 0.25, { color: C(opts.color ?? "#e9e1cf") }), cutFace = std({ color: C("#f4f1ea"), roughness: 0.8 });
    box(wall, R0 - L0, H, 0.35, (L0 + R0) / 2, top + H / 2, back - 0.17, scene, 0.02);
    box(wall, 0.35, H, -back, L0 - 0.17, top + H / 2, back / 2, scene, 0.02);
    box(cutFace, 0.37, H, 0.05, L0 - 0.17, top + H / 2, 0.01, scene, 0.005); // the wall's cut edge
    box(std({ color: C("#f4f1ea"), roughness: 0.6 }), R0 - L0, 0.14, 0.05, (L0 + R0) / 2, top + 0.07, back + 0.03, scene, 0.01); // baseboard
    // the ceiling and the roof slice above it
    box(cutFace, R0 - L0 + 0.35, 0.3, -back + 0.35, (L0 + R0) / 2 - 0.17, top + H + 0.15, back / 2 - 0.17, scene, 0.02);
    box(std({ color: C("#b5533c"), roughness: 0.8 }), R0 - L0 + 0.8, 0.35, -back + 0.8, (L0 + R0) / 2 - 0.17, top + H + 0.47, back / 2 - 0.17, scene, 0.03);
    // the house the room is in: the storey above (windows) and its roof, set back behind the room
    const up = PBR("painted_plaster_wall", 0.25, { color: C(opts.outside ?? "#d9c7a3") }), hz = back - 2.2, hw = R0 - L0 + 6;
    box(up, hw, H + 5.5, 4, (L0 + R0) / 2, top + (H + 5.5) / 2, hz - 2, scene, 0.04);
    box(std({ color: C("#b5533c"), roughness: 0.8 }), hw + 1, 0.5, 5, (L0 + R0) / 2, top + H + 5.75, hz - 2, scene, 0.04);
    const g2 = std({ color: C("#bcd8ea"), emissive: C("#dfeaf3"), emissiveIntensity: 0.15, roughness: 0.15 }), f2 = std({ color: C("#f7f5ef"), roughness: 0.5 });
    for (let x = L0 - 1.5; x <= R0 + 1.5; x += 3.6) { box(f2, 1.7, 1.7, 0.1, x, top + H + 2.6, hz + 0.02, scene, 0.02); box(g2, 1.5, 1.5, 0.1, x, top + H + 2.6, hz + 0.06, scene, 0.01); }
    farRow(ctx, back - 26);
    // the window: a bright sky behind glass, a frame and a sill
    const wx = opts.windowX ?? 3, frame = std({ color: C("#f7f5ef"), roughness: 0.5 });
    const sky = std({ color: C("#bfe0f5"), emissive: C("#d9efff"), emissiveIntensity: 0.55, roughness: 0.2 });
    box(sky, 2.6, 1.8, 0.05, wx, top + 2.3, back + 0.02, scene, 0.005);
    box(frame, 2.9, 0.12, 0.12, wx, top + 3.25, back + 0.05, scene, 0.02); box(frame, 2.9, 0.12, 0.12, wx, top + 1.35, back + 0.05, scene, 0.02);
    box(frame, 0.12, 2.0, 0.12, wx - 1.4, top + 2.3, back + 0.05, scene, 0.02); box(frame, 0.12, 2.0, 0.12, wx + 1.4, top + 2.3, back + 0.05, scene, 0.02); box(frame, 0.08, 1.8, 0.08, wx, top + 2.3, back + 0.05, scene, 0.01);
    box(frame, 3.1, 0.1, 0.35, wx, top + 1.28, back + 0.17, scene, 0.02);
    // an armchair, a floor lamp and a rug
    const fabric = std({ color: C(opts.chair ?? "#4f7fa8"), roughness: 0.85 }), ch = new THREE.Group(); ch.position.set(opts.chairX ?? -5, top, back + 1.6); ch.rotation.y = 0.35; scene.add(ch);
    box(fabric, 1.6, 0.5, 1.4, 0, 0.45, 0, ch, 0.12); box(fabric, 1.6, 1.1, 0.35, 0, 0.95, -0.55, ch, 0.12); for (const sx of [-0.7, 0.7]) box(fabric, 0.3, 0.75, 1.4, sx, 0.6, 0, ch, 0.1);
    const brass = std({ color: C("#c9a45c"), roughness: 0.35, metalness: 0.7 }), lx = opts.lampX ?? -7.6;
    cyl(brass, 0.04, 2.2, lx, top + 1.1, back + 0.8, scene, "y", 10); const shade = cyl(std({ color: C("#fff3d6"), emissive: C("#ffe3a8"), emissiveIntensity: 0.6, roughness: 0.6 }), 0.32, 0.4, lx, top + 2.3, back + 0.8, scene, "y", 16); shade.castShadow = false;
    const rug = box(std({ color: C("#b4553e"), roughness: 0.9 }), 4.2, 0.01, 2.6, opts.rugX ?? -3.5, top + 0.006, back + 2.6, scene, 0.002); rug.castShadow = false;
  } else if (opts.type === "kitchen") {
    // a kitchen in section (the room's shell): a tiled floor (top y 0.12) over the cut ground; base cabinets with a wood
    // worktop, a tiled splashback and wall cabinets along the back wall on BOTH sides of an open slot (gap [x0, x1]): the
    // appliance being explained stands in front of it, so only plain wall shows behind it; a hob on the left run, a sink
    // under the window on the right run, two pendant lights over the runs (never over the slot: they would hang in front).
    // Built at the appliances' scale (k, 2.2 x real: the camera rules want big subjects, so a stove is ~2.6 m wide and
    // ~2 m tall): the worktop at ~2 m, the cabinets ~1.36 m deep, the wall cabinets from ~3.4 m, the walls 6.2 tall.
    // Open-topped by default (a high camera sees the wall cabinets and the window over the walls; ceiling true adds
    // the ceiling, the roof slice, the storey above and the pendant lights, as the room has)
    const k = opts.scale ?? 2.2, top = 0.12, back = opts.back ?? -7, L0 = opts.x0 ?? -12, R0 = opts.x1 ?? 12, H = opts.h ?? 6.2;
    const [g0, g1] = opts.gap ?? [opts.gapX0 ?? -1.8, opts.gapX1 ?? 1.8];
    // (a thin-slab world: the floor runs on to the camera, so no lawn strip shows in front of it)
    const zf = opts.apron ? 40 : 0.04;
    slabAround(ctx, std({ color: C("#d8cdb8"), roughness: 0.4 }), [L0, R0, back, zf], -0.2, top, lip);
    tileFloor(ctx, opts.floor ?? "#d9cbb2", [L0, R0, back, zf], top, lip, 0.5 * k);
    shell(ctx, { L0, R0, back, H, top, color: opts.color ?? "#f1e6cf", outside: opts.outside ?? "#d9c7a3", ceiling: opts.ceiling === true });
    const cab = std({ color: C(opts.cabinets ?? "#6f9c88"), roughness: 0.55 }), wood = std({ color: C("#d6a466"), roughness: 0.5 });
    const seam = std({ color: C("#4e7564"), roughness: 0.7 }), steel = std({ color: C("#cfd4d8"), roughness: 0.25, metalness: 0.7 }), dark = std({ color: C("#3a3f44"), roughness: 0.6 });
    const D = 0.62 * k, zc = back + D, wt = top + 0.91 * k; // the cabinets' depth and front face, the worktop's middle
    const uY = top + 1.95 * k, uH = 0.8 * k, uD = 0.36 * k; // the wall cabinets' middle, height and depth
    // a run of cabinets from x a to b (doors every ~0.6 m real: a thin darker seam, a steel handle); uppers: the wall
    // cabinets' spans (none over the window)
    const run = (a, b, uppers = [[a, b]]) => {
      if (b - a < 0.5 * k) return;
      const m = (a + b) / 2, n = Math.max(1, Math.round((b - a) / (0.6 * k))), dw = (b - a) / n;
      box(dark, b - a - 0.04, 0.1 * k, D - 0.06 * k, m, top + 0.05 * k, back + D / 2 - 0.03 * k, scene, 0.01); // the plinth, set back
      box(cab, b - a, 0.78 * k, D, m, top + 0.49 * k, back + D / 2, scene, 0.03 * k);
      box(wood, b - a + 0.04 * k, 0.06 * k, D + 0.06 * k, m, wt, back + (D + 0.06 * k) / 2, scene, 0.015 * k); // the worktop
      for (let i = 0; i < n; i++) { const x = a + (i + 0.5) * dw; if (i) box(seam, 0.025 * k, 0.7 * k, 0.01 * k, a + i * dw, top + 0.49 * k, zc + 0.005 * k, scene, 0.003); box(steel, 0.28 * k, 0.035 * k, 0.04 * k, x, top + 0.78 * k, zc + 0.02 * k, scene, 0.01 * k); }
      face(ctx, tileMat(ctx, opts.splash ?? "#f4f1ea", b - a, 0.62 * k, 0.15 * k), b - a, 0.62 * k, m, top + 1.25 * k, back + 0.01); // the splashback
      for (const [u0, u1] of uppers) {
        if (u1 - u0 < 0.5 * k) continue;
        const um = (u0 + u1) / 2, un = Math.max(1, Math.round((u1 - u0) / (0.6 * k))), uw = (u1 - u0) / un;
        box(cab, u1 - u0, uH, uD, um, uY, back + uD / 2, scene, 0.03 * k);
        for (let i = 0; i < un; i++) { if (i) box(seam, 0.025 * k, 0.72 * k, 0.01 * k, u0 + i * uw, uY, back + uD + 0.005 * k, scene, 0.003); box(steel, 0.035 * k, 0.22 * k, 0.04 * k, u0 + (i + 0.5) * uw + uw * 0.3, uY - 0.25 * k, back + uD + 0.02 * k, scene, 0.01 * k); }
      }
    };
    // the window over the right run's sink (wall cabinets either side of it): sky behind glass, a frame and a mullion
    const ww = 2.0 * k, wh = 0.95 * k, wy = top + 1.66 * k + wh / 2, wx = opts.windowX ?? (g1 + R0) / 2 + 0.4, frame = std({ color: C("#f7f5ef"), roughness: 0.5 });
    run(L0, g0); run(g1, R0, [[g1, wx - ww / 2 - 0.15 * k], [wx + ww / 2 + 0.15 * k, R0]]);
    const sky = std({ color: C("#bfe0f5"), emissive: C("#d9efff"), emissiveIntensity: 0.55, roughness: 0.2 }), fw = 0.06 * k;
    box(sky, ww, wh, 0.05, wx, wy, back + 0.02, scene, 0.005);
    for (const sy of [-1, 1]) box(frame, ww + 2 * fw, fw, fw, wx, wy + sy * (wh / 2 + fw / 2), back + 0.05, scene, 0.02);
    for (const sx of [-1, 1]) box(frame, fw, wh + 2 * fw, fw, wx + sx * (ww / 2 + fw / 2), wy, back + 0.05, scene, 0.02);
    box(frame, fw * 0.7, wh, fw * 0.7, wx, wy, back + 0.05, scene, 0.01);
    // the sink (a steel basin set in the worktop) and its tap
    if (g1 < wx - 0.6 * k && wx + 0.6 * k < R0) {
      box(steel, 1.0 * k, 0.03 * k, 0.45 * k, wx, wt + 0.035 * k, back + 0.34 * k, scene, 0.02 * k); box(dark, 0.85 * k, 0.02 * k, 0.33 * k, wx, wt + 0.045 * k, back + 0.34 * k, scene, 0.01 * k);
      cyl(steel, 0.03 * k, 0.4 * k, wx, wt + 0.23 * k, back + 0.1 * k, scene, "y", 10); box(steel, 0.05 * k, 0.05 * k, 0.22 * k, wx, wt + 0.42 * k, back + 0.2 * k, scene, 0.02 * k);
    }
    // the hob on the left run: a black glass top with four rings
    const hx = opts.hobX ?? (L0 + g0) / 2;
    if (hx - 0.4 * k > L0 && hx + 0.4 * k < g0) {
      box(std({ color: C("#25282c"), roughness: 0.15 }), 0.75 * k, 0.015 * k, 0.5 * k, hx, wt + 0.037 * k, back + 0.34 * k, scene, 0.005);
      for (const [dx, dz] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.12], [0.18, 0.12]]) { const r = cyl(std({ color: C("#5a5f66"), roughness: 0.4 }), 0.09 * k, 0.006 * k, hx + dx * k, wt + 0.047 * k, back + (0.34 + dz) * k, scene, "y", 20); r.castShadow = false; }
    }
    // two pendant lights from the ceiling, over the runs' front edge (a cord, a dark shade, a warm glow under it)
    const shade = std({ color: C("#2f4f46"), roughness: 0.5 }), glow = std({ color: C("#fff6dc"), emissive: C("#ffe3a8"), emissiveIntensity: 0.9, roughness: 0.3 });
    const py = top + H - 0.85 * k, pz = back + 1.3 * k;
    if (opts.ceiling === true) for (const px of opts.pendants ?? [(L0 + g0) / 2 - 0.4 * k, wx - ww / 2 - 1.2 * k > g1 + 0.5 * k ? wx - ww / 2 - 1.2 * k : wx]) {
      cyl(dark, 0.012 * k, top + H - py, px, (top + H + py) / 2, pz, scene, "y", 6);
      cyl(shade, 0.26 * k, 0.26 * k, px, py - 0.13 * k, pz, scene, "y", 18); const b = cyl(glow, 0.2 * k, 0.03 * k, px, py - 0.27 * k, pz, scene, "y", 18); b.castShadow = false;
    }
  } else if (opts.type === "workshop") {
    // a home workshop in section (a garage seen from inside): a concrete floor (top y 0.08) over the cut ground, a back
    // wall with a closed roll-up door in the middle (it says "garage" and stays calm behind a car), a pegboard with tool
    // shapes over a workbench on the left, a steel shelf with boxes and a red rolling tool chest on the right, strip
    // lights. Open-topped by default, like the kitchen (ceiling true adds the ceiling and the roof slice). Everything stands against the back wall: the floor in front, x -3.5 to 3.5, is free for a car or a machine
    const top = 0.08, back = opts.back ?? -8, L0 = opts.x0 ?? -10, R0 = opts.x1 ?? 10, H = opts.h ?? 5;
    // (a thin-slab world: the floor runs on to the camera, so no lawn strip shows in front of it)
    const zf = opts.apron ? 40 : 0.04;
    slabAround(ctx, PBR("beige_wall_001", 0.35, { color: C("#c9c6c0") }), [L0, R0, back, zf], -0.2, top, lip);
    if (ctx.gltf) floorOver(ctx, "garage_floor", "#bdbab4", 3, [L0, R0, back, zf], top, lip);
    shell(ctx, { L0, R0, back, H, top, color: opts.color ?? "#e3dccd", upper: false, ceiling: opts.ceiling === true });
    const dark = std({ color: C("#3a3f44"), roughness: 0.55, metalness: 0.3 }), steel = std({ color: C("#aeb4ba"), roughness: 0.35, metalness: 0.6 });
    // the roll-up door, closed: wide slats with dark grooves, in a frame
    const dw = opts.doorW ?? 5.6, dh = Math.min(H - 1.2, 3.2), dx = opts.doorX ?? 0;
    if (opts.door !== false) {
      const slat = std({ color: C("#ecebe6"), roughness: 0.5 }), groove = std({ color: C("#b9b7b0"), roughness: 0.7 });
      box(slat, dw, dh, 0.06, dx, top + dh / 2, back + 0.03, scene, 0.01);
      for (let y = 0.45; y < dh; y += 0.45) { const g = box(groove, dw - 0.04, 0.03, 0.02, dx, top + y, back + 0.07, scene, 0.003); g.castShadow = false; }
      for (const sx of [-1, 1]) box(dark, 0.12, dh + 0.1, 0.1, dx + sx * (dw / 2 + 0.06), top + (dh + 0.1) / 2, back + 0.05, scene, 0.01);
      box(dark, dw + 0.24, 0.12, 0.1, dx, top + dh + 0.06, back + 0.05, scene, 0.01);
    }
    // the workbench (a thick wood top on steel legs, a lower shelf) under a pegboard with tool shapes
    const wb0 = opts.benchX0 ?? L0 + 2.2, wb1 = Math.min(wb0 + 4, dx - dw / 2 - 0.5), wm = (wb0 + wb1) / 2, ww = wb1 - wb0;
    if (ww > 1) {
      const wood = std({ color: C("#c48f55"), roughness: 0.6 });
      box(wood, ww, 0.1, 0.85, wm, top + 0.9, back + 0.45, scene, 0.02); box(wood, ww - 0.2, 0.05, 0.7, wm, top + 0.25, back + 0.45, scene, 0.01);
      for (const sx of [wb0 + 0.1, wb1 - 0.1]) for (const sz of [back + 0.1, back + 0.8]) box(dark, 0.07, 0.85, 0.07, sx, top + 0.425, sz, scene, 0.01);
      box(dark, 0.3, 0.2, 0.25, wb1 - 0.35, top + 1.05, back + 0.7, scene, 0.03); // a vise on the bench's end
      box(std({ color: C("#3a7bd5"), roughness: 0.5 }), 0.6, 0.3, 0.35, wb0 + 0.5, top + 1.1, back + 0.4, scene, 0.04); // a case on it
      face(ctx, pegMat(ctx, ww, 1.6), ww, 1.6, wm, top + 2.05, back + 0.02);
      // the tools hung on it: a hammer, a saw, wrenches, a screwdriver, pliers (dark steel, red and wood handles)
      const red = std({ color: C("#c8372f"), roughness: 0.5 }), handle = std({ color: C("#9c6f44"), roughness: 0.6 }), z = back + 0.06;
      const tools = [
        (x) => { box(handle, 0.06, 0.5, 0.03, x, top + 1.85, z, scene, 0.01); box(dark, 0.26, 0.09, 0.04, x, top + 2.13, z, scene, 0.015); }, // hammer
        (x) => { box(steel, 0.32, 0.55, 0.01, x, top + 1.95, z, scene, 0.005); box(red, 0.12, 0.18, 0.04, x, top + 2.3, z, scene, 0.02); }, // saw
        (x) => { for (const [k, len] of [[-0.09, 0.42], [0, 0.5], [0.09, 0.58]]) box(steel, 0.04, len, 0.02, x + k, top + 2.4 - len / 2, z, scene, 0.008); }, // wrenches
        (x) => { box(red, 0.07, 0.2, 0.05, x, top + 2.3, z, scene, 0.02); box(steel, 0.02, 0.3, 0.02, x, top + 2.05, z, scene, 0.005); }, // screwdriver
        (x) => { box(red, 0.04, 0.3, 0.03, x - 0.04, top + 1.95, z, scene, 0.01); box(red, 0.04, 0.3, 0.03, x + 0.04, top + 1.95, z, scene, 0.01); box(dark, 0.1, 0.14, 0.04, x, top + 2.17, z, scene, 0.015); } // pliers
      ];
      const step = ww / (tools.length + 1); tools.forEach((t, i) => t(wb0 + step * (i + 1)));
    }
    // the steel shelf with boxes (right) and the rolling tool chest beside it
    const s1 = opts.shelfX1 ?? R0 - 1.8, s0 = Math.max(s1 - 3.4, dx + dw / 2 + 2);
    if (s1 - s0 > 1) {
      const boxes = ["#e9c46a", "#c8372f", "#3a7bd5", "#5aa469", "#d9a86c"];
      for (const sx of [s0, s1]) for (const sz of [back + 0.08, back + 0.62]) box(steel, 0.06, 2.6, 0.06, sx, top + 1.3, sz, scene, 0.01);
      [0.35, 1.25, 2.15].forEach((y, k) => { box(steel, s1 - s0 + 0.1, 0.05, 0.62, (s0 + s1) / 2, top + y, back + 0.35, scene, 0.01); for (let x = s0 + 0.4, i = k; x < s1 - 0.3; x += 0.75, i++) box(std({ color: C(boxes[i % boxes.length]), roughness: 0.7 }), 0.6, 0.42 + (i % 2) * 0.1, 0.48, x, top + y + 0.25 + (i % 2) * 0.05, back + 0.35, scene, 0.03); });
    }
    const tx = opts.chestX ?? dx + dw / 2 + 1.0;
    if (opts.chest !== false) {
      const red = std({ color: C("#c8372f"), roughness: 0.4, metalness: 0.2 });
      box(red, 1.1, 1.0, 0.6, tx, top + 0.62, back + 0.4, scene, 0.04);
      for (let i = 0; i < 4; i++) { const y = top + 0.3 + i * 0.22; box(dark, 1.0, 0.012, 0.01, tx, y, back + 0.705, scene, 0.002); box(steel, 0.5, 0.03, 0.04, tx, y + 0.11, back + 0.72, scene, 0.01); }
      for (const sx of [-0.45, 0.45]) for (const sz of [0.15, 0.6]) cyl(dark, 0.06, 0.05, tx + sx, top + 0.06, back + sz, scene, "x", 12);
    }
    // the strip lights: bright tubes in steel housings under the ceiling
    const tube = std({ color: C("#fffbea"), emissive: C("#fff4cf"), emissiveIntensity: 1.0, roughness: 0.3 });
    // (under the ceiling when there is one; else on the back wall, high up, so nothing hangs in the air)
    for (const lx of opts.lights ?? [-4, 4]) { const [y, z] = opts.ceiling === true ? [top + H - 0.05, back / 2] : [top + H - 0.5, back + 0.25]; box(steel, 1.8, 0.08, 0.22, lx, y, z, scene, 0.02); const t = box(tube, 1.7, 0.05, 0.12, lx, y - 0.07, z, scene, 0.02); t.castShadow = false; }
  } else if (opts.type === "carwash") {
    // a car wash bay: a wet concrete floor (its drain is the world's cut), a tiled back wall, a side wall, a canopy
    // on a column with the lit sign on its front edge
    const top = 0.1, back = opts.back ?? -8, L0 = opts.x0 ?? -7, R0 = opts.x1 ?? 7, H = opts.h ?? 5.2;
    slabAround(ctx, std({ color: C("#8f9499"), roughness: 0.35, metalness: 0.05 }), [L0 - 6, R0 + 6, back, 0.04], -0.2, top, lip);
    farRow(ctx, back - 22);
    const grout = std({ color: C("#e8eef4"), roughness: 0.6 });
    box(grout, R0 - L0, H, 0.3, (L0 + R0) / 2, top + H / 2, back - 0.15, scene, 0.02);
    if (ctx.gltf) {
      // textured: the tiled back wall (Poly Haven tiles, tinted), the wet concrete floor laid over the slab, painted bay
      // lines, a plaster side wall, wall lamps, a price board, traffic cones
      face(ctx, tileMat(ctx, opts.color ?? "#2f73c8", R0 - L0, H), R0 - L0, H, (L0 + R0) / 2, top + H / 2, back + 0.01);
      floorOver(ctx, "garage_floor", "#9a9da1", 3, [L0 - 6, R0 + 6, back, 0.04], top, lip, { roughness: 0.3, metalness: 0.05 });
      const paint = std({ color: C("#f2c230"), roughness: 0.6 });
      for (const x of [L0 + 0.5, R0 - 0.5]) { const m = face(ctx, paint, 0.16, -back - 1, x, top + 0.006, back / 2, true); m.castShadow = false; }
      box(pbrSized(ctx, "painted_plaster_wall", -back, H, 3, { color: C("#eef0f2") }), 0.4, H, -back, L0 - 0.2, top + H / 2, back / 2, scene, 0.02);
      const lampM = std({ color: C("#fff6dc"), emissive: C("#ffe9b0"), emissiveIntensity: 0.8, roughness: 0.3 });
      for (const x of [L0 + 3, (L0 + R0) / 2, R0 - 3]) { box(std({ color: C("#2d3236"), roughness: 0.5 }), 0.9, 0.12, 0.5, x, top + H - 0.6, back + 0.3, scene, 0.03); const l = box(lampM, 0.8, 0.06, 0.4, x, top + H - 0.68, back + 0.32, scene, 0.02); l.castShadow = false; }
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), new THREE.MeshStandardMaterial({ map: sign(THREE, opts.price ?? "WASH  $8", "#ffffff", "#1d5fb0", 2.4, 1.1), roughness: 0.5 }));
      board.position.set(L0 + 2.6, top + 3.0, back + 0.03); scene.add(board);
      for (const [x, z] of [[R0 + 1.2, -0.9], [R0 + 2.2, -0.7]]) model(ctx, "car/cone.glb", { pos: [x, top, z], size: 0.6 });
    } else {
      const tile = std({ color: C(opts.color ?? "#3d7cc9"), roughness: 0.3 });
      for (let y = 0.4; y < H; y += 0.8) for (let x = L0 + 0.4; x < R0; x += 0.8) { const t = box(tile, 0.74, 0.74, 0.04, x, top + y, back + 0.02, scene, 0.01); t.castShadow = false; }
      box(grout, 0.4, H, -back, L0 - 0.2, top + H / 2, back / 2, scene, 0.02);
    }
    const steel = std({ color: C("#c9cdd2"), roughness: 0.3, metalness: 0.7 });
    cyl(steel, 0.22, H, R0 - 0.3, top + H / 2, -0.8, scene, "y", 16);
    box(std({ color: C("#f2f4f6"), roughness: 0.5 }), R0 - L0 + 0.6, 0.5, -back + 0.6, (L0 + R0) / 2, top + H + 0.25, back / 2 - 0.1, scene, 0.04);
    if (ctx.gltf) { const trim = std({ color: C("#1d5fb0"), roughness: 0.4 }); box(trim, R0 - L0 + 0.7, 0.14, 0.2, (L0 + R0) / 2, top + H + 0.56, 0.22, scene, 0.03); box(trim, R0 - L0 + 0.7, 0.14, 0.2, (L0 + R0) / 2, top + H - 0.05, 0.22, scene, 0.03); }
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(R0 - L0 - 1, 0.9), new THREE.MeshStandardMaterial({ map: sign(THREE, opts.sign ?? "CAR WASH", "#1d5fb0", "#ffffff", R0 - L0 - 1, 0.9), emissive: new THREE.Color("#cfe4ff"), emissiveIntensity: 0.3, roughness: 0.5 }));
    sg.position.set((L0 + R0) / 2, top + H + 0.25, 0.22); scene.add(sg);
    // a coin box and a hose reel on the side wall
    box(std({ color: C("#f0c419"), roughness: 0.5 }), 0.7, 1.1, 0.4, L0 + 0.25, top + 1.6, -2.5, scene, 0.05);
    const reel = cyl(std({ color: C("#2d3236"), roughness: 0.6 }), 0.45, 0.25, L0 + 0.3, top + 3.0, -4, scene, "x", 20); reel.castShadow = false;
  } else if (opts.type === "park") {
    const path = PBR("grass_path_2", 0.5, { color: C("#e8dcc4") });
    slabAround(ctx, path, [opts.pathX0 ?? -2.2, opts.pathX1 ?? 2.2, -30, 0], -0.02, 0.04, hole);
    lamp(opts.lampX ?? 4.2, -3.5);
    bench(opts.benchX ?? -4.2, -5, 0.15);
  }
}
