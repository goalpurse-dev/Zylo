// Blocky Stories: shot variety (shots.js). Stories mix wide, chest-up, close-up, reaction and
// over-the-shoulder shots; the mix is made sure of in code; the picture and the clip are built for the scene's
// own shot; and the picture check judges each scene against its own shot. No model is called here.
import test from "node:test";
import assert from "node:assert/strict";
import { SHOTS, SPEAKING_SHOTS, directShots, inFrameIds, shotOf, shotSpec } from "../supabase/functions/_shared/blocky/shots.js";
import { buildScenePrompt, frameCharacters } from "../supabase/functions/_shared/blocky/pictures.js";
import { buildClipPrompt } from "../supabase/functions/_shared/blocky/clips.js";
import { checkPrompt, checkSchema, verdictOf } from "../supabase/functions/_shared/blocky/pictureCheck.js";
import { SYSTEM } from "../supabase/functions/_shared/blocky/planner.js";
import { ROSTER } from "../scripts/blocky/roster.mjs";
import * as I from "./helpers/blockyPromptInputs.mjs";

const LIB = new Map(ROSTER.map((a) => [a.id, { id: a.id, name: a.name, tag: a.tag, role: a.role, face: a.face, look: a.look, voice_style: a.voice, ref_image_url: `https://example.test/${a.id}.jpg` }]));
const scene = (shot, presentIds = ["noob", "vex"]) => ({ speakerId: presentIds[0], presentIds, shot });
const shotsOf = (list) => directShots(list).map((s) => s.shot);

test("the shots: wide, chest-up, close-up, over-the-shoulder, reaction and medium close-up, each with a picture, a framing, a camera and a check", () => {
  assert.deepEqual([...SPEAKING_SHOTS].sort(), ["chest-up", "close-up", "medium close-up", "over-the-shoulder", "reaction", "wide"]);
  for (const shot of SPEAKING_SHOTS) {
    const s = SHOTS[shot];
    for (const key of ["picture", "framing", "framingShort", "camera"]) assert.ok(typeof s[key] === "string" && s[key].length > 10, `${shot}.${key}`);
    // Faces readable, hats and accessories in frame: said in every shot's framing.
    assert.match(s.framing, /face decal sharp/, shot);
    assert.match(s.framing, /The whole head, with its hat or accessory, is inside the frame\./, shot);
    assert.match(s.framingShort, /whole head in frame/, shot);
    assert.ok(s.check.minHead >= 10 && typeof s.check.fix("Vex") === "string");
  }
  assert.equal(shotOf("medium two-shot"), "chest-up", "an older row's shot is drawn chest-up");
  assert.equal(shotSpec(undefined), SHOTS["chest-up"]);
  assert.match(SYSTEM, /Scene 1 is the wide shot/);
  assert.match(SYSTEM, /Never the same shot three scenes in a row; at least three different shots in a story/);
});

test("the mix is made sure of in code: scene 1 wide, no shot three times in a row, three different shots in a story", () => {
  // Six scenes that all came back chest-up (what every story was until now).
  const flat = shotsOf(Array.from({ length: 6 }, () => scene("chest-up")));
  assert.equal(flat[0], "wide");
  assert.ok(new Set(flat).size >= 3, flat.join(", "));
  for (let i = 2; i < flat.length; i++) assert.ok(!(flat[i] === flat[i - 1] && flat[i] === flat[i - 2]), `three in a row at ${i}: ${flat.join(", ")}`);
  assert.equal(flat.filter((s) => s === "wide").length, 1, "one wide shot: every other line is spoken with a large face");
  // A writer's own good mix is left alone (but for scene 1).
  assert.deepEqual(shotsOf([scene("chest-up"), scene("over-the-shoulder"), scene("close-up"), scene("reaction"), scene("chest-up"), scene("close-up")]), ["wide", "over-the-shoulder", "close-up", "reaction", "chest-up", "close-up"]);
  // A second wide shot becomes chest-up; an over-the-shoulder shot with nobody to look past becomes a close-up.
  assert.deepEqual(shotsOf([scene("wide"), scene("wide"), scene("over-the-shoulder", ["noob"]), scene("reaction")]), ["wide", "chest-up", "close-up", "reaction"]);
  // A story with one character alone never gets an over-the-shoulder shot.
  const solo = shotsOf(Array.from({ length: 6 }, () => scene("chest-up", ["noob"])));
  assert.ok(!solo.includes("over-the-shoulder") && new Set(solo).size >= 3, solo.join(", "));
  // Short stories: two different shots are enough; an unknown shot is chest-up.
  assert.deepEqual(shotsOf([scene("close-up"), scene("close-up"), scene("nonsense")]), ["wide", "close-up", "chest-up"]);
  assert.deepEqual(shotsOf([]), []);
  // Nothing else of a scene is touched.
  assert.deepEqual(directShots([{ ...scene("close-up"), line: "Hi." }])[0], { speakerId: "noob", presentIds: ["noob", "vex"], shot: "wide", line: "Hi." });
});

test("who is in the frame: everyone present, but the speaker alone in a reaction shot", () => {
  assert.deepEqual(inFrameIds(scene("chest-up", ["vex", "noob", "lux"])), ["vex", "noob", "lux"]);
  assert.deepEqual(inFrameIds({ speakerId: "noob", presentIds: ["vex", "noob"], shot: "wide" }), ["noob", "vex"], "speaker first");
  assert.deepEqual(inFrameIds(scene("reaction", ["vex", "noob"])), ["vex"]);
  assert.deepEqual(inFrameIds({ speaker_id: "vex", present_ids: ["vex", "noob"], shot: "reaction" }), ["vex"], "a database row too");
  assert.deepEqual(frameCharacters({ ...I.duo, shot: "reaction" }, LIB).map((c) => c.id), [I.duo.speakerId]);
});

test("the picture and the clip are built for the scene's own shot", () => {
  const picture = (shot) => buildScenePrompt({ story: I.story, scene: { ...I.duo, shot }, library: LIB });
  const [speaker, listener] = [LIB.get(I.duo.speakerId).name, LIB.get(I.duo.presentIds.find((id) => id !== I.duo.speakerId)).name];
  assert.match(picture("wide"), new RegExp(`Wide establishing shot of the whole place, with ${speaker} standing in front, seen from head to feet`));
  assert.match(picture("wide"), /Framing: full body\. Every character stands whole inside the frame/);
  assert.match(picture("wide"), new RegExp(`${listener} stands a step behind and to the side, whole in the frame`));
  assert.match(picture("over-the-shoulder"), new RegExp(`the camera looks past ${listener}, seen from behind at the near edge of the frame, at ${speaker}`));
  assert.match(picture("over-the-shoulder"), new RegExp(`${listener} stands at the near edge of the frame with its back to the camera, so only the back of its cube head and one block shoulder are seen`));
  assert.match(picture("reaction"), new RegExp(`Reaction shot: ${speaker} alone, head and shoulders`));
  assert.match(picture("reaction"), /Only these 1 character in the frame\./);
  assert.ok(!picture("reaction").includes(`Image 2 is ${listener}`), "the listener's reference picture is not sent for a reaction shot");
  assert.match(picture("close-up"), /Close-up on the speaker's face and shoulders/);
  assert.match(picture("chest-up"), /Chest-up shot on the speaker in the foreground, never full body/);
  for (const shot of SPEAKING_SHOTS) {
    assert.match(picture(shot), /The whole head, with its hat or accessory, is inside the frame\./, shot);
    assert.match(picture(shot), /blocky game avatar/, shot);
  }
  // The clip: the listener stays out of a reaction clip; a model that follows the shot gets the shot's own camera.
  assert.ok(!buildClipPrompt({ scene: { ...I.duo, shot: "reaction" }, library: LIB, quality: "v2" }).includes(`${listener} (`));
  assert.ok(buildClipPrompt({ scene: { ...I.duo, shot: "chest-up" }, library: LIB, quality: "v2" }).includes(`${listener} (`));
  for (const shot of SPEAKING_SHOTS) assert.ok(buildClipPrompt({ scene: { ...I.duo, shot }, library: LIB, quality: "v4" }).includes(`Camera: ${SHOTS[shot].camera}.`), shot);
});

test("the picture check judges a scene against its own shot", () => {
  const expected = [{ name: "Vex" }, { name: "Noob" }];
  const seen = (over) => ({ characters: [{ name: "Vex", visible: true, isBlockyAvatar: true }, { name: "Noob", visible: true, isBlockyAvatar: true }], mainFigures: 2, backgroundFigures: 0, humanFigures: 0, brickToyLook: false, realisticFace: false, duplicates: [], readableText: "", logos: false, speakerHeadPercent: 30, speakerShownTo: "chest", speakerHeadCut: false, notes: "", ...over });
  const judge = (shot, over) => verdictOf(seen(over), expected, { speaker: "Vex", shot });
  // A full-body picture: right for a wide shot, wrong for every other shot.
  const fullBody = { speakerHeadPercent: 15, speakerShownTo: "feet" };
  assert.equal(judge("wide", fullBody).ok, true);
  for (const shot of SPEAKING_SHOTS.filter((s) => s !== "wide")) {
    const v = judge(shot, fullBody);
    assert.equal(v.ok, false, shot);
    assert.ok(v.fixes.includes(SHOTS[shot].check.fix("Vex")), `${shot}: the redraw is told its own shot`);
  }
  assert.match(judge("chest-up", fullBody).problems[0], /Vex is too small in the frame \(head about 15% of the height\)/);
  assert.match(judge("close-up", { speakerHeadPercent: 30, speakerShownTo: "feet" }).problems[0], /shown full body \(down to the feet\), not as a close-up shot/);
  // A chest-up picture: right for chest-up, not a wide shot.
  assert.equal(judge("chest-up", {}).ok, true);
  assert.deepEqual(judge("wide", {}).problems, ["Vex is cropped at the chest, not shown full body as a wide shot"]);
  assert.match(judge("wide", { speakerHeadPercent: 6, speakerShownTo: "feet" }).problems[0], /too small in the frame even for a wide shot/);
  // Each shot has its own smallest face.
  assert.equal(judge("chest-up", { speakerHeadPercent: 18 }).ok, true);
  assert.equal(judge("close-up", { speakerHeadPercent: 18 }).ok, true);
  assert.equal(judge("close-up", { speakerHeadPercent: 15 }).ok, false);
  assert.equal(judge("reaction", { speakerHeadPercent: 17 }).ok, false);
  assert.equal(judge("wide", { speakerHeadPercent: 12, speakerShownTo: "feet" }).ok, true);
  assert.equal(judge("over-the-shoulder", { speakerHeadPercent: 17 }).ok, true);
  // A head, hat or accessory cut off by the frame fails in every shot.
  for (const shot of SPEAKING_SHOTS) {
    const v = judge(shot, { ...(shot === "wide" ? fullBody : {}), speakerHeadCut: true });
    assert.deepEqual([v.ok, v.problems.at(-1)], [false, "the top of Vex's head, or what is on it, is cut off by the frame"], shot);
    assert.match(v.fixes.at(-1), /the whole head with its hat, hair or accessory is inside the frame/);
  }
  // No shot given (an older caller): judged as chest-up, as before. A clip's last frame is not judged on framing.
  assert.equal(verdictOf(seen(fullBody), expected, { speaker: "Vex" }).ok, false);
  assert.equal(verdictOf(seen({ ...fullBody, speakerHeadCut: true }), expected, { speaker: "Vex", framing: false }).ok, true);
  // The check is asked about the head, and told that an over-the-shoulder listener is seen from behind.
  assert.ok(checkSchema().required.includes("speakerHeadCut"));
  assert.match(checkPrompt(expected, { speaker: "Vex", shot: "chest-up" }), /speakerHeadCut: true if the top of Vex's head, or a hat, hair or accessory on it, is cut off/);
  assert.match(checkPrompt(expected, { speaker: "Vex", shot: "over-the-shoulder" }), /Noob is meant to be seen from BEHIND at the near edge/);
  assert.doesNotMatch(checkPrompt(expected, { speaker: "Vex", shot: "chest-up" }), /seen from BEHIND/);
});
