import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
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
// Deliberately generous: batching now launches a fresh Chromium every
// BATCH_SIZE routes (11 launches for 163 routes at the default batch size),
// each of which costs real time on top of rendering itself. Reliability, not
// speed, is the goal here, so this is sized to comfortably fit a slow,
// conservative run rather than a fast one.
const OVERALL_TIMEOUT_MS = Number(process.env.PRERENDER_TIMEOUT_MS) || 10 * 60 * 1000;
// One browser renders at most this many routes before being fully closed and
// relaunched fresh. Small and sequential on purpose — a single browser
// rendering all 163 routes back-to-back accumulated enough memory/resource
// pressure to crash Chromium partway through the run on Vercel. If this
// value is still unstable there, lower it further via env var with no code
// change needed.
const BATCH_SIZE = Number(process.env.PRERENDER_BATCH_SIZE) || 15;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function logMemory(label) {
  const mem = process.memoryUsage();
  const freeMB = Math.round(os.freemem() / 1024 / 1024);
  const totalMB = Math.round(os.totalmem() / 1024 / 1024);
  console.log(
    `[prerender] memory @ ${label}: node rss=${Math.round(mem.rss / 1024 / 1024)}MB ` +
    `heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB ` +
    `system free=${freeMB}MB/${totalMB}MB`
  );
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

// A request is treated as a *static asset* (Vite's /assets/* chunks, favicon,
// images, fonts, ...) rather than a client-side *page route* if its last path
// segment has a file extension. Assets must never fall through to the SPA
// shell — a missing chunk silently served as index.html is exactly what
// produced "Uncaught SyntaxError: Unexpected token '<'" in Chromium (it
// requested JS, got an HTML document instead) and cascaded into every queued
// route failing once the page's own script tag threw. Page routes (no
// extension, e.g. /blog/foo) still fall back to the SPA shell/snapshot as
// before — that fallback is legitimate for routes, never for assets.
function isAssetPath(relative) {
  if (relative.startsWith("assets/")) return true;
  const lastSegment = relative.split("/").pop() || "";
  return /\.[a-zA-Z0-9]+$/.test(lastSegment);
}

function resolveRequestFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const asset = isAssetPath(relative);

  if (asset) {
    const file = path.join(distDir, relative);
    const found = existsSync(file) && statSync(file).isFile();
    return { file: found ? file : null, asset: true, usedFallback: false };
  }

  const candidates = [
    path.join(distDir, `${relative}.html`),
    path.join(distDir, relative, "index.html"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  return { file: found || SPA_FALLBACK, asset: false, usedFallback: !found };
}

function startStaticServer({ verbose = false } = {}) {
  const server = createServer(async (request, response) => {
    const requestPath = request.url || "/";
    const { file, asset, usedFallback } = resolveRequestFile(requestPath);

    if (!file) {
      // Asset genuinely missing on disk — 404, never the SPA shell. This is
      // the exact case that used to silently return HTML for a JS request.
      if (verbose) console.log(`[static] 404 ${requestPath} (asset not found under dist/)`);
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Not found: ${requestPath}`);
      return;
    }

    try {
      const body = await readFile(file);
      const contentType = MIME[path.extname(file)] || "application/octet-stream";
      if (verbose) {
        console.log(
          `[static] 200 ${requestPath} -> ${path.relative(distDir, file)} ` +
          `(${contentType}${asset ? "" : usedFallback ? ", SPA fallback" : ", snapshot"})`
        );
      }
      response.writeHead(200, { "content-type": contentType });
      response.end(body);
    } catch (error) {
      if (verbose) console.log(`[static] 500 ${requestPath}: ${error.message}`);
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

// Resource types/URL patterns that are never needed to produce the rendered
// SEO HTML (title/canonical/H1/body text) but can meaningfully add to memory
// and open-connection pressure across a long prerender run: video/audio
// elements, WebSocket connections (this is what neutralizes Supabase
// realtime without touching any app code), and Vercel's own analytics/speed
// insights beacons (same-origin, so they'd otherwise sail through the
// existing cross-origin block below).
const BLOCKED_RESOURCE_TYPES = new Set(["media", "websocket"]);
const BLOCKED_URL_PATTERNS = [/^\/_vercel\/(insights|speed-insights)\//, /\.(mp4|webm|mov|m4v)(\?|$)/i];

async function renderPath(browser, origin, pathname, seoVisibility, { verbose = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    serviceWorkers: "block",
  });
  await context.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: origin }]);
  const page = await context.newPage();

  // Lets application code opt into skipping prerender-irrelevant work
  // (analytics init, auth/session polling, expensive animations, ...) by
  // checking `window.__ZYVO_PRERENDER__` — set before any app JS runs.
  // Nothing currently reads it; it's here so that opt-in can be added
  // page-by-page later without touching this script again.
  await page.addInitScript(() => { window.__ZYVO_PRERENDER__ = true; });

  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!(url.origin === origin || ["data:", "blob:"].includes(url.protocol))) return route.abort();
    if (BLOCKED_RESOURCE_TYPES.has(request.resourceType())) return route.abort();
    if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url.pathname))) return route.abort();
    route.continue();
  });

  // page 'crash' is Playwright's dedicated signal for "this specific page's
  // renderer process died" (e.g. OOM), distinct from the whole browser
  // disconnecting — attached unconditionally since it's the clearest
  // available signal for isolating a single bad route (see item 7/8: was it
  // one route, or the whole browser).
  page.on("crash", () => console.error(`[prerenderSeo] page CRASHED while rendering ${pathname}`));

  if (verbose) {
    // pageerror is the critical signal for the earlier asset-routing class of
    // bug: a JS asset served as HTML surfaces here as "Uncaught SyntaxError:
    // Unexpected token '<'" the moment the browser tries to parse/execute it.
    page.on("pageerror", (err) => console.log(`[page:${pathname}] pageerror: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`[page:${pathname}] requestfailed: ${req.url()} — ${req.failure()?.errorText}`));
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") console.log(`[page:${pathname}] console.${msg.type()}: ${msg.text()}`);
    });
    page.on("response", (res) => {
      // Filtered for signal: log non-ok responses, plus any JS/CSS asset
      // response whose content-type doesn't match — exactly what a
      // wrongly-fallback-served asset looks like from the network tab.
      const url = res.url();
      const contentType = res.headers()["content-type"] || "";
      const looksLikeScriptOrStyle = /\.(js|css)(\?|$)/.test(url);
      const contentTypeMismatch = looksLikeScriptOrStyle && !/(javascript|css)/.test(contentType);
      if (!res.ok() || contentTypeMismatch) {
        console.log(`[page:${pathname}] response: ${res.status()} ${url} (content-type: ${contentType || "none"})`);
      }
    });
  }

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
    // Explicit page.close() before context.close() per item 3 — context.close()
    // alone closes its pages too, but this makes teardown of both listeners
    // and the page's own resources unambiguous rather than implicit, and
    // neither call is allowed to mask whatever error/return value came out of
    // the try block above.
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

// Vercel's build image is Amazon Linux, which has neither `apt-get` (so
// `playwright install --with-deps` can't run there — it detects the
// unsupported OS, falls back to Ubuntu's apt-get anyway, and hard-fails with
// exit 127) nor the shared libraries (libnspr4.so, libnss3.so, ...) that a
// plain `playwright install chromium` download needs to actually launch.
// @sparticuz/chromium ships a Chromium build compiled specifically for
// Lambda-like environments with every required .so bundled alongside the
// binary, so it never touches the OS package manager at all. It's Linux-only
// (won't run on Windows/macOS), so this path is only taken when VERCEL is
// set — local/dev builds keep using the plain `playwright install chromium`
// download exactly as before.
async function resolveLaunchOptions() {
  const baseArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
  if (process.env.VERCEL) {
    const { default: sparticuzChromium } = await import("@sparticuz/chromium");
    return {
      headless: true,
      executablePath: await sparticuzChromium.executablePath(),
      args: [...sparticuzChromium.args, ...baseArgs],
    };
  }
  return { headless: true, args: baseArgs };
}

// Renders one batch of routes with a single, freshly-launched browser and
// exactly one page/context alive at a time (no worker pool — item 2:
// reliability over the ~20 seconds parallelism used to save). The browser is
// fully closed at the end of the batch regardless of outcome, so a long
// prerender run never keeps one Chromium process alive across all 163
// routes — that accumulation is what crashed it on Vercel.
async function renderBatch(batchJobs, origin, verbose, progress) {
  const launchOptions = await resolveLaunchOptions();
  // --no-sandbox etc. are required for Chromium to launch inside CI/build
  // containers (Vercel's build image included) — without them the launch
  // can hang indefinitely instead of failing fast, which is what burned a
  // full 45-minute Vercel build budget and blocked the whole deploy. The
  // timeout wrapper is the backstop in case launch hangs for some other
  // reason in a given environment.
  const browser = await withTimeout(chromium.launch(launchOptions), 60_000, "chromium.launch()");

  // Playwright fires 'disconnected' on ANY browser shutdown, including our
  // own deliberate browser.close() at the end of a successful batch —
  // `shuttingDown` distinguishes "we closed it on purpose" from "it died on
  // us mid-batch", so a normal run doesn't print a false crash alarm.
  let shuttingDown = false;
  let browserDisconnected = null;
  let currentPathname = null;
  browser.on("disconnected", () => {
    if (shuttingDown) return;
    browserDisconnected = new Error(
      `Chromium disconnected/crashed while rendering ${currentPathname ?? "(between routes)"} ` +
      `— ${progress.completed}/${progress.total} route(s) completed before this`
    );
    console.error(`[prerenderSeo] ${browserDisconnected.message}`);
  });

  const failures = [];
  try {
    for (const { pathname, seoVisibility } of batchJobs) {
      if (browserDisconnected) break;
      currentPathname = pathname;
      progress.completed += 1;
      console.log(`[prerender] ${progress.completed}/${progress.total} ${pathname}`);
      try {
        await renderPath(browser, origin, pathname, seoVisibility, { verbose });
      } catch (error) {
        if (browserDisconnected) break; // fallout from the disconnect, not a real per-route bug
        failures.push(`${pathname}: ${error.message}`);
      }
      if (progress.completed % 10 === 0) logMemory(`${progress.completed}/${progress.total}`);
    }
  } finally {
    shuttingDown = true;
    await browser.close().catch(() => {});
  }

  if (browserDisconnected) throw browserDisconnected;
  return failures;
}

async function main() {
  if (!existsSync(SPA_FALLBACK)) throw new Error("dist/index.html is missing; run this script after vite build");
  // Verbose static-server + page-event logging is automatic on Vercel (where
  // we don't get a local terminal to attach a debugger to) and opt-in
  // elsewhere via PRERENDER_VERBOSE=1, so local runs stay quiet by default.
  const verbose = Boolean(process.env.VERCEL) || process.env.PRERENDER_VERBOSE === "1";
  const jobsByPath = new Map(sitemapPaths().map((pathname) => [pathname, { pathname, seoVisibility: "public" }]));
  getNoindexWorkspaceRoutes().forEach(({ path: pathname }) => jobsByPath.set(pathname, { pathname, seoVisibility: "noindex" }));
  const jobs = [...jobsByPath.values()];
  const server = await startStaticServer({ verbose });
  const address = server.address();
  const origin = `http://${HOST}:${address.port}`;

  try {
    const batches = chunk(jobs, BATCH_SIZE);
    const progress = { completed: 0, total: jobs.length };
    const failures = [];

    console.log(`[prerender] ${jobs.length} route(s) in ${batches.length} batch(es) of up to ${BATCH_SIZE}, one page at a time`);
    logMemory("start");

    for (const [batchIndex, batchJobs] of batches.entries()) {
      console.log(`[prerender] batch ${batchIndex + 1}/${batches.length} — launching Chromium (${batchJobs.length} route(s))`);
      // A browser crash stops the whole run rather than silently moving on to
      // the next batch and hoping it doesn't happen again (item 9: stay
      // fail-fast) — renderBatch throws its attributed disconnect error
      // straight through here instead of swallowing it.
      const batchFailures = await renderBatch(batchJobs, origin, verbose, progress);
      failures.push(...batchFailures);
      console.log(`[prerender] batch ${batchIndex + 1}/${batches.length} complete — Chromium closed`);
    }

    if (failures.length) throw new Error(`Prerender failed for ${failures.length} route(s):\n${failures.join("\n")}`);
    console.log(`Prerendered ${progress.completed} crawler-visible public/noindex route(s).`);
    logMemory("end");
    await writeFile(SUCCESS_MARKER, new Date().toISOString());
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// Previously this caught failures and always exited 0, so a broken/missing
// Chromium in the build environment (e.g. Playwright's browser binary not
// installed) silently shipped production with zero prerendered SEO HTML —
// every route fell through Vercel's SPA catch-all rewrite to the bare
// index.html shell. That regression went undetected for a real deploy
// window because "the build succeeded" looked fine in CI. Failing loudly
// here is intentional: Vercel keeps serving the last good deployment when a
// build fails, which is strictly safer than silently publishing a shell-only
// site. The bounded timeout below still guarantees this exits promptly
// instead of hanging the build budget, so failing loudly does not reintroduce
// the original 45-minute-hang problem this used to guard against.
withTimeout(main(), OVERALL_TIMEOUT_MS, "SEO prerender").then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("[prerenderSeo] SEO prerender failed or timed out — failing the build so this can't ship silently:");
  console.error(error);
  // main() can throw before reaching its own try/finally (e.g. chromium.launch()
  // failing right after startStaticServer() opens its listening socket) —
  // whenever that happens the open server keeps Node's event loop alive, so
  // exiting explicitly guarantees this script terminates instead of relying
  // on every failure path to clean up perfectly.
  process.exit(1);
});
