import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  FRUIT_CHARACTERS, FRUIT_EXAMPLE_SERIES, FRUIT_EXAMPLE_VIDEOS, FRUIT_FACTS, FRUIT_FAQ, FRUIT_PRICING_FAQ,
  FRUIT_POSTER_BASE, FRUIT_STARTER_PROMPTS, FRUIT_VIDEO_BASE, FRUIT_WHAT_IS_FAQ, filledVideos, fruitVideoObjects, videoLength,
} from "../src/data/fruitStoryPages.js";
import { FREE_PLAN_LINE, IS_ZYVO_FREE_FAQ } from "../src/data/freePlan.js";
import { HOME_SEO } from "../src/data/routeSeoPolicy.js";
import { getPublicSeoMetadata, canonicalFor } from "../src/data/publicSeoMetadata.js";
import { structuredDataFor } from "../src/data/structuredData.js";
import { BLOG_DATES } from "../src/data/blogDates.js";
import { LIMITS } from "../src/components/viral-tools/ai-fruit-story-v2/api/limits.js";
import { LIBRARY } from "../src/components/viral-tools/ai-fruit-story-v2/api/mock/libraryData.js";

// The public AI Fruit Story pages (the main page, the prompts post, the pricing
// and "what is" posts) must describe the tool as it works today.

const read = (pathname) => readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");
const library = new Map(LIBRARY.map((c) => [c.id, c.name])); // the same data as the fruit_characters table seed
const firstName = (id) => (library.get(id).startsWith("Big ") ? library.get(id) : library.get(id).split(" ")[0]);
const graphFor = (pathname) => structuredDataFor(pathname, getPublicSeoMetadata(pathname), canonicalFor(pathname))["@graph"];

function checkPrompt({ prompt, castIds }) {
  assert.ok(castIds.length >= 1 && castIds.length <= LIMITS.maxCastSingle, `1 to ${LIMITS.maxCastSingle} characters: ${prompt}`);
  for (const id of castIds) {
    assert.ok(library.has(id), `"${id}" is not in the character library: ${prompt}`);
    assert.ok(prompt.includes(firstName(id)), `the prompt doesn't name ${firstName(id)}: ${prompt}`);
  }
  assert.ok(prompt.length <= LIMITS.maxPromptChars);
}

test("the numbers on the page are the tool's limits", () => {
  assert.equal(FRUIT_FACTS.maxEpisodes, LIMITS.maxEpisodes);
  assert.equal(FRUIT_FACTS.maxEpisodes, 10);
  assert.equal(FRUIT_FACTS.maxCastSingle, LIMITS.maxCastSingle);
  assert.equal(FRUIT_FACTS.minLengthSec, 15);
  assert.equal(FRUIT_FACTS.maxLengthMin, 2);
  assert.equal(FRUIT_FACTS.characters, 150);
});

test("\"Make this video\" prompts use real library characters, at most 3, named in the text", () => {
  FRUIT_STARTER_PROMPTS.forEach(checkPrompt);
  const post = read("src/app/blog/imagegenerator/best-ai-fruit-story-ideas.jsx");
  const prompts = [...post.matchAll(/prompt: "((?:[^"\\]|\\.)*)", cast: \[([^\]]*)\]/g)]
    .map((m) => ({ prompt: m[1], castIds: m[2].split(",").map((id) => id.trim().replace(/"/g, "")) }));
  assert.equal(prompts.length, 50, "the post promises 50 prompts");
  assert.equal(new Set(prompts.map((p) => p.prompt)).size, 50, "no prompt twice");
  prompts.forEach(checkPrompt);
  for (const starter of FRUIT_STARTER_PROMPTS) {
    assert.ok(!prompts.some((p) => p.prompt === starter.prompt), "the main page's starters are not repeated in the prompts post");
  }
});

test("the characters shown on the main page have a picture", () => {
  for (const c of FRUIT_CHARACTERS) {
    assert.ok(library.has(c.id), c.id);
    assert.ok(readFileSync(new URL(`../public/lp/fruit/characters/${c.id}.jpg`, import.meta.url)).length > 0);
  }
});

test("no free claims and no \"10+\": the tool needs a paid plan, a series is up to 10 episodes", () => {
  const pages = [
    "src/data/fruitStoryPages.js",
    "src/pages/landing/AIFruitStoryLanding.jsx",
    "src/app/blog/imagegenerator/best-ai-fruit-story-ideas.jsx",
    "src/app/blog/imagegenerator/ai-fruit-story-pricing.jsx",
    "src/app/blog/imagegenerator/what-is-ai-fruit-story.jsx",
  ];
  for (const file of pages) {
    const text = read(file).split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
    assert.doesNotMatch(text, /10\+/, `${file} says "10+"`);
    assert.doesNotMatch(text, /free (entry|credits|tier|trial|to (try|start|use))|for free|try it free/i, `${file} has a free claim`);
  }
  for (const faq of [FRUIT_FAQ, FRUIT_PRICING_FAQ, FRUIT_WHAT_IS_FAQ]) {
    const free = faq.filter((f) => /free/i.test(f.q));
    assert.equal(free.length, 1);
    assert.match(free[0].a, /^No\./);
    assert.match(free[0].a, /paid/);
  }
  assert.match(read("src/pages/landing/AIFruitStoryLanding.jsx"), /Account and paid plan required/);
});

test("the FAQ in the JSON-LD is the FAQ on the page", () => {
  const cases = [["/ai-fruit-story-maker", FRUIT_FAQ], ["/blog/ai-fruit-story-pricing", FRUIT_PRICING_FAQ], ["/blog/what-is-ai-fruit-story", FRUIT_WHAT_IS_FAQ]];
  for (const [pathname, faq] of cases) {
    const page = graphFor(pathname).find((node) => node["@type"] === "FAQPage");
    assert.deepEqual(page.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), faq.map((f) => [f.q, f.a]), pathname);
  }
});

test("blog posts carry an image, dates and an author in their JSON-LD", () => {
  const posting = graphFor("/blog/best-ai-fruit-story-ideas").find((node) => node["@type"] === "BlogPosting");
  assert.equal(posting.datePublished, BLOG_DATES["/blog/best-ai-fruit-story-ideas"][0]);
  assert.ok(posting.dateModified >= posting.datePublished);
  assert.match(posting.image[0], /^https:\/\/www\.tryzyvo\.com\//);
  assert.equal(posting.author.name, "Zyvo");
});

test("example videos are files we host: shown and in the schema once a slot has a video and a poster", () => {
  assert.equal(videoLength("PT45S"), "0:45");
  assert.equal(videoLength("PT1M5S"), "1:05");
  assert.equal(videoLength(""), "");

  const filled = filledVideos([
    { video: "office-affair.mp4", poster: "office-affair.jpg", title: "T", uploadDate: "2026-10-12", duration: "PT45S" },
    { video: "no-poster.mp4", poster: "" },
    { video: "", poster: "no-video.jpg" },
  ]);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].url, `${FRUIT_VIDEO_BASE}/office-affair.mp4`);
  assert.equal(filled[0].posterSrc, `${FRUIT_POSTER_BASE}/office-affair.jpg`);
  assert.equal(filled[0].length, "0:45");
  assert.match(FRUIT_VIDEO_BASE, /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//);

  // What ships today: every slot that has a video has what the schema needs, and its poster is in the repo.
  const slots = [...FRUIT_EXAMPLE_VIDEOS, ...FRUIT_EXAMPLE_SERIES.episodes];
  assert.ok(FRUIT_EXAMPLE_SERIES.episodes.length <= LIMITS.maxEpisodes);
  for (const video of filledVideos(slots)) {
    assert.ok(video.title && /^\d{4}-\d{2}-\d{2}/.test(video.uploadDate), `${video.slot}: add the title and upload date`);
    assert.match(video.url, /\.mp4$/, `${video.slot}: the video must be an MP4`);
    if (video.posterSrc.startsWith("/")) assert.ok(existsSync(new URL(`../public${video.posterSrc}`, import.meta.url)), `${video.slot}: poster file missing`);
  }
  const objects = fruitVideoObjects("https://www.tryzyvo.com");
  assert.equal(objects.length, filledVideos(slots).length);
  for (const object of objects) {
    assert.match(object.contentUrl, /^https:\/\//);
    assert.match(object.thumbnailUrl[0], /^https:\/\//);
    assert.equal(object.embedUrl, undefined, "no YouTube: the schema points at our own file");
  }

  // The player fetches nothing before the click.
  const page = read("src/pages/landing/AIFruitStoryLanding.jsx");
  assert.doesNotMatch(page, /youtube(-nocookie)?\.com|ytimg\.com|<iframe/i);
  for (const tag of page.match(/<video\b[^>]*>/g)) assert.match(tag, /preload="none"/);
});

test("free wording: free to start with 5 image generations, video tools need a paid plan", () => {
  assert.equal(FREE_PLAN_LINE, "Start free with 5 image generations. Video tools like AI Fruit Story need a paid plan.");
  assert.match(HOME_SEO.description, /Start free with 5 image generations\.$/);
  assert.ok(HOME_SEO.description.length <= 160);
  assert.match(read("src/pages/workspace/HomeV2.jsx"), /\{FREE_PLAN_LINE\}/);
  assert.match(read("src/app/blog/imagegenerator/is-zyvo-free.jsx"), /\{FREE_PLAN_LINE\}/);
  assert.match(IS_ZYVO_FREE_FAQ[0].a, /5 image generations/);
  assert.match(IS_ZYVO_FREE_FAQ[0].a, /AI Fruit Story need a paid plan/);
  const faq = graphFor("/blog/is-zyvo-free").find((node) => node["@type"] === "FAQPage");
  assert.deepEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), IS_ZYVO_FREE_FAQ.map((f) => [f.q, f.a]));

  // Nothing public says every tool is free.
  for (const file of ["src/data/structuredData.js", "src/data/publicSeoMetadata.js", "src/data/blogArticles.js"]) {
    assert.doesNotMatch(read(file), /free entry point across|every tool has a free|every zyvo tool has a free/i, file);
  }
  for (const name of ["is-zyvo-free", "what-is-zyvo", "how-to-get-started-with-zyvo", "best-free-ai-tools-creators", "best-ai-video-generators-tiktok", "zyvo-template-comparison"]) {
    assert.doesNotMatch(read(`src/app/blog/imagegenerator/${name}.jsx`), /free entry point across|(every|any) (zyvo )?tool (above )?(has a )?free/i, name);
  }
  assert.match(getPublicSeoMetadata("/ai-fruit-story-maker").description, /Plans from €\d+\/month\.$/);
});

test("titles of the fruit pages that own a search fit in a result (60 characters)", () => {
  const owners = [
    "/ai-fruit-story-maker", "/blog/best-ai-fruit-story-ideas", "/blog/viral-ai-fruit-drama-videos", "/blog/what-is-ai-fruit-story",
    "/blog/ai-fruit-story-prompt-formula", "/blog/ai-fruit-story-talking-dialogue-tips", "/blog/ai-fruit-story-examples",
    "/blog/ai-fruit-story-pricing", "/blog/how-to-go-viral-tiktok-fruit-drama", "/blog/ai-fruit-story-instagram-youtube-shorts",
    "/blog/ai-fruit-story-character-names", "/blog/ai-fruit-story-plot-twists", "/blog/ai-fruit-story-cliffhangers", "/blog/ai-fruit-story-halloween",
  ];
  for (const pathname of owners) {
    const { title, description } = getPublicSeoMetadata(pathname);
    assert.ok(title.length <= 60, `${pathname}: ${title.length} characters`);
    assert.ok(description.length <= 160, `${pathname}: description ${description.length} characters`);
  }
});

test("the tool opens pre-filled from a handed-over prompt, never from the URL", () => {
  const flow = read("src/components/viral-tools/ai-fruit-story-v2/hooks/useFruitV2Flow.js");
  assert.match(flow, /useState\(initialSingle\)/);
  assert.match(flow, /if \(signedIn\) clearStashedFruitStory\(\)/); // a guest keeps the prompt until they have signed in
  const button = read("src/components/seo/MakeFruitVideoButton.jsx");
  assert.match(button, /stashFruitStory\(/);
  assert.doesNotMatch(button, /\?prompt=|searchParams/);
});
