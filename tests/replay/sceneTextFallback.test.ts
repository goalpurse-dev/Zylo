// 596af432 (8 scenes "Couldn't draw this scene", Regenerate spinning): a prop
// with writing ("a red label reading NON-REFUND", "a card with the handwritten
// label 'NON-REFUND / Must decide by [date]'") was unlabelled in the prompt but
// the lint still required the labelled block -> every draw and redraw failed
// the prompt check. Plus: words stripped from no-text pictures, the safe
// fallback draw, and the free "Try again" for failed scenes.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { canonicalSetFromBible, compileBeatPrompt, stripWrittenText, unlabelProp } from "../../supabase/functions/_shared/stickman/promptCompiler.ts";
import { safeFallbackContract, TEXT_BEARING } from "../../supabase/functions/_shared/stickman/sceneFallback.ts";
import { SCENE_LADDER } from "../../supabase/functions/_shared/stickman/sceneLadder.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const SCREEN = "A smartphone confirmation screen showing the ticket title and bold price line with a prominent red label reading 'NON-REFUND' above a small purchase summary.";
const CARD = "A small paper card with the handwritten label 'NON-REFUND / Must decide by [date]' representing a self-imposed deadline.";
// A real canonical set (the myth-vs-reality fixture) + the two text-bearing props from 596af432.
const base = canonicalSetFromBible(JSON.parse(Deno.readTextFileSync(new URL("../fixtures/stickman/bibles/myth-vs-reality.rebuilt-v3.json", import.meta.url))).bible);
const set: any = { ...base, props: { ...base.props, nonrefundable_ticket_screen: { id: "nonrefundable_ticket_screen", block: SCREEN }, self_imposed_deadline_card: { id: "self_imposed_deadline_card", block: CARD } } };
const SETTING = Object.keys(base.settings)[0];
const CAST = Object.keys(base.cast)[0];
const beat = (contract: any) => ({ sequence: 2, startMs: 0, endMs: 3000, narrationText: "confirmation screen, and right under the price,", contract });
const screenBeat = { propIds: ["nonrefundable_ticket_screen"], subjects: [], settingId: SETTING, treatment: "OBJECT_DETAIL", textIntent: { mode: "NO_TEXT", text: null }, composition: { camera: "EXTREME_CLOSE_UP", framing: "tight on price line" }, userSummary: "Close on the confirmation screen just above the price line", visualConcept: "Close on the confirmation screen just above the price line." };

Deno.test("no-text picture: a prop with writing compiles and passes the prompt check (was canonical_block_missing_or_altered)", () => {
  const p = compileBeatPrompt(beat(screenBeat), set, { noTextAnywhere: true });
  assertEquals(p.lintErrors, []);
  assert(!/NON-REFUND/.test(p.prompt), p.prompt);
  assertMatch(p.prompt, /red blank label above a small purchase summary/);
});

Deno.test("a HELD prop with writing is unlabelled too (no quoted text in the picture)", () => {
  const held = { ...screenBeat, propIds: [], subjects: [{ castId: CAST, presence: "hands", action: "writes deadline early", expression: "", holding: ["self_imposed_deadline_card"] }] };
  const p = compileBeatPrompt(beat(held), set, { noTextAnywhere: true });
  assertEquals(p.lintErrors, []);
  assert(!/NON-REFUND|\[date\]/.test(p.prompt));
});

Deno.test("stripWrittenText: reading/quoted/ALL-CAPS words go, the object stays", () => {
  assertEquals(stripWrittenText("a red label reading NON-REFUND above a summary"), "a red label above a summary");
  assertEquals(stripWrittenText("an envelope 'bonus' next to a mug"), "an envelope next to a mug");
  assertEquals(stripWrittenText("the viewer's mug"), "the viewer's mug"); // apostrophes are not quotes
  assertEquals(unlabelProp(CARD), "A small paper card with the handwritten blank label representing a self-imposed deadline.");
});

Deno.test("safe fallback: same idea, nothing with writing, a plain composition, words as an overlay", () => {
  const c = safeFallbackContract({ ...screenBeat, treatment: "SPLIT", textIntent: { mode: "SHORT_TEXT", text: "NON-REFUND" } }, set);
  assertEquals(c.propIds, []);
  assertEquals(c.treatment, "STORY_SCENE");
  assertEquals(c.composition.camera, "MEDIUM");
  assertEquals(c.textIntent, { mode: "PROGRAMMATIC", text: "NON-REFUND", zone: "top", kind: "HEADLINE" });
  assertMatch(c.visualConcept, /no screens, papers, cards, signs or anything with writing/);
  assert(TEXT_BEARING.test(CARD));
  assertEquals(compileBeatPrompt(beat(c), set, { noTextAnywhere: true }).lintErrors, []);
  // 2026-10-07: the safe draw comes after the retries, and once more on the backup model (sceneNeverStuck.test.ts).
  assertEquals(SCENE_LADDER.map((r) => r.kind), ["normal", "normal", "normal", "normal", "safe", "backup"]);
});

Deno.test("wiring: the worker falls back to the safe draw; the render covers holes; failed scenes say Try again (free)", () => {
  const w = read("supabase/functions/render-long-form-scene/index.ts");
  assertMatch(w, /const contract = rung !== "normal" \|\| textFree \? safeFallbackContract\(beat\.contract, set\) : beat\.contract;/);
  // 2026-10-07: a failed scene no longer refuses the render; it is covered by the picture before it.
  assertMatch(read("supabase/functions/long-form-render/index.ts"), /a render is never refused for a scene's picture/);
  const ui = read("src/pages/workspace/long-form/scenes.jsx");
  assertMatch(ui, /Try again \(free\)/);
  assertMatch(ui, /const flaggedCost = \(data\.counts\.flagged - failedFlagged\) \* data\.creditsPerScene;/);
  // The server already redraws a failed scene for 0 credits.
  assertMatch(read("supabase/functions/update-long-form-scene/index.ts"), /olds\.get\(n\)\?\.status === "failed" \? 0 : credits/);
});

// ---- V2 text-free from the start + the Runware balance guard ----
import { needsTextFreeComposition, wordsOnObjects } from "../../supabase/functions/_shared/stickman/sceneFallback.ts";
import { guardDecision, isFresh, OUT_OF_BALANCE } from "../../supabase/functions/_shared/runwareBalance.ts";

Deno.test("V2: a scene built around a screen/card is text-free from the start; its words become the overlay", () => {
  assert(needsTextFreeComposition("V2", screenBeat, set));
  assert(!needsTextFreeComposition("V3", screenBeat, set)); // V3/V4 OCR-check their words
  assert(!needsTextFreeComposition("V2", { ...screenBeat, propIds: [] , settingId: SETTING }, base as any) || /screen|sign|card|label/i.test(JSON.stringify((base as any).settings[SETTING])));
  assertEquals(wordsOnObjects(screenBeat, set), "NON-REFUND");
  const c = safeFallbackContract(screenBeat, set);
  assertEquals(c.textIntent.text, "NON-REFUND");
  assertEquals(c.textIntent.kind, "HEADLINE");
});

Deno.test("balance guard: below the threshold pauses (alert once), above resumes, a failed read keeps the state", () => {
  const row = { threshold_usd: 20, balance_usd: 50, checked_at: null, paused: false, paused_since: null, alerted_at: null };
  const now = "2026-10-02T12:00:00.000Z";
  assertEquals(guardDecision(row, 12.5, now), { paused: true, pausedSince: now, alert: true, resumed: false });
  assertEquals(guardDecision({ ...row, paused: true, paused_since: "x" }, 8, now), { paused: true, pausedSince: "x", alert: false, resumed: false });
  assertEquals(guardDecision({ ...row, paused: true, paused_since: "x" }, 120, now), { paused: false, pausedSince: null, alert: false, resumed: true });
  assertEquals(guardDecision({ ...row, paused: true, paused_since: "x" }, null, now).paused, true);
  assert(isFresh("2026-10-02T11:59:30.000Z", now) && !isFresh("2026-10-02T11:58:00.000Z", now));
  assert(OUT_OF_BALANCE.test("Insufficient available balance. Some of your credits are currently reserved"));
  const w = read("supabase/functions/render-long-form-scene/index.ts");
  assertMatch(w, /if \(guard\.paused\) return ok\(req, \{ ok: true, claimed: false, paused: true \}\);/);
  assertMatch(w, /status: "queued", lease_until: null/); // out of balance -> the scene waits
  assertMatch(read("src/pages/workspace/long-form/scenes.jsx"), /Drawing is paused for a moment, your video continues automatically\./);
});

Deno.test("fallback idea text always passes the prompt check (2f1b7e40 beat 32: 'again'); V2 SHORT_TEXT scenes go text-free too", async () => {
  const { cleanIdea } = await import("../../supabase/functions/_shared/stickman/sceneFallback.ts");
  assertEquals(cleanIdea(`The hunter tries again, same as before, with the "spear"`), "The hunter tries, with the spear");
  const c = safeFallbackContract({ ...screenBeat, propIds: [], userSummary: "He throws again and misses" }, set);
  assertEquals(compileBeatPrompt(beat(c), set, { noTextAnywhere: true }).lintErrors, []);
  assert(needsTextFreeComposition("V2", { ...screenBeat, textIntent: { mode: "SHORT_TEXT", text: "NON-REFUND" } }, set));
});
