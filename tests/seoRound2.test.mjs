// SEO round 2 (2026-10-11): the image generator's product page, the fruit
// landing page, headings, structured data and the mobile speed changes.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { getPublicSeoMetadata, canonicalFor, SITE_URL } from "../src/data/publicSeoMetadata.js";
import { BRAND, structuredDataFor } from "../src/data/structuredData.js";
import {
  IMAGE_FAQ, IMAGE_GALLERY, IMAGE_GENERATOR_SEO, IMAGE_GUIDES, IMAGE_HERO, IMAGE_PROMPTS, IMAGE_STEPS, IMAGE_USE_CASES, imageGeneratorFiles,
} from "../src/data/imageGeneratorLanding.js";
import { fruitVideoObjects } from "../src/data/fruitStoryPages.js";
import { STICKMAN_PRICING } from "../src/data/stickmanLandingPages.js";

const read = (pathname) => readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");
const has = (pathname) => existsSync(new URL(`../${pathname}`, import.meta.url));
const ld = (pathname) => structuredDataFor(pathname, getPublicSeoMetadata(pathname), canonicalFor(pathname));

test("/image-generator: a product page with the owner's title, one H1, real pictures and real prices", () => {
  const meta = getPublicSeoMetadata("/image-generator");
  assert.equal(meta.title, "AI Image Generator – Start With 5 Free Images | Zyvo");
  assert.ok(meta.description.length >= 110 && meta.description.length <= 160, String(meta.description.length));
  assert.match(meta.description, /5 free/);
  assert.equal(IMAGE_GENERATOR_SEO.h1, "AI Image Generator");
  assert.equal(IMAGE_GENERATOR_SEO.cta, "Start with 5 free image generations");
  assert.equal(meta.inlineContent, true, "its server HTML is kept (hydrated), the app script waits for the first paint");

  const page = read("src/pages/landing/ImageGeneratorLanding.jsx");
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
  assert.ok(!page.includes("Blog /"), "no blog breadcrumb");
  // 12 to 20 pictures, each a WebP at two widths, each with a descriptive alt.
  const files = imageGeneratorFiles();
  assert.ok(files.length >= 12 && files.length <= 20, `${files.length} pictures`);
  for (const file of files) for (const width of [480, 960]) assert.ok(has(`public/lp/image-generator/${file}.w${width}.webp`), `${file}.w${width}.webp`);
  for (const item of [IMAGE_HERO, ...IMAGE_GALLERY.flatMap((group) => group.items), ...IMAGE_PROMPTS]) {
    assert.ok(item.alt.length >= 30, `${item.file}: alt text says what the picture shows`);
    assert.equal(item.size.length, 2);
  }
  // No real people or franchise names in anything the page says.
  const words = JSON.stringify([IMAGE_GALLERY, IMAGE_PROMPTS, IMAGE_FAQ, IMAGE_STEPS, IMAGE_USE_CASES]);
  assert.doesNotMatch(words, /ninjago|pok[eé]mon|lego|disney|ghibli|hogwarts|naruto|minecraft|messi|ronaldo|taylor swift/i);
  // Only the hero is fetched eagerly; everything else is lazy.
  assert.match(page, /loading=\{eager \? "eager" : "lazy"\}/);
  assert.equal(page.split(" eager className=").length - 1, 1, "one eager picture: the hero");
  // The sections the owner listed.
  assert.equal(IMAGE_STEPS.length, 3);
  assert.deepEqual(IMAGE_USE_CASES.map((item) => item.title), ["TikTok and Reels", "YouTube thumbnails", "Product photos", "Ads"]);
  assert.ok(IMAGE_PROMPTS.length >= 3);
  for (const topic of [/free/i, /commercial/i, /styles/i, /sizes/i]) assert.ok(IMAGE_FAQ.some((item) => topic.test(item.q)), String(topic));
  assert.match(IMAGE_FAQ[0].a, /5 image generations every 30 days/);
  // A prompt is handed to the tool by a button, in the navigation state: never a ?prompt= URL.
  assert.match(page, /navigate\(IMAGE_TOOL_PATH, \{ state: \{ prompt \} \}\)/);
  assert.ok(!page.includes("?prompt="));
  assert.match(read("src/pages/viral/Image.jsx"), /location\.state\?\.prompt/);
  // The guides are real posts, and the two posts the owner named link back.
  const app = read("src/App.jsx");
  for (const guide of IMAGE_GUIDES) assert.ok(app.includes(`path="${guide.to}"`), guide.to);
  assert.ok(read("src/app/blog/imagegenerator/free-ai-image-generator.jsx").includes('"/image-generator"'));
  assert.ok(read("src/app/blog/imagegenerator/BestAIImageGeneratorForSocialMedia.jsx").includes('"/image-generator"'));
  // Schema: the tool, with the free allowance and the three real plan prices.
  const graph = ld("/image-generator")["@graph"];
  assert.deepEqual(graph.map((node) => node["@type"]), ["SoftwareApplication", "BreadcrumbList", "FAQPage"]);
  assert.deepEqual(graph[0].offers.map((offer) => offer.price), ["0", ...STICKMAN_PRICING.plans.map((plan) => String(plan.price))]);
  assert.equal(graph[2].mainEntity.length, IMAGE_FAQ.length);
});

test("/ai-fruit-story-maker: the owner's title and description, an \"AI fruit drama generator\" heading, three example videos", () => {
  const meta = getPublicSeoMetadata("/ai-fruit-story-maker");
  assert.equal(meta.title, "AI Fruit Story Generator – Talking Fruit Drama Videos in Minutes | Zyvo");
  assert.equal(meta.description, "Type one idea, get a finished talking-fruit drama for TikTok, Reels and Shorts. 150 characters that stay consistent, series up to 10 episodes.");
  const page = read("src/pages/landing/AIFruitStoryLanding.jsx");
  assert.match(page, /<h2[^>]*>An AI Fruit Drama Generator for TikTok, Reels and Shorts<\/h2>/);
  assert.ok(page.includes("This AI fruit drama generator"));
  const videos = fruitVideoObjects(SITE_URL);
  assert.ok(videos.length >= 3 && videos.length <= 5, `${videos.length} videos`);
  for (const video of videos) {
    for (const key of ["name", "description", "thumbnailUrl", "uploadDate", "contentUrl", "duration"]) assert.ok(video[key], `${video.name}: ${key}`);
    assert.match(video.contentUrl, /\/generated\/fruit\/examples\/[a-z-]+\.mp4$/);
    assert.ok(has(`public${new URL(video.thumbnailUrl[0]).pathname}`), `${video.name}: its poster is in the repo`);
  }
  // The videos stay a poster until clicked.
  assert.match(page, /preload="none"/);
});

test("headings: Home's H1 names what Zyvo is; /long-form's does for a signed-out visitor", () => {
  const hero = read("src/components/workspace/Glow.jsx");
  assert.match(hero, /AI Video Generator for\{" "\}/);
  assert.match(hero, /YouTube, TikTok and Reels/);
  assert.ok(hero.includes("What would you like to create today?"), "the old headline is the line under it, in one piece");
  assert.equal((hero.match(/<h1\b/g) || []).length, 1);
  // Nothing in the hero waits for a script to become visible.
  const h1Block = hero.slice(hero.indexOf("<h1"), hero.indexOf("</p>", hero.indexOf("</h1>")));
  assert.ok(!h1Block.includes("motion."), "no animation wrapper around the headline");
  assert.ok(read("src/pages/workspace/long-form/index.jsx").includes('{signedOut ? "AI Long-Form YouTube Video Generator" : "Long Form"}'));
});

test("structured data: brand with its official profiles, SoftwareApplication with prices on every tool page, checked by the build", () => {
  assert.deepEqual(BRAND.alternateName, ["Zyvo AI", "ZyvoAI", "TryZyvo"]);
  assert.deepEqual(BRAND.sameAs, ["https://www.tiktok.com/@zyvoai", "https://www.youtube.com/@zyloaii", "https://www.instagram.com/zyvo.ai/"]);
  const tools = ["/long-form", "/image-generator", "/ai-fruit-story-maker", "/cartoon-drive-by-video-maker", "/behind-the-scenes-video-maker", "/kit-swap-ai", "/30-days-video-maker", "/30-days-series-video-maker",
    "/face-asmr-maker", "/micro-camera-animal-maker", "/clay-rescue-maker", "/2am-worlds-ai-generator", "/ai-stickman-video-generator"];
  for (const tool of tools) {
    const app = ld(tool)["@graph"].find((node) => node["@type"] === "SoftwareApplication");
    assert.ok(app, `${tool} has a SoftwareApplication`);
    const offers = [].concat(app.offers);
    assert.ok(offers.length >= 3, `${tool} states the plan prices`);
    for (const offer of offers) assert.equal(offer.priceCurrency, STICKMAN_PRICING.currency);
    if (tool !== "/image-generator") assert.ok(offers.every((offer) => Number(offer.price) > 0), `${tool} is not presented as free`);
    assert.equal(JSON.stringify(app).includes("aggregateRating"), false);
  }
  // No page adds a made-up "price 0" schema in the browser any more.
  for (const name of ["ClayRescueLanding", "FaceAsmrLanding", "MicroCameraAnimalLanding"]) assert.ok(!read(`src/pages/landing/${name}.jsx`).includes("ld+json"), name);
  // The build parses every JSON-LD block and fails on an invalid one or on a rating.
  const check = read("scripts/validateSeoIndexing.js");
  assert.ok(check.includes("JSON-LD does not parse"));
  assert.ok(check.includes("carries a rating or review"));
  assert.ok(check.includes("has no JSON-LD"));
});

test("mobile speed: non-blocking font, tool pages loaded on demand, loop videos wait for the visitor, pages zoom", () => {
  const html = read("index.html");
  assert.match(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]+" media="print" onload="this\.media='all'" \/>/);
  assert.equal((html.match(/rel="stylesheet"/g) || []).length, 2, "the font link and its noscript copy: nothing else blocks");
  assert.doesNotMatch(html, /user-scalable|maximum-scale/);
  const app = read("src/App.jsx");
  for (const name of ["AIFruitStory", "BlockyStories", "SkeletonShorts"]) {
    assert.ok(app.includes(`const ${name} = lazy(() => import("./pages/workspace/${name}"));`), `${name} is loaded when opened`);
    assert.ok(!app.includes(`import ${name} from`), `${name} is not in the first file`);
  }
  // The blog registry (150 KB) is not pulled into the app's first file through the schema code.
  assert.ok(!read("src/data/structuredData.js").includes("import { blogArticles }"));
  const home = read("src/components/home-v2/HomeV2Sections.jsx");
  assert.ok(home.includes("{!reduced && interacted && (inView || ready) && ("), "a loop video needs a first interaction and to be on screen");
  assert.ok(home.includes('loading={priority ? "eager" : "lazy"}'));
  assert.ok(read("src/lib/firstInteraction.js").includes('["scroll", "wheel", "touchstart", "pointerdown", "pointermove", "keydown"]'));
});

test("llms.txt is in the standard format and links only to pages in the sitemap", () => {
  const text = read("public/llms.txt");
  const lines = text.split(/\r?\n/);
  assert.equal(lines[0], "# Zyvo");
  assert.ok(lines.some((line) => line.startsWith("> ")), "a one-paragraph summary as a blockquote");
  assert.ok(lines.filter((line) => line.startsWith("## ")).length >= 3);
  assert.ok(lines.includes("## Optional"));
  const sitemap = read("public/sitemap.xml");
  const links = [...text.matchAll(/\]\((https:\/\/www\.tryzyvo\.com[^)]*)\)/g)].map((match) => match[1]);
  assert.ok(links.length >= 20);
  for (const link of links) assert.ok(link.endsWith("/sitemap.xml") || sitemap.includes(`<loc>${link}</loc>`), `${link} is an indexable page`);
  assert.ok(!has("public/ai-catalog.json"), "ai-catalog.json was never a real file: it answers 404 now");
});
