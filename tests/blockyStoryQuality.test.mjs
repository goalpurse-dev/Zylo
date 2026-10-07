// Story quality (decision 40, after the first real story on 2026-10-08).
//
// That story came out flat ("ban you / no / try me / no, ban you") and its
// twist never reached the viewer. What had happened: the first draft ended on
// the reveal, the editor failed it for "repeating" a role it had been shown as
// if the viewer knew it, and the rewrite (returned unread) removed the reveal.
//
// Pinned here:
//   - the writer returns the plan behind the story (premise, emotion, twist,
//     the scene that reveals it) and code checks what code can check;
//   - the editor reads as a viewer: roles and the twist are notes the viewer
//     never sees;
//   - the quality pass: draft, check, rewrite what fails, CHECK AGAIN, at most
//     two rewrites, and the version with the fewest problems is returned;
//   - upload titles: a hook sentence, never keywords after a dash.
import test from "node:test";
import assert from "node:assert/strict";
import { MAX_REWRITES, plannerSchema, runPlanner, validatePlan } from "../supabase/functions/_shared/blocky/planner.js";
import { REVIEW_RULES, buildReviewPrompt, reviewSchema } from "../supabase/functions/_shared/blocky/scriptReview.js";
import { STORY_EMOTIONS, cleanUpload } from "../supabase/functions/_shared/blocky/rules.js";
import { packagePrompt, writeUploadPackage } from "../supabase/functions/_shared/blocky/uploadPackage.js";
import { BLOCKY_MODELS } from "../supabase/functions/_shared/blocky/models.js";
import { SPEAKING_SHOTS } from "../supabase/functions/_shared/blocky/shots.js";
import { ROSTER } from "../scripts/blocky/roster.mjs";

const rows = ROSTER.map((a) => ({ id: a.id, name: a.name, tag: a.tag, role: a.role, face: a.face, look: a.look, voice_style: a.voice }));
const cast = ["vex", "noob"].map((id) => rows.find((r) => r.id === id));
const scene = (speakerId, line, raises) => ({ speakerId, line, presentIds: ["vex", "noob"], locationId: "loc1", action: "points one block arm straight ahead", emotion: "icy calm", shot: SPEAKING_SHOTS[0], placement: "", beat: "The fake ban", raises });
/** A good 20-second, four-scene story: hook, worse, turn, twist line. */
const good = (over = {}) => ({
  premise: "What happens if a fake admin tries to ban the player who built the server?",
  emotion: "satisfaction",
  twist: "Noob built the server and owns it.",
  revealScene: 4,
  title: "The Admin Who Wasn't",
  roles: [{ id: "vex", role: "the fake admin" }, { id: "noob", role: "the owner nobody suspects" }],
  outfits: [],
  endState: { characters: [], props: [] },
  locations: [{ id: "loc1", description: "A spawn plaza built from smooth plastic blocks with a round fountain and plain market stalls", timeOfDay: "midday", lighting: "bright even daylight", seriesLocationId: "" }],
  scenes: [
    scene("vex", "Break one more rule and you're banned. Forever.", "a ban is threatened"),
    scene("noob", "You can't. Only the owner bans people.", "the fake admin is called out"),
    scene("vex", "Then watch me.", "the ban is about to happen"),
    scene("noob", "Go ahead. I built this server.", "the victim turns out to own it"),
  ],
  ...over,
});
const ctx = { source: "prompt", cast, sceneCount: 4, quality: "v2", lengthSec: 20 };
const errorsOf = (plan) => validatePlan(plan, ctx).errors;

test("the writer returns the plan behind the story, and a good four-scene story passes every code check", () => {
  const schema = plannerSchema(["vex", "noob"]);
  for (const key of ["premise", "emotion", "twist", "revealScene"]) assert.ok(schema.required.includes(key), key);
  assert.deepEqual(schema.properties.emotion.enum, [...STORY_EMOTIONS]);
  assert.deepEqual([...STORY_EMOTIONS], ["curiosity", "dread", "injustice", "satisfaction", "shock"]);
  assert.ok(schema.properties.scenes.items.required.includes("raises"));
  const { plan, errors } = validatePlan(good(), ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual([plan.premise, plan.emotion, plan.twist, plan.revealScene], [good().premise, "satisfaction", good().twist, 4]);
  assert.equal(plan.scenes[3].raises, "the victim turns out to own it");
  assert.ok(plan.lengthSec <= 20, "never longer than the length asked for");
});

test("code refuses what code can see: no plan, a reveal in the first half, lines that repeat, lines all the same length, a reported 'I typed'", () => {
  assert.ok(errorsOf(good({ premise: "A fake admin story." })).some((e) => /premise: one sentence that starts "What happens if"/.test(e)));
  assert.ok(errorsOf(good({ emotion: "funny" })).some((e) => /emotion: exactly one of curiosity, dread, injustice, satisfaction, shock/.test(e)));
  assert.ok(errorsOf(good({ twist: "A twist." })).some((e) => /^twist:/.test(e)));
  assert.ok(errorsOf(good({ revealScene: 1 })).some((e) => /revealScene: the scene \(3 to 4\)/.test(e)), "with four scenes the reveal is in scene 3 or 4");
  assert.deepEqual(errorsOf(good({ revealScene: 3 })), []);
  // The first real story's shape: the same threat thrown back and forth.
  const echo = good();
  echo.scenes[2] = scene("vex", "Break one more rule and you're banned, forever, Noob.", "the same threat again");
  assert.ok(errorsOf(echo).some((e) => /scenes 1 and 3 say almost the same thing/.test(e)));
  const flat = good();
  flat.scenes = [scene("vex", "Break one more rule and you're banned.", "a"), scene("noob", "You can't ban me, only owners can.", "b b"), scene("vex", "Then watch me do it right now.", "c c"), scene("noob", "Go ahead, because I built this server.", "d d")];
  assert.ok(errorsOf(flat).some((e) => /the lines are all about the same length \(7, 7, 7, 7 words\)/.test(e)));
  const typed = good();
  typed.scenes[0] = scene("vex", "Freeze, I just typed ban Noob forever.", "a ban is threatened");
  assert.ok(errorsOf(typed).some((e) => /scene 1: nobody reports what they typed or wrote/.test(e)));
  // The user's own script is staged as written: none of this applies to it.
  const script = [{ speakerId: "vex", line: "Freeze, I just typed ban Noob forever." }, { speakerId: "noob", line: "Freeze, I just typed ban Vex forever." }];
  const staged = { ...good(), premise: "", twist: "", revealScene: 0, scenes: script.map(() => { const { speakerId: _s, line: _l, raises: _r, ...rest } = scene("vex", "x", ""); return rest; }) };
  assert.deepEqual(validatePlan(staged, { source: "script", cast, script, sceneCount: 2, quality: "v2", lengthSec: 15 }).errors, []);
});

test("the editor reads as a viewer: roles and the twist are notes the viewer never sees", () => {
  const { plan } = validatePlan(good(), ctx);
  const { system, user } = buildReviewPrompt({ plan, cast, source: "prompt" });
  assert.deepEqual(Object.keys(REVIEW_RULES), ["firstLine", "escalation", "twistShown", "ending", "natural", "inPicture", "textMessage", "title", "heardOnce", "premise", "retell"]);
  assert.deepEqual(Object.keys(reviewSchema().properties), Object.keys(REVIEW_RULES));
  for (const id of Object.keys(REVIEW_RULES)) assert.match(system, new RegExp(`^${id}: `, "m"), id);
  const [seen, notes] = user.split("WRITER'S NOTES");
  assert.match(seen, /CHARACTERS \(as the viewer sees them\):\n- Vex, blocky game avatar; looks like this in every scene:/);
  assert.doesNotMatch(seen, /the fake admin|the owner nobody suspects|Noob built the server/, "no role and no twist in what the viewer sees");
  assert.match(notes, /twist: Noob built the server and owns it\.\nthe writer says the twist is revealed in scene 4\nroles: Vex is the fake admin; Noob is the owner nobody suspects/);
  assert.match(notes, /what each scene is meant to raise: 1\. a ban is threatened 2\. the fake admin is called out/);
  assert.match(system, /twistShown: The twist in the writer's notes must reach the viewer: said out loud in a line, or plainly visible in a picture/);
  assert.match(system, /escalation: Every scene after the first makes it worse, weirder or higher stakes/);
});

/** A fake writer and editor. drafts: the writer's answers in order; verdicts: the editor's, as lists of failed rule ids. */
function fakes(drafts, verdicts) {
  const log = [];
  const answer = (failed) => Object.fromEntries(Object.keys(REVIEW_RULES).map((id) => [id, failed.includes(id) ? { pass: false, scene: 4, problem: `${id} fails`, fix: "fix it" } : { pass: true, scene: 0, problem: "", fix: "" }]));
  let d = 0, v = 0;
  return {
    log,
    llm: async (o) => { log.push(o.purpose); return { data: drafts[Math.min(d++, drafts.length - 1)], costUsd: 0.02 }; },
    reviewLlm: async (o) => { log.push(o.purpose); assert.equal(o.review, true); return { data: answer(verdicts[Math.min(v++, verdicts.length - 1)]) }; },
  };
}
const draft = (lastLine, title = "The Admin Who Wasn't") => good({ title, scenes: [...good().scenes.slice(0, 3), scene("noob", lastLine, "the victim turns out to own it")] });
const run = (f) => runPlanner({ source: "prompt", cast, lengthSec: 20, quality: "v2", prompt: "A fake admin bans the wrong player.", llm: f.llm, reviewLlm: f.reviewLlm });

test("the quality pass: a draft that passes is returned as it is, after one check", async () => {
  const f = fakes([draft("Go ahead. I built this server.")], [[]]);
  const r = await run(f);
  assert.deepEqual(f.log, ["planner", "script_review"]);
  assert.deepEqual([r.review.ok, r.review.rewritten, r.review.rounds], [true, false, 0]);
});

test("the quality pass: what fails is rewritten, and the rewrite is CHECKED AGAIN before it is returned", async () => {
  const f = fakes([draft("Fine. You win this time."), draft("Go ahead. I built this server.")], [["ending", "twistShown"], []]);
  const r = await run(f);
  assert.deepEqual(f.log, ["planner", "script_review", "planner_rewrite", "script_review"], "draft, check, rewrite, check");
  assert.equal(r.plan.scenes[3].line, "Go ahead. I built this server.");
  assert.deepEqual([r.review.ok, r.review.rewritten, r.review.rounds], [true, true, 1]);
  assert.deepEqual(r.review.left, []);
  assert.equal(r.review.before.lines[3], "Fine. You win this time.", "the first draft is kept on record");
  assert.equal(r.review.history.length, 2);
});

test("the quality pass: at most two rewrites, each one checked; never a third", async () => {
  assert.equal(MAX_REWRITES, 2);
  const f = fakes([draft("Fine. You win this time."), draft("Okay, okay. I'm leaving now."), draft("Go ahead. I built this server."), draft("never asked for")], [["ending", "twistShown"], ["ending"], []]);
  const r = await run(f);
  assert.deepEqual(f.log, ["planner", "script_review", "planner_rewrite", "script_review", "planner_rewrite", "script_review"]);
  assert.deepEqual([r.review.ok, r.review.rounds], [true, 2]);
  const stuck = fakes([draft("Fine. You win this time."), draft("Okay, okay. I'm leaving now."), draft("See you around, I guess.")], [["ending", "twistShown"], ["ending", "twistShown"], ["ending", "twistShown"]]);
  const s = await run(stuck);
  assert.equal(stuck.log.filter((p) => p === "planner_rewrite").length, 2, "two rewrites, then it stops");
  assert.equal(s.review.ok, false);
  assert.equal(s.review.left.length, 2, "what is still wrong is on record");
});

test("the quality pass keeps the best version: a rewrite that reads worse than the draft is not returned (the first real story's failure)", async () => {
  // The draft has one problem; both rewrites come back with two. The draft wins.
  const f = fakes([draft("Go ahead. I built this server.", "The Fake Admin Meets The Owner"), draft("Wrong. Now I ban you, for real."), draft("Nope. Banned again, loser.")], [["title"], ["ending", "twistShown"], ["ending", "twistShown"]]);
  const r = await run(f);
  assert.equal(r.plan.scenes[3].line, "Go ahead. I built this server.", "the reveal is not lost to a worse rewrite");
  assert.deepEqual([r.review.ok, r.review.rewritten], [false, false]);
  assert.deepEqual(r.review.left.map((p) => p.rule), ["title"]);
  // A rewrite that is better but not perfect replaces the draft.
  const g = fakes([draft("Fine. You win this time."), draft("Go ahead. I built this server.", "The Fake Admin Meets The Owner"), draft("Go ahead. I built this server.", "The Fake Admin Meets The Owner")], [["ending", "twistShown"], ["title"], ["title"]]);
  const better = await run(g);
  assert.equal(better.plan.scenes[3].line, "Go ahead. I built this server.");
  assert.deepEqual(better.review.left.map((p) => p.rule), ["title"]);
});

test("the editor is the writer's model, and a check that can't run never fails a story", async () => {
  assert.deepEqual(BLOCKY_MODELS.review, BLOCKY_MODELS.planner);
  const down = { log: [], llm: async (o) => { down.log.push(o.purpose); return { data: draft("Go ahead. I built this server.") }; }, reviewLlm: async () => { throw new Error("editor is down"); } };
  const r = await run(down);
  assert.equal(r.review.ok, true);
  assert.match(r.review.skipped, /review could not run/);
  assert.equal(r.plan.scenes.length, 4);
});

test("upload text: a hook sentence with the keywords inside it; keywords after a dash are refused, retried once, and the twist stays secret", async () => {
  const base = { description: "A fake Roblox admin picks the wrong player to ban on an obby server. Who was really in charge? #roblox #adminprank #obby", tags: "roblox story, admin prank, obby", pinnedComment: "Was the ban fair, or was it abuse?", caption: "The admin picked the wrong player.", hashtags: ["#roblox", "#adminprank", "#obby"] };
  const bolted = { ...base, title: "Fake Admin Thinks He's the Owner — roblox story admin prank ban twist" };   // the first real story's title
  const hook = { ...base, title: "This Roblox admin banned the wrong player #roblox" };
  assert.match(cleanUpload(bolted).problems.join("; "), /title: no keywords after a dash, a bar or a colon; write ONE hook sentence with the keywords inside it/);
  assert.match(cleanUpload({ ...hook, title: "The wrong ban | roblox admin prank" }).problems.join("; "), /no keywords after a dash, a bar or a colon/);
  assert.match(cleanUpload({ ...hook, title: "Wrong ban: roblox admin prank story" }).problems.join("; "), /no keywords after a dash, a bar or a colon/);
  assert.deepEqual(cleanUpload(hook).problems, []);
  assert.deepEqual(cleanUpload({ ...hook, title: "Why did this Roblox admin's ban backfire? #roblox" }).problems, [], "an apostrophe or a question is fine");
  assert.match(cleanUpload({ ...hook, description: "A prank goes wrong — roblox story, admin prank, ban twist. Who was wrong? #roblox #adminprank #obby" }).problems.join("; "), /description: no keyword list after a dash/);
  // The twist is handed over as a secret.
  assert.match(packagePrompt({ title: "The Admin Who Wasn't", lines: [{ speaker: "Vex", line: "Then watch me." }], twist: "Noob built the server and owns it." }), /THE TWIST \(keep it secret: the title, the description and the caption tease it and never give it away\): Noob built the server and owns it\./);
  // A bad first answer gets one more try, told what was wrong.
  const logged = [];
  const admin = { from: () => ({ insert: async (row) => { logged.push(row); return {}; } }) };
  const asked = [];
  const pkg = await writeUploadPackage({ admin, apiKey: "k", ids: {}, input: { title: "The Admin Who Wasn't", lines: [{ speaker: "Vex", line: "Then watch me." }] },
    fetchLlm: async (req) => { asked.push(req.user); return { data: asked.length === 1 ? bolted : hook, costUsd: 0.0015, httpStatus: 200, usage: {} }; } });
  assert.equal(pkg.title, hook.title);
  assert.equal(asked.length, 2);
  assert.match(asked[1], /IT BREAKS THESE RULES\. Fix every one and answer again in full:\n- title: no keywords after a dash/);
  assert.deepEqual(logged.map((r) => r.ok), [false, true]);
  assert.equal(pkg.costUsd, 0.003, "both calls are counted");
});
