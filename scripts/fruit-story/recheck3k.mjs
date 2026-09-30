// Re-runs the picture check (with the library's exact fruit looks) on the 3
// "Caught at Dinner" pictures and the 3 "Caught At The Bar" pictures (≈ $0.007).
// A picture that now passes has its (false) "failed" flag cleared.
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/recheck3k.mjs
import { openBudget } from "./paidGuard.mjs";
import { admin, userSession, writeJson } from "./lib.mjs";
import { checkPicture } from "../../supabase/functions/_shared/fruit/pictureCheck.js";

const budget = openBudget("3k");
const { userId } = await userSession();
const db = admin();
const lib = new Map(((await db.from("fruit_characters").select("id, name, fruit")).data ?? []).map((c) => [c.id, c]));
const bar = (await db.from("fruit_stories").select("id").eq("title", "Caught At The Bar").order("created_at", { ascending: false }).limit(1)).data[0].id;
const out = [];
budget.reserve(0.02, "recheck");
let spent = 0;
for (const [label, storyId] of [["Caught at Dinner", "721f55be-3249-4d9f-9f31-c466d933831b"], ["Caught At The Bar", bar]]) {
  const { data: scenes } = await db.from("fruit_story_scenes").select("id, idx, present_ids, image_url, image_job_id, image_check").eq("story_id", storyId).order("idx");
  for (const sc of scenes) {
    const expected = sc.present_ids.map((id) => lib.get(id)).map((c) => ({ name: c.name, fruit: c.fruit }));
    const v = await checkPicture({ admin: db, apiKey: process.env.OPENAI_API_KEY, imageUrl: sc.image_url, expected, ids: { user_id: userId, story_id: storyId, scene_id: sc.id, job_id: sc.image_job_id } });
    spent += v.costUsd;
    if (v.ok && sc.image_check === "failed") await db.from("fruit_story_scenes").update({ image_check: "passed", image_check_notes: null }).eq("id", sc.id);
    out.push({ story: label, idx: sc.idx, imageUrl: sc.image_url, expected, before: sc.image_check, ok: v.ok, problems: v.problems, costUsd: v.costUsd });
    console.log(`${label} scene ${sc.idx + 1}: ${v.ok ? "passed" : `FAILED: ${v.problems.join("; ")}`}${sc.image_check === "failed" && v.ok ? " (false flag cleared)" : ""}`);
  }
}
budget.record(spent, "3k picture re-check with library looks", 0.02);
writeJson("data/fruit-phase3/3k-recheck.json", out);
console.log(budget.summary());
