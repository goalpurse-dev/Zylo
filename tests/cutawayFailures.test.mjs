// Real failures, replayed free (the owner's rule of 2026-10-30: the same bug never costs money twice). Each folder in
// scripts/cutaway/proto3d/m3/failures is a failed production run's recorded replies (m3/failureCase.mjs); its plan is
// replayed through the planner here, and the whole video by m3/replayFailures.mjs (the harness).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chainProblems } from "../scripts/cutaway/proto3d/m2/chain.js";
import { guard, isBug, splitBugs } from "../scripts/cutaway/proto3d/m2/bookkeeping.js";

const M3 = path.join(path.dirname(fileURLToPath(import.meta.url)), "../scripts/cutaway/proto3d/m3");
const FAILURES = path.join(M3, "failures");

for (const name of fs.existsSync(FAILURES) ? fs.readdirSync(FAILURES).sort() : []) {
  const c = JSON.parse(fs.readFileSync(path.join(FAILURES, name, "case.json"), "utf8"));
  test(`real failure ${name} (${c.topic}, ${c.lengthSec} s, ${c.failed.code} after $${c.costUsd}): its plan passes, free`, () => {
    const p = spawnSync(process.execPath, [path.join(M3, "replayPlan.mjs"), path.join(FAILURES, name)], { encoding: "utf8", timeout: 240000 });
    const line = (p.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT "));
    assert.ok(line, `no result: ${(p.stderr ?? "").slice(-800)}`);
    const r = JSON.parse(line.slice(7));
    assert.equal(r.error ?? null, null, r.error);
    assert.equal(r.pending, null, `it asks a paid call the real run never made: ${r.pending}`);
    assert.deepEqual(r.problems, [], `it still stops: ${r.problems.join("; ")}`);
  });
}

test("chain: a 60 s plan's \"But now…\" stakes line is not a problem, its \"Then a storm…\" problem3 is (swimming pool, 2026-10-29)", () => {
  const S = [["hook", "If you dig a hole in the yard and fill it with water, you have a pool."], ["problem", "But the water soaks into the soil and leaks away."], ["stakes", "But now the wet walls slump in, since soil is heavy."],
    ["fix1", "So you pour a concrete floor and walls."], ["fix2", "So you fill the shell with water."], ["problem2", "But now the water turns green in the sun."], ["problem3", "Then a storm blows leaves and mud in, and the water gets murkier."], ["fix3", "So you add chlorine."], ["name", "This is a swimming pool."]]
    .map(([role, text]) => ({ role, text }));
  const chain = [{ problem: 1, causedBy: -1, shows: "water seeps down through the soil", stakes: "the pool never holds water", size: 4 }, { problem: 5, causedBy: 4, shows: "the clear water turns green", stakes: "swimmers cannot see", size: 6 }, { problem: 6, causedBy: 4, shows: "a storm drops mud into the water", stakes: "the pool turns filthy", size: 8 }];
  const bugs = [];
  assert.deepEqual(chainProblems({ sentences: S, chain }, { strict: false, lengthSec: 60, bugs }), []);
  assert.deepEqual(bugs, []);
  // an entry the chain lacks is our bookkeeping: logged, never a problem
  const left = [];
  assert.deepEqual(chainProblems({ sentences: S, chain: chain.slice(0, 2) }, { strict: false, lengthSec: 60, bugs: left }), []);
  assert.match(left.join(), /no entry for problem sentence 6 \(problem3\)/);
});

test("a retry replays the earlier attempt's paid planner replies, and the run keeps why each attempt failed (swimming pool 60 s: planned twice, $1.59, attempt 1's error lost)", async () => {
  const { jobFor, paths } = await import("../supabase/functions/_shared/cutaway/jobs.js");
  const { failOrRetry } = await import("../supabase/functions/_shared/cutaway/orchestrate.js");
  const run = { id: "r1", user_id: "u", env: "test", topic: "swimming pool", length_sec: 60, kind: "custom", attempt: 1, provider: "runpod", status: "scene", plan_ready: false };
  assert.match(paths(run).plan.steps, /\/plan\/steps\.json$/);
  const urls = { planPut: { steps: "put-steps" }, resume: "get-steps" };
  assert.equal(jobFor(run, { role: "video", urls }).plan.resume, undefined, "a first attempt replays nothing");
  assert.equal(jobFor({ ...run, attempt: 2 }, { role: "video", urls }).plan.resume, "get-steps");
  assert.equal(jobFor({ ...run, attempt: 2 }, { role: "video", urls }).plan.put.steps, "put-steps", "and keeps its own for the next");
  const r1 = failOrRetry(run, { code: "RENDER_FAILED", message: "TypeError: x is undefined" });
  assert.equal(r1.patch.attempt, 2);
  assert.match(r1.patch.error_message, /^attempt 1: RENDER_FAILED TypeError: x is undefined/);
  const r2 = failOrRetry({ ...run, ...r1.patch }, { code: "PLAN_FAILED", message: "the plan did not pass: a content problem", retryable: false });
  assert.match(r2.patch.error_message, /^the plan did not pass: a content problem\n\nEarlier: attempt 1: RENDER_FAILED TypeError/);
});

test("the voice has no money cap: a 60 s narration is voiced (attempt 1 of the swimming pool 60 s run was refused before the call by a $0.40 cap, then retried and re-planned)", async () => {
  const { VOICE_MAX_CHARS } = await import("../scripts/cutaway/proto3d/m2/voice.mjs");
  const src = fs.readFileSync(path.join(M3, "../m2/voice.mjs"), "utf8");
  assert.doesNotMatch(src, /capUsd/);
  assert.ok(VOICE_MAX_CHARS >= 2 * 1400, "well above a 60 s narration (about 1,400 characters)");
});

test("bookkeeping never fails a run: a mismatch or a crashed check is a logged bug, a content problem stays a problem", () => {
  for (const p of ["chain: no entry for problem sentence 3", "surprise \"A pool holds 83 tons…\": no beat fix9", "beat finish: the script has no sentence with that role", "card \"83 TONS\": the word \"83\" is not in sentence 5", "fix2: no such sentence", "layout check crashed: Cannot read properties of undefined (reading 'x0')"]) assert.ok(isBug(p), p);
  for (const p of ["problem \"But the pool…\" is not something you can see happen: say the visible consequence", "the story needs at least 3 problems (\"But…\" sentences), each caused by the fix before it; it has 2", "chain: every problem must be bigger than the one before (sizes 4, 3)"]) assert.ok(!isBug(p), p);
  const bugs = [];
  assert.deepEqual(splitBugs(["chain: no entry for problem sentence 3", "the hook is 30 words"], bugs), ["the hook is 30 words"]);
  assert.deepEqual(guard("timeline check", () => { throw new TypeError("x is undefined"); }, bugs, () => ({ problems: [] })), { problems: [] });
  assert.equal(bugs.length, 2);
  assert.match(bugs[1], /^timeline check crashed: x is undefined/);
});

test("60 s free harness fixes (2026-10-30): tall thin subjects framed whole, card years as written, the yellow lamp alone, road markings stay, reversed moves play in turn", async () => {
  const { frameBox, projectBox } = await import("../scripts/cutaway/proto3d/m2/director.js");
  const shaft = { min: [-0.7, -13, -1.4], max: [0.7, 0, 0] };
  const f = frameBox(shaft, { width: 0.8, fit: "loose" });
  assert.ok(projectBox(f.pos, f.tgt, shaft).h <= 0.92, "a 13 m shaft is whole in height, not a slice of soil");
  const { cardNumber } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  assert.equal(cardNumber("1993", "Sectional doors became common in 1993."), "1993");
  assert.equal(cardNumber("1500", "It holds 1,500 gallons."), "1,500");
  assert.equal(cardNumber("10000", "about 10000 cycles"), "10000");
  const { VERBS } = await import("../scripts/cutaway/proto3d/m2/verbs.js");
  assert.deepEqual(VERBS.trafficLight.yellow.map((r) => [r.c ?? r[0] ?? r.ch, r.amp ?? r[3]].join()).length, 3, "yellow turns red and green off");
  const src = fs.readFileSync(path.join(M3, "../m2/layoutRules.js"), "utf8");
  assert.match(src, /crosswalk\|stopLine/);
  assert.match(fs.readFileSync(path.join(M3, "../m2/compile.mjs"), "utf8"), /a move that reverses the one before it/);
});

test("the salvage (swimming pool 60 s refused at the gate after $1.40, 2026-10-30): failing extras dropped with the chain kept whole, the hook reworded, nothing left anchored to a dropped line", async () => {
  const { salvagePlan, dropFrom } = await import("../scripts/cutaway/proto3d/m2/salvage.mjs");
  const roles = ["hook", "problem", "flood", "stakes", "fix1", "fix2", "fix3", "fix4", "name", "name2", "how", "fact", "factProof", "problem2", "problem3", "fix5", "myth", "mythFact", "finish", "congrats"];
  const sp = salvagePlan(roles, ["hook", "flood", "stakes", "problem3", "fix5"]);
  assert.deepEqual(sp.reword, ["hook"]);
  assert.deepEqual(sp.drop, ["flood", "stakes", "problem2", "problem3", "fix5"], "problem2 lost its only fix (fix5): it goes too");
  for (const r of ["hook", "problem", "fix1", "name", "congrats"]) assert.ok(sp.keep.includes(r));
  assert.deepEqual(salvagePlan(roles, ["name", "fix1"]).drop, [], "the name and the first fix are reworded, never dropped");
  const L = { beats: roles.map((s) => ({ s, do: [] })), roles, parts: [], audio: { rain: { from: { s: "problem3" }, to: { s: "fix5" } }, sfx: [{ lib: "rain", at: { s: "problem3" } }, { lib: "pop", at: { s: "fix1" } }], cards: [] } };
  const S = { sentences: roles.map((role) => ({ role, text: `${role}.` })), cards: [] };
  const d = dropFrom(S, L, sp.drop);
  assert.equal(d.script.sentences.length, 15);
  assert.equal(d.layout.audio.rain, undefined, "the rain anchored to a dropped line goes");
  assert.deepEqual(d.layout.audio.sfx.map((x) => x.lib), ["pop"]);
  assert.ok(!JSON.stringify(d.layout).includes("problem3"));
});

test("first finished 60 s video (78.6 s, black frames, labels piled on the house, 2026-10-30): the length limits, one label at a time, cards as said, commas in captions, blank frames re-rendered", async () => {
  const { LENGTH, cardsAsSaid } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  const PACE = 288 / 76.47, END = 2.2, len = (w) => w / PACE + END;
  assert.ok(len(LENGTH[60].words[0]) >= 55 && len(LENGTH[60].words[1]) <= 65, "200-235 words land at 55-65 s at the real pace");
  assert.ok(LENGTH[60].maxSpeech + END <= 65.01);
  assert.deepEqual(cardsAsSaid([{ text: "20,000 TONS", at: { s: "problem", w: "20,000" } }, { text: "8 HOURS", at: { s: "fact", w: "8" } }, { text: "99 LB", at: { s: "fact", w: "99" } }], [{ role: "problem", text: "But the soil will soak up 20,000 gallons, and it falls." }, { role: "fact", text: "It runs about once every 8 hours." }]).map((c) => c.text), ["20,000 GALLONS", "8 HOURS"]);
  const { stateCards } = await import("../scripts/cutaway/proto3d/m2/compile.mjs");
  const words = [{ w: "But", s: 3.4, e: 3.6 }, { w: "it", s: 3.6, e: 3.8 }, { w: "leaks", s: 4.2, e: 4.6 }];
  const S = [{ role: "problem", text: "But it leaks away.", t0: 3.4, t1: 7.2 }];
  const up = stateCards(S, words, [{ s: "problem", state: { text: "LEAKING", w: "leaks" } }], [{ text: "83 TONS", s: 4.6, e: 6.4 }]);
  assert.equal(up.length, 1); assert.ok(up[0].s >= 6.4, "the state waits for the number card");
  assert.deepEqual(stateCards(S, words, [{ s: "problem", state: { text: "LEAKING", w: "leaks" } }], [{ text: "83 TONS", s: 4.6, e: 7.0 }]), [], "no room left: no state label");
  const { captionWord } = await import("../render-worker/src/cutawayFinalPlan.mjs");
  assert.deepEqual(["20,000", "2,500,", "hours.", "3.5"].map(captionWord), ["20,000", "2,500", "Hours", "3.5"]);
  const src = fs.readFileSync(path.join(M3, "../render.mjs"), "utf8");
  assert.match(src, /re-rendered/); assert.match(src, /gl\?\.finish\?\.\(\)/);
});
