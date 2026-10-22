// Kit: settings other than the yard (the R1 world's lawn and house stay the default). A backdrop is built once,
// before the topic's parts, and uses no random numbers (so it never changes the parts' stones, bags or leaves).
//  street: a sidewalk over the lawn (with a hole where the world's cut is), shop fronts behind it with lit windows,
//    an awning and a sign, a street lamp and a bench.
//  park: a gravel path, a bench and a lamp on the lawn (the trees come from world.trees).

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

export function backdrop(ctx, opts) {
  const { THREE, scene, box, cyl, std, PBR, C, cut } = ctx;
  const hole = cut ? [cut.x0, cut.x1, cut.z0, 0] : null;
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
    const far = [["#9fb7c9", 13], ["#d9a86c", 17], ["#8fa889", 11], ["#c27b6b", 15], ["#a99bc4", 19], ["#d8c39a", 12], ["#86a4b8", 16]];
    far.forEach(([col, h], i) => { const w = 11, x = -36 + i * 12, z = back - 22; const wall = std({ color: C(col), roughness: 0.8 }); box(wall, w, h, 9, x, h / 2, z, scene, 0.05);
      const win = std({ color: C("#cfe2ef"), emissive: C("#e8f1f7"), emissiveIntensity: 0.2, roughness: 0.2 });
      for (let y = 2.2; y < h - 1; y += 2.4) for (let k = -3.6; k <= 3.6; k += 2.4) { const m = box(win, 1.2, 1.4, 0.1, x + k, y, z + 4.52, scene, 0.02); m.castShadow = false; } });
    lamp(opts.lampX ?? 6.5, -1.0);
    if (opts.bench !== false) bench(opts.benchX ?? -6.5, back + 1.4);
  } else if (opts.type === "park") {
    const path = PBR("grass_path_2", 0.5, { color: C("#e8dcc4") });
    slabAround(ctx, path, [opts.pathX0 ?? -2.2, opts.pathX1 ?? 2.2, -30, 0], -0.02, 0.04, hole);
    lamp(opts.lampX ?? 4.2, -3.5);
    bench(opts.benchX ?? -4.2, -5, 0.15);
  }
}
