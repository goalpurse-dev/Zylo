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
import { validateThread } from "../scripts/studio/storyScripts.mjs";
import { lengthBudget, revisionNote, writeStory } from "../scripts/studio/storyWriter.mjs";
import { templateFor, ANGLE_TEMPLATES } from "../scripts/studio/storyTemplates.mjs";
import fs from "node:fs";
import { rageHookScript, rageTakes, rageScripts, rageRecipes } from "../scripts/studio/rageHook.mjs";
import { applyScriptEdits, onScreen } from "../supabase/functions/_shared/contentMachine/scriptEdit.js";
import { fakeWorld, apiFor } from "./helpers/contentMachineFakes.mjs";

const NOW = new Date("2026-10-30T12:00:00Z");
const ANGLES = [["A1", "45-60"], ["A2", "30-45"], ["A3", "45-60"], ["A4", "20-35"], ["A5", "20-35"], ["A6", "60-90"], ["A7", "30-45"], ["A8", "30-45"]].map(([key, length_bucket], sort) => ({ key, name: `Angle ${key}`, length_bucket, sort, status: "active", hooks: [`hook ${key}`] }));
const story = (id, title, days, lines = ["Hi.", "Oh no!"], over = {}) => ({ id, title, input: { source: "idea" }, length_sec: 30, final_url: `https://x/${id}.mp4`,
  created_at: new Date(NOW.getTime() - days * 864e5).toISOString(), scenes: lines.map((line, idx) => ({ idx, line, clip_status: "ready" })), ...over });

/** The admin API with an in-memory Studio: the owner's stories, jobs, the worker's heartbeat, posted Studio videos. */
function studioApi({ stories = [], others = {}, recent = {}, history = [], workers = [], settings = {} } = {}) {
  const world = fakeWorld({ studio_batch_size: 5, studio_rate_frame0: false, ...settings });
  world.clock = { now: NOW };
  const jobs = [], postedIdeas = new Set();
  const extra = {
    async ownerCreations(template, email, since) { assert.equal(email, "upwardlift6@gmail.com"); return template === "ai_fruit_story" ? stories.filter((s) => s.created_at >= since) : (others[template] ?? []); },
    async studioSourceUse() { const o = {}; for (const j of jobs) if (j.source?.id && j.status !== "cancelled") o[j.source.id] = (o[j.source.id] ?? 0) + 1; return o; },
    async studioPostHistory() { return history; },
    async studioWorkers() { return workers; },
    async createStudioJobs(rows) { const out = rows.map((r, i) => ({ id: `J${jobs.length + i + 1}`, created_at: NOW.toISOString(), ...r })); jobs.push(...out); return out; },
    async updateStudioJob(id, patch, from) { const j = jobs.find((x) => x.id === id && from.includes(x.status)); if (!j) return null; Object.assign(j, patch); return j; },
    async listStudioJobs() { return [...jobs].reverse(); },
    async studioJobVideos() { return {}; },
    async studioJobIdeas(ids) { return Object.fromEntries(ids.map((id) => [id, { id, status: postedIdeas.has(id) ? "posted" : "done", account: "zyvo", posts: [] }])); },
    async studioRecentSources() { return recent; },
    async studioAngles() { return ANGLES; },
  };
  Object.assign(world.db, extra);
  const { call } = apiFor(world);
  return { call, jobs, world, postedIdeas };
}

test("one story: 4-6 lines, the first line, and a video is about the topic or about making it, never both", () => {
  const making = () => ({ story_mode: "making", caption: "c", recipe: { angle: "A5", length_bucket: "15-25" }, lines: [
    { who: "creator", text: "I can't animate. At all." }, { who: "zee", text: "You don't have to. Type one sentence into Zyvo." },
    { who: "creator", text: "One sentence? Like what?" }, { who: "zee", text: "Repost this for that friend.", role: "cta" },
  ] });
  const topic = () => ({ story_mode: "topic", caption: "Made with Zyvo.", recipe: { angle: "A1", length_bucket: "15-25" }, lines: [
    { who: "creator", text: "Ditches flood your house." }, { who: "zee", text: "Because water fills them first." },
    { who: "creator", text: "So what stops it?" }, { who: "zee", text: "Which one surprised you?", role: "cta" },
  ] });
  const after = (make, change) => { const s = make(); change(s); return validateThread(s).join("; "); };
  assert.deepEqual(validateThread(making()), []);
  assert.deepEqual(validateThread(topic()), []);
  assert.match(after(making, (s) => { s.lines.splice(1, 1); }), /3 lines/);
  assert.match(after(making, (s) => { s.lines.push(...s.lines.slice(0, 3)); }), /7 lines/);
  assert.match(after(topic, (s) => { s.lines[1].text = "Zyvo made this."; }), /about the topic/, "the topic video never says Zyvo");
  assert.match(after(topic, (s) => { s.lines[1].screen = { file: "s_menu.jpg" }; }), /no app screens/);
  assert.match(after(topic, (s) => { s.caption = "A ditch."; }), /caption/);
  assert.match(after(making, (s) => { s.lines[1].text = "You don't have to."; }), /making it with Zyvo/);
  assert.match(after(making, (s) => { s.lines[0].text = "Zyvo… why does my video look cheap?"; }), /never says Zyvo/);
  assert.match(after(making, (s) => { s.lines[0].text = "How do I make an explainer video?"; }), /how-to/);
  assert.match(after(making, (s) => { s.lines[0].who = "zee"; }), /big face/);
  for (const [key, t] of Object.entries(ANGLE_TEMPLATES)) {
    assert.ok(["topic", "making"].includes(t.mode), key);
    assert.ok(t.shape.length >= 4 && t.shape.length <= 6, `${key} has a 4-6 line thread`);
    assert.ok(t.shape.some((x) => x.includes("[clip]")), `${key} shows the real clip`);
    if (t.mode === "topic") assert.ok(!t.shape.join(" ").includes("Zyvo"), `${key} is about the topic`);
  }
  assert.equal(templateFor("A5").mode, "making");
});

test("the length budget leaves room for the real clip, and a 101 s test video's 220 words no longer fit 60-90", () => {
  assert.deepEqual(lengthBudget("60-90"), { clip: 20, words: 182 });
  assert.deepEqual(lengthBudget("20-35"), { clip: 11, words: 62 });
  assert.deepEqual(lengthBudget("15-25"), { clip: 8, words: 44 });
  assert.ok(220 > lengthBudget("60-90").words * 1.1);
});

test("a script that runs long goes back with its own words and the number to cut, and gets three tries", async () => {
  const note = revisionNote(["it has 49 spoken words, too long"], { lines: [{ who: "creator", text: "My pool is losing water." }, { who: "zee", text: "Written.", say: "Spoken." }] });
  assert.match(note, /49 spoken words/);
  assert.match(note, /creator: My pool is losing water\./);
  assert.match(note, /zee: Spoken\./);

  const shots = [{ a: 0, b: 5, text: "Water soaks into the soil.", brand: false }, { a: 5, b: 9, text: "A shell keeps it in.", brand: false }];
  const kit = { template: "cutaway", story: { id: "s1", title: "Pools", idea_text: "pool" }, file: "f.mp4", hq_dir: "hq", hq_ext: "png", wide: false, words: [], duration: 9, moments: { shots }, measured: {}, input: null, input_dir: null, scene_images: ["C:/m/a.jpg"] };
  const blank = { who: "zee", key: "x", expr: "happy", pose: "rest", shot: "two_shot", visual: null, screen: null, sticker: null, stamp: null, keep: false };
  const draft = (extra) => ({ title: "Pools leak", search_title: "how a pool works", caption: "How a pool works. Made with Zyvo.", hashtags: ["#pool"], hook_type: "curiosity", headline: "POOLS *LEAK*", chip: "POOLS", clip_after: 1, end_line: "Which part surprised you? Comment.", end_chip: "COMMENT", lines: [
    { ...blank, who: "creator", text: "My pool is losing water and nobody knows why.", key: "water", expr: "sad", shot: "creator_close" },
    { ...blank, text: `Warm water leaves through the ground. ${extra}`.trim(), key: "ground", visual: { kind: "sign", text: "Through the ground", sub: null, value: null, label: null, n: null, title: null, from: null } },
    { ...blank, who: "creator", text: "Through the ground? Show me.", key: "Show", expr: "shocked", keep: true },
  ] });
  const guardFor = (drafts) => { let calls = 0; return { get calls() { return calls; }, spend: async () => ({ result: { content: [{ type: "text", text: JSON.stringify(drafts[Math.min(calls++, drafts.length - 1)]) }] }, actualUsd: 0.01 }) }; };
  const args = { apiKey: "none", facts: [], recipe: { angle: "A1", length_bucket: "15-25", world: "factory", end_trigger: "comment" }, angle: { key: "A1" }, kit, kitKey: "this" };
  const long = draft(Array(40).fill("word").join(" "));

  const third = guardFor([long, long, draft("")]);
  const ok = await writeStory({ ...args, guard: third });
  assert.equal(third.calls, 3);
  assert.equal(ok.usd, 0.03);

  const never = guardFor([long]);
  await assert.rejects(writeStory({ ...args, guard: never }), /too long for 15-25 seconds: at most 44, so cut at least \d+ words/);
  assert.equal(never.calls, 3);
});

test("Rage hook: the bleep is on the swear word, the beat stops on Watch, the result follows the time, three takes of the yell", () => {
  const R = JSON.parse(fs.readFileSync(new URL("../scripts/studio/recipes/rage_hook_cutaway_drain.json", import.meta.url), "utf8"));
  const { raw, censored } = rageHookScript(R);
  assert.equal(raw.bleep, undefined);
  assert.equal(raw.lines[0].text.split(" ")[censored.bleep.word], "fucking");
  assert.equal(censored.bleep.show, "f***ing");
  assert.equal(raw.lines[1].text.split(" ")[raw.energy.hard_stop.word], "Watch.");
  assert.equal(raw.headline, undefined);
  assert.equal(raw.lines[raw.clips[1].after_line].role, "time");
  assert.equal(raw.lines[raw.clips[0].after_line].role, "calm");
  for (const c of raw.clips) assert.ok(c.out - c.in <= 3.2);
  assert.equal(new Set(raw.lines.map((l) => l.text)).size, raw.lines.length);
  const takes = rageTakes(R, raw);
  assert.deepEqual(takes.slice(0, 3).map((t) => t.file), ["yell_a.mp3", "yell_b.mp3", "yell_c.mp3"]);
  assert.ok(takes.slice(0, 3).every((t) => t.model === "eleven_v3" && t.text.includes("[shouting]")));
  assert.equal(rageHookScript({ ...R, music: false }).raw.music_style, "none");
  assert.throws(() => rageHookScript({ ...R, clips: [R.clips[0]] }), /two clips/);
});

test("Rage hook v2 (owner, 2026-11-03): slam on frame 0, silence after Watch, the result on a bass drop, 3 big steps, a real number, a loop", () => {
  for (const f of ["rage_hook_long_form_weekend.json", "rage_hook_fruit_trend.json"]) {
    const R = JSON.parse(fs.readFileSync(new URL(`../scripts/studio/recipes/${f}`, import.meta.url), "utf8"));
    const { raw, censored } = rageScripts(R);
    assert.equal(censored, null, "no swear: one version only");
    assert.deepEqual(raw.lines.map((l) => l.role), ["yell", "calm", "s1", "s2", "s3", "reveal", "punch", "cta"]);
    assert.equal(raw.lines[1].text, "Watch.");
    assert.deepEqual(raw.headline, { text: R.yell.text, hidden: true }, "never drawn; the approval form and the Queue read it");
    assert.equal(new Set(raw.lines.map((l) => l.text)).size, raw.lines.length, "no repeated lines");
    const [clip] = raw.clips;
    assert.equal(raw.clips.length, 1); assert.equal(clip.after_line, 1); assert.equal(clip.pre, 0.5, "0.5 s of silence after Watch.");
    assert.ok(clip.out - clip.in >= 2 && clip.out - clip.in <= 3, "the result plays 2-3 s");
    assert.equal(clip.frame, R.template === "long_form" ? "tv" : "phone", "the result plays on a device in the scene, in its own shape");
    assert.equal(clip.fullscreen, undefined);
    assert.equal(raw.music_style, "none", "no music unless a recipe asks");
    assert.deepEqual(raw.energy, { reveal_lines: [5], reveal_clips: [], from_frame0: true, slam: true, scratch: false, hard_stop: { line: 1, word: 0, clip: 0 } });
    raw.lines.slice(2, 5).forEach((l, i) => {
      assert.deepEqual([l.screen.chip, l.screen.big], [`STEP ${i + 1}`, true]);
      assert.ok(l.cues.some((c) => c.word === 0 && c.sfx === "whoosh"), "a whoosh on each step");
    });
    assert.equal(raw.lines[5].visual.kind, "roll");
    assert.equal(raw.loop_back, 0.08);
    assert.deepEqual(raw.shots.at(-1), { to: "rage_hook", at: "cta.end+0.08", dur: 0.3, kind: "whip", hold: 0 }, "the end whips back to frame 0");
    assert.equal(raw.recipe.angle, "RH"); assert.equal(raw.recipe.length_bucket, "20-25"); assert.ok(raw.claims.length);
    // an edited yell is what gets voiced, three times
    const edited = structuredClone(raw); edited.lines[0].text = "I lost my whole weekend!";
    assert.ok(rageTakes(R, edited).slice(0, 3).every((t) => t.text.includes("I LOST MY WHOLE WEEKEND!!!")));
  }
  const R = JSON.parse(fs.readFileSync(new URL("../scripts/studio/recipes/rage_hook_long_form_weekend.json", import.meta.url), "utf8"));
  const sw = rageScripts({ ...R, yell: { ...R.yell, text: "I spent ALL WEEKEND fucking editing!", swear: "fucking", show: "f***ing" } });
  assert.equal(sw.censored.bleep.word, 4);
  assert.deepEqual(rageRecipes().map((x) => x.key).sort(), ["rage_fruit_fyp", "rage_lf_weekend"], "only v2 recipes are presets");
});

test("the Rage hook preset: one click makes one job from a recipe the worker lists; nothing renders before the approval", async () => {
  const workers = [{ id: "w", last_seen: NOW.toISOString(), info: { rage_hook: [{ key: "rage_lf_weekend", title: "I spent all weekend editing", template: "long_form", creation: "What If", creation_id: "LF1" }] } }];
  const { call, jobs } = studioApi({ workers });
  assert.match((await call({ action: "studioPreset", preset: "rage_hook", key: "nope" })).message, /isn't on the laptop worker/);
  assert.match((await call({ action: "studioPreset", preset: "other", key: "rage_lf_weekend" })).message, /Unknown preset/);
  const r = await call({ action: "studioPreset", preset: "rage_hook", key: "rage_lf_weekend" });
  assert.equal(r.ok, true);
  assert.equal(jobs.length, 1);
  assert.deepEqual([jobs[0].status, jobs[0].template, jobs[0].recipe.preset, jobs[0].recipe.recipe_key, jobs[0].source.kind, jobs[0].source.id], ["queued", "long_form", "rage_hook", "rage_lf_weekend", "long_form_project", "LF1"]);
  assert.equal(jobs[0].script_approved_at, undefined);
  // the approval works for a script with no headline
  jobs[0].status = "script_review"; jobs[0].script = { title: "T", caption: "C", clips: [], lines: [{ who: "creator", text: "I spent ALL WEEKEND!" }] };
  assert.equal((await call({ action: "studioScriptApprove", id: jobs[0].id, edits: { title: "T", caption: "C", lines: [{ text: "I spent ALL WEEKEND!" }] } })).ok, true);
  assert.equal(jobs[0].script.headline, undefined);
  const off = studioApi({ workers, settings: { kill_switch: true } });
  assert.equal((await off.call({ action: "studioPreset", preset: "rage_hook", key: "rage_lf_weekend" })).ok, false);
  assert.equal(off.jobs.length, 0);
});

test("script approval: a written script waits, the owner's edits go with the approval, only then it can render", async () => {
  const { call, jobs } = studioApi();
  const script = { title: "T", headline: { text: "H" }, caption: "C", clips: [], lines: [
    { who: "creator", text: "I can't animate.", key: ["animate."], say: "I can't animate", visual: { kind: "sign", text: "Old sign" } },
    { who: "zee", text: "Type it in.", screen: { file: "s_input.jpg", sticker: { text: "here" } } },
    { who: "zee", text: "See?", visual: { kind: "typed_result", text: "swimming pool" } },
  ] };
  jobs.push({ id: "S1", status: "script_review", script, recipe: { angle: "A5" }, source: { id: "C" } }, { id: "Q1", status: "queued", recipe: { angle: "A5" }, source: { id: "C" } });
  assert.equal((await call({ action: "studioScriptApprove", id: "Q1" })).ok, false, "a job with no script can't be approved");
  assert.match((await call({ action: "studioScriptApprove", id: "S1", edits: { lines: [{ text: " " }] } })).message, /can't be empty/);
  assert.equal(jobs[0].status, "script_review", "a bad edit changes nothing");
  const r = await call({ action: "studioScriptApprove", id: "S1", edits: { caption: "New", lines: [{ text: "I can't draw.", on: "New sign" }, { on: "type here" }] } });
  assert.equal(r.ok, true);
  assert.equal(jobs[0].status, "queued");
  assert.ok(jobs[0].script_approved_at);
  assert.equal(jobs[0].script.caption, "New");
  assert.equal(jobs[0].script.lines[0].text, "I can't draw.");
  assert.equal(jobs[0].script.lines[0].say, undefined, "the voice reads the edited words");
  assert.equal(jobs[0].script.lines[0].visual.text, "New sign");
  assert.equal(jobs[0].script.lines[1].screen.sticker.text, "type here");
  assert.equal((await call({ action: "studioScriptApprove", id: "S1" })).ok, false, "only once");
  jobs.push({ id: "S2", status: "script_review", script, recipe: {}, source: {} });
  assert.equal((await call({ action: "studioCancel", id: "S2" })).data.job.status, "cancelled");
  assert.equal(onScreen(script.lines[2]).editable, false, "what was really typed isn't edited");
  assert.throws(() => applyScriptEdits(script, { lines: [{}, {}, {}, { text: "x" }] }), /fewer lines/);
});

test("a finished video: the row carries its idea for Mark as posted; Remake keeps the recipe and creation, only before posting", async () => {
  const { call, jobs, postedIdeas } = studioApi();
  const recipe = { angle: "A1", world: "factory", end_trigger: "comment", template: "cutaway" };
  jobs.push({ id: "D1", created_at: NOW.toISOString(), template: "cutaway", mode: "ai_decide", prompt: null, recipe, source: { kind: "cutaway_run", id: "C1", title: "Pool" }, status: "done", idea_id: "I1" },
    { id: "OLD", created_at: NOW.toISOString(), template: "ai_fruit_story", recipe: { variant: "V5" }, source: { kind: "fruit_story", id: "S1" }, status: "done", idea_id: "I2" });
  const row = (await call({ action: "studioJobs" })).data.jobs.find((j) => j.id === "D1");
  assert.deepEqual(row.idea, { id: "I1", status: "done", account: "zyvo", posts: [] });
  const r = await call({ action: "studioRemake", id: "D1" });
  assert.equal(r.data.job.status, "queued");
  assert.deepEqual(r.data.job.recipe, recipe);
  assert.equal(r.data.job.source.id, "C1");
  assert.equal(r.data.job.source.remake_of, "D1");
  assert.equal(jobs.find((j) => j.id === "D1").status, "done", "the first video stays");
  assert.equal((await call({ action: "studioRemake", id: "OLD" })).ok, false, "an older video has no angle");
  postedIdeas.add("I1");
  assert.match((await call({ action: "studioRemake", id: "D1" })).message, /already posted/);
});

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

test("a batch is different videos: angles least tried first, 15-25 s by default, worlds differ; 10+ posts = 3 winners + one-change experiments; retired angles go", () => {
  const first = planRecipes({ angles: ANGLES, n: 5 });
  assert.equal(new Set(first.map((r) => r.angle)).size, 5);
  assert.ok(first.every((r) => r.length_bucket === "15-25"), "short by default");
  assert.equal(planRecipes({ angles: ANGLES, n: 1, only: ["A6"] })[0].length_bucket, "60-90", "a long tutorial only when asked for by name");
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
