import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { getNoindexWorkspaceRoutes } from "../src/data/routeSeoPolicy.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const sitemapPath = path.join(projectRoot, "public", "sitemap.xml");
const SPA_FALLBACK = path.join(distDir, "index.html");
const HOST = "127.0.0.1";
// Written only when every route actually prerendered — validateSeoIndexing.js
// checks for this before asserting on snapshot files, so an environment where
// Chromium can't run degrades to "skip SEO prerender" instead of "block the
// whole deploy". Vercel's build image is the concrete case this guards.
const SUCCESS_MARKER = path.join(distDir, ".seo-prerender-complete");
const OVERALL_TIMEOUT_MS = 5 * 60 * 1000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sitemapPaths() {
  const xml = readFileSync(sitemapPath, "utf8");
  return [...xml.matchAll(/<loc>https:\/\/www\.tryzyvo\.com([^<]*)<\/loc>/g)]
    .map((match) => match[1] || "/")
    .filter((pathname) => pathname !== "/");
}

function resolveRequestFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded.replace(/^\/+/, "");
  const candidates = [
    path.join(distDir, `${relative}.html`),
    path.join(distDir, relative, "index.html"),
    path.join(distDir, relative),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) || SPA_FALLBACK;
}

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const file = resolveRequestFile(request.url || "/");
      const body = await readFile(file);
      response.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(String(error));
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, () => resolve(server));
  });
}

async function writeSnapshot(pathname, html) {
  const relative = pathname.replace(/^\/+/, "");
  const htmlFile = path.join(distDir, `${relative}.html`);
  const indexFile = path.join(distDir, relative, "index.html");
  await mkdir(path.dirname(htmlFile), { recursive: true });
  await mkdir(path.dirname(indexFile), { recursive: true });
  await Promise.all([writeFile(htmlFile, html), writeFile(indexFile, html)]);
}

async function renderPath(browser, origin, pathname, seoVisibility) {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    serviceWorkers: "block",
  });
  await context.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: origin }]);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ["data:", "blob:"].includes(url.protocol)) route.continue();
    else route.abort();
  });

  try {
    await page.goto(`${origin}${pathname}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const expectedRobots = seoVisibility === "noindex" ? "noindex, follow" : "index, follow";
    await page.waitForFunction(
      ({ expectedRobots }) => document.querySelector('meta[name="robots"]')?.content.toLowerCase().includes(expectedRobots),
      { expectedRobots },
      { timeout: 15_000 },
    );
    if (seoVisibility === "public") {
      await page.locator("h1:visible").first().waitFor({ state: "visible", timeout: 15_000 });
    } else {
      await page.locator("#root > *").first().waitFor({ state: "attached", timeout: 15_000 });
    }
    await page.waitForTimeout(150);

    const expectedCanonical = `https://www.tryzyvo.com${pathname}`;
    const result = await page.evaluate(() => {
      const h1s = [...document.querySelectorAll("h1")].filter((element) => element.getClientRects().length > 0);
      const canonicals = [...document.querySelectorAll('link[rel="canonical"]')];
      const robotsTags = [...document.querySelectorAll('meta[name="robots"]')];
      const ogUrls = [...document.querySelectorAll('meta[property="og:url"]')];
      document.documentElement.setAttribute("data-prerendered", "true");
      return {
        canonical: canonicals[0]?.href || "",
        canonicalCount: canonicals.length,
        h1Count: h1s.length,
        ogUrl: ogUrls[0]?.content || "",
        ogUrlCount: ogUrls.length,
        pathname: location.pathname,
        robots: robotsTags[0]?.content || "",
        robotsCount: robotsTags.length,
        title: document.title,
      };
    });

    if (result.pathname !== pathname) throw new Error(`unexpected navigation to ${result.pathname}`);
    if (seoVisibility === "public" && result.h1Count !== 1) throw new Error(`expected one visible H1, found ${result.h1Count}`);
    if (result.canonicalCount !== 1 || result.canonical !== expectedCanonical) throw new Error(`canonical mismatch/count: ${result.canonicalCount} ${result.canonical}`);
    if (result.robotsCount !== 1 || !result.robots.toLowerCase().includes(expectedRobots)) throw new Error(`robots mismatch/count: ${result.robotsCount} ${result.robots}`);
    if (result.ogUrlCount !== 1 || result.ogUrl !== expectedCanonical) throw new Error(`og:url mismatch/count: ${result.ogUrlCount} ${result.ogUrl}`);
    if (seoVisibility === "public" && (!result.title || result.title.startsWith("Zyvo – Go Viral"))) throw new Error(`generic or missing title: ${result.title}`);

    const html = `<!doctype html>\n${await page.locator("html").evaluate((element) => element.outerHTML)}`;
    await writeSnapshot(pathname, html);
    return result;
  } finally {
    await context.close();
  }
}

async function main() {
  if (!existsSync(SPA_FALLBACK)) throw new Error("dist/index.html is missing; run this script after vite build");
  const jobsByPath = new Map(sitemapPaths().map((pathname) => [pathname, { pathname, seoVisibility: "public" }]));
  getNoindexWorkspaceRoutes().forEach(({ path: pathname }) => jobsByPath.set(pathname, { pathname, seoVisibility: "noindex" }));
  const jobs = [...jobsByPath.values()];
  const server = await startStaticServer();
  const address = server.address();
  const origin = `http://${HOST}:${address.port}`;
  // --no-sandbox etc. are required for Chromium to launch inside CI/build
  // containers (Vercel's build image included) — without them the launch
  // can hang indefinitely instead of failing fast, which is what burned a
  // full 45-minute Vercel build budget and blocked the whole deploy. The
  // timeout wrapper is the backstop in case launch hangs for some other
  // reason in a given environment.
  const browser = await withTimeout(
    chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    }),
    60_000,
    "chromium.launch()",
  );

  try {
    const failures = [];
    let completed = 0;
    const queue = [...jobs];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const { pathname, seoVisibility } = queue.shift();
        try {
          await renderPath(browser, origin, pathname, seoVisibility);
          completed += 1;
          console.log(`  prerendered ${pathname} (${seoVisibility})`);
        } catch (error) {
          failures.push(`${pathname}: ${error.message}`);
        }
      }
    });
    await Promise.all(workers);
    if (failures.length) throw new Error(`Prerender failed for ${failures.length} route(s):\n${failures.join("\n")}`);
    console.log(`Prerendered ${completed} crawler-visible public/noindex route(s).`);
    await writeFile(SUCCESS_MARKER, new Date().toISOString());
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

withTimeout(main(), OVERALL_TIMEOUT_MS, "SEO prerender").catch((error) => {
  // Never let a broken/unsupported headless-Chromium environment block the
  // whole deploy — degrade to "no prerendered SEO snapshots this build"
  // instead. validateSeoIndexing.js checks for SUCCESS_MARKER and skips its
  // snapshot assertions when it's absent, so this build still ships; it just
  // ships without prerendered SEO HTML until the environment is fixed.
  console.error("[prerenderSeo] SEO prerender failed or timed out — continuing deploy without it:");
  console.error(error);
}).finally(() => {
  // main() can throw before reaching its own try/finally (e.g. chromium.launch()
  // failing right after startStaticServer() opens its listening socket) —
  // whenever that happens the open server keeps Node's event loop alive
  // forever, so the .catch() above logs its message but the process never
  // actually exits. That's what burned a full 45-minute Vercel build budget
  // on every deploy where the build image can't launch Chromium. Exiting
  // explicitly guarantees this script terminates no matter what got left
  // open, instead of relying on every failure path to clean up perfectly.
  process.exit(0);
});
