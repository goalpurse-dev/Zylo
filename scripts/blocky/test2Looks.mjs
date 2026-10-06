// Blocky Stories tests 2 and 3: the look.
//   Test 2 (avatars): 6 reference pictures on Nano Banana 2 Lite, half with the
//     "Roblox-style" wording and half with "blocky toy figure", and 3 of the same
//     prompts on Nano Banana Pro, so Lite vs Pro differs by the model only.
//   Test 3 (scenes): one location plate, then 4 scene pictures set in it, built by
//     the real picture builder with the Lite avatars and the plate as references.
// Nobody is charged credits (runware-bakeoff-proxy). ONE attempt per item: an
// item already in results.json is never sent again. A model the proxy doesn't
// accept yet is not an attempt: it stays "waiting".
//   node scripts/blocky/test2Looks.mjs                                    prints the plan, sends nothing
//   FRUIT_ALLOW_PAID=1 node scripts/blocky/test2Looks.mjs avatars         test 2
//   FRUIT_ALLOW_PAID=1 node scripts/blocky/test2Looks.mjs scenes [cast]   test 3 (cast: 4 avatar ids from test 2, default noob,vex,lux,tank)
import fs from "fs";
import path from "path";
import { openBlockyBudget, paidCallsAllowed } from "../fruit-story/paidGuard.mjs";
import { ROOT, SUPABASE_URL, writeJson } from "../fruit-story/lib.mjs";
import { ROSTER, avatarPrompt } from "./roster.mjs";
import { buildPictureRequest } from "../../supabase/functions/_shared/fruit/pictures.js";
import { platePrompt } from "../../supabase/functions/_shared/fruit/plates.js";

const OUT = "data/blocky-tests/test2";
const RESULTS = path.join(ROOT, OUT, "results.json");
const LITE = { key: "lite", label: "Nano Banana 2 Lite", model: "google:nano-banana@2-lite", expectUsd: 0.04 };
const PRO = { key: "pro", label: "Nano Banana Pro", model: "google:4@2", expectUsd: 0.15 };
const byId = (id) => ROSTER.find((a) => a.id === id);

// Test 2. The noob is drawn with both wordings (it is the one that came out as a brick-toy figure in test 1).
const AVATARS = [
  ...[["noob", "roblox"], ["vex", "roblox"], ["pixi", "roblox"], ["noob", "toy"], ["lux", "toy"], ["tank", "toy"]].map(([id, style]) => ({ key: `${id}-${style}-lite`, id, style, engine: LITE })),
  // The same three prompts on Pro.
  ...[["noob", "roblox"], ["vex", "roblox"], ["lux", "toy"]].map(([id, style]) => ({ key: `${id}-${style}-pro`, id, style, engine: PRO })),
].map((x) => ({ ...x, kind: "avatar", prompt: avatarPrompt(byId(x.id), x.style) }));

// Test 3. One place, four scenes: solo, two avatars, three avatars, and two again with a strong emotion.
const PLACE = { id: "loc1", description: "A trading plaza with plain market stalls, stacked plain crates and a round fountain built from blocks", timeOfDay: "midday", lighting: "bright even daylight" };
const SCENES = (cast) => [
  { id: "s1", name: "Solo close-up", speakerId: cast[1], presentIds: [cast[1]], action: "points one block arm straight ahead", emotion: "icy calm", shot: "close-up" },
  { id: "s2", name: "Two avatars", speakerId: cast[0], presentIds: [cast[0], cast[1]], action: "holds up a small glowing gold cube", emotion: "panicked", shot: "chest-up", placement: `${byId(cast[0]).name} stands by the fountain; ${byId(cast[1]).name} stands behind, by a stall` },
  { id: "s3", name: "Three avatars", speakerId: cast[2], presentIds: [cast[2], cast[0], cast[3]], action: "raises one block arm to show off", emotion: "smug", shot: "chest-up" },
  { id: "s4", name: "Two avatars, strong emotion", speakerId: cast[3], presentIds: [cast[3], cast[2]], action: "throws both block arms up", emotion: "furious", shot: "medium close-up" },
].map((s) => ({ ...s, locationId: PLACE.id }));

const [mode, castArg] = process.argv.slice(2);
const cast = (castArg ?? "noob,vex,lux,tank").split(",");
if (cast.length !== 4 || cast.some((id) => !byId(id))) throw new Error("cast: four avatar ids from the roster");

if (!paidCallsAllowed() || !["avatars", "scenes"].includes(mode)) {
  for (const a of AVATARS) console.log(`avatar ${a.key.padEnd(18)} ${a.engine.label.padEnd(20)} ${a.prompt.length} chars`);
  console.log(`\nplate: ${platePrompt(PLACE.description, "9:16", "blocky")}\n`);
  for (const s of SCENES(cast)) console.log(`scene ${s.id}: ${s.name}: ${s.presentIds.join(", ")} (${s.emotion})`);
  console.log(`\nNothing was sent. Avatars: 6 on Lite (about $0.20) and 3 on Pro (about $0.44). Scenes: 1 plate + 4 pictures on Lite (about $0.17).\nRun with FRUIT_ALLOW_PAID=1 and "avatars" or "scenes".`);
  process.exit(0);
}

const budget = openBlockyBudget("looks");
const out = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : { items: {}, notes: [] };
const save = () => writeJson(`${OUT}/results.json`, out);
const log = (m) => { console.log(m); out.notes.push(m); };

/** One picture through the proxy. Returns the row (state: success | failed | waiting). */
async function picture(key, meta, task, engine) {
  if (out.items[key]) return out.items[key];   // one attempt per item
  budget.reserve(engine.expectUsd, key);
  const row = (out.items[key] = { key, ...meta, model: engine.model, engine: engine.key, prompt: task.positivePrompt, references: task.inputs?.referenceImages?.length ?? 0, state: "sent", at: new Date().toISOString() });
  save();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ task: { ...task, model: engine.model, numberResults: 1, outputType: "URL", outputFormat: "JPG", outputQuality: 95, deliveryMethod: "sync" } }),
  });
  const r = await res.json().catch(() => ({ ok: false, error: "bad response" }));
  if (res.status === 400 && /not allowed/.test(JSON.stringify(r))) {
    // The proxy refused the model before anything was sent: not an attempt.
    delete out.items[key];
    budget.record(0, `${key}: proxy doesn't accept ${engine.model} yet`, engine.expectUsd);
    save();
    log(`${key}: waiting, the picture proxy doesn't accept ${engine.label} yet (nothing sent, $0)`);
    return { key, state: "waiting" };
  }
  const got = r.result ?? {};
  if (!r.ok || !got.imageURL) Object.assign(row, { state: "failed", error: JSON.stringify(r.error ?? r).slice(0, 400), cost: Number(got.cost ?? 0) });
  else {
    Object.assign(row, { state: "success", url: got.imageURL, cost: Number(got.cost ?? 0), seconds: Math.round((r.latencyMs ?? 0) / 1000), file: `${key}.jpg` });
    fs.mkdirSync(path.join(ROOT, OUT), { recursive: true });
    fs.writeFileSync(path.join(ROOT, OUT, row.file), Buffer.from(await (await fetch(got.imageURL)).arrayBuffer()));
  }
  budget.record(row.cost, `looks ${key}${row.state === "failed" ? " (failed)" : ""}`, engine.expectUsd);
  save();
  log(`${key}: ${row.state} $${row.cost.toFixed(4)}${row.error ? ` · ${row.error}` : ""}`);
  return row;
}

if (mode === "avatars") {
  for (const a of AVATARS) {
    await picture(a.key, { kind: "avatar", id: a.id, style: a.style }, { taskType: "imageInference", positivePrompt: a.prompt, width: 768, height: 1376 }, a.engine);
  }
}

if (mode === "scenes") {
  // The Lite reference of each cast member (the "Roblox-style" one when there are two).
  const refOf = (id) => out.items[`${id}-roblox-lite`]?.url ?? out.items[`${id}-toy-lite`]?.url;
  if (cast.some((id) => !refOf(id))) throw new Error("run the avatars first: a cast member has no Lite reference picture");
  const plate = await picture("plate", { kind: "plate", description: PLACE.description }, { taskType: "imageInference", positivePrompt: platePrompt(PLACE.description, "9:16", "blocky"), width: 768, height: 1376 }, LITE);
  if (plate.state !== "success") { log("scenes: skipped, no plate"); } else {
    const library = new Map(cast.map((id) => { const a = byId(id); return [id, { id, name: a.name, niche: "blocky", fruit: "avatar", gender: null, age: null, tag: a.tag, role: a.role, build: a.face, outfit: a.look, voice_style: a.voice, ref_image_url: refOf(id) }]; }));
    const story = { niche: "blocky", aspect: "9:16", outfits: {}, locations: [{ ...PLACE, plateUrl: plate.url }] };
    for (const scene of SCENES(cast)) {
      const built = buildPictureRequest({ story, scene, library, mode: "new" });   // the real builder: this is the prompt a story would send
      await picture(`scene-${scene.id}`, { kind: "scene", name: scene.name, speakerId: scene.speakerId, presentIds: scene.presentIds, emotion: scene.emotion, shot: scene.shot }, { taskType: "imageInference", positivePrompt: built.request.positivePrompt, width: built.request.width, height: built.request.height, inputs: built.request.inputs }, LITE);
    }
  }
}
console.log(budget.summary());
