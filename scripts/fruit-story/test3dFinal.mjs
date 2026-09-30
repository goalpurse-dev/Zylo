// Stage 3d final: framing rule + scene 1 composition (Gloria foreground outside the glass),
// scene 2 in the late-afternoon light. Regenerates scenes 1 and 2.
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3dFinal.mjs
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
const locations = must(await db.from("fruit_stories").select("locations").eq("id", storyId).single()).locations;
// (locations already carry late afternoon + golden sunlight from the redo)
const rows = must(await db.from("fruit_story_scenes").select("*").eq("story_id", storyId).order("idx"));
const s1 = rows[0];
const s2 = rows[1];
must(await db.from("fruit_story_scenes").update({
  shot: "medium close-up",
  placement: "Gloria is in the foreground outside the glass wall, a medium shot of her with her face large and toward the camera; Rick and Bella are in the background inside the office, visible through the glass wall, smaller and slightly soft",
}).eq("id", s1.id));

// 2. Build each prompt exactly as the production builder does, and regenerate with it.
const lib = new Map(must(await db.from("fruit_characters").select("*")).map((c) => [c.id, c]));
const story = { aspect: prev.story.aspect, locations };
const fresh = must(await db.from("fruit_story_scenes").select("*").eq("story_id", storyId).order("idx"));
const contract = (r) => ({ speakerId: r.speaker_id, presentIds: r.present_ids, locationId: r.location_id, action: r.action, emotion: r.emotion, shot: r.shot, placement: r.placement });
const redo = [];
for (const row of [fresh[0], fresh[1]]) {
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
  budget.record(x.job.cost, `3d final scene ${x.idx + 1}`, 0.036);
  console.log(`scene ${x.idx + 1}: ${job.status} $${x.job.cost} saved==sent ${x.job.sent === x.prompt && story2.scenes[x.idx].imagePrompt === x.prompt}`);
}
writeJson("data/fruit-phase3/3d-final.json", { storyId, locations, redo, story: story2, sceneRows: must(await db.from("fruit_story_scenes").select("id, idx, location_id, action, emotion, shot, placement").eq("story_id", storyId)) });
console.log(budget.summary());

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
