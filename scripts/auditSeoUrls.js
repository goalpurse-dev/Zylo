// Automated SEO health audit for every public URL in the sitemap.
//
// Two modes:
//   node scripts/auditSeoUrls.js            — audits the local dist/ build
//                                              (run `npm run build` first)
//   node scripts/auditSeoUrls.js --live[=https://www.tryzyvo.com]
//                                            — fetches each URL over the
//                                              network and audits the actual
//                                              production response
//
// For every sitemap URL this checks: HTTP status, meta robots, canonical
// (present + self-referencing), title (present + unique across the site),
// meta description (present + unique), H1 (present, exactly one), visible
// word count (thin-content flag), and how many other pages link to it via a
// real <Link>/<a href> in source (orphan-page flag). Duplicate title/
// description clusters are reported separately since GSC's "duplicate
// without user-selected canonical" bucket is usually caused by exactly this.
//
// Exit code is non-zero if any hard failure is found (status != 200,
// missing/duplicate canonical, missing title/H1, or an unprerendered route
// in dist mode) so this can be wired into CI later, not just run by hand.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const liveArg = args.find((arg) => arg.startsWith("--live"));
const LIVE = Boolean(liveArg);
const BASE_URL = liveArg?.includes("=") ? liveArg.split("=")[1] : "https://www.tryzyvo.com";
const THIN_CONTENT_WORDS = 150;
const WATCHLIST = args.includes("--watchlist");

// The 28 URLs GSC reported as "Crawled - currently not indexed" in the August
// 2026 audit (26 blog articles + /sitemap.xml + /image-generator). Used by
// --watchlist to filter the report to just this set.
const GSC_WATCHLIST = [
  "/blog/ai-visual-styles-most-engagement", "/sitemap.xml", "/blog/visual-optimization-for-mobile-ecommerce",
  "/blog/ai-product-photography-for-small-businesses", "/blog/ai-product-photos-for-fashion-stores",
  "/blog/ai-background-removal-for-product-photos", "/blog/how-to-create-minimalist-images-using-ai",
  "/blog/how-to-go-viral-with-ai", "/blog/product-photos-for-shopify-store", "/blog/best-ai-product-backgrounds-to-use",
  "/blog/product-photography-trends-for-ecommerce", "/blog/viral-ai-images-tiktok", "/blog/why-ai-images-outperform-real-photos",
  "/blog/how-ai-helps-ecommerce-brands-scale-faster", "/blog/how-to-generate-high-quality-images-with-ai",
  "/blog/all-image-styles-everyone-obsessed-with", "/blog/how-to-launch-products-faster-with-ai",
  "/blog/scroll-stopping-images-no-design-skills", "/blog/product-photography-mistakes-ecommerce-brands-make",
  "/blog/how-better-images-reduce-bounce-rate", "/blog/how-to-scale-ecommerce-content-creation-with-ai",
  "/blog/why-product-photos-matter-for-ecommerce-success", "/blog/the-secret-prompts-behind-viral-ai-images",
  "/blog/why-3d-ai-images-perform-better", "/blog/all-ai-image-trends-you-need-to-jump-on",
  "/blog/ai-product-photos-for-beaty-and-skincare", "/blog/ai-productphotos-for-dropshipping", "/image-generator",
];

function readSitemapPaths() {
  const xml = readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>https:\/\/www\.tryzyvo\.com([^<]*)<\/loc>/g)].map((m) => m[1] || "/");
}

function readRobotsDisallowRules() {
  const file = path.join(root, "public", "robots.txt");
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]).filter((rule) => rule && rule !== "");
}

function isDisallowedByRobots(pathname, rules) {
  return rules.some((rule) => pathname.startsWith(rule));
}

/* ───────────────────────── internal link graph ───────────────────────── */
// Primary source of truth: the actual rendered dist/**/index.html output.
// Some pages build their links from a dynamic slug/template-literal at
// render time (e.g. `/blog/${slug}`), which a source-code regex can't
// resolve — but by prerender time every such link has already resolved to a
// literal href in the HTML, so scanning dist/ avoids that class of false
// "orphan" positive entirely. Falls back to source-code scanning (.jsx/.js/
// .md for `to`/`href`/`slug` references) when no local dist/ build exists,
// e.g. when auditing --live without a matching local build.
function buildLinkGraphFromDist() {
  const counts = new Map();
  const distDir = path.join(root, "dist");
  if (!existsSync(distDir)) return counts;

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".html")) continue;
      const text = readFileSync(full, "utf8");
      for (const m of text.matchAll(/href=["'](\/[a-zA-Z0-9\-_/]*)["']/g)) {
        const p = m[1].replace(/\/$/, "") || "/";
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
  }
  walk(distDir);
  return counts;
}

function buildLinkGraphFromSource() {
  const counts = new Map();
  const exts = new Set([".jsx", ".js", ".md"]);
  const skipDirs = new Set(["node_modules", "dist", ".git", "scripts"]);

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(full);
        continue;
      }
      if (!exts.has(path.extname(entry.name))) continue;
      const text = readFileSync(full, "utf8");
      // JSX attributes: to="/x" / href="/x", PLUS object-literal data-array
      // registries like BlogIndex.jsx's { to: "/x", ... } and RelatedArticles'
      // { slug: "/x", ... } — those use `key: "value"`, not `key="value"`,
      // and are how most of the site's blog cross-linking is actually done.
      // Cannot resolve dynamic `/blog/${slug}`-style links — see dist/ pass.
      for (const m of text.matchAll(/\b(?:to|href|slug)\s*[:=]\s*["'](\/[a-zA-Z0-9\-_/]*)["']/g)) {
        const p = m[1].replace(/\/$/, "") || "/";
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      // 2AM markdown content links: [Label → /path]
      for (const m of text.matchAll(/→\s*(\/[a-zA-Z0-9\-_/]*)/g)) {
        const p = m[1].replace(/\/$/, "") || "/";
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
  }
  walk(path.join(root, "src"));
  return counts;
}

function buildLinkGraph() {
  const fromDist = buildLinkGraphFromDist();
  if (fromDist.size > 0) return fromDist;
  return buildLinkGraphFromSource();
}

/* ───────────────────────── per-page extraction ───────────────────────── */
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSignals(html) {
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || null;
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]
    || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)?.[1]
    || null;
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)?.[1]
    || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']robots["']/i)?.[1]
    || null;
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1]
    || html.match(/<link\s+href=["']([^"']*)["']\s+rel=["']canonical["']/i)?.[1]
    || null;
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const rootMatch = html.match(/<div id="root">([\s\S]*)<\/body>/i);
  const bodyText = stripTags(rootMatch ? rootMatch[1] : html);
  const wordCount = bodyText ? bodyText.split(" ").filter(Boolean).length : 0;
  return {
    title,
    description,
    robots,
    canonical,
    h1Count: h1Matches.length,
    h1Text: h1Matches[0] ? stripTags(h1Matches[0][1]) : null,
    wordCount,
  };
}

async function fetchLive(pathname) {
  const url = `${BASE_URL}${pathname}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      return { status: res.status, redirectTo: res.headers.get("location"), html: "" };
    }
    const html = await res.text();
    return { status: res.status, redirectTo: null, html, xRobotsTag: res.headers.get("x-robots-tag") };
  } catch (error) {
    return { status: 0, redirectTo: null, html: "", error: String(error) };
  }
}

function readDist(pathname) {
  const file = path.join(root, "dist", pathname.replace(/^\/+/, ""), "index.html");
  if (!existsSync(file) || !statSync(file).isFile()) return { status: null, html: "" };
  return { status: 200, html: readFileSync(file, "utf8") };
}

/* ───────────────────────────── main ───────────────────────────── */
async function main() {
  if (!LIVE && !existsSync(path.join(root, "dist", ".seo-prerender-complete"))) {
    console.error(
      "No local prerendered build found (dist/.seo-prerender-complete missing). " +
      "Run `npm run build` first, or pass --live to audit production directly."
    );
    process.exit(1);
  }

  let paths = readSitemapPaths();
  if (WATCHLIST) paths = paths.filter((p) => GSC_WATCHLIST.includes(p));
  const linkGraph = buildLinkGraph();
  const robotsRules = readRobotsDisallowRules();
  const rows = [];
  const titleOwners = new Map();
  const descriptionOwners = new Map();

  for (const pathname of paths) {
    const page = LIVE ? await fetchLive(pathname) : readDist(pathname);
    const signals = page.html ? extractSignals(page.html) : {};
    const canonicalSelf = signals.canonical === `https://www.tryzyvo.com${pathname}`;
    const inboundLinks = linkGraph.get(pathname) || 0;
    const robotsDisallowed = isDisallowedByRobots(pathname, robotsRules);

    const row = {
      url: pathname,
      status: page.redirectTo ? `${page.status} → ${page.redirectTo}` : (page.status ?? "MISSING"),
      indexable: signals.robots ? !/noindex/i.test(signals.robots) : (page.status === 200 ? "unknown (no robots tag found)" : false),
      canonicalSelf,
      canonical: signals.canonical || null,
      xRobotsTag: page.xRobotsTag || null,
      title: signals.title || null,
      description: signals.description || null,
      h1Count: signals.h1Count ?? 0,
      wordCount: signals.wordCount ?? 0,
      inboundLinks,
      robotsDisallowed,
      failures: [],
    };

    if (robotsDisallowed) row.failures.push("blocked by robots.txt Disallow rule");
    if (page.redirectTo) row.failures.push("REDIRECTED — not directly indexable at this URL");
    else if (page.status !== 200) row.failures.push(`HTTP ${page.status || "no response"}`);
    if (!row.canonicalSelf) row.failures.push(`canonical mismatch (got: ${signals.canonical || "none"})`);
    if (!signals.title) row.failures.push("missing <title>");
    if (!signals.description) row.failures.push("missing meta description");
    if (signals.h1Count === 0) row.failures.push("missing H1");
    if (signals.h1Count > 1) row.failures.push(`${signals.h1Count} H1s (expected 1)`);
    if (row.xRobotsTag && /noindex/i.test(row.xRobotsTag)) row.failures.push(`X-Robots-Tag: ${row.xRobotsTag}`);
    if (signals.robots && /noindex/i.test(signals.robots)) row.failures.push(`meta robots: ${signals.robots}`);
    if ((signals.wordCount ?? 0) > 0 && signals.wordCount < THIN_CONTENT_WORDS) row.failures.push(`thin content (${signals.wordCount} words)`);
    if (inboundLinks === 0) row.failures.push("orphan — 0 internal links found in source pointing to this URL");

    rows.push(row);
    if (signals.title) titleOwners.set(signals.title, [...(titleOwners.get(signals.title) || []), pathname]);
    if (signals.description) descriptionOwners.set(signals.description, [...(descriptionOwners.get(signals.description) || []), pathname]);
  }

  for (const row of rows) {
    if (row.title && (titleOwners.get(row.title) || []).length > 1) row.failures.push(`duplicate title shared with ${titleOwners.get(row.title).length - 1} other URL(s)`);
    if (row.description && (descriptionOwners.get(row.description) || []).length > 1) row.failures.push(`duplicate description shared with ${descriptionOwners.get(row.description).length - 1} other URL(s)`);
  }

  const failing = rows.filter((r) => r.failures.length > 0);
  const passing = rows.filter((r) => r.failures.length === 0);

  console.log(`\n${"=".repeat(70)}`);
  console.log(`SEO URL AUDIT — ${LIVE ? `live (${BASE_URL})` : "local dist/ build"}${WATCHLIST ? " — GSC watchlist only" : ""}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`${rows.length} URL(s) checked — ${passing.length} clean, ${failing.length} with findings.\n`);

  for (const row of rows) {
    const mark = row.failures.length ? "✗" : "✓";
    console.log(`${mark} ${row.url}`);
    console.log(`    status=${row.status}  words=${row.wordCount}  h1=${row.h1Count}  inboundLinks=${row.inboundLinks}  canonicalSelf=${row.canonicalSelf}`);
    if (row.title) console.log(`    title: ${row.title}`);
    if (row.description) console.log(`    desc:  ${row.description.slice(0, 100)}${row.description.length > 100 ? "…" : ""}`);
    for (const f of row.failures) console.log(`    ⚠ ${f}`);
    console.log("");
  }

  const dupTitleClusters = [...titleOwners.entries()].filter(([, urls]) => urls.length > 1);
  const dupDescClusters = [...descriptionOwners.entries()].filter(([, urls]) => urls.length > 1);
  if (dupTitleClusters.length) {
    console.log(`${"-".repeat(70)}\nDUPLICATE TITLES\n${"-".repeat(70)}`);
    for (const [title, urls] of dupTitleClusters) console.log(`"${title}"\n  ${urls.join("\n  ")}`);
  }
  if (dupDescClusters.length) {
    console.log(`${"-".repeat(70)}\nDUPLICATE DESCRIPTIONS\n${"-".repeat(70)}`);
    for (const [desc, urls] of dupDescClusters) console.log(`"${desc.slice(0, 80)}…"\n  ${urls.join("\n  ")}`);
  }

  const orphans = rows.filter((r) => r.inboundLinks === 0);
  console.log(`\n${"-".repeat(70)}\nSUMMARY\n${"-".repeat(70)}`);
  console.log(`Total URLs:        ${rows.length}`);
  console.log(`Clean:             ${passing.length}`);
  console.log(`With findings:     ${failing.length}`);
  console.log(`Orphan pages:      ${orphans.length}${orphans.length ? " — " + orphans.map((r) => r.url).join(", ") : ""}`);
  console.log(`Duplicate titles:  ${dupTitleClusters.length} cluster(s)`);
  console.log(`Duplicate descs:   ${dupDescClusters.length} cluster(s)`);
  console.log(`Thin content:      ${rows.filter((r) => r.failures.some((f) => f.startsWith("thin content"))).length}`);

  const hardFailures = rows.filter((r) =>
    r.failures.some((f) => f.startsWith("HTTP") || f.startsWith("REDIRECTED") || f.startsWith("canonical mismatch") || f.startsWith("missing <title>") || f.startsWith("missing H1"))
  );
  // /sitemap.xml itself is not an HTML page and is deliberately not part of
  // the sitemap's own <loc> list, so it never goes through the loop above.
  // Per GSC, "Crawled - currently not indexed" for the sitemap file itself is
  // expected/fine — sitemaps are for crawler discovery, not search results —
  // so this only verifies validity/discovery, not indexability.
  if (WATCHLIST || paths.length === 0) {
    console.log(`\n${"-".repeat(70)}\n/sitemap.xml VALIDITY\n${"-".repeat(70)}`);
    const sitemapPage = LIVE ? await fetchLive("/sitemap.xml") : readDist("/sitemap.xml");
    const xml = LIVE ? sitemapPage.html : (existsSync(path.join(root, "public", "sitemap.xml")) ? readFileSync(path.join(root, "public", "sitemap.xml"), "utf8") : "");
    const wellFormed = /^<\?xml/.test(xml.trim()) && /<urlset/.test(xml) && /<\/urlset>/.test(xml);
    const urlCount = [...xml.matchAll(/<loc>/g)].length;
    console.log(`status: ${LIVE ? sitemapPage.status : (existsSync(path.join(root, "public", "sitemap.xml")) ? 200 : "MISSING")}`);
    console.log(`well-formed XML: ${wellFormed}`);
    console.log(`URL count: ${urlCount}`);
    if (!wellFormed) {
      console.log("⚠ sitemap.xml is missing or malformed");
      process.exitCode = 1;
    }
  }

  if (hardFailures.length) {
    console.log(`\n${hardFailures.length} URL(s) have hard technical failures — see ⚠ marks above.`);
    process.exit(1);
  }
}

main();
