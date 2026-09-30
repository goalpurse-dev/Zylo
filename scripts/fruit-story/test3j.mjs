// Stage 3j: framing re-check on the 30 s story's weak pictures (scenes 1 and 6
// came out full body; scene 5 was over-the-shoulder with a human listener).
// Each scene is re-drawn with TODAY's picture builder through the worker's
// admin picture_test (no user charge, story untouched, every call logged).
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/test3j.mjs
import fs from "fs";
import { openBudget } from "./paidGuard.mjs";
import { admin, writeJson, ROOT, SUPABASE_URL } from "./lib.mjs";

const budget = openBudget("3j");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const storyId = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/full30-results.json`, "utf8")).storyId;
const db = admin();
const worker = async (body) => (await fetch(`${SUPABASE_URL}/functions/v1/fruit-worker`, {
  method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
})).json();
const { data: scenes } = await db.from("fruit_story_scenes").select("id, idx, speaker_id, present_ids, shot, image_url").eq("story_id", storyId).in("idx", [0, 4, 5]).order("idx");
const out = { storyId, redo: [] };
for (const sc of scenes) {
  budget.reserve(0.04, `scene ${sc.idx + 1}`);
  const r = await worker({ action: "picture_test", sceneId: sc.id });
  if (!r.ok) { budget.record(0, `3j scene ${sc.idx + 1} refused`, 0.04); console.log(`scene ${sc.idx + 1}: ${r.code ?? ""} ${r.message ?? r.error}`); continue; }
  let p;
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    p = await worker({ action: "raw_poll", taskUUID: r.taskUUID, callId: r.callId, kind: "image" });
    if (p.state !== "pending") break;
  }
  budget.record(Number(p?.cost ?? 0), `3j scene ${sc.idx + 1}`, 0.04);
  out.redo.push({ idx: sc.idx, speaker: sc.speaker_id, present: sc.present_ids, oldShot: sc.shot, oldUrl: sc.image_url, newUrl: p?.url ?? null, state: p?.state, error: p?.error ?? null, cost: Number(p?.cost ?? 0), prompt: r.prompt });
  console.log(`scene ${sc.idx + 1} (${sc.shot} → chest-up rules): ${p?.state} $${Number(p?.cost ?? 0).toFixed(4)}`);
}
writeJson("data/fruit-phase3/3j-results.json", out);
console.log(budget.summary());
