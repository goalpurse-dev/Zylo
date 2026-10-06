// The niche seam (supabase/functions/_shared/fruit/niches/): one engine, one
// niche per template. Fruit's own prompts are pinned in
// fruitPromptSnapshot.test.mjs; this file checks the seam itself and what
// Blocky Stories puts through it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NICHES, DEFAULT_NICHE, nicheOf, nicheIdFrom, hooksOf, hasHooks, toolKeyOf } from "../supabase/functions/_shared/fruit/niches/index.js";
import { buildScenePrompt, buildPictureRequest, buildEditPrompt, PICTURE_PROMPT_MAX, scenePromptLengths } from "../supabase/functions/_shared/fruit/pictures.js";
import { buildClipPrompt, buildClipRequest, CLIP_PROMPT_MAX, NO_CUT } from "../supabase/functions/_shared/fruit/clips.js";
import { platePrompt } from "../supabase/functions/_shared/fruit/plates.js";
import { planStep } from "../supabase/functions/_shared/fruit/steps.js";
import { validateCreateStory } from "../supabase/functions/_shared/fruit/validation.js";

// Two avatars as the library will hold them: no age, no gender, a look, a voice.
const AVATARS = [
  { id: "vex", name: "Vex", niche: "blocky", fruit: "avatar", gender: null, age: null, tag: "Admin", role: "cold rule keeper", outfit: "a crimson torso with a yellow lightning-bolt shape, black legs and a tall black top hat", voice_style: "low, slow, flat", ref_image_url: "https://example.test/vex.jpg" },
  { id: "taz", name: "Taz", niche: "blocky", fruit: "avatar", gender: null, age: null, tag: "Trader", role: "loud deal maker", outfit: "a navy torso with a white circle shape, grey legs and green headphones", voice_style: "raspy, loud, fast", ref_image_url: "https://example.test/taz.jpg" },
  { id: "lux", name: "Lux", niche: "blocky", fruit: "avatar", gender: null, age: null, tag: "Rich", role: "smug collector", outfit: "a pink torso with a white diamond shape, white legs and a small gold crown", voice_style: "bright, clipped, smug", ref_image_url: "https://example.test/lux.jpg" },
];
const LIB = new Map(AVATARS.map((c) => [c.id, c]));
const story = { id: "st1", niche: "blocky", aspect: "9:16", quality: "v2", outfits: {}, locations: [{ id: "loc1", description: "A trading plaza with plain market stalls and stacked block crates", timeOfDay: "midday", lighting: "bright even daylight", plateUrl: "https://example.test/plaza.jpg" }] };
const scene = { id: "s1", speakerId: "taz", presentIds: ["taz", "lux"], locationId: "loc1", action: "throws both block arms up", emotion: "furious", shot: "chest-up", placement: "Taz stands left of the stall; Lux stands right of it.", line: "You traded me a hacked pet? It just ate my whole base!", imageUrl: "https://example.test/scene.jpg" };

test("a row without a niche, an unknown niche and no niche at all are Fruit; the browser's value is checked", () => {
  assert.equal(DEFAULT_NICHE, "fruit");
  for (const x of [undefined, null, {}, { niche: null }, { niche: "nope" }, "nope", "fruit", { niche: "fruit" }]) assert.equal(nicheOf(x).id, "fruit");
  assert.equal(nicheOf("blocky").id, "blocky");
  assert.equal(nicheOf({ niche: "blocky" }).id, "blocky");
  assert.equal(nicheOf(NICHES.blocky), NICHES.blocky);
  assert.equal(nicheIdFrom(undefined), "fruit", "browsers from before templates send nothing");
  assert.equal(nicheIdFrom(""), "fruit");
  assert.equal(nicheIdFrom("blocky"), "blocky");
  assert.equal(nicheIdFrom("toString"), null, "only real niche ids");
  assert.equal(nicheIdFrom(7), null);
});

test("Fruit overrides nothing: it is the engine's built-in wording and price rows", () => {
  for (const part of ["picture", "clip", "writer", "series", "review", "check", "upload", "plate", "cast"]) {
    assert.equal(hooksOf("fruit", part), null, part);
    assert.equal(hasHooks("fruit", part), false);
  }
  assert.equal(NICHES.fruit.toolKeys, undefined);
  assert.equal(toolKeyOf({}, "image", "image:fruit-story"), "image:fruit-story");
  assert.equal(NICHES.fruit.flag, null);
  assert.equal(NICHES.fruit.ready, true);
});

test("another niche never gets Fruit's wording by accident: a rule set it doesn't have throws", () => {
  assert.throws(() => hooksOf("blocky", "somethingNew"), new RegExp(`${NICHES.blocky.name} has no somethingNew rules yet`));
  assert.equal(hooksOf("fruit", "somethingNew"), null, "Fruit is the built-in wording");
  assert.equal(NICHES.blocky.flag, "blocky_v1");
});

test("a Blocky picture: the style lock, 'a blocky toy avatar', no fruit, no age, no man or woman", () => {
  const p = buildScenePrompt({ story, scene, library: LIB });
  assert.match(p, /^Vertical 9:16 frame\. Chest-up shot on the speaker in the foreground, never full body\./);
  assert.match(p, /Taz \(a blocky toy avatar\) throws both block arms up, looking furious \(flat eyebrow lines on the decal may show it\), the mouth decal open mid-sentence, speaking toward the camera\./);
  assert.match(p, /Staging: Taz stands closest to the camera/, "Fruit's staging is the engine's and stays");
  assert.match(p, /Every character is a blocky toy avatar with a cube head and a flat 2D face decal/);
  assert.match(p, /Image 1 is Taz, a blocky toy avatar: keep the cube head, the face decal \(eyes and mouth shape\), the colours and the outfit exactly as in the reference\./);
  assert.match(p, /Image 3 is the empty set of this place/, "the location picture is the last reference");
  assert.match(p, /Style: 3D classic blocky Roblox-style avatars: cube heads, rectangular torsos, block arms and legs, smooth matte plastic, simple flat 2D face decals\. A chunky low-poly world built from smooth matte plastic blocks and simple geometric parts\./);
  assert.match(p, /no studs, no studded baseplates, no round minifigure heads, no neck studs, no claw hands, no brick-toy minifigures/);
  assert.match(p, /No text, no letters, no numbers/);
  assert.match(p, /no logos or brand marks/);
  assert.doesNotMatch(p, /fruit|mango|hair/i);
  assert.doesNotMatch(p, /\b(woman|man|boy|girl|kid|child|year-old|years? old)\b/i);
  // "studs" may only appear as something to leave out (decision 12).
  assert.doesNotMatch(p.replace(/no studs, no studded baseplates/g, "").replace(/no neck studs/g, ""), /\bstud(s|ded)?\b/i);
  assert.ok(p.length <= PICTURE_PROMPT_MAX);
});

test("a Blocky picture fits the limit at every wording, and the request carries the avatar and location references", () => {
  // The ordinary case, two avatars and a location picture, fits at the full wording.
  assert.ok(scenePromptLengths({ story, scene, library: LIB })[0] <= PICTURE_PROMPT_MAX, "a two-avatar scene uses the full wording");
  // The largest a scene can be (the writer's limits: 3 in frame, 30-word placement, 30-word location, 12-word action).
  const words = (n, w) => Array.from({ length: n }, () => w).join(" ");
  const three = { ...scene, presentIds: ["taz", "lux", "vex"], placement: `${words(30, "placement")}.`, action: words(12, "action") };
  const big = { ...story, locations: [{ ...story.locations[0], description: words(30, "location"), timeOfDay: "late afternoon", lighting: words(15, "light") }] };
  const lengths = scenePromptLengths({ story: big, scene: three, library: LIB });
  assert.ok(lengths[2] <= PICTURE_PROMPT_MAX, `shortest wording ${lengths[2]}`);
  assert.ok(lengths[0] > lengths[1] && lengths[1] > lengths[2]);
  assert.ok(lengths[0] > PICTURE_PROMPT_MAX, "so this one is sent at a shorter wording");
  const short = buildScenePrompt({ story: big, scene: three, library: LIB });
  assert.ok(short.length <= PICTURE_PROMPT_MAX);
  // Whatever the wording, the style lock and the no-brick-toy rule are in the prompt.
  assert.match(short, /Style: (3D classic )?blocky Roblox-style avatars/);
  assert.match(short, /cube heads/);
  assert.match(short, /smooth matte plastic blocks/);
  assert.match(short, /no studs/);
  assert.doesNotMatch(short, /Same look as the references/, "Blocky never leaves the look to the references alone");
  const built = buildPictureRequest({ story, scene, library: LIB, mode: "new" });
  assert.deepEqual(built.request.inputs.referenceImages, ["https://example.test/taz.jpg", "https://example.test/lux.jpg", "https://example.test/plaza.jpg"]);
  assert.equal(built.request.positivePrompt, built.prompt);
  const edit = buildEditPrompt("Make the crates blue.", story);
  assert.match(edit, /Keep everything else exactly the same: the same characters, cube heads, face decals, outfits, poses, background, lighting and framing\./);
  assert.doesNotMatch(edit, /fruit/i);
});

test("a Blocky clip: Fruit's clip rules with the avatar wording and the decal rule", () => {
  for (const quality of ["v2", "v3", "v4"]) {
    const p = buildClipPrompt({ scene, library: LIB, quality, niche: story });
    assert.match(p, /^Taz, the blocky toy avatar facing the camera, says in a raspy, loud, fast voice, delivered in a furious tone: "You traded me a hacked pet\? It just ate my whole base!"/);
    assert.match(p, /Only Taz speaks, the flat mouth decal on Taz's face changing shape in sync with every word\. Lux \(the blocky toy avatar\) stays silent with the mouth decal closed and still/);
    assert.ok(p.includes(NO_CUT), "the no-cut rule and 'the speaker keeps facing the camera'");
    assert.match(p, /The faces stay flat 2D decals on cube heads: no realistic 3D mouth, teeth, lips, tongue or nose\./);
    assert.match(p, /No subtitles, captions or on-screen text\. Plain unbranded props, no logos\./);
    assert.doesNotMatch(p, /fruit|\bhis\b|\bher\b|\bwoman\b|\bman\b|undefined|null/i);
    assert.ok(p.length <= CLIP_PROMPT_MAX);
  }
  assert.match(buildClipPrompt({ scene, library: LIB, quality: "v3", niche: "blocky" }), /Camera: almost still, locked off/, "Seedance keeps its still camera");
  const req = buildClipRequest({ story, scene, library: LIB });
  assert.match(req.prompt, /the blocky toy avatar/, "the request builder takes the niche from the story");
});

test("Blocky charges under its own price rows; Fruit under Fruit's", () => {
  const scenes = [{ ...scene, imageStatus: "ready", clipStatus: "none" }];
  const staging = new Map(scenes.map((x) => [x.id, { locationId: x.locationId, action: x.action, emotion: x.emotion, shot: x.shot, placement: x.placement }]));
  const builders = { picture: buildPictureRequest, clip: buildClipRequest };
  const pictures = planStep("pictures", { story: { ...story, status: "draft" }, scenes: scenes.map((x) => ({ ...x, imageUrl: null, imageStatus: "none" })), library: LIB, builders, staging });
  assert.deepEqual(pictures.items.map((i) => i.tool_key), ["image:blocky-story"]);
  for (const q of ["v2", "v3", "v4"]) {
    const clips = planStep("animate", { story: { ...story, quality: q, status: "pictures_ready" }, scenes, library: LIB, builders, staging });
    assert.deepEqual(clips.items.map((i) => i.tool_key), [`video:blocky-story-${q}`]);
  }
});

test("Blocky plates and casts: its own background style, and no same-fruit rule", () => {
  const plate = platePrompt("A trading plaza with plain market stalls", "9:16", "blocky");
  assert.match(plate, /smooth matte plastic blocks and simple geometric parts/);
  assert.doesNotMatch(plate.replace(/No studs, no studded baseplates\./, ""), /\bstud(s|ded)?\b|feature-film/i);
  // All three avatars share fruit = "avatar": Fruit's rule would refuse them as look-alikes.
  const input = { source: "prompt", prompt: "A trade goes badly wrong.", castIds: ["taz", "lux", "vex"], quality: "v2", aspect: "9:16", lengthSec: 30 };
  assert.throws(() => validateCreateStory(input, LIB), /would look the same on screen/, "Fruit's rule, when no niche is given");
  assert.deepEqual(validateCreateStory(input, LIB, undefined, "blocky").castIds, ["taz", "lux", "vex"]);
});

test("the migration: every list can be one niche's, Fruit is the default, Blocky has its own price rows and flag", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261006190000_story_niches.sql", import.meta.url), "utf8");
  for (const table of ["fruit_characters", "fruit_ideas", "fruit_stories", "fruit_series"]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table}\\s+ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT 'fruit' CHECK \\(niche IN \\('fruit', 'blocky'\\)\\)`), table);
  }
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS fruit_characters_niche_first_name_key ON public\.fruit_characters \(niche, first_name\)/);
  assert.match(sql, /niche = 'blocky' AND age IS NULL\s+AND gender IS NULL/, "an avatar has no age and is never a man or a woman");
  assert.match(sql, /fruit_pick_ideas\(p_seed text, p_count integer DEFAULT 5, p_niche text DEFAULT 'fruit'\)/);
  assert.match(sql, /COALESCE\(NULLIF\(p_story->>'niche', ''\), 'fruit'\)/);
  assert.match(sql, /replace\(tool_key, 'fruit-story', 'blocky-story'\)/);
  assert.match(sql, /'blocky_v1', false/);
  assert.doesNotMatch(sql, /fruit_charge_step\(/, "the charge function is not replaced");
  assert.deepEqual(Object.values(NICHES.blocky.toolKeys).sort(), ["image:blocky-story", "video:blocky-story-v2", "video:blocky-story-v3", "video:blocky-story-v4"]);
});

test("the API: lists are one template's, a story keeps its template, a hidden template needs its flag", () => {
  const api = fs.readFileSync(new URL("../supabase/functions/fruit-story-api/index.ts", import.meta.url), "utf8");
  assert.match(api, /from\("fruit_characters"\)\.select\("\*"\)\.eq\("active", true\)\.eq\("niche", niche\)/, "listCharacters");
  assert.match(api, /from\("fruit_ideas"\)\.select\("\*"\)\.eq\("id", raw\.ideaId\)\.eq\("active", true\)\.eq\("niche", niche\)/, "an idea of another template can't be used");
  assert.match(api, /from\("fruit_series"\)\.select\("\*"\)\.eq\("user_id", userId\)\.eq\("niche", niche\)/, "listSeries");
  assert.match(api, /from\("fruit_stories"\)\.select\("\*"\)\.eq\("user_id", ctx\.userId\)\.eq\("niche", niche\)/, "listRecent");
  assert.match(api, /if \(!s \|\| nicheOf\(s\)\.id !== niche\) throw new FruitError\("NOT_FOUND"/, "an episode is of its series' template");
  assert.match(api, /global_feature_flags"\)\.select\("enabled"\)\.eq\("key", flag\)/);
  assert.match(api, /user_feature_flags"\)\.select\("flags"\)\.eq\("user_id", userId\)/);
  assert.match(api, /requireReady\(niche\);/);
  // An answer for another template names it; Fruit's answer is the same envelope as before.
  assert.match(api, /return reply\(\{ ok: true, data, \.\.\.\(ctx\.niche && ctx\.niche !== DEFAULT_NICHE \? \{ niche: ctx\.niche \} : \{\}\) \}\);/);
  const adapter = fs.readFileSync(new URL("../src/components/viral-tools/ai-fruit-story-v2/api/supabaseAdapter.js", import.meta.url), "utf8");
  assert.match(adapter, /if \(asked && json\.niche !== asked\) throw new FruitApiError\("STAGE_NOT_READY"/, "the browser refuses an answer that isn't for the template it asked for");
  // Fruit's idea call is the same call as before (no p_niche), so it works on either side of the migration.
  assert.match(api, /\.\.\.\(niche === DEFAULT_NICHE \? \{\} : \{ p_niche: niche \}\)/);
});
