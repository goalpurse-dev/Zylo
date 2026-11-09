// Blocky Worlds OUTFITS: the data (CHARACTERS-V2, 2026-11-09; owner: "layered outfits per role/era (knight, king,
// scientist, caveman, baker, mail carrier, mayor, farmer, kid casual, grandma, villain...), with accessories (crowns,
// hats, glasses, tool belts, necklaces). Each named character gets a distinct outfit from its role in the world bible").
// PURE (no three.js): lib/worldBible.js picks outfits in Node; page/kit/outfits.js builds them.
//
//   OUTFITS                         { id: { label, ages, eras, words, base, colors, parts, head, glasses, variants? } }
//   ERAS                            "modern" | "medieval" | "stoneage" | "pirate" | "western" | "future"
//   eraOf(text) -> era              the story's era from its words
//   outfitFor({ job, name, id, look, role, age, gender }, era, seed) -> outfit id   (role words first, then the age)
//   outfitLook(id, { seed, age, gender, variant }) -> look fields people.js lookFor takes (top, pants, ..., outfit,
//                                    oc: { a, b, c, d } the outfit's colours, parts[], ohead, glasses)
//   OUTFIT_WORDS                    the words that name each outfit (for the vision judge's text)
// A colour in base / parts / head is a slot ("a" main, "b" second, "c" trim / metal, "d" extra) or a hex.
import { rng, hashSeed } from "../../lib/rng.js";

export const ERAS = Object.freeze(["modern", "medieval", "stoneage", "pirate", "western", "future"]);
const ERA_WORDS = [
  ["stoneage", /\b(cave ?m[ae]n|cave ?wom[ae]n|cave ?(kid|boy|girl|people|family)|stone age|prehistoric|dinosaurs?|mammoths?|tribe)\b/],
  ["pirate", /\b(pirates?|treasure map|pirate ship|buccaneers?|ahoy)\b/],
  ["western", /\b(cowboys?|cowgirls?|wild west|saloon|ranch|sheriff|outlaws?|lasso)\b/],
  ["future", /\b(spaceships?|space station|astronauts?|robots?|the future|futuristic|planets?|aliens?|rocket)\b/],
  ["medieval", /\b(knights?|kings?|queens?|princes?|princess(es)?|castles?|kingdom|dragons?|medieval|squires?|wizards?|witch(es)?|village|realm|throne|jester|peasants?)\b/],
];
/** the story's era from its words (the strongest era named most; modern when none) */
export function eraOf(text = "") {
  const t = ` ${String(text).toLowerCase()} `;
  let best = "modern", n = 0;
  for (const [era, re] of ERA_WORDS) { const k = (t.match(new RegExp(re.source, "g")) ?? []).length; if (k > n) { n = k; best = era; } }
  return best;
}

const P = (part, color = "a", o = {}) => ({ part, color, ...o });
// garment colours: rich, saturated, picked per character by its seed (two bakers differ)
const C = {
  red: ["#d63031", "#c0392b", "#e74c3c", "#b71c1c"], blue: ["#2e86de", "#273c75", "#0984e3", "#3867d6"], green: ["#20bf6b", "#2e9e4f", "#00b894", "#3c8d2f"],
  purple: ["#8854d0", "#6c5ce7", "#8e44ad"], gold: ["#f2c511", "#d4a017", "#e1b12c"], brown: ["#7b4a2a", "#8a5a32", "#6d4c41", "#a0522d"], white: ["#f5f5f0", "#ffffff", "#f2efe6"],
  black: ["#2d3436", "#1e272e", "#2b2b33"], tan: ["#c8a96a", "#d4b483", "#b8955a"], khaki: ["#b5a165", "#a89a5b", "#c2ae74"], navy: ["#273c75", "#1e3a6e", "#2c3e70"],
  pastel: ["#ffb3c7", "#a5d8ff", "#b9fbc0", "#ffe29a", "#d0bfff", "#ffc9a3"], bright: ["#ff7a1a", "#ffd32a", "#ff3b6b", "#2e86de", "#20bf6b", "#8854d0", "#0fb9b1", "#eb3b5a", "#fa8231"],
  denim: ["#2f4f86", "#3b5b8f", "#4b6584"], grey: ["#7f8c8d", "#95a5a6", "#636e72"], silver: ["#c8ced4", "#b2bec3", "#d5dbe0"], teal: ["#0fb9b1", "#00a8a8", "#16a085"],
  orange: ["#e67e22", "#f39c12", "#ff7a1a"], pink: ["#fd79a8", "#ff6fb5", "#e84393"], cream: ["#f5ecd7", "#efe3c8", "#f7f1e1"], fur: ["#8a5a32", "#a0703f", "#6b4a2b", "#c49a6c"],
};

/**
 * Parts (page/kit/outfits.js PART_BUILD): vest, jacket, coatLong, labcoat, apron, robe, cape, armor, tunic, pelt, overalls,
 * hivis, cardigan, hoodie, overshirt, sash, shawl, scarf, neckerchief, bowtie, collar, pearls, bones, medal, whistle,
 * stethoscope, belt, toolbelt, satchel, badge, pockets, buttons, gloves, boots, stripes, patches, epaulettes, pack,
 * pen, flour, stars, chain, lanyard. Head kinds (HEAD_BUILD): crown, tiara, tophat, chefhat, bakerhat, helmetKnight,
 * hardhat, fireHelmet, peakedCap, strawhat, cowboy, tricorn, wizard, beret, flatcap, sunhat, headscarf, pirateBandana,
 * vikingHelmet, safari, sailorCap, nurseCap, bone, bow, goggles, cap, beanie.
 */
export const OUTFITS = {
  royal: {
    label: "royal robes", ages: ["adult", "elder", "kid"], eras: ["medieval", "modern"], words: "king|queen|prince|princess|emperor|empress|royal|monarch|majesty|duke|duchess",
    base: { top: "a", pattern: "velvet", sleeve: "long", bottom: "pants", pants: "#3a2a4a", shoes: "#5a3b24" },
    colors: { a: [...C.red, ...C.purple, "#1e3a6e"], b: C.gold, c: C.gold, d: C.white },
    parts: [P("cape", "a", { trim: "ermine", collar: true }), P("chain", "c"), P("belt", "c"), P("buttons", "c")],
    head: { kind: "crown", color: "c" }, femaleHead: { kind: "tiara", color: "c" }, femaleBase: { bottom: "dress" },
  },
  knight: {
    label: "knight's armour", ages: ["adult", "kid", "elder"], eras: ["medieval"], words: "knight|squire|warrior|paladin|soldier|guard|guards|crusader",
    base: { top: "#9aa3ab", pattern: "chainmail", sleeve: "long", bottom: "pants", pants: "#7d868e", pantsKind: "chainmail", shoes: "#5d6d7e" },
    colors: { a: [...C.red, ...C.blue, ...C.green], b: C.silver, c: C.gold, d: C.white },
    parts: [P("armor", "b"), P("tabard", "a", { emblem: "c" }), P("belt", "#5a3b24"), P("gloves", "b"), P("boots", "b")],
    head: { kind: "helmetKnight", color: "b", plume: "a" },
  },
  scientist: {
    label: "lab coat", ages: ["adult", "elder", "kid"], eras: ["modern", "future"], words: "scientist|professor|inventor|chemist|researcher|genius|lab|laboratory|physicist|biologist",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", shoes: "#3d2b1f" },
    colors: { a: [...C.teal, ...C.blue, "#8854d0"], b: [...C.black, ...C.grey], c: C.white, d: ["#ffd32a", "#ff7a1a"] },
    parts: [P("labcoat", "c"), P("pen", "d"), P("bowtie", "d")],
    head: { kind: "goggles", color: "d" }, glasses: "round",
  },
  doctor: {
    label: "doctor's coat", ages: ["adult", "elder"], eras: ["modern", "future"], words: "doctor|nurse|vet|veterinarian|dentist|surgeon|medic|paramedic|dr",
    base: { top: "a", pattern: "cotton", sleeve: "short", bottom: "pants", pants: "a", shoes: "#ffffff" },
    colors: { a: ["#2bb3a8", "#4a90d9", "#6ab04c", "#9b59b6"], b: C.white, c: C.silver, d: C.white },
    parts: [P("labcoat", "b"), P("stethoscope", "#2d3436"), P("badge", "#ffffff")],
    head: null,
  },
  caveman: {
    label: "cave clothes", ages: ["adult", "kid", "elder"], eras: ["stoneage"], words: "caveman|cavemen|cavewoman|cavewomen|cavekid|caveboy|cavegirl|cave|tribe|hunter|stone age",
    base: { top: "skin", pattern: "cotton", sleeve: "short", bottom: "shorts", pants: "a", pantsKind: "fur", shoes: "skin", hair: "spiky" },
    colors: { a: C.fur, b: ["#e9e2cf", "#f2ead6"], c: ["#5a3b24", "#6b4a2b"], d: C.fur },
    parts: [P("pelt", "a"), P("bones", "b"), P("belt", "c", { rope: true })],
    head: { kind: "bone", color: "b" },
  },
  baker: {
    label: "baker's whites", ages: ["adult", "elder"], eras: ["modern", "medieval", "western"], words: "baker|bakers|bakery|pastry|patissier|cake maker|bread maker",
    base: { top: "a", pattern: "cotton", sleeve: "short", bottom: "pants", pants: "b", pantsKind: "check", shoes: "#3d2b1f" },
    colors: { a: C.white, b: ["#2d3436", "#4b6584", "#7b4a2a"], c: [...C.pastel, "#e84a5f"], d: C.white },
    parts: [P("apron", "c", { pocket: true, flour: true }), P("neckerchief", "c"), P("buttons", "#d8d8d8")],
    head: { kind: "bakerhat", color: "d" },
  },
  chef: {
    label: "chef's jacket", ages: ["adult", "elder"], eras: ["modern", "future"], words: "chef|chefs|cook|cooks|kitchen|cafeteria|lunch lady|diner",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", pantsKind: "check", shoes: "#2d3436" },
    colors: { a: C.white, b: C.black, c: [...C.red, ...C.blue], d: C.white },
    parts: [P("buttons", "#2d3436", { double: true }), P("neckerchief", "c"), P("apron", "d", { half: true })],
    head: { kind: "chefhat", color: "d" },
  },
  mail: {
    label: "mail carrier's uniform", ages: ["adult", "elder"], eras: ["modern", "western"], words: "mail|mailman|mailwoman|postman|postwoman|postie|mail carrier|postal|courier|delivery|letters",
    base: { top: "a", pattern: "cotton", sleeve: "short", bottom: "shorts", pants: "b", shoes: "#2d3436" },
    colors: { a: ["#4a90d9", "#5b8cc4", "#6fa8dc"], b: C.navy, c: ["#c0392b", "#e74c3c"], d: ["#8a5a32", "#7b4a2a"] },
    parts: [P("satchel", "d", { letter: true }), P("badge", "c"), P("pockets", "a"), P("stripes", "c", { where: "sleeve" })],
    head: { kind: "peakedCap", color: "b", badge: "c" },
  },
  mayor: {
    label: "mayor's suit and sash", ages: ["adult", "elder"], eras: ["modern", "western"], words: "mayor|mayors|governor|president|councillor|councilman|councilwoman|boss|ceo|banker|tycoon|rich",
    base: { top: "#f5f5f0", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "a", shoes: "#1e1e1e" },
    colors: { a: [...C.navy, "#2d3436", "#5d2a6e"], b: [...C.red, "#8e44ad"], c: C.gold, d: C.white },
    parts: [P("jacket", "a"), P("sash", "b"), P("medal", "c"), P("bowtie", "b")],
    head: { kind: "tophat", color: "a", band: "b" }, femaleHead: null,
  },
  farmer: {
    label: "farmer's overalls", ages: ["adult", "elder", "kid"], eras: ["modern", "western", "medieval"], words: "farmer|farmers|farm|rancher|shepherd|shepherdess|milkmaid|harvest|crops|barn",
    base: { top: "a", pattern: "plaid", sleeve: "long", bottom: "pants", pants: "b", pantsKind: "denim", shoes: "#5a3b24" },
    colors: { a: [...C.red, ...C.green, "#e67e22"], b: C.denim, c: C.gold, d: C.tan },
    parts: [P("overalls", "b"), P("neckerchief", "a"), P("boots", "#5a3b24")],
    head: { kind: "strawhat", color: "d", band: "a" },
  },
  grandma: {
    label: "cardigan and pearls", ages: ["elder", "adult"], eras: ["modern", "medieval", "western", "pirate", "future"], words: "grandma|granny|gran|nana|grandmother|old lady|old woman|nan",
    base: { top: "#f5ecd7", pattern: "cotton", sleeve: "long", bottom: "dress", pants: "a", shoes: "#6d4c41", hair: "bun" },
    colors: { a: [...C.pastel, "#b5838d", "#8e7cc3", "#d4a373"], b: [...C.purple, "#b5838d", "#4a6fa5"], c: C.white, d: C.pastel },
    parts: [P("cardigan", "b", { buttons: true }), P("pearls", "c"), P("shawl", "d", { knit: true })],
    head: null, glasses: "half",
  },
  grandpa: {
    label: "vest and bow tie", ages: ["elder", "adult"], eras: ["modern", "medieval", "western", "pirate", "future"], words: "grandpa|grandad|granddad|grandfather|old man|gramps",
    base: { top: "#f5f5f0", pattern: "pinstripe", sleeve: "long", bottom: "pants", pants: "a", shoes: "#3d2b1f" },
    colors: { a: ["#6d4c41", "#57606f", "#4b6584", "#7f8c8d"], b: ["#a0522d", "#6d8a5a", "#8e7cc3", "#c8a96a"], c: [...C.red, "#2e86de"], d: ["#6d4c41", "#57606f"] },
    parts: [P("vest", "b", { tweed: true }), P("bowtie", "c"), P("buttons", "#3d2b1f")],
    head: { kind: "flatcap", color: "d" }, glasses: "square",
  },
  villain: {
    label: "villain's cape", ages: ["adult", "elder", "kid"], eras: ["modern", "medieval", "western", "pirate", "future"], words: "villain|villains|evil|baddie|bad guy|thief|thieves|robber|crook|bandit|baron|tyrant|mastermind|outlaw",
    base: { top: "#2b2b33", pattern: "pinstripe", sleeve: "long", bottom: "pants", pants: "#1e1e24", shoes: "#111111" },
    colors: { a: ["#1e1e24", "#2b1a33", "#1b2631"], b: ["#b71c1c", "#6a1b9a", "#1b5e20"], c: ["#c0c0c0", "#d4a017"], d: ["#b71c1c", "#6a1b9a"] },
    parts: [P("cape", "a", { lining: "b", collar: true, tall: true }), P("gloves", "b"), P("medal", "c"), P("belt", "c")],
    head: { kind: "tophat", color: "a", band: "b" },
  },
  wizard: {
    label: "wizard's robe", ages: ["elder", "adult", "kid"], eras: ["medieval", "modern"], words: "wizard|wizards|witch|witches|sorcerer|sorceress|magician|mage|warlock|enchanter|fairy godmother",
    base: { top: "a", pattern: "stars", sleeve: "long", bottom: "dress", pants: "a", shoes: "#5a3b24" },
    colors: { a: [...C.purple, "#1e3a6e", "#2e9e4f"], b: C.gold, c: C.gold, d: ["#f5f5f0"] },
    parts: [P("robe", "a", { stars: "b" }), P("belt", "c", { rope: true }), P("sash", "c", { thin: true })],
    head: { kind: "wizard", color: "a", band: "b" },
  },
  teacher: {
    label: "cardigan and glasses", ages: ["adult", "elder"], eras: ["modern", "future"], words: "teacher|teachers|principal|headmaster|headmistress|librarian|tutor|professor of|coach teacher",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", shoes: "#5a3b24" },
    colors: { a: ["#f5ecd7", "#a5d8ff", "#ffe29a", "#d0bfff"], b: ["#57606f", "#6d4c41", "#2f4f86"], c: [...C.red, "#20bf6b", "#8854d0"], d: ["#c8a96a"] },
    parts: [P("cardigan", "c", { buttons: true, patches: true }), P("lanyard", "c"), P("pen", "#2d3436")],
    head: null, glasses: "square",
  },
  firefighter: {
    label: "firefighter's gear", ages: ["adult", "kid"], eras: ["modern", "future"], words: "firefighter|firefighters|fireman|firemen|firewoman|fire chief|fire brigade|fire crew",
    base: { top: "a", pattern: "canvas", sleeve: "long", bottom: "pants", pants: "a", pantsKind: "canvas", shoes: "#1e1e1e" },
    colors: { a: ["#c8a050", "#b8903f", "#d4a85a"], b: ["#d63031", "#c0392b"], c: ["#e8f05a", "#dfe64b"], d: C.silver },
    parts: [P("stripes", "c", { where: "all" }), P("buttons", "#1e1e1e", { clasps: true }), P("boots", "#1e1e1e"), P("gloves", "#2d3436")],
    head: { kind: "fireHelmet", color: "b", badge: "c" },
  },
  police: {
    label: "police uniform", ages: ["adult"], eras: ["modern", "future"], words: "police|policeman|policewoman|officer|cop|cops|detective|security guard|constable",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", shoes: "#1e1e1e" },
    colors: { a: ["#2c3e70", "#34495e", "#4a6fa5"], b: C.navy, c: C.gold, d: C.silver },
    parts: [P("badge", "c", { star: true }), P("pockets", "a"), P("belt", "#1e1e1e", { pouches: true }), P("epaulettes", "b")],
    head: { kind: "peakedCap", color: "b", badge: "c" },
  },
  pirate: {
    label: "pirate's coat", ages: ["adult", "kid", "elder"], eras: ["pirate"], words: "pirate|pirates|buccaneer|pirate captain|first mate|deckhand",
    base: { top: "#f5f5f0", pattern: "stripes", sleeve: "long", bottom: "pants", pants: "b", shoes: "#2d1f14" },
    colors: { a: [...C.red, "#1e3a6e", "#2d3436"], b: ["#2d3436", "#4b3621", "#273c75"], c: C.gold, d: [...C.red, "#2e86de"] },
    parts: [P("coatLong", "a", { trim: "c" }), P("sash", "d", { waist: true }), P("belt", "#2d1f14"), P("boots", "#2d1f14")],
    head: { kind: "tricorn", color: "b", trim: "c" }, kidHead: { kind: "pirateBandana", color: "d" },
  },
  explorer: {
    label: "explorer's khakis", ages: ["adult", "kid", "elder"], eras: ["modern", "western", "future"], words: "explorer|explorers|adventurer|archaeologist|hiker|ranger|park ranger|scout|zookeeper|naturalist|treasure hunter",
    base: { top: "a", pattern: "canvas", sleeve: "short", bottom: "shorts", pants: "b", shoes: "#5a3b24" },
    colors: { a: C.khaki, b: ["#8a7a52", "#6b5a3a", "#a89a5b"], c: ["#5a3b24", "#7b4a2a"], d: ["#2e9e4f", "#e67e22"] },
    parts: [P("pockets", "a", { flaps: true }), P("satchel", "c"), P("neckerchief", "d"), P("boots", "#5a3b24"), P("belt", "c")],
    head: { kind: "safari", color: "a", band: "c" },
  },
  builder: {
    label: "builder's hi-vis and tool belt", ages: ["adult", "kid"], eras: ["modern", "future"], words: "builder|builders|construction|plumber|carpenter|engineer|mechanic|handyman|electrician|worker|workers|repairman|janitor",
    base: { top: "a", pattern: "plaid", sleeve: "short", bottom: "pants", pants: "b", pantsKind: "denim", shoes: "#8a5a32" },
    colors: { a: [...C.red, ...C.blue, "#7f8c8d"], b: C.denim, c: ["#ff9f1a", "#e8f05a"], d: ["#ffd32a", "#ff9f1a"] },
    parts: [P("hivis", "c"), P("toolbelt", "#8a5a32"), P("boots", "#8a5a32"), P("gloves", "#c8a96a")],
    head: { kind: "hardhat", color: "d" },
  },
  shopkeeper: {
    label: "shopkeeper's apron", ages: ["adult", "elder"], eras: ["modern", "western", "medieval"], words: "shopkeeper|shop owner|store owner|grocer|clerk|cashier|waiter|waitress|butcher|florist|toymaker|candy maker|market seller|merchant",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", shoes: "#3d2b1f" },
    colors: { a: [...C.white, "#a5d8ff", "#ffe29a"], b: ["#57606f", "#2d3436", "#6d4c41"], c: ["#2e9e4f", "#c0392b", "#2e86de"], d: C.white },
    parts: [P("apron", "c", { stripes: true, pocket: true }), P("bowtie", "c"), P("pen", "#2d3436")],
    head: { kind: "cap", color: "c" },
  },
  fisher: {
    label: "fisher's raincoat", ages: ["adult", "elder", "kid"], eras: ["modern", "pirate", "western"], words: "fisherman|fishermen|fisher|fisherwoman|fishmonger|lighthouse keeper|sailor|sailors|boatman|harbour master|harbor master",
    base: { top: "a", pattern: "canvas", sleeve: "long", bottom: "pants", pants: "a", pantsKind: "canvas", shoes: "#2d3436" },
    colors: { a: ["#ffd32a", "#f7b731", "#ff9f1a"], b: ["#2d3436", "#273c75"], c: C.white, d: ["#ffd32a", "#f7b731"] },
    parts: [P("buttons", "#2d3436", { clasps: true }), P("boots", "#2d3436"), P("scarf", "b", { knit: true })],
    head: { kind: "sunhat", color: "d", fisher: true },
  },
  astronaut: {
    label: "space suit", ages: ["adult", "kid"], eras: ["future", "modern"], words: "astronaut|astronauts|spaceman|spacewoman|cosmonaut|pilot|space captain|rocket pilot",
    base: { top: "a", pattern: "canvas", sleeve: "long", bottom: "pants", pants: "a", pantsKind: "canvas", shoes: "#d8d8d8" },
    colors: { a: ["#f2f2f2", "#e8ecf0"], b: ["#ff7a1a", "#2e86de", "#d63031"], c: C.silver, d: ["#2e86de", "#d63031"] },
    parts: [P("patches", "b"), P("pack", "a"), P("gloves", "c"), P("boots", "c"), P("belt", "c", { pouches: true }), P("collar", "c", { ring: true })],
    head: null,
  },
  cowboy: {
    label: "cowboy's vest and hat", ages: ["adult", "kid", "elder"], eras: ["western"], words: "cowboy|cowboys|cowgirl|cowgirls|sheriff|deputy|ranch hand|wrangler|rodeo",
    base: { top: "a", pattern: "plaid", sleeve: "long", bottom: "pants", pants: "b", pantsKind: "denim", shoes: "#6b4a2b" },
    colors: { a: [...C.red, ...C.blue, "#f5ecd7"], b: C.denim, c: ["#8a5a32", "#6b4a2b", "#2d3436"], d: [...C.red, "#2e86de"] },
    parts: [P("vest", "c", { leather: true }), P("neckerchief", "d"), P("belt", "#5a3b24", { buckle: "#d4a017" }), P("boots", "#6b4a2b"), P("badge", "#d4a017", { star: true, sheriff: true })],
    head: { kind: "cowboy", color: "c" },
  },
  viking: {
    label: "viking furs", ages: ["adult", "kid", "elder"], eras: ["medieval"], words: "viking|vikings|norse|shieldmaiden|warlord|chieftain",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", shoes: "#5a3b24" },
    colors: { a: [...C.red, ...C.blue, "#6d8a5a"], b: ["#6b4a2b", "#57606f"], c: C.silver, d: C.fur },
    parts: [P("pelt", "d", { shoulders: true }), P("belt", "#5a3b24", { buckle: "#c8ced4" }), P("boots", "#6b4a2b"), P("chain", "c")],
    head: { kind: "vikingHelmet", color: "c" },
  },
  artist: {
    label: "painter's smock and beret", ages: ["adult", "elder", "kid"], eras: ["modern", "medieval"], words: "artist|artists|painter|painters|sculptor|designer|musician|singer|poet",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", shoes: "#2d3436" },
    colors: { a: [...C.white, "#f5ecd7"], b: ["#2d3436", "#273c75"], c: [...C.red, "#8854d0", "#2e86de"], d: C.bright },
    parts: [P("apron", "a", { paint: true, long: true }), P("scarf", "c")],
    head: { kind: "beret", color: "c" },
  },
  athlete: {
    label: "tracksuit and whistle", ages: ["adult", "kid"], eras: ["modern", "future"], words: "coach|athlete|runner|player|players|footballer|referee|gym teacher|sports|team captain|champion",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "a", shoes: "#ffffff" },
    colors: { a: [...C.red, ...C.blue, ...C.green, "#8854d0"], b: C.white, c: C.silver, d: C.white },
    parts: [P("stripes", "b", { where: "all", sport: true }), P("whistle", "c"), P("collar", "b", { zip: true })],
    head: { kind: "cap", color: "a" },
  },
  gardener: {
    label: "gardener's apron and sun hat", ages: ["adult", "elder"], eras: ["modern", "medieval", "western"], words: "gardener|gardeners|florist|beekeeper|botanist|groundskeeper",
    base: { top: "a", pattern: "plaid", sleeve: "short", bottom: "pants", pants: "b", shoes: "#6d4c41" },
    colors: { a: [...C.pastel, "#badc58"], b: ["#6d4c41", "#57606f", "#2f4f86"], c: ["#2e9e4f", "#3c8d2f"], d: C.tan },
    parts: [P("apron", "c", { pocket: true }), P("gloves", "#e1c699"), P("boots", "#2e9e4f")],
    head: { kind: "sunhat", color: "d", band: "c" },
  },
  peasant: {
    label: "village tunic", ages: ["adult", "kid", "elder"], eras: ["medieval"], words: "peasant|peasants|villager|villagers|miller|blacksmith|innkeeper|stable boy|maid|servant|jester|monk|nun|townsfolk",
    base: { top: "a", pattern: "linen", sleeve: "long", bottom: "pants", pants: "b", shoes: "#5a3b24" },
    colors: { a: ["#a0522d", "#6d8a5a", "#c8a96a", "#8e7cc3", "#b5838d", "#4a6fa5"], b: ["#6b4a2b", "#57606f", "#7b4a2a"], c: ["#5a3b24"], d: C.cream },
    parts: [P("tunic", "a"), P("belt", "c", { rope: true }), P("collar", "d", { lace: true })],
    head: null, kidHead: null,
  },
  kid_casual: {
    label: "kid's casual clothes", ages: ["kid"], eras: ["modern", "future", "western"], words: "kid|kids|boy|girl|child|student|classmate|friend|cousin|sister|brother",
    base: { top: "a", pattern: "cotton", sleeve: "short", bottom: "shorts", pants: "b", shoes: "d" },
    colors: { a: C.bright, b: [...C.denim, "#2d3436", "#c8a96a"], c: C.bright, d: ["#ffffff", "#ff3b5c", "#3742fa", "#00d2d3", "#f9ca24"] },
    parts: [],
    variants: [
      { id: "hoodie", base: { sleeve: "long", bottom: "pants", pantsKind: "denim" }, parts: [P("hoodie", "a")], head: null },
      { id: "overshirt", base: { pattern: "band" }, parts: [P("overshirt", "c", { plaid: true })], head: { kind: "cap", color: "c" } },
      { id: "sporty", base: { sleeve: "long", bottom: "pants", pants: "a" }, parts: [P("stripes", "#ffffff", { where: "all", sport: true }), P("collar", "#ffffff", { zip: true })], head: null },
      { id: "overalls", base: { pattern: "stripes" }, parts: [P("overalls", "b", { short: true })], head: { kind: "beanie", color: "c" } },
      { id: "dress", gender: "f", base: { bottom: "dress", pattern: "dots" }, parts: [P("collar", "#ffffff", { round: true })], head: { kind: "bow", color: "c" } },
    ],
  },
  adult_casual: {
    label: "casual clothes", ages: ["adult"], eras: ["modern", "future", "western"], words: "mom|mum|mother|dad|father|parent|neighbour|neighbor|man|woman|lady|guy|person|townsperson|aunt|uncle",
    base: { top: "a", pattern: "cotton", sleeve: "long", bottom: "pants", pants: "b", pantsKind: "denim", shoes: "d" },
    colors: { a: C.bright, b: [...C.denim, "#2d3436", "#c8a96a", "#6d4c41"], c: [...C.brown, ...C.navy, "#2e9e4f", "#7f8c8d"], d: ["#3d2b1f", "#1e1e1e", "#ffffff", "#8a5a32"] },
    parts: [],
    variants: [
      { id: "jacket", parts: [P("jacket", "c", { open: true, casual: true })], head: null },
      { id: "sweater", base: { pattern: "knit" }, parts: [P("collar", "#ffffff", {})], head: null },
      { id: "shirt", base: { pattern: "plaid", sleeve: "short" }, parts: [P("pockets", "a")], head: { kind: "cap", color: "c" } },
      { id: "dress", gender: "f", base: { bottom: "dress", pattern: "dots" }, parts: [P("cardigan", "c", { buttons: true })], head: null },
      { id: "vest", parts: [P("vest", "c", { puffer: true })], head: { kind: "beanie", color: "c" } },
    ],
  },
};

/** the words that name an outfit (role words), for the picker and the vision judge */
export const OUTFIT_WORDS = Object.freeze(Object.fromEntries(Object.entries(OUTFITS).map(([id, o]) => [id, o.words])));
const WORD_RE = Object.fromEntries(Object.entries(OUTFITS).map(([id, o]) => [id, new RegExp(`\\b(${o.words})\\b`)]));
// the role words that mean something else per era (a "guard" in a castle is a knight, in a modern town the police)
const ERA_SWAP = {
  medieval: { police: "knight", mail: "peasant", builder: "peasant", shopkeeper: "peasant", scientist: "wizard", doctor: "peasant", athlete: "knight", kid_casual: "peasant", adult_casual: "peasant", mayor: "royal", firefighter: "peasant", astronaut: "peasant", explorer: "peasant", chef: "baker" },
  stoneage: Object.fromEntries(Object.keys(OUTFITS).map((k) => [k, "caveman"])),
  pirate: { police: "pirate", kid_casual: "pirate", adult_casual: "pirate", explorer: "pirate", knight: "pirate", mayor: "pirate" },
  western: { police: "cowboy", kid_casual: "cowboy", adult_casual: "cowboy", knight: "cowboy" },
  future: { kid_casual: "astronaut", adult_casual: "astronaut", knight: "astronaut", pirate: "astronaut" },
  modern: { knight: "police", peasant: "adult_casual", caveman: "caveman" },
};
const PRIORITY = ["royal", "knight", "wizard", "villain", "caveman", "viking", "pirate", "astronaut", "cowboy", "firefighter", "police", "doctor", "scientist", "chef", "baker", "mail", "mayor", "farmer", "teacher", "builder", "explorer", "fisher", "artist", "athlete", "gardener", "shopkeeper", "grandma", "grandpa", "peasant"];

/**
 * The outfit for a cast member: its job, then its name / id, then the director's look words name a role ("Baker Bo",
 * "mrs_pell" with job "mail carrier"); the era swaps a role word that does not fit it (a castle's guard is a knight);
 * else by age (+ gender): a kid's / adult's casual clothes in the era, grandma / grandpa for an elder.
 */
export function outfitFor(c = {}, era = "modern", seed = 0) {
  const age = c.age ?? (c.role === "kid" || c.role === "narrator" ? "kid" : c.role === "elder" ? "elder" : "adult");
  const gender = c.gender ?? null;
  const fields = [c.job, `${c.name ?? ""} ${String(c.id ?? "").replace(/_/g, " ")}`, c.look].map((x) => ` ${String(x ?? "").toLowerCase()} `);
  let id = null;
  for (const f of fields) { id = PRIORITY.find((k) => WORD_RE[k].test(f)) ?? null; if (id) break; }
  // an elder named "Grandma"/"Granny" is grandma even when her look words say "baker": a job wins (fields order)
  if (!id) id = age === "kid" ? "kid_casual" : age === "elder" ? (gender === "m" ? "grandpa" : gender === "f" ? "grandma" : (seed % 2 ? "grandpa" : "grandma")) : "adult_casual";
  if (id === "grandma" && gender === "m") id = "grandpa";
  if (id === "grandpa" && gender === "f") id = "grandma";
  const swap = ERA_SWAP[era]?.[id];
  if (swap && !(era === "medieval" && ["grandma", "grandpa"].includes(id))) id = swap;
  // an outfit made for other ages falls back to the age's casual clothes of the era (a kid "mayor" keeps the role: kids may dress up)
  return id;
}

const pickC = (R, list) => list[Math.floor(R() * list.length)];
/**
 * The look fields for an outfit (people.js lookFor overrides): the garments with the outfit's colours (seeded per
 * character), the parts list, the head piece, glasses. variant: a variant id (else seeded; a "dress" variant only for f).
 */
export function outfitLook(id, { seed = 1, age = "adult", gender = null, variant = null } = {}) {
  const O = OUTFITS[id] ?? OUTFITS.adult_casual;
  const R = rng((Number(seed) || 1) * 48271 + hashSeed(id));
  const oc = { a: pickC(R, O.colors.a), b: pickC(R, O.colors.b), c: pickC(R, O.colors.c), d: pickC(R, O.colors.d) };
  if (oc.b === oc.a) oc.b = O.colors.b[(O.colors.b.indexOf(oc.b) + 1) % O.colors.b.length];
  if (oc.c === oc.a && O.colors.c.length > 1) oc.c = O.colors.c[(O.colors.c.indexOf(oc.c) + 1) % O.colors.c.length];
  let base = { ...O.base }, parts = [...O.parts], head = O.head ?? null, vid = null;
  if (O.variants?.length) {
    const ok = O.variants.filter((v) => !v.gender || v.gender === gender);
    const v = ok.find((x) => x.id === variant) ?? ok[Math.floor(R() * ok.length)];
    vid = v.id; base = { ...base, ...(v.base ?? {}) }; parts = [...parts, ...(v.parts ?? [])]; head = v.head === undefined ? head : v.head;
  }
  if (gender === "f" && O.femaleBase) base = { ...base, ...O.femaleBase };
  if (gender === "f" && O.femaleHead !== undefined) head = O.femaleHead;
  if (age === "kid" && O.kidHead !== undefined) head = O.kidHead;
  const col = (v) => (v == null ? v : v === "skin" ? "skin" : /^[abcd]$/.test(v) ? oc[v] : v);
  const look = {
    outfit: id, outfitVariant: vid, oc,
    top: col(base.top), pattern: base.pattern ?? "cotton", sleeve: base.sleeve ?? "long", bottom: base.bottom ?? "pants",
    pants: col(base.pants), pantsKind: base.pantsKind ?? (base.bottom === "shorts" ? "cotton" : "denim"), shoes: col(base.shoes) ?? "#3d2b1f",
    parts: parts.map((p) => ({ ...p, color: col(p.color), ...(p.emblem ? { emblem: col(p.emblem) } : {}), ...(p.lining ? { lining: col(p.lining) } : {}), ...(p.stars ? { stars: col(p.stars) } : {}), ...(p.trim && p.trim !== "ermine" ? { trim: col(p.trim) } : {}) })),
    ohead: head ? { ...head, color: col(head.color), ...(head.band ? { band: col(head.band) } : {}), ...(head.plume ? { plume: col(head.plume) } : {}), ...(head.badge ? { badge: col(head.badge) } : {}), ...(head.trim ? { trim: col(head.trim) } : {}) } : null,
    hat: null, acc: [],
  };
  if (look.bottom === "dress") look.pants = look.top === "skin" ? oc.a : look.top;
  if (base.hair) look.hair = base.hair;
  if (O.glasses) look.glasses = O.glasses;
  return look;
}

/** a short text of an outfit (the vision judge / the bible summary) */
export function outfitText(look) {
  const O = OUTFITS[look?.outfit]; if (!O) return "";
  const head = look.ohead?.kind ? { crown: "a crown", tiara: "a tiara", tophat: "a top hat", chefhat: "a chef's hat", bakerhat: "a baker's cap", helmetKnight: "a knight's helmet", hardhat: "a hard hat", fireHelmet: "a fire helmet", peakedCap: "a peaked cap", strawhat: "a straw hat", cowboy: "a cowboy hat", tricorn: "a pirate hat", wizard: "a pointed wizard hat", beret: "a beret", flatcap: "a flat cap", sunhat: "a sun hat", safari: "a safari hat", vikingHelmet: "a horned helmet", goggles: "goggles on the forehead", bone: "a bone in the hair", bow: "a hair bow", cap: "a cap", beanie: "a beanie" }[look.ohead.kind] ?? "" : "";
  return [O.label, head, look.glasses ? "glasses" : ""].filter(Boolean).join(", ");
}
