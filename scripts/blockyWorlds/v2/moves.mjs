// IN THIS TOWN v2: the acting library's moves read from acting_v2.py (one source of truth): move -> its 3 poses
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let cache = null;
export function readMoves() {
  if (cache) return cache;
  const s = fs.readFileSync(path.join(HERE, "acting_v2.py"), "utf8");
  const a = s.indexOf("ZV_MOVES = {"), b = s.indexOf("\n}\n", a);
  const moves = {};
  for (const m of s.slice(a, b).matchAll(/^    "([a-z_]+)": \(\[([^\]]*)\]/gm)) moves[m[1]] = m[2].split(",").map((x) => x.trim().replace(/"/g, ""));
  const c = s.indexOf("ZV_CROWD_MOVES = {"), d = s.indexOf("\n}\n", c);
  const crowd = [...s.slice(c, d).matchAll(/^    "([a-z_]+)": \[/gm)].map((m) => m[1]);
  return (cache = { moves, crowd });
}
