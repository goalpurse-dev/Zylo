// Deterministic, build-time SEO HTML generator. Replaces the previous
// Playwright/Chromium-based prerenderSeo.js entirely — no browser, no
// headless rendering, no serverless-Chromium compatibility layer.
//
// For every public sitemap URL and noindex/public workspace route, this:
//   1. Server-renders the REAL React app (via react-dom/server, through the
//      Vite SSR build at dist-ssr/entry-server.js) for that exact pathname —
//      the same components, same content, same internal links a real user
//      gets, just executed in Node instead of a browser.
//   2. Computes title/description/canonical/robots/OG/JSON-LD directly from
//      the same data sources the client's useEffect-driven metadata system
//      reads (publicSeoMetadata.js, routeSeoPolicy.js, structuredData.js) —
//      not scraped from a rendered DOM, since effects never run during SSR.
//   3. Injects both into the real Vite-built index.html template (so the
//      exact same hashed script/style tags real users get are preserved —
//      the generated HTML hydrates into the normal client app unchanged)
//      and writes dist/<route>.html + dist/<route>/index.html.
//   4. Validates the result (one H1, self-referencing canonical, correct
//      robots, non-generic title) before writing — any failure fails the
//      whole build loudly, exactly as the browser-based version did.
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPublicSeoMetadata, canonicalFor, SITE_URL } from "../src/data/publicSeoMetadata.js";
import { structuredDataFor } from "../src/data/structuredData.js";
import { getNoindexWorkspaceRoutes, getWorkspaceRouteSeoPolicy } from "../src/data/routeSeoPolicy.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const sitemapPath = path.join(projectRoot, "public", "sitemap.xml");
const indexTemplatePath = path.join(distDir, "index.html");
const ssrEntryPath = path.join(distDir.replace(/dist$/, "dist-ssr"), "entry-server.js");
const SUCCESS_MARKER = path.join(distDir, ".seo-prerender-complete");
const DEFAULT_DESCRIPTION = "Create AI images, videos, and social content with Zyvo.";

function sitemapPaths() {
  const xml = readFileSync(sitemapPath, "utf8");
  return [...xml.matchAll(/<loc>https:\/\/www\.tryzyvo\.com([^<]*)<\/loc>/g)]
    .map((m) => m[1] || "/");
}

// Decodes entities React's server renderer produces for text nodes (it
// escapes &, <, >, ", and ' for safety). Must run BEFORE the &amp; -> &
// unescape below, and must cover ' specifically — otherwise a title/H1
// derived from rendered HTML still contains a literal "&#x27;"/"&#39;"
// substring, which escapeAttr() then re-escapes into "&amp;#x27;" when the
// derived value is written back into the <title>/meta tags.
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Mirrors PublicContentLayout.jsx's old client-side improveLegacyMetadata()
// fallback (derive title from the page's own H1, description from its first
// paragraph) for the handful of older pages with no publicSeoMetadata.js
// entry — applied here to the SSR-rendered HTML string instead of a live DOM.
function deriveLegacyTitleDescription(innerHtml) {
  const h1Match = innerHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const heading = h1Match ? stripTags(h1Match[1]) : null;
  const pMatch = innerHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const paragraph = pMatch ? stripTags(pMatch[1]) : null;
  return {
    title: heading ? `${heading} | Zyvo` : null,
    description: paragraph
      ? (paragraph.length > 157 ? `${paragraph.slice(0, 157).replace(/\s+\S*$/, "")}…` : paragraph)
      : null,
  };
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Removes an existing <meta ...> (or <title>) tag matching the given
// name/property attribute+value, tolerant of attribute order and the
// multi-line attribute formatting index.html actually uses.
function removeTag(html, tagName, matchAttr, matchValue) {
  const pattern = new RegExp(
    `<${tagName}\\b(?:(?!/?>)[\\s\\S])*?${matchAttr}=["']${matchValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'](?:(?!/?>)[\\s\\S])*?/?>`,
    "i",
  );
  return html.replace(pattern, "");
}

function buildHead({ pathname, seoVisibility, innerHtml }) {
  const metadata = getPublicSeoMetadata(pathname);
  const workspacePolicy = getWorkspaceRouteSeoPolicy(pathname);
  const canonical = canonicalFor(pathname);
  const robots = seoVisibility === "noindex" ? "noindex, follow" : "index, follow, max-image-preview:large";

  const derived = (!metadata?.title || !metadata?.description) ? deriveLegacyTitleDescription(innerHtml) : null;
  const title = metadata?.title || workspacePolicy?.title || derived?.title || "Zyvo";
  const description = metadata?.description || workspacePolicy?.description || derived?.description || DEFAULT_DESCRIPTION;
  const ogImage = metadata?.image || `${SITE_URL}/og-image.png`;
  const ogType = metadata?.type || "website";
  const structuredData = structuredDataFor(pathname, metadata, canonical);

  return { title, description, canonical, robots, ogImage, ogType, structuredData, imageSize: metadata?.imageSize, preloadImage: metadata?.preloadImage, fontHref: metadata?.fontHref, hydrate: Boolean(metadata?.inlineContent), viewport: metadata?.viewport };
}

function injectHead(template, head) {
  let html = template;

  html = removeTag(html, "title", "", "").replace(/<title>[\s\S]*?<\/title>/i, ""); // fallback exact match too
  html = removeTag(html, "meta", "name", "description");
  html = removeTag(html, "meta", "property", "og:title");
  html = removeTag(html, "meta", "property", "og:description");
  html = removeTag(html, "meta", "property", "og:type");
  html = removeTag(html, "meta", "property", "og:url");
  html = removeTag(html, "meta", "property", "og:image");

  const tags = [
    `<title>${escapeAttr(head.title)}</title>`,
    `<meta name="description" content="${escapeAttr(head.description)}" />`,
    `<link rel="canonical" href="${escapeAttr(head.canonical)}" />`,
    `<meta name="robots" content="${escapeAttr(head.robots)}" />`,
    `<meta property="og:title" content="${escapeAttr(head.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(head.description)}" />`,
    `<meta property="og:type" content="${escapeAttr(head.ogType)}" />`,
    `<meta property="og:url" content="${escapeAttr(head.canonical)}" />`,
    `<meta property="og:image" content="${escapeAttr(head.ogImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(head.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(head.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(head.ogImage)}" />`,
  ];
  if (head.imageSize) {
    tags.push(`<meta property="og:image:width" content="${head.imageSize[0]}" />`, `<meta property="og:image:height" content="${head.imageSize[1]}" />`);
  }
  // Per-page head extras (publicSeoMetadata.js): the hero poster is fetched
  // first; the display font loads without blocking the first paint.
  if (head.preloadImage) {
    tags.push(`<link rel="preload" as="image" href="${escapeAttr(head.preloadImage)}" fetchpriority="high" />`);
  }
  if (head.fontHref) {
    tags.push(
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
      `<link rel="stylesheet" href="${escapeAttr(head.fontHref)}" media="print" onload="this.media='all'" />`,
    );
  }
  if (head.structuredData) {
    tags.push(`<script type="application/ld+json" id="page-ld">${JSON.stringify(head.structuredData)}</script>`);
  }

  html = html.replace("</head>", `${tags.join("\n    ")}\n  </head>`);
  html = html.replace('<html lang="en">', head.hydrate ? '<html lang="en" data-prerendered="true" data-hydrate="true">' : '<html lang="en" data-prerendered="true">');
  // A hydrated page is complete without the app script: fetch the script
  // after the styles and the hero picture, not in competition with them.
  if (head.hydrate) html = deferAppScript(html);
  if (head.viewport) {
    const viewportTag = /<meta name="viewport" content="[^"]*"\s*\/?>/;
    if (!viewportTag.test(html)) throw new Error("the viewport tag was not found in the template");
    html = html.replace(viewportTag, () => `<meta name="viewport" content="${escapeAttr(head.viewport)}" />`);
  }
  return html;
}

// Replaces Vite's <script type="module" src="/assets/index-….js"> with a tiny
// loader that adds the same script once the page is on screen: when the
// browser reports the largest picture painted (or the first paint where that
// isn't supported, or two animation frames as a last resort), and after 3 s
// at the latest (a tab opened in the background never paints).
const APP_SCRIPT_LOADER = (src) => `(function(){var done=0;function go(){if(done)return;done=1;var s=document.createElement("script");s.type="module";s.crossOrigin="anonymous";s.src=${JSON.stringify(src)};document.head.appendChild(s)}var types=window.PerformanceObserver&&PerformanceObserver.supportedEntryTypes||[];var type=types.indexOf("largest-contentful-paint")>=0?"largest-contentful-paint":types.indexOf("paint")>=0?"paint":"";if(type){try{new PerformanceObserver(function(list,observer){observer.disconnect();go()}).observe({type:type,buffered:true})}catch(e){type=""}}if(!type)requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(go,0)})});setTimeout(go,3000)})()`;

function deferAppScript(html) {
  const pattern = /<script type="module" crossorigin src="([^"]+)"><\/script>/;
  const src = html.match(pattern)?.[1];
  if (!src) throw new Error("deferAppScript: the app module script was not found in the template");
  return html.replace(pattern, () => `<script>${APP_SCRIPT_LOADER(src)}</script>`);
}

function validate({ pathname, seoVisibility, head, innerHtml, finalHtml }) {
  const errors = [];
  const h1Count = (innerHtml.match(/<h1\b/gi) || []).length;
  if (seoVisibility === "public" && h1Count !== 1) errors.push(`expected 1 H1, found ${h1Count}`);
  if (!head.title || head.title === "Zyvo – Go Viral With AI Content Creation") errors.push(`generic or missing title: ${head.title}`);
  if (!head.description) errors.push("missing description");
  if (head.canonical !== canonicalFor(pathname)) errors.push(`canonical mismatch: ${head.canonical}`);
  if (new URL(head.canonical).search || new URL(head.canonical).hash) errors.push(`canonical contains query/hash: ${head.canonical}`);
  if (new URL(head.canonical).hostname !== "www.tryzyvo.com") errors.push(`canonical has wrong host: ${head.canonical}`);
  if ((finalHtml.match(/application\/ld\+json/gi) || []).length > 1 && pathname === "/") errors.push("homepage has more than one JSON-LD block");
  const expectedRobots = seoVisibility === "noindex" ? "noindex, follow" : "index, follow";
  if (!head.robots.toLowerCase().includes(expectedRobots)) errors.push(`robots mismatch: ${head.robots}`);
  if (!/^<!DOCTYPE html>/i.test(finalHtml)) errors.push("the page does not start with <!DOCTYPE html>");
  if ((finalHtml.match(/<title>/gi) || []).length !== 1) errors.push("title tag count != 1 in final HTML");
  if ((finalHtml.match(/rel="canonical"/gi) || []).length !== 1) errors.push("canonical tag count != 1 in final HTML");
  return errors;
}

async function writeSnapshot(pathname, html) {
  if (pathname === "/") {
    // The homepage IS dist/index.html — there's no separate ".html" sibling
    // to also write, and no nested index.html folder to create. `template`
    // was already read into memory before this loop started, so overwriting
    // the file here is safe and doesn't affect any other route's rendering.
    await writeFile(indexTemplatePath, html);
    return;
  }
  const relative = pathname.replace(/^\/+/, "");
  const htmlFile = path.join(distDir, `${relative}.html`);
  const indexFile = path.join(distDir, relative, "index.html");
  mkdirSync(path.dirname(htmlFile), { recursive: true });
  mkdirSync(path.dirname(indexFile), { recursive: true });
  await Promise.all([writeFile(htmlFile, html), writeFile(indexFile, html)]);
}

async function main() {
  if (!existsSync(indexTemplatePath)) throw new Error("dist/index.html is missing; run this script after vite build");
  if (!existsSync(ssrEntryPath)) throw new Error("dist-ssr/entry-server.js is missing; run this script after the SSR build (see package.json build:ssr)");

  const { renderApp } = await import(`file://${ssrEntryPath}`);
  const template = readFileSync(indexTemplatePath, "utf8");

  const jobsByPath = new Map(sitemapPaths().map((pathname) => [pathname, { pathname, seoVisibility: "public" }]));
  getNoindexWorkspaceRoutes().forEach(({ path: pathname }) => jobsByPath.set(pathname, { pathname, seoVisibility: "noindex" }));
  const jobs = [...jobsByPath.values()];

  console.log(`[generateSeoHtml] rendering ${jobs.length} route(s)...`);
  const failures = [];
  let completed = 0;

  for (const { pathname, seoVisibility } of jobs) {
    completed += 1;
    try {
      const innerHtml = await renderApp(pathname, { inline: Boolean(getPublicSeoMetadata(pathname)?.inlineContent) });
      const head = buildHead({ pathname, seoVisibility, innerHtml });
      const withHead = injectHead(template, head);
      const finalHtml = withHead.replace('<div id="root"></div>', `<div id="root">${innerHtml}</div>`);

      const errors = validate({ pathname, seoVisibility, head, innerHtml, finalHtml });
      if (errors.length) throw new Error(errors.join("; "));

      await writeSnapshot(pathname, finalHtml);
      console.log(`  ${completed}/${jobs.length} ${pathname} (${seoVisibility})`);
    } catch (error) {
      failures.push(`${pathname}: ${error.message}`);
      console.error(`  ${completed}/${jobs.length} ${pathname} FAILED: ${error.message}`);
    }
  }

  if (failures.length) {
    throw new Error(`SEO HTML generation failed for ${failures.length} route(s):\n${failures.join("\n")}`);
  }

  console.log(`Generated ${completed} static SEO HTML route(s), 0 failures.`);
  await writeFile(SUCCESS_MARKER, new Date().toISOString());
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("[generateSeoHtml] FAILED — failing the build so this can't ship silently:");
  console.error(error);
  process.exit(1);
});
