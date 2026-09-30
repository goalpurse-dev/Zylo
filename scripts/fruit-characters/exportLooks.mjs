// Writes supabase/functions/_shared/fruit/fruitLooks.js from the library's FRUITS
// (prompt.mjs), so scene pictures and the picture check describe each fruit head
// exactly as the character references were drawn.
//   node scripts/fruit-characters/exportLooks.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FRUITS } from "./prompt.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function looksFrom(fruits) {
  const top = (t) => (t === "leaves" ? "a crown of green leaves"
    : t === "stem" ? "a short stem"
    : t ? t.replace(/ on top of the fruit head.*$/, "").replace(/, part of the fruit, not hair$/, "").replace(/, not hair$/, "") : null);
  return Object.fromEntries(Object.entries(fruits).map(([k, f]) => [k, { label: f.label, skin: f.skin, top: top(f.top) }]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(ROOT, "supabase/functions/_shared/fruit/fruitLooks.js");
  const src = fs.readFileSync(file, "utf8");
  const start = src.indexOf("export const FRUIT_LOOKS = Object.freeze(");
  const end = src.indexOf(");\n", start);
  fs.writeFileSync(file, `${src.slice(0, start)}export const FRUIT_LOOKS = Object.freeze(${JSON.stringify(looksFrom(FRUITS), null, 2)}${src.slice(end)}`);
  console.log("fruitLooks.js updated");
}
