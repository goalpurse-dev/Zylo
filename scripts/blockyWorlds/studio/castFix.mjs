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
  fixes.push(...fixThingCast(tl, script)); // (the things and the doubled relations below)
  return fixes;
}

// (2026-11-13, the v4 bench script) two more planner slips, fixed the same way:
//   a THING the script names ("a stale bagel ... Pip named it Bagelbert"): cast as a kid -> no longer a person (the
//     director builds it; the checks look for the thing)
//   a RELATION cast twice ("my little sister Pip" -> a cast member "sister" next to "Pip"): the plain "sister" goes,
//     its cuts go to the named one
const THING_RE = /\b(?:named|called)\s+it\s+([A-Z][a-z]+)/g;
const REL = ["sister", "brother", "mom", "mum", "dad", "grandma", "grandpa", "granny", "aunt", "uncle", "cousin", "friend", "neighbor", "neighbour"];
const REL_RE = new RegExp(`\\b(?:my|his|her|our|their)\\s+(?:little\\s+|big\\s+|baby\\s+|older\\s+|younger\\s+|best\\s+)?(${REL.join("|")})\\s*,?\\s+([A-Z][a-z]+)`, "g");
function dropPerson(tl, id, into = null) {
  delete tl.cast[id];
  const vw = tl.visualWorld ?? {};
  if (vw.people) delete vw.people[id];
  if (vw.gender) delete vw.gender[id];
  for (const s of tl.shots ?? []) {
    if (into && (s.actors ?? []).some((a) => a.id === id) && !(s.actors ?? []).some((a) => a.id === into)) s.actors = s.actors.map((a) => (a.id === id ? { ...a, id: into } : a));
    s.actors = (s.actors ?? []).filter((a) => a.id !== id);
    if (s.subject === id) s.subject = into ?? `thing:${id}`;
    if (s.focus === id) s.focus = into && s.actors.some((a) => a.id === into) ? into : s.actors[0]?.id ?? "group";
  }
}
/** -> [{ id, name, what }] (tl changed in place) */
export function fixThingCast(tl, script) {
  const fixes = [], find = (name) => Object.keys(tl.cast ?? {}).find((k) => String(tl.cast[k].name).toLowerCase() === String(name).toLowerCase());
  for (const l of script.lines ?? []) {
    for (const m of String(l.text).matchAll(THING_RE)) { const id = find(m[1]); if (id && id !== "me") { dropPerson(tl, id); fixes.push({ id, name: m[1], what: "a thing the script names, not a person" }); } }
    for (const m of String(l.text).matchAll(REL_RE)) {
      const plain = find(m[1]), named = find(m[2]);
      if (plain && named && plain !== named && plain !== "me") { dropPerson(tl, plain, named); fixes.push({ id: plain, name: m[1], what: `the same person as ${m[2]}` }); }
    }
  }
  return fixes;
}
