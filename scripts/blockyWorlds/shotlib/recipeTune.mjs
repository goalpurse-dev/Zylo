// Blocky Worlds SHOT RECIPES, step 2: the hand-tuning of the launch recipes (free). Drafts (recipeFromVideo.mjs) ->
// clean, general recipes in scripts/blockyWorlds/engine/lib/recipes/data/<id>.json.
//   node scripts/blockyWorlds/shotlib/recipeTune.mjs [--rebuild <rebuild-plan.json>] [--only id,id]
// creature_town_attack comes from the turtle target's shot-for-shot REBUILD (engine cameras, 115 shots) with the roles
// of the target's descriptions; the others from their video's draft. The tuning (general rules, then a short hand table
// per recipe): roles "other" / "transition" become life / mood, the same slot twice in a row is one slot, a beat keeps
// at most MAX_SLOTS slots (the shortest neighbours merge), a beat the source barely had is filled from the recipe's own
// nearest beat, the rule opens on an establishing wide of the world, the closer ends on a wide, and the tour is a
// mini-sequence per example line. PATTERNS ONLY: enums and numbers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { draftRecipe, loadAnalysis } from "./recipeFromVideo.mjs";
import { BEATS, validateRecipe } from "../engine/lib/recipes/schema.js";
import { CATEGORY_ROLE } from "../engine/lib/storyPatterns.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "engine", "lib", "recipes", "data");
const MAX_SLOTS = 12;
const r2 = (x) => Math.round(x * 100) / 100;

export const SOURCES = Object.freeze({
  creature_town_attack: "7701115575648455950", curfew_monster: "7699870521722211598", lost_pet_in_town: "7701548589666798880",
  rigged_system: "7701969278022552850", absurd_rule_comedy: "7704068720796208406",
});

const cam = (distance, height, move, speed = "medium") => ({ distance, height, move, speed });
const slot = (role, subject, c, extra = {}) => ({ role, share: 1, cam: c, subject, action: "line", cutOn: "word", ...extra });

// ------------------------------------------------------------------------------------------------ general cleaning
const sameSlot = (a, b) => a.role === b.role && a.subject === b.subject && a.cam.distance === b.cam.distance && a.cam.height === b.cam.height && a.cam.move === b.cam.move;
export function cleanSlots(slots, max = MAX_SLOTS) {
  let s = slots.map((x) => ({ ...x, role: x.role === "other" ? "life" : x.role === "transition" ? "mood" : x.role, cam: { ...x.cam } }));
  // the same slot twice in a row is one slot (shares add up)
  s = s.reduce((a, x) => { const p = a.at(-1); if (p && sameSlot(p, x)) p.share = r2(p.share + x.share); else a.push(x); return a; }, []);
  // at most `max`: merge the adjacent pair with the smallest combined share (the longer one's look wins)
  while (s.length > max) {
    let best = 0; for (let i = 1; i < s.length - 1; i++) if (s[i].share + s[i + 1].share < s[best].share + s[best + 1].share) best = i;
    const [a, b] = [s[best], s[best + 1]];
    const keep = a.share >= b.share ? a : b;
    s.splice(best, 2, { ...keep, share: r2(a.share + b.share), ...(a.causes || b.causes ? { causes: true } : {}) });
  }
  const tot = s.reduce((a, x) => a + x.share, 0) || 1;
  return s.map((x) => ({ ...x, share: r2(Math.max(0.01, x.share / tot)) }));
}

// ------------------------------------------------------------------------------------------------ the turtle rebuild
const PART_BEAT = { opener: "rule", tour: "tour", me: "me", inciting: "until", escalation: "discovery", climax: "climax", ending: "closer" };
const CAM_ABS = {
  giant_close: ["close", "eye_level"], aerial: ["extreme_wide", "aerial"], establish: ["extreme_wide", "eye_level"], hero_low: ["medium", "ground_low"],
  track: ["medium", "eye_level"], medium: ["medium", "eye_level"], closeup: ["close", "eye_level"], wide: ["wide", "eye_level"], low: ["medium", "ground_low"], over_shoulder: ["medium", "eye_level"],
};
const MOVE_ABS = { drift: ["push_in", "slow"], push_in: ["push_in", "medium"], track: ["track", "medium"], orbit: ["orbit", "medium"], tilt_up: ["tilt_up", "medium"], shake: ["shake", "fast"] };
/** the rebuild's shots (engine vocabulary) -> slots, with the target's own description roles by time */
export function rebuildSlots(plan, desc, sh) {
  const D = desc?.shots ?? {};
  const roleAt = (t) => { const s = (sh?.shots ?? []).find((x) => t >= x.t0 && t < x.t1); const d = s ? D[s.n] : null; return d ? (d.funnyBeat ? "humour" : CATEGORY_ROLE[d.libraryCategory] ?? "life") : null; };
  const out = Object.fromEntries(BEATS.map((b) => [b, []]));
  for (const s of plan.shots) {
    const beat = PART_BEAT[s.part]; if (!beat) continue;
    const [distance, height] = CAM_ABS[s.camera] ?? ["medium", "eye_level"];
    const [move, speed] = MOVE_ABS[s.move] ?? ["push_in", "medium"];
    const f = String(s.focus ?? "");
    const people = (s.cast ?? []).length, crowd = (s.crowds ?? []).length;
    const subject = f === "world" ? (/_on$/.test(s.set) ? "town" : "creature") : f.startsWith("giant:") ? (/wolf/.test(f) ? "threat" : "creature")
      : f === "me" ? "narrator" : crowd || /kids|townsfolk|soldiers/.test(f) ? (/soldiers/.test(f) ? "threat" : "crowd") : people ? "neighbour" : "place";
    let role = roleAt((s.t0 + s.t1) / 2) ?? "life";
    if (role === "other" || role === "transition") role = subject === "creature" ? "creature" : "life";
    const scale = subject === "creature" || subject === "town" ? ["houses"] : subject === "narrator" && /hero_low|aerial/.test(s.camera) ? ["creature"] : [];
    const action = s.camera === "over_shoulder" || (role === "reaction" && people) ? "reacts_scared" : (s.giants ?? []).some((g) => g.action === "walk") && subject === "creature" ? "walks" : "line";
    out[beat].push({ role, share: r2(s.t1 - s.t0), cam: { distance, height, move: move === "track" && height === "aerial" ? "flyover" : move, speed }, subject, ...(scale.length ? { scale } : {}), action, cutOn: "word" });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the hand table
const TOUR_EXAMPLE = {
  // per example line: the example's own place / person, then what the rule does to it, then a face or a wide
  creature_town_attack: [slot("establish", "creature", cam("extreme_wide", "eye_level", "push_in"), { action: "walks", scale: ["houses"] }), slot("life", "neighbour", cam("medium", "eye_level", "push_in")), slot("consequence", "place", cam("wide", "high", "push_in", "slow"), { cutOn: "noun" })],
  curfew_monster: [slot("establish", "place", cam("wide", "high", "push_in", "slow")), slot("character", "neighbour", cam("medium", "eye_level", "push_in"), { cutOn: "noun" }), slot("aftermath", "place", cam("wide", "eye_level", "push_in", "slow"), { causes: true })],
  rigged_system: [slot("establish", "town", cam("wide", "high", "flyover")), slot("explain", "neighbour", cam("medium", "eye_level", "track"), { cutOn: "noun" }), slot("consequence", "crowd", cam("medium", "ground_low", "push_in"), { action: "reacts_surprised" })],
  lost_pet_in_town: [slot("establish", "place", cam("wide", "ground_low", "push_in", "slow")), slot("character", "neighbour", cam("medium", "eye_level", "track"), { cutOn: "noun" }), slot("reaction", "narrator", cam("close", "eye_level", "push_in"), { action: "reacts_surprised" })],
  absurd_rule_comedy: [slot("establish", "place", cam("wide", "eye_level", "track")), slot("humour", "neighbour", cam("medium", "eye_level", "push_in"), { cutOn: "noun" }), slot("reaction", "narrator", cam("close", "eye_level", "push_in"), { action: "reacts_surprised" })],
};
const LIGHT = {
  creature_town_attack: { rule: "day", tour: "keep", me: "day", until: "keep", discovery: "keep", climax: "keep", closer: "warm" },
  curfew_monster: { rule: "keep", tour: "night", me: "keep", until: "night", discovery: "night", climax: "night", closer: "keep" },
  // the source's night is its own story's; a lost pet / an unfair town / a silly rule keep the script's own light
  rigged_system: {}, absurd_rule_comedy: {},
  lost_pet_in_town: { rule: "keep", tour: "keep", me: "keep", until: "keep", discovery: "keep", climax: "keep", closer: "keep" },
};
const META = {
  creature_town_attack: { name: "Town on a creature, under attack", what: "a town on or inside a giant creature, under threat", aliases: ["giant_reveal", "creature_reveal", "town_on_creature"] },
  curfew_monster: { name: "Curfew monster", what: "a rule (be home / never do X) and a night monster that takes rule-breakers", aliases: ["night_rule", "monster_curfew"] },
  rigged_system: { name: "Rigged system", what: "a town split by an unfair rule (the rich on top, the poor below)", aliases: ["size_kingdom", "rich_poor"] },
  lost_pet_in_town: { name: "Lost pet in town", what: "the narrator's pet is lost somewhere in the town", aliases: ["lost_pet", "missing_pet"] },
  absurd_rule_comedy: { name: "Absurd rule comedy", what: "a town with one silly rule everyone follows", aliases: ["everyone_except_me", "absurd_rule"] },
};
// beats the source barely had: borrowed from the recipe's own nearest full beat (the source's camera language)
const BORROW = { discovery: ["until", "climax"], climax: ["until", "discovery"], closer: ["tour", "me"], rule: ["tour"], me: ["tour"] };

export function tune(id, { draft, rebuild = null }) {
  const r = { ...draft, id, storyType: id, ...META[id], beats: {} };
  delete r.stats;
  const srcSlots = rebuild ?? Object.fromEntries(BEATS.map((b) => [b, draft.beats[b].slots]));
  for (const b of BEATS) {
    let slots = srcSlots[b] ?? [];
    if (slots.length < 3) {
      const from = (BORROW[b] ?? []).find((x) => (srcSlots[x] ?? []).length >= 6);
      if (from) slots = [...slots, ...cleanSlots(srcSlots[from], 6)];
    }
    slots = cleanSlots(slots);
    const B = { mode: "flow", targetShot: draft.beats[b].targetShot, light: LIGHT[id]?.[b] ?? draft.beats[b].light ?? "keep", slots };
    if (b === "tour") { B.mode = "per_line"; B.slots = cleanSlots(TOUR_EXAMPLE[id], 6); }
    if (b === "rule") {
      // the video opens on the world: an establishing wide (the creature / the town), then the source's opening shots
      const open = id === "creature_town_attack" ? slot("establish", "creature", cam("extreme_wide", "eye_level", "orbit"), { action: "walks", scale: ["houses"] }) : slot("establish", "town", cam("extreme_wide", "high", "push_in", "slow"));
      B.slots = cleanSlots([{ ...open, share: 0.3 }, ...slots.filter((s, i) => i > 0 || s.role !== "establish")], 5);
    }
    if (b === "closer") {
      const end = slot("ending", id === "creature_town_attack" ? "creature" : "town", cam("extreme_wide", "aerial", "pull_out", "slow"), { scale: ["houses"] });
      B.slots = cleanSlots([...slots.slice(0, 5), { ...end, share: 0.3 }], 6);
    }
    // pace: never slower than 1.6 s or faster than 0.85 s a shot (the source's medians, the owner's ~1-1.5 s)
    B.targetShot = r2(Math.min(1.6, Math.max(0.85, B.targetShot)));
    r.beats[b] = B;
  }
  r.pace = { ...r.pace, targetShot: r2(Math.min(1.5, Math.max(0.9, r.pace.targetShot))), minShot: 0.8, maxShot: 2.2, maxPerLine: 4 };
  return r;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const ri = process.argv.indexOf("--rebuild");
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : Object.keys(SOURCES);
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of only) {
    const { sh, desc } = loadAnalysis(SOURCES[id]);
    if (!sh) { console.log(`${id}: no analysis for ${SOURCES[id]} (skipped)`); continue; }
    const draft = draftRecipe({ id: SOURCES[id], storyType: id, sh, desc });
    let rebuild = null;
    if (id === "creature_town_attack") {
      if (ri < 0) { console.log(`${id}: needs --rebuild <rebuild-plan.json> (skipped)`); continue; }
      rebuild = rebuildSlots(JSON.parse(fs.readFileSync(process.argv[ri + 1], "utf8")), desc, sh);
    }
    const r = tune(id, { draft, rebuild });
    const probs = validateRecipe(r);
    if (probs.length) { console.log(`${id}: INVALID ${probs.join("; ")}`); continue; }
    fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(r, null, 1) + "\n");
    console.log(`${id}: ${BEATS.map((b) => `${b} ${r.beats[b].slots.length}${r.beats[b].mode === "per_line" ? "/line" : ""}`).join(", ")} -> data/${id}.json`);
  }
}
