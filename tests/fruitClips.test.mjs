// AI Fruit Story v2 clips (stage 3e): prompt builder and request shapes, offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildClipPrompt, buildClipRequest, CLIP_PROMPT_MAX } from "../supabase/functions/_shared/fruit/clips.js";
import { planStep } from "../supabase/functions/_shared/fruit/steps.js";
import { SERVER_LIMITS } from "../supabase/functions/_shared/fruit/limits.js";

const ROWS = JSON.parse(fs.readFileSync(new URL("../data/fruit-characters/library.json", import.meta.url), "utf8")).map((c) => ({ ...c, voice_style: c.voiceStyle, ref_image_url: c.refImageUrl }));
const LIB = new Map(ROWS.map((c) => [c.id, c]));
const story = { aspect: "9:16", quality: "v2" };
const scene = { id: "s1", speakerId: "gloria", presentIds: ["gloria", "rick", "bella"], line: "The door's locked but these walls are glass, Rick.", emotion: "gleeful", action: "raises her phone to film them", shot: "medium close-up", placement: "Gloria outside the glass; Rick and Bella inside", imageUrl: "https://x/scene1.jpg" };

test("the clip prompt carries the exact line, who says it, their library voice, and silence for everyone else", () => {
  const p = buildClipPrompt({ scene, library: LIB });
  assert.ok(p.includes(`"${scene.line}"`), "exact line in quotes");
  assert.match(p, /^Gloria Grape, the grape woman facing the camera, says in her quick, chirpy, mid-pitched voice, delivered in a gleeful tone: "/);
  assert.match(p, /Only Gloria Grape speaks, lips moving in sync with every word\. Rick Crisp \(the apple man\) and Bella Berry \(the strawberry woman\) stay silent with mouths closed/);
  assert.match(p, /Camera: a slow push-in toward the speaker\./);
  assert.match(p, /No music\. No subtitles, captions or on-screen text\./);
  assert.ok(p.includes(`in her ${LIB.get("gloria").voice_style} voice`), "voiceStyle verbatim from the library");
});

test("the same character always gets the same voice wording", () => {
  const a = buildClipPrompt({ scene, library: LIB });
  const b = buildClipPrompt({ scene: { ...scene, line: "Nineteen years, Rick. Nineteen.", emotion: "smug" }, library: LIB });
  const voice = (s) => s.match(/says in her (.+?) voice/)[1];
  assert.equal(voice(a), voice(b));
});

test("worst case always fits the hard limit", () => {
  const byVoice = [...ROWS].sort((x, y) => (y.voice_style.length + y.name.length) - (x.voice_style.length + x.name.length)).slice(0, 5);
  let max = 0;
  for (const a of byVoice) for (const b of byVoice) for (const c of byVoice) {
    if (new Set([a.id, b.id, c.id]).size < 3) continue;
    const p = buildClipPrompt({ scene: { ...scene, speakerId: a.id, presentIds: [a.id, b.id, c.id], line: "x".repeat(SERVER_LIMITS.maxLineChars), emotion: "absolutely utterly furious", action: Array(14).fill("magnificently").join(" "), placement: Array(30).fill("extraordinarily").join(" "), shot: "over-the-shoulder" }, library: LIB });
    max = Math.max(max, p.length);
  }
  assert.ok(max <= CLIP_PROMPT_MAX, `worst case ${max}`);
});

test("the voice says how they sound; the scene's emotion alone sets the delivery", async () => {
  const { EMOTION_WORDS } = await import("../scripts/fruit-characters/voices.mjs");
  for (const c of ROWS) {
    for (const w of EMOTION_WORDS) assert.doesNotMatch(c.voice_style, new RegExp(`\b${w}\b`, "i"), `${c.id}: "${c.voice_style}" says an emotion (${w})`);
  }
  const bella = { ...scene, speakerId: "bella", presentIds: ["bella", "gloria"], emotion: "icy calm", line: "Nineteen years and you still don't knock, Gloria." };
  const p = buildClipPrompt({ scene: bella, library: LIB });
  assert.ok(p.includes(`says in her ${LIB.get("bella").voice_style} voice, delivered in an icy calm tone: "`), p.slice(0, 160));
  assert.equal((p.match(/icy calm/g) ?? []).length, 1, "the emotion is said once, as the delivery");
  const rick = buildClipPrompt({ scene: { ...scene, speakerId: "rick", presentIds: ["rick"], emotion: "panicked" }, library: LIB });
  assert.match(rick, /says in his .+ voice, delivered in a panicked tone:/);
});

test("the action never repeats the speaker's name", () => {
  const cases = [
    ["Gloria freezes mid-step, phone raised", "Gloria Grape freezes mid-step, phone raised."],
    ["Gloria Grape presses her phone to the glass", "Gloria Grape presses her phone to the glass."],
    ["gloria's eyes go wide", "Gloria Grape's eyes go wide."],
    ["She raises her phone to film them", "Gloria Grape raises her phone to film them."],
    ["raises her phone to film them", "Gloria Grape raises her phone to film them."],
  ];
  for (const [action, want] of cases) {
    const p = buildClipPrompt({ scene: { ...scene, action }, library: LIB });
    assert.ok(p.includes(` ${want} `), `${action} → ${p}`);
    assert.doesNotMatch(p, /Gloria Grape,? (?:Gloria|she)/i);
  }
});

test("every clip prompt says one continuous shot, no cuts, speaker facing the camera", () => {
  const p = buildClipPrompt({ scene, library: LIB });
  assert.ok(p.includes("One continuous shot, no cuts. The speaker keeps facing the camera until the line ends."));
  const minimal = buildClipPrompt({ scene: { ...scene, line: "x".repeat(SERVER_LIMITS.maxLineChars), placement: Array(30).fill("extraordinarily").join(" ") }, library: LIB });
  assert.ok(minimal.includes("One continuous shot, no cuts."), "kept at every length tier");
});

test("V2 = Wan2.6 Flash, V3 = Seedance 2.0 Mini, V4 = Veo 3.1 Fast; picture as first frame, audio on", () => {
  const v2 = buildClipRequest({ story, scene, library: LIB });
  assert.equal(v2.request.model, "alibaba:wan@2.6-flash");
  assert.deepEqual(v2.request.inputs.frameImages, ["https://x/scene1.jpg"]);
  assert.deepEqual(v2.request.providerSettings, { alibaba: { audio: true } });
  assert.equal(v2.request.positivePrompt, v2.prompt);
  assert.deepEqual([v2.request.width, v2.request.height], [720, 1280]);
  assert.deepEqual(v2.priceInput, { durationSec: v2.request.duration, width: 720, height: 1280, withSound: true });
  const v3 = buildClipRequest({ story: { ...story, quality: "v3" }, scene, library: LIB }).request;
  assert.equal(v3.model, "bytedance:seedance@2.0-mini");
  assert.deepEqual(v3.settings, { audio: true });
  const v4 = buildClipRequest({ story, scene, library: LIB, quality: "v4" });
  assert.equal(v4.request.model, "google:3@3");
  assert.deepEqual(v4.request.frameImages, [{ inputImage: "https://x/scene1.jpg" }]);
  assert.equal(v4.request.providerSettings.google.generateAudio, true);
  assert.ok([4, 6, 8].includes(v4.request.duration));
});

test("clip length: snapped up from the line; overrides must be an allowed duration", () => {
  assert.equal(buildClipRequest({ story, scene, library: LIB }).request.duration, 5);          // 9 words + comma = 4.4 s
  assert.equal(buildClipRequest({ story, scene, library: LIB, quality: "v4" }).request.duration, 6);
  assert.equal(buildClipRequest({ story, scene, library: LIB, quality: "v4", durationSec: 4 }).request.duration, 4);
  assert.throws(() => buildClipRequest({ story, scene, library: LIB, quality: "v4", durationSec: 5 }), /not allowed/);
  assert.throws(() => buildClipRequest({ story, scene: { ...scene, imageUrl: null }, library: LIB }), /needs the scene picture/);
});

test("animate all: one clip per scene through planStep, saved == sent", () => {
  const scenes = [{ id: "s1", speakerId: "gloria", presentIds: ["gloria", "rick"], line: scene.line, imageUrl: "https://x/1.jpg", imageStatus: "ready", clipStatus: "none" }, { id: "s2", speakerId: "rick", presentIds: ["rick"], line: "Put the phone down, Gloria.", imageUrl: "https://x/2.jpg", imageStatus: "ready", clipStatus: "none" }];
  const staging = new Map(scenes.map((s) => [s.id, { emotion: "tense", action: "leans in", shot: "close-up", placement: "" }]));
  const plan = planStep("animate", { story: { ...story, status: "pictures_ready" }, scenes, library: LIB, builders: { clip: buildClipRequest }, staging });
  assert.equal(plan.items.length, 2);
  for (const it of plan.items) { assert.equal(it.tool_key, "video:fruit-story-v2"); assert.equal(it.request.positivePrompt, it.prompt); }
});

test("a failed Wan clip falls back once to Seedance 2.0 Mini with the same prompt, frame and length", async () => {
  const { fallbackClipTask } = await import("../supabase/functions/_shared/fruit/clips.js");
  const wan = buildClipRequest({ story, scene, library: LIB }).request;
  const fb = fallbackClipTask(wan);
  assert.equal(fb.model, "bytedance:seedance@2.0-mini");
  assert.equal(fb.positivePrompt, wan.positivePrompt);
  assert.deepEqual(fb.inputs.frameImages, wan.inputs.frameImages);
  assert.equal(fb.duration, wan.duration);
  assert.deepEqual([fb.width, fb.height], [wan.width, wan.height]);
  assert.equal(fallbackClipTask(fb), null, "no second fallback");
  assert.equal(fallbackClipTask(buildClipRequest({ story, scene, library: LIB, quality: "v4" }).request), null, "V4 has no fallback");
});
