import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getNoindexWorkspaceRoutes, getPublicWorkspaceRoutes } from "../src/data/routeSeoPolicy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
// prerenderSeo.js only writes this when every route actually rendered. If a
// build environment can't run headless Chromium (the Vercel build-image
// hang that blocked deploys), prerenderSeo.js now degrades gracefully
// instead of failing the build — so this script must degrade too, or it
// would just become the new thing hard-blocking every deploy.
const prerenderSucceeded = existsSync(path.join(root, "dist", ".seo-prerender-complete"));
const sitemap = read("public/sitemap.xml");
const redirects = JSON.parse(read("vercel.json")).redirects || [];
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapPaths = sitemapUrls.map((url) => new URL(url).pathname);

function snapshotFile(pathname) {
  return path.join(root, "dist", `${pathname.replace(/^\//, "")}.html`);
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function hasAttribute(tag, name, value) {
  return new RegExp(`\\b${name}=["']${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(tag);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateHead(pathname, expectedRobots) {
  const file = snapshotFile(pathname);
  assert(existsSync(file), `missing prerendered direct-route snapshot: ${pathname}`);
  const html = readFileSync(file, "utf8");
  const robots = tags(html, "meta").filter((tag) => hasAttribute(tag, "name", "robots"));
  const canonicals = tags(html, "link").filter((tag) => hasAttribute(tag, "rel", "canonical"));
  const ogUrls = tags(html, "meta").filter((tag) => hasAttribute(tag, "property", "og:url"));
  const canonical = `https://www.tryzyvo.com${pathname}`;
  assert(robots.length === 1, `${pathname} has ${robots.length} robots tags`);
  assert(hasAttribute(robots[0], "content", expectedRobots), `${pathname} robots mismatch: ${robots[0]}`);
  assert(canonicals.length === 1, `${pathname} has ${canonicals.length} canonicals`);
  assert(hasAttribute(canonicals[0], "href", canonical), `${pathname} canonical mismatch`);
  assert(ogUrls.length === 1, `${pathname} has ${ogUrls.length} og:url tags`);
  assert(hasAttribute(ogUrls[0], "content", canonical), `${pathname} og:url mismatch`);
  return html;
}

assert(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap contains duplicate URLs");
assert(!sitemapUrls.some((url) => url.includes("?")), "sitemap contains query-string URLs");

for (const { source } of redirects) {
  assert(!sitemapPaths.includes(source), `redirect source is in sitemap: ${source}`);
}

if (prerenderSucceeded) {
  for (const pathname of sitemapPaths) {
    validateHead(pathname, "index, follow, max-image-preview:large");
  }

  for (const { path: pathname } of getNoindexWorkspaceRoutes()) {
    assert(!sitemapPaths.includes(pathname), `noindex route is in sitemap: ${pathname}`);
    validateHead(pathname, "noindex, follow");
  }

  for (const { path: pathname } of getPublicWorkspaceRoutes()) {
    assert(sitemapPaths.includes(pathname), `public workspace route is missing from sitemap: ${pathname}`);
    validateHead(pathname, "index, follow, max-image-preview:large");
  }

  const aiFruitHtml = validateHead("/ai-fruit-story-maker", "index, follow, max-image-preview:large");
  assert((aiFruitHtml.match(/<h1\b/gi) || []).length === 1, "AI Fruit landing must have one H1");
  assert(!sitemapPaths.includes("/blog/ai-fruit-story-maker"), "merged AI Fruit blog remains in sitemap");
  assert(!sitemapPaths.includes("/workspace/ai-fruit-story"), "paid AI Fruit route remains in sitemap");
  assert(aiFruitHtml.includes("Account and paid plan required"), "AI Fruit paid-access disclosure is missing");
  assert(aiFruitHtml.includes('"@type":"FAQPage"'), "AI Fruit FAQ structured data is missing");

  const aiFruitCluster = [
    "/ai-fruit-story-maker",
    "/blog/viral-ai-fruit-drama-videos",
    "/blog/how-to-go-viral-tiktok-fruit-drama",
    "/blog/best-ai-fruit-story-ideas",
    "/blog/ai-fruit-story-character-ideas",
  ].map((pathname) => {
    const html = readFileSync(snapshotFile(pathname), "utf8");
    return {
      pathname,
      title: html.match(/<title>([^<]+)<\/title>/i)?.[1],
      description: tags(html, "meta").find((tag) => hasAttribute(tag, "name", "description"))?.match(/content=["']([^"']+)/i)?.[1],
      canonical: tags(html, "link").find((tag) => hasAttribute(tag, "rel", "canonical"))?.match(/href=["']([^"']+)/i)?.[1],
    };
  });
  for (const field of ["title", "description", "canonical"]) {
    const values = aiFruitCluster.map((page) => page[field]);
    assert(values.every(Boolean), `AI Fruit cluster has a missing ${field}`);
    assert(new Set(values).size === values.length, `AI Fruit cluster has duplicate ${field} values`);
  }
}

const app = read("src/App.jsx");
assert(!/path=["']\/workspace\/productphoto/i.test(app), "retired Product Photo route remains in App.jsx");

if (prerenderSucceeded) {
  console.log(`SEO indexing validation passed: ${sitemapUrls.length} public sitemap URL(s), ${getNoindexWorkspaceRoutes().length} prerendered noindex route(s).`);
} else {
  console.warn(
    `[validateSeoIndexing] SEO prerender snapshots are missing this build — skipped per-page meta-tag checks ` +
    `(sitemap/redirect/route-policy checks still ran). Verify prerenderSeo.js succeeds in this environment.`
  );
}
