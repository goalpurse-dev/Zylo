// Phase 6b — voice library (catalog as data + one static sample per voice),
// the Voice step "Listen & change", and a display-only narration screen.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { VOICE_CATALOG, VOICE_TONES, filterVoices, isRecommendedForNiche, findVoice } from "../src/lib/voiceCatalog.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("catalog: 30+ curated voices, each with id/name/tags/gender/accent/tones/niches/model and a static sample", () => {
  assert.ok(VOICE_CATALOG.length >= 30, `only ${VOICE_CATALOG.length}`);
  const ids = new Set();
  for (const v of VOICE_CATALOG) {
    assert.ok(!ids.has(v.voiceId), `duplicate ${v.voiceId}`); ids.add(v.voiceId);
    assert.ok(v.name && v.tags.length && v.niches.length && v.tones.length, v.name);
    assert.ok(["male", "female", "neutral"].includes(v.gender), v.name);
    assert.ok(v.tones.every((t) => VOICE_TONES.some((x) => x.id === t)), v.name);
    assert.equal(v.voiceModel, "eleven_flash_v2_5");
    assert.ok(fs.existsSync(new URL(`../public${v.sampleUrl}`, import.meta.url)), `missing sample ${v.sampleUrl}`);
    assert.ok(fs.existsSync(new URL(`./fixtures/stickman/audio/voice-samples/${v.voiceId}.json`, import.meta.url)), `missing alignment fixture ${v.name}`);
  }
  // No personal cloned or non-English voices.
  for (const id of ["FCmQsmqy2nSvOX4QLdU0", "IegRPObijulCgItpwtxI", "3OArekHEkHv5XvmZirVD", "vflhOcwDlonnVFj3wJqz"]) assert.equal(findVoice(id), null);
});

test("filters + niche recommendations", () => {
  assert.ok(filterVoices({ gender: "female" }).every((v) => v.gender === "female"));
  assert.ok(filterVoices({ tone: "documentary", accent: "british" }).every((v) => v.accent === "british" && v.tones.includes("documentary")));
  assert.ok(filterVoices({ query: "storyteller" }).some((v) => v.name === "George"));
  const george = findVoice("JBFqnCBsd6RMkjVDRZzb");
  assert.ok(isRecommendedForNiche(george, { id: "myth_vs_reality", groupId: "history" }));
  assert.ok(isRecommendedForNiche(george, { id: "timeline_history", groupId: "history" })); // by group
  assert.ok(!isRecommendedForNiche(george, null));
});

test("Voiceover panel (6e: an Editor panel, not a stop): player + script + voice name + Change voice (library with cost) + Back to Edit", () => {
  const page = read("src/pages/workspace/long-form/narration.jsx");
  assert.match(page, /Listen &amp; change/);
  assert.match(page, /data-testid="voice-name"/);
  assert.match(page, /data-testid="change-voice"/);
  assert.match(page, /<VoiceLibraryDialog[\s\S]*costNote=\{costNote\}/);
  assert.match(page, /primaryLabel="Back to Edit"/);
  assert.match(page, />Script</);
  // Progress: server-clock elapsed + ETA range are rendered in their own visible elements.
  assert.match(page, /data-testid="narration-elapsed"/);
  assert.match(page, /data-testid="narration-eta"/);
  assert.match(page, /nowMs - clockOffsetMs - startedMs/);
  // Display only: the page never starts or resumes a stalled run by itself.
  const refresh = page.slice(page.indexOf("const refresh = async"), page.indexOf("useEffect(() => {\n    const token") > 0 ? page.indexOf("useEffect(() => {\n    const token") : page.indexOf("const segments ="));
  assert.doesNotMatch(refresh, /generateNarrationAudio\(/);
});

test("the Writing screen hands straight on to the Voice step; the stepper shows Voice during the narration phase", () => {
  assert.match(read("src/pages/workspace/long-form/writing.jsx"), /if \(embedded\) onDone\?\.\(\); else setTimeout\(\(\) => navigate\(`\/long-form\/project\/\$\{projectId\}\/generating`/);
  assert.match(read("src/pages/workspace/long-form/projectStage.js"), /if \(ap\.status === "running"\) return \{ key: "scenes", route: "generating", stage: "voice"/);
});
