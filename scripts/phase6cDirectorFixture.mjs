// Phase 6c: save the failed e2e beat-plan run as an offline replay fixture
// (segments + frozen bible + real narration timings + the recorded model
// calls of all three attempts). $0.
//   node --env-file=.env.local scripts/phase6cDirectorFixture.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "7850557d-bff5-4a35-b7dc-f01f93510502";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: plans } = await admin.from("long_form_beat_plan_versions").select("id, created_at, error_detail, script_version_id, production_bible_id, narration_audio_version_id").eq("project_id", PROJECT).order("created_at");
const p0 = plans[0];
const { data: script } = await admin.from("long_form_script_versions").select("script_document").eq("id", p0.script_version_id).single();
const { data: bible } = await admin.from("long_form_production_bibles").select("bible").eq("id", p0.production_bible_id).single();
const { data: audio } = await admin.from("long_form_narration_audio_versions").select("narration").eq("id", p0.narration_audio_version_id).single();
const doc = script.script_document;
const callback = {
  key: doc?.callbackKey ?? null,
  plantSegmentId: doc?.plantSegmentIndex != null ? doc.narrationSegments?.[doc.plantSegmentIndex]?.id ?? null : null,
  payoffSegmentId: doc?.payoffSegmentIndex != null ? doc.narrationSegments?.[doc.payoffSegmentIndex]?.id ?? null : null,
};
const cassettes = [];
for (const p of plans) {
  const { data: list } = await admin.storage.from("script-cassettes").list(`beatplan/${p.id}`);
  for (const f of list ?? []) {
    const { data: blob } = await admin.storage.from("script-cassettes").download(`beatplan/${p.id}/${f.name}`);
    cassettes.push({ planId: p.id, error: p.error_detail, cassette: JSON.parse(await blob.text()) });
  }
}
const out = { note: "Phase 6c e2e (Why is ice slippery, Daniel, 8 min): beat plan failed 3x on window 2 too_short (1.5 s beat, no neighbour fits)", segments: doc.narrationSegments.map((s) => ({ id: s.id, text: s.text })), bible: bible.bible, narration: audio.narration, callback, runs: cassettes };
fs.writeFileSync("tests/fixtures/stickman/beats/ice-slippery.phase6c.json", JSON.stringify(out));
console.log(JSON.stringify({ plans: plans.length, runs: cassettes.length, entries: cassettes.map((c) => c.cassette.entries?.length ?? Object.keys(c.cassette)), segments: out.segments.length, narrationSegs: out.narration.length }));
