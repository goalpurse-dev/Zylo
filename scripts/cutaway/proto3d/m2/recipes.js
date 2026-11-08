// M2: models by keyword (scene language v2, phase 2; SCENE_LANGUAGE_V2.md section 3 "models"). A "model" part names a
// thing ({keyword: "cooling tower", pos, size?}); the kit finds it: first a saved recipe (a designed part, checked, with
// its moves: a wind turbine's rotor spins), then a CC0 model by keyword (kit/modelCatalog.json, m2/models.js). The part
// becomes a rig part before anything else sees it (expandModels), so the camera, the checks and the moves treat it as a
// designed part. A keyword with neither is a named error.
import { modelMatches } from "./models.js";

const conc = { look: "concrete" }, metal = { look: "metal" }, paint = (c) => ({ look: "paint", color: c });
// each recipe: synonyms, and its nodes (rig.js shapes and moves, metres, its base at y 0)
export const RECIPES = Object.freeze({
  "cooling tower": { synonyms: ["cooling towers", "hyperboloid tower"], nodes: [
    { id: "shell", at: [0, 0, 0], shapes: [{ shape: "cone", r: 4.2, r2: 2.9, h: 6.5, axis: "y", at: [0, 3.25, 0], ...conc }, { shape: "cone", r: 2.9, r2: 3.3, h: 4, axis: "y", at: [0, 8.5, 0], ...conc }, { shape: "torus", r: 3.3, tube: 0.12, axis: "y", at: [0, 10.5, 0], ...conc }] }] },
  "pylon": { synonyms: ["electricity pylon", "transmission tower", "power tower", "lattice tower"], nodes: [
    { id: "legs", at: [0, 0, 0], shapes: [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ shape: "box", size: [0.16, 13.2, 0.16], at: [a * 0.75, 6.6, b * 0.75], rot: [b * 3.5, 0, -a * 3.5], ...metal }))
      .concat([3, 6.5, 10].map((y) => ({ shape: "box", size: [1.9 - y * 0.09, 0.1, 1.9 - y * 0.09], at: [0, y, 0], ...metal })))
      .concat([{ shape: "box", size: [6.2, 0.25, 0.25], at: [0, 11.5, 0], ...metal }, { shape: "box", size: [4.2, 0.25, 0.25], at: [0, 13, 0], ...metal }])
      .concat([-2.9, 2.9, -1.9, 1.9].map((x, i) => ({ shape: "cylinder", r: 0.09, h: 0.7, axis: "y", at: [x, i < 2 ? 11.05 : 12.55, 0], look: "glass", color: "#7fb0d0" }))) }] },
  "utility pole": { synonyms: ["power pole", "telephone pole", "electric pole", "wooden pole"], nodes: [
    { id: "pole", at: [0, 0, 0], shapes: [{ shape: "cylinder", r: 0.14, h: 9, axis: "y", at: [0, 4.5, 0], look: "wood" }, { shape: "box", size: [2.2, 0.12, 0.12], at: [0, 8.3, 0], look: "wood" }, ...[-0.9, 0, 0.9].map((x) => ({ shape: "cylinder", r: 0.06, h: 0.3, axis: "y", at: [x, 8.5, 0], look: "glass", color: "#9fc3d8" }))] }] },
  "pole transformer": { synonyms: ["transformer", "distribution transformer"], nodes: [
    { id: "can", at: [0, 0, 0], shapes: [{ shape: "cylinder", r: 0.4, h: 1.0, axis: "y", at: [0, 0.5, 0], ...paint("#8a9299") }, { shape: "cylinder", r: 0.06, h: 0.3, axis: "y", at: [-0.15, 1.15, 0], look: "glass", color: "#9fc3d8" }, { shape: "cylinder", r: 0.06, h: 0.3, axis: "y", at: [0.15, 1.15, 0], look: "glass", color: "#9fc3d8" }] },
    { id: "hum", parent: "can", at: [0, 0.5, 0.42], shapes: [{ shape: "light", r: 0.07, color: "#7cff6a" }], moves: [{ name: "on", type: "light" }] }] },
  "wind turbine": { synonyms: ["windmill", "wind generator"], nodes: [
    { id: "tower", at: [0, 0, 0], shapes: [{ shape: "cone", r: 0.45, r2: 0.25, h: 10.5, axis: "y", at: [0, 5.25, 0], ...paint("#f2f3f4") }, { shape: "box", size: [1.6, 0.8, 0.8], at: [0.3, 10.9, 0], ...paint("#f2f3f4") }] },
    { id: "rotor", parent: "tower", at: [0, 10.9, 0.5], shapes: [{ shape: "fan", r: 4.6, blades: 3, w: 0.25, axis: "z", at: [0, 0, 0], ...paint("#f7f7f7") }, { shape: "sphere", r: 0.35, at: [0, 0, 0.1], ...paint("#e9eaec") }], moves: [{ name: "spin", type: "spin", axis: "z", turns: 0.5 }] }] },
  "nuclear reactor": { synonyms: ["reactor", "reactor vessel", "pressure vessel"], nodes: [
    { id: "vessel", at: [0, 0, 0], shapes: [{ shape: "cylinder", r: 1.6, h: 4.4, axis: "y", at: [0, 2.2, 0], look: "glass", color: "#9ab8c8" }, { shape: "sphere", r: 1.6, at: [0, 4.4, 0], ...metal }] },
    { id: "core", parent: "vessel", at: [0, 0.4, 0], shapes: [{ shape: "box", size: [1.6, 2.2, 1.6], at: [0, 1.1, 0], ...paint("#5c6a74") }], moves: [{ name: "heat", type: "heat", color: "#ff6a2a" }] },
    { id: "rods", parent: "vessel", at: [0, 2.6, 0], shapes: [-0.5, 0, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => ({ shape: "box", size: [0.12, 2.4, 0.12], at: [x, 1.2, z], ...paint("#2c3136") }))), moves: [{ name: "insert", type: "slide", to: [0, -1.6, 0] }] }] },
  "turbine generator": { synonyms: ["steam turbine", "turbine", "generator"], nodes: [
    { id: "casing", at: [0, 0, 0], shapes: [{ shape: "box", size: [5.5, 0.4, 1.8], at: [0, 0.2, 0], ...conc }, { shape: "cylinder", r: 0.9, h: 2.6, axis: "x", at: [-1.2, 1.3, 0], look: "glass", color: "#b7c7d0" }, { shape: "cylinder", r: 0.8, h: 2.0, axis: "x", at: [1.6, 1.2, 0], ...paint("#3d6fb0") }] },
    { id: "blades", parent: "casing", at: [-1.2, 1.3, 0], shapes: [{ shape: "fan", r: 0.75, blades: 9, w: 0.2, axis: "x", at: [0, 0, 0], ...metal }], moves: [{ name: "spin", type: "spin", axis: "x", turns: 2 }] }] },
  "clarifier": { synonyms: ["settling tank", "sedimentation tank", "round tank"], nodes: [
    { id: "tank", at: [0, 0, 0], shapes: [{ shape: "drum", r: 4, h: 2, axis: "y", holes: false, at: [0, 1, 0], ...conc }] },
    { id: "bridge", parent: "tank", at: [0, 2.1, 0], shapes: [{ shape: "box", size: [8, 0.25, 0.6], at: [0, 0.1, 0], ...paint("#e0b13a") }, { shape: "cylinder", r: 0.4, h: 0.6, axis: "y", at: [0, 0.3, 0], ...metal }], moves: [{ name: "turn", type: "spin", axis: "y", turns: 0.1 }] }] },
});

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
/** the recipe for a keyword: its name or a synonym, said whole or inside the keyword */
export function recipeFor(keyword) {
  const k = norm(keyword);
  if (!k) return null;
  for (const [name, r] of Object.entries(RECIPES)) if ([name, ...r.synonyms].some((w) => k === w || k.includes(w) || (w.includes(k) && k.length > 5))) return { name, ...r };
  return null;
}
/** what a model part becomes: { recipe } or { file } (a CC0 model) or null */
export function resolveModel(params = {}) {
  const r = recipeFor(params.keyword);
  if (r) return { recipe: r };
  const m = modelMatches(params.keyword ?? "", 1)[0];
  return m ? { file: m.file } : null;
}
/** the move names a model part answers to (its recipe's), for the validator */
export const modelMoves = (params = {}) => (recipeFor(params.keyword)?.nodes ?? []).flatMap((n) => (n.moves ?? []).map((m) => m.name));

/** a model part as a rig part (a recipe, or one CC0 model shape); null when its keyword finds nothing */
export function modelToRig(part) {
  const p = part.params ?? {}, r = resolveModel(p);
  if (!r) return null;
  const common = { name: p.keyword, synonyms: [], pos: p.pos ?? [0, 0, -2], ...(p.rotY != null ? { rotY: p.rotY } : {}), ...(p.scale != null ? { scale: p.scale } : {}) };
  const out = { ...part, kind: "rig" };
  if (r.recipe) out.params = { ...common, name: r.recipe.name, synonyms: r.recipe.synonyms, nodes: JSON.parse(JSON.stringify(r.recipe.nodes)) };
  else out.params = { ...common, nodes: [{ id: "body", at: [0, 0, 0], shapes: [{ shape: "model", file: r.file, size: Number(p.size) || 2, at: [0, 0, 0] }] }] };
  return out;
}
/** every model part of a layout as a rig part; problems name the keywords that found nothing */
export function expandModels(layout) {
  const problems = [];
  const parts = (layout.parts ?? []).map((p) => { if (p.kind !== "model") return p; const r = modelToRig(p); if (!r) problems.push(`part ${p.id}: no recipe or CC0 model for "${p.params?.keyword}": design it as a rig`); return r ?? p; });
  return { layout: { ...layout, parts }, problems };
}
