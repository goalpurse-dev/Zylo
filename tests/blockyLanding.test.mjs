// The public page of Blocky Stories (/blocky-story-video-maker): its tags, the trademark rules, the plan
// numbers (computed, never typed) and where it is registered. The built HTML has its own check:
// scripts/blocky/checkLanding.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BLOCKY_EXAMPLES, BLOCKY_FAQ, BLOCKY_HERO_VIDEO, BLOCKY_LANDING_ASSETS, BLOCKY_LANDING_PATH, BLOCKY_LANDING_SEO, BLOCKY_NOTICE, BLOCKY_STEPS, BLOCKY_FEATURES, BLOCKY_TOOL_PATH,
  BLOCKY_TUTORIAL, GENRE, blockyFaq, blockyIntro, blockyListPrices, blockyNotice, blockyPlanRows, blockyStructuredData, blockyVideoObjects,
} from "../src/data/blockyStoryLanding.js";
import { PICTURE, SCRIPT, TIERS } from "../supabase/functions/_shared/blocky/pricing.js";
import { PLAN_CREDITS } from "../supabase/functions/_shared/stripePlanPrices.js";
import { getPublicSeoMetadata } from "../src/data/publicSeoMetadata.js";
import { structuredDataFor } from "../src/data/structuredData.js";
import { publicLandingFor, publicRobotsFor } from "../src/data/routeSeoPolicy.js";

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const SITE = "https://www.tryzyvo.com";

test("URL, title and description: within the limits, and what the page tags are built from", () => {
  assert.equal(BLOCKY_LANDING_PATH, "/blocky-story-video-maker");
  assert.ok(BLOCKY_LANDING_SEO.title.length <= 60, `title is ${BLOCKY_LANDING_SEO.title.length} characters`);
  assert.ok(BLOCKY_LANDING_SEO.description.length <= 155, `description is ${BLOCKY_LANDING_SEO.description.length} characters`);
  const meta = getPublicSeoMetadata(BLOCKY_LANDING_PATH);
  assert.deepEqual([meta.title, meta.description, meta.type, meta.inlineContent], [BLOCKY_LANDING_SEO.title, BLOCKY_LANDING_SEO.description, "website", true]);
  assert.equal(meta.image, `${SITE}${BLOCKY_LANDING_ASSETS}/og-blocky-stories.jpg`);
  assert.deepEqual(meta.imageSize, [1200, 630]);
  assert.equal(meta.preloadImage, "/lp/blocky-stories/story-no-hats-allowed.w540.webp", "the hero poster, the file the page's <img> asks for");
  assert.equal(publicRobotsFor(BLOCKY_LANDING_PATH), "index, follow, max-image-preview:large");
  assert.equal(BLOCKY_LANDING_SEO.cta, "Make your first story");
  assert.equal(BLOCKY_TOOL_PATH, "/workspace/blocky-stories");
});

test("trademark rules: the genre's name lives in ONE constant and never in a URL, tag, heading, file name or alt text", () => {
  const data = read("src/data/blockyStoryLanding.js");
  const named = data.split("\n").filter((line) => /roblox/i.test(line));
  assert.equal(named.length, 1, "one line of the content file holds the name");
  assert.match(named[0], /^export const GENRE = \{ style: "Roblox-style", short: "Roblox", owner: "Roblox Corporation" \};$/);
  for (const f of ["src/pages/landing/BlockyStoriesLanding.jsx", "scripts/blocky/publishShowcase.mjs"]) assert.doesNotMatch(read(f), /roblox/i, f);
  for (const s of [BLOCKY_LANDING_PATH, BLOCKY_LANDING_SEO.title, BLOCKY_LANDING_SEO.description, BLOCKY_LANDING_SEO.h1, BLOCKY_LANDING_SEO.appName, BLOCKY_HERO_VIDEO.alt, BLOCKY_HERO_VIDEO.url, ...BLOCKY_EXAMPLES.flatMap((c) => [c.alt, c.url, c.poster, c.title])]) assert.doesNotMatch(s, /roblox/i, s);
  for (const file of fs.readdirSync(new URL("../public/lp/blocky-stories/", import.meta.url))) assert.doesNotMatch(file, /roblox/i, file);
  for (const item of [...BLOCKY_STEPS, ...BLOCKY_FEATURES]) assert.doesNotMatch(`${item.title} ${item.text}`, /roblox/i);
  // On the page: two descriptive mentions, always "…-style"; the "affiliated" question; the notice, word for word.
  const body = [...blockyIntro().paragraphs, ...BLOCKY_FAQ.flatMap((x) => [x.q, x.a])].join(" ");
  assert.equal(body.split(GENRE.style).length - 1, 2);
  assert.equal(BLOCKY_FAQ.at(-1).q, "Is this affiliated with Roblox?");
  assert.match(BLOCKY_FAQ.at(-1).a, /^No\. Blocky Stories is an independent Zyvo tool\. It is not affiliated with, endorsed by or sponsored by Roblox Corporation\./);
  assert.equal(BLOCKY_NOTICE, "Blocky Stories is an independent Zyvo tool and is not affiliated with, endorsed by or sponsored by Roblox Corporation.");
  // Every mention that is not "…-style" is the question, its answer's company name, or the notice.
  assert.equal(body.replaceAll(GENRE.style, "").split("Roblox").length - 1, 2);
});

test("one change removes every mention: with the constant off the page reads on without the name", () => {
  const off = [...blockyIntro(null).paragraphs, ...blockyFaq(null).flatMap((x) => [x.q, x.a]), String(blockyNotice(null))].join(" ");
  assert.doesNotMatch(off, /roblox/i);
  assert.equal(blockyNotice(null), null);
  assert.equal(blockyFaq(null).length, BLOCKY_FAQ.length - 1, "the \"affiliated\" question goes with it");
  assert.match(blockyIntro(null).paragraphs[0], /^Blocky Stories makes the story videos that fill Shorts feeds:/, "the sentence still reads");
  assert.doesNotMatch(off, /  |\bthe\s+that\b| ,/, "no gap is left where the name was");
});

test("plan numbers are computed from the price rows, never typed", () => {
  const prices = blockyListPrices();
  assert.deepEqual([prices.image, prices.script], [PICTURE.credits, SCRIPT.credits]);
  const rows = blockyPlanRows();
  assert.deepEqual(rows.map((r) => [r.id, r.credits, r.tiers.map((t) => t.id).join()]), [["starter", PLAN_CREDITS.starter, "v2"], ["pro", PLAN_CREDITS.pro, "v2,v3"], ["generative", PLAN_CREDITS.generative, "v2,v3,v4"]]);
  // A 30-second story: six pictures, the script, and thirty seconds of the tier's video.
  const story = (id) => 6 * PICTURE.credits + SCRIPT.credits + Math.ceil(TIERS[id].creditsPerSec * 30 - 1e-9);   // the tool's own estimate (blockyEstimates.js#estimateStory)
  for (const row of rows) for (const tier of row.tiers) {
    assert.equal(tier.storyCredits, story(tier.id), `${tier.id}: the credits of one story`);
    assert.equal(tier.stories, Math.floor(row.credits / story(tier.id)), `${row.id} on ${tier.id}`);
  }
  // Live quotes change the numbers (the page passes them in once the browser has them).
  const dearer = blockyPlanRows({ ...prices, image: prices.image * 2 });
  assert.ok(dearer[0].tiers[0].stories < rows[0].tiers[0].stories);
  // The "how many videos" answer says the same numbers.
  const answer = BLOCKY_FAQ.find((x) => /How many videos/.test(x.q)).a;
  for (const row of rows) for (const tier of row.tiers) assert.ok(answer.includes(`${tier.stories} on ${tier.label}`), `${row.name}: ${tier.stories} on ${tier.label}`);
  const source = read("src/data/blockyStoryLanding.js");
  assert.doesNotMatch(source.slice(source.indexOf("export const blockyFaq")), /\b(103|144|369)\b/, "no story price is typed into the answers");
});

test("the copy keeps to what the tool does", () => {
  assert.equal(BLOCKY_STEPS.length, 5);
  assert.equal(BLOCKY_FEATURES.length, 7);
  assert.ok(BLOCKY_FAQ.length >= 6 && BLOCKY_FAQ.length <= 8);
  const all = JSON.stringify([BLOCKY_STEPS, BLOCKY_FEATURES, BLOCKY_FAQ, blockyIntro()]);
  // An avatar has no age: never a kid, a child, a boy or a girl.
  assert.doesNotMatch(all, /\b(kid|kids|child|children|boy|girl)\b/i);
  // Making a video needs a plan: the page never says it is free.
  assert.doesNotMatch(all.replace(/Writing is free|writing the three versions is free/gi, ""), /\bfor free\b|\bfree video/i);
  assert.match(BLOCKY_FAQ.find((x) => /before paying/.test(x.q)).a, /need a paid plan, starting with Starter/);
});

test("media: every clip is one the publish script knows, with its posters in the repo", () => {
  const publish = read("scripts/blocky/publishShowcase.mjs");
  for (const clip of [BLOCKY_HERO_VIDEO, ...BLOCKY_EXAMPLES]) {
    assert.ok(publish.includes(`"${clip.id}"`), clip.id);
    assert.match(clip.url, /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/generated\/blocky\/showcase\/[a-z0-9-]+\.mp4$/);
    for (const w of clip.posterWidths) assert.ok(fs.existsSync(new URL(`../public${BLOCKY_LANDING_ASSETS}/${clip.poster}.w${w}.webp`, import.meta.url)), `${clip.poster}.w${w}.webp`);
    assert.ok(clip.alt.length >= 40 && /blocky game avatar/.test(clip.alt), clip.alt);
  }
  assert.equal(BLOCKY_EXAMPLES.length, 4);
  assert.ok(fs.existsSync(new URL("../public/lp/blocky-stories/og-blocky-stories.jpg", import.meta.url)));
});

test("structured data: SoftwareApplication with the plans' prices, the videos, the FAQ, the breadcrumb", () => {
  const canonical = `${SITE}${BLOCKY_LANDING_PATH}`;
  const data = structuredDataFor(BLOCKY_LANDING_PATH, getPublicSeoMetadata(BLOCKY_LANDING_PATH), canonical);
  assert.deepEqual(data, blockyStructuredData(canonical, SITE));
  const graph = data["@graph"];
  assert.deepEqual(graph.map((n) => n["@type"]), ["SoftwareApplication", "BreadcrumbList", "VideoObject", "VideoObject", "VideoObject", "VideoObject", "VideoObject", "FAQPage"]);
  const app = graph[0];
  assert.deepEqual(app.offers.map((o) => [o.price, o.priceCurrency]), [["18", "EUR"], ["38", "EUR"], ["78", "EUR"]]);
  for (const v of blockyVideoObjects(SITE)) for (const key of ["name", "description", "thumbnailUrl", "uploadDate", "duration", "contentUrl"]) assert.ok(v[key], `${v.name}: ${key}`);
  assert.equal(graph.at(-1).mainEntity.length, BLOCKY_FAQ.length);
  // The tutorial has no video yet: no slot on the page and no VideoObject for it.
  assert.equal(BLOCKY_TUTORIAL, null);
  assert.match(read("src/pages/landing/BlockyStoriesLanding.jsx"), /\{BLOCKY_TUTORIAL\?\.id && \(/);
});

test("the page is registered everywhere a public page must be, and the tool's links lead to it", () => {
  const app = read("src/App.jsx");
  assert.match(app, /const BlockyStoriesLanding = lazy\(\(\) => import\("\.\/pages\/landing\/BlockyStoriesLanding\.jsx"\)\);/);
  assert.match(app, /<Route path="\/blocky-story-video-maker" element=\{<BlockyStoriesLanding \/>\} \/>/);
  assert.ok(read("scripts/generateSitemap.js").includes('"/blocky-story-video-maker",'));
  assert.ok(read("public/sitemap.xml").includes(`<loc>${SITE}/blocky-story-video-maker</loc>`));
  assert.ok(read("public/llms.txt").includes(`${SITE}/blocky-story-video-maker`));
  // Home's Blocky card and section and the short form suite are ToolLinks: their address for crawlers is this page.
  assert.equal(publicLandingFor("/workspace/blocky-stories"), "/blocky-story-video-maker");
  assert.match(read("src/components/pricing/OutputTables.jsx"), /\{ title: "Blocky Stories", href: "\/blocky-story-video-maker", rows: \[/);
  // The page itself links to the tool (not back to itself through a ToolLink) and to pricing.
  const page = read("src/pages/landing/BlockyStoriesLanding.jsx");
  assert.match(page, /<Link to=\{BLOCKY_TOOL_PATH\}/);
  assert.match(page, /<Link to="\/pricing"/);
  assert.doesNotMatch(page, /ToolLink/);
});
