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
import { buildBibleIndex, TEXT_IMPLIED, SHORT_TEXT_PER_MINUTE } from "./beatDirector.ts";

/* ============================ Style contract (recipe-level) ============================ */

export const STYLE_CONTRACT_VERSION = "STICKMAN_DOODLE_EXPLAINER_V1";

export const STYLE_HEADER = "Flat-color 2D doodle/stickman explainer illustration, 16:9 landscape frame. Uniform thin clean black outlines of identical weight everywhere; flat solid color fills only; no shading, no gradients, no texture, no highlights, no 3D, no photorealism. Every person is a stickman: a perfect circle head with no neck, two small black dot eyes, thin black eyebrows, one curved black mouth line, thin uniform black stick limbs, rounded black mitten hands and feet with no fingers or toes; clothing is simple flat color shapes over the stick body. Environments use two or three flat color layers only.";

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
      return `${c.displayName}, hands only: two rounded black mitten hands with ${c.sleeves}; no body or face in view.`;
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
  return `Setting — ${name}: far background ${v.background};${mid} foreground ${v.foreground}. Flat palette: ${v.palette}. Signature objects: ${v.signatureObjects}.`;
}
export const lightingLine = (v: SettingVariant) => `Lighting: ${v.lighting}.`;
export const NO_SETTING_BLOCK = "Setting: a plain flat off-white background with no scenery.";

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
  return set;
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
  if (mode === "PROGRAMMATIC") return `${NO_TEXT_INSTRUCTION} Keep the lower third of the frame as plain flat background for a later overlay.`;
  return NO_TEXT_INSTRUCTION;
}

/* ============================ Lints ============================ */

export type RendererConfig = { name: string; supportsNegativePrompt: boolean; warnChars: number; hardChars: number };
export const DEFAULT_RENDERER: RendererConfig = { name: "default", supportsNegativePrompt: false, warnChars: 2000, hardChars: 4000 };

const ID_PATTERN = /\b(cast|set|prop|motif|viewer)_\w+/i;
const RELATIVE = /\b(same as|previous|earlier|again|the character|as before)\b/i;
const FACE_FEATURES = /\b(beard|mustache|moustache|stubble|teeth|eyelash(es)?|pupils?|lips|wrinkles?|nostrils?)\b/i;
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export function lintPrompt(prompt: string, textSection: string, ctx: { bibleIds: string[]; requiredBlocks: string[] }): string[] {
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

function assemble(parts: { frame: string; subjects: string[]; props: string[]; setting: string; lighting: string | null; text: string }, renderer: RendererConfig) {
  const positive = [STYLE_HEADER, parts.frame, ...(parts.subjects.length ? [`Subjects: ${parts.subjects.join(" ")}`] : []), ...(parts.props.length ? [`Props: ${parts.props.join(" ")}`] : []), parts.setting, ...(parts.lighting ? [parts.lighting] : []), parts.text].join("\n");
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

export function compileBeatPrompt(beat: { sequence: number; startMs: number; endMs: number; narrationText: string; contract: any }, set: CanonicalSet, opts: { renderer?: RendererConfig; plantFrame?: string | null; bibleIds?: string[]; canAddShortText?: () => boolean } = {}): CompiledPrompt {
  const renderer = opts.renderer ?? DEFAULT_RENDERER;
  const sanitized = sanitizeConcept(beat.contract.visualConcept, set);
  const leak = resolveTextLeak(beat.contract, sanitized.text, opts.canAddShortText ?? (() => false));
  const c = leak.contract;
  const concept = leak.concept;
  const changed = sanitized.changed;
  const frame = c.treatment === "CALLBACK" && opts.plantFrame ? opts.plantFrame : frameLine(c, concept);

  const blocksUsed: string[] = [];
  const carried = new Set<string>();
  const positions = layoutFor(c.subjects ?? []);
  const subjects = (c.subjects ?? []).map((s: any, k: number) => {
    const base = set.cast[s.castId];
    if (!base) return `(unknown cast ${s.castId})`;
    // An outfit variant is a FULL identity of its own, never "same but…".
    const who = (s.outfit && base.variants?.[s.outfit]) || base;
    const block = castBlock(who, (s.presence ?? "full") as Presence);
    blocksUsed.push(block);
    const worn = (s.wearing ?? []).filter((p: string) => set.props[p]).map((p: string) => { carried.add(p); blocksUsed.push(set.props[p].block); return ` Wearing: ${set.props[p].block}`; }).join("");
    const held = (s.holding ?? []).filter((p: string) => set.props[p]).map((p: string) => { carried.add(p); blocksUsed.push(set.props[p].block); return ` Holding: ${set.props[p].block}`; }).join("");
    const action = String(s.action ?? "").trim();
    const face = s.presence === "hands" || s.presence === "back" ? "" : ` Face: ${faceFor(s.expression, action)}.`;
    return `${positions[k]}${block}${worn}${held}${action ? ` Pose: ${action}.` : ""}${face}`;
  });
  const props = (c.propIds ?? []).filter((p: string) => set.props[p] && !carried.has(p)).map((p: string) => { blocksUsed.push(set.props[p].block); return set.props[p].block; });
  const text = textInstruction(c);

  const buildSetting = (settingId: string | null, dropMidground: boolean) => {
    const s = settingId ? set.settings[settingId] : null;
    if (!s) return { block: NO_SETTING_BLOCK, lighting: null as string | null };
    const v = s.variants[pickVariant(s.variants, c.settingVariant)];
    return { block: settingBlock(s.name, v, { dropMidground }), lighting: v.lighting ? lightingLine(v) : null };
  };

  const compileOne = (settingId: string | null, frameText: string) => {
    const trimmed: string[] = [];
    let st = buildSetting(settingId, false);
    let lighting = st.lighting;
    let out = assemble({ frame: frameText, subjects, props, setting: st.block, lighting, text }, renderer);
    // Trim order when over the hard budget: setting midground -> lighting.
    // Never the style header, cast identity or text instruction.
    if (out.prompt.length > renderer.hardChars && settingId) {
      st = buildSetting(settingId, true);
      trimmed.push("setting_midground");
      out = assemble({ frame: frameText, subjects, props, setting: st.block, lighting, text }, renderer);
    }
    if (out.prompt.length > renderer.hardChars && lighting) {
      lighting = null;
      trimmed.push("lighting");
      out = assemble({ frame: frameText, subjects, props, setting: st.block, lighting, text }, renderer);
    }
    return { ...out, trimmed, settingBlock: st.block };
  };

  const splitSettings: string[] | null = Array.isArray(c.splitSettings) && c.splitSettings.length === 2 && (c.treatment === "SPLIT" || c.treatment === "COMPARISON") ? c.splitSettings : null;
  const main = compileOne(splitSettings ? splitSettings[0] : c.settingId ?? null, frame);
  const bibleIds = opts.bibleIds ?? [];
  const lintErrors = lintPrompt(main.prompt, text, { bibleIds, requiredBlocks: blocksUsed });
  const lintWarnings: string[] = [];
  if (main.prompt.length > renderer.warnChars) lintWarnings.push(`over_${renderer.warnChars}_chars`);
  // Never a contradictory text instruction: after resolution, a beat that
  // renders no text must not imply any (HARD).
  if (c.textIntent?.mode !== "SHORT_TEXT" && textImplied(frame)) lintErrors.push("text_contradiction");
  if (c.textIntent?.mode === "SHORT_TEXT" && String(c.textIntent.text ?? "").trim().split(/\s+/).length > 5) lintErrors.push("short_text_over_5_words");
  if (main.prompt.length > renderer.hardChars) lintErrors.push(`over_${renderer.hardChars}_chars`);
  for (const [id, cast] of Object.entries(set.cast)) if ((c.subjects ?? []).some((s: any) => s.castId === id) && cast.source === "prose") lintWarnings.push(`cast_from_prose_fallback: ${id}`);
  if ((c.subjects ?? []).some((s: any) => !set.cast[s.castId])) lintErrors.push("cast_unknown");

  let halves: CompiledPrompt["halves"];
  if (splitSettings) {
    // Two standalone half-prompts, composited later by code.
    const concepts: string[] = Array.isArray(c.splitConcepts) && c.splitConcepts.length === 2 ? c.splitConcepts : [concept, concept];
    halves = (["left", "right"] as const).map((side, k) => {
      const halfFrame = frameLine({ ...c, treatment: "STORY_SCENE" }, sanitizeConcept(concepts[k], set).text).replace(/^A story scene/, `The ${side} half of a split comparison (a standalone 8:9 panel)`);
      const h = compileOne(splitSettings[k], halfFrame);
      for (const e of lintPrompt(h.prompt, text, { bibleIds, requiredBlocks: blocksUsed })) lintErrors.push(`${side}: ${e}`);
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
      return ann ? { ...b, contract: { ...b.contract, subjects: (b.contract.subjects ?? []).map((s: any) => ({ ...s, ...(ann[s.castId] ?? {}) })) } } : b;
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
