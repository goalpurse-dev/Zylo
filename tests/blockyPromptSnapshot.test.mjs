// Blocky Stories' exact prompts, pinned. Every text Blocky sends to a model
// (reference pictures, scene pictures, edits, clips on each tier, the writer,
// the series planner, the script editor, the picture check, the upload text,
// location plates) is built here for the fixed inputs in
// helpers/blockyPromptInputs.mjs and compared byte for byte with
// tests/fixtures/blockyPromptSnapshot.json.
//
// The snapshot was recorded on 2026-10-06 from the wording the look tests were
// paid for, BEFORE Blocky moved to its own engine (_shared/blocky/). This test
// is the proof that the move changed no prompt.
// If a Blocky prompt is changed ON PURPOSE, re-record and review the diff:
//   UPDATE_BLOCKY_SNAPSHOT=1 node --test tests/blockyPromptSnapshot.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as I from "./helpers/blockyPromptInputs.mjs";
import { ROSTER, avatarPrompt } from "../scripts/blocky/roster.mjs";
import { buildScenePrompt, buildPictureRequest, buildEditPrompt, scenePromptLengths, withRedrawHint } from "../supabase/functions/_shared/blocky/pictures.js";
import { buildClipPrompt, buildClipRequest, fallbackClipTask } from "../supabase/functions/_shared/blocky/clips.js";
import { buildPlannerPrompt } from "../supabase/functions/_shared/blocky/planner.js";
import { buildJudgePrompt, buildTwistPlanPrompt } from "../supabase/functions/_shared/blocky/twists.js";
import { buildSeriesPrompt } from "../supabase/functions/_shared/blocky/series.js";
import { buildReviewPrompt } from "../supabase/functions/_shared/blocky/scriptReview.js";
import { PACKAGE_SYSTEM, cleanPackage, packagePrompt, packageSchema } from "../supabase/functions/_shared/blocky/uploadPackage.js";
import { CHECK_SYSTEM, checkPrompt, checkSchema, verdictOf } from "../supabase/functions/_shared/blocky/pictureCheck.js";
import { platePrompt } from "../supabase/functions/_shared/blocky/plates.js";
import { planStep } from "../supabase/functions/_shared/blocky/steps.js";
import { bannedNamesMessage, bannedNamesProblem } from "../supabase/functions/_shared/blocky/safety.js";

const FILE = new URL("./fixtures/blockyPromptSnapshot.json", import.meta.url);

// Library rows as blocky_characters holds them: no age, no gender.
const row = (a) => ({ id: a.id, name: a.name, tag: a.tag, role: a.role, face: a.face, look: a.look, voice_style: a.voice, ref_image_url: `https://example.test/${a.id}.jpg` });
const LIB = new Map(ROSTER.map((a) => [a.id, row(a)]));
const cast = (ids) => ids.map((id) => LIB.get(id));

function build() {
  const s = {};
  for (const [name, scene, st] of [["solo", I.solo, I.story], ["duo", I.duo, I.story], ["trio+plate", I.trio, I.story], ["long (shortest wording)", I.long, I.longStory]]) s[`picture/${name}`] = buildScenePrompt({ story: st, scene, library: LIB });
  s["picture/trio+plate/16:9"] = buildScenePrompt({ story: { ...I.story, aspect: "16:9" }, scene: I.trio, library: LIB });
  s["picture/lengths"] = [I.solo, I.duo, I.trio].map((scene) => scenePromptLengths({ story: I.story, scene, library: LIB }));
  s["picture/long lengths"] = scenePromptLengths({ story: I.longStory, scene: I.long, library: LIB });
  s["picture/edit"] = buildEditPrompt("Make the crates blue.");
  s["picture/redraw hint"] = withRedrawHint(s["picture/duo"], ["Reframe much closer: a tight chest-up shot of Noob, the cube head filling a third of the frame height, cropped at the chest. No legs, no feet, no floor."]);
  for (const mode of ["new", "retry", "regenerate", "edit"]) {
    s[`picture request/${mode}`] = buildPictureRequest({ story: I.story, library: LIB, mode, instruction: "Make the crates blue.", prompt: "The user's own description of the scene.", scene: { ...I.trio, imageUrl: "https://example.test/current.jpg", imagePrompt: mode === "retry" ? "The stored prompt." : "" } });
  }
  for (const quality of ["v2", "v3", "v4"]) {
    for (const [name, scene] of [["solo", I.solo], ["duo", I.duo], ["trio", I.trio]]) s[`clip/${quality}/${name}`] = buildClipPrompt({ scene, library: LIB, quality });
    s[`clip request/${quality}`] = buildClipRequest({ story: { ...I.story, quality }, scene: { ...I.duo, line: "No way.", imageUrl: "https://example.test/scene.jpg" }, library: LIB });
  }
  s["clip request/v2 fallback"] = fallbackClipTask(s["clip request/v2"].request);
  const scenes = [{ ...I.duo, imageUrl: "https://example.test/scene.jpg", imageStatus: "ready", clipStatus: "none" }];
  const staging = new Map(scenes.map((x) => [x.id, { locationId: x.locationId, action: x.action, emotion: x.emotion, shot: x.shot, placement: x.placement }]));
  const builders = { picture: buildPictureRequest, clip: buildClipRequest };
  s["price keys"] = {
    picture: planStep("pictures", { story: { ...I.story, status: "draft" }, scenes: scenes.map((x) => ({ ...x, imageUrl: null, imageStatus: "none" })), library: LIB, builders, staging }).items.map((i) => i.tool_key),
    ...Object.fromEntries(["v2", "v3", "v4"].map((q) => [q, planStep("animate", { story: { ...I.story, quality: q, status: "pictures_ready" }, scenes, library: LIB, builders, staging }).items.map((i) => i.tool_key)])),
  };
  for (const [name, w] of Object.entries(I.writerInputs)) {
    const { castIds, ...rest } = w;
    // A single story is written from its twist plan (twists.js); a script and an episode have none.
    const planned = name === "idea" || name === "prompt";
    const p = buildPlannerPrompt({ ...rest, cast: cast(castIds), ...(planned ? { twistPlan: I.twistPlan } : {}) });
    if (name === "idea") s["writer/system"] = p.system;
    s[`writer/${name}`] = p.user;
    if (planned) {
      const t = buildTwistPlanPrompt({ ...rest, cast: cast(castIds), sceneCount: p.sceneCount, ...(name === "prompt" ? { avoidPatterns: ["backfire"], avoidOpeners: ["He always comes home full."] } : {}) });
      if (name === "idea") {
        const j = buildJudgePrompt({ ...rest, cast: cast(castIds), sceneCount: p.sceneCount, plans: [I.twistPlan, { ...I.twistPlan, patternId: "backfire", finalLine: "Thanks for the hat." }, { ...I.twistPlan, patternId: "test" }] });
        s["plan judge/system"] = j.system;
        s["plan judge/prompt"] = j.user;
      }
      if (name === "idea") s["twist plan/system"] = t.system;
      s[`twist plan/${name}`] = t.user;
    }
  }
  { const { castIds, ...rest } = I.seriesInput; const p = buildSeriesPrompt({ ...rest, cast: cast(castIds) }); s["series/system"] = p.system; s["series/prompt"] = p.user; }
  {
    const a = buildReviewPrompt({ plan: I.reviewPlan, cast: cast(["vex", "noob", "taz"]), source: "idea" });
    s["editor/system"] = a.system;
    s["editor/single"] = a.user;
    s["editor/episode"] = buildReviewPrompt({ plan: I.reviewPlan, cast: cast(["vex", "noob"]), source: "episode", series: { episode: { number: 2, cliffhanger: "Vex says it never banned anyone." } } }).user;
  }
  s["check/system"] = CHECK_SYSTEM;
  s["check/picture"] = checkPrompt(I.checkExpected, { speaker: "Vex" });
  s["check/clip frame"] = checkPrompt(I.checkExpected);
  s["check/schema"] = checkSchema();
  // A clip check with the second picture (two frames from the middle of the line): one more question, one more field.
  s["check/clip frame + speech frames"] = checkPrompt(I.checkExpected, { speech: true });
  s["check/schema + speech frames"] = checkSchema({ speech: true });
  s["check/verdict"] = verdictOf(I.checkAnswer, I.checkExpected, { speaker: "Vex" });
  s["upload/system"] = PACKAGE_SYSTEM;
  s["upload/schema"] = packageSchema();
  s["upload/prompt"] = packagePrompt(I.uploadInput);
  s["upload/clean"] = cleanPackage(I.uploadAnswer);
  s["plate/9:16"] = platePrompt(I.locations[0].description, "9:16");
  s["plate/16:9"] = platePrompt(I.locations[1].description, "16:9");
  s["safety/user"] = bannedNamesMessage(I.unsafeTexts.user);
  s["safety/writer"] = bannedNamesProblem(I.unsafeTexts.writer, "scene 2");
  for (const a of ROSTER) s[`reference/${a.id}`] = avatarPrompt(a);
  s["reference/vex (body template)"] = avatarPrompt(ROSTER.find((a) => a.id === "vex"), { template: true });
  s["reference/vex (minifigure parts not named)"] = avatarPrompt(ROSTER.find((a) => a.id === "vex"), { minifigure: false });
  return JSON.parse(JSON.stringify(s));
}

const now = build();
if (process.env.UPDATE_BLOCKY_SNAPSHOT === "1") fs.writeFileSync(FILE, `${JSON.stringify(now, null, 1)}\n`);
const recorded = JSON.parse(fs.readFileSync(FILE, "utf8"));

test("the snapshot covers every Blocky prompt, and nothing is built that isn't recorded", () => {
  assert.deepEqual(Object.keys(now).sort(), Object.keys(recorded).sort());
  assert.equal(Object.keys(recorded).length, 83);
});

for (const key of Object.keys(recorded)) {
  test(`byte-identical: ${key}`, () => assert.deepEqual(now[key], recorded[key]));
}
