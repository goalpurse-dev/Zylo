// M2: the layout format check. A layout is what a saved topic keeps (and what the planner writes):
//   { key, title, anchorMatch?, world: {...}, parts: [{ id, kind, params, base? }], cues: [...], camera: { keys }, audio }
// A cue: { p: partId, c: channel, a: anchor, b?: anchor | d?: seconds, amp?: 1, e?: easing }. Without b/d it is a step.
// An anchor: { abs } | { w, n?, o? } | { s, w, o? } | { mark, o? } (m2/curves.js). Returns a list of problems.
import { EASES } from "./curves.js";
import { KIND_CHANNELS } from "./parts.js";
import { MATERIAL_NAMES } from "./materials.js";

export const MARKS = ["speechEnd", "voiceEnd", "signPop", "lengthEnd", "lengthNoEnd"];
// the parts that read another part (param name -> it must name an earlier part)
const REFS = { pipeRunFlow: ["pipe"], pipeFlow: ["pipe"], water: ["gravel"], gravel: ["water"] };

function anchorProblem(a) {
  if (!a || typeof a !== "object") return "missing anchor";
  if (a.o != null && !Number.isFinite(Number(a.o))) return "bad offset";
  if (a.abs != null) return Number.isFinite(Number(a.abs)) ? null : "bad abs";
  if (a.mark != null) return MARKS.includes(a.mark) ? null : `unknown mark ${a.mark}`;
  if (a.w != null) return typeof a.w === "string" && a.w ? (a.n == null || (Number.isInteger(a.n) && a.n >= 1) ? null : "bad n") : "bad word";
  return "anchor needs abs, mark or w";
}

function matsOf(params) {
  const out = [];
  const walk = (v, k) => { if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) walk(vv, kk); else if (typeof v === "string" && /(^|[A-Z])mat$|^mat$|Mat$/.test(k ?? "")) out.push(v); };
  walk(params);
  return out;
}

export function validateLayout(L) {
  const P = [];
  if (!L || typeof L !== "object") return ["layout is not an object"];
  if (!/^[a-z0-9_-]{2,60}$/.test(L.key ?? "")) P.push("key must be 2-60 of a-z 0-9 _ -");
  if (!Array.isArray(L.parts) || !L.parts.length) P.push("no parts");
  if (!Array.isArray(L.cues)) P.push("no cues");
  if (P.length) return P;
  const seen = new Map();
  L.parts.forEach((p, i) => {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(p.id ?? "")) P.push(`part ${i}: bad id`);
    else if (seen.has(p.id)) P.push(`part ${p.id}: duplicate id`);
    if (!KIND_CHANNELS[p.kind]) P.push(`part ${p.id}: unknown kind ${p.kind}`);
    for (const m of matsOf(p.params ?? {})) if (!MATERIAL_NAMES.includes(m)) P.push(`part ${p.id}: unknown material ${m}`);
    for (const r of REFS[p.kind] ?? []) { const ref = p.params?.[r]; if (ref != null && !L.parts.some((q) => q.id === ref)) P.push(`part ${p.id}: ${r} names no part (${ref})`); }
    if (p.kind === "bags" && p.params?.fromTruck && !L.parts.some((q) => q.id === p.params.fromTruck.part)) P.push(`part ${p.id}: fromTruck names no part`);
    if ((REFS[p.kind] ?? []).includes("pipe") && p.params?.pipe && !seen.has(p.params.pipe)) P.push(`part ${p.id}: its pipe must come before it`);
    seen.set(p.id, p);
  });
  const chans = (p) => (p.kind === "panels" ? (p.params?.panels ?? []).map((q) => q.ch) : KIND_CHANNELS[p.kind] ?? []);
  L.cues.forEach((c, i) => {
    const p = seen.get(c.p);
    if (!p) { P.push(`cue ${i}: no part ${c.p}`); return; }
    if (!chans(p).includes(c.c)) P.push(`cue ${i}: ${p.kind} ${c.p} has no channel ${c.c}`);
    const pa = anchorProblem(c.a); if (pa) P.push(`cue ${i} (${c.p}.${c.c}): a: ${pa}`);
    if (c.b != null) { const pb = anchorProblem(c.b); if (pb) P.push(`cue ${i} (${c.p}.${c.c}): b: ${pb}`); }
    if (c.d != null && !(Number(c.d) >= 0)) P.push(`cue ${i} (${c.p}.${c.c}): bad d`);
    if (c.e != null && !EASES[c.e]) P.push(`cue ${i} (${c.p}.${c.c}): unknown easing ${c.e}`);
    if (c.amp != null && !Number.isFinite(Number(c.amp))) P.push(`cue ${i} (${c.p}.${c.c}): bad amp`);
  });
  const keys = L.camera?.keys;
  if (!Array.isArray(keys) || keys.length < 2) P.push("camera needs 2+ keys");
  else keys.forEach((k, i) => {
    const pa = anchorProblem(k.at); if (pa) P.push(`camera key ${i}: ${pa}`);
    for (const v of [k.pos, k.tgt]) if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) P.push(`camera key ${i}: pos/tgt must be 3 numbers`);
    if (k.only && !["end", "noend"].includes(k.only)) P.push(`camera key ${i}: only must be end or noend`);
  });
  return P;
}
