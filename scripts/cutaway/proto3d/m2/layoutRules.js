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
  const roofs = settingBoxes(L.world?.backdrop).filter((b) => b.min[1] > 2);
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
  return { layout: { ...L, parts, beats }, notes };
}
