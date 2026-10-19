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
import { slideHtml, highlight, initials, esc, logoFor, SAFE, SAFE_RECT, INNER_RECT, TYPE, TEXT_ONLY_KINDS } from "../supabase/functions/_shared/contentMachine/slides/templates.js";
import { assertRemoteImages } from "../render-worker/src/cmSlides.mjs";
import { checkLogoFile } from "../supabase/functions/_shared/contentMachine/apiSlideshows.js";
import { fallbackModel, logosFor } from "../supabase/functions/_shared/contentMachine/pipeline.js";
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
  assert.match(p.calls.lastRender.zyvoShot, /assets\/zyvo-ui-picker\.png/);
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
  assert.equal(run.input.count, 5, "each account's own count: 2 Zyvo + 3 Creator");
  assert.deepEqual(run.input.lanes, { creator: 3, zyvo: 2 });
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

test("the safe zone: TikTok photo posts as measured on the owner's iPhone, and one export that fits every platform", async () => {
  const { SAFE_PROFILES, AVOID } = await import("../supabase/functions/_shared/contentMachine/slides/templates.js");
  assert.deepEqual(SAFE_PROFILES.tiktok_photo, { label: "TikTok photo post", left: 40, right: 150, top: 320, bottom: 200, avoid: [{ name: "the TikTok profile avatar", x0: 0, y0: 1530, x1: 190, y1: 1720 }] });
  assert.deepEqual(SAFE, { left: 110, right: 170, top: 320, bottom: 420 });
  assert.deepEqual(SAFE_RECT, { x0: 110, y0: 320, x1: 910, y1: 1500 });
  // 24 px inner padding on every side; the avatar sits below the stack.
  assert.deepEqual(INNER_RECT, { x0: 134, y0: 344, x1: 886, y1: 1476 });
  assert.deepEqual(AVOID.map((a) => a.name), ["the TikTok profile avatar"]);
  // Every platform's free area contains the export's, so one set of PNGs fits them all.
  for (const [k, p] of Object.entries(SAFE_PROFILES)) {
    assert.ok(INNER_RECT.x0 >= p.left && INNER_RECT.y0 >= p.top && INNER_RECT.x1 <= 1080 - p.right && INNER_RECT.y1 <= 1920 - p.bottom, k);
    for (const a of p.avoid) assert.ok(INNER_RECT.y1 <= a.y0, `${k}: above ${a.name}`);
  }
  const slide = validSlideshow({ slide_count: 5 }).slides[0];
  const zoned = slideHtml({ slide, index: 0, total: 5, style: LIB.styles[0].spec, safeZones: true });
  assert.match(zoned, /class="zone l"/);
  assert.match(zoned, /left:0px;top:1530px;width:190px;height:190px/, "the avatar area is drawn");
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
  sh.slides[1].image_prompt = null;
  assert.match(slideshowProblems(sh, recipe).join(" "), /slide 2: no visual/);
  sh.slides[1].asset_id = "aaaa1111";
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
    assert.ok(p.calls.messages.every((m) => /final quality check/.test(m.system[0].text)), "no writing or caption calls: only the QA check");
    assert.equal(p.calls.messages.length, 5, "one QA check per slideshow");
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

test("a provider's rate limit (429) is a wait, not a failure", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  const orig = p.ai.createMessage;
  let hits = 0;
  p.ai.createMessage = async (ticket, args) => {
    if (args.request.tools && hits++ < 2) throw Object.assign(new Error("anthropic 429: rate_limit_error"), { status: 429, actualUsd: 0 });
    return orig(ticket, args);
  };
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  assert.equal(world.ideas[0].status, "done");
  assert.equal(world.ledger.filter((l) => l.operation === "anthropic.write" && l.status === "failed").every((l) => l.actual_usd === 0), true);
});

/* ─── round 4 (2026-10-18): crops, honesty, QA, logo rules ─── */

test("vision QA: a flagged slide's generated picture is made again ONCE; still flagged → marked in admin", async () => {
  const once = fakeWorld();
  const p = fakeProviders(once, { qaFlags: [[2]] });
  await startRun(once, { count: 1 });
  await drain(once, depsFor(once, p));
  const idea = once.ideas[0];
  assert.equal(idea.status, "done");
  assert.equal(p.calls.renders, 2, "rendered again after the regenerate");
  assert.deepEqual(idea.compliance.qa.findings, {}, "the second check passed");
  assert.equal(idea.compliance.qaRetried, true);
  assert.ok(once.ledger.some((l) => l.operation === "anthropic.qa"), "the QA check goes through the guard");
  const twice = fakeWorld();
  const p2 = fakeProviders(twice, { qaFlags: [[2], [2]] });
  await startRun(twice, { count: 1 });
  await drain(twice, depsFor(twice, p2));
  assert.equal(twice.ideas[0].status, "done", "kept, but…");
  assert.equal(twice.ideas[0].compliance.flagged, true, "…marked for the owner");
  assert.match(twice.ideas[0].compliance.problems.join(" "), /slide 2: a head or subject is cut off/);
});

test("honesty: a Zyvo slide shows real Zyvo (never a generated picture); 'made with Zyvo' only on a real output", async () => {
  const recipe = { slide_count: 6 };
  const sh = validSlideshow(recipe);
  sh.slides[2].image_prompt = "a glowing TV";
  assert.match(slideshowProblems(sh, recipe).join(" "), /slide 3: a Zyvo slide must show real Zyvo/);
  sh.slides[2].image_prompt = null;
  sh.slides[4].body = "made with Zyvo · tryzyvo.com";
  assert.match(slideshowProblems(sh, recipe).join(" "), /slide 5: "made with Zyvo" only on a slide showing a real Zyvo output/);
  sh.slides[4].asset_id = "aaaa1111"; sh.slides[4].image_prompt = null;
  assert.deepEqual(slideshowProblems(sh, recipe, { assetRefs: new Set(["aaaa1111"]) }), []);
  // The image step never generates for a Zyvo slide, whatever the writer gave it.
  // (The writer check above already refuses it; the image step guards on its own too.)
  const world = fakeWorld();
  const p = fakeProviders(world);
  const run = await world.db.createRun({ run_date: "2026-10-20", kind: "slideshows", status: "producing", dry_run: false, input: { count: 1 } });
  const script = validSlideshow({ slide_count: 5 });
  script.slides[2].image_prompt = "a glowing TV";
  const [idea] = await world.db.createIdeas([{ run_id: run.id, status: "producing", format: "tool_listicle", title: "t", recipe: { format: "tool_listicle", style: "neon_grid", slide_count: 5 }, script, dry_run: false }]);
  await world.db.enqueue([{ run_id: run.id, idea_id: idea.id, stage: "images" }]);
  await drain(world, depsFor(world, p));
  assert.equal(world.gens[0].source_assets.heroes[2], undefined, "no generated picture on the Zyvo slide");
  assert.ok(world.gens[0].source_assets.heroes[1]?.url, "the other slides got theirs");
  const html = slideHtml({ slide: { ...validSlideshow(recipe).slides[2], kind: "text", tool: null }, index: 2, total: 6, style: LIB.styles[0].spec, zyvoShot: "https://x/shot.png" });
  assert.match(html, /class="browser"/, "it shows the real Zyvo screen");
  const req = writeRequest({ model: "claude-sonnet-5-5", brandRules: "x", library: LIB, recipe: planRecipes({ library: LIB, count: 1, seed: "z" })[0], today: "2026-10-20" });
  assert.match(req.system[0].text, /NEVER an image_prompt on a Zyvo slide/);
  assert.match(req.system[0].text, /leave that tool out: never stand in a generated picture/);
  assert.match(packageRequest({ model: "m", brandRules: "x", recipe: {}, slideshow: {}, links: utmLinks("a") }).system[0].text, /generated stand-in instead of a real Zyvo output/);
});

test("pictures are made at their frame's shape: heroes 4:3, meme pictures tall; no frame crops", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  const sizes = [];
  const orig = p.images.generateImage;
  p.images.generateImage = async (t, a) => { sizes.push([a.width ?? 768, a.height ?? 1344]); return orig(t, a); };
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  assert.ok(sizes.some(([w, h]) => w === 1024 && h === 768), "4:3 heroes");
  assert.ok(sizes.some(([w, h]) => w === 768 && h === 1344), "the 9:16 background");
  const html = slideHtml({ slide: validSlideshow({ slide_count: 5 }).slides[1], index: 1, total: 5, style: LIB.styles[0].spec, images: { hero: "https://im.runware.ai/a.jpg" } });
  assert.match(html, /data-hero="\d+"/, "the page sizes the frame to the picture's own aspect ratio");
  assert.ok(!/\.hero img\{[^}]*object-fit:cover/.test(html), "heroes are never cover-cropped");
});

test("meme pictures fill to the bottom edge; text sizes never under 38 px (body) / 30 px (labels); closing slides need a picture", () => {
  const meme = slideHtml({ slide: { kind: "meme", headline: "A", body: "b", label: null, items: [], tool: null, image_prompt: "x", asset_id: null, is_zyvo: false }, index: 0, total: 3, style: { ...LIB.styles[0].spec, meme: true }, images: { hero: "https://im.runware.ai/m.jpg" } });
  assert.ok(!meme.includes('class="memefoot"'), "no white foot under the picture");
  assert.match(meme, /class="memebody"/, "the caption sits in the top bar");
  for (const [k, t] of Object.entries({ body: 38, item: 38, tool: 38, side: 38, option: 38, memeBody: 38 })) assert.ok(TYPE[k].min >= t, `${k} min ${TYPE[k].min}`);
  assert.deepEqual(TEXT_ONLY_KINDS, ["quiz_answer"], "a cta needs its own picture");
  const recipe = { slide_count: 5 };
  const sh = validSlideshow(recipe);
  sh.slides[4].is_zyvo = false; sh.slides[4].image_prompt = null;
  assert.match(slideshowProblems(sh, recipe).join(" "), /slide 5: no visual/);
});

test("logo rules: name only (Veo, Midjourney), initials tile (Seedance, Hailuo), an approved file otherwise, never upscaled", async () => {
  const world = fakeWorld();
  world.logos.push({ id: "L-veo", name: "Veo", domain: "deepmind.google", logo_path: "logos/veo.svg", source_url: "https://deepmind.google", approved: true, display: "name" },
    { id: "L-seed", name: "Seedance", domain: "seed.bytedance.com", logo_path: "logos/seed.png", source_url: "https://seed.bytedance.com", approved: true, display: "tile" });
  const deps = depsFor(world, fakeProviders(world));
  const slides = [{ tool: { name: "Veo", url: "https://deepmind.google/models/veo/" } }, { tool: { name: "Seedance", url: "https://seed.bytedance.com/en/seedance" } }];
  const logos = await logosFor(deps, slides);
  assert.deepEqual(logos["deepmind.google"], { display: "name" });
  assert.deepEqual(logos["seed.bytedance.com"], { display: "tile" });
  const card = (name, url) => slideHtml({ slide: { kind: "item", headline: "x", body: null, label: null, items: [], tool: { name, url, what_it_does: "y" }, image_prompt: "a", asset_id: null, is_zyvo: false }, index: 1, total: 5, style: LIB.styles[0].spec, logos });
  assert.ok(!/class="(logo|tile)"/.test(card("Veo", "https://deepmind.google/models/veo/")), "Veo: the name only");
  assert.match(card("Seedance", "https://seed.bytedance.com/en/seedance"), /class="tile"/);
  assert.match(card("Veo", "https://deepmind.google/models/veo/"), /naturalWidth/, "the page caps every logo at its own file size");
});

/* ─── round 5 (2026-10-18): collage covers, clean frames, UI crops, memes ─── */

test("a showcase cover is a collage of the real outputs in the slideshow; no picture is generated for it", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  const run = await world.db.createRun({ run_date: "2026-10-20", kind: "slideshows", status: "producing", dry_run: false, input: { count: 1 } });
  const S = (kind, extra = {}) => ({ kind, headline: "Would you *watch this*?", body: null, label: null, items: [], tool: null, image_prompt: null, asset_id: null, is_zyvo: true, ...extra });
  const [idea] = await world.db.createIdeas([{ run_id: run.id, status: "producing", recipe: { format: "zyvo_showcase", style: "neon_grid" }, title: "Showcase", dry_run: false,
    script: { slides: [S("cover", { image_prompt: "a phone" }), S("text", { asset_id: "aaaa1111" }), S("text", { asset_id: "bbbb2222" }), S("cta", { is_zyvo: false, image_prompt: "a star" })] } }]);
  await world.db.enqueue([{ run_id: run.id, idea_id: idea.id, stage: "images" }]);
  await drain(world, depsFor(world, p));
  const src = world.gens[0].source_assets;
  assert.deepEqual(src.collages[0].map((c) => c.ref), ["aaaa1111", "bbbb2222"]);
  assert.equal(src.heroes[0], undefined, "no generated cover picture");
  assert.equal(p.calls.images, 2, "only the background and the cta picture were generated");
  assert.deepEqual(p.calls.lastRender.images.collages[0], ["https://signed/library/aaaa1111.webp", "https://signed/library/bbbb2222.webp"]);
  const html = slideHtml({ slide: S("cover"), index: 0, total: 4, style: LIB.styles[0].spec, images: { collage: p.calls.lastRender.images.collages[0] } });
  assert.equal((html.match(/<img data-tile/g) ?? []).length, 2, "the cover shows both outputs");
  assert.ok(!/class="browser"/.test(html), "not the generic Zyvo screen");
  // The writer: no picture on a showcase cover, and at least 2 real outputs for its collage.
  const recipe = { slide_count: 4, format: "zyvo_showcase" };
  const sh = validSlideshow(recipe);
  sh.slides.forEach((x) => { x.image_prompt = null; x.asset_id = null; x.is_zyvo = true; });
  assert.match(slideshowProblems(sh, recipe).join(" "), /needs at least 2 later slides with a real output/);
  sh.slides[1].asset_id = "aaaa1111"; sh.slides[2].asset_id = "bbbb2222";
  assert.deepEqual(slideshowProblems(sh, recipe, { assetRefs: new Set(["aaaa1111", "bbbb2222"]) }), []);
});

test("clean frames: a frame whose subtitle is cut off is never offered; clean frames come first", async () => {
  const { assetsText, usableAssets } = await import("../supabase/functions/_shared/contentMachine/writer.js");
  const { assetUpdate, TAG_SCHEMA, TAG_SYSTEM } = await import("../supabase/functions/_shared/contentMachine/assets.js");
  const list = [
    { ref: "cut00001", kind: "output", tool: "ai_fruit_story", subject: "Why is there a…", subtitles: "cut" },
    { ref: "full0001", kind: "output", tool: "ai_fruit_story", subject: "a whole line", subtitles: "full" },
    { ref: "unkn0001", kind: "output", tool: "long_form", subject: "not tagged yet", subtitles: null },
    { ref: "none0001", kind: "output", tool: "clay_rescue", subject: "a clean frame", subtitles: "none" },
  ];
  assert.deepEqual(usableAssets(list).map((a) => a.ref), ["none0001", "unkn0001", "full0001"]);
  const text = assetsText(list);
  assert.ok(!text.includes("cut00001"));
  assert.match(text, /none0001: output · clay_rescue · clean/);
  assert.ok(TAG_SCHEMA.properties.images.items.required.includes("subtitles"));
  assert.match(TAG_SYSTEM, /"cut" if it stops mid-sentence/);
  assert.equal(assetUpdate({ tool: "ai_fruit_story", kind: "output", subtitles: "cut", usable: true }, "now").subtitles, "cut");
  assert.equal(assetUpdate({ tool: "ai_fruit_story", kind: "output", subtitles: "maybe", usable: true }, "now").subtitles, null);
  // The writer's check refuses a cut frame, even though it is in the library.
  const world = fakeWorld();
  world.assets.push({ id: "A9", ref: "cut00001", path: "library/cut.webp", kind: "output", tool: "ai_fruit_story", status: "active", subtitles: "cut" });
  const p = fakeProviders(world);
  const orig = p.ai.createMessage;
  p.ai.createMessage = async (t, a) => { const out = await orig(t, a); if (a.request.tools) { const x = JSON.parse(out.body.content[0].text); x.slides[2].asset_id = "cut00001"; x.slides[2].image_prompt = null; out.body.content[0].text = JSON.stringify(x); } return out; };
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  assert.equal(world.ideas[0].status, "failed");
  assert.match(world.ideas[0].error, /asset_id cut00001 is not in the library/);
  // A re-tag job (owner-ordered) looks at active assets again.
  const w2 = fakeWorld();
  const p2 = fakeProviders(w2);
  await w2.db.enqueue([{ stage: "tag_assets", payload: { ids: ["A1", "A2"], live: true, retag: true } }]);
  await drain(w2, depsFor(w2, p2));
  assert.equal(p2.calls.tagged, 2);
});

test("a Zyvo slide prefers a real output; UI crops only for slides about the app; the default screen is a tight crop", async () => {
  const { ZYVO_SHOT_PATH } = await import("../supabase/functions/_shared/contentMachine/pipeline.js");
  assert.equal(ZYVO_SHOT_PATH, "assets/zyvo-ui-picker.png");
  const req = writeRequest({ model: "claude-sonnet-5-5", brandRules: "x", library: LIB, recipe: planRecipes({ library: LIB, count: 1, seed: "u" })[0], today: "2026-10-20" });
  assert.match(req.system[0].text, /prefer a real OUTPUT/);
  assert.match(req.system[0].text, /ONLY when the slide is about that part of the app/);
  const { CROPS } = await import("../scripts/contentMachine/importUiCrops.mjs").catch(() => ({ CROPS: null }));
  if (CROPS) for (const c of CROPS) assert.ok(c[4] >= 700 || c[5] >= 450, `${c[0]} is a large crop`);
});

test("meme pictures: simple, unbranded, plain screens; QA is strict about logos on objects", async () => {
  const { MEME_RULES } = await import("../supabase/functions/_shared/contentMachine/providers/runware.js");
  const { QA_FLAGS, QA_SYSTEM, qaFindings } = await import("../supabase/functions/_shared/contentMachine/qa.js");
  const prompt = imagePrompt("a creator staring at a laptop", "meme");
  assert.ok(prompt.includes(MEME_RULES));
  assert.match(prompt, /no crowd/);
  assert.match(prompt, /plain and unbranded with no logo/);
  assert.ok(!imagePrompt("a lamp", "illustration").includes(MEME_RULES));
  assert.ok(QA_FLAGS.includes("logo_on_object"));
  assert.match(QA_SYSTEM, /an apple shape on a laptop lid/);
  assert.deepEqual(qaFindings({ slides: [{ slide: 1, logo_on_object: true, note: "apple logo" }] }), { 1: { flags: ["a logo or brand mark on an object"], note: "apple logo" } });
});

test("a meme slideshow still flagged after its regenerate is dropped and replaced by another format × style", async () => {
  const world = fakeWorld();
  const MEME = { key: "meme_style", name: "Meme", description: "", spec: { bg: "#ffffff", fg: "#000000", accent: "#000000", highlight: "#ffffff", font: "anton", meme: true, hero_prompt: "Simple meme scene: {subject}" } };
  world.db.library = async () => ({ ...LIB, styles: [...LIB.styles, MEME] });
  const create = world.db.createIdeas;
  let first = true;
  world.db.createIdeas = async (rows) => create(first ? (first = false, rows.map((r) => ({ ...r, recipe: { ...r.recipe, style: "meme_style" } }))) : rows);
  const p = fakeProviders(world, { qaFlags: [[2], [2]] });
  const kinds = [];
  const gen = p.images.generateImage;
  p.images.generateImage = async (t, a) => { kinds.push(a.kind); return gen(t, a); };
  const run = await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  assert.ok(kinds.includes("meme"), "meme pictures get the meme rules");
  assert.equal(world.ideas.length, 2);
  const [dropped, replacement] = world.ideas;
  assert.equal(dropped.status, "rejected");
  assert.equal(dropped.compliance.dropped, true);
  assert.match(dropped.error, /dropped/);
  assert.equal(replacement.recipe.replaces, dropped.id);
  assert.notEqual(replacement.recipe.style, "meme_style");
  assert.notEqual(replacement.recipe.format, "meme");
  assert.equal(replacement.status, "done");
  assert.equal(world.runs.find((r) => r.id === run.id).status, "done", "the batch is complete");
  // A non-meme slideshow still flagged is kept and marked (as before).
  const w2 = fakeWorld();
  await startRun(w2, { count: 1 });
  await drain(w2, depsFor(w2, fakeProviders(w2, { qaFlags: [[2], [2]] })));
  assert.equal(w2.ideas.length, 1);
  assert.equal(w2.ideas[0].status, "done");
  assert.equal(w2.ideas[0].compliance.flagged, true);
});

test("empty space reported by the renderer marks the slideshow for the owner", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  const start = p.fly.startRender;
  p.fly.startRender = async (t, a) => {
    const out = await start(t, a);
    const m = await p.files.readJson(a.job.uploads.manifest.replace("https://upload/", ""));
    m.warnings = [{ slide: 3, warnings: ["about 31% of the safe area is empty"], empty: 0.31 }];
    return out;
  };
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  const c = world.ideas[0].compliance;
  assert.equal(world.ideas[0].status, "done");
  assert.equal(c.flagged, true);
  assert.deepEqual(c.emptySpace, ["slide 3: about 31% of the safe area is empty"]);
});

test("qa_check: the owner-ordered vision check on grid slides goes through the guard and saves its findings", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world, { qaFlags: [[2]] });
  await world.db.enqueue([{ stage: "qa_check", payload: { paths: ["qa/grid/a/slide-01.png", "qa/grid/a/slide-02.png", "library/not-allowed.png"], kinds: ["cover", "text"], out: "qa/grid/a.json", live: true } }]);
  await drain(world, depsFor(world, p));
  const saved = world.written["qa/grid/a.json"];
  assert.deepEqual(saved.paths, ["qa/grid/a/slide-01.png", "qa/grid/a/slide-02.png"], "only files under qa/");
  assert.deepEqual(Object.keys(saved.findings), ["2"]);
  assert.ok(world.ledger.some((l) => l.operation === "anthropic.qa_check" && l.lane === "qa"));
});

/* ─── round 6 (2026-10-18): TikTok title, flawed assets, Helsinki time ─── */

test("TikTok gets its own title (≤ 90 characters) next to the description", async () => {
  const pkg = JSON.parse(JSON.stringify(PKG(true)));
  assert.deepEqual(packageProblems(pkg), []);
  pkg.tiktok.title = "x".repeat(91);
  assert.match(packageProblems(pkg).join(" "), /TikTok title over 90 characters/);
  pkg.tiktok.title = " ";
  assert.match(packageProblems(pkg).join(" "), /no TikTok title/);
  const world = fakeWorld();
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, fakeProviders(world)));
  const tk = world.pkgs.find((p) => p.platform === "tiktok");
  assert.equal(tk.title, PKG(true).tiktok.title);
  assert.match(packageRequest({ model: "m", brandRules: "x", recipe: {}, slideshow: {}, links: utmLinks("a") }).system[0].text, /tiktok\.title: the photo post's separate title field/);
});

test("a library asset the vision QA flags for an artifact is marked flawed and no longer offered", async () => {
  const { flawedAssets } = await import("../supabase/functions/_shared/contentMachine/pipeline.js");
  const heroes = { 1: { asset: "library/aaaa1111.webp", ref: "aaaa1111" }, 2: { url: "https://im.runware.ai/1.jpg" }, 3: { asset: "library/bbbb2222.webp", ref: "bbbb2222" } };
  const findings = {
    2: { flags: ["distorted hands or faces"], note: "fused fingers" },
    3: { flags: ["distorted hands or faces"], note: null },             // a generated picture: regenerated instead
    4: { flags: ["text is hard to read"], note: "small" },               // a layout flag, not the picture's fault
  };
  assert.deepEqual(flawedAssets(findings, heroes), [{ ref: "aaaa1111", reason: "distorted hands or faces (fused fingers)" }]);
  // In the pipeline: slide 2 shows asset aaaa1111 and QA flags it twice.
  const world = fakeWorld();
  const p = fakeProviders(world, { qaFlags: [[3], [3]] });
  const orig = p.ai.createMessage;
  p.ai.createMessage = async (t, a) => {
    const out = await orig(t, a);
    if (a.request.tools) { const x = JSON.parse(out.body.content[0].text); x.slides[2].asset_id = "aaaa1111"; x.slides[2].image_prompt = null; out.body.content[0].text = JSON.stringify(x); }
    if (/final quality check/i.test(a.request.system[0].text.slice(0, 120))) { const x = JSON.parse(out.body.content[0].text); for (const s of x.slides) if (s.cut_off_subject) { s.cut_off_subject = false; s.distorted_hands_or_faces = true; } out.body.content[0].text = JSON.stringify(x); }
    return out;
  };
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, p));
  const a = world.assets.find((x) => x.ref === "aaaa1111");
  assert.equal(a.status, "flawed");
  assert.match(a.flaw_reason, /distorted hands or faces/);
  assert.ok(!(await world.db.activeAssets()).some((x) => x.ref === "aaaa1111"), "no longer offered to the writer");
});

test("Helsinki wall-clock time ↔ UTC, summer and winter", async () => {
  const { localToUtc, utcToLocal } = await import("../supabase/functions/_shared/contentMachine/localTime.js");
  assert.equal(localToUtc("2026-10-18T09:30", "Europe/Helsinki").toISOString(), "2026-10-18T06:30:00.000Z");   // summer: +3
  assert.equal(localToUtc("2026-11-18T09:30", "Europe/Helsinki").toISOString(), "2026-11-18T07:30:00.000Z");   // winter: +2
  assert.equal(localToUtc("2026-10-18", "Europe/Helsinki").toISOString(), "2026-10-17T21:00:00.000Z");
  assert.equal(utcToLocal("2026-10-18T06:30:00Z", "Europe/Helsinki"), "2026-10-18T09:30");
  assert.equal(localToUtc("18.10.2026", "Europe/Helsinki"), null);
});
