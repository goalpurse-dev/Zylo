// THE CAMERA FIX (owner 2026-11-18, after "The Town Where Lies Grow Animal Noses" was blocked: cameras behind heads,
// through crowds, heads cut off). Free and static, on the PLAN (the director's shot bodies) before any GPU:
//   1. never from BEHIND the subject's head, unless the shot is about what they look at: then over the shoulder with
//      their face partly visible (the camera at least ~25 degrees off straight behind, close to the shoulder)
//   2. never THROUGH a crowd: nobody (no character box) between the lens and the subject's face / chest
//   3. heads never cut: the subject's head top inside the frame with headroom, the face in the upper part of the frame,
//      the head's width inside the frame
// and a failing shot is RE-AIMED: its cam.push / cam.pull is replaced by two exact cam.key keys (a gentle push in) from a
// solver that searches angles round the subject's front, heights (eye level, then over the crowd) and distances near
// the director's own, keeping the lens (the longest one of a crash zoom).
//
// THE CAMERA MODEL (measured on the run's frames, our own numbers, no kit code read): cam.push(t0, t1, target, d0, d1,
// yaw, pitch, lens) puts the camera at target + d * (-sin(yaw) cos(pitch), -cos(yaw) cos(pitch), sin(pitch)) looking at
// the target (yaw 0 = on the -y side looking +y); the kit's sensor is 24 mm VERTICAL (worlds.py zw_clear_view), so
// tan(half the vertical view) = 12 / lens and the horizontal one is 9/16 of it. Shot 29 checked: the model puts Esme's
// hair top at z 5.5 (a kit character is 5.4 tall + hair). The x side of a sideways yaw is not measured, so an existing
// camera is judged on both mirror readings (a problem only when both show it); the fix writes exact positions.
// A kit character at size s: about 5.4 s tall (head top ~5.6 s with hair, face centre 4.6 s), ~2 s wide, ~1.2 s deep.

const NUM = String.raw`-?\d+(?:\.\d+)?`;
const R = (re, f = "") => new RegExp(re, f);

// ---------------------------------------------------------------- reading a body
function evalExpr(expr, vars = {}) {
  let e = String(expr ?? "").trim();
  for (const [k, v] of Object.entries(vars)) e = e.replace(R(`\\b${k}\\b`, "g"), `(${v})`);
  // Python's floor division on the loop's whole numbers: "(i // 4)" with i = 6 -> "(1)"; % works the same in JS
  for (let n = 0; n < 4 && /\/\//.test(e); n++) e = e.replace(/\(\s*(-?\d+)\s*\)\s*\/\/\s*(\d+)/g, (m, a, b) => `(${Math.floor(Number(a) / Number(b))})`);
  if (!e || /\/\//.test(e) || !/^[-+*/%.\d\s()]+$/.test(e)) return null;
  try { const v = Function(`"use strict"; return (${e});`)(); return Number.isFinite(v) ? v : null; } catch { return null; }
}
const splitTop = (s) => { const out = []; let d = 0, cur = ""; for (const ch of String(s)) { if (ch === "(" || ch === "[") d++; if (ch === ")" || ch === "]") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur); return out.map((x) => x.trim()); };

/** the characters of a body: [{ who, x, y, s, fx, fy }] (literal poses and simple range loops; facing(...) or rot 0/180) */
export function people(body) {
  const lines = String(body ?? "").split(/\r?\n/);
  const sizes = {};
  for (const raw of lines) {
    const a = raw.match(R(String.raw`^\s*(\w+)\s*=\s*[\w.]+\([^\n]*\bscale\s*=\s*(${NUM})`));
    if (a) sizes[a[1]] = Number(a[2]);
    const b = raw.match(R(String.raw`\b(\w+)\.root\.scale\s*=\s*\(\s*(${NUM})`));
    if (b) sizes[b[1]] = Math.max(sizes[b[1]] ?? 1, Number(b[2]));
    const c = raw.match(R(String.raw`zw_grow\(\s*(\w+)\s*,[^,]+,[^,]+,\s*(${NUM})\s*,\s*(${NUM})`));
    if (c) sizes[c[1]] = Math.max(sizes[c[1]] ?? 1, Number(c[2]), Number(c[3]));
  }
  const out = [], loops = [], tuples = {};
  for (const raw of lines) {
    const indent = raw.match(/^\s*/)[0].length;
    while (loops.length && indent <= loops.at(-1).indent && raw.trim()) loops.pop();
    const loop = raw.match(/^\s*for\s+(\w+)\s+in\s+range\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)\s*:/);
    if (loop) { const a = loop[3] != null ? Number(loop[2]) : 0, b = loop[3] != null ? Number(loop[3]) : Number(loop[2]); loops.push({ indent, var: loop[1], values: Array.from({ length: Math.max(0, Math.min(40, b - a)) }, (_, k) => a + k) }); continue; }
    // a position held in a variable ("p = (-6 + i * 2, -11, 0)" then "k.pose(t0, loc=p)")
    const tv = raw.match(/^\s*(\w+)\s*=\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/);
    if (tv && splitTop(tv[2]).length >= 2) { tuples[tv[1]] = tv[2]; continue; }
    const m = raw.match(/\b(\w+)\.pose\(([^\n]*)$/);
    if (!m) continue;
    const named = m[2].match(/\bloc\s*=\s*(\w+)\s*[,)]/);
    const loc = named && tuples[named[1]] ? [null, tuples[named[1]]] : m[2].match(/\bloc\s*=\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/);
    if (!loc) continue;
    const parts = splitTop(loc[1]);
    if (parts.length < 2) continue;
    const rot = m[2].match(/\brot\s*=\s*(facing\(\s*\(([^()]*)\)\s*,\s*\(([^()]*)\)\s*\)|-?\d+(?:\.\d+)?)/);
    const combos = loops.reduce((acc, l) => acc.flatMap((c) => l.values.map((v) => ({ ...c, [l.var]: v }))), [{}]);
    for (const vars of combos.slice(0, 60)) {
      const x = evalExpr(parts[0], vars), y = evalExpr(parts[1], vars);
      if (x == null || y == null) continue;
      let fx = null, fy = null;
      if (rot?.[2] != null) {
        const p = splitTop(rot[2]).map((e) => evalExpr(e, vars)), q = splitTop(rot[3]).map((e) => evalExpr(e, vars));
        if ([p[0], p[1], q[0], q[1]].every((v) => v != null)) { const dx = q[0] - p[0], dy = q[1] - p[1], n = Math.hypot(dx, dy); if (n > 1e-6) { fx = dx / n; fy = dy / n; } }
      } else if (rot?.[1] != null) {
        const r = ((Number(rot[1]) % 360) + 360) % 360;
        if (r === 0) { fx = 0; fy = -1; } else if (r === 180) { fx = 0; fy = 1; }
      }
      // a later pose of the same single character moves it (the last literal pose wins); loop members are kept apart
      const i = loops.length ? -1 : out.findIndex((o) => o.who === m[1] && !o.loop);
      const rec = { who: m[1], x, y, s: sizes[m[1]] ?? 1, fx, fy, loop: loops.length > 0 };
      if (i >= 0) out[i] = { ...out[i], ...rec, fx: fx ?? out[i].fx, fy: fy ?? out[i].fy }; else out.push(rec);
    }
  }
  return out;
}

const RE_PUSH = R(String.raw`cam\.(push|pull)\(\s*([^,()]+),\s*([^,()]+),\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*,\s*(${NUM})\s*,\s*(${NUM})([^)\n]*)\)`, "g");
const RE_KEY = R(String.raw`cam\.key\(\s*([^,()]+),\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*,\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)([^)\n]*)\)`, "g");
const kw = (rest, k) => { const m = String(rest).match(R(String.raw`\b${k}\s*=\s*(${NUM})`)); return m ? Number(m[1]) : null; };
/** the cameras of a body: [{ text, t0, t1, T: [x,y,z], d0, d1, yaw, pitch, lens }] (cam.push / cam.pull with literal numbers) */
/** THE LIBRARY'S TESTED SPOTS (worlds.py ZW_SPOTS) as data: { place: { spot: [cam, target, lens] } }, read from the
 *  worlds.py text (2026-11-18: the living room's "close" spot looks at (-1, 0) on a 35 mm lens; the Sock director stood
 *  people at y 4, so 9 shots showed an empty corner, and the camera fix could not see it) */
export function parseSpots(worldsText) {
  const out = {};
  const T3 = String.raw`\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)`;
  for (const line of String(worldsText ?? "").split(/\r?\n/)) {
    const m = line.match(/^\s*"(\w+)":\s*\{(.*)\},?\s*$/);
    if (!m || !/"\w+":\s*\(\(/.test(m[2])) continue;
    for (const s of m[2].matchAll(R(String.raw`"(\w+)":\s*\(\s*${T3}\s*,\s*${T3}\s*,\s*(${NUM})\s*\)`, "g"))) {
      (out[m[1]] ??= {})[s[1]] = [[+s[2], +s[3], +s[4]], [+s[5], +s[6], +s[7]], +s[8]];
    }
  }
  return out;
}
/** THE SPOT MARKS (owner 2026-11-18: "the director places characters ON the spot's marks, the camera does not chase
 *  them"): for one tested spot, where its camera looks on the ground and where 1-3 people stand so every head is in the
 *  frame (side by side ~1.9 apart, across the view, at the target's distance; only as many as fit) ->
 *  { look: [x, y], marks: [[x, y, 0], ...] } */
export function spotMarks([C, T, lens]) {
  const dx = T[0] - C[0], dy = T[1] - C[1], D0 = Math.hypot(dx, dy) || 1;
  const ux = dx / D0, uy = dy / D0, px = -uy, py = ux; // along / across the view
  // the people stand ALONG the view where a person is readable (about 35% of the frame height or more), never farther
  // than the spot's own target, never closer than 3
  const tanV = 12 / lens, D = Math.max(3, Math.min(D0, 5.6 / (0.35 * 2 * tanV)));
  const cx = C[0] + ux * D, cy = C[1] + uy * D;
  const halfW = D * tanV * (9 / 16);
  const marks = [];
  for (let k = 1; k <= 3; k++) {
    const off = Array.from({ length: k }, (_, i) => (i - (k - 1) / 2) * 1.9);
    if (Math.max(...off.map(Math.abs)) + 0.8 > 0.9 * halfW) break;
    marks.splice(0, marks.length, ...off.map((o) => [+(cx + px * o).toFixed(1), +(cy + py * o).toFixed(1), 0]));
  }
  return { look: [+T[0].toFixed(1), +T[1].toFixed(1)], marks: marks.length ? marks : [[+cx.toFixed(1), +cy.toFixed(1), 0]] };
}
/** the marks a spot really frames well: people on them pass the same camera check (fewest first dropped); [] = this
 *  spot frames no person well (it looks up at a sign, a roof, a giant: for things, not people) */
export function goodMarks(spots, place, name) {
  const sp = spots?.[place]?.[name];
  if (!sp) return [];
  const all = spotMarks(sp).marks;
  for (let k = all.length; k >= 1; k--) {
    const ms = k === all.length ? all : [all[Math.floor((all.length - 1) / 2)], ...all.filter((_, i) => i !== Math.floor((all.length - 1) / 2))].slice(0, k);
    const body = ms.map((p, i) => `    P${i} = kid(t0, t1)\n    P${i}.pose(t0, loc=(${p[0]}, ${p[1]}, 0), rot=facing((${p[0]}, ${p[1]}), (${sp[0][0]}, ${sp[0][1]})))`).join("\n") + `\n    cam = Cam()\n    zw_spot(cam, "${place}", "${name}", t0, t1)`;
    if (!shotViewProblems(body, "", { spots }).length) return ms;
  }
  return [];
}
/** the director's table of every spot's marks (one line a place) */
export function spotMarksDoc(spots) {
  return Object.entries(spots ?? {}).map(([place, ss]) => `- ${place}: ${Object.keys(ss).map((name) => { const ms = goodMarks(spots, place, name), look = spotMarks(ss[name]).look; return ms.length ? `${name} looks at (${look.join(", ")}): stand ${ms.length === 1 ? "the subject at" : `up to ${ms.length} at`} ${ms.map((p) => `(${p[0]}, ${p[1]}, 0)`).join(" ")}` : `${name}: things only (frames no person well)`; }).join(" | ")}`);
}
const RE_SPOT = R(String.raw`zw_spot\(\s*cam\s*,\s*["'](\w+)["']\s*,\s*["'](\w+)["']\s*,\s*([^,()]+),\s*([^,()]+)(?:,\s*push\s*=\s*(${NUM}))?(?:,\s*lens\s*=\s*(${NUM}))?\s*\)`, "g");
export function cameras(body, { spots = null } = {}) {
  const out = [];
  // a tested library spot (zw_spot): the same as two exact keys (worlds.py: the end pushed `push` of the way in)
  if (spots) for (const m of String(body ?? "").matchAll(RE_SPOT)) {
    const sp = spots[m[1]]?.[m[2]];
    if (!sp) continue;
    const [C0, T, ln] = sp, push = m[5] != null ? Number(m[5]) : 0.08, lens = m[6] != null ? Number(m[6]) : ln;
    const C1 = C0.map((v, i) => v + (T[i] - v) * push);
    out.push({ kind: "spot", text: m[0], t0: m[3].trim(), t1: m[4].trim(), C0, C1, T0: T, T1: T, T, lens, yaw: 0, pitch: 0, d0: Math.hypot(...sub(C0, T)), d1: Math.hypot(...sub(C1, T)) });
  }
  for (const m of String(body ?? "").matchAll(RE_PUSH)) {
    out.push({ text: m[0], t0: m[2].trim(), t1: m[3].trim(), T: [Number(m[4]), Number(m[5]), Number(m[6])], d0: Number(m[7]), d1: Number(m[8]), yaw: kw(m[9], "yaw") ?? 0, yaw1: kw(m[9], "yaw1"), pitch: kw(m[9], "pitch") ?? 0, lens: kw(m[9], "lens") ?? 35 });
  }
  // exact keys: the first two literal cam.key(t, (x, y, z), (tx, ty, tz), lens=L) of the body (its start and its end)
  const keys = [...String(body ?? "").matchAll(RE_KEY)];
  if (keys.length >= 2) {
    const k = (m) => ({ text: m[0], t: m[1].trim(), C: [+m[2], +m[3], +m[4]], T: [+m[5], +m[6], +m[7]], lens: kw(m[8] ?? "", "lens") ?? 35 });
    const a = k(keys[0]), b = k(keys[1]);
    out.push({ kind: "key", text: a.text, text1: b.text, t0: a.t, t1: b.t, C0: a.C, C1: b.C, T0: a.T, T1: b.T, T: b.T, lens: Math.max(a.lens, b.lens), yaw: 0, pitch: 0, d0: Math.hypot(...sub(a.C, a.T)), d1: Math.hypot(...sub(b.C, b.T)) });
  }
  return out;
}
/** the longest lens a crash zoom reaches in a body (cam.crash(t, from, to, ...)) */
const crashLens = (body) => Math.max(0, ...[...String(body ?? "").matchAll(R(String.raw`cam\.crash\(\s*[^,]+,\s*(${NUM})\s*,\s*(${NUM})`, "g"))].flatMap((m) => [Number(m[1]), Number(m[2])]));

// ---------------------------------------------------------------- geometry
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };
export const camFromPush = (T, d, yaw, pitch, side = 1) => { const a = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180; return [T[0] - side * d * Math.sin(a) * Math.cos(p), T[1] - d * Math.cos(a) * Math.cos(p), T[2] + d * Math.sin(p)]; };
/** a world point -> the screen ([-1, 1] across, [-1, 1] up) of a camera at C looking at T with a lens; null behind it */
export function project(C, T, lens, P) {
  const f = norm(sub(T, C)), r = norm(cross(f, [0, 0, 1])), u = cross(r, f), v = sub(P, C), z = dot(v, f);
  if (z < 0.3) return null;
  const tv = 12 / lens, th = tv * 9 / 16;
  return { x: dot(v, r) / (z * th), y: dot(v, u) / (z * tv), z };
}
/** does the segment a->b pass through a character's box (x/y +-hw, z 0..h) before the last 8% of it */
function segHitsBox(a, b, p) {
  const hw = 0.95 * p.s, h = 5.5 * p.s;
  let t0 = 0, t1 = 0.92;
  const d = sub(b, a), lo = [p.x - hw, p.y - hw, 0], hi = [p.x + hw, p.y + hw, h];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (a[k] < lo[k] || a[k] > hi[k]) return false; continue; }
    let u0 = (lo[k] - a[k]) / d[k], u1 = (hi[k] - a[k]) / d[k];
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
const LOOKING = /\b(looks?|looking|watch(?:es|ing)?|stares?|staring|sees?|seeing|spots?|notices?|noticing|peeks?|peeking|points? at|pointing at|over the shoulder|over-the-shoulder|pov|what \w+ sees?)\b/i;

/** who a camera is about: the subject (the character nearest its target, within 3 sizes) and the group (everyone within
 *  3.2 sizes of the target, the subject first, at most 4): a two-shot keeps both heads in the frame */
function castOf(T, ps) {
  const c = ps.map((p) => ({ p, d: Math.hypot(p.x - T[0], p.y - T[1]) })).sort((a, b) => a.d - b.d);
  const subj = c.find((o) => o.d < 3 * o.p.s)?.p ?? null;
  if (!subj) return null;
  const group = c.filter((o) => o.d < 3.2 * o.p.s && !(o.p.loop && o.p !== subj && o.p.who === subj.who && false)).map((o) => o.p).slice(0, 4);
  return { subj, group };
}
const face = (p) => [p.x, p.y, 4.6 * p.s], chest = (p) => [p.x, p.y, 3.2 * p.s], top = (p) => [p.x, p.y, 5.65 * p.s];

/** the problems of ONE camera position (exact): behind the subject's head, through someone, a head cut (top or side) */
export function viewOf({ C, T, lens, subj, group = [subj], ps, looking = false }) {
  const out = [];
  const inGroup = new Set(group);
  const others = ps.filter((p) => !inGroup.has(p) && Math.hypot(p.x - subj.x, p.y - subj.y) > 0.6 * subj.s);
  // 1. behind the head
  let ots = false;
  if (subj.fx != null) {
    const v = norm([C[0] - subj.x, C[1] - subj.y, 0]), d = subj.fx * v[0] + subj.fy * v[1];
    const dist = Math.hypot(C[0] - subj.x, C[1] - subj.y);
    if (d < -0.5) {
      ots = looking && d > -0.92 && dist < 4.5 * subj.s; // over the shoulder: off straight behind, close
      if (!ots) out.push(looking ? "behind the head (a look shot needs a real over-the-shoulder: closer, ~30 degrees off straight behind, the face partly seen)" : "behind the subject's head");
    }
  }
  // 1b. a group member nearer the lens than the subject, with their back to it (the back of their head fills the frame)
  for (const g of group) {
    if (g === subj || g.fx == null) continue;
    const gd = Math.hypot(C[0] - g.x, C[1] - g.y), sd = Math.hypot(C[0] - subj.x, C[1] - subj.y);
    const v = norm([C[0] - g.x, C[1] - g.y, 0]);
    if (gd < sd - 0.5 && g.fx * v[0] + g.fy * v[1] < -0.5 && segHitsBox(C, face(subj), { ...g, s: g.s * 1.25 })) out.push(`behind ${g.who}'s head`);
  }
  // 2. through someone (between the lens and any face / the subject's chest of the group)
  const blockers = others.filter((p) => group.some((g) => segHitsBox(C, face(g), p)) || segHitsBox(C, chest(subj), p));
  if (blockers.length) out.push(`through ${[...new Set(blockers.map((b) => b.who))].join(", ")}`);
  if (ps.some((p) => p !== subj && Math.abs(C[0] - p.x) < 1.0 * p.s && Math.abs(C[1] - p.y) < 1.0 * p.s && C[2] < 5.6 * p.s)) out.push("the camera is inside a character");
  // 3. every head of the group inside the frame (an over-the-shoulder subject is the frame's edge: not checked)
  for (const g of group) {
    if (ots && g === subj) continue;
    const t = project(C, T, lens, top(g)), fc = project(C, T, lens, face(g));
    if (!t || !fc) { if (g === subj) out.push("the subject is behind the camera"); continue; }
    const headH = Math.abs(t.y - fc.y) * 2.2;
    const hw = (0.75 * g.s) / (fc.z * (12 / lens) * 9 / 16);
    if (t.y > 0.92) out.push(`${g === subj ? "head" : `${g.who}'s head`} cut at the top`);
    if (Math.abs(fc.x) + hw > 1.0 && headH > 0.06) out.push(`${g === subj ? "head" : `${g.who}'s head`} cut at the side`);
    if (g === subj && headH > 0.16 && (1 - fc.y) / 2 > 0.5) out.push("the face sits in the lower half");
  }
  return [...new Set(out)];
}

// ---------------------------------------------------------------- the shot check + the re-aim
const sidesOf = (yaw) => (Math.abs(Math.sin((yaw * Math.PI) / 180)) > 0.05 ? [1, -1] : [1]);
/** the bad views of a camera on each mirror reading (a problem counts only when every reading shows one) */
/** a camera's start + end views (exact for keys and spots, the push's own model otherwise) */
const viewsOf = (c) => (c.kind === "key" || c.kind === "spot" ? [[c.C0, c.T0], [c.C1, c.T1]] : [[camFromPush(c.T, c.d0, c.yaw, c.pitch), c.T], [camFromPush(c.T, c.d1, c.yaw, c.pitch), c.T]]);
/** is any character's head inside the frame of this camera (at its start and its end)? */
const anyoneSeen = (c, ps, lens) => viewsOf(c).every(([C, T]) => ps.some((p) => { const q = project(C, T, lens, [p.x, p.y, 4.9 * p.s]); return q && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95; }));
/** who a camera is about: its target's cast; a camera aimed where NOBODY stands (the Sock's living-room corner) is about
 *  the character nearest its target, and that shot gets the problem "nobody in frame" -> { cast, nobody } | null */
function castFor(c, ps, lens) {
  const cast = castOf(c.T, ps);
  if (cast) return { cast, nobody: false };
  if (!ps.length || anyoneSeen(c, ps, lens)) return null;
  const near = [...ps].sort((a, b) => Math.hypot(a.x - c.T[0], a.y - c.T[1]) - Math.hypot(b.x - c.T[0], b.y - c.T[1]))[0];
  const k = castOf([near.x, near.y, 3.6 * near.s], ps);
  return k ? { cast: k, nobody: true } : null;
}
function judge(c, cast, ps, lens, looking) {
  if (c.kind === "key" || c.kind === "spot") return [[...new Set([[c.C0, c.T0], [c.C1, c.T1]].flatMap(([C, T]) => viewOf({ C, T, lens, subj: cast.subj, group: cast.group, ps, looking })))]];
  return sidesOf(c.yaw).map((side) => [...new Set([c.d0, c.d1].flatMap((d) => viewOf({ C: camFromPush(c.T, d, c.yaw, c.pitch, side), T: c.T, lens, subj: cast.subj, group: cast.group, ps, looking })))]);
}
/** a body (+ its desc) -> [problem] for every camera whose view is bad on BOTH mirror readings */
export function shotViewProblems(body, desc = "", { spots = null } = {}) {
  const ps = people(body), cams = cameras(body, { spots }), crash = crashLens(body);
  if (!ps.length || !cams.length) return [];
  const looking = LOOKING.test(desc);
  const out = [];
  for (const c of cams) {
    const lens = Math.max(c.lens, crash);
    const f0 = castFor(c, ps, lens);
    if (!f0) continue;
    if (f0.nobody) { out.push(`${f0.cast.subj.who}: nobody in frame (the camera looks where no character stands)`); continue; }
    const found = judge(c, f0.cast, ps, lens, looking);
    if (!found.every((f) => f.length)) continue;
    for (const p of found[0]) out.push(`${f0.cast.subj.who}: ${p}`);
  }
  return [...new Set(out)];
}

const r2 = (v) => Math.round(v * 100) / 100;
/**
 * ONE body -> { body, fixed: [text], left: [text] }: every camera with a bad view (on every reading) is replaced by two
 * exact cam.key keys from the solver. wall(pos, tgt) -> "" or why a camera / its ray is blocked by the place.
 */
export function reaimBody(body, desc = "", { wall = () => "", spots = null } = {}) {
  const ps = people(body), cams = cameras(body, { spots }), crash = crashLens(body);
  const looking = LOOKING.test(desc);
  let out = String(body ?? "");
  const fixed = [], left = [];
  for (const c of cams) {
    const lens = Math.max(c.lens, crash);
    const f0 = castFor(c, ps, lens);
    if (!f0) continue;
    const cast = f0.cast;
    const bad = f0.nobody ? [["nobody in frame (the camera looks where no character stands)"]] : judge(c, cast, ps, lens, looking);
    if (!bad.every((b) => b.length)) continue;
    const why = bad[0].join("; ");
    const sol = solve({ c, cast, ps, lens, looking, wall });
    if (!sol) { left.push(`${cast.subj.who}: ${why} (no clean angle found)`); continue; }
    const ind = (out.split(/\r?\n/).find((l) => l.includes(c.text)) ?? "").match(/^\s*/)[0];
    const key = (t, C) => `cam.key(${t}, (${C.map(r2).join(", ")}), (${sol.T.map(r2).join(", ")}), lens=${lens})`;
    if (c.kind === "key") out = out.replace(c.text, key(c.t0, sol.C0)).replace(c.text1, key(c.t1, sol.C1));
    else out = out.replace(c.text, `${key(c.t0, sol.C0)}\n${ind}${key(c.t1, sol.C1)}`);
    fixed.push(`${cast.subj.who}${cast.group.length > 1 ? ` + ${cast.group.length - 1}` : ""}: ${why} -> re-aimed (${sol.how})`);
  }
  return { body: out, fixed, left };
}

/** the solver: a camera round the group's front (or a real over-the-shoulder for a look shot) with a clean view */
function solve({ c, cast, ps, lens, looking, wall }) {
  const { subj, group } = cast, s = subj.s;
  const cx = group.reduce((a, p) => a + p.x, 0) / group.length, cy = group.reduce((a, p) => a + p.y, 0) / group.length;
  const orig = c.kind === "key" || c.kind === "spot" ? c.C1 : camFromPush(c.T, c.d1, c.yaw, c.pitch);
  // the front: the subject's facing; a group facing each other (a conversation): across their line, on the camera's side
  let front = subj.fx != null ? [subj.fx, subj.fy] : norm([orig[0] - cx, orig[1] - cy, 0]).slice(0, 2);
  const other = group.find((g) => g !== subj && g.fx != null);
  if (other && subj.fx != null && subj.fx * other.fx + subj.fy * other.fy < -0.5) {
    const lx = other.x - subj.x, ly = other.y - subj.y, n = Math.hypot(lx, ly) || 1;
    let px = -ly / n, py = lx / n;
    if (px * (orig[0] - cx) + py * (orig[1] - cy) < 0) { px = -px; py = -py; }
    front = [px, py];
  }
  const spread = Math.max(0, ...group.map((g) => Math.hypot(g.x - cx, g.y - cy)));
  const d0 = Math.max(2.8 * s, Math.min(c.d1 ?? c.d0, 30), spread / ((12 / lens) * 9 / 16) * 1.15);
  // clean = the same check the plan gets afterwards (the cast read from the new target) + the original subject's group
  const ok = (C, T) => {
    if (wall(C, T) || viewOf({ C, T, lens, subj, group, ps, looking: false }).length) return false;
    const k = castOf(T, ps);
    return !k || !viewOf({ C, T, lens, subj: k.subj, group: k.group, ps, looking }).length;
  };
  // a look shot that was behind: over the shoulder first (the face partly seen), aimed at what they look at
  if (looking && subj.fx != null) {
    const fwd = [subj.fx, subj.fy];
    const far = Math.hypot(c.T[0] - subj.x, c.T[1] - subj.y) > 3 * s ? c.T : [subj.x + fwd[0] * 8 * s, subj.y + fwd[1] * 8 * s, 3.6 * s];
    for (const side of [1, -1]) {
      const sv = [-fwd[1] * side, fwd[0] * side];
      const C = [subj.x - fwd[0] * 1.7 * s + sv[0] * 1.0 * s, subj.y - fwd[1] * 1.7 * s + sv[1] * 1.0 * s, 5.1 * s];
      // (2026-11-18: an over-the-shoulder that leaves the subject out of the frame is no fix: their head must be in it)
      const inFrame = anyoneSeen({ kind: "key", C0: C, C1: C, T0: far, T1: far, T: far }, [subj], lens);
      if (inFrame && !wall(C, far) && !ps.some((p) => p !== subj && segHitsBox(C, far, p)) && !viewOf({ C, T: far, lens, subj, group: [subj], ps, looking: true }).length) {
        return { C0: C.map((v, i) => v + (C[i] - far[i]) * 0.04), C1: C, T: far, how: "over the shoulder" };
      }
    }
  }
  // every clean candidate is scored: the closest (faces big enough to read), then the smallest turn, then eye level
  const ang0 = Math.atan2(front[1], front[0]);
  const dRef = Math.max(2.8 * s, Math.min(c.d1 ?? c.d0, 30));
  let best = null;
  for (const zc of [4.4 * s, 6.2 * s, 8.6 * s]) {
    for (const dA of [0, 20, -20, 35, -35, 50, -50, 70, -70]) {
      for (const k of [0.8, 0.9, 1, 1.15, 1.35, 1.6, 2, 2.5]) {
        const D = Math.max(2.6 * s, Math.min(d0, dRef) * k), a = ang0 + (dA * Math.PI) / 180;
        const C = [cx + Math.cos(a) * D, cy + Math.sin(a) * D, zc];
        for (const tz of [3.6 * s, 3.2 * s, 4.0 * s, 2.6 * s]) {
          const T = [cx, cy, tz];
          if (!ok(C, T)) continue;
          const C0 = C.map((v, i) => v + (C[i] - T[i]) * 0.06); // a gentle push in: the start a little further out
          if (!ok(C0, T)) continue;
          const score = D / dRef + (Math.abs(dA) / 90) * 0.5 + (zc > 5 * s ? 0.35 : 0) + (zc > 7 * s ? 0.35 : 0);
          if (!best || score < best.score) best = { score, C0, C1: C, T, how: `${dA ? `${Math.abs(dA)} degrees off the front` : "from the front"}, ${zc > 5 * s ? "over the heads" : "eye level"}, ${D.toFixed(1)} away${group.length > 1 ? `, all ${group.length} in frame` : ""}` };
          break;
        }
      }
    }
  }
  return best;
}

/** every body of a plan -> { fixed: { id: [text] }, left: { id: [text] } } (bodies changed in place) */
export function reaimPlan(bodies, shots, { wallFor = () => () => "", spots = null } = {}) {
  const fixed = {}, left = {};
  for (const s of shots) {
    const b = bodies[s.id];
    if (!b) continue;
    const r = reaimBody(b, s.desc ?? "", { wall: wallFor(s), spots });
    if (r.fixed.length) { bodies[s.id] = r.body; fixed[s.id] = r.fixed; }
    if (r.left.length) left[s.id] = r.left;
  }
  return { fixed, left };
}
