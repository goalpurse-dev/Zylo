// deno-lint-ignore-file no-explicit-any
// Phase 4c — V2 free code checks, overlay placement, drawn-symbol drop, block repair.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { codeCheckImage } from "../../supabase/functions/_shared/stickman/imageChecks.ts";
import { overlayText, edgeDensity } from "../../supabase/functions/_shared/stickman/textOverlay.ts";
import { renderBeat, STICKMAN_RENDER_TIERS, type RenderDeps } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { dropDrawnSymbols, compileBeatPrompt, canonicalSetFromBible, repairStructuredBlocks } from "../../supabase/functions/_shared/stickman/promptCompiler.ts";

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, import.meta.url)));

async function jpeg(w: number, h: number, paint: (img: Image) => void) {
  const img = new Image(w, h);
  paint(img);
  return await img.encodeJPEG(90);
}
const scene = (img: Image) => { img.fill(0x9fc3e8ff); img.drawBox(1, Math.floor(img.height * 0.6), img.width, Math.floor(img.height * 0.4), 0x5f8f4eff); img.drawCircle(Math.floor(img.width / 2), Math.floor(img.height / 2), Math.floor(img.height / 6), 0xf1d2b0ff); };

Deno.test("V2 code checks: decodes, exact dimensions, not blank, not a tiny file", async () => {
  const good = await jpeg(1376, 768, scene);
  assertEquals((await codeCheckImage(good, { width: 1376, height: 768 })).pass, true);
  const blank = await jpeg(1376, 768, (i) => i.fill(0xffffffff));
  const b = await codeCheckImage(blank, { width: 1376, height: 768 }, { minBytes: 0 });
  assert(!b.pass && b.reasons.some((r) => r.startsWith("blank")), JSON.stringify(b));
  const wrong = await codeCheckImage(await jpeg(1344, 768, scene), { width: 1376, height: 768 });
  assert(wrong.reasons.some((r) => r.startsWith("dimensions 1344x768")));
  const corrupt = await codeCheckImage(new Uint8Array(9000).fill(7), { width: 1376, height: 768 });
  assert(!corrupt.pass && corrupt.reasons.some((r) => r.startsWith("does not decode")));
  assertEquals([STICKMAN_RENDER_TIERS.V2.qa, STICKMAN_RENDER_TIERS.V2.qaRetries], ["code", 1]);
});

function deps(checks: boolean[]) {
  const calls: string[] = [];
  let n = 0;
  const d: RenderDeps = {
    compile: (c) => ({ prompt: "p", positivePrompt: "pp", negativePrompt: "np", textIntent: c.textIntent }),
    render: async () => { n++; calls.push(`render ${n}`); return { imageURL: `img${n}`, cost: 0.00247 }; },
    qa: async () => { throw new Error("V2 never calls AI QA"); },
    codeCheck: async (url) => { const ok = checks[Number(url.slice(3)) - 1] ?? true; calls.push(`check ${url} ${ok ? "ok" : "fail"}`); return { pass: ok, score: ok ? 1 : 0, ocrText: "", cost: 0 }; },
    postProcess: async () => { calls.push("upscale"); return { bytes: new Uint8Array([9]), cost: 0.0006 }; },
    overlay: async (b) => b,
  };
  return { d, calls };
}

Deno.test("V2: a failed code check gets ONE re-render; a second failure is flagged and not upscaled", async () => {
  const beat = { startMs: 60_000, contract: { textIntent: { mode: "NO_TEXT" } } };
  const once = deps([false, true]);
  const r1 = await renderBeat("V2", beat, once.d);
  assertEquals([r1.failed, r1.retries, r1.imageURL, once.calls], [false, 1, "img2", ["render 1", "check img1 fail", "render 2", "check img2 ok", "upscale"]]);
  const twice = deps([false, false]);
  const r2 = await renderBeat("V2", beat, twice.d);
  assertEquals([r2.failed, r2.retries, twice.calls.includes("upscale")], [true, 1, false]);
  const clean = deps([true]);
  const r3 = await renderBeat("V2", beat, clean.d);
  assertEquals([r3.failed, r3.retries, r3.cost], [false, 0, 0.00247 + 0.0006]);
});

Deno.test("overlay placement: top band by default, the calmer bottom band when the top is busy, a dark band when both are busy", async () => {
  const calm = await overlayText(await jpeg(1920, 1080, scene), "Did Vikings really wear horns?", { style: "HEADLINE" });
  assertEquals([calm.layer.band, calm.layer.darkBand], ["top", false]);
  assert(calm.box.y + calm.box.height <= 360);
  const busyTop = await jpeg(1920, 1080, (i) => { scene(i); for (let x = 0; x < 1920; x += 8) i.drawBox(x + 1, 1, 4, 360, 0x000000ff); });
  const moved = await overlayText(busyTop, "Did Vikings really wear horns?", { style: "HEADLINE" });
  assertEquals(moved.layer.band, "bottom");
  assert(moved.box.y >= 720, `y ${moved.box.y}`);
  const busyAll = await jpeg(1920, 1080, (i) => { i.fill(0xffffffff); for (let x = 0; x < 1920; x += 8) i.drawBox(x + 1, 1, 4, 1080, 0x000000ff); });
  const banded = await overlayText(busyAll, "Myth");
  assertEquals([banded.layer.band, banded.layer.darkBand], ["top", true]);
  // The layer spec is complete enough to re-draw or edit the text later.
  assertEquals(Object.keys(calm.layer).sort(), ["band", "box", "darkBand", "edgeDensity", "fill", "font", "outline", "outlineRadius", "scale", "style", "text", "type"]);
  assertEquals([calm.layer.font, calm.layer.fill, calm.layer.outline], ["Lilita One", "#FFD21F", "#000000"]);
  assert(edgeDensity(await Image.decode(busyAll), 0, 0, 800, 200) > 14);
});

Deno.test("text beats never carry a drawn ? / ! — beat 10's headline collision", async () => {
  assertEquals(dropDrawnSymbols("Viewer viking pauses mid-stride, question mark over head"), "Viewer viking pauses mid-stride");
  assertEquals(dropDrawnSymbols("Viewer stares at TV, question mark over football helmet"), "Viewer stares at TV");
  assertEquals(dropDrawnSymbols("A warrior with a big exclamation mark above his head, grinning"), "A warrior, grinning");
  const recorded = await read("../fixtures/stickman/beats/myth-vs-reality.recorded.json");
  const fixture = await read("../fixtures/stickman/bibles/myth-vs-reality.canonical.json");
  const set = canonicalSetFromBible(recorded.bible, fixture);
  const c = { treatment: "REACTION", composition: { camera: "MEDIUM", framing: "x" }, subjects: [], propIds: [], visualConcept: "Viewer viking pauses mid-stride, question mark over head" };
  const withText = compileBeatPrompt({ sequence: 10, startMs: 0, endMs: 1, narrationText: "x", contract: { ...c, textIntent: { mode: "PROGRAMMATIC", text: "Did Vikings really wear horns?", zone: "top" } } }, set);
  assert(!/question mark over head/.test(withText.prompt));
  const noText = compileBeatPrompt({ sequence: 10, startMs: 0, endMs: 1, narrationText: "x", contract: { ...c, textIntent: { mode: "NO_TEXT", text: null } } }, set);
  assertStringIncludes(noText.prompt, "question mark over head");
});

Deno.test("block repair: id-like display names become plain words; people are removed from setting layers; ids in props are replaced", async () => {
  const rebuilt = (await read("../fixtures/stickman/bibles/myth-vs-reality.rebuilt-v3.json")).bible;
  const set = canonicalSetFromBible(rebuilt);
  assertEquals(set.cast.viewer_viking.displayName, "Viewer viking");
  for (const c of Object.values(set.cast)) assert(!/_/.test(c.displayName), c.displayName);
  for (const s of Object.values(set.settings)) for (const v of Object.values(s.variants)) for (const k of ["background", "midground", "foreground"] as const) assert(!/viewer_|avatar/i.test(v[k]), `${k}: ${v[k]}`);
  assertEquals(repairStructuredBlocks({ cast: {}, settings: {}, props: { a: { block: "x", source: "fixture" } } }).props.a.block, "x");
});
