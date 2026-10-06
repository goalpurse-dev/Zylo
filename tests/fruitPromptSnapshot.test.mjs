// AI Fruit Story's exact prompts, pinned. Every text Fruit sends to a model
// (scene pictures, edits, clips on each tier, the writer, the series planner,
// the script editor, the picture check, the upload text, location plates) is
// built here for fixed inputs and compared byte for byte with
// tests/fixtures/fruitPromptSnapshot.json.
//
// Why: the engine now serves more than one template (niches/). Whatever is
// done for another template, Fruit's prompts must not move by a character.
// If a Fruit prompt is changed ON PURPOSE, re-record and review the diff:
//   UPDATE_FRUIT_SNAPSHOT=1 node --test tests/fruitPromptSnapshot.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LIBRARY } from "../src/components/viral-tools/ai-fruit-story-v2/api/mock/libraryData.js";
import { buildScenePrompt, buildPictureRequest, buildEditPrompt, scenePromptLengths, withRedrawHint } from "../supabase/functions/_shared/fruit/pictures.js";
import { buildClipPrompt, buildClipRequest, fallbackClipTask } from "../supabase/functions/_shared/fruit/clips.js";
import { SYSTEM, buildPlannerPrompt, plannerSchema } from "../supabase/functions/_shared/fruit/planner.js";
import { SERIES_SYSTEM, buildSeriesPrompt } from "../supabase/functions/_shared/fruit/series.js";
import { REVIEW_SYSTEM, buildReviewPrompt } from "../supabase/functions/_shared/fruit/scriptReview.js";
import { PACKAGE_SYSTEM, packagePrompt } from "../supabase/functions/_shared/fruit/uploadPackage.js";
import { CHECK_SYSTEM, checkPrompt, verdictOf } from "../supabase/functions/_shared/fruit/pictureCheck.js";
import { platePrompt } from "../supabase/functions/_shared/fruit/plates.js";
import { lookAlikeMessage } from "../supabase/functions/_shared/fruit/castRules.js";
import { planStep } from "../supabase/functions/_shared/fruit/steps.js";

const FILE = new URL("./fixtures/fruitPromptSnapshot.json", import.meta.url);

// Library rows as the database holds them: the tracked mock library plus the
// columns the mock leaves out (outfit, age). Fixed here so the test needs nothing untracked.
const EXTRA = {
  mia: { outfit: "an emerald silk blouse, gold hoop earrings and cream trousers", age: 34 },
  marco: { outfit: "a navy tailored suit, a white open-collar shirt and a gold watch", age: 37 },
  pia: { outfit: "a hot-pink wrap dress, pearl earrings and a white clutch", age: 29 },
  rick: { outfit: "a grey office shirt with rolled sleeves and a loosened burgundy tie", age: 41 },
  lemz: { outfit: "a black puffer jacket over a grey tracksuit and white trainers", age: 22 },
};
const rows = LIBRARY.filter((c) => EXTRA[c.id]).map((c) => ({ ...c, ...EXTRA[c.id], voice_style: c.voiceStyle, ref_image_url: c.refImageUrl }));
const LIB = new Map(rows.map((c) => [c.id, c]));
const cast = (...ids) => ids.map((id) => LIB.get(id));

const locations = [
  { id: "loc1", description: "Elegant dining room with a candlelit table set for two, wine glasses gleaming, roses in a vase", timeOfDay: "evening", lighting: "warm candlelight and a soft lamp glow" },
  { id: "loc2", description: "Glass-walled corner office with a long desk, two monitors and a city view", timeOfDay: "late afternoon", lighting: "low sun through the tall windows", plateUrl: "https://example.test/plate-s1-9x16.jpg" },
];
const story = { id: "st1", aspect: "9:16", quality: "v2", locations, outfits: {} };
const solo = { id: "s1", speakerId: "mia", presentIds: ["mia"], locationId: "loc1", action: "holds up a folded receipt", emotion: "icy calm", shot: "close-up", line: "Table for two, Marco? You told me you were working late." };
const duo = { id: "s2", speakerId: "marco", presentIds: ["marco", "mia"], locationId: "loc1", action: "Marco loosens his collar", emotion: "panicked", shot: "medium close-up", placement: "Marco sits at the table; Mia stands behind his chair.", line: "It's a client dinner, I swear on my mother." };
const trio = { id: "s3", speakerId: "pia", presentIds: ["pia", "marco", "rick"], locationId: "loc2", action: "taps the glass with one nail", emotion: "smug", shot: "chest-up", placement: "Pia stands outside the glass wall looking in; Marco and Rick are inside the office.", line: "Funny, he told me the same thing about you." };
const long = {
  ...trio, id: "s4",
  placement: "Pia stands outside the glass wall looking in with her hand flat on the pane and her phone raised to film; Marco and Rick are inside the office behind the long desk, one by each monitor, both half turned to the door.",
  action: "raises her phone high above her head to film the two of them through the glass wall while smiling",
};
// Over the limit at the full wording, under it once the outfits are left out: the middle wording.
const mid = { ...trio, id: "s5", placement: `${long.placement} The door behind them is open and a cleaning trolley is parked in the corridor outside.` };
const longStory = {
  ...story,
  locations: [{ ...locations[1], description: "Glass-walled corner office on the fortieth floor with a long walnut desk, two curved monitors, a leather chair, a brass lamp, framed awards, a drinks trolley, a tall fern, stacked folders, a model yacht, a whiteboard, a coat stand, a low sofa, a rug, blinds half drawn and a wide view of the city skyline at dusk beyond the glass, plus a second glass meeting room behind it with eight chairs" }],
  outfits: { pia: "a long black evening gown with silver sequins", marco: "an orange prison jumpsuit and black boots", rick: "a white chef jacket and a tall chef hat" },
};

function snapshot() {
  const s = {};
  // Scene pictures.
  s["picture/solo"] = buildScenePrompt({ story, scene: solo, library: LIB });
  s["picture/duo"] = buildScenePrompt({ story, scene: duo, library: LIB });
  s["picture/trio+plate"] = buildScenePrompt({ story, scene: trio, library: LIB });
  s["picture/trio+plate/16:9"] = buildScenePrompt({ story: { ...story, aspect: "16:9" }, scene: trio, library: LIB });
  s["picture/outfits"] = buildScenePrompt({ story: { ...story, outfits: { marco: "an orange prison jumpsuit and black boots" } }, scene: duo, library: LIB });
  s["picture/long (shorter wording)"] = buildScenePrompt({ story: longStory, scene: long, library: LIB });
  s["picture/mid (middle wording)"] = buildScenePrompt({ story, scene: mid, library: LIB });
  s["picture/mid lengths"] = scenePromptLengths({ story, scene: mid, library: LIB });
  s["picture/lengths"] = [solo, duo, trio].map((scene) => scenePromptLengths({ story, scene, library: LIB }));
  s["picture/long lengths"] = scenePromptLengths({ story: longStory, scene: long, library: LIB });
  s["picture/edit"] = buildEditPrompt("Make the roses white.");
  s["picture/redraw hint"] = withRedrawHint(s["picture/duo"], ["Mia Mango's head is a whole mango, not a human head.", "No hair on anyone: fruit heads are bare fruit, with only their own leaves or stem."]);
  for (const mode of ["new", "retry", "regenerate", "edit"]) {
    s[`picture request/${mode}`] = buildPictureRequest({
      story, library: LIB, mode, instruction: "Make the roses white.", prompt: "The user's own description of the scene.",
      scene: { ...trio, imageUrl: "https://example.test/current.jpg", imagePrompt: mode === "retry" ? "The stored prompt." : "" },
    });
  }
  // Clips, one per tier and per number of listeners.
  for (const quality of ["v2", "v3", "v4"]) {
    for (const [name, scene] of [["solo", solo], ["duo", duo], ["trio", trio]]) s[`clip/${quality}/${name}`] = buildClipPrompt({ scene, library: LIB, quality });
    s[`clip request/${quality}`] = buildClipRequest({ story: { ...story, quality }, scene: { ...duo, line: "No way.", imageUrl: "https://example.test/scene.jpg" }, library: LIB });
  }
  s["clip request/v2 fallback"] = fallbackClipTask(s["clip request/v2"].request);
  // What a step charges under: the price keys.
  const scenes = [{ ...duo, imageUrl: "https://example.test/scene.jpg", imageStatus: "ready", clipStatus: "none" }];
  const staging = new Map(scenes.map((x) => [x.id, { locationId: x.locationId, action: x.action, emotion: x.emotion, shot: x.shot, placement: x.placement }]));
  const builders = { picture: buildPictureRequest, clip: buildClipRequest };
  s["price keys"] = {
    picture: planStep("pictures", { story: { ...story, status: "draft" }, scenes: scenes.map((x) => ({ ...x, imageUrl: null, imageStatus: "none" })), library: LIB, builders, staging }).items.map((i) => i.tool_key),
    ...Object.fromEntries(["v2", "v3", "v4"].map((q) => [q, planStep("animate", { story: { ...story, quality: q, status: "pictures_ready" }, scenes, library: LIB, builders, staging }).items.map((i) => i.tool_key)])),
  };
  // The writer.
  s["writer/system"] = SYSTEM;
  s["writer/idea"] = buildPlannerPrompt({ source: "idea", cast: cast("mia", "marco", "pia"), lengthSec: 30, quality: "v2", idea: { title: "Table for Two", summary: "Mia finds a dinner receipt for two. Marco says it was a client. Pia walks in wearing his jacket." } }).user;
  s["writer/prompt"] = buildPlannerPrompt({ source: "prompt", cast: cast("rick", "lemz"), lengthSec: 20, quality: "v4", prompt: "Rick catches the new intern selling the office printer online." }).user;
  s["writer/script"] = buildPlannerPrompt({ source: "script", cast: cast("mia", "marco"), lengthSec: 15, quality: "v2", script: [{ speakerId: "mia", line: "Who is she, Marco?" }, { speakerId: "marco", line: "She's the caterer. For your surprise party." }] }).user;
  s["writer/episode"] = buildPlannerPrompt({
    source: "episode", cast: cast("mia", "marco", "pia"), lengthSec: 30, quality: "v3",
    series: {
      title: "The Second Phone", logline: "A wife finds her husband's second phone and decides to answer it.", bible: "Mia is the wife who knows. Marco is the husband with two phones. Pia is the name on the second one.",
      previous: [{ number: 1, title: "It Rings", summary: "Mia finds a phone taped under the sink.", cliffhanger: "The phone lights up: Pia calling." }],
      episode: { number: 2, title: "She Answers", summary: "Mia answers as Marco's assistant and books a dinner.", cliffhanger: "Pia says she'll bring the ring back." },
      locations: [{ id: "s1", description: "A bright kitchen with a marble island, a fruit bowl and a window over the sink" }],
      characters: [{ id: "mia", role: "the wife who knows", prop: "the second phone", catchphrase: "Interesting." }],
      setups: { plant: ["a ring box in Marco's jacket"], payOff: ["the tape under the sink"] },
      lastEnd: { characters: [{ id: "mia", where: "at the kitchen sink", feeling: "ice cold" }], props: ["the second phone"] },
    },
  }).user;
  s["writer/schema"] = plannerSchema(["mia", "marco"]);
  // The series planner.
  s["series/system"] = SERIES_SYSTEM;
  s["series/prompt"] = buildSeriesPrompt({ concept: "A wife finds her husband's second phone.", cast: cast("mia", "marco", "lemz"), opener: "Caught at a fancy dinner", tone: "petty and funny", episodeCount: 4 }).user;
  // The script editor.
  const plan = {
    title: "Table for Two", roles: { mia: "the wife who knows" }, outfits: { marco: "an orange prison jumpsuit and black boots" }, locations,
    scenes: [{ speakerId: "mia", presentIds: ["mia", "marco"], locationId: "loc1", line: solo.line }, { speakerId: "marco", presentIds: ["marco", "mia"], locationId: "loc1", line: duo.line }],
  };
  s["editor/system"] = REVIEW_SYSTEM;
  s["editor/single"] = buildReviewPrompt({ plan, cast: cast("mia", "marco", "pia"), source: "idea" }).user;
  s["editor/episode"] = buildReviewPrompt({ plan, cast: cast("mia", "marco"), source: "episode", series: { episode: { number: 2, cliffhanger: "Pia says she'll bring the ring back." } } }).user;
  // The picture check.
  const expected = [{ name: "Mia Mango", fruit: "mango" }, { name: "Rick Apple", fruit: "apple" }];
  s["check/system"] = CHECK_SYSTEM;
  s["check/picture"] = checkPrompt(expected, { speaker: "Mia Mango" });
  s["check/clip frame"] = checkPrompt(expected);
  s["check/verdict"] = verdictOf({
    characters: [{ name: "Mia Mango", visible: true, hasFruitHead: false }], mainFigures: 3, backgroundFigures: 0, humanHeads: 1, humanHair: true,
    duplicates: ["Mia Mango"], readableText: "CAFE", speakerHeadPercent: 14, speakerShownTo: "feet", notes: "",
  }, expected, { speaker: "Mia Mango" });
  // Upload text, plates, cast rule.
  s["upload/system"] = PACKAGE_SYSTEM;
  s["upload/prompt"] = packagePrompt({ title: "Table for Two", lines: [{ speaker: "Mia Mango", line: solo.line }], roles: { "Mia Mango": "the wife who knows" }, episode: { number: 2, seriesTitle: "The Second Phone", nextNumber: 3, nextTitle: "The Ring" } });
  s["plate/9:16"] = platePrompt(locations[0].description, "9:16");
  s["plate/16:9"] = platePrompt(locations[1].description, "16:9");
  s["cast/look-alike"] = lookAlikeMessage(cast("mia", "marco").map((c) => ({ ...c, tag: "Rival" })));
  return JSON.parse(JSON.stringify(s));
}

test("Fruit's prompts are exactly the recorded ones", () => {
  const now = snapshot();
  if (process.env.UPDATE_FRUIT_SNAPSHOT === "1") {
    fs.mkdirSync(new URL("./fixtures/", import.meta.url), { recursive: true });
    fs.writeFileSync(FILE, `${JSON.stringify(now, null, 1)}\n`);
    return;
  }
  const recorded = JSON.parse(fs.readFileSync(FILE, "utf8"));
  assert.deepEqual(Object.keys(now).sort(), Object.keys(recorded).sort(), "the same set of prompts");
  for (const key of Object.keys(recorded)) assert.deepEqual(now[key], recorded[key], `${key} changed`);
});

test("the snapshot covers every wording tier and every tier's camera", () => {
  const recorded = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const lengths = recorded["picture/long lengths"];
  assert.ok(lengths[0] > 2500, "the long scene is over the limit at the full wording, so a shorter tier is recorded");
  assert.ok(recorded["picture/long (shorter wording)"].length <= 2500);
  const midLengths = recorded["picture/mid lengths"];
  assert.ok(midLengths[0] > 2500 && midLengths[1] <= 2500, "the mid scene is recorded at the middle wording");
  assert.equal(recorded["picture/mid (middle wording)"].length, midLengths[1]);
  assert.equal(recorded["picture/long (shorter wording)"].length, lengths[2], "the long scene is recorded at the shortest wording");
  assert.match(recorded["clip/v3/solo"], /almost still, locked off/);
  assert.match(recorded["clip/v2/solo"], /push-in/);
  assert.match(recorded["picture/trio+plate"], /Image 4 is the empty set of this place/);
});
