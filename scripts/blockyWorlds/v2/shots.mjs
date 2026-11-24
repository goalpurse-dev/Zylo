// IN THIS TOWN v2, step 2: SHOT ROWS. One row = one shot, built fresh: who stands on which spot, facing what, with
// which face / pose / held thing; the creature on a creature spot; prop states; a camera TYPE that code turns into a
// position from the subjects (never typed by hand). Free checks before anything renders.
//   row: { line, scene, time, cam: { type, subject: [ids], side? }, people: [{ id, spot, face, pose, facing, holds }],
//          creature: { spot, face, pose, facing, holds } | null, props: { porch_light: "on"|"off", drain: true, ... } }
import { BODY_R, MIN_GAP, H, CREATURE_R } from "./stageA.mjs";
import { checkStage, span, project } from "./stageCheck.mjs";
import { facingProblems } from "./facing.mjs";
import { CHARACTERS, NEIGHBOURS } from "./characters.mjs";
import { stageOf } from "./stages.mjs";

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const PROP_POINTS = { porch_light: [1.9, 17.62, 5.2], drain: [-3.0, -1.5, 0.05], house: [0, 22, 3], street: [0, -4, 2] };
const heightOf = (id) => CHARACTERS[id]?.height ?? H.kid;

/** where everyone in a row stands (world), the creature too */
export function placements(S, row) {
  const out = {};
  for (const p of row.people ?? []) out[p.id] = { at: S.spots[p.spot]?.at, h: S.spots[p.spot]?.head ?? heightOf(p.id), r: S.spots[p.spot]?.seat ? 0.7 : BODY_R };
  if (row.creature) out.creature = { at: S.creature_spots[row.creature.spot]?.at, h: heightOf(row.creature.id ?? "shadow"), r: CREATURE_R };
  return out;
}
/** a facing as a world point */
export function facingPoint(S, row, f, selfId, camLoc = null) {
  const pl = placements(S, row);
  if (f === "camera" && camLoc) return camLoc;
  if (f && typeof f === "object" && f.to) {
    if (pl[f.to]?.at) return [pl[f.to].at[0], pl[f.to].at[1], pl[f.to].at[2] + pl[f.to].h * 0.8];
    if (PROP_POINTS[f.to]) return PROP_POINTS[f.to];
    if (S.props_at?.[f.to]) return S.props_at[f.to];
    if (S.spots[f.to]) { const a = S.spots[f.to].at; return [a[0], a[1], a[2] + H.kid * 0.8]; }
    if (S.creature_spots[f.to]) { const a = S.creature_spots[f.to].at; return [a[0], a[1], a[2] + 6]; }
  }
  if (f === "away" && camLoc) { const me = pl[selfId].at; return [2 * me[0] - camLoc[0], 2 * me[1] - camLoc[1], 2]; }
  return PROP_POINTS.street;
}

// ---- THE CAMERA FROM THE SUBJECTS: a type -> the view direction (from the main subject's facing), then the distance
// and the aim height that keep every head in frame above the captions with nothing in the way (the stage's free check)
const LENS = { close: 45, medium: 32, two: 28, wide: 20, low: 20, side: 38, back: 28, ots: 30, insert: 40, top: 30 };
const PREF_D = { close: 0, medium: 0, two: 0, wide: 1, low: 0, side: 0, back: 0, ots: 0 };
export function solveCam(S, row) {
  const pl = placements(S, row);
  const c = row.cam ?? {};
  const type = c.type ?? "medium";
  if (type === "eyes") {     // the creature's eyes only (on purpose: its body stays in the dark)
    const a = pl.creature?.at ?? [0, 0, 0], h = pl.creature?.h ?? 8.5;
    const e = [a[0], a[1], a[2] + h * 0.95];
    const who = row.creature;
    const fp = facingPoint(S, row, who?.facing ?? "street", "creature");
    let fx = fp[0] - a[0], fy = fp[1] - a[1]; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    return { loc: [+(e[0] + fx * 6.5).toFixed(2), +(e[1] + fy * 6.5).toFixed(2), +(e[2] - 0.3).toFixed(2)], tgt: e.map((x) => +x.toFixed(2)), lens: 50, ok: true, type };
  }
  if (type === "insert") {   // a thing alone: from in front of it, close
    const p = S.props_at?.[c.subject?.[0]] ?? PROP_POINTS[c.subject?.[0]] ?? [0, 8, 1];
    const loc = c.subject?.[0] === "porch_light" ? [p[0] - 0.6, p[1] - 3.2, p[2] - 0.6] : [p[0] + 0.6, p[1] - 3.0, p[2] + 2.2];
    return { loc, tgt: p, lens: LENS.insert, ok: true, type };
  }
  const subj = (c.subject?.length ? c.subject : Object.keys(pl)).filter((k) => pl[k]?.at);
  if (!subj.length) return { ok: false, why: "no subject on stage" };
  const main = subj[0];
  const m = pl[main];
  // the main subject's facing -> the front direction
  const who = main === "creature" ? row.creature : (row.people ?? []).find((p) => p.id === main);
  const fp = facingPoint(S, row, who?.facing ?? "street", main);
  let fx = fp[0] - m.at[0], fy = fp[1] - m.at[1];
  const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
  const rot = (x, y, deg) => { const a = (deg * Math.PI) / 180; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };
  let dir = type === "side" ? rot(fx, fy, c.side === "left" ? -90 : 90) : type === "back" ? [-fx, -fy] : rot(fx, fy, c.side === "left" ? -25 : c.side === "right" ? 25 : 12);
  if ((type === "two" || type === "wide") && subj.filter((k) => k !== "creature").length >= 2) {
    const a = pl[subj[0]].at, b = pl[subj[1]].at;
    let px = -(b[1] - a[1]), py = b[0] - a[0];
    const pl0 = Math.hypot(px, py) || 1; px /= pl0; py /= pl0;
    const open = S.open_side ?? [0, -1];
    if (px * open[0] + py * open[1] < 0) { px = -px; py = -py; }
    dir = [px, py];
  }
  // over the shoulder: from behind the OTHER person, looking at the main subject
  let anchor = null;
  if (type === "ots" && subj[1] && pl[subj[1]]) { const o = pl[subj[1]].at; const v = [o[0] - m.at[0], o[1] - m.at[1]]; const l = Math.hypot(...v) || 1; dir = rot(v[0] / l, v[1] / l, 14); anchor = o; }
  const heads = [...subj.map((k) => [pl[k].at[0], pl[k].at[1], pl[k].at[2] + pl[k].h * (k === "creature" ? 0.85 : 0.82)]), ...(c.with ?? []).map((k) => PROP_POINTS[k]).filter(Boolean)];
  const C = [0, 1, 2].map((i) => heads.reduce((a, h) => a + h[i], 0) / heads.length);
  const lens = c.lens ?? LENS[type] ?? 30;
  const zc = type === "low" ? 0.55 : type === "wide" ? Math.max(3.5, C[2] + 1.5) : C[2] + 0.25;
  const peopleSpots = (row.people ?? []).filter((p) => subj.includes(p.id)).map((p) => p.spot);
  let best = null, minD = null;
  const yaws = c.side ? [0, 10, -10, 20, -20] : [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90];
  const dir0 = dir;
  for (const yw of yaws) {
  dir = rot(dir0[0], dir0[1], yw);
  for (let d = (anchor ? d2(anchor, C) + 1.6 : 2.6); d <= 30; d += 0.25) {
    for (let tz = Math.max(-1, C[2] - 3); tz <= C[2] + 3; tz += 0.25) {
      const loc = [C[0] + dir[0] * d, C[1] + dir[1] * d, zc];
      const cam = { loc, tgt: [C[0], C[1], tz], lens, shot: type, touch: Boolean(row.touch), people: peopleSpots, creature: subj.includes("creature") ? row.creature.spot : undefined };
      const probs = checkStage({ ...S, cameras: { x: cam } }).problems.filter((p) => p.startsWith("camera x:"));
      if (probs.length) continue;
      if (c.pull && c.pull > 1) { if (minD == null) minD = d * c.pull; if (d < minD - 1e-6) continue; }
      // the things it must also show ("with"), inside the frame
      if ((c.with ?? []).some((k) => { const q = project(cam, PROP_POINTS[k] ?? [0, 0, 0]); return !q || q[0] < 0.08 || q[0] > 0.92 || q[1] < 0.16 || q[1] > 0.6; })) continue;
      // the creature: always its WHOLE figure (feet to eyes) unless the shot is its eyes
      if (subj.includes("creature")) { const cs = span(cam, pl.creature.at, 1.2, 0, pl.creature.h); if (!cs || cs[2] < 0.02 || cs[3] > 0.98) continue; }
      const vs = peopleSpots.map((k) => span(cam, S.spots[k].at, 0.6, H.kid - 0.95, H.kid)).filter(Boolean).map((s) => (s[2] + s[3]) / 2);
      const vm = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0.3;
      const score = Math.abs(vm - (type === "low" ? 0.25 : 0.32)) * 10 + (PREF_D[type] ? 0 : d * 0.12);
      if (!best || score < best.score) best = { score, loc, tgt: [C[0], C[1], tz] };
    }
    if (best && !PREF_D[type]) break;
  }
  if (best) break;
  }
  if (!best) return { ok: false, why: `no ${type} camera frames ${subj.join(" + ")} with nothing in the way`, type };
  const r2 = (v) => v.map((x) => +x.toFixed(2));
  return { ok: true, loc: r2(best.loc), tgt: r2(best.tgt), lens, type, focus: type === "close" ? +d2(best.loc, C).toFixed(2) : null };
}

// ---- THE FREE CHECKS of a whole story's rows (nothing renders while any fails)
export function checkRows(S, story) {
  const out = [];
  const ids = new Set(Object.keys(story.cast));
  const lineText = (n) => story.lines[n - 1]?.text ?? "";
  const names = (n) => {   // the things a line names (cast by alias, the creature, props)
    const t = lineText(n).toLowerCase(), hit = [];
    for (const [id, al] of Object.entries(story.aliases)) if (al.some((a) => new RegExp(`\\b${a}\\b`, "i").test(t))) hit.push(id);
    return hit;
  };
  const byLine = {};
  story.rows.forEach((r, i) => { (byLine[r.line] ??= []).push({ r, i }); });
  let prev = null, ruleState = story.rule?.start ?? null;
  const lastSpot = {};   // scene -> id -> spot
  const lastSide = {};   // scene -> "a|b" -> order
  // THE HOOK (owner 2026-11-24): by 1.5 s a character big, sharp, from the front / three-quarter, the rule on or next
  // to them, nothing in front; never a back, an empty place, dark, an object alone or tiny people
  const h0 = story.rows[0];
  if (h0) {
    if (!["close", "medium", "two"].includes(h0.cam?.type) || !(h0.people ?? []).length) out.push(`row 1 (the hook): a ${h0.cam?.type ?? "?"} shot${(h0.people ?? []).length ? "" : " with nobody"}: the first shot is a character, big, from the front`);
    if (h0.time === "night") out.push("row 1 (the hook): night: the first picture must be bright and sharp");
    if (story.rule?.object && !story.rule?.tell_person && !((h0.cam?.with ?? []).includes(story.rule.object) || (h0.people ?? []).some((p) => p.holds === story.rule.object))) out.push(`row 1 (the hook): the rule object (${story.rule.object}) is not on or next to the character`);
  }
  if (h0 && story.rule?.tell_person && !(h0.people ?? []).some((p) => p.id === story.rule.tell_person) && !(story.rule.object && (h0.cam?.with ?? []).includes(story.rule.object))) out.push(`row 1 (the hook): the rule's tell is not in the first shot (show ${story.rule.tell_person}${story.rule.object ? ` or the ${story.rule.object}` : ""})`);
  const sideBack = story.rows.filter((r) => ["side", "back"].includes(r.cam?.type)).length;
  if (sideBack > Math.max(1, Math.round(0.15 * story.rows.length))) out.push(`${sideBack} side / back shots of ${story.rows.length}: at most about 15%`);
  const SHOCK = ["terrified", "crying"];
  const shocks = story.rows.flatMap((r) => (r.people ?? []).filter((p) => SHOCK.includes(p.face))).length;
  if (shocks > 2) out.push(`${shocks} big shock faces (terrified / crying): at most 2 per video`);
  const S0 = S;
  story.rows.forEach((r, i) => {
    const S = r.stage ? stageOf(r) : S0;
    const tag = `row ${i + 1} (line ${r.line})`;
    if (r.creature && r.cam?.type !== "eyes" && (r.cam?.subject ?? []).includes("creature") && ["close", "low"].includes(r.cam?.type)) out.push(`${tag}: the creature is never close to the lens (use its far spots; a close shot is its eyes only)`);
    if (i > 0 && r.cam?.type === "close" && story.rows[i - 1].cam?.type === "close") out.push(`${tag}: two close shots in a row`);
    const pl = placements(S, r);
    if ((r.people ?? []).length > 2) out.push(`${tag}: ${r.people.length} people (at most 2 + the creature)`);
    for (const p of r.people ?? []) {
      if (!ids.has(p.id)) out.push(`${tag}: "${p.id}" is not in the cast`);
      if (!S.spots[p.spot]) out.push(`${tag}: ${p.id} on unknown spot "${p.spot}"`);
    }
    if (r.creature && !S.creature_spots[r.creature.spot]) out.push(`${tag}: the creature must stand on a creature spot (got "${r.creature.spot}")`);
    const ps = r.people ?? [];
    for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) if (S.spots[ps[a].spot] && S.spots[ps[b].spot] && d2(S.spots[ps[a].spot].at, S.spots[ps[b].spot].at) < (r.touch ? 1.2 : MIN_GAP)) out.push(`${tag}: ${ps[a].id} and ${ps[b].id} stand closer than a body`);
    // the rule object's state changes only on a line whose words say so
    const rs = r.props?.[story.rule?.object];
    if (rs && ruleState && rs !== ruleState && !story.rule.change_words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lineText(r.line)))) out.push(`${tag}: the ${story.rule.object} turns ${rs} on a line that does not say so`);
    if (rs) ruleState = rs;
    // continuity in a scene: spots move only on a line with a movement word; two people never swap screen sides
    const sc = r.scene;
    lastSpot[sc] ??= {}; lastSide[sc] ??= {};
    for (const p of ps) {
      const was = lastSpot[sc][p.id];
      if (was && was !== p.spot && !/\b(walk|walks|walked|ran|run|runs|step|stepped|steps|got to|came|went|moved|hurried)\b/i.test(lineText(r.line))) out.push(`${tag}: ${p.id} jumps from ${was} to ${p.spot} with no movement in the words`);
      lastSpot[sc][p.id] = p.spot;
    }
    // the camera: from the subjects, framed, nothing in the way
    const cam = solveCam(S, r);
    r._cam = cam;
    if (!cam.ok) out.push(`${tag}: ${cam.why}`);
    if (cam.ok && ps.length === 2 && cam.type !== "insert") {
      const order = ps.map((p) => ({ id: p.id, u: span(cam, pl[p.id].at, 0.5, 0, pl[p.id].h)?.[0] ?? 0 })).sort((x, y) => x.u - y.u).map((x) => x.id).join("<");
      const key = [...ps.map((p) => p.id)].sort().join("|");
      if (lastSide[sc][key] && lastSide[sc][key] !== order) out.push(`${tag}: ${key.replace("|", " and ")} swap screen sides (${lastSide[sc][key]} -> ${order})`);
      lastSide[sc][key] = order;
    }
    // facing (nobody looks into the lens while the words say they look at something else)
    out.push(...facingProblems({ ...r, people: ps.map((p) => ({ id: p.id, facing: p.facing })) }, { lineText: lineText(r.line), named: names(r.line) }).map((x) => `${tag}: ${x}`));
    // two shots of one subject in a row differ by 30 degrees or 1.5x in size
    const pv = story.rows[i - 1];
    if (pv?._cam?.ok && cam.ok && pv.cam?.subject?.[0] && pv.cam.subject[0] === r.cam?.subject?.[0] && !["insert", "eyes"].includes(cam.type)) {
      const s0 = pl[r.cam.subject[0]]?.at;
      if (s0) {
        const a0 = Math.atan2(pv._cam.loc[1] - s0[1], pv._cam.loc[0] - s0[0]), a1 = Math.atan2(cam.loc[1] - s0[1], cam.loc[0] - s0[0]);
        const dAng = Math.abs(((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
        const r0 = d2(pv._cam.loc, s0) / pv._cam.lens, r1 = d2(cam.loc, s0) / cam.lens;
        if (dAng < 30 && Math.max(r0 / r1, r1 / r0) < 1.5) out.push(`${tag}: the same subject as the shot before from almost the same place (${dAng.toFixed(0)} degrees, ${Math.max(r0 / r1, r1 / r0).toFixed(2)}x)`);
      }
    }
    // never the same shot twice in a row
    const sig = (x) => `${x._cam?.type}|${x.cam?.side ?? ""}|${[...(x.cam?.subject ?? [])].sort().join(",")}|${(x.people ?? []).map((p) => `${p.spot}:${p.pose ?? "stand"}`).sort().join(",")}|${x.creature?.spot ?? ""}:${x.creature?.pose ?? ""}|${x.time}`;
    if (prev && sig(prev) === sig(r)) out.push(`${tag}: the same shot as the row before`);
    prev = r;
  });
  // named = shown: every thing a line names is in one of that line's rows
  story.lines.forEach((L, k) => {
    const n = k + 1, rows = (byLine[n] ?? []).map((x) => x.r);
    if (!rows.length) { out.push(`line ${n}: no shot`); return; }
    for (const id of names(n)) {
      const ids2 = story.alias_any?.[id] ?? [id];
      const shown = rows.some((r) => (r.people ?? []).some((p) => ids2.includes(p.id)) || (id === "creature" && r.creature) || (r.props && id in r.props && r.props[id] !== false) || (r.cam?.subject ?? []).includes(id) || (r.people ?? []).some((p) => p.holds === id) || r.creature?.holds === id);
      if (!shown) out.push(`line ${n}: names "${id}" but no shot shows it`);
    }
  });
  return out;
}

// ---- BACKGROUND PEOPLE (places have their people): the stage's background spots that are in this shot's frame,
// further from the lens than the subjects by 3+, never over a subject's head; 2 by day / sunset / morning, 1 at night
export function backgroundFor(S, r, cam) {
  if (r.bg === false || !cam?.ok || ["insert", "eyes"].includes(cam.type) || !S.background) return [];
  const pl = placements(S, r);
  const subjHeads = Object.values(pl).filter((p) => p.at).map((p) => span(cam, p.at, 0.7, 0, p.h)).filter(Boolean);
  const subjDepth = Math.max(0, ...Object.values(pl).filter((p) => p.at).map((p) => d2(cam.loc, p.at)));
  const want = r.time === "night" ? 1 : 2;
  const out = [];
  for (const [k, b] of Object.entries(S.background)) {
    if (!b.times.includes(r.time)) continue;
    const sp = span(cam, b.at, 0.7, 0, 3.2);
    if (!sp || sp[1] < 0.06 || sp[0] > 0.94 || sp[2] < 0.05 || sp[3] > 1.2) continue;
    if (d2(cam.loc, b.at) < subjDepth + 3) continue;
    if (subjHeads.some((h) => sp[1] > h[0] - 0.03 && sp[0] < h[1] + 0.03 && sp[2] < h[3])) continue;
    out.push({ spot: k, at: b.at, loop: b.loop, who: Object.keys(NEIGHBOURS)[out.length % 4] });
    if (out.length >= want) break;
  }
  return out;
}

// ---- THE COMPOSITION CHECK (free, before any render): people in frame, the biggest head, closes, profiles / backs,
// the longest still
export function composition(S, story, { wps = 3.8 } = {}) {
  const S0 = S;
  const per = story.rows.map((r) => {
    const S = r.stage ? stageOf(r) : S0;
    const cam = r._cam ?? solveCam(S, r);
    const pl = placements(S, r);
    let n = 0, head = 0;
    for (const [id, p] of Object.entries(pl)) {
      if (!p.at || !cam.ok || cam.type === "insert") continue;
      const s = span(cam, p.at, 0.6, id === "creature" ? p.h * 0.8 : p.h - 1.0, p.h);
      if (s && s[1] > 0.02 && s[0] < 0.98 && s[3] > 0.02 && s[2] < 0.98) { n++; head = Math.max(head, Math.min(1, s[3]) - Math.max(0, s[2])); }
    }
    n += backgroundFor(S, r, cam).length;
    const words = (story.lines[r.line - 1]?.text ?? "").split(/s+/).length;
    const rowsOfLine = story.rows.filter((x) => x.line === r.line).length;
    return { n, head, type: cam.type, secs: words / wps / rowsOfLine };
  });
  const N = per.length || 1;
  const pct = (f) => Math.round((100 * per.filter(f).length) / N);
  return {
    shots: per.length,
    people_in_frame: { none: pct((x) => x.n === 0), one: pct((x) => x.n === 1), two_plus: pct((x) => x.n >= 2) },
    biggest_head_share: +Math.max(...per.map((x) => x.head)).toFixed(2),
    close_share: pct((x) => x.type === "close" || x.type === "eyes"),
    profile_or_back_share: pct((x) => ["side", "back"].includes(x.type)),
    longest_still_s: +Math.max(...per.map((x) => x.secs)).toFixed(1),
    aims: "two or more people in 25-50% of shots; closes 10-15% (at most 1.5 s, never two in a row); side / back at most 15%; no still over about 2.5 s",
  };
}

// ---- A ROW -> THE SHOT'S PYTHON (one fresh build)
const P = (v) => `(${v.map((x) => +(+x).toFixed(3)).join(", ")})`;
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
export function rowPython(S0, story, r, { stageId = "A" } = {}) {
  const S = r.stage ? stageOf(r) : S0;
  stageId = r.stage ?? stageId;
  const cam = r._cam ?? solveCam(S, r);
  const pl = placements(S, r);
  const L = [`zv_build(${py(stageId)}, ${py(r.time)}, t0, t1)`];
  if (r.props?.porch_light) L.push(`_pl = zv_porch_light(${r.props.porch_light === "on" ? "True" : "False"})`);
  if (r.props?.street_lamps) L.push(`zv_street_lamps(True)`);
  if (r.props?.drain) L.push(`_dr = zc_prop("drain", "zv_drain")`, `_dr.location = ${P(PROP_POINTS.drain)}`, `_dr.scale = (0.85, 0.85, 0.85)`);
  const vars = [];
  (r.people ?? []).forEach((p, k) => {
    const v = `p${k}`, at = pl[p.id].at;
    vars.push([v, p.id]);
    L.push(`${v} = ZChar(${py(story.cast[p.id].name)}, ZC_SPECS[${py(story.cast[p.id].spec)}], ${P(at)}, rot=0, badge=${p.id === "me" ? "True" : "False"})`);
    const dflt = CHARACTERS[story.cast[p.id].spec]?.default_face ?? (story.cast[p.id].spec?.startsWith("mimic") ? "mimic_smile" : "neutral");
    L.push(`${v}.pose(t0, ${py(p.pose ?? "stand")})`, `zc_react(${v}, t0, ${py(p.face ?? dflt)}, ${py(dflt)})`);
    const look = facingPoint(S, r, p.facing ?? "street", p.id, cam.loc);
    if (S.spots[p.spot]?.seat) { L.push(`zv_sit(${v}, t0, ${P(S.spots[p.spot].at)})`, `zc_look(${v}, t0, ${P(p.facing === "camera" && cam.loc ? cam.loc : look)})`); }
    else if (p.facing === "camera" || p.facing === "away" || ["side", "back"].includes(cam.type) || !cam.loc) L.push(`${v}.face_to(${P(look)})`);
    else L.push(`${v}.turn(t0, ${P(look)}, ${P(cam.loc)})`);
    L.push(`zc_blinks(${v}, t0, t1)`, `zc_idle(${v}, t0, t1)`);
    if (["walk", "run"].includes(p.pose)) L.push(`zc_walk(${v}, t0, t1, run=${p.pose === "run" ? "True" : "False"})`);
    if (p.holds) L.push(`${v}.hold(t0, zc_prop(${py(story.props[p.holds]?.kind ?? p.holds)}, ${py(`zv_${p.holds}${k}`)}, on=${story.props[p.holds]?.on === false || r.props?.[p.holds] === "off" ? "False" : "True"}), ${py(p.hands ?? (story.props[p.holds]?.hands ?? "R"))})`);
  });
  if (r.creature) {
    const c = r.creature, at = pl.creature.at;
    L.push(`cr = ZChar(${py(story.cast.creature.name)}, ZC_SPECS[${py(story.cast.creature.spec)}], ${P(at)}, rot=0, badge=False)`);
    L.push(`cr.pose(t0, ${py(c.pose ?? "stand")})`, `cr.express(t0, ${py(c.face ?? "shadow_stare")})`, `cr.face_to(${P(facingPoint(S, r, c.facing ?? "street", "creature", cam.loc))})`, `zc_idle(cr, t0, t1, 0.6)`);
    if (["walk", "run"].includes(c.pose)) L.push(`zc_walk(cr, t0, t1, run=${c.pose === "run" ? "True" : "False"}, back=2.5)`);
    if (c.holds) L.push(`_h = cr.hold(t0, zc_prop(${py(story.props[c.holds]?.kind ?? c.holds)}, "zv_crhold", on=True), "L")`);
  }
  if (cam.ok && cam.type === "insert" && r.cam?.subject?.[0] === "porch_light") L.push(`cam = Cam()`, `cam.key(t0, (_pl.x - 0.5, _pl.y - 4.4, _pl.z - 1.0), (_pl.x - 0.15, _pl.y, _pl.z - 0.45), lens=30, focus=4.4, fstop=2.2)`);
  else if (cam.ok) { const end = cam.loc.map((x, i) => x + (cam.tgt[i] - x) * 0.06); L.push(`cam = Cam()`, `cam.key(t0, ${P(cam.loc)}, ${P(cam.tgt)}, lens=${cam.lens}${cam.focus ? `, focus=${cam.focus}, fstop=2.4` : ""})`, `cam.key(t1, ${P(end)}, ${P(cam.tgt)}, lens=${cam.lens}${cam.focus ? `, focus=${+(cam.focus * 0.94).toFixed(2)}, fstop=2.4` : ""})`); }
  else L.push(`cam = Cam()`, `cam.key(t0, (0, -20, 5), (0, 0, 2), lens=30)`);
  if (S.build === "dining") L.push(`zv_empty_chairs(ZV_STAGES[${py(stageId)}], ${py((r.people ?? []).map((p) => p.spot))})`);
  // the background people (calm, behind the subject)
  backgroundFor(S, r, cam).forEach((b, k) => {
    const spec = NEIGHBOURS[b.who];
    L.push(`bg${k} = ZChar(${py(`Nb${k}`)}, ZC_SPECS[${py(b.who)}], ${P(b.at)}, rot=0, badge=False)`);
    L.push(`bg${k}.pose(t0, ${py({ talk: "talk", phone: "hold_phone", walk: "walk", stand: "stand" }[b.loop] ?? "stand")})`, `bg${k}.express(t0, ${py(spec.default_face ?? "neutral")})`);
    if (b.loop === "phone") L.push(`bg${k}.hold(t0, zc_prop("phone", "zv_bgphone${k}"), "both")`);
    L.push(`bg${k}.face_to(${P(b.loop === "walk" ? [b.at[0] + 20, b.at[1], 2] : [cam.loc[0], cam.loc[1], 2])})`);
  });
  for (const [v] of vars) L.push(`zc_char_light(${v}, ${P(cam.loc ?? [0, -20, 5])}, ${py(r.time)})`);
  L.push(`ZV_SHOT.clear(); ZV_SHOT.update({"cam": ${py(cam.type)}, "subjects": [${vars.filter(([, id]) => (r.cam?.subject ?? []).includes(id)).map(([v, id]) => `(${py(id)}, ${v})`).join(", ")}], "creature": ${r.creature && (r.cam?.subject ?? []).includes("creature") ? "cr" : "None"}})`);
  return L.join("\n");
}
