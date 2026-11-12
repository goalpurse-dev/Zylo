// STUDIO MODE: a free fix on the base plan (the engine planner's output, never its code): a cast member the script
// itself names as an ANIMAL ("a mouse named Biscuit", "my cat called Pip") becomes that pet, so the checks look for the
// animal, not a person. The planner reads "my dog, Waffles" as a pet but cast "a mouse named Biscuit" as a kid
// (run 2, 2026-11-13): reported to the engine owner; this adapter keeps studio runs honest meanwhile.
const KIT = { mouse: "mouse", hamster: "mouse", rat: "mouse", cat: "cat", kitten: "cat", dog: "dog", puppy: "dog", rabbit: "rabbit", bunny: "rabbit", frog: "frog", pig: "pig", duck: "duck", chicken: "chicken", hen: "chicken", goat: "goat", snake: "snake", turtle: "turtle", parrot: "parrot", cow: "cow" };
const NOUNS = { mouse: ["mouse", "mice", "hamster", "rat"], cat: ["cat", "kitten", "kitty"], dog: ["dog", "puppy", "pup"], rabbit: ["rabbit", "bunny"] };
const RE = new RegExp(`\\b(?:a|an|my|his|her|our|their)\\s+(?:little\\s+|tiny\\s+|pet\\s+|old\\s+)?(${Object.keys(KIT).join("|")})\\s+(?:named|called)\\s+([A-Z][a-z]+)`, "g");

/** -> the list of fixes made ([{ id, name, species }]); tl is changed in place */
export function fixAnimalCast(tl, script) {
  const fixes = [];
  for (const l of script.lines ?? []) for (const m of String(l.text).matchAll(RE)) {
    const species = KIT[m[1].toLowerCase()], name = m[2];
    const id = Object.keys(tl.cast ?? {}).find((k) => String(tl.cast[k].name).toLowerCase() === name.toLowerCase());
    if (!id || tl.pets?.[id]) continue;
    delete tl.cast[id];
    const vw = tl.visualWorld ?? {};
    if (vw.people) delete vw.people[id];
    if (vw.gender) delete vw.gender[id];
    const pet = { id, name, words: [name.toLowerCase()], nouns: NOUNS[species] ?? [species], kit: species, species };
    vw.pets = { ...(vw.pets ?? {}), [id]: pet };
    tl.pets = { ...(tl.pets ?? {}), [id]: { ...pet, sizeM: species === "mouse" ? 0.2 : 0.5, params: {}, look: String(l.text), seed: 7 } };
    for (const s of tl.shots ?? []) { s.actors = (s.actors ?? []).filter((a) => a.id !== id); if (s.subject === id) s.subject = `thing:${id}`; if (s.focus === id) s.focus = s.actors[0]?.id ?? "group"; }
    fixes.push({ id, name, species });
  }
  return fixes;
}
