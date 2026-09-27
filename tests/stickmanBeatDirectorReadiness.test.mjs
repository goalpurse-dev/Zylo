import test from "node:test";
import assert from "node:assert/strict";
import { assembleBeatDirectorReadiness } from "../supabase/functions/_shared/stickman/beatDirectorReadiness.ts";

// 2026-10-02 "real narration audio master timeline" pass, Section 15 — the
// single object the next phase's Beat Director consumes. Pure assembly,
// tested with fake rows standing in for real DB fetches.

const fakeProject = { topic: "How Early Humans Survived Winter", selected_idea_title: "Survival tricks", selected_idea_angle: "small clever tricks" };
const fakeProfile = { id: "profile-1" };
const fakeScript = { id: "script-1", script_document: { narrationSegments: [{ id: "seg1", text: "You are lying on packed dirt." }, { id: "seg2", text: "Something moves in the grass." }] } };
const fakeBible = { id: "bible-1", bible_version: 1, bible: { visualPremise: "A cold-open survival scene.", visualTone: "tense" } };
const fakeNarrationReady = {
  id: "narration-1", status: "ready", audio_duration_seconds: 6.2,
  narration: [
    { segmentId: "seg1", startSeconds: 0, endSeconds: 3.1, words: [{ word: "You", start: 0, end: 0.2 }] },
    { segmentId: "seg2", startSeconds: 3.1, endSeconds: 6.2, words: [{ word: "Something", start: 3.1, end: 3.5 }] },
  ],
};

test("ready:true only when EVERY dependency (profile, script, bible, ready narration) is present", () => {
  const result = assembleBeatDirectorReadiness({ project: fakeProject, generationProfile: fakeProfile, scriptVersion: fakeScript, productionBible: fakeBible, narrationAudio: fakeNarrationReady });
  assert.equal(result.ready, true);
  assert.deepEqual(result.missing, []);
});

test("ready:false with a precise, human-readable reason when the Bible isn't frozen yet", () => {
  const result = assembleBeatDirectorReadiness({ project: fakeProject, generationProfile: fakeProfile, scriptVersion: fakeScript, productionBible: null, narrationAudio: fakeNarrationReady });
  assert.equal(result.ready, false);
  assert.ok(result.missing.some((m) => m.includes("Production Bible")));
});

test("ready:false when narration audio exists but is still generating (not status:ready)", () => {
  const generating = { ...fakeNarrationReady, status: "generating", narration: null };
  const result = assembleBeatDirectorReadiness({ project: fakeProject, generationProfile: fakeProfile, scriptVersion: fakeScript, productionBible: fakeBible, narrationAudio: generating });
  assert.equal(result.ready, false);
  assert.ok(result.missing.some((m) => m.includes("Narration audio")));
  assert.equal(result.narrationAudioVersionId, null, "an unready narration row must never be exposed as if it were usable");
});

test("narration segments carry the real script text joined back from the script version, not just bare timing", () => {
  const result = assembleBeatDirectorReadiness({ project: fakeProject, generationProfile: fakeProfile, scriptVersion: fakeScript, productionBible: fakeBible, narrationAudio: fakeNarrationReady });
  assert.equal(result.narration[0].text, "You are lying on packed dirt.");
  assert.equal(result.narration[1].text, "Something moves in the grass.");
  assert.equal(result.narration[0].words[0].word, "You");
});

test("storyContext pulls visualPremise/visualTone from the frozen Bible, never re-deriving them", () => {
  const result = assembleBeatDirectorReadiness({ project: fakeProject, generationProfile: fakeProfile, scriptVersion: fakeScript, productionBible: fakeBible, narrationAudio: fakeNarrationReady });
  assert.equal(result.storyContext.visualPremise, "A cold-open survival scene.");
  assert.equal(result.storyContext.visualTone, "tense");
  assert.equal(result.storyContext.topic, "How Early Humans Survived Winter");
});

test("lineage ids are always the real ids from the supplied rows, never fabricated", () => {
  const result = assembleBeatDirectorReadiness({ project: fakeProject, generationProfile: fakeProfile, scriptVersion: fakeScript, productionBible: fakeBible, narrationAudio: fakeNarrationReady });
  assert.equal(result.scriptVersionId, "script-1");
  assert.equal(result.productionBibleVersionId, "bible-1");
  assert.equal(result.generationProfileId, "profile-1");
  assert.equal(result.narrationAudioVersionId, "narration-1");
  assert.equal(result.audioDurationSeconds, 6.2);
});
