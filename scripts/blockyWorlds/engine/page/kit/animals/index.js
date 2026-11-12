// Blocky Worlds ANIMALS: the blocky animal kit (BLOCKY-ANIMALS agent, 2026-11-06). See species.js (data), build.js
// (makeAnimal), animate.js (animateAnimal), textures.js (procedural textures).
export { ANIMAL_SPECIES, ANIMAL_NAMES, ANIMAL_PLANS, ANIMAL_ACTIONS, ANIMAL_EXPRS, resolveAnimal, specFor, actionsOf, defaultVariant } from "./species.js";
export { makeAnimal, animalSpec, solveLeg } from "./build.js";
export { animateAnimal, animalGait, setAnimalExpr, animalFeet } from "./animate.js";
