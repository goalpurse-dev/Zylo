// Blocky Worlds HARD STILL GATE (owner, 2026-11-09: "reject any still where >60% of pixels are one flat colour, sky-only,
// a wall, or the camera is inside geometry. This must run on RunPod stills before render, with automatic re-plan").
// The free gate every shot's still goes through before any chunk renders (no AI): pixel rules on a small grid of the
// frame, plus geometry rules measured in the engine page from the real camera and scene. Pure; browser-safe (the engine
// page imports it from /lib/stillGate.js to measure, Node imports it to judge).
//
//   pixelStats(rgba, w, h)            the grid's numbers (w x h = GRID: 36 x 64, any 9:16 grid works)
//   pixelReasons(stats)               -> [{ code, why }]  flat / wall / sky_only / too_dark / blown_out
//   measureGeometry(THREE, scene, camera, shot, opts?)  (in the page) -> geo: rays through the frame + the subject
//   geoReasons(geo, shot)             -> { fail: [{ code, why }], warn: [...] }  camera_inside / blocked / sky_only /
//                                        subject_missing (fail), face_hidden (warn: logged, never re-planned)
//   gateStill({ stats, geo, shot })   -> { pass, reasons, warn, stats, geo }
//   gridFromCanvas(canvas, doc?)      (in the page) the 36 x 64 RGBA grid of a canvas
//   measurePage(win, shotIndex)       (in the page, after window.renderAt) -> { stats, geo, verdict }
//
// Calibrated on the step-3 stills (5 videos, 334 stills, problems.json labels; dev/stillGate.test.mjs and
// dev/stillGateCalibrate.mjs): see GATE below for the numbers.

export const GRID = Object.freeze({ w: 36, h: 64 });

export const GATE = Object.freeze({
  // pixels (the 36 x 64 grid)
  flatShare: 0.6,       // the owner's rule: > 60 % of the frame one FLAT colour (within flatTol of the commonest colour
  flatTol: 22,          //   and smooth: no neighbour step over smoothTol; a textured floor / cobbles are not flat)
  smoothTol: 14,
  edge: 30,             // a cell is an edge when its colour step to its right / lower neighbour is over this
  clusterTol: 40,       // colour clusters: the 3 biggest (greedy, this RGB radius) ...
  wallClusters: 0.86,   // ... covering more than this of the frame
  wallCentre: 0.2,      // ... with fewer centre edges than this (the middle 60 % x 55 %): a wall / a close surface / blank
  emptyClusters: 0.75,  // or a nearly empty centre (fewer than emptyCentre edges) in a frame of few colours
  emptyCentre: 0.12,
  skyShare: 0.62,       // sky-coloured cells (day blue / cloud white / night navy) ...
  skyEdges: 0.14,       // ... with this few edges outside the sky: sky-only
  darkMean: 26, darkP90: 60,        // too dark: mean luminance and the 90th percentile
  blownMean: 222, blownShare: 0.55, // blown out: mean, or the share of cells over 240
  // geometry (rays through the frame from the real camera)
  insideShare: 0.5,     // rays whose first hit is a back face: the camera is inside a closed mesh
  nearShare: 0.6,       // rays whose first hit is closer than NEAR m: the lens is against a surface
  near: 0.45,
  blockShare: 0.6,      // one object covering this share of the rays within BLOCK_DIST m (not the subject): a wall
  blockDist: 4,          // (never past the subject: a wall behind a person is the background)
  blockDistEmpty: 1.5,  // ... with no subject on screen: this close
  geoSkyShare: 0.72,    // rays that hit nothing (sky dome excluded): sky-only
  geoSkyNoSubject: 0.55, //  ... or this many when the subject is not in frame
  // GATE 2026-11-09 (cost: 17-27 s a still on the vegetation sets with rays to 2 km): the grid rays test triangles only
  // up to rayFar m (three.js skips every mesh / instance whose bounding sphere starts further); a ray with no hit inside
  // that range is "far geometry" when it crosses a mesh's world box (the subject's box: on the subject), else sky
  rayFar: 45,
  blockClose: 0.4,      // a close-up / medium of one person: something in front of them covering this share fails
  rayMs: 4000,          // a time cap for the ray grid (the shares are taken over the rays cast)
});

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const dist3 = (a, b, c, x, y, z) => Math.sqrt((a - x) ** 2 + (b - y) ** 2 + (c - z) ** 2);
const r3 = (x) => Math.round(x * 1000) / 1000;

/** is a cell sky-coloured: day blue, near-white cloud (upper part), dusk / night navy */
export function skyLike(r, g, b, yFrac = 0) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, L = lum(r, g, b);
  if (b >= 120 && b > r + 30 && b >= g - 6 && sat > 0.18) return true;            // day sky
  if (yFrac < 0.6 && L > 205 && sat < 0.12) return true;                           // cloud / haze near the top
  if (L < 75 && b > r + 8 && b >= g - 2 && b > 18) return true;                    // night / dusk sky
  return false;
}

/**
 * The grid's numbers: mean / p10 / p90 luminance, dark / bright shares, saturation, edges (whole frame and the centre
 * box), flat (the owner's one-flat-colour share), clusters (the 3 biggest colour clusters' cover), sky (+ the edges
 * outside it). Cost: ~2-5 ms for 36 x 64.
 */
export function pixelStats(px, w = GRID.w, h = GRID.h, T = GATE) {
  const n = w * h;
  if (!px || px.length < n * 4) throw new Error(`pixelStats: ${px?.length ?? 0} bytes for ${w}x${h}`);
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), L = new Float32Array(n);
  let sumL = 0, dark = 0, bright = 0, satSum = 0;
  for (let i = 0; i < n; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    R[i] = r; G[i] = g; B[i] = b; L[i] = lum(r, g, b); sumL += L[i];
    if (L[i] < 30) dark++; if (L[i] > 240) bright++;
    const mx = Math.max(r, g, b); satSum += mx ? (mx - Math.min(r, g, b)) / mx : 0;
  }
  const sorted = Float32Array.from(L).sort();
  const pct = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  const step = (i, j) => dist3(R[i], G[i], B[i], R[j], G[j], B[j]);
  // each cell's largest colour step to its right / lower neighbour
  const mstep = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let m = 0;
    if (x + 1 < w) m = Math.max(m, step(i, i + 1));
    if (y + 1 < h) m = Math.max(m, step(i, i + w));
    mstep[i] = m;
  }
  let edges = 0, ce = 0, cn = 0;
  const x0 = Math.floor(w * 0.2), x1 = Math.floor(w * 0.8), y0 = Math.floor(h * 0.2), y1 = Math.floor(h * 0.75);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = mstep[y * w + x] > T.edge;
    if (e) edges++;
    if (x >= x0 && x < x1 && y >= y0 && y < y1) { cn++; if (e) ce++; }
  }
  // 16-level colour buckets: the candidates for the flat colour and the clusters
  const bk = new Map();
  for (let i = 0; i < n; i++) {
    const key = ((R[i] >> 4) << 8) | ((G[i] >> 4) << 4) | (B[i] >> 4);
    const s = bk.get(key) ?? bk.set(key, { n: 0, r: 0, g: 0, b: 0 }).get(key);
    s.n++; s.r += R[i]; s.g += G[i]; s.b += B[i];
  }
  const cands = [...bk.values()].sort((a, b) => b.n - a.n).slice(0, 48).map((s) => [s.r / s.n, s.g / s.n, s.b / s.n]);
  // the owner's flat colour: the commonest bucket's colour, its smooth cells within flatTol
  const [fr, fg, fb] = cands[0];
  let flat = 0;
  for (let i = 0; i < n; i++) if (mstep[i] < T.smoothTol && dist3(R[i], G[i], B[i], fr, fg, fb) < T.flatTol) flat++;
  // the 3 biggest colour clusters (greedy: the candidate colour covering most cells left, those cells taken out)
  const left = new Uint8Array(n).fill(1);
  let clusters = 0, c1 = 0;
  for (let k = 0; k < 3; k++) {
    let best = null, bn = 0;
    for (const c of cands) {
      let m = 0;
      for (let i = 0; i < n; i++) if (left[i] && dist3(R[i], G[i], B[i], c[0], c[1], c[2]) < T.clusterTol) m++;
      if (m > bn) { bn = m; best = c; }
    }
    if (!best || !bn) break;
    for (let i = 0; i < n; i++) if (left[i] && dist3(R[i], G[i], B[i], best[0], best[1], best[2]) < T.clusterTol) left[i] = 0;
    clusters += bn; if (k === 0) c1 = bn;
  }
  // sky cells, and the edges outside the sky (what the frame shows besides the sky)
  let sky = 0, edgesOff = 0;
  for (let i = 0; i < n; i++) {
    if (skyLike(R[i], G[i], B[i], Math.floor(i / w) / h)) sky++;
    else if (mstep[i] > 16) edgesOff++;
  }
  return {
    w, h, mean: r3(sumL / n), p10: r3(pct(0.1)), p90: r3(pct(0.9)), dark: r3(dark / n), bright: r3(bright / n), sat: r3(satSum / n),
    edges: r3(edges / n), centreEdges: r3(ce / Math.max(1, cn)),
    flat: r3(flat / n), flatColor: [Math.round(fr), Math.round(fg), Math.round(fb)],
    cluster1: r3(c1 / n), clusters: r3(clusters / n),
    sky: r3(sky / n), edgesOffSky: r3(edgesOff / n),
  };
}

/** the pixel rules -> [{ code, why }] (empty: the frame passes) */
export function pixelReasons(s, T = GATE) {
  const out = [];
  if (!s) return out;
  const pc = (x) => `${Math.round(x * 100)}%`;
  if (s.mean < T.darkMean && s.p90 < T.darkP90) out.push({ code: "too_dark", why: `mean ${s.mean}, 90th pct ${s.p90}` });
  if (s.mean > T.blownMean || s.bright > T.blownShare) out.push({ code: "blown_out", why: `mean ${s.mean}, ${pc(s.bright)} over 240` });
  const skyOnly = s.sky > T.skyShare && s.edgesOffSky < T.skyEdges * (1.2 - s.sky);
  if (skyOnly) out.push({ code: "sky_only", why: `${pc(s.sky)} sky, ${pc(s.edgesOffSky)} edges besides it` });
  if (s.flat > T.flatShare) out.push({ code: "flat", why: `${pc(s.flat)} one flat colour rgb(${s.flatColor.join(",")})` });
  else if (!skyOnly && ((s.clusters > T.wallClusters && s.centreEdges < T.wallCentre) || (s.clusters > T.emptyClusters && s.centreEdges < T.emptyCentre))) out.push({ code: "wall", why: `${pc(s.clusters)} in 3 colours, ${pc(s.centreEdges)} edges in the centre` });
  return out;
}

// ------------------------------------------------------------------------------------------------ geometry (page)
const isMeshLike = (o) => o.isMesh || o.isInstancedMesh || o.isSkinnedMesh;
const visibleChain = (o) => { for (let n = o; n; n = n.parent) if (n.visible === false) return false; return true; };
const nameOf = (o) => (typeof o?.name === "string" ? o.name : "");

/**
 * What the shot's focus means in the scene (the engine's object names: person:<id> (page/kit/people.js), crowd:<kind>
 * (kit/crowd.js), giant:<id> (kit/giants.js), object:<key>:<state> (kit/objects.js), blueprint:<name>, monster:<look>).
 *   -> { mode: "none" | "one" | "any", names: [exact], prefixes: [...], soft }   soft: no such thing on the set is not a miss
 */
export function subjectSpec(shot) {
  const f = String(shot?.focus ?? ""), actors = (shot?.actors ?? []).map((a) => a.id);
  if (!f || f === "insert" || shot?.camera === "insert") return { mode: "none", names: [], prefixes: [] };
  if (f === "group") return { mode: "any", names: actors.map((id) => `person:${id}`), prefixes: ["person:extra"] };
  if (f === "crowd" || f.startsWith("crowd:")) return { mode: "any", names: [], prefixes: ["crowd:", "person:"] };
  if (f.startsWith("giant:")) return { mode: "one", names: [f], prefixes: [] };
  if (f === "world") return { mode: "any", names: ["giant:world"], prefixes: [], soft: true };
  if (f === "object") return { mode: "any", names: [], prefixes: ["object:", "blueprint:"] };
  if (f === "monster") return { mode: "any", names: [], prefixes: ["monster:"] };
  if (actors.includes(f)) return { mode: "one", names: [`person:${f}`], prefixes: [] };
  return { mode: "none", names: [], prefixes: [] };
}

/**
 * The geometry of the frame just rendered (call right after renderAt): a cols x rows grid of rays from the camera
 * (double-sided for the rays only, so a camera inside a closed box sees its back faces; BackSide sky domes / shells and
 * sky meshes are left out) and the subject: each subject root's anchor (a person's head, else its box centre) in frame
 * and not hidden by something nearer, the rays that land on it, a person's face toward the camera.
 */
export function measureGeometry(THREE, scene, camera, shot, { cols = 6, rows = 10, maxMeshes = 8000, T = GATE } = {}) {
  scene.updateMatrixWorld(true); camera.updateMatrixWorld();
  const meshes = [];
  const walk = (o) => {
    if (o.visible === false || meshes.length > maxMeshes) return;
    if (isMeshLike(o) && o.material && !o.isPoints && !o.isLine && !o.isSprite) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const back = mats.every((m) => m.side === THREE.BackSide);
      const ghost = mats.every((m) => m.visible === false || (m.transparent && (m.opacity ?? 1) < 0.25) || m.colorWrite === false);
      // (GATE 2026-11-09: the instanced grass carpet is left out too: ground cover, collapsed on the sight line by its
      // shader, and 40 000 instances per ray were most of the gate's 17-27 s a still)
      if (!back && !ghost && !/sky/i.test(nameOf(o)) && !(o.isInstancedMesh && nameOf(o) === "grass")) meshes.push(o);
    }
    for (const c of o.children) walk(c);
  };
  walk(scene);
  const spec = subjectSpec(shot);
  const roots = new Set();
  if (spec.mode !== "none") scene.traverse((o) => { const n = nameOf(o); if ((spec.names.includes(n) || spec.prefixes.some((p) => n.startsWith(p))) && visibleChain(o)) roots.add(o); });
  // a crowd's / group's people inside a matched root are not roots of their own
  for (const r of [...roots]) for (let p = r.parent; p; p = p.parent) if (roots.has(p)) { roots.delete(r); break; }
  const rootOf = (o) => { for (let n = o; n; n = n.parent) if (roots.has(n)) return n; return null; };
  // double-sided for the rays only, then put back (no render happens in between)
  const saved = [];
  for (const m of meshes) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat.side !== THREE.DoubleSide) { saved.push([mat, mat.side]); mat.side = THREE.DoubleSide; }
  const rc = new THREE.Raycaster();
  const camPos = camera.getWorldPosition(new THREE.Vector3());
  const keyOf = (o) => { for (let n = o; n; n = n.parent) if (nameOf(n).includes(":") && n.parent) return n.uuid; return o.parent && o.parent !== scene ? o.parent.uuid : o.uuid; };
  try {
    // the subject anchors first (their distance bounds what counts as a blocker in front of them)
    const anchors = [];
    for (const root of roots) {
      const hj = root.userData?.joints?.head;
      let p;
      if (hj) p = hj.getWorldPosition(new THREE.Vector3());
      else { const b = new THREE.Box3().setFromObject(root); if (b.isEmpty()) continue; p = b.getCenter(new THREE.Vector3()); }
      const v = p.clone().project(camera);
      const inFrame = v.z < 1 && v.z > -1 && Math.abs(v.x) <= 0.95 && v.y <= 0.97 && v.y >= -0.92;
      const dir = p.clone().sub(camPos), d = dir.length();
      rc.set(camPos, dir.normalize()); rc.near = 0.02; rc.far = d + 0.01;
      const first = d > 0.05 ? rc.intersectObjects(meshes, false)[0] : null;
      const hidden = !!first && first.distance < d - 0.35 && rootOf(first.object) !== root;
      const a = { id: nameOf(root), inFrame, hidden, dist: r3(d), ndc: [r3(v.x), r3(v.y)] };
      if (nameOf(root).startsWith("person:")) {
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
        a.face = r3(fwd.dot(camPos.clone().sub(p).setY(0).normalize()));
      }
      anchors.push(a);
    }
    const seen = anchors.filter((a) => a.inFrame && !a.hidden);
    const subjDist = seen.length ? Math.min(...seen.map((a) => a.dist)) : null;
    const blockDist = subjDist != null ? Math.min(T.blockDist, subjDist - 0.5) : T.blockDistEmpty;
    // the ray grid
    let back = 0, near = 0, none = 0, total = 0, subj = 0;
    const cover = new Map();
    const nrm = new THREE.Vector3(), nm = new THREE.Matrix3(), ndc = new THREE.Vector2();
    rc.near = 0; rc.far = T.rayFar;
    let boxes = null, rootBoxes = null;
    const worldBox = (m) => {
      if (m.isInstancedMesh || m.isSkinnedMesh) { m.computeBoundingBox(); return m.boundingBox ? m.boundingBox.clone().applyMatrix4(m.matrixWorld) : null; }
      if (!m.geometry) return null; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    };
    const farHit = (ray) => {
      rootBoxes ??= [...roots].map((r) => new THREE.Box3().setFromObject(r)).filter((b) => !b.isEmpty());
      if (rootBoxes.some((b) => ray.intersectsBox(b))) return "subject";
      boxes ??= meshes.map(worldBox).filter((b) => b && !b.isEmpty());
      return boxes.some((b) => ray.intersectsBox(b)) ? "far" : null;
    };
    const gridT0 = Date.now();
    let far = 0, partial = false;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (total >= 12 && Date.now() - gridT0 > T.rayMs) { partial = true; continue; }
      ndc.set(((i + 0.5) / cols) * 2 - 1, 1 - ((j + 0.5) / rows) * 2);
      rc.setFromCamera(ndc, camera);
      const hit = rc.intersectObjects(meshes, false)[0];
      total++;
      if (!hit) { const fh = farHit(rc.ray); if (fh === "subject") subj++; else if (fh) far++; else none++; continue; }
      if (hit.distance < T.near) near++;
      if (hit.face) {
        nm.getNormalMatrix(hit.object.matrixWorld);
        nrm.copy(hit.face.normal).applyMatrix3(nm).normalize();
        if (nrm.dot(rc.ray.direction) > 0.05) back++;
      }
      if (rootOf(hit.object)) { subj++; continue; }
      if (hit.distance < blockDist) { const k = keyOf(hit.object); cover.set(k, (cover.get(k) ?? 0) + 1); }
    }
    const fwdCam = camera.getWorldDirection(new THREE.Vector3());
    return {
      rays: total, ...(far ? { far: r3(far / total) } : {}), ...(partial ? { partial: true, gridMs: Date.now() - gridT0 } : {}), inside: r3(back / total), near: r3(near / total), sky: r3(none / total), block: r3(Math.max(0, ...cover.values()) / total), blockDist: r3(blockDist),
      pitch: Math.round((Math.asin(Math.max(-1, Math.min(1, fwdCam.y))) * 180) / Math.PI), meshes: meshes.length,
      subject: { focus: shot?.focus ?? null, mode: spec.mode, soft: !!spec.soft, roots: roots.size, rays: r3(subj / total), anchors },
    };
  } finally { for (const [mat, side] of saved) mat.side = side; }
}

/** is the shot's subject on screen (geo.subject): no subject asked, a ray on it, or an anchor in frame and not hidden */
export function subjectSeen(s) {
  if (!s || s.mode === "none") return true;
  if (!s.roots) return !!s.soft;
  return s.rays > 0 || (s.anchors ?? []).some((a) => a.inFrame && !a.hidden);
}

/** the geometry rules -> { fail, warn } */
export function geoReasons(g, shot = null, T = GATE) {
  const fail = [], warn = [];
  if (!g) return { fail, warn };
  const pc = (x) => `${Math.round(x * 100)}%`;
  if (g.inside >= T.insideShare) fail.push({ code: "camera_inside", why: `${pc(g.inside)} of the rays start inside a mesh (back faces first)` });
  else if (g.near >= T.nearShare) fail.push({ code: "camera_inside", why: `${pc(g.near)} of the rays hit a surface closer than ${T.near} m` });
  const s = g.subject ?? { mode: "none" };
  const closeOne = ["closeup", "medium"].includes(shot?.camera) && s.mode === "one";
  if (g.block >= T.blockShare || (closeOne && g.block >= T.blockClose)) fail.push({ code: "blocked", why: `one object covers ${pc(g.block)} of the frame within ${g.blockDist} m (in front of the subject)` });
  const ok = subjectSeen(s);
  if (g.sky >= T.geoSkyShare || (g.sky >= T.geoSkyNoSubject && !ok)) fail.push({ code: "sky_only", why: `${pc(g.sky)} of the rays hit nothing (sky), pitch ${g.pitch} deg` });
  if (!ok) {
    const a = s.anchors ?? [];
    fail.push({ code: "subject_missing", why: `${s.focus}: ${!s.roots ? "not on the set in this shot" : a.map((x) => `${x.id} ${!x.inFrame ? `out of frame ${JSON.stringify(x.ndc)}` : "hidden behind something"}`).join("; ") || "not visible"}` });
  }
  const close = ["closeup", "medium"].includes(shot?.camera);
  const faces = (s.anchors ?? []).filter((a) => a.inFrame && !a.hidden && a.face != null);
  if (close && s.mode === "one" && faces.length && faces.every((x) => x.face < -0.25)) warn.push({ code: "face_hidden", why: `${faces[0].id} faces away (${faces[0].face})` });
  return { fail, warn };
}


/** the gate's verdict for one still */
export function gateStill({ stats = null, geo = null, shot = null } = {}) {
  const pix = pixelReasons(stats), g = geoReasons(geo, shot);
  const reasons = [...pix, ...g.fail];
  return { pass: reasons.length === 0, reasons, warn: g.warn, codes: [...new Set(reasons.map((r) => r.code))] };
}

// ------------------------------------------------------------------------------------------------ in the page
let _grid = null;
/** the GRID-sized RGBA of a canvas (the browser's own downscale, high quality) */
export function gridFromCanvas(canvas, doc = globalThis.document) {
  if (!_grid) { _grid = doc.createElement("canvas"); _grid.width = GRID.w; _grid.height = GRID.h; }
  const ctx = _grid.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, GRID.w, GRID.h);
  ctx.drawImage(canvas, 0, 0, GRID.w, GRID.h);
  return ctx.getImageData(0, 0, GRID.w, GRID.h).data;
}

/** after window.renderAt(t): the pixel stats of the output canvas, the geometry, the verdict (never throws) */
export function measurePage(win, shotIndex) {
  const out = { stats: null, geo: null, verdict: null, error: null };
  try {
    const canvas = win.document.getElementById("out") ?? win.document.querySelector("canvas");
    out.stats = pixelStats(gridFromCanvas(canvas, win.document), GRID.w, GRID.h);
  } catch (e) { out.error = `pixels: ${e.message}`; }
  try {
    const d = win.engineDebug, shot = win.timeline?.shots?.[shotIndex] ?? null;
    if (d?.THREE && d.scene && d.camera) out.geo = measureGeometry(d.THREE, d.scene, d.camera, shot);
  } catch (e) { out.error = `${out.error ? `${out.error}; ` : ""}geometry: ${e.message}`; }
  out.verdict = gateStill({ stats: out.stats, geo: out.geo, shot: win.timeline?.shots?.[shotIndex] ?? null });
  return out;
}
