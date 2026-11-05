// Blocky Worlds: what a story may never contain (ANALYSIS.md 4.3 and 6.6). Checked in code on every idea and script.
//   1. famous stories' titles, characters and places: we borrow a premise's SHAPE, never its names
//   2. the game platform the look is inspired by: its name, currency, terms and famous experiences
//   3. gore and adult content (the audience is young: PG fear only)

// Whole words or phrases, matched case-insensitively. Extend the lists, never loosen the check.
const FAMOUS = [
  // (everyday phrases that are also titles, like "it follows", "inside out" or "the village", can't be listed)
  "city of ember", "ember", "silo", "wool", "truman", "free guy", "guy", "snowpiercer",
  "the mimic", "gulliver", "lilliput", "monkey's paw", "monkeys paw", "rudolph", "monsters, inc", "monsters inc",
  "sulley", "boo", "pinocchio", "monstro", "jonah", "coraline", "stranger things",
  "hunger games", "harry potter", "hogwarts", "narnia", "willy wonka", "matrix", "neo", "minecraft", "fortnite",
  "pokemon", "pokémon", "mario", "sonic", "zelda", "scp", "scp-3008", "backrooms", "slender", "slenderman",
  "siren head", "huggy wuggy", "poppy playtime", "fnaf", "freddy", "skibidi", "subnautica", "iron lung",
  "bird box", "a quiet place", "nosedive", "black mirror", "megamind", "incredibles", "syndrome", "spider-man",
  "spiderman", "batman", "superman", "frozen", "elsa", "moana", "shrek", "toy story", "buzz lightyear", "woody",
];
const PLATFORM = [
  "roblox", "robux", "bloxburg", "brookhaven", "adopt me", "blox fruits", "doors", "piggy", "obby", "oof", "noob",
  "bacon hair", "builderman", "rthro", "r6", "r15", "gamepass", "game pass", "admin commands",
];
const GORE = [
  "blood", "bloody", "gore", "guts", "decapitat", "dismember", "behead", "corpse", "stab", "stabbed", "murder",
  "suicide", "kill himself", "kill herself", "torture", "sex", "nude", "naked", "drugs", "cocaine", "meth", "gun", "rifle",
  "pistol", "shotgun", "bomb", "terrorist",
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordsRe = (list, prefixOnly = false) => new RegExp(`(?<![\\p{L}\\p{N}])(${list.map(esc).join("|")})${prefixOnly ? "" : "(?![\\p{L}\\p{N}])"}`, "iu");

const FAMOUS_RE = wordsRe(FAMOUS.filter((w) => !["guy", "boo", "neo", "woody", "ember", "silo", "wool", "syndrome", "freddy", "doors", "piggy", "frozen"].includes(w)));
// Common words that are also famous names: only a problem in a name position (capitalized, not at a sentence start).
const FAMOUS_NAMES = ["Guy", "Boo", "Neo", "Woody", "Ember", "Silo", "Wool", "Freddy", "Frozen", "Doors", "Piggy"];
const FAMOUS_NAME_RE = new RegExp(`(?<=[a-z,;] )(${FAMOUS_NAMES.join("|")})(?![\\p{L}])`, "u");
const PLATFORM_RE = wordsRe(PLATFORM);
const GORE_RE = new RegExp(`(?<![\\p{L}])(${GORE.map(esc).join("|")})`, "iu");

/** The problems in a piece of story text, as sentences (empty = fine). */
export function safetyProblems(text) {
  const t = String(text ?? "");
  const out = [];
  const famous = t.match(FAMOUS_RE)?.[1] ?? t.match(FAMOUS_NAME_RE)?.[1];
  if (famous) out.push(`Uses "${famous}", a famous story's name. Use an original world and names.`);
  const platform = t.match(PLATFORM_RE)?.[1];
  if (platform) out.push(`Uses "${platform}", a game platform's term. Blocky Worlds never names or copies a real game.`);
  const gore = t.match(GORE_RE)?.[1];
  if (gore) out.push(`Uses "${gore}". Keep it PG: suggest the danger, never show or say gore.`);
  return out;
}

/**
 * Topic rules for "Your topic": its length and no gore. A famous name or a game's name in the topic is fine: the
 * writer turns it into an original world, and the script check refuses the name itself.
 */
export const TOPIC = Object.freeze({ min: 2, max: 200 }); // 200: an edited idea opener (up to ~24 words) is a topic too
export function topicProblem(topic) {
  const t = String(topic ?? "").trim();
  if (t.length < TOPIC.min || t.length > TOPIC.max) return `Type a topic (${TOPIC.min} to ${TOPIC.max} characters).`;
  return GORE_RE.test(t) ? "We can't make a story about that topic." : null;
}
