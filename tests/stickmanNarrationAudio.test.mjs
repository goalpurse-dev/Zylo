import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex, computeScriptInputHash, computeRequestHash, mapAlignmentToNarration } from "../supabase/functions/_shared/stickman/narrationAudio.ts";

// 2026-10-02 "real narration audio master timeline" pass — pure logic only
// (hashing, alignment mapping). No real ElevenLabs call anywhere in this
// file; the live provider validation lives in
// scripts/stickmanNarrationAudioLive.mjs, run once with a real, small,
// authorized cost against a fresh synthetic fixture.

test("sha256Hex is deterministic — the same input always hashes identically", async () => {
  const a = await sha256Hex("hello world");
  const b = await sha256Hex("hello world");
  assert.equal(a, b);
  assert.equal(a.length, 64); // hex-encoded SHA-256
});

test("sha256Hex produces different hashes for different input", async () => {
  const a = await sha256Hex("hello world");
  const b = await sha256Hex("hello worlds");
  assert.notEqual(a, b);
});

test("computeScriptInputHash is stable for the identical segment list and changes when content changes", async () => {
  const segments = [{ text: "You are lying on packed dirt." }, { text: "Something moves." }];
  const h1 = await computeScriptInputHash(segments);
  const h2 = await computeScriptInputHash(segments);
  assert.equal(h1, h2);
  const h3 = await computeScriptInputHash([{ text: "You are lying on packed dirt." }, { text: "Nothing moves." }]);
  assert.notEqual(h1, h3);
});

test("computeScriptInputHash distinguishes a differently-split script with the same concatenated text (segment-boundary hash separator)", async () => {
  const a = await computeScriptInputHash([{ text: "cat" }, { text: "alog" }]);
  const b = await computeScriptInputHash([{ text: "catalog" }]);
  assert.notEqual(a, b, "different segmentation of the same characters must never hash identically");
});

test("computeRequestHash changes when ANY voice setting changes, not just the script", async () => {
  const scriptHash = await computeScriptInputHash([{ text: "hello" }]);
  const voiceA = { provider: "elevenlabs", voiceId: "voice1", voiceModel: "eleven_flash_v2_5", voiceSettings: {}, language: null };
  const voiceB = { ...voiceA, voiceId: "voice2" };
  const hashA = await computeRequestHash(scriptHash, voiceA);
  const hashB = await computeRequestHash(scriptHash, voiceB);
  assert.notEqual(hashA, hashB, "a different voice must produce a different request hash — never treated as the same cached artifact");
});

test("computeRequestHash is stable for identical (script, voice) — the real idempotency guarantee", async () => {
  const scriptHash = await computeScriptInputHash([{ text: "hello" }]);
  const voice = { provider: "elevenlabs", voiceId: "voice1", voiceModel: "eleven_flash_v2_5", voiceSettings: { stability: 0.5 }, language: null };
  const hash1 = await computeRequestHash(scriptHash, voice);
  const hash2 = await computeRequestHash(scriptHash, voice);
  assert.equal(hash1, hash2);
});

test("mapAlignmentToNarration re-derives narration timing from a raw alignment payload with zero provider call", () => {
  const characters = "hello world".split("");
  const starts = characters.map((_, i) => i * 0.1);
  const ends = characters.map((_, i) => (i + 1) * 0.1);
  const rawAlignment = { characters, character_start_times_seconds: starts, character_end_times_seconds: ends };
  const segments = [{ id: "seg1", text: "hello world" }];
  const result = mapAlignmentToNarration(rawAlignment, segments);
  assert.equal(result.ok, true);
  assert.equal(result.segmentTimings[0].segmentId, "seg1");
  assert.equal(result.segmentTimings[0].words.length, 2);
});
