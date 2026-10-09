// Brand safety for Blocky Stories (docs/roblox-scope.md, Part C7): a story
// never names the real platform, a real game on it, another brand, or a real
// creator. Checked in code, not left to the model: the user's own prompt,
// script and series idea are refused with a plain message, and the writer's
// output is sent back for a rewrite.
//
// Only names that are unmistakable are listed. Real games whose name is an
// everyday word ("Doors", "Piggy", "Arsenal", "Jailbreak") are left to the
// writer's rules: banning the word would refuse ordinary lines.

/**
 * What it is → the names. Matched as whole words, any case, spaces optional;
 * except the names in AS_WRITTEN, which are also everyday phrases ("adopt me",
 * "among us") and only count when written as a name: Title Case or ALL CAPS.
 */
const BANNED_NAMES = {
  "the real platform": ["Roblox", "Robux", "Roblox Studio", "Builderman"],
  "a real game": [
    "Brookhaven", "Bloxburg", "Blox Fruits", "Adopt Me", "MeepCity", "Royale High", "Tower of Hell", "Pet Simulator",
    "Bee Swarm", "Murder Mystery 2", "Dress to Impress", "Steal a Brainrot", "Grow a Garden", "Blade Ball",
    "Natural Disaster Survival", "Work at a Pizza Place", "Build a Boat", "Da Hood", "Shindo Life", "Anime Adventures",
    "King Legacy", "Livetopia", "99 Nights in the Forest",
  ],
  "another brand": ["LEGO", "Minecraft", "Fortnite", "Among Us", "Pokemon", "Pokémon", "Nintendo", "PlayStation", "Xbox", "YouTube", "TikTok", "Discord"],
  "a real creator": [
    "MrBeast", "PewDiePie", "KreekCraft", "ItsFunneh", "LankyBox", "TanqR", "Tofuu", "InquisitorMaster", "Leah Ashe",
    "Kindly Keyin", "SSundee", "DanTDM", "Aphmau", "Linkmon99", "Baszucki",
  ],
};

const AS_WRITTEN = new Set(["Adopt Me", "Among Us", "Build a Boat", "Da Hood", "Blade Ball", "Grow a Garden"]);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "Blox Fruits", "bloxfruits" and "BLOX  FRUITS" are all the same name.
const whole = (name) => `(?<![\\p{L}\\p{N}])${name.split(/\s+/).map(escape).join("\\s*")}(?![\\p{L}\\p{N}])`;
const PATTERNS = Object.entries(BANNED_NAMES).flatMap(([kind, names]) => names.map((name) => ({
  kind, name,
  re: AS_WRITTEN.has(name) ? new RegExp(`${whole(name)}|${whole(name.toUpperCase())}`, "u") : new RegExp(whole(name), "iu"),
})));

/** The real names in a text: [{name, kind}], each once. */
export function bannedNamesIn(text) {
  const s = String(text ?? "");
  const found = [];
  for (const p of PATTERNS) if (p.re.test(s) && !found.some((f) => f.name === p.name)) found.push({ name: p.name, kind: p.kind });
  return found;
}

/** A plain message for the user about their own text, or null. */
export function bannedNamesMessage(text) {
  const [hit] = bannedNamesIn(text);
  return hit ? `Leave out "${hit.name}" (${hit.kind}). Blocky Stories can't use real game, brand or creator names: describe it instead, like "an obby game" or "a famous streamer".` : null;
}

/** What the writer is told when its own output names one. */
export function bannedNamesProblem(text, where) {
  const [hit] = bannedNamesIn(text);
  return hit ? `${where}: don't name "${hit.name}" (${hit.kind}); describe it without the real name` : null;
}

/** Upload text may use the platform's name as a search keyword (it is how viewers find these videos); everything else stays banned. */
export function bannedNamesInUploadText(text) {
  return bannedNamesIn(text).filter((f) => f.name !== "Roblox");
}
