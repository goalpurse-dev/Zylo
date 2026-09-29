// deno-lint-ignore-file no-explicit-any
// Thumbnail V2: the pack as the source of truth (exact HEADER / COMPOSITION,
// few-shot from the video's niche), headline rules, concept normalising (hook
// object, cast, plain names, the pack's background style), the calibrated code
// checks (colour contrast, subject size, the top-third stop + its code fix)
// and the headline layer (top third, ~80% width, yellow/white).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { headlineProblems, fixHeadline, normalizeConcepts, normalizeBackground, scrubScene, thumbnailPromptV2, checkThumb, headlineLayerV2, greyShare, readLayout, contrastScore, clearTopThird, packFewShot, ARCHETYPES, PACK, PACK_HEADER, PACK_COMPOSITION } from "../../supabase/functions/_shared/stickman/thumbnailV2.ts";

const TITLE = "Did Vikings Wear Horned Helmets?";
const HOOK = "a round iron helmet with two big curved horns";
const font = await Deno.readFile(new URL("../../supabase/functions/_shared/fonts/LilitaOne-Regular.ttf", import.meta.url));
const md = await Deno.readTextFile(new URL("../../docs/thumbnails/thumbnail-pack.md", import.meta.url));

Deno.test("the pack: 50 examples, the exact HEADER and COMPOSITION blocks, prompts rebuild verbatim", () => {
  assertEquals(PACK.length, 50);
  assert(md.includes(PACK_HEADER) && md.includes(PACK_COMPOSITION));
  for (const e of PACK) assertEquals(`${PACK_HEADER} BACKGROUND: ${e.background} SUBJECT: ${e.subject} ${PACK_COMPOSITION}`, e.prompt, `#${e.n}`);
  const few = packFewShot("Did Vikings Wear Horned Helmets? myth history", 4);
  assertEquals(few.length, 4);
  assert(few.some((e) => e.niche === "Myth vs Reality"), JSON.stringify(few.map((e) => e.niche)));
  assert(packFewShot("Why do we procrastinate? psychology habits", 4).some((e) => e.niche === "Psychology & Human Behavior"));
});

Deno.test("headline: the pack's rule (1-3 words, max 4 for a question), curiosity, never generic or the answer", () => {
  for (const good of ["FAKE HORNS?", "WHO ADDED THEM?", "NO HORNS?!", "WHO STARTED IT?", "WHERE DID THEY GO?"]) assertEquals(headlineProblems(good, TITLE, [HOOK]), [], good);
  for (const bad of ["THINK AGAIN", "THE REAL PIECE", "THE TRUTH", "NO WAY", "WAIT, WHAT?"]) assert(headlineProblems(bad, TITLE, [HOOK]).includes("generic"), bad);
  assert(headlineProblems("TOTAL LIE", TITLE, [HOOK]).includes("gives the answer"));
  assert(headlineProblems("HORNED HELMETS", TITLE, [HOOK]).includes("repeats the title"));
  assert(headlineProblems("WHO REALLY STARTED ALL THIS?", TITLE, [HOOK]).some((p) => p.includes("max 4")));
  assert(headlineProblems("Fake Horns?", TITLE, [HOOK]).includes("not ALL CAPS"));
  assertEquals(fixHeadline("THINK AGAIN", TITLE, "a giant red alarm clock", ["alarm clock"]), "WHO MADE THIS?");
  assertEquals(fixHeadline("FAKE HORNS", TITLE, HOOK, [HOOK]), "FAKE HORNS?");
});

Deno.test("concepts: 3 archetypes, cast (main first, max 2), the hook object everywhere, plain names, the pack's background style", () => {
  const raw = [
    { archetype: "REACTION", headline: "FAKE HORNS?", scene: "The visitor stares at a plain iron dome under glass with a big question mark above", cast: ["viewer_modern", "monk", "ghost"], mainCharacter: "viewer_modern", expression: "horrified", background: "flat crimson red with a flat orange burst and a dark red ground band" },
    { archetype: "reaction", headline: "THE TRUTH", scene: "A sign reading 'FAKE' beside the warrior", cast: ["warrior"], mainCharacter: "warrior", background: "plain white museum gallery room" },
    { archetype: "SCALE", headline: "WHO ADDED THEM?", scene: "A giant horned helmet towers over a tiny warrior", cast: ["warrior"], mainCharacter: "warrior", background: "deep royal blue with a flat grey stone band at the bottom" },
  ];
  const { concepts, problems } = normalizeConcepts(raw, TITLE, ["viewer_modern", "warrior", "monk"], HOOK, ["Viking"]);
  assertEquals(new Set(concepts.map((c) => c.archetype)).size, 3);
  assert(concepts.every((c) => ARCHETYPES.includes(c.archetype)));
  assertEquals(concepts[0].cast, ["viewer_modern", "monk"]);
  assert(/two big curved horns/.test(concepts[0].scene) && !/dome/.test(concepts[0].scene), concepts[0].scene);
  assert(/helmet/.test(concepts[1].scene), "the hook object is added when the scene misses it");
  assert(!/question|sign|FAKE|\?/.test(concepts.map((c) => c.scene).join(" ")));
  assertEquals(concepts[1].headline, "WHO MADE THESE?");
  assert(/^flat /.test(concepts[1].background!) && !/white|room/.test(concepts[1].background!), concepts[1].background);
  assertEquals(concepts[2].background, "flat deep royal blue with a flat grey stone band at the bottom");
  assert(problems.some((p) => p.includes("pale/room")) && problems.some((p) => p.includes("generic")) && problems.some((p) => p.includes("misses the hook object")));
  assertEquals(normalizeBackground("split: flat gold on the left, flat grey on the right", "x").problem, null);
});

Deno.test("prompt = the pack's exact shape: HEADER BACKGROUND: … SUBJECT: … COMPOSITION (hook attached, cast only, main largest)", () => {
  const c: any = { archetype: "REACTION", headline: "FAKE HORNS?", scene: "The visitor gapes at the horned helmet", cast: ["viewer_modern"], mainCharacter: "viewer_modern", expression: "horrified", background: "flat crimson red with a flat dark-red ground band" };
  const p = thumbnailPromptV2(c, HOOK, [{ id: "viewer_modern", name: "The visitor", block: "The visitor: a stickman with a light circle head, short brown hair, wearing a navy sweater." }]);
  assert(p.startsWith(`${PACK_HEADER} BACKGROUND: flat crimson red with a flat dark-red ground band. SUBJECT: `) && p.endsWith(PACK_COMPOSITION), p.slice(0, 200));
  assert(/worn properly on a head or held firmly in mitten hands — never floating/.test(p) && /LARGEST figure/.test(p) && /no extras/.test(p) && /never a blank head/.test(p));
});

Deno.test("checks: colour contrast (red on orange passes), grey rooms fail, subject size, and the top-third stop fixed by code", () => {
  // Red background, an orange burst, a subject (green body, peach head) that reaches into the top third.
  const img = new Image(1280, 720).fill(Image.rgbaToColor(190, 45, 55, 255));
  for (let y = 120; y <= 720; y++) for (let x = 380; x <= 900; x++) img.setPixelAt(x, y, Image.rgbaToColor(235, 125, 55, 255));
  for (let y = 180; y <= 700; y++) for (let x = 560; x <= 720; x++) img.setPixelAt(x, y, y < 330 ? Image.rgbaToColor(240, 205, 170, 255) : Image.rgbaToColor(70, 120, 80, 255));
  const L = readLayout(img);
  assert(contrastScore(img, L) >= 0.35, String(contrastScore(img, L)));
  assert(L.topRow < 240 && !checkThumb(img, {}, 1).topClear, JSON.stringify({ t: L.topIntrusion, r: L.topRow }));
  const fix = clearTopThird(img, L)!;
  assert(fix && fix.shiftPx > 0);
  const after = readLayout(fix.img);
  assert(after.topRow >= 240 && checkThumb(fix.img, {}, 1).topClear, JSON.stringify({ t: after.topIntrusion, r: after.topRow }));
  assert(after.heightShare >= 0.45);
  const grey = new Image(1280, 720).fill(0xd8d8d8ff);
  assert(greyShare(grey) > 0.9 && !checkThumb(grey, { text: "", people: 1, blankHeads: 0, hookVisible: true, hookAttached: true }, 1).pass);
  const t = checkThumb(fix.img, { text: "HELMET", people: 3, blankHeads: 1, hookVisible: true, hookAttached: false }, 1);
  assert(!t.textFree && !t.peopleOk && t.hookAttached === false && !t.pass);
});

Deno.test("headline layer: top third only, ~80% width, yellow on dark, white on yellow", () => {
  const dark = new Image(1920, 1080).fill(0x1a2b6dff);
  const L = headlineLayerV2(dark, "WHO ADDED THEM?", font);
  assert(L.box.y >= 0 && L.box.y + L.box.height <= 1080 / 3, JSON.stringify(L.box));
  assert(L.box.width >= 1920 * 0.7 && L.box.width <= 1920 * 0.82, String(L.box.width));
  assertEquals(L.fill, "#FFD21F");
  assertEquals(headlineLayerV2(new Image(1920, 1080).fill(0xf2c230ff), "FAKE HORNS?", font).fill, "#FFFFFF");
});

Deno.test("pack-proof fixes: orange keeps a yellow headline (white only on yellow/gold); SCALE needs no big face; a split may have a grey half", async () => {
  const { isYellowish } = await import("../../supabase/functions/_shared/stickman/thumbnailV2.ts");
  const orange = new Image(400, 200).fill(Image.rgbaToColor(250, 160, 70, 255)), gold = new Image(400, 200).fill(Image.rgbaToColor(215, 178, 60, 255)), yellow = new Image(400, 200).fill(Image.rgbaToColor(245, 205, 45, 255));
  assert(!isYellowish(orange, 0, 0, 400, 200) && isYellowish(gold, 0, 0, 400, 200) && isYellowish(yellow, 0, 0, 400, 200));
  const img = new Image(1280, 720).fill(Image.rgbaToColor(120, 170, 220, 255));
  for (let y = 300; y <= 720; y++) for (let x = 500; x <= 800; x++) img.setPixelAt(x, y, Image.rgbaToColor(120, 80, 50, 255));
  assert(!checkThumb(img, {}, 1).faceOk && checkThumb(img, {}, 1, "SCALE").faceOk);
  const split = new Image(1280, 720).fill(Image.rgbaToColor(200, 200, 200, 255));
  for (let y = 1; y <= 720; y++) for (let x = 1; x <= 640; x++) split.setPixelAt(x, y, Image.rgbaToColor(230, 180, 40, 255));
  assert(!checkThumb(split, {}, 0).greyOk || checkThumb(split, {}, 0, "VERSUS").greyOk);
});
