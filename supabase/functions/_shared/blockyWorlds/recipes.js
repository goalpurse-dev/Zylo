// Blocky Worlds: which launch recipe a story uses (owner, 2026-11-07). Free and deterministic: the user's topic, the idea
// card and the beat sheet are scored against each recipe's keywords and features; no paid call. The recipes are the
// working names of the launch shapes (the engine builds each one); the picker only names the best fit and why.

export const RECIPES = Object.freeze({
  creature_town_attack: Object.freeze({ name: "Town on a creature, under attack", what: "a town on or inside a giant creature, under threat" }),
  curfew_monster: Object.freeze({ name: "Curfew monster", what: "a rule (be home / never do X) and a night monster that takes rule-breakers" }),
  everyone_except_me: Object.freeze({ name: "Everyone except me", what: "everyone has X except the narrator" }),
  lost_pet_in_town: Object.freeze({ name: "Lost pet in town", what: "the narrator's pet is lost somewhere in the town" }),
  giant_reveal: Object.freeze({ name: "Giant reveal", what: "a hidden giant or monster is revealed" }),
  // 2026-11-08 (the reference study, recipes/picks.json): two more shapes from the 38 references
  rigged_system: Object.freeze({ name: "Rigged system", what: "an unfair town rule (rich up high, poor below; sizes; classes); the kid finds what really runs it" }),
  absurd_rule_comedy: Object.freeze({ name: "Absurd rule comedy", what: "a silly rule shown through rapid gags; the kid games the rule; a punchline ending" }),
});
export const RECIPE_IDS = Object.freeze(Object.keys(RECIPES));

const words = (s) => String(s ?? "").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
const stem = (w) => w.replace(/'s$/, "").replace(/(ies)$/, "y").replace(/(ing|ed|es|s)$/, "");

// keyword stems per recipe (matched on word stems)
const KEYS = {
  creature_town_attack: {
    container: "turtle whale giant creature beast dragon shell back inside elephant snail tortoise fish crab monster".split(" "),
    threat: "hunt attack army soldier shark wolf eat invade siege chase raid pirate enemy hunter".split(" "),
  },
  curfew_monster: "curfew night dark outside after pm o'clock midnight sundown sunset streetlight home before taken take vanish gone never rule".split(" "),
  everyone_except_me: "everyone everybody except fly wing born power only".split(" "),
  lost_pet_in_town: "dog puppy cat kitten pet hamster bunny rabbit parrot lost missing ran runaway search find".split(" "),
  rigged_system: "rich richer richest poor poorer poorest higher lower ground top bottom class born size sizes kingdom underground floor tower money wealthy unfair".split(" "),
  absurd_rule_comedy: "silly funny sneeze sneezes laugh pancake sock socks pay paid hat hats dance tickle burp hiccup".split(" "),
  giant_reveal: "hidden secret actually really reveal sleeping giant underneath beneath true truth disguise was".split(" "),
};
const stems = (list) => new Set(list.map((w) => stem(w)));
const STEMS = Object.fromEntries(Object.entries(KEYS).map(([id, v]) => [id, Array.isArray(v) ? stems(v) : Object.fromEntries(Object.entries(v).map(([k, l]) => [k, stems(l)]))]));
const hits = (ws, set) => [...new Set(ws.filter((w) => set.has(stem(w))))];

/** "everyone ... except me", "all of us ... but me", "the only one who can't". */
const EXCEPT_ME = /\b(?:everyone|everybody|all of us|every (?:kid|person|one))\b[^.]*\b(?:except|but|apart from|other than) me\b|\bthe only (?:one|kid|person) (?:who|that) (?:can't|cannot|doesn't|does not|isn't|has no)\b/i;
/** a town on the back of / inside a creature */
const ON_CREATURE = /\b(?:on (?:the )?back of|on (?:a|the) giant|inside (?:a|the) (?:giant|huge|big)|in(?:side)? (?:its|the) shell)\b/i;
/** a pet that is lost */
const LOST_PET = /\b(?:my|our|the|a) (?:dog|puppy|cat|kitten|pet|hamster|bunny|rabbit|parrot)\b[^.]*\b(?:lost|missing|ran away|run away|got away|disappeared)\b/i;
/** a time-of-day rule */
const CURFEW = /\b(?:after|before|past) (?:\d{1,2}|nine|ten|eleven|twelve|midnight|dark|sundown|sunset)\b|\bhome before\b|\bcurfew\b|\boutside after\b/i;
/** rich and poor: a rigged system */
const RIGGED = /\b(?:rich|richer|richest|wealthy)\b[^.]*\b(?:poor|poorer|poorest)\b|\b(?:poor|poorer|poorest)\b[^.]*\b(?:rich|richer|richest|wealthy)\b/i;
/** a hidden thing revealed */
const REVEAL = /\b(?:is|was|were) (?:actually|really|secretly)\b|\bturns? out\b|\bhidden (?:giant|monster)\b|\bsleeping giant\b/i;

/**
 * The best launch recipe for a story: { id, name, reason, scores }. Free. topic: the user's words (weighted most);
 * card: the idea card (formula, opener, premise, twist); beats: the beat sheet (its until / discovery / climax features).
 */
export function pickRecipe({ topic = "", card = null, beats = null } = {}) {
  const t = String(topic ?? ""), cardText = card ? [card.opener, card.premise, card.twist].join(" ") : "";
  const beatText = (Array.isArray(beats) ? beats : []).map((b) => `${b.summary ?? ""} ${b.shows ?? ""}`).join(" ");
  const tw = words(t), cw = words(cardText), bw = words(beatText);
  const score = Object.fromEntries(RECIPE_IDS.map((id) => [id, 0]));
  const why = Object.fromEntries(RECIPE_IDS.map((id) => [id, []]));
  const add = (id, n, reason) => { score[id] += n; if (reason && !why[id].includes(reason)) why[id].push(reason); };

  // 1. the topic's own shape (strong, the user's words)
  if (EXCEPT_ME.test(t)) add("everyone_except_me", 8, `the topic says "${t.match(EXCEPT_ME)[0]}"`);
  if (LOST_PET.test(t)) add("lost_pet_in_town", 8, `the topic is a lost pet ("${t.match(LOST_PET)[0]}")`);
  if (CURFEW.test(t)) add("curfew_monster", 5, `the topic sets a time rule ("${t.match(CURFEW)[0]}")`);
  if (ON_CREATURE.test(t)) add("creature_town_attack", 4, `the town is ${t.match(ON_CREATURE)[0]} a creature`);
  if (RIGGED.test(t)) add("rigged_system", 8, "the topic splits the town into rich and poor");
  if (REVEAL.test(t)) add("giant_reveal", 5, "the topic hides something that is revealed");
  // 2. keywords: topic x3, card x1.5, beats x0.5
  const creature = (ws) => ({ c: hits(ws, STEMS.creature_town_attack.container), th: hits(ws, STEMS.creature_town_attack.threat) });
  const ct = creature(tw), cc = creature(cw);
  if (ct.c.length && ct.th.length) add("creature_town_attack", 6, `a creature-town (${ct.c.join(", ")}) under threat (${ct.th.join(", ")})`);
  else if (ct.c.length || ct.th.length) add("creature_town_attack", 1.5 * (ct.c.length + ct.th.length));
  if (cc.c.length && cc.th.length) add("creature_town_attack", 1.5);
  for (const id of ["curfew_monster", "everyone_except_me", "lost_pet_in_town", "giant_reveal", "rigged_system", "absurd_rule_comedy"]) {
    const h = hits(tw, STEMS[id]);
    if (h.length) add(id, 3 * h.length, `topic words: ${h.join(", ")}`);
    add(id, 1.5 * hits(cw, STEMS[id]).length);
    add(id, 0.5 * Math.min(4, hits(bw, STEMS[id]).length));
  }
  // 3. the card's formula / twist type (how the writer framed it)
  const formulaRecipe = { F1: "everyone_except_me", F2: "curfew_monster", F4: "creature_town_attack" }[card?.formula];
  if (formulaRecipe) add(formulaRecipe, 2, `idea formula ${card.formula}`);
  if (card?.twistType === "T2") add("giant_reveal", 1);
  // 4. beat features: a pet searched for through the town, a monster that comes at night, a reveal in the discovery
  const beat = (part) => (Array.isArray(beats) ? beats.find((b) => b.part === part) : null);
  const until = words(`${beat("until")?.summary ?? ""} ${beat("until")?.shows ?? ""}`);
  const discovery = `${beat("discovery")?.summary ?? ""} ${beat("discovery")?.shows ?? ""}`;
  if (hits(until, stems(["night", "dark", "midnight"])).length && score.curfew_monster > 0) add("curfew_monster", 1, "the trouble comes at night");
  if (REVEAL.test(discovery) && score.giant_reveal > 0) add("giant_reveal", 1, "the discovery is a reveal");

  const ranked = RECIPE_IDS.map((id) => ({ id, score: Number(score[id].toFixed(2)) })).sort((a, b) => b.score - a.score || RECIPE_IDS.indexOf(a.id) - RECIPE_IDS.indexOf(b.id));
  const best = ranked[0];
  if (best.score <= 0 && t.trim()) return { id: "absurd_rule_comedy", name: RECIPES.absurd_rule_comedy.name, reason: `${RECIPES.absurd_rule_comedy.what}: no other recipe fits, so the silly-rule shape`, scores: Object.fromEntries(ranked.map((r) => [r.id, r.score])) };
  if (best.score <= 0) return { id: null, name: "none fits", reason: "no recipe's keywords or features match this story", scores: Object.fromEntries(ranked.map((r) => [r.id, r.score])) };
  const reasons = why[best.id].slice(0, 2);
  return {
    id: best.id, name: RECIPES[best.id].name,
    reason: `${RECIPES[best.id].what}: ${reasons.length ? reasons.join("; ") : "closest keyword match"}${ranked[1].score > 0 ? ` (next: ${ranked[1].id} ${ranked[1].score})` : ""}`,
    scores: Object.fromEntries(ranked.map((r) => [r.id, r.score])),
  };
}
