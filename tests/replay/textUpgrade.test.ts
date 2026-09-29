// deno-lint-ignore-file no-explicit-any
// Text upgrade — more Zyvo on-screen text: ~1 in 5 scenes by default, ranked
// (numbers > names > questions > reveals > contrasts > punch), spread evenly
// (<= 2 in a row, ~1 per 15 s, denser in the hook), four code-drawn styles
// (HEADLINE, BIG_STAT, QUESTION, CALLOUT), never on a face.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { acceptHeadlines, applyTextPass, textTarget, textStyleOf, categoryOf, groundedIn, headlinePrompt, digitsForDisplay, TEXT_SLOT_MS, HOOK_MS } from "../../supabase/functions/_shared/stickman/headlines.ts";
import { overlayText, scaleLayer, renderLayerPng, splitStat, autoStyle } from "../../supabase/functions/_shared/stickman/textOverlay.ts";

const beat = (n: number, text: string, textIntent?: any, extra: any = {}) => ({ sequence: n, startMs: (n - 1) * 4000, narrationText: text, contract: { visualConcept: `picture ${n}`, ...(textIntent ? { textIntent } : {}), ...extra } });
const plate = async (paint?: (i: Image) => void) => { const i = new Image(1376, 768); i.fill(0xdfe8efff); paint?.(i); return await i.encodeJPEG(90); };
const overlaps = (a: any, b: any) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

Deno.test("density by setting: Minimal ~9%, Balanced ~20% (default), Frequent ~31%", () => {
  assertEquals([textTarget(148, "minimal"), textTarget(148, "balanced"), textTarget(148, null), textTarget(148, "frequent")], [13, 30, 30, 46]);
});

Deno.test("rhythm: every ~15 s slot gets text (twice as often in the hook), never 3 in a row, never on picture words", () => {
  // 120 beats of 4 s (8 min), a candidate on every beat.
  const beats = Array.from({ length: 120 }, (_, i) => beat(i + 1, `line ${i + 1} about the spear and the hunt`));
  beats[40] = beat(41, "a sign reads CAMP", { mode: "SHORT_TEXT", text: "CAMP", kind: "IN_SCENE" });
  // Unique words per beat so nothing is rejected as a repeat.
  const uniq = beats.map((b) => ({ ...b, narrationText: `${b.narrationText} w${b.sequence}` }));
  const at = (n: number) => (n - 1) * 4000;
  for (const [density, gapS] of [["frequent", 15], ["balanced", 25], ["minimal", 45]] as const) {
    const acc = acceptHeadlines(uniq, uniq.map((b) => ({ sequence: b.sequence, text: `W${b.sequence}` })), density);
    assertEquals(acc.total, textTarget(120, density), density); // the picture-words beat counts toward it
    assert(!acc.accepted.some((a) => a.sequence === 41), "never on an IN_SCENE beat");
    const on = new Set([...acc.accepted.map((a) => a.sequence), 41]);
    let run = 0, maxRun = 0;
    for (let n = 1; n <= 120; n++) { run = on.has(n) ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
    assert(maxRun <= 2, `${density}: max run ${maxRun}`);
    // Hook: one per 7.5 s; after it, spread over the whole video (~15 s when the density allows).
    for (let t = 0; t < HOOK_MS; t += TEXT_SLOT_MS / 2) assert([...on].some((n) => at(n) >= t && at(n) < t + TEXT_SLOT_MS / 2), `${density} hook slot ${t}`);
    const times = [...on].map(at).sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter((_, i) => times[i] >= HOOK_MS);
    assert(Math.max(...gaps) <= gapS * 1000 * 2, `${density}: max gap ${Math.max(...gaps) / 1000}s`);
    assert(times[times.length - 1] > 400_000, `${density}: text reaches the last minute (${times[times.length - 1] / 1000}s)`);
  }
});

Deno.test("priorities and styles: numbers > names > questions > reveals > contrasts > punch; BIG_STAT / QUESTION / CALLOUT from the words", () => {
  assertEquals(digitsForDisplay("THIRTY METERS BACK"), "30 METERS BACK");
  assertEquals(digitsForDisplay("SEVENTY THOUSAND YEARS"), "70,000 YEARS");
  assertEquals(digitsForDisplay("ONE PERSON'S GAMBLE"), "ONE PERSON'S GAMBLE");
  assertEquals(acceptHeadlines([...Array.from({ length: 9 }, (_, i) => beat(i + 1, `x${i}`)), beat(10, "they stood thirty meters back")], [{ sequence: 10, text: "THIRTY METERS BACK" }], "frequent").accepted[0]?.style, "BIG_STAT");
  assertEquals(categoryOf("300,000 YEARS"), "NUMBER");
  assertEquals(categoryOf("BUT WHY?"), "QUESTION");
  assertEquals(categoryOf("SCHÖNINGEN", "NAME"), "NAME");
  assertEquals(textStyleOf("300,000 YEARS"), "BIG_STAT");
  assertEquals(textStyleOf("27%"), "BIG_STAT");
  assertEquals(textStyleOf("BUT WHY?"), "QUESTION");
  assertEquals(textStyleOf("SPEAR", "the spear"), "CALLOUT");
  assertEquals(textStyleOf("NOT HUNTED — SCAVENGED"), "HEADLINE");
  // Joining words of a contrast/question may be added; content words must be in the line.
  assert(groundedIn("MYTH VS FACT", "the myth and the fact"));
  assert(groundedIn("BUT WHY?", "why would anyone chase a horse"));
  assert(!groundedIn("BUT NOT", "but not today"), "joining words alone are not a headline");
  // One slot, several candidates: the number wins over the name, the name over the punch word.
  const beats = [...Array.from({ length: 9 }, (_, i) => beat(i + 11, `filler ${i}`)), beat(20, "In Schöningen, 300,000 years ago, hunters were patient")];
  const acc = acceptHeadlines(beats, [{ sequence: 20, text: "PATIENT", category: "PUNCH" }, { sequence: 20, text: "SCHÖNINGEN", category: "NAME" }, { sequence: 20, text: "300,000 YEARS", category: "NUMBER" }], "frequent");
  assertEquals(acc.accepted.map((a) => [a.text, a.style]), [["300,000 YEARS", "BIG_STAT"]]);
  const out = applyTextPass(beats, [{ sequence: 20, text: "SPEAR", callout: "the spear", category: "NAME" }]);
  assertEquals(out[9].contract.textIntent, { mode: "SHORT_TEXT", text: "SPEAR", kind: "HEADLINE", style: "CALLOUT", category: "NAME", callout: "the spear" });
  // The prompt marks picture words and has the six priorities.
  const p = headlinePrompt([beat(1, "a sign", { mode: "SHORT_TEXT", text: "CAMP", kind: "IN_SCENE" })], 3);
  assert(p.includes("[PICTURE WORDS: CAMP]") && p.includes("(1) NUMBER") && p.includes("(6) PUNCH"));
});

Deno.test("styles drawn in code: BIG_STAT number + small label, QUESTION white, CALLOUT arrow to the object, HEADLINE when unsure", async () => {
  const base = await plate();
  assertEquals(splitStat("300,000 YEARS"), ["300,000", "YEARS"]);
  assertEquals(autoStyle("27%"), "BIG_STAT");
  const stat = await overlayText(base, "300,000 years");
  assertEquals([stat.layer.style, stat.layer.text, stat.layer.label?.text], ["BIG_STAT", "300,000", "YEARS"]);
  assert(stat.layer.label!.box.y >= stat.layer.box.y + stat.layer.box.height - 1, "label under the number");
  assert(stat.layer.label!.scale < stat.layer.scale * 0.5 && stat.layer.scale > 150, `number ${stat.layer.scale} label ${stat.layer.label!.scale}`);
  const q = await overlayText(base, "But why?");
  assertEquals([q.layer.style, q.layer.fill], ["QUESTION", "#FFFFFF"]);
  const target = { x: 900, y: 450, width: 200, height: 160 };
  const c = await overlayText(base, "Spear", { style: "CALLOUT", target });
  assertEquals(c.layer.style, "CALLOUT");
  const a = c.layer.arrow!;
  assert(a.x2 > target.x && a.x2 < target.x + target.width && a.y2 > target.y && a.y2 < target.y + target.height, `tip ${a.x2},${a.y2} inside the object`);
  assert(!overlaps(c.layer.box, target), "the label is off the object");
  assertEquals((await overlayText(base, "Spear", { style: "CALLOUT" })).layer.style, "HEADLINE");
  // Scaled to 1920 wide: the label and the arrow scale too; the video render draws every style.
  const s = scaleLayer(c.layer, 1920 / 1376);
  assertEquals(s.arrow!.x2, Math.round(a.x2 * (1920 / 1376)));
  for (const l of [scaleLayer(stat.layer, 1920 / 1376), s, scaleLayer(q.layer, 1920 / 1376)]) assert((await renderLayerPng(l)).length > 1000);
});

Deno.test("free face finder: a stickman head (flat circle, outline, two dot eyes) is found and the text moves off it", async () => {
  const head = (i: Image, cx: number, cy: number, r: number) => {
    i.drawCircle(cx, cy, r + 4, 0x000000ff); i.drawCircle(cx, cy, r, 0xd9a877ff);
    i.drawCircle(cx - Math.round(r * 0.35), cy - Math.round(r * 0.1), Math.max(2, Math.round(r * 0.09)), 0x000000ff);
    i.drawCircle(cx + Math.round(r * 0.35), cy - Math.round(r * 0.1), Math.max(2, Math.round(r * 0.09)), 0x000000ff);
  };
  const withHead = await plate((i) => head(i, 688, 130, 70));
  const { findFaces } = await import("../../supabase/functions/_shared/stickman/faceFinder.ts");
  const faces = findFaces(await Image.decode(withHead));
  assert(faces.some((f) => f.x < 688 && f.x + f.width > 688 && f.y < 130 && f.y + f.height > 130), JSON.stringify(faces));
  const r = await overlayText(withHead, "Schöningen", { style: "HEADLINE" });
  assert(!overlaps(r.layer.box, { x: 618, y: 60, width: 140, height: 140 }), `text ${JSON.stringify(r.layer.box)} covers the head`);
  // No faces on a plain plate: nothing found (the golden images are unchanged).
  assertEquals(findFaces(await Image.decode(await plate())).length, 0);
});

Deno.test("never covers a face: another band, a corner or a smaller size; blocked when there is no clear spot", async () => {
  const base = await plate();
  const face = { x: 500, y: 60, width: 380, height: 180 }; // a head in the top band
  const r = await overlayText(base, "Schöningen", { avoid: [face] });
  assert(!r.blocked && !overlaps(r.layer.box, face), JSON.stringify(r.layer.box));
  const r2 = await overlayText(base, "Schöningen", { avoidFrac: [[0.45, 0.05, 0.6, 0.35], [0.45, 0.65, 0.6, 0.95]] });
  assert(!r2.blocked, "a corner is free");
  const everywhere = await overlayText(base, "Schöningen", { avoidFrac: [[0, 0, 1, 1]] });
  assert(everywhere.blocked, "no clear spot -> blocked (the scene keeps no text)");
});
