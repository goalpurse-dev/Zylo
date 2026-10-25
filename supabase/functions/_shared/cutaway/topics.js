// Cutaway Explainer: the premade topics, and the one rule for "premade or custom" and "can the kit build it".
// Used by the page (live price label, the "can't build" message) and by cutaway-api, which decides the price and
// refuses unbuildable topics on its own, from the topic text, never from what the page sends.
//
// Premade = a topic from this list, tapped or typed ("how does a septic tank work" = Septic tank): the cheaper
// price (pricing.js PRICES_3D.premade). `layout: true` = a saved layout exists; premade topics without one still
// pay the premade price (we absorb the first build, then its layout is saved for everyone).
// Custom = anything else: the higher price, after the kit check below says it can be built.

export const PREMADE = Object.freeze([
  { key: "landfill", topic: "Landfill", hook: "dig a pit and throw your trash in", layout: true, aliases: ["landfill", "landfills", "garbage dump", "trash dump", "rubbish dump", "dump site"], related: ["trash", "garbage", "waste", "rubbish", "dump", "liner", "methane"] },
  { key: "french_drain", topic: "French drain", hook: "dig a ditch along your house", layout: true, aliases: ["french drain", "french drains", "yard drain", "drain tile", "perimeter drain"], related: ["drain", "drainage", "rain", "flood", "flooding", "basement", "yard", "puddle", "soggy", "foundation", "gravel"] },
  { key: "septic_tank", topic: "Septic tank", hook: "dig a hole behind the house and flush into it", aliases: ["septic tank", "septic tanks", "septic system", "septic", "leach field", "drain field"], related: ["toilet", "sewage", "waste", "flush", "bathroom", "poop"] },
  { key: "swimming_pool", topic: "Swimming pool", hook: "dig a hole in your yard and fill it with water", aliases: ["swimming pool", "swimming pools", "pool", "pools", "inground pool", "in ground pool"], related: ["swim", "swimming", "pond", "hot tub", "water", "filter", "chlorine"] },
  { key: "water_well", topic: "Water well", hook: "dig down until the hole fills with water", aliases: ["water well", "water wells", "a well", "the well", "wells", "borehole", "well water"], related: ["groundwater", "aquifer", "pump", "drinking water", "water", "spring"] },
  { key: "road", topic: "Road", hook: "scrape off the grass and drive on the dirt", aliases: ["road", "roads", "street", "streets", "highway", "highways", "asphalt road", "paved road"], related: ["asphalt", "pavement", "driveway", "car", "traffic", "pothole", "gravel"] },
  { key: "rain_gutter", topic: "Rain gutter", hook: "let the rain pour straight off your roof", aliases: ["rain gutter", "rain gutters", "gutter", "gutters", "downspout", "downspouts"], related: ["roof", "rain", "eave", "water"] },
  { key: "sewer_pipe", topic: "Sewer pipe", hook: "run a pipe from your toilet to the street", aliases: ["sewer pipe", "sewer pipes", "sewer", "sewers", "sewer line", "sewage pipe"], related: ["toilet", "sewage", "drain", "flush", "street"] },
  // beyond the home (NON_HOME_CATALOG.md): the city parts kit (cityParts.js, vending.js)
  { key: "vending_machine", topic: "Vending machine", hook: "put a coin in and wait for your snack", layout: true, setting: "street", aliases: ["vending machine", "vending machines", "snack machine", "soda machine", "drink machine"], related: ["snack", "soda", "coin", "machine"] },
  { key: "car_wash", topic: "Car wash", hook: "drive your dirty car into the bay", layout: true, setting: "carwash", aliases: ["car wash", "car washes", "carwash", "automatic car wash"], related: ["car", "soap", "brushes", "water"] },
  { key: "traffic_light", topic: "Traffic light", hook: "stop at the red light and wait", setting: "street", aliases: ["traffic light", "traffic lights", "stop light", "stoplight", "traffic signal", "traffic signals"], related: ["intersection", "car", "red light", "road"] },
  { key: "fire_hydrant", topic: "Fire hydrant", hook: "open the short red post on the sidewalk", setting: "street", aliases: ["fire hydrant", "fire hydrants", "hydrant", "hydrants", "fire plug"], related: ["firefighter", "water main", "water", "street"] },
  { key: "atm", topic: "ATM", hook: "put your card in the cash machine", setting: "street", aliases: ["atm", "atms", "cash machine", "cash machines", "cashpoint"], related: ["cash", "bank", "money", "card"] },
].map((t) => Object.freeze({ layout: false, ...t })));

// Words that don't change what the video is about ("how does a septic tank work").
const FILLER = new Set("how does do did is are was were a an the what why when where work works working worked explained explain explainer built build building made make making inside my your our of in for on under underground ground home house backyard yard video cutaway 3d really actually exactly get gets kind type types".split(" "));

export const normTopic = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => normTopic(s).split(" ").filter(Boolean);
const hasPhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `);

/**
 * Premade or custom. Premade when exactly one premade topic is named and nothing else is asked for
 * ("how does a septic tank work", "Septic tank", "septic tanks explained"); "septic tank vs sewer" or
 * "pool heater" are custom.
 */
export function classifyTopic(text) {
  const t = normTopic(text);
  if (!t) return { kind: "custom", premade: null };
  const hits = PREMADE.map((p) => ({ p, alias: [...p.aliases].sort((a, b) => b.length - a.length).find((a) => hasPhrase(t, a)) })).filter((h) => h.alias);
  if (hits.length !== 1) return { kind: "custom", premade: null };
  const { p, alias } = hits[0];
  const rest = ` ${t} `.replace(` ${alias} `, " ").trim().split(" ").filter((w) => w && !FILLER.has(w));
  return rest.length ? { kind: "custom", premade: null } : { kind: "premade", premade: p.key };
}

export const premadeByKey = (key) => PREMADE.find((p) => p.key === key) ?? null;

// ---------- the kit check (free, in code): can the parts kit build a custom topic? ----------
// The kit is a "yard + soil cut" world: a house, a lawn, a soil cut face with strata and groundwater, things dug
// into the ground (pits, trenches, holes), fills (gravel, water, soil, clay), pipes along any path, tanks, sheets and
// liners, rain and runoff, trucks, simple props. Topics that need other parts are refused before any charge.
const KIT_WORDS = new Set("pit pits trench trenches ditch ditches hole holes pipe pipes piping pipeline tank tanks cistern barrel drain drains drainage culvert culverts gravel soil dirt groundwater aquifer rain rainwater stormwater storm flood flooding basement foundation footing footings sewer sewage septic leach pond ponds pool pools well wells pump sump gutter gutters downspout landfill trash garbage compost garden irrigation sprinkler sprinklers dig digging buried bury concrete slab driveway road roads asphalt pavement curb sidewalk geothermal soakaway puddle mud clay sand lawn retaining fence posts post".split(" "));
const KIT_PHRASES = ["dry well", "rain barrel", "rain garden", "storm drain", "retaining wall", "fence post", "water main", "water line", "gas line", "septic system", "drain field", "sump pump", "ground loop"];
// What the kit has no parts for, by kind (a hit here refuses the topic).
const BLOCKERS = [
  ["kitchen appliances", "fridge refrigerator freezer microwave oven stove dishwasher toaster blender kettle coffee washing washer dryer"],
  ["electronics", "phone smartphone iphone computer laptop chip chips battery batteries internet wifi radio camera tv television screen speaker headphones router"],
  ["engines and vehicles' insides", "engine engines motor jet jets plane airplane aircraft rocket rockets helicopter train trains ship ships submarine bicycle gearbox transmission"],
  ["the human body", "heart brain lungs lung body blood eye eyes ear ears cell cells virus dna stomach kidney liver muscle bone bones"],
  ["space", "sun moon planet planets star stars galaxy satellite satellites mars spaceship"],
  ["tall buildings and big structures", "skyscraper elevator escalator bridge dam tower nuclear reactor turbine windmill"],
  ["ideas without a physical build", "money stock stocks economy love music language government politics bitcoin crypto"],
].map(([label, list]) => ({ label, set: new Set(list.split(" ")) }));
const BLOCKER_PHRASES = [["kitchen appliances", "washing machine"], ["tall buildings and big structures", "power plant"], ["tall buildings and big structures", "wind turbine"], ["electronics", "solar panel"], ["space", "black hole"]];

/**
 * The free kit check. verdict: "yes" (only kit parts named), "no" (it needs parts the kit doesn't have: `missing`
 * names what), "unsure" (nothing either way: the server asks Claude Haiku 5.5, about $0.0005, see kitCheck.js).
 * `closest`: the 3 premade topics nearest to it, for "We can't build this one yet".
 */
export function kitCheck(text) {
  const t = normTopic(text), w = words(text);
  // a premade topic is one the kit was built for: buildable before its layout is approved, with no Claude check
  if (classifyTopic(text).kind === "premade") return { verdict: "yes", missing: [], closest: closestPremade(text, 3) };
  const missing = new Set();
  for (const b of BLOCKERS) if (w.some((x) => b.set.has(x))) missing.add(b.label);
  for (const [label, phrase] of BLOCKER_PHRASES) if (hasPhrase(t, phrase)) missing.add(label);
  const kitHit = w.some((x) => KIT_WORDS.has(x)) || KIT_PHRASES.some((p) => hasPhrase(t, p));
  const verdict = missing.size ? "no" : kitHit ? "yes" : "unsure";
  return { verdict, missing: [...missing], closest: closestPremade(text, 3) };
}

/** The premade topics nearest to a text: shared words with their names, aliases and related words; ready ones first on ties. */
export function closestPremade(text, n = 3) {
  const w = new Set(words(text).filter((x) => !FILLER.has(x)));
  const score = (p) => {
    let s = 0;
    for (const phrase of [p.topic.toLowerCase(), ...p.aliases, ...p.related]) for (const x of phrase.split(" ")) if (w.has(x)) s += phrase === p.topic.toLowerCase() ? 3 : 1;
    return s;
  };
  return [...PREMADE].map((p, i) => ({ p, s: score(p), i })).sort((a, b) => b.s - a.s || Number(b.p.layout) - Number(a.p.layout) || a.i - b.i).slice(0, n).map(({ p }) => p.key);
}
