// Stage 3i: framing fix check. Regenerates series episode 1 scenes 2 and 3
// (both had the speaker in a 3/4 turn toward the listener) with the new
// speaker-first staging prompt, through the real regenerateScene path.
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3i.mjs
import fs from "fs";
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson, ROOT } from "./lib.mjs";
import { buildScenePrompt } from "../../supabase/functions/_shared/fruit/pictures.js";

const budget = openBudget("3i");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const storyId = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3g-results.json`, "utf8")).episode1.storyId;
const { accessToken } = await userSession();
const db = admin();
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const story = must(await db.from("fruit_stories").select("*").eq("id", storyId).single());
const lib = new Map(must(await db.from("fruit_characters").select("*")).map((c) => [c.id, c]));
const scenes = must(await db.from("fruit_story_scenes").select("*").eq("story_id", storyId).order("idx"));
const out = { storyId, redo: [] };

for (const sc of scenes.filter((s) => [1, 2].includes(s.idx))) {
  const prompt = buildScenePrompt({
    story: { aspect: story.aspect, locations: story.locations },
    scene: { speakerId: sc.speaker_id, presentIds: sc.present_ids, action: sc.action, emotion: sc.emotion, shot: sc.shot, placement: sc.placement, locationId: sc.location_id },
    library: lib,
  });
  budget.reserve(0.04, `scene ${sc.idx + 1}`);
  const r = await api(accessToken, "regenerateScene", { sceneId: sc.id, prompt });
  if (!r.ok) { budget.record(0, `3i scene ${sc.idx + 1} refused`, 0.04); console.log(`scene ${sc.idx + 1}: ${r.code} ${r.message}`); continue; }
  const jobId = must(await db.from("fruit_story_scenes").select("image_job_id").eq("id", sc.id).single()).image_job_id;
  let job;
  for (const t0 = Date.now(); ;) {
    await sleep(6000);
    job = must(await db.from("fruit_jobs").select("*").eq("id", jobId).single());
    if (["succeeded", "failed"].includes(job.status) || Date.now() - t0 > 6 * 60_000) break;
  }
  budget.record(Number(job.cost_usd ?? 0), `3i scene ${sc.idx + 1}`, 0.04);
  out.redo.push({ idx: sc.idx, speaker: sc.speaker_id, shot: sc.shot, oldUrl: sc.image_url, newUrl: job.stored_url, status: job.status, cost: Number(job.cost_usd ?? 0), prompt, saved: job.request.positivePrompt === prompt });
  console.log(`scene ${sc.idx + 1}: ${job.status} $${Number(job.cost_usd ?? 0).toFixed(4)}`);
}
writeJson("data/fruit-phase3/3i-results.json", out);
console.log(budget.summary());
