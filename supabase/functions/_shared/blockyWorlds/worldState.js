// IN THIS TOWN: A LIVING WORLD WITH STORY LOGIC (owner 2026-11-22, round 3). The story plan gives every line a WORLD
// STATE (who / what is out on the street, what moves, what is lit), decided from the story like a real town, not fixed
// rules. Lively defaults; the story's rule and the town's habits override them ("nobody goes outside after dark": the
// night street is empty, nothing drives, curtains closed, lights off). The engine builds it (worlds.py zw_life_*); the
// code checks it against the town's rule effects; the picture check fails any frame that contradicts it. Pure (no I/O).

export const BUSY = Object.freeze(["busy", "normal", "quiet", "empty"]);
export const WALKERS = Object.freeze(["walking", "hurrying", "still", "none"]);
export const EXTRAS = Object.freeze(["pairs", "bags", "kids_playing", "dogs", "birds", "people_at_windows"]);
export const CARS = Object.freeze(["driving", "parked", "leaving", "none"]);
export const WINDOWS = Object.freeze(["lit", "some", "dark"]);
export const CURTAINS = Object.freeze(["open", "closed"]);
export const THREAT = Object.freeze(["none", "near", "react", "after"]);
export const WHEN = Object.freeze(["day", "sunset", "night", "always"]);

/** the lively defaults (owner): day busy, evening fewer + headlights, a normal night a few people, some cars, lit windows */
export const DEFAULTS = Object.freeze({
  day: Object.freeze({ busy: "busy", walkers: "walking", extras: ["pairs", "bags", "kids_playing", "dogs", "birds"], cars: "driving", windows: "lit", curtains: "open", threat: "none" }),
  sunset: Object.freeze({ busy: "normal", walkers: "walking", extras: ["pairs", "bags"], cars: "driving", windows: "some", curtains: "open", threat: "none" }),
  night: Object.freeze({ busy: "quiet", walkers: "walking", extras: [], cars: "driving", windows: "lit", curtains: "open", threat: "none" }),
});

const st = { type: "string" };
const en = (v) => ({ type: "string", enum: [...v] });
/** the plan's per-line world (compact: big strict schemas are refused as "compiled grammar is too large") */
export function worldSchema() {
  return {
    type: "object", additionalProperties: false,
    required: ["busy", "walkers", "extras", "cars", "windows", "curtains", "threat", "outside"],
    properties: { busy: en(BUSY), walkers: en(WALKERS), extras: { type: "array", items: en(EXTRAS) }, cars: en(CARS), windows: en(WINDOWS), curtains: en(CURTAINS), threat: en(THREAT), outside: { type: "array", items: st } },
  };
}
/** the town: its rule and what the rule (and its habits) mean for the street, per time of day */
export function townSchema() {
  return {
    type: "object", additionalProperties: false, required: ["rule", "habits", "effects"],
    properties: {
      rule: st, habits: { type: "array", items: st },
      effects: { type: "array", items: { type: "object", additionalProperties: false, required: ["when", "no_people_outside", "no_moving_cars", "windows", "curtains", "hurry_home"],
        properties: { when: en(WHEN), no_people_outside: { type: "boolean" }, no_moving_cars: { type: "boolean" }, windows: en([...WINDOWS, "any"]), curtains: en([...CURTAINS, "any"]), hurry_home: { type: "boolean" } } } },
    },
  };
}

export const WORLD_PROMPT = `THE WORLD STATE (a living town with story logic): for EVERY line, decide what the street around the story is doing, like a real town would:
- busy: busy / normal / quiet / empty (background people); walkers: walking / hurrying / still / none; extras: ${EXTRAS.join(", ")};
  cars: driving / parked / leaving / none; windows: lit / some / dark; curtains: open / closed; threat: none / near / react / after; outside: the cast names who are outdoors in this line.
- DEFAULTS are LIVELY: DAY = busy, people walk, chat in pairs, carry bags, kids play, dogs walk, cars drive and park, birds. EVENING (sunset) = fewer people, headlights on (cars driving). A NORMAL NIGHT = quiet: a few people, some cars, lit windows.
- THE STORY'S RULE AND THE TOWN'S HABITS OVERRIDE THE DEFAULTS. Think it through: what would every other person in this town do because of the rule? Examples: "nobody goes outside after dark" -> at night the street is EMPTY: no walking people, no driving cars (parked cars are fine), curtains closed, lights off (windows dark). "Everyone goes home before the lamps turn on" -> at dusk people HURRY inside. Write these as the town's effects (when: day / sunset / night / always).
- Indoor lines: busy empty, walkers none, cars none (nothing outside is seen); the windows / curtains still follow the rule.
- THE THREAT ARC: lines before the danger are calm (threat none); when the danger shows up nearby: near (everyone stops and stares), then react (the background looks, gets scared, runs and hides, cars drive away); the line after the danger: after (relief), unless the story ends on the danger.`;

const lc = (t) => String(t ?? "").toLowerCase();
/** the world of a line (the plan's, else the time's default) */
export function worldOf(plan, line) {
  const lp = (plan?.lines ?? []).find((x) => x.line === line) ?? {};
  const time = lp.time ?? "day";
  return { time, place: lp.place ?? null, ...(DEFAULTS[time] ?? DEFAULTS.day), ...(lp.world ?? {}) };
}

/** the town's effects that apply at a time of day */
export const effectsAt = (plan, time) => (plan?.town?.effects ?? []).filter((e) => e.when === time || e.when === "always");

/** the plan's worlds against the town's own effects (code) -> [problem] */
export function worldProblems(plan) {
  const out = [];
  for (const lp of plan?.lines ?? []) {
    const w = lp.world;
    if (!w) { out.push(`line ${lp.line}: no world state`); continue; }
    for (const e of effectsAt(plan, lp.time)) {
      const why = `the town's rule ("${plan.town.rule}") at ${lp.time}`;
      if (e.no_people_outside && (w.busy !== "empty" || !["none", "still"].includes(w.walkers))) out.push(`line ${lp.line}: ${why} says nobody is outside, but the street is "${w.busy}" with people ${w.walkers}`);
      if (e.no_moving_cars && ["driving", "leaving"].includes(w.cars)) out.push(`line ${lp.line}: ${why} says no car moves, but cars are "${w.cars}" (parked or none)`);
      if (e.windows && e.windows !== "any" && w.windows !== e.windows) out.push(`line ${lp.line}: ${why} says windows ${e.windows}, not ${w.windows}`);
      if (e.curtains && e.curtains !== "any" && w.curtains !== e.curtains) out.push(`line ${lp.line}: ${why} says curtains ${e.curtains}, not ${w.curtains}`);
      if (e.hurry_home && w.busy !== "empty" && w.walkers !== "hurrying") out.push(`line ${lp.line}: ${why} says people hurry home, not "${w.walkers}"`);
    }
  }
  return out;
}

/** the threat arc in order: calm -> near -> react -> after (relief) on the next line in the same place, unless it ends */
export function threatArc(plan) {
  const L = [...(plan?.lines ?? [])].sort((a, b) => a.line - b.line);
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[i].world, b = L[i + 1].world;
    if (a?.threat === "react" && b && b.threat === "none" && L[i + 1].place === L[i].place) b.threat = "after";
  }
  return plan;
}

/** a line's world -> the engine's dress for zw_build (worlds.py reads busy / walkers / extras / cars / windows /
 * curtains / threat / faces). An indoor place keeps only the window state. */
export function dressOf(world, { indoor = false } = {}) {
  if (!world) return null;
  const d = { time: world.time ?? "day", windows: world.windows, curtains: world.curtains, faces: "dot" };
  if (indoor) return d;
  return { ...d, busy: world.busy, walkers: world.walkers, extras: [...(world.extras ?? [])], cars: world.cars, threat: world.threat };
}

/** the world state as the picture check reads it */
export function worldText(world, { indoor = false } = {}) {
  if (!world) return "";
  const parts = [`time ${lc(world.time).toUpperCase()}`];
  if (!indoor) {
    const who = (world.outside ?? []).filter(Boolean);
    parts.push(world.busy === "empty" ? `background: EMPTY (no strangers at all; the story's own characters ${who.length ? `(${who.join(", ")}, "Me" = the narrator)` : ""} may be there)` : `background people: ${world.busy}, ${world.walkers}${world.extras?.length ? ` (${world.extras.join(", ").replace(/_/g, " ")})` : ""}`);
    parts.push({ driving: "cars driving", parked: "cars PARKED ONLY (cars standing still at the kerb with their lights off are FINE; none may be driving)", leaving: "cars driving AWAY", none: "NO cars" }[world.cars] ?? "");
    if (world.threat === "react") parts.push("the background people RUN away / hide");
  }
  if (world.time !== "day") parts.push(`house windows ${String(world.windows).toUpperCase()}${world.windows === "some" ? " (some lit, some dark)" : ""}; the street lamps are ON at night (that is fine)`);
  if (world.curtains === "closed") parts.push("curtains CLOSED");
  return `WORLD STATE (the story's rules for this moment): ${parts.filter(Boolean).join("; ")}. FAIL the picture if it shows anything that contradicts this (a walking stranger on an empty street, a driving car when cars are parked, a lit window when windows are dark).`;
}

/** a scene card against its line's world (code): who is outside */
export function cardWorldProblems(card, world, { castNames = [], indoor = false } = {}) {
  if (!world || indoor || !Array.isArray(world.outside)) return [];
  const out = [];
  const ok = new Set(world.outside.map(lc));
  const names = new Set(castNames.map(lc));
  for (const f of ["start", "end"]) for (const p of card?.[f]?.people ?? []) {
    const w = lc(p.who);
    if (w === "monster" || !names.has(w) || p.pose === "hidden" || /^offscreen/.test(p.mark)) continue;
    if (!ok.has(w)) out.push(`${f}: ${p.who} is outside, but the world state says only ${world.outside.join(", ") || "nobody"} is outside in this line`);
  }
  return [...new Set(out)];
}
