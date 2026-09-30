// Stage 3e paid test on the 3d story:
//   1. animate all on V2 through the real API (3 clips, Seedance 2.0 Mini)
//   2. ONE 4 s V4 clip (Veo 3.1 Fast) on scene 3 via an admin one-job test override
//   3. if Mini costs > $0.06/s: the same scene, 4 s, on LTX-2.3, Wan2.6 Flash and Mini at 480p
//   4. speech-to-text (whisper-1) on every clip to check the words against the line
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3e.mjs
import fs from "fs";
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson, ROOT, SUPABASE_URL } from "./lib.mjs";
import { buildClipPrompt } from "../../supabase/functions/_shared/fruit/clips.js";

const budget = openBudget("3e");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const storyId = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-results.json`, "utf8")).story.id;
const { accessToken, userId } = await userSession();
const db = admin();
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const out = { storyId, v2: [], v4: null, bakeoff: [], overrideLog: [], notes: [] };
const log = (m) => { console.log(m); out.notes.push(m); };
const worker = async (action, body) => (await fetch(`${SUPABASE_URL}/functions/v1/fruit-worker`, {
  method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }),
})).json();

async function waitStory(done, label, timeoutMs = 25 * 60_000) {
  const t0 = Date.now();
  for (;;) {
    const r = await api(accessToken, "getStory", { storyId });
    if (r.ok && done(r.data)) return r.data;
    if (Date.now() - t0 > timeoutMs) throw new Error(`${label}: timed out (${r.data?.status})`);
    await sleep(10_000);
  }
}

const balance0 = must(await db.from("profiles").select("credit_balance, plan_code").eq("id", userId).single());
out.balanceBefore = balance0;

// 1. V2 animate all.
const before = (await api(accessToken, "getStory", { storyId })).data;
const expectV2 = before.scenes.length * 5 * 0.081;
budget.reserve(expectV2, "V2 animate all");
const anim = await api(accessToken, "animateAll", { storyId });
if (!anim.ok) throw new Error(`animateAll: ${anim.code} ${anim.message}`);
log(`animate all started: ${anim.data.scenes.map((s) => s.durationSec + "s").join(", ")}`);
const animated = await waitStory((s) => s.status === "clips_ready", "V2 clips");
const v2Jobs = must(await db.from("fruit_jobs").select("*").eq("story_id", storyId).eq("kind", "clip").order("created_at"));
for (const s of animated.scenes) {
  const j = v2Jobs.find((x) => x.scene_id === s.id);
  out.v2.push({ idx: s.index, speakerId: s.speakerId, line: s.line, clipUrl: s.clipUrl, status: s.clipStatus, error: s.error, durationSec: j.request.duration, cost: Number(j.cost_usd), credits: j.credits, attempt: j.attempt, model: j.request.model, prompt: j.request.positivePrompt, saved: s.clipStatus === "ready" && j.request.positivePrompt === (await db.from("fruit_story_scenes").select("clip_prompt").eq("id", s.id).single()).data.clip_prompt });
}
const v2Cost = out.v2.reduce((a, c) => a + c.cost, 0);
const v2Sec = out.v2.reduce((a, c) => a + c.durationSec, 0);
budget.record(v2Cost, "3e V2 clips", expectV2);
out.v2PerSec = v2Cost / v2Sec;
log(`V2: ${out.v2.map((c) => c.status).join(", ")} · $${v2Cost.toFixed(4)} for ${v2Sec}s = $${out.v2PerSec.toFixed(4)}/s`);

// 2. One V4 clip, 4 s, on scene 3, via a single-use admin override.
const scene3 = animated.scenes[2];
const v2Scene3 = { clip_job_id: v2Jobs.find((x) => x.scene_id === scene3.id).id, clip_url: scene3.clipUrl, clip_prompt: out.v2[2].prompt, duration_sec: out.v2[2].durationSec };
budget.reserve(0.6, "V4 clip 4s");
const ov = must(await db.from("fruit_test_overrides").insert({ user_id: userId, story_id: storyId, tool_key: "video:fruit-story-v4", reason: "Stage 3e: one 4 s V4 test clip (approved by owner 2026-09-30)", created_by: "claude-code stage 3e", expires_at: new Date(Date.now() + 30 * 60_000).toISOString() }).select("*").single());
out.overrideLog.push({ created: ov });
log(`override ${ov.id} created, expires ${ov.expires_at}`);
const ct = await worker("clip_test", { sceneId: scene3.id, quality: "v4", durationSec: 4 });
if (!ct.ok) throw new Error(`clip_test: ${ct.code} ${ct.message}`);
const v4JobId = ct.jobs[0].job_id;
const t0 = Date.now();
let v4Job;
for (;;) {
  v4Job = must(await db.from("fruit_jobs").select("*").eq("id", v4JobId).single());
  if (["succeeded", "failed"].includes(v4Job.status)) break;
  if (Date.now() - t0 > 20 * 60_000) throw new Error("V4 timed out");
  await sleep(10_000);
}
out.v4 = { idx: 2, speakerId: scene3.speakerId, line: scene3.line, clipUrl: v4Job.stored_url, status: v4Job.status, error: v4Job.error, durationSec: v4Job.request.duration, cost: Number(v4Job.cost_usd), credits: v4Job.credits, model: v4Job.request.model, prompt: v4Job.request.positivePrompt, testOverrideId: v4Job.test_override_id };
budget.record(out.v4.cost, "3e V4 clip", 0.6);
out.overrideLog.push({ after: must(await db.from("fruit_test_overrides").select("*").eq("id", ov.id).single()) });
log(`V4: ${v4Job.status} · $${out.v4.cost.toFixed(4)} for 4s = $${(out.v4.cost / 4).toFixed(4)}/s · ${v4Job.credits} credits`);
// Put scene 3 back on its V2 clip so the story stays one tier for 3f (the V4 clip stays in fruit_jobs).
must(await db.from("fruit_story_scenes").update({ clip_job_id: v2Scene3.clip_job_id, clip_url: v2Scene3.clip_url, clip_prompt: v2Scene3.clip_prompt, duration_sec: v2Scene3.duration_sec, clip_status: "ready" }).eq("id", scene3.id));
log("scene 3 restored to its V2 clip (V4 clip kept on its job for comparison)");

// 3. Bake-off on the same scene (4 s, with dialogue) if Mini is over $0.06/s.
if (out.v2PerSec > 0.06) {
  const lib = new Map(must(await db.from("fruit_characters").select("*")).map((c) => [c.id, c]));
  const row = must(await db.from("fruit_story_scenes").select("*").eq("id", scene3.id).single());
  const prompt = buildClipPrompt({ scene: { speakerId: row.speaker_id, presentIds: row.present_ids, line: row.line, emotion: row.emotion, action: row.action, shot: row.shot, placement: row.placement }, library: lib });
  const img = row.image_url;
  const base = { taskType: "videoInference", positivePrompt: prompt, duration: 4, numberResults: 1, outputType: "URL", outputFormat: "MP4" };
  const candidates = [
    { label: "LTX-2.3", expect: 0.2, task: { ...base, model: "lightricks:ltx@2.3", width: 720, height: 1280, inputs: { frameImages: [img] } } },
    { label: "Wan2.6 Flash", expect: 0.25, task: { ...base, model: "alibaba:wan@2.6-flash", width: 720, height: 1280, providerSettings: { alibaba: { audio: true } }, inputs: { frameImages: [img] } } },
    { label: "Seedance 2.0 Mini 480p", expect: 0.35, task: { ...base, model: "bytedance:seedance@2.0-mini", width: 496, height: 864, settings: { audio: true }, inputs: { frameImages: [img] } } },
  ];
  for (const c of candidates) {
    try { budget.reserve(c.expect, c.label); } catch (e) { log(`skip ${c.label}: ${e.message}`); out.bakeoff.push({ label: c.label, skipped: e.message }); continue; }
    const sub = await worker("raw_test", { task: c.task, label: c.label, userId, storyId, sceneId: scene3.id });
    if (!sub.ok) { budget.record(0, `3e bakeoff ${c.label} refused`, c.expect); out.bakeoff.push({ label: c.label, model: c.task.model, refused: sub.error ?? sub.message, prompt }); log(`${c.label}: refused (${sub.error ?? sub.message})`); continue; }
    const t1 = Date.now();
    let r;
    for (;;) {
      r = await worker("raw_poll", { taskUUID: sub.taskUUID, callId: sub.callId });
      if (r.state !== "pending" || Date.now() - t1 > 15 * 60_000) break;
      await sleep(10_000);
    }
    budget.record(Number(r.cost ?? 0), `3e bakeoff ${c.label}`, c.expect);
    out.bakeoff.push({ label: c.label, model: c.task.model, size: `${c.task.width}x${c.task.height}`, durationSec: 4, state: r.state, clipUrl: r.url ?? null, cost: Number(r.cost ?? 0), error: r.error ?? null, prompt });
    log(`${c.label}: ${r.state} $${Number(r.cost ?? 0).toFixed(4)} = $${(Number(r.cost ?? 0) / 4).toFixed(4)}/s ${r.error ?? ""}`);
  }
} else {
  log(`Mini measured $${out.v2PerSec.toFixed(4)}/s <= $0.06/s: no bake-off needed`);
}

// 4. Speech-to-text on every clip (checks the spoken words; ~$0.006/min).
const clips = [...out.v2.map((c) => ({ ref: c, label: `V2 scene ${c.idx + 1}` })), out.v4 ? { ref: out.v4, label: "V4 scene 3" } : null, ...out.bakeoff.filter((b) => b.clipUrl).map((b) => ({ ref: b, label: b.label }))].filter((x) => x?.ref.clipUrl);
budget.reserve(0.02, "transcripts");
for (const c of clips) {
  const bytes = Buffer.from(await (await fetch(c.ref.clipUrl)).arrayBuffer());
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "video/mp4" }), "clip.mp4");
  form.append("model", "whisper-1");
  form.append("language", "en");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
  const j = await res.json().catch(() => ({}));
  c.ref.transcript = j.text ?? `(${res.status} ${j.error?.message ?? "no text"})`;
  c.ref.sizeBytes = bytes.length;
  log(`${c.label} heard: ${c.ref.transcript}`);
}
budget.record(clips.length * 0.0006, "3e transcripts (whisper-1, ~6 s each)", 0.02);

out.balanceAfter = must(await db.from("profiles").select("credit_balance, plan_code").eq("id", userId).single());
out.ledger = must(await db.from("fruit_credit_ledger").select("operation, credits, reason, job_id").eq("story_id", storyId).order("id"));
writeJson("data/fruit-phase3/3e-results.json", out);
console.log(budget.summary());
