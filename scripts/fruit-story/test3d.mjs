// Stage 3d paid test: ONE 15 s story through the real API (as the test
// account): createStory -> generateScenePictures -> one editScene.
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3d.mjs
// Writes data/fruit-phase3/3d-results.json (story, prompts, jobs, calls, costs).
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson } from "./lib.mjs";

const budget = openBudget("3d");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { accessToken, userId } = await userSession();
const db = admin();
const balance = async () => (await db.from("profiles").select("credit_balance").eq("id", userId).single()).data.credit_balance;
const log = [];
const step = (m) => { log.push(m); console.log(m); };

async function waitFor(storyId, done, label, timeoutMs = 8 * 60_000) {
  const t0 = Date.now();
  for (;;) {
    const r = await api(accessToken, "getStory", { storyId });
    if (!r.ok) throw new Error(`${label}: ${r.code} ${r.message}`);
    if (done(r.data)) return r.data;
    if (Date.now() - t0 > timeoutMs) throw new Error(`${label}: timed out, status ${r.data.status}`);
    await sleep(5000);
  }
}

const balance0 = await balance();

// 1. Write the story (planner, Sonnet 5).
budget.reserve(0.03, "planner");
const created = await api(accessToken, "createStory", { input: { source: "idea", ideaId: "office-the-door-was-locked", quality: "v2", aspect: "9:16", lengthSec: 15 } });
if (!created.ok) throw new Error(`createStory: ${created.code} ${created.message}`);
const story = created.data;
const plannerCost = (await db.from("fruit_ai_calls").select("cost_usd").eq("story_id", story.id)).data.reduce((s, r) => s + Number(r.cost_usd), 0);
budget.record(plannerCost, "3d planner", 0.03);
step(`story ${story.id}: "${story.title}", ${story.scenes.length} scenes, ${story.lengthSec}s, planner $${plannerCost.toFixed(4)}`);

// 2. All pictures.
budget.reserve(0.0344 * story.scenes.length, "pictures");
const started = await api(accessToken, "generateScenePictures", { storyId: story.id });
if (!started.ok) throw new Error(`generateScenePictures: ${started.code} ${started.message}`);
step(`pictures started: ${started.data.status}, balance ${balance0} -> ${await balance()}`);
const pics = await waitFor(story.id, (s) => s.status === "pictures_ready", "pictures");
const picJobs = (await db.from("fruit_jobs").select("*").eq("story_id", story.id).eq("kind", "image")).data;
const picCost = picJobs.reduce((s, j) => s + Number(j.cost_usd), 0);
budget.record(picCost, "3d pictures", 0.0344 * story.scenes.length);
step(`pictures done: ${pics.scenes.map((s) => s.imageStatus).join(", ")}, real $${picCost.toFixed(4)}`);

// 3. One edit on scene 1.
const target = pics.scenes[0];
const before = { url: target.imageUrl, prompt: target.imagePrompt };
let edit = null;
if (target.imageStatus === "ready") {
  budget.reserve(0.036, "edit");
  const e = await api(accessToken, "editScene", { sceneId: target.id, instruction: "make it night time, with the city lights glowing through the glass walls" });
  if (!e.ok) throw new Error(`editScene: ${e.code} ${e.message}`);
  const after = await waitFor(story.id, (s) => s.status === "pictures_ready" && s.scenes[0].imageUrl !== before.url, "edit");
  const editJob = (await db.from("fruit_jobs").select("*").eq("scene_id", target.id).order("created_at", { ascending: false }).limit(1)).data[0];
  const cleanup = (await db.from("fruit_ai_calls").select("cost_usd, response").eq("scene_id", target.id).eq("purpose", "edit_cleanup")).data;
  const editCost = Number(editJob.cost_usd) + cleanup.reduce((s, r) => s + Number(r.cost_usd), 0);
  budget.record(editCost, "3d edit", 0.036);
  edit = { before, after: { url: after.scenes[0].imageUrl, prompt: after.scenes[0].imagePrompt }, sent: editJob.request.positivePrompt, cost: editCost, jobCost: Number(editJob.cost_usd), cleanupCost: editCost - Number(editJob.cost_usd), status: editJob.status };
  step(`edit done: $${editCost.toFixed(4)}`);
}

const final = (await api(accessToken, "getStory", { storyId: story.id })).data;
const jobs = (await db.from("fruit_jobs").select("id, scene_id, kind, status, attempt, credits, cost_usd, request, error_code, error, created_at").eq("story_id", story.id).order("created_at")).data;
const ledger = (await db.from("fruit_credit_ledger").select("operation, credits, reason").eq("story_id", story.id)).data;
const rows = (await db.from("fruit_stories").select("locations, planner").eq("id", story.id).single()).data;
const sceneRows = (await db.from("fruit_story_scenes").select("id, idx, location_id, action, emotion, shot").eq("story_id", story.id)).data;
writeJson("data/fruit-phase3/3d-results.json", { story: final, locations: rows.locations, planner: rows.planner, sceneRows, jobs, ledger, edit, balance: { before: balance0, after: await balance() }, log });
console.log(budget.summary());
