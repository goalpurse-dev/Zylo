// Set "school": a school hallway with rows of coloured blocky lockers (instanced), cork notice boards, classroom doors
// with windows and room numbers, a tiled floor, ceiling light panels, a banner; on the right an open classroom door
// (the "door" spot) into a classroom with desks in rows, a green board and windows; at the far end the hallway opens
// into a tall two-storey lobby with a wall of windows (the "far" spot: tall enough for a 4.5 m monster in silhouette).
// The camera stands in the hallway (+z) looking down it (-z).
import { makeKit, mergeStatic, glowList, lcg } from "./util.js";

const HW = 2.2, HZ0 = 8, HZ1 = -16, HH = 3.2;           // hallway half width, z range, height
const AX = 6.5, AZ1 = -27, AH = 8;                      // lobby half width, back z, height
const CX0 = HW, CX1 = 9.4, CZ0 = -8.5, CZ1 = 1.0;        // classroom box (x, z)
const DOOR = { z0: -3.7, z1: -2.3 };                    // open classroom doorway in the right wall

export async function build(ctx) {
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = "set:school";
  const K = makeKit(ctx, root), { bx, rbx, plane, mesh, pbr, solid, cyl } = K;
  const glow = glowList();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const T = 0.2;
  let treeLineMat = null;

  // ---------- shells ----------
  const tiles = pbr("interior_tiles", { repeat: [3, 16], tint: "#f2efe8", rough: 0.6 });
  plane(HW * 2, HZ0 - HZ1, tiles, { y: 0, z: (HZ0 + HZ1) / 2 });
  plane(AX * 2, HZ1 - AZ1, pbr("interior_tiles", { repeat: [9, 7], tint: "#f2efe8", rough: 0.6 }), { y: 0, z: (HZ1 + AZ1) / 2 });
  plane(CX1 - CX0, CZ1 - CZ0, pbr("laminate_floor_02", { repeat: [3, 4], tint: "#e8d2b0" }), { x: (CX0 + CX1) / 2, y: 0, z: (CZ0 + CZ1) / 2 });
  const upper = pbr("painted_plaster_wall", { repeat: [6, 1], tint: "#f3ecd8" }), lowerM = solid("#3f7fc0", { roughness: 0.55 });
  const wallSeg = (x, z0, z1, h = HH) => { // a side wall along z at x, with a blue dado band
    const len = z1 - z0, zc = (z0 + z1) / 2, s = Math.sign(x);
    bx(T, h, len, upper, { x: x + s * T / 2, y: h / 2, z: zc, block: true });
    bx(0.03, 1.1, len, lowerM, { x: x - s * 0.015, y: 0.55, z: zc });
    bx(0.04, 0.06, len, solid("#ffffff"), { x: x - s * 0.02, y: 1.12, z: zc });
  };
  wallSeg(-HW, HZ1, HZ0);
  wallSeg(HW, DOOR.z1, HZ0); wallSeg(HW, HZ1, DOOR.z0);
  bx(T, HH - 2.3, DOOR.z1 - DOOR.z0, upper, { x: HW + T / 2, y: (HH + 2.3) / 2, z: (DOOR.z0 + DOOR.z1) / 2, block: true });
  bx(HW * 2 + 2 * T, HH, T, upper, { y: HH / 2, z: HZ0 + T / 2, block: true });
  const ceilM = solid("#f4f3ef", { roughness: 0.9 });
  bx(HW * 2 + 2 * T, 0.1, HZ0 - HZ1, ceilM, { y: HH + 0.05, z: (HZ0 + HZ1) / 2 });
  // ceiling grid lines
  for (let z = HZ1 + 1.2; z < HZ0; z += 1.2) bx(HW * 2, 0.02, 0.03, solid("#d9d7cf"), { y: HH - 0.01, z, shadow: false });
  // lobby: side walls, the window wall, ceiling, the step walls above the hallway mouth
  for (const s of [-1, 1]) {
    bx(T, AH, HZ1 - AZ1, upper, { x: s * (AX + T / 2), y: AH / 2, z: (HZ1 + AZ1) / 2, block: true });
    bx(AX - HW, AH, T, upper, { x: s * (HW + AX) / 2, y: AH / 2, z: HZ1 + T / 2, block: true });
    bx(0.03, 1.1, HZ1 - AZ1, lowerM, { x: s * (AX - 0.015), y: 0.55, z: (HZ1 + AZ1) / 2 });
  }
  bx(HW * 2, AH - HH, T, upper, { y: (AH + HH) / 2, z: HZ1 + T / 2, block: true });
  bx(AX * 2 + 2 * T, 0.1, HZ1 - AZ1, ceilM, { y: AH + 0.05, z: (HZ1 + AZ1) / 2 });
  { // the window wall: a steel grid with glass, a low sill wall
    const frame = solid("#5b6672", { roughness: 0.45, metalness: 0.4 });
    bx(AX * 2 + 2 * T, 0.9, T, upper, { y: 0.45, z: AZ1 - T / 2, block: true });
    bx(AX * 2 + 2 * T, 0.5, T, upper, { y: AH - 0.25, z: AZ1 - T / 2, block: true });
    for (let x = -AX; x <= AX + 0.01; x += AX / 4) bx(0.14, AH - 1.4, 0.18, frame, { x, y: 0.9 + (AH - 1.4) / 2, z: AZ1 - 0.05 });
    for (const y of [0.9, 3.2, 5.5, AH - 0.5]) bx(AX * 2, 0.12, 0.18, frame, { y, z: AZ1 - 0.05 });
    const pane = new THREE.MeshPhysicalMaterial({ color: "#cfe6ff", roughness: 0.05, transparent: true, opacity: 0.12, metalness: 0 });
    bx(AX * 2, AH - 1.4, 0.02, pane, { y: 0.9 + (AH - 1.4) / 2, z: AZ1 - 0.06, shadow: false, keep: true });
    // outside: a lawn and the tree line so the windows are not empty
    plane(200, 120, pbr("leafy_grass", { repeat: [60, 36], tint: "#9fe06a", normal: 0.6 }), { y: -0.01, z: AZ1 - 60.2, shadow: false });
    const tl = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 9, 7).translate(0, 4.5, 0), new THREE.MeshStandardMaterial({ color: "#3f7a3a", roughness: 1, flatShading: true }), 50);
    const m4 = new THREE.Matrix4(), r = lcg(9); for (let i = 0; i < 50; i++) { const k = 0.8 + r() * 0.9; m4.compose(V(-60 + r() * 120, 0, AZ1 - 30 - r() * 25), new THREE.Quaternion(), V(k, k * (0.8 + r() * 0.6), k)); tl.setMatrixAt(i, m4); }
    tl.computeBoundingSphere(); root.add(tl); treeLineMat = tl.material;
  }
  // classroom shell
  bx(T, HH, CZ1 - CZ0, upper, { x: CX1 + T / 2, y: HH / 2, z: (CZ0 + CZ1) / 2, block: true });
  bx(CX1 - CX0 + 2 * T, HH, T, upper, { x: (CX0 + CX1) / 2, y: HH / 2, z: CZ1 + T / 2, block: true });
  // the classroom's window wall (z = CZ0): sill, glass band, header
  bx(CX1 - CX0, 0.95, T, upper, { x: (CX0 + CX1) / 2, y: 0.475, z: CZ0 - T / 2, block: true });
  bx(CX1 - CX0, 0.6, T, upper, { x: (CX0 + CX1) / 2, y: HH - 0.3, z: CZ0 - T / 2, block: true });
  for (let x = CX0; x <= CX1 + 0.01; x += (CX1 - CX0) / 4) bx(0.12, HH - 1.55, T, solid("#5b6672", { roughness: 0.45, metalness: 0.4 }), { x, y: 0.95 + (HH - 1.55) / 2, z: CZ0 - T / 2 });
  bx(CX1 - CX0 + 2 * T, 0.1, CZ1 - CZ0, ceilM, { x: (CX0 + CX1) / 2, y: HH + 0.05, z: (CZ0 + CZ1) / 2 });

  // ---------- lockers (instanced) ----------
  const LW = 0.42, LH = 1.85, LD = 0.45;
  const lockers = [], COLORS = ["#2e6fd6", "#e04848", "#f2b928", "#2fa866", "#7c4fd0", "#ff7f32"];
  const bank = (side, z0, z1, ci) => { for (let z = z0 + LW / 2; z <= z1 - LW / 2 + 1e-3; z += LW) lockers.push({ x: side * (HW - LD / 2), z, side, color: COLORS[ci % COLORS.length] }); };
  bank(-1, 2.2, 7.4, 0); bank(-1, -4.6, 0.6, 1); bank(-1, -15.6, -7.4, 2);
  bank(1, 3.4, 7.4, 3); bank(1, -1.6, 1.6, 4); bank(1, -9.2, -4.6, 0); bank(1, -15.6, -12.4, 1);
  {
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(LD, LH, LW - 0.02), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, metalness: 0.25 }), lockers.length);
    const vent = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.025, 0.24), new THREE.MeshStandardMaterial({ color: "#1d2128", roughness: 0.6 }), lockers.length * 4);
    const handle = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: "#d9dde3", metalness: 0.9, roughness: 0.25 }), lockers.length);
    const plate = new THREE.InstancedMesh(new THREE.BoxGeometry(0.015, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: "#f4f1e6", roughness: 0.5 }), lockers.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), c = new THREE.Color();
    lockers.forEach((l, i) => {
      const fx = l.x - l.side * (LD / 2 + 0.01);
      body.setMatrixAt(i, m4.compose(V(l.x, 0.12 + LH / 2, l.z), q, one)); body.setColorAt(i, c.set(l.color));
      for (let k = 0; k < 4; k++) vent.setMatrixAt(i * 4 + k, m4.compose(V(fx, 1.66 - k * 0.06, l.z), q, one));
      handle.setMatrixAt(i, m4.compose(V(fx, 1.05, l.z + 0.12), q, one));
      plate.setMatrixAt(i, m4.compose(V(fx, 1.5, l.z), q, one));
    });
    for (const m of [body, vent, handle, plate]) { m.castShadow = m.receiveShadow = true; m.computeBoundingSphere(); root.add(m); }
    // plinths under the banks
    for (const l of lockers) void l;
  }
  // ---------- notice boards, doors, signs, banner ----------
  const rnd = lcg(5);
  const board = (side, z, w = 2.0) => {
    const t = K.canvas(512, 256, (p, cw, ch) => {
      p.fillStyle = "#c79a62"; p.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 900; i++) { p.fillStyle = `rgba(90,55,25,${0.08 + rnd() * 0.12})`; p.fillRect(rnd() * cw, rnd() * ch, 2, 2); }
      const papers = [["#ffffff", "SCIENCE FAIR"], ["#fff3a0", "BAKE SALE"], ["#ffd1dc", "CHOIR"], ["#c8f0ff", "LOST & FOUND"], ["#ffffff", "FIELD TRIP"], ["#d6ffc8", "CHESS CLUB"]];
      papers.forEach(([col, txt], i) => {
        const x = 20 + (i % 3) * 165 + rnd() * 12, y = 18 + Math.floor(i / 3) * 118 + rnd() * 10, a = (rnd() - 0.5) * 0.12;
        p.save(); p.translate(x + 70, y + 50); p.rotate(a); p.fillStyle = col; p.fillRect(-70, -50, 140, 100);
        p.fillStyle = "#333"; p.font = "bold 17px sans-serif"; p.textAlign = "center"; p.fillText(txt, 0, -22); p.fillStyle = "#999"; for (let k = 0; k < 4; k++) p.fillRect(-52, -6 + k * 13, 104 - (k === 3 ? 40 : 0), 4);
        p.fillStyle = ["#e74c3c", "#2e86de", "#20bf6b"][i % 3]; p.beginPath(); p.arc(0, -42, 6, 0, Math.PI * 2); p.fill(); p.restore();
      });
    });
    bx(0.05, 1.12, w + 0.12, solid("#8a5a32", { roughness: 0.6 }), { x: side * (HW - 0.03), y: 1.6, z });
    mesh(new THREE.PlaneGeometry(w, 1.0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), { x: side * (HW - 0.06), y: 1.6, z, ry: -side * Math.PI / 2, keep: true, shadow: false });
  };
  board(-1, 1.4, 1.4); board(1, 2.5, 1.4); board(-1, -6.0 + 0.0, 0.01 + 1.0); board(1, -10.8, 2.4);
  const doorM = solid("#9b6a3e", { roughness: 0.55 }), frameM = solid("#e9e6dd", { roughness: 0.5 });
  const winM = new THREE.MeshPhysicalMaterial({ color: "#20303f", roughness: 0.08, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.4 });
  const roomDoor = (side, z, num) => {
    const x = side * (HW - 0.02);
    bx(0.08, 2.32, 1.18, frameM, { x, y: 1.16, z });
    bx(0.06, 2.2, 1.0, doorM, { x: x - side * 0.03, y: 1.1, z });
    bx(0.02, 0.6, 0.32, winM, { x: x - side * 0.065, y: 1.55, z: z - 0.2, shadow: false });
    bx(0.06, 0.12, 0.06, solid("#d9dde3", { metalness: 0.9, roughness: 0.25 }), { x: x - side * 0.08, y: 1.05, z: z + 0.36 });
    const t = K.canvas(128, 64, (p) => { p.fillStyle = "#1f4f8f"; p.fillRect(0, 0, 128, 64); p.fillStyle = "#fff"; p.font = "bold 38px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText(num, 64, 34); });
    mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), { x: x - side * 0.05, y: 2.5, z: z + 0.55 + 0.25, ry: -side * Math.PI / 2, keep: true, shadow: false });
  };
  roomDoor(-1, -6.0 + 1.6, "104"); roomDoor(-1, -12.8 + 1.4, "106"); roomDoor(1, -11.0 + 0.0 - 0.6 + 0.0, "105");
  // the open classroom door: frame, the leaf swung into the room, a room sign
  bx(0.24, 0.1, DOOR.z1 - DOOR.z0 + 0.12, frameM, { x: HW + 0.02, y: 2.35, z: (DOOR.z0 + DOOR.z1) / 2 });
  for (const zz of [DOOR.z0, DOOR.z1]) bx(0.26, 2.3, 0.08, frameM, { x: HW + 0.02, y: 1.15, z: zz });
  { const g = new THREE.Group(); g.position.set(HW + 0.1, 0, DOOR.z0 + 0.04); g.rotation.y = -1.25; root.add(g);
    bx(0.06, 2.2, 1.3, doorM, { z: 0.65, y: 1.1, parent: g }); bx(0.07, 0.6, 0.32, winM, { z: 0.45, y: 1.55, parent: g, shadow: false }); }
  { const t = K.canvas(128, 64, (p) => { p.fillStyle = "#1f4f8f"; p.fillRect(0, 0, 128, 64); p.fillStyle = "#fff"; p.font = "bold 38px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("103", 64, 34); });
    mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), { x: HW - 0.05, y: 2.55, z: DOOR.z1 + 0.35, ry: -Math.PI / 2, keep: true, shadow: false }); }
  { // a banner across the hallway, the exit sign over the lobby
    const t = K.canvas(1024, 160, (p, w, h) => { p.fillStyle = "#ffcc29"; p.fillRect(0, 0, w, h); p.fillStyle = "#e0482f"; p.fillRect(0, 0, w, 14); p.fillRect(0, h - 14, w, 14); p.fillStyle = "#1f3f8f"; p.font = "bold 96px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("GO OWLS!", w / 2, h / 2 + 4); });
    mesh(new THREE.PlaneGeometry(3.4, 0.55), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide }), { y: 2.7, z: -9.5, keep: true, shadow: false });
    const ex = K.canvas(256, 96, (p) => { p.fillStyle = "#0c8a3a"; p.fillRect(0, 0, 256, 96); p.fillStyle = "#ffffff"; p.font = "bold 64px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("EXIT", 128, 52); });
    const exM = glow.add(new THREE.MeshStandardMaterial({ map: ex, emissive: "#ffffff", emissiveMap: ex, roughness: 0.4 }), { day: 0.5, night: 2.2, warm: 0.8 });
    bx(0.7, 0.26, 0.08, exM, { y: HH - 0.35, z: HZ1 + 0.05, shadow: false });
  }
  // a water fountain and a bench in the lobby, a trophy case
  bx(0.5, 0.9, 0.4, solid("#c9ced4", { metalness: 0.6, roughness: 0.3 }), { x: -HW + 0.25, y: 0.75, z: -1.7 + 0.0 - 0.0 - 0.0 - 0.6 + 0.0 + 0.0 + 1.2 });
  for (const s of [-1, 1]) { bx(2.4, 0.08, 0.5, solid("#b07a4a", { roughness: 0.5 }), { x: s * 4.0, y: 0.45, z: -20 }); for (const dx of [-1, 1]) bx(0.08, 0.45, 0.4, solid("#3a3f46", { metalness: 0.5 }), { x: s * 4.0 + dx * 1.0, y: 0.22, z: -20 }); }

  // ---------- the classroom: desks in rows, the board, the teacher's desk, a clock ----------
  const deskTop = solid("#d8b88a", { roughness: 0.5 }), metal = solid("#5f6670", { metalness: 0.6, roughness: 0.4 });
  const CHAIRS = ["#e04848", "#2e6fd6", "#f2b928", "#2fa866"];
  let n = 0;
  for (let col = 0; col < 4; col++) for (let row = 0; row < 3; row++) {
    const x = 3.6 + col * 1.25, z = -6.8 + row * 2.0 + (col % 2) * 0.1;
    bx(0.6, 0.04, 0.85, deskTop, { x, y: 0.72, z });
    for (const [dx, dz] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.38], [0.25, 0.38]]) bx(0.035, 0.7, 0.035, metal, { x: x + dx, y: 0.35, z: z + dz });
    const cm = solid(CHAIRS[n++ % CHAIRS.length], { roughness: 0.45 });
    bx(0.4, 0.04, 0.4, cm, { x: x - 0.5, y: 0.45, z }); bx(0.04, 0.42, 0.4, cm, { x: x - 0.72, y: 0.7, z });
    for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) bx(0.03, 0.44, 0.03, metal, { x: x - 0.5 + dx, y: 0.22, z: z + dz });
  }
  { // the green board on the far wall (x = CX1), chalk writing
    const t = K.canvas(1024, 400, (p, w, h) => { p.fillStyle = "#24533c"; p.fillRect(0, 0, w, h); for (let i = 0; i < 600; i++) { p.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.04})`; p.fillRect(rnd() * w, rnd() * h, 30, 2); }
      p.fillStyle = "rgba(255,255,255,0.9)"; p.font = "bold 70px sans-serif"; p.fillText("2 + 3 = 5", 80, 130); p.font = "56px sans-serif"; p.fillText("Homework: page 42", 80, 240); p.fillText("Spelling test Friday!", 80, 320); });
    bx(0.06, 1.3, 3.6, solid("#b0b6bd", { metalness: 0.5, roughness: 0.4 }), { x: CX1 - 0.03, y: 1.6, z: (CZ0 + CZ1) / 2 });
    mesh(new THREE.PlaneGeometry(3.4, 1.15), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), { x: CX1 - 0.07, y: 1.6, z: (CZ0 + CZ1) / 2, ry: -Math.PI / 2, keep: true, shadow: false });
    bx(0.6, 0.76, 1.4, solid("#9b6a3e", { roughness: 0.5 }), { x: CX1 - 1.2, y: 0.38, z: CZ1 - 1.8 });
    const ck = K.canvas(128, 128, (p) => { p.fillStyle = "#fff"; p.beginPath(); p.arc(64, 64, 60, 0, Math.PI * 2); p.fill(); p.lineWidth = 6; p.strokeStyle = "#222"; p.stroke(); p.beginPath(); p.moveTo(64, 64); p.lineTo(64, 22); p.moveTo(64, 64); p.lineTo(94, 72); p.stroke(); });
    mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ map: ck, roughness: 0.5 }), { x: CX1 - 0.03, y: 2.65, z: (CZ0 + CZ1) / 2, ry: -Math.PI / 2, keep: true, shadow: false });
  }

  // ---------- ceiling lights (emissive panels; night: every other one on) ----------
  const panelOn = glow.add(new THREE.MeshStandardMaterial({ color: "#fdfcf6", emissive: "#fff6e0" }), { day: 1.4, night: 1.2, warm: 1.0 });
  const panelOff = glow.add(new THREE.MeshStandardMaterial({ color: "#fdfcf6", emissive: "#fff6e0" }), { day: 1.4, night: 0.0, warm: 1.0 }, { day: "#fdfcf6", night: "#8a8c90", warm: "#fdfcf6" });
  let k = 0;
  for (let z = HZ0 - 1.4; z > HZ1; z -= 2.4) bx(0.6, 0.04, 1.2, k++ % 2 ? panelOff : panelOn, { y: HH - 0.02, z, shadow: false });
  for (const [x, z] of [[4.6, -5.5], [7.4, -5.5], [4.6, -1.5], [7.4, -1.5]]) bx(1.2, 0.04, 0.6, panelOff, { x, y: HH - 0.02, z, shadow: false });
  for (const [x, z] of [[-3.5, -19], [3.5, -19], [-3.5, -24], [3.5, -24]]) bx(1.0, 0.04, 1.0, panelOff, { x, y: AH - 0.02, z, shadow: false });

  mergeStatic(THREE, root);

  return {
    root, indoor: true,
    spots: { center: V(0, 0, 0), left: V(-1.05, 0, 0.3), right: V(1.05, 0, 0.3), back: V(0.25, 0, -2.3), far: V(0, 0, -21.5), door: V(2.3, 0, (DOOR.z0 + DOOR.z1) / 2), classroom: V(5.0, 0, -3.0) },
    camDir: V(0, 0, 1),
    views: { door: V(-0.8, 0, 0.6).normalize(), classroom: V(-1, 0, 0.15).normalize() },
    bounds: [new THREE.Box3(V(-HW + 0.3, 0.3, HZ1), V(HW - 0.3, HH - 0.25, HZ0 - 0.3)), new THREE.Box3(V(-AX + 0.3, 0.3, AZ1 + 0.4), V(AX - 0.3, AH - 0.4, HZ1)), new THREE.Box3(V(CX0 + 0.2, 0.3, CZ0 + 0.3), V(CX1 - 0.3, HH - 0.25, CZ1 - 0.3))],
    rig: {
      indoor: true,
      shadow: { center: [1.5, 0, -12], half: 20, far: 140, map: 2048 },
      sunDir: { day: [10, 16, -20], night: [-8, 12, -22], warm: [16, 6, -24] },
      sunScale: { day: 1.0, night: 2.0, warm: 1.2 },
      envScale: { day: 0.8, night: 0.3, warm: 0.7 },
      hemiScale: { day: 1.5, night: 0.45, warm: 1.2 },
      exposure: { day: 0.88, night: 0.9, warm: 0.9 },
      moonAt: [0.15, 0.35, -0.92],
      practicals(mode) {
        const L = [];
        const col = mode === "night" ? "#ffd9a0" : mode === "warm" ? "#ffe2bf" : "#fff4e2";
        const I = mode === "night" ? 2.6 : 7;
        for (const z of mode === "night" ? [HZ0 - 1.4, HZ0 - 1.4 - 4.8, HZ0 - 1.4 - 9.6] : [5, -1, -7, -13]) { const l = new THREE.PointLight(col, I, 8, 1.6); l.position.set(0, HH - 0.3, z); L.push(l); }
        if (mode !== "night") { const c = new THREE.PointLight(col, 6, 9, 1.6); c.position.set(6, HH - 0.3, -3.5); L.push(c); }
        return L;
      },
      onLight(mode) { glow.apply(mode); if (treeLineMat) treeLineMat.color.set(mode === "night" ? "#16261c" : "#3f7a3a"); },
    },
  };
}
