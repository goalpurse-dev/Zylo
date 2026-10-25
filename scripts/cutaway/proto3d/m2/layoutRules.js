// M2: readability rules every new layout gets after its plan (free, no model call), from the car wash's preview check
// (2026-10-24): what the checker could not read, fixed where the planner tends to get it wrong.
//  1. a spray comes out of its hose: a water jet starting in the air beside a hose's end starts at that end and arcs up
//     (a hose lying on the ground with a spray hanging in mid-air read as "not connected")
//  2. water in a pipe is seen: a pipe flow's dots ride in front of the pipe's face (dz 0 hid them inside it)
//  3. a pipe ending in a stream pours into it: an outfall flow from its end into the water, on when the pipe flow is
//  4. an outline hugs the tank it names (an outline 20 cm off the walls read as "offset")
//  5. standing water on a paved floor is a thin glossy puddle, not a 35 cm slab
//  6. a canopy stands in the open (not under the setting.s roof) and stands out from the building beside it
import { focusOf } from "./focus.js";
import { settingBoxes } from "./framing.js";
import { STREET_BACK, streetRoad } from "../kit/street.js";

const near = (a, b, d) => Math.hypot(a[0] - b[0], a[2] - b[2]) <= d;
const hexClose = (a, b) => { const p = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16)); try { const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 60; } catch { return false; } };

export function layoutRules(L) {
  const cut = L.world?.cut, parts = L.parts.map((p) => ({ ...p, params: { ...(p.params ?? {}) } })), byId = new Map(parts.map((p) => [p.id, p]));
  const beats = (L.beats ?? []).map((b) => ({ ...b, do: [...(b.do ?? [])] }));
  const notes = [];
  // 1. the spray out of the hose
  for (const f of parts.filter((p) => p.kind === "flow" && Array.isArray(p.params.path) && p.params.path.length >= 2)) {
    const s = f.params.path[0], spray = f.params.look === "spray" || ((f.params.look ?? "water") === "water" && s[1] > 0.5);
    if (!spray) continue;
    const hose = parts.find((p) => p.kind === "pipeRun" && /leaf|hose/i.test(String(p.params.mat ?? "") + p.id) && Array.isArray(p.params.path) && near(p.params.path.at(-1), s, 1.8));
    if (!hose) continue;
    const e = hose.params.path.at(-1), mid = [(e[0] + s[0]) / 2, Math.max(s[1], e[1]) + 0.35, (e[2] + s[2]) / 2];
    f.params.path = [[e[0], e[1] + 0.12, e[2]], mid, ...f.params.path.slice(1)];
    f.params.look = "spray";
    notes.push(`${f.id} starts at the end of ${hose.id}`);
  }
  // 2. water in a pipe is seen; 3. a pipe ending in a stream pours into it
  for (const fl of parts.filter((p) => p.kind === "pipeRunFlow")) {
    const pipe = byId.get(fl.params.pipe); if (!pipe) continue;
    // (and thick enough to follow: a 12 cm return pipe was "thin and hard to follow")
    if ((pipe.params.r ?? 0.24) < 0.16) pipe.params.r = 0.16;
    const r = pipe.params.r ?? 0.24, dz = fl.params.dz ?? 0.22;
    if (dz < r + 0.05) { fl.params.dz = +(r + 0.08).toFixed(2); fl.params.size = Math.max(fl.params.size ?? 0.13, +(r * 0.8).toFixed(2)); notes.push(`${fl.id} rides in front of ${pipe.id}`); }
    const end = pipe.params.path?.at(-1), creek = end && parts.find((q) => q.kind === "creek" && (() => { try { const b = focusOf(q, cut); return end[0] >= b.min[0] - 0.3 && end[0] <= b.max[0] + 0.3 && end[1] <= b.max[1] + 0.3; } catch { return false; } })());
    if (!creek || byId.has(`${pipe.id}Outfall`)) continue;
    const cb = focusOf(creek, cut), cx = (cb.min[0] + cb.max[0]) / 2;
    // soapy if a soap flow runs into the drain the pipe starts under
    const start = pipe.params.path[0], soapy = parts.some((q) => q.kind === "flow" && q.params.look === "soap" && near(q.params.path?.at(-1) ?? [99, 0, 99], start, 1.2));
    const out = { id: `${pipe.id}Outfall`, kind: "flow", params: { path: [[end[0], end[1], end[2] + 0.1], [(end[0] + cx) / 2, Math.max(end[1], -0.2), -0.25], [cx, 0.06, -0.9]], look: soapy ? "soap" : "water", size: 0.2, speed: 2.4 } };
    parts.push(out); byId.set(out.id, out);
    for (const b of beats) for (const a of [...b.do]) if (a.p === fl.id) b.do.push({ p: out.id, v: a.v === "hide" ? "stop" : "start", ...(a.w ? { w: a.w } : {}), o: +((a.o ?? 0) + 0.4).toFixed(2) });
    notes.push(`${pipe.id} pours into ${creek.id}`);
  }
  // 4. an outline hugs its tank
  for (const o of parts.filter((p) => p.kind === "outline" && Array.isArray(p.params.points) && p.params.points.length >= 4)) {
    const xs = o.params.points.map((q) => q[0]), ys = o.params.points.map((q) => q[1]), z = o.params.points[0][2];
    const tank = parts.find((p) => p.kind === "settle" && p.params.box && Math.abs(p.params.box.x0 - Math.min(...xs)) < 0.6 && Math.abs(p.params.box.x1 - Math.max(...xs)) < 0.6 && Math.abs(p.params.box.y0 - Math.min(...ys)) < 0.6);
    if (!tank) continue;
    const b = tank.params.box, t = tank.params.wallColor ? 0.1 : 0.14, m = t + 0.04;
    o.params.points = [[b.x0 - m, b.y1 + 0.04, z], [b.x0 - m, b.y0 - m, z], [b.x1 + m, b.y0 - m, z], [b.x1 + m, b.y1 + 0.04, z]];
    o.params.opts = { ...(o.params.opts ?? {}), closed: true };
    notes.push(`${o.id} hugs ${tank.id}`);
  }
  // 5. standing water on a paved floor: a thin puddle
  const floorTop = { street: 0.12, room: 0.12, carwash: 0.1, garage: 0.08 }[L.world?.backdrop?.type];
  if (floorTop) for (const w of parts.filter((p) => p.kind === "water" && p.params.box)) {
    const b = w.params.box;
    if (b.y0 >= floorTop - 0.05 && b.y0 <= floorTop + 0.1 && b.y1 - b.y0 > 0.08) { w.params.box = { ...b, y0: floorTop + 0.005, y1: floorTop + 0.04 }; w.params.mat = "puddle"; notes.push(`${w.id} is a puddle`); }
  }
  // 6. a canopy stands in the open: one under the setting's own roof (the car wash bay's) moves out past the roof's edge,
  // with the props standing under it (a canopy under a roof read as the building's roof)
  const roofs = settingBoxes(L.world?.backdrop, L.world?.cut ?? null).filter((b) => b.min[1] > 2);
  for (const c of parts.filter((p) => p.kind === "canopy")) {
    const P = c.params, roof = roofs.find((b) => P.x1 > b.min[0] && P.x0 < b.max[0] && P.z1 > b.min[2] && P.z0 < b.max[2]);
    if (!roof) continue;
    const right = roof.max[0] + 0.6 - P.x0, left = P.x1 - (roof.min[0] - 0.6), dx = right <= left ? right : -left;
    const under = parts.filter((p) => p.kind === "prop" && Array.isArray(p.params.pos) && p.params.pos[0] >= P.x0 - 0.3 && p.params.pos[0] <= P.x1 + 0.3 && p.params.pos[2] >= P.z0 - 0.3 && p.params.pos[2] <= P.z1 + 0.3);
    P.x0 = +(P.x0 + dx).toFixed(2); P.x1 = +(P.x1 + dx).toFixed(2);
    for (const u of under) u.params.pos = [+(u.params.pos[0] + dx).toFixed(2), u.params.pos[1], u.params.pos[2]];
    notes.push(`${c.id} moved out from under the roof${under.length ? ` with ${under.map((u) => u.id).join(", ")}` : ""}`);
  }
  // 6b. a canopy stands out from its building
  const bColor = L.world?.backdrop?.color ?? (L.world?.backdrop?.type === "carwash" ? "#3d7cc9" : null);
  for (const c of parts.filter((p) => p.kind === "canopy")) if (!c.params.color || (bColor && hexClose(c.params.color, bColor))) { c.params.color = "#2e9d63"; c.params.postColor = c.params.postColor ?? "#3a4046"; notes.push(`${c.id} in its own colour`); }
  // 7. on the "Add ..." line the last thing added starts 0.7 s before its word, so it is up as the word lands (a canopy
  // built on "canopy", the last word, was still roofless when the camera left for "Congratulations")
  const fin = beats.find((b) => b.s === "finish");
  if (fin) {
    const adds = fin.do.filter((a) => a.w && !/^(stop|stopSpray|hide|open|refill|close|off)$/.test(a.v));
    const last = adds.at(-1)?.w;
    if (last) for (const a of fin.do) if (a.w === last && a === adds.at(-1) && (a.o ?? 0) > -0.7) { a.o = -0.7; notes.push(`${a.p} starts before "${last}"`); }
  }
  const world = { ...(L.world ?? {}), ...(L.world?.cut ? { cut: { ...L.world.cut } } : {}), ...(L.world?.backdrop ? { backdrop: { ...L.world.backdrop } } : {}) };
  // 8. no soil cut when nothing in the story is underground (the owner's decision of 2026-10-25): the ground is a thin
  // slab (world.shallow), the pit only as deep as the thing set into the road. Kept whenever a part reaches down into it.
  const DRESSING = new Set(["dig", "light", "sign", "rain", "lawnWet", "outline", "arrows", "book", "sheet", "flag"]);
  const deep = parts.filter((p) => !DRESSING.has(p.kind)).some((p) => { try { return focusOf(p, cut).min[1] < -0.8; } catch { return false; } });
  if (!deep && world.cut && !world.shallow && L.camera?.home == null) { world.shallow = true; world.cut.depth = Math.min(world.cut.depth ?? 6, 0.6); notes.push("nothing underground: a thin ground slab, no soil cut"); }
  // 9. a street looks along its road (kit/street.js): the road on the side of the cut with fewer parts; nothing stands on
  // it but vehicles; a traffic signal stands on its corner at the stop line with its arm over the lane going away, its
  // controller, wires and outline moved with it; its loop in that lane before the stop line; cars drive along the lane
  if (world.backdrop?.type === "street" && world.backdrop.road !== false && world.cut) {
    const C0 = world.cut, boxOf = (p) => { try { return focusOf(p, C0); } catch { return null; } };
    const stands = parts.filter((p) => !DRESSING.has(p.kind) && !["car", "traffic"].includes(p.kind));
    const count = (side) => stands.filter((p) => { const b = boxOf(p); return b && (side < 0 ? b.max[0] < C0.x0 : b.min[0] > C0.x1); }).length;
    const side = world.backdrop.road?.side ?? (count(-1) <= count(1) ? -1 : 1);
    world.backdrop.road = { ...(world.backdrop.road ?? {}), side };
    world.backdrop.back = world.backdrop.back ?? STREET_BACK;
    const R = streetRoad({ cut: C0, road: world.backdrop.road, back: world.backdrop.back });
    const move = (p, dx, dz = 0) => {
      const P = p.params;
      const sh = (v) => (Array.isArray(v) && v.length === 3 && typeof v[0] === "number" ? [+(v[0] + dx).toFixed(2), v[1], +(v[2] + dz).toFixed(2)] : v);
      for (const k of ["pos", "at"]) if (P[k]) P[k] = sh(P[k]);
      if (Array.isArray(P.path)) P.path = P.path.map(sh);
      if (Array.isArray(P.points)) P.points = P.points.map(sh);
      if (typeof P.x === "number") { P.x = +(P.x + dx).toFixed(2); if (typeof P.z === "number") P.z = +(P.z + dz).toFixed(2); }
    };
    const sig = parts.find((p) => p.kind === "trafficLight"), group = new Set();
    if (sig) {
      // the signal and what belongs to it (within 3 m: its controller, mast, camera, wires, outline) move as one, to the
      // corner at the stop line, just off the curb (its arm alone reaches over the road)
      const [sx, , sz] = sig.params.pos ?? [0, 0.12, -1];
      const near = stands.filter((p) => p !== sig && p.kind !== "prop" && (() => { const b = boxOf(p); return b && Math.hypot((b.min[0] + b.max[0]) / 2 - sx, (b.min[2] + b.max[2]) / 2 - sz) < 3; })());
      const outl = parts.filter((p) => p.kind === "outline" && near.concat(sig).some((q) => { const b = boxOf(q), o = boxOf(p); return b && o && o.max[0] > b.min[0] - 0.5 && o.min[0] < b.max[0] + 0.5; }));
      for (const p of [sig, ...near, ...outl]) group.add(p);
      const cornerX = side < 0 ? R.x1 + 0.9 : R.x0 - 0.9;
      for (const p of group) move(p, +(cornerX - sx).toFixed(2), +(R.stopZ - 0.8 - sz).toFixed(2));
      // (nothing of the group but the arm on the road: the whole group steps back from the curb as far as it overhangs)
      const xs = [...group].filter((p) => p !== sig).map(boxOf).filter(Boolean).concat([{ min: [cornerX - 0.2], max: [cornerX + 0.2] }]);
      const over = side > 0 ? Math.max(...xs.map((b) => b.max[0])) - (R.x0 - 0.4) : (R.x1 + 0.4) - Math.min(...xs.map((b) => b.min[0]));
      if (over > 0) for (const p of group) move(p, +(side > 0 ? -over : over).toFixed(2));
      sig.params.arm = +(R.w * 0.62 + Math.max(0, over)).toFixed(2); sig.params.armDir = side < 0 ? -1 : 1;
      sig.params.loop = [R.laneOut, +(R.stopZ + 2.2).toFixed(2), 1.8, 2.4];
      notes.push(`${sig.id} on the corner at the stop line, its arm over the lane${near.length ? `, with ${near.map((p) => p.id).join(", ")}` : ""}`);
    }
    // anything else standing on the road moves to the sidewalk beyond the curb on the cut's side, clear of what is there
    const onRoad = (b) => b && b.max[0] >= R.x0 - 0.3 && b.min[0] <= R.x1 + 0.3 && b.max[2] >= R.back;
    const placed = stands.filter((p) => group.has(p) || !onRoad(boxOf(p))).map(boxOf).filter(Boolean);
    const hits = (b) => placed.some((q) => b.max[0] > q.min[0] && b.min[0] < q.max[0] && b.max[2] > q.min[2] && b.min[2] < q.max[2]);
    for (const p of stands) {
      if (group.has(p)) continue;
      const b = boxOf(p); if (!onRoad(b)) continue;
      move(p, +(side < 0 ? R.x1 + 0.5 - b.min[0] : R.x0 - 0.5 - b.max[0]).toFixed(2));
      for (let k = 0; k < 6 && hits(boxOf(p)); k++) move(p, 0, -1.6);
      placed.push(boxOf(p)); notes.push(`${p.id} moved off the road`);
    }
    // the end sign too (it stands on the sidewalk, never in a lane)
    for (const p of parts.filter((q) => q.kind === "sign")) { const b = boxOf(p); if (b && b.max[0] > R.x0 - 0.3 && b.min[0] < R.x1 + 0.3) { move(p, +(side < 0 ? R.x1 + 0.6 - b.min[0] : R.x0 - 0.6 - b.max[0]).toFixed(2)); notes.push(`${p.id} moved off the road`); } }
    // cars drive along the lane going away from the camera and stop at the stop line
    for (const c of parts.filter((p) => p.kind === "car")) { c.params = { ...c.params, axis: "z", pos: [R.laneOut, c.params.pos?.[1] ?? 0.12, +(R.stopZ + 2.6).toFixed(2)], from: -0.4, to: R.back - 18 }; notes.push(`${c.id} drives along the road`); }
    for (const q of parts.filter((p) => p.kind === "traffic")) q.params = { ...q.params, lane: [R.laneOut, R.stopZ], dir: -1, y: q.params.y ?? 0.12 };
  }
  // 11. the ending shows the machine working (the creator's traffic light ends on the crossing running, a car driving off):
  // a traffic light that nothing sets running by the end runs its cycle from the "Add ..." line on
  const finB = beats.find((b) => b.s === "finish") ?? beats.find((b) => b.s === "congrats");
  if (finB) for (const s of parts.filter((p) => p.kind === "trafficLight")) {
    const late = beats.slice(beats.indexOf(finB)).some((b) => b.do.some((a) => a.p === s.id && /^(cycle|flash)$/.test(a.v)));
    if (!late) { finB.do.push({ p: s.id, v: "cycle" }); notes.push(`${s.id} runs its cycle at the end`); }
  }
  // 10. a car stands on the ground: never in front of the face (out in the air) or over an open pit
  for (const c of parts.filter((p) => p.kind === "car" && Array.isArray(p.params.pos) && p.params.axis !== "z")) {
    let [x, y, z] = c.params.pos;
    const over = world.cut && x > world.cut.x0 - 2.2 && x < world.cut.x1 + 2.2 && z > world.cut.z0 - 1.2;
    if (z > -1.2 || over) { z = over ? +(world.cut.z0 - 1.4).toFixed(2) : -1.2; c.params.pos = [x, y, z]; notes.push(`${c.id} stands on the ground`); }
  }
  return { layout: { ...L, world, parts, beats }, notes };
}
