// deno-lint-ignore-file no-explicit-any
// Phase 6c-polish — text kinds + headline pass, plain names, real-image-only
// flags, true duplicates, and a plan cost cap that scales with the script.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { acceptHeadlines, applyTextPass, groundedIn, spokenNumbersToDigits, textKindOf, textTarget, headlineScore } from "../../supabase/functions/_shared/stickman/headlines.ts";
import { contractForTier } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { plainNames, plainWarnings } from "../../supabase/functions/_shared/stickman/scenes.ts";
import { duplicateScenes, hashDistance } from "../../supabase/functions/_shared/stickman/imageChecks.ts";
import { planCostCapUsd } from "../../supabase/functions/_shared/stickman/beatDirector.ts";
import { decideScenes } from "../../supabase/functions/_shared/stickman/scenes.ts";

const beat = (n: number, line: string, textIntent: any = { mode: "NO_TEXT", text: null }, visualConcept = "") => ({ sequence: n, narrationText: line, contract: { textIntent, visualConcept } });

Deno.test("HEADLINE text is a code overlay on EVERY tier; IN_SCENE is drawn by V3/V4 and blank on V2", () => {
  const head = { textIntent: { mode: "SHORT_TEXT", text: "300,000 YEARS", kind: "HEADLINE" } };
  for (const t of ["V2", "V3", "V4"] as const) assertEquals(contractForTier(t, head).overlayText, "300,000 YEARS");
  const sign = { textIntent: { mode: "SHORT_TEXT", text: "MUSEUM" }, visualConcept: "a museum sign above the door" };
  assertEquals(textKindOf(sign), "IN_SCENE");
  assertEquals(contractForTier("V3", sign).overlayText, null);
  assertEquals(contractForTier("V2", sign).contract.textIntent.mode, "NO_TEXT");
  // f90160bc's director text "27% from tip" (PROGRAMMATIC) was lost on V3 — now it's a headline overlay.
  assertEquals(contractForTier("V3", { textIntent: { mode: "PROGRAMMATIC", text: "27% from tip" } }).overlayText, "27% from tip");
});

Deno.test("headline pass: density target, <= 5 words, from the line (spoken numbers ok), no 3 in a row, best first", () => {
  // Text upgrade: ~1 in 5 scenes by default (was 14%).
  assertEquals(textTarget(148, "balanced"), 30);
  assertEquals(spokenNumbersToDigits("AROUND SEVENTY THOUSAND YEARS AGO"), "AROUND 70000 YEARS AGO");
  assert(groundedIn("70,000 YEARS", "around seventy thousand years ago"));
  assert(groundedIn("SCHÖNINGEN", "The spears from Schöningen"));
  assert(!groundedIn("TEAMWORK", "they hunted together"));
  const beats = Array.from({ length: 20 }, (_, i) => beat(i + 1, `line ${i + 1} about 1995 and hunting pits and the killing ground`));
  beats[9] = beat(10, "the spear is 27% from the tip", { mode: "PROGRAMMATIC", text: "27% from tip" });
  const acc = acceptHeadlines(beats, [
    { sequence: 2, text: "1995" }, { sequence: 3, text: "HUNTING PITS" }, // two in a row is fine
    { sequence: 4, text: "KILLING GROUND" }, // a third in a row is not
    { sequence: 11, text: "1995" }, // the same words are already on screen
    { sequence: 6, text: "this is way too long a headline" },
    { sequence: 15, text: "NOT IN LINE" },
    { sequence: 17, text: "HUNTING" },
  ], "frequent");
  assertEquals(acc.accepted.map((a) => a.sequence), [2, 3, 17]);
  assertEquals(Object.fromEntries(acc.rejected.map((r) => [r.sequence, r.why])), { 4: "3 text scenes in a row", 11: "same words already on screen", 6: "over 5 words", 15: "not from the narration" });
  assert(headlineScore("1995") > headlineScore("NOT SOMEONE FINDING A CARCASS"));
  // Off-by-one picks are re-anchored to the beat whose line holds the words.
  const anchored = acceptHeadlines([beat(1, "x"), beat(2, "the killing pit"), beat(3, "y")], [{ sequence: 3, text: "KILLING PIT" }], "frequent");
  assertEquals(anchored.accepted.map((a) => [a.sequence, a.text]), [[2, "KILLING PIT"]]);
  const out = applyTextPass(beats, acc.accepted);
  assertEquals(out[1].contract.textIntent, { mode: "SHORT_TEXT", text: "1995", kind: "HEADLINE", style: "BIG_STAT", category: "NUMBER" });
  assertEquals(out[9].contract.textIntent.kind, "HEADLINE");
});

Deno.test("plain names: the viewer is you, machine ids become people, plain words stay", () => {
  const bible = { roleArchetypes: [{ id: "viewer_viking", role: "viewer avatar" }, { id: "roberta_frank", role: "the historian who traced..." }, { id: "stone_age_hunter", role: "generic archetype" }, { id: "hunter", role: "archetypal hunter" }] };
  assertEquals(plainNames("Viewer's hands grip a shield rim", bible), "Your hands grip a shield rim");
  assertEquals(plainNames("Viewer viking pauses at the edge", bible), "You pause at the edge");
  assertEquals(plainNames("Warrior beside the viewer flinches", bible), "Warrior beside you flinches");
  assertEquals(plainNames("roberta_frank reads a saga", bible), "Roberta Frank reads a saga");
  assertEquals(plainNames("stone_age_hunter kneels", bible), "A stone age hunter kneels");
  assertEquals(plainNames("another hunter's hand", bible), "Another hunter's hand");
});

Deno.test("flags: only real image problems (f90160bc had 64 director notes and 0 bad images -> 0 flags)", () => {
  assertEquals(plainWarnings([{ code: "subject_run" }, { code: "location_run" }, { code: "concept_without_device" }, { code: "subject_repeat" }, { code: "establishing_without_place" }, { code: "ungrounded_name" }]), []);
  assertEquals(plainWarnings(["image_failed", "image_check_soft", "text_mismatch", "ip_hit", "duplicate"]).length, 5);
  // True duplicates: near-identical difference hashes only; the first of a pair is never flagged.
  assertEquals(hashDistance("ffff0000ffff0000", "ffff0000ffff0001"), 1);
  assertEquals([...duplicateScenes([{ n: 1, hash: "ffff0000ffff0000" }, { n: 2, hash: "0f0f0f0f0f0f0f0f" }, { n: 3, hash: "ffff0000ffff0001" }])], [3]);
});

Deno.test("scene plan cost cap scales with the script; a cost-cap stop is never re-run from scratch", () => {
  // f90160bc: ~1,450 words, 6 windows, $0.26 spent at window 5 -> the old flat $0.275 cap stopped it twice.
  const cap = planCostCapUsd(1450, 0.275);
  assert(cap >= 0.55 && cap <= 1, `${cap}`);
  assertEquals(planCostCapUsd(300, 0.275), 0.275);
  const T0 = "2026-09-28T20:00:00.000Z";
  const d = decideScenes({ now: "2026-09-28T20:05:00.000Z", scenes: { status: "running", startedAt: T0, resumes: 0, dispatched: { beats: T0 } } as any, bible: { id: "b", status: "frozen", created_at: T0 }, plan: { id: "p", status: "failed", created_at: T0, beatCount: 0, errorCode: "COST_CAP" }, images: { queued: 0, rendering: 0, renderingExpired: [], ready: 0, failed: 0, total: 0 }, tier: "V3" });
  assertEquals(d.action.kind, "fail");
  assertMatch(Deno.readTextFileSync(new URL("../../supabase/functions/build-stickman-beat-plan/index.ts", import.meta.url)), /planCostCapUsd\(/);
});
