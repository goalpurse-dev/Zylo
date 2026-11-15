// Blocky Worlds: the LOCATION LIBRARY of the Blender kit engine (owner 2026-11-14). ONE list of every location a story can
// use: our world pack (scripts/blockyWorlds/blenderKit/worlds/worlds.py: PASTEL DOWNTOWN, SUBURB, BRICK CITY, shared
// interiors) and the kit's own sets. The director picks a location per scene; the owner's scene plan can change it.
// Every location has TESTED camera spots (wide / street / close, checked with stills: worlds/stills.mjs). Pure data +
// helpers (shared by the app API, the page and the Blender pipeline).
//   LOCATIONS, locationById(id), pickLocation(text) -> the best id for a free-text place, DRESS (the dressing options)
export const LOCATIONS = Object.freeze([
  { id: "downtown_street", world: "downtown", label: "Downtown street", about: "a long pastel street: shops with striped awnings and story signs, trees, lamps, benches, cars, skyscrapers behind", spots: ["wide", "street", "close", "skyline"], marks: ["street", "sidewalk_east", "sidewalk_west"], words: ["street", "downtown", "city", "shops", "main street", "town", "road", "sidewalk", "mall"] },
  { id: "downtown_plaza", world: "downtown", label: "Town plaza", about: "the plaza at the start of downtown with a fountain and benches", spots: ["wide", "street", "close"], marks: ["plaza", "fountain"], words: ["plaza", "square", "fountain", "park", "crowd", "market"] },
  { id: "downtown_landmark", world: "downtown", label: "Landmark (end of the street)", about: "the landmark at the end of the street: a bank, city hall, clock tower or giant screen (dressed per story)", spots: ["wide", "street", "close"], marks: ["landmark"], words: ["bank", "city hall", "tower", "clock", "screen", "billboard", "mayor", "government", "news", "museum"] },
  { id: "suburb_street", world: "suburb", label: "Suburb street", about: "a street of pastel houses with porches, picket fences, mailboxes and trees", spots: ["wide", "street", "close"], marks: ["street", "sidewalk", "mailbox"], words: ["neighborhood", "neighbour", "neighbor", "suburb", "street", "houses", "mailbox", "fence", "yard"] },
  { id: "suburb_porch", world: "suburb", label: "House porch", about: "the front of one house: porch, door, lawn, fence and mailbox", spots: ["wide", "street", "close"], marks: ["porch", "yard", "mailbox"], words: ["home", "house", "porch", "door", "front door", "doorbell", "lawn"] },
  { id: "brick_street", world: "brick", label: "Brick city street", about: "brick apartments with balconies, bunting across the street, a factory with smokestacks, a rooftop water tower", spots: ["wide", "street", "close", "skyline"], marks: ["street", "stoop", "factory", "sidewalk_east", "sidewalk_west"], words: ["apartment", "brick", "factory", "smokestack", "old town", "city", "balcony", "chimney"] },
  { id: "brick_alley", world: "brick", label: "Brick alley", about: "a narrow alley between brick buildings with a dumpster and crates", spots: ["wide", "street", "close"], marks: ["alley"], words: ["alley", "dumpster", "back street", "hide", "secret"] },
  { id: "living_room", world: "interior", label: "Living room", about: "a cozy living room: couch, rug, coffee table, TV, lamp", spots: ["wide", "street", "close"], marks: ["couch", "center", "tv"], words: ["living room", "couch", "sofa", "tv", "family", "home"] },
  { id: "bedroom", world: "interior", label: "Bedroom", about: "a kid's bedroom: bed, desk, closet, poster", spots: ["wide", "street", "close"], marks: ["bed", "desk", "center"], words: ["bedroom", "bed", "sleep", "night", "room", "closet", "dream"] },
  { id: "kitchen", world: "interior", label: "Kitchen", about: "a kitchen: counter, cabinets, fridge, stove, table", spots: ["wide", "street", "close"], marks: ["table", "counter", "fridge"], words: ["kitchen", "breakfast", "dinner", "cook", "fridge", "food", "eat"] },
  { id: "shop", world: "interior", label: "Shop inside", about: "inside a shop: colourful shelves, a counter, a register, the shop's sign", spots: ["wide", "street", "close"], marks: ["counter", "aisle", "center"], words: ["shop", "store", "buy", "sell", "cashier", "price", "money", "bakery"] },
  { id: "big_hall", world: "interior", label: "Big hall", about: "a big hall with a stage, red curtains, rows of chairs, chandeliers and a banner", spots: ["wide", "street", "close"], marks: ["stage", "aisle", "seats"], words: ["hall", "stage", "show", "speech", "assembly", "ceremony", "contest", "concert", "audience"] },
  { id: "classroom", world: "kit", label: "Classroom", about: "the kit's classroom with desks and a chalkboard", spots: ["wide", "street", "close"], marks: ["front"], words: ["class", "classroom", "school", "teacher", "lesson", "test", "desk"] },
  { id: "hallway", world: "kit", label: "School hallway", about: "the kit's school hallway with lockers", spots: ["wide", "street", "close"], marks: ["hall"], words: ["hallway", "corridor", "lockers", "locker"] },
  { id: "plane_cabin", world: "kit", label: "Plane cabin", about: "the kit's airliner cabin with rows of seats", spots: ["wide", "street", "close"], marks: ["aisle"], words: ["plane", "flight", "seat", "passenger", "airplane", "cabin"] },
  { id: "cockpit", world: "kit", label: "Cockpit", about: "the kit's airliner cockpit", spots: ["wide", "street", "close"], marks: ["seat"], words: ["cockpit", "pilot", "fly", "controls"] },
  { id: "sky_airliner", world: "kit", label: "Plane in the sky", about: "the kit's airliner flying over clouds", spots: ["wide", "street", "close"], marks: ["plane"], words: ["sky", "clouds", "flying", "airplane", "jet"] },
  { id: "moon", world: "kit", label: "The moon", about: "the kit's moon surface with the earth in the sky", spots: ["wide", "street", "close"], marks: ["surface"], words: ["moon", "space", "astronaut", "planet", "stars", "rocket"] },
]);
export const DRESS = Object.freeze({
  time: ["day", "sunset", "night"],
  weather: ["clear", "rain", "snow"],
  landmark: ["bank", "city_hall", "tower", "screen", "none"],
  props: ["cars", "blimp", "bunting"],
});
const byId = new Map(LOCATIONS.map((l) => [l.id, l]));
export const locationById = (id) => byId.get(String(id ?? "")) ?? null;

/** a free-text place ("the bank", "my bedroom", "a rooftop") -> the best library id, or null (no word matches) */
export function pickLocation(text) {
  const t = ` ${String(text ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  if (byId.has(String(text ?? "").trim())) return String(text).trim();
  let best = null, score = 0;
  for (const l of LOCATIONS) {
    let s = 0;
    for (const w of l.words) if (t.includes(` ${w} `)) s += w.includes(" ") ? 2 : 1;
    if (t.includes(` ${l.label.toLowerCase()} `)) s += 3;
    if (s > score) { score = s; best = l.id; }
  }
  return best;
}
