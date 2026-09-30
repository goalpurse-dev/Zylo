// Stage 3f: build the final video of the 3e "Glass Walls Don't Lie" story on a
// Fly machine through the real API (buildFinal → machine → fruit-worker), with
// captions. No new video: only the machine's compute (≈ $0.003).
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3f.mjs [--no-captions]
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson, ROOT } from "./lib.mjs";
import fs from "fs";

const budget = openBudget("3f");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// --story full30: the 30 s story; default: the 3e "Glass Walls" story.
const idArg = process.argv.find((x) => x.startsWith("--story-id="))?.slice(11);
const storyId = idArg ? idArg : process.argv.includes("--story=full30")
  ? JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/full30-results.json`, "utf8")).storyId
  : JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-results.json`, "utf8")).story.id;
const captions = !process.argv.includes("--no-captions");
const { accessToken } = await userSession();
const db = admin();

budget.reserve(0.02, "final machine");
const t0 = Date.now();
const r = await api(accessToken, "buildFinal", { storyId, captions });
if (!r.ok) { budget.record(0, "3f final refused", 0.02); console.log("refused:", r.code, r.message); process.exit(1); }
console.log("building:", r.data.status, r.data.final.status);
let story;
for (;;) {
  await sleep(5000);
  story = (await api(accessToken, "getStory", { storyId })).data;
  if (story.status !== "building" || Date.now() - t0 > 12 * 60_000) break;
}
const { data: calls } = await db.from("fruit_ai_calls").select("*").eq("story_id", storyId).eq("purpose", "final").order("created_at", { ascending: false }).limit(1);
const call = calls[0];
budget.record(Number(call.cost_usd ?? 0), `3f final (${captions ? "captions" : "no captions"})`, 0.02);
const out = { storyId, captions, status: story.status, final: story.final, wallSec: (Date.now() - t0) / 1000, call: { id: call.id, ok: call.ok, error: call.error, costUsd: Number(call.cost_usd), latencyMs: call.latency_ms, response: call.response, model: call.model } };
const words = (await db.from("fruit_ai_calls").select("scene_id, ok, cost_usd, response, created_at").eq("story_id", storyId).eq("purpose", "caption_words")).data ?? [];
out.captionWords = { calls: words.length, ok: words.filter((w) => w.ok).length, costUsd: words.reduce((a, w) => a + Number(w.cost_usd ?? 0), 0) };
// Word timestamps are logged when first made (and cached); only new ones are spend.
out.captionWords.newThisRun = words.filter((w) => new Date(w.created_at ?? 0) >= new Date(Date.now() - (Date.now() - t0) - 5000)).length;
writeJson(`data/fruit-phase3/3f-final${idArg ? `-${idArg.slice(0, 8)}` : process.argv.includes("--story=full30") ? "-full30" : ""}${captions ? "" : "-nocap"}.json`, out);
console.log(JSON.stringify(out, null, 1));
console.log(budget.summary());
