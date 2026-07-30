// Keeps public/sitemap.xml in sync with the SEO landing-page + blog-post
// registries (src/data/seoLandingPages.js, src/data/seoBlogPosts.js) so
// those config files stay the single source of truth instead of being
// hand-duplicated into the sitemap separately. Run manually when adding a
// new page:
//
//   node scripts/generateSitemap.js
//
// It only APPENDS missing published/indexable URLs — it never removes or
// reorders existing entries, so it's safe to run at any time.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getPublishedSeoLandingPages, SITE_URL } from "../src/data/seoLandingPages.js";
import { seoBlogPosts } from "../src/data/seoBlogPosts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sitemapPath = path.join(__dirname, "..", "public", "sitemap.xml");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildUrlBlock(loc, { priority = "0.8", changefreq = "monthly" } = {}) {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    `    <lastmod>${todayIso()}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

function main() {
  const xml = readFileSync(sitemapPath, "utf8");

  const landingUrls = getPublishedSeoLandingPages().map((page) => ({
    loc: `${SITE_URL}/${page.slug}`,
    priority: page.parentSlug ? "0.9" : "1.0",
    changefreq: "weekly",
  }));

  const blogUrls = seoBlogPosts.map((post) => ({
    loc: `${SITE_URL}/blog/${post.slug}`,
    priority: "0.8",
    changefreq: "monthly",
  }));

  const missing = [...landingUrls, ...blogUrls].filter((entry) => !xml.includes(`<loc>${entry.loc}</loc>`));

  if (!missing.length) {
    console.log("sitemap.xml already contains every published SEO page/post — nothing to add.");
    return;
  }

  const newBlocks = missing.map((entry) => buildUrlBlock(entry.loc, entry)).join("\n\n");
  const updated = xml.replace("</urlset>", `${newBlocks}\n\n</urlset>`);
  writeFileSync(sitemapPath, updated);
  console.log(`Added ${missing.length} URL(s) to public/sitemap.xml:`);
  missing.forEach((entry) => console.log(`  - ${entry.loc}`));
}

main();
