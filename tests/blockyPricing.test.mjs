// Blocky Stories: pricing.js is the one place for Blocky's models and prices (decision 73).
//   1. The credits in it are the credits the price rows charge (the rows as the migrations leave them; the
//      live rows are compared by scripts/blocky/smokeBlockyLive.mjs).
//   2. Nothing outside Blocky imports it, AI Fruit Story least of all, and it imports nothing itself.
//   3. The fallback chains are safe: they end, the next model can make the same clip, and every chain that
//      has a model agrees on what comes after it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIP_MODELS, CLIP_SIZES, PICTURE, PRICE_ROWS, SCRIPT, TIERS, TIER_IDS, modelByAir, nextModel, tierGuardPerSec, tierModel } from "../supabase/functions/_shared/blocky/pricing.js";
import { BLOCKY_MODELS, videoModel } from "../supabase/functions/_shared/blocky/models.js";
import { COST_USD } from "../supabase/functions/_shared/blocky/spendGuard.js";
import { clipTask, fallbackClipTask, firstFrameOf, GENTLE_CAMERA, LOCKED_CAMERA } from "../supabase/functions/_shared/blocky/clips.js";
import { TIERS as PAGE_TIERS, PICTURE_TOOL_KEY, SCRIPT_TOOL_KEY } from "../src/components/viral-tools/blocky-stories/pricing/blockyEstimates.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
function filesUnder(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [rel];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((e) => (["node_modules", "dist", ".temp"].includes(e.name) ? [] : filesUnder(`${rel}/${e.name}`)));
}

/** Blocky's price rows as the migrations leave them: the INSERTs, then any later UPDATE of a row, in file order. */
function rowsFromMigrations() {
  const rows = new Map();
  const num = (s) => (s == null || /^null$/i.test(s.trim()) ? null : Number(s));
  for (const file of fs.readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = read(`supabase/migrations/${file}`);
    for (const m of sql.matchAll(/INSERT INTO public\.tool_prices \(tool_key, credits_per_second, flat_credits,[^)]*\)\s*VALUES \('([a-z]+:blocky-story[a-z0-9-]*)',\s*([^,]+),\s*([^,]+),/g)) {
      if (!rows.has(m[1])) rows.set(m[1], { creditsPerSecond: num(m[2]), flatCredits: num(m[3]) });   // ON CONFLICT DO NOTHING: the first one stands
    }
    // One statement: SET … up to its own WHERE (a note may hold a semicolon, so the statement isn't cut at one).
    for (const m of sql.matchAll(/UPDATE public\.tool_prices\s+SET ((?:(?!WHERE tool_key)[\s\S])*?)\s+WHERE tool_key = '([a-z]+:blocky-story[a-z0-9-]*)'/g)) {
      const row = rows.get(m[2]) ?? {};
      const per = /credits_per_second = ([\d.]+|NULL)/i.exec(m[1]); const flat = /flat_credits = ([\d.]+|NULL)/i.exec(m[1]);
      if (per) row.creditsPerSecond = num(per[1]);
      if (flat) row.flatCredits = num(flat[1]);
      rows.set(m[2], row);
    }
  }
  return rows;
}

test("the credits in pricing.js are the credits the price rows charge", () => {
  const rows = rowsFromMigrations();
  assert.deepEqual([...rows.keys()].sort(), PRICE_ROWS.map((r) => r.toolKey).sort(), "one row per priced thing, and no row pricing.js doesn't know");
  for (const want of PRICE_ROWS) {
    const row = rows.get(want.toolKey);
    assert.equal(row.flatCredits, want.flatCredits ?? null, `${want.toolKey} flat credits`);
    assert.equal(row.creditsPerSecond, want.creditsPerSecond ?? null, `${want.toolKey} credits per second`);
  }
  assert.equal(PICTURE.credits, 4);
  assert.equal(SCRIPT.credits, 15);
  // The owner's option A (2026-10-08).
  assert.deepEqual(TIER_IDS.map((id) => TIERS[id].creditsPerSec), [4, 8, 16]);
});

test("the smoke check compares the same list with the live rows", () => {
  assert.match(read("scripts/blocky/smokeBlockyLive.mjs"), /PRICE_ROWS/);
});

test("nothing outside Blocky imports pricing.js, and it imports nothing", () => {
  assert.doesNotMatch(read("supabase/functions/_shared/blocky/pricing.js"), /^\s*import\s|\bimport\(|\brequire\(/m);
  const blocky = (f) => /^supabase\/functions\/(_shared\/blocky|blocky-[a-z-]+)\//.test(f) || f.startsWith("src/components/viral-tools/blocky-stories/") || /^render-worker\/src\/blocky/.test(f);
  const others = ["supabase/functions", "src", "render-worker/src", "api"].flatMap(filesUnder).filter((f) => /\.(js|jsx|mjs|ts|tsx)$/.test(f) && !blocky(f));
  assert.ok(others.length > 300, `the scan read the rest of the code (${others.length} files)`);
  const fruit = others.filter((f) => /fruit/i.test(f));
  assert.ok(fruit.length > 40, `AI Fruit Story's files are among them (${fruit.length})`);
  for (const f of others) assert.doesNotMatch(read(f), /blocky\/pricing|blocky-stories\/pricing/, `${f} reads Blocky's prices`);
});

test("the builders, the spend guard and the page all read pricing.js", () => {
  for (const id of TIER_IDS) {
    const m = videoModel(id);
    assert.equal(m.air, tierModel(id).air);
    assert.equal(m.toolKey, TIERS[id].toolKey);
    assert.deepEqual([...m.durations], [...tierModel(id).durations]);
    assert.equal(COST_USD.clipPerSec[id], tierGuardPerSec(id));
    assert.deepEqual({ toolKey: PAGE_TIERS[id].toolKey, minPlan: PAGE_TIERS[id].minPlan, durations: PAGE_TIERS[id].durations }, { toolKey: TIERS[id].toolKey, minPlan: TIERS[id].minPlan, durations: [...tierModel(id).durations] });
    assert.ok(PAGE_TIERS[id].durations.includes(PAGE_TIERS[id].quoteSec), `${id} is quoted at a length it can make`);
  }
  assert.equal(BLOCKY_MODELS.image.air, PICTURE.air);
  assert.equal(COST_USD.image, PICTURE.guardUsd);
  assert.equal(PICTURE_TOOL_KEY, PICTURE.toolKey);
  assert.equal(SCRIPT_TOOL_KEY, SCRIPT.toolKey);
});

test("the lineup (owner, 2026-10-08): V2 Grok → P-Video-2; V3 Veo 3.1 Lite → P-Video-2; V4 Veo 3.1 Fast → Veo 3.1 Lite → P-Video-2", () => {
  const airs = (id) => TIERS[id].chain.map((k) => CLIP_MODELS[k].air);
  assert.deepEqual(airs("v2"), ["xai:grok-imagine@video-1.5-lite", "prunaai:p-video@2"]);
  assert.deepEqual(airs("v3"), ["google:veo@3.1-lite", "prunaai:p-video@2"]);
  assert.deepEqual(airs("v4"), ["google:3@3", "google:veo@3.1-lite", "prunaai:p-video@2"]);
  assert.ok(!Object.values(CLIP_MODELS).some((m) => /wan|seedance|bytedance/i.test(m.air)), "no Wan, no Seedance, no upscaler");
  // V4's last try is at another provider than its first two.
  assert.notEqual(airs("v4").at(-1).split(":")[0], airs("v4")[0].split(":")[0]);
});

test("the chains are safe: they end, the next model can make the same clip, and every chain agrees on what comes next", () => {
  for (const id of TIER_IDS) {
    const chain = TIERS[id].chain.map((k) => CLIP_MODELS[k]);
    assert.equal(new Set(chain).size, chain.length, `${id}: no model twice`);
    assert.ok(chain.length >= 2, `${id}: no tier is left without a second try`);
    chain.forEach((m, i) => {
      if (chain[i + 1]) assert.equal(nextModel(m.air)?.air, chain[i + 1].air, `${id}: after ${m.name} comes ${chain[i + 1].name}, in every chain that has it`);
      if (chain[i + 1]) for (const d of m.durations) assert.ok(chain[i + 1].durations.includes(d), `${chain[i + 1].name} can make a ${d} s clip`);
    });
    assert.equal(nextModel(chain.at(-1).air), null, `${id}: the last model has no next one`);
  }
  assert.equal(modelByAir("alibaba:wan@2.6-flash"), null);
});

test("a clip request per model, and the request that follows it when it fails", () => {
  const args = { prompt: "Vex says: \"No.\" Camera: a slow push-in toward the speaker. One continuous shot.", imageUrl: "https://example.test/scene.jpg", aspect: "9:16", durationSec: 6 };
  const grok = clipTask({ quality: "v2", ...args });
  assert.deepEqual(grok, { taskType: "videoInference", model: "xai:grok-imagine@video-1.5-lite", positivePrompt: args.prompt, duration: 6, numberResults: 1, outputType: "URL", outputFormat: "MP4", resolution: "720p", inputs: { frameImages: [{ image: args.imageUrl, frame: "first" }] } });
  assert.ok(!("width" in grok) && !("height" in grok), "Grok refuses a size next to a frame image");
  const afterGrok = fallbackClipTask(grok);
  assert.equal(afterGrok.model, "prunaai:p-video@2");
  assert.deepEqual({ resolution: afterGrok.resolution, settings: afterGrok.settings, duration: afterGrok.duration, frame: firstFrameOf(afterGrok) }, { resolution: "720p", settings: { audio: true }, duration: 6, frame: args.imageUrl });
  assert.ok(afterGrok.positivePrompt.includes(`Camera: ${GENTLE_CAMERA}.`) && afterGrok.positivePrompt.endsWith("One continuous shot."), "its own camera wording, the rest untouched");
  assert.equal(fallbackClipTask(afterGrok), null, "P-Video-2 is the last try");

  const lite = clipTask({ quality: "v3", ...args });
  assert.deepEqual({ model: lite.model, width: lite.width, height: lite.height, google: lite.providerSettings.google, frame: firstFrameOf(lite) }, { model: "google:veo@3.1-lite", width: 720, height: 1280, google: { generateAudio: true, enhancePrompt: false }, frame: args.imageUrl });
  assert.equal(fallbackClipTask(lite).model, "prunaai:p-video@2");

  const fast = clipTask({ quality: "v4", ...args });
  assert.deepEqual({ model: fast.model, fps: fast.fps, frame: firstFrameOf(fast) }, { model: "google:3@3", fps: 24, frame: args.imageUrl });
  const second = fallbackClipTask(fast);
  assert.deepEqual({ model: second.model, width: second.width, height: second.height, duration: second.duration }, { model: "google:veo@3.1-lite", width: 720, height: 1280, duration: 6 });
  assert.ok(second.positivePrompt.includes(`Camera: ${LOCKED_CAMERA}.`));
  const third = fallbackClipTask(second);
  assert.equal(third.model, "prunaai:p-video@2");
  assert.equal(fallbackClipTask(third), null);
  // A wide story keeps its shape on the way down.
  const wide = fallbackClipTask(clipTask({ quality: "v4", ...args, aspect: "16:9" }));
  assert.deepEqual([wide.width, wide.height], CLIP_SIZES["16:9"]);
});
