// deno-lint-ignore-file no-explicit-any
// stickman/promptCompiler.ts — Phase 3 standalone prompt compiler (Stickman).
//
// Every image prompt must work even if the image model sees NOTHING else.
// Consistency comes from inserting the SAME canonical text word-for-word
// every time a character / setting / prop appears — assembled by code, never
// paraphrased by a model. Pure and deterministic: same inputs -> byte-
// identical prompts.
//
// Order: STYLE HEADER -> FRAME -> SUBJECTS -> PROPS -> SETTING -> LIGHTING ->
// TEXT -> AVOID TAIL (the avoid tail goes to negativePrompt when the
// renderer supports one, else it is appended).
import { buildBibleIndex, TEXT_IMPLIED, SHORT_TEXT_PER_MINUTE, IP_MARKS, IP_LOOKALIKE } from "./beatDirector.ts";

/* ============================ Style contract (recipe-level) ============================ */

export const STYLE_CONTRACT_VERSION = "STICKMAN_DOODLE_EXPLAINER_V1";

const STYLE_FLAT = "Uniform thin clean black outlines of identical weight everywhere; flat solid color fills only; no shading, no gradients, no texture, no highlights, no 3D, no photorealism.";
export const STYLE_PEOPLE = "Every person is a stickman: a perfect circle head with no neck, two small black dot eyes, thin black eyebrows, one curved black mouth line, thin uniform black stick limbs, rounded black mitten hands and feet with no fingers or toes. Clothing is only a flat colored shape on the torso; arms and legs ALWAYS remain thin black stick lines, never filled trouser legs or sleeves; feet are small rounded mitten shapes (may be colored for shoes/boots).";
const STYLE_ENV = "Environments use two or three flat color layers only.";
// Phase 4d: FLUX gave helmets, books, hourglasses and globes faces and limbs.
// Phase 5a: for EVERY beat, with or without cast (faces came back on helmets
// held by the viewer, a carved sun and a helmet sketch).
export const OBJECTS_NO_FACES = "Objects have no faces, eyes, mouths or limbs; helmets are empty with no head inside; display cases contain only their object.";
// (a) The global art style — in every prompt.
export const STYLE_GLOBAL = `Flat-color 2D doodle explainer illustration, 16:9 landscape frame. ${STYLE_FLAT} ${STYLE_ENV} ${OBJECTS_NO_FACES}`;
// (a) + (b) the stickman construction paragraph — ONLY for beats with at least
// one cast member. Phase 4d: the anatomy text made FLUX draw stickmen in place
// of map pins, timeline marks, icons and museum objects on empty-cast beats.
export const STYLE_HEADER = `${STYLE_GLOBAL} ${STYLE_PEOPLE}`;
export const NO_PEOPLE_STYLE_HEADER = STYLE_GLOBAL;
export const NO_PEOPLE_RULE = "This image contains no people and no stick figures.";
// Phase 5b: pictured people are stickmen too (5a beat 98 came out as detailed comic art).
export const PICTURED_PEOPLE_RULE = "This image contains no people and no stick figures; any people appear only as small flat drawings inside the artwork, drawn as simple stickmen in the same flat style — never detailed comic or realistic art.";

export const AVOID_TAIL = "Avoid: shading, gradients, texture, realistic anatomy, fingers, necks, detailed faces, 3D rendering, painterly or sketchy lines, drop shadows, glow effects, multiple panels unless specified, character reference sheets, turnaround views, and any text not explicitly requested.";

// The only face changes a beat may ask for (plus glasses when part of an identity).
export const ALLOWED_FACE_MODIFIERS = ["closed-eye curved lines", "open-mouth oval", "sweat drops", "tear drops", "small motion lines", "glasses"];

export const NO_TEXT_INSTRUCTION = "No text anywhere in the image — no letters, numbers, labels, captions, signs, or watermarks.";

/* ============================ Canonical blocks ============================ */

export type Presence = "full" | "hands" | "back" | "tiny";
export type CastIdentity = { displayName: string; skinTone: string; faceMarks: string; hair: string; outfit: string; outfitShort: string; sleeves: string; build: string; signature: string };
export type SettingVariant = { background: string; midground: string; foreground: string; palette: string; signatureObjects: string; lighting: string };
export type CanonicalSet = {
  cast: Record<string, CastIdentity & { source: "structured" | "fixture" | "prose"; variants?: Record<string, CastIdentity> }>;
  settings: Record<string, { name: string; variants: Record<string, SettingVariant>; source: string }>;
  props: Record<string, { block: string; source: string }>;
};

// Presence variants derived in code from the identity fields — the same
// fields always give the same text. Outfit variants are separate identities
// (full blocks), never "same but…".
export function castBlock(c: CastIdentity, presence: Presence): string {
  const face = c.faceMarks ? ` and ${c.faceMarks}` : "";
  switch (presence) {
    case "hands":
      // Phase 4b: arms are thin stick lines — never sleeves.
      return `${c.displayName}, hands only: two rounded black mitten hands at the ends of thin black stick arms; no body or face in view.`;
    case "back":
      return `${c.displayName}, seen from behind: a ${c.skinTone} circle head with ${c.hair}, wearing ${c.outfitShort}.`;
    case "tiny":
      return `${c.displayName}, as a tiny distant figure: a small stickman with a ${c.skinTone} circle head, wearing ${c.outfitShort}.`;
    default:
      return `${c.displayName}: a stickman with a ${c.skinTone} circle head${face}, ${c.hair}, wearing ${c.outfit}; ${c.build}; carrying ${c.signature}.`;
  }
}

export function settingBlock(name: string, v: SettingVariant, opts: { dropMidground?: boolean } = {}): string {
  const mid = opts.dropMidground ? "" : ` midground ${v.midground};`;
  return `Setting — ${name}: far background ${v.background};${mid} foreground ${v.foreground}. Flat palette: ${v.palette}. Typical things in this place: ${v.signatureObjects}.`;
}
export const lightingLine = (v: SettingVariant) => `Lighting: ${v.lighting}.`;
export const NO_SETTING_BLOCK = "Setting: a plain flat off-white background with no scenery.";
// A scene with no canonical setting describes its own place in the frame line
// (e.g. an opera house facade); only graphics get the plain background.
export const OWN_PLACE_SETTING_BLOCK = "Setting: the place described above, drawn in two or three flat color layers.";
const GRAPHIC_TREATMENTS = new Set(["SYMBOLIC", "STAT_CARD", "TIMELINE_BAR", "ICON_ROW", "MAP", "SCALE", "COMPARISON", "SPLIT", "OBJECT_DETAIL"]);

// Older bibles only have prose (canonicalAppearance / canonicalDescription).
// The fallback strips what a standalone prompt must never carry (hex codes,
// cross-references, meta rules, internal ids); the lints still judge the result.
export function sanitizeProse(text: string): string {
  return String(text ?? "")
    .replace(/\(\s*hex\s*#?[0-9a-f]{3,6}\s*\)/gi, "")
    .replace(/#[0-9a-f]{6}\b/gi, "")
    .split(/(?<=[.;])\s+/)
    .filter((s) => !/\b(forbidden mutations?|persistentidentifyingfeatures|see objectlanguage|objectlanguage|why recurring|archetype)\b/i.test(s))
    .join(" ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Structured bible fields first (identity / world.settingBlocks /
// promptBlock), then a handwritten fixture, then sanitized prose.
export function canonicalSetFromBible(bible: any, fixture?: any): CanonicalSet {
  const set: CanonicalSet = { cast: {}, settings: {}, props: {} };
  const index = buildBibleIndex(bible);
  // The hero (when the bible has one) is castable as "hero".
  if (bible?.hero?.exists) {
    const h = bible.hero;
    if (h.identity) set.cast.hero = { ...h.identity, source: "structured" };
    else if (fixture?.cast?.hero) set.cast.hero = { ...fixture.cast.hero, source: "fixture" };
    else set.cast.hero = { displayName: "The main character", skinTone: sanitizeProse(h.skinTone) || "light", faceMarks: "", hair: sanitizeProse(h.hair), outfit: sanitizeProse(h.outfit), outfitShort: sanitizeProse(h.outfit), sleeves: "sleeves", build: "", signature: "", source: "prose" };
  }
  for (const a of [...(bible?.recurringCharacters ?? []), ...(bible?.roleArchetypes ?? [])]) {
    const id = String(a.id);
    if (a.identity) set.cast[id] = { ...a.identity, source: "structured", ...(a.outfitVariants?.length ? { variants: Object.fromEntries(a.outfitVariants.map((v: any) => [v.name, v.identity])) } : {}) };
    else if (fixture?.cast?.[id]) set.cast[id] = { ...fixture.cast[id], source: "fixture" };
    else {
      const prose = sanitizeProse(a.canonicalAppearance);
      set.cast[id] = { displayName: a.role ?? id, skinTone: "", faceMarks: "", hair: "", outfit: prose, outfitShort: prose, sleeves: "sleeves", build: "", signature: "", source: "prose" };
    }
  }
  const blocks = bible?.world?.settingBlocks ?? [];
  for (const s of index.settings) {
    const structured = blocks.find((b: any) => b.family === s.label);
    if (structured) set.settings[s.id] = { name: structured.name ?? s.label, variants: Object.fromEntries(structured.variants.map((v: any) => [v.name, v])), source: "structured" };
    else if (fixture?.settings?.[s.label]) set.settings[s.id] = { ...fixture.settings[s.label], source: "fixture" };
    else set.settings[s.id] = { name: s.label, variants: { default: { background: s.label, midground: "", foreground: "", palette: "", signatureObjects: "", lighting: "" } }, source: "prose" };
  }
  for (const o of bible?.objectLanguage ?? []) {
    const id = String(o.id);
    if (o.promptBlock) set.props[id] = { block: o.promptBlock, source: "structured" };
    else if (fixture?.props?.[id]) set.props[id] = { block: fixture.props[id], source: "fixture" };
    else set.props[id] = { block: sanitizeProse(o.canonicalDescription), source: "prose" };
  }
  return repairStructuredBlocks(set);
}

// Safety net for bibles whose structured blocks break the standalone rules
// (the Phase 3b rebuild used ids as display names and put the viewer into
// setting foregrounds): deterministic, no model call.
export const humanizeId = (id: string) => { const t = id.replace(/_+/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
const PERSON_IN_SETTING = /\b(avatar|viewer|stickman|stick figure|person|people|figure)\b/i;
export function repairStructuredBlocks(set: CanonicalSet): CanonicalSet {
  const ids = Object.keys(set.cast).concat(Object.keys(set.props)).filter((id) => /[_\d]/.test(id)).sort((a, b) => b.length - a.length);
  for (const [id, c] of Object.entries(set.cast)) if (c.source === "structured" && (/_/.test(c.displayName) || c.displayName === id)) c.displayName = humanizeId(c.displayName === id ? id : c.displayName);
  const names: Record<string, string> = Object.fromEntries(ids.map((id) => [id, set.cast[id]?.displayName ?? humanizeId(id)]));
  const fix = (t: string) => ids.reduce((s, id) => s.split(id).join(names[id]), String(t ?? ""));
  const castWords = Object.values(set.cast).map((c) => c.displayName);
  for (const s of Object.values(set.settings)) {
    if (s.source !== "structured") continue;
    for (const v of Object.values(s.variants)) {
      for (const k of ["background", "midground", "foreground", "palette", "signatureObjects", "lighting"] as const) v[k] = fix(v[k]);
      // A setting describes only the place: a layer with a person in it is replaced.
      for (const k of ["background", "midground", "foreground"] as const) if (PERSON_IN_SETTING.test(v[k]) || castWords.some((w) => v[k].includes(w))) v[k] = k === "foreground" ? "open ground" : "an empty stretch of the same place";
    }
  }
  for (const p of Object.values(set.props)) {
    if (p.source === "structured") p.block = fix(p.block);
    p.block = plainWords(p.block);
  }
  return set;
}

// Words that mislead the image model into drawing something else
// ("spectacled" drew eyeglasses on a face inside the helmet).
const PLAIN_WORDS: [RegExp, string][] = [
  [/\b(?:a |an |the )?(?:spectacle[- ]shaped|spectacled|spectacle)\s+(?:eye[- ]?)?guard\b(?:\s+curving over the eyes(?: and nose)?)?/gi, "a goggle-shaped iron eye-and-nose guard"],
  // An object that "sits" gets legs (5a beat 128: a helmet with little feet).
  [/\b(helmets?|helmet cases?|skulls?|books?|objects?|artifacts?) sits?\b/gi, "$1 rests"],
  [/\bsits (alone|under glass|on (?:a|the) (?:pedestal|plinth|shelf|stand))\b/gi, "rests $1"],
  // "a carved sun disc" drew a sun with a face (Phase 4d beat 58).
  [/\b(sun discs?)\b(?! with plain)/gi, "$1 with plain straight rays and no face"],
];
export function plainWords(text: string): string {
  return PLAIN_WORDS.reduce((s, [re, to]) => s.replace(re, to), String(text ?? ""));
}

// The name a prop block starts with ("The Gjermundbu helmet: …" -> "the Gjermundbu helmet").
export function propName(block: string): string {
  const head = String(block ?? "").split(":")[0].trim();
  return head.length && head.length <= 60 ? head.replace(/^(The|A|An)\b/, (w) => w.toLowerCase()) : "";
}

// A beat's settingVariant (free text from the director) -> a canonical
// variant: the variant whose name appears in it, else "default".
export function pickVariant(variants: Record<string, SettingVariant>, wanted: string | null | undefined): string {
  const w = String(wanted ?? "").toLowerCase();
  return Object.keys(variants).find((k) => k !== "default" && w.includes(k.toLowerCase())) ?? "default";
}

/* ============================ Frame / text ============================ */

const TREATMENT_PHRASE: Record<string, string> = {
  STORY_SCENE: "A story scene", REACTION: "A reaction shot", POV: "A first-person point-of-view shot", ESTABLISHING: "A wide establishing view",
  OBJECT_DETAIL: "A close object detail", SYMBOLIC: "A symbolic illustration", COMPARISON: "A side-by-side comparison", SPLIT: "A split-screen comparison",
  MAP: "A simple flat map", TIMELINE_BAR: "A horizontal timeline bar", SCALE: "A scale comparison", STAT_CARD: "A single stat card",
  ICON_ROW: "A row of simple icons", CROWD: "A crowd scene", CALLBACK: "A callback scene",
  __TIMELINE_V2: "A horizontal timeline with small unlabeled tick marks", __MAP_NO_PEOPLE: "A simple flat map with plain round pin markers",
};
const CAMERA_PHRASE: Record<string, string> = {
  EXTREME_WIDE: "extreme wide shot", WIDE: "wide shot", MEDIUM: "medium shot", CLOSE_UP: "close-up", EXTREME_CLOSE_UP: "extreme close-up",
  OVERHEAD: "overhead view", POV: "point-of-view angle", OVER_THE_SHOULDER: "over-the-shoulder view", LOW_ANGLE: "low-angle view", FLAT_GRAPHIC: "flat graphic layout",
};

export function frameLine(contract: any, concept: string): string {
  const t = TREATMENT_PHRASE[contract.treatment] ?? "A scene";
  const cam = CAMERA_PHRASE[contract.composition?.camera] ?? "medium shot";
  const framing = String(contract.composition?.framing ?? "").trim();
  const c = concept.trim().replace(/[.\s]+$/, "");
  return `${t}, ${cam}${framing ? `, framed as ${framing}` : ""}: ${c} — one single frozen moment.`;
}

const CENTER_TEXT = new Set(["STAT_CARD", "TIMELINE_BAR", "SCALE", "ICON_ROW", "MAP"]);
export function textInstruction(contract: any): string {
  const mode = contract.textIntent?.mode ?? "NO_TEXT";
  if (mode === "SHORT_TEXT") {
    const zone = CENTER_TEXT.has(contract.treatment) ? "centered in the middle of the frame" : "centered across the upper third of the frame";
    return `Exactly one piece of text: "${String(contract.textIntent.text ?? "").trim()}" in heavy bold all-caps yellow letters with a thick black outline, ${zone}. No other text.`;
  }
  // Text drawn later by code: the top zone for SHORT_TEXT overlays (V2, or a
  // V3 fallback), the lower third for editor-rendered charts and labels.
  if (mode === "PROGRAMMATIC") return contract.textIntent?.zone === "top"
    ? `${NO_TEXT_INSTRUCTION} Leave the entire upper third of the frame empty for a later text overlay: only plain flat sky or wall there, with no heads, symbols, question marks or objects reaching into it.`
    : `${NO_TEXT_INSTRUCTION} Keep the lower third of the frame as plain flat background for a later overlay.`;
  return NO_TEXT_INSTRUCTION;
}

/* ============================ People, cases, V2 text (Phase 4d) ============================ */

// Pictures of people (a painting of warriors, a drawn figure) don't put a
// person in the scene; everything else that names people does.
const PICTURE_OF = /\b(?:(?:paintings?|drawings?|sketch(?:es)?|carvings?|canvases|comic panels?|posters?|postcards?|photos?)\s+(?:of|shows?|showing|with|depicting)\b|(?:painted|drawn|sketched|printed|carved)\s+)[^,.;]*/gi;
const LIVE_PEOPLE = /\b(crowds?|audiences?|people|persons?|workers?|painters?|illustrators?|artists?|fans?|figures?|silhouettes?|actors?|warriors?|soldiers?|raiders?|priests?|collectors?|visitors?|viewers?|hands?|man|men|woman|women|child(?:ren)?|stick ?m[ae]n|battle|fights?|brawl|shield ?wall|someone|somebody|archaeologists?|historians?|designers?|composer|mascots?|he|she)\b/i;
export type PeopleMode = "cast" | "live" | "none" | "pictured";
export function peopleMode(contract: any, concept: string): PeopleMode {
  if ((contract.subjects ?? []).length) return "cast";
  if (contract.treatment === "CROWD") return "live";
  const stripped = String(concept ?? "").replace(PICTURE_OF, " ");
  if (LIVE_PEOPLE.test(stripped)) return "live";
  return stripped === concept ? "none" : "pictured";
}

// FLUX filled museum cases with stickmen (Phase 4d review: 21, 38, 73, 130, 136).
const CASE_WORDS = /\b(display cases?|glass cases?|cases?|vitrines?|under glass|pedestals?)\b/i;
const CASE_OBJECT = /\b(?:an?|the|one|lone|single)\s+((?:[\w-]+\s+){0,3}?(?:helmets?|fragments?|skulls?|vases?|bottles?|artifacts?|artefacts?|objects?|relics?|swords?|shields?|books?|postcards?|lunchbox(?:es)?))\b/i;
export function caseLine(text: string, concept: string, propBlocks: string[]): string | null {
  // A mirror in a museum setting was drawn as a display case with a face in it (Phase 4d beat 136).
  if (/\bmirror\b/i.test(concept)) return "The mirror is a simple upright framed mirror on a stand; there is no display case in this image.";
  if (!CASE_WORDS.test(text)) return null;
  const named = propBlocks.map(propName).filter(Boolean);
  const obj = named.length ? named.join(" and ") : concept.match(CASE_OBJECT)?.[1] ?? null;
  return obj ? `The display case contains only ${obj}; no person or stick figure is inside any case.` : "Every display case contains only objects; no person or stick figure is inside any case.";
}

// V2: every letter comes from the overlay, so the concept loses its text
// phrases and digits ("Timeline dot 1948" drew "1948 1948").
const NUMBER_TOKEN = /\b(?:c\.\s*)?\d[\d,.]*(?:\s*(?:–|-|to)\s*\d[\d,.]*)?(?:\s*(?:BCE|CE|AD|BC))?(?![\w])/g;
export function scrubForNoText(concept: string): string {
  let out = String(concept ?? "");
  const phrase = findTextPhrase(out);
  if (phrase) out = out.replace(phrase.match, "");
  // Capitalized strings are text ("both stamped SOLD OUT of nothing"), with or without a verb.
  out = out.replace(/,?\s*\b(?:both\s+)?(?:stamped|marked|labell?ed|reading|saying|printed)\s+(?:[A-Z0-9][A-Z0-9'’!?.-]*\s*){1,6}(?:of nothing)?/g, "").replace(/\b[A-Z]{2,}(?:\s+[A-Z]{2,})+\b/g, "");
  out = neutralizeText(out).replace(NUMBER_TOKEN, "");
  // Words left dangling where a number was ("highlighting", "lands on").
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = tidy(out).replace(/\s+(?:on|at|of|to|from|around|along|marking|dated|reading|labeled|highlighting|showing|lands|and)\s*$/i, "");
  }
  return tidy(out);
}
// Setting blocks written for text-capable tiers invite lettering ("black for
// text", "a label rectangle"): V2 drops the text role and blanks the labels.
// Phase 6e-fix proof: "a small display blank label strip", "labeled butchered
// bones" and "small labeled mounts" still drew caption cards with the prompt's
// own words (f90160bc 54/87/88) — label strips/cards are dropped outright and
// "labeled" objects are just the objects.
// The words written ON an object, for a no-text picture (596af432: "a red label reading
// NON-REFUND", "a card with the handwritten label 'NON-REFUND / Must decide by [date]'", "an
// envelope 'bonus'"): "reading/saying/marked X", quoted strings and ALL-CAPS words go; the
// object stays (and V2_BLANK makes its label blank).
export function stripWrittenText(block: string): string {
  return tidy(String(block ?? "")
    .replace(/\s*\b(?:reading|saying|that says|which says|with the words?|marked|stamped|labell?ed|titled|captioned)\s+(?:['"‘’“”][^'"‘’“”]{1,80}['"‘’“”]|[A-Z0-9][A-Z0-9'’!?.\/&$%-]*(?:\s+[A-Z0-9][A-Z0-9'’!?.\/&$%-]*){0,7})/g, "")
    .replace(/(^|[\s(])['‘“"][^'’”"]{1,80}['’”"](?=[\s.,;:)]|$)/g, "$1")
    .replace(/\b[A-Z]{2,}(?:[-\/][A-Z]{2,})+\b/g, "")
    .replace(/\b[A-Z]{2,}(?:\s+[A-Z]{2,})+\b/g, "")
    .replace(/\[[^\]]{1,30}\]/g, ""));
}
export function scrubSettingForNoText(block: string): string {
  return tidy(stripWrittenText(String(block ?? ""))
    .replace(/,?\s*[\w-]+ for (?:text|labels?|lettering)\b/gi, "")
    .replace(/,?\s*(?:with\s+)?(?:an?\s+)?(?:small\s+|tiny\s+)?(?:display\s+)?(?:blank\s+)?(?:labels?|captions?|name|price)\s+(?:strips?|cards?|plaques?|tags?|plates?)\b/gi, "")
    .replace(/\b(?:labell?ed|captioned|tagged)\s+/gi, "")
    .replace(/\b(?<!blank )(labels?)\b/gi, "blank $1"));
}
export const V2_NO_TEXT_INSTRUCTION = "No letters, numbers or labels anywhere in the image; all text is added later as an overlay. No caption cards, tags or name plates beside objects. Every label, sign, stamp, poster, postcard, banner, marquee, book cover, book spine, book page or manuscript is blank or shows only wavy scribble lines.";
// Phase 5a: text-bearing objects are described as blank in the V2 concept
// ("a beer label" drew BOBER BEER, "a manuscript" drew letters).
const LABEL_OWNERS = "beer|museum|price|shop|wine|bottle|name|luggage|tourist|souvenir|gift";
const V2_BLANK: [RegExp, string][] = [
  [new RegExp(`\\b(?<!blank )(${LABEL_OWNERS})[- ](labels?|stamps?|posters?|tickets?|tags?)\\b`, "gi"), "blank $1 $2"],
  [new RegExp(`\\b(?<!blank |${LABEL_OWNERS.split("|").map((w) => `${w} `).join("|")})(labels?|stamps?|posters?|tickets?)\\b`, "gi"), "blank $1"],
  [/\b(?<!comic-book |comic |comic-)(manuscripts?|book pages?|pages)\b(?! of wavy)/gi, "$1 of wavy scribble lines"],
  // Named texts get their name written on them (5a beat 42 drew STACK OF SAGAS).
  [/\b(?:stack|pile) of sagas\b/gi, "stack of plain old books with blank covers and spines"],
  [/\bsagas?\b/gi, "plain old book"],
  // Written-out quantities and stamping are drawn as digits and lettering.
  [/\bzero\b/gi, "empty ring"],
  [/\bstamped (across|over|on)\b/gi, "drawn as a flat picture $1"],
  [/\b(postcards?)\b(?!\s+(?:rack|stand|with only))/gi, "$1 with only a simple picture and no writing"],
];
export function blankTextObjects(concept: string): string {
  return V2_BLANK.reduce((s, [re, to]) => s.replace(re, to), String(concept ?? ""));
}
export const UNLABELED_TIMELINE = "The timeline is one plain line with small unlabeled tick marks and dots.";

// Phase 6e-fix (from the f90160bc review: 10 uninvited split screens / comic
// collages, and realistic hands/toes/anatomy in POV and close-up beats).
export const SINGLE_FRAME_RULE = "One single continuous picture filling the whole frame — not a comic grid, not panels, no borders, no split screen, no inset boxes.";
export const TWO_HALVES_RULE = "Exactly two halves side by side, divided by one thin vertical line — never more than two panels, never a comic grid.";
export const HAND_RULE = "Hands, arms and feet are stickman parts: solid black rounded mitten hands and feet at the ends of thin black stick lines — no realistic skin, fingers, nails, toes, knuckles, muscles or anatomy, even up close; a body-part close-up is a flat, simple stick-line drawing, never a medical illustration.";
const BODY_PART = /\b(hands?|palms?|fists?|fingers?|thumbs?|thumbnails?|arms?|foot|feet|toes?|legs?|tendons?|skin|knees?|heels?|soles?|ankles?|wrists?)\b/i;
export function needsHandRule(c: any, concept: string): boolean {
  if ((c.subjects ?? []).some((s: any) => s.presence === "hands")) return true;
  const cam = String(c.composition?.camera ?? "");
  return cam === "POV" || ((cam === "CLOSE_UP" || cam === "EXTREME_CLOSE_UP") && BODY_PART.test(concept)) || /\b(close[- ]?up|macro)\b/i.test(concept) && BODY_PART.test(concept);
}
export function frameRuleFor(c: any, composite: boolean): string {
  return c.treatment === "SPLIT" || c.treatment === "COMPARISON" ? (composite ? SINGLE_FRAME_RULE : TWO_HALVES_RULE) : SINGLE_FRAME_RULE;
}
export const unlabelProp = (block: string) => scrubSettingForNoText(blankTextObjects(stripWrittenText(block)));

/* ============================ Lints ============================ */

export type RendererConfig = { name: string; supportsNegativePrompt: boolean; warnChars: number; hardChars: number };
export const DEFAULT_RENDERER: RendererConfig = { name: "default", supportsNegativePrompt: false, warnChars: 2000, hardChars: 4000 };

const ID_PATTERN = /\b(cast|set|prop|motif|viewer)_\w+/i;
// Back-references to other images only — "an earlier point on the timeline" or
// "decades earlier" is content, not a reference (Phase 4c false positive).
const RELATIVE = /\b(same as|as before|again|the character|(?:shown|seen|drawn|pictured) (?:earlier|before|previously)|the (?:earlier|previous) (?:beat|scene|image|shot|frame|panel|picture)|previous (?:beat|scene|image|shot|frame|panel))\b/i;
const FACE_FEATURES = /\b(beard|mustache|moustache|stubble|teeth|eyelash(es)?|pupils?|lips|wrinkles?|nostrils?)\b/i;
// Clothing that gives stick limbs volume (every model drew chunky bodies from these).
export const BODY_VOLUME = /\b(trousers|pants|leggings|jeans|sleeves to the wrist|long sleeves|boots to the knee|knee[- ]high boots)\b/i;
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export function lintPrompt(prompt: string, textSection: string, ctx: { bibleIds: string[]; requiredBlocks: string[]; castBlocks?: string[] }): string[] {
  const errors: string[] = [];
  const id = prompt.match(ID_PATTERN);
  if (id) errors.push(`internal_id: "${id[0]}"`);
  for (const bid of ctx.bibleIds) if (/[_\d]/.test(bid) && prompt.includes(bid)) errors.push(`internal_id: "${bid}"`);
  const rel = prompt.match(RELATIVE);
  if (rel) errors.push(`relative_reference: "${rel[0]}"`);
  const outside = prompt.replace(textSection, "");
  if (/["“”]/.test(outside)) errors.push("quoted_string_outside_text");
  const face = prompt.match(FACE_FEATURES);
  if (face) errors.push(`face_modifier_not_allowed: "${face[0]}"`);
  // Phase 4b: cast blocks describe a torso shape only — limbs stay stick lines.
  for (const b of ctx.castBlocks ?? []) {
    const v = b.match(BODY_VOLUME);
    if (v) errors.push(`cast_block_volume: "${v[0]}"`);
  }
  for (const b of ctx.requiredBlocks) if (!prompt.includes(b)) errors.push(`canonical_block_missing_or_altered: "${b.slice(0, 50)}…"`);
  return [...new Set(errors)];
}

/* ============================ Compile ============================ */

export type CompiledPrompt = {
  sequence: number;
  startMs: number;
  endMs: number;
  narration: string;
  userSummary: string;
  treatment: string;
  renderPolicy: "SINGLE" | "COMPOSITE_SPLIT";
  prompt: string;
  positivePrompt: string;
  negativePrompt: string;
  textIntent: { mode: string; text: string | null };
  halves?: { side: "left" | "right"; prompt: string; positivePrompt: string; chars: number }[];
  chars: number;
  estTokens: number;
  trimmed: string[];
  blocksUsed: string[];
  conceptSanitized: boolean;
  textResolution: TextResolution | null;
  lintErrors: string[];
  lintWarnings: string[];
};

// Internal ids that slipped into a concept are replaced by the cast's display
// name (deterministic); unknown viewer_* ids become "The viewer".
function sanitizeConcept(concept: string, set: CanonicalSet): { text: string; changed: boolean } {
  let text = String(concept ?? "");
  // Only id-shaped ids (underscore/digit): "archaeologist" is also a plain word.
  for (const [id, c] of Object.entries(set.cast)) if (/[_\d]/.test(id)) text = text.split(new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")).join(c.displayName);
  text = text.replace(/\bviewer_\w+/gi, "The viewer");
  return { text, changed: text !== concept };
}

function assemble(parts: { header?: string; frame: string; subjects: string[]; props: string[]; setting: string; lighting: string | null; rules?: string[]; text: string }, renderer: RendererConfig) {
  const positive = [parts.header ?? STYLE_HEADER, parts.frame, ...(parts.subjects.length ? [`Subjects: ${parts.subjects.join(" ")}`] : []), ...(parts.props.length ? [`Props: ${parts.props.join(" ")}`] : []), parts.setting, ...(parts.lighting ? [parts.lighting] : []), ...(parts.rules ?? []), parts.text].join("\n");
  const prompt = renderer.supportsNegativePrompt ? positive : `${positive}\n${AVOID_TAIL}`;
  return { positive, prompt };
}

/* ============================ Text leaks, faces, layout ============================ */

// "a costume rack labeled MYTH": the concept implies readable text while the
// beat renders none. Deterministic fix — never a contradictory instruction:
// a <= 5-word string becomes SHORT_TEXT when the plan's text allowance has
// room, otherwise the text phrase is stripped; bare text-bearing nouns are
// made blank ("a blank sign").
// A text phrase: verb + the string itself. "reads/says/titled…" always take
// content; "labeled/marked/captioned/stamped with" only when the string looks
// like text (quoted, capitals or digits) or follows a noun — "a single labeled
// helmet" is an adjective, not a label.
const TEXT_VERBS_CONTENT = "reads?|reading|says|saying|titled|spelling out";
const TEXT_VERBS_TAG = "labell?ed|marked|captioned|stamped with";
const TEXT_PHRASE = new RegExp(`(\\s*,?\\s*)\\b(${TEXT_VERBS_CONTENT}|${TEXT_VERBS_TAG})\\s+["“]?([^,.;"”]+?)["”]?(?=\\s*(?:[,.;]|$))`, "i");
const DETERMINERS = /^(a|an|the|one|single|each|every|some|small|big|little|tiny|two|three|several|many|old|new)$/i;
const TEXT_NOUNS = "signs?|signposts?|banners?|marquees?|captions?|headlines?|titles?|placards?";
function wordBefore(text: string, index: number): string {
  const m = text.slice(0, index).trim().match(/(\S+)$/);
  return m ? m[1].replace(/[^\w'-]/g, "") : "";
}
function findTextPhrase(concept: string): { match: string; text: string } | null {
  const m = TEXT_PHRASE.exec(concept);
  if (!m) return null;
  const verb = m[2].toLowerCase();
  const text = m[3].trim();
  const words = text.split(/\s+/).length;
  const looksLikeText = /["“]/.test(m[0]) || /[A-Z0-9]/.test(text);
  const isContentVerb = new RegExp(`^(${TEXT_VERBS_CONTENT})$`, "i").test(verb);
  const before = wordBefore(concept, m.index + m[1].length);
  if (!isContentVerb && !looksLikeText && (!before || DETERMINERS.test(before))) return null; // adjective use
  if (words > (looksLikeText ? 8 : 5)) return null;
  return { match: m[0], text: text.replace(/^["“]|["”]$/g, "") };
}
// Bare text-bearing words become text-free, deterministically.
const NEUTRALIZE: [RegExp, string][] = [
  [/\bcrossed[- ]out\b/gi, "red-crossed"],
  [new RegExp(`\\b(?<!blank )(${TEXT_NOUNS})\\b`, "gi"), "blank $1"],
  [/\bwritten\b/gi, "drawn"],
  [/\b(words?|lettering)\b/gi, "marks"],
  [new RegExp(`\\b(${TEXT_VERBS_CONTENT}|${TEXT_VERBS_TAG})\\s+`, "gi"), ""],
];
const tidy = (s: string) => s.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
export function neutralizeText(s: string): string {
  let out = s;
  for (const [re, to] of NEUTRALIZE) out = out.replace(re, to);
  return tidy(out);
}
export function textImplied(concept: string): boolean {
  return TEXT_IMPLIED.test(String(concept ?? "").replace(new RegExp(`\\bblank (${TEXT_NOUNS})\\b`, "gi"), ""));
}
export type TextResolution = { action: "converted" | "stripped" | "neutralized"; from: string; to: string; text?: string };
// Resolves the concept AND the framing (both reach the frame line). Only the
// concept can become SHORT_TEXT; everything else is made text-free.
export function resolveTextLeak(contract: any, concept: string, canAddShortText: () => boolean): { contract: any; concept: string; resolution: TextResolution | null } {
  const mode = contract.textIntent?.mode ?? "NO_TEXT";
  const framing = String(contract.composition?.framing ?? "");
  if (mode === "SHORT_TEXT" || (!textImplied(concept) && !textImplied(framing))) return { contract, concept, resolution: null };
  const fixedFraming = textImplied(framing) ? neutralizeText(framing) : framing;
  const withFraming = (c: any) => (fixedFraming === framing ? c : { ...c, composition: { ...c.composition, framing: fixedFraming } });
  const phrase = findTextPhrase(concept);
  // A lone "?" / "!" over a head is a drawn symbol, not text (Phase 4a).
  const qmark = false;
  const fits = phrase ? phrase.text.split(/\s+/).length <= 5 : true;
  if ((phrase || qmark) && fits && mode === "NO_TEXT" && canAddShortText()) {
    const text = phrase ? phrase.text : "?";
    const to = phrase ? tidy(concept.replace(phrase.match, "")) : concept;
    return { contract: withFraming({ ...contract, textIntent: { mode: "SHORT_TEXT", text } }), concept: to, resolution: { action: "converted", from: concept, to, text } };
  }
  let to = phrase ? tidy(concept.replace(phrase.match, "")) : concept;
  if (textImplied(to)) to = neutralizeText(to);
  return { contract: withFraming(contract), concept: to || concept, resolution: { action: phrase ? "stripped" : "neutralized", from: concept, to } };
}
// Drawn "?" / "!" symbols (over a head or floating) — removed from the concept
// of any beat that carries headline text.
const DRAWN_SYMBOL = /,?\s*(?:with\s+)?(?:an?\s+|the\s+)?(?:big\s+|small\s+|floating\s+|giant\s+|little\s+)?(?:question|exclamation)\s+marks?(?:\s+floating)?(?:\s+(?:over|above|beside|next to)\s+[^,.;]+)?/gi;
export function dropDrawnSymbols(concept: string): string {
  return String(concept ?? "").replace(DRAWN_SYMBOL, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
}

// Expression word -> explicit face construction, using only the style's own
// parts (dot eyes, eyebrows, mouth line) and the allowed modifiers.
export const FACE_MAP: [RegExp, string][] = [
  [/\b(shock(ed)?|surprised?|stunned|astonished|amazed|gasp)/i, "eyebrows shot high, wide open-mouth oval, small motion lines"],
  [/\b(scared|afraid|terrified|fearful|frightened|panic)/i, "eyebrows angled up in the middle, small open-mouth oval, sweat drops"],
  [/\b(worried|anxious|nervous|uneasy|tense)/i, "eyebrows angled up in the middle, small wavy mouth line"],
  [/\b(angry|furious|mad|enraged|grim|fierce)/i, "eyebrows angled sharply down, mouth a tight downward curve"],
  [/\b(shout(ing)?|yell(ing)?|scream(ing)?|roar(ing)?|battle cry|charging)/i, "eyebrows angled sharply down, wide open-mouth oval, small motion lines"],
  [/\b(smug|sly|knowing|satisfied)/i, "one eyebrow raised, lopsided upward mouth curve"],
  [/\b(skeptical|doubtful|suspicious|unconvinced)/i, "one eyebrow raised, flat slanted mouth line"],
  [/\b(confused|puzzled|questioning|uncertain|unsure|baffled)/i, "one eyebrow raised and one lowered, small wavy mouth line"],
  [/\b(curious|intrigued|inquisitive|interested|wonder)/i, "eyebrows raised, small open-mouth oval"],
  [/\b(sad|disappointed|gloomy|dejected|unhappy)/i, "eyebrows angled up in the middle, small downward mouth curve"],
  [/\b(crying|tearful|weeping)/i, "eyebrows angled up in the middle, small downward mouth curve, tear drops"],
  [/\b(amused|laughing|happy|delighted|smiling|cheerful|triumphant)/i, "closed-eye curved lines, wide upward mouth curve"],
  [/\b(excited|thrilled|eager)/i, "eyebrows raised high, wide upward open-mouth oval"],
  [/\b(confident|proud|certain|assured|obvious)/i, "eyebrows level, small upward mouth curve"],
  [/\b(determined|focused|resolute|intent|concentrat)/i, "eyebrows slightly lowered, mouth a firm straight line"],
  [/\b(tired|exhausted|weary|sleepy)/i, "closed-eye curved lines, small flat mouth line, sweat drops"],
  [/\b(disgusted|repulsed|grossed)/i, "eyebrows pulled down, mouth a wavy downward curve"],
  [/\b(embarrassed|sheepish|awkward)/i, "eyebrows angled up, small wavy mouth line, sweat drops"],
  [/\b(deadpan|neutral|flat|unimpressed|bored|calm|unquestioning)/i, "eyebrows level, small straight mouth line"],
];
export const NEUTRAL_FACE = "eyebrows relaxed, small neutral mouth line";
export function faceFor(expression: string, action = ""): string {
  const e = String(expression ?? "");
  for (const [re, face] of FACE_MAP) if (re.test(e)) return face;
  for (const [re, face] of FACE_MAP) if (re.test(action)) return face;
  return NEUTRAL_FACE;
}

// Where each person stands when 2+ are on screen: the director's position,
// else first left, second right, third center; tiny figures in the background.
const POSITION_PREFIX: Record<string, string> = { left: "On the left: ", right: "On the right: ", center: "In the center: ", foreground: "In the foreground: ", background: "In the background: " };
export function layoutFor(subjects: any[]): string[] {
  if (subjects.length < 2) return subjects.map(() => "");
  const defaults = ["left", "right", "center", "foreground", "background"];
  return subjects.map((s, k) => POSITION_PREFIX[s.position ?? (s.presence === "tiny" ? "background" : defaults[k] ?? "background")]);
}

// noTextAnywhere (V2): the model draws no letters or digits at all — every
// piece of text is a later overlay, and timelines use unlabeled tick marks.
export function compileBeatPrompt(beat: { sequence: number; startMs: number; endMs: number; narrationText: string; contract: any }, set: CanonicalSet, opts: { renderer?: RendererConfig; plantFrame?: string | null; bibleIds?: string[]; canAddShortText?: () => boolean; noTextAnywhere?: boolean } = {}): CompiledPrompt {
  const renderer = opts.renderer ?? DEFAULT_RENDERER;
  const sanitized = sanitizeConcept(plainWords(beat.contract.visualConcept), set);
  const leak = resolveTextLeak(beat.contract, sanitized.text, opts.canAddShortText ?? (() => false));
  const c = leak.contract;
  // A beat with headline text never also gets a drawn "?" / "!" over a head —
  // it collided with the headline in every Phase 4c variant.
  const textBeat = c.textIntent?.mode === "SHORT_TEXT" || (c.textIntent?.mode === "PROGRAMMATIC" && c.textIntent?.zone === "top");
  const symbolFree = textBeat ? dropDrawnSymbols(leak.concept) : leak.concept;
  const concept = opts.noTextAnywhere ? blankTextObjects(scrubForNoText(symbolFree) || symbolFree) : symbolFree;
  const changed = sanitized.changed;
  const people = peopleMode(c, concept);
  // The cast decides, nothing else: no cast -> no stickman paragraph + the no-people sentence.
  const noPeople = people !== "cast";
  const header = noPeople ? NO_PEOPLE_STYLE_HEADER : STYLE_HEADER;
  const frameC = opts.noTextAnywhere && c.treatment === "TIMELINE_BAR" ? { ...c, treatment: "__TIMELINE_V2" } : noPeople && c.treatment === "MAP" ? { ...c, treatment: "__MAP_NO_PEOPLE" } : c;
  const frame = c.treatment === "CALLBACK" && opts.plantFrame ? opts.plantFrame : frameLine(frameC, concept);

  const blocksUsed: string[] = [];
  // A prop's text exactly as it goes into the prompt — unlabelled when no text is wanted — and
  // that same text is what the lint requires. (596af432: the prompt had the unlabelled prop but the
  // lint required the labelled one, so 8 scenes with a screen/card failed every draw and redraw.)
  const usePropBlock = (p: string) => { const b = opts.noTextAnywhere ? unlabelProp(set.props[p].block) : set.props[p].block; blocksUsed.push(b); return b; };
  const castBlocks: string[] = [];
  const carried = new Set<string>();
  const positions = layoutFor(c.subjects ?? []);
  const subjects = (c.subjects ?? []).map((s: any, k: number) => {
    const base = set.cast[s.castId];
    if (!base) return `(unknown cast ${s.castId})`;
    // An outfit variant is a FULL identity of its own, never "same but…".
    const who = (s.outfit && base.variants?.[s.outfit]) || base;
    const block = castBlock(who, (s.presence ?? "full") as Presence);
    blocksUsed.push(block);
    castBlocks.push(block);
    const worn = (s.wearing ?? []).filter((p: string) => set.props[p]).map((p: string) => { carried.add(p); return ` Wearing: ${usePropBlock(p)}`; }).join("");
    const held = (s.holding ?? []).filter((p: string) => set.props[p]).map((p: string) => { carried.add(p); return ` Holding: ${usePropBlock(p)}`; }).join("");
    const action = String(s.action ?? "").trim();
    const face = s.presence === "hands" || s.presence === "back" ? "" : ` Face: ${faceFor(s.expression, action)}.`;
    return `${positions[k]}${block}${worn}${held}${action ? ` Pose: ${action}.` : ""}${face}`;
  });
  // Phase 6e-fix: with no text wanted, props are unlabelled ("labelled trays" drew "Butchered bones").
  const props = (c.propIds ?? []).filter((p: string) => set.props[p] && !carried.has(p)).map((p: string) => usePropBlock(p));
  const baseText = opts.noTextAnywhere && c.textIntent?.mode === "SHORT_TEXT" ? textInstruction({ ...c, textIntent: { ...c.textIntent, mode: "PROGRAMMATIC", zone: "top" } }) : textInstruction(c);
  const text = opts.noTextAnywhere
    ? `${baseText.replace(NO_TEXT_INSTRUCTION, V2_NO_TEXT_INSTRUCTION)}${c.treatment === "TIMELINE_BAR" ? ` ${UNLABELED_TIMELINE}` : ""}`
    : baseText;
  const peopleRule = people === "cast" ? null : people === "pictured" ? PICTURED_PEOPLE_RULE : NO_PEOPLE_RULE;
  const allPropBlocks = (c.propIds ?? []).filter((p: string) => set.props[p]).map((p: string) => set.props[p].block);
  const compositeSplit = Array.isArray(c.splitSettings) && c.splitSettings.length === 2 && (c.treatment === "SPLIT" || c.treatment === "COMPARISON");
  const rulesFor = (settingText: string) => [peopleRule, caseLine(`${concept} ${c.composition?.framing ?? ""} ${settingText}`, concept, allPropBlocks), frameRuleFor(c, compositeSplit), needsHandRule(c, concept) ? HAND_RULE : null].filter((r): r is string => !!r);

  const buildSetting = (settingId: string | null, dropMidground: boolean) => {
    const s = settingId ? set.settings[settingId] : null;
    if (!s) return { block: GRAPHIC_TREATMENTS.has(c.treatment) ? NO_SETTING_BLOCK : OWN_PLACE_SETTING_BLOCK, lighting: null as string | null };
    const v = s.variants[pickVariant(s.variants, c.settingVariant)];
    const block = settingBlock(s.name, v, { dropMidground });
    return { block: opts.noTextAnywhere ? scrubSettingForNoText(block) : block, lighting: v.lighting ? lightingLine(v) : null };
  };

  const compileOne = (settingId: string | null, frameText: string) => {
    const trimmed: string[] = [];
    let st = buildSetting(settingId, false);
    let lighting = st.lighting;
    const rules = rulesFor(st.block);
    let out = assemble({ header, frame: frameText, subjects, props, setting: st.block, lighting, rules, text }, renderer);
    // Trim order when over the hard budget: setting midground -> lighting.
    // Never the style header, cast identity or text instruction.
    if (out.prompt.length > renderer.hardChars && settingId) {
      st = buildSetting(settingId, true);
      trimmed.push("setting_midground");
      out = assemble({ header, frame: frameText, subjects, props, setting: st.block, lighting, rules, text }, renderer);
    }
    if (out.prompt.length > renderer.hardChars && lighting) {
      lighting = null;
      trimmed.push("lighting");
      out = assemble({ header, frame: frameText, subjects, props, setting: st.block, lighting, rules, text }, renderer);
    }
    return { ...out, trimmed, settingBlock: st.block };
  };

  const splitSettings: string[] | null = Array.isArray(c.splitSettings) && c.splitSettings.length === 2 && (c.treatment === "SPLIT" || c.treatment === "COMPARISON") ? c.splitSettings : null;
  const main = compileOne(splitSettings ? splitSettings[0] : c.settingId ?? null, frame);
  const bibleIds = opts.bibleIds ?? [];
  const lintErrors = lintPrompt(main.prompt, text, { bibleIds, requiredBlocks: blocksUsed, castBlocks });
  const lintWarnings: string[] = [];
  if (main.prompt.length > renderer.warnChars) lintWarnings.push(`over_${renderer.warnChars}_chars`);
  // Never a contradictory text instruction: after resolution, a beat that
  // renders no text must not imply any (HARD).
  if (c.textIntent?.mode !== "SHORT_TEXT" && textImplied(frame)) lintErrors.push("text_contradiction");
  if (c.textIntent?.mode === "SHORT_TEXT" && String(c.textIntent.text ?? "").trim().split(/\s+/).length > 5) lintErrors.push("short_text_over_5_words");
  if (main.prompt.length > renderer.hardChars) lintErrors.push(`over_${renderer.hardChars}_chars`);
  for (const [id, cast] of Object.entries(set.cast)) if ((c.subjects ?? []).some((s: any) => s.castId === id) && cast.source === "prose") lintWarnings.push(`cast_from_prose_fallback: ${id}`);
  if ((c.subjects ?? []).some((s: any) => !set.cast[s.castId])) lintErrors.push("cast_unknown");
  // Phase 4d IP guard (HARD): the image never shows a real brand, team or
  // copyrighted character — the narration may name them, the prompt may not.
  const ip = main.positive.match(IP_MARKS) ?? main.positive.match(IP_LOOKALIKE);
  if (ip) lintErrors.push(`ip_reference: "${ip[0].slice(0, 60)}"`);
  // Header contract (HARD): the stickman paragraph iff the beat has cast.
  const hasCast = people === "cast";
  if (!main.positive.startsWith(STYLE_GLOBAL)) lintErrors.push("style_global_missing");
  if (main.positive.includes(STYLE_PEOPLE) !== hasCast) lintErrors.push(hasCast ? "stickman_paragraph_missing" : "stickman_paragraph_without_cast");
  if (!hasCast && !main.positive.includes("no stick figures")) lintErrors.push("no_people_sentence_missing");
  // An empty-cast concept that names live people contradicts the no-people sentence (warning).
  if (people === "live") lintWarnings.push("people_named_without_cast");

  let halves: CompiledPrompt["halves"];
  if (splitSettings) {
    // Two standalone half-prompts, composited later by code.
    const concepts: string[] = Array.isArray(c.splitConcepts) && c.splitConcepts.length === 2 ? c.splitConcepts : [concept, concept];
    halves = (["left", "right"] as const).map((side, k) => {
      const halfFrame = frameLine({ ...c, treatment: "STORY_SCENE" }, sanitizeConcept(concepts[k], set).text).replace(/^A story scene/, `The ${side} half of a split comparison (a standalone 8:9 panel)`);
      const h = compileOne(splitSettings[k], halfFrame);
      for (const e of lintPrompt(h.prompt, text, { bibleIds, requiredBlocks: blocksUsed, castBlocks })) lintErrors.push(`${side}: ${e}`);
      return { side, prompt: h.prompt, positivePrompt: h.positive, chars: h.prompt.length };
    });
  }

  return {
    sequence: beat.sequence, startMs: beat.startMs, endMs: beat.endMs, narration: beat.narrationText, userSummary: c.userSummary ?? "", treatment: c.treatment,
    renderPolicy: splitSettings ? "COMPOSITE_SPLIT" : "SINGLE",
    prompt: main.prompt, positivePrompt: main.positive, negativePrompt: AVOID_TAIL,
    textIntent: { mode: c.textIntent?.mode ?? "NO_TEXT", text: c.textIntent?.text ?? null },
    ...(halves ? { halves } : {}),
    chars: main.prompt.length, estTokens: estimateTokens(main.prompt), trimmed: main.trimmed, blocksUsed: [...new Set(blocksUsed)],
    conceptSanitized: changed, textResolution: leak.resolution, lintErrors: [...new Set(lintErrors)], lintWarnings,
  };
}

// The frame of the callback's PLANT beat (in the plan's plant segment when
// known, else the first plant) — CALLBACK beats reuse it verbatim.
export function plantFrameFor(beats: any[], set: CanonicalSet, plantWordRange?: [number, number] | null): string | null {
  const plants = beats.filter((b) => b.contract?.motif?.role === "plant" && !b.contract?.needsConcept);
  const plant = (plantWordRange && plants.find((b) => b.startWord >= plantWordRange[0] && b.endWord <= plantWordRange[1])) || plants[0];
  return plant ? frameLine(plant.contract, sanitizeConcept(plant.contract.visualConcept, set).text) : null;
}

// annotations: per-beat subject additions for plans directed before the
// wear/hold/pos fields existed — { [sequence]: { [castId]: { wearing?, holding?, position?, outfit? } } }.
export function compilePlan(beats: any[], bible: any, opts: { fixture?: any; renderer?: RendererConfig; plantWordRange?: [number, number] | null; annotations?: Record<string, Record<string, any>> } = {}) {
  const set = canonicalSetFromBible(bible, opts.fixture);
  if (opts.annotations) {
    beats = beats.map((b) => {
      const ann = opts.annotations![String(b.sequence)];
      if (!ann) return b;
      // "_contract": beat-level overrides (e.g. a revised concept); other keys are per-cast additions.
      const contract = { ...b.contract, ...(ann._contract ?? {}) };
      return { ...b, contract: { ...contract, subjects: (contract.subjects ?? []).map((s: any) => ({ ...s, ...(ann[s.castId] ?? {}) })) } };
    });
  }
  // The plan's SHORT_TEXT allowance (~4/minute) bounds text-leak conversions.
  const live = beats.filter((b) => !b.contract?.needsConcept);
  const minutes = live.length ? (Math.max(...live.map((b) => b.endMs)) - Math.min(...live.map((b) => b.startMs))) / 60_000 : 0;
  let textRoom = Math.floor(minutes * SHORT_TEXT_PER_MINUTE) - live.filter((b) => b.contract?.textIntent?.mode === "SHORT_TEXT").length;
  const canAddShortText = () => (textRoom > 0 ? (textRoom -= 1, true) : false);
  const bibleIds = [...Object.keys(set.cast), ...Object.keys(set.props), ...Object.keys(set.settings)];
  const plantFrame = plantFrameFor(beats, set, opts.plantWordRange ?? null);
  const skipped = beats.filter((b) => b.contract?.needsConcept).map((b) => b.sequence);
  const prompts = live.map((b) => compileBeatPrompt(b, set, { renderer: opts.renderer, plantFrame, bibleIds, canAddShortText }));
  // Canonical integrity across the whole plan: every block that is used is
  // byte-identical in every prompt that uses it.
  const integrity: string[] = [];
  const allBlocks = new Set(prompts.flatMap((p) => p.blocksUsed));
  for (const block of allBlocks) for (const p of prompts) if (p.blocksUsed.includes(block) && !p.prompt.includes(block)) integrity.push(`beat ${p.sequence}: block altered`);
  return { styleContractVersion: STYLE_CONTRACT_VERSION, set, prompts, skipped, integrity };
}
