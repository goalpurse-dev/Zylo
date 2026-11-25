// IN THIS TOWN v2: SHOW WHAT IS SAID (owner 2026-11-25). Every line's words -> what its shots must contain (a weather,
// a raining object, an action, a creature, "everyone" = a crowd in action, a place). The free checks fail a line whose
// rows miss one; the planner is told each line's needs up front. General rules for every story (no story-specific code).

const RAIN_NOUNS = { frog: "frog", frogs: "frog", pillow: "pillow", pillows: "pillow", key: "key", keys: "key", coin: "coin", coins: "coin", letter: "letter", letters: "letter", phone: "phone", phones: "phone", box: "box", boxes: "box", parcels: "box" };
const MONSTER_NOUNS = /\b(monsters?|creatures?)\b/;
export const ENTITY_WORDS = { long_one: /\blong ones?\b/, crawler: /\bcrawlers?\b/, watcher: /\bwatchers?\b/, hollow: /\bhollows?\b/, many_arms: /\bmany[- ]arms\b/, rain_thing: /\brain things?\b/, ghost: /\bghosts?\b/, robot: /\brobots?\b/, slime: /\bslimes?\b/, giant_critter: /\bgiant (critter|creature)\b/ };
const WEATHER_WORDS = [["snow", /\bsnow(s|ed|ing|y)?\b/], ["storm", /\b(storms?|stormy|thunder|lightning)\b/], ["fog", /\b(fog|foggy|mist)\b/], ["wind", /\b(wind|windy)\b/]];
export const ACTIONS = {
  grab: { re: /\b(grab|grabs|grabbed|catch|catches|caught|snatch\w*)\b/, poses: ["reach", "catch", "reach_up", "pick_up"], held: true },
  run: { re: /\b(run|runs|ran|running|rush\w*|race[sd]?|chas\w+)\b/, poses: ["run"], crowd: "run" },
  press: { re: /\b(press|pressed|presses|pushed|push)\b/, poses: ["press"], state: ["red", "pressed"] },
  slide_in: { re: /\b(slid in|slides in|slide in|fits?|fitted|in the keyhole)\b/, state: ["key", "in", "turned"] },
  turn_key: { re: /\b(turned|turns)\b/, state: ["key", "turned"], needsWord: /\bkey|it\b/ },
  hide: { re: /\b(hide|hid|hides|hiding)\b/, poses: ["crouch2", "cover_head", "peek", "flinch", "shield"] },
  point: { re: /\b(point|pointed|points)\b/, poses: ["point"] },
  reach: { re: /\b(reach|reached|reaches)\b/, poses: ["reach", "reach_up"] },
  lift: { re: /\b(lift|lifted|flipped|opened the cover)\b/, state: ["red", "open", "pressed"] },
};
const EVERYONE = /\b(everyone|everybody|the whole town|all the (people|kids|town))\b/;
const SLEEP = /\b(sleep|asleep|slept|yawn\w*|tired|dream\w*)\b/;
// words that name a side set (a scene with these words should happen there)
export const PLACE_WORDS = { classroom: /\b(classroom|class|teacher|lesson)\b/, hallway: /\b(hallway|lockers?)\b/, school_front: /\bschool\b/, bedroom: /\b(bedroom|my bed)\b/, living_room: /\b(living room|sofa|couch)\b/,
  kitchen: /\bkitchen\b/, grandma_room: /\bgrandma'?s\b/, shop_inside: /\b(shop|store)\b/, cafe: /\bcaf(e|é)\b/, mayor_office: /\b(mayor'?s office)\b/, control_room: /\b(control room|wall of (screens|cameras)|levers)\b/,
  hospital_room: /\bhospital\b/, police_front: /\bpolice station\b/, basement: /\bbasement\b/, attic: /\battic\b/, forest_edge: /\b(forest|woods)\b/, alley: /\balley\b/, rooftop: /\b(rooftop|on the roof)\b/,
  playground: /\b(playground|swings?)\b/, basketball: /\bbasketball\b/, townhall_front: /\btown hall\b/ };

/** a line's needs: [{ what, value, text }] */
export function lineNeeds(text, { prevText = "", cast = [] } = {}) {
  // words printed on signs / buttons (ALL CAPS) are not actions: "DON'T PRESS THAT" is a label
  const t = ` ${text.replace(/\b[A-Z][A-Z']+\b/g, " ").toLowerCase()} `, out = [];
  const rainy = /\brain(s|ed|ing)?\b/.test(t) || (/^\s*on \w+days?,/.test(t) && /\brain/.test(prevText.toLowerCase()));
  if (rainy) {
    const kinds = [...new Set(Object.entries(RAIN_NOUNS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(t)).map(([, k]) => k))];
    const ents = Object.entries(ENTITY_WORDS).filter(([, re]) => re.test(t)).map(([k]) => k);
    if (MONSTER_NOUNS.test(t) || ents.length) out.push({ what: "rain_entity", value: ents, text: "it rains creatures: row.rain.kind = entity:<their ids>" });
    if (kinds.length) for (const k of kinds) out.push({ what: "rain", value: k, text: `it rains ${k}s: row.rain.kind = ${k}` });
    if (!kinds.length && !MONSTER_NOUNS.test(t) && !ents.length) out.push({ what: "rain", value: "any", text: "it rains something: a row with row.rain" });
  }
  for (const [w, re] of WEATHER_WORDS) if (re.test(t)) out.push({ what: "weather", value: w, text: `the weather ${w} (row.weather)` });
  for (const [a, A] of Object.entries(ACTIONS)) if (A.re.test(t) && (!A.needsWord || A.needsWord.test(t))) out.push({ what: "action", value: a, text: A.poses ? `the action "${a}": a person with pose ${A.poses.join("/")}${A.state ? ` or states.${A.state[0]} = ${A.state.slice(1).join("/")}` : ""}` : `the prop state ${A.state[0]} = ${A.state.slice(1).join("/")}` });
  for (const [k, re] of Object.entries(ENTITY_WORDS)) if (re.test(t) && !rainy) out.push({ what: "entity", value: k, text: `the entity ${k} in a row (row.entity)` });
  for (const c of cast.filter((c) => c.kind === "entity")) if (new RegExp(`\\b${c.name.toLowerCase().replace(/^the /, "")}\\b`).test(t) && !rainy) out.push({ what: "entity", value: c.library, text: `${c.name} in a row (row.entity id ${c.id})` });
  if (EVERYONE.test(t)) out.push({ what: "crowd", value: 6, text: "everyone: row.crowd with n >= 6 and an action (run / reach / point), never standing" });
  return out;
}

/** does one of the line's rows satisfy a need? */
function satisfied(need, rows, castOf) {
  const ent = (r) => (r.entity ? castOf[r.entity.id]?.library ?? r.entity.id : null);
  return rows.some((r) => {
    if (need.what === "rain") return Boolean(r.rain) && !String(r.rain.kind).startsWith("entity:") && (need.value === "any" || r.rain.kind === need.value);
    if (need.what === "rain_entity") return Boolean(r.rain) && String(r.rain.kind).startsWith("entity:") && need.value.every((k) => r.rain.kind.includes(k));
    if (need.what === "weather") return r.weather === need.value;
    if (need.what === "entity") return ent(r) === need.value || (r.rain && String(r.rain.kind).includes(need.value));
    if (need.what === "crowd") return (r.crowd?.n ?? 0) >= 6 && r.crowd?.action && r.crowd.action !== "stand";
    if (need.what === "action") {
      const A = ACTIONS[need.value];
      if (A.poses && (r.people ?? []).some((p) => A.poses.includes(p.pose))) return true;
      if (A.held && (r.people ?? []).some((p) => p.holds)) return true;
      if (A.crowd && r.crowd?.action === A.crowd) return true;
      if (A.state && A.state.slice(1).includes(r.states?.[A.state[0]])) return true;
      return false;
    }
    return true;
  });
}

/** the free checks of SHOW WHAT IS SAID + ACTING; returns problems */
export function sayShowProblems(script, rows, { cast = [] } = {}) {
  const out = [], castOf = Object.fromEntries(cast.map((c) => [c.id, c]));
  script.lines.forEach((l, i) => {
    const R = rows.filter((r) => r.line === i + 1);
    for (const need of lineNeeds(l.text, { prevText: script.lines[i - 1]?.text ?? "", cast })) if (!satisfied(need, R, castOf)) out.push(`line ${i + 1} ("${l.text.slice(0, 40)}"): show ${need.text}`);
    if (!SLEEP.test(l.text.toLowerCase())) for (const r of R) for (const p of r.people ?? []) if (p.face === "sleepy") out.push(`line ${i + 1}: ${p.id} has closed eyes (face sleepy) but the line is not about sleep`);
  });
  // ACTING: the hero never stands facing the lens shot after shot
  let run = 0;
  rows.forEach((r, i) => {
    const me = (r.people ?? []).find((p) => p.id === "me");
    run = me && (me.pose ?? "stand") === "stand" && (me.facing ?? "camera") === "camera" ? run + 1 : 0;
    if (run === 3) out.push(`rows ${i - 1}-${i + 1}: me stands facing the camera three shots in a row (give a pose and a facing from the line)`);
  });
  return out;
}

/** the location plan fits the words: a scene whose lines name a side set happens there */
export function placeFitProblems(script, plan, sideSetIds) {
  const out = [];
  for (const sc of plan.scenes) for (const li of sc.lines) {
    const t = (script.lines[li - 1]?.text ?? "").toLowerCase();
    for (const [set, re] of Object.entries(PLACE_WORDS)) if (sideSetIds.includes(set) && re.test(t) && sc.place !== set) out.push(`line ${li} names the ${set.replace(/_/g, " ")} but its scene is in ${sc.place}`);
  }
  return [...new Set(out)];
}
