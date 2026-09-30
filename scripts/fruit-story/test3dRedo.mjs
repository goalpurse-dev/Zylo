// Stage 3d follow-up: apply the new staging rules to the 3d story and
// regenerate scene 1 (Gloria outside the glass) and scene 3 (daytime).
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3dRedo.mjs
import fs from "fs";
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson, ROOT } from "./lib.mjs";
import { buildScenePrompt } from "../../supabase/functions/_shared/fruit/pictures.js";

const budget = openBudget("3d");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prev = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-results.json`, "utf8"));
const storyId = prev.story.id;
const { accessToken, userId } = await userSession();
const db = admin();

// 1. The staging the new planner rules now require (time of day + lighting; placement; no wide shots).
const locations = [{ ...prev.locations[0], timeOfDay: "late afternoon", lighting: "warm golden sunlight streaming through the glass walls" }];
must(await db.from("fruit_stories").update({ locations }).eq("id", storyId).eq("user_id", userId));
const rows = must(await db.from("fruit_story_scenes").select("*").eq("story_id", storyId).order("idx"));
const s1 = rows[0];
const s3 = rows[2];
must(await db.from("fruit_story_scenes").update({
  shot: "medium two-shot",
  placement: "Gloria stands outside the glass wall in the hallway, face close to the glass, looking in toward the camera; Rick and Bella are inside the office in the foreground, turned toward her",
}).eq("id", s1.id));

// 2. Build each prompt exactly as the production builder does, and regenerate with it.
const lib = new Map(must(await db.from("fruit_characters").select("*")).map((c) => [c.id, c]));
const story = { aspect: prev.story.aspect, locations };
const fresh = must(await db.from("fruit_story_scenes").select("*").eq("story_id", storyId).order("idx"));
const contract = (r) => ({ speakerId: r.speaker_id, presentIds: r.present_ids, locationId: r.location_id, action: r.action, emotion: r.emotion, shot: r.shot, placement: r.placement });
const redo = [];
for (const row of [fresh[0], fresh[2]]) {
  const prompt = buildScenePrompt({ story, scene: contract(row), library: lib });
  budget.reserve(0.036, `regenerate scene ${row.idx + 1}`);
  const r = await api(accessToken, "regenerateScene", { sceneId: row.id, prompt });
  if (!r.ok) throw new Error(`regenerateScene ${row.idx + 1}: ${r.code} ${r.message}`);
  redo.push({ idx: row.idx, sceneId: row.id, prompt, previousUrl: row.image_url });
  console.log(`scene ${row.idx + 1} regenerating (${prompt.length} chars)`);
}

// 3. Wait for both.
const t0 = Date.now();
let story2;
for (;;) {
  story2 = (await api(accessToken, "getStory", { storyId })).data;
  if (story2.status === "pictures_ready") break;
  if (Date.now() - t0 > 8 * 60_000) throw new Error("timed out");
  await sleep(5000);
}
for (const x of redo) {
  const job = must(await db.from("fruit_jobs").select("*").eq("scene_id", x.sceneId).order("created_at", { ascending: false }).limit(1))[0];
  x.job = { id: job.id, status: job.status, attempt: job.attempt, credits: job.credits, cost: Number(job.cost_usd), model: job.request.model, sent: job.request.positivePrompt, refs: job.request.inputs.referenceImages.length };
  x.newUrl = story2.scenes[x.idx].imageUrl;
  budget.record(x.job.cost, `3d redo scene ${x.idx + 1}`, 0.036);
  console.log(`scene ${x.idx + 1}: ${job.status} $${x.job.cost} saved==sent ${x.job.sent === x.prompt && story2.scenes[x.idx].imagePrompt === x.prompt}`);
}
writeJson("data/fruit-phase3/3d-redo.json", { storyId, locations, redo, story: story2, sceneRows: must(await db.from("fruit_story_scenes").select("id, idx, location_id, action, emotion, shot, placement").eq("story_id", storyId)) });
console.log(budget.summary());

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
