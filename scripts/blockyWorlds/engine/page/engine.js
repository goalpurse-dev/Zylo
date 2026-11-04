// Blocky Worlds engine: the page that turns a timeline (CONTRACT.md) into frames.
//   /page/index.html?tl=<timeline url>            the real modules (kit, sets, camera, captions)
//   ...&stubs=1                                   every module replaced by its stand-in in /dev/stubs/ (tiny, for tests)
//   ...&stubs=people,captions                     only the named ones replaced (the rest real)
//   ...&nopost=1 / &noao=1                        debug: no post chain / no ambient occlusion
// Exposes window.ready (true when every set, person, prop and texture is loaded and the shaders are warm),
// window.engineError (a message when loading failed), window.renderAt(t) -> { shot, mean } (mean = the 3D frame's
// average brightness 0-255, for the blank-frame guard), window.frameData(q = 0.9) -> JPEG data URL of the output canvas.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { rng } from "/lib/rng.js";
import { makeRenderer, makePost } from "/page/post.js";

const Q = new URLSearchParams(location.search);
const REAL = { people: "/page/kit/people.js", monsters: "/page/kit/monsters.js", props: "/page/kit/props.js", sets: "/page/sets/index.js", camera: "/page/camera.js", captions: "/page/captions.js" };
const STUB = Object.fromEntries(Object.keys(REAL).map((k) => [k, `/dev/stubs/${k}.js`]));
const stubbed = (() => {
  if (!Q.has("stubs")) return new Set();
  const v = Q.get("stubs");
  if (["", "1", "true", "all"].includes(v)) return new Set(Object.keys(REAL));
  return new Set(v.split(",").map((s) => s.trim()).filter(Boolean));
})();

const SPOTS = ["center", "left", "right", "back", "far", "door"];
// extra spots some sets add (sets/*.js): a timeline may use them; a set without one uses "far" (monsters) or "center"
const EXTRA_SPOTS = ["tower", "closet", "bed", "classroom"];
const LIGHTS = ["day", "night", "warm"];
const CAMERAS = ["wide", "medium", "closeup", "low", "over_shoulder", "insert"];
const FACINGS = ["camera", "left", "right", "away", "monster"];
const MONSTER_STATES = ["lurk", "reach", "reveal", "flee"];

async function load(name) {
  const url = stubbed.has(name) ? STUB[name] : REAL[name];
  try { return { mod: await import(url), url }; } catch (e) {
    throw new Error(`engine: cannot load ${url}: ${e.message}${stubbed.has(name) ? "" : ` (not written yet? ?stubs=${name} uses the stand-in)`}`);
  }
}
function need({ mod, url }, name) {
  if (typeof mod[name] !== "function") throw new Error(`engine: ${url} has no exported function ${name}() (CONTRACT.md)`);
  return mod[name];
}

/** every problem in the timeline at once (planner bugs fail here, before a single frame) */
function validate(tl, setNames) {
  const bad = [];
  if (!Array.isArray(tl.shots) || !tl.shots.length) bad.push("no shots");
  if (!(tl.duration > 0)) bad.push("no duration");
  const cast = tl.cast ?? {};
  (tl.shots ?? []).forEach((s, i) => {
    const at = `shot ${i} (${s.start}-${s.end})`;
    if (!(s.end > s.start)) bad.push(`${at}: end <= start`);
    if (i > 0 && Math.abs(s.start - tl.shots[i - 1].end) > 0.002) bad.push(`${at}: does not start where shot ${i - 1} ends (${tl.shots[i - 1].end})`);
    if (setNames && !setNames.includes(s.set)) bad.push(`${at}: unknown set "${s.set}" (${setNames.join(", ")})`);
    if (!LIGHTS.includes(s.light)) bad.push(`${at}: unknown light "${s.light}"`);
    if (!CAMERAS.includes(s.camera)) bad.push(`${at}: unknown camera "${s.camera}"`);
    const ids = (s.actors ?? []).map((a) => a.id);
    for (const a of s.actors ?? []) {
      if (!cast[a.id]) bad.push(`${at}: actor "${a.id}" is not in the cast`);
      if (!SPOTS.includes(a.spot) && !EXTRA_SPOTS.includes(a.spot)) bad.push(`${at}: actor "${a.id}" on unknown spot "${a.spot}"`);
      if (a.facing && !FACINGS.includes(a.facing) && !cast[a.facing]) bad.push(`${at}: actor "${a.id}" facing unknown "${a.facing}"`);
    }
    const f = s.focus;
    if (f === "monster") { if (!tl.monster) bad.push(`${at}: focus "monster" but the timeline has no monster`); }
    else if (f === "insert") { if (!s.insert) bad.push(`${at}: focus "insert" but the shot has no insert`); }
    else if (f === "group") { /* the actors + extras */ }
    else if (!ids.includes(f)) bad.push(`${at}: focus "${f}" is not one of its actors (${ids.join(", ") || "none"})`);
    if (s.monsterState) {
      if (!tl.monster) bad.push(`${at}: monsterState but the timeline has no monster`);
      if (!MONSTER_STATES.includes(s.monsterState.state)) bad.push(`${at}: unknown monster state "${s.monsterState.state}"`);
      if (s.monsterState.spot && !SPOTS.includes(s.monsterState.spot) && !EXTRA_SPOTS.includes(s.monsterState.spot)) bad.push(`${at}: monster on unknown spot "${s.monsterState.spot}"`);
    }
    if (s.marker && s.marker.on !== "all" && !ids.includes(s.marker.on)) bad.push(`${at}: marker on "${s.marker.on}", who is not in the shot`);
  });
  if (bad.length) throw new Error(`engine: the timeline has ${bad.length} problem(s):\n- ${bad.slice(0, 25).join("\n- ")}`);
}

const hz = (v) => new THREE.Vector3(v.x, 0, v.z);
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

async function main() {
  const tlUrl = Q.get("tl");
  if (!tlUrl) throw new Error("engine: no timeline: open /page/index.html?tl=<timeline url>");
  const res = await fetch(tlUrl);
  if (!res.ok) throw new Error(`engine: timeline ${tlUrl}: HTTP ${res.status}`);
  const tl = await res.json();
  const W = tl.width ?? 1080, H = tl.height ?? 1920;

  const [peopleM, monstersM, propsM, setsM, cameraM, captionsM] = await Promise.all(["people", "monsters", "props", "sets", "camera", "captions"].map(load));
  const makePerson = need(peopleM, "makePerson"), posePerson = need(peopleM, "posePerson"), setFace = need(peopleM, "setFace"), personHeight = need(peopleM, "personHeight");
  const makeMonster = tl.monster ? need(monstersM, "makeMonster") : null, animateMonster = tl.monster ? need(monstersM, "animateMonster") : null;
  const anyInsert = tl.shots.some((s) => s.insert), anyMarker = tl.shots.some((s) => s.marker);
  const makeInsert = anyInsert ? need(propsM, "makeInsert") : null, makeMarker = anyMarker ? need(propsM, "makeMarker") : null;
  const animateMarker = typeof propsM.mod.animateMarker === "function" ? propsM.mod.animateMarker : null; // optional
  const buildSet = need(setsM, "buildSet"), applyLight = need(setsM, "applyLight");
  const frameShot = need(cameraM, "frameShot");
  const drawCaption = need(captionsM, "drawCaption");
  validate(tl, Array.isArray(setsM.mod.SETS) ? setsM.mod.SETS : null);

  // ---------- renderer, output canvas, post ----------
  const renderer = makeRenderer(W, H);
  renderer.domElement.id = "gl";
  document.body.appendChild(renderer.domElement);
  const out = document.createElement("canvas"); out.width = W; out.height = H; out.id = "out";
  document.body.appendChild(out);
  const ctx2d = out.getContext("2d");
  const probe = document.createElement("canvas"); probe.width = probe.height = 16;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1500);
  scene.add(camera);
  const post = makePost({ renderer, scene, camera, W, H, query: Q });

  // ---------- loading (tracked so ready waits for every texture and model) ----------
  const LM = THREE.DefaultLoadingManager, loadErrors = [];
  const pending = { total: 0, done: 0 };
  LM.onStart = (u, l, t) => { pending.done = l; pending.total = t; };
  LM.onProgress = (u, l, t) => { pending.done = l; pending.total = t; };
  LM.onError = (u) => loadErrors.push(u);
  const gltfLoader = new GLTFLoader(), texLoader = new THREE.TextureLoader();
  const GLTF = new Map(), TEX = new Map();
  /** a fresh copy of a model's scene (also reachable as .scene, for code that expects the loader's result) */
  const gltf = async (url) => {
    if (!GLTF.has(url)) GLTF.set(url, gltfLoader.loadAsync(url).catch((e) => { throw new Error(`engine: model ${url}: ${e.message}`); }));
    const g = await GLTF.get(url);
    const copy = g.scene.clone(true); copy.scene = copy; copy.animations = g.animations;
    copy.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    return copy;
  };
  /** a Poly Haven texture as in look/scene.js: /assets/<name>/<kind>.jpg, repeat-wrapped; srgb for colour maps */
  const tex = (name, kind, srgb) => {
    const k = `${name}/${kind}`;
    if (!TEX.has(k)) { const t = texLoader.load(`/assets/${name}/${kind}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; TEX.set(k, t); }
    const t = TEX.get(k).clone(); t.needsUpdate = true; return t;
  };

  // ---------- sets ----------
  const SETS = {};
  for (const name of [...new Set(tl.shots.map((s) => s.set))]) {
    const S = await buildSet(name, { THREE, scene, renderer, gltf, tex });
    if (!S?.root?.isObject3D) throw new Error(`engine: buildSet("${name}") returned no root Object3D`);
    const missing = SPOTS.filter((k) => !S.spots?.[k]?.isVector3);
    if (missing.length) throw new Error(`engine: set "${name}" lacks spots ${missing.join(", ")} (THREE.Vector3 each)`);
    if (!S.root.parent) scene.add(S.root);
    S.root.visible = false;
    // the set's depth axis (center -> far) and its lateral axis, for spreading people sideways
    const d = hz(S.spots.far).sub(hz(S.spots.center));
    S.depth = d.lengthSq() > 1e-4 ? d.normalize() : new THREE.Vector3(0, 0, -1);
    S.lateral = new THREE.Vector3(-S.depth.z, 0, S.depth.x);
    SETS[name] = S;
  }

  // ---------- cast, extras, monster, inserts, markers ----------
  const PEOPLE = {};
  const addPerson = (id, spec) => {
    const p = makePerson({ ...spec, id });
    if (!p?.isObject3D) throw new Error(`engine: makePerson("${id}") returned no Object3D`);
    scene.add(p); p.visible = false;
    PEOPLE[id] = { obj: p, h: Number(personHeight(p)) || 1.7 };
  };
  for (const [id, spec] of Object.entries(tl.cast ?? {})) addPerson(id, spec);
  const EXTRAS = [];
  if (tl.shots.some((s) => s.focus === "group")) {
    for (let i = 0; i < 4; i++) { const id = `extra${i}`; addPerson(id, { role: i % 3 === 2 ? "kid" : "adult", name: `Townsfolk ${i + 1}`, seed: 101 + i * 17 }); EXTRAS.push(id); }
  }
  let monster = null, monsterH = 0;
  if (tl.monster) {
    monster = makeMonster(tl.monster);
    if (!monster?.isObject3D) throw new Error("engine: makeMonster returned no Object3D");
    scene.add(monster); monster.visible = false;
    monsterH = Number(monstersM.mod.monsterHeight?.(monster)) || new THREE.Box3().setFromObject(monster).getSize(new THREE.Vector3()).y || 3;
  }
  const INSERTS = new Map(), MARKERS = new Map();
  for (const s of tl.shots) {
    if (s.insert) {
      const k = `${s.insert.kind}|${s.insert.text}`;
      if (!INSERTS.has(k)) {
        const o = makeInsert(s.insert);
        if (!o?.isObject3D) throw new Error(`engine: makeInsert(${JSON.stringify(s.insert)}) returned no Object3D`);
        const box = new THREE.Box3().setFromObject(o);
        scene.add(o); o.visible = false;
        INSERTS.set(k, { obj: o, minY: box.min.y, h: box.max.y - box.min.y || 0.8 });
      }
    }
    if (s.marker) {
      const targets = s.marker.on === "all" ? (s.actors ?? []).map((a) => a.id) : [s.marker.on];
      for (const id of targets) {
        const k = `${id}|${s.marker.kind}|${s.marker.text ?? ""}`;
        if (MARKERS.has(k)) continue;
        const m = makeMarker({ kind: s.marker.kind, text: s.marker.text ?? "" });
        if (!m?.isObject3D) throw new Error(`engine: makeMarker(${JSON.stringify(s.marker)}) returned no Object3D`);
        scene.add(m); m.visible = false; MARKERS.set(k, m);
      }
    }
  }

  // ---------- the caption font ----------
  if (typeof captionsM.mod.loadCaptionFont === "function") await captionsM.mod.loadCaptionFont();
  else { console.warn(`engine: ${captionsM.url} has no loadCaptionFont(); loading "BWCaption" itself`); await document.fonts.load('120px "BWCaption"'); }

  // ---------- wait for every texture / model ----------
  const t0 = performance.now();
  while (pending.done < pending.total && performance.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
  if (pending.done < pending.total) throw new Error(`engine: assets still loading after 120 s (${pending.done}/${pending.total})`);
  if (loadErrors.length) throw new Error(`engine: assets failed to load: ${loadErrors.slice(0, 10).join(", ")}`);

  // ---------- one frame ----------
  let lightKey = null, lightHandle = null;
  const shotIndex = (t) => { let lo = 0, hi = tl.shots.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tl.shots[m].start <= t) lo = m; else hi = m - 1; } return lo; };
  const allPeople = Object.values(PEOPLE);
  const camPos = new THREE.Vector3(), camRight = new THREE.Vector3();

  function renderAt(t) {
    t = Math.max(0, Math.min(Number(t) || 0, tl.duration - 1e-6));
    const si = shotIndex(t), shot = tl.shots[si], lt = t - shot.start, dur = shot.end - shot.start;
    const S = SETS[shot.set], spots = S.spots;
    for (const [n, s] of Object.entries(SETS)) s.root.visible = n === shot.set;
    const key = `${shot.set}|${shot.light}`;
    if (key !== lightKey) {
      lightHandle?.dispose?.();
      lightHandle = applyLight(shot.light, { THREE, scene, renderer, set: S });
      post.setLight(shot.light);
      lightKey = key;
    }
    S.update?.(t);
    for (const p of allPeople) p.obj.visible = false;
    for (const m of MARKERS.values()) m.visible = false;
    for (const i of INSERTS.values()) i.obj.visible = false;

    // people: grouped by spot, spread sideways, then pushed apart so nobody overlaps
    const placed = []; // { id, a (timeline actor or null for extras), pos }
    const bySpot = {};
    for (const a of shot.actors ?? []) (bySpot[a.spot] ??= []).push(a);
    for (const [spot, list] of Object.entries(bySpot)) list.forEach((a, i) => placed.push({ id: a.id, a, pos: (spots[spot] ?? spots.center).clone().addScaledVector(S.lateral, (i - (list.length - 1) / 2) * 0.95).setY((spots[spot] ?? spots.center).y) }));
    if (shot.focus === "group" && EXTRAS.length) {
      const r = rng((shot.seed ?? 1) * 7 + 3), n = 2 + r.int(0, 2), mood = shot.actors?.[0]?.pose;
      for (let i = 0; i < n; i++) {
        const pos = spots.back.clone().addScaledVector(S.lateral, (i - (n - 1) / 2) * 1.15 + r.range(-0.2, 0.2)).addScaledVector(S.depth, r.range(-0.4, 0.4));
        const pose = ["scared", "cheer", "look_up", "run"].includes(mood) ? mood : r.pick(["stand", "talk", "stand", "wave"]);
        placed.push({ id: EXTRAS[i], a: { id: EXTRAS[i], pose, expr: pose === "scared" ? "scared" : r.pick(["neutral", "happy", "smirk"]), facing: "camera", phase: r.range(0, 2) }, pos });
      }
    }
    for (let it = 0; it < 6; it++) for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const A = placed[i].pos, B = placed[j].pos, d = hz(B).sub(hz(A)), L = d.length(), min = 0.85;
      if (L >= min) continue;
      const dir = L > 1e-3 ? d.divideScalar(L) : S.lateral.clone();
      const push = (min - L) / 2; A.addScaledVector(dir, -push); B.addScaledVector(dir, push);
    }
    const where = Object.fromEntries(placed.map((p) => [p.id, p.pos]));

    // monster
    const ms = shot.monsterState ?? (shot.focus === "monster" ? { spot: "far", state: "lurk" } : null);
    if (monster) monster.visible = !!ms;
    if (monster && ms) { monster.position.copy(spots[ms.spot ?? "far"] ?? spots.far); animateMonster(monster, ms.state, lt); }

    // insert: in front of the center spot, toward the camera side, facing it
    let ins = null;
    if (shot.insert) {
      ins = INSERTS.get(`${shot.insert.kind}|${shot.insert.text}`);
      const base = spots.center.clone().addScaledVector(S.depth, -1.4);
      ins.obj.position.copy(base); ins.obj.position.y = base.y + (ins.minY < -0.05 ? 1.3 - (ins.minY + ins.h / 2) : -ins.minY);
      ins.obj.rotation.set(0, Math.atan2(-S.depth.x, -S.depth.z), 0);
      ins.obj.visible = true;
    }

    // the camera
    let focus, focusHeight, other;
    if (shot.focus === "monster") { focus = monster.position.clone(); focusHeight = monsterH; other = placed[0]?.pos; }
    else if (shot.focus === "insert") { focus = ins.obj.position.clone().setY(ins.obj.position.y + ins.minY); focusHeight = ins.h; }
    else if (shot.focus === "group") {
      const g = placed.length ? placed : [{ pos: spots.center, id: null }];
      focus = g.reduce((s, p) => s.add(p.pos), new THREE.Vector3()).divideScalar(g.length);
      focusHeight = Math.max(...g.map((p) => PEOPLE[p.id]?.h ?? 1.7));
    } else {
      focus = where[shot.focus].clone(); focusHeight = PEOPLE[shot.focus].h;
      other = placed.find((p) => p.id !== shot.focus)?.pos ?? (monster?.visible ? monster.position : undefined);
    }
    frameShot(shot.camera, { THREE, camera, set: S, focus, focusHeight, other: other?.clone(), t: lt, dur, seed: shot.seed ?? si });
    camera.updateMatrixWorld();
    camera.getWorldPosition(camPos);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    if (monster?.visible) monster.rotation.y = yawTo(monster.position, camPos) + (ms.state === "flee" ? Math.PI : 0);

    // people: facing, pose, face, markers
    for (const p of placed) {
      const P = PEOPLE[p.id], o = P.obj, a = p.a;
      o.visible = true; o.position.copy(p.pos);
      const f = a.facing ?? "camera";
      let yaw;
      if (f === "left") yaw = Math.atan2(-camRight.x, -camRight.z);
      else if (f === "right") yaw = Math.atan2(camRight.x, camRight.z);
      else if (f === "away") yaw = yawTo(p.pos, camPos) + Math.PI;
      else if (f === "monster") yaw = yawTo(p.pos, monster?.visible ? monster.position : spots.far);
      else if (f !== "camera" && where[f] && f !== p.id) yaw = yawTo(p.pos, where[f]);
      else yaw = yawTo(p.pos, camPos);
      o.rotation.set(0, yaw, 0);
      posePerson(o, a.pose ?? "stand", lt + (a.phase ?? 0), { hold: a.hold ?? null });
      setFace(o, a.expr ?? "neutral");
    }
    if (shot.marker) {
      const targets = shot.marker.on === "all" ? (shot.actors ?? []).map((a) => a.id) : [shot.marker.on];
      for (const id of targets) {
        const m = MARKERS.get(`${id}|${shot.marker.kind}|${shot.marker.text ?? ""}`);
        if (!m || !where[id]) continue;
        m.visible = true; m.position.copy(where[id]); m.position.y += PEOPLE[id].h + 0.15; // the marker's origin is its bottom (kit/props.js)
        m.rotation.set(0, 0, 0);
        animateMarker?.(m, lt);
        if (m.userData.billboard) m.quaternion.copy(camera.quaternion);
        m.traverse((c) => { if (c !== m && c.userData.billboard) c.quaternion.copy(camera.quaternion); });
      }
    }

    // render, then the caption on top in the output canvas
    post.render();
    ctx2d.drawImage(renderer.domElement, 0, 0);
    probeCtx.drawImage(out, 0, 0, 16, 16);
    const px = probeCtx.getImageData(0, 0, 16, 16).data;
    let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    ctx2d.save(); drawCaption(ctx2d, tl.captions ?? [], t); ctx2d.restore();
    return { shot: si, mean: +(sum / (3 * 256)).toFixed(1) };
  }

  // warm-up: the first frame of every (set, light) pair compiles its shaders and shadow maps (and fails here, loudly)
  const seen = new Set();
  for (const s of tl.shots) { const k = `${s.set}|${s.light}`; if (!seen.has(k)) { seen.add(k); renderAt(s.start); renderAt(s.start); } }
  renderAt(0);

  window.timeline = tl;
  window.renderAt = renderAt;
  window.frameData = (q = 0.9) => out.toDataURL("image/jpeg", q);
  window.engineInfo = { stubs: [...stubbed], sets: Object.keys(SETS), people: Object.keys(PEOPLE), renderer: (() => { const gl = renderer.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })() };
  window.ready = true;
}

main().catch((e) => { window.engineError = String(e?.stack ?? e); console.error(window.engineError); });
