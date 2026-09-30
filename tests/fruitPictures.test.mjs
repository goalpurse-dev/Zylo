// AI Fruit Story v2 scene pictures (stage 3d): prompt builder, offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildScenePrompt, buildPictureRequest, buildEditPrompt, PICTURE_PROMPT_MAX, frameCharacters } from "../supabase/functions/_shared/fruit/pictures.js";
import { planStep } from "../supabase/functions/_shared/fruit/steps.js";
import { SERVER_LIMITS } from "../supabase/functions/_shared/fruit/limits.js";

const LIB_ROWS = JSON.parse(fs.readFileSync(new URL("../data/fruit-characters/library.json", import.meta.url), "utf8"))
  .map((c) => ({ ...c, ref_image_url: c.refImageUrl }));
const LIB = new Map(LIB_ROWS.map((c) => [c.id, c]));
const story = { aspect: "9:16", quality: "v2", locations: [{ id: "loc1", description: "Elegant dining room with a candlelit table set for two, wine glasses gleaming, roses in a vase", timeOfDay: "evening", lighting: "warm candlelight and a soft lamp glow" }] };
const scene = { id: "s1", speakerId: "mia", presentIds: ["mia", "marco"], locationId: "loc1", action: "slides a phone with photos face-up across the table", emotion: "icy calm", shot: "close-up", imageUrl: null, imagePrompt: "" };

test("scene content comes first, then who each reference image is, then setting, style and no-text", () => {
  const p = buildScenePrompt({ story, scene, library: LIB });
  assert.match(p, /^Vertical 9:16 frame\. Close-up/);
  const order = ["Mia Mango (the mango woman) slides a phone", "Marco Mango (the mango man) listens", "Setting: Elegant dining room", "Image 1 is Mia Mango", "Image 2 is Marco Mango", "Style:", "No text"];
  let at = -1;
  for (const s of order) { const i = p.indexOf(s); assert.ok(i > at, `"${s}" in order`); at = i; }
  assert.match(p, /mouth open mid-sentence/);
  assert.match(p, /Only these 2 characters/);
  assert.match(p, /Framing: chest up or closer on the speaker, never a full-body shot; their head is a quarter to a third of the frame height, eyes and mouth sharp and clearly visible\./);
  assert.match(p, /Staging: Mia Mango stands closest to the camera, body and face turned toward the camera \(at most a slight three-quarter turn\), large in the frame\. Marco Mango is further back beside or behind Mia Mango, smaller/);
  assert.match(p, /speaking toward the camera\./);
  assert.doesNotMatch(p, /talking to Marco/, "no 'talking to' (it turned speakers to profile)");
  assert.doesNotMatch(p, /\.\. /, "no doubled periods");
  assert.match(p, /Time of day: evening; lighting: warm candlelight and a soft lamp glow\. Keep exactly this time of day and lighting\./);
  const placed = buildScenePrompt({ story, scene: { ...scene, placement: "Mia stands outside the glass wall looking in; Marco is inside." }, library: LIB });
  assert.match(placed, /Positions: Mia stands outside the glass wall looking in; Marco is inside\. Setting:/);
});

test("the prompt always fits: worst-case library characters and planner limits", () => {
  const byOutfit = [...LIB_ROWS].sort((a, b) => (b.outfit.length + b.name.length) - (a.outfit.length + a.name.length)).slice(0, 6);
  const longLoc = Array(30).fill("extraordinarily").join(" ");
  const longAction = Array(14).fill("magnificently").join(" ");
  let max = 0;
  for (const a of byOutfit) for (const b of byOutfit) for (const c of byOutfit) {
    if (new Set([a.id, b.id, c.id]).size < 3) continue;
    const p = buildScenePrompt({
      story: { ...story, locations: [{ id: "loc1", description: longLoc, timeOfDay: "extraordinarily late afternoon", lighting: Array(15).fill("magnificently").join(" ") }] },
      scene: { ...scene, speakerId: a.id, presentIds: [a.id, b.id, c.id], action: longAction, emotion: "absolutely utterly furious", shot: "over-the-shoulder", placement: Array(30).fill("extraordinarily").join(" ") },
      library: LIB,
    });
    max = Math.max(max, p.length);
  }
  assert.ok(max <= PICTURE_PROMPT_MAX, `worst case ${max} chars`);
  assert.equal(PICTURE_PROMPT_MAX, SERVER_LIMITS.maxScenePromptChars);
});

test("the edit prompt fits even with the longest allowed instruction", () => {
  assert.ok(buildEditPrompt("x".repeat(SERVER_LIMITS.maxEditChars)).length <= PICTURE_PROMPT_MAX);
});

test("new picture: speaker's reference first, saved == sent, Nano Banana request shape", () => {
  const r = buildPictureRequest({ story, scene, library: LIB, mode: "new" });
  assert.equal(r.prompt, r.sent);
  assert.equal(r.request.positivePrompt, r.sent);
  assert.equal(r.request.model, "google:nano-banana@2-lite");
  assert.deepEqual([r.request.width, r.request.height], [768, 1376]);
  assert.deepEqual(r.request.inputs.referenceImages, [LIB.get("mia").refImageUrl, LIB.get("marco").refImageUrl]);
  assert.deepEqual(r.priceInput, { width: 768, height: 1376 });
  const wide = buildPictureRequest({ story: { ...story, aspect: "16:9" }, scene, library: LIB, mode: "new" });
  assert.deepEqual([wide.request.width, wide.request.height], [1376, 768]);
});

test("regenerate sends the user's edited prompt exactly; retry re-sends the stored prompt", () => {
  const edited = "  Mia stands at the window at night, rain outside. No text.  ";
  const r = buildPictureRequest({ story, scene, library: LIB, mode: "regenerate", prompt: edited });
  assert.equal(r.request.positivePrompt, edited);
  assert.equal(r.prompt, edited);
  const retry = buildPictureRequest({ story, scene: { ...scene, imagePrompt: "stored prompt" }, library: LIB, mode: "retry" });
  assert.equal(retry.request.positivePrompt, "stored prompt");
});

test("edit = the current picture + the instruction; the scene keeps its description", () => {
  const r = buildPictureRequest({ story, scene: { ...scene, imageUrl: "https://x/current.jpg" }, library: LIB, mode: "edit", instruction: "Make it night with blue moonlight." });
  assert.equal(r.prompt, null);
  assert.match(r.sent, /^Edit image 1\. Change only this: Make it night with blue moonlight\. Keep everything else exactly the same/);
  assert.equal(r.request.inputs.referenceImages[0], "https://x/current.jpg");
  assert.equal(r.request.inputs.referenceImages.length, 3);
  assert.throws(() => buildPictureRequest({ story, scene, library: LIB, mode: "edit", instruction: "x" }), /current picture/);
});

test("frame characters: speaker first, unknown ids refused", () => {
  assert.deepEqual(frameCharacters({ speakerId: "marco", presentIds: ["mia", "marco", "pia"] }, LIB).map((c) => c.id), ["marco", "mia", "pia"]);
  assert.throws(() => frameCharacters({ speakerId: "nobody", presentIds: ["nobody"] }, LIB), /unknown character/);
});

test("planStep with the real builder: one item per scene, saved == sent, edits keep the description", () => {
  const scenes = [{ ...scene, imageStatus: "queued", clipStatus: "none" }, { ...scene, id: "s2", speakerId: "marco", presentIds: ["marco", "mia"], imageStatus: "queued", clipStatus: "none" }];
  const staging = new Map(scenes.map((s) => [s.id, { locationId: s.locationId, action: s.action, emotion: s.emotion, shot: s.shot }]));
  const contract = scenes.map(({ locationId, action, emotion, shot, ...rest }) => rest);
  const plan = planStep("pictures", { story: { ...story, status: "draft" }, scenes: contract, library: LIB, builders: { picture: buildPictureRequest }, staging });
  assert.equal(plan.items.length, 2);
  for (const it of plan.items) assert.equal(it.request.positivePrompt, it.prompt);
  const editScenes = contract.map((s) => ({ ...s, imageStatus: "ready", imageUrl: `https://x/${s.id}.jpg` }));
  const edit = planStep("edit", { story: { ...story, status: "pictures_ready" }, scenes: editScenes, sceneId: "s1", instruction: "Add rain.", library: LIB, builders: { picture: buildPictureRequest }, staging });
  assert.equal(edit.items[0].prompt, null);
  assert.match(edit.items[0].request.positivePrompt, /Add rain\./);
});

test("the picture prompt names the speaker once, even when the action starts with the name", () => {
  for (const action of ["Mia slides a phone across the table", "Mia Mango slides a phone across the table", "She slides a phone across the table"]) {
    const p = buildScenePrompt({ story, scene: { ...scene, action }, library: LIB });
    assert.ok(p.includes("Mia Mango (the mango woman) slides a phone across the table, looking icy calm"), p.slice(0, 200));
    assert.doesNotMatch(p, /\(the mango woman\) (?:Mia|she)\b/i);
  }
});

test("staging: a lone speaker faces the camera; 3 characters stay speaker-first; old shot names are drawn chest-up", () => {
  const alone = buildScenePrompt({ story, scene: { ...scene, presentIds: ["mia"] }, library: LIB });
  assert.match(alone, /Mia Mango is alone in the frame, body and face turned toward the camera./);
  const three = buildScenePrompt({ story, scene: { ...scene, presentIds: ["mia", "marco", "pia"], shot: "chest-up" }, library: LIB });
  assert.match(three, /Chest-up shot on the speaker in the foreground, never full body/);
  assert.match(three, /Marco Mango and Pia Peach are further back beside or behind Mia Mango, smaller and slightly softer/);
  for (const old of ["over-the-shoulder", "medium two-shot", "wide"]) {
    const p = buildScenePrompt({ story, scene: { ...scene, shot: old }, library: LIB });
    assert.match(p, /Chest-up shot on the speaker/, old);
    assert.doesNotMatch(p, /over-the-shoulder|head to toe/i, old);
  }
  assert.match(three, /plain unbranded props/);
});

test("every character's fruit head is named, background characters too", async () => {
  const { fruitHeads } = await import("../supabase/functions/_shared/fruit/pictures.js");
  const p = buildScenePrompt({ story, scene: { ...scene, presentIds: ["mia", "marco", "pia"] }, library: LIB });
  assert.ok(p.includes("Every character has a fruit head, in the background too: Mia Mango has a mango head, Marco Mango has a mango head and Pia Peach has a peach head. No human heads, faces or hair on anyone."), p);
  assert.equal(fruitHeads([LIB.get("kai")]), "Every character has a fruit head, in the background too: Kai Coconut has a green young coconut head. No human heads, faces or hair on anyone.");
  assert.match(fruitHeads([{ name: "Olive Oliveira", fruit: "olive" }]), /has an olive head/);
});

test("a series location plate goes in after the characters, and the prompt says what it is", () => {
  const withPlate = { ...story, locations: [{ ...story.locations[0], plateUrl: "https://x/plate-s1.jpg" }] };
  const built = buildPictureRequest({ story: withPlate, scene, library: LIB, mode: "new" });
  assert.deepEqual(built.request.inputs.referenceImages.slice(-1), ["https://x/plate-s1.jpg"]);
  assert.equal(built.request.inputs.referenceImages.length, 3, "2 characters + the plate");
  assert.ok(built.prompt.includes("Image 3 is the empty set of this place: keep its layout, furniture and colors; the characters stand in it."));
  const none = buildPictureRequest({ story, scene, library: LIB, mode: "new" });
  assert.equal(none.request.inputs.referenceImages.length, 2);
  assert.ok(!none.prompt.includes("empty set of this place"));
});
