// deno-lint-ignore-file no-explicit-any
// Phase 4c — the bible's required-people checklist and the code fallback.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { requiredPeople, addMissingCast, validateBible, isSoftBibleError, buildDraftPrompt, castTextOf, castCovers } from "../../supabase/functions/_shared/stickman/productionBible.ts";

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, import.meta.url)));
const recorded = await read("../fixtures/stickman/beats/myth-vs-reality.recorded.json");
const script = recorded.segments.map((s: any) => s.text).join(" ");
const v5 = (await read("../fixtures/stickman/bibles/myth-vs-reality.rebuilt-v5.json")).bible;

Deno.test("checklist: named people cover their own role; raiders count as warriors; once-mentioned generic roles are left out", () => {
  const req = requiredPeople(script);
  const labels = req.map((p) => p.label);
  for (const n of ["Roberta Frank", "Richard Wagner", "Carl Emil Doepler", "Gustav Malmstrom", "Alex Raymond"]) assert(labels.includes(n), n);
  for (const r of ["warrior", "archaeologist"]) assert(req.some((p) => p.kind === "role" && p.key === r), r);
  for (const r of ["historian", "composer", "designer", "painter", "cartoonist", "raider", "worker", "collector", "chieftain"]) assert(!req.some((p) => p.kind === "role" && p.key === r), `${r} should not be a separate entry`);
  assert(req.length <= 14, `${req.length} entries (+ 2 viewers fits in 16)`);
  const prompt = JSON.parse(buildDraftPrompt({ topic: "t", viewerPromise: "", narrativeStrategy: "", finalScript: script, researchNotes: "", targetAudience: "" }));
  assertStringIncludes(prompt.peopleThisScriptNames.join(" | "), 'Richard Wagner (the composer; covers "composer"');
});

Deno.test("fallback: the v5 bible's missing people are added by code from role templates, with a warning each — never a block", () => {
  const { bible, added } = addMissingCast(v5, script);
  for (const n of ["Roberta Frank", "Richard Wagner", "Carl Emil Doepler", "warrior"]) assert(added.includes(n), `${n} added (${added})`);
  const castText = castTextOf(bible);
  for (const p of requiredPeople(script)) assert(castCovers(castText, p), p.label);
  const wagner = bible.roleArchetypes.find((a: any) => a.id === "richard_wagner")!;
  assertEquals(wagner.identity!.displayName, "Richard Wagner, a composer");
  assertStringIncludes(wagner.identity!.outfit, "shape on the torso");
  const errors = validateBible(bible, script);
  assert(!errors.some((e) => /ROLE_NOT_CAST|NAMED_PERSON_NOT_CAST|VIEWER_CONTEXT_MISSING|NO_CAST/.test(e)), errors.join("; "));
  assert(!errors.some((e) => e.includes("richard_wagner") || e.includes("roberta_frank")), "code-added entries pass the standalone checks");
  assert(bible.roleArchetypes.length <= 16);
  assert(isSoftBibleError("CAST_ADDED_BY_CODE:Richard Wagner"));
});

Deno.test("fallback adds a missing era viewer too (viewer_modern) and never exceeds 16 entries", () => {
  const noModern = { ...v5, roleArchetypes: v5.roleArchetypes.filter((a: any) => a.id !== "viewer_modern") };
  const { bible, added } = addMissingCast(noModern, script);
  assert(added.includes("viewer_modern"), JSON.stringify(added));
  assertEquals(bible.roleArchetypes.find((a: any) => a.id === "viewer_modern")!.identity!.displayName, "The viewer today");
  const full = { ...v5, roleArchetypes: Array.from({ length: 16 }, (_, i) => ({ ...v5.roleArchetypes[0], id: `x${i}` })) };
  assertEquals(addMissingCast(full, script).bible.roleArchetypes.length, 16);
});
