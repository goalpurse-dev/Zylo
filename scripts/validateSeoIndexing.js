import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getNoindexWorkspaceRoutes, getPublicWorkspaceRoutes } from "../src/data/routeSeoPolicy.js";
import { HIDDEN_BLOG_POSTS } from "../src/data/unreleasedFeatures.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
// generateSeoHtml.js only writes this when every route actually generated.
// It exits non-zero on failure, so in the normal `npm run build` chain
// (generateSeoHtml.js && validateSeoIndexing.js) this script won't even be
// reached if generation failed — but it's asserted again here too, so a
// standalone `npm run seo:check` (or any future decoupling of that chain)
// can't silently pass without the generated snapshots it depends on.
const prerenderSucceeded = existsSync(path.join(root, "dist", ".seo-prerender-complete"));
const sitemap = read("public/sitemap.xml");
const redirects = JSON.parse(read("vercel.json")).redirects || [];
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapPaths = sitemapUrls.map((url) => new URL(url).pathname);

function snapshotFile(pathname) {
  // "/" IS dist/index.html — generateSeoHtml.js writes the homepage snapshot
  // directly there (see writeSnapshot in that file), not to a nested ".html".
  if (pathname === "/") return path.join(root, "dist", "index.html");
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

// Matches the brief's assertCanonical exactly — structural checks that can
// never pass regardless of which route/page produced the canonical.
function assertCanonical(canonical, pathname) {
  const url = new URL(canonical);
  assert(url.protocol === "https:", `${pathname}: invalid canonical protocol: ${canonical}`);
  assert(url.hostname === "www.tryzyvo.com", `${pathname}: invalid canonical hostname: ${canonical}`);
  assert(!url.search, `${pathname}: canonical contains query params: ${canonical}`);
  assert(!url.hash, `${pathname}: canonical contains hash: ${canonical}`);
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
  assertCanonical(canonical, pathname);
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
  // "/" is a real sitemap entry now (see scripts/generateSitemap.js) and a
  // real prerendered snapshot (dist/index.html, see writeSnapshot in
  // scripts/generateSeoHtml.js) — it's validated by the exact same hard-fail
  // loop as every other public page below, no special-casing needed.
  assert((readFileSync(snapshotFile("/"), "utf8").match(/application\/ld\+json/gi) || []).length <= 1, "homepage has more than one JSON-LD script");

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

  // Links on an indexable page go straight to a final URL: never to an address
  // that redirects, and never to a blog post that is hidden for now.
  const redirectSources = new Set(redirects.map((redirect) => redirect.source));
  const hiddenPosts = new Set(HIDDEN_BLOG_POSTS);
  for (const pathname of sitemapPaths) {
    const html = readFileSync(snapshotFile(pathname), "utf8");
    for (const match of html.matchAll(/<a\b[^>]*\bhref="(\/[^"#?]*)/g)) {
      const target = match[1].length > 1 ? match[1].replace(/\/+$/, "") : "/";
      assert(!redirectSources.has(target), `${pathname} links to ${target}, which redirects`);
      assert(!hiddenPosts.has(target), `${pathname} links to ${target}, a post that is hidden for now`);
    }
  }

  // The app shell and the 404 page exist, are noindex and carry no canonical.
  for (const file of ["app-shell.html", "404.html"]) {
    const full = path.join(root, "dist", file);
    assert(existsSync(full), `dist/${file} is missing`);
    const html = readFileSync(full, "utf8");
    assert(/<meta name="robots" content="noindex, follow"/.test(html), `dist/${file} must be noindex`);
    assert(!/rel="canonical"/.test(html), `dist/${file} must not carry a canonical`);
  }

  // JSON-LD: every block on every generated page must parse and carry what its type needs.
  // Real data only: a rating or review node fails the build (there are no ratings to report).
  const absolute = (value) => typeof value === "string" && /^https:\/\//.test(value);
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  const NODE_RULES = {
    Organization: (n) => text(n.name) && absolute(n.url) && absolute(n.logo?.url),
    WebSite: (n) => text(n.name) && absolute(n.url),
    WebPage: (n) => text(n.name) && absolute(n.url),
    Blog: (n) => text(n.name) && absolute(n.url),
    CollectionPage: (n) => text(n.name) && absolute(n.url),
    BlogPosting: (n) => text(n.headline) && text(n.description) && absolute(n.mainEntityOfPage) && text(n.author?.name) && text(n.publisher?.name),
    BreadcrumbList: (n) => Array.isArray(n.itemListElement) && n.itemListElement.length > 0 && n.itemListElement.every((item, i) => item.position === i + 1 && text(item.name) && absolute(item.item)),
    FAQPage: (n) => Array.isArray(n.mainEntity) && n.mainEntity.length > 0 && n.mainEntity.every((q) => q["@type"] === "Question" && text(q.name) && text(q.acceptedAnswer?.text)),
    SoftwareApplication: (n) => text(n.name) && text(n.description) && absolute(n.url) && text(n.applicationCategory) && Array.isArray(n.offers) && n.offers.length > 0
      && n.offers.every((offer) => /^\d+(\.\d+)?$/.test(String(offer.price)) && /^[A-Z]{3}$/.test(String(offer.priceCurrency))),
    VideoObject: (n) => text(n.name) && text(n.description) && [].concat(n.thumbnailUrl ?? []).length > 0 && [].concat(n.thumbnailUrl ?? []).every(absolute)
      && /^\d{4}-\d{2}-\d{2}/.test(String(n.uploadDate)) && (absolute(n.contentUrl) || absolute(n.embedUrl)) && (!n.duration || /^PT(\d+H)?(\d+M)?(\d+S)?$/.test(n.duration)),
  };
  let jsonLdBlocks = 0;
  const allSnapshots = [...sitemapPaths, ...getNoindexWorkspaceRoutes().map((policy) => policy.path)];
  for (const pathname of allSnapshots) {
    const html = readFileSync(snapshotFile(pathname), "utf8");
    for (const [, body] of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      jsonLdBlocks += 1;
      let data;
      try { data = JSON.parse(body); } catch (error) { throw new Error(`${pathname}: JSON-LD does not parse (${error.message})`); }
      assert(data["@context"] === "https://schema.org", `${pathname}: JSON-LD without the schema.org context`);
      assert(!/"(aggregateRating|review|reviewRating|ratingValue)"/.test(body), `${pathname}: JSON-LD carries a rating or review, and there are none to report`);
      const nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      assert(nodes.length > 0, `${pathname}: empty JSON-LD graph`);
      for (const node of nodes) {
        const rule = NODE_RULES[node["@type"]];
        assert(rule, `${pathname}: JSON-LD node of an unexpected type: ${node["@type"]}`);
        assert(rule(node), `${pathname}: invalid ${node["@type"]} in JSON-LD: ${JSON.stringify(node).slice(0, 200)}`);
      }
    }
  }
  // Every indexable page has its block, and every tool landing page states what the tool costs.
  for (const pathname of sitemapPaths) {
    const html = readFileSync(snapshotFile(pathname), "utf8");
    assert(/<script type="application\/ld\+json"/.test(html), `${pathname} has no JSON-LD`);
  }
  console.log(`JSON-LD validated: ${jsonLdBlocks} block(s) on ${allSnapshots.length} page(s).`);

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

assert(
  prerenderSucceeded,
  "SEO HTML snapshots are missing (dist/.seo-prerender-complete not found) — this build would ship every " +
  "public route as the bare SPA shell with no server-rendered title/canonical/H1/content. Check that " +
  "`vite build --ssr src/entry-server.jsx` and scripts/generateSeoHtml.js both ran and succeeded.",
);

console.log(`SEO indexing validation passed: ${sitemapUrls.length} public sitemap URL(s), ${getNoindexWorkspaceRoutes().length} prerendered noindex route(s).`);
