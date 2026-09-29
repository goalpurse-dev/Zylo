// deno-lint-ignore-file no-explicit-any
// Phase 3 — standalone prompt compiler, offline ($0).
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  compilePlan, compileBeatPrompt, canonicalSetFromBible, castBlock, lintPrompt, plantFrameFor, frameLine, resolveTextLeak, textImplied, faceFor, layoutFor, FACE_MAP, NEUTRAL_FACE,
  STYLE_HEADER, STYLE_GLOBAL, NO_PEOPLE_STYLE_HEADER, AVOID_TAIL, NO_TEXT_INSTRUCTION, DEFAULT_RENDERER,
} from "../../supabase/functions/_shared/stickman/promptCompiler.ts";
import { validateBible, isSoftBibleError } from "../../supabase/functions/_shared/stickman/productionBible.ts";

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, import.meta.url)));
const recorded = await read("../fixtures/stickman/beats/myth-vs-reality.recorded.json");
const retimed = await read("../fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const fixture = await read("../fixtures/stickman/bibles/myth-vs-reality.canonical.json");
const set = canonicalSetFromBible(recorded.bible, fixture);
const bibleIds = [...Object.keys(set.cast), ...Object.keys(set.props), ...Object.keys(set.settings)];
const SETTING_BATTLE = Object.keys(set.settings).find((k) => k.includes("battlefield"))!;
const SETTING_MUSEUM = Object.keys(set.settings).find((k) => k.includes("museum"))!;
const beat = (contract: any, n = 1) => ({ sequence: n, startMs: 0, endMs: 3000, narrationText: "x", startWord: 0, endWord: 0, contract: { composition: { camera: "MEDIUM", framing: "centered" }, subjects: [], propIds: [], settingId: null, textIntent: { mode: "NO_TEXT", text: null }, motif: { role: "none" }, treatment: "STORY_SCENE", visualConcept: "A warrior stands on a hill", ...contract } });

Deno.test("determinism: the same inputs compile to byte-identical prompts", () => {
  const a = compilePlan(retimed.beats, recorded.bible, { fixture });
  const b = compilePlan(structuredClone(retimed.beats), structuredClone(recorded.bible), { fixture: structuredClone(fixture) });
  assertEquals(JSON.stringify(a.prompts), JSON.stringify(b.prompts));
});

Deno.test("Myth vs Reality: every compiled prompt is standalone — style header first, avoid tail last, no lint failures, canonical integrity", () => {
  const out = compilePlan(retimed.beats, recorded.bible, { fixture });
  assertEquals(out.skipped, [11, 16, 20, 36, 38, 40, 43, 46, 50, 73, 81, 85, 90, 100]);
  assertEquals(out.prompts.length, retimed.beats.length - out.skipped.length);
  // Phase 4d: the only lint failures are the IP guard catching the real team logo this old plan asked for.
  const failing = out.prompts.filter((p) => p.lintErrors.length);
  assert(failing.length > 0 && failing.every((p) => p.lintErrors.every((e) => e.startsWith("ip_reference:"))), JSON.stringify(failing.map((p) => [p.sequence, p.lintErrors])));
  assertEquals(out.integrity, []);
  for (const p of out.prompts) {
    // Beats with nobody on screen get the no-people header (Phase 4d).
    const cast = retimed.beats.find((b: any) => b.sequence === p.sequence).contract.subjects?.length;
    assert(p.prompt.startsWith((cast ? STYLE_HEADER : p.prompt.startsWith(NO_PEOPLE_STYLE_HEADER) ? NO_PEOPLE_STYLE_HEADER : STYLE_HEADER) + "\n"), `beat ${p.sequence}`);
    assert(p.prompt.endsWith("\n" + AVOID_TAIL), `beat ${p.sequence}`);
    for (const s of retimed.beats.find((b: any) => b.sequence === p.sequence).contract.subjects ?? []) assertStringIncludes(p.prompt, set.cast[s.castId].displayName);
  }
});

Deno.test("presence variants are derived in code from the identity fields, and each is byte-identical wherever it is used", () => {
  const w = set.cast.viking_warrior;
  const blocks = (["full", "hands", "back", "tiny"] as const).map((p) => castBlock(w, p));
  assertEquals(new Set(blocks).size, 4);
  assertStringIncludes(blocks[1], "hands only: two rounded black mitten hands at the ends of thin black stick arms");
  const p1 = compileBeatPrompt(beat({ subjects: [{ castId: "viking_warrior", presence: "full", action: "charging", expression: "grim" }] }, 1), set, { bibleIds });
  const p2 = compileBeatPrompt(beat({ treatment: "CROWD", subjects: [{ castId: "viking_warrior", presence: "full", action: "standing", expression: "" }], settingId: SETTING_BATTLE }, 2), set, { bibleIds });
  assertStringIncludes(p1.prompt, blocks[0]);
  assertStringIncludes(p2.prompt, blocks[0]);
});

Deno.test("text modes: NO_TEXT, SHORT_TEXT (exact string + zone), PROGRAMMATIC (no text + a plain zone)", () => {
  assertStringIncludes(compileBeatPrompt(beat({}), set).prompt, NO_TEXT_INSTRUCTION);
  const st = compileBeatPrompt(beat({ textIntent: { mode: "SHORT_TEXT", text: "793 AD" } }), set);
  assertStringIncludes(st.prompt, `Exactly one piece of text: "793 AD" in heavy bold all-caps yellow letters with a thick black outline, centered across the upper third of the frame. No other text.`);
  assert(!st.prompt.includes(NO_TEXT_INSTRUCTION));
  assertStringIncludes(compileBeatPrompt(beat({ treatment: "STAT_CARD", textIntent: { mode: "SHORT_TEXT", text: "5 HELMETS" } }), set).prompt, "centered in the middle of the frame");
  const pr = compileBeatPrompt(beat({ textIntent: { mode: "PROGRAMMATIC", text: "bar chart" } }), set);
  assertStringIncludes(pr.prompt, `${NO_TEXT_INSTRUCTION} Keep the lower third of the frame as plain flat background for a later overlay.`);
  assert(!pr.prompt.includes("bar chart"));
});

Deno.test("lints: internal ids, relative references, quotes outside TEXT, face features, missing/altered canonical blocks", () => {
  const codes = (p: string, blocks: string[] = []) => lintPrompt(p, "", { bibleIds, requiredBlocks: blocks }).map((e) => e.split(":")[0]);
  assertEquals(codes("A viewer_modern shrugs"), ["internal_id"]);
  assert(codes("the gjermundbu_helmet on a plinth").includes("internal_id"));
  assertEquals(codes("The same as before, again"), ["relative_reference"]);
  assertEquals(codes(`A sign reading "MYTH"`), ["quoted_string_outside_text"]);
  assertEquals(codes("a warrior with a thick beard"), ["face_modifier_not_allowed"]);
  assertEquals(codes("A Viking warrior: a stickman", [castBlock(set.cast.viking_warrior, "full")]), ["canonical_block_missing_or_altered"]);
  // A concept that leaked an id is repaired deterministically (beat 15 "Viewer_modern shrugs").
  const b15 = compileBeatPrompt(beat({ visualConcept: "Viewer_modern shrugs, unquestioning" }), set, { bibleIds });
  assert(b15.conceptSanitized && b15.lintErrors.length === 0, JSON.stringify(b15.lintErrors));
  assertStringIncludes(b15.prompt, "The viewer shrugs");
});

Deno.test("split: a SPLIT/COMPARISON with two settings compiles TWO standalone half-prompts (COMPOSITE_SPLIT)", () => {
  const p = compileBeatPrompt(beat({ treatment: "SPLIT", splitSettings: [SETTING_BATTLE, SETTING_MUSEUM], splitConcepts: ["A warrior charges in a plain iron helmet", "The same helmet shape on a museum plinth"].map((x, i) => (i ? "A plain iron helmet on a museum plinth" : x)), subjects: [], propIds: ["gjermundbu_helmet"] }), set, { bibleIds });
  assertEquals(p.renderPolicy, "COMPOSITE_SPLIT");
  assertEquals(p.halves!.map((h) => h.side), ["left", "right"]);
  for (const h of p.halves!) {
    assert(h.prompt.startsWith(STYLE_GLOBAL) && h.prompt.endsWith(AVOID_TAIL)); // no cast: global style only (Phase 4d)
    assertStringIncludes(h.prompt, set.props.gjermundbu_helmet.block);
  }
  assertStringIncludes(p.halves![0].prompt, "Setting — a Viking-age hillside battlefield");
  assertStringIncludes(p.halves![1].prompt, "Setting — a museum gallery");
  assertStringIncludes(p.halves![0].prompt, "The left half of a split comparison");
  assertEquals(p.lintErrors, []);
  assertEquals(compileBeatPrompt(beat({ treatment: "COMPARISON", settingId: SETTING_BATTLE }), set).renderPolicy, "SINGLE");
});

Deno.test("callback: a CALLBACK beat copies the plant beat's frame text verbatim", () => {
  const plant = beat({ treatment: "POV", composition: { camera: "CLOSE_UP", framing: "tight on helmet" }, visualConcept: "Two long curved horns jut from the helmet", motif: { role: "plant" } }, 2);
  const payoff = beat({ treatment: "CALLBACK", composition: { camera: "WIDE", framing: "whatever" }, visualConcept: "Something else entirely", motif: { role: "payoff" } }, 9);
  const frame = plantFrameFor([plant, payoff], set);
  assertEquals(frame, frameLine(plant.contract, plant.contract.visualConcept));
  const p = compileBeatPrompt(payoff, set, { plantFrame: frame });
  assertEquals(p.prompt.split("\n")[1], frame);
  // Myth vs Reality: all CALLBACK beats share the plant's frame line.
  const out = compilePlan(retimed.beats, recorded.bible, { fixture });
  const frames = new Set(out.prompts.filter((x) => x.treatment === "CALLBACK").map((x) => x.prompt.split("\n")[1]));
  assertEquals(frames.size, 1);
});

Deno.test("length budget: trims setting midground, then lighting — never the style header, cast identity or text", () => {
  const b = beat({ subjects: [{ castId: "viking_warrior", presence: "full", action: "charging", expression: "" }], settingId: SETTING_BATTLE, textIntent: { mode: "SHORT_TEXT", text: "793 AD" } });
  const full = compileBeatPrompt(b, set);
  const tight = compileBeatPrompt(b, set, { renderer: { ...DEFAULT_RENDERER, hardChars: full.chars - 50 } });
  assertEquals(tight.trimmed, ["setting_midground"]);
  assert(!tight.prompt.includes("midground"));
  const tighter = compileBeatPrompt(b, set, { renderer: { ...DEFAULT_RENDERER, hardChars: full.chars - 200 } });
  assertEquals(tighter.trimmed, ["setting_midground", "lighting"]);
  for (const keep of [STYLE_HEADER, castBlock(set.cast.viking_warrior, "full"), `"793 AD"`]) assertStringIncludes(tighter.prompt, keep);
  assert(tighter.lintErrors.some((e) => e.startsWith("over_")), "still over budget is a hard lint");
  const neg = compileBeatPrompt(b, set, { renderer: { ...DEFAULT_RENDERER, supportsNegativePrompt: true } });
  assert(!neg.prompt.includes(AVOID_TAIL) && neg.negativePrompt === AVOID_TAIL);
});

Deno.test("prose fallback (no structured fields, no fixture): the frozen bible's own prose is sanitized but flagged", () => {
  const prose = canonicalSetFromBible(recorded.bible);
  assertEquals(Object.values(prose.cast).map((c) => c.source), ["prose", "prose", "prose", "prose", "prose"]);
  assert(!/#[0-9a-f]{6}|objectLanguage|Forbidden/i.test(prose.cast.viking_warrior.outfit), prose.cast.viking_warrior.outfit);
  const out = compilePlan(retimed.beats, recorded.bible, {});
  const withCast = out.prompts.filter((p) => p.lintWarnings.some((w) => w.startsWith("cast_from_prose_fallback")));
  assert(withCast.length > 0);
  console.log(`prose fallback: ${out.prompts.filter((p) => p.lintErrors.length).length} of ${out.prompts.length} prompts fail lints; ${withCast.length} rely on prose cast blocks`);
});

Deno.test("bible: structured prompt blocks — a missing setting block is HARD; ids/hex inside a block are SOFT", () => {
  const withBlocks = {
    ...recorded.bible,
    world: { ...recorded.bible.world, settingBlocks: recorded.bible.world.settingFamilies.slice(1).map((family: string) => ({ family, name: family, variants: [{ name: "default", background: "a", midground: "b", foreground: "c", palette: "grey", signatureObjects: "x", lighting: "soft" }] })) },
    roleArchetypes: recorded.bible.roleArchetypes.map((a: any, i: number) => ({ ...a, identity: { ...fixture.cast[a.id], ...(i === 0 ? { outfit: "a tunic (hex #5A7A52), see objectLanguage" } : {}) } })),
  };
  const errors = validateBible(withBlocks);
  assert(errors.some((e) => e === `SETTING_BLOCK_MISSING:${recorded.bible.world.settingFamilies[0]}`), errors.join("; "));
  assert(!isSoftBibleError(`SETTING_BLOCK_MISSING:x`));
  const standalone = errors.filter((e) => e.startsWith("PROMPT_BLOCK_NOT_STANDALONE"));
  assertEquals(standalone.map((e) => e.split(" — ")[0]), ["PROMPT_BLOCK_NOT_STANDALONE:viewer_viking"]);
  assertStringIncludes(standalone[0], "id, hex code or cross-reference");
  assert(isSoftBibleError(standalone[0]));
  // With structured fields the compiler uses them (no fixture needed).
  const s = canonicalSetFromBible(withBlocks);
  assertEquals(s.cast.viking_warrior.source, "structured");
});

/* ============================ Phase 4a small fixes ============================ */

Deno.test("bible: every person the script names gets a cast entry — kinds of people and named individuals (SOFT, one repair)", async () => {
  const rebuilt = (await read("../fixtures/stickman/bibles/myth-vs-reality.rebuilt-v3.json")).bible;
  const script = recorded.segments.map((s: any) => s.text).join(" ");
  const errs = validateBible(rebuilt, script);
  assert(errs.some((e) => e.startsWith("ROLE_NOT_CAST:archaeologist")), "the archaeologist (2 mentions) is now required");
  for (const name of ["Roberta Frank", "Alex Raymond", "Gustav Malmstrom"]) assert(errs.some((e) => e.startsWith(`NAMED_PERSON_NOT_CAST:${name}`)), name);
  assert(errs.filter((e) => /ROLE_NOT_CAST|NAMED_PERSON_NOT_CAST/.test(e)).every(isSoftBibleError));
  // Covered once there is an entry naming them; lowercase words after a role are never taken for a name.
  const covered = { ...rebuilt, roleArchetypes: [...rebuilt.roleArchetypes, { id: "historian_frank", role: "historian Roberta Frank", canonicalAppearance: "x", usedFor: "x", identity: fixture.cast.archaeologist, outfitVariants: [] }] };
  assert(!validateBible(covered, script).some((e) => e.startsWith("NAMED_PERSON_NOT_CAST:Roberta Frank")));
  assert(!validateBible(rebuilt, "The designer who made it was busy. The designer who made it again.").some((e) => e.startsWith("NAMED_PERSON_NOT_CAST")));
});

/* ============================ Phase 3b ============================ */

const annotations = (({ _note, ...rest }: any) => rest)(await read("../fixtures/stickman/beats/myth-vs-reality.annotations.json"));

Deno.test("text leaks: labeled X -> SHORT_TEXT when the allowance has room, else stripped; never a contradictory instruction", () => {
  const yes = () => true;
  const no = () => false;
  const c = beat({ visualConcept: "Costume department rack labeled MYTH, handing helmet to viewer" }).contract;
  const conv = resolveTextLeak(c, c.visualConcept, yes);
  assertEquals([conv.contract.textIntent, conv.concept], [{ mode: "SHORT_TEXT", text: "MYTH" }, "Costume department rack, handing helmet to viewer"]);
  const strip = resolveTextLeak(c, c.visualConcept, no);
  assertEquals([strip.contract.textIntent.mode, strip.concept, strip.resolution!.action], ["NO_TEXT", "Costume department rack, handing helmet to viewer", "stripped"]);
  // Adjective use is not a label; long strings are never converted.
  assertEquals(resolveTextLeak(c, "Museum plinth with a single labeled helmet", yes).concept, "Museum plinth with a single helmet");
  const long = resolveTextLeak(c, "Bucket label reads ancient Norse warrior over mixed relics", yes);
  assertEquals([long.contract.textIntent.mode, long.concept], ["NO_TEXT", "Bucket label"]);
  // A lone "?" / "!" over a head is a drawn symbol: allowed without SHORT_TEXT, untouched (Phase 4a).
  assertEquals(resolveTextLeak(c, "Helmet on plinth with a floating question mark", yes).resolution, null);
  assertEquals(textImplied("Viewer pauses, a big exclamation mark over his head"), false);
  assertEquals(resolveTextLeak(c, "Crossed-out battlefield silhouette", no).concept, "red-crossed battlefield silhouette");
  assertEquals(resolveTextLeak(c, "Ticket booth at night, marquee lit", no).concept, "Ticket booth at night, blank marquee lit");
  // Framing is resolved too (it reaches the frame line).
  const framed = resolveTextLeak(beat({ composition: { camera: "MEDIUM", framing: "two items crossed out" } }).contract, "Saga page and stone carving", no);
  assertEquals(framed.contract.composition.framing, "two items red-crossed");
  // SHORT_TEXT beats may imply text (it is declared).
  assertEquals(resolveTextLeak({ ...c, textIntent: { mode: "SHORT_TEXT", text: "793" } }, "A sign reading 793", no).resolution, null);
});

Deno.test("Myth vs Reality: 0 prompts combine a text implication with no-text, and no SHORT_TEXT over 5 words", () => {
  const out = compilePlan(retimed.beats, recorded.bible, { fixture, annotations });
  for (const p of out.prompts) {
    const frameLineText = p.prompt.split("\n")[1];
    if (p.textIntent.mode !== "SHORT_TEXT") assert(!textImplied(frameLineText), `beat ${p.sequence}: ${frameLineText}`);
    else assert(String(p.textIntent.text).split(/\s+/).length <= 5, `beat ${p.sequence}`);
  }
  assertEquals(out.prompts.filter((p) => p.lintErrors.some((e) => !e.startsWith("ip_reference:"))).length, 0);
  const acts = out.prompts.filter((p) => p.textResolution).map((p) => p.textResolution!.action);
  assert(acts.includes("converted") && acts.includes("neutralized"));
});

Deno.test("worn items: written into the subject's line, not as loose props — the cold-open viewer wears the horned helmet", () => {
  const helmet = set.props.theatre_horned_helmet.block;
  const p = compileBeatPrompt(beat({ subjects: [{ castId: "viewer_viking", presence: "full", action: "charging", expression: "shouting", wearing: ["theatre_horned_helmet"] }], propIds: ["theatre_horned_helmet"] }), set, { bibleIds });
  assertStringIncludes(p.prompt, `${castBlock(set.cast.viewer_viking, "full")} Wearing: ${helmet} Pose: charging.`);
  assert(!p.prompt.includes("Props: "), "not repeated as a loose prop");
  const held = compileBeatPrompt(beat({ subjects: [{ castId: "archaeologist", presence: "full", action: "lifting", holding: ["gjermundbu_helmet"] }] }), set);
  assertStringIncludes(held.prompt, `Holding: ${set.props.gjermundbu_helmet.block}`);
  const out = compilePlan(retimed.beats, recorded.bible, { fixture, annotations });
  assertEquals(out.prompts.filter((x) => x.prompt.includes(`Wearing: ${helmet}`)).map((x) => x.sequence), [1, 2, 4, 111]);
});

Deno.test("outfit variants: a FULL identity selected per subject (never 'same but…')", () => {
  const variant = { ...set.cast.viewer_viking, outfit: "a muted forest-green tunic and a theatrical horned helmet", outfitShort: "a green tunic and horned helmet" };
  const withVariant = { ...set, cast: { ...set.cast, viewer_viking: { ...set.cast.viewer_viking, variants: { "horned helmet": variant } } } };
  const p = compileBeatPrompt(beat({ subjects: [{ castId: "viewer_viking", presence: "full", outfit: "horned helmet" }] }), withVariant);
  assertStringIncludes(p.prompt, castBlock(variant, "full"));
  assert(!p.prompt.includes(castBlock(set.cast.viewer_viking, "full")));
});

Deno.test("expression -> face construction: only the style's parts and the allowed modifiers; neutral fallback", () => {
  assertEquals(faceFor("curious"), "eyebrows raised, small open-mouth oval");
  assertEquals(faceFor("shocked"), "eyebrows shot high, wide open-mouth oval, small motion lines");
  assertEquals(faceFor("worried"), "eyebrows angled up in the middle, small wavy mouth line");
  assertEquals(faceFor("confident"), "eyebrows level, small upward mouth curve");
  assertEquals(faceFor("angry"), "eyebrows angled sharply down, mouth a tight downward curve");
  assertEquals(faceFor("smug"), "one eyebrow raised, lopsided upward mouth curve");
  assertEquals(faceFor("", "charging, screaming"), "eyebrows angled sharply down, wide open-mouth oval, small motion lines", "falls back to the action");
  assertEquals(faceFor("zzz"), NEUTRAL_FACE);
  assert(FACE_MAP.length >= 15);
  for (const [, face] of FACE_MAP) assert(!/beard|mustache|teeth|nose|pupil|lips|wrinkle/i.test(face), face);
  const hands = compileBeatPrompt(beat({ subjects: [{ castId: "viking_warrior", presence: "hands", action: "gripping", expression: "tense" }] }), set);
  assert(!hands.prompt.includes("Face:"), "no face on hands-only shots");
});

Deno.test("layout for 2+ subjects: director positions, else first left / second right / tiny in the background", () => {
  assertEquals(layoutFor([{ castId: "a" }]), [""]);
  assertEquals(layoutFor([{ castId: "a" }, { castId: "b" }]), ["On the left: ", "On the right: "]);
  assertEquals(layoutFor([{ castId: "a", position: "center" }, { castId: "b", presence: "tiny" }]), ["In the center: ", "In the background: "]);
  const p = compileBeatPrompt(beat({ subjects: [{ castId: "19thc_theatre_designer", presence: "full" }, { castId: "viewer_viking", presence: "full" }] }), set);
  assertStringIncludes(p.prompt, `Subjects: On the left: ${castBlock(set.cast["19thc_theatre_designer"], "full")}`);
  assertStringIncludes(p.prompt, `On the right: ${castBlock(set.cast.viewer_viking, "full")}`);
});
