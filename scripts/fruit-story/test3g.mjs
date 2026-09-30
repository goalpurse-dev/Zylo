// Stage 3g: a 3-episode series plan, then episode 1 written from it at 15 s
// on V2 and its scene pictures, through the real API. No video. Also checks
// that episode 2 is locked until episode 1 is made ($0).
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3g.mjs
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson } from "./lib.mjs";

const budget = openBudget("3g");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { accessToken, userId } = await userSession();
const db = admin();
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const balance = async () => must(await db.from("profiles").select("credit_balance").eq("id", userId).single()).credit_balance;
const callsCost = async (col, id, since) => (must(await db.from("fruit_ai_calls").select("cost_usd").eq(col, id).gte("created_at", since)) ?? []).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);
const out = { notes: [] };
const log = (m) => { console.log(m); out.notes.push(m); };
out.balanceBefore = await balance();

// 1. Series plan (free for the user; Sonnet 5 ≈ $0.02).
budget.reserve(0.05, "series plan");
let t = new Date().toISOString();
const plan = await api(accessToken, "createSeriesPlan", { input: {
  concept: "A wife finds a second phone in her husband's jacket, and the woman texting him just moved in next door.",
  castIds: ["mia", "marco", "pia"], opener: "A credit card bill read out loud", tone: "Petty and sarcastic", episodeCount: 3,
} });
if (!plan.ok) { budget.record(0, "3g series plan refused", 0.05); log(`series plan: ${plan.code} ${plan.message}`); writeJson("data/fruit-phase3/3g-results.json", out); process.exit(1); }
out.series = plan.data;
const seriesRow = must(await db.from("fruit_series").select("bible").eq("id", plan.data.id).single());
out.bible = seriesRow.bible;
const seriesCost = await callsCost("series_id", plan.data.id, t);
budget.record(seriesCost, "3g series plan", 0.05);
log(`series: "${plan.data.title}" · ${plan.data.episodes.length} episodes · $${seriesCost.toFixed(4)} (${seriesRow.bible.planner.attempts} attempt(s))`);

// 2. Episode 2 must be locked ($0).
const locked = await api(accessToken, "createStory", { input: { seriesId: plan.data.id, episodeNumber: 2, quality: "v2", lengthSec: 15, aspect: "9:16" } });
out.episode2Locked = locked.ok ? "NOT LOCKED" : `${locked.code}: ${locked.message}`;
log(`episode 2 before episode 1 is made: ${out.episode2Locked}`);

// 3. Episode 1 script (≈ $0.012) + pictures (3 × $0.035).
budget.reserve(0.2, "episode 1 script + pictures");
t = new Date().toISOString();
const ep = await api(accessToken, "createStory", { input: { seriesId: plan.data.id, episodeNumber: 1, quality: "v2", lengthSec: 15, aspect: "9:16" } });
if (!ep.ok) { budget.record(await callsCost("series_id", plan.data.id, t), "3g episode 1 refused", 0.2); log(`episode 1: ${ep.code} ${ep.message}`); writeJson("data/fruit-phase3/3g-results.json", out); process.exit(1); }
const storyId = ep.data.id;
const pics = await api(accessToken, "generateScenePictures", { storyId });
if (!pics.ok) log(`pictures: ${pics.code} ${pics.message}`);
let story;
const t0 = Date.now();
for (;;) {
  await sleep(8000);
  story = (await api(accessToken, "getStory", { storyId })).data;
  if (!["pictures"].includes(story.status) || Date.now() - t0 > 10 * 60_000) break;
}
const scenes = must(await db.from("fruit_story_scenes").select("idx, speaker_id, line, present_ids, action, emotion, shot, placement, image_url, image_prompt, image_job_id").eq("story_id", storyId).order("idx"));
const jobs = must(await db.from("fruit_jobs").select("id, status, cost_usd, credits").in("id", scenes.map((s) => s.image_job_id).filter(Boolean)));
const picCost = jobs.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
budget.record(picCost + (await callsCost("series_id", plan.data.id, t)), "3g episode 1 script + pictures", 0.2);
const storyRow = must(await db.from("fruit_stories").select("title, locations, planner, series_id, episode_number").eq("id", storyId).single());
out.episode1 = { storyId, status: story.status, title: storyRow.title, locations: storyRow.locations, planner: storyRow.planner, seriesId: storyRow.series_id, episodeNumber: storyRow.episode_number, scenes, jobs, pictureCostUsd: picCost };
out.balanceAfter = await balance();
out.seriesAfter = (await api(accessToken, "getSeries", { seriesId: plan.data.id })).data;
log(`episode 1: "${storyRow.title}" ${story.status} · pictures $${picCost.toFixed(4)} · ${out.balanceBefore - out.balanceAfter} credits`);
for (const s of scenes) log(`  ${s.idx + 1}. ${s.speaker_id}: ${s.line}`);
writeJson("data/fruit-phase3/3g-results.json", out);
console.log(budget.summary());
