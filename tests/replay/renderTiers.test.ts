// deno-lint-ignore-file no-explicit-any
// Phase 4b — locked Stickman tiers, text overlay (golden images), style fix.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { STICKMAN_RENDER_TIERS, EXCLUDED_STICKMAN_MODELS, contractForTier, candidatesFor, renderTask, renderBeat, textMatches, type RenderDeps } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { overlayText, OVERLAY_STYLE } from "../../supabase/functions/_shared/stickman/textOverlay.ts";
import { compileBeatPrompt, canonicalSetFromBible, castBlock, lintPrompt, STYLE_HEADER, BODY_VOLUME } from "../../supabase/functions/_shared/stickman/promptCompiler.ts";
import { contentIssues } from "../../supabase/functions/_shared/stickman/beatDirector.ts";
import { validateBible } from "../../supabase/functions/_shared/stickman/productionBible.ts";

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, import.meta.url)));
const recorded = await read("../fixtures/stickman/beats/myth-vs-reality.recorded.json");
const fixture = await read("../fixtures/stickman/bibles/myth-vs-reality.canonical.json");
const set = canonicalSetFromBible(recorded.bible, fixture);
const GOLDEN = new URL("../fixtures/stickman/overlay/", import.meta.url);

/* ---------------- tiers ---------------- */

Deno.test("tiers: V2 FLUX + overlay text, V3 Nano Banana 2 Lite + model text, V4 = V3 + best-of-2 and strict QA; excluded models never configured", () => {
  const t = STICKMAN_RENDER_TIERS;
  assertEquals([t.V2.model, t.V2.width, t.V2.height, t.V2.params, t.V2.text], ["runware:400@6", 1376, 768, { steps: 8, CFGScale: 3.5, acceleration: "high" }, "overlay"]);
  assertEquals([t.V3.model, t.V3.text, t.V3.ocrRetries, t.V3.bestOf], ["google:nano-banana@2-lite", "model", 1, 1]);
  assertEquals([t.V4.model, t.V4.bestOf, t.V4.bestOfFor, t.V4.qa, t.V4.qaRetries], ["google:nano-banana@2-lite", 2, ["hook", "short_text"], "strict", 1]);
  for (const tier of Object.values(t)) { assertEquals(tier.referenceImages, false); assertEquals(tier.upscale, true); }
  const used = JSON.stringify(t);
  for (const x of ["google:4@3", "recraft:v4@0", "alibaba:qwen-image@2512"]) assert(!used.includes(x), x);
  assert(EXCLUDED_STICKMAN_MODELS.length >= 5);
});

Deno.test("V2 never lets FLUX draw text: SHORT_TEXT compiles as PROGRAMMATIC with the top zone kept clear, and the text goes to the overlay", () => {
  const c = { treatment: "REACTION", composition: { camera: "MEDIUM", framing: "x" }, subjects: [], propIds: [], textIntent: { mode: "SHORT_TEXT", text: "Did Vikings really wear horns?" }, visualConcept: "A warrior pauses" };
  const v2 = contractForTier("V2", c);
  assertEquals([v2.contract.textIntent.mode, v2.contract.textIntent.zone, v2.overlayText], ["PROGRAMMATIC", "top", "Did Vikings really wear horns?"]);
  const p = compileBeatPrompt({ sequence: 1, startMs: 0, endMs: 1, narrationText: "x", contract: v2.contract }, set);
  assertStringIncludes(p.prompt, "Leave the entire upper third of the frame empty for a later text overlay: only plain flat sky or wall there, with no heads, symbols, question marks or objects reaching into it.");
  assert(!p.prompt.includes("Did Vikings"));
  // Phase 6c-polish: a HEADLINE (the question) is Zyvo's overlay on EVERY tier, V3 included.
  assertEquals(contractForTier("V3", c).overlayText, "Did Vikings really wear horns?");
  // IN_SCENE text (a sign) is drawn by V3/V4 and left blank on V2.
  const sign = { ...c, textIntent: { mode: "SHORT_TEXT", text: "MUSEUM", kind: "IN_SCENE" }, visualConcept: "A museum sign" };
  assertEquals([contractForTier("V3", sign).overlayText, contractForTier("V3", sign).contract.textIntent.mode], [null, "SHORT_TEXT"]);
  assertEquals([contractForTier("V2", sign).overlayText, contractForTier("V2", sign).contract.textIntent.mode], [null, "NO_TEXT"]);
  const task = renderTask("V2", p);
  assertEquals([task.model, task.positivePrompt === p.positivePrompt, task.steps], ["runware:400@6", true, 8]);
  // "flames, fire" join the negative unless the concept asks for fire (Phase 4c).
  assertEquals(task.negativePrompt, `${p.negativePrompt} Also avoid: flames, fire.`);
  assertEquals(renderTask("V2", p, { visualConcept: "horns catching firelight" }).negativePrompt, p.negativePrompt);
  assertEquals(renderTask("V3", p).positivePrompt, p.prompt, "Nano Banana gets the avoid tail appended");
});

Deno.test("V4 best-of-2 only for hook beats (first 30 s) and SHORT_TEXT beats", () => {
  const nt = { textIntent: { mode: "NO_TEXT" } }, st = { textIntent: { mode: "SHORT_TEXT", text: "793" } };
  assertEquals([candidatesFor("V4", { startMs: 10_000, contract: nt }), candidatesFor("V4", { startMs: 90_000, contract: st }), candidatesFor("V4", { startMs: 90_000, contract: nt }), candidatesFor("V3", { startMs: 0, contract: st })], [2, 2, 1, 1]);
  assert(textMatches("Bayreuth, 1876", "BAYREUTH 1876") && !textMatches("Did Vikings really wear horns?", "DID VICKINGS REALLY WEAR HORNS?"));
});

function fakes(ocr: string[], scores: number[] = []) {
  const calls: string[] = [];
  let n = 0;
  const deps: RenderDeps = {
    compile: (c) => ({ prompt: `P:${c.textIntent?.mode}`, positivePrompt: "pp", negativePrompt: "np" }),
    render: async (task) => { calls.push(`render ${task.positivePrompt}`); n++; return { imageURL: `img${n}`, cost: 0.03 }; },
    qa: async (url) => { const i = Number(url.slice(3)) - 1; return { pass: (scores[i] ?? 1) >= 0.8, score: scores[i] ?? 1, ocrText: ocr[i] ?? "", cost: 0.001 }; },
    postProcess: async () => { calls.push("upscale"); return { bytes: new Uint8Array([1]), cost: 0.0006 }; },
    overlay: async (b, t) => { calls.push(`overlay ${t}`); return b; },
    // V2 free code checks: an ocr entry of "BLANK" makes that image fail them.
    codeCheck: async (url) => { const i = Number(url.slice(3)) - 1; const ok = ocr[i] !== "BLANK"; return { pass: ok, score: ok ? 1 : 0, ocrText: "", cost: 0 }; },
  };
  return { deps, calls };
}
// In-scene text (a label on a rack): the model draws it on V3/V4.
const textBeat = { startMs: 60_000, contract: { textIntent: { mode: "SHORT_TEXT", text: "MYTH", kind: "IN_SCENE" } } };
const headlineBeat = { startMs: 60_000, contract: { textIntent: { mode: "SHORT_TEXT", text: "MYTH", kind: "HEADLINE" } } };

Deno.test("V3 text: OCR match first time -> model text kept, no overlay", async () => {
  const f = fakes(["MYTH"]);
  const r = await renderBeat("V3", textBeat, f.deps);
  assertEquals([r.overlayText, f.calls], [null, ["render P:SHORT_TEXT", "upscale"]]);
});

Deno.test("V3 text: mismatch -> one retry -> still wrong -> clean re-render with the zone kept clear + programmatic overlay", async () => {
  const f = fakes(["MYHT", "MTYH", ""]);
  const r = await renderBeat("V3", textBeat, f.deps);
  assertEquals(f.calls, ["render P:SHORT_TEXT", "render P:SHORT_TEXT", "render P:PROGRAMMATIC", "upscale", "overlay MYTH"]);
  assertEquals(r.log.map((l) => l.step), ["render", "ocr retry", "clean re-render for overlay", "upscale 1920x1080", "programmatic text overlay"]);
  assertEquals(r.overlayText, "MYTH");
});

Deno.test("V2: FLUX renders once, text only as overlay; V4: best-of-2 picks the higher QA score, strict retry on a fail", async () => {
  const f2 = fakes([""]);
  const r2 = await renderBeat("V2", headlineBeat, f2.deps);
  assertEquals(f2.calls, ["render pp", "upscale", "overlay MYTH"]);
  assertEquals(r2.overlayText, "MYTH");
  const f4 = fakes(["MYTH", "MYTH"], [0.5, 0.9]);
  const r4 = await renderBeat("V4", textBeat, f4.deps);
  assertEquals([r4.imageURL, f4.calls.filter((c) => c.startsWith("render")).length], ["img2", 2]);
  const f4b = fakes(["", "", ""], [0.4, 0.5, 0.95]);
  const r4b = await renderBeat("V4", { startMs: 5_000, contract: { textIntent: { mode: "NO_TEXT" } } }, f4b.deps);
  assertEquals([r4b.imageURL, r4b.log.map((l) => l.step).slice(0, 3)], ["img3", ["render 1/2", "render 2/2", "qa retry"]]);
});

Deno.test("text policy follows the COMPILER-resolved text: a 'labeled MYTH' conversion is overlaid on V2 and OCR-checked on V3", async () => {
  // The compiler converts NO_TEXT + "rack labeled MYTH" into SHORT_TEXT "MYTH" when the plan allows it.
  const leakBeat = { startMs: 60_000, contract: { textIntent: { mode: "NO_TEXT", text: null }, visualConcept: "rack labeled MYTH" } };
  const withLeak = (f: ReturnType<typeof fakes>) => ({ ...f.deps, compile: (c: any) => ({ prompt: `P:${c.textIntent?.mode}`, positivePrompt: `pp:${c.textIntent?.mode}`, negativePrompt: "np", textIntent: c.textIntent?.mode === "NO_TEXT" ? { mode: "SHORT_TEXT", text: "MYTH" } : c.textIntent }) });
  const v2 = fakes([""]);
  const r2 = await renderBeat("V2", leakBeat, withLeak(v2));
  // "labeled MYTH" is text INSIDE the picture: V2 draws the label blank (no overlay).
  assertEquals([r2.overlayText, v2.calls], [null, ["render pp:NO_TEXT", "upscale"]]);
  const v3 = fakes(["MYTH"]);
  const r3 = await renderBeat("V3", leakBeat, withLeak(v3));
  assertEquals([r3.overlayText, v3.calls], [null, ["render P:SHORT_TEXT", "upscale"]]);
});

/* ---------------- overlay ---------------- */

async function plate() {
  const img = new Image(1920, 1080);
  for (let y = 0; y < 1080; y += 60) img.drawBox(0, y + 1, 1920, 60, y % 120 ? 0x8fb3d9ff : 0x6d9ac9ff);
  return await img.encodeJPEG(90);
}

Deno.test("overlay: bold yellow all-caps with a black outline in the top third, <= 80% width — matches the golden images", async () => {
  const base = await plate();
  for (const [name, text] of [["short", "Myth"], ["long", "Did Vikings really wear horns?"]]) {
    const r = await overlayText(base, text, { style: "HEADLINE" }); // the original yellow headline (a "?" alone would be a QUESTION)
    assert(r.box.width <= 1920 * OVERLAY_STYLE.maxWidthRatio + 2, `${name} width ${r.box.width}`);
    assert(r.box.y + r.box.height <= 360, `${name} stays in the top third`);
    assertEquals(r.text, text.toUpperCase());
    const goldenFile = new URL(`golden-${name}.jpg`, GOLDEN);
    let golden: Uint8Array | null = null;
    try { golden = await Deno.readFile(goldenFile); } catch { /* first run writes it */ }
    if (!golden) { await Deno.mkdir(GOLDEN, { recursive: true }); await Deno.writeFile(goldenFile, r.bytes); golden = r.bytes; }
    assertEquals(r.bytes.length, golden.length, `${name}: output differs from the golden image`);
    assert(r.bytes.every((b, i) => b === golden![i]), `${name}: output differs from the golden image`);
  }
  // Yellow fill and black outline are really there.
  const img = await Image.decode((await overlayText(base, "Myth")).bytes);
  let yellow = 0, black = 0;
  for (let y = 60; y < 300; y += 3) for (let x = 600; x < 1320; x += 3) { const [r, g, b] = Image.colorToRGBA(img.getPixelAt(x + 1, y + 1)); if (r > 200 && g > 170 && b < 90) yellow++; if (r < 40 && g < 40 && b < 40) black++; }
  assert(yellow > 500 && black > 300, `yellow ${yellow} black ${black}`);
});

/* ---------------- style fix ---------------- */

Deno.test("style fix: the header keeps limbs as stick lines; cast blocks are torso shapes; body volume is a hard lint", () => {
  assertStringIncludes(STYLE_HEADER, "Clothing is only a flat colored shape on the torso; arms and legs ALWAYS remain thin black stick lines, never filled trouser legs or sleeves; feet are small rounded mitten shapes (may be colored for shoes/boots).");
  for (const [id, c] of Object.entries(set.cast)) for (const p of ["full", "hands", "back", "tiny"] as const) assert(!BODY_VOLUME.test(castBlock(c, p)), `${id} ${p}: ${castBlock(c, p)}`);
  assertStringIncludes(castBlock(set.cast.viewer_viking, "full"), "a muted forest-green tunic shape on the torso");
  assertStringIncludes(castBlock(set.cast.viewer_viking, "hands"), "two rounded black mitten hands at the ends of thin black stick arms");
  const old = { ...set.cast.viewer_viking, outfit: "a green tunic, mud-brown trousers and knee-high boots" };
  assert(lintPrompt(castBlock(old, "full"), "", { bibleIds: [], requiredBlocks: [], castBlocks: [castBlock(old, "full")] }).some((e) => e.startsWith("cast_block_volume")));
  const bible = { ...recorded.bible, roleArchetypes: recorded.bible.roleArchetypes.map((a: any) => ({ ...a, identity: { ...fixture.cast[a.id], outfit: "a tunic and slate-grey trousers" } })) };
  assert(validateBible(bible).some((e) => e.includes('"trousers": clothing is a flat shape on the torso only')));
});

Deno.test("director recipes: SYMBOLIC needs a device, POV names hands + object, ESTABLISHING shows the place (soft checks)", () => {
  const codes = (treatment: string, v: string) => contentIssues({ treatment, visualConcept: v, subjects: [], propIds: [], textIntent: { mode: "NO_TEXT" } }, "").map((c) => c.code);
  assert(codes("SYMBOLIC", "The horned silhouette burned large into a stickman head").includes("concept_without_device") === false, "a silhouette is a device");
  assert(codes("SYMBOLIC", "A single wrong picture rewrites a whole culture").includes("concept_without_device"));
  assert(!codes("SYMBOLIC", "The viewer with a thought bubble containing a horned helmet").includes("concept_without_device"));
  assert(codes("POV", "Viewer's eye catches curving horns on distant object").includes("concept_without_device"));
  assert(!codes("POV", "The viewer's hands on a shield rim in the foreground, a horned mascot logo on a banner in the middle distance").includes("concept_without_device"));
  assert(codes("ESTABLISHING", "Crowds of people in coats waiting").includes("establishing_without_place"));
  assert(!codes("ESTABLISHING", "An opera house facade at night with a lit marquee").includes("establishing_without_place"));
});
