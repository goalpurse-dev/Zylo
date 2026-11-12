// Blocky Worlds builder: the FREE connectivity check of a blueprint (pure math, no browser, no call).
// 2026-11-09 (the BUILDS run): the croissant bell and the glasses bell came back with their hook parts floating above
// the bell, and the mock robot dentist's raised arm, drill and drill tip were apart; each one cost a design + a still +
// a paid vision check to find out. Now every part must touch the main body (through other parts, or the floor for
// things that stand on it) at rest AND through its animations, before any still or vision call.
//   checkConnected(blueprint, { times }) -> { ok, tol, floating: [{ ids, near, gap, move }], anims: [{ anim, ids, near,
//                                         gap, t }], fix: "precise text for the designer" | "" }
//   repairBlueprint(blueprint)          -> { blueprint, snapped: [...], droppedAnims: [...], check } (free fixes: a small
//                                         gap is closed by moving the loose group straight onto its neighbour; an anim
//                                         that pulls parts apart is dropped); the caller re-checks / rejects the rest
// The geometry mirrors page/kit/blueprint.js buildBlueprint + animateBlueprint exactly: a part is a box of `size`
// (cylinder / cone / sphere / wedge / torus fill the same box) centred on `pos`, turned by `rot` (degrees, three.js
// Euler order XYZ) about its centre; a part's pivot group sits at `pivot` (or `pos`), never rotates at rest, and
// carries its children (parent) when an anim moves it.
const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------------------- tiny 3x3 maths
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const app = (A, v) => [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
/** three.js Euler "XYZ": R = Rx * Ry * Rz (radians) */
const euler = (x, y, z) => mul(mul(rx(x), ry(y)), rz(z));
const r3 = (v) => Math.round(v * 1000) / 1000;
const v3s = (v) => `[${v.map(r3).join(", ")}]`;

// ------------------------------------------------------------------------------------------------- the boxes
/** the oriented box of every part at time t (null = rest), following the parent / pivot / anim chain */
export function partBoxes(bp, t = null) {
  const parts = bp?.parts ?? [], byId = new Map(parts.map((p) => [p.id, p]));
  const animsOf = new Map();
  if (t != null) for (const a of bp.anims ?? []) { if (!animsOf.has(a.part)) animsOf.set(a.part, []); animsOf.get(a.part).push(a); }
  const pivotOf = (p) => p.pivot ?? p.pos;
  const memo = new Map();
  // world transform of a part's pivot group: { R, o } (x_world = R x_local + o)
  const pivotWorld = (p, seen = new Set()) => {
    if (memo.has(p.id)) return memo.get(p.id);
    const par = p.parent && byId.has(p.parent) && !seen.has(p.parent) ? byId.get(p.parent) : null;
    seen.add(p.id);
    const PW = par ? pivotWorld(par, seen) : { R: I3(), o: [0, 0, 0] };
    let local = par ? sub(pivotOf(p), pivotOf(par)) : pivotOf(p);
    let R = I3();
    for (const a of animsOf.get(p.id) ?? []) {
      const ph = 2 * Math.PI * a.speed * t, ax = "xyz".indexOf(a.axis);
      const rot = [0, 0, 0];
      if (a.kind === "bob") { local = [...local]; local[ax] += Math.min(2, Math.abs(a.amount)) * Math.sign(a.amount || 1) * Math.sin(ph); }
      else if (a.kind === "spin") rot[ax] = ph;
      else if (a.kind === "swing") rot[ax] = a.amount * DEG * Math.sin(ph);
      else if (a.kind === "wobble") { rot[0] = a.amount * 0.5 * DEG * Math.sin(ph); rot[2] = a.amount * 0.5 * DEG * Math.cos(ph * 0.9); }
      else if (a.kind === "open") { const k = Math.min(1, t * Math.max(0.2, a.speed)); rot[ax] = a.amount * DEG * (k * k * (3 - 2 * k)); }
      if (rot.some(Boolean)) R = euler(...rot); // (animateBlueprint resets the node each frame: the last anim of a part wins per channel; one per part is the norm)
    }
    const out = { R: mul(PW.R, R), o: add(app(PW.R, local), PW.o) };
    memo.set(p.id, out);
    return out;
  };
  return parts.map((p) => {
    const W = pivotWorld(p);
    const rest = euler(p.rot[0] * DEG, p.rot[1] * DEG, p.rot[2] * DEG);
    const R = mul(W.R, rest);
    const c = add(app(W.R, sub(p.pos, pivotOf(p))), W.o);
    const axes = [0, 1, 2].map((j) => [R[0][j], R[1][j], R[2][j]]);
    const half = p.size.map((s) => s / 2);
    const ext = [0, 1, 2].map((i) => axes.reduce((s, a, j) => s + Math.abs(a[i]) * half[j], 0));
    return { id: p.id, c, axes, half, min: sub(c, ext), max: add(c, ext), vol: p.size[0] * p.size[1] * p.size[2] };
  });
}

/** do two oriented boxes overlap when each is grown by tol? (separating axis test, 15 axes) */
export function boxesTouch(A, B, tol = 0) {
  for (let i = 0; i < 3; i++) if (A.min[i] - tol > B.max[i] + tol || B.min[i] - tol > A.max[i] + tol) return false; // quick reject
  const d = sub(B.c, A.c), axes = [...A.axes, ...B.axes];
  for (const a of A.axes) for (const b of B.axes) { const x = cross(a, b); if (Math.hypot(...x) > 1e-6) axes.push(x); }
  for (const L0 of axes) {
    const n = Math.hypot(...L0), L = L0.map((v) => v / n);
    const ra = A.axes.reduce((s, a, j) => s + Math.abs(dot(a, L)) * A.half[j], 0) + tol;
    const rb = B.axes.reduce((s, b, j) => s + Math.abs(dot(b, L)) * B.half[j], 0) + tol;
    if (Math.abs(dot(d, L)) > ra + rb) return false;
  }
  return true;
}

/** the straight move (world axes) that brings box A's AABB onto box B's AABB, and its length */
function gapMove(A, B) {
  const move = [0, 1, 2].map((i) => (A.max[i] < B.min[i] ? B.min[i] - A.max[i] : A.min[i] > B.max[i] ? B.max[i] - A.min[i] : 0));
  return { move, gap: Math.hypot(...move) };
}

/** the groups of touching parts (union-find); the floor joins the parts that stand on it */
function groups(boxes, tol) {
  const n = boxes.length, up = boxes.map((_, i) => i);
  const find = (i) => (up[i] === i ? i : (up[i] = find(up[i])));
  const join = (a, b) => { up[find(a)] = find(b); };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (boxesTouch(boxes[i], boxes[j], tol)) join(i, j);
  const floorY = Math.min(...boxes.map((b) => b.min[1]));
  const onFloor = boxes.map((b, i) => (b.min[1] <= floorY + tol * 2 ? i : -1)).filter((i) => i >= 0);
  for (const i of onFloor.slice(1)) join(onFloor[0], i);
  return { find, n };
}

const sizeOf = (boxes) => Math.max(...[0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i])) - Math.min(...boxes.map((b) => b.min[i]))));
export const tolFor = (boxes) => Math.max(0.01, 0.02 * sizeOf(boxes));
const dirWord = (m) => {
  const i = [0, 1, 2].reduce((k, j) => (Math.abs(m[j]) > Math.abs(m[k]) ? j : k), 0);
  return [["left of", "right of"], ["below", "above"], ["behind", "in front of"]][i][m[i] > 0 ? 0 : 1];
};

/** the loose groups at one pose: [{ ids, near, gap, move }] (move = the world shift that makes the group touch `near`) */
function looseAt(boxes, tol) {
  if (boxes.length < 2) return [];
  const { find } = groups(boxes, tol);
  const main = boxes.reduce((k, b, i) => (b.vol > boxes[k].vol ? i : k), 0), root = find(main);
  const byRoot = new Map();
  boxes.forEach((b, i) => { const r = find(i); if (r !== root) { if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(i); } });
  const out = [];
  for (const idx of byRoot.values()) {
    let best = null;
    for (const i of idx) for (let j = 0; j < boxes.length; j++) {
      if (find(j) !== root) continue;
      const g = gapMove(boxes[i], boxes[j]);
      const centre = Math.hypot(...sub(boxes[i].c, boxes[j].c));
      if (!best || g.gap < best.gap - 1e-9 || (Math.abs(g.gap - best.gap) < 1e-9 && centre < best.centre)) best = { i, j, ...g, centre };
    }
    // gap 0 = the boxes' outlines overlap but the parts don't meet: a part is TURNED away (a rot sign error)
    out.push({ ids: idx.map((i) => boxes[i].id), near: boxes[best.j].id, gap: r3(best.gap), move: best.move.map(r3), turned: best.gap < 1e-6, _i: best.i });
  }
  return out;
}

/** the sample times of the anim check (the still renders at t = 0.6) */
export const ANIM_TIMES = Object.freeze([0.6, 0.15, 0.3, 0.45, 0.75, 0.9, 1.05, 1.25, 1.5, 2, 2.5, 3]);

export function checkConnected(bp, { times = ANIM_TIMES } = {}) {
  const parts = bp?.parts ?? [];
  if (parts.length < 2) return { ok: true, tol: 0, floating: [], anims: [], fix: "" };
  const rest = partBoxes(bp, null), tol = tolFor(rest);
  const floating = looseAt(rest, tol).map(({ _i, ...f }) => f);
  // the anims: only parts that are joined at rest and come apart while moving (a bob on the bell leaves the hook behind)
  const anims = [];
  if (!floating.length && (bp.anims ?? []).length) {
    for (const a of bp.anims) {
      if (a.kind === "blink") continue;
      const only = { ...bp, anims: [a] };
      // a small part that bobs on its own (a hovering coin, a hopping bean) may leave its spot: that is the motion
      const moving = new Set([a.part]);
      for (let grew = true; grew;) { grew = false; for (const p of parts) if (p.parent && moving.has(p.parent) && !moving.has(p.id)) { moving.add(p.id); grew = true; } }
      const movingVol = rest.filter((b) => moving.has(b.id)).reduce((s, b) => s + b.vol, 0), allVol = rest.reduce((s, b) => s + b.vol, 0);
      const hover = a.kind === "bob" && movingVol <= 0.05 * allVol;
      for (const t of times) {
        const lo = looseAt(partBoxes(only, t), tol).filter((l) => !(hover && l.ids.every((id) => moving.has(id))));
        if (lo.length) { anims.push({ anim: `${a.kind} on "${a.part}"`, part: a.part, kind: a.kind, ids: lo.flatMap((l) => l.ids), near: lo[0].near, gap: lo[0].gap, t }); break; }
      }
    }
  }
  const fix = [
    ...floating.map((f) => {
      const p = parts.find((x) => x.id === f.ids[0]);
      const list = f.ids.length > 4 ? `${f.ids.slice(0, 4).map((x) => `"${x}"`).join(", ")} and ${f.ids.length - 4} more` : f.ids.map((x) => `"${x}"`).join(", ");
      if (f.turned) return `${list} ${f.ids.length > 1 ? "are" : "is"} next to "${f.near}" but turned so ${f.ids.length > 1 ? "they miss" : "it misses"} it (rot ${v3s(p.rot)}): check the rot signs (positive x-rot tips a part's top toward the FRONT +z, positive z-rot tips it toward the LEFT -x, positive y-rot turns its front toward +x) or move it onto "${f.near}"`;
      return `${list} float ${f.gap} m ${dirWord(f.move)} "${f.near}" (not touching anything): move ${f.ids.length > 1 ? "them" : "it"} by ${v3s(f.move)} so ${f.ids.length > 1 ? "they touch" : "it touches"} "${f.near}" (e.g. "${p.id}" pos ${v3s(p.pos)} -> ${v3s(add(p.pos, f.move))}); every part's pos is its CENTRE in the one shared frame (not relative to its parent), and size is measured before rot turns it`;
    }),
    ...anims.map((x) => `the ${x.anim} pulls ${x.ids.map((i) => `"${i}"`).join(", ")} ${x.gap} m away from "${x.near}" (t = ${x.t} s): ${x.kind === "bob" ? `give the parts it hangs from / holds the parent "${x.part}" so they move together, or drop the bob` : `put its pivot on the joint where "${x.part}" meets what holds it (shared frame), or give the touching parts the parent "${x.part}"`}`),
  ].join("; ");
  return { ok: !floating.length && !anims.length, tol: r3(tol), floating, anims, fix };
}

/**
 * Free repairs before any paid check: a loose group whose gap is small (<= `maxShare` of the object's size) is moved
 * straight onto its nearest neighbour (pos and pivot shift together); an anim that pulls parts apart is dropped
 * (anims are subtle decoration). Bigger gaps stay for the designer (checkConnected's fix text).
 */
export function repairBlueprint(bp, { maxShare = 0.15, times = ANIM_TIMES } = {}) {
  let cur = JSON.parse(JSON.stringify(bp));
  const snapped = [], droppedAnims = [];
  for (let round = 0; round < 6; round++) {
    const rest = partBoxes(cur, null), tol = tolFor(rest), size = sizeOf(rest);
    const lo = looseAt(rest, tol);
    if (!lo.length || lo.some((l) => l.turned)) break; // a turned part (rot sign error) needs the designer, not a shift
    const f = lo.reduce((a, b) => (b.gap < a.gap ? b : a));
    if (f.gap > maxShare * size) break;
    // a hair past touching so the grown boxes overlap
    const m = f.move.map((v) => (v ? v + Math.sign(v) * tol * 0.5 : 0));
    const ids = new Set(f.ids);
    cur.parts = cur.parts.map((p) => (ids.has(p.id) ? { ...p, pos: add(p.pos, m), ...(p.pivot ? { pivot: add(p.pivot, m) } : {}) } : p));
    snapped.push({ ids: f.ids, near: f.near, move: m.map(r3) });
  }
  let check = checkConnected(cur, { times });
  if (!check.floating.length && check.anims.length) {
    const bad = new Set(check.anims.map((a) => `${a.kind}|${a.part}`));
    droppedAnims.push(...cur.anims.filter((a) => bad.has(`${a.kind}|${a.part}`)).map((a) => `${a.kind} on "${a.part}"`));
    cur.anims = cur.anims.filter((a) => !bad.has(`${a.kind}|${a.part}`));
    check = checkConnected(cur, { times });
  }
  return { blueprint: cur, snapped, droppedAnims, check };
}
