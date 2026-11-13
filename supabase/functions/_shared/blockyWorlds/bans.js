// Blocky Worlds: NEVER REUSE THE EXAMPLES' PIECES (owner, 2026-11-14). The writer learns STYLE from the kit's example scripts and the
// viral references, but must not reuse their rule, props, characters or twist ("the last plane script still sneezed"). Pure, free.
//   - BANNED_CONCEPTS: the examples' specific pieces (sneezing / teleporting, a cat allergy, pepper, laughing-floats, monsters that
//     wear faces, the spy behind the wall, the radio to mom, ...) as patterns; a script that uses one fails a HARD check.
//   - BANNED_NAMES: every character name of the examples, the library fixture and past scripts; a script that uses one fails.
//   - FRESH_NAMES + freshNames(): a deterministic pool of new names, handed to the planner every time, minus the USED-NAMES LOG
//     (the names of every script written so far: db table blocky_worlds_name_log, migration 20261215100000).
// The customer's OWN topic is exempt: if the topic itself says "sneeze", the story may sneeze.

/** The pieces of the examples (the kit's two scripts, the 6M-view reference, our own old examples). id -> pattern, why. */
export const BANNED_CONCEPTS = Object.freeze([
  { id: "sneezing", re: /\b(sneez\w*|achoo|ah-?choo|atchoo|choo)\b/i, why: "sneezing is the kit's example rule" },
  { id: "cat allergy", re: /\ballerg\w*[^.!?]{0,40}\bcats?\b|\bcats?\b[^.!?]{0,40}\ballerg\w*/i, why: "the cat allergy is the kit's example" },
  { id: "pepper", re: /\bpepper\w*\b/i, why: "pepper is the kit's example prop" },
  { id: "teleporting", re: /\bteleport\w*\b/i, why: "teleporting is the kit's example rule" },
  { id: "laughing floats", re: /\b(laugh\w*|giggl\w*)\b[^.!?]{0,50}\b(float\w*|lighter than air|rise|rose)\b|\b(float\w*)\b[^.!?]{0,50}\b(laugh\w*|giggl\w*)\b/i, why: "laughing makes you float is the kit's example rule" },
  { id: "face-wearing monsters", re: /\b(take|took|taking|pull|pulled|peel|peeled)s?\s+(off\s+)?(its|his|her|their|my|your)?\s*faces?\s+off\b|\bfaces?\s+(on|off)\s+(the\s+)?hooks?\b|\b(wear|wore|wearing|worn)\s+(our|my|your|their|stolen|borrowed)\s+faces?\b|\bfaces?\s+they\s+(ate|stole)\b|\blooks? like (one|us|a human)\b[^.!?]{0,40}\b(monster|ate)\b|\bhang\w*\s+(it|them|their faces?)\s+on\s+(a\s+)?(nails?|hooks?)\b/i, why: "monsters wearing human faces is the 6M reference" },
  { id: "spy behind the wall", re: /\b(spy|spies|spied)\b|\bbehind the wall\b|\bthe wall (can|could|will|would) shut\b|\bthe wall\b[^.!?]{0,30}\b(gate|hunters?)\b/i, why: "the spy and the wall is the 6M reference" },
  { id: "radio to mom", re: /\bradio\w*\b[^.!?]{0,40}\b(mom|mum|mother|mama)\b|\b(mom|mum|mother)\b[^.!?]{0,40}\bradio\b/i, why: "the radio to mom is the 6M reference" },
  { id: "hunters and cage", re: /\bhunters?\b[^.!?]{0,40}\bcage\b|\bfeast night\b/i, why: "the hunters and the cage are the 6M reference" },
  { id: "the reset button", re: /\breset button\b/i, why: "the reset button is the reference twist" },
  // the viral references' premises (references.js): never reuse their pieces
  { id: "chalk line", re: /\bchalk (line|circle)s?\b/i, why: "a reference premise" },
  { id: "town in a whale", re: /\b(inside|in the belly of|belly of) (a |the )?(giant )?whale\b/i, why: "a reference premise" },
  { id: "NPCs", re: /\bNPCs?\b/, why: "a reference premise" },
  { id: "sniper dot", re: /\bsniper\b|\bred (laser )?dot\b/i, why: "a reference premise" },
  { id: "whistle back", re: /\bwhistle\w*\b[^.!?]{0,40}\b(back|answers?)\b/i, why: "a reference premise" },
  { id: "streetlights that take you", re: /\bstreetlights?\b[^.!?]{0,60}\b(gone by morning|go out|goes out)\b/i, why: "a reference premise" },
  { id: "born with wings", re: /\bborn with wings\b/i, why: "a reference premise" },
]);

/** Character names of the examples, the library fixture and every past script (lowercase). */
export const BANNED_NAMES = Object.freeze([
  "pell", "dorran", "dorn", "hollis", "fenwick", "wim", "nell", "tilly", "quibble", "huxworth", "pickle", "whiskers", "leo", "gus", "eddie",
  "mo", "pip", "ott", "wilda", "ames", "jude", "barnaby", "nub", "kai", "henderson", "moss", "tamsin", "dobb", "fitch", "bea", "lou",
  "turbulence", "dottie", "biscuit", "garnet", "gorp", "pickett", "huxworth", "quibble", "keeper",
  // the idea library's titled names (src/components/viral-tools/blocky-worlds/dev/libraryFixture.json)
  "dobbin", "hobb", "gable", "dunn", "fitz", "marla", "tuft", "abbot", "garza", "pike", "orrin", "tilly", "quill", "pell", "tuck", "gruff", "hale", "burke", "lin", "lund", "finn", "tate", "orr", "lopez", "gus", "vane", "hank", "dilly", "dabney", "pickles", "gritt", "pruitt", "olsen", "rue", "ames", "tully", "dobbs", "ruiz", "pickett", "tamm", "vance", "okafor", "bix", "fenn", "hanley", "okoro", "grubb", "ferris", "abara", "tubbs", "cobb", "priya", "finch", "argyle", "gurney", "banks", "fennel", "alder",
]);

/** Banned-piece notes of a script: [{ id, why, lines }] (0-based lines), the topic's own words exempt. */
export function bannedConcepts(lines, topic = "") {
  const out = [];
  const texts = (lines ?? []).map((l) => String(l?.text ?? l));
  for (const c of BANNED_CONCEPTS) {
    if (c.re.test(String(topic ?? ""))) continue;
    const at = texts.map((t, i) => (c.re.test(t) ? i : -1)).filter((i) => i >= 0);
    if (at.length) out.push({ id: c.id, why: c.why, lines: at });
  }
  return out;
}

/** The banned names a text uses (title-names and capitalised words), lowercase, the topic's own names exempt. */
export function bannedNamesIn(text, topic = "") {
  const found = new Set();
  const own = new Set(String(topic ?? "").toLowerCase().split(/[^a-z]+/));
  for (const w of String(text ?? "").match(/\b[A-Z][a-z]{1,}\b/g) ?? []) {
    const k = w.toLowerCase();
    if (BANNED_NAMES.includes(k) && !own.has(k)) found.add(k);
  }
  return [...found];
}

const PREFIX = "Formula:";
/** The free check: HARD notes (they name their lines for Fix it) when a script reuses the examples' pieces or names. */
export function bannedProblems(script, topic = "") {
  const lines = script?.lines ?? [];
  const out = [];
  const tag = (idx) => `(${idx.length === 1 ? "line" : "lines"} ${idx.slice(0, 6).map((i) => i + 1).join(", ")})`;
  for (const c of bannedConcepts(lines, topic)) out.push(`${PREFIX} reuses a piece of the examples (${c.id}: ${c.why}). Write your OWN rule, props, characters and twist. ${tag(c.lines)}`);
  const names = new Set();
  const at = [];
  lines.forEach((l, i) => { const f = bannedNamesIn(l.text, topic); if (f.length) { at.push(i); f.forEach((n) => names.add(n)); } });
  if (names.size) out.push(`${PREFIX} reuses character names from the examples or past stories (${[...names].slice(0, 6).join(", ")}). Use the fresh names the plan gave. ${tag(at)}`);
  return out;
}

/** The pool of fresh names (first names and surnames that are in no example, fixture or past script). */
export const FRESH_NAMES = Object.freeze([
  "Brindle", "Cosmo", "Dax", "Fennel", "Garrick", "Hattie", "Ignatius", "Juniper", "Kestrel", "Lumi", "Marlo", "Nettle", "Orla", "Pascoe", "Quill",
  "Rafferty", "Sorrel", "Thistle", "Ulric", "Vesper", "Wren", "Xander", "Yarrow", "Zeb", "Alder", "Bramwell", "Clover", "Dorrit", "Ember", "Flint",
  "Gideon", "Hollis-free", "Indigo", "Jasper", "Kipp", "Linnea", "Merrick", "Nimbus", "Odette", "Peregrine", "Quincy", "Rosalind", "Soren", "Tobias",
  "Una", "Valmer", "Wick", "Yuri", "Zinnia", "Abernathy", "Birdie", "Cassius", "Delphine", "Egbert", "Fable", "Gus-free", "Haddock", "Iona",
  "Jory", "Kelpie", "Lorcan", "Mabel", "Nolan", "Osric", "Pilar", "Rue", "Sable", "Teague", "Umber", "Vance", "Willow", "Yves", "Zora", "Arlo",
  "Bex", "Corwin", "Dilys", "Esme", "Fitz", "Greer", "Hobart", "Isolde", "Jorah-free", "Knox", "Lark", "Moxie", "Nan", "Ozzie", "Pru", "Rolf",
].filter((n) => !/-free$/.test(n) && !BANNED_NAMES.includes(n.toLowerCase())));

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/**
 * n fresh names for this story: deterministic for a seed (a topic + a date, a run id), never a banned name, never one in the
 * used-names log (`used`: names of past scripts), spread across the pool.
 */
export function freshNames({ n = 4, seed = "", used = [] } = {}) {
  const skip = new Set([...BANNED_NAMES, ...used.map((u) => String(u).toLowerCase())]);
  const pool = FRESH_NAMES.filter((x) => !skip.has(x.toLowerCase()));
  const out = [];
  let h = hash(seed);
  while (out.length < Math.min(n, pool.length)) {
    const pick = pool[h % pool.length];
    if (!out.includes(pick)) out.push(pick);
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  }
  return out;
}

/** The names the story uses (title-names + mid-sentence capitals) for the used-names log. */
export function namesUsedBy(texts) {
  const found = new Set();
  for (const t of texts) for (const m of String(t).matchAll(/\b(?:Mr|Mrs|Ms|Miss|Dr|Captain|Coach|Grandpa|Grandma|Aunt|Uncle|Teacher|Mayor|Officer|Chief|Pilot|Nurse|Baker)\.?\s+([A-Z][a-z]+)/g)) found.add(m[1].toLowerCase());
  for (const t of texts) for (const s of String(t).split(/(?<=[.!?])\s+/)) for (const w of s.split(/\s+/).slice(1)) { const c = w.replace(/[^A-Za-z]/g, ""); if (/^[A-Z][a-z]{2,}$/.test(c) && FRESH_NAMES.includes(c)) found.add(c.toLowerCase()); }
  return [...found];
}

/** The prompt block: the names to use and the pieces never to reuse (the same words every call except the names). */
export function freshNamesBlock(names) {
  return `FRESH NAMES FOR THIS STORY (use exactly these: ${names.slice(0, 3).join(", ")} for the three named characters, ${names[3] ?? "any new name"} for the narrator; never any other name, never a name from an example, a fixture or an earlier story).`;
}
export const BANNED_TEXT = `NEVER REUSE THE EXAMPLES' PIECES. Learn their STYLE, never their rule, props, characters or twist. Banned: ${BANNED_CONCEPTS.map((c) => c.id).join("; ")}. Invent your own rule, your own props and your own twist.`;
