// deno-lint-ignore-file no-explicit-any
// Phase 4d — fixes for the V2 faults found in the by-eye review of all 136 frames.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  compileBeatPrompt, canonicalSetFromBible, STYLE_HEADER, NO_PEOPLE_STYLE_HEADER, NO_PEOPLE_RULE, PICTURED_PEOPLE_RULE, OBJECTS_NO_FACES,
  V2_NO_TEXT_INSTRUCTION, UNLABELED_TIMELINE, peopleMode, plainWords, scrubForNoText, caseLine,
} from "../../supabase/functions/_shared/stickman/promptCompiler.ts";
import { compileOptionsFor } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { contentIssues, IP_MARKS, redirectUserPrompt, buildBibleIndex, markRewrites, buildWordStream, BEAT_DIRECTOR_INSTRUCTIONS } from "../../supabase/functions/_shared/stickman/beatDirector.ts";
const bibleSource = await Deno.readTextFile(new URL("../../supabase/functions/_shared/stickman/productionBible.ts", import.meta.url));

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, import.meta.url)));
const plan = await read("../fixtures/stickman/beats/myth-vs-reality.phase4c3.json");
const set = canonicalSetFromBible(plan.bible);
const beat = (n: number) => plan.beats.find((b: any) => b.sequence === n);
const v2 = (n: number, contract?: any) => compileBeatPrompt({ ...beat(n), contract: contract ?? beat(n).contract }, set, compileOptionsFor("V2"));

Deno.test("no-people rule: a beat with no cast drops the stickman anatomy and says so; cast beats keep it and ban faces on objects", () => {
  for (const n of [19, 22, 29, 31, 51, 119, 125, 129]) {
    const p = v2(n);
    assert(p.prompt.startsWith(NO_PEOPLE_STYLE_HEADER + "\n"), `beat ${n}`);
    assert(!p.prompt.includes("Every person is a stickman"), `beat ${n}`);
    assertStringIncludes(p.prompt, "This image contains no people and no stick figures");
  }
  const cast = v2(25);
  assert(cast.prompt.startsWith(STYLE_HEADER + "\n"));
  assertStringIncludes(STYLE_HEADER, OBJECTS_NO_FACES);
  assertEquals(peopleMode({ subjects: [], treatment: "CROWD" }, "an empty hall"), "live");
  assertEquals(peopleMode({ subjects: [], treatment: "OBJECT_DETAIL" }, "Rows of finished canvases show horned warriors mid-battle"), "pictured");
  assertStringIncludes(v2(85).prompt, PICTURED_PEOPLE_RULE);
});

Deno.test("display cases contain only their object (the prop's name when there is one)", () => {
  assertStringIncludes(v2(130).prompt, "The display case contains only the Gjermundbu helmet; no person or stick figure is inside any case.");
  assertStringIncludes(v2(21).prompt, "The display case contains only");
  assertEquals(caseLine("a sunny field", "a sunny field", []), null);
});

Deno.test("V2 draws no text: overlay-only instruction, unlabeled timeline ticks, digits and text phrases scrubbed from the concept", () => {
  const p = v2(99);
  assertStringIncludes(p.prompt, V2_NO_TEXT_INSTRUCTION);
  assertStringIncludes(p.prompt, UNLABELED_TIMELINE);
  const frame = p.prompt.split("\n")[1];
  assert(!/\d/.test(frame), frame);
  assertStringIncludes(frame, "unlabeled tick marks");
  assertEquals(scrubForNoText("Big red stamp reading NO EVIDENCE, crossed with a question mark"), "Big red stamp, crossed with a question mark");
  assert(!/\d/.test(scrubForNoText("Timeline bar highlighting 793 to 1066")));
  // Every V2 prompt carries the instruction, not only text beats.
  for (const n of [1, 40, 76, 130]) assertStringIncludes(v2(n).prompt, V2_NO_TEXT_INSTRUCTION);
  assertEquals(compileOptionsFor("V3").noTextAnywhere, false);
});

Deno.test("IP guard: HARD compiler lint and a director issue; generic equivalents pass", () => {
  const logo = v2(100);
  assert(logo.lintErrors.some((e) => e.startsWith("ip_reference:")), JSON.stringify(logo.lintErrors));
  assert(v2(98).lintErrors.some((e) => e.includes("Flash Gordon")));
  const generic = v2(100, { ...beat(100).contract, visualConcept: "a football team's horned-helmet logo on a banner beside a timeline dot" });
  assertEquals(generic.lintErrors.filter((e) => e.startsWith("ip_reference")), []);
  assert(contentIssues(beat(101).contract, beat(101).narrationText).some((i) => i.code === "real_ip"));
  assert(!IP_MARKS.test("a Viking warrior from Minnesota's history") && !IP_MARKS.test("Norse god Thor"));
  assertStringIncludes(BEAT_DIRECTOR_INSTRUCTIONS, "IP GUARD");
});

Deno.test("filler guard: a headline beat needs a device that works without text; plain-word props", () => {
  for (const n of [96, 117]) assert(contentIssues(beat(n).contract, beat(n).narrationText).some((i) => i.code === "filler_headline"), `beat ${n}`);
  assert(!contentIssues(beat(21).contract, beat(21).narrationText).some((i) => i.code === "filler_headline"), "an empty shelf with one helmet case is a device");
  assertEquals(plainWords("Close on the spectacled guard curving over the eyes"), "Close on a goggle-shaped iron eye-and-nose guard");
  assert(!set.props.gjermundbu_helmet.block.includes("spectacle"), set.props.gjermundbu_helmet.block);
  assertStringIncludes(bibleSource, "objectLanguage: { type: \"array\", items: OBJECT_LANGUAGE_SCHEMA, maxItems: 10");
  assertStringIncludes(bibleSource, "PROP BLOCKS FOR NAMED OBJECTS");
});

Deno.test("location run: the 4th beat in a row at one place is rewritten (outside the hook); redirect prompt addresses beats by B-number", () => {
  const stream = buildWordStream([{ id: "s1", text: plan.beats.map((b: any) => b.narrationText).join(" ") }]);
  let w = 0;
  const beats = plan.beats.slice(105, 114).map((b: any) => {
    const n = b.narrationText.split(/\s+/).length;
    const out = { ...b.contract, startWord: w + 500, endWord: w + 500 + n - 1 };
    w += n;
    return out;
  });
  const marked = markRewrites(beats, null, Infinity, stream);
  assert(beats.some((b: any) => (b.rewriteCodes ?? []).includes("location_run")), JSON.stringify(marked));
  const idx = buildBibleIndex(plan.bible);
  const prompt = redirectUserPrompt(plan.beats, [{ sequence: 100, fix: "real team logo" }], idx);
  assertStringIncludes(prompt, "NEEDS CONTRACT B100 ");
  assertStringIncludes(prompt, "context B99 ");
  assertStringIncludes(prompt, "context B101 ");
  assertStringIncludes(prompt, 'Return "b" containing ONLY the 1 NEEDS CONTRACT beat(s)');
});

Deno.test("Phase 5a: objects rule on every beat (cast too), blank text objects on V2, IP lookalikes, mirrors are not cases", async () => {
  const { blankTextObjects, OBJECTS_NO_FACES: rule } = await import("../../supabase/functions/_shared/stickman/promptCompiler.ts");
  const { IP_LOOKALIKE } = await import("../../supabase/functions/_shared/stickman/beatDirector.ts");
  for (const n of [24, 128, 1]) assertStringIncludes(v2(n).prompt, rule);
  assertStringIncludes(rule, "display cases contain only their object");
  assertEquals(blankTextObjects("Horned logo on a flag, a beer label, a football helmet"), "Horned logo on a flag, a blank beer label, a football helmet");
  assertStringIncludes(blankTextObjects("hands flip through an Old Norse manuscript"), "manuscript of wavy scribble lines");
  assert(!blankTextObjects("An old comic-book page: a space hero").includes("scribble"));
  assert(!v2(131, { ...beat(131).contract }).prompt.includes("SOLD OUT"));
  assert(IP_LOOKALIKE.test("a hero in a horned golden helmet and a flowing cape"));
  assert(!IP_LOOKALIKE.test("a space hero in a round glass bubble helmet and a striped suit"));
  assert(contentIssues({ ...beat(98).contract, visualConcept: "A comic hero in a horned golden helmet with a red cape" }, "").some((i) => i.code === "real_ip"));
  assertStringIncludes(v2(136).prompt, "there is no display case in this image");
});
