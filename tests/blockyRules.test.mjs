// Blocky Stories' own rules (supabase/functions/_shared/blocky/: rules.js,
// safety.js, look.js) and the avatar roster (scripts/blocky/roster.mjs).
// Offline: prompts are built and answers are checked, nothing is sent.
import test from "node:test";
import assert from "node:assert/strict";
import { UPLOAD_LIMITS } from "../supabase/functions/_shared/blocky/rules.js";
import { bannedNamesIn, bannedNamesMessage } from "../supabase/functions/_shared/blocky/safety.js";
import { BANNED, SYSTEM, buildPlannerPrompt, validatePlan } from "../supabase/functions/_shared/blocky/planner.js";
import { SPEAKING_SHOTS } from "../supabase/functions/_shared/blocky/shots.js";
import { SERIES_SYSTEM, buildSeriesPrompt } from "../supabase/functions/_shared/blocky/series.js";
import { REVIEW_RULES, REVIEW_SYSTEM, buildReviewPrompt, reviewSchema } from "../supabase/functions/_shared/blocky/scriptReview.js";
import { CHECK_SYSTEM, CLIP_FRAME_PURPOSE, checkPicture, checkPrompt, checkSchema, verdictOf } from "../supabase/functions/_shared/blocky/pictureCheck.js";
import { PACKAGE_SYSTEM, cleanPackage, packageSchema, writeUploadPackage } from "../supabase/functions/_shared/blocky/uploadPackage.js";
import { validateCreateStory, validateSeriesPlan } from "../supabase/functions/_shared/blocky/validation.js";
import { buildScenePrompt, PICTURE_PROMPT_MAX, scenePromptLengths } from "../supabase/functions/_shared/blocky/pictures.js";
import { buildClipPrompt, CLIP_PROMPT_MAX } from "../supabase/functions/_shared/blocky/clips.js";
import { ROSTER, BODY_TEMPLATE_LINE, REF_DEFAULTS, avatarPrompt } from "../scripts/blocky/roster.mjs";
import { BLOCKY_BODY } from "../supabase/functions/_shared/blocky/look.js";
import * as I from "./helpers/blockyPromptInputs.mjs";

// Library rows as blocky_characters holds them: no age, no gender.
const rows = ROSTER.map((a) => ({ id: a.id, name: a.name, tag: a.tag, role: a.role, face: a.face, look: a.look, voice_style: a.voice, ref_image_url: `https://example.test/${a.id}.jpg` }));
const LIB = new Map(rows.map((c) => [c.id, c]));
const cast = (...ids) => ids.map((id) => LIB.get(id));
// Nothing a model reads about a character may give an age or a gender.
const PERSON_WORDS = /\b(\d+-year-old|years? old|aged \d+|woman|women|man|men|boys?|girls?|kids?|child|children|teen(ager)?s?|his|her|he|she)\b/i;

test("the roster: 52 one-word avatars, all different, none with an age or a gender", () => {
  assert.equal(ROSTER.length, 52);
  for (const a of ROSTER) {
    assert.match(a.name, /^[A-Z][a-z]+$/, `${a.name} is one word`);
    assert.equal(a.id, a.name.toLowerCase());
    assert.doesNotMatch(`${a.look} ${a.face} ${a.voice} ${a.role} ${a.tag} ${a.tags.join(" ")}`, PERSON_WORDS, a.id);
    assert.equal(bannedNamesIn(`${a.name} ${a.look} ${a.role} ${a.tag}`).length, 0, `${a.id} names nothing real`);
    assert.match(a.face, /^two .*solid black .*eyes.* and one .*solid dark .*open mouth/, `${a.id}: face B (oval eyes, one solid dark open mouth)`);
    assert.match(a.look, / cube head and .* block arms, .* torso .*, .* block legs/);
    assert.doesNotMatch(a.look, /\b(word|letter|logo|text|number)s?\b/i);
    assert.ok(a.tags.length >= 2 && a.voice.split(",").length >= 2, `${a.id} has role tags and a voice`);
    // The voice says how it sounds; the scene decides the emotion.
    assert.doesNotMatch(a.voice, /\b(angry|furious|sad|happy|cheerful|scared|excited|worried|shocked|panicked|smug|unsure|confident|bossy|teasing|calm|dreamy|goofy|gentle|grand)\b/i, `${a.id}: voice has no emotion`);
  }
  for (const key of ["id", "name", "head", "voice", "torso"]) assert.equal(new Set(ROSTER.map((a) => a[key])).size, 52, `every ${key} is different`);
  const accessories = ROSTER.map((a) => a.accessory).filter(Boolean);
  assert.equal(accessories.length, 51, "everyone but the noob has ONE signature accessory");
  assert.equal(new Set(accessories).size, 51, "and no two share one (silhouette contrast)");
  // The exact face (eyes + mouth) is shared by at most two avatars, and never by two with a similar colour.
  const faces = new Map();
  for (const a of ROSTER) faces.set(`${a.eyes}+${a.mouth}`, [...(faces.get(`${a.eyes}+${a.mouth}`) ?? []), a.id]);
  for (const ids of faces.values()) assert.ok(ids.length <= 2, `face shared by ${ids.join(", ")}`);
});

test("the classic noob (decision 13): yellow head and arms, blue torso, green legs, face B, no cap, no accessory", () => {
  const noob = ROSTER.find((a) => a.id === "noob");
  assert.equal(noob.look, "a bright yellow cube head and bright yellow block arms, a plain royal blue torso with no shape on it, green block legs");
  assert.equal(noob.accessory, null);
  assert.doesNotMatch(noob.look, /cap|hat/);
  assert.match(noob.face, /half-circle open mouth/);
});

test("an avatar's reference prompt: full body on white, the locked look, the body-construction text, never 'toy'", () => {
  for (const a of ROSTER) {
    const p = avatarPrompt(a);
    assert.ok(p.includes(`${a.name} has ${a.look}.`) && p.includes(a.face));
    assert.ok(p.includes(BLOCKY_BODY), "decision 19: the body is described by what it IS");
    assert.match(p, /Style: a 3D classic blocky Roblox-style avatar/, "the wording test 2 picked");
    assert.doesNotMatch(p.replace(/no brick-toy minifigures/, ""), /toy/i, "decision 18: never 'toy'");
    assert.match(p, /Full-body 3D character reference of \w+, a blocky game avatar\. Centered on a pure white background/);
    assert.match(p, /no studs, no studded baseplates, no round minifigure heads, no neck studs, no claw hands, no brick-toy minifigures/);
    assert.doesNotMatch(p.replace(/no studs, no studded baseplates/, "").replace(/no neck studs/, ""), /\bstud(s|ded)?\b/i, "studs only as something to leave out");
    assert.doesNotMatch(p, PERSON_WORDS);
    assert.ok(p.length < 2000);
  }
  // The re-test's result is the default: no body template, the minifigure parts named in the leave-out list.
  assert.deepEqual(REF_DEFAULTS, { template: false, minifigure: true });
  const vex = ROSTER.find((a) => a.id === "vex");
  assert.ok(!avatarPrompt(vex).includes(BODY_TEMPLATE_LINE));
  // The two switches the re-test compared change exactly one thing each.
  assert.equal(avatarPrompt(vex, { template: true }).replace(`${BODY_TEMPLATE_LINE} `, ""), avatarPrompt(vex));
  assert.equal(BODY_TEMPLATE_LINE, "Image 1 shows the body construction to copy exactly; ignore its colours, face and outfit.");
  const plain = avatarPrompt(vex, { minifigure: false });
  assert.match(plain, /no extra limbs, no studs, no studded baseplates, no human face or skin/);
  assert.doesNotMatch(plain, /claw hands|brick-toy|minifigure|neck studs/);
});

test("the writer: Blocky's own rules (scope C2)", () => {
  const p = buildPlannerPrompt({ source: "prompt", cast: cast("noob", "vex", "taz"), lengthSec: 30, quality: "v2", prompt: "A fake admin bans the wrong player." });
  assert.equal(p.system, SYSTEM);
  assert.doesNotMatch(p.system, /fruit|TikTok, Reels and Shorts\. The viewer must be hooked in the first second/i);
  // Scope C2, rule by rule.
  for (const must of [
    /obbies, admin commands, servers, trades, leaderboards, NPCs, badges, spawn pads, kill bricks, gamepasses/,
    /The first line drops the viewer into the middle of the action or of a mystery, with something at stake/,
    /"hi guys"/,
    /contractions \("I'm", "you're", "don't"\), interruptions, reactions/,
    /VARY THE LENGTH: put a short punch \(3 to 5 words\) next to a longer line/,
    /No ping-pong\. A line never just throws the last line back/,
    /NOTHING WRITTEN\. The video model draws words onto the picture when a line or an action mentions writing\. So no line and no action uses any of these words: type, typed, write, wrote, written, sign, read, reads, message, chat, text, screen\./,
    /the pictures carry NO words and NO numbers\. The story never depends on something the viewer would have to read: a leaderboard, a countdown number, a rule list/,
    // The writer delivers a locked twist plan (decision 52); the plan itself is twists.js.
    /THE PLAN COMES FIRST \(it is locked: you deliver it, you do not change it\)/,
    /The CLUE goes into the scene the plan names \(scene 1 or 2\)[^]*The viewer can notice it and does NOT understand it yet/,
    /The PAYOFF happens in the scene the plan names: write it into that scene's action, and that scene's line names what just happened/,
    /Nobody confesses and nobody explains\. The twist comes out because the payoff happens/,
    /Every cause is someone in the cast\. Nobody outside the cast did it, set it up, is blamed or is spoken to/,
    /A twist that exists only in the plan does not exist/,
    /No speaker has more than TWO lines in a row/,
    /Never an explanation of the twist \("Only his first owner\. Guess that's me\." explains; "He always comes home full\." lands\)/,
    /Only an admin or the owner can ban, kick, mute, reset, freeze or teleport someone, or change the server\. A player can trade, build/,
    /The LAST line belongs to the winner\. 8 words or fewer/,
    /TWO PLANS, DELIVERED[^]*NEVER reuse these plots, their objects or their lines/,
    /6\. NEWCOMER: Cute commands\. Want to see real ones\?/,
    /EVERY scene after it ESCALATES: worse, weirder or higher stakes than the scene before/,
    /The CLUE is planted early and the PAYOFF comes in the plan's reveal scene/,
    /With 3 or 4 scenes there is no room to waste: 1 the hook, 2 it gets worse, 3 the payoff and the twist is out, 4 the winner's line/,
    /With 5 or more scenes: the hook; it gets worse twice, each time with something NEW; the payoff and the twist is out; the loser's reaction if there is room; the winner's last line/,
    /It is the most quotable line in the video\./,
    /It teases the premise and NEVER states the twist/,
    /presentIds: who is in the frame, speaker included, 1 to 3 characters/,
    /exactly ONE character says exactly ONE line/,
    /copying someone's powers; the invisible-friend glitch; a plain prank on a mom or a sibling; a hacker who steals everything with no twist; "I played as a noob for a day"/,
    /"Exploits", "hacks" and "glitches" are story devices only/,
    /No blood, no gore, no real-world weapons, no romance or crushes, no dangerous stunts/,
    /Never name the real platform, a real game, a real brand, a real creator or a real username/,
    /Never say an age, and never call a character a kid, a child/,
    /Nothing can be read on screen/,
    /outfits: always an empty list/,
  ]) assert.match(p.system, must);
  assert.ok(p.system.includes(BANNED.join("; ")), "the engine's overused phrases");
  assert.ok(p.system.includes(`shot: one of ${SPEAKING_SHOTS.join(", ")}`), "the engine's speaking shots");
  assert.doesNotMatch(p.system, /Roblox/i, "the writer is never given the real platform's name");
  // The cast, as the writer sees it: a blocky game avatar, its tags, its look, how it sounds.
  assert.match(p.user, /- noob: Noob, a blocky game avatar\. New player: Lost, honest and luckier than they look\. Look \(locked\): a bright yellow cube head .* Voice \(how they sound\): bright, small, slightly wobbly./);
  assert.doesNotMatch(p.user.split("THE USER'S STORY")[0], PERSON_WORDS);
  // The word budget (decision 2): 6 scenes of at most 9 words for 30 s.
  assert.match(p.user, /Write exactly 6 scenes for a video of 30 seconds\..* every line AT MOST 9 words/);
});

test("the series planner and the script editor: Blocky's wording, fourteen editor rules, one answer each", () => {
  const s = buildSeriesPrompt({ concept: "A fake admin takes over an obby server.", cast: cast("vex", "noob", "zip"), opener: "Banned in front of everyone", tone: "tense and funny", episodeCount: 5 });
  assert.equal(s.system, SERIES_SYSTEM);
  assert.match(s.system, /blocky game avatars act out a story inside a blocky online game world/);
  assert.match(s.system, /episodes: exactly the requested number/);
  assert.match(s.system, /Never name the real platform, a real game, a real brand, a real creator or a real username/);
  assert.doesNotMatch(s.system, /fruit|Roblox/i);
  assert.match(s.user, /- vex: Vex, a blocky game avatar\. Admin: Cold rule keeper who enjoys the power\. Look \(locked\): a white cube head/);
  assert.doesNotMatch(s.user, PERSON_WORDS);

  const plan = { title: "The Admin Who Wasn't", roles: { vex: "the fake admin" }, outfits: {}, locations: [{ id: "loc1", description: "An admin room with a long console desk" }], scenes: [{ speakerId: "vex", presentIds: ["vex", "noob"], locationId: "loc1", line: "Break this server rule and you're banned." }] };
  const r = buildReviewPrompt({ plan, cast: cast("vex", "noob"), source: "idea" });
  assert.equal(r.system, REVIEW_SYSTEM);
  for (const id of Object.keys(REVIEW_RULES)) assert.match(r.system, new RegExp(`^${id}: `, "m"), `the editor checks ${id}`);
  assert.deepEqual(Object.keys(reviewSchema().properties), Object.keys(REVIEW_RULES), "one answer per rule");
  assert.match(r.system, /A greeting or a setup \("hi guys", "so today"\) fails/);
  // The editor reads as a viewer: it is not shown anyone's secret role as if the viewer knew it.
  assert.match(r.system, /WHAT THE VIEWER KNOWS\nOnly the title, the lines in order, and who is in each picture\. NOT the writer's notes and NOT anyone's secret role/);
  assert.match(r.system, /never fail it for "repeating" the notes, the roles or the premise/);
  assert.match(r.system, /A fix keeps the plan: the same twist, the same clue, the same payoff, the same winner/);
  assert.match(r.user, /WRITER'S NOTES \(the viewer NEVER sees these/);
  assert.ok(r.user.indexOf("roles: Vex is the fake admin") > r.user.indexOf("WRITER'S NOTES"), "roles are in the notes, not in what the viewer sees");
  assert.match(r.system, /names a real game, brand, creator or username/);
  assert.doesNotMatch(r.system, /fruit|Roblox/i);
  assert.match(r.user, /- Vex, blocky game avatar; looks like this in every scene: a white cube head/);
  assert.doesNotMatch(r.user, PERSON_WORDS);
});

test("banned names: real platform, games, brands and creators; everyday words are left alone", () => {
  for (const [text, name] of [["like in Roblox", "Roblox"], ["a thousand robux", "Robux"], ["we met in brookhaven", "Brookhaven"], ["play ADOPT  ME", "Adopt Me"], ["an Adopt Me server", "Adopt Me"], ["bloxfruits grind", "Blox Fruits"], ["a LEGO set", "LEGO"], ["I'm basically MrBeast", "MrBeast"], ["on tiktok", "TikTok"]]) {
    assert.equal(bannedNamesIn(text)[0]?.name, name, text);
  }
  for (const ok of ["Open the doors, quick", "that piggy bank is mine", "will you adopt me a pet, please", "The traitor is among us", "I'm a famous YouTuber", "my Discordant plan", "blocks and bricks", "robuxx"]) {
    assert.deepEqual(bannedNamesIn(ok), [], ok);
  }
  assert.match(bannedNamesMessage("A Roblox admin prank"), /^Leave out "Roblox" \(the real platform\)\. Blocky Stories can't use real game, brand or creator names/);
  assert.equal(bannedNamesMessage("An admin prank on an obby server"), null);
});

test("the user's own words are refused with a plain message when they name something real", () => {
  const base = { quality: "v2", aspect: "9:16", lengthSec: 30, castIds: ["noob", "vex"] };
  assert.throws(() => validateCreateStory({ ...base, source: "prompt", prompt: "Noob gets banned in Brookhaven for no reason." }, LIB), /Leave out "Brookhaven" \(a real game\)/);
  assert.throws(() => validateCreateStory({ ...base, source: "script", script: [{ speakerId: "noob", line: "Give me my Robux back." }, { speakerId: "vex", line: "No." }] }, LIB), /Leave out "Robux"/);
  assert.throws(() => validateSeriesPlan({ concept: "A Minecraft server war.", castIds: ["noob", "vex"], episodeCount: 5 }, LIB), /Leave out "Minecraft"/);
  assert.equal(validateCreateStory({ ...base, source: "prompt", prompt: "Noob gets banned on an obby server for no reason." }, LIB).source, "prompt");
});

test("the writer's own output is sent back when it names something real (title, location or line)", () => {
  const scene = (speakerId, line) => ({ speakerId, line, presentIds: ["noob", "vex"], locationId: "loc1", action: "points one block arm", emotion: "cold", shot: SPEAKING_SHOTS[0], placement: "", beat: "The fake ban" });
  const out = {
    title: "Banned in Brookhaven", roles: [], outfits: [], endState: { characters: [], props: [] },
    locations: [{ id: "loc1", description: "An admin room with a long console desk and a LEGO shelf", timeOfDay: "night", lighting: "cold blue light", seriesLocationId: "" }],
    scenes: [scene("vex", "Break this server rule and you're banned for good."), scene("noob", "I only wanted my Robux back, nothing else."), scene("vex", "Then you should have read the rules first.")],
  };
  const ctx = { source: "prompt", cast: cast("noob", "vex"), sceneCount: 3, quality: "v2", lengthSec: 15 };
  const blocky = validatePlan(out, ctx).errors;
  assert.ok(blocky.some((e) => /^title: don't name "Brookhaven" \(a real game\)/.test(e)));
  assert.ok(blocky.some((e) => /^location loc1: don't name "LEGO"/.test(e)));
  assert.ok(blocky.some((e) => /^scene 2: don't name "Robux"/.test(e)));
  const clean = { ...out, title: "Banned for Nothing", locations: [{ ...out.locations[0], description: "An admin room with a long console desk and a plain shelf" }], scenes: out.scenes.map((s) => ({ ...s, line: s.line.replace("Robux", "coins") })) };
  assert.ok(!validatePlan(clean, ctx).errors.some((e) => /don't name/.test(e)), "nothing real, nothing sent back");
});

/** A model answer for the picture check, all fine unless overridden. */
const answer = (over = {}) => ({
  characters: [{ name: "Vex", visible: true, isBlockyAvatar: true }, { name: "Noob", visible: true, isBlockyAvatar: true }],
  mainFigures: 2, backgroundFigures: 0, humanFigures: 0, brickToyLook: false, realisticFace: false, duplicates: [], readableText: "", logos: false,
  speakerHeadPercent: 34, speakerShownTo: "chest", notes: "", ...over,
});
const expected = [{ name: "Vex", look: "a white cube head and a tall black top hat" }, { name: "Noob", look: "a bright yellow cube head" }];

test("the picture check: what fails a Blocky picture, and what doesn't", () => {
  const [prompt, verdict, schema, system] = [checkPrompt, verdictOf, checkSchema, CHECK_SYSTEM];
  const v = (over, opts = { speaker: "Vex" }) => verdict(answer(over), expected, opts);
  assert.equal(v({}).ok, true, "two blocky avatars, chest-up, no text");
  assert.match(v({ brickToyLook: true }).problems[0], /brick-toy look/);
  assert.match(v({ brickToyLook: true }).fixes[0], /no studs, no studded baseplate, cube heads \(never round\), plain block hands \(never claws\)/);
  assert.match(v({ realisticFace: true }).problems[0], /realistic 3D mouth, teeth, lips, tongue or nose/);
  assert.match(v({ humanFigures: 1 }).problems[0], /1 human figure/);
  assert.match(v({ logos: true }).problems[0], /logo/);
  assert.match(v({ characters: [{ name: "Vex", visible: true, isBlockyAvatar: false }, { name: "Noob", visible: true, isBlockyAvatar: true }] }).problems[0], /Vex is not drawn as a blocky game avatar/);
  // Decision 15: a full-body two-avatar shot with small faces is redrawn once.
  assert.match(v({ speakerHeadPercent: 14, speakerShownTo: "feet" }).problems[0], /Vex is too small in the frame \(head about 14% of the height\)/);
  assert.match(v({ speakerHeadPercent: 30, speakerShownTo: "feet" }).problems[0], /shown full body/);
  assert.match(v({ speakerHeadPercent: 14, speakerShownTo: "feet" }).fixes[0], /tight chest-up shot of Vex, the cube head filling a third of the frame height/);
  // Decisions 21 and 36: a head under 18% of the frame height fails, whatever the crop says (a "close-up" cropped at the thighs).
  const thighs = v({ speakerHeadPercent: 15, speakerShownTo: "waist" });
  assert.equal(thighs.ok, false);
  assert.match(thighs.problems[0], /Vex is too small in the frame \(head about 15% of the height\)/);
  assert.equal(v({ speakerHeadPercent: 17, speakerShownTo: "chest" }).ok, false, "17% fails");
  assert.equal(v({ speakerHeadPercent: 18, speakerShownTo: "waist" }).ok, true, "the line is 18% (it was 22% until the first real story)");
  assert.equal(v({ speakerHeadPercent: 20, speakerShownTo: "chest" }).ok, true, "the two pictures of the first real story, measured at about 20%, pass now");
  assert.equal(verdict(answer({ speakerHeadPercent: 12, speakerShownTo: "feet" }), expected, { speaker: "Vex", framing: false }).ok, true, "a clip's last frame is not judged on framing");
  // The questions ask about flat teeth the way decision 11 puts it: flat is fine, 3D is not.
  const text = prompt(expected, { speaker: "Vex" });
  assert.match(text, /A flat printed mouth is fine, also with flat cartoon teeth; flat eyebrow lines are fine/);
  assert.match(text, /- Vex: a white cube head and a tall black top hat/);
  assert.match(text, /round studs on bricks or on the floor, a studded baseplate, a round or cylinder minifigure head/);
  assert.doesNotMatch(`${system} ${text}`, /fruit|Roblox/i);
  assert.deepEqual(schema().required.includes("readableText") && schema().required.includes("brickToyLook"), true);
});

test("decision 14: text, subtitles or captions on a clip's last frame fail the clip (one free remake)", async () => {
  const logged = [];
  const admin = { from: () => ({ insert: async (row) => { logged.push(row); return {}; } }) };
  const run = (data, purpose) => checkPicture({
    admin, apiKey: "k", imageUrl: "https://example.test/frame.jpg", expected, purpose, ids: {},
    fetchLlm: async (req) => { assert.match(req.system, /BLOCKY GAME AVATAR/); return { data, costUsd: 0.001, httpStatus: 200, usage: {} }; },
  });
  const subtitled = await run(answer({ readableText: "why is everyone?", characters: [{ name: "Vex", visible: true, isBlockyAvatar: true }] }), CLIP_FRAME_PURPOSE);
  assert.equal(subtitled.ok, false);
  assert.deepEqual(subtitled.problems, ['text on screen ("why is everyone?")']);
  assert.match(subtitled.fixes[0], /No text anywhere: no subtitles, captions, name tags, chat boxes, signs or numbers/);
  // A frame after the camera pushed in may have lost the listener, and is not judged on framing.
  const clean = await run(answer({ characters: [{ name: "Vex", visible: true, isBlockyAvatar: true }], speakerHeadPercent: 0, speakerShownTo: "unknown" }), CLIP_FRAME_PURPOSE);
  assert.equal(clean.ok, true);
  assert.equal(logged.length, 2, "every check is logged");
});

test("the upload pack: Part E's five texts, every cap enforced in code, real names refused", async () => {
  const [clean, system, schema] = [cleanPackage, PACKAGE_SYSTEM, packageSchema];
  assert.deepEqual(schema().required, ["title", "description", "tags", "pinnedComment", "caption", "hashtags"]);
  assert.match(system, /It reads as a HOOK first: one sentence or question a scroller wants answered, with the strongest words in the first 40 characters/);
  assert.match(system, /AT MOST 100 characters in total, hashtags included/);
  assert.match(system, /NEVER a hook followed by a list of keywords after a dash, a colon or a bar/);
  assert.match(system, /UNDER 500 characters/);
  assert.match(system, /comma-separated, most important first, AT MOST 500 characters/);
  assert.match(system, /splits viewers into two sides/);
  assert.match(system, /UNDER 150 characters/);
  const good = {
    title: "He Banned the Wrong Player and the Server Froze #robloxstory",
    description: "An admin prank goes wrong on an obby server when the new player turns out to be someone else. Was the ban fair? #robloxstory #adminprank #obby",
    tags: "roblox story, admin prank, obby, fake admin, server rules, blocky animation",
    pinnedComment: "Was Vex right to ban them, or was it abuse?",
    caption: "The admin picked the wrong player to ban.",
    hashtags: ["#RobloxStory", "adminprank", "#obby", "#obby"],
  };
  const ok = clean(good);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.pkg.hashtags, ["#robloxstory", "#adminprank", "#obby"]);
  assert.deepEqual(ok.pkg.counts, { title: good.title.length, description: good.description.length, tags: good.tags.length, caption: good.caption.length });
  assert.ok(ok.pkg.counts.title <= UPLOAD_LIMITS.title);
  // Over a cap: reported, never silently shipped.
  assert.match(clean({ ...good, title: "x".repeat(101) }).problems.join("; "), /title is 101 characters; the cap is 100/);
  assert.match(clean({ ...good, description: "y".repeat(500) }).problems.join("; "), /description is 500 characters; it must be under 500/);
  assert.match(clean({ ...good, caption: "z".repeat(150) }).problems.join("; "), /caption is 150 characters; it must be under 150/);
  assert.match(clean({ ...good, hashtags: ["#one", "#two"] }).problems.join("; "), /hashtags: 3 to 5 needed/);
  assert.match(clean({ ...good, pinnedComment: "Pick a side" }).problems.join("; "), /pinnedComment must be a question/);
  // Tags: whole tags only, in order, never past 500 characters.
  const many = clean({ ...good, tags: Array.from({ length: 80 }, (_, i) => `blocky story tag ${i}`).join(", ") });
  assert.ok(many.pkg.tags.length <= UPLOAD_LIMITS.tags && many.pkg.tags.startsWith("blocky story tag 0, blocky story tag 1"));
  assert.doesNotMatch(many.pkg.tags, /,\s*$|tag \d*,?\s*$^/);
  assert.ok(many.pkg.tags.split(", ").every((t) => /^blocky story tag \d+$/.test(t)), "no tag is cut in the middle");
  // The platform's name is allowed as a search keyword; a real game or creator is not.
  assert.match(clean({ ...good, tags: "roblox story, brookhaven roleplay" }).problems.join("; "), /names "Brookhaven": no real games, brands or creators/);
  assert.match(clean({ ...good, caption: "Better than MrBeast." }).problems.join("; "), /"MrBeast"/);

  // Through the engine: the system, schema and cleaning above; a bad answer is logged and refused.
  const logged = [];
  const admin = { from: () => ({ insert: async (row) => { logged.push(row); return {}; } }) };
  const input = { title: "The Admin Who Wasn't", lines: [{ speaker: "Vex", line: "Break this server rule and you're banned." }] };
  const pkg = await writeUploadPackage({ admin, apiKey: "k", input, ids: {}, fetchLlm: async (req) => { assert.equal(req.system, system); assert.deepEqual(req.schema, schema()); return { data: good, costUsd: 0.001, httpStatus: 200, usage: {} }; } });
  assert.equal(pkg.title, good.title);
  assert.equal(pkg.description, good.description);
  await assert.rejects(writeUploadPackage({ admin, apiKey: "k", input, ids: {}, fetchLlm: async () => ({ data: { ...good, title: "x".repeat(140) }, costUsd: 0.001, httpStatus: 200, usage: {} }) }), /title is 140 characters/);
  assert.equal(logged.filter((r) => r.ok === false).length, 2, "a bad answer gets one more try, told what was wrong; both are logged");
});

test("scene pictures and clips: every wording fits its limit, carries the body text, and never says toy, an age or a gender", () => {
  const LIBRARY = new Map(rows.map((c) => [c.id, c]));
  for (const [scene, story] of [[I.solo, I.story], [I.duo, I.story], [I.trio, I.story], [I.long, I.longStory]]) {
    const p = buildScenePrompt({ story, scene, library: LIBRARY });
    assert.ok(p.length <= PICTURE_PROMPT_MAX);
    assert.match(p, /blocky game avatar/);
    assert.doesNotMatch(p.replace(/no brick-toy minifigures/, ""), /toy/i, "decision 18: never 'toy'");
    assert.doesNotMatch(p.replace(/no studs, no studded baseplates/, "").replace(/no neck studs/, "").replace(/no studs, no minifigures/, ""), /\bstud(s|ded)?\b/i, "studs only as something to leave out");
    assert.doesNotMatch(p.split("Setting:")[0], PERSON_WORDS);
    for (const quality of ["v2", "v3", "v4"]) {
      const c = buildClipPrompt({ scene, library: LIBRARY, quality });
      assert.ok(c.length <= CLIP_PROMPT_MAX);
      assert.match(c, /the blocky game avatar facing the camera/);
      assert.match(c, /flat mouth decal/);
    }
  }
  // A two- and a three-avatar scene still carry the whole body-construction text (decision 19).
  for (const scene of [I.duo, I.trio]) assert.ok(buildScenePrompt({ story: I.story, scene, library: LIBRARY }).includes(BLOCKY_BODY));
  assert.ok(scenePromptLengths({ story: I.longStory, scene: I.long, library: LIBRARY })[2] <= PICTURE_PROMPT_MAX, "the shortest wording always fits");
});
