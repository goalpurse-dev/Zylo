// M2: focus boxes, the world-space box each part occupies once built ({min:[x,y,z], max:[x,y,z]}). The camera
// director frames them and the code checks measure them on screen. A part may set its own `focus`; otherwise it
// is derived from its params. Parts with no place of their own (light, soil shading) have none.

import { rigBox } from "./rig.js";

const fromPoints = (pts, pad = 0) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i] - pad); max[i] = Math.max(max[i], p[i] + pad); }
  return { min, max };
};
const fromBox = (b) => ({ min: [b.x0, b.y0, b.z0], max: [b.x1, b.y1, b.z1] });
const centered = (c, s) => ({ min: c.map((v, i) => v - s[i] / 2), max: c.map((v, i) => v + s[i] / 2) });
export const union = (boxes) => fromPoints(boxes.filter(Boolean).flatMap((b) => [b.min, b.max]));
export const boxCenter = (b) => b.min.map((v, i) => (v + b.max[i]) / 2);
export const boxSize = (b) => b.max.map((v, i) => v - b.min[i]);

/** cut: the world's cut ({x0, x1, z0, depth}), for the parts that fill it */
/**
 * A street queue as the camera should see it: the signal and the first two cars waiting at its stop line (the lane seen
 * end on hides the rest; the whole lane framed put the cars far off, the signal alone left them out). Null without both.
 */
export function signalQueueBox(sig, traffic, cut) {
  if (!sig || !traffic) return null;
  let sb = null; try { sb = focusOf(sig, cut); } catch { return null; }
  const [x, zs] = traffic.params?.lane ?? [0, 0], d = traffic.params?.dir ?? -1, g = traffic.params?.gap ?? 5.6, y = traffic.params?.y ?? 0.12;
  const z2 = zs - d * (2.4 + g + 2.2);
  return union([sb, { min: [x - 1.1, y, Math.min(zs, z2)], max: [x + 1.1, y + 1.9, Math.max(zs, z2)] }]);
}

/** a shot's focus id: a part, or "part.node" for one piece of a designed part (rig.js) */
export function focusOfId(parts, id, cut) {
  const [pid, node] = String(id).split(".");
  const p = parts.get(pid); if (!p) return null;
  if (node && p.kind === "rig") return rigBox(p.params ?? {}, { node });
  try { return focusOf(p, cut); } catch { return null; }
}

export function focusOf(part, cut) {
  if (part.focus) return part.focus.min ? part.focus : centered(part.focus.c, part.focus.s);
  const p = part.params ?? {};
  const cutBox = cut ? { min: [cut.x0, -cut.depth, cut.z0], max: [cut.x1, 0, 0] } : null;
  switch (part.kind) {
    case "dig": return cutBox;
    case "box": return centered(p.pos, p.size);
    case "panels": return union(p.panels.map((q) => { const s = q.size.map(Math.abs), a = q.anchor ?? [0, 0, 0]; return centered(q.pos.map((v, i) => v + (a[i] * s[i]) / 2), s); }));
    case "bags": return { min: [p.area.x0, p.y0, p.area.z0], max: [p.area.x1, p.y0 + (p.h ?? 1.6), p.area.z1] };
    case "dumpTruck": return null; // it drives through
    case "pipeRun": case "pipe": return fromPoints(p.path, p.r ?? p.opts?.r ?? 0.24);
    case "tank": return { min: [p.pos[0] - (p.r ?? 1.3), p.pos[1], p.pos[2] - (p.r ?? 1.3)], max: [p.pos[0] + (p.r ?? 1.3), p.pos[1] + (p.h ?? 2.6) * 1.15, p.pos[2] + (p.r ?? 1.3)] };
    case "riser": return { min: [p.x - 0.3, p.y0, p.z - 0.3], max: [p.x + 0.3, p.y1, p.z + 0.3] };
    case "boxPop": return centered(p.pos, p.size);
    case "cabinet": { const [w, h, d] = p.size ?? [0.9, 1.3, 0.6], [x, y, z] = p.pos ?? [0, 0.75, -1]; return { min: [x - w / 2 - 0.15, y - h / 2, z - d / 2 - 0.15], max: [x + w / 2 + 0.15, y + h / 2 + 0.24, z + d / 2 + 0.15 + w] }; }
    case "flare": return { min: [p.pos[0] - 0.8, p.pos[1], p.pos[2] - 0.8], max: [p.pos[0] + 0.8, p.pos[1] + 2.4, p.pos[2] + 0.8] };
    case "settle": { const b = p.box ?? { x0: -1.5, x1: 1.5, y0: -3, y1: -0.6, z0: -2, z1: 0 }; return { min: [b.x0 - 0.15, b.y0 - 0.15, b.z0], max: [b.x1 + 0.15, b.y1 + 0.15, b.z1] }; }
    case "creek": { if (p.axis === "z") { const w = p.width ?? 2.6, x = p.x ?? 17, d = p.depth ?? 0.8; return { min: [x - w / 2 - 0.5, -d - 0.2, Math.max(p.z0 ?? -26, -8)], max: [x + w / 2 + 0.5, 0.3, 0.05] }; } const w = p.width ?? 2.4, z = p.z ?? -w / 2 - 0.02, d = p.depth ?? 0.7; return { min: [p.x0 ?? 4, -d - 0.2, z - w / 2 - 0.4], max: [p.x1 ?? 14, 0.3, z + w / 2 + 0.2] }; }
    case "flow": return fromPoints(p.path ?? [[0, 0.1, 0], [3, 0.1, 0]], p.size ?? 0.16);
    case "prop": { const [x, y, z] = p.pos ?? [0, 0, 0], s = p.scale ?? 1; return { min: [x - 0.8 * s, y, z - 0.5 * s], max: [x + 0.8 * s, y + 1.9 * s, z + 0.5 * s] }; }
    case "grate": { const [x, y, z] = p.pos ?? [0, 0.1, -1.5], w = p.width ?? 1.6, d = p.depth ?? 0.8; return { min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + 0.1, z + d / 2] }; }
    case "canopy": return { min: [p.x0 ?? -3, p.y ?? 0, p.z0 ?? -5], max: [p.x1 ?? 3, (p.y ?? 0) + (p.h ?? 4) + 0.3, p.z1 ?? -1] };
    case "car": { const [x, y, z] = p.pos ?? [0, 0.1, -2], s = p.scale ?? 1; return p.axis === "z" ? { min: [x - 1 * s, y, z - 2.2 * s], max: [x + 1 * s, y + 1.9 * s, z + 2.2 * s] } : { min: [x - 2.2 * s, y, z - 1 * s], max: [x + 2.2 * s, y + 1.9 * s, z + 1 * s] }; }
    // a lane of queued cars: from the stop line back along the lane (cityParts.js traffic)
    case "traffic": { const [x, zs] = p.lane ?? [-6, 4], d = p.dir ?? 1, n = p.n ?? 4, g = p.gap ?? 5.6, y = p.y ?? 0.12, far = zs - d * (2.4 + (n - 1) * g + 2.2); return { min: [x - 1.1, y, Math.min(zs, far)], max: [x + 1.1, y + 1.9, Math.max(zs, far)] }; }
    case "counter": { const [x, y, z] = p.pos ?? [0, 2.5, -1], S = p.size ?? 0.8, s = S * 0.6; return { min: [x - s, y - s, z - 0.1], max: [x + (p.bar ? S * 1.2 : s), y + (p.bar ? S * 1.6 : s), z + 0.12] }; }
    case "carWash": { const [x, y, z] = p.pos ?? [0, 0.1, -2], w = p.width ?? 3.6, h = p.height ?? 3.4; return { min: [x - w / 2 - 0.7, y, z - 0.3], max: [x + w / 2 + 0.7, y + h + 0.2, z + 1.7] }; }
    case "trafficLight": { const [x, y, z] = p.pos ?? [4, 0.1, -1], h = p.height ?? 5, arm = p.arm > 0.5 ? p.arm : 0, dir = p.armDir ?? -1; const x0 = Math.min(x - 0.6, x + dir * arm - 0.7), x1 = Math.max(x + 0.6, x + dir * arm + 0.7); return { min: [x0, y, z - 0.4], max: [x1, y + (arm ? h + 0.3 : h + 2.9), z + 0.8] }; }
    case "hydrant": { const [x, y, z] = p.pos ?? [0, 0.12, -0.5], d = p.depth ?? 3.2; return { min: [x - 0.6, y - d - 0.4, -0.4], max: [x + 0.6, y + 1.6, z + 0.6] }; }
    // the vending machine (vending.js: 2.0 wide, 3.2 tall, 1.5 deep, from its base centre): a planned one has no part-level
    // focus box (the scene reply has no field for it), so without this the camera could not frame it and stood far off
    case "vendingMachine": { const [x, y, z] = p.pos ?? [0, 0.12, -1.5]; return { min: [x - 1.1, y, z - 0.8], max: [x + 1.1, y + 3.3, z + 0.8] }; }
    case "rig": return rigBox(p);
    case "atm": { const [x, y, z] = p.pos ?? [0, 0.12, -1]; return { min: [x - 0.8, y, z - 0.6], max: [x + 0.8, y + 2.6, z + 0.7] }; }
    case "machine": return { min: [p.pos[0] - 1.5, 0, p.pos[2] - 1.2], max: [p.pos[0] + 1.5, 2.7, p.pos[2] + 1.2] };
    case "bubbles": return { min: [p.x0, p.y0, (p.z ?? -0.15) - 0.2], max: [p.x1, p.y1, (p.z ?? -0.15) + 0.2] };
    case "fence": return { min: [p.x0, 0, p.zBack], max: [p.x1, 1.15, p.zFront] };
    case "youngTrees": return fromPoints(p.trees.map(([x, z, s]) => [x, 2.6 * s * 2, z]).concat(p.trees.map(([x, z]) => [x, 0, z])), 1.2);
    case "sheet": return fromPoints([p.to], 1.2);
    case "book": return fromPoints([p.to], Math.max(p.w ?? 1.8, p.h ?? 2.4) / 2);
    case "flag": return { min: [p.at[0] - 0.2, p.at[1], p.at[2] - 0.2], max: [p.at[0] + (p.w ?? 1.8) + 0.2, p.at[1] + (p.pole ?? 2.6), p.at[2] + 0.2] };
    case "shrubs": return fromPoints(p.list.map(([x, z]) => [x, 0.5, z]), 0.8);
    case "sign": { const s = p.scale ?? 1.5; return { min: [p.at[0] - 2.8 * s, p.at[1], p.at[2] - 0.3], max: [p.at[0] + 2.8 * s, p.at[1] + 4.75 * s, p.at[2] + 0.3] }; }
    case "crack": return fromPoints(p.points, 0.2);
    case "drops": return { min: [p.x0, p.landY ?? -0.3, -0.5], max: [p.x1, p.fromY ?? 0.7, 0.3] };
    case "wipe": return fromBox(p.box);
    // fills seen in section: the slice at the cut face is what the viewer sees
    case "water": case "gravel": case "soakPit": case "wrap": { const b = fromBox(p.box); b.min[2] = Math.max(b.min[2], b.max[2] - 0.6); return b; }
    case "puddles": return fromPoints(p.list.map(([x, z, rx, rz]) => [x - rx, 0, z - rz]).concat(p.list.map(([x, z, rx, rz]) => [x + rx, 0.05, z + rz])));
    case "pipeFlow": case "pipeRunFlow": return null; // inside its pipe
    case "arrows": return fromPoints(p.list.map((a) => a.at), 0.6 * (p.opts?.scale ?? 1.25));
    case "outline": return fromPoints(p.points, 0.15);
    case "seepFlow": return { min: [-(p.width ?? 4.4) / 2 - 2, p.floor ?? -11.2, 0], max: [(p.width ?? 4.4) / 2 + 2, p.y0 ?? -6.2, 0.3] };
    default: return null; // rain, stream, light, lawnWet, soilLeak, wetBand, soak
  }
}
