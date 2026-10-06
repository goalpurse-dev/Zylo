// AI Fruit Story v2 quality rules (offline), from the launch review of Oct 2026:
// the script review and its one rewrite, casts that can't look alike, the
// clip check (words and last frame, one remake), the picture redraw that is
// told what to fix, and the final video's trim and caption timing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FULL_BODY, addressedIds, runPlanner, validatePlan } from "../supabase/functions/_shared/fruit/planner.js";
import { REVIEW_RULES, buildReviewPrompt, problemLines, reviewProblems, reviewSchema } from "../supabase/functions/_shared/fruit/scriptReview.js";
import { areFamily, lookAlikeMessage, lookAlikePairs, mainColor } from "../supabase/functions/_shared/fruit/castRules.js";
import { validateCreateStory, validateSeriesPlan } from "../supabase/functions/_shared/fruit/validation.js";
import { spokenDiff, spokenProblem } from "../supabase/functions/_shared/fruit/spoken.js";
import { REMAKE_NOTE, TIMING, createEngine } from "../supabase/functions/_shared/fruit/engine.js";
import { parseRunware } from "../supabase/functions/_shared/fruit/runware.js";
import { verdictOf } from "../supabase/functions/_shared/fruit/pictureCheck.js";
import { buildScenePrompt, withRedrawHint, PICTURE_PROMPT_MAX } from "../supabase/functions/_shared/fruit/pictures.js";
import { FRAME_SCRIPT, checkClipWords, frameMachineConfig } from "../supabase/functions/_shared/fruit/clipCheck.js";
import { CLOSING_BEAT_SEC, buildFinalJob } from "../supabase/functions/_shared/fruit/final.js";
import { KEEP_SEC, segmentArgs, trimWindow, voiceEndFrom, voiceThresholdDb } from "../render-worker/src/fruitFinalPlan.mjs";
import { clampToSpeech, timedWords } from "../render-worker/src/fruitCaptions.mjs";
import { loadIdeas } from "../scripts/fruit-story/ideas/build.mjs";
import { createMemoryDb } from "./helpers/fruitMemoryStore.mjs";

const CHARACTERS = JSON.parse(fs.readFileSync(new URL("../data/fruit-characters/library.json", import.meta.url), "utf8"));
const byId = new Map(CHARACTERS.map((c) => [c.id, c]));
const pick = (...ids) => ids.map((id) => byId.get(id));

/* ─── casts that can't look alike ─────────────────────────────────────── */

test("same fruit only for relatives dressed differently: the two pineapples are refused, the Mangos are fine", () => {
  assert.equal(lookAlikePairs(pick("pina", "pablo", "coco")).length, 1, "kingpin and inmate: same fruit, same orange jumpsuit");
  assert.equal(lookAlikeMessage(pick("pina", "pablo", "coco")), "Big Pina and Pablo Pine are both pineapples and would look the same on screen. Swap one of them for a different fruit.");
  assert.equal(lookAlikePairs(pick("mia", "marco", "pia")).length, 0, "husband and wife, a suit and a dress");
  assert.equal(lookAlikePairs(pick("manny", "maya", "kai")).length, 0);
  assert.equal(lookAlikePairs(pick("dot", "dex", "kai")).length, 1, "aunt and club owner: not relatives by their tags");
  assert.equal(lookAlikePairs(pick("bree", "betty", "pete")).length, 1, "babysitter and mom");
  assert.ok(areFamily(byId.get("gus"), byId.get("andy")));
  assert.equal(mainColor("a fitted charcoal suit with an open-collar black shirt"), "grey", "the first colour named, not the first in a list");
  assert.equal(mainColor("a hot-pink velvet suit, a black silk shirt"), "pink");
});

test("the server refuses a look-alike cast the user picked, in plain words; an idea's own cast is the library's job", () => {
  const settings = { quality: "v2", aspect: "9:16", lengthSec: 20 };
  assert.throws(() => validateCreateStory({ source: "prompt", prompt: "A prison story about a kingpin.", castIds: ["pina", "pablo"], ...settings }, byId), /both pineapples and would look the same on screen/);
  assert.equal(validateCreateStory({ source: "prompt", prompt: "A dinner that goes wrong.", castIds: ["mia", "marco"], ...settings }, byId).castIds.length, 2);
  assert.throws(() => validateSeriesPlan({ concept: "Prison kingpin beef", castIds: ["pina", "pablo", "coco"], episodeCount: 3 }, byId), /Swap one of them/);
  assert.equal(validateCreateStory({ source: "idea", ideaId: "x", ...settings }, byId, () => ({ castIds: ["pina", "pablo"] })).source, "idea");
});

test("the idea library has no look-alike casts and no idea that needs hair, a tattoo or a makeover", () => {
  const { ideas, problems } = loadIdeas();
  assert.deepEqual(problems, []);
  const alike = ideas.filter((i) => lookAlikePairs(i.castIds.map((id) => byId.get(id))).length).map((i) => `${i.id} (${i.castIds.join(", ")})`);
  assert.deepEqual(alike, []);
  const HUMAN = /\b(hair|haircuts?|hairdo|wigs?|beards?|moustache|shav(?:e|es|ed|ing)|bald|tattoos?|makeovers?|nose job|facelift|botox)\b/i;
  assert.deepEqual(ideas.filter((i) => HUMAN.test(`${i.title} ${i.summary}`)).map((i) => i.id), []);
  const kingpin = ideas.find((i) => i.id === "crime-cellblock-kingpin");
  assert.ok(kingpin && !kingpin.castIds.includes("pablo"), "the Cellblock Kingpin idea has a different second inmate");
});

/* ─── the planner's own checks ────────────────────────────────────────── */

const cast = pick("mia", "marco", "pia");
const locations = [{ id: "loc1", description: "An elegant candlelit restaurant table for two, white tablecloth, wine glasses", timeOfDay: "evening", lighting: "warm golden candlelight", seriesLocationId: "" }];
const scene = (speakerId, line, presentIds, extra = {}) => ({ speakerId, line, presentIds, locationId: "loc1", action: "sets down her wine glass slowly", emotion: "icy calm", shot: "chest-up", placement: "", beat: "The first crack", ...extra });
const GOOD = () => ({
  title: "The Anniversary Table", locations, outfits: [],
  roles: [{ id: "mia", role: "the wife who knows" }, { id: "marco", role: "the cheating husband" }, { id: "pia", role: "the other woman" }],
  endState: { characters: [], props: [] },
  scenes: [
    scene("mia", "Funny, the waiter said you booked two tables tonight.", ["mia", "marco"]),
    scene("marco", "One was for us, the other is for work.", ["marco", "mia"]),
    scene("pia", "Your work thing is wearing the necklace you bought, Marco.", ["pia", "marco", "mia"]),
  ],
});
const ctx = { source: "idea", cast, sceneCount: 3, quality: "v2", lengthSec: 15 };
const base = { source: "idea", cast, quality: "v2", lengthSec: 15, idea: { title: "Two tables", summary: "He booked two tables." } };

test("speaking scenes get upper-body actions: a full-body move is sent back for repair", () => {
  for (const a of ["strolls up slow with hands behind his back", "plants his whistle in the sand and stands tall", "rips off his jacket to show the badge beneath", "storms out past the hostess"]) assert.match(a, FULL_BODY, a);
  for (const a of ["raises her phone to film them", "leans against the bunk pointing toward the door", "runs a finger along the receipt", "slams the folder on the table"]) assert.doesNotMatch(a, FULL_BODY, a);
  const out = GOOD();
  out.scenes[1].action = "strolls up with flowers";
  assert.match(validatePlan(out, ctx).errors.join("\n"), /scene 2: the action "strolls up with flowers" is a full-body move \("strolls"\); the picture is chest-up/);
});

test("whoever a line talks to must be in the picture; talking about someone elsewhere is fine", () => {
  assert.deepEqual(addressedIds("Your work thing is wearing the necklace you bought, Marco.", cast), ["marco"]);
  assert.deepEqual(addressedIds("Marco knows plenty about that necklace.", cast), [], "about him, not to him");
  assert.deepEqual(addressedIds("Does Big Pina know about this?", pick("pina", "larry")), []);
  assert.deepEqual(addressedIds("New fish asking about me already, Pina.", pick("pina", "larry")), ["pina"], "Big Pina answers to Pina");
  const out = GOOD();
  out.scenes[2].presentIds = ["pia", "mia"];
  assert.match(validatePlan(out, ctx).errors.join("\n"), /scene 3: the line talks to Marco Mango, so marco must be in presentIds/);
  assert.deepEqual(validatePlan(GOOD(), ctx).errors, []);
});

test("one alternate outfit per story, short, for a cast member; anything else is dropped without failing the story", () => {
  const out = GOOD();
  out.outfits = [{ id: "marco", outfit: "a plain grey hoodie, dark jeans and white trainers." }, { id: "mia", outfit: "a second one that is ignored" }, { id: "nobody", outfit: "x y z" }];
  const { plan, errors } = validatePlan(out, ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual(plan.outfits, { marco: "a plain grey hoodie, dark jeans and white trainers" });
  assert.deepEqual(validatePlan(GOOD(), ctx).plan.outfits, {});
  const story = { aspect: "9:16", outfits: plan.outfits, locations: [{ id: "loc1", description: "a car park" }] };
  const prompt = buildScenePrompt({ story, scene: { speakerId: "marco", presentIds: ["marco", "mia"], locationId: "loc1", action: "holds up a shoe box", emotion: "nervous", shot: "chest-up", placement: "" }, library: byId });
  assert.match(prompt, /Image 1 is Marco Mango, the mango man: keep the fruit head and face exactly as in the reference, but in this story Marco Mango wears a plain grey hoodie, dark jeans and white trainers \(not the outfit in the reference\)\./);
  assert.match(prompt, /Image 2 is Mia Mango, the mango woman: keep the fruit head, face and outfit \(an elegant emerald wrap dress/);
});

/* ─── the script review and its one rewrite ───────────────────────────── */

const passAll = () => Object.fromEntries(Object.keys(REVIEW_RULES).map((id) => [id, { pass: true, scene: 0, problem: "", fix: "" }]));
const failEnding = () => ({ ...passAll(), ending: { pass: false, scene: 3, problem: "The last line only agrees to come along.", fix: "End on what the necklace reveals." } });
const recorder = (answers) => {
  const purposes = [];
  const next = async ({ purpose, user }) => { purposes.push(purpose); const a = answers.shift(); if (a instanceof Error) throw a; return { data: typeof a === "function" ? a(user) : a, costUsd: 0.01 }; };
  return { next, purposes };
};

test("the review reads the script as a viewer meets it: who is in each picture, what they wear, and the kind of ending", () => {
  const { plan } = validatePlan(GOOD(), ctx);
  const { system, user } = buildReviewPrompt({ plan, cast, source: "idea" });
  assert.match(system, /heard once, out loud/);
  for (const id of Object.keys(REVIEW_RULES)) assert.ok(system.includes(`${id}:`), id);
  assert.match(user, /TITLE: The Anniversary Table/);
  assert.match(user, /KIND: a single complete video/);
  assert.match(user, /3\. \[in the picture: Pia Peach, Marco Mango, Mia Mango; place: An elegant candlelit restaurant table/);
  assert.match(user, /- Mia Mango, mango woman; role here: the wife who knows; wears in every scene: an elegant emerald wrap dress/);
  const ep = buildReviewPrompt({ plan, cast, source: "episode", series: { episode: { number: 2, cliffhanger: "Mia holds up the receipt." } } });
  assert.match(ep.user, /KIND: episode 2 of a series\. The last line must deliver this cliffhanger so that a new viewer understands it: Mia holds up the receipt\./);
  assert.deepEqual(reviewSchema().required, Object.keys(REVIEW_RULES));
  assert.deepEqual(reviewProblems(passAll()), []);
  const problems = reviewProblems(failEnding());
  assert.deepEqual(problems, [{ rule: "ending", scene: 3, problem: "The last line only agrees to come along.", fix: "End on what the necklace reveals." }]);
  assert.deepEqual(problemLines(problems), ["scene 3 (the last line must turn something): The last line only agrees to come along. Fix: End on what the necklace reveals."]);
  assert.deepEqual(reviewProblems({ ending: { pass: "no" } }), [], "a malformed answer never fails a script");
});

test("a script that passes the review costs one extra call and is kept as written", async () => {
  const writer = recorder([GOOD()]);
  const editor = recorder([passAll()]);
  const r = await runPlanner({ ...base, llm: writer.next, reviewLlm: editor.next });
  assert.deepEqual(writer.purposes, ["planner"]);
  assert.deepEqual(editor.purposes, ["script_review"]);
  assert.deepEqual(r.review, { ok: true, problems: [], rewritten: false });
  assert.equal(r.attempts, 1);
});

test("a script that fails the review is rewritten ONCE, with the editor's exact problems, and not reviewed again", async () => {
  const better = GOOD();
  better.title = "Two Tables";
  better.scenes[2] = scene("pia", "He booked my table first, Mia, and paid cash.", ["pia", "marco", "mia"]);
  let rewritePrompt = "";
  const writer = recorder([GOOD(), (user) => { rewritePrompt = user; return better; }]);
  const editor = recorder([failEnding()]);
  const r = await runPlanner({ ...base, llm: writer.next, reviewLlm: editor.next });
  assert.deepEqual(writer.purposes, ["planner", "planner_rewrite"]);
  assert.deepEqual(editor.purposes, ["script_review"], "one review, one rewrite");
  assert.match(rewritePrompt, /A SCRIPT EDITOR READ IT THE WAY A VIEWER HEARS IT/);
  assert.match(rewritePrompt, /- scene 3 \(the last line must turn something\): The last line only agrees to come along\. Fix: End on what the necklace reveals\./);
  assert.equal(r.plan.title, "Two Tables");
  assert.equal(r.plan.scenes[2].line, "He booked my table first, Mia, and paid cash.");
  assert.equal(r.review.rewritten, true);
  assert.equal(r.review.before.title, "The Anniversary Table");
  assert.equal(r.review.before.lines[2], "Your work thing is wearing the necklace you bought, Marco.");
  assert.equal(r.attempts, 2);
});

test("the review never fails a story: a broken rewrite, a rewrite that can't run and a review that can't run all keep the first script", async () => {
  const broken = { ...GOOD(), scenes: GOOD().scenes.slice(0, 2) };
  const twice = recorder([GOOD(), broken, broken]);
  const a = await runPlanner({ ...base, llm: twice.next, reviewLlm: recorder([failEnding()]).next });
  assert.deepEqual(twice.purposes, ["planner", "planner_rewrite", "planner_rewrite_repair"]);
  assert.equal(a.plan.title, "The Anniversary Table");
  assert.equal(a.review.rewritten, false);
  assert.match(a.review.note, /the rewrite broke the format; the first script was kept/);

  const b = await runPlanner({ ...base, llm: recorder([GOOD(), new Error("anthropic 529")]).next, reviewLlm: recorder([failEnding()]).next });
  assert.equal(b.plan.title, "The Anniversary Table");
  assert.match(b.review.note, /the rewrite could not run \(anthropic 529\)/);

  const c = await runPlanner({ ...base, llm: recorder([GOOD()]).next, reviewLlm: recorder([new Error("timeout")]).next });
  assert.equal(c.review.ok, true);
  assert.match(c.review.skipped, /review could not run: timeout/);
});

test("the user's own script is staged, never reviewed or rewritten; without a review model nothing changes", async () => {
  const script = [{ speakerId: "mia", line: "Tonight has to be perfect." }, { speakerId: "marco", line: "Work was crazy, sorry I'm late!" }];
  const staged = { title: "My Script", locations, outfits: [], roles: [], endState: { characters: [], props: [] }, scenes: [
    { presentIds: ["mia", "marco"], locationId: "loc1", action: "lights a candle", emotion: "hopeful", shot: "chest-up", placement: "", beat: "Big night" },
    { presentIds: ["marco", "mia"], locationId: "loc1", action: "holds up a bunch of flowers", emotion: "flustered", shot: "medium close-up", placement: "", beat: "Late again" },
  ] };
  const editor = recorder([]);
  const r = await runPlanner({ ...base, source: "script", script, llm: recorder([staged]).next, reviewLlm: editor.next });
  assert.deepEqual(editor.purposes, []);
  assert.match(r.review.skipped, /never rewritten/);
  assert.equal((await runPlanner({ ...base, llm: recorder([GOOD()]).next })).review, null);
});

/* ─── did the voice say the line ──────────────────────────────────────── */

test("a real change to the line is told apart from what speech-to-text does to spelling and numbers", () => {
  const same = [
    ["Twenty pairs, cash only, no returns, you get me", "20 pairs, cash only, no returns, you get me."],
    ["Blu, that geezer's shoes are brand new police issue", "Blue that geezer's shoes a brand new police issue"],
    ["How'd you know the exact pair number, bruv", "How do you know the exact pair number, bruv?"],
    ["Wait, the guy in grey hoodie she mentioned?", "Wait, the guy in gray hoodie she mentioned?"],
    ["Someone just put fifty quid on Perry and Lila dating.", "Someone just put 50 quid on Perrie and Lila dating."],
    ["Auntie Dot, whatever Kai told you, it's exaggerated.", "Anti-Dot, whatever Kai told you, it's exaggerated."],
    ["Champagne at eight a.m., in my office, really?", "Champagne at 8 a.m. in my office? Really?"],
    ["Oh, I didn't mean nothing by it, boss.", "Oh, I didn't mean nothin' by it, boss."],
    ["Blu, you're nicked, this deal just cost you everything", "Blue, you're nacked! This deal just cost you everything!"],
  ];
  for (const [line, heard] of same) assert.equal(spokenProblem(line, heard), "", `${line} / ${heard}`);
  assert.deepEqual(spokenDiff("Eleven thousand dollars at the jeweler, Marco.", "$11,000 at the jeweler."), { same: false, missing: ["marco"], added: [] });
  assert.equal(spokenProblem("I can explain everything, baby, it was for Rick.", "Ike, I can explain everything baby. It was for Rick."), "the voice changed the line (added: ike)");
  assert.equal(spokenProblem("I already know, darling.", "I already knowed, darling."), "the voice changed the line (not said: know; added: knowed)");
  assert.equal(spokenDiff("Okay, boss. I'll be there tonight.", "Okay boss, I'll be there.").missing.join(), "tonight");
});

test("the clip word check: the transcript is logged once, a changed line fails, a silent clip fails, no transcript means no verdict", async () => {
  const rows = [];
  const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ data: rows.filter((r) => r.ok).map((r) => ({ request: r.request, response: r.response })) }) }) }) }), insert: async (row) => { rows.push(row); return {}; } }) };
  const heard = (text) => async (url) => (String(url).includes("openai.com")
    ? { ok: true, status: 200, json: async () => ({ text, duration: 5, words: text ? text.split(" ").map((w, i) => ({ word: w, start: i * 0.3, end: i * 0.3 + 0.25 })) : [] }) }
    : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  const args = { admin, apiKey: "k", userId: "u", storyId: "s", sceneId: "c", line: "I already know, darling.", durationSec: 5 };
  const bad = await checkClipWords({ ...args, clipUrl: "https://cdn/1.mp4", fetchImpl: heard("I already knowed, darling.") });
  assert.deepEqual(bad, { ok: false, problems: ["the voice changed the line (not said: know; added: knowed)"], heard: "I already knowed, darling." });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].purpose, "caption_words", "the final video finds this transcript by the clip URL and doesn't pay again");
  const again = await checkClipWords({ ...args, clipUrl: "https://cdn/1.mp4", fetchImpl: async () => { throw new Error("must not be called"); } });
  assert.equal(again.ok, false);
  assert.equal(rows.length, 1, "cached");
  assert.equal((await checkClipWords({ ...args, clipUrl: "https://cdn/2.mp4", fetchImpl: heard("I already know, darling.") })).ok, true);
  assert.deepEqual((await checkClipWords({ ...args, clipUrl: "https://cdn/3.mp4", fetchImpl: heard("") })).problems, ["nobody speaks in the clip"]);
  assert.equal(await checkClipWords({ ...args, clipUrl: "https://cdn/4.mp4", fetchImpl: async () => { throw new Error("network"); } }), null);
});

/* ─── the engine: one remake for a clip, a redraw that knows what to fix ─ */

const CLIP = (taskUUID, cost = 0.25) => ({ data: [{ taskType: "videoInference", taskUUID, status: "success", videoURL: `https://vm.runware.ai/${taskUUID}.mp4`, cost }] });
const IMG = (taskUUID, cost = 0.03) => ({ data: [{ taskType: "imageInference", taskUUID, imageURL: `https://im.runware.ai/${taskUUID}.jpg`, cost }] });
function clipSetup(deps) {
  const db = createMemoryDb();
  const sent = [];
  let n = 0;
  const engine = createEngine({
    store: db.store,
    runware: { submit: async (env) => { sent.push(env); return { httpStatus: 200, body: { data: [{ taskUUID: env.taskUUID }] } }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
    media: { store: async ({ path }) => `https://cdn.test/${path}` },
    env: { webhookBase: "https://fn.test/fruit-worker", webhookSecret: "s" },
    now: () => db.clock(), uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, log: { error() {} },
    ...deps,
  });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  const sceneRow = [...db.scenes.values()][0];
  const [jobId] = db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: sceneRow.id, kind: "clip", credits: 13, request: { taskType: "videoInference", model: "alibaba:wan@2.6-flash", positivePrompt: "clip" } }] });
  return { db, engine, sent, storyId, jobId, sceneRow };
}

test("clip check: a clip that changes the line is made again once at our cost; the second one is kept whatever it says", async () => {
  let checks = 0;
  const done = [];
  const { db, engine, sent, storyId, jobId, sceneRow } = clipSetup({
    checkClipWords: async () => { checks += 1; return { ok: false, problems: ["the voice changed the line (not said: marco)"] }; },
    onCompleted: async (job) => { done.push(job.id); },
  });
  await engine.kick({ storyId });
  assert.equal(await engine.onResult(sent[0].taskUUID, CLIP(sent[0].taskUUID)), "remade");
  const job = db.jobs.get(jobId);
  assert.ok(job.error.startsWith(REMAKE_NOTE));
  assert.match(job.error, /not said: marco/);
  assert.equal(sent.length, 2, "sent again right away, same job");
  assert.equal(sceneRow.clip_status, "generating");
  assert.equal(db.balance, 987, "the user paid once");
  assert.equal(await engine.onResult(sent[1].taskUUID, CLIP(sent[1].taskUUID)), "completed");
  assert.equal(checks, 1, "a remade clip is not checked again");
  assert.equal(sceneRow.clip_status, "ready");
  assert.equal(db.stories.get(storyId).status, "clips_ready");
  assert.equal(job.cost_usd, 0.5, "both clips are ours to pay");
  assert.deepEqual(done, [jobId], "the worker hears the clip is ready (it starts the final video)");
});

test("clip check: the last frame is asked for, the clip waits, and a human in the frame remakes it once", async () => {
  const frames = [];
  const { db, engine, sent, storyId, jobId, sceneRow } = clipSetup({
    checkClipWords: async () => ({ ok: true, problems: [] }),
    requestClipFrame: async (job, storedUrl) => { frames.push(storedUrl); return { path: `frames/${job.id}.jpg` }; },
    checkClipFrame: async (_job, frame) => (frames.length === 1 ? { ok: false, problems: [`last frame: 1 human head in the picture (${frame.path})`] } : { ok: true, problems: [] }),
  });
  await engine.kick({ storyId });
  assert.equal(await engine.onResult(sent[0].taskUUID, CLIP(sent[0].taskUUID)), "frame_pending");
  assert.equal(db.jobs.get(jobId).status, "provider_done");
  assert.equal(db.jobs.get(jobId).result._frame.storedUrl, frames[0]);
  assert.equal(sceneRow.clip_status, "generating", "not shown to the user yet");
  assert.equal(await engine.finalize({ ...db.jobs.get(jobId) }), "frame_pending", "the reconciler waits too");
  assert.equal(await engine.onClipFrame(jobId, true), "remade");
  assert.match(db.jobs.get(jobId).error, /last frame: 1 human head/);
  assert.equal(await engine.onResult(sent[1].taskUUID, CLIP(sent[1].taskUUID)), "completed", "the remade clip is kept without another check");
  assert.equal(frames.length, 1);
  assert.equal(await engine.onClipFrame(jobId, true), "ignored", "a late frame report changes nothing");
});

test("clip check never blocks: a clean frame completes, a frame that failed to arrive completes, and one that never arrives completes after the wait", async () => {
  const deps = { checkClipWords: async () => null, requestClipFrame: async () => ({ path: "f.jpg" }), checkClipFrame: async () => ({ ok: true, problems: [] }) };
  const a = clipSetup(deps);
  await a.engine.kick({ storyId: a.storyId });
  await a.engine.onResult(a.sent[0].taskUUID, CLIP(a.sent[0].taskUUID));
  assert.equal(await a.engine.onClipFrame(a.jobId, true), "completed");
  assert.equal(a.sceneRow.clip_url, a.db.jobs.get(a.jobId).stored_url);

  const b = clipSetup(deps);
  await b.engine.kick({ storyId: b.storyId });
  await b.engine.onResult(b.sent[0].taskUUID, CLIP(b.sent[0].taskUUID));
  assert.equal(await b.engine.onClipFrame(b.jobId, false), "completed", "ffmpeg failed on the machine: keep the clip");

  const c = clipSetup(deps);
  await c.engine.kick({ storyId: c.storyId });
  await c.engine.onResult(c.sent[0].taskUUID, CLIP(c.sent[0].taskUUID));
  c.db.advance?.(TIMING.frameWaitSec + 5);
  const waited = { ...c.db.jobs.get(c.jobId) };
  waited.result = { ...waited.result, _frame: { ...waited.result._frame, at: new Date(c.db.clock().getTime() - (TIMING.frameWaitSec + 5) * 1000).toISOString() } };
  assert.equal(await c.engine.finalize(waited), "completed");

  const d = clipSetup({ checkClipWords: async () => { throw new Error("whisper down"); }, requestClipFrame: async () => null });
  await d.engine.kick({ storyId: d.storyId });
  assert.equal(await d.engine.onResult(d.sent[0].taskUUID, CLIP(d.sent[0].taskUUID)), "completed");
});

test("picture check: the one redraw is told what to fix, and the scene's saved prompt follows", async () => {
  const db = createMemoryDb();
  const sent = [];
  let n = 0;
  let looks = 0;
  const engine = createEngine({
    store: db.store,
    runware: { submit: async (env) => { sent.push(env); return { httpStatus: 200, body: { data: [{ taskUUID: env.taskUUID }] } }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
    media: { store: async ({ path }) => `https://cdn.test/${path}` },
    env: {}, now: () => db.clock(), uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, log: { error() {} },
    checkPicture: async () => (++looks === 1 ? verdictOf({ characters: [{ name: "Kai Coconut", visible: true, hasFruitHead: true }], mainFigures: 1, humanHeads: 0, speakerHeadPercent: 30, speakerShownTo: "feet" }, [{ name: "Kai Coconut", fruit: "coconut" }], { speaker: "Kai Coconut" }) : { ok: true, problems: [], fixes: [] }),
    redrawRequest: (job, verdict) => ({ ...job.request, positivePrompt: withRedrawHint(job.request.positivePrompt, verdict.fixes) }),
  });
  const storyId = db.addStory({ sceneCount: 1 });
  const sceneRow = [...db.scenes.values()][0];
  db.chargeStep(storyId, { from: ["draft"], to: "pictures", items: [{ scene_id: sceneRow.id, kind: "image", credits: 2, request: { taskType: "imageInference", positivePrompt: "Kai on the beach." } }] });
  await engine.kick({ storyId });
  assert.equal(await engine.onResult(sent[0].taskUUID, IMG(sent[0].taskUUID)), "redrawn");
  assert.equal(sent[1].positivePrompt, "Kai on the beach. Fix from the last attempt: Reframe much closer: a tight chest-up shot of Kai Coconut, the head filling a third of the frame height, cropped at the chest. No legs, no feet, no floor.");
  assert.equal(sceneRow.image_prompt, sent[1].positivePrompt, "saved == sent");
  assert.equal(await engine.onResult(sent[1].taskUUID, IMG(sent[1].taskUUID)), "completed");
  assert.equal(sceneRow.image_check, "passed");
});

test("the picture check: what fails a picture now, and what no longer does", () => {
  const expected = [{ name: "Kai Coconut", fruit: "coconut" }];
  const answer = (over) => ({ characters: [{ name: "Kai Coconut", visible: true, hasFruitHead: true }], mainFigures: 1, backgroundFigures: 0, humanHeads: 0, humanHair: false, duplicates: [], readableText: "", speakerHeadPercent: 34, speakerShownTo: "chest", notes: "", ...over });
  const v = (over, o = { speaker: "Kai Coconut" }) => verdictOf(answer(over), expected, o);
  assert.equal(v({ backgroundFigures: 8 }).ok, true, "small extras, wall photos and screens are not flagged");
  assert.deepEqual(v({ speakerShownTo: "feet" }).problems, ["Kai Coconut is shown full body (down to the feet), not chest-up"]);
  assert.deepEqual(v({ speakerHeadPercent: 14, speakerShownTo: "waist" }).problems, ["Kai Coconut is too small in the frame (head about 14% of the height)"]);
  assert.deepEqual(v({ humanHair: true }).problems, ["human hair on a character"]);
  assert.deepEqual(v({ duplicates: ["Kai Coconut"] }).problems, ["Kai Coconut drawn twice"]);
  assert.deepEqual(v({ readableText: "PERRY" }).problems, ['readable writing in the picture ("PERRY")']);
  assert.deepEqual(v({ humanHeads: 1, mainFigures: 2 }).problems, ["1 human head in the picture", "2 characters up front instead of 1"]);
  // A clip's last frame: the camera has moved, so framing and a character out of frame are not problems.
  const frame = { framing: false, missingOk: true };
  assert.equal(v({ speakerShownTo: "feet", characters: [{ name: "Kai Coconut", visible: false, hasFruitHead: false }] }, frame).ok, true);
  assert.equal(v({ humanHeads: 1 }, frame).ok, false);
  assert.equal(withRedrawHint("x".repeat(PICTURE_PROMPT_MAX - 10), ["No hair on anyone."]).length, PICTURE_PROMPT_MAX - 10, "a hint that doesn't fit is left out, never cut");
});

test("Wan's content filter (DataInspectionFailed) is a content block: one softer rewrite on Wan before the Seedance fallback", async () => {
  const blocked = parseRunware({ errors: [{ code: "providerError", message: " responded with HTTP DataInspectionFailed. Additional information below.", taskUUID: "t" }] }, "t");
  assert.equal(blocked.contentPolicy, true);
  assert.equal(blocked.retryable, false);
  const order = [];
  let memory = null;
  const { db, engine, sent, storyId, jobId } = clipSetup({
    // The real rewrite logs a clip_rewrite call; that log is how the engine knows a clip was rewritten already.
    rewriteClip: async (job) => { order.push("rewrite"); memory.calls.push({ job: job.id, purpose: "clip_rewrite" }); return { ...job.request, positivePrompt: "clip, softer" }; },
    fallbackClip: (request) => { order.push("fallback"); return request.model === "alibaba:wan@2.6-flash" ? { ...request, model: "bytedance:seedance@2.0-mini" } : null; },
  });
  memory = db;
  const err = (id) => ({ errors: [{ code: "providerError", message: "responded with HTTP DataInspectionFailed.", taskUUID: id }] });
  await engine.kick({ storyId });
  assert.equal(await engine.onResult(sent[0].taskUUID, err(sent[0].taskUUID)), "rewritten");
  await engine.kick({ storyId });
  assert.equal(sent[1].model, "alibaba:wan@2.6-flash", "the retry stays on Wan");
  assert.equal(sent[1].positivePrompt, "clip, softer");
  assert.equal(await engine.onResult(sent[1].taskUUID, err(sent[1].taskUUID)), "fallback");
  await engine.kick({ storyId });
  assert.equal(sent[2].model, "bytedance:seedance@2.0-mini");
  assert.deepEqual(order, ["rewrite", "fallback"]);
  assert.equal(db.jobs.get(jobId).status, "submitted");
});

test("the frame machine: the final-video image, a small guest, the script through node -e, the job in its environment", () => {
  const cfg = frameMachineConfig({ image: "registry.fly.io/zyvo-render:fruit-final", job: { jobId: "0123456789ab", clipUrl: "https://cdn/x.mp4", uploadUrl: "https://up", callbackUrl: "https://cb", token: "t" } });
  assert.match(cfg.name, /^fruit-frame-01234567-/);
  assert.deepEqual(cfg.config.init.cmd.slice(0, 2), ["node", "-e"]);
  assert.equal(cfg.config.init.cmd[2], FRAME_SCRIPT);
  assert.match(FRAME_SCRIPT, /"-sseof", "-0\.5"/);
  assert.match(FRAME_SCRIPT, /clip_frame_done/);
  assert.equal(JSON.parse(cfg.config.env.FRUIT_FRAME_JOB).clipUrl, "https://cdn/x.mp4");
  assert.equal(cfg.config.auto_destroy, true);
  assert.doesNotThrow(() => new Function(`return async () => { ${FRAME_SCRIPT.replace(/^\(/, "void (")} }`), "the script parses");
});

/* ─── the final video: trim to the last spoken word, captions on the transcript's times ─ */

test("with a transcript a clip ends just after the last spoken word, not after the last sound", () => {
  // "How'd you know the exact pair number, bruv": the voice stops at 2.64 s, room noise runs to 4.61 s.
  const silences = [{ start: 0, end: 0.31 }, { start: 4.61, end: 5.01 }];
  const old = trimWindow(silences, 5.01);
  assert.equal(old.end, 4.86, "sound-based: 2 s of dead air kept");
  const quietAtVoiceLevel = [{ start: 0, end: 0.33 }, { start: 2.68, end: 5.01 }];
  const voiceEnd = voiceEndFrom(quietAtVoiceLevel, 2.64, 5.01);
  assert.equal(voiceEnd, 2.68);
  const win = trimWindow(silences, 5.01, { lastWordEnd: 2.64, voiceEnd });
  assert.equal(win.end, 2.93, "0.25 s after the voice stops");
  assert.equal(win.start, 0.06);
  assert.deepEqual(win.speech, { start: 0.31, end: 2.68 });
  assert.equal(win.by, "words");
  assert.equal(win.holdSec, 0);
  // Whisper ended the last word early but the voice carries on at its own level: the audio has the last say.
  assert.equal(trimWindow(silences, 5.01, { lastWordEnd: 3.72, voiceEnd: voiceEndFrom([{ start: 0, end: 0.33 }, { start: 4.57, end: 5.01 }], 3.72, 5.01) }).end, 4.82);
  // Never past the last sound, never before the last word.
  assert.equal(trimWindow(silences, 5.01, { lastWordEnd: 4.9, voiceEnd: 5.01 }).speech.end, 4.61);
  assert.equal(voiceEndFrom([{ start: 0, end: 0.3 }], 2.6, 5.01), 5.01, "no quiet stretch after the words: the voice runs to the end");
  assert.equal(voiceThresholdDb(-15.9), -30);
  assert.equal(voiceThresholdDb(-30), -35, "never under the fixed floor");
  assert.equal(voiceThresholdDb(NaN), -35);
  assert.equal(KEEP_SEC, 0.25);
});

test("the closing beat: the last clip holds after its final word, on real footage first, then on a frozen frame", () => {
  const silences = [{ start: 0, end: 0.3 }, { start: 4.6, end: 5.0 }];
  const real = trimWindow(silences, 5.0, { lastWordEnd: 2.6, voiceEnd: 2.65, closingBeatSec: 1.0 });
  assert.equal(real.end, 3.65);
  assert.equal(real.holdSec, 0, "the clip itself has a second of reaction left");
  const short = trimWindow(silences, 5.0, { lastWordEnd: 4.5, voiceEnd: 4.6, closingBeatSec: 1.8 });
  assert.equal(short.end, 5.0);
  assert.equal(short.holdSec, 1.4, "the rest is the last frame, held");
  const args = segmentArgs({ input: "in.mp4", output: "out.mp4", start: short.start, end: short.end, aspect: "9:16", holdSec: short.holdSec });
  assert.ok(args[args.indexOf("-vf") + 1].includes("tpad=stop_mode=clone:stop_duration=1.400"));
  assert.ok(args[args.indexOf("-af") + 1].endsWith(",apad=pad_dur=1.400"));
  assert.equal(args[args.indexOf("-t") + 1], (short.end - short.start + 1.4).toFixed(3));
  assert.ok(!segmentArgs({ input: "in.mp4", output: "out.mp4", start: 0, end: 3, aspect: "9:16" }).join(" ").includes("tpad"));
  const story = { id: "s", aspect: "9:16" };
  const scenes = [{ idx: 0, clip_status: "ready", clip_url: "u", line: "One." }];
  assert.equal(buildFinalJob({ story, scenes, callId: "c", captions: true }).closingBeatSec, CLOSING_BEAT_SEC.plain);
  assert.equal(buildFinalJob({ story, scenes, callId: "c", captions: true, overlays: { part: "Part 1", end: "Part 2: Next\nFollow for more" } }).closingBeatSec, CLOSING_BEAT_SEC.endCard);
});

test("captions sit on the transcript's own word times: only the first word's start is pulled to the first sound", () => {
  // Whisper: first word "starts" at 0.00 though the voice comes in at 0.43; the rest sits on the audio.
  const transcript = [{ word: "Relax", start: 0, end: 0.66 }, { word: "man,", start: 0.66, end: 0.98 }, { word: "I", start: 1.1, end: 1.2 }, { word: "was", start: 1.2, end: 1.38 }, { word: "just", start: 1.38, end: 1.68 }, { word: "asking", start: 1.68, end: 2.06 }, { word: "a", start: 2.06, end: 2.14 }, { word: "question.", start: 2.14, end: 2.68 }];
  const speech = { start: 0.43, end: 2.73 };
  const { words, source } = timedWords("Relax man, I was just asking a question.", transcript, speech, 5.01);
  assert.equal(source, "speech-to-text");
  assert.equal(words[0].start, 0.43);
  assert.equal(words[0].end, 0.66);
  assert.deepEqual(words.slice(1).map((w) => [w.start, w.end]), transcript.slice(1).map((w) => [w.start, w.end]), "nothing is stretched");
  // The old builder stretched the words across the SOUND (0.43 to 3.82 s here): "just" came up 0.5 s late.
  assert.equal(words[4].text, "just");
  assert.equal(words[4].start, 1.38);
  assert.deepEqual(clampToSpeech([{ text: "tonight.", start: 2.5, end: 3.4 }], { start: 0.3, end: 2.9 }), [{ text: "tonight.", start: 2.5, end: 2.9 }]);
  // What was said instead of the line: the caption text is the transcript, timed word for word.
  const said = timedWords("I already knowed, darling.", [{ word: "I", start: 0, end: 0.2 }, { word: "already", start: 0.2, end: 0.6 }, { word: "knowed,", start: 0.6, end: 1.1 }, { word: "darling.", start: 1.3, end: 1.8 }], { start: 0.1, end: 1.85 }, 4);
  assert.deepEqual(said.words.map((w) => w.text), ["I", "already", "knowed,", "darling."]);
  assert.equal(said.words[2].start, 0.6);
});
