// Reconciles public/sitemap.xml with public static routes plus the SEO
// landing-page and 2AM blog registries. Existing metadata is preserved for
// valid URLs, missing public blog/SEO URLs are added, duplicate entries are
// collapsed, and stale URLs that no longer map to a static route are removed.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getPublishedSeoLandingPages, SITE_URL } from "../src/data/seoLandingPages.js";
import { getPublishedSeoBlogPosts, seoBlogPosts } from "../src/data/seoBlogPosts.js";
import { getNoindexWorkspaceRoutes, getPublicWorkspaceRoutes } from "../src/data/routeSeoPolicy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const sitemapPath = path.join(projectRoot, "public", "sitemap.xml");
const appPath = path.join(projectRoot, "src", "App.jsx");
const vercelPath = path.join(projectRoot, "vercel.json");

const REQUIRED_PUBLIC_PAGES = [
  "/ai-fruit-story-maker",
  "/cartoon-drive-by-video-maker",
  "/footballer-nationality-swap-ai",
  "/behind-the-scenes-video-maker",
  "/face-asmr-maker",
  "/micro-camera-animal-maker",
  "/clay-rescue-maker",
  "/publish",
  "/stats",
  "/connections",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function staticRoutesFromApp(source) {
  const routes = new Set();
  const routePattern = /<Route\b[^>]*\bpath=["']([^"']+)["']/g;
  for (const match of source.matchAll(routePattern)) {
    const route = match[1];
    if (!route.includes(":") && !route.includes("*")) routes.add(route);
  }
  return routes;
}

function readExistingEntries(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/g)) {
    const body = match[1];
    const loc = body.match(/<loc>(.*?)<\/loc>/)?.[1];
    if (!loc) continue;
    entries.push({
      loc,
      lastmod: body.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
      changefreq: body.match(/<changefreq>(.*?)<\/changefreq>/)?.[1],
      priority: body.match(/<priority>(.*?)<\/priority>/)?.[1],
    });
  }
  return entries;
}

function buildUrlBlock({ loc, lastmod, changefreq, priority }) {
  const lines = ["  <url>", `    <loc>${loc}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

function main() {
  const xml = readFileSync(sitemapPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const vercelConfig = JSON.parse(readFileSync(vercelPath, "utf8"));
  const staticRoutes = staticRoutesFromApp(appSource);
  const redirectSources = new Set((vercelConfig.redirects || []).map((redirect) => redirect.source));
  const noindexRoutes = new Set(getNoindexWorkspaceRoutes().map((policy) => policy.path));
  const draftBlogRoutes = new Set(
    seoBlogPosts.filter((post) => post.published === false).map((post) => `/blog/${post.slug}`),
  );
  const entriesByPath = new Map();
  const removed = [];

  for (const entry of readExistingEntries(xml)) {
    const url = new URL(entry.loc);
    const pathname = url.pathname;
    if (
      !staticRoutes.has(pathname)
      || pathname === "/"
      || draftBlogRoutes.has(pathname)
      || redirectSources.has(pathname)
      || noindexRoutes.has(pathname)
      || url.search
    ) {
      removed.push(pathname);
      continue;
    }
    if (!entriesByPath.has(pathname)) {
      entriesByPath.set(pathname, { ...entry, loc: `${SITE_URL}${pathname}` });
    }
  }

  const required = [
    ...[...staticRoutes]
      .filter((route) => (route === "/blog" || route.startsWith("/blog/")) && !draftBlogRoutes.has(route))
      .map((route) => ({
        path: route,
        priority: route === "/blog" ? "0.9" : "0.8",
        changefreq: route === "/blog" ? "weekly" : "monthly",
      })),
    ...getPublishedSeoLandingPages().map((page) => ({
      path: `/${page.slug}`,
      priority: page.parentSlug ? "0.9" : "1.0",
      changefreq: "weekly",
    })),
    ...REQUIRED_PUBLIC_PAGES.map((page) => ({
      path: page,
      priority: "0.9",
      changefreq: "weekly",
    })),
    ...getPublicWorkspaceRoutes().map((policy) => ({
      path: policy.path,
      priority: "0.9",
      changefreq: "monthly",
    })),
    ...getPublishedSeoBlogPosts().map((post) => ({
      path: `/blog/${post.slug}`,
      priority: "0.8",
      changefreq: "monthly",
    })),
  ];

  const added = [];
  for (const item of required) {
    if (
      !staticRoutes.has(item.path)
      || redirectSources.has(item.path)
      || noindexRoutes.has(item.path)
      || entriesByPath.has(item.path)
    ) continue;
    entriesByPath.set(item.path, {
      loc: `${SITE_URL}${item.path}`,
      lastmod: todayIso(),
      changefreq: item.changefreq,
      priority: item.priority,
    });
    added.push(item.path);
  }

  const output = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "",
    [...entriesByPath.values()].map(buildUrlBlock).join("\n\n"),
    "",
    "</urlset>",
    "",
  ].join("\n");

  writeFileSync(sitemapPath, output);
  const finalPaths = [...entriesByPath.keys()];
  const invalidPaths = finalPaths.filter((pathname) => noindexRoutes.has(pathname) || redirectSources.has(pathname) || pathname.includes("?"));
  if (invalidPaths.length) throw new Error(`Sitemap contains non-indexable URL(s): ${invalidPaths.join(", ")}`);
  console.log(`Sitemap reconciled: ${entriesByPath.size} URL(s), ${added.length} added, ${removed.length} stale/duplicate URL(s) removed.`);
  added.forEach((route) => console.log(`  + ${route}`));
  removed.forEach((route) => console.log(`  - ${route}`));
}

main();
