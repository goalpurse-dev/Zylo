// Blocky Worlds board-only launch mode: the free PLANTED-OBJECT SWAP (boardFit.js propSwap / swapIdea / fittingWithSwap),
// the signed-out board sample cards, and the swap hint for the writers. All free.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOARD_KIT } from "../supabase/functions/_shared/blockyWorlds/boardKit.js";
import { fittingOnly, fittingWithSwap, kitFit, kitView, propFilmable, propSwap, SWAP_CATEGORIES, swapHint, swapIdea } from "../supabase/functions/_shared/blockyWorlds/boardFit.js";
import { EXAMPLE_IDEAS } from "../supabase/functions/_shared/blockyWorlds/examples.js";
import { pickedIdeaBlock } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";
import { BOARD_SAMPLE_IDEAS } from "../src/components/viral-tools/blocky-worlds/boardSamples.js";

const LIBRARY = JSON.parse(readFileSync(new URL("../src/components/viral-tools/blocky-worlds/dev/libraryFixture.json", import.meta.url), "utf8"));

test("every swap target is a thing the board kit can film", () => {
  const v = kitView();
  for (const c of SWAP_CATEGORIES) assert.ok(c.to.some((id) => v.props.some((p) => p.id === id || p.words.includes(id))), c.id);
});

test("propSwap keeps the object's job: food -> food, clothes -> clothes, drawing -> drawing; binding things are not swapped", () => {
  const to = (p) => propSwap(p)?.to ?? null;
  assert.equal(to("A burnt black slice of toast"), "cookie");
  assert.equal(to("A stale bagel in her backpack"), "cookie");
  assert.equal(to("Her squeaky left boot"), "sock");
  assert.equal(to("a stub of chalk"), "crayon");
  assert.equal(to("A little jar of pepper"), "flower", "a sneeze story keeps something to sneeze at");
  assert.equal(to("A tin of cocoa powder"), "cup", "the two-word name wins");
  assert.equal(to("Wooden step stool"), "table");
  assert.equal(to("A tiny pencil sharpener"), "pencil", "a kit prop in the phrase is the thing");
  assert.equal(to("a bucket of mud"), "bucket");
  assert.equal(to("A roll of masking tape"), null, "no kit thing tapes: no swap, the idea stays out");
  assert.equal(to("Mom's sewing scissors"), null);
  assert.equal(propSwap("a flashlight"), null, "already filmable");
});

test("swapIdea rewrites the card fields deterministically; a swapped idea fits", () => {
  const toast = LIBRARY.find((r) => /slice of toast on the curb/.test(r.idea.opener)).idea;
  assert.equal(kitFit(toast).fit, false);
  const s = swapIdea(toast);
  assert.equal(swapIdea(toast).opener, s.opener, "the same in, the same out");
  assert.match(s.opener, /one cookie on the curb/);
  assert.ok(!/toast/i.test([s.opener, s.premise, s.price, s.twist, s.closer, ...s.examples].join(" ")));
  assert.equal(s.swap.category, "bread");
  assert.equal(kitFit(s).fit, true);
  assert.ok(propFilmable(s.prop));
  const chalk = LIBRARY.find((r) => /chalk circle on the floor/.test(r.idea.opener)).idea;
  assert.match(swapIdea(chalk).opener, /a crayon circle on the floor/, "a kind-of word stays singular");
  assert.equal(swapIdea(EXAMPLE_IDEAS.find((i) => kitFit(i).fit)), EXAMPLE_IDEAS.find((i) => kitFit(i).fit), "a fitting idea is unchanged");
});

test("the library fixture: fit before and after the swap (the 2026-11-12 numbers), every row it keeps fits", () => {
  const before = fittingOnly(LIBRARY).length, after = fittingWithSwap(LIBRARY);
  assert.equal(before, 12);
  assert.ok(after.length >= 40 && after.length <= 48, `after ${after.length}`);
  for (const r of after) assert.ok(kitFit(r.idea).fit, r.id);
  // the library row's id and stats ride along; only the idea is the swapped copy
  const swapped = after.find((r) => r.idea.swap);
  assert.equal(swapped.id, LIBRARY.find((x) => x.id === swapped.id).id);
  for (const mood of ["funny", "horror", "wholesome", "epic"]) assert.ok(after.filter((r) => r.idea.mood === mood).length >= 4, mood);
});

test("signed-out board samples: six judged live ideas that fit with no swap, plus the examples that fit", () => {
  assert.equal(BOARD_SAMPLE_IDEAS.length, 6);
  for (const i of BOARD_SAMPLE_IDEAS) {
    assert.equal(kitFit(i).fit, true, i.title);
    assert.ok(LIBRARY.some((r) => r.id === i.libraryId && r.idea.opener === i.opener), `${i.title} is a live library idea`);
  }
  assert.deepEqual([...new Set(BOARD_SAMPLE_IDEAS.map((i) => i.mood))].sort(), ["epic", "funny", "horror", "wholesome"]);
  assert.equal(fittingWithSwap(EXAMPLE_IDEAS).length, 2, "only 2 of the 6 examples fit (world-level misses, not props)");
  const story = readFileSync(new URL("../src/components/viral-tools/blocky-worlds/StoryStep.jsx", import.meta.url), "utf8");
  assert.match(story, /\.\.\.BOARD_SAMPLE_IDEAS\.map\(/);
});

test("the writers get the swap as a hint (the plan writer's picked idea, the library script writer's note)", () => {
  const toast = swapIdea(LIBRARY.find((r) => /slice of toast on the curb/.test(r.idea.opener)).idea);
  const block = pickedIdeaBlock(toast);
  assert.ok(block.includes(swapHint(toast.swap)));
  assert.match(swapHint(toast.swap), /moved into the kit we can film: A burnt black cookie \(the idea had A burnt black slice of toast\)/);
  assert.ok(!pickedIdeaBlock(LIBRARY[0].idea).includes("moved into the kit"), "no swap, no hint");
  const llm = readFileSync(new URL("../supabase/functions/_shared/blockyWorlds/llm.js", import.meta.url), "utf8");
  assert.match(llm, /idea\?\.swap \? swapHint\(idea\.swap\) : ""/);
  const index = readFileSync(new URL("../supabase/functions/blocky-worlds-api/index.ts", import.meta.url), "utf8");
  assert.match(index, /pickForUser\(LAUNCH_BOARD \? fittingWithSwap\(cands \?\? \[\]\) : cands \?\? \[\], IDEAS_PER_BATCH, mood\)/);
  assert.ok(BOARD_KIT.props.length > 0);
});
