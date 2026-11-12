// Blocky Worlds SHOT RECIPES: the library (lib/recipes/data/<id>.json) and the picker. Node only (reads the data files).
//   loadRecipe("curfew_monster" | "giant_reveal" (an alias) | recipeObject) -> recipe | null
//   recipeFor({ recipe, idea, script }) -> recipe | null   (the story type the script writer picked, else none)
//   RECIPE_IDS, ALIASES
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRecipe } from "./schema.js";
export { recipePass, rhythm, shotCount, cutTimes, engineCamera, slotFocus } from "./apply.js";
export { validateRecipe, beatSlots, BEATS } from "./schema.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
export const RECIPE_IDS = Object.freeze(["creature_town_attack", "curfew_monster", "rigged_system", "lost_pet_in_town", "absurd_rule_comedy"]);
/** story types without a recipe of their own -> the closest one (launch: 5 recipes) */
export const ALIASES = Object.freeze({
  giant_reveal: "creature_town_attack", creature_reveal: "creature_town_attack", town_on_creature: "creature_town_attack",
  everyone_except_me: "absurd_rule_comedy", size_kingdom: "rigged_system", rich_poor: "rigged_system",
  night_rule: "curfew_monster", monster_curfew: "curfew_monster", lost_pet: "lost_pet_in_town", missing_pet: "lost_pet_in_town",
  absurd_rule: "absurd_rule_comedy",
});

const cache = new Map();
export function loadRecipe(r) {
  if (!r) return null;
  if (typeof r === "object") return validateRecipe(r).length ? null : r;
  const id = ALIASES[r] ?? r;
  if (!RECIPE_IDS.includes(id)) return null;
  if (!cache.has(id)) {
    let rec = null;
    try { rec = JSON.parse(fs.readFileSync(path.join(DATA, `${id}.json`), "utf8")); } catch { rec = null; }
    cache.set(id, rec && !validateRecipe(rec).length ? Object.freeze(rec) : null);
  }
  return cache.get(id);
}

/** the recipe a plan uses: the explicit one, else the idea's / script's story type (the writer's recipe picker) */
export function recipeFor({ recipe = null, idea = null, script = null } = {}) {
  const pick = recipe ?? idea?.recipe?.id ?? idea?.recipe ?? idea?.recipeId ?? script?.recipe?.id ?? script?.recipe ?? null;
  return typeof pick === "string" || (pick && typeof pick === "object" && pick.beats) ? loadRecipe(pick) : null;
}
