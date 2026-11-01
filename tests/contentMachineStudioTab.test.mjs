// Content Machine: the Studio tab (owner, 2026-10-30). Reuse first, the cost before anything starts, a paid
// generation only after the owner's go, the learning rule (3 winners + one-change experiments), the Studio score,
// the moments of a real result, and the short-video scripts (no time claim without a measurement).
import test from "node:test";
import assert from "node:assert/strict";
import { planRecipes, retiredAngles, anglesFromPrompt, studioScore, sceneFilter, rankSources, templateFromPrompt, pickTemplate, studioEstimate, workerState } from "../supabase/functions/_shared/contentMachine/studio.js";
import { analytics } from "../supabase/functions/_shared/contentMachine/analytics.js";
import { cleanStats, STAT_FIELDS } from "../supabase/functions/_shared/contentMachine/statsReader.js";
import { pickMoments } from "../scripts/studio/moments.js";
import { makeScript, titleHook, TEN_YEARS } from "../scripts/studio/shortScripts.mjs";
import { fakeWorld, apiFor } from "./helpers/contentMachineFakes.mjs";

const NOW = new Date("2026-10-30T12:00:00Z");
const ANGLES = [["A1", "45-60"], ["A2", "30-45"], ["A3", "45-60"], ["A4", "20-35"], ["A5", "20-35"], ["A6", "60-90"], ["A7", "30-45"], ["A8", "30-45"]].map(([key, length_bucket], sort) => ({ key, name: `Angle ${key}`, length_bucket, sort, status: "active", hooks: [`hook ${key}`] }));
const story = (id, title, days, lines = ["Hi.", "Oh no!"], over = {}) => ({ id, title, input: { source: "idea" }, length_sec: 30, final_url: `https://x/${id}.mp4`,
  created_at: new Date(NOW.getTime() - days * 864e5).toISOString(), scenes: lines.map((line, idx) => ({ idx, line, clip_status: "ready" })), ...over });

/** The admin API with an in-memory Studio: the owner's stories, jobs, the worker's heartbeat, posted Studio videos. */
function studioApi({ stories = [], others = {}, recent = {}, history = [], workers = [], settings = {} } = {}) {
  const world = fakeWorld({ studio_batch_size: 5, studio_rate_frame0: false, ...settings });
  world.clock = { now: NOW };
  const jobs = [];
  const extra = {
    async ownerCreations(template, email, since) { assert.equal(email, "upwardlift6@gmail.com"); return template === "ai_fruit_story" ? stories.filter((s) => s.created_at >= since) : (others[template] ?? []); },
    async studioSourceUse() { const o = {}; for (const j of jobs) if (j.source?.id && j.status !== "cancelled") o[j.source.id] = (o[j.source.id] ?? 0) + 1; return o; },
    async studioPostHistory() { return history; },
    async studioWorkers() { return workers; },
    async createStudioJobs(rows) { const out = rows.map((r, i) => ({ id: `J${jobs.length + i + 1}`, created_at: NOW.toISOString(), ...r })); jobs.push(...out); return out; },
    async updateStudioJob(id, patch, from) { const j = jobs.find((x) => x.id === id && from.includes(x.status)); if (!j) return null; Object.assign(j, patch); return j; },
    async listStudioJobs() { return [...jobs].reverse(); },
    async studioJobVideos() { return {}; },
    async studioRecentSources() { return recent; },
    async studioAngles() { return ANGLES; },
  };
  Object.assign(world.db, extra);
  const { call } = apiFor(world);
  return { call, jobs, world };
}

test("reuse first: the owner's finished stories of the last 30 days, a brand line skipped, least used first; $0 to generate", async () => {
  const { call, jobs } = studioApi({ stories: [story("S1", "Ken Reads Everything", 3, ["Ken!", "He reads it all?", "Ask Google."]), story("S2", "Old one", 70), story("S3", "Twenty Pairs", 10)] });
  const p = (await call({ action: "studioPlan", mode: "prompt", prompt: "a fruit story video" })).data;
  assert.equal(p.template, "ai_fruit_story");
  assert.equal(p.videos[0].source.id, "S1", "newest first");
  assert.deepEqual(p.videos[0].source.filter.skip, [2], "the line naming Google is skipped");
  assert.equal(p.estimate.generation_usd, 0);
  assert.ok(/no generation/i.test(p.estimate.why));
  assert.equal(p.count, 1);
  assert.equal(jobs.length, 0, "a plan starts nothing");
  const r = (await call({ action: "studioStart", mode: "prompt", prompt: "fruit" })).data;
  assert.equal(r.jobs[0].status, "queued");
  assert.equal(r.jobs[0].source.id, "S1");
  // the next plan prefers the one not used yet; "Old one" (over 60 days) is never offered
  assert.equal((await call({ action: "studioPlan", mode: "prompt", prompt: "fruit" })).data.videos[0].source.id, "S3");
  const b = (await call({ action: "studioPlan", mode: "ai_decide", count: 3 })).data;
  assert.equal(new Set(b.videos.map((v) => v.recipe.angle)).size, 3);
  assert.equal(b.videos.filter((v) => v.source.kind === "generate").length, 1, "two unused creations... S1 used once still counts; the third waits for a go");
});

test("nothing usable: the job waits for the owner's go with the cost; approve and cancel only from the right state", async () => {
  const { call, jobs } = studioApi({ stories: [story("S9", "Brands", 2, ["Google it", "On TikTok"])] });
  const p = (await call({ action: "studioPlan", mode: "ai_decide", count: 2 })).data;
  assert.equal(p.videos.every((v) => v.source.kind === "generate"), true);
  assert.ok(p.estimate.generation_usd > 1 && p.estimate.usd >= p.estimate.generation_usd);
  const r = (await call({ action: "studioStart", mode: "ai_decide", count: 2 })).data;
  assert.deepEqual(r.jobs.map((j) => j.status), ["waiting_go", "waiting_go"]);
  assert.equal((await call({ action: "studioApprove", id: jobs[0].id })).data.job.status, "queued");
  assert.equal((await call({ action: "studioApprove", id: jobs[0].id })).ok, false, "a queued job is not approved twice");
  assert.equal((await call({ action: "studioCancel", id: jobs[1].id })).data.job.status, "cancelled");
  jobs[0].status = "claimed";
  assert.equal((await call({ action: "studioCancel", id: jobs[0].id })).ok, false, "a running job can't be cancelled");
});

test("templates: typed names, parked ones refused, Let AI decide takes a ready one; the worker's state", async () => {
  assert.equal(templateFromPrompt("make an AI Fruit Story one"), "ai_fruit_story");
  assert.equal(templateFromPrompt("long form please"), "long_form");
  assert.equal(templateFromPrompt("hello"), null);
  const { call } = studioApi({ stories: [story("S1", "A", 1)] });
  const parked = await call({ action: "studioPlan", mode: "prompt", prompt: "clay rescue" });
  assert.equal(parked.ok, false); assert.match(parked.message, /facts/);
  assert.equal(pickTemplate([]), "ai_fruit_story");
  assert.equal((await call({ action: "studioPlan", mode: "ai_decide" })).data.count, 5, "a batch is studio_batch_size");
  assert.equal(workerState([], NOW).online, false);
  assert.equal(workerState([{ id: "w", last_seen: new Date(NOW.getTime() - 20_000).toISOString() }], NOW).online, true);
  assert.match(workerState([], NOW).note, /GPU server/);
  assert.equal(studioEstimate({ count: 5, reused: 5 }).generation_usd, 0);
});

test("a batch is different videos: angles least tried first, lengths mixed, worlds differ; 10+ posts = 3 winners + one-change experiments; retired angles go", () => {
  const first = planRecipes({ angles: ANGLES, n: 5 });
  assert.equal(new Set(first.map((r) => r.angle)).size, 5);
  assert.ok(first.some((r) => r.length_bucket === "60-90"), "a 60–90 s value video");
  assert.ok(first.some((r) => ["20-35", "30-45"].includes(r.length_bucket)));
  assert.ok(new Set(first.map((r) => r.world)).size >= 4, "worlds differ");
  const h = Array.from({ length: 12 }, (_, i) => ({ recipe: { angle: i < 6 ? "A2" : "A7", world: i < 6 ? "cozy" : "sunny", end_trigger: "comment" }, score: i < 6 ? 80 + i : 5 + i }));
  const b = planRecipes({ angles: ANGLES, history: h, n: 5 });
  assert.deepEqual(b.slice(0, 3).map((r) => r.angle), ["A2", "A2", "A2"], "the best recipe, three times");
  const W = b[0];
  for (const e of b.slice(3)) {
    const changed = ["angle", "world", "end_trigger"].filter((k) => e[k] !== W[k]);
    assert.equal(changed.length, 1, `an experiment changes ONE thing (${changed})`);
    assert.ok(e.why.startsWith("experiment"));
  }
  assert.deepEqual(retiredAngles(h), ["A7"], "6 posts below the median retire an angle");
  assert.ok(!b.some((r) => r.angle === "A7"));
  assert.deepEqual(anglesFromPrompt("make an A2 one with fruit", ANGLES), ["A2"]);
  assert.deepEqual(anglesFromPrompt("a tutorial please", ANGLES), ["A6"]);
});

test("the Studio score: 3 s hold counts most, then watch and completion; nothing without retention numbers", () => {
  const base = { views: 1000, likes: 50, comments: 5, shares: 5, saves: 5 };
  const strongHold = studioScore({ ...base, hold_3s_pct: 70, avg_watch_sec: 8, watched_full_pct: 5 }, 25);
  const weakHold = studioScore({ ...base, hold_3s_pct: 30, avg_watch_sec: 8, watched_full_pct: 5 }, 25);
  assert.ok(strongHold > weakHold);
  assert.equal(studioScore({ ...base }, 25), null, "likes alone don't score a Studio video");
  assert.ok(studioScore({ views: 186, avg_watch_sec: 7.1, watched_full_pct: 2 }, 50) > 0, "the first post scores from its watch time");
});

test("retention numbers: the form fields, cleaned, and Analytics shows each Studio post's drop-off", () => {
  assert.ok(["hold_3s_pct", "hold_5s_pct", "hold_10s_pct", "dropoff_s"].every((k) => STAT_FIELDS.some(([f]) => f === k)));
  assert.deepEqual((({ hold_3s_pct, dropoff_s }) => ({ hold_3s_pct, dropoff_s }))(cleanStats({ hold_3s_pct: "62,5", dropoff_s: "1.4" })), { hold_3s_pct: 62.5, dropoff_s: 1.4 });
  assert.throws(() => cleanStats({ hold_3s_pct: "120" }), /at most 100/);
  const post = { id: "P1", platform: "tiktok", posted_at: "2026-10-30T10:00:00Z", account: "zyvo", post_url: "https://tiktok.com/x",
    idea: { title: "V5", account: "zyvo", recipe: { kind: "video", variant: "V5", hook_type: "cliffhanger", end_trigger: "repost", length_s: 26 } },
    stats: [{ taken_at: "2026-10-31T10:00:00Z", hours_since_post: 24, views: 400, likes: 10, comments: 1, shares: 3, saves: 2, avg_watch_sec: 9, watched_full_pct: 8, hold_3s_pct: "64", dropoff_s: "1.5" }] };
  const a = analytics([post], { now: new Date("2026-11-01T10:00:00Z") });
  assert.equal(a.studio.posts[0].hold3, 64);
  assert.equal(a.studio.posts[0].dropoff, 1.5);
  assert.ok(a.studio.posts[0].score > 0);
  assert.ok(a.studio.byAngle && a.studio.byWorld);
});

test("kits: each template's own angles, the Blocky filter, a reuse within 14 days must change the angle", async () => {
  const s = (id, title) => ({ id, title, created_at: NOW.toISOString(), length_sec: 25, final_url: "u", scenes: [{ idx: 0, line: "a", clip_status: "ready" }, { idx: 1, line: "b", clip_status: "ready" }] });
  const { call } = studioApi({ others: { blocky_stories: [s("418ba8bd-b692-40d0-9c0e-a2bdd0762e89", "No Hats Allowed"), s("LAVA", "The Floor Is Lava")], cutaway: [{ id: "C1", title: "How a Pool Works", created_at: NOW.toISOString(), length_sec: 30 }] } });
  const p = (await call({ action: "studioPlan", mode: "ai_decide", count: 5 })).data;
  const reused = p.videos.filter((v) => v.source.kind !== "generate");
  assert.ok(!reused.some((v) => v.source.title === "No Hats Allowed"), "the Roblox-lookalike story is filtered out");
  const lava = reused.find((v) => v.source.id === "LAVA"); assert.ok(["A5", "A8", "A9"].includes(lava.recipe.angle)); assert.equal(lava.recipe.template, "blocky_stories");
  const pool = reused.find((v) => v.source.id === "C1"); assert.ok(["A1", "A4", "A5", "A6"].includes(pool.recipe.angle));
  // used once with A5: the second video may not be A5; used twice: not offered
  const one = studioApi({ others: { cutaway: [{ id: "C1", title: "P", created_at: NOW.toISOString(), length_sec: 30 }] }, recent: { C1: ["A1"] } });
  const q = (await one.call({ action: "studioPlan", mode: "prompt", prompt: "cutaway explainer" })).data;
  assert.notEqual(q.videos[0].recipe.angle, "A1");
  const two = studioApi({ others: { cutaway: [{ id: "C1", title: "P", created_at: NOW.toISOString(), length_sec: 30 }] }, recent: { C1: ["A1", "A4"] } });
  assert.equal((await two.call({ action: "studioPlan", mode: "prompt", prompt: "cutaway explainer", reuse_only: true })).data.count, 0);
});

test("a real result's moments: the ending is the last clean shot, frame 0 an earlier strong one, a brand shot never", () => {
  const words = [["Hi", 0.3], ["there.", 0.6], ["You", 2.2], ["lied?!", 2.5], ["Ask", 4.3], ["Google.", 4.6], ["Too", 6.3], ["late.", 6.6]].map(([w, s]) => ({ w, s, e: s + 0.3 }));
  const m = pickMoments({ cuts: [2, 4.2, 6.1], words, duration: 8, level: () => -20, lastSound: (a, b) => b - 0.5 });
  assert.equal(m.open.text, "You lied?!");
  assert.equal(m.ending.text, "Too late.");
  assert.ok(m.shots.find((s) => s.text.includes("Google")).brand);
  assert.throws(() => pickMoments({ cuts: [], words: words.slice(0, 2), duration: 3, level: () => -20, lastSound: (a, b) => b }), /fewer than 2/);
});

test("short-video scripts: a reused creation makes no time claim; one trigger; hooks ≤ 7 words; the loop follows the recipe", () => {
  const kit = { file: "video/studio/S1/final.mp4", hq_dir: "video/studio/S1/hq", duration: 31, measured: null, input: "typed into Describe it", title: "Ken Reads Everything",
    moments: { open: { in: 3, out: 6.5 }, ending: { in: 26, out: 30 } } };
  for (const variant of ["V1", "V2", "V3", "V4", "V5"]) {
    const s = makeScript({ variant, end_trigger: "save", loop: variant !== "V3" }, kit);
    const all = JSON.stringify(s);
    assert.ok(!/3:50|UNDER 4 MINUTES|Three minutes/.test(all), `${variant}: no measured-time claim`);
    assert.ok(!s.timer && !s.lines.some((l) => l.role === "time"));
    assert.equal(s.lines.filter((l) => l.role === "cta").length, 1);
    assert.equal(s.cta.kind, "save");
    assert.equal(!!s.loop_end, variant !== "V3");
    assert.ok(s.clips[0].hook.replace(/[|*]/g, " ").split(/\s+/).filter(Boolean).length <= 7);
    assert.equal(s.lines.find((l) => l.card === "step2").text, "Pick an idea. Or write your own.", "the typed re-entry is said as such");
  }
  assert.match(makeScript({ variant: "V5" }, kit).clips[0].hook, /KEN READS/);
  assert.equal(titleHook("x"), "WAIT FOR|*THE ENDING*");
  // the measured creation keeps its clock
  assert.equal(makeScript({ variant: "V4" }, TEN_YEARS).timer.seconds, 230);
});
