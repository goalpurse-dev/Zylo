// Content Machine, Part 2: posted slideshows, stats snapshots, the screenshot reader and the analytics math.
import test from "node:test";
import assert from "node:assert/strict";
import { apiFor, depsFor, drain, fakeProviders, fakeWorld, startRun } from "./helpers/contentMachineFakes.mjs";
import { analytics, postMetrics, scorePosts, valueAt, timeline, SCORE_FORMULA } from "../supabase/functions/_shared/contentMachine/analytics.js";
import { cleanStats } from "../supabase/functions/_shared/contentMachine/statsReader.js";
import { costOfUsage } from "../supabase/functions/_shared/contentMachine/providers/anthropic.js";
import { assertTicket } from "../supabase/functions/_shared/contentMachine/budgetGuard.js";

async function madeOne() {
  const world = fakeWorld();
  world.clock.now = new Date("2026-10-18T09:00:00Z");
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, fakeProviders(world)));
  world.clock.now = new Date("2026-10-18T09:00:00Z");
  return world;
}

test("mark as posted: platform, link and Helsinki time; the slideshow leaves Today; undo brings it back", async () => {
  const world = await madeOne();
  const { call } = apiFor(world);
  const idea = world.ideas[0];
  const bad = await call({ action: "markPosted", ideaId: idea.id, platform: "tiktok", postUrl: "https://www.instagram.com/p/1", postedAt: "2026-10-18T10:15" });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /isn't a TikTok link/);
  const future = await call({ action: "markPosted", ideaId: idea.id, platform: "tiktok", postUrl: "https://www.tiktok.com/@zyvo/photo/7", postedAt: "2026-10-18T18:00" });
  assert.match(future.message, /in the future/);
  const r = await call({ action: "markPosted", ideaId: idea.id, platform: "tiktok", postUrl: "https://www.tiktok.com/@zyvo/photo/7", postedAt: "2026-10-18T10:15" });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.data.post.posted_at, "2026-10-18T07:15:00.000Z", "10:15 Helsinki (summer time)");
  assert.equal(world.ideas[0].status, "posted");
  const list = (await call({ action: "posts" })).data.posts;
  assert.equal(list[0].posted_local, "2026-10-18T10:15");
  assert.equal(list[0].idea.title, idea.title);
  assert.ok(world.audit.some((a) => a.action === "post.create"));
  const undo = await call({ action: "deletePost", id: r.data.post.id });
  assert.equal(undo.ok, true);
  assert.equal(world.ideas[0].status, "approved", "back in Today");
});

test("stats snapshots: each with its own Helsinki time, editable, deletable, hours since posting kept in sync", async () => {
  const world = await madeOne();
  const { call } = apiFor(world);
  world.clock.now = new Date("2026-10-20T12:00:00Z");
  const post = (await call({ action: "markPosted", ideaId: world.ideas[0].id, platform: "tiktok", postUrl: "https://www.tiktok.com/@zyvo/photo/7", postedAt: "2026-10-18T12:00" })).data.post;
  assert.match((await call({ action: "saveStats", postId: post.id, takenAt: "2026-10-19T12:00", stats: { views: "1,2" } })).message, /Views: a number/, "a view count has no decimals");
  const s1 = (await call({ action: "saveStats", postId: post.id, takenAt: "2026-10-19T12:00", stats: { views: "1200", likes: "80", saves: 12, watched_full_pct: "41,5" } })).data.stats;
  assert.equal(s1.hours_since_post, 24);
  assert.equal(s1.watched_full_pct, 41.5);
  assert.match((await call({ action: "saveStats", postId: post.id, takenAt: "2026-10-19T12:00", stats: { watched_full_pct: 140 } })).message, /at most 100/);
  assert.match((await call({ action: "saveStats", postId: post.id, takenAt: "2026-10-19T12:00", stats: {} })).message, /at least one number/);
  // A screenshot is kept with its snapshot.
  const png = Buffer.from("fake png").toString("base64");
  const s2 = (await call({ action: "saveStats", postId: post.id, takenAt: "2026-10-20T12:00", stats: { views: 3000 }, screenshot: { contentType: "image/png", dataBase64: png } })).data.stats;
  assert.equal(s2.source, "screenshot");
  assert.ok(world.stored[s2.screenshot_path], "stored in the private bucket");
  // Edit the time of a snapshot; then move the post's time: hours follow.
  await call({ action: "saveStats", postId: post.id, id: s1.id, takenAt: "2026-10-19T18:00", stats: { views: 1500 } });
  assert.equal(world.stats.find((x) => x.id === s1.id).hours_since_post, 30);
  await call({ action: "savePost", id: post.id, postedAt: "2026-10-18T06:00" });
  assert.equal(world.stats.find((x) => x.id === s1.id).hours_since_post, 36);
  const list = (await call({ action: "posts" })).data.posts[0];
  assert.equal(list.stats.length, 2);
  assert.equal(list.metrics.views, 3000);
  assert.ok(list.stats[1].screenshot.startsWith("https://signed/posts/"));
  assert.equal((await call({ action: "deleteStats", id: s2.id })).ok, true);
  assert.equal(world.stored[s2.screenshot_path], undefined, "its screenshot is removed too");
});

test("the screenshot reader: the fast model reads the numbers through the Budget Guard; nothing is saved until confirmed", async () => {
  const world = await madeOne();
  const seen = [];
  const ai = { async createMessage(ticket, { request }) {
    assertTicket(ticket, "anthropic");
    seen.push(request);
    const body = { id: "msg_s", model: "claude-haiku-5-5", usage: { input_tokens: 1800, output_tokens: 90 }, content: [{ type: "text", text: JSON.stringify({ views: 12500, likes: 900, comments: 41, shares: 22, saves: 130, avg_watch_sec: 4.2, watched_full_pct: 18.5, profile_visits: 77, new_followers: 9, platform: "tiktok", note: null }) }] };
    return { body, costUsd: costOfUsage(body.usage, body.model) };
  } };
  const { call } = apiFor(world, { ai, env: { ANTHROPIC_API_KEY: "k" } });
  const r = await call({ action: "readStatsScreenshot", contentType: "image/png", dataBase64: Buffer.from("x").toString("base64") });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.data.numbers.views, 12500);
  assert.equal(seen[0].messages[0].content[0].source.type, "base64");
  assert.ok(world.ledger.some((l) => l.operation === "anthropic.read_stats" && l.lane === "stats"), "through the guard");
  assert.equal(world.stats.length, 0, "the owner confirms before anything is saved");
  assert.match((await call({ action: "readStatsScreenshot", contentType: "image/gif", dataBase64: "x" })).message, /PNG, JPEG or WebP/);
});

test("analytics math: views at 24 h / 7 d read off the timeline, needs-stats badges, score against the medians", () => {
  const post = (id, posted, snaps, recipe = { format: "tool_listicle", style: "neon_grid", hook_type: "question" }, platform = "tiktok") => ({
    id, platform, posted_at: posted, idea: { title: id, recipe }, stats: snaps.map(([h, views, extra = {}]) => ({ hours_since_post: h, taken_at: new Date(Date.parse(posted) + h * 3_600_000).toISOString(), views, ...extra })),
  });
  const pts = timeline(post("a", "2026-10-10T00:00:00Z", [[12, 600], [36, 1800]]));
  assert.equal(valueAt(pts, 24), 1200, "halfway between 12 h and 36 h");
  assert.equal(valueAt(pts, 6), 300, "from 0 views at hour 0");
  assert.equal(valueAt(pts, 168), null, "never guessed past the last snapshot");
  const now = new Date("2026-10-20T00:00:00Z");
  const m = postMetrics(post("a", "2026-10-10T00:00:00Z", [[12, 600], [36, 1800, { likes: 90, saves: 30, shares: 10, comments: 20 }]]), now);
  assert.deepEqual(m.needs, ["7d"], "24 h is covered, 7 d isn't");
  assert.equal(m.engagementRate, 150 / 1800);
  assert.equal(m.viewsPerHour, 50);
  assert.deepEqual(postMetrics(post("b", "2026-10-19T12:00:00Z", []), now).needs, [], "too young to need anything");
  assert.deepEqual(postMetrics(post("c", "2026-10-18T00:00:00Z", [[3, 100]]), now).needs, ["24h"]);

  const posts = [
    post("p1", "2026-10-01T00:00:00Z", [[24, 1000, { saves: 10, shares: 5, profile_visits: 2 }]]),
    post("p2", "2026-10-02T00:00:00Z", [[24, 2000, { saves: 40, shares: 20, profile_visits: 8 }]], { format: "meme", style: "meme_style", hook_type: "pov" }),
    post("p3", "2026-10-03T00:00:00Z", [[24, 500, { saves: 5, shares: 2, profile_visits: 1 }]], undefined, "instagram"),
  ];
  const rows = posts.map((p) => ({ post: p, m: postMetrics(p, now) }));
  scorePosts(rows);
  assert.equal(rows[0].m.score, 100, "the median post scores 100");
  assert.ok(rows[1].m.score > 150 && rows[2].m.score < 100);
  const a = analytics(posts, { now, filters: { platform: "tiktok" } });
  assert.equal(a.totals.posts, 2);
  assert.equal(a.totals.views, 3000);
  assert.equal(a.top5[0].post.id, "p2");
  assert.equal(a.averages.format[0].key, "meme");
  assert.equal(a.series.at(-1).views, 3000, "total views today");
  assert.equal(a.formula, SCORE_FORMULA);
  assert.equal(analytics(posts, { now }).byPlatform.instagram.views, 500);
});

test("stats input: commas and spaces in numbers, percentages, nothing negative", () => {
  assert.equal(cleanStats({ views: "1,200" }).views, 1200);
  assert.equal(cleanStats({ views: "1.2K" }).views, 1200);
  assert.equal(cleanStats({ views: "3M" }).views, 3000000);
  assert.deepEqual(cleanStats({ views: "12 500", avg_watch_sec: "4,25", watched_full_pct: "18.5" }), { views: 12500, likes: null, comments: null, shares: null, saves: null, avg_watch_sec: 4.25, watched_full_pct: 18.5, profile_visits: null, new_followers: null });
  assert.throws(() => cleanStats({ views: -3 }), /0 or more/);
});

/* ─── Phase 3: the learning loop ─── */

import { freshness, learn, analysisDue } from "../supabase/functions/_shared/contentMachine/learning.js";
import { writeRequest } from "../supabase/functions/_shared/contentMachine/writer.js";
import { planRecipes } from "../supabase/functions/_shared/contentMachine/planner.js";
import { LIB } from "./helpers/contentMachineFakes.mjs";
import { tick } from "../supabase/functions/_shared/contentMachine/worker.js";

const R = (format, style, hook_type) => ({ format, style, hook_type, zyvo_position: "middle", cta_type: "question", text_density: "medium", platform: "tiktok", post_time: "18:00", topic: "one post's topic" });
const P = (n, recipe, daysAgo, views, now) => {
  const posted = new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  return { id: `p${n}`, platform: "tiktok", posted_at: posted, idea: { title: `post ${n}`, recipe }, stats: [{ hours_since_post: 24, taken_at: new Date(Date.parse(posted) + 86_400_000).toISOString(), views, saves: Math.round(views / 50), shares: Math.round(views / 100), profile_visits: Math.round(views / 200) }] };
};

test("freshness halves every 14 days; a winner needs 3 successes; below-median formats are suggested for retiring", () => {
  assert.equal(freshness(0), 1);
  assert.equal(freshness(14), 0.5);
  assert.equal(freshness(28, 14), 0.25);
  const now = new Date("2026-11-20T12:00:00Z");
  const win = R("tool_listicle", "neon_grid", "question"), lucky = R("meme", "meme_style", "pov"), dud = R("quiz", "minimal_clean", "warning");
  const posts = [
    P(1, win, 2, 5000, now), P(2, win, 5, 4000, now), P(3, win, 9, 6000, now),            // 3 successes
    P(4, lucky, 3, 9000, now), P(5, lucky, 6, 900, now),                                  // one lucky post
    P(6, dud, 4, 400, now), P(7, dud, 8, 500, now), P(8, dud, 10, 300, now),              // three below the median
    P(9, R("myth_fact", "luxury_night", "question"), 1, 1000, now),
  ];
  const l = learn(posts, { now });
  assert.equal(l.scored, 9);
  assert.deepEqual(l.winners.map((w) => w.key), ["tool_listicle|neon_grid|question"]);
  assert.equal(l.winners[0].successes, 3);
  assert.equal(l.winners[0].recipe.topic, undefined, "a winner is a recipe, not one post's topic");
  assert.ok(l.retire.some((r) => r.kind === "format" && r.key === "quiz"));
  assert.ok(!l.retire.some((r) => r.key === "meme"), "two posts aren't evidence");
  assert.equal(learn(posts, { now, minSuccesses: 4 }).winners.length, 0);
  assert.equal(analysisDue(12, 0), true);
  assert.equal(analysisDue(12, 5), false);
  // The planner makes the winners first (3 winners + 2 experiments after the experiment phase).
  const recipes = planRecipes({ library: LIB, count: 5, seed: "w", experimentPhase: false, winners: l.winners.map((w) => w.recipe), winnersPerDay: 3 });
  assert.equal(recipes.filter((r) => r.mode === "winner").length, 1, "only as many winners as there are");
  assert.equal(recipes[0].format, "tool_listicle");
});

test("the writer follows the playbook and sees today's trends", () => {
  const req = writeRequest({ model: "m", brandRules: "- honest", library: LIB, recipe: { format: "meme", slide_count: 5 }, today: "2026-10-20", playbook: "- Hooks: open with a number", trends: "- Numbered carousels are up" });
  assert.match(req.system[0].text, /PLAYBOOK[^\n]*\n- Hooks: open with a number/);
  assert.match(req.system[0].text, /TRENDS[^\n]*\n- Numbered carousels are up/);
});

test("Let the agent analyze: queued from the page, run by the worker through the guard; the owner applies the playbook", async () => {
  const world = await madeOne();
  const report = { summary: "Too little data yet.", what_works: ["question hooks"], what_doesnt: [], playbook: "- Hooks: ask a question", experiments: [{ format: "quiz", style: "neon_grid", hook_type: "question", why: "untested" }, { format: "meme", style: "meme_style", hook_type: "pov", why: "one lucky post" }], retire: [], trend_notes: "", confidence: "low" };
  const p = fakeProviders(world);
  const orig = p.ai.createMessage;
  let analystReq = null;
  p.ai.createMessage = async (t, a) => {
    if (/^You are the analyst/.test(a.request.system[0].text)) {
      analystReq = a.request;
      const body = { id: "msg_a", model: "claude-sonnet-5-5", usage: { input_tokens: 9000, output_tokens: 1500 }, content: [{ type: "text", text: JSON.stringify(report) }] };
      return { body, costUsd: costOfUsage(body.usage, body.model) };
    }
    return orig(t, a);
  };
  const { call } = apiFor(world);
  assert.match((await call({ action: "analyze" })).message, /Add stats to at least one/);
  const post = (await call({ action: "markPosted", ideaId: world.ideas[0].id, platform: "tiktok", postUrl: "https://www.tiktok.com/@zyvo/photo/7", postedAt: "2026-10-17T09:00" })).data.post;
  await call({ action: "saveStats", postId: post.id, takenAt: "2026-10-18T09:00", stats: { views: 1500, saves: 20 } });
  const started = await call({ action: "analyze" });
  assert.equal(started.ok, true, started.message);
  assert.match((await call({ action: "analyze" })).message, /already running/);
  await drain(world, depsFor(world, p));
  const a = world.analyses[0];
  assert.equal(a.status, "done");
  assert.equal(a.report.playbook, "- Hooks: ask a question");
  assert.ok(world.ledger.some((l) => l.operation === "anthropic.analyze" && l.lane === "analysis"));
  assert.match(analystReq.messages[0].content, /POSTS/);
  assert.ok(!analystReq.messages[0].content.includes("tiktok.com/@zyvo"), "links aren't sent to the analyst");
  const state = (await call({ action: "learning" })).data;
  assert.equal(state.analyses[0].id, a.id);
  assert.equal(state.suggest, false, "just analysed");
  await call({ action: "applyAnalysis", id: a.id });
  assert.equal(world.s.playbook, "- Hooks: ask a question");
  await call({ action: "savePlaybook", text: "- Hooks: ask a question\n- Post at 18:00" });
  assert.equal(world.s.playbook, "- Hooks: ask a question\n- Post at 18:00");
});

test("the daily scout: queued once a day after the run time when it's on; its brief reaches the writer", async () => {
  const world = fakeWorld({ daily_auto_run: false, daily_scout: true, run_time_local: "08:00" });
  world.clock.now = new Date("2026-10-20T04:00:00Z");   // 07:00 Helsinki
  const p = fakeProviders(world);
  const orig = p.ai.createMessage;
  p.ai.createMessage = async (t, a) => {
    if (/^You scout/.test(a.request.system[0].text)) {
      assert.ok(a.request.tools?.length, "with web search");
      const body = { id: "msg_s", model: "claude-sonnet-5-5", usage: { input_tokens: 20000, output_tokens: 1200, server_tool_use: { web_search_requests: 3 } }, content: [{ type: "text", text: JSON.stringify({ trend_brief: "- Numbered carousels are up", top_formats: [], hooks: [], sounds: [], sources: [{ title: "x", url: "https://example.com" }] }) }] };
      return { body, costUsd: costOfUsage(body.usage, body.model) };
    }
    return orig(t, a);
  };
  const deps = depsFor(world, p);
  assert.equal((await tick(deps)).scout, false, "before the run time");
  world.clock.now = new Date("2026-10-20T06:00:00Z");   // 09:00 Helsinki
  assert.equal((await tick(deps)).scout, true);
  assert.equal(world.scouts.length, 1);
  assert.equal((await tick(deps)).scout, false, "once a day");
  await startRun(world, { count: 1 });
  let writerSystem = null;
  const o2 = p.ai.createMessage;
  p.ai.createMessage = async (t, a) => { if (a.request.tools && /SLIDESHOW/.test(a.request.system[0].text)) writerSystem = a.request.system[0].text; return o2(t, a); };
  await drain(world, deps);
  assert.match(writerSystem, /Numbered carousels are up/);
  const off = fakeWorld({ daily_scout: false });
  off.clock.now = new Date("2026-10-20T06:00:00Z");
  assert.equal((await tick(depsFor(off, fakeProviders(off)))).scout, false, "off by default (it's paid)");
});


test("with the daily scout on, today's automatic run waits for the scout (at most 10 minutes)", async () => {
  const world = fakeWorld({ daily_auto_run: true, daily_scout: true, run_time_local: "08:00", dry_run: true });
  world.clock.now = new Date("2026-10-20T06:00:00Z");   // 09:00 Helsinki
  const p = fakeProviders(world);
  const orig = p.ai.createMessage;
  let scoutCalls = 0;
  p.ai.createMessage = async (t, a) => {
    if (/^You scout/.test(a.request.system[0].text)) { scoutCalls += 1; throw new Error("search provider down"); }
    return orig(t, a);
  };
  const deps = depsFor(world, p);
  // Dry run: the scout is a live call (owner-ordered), so it runs; here it fails.
  const first = await tick(deps);
  assert.equal(first.scout, true);
  assert.equal(first.daily, null, "the run waits for the scout");
  assert.equal(world.runs.length, 0);
  world.clock.now = new Date(world.clock.now.getTime() + 5 * 60_000);
  assert.equal((await tick(deps)).daily, null, "still waiting (5 min)");
  world.clock.now = new Date(world.clock.now.getTime() + 6 * 60_000);
  assert.ok((await tick(deps)).daily, "after 10 minutes the run starts without a report");
  assert.equal(scoutCalls, 1, "the scout is tried once, never retried in a loop");
});
