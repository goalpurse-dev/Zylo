// Stage 3e confirmation run: re-animate the 3 "Glass Walls Don't Lie" pictures
// on V2 = Wan2.6 Flash (no-cut rule) through the normal production path
// (regenerateClip, one scene at a time so the $1.00 cap holds even if the
// Seedance fallback kicks in), then speech-to-text on each clip. No retries.
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3eConfirm.mjs
import fs from "fs";
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson, ROOT } from "./lib.mjs";

const budget = openBudget("3e2");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const storyId = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-results.json`, "utf8")).story.id;
const { accessToken, userId } = await userSession();
const db = admin();
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const out = { storyId, clips: [], notes: [] };
const log = (m) => { console.log(m); out.notes.push(m); };
out.balanceBefore = must(await db.from("profiles").select("credit_balance").eq("id", userId).single()).credit_balance;

const story = (await api(accessToken, "getStory", { storyId })).data;
const WORST = 5 * 0.0817;   // a Seedance fallback clip
for (const s of story.scenes) {
  try { budget.reserve(WORST, `scene ${s.index + 1}`); } catch (e) { log(`stop before scene ${s.index + 1}: ${e.message}`); break; }
  const r = await api(accessToken, "regenerateClip", { sceneId: s.id });
  if (!r.ok) { budget.record(0, `3e2 scene ${s.index + 1} refused`, WORST); log(`scene ${s.index + 1}: ${r.code} ${r.message}`); out.clips.push({ idx: s.index, refused: `${r.code}: ${r.message}` }); continue; }
  const jobId = must(await db.from("fruit_story_scenes").select("clip_job_id").eq("id", s.id).single()).clip_job_id;
  const t0 = Date.now();
  let job;
  for (;;) {
    job = must(await db.from("fruit_jobs").select("*").eq("id", jobId).single());
    if (["succeeded", "failed"].includes(job.status) || Date.now() - t0 > 15 * 60_000) break;
    await sleep(10_000);
  }
  const fellBack = job.request.model !== "alibaba:wan@2.6-flash";
  budget.record(Number(job.cost_usd), `3e2 scene ${s.index + 1}${fellBack ? " (fallback)" : ""}`, WORST);
  const scene = must(await db.from("fruit_story_scenes").select("clip_url, clip_prompt, line, speaker_id").eq("id", s.id).single());
  out.clips.push({ idx: s.index, speakerId: scene.speaker_id, line: scene.line, status: job.status, error: job.error, model: job.request.model, fellBack, durationSec: job.request.duration, cost: Number(job.cost_usd), credits: job.credits, clipUrl: job.stored_url, prompt: job.request.positivePrompt, saved: scene.clip_prompt === job.request.positivePrompt });
  log(`scene ${s.index + 1}: ${job.status} on ${job.request.model} $${Number(job.cost_usd).toFixed(4)}${fellBack ? " (Seedance fallback)" : ""}${job.error ? ` · ${job.error}` : ""}`);
}

budget.reserve(0.01, "transcripts");
for (const c of out.clips.filter((x) => x.clipUrl)) {
  const bytes = Buffer.from(await (await fetch(c.clipUrl)).arrayBuffer());
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "video/mp4" }), "clip.mp4");
  form.append("model", "whisper-1");
  form.append("language", "en");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
  c.transcript = (await res.json().catch(() => ({}))).text ?? `(HTTP ${res.status})`;
  log(`scene ${c.idx + 1} heard: ${c.transcript}`);
}
budget.record(out.clips.length * 0.0005, "3e2 transcripts", 0.01);
out.balanceAfter = must(await db.from("profiles").select("credit_balance").eq("id", userId).single()).credit_balance;
writeJson("data/fruit-phase3/3e-confirm.json", out);
console.log(budget.summary());
