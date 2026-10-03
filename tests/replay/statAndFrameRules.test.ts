// 2f1b7e40 follow-ups: beat 19 ("roughly three hundred thousand years ago" over a bare
// timeline) had no on-screen number; beat 121 (a COMPARISON of foreground vs background)
// came out as two panels.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { ensureStatOverlays, mandatoryStatIntent, statFromLine } from "../../supabase/functions/_shared/stickman/headlines.ts";
import { wantsTwoHalves, frameRuleFor, SINGLE_FRAME_RULE, TWO_HALVES_RULE } from "../../supabase/functions/_shared/stickman/promptCompiler.ts";
import { plainWarnings } from "../../supabase/functions/_shared/stickman/scenes.ts";
const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));

Deno.test("a number over a timeline/chart/symbol is always on screen, from the line's own words", () => {
  assertEquals(statFromLine("roughly three hundred thousand years ago."), "300,000 YEARS AGO");
  assertEquals(statFromLine("they placed the site close to seven hundred ninety thousand years ago -"), "790,000 YEARS AGO");
  assertEquals(statFromLine("In 1948 a farmer found it"), "1948");
  assertEquals(statFromLine("about forty percent of them never came back"), "40 PERCENT");
  assertEquals(statFromLine("they drew one chart for it"), null); // "one" is not a stat
  const intent = mandatoryStatIntent({ treatment: "TIMELINE_BAR", textIntent: { mode: "NO_TEXT", text: null } }, "roughly three hundred thousand years ago.");
  assertEquals(intent.text, "300,000 YEARS AGO");
  assertEquals([intent.mode, intent.kind], ["PROGRAMMATIC", "HEADLINE"]);
  assertEquals(mandatoryStatIntent({ treatment: "STORY_SCENE", textIntent: { mode: "NO_TEXT" } }, "three hundred thousand years ago"), null); // only device pictures
  assertEquals(mandatoryStatIntent({ treatment: "TIMELINE_BAR", textIntent: { mode: "SHORT_TEXT", text: "300K YEARS" } }, "three hundred thousand years ago"), null); // planned text wins
  const out = ensureStatOverlays([{ sequence: 19, narrationText: "roughly three hundred thousand years ago.", contract: { treatment: "TIMELINE_BAR", textIntent: { mode: "NO_TEXT" } } }]);
  assertEquals(out.added, 1);
  assertMatch(read("supabase/functions/build-stickman-beat-plan/index.ts"), /ensureStatOverlays\(result\.beats\)/);
  assertMatch(read("supabase/functions/render-long-form-scene/index.ts"), /const stat = mandatoryStatIntent\(beat\.contract, beat\.narrationText\);/);
});

Deno.test("one continuous frame unless two sides are named; a split picture is re-rendered then flagged", () => {
  const camp = { treatment: "COMPARISON", visualConcept: "A thriving camp of hunters works together beyond a tiny needle in the foreground", composition: { framing: "wide camp beyond needle" } };
  assert(!wantsTwoHalves(camp));
  assertEquals(frameRuleFor(camp, false), SINGLE_FRAME_RULE);
  assert(wantsTwoHalves({ treatment: "COMPARISON", visualConcept: "A bone needle side by side with a stone awl" }));
  assertEquals(frameRuleFor({ treatment: "SPLIT", visualConcept: "x" }, false), TWO_HALVES_RULE);
  assertEquals(plainWarnings(["split_frame"]), ["Split into two panels instead of one picture"]);
  assertMatch(read("supabase/functions/_shared/stickman/renderTiers.ts"), /"split frame retry"/);
});
