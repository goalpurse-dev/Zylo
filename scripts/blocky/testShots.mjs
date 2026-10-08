// Shot variety, tested on ONE story's pictures (owner, 2026-10-08; at most $1):
//   1. one 30-second script from the writer (text only), whose scenes carry the shots it picked and
//      shots.js#directShots made sure of;
//   2. every scene's picture, built by the real picture builder for that scene's own shot, with the live
//      library's reference pictures;
//   3. the picture check on each, judged against its own shot; a picture that fails is drawn ONCE more with
//      the check's fix, as the product does.
// Nobody is charged credits and no story is created (the worker's no-charge test actions; every call is
// logged with its real cost). ONE attempt per item: nothing that was sent is sent again.
//   node scripts/blocky/testShots.mjs                       prints the plan, sends nothing
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/testShots.mjs   runs it (about $0.40; stage cap $1)
import fs from "fs";
import path from "path";
import { ROOT, admin, rawTest, worker, writeJson } from "./lib.mjs";
import { openBlockyBudget, paidCallsAllowed } from "./paidGuard.mjs";
import { BLOCKY_MODELS } from "../../supabase/functions/_shared/blocky/models.js";
import { buildPictureRequest, withRedrawHint } from "../../supabase/functions/_shared/blocky/pictures.js";
import { inFrameIds } from "../../supabase/functions/_shared/blocky/shots.js";

const OUT = "data/blocky-tests/shots";
const DIR = path.join(ROOT, OUT);
const FILE = path.join(DIR, "results.json");
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { story: null, scenes: {} };
const save = () => writeJson(`${OUT}/results.json`, out);
const INPUT = { source: "prompt", castIds: ["noob", "vex", "lux"], prompt: "Vex blocks the last jump of the obby tower and makes Noob pay coins to pass, until Lux, who built the tower, climbs up behind them.", quality: "v2", lengthSec: 30, aspect: "9:16" };

if (!paidCallsAllowed()) {
  console.log(`Nothing was sent. Plan: one 30-second script (about $0.15), one picture a scene on ${BLOCKY_MODELS.image.air} (about $0.035 each), one check each, one redraw for a picture that fails. About $0.40.\nStory: ${INPUT.prompt}`);
  process.exit(0);
}
fs.mkdirSync(DIR, { recursive: true });
const budget = openBlockyBudget("shots");
const db = admin();
const { data: before } = await db.from("blocky_settings").select("paid_calls").eq("id", true).single();
const set = async (on) => { const { error } = await db.from("blocky_settings").update({ paid_calls: on }).eq("id", true); if (error) throw new Error(error.message); };
const { data: rows } = await db.from("blocky_characters").select("*").eq("active", true);
const library = new Map(rows.map((c) => [c.id, c]));
let spent = 0;

if (!before.paid_calls) await set(true);
try {
  // 1. The script.
  if (!out.story) {
    budget.reserve(0.3, "script");
    const r = await worker({ action: "planner_test", model: BLOCKY_MODELS.planner, input: INPUT });
    budget.record(Number(r.costUsd ?? 0), `shots: the script (${r.ok ? "ok" : r.code})`, 0.3);
    spent += Number(r.costUsd ?? 0);
    out.story = r.ok ? { state: "success", cost: r.costUsd, title: r.plan.title, locations: r.plan.locations, scenes: r.plan.scenes } : { state: "failed", error: `${r.code}: ${r.message}`, cost: Number(r.costUsd ?? 0) };
    save();
  }
  if (out.story.state !== "success") throw new Error(`no script: ${out.story.error}`);
  console.log(`"${out.story.title}": ${out.story.scenes.map((s) => s.shot).join(" → ")}`);

  // 2 and 3. Every scene's picture and its check; one redraw with the check's fix.
  const story = { aspect: "9:16", locations: out.story.locations };
  async function draw(key, request) {
    if (out.scenes[key]) return out.scenes[key];
    budget.reserve(0.04, key);
    const row = (out.scenes[key] = { key, state: "sent", prompt: request.positivePrompt, at: new Date().toISOString() });
    save();
    const r = await rawTest(request, `blocky-shots-${key}`, { everyMs: 2500, timeoutMs: 4 * 60_000 });
    Object.assign(row, { state: r.state, cost: r.cost, seconds: r.seconds, url: r.url ?? null, error: r.error ?? null });
    budget.record(r.cost, `shots: ${key} (${r.state})`, 0.04);
    spent += r.cost;
    if (r.url) { row.file = `${key}.jpg`; fs.writeFileSync(path.join(DIR, row.file), Buffer.from(await (await fetch(r.url)).arrayBuffer())); }
    save();
    return row;
  }
  async function check(row, scene) {
    if (!row.url || row.verdict) return row.verdict ?? null;
    budget.reserve(0.004, `check ${row.key}`);
    const ids = inFrameIds(scene);
    const r = await worker({ action: "picture_check_test", imageUrl: row.url, expected: ids.map((id) => ({ name: library.get(id).name, look: library.get(id).look })), speaker: library.get(scene.speakerId).name, shot: scene.shot });
    budget.record(r.ok ? Number(r.costUsd ?? 0) : 0, `shots: check ${row.key}`, 0.004);
    spent += r.ok ? Number(r.costUsd ?? 0) : 0;
    row.verdict = r.ok ? { ok: r.ok === true && r.problems.length === 0, problems: r.problems, fixes: r.fixes } : { ok: null, problems: [`the check did not run: ${r.code}`], fixes: [] };
    save();
    return row.verdict;
  }
  await Promise.all(out.story.scenes.map(async (scene, i) => {
    const built = buildPictureRequest({ story, scene, library, mode: "new" });
    const first = await draw(`scene-${i + 1}`, built.request);
    const v = await check(first, scene);
    console.log(`scene ${i + 1} (${scene.shot}): ${first.state}${v ? (v.ok ? ", passes" : `, fails: ${v.problems.join("; ")}`) : ""}`);
    if (v && v.ok === false && v.fixes.length) {
      const again = await draw(`scene-${i + 1}-redraw`, { ...built.request, positivePrompt: withRedrawHint(built.request.positivePrompt, v.fixes) });
      const v2 = await check(again, scene);
      console.log(`scene ${i + 1} redrawn: ${again.state}${v2 ? (v2.ok ? ", passes" : `, fails: ${v2.problems.join("; ")}`) : ""}`);
    }
  }));
} finally {
  if (!before.paid_calls) await set(false);
}
console.log(`Spent in this run: $${spent.toFixed(4)}. ${budget.summary()}`);
