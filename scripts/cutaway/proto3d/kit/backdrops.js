// Kit: settings other than the yard (the R1 world's lawn and house stay the default). A backdrop is built once,
// before the topic's parts, and uses no random numbers (so it never changes the parts' stones, bags or leaves).
//  street: a sidewalk over the lawn (with a hole where the world's cut is), shop fronts behind it with lit windows,
//    an awning and a sign, a street lamp and a bench.
//  park: a gravel path, a bench and a lamp on the lawn (the trees come from world.trees).
//  garage: a driveway up to a garage with its door half open (lit inside), the side of the house beside it.
//  room: a room in section (floor over the cut ground, back wall with a window, side wall, ceiling, roof slice).
//  carwash: a car wash bay (wet floor over the cut drain, tiled back wall, canopy on a column, lit sign).

function sign(THREE, text, bg, fg) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 192; const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 192); g.fillStyle = fg; g.font = "900 110px 'Arial Black', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 512, 100, 960);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

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

/** a far row of taller buildings with lit windows (z: their front), so no empty field shows behind a setting */
function farRow(ctx, zFront) {
  const { box, scene, std, C } = ctx;
    const far = [["#9fb7c9", 13], ["#d9a86c", 17], ["#8fa889", 11], ["#c27b6b", 15], ["#a99bc4", 19], ["#d8c39a", 12], ["#86a4b8", 16]];
    far.forEach(([col, h], i) => { const w = 11, x = -36 + i * 12, z = zFront; const wall = std({ color: C(col), roughness: 0.8 }); box(wall, w, h, 9, x, h / 2, z, scene, 0.05);
      const win = std({ color: C("#cfe2ef"), emissive: C("#e8f1f7"), emissiveIntensity: 0.2, roughness: 0.2 });
      for (let y = 2.2; y < h - 1; y += 2.4) for (let k = -3.6; k <= 3.6; k += 2.4) { const m = box(win, 1.2, 1.4, 0.1, x + k, y, z + 4.52, scene, 0.02); m.castShadow = false; } });
}

export function backdrop(ctx, opts) {
  const { THREE, scene, box, cyl, std, PBR, C, cut } = ctx;
  const hole = cut ? [cut.x0, cut.x1, cut.z0, 0] : null;
  // an indoor floor laps 6 cm over the cut edge, so the lawn turf of the cut rim never shows under it
  const lip = cut ? [cut.x0 + 0.06, cut.x1 - 0.06, cut.z0 + 0.06, 0.05] : null;
  const lamp = (x, z) => { const pole = std({ color: C("#2d3236"), roughness: 0.5, metalness: 0.6 }); cyl(pole, 0.09, 5.2, x, 2.6, z, scene, "y", 12); box(pole, 0.9, 0.12, 0.12, x + 0.4, 5.15, z, scene, 0.03); const head = box(std({ color: C("#fff6dc"), emissive: C("#ffe9b0"), emissiveIntensity: 0.6, roughness: 0.3 }), 0.5, 0.18, 0.32, x + 0.8, 5.0, z, scene, 0.05); head.castShadow = false; };
  const bench = (x, z, rot = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); const wood = std({ color: C("#a8743f"), roughness: 0.7 }), iron = std({ color: C("#2d3236"), roughness: 0.5, metalness: 0.5 }); box(wood, 2.2, 0.08, 0.6, 0, 0.62, 0, g, 0.02); box(wood, 2.2, 0.5, 0.06, 0, 1.0, -0.28, g, 0.02); for (const sx of [-0.95, 0.95]) box(iron, 0.08, 0.62, 0.55, sx, 0.31, 0, g, 0.02); };
  if (opts.type === "street") {
    const walk = PBR("beige_wall_001", 0.35, { color: C("#d9d6d0") });
    const top = opts.walkTop ?? 0.12, back = opts.back ?? -8;
    slabAround(ctx, walk, [-26, 26, back, 0], -0.02, top, hole);
    // paving joints: thin dark lines every 1.5 m along x (cheap, no texture)
    const joint = std({ color: C("#a9a49b"), roughness: 0.9 });
    for (let x = -24; x <= 24; x += 1.5) { if (hole && x > hole[0] - 0.1 && x < hole[1] + 0.1) continue; const j = box(joint, 0.04, 0.005, -back, x, top + 0.003, back / 2, scene, 0.001); j.castShadow = false; }
    // the shop fronts: three buildings side by side, the middle one is the shop
    const shops = opts.shops ?? [{ x: -11, w: 9.6, h: 8, color: "#7fa7c9" }, { x: 0, w: 12, h: 7.4, color: "#e9c46a", shop: true }, { x: 11.5, w: 10.5, h: 9, color: "#c0584a" }];
    for (const s of shops) {
      const z = back - 0.4, g = new THREE.Group(); g.position.set(s.x, top, z); scene.add(g);
      const wall = PBR("painted_plaster_wall", 0.25, { color: C(s.color) });
      box(wall, s.w, s.h, 0.8, 0, s.h / 2, 0, g, 0.04);
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
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(s.w - 2.5, 0.9), new THREE.MeshStandardMaterial({ map: sign(THREE, opts.sign ?? "CORNER STORE", "#2d3236", "#ffd34d"), emissive: new THREE.Color("#ffe9a8"), emissiveIntensity: 0.25, roughness: 0.5 }));
        sg.position.set(0, 4.55, 0.43); g.add(sg);
      }
    }
    // behind the shops: the street and a far row of taller buildings, so no empty field shows from above
    const asphalt = PBR("asphalt_02", 6, { color: C("#9a9a9a") });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), asphalt); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, back - 8.5); road.receiveShadow = true; scene.add(road);
    farRow(ctx, back - 22);
    lamp(opts.lampX ?? 6.5, -1.0);
    if (opts.bench !== false) bench(opts.benchX ?? -6.5, back + 1.4);
  } else if (opts.type === "garage") {
    // a concrete driveway up to a garage with its door half open (the lit inside: shelves, a workbench), the side of
    // the house beside it
    const conc = PBR("beige_wall_001", 0.35, { color: C("#c9c6c0") }), top = 0.08, back = opts.back ?? -9;
    slabAround(ctx, conc, [-7, 7, back, 0.04], -0.2, top, lip);
    farRow(ctx, back - 24);
    const g = new THREE.Group(); g.position.set(opts.x ?? 0, top, back - 3.5); scene.add(g);
    const wall = PBR("painted_plaster_wall", 0.25, { color: C(opts.color ?? "#e8dcc4") }), trim = std({ color: C("#f4f1ea"), roughness: 0.6 });
    const W = 9, H = 4.4, Dd = 7;
    box(wall, 0.4, H, Dd, -W / 2, H / 2, 0, g, 0.03); box(wall, 0.4, H, Dd, W / 2, H / 2, 0, g, 0.03); box(wall, W, H, 0.4, 0, H / 2, -Dd / 2, g, 0.03);
    box(wall, W, 1.3, 0.4, 0, H - 0.65, Dd / 2, g, 0.03); // over the door
    const roof = std({ color: C("#7a4a3a"), roughness: 0.8 }); box(roof, W + 0.8, 0.35, Dd + 0.8, 0, H + 0.17, 0, g, 0.04);
    box(trim, W + 0.9, 0.18, 0.2, 0, H - 0.05, Dd / 2 + 0.25, g, 0.02);
    const inside = std({ color: C("#4a4f55"), emissive: C("#fff1d0"), emissiveIntensity: 0.08, roughness: 0.9 });
    box(inside, W - 0.8, H - 0.4, 0.05, 0, H / 2, -Dd / 2 + 0.23, g, 0.01);
    // the roll-up door, half open: horizontal slats in the top half of the opening
    const slat = std({ color: C("#f0eee8"), roughness: 0.5 });
    for (let i = 0; i < 4; i++) box(slat, W - 0.9, 0.36, 0.08, 0, H - 1.5 - i * 0.38, Dd / 2 - 0.05, g, 0.02);
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
    for (const [x, y] of [[-2.5, 2], [2.5, 2], [-2.5, 5], [2.5, 5]]) { box(frame, 1.6, 1.6, 0.1, hx + x, top + y, back, scene, 0.02); box(glass, 1.4, 1.4, 0.1, hx + x, top + y, back + 0.04, scene, 0.01); }
    if (opts.lamp !== false) lamp(opts.lampX ?? 6.2, -1.2);
  } else if (opts.type === "room") {
    // a room in section (the creator's air-conditioner world): a wood floor over the cut ground, a back wall with a
    // window, the left wall, the ceiling and a slice of the roof on top; an armchair, a lamp and a rug
    const top = 0.12, back = opts.back ?? -7, L0 = opts.x0 ?? -9, R0 = opts.x1 ?? 9, H = opts.h ?? 4.2;
    const floor = std({ color: C("#b98a5a"), roughness: 0.6 });
    slabAround(ctx, floor, [L0, R0, back, 0.04], -0.2, top, lip); // a floor in section: it covers the turf band at the face
    const plank = std({ color: C("#9c6f44"), roughness: 0.7 });
    for (let x = L0 + 0.6; x < R0; x += 0.6) { if (hole && x > hole[0] - 0.05 && x < hole[1] + 0.05) continue; const j = box(plank, 0.03, 0.004, -back, x, top + 0.002, back / 2, scene, 0.001); j.castShadow = false; }
    const wall = PBR("painted_plaster_wall", 0.25, { color: C(opts.color ?? "#e9e1cf") }), cutFace = std({ color: C("#f4f1ea"), roughness: 0.8 });
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
  } else if (opts.type === "carwash") {
    // a car wash bay: a wet concrete floor (its drain is the world's cut), a tiled back wall, a side wall, a canopy
    // on a column with the lit sign on its front edge
    const top = 0.1, back = opts.back ?? -8, L0 = opts.x0 ?? -7, R0 = opts.x1 ?? 7, H = opts.h ?? 5.2;
    slabAround(ctx, std({ color: C("#8f9499"), roughness: 0.35, metalness: 0.05 }), [L0 - 6, R0 + 6, back, 0.04], -0.2, top, lip);
    farRow(ctx, back - 14);
    const tile = std({ color: C(opts.color ?? "#3d7cc9"), roughness: 0.3 }), grout = std({ color: C("#e8eef4"), roughness: 0.6 });
    box(grout, R0 - L0, H, 0.3, (L0 + R0) / 2, top + H / 2, back - 0.15, scene, 0.02);
    for (let y = 0.4; y < H; y += 0.8) for (let x = L0 + 0.4; x < R0; x += 0.8) { const t = box(tile, 0.74, 0.74, 0.04, x, top + y, back + 0.02, scene, 0.01); t.castShadow = false; }
    box(grout, 0.4, H, -back, L0 - 0.2, top + H / 2, back / 2, scene, 0.02);
    const steel = std({ color: C("#c9cdd2"), roughness: 0.3, metalness: 0.7 });
    cyl(steel, 0.22, H, R0 - 0.3, top + H / 2, -0.8, scene, "y", 16);
    box(std({ color: C("#f2f4f6"), roughness: 0.5 }), R0 - L0 + 0.6, 0.5, -back + 0.6, (L0 + R0) / 2, top + H + 0.25, back / 2 - 0.1, scene, 0.04);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(R0 - L0 - 1, 0.9), new THREE.MeshStandardMaterial({ map: sign(THREE, opts.sign ?? "CAR WASH", "#1d5fb0", "#ffffff"), emissive: new THREE.Color("#cfe4ff"), emissiveIntensity: 0.3, roughness: 0.5 }));
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
