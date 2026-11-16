// Blocky Worlds: MISSING PLACES (owner 2026-11-16, after the live "The Yawn That Took the Hill": no hill anywhere and a
// random plane in the clouds). A place the script names that the location library lacks (a hill, a river, a forest
// ...) is BUILT simply in a HOST library place from the existing world helpers, never replaced by something unrelated.
// Pure data + helpers (the scene-plan picker, the auto notes, the director's brief and its free check).
//   PLACE_BUILDS, placeBuildsIn(text) -> [build], placeBuildById(id)
//   EXOTIC: library places that must be NAMED by their line (a plane, the moon ...); unrelatedPlace(location, text)
export const PLACE_BUILDS = Object.freeze([
  { id: "hill", words: ["hill", "hills", "hilltop", "uphill", "downhill", "hillside"], host: "downtown_landmark",
    recipe: "a grassy HILL at the end of the street: dict(ZW_STORY_DRESS, landmark=\"none\") and, in header_code, a green hill at the landmark spot (x 0, y 178): stacked green slabs or a squashed green sphere about 40 wide and 18 high, a light stone PATH zig-zagging up its front, a few library trees on its sides, a flat top where people stand (zw_ground on the top height); the town street below it. Shots ON the hill look down at the town; shots FROM the town look up at it." },
  { id: "mountain", words: ["mountain", "mountains", "peak", "cliff"], host: "downtown_landmark",
    recipe: "a blocky grey MOUNTAIN behind the end of the street (landmark \"none\"): stacked grey slabs narrowing to a snowy white top, about 60 high, a path up its side; the town below." },
  { id: "river", words: ["river", "stream", "creek"], host: "suburb_street",
    recipe: "a RIVER across the suburb street: a long flat blue slab (slightly transparent) about 10 wide across the road, grassy banks, a small wooden bridge of brown planks." },
  { id: "lake", words: ["lake", "pond"], host: "downtown_plaza",
    recipe: "a POND in the plaza: a wide flat blue disc around the fountain spot, a ring of grey stones, reeds (thin green boxes)." },
  { id: "beach", words: ["beach", "sea", "ocean", "shore", "waves"], host: "suburb_street",
    recipe: "a BEACH at the end of the suburb street: a sand-coloured slab, a wide blue sea slab beyond it with white wave strips, an umbrella (a cone on a pole)." },
  { id: "forest", words: ["forest", "woods", "jungle"], host: "suburb_street",
    recipe: "a FOREST: many library trees close together along the suburb street (both sides, several rows), a dirt path (brown slab) between them." },
  { id: "farm", words: ["farm", "barn", "field", "fields", "farmer"], host: "suburb_street",
    recipe: "a FARM: a red block barn with a white X door at the end of the suburb street, a green field slab with rows of crops (small green boxes), a fence." },
  { id: "castle", words: ["castle", "palace", "fortress"], host: "downtown_landmark",
    recipe: "a CASTLE at the landmark spot (landmark \"none\"): grey block walls with crenellations, two round towers (cylinders with cone roofs), a big wooden gate." },
  { id: "bridge", words: ["bridge"], host: "downtown_street",
    recipe: "a BRIDGE across the street: a long slab on two pillars over the road, railings, people can stand on it (zw_ground)." },
  { id: "cave", words: ["cave", "tunnel"], host: "brick_alley",
    recipe: "a CAVE mouth at the end of the alley: a dark grey rock arch (stacked boxes) with a black opening, a lantern glow inside." },
  { id: "volcano", words: ["volcano", "lava"], host: "downtown_landmark",
    recipe: "a VOLCANO behind the street (landmark \"none\"): a dark brown cone, an orange glowing top and orange lava strips down its side, smoke puffs." },
  { id: "island", words: ["island"], host: "downtown_plaza",
    recipe: "an ISLAND: a round sand-and-grass mound in a wide blue water disc at the plaza, one palm (a trunk + green leaf boxes)." },
]);
const byId = new Map(PLACE_BUILDS.map((b) => [b.id, b]));
export const placeBuildById = (id) => byId.get(String(id ?? "")) ?? null;
const words = (text) => ` ${String(text ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ")} `;
/** the missing places a text names (in list order, each once) */
export function placeBuildsIn(text) {
  const t = words(text);
  return PLACE_BUILDS.filter((b) => b.words.some((w) => t.includes(` ${w} `)));
}
/** library places a line must NAME to be used (an unrelated plane / moon is never a stand-in for a figure of speech) */
export const EXOTIC = Object.freeze({
  sky_airliner: ["plane", "airplane", "jet", "flight", "flying", "fly", "flew", "airliner", "pilot", "sky"],
  plane_cabin: ["plane", "airplane", "jet", "flight", "cabin", "passenger", "passengers", "airliner", "seat"],
  cockpit: ["cockpit", "pilot", "plane", "airplane", "jet", "controls"],
  moon: ["moon", "space", "astronaut", "planet", "rocket", "stars"],
});
/** is this library place unrelated to the line (an EXOTIC place the line never names)? */
export function unrelatedPlace(location, text) {
  const w = EXOTIC[location];
  if (!w) return false;
  const t = words(text);
  return !w.some((x) => t.includes(` ${x} `));
}
