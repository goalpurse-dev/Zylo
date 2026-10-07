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
//
// The twist round (decisions 46 to 48, after seven sample stories averaged 5.6
// of 10: every twist was the obvious one and arrived as a confession):
//   - the writer drafts three twists that flip what the opening made the viewer
//     assume and keeps the least expected; a proof or an action forces it out;
//     something changes for someone; the winner has the short last line;
//   - nobody does what their role can't; nothing needs reading on screen, and
//     no line or action uses a word about writing;
//   - the title shares no key word with the twist;
//   - the editor checks all of it (fourteen rules) and is strict on endings.
import test from "node:test";
import assert from "node:assert/strict";
import { LAST_LINE_MAX_WORDS, MAX_REWRITES, WRITTEN_WORD, keyWords, plannerSchema, runPlanner, validatePlan } from "../supabase/functions/_shared/blocky/planner.js";
import { REVIEW_RULES, buildReviewPrompt, reviewSchema } from "../supabase/functions/_shared/blocky/scriptReview.js";
import { REVIEW_SYSTEM, STORY_EMOTIONS, WRITTEN_WORDS, cleanUpload } from "../supabase/functions/_shared/blocky/rules.js";
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
  assumed: "Vex is an admin and Noob is about to be banned.",
  twists: ["Noob built the server and owns it.", "Vex is the one who is already banned.", "The ban only works on whoever says it."],
  twist: "Noob built the server and owns it.",
  forcedBy: "Noob holds up the owner's golden key",
  consequence: "Vex is kicked from the server he pretended to run.",
  winnerId: "noob",
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
  for (const key of ["premise", "emotion", "assumed", "twists", "twist", "forcedBy", "consequence", "winnerId", "revealScene"]) assert.ok(schema.required.includes(key), key);
  // The three twists come before the one that is kept, and all of it before the title and the lines.
  const order = Object.keys(schema.properties);
  assert.ok(order.indexOf("twists") < order.indexOf("twist") && order.indexOf("twist") < order.indexOf("title") && order.indexOf("title") < order.indexOf("scenes"));
  assert.deepEqual(schema.properties.winnerId.enum, ["vex", "noob"]);
  assert.deepEqual(schema.properties.emotion.enum, [...STORY_EMOTIONS]);
  assert.deepEqual([...STORY_EMOTIONS], ["curiosity", "dread", "injustice", "satisfaction", "shock"]);
  assert.ok(schema.properties.scenes.items.required.includes("raises"));
  const { plan, errors } = validatePlan(good(), ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual([plan.premise, plan.emotion, plan.twist, plan.revealScene], [good().premise, "satisfaction", good().twist, 4]);
  assert.deepEqual([plan.assumed, plan.twists.length, plan.forcedBy, plan.consequence, plan.winnerId], [good().assumed, 3, good().forcedBy, good().consequence, "noob"]);
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
  assert.ok(errorsOf(typed).some((e) => /scene 1: the line says "typed"; no line uses a word about writing or reading/.test(e)));
  // The user's own script is staged as written: none of this applies to it.
  const script = [{ speakerId: "vex", line: "Freeze, I just typed ban Noob forever." }, { speakerId: "noob", line: "Freeze, I just typed ban Vex forever." }];
  const staged = { ...good(), premise: "", twist: "", revealScene: 0, assumed: "", twists: [], forcedBy: "", consequence: "", winnerId: "vex", scenes: script.map(() => { const { speakerId: _s, line: _l, raises: _r, ...rest } = scene("vex", "x", ""); return rest; }) };
  assert.deepEqual(validatePlan(staged, { source: "script", cast, script, sceneCount: 2, quality: "v2", lengthSec: 15 }).errors, []);
});

test("the twist round in code: three twists, a forced reveal, a consequence, the winner's short last line, a title that shares nothing with the twist", () => {
  assert.ok(errorsOf(good({ assumed: "Vex wins." })).some((e) => /^assumed:/.test(e)));
  assert.ok(errorsOf(good({ twists: ["Noob built the server and owns it."] })).some((e) => /twists: exactly THREE different twists/.test(e)));
  assert.ok(errorsOf(good({ twists: ["Noob built the server and owns it.", "noob built the server and owns it.", "The ban only works on whoever says it."] })).some((e) => /twists: exactly THREE different twists/.test(e)), "the same twist three times is one twist");
  // "The villain admits it" is not a reveal.
  assert.ok(errorsOf(good({ forcedBy: "Vex admits he is not an admin" })).some((e) => /forcedBy: "Vex admits he is not an admin" is a confession; a proof or an action forces the twist out/.test(e)));
  assert.ok(errorsOf(good({ forcedBy: "Vex finally confesses" })).some((e) => /is a confession/.test(e)));
  assert.ok(errorsOf(good({ forcedBy: "" })).some((e) => /^forcedBy: the proof or the action/.test(e)));
  assert.ok(errorsOf(good({ consequence: "Nothing." })).some((e) => /^consequence: what changes for whom/.test(e)));
  // The last line belongs to the winner, and it is short.
  assert.ok(errorsOf(good({ winnerId: "vex" })).some((e) => /the last line belongs to the winner \(vex\), not to noob/.test(e)));
  assert.ok(errorsOf(good({ winnerId: "taz" })).some((e) => /^winnerId:/.test(e)), "the winner is in the cast");
  assert.equal(LAST_LINE_MAX_WORDS, 10);
  const long = good();
  long.scenes[3] = scene("noob", "Go ahead and try it, because I built this whole server myself.", "the victim turns out to own it");
  assert.ok(errorsOf(long).some((e) => /the last line is 12 words; it is the punchline: 8 words or fewer/.test(e)));
  // The title: no key word from the twist, unless the first line already says it (or it is a name).
  assert.deepEqual(keyWords("Vex is making up rules on the spot because there is no actual rule list"), ["vex", "making", "rule", "spot", "actual", "list"]);
  assert.ok(errorsOf(good({ title: "The Noob Who Owns It" })).some((e) => /title: "The Noob Who Owns It" has "own" from the twist/.test(e)));
  assert.ok(errorsOf(good({ title: "He Built It" })).some((e) => /has "built" from the twist/.test(e)));
  assert.deepEqual(errorsOf(good({ title: "Banned By Noob" })), [], "a name and a word from the first line are fine");
  // Words about writing: in no line and in no action (they make the video model draw text).
  for (const w of WRITTEN_WORDS) assert.ok(WRITTEN_WORD.test(`look at the ${w} now`), w);
  for (const fine of ["nice design", "signal me", "already ready", "the texture of the block", "spread the word"]) assert.ok(!WRITTEN_WORD.test(fine), fine);
  for (const line of ["Check the chat. Everyone saw it.", "The sign says no entry here.", "Your message got you banned today."]) {
    const bad = good();
    bad.scenes[1] = scene("noob", line, "the fake admin is called out");
    assert.ok(errorsOf(bad).some((e) => /scene 2: the line says "(chat|sign|message)"/.test(e)), line);
  }
  const acted = good();
  acted.scenes[1] = { ...scene("noob", "You can't. Only the owner bans people.", "the fake admin is called out"), action: "types a command on a floating keyboard" };
  assert.ok(errorsOf(acted).some((e) => /scene 2: the action says "types"; words about writing or reading make the video model draw text/.test(e)));
  // The user's own lines are theirs, but the action the writer adds to them is still checked.
  const script = [{ speakerId: "vex", line: "Check the chat right now." }, { speakerId: "noob", line: "I wrote it myself." }];
  const stage = (action) => ({ ...good(), scenes: script.map(() => { const { speakerId: _s, line: _l, raises: _r, ...rest } = scene("vex", "x", ""); return { ...rest, action }; }) });
  const sctx = { source: "script", cast, script, sceneCount: 2, quality: "v2", lengthSec: 15 };
  assert.deepEqual(validatePlan(stage("points one block arm straight ahead"), sctx).errors, []);
  assert.ok(validatePlan(stage("holds up a sign"), sctx).errors.some((e) => /the action says "sign"/.test(e)));
});

test("a style note never fails a story: it is sent back once, and what is left goes to the editor (2 of 5 stories were lost to 'the lines are all about the same length')", async () => {
  const flat = good();
  flat.scenes = [scene("vex", "Break one more rule and you're banned.", "a a"), scene("noob", "You can't ban me, only owners can.", "b b"), scene("vex", "Then watch me do it right now.", "c c"), scene("noob", "Go ahead, because I built this server.", "d d")];
  const v = validatePlan(flat, ctx);
  assert.ok(v.errors.some((e) => /the lines are all about the same length/.test(e)), "the writer is still told");
  assert.deepEqual(v.hard, [], "but it is not what makes a story unusable");
  // Each style note: told, never fatal.
  for (const over of [{ title: "He Built It" }, { twists: ["Noob built the server and owns it."] }]) {
    const r = validatePlan(good(over), ctx);
    assert.ok(r.errors.length === 1 && r.hard.length === 0, JSON.stringify(over));
  }
  const echo = good();
  echo.scenes[2] = scene("vex", "Break one more rule and you're banned, forever, Noob.", "the same threat again");
  assert.deepEqual(validatePlan(echo, ctx).hard, []);
  // A real fault is still fatal: a word about writing, the wrong winner, no premise.
  for (const bad of [good({ winnerId: "vex" }), good({ premise: "A story." }), good({ forcedBy: "Vex admits it all" })]) assert.ok(validatePlan(bad, ctx).hard.length > 0);
  // Through the planner: draft and repair both come back flat. The story is written anyway, and the editor reads it.
  const f = fakes([flat, flat], [[]]);
  const r = await run(f);
  assert.deepEqual(f.log, ["planner", "planner_repair", "script_review"]);
  assert.equal(r.plan.scenes.length, 4);
  // A real fault left after the repair still fails the story, and says which.
  const broken = fakes([good({ winnerId: "vex" }), good({ winnerId: "vex" })], [[]]);
  await assert.rejects(run(broken), (e) => e.code === "PLANNER_FAILED" && /the last line belongs to the winner/.test(e.details.join(" ")));
});

test("the editor reads as a viewer: roles and the twist are notes the viewer never sees", () => {
  const { plan } = validatePlan(good(), ctx);
  const { system, user } = buildReviewPrompt({ plan, cast, source: "prompt" });
  assert.deepEqual(Object.keys(REVIEW_RULES), ["firstLine", "escalation", "flip", "twistShown", "forced", "ending", "powers", "natural", "inPicture", "textMessage", "title", "heardOnce", "premise", "retell"]);
  assert.equal(system, REVIEW_SYSTEM);
  assert.deepEqual(Object.keys(reviewSchema().properties), Object.keys(REVIEW_RULES));
  for (const id of Object.keys(REVIEW_RULES)) assert.match(system, new RegExp(`^${id}: `, "m"), id);
  const [seen, notes] = user.split("WRITER'S NOTES");
  assert.match(seen, /CHARACTERS \(as the viewer sees them\):\n- Vex, blocky game avatar; looks like this in every scene:/);
  assert.doesNotMatch(seen, /the fake admin|the owner nobody suspects|Noob built the server/, "no role and no twist in what the viewer sees");
  assert.match(notes, /what the viewer is meant to assume after the first two lines: Vex is an admin and Noob is about to be banned\.\ntwist: Noob built the server and owns it\.\nthe writer says the twist is revealed in scene 4\nthe writer says this forces the twist out: Noob holds up the owner's golden key\nthe writer says this changes by the end: Vex is kicked from the server he pretended to run\.\nthe writer says the winner is: Noob\nroles: Vex is the fake admin; Noob is the owner nobody suspects/);
  // What the speaker is seen doing is part of the picture the viewer sees (a proof held up is a proof shown).
  assert.match(seen, /4\. \[in the picture: Vex, Noob; place: [^\]]*; Noob points one block arm straight ahead\] Noob: Go ahead\. I built this server\./);
  // The twist round: the editor is strict on the three rules that decide whether a story is shared.
  assert.match(system, /Be STRICT on flip, forced and ending/);
  assert.match(system, /flip: The twist FLIPS what the viewer assumed after the first two lines[^]*It fails if the "twist" only confirms what the viewer already suspected \(the villain was lying, and says so\)[^]*or if it takes the stakes away \(the danger was harmless all along\)/);
  assert.match(system, /forced: The twist comes out because of a PROOF or an ACTION the viewer sees or hears happen[^]*It fails if a character simply admits it/);
  assert.match(system, /ending: By the last line something has CHANGED for someone[^]*The last line is spoken by whoever comes out on top, it is short \(8 words or fewer; 10 at the very most\)[^]*if the ending deflates \(the threat turns out harmless or kind and costs nobody anything\); if the loser has the last word/);
  assert.match(system, /powers: Nobody does or threatens what their role can't do\. Only an admin or the owner can ban, kick, mute, reset or change the server; a plain player can't\./);
  assert.match(system, /textMessage: The story never needs the viewer to READ anything: the pictures carry no words and no numbers\./);
  assert.match(system, /A fix never asks a character to admit, confess or explain: it names a proof or an action instead\./);
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
