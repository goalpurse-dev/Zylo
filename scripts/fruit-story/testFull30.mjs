// ONE full 30-second AI Fruit Story on V2 (Wan2.6 Flash), end to end through
// the real API as the test account: idea → script → 6 pictures → animate all →
// final video with captions. Approved outside the $4 Phase 3 total (cap $2).
// No retries: a failed item is reported, not re-run.
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/testFull30.mjs
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson } from "./lib.mjs";

const WAN_PER_SEC = 0.0504, PICTURE = 0.035, PLANNER = 0.03;
const budget = openBudget("full30");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { accessToken, userId } = await userSession();
const db = admin();
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const balance = async () => must(await db.from("profiles").select("credit_balance").eq("id", userId).single()).credit_balance;
const out = { notes: [], timings: {} };
const log = (m) => { console.log(m); out.notes.push(m); };
const save = () => writeJson("data/fruit-phase3/full30-results.json", out);
out.balanceBefore = await balance();
const t0 = Date.now();

async function waitFor(storyId, done, maxMin) {
  const start = Date.now();
  for (;;) {
    await sleep(8000);
    const s = (await api(accessToken, "getStory", { storyId })).data;
    if (done(s) || Date.now() - start > maxMin * 60_000) return s;
  }
}

// 1. An idea with 3 characters (exercises speaker-first framing with a crowd).
let idea = null;
for (let seed = 30; seed < 40 && !idea; seed++) {
  const r = await api(accessToken, "getIdeas", { seed });
  idea = (r.data ?? []).find((i) => i.castIds.length === 3) ?? null;
}
if (!idea) { log("no 3-character idea found"); process.exit(1); }
out.idea = idea;
log(`idea: ${idea.title} — ${idea.summary} [${idea.castIds.join(", ")}]`);

// 2. Script (planner).
budget.reserve(PLANNER, "planner");
let since = new Date().toISOString();
const created = await api(accessToken, "createStory", { input: { source: "idea", ideaId: idea.id, quality: "v2", lengthSec: 30, aspect: "9:16" } });
const plannerCost = (must(await db.from("fruit_ai_calls").select("cost_usd").eq("user_id", userId).like("purpose", "planner%").gte("created_at", since)) ?? []).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);
budget.record(plannerCost, "full30 planner", PLANNER);
if (!created.ok) { log(`createStory: ${created.code} ${created.message}`); save(); process.exit(1); }
const storyId = created.data.id;
out.storyId = storyId;
out.timings.scriptSec = (Date.now() - t0) / 1000;
log(`script: "${created.data.title}" · ${created.data.scenes.length} scenes · ${created.data.scenes.reduce((s, x) => s + x.durationSec, 0)} s of clips · $${plannerCost.toFixed(4)}`);

// 3. Pictures.
budget.reserve(PICTURE * created.data.scenes.length, "pictures");
let t = Date.now();
const pic = await api(accessToken, "generateScenePictures", { storyId });
if (!pic.ok) { budget.record(0, "full30 pictures refused", PICTURE * created.data.scenes.length); log(`pictures: ${pic.code} ${pic.message}`); save(); process.exit(1); }
let story = await waitFor(storyId, (s) => s.status !== "pictures", 12);
out.timings.picturesSec = (Date.now() - t) / 1000;
const picJobs = must(await db.from("fruit_jobs").select("cost_usd, status").eq("story_id", storyId).eq("kind", "image"));
const picCost = picJobs.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
budget.record(picCost, "full30 pictures", PICTURE * created.data.scenes.length);
log(`pictures: ${story.status} · ${story.scenes.filter((s) => s.imageStatus === "ready").length}/${story.scenes.length} · $${picCost.toFixed(4)} · ${out.timings.picturesSec.toFixed(0)} s`);
if (story.scenes.some((s) => s.imageStatus !== "ready")) { log("a picture failed: stopping before video (no retries)"); save(); process.exit(1); }

// 4. Clips (V2 = Wan2.6 Flash; a failed Wan clip falls back once to Seedance Mini).
const clipSec = story.scenes.reduce((s, x) => s + x.durationSec, 0);
budget.reserve(clipSec * WAN_PER_SEC, "clips");
t = Date.now();
const anim = await api(accessToken, "animateAll", { storyId });
if (!anim.ok) { budget.record(0, "full30 clips refused", clipSec * WAN_PER_SEC); log(`animate: ${anim.code} ${anim.message}`); save(); process.exit(1); }
story = await waitFor(storyId, (s) => s.status !== "animating", 25);
out.timings.clipsSec = (Date.now() - t) / 1000;
const clipJobs = must(await db.from("fruit_jobs").select("id, scene_id, status, cost_usd, credits, request, error_code, error, stored_url").eq("story_id", storyId).eq("kind", "clip"));
const clipCost = clipJobs.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
budget.record(clipCost, "full30 clips", clipSec * WAN_PER_SEC);
const fellBack = clipJobs.filter((j) => j.request?.model !== "alibaba:wan@2.6-flash").length;
log(`clips: ${story.status} · ${story.scenes.filter((s) => s.clipStatus === "ready").length}/${story.scenes.length} · ${clipSec} s · $${clipCost.toFixed(4)} · fallbacks ${fellBack} · ${out.timings.clipsSec.toFixed(0)} s`);
if (story.scenes.some((s) => s.clipStatus !== "ready")) { log("a clip failed: no final (no retries)"); out.clipJobs = clipJobs; save(); process.exit(1); }

// 5. Final video with captions (free for the user; ≈ $0.001 machine time).
budget.reserve(0.01, "final");
t = Date.now();
const fin = await api(accessToken, "buildFinal", { storyId, captions: true });
if (!fin.ok) { budget.record(0, "full30 final refused", 0.01); log(`final: ${fin.code} ${fin.message}`); save(); process.exit(1); }
story = await waitFor(storyId, (s) => s.status !== "building", 12);
out.timings.finalSec = (Date.now() - t) / 1000;
const finalCall = must(await db.from("fruit_ai_calls").select("cost_usd, response").eq("story_id", storyId).eq("purpose", "final").order("created_at", { ascending: false }).limit(1))[0];
budget.record(Number(finalCall?.cost_usd ?? 0), "full30 final", 0.01);
log(`final: ${story.status} · ${finalCall?.response?.durationSec ?? "?"} s · trimmed ${story.final.trimmedSec} s · $${Number(finalCall?.cost_usd ?? 0).toFixed(4)} · ${out.timings.finalSec.toFixed(0)} s`);

// 6. What each clip says (speech-to-text, ≈ $0.004).
budget.reserve(0.01, "transcripts");
const scenes = must(await db.from("fruit_story_scenes").select("*").eq("story_id", storyId).order("idx"));
out.scenes = [];
for (const sc of scenes) {
  const job = clipJobs.find((j) => j.scene_id === sc.id);
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(await (await fetch(sc.clip_url)).arrayBuffer())], { type: "video/mp4" }), "clip.mp4");
  form.append("model", "whisper-1");
  form.append("language", "en");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
  const heard = (await res.json().catch(() => ({}))).text ?? `(HTTP ${res.status})`;
  out.scenes.push({
    idx: sc.idx, speakerId: sc.speaker_id, presentIds: sc.present_ids, line: sc.line, shot: sc.shot, action: sc.action, emotion: sc.emotion, placement: sc.placement,
    durationSec: sc.duration_sec, imageUrl: sc.image_url, imagePrompt: sc.image_prompt, clipUrl: sc.clip_url, clipPrompt: sc.clip_prompt,
    model: job?.request?.model, cost: Number(job?.cost_usd ?? 0), credits: job?.credits, saved: sc.clip_prompt === job?.request?.positivePrompt, heard,
  });
  log(`  ${sc.idx + 1}. ${sc.speaker_id}: ${sc.line}\n     heard: ${heard}`);
}
budget.record(scenes.length * 0.0006, "full30 transcripts", 0.01);

const row = must(await db.from("fruit_stories").select("title, locations, planner").eq("id", storyId).single());
out.story = { title: row.title, locations: row.locations, planner: row.planner, final: story.final, finalResponse: finalCall?.response };
out.costs = { planner: plannerCost, pictures: picCost, clips: clipCost, final: Number(finalCall?.cost_usd ?? 0) };
out.balanceAfter = await balance();
out.timings.totalSec = (Date.now() - t0) / 1000;
log(`credits charged: ${out.balanceBefore - out.balanceAfter} · real cost $${Object.values(out.costs).reduce((a, b) => a + b, 0).toFixed(4)} · wall ${(out.timings.totalSec / 60).toFixed(1)} min`);
save();
console.log(budget.summary());
