// Blocky Worlds BOARD-ONLY LAUNCH MODE (owner, 2026-11-12): "does this idea / script fit what the board kit can film?"
// The launch mode on top of the kit manifest (boardKit.js) and THE kit check (kitCheck.js v2: the one check for the server
// and the worker, with the lexicon, scanText, the must-have rule and the premise rule). Both are owned by the engine side:
// this file only READS them. What lives here: the idea fit (kitFit: core vs detail, the setting, the planted object), the
// free planted-object swap, the check problems in the page's words (boardFitProblems), the creature-look notes, "What we
// can film", the kit as hard rules for the writers and the "Move it to our town" note. Pure: no I/O, no calls, free.
//
// Switches (function secrets, read by the endpoint and passed in):
//   BLOCKY_WORLDS_LAUNCH=board       the picker shows only fitting ideas, the writers get the kit as hard rules, every
//                                    script is checked against the kit before the charge
//   BLOCKY_WORLDS_BOARD_ONLY=on      the render has no old-planner fallback (render.js: job.prepare.storyboard.maxFallback 0;
//                                    any line the board can't film fails as KIT_UNSUPPORTED and is refunded). Implies
//                                    launch mode (a strict render without the pre-charge check would refund far too often).
import { BOARD_KIT } from "./boardKit.js";
import { kitCheck, kitHas, kitView, NO_VARIANT, PREMISE_SHARE, scanText, singular, VARIANT_CUES } from "./kitCheck.js";
// (re-exported: the writers, the page and the tests read them from here)
export { kitView, NO_VARIANT, PREMISE_SHARE, scanText, VARIANT_CUES };

/** A line the video can't show (fix "part": Fix it rewrites only that part). */
export const BOARD_PREFIX = "The video can't show";
/** The whole story happens where the board can't go (fix "move": the "Move it to our town" rewrite). */
export const PREMISE_PREFIX = "This story happens where our videos can't go yet";

const on = (v) => ["on", "true", "1", "yes", "board"].includes(String(v ?? "").trim().toLowerCase());
/** BLOCKY_WORLDS_BOARD_ONLY: the strict render (no old-planner lines). get: (name) => string */
export const boardOnlyFrom = (get = () => "") => on(get("BLOCKY_WORLDS_BOARD_ONLY"));
/** Launch mode (the picker filter, the steering, the pre-charge check): BLOCKY_WORLDS_LAUNCH=board, or BOARD_ONLY on. */
export const launchModeFrom = (get = () => "") => String(get("BLOCKY_WORLDS_LAUNCH") ?? "").trim().toLowerCase() === "board" || boardOnlyFrom(get);

const list = (xs, last = "and") => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${last} ${xs.at(-1)}`);
const MONSTER = (v) => `${v.creatures.length} monster looks`;

/** "What we can film", for the page (under the topic box): generated from the kit, never hand-written. */
export function canFilm(kit = BOARD_KIT) {
  const v = kitView(kit);
  return [
    ...v.places.map((p) => ({ id: `place:${p.id}`, label: p.label, what: p.what })),
    ...v.weather.map((w) => ({ id: `weather:${w}`, label: w, what: `${w} in any outdoor place` })),
    ...(v.animals.length ? [{ id: "animals", label: `${v.animals.length} animals`, what: list(v.animals) }] : []),
    ...(v.crowds ? [{ id: "crowds", label: v.crowdsAtNight ? "crowds" : "crowds by day", what: v.crowds }] : []),
    ...(v.creatures.length ? [{ id: "creatures", label: MONSTER(v), what: `one tall creature: ${list(v.creatures.map((c) => c.what), "or")}` }] : []),
    ...(v.propsFromKit ? [{ id: "props", label: "everyday props", what: list(v.props.filter((p) => !p.fromActions).map((p) => p.what)) }] : []),
  ];
}
/** One short line of the same ("streets, inside houses, a park / town square, ..."), for messages. */
export const canFilmLine = (kit = BOARD_KIT) => list(canFilm(kit).map((x) => x.label));
const placesLine = (v) => list(v.places.map((p) => p.label), "or");

const lower = (s) => String(s ?? "").toLowerCase();

/**
 * What an idea card says. CORE: the world and the story's spine (a miss here means the idea can't be filmed). DETAIL: the
 * examples, the narrator line, the teaser and the closer (a miss there is a word the writer replaces with a kit thing; the
 * script check catches it if it stays). The setting field is read on its own: it names one of formulas.js SETTINGS.
 */
const coreText = (idea) => [idea?.opener, idea?.title, idea?.premise, idea?.price, idea?.twist].filter(Boolean).join("\n");
const detailText = (idea) => [...(Array.isArray(idea?.examples) ? idea.examples : []), idea?.narrator, idea?.teaser, idea?.closer].filter(Boolean).join("\n");
/** formulas.js SETTINGS -> the place it needs (null = fine with the kit's places). */
const SETTING_NEEDS = [
  [/^farm/i, "farm"], [/canyon|cliff/i, "canyon"], [/castle/i, "castle"], [/underground|cave/i, "cave"], [/underwater|submarine/i, "underwater"], [/inside something giant/i, "inside_giant"],
];
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Whether a thing (a planted object: "A roll of masking tape") is one the board can film: the kit's own answer first
 * (kitCheck.js kitHas: a prop, animal or place of the manifest), then the props the kit's actions and room use.
 */
export function propFilmable(prop, kit = BOARD_KIT) {
  // the thing itself, not where it is kept or what it holds ("A stale bagel in her backpack" is a bagel, "a jar of pepper"
  // is pepper: the climax shows the pepper): the phrase's last noun
  const p = propHead(prop);
  if (!p) return true;
  if (kit === BOARD_KIT && kitHas(p)) return true;
  return kitView(kit).props.some((x) => x.words.some((w) => w && new RegExp(`\\b${esc(lower(w).replace(/_/g, " "))}(?:e?s)?\\b`).test(p)));
}

/**
 * The misses kitCheck finds in one text (every hit counts: an idea's text is one "line", all must-have). kit: kitCheck
 * judges the real kit; for a what-if kit (a test: a kit that grew a cave) a word that kit lists is not a miss.
 */
function kitMisses(text, kit = BOARD_KIT) {
  const v = kitView(kit), listed = new Set([...v.places.map((p) => p.id), ...v.animals, ...v.props.flatMap((p) => p.words)].map(lower));
  return kitCheck([text], { kit }).missing.filter((m) => kit === BOARD_KIT || !listed.has(m.word)).map((m) => ({ kind: m.kind, value: m.kind, word: m.word }));
}
/** kitCheck's must-have rule (kitCheck.js MUST), for the planted object (its home is here): lines 0-1, the last two, or two lines. */
const mustHave = (lines, count) => lines.length >= 2 || lines.some((i) => i <= 1 || i >= count - 2);

/** The thing a planted-object phrase names ("A roll of masking tape" -> "tape", "A paper sign reading ASK FIRST" -> "sign"). */
const propCore = (prop) => String(prop ?? "").replace(/\b(that|which|with|reading|from|in|on|for|to|tucked|hidden|kept)\b.*$/i, "").trim();
export function propHead(prop) {
  const words = propCore(prop).replace(/[^A-Za-z' -]/g, " ").trim().split(/\s+/).filter(Boolean);
  const w = lower(words.at(-1) ?? "").replace(/'s$/, "");
  return w.length >= 3 ? w : null;
}

// ---------------------------------------------------------------- the planted-object swap (free, deterministic)
/**
 * When an idea's planted object isn't a kit prop, the closest kit prop that keeps its story job: a word map by category.
 * Each category lists the kit props it may become, in order (the first the kit has wins). Words are singular.
 */
export const SWAP_CATEGORIES = Object.freeze([
  { id: "bread", job: "food you hand over or carry", words: ["bread", "bagel", "toast", "roll", "bun", "muffin", "pancake", "waffle", "cracker", "crumb", "crust", "biscuit", "pretzel", "dumpling"], to: ["cookie", "cake", "sandwich"] },
  { id: "sweet", job: "a treat", words: ["pie", "pastry", "tart", "donut", "doughnut", "pudding", "jelly", "jam", "honey", "sugar", "gum", "marshmallow", "popsicle", "icecream", "sprinkle", "frosting", "cocoa", "syrup"], to: ["candy", "cake", "cookie"] },
  { id: "produce", job: "something from the garden or kitchen", words: ["potato", "carrot", "turnip", "onion", "berry", "pear", "orange", "lemon", "grape", "nut", "acorn", "seed", "bean", "pea", "corn", "radish", "cabbage", "garlic", "pickle"], to: ["apple", "egg"] },
  { id: "sneezy", job: "something that makes you sneeze or smells strong", words: ["pepper", "salt", "spice", "herb", "pollen", "dust", "powder", "perfume", "shaker"], to: ["flower"] },
  { id: "furniture", job: "something to stand or sit on", words: ["stool", "chair", "step", "bench", "footstool", "cushion", "pillow", "crate"], to: ["table", "box", "sofa"] },
  { id: "drawing", job: "something to draw or write with", words: ["chalk", "paint", "paintbrush", "marker", "pen", "quill", "charcoal"], to: ["crayon", "pencil"] },
  { id: "meal", job: "a meal", words: ["cheese", "rind", "sausage", "meat", "ham", "lunchbox", "soup", "stew", "porridge", "broth", "noodle", "spaghetti"], to: ["sandwich", "bowl"] },
  { id: "drink", job: "a drink", words: ["milk", "tea", "juice", "lemonade", "water", "coffee", "thermos", "flask", "canteen", "cocoa powder", "hot cocoa"], to: ["cup", "mug", "bottle"] },
  { id: "utensil", job: "something to eat or serve with", words: ["ladle", "whisk", "spatula", "chopstick", "scoop"], to: ["spoon"] },
  { id: "treasure", job: "a small treasure or token", words: ["ribbon", "medal", "badge", "pin", "button", "marble", "gem", "jewel", "ring", "necklace", "bracelet", "token", "stamp", "sticker", "star", "charm", "locket", "pebble", "shell", "ticket"], to: ["coin", "key", "crown", "trophy"] },
  { id: "toy", job: "a toy", words: ["rollerskate", "yoyo", "yo-yo", "top", "puzzle", "dice", "die", "card", "figurine", "block", "rattle", "slinky", "abacus", "jump rope", "rubber duck", "spinner", "whirligig"], to: ["toy", "ball", "teddy", "doll"] },
  { id: "feet", job: "something you wear on your feet or hands", words: ["shoe", "sneaker", "boot", "slipper", "sandal", "skate", "mitten", "mitt", "glove"], to: ["sock"] },
  { id: "head", job: "something you wear on your head or face", words: ["hat", "cap", "beanie", "helmet", "glass", "glasses", "goggle", "earmuff", "headband"], to: ["mask", "crown"] },
  { id: "wrap", job: "something you wrap up in", words: ["scarf", "raincoat", "coat", "jacket", "sweater", "handkerchief", "bandana", "pajama", "towel", "cape", "quilt"], to: ["blanket"] },
  { id: "paper", job: "something written or drawn", words: ["paper", "sheet", "scroll", "rulebook", "contract", "tag", "label", "sign", "list", "page", "drawing", "poster", "flag", "law", "receipt", "certificate", "diploma", "permission slip", "slip", "card"], to: ["note", "letter", "book"] },
  { id: "light", job: "a light", words: ["bulb", "lightbulb", "match", "glowstick", "nightlight", "lamp", "torch", "firefly"], to: ["lantern", "flashlight"] },
  { id: "sound", job: "something that makes a sound", words: ["horn", "trumpet", "harmonica", "rattle", "chime", "buzzer", "shaker", "squeaker", "alarm"], to: ["whistle", "bell", "kazoo", "drum"] },
  { id: "container", job: "something that holds things", words: ["pot", "pan", "tin", "can", "kettle", "tray", "pail", "crate", "sack", "pouch", "purse", "wallet", "envelope", "mailbox", "jug", "pitcher", "teapot", "lunch bag", "wheelbarrow"], to: ["bucket", "box", "jar", "bowl", "basket", "bag"] },
  { id: "cleaning", job: "something to clean or splash with", words: ["duster", "polish", "rag", "sponge", "brush", "hose", "mop"], to: ["broom", "bucket"] },
  { id: "tool", job: "a tool that bangs or digs", words: ["wrench", "saw", "nail", "screwdriver", "mallet", "trowel", "rake", "pickaxe"], to: ["hammer", "shovel", "stick"] },
]);
const MASS_NOUNS = new Set(["toast", "bread", "cheese", "soup", "chalk", "mud", "pepper", "salt", "paper", "cocoa", "yarn", "powder", "polish", "jam", "honey", "sugar", "gum", "tape", "string", "pie", "cake", "candy", "rind", "crumb"]);
const SWAP_MODIFIERS = "masking|sewing|pencil|roller|step|rule|streetlight|soup|tin|cocoa|cotton|garden|pocket|rubber|jump|leg|arm|hair|shoe|snow|toy|tea|lunch|alarm|paper|kitchen|bath|rain|sun|night|bed";
const MEASURES = "slice|slices|piece|pieces|loaf|loaves|bowl|bowls|cup|cups|jar|jars|bag|bags|roll|rolls|stub|stubs|box|boxes|tin|tins|bit|bits|lump|lumps|ball|balls|handful|spool|coil|scrap|scraps|sheet|sheets|bottle|bottles|pinch|scoop";
/** kitCheck's singular (a real one: buses -> bus, glasses -> glass), plus "-oes" nouns (potatoes -> potato) for the swap. */
const singularOf = (w) => (/oes$/.test(w) && !/(?:shoes|toes)$/.test(w) ? w.slice(0, -2) : singular(w));
/**
 * The swap for one planted object, or null (already filmable, or no category knows it): { from, to, category, job }.
 * The words of the object are read from the last to the first ("a pencil stub" is a pencil; "a stub of chalk" is chalk).
 */
export function propSwap(prop, kit = BOARD_KIT) {
  if (!prop || propFilmable(prop, kit)) return null;
  const v = kitView(kit), has = (id) => v.props.some((p) => p.id === id || p.words.includes(id));
  const core = lower(propCore(prop)).replace(/[^a-z' -]/g, " ");
  const words = core.split(/\s+/).filter(Boolean).map((w) => w.replace(/'s$/, ""));
  if (!words.length) return null;
  // 1. the thing itself (the last word, or its two-word name: "cocoa powder"), by its job
  const w = singularOf(words.at(-1)), pair = words.length > 1 ? `${singularOf(words.at(-2))} ${w}` : null;
  const cat = (pair && SWAP_CATEGORIES.find((c) => c.words.includes(pair))) || SWAP_CATEGORIES.find((c) => c.words.includes(w));
  const to = cat?.to.find(has);
  if (to) return { from: words.at(-1), to, category: cat.id, job: cat.job };
  // 2. else a kit prop named in the phrase is the thing ("a tiny pencil sharpener" -> a pencil, "a bucket of mud" -> a bucket)
  for (let i = words.length - 2; i >= 0; i--) if (has(singularOf(words[i]))) return { from: words.at(-1), to: singularOf(words[i]), category: "kit", job: "the same thing" };
  return null;
}
/**
 * An idea with its planted object swapped into the kit (deterministic, free): the prop becomes the kit prop, and every
 * card field that names the old thing names the new one ("one slice of toast" -> "one cookie"). The card says what moved
 * (idea.swap) for the writers. Returns the idea unchanged when nothing needs or can be swapped.
 */
export function swapIdea(idea, kit = BOARD_KIT) {
  const s = propSwap(idea?.prop, kit);
  if (!s) return idea;
  const plural = s.category !== "kit" && singularOf(lower(s.from)) !== lower(s.from) && !/^(glasses|braces|scissors|goggles|pajamas|earmuffs)$/i.test(s.from), to = plural && !/s$/.test(s.to) ? `${s.to}s` : s.to;
  // a kit prop inside the phrase: only "<kit prop> (of) ... <thing>" becomes the kit prop ("bucket of mud" -> "bucket"; a
  // bare "mud" elsewhere stays: it may be the story's own mud). Otherwise the thing itself, with its measure ("slice of").
  const fromRe = s.category === "kit"
    ? new RegExp(`\\b()${esc(s.to)}s?\\s+(?:of\\s+)?(?:[a-z-]+\\s+)?${esc(singularOf(lower(s.from)))}(?:e?s)?\\b`, "gi")
    : new RegExp(`\\b(?:(?:${MEASURES})\\s+of\\s+)?((?:[a-z-]+\\s+){0,2}?)${esc(singularOf(lower(s.from)))}(?:e?s)?\\b`, "gi");
  // a noun that only said what kind of thing it was goes with it ("masking tape", "roller skates", "step stool")
  const dropMod = (adj) => String(adj ?? "").replace(new RegExp(`\\b(?:${SWAP_MODIFIERS})\\s+$`, "i"), "");
  // a mass noun with no measure reads as many ("we leave toast on the curb" -> "we leave cookies on the curb"), unless it
  // names a kind of something ("a chalk circle" -> "a crayon circle")
  const mass = !plural && MASS_NOUNS.has(singularOf(lower(s.from))) && s.category !== "kit";
  const many = (m, offset, str) => mass && !new RegExp(`^(?:${MEASURES})\\s+of\\b`, "i").test(m) && !/^\s+(?!(?:on|in|at|to|for|from|with|and|or|by|the|a|is|was|are|were|that|every|each|into|onto|under|over|tonight|again)\b)[a-z]+/i.test(str.slice(offset + m.length));
  const swapText = (t) => String(t ?? "").replace(fromRe, (m, adj, offset, str) => `${dropMod(adj)}${many(m, offset, str) && !/s$/.test(to) ? `${to}s` : to}`).replace(new RegExp(`\\b(${esc(to)})(?:\\s+of)?\\s+\\1\\b`, "gi"), "$1");
  const out = { ...idea };
  for (const k of ["opener", "title", "premise", "price", "narrator", "twist", "teaser", "closer"]) if (out[k]) out[k] = swapText(out[k]);
  if (Array.isArray(out.examples)) out.examples = out.examples.map(swapText);
  out.prop = swapText(idea.prop);
  if (!propFilmable(out.prop, kit)) out.prop = `${plural ? "some" : /^[aeiou]/.test(to) ? "an" : "a"} ${to}`;
  out.swap = { from: String(idea.prop), to: out.prop, category: s.category, job: s.job };
  return out;
}
/** The writers' hint for a swapped planted object (the plan writer and the library script writer get it). */
export const swapHint = (swap) => `Planted object, moved into the kit we can film: ${swap.to} (the idea had ${swap.from}). Use it for the same job (${swap.job}); never name the old thing.`;
/** Rows (or bare ideas) that fit the kit, swapping the planted object where that makes them fit; the rest dropped. */
export function fittingWithSwap(rows, kit = BOARD_KIT) {
  const out = [];
  for (const r of rows ?? []) {
    const idea = r?.idea ?? r;
    if (kitFit(idea, kit).fit) { out.push(r); continue; }
    const swapped = swapIdea(idea, kit);
    if (swapped !== idea && kitFit(swapped, kit).fit) out.push(r?.idea ? { ...r, idea: swapped } : swapped);
  }
  return out;
}

/**
 * Does an idea fit the board kit? -> { fit, need: [{ kind, value, words }], soft: [...same], tags, version }.
 * need: the misses in the idea's core (its world, rule, price, twist, setting and planted object): fit is false.
 * soft: misses only in its details (examples, narrator, teaser, closer): the writer swaps those words; fit stays true.
 * A stored tag set on the idea (idea.kit = { need, soft, version }) is used only while it was made for this kit's version;
 * otherwise it is recomputed (the kit grows weekly: a stored yes/no goes stale).
 */
export function kitFit(ideaOrText, kit = BOARD_KIT) {
  const v = kitView(kit);
  if (ideaOrText && typeof ideaOrText === "object" && ideaOrText.kit?.version === v.version && Array.isArray(ideaOrText.kit.need)) {
    return { fit: ideaOrText.kit.need.length === 0, need: ideaOrText.kit.need, soft: ideaOrText.kit.soft ?? [], tags: ideaOrText.kit.tags ?? {}, version: v.version, stored: true };
  }
  const idea = typeof ideaOrText === "string" ? { premise: ideaOrText } : ideaOrText ?? {};
  const all = scanText(`${coreText(idea)}\n${detailText(idea)}`, kit);
  const core = kitMisses(coreText(idea), kit), detail = kitMisses(detailText(idea), kit);
  const placeIds = new Set(v.places.map((p) => p.id));
  for (const [re, id] of SETTING_NEEDS) if (re.test(idea.setting ?? "") && !placeIds.has(id)) core.push({ kind: id === "inside_giant" ? "world" : "place", value: id, word: idea.setting });
  if (idea.prop && !propFilmable(idea.prop, kit)) core.push({ kind: "prop", value: "prop", word: idea.prop });
  // grouped by kind + value (the words that signal each)
  const group = (xs) => { const out = []; for (const n of xs) { const g = out.find((x) => x.kind === n.kind && x.value === n.value); if (g) { if (!g.words.includes(n.word)) g.words.push(n.word); } else out.push({ kind: n.kind, value: n.value, words: [n.word] }); } return out; };
  const need = group(core), soft = group(detail).filter((s) => !need.some((n) => n.kind === s.kind && n.value === s.value));
  return { fit: need.length === 0, need, soft, tags: all.tags, version: v.version };
}
/** The boardFit tag of a library row or an idea card (computed at read time). */
export const boardFitOf = (idea, kit = BOARD_KIT) => kitFit(idea, kit);
/** Only the ideas that fit (rows of { idea } or bare idea cards), in their order. */
export const fittingOnly = (rows, kit = BOARD_KIT) => (rows ?? []).filter((r) => kitFit(r?.idea ?? r, kit).fit);

// ---------------------------------------------------------------- script checks (free, before the charge)
const WHY = {
  place: (v) => `our videos are filmed on ${placesLine(v)}`,
  world: () => "towns inside or on a giant thing aren't in our block world yet",
  creature: (v) => `our one creature is a tall figure with ${list(v.creatures.map((c) => c.label), "or")}; describe it as one of those`,
  creature_look: (v) => `no monster look can show that; our creature has ${list(v.creatures.map((c) => c.label), "or")}`,
  animal: (v) => `the animals we can film are ${list(v.animals)}`,
  weather: (v) => `the weather we can film is ${list(v.weather)} (falling snow, not snow on the ground)`,
  vehicle: () => "vehicles aren't in our block world yet",
  sky: () => "sky events aren't in our block world yet",
  flight: () => "people or things flying or floating away aren't in our block world yet",
  transform: () => "things turning into other things aren't in our block world yet",
  crowd_night: () => "crowds can be filmed by day only; at night show two or three named people",
  action: () => "riding, swimming and digging aren't in our block world yet",
  prop: (v) => `it isn't in our props kit (we have ${v.props.filter((p) => !p.fromActions).slice(0, 8).map((p) => `${p.what}s`).join(", ")} and more)`,
};
/** The kinds that make a miss in the first line a whole-premise miss (the world itself, not one line's detail). */
const PREMISE_KINDS = new Set(["place", "world", "creature"]);

/**
 * Every thing a script needs that the board kit can't film, as check problems in the page's words (free; the same words in,
 * the same problems out). kitCheck(script, { card }) decides (its must-have rule and its premise rule); this file adds the
 * card's planted object (the swap's home) with the same rule, and the creature-look notes. Returns { problems, warnings,
 * premise, missing: [{ word, kind, lines, source }] }:
 *   - a must-have miss: `The video can't show "<word>" (line N): <why>.`, ONE PROBLEM PER PART it is in (Fix it rewrites one
 *     part at a time: a word in the tour and in the climax is two Fix its, each one lowers the count)
 *   - a whole-premise miss: ONE problem that starts with PREMISE_PREFIX (problemSpots -> fix "move": "Move it to our town")
 *   - a mention that is not a must-have (once, mid-story): a warning only (the advisory notes), never a block
 */
export function boardFitProblems(script, card = null, kit = BOARD_KIT) {
  const v = kitView(kit), lines = script?.lines ?? [], n = lines.length;
  const kc = kitCheck(script, { card, kit });
  const listed = new Set([...v.places.map((p) => p.id), ...v.animals, ...v.props.flatMap((p) => p.words)].map(lower));
  const keep = (e) => kit === BOARD_KIT || !listed.has(e.word);
  const missing = kc.missing.filter(keep).map((e) => ({ ...e, source: "kitCheck" })), warned = kc.warnings.filter(keep);
  // the card's planted object (a library idea's or a pasted script's card) must be filmable: the lines that name it
  const head = card?.prop && !propFilmable(card.prop, kit) ? propHead(card.prop) : null;
  if (head && !missing.some((e) => e.word === singular(head))) {
    const at = lines.map((l, i) => (new RegExp(`\\b${esc(head)}(?:e?s)?\\b`, "i").test(l.text) ? i : -1)).filter((i) => i >= 0);
    if (at.length) (mustHave(at, n) ? missing : warned).push({ word: head, kind: "prop", lines: at, source: "card" });
  }
  const badLines = new Set(missing.flatMap((e) => e.lines));
  const opener = missing.filter((e) => PREMISE_KINDS.has(e.kind) && e.lines.some((i) => i <= 1));
  const premise = n > 0 && (kc.premise || opener.length > 0 || badLines.size / n > PREMISE_SHARE);
  const why = (e) => WHY[e.kind]?.(v) ?? "it isn't in our block world yet";
  const at = (ls) => (ls.length === 1 ? `line ${ls[0] + 1}` : `lines ${list(ls.slice(0, 4).map((i) => String(i + 1)))}`);
  const warn = warned.map((e) => `Our block world can't show "${e.word}" (${at(e.lines)}): ${why(e)}. It's only mentioned once, so that shot shows the closest thing we have.`);
  // the creature must be described as the look the video draws (the engine's creatureCheck: the words pick the look)
  const all = lines.map((l) => l.text).join("\n") + "\n" + [card?.premise, card?.opener].filter(Boolean).join("\n");
  const creature = scanText(all, kit).tags.creature != null;
  const t = lines.map((l) => l.text).join("\n"), looks = v.creatures.map((c) => c.id).filter((id) => VARIANT_CUES[id]?.test(t));
  const planned = card?.world?.creature_look && card.world.creature_look !== "none" ? card.world.creature_look : null;
  const label = (id) => v.creatures.find((c) => c.id === id)?.label ?? id;
  if ((creature || planned) && v.creatures.length) {
    if (!looks.length) warn.push(`The creature is never described, so the video picks its look. Say what it looks like (${list(v.creatures.map((c) => c.label), "or")}) so it matches your story.`);
    else if (looks.length > 1) warn.push(`The creature is described two ways (${list(looks.map(label))}); the video draws one: ${label(looks.includes(planned) ? planned : looks[0])}.`);
    else if (planned && looks[0] !== planned) warn.push(`The plan gave the creature ${label(planned)}, but the lines describe ${label(looks[0])}; the video draws ${label(looks[0])}.`);
  }
  if (premise) {
    const words = [...new Set((opener.length ? opener : missing).map((e) => e.word))].slice(0, 4).map((w) => `"${w}"`);
    return { premise: true, problems: [`${PREMISE_PREFIX} (${list(words)}). "Move it to our town" keeps your rule and films it on ${placesLine(v)}.`], warnings: warn, missing };
  }
  // one problem per part: the lines of each part the word is in
  const partOf = (i) => lines[i]?.part ?? "own";
  const problems = missing.flatMap((e) => {
    const parts = [...new Set(e.lines.map(partOf))];
    return parts.map((p) => `${BOARD_PREFIX} "${e.word}" (${at(e.lines.filter((i) => partOf(i) === p))}): ${why(e)}.`);
  });
  return { premise: false, problems, warnings: warn, missing };
}
/** The lines a board problem is about (0-based), [] for anything else. */
export function boardProblemLines(p) {
  const m = String(p).startsWith(BOARD_PREFIX) ? String(p).match(/\((lines? [^)]*)\):/) : null;
  return m ? [...m[1].matchAll(/\d+/g)].map((x) => Number(x[0]) - 1) : [];
}
export const isPremiseProblem = (p) => String(p).startsWith(PREMISE_PREFIX);

// ---------------------------------------------------------------- the kit as HARD rules for the writers
/**
 * The kit as a prompt block (the same text for the same kit: the prompts that carry it stay cacheable). who: "ideas"
 * (topic and batch ideas), "plan" (the hybrid planner), "lines" (the line writer).
 */
export function kitBlock(kit = BOARD_KIT, who = "plan") {
  const v = kitView(kit);
  const rows = [
    `THE WORLD WE CAN FILM (a HARD rule: every video is built only from this kit; a line that needs anything else can't be filmed and the video is refused):`,
    `- PLACES (every scene happens in one of these): ${v.places.map((p) => `${p.label} (${p.what})`).join("; ")}.`,
    v.creatures.length ? `- THE CREATURE: at most one, always the same tall body in ONE of these looks: ${v.creatures.map((c) => `${c.id} = ${c.what} (${c.signature})`).join("; ")}. It ${v.creatureMoves}. Pick one look and describe the creature ONLY with that look's words (the eye, the shadow, the grin, the hat or the eyes), never wings, tentacles, slime, fur, scales or a different body; a name is fine ("the Porch Watcher") but the words that describe it must be its look.` : "",
    v.animals.length ? `- ANIMALS (only these): ${list(v.animals)}.` : "",
    v.weather.length ? `- WEATHER (only these): ${list(v.weather)} (falling snow; never snow on the ground, a snowman, fog or a storm).` : "",
    v.crowds ? `- CROWDS: ${v.crowds}.${v.crowdsAtNight ? "" : " Crowds by DAY only: at night, show two or three named people, never a crowd."}` : "",
    `- PROPS held or set down (only these): ${list(v.props.map((p) => p.what))}.`,
    v.notYet.length ? `- NOT YET (never write these): ${v.notYet.join("; ")}; flying or floating away, sky events, things turning into other things.` : "",
  ];
  const tail = {
    ideas: "Every idea must be filmable with this kit alone. If the user's idea needs something outside it, MOVE it into the kit and keep the user's rule and hook: a cave town becomes our street at night, a dragon becomes the tall creature with one huge eye, a spaceship becomes a shop window full of blinking lights, an underwater school becomes a classroom where the rain never stops. Name the moved world plainly in the opener.",
    plan: "Plan the whole story inside this kit: the setting, the rule visual, every beat's \"shows\", the neighbours, the adults' failed attempts and the save must all be filmable with the places, the creature looks, the animals, the weather and the props listed. Anything the topic needs outside the kit is MOVED into it (keep the rule and the hook; change the place or the body): a cave town becomes our street at night, a dragon becomes the tall creature with one huge eye. If the story has a creature, name its look in the rule visual's description.",
    lines: "Every line must be filmable with this kit: never name a place, creature body, animal, weather, vehicle or prop outside it, even in a joke or a comparison. Describe the creature only with the look the plan gave it.",
  }[who] ?? "";
  return [...rows.filter(Boolean), tail].filter(Boolean).join("\n");
}

/** The note for "Move it to our town" (the writer's rewrite note): the rule and the hook stay, the world moves into the kit. */
export function moveNote(problems = [], kit = BOARD_KIT) {
  const v = kitView(kit);
  const words = [...new Set((problems ?? []).flatMap((p) => [...String(p).matchAll(/"([^"]{1,40})"/g)].map((m) => m[1])).filter((w) => !/^move it/i.test(w)))].slice(0, 6);
  const head = `Move the story into the world we can film: ${placesLine(v)}.${words.length ? ` Replace: ${words.join(", ")}.` : ""} Keep the rule, the hook, the names and the ending.`;
  const creature = v.creatures.length ? ` At most one tall creature (${list(v.creatures.map((c) => c.label), "or")}).` : "";
  return (head.length + creature.length <= 300 ? head + creature : head).slice(0, 300);
}
