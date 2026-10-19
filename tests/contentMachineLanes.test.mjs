// Content Machine: the two accounts (content lanes, owner 2026-10-19). The Zyvo brand account (product carousels,
// claims only from the fact sheet, real outputs only, rebuilt UI) and the creator account (unchanged), each with its
// own formats, rules, CTA, posting times, playbook and learning; shared caps, checked before a batch starts.
import test from "node:test";
import assert from "node:assert/strict";
import { FACTS, LIB, ZLIB, apiFor, depsFor, drain, fakeProviders, fakeWorld, startRun, validZyvoSlideshow } from "./helpers/contentMachineFakes.mjs";
import { planRecipes, LANE_DEFAULTS } from "../supabase/functions/_shared/contentMachine/planner.js";
import { laneLibrary } from "../supabase/functions/_shared/contentMachine/pipeline.js";
import { zyvoProblems, COMPETITORS } from "../supabase/functions/_shared/contentMachine/zyvoLane.js";
import { writeRequest, packageRequest, slideshowProblems, utmLinks } from "../supabase/functions/_shared/contentMachine/writer.js";
import { batchCheck, perSlideshowUsd } from "../supabase/functions/_shared/contentMachine/batchBudget.js";
import { featureBreakdown } from "../supabase/functions/_shared/contentMachine/learning.js";
import { slideHtml, ZYVO_KINDS } from "../supabase/functions/_shared/contentMachine/slides/templates.js";

const ALL = { formats: [...LIB.formats, ...ZLIB.formats], styles: [...LIB.styles, ...ZLIB.styles], hooks: [...LIB.hooks, ...ZLIB.hooks] };
const opts = (extra = {}) => ({ assetRefs: new Set(["aaaa1111", "bbbb2222"]), assetPrompts: new Map(), factKeys: new Set(["lf_length", "fruit_series"]), ...extra });

test("each account plans from its own formats, styles, CTA and posting times", () => {
  const zl = laneLibrary(ALL, "zyvo"), cl = laneLibrary(ALL, "creator");
  assert.deepEqual(zl.formats.map((f) => f.key), ["feature_hero", "how_it_works"]);
  assert.deepEqual(zl.styles.map((s) => s.key), ["zyvo_brand"]);
  assert.ok(!cl.formats.some((f) => ["feature_hero", "how_it_works"].includes(f.key)), "the creator account keeps its own formats");
  const z = planRecipes({ library: zl, count: 2, seed: "z", lane: { key: "zyvo", postTimes: { tiktok: ["11:00"], instagram: ["09:00"], youtube: ["12:00"] } } });
  for (const r of z) {
    assert.equal(r.account, "zyvo");
    assert.equal(r.cta_type, "zyvo_button");
    assert.equal(r.zyvo_position, "throughout");
    assert.ok(["11:00", "09:00", "12:00"].includes(r.post_time));
  }
  const c = planRecipes({ library: cl, count: 3, seed: "c" });
  for (const r of c) { assert.equal(r.account, "creator"); assert.ok(LANE_DEFAULTS.creator.ctaTypes.includes(r.cta_type)); }
  // "Prompt → result" only once 2 assets have a recorded prompt.
  const lib = { ...ALL, formats: [...ALL.formats, { key: "prompt_result", spec: { requires: "asset_prompts" }, lanes: ["zyvo"] }] };
  assert.ok(!laneLibrary(lib, "zyvo", [{ ref: "a", prompt: "x" }]).formats.some((f) => f.key === "prompt_result"));
  assert.ok(laneLibrary(lib, "zyvo", [{ ref: "a", prompt: "x" }, { ref: "b", prompt: "y" }]).formats.some((f) => f.key === "prompt_result"));
});

test("the Zyvo account's honesty checks: cited facts, no other tools, real outputs only, the CTA button last", () => {
  const recipe = { account: "zyvo", format: "feature_hero" };
  const ok = validZyvoSlideshow(recipe);
  assert.deepEqual(zyvoProblems(ok, recipe, opts()), []);
  assert.deepEqual(slideshowProblems(ok, recipe, opts()), [], "the writer's checks send the Zyvo account here");
  const bad = JSON.parse(JSON.stringify(ok));
  bad.slides[1].fact_ids = [];
  bad.slides[2].fact_ids = ["no_autopost"];
  bad.slides[2].body = "Faster than CapCut.";
  bad.slides[0].assets = [{ asset_id: "zzzz9999", label: "x" }];
  bad.slides[1].image_prompt = "a laptop";
  bad.slides.pop();
  const p = zyvoProblems(bad, recipe, opts()).join(" | ");
  assert.match(p, /slide 2: cite the fact/);
  assert.match(p, /fact no_autopost is not on the fact sheet/, "a NOT-feature can't be cited");
  assert.match(p, /names another tool \("CapCut"\)/);
  assert.match(p, /asset zzzz9999 is not in the library/);
  assert.match(p, /feature_hero needs 2–3 real outputs \(has 1\)/);
  assert.match(p, /only real Zyvo outputs \(no image_prompt\)/);
  assert.match(p, /the last slide must be the cta_button/);
  assert.ok(COMPETITORS.test("we beat Midjourney") && !COMPETITORS.test("Zyvo makes videos"));
  // "Prompt → result": only the asset's recorded prompt, exactly.
  const pr = JSON.parse(JSON.stringify(ok));
  pr.slides[2] = { ...pr.slides[2], kind: "prompt_result", body: null, prompt: "a made-up prompt", assets: [{ asset_id: "aaaa1111", label: "Long Form" }] };
  assert.match(zyvoProblems(pr, recipe, opts()).join(" "), /only with an asset whose real prompt is recorded/);
  assert.match(zyvoProblems(pr, recipe, opts({ assetPrompts: new Map([["aaaa1111", "Why Rome's roads lasted"]]) })).join(" "), /must be the asset's recorded prompt, exactly/);
  pr.slides[2].prompt = "Why Rome's roads lasted";
  assert.deepEqual(zyvoProblems(pr, recipe, opts({ assetPrompts: new Map([["aaaa1111", "Why Rome's roads lasted"]]) })), []);
});

test("the Zyvo account's writer gets the fact sheet (NOT-features marked), no web search; the packager checks claims against the sheet", () => {
  const recipe = { account: "zyvo", format: "feature_hero", slide_count: 5 };
  const req = writeRequest({ model: "m", brandRules: "- zyvo rules", library: laneLibrary(ALL, "zyvo"), recipe, today: "2026-10-20", avoidTitles: [], facts: FACTS });
  const sys = req.system[0].text;
  assert.match(sys, /ZYVO'S OWN BRAND ACCOUNT/);
  assert.match(sys, /\[lf_length\] Turn one idea into an 8–15 minute YouTube explainer/);
  assert.match(sys, /NOT FEATURES \(never claim or imply these\):\n- Zyvo does NOT post or schedule/);
  assert.ok(!sys.includes("[no_autopost]"), "a NOT-feature has no key to cite");
  assert.equal(req.tools, undefined, "no web search on the Zyvo account");
  const creator = writeRequest({ model: "m", brandRules: "- creator", library: laneLibrary(ALL, "creator"), recipe: { account: "creator", format: "meme" }, today: "2026-10-20", avoidTitles: [], facts: FACTS });
  assert.ok(creator.tools?.length, "the creator account still checks real tools with web search");
  assert.match(creator.system[0].text, /NOT features \(never claim or imply them\)/, "the creator account also uses the sheet");
  const pkg = packageRequest({ model: "m", brandRules: "- zyvo rules", recipe, slideshow: {}, links: utmLinks("a"), facts: FACTS });
  assert.match(pkg.system[0].text, /THIS IS ZYVO'S BRAND ACCOUNT/);
  assert.match(pkg.system[0].text, /every claim about Zyvo on the slides and in your captions must match one of these/);
});

test("a Zyvo batch makes only Zyvo slideshows; its real outputs reach the renderer as labelled galleries", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  const { call } = apiFor(world, { kick: async () => { await drain(world, depsFor(world, p)); } });
  const r = await call({ action: "makeSlideshows", account: "zyvo", count: 1 });
  assert.equal(r.ok, true, r.message);
  assert.equal(world.runs[0].account, "zyvo");
  assert.equal(world.ideas.length, 1);
  const idea = world.ideas[0];
  assert.equal(idea.account, "zyvo");
  assert.equal(idea.status, "done", idea.error);
  assert.equal(p.calls.images, 0, "no generated pictures on the Zyvo account (the brand style has no background either)");
  const job = p.calls.lastRender;
  assert.deepEqual(job.images.galleries[0].map((g) => g.label), ["Long Form", "AI Fruit Story"]);
  assert.match(job.images.galleries[0][0].url, /^https:\/\/signed\/library\/aaaa1111/);
  assert.equal(job.layoutVersion > 0, true);
  const writer = p.calls.messages.find((m) => /ZYVO'S OWN BRAND ACCOUNT/.test(m.system[0].text));
  assert.ok(writer, "written with the Zyvo prompt");
  assert.match(writer.system[0].text, /Only claims on the fact sheet\. \(zyvo\)/, "the Zyvo account's own brand rules");
  // The Queue lists per account.
  const zyvo = (await call({ action: "ideas", account: "zyvo" })).data.ideas;
  assert.equal(zyvo.length, 1);
  assert.equal(zyvo[0].account, "zyvo");
});

test("budget: a batch that wouldn't fit today's caps is refused before it starts, with how many would fit", async () => {
  assert.equal(perSlideshowUsd("zyvo", []), 0.15);
  assert.equal(perSlideshowUsd("creator", [0.2, 0.2, 0.2]), 0.23, "recent real costs + 15 % headroom");
  const summary = { day: { usedUsd: 2.5, capUsd: 3 }, month: { usedUsd: 10, capUsd: 90 }, provider: { anthropic: { usedUsd: 2.0, capUsd: 2.5 } }, lane: { slideshow: { usedUsd: 2.4, capUsd: 3 } } };
  const c = batchCheck({ account: "creator", count: 3, summary });
  assert.equal(c.fits, false);
  assert.equal(c.maxCount, 2);
  assert.match(c.message, /needs about \$0\.66, but today's total budget has \$0\.50 left today: make 2 or fewer/);
  assert.equal(batchCheck({ account: "creator", count: 2, summary }).fits, true);
  assert.equal(batchCheck({ account: "creator", count: 9, summary, dryRun: true }).fits, true, "a dry run spends nothing");
  // Through the API: refused, and no run was made.
  const world = fakeWorld({ daily_budget_usd: 3 });
  world.ledger.push({ id: "L-x", provider: "anthropic", lane: "slideshow", estimated_usd: 2.9, actual_usd: 2.9, status: "settled", dry_run: false, local_day: "2026-10-20" });
  world.store.ledgerSince = async () => world.ledger.map((l) => ({ ...l, local_day: l.local_day ?? "2026-10-20" }));
  world.clock.now = new Date("2026-10-20T10:00:00Z");
  const { call } = apiFor(world);
  const r = await call({ action: "makeSlideshows", account: "zyvo", count: 5 });
  assert.equal(r.ok, false);
  assert.match(r.message, /This batch needs about \$0\.75/);
  assert.equal(world.runs.length, 0, "nothing started");
  const e = (await call({ action: "batchEstimate", account: "zyvo", count: 1 })).data;
  assert.equal(e.fits, false);
});

test("each account learns from its own posts; the Zyvo account sees which features and hooks drive visits and clicks", () => {
  const post = (account, hook, facts, views, visits, clicks) => ({
    account, platform: "tiktok", posted_at: "2026-10-01T00:00:00Z",
    idea: { account, recipe: { account, format: "feature_hero", hook_type: hook }, script: { slides: [{ fact_ids: facts }] } },
    stats: [{ hours_since_post: 24, taken_at: "2026-10-02T00:00:00Z", views, profile_visits: visits, link_clicks: clicks, saves: 5, shares: 2 }],
  });
  const posts = [post("zyvo", "benefit_promise", ["fruit_series"], 1000, 30, 4), post("zyvo", "question", ["lf_length"], 2000, 10, 1)];
  const fb = featureBreakdown(posts, { now: new Date("2026-10-10T00:00:00Z") });
  assert.deepEqual(fb.features.map((g) => [g.key, g.visitsPer1k, g.linkClicks]), [["fruit_series", 30, 4], ["lf_length", 5, 1]]);
  assert.equal(fb.hooks[0].key, "benefit_promise");
});

test("the Zyvo slide kinds render: labelled real outputs, rebuilt UI, the CTA button and the footer", () => {
  const style = ZLIB.styles[0].spec;
  const S = (kind, extra = {}) => ({ kind, headline: "One idea in. A *finished video* out.", body: null, label: null, items: [], items_right: [], tool: null, image_prompt: null, asset_id: null, assets: [], prompt: null, callout: null, fact_ids: [], is_zyvo: true, ...extra });
  const g = [{ url: "https://x/a.webp", label: "Long Form" }, { url: "https://x/b.webp", label: "AI Fruit Story" }];
  const hero = slideHtml({ slide: S("feature_hero", { callout: "8–15 minute videos" }), index: 0, total: 4, style, images: { gallery: g }, logos: { "tryzyvo.com": "https://x/logo.png" } });
  assert.match(hero, /<figcaption>Long Form<\/figcaption>/);
  assert.match(hero, /class="callout"/);
  assert.match(hero, /class="brandfoot"[\s\S]*Zyvo[\s\S]*swipe →/);
  const prompt = slideHtml({ slide: S("ui_prompt", { label: "1", prompt: "Why Rome's roads lasted" }), index: 1, total: 4, style });
  assert.match(prompt, /data-ui[^>]*data-name="prompt box"/);
  assert.match(prompt, /Generate video →/, "the real button label");
  const cta = slideHtml({ slide: S("cta_button", { body: "Make your first video →" }), index: 3, total: 4, style, images: { gallery: g } });
  assert.match(cta, /class="ctabtn"[^>]*>Make your first video →/);
  assert.match(cta, /tryzyvo\.com[\s\S]*Link in bio/);
  assert.match(cta, /bf-swipe">tryzyvo\.com/, "the last slide's footer shows the address instead of swipe");
  assert.equal(ZYVO_KINDS.length, 10);
});

/* ─── slot limits (owner, 2026-10-19): the writer knows them, the program applies them, no paid loop ─── */

import { ZYVO_SLOTS, fitSlideshow, slotLimitsText, slotProblems, trimText } from "../supabase/functions/_shared/contentMachine/slotFit.js";

test("the writer is told every Zyvo slot's limits up front (items, characters, pictures)", () => {
  const req = writeRequest({ model: "m", brandRules: "- z", library: laneLibrary(ALL, "zyvo"), recipe: { account: "zyvo", format: "by_hand_vs_zyvo", slide_count: 5 }, today: "2026-10-20", avoidTitles: [], facts: FACTS });
  const sys = req.system[0].text;
  assert.match(sys, /SLOT LIMITS/);
  assert.match(sys, /- by_hand: headline ≤ 40, body null, items 2–3 × ≤ 26, items_right 2–3 × ≤ 26, real outputs exactly 1/);
  assert.match(sys, /- ui_checklist: headline ≤ 36, body null, items 3–5 × ≤ 32, no pictures/);
  assert.equal(slotLimitsText().split("\n").length, Object.keys(ZYVO_SLOTS).length + 1);
});

test("the failing 'by hand vs Zyvo' slide is cut to fit by the program, keeping its picture", () => {
  const recipe = { account: "zyvo", format: "by_hand_vs_zyvo" };
  const s = validZyvoSlideshow(recipe);
  // What the writer produced before the fix: 5 + 5 long lines and a body.
  s.slides[1] = { ...s.slides[1], kind: "by_hand", headline: "The by-hand way vs *Zyvo*", body: "Same idea, two ways.", label: null, prompt: null,
    items: ["Write the script", "Record a voice-over", "Hunt for visuals", "Edit every cut", "Add captions"],
    items_right: ["Pick a short-form template", "Cast fruit characters", "Blocky characters talk with lip sync", "Switch captions on in 3 styles", "Edit any scene before download"],
    assets: [{ asset_id: "aaaa1111", label: "Long Form" }], fact_ids: ["lf_length"] };
  assert.match(zyvoProblems(s, recipe, opts()).join(" | "), /slide 2: items 5 lines \(2–3\)/);
  const { slideshow, changes } = fitSlideshow(s, 0);
  const b = slideshow.slides[1];
  assert.equal(b.items.length, 3);
  assert.equal(b.items_right.length, 3);
  assert.ok(b.items_right.every((t) => t.replace(/\*/g, "").length <= 26), JSON.stringify(b.items_right));
  assert.equal(b.body, null, "by_hand has no body");
  assert.equal(b.assets.length, 1, "the real output stays (the old shorter rewrite dropped it)");
  assert.deepEqual(zyvoProblems(slideshow, recipe, opts()), []);
  assert.ok(changes.length >= 3);
  // After a layout failure (level 1): one line fewer, never under the minimum.
  const tighter = fitSlideshow(slideshow, 1).slideshow.slides[1];
  assert.equal(tighter.items.length, 2);
  assert.equal(tighter.assets.length, 1, "exactly 1 is required: it stays");
});

test("trimming keeps words whole and never leaves a highlight open", () => {
  assert.equal(trimText("Turn one idea into a *finished video* out", 30), "Turn one idea into a finished…", "the half highlight is dropped");
  assert.equal(trimText("Pick a *look* for every video", 12), "Pick a *look*…");
  assert.equal(trimText("Short", 30), "Short");
  assert.deepEqual(slotProblems({ kind: "by_hand", headline: "x", items: ["a", "b"], items_right: ["c", "d"], assets: [{ asset_id: "a" }], body: null }, "s"), []);
});

test("Remake same idea vs Remake with a different format (same account and topic)", async () => {
  const world = fakeWorld();
  const p = fakeProviders(world);
  const { call } = apiFor(world, { kick: async () => { await drain(world, depsFor(world, p)); } });
  await call({ action: "makeSlideshows", account: "zyvo", count: 1 });
  const first = world.ideas[0];
  const same = await call({ action: "remakeIdea", id: first.id, mode: "same" });
  assert.equal(same.ok, true, same.message);
  assert.equal(world.ideas.find((i) => i.id === same.data.ideaId).recipe.format, first.recipe.format);
  const other = await call({ action: "remakeIdea", id: first.id, mode: "format" });
  assert.equal(other.ok, true, other.message);
  const copy = world.ideas.find((i) => i.id === other.data.ideaId);
  assert.notEqual(copy.recipe.format, first.recipe.format, "a different format");
  assert.equal(copy.account, "zyvo");
  assert.ok(ZLIB.formats.some((f) => f.key === copy.recipe.format), "from the Zyvo account's formats");
  assert.ok(world.audit.some((a) => a.action === "idea.remake" && a.payload.mode === "format"));
});
