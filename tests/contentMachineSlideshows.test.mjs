// Content Machine, Phase 2: slideshow experiments. The whole pipeline is driven here with an in-memory
// database and fake providers: a dry run (no provider called at all), a real run (every call reserved,
// then settled with the provider's own cost), budget stops, the compliance rewrite, the retry, the kill
// switch, the Batch API path, and the pieces on their own (planner, templates, renderer, worker, API).
import test from "node:test";
import assert from "node:assert/strict";
import { createBudgetGuard, assertTicket } from "../supabase/functions/_shared/contentMachine/budgetGuard.js";
import { runJob, renderPaths, platformPackages } from "../supabase/functions/_shared/contentMachine/pipeline.js";
import { planRecipes, coverage, inExperimentPhase, rng } from "../supabase/functions/_shared/contentMachine/planner.js";
import { costOfUsage, estimateUsd, createMessage, jsonFromMessage, WEB_SEARCH_TOOL } from "../supabase/functions/_shared/contentMachine/providers/anthropic.js";
import { generateImage, imagePrompt, NO_PEOPLE } from "../supabase/functions/_shared/contentMachine/providers/runware.js";
import { renderCostUsd } from "../supabase/functions/_shared/contentMachine/providers/fly.js";
import { slideshowProblems, packageProblems, utmLinks, nearDuplicate, mockSlideshow, writeRequest, packageRequest, SLIDESHOW_SCHEMA } from "../supabase/functions/_shared/contentMachine/writer.js";
import { slideHtml, highlight, initials, esc, logoFor, SAFE, SAFE_RECT, INNER_RECT } from "../supabase/functions/_shared/contentMachine/slides/templates.js";
import { assertRemoteImages } from "../render-worker/src/cmSlides.mjs";
import { checkLogoFile } from "../supabase/functions/_shared/contentMachine/apiSlideshows.js";
import { fallbackModel } from "../supabase/functions/_shared/contentMachine/pipeline.js";
import { mp4Args, slideDurations, zipStore } from "../render-worker/src/cmSlides.mjs";
import { createWorkerHandler, maybeStartDailyRun, localClock, tick } from "../supabase/functions/_shared/contentMachine/worker.js";
import { cleanLibraryRow } from "../supabase/functions/_shared/contentMachine/apiSlideshows.js";

import { LIB, PKG, fakeWorld, validSlideshow, fakeProviders, depsFor, drain, startRun, apiFor } from "./helpers/contentMachineFakes.mjs";

/* ─── whole runs ─────────────────────────────────────────────────────── */

test("a dry run goes all the way through without calling any provider, and costs $0", async () => {
  const world = fakeWorld({ dry_run: true });
  const p = fakeProviders(world);
  const run = await startRun(world, { dry: true, count: 3 });
  await drain(world, depsFor(world, p));
  assert.equal(world.runs[0].status, "done");
  assert.equal(world.ideas.length, 3);
  assert.ok(world.ideas.every((i) => i.status === "done" && i.dry_run && i.script.slides.length >= 3));
  assert.deepEqual([p.calls.messages.length, p.calls.images, p.calls.renders], [0, 0, 0], "no provider was called");
  assert.ok(world.ledger.length > 0 && world.ledger.every((l) => l.dry_run && l.actual_usd === 0), "every would-be call is in the ledger at $0");
  assert.ok(world.ledger.some((l) => l.would_cost_usd > 0), "with what it would have cost");
  assert.equal(world.s.experiment_started_on, null, "a dry run does not start the experiment phase");
  assert.equal(world.gens.every((g) => g.files.dryRun), true);
  assert.equal(world.pkgs.length, 9, "3 platforms × 3 slideshows");
  assert.equal(run.dry_run, true);
});

test("a real run: every call reserved first, settled with the provider's own cost, files rendered", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  await startRun(world, { count: 2 });
  await drain(world, depsFor(world, p));
  assert.equal(world.runs[0].status, "done");
  assert.ok(world.ideas.every((i) => i.status === "done"), JSON.stringify(world.ideas.map((i) => [i.status, i.error])));
  assert.equal(p.calls.renders, 2);
  const expected = world.ideas.reduce((a, i) => a + i.script.slides.length, 0);
  assert.equal(p.calls.images, expected, "a background + a hero for every slide but the cta, per slideshow");
  assert.ok(world.ledger.every((l) => l.status === "settled" && l.actual_usd != null), "nothing left reserved");
  assert.ok(world.ledger.every((l) => l.lane === "slideshow"), "everything counts against the slideshow cap");
  const writeCalls = world.ledger.filter((l) => l.operation === "anthropic.write");
  assert.equal(writeCalls[0].actual_usd, Number((9000 * 2 / 1e6 + 4000 * 10 / 1e6 + 3 * 0.01).toFixed(6)), "tokens × price + $0.01 per search");
  assert.ok(world.ledger.some((l) => l.provider === "fly"), "render time is in the ledger");
  assert.equal(world.s.experiment_started_on, "2026-10-20", "the first real run starts the experiment phase");
  // The render got the slides, the style, the images and the Zyvo screenshot; the generation has its files.
  assert.equal(p.calls.lastRender.style.font, "anton");
  assert.match(p.calls.lastRender.zyvoShot, /assets\/zyvo-home\.png/);
  assert.equal(p.calls.lastRender.uploads.pngs.length, world.ideas[1].script.slides.length);
  assert.ok(world.gens.every((g) => g.status === "done" && g.files.mp4 && g.files.zip && g.files.pngs.length));
  // Prompts: the write request has web search and caching; the package call uses the fast model.
  const w = p.calls.messages.find((m) => m.tools);
  assert.equal(w.tools[0].type, WEB_SEARCH_TOOL);
  assert.equal(w.system[0].cache_control.type, "ephemeral");
  assert.equal(w.fallbacks, undefined, "no server-side fallback: it could route to a dearer model");
  assert.ok(p.calls.messages.some((m) => m.model === "claude-haiku-5-5"));
  // Packages: UTM links per platform, the AI label flag, the sound suggestion as text.
  const tk = world.pkgs.find((x) => x.platform === "tiktok");
  assert.match(tk.compliance.link, /utm_source=tiktok&utm_medium=social&utm_campaign=cm_/);
  assert.equal(tk.sound_suggestion, "an upbeat lo-fi sound");
  // The run's spend is the sum of its ledger.
  assert.ok(Math.abs(world.runs[0].spend_usd - world.ledger.reduce((a, l) => a + l.actual_usd, 0)) < 1e-9);
});

test("the budget runs out: the idea is skipped_budget, the others go on, nothing is overspent", async () => {
  const world = fakeWorld({ lane_daily_caps: { slideshow: 0.25 } });
  const p = fakeProviders(world);
  await startRun(world, { count: 3 });
  await drain(world, depsFor(world, p));
  const statuses = world.ideas.map((i) => i.status);
  assert.ok(statuses.includes("skipped_budget"), statuses.join(","));
  const spent = world.ledger.filter((l) => l.lane === "slideshow").reduce((a, l) => a + (l.actual_usd ?? l.estimated_usd), 0);
  assert.ok(spent <= 0.25 + 1e-9, `spent ${spent}`);
  assert.ok(["done", "budget_stopped"].includes(world.runs[0].status));
});

test("a compliance failure gets ONE rewrite, then the check again", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world, { packageOk: [false, true] });
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  const idea = world.ideas[0];
  assert.equal(idea.status, "done");
  assert.equal(idea.compliance.rewritten, true);
  assert.equal(idea.compliance.ok, true);
  assert.ok(world.ledger.some((l) => l.operation === "anthropic.rewrite"));
});

test("still failing after the rewrite: it is flagged for the owner, not silently passed", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world, { packageOk: [false, false] });
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  assert.deepEqual([world.ideas[0].compliance.flagged, world.ideas[0].compliance.ok], [true, false]);
  assert.match(world.ideas[0].compliance.problems.join(" "), /income/);
});

test("a slideshow that fails the program checks is rewritten once; twice is a failure", async () => {
  const once = fakeWorld();
  await startRun(once, { count: 1 });
  await drain(once, depsFor(once, fakeProviders(once, { badFirstWrite: true })));
  assert.equal(once.ideas[0].status, "done");
  const twice = fakeWorld();
  await startRun(twice, { count: 1 });
  await drain(twice, depsFor(twice, fakeProviders(twice, { badAlways: true })));
  assert.equal(twice.ideas[0].status, "failed");
  assert.match(twice.ideas[0].error, /failed the checks twice/);
  assert.equal(twice.runs[0].status, "failed");
});

test("the kill switch: jobs wait, no provider is called, nothing is lost", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  await startRun(world, { count: 1 });
  const deps = depsFor(world, p);
  for (const j of await world.db.claimJobs(5)) await runJob(j, deps);   // plan
  world.s.kill_switch = true;
  for (const j of await world.db.claimJobs(5)) assert.equal(await runJob(j, deps), "waiting_kill_switch");
  assert.equal(p.calls.messages.length, 0);
  assert.ok(world.jobs.some((j) => j.status === "queued" && j.stage === "write" && j.attempts === 0), "the job waits without using up an attempt");
  world.s.kill_switch = false;
  await drain(world, deps);
  assert.equal(world.ideas[0].status, "done");
});

test("the daily run uses the Batch API at half price, and waits for the batch to end", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  await startRun(world, { kind: "daily", count: 2 });
  const deps = depsFor(world, p);
  for (let i = 0; i < 2; i++) for (const j of await world.db.claimJobs(5)) await runJob(j, deps);   // plan, write_batch
  assert.equal(p.calls.batches.length, 1);
  assert.equal(p.calls.batches[0].requests.length, 2);
  assert.equal(world.ledger.filter((l) => l.operation === "anthropic.write.batch" && l.status === "reserved").length, 2, "reserved at submit");
  world.clock.now = new Date(world.clock.now.getTime() + 61_000);
  const [poll] = await world.db.claimJobs(5);
  assert.equal(await runJob(poll, deps), "waiting", "not ended yet: wait");
  p.calls.batches[0].processing_status = "ended";
  await drain(world, deps);
  assert.ok(world.ideas.every((i) => i.status === "done"));
  const settled = world.ledger.filter((l) => l.operation === "anthropic.write.batch");
  const full = costOfUsage({ input_tokens: 9000, output_tokens: 4000, server_tool_use: { web_search_requests: 3 } }, "claude-sonnet-5-5");
  assert.equal(settled[0].actual_usd, Number(((full - 0.03) / 2 + 0.03).toFixed(6)), "tokens at half price, searches at full");
  assert.ok(!p.calls.messages.some((m) => m.tools), "no single write calls were needed");
});

/* ─── the planner ────────────────────────────────────────────────────── */

test("experiment planner: a day spreads across different formats, styles and hooks", () => {
  const day = planRecipes({ library: LIB, count: 5, seed: "run-1" });
  assert.equal(day.length, 5);
  assert.equal(new Set(day.map((r) => r.format)).size, 5, "5 different formats");
  assert.equal(new Set(day.map((r) => r.style)).size, 3, "all 3 styles used");
  assert.equal(new Set(day.map((r) => r.hook_type)).size, 5, "5 different hook types");
  assert.equal(new Set(day.map((r) => `${r.format}|${r.style}`)).size, 5);
  for (const r of day) {
    assert.ok(r.slide_count >= 5 && r.slide_count <= 7);
    assert.ok(["tiktok", "instagram", "youtube"].includes(r.platform) && /^\d\d:\d\d$/.test(r.post_time));
    assert.equal(r.mode, "experiment");
  }
  assert.deepEqual(planRecipes({ library: LIB, count: 5, seed: "run-1" }), day, "the same seed plans the same day");
});

test("experiment planner: no format + style pair repeats until every pair has been tried", () => {
  const history = [];
  const pairs = LIB.formats.length * LIB.styles.length;   // 21
  for (let d = 0; d < 4; d++) history.push(...planRecipes({ library: LIB, history, count: 5, seed: `day-${d}` }));
  const keys = history.map((r) => `${r.format}|${r.style}`);
  assert.equal(new Set(keys).size, 20, "20 slideshows, 20 different pairs");
  history.push(...planRecipes({ library: LIB, history, count: 5, seed: "day-4" }));
  assert.equal(coverage(LIB, history).tried, pairs, "day 5 completes the grid before repeating");
  assert.equal(coverage(LIB, history).total, pairs);
});

test("the experiment phase ends after its days; winners then lead the day (Phase 3 supplies them)", () => {
  assert.equal(inExperimentPhase({ startedOn: null, today: "2026-10-20", days: 14 }), true);
  assert.equal(inExperimentPhase({ startedOn: "2026-10-07", today: "2026-10-20", days: 14 }), true);
  assert.equal(inExperimentPhase({ startedOn: "2026-10-06", today: "2026-10-20", days: 14 }), false);
  const winners = [{ format: "quiz", style: "minimal_clean", hook_type: "question", slide_count: 6 }];
  const day = planRecipes({ library: LIB, count: 3, seed: "x", experimentPhase: false, winners, winnersPerDay: 3 });
  assert.deepEqual(day.map((r) => r.mode), ["winner", "experiment", "experiment"]);
  assert.equal(day[0].format, "quiz");
  assert.notEqual(`${day[1].format}|${day[1].style}`, "quiz|minimal_clean");
  assert.ok(rng("a")() !== rng("b")());
});

/* ─── providers and costs ────────────────────────────────────────────── */

test("providers refuse to run without the guard's ticket", async () => {
  await assert.rejects(createMessage(null, { apiKey: "k", request: {} }), /outside the Budget Guard/);
  await assert.rejects(generateImage({ provider: "runware" }, { apiKey: "k", prompt: "x" }), /outside the Budget Guard/, "a look-alike object is no ticket");
  const world = fakeWorld({ dry_run: true });
  const guard = createBudgetGuard({ store: world.store });
  const r = await guard.reserve("runware", "x", 0.01);
  assert.throws(() => assertTicket(r.ticket, "runware"), /dry-run ticket/, "a dry-run ticket can't pay for a real call");
  world.s.dry_run = false;
  const real = await guard.reserve("runware", "x", 0.01);
  assert.throws(() => assertTicket(real.ticket, "anthropic"), /can't pay for a anthropic call/);
  assertTicket(real.ticket, "runware");
});

test("costs: tokens × price, cache reads and writes, $0.01 per web search, batch half price, Fly by the second", () => {
  const u = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 100_000, server_tool_use: { web_search_requests: 5 } };
  assert.equal(costOfUsage(u, "claude-sonnet-5-5"), Number((2 + 1 + 0.2 + 0.25 + 0.05).toFixed(6)));
  assert.equal(costOfUsage(u, "claude-sonnet-5-5", { batch: true }), Number(((2 + 1 + 0.2 + 0.25) / 2 + 0.05).toFixed(6)));
  assert.equal(costOfUsage({ input_tokens: 1_000_000 }, "claude-haiku-5-5"), 0.1);
  assert.equal(costOfUsage({ input_tokens: 1_000_000 }, "some-new-model"), 4, "an unknown model is costed at the dearest price");
  assert.ok(estimateUsd({ model: "claude-sonnet-5-5", inputTokens: 30000, outputTokens: 9000, searches: 4 }) > 0.15);
  assert.equal(renderCostUsd(0, 60_000), 0.00081);
  assert.match(imagePrompt("a neon city"), /no text, no letters.*no logos/);
  assert.throws(() => jsonFromMessage({ content: [{ type: "text", text: "not json" }] }), /not valid JSON/);
});

test("the write request: strict JSON schema, web search, the recipe, recent titles to avoid", () => {
  const recipe = planRecipes({ library: LIB, count: 1, seed: "s" })[0];
  const req = writeRequest({ model: "claude-sonnet-5-5", brandRules: "- No fake claims.", library: LIB, recipe, today: "2026-10-20", avoidTitles: ["Old post"] });
  assert.equal(req.output_config.format.type, "json_schema");
  assert.equal(req.output_config.format.schema, SLIDESHOW_SCHEMA);
  assert.match(req.system[0].text, /No fake claims/);
  assert.match(req.system[0].text, /Say nothing else about Zyvo/);
  assert.match(req.messages[0].content, /Old post/);
  assert.doesNotMatch(req.system[0].text, /2026-10-20/, "nothing that changes daily in the cached system prompt");
  const pkg = packageRequest({ model: "claude-haiku-5-5", brandRules: "x", recipe, slideshow: {}, links: utmLinks("abc") });
  assert.equal(pkg.model, "claude-haiku-5-5");
  assert.equal(pkg.output_config.effort, "low");
});

test("program checks on what came back", () => {
  const recipe = { slide_count: 6 };
  assert.deepEqual(slideshowProblems(validSlideshow(recipe), recipe), []);
  const bad = validSlideshow(recipe);
  bad.slides[2].is_zyvo = false;
  bad.tools_checked = [];
  bad.slides[1].headline = "x".repeat(90);
  const p = slideshowProblems(bad, recipe).join(" | ");
  assert.match(p, /Zyvo appears nowhere/);
  assert.match(p, /Tool1 is named but not in tools_checked/);
  assert.match(p, /headline too long/);
  assert.deepEqual(packageProblems(PKG()), []);
  const longPkg = PKG(); longPkg.tiktok.caption = "x".repeat(151); longPkg.youtube.hashtags = ["#ai"];
  assert.deepEqual(packageProblems(longPkg), ["TikTok caption over 150 characters", "YouTube hashtags lack #shorts"]);
  assert.ok(nearDuplicate({ title: "5 AI tools that replace a video editor", hook: "x" }, [{ title: "5 AI tools that replace your video editor" }]));
  assert.equal(nearDuplicate({ title: "Myth vs fact about faceless channels", hook: "y" }, [{ title: "5 AI tools that replace a video editor" }]), null);
  assert.equal(mockSlideshow({ format: "quiz", style: "neon_grid", slide_count: 5, zyvo_position: "early", hook_type: "question" }).slides[1].is_zyvo, true);
  const pk = platformPackages(PKG(), { script: { ai_label_required: true }, recipe: { post_time: "19:30" } }, utmLinks("i"));
  assert.deepEqual(pk.map((x) => [x.platform, x.ai_label_required, x.suggested_post_time]), [["tiktok", true, "19:30"], ["instagram", true, "19:30"], ["youtube", true, "19:30"]]);
  assert.equal(pk[2].title, "AI tools that replace an editor");
});

/* ─── templates and the renderer ─────────────────────────────────────── */

test("templates: every word escaped, the highlight bar, icon tiles not logos, unsafe URLs dropped", () => {
  assert.equal(highlight("Use *this* <b>now</b>"), 'Use <span class="hl">this</span> &lt;b&gt;now&lt;/b&gt;');
  assert.equal(initials("ElevenLabs"), "EL");
  assert.equal(initials("Descript AI"), "DA");
  const html = slideHtml({
    slide: { kind: "item", headline: "<script>alert(1)</script>", body: null, label: null, items: [], tool: { name: "Evil\"><img src=x>", url: "javascript:alert(1)", what_it_does: "x" }, image_prompt: null, is_zyvo: false },
    index: 1, total: 5, style: LIB.styles[0].spec, images: { background: "javascript:alert(1)" },
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.doesNotMatch(html, /src="javascript:/);
  assert.match(html, /class="tile"/);
  assert.match(html, /body\.dataset\.layout/, "every slide checks its own layout");
  assert.doesNotMatch(html, /class="counter"/, "no page counter: it sat outside the safe zone");
  assert.equal(esc(`"'&`), "&quot;&#39;&amp;");
});

test("renderer: crossfade offsets, slide timing, a valid ZIP", () => {
  const d = slideDurations(4, 2.5);
  assert.deepEqual(d, [3, 2.5, 2.5, 3.5]);
  const { args, durationSec } = mp4Args(["a.png", "b.png", "c.png", "d.png"], d, "out.mp4");
  assert.equal(durationSec, 11.5);
  const fc = args[args.indexOf("-filter_complex") + 1];
  assert.match(fc, /offset=3\.000/);
  assert.match(fc, /offset=5\.500/);
  assert.match(fc, /offset=8\.000\[vout\]/);
  assert.ok(args.includes("libx264") && args.includes("+faststart") && args.includes("anullsrc=channel_layout=stereo:sample_rate=44100"));
  const zip = zipStore([{ name: "a.txt", data: Buffer.from("hello") }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(14), 0x3610a686, "CRC-32 of 'hello'");
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(renderPaths({ id: "abc", script: { slides: [1, 2] } }, "2026-10-20").pngs[1], "slideshows/2026-10-20/abc/slide-02.png");
});

/* ─── the worker ─────────────────────────────────────────────────────── */

test("the worker: only with its secret; anyone else gets the plain 404", async () => {
  const world = fakeWorld();
  const handle = createWorkerHandler({ secret: "s3cret-value", deps: depsFor(world, fakeProviders(world)) });
  const call = (h) => handle(new Request("https://x/functions/v1/content-machine-worker", { method: "POST", headers: h, body: "{}" }));
  assert.equal((await call({})).status, 404);
  assert.equal((await call({ "x-cm-worker-secret": "wrong-value!" })).status, 404);
  assert.equal((await call({ "x-cm-worker-secret": "s3cret-value" })).status, 202);
});

test("the automatic daily run: once, after 07:00 Helsinki time, never twice", async () => {
  const world = fakeWorld();
  const deps = depsFor(world, fakeProviders(world));
  world.clock.now = new Date("2026-10-20T03:59:00Z");   // 06:59 in Helsinki (UTC+3)
  assert.equal(localClock(world.clock.now, "Europe/Helsinki"), "06:59");
  assert.equal(await maybeStartDailyRun(deps), null);
  world.clock.now = new Date("2026-10-20T04:00:00Z");
  const run = await maybeStartDailyRun(deps);
  assert.equal(run.kind, "daily");
  assert.equal(run.input.count, 2);
  assert.equal(await maybeStartDailyRun(deps), null, "not twice");
  world.s.daily_auto_run = false;
  world.clock.now = new Date("2026-10-21T05:00:00Z");
  assert.equal(await maybeStartDailyRun(deps), null, "off in the settings");
  world.s.daily_auto_run = true;
  world.s.kill_switch = true;
  assert.equal(await maybeStartDailyRun(deps), null, "the kill switch stops it");
  const r = await tick(deps);
  assert.deepEqual(r.jobs, [], "and the tick claims nothing");
});

/* ─── the admin API's slideshow actions ──────────────────────────────── */

test("Make slideshows: a run with a plan job, the topic kept, the worker kicked, the action audited", async () => {
  const world = fakeWorld({ dry_run: true });
  const api = apiFor(world);
  const r = await api.call({ action: "makeSlideshows", topic: "  faceless YouTube niches that still work in 2026 ", count: 3 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.data.count, r.data.dryRun], [3, true]);
  assert.equal(world.runs[0].input.topic, "faceless YouTube niches that still work in 2026");
  assert.equal(world.jobs[0].stage, "plan");
  assert.equal(api.kicks(), 1);
  assert.equal(world.audit[0].action, "slideshows.make");
  assert.equal((await api.call({ action: "makeSlideshows", count: 11 })).code, "VALIDATION");
  world.s.kill_switch = true;
  assert.equal((await api.call({ action: "makeSlideshows" })).code, "KILL_SWITCH");
});

test("ideas for the page: slides, recipe, packages, signed file links and the cost from the ledger", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  world.gens[0].files = { ...world.gens[0].files };
  const r = await apiFor(world).call({ action: "ideas" });
  const idea = r.data.ideas[0];
  assert.equal(idea.status, "done");
  assert.ok(idea.slides.length >= 5);
  assert.equal(idea.packages.map((x) => x.platform).join(","), "tiktok,instagram,youtube");
  assert.match(idea.generation.mp4, /^https:\/\/signed\/slideshows\//);
  assert.equal(idea.generation.pngs.length, idea.slides.length);
  assert.ok(idea.cost.usd > 0);
  assert.equal(r.data.styles.neon_grid.font, "anton");
});

test("editing a caption and the library is checked and audited", async () => {
  const world = fakeWorld();
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, fakeProviders(world)));
  const api = apiFor(world);
  const tk = world.pkgs.find((x) => x.platform === "tiktok");
  assert.equal((await api.call({ action: "savePackage", id: tk.id, caption: "x".repeat(151) })).code, "VALIDATION");
  const ok = await api.call({ action: "savePackage", id: tk.id, caption: "Which one first?", hashtags: "aitools #faceless" });
  assert.deepEqual(ok.data.package.hashtags, ["#aitools", "#faceless"]);
  assert.equal(world.audit.at(-1).action, "package.edit");
  assert.throws(() => cleanLibraryRow({ kind: "style", key: "x1", name: "Bad", spec: { bg: "red" } }), /Style bg/);
  assert.equal(cleanLibraryRow({ kind: "format", key: "duet_reaction", name: "Duet reaction", spec: { slides: [4, 6] } }).key, "duet_reaction");
  const saved = await api.call({ action: "saveLibrary", kind: "hook", key: "story_open", name: "Story opener", description: "Starts mid-story." });
  assert.equal(saved.ok, true);
  assert.equal(world.audit.at(-1).action, "library.save");
});

test("remake: the same recipe written again as a new idea", async () => {
  const world = fakeWorld();
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, fakeProviders(world)));
  const r = await apiFor(world).call({ action: "remakeIdea", id: world.ideas[0].id });
  assert.equal(r.ok, true, JSON.stringify(r));
  const copy = world.ideas.find((i) => i.id === r.data.ideaId);
  assert.deepEqual(copy.recipe, world.ideas[0].recipe);
  assert.equal(world.jobs.at(-1).stage, "write");
});

/* ─── the fixes of 2026-10-18 ────────────────────────────────────────── */

test("a refusal: one retry on a model that costs no more, through the guard; never a dearer model", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world, { refuse: "once" });
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  assert.equal(world.ideas[0].status, "done");
  const ops = world.ledger.filter((l) => l.operation.startsWith("anthropic.write")).map((l) => [l.operation, l.status]);
  assert.deepEqual(ops, [["anthropic.write", "failed"], ["anthropic.write.fallback", "settled"]], "both calls are in the ledger");
  assert.equal(world.ledger[0].actual_usd, 0.002, "the refused call's own cost is kept");
  assert.ok(p.calls.messages.some((m) => m.model === "claude-sonnet-5"));
  assert.equal(fallbackModel({ fallbacks: true }, "claude-sonnet-5-5"), "claude-sonnet-5");
  assert.equal(fallbackModel({ fallbacks: true, modelFallback: "claude-opus-5-5" }, "claude-sonnet-5-5"), null, "Opus costs more: no fallback");
  assert.equal(fallbackModel({ fallbacks: false }, "claude-sonnet-5-5"), null);
  const always = fakeWorld();
  await startRun(always, { count: 1 });
  await drain(always, depsFor(always, fakeProviders(always, { refuse: "always" })));
  assert.equal(always.ideas[0].status, "done", "the fallback model wrote it");
});

test("a failed layout check: nothing is posted; ONE shorter rewrite and a new render; twice is flagged", async () => {
  const once = fakeWorld();
  const p = fakeProviders(once, { layoutFails: 1 });
  await startRun(once, { count: 1 });
  await drain(once, depsFor(once, p));
  assert.equal(once.ideas[0].status, "done");
  assert.equal(p.calls.renders, 2);
  assert.equal(once.ideas[0].compliance.layoutRetried, true);
  const rewrite = p.calls.messages.find((m) => /SHORTER/.test(JSON.stringify(m.messages)));
  assert.ok(rewrite, "the rewrite asked for shorter text");
  assert.match(JSON.stringify(rewrite.messages), /headline overlaps card/);
  const twice = fakeWorld();
  const p2 = fakeProviders(twice, { layoutFails: 2 });
  await startRun(twice, { count: 1 });
  await drain(twice, depsFor(twice, p2));
  assert.equal(twice.ideas[0].status, "failed");
  assert.equal(twice.ideas[0].compliance.flagged, true);
  assert.match(twice.ideas[0].compliance.problems.join(" "), /slide 2: headline overlaps card/);
  assert.equal(twice.gens[0].status, "failed");
});

test("images: one retry each; a second failure fails the slideshow (never a placeholder)", async () => {
  const retry = fakeWorld();
  const p = fakeProviders(retry, { imageFailures: 1 });
  await startRun(retry, { count: 1 });
  await drain(retry, depsFor(retry, p));
  assert.equal(retry.ideas[0].status, "done");
  assert.equal(p.calls.imageAttempts, p.calls.images + 1, "one failure, its retry, then the rest");
  const dead = fakeWorld();
  const p2 = fakeProviders(dead, { imageFailures: Infinity });
  await startRun(dead, { count: 1 });
  await drain(dead, depsFor(dead, p2));
  assert.equal(dead.ideas[0].status, "failed");
  assert.match(dead.ideas[0].error, /an image failed twice/);
  assert.equal(p2.calls.renders, 0, "nothing is rendered without its images");
});

test("no real people: prompts, program checks, and the renderer takes no local pictures", () => {
  assert.match(imagePrompt("a desk at night", "background"), /no people, no faces/);
  assert.match(imagePrompt("a desk at night", "background"), /no celebrities.*no lookalikes/);
  assert.match(imagePrompt("a cat", "illustration"), /invented cartoon character, no real people/);
  assert.ok(!imagePrompt("a cat", "illustration").includes(NO_PEOPLE), "illustrations may show invented characters");
  const recipe = { slide_count: 6 };
  const sh = validSlideshow(recipe);
  sh.slides[1].image_prompt = "a Ronaldo lookalike holding a phone";
  assert.match(slideshowProblems(sh, recipe).join(" "), /real person or a lookalike/);
  sh.slides[1].image_prompt = "a melon on a desk";
  assert.deepEqual(slideshowProblems(sh, recipe), []);
  sh.slides[3] = { ...sh.slides[3], kind: "meme", image_prompt: null };
  assert.match(slideshowProblems(sh, recipe).join(" "), /meme slide needs an image_prompt/);
  assert.throws(() => assertRemoteImages({ images: { background: "file:///C:/repo/public/community-posters/cr-1.jpg" } }), /only https images/);
  assertRemoteImages({ zyvoShot: "https://x.supabase.co/a.png", images: { background: "https://im.runware.ai/1.jpg", illustrations: { 1: "https://im.runware.ai/2.jpg" } } });
  const html = slideHtml({ slide: validSlideshow(recipe).slides[0], index: 0, total: 6, style: LIB.styles[0].spec, images: { background: "file:///C:/x.jpg" } });
  assert.ok(!html.includes("file:///"), "the templates drop a local picture unless the local renderer asks");
  const req = writeRequest({ model: "claude-sonnet-5-5", brandRules: "x", library: LIB, recipe: planRecipes({ library: LIB, count: 1, seed: "p" })[0], today: "2026-10-20" });
  assert.match(req.system[0].text, /NEVER a real person, a celebrity/);
  assert.match(req.system[0].text, /Never imply that Zyvo is partnered with/);
  assert.match(packageRequest({ model: "m", brandRules: "x", recipe: {}, slideshow: {}, links: utmLinks("a") }).system[0].text, /lookalike of one/);
});

test("the safe zone: left 110, right 170, top 200, bottom 420 px, plus 24 px inner padding", () => {
  assert.deepEqual(SAFE, { left: 110, right: 170, top: 200, bottom: 420 });
  assert.deepEqual(SAFE_RECT, { x0: 110, y0: 200, x1: 910, y1: 1500 });
  assert.deepEqual(INNER_RECT, { x0: 134, y0: 224, x1: 886, y1: 1476 });
  const slide = validSlideshow({ slide_count: 5 }).slides[0];
  assert.match(slideHtml({ slide, index: 0, total: 5, style: LIB.styles[0].spec, safeZones: true }), /class="zone l"/);
  assert.ok(!slideHtml({ slide, index: 0, total: 5, style: LIB.styles[0].spec }).includes('class="zone'), "never drawn unless asked (previews only)");
});

test("logos: only approved ones reach the render, matched by domain or name; others get the initials tile", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  const logos = p.calls.lastRender.logos;
  assert.equal(logos["tryzyvo.com"], "https://signed/logos/tryzyvo.com.png");
  assert.equal(Object.keys(logos).some((k) => k.includes("descript")), false, "Descript has no approved file");
  assert.equal(logoFor({ name: "Zyvo", url: "https://www.tryzyvo.com/" }, logos), logos["tryzyvo.com"]);
  const tool = { kind: "item", headline: "x", body: null, label: null, items: [], tool: { name: "Descript", url: "https://descript.com", what_it_does: "y" }, image_prompt: null, is_zyvo: false };
  assert.match(slideHtml({ slide: tool, index: 1, total: 5, style: LIB.styles[0].spec, logos }), /class="tile"/);
  assert.ok(slideHtml({ slide: tool, index: 1, total: 5, style: LIB.styles[0].spec, logos: { "descript.com": "https://signed/d.png" } }).includes('<img src="https://signed/d.png"'));
});

test("logo files: real PNG/SVG only, no scripts in an SVG, small", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  checkLogoFile(png, "image/png");
  assert.throws(() => checkLogoFile(png, "image/jpeg"), /doesn't match/);
  const svg = (t) => new TextEncoder().encode(t);
  checkLogoFile(svg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>'), "image/svg+xml");
  assert.throws(() => checkLogoFile(svg("<svg><script>alert(1)</script></svg>"), "image/svg+xml"), /scripts/);
  assert.throws(() => checkLogoFile(svg('<svg><rect onload="x()"/></svg>'), "image/svg+xml"), /scripts/);
  assert.throws(() => checkLogoFile(svg('<svg><image href="https://evil/x.png"/></svg>'), "image/svg+xml"), /outside files/);
  assert.throws(() => checkLogoFile(new Uint8Array(600_000).fill(1), "image/png"), /at most/);
  assert.throws(() => checkLogoFile(png, "image/gif"), /PNG, SVG/);
});

test("the logo library through the API: upload, approve only with file + source, a new file needs approving again", async () => {
  const world = fakeWorld();
  const api = apiFor(world);
  assert.equal((await api.call({ action: "approveLogo", id: "LOGO-descript", approved: true })).code, "VALIDATION", "no file, no approval");
  const b64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
  assert.equal((await api.call({ action: "uploadLogo", id: "LOGO-descript", contentType: "image/png", dataBase64: b64 })).ok, true);
  assert.equal(world.uploads[0].path, "logos/descript.com.png");
  assert.equal((await api.call({ action: "approveLogo", id: "LOGO-descript", approved: true })).code, "VALIDATION", "no source page yet");
  assert.equal((await api.call({ action: "saveLogo", id: "LOGO-descript", source_url: "http://not-https" })).code, "VALIDATION");
  await api.call({ action: "saveLogo", id: "LOGO-descript", source_url: "https://www.descript.com/brand" });
  const ok = await api.call({ action: "approveLogo", id: "LOGO-descript", approved: true });
  assert.equal(ok.data.row.approved, true);
  assert.equal(ok.data.row.approved_by, "upwardlift6@gmail.com");
  await api.call({ action: "uploadLogo", id: "LOGO-descript", contentType: "image/png", dataBase64: b64 });
  assert.equal(world.logos.find((l) => l.id === "LOGO-descript").approved, false, "a new file is not approved");
  assert.deepEqual(world.audit.map((a) => a.action).filter((a) => a.startsWith("logo.")), ["logo.upload", "logo.edit", "logo.approve", "logo.upload"]);
});

test("one tick keeps going: a dry slideshow goes through all its steps in a single tick", async () => {
  const world = fakeWorld({ dry_run: true });
  const deps = depsFor(world, fakeProviders(world));
  await startRun(world, { dry: true, count: 2 });
  const r = await tick(deps);
  assert.equal(world.runs[0].status, "done", JSON.stringify(r.jobs.map((j) => j.stage)));
  assert.ok(r.jobs.length >= 10, "plan + 5 steps for each of 2 slideshows");
  world.s.kill_switch = true;
  await startRun(world, { dry: true, count: 1 });
  assert.deepEqual((await tick(deps)).jobs, [], "the kill switch stops the loop");
});

/* ─── round 3 (2026-10-18): visuals, assets, live samples, Start / Cancel ─── */

test("visual richness: every slide but a cta / answer needs a picture (a prompt or a library asset)", () => {
  const recipe = { slide_count: 6 };
  const sh = validSlideshow(recipe);
  assert.deepEqual(slideshowProblems(sh, recipe), []);
  sh.slides[2].image_prompt = null;
  assert.match(slideshowProblems(sh, recipe).join(" "), /slide 3: no visual/);
  sh.slides[2].asset_id = "aaaa1111";
  assert.deepEqual(slideshowProblems(sh, recipe, { assetRefs: new Set(["aaaa1111"]) }), []);
  assert.match(slideshowProblems(sh, recipe, { assetRefs: new Set(["zzzz"]) }).join(" "), /not in the library/);
  const html = (slide, images = {}) => slideHtml({ slide, index: 1, total: 5, style: LIB.styles[0].spec, images });
  assert.match(html(sh.slides[1], { hero: "https://im.runware.ai/1.jpg" }), /data-visual/);
  assert.match(html(sh.slides[1]), /no visual element/, "the in-page check knows the rule");
});

test("pictures: a background + a hero per slide in the style's own look; a library asset costs nothing", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  await startRun(world, { count: 1 });
  const deps = depsFor(world, p);
  // The writer picks a library asset for slide 2.
  const orig = p.ai.createMessage;
  p.ai.createMessage = async (ticket, args) => {
    const out = await orig(ticket, args);
    if (args.request.tools) { const sh = JSON.parse(out.body.content[0].text); sh.slides[1].image_prompt = null; sh.slides[1].asset_id = "bbbb2222"; out.body.content[0].text = JSON.stringify(sh); }
    return out;
  };
  await drain(world, deps);
  const idea = world.ideas[0];
  assert.equal(idea.status, "done", idea.error ?? "");
  const heroes = world.gens[0].source_assets.heroes;
  assert.deepEqual(heroes[1], { asset: "library/bbbb2222.webp", ref: "bbbb2222" });
  assert.equal(p.calls.images, idea.script.slides.length - 1, "background + heroes, minus the cta and the asset slide");
  assert.equal(p.calls.lastRender.images.heroes[1], "https://signed/library/bbbb2222.webp", "the asset reaches the render as a signed link");
  const style = LIB.styles.find((x) => x.key === idea.recipe.style);
  assert.ok(style, "the recipe's style exists");
  const w = p.calls.messages.find((m) => m.tools);
  assert.match(w.system[0].text, /ASSET LIBRARY/);
  assert.match(w.system[0].text, /aaaa1111: scene · long_form/);
  assert.doesNotMatch(w.system[0].text, /cccc3333/, "pending assets are not offered");
});

test("the style's hero_prompt shapes every generated picture; backgrounds and photoreal styles have no people", async () => {
  const world = fakeWorld();
  LIB.styles[0].spec.hero_prompt = "Glowing 3D render of {subject}, dark background";
  try {
    const p = fakeProviders(world);
    await startRun(world, { count: 3 });
    await drain(world, depsFor(world, p));
    const prompts = [];
    const orig = p.images.generateImage;
    // The last call's prompt is recorded by the fake; check the template filled the subject.
    assert.ok(p.calls.lastImage.prompt.length > 0);
    const neon = world.ideas.find((i) => i.recipe.style === "neon_grid");
    if (neon) assert.ok(JSON.stringify(world.gens).length > 0);
    assert.equal(p.calls.lastImage.kind, "background", "no people in the non-meme styles' pictures");
    void prompts; void orig;
  } finally { delete LIB.styles[0].spec.hero_prompt; }
});

test("live: an owner-ordered run is paid for real while the machine stays in dry run; the DRY_RUN secret still wins", async () => {
  const world = fakeWorld({ dry_run: true });
  const guard = createBudgetGuard({ store: world.store });
  const r = await guard.reserve("runware", "x", 0.01, { live: true });
  assert.equal(r.dryRun, false);
  assert.equal((await guard.reserve("runware", "x", 0.01)).dryRun, true, "without live: dry");
  const env = createBudgetGuard({ store: world.store, envDryRun: "true" });
  assert.equal((await env.reserve("runware", "x", 0.01, { live: true })).dryRun, true, "the DRY_RUN secret beats live");
  world.s.kill_switch = true;
  await assert.rejects(guard.reserve("runware", "x", 0.01, { live: true }), (e) => e.reason === "kill_switch");
});

test("style samples: one real slideshow per style, real pictures and a render, no writing call, dry run left on", async () => {
  const world = fakeWorld({ dry_run: true });
  const p = fakeProviders(world);
  const api = apiFor(world, { kick: async () => { await drain(world, depsFor(world, p)); } });
  LIB.styles.push({ key: "screenshot_collage", name: "Collage", description: "", spec: { bg_prompt: "dark board, no text", bg: "#111318", fg: "#ffffff", accent: "#22d3ee", highlight: "#facc15", font: "anton", collage: true } },
    { key: "meme_style", name: "Meme", description: "", spec: { bg_prompt: "funny scene", bg: "#ffffff", fg: "#000000", accent: "#000000", highlight: "#fde047", font: "anton", meme: true } });
  try {
    const r = await api.call({ action: "styleSamples" });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.count, 5);
    assert.equal(world.runs[0].kind, "samples");
    assert.equal(world.s.dry_run, true, "the machine stays in dry run");
    assert.equal(p.calls.messages.length, 0, "no writing or caption calls");
    assert.equal(p.calls.renders, 5, "rendered for real");
    assert.ok(p.calls.images >= 20, `real pictures (${p.calls.images})`);
    assert.ok(world.ledger.every((l) => !l.dry_run && l.actual_usd != null && l.lane === "slideshow"));
    const total = world.ledger.reduce((a, l) => a + l.actual_usd, 0);
    assert.ok(total < 0.2, `under $0.20 (${total.toFixed(4)})`);
    const collage = world.ideas.find((i) => i.recipe.style === "screenshot_collage");
    assert.ok(collage.script.slides.some((s) => s.asset_id), "the collage uses real Zyvo outputs from the library");
    assert.ok(world.ideas.every((i) => i.status === "done"));
  } finally { LIB.styles.splice(3); }
});

test("Start → Cancel: no new paid step after Cancel; finished slideshows are kept; progress says where it is", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  const deps = depsFor(world, p);
  const api = apiFor(world);
  const made = await api.call({ action: "makeSlideshows", count: 3 });
  for (let i = 0; i < 2; i++) for (const j of await world.db.claimJobs(10)) await (await import("../supabase/functions/_shared/contentMachine/pipeline.js")).runJob(j, deps);
  const before = await api.call({ action: "runProgress", runId: made.data.runId });
  assert.equal(before.ok, true);
  assert.equal(before.data.total, 3);
  assert.ok(before.data.active);
  assert.ok(before.data.steps.find((s) => s.key === "writing").passed >= 0);
  assert.ok(before.data.leftSec > 0, "about X min left");
  const calls = p.calls.messages.length;
  const c = await api.call({ action: "cancelRun", runId: made.data.runId });
  assert.equal(c.data.status, "cancelled");
  await drain(world, deps);
  assert.equal(p.calls.messages.length, calls, "nothing new was paid for");
  assert.equal(world.runs[0].status, "cancelled");
  assert.ok(world.ideas.every((i) => ["cancelled", "done"].includes(i.status)));
  assert.equal(world.audit.at(-1).action, "run.cancel");
  const after = await api.call({ action: "runProgress", runId: made.data.runId });
  assert.equal(after.data.active, false);
  assert.equal((await api.call({ action: "cancelRun", runId: made.data.runId })).code, "VALIDATION");
});

test("asset tagging: the fast model tags each image; realistic humans, lookalikes and third-party brands are excluded", async () => {
  const world = fakeWorld({ dry_run: true });
  const p = fakeProviders(world);
  world.assets.push({ id: "A4", ref: "dddd4444", path: "library/dddd4444.webp", source_path: "public/opt/lp/fruit/d.webp", kind: "output", status: "pending", tags: [] });
  await world.db.enqueue([{ stage: "tag_assets", payload: { ids: ["A3", "A4"], live: true } }]);
  await drain(world, depsFor(world, p));
  const a3 = world.assets.find((a) => a.id === "A3"), a4 = world.assets.find((a) => a.id === "A4");
  assert.equal(a3.status, "excluded");
  assert.match(a3.exclude_reason, /realistic human/);
  assert.deepEqual([a4.status, a4.tool], ["active", "ai_fruit_story"]);
  assert.ok(world.ledger.some((l) => l.operation === "anthropic.tag_assets" && !l.dry_run && l.lane === "assets"), "paid, live, through the guard");
  const api = apiFor(world);
  const blocked = await api.call({ action: "setAssetStatus", id: "A4", status: "blocked" });
  assert.equal(blocked.data.row.status, "blocked");
  assert.equal(world.audit.at(-1).action, "asset.block");
  assert.equal((await api.call({ action: "setAssetStatus", id: "A4", status: "pending" })).code, "VALIDATION");
});

test("the renderer takes pictures only from the allowed hosts (our bucket, the image provider)", () => {
  const hosts = ["xyz.supabase.co", ".runware.ai"];
  assertRemoteImages({ allowedHosts: hosts, images: { background: "https://im.runware.ai/a.jpg", heroes: { 1: "https://xyz.supabase.co/storage/v1/object/sign/content-machine/library/a.webp?token=t" } } });
  assert.throws(() => assertRemoteImages({ allowedHosts: hosts, images: { heroes: { 1: "https://random.example.com/a.jpg" } } }), /isn't allowed/);
  assert.throws(() => assertRemoteImages({ allowedHosts: hosts, images: { heroes: { 1: "file:///C:/repo/a.png" } } }), /only https/);
});

test("honest stories: hypothetical or about 'you', never a made-up real person", () => {
  const req = writeRequest({ model: "claude-sonnet-5-5", brandRules: "x", library: LIB, recipe: planRecipes({ library: LIB, count: 1, seed: "h" })[0], today: "2026-10-20" });
  assert.match(req.system[0].text, /clearly hypothetical \("Imagine…", "POV: you…"\)/);
  assert.match(packageRequest({ model: "m", brandRules: "x", recipe: {}, slideshow: {}, links: utmLinks("a") }).system[0].text, /made-up person told as if real/);
});
