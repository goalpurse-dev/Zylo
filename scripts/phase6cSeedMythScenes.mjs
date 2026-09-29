// Phase 6c ($0): give the Myth vs Reality test project a Scenes review from
// what it already has — its beat plan (DB), its 136 V2 images + text layers
// (the Phase 5 render job's inputs) and its ready narration. Copies each
// image into the public scene path and inserts one current "seeded" scene
// row per beat. Idempotent (skips beats that already have a current row).
//   node --env-file=.env.local scripts/phase6cSeedMythScenes.mjs
import { createClient } from "@supabase/supabase-js";

const PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const PLAN = "96f510cb-67e7-4a98-a138-0ec1a1687706";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: p } = await admin.from("long_form_projects").select("user_id, current_render_job_id").eq("id", PROJECT).single();
const { data: u } = await admin.auth.admin.getUserById(p.user_id);
if (!u.user.email.endsWith("@zyvo-internal.test")) throw new Error("not a test project");
const { data: job } = await admin.from("long_form_render_jobs").select("edl").eq("id", p.current_render_job_id).single();
const { data: beats } = await admin.from("long_form_beats").select("sequence, narration_text, start_ms").eq("beat_plan_version_id", PLAN).order("sequence");
const { data: existing } = await admin.from("long_form_scene_images").select("beat_sequence").eq("project_id", PROJECT).eq("beat_plan_version_id", PLAN).eq("is_current", true);
const have = new Set((existing ?? []).map((r) => r.beat_sequence));
const bySeq = new Map(beats.map((b) => [b.sequence, b]));

let mismatched = 0, copied = 0;
const clips = job.edl.clips.filter((c) => !have.has(c.beatSequence));
await Promise.all(Array.from({ length: 8 }, async () => {
  while (clips.length) {
    const c = clips.shift();
    const b = bySeq.get(c.beatSequence);
    if (!b || b.narration_text.trim() !== String(c.narration).trim()) { mismatched++; continue; }
    const { data: blob, error: dErr } = await admin.storage.from("long-form-renders").download(c.image);
    if (dErr) throw new Error(`download ${c.image}: ${dErr.message}`);
    const path = `long-form/scenes/${PROJECT}/${String(c.beatSequence).padStart(3, "0")}-v1.jpg`;
    const { error: uErr } = await admin.storage.from("generated").upload(path, new Uint8Array(await blob.arrayBuffer()), { contentType: "image/jpeg", upsert: true });
    if (uErr) throw new Error(`upload ${path}: ${uErr.message}`);
    const url = admin.storage.from("generated").getPublicUrl(path).data.publicUrl;
    const { error: iErr } = await admin.from("long_form_scene_images").insert({
      project_id: PROJECT, beat_plan_version_id: PLAN, beat_sequence: c.beatSequence, version: 1, tier: "V2", status: "ready", source: "seeded",
      image_url: url, overlay: c.overlay ?? null, overlay_text: c.overlay?.text ?? null, ready_at: new Date().toISOString(),
    });
    if (iErr) throw new Error(`insert ${c.beatSequence}: ${iErr.message}`);
    copied++;
  }
}));
console.log(JSON.stringify({ clips: job.edl.clips.length, copied, alreadyHad: have.size, mismatched }));
