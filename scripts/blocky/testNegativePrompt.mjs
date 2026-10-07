// ONE test clip (approved 2026-10-08, about $0.20): does Runware accept a negative prompt on Wan 2.6 Flash?
// The request is the first real story's scene-1 clip request, word for word, plus the negative prompt the
// engine now adds (clips.js#NO_DRAWN_TEXT). Sent through blocky-worker's test action: no user charge, logged
// with its real cost. Paid calls are switched on for this one call and off again whatever happens.
// ONE attempt: a result already on record is never sent again.
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/testNegativePrompt.mjs
import fs from "fs";
import path from "path";
import { ROOT, admin, rawTest, writeJson } from "./lib.mjs";
import { openBlockyBudget } from "./paidGuard.mjs";
import { NO_DRAWN_TEXT } from "../../supabase/functions/_shared/blocky/clips.js";

const OUT = "data/blocky-tests/captions";
const RESULT = path.join(ROOT, OUT, "result.json");
if (fs.existsSync(RESULT)) { console.log("Already run:", fs.readFileSync(RESULT, "utf8").slice(0, 400)); process.exit(0); }
const db = admin();
const STORY = "e12c6d68-5aac-4fe0-ac15-20ad9696c222";
const { data: scene } = await db.from("blocky_story_scenes").select("clip_job_id, line").eq("story_id", STORY).eq("idx", 0).single();
const { data: job } = await db.from("blocky_jobs").select("request").eq("id", scene.clip_job_id).single();
const task = { ...job.request, negativePrompt: NO_DRAWN_TEXT };
for (const k of ["taskUUID", "webhookURL", "deliveryMethod", "includeCost"]) delete task[k];
const expectUsd = 0.0504 * task.duration + 0.02;
console.log(`Wan 2.6 Flash, ${task.duration} s, with negativePrompt (${NO_DRAWN_TEXT.length} characters). Expected about $${(0.0504 * task.duration).toFixed(2)}.`);
const budget = openBlockyBudget("captions");
budget.reserve(expectUsd, "negative prompt test clip");
const set = async (on) => { const { error } = await db.from("blocky_settings").update({ paid_calls: on }).eq("id", true); if (error) throw new Error(error.message); };
let r;
await set(true);
try {
  r = await rawTest(task, "blocky-negative-prompt");
} finally {
  await set(false);
}
budget.record(r.cost, `negative prompt test clip (${r.state})`, expectUsd);
const out = { at: new Date().toISOString(), line: scene.line, model: task.model, durationSec: task.duration, negativePrompt: task.negativePrompt, state: r.state, cost: r.cost, seconds: r.seconds, error: r.error ?? null, url: r.url ?? null };
if (r.url) { fs.mkdirSync(path.join(ROOT, OUT), { recursive: true }); fs.writeFileSync(path.join(ROOT, OUT, "clip.mp4"), Buffer.from(await (await fetch(r.url)).arrayBuffer())); }
writeJson(`${OUT}/result.json`, out);
console.log(JSON.stringify(out, null, 1));
console.log(budget.summary());
const { data: paid } = await db.rpc("blocky_paid_state", { p_add_usd: 0 });
console.log(`Paid calls are ${paid.paid_calls ? "ON (!)" : "OFF"} again.`);
