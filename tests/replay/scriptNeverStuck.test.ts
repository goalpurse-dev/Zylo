// The script stage never leaves a paid run stuck (2026-10-07).
//
// What happened: a video about medieval archers failed its script check on all
// seven drafts (3 automatic tries + 2 Retry presses). 15 of the 18 findings were
// one rule ("the narration describes a screen graphic") matching the word
// "arrow"; the other 3 were length rules of our own. The user was left with 250
// credits held on a project with no script.
//
// Now: that rule looks at how the word is USED; our own quality rules get one
// repair and are then waived (kept as warnings); a script that still fails for a
// structural reason is written again three times, then once on a backup model;
// and when even that fails the whole hold is given back automatically.
// Everything here runs the real code against recorded/handwritten model answers ($0).
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { seedDb, runPipeline, playCassette } from "./harness.ts";
import { snapshot, goodDraft, draftEntry, draftEntryOpenAI, criticEntry, verifyEntries, passingCritic } from "./fixtures.ts";
import { findScreenGraphicsNarration } from "../../supabase/functions/_shared/stickman/scriptChecks.ts";
import { decideAutopilot, MAX_RESUMES, SCRIPT_MAX_RETRIES, REFUNDED_COPY, type AutopilotInput } from "../../supabase/functions/_shared/stickman/autopilot.ts";
import { STICKMAN_BACKUP_MODEL } from "../../supabase/functions/_shared/stickman/scriptModels.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const flagged = (text: string, subject = "") => findScreenGraphicsNarration([{ id: "s", text }], subject).length > 0;

async function replay(entries: any[], opts: { maxSteps?: number; scriptOverrides?: any } = {}) {
  const player = playCassette(entries);
  const { db, scriptId } = seedDb(snapshot, opts.scriptOverrides);
  try { return { ...(await runPipeline(db, scriptId, opts.maxSteps ?? 20)), player, db }; } finally { player.restore(); }
}
// A stakes "line" of 40 words: breaks our own stakes_overrun rule, nothing structural.
const LONG_STAKES = "Night was never empty time for the people who lived through it, because every single hour after sunset was spent mending tools, telling stories, guarding the fire and teaching children what the daylight hours had left no room for.";
const withLongStakes = () => { const d = goodDraft(); d.narrationSegments.find((s: any) => s.id === "seg_stakes").text = LONG_STAKES; return d; };

Deno.test("the graphics rule: real sentences from the archers drafts are not graphics; real screen narration still is", () => {
  // Sentences from the seven drafts that were rejected (the video's subject was not even given to the rule).
  for (const real of [
    "So the process creeps forward, draw after draw, until both limbs sweep into the same even arc, and the string pulls back to a full arrow's length without either side screaming under the load.",
    "Two spots on that string take almost all the damage: the loops at each end, and the center point where the arrow nocks and your fingers rip across it with every single shot.",
    "Arrows broke constantly, far more often than bows, since a shaft that hits bone or stone can split clean in half.",
    "Dawn finally breaks, and the archer draws the same hand-tuned bow, watches the arrow leave true, straight down the field.",
  ]) assertEquals(flagged(real), false, real);
  // The same words as ordinary subjects.
  for (const fine of ["The monks painted each icon on a wooden panel.", "Graphic novels sold out in a week.", "She kept an animated conversation going all night.", "A good fletcher finished sixty arrows a day."]) assertEquals(flagged(fine), false, fine);
  // What the rule was written for is still caught.
  for (const screen of [
    "Picture arrows from the five icons on the map, pointing at the selfie.",
    "The five-item list animating beside the chalkboard makes it clear.",
    "A red arrow points to the border checkpoint.",
    "Three icons appear above the city.",
    "This graphic shows how the trade grew.",
    "On screen, the numbers climb.",
    "Visually, the gap is huge.",
    "Watch the little sticker slide across.",
  ]) assertEquals(flagged(screen), true, screen);
  // A word that is the video's own subject is never a graphic, however it is used.
  assertEquals(flagged("Each arrow points the same way in the bundle, fletching up.", "How medieval archers crafted arrows"), false);
  assertEquals(flagged("The studio's first animation took three years to draw, and this animation changed everything.", "Who invented animation?"), false);
  assertEquals(flagged("Each arrow points the same way in the bundle, fletching up."), true, "without the subject it reads as a graphic");
});

Deno.test("a quality rule broken in the draft AND in its repair no longer fails the run: it is waived and the script goes on", async () => {
  const { row, player } = await replay([draftEntry(withLongStakes()), draftEntry(withLongStakes())], { maxSteps: 1 });
  assertEquals(player.calls.filter((c) => c.key === "stickman_script_draft").length, 2, "the one repair still happens first");
  assertMatch(String(player.calls[1].request.messages[0].content), /stakes_overrun/, "the repair was told what to fix");
  assertEquals(row.status, "drafting");
  assertEquals(row.stage, "claim_verify", "on to fact-checking (it used to stop here with DRAFT_VALIDATION_FAILED)");
  assertEquals(row.last_error_code ?? null, null);
  assertEquals(row.script_document.waivedQualityRules, ["stakes_overrun"]);
  assertEquals(row.meta.waivedQualityRules, ["stakes_overrun"]);
});

Deno.test("the waived script finishes: never 'failed', the finding is kept as a warning for the record", async () => {
  const { row, stages } = await replay([draftEntry(withLongStakes()), draftEntry(withLongStakes()), ...verifyEntries(8), criticEntry(passingCritic())]);
  assertEquals(stages.at(-1), "finalizing");
  assert(["ready", "needs_attention"].includes(row.status), row.status);
  assertEquals(row.script_document.checkResults.hard, [], "nothing blocking is left");
  const kept = row.script_document.checkResults.warn.find((w: any) => w.code === "stakes_overrun");
  assert(kept?.waived === true, "the stakes finding is still visible, as a waived warning");
  assert(row.script_document.narrationSegments.length > 5, "the full script is there");
});

Deno.test("a STRUCTURAL error still fails the draft (after its one repair), so it is written again", async () => {
  const broken = () => { const d = goodDraft(); d.narrationSegments[1].id = d.narrationSegments[0].id; return d; };
  const { row, player } = await replay([draftEntry(broken()), draftEntry(broken())], { maxSteps: 1 });
  assertEquals(player.calls.filter((c) => c.key === "stickman_script_draft").length, 2);
  assertEquals(row.status, "failed");
  assertEquals(row.last_error_code, "DRAFT_VALIDATION_FAILED");
  assert(row.detail.errors.some((e: any) => e.code === "duplicate_segment_id"));
  assert(!row.detail.errors.some((e: any) => e.quality), "only structural errors are left to fail on");
});

Deno.test("a version started on the backup model runs its draft there", async () => {
  const { row, player } = await replay([draftEntryOpenAI(goodDraft())], { maxSteps: 1, scriptOverrides: { meta: { modelOverride: STICKMAN_BACKUP_MODEL } } });
  const call = player.calls.find((c) => c.key === "stickman_script_draft")!;
  assertEquals(call.request.model, STICKMAN_BACKUP_MODEL);
  assertEquals(row.generation_model, STICKMAN_BACKUP_MODEL);
  assertEquals(row.stage, "claim_verify");
  assertEquals(row.meta.modelOverride, STICKMAN_BACKUP_MODEL, "the later stages of this version use it too");
  // Only our own autopilot may ask for it.
  const start = read("supabase/functions/start-long-form-script/index.ts");
  assertMatch(start, /const useBackupModel = internal === true && body\?\.backupModel === true;/);
  assertMatch(start, /useBackupModel \? \{ meta: \{ modelOverride: STICKMAN_BACKUP_MODEL \} \} : \{\}/);
});

const T0 = "2026-10-06T16:00:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();
const failedScript = (autopilot: any): AutopilotInput => ({
  now: at(700), autopilot: { status: "running", startedAt: T0, resumes: 0, ...autopilot },
  plan: { id: "p", created_at: at(80) }, research: { id: "r", status: "ready", stage: "finalizing", stage_started_at: at(100), worker_lock_until: null, created_at: at(82) },
  script: { id: "s", status: "failed", stage: "draft", stage_started_at: at(300), worker_lock_until: null, created_at: at(300), has_document: false },
});

Deno.test("a failed script is written again 3 times, then once on the backup model, then the run stops", () => {
  assertEquals([SCRIPT_MAX_RETRIES, MAX_RESUMES], [3, 3]);
  for (const tries of [0, 1, 2]) assertEquals(decideAutopilot(failedScript({ scriptRetries: tries })).action, { kind: "start_script", resume: true, afterFailure: true });
  assertEquals(decideAutopilot(failedScript({ scriptRetries: 3 })).action, { kind: "start_script", resume: true, afterFailure: true, backupModel: true });
  const end = decideAutopilot(failedScript({ scriptRetries: 4 })).action as any;
  assertEquals(end.kind, "fail");
  assertMatch(end.reason, /writing failed after 3 retries and the backup model/);
  // A used-up stall budget doesn't take the script's own retries away.
  assertEquals(decideAutopilot(failedScript({ scriptRetries: 1, resumes: MAX_RESUMES })).action.kind, "start_script");
});

Deno.test("no script after all of that: the whole hold goes back by itself, and the project can't be continued for free", () => {
  const advance = read("supabase/functions/advance-long-form-autopilot/index.ts");
  // The counter is the script's own, and the backup model is passed on.
  assertMatch(advance, /ap\.scriptRetries = \(ap\.scriptRetries \?\? 0\) \+ 1;/);
  assertMatch(advance, /\.\.\.\(a\.backupModel \? \{ backupModel: true \} : \{\}\)/);
  // Both ways a run can stop (script side, scenes side) release when no video is possible.
  assertEquals(advance.match(/await releaseIfNoVideoPossible\(projectId, ap, a\.reason, now\);/g)?.length, 2);
  const release = advance.slice(advance.indexOf("async function releaseIfNoVideoPossible"), advance.indexOf("const dispatchScene"));
  assertMatch(release, /rpc\("long_form_failed_by_us", \{ p_project_id: projectId \}\)/, "the database's own rule decides (no finished scene)");
  assertMatch(release, /if \(failedByUs !== true\) return;/, "a run with finished scenes keeps its hold and its work");
  assertMatch(release, /closeReservation\(admin, projectId, "failed_by_us"/);
  assertMatch(release, /ap\.holdReleasedAt = now;/);
  // After that, Retry / Regenerate on the project is refused (it would be a video nobody paid for).
  const start = read("supabase/functions/start-long-form-autopilot/index.ts");
  assertMatch(start, /if \(body\?\.retry === true \|\| body\?\.regenerateScript === true\) \{[\s\S]{0,400}if \(hold\?\.status === "released"\) return err\(req, REFUNDED_COPY, 409, \{ code: "HOLD_RELEASED" \}\);/);
  // The progress screen says so in plain words.
  assertMatch(read("supabase/functions/_shared/stickman/autopilotState.ts"), /message: ap\.holdReleasedAt \? REFUNDED_COPY : /);
  assertMatch(REFUNDED_COPY, /every credit for it is back in your account/);
  // The old rule ("a finally-failed autopilot keeps the reservation for its free Retry") only defers while a run can still continue.
  const script = read("supabase/functions/advance-long-form-script/index.ts");
  assertEquals(script.match(/script_quality_rules_waived/g)?.length, 2, "waived at the draft and at the final check");
});
