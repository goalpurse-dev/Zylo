// Blocky Worlds HARD STILL GATE, the pipeline step (owner, 2026-11-09: "reject any still where >60% of pixels are one
// flat colour, sky-only, a wall, or the camera is inside geometry. This must run on RunPod stills before render, with
// automatic re-plan"). The prepare job (runpod/worker.mjs), after the builder and the shot review, before the pre-render
// checks: a still of every shot (lib/vision/stills.mjs on the review's warm Chrome page; a shot the review already
// rendered unchanged is not rendered again: its measurement is reused), each through lib/stillGate.js. A failing shot is
// re-planned from its own content (never a new thing on screen): the ladder
//     action (the line's subject, a medium) -> reaction (a face, a closeup) -> world wide (a wide, no camera move)
//     -> last resort: the framing of a shot on the same set that PASSED (its camera, place, spot; a world wide first)
// each change kept only when the pre-render checks get no new problem (lib/vision/replan.js problemKeys: checkTimeline +
// checkVisuals + checkSubjects + checkProduction + the kit check), the changed shots rendered again (a sub-timeline:
// only their sets load) and gated again. Up to `rounds` ladder rounds, then the world wide, then the borrowed framing.
//   const { report } = await gateShots({ tl, stills, cache, check, until, rounds = 2, log })   (tl changed in place)
//   report (visual-check.json .stillGate): { v, passes, shots: [{ shot, line, first, final, how, tries }], fixed,
//     unresolved: [{ shot, codes, hard }], unverified, warn, ms, stopped }
// HARD codes (flat / wall / sky_only / camera_inside / blocked / too_dark / blown_out): an unresolved one REJECTS the
// run (worker: STILL_GATE, nothing rendered). subject_missing is re-planned the same way but never rejects on its own.
import { subTimeline } from "./requirements.js";
// the re-plan guard (the same multiset compare as lib/vision/replan.js applyFixes; kept here so this module loads
// without the planner's modules): a change is kept only when the checks get no problem that was not there before
let threw = 0;
const problemList = (check, tl) => { try { return (check?.(tl) ?? []).map((p) => (typeof p === "string" ? p : JSON.stringify(p))); } catch (e) { return [`check threw (${++threw}): ${e.message}`]; } };
const norm = (p) => p.replace(/\b(shot|shots|line|subject|visual)\s+\d+/gi, "$1 #").replace(/"(shot|line)":\d+/g, '"$1":#');
export const problemKeys = (check, tl) => { const m = new Map(); for (const p of problemList(check, tl)) { const k = norm(p); m.set(k, [...(m.get(k) ?? []), p]); } return m; };
export const addedProblems = (before, after) => [...after].flatMap(([k, list]) => list.slice(before.get(k)?.length ?? 0));

export const HARD_CODES = Object.freeze(["flat", "wall", "sky_only", "camera_inside", "blocked", "too_dark", "blown_out"]);
export const GATE_DEFAULTS = Object.freeze({ mode: "reject", rounds: 2, loadMs: 15000, stillMs: 400, minPassMs: 8000 });
const EPIC_CAMS = new Set(["establish", "hero_low", "track", "aerial", "giant_close", "duel", "behind_army"]);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------------------------------------------ keys + summaries
const KEY_SKIP = new Set(["start", "end", "line", "lines", "text", "part"]);
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).filter((k) => !KEY_SKIP.has(k)).sort().map((k) => `${k}:${stable(v[k])}`).join(",")}}` : JSON.stringify(v ?? null));
/** a shot's content (no timing): the same framing in the whole timeline or in a sub-timeline gives the same key */
export const shotKey = (shot) => { const s = stable(shot); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return `${(h >>> 0).toString(36)}:${s.length}`; };
export const frameKey = (shot, phase) => `${shotKey(shot)}@${Math.round(Math.max(0, Math.min(1, Number(phase) || 0)) * 20) / 20}`;
/** the gate measurement, small enough for the report / the RESULT */
export function gateSummary(g) {
  const v = g?.verdict ?? {};
  const st = g?.stats, geo = g?.geo;
  return {
    pass: v.pass ?? null, codes: v.codes ?? [], reasons: (v.reasons ?? []).map((r) => `${r.code}: ${r.why}`.slice(0, 160)), warn: (v.warn ?? []).map((r) => `${r.code}: ${r.why}`.slice(0, 120)),
    ...(st ? { px: { mean: st.mean, flat: st.flat, clusters: st.clusters, centreEdges: st.centreEdges, sky: st.sky } } : {}),
    ...(geo ? { geo: { inside: geo.inside, near: geo.near, sky: geo.sky, block: geo.block, pitch: geo.pitch, subject: geo.subject ? { focus: geo.subject.focus, roots: geo.subject.roots, rays: geo.subject.rays } : null } } : {}),
    ...(g?.error ? { error: String(g.error).slice(0, 160) } : {}),
  };
}
export const isHard = (codes) => (codes ?? []).some((c) => HARD_CODES.includes(c));

/** a cache of gate results by shot content (filled by every still the shared renderer measures, the review's too) */
export function makeGateCache() {
  const byShot = new Map();
  return {
    size: () => byShot.size,
    add(still) { if (!still?.shotKey || !still.gate || still.gate.pass == null) return; const l = byShot.get(still.shotKey) ?? []; l.push(still.gate); byShot.set(still.shotKey, l); },
    /** the shot's measured verdict (any failing still of this content fails it), or null */
    get(shot) { const l = byShot.get(shotKey(shot)); if (!l?.length) return null; return l.find((g) => g.pass === false) ?? l[0]; },
  };
}

// ------------------------------------------------------------------------------------------------ the ladder
const subjectActor = (s) => {
  const ids = (s.actors ?? []).map((a) => a.id);
  if (s.subject && ids.includes(s.subject)) return s.subject;
  if (ids.includes(s.focus)) return s.focus;
  return (s.actors ?? []).find((a) => a.pose && !["stand", "sit"].includes(a.pose))?.id ?? ids[0] ?? null;
};
const sameAs = (s, patch) => Object.entries(patch).every(([k, v]) => (v === null ? s[k] == null : JSON.stringify(s[k]) === JSON.stringify(v)));

/**
 * The re-plan alternatives of a shot, from its OWN content (its actors, its set, its focus): [{ how, patch }]
 * in the order action -> reaction -> world wide; a patch equal to the current framing is left out. patch values of
 * null delete the field (camMove: a still framing).
 */
export function alternatives(s) {
  const who = subjectActor(s), ids = (s.actors ?? []).map((a) => a.id);
  const other = ids.find((id) => id !== who) ?? who;
  const f = String(s.focus ?? ""), epic = EPIC_CAMS.has(s.camera) || /^(giant:|crowd)/.test(f) || f === "world";
  const out = [];
  if (epic) {
    out.push({ how: "action", patch: { camera: "establish" } });
    if (who) out.push({ how: "reaction", patch: { camera: "closeup", focus: who } });
    out.push({ how: "world", patch: { camera: "establish", focus: f === "world" || /^creature:/.test(s.set ?? "") ? "world" : f || "world", camMove: null } });
  } else {
    if (who) out.push({ how: "action", patch: { camera: "medium", focus: who } });
    else out.push({ how: "action", patch: { camera: "medium" } });
    if (other) out.push({ how: "reaction", patch: { camera: "closeup", focus: other } });
    out.push({ how: "world", patch: { camera: "wide", focus: ids.length > 1 ? "group" : who ?? s.focus ?? "group", camMove: null } });
  }
  // GATE 2026-11-09 (#3 "the turtle stopped mid-step": its tilt_up move stood the lens against the turtle's head and
  // every re-plan kept the move, which replaces the framing): a re-planned framing drops the shot's camera move
  if (s.move) for (const a of out) a.patch.move = null;
  return out.filter((a) => !sameAs(s, a.patch));
}

/** the last resort: the framing of the nearest shot on the same set that passed (a wide / establish first) */
export function borrowedFraming(tl, i, passed) {
  const s = tl.shots[i], ids = (s.actors ?? []).map((a) => a.id);
  const cands = [...passed].filter((j) => j !== i && tl.shots[j] && tl.shots[j].set === s.set && tl.shots[j].camera !== "insert");
  if (!cands.length) return null;
  const wideish = (j) => (["wide", "establish", "aerial"].includes(tl.shots[j].camera) ? 0 : 1);
  cands.sort((a, b) => wideish(a) - wideish(b) || Math.abs(a - i) - Math.abs(b - i));
  const d = tl.shots[cands[0]];
  const fOk = d.focus && (!ids.length || ids.includes(d.focus) || !(d.actors ?? []).some((a) => a.id === d.focus));
  return { how: "borrowed", from: cands[0], patch: { ...(s.move ? { move: d.move ?? null } : {}), camera: d.camera, place: d.place ?? null, worldSpot: d.worldSpot ?? null, camMove: null, focus: fOk ? d.focus : ids.length > 1 ? "group" : subjectActor(s) ?? d.focus } };
}

function applyPatch(shot, patch) { for (const [k, v] of Object.entries(patch)) { if (v === null) delete shot[k]; else shot[k] = clone(v); } }

// ------------------------------------------------------------------------------------------------ the pass
const withDeadline = (p, deadline, what) => {
  const left = deadline - Date.now();
  if (left <= 0) return Promise.reject(Object.assign(new Error(`time budget reached before ${what}`), { timeout: true }));
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error(`time budget reached during ${what}`), { timeout: true })), left); })]).finally(() => clearTimeout(t));
};
export const gated = (s) => Boolean(s) && s.camera !== "insert" && !s.insert;

export async function gateShots({ tl, stills, cache = null, check = null, until = null, rounds = GATE_DEFAULTS.rounds, budget = {}, log = () => {} } = {}) {
  const B = { ...GATE_DEFAULTS, ...budget };
  const T0 = Date.now(), deadline = Number(until) || T0 + 120000;
  const report = { v: 1, passes: [], shots: [], fixed: [], unresolved: [], unverified: [], warn: [], cached: 0, ms: 0, stopped: null };
  const finish = (stopped = null) => { report.stopped ??= stopped; report.ms = Date.now() - T0; return { tl, report }; };
  if (!tl?.shots?.length) return finish("no shots");
  const verdict = new Map(), rec = new Map();
  const idxs = tl.shots.map((s, i) => (gated(s) ? i : -1)).filter((i) => i >= 0);
  let perStill = B.stillMs, loadMs = B.loadMs;
  const renderer = typeof stills === "function" ? null : stills;
  let R = renderer;
  // render + gate a list of shots (their middles) on a sub-timeline; -> number rendered
  const renderShots = async (list, name) => {
    const P = { pass: report.passes.length + 1, name, shots: list.length, loadMs: 0, ms: 0, failed: 0 };
    report.passes.push(P);
    const est = (report.passes.length > 1 ? Math.max(3000, Math.min(loadMs, (2 * loadMs * list.length) / Math.max(1, idxs.length))) : loadMs) + list.length * perStill;
    P.estMs = Math.round(est);
    if (deadline - Date.now() < Math.max(B.minPassMs, est)) { P.skipped = `time: ~${Math.round(est / 1000)} s needed, ${Math.max(0, Math.round((deadline - Date.now()) / 1000))} s left`; return false; }
    R ??= await withDeadline(Promise.resolve(stills()), deadline, "the still renderer");
    const sub = subTimeline(tl, list);
    const picks = list.map((i) => ({ key: `g${i}`, idx: i, t: +sub.map(i, (tl.shots[i].start + tl.shots[i].end) / 2).toFixed(3) }));
    const t0 = Date.now();
    let got;
    try { got = await withDeadline(R.renderTimeline(sub.tl, picks, { name: `gate${P.pass}`, gate: true, onLoad: (ms) => { P.loadMs = ms; } }), deadline, "the gate stills"); }
    catch (e) { if (!e.timeout) throw e; P.skipped = e.message; return false; }
    P.ms = Date.now() - t0;
    if (P.pass === 1 || !report.passes.some((x) => x.loadMs && x !== P)) loadMs = Math.max(3000, P.loadMs || loadMs);
    const ok = got.stills.filter((s) => !s.error);
    if (ok.length) perStill = Math.max(100, (P.ms - P.loadMs) / ok.length);
    for (const s of got.stills) {
      cache?.add(s);
      const g = s.error ? { pass: null, error: s.error } : s.gate ?? { pass: null, error: "not measured" };
      verdict.set(s.idx, g);
      if (g.pass === false) P.failed++;
    }
    log(`still gate pass ${P.pass} (${name}): ${list.length} shots, ${P.failed} failing (load ${P.loadMs} ms, ${P.ms} ms; ${Math.round((deadline - Date.now()) / 1000)} s left)`);
    return true;
  };
  try {
    // 1. every gated shot: the cached measurement (the review rendered this very content), else a render
    const todo = [];
    for (const i of idxs) { const c = cache?.get(tl.shots[i]); if (c) { verdict.set(i, c); report.cached++; } else todo.push(i); }
    if (todo.length && !(await renderShots(todo, "all"))) {
      for (const i of todo) report.unverified.push({ shot: i, why: report.passes.at(-1)?.skipped ?? "not rendered" });
      return finish(`pass 1: ${report.passes.at(-1)?.skipped ?? "not rendered"}`);
    }
    for (const i of idxs) {
      const g = verdict.get(i);
      rec.set(i, { shot: i, line: tl.shots[i].line ?? null, camera: tl.shots[i].camera, focus: tl.shots[i].focus ?? null, first: g?.pass === false ? g.codes : g?.pass ? "pass" : "unmeasured", tries: [] });
      if (g?.warn?.length) report.warn.push({ shot: i, warn: g.warn });
    }
    // 2. the re-plan rounds: ladder steps, then the world wide, then the borrowed framing
    const ladders = new Map(), originals = new Map(), best = new Map();
    let failing = idxs.filter((i) => verdict.get(i)?.pass === false);
    const passed = () => new Set(idxs.filter((i) => verdict.get(i)?.pass === true));
    let before = check ? problemKeys(check, tl) : null;
    for (let round = 1; failing.length && round <= rounds + 2; round++) {
      const changed = [];
      for (const i of failing) {
        if (!ladders.has(i)) { originals.set(i, clone(tl.shots[i])); ladders.set(i, alternatives(tl.shots[i])); }
        const g = verdict.get(i), r = rec.get(i);
        const prevBest = best.get(i);
        if (!prevBest || (g.reasons?.length ?? 9) <= prevBest.n) best.set(i, { n: g.reasons?.length ?? 9, codes: g.codes ?? [], reasons: g.reasons ?? [], shot: clone(tl.shots[i]) });
        const L = ladders.get(i);
        // the ladder is spent by `rounds` steps; then its world wide; then the borrowed framing
        const steps = round <= rounds ? L.filter((a) => a.how !== "world") : round === rounds + 1 ? L.filter((a) => a.how === "world") : [borrowedFraming(tl, i, passed())].filter(Boolean);
        let applied = null;
        while (steps.length && !applied) {
          const a = steps.shift();
          const ix = L.indexOf(a); if (ix >= 0) L.splice(ix, 1);
          const keep = clone(tl.shots[i]);
          applyPatch(tl.shots[i], a.patch);
          if (check) {
            const after = problemKeys(check, tl), added = addedProblems(before, after);
            if (added.length) { tl.shots[i] = keep; r.tries.push({ how: a.how, patch: a.patch, reverted: added[0].slice(0, 140) }); continue; }
            before = after;
          }
          applied = a;
        }
        if (applied) { changed.push(i); r.tries.push({ how: applied.how, patch: applied.patch, ...(applied.from != null ? { from: applied.from } : {}) }); }
      }
      if (!changed.length) { if (round > rounds + 1) break; continue; }
      if (!(await renderShots(changed, round <= rounds ? `ladder ${round}` : round === rounds + 1 ? "world wide" : "borrowed"))) {
        for (const i of changed) { report.unverified.push({ shot: i, how: rec.get(i).tries.at(-1)?.how, why: report.passes.at(-1)?.skipped ?? "not rendered" }); verdict.set(i, { pass: null, error: "unverified" }); }
        report.stopped = `round ${round}: ${report.passes.at(-1)?.skipped}`;
        failing = failing.filter((i) => !changed.includes(i));
        break;
      }
      for (const i of changed) { const g = verdict.get(i); rec.get(i).tries.at(-1).result = g?.pass === false ? g.codes : g?.pass ? "pass" : "unmeasured"; }
      failing = failing.filter((i) => verdict.get(i)?.pass === false);
    }
    // 3. what still fails: the least bad framing tried is kept (fewest reasons, re-checked); hard ones are unresolved
    for (const i of failing) {
      let g = verdict.get(i);
      const b = best.get(i);
      if (b && (g.reasons?.length ?? 9) > b.n) {
        const keep = tl.shots[i];
        tl.shots[i] = clone(b.shot);
        if (check) { const after = problemKeys(check, tl); if (addedProblems(before, after).length) tl.shots[i] = keep; else before = after; }
        if (tl.shots[i] !== keep) { g = { ...g, codes: b.codes, reasons: b.reasons }; verdict.set(i, g); rec.get(i).tries.push({ how: "least bad kept", codes: b.codes }); }
      }
      const codes = g.codes ?? [];
      report.unresolved.push({ shot: i, line: tl.shots[i].line ?? null, codes, reasons: g.reasons ?? [], hard: isHard(codes) });
    }
    for (const [i, r] of rec) {
      const g = verdict.get(i);
      r.final = g?.pass === false ? g.codes : g?.pass ? "pass" : "unmeasured";
      r.how = r.tries.filter((t) => !t.reverted).at(-1)?.how ?? null;
      if (r.first !== "pass" && r.first !== "unmeasured" && r.final === "pass") report.fixed.push({ shot: i, how: r.how, was: r.first });
      if (r.first !== "pass" || r.tries.length) report.shots.push(r);
    }
    log(`still gate: ${idxs.length} shots (${report.cached} from the review's stills), ${report.shots.filter((r) => r.first !== "pass" && r.first !== "unmeasured").length} failed first, ${report.fixed.length} fixed, ${report.unresolved.length} unresolved (${report.unresolved.filter((u) => u.hard).length} hard), ${report.unverified.length} unverified`);
    return finish();
  } catch (e) {
    report.error = String(e.message ?? e).slice(0, 300);
    log(`still gate stopped: ${report.error}`);
    return finish(`error: ${report.error}`);
  } finally {
    if (!renderer && R && typeof stills === "function") await R.close?.().catch?.(() => {});
  }
}

/** the run's verdict from the report: a hard unresolved shot rejects (mode "reject"); anything else goes on */
export function gateRejects(report, mode = GATE_DEFAULTS.mode) {
  if (mode !== "reject" || !report) return null;
  const hard = (report.unresolved ?? []).filter((u) => u.hard);
  return hard.length ? hard : null;
}
