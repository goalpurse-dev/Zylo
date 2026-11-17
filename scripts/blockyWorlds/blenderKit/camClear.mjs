// THE VIEW CHECK (owner 2026-11-18, after "The Town Where Lies Grow Animal Noses" was blocked: 30 of 86 shots still
// failed after 2 fix rounds; the frames show cameras looking THROUGH people (a back or a shoulder fills the frame) and
// cameras standing BEHIND the subject (the back of a head)). Free and static, before any GPU: for every cam.push /
// cam.pull of a shot body it works out where the camera stands (the target, the distance and the yaw; yaw 0 = the camera
// on the target's -y side looking +y, yaw 180 = on the +y side looking -y, measured on that run's frames), where every
// character stands (literal poses, and poses inside `for i in range(n)` loops) and which way they face (facing(...) or
// rot 0 / 180). The problems go to the director with the other shot checks (director.mjs shotProblems), so the shot is
// rewritten before its preview; the preview + the checker still decide.

const NUM = String.raw`-?\d+(?:\.\d+)?`;
/** plain arithmetic with loop variables -> a number, or null */
function evalExpr(expr, vars = {}) {
  let e = String(expr ?? "").trim();
  for (const [k, v] of Object.entries(vars)) e = e.replace(new RegExp(`\\b${k}\\b`, "g"), `(${v})`);
  if (!e || !/^[-+*/.\d\s()]+$/.test(e)) return null;
  try { const v = Function(`"use strict"; return (${e});`)(); return Number.isFinite(v) ? v : null; } catch { return null; }
}
const splitTop = (s) => { const out = []; let d = 0, cur = ""; for (const ch of String(s)) { if (ch === "(" || ch === "[") d++; if (ch === ")" || ch === "]") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur); return out.map((x) => x.trim()); };

/** where the characters of a body stand: [{ who, x, y }] (literal poses and poses in simple range loops) */
export function standing(body) {
  const lines = String(body ?? "").split(/\r?\n/);
  const out = [];
  const loops = [];
  for (const raw of lines) {
    const indent = raw.match(/^\s*/)[0].length;
    while (loops.length && indent <= loops.at(-1).indent && raw.trim()) loops.pop();
    const loop = raw.match(/^\s*for\s+(\w+)\s+in\s+range\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)\s*:/);
    if (loop) { const a = loop[3] != null ? Number(loop[2]) : 0, b = loop[3] != null ? Number(loop[3]) : Number(loop[2]); loops.push({ indent, var: loop[1], values: Array.from({ length: Math.max(0, Math.min(40, b - a)) }, (_, k) => a + k) }); continue; }
    const m = raw.match(/\b(\w+)\.pose\([^\n]*?\bloc\s*=\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/);
    if (!m) continue;
    const parts = splitTop(m[2]);
    if (parts.length < 2) continue;
    const combos = loops.reduce((acc, l) => acc.flatMap((c) => l.values.map((v) => ({ ...c, [l.var]: v }))), [{}]);
    for (const vars of combos.slice(0, 60)) {
      const x = evalExpr(parts[0], vars), y = evalExpr(parts[1], vars);
      if (x != null && y != null) out.push({ who: m[1], x, y });
    }
  }
  return out;
}

/** literal facings: [{ who, x, y, fx, fy }] (facing(...) with literal points, or rot 0 / 180: 0 faces -y, 180 faces +y) */
export function facings(body) {
  const out = [];
  const re = new RegExp(String.raw`\b(\w+)\.pose\([^\n]*?\bloc\s*=\s*\(\s*(${NUM})\s*,\s*(${NUM})[^)]*\)[^\n]*?\brot\s*=\s*(?:facing\(\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*,\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*\)|(${NUM}))`);
  for (const raw of String(body ?? "").split(/\r?\n/)) {
    const m = raw.match(re);
    if (!m) continue;
    const x = Number(m[2]), y = Number(m[3]);
    if (m[4] != null) { const fx = Number(m[6]) - Number(m[4]), fy = Number(m[7]) - Number(m[5]); const n = Math.hypot(fx, fy); if (n > 1e-6) out.push({ who: m[1], x, y, fx: fx / n, fy: fy / n }); }
    else if (m[8] != null) { const r = ((Number(m[8]) % 360) + 360) % 360; if (r === 0) out.push({ who: m[1], x, y, fx: 0, fy: -1 }); else if (r === 180) out.push({ who: m[1], x, y, fx: 0, fy: 1 }); }
  }
  return out;
}

const RE_PUSH = new RegExp(String.raw`cam\.(push|pull)\(\s*[^,()]+,\s*[^,()]+,\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*,\s*(${NUM})\s*,\s*(${NUM})([^)\n]*)\)`, "g");
const kw = (rest, k) => { const m = String(rest).match(new RegExp(String.raw`\b${k}\s*=\s*(${NUM})`)); return m ? Number(m[1]) : null; };
/** the camera's ground position for a yaw (the x side of a yaw is not measured: only yaws near 0 / 180 are trusted) */
export const camAt = (tx, ty, d, yawDeg) => { const a = (yawDeg * Math.PI) / 180; return [tx - d * Math.sin(a), ty - d * Math.cos(a)]; };
const BODY_R = 1.25; // a character's half width with a little margin (the kit's body is ~3.2 wide with the arms)
const SUBJECT_R = 2.6; // people this close to the target are the subject, never "in the way"

/** who stands between the camera and the target */
function blockers(cam, [tx, ty], people) {
  const dx = tx - cam[0], dy = ty - cam[1], L2 = dx * dx + dy * dy;
  if (L2 < 1e-6) return [];
  const out = [];
  for (const p of people) {
    if (Math.hypot(p.x - tx, p.y - ty) < SUBJECT_R) continue;
    const u = ((p.x - cam[0]) * dx + (p.y - cam[1]) * dy) / L2;
    const perp = Math.abs((p.x - cam[0]) * dy - (p.y - cam[1]) * dx) / Math.sqrt(L2);
    if (u > 0 && u < 0.92 && perp < BODY_R) out.push(p);
  }
  return out;
}

const BACK_OK = /\b(back|behind|from behind|over the shoulder|over-the-shoulder|walks? away|runs? away|leaves|silhouette|pov)\b/i;
/** a shot body (+ its desc) -> [problem]: the camera looks THROUGH someone at the subject, or stands BEHIND the subject */
export function viewProblems(body, desc = "") {
  const out = [], people = standing(body), faces = facings(body);
  for (const m of String(body ?? "").matchAll(RE_PUSH)) {
    const tx = Number(m[2]), ty = Number(m[3]), tz = Number(m[4]), d0 = Number(m[5]), d1 = Number(m[6]), rest = m[7];
    const yaw = kw(rest, "yaw") ?? 0, pitch = kw(rest, "pitch") ?? 0;
    if (pitch >= 24 || tz > 7) continue; // over the heads
    if (Math.abs(Math.sin((yaw * Math.PI) / 180)) > 0.35) continue; // only where the yaw reading is sure
    const cam = camAt(tx, ty, Math.min(d0, d1), yaw);
    const b = blockers(cam, [tx, ty], people);
    if (b.length) out.push(`the camera (yaw ${yaw}, near (${cam.map((v) => v.toFixed(1)).join(", ")})) looks THROUGH ${[...new Set(b.map((x) => x.who))].join(", ")} standing between it and the subject, so a back or a shoulder fills the frame: turn the camera so nobody stands in the line of sight, or move them aside`);
    if (BACK_OK.test(desc)) continue;
    const subj = faces.filter((f) => Math.hypot(f.x - tx, f.y - ty) < SUBJECT_R).sort((a, c) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(c.x - tx, c.y - ty))[0];
    if (!subj) continue;
    const vx = cam[0] - subj.x, vy = cam[1] - subj.y, n = Math.hypot(vx, vy) || 1;
    if ((subj.fx * vx + subj.fy * vy) / n < -0.5) out.push(`the camera stands BEHIND ${subj.who} (they face away from it), so the frame shows the back of their head: film them from the front or the side (turn the camera about 180 degrees, or turn them toward it)`);
  }
  return [...new Set(out)];
}
