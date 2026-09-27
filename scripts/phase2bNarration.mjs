// Phase 2b — the ONE paid ElevenLabs narration for the Myth vs Reality test
// project, through the real generate-long-form-narration-audio path (profile
// voice/model, with timestamps). Saves a PERMANENT fixture that Phases 3-6
// reuse and must never regenerate:
//   tests/fixtures/stickman/audio/myth-vs-reality/
//     audio.mp3            the narration
//     alignment.raw.json   ElevenLabs' raw character alignment
//     narration.json       per-segment word timings (what the beat builder reads)
//     words.json           flat word timeline [{index, word, segmentId, startMs, endMs}]
//     meta.json            row id, voice, characters, provider character cost, quota before/after
// Refuses to run if the fixture exists. Never retries: a failure is reported
// and left for diagnosis.
import { admin, ANON_KEY, SUPABASE_URL, callFn } from "./phase1cLib.mjs";
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir, access } from "node:fs/promises";

const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const SCRIPT_ID = "b3669868-54a6-4814-bd61-323efed108b0";
const DIR = new URL("../tests/fixtures/stickman/audio/myth-vs-reality/", import.meta.url);

try {
  await access(new URL("narration.json", DIR));
  console.log("fixture already exists — never regenerated. Delete it by hand only if the user asks.");
  process.exit(1);
} catch { /* not there yet */ }

const quota = async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-quota-check`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: "TxGEqnHWrfWFTfGW9XjX" }) });
  return res.json();
};

const { data: project } = await admin.from("long_form_projects").select("*").eq("id", PROJECT_ID).single();
if (project.current_script_version_id !== SCRIPT_ID) throw new Error("the test project's current script is not the Myth vs Reality fixture");
const { data: script } = await admin.from("long_form_script_versions").select("script_document, locked_at").eq("id", SCRIPT_ID).single();
if (!script.locked_at) throw new Error("script not locked");
const segments = script.script_document.narrationSegments.map((s) => ({ id: s.id, text: s.text }));
const text = segments.map((s) => s.text).join(" ");
console.log(`characters to send: ${text.length} (${segments.length} segments, ${text.split(/\s+/).filter(Boolean).length} words)`);

const before = await quota();
console.log("quota before:", JSON.stringify(before));

const { data: owner } = await admin.auth.admin.getUserById(project.user_id);
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: owner.user.email });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: verified, error: otpError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (otpError) throw otpError;

const t0 = Date.now();
const start = await callFn("generate-long-form-narration-audio", verified.session.access_token, { projectId: PROJECT_ID });
console.log("started:", JSON.stringify(start));
let row;
for (;;) {
  ({ data: row } = await admin.from("long_form_narration_audio_versions").select("*").eq("id", start.narrationAudioVersionId).single());
  if (row.status !== "generating") break;
  if (Date.now() - t0 > 6 * 60_000) throw new Error("narration timed out (not retried)");
  await new Promise((r) => setTimeout(r, 4000));
}
console.log(`status: ${row.status}${row.last_error_code ? ` (${row.last_error_code})` : ""} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const after = await quota();
console.log("quota after:", JSON.stringify(after));
if (row.status !== "ready") {
  console.log("NOT ready — no retry. Diagnose from the row above.");
  process.exit(1);
}

const audio = Buffer.from(await (await fetch(row.audio_url)).arrayBuffer());
const words = [];
for (const seg of row.narration) for (const w of seg.words) words.push({ index: words.length, word: w.word, segmentId: seg.segmentId, startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000) });
await mkdir(DIR, { recursive: true });
await writeFile(new URL("audio.mp3", DIR), audio);
await writeFile(new URL("alignment.raw.json", DIR), JSON.stringify(row.raw_provider_alignment));
await writeFile(new URL("narration.json", DIR), JSON.stringify(row.narration, null, 1));
await writeFile(new URL("words.json", DIR), JSON.stringify(words));
await writeFile(new URL("meta.json", DIR), JSON.stringify({
  narrationAudioVersionId: row.id, projectId: PROJECT_ID, scriptVersionId: SCRIPT_ID, createdAt: row.created_at, readyAt: row.ready_at,
  voiceProvider: row.voice_provider, voiceId: row.voice_id, voiceModel: row.voice_model, voiceSettings: row.voice_settings,
  requestHash: row.request_hash, scriptInputHash: row.script_input_hash, audioUrl: row.audio_url, audioBytes: audio.length,
  audioDurationSeconds: row.audio_duration_seconds, charactersSent: text.length, wordCount: words.length, segments: segments.length,
  providerMetadata: row.provider_metadata, internalCostUsdEstimate: row.internal_cost_usd,
  quotaBefore: before, quotaAfter: after,
  quotaDeltaCharacters: before?.characterCount != null && after?.characterCount != null ? after.characterCount - before.characterCount : null,
  segmentTexts: segments,
}, null, 2));
console.log(`saved ${new URL(".", DIR).pathname} — ${audio.length} bytes, ${words.length} words, ${row.audio_duration_seconds}s; provider character cost ${row.provider_metadata?.providerCharacterCost ?? "n/a"}`);
