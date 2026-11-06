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
const INSERT_KINDS = ["sign", "note", "card"];
const WINDOWS = ["dark", "lit", "open"];
const OBJ_FACINGS = ["camera", "left", "right", "away"];

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

/** a shot's markers: shot.markers (a list) or the single shot.marker; duplicates of the same marker dropped */
function markersOf(s) {
  const list = Array.isArray(s.markers) && s.markers.length ? [...s.markers] : [];
  if (s.marker && !list.some((m) => m.on === s.marker.on && m.kind === s.marker.kind && m.text === s.marker.text)) list.unshift(s.marker);
  return list.filter(Boolean);
}
/** who a marker floats over: "all" = every actor of the shot, "monster", or one cast id */
const markerTargets = (mk, s) => (mk.on === "all" ? (s.actors ?? []).map((a) => a.id) : [mk.on]);

/** a baby's cast id when actor `a` carries one (pose carry + hold = the baby's cast id) */
const carriedBaby = (a, cast) => (a.hold && cast[a.hold]?.role === "baby" ? a.hold : null);

/**
 * every problem in the timeline at once (planner bugs fail here, before a single frame).
 * lists: { setNames, poses, exprs, objects: { resolve(name) -> canonical | null, catalog } } (each optional)
 */
function validate(tl, { setNames = null, poses = null, exprs = null, objects = null, epic = null } = {}) {
  const bad = [];
  if (!Array.isArray(tl.shots) || !tl.shots.length) bad.push("no shots");
  if (!(tl.duration > 0)) bad.push("no duration");
  const cast = tl.cast ?? {};
  for (const [id, c] of Object.entries(cast)) if (c.role && !["kid", "adult", "elder", "baby"].includes(c.role)) bad.push(`cast "${id}": unknown role "${c.role}" (kid, adult, elder, baby)`);
  (tl.shots ?? []).forEach((s, i) => {
    const at = `shot ${i} (${s.start}-${s.end})`;
    if (!(s.end > s.start)) bad.push(`${at}: end <= start`);
    if (i > 0 && Math.abs(s.start - tl.shots[i - 1].end) > 0.002) bad.push(`${at}: does not start where shot ${i - 1} ends (${tl.shots[i - 1].end})`);
    const worldId = /^world:/.test(s.set ?? "") ? s.set.slice(6) : null;
    if (worldId) { if (tl.assets?.[worldId]?.kind !== "world" || !tl.assets[worldId].spec) bad.push(`${at}: built world "${worldId}" is not in timeline.assets`); }
    else if (epic && /^creature:/.test(s.set ?? "")) { /* EPIC: a creature world (tl.worlds), checked by epic.problems() */ }
    else if (setNames && !setNames.includes(s.set)) bad.push(`${at}: unknown set "${s.set}" (${setNames.join(", ")})`);
    if (!LIGHTS.includes(s.light)) bad.push(`${at}: unknown light "${s.light}"`);
    if (!CAMERAS.includes(s.camera) && !epic?.cameras.includes(s.camera)) bad.push(`${at}: unknown camera "${s.camera}"`);
    const ids = (s.actors ?? []).map((a) => a.id);
    const carried = (s.actors ?? []).map((a) => carriedBaby(a, cast)).filter(Boolean);
    for (const a of s.actors ?? []) {
      if (!cast[a.id]) bad.push(`${at}: actor "${a.id}" is not in the cast`);
      if (!SPOTS.includes(a.spot) && !EXTRA_SPOTS.includes(a.spot) && !epic?.spots.includes(a.spot)) bad.push(`${at}: actor "${a.id}" on unknown spot "${a.spot}"`);
      if (a.facing && !FACINGS.includes(a.facing) && !cast[a.facing] && !tl.giants?.[a.facing]) bad.push(`${at}: actor "${a.id}" facing unknown "${a.facing}"`);
      if (poses && a.pose && !poses.includes(a.pose)) bad.push(`${at}: actor "${a.id}" has unknown pose "${a.pose}" (${poses.join(", ")})`);
      if (exprs && a.expr && !exprs.includes(a.expr)) bad.push(`${at}: actor "${a.id}" has unknown expr "${a.expr}" (${exprs.join(", ")})`);
      if (a.hold && cast[a.hold] && cast[a.hold].role !== "baby") bad.push(`${at}: actor "${a.id}" holds cast member "${a.hold}", who is not a baby (only babies can be carried)`);
      if (carriedBaby(a, cast) === a.id) bad.push(`${at}: actor "${a.id}" carries itself`);
    }
    const objs = s.objects ?? [];
    if (!Array.isArray(objs)) bad.push(`${at}: objects must be a list`);
    else for (const o of objs) {
      if (o?.asset) { // built for this video (lib/builder): a block blueprint in timeline.assets
        if (tl.assets?.[o.asset]?.kind !== "object" || !tl.assets[o.asset].blueprint) bad.push(`${at}: built object "${o.asset}" is not in timeline.assets`);
        if (o.spot && !SPOTS.includes(o.spot) && !EXTRA_SPOTS.includes(o.spot)) bad.push(`${at}: object "${o.name}" on unknown spot "${o.spot}"`);
        continue;
      }
      if (!objects) { bad.push(`${at}: objects given but page/kit/objects.js is not loaded`); break; }
      const key = objects.resolve(o?.name);
      if (!key) { bad.push(`${at}: unknown object "${o?.name}" (${Object.keys(objects.catalog).join(", ")})`); continue; }
      const st = o.state ?? objects.catalog[key].state;
      if (!objects.catalog[key].states.includes(st)) bad.push(`${at}: object "${key}" has no state "${st}" (${objects.catalog[key].states.join(", ")})`);
      if (o.spot && !SPOTS.includes(o.spot) && !EXTRA_SPOTS.includes(o.spot)) bad.push(`${at}: object "${key}" on unknown spot "${o.spot}"`);
      if (o.facing && !OBJ_FACINGS.includes(o.facing)) bad.push(`${at}: object "${key}" facing unknown "${o.facing}" (${OBJ_FACINGS.join(", ")})`);
    }
    if (s.insert && !INSERT_KINDS.includes(s.insert.kind ?? "sign")) bad.push(`${at}: unknown insert kind "${s.insert.kind}" (${INSERT_KINDS.join(", ")})`);
    if (s.setState?.windows != null && !WINDOWS.includes(s.setState.windows)) bad.push(`${at}: unknown setState.windows "${s.setState.windows}" (${WINDOWS.join(", ")})`);
    const f = s.focus;
    if (f === "monster") { if (!tl.monster) bad.push(`${at}: focus "monster" but the timeline has no monster`); }
    else if (f === "insert") { if (!s.insert) bad.push(`${at}: focus "insert" but the shot has no insert`); }
    else if (f === "object") { if (!objs.length) bad.push(`${at}: focus "object" but the shot has no objects`); }
    else if (f === "group") { /* the actors + extras */ }
    else if (epic && (/^(giant:|crowd)/.test(String(f)) || f === "world")) { /* EPIC focus */ }
    else if (!ids.includes(f) && !carried.includes(f)) bad.push(`${at}: focus "${f}" is not one of its actors (${ids.join(", ") || "none"})`);
    if (s.monsterState) {
      if (!tl.monster) bad.push(`${at}: monsterState but the timeline has no monster`);
      if (!MONSTER_STATES.includes(s.monsterState.state)) bad.push(`${at}: unknown monster state "${s.monsterState.state}"`);
      if (s.monsterState.spot && !SPOTS.includes(s.monsterState.spot) && !EXTRA_SPOTS.includes(s.monsterState.spot)) bad.push(`${at}: monster on unknown spot "${s.monsterState.spot}"`);
    }
    for (const mk of markersOf(s)) {
      if (mk.on === "monster") { if (!tl.monster) bad.push(`${at}: marker on "monster" but the timeline has no monster`); }
      else if (mk.on !== "all" && !ids.includes(mk.on) && !carried.includes(mk.on)) bad.push(`${at}: marker on "${mk.on}", who is not in the shot`);
      if (mk.kind && !["tag", "ring", "icon"].includes(mk.kind)) bad.push(`${at}: unknown marker kind "${mk.kind}" (tag, ring, icon)`);
    }
  });
  if (epic) bad.push(...epic.problems());
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
  const anyInsert = tl.shots.some((s) => s.insert), anyMarker = tl.shots.some((s) => markersOf(s).length);
  const makeInsert = anyInsert ? need(propsM, "makeInsert") : null, makeMarker = anyMarker ? need(propsM, "makeMarker") : null;
  const animateMarker = typeof propsM.mod.animateMarker === "function" ? propsM.mod.animateMarker : null; // optional
  const buildSet = need(setsM, "buildSet"), applyLight = need(setsM, "applyLight");
  const frameShot = need(cameraM, "frameShot");
  const drawCaption = need(captionsM, "drawCaption");
  const holdPerson = typeof peopleM.mod.holdPerson === "function" ? peopleM.mod.holdPerson : null; // optional (babies)
  const releasePerson = typeof peopleM.mod.releasePerson === "function" ? peopleM.mod.releasePerson : null;
  const POSE_LIFT = peopleM.mod.POSE_LIFT ?? {}, POSE_FRAME = peopleM.mod.POSE_FRAME ?? {}; // how high a pose lifts a person (fly, climb): the camera follows
  // scene objects (kit/objects.js): loaded only when the timeline uses them
  const anyObjects = tl.shots.some((s) => (s.objects ?? []).some((o) => !o.asset));
  // built objects / worlds (lib/builder -> timeline.assets): page/kit/blueprint.js, page/sets/worldspec.js
  const blueprintM = tl.shots.some((s) => (s.objects ?? []).some((o) => o.asset)) ? await import("/page/kit/blueprint.js") : null;
  const worldM = tl.shots.some((s) => /^world:/.test(s.set ?? "")) ? await import("/page/sets/worldspec.js") : null;
  // EPIC stories (giants, crowds, creature worlds, scale cameras, beats): page/epicLayer.js, loaded only when used
  const epicM = (tl.giants || tl.worlds || tl.shots.some((s) => s.giants?.length || s.crowds?.length || s.world || s.beat || /^creature:/.test(s.set ?? "") || ["establish", "hero_low", "track", "aerial", "giant_close", "duel", "behind_army"].includes(s.camera))) ? await import("/page/epicLayer.js") : null;
  let objectsM = null;
  if (anyObjects) {
    try { objectsM = await import("/page/kit/objects.js"); } catch (e) { throw new Error(`engine: cannot load /page/kit/objects.js: ${e.message}`); }
    for (const k of ["OBJECTS", "makeObject", "animateObject", "resolveObject"]) if (!(k in objectsM)) throw new Error(`engine: /page/kit/objects.js has no export ${k} (CONTRACT.md addendum)`);
  }
  const realPeople = !stubbed.has("people");
  validate(tl, {
    setNames: Array.isArray(setsM.mod.SETS) ? setsM.mod.SETS : null,
    poses: realPeople && Array.isArray(peopleM.mod.POSES) ? peopleM.mod.POSES : null,
    exprs: realPeople && Array.isArray(peopleM.mod.EXPRS) ? peopleM.mod.EXPRS : null,
    objects: objectsM ? { resolve: objectsM.resolveObject, catalog: objectsM.OBJECTS } : null,
    epic: epicM ? { cameras: epicM.EPIC_CAMERA_TYPES, spots: epicM.EPIC_SPOTS, problems: () => [] } : null,
  });

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
  const epic = epicM ? await epicM.makeEpicLayer({ THREE, scene, tl, ctx: { THREE, scene, renderer, gltf, tex } }) : null;
  if (epic) { const p = epic.problems(); if (p.length) throw new Error(`engine: the timeline has ${p.length} EPIC problem(s):\n- ${p.slice(0, 25).join("\n- ")}`); }
  for (const name of [...new Set(tl.shots.map((s) => s.set))]) {
    const S = /^world:/.test(name) ? await worldM.buildWorld(tl.assets[name.slice(6)].spec, { THREE, scene, renderer, gltf, tex, ...(epic ? { buildCreatureWorld: epic.buildCreatureWorld } : {}) })
      : epic && /^creature:/.test(name) ? await epic.buildSet(name) : await buildSet(name, { THREE, scene, renderer, gltf, tex });
    if (S?.problems?.length) console.warn(`engine: built world ${name}: ${S.problems.slice(0, 8).join("; ")}`);
    S.blockers ??= [];
    if (!S?.root?.isObject3D) throw new Error(`engine: buildSet("${name}") returned no root Object3D`);
    const missing = SPOTS.filter((k) => !S.spots?.[k]?.isVector3);
    if (missing.length) throw new Error(`engine: set "${name}" lacks spots ${missing.join(", ")} (THREE.Vector3 each)`);
    if (!S.root.parent) scene.add(S.root);
    S.root.visible = false;
    // the set's depth axis (center -> far) and its lateral axis, for spreading people sideways
    const d = hz(S.spots.far).sub(hz(S.spots.center));
    S.depth = d.lengthSq() > 1e-4 ? d.normalize() : new THREE.Vector3(0, 0, -1);
    S.lateral = new THREE.Vector3(-S.depth.z, 0, S.depth.x);
    S.setWindows ??= () => {}; // only the street has houses with windows
    SETS[name] = S;
  }

  // ---------- cast, extras, monster, inserts, markers ----------
  const PEOPLE = {};
  const addPerson = (id, spec) => {
    const p = makePerson({ ...spec, id });
    if (!p?.isObject3D) throw new Error(`engine: makePerson("${id}") returned no Object3D`);
    scene.add(p); p.visible = false;
    const h = Number(personHeight(p)) || 1.7;
    // the head (with hair / hat) at rest: its centre height above the feet and its radius, for the camera's head guard
    let headC = h * 0.88, headR = Math.max(0.12, h * 0.12);
    const hj = p.userData?.joints?.head;
    if (hj) {
      p.updateMatrixWorld(true);
      const hb = new THREE.Box3().setFromObject(hj), size = hb.getSize(new THREE.Vector3());
      if (!hb.isEmpty() && size.y > 0.02) { headC = hb.getCenter(new THREE.Vector3()).y - p.position.y; headR = Math.max(size.x, size.y, size.z) / 2; }
    }
    PEOPLE[id] = { obj: p, h, headC, headR };
  };
  // the planner's gender (visualWorld.gender: Mrs. / Ms. / Grandma / she = f) shapes the look (run 7b4c0d8b: a bearded Mrs. Oddy)
  for (const [id, spec] of Object.entries(tl.cast ?? {})) addPerson(id, { ...spec, gender: spec.gender ?? tl.visualWorld?.gender?.[id] ?? null });
  const EXTRAS = [];
  if (tl.shots.some((s) => s.focus === "group")) {
    for (let i = 0; i < 4; i++) { const id = `extra${i}`; addPerson(id, { role: i % 3 === 2 ? "kid" : "adult", name: `Townsfolk ${i + 1}`, seed: 101 + i * 17 }); EXTRAS.push(id); }
  }
  let monster = null, monsterH = 0, monsterR = 0;
  if (tl.monster) {
    monster = makeMonster(tl.monster);
    if (!monster?.isObject3D) throw new Error("engine: makeMonster returned no Object3D");
    scene.add(monster); monster.visible = false;
    monsterH = Number(monstersM.mod.monsterHeight?.(monster)) || new THREE.Box3().setFromObject(monster).getSize(new THREE.Vector3()).y || 3;
    { const sz = new THREE.Box3().setFromObject(monster).getSize(new THREE.Vector3()); monsterR = Math.max(0.4, Math.max(sz.x, sz.z) / 2); }
  }
  const INSERTS = new Map(), MARKERS = new Map();
  for (const s of tl.shots) {
    if (s.insert) {
      const k = `${s.insert.kind}|${s.insert.text}|${s.insert.icon ?? ""}`;
      if (!INSERTS.has(k)) {
        const o = makeInsert(s.insert);
        if (!o?.isObject3D) throw new Error(`engine: makeInsert(${JSON.stringify(s.insert)}) returned no Object3D`);
        const box = new THREE.Box3().setFromObject(o);
        scene.add(o); o.visible = false;
        INSERTS.set(k, { obj: o, minY: box.min.y, h: box.max.y - box.min.y || 0.8 });
      }
    }
    for (const mk of markersOf(s)) {
      for (const id of markerTargets(mk, s)) {
        const k = `${id}|${mk.kind}|${mk.text ?? ""}`;
        if (MARKERS.has(k)) continue;
        const m = makeMarker({ kind: mk.kind, text: mk.text ?? "" });
        if (!m?.isObject3D) throw new Error(`engine: makeMarker(${JSON.stringify(mk)}) returned no Object3D`);
        scene.add(m); m.visible = false; MARKERS.set(k, m);
      }
    }
  }

  // ---------- scene objects: one instance per (name, state) per use in a shot (a shot may hold three cribs) ----------
  const OBJ = new Map(); // "name|state" -> [Group]
  const objKey = (o) => { if (o.asset) return `asset:${o.asset}|${o.state ?? "on"}`; const k = objectsM.resolveObject(o.name); return `${k}|${o.state ?? objectsM.OBJECTS[k].state}`; };
  if (objectsM || blueprintM) {
    const counts = new Map();
    for (const s of tl.shots) { const c = new Map(); for (const o of s.objects ?? []) { const k = objKey(o); c.set(k, (c.get(k) ?? 0) + 1); } for (const [k, n] of c) counts.set(k, Math.max(counts.get(k) ?? 0, n)); }
    for (const [k, n] of counts) {
      const [name, state] = k.split("|"), list = [];
      for (let i = 0; i < n; i++) {
        const o = name.startsWith("asset:") ? blueprintM.buildBlueprint(tl.assets[name.slice(6)].blueprint) : objectsM.makeObject(name, { state });
        if (o?.userData?.problems?.length) console.warn(`engine: built object ${name}: ${o.userData.problems.slice(0, 8).join("; ")}`);
        if (!o?.isObject3D) throw new Error(`engine: makeObject("${name}", ${state}) returned no Object3D`);
        scene.add(o); o.visible = false; list.push(o);
      }
      OBJ.set(k, list);
    }
  }
  const allObjects = [...OBJ.values()].flat();
  const HATS = new Map(); // person id -> party hat (birthday_party shots)

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

  // ---------- the head guard (2026-11-04: a paid frame that was mostly the back of a head) ----------
  // After frameShot places the camera: if a non-focus person's head is within ~1.1 m of the lens, fills more than ~20 %
  // of the frame, or covers the focus' head (at the shot's start, middle or end), the camera is nudged back / up /
  // sideways (away from that head) in fixed steps until clear. One nudge per shot (no jump inside a shot), cached;
  // deterministic: it depends only on the shot.
  const NUDGE = new Map();
  const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _c = new THREE.Vector3();
  const headY = (p) => { const P = PEOPLE[p.id]; const pose = p.a?.pose; return P.headC * (pose === "sit" ? 0.68 : pose === "sleep" ? 0.3 : 1); };
  /** how badly the current camera is blocked: { score (0 = clear), x (ndc x of the worst head) } */
  function headScore(heads, fh) {
    camera.getWorldPosition(_c);
    camera.getWorldDirection(_f);
    const tanY = Math.tan((camera.fov * Math.PI) / 360);
    let worst = 0, wx = 0;
    const fp = fh ? fh.clone().project(camera) : null, fd = fh ? _v.copy(fh).sub(_c).dot(_f) : 0;
    for (const h of heads) {
      _v.copy(h.c).sub(_c);
      const depth = _v.dot(_f), d = _v.length();
      if (depth <= 0.05) continue;
      const q = h.c.clone().project(camera);
      const rY = h.r / (depth * tanY), rX = rY / camera.aspect;
      const w = Math.max(0, Math.min(1, q.x + rX) - Math.max(-1, q.x - rX)), hh = Math.max(0, Math.min(1, q.y + rY) - Math.max(-1, q.y - rY));
      const area = (w * hh) / 4;
      if (area <= 0) continue;
      let s = 0;
      if (d < 1.1) s += 1 + (1.1 - d);
      if (area > 0.2) s += area;
      if (fp && fd > depth && Math.abs(fp.x - q.x) < rX * 1.05 && Math.abs(fp.y - q.y) < rY * 1.05) s += 1;
      if (s > worst) { worst = s; wx = q.x; }
    }
    return { score: worst, x: wx };
  }
  function guardNudge(si, shot, camType, fctx, placed, where, carried) {
    if (NUDGE.has(si)) return NUDGE.get(si);
    const focusIds = new Set(shot.focus === "group" ? placed.map((p) => p.id) : [shot.focus]);
    const carrier = carried.get(shot.focus); if (carrier) focusIds.add(carrier.id);
    const heads = placed.filter((p) => !focusIds.has(p.id) && PEOPLE[p.id]).map((p) => ({ id: p.id, c: p.pos.clone().setY(p.pos.y + headY(p)), r: PEOPLE[p.id].headR }));
    let best = null;
    if (heads.length) {
      const fid = carrier ? carrier.id : shot.focus;
      const fh = shot.focus === "monster" && monster ? monster.position.clone().setY(monster.position.y + monsterH * 0.9)
        : where[fid] && PEOPLE[fid] ? where[fid].clone().setY(where[fid].y + PEOPLE[fid].headC) : null;
      const ts = [0, fctx.dur / 2, Math.max(0, fctx.dur - 1e-3)];
      const evalN = (nudge) => {
        let worst = 0, side = 0;
        for (const t of ts) { frameShot(camType, { ...fctx, other: fctx.other?.clone(), t, nudge }); camera.updateMatrixWorld(); const r = headScore(heads, fh); if (r.score > worst) { worst = r.score; side = r.x; } }
        return { worst, side };
      };
      const base = evalN(null);
      if (base.worst > 0) {
        const sgn = base.side > 0 ? -1 : 1;   // move the camera away from the head's side: the head slides to the frame edge
        let bestScore = base.worst;
        for (let i = 1; i <= 14; i++) {
          const n = { back: 0.25 * i, up: 0.07 * i, lat: sgn * 0.12 * i };
          const r = evalN(n);
          if (r.worst < bestScore - 1e-6) { bestScore = r.worst; best = n; }
          if (r.worst === 0) break;
        }
        console.log(`engine: head guard, shot ${si}: ${base.worst.toFixed(2)} -> ${bestScore.toFixed(2)}${best ? ` (back ${best.back.toFixed(2)}, up ${best.up.toFixed(2)}, side ${best.lat.toFixed(2)})` : ""}`);
      }
    }
    NUDGE.set(si, best);
    return best;
  }
  window.headGuard = NUDGE;

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
    S.update?.(t, lt);   // lt: the time inside the shot (a walking giant starts every shot in frame)
    for (const p of allPeople) { if (p.obj.userData.carriedBy) releasePerson?.(p.obj, scene); p.obj.visible = false; }
    for (const m of MARKERS.values()) m.visible = false;
    for (const i of INSERTS.values()) i.obj.visible = false;
    for (const o of allObjects) o.visible = false;
    for (const h of HATS.values()) h.visible = false;
    S.setWindows(shot.setState?.windows ?? null);

    // scene objects: at their spots, facing the camera side; big ones behind everybody, others behind the actors who
    // share their spot (or the actors go behind / beside / onto them: userData.actors in kit/objects.js)
    const cast = tl.cast ?? {};
    const carried = new Map(); // baby id -> carrier actor
    for (const a of shot.actors ?? []) { const b = carriedBaby(a, cast); if (b) carried.set(b, a); }
    const free = (shot.actors ?? []).filter((a) => !carried.has(a.id));
    const shotObjs = [], spotRule = {}, used = new Map();
    const faceYaw = Math.atan2(-S.depth.x, -S.depth.z);
    let anyBig = false;
    for (const o of shot.objects ?? []) {
      const k = objKey(o), n = used.get(k) ?? 0; used.set(k, n + 1);
      const obj = OBJ.get(k)[n], u = obj.userData, spot = o.spot ?? "center", base = spots[spot] ?? spots.center;
      const here = free.filter((a) => a.spot === spot);
      const mode = u.actors ?? "front";
      const pos = base.clone();
      // pushed back behind the actors: always for big ones, and for small ones when somebody shares the spot or would
      // stand inside it (a car at "right" next to people at "center")
      const crowded = mode === "front" && free.some((a) => { const p = spots[a.spot] ?? spots.center; return Math.abs(hz(p).sub(hz(base)).dot(S.lateral)) < (u.width ?? 1) / 2 + 0.4 && Math.abs(hz(p).sub(hz(base)).dot(S.depth)) < (u.depth ?? 1) + 0.4; });
      if (mode === "front" && (u.big || here.length || crowded)) pos.addScaledVector(S.depth, (u.push ?? 0.8) + (crowded && !here.length && !u.big ? 0.4 : 0));
      obj.position.copy(pos);
      obj.rotation.set(0, faceYaw + ({ left: -0.6, right: 0.6, away: Math.PI }[o.facing] ?? 0), 0);
      obj.visible = true; obj.updateMatrixWorld(true);
      if (u.kind === "blueprint") blueprintM.animateBlueprint(obj, lt, o.state ?? null);
      else objectsM.animateObject(obj, o.state ?? u.state, lt);
      if (u.big) anyBig = true;
      shotObjs.push({ o, obj, u });
      if (mode !== "front" && !spotRule[spot]) spotRule[spot] = { obj, u, mode };
    }
    S.setClutter?.(!anyBig && !shot.setState?.windows); // the bus shelter etc. step aside for big objects and window shots

    // people: grouped by spot, spread sideways, then pushed apart so nobody overlaps (people in / on an object stay put)
    const placed = []; // { id, a (timeline actor or null for extras), pos, fixed, opts }
    const bySpot = {};
    for (const a of free) (bySpot[a.spot] ??= []).push(a);
    for (const [spot, list] of Object.entries(bySpot)) {
      const base = spots[spot] ?? spots.center, rule = spotRule[spot];
      if (!rule) { list.forEach((a, i) => placed.push({ id: a.id, a, pos: base.clone().addScaledVector(S.lateral, (i - (list.length - 1) / 2) * 0.95).setY(base.y) })); continue; }
      const { obj, u, mode } = rule, fwd = new THREE.Vector3(Math.sin(obj.rotation.y), 0, Math.cos(obj.rotation.y));
      const side = []; // actors that stand beside the object
      list.forEach((a, i) => {
        if (mode === "behind") placed.push({ id: a.id, a, pos: base.clone().addScaledVector(S.lateral, (i - (list.length - 1) / 2) * 0.95).addScaledVector(S.depth, u.actorsBack ?? 1.2).setY(base.y) });
        else if (mode === "bed" && cast[a.id]?.role === "baby" && !placed.some((p) => p.inBed === obj)) {
          const p = obj.localToWorld(u.bed.clone()); p.y = base.y + u.bedH;
          placed.push({ id: a.id, a, pos: p, fixed: true, inBed: obj });
        } else if (mode === "seat" && !placed.some((p) => p.onSeat === obj)) {
          const p = obj.localToWorld(u.seat.clone()); p.y = base.y;
          const sc = PEOPLE[a.id].obj.userData.scale ?? 0.87;
          if ((a.pose ?? "stand") === "sit") placed.push({ id: a.id, a, pos: p.addScaledVector(fwd, 0.38 * sc), fixed: true, onSeat: obj, opts: { seat: u.seatH } });
          else placed.push({ id: a.id, a, pos: p.addScaledVector(fwd, 0.45), fixed: true, onSeat: obj });
        } else side.push(a);
      });
      const half = (u.width ?? 1) / 2 + 0.45;
      side.forEach((a, i) => { const s = i % 2 ? 1 : -1, k = Math.floor(i / 2); placed.push({ id: a.id, a, pos: base.clone().addScaledVector(S.lateral, s * (half + k * 0.9)).addScaledVector(fwd, 0.15).setY(base.y) }); });
    }
    if (shot.focus === "group" && EXTRAS.length) {
      const r = rng((shot.seed ?? 1) * 7 + 3), n = 2 + r.int(0, 2), mood = shot.actors?.[0]?.pose;
      for (let i = 0; i < n; i++) {
        const pos = spots.back.clone().addScaledVector(S.lateral, (i - (n - 1) / 2) * 1.15 + r.range(-0.2, 0.2)).addScaledVector(S.depth, r.range(-0.4, 0.4));
        const pose = ["scared", "cheer", "look_up", "run"].includes(mood) ? mood : r.pick(["stand", "talk", "stand", "wave"]);
        placed.push({ id: EXTRAS[i], a: { id: EXTRAS[i], pose, expr: pose === "scared" ? "scared" : r.pick(["neutral", "happy", "smirk"]), facing: "camera", phase: r.range(0, 2) }, pos });
      }
    }
    // 2026-11-05 (GAPS): actions that place people relative to someone / something
    //   hug: two people both posed "hug" stand face to face, close (their arms round each other), side-on to the lens
    //   ride: the rider sits on the shot's mount (the object at their spot, else an animal / vehicle / built thing in the
    //         shot): the saddle found by a ray down onto it, the rider along its heading (userData.ride); none -> walk
    //   hide: half behind the nearest object of the shot (its side away from the middle), crouched
    {
      const huggers = placed.filter((p) => p.a?.pose === "hug" && !p.fixed && PEOPLE[p.id]);
      for (const h of huggers) {
        if (h.hugWith) continue;
        const q = huggers.find((x) => x !== h && !x.hugWith && (h.a.facing === x.id || x.a.facing === h.id)) ?? huggers.find((x) => x !== h && !x.hugWith);
        if (!q) continue;
        const sa = PEOPLE[h.id].obj.userData.scale ?? 0.87, sb = PEOPLE[q.id].obj.userData.scale ?? 0.87;
        const d = 0.2 + 0.32 * (sa + sb) / 2, mid = h.pos.clone().add(q.pos).multiplyScalar(0.5);
        h.pos.copy(mid).addScaledVector(S.lateral, -d / 2); q.pos.copy(mid).addScaledVector(S.lateral, d / 2);
        h.fixed = q.fixed = true; h.hugWith = q.id; q.hugWith = h.id;
      }
      for (const p of placed) {
        if (p.a?.pose !== "ride" || p.fixed) continue;
        const pick = shotObjs.find((x) => (x.o.spot ?? "center") === p.a.spot && !x.ridden) ?? shotObjs.find((x) => !x.ridden && (x.u.animal || x.u.ride || x.u.kind === "blueprint" || x.u.vehicle)) ?? shotObjs.find((x) => !x.ridden);
        if (!pick) { p.noMount = true; continue; }
        pick.ridden = true;
        const { obj, u } = pick;
        obj.updateMatrixWorld(true);
        const at = u.ride?.at ? obj.localToWorld(u.ride.at.clone()) : new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
        const box = new THREE.Box3().setFromObject(obj);
        const rc = new THREE.Raycaster(new THREE.Vector3(at.x, box.max.y + 1, at.z), new THREE.Vector3(0, -1, 0), 0, box.max.y - box.min.y + 2);
        const hit = rc.intersectObject(obj, true).find((x) => x.object.visible !== false && x.object.isMesh);
        p.pos.set(at.x, hit ? hit.point.y : box.max.y, at.z);
        p.fixed = true; p.rideYaw = obj.rotation.y + (u.ride?.yaw ?? 0); p.mount = pick;
      }
      for (const p of placed) { // push: right up against the thing pushed, leaning into it
        if (p.a?.pose !== "push" || p.fixed || !shotObjs.length) continue;
        const near = shotObjs.reduce((b, x) => (x.obj.position.distanceTo(p.pos) < b.obj.position.distanceTo(p.pos) ? x : b), shotObjs[0]);
        const off = hz(p.pos).sub(hz(near.obj.position)).dot(S.lateral) >= 0 ? 1 : -1;
        const c = new THREE.Box3().setFromObject(near.obj).getCenter(new THREE.Vector3());
        p.pos.copy(c).addScaledVector(S.lateral, off * ((near.u.width ?? 1) / 2 + 0.3)).setY(near.obj.position.y);
        p.fixed = true; p.faceAt = c.setY(near.obj.position.y);
      }
      for (const p of placed) {
        if (p.a?.pose !== "hide" || p.fixed || !shotObjs.length) continue;
        const near = shotObjs.reduce((b, x) => (x.obj.position.distanceTo(p.pos) < b.obj.position.distanceTo(p.pos) ? x : b), shotObjs[0]);
        const off = hz(near.obj.position).sub(hz(spots.center)).dot(S.lateral) >= 0 ? 1 : -1;
        p.pos.copy(near.obj.position).addScaledVector(S.lateral, off * ((near.u.width ?? 1) / 2 + 0.15)).addScaledVector(S.depth, Math.min(0.6, (near.u.depth ?? 1) * 0.3)).setY(near.obj.position.y);
        p.fixed = true;
      }
    }
    for (let it = 0; it < 6; it++) for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const A = placed[i].pos, B = placed[j].pos, d = hz(B).sub(hz(A)), L = d.length(), min = 0.85;
      if (L >= min || (placed[i].fixed && placed[j].fixed)) continue;
      const dir = L > 1e-3 ? d.divideScalar(L) : S.lateral.clone();
      const ka = placed[i].fixed ? 0 : placed[j].fixed ? 2 : 1, kb = 2 - ka;
      const push = (min - L) / 2; A.addScaledVector(dir, -push * ka); B.addScaledVector(dir, push * kb);
    }
    const where = Object.fromEntries(placed.map((p) => [p.id, p.pos]));

    // monster
    const ms = shot.monsterState ?? (shot.focus === "monster" ? { spot: "far", state: "lurk" } : null);
    if (monster) monster.visible = !!ms;
    if (monster && ms) {
      monster.position.copy(spots[ms.spot ?? "far"] ?? spots.far);
      // 2026-11-05 (GAPS): a monster lurking at the far spot stands at most ~9 m behind the centre (it read as a dot)
      if ((ms.spot ?? "far") === "far" && ms.state === "lurk") { const d = hz(monster.position).sub(hz(spots.center)), L = d.length(), cap = Math.max(7, Math.min(9, monsterH * 2.4)); if (L > cap) monster.position.copy(spots.center).addScaledVector(d.normalize(), cap).setY(monster.position.y); }
      animateMonster(monster, ms.state, lt);
    }
    if (epic) epic.place(shot, lt, S); // EPIC: this shot's giants + crowds (placed, animated)

    // insert: in front of the center spot, toward the camera side, facing it
    let ins = null;
    if (shot.insert) {
      ins = INSERTS.get(`${shot.insert.kind}|${shot.insert.text}|${shot.insert.icon ?? ""}`);
      const base = spots.center.clone().addScaledVector(S.depth, -1.4);
      ins.obj.position.copy(base); ins.obj.position.y = base.y + (ins.minY < -0.05 ? 1.3 - (ins.minY + ins.h / 2) : -ins.minY);
      ins.obj.rotation.set(0, Math.atan2(-S.depth.x, -S.depth.z), 0);
      ins.obj.visible = true;
    }

    // the camera
    const epicCam = !!epic && epic.ownsFocus(shot) && epic.frame(shot, lt, S, where, camera, Object.fromEntries(placed.map((p) => [p.id, PEOPLE[p.id]?.h])));
    if (!epicCam) {
    let focus, focusHeight, other, camType = shot.camera;
    /** "insert" framing (straight, centred) that fits a person at `a` (height h) and an object (height capped at capH) */
    function fitPair(a, h, { obj, u }, capH) {
      const oc = obj.localToWorld((u.focus ?? new THREE.Vector3()).clone()).setY(obj.position.y);
      const la = hz(a).sub(hz(oc)).dot(S.lateral), hw = (u.fitW ?? u.width ?? 2) / 2;
      const lo = Math.min(-hw, la - 0.5), hi = Math.max(hw, la + 0.5);
      const fitW = hi - lo, fitH = Math.max(h + 0.2, Math.min(u.fitH ?? u.height ?? 2, capH));
      const fh = Math.max(fitH / 2.1, fitW / 1.35);
      const f = hz(oc).addScaledVector(S.lateral, (lo + hi) / 2).addScaledVector(S.depth, hz(a).sub(hz(oc)).dot(S.depth) / 2);
      f.y = Math.min(a.y, obj.position.y) + fitH / 2 - fh / 2;
      return { focus: f, focusHeight: fh };
    }
    let otherH, otherR;
    if (shot.focus === "monster") {
      // over the shoulder of the one it acts on ("It walked right past me"), else whoever stands in the shot
      const o = placed.find((p) => (shot.subjectWith ?? []).includes(p.id)) ?? placed.find((p) => !p.fixed) ?? placed[0];
      focus = monster.position.clone(); focusHeight = monsterH; other = o?.pos; otherH = o ? PEOPLE[o.id]?.h : undefined;
    }
    else if (shot.focus === "insert") { focus = ins.obj.position.clone().setY(ins.obj.position.y + ins.minY); focusHeight = ins.h; }
    else if (shot.focus === "object") {
      // wide / insert: fit the whole object (and anybody standing around it) with the "insert" framing (a straight,
      // centred view, vertical span 2.4 H); medium / closeup / over_shoulder: its key detail (userData.detail) like a
      // person of that height; low: from the ground, its full height
      const { obj, u } = shotObjs[0];
      const at = (v) => { const p = obj.localToWorld((v ?? new THREE.Vector3()).clone()); p.y = obj.position.y; return p; };
      other = placed[0]?.pos;
      if (shot.camera === "wide" || shot.camera === "insert") {
        const c = at(u.focus);
        let fitW = u.fitW ?? u.width ?? 2, fitH = u.fitH ?? u.height ?? 2;
        for (const p of placed) { // people next to it widen the fit (a storybook between Grandpa and Pip)
          const d = hz(p.pos).sub(hz(c)), lat = Math.abs(d.dot(S.lateral)), dep = Math.abs(d.dot(S.depth));
          if (lat < 3 && dep < 2.5) { fitW = Math.max(fitW, 2 * lat + 0.9); fitH = Math.max(fitH, (PEOPLE[p.id]?.h ?? 1.7) + (p.pos.y - obj.position.y) + 0.2); }
        }
        const fitY = Math.max(u.fitY ?? fitH / 2, fitH / 2 * 0.8);
        focusHeight = Math.max(fitH / 2.1, fitW / 1.35);
        focus = c; focus.y = obj.position.y + fitY - focusHeight / 2;
        camType = "insert";
      } else if (shot.camera === "low") { focus = at(u.focus); focusHeight = u.fitH ?? u.height ?? 2; }
      else {
        const d = at(u.detail?.at ?? u.focus);
        // somebody standing between the lens and the detail (Dobbs in front of the bakery): frame the two together
        const blocker = placed.find((p) => { if (p.fixed) return false; const v = hz(p.pos).sub(hz(d)); const f = -v.dot(S.depth); return f > -0.2 && f < 2.8 && Math.abs(v.dot(S.lateral)) < 1.6; });
        if (blocker) { ({ focus, focusHeight } = fitPair(blocker.pos, PEOPLE[blocker.id]?.h ?? 1.7, shotObjs[0], Math.max(2.6, PEOPLE[blocker.id]?.h ?? 1.7))); camType = "insert"; }
        else { focus = d; focusHeight = u.detail?.h ?? Math.min(u.height ?? 2, 2); }
      }
    }
    else if (shot.focus === "group") {
      const g = placed.length ? placed : [{ pos: spots.center, id: null }];
      focus = g.reduce((s, p) => s.add(p.pos), new THREE.Vector3()).divideScalar(g.length);
      focusHeight = Math.max(...g.map((p) => PEOPLE[p.id]?.h ?? 1.7));
    } else if (where[shot.focus] && ((shot.camera === "wide" && shotObjs.length) || (shot.camera !== "closeup" && placed.find((p) => p.id === shot.focus)?.mount))) {
      // a wide shot on an actor with an object in the shot: fit both (the "insert" framing, as for focus "object");
      // a rider: the rider and the mount together
      const fm = placed.find((p) => p.id === shot.focus)?.mount;
      ({ focus, focusHeight } = fitPair(where[shot.focus], PEOPLE[shot.focus].h + (fm ? where[shot.focus].y - fm.obj.position.y : 0), fm ?? shotObjs[0], 5)); camType = "insert";
    } else if (where[shot.focus]) {
      focus = where[shot.focus].clone(); focusHeight = PEOPLE[shot.focus].h;
      // a person off the floor (flying, up a ladder): the camera follows them up
      const fp = placed.find((p) => p.id === shot.focus), fa = fp?.a;
      const fr = fa && POSE_FRAME[fa.pose];
      if (fr && ["medium", "closeup"].includes(shot.camera)) {
        // the whole action in frame (a straight, centred view): the pair for a hug, the person + lift otherwise
        const h = Math.max(PEOPLE[shot.focus].h, fp.hugWith ? PEOPLE[fp.hugWith]?.h ?? 0 : 0), span = fr[0] * h;
        if (fp.hugWith && where[fp.hugWith]) focus.add(where[fp.hugWith]).multiplyScalar(0.5);
        focusHeight = span / 2.4; focus.y += (POSE_LIFT[fa.pose] ?? 0) + fr[1] * h - focusHeight / 2;
        camType = "insert"; other = undefined;
      } else if (fa && POSE_LIFT[fa.pose]) focus.y += POSE_LIFT[fa.pose];
      const op = placed.find((p) => p.id !== shot.focus);
      other = shotObjs.length ? shotObjs[0].obj.localToWorld((shotObjs[0].u.focus ?? new THREE.Vector3()).clone()).setY(shotObjs[0].obj.position.y)
        : op?.pos ?? (monster?.visible ? monster.position : undefined);
      if (!shotObjs.length && !op && monster?.visible) { otherH = monsterH; otherR = monsterR; }
      otherH = !shotObjs.length && op ? PEOPLE[op.id]?.h : otherH;
    } else { // a carried baby: frame its carrier, a little tighter on the arms
      const c = carried.get(shot.focus);
      focus = where[c.id].clone(); focusHeight = PEOPLE[c.id].h * 0.85;
    }
    const fctx = { THREE, camera, set: S, focus, focusHeight, other, otherHeight: otherH, otherRadius: otherR, dur, seed: shot.seed ?? si };
    const nudge = guardNudge(si, shot, camType, fctx, placed, where, carried);
    frameShot(camType, { ...fctx, other: other?.clone(), t: lt, nudge });
    }
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
      else if (epic?.posOf(f)) yaw = yawTo(p.pos, epic.posOf(f));
      else yaw = yawTo(p.pos, camPos);
      let extra = null;
      if (p.hugWith && where[p.hugWith]) { // face the partner, the face turned a little to the lens
        yaw = yawTo(p.pos, where[p.hugWith]);
        let dy = yawTo(p.pos, camPos) - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        extra = { partnerH: PEOPLE[p.hugWith].h, headYaw: Math.max(-0.6, Math.min(0.6, dy * 0.6)) };
      }
      if (p.rideYaw != null) { yaw = p.rideYaw; extra = { seat: 0 }; }
      if (p.faceAt) yaw = yawTo(p.pos, p.faceAt);
      o.rotation.set(0, yaw, 0);
      const baby = a.id && carried.size ? [...carried].find(([, c]) => c === a)?.[0] : null;
      const pose = p.noMount ? "walk" : a.pose ?? "stand";
      posePerson(o, pose, lt + (a.phase ?? 0), { ...(p.opts ?? {}), ...(extra ?? {}), hold: baby ? null : a.hold ?? null });
      setFace(o, a.expr ?? "neutral");
      if (baby && holdPerson) { // the baby in the carrier's arms, posed from its own actor entry if it has one
        const B = PEOPLE[baby].obj, ba = (shot.actors ?? []).find((x) => x.id === baby);
        o.updateMatrixWorld(true);
        holdPerson(o, B);
        posePerson(B, ba?.pose && ba.pose !== "carry" ? ba.pose : "stand", lt + (ba?.phase ?? 0), {});
        setFace(B, ba?.expr ?? "happy");
        B.updateMatrixWorld(true);
        where[baby] = B.getWorldPosition(new THREE.Vector3());
      }
    }
    // birthday guests wear party hats
    if (shotObjs.some((s) => s.u.name === "birthday_party") && objectsM?.partyHat) {
      let k = 0;
      for (const p of placed) {
        const P = PEOPLE[p.id]; if (!P) continue;
        let h = HATS.get(p.id);
        if (!h) { h = objectsM.partyHat(7 + k * 3); HATS.set(p.id, h); }
        const lk = P.obj.userData.look ?? {}, j = P.obj.userData.joints;
        if (!j?.head) continue;
        if (h.parent !== j.head) j.head.add(h);
        h.position.set(0, lk.hair === "afro" ? 0.5 : lk.hat ? 0.45 : lk.hair === "bun" ? 0.42 : 0.37, 0);
        h.visible = true; k++;
      }
    }
    for (const mk of markersOf(shot)) {
      for (const id of markerTargets(mk, shot)) {
        const m = MARKERS.get(`${id}|${mk.kind}|${mk.text ?? ""}`);
        if (!m) continue;
        if (id === "monster") { // above the monster's head
          if (!monster?.visible) continue;
          m.visible = true; m.position.copy(monster.position); m.position.y += monsterH + 0.3;
        } else {
          if (!where[id]) continue;
          m.visible = true; m.position.copy(where[id]); m.position.y += PEOPLE[id].h + 0.15; // the marker's origin is its bottom (kit/props.js)
        }
        m.rotation.set(0, 0, 0);
        animateMarker?.(m, lt);
        if (m.userData.billboard) m.quaternion.copy(camera.quaternion);
        m.traverse((c) => { if (c !== m && c.userData.billboard) c.quaternion.copy(camera.quaternion); });
      }
    }

    // EPIC: crowd poses (LOD needs the camera), giant LOD, the beat's camera shake (after all framing)
    epic?.after(shot, lt, S, camera);
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
  // ...and every shot with scene objects or a carried baby once (their materials compile here, not mid-render)
  for (const s of tl.shots) if (s.objects?.length || s.giants?.length || s.crowds?.length || (s.actors ?? []).some((a) => carriedBaby(a, tl.cast ?? {}))) renderAt(s.start + 0.01);
  renderAt(0);

  window.timeline = tl;
  window.renderAt = renderAt;
  window.engineDebug = { THREE, scene, camera, renderer, post }; // dev probes (e.g. dev/epicProbe.mjs finds non-finite pixels)
  window.frameData = (q = 0.9) => out.toDataURL("image/jpeg", q);
  window.engineInfo = { stubs: [...stubbed], sets: Object.keys(SETS), people: Object.keys(PEOPLE), renderer: (() => { const gl = renderer.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })() };
  window.ready = true;
}

main().catch((e) => { window.engineError = String(e?.stack ?? e); console.error(window.engineError); });
