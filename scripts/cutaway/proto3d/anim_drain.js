
// ================= French drain (R1 home world above + kit parts) =================
// Layout: the house sits 2 units behind the cut face; a trench runs along its front, open on the face, so the face
// shows the trench lengthwise with the foundation as its back wall. The pipe runs half in the face (seen in section),
// then a solid outlet slopes down through the soil to a gravel soak pit on the right.
// Every cue is a word time from the final voice (drainAudio.mjs -> times_drain.json). ?endcard=0 drops the sign.
const TM = window.TIMES;
const QS = new URLSearchParams(location.search);
const END_CARD = QS.get("endcard") !== "0";
const { span, eOut, eIn, eInOut, pop, window01, clamp01 } = KV;
const KX = { THREE, scene, RoundedBoxGeometry, mergeVertices, rnd, grassM, soilM };
const U = soilM.userData.u;
const hemi = scene.children.find((o) => o.isHemisphereLight);
const storm = KW.stormLight(KX, { sun, hemi, scene });

// ---------- layout ----------
const TR = { x0: PIT.x0, x1: PIT.x1, z0: PIT.z0, z1: 0, depth: PIT.depth }; // the trench (PIT is set to it in makeDrain)
const GRAV_TOP = -0.45, CAP_Y = -0.38;
const inTr = (x0, x1) => ({ x0: TR.x0 + 0.02 + x0, x1: TR.x1 - 0.02 - x1 });

// ---------- materials ----------
const concreteM = PBR("beige_wall_001", 0.5, { color: C("#e4e2dd") });
const waterM = phys({ color: C("#3a86e0"), transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
const puddleM = phys({ color: C("#4c8fd8"), transparent: true, opacity: 0.55, roughness: 0.03, clearcoat: 1, depthWrite: false });
const gravelT = PBR("gravel", 1, { color: C("#f2eee6") }), wellT = PBR("gravel", 1, { color: C("#f2eee6") });
const pebbleM = std({ color: C("#cbc4b6"), roughness: 0.65 }), wellPebM = std({ color: C("#cbc4b6"), roughness: 0.65 });
const gravelWet = KFill.wettable(KX, gravelT, { key: "gravel" }), wellWet = KFill.wettable(KX, wellT, { key: "well" }), pebbleWet = KFill.wettable(KX, pebbleM, { key: "pebble" }), wellPebWet = KFill.wettable(KX, wellPebM, { key: "wellpeb" });
const fabricM = std({ color: C("#fbfbf6"), roughness: 0.85, emissive: C("#3a3a36"), emissiveIntensity: 0.5 });
const dirtM = PBR("brown_mud_dry", 0.6, { color: C("#e0b890") });
const capSoilM = PBR("brown_mud_dry", 1, { color: C("#9a7656") });

// ---------- the foundation (its front face is the trench's back wall) ----------
{ const f = box(concreteM, 11.2, 3.38, 6.77, -5.5, -3.2 + 3.38 / 2, -5.365, scene, 0.03); f.receiveShadow = true; }

// ---------- dig the trench ----------
const dig = KDig.digCut(KX, { ...TR, mound: { x: 4.8, z: -5.4, rx: 1.9, rz: 1.5, h: 1.25 }, clumps: 170, dirtMat: dirtM });

// ---------- water: trench water, puddles, eave runoff, rain ----------
const water = KFill.fillBlock(KX, { ...inTr(0, 0), z0: TR.z0 + 0.02, z1: -0.01, y0: -TR.depth, y1: -1.2, mat: waterM, r: 0.02, castShadow: false });
water.mesh.renderOrder = 2;
const puddles = [[2.6, -4.6, 1.3, 0.9], [-12.9, -4.8, 1.0, 0.8], [1.9, -7.4, 0.9, 0.6]].map(([x, z, rx, rz]) => KProps.puddle(KX, { x, z, rx, rz, mat: puddleM }));
const rainP = KW.rain(KX, { x0: -20, x1: 14, z0: -18, z1: -0.1, yTop: 20, yBot: -0.4, count: 1300, width: 0.02, opacity: 0.36 });
const eave = KW.stream(KX, { x0: -11.3, x1: 0.4, z: -1.5, yTop: 6.3, yBot: -2.4, count: 230 });

// ---------- pressure, the crack ----------
const pressure = KOv.arrows(KX, [-9.5, -7.0, -4.5, -2.0].map((x, i) => ({ at: [x, -1.12, -0.25], dir: [0, -1], travel: 1.2, phase: i * 0.25 })), { flat: true, scale: 1.55 });
const crackP = KProps.crack(KX, [[-4.7, 0.17, -1.955], [-4.35, -0.3, -1.955], [-4.72, -0.85, -1.955], [-4.2, -1.4, -1.955], [-4.5, -2.0, -1.955], [-4.0, -2.7, -1.955], [-4.25, -3.3, -1.955]], { r: 0.075 });

// ---------- gravel ----------
const gravel = KFill.fillBlock(KX, { ...inTr(0, 0), z0: TR.z0 + 0.02, z1: 0, y0: -TR.depth, y1: GRAV_TOP, mat: gravelT, r: 0.04 });
const stoneGeo = (() => { const g = mergeVertices(new THREE.IcosahedronGeometry(1, 1)); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.18 * Math.sin(v.x * 5 + v.y * 3)); p.setXYZ(i, v.x, v.y * 0.8, v.z); } g.computeVertexNormals(); return g; })();
const gravelFace = KFill.pebbles(KX, { ...inTr(0.02, 0.02), y0: -TR.depth, y1: GRAV_TOP, z0: TR.z0 + 0.05, z1: 0.04, mat: pebbleM, geo: stoneGeo });
const stones = KFill.pour(KX, { ...inTr(0.2, 0.2), z0: TR.z0 + 0.2, z1: -0.25, yFrom: 6.5, count: 260, geo: stoneGeo, mat: std({ color: C("#cfc6b4"), roughness: 0.8 }), size: [0.09, 0.19] });

// ---------- the pipe (perforated, in the trench) and the solid outlet down to the soak pit ----------
const PZ = -0.06;
const drainPipe = KPipe.pipePath(KX, [[TR.x0 + 0.3, -2.55, PZ], [0.55, -2.9, PZ]], { r: 0.3, color: "#f4f3ee", perforated: true, holeSpacing: 0.62 });
const outlet = KPipe.pipePath(KX, [[0.55, -2.9, PZ], [1.7, -3.3, PZ], [3.9, -4.45, PZ]], { r: 0.3, color: "#f4f3ee" });
const flowIn = drainPipe.flow({ count: 22, size: 0.11, offset: [0, 0, 0.33] }), flowOut = outlet.flow({ count: 10, size: 0.11, offset: [0, 0, 0.33] });
const well = KFill.wipeBlock(KX, { x0: 3.4, x1: 6.1, y0: -6.1, y1: -3.85, z0: -2.4, z1: 0.015, mat: wellT, axis: "y", r: 0.05 });
const wellFace = KFill.pebbles(KX, { x0: 3.4, x1: 6.1, y0: -6.1, y1: -3.85, z0: -2.3, z1: 0.04, mat: wellPebM, geo: stoneGeo });
const seep = KOv.arrows(KX, [-9.6, -7.2, -4.8, -2.4, -0.2].map((x, i) => ({ at: [x, -1.15, 0.42], dir: [0, -1], travel: 1.25, phase: i * 0.2 })), { scale: 0.95 });
const soakArrows = KOv.arrows(KX, [4.15, 5.35].map((x, i) => ({ at: [x, -6.5, 0.4], dir: [0, -1], travel: 2.4, phase: i * 0.5 })), { scale: 1.05 });
const outlineU = KOv.outline(KX, [[TR.x0 - 0.12, 0.12, 0.12], [TR.x0 - 0.12, -TR.depth - 0.12, 0.12], [TR.x1 + 0.12, -TR.depth - 0.12, 0.12], [TR.x1 + 0.12, 0.12, 0.12]]);

// ---------- fabric, mud, cap ----------
const fabric = KSheet.wrapSheet(KX, { ...inTr(0, 0), y0: -TR.depth + 0.0, y1: GRAV_TOP, z0: TR.z0 + 0.03, z1: 0.012 }, { mat: fabricM, thick: 0.13, sides: ["back", "floor", "top"], along: "x", stagger: 0.14, dur: 0.45 });
const NM = 22, mud = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), std({ color: C("#4f3520"), roughness: 0.85 }), NM); mud.renderOrder = 4; scene.add(mud);
const mudD = Array.from({ length: NM }, (_, i) => ({ x: TR.x0 + 0.6 + (i + rnd() * 0.6) * (TR.x1 - TR.x0 - 1.2) / NM, ph: rnd() * 0.35, s: 0.07 + rnd() * 0.04 }));
const capSoil = KFill.wipeBlock(KX, { ...inTr(0, 0), y0: CAP_Y, y1: -0.05, z0: TR.z0 + 0.02, z1: 0, mat: capSoilM, axis: "x", r: 0.04 });
const capGrass = KFill.wipeBlock(KX, { x0: TR.x0 - 0.15, x1: TR.x1 + 0.15, y0: -0.18, y1: 0.09, z0: TR.z0 - 0.05, z1: 0, mat: grassM, axis: "x", r: 0.08, uvScale: 0.25 });
const bushes = KProps.shrubs(KX, [[-10.3, -1.0, 0.9], [-8.6, -0.9, 1.0], [-7.0, -1.05, 0.85], [-2.9, -0.95, 0.95], [-1.1, -1.0, 0.9]], { mats: [P.leaf, P.leaf2] });

// ---------- the myth-bust: a French flag crossed out, then Henry French's 1859 book ----------
const flag = KProps.flagProp(KX, { at: [3.1, 0, -1.9] });
const bookP = KProps.paperProp(KX, { w: 1.9, h: 2.5, bg: "#7a2f24", book: true, spine: "#4d1c15", lines: [
  { text: "FARM", font: "bold 74px Georgia, serif", color: "#f2d58e", y: 150 }, { text: "DRAINAGE", font: "bold 66px Georgia, serif", color: "#f2d58e", y: 232 },
  { rule: true, y: 270, color: "#f2d58e" }, { text: "H. F. FRENCH", font: "bold 44px Georgia, serif", color: "#f2d58e", y: 380 }, { text: "1859", font: "bold 56px Georgia, serif", color: "#f2d58e", y: 560 } ] });
const sign = KProps.endSign(KX, { at: [-1.4, 0.08, -0.85], rotY: 0.22, scale: 1.3 });

// ---------- camera: home angle, slow drift, fast moves just before sentences; named parts off the caption band ----------
// each key: [time, target, zoom factor of the home view, optional view offset]; closer = smaller factor
const OFF = [15.5, 10.5, 50], HOME_T = [-3.5, 1.0, -4.0];
const K = (t, tgt, f, off = OFF) => [t, tgt.map((v, i) => v + off[i] * f), tgt];
const LOW = [12, 4.5, 40], HIGH = [10, 21, 34];
const KEYS = [
  K(0.0, HOME_T, 1.0),
  K(TM.drain + 0.2, HOME_T, 0.97),
  K(TM.but1 + 0.35, [-3.5, 2.4, -4.0], 0.9), //                       rain and the roof (the 600 card sits in the sky)
  K(TM.walls, [-3.5, 2.2, -4.0], 0.87),
  K(TM.ditch + 0.3, [-4.8, -1.4, -1.4], 0.66, HIGH), //                the flooding ditch, the wall behind it (from above: arrows on the water)
  K(TM.pushes, [-4.8, -1.4, -1.4], 0.62, HIGH),
  K(TM.cracks + 0.35, [-4.4, -0.9, -1.8], 0.45, [12, 9, 40]), //               the crack
  K(TM.so1 + 0.35, [-4.0, -1.2, -2.5], 0.7), //                        gravel pours in
  K(TM.bottom + 0.3, [-4.0, -1.4, -2.5], 0.66),
  K(TM.so2 + 0.3, [-3.5, -2.0, -2.0], 0.6), //                          the pipe goes in under the lifted gravel
  K(TM.holes + 0.1, [-2.6, -2.7, -0.3], 0.22, LOW), //                  close on the holes
  K(TM.gravel2 + 0.2, [-2.6, -2.7, -0.3], 0.21, LOW),
  K(TM.this + 0.45, [-4.5, -1.6, -2.0], 0.62), //                       the whole trench in section, U outline
  K(TM.seeps + 0.4, [-4.3, -1.8, -2.0], 0.6),
  K(TM.slopes + 0.3, [1.8, -3.6, -1.2], 0.5), //                        follow the outlet down to the soak pit
  K(TM.away + 0.6, [2.6, -4.6, -1.2], 0.48),
  K(TM.wrap + 0.3, [-4.0, -1.0, -2.4], 0.6), //                         the wrap
  K(TM.mud + 0.6, [-4.0, -1.0, -2.4], 0.58),
  K(TM.and1 + 0.35, [2.6, -1.2, -2.2], 0.38), //                         the flag and the book, high in the frame (above the card and the caption)
  K(TM.henry + 0.2, [2.7, -1.2, -2.1], 0.37),
  K(TM.n1859 + 0.6, [2.7, -1.2, -2.1], 0.355),
  K(TM.n1859 + 1.32, [2.7, -1.2, -2.1], 0.35), //                          hold on the book until the "1859" card (1.3 s) is gone,
  K(TM.add + 0.65, HOME_T, 0.95), //                                       then pull back to the cap and the bushes
  K(TM.congrats + 0.1, HOME_T, 1.0),
  ...(END_CARD
    ? [K(TM.signPop + 0.1, [-3.2, 1.2, -4.2], 1.18), //                   pull back to the calm scene until the sign pops,
      K(TM.lengthEnd, [-1.6, 2.4, -1.2], 0.72)] //                         then a gentle push toward the sign
    : [K(TM.lengthNoEnd, [-3.2, 1.2, -4.2], 1.25)]),
];
const camPath = KCam.cameraPath(KEYS);
const LOOK_AT = QS.get("cam") ? QS.get("cam").split(",").map(Number) : null; // debug: ?cam=px,py,pz,tx,ty,tz

// ---------- the timeline ----------
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
window.renderAt = (t) => {
  dig.update(t, TM.dig + 0.02, TM.dig + 1.0, [TM.add, TM.add + 0.8]);

  // storm: rain from "But", the eave pours from "roof", everything clears from "Wrap"
  const stormK = eInOut(span(t, TM.but1 - 0.1, TM.but1 + 0.5)) * (1 - eInOut(span(t, TM.wrap, TM.and1 + 0.4)));
  storm.set(stormK);
  rainP.update(t, eOut(span(t, TM.but1, TM.but1 + 0.4)) * (1 - span(t, TM.wrap, TM.mud + 0.3)));
  eave.update(t, span(t, TM.roof - 0.1, TM.roof + 0.25) * (1 - span(t, TM.wrap - 0.2, TM.wrap + 0.4)));
  WET_LAWN.value = 0.9 * span(t, TM.but1 + 0.3, TM.walls) * (1 - span(t, TM.mud, TM.add));
  puddles.forEach((p, i) => p.set(eOut(span(t, TM.dumps + i * 0.3, TM.walls + i * 0.2)) * (1 - eInOut(span(t, TM.wrap + i * 0.2, TM.and1 + 0.5)))));

  // the trench water: a trickle from the eave, then the ditch floods; then it sinks into the gravel
  const flood = 0.22 * span(t, TM.dumps, TM.ditch - 0.1) + 0.78 * eOut(span(t, TM.ditch - 0.05, TM.floods + 0.45));
  const gravK = span(t, TM.fill + 0.1, TM.gravel1 + 0.55);
  const lvl = flood * (1 - 0.5 * gravK);                                     // 1 = y -1.2, 0.5 = y -2.4
  water.set(lvl);
  const lift = 2.6 * (eOut(span(t, TM.so2 + 0.02, TM.so2 + 0.36)) - eIn(span(t, TM.gravel2 - 0.15, TM.gravel2 + 0.22)));
  const squash = Math.sin(Math.PI * span(t, TM.gravel2 + 0.22, TM.gravel2 + 0.48)) * 0.04;
  gravel.set(gravK * (1 - squash)); gravel.lift(lift);
  // water in the gravel: sits at the bottom, then drains into the pipe ("seeps") and away
  const wy = Math.max(-TR.depth - 0.1, -1.2 - (1 - lvl) * 2.4 - 1.25 * eInOut(span(t, TM.seeps + 0.2, TM.away + 0.4)));
  gravelWet.set(wy + lift, gravK > 0.02 ? 1 : 0); pebbleWet.set(wy + lift, gravK > 0.02 ? 1 : 0);
  gravelFace.set(gravel.top(), lift, gravK > 0.01 ? 1 : 0);
  water.mesh.visible = water.mesh.visible && (gravK < 0.02 || water.top() > gravel.top() + 0.01 || lift > 0.05) && t < TM.seeps + 0.3;
  stones.update(t, TM.fill, TM.gravel1 + 0.5, () => gravel.top() + 0.05);

  // pressure on the wall, the crack
  pressure.update(t, window01(t, TM.pushes - 0.05, TM.so1 - 0.1, 0.3));
  crackP.set(eOut(span(t, TM.cracks - 0.05, TM.cracks + 0.35)));

  // wet soil around the trench (dark band in the cut face), drying once the drain works
  U.uWet.value.set((TR.x0 + TR.x1) / 2, (TR.x1 - TR.x0) / 2 + 0.3, -TR.depth - 0.6, 0.75 * span(t, TM.walls - 0.4, TM.floods + 0.6) * (1 - span(t, TM.away, TM.and1 + 1.0)));

  // the pipe: grows on "pipe full of holes" while the gravel is lifted; the outlet on "slopes downhill"
  drainPipe.grow(drainPipe.length * span(t, TM.pipe - 0.1, TM.holes + 0.15));
  outlet.grow(outlet.length * eInOut(span(t, TM.slopes - 0.05, TM.downhill + 0.45)));
  const wellK = eOut(span(t, TM.slopes + 0.25, TM.downhill + 0.5)); well.set(wellK); wellFace.set(-6.1 + 2.25 * wellK, 0, wellK > 0.01 ? 1 : 0);
  const flowK = span(t, TM.seeps + 0.1, TM.seeps + 0.5) * (1 - span(t, TM.mud, TM.and1));
  flowIn.update(t, flowK, 3.4); flowOut.update(t, flowK * span(t, TM.downhill, TM.downhill + 0.4), 3.4);
  seep.update(t, window01(t, TM.seeps - 0.05, TM.wrap - 0.1, 0.3));
  const wellY = -6.1 + 2.25 * eOut(span(t, TM.away - 0.1, TM.away + 0.9)) * (1 - 0.6 * span(t, TM.mud, TM.and1 + 1.5)), wellOn = t > TM.away - 0.1 ? 1 : 0;
  wellWet.set(wellY, wellOn); wellPebWet.set(wellY, wellOn);
  U.uSoak.value.set(3.4, 6.1, -6.1, -6.1 - 4.6 * eOut(span(t, TM.away + 0.2, TM.and1 + 0.8)));
  U.uSoakOn.value = span(t, TM.away + 0.1, TM.away + 0.5) * (1 - span(t, TM.henry, TM.add));
  soakArrows.update(t, window01(t, TM.away + 0.2, TM.and1 + 0.3, 0.3));
  outlineU.update(t, window01(t, TM.french1 - 0.05, TM.seeps + 0.15, 0.25));

  // the wrap, mud stopped on top of it
  fabric.update(t, TM.wrap + 0.05);
  const mudOn = 1 - span(t, TM.and1 - 0.1, TM.and1 + 0.3);
  mudD.forEach((d, i) => { const u = span(t, TM.mud + d.ph - 0.1, TM.mud + d.ph + 0.35); const y = 0.7 + (CAP_Y + 0.06 + d.s - 0.7) * eIn(u); const k = u > 0 ? d.s * mudOn : 0; mud.setMatrixAt(i, m4.compose(v4.set(d.x, y, 0.16), q4, s4.set(k, k * (u >= 1 ? 0.7 : 1), k))); });
  mud.instanceMatrix.needsUpdate = true;

  // myth-bust props
  flag.update(t, TM.french2 - 0.1, TM.not, TM.it1 - 0.05);
  bookP.update(t, TM.henry - 0.05, [3.0, -0.8, -1.7], [3.0, 3.0, -1.7], TM.add, [-0.12, -0.32, 0.02]);

  // the cap, the bushes; the end card
  capSoil.set(eOut(span(t, TM.add + 0.05, TM.grass + 0.2))); capGrass.set(eOut(span(t, TM.grass - 0.05, TM.top + 0.1)));
  bushes.update(t, TM.top - 0.05, 0.09);
  sign.update(t, TM.signPop, END_CARD);

  if (LOOK_AT) { camera.position.set(...LOOK_AT.slice(0, 3)); camera.lookAt(...LOOK_AT.slice(3)); } else camPath.apply(camera, t);
  composer.render(); return true;
};
