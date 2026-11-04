// Set "bedroom": a kid's bedroom on the ground floor. Laminate floor, pastel plaster walls with white baseboards, a
// ceiling, a big window in the back wall onto the back yard (fence, trees, the town's tree line and mountains: the
// "far" spot is out there, where a monster can stand in the moonlight and look in), curtains, a bed with a plaid
// blanket and a teddy, a nightstand with the bedside lamp (the warm practical at night), a desk with a chair and a
// laptop, a bookcase full of books, a round rug, original posters, a closet and the room door (left ajar).
// The camera stands toward the front of the room (+z) looking at the window wall; it stays inside the room.
import { makeKit, mergeStatic, glowList, lcg } from "./util.js";
import { backdrop } from "./backdrop.js";

const X0 = -3.2, X1 = 3.2, ZB = -3.0, ZF = 5.2, HT = 2.8; // room box
const WIN = { x0: -1.65, x1: 0.45, y0: 0.8, y1: 2.35 };

export async function build(ctx) {
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = "set:bedroom";
  const K = makeKit(ctx, root), { bx, rbx, plane, mesh, pbr, solid, fabric, cyl } = K;
  const glow = glowList(), onLight = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- the room ----------
  const W = X1 - X0, D = ZF - ZB;
  plane(W, D, pbr("laminate_floor_02", { repeat: [W / 2.2, D / 2.2], tint: "#f4e2c8" }), { y: 0, z: (ZB + ZF) / 2 });
  const wall = pbr("painted_plaster_wall", { repeat: [3, 1.4], tint: "#bfe0ff" }), wall2 = pbr("painted_plaster_wall", { repeat: [3, 1.4], tint: "#ffe9b8" });
  const T = 0.2;
  // back wall around the window opening
  bx(WIN.x0 - X0, HT, T, wall, { x: (X0 + WIN.x0) / 2, y: HT / 2, z: ZB - T / 2, block: true });
  bx(X1 - WIN.x1, HT, T, wall, { x: (WIN.x1 + X1) / 2, y: HT / 2, z: ZB - T / 2, block: true });
  bx(WIN.x1 - WIN.x0, WIN.y0, T, wall, { x: (WIN.x0 + WIN.x1) / 2, y: WIN.y0 / 2, z: ZB - T / 2, block: true });
  bx(WIN.x1 - WIN.x0, HT - WIN.y1, T, wall, { x: (WIN.x0 + WIN.x1) / 2, y: (HT + WIN.y1) / 2, z: ZB - T / 2, block: true });
  // side walls (yellow accent on the right), the front wall behind the camera, the ceiling
  bx(T, HT, D, wall, { x: X0 - T / 2, y: HT / 2, z: (ZB + ZF) / 2, block: true });
  // right wall: with the room door opening at z 2.05..3.05
  const DZ0 = 2.05, DZ1 = 3.05, DH = 2.15;
  bx(T, HT, DZ0 - ZB, wall2, { x: X1 + T / 2, y: HT / 2, z: (ZB + DZ0) / 2, block: true });
  bx(T, HT, ZF - DZ1, wall2, { x: X1 + T / 2, y: HT / 2, z: (DZ1 + ZF) / 2, block: true });
  bx(T, HT - DH, DZ1 - DZ0, wall2, { x: X1 + T / 2, y: (HT + DH) / 2, z: (DZ0 + DZ1) / 2, block: true });
  bx(W + 2 * T, HT, T, wall, { y: HT / 2, z: ZF + T / 2, block: true });
  bx(W + 2 * T, 0.1, D + 2 * T, solid("#f7f4ee", { roughness: 0.9 }), { y: HT + 0.05, z: (ZB + ZF) / 2, cast: true });
  // the dark hallway behind the door
  bx(3, HT, 1.6, solid("#2a2c38", { roughness: 1 }), { x: X1 + 1.7, y: HT / 2, z: (DZ0 + DZ1) / 2 + 0.2, shadow: false });
  const white = solid("#fbfaf5", { roughness: 0.5 });
  // baseboards and crown
  bx(W, 0.12, 0.03, white, { y: 0.06, z: ZB + 0.015 }); bx(W, 0.12, 0.03, white, { y: 0.06, z: ZF - 0.015 });
  bx(0.03, 0.12, D, white, { x: X0 + 0.015, y: 0.06, z: (ZB + ZF) / 2 });
  bx(0.03, 0.12, DZ0 - ZB, white, { x: X1 - 0.015, y: 0.06, z: (ZB + DZ0) / 2 }); bx(0.03, 0.12, ZF - DZ1, white, { x: X1 - 0.015, y: 0.06, z: (DZ1 + ZF) / 2 });

  // ---------- the window: frame, muntins, sill, curtains ----------
  const wx = (WIN.x0 + WIN.x1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0, wy = (WIN.y0 + WIN.y1) / 2;
  for (const s of [-1, 1]) bx(0.1, wh + 0.1, 0.24, white, { x: wx + s * (ww / 2 - 0.05), y: wy, z: ZB - 0.1 });
  for (const yy of [WIN.y0, WIN.y1]) bx(ww, 0.1, 0.24, white, { x: wx, y: yy, z: ZB - 0.1 });
  bx(0.06, wh, 0.06, white, { x: wx, y: wy, z: ZB - 0.12 }); bx(ww, 0.06, 0.06, white, { x: wx, y: wy + 0.1, z: ZB - 0.12 });
  bx(ww + 0.3, 0.05, 0.3, white, { x: wx, y: WIN.y0 - 0.02, z: ZB + 0.08 });
  const curtain = fabric("#3d6fd6", "dots", [2, 3]);
  for (const s of [-1, 1]) rbx(0.45, wh + 0.5, 0.08, 0.03, curtain, { x: wx + s * (ww / 2 + 0.2), y: wy + 0.15, z: ZB + 0.08 });
  cyl(0.02, 0.02, ww + 1.2, 8, solid("#c9a45a", { metalness: 0.6, roughness: 0.4 }), { x: wx, y: WIN.y1 + 0.35, z: ZB + 0.08, rz: Math.PI / 2 });

  // ---------- the bed (left wall), the nightstand + bedside lamp ----------
  const wood = solid("#b07a4a", { roughness: 0.55 }), woodDark = solid("#7d5232", { roughness: 0.6 });
  const bedX = X0 + 0.6, bedZ0 = ZB + 0.1, bedL = 2.05;
  bx(1.1, 0.32, bedL, wood, { x: bedX, y: 0.22, z: bedZ0 + bedL / 2 });
  bx(1.16, 1.05, 0.08, woodDark, { x: bedX, y: 0.53, z: bedZ0 + 0.04 });
  bx(1.16, 0.6, 0.08, woodDark, { x: bedX, y: 0.3, z: bedZ0 + bedL });
  rbx(1.0, 0.2, 1.95, 0.05, solid("#ffffff", { roughness: 0.8 }), { x: bedX, y: 0.48, z: bedZ0 + bedL / 2 + 0.02 });
  rbx(1.08, 0.12, 1.35, 0.05, fabric("#2f7fd8", "plaid", [2, 2]), { x: bedX, y: 0.6, z: bedZ0 + 1.33 });
  rbx(1.1, 0.4, 0.06, 0.02, fabric("#2f7fd8", "plaid", [2, 1]), { x: bedX, y: 0.45, z: bedZ0 + bedL - 0.03 });
  rbx(0.7, 0.14, 0.36, 0.06, fabric("#fff6e0", "cotton"), { x: bedX, y: 0.64, z: bedZ0 + 0.32, rx: -0.25 });
  const nsX = WIN.x0 - 0.25, nsZ = ZB + 0.3;
  bx(0.5, 0.55, 0.42, wood, { x: nsX - 0.1, y: 0.275, z: nsZ });
  bx(0.44, 0.04, 0.02, woodDark, { x: nsX - 0.1, y: 0.4, z: nsZ + 0.215 });
  cyl(0.08, 0.1, 0.06, 16, solid("#e9e2d6"), { x: nsX - 0.1, y: 0.58, z: nsZ });
  cyl(0.02, 0.02, 0.28, 8, solid("#c9a45a", { metalness: 0.6, roughness: 0.4 }), { x: nsX - 0.1, y: 0.72, z: nsZ });
  const shade = glow.add(new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffb85c", roughness: 0.7, side: THREE.DoubleSide }), { day: 0, night: 2.4, warm: 0.6 });
  cyl(0.12, 0.19, 0.22, 20, shade, { x: nsX - 0.1, y: 0.92, z: nsZ, shadow: false });
  const LAMP = V(nsX - 0.1, 0.92, nsZ + 0.05);

  // ---------- the desk (right wall), the chair, laptop, desk lamp ----------
  const dkX = X1 - 0.38, dkZ = ZB + 0.85;
  bx(0.7, 0.05, 1.3, solid("#f2f0ea", { roughness: 0.45 }), { x: dkX, y: 0.74, z: dkZ });
  for (const sz of [-1, 1]) bx(0.64, 0.72, 0.04, solid("#f2f0ea", { roughness: 0.45 }), { x: dkX, y: 0.36, z: dkZ + sz * 0.62 });
  bx(0.6, 0.25, 0.4, solid("#ff8a3d", { roughness: 0.5 }), { x: dkX, y: 0.55, z: dkZ + 0.38 });
  // the shelf above the desk with books, a globe
  bx(0.3, 0.04, 1.2, wood, { x: X1 - 0.16, y: 1.55, z: dkZ });

  // ---------- the bookcase (back wall, right of the window) with books ----------
  const bcX = WIN.x1 + 0.9, bcW = 1.1, bcH = 1.85, bcD = 0.34;
  const bcMat = solid("#ffffff", { roughness: 0.5 });
  for (const s of [-1, 1]) bx(0.04, bcH, bcD, bcMat, { x: bcX + s * bcW / 2, y: bcH / 2, z: ZB + bcD / 2 });
  bx(bcW, bcH, 0.02, solid("#9fd0ff", { roughness: 0.7 }), { x: bcX, y: bcH / 2, z: ZB + 0.01 });
  const shelvesY = [0.04, 0.48, 0.92, 1.36, 1.83];
  for (const y of shelvesY) bx(bcW, 0.04, bcD, bcMat, { x: bcX, y, z: ZB + bcD / 2 });
  const BOOK = ["#e74c3c", "#2e86de", "#ffd32a", "#20bf6b", "#8854d0", "#fd9644", "#eb3b5a", "#0fb9b1"];
  const rnd = lcg(42);
  const bookRow = (x0, x1, y, z, maxH = 0.36) => {
    let x = x0 + 0.02;
    while (x < x1 - 0.05) {
      const w = 0.035 + rnd() * 0.04, h = maxH * (0.62 + rnd() * 0.36), lean = rnd() < 0.08 ? 0.25 : 0;
      if (x + w > x1) break;
      bx(w, h, 0.22, solid(BOOK[Math.floor(rnd() * BOOK.length)], { roughness: 0.55 }), { x: x + w / 2, y: y + 0.02 + h / 2, z, rz: lean });
      x += w + 0.004 + (rnd() < 0.1 ? 0.1 : 0);
    }
  };
  for (const y of shelvesY.slice(0, 4)) bookRow(bcX - bcW / 2 + 0.03, bcX + bcW / 2 - 0.03, y, ZB + 0.16);
  bookRow(X1 - 0.3, X1 - 0.02, 1.57, dkZ, 0.28); // (narrow: just a few)
  { // books along the wall shelf: rotated row
    let z = dkZ - 0.55; while (z < dkZ + 0.5) { const w = 0.035 + rnd() * 0.04, h = 0.2 + rnd() * 0.1; bx(0.2, h, w, solid(BOOK[Math.floor(rnd() * BOOK.length)], { roughness: 0.55 }), { x: X1 - 0.16, y: 1.57 + h / 2, z: z + w / 2 }); z += w + 0.005; }
  }
  // a ball and a toy box
  mesh(new THREE.SphereGeometry(0.14, 20, 14), solid("#ff4757", { roughness: 0.4 }), { x: 1.7, y: 0.14, z: -0.9 });
  rbx(0.7, 0.42, 0.45, 0.03, solid("#20bf6b", { roughness: 0.5 }), { x: X0 + 0.45, y: 0.21, z: 0.9 });
  rbx(0.72, 0.05, 0.47, 0.02, solid("#ffd32a", { roughness: 0.5 }), { x: X0 + 0.45, y: 0.44, z: 0.9 });

  // ---------- the rug, posters, the closet, the door ----------
  const rugT = K.canvas(512, 512, (p) => { const cs = ["#ff7aa2", "#ffd36b", "#7fd3ff", "#b98cff", "#ffffff"]; for (let i = 0; i < 6; i++) { p.fillStyle = cs[i % cs.length]; p.beginPath(); p.arc(256, 256, 256 - i * 42, 0, Math.PI * 2); p.fill(); } });
  mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.015, 48), new THREE.MeshStandardMaterial({ map: rugT, roughness: 1 }), { x: 0, y: 0.008, z: 0.2, keep: true });
  const poster = (draw, w, h, o) => { const t = K.canvas(256, Math.round(256 * h / w), draw); bx(w + 0.06, h + 0.06, 0.02, solid("#ffffff"), { ...o }); mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), { ...o, ...(o.ry ? { x: o.x + Math.sin(o.ry) * 0.012, z: o.z + Math.cos(o.ry) * 0.012 } : { z: o.z + 0.012 }), keep: true, shadow: false }); };
  poster((p, w, h) => { // rocket
    const g = p.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#1b1f5e"); g.addColorStop(1, "#6a3fb5"); p.fillStyle = g; p.fillRect(0, 0, w, h);
    p.fillStyle = "#fff"; for (let i = 0; i < 40; i++) p.fillRect((i * 97) % w, (i * 53) % (h * 0.7), 3, 3);
    p.fillStyle = "#f1f2f6"; p.beginPath(); p.ellipse(128, 170, 36, 90, 0, 0, Math.PI * 2); p.fill(); p.fillStyle = "#ff4757"; p.beginPath(); p.moveTo(92, 200); p.lineTo(70, 270); p.lineTo(100, 250); p.fill(); p.beginPath(); p.moveTo(164, 200); p.lineTo(186, 270); p.lineTo(156, 250); p.fill();
    p.fillStyle = "#4bcffa"; p.beginPath(); p.arc(128, 150, 16, 0, Math.PI * 2); p.fill(); p.fillStyle = "#ffa502"; p.beginPath(); p.moveTo(108, 255); p.lineTo(148, 255); p.lineTo(128, 320); p.fill();
    p.fillStyle = "#ffd32a"; p.font = "bold 44px sans-serif"; p.textAlign = "center"; p.fillText("BLAST OFF", 128, h - 24);
  }, 0.6, 0.85, { x: X0 + 0.02, y: 1.75, z: -1.2, ry: Math.PI / 2 });
  poster((p, w, h) => { // dino
    p.fillStyle = "#7bed9f"; p.fillRect(0, 0, w, h); p.fillStyle = "#2f8f5b"; p.beginPath(); p.ellipse(130, 200, 70, 46, 0, 0, Math.PI * 2); p.fill(); p.fillRect(170, 110, 30, 100); p.beginPath(); p.ellipse(198, 104, 30, 20, 0, 0, Math.PI * 2); p.fill(); p.beginPath(); p.moveTo(64, 200); p.lineTo(10, 230); p.lineTo(70, 220); p.fill();
    for (const lx of [90, 120, 150, 170]) p.fillRect(lx, 230, 16, 40); p.fillStyle = "#fff"; p.beginPath(); p.arc(206, 100, 5, 0, Math.PI * 2); p.fill();
    p.fillStyle = "#1e3799"; p.font = "bold 40px sans-serif"; p.textAlign = "center"; p.fillText("DINO CLUB", 128, 52);
  }, 0.62, 0.62, { x: X1 - 0.02, y: 1.95, z: -0.2, ry: -Math.PI / 2 });
  poster((p, w, h) => { p.fillStyle = "#ffd32a"; p.fillRect(0, 0, w, h); p.fillStyle = "#e84118"; p.font = "bold 70px sans-serif"; p.textAlign = "center"; p.fillText("★", 128, 120); p.font = "bold 40px sans-serif"; p.fillText("SUPER", 128, 190); p.fillText("STAR", 128, 236); }, 0.45, 0.5, { x: 0.95, y: 2.2, z: ZB + 0.01 });
  // the closet: white bifold doors on the right wall
  const clZ = 0.0, clW = 1.5;
  bx(0.06, 2.2, clW + 0.14, white, { x: X1 - 0.02, y: 1.1, z: clZ });
  for (const s of [-1, 1]) { bx(0.05, 2.08, clW / 2 - 0.03, solid("#fffdf7", { roughness: 0.45 }), { x: X1 - 0.06, y: 1.08, z: clZ + s * clW / 4 }); for (let k = 0; k < 7; k++) bx(0.02, 0.03, clW / 2 - 0.1, solid("#e5e1d6"), { x: X1 - 0.09, y: 0.7 + k * 0.18, z: clZ + s * clW / 4 }); cyl(0.015, 0.015, 0.12, 8, solid("#c9a45a", { metalness: 0.7, roughness: 0.3 }), { x: X1 - 0.1, y: 1.05, z: clZ + s * 0.06 }); }
  // the room door, ajar (a dark gap to the hall)
  for (const zz of [DZ0, DZ1]) bx(0.24, DH, 0.08, white, { x: X1 + 0.02, y: DH / 2, z: zz });
  bx(0.24, 0.1, DZ1 - DZ0 + 0.16, white, { x: X1 + 0.02, y: DH + 0.05, z: (DZ0 + DZ1) / 2 });
  { const g = new THREE.Group(); g.position.set(X1 - 0.02, 0, DZ1 - 0.02); g.rotation.y = -0.55; root.add(g);
    bx(0.05, DH - 0.04, DZ1 - DZ0 - 0.06, solid("#ffffff", { roughness: 0.45 }), { x: 0, y: (DH - 0.04) / 2, z: -(DZ1 - DZ0 - 0.06) / 2, parent: g });
    mesh(new THREE.SphereGeometry(0.035, 10, 8), solid("#c9a45a", { metalness: 0.7, roughness: 0.3 }), { x: -0.06, y: 1.0, z: -(DZ1 - DZ0) + 0.14, parent: g }); }

  // ---------- Kenney furniture: chair, laptop, bear, plant, ceiling lamp ----------
  const [chair, laptop, bear, plant, ceilLamp] = await Promise.all([
    K.model("/assets/kenney/furniture/chairDesk.glb", { height: 0.95 }),
    K.model("/assets/kenney/furniture/laptop.glb", { length: 0.36 }),
    K.model("/assets/kenney/furniture/bear.glb", { height: 0.34 }),
    K.model("/assets/kenney/furniture/plantSmall2.glb", { height: 0.42 }),
    null,
  ]);
  K.place(chair, dkX - 0.65, 0, dkZ - 0.1, -Math.PI / 2 - 0.3);
  K.place(laptop, dkX - 0.05, 0.765, dkZ - 0.2, -Math.PI / 2);
  K.place(bear, bedX + 0.15, 0.58, bedZ0 + 0.55, 0.3);
  K.place(plant, WIN.x1 - 0.25, WIN.y0 + 0.01, ZB + 0.1, 0);
  void ceilLamp;
  const ceilGlow = glow.add(new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: "#fff2cc" }), { day: 0.6, night: 0, warm: 0.2 });
  cyl(0.22, 0.22, 0.04, 20, ceilGlow, { x: 0, y: HT - 0.05, z: 0.4, shadow: false });

  // ---------- outside the window: the back yard ----------
  const yard = new THREE.Group(); root.add(yard);
  K.plane(60, 50, pbr("leafy_grass", { repeat: [20, 16], tint: "#9fe06a", normal: 0.6 }), { y: 0, z: ZB - 25.3 });
  const fence = solid("#f4f1ea", { roughness: 0.7 });
  for (let x = -14; x <= 14; x += 0.32) bx(0.09, 1.25, 0.04, fence, { x, y: 0.62, z: -15 });
  for (const fy of [0.35, 1.0]) bx(28.2, 0.07, 0.05, fence, { y: fy, z: -15.04 });
  backdrop(K, (f) => onLight.push(f), { treeLine: { x0: -90, x1: 90, z0: -40, z1: -70, n: 140 } });
  const [kTree, kTreeS] = await Promise.all([K.model("/assets/kenney/suburban/tree-large.glb", { height: 7.5 }), K.model("/assets/kenney/suburban/tree-small.glb", { height: 4.5 })]);
  K.instance(kTree, [{ x: -7.5, z: -13, ry: 1, s: 1 }, { x: 6.5, z: -18, ry: 2.2, s: 1.1 }, { x: -2.5, z: -26, ry: 0.4, s: 0.95 }], { shadow: false });
  K.instance(kTreeS, [{ x: 3.2, z: -12.5, ry: 1.3 }, { x: -11, z: -17, ry: 0.2 }], { shadow: false });
  // the neighbour's house across the yard (a lit window at night)
  {
    const hw = 9, hd = 6, hh = 5.2, hz = -32, hx = 9;
    bx(hw, hh, hd, pbr("painted_plaster_wall", { repeat: [3, 1.7], tint: "#ffd9cc" }), { x: hx, y: hh / 2, z: hz });
    const rh = 2.2, half = hd / 2 + 0.4, slope = Math.hypot(half, rh), ang = Math.atan2(rh, half), roofM = pbr("grey_roof_01", { repeat: [3, 1] });
    for (const s of [-1, 1]) bx(hw + 0.6, 0.16, slope, roofM, { x: hx, y: hh + rh / 2, z: hz + s * half / 2, rx: s * ang });
    const nWin = glow.add(new THREE.MeshStandardMaterial({ color: "#2a3a4c", emissive: "#ffb257", roughness: 0.2 }), { day: 0, night: 1.6, warm: 0.2 }, { day: "#2a3a4c", night: "#ffd38a", warm: "#2a3a4c" });
    for (const [ox, oy] of [[-2.4, 1.6], [2.4, 1.6], [-2.4, 4.0], [2.4, 4.0]]) { bx(1.3, 1.4, 0.1, solid("#fbfbf6"), { x: hx + ox, y: oy, z: hz + hd / 2 + 0.02 }); bx(1.1, 1.2, 0.1, nWin, { x: hx + ox, y: oy, z: hz + hd / 2 + 0.06, shadow: false }); }
  }

  mergeStatic(THREE, root);

  return {
    root, indoor: true, windowY: 1.55, windowAt: V(WIN.x0 + (WIN.x1 - WIN.x0) * 0.74, 1.55, ZB),
    spots: { center: V(0, 0, 0.4), left: V(-1.15, 0, 0.65), right: V(1.15, 0, 0.65), back: V(0.1, 0, -1.7), far: V(-0.6, 0, -9.5), door: V(2.55, 0, 2.55), closet: V(2.45, 0, 0.0), bed: V(bedX + 0.7, 0, bedZ0 + 1.2) },
    camDir: V(0, 0, 1),
    views: { door: V(-1, 0, 0.25).normalize(), closet: V(-1, 0, 0.45).normalize() },
    bounds: [new THREE.Box3(V(X0 + 0.25, 0.3, ZB + 0.3), V(X1 - 0.25, HT - 0.25, ZF - 0.25))],
    rig: {
      indoor: true,
      shadow: { center: [-0.4, 0, -3], half: 13, far: 120, map: 2048 },
      sunDir: { day: [7, 13, -16], night: [-6, 11, -18], warm: [12, 5, -22] },
      sunScale: { day: 1.0, night: 1.5, warm: 1.2 },
      envScale: { day: 0.75, night: 0.4, warm: 0.7 },
      hemiScale: { day: 1.3, night: 1.0, warm: 1.0 },
      hemi: { night: ["#3a4f8f", "#0b0a14", 0.4] },
      exposure: { day: 0.9, night: 0.88, warm: 0.92 },
      moonAt: [-0.2, 0.32, -0.92],
      practicals(mode) {
        const L = [];
        if (mode === "night") {
          const l = new THREE.PointLight("#ffa850", 1.6, 3.6, 2); l.position.copy(LAMP); L.push(l);
        } else {
          const f = new THREE.PointLight(mode === "warm" ? "#ffcf9a" : "#fff6e6", mode === "warm" ? 2 : 3.5, 9, 1.5); f.position.set(0.4, 1.9, 2.6); L.push(f);
        }
        return L;
      },
      onLight(mode) { glow.apply(mode); onLight.forEach((f) => f(mode)); },
    },
  };
}
