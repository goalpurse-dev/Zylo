// Live checks for hands-on test #2 follow-ups (≈ $0.29, stage 3k):
//   A. the picture check on "Caught at Dinner"'s 3 pictures (Piper was drawn human)
//   B. a new series (bible, locations, props, catchphrases, setups) + episode 1
//      at 15 s: location plates, pictures with the plate as reference, checks
//   C. "Caught at Dinner" final re-rendered with Part 1 + end card + cover, and its upload package
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3k.mjs
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson } from "./lib.mjs";
import { checkPicture } from "../../supabase/functions/_shared/fruit/pictureCheck.js";

const budget = openBudget("3k");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { accessToken, userId } = await userSession();
const db = admin();
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const out = { notes: [] };
const log = (m) => { console.log(m); out.notes.push(m); };
const save = () => writeJson("data/fruit-phase3/3k-results.json", out);
const WEDDING_EP = "721f55be-3249-4d9f-9f31-c466d933831b";   // "Caught at Dinner"
const cost = async (filter) => (must(await filter(db.from("fruit_ai_calls").select("cost_usd"))) ?? []).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);

// A. Picture check on the existing pictures (SKIP_A=1 on a rerun).
if (!process.env.SKIP_A) {
budget.reserve(0.01, "A checks");
const scenesA = must(await db.from("fruit_story_scenes").select("id, idx, present_ids, image_url, image_job_id").eq("story_id", WEDDING_EP).order("idx"));
const lib = new Map(must(await db.from("fruit_characters").select("id, name, fruit")).map((c) => [c.id, c]));
out.checkA = [];
let costA = 0;
for (const sc of scenesA) {
  const expected = sc.present_ids.map((id) => lib.get(id)).map((c) => ({ name: c.name, fruit: c.fruit }));
  const v = await checkPicture({ admin: db, apiKey: process.env.OPENAI_API_KEY, imageUrl: sc.image_url, expected, ids: { user_id: userId, story_id: WEDDING_EP, scene_id: sc.id, job_id: sc.image_job_id } });
  costA += v.costUsd;
  out.checkA.push({ idx: sc.idx, imageUrl: sc.image_url, expected, ok: v.ok, problems: v.problems, costUsd: v.costUsd });
  log(`A scene ${sc.idx + 1}: ${v.ok ? "passed" : `FAILED: ${v.problems.join("; ")}`} · $${v.costUsd.toFixed(4)}`);
}
budget.record(costA, "3k A picture checks", 0.01);
save();
}

// B. New series + episode 1 with plates and pictures (SKIP_B=1 on a rerun).
if (!process.env.SKIP_B) {
budget.reserve(process.env.SERIES_ID ? 0.27 : 0.3, "B series + episode 1");
const t0 = new Date().toISOString();
// SERIES_ID=… reuses a series already planned (a rerun after a failed episode).
const plan = process.env.SERIES_ID ? await api(accessToken, "getSeries", { seriesId: process.env.SERIES_ID }) : await api(accessToken, "createSeriesPlan", { input: {
  concept: "A lifeguard is secretly dating two women at once, and both of them book the same beach bar for a surprise date.",
  castIds: ["kai", "maya", "piper"], opener: "Caught at the beach bar", tone: "Petty and sarcastic", episodeCount: 3,
} });
if (!plan.ok) { log(`B series plan: ${plan.code} ${plan.message}`); budget.record(await cost((q) => q.eq("user_id", userId).gte("created_at", t0)), "3k B refused", 0.3); save(); process.exit(1); }
out.series = plan.data;
log(`B series: "${plan.data.title}" · ${plan.data.bible.locations.length} locations · ${plan.data.bible.characters.length} characters`);
const ep = await api(accessToken, "createStory", { input: { seriesId: plan.data.id, episodeNumber: 1, quality: "v2", lengthSec: 15, aspect: "9:16" } });
if (!ep.ok) { log(`B episode 1: ${ep.code} ${ep.message}`); budget.record(await cost((q) => q.eq("user_id", userId).gte("created_at", t0)), "3k B episode refused", 0.3); save(); process.exit(1); }
const storyId = ep.data.id;
const pics = await api(accessToken, "generateScenePictures", { storyId });
if (!pics.ok) log(`B pictures: ${pics.code} ${pics.message}`);
let story;
for (const start = Date.now(); ;) {
  await sleep(6000);
  story = (await api(accessToken, "getStory", { storyId })).data;
  if (story.status !== "pictures" || Date.now() - start > 8 * 60_000) break;
}
const row = must(await db.from("fruit_stories").select("title, locations, cast_roles, end_state").eq("id", storyId).single());
const scenesB = must(await db.from("fruit_story_scenes").select("idx, speaker_id, line, present_ids, location_id, image_url, image_prompt, image_check, image_check_notes, image_job_id, emotion, action").eq("story_id", storyId).order("idx"));
const jobsB = must(await db.from("fruit_jobs").select("id, cost_usd, error, attempt, request").eq("story_id", storyId).eq("kind", "image"));
const checksB = must(await db.from("fruit_ai_calls").select("scene_id, job_id, cost_usd, response, created_at").eq("story_id", storyId).eq("purpose", "picture_check").order("created_at"));
const seriesRow = must(await db.from("fruit_series").select("bible").eq("id", plan.data.id).single());
out.episode = { storyId, title: row.title, status: story.status, locations: row.locations, castRoles: row.cast_roles, endState: row.end_state, scenes: scenesB, jobs: jobsB, checks: checksB, bible: seriesRow.bible };
const costB = await cost((q) => q.eq("user_id", userId).gte("created_at", t0).neq("purpose", "final")) + jobsB.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
budget.record(costB, "3k B series + episode 1 (plan, plates, pictures, checks)", process.env.SERIES_ID ? 0.27 : 0.3);
log(`B episode 1 "${row.title}": ${story.status}; plates: ${(seriesRow.bible.locations ?? []).filter((l) => l.plates).length}; checks: ${checksB.map((c) => (c.response?.verdict?.ok ? "pass" : "fail")).join(", ")}; redraws: ${jobsB.filter((j) => String(j.error ?? "").startsWith("picture check")).length} · $${costB.toFixed(4)}`);
save();
}

// C. Final extras on "Caught at Dinner".
budget.reserve(0.02, "C final + package");
const t1 = new Date().toISOString();
const fin = await api(accessToken, "buildFinal", { storyId: WEDDING_EP, captions: true, partLabel: true, endCard: true });   // as the toggles would
if (!fin.ok) log(`C final: ${fin.code} ${fin.message}`);
let fs;
for (const start = Date.now(); ;) {
  await sleep(5000);
  fs = (await api(accessToken, "getStory", { storyId: WEDDING_EP })).data;
  if (fs.status !== "building" || Date.now() - start > 8 * 60_000) break;
}
const pkg = await api(accessToken, "uploadPackage", { storyId: WEDDING_EP, refresh: Boolean(process.env.REFRESH_PACKAGE) });
out.final = { status: fs.status, final: fs.final, package: pkg.ok ? pkg.data : `${pkg.code} ${pkg.message}` };
const costC = await cost((q) => q.eq("story_id", WEDDING_EP).gte("created_at", t1));
budget.record(costC, "3k C final re-render + upload package", 0.02);
log(`C final: ${fs.status} · part ${fs.final.partLabel} · end ${fs.final.endCard} · cover ${fs.final.coverUrl ? "yes" : "no"} · package ${pkg.ok ? "yes" : "no"} · $${costC.toFixed(4)}`);
save();
console.log(budget.summary());
