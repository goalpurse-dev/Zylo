// Blocky Worlds sets (owner: SETS agent). See CONTRACT.md.
//   buildSet(name, ctx) -> { root, spots: { center, left, right, back, far, door }, indoor, update?(t), ...extras }
//   applyLight(name, ctx) -> { dispose() }            (from ../lighting.js)
// Extra spots beyond the six: street + woods `tower` (on the water tower's catwalk, ~15-20 m up), bedroom `closet` and
// `bed`, school `classroom`.
// Extras on the returned set, used by camera.js frameShot and lighting.js applyLight:
//   camDir   Vector3: the side the camera normally stands on (unit, from the spots toward the camera; the far spot is
//            on the opposite side)
//   views    { [spot]: Vector3 } a better camera side for a spot (e.g. the street's door faces sideways)
//   bounds   Box3[]: where the camera may stand (inside the room for indoor sets, off the houses / trees outside)
//   rig      lighting hooks: shadow box, practical lights per light, glow switching
// The root is added to ctx.scene if ctx.scene is given (the engine shows/hides it with root.visible).
import { preloadEnv } from "../lighting.js";
import { attachDresser } from "./themes.js"; // SETS-V2: every place dressed with its theme preset
export { applyLight } from "../lighting.js";

export const SETS = ["street", "bedroom", "school", "woods"];

const MODS = { street: () => import("./street.js"), bedroom: () => import("./bedroom.js"), school: () => import("./school.js"), woods: () => import("./woods.js") };

export async function buildSet(name, ctx) {
  const mod = MODS[name];
  if (!mod) throw new Error(`buildSet: unknown set "${name}" (${SETS.join(" | ")})`);
  const { THREE } = ctx;
  const [m] = await Promise.all([mod(), preloadEnv(THREE)]);
  const set = await m.build(ctx);
  set.name = name;
  set.blockers = [];
  set.root.traverse((o) => { if (o.userData.camBlock) set.blockers.push(o); });
  if (ctx.scene && !set.root.parent) ctx.scene.add(set.root);
  attachDresser(set, ctx);
  return set;
}
