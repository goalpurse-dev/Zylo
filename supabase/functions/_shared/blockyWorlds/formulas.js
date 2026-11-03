// Blocky Worlds: the idea engine's building blocks, from the study of 19 viral videos (ANALYSIS.md 4.1).
// An idea = one premise formula x one twist type x a mood x a setting. A batch uses different formula/twist pairs.

export const FORMULAS = Object.freeze({
  F1: Object.freeze({
    name: "Everyone has X, except me",
    rule: "Everyone in the place has a visible gift, stat or marker (wings, a number over their head, their own weather). The narrator lacks it or has the worst one.",
    example: "In this world, everyone has a price tag floating over their head, and mine says one cent.",
  }),
  F2: Object.freeze({
    name: "Never do X, or Y comes",
    rule: "A simple, physical curfew-style rule with a creature or force attached. Breaking it has a price everyone has seen.",
    example: "In this town, if you talk above a whisper, the Listener in the water tower hears your name.",
  }),
  F3: Object.freeze({
    name: "Every night we give X to Y",
    rule: "An offering, deal or bargain with something unseen that the whole place keeps up.",
    example: "In this town, every night we give the Fountain Pigeon one loaf of bread, and it promises not to tell anyone's secrets.",
  }),
  F4: Object.freeze({
    name: "Our whole town lives inside Z",
    rule: "The world is a container (a giant animal, a building, a vehicle, a hole, a sky). The container's own quirks are daily life, and later the tools.",
    example: "In this town, we all live inside a giant refrigerator, and every time the door opens we freeze in place.",
  }),
  F5: Object.freeze({
    name: "Everyone gets X when Y happens",
    rule: "A lottery of fate: a power, gift or change arrives at a set moment. The narrator's draw looks useless.",
    example: "In this world, when you sneeze, a tiny copy of you pops out and runs away.",
  }),
  F6: Object.freeze({
    name: "Some are A, the rest of us are B",
    rule: "Two classes of people with a clear, visible line between them. The narrator is a B who breaks the system.",
    example: "In this world, kids with a bike helmet rule the street, and kids without one must walk and bow.",
  }),
});

export const TWISTS = Object.freeze({
  T1: Object.freeze({ name: "The rule is the weapon", rule: "The threat or system is beaten by its own law. The viewer could have guessed it." }),
  T2: Object.freeze({ name: "Hidden truth", rule: "The protector is the monster, the monster is the protector, or the rule means something else than everyone thought." }),
  T3: Object.freeze({ name: "Weakness is the strength", rule: "The thing everyone mocked about the narrator is the only thing that works." }),
  T4: Object.freeze({ name: "Wording loophole", rule: "The exact words of the rule or the deal turn against whoever relied on them." }),
  T5: Object.freeze({ name: "Open-loop sting", rule: "It's won, then the last line reveals it isn't over (a horror ending)." }),
  T6: Object.freeze({ name: "Wholesome inversion", rule: "The rule turns out to be about love, friendship or family all along." }),
});

export const MOODS = Object.freeze({
  horror: Object.freeze({ label: "Spooky", tone: "PG horror: silhouettes, the dark, being taken. Never gore." }),
  wholesome: Object.freeze({ label: "Wholesome", tone: "warm, a lonely kid, family and friendship, a happy cry at the end" }),
  funny: Object.freeze({ label: "Funny", tone: "absurd and deadpan, jokes in every example, a silly happy ending" }),
  epic: Object.freeze({ label: "Epic", tone: "adventure and a big rescue, stakes for the whole town, a heroic ending" }),
});

/** Twist types that suit each mood (a horror story can end on a sting; a wholesome one can't). */
export const MOOD_TWISTS = Object.freeze({
  horror: Object.freeze(["T1", "T2", "T4", "T5"]),
  wholesome: Object.freeze(["T2", "T3", "T6"]),
  funny: Object.freeze(["T1", "T3", "T4", "T6"]),
  epic: Object.freeze(["T1", "T2", "T3", "T4"]),
});

/**
 * Where the story can happen: the sets the blocky kit is planned with (ANALYSIS.md 6.4). The writer picks one or two,
 * so every idea can be built.
 */
export const SETTINGS = Object.freeze([
  "suburb street", "house (bedroom, kitchen, living room)", "school (hallway, cafeteria, classroom, stage)", "woods edge",
  "town square", "farm", "canyon or cliff town", "castle", "underground or cave town", "underwater or submarine",
  "inside something giant (an animal, a store, a tower)", "snowy town",
]);

export const FORMULA_IDS = Object.freeze(Object.keys(FORMULAS));
export const TWIST_IDS = Object.freeze(Object.keys(TWISTS));
export const MOOD_IDS = Object.freeze(Object.keys(MOODS));

/** Every formula x twist pair a mood allows. */
export function pairsFor(mood) {
  const twists = MOOD_TWISTS[mood] ?? TWIST_IDS;
  return FORMULA_IDS.flatMap((f) => twists.map((t) => ({ formula: f, twist: t, mood })));
}

/**
 * The slots of idea batch number `seed`: `count` different formula/twist pairs, with the formulas as spread out as the
 * count allows. mood: one mood, or null for a mix (moods taken in turn). The same seed always gives the same slots.
 */
export function slotsForBatch(seed, count = 6, mood = null) {
  const n = Math.max(0, Math.floor(Number(seed) || 0));
  const moods = mood && MOODS[mood] ? [mood] : MOOD_IDS;
  const out = [], used = new Set();
  for (let i = 0; out.length < count && i < count * 12; i++) {
    const m = moods[(n + i) % moods.length];
    const formula = FORMULA_IDS[(n * 5 + i) % FORMULA_IDS.length];
    const twists = MOOD_TWISTS[m];
    const twist = twists[(n + i + Math.floor(i / FORMULA_IDS.length)) % twists.length];
    const key = `${formula}${twist}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({ formula, twist, mood: m });
  }
  return out;
}
