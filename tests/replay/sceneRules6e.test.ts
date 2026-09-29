// deno-lint-ignore-file no-explicit-any
// Phase 6e-fix — scene quality rules from the f90160bc review: no writing on
// every tier, unlabelled props, one stray-text re-render, one continuous frame,
// the mitten-hand construction on close-ups, and the plan-level rules
// (repetition, splits, empty frames, people, species, absences).
import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1";
import { planRuleHits, ruleCounts } from "../../supabase/functions/_shared/stickman/planRules.ts";
import { compileOptionsFor, renderBeat, type RenderDeps } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { needsHandRule, frameRuleFor, unlabelProp, SINGLE_FRAME_RULE, TWO_HALVES_RULE, HAND_RULE } from "../../supabase/functions/_shared/stickman/promptCompiler.ts";

const fx = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/ancient-hunt.plan.json", import.meta.url)));

Deno.test("replay on f90160bc's saved 148-beat plan: 74 beats would be re-directed", () => {
  const hits = planRuleHits(fx.plan);
  assertEquals(hits.length, 74);
  const c = ruleCounts(hits);
  // The opening's ~15 campfire frames: beats 4-12 are the same place again.
  for (const n of [4, 8, 12]) assert(hits.some((h) => h.sequence === n && h.code.includes("same_place_run")), `beat ${n}`);
  assert(c.empty_frame > 0 && c.unnamed_animal > 0 && c.split_cap > 0 && c.composition_repeat > 0, JSON.stringify(c));
});

Deno.test("plan rules on small plans: place runs (HOLD counts once), splits, species, absences, people", () => {
  const b = (n: number, contract: any) => ({ sequence: n, contract: { composition: { camera: "MEDIUM" }, subjects: [{ castId: "hunter" }], ...contract }, section: "s1" });
  const same = [1, 2, 3, 4].map((n) => b(n, { settingId: "fire", visualConcept: `beat ${n}` }));
  assert(planRuleHits(same).some((h) => h.sequence === 4 && h.code.includes("same_place_run")));
  const withHold = [b(1, { settingId: "fire" }), b(2, { settingId: "fire", flags: { hold: true } }), b(3, { settingId: "fire" }), b(4, { settingId: "fire" })];
  assert(!planRuleHits(withHold).some((h) => h.code.includes("same_place_run")), "a HOLD counts once");
  const hits = planRuleHits([b(1, { settingId: "a", visualConcept: "Hunter chases an animal across the plain" }), b(2, { settingId: "b", visualConcept: "Empty ground where a hunter would stand" }), b(3, { settingId: "c", treatment: "SPLIT" }), b(4, { settingId: "d", treatment: "SPLIT" })]);
  assert(hits.some((h) => h.sequence === 1 && h.code === "unnamed_animal"));
  assert(hits.some((h) => h.sequence === 2 && h.code.includes("absence")));
  assert(hits.some((h) => h.sequence === 4 && h.code.includes("split_cap")));
  assert(!planRuleHits([b(1, { visualConcept: "A bison charges the hunter" })]).some((h) => h.code === "unnamed_animal"));
});

Deno.test("compiler: no writing on every tier (unless the words belong in the picture), unlabelled props, one frame, mitten hands", () => {
  assertEquals(compileOptionsFor("V3", { textIntent: { mode: "NO_TEXT" } }).noTextAnywhere, true);
  assertEquals(compileOptionsFor("V3", { textIntent: { mode: "SHORT_TEXT", text: "MUSEUM" } }).noTextAnywhere, false);
  assertEquals(compileOptionsFor("V2", { textIntent: { mode: "SHORT_TEXT", text: "X" } }).noTextAnywhere, true);
  assertMatch(unlabelProp("A tray of butchered bones with labels, next to residue vials"), /blank labels/);
  // The proof's leak (54/87/88): label strips dropped, "labeled" objects are just objects.
  const lab = unlabelProp("far background a clean off-white wall band with a small display label strip; foreground labeled butchered bones. Signature objects: small labeled mounts");
  assert(!/label strip|labeled/i.test(lab), lab);
  assertStringIncludes(lab, "wall band;");
  assertEquals(frameRuleFor({ treatment: "STORY_SCENE" }, false), SINGLE_FRAME_RULE);
  assertEquals(frameRuleFor({ treatment: "COMPARISON" }, false), TWO_HALVES_RULE);
  assertStringIncludes(SINGLE_FRAME_RULE, "not a comic grid, not panels");
  assert(needsHandRule({ subjects: [{ presence: "hands" }] }, "hands grip a spear"));
  assert(needsHandRule({ composition: { camera: "EXTREME_CLOSE_UP" } }, "Tiny stone point beside a thumbnail"));
  assert(!needsHandRule({ composition: { camera: "WIDE" } }, "A herd crosses the plain"));
  assertStringIncludes(HAND_RULE, "solid black rounded mitten hands");
});

Deno.test("V3/V4: stray text on a no-text beat gets ONE re-render; the cleaner frame wins", async () => {
  const calls: string[] = [];
  let n = 0;
  const ocr = ["BUTCHERED BONES", ""];
  const deps: RenderDeps = {
    compile: (c) => ({ prompt: `P:${c.textIntent?.mode}`, positivePrompt: "pp", negativePrompt: "np" }),
    render: async () => { n++; calls.push("render"); return { imageURL: `img${n}`, cost: 0.03 }; },
    qa: async (url) => { const i = Number(url.slice(3)) - 1; const t = ocr[i] ?? ""; return { pass: t === "", score: t === "" ? 1 : 0.6, ocrText: t, cost: 0.002 }; },
    postProcess: async () => ({ bytes: new Uint8Array([1]), cost: 0.0006 }),
    overlay: async (b) => b,
  };
  const r = await renderBeat("V3", { startMs: 60_000, contract: { textIntent: { mode: "NO_TEXT" } } }, deps);
  assertEquals(r.imageURL, "img2");
  assertEquals(r.log.map((l) => l.step), ["render", "stray text retry", "upscale 1920x1080"]);
});

Deno.test("director wiring: the rules pass re-directs hit beats in one call; the script prompt favours story over method", () => {
  const d = Deno.readTextFileSync(new URL("../../supabase/functions/_shared/stickman/beatDirector.ts", import.meta.url));
  assertMatch(d, /const hits = planRuleHits\(/);
  assertMatch(d, /redirectUserPrompt\(assembled, hits\.map/);
  for (const s of ["SPECIES AND PRESENCE", "ONE PICTURE", "at least 3 different settings OR camera distances", "EVIDENCE beats"]) assertStringIncludes(d, s);
  assertStringIncludes(Deno.readTextFileSync(new URL("../../supabase/functions/advance-long-form-script/index.ts", import.meta.url)), "AT MOST ONE short sentence per section about how researchers know it");
});
