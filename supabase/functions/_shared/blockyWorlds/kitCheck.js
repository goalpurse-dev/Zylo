// Blocky Worlds EARLY KIT CHECK (2026-11-12): does the board kit have what a SCRIPT can't be told without? Pure and
// instant, so the server can run it at the quote / start (before the charge) and the worker before the voice. A story
// that needs a thing the kit can't show goes to "Fix it" (rewrite / "Move it to our town"), never a paid failure.
//   kitCheck(script | lines) -> { ok, missing: [{ word, kind, lines }], found: [{ id, kind, lines }] }
//   kitHas(name) -> the kit id a name means (a prop / animal / place / creature), or null
// A thing is a MUST-HAVE when the story leans on it: named in the opener (lines 0-1), in the last two lines, or twice.
import { BOARD_KIT } from "./boardKit.js";

const words = (s) => String(s ?? "").toLowerCase().replace(/[^a-z' -]/g, " ");
const ALIAS = new Map();
for (const p of BOARD_KIT.props ?? []) for (const a of [p.id, ...(p.aliases ?? [])]) ALIAS.set(a, { id: p.id, kind: "prop" });
for (const a of BOARD_KIT.animals ?? []) ALIAS.set(a, { id: a, kind: "animal" });
for (const p of BOARD_KIT.places ?? []) for (const a of [p.id, ...(p.aliases ?? [])]) ALIAS.set(a, { id: p.id, kind: "place" });
// things the kit can NOT show yet (what a "Fix it" must move or rewrite), by kind
export const NOT_IN_KIT = Object.freeze({
  vehicle: ["car", "bus", "truck", "train", "boat", "ship", "plane", "airplane", "rocket", "bike", "bicycle", "tractor", "helicopter", "submarine", "spaceship", "taxi", "van", "motorcycle", "sled", "skateboard", "scooter", "wagon"],
  place: ["beach", "ocean", "sea", "castle", "space", "planet", "city", "mountain", "cave", "desert", "jungle", "underwater", "island", "volcano", "farm", "barn", "zoo", "museum", "hospital", "library", "airport", "station", "pool", "lake", "river"],
  creature: ["dragon", "robot", "alien", "mermaid", "unicorn", "dinosaur", "spider", "octopus", "zombie", "vampire", "witch", "giant", "troll", "goblin", "fairy", "ghost"],
  prop: ["sword", "shield", "laptop", "computer", "tablet", "tv", "television", "guitar", "piano", "trumpet", "telescope", "microscope", "rope", "ladder", "net", "fishing rod", "magnifying glass", "potion", "cauldron", "treasure", "chest", "slingshot", "remote"],
});
const NOT = new Map(); for (const [kind, list] of Object.entries(NOT_IN_KIT)) for (const w of list) NOT.set(w, kind);
export function kitHas(name) {
  const w = words(name).trim().split(/\s+/);
  for (let n = Math.min(3, w.length); n >= 1; n--) for (let i = 0; i + n <= w.length; i++) { const k = w.slice(i, i + n).join(" "); const hit = ALIAS.get(k) ?? ALIAS.get(k.replace(/s$/, "")); if (hit) return hit.id; }
  return null;
}
export function kitCheck(scriptOrLines) {
  const lines = (Array.isArray(scriptOrLines) ? scriptOrLines : scriptOrLines?.lines ?? []).map((l) => words(l?.text ?? l));
  const seen = new Map(), last = lines.length - 1;
  lines.forEach((l, i) => {
    const t = l.split(/\s+/).filter(Boolean);
    for (let n = 1; n <= 2; n++) for (let k = 0; k + n <= t.length; k++) {
      const g = t.slice(k, k + n).join(" "), s = g.replace(/s$/, "");
      const kind = NOT.get(g) ?? NOT.get(s); if (!kind) continue;
      const e = seen.get(s) ?? { word: s, kind, lines: [] }; if (!e.lines.includes(i)) e.lines.push(i); seen.set(s, e);
    }
  });
  const must = (e) => e.lines.length >= 2 || e.lines.some((i) => i <= 1 || i >= last - 1);
  // a "giant" / "ghost" that the creature variants can stand for is not missing (the tall body)
  const missing = [...seen.values()].filter((e) => must(e) && !(e.kind === "creature" && ["giant", "ghost"].includes(e.word)));
  const found = []; lines.forEach((l, i) => { for (const tok of l.split(/\s+/)) { const id = kitHas(tok); if (id) { const f = found.find((x) => x.id === id); if (f) { if (!f.lines.includes(i)) f.lines.push(i); } else found.push({ id, kind: ALIAS.get(tok)?.kind ?? ALIAS.get(tok.replace(/s$/, ""))?.kind ?? "prop", lines: [i] }); } } });
  return { ok: !missing.length, missing, found };
}
