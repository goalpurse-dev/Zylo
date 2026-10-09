// The avatar-library model test (owner, 2026-10-08): can FLUX.2 [klein] 9B draw the library's reference
// pictures as well as Nano Banana Pro, at about a hundredth of the price?
//   1. Noob, Vex and Lux, FOUR pictures each on Klein, with the reference prompt (roster.mjs#avatarPrompt:
//      body construction, cube head with flat faces, front view, flat mouth with no tongue, blocky hair and
//      accessories).
//   2. Every picture goes through the reference check (avatarCheck.js); the best of each four is picked by
//      its score. The three Pro pictures in the library today get the same check, for the comparison.
//   3. ONE scene picture (the first real story's scene 2: Vex speaking, Noob listening) made by the real
//      builder with the picked Klein pictures as the references, to see whether they hold up in a scene.
// Nobody is charged credits (the worker's no-charge test actions; every call is logged with its real cost).
// ONE attempt per item: an item that was sent is never sent again (a request refused before it reached the
// model is not an attempt). The library itself is not touched.
//   node scripts/blocky/testAvatarModels.mjs                       prints the plan, sends nothing
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/testAvatarModels.mjs   runs it (about $0.12; stage cap $0.30)
import fs from "fs";
import path from "path";
import { ROOT, admin, rawTest, worker, writeJson } from "./lib.mjs";
import { openBlockyBudget, paidCallsAllowed } from "./paidGuard.mjs";
import { ROSTER, avatarPrompt } from "./roster.mjs";
import { pickBest } from "../../supabase/functions/_shared/blocky/avatarCheck.js";

const OUT = "data/blocky-tests/klein";
const DIR = path.join(ROOT, OUT);
const FILE = path.join(DIR, "results.json");
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { items: {}, checks: {}, picked: {}, scene: null };
const save = () => writeJson(`${OUT}/results.json`, out);
const db = admin();
const KLEIN = { label: "FLUX.2 [klein] 9B", model: process.env.BLOCKY_KLEIN_MODEL || "runware:400@2", expectUsd: 0.005 };
const IDS = ["noob", "vex", "lux"];
const VERSIONS = 4;
const STORY = "e12c6d68-5aac-4fe0-ac15-20ad9696c222";
const byId = (id) => ROSTER.find((a) => a.id === id);
const avatarFor = (a) => ({ name: a.name, head: a.head, torso: a.torso, legs: a.legs, accessory: a.accessory, face: a.face });

const items = IDS.flatMap((id, i) => Array.from({ length: VERSIONS }, (_, k) => ({
  key: `klein-${id}-${k + 1}`, id,
  // A FLUX.2 [klein] 9B picture: 4 steps (it is a 4-step model), 768×1376 like the library's references, a fixed seed per picture.
  task: { taskType: "imageInference", model: KLEIN.model, positivePrompt: avatarPrompt(byId(id)), width: 768, height: 1376, steps: 4, seed: 7100 + i * 10 + k, numberResults: 1, outputType: "URL", outputFormat: "JPG" },
})));

if (!paidCallsAllowed()) {
  console.log(`Nothing was sent. Plan: ${items.length} pictures on ${KLEIN.label} (${KLEIN.model}), ${items.length + IDS.length} reference checks, 1 scene picture. About $0.12.`);
  console.log(`\nThe reference prompt (Vex, ${avatarPrompt(byId("vex")).length} characters):\n${avatarPrompt(byId("vex"))}`);
  process.exit(0);
}
fs.mkdirSync(DIR, { recursive: true });
const budget = openBlockyBudget("klein");
const set = async (on) => { const { error } = await db.from("blocky_settings").update({ paid_calls: on }).eq("id", true); if (error) throw new Error(error.message); };
const refused = (row) => row?.state === "refused" || (row?.state === "error" && !row.cost && /conflictParameters|invalid|unsupported|missing|not allowed|notFound|unknown/i.test(row.error ?? ""));
const attempted = (row) => row && ["success", "error", "timeout"].includes(row.state) && !refused(row);
const download = async (url, file) => fs.writeFileSync(path.join(DIR, file), Buffer.from(await (await fetch(url)).arrayBuffer()));

async function picture(it) {
  if (attempted(out.items[it.key])) return out.items[it.key];
  budget.reserve(KLEIN.expectUsd, it.key);
  out.items[it.key] = { key: it.key, id: it.id, model: it.task.model, seed: it.task.seed, state: "sent", at: new Date().toISOString() }; save();
  const r = await rawTest(it.task, `blocky-klein-${it.key}`, { everyMs: 1500, timeoutMs: 3 * 60_000 });
  const row = Object.assign(out.items[it.key], { state: r.state, cost: r.cost, seconds: r.seconds, error: r.error ?? null, url: r.url ?? null });
  budget.record(r.cost, `klein: ${it.key} (${r.state})`, KLEIN.expectUsd);
  if (r.url) { row.file = `${it.key}.jpg`; await download(r.url, row.file); }
  save();
  console.log(`${it.key}: ${r.state} $${r.cost.toFixed(5)} in ${r.seconds}s${r.error ? ` (${r.error})` : ""}`);
  return row;
}
async function check(key, id, imageUrl) {
  if (out.checks[key]?.verdict || out.checks[key]?.error) return out.checks[key];
  budget.reserve(0.004, `check ${key}`);
  const r = await worker({ action: "avatar_check_test", imageUrl, avatar: avatarFor(byId(id)) });
  out.checks[key] = r.ok ? { answer: r.answer, verdict: r.verdict, cost: r.costUsd } : { error: `${r.code}: ${r.message}`, cost: 0 };
  budget.record(r.ok ? r.costUsd : 0, `klein: check ${key}`, 0.004);
  save();
  console.log(`check ${key}: ${r.ok ? `${r.verdict.score}${r.verdict.ok ? "" : " (fails)"} ${r.verdict.problems.join("; ")}` : out.checks[key].error}`);
  return out.checks[key];
}

await set(true);
try {
  // 1. The pictures: the first one alone (a wrong model id or setting is refused here, for nothing), then the rest together.
  const first = await picture(items[0]);
  if (first.state !== "success") throw new Error(`the first Klein picture did not come out: ${first.error}`);
  await Promise.all(items.slice(1).map(picture));
  // 2. The checks: every Klein picture, and the library's Pro pictures.
  const { data: library } = await db.from("blocky_characters").select("id, ref_image_url").in("id", IDS);
  await Promise.all([
    ...items.filter((it) => out.items[it.key]?.url).map((it) => check(it.key, it.id, out.items[it.key].url)),
    ...library.map((c) => check(`pro-${c.id}`, c.id, c.ref_image_url)),
  ]);
  for (const c of library) { out.items[`pro-${c.id}`] = { key: `pro-${c.id}`, id: c.id, model: "google:4@2", url: c.ref_image_url, file: `pro-${c.id}.jpg`, state: "library" }; if (!fs.existsSync(path.join(DIR, `pro-${c.id}.jpg`))) await download(c.ref_image_url, `pro-${c.id}.jpg`); }
  for (const id of IDS) {
    const keys = items.filter((it) => it.id === id).map((it) => it.key);
    const best = pickBest(keys.map((k) => out.checks[k]?.verdict ?? null));
    out.picked[id] = best >= 0 ? keys[best] : null;
  }
  save();
  // 3. One scene with the picked Klein pictures as the references.
  if (!out.scene && out.picked.noob && out.picked.vex) {
    const { data: sc } = await db.from("blocky_story_scenes").select("id, image_url").eq("story_id", STORY).eq("idx", 1).single();
    budget.reserve(0.05, "scene");
    const sent = await worker({ action: "picture_test", sceneId: sc.id, refOverrides: Object.fromEntries(IDS.filter((id) => out.picked[id]).map((id) => [id, out.items[out.picked[id]].url])) });
    out.scene = { state: sent.ok ? "sent" : "error", error: sent.ok ? null : sent.error ?? `${sent.code}: ${sent.message}`, proSceneUrl: sc.image_url, at: new Date().toISOString() }; save();
    let cost = 0;
    if (sent.ok) {
      for (let i = 0; i < 60 && out.scene.state === "sent"; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const r = await worker({ action: "raw_poll", taskUUID: sent.taskUUID, callId: sent.callId, kind: "image" });
        if (r.state === "success") { cost = Number(r.cost ?? 0); Object.assign(out.scene, { state: "success", url: r.url, cost, file: "scene-klein.jpg" }); await download(r.url, "scene-klein.jpg"); await download(sc.image_url, "scene-pro.jpg"); }
        else if (r.state === "error") { cost = Number(r.cost ?? 0); Object.assign(out.scene, { state: "error", error: r.error, cost }); }
      }
    }
    budget.record(cost, `klein: scene with Klein references (${out.scene.state})`, 0.05);
    save();
    console.log(`scene: ${out.scene.state} $${cost.toFixed(4)}${out.scene.error ? ` (${out.scene.error})` : ""}`);
  }
} finally {
  await set(false);
}
const spent = [...Object.values(out.items), ...Object.values(out.checks), out.scene ?? {}].reduce((n, r) => n + (Number(r.cost) || 0), 0);
console.log(`\nPicked: ${IDS.map((id) => `${id} → ${out.picked[id] ?? "none"} (${out.checks[out.picked[id]]?.verdict?.score ?? "-"}; Pro ${out.checks[`pro-${id}`]?.verdict?.score ?? "-"})`).join(", ")}\nSpent on this test: $${spent.toFixed(4)}`);
