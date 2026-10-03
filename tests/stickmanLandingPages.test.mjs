import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  STICKMAN_BASE_PATH, STICKMAN_LANDING_PAGES, STICKMAN_PRICING, STICKMAN_VIDEOS,
  getStickmanLandingPage, stickmanNicheHref, stickmanStructuredData,
} from "../src/data/stickmanLandingPages.js";
import { getPublicSeoMetadata, canonicalFor, SITE_URL } from "../src/data/publicSeoMetadata.js";
import { structuredDataFor } from "../src/data/structuredData.js";
import { ALL_NICHES } from "../src/pages/workspace/long-form/niches.js";
import { PLAN_CREDITS, PLAN_PRICE_IDS, TOPUP_PRICE_IDS, summarizeStripePrices } from "../supabase/functions/_shared/stripePlanPrices.js";

// Long Form SEO landing pages (/ai-stickman-video-generator + future niche
// pages): one config entry per page drives the route, metadata, JSON-LD and
// sitemap. These checks keep a new entry honest.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(`${root}${p}`, "utf8");
const gallery = JSON.parse(read("src/data/stickmanLandingGallery.json"));
const main = STICKMAN_LANDING_PAGES[0];

test("main page: the requested URL, title, description and H1", () => {
  assert.equal(main.path, "/ai-stickman-video-generator");
  assert.equal(main.title, "AI Stickman Video Generator for YouTube | Zyvo");
  assert.equal(main.description, "Turn one idea into a full 8–15 minute stickman YouTube video: researched script, voiceover, 150+ scenes, thumbnails and title. Try Zyvo Long Form.");
  assert.equal(main.h1, "AI Stickman Video Generator for YouTube");
  assert.equal(getStickmanLandingPage("/ai-stickman-video-generator/"), main);
});

test("every page has its own path, title, description and H1 (no copied niche pages)", () => {
  for (const field of ["path", "title", "description", "h1", "subhead"]) {
    const values = STICKMAN_LANDING_PAGES.map((p) => p[field]);
    assert.ok(values.every(Boolean), `a page is missing ${field}`);
    assert.equal(new Set(values).size, values.length, `two pages share the same ${field}`);
  }
  for (const page of STICKMAN_LANDING_PAGES) {
    assert.ok(page.path === STICKMAN_BASE_PATH || page.path === `${STICKMAN_BASE_PATH}/${page.slug}`, page.path);
    assert.ok(page.faq.length >= 8 && page.faq.length <= 10, `${page.path}: 8–10 FAQ items`);
    assert.ok(page.gallery.groups.length > 0 && page.showcase.videos.length > 0, `${page.path}: needs its own gallery and examples`);
  }
});

test("metadata, sitemap and route come from the config", () => {
  for (const page of STICKMAN_LANDING_PAGES) {
    const meta = getPublicSeoMetadata(page.path);
    assert.equal(meta.title, page.title);
    assert.equal(meta.image, `${SITE_URL}${page.ogImage}`);
    assert.deepEqual(meta.imageSize, [1200, 630]);
    assert.equal(meta.preloadImage, page.hero.poster);
  }
  assert.match(read("src/App.jsx"), /STICKMAN_LANDING_PAGES\.map\(\(page\) => <Route key=\{page\.path\} path=\{page\.path\}/);
  assert.match(read("scripts/generateSitemap.js"), /STICKMAN_LANDING_PAGES\.forEach\(\(page\) => staticRoutes\.add\(page\.path\)\)/);
  assert.match(read("public/sitemap.xml"), /<loc>https:\/\/www\.tryzyvo\.com\/ai-stickman-video-generator<\/loc>/);
});

test("JSON-LD: app with the real plan prices and no rating, three videos, the printed FAQ, breadcrumb", () => {
  const canonical = canonicalFor(main.path);
  const ld = structuredDataFor(main.path, getPublicSeoMetadata(main.path), canonical);
  assert.deepEqual(ld, stickmanStructuredData(main, canonical, SITE_URL));
  const byType = (t) => ld["@graph"].filter((n) => n["@type"] === t);
  const [app] = byType("SoftwareApplication");
  assert.deepEqual(app.offers.map((o) => [o.price, o.priceCurrency]), [["18.00", "EUR"], ["38.00", "EUR"], ["78.00", "EUR"]]);
  assert.ok(!/aggregateRating|"review"|ratingValue/.test(JSON.stringify(ld)), "no ratings or reviews");
  const videos = byType("VideoObject");
  assert.deepEqual(videos.map((v) => v.embedUrl), ["cDVliwgwe_I", "-4oDXegn9vw", "2DFxSoSB5hY"].map((id) => `https://www.youtube.com/embed/${id}`));
  for (const v of videos) {
    assert.ok(v.name && v.description && v.thumbnailUrl[0].startsWith(SITE_URL));
    assert.ok(!Number.isNaN(Date.parse(v.uploadDate)) && /[+-]\d\d:\d\d$/.test(v.uploadDate), "upload date with a timezone");
  }
  assert.deepEqual(byType("FAQPage")[0].mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), main.faq.map((f) => [f.q, f.a]));
  assert.deepEqual(byType("BreadcrumbList")[0].itemListElement.map((i) => i.item), [`${SITE_URL}/`, canonical]);
});

test("pricing copy matches the numbers: 250 credits for 10 minutes, 3 / 6 / 12 videos", () => {
  assert.equal(STICKMAN_PRICING.creditsPerMinute * 10, STICKMAN_PRICING.tenMinuteCredits);
  assert.deepEqual(STICKMAN_PRICING.plans.map((p) => [p.name, p.videos]), [["Starter", 3], ["Pro", 6], ["Generative", 12]]);
  const cost = main.faq.find((f) => /cost/i.test(f.q)).a;
  for (const plan of STICKMAN_PRICING.plans) assert.ok(cost.includes(`${plan.videos} on ${plan.name} (€${plan.price})`) || cost.includes(`${plan.videos} ten-minute videos a month on ${plan.name} (€${plan.price})`), plan.name);
});

test("plan credits: one table (750 / 1,600 / 3,200) feeds the price function and this page", () => {
  assert.deepEqual(PLAN_CREDITS, { starter: 750, pro: 1600, generative: 3200 });
  // What the live plan-prices function answers is built from the same table.
  const price = (interval) => ({ active: true, unit_amount: 1800, currency: "eur", recurring: interval ? { interval } : null });
  const byId = Object.fromEntries([
    ...Object.values(PLAN_PRICE_IDS).flatMap((ids) => [[ids.monthly, price("month")], [ids.yearly, price("year")]]),
    ...Object.values(TOPUP_PRICE_IDS).map((id) => [id, price(null)]),
  ]);
  const { plans } = summarizeStripePrices(byId, "inclusive");
  assert.deepEqual(Object.fromEntries(Object.entries(plans).map(([k, v]) => [k, v.credits])), PLAN_CREDITS);
  assert.deepEqual(STICKMAN_PRICING.plans.map((p) => p.credits), [750, 1600, 3200]);
  assert.match(read("src/data/stickmanLandingPages.js"), /videos: Math\.floor\(PLAN_CREDITS\[plan\.id\] \/ TEN_MINUTE_CREDITS\)/);
});

test("every page is served in standards mode: the template starts with the doctype", () => {
  assert.match(read("index.html"), /^<!DOCTYPE html>\r?\n<html lang="en">/);
  assert.match(read("scripts/generateSeoHtml.js"), /does not start with <!DOCTYPE html>/);
});

test("pictures: every gallery file exists as WebP with alt text; groups on the page have pictures", () => {
  assert.ok(gallery.length >= 40 && gallery.length <= 60, `curated set is 40–60 (${gallery.length})`);
  for (const item of gallery) {
    assert.match(item.file, /\.webp$/);
    assert.ok(item.alt.length > 20, `${item.file}: descriptive alt text`);
    assert.ok(existsSync(`${root}public/lp/stickman/${item.file}`), item.file);
  }
  for (const page of STICKMAN_LANDING_PAGES) {
    for (const group of page.gallery.groups) assert.ok(gallery.some((g) => g.group === group.id), `${page.path}: gallery group ${group.id} is empty`);
    const first = page.gallery.groups.reduce((n, g) => n + Math.min(page.gallery.initialPerGroup, gallery.filter((x) => x.group === g.id).length), 0);
    assert.equal(first, 24, "the gallery opens with 24 pictures");
    for (const file of [page.hero.poster, page.ogImage, ...[page.tutorial.video, ...page.showcase.videos].map((k) => STICKMAN_VIDEOS[k].thumb)]) assert.ok(existsSync(`${root}public${file}`), file);
  }
});

test("fast first paint: content inline, hydrated (not redrawn), app script after the first paint, zoom allowed", () => {
  const meta = getPublicSeoMetadata(main.path);
  assert.equal(meta.inlineContent, true);
  assert.equal(meta.viewport, "width=device-width, initial-scale=1, viewport-fit=cover");
  // The viewport the page restores on leaving is the app's real one.
  assert.ok(read("index.html").includes('content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"'));
  const entry = read("src/main.jsx");
  assert.match(entry, /document\.documentElement\.dataset\.hydrate === "true" && container\.firstElementChild\) \{\s+ReactDOM\.hydrateRoot\(container, app/);
  assert.match(entry, /\} else \{\s+ReactDOM\.createRoot\(container\)\.render\(app\);/, "every other page keeps the client render");
  const gen = read("scripts/generateSeoHtml.js");
  assert.match(gen, /renderApp\(pathname, \{ inline: Boolean\(getPublicSeoMetadata\(pathname\)\?\.inlineContent\) \}\)/);
  assert.match(gen, /if \(head\.hydrate\) html = deferAppScript\(html\);/);
  assert.match(gen, /supportedEntryTypes[\s\S]*largest-contentful-paint[\s\S]*setTimeout\(go,3000\)/);
  // A hydrated route must not be lazy: a pending chunk + any state update makes React redraw the page.
  const app = read("src/App.jsx");
  assert.match(app, /^import StickmanVideoLanding from "\.\/pages\/landing\/StickmanVideoLanding\.jsx";/m);
  assert.ok(!/StickmanVideoLanding = lazy\(/.test(app));
});

test("niche cards: 25 niches, each opens Long Form with the niche (or its own page once it exists)", () => {
  assert.equal(ALL_NICHES.length, 25);
  for (const niche of ALL_NICHES) {
    const page = STICKMAN_LANDING_PAGES.find((p) => p.nicheId === niche.id);
    assert.equal(stickmanNicheHref(niche.id), page ? page.path : `/long-form/create?niche=${niche.id}`);
  }
});

test("the page component: one H1, lazy pictures with sizes, lite YouTube embed, no fake proof", () => {
  const src = read("src/pages/landing/StickmanVideoLanding.jsx");
  assert.equal((src.match(/<h1\b/g) || []).length, 1);
  assert.ok(!/<main\b/.test(src), "the app shell already renders <main>");
  for (const img of src.match(/<img\b[^>]*>/g)) {
    assert.match(img, /alt=\{/);
    assert.match(img, /width="\d+" height="\d+"/);
    assert.match(img, /loading="(lazy|eager)"/);
  }
  assert.equal((src.match(/loading="eager"/g) || []).length, 1, "only the hero poster loads eagerly");
  assert.match(src, /\{on \? \(\s*<iframe src=\{`https:\/\/www\.youtube-nocookie\.com\/embed\//, "the iframe exists only after the click");
  assert.ok(!/aggregateRating|ratingValue|testimonial|\bstars?\b|\d[\d,]*\+? (users|creators|customers)/i.test(src + JSON.stringify(main)), "no ratings, testimonials or user counts");
});
