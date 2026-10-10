// Checks a deployed site: every redirect in vercel.json answers with its status
// code and target, unknown addresses are 404, app routes get the noindex shell,
// and the key pages carry the right tags. Reads only (GET), free.
//   node scripts/seo/checkDeployed.mjs <origin>          e.g. https://www.tryzyvo.com or a preview URL
import { readFileSync } from "node:fs";

const ORIGIN = process.argv[2].replace(/\/$/, "");
const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
// A preview is behind Vercel's login. With the project's "Protection Bypass for Automation" secret in
// VERCEL_BYPASS (Vercel > Project > Settings > Deployment Protection) the check can read it.
const HEADERS = { "user-agent": "zyvo-preview-check", ...(process.env.VERCEL_BYPASS ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS } : {}) };
const get = (pathname) => fetch(ORIGIN + pathname, { redirect: "manual", headers: HEADERS });
const tag = (html, re) => html.match(re)?.[0] ?? null;
const head = (html) => ({ title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null, robots: html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? null, canonical: html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null });
let failed = 0;
const fail = (message) => { failed += 1; console.log("  FAIL " + message); };

const first = await get("/");
if (first.status === 401 || (first.headers.get("location") ?? "").includes("vercel.com/sso-api")) { console.log(`This deployment is behind Vercel's login. Set VERCEL_BYPASS (see the top of this file) and run again.`); process.exit(2); }

console.log(`1. Redirects (${config.redirects.length})`);
let ok = 0;
for (const rule of config.redirects) {
  const expected = rule.statusCode ?? (rule.permanent ? 308 : 307);
  const response = await get(rule.source);
  const location = response.headers.get("location") ?? "";
  const target = location.startsWith("http") ? new URL(location).pathname : location;
  if (response.status !== expected || target !== rule.destination) fail(`${rule.source}: got ${response.status} -> ${target || "(none)"}, expected ${expected} -> ${rule.destination}`);
  else ok += 1;
}
console.log(`  ${ok} of ${config.redirects.length} answer with the right status and target`);
const added = ["/blog/micro-camera-animal-maker", "/blog/face-asmr-maker", "/blog/clay-rescue-ai-video-maker", "/workspace/publish", "/publish", "/stats", "/connections",
  "/blog/ai-image-generator-dark-moody-cinematic", "/blog/clean-product-backgrounds", "/blog/ai-product-photography-ecommerce", "/workspace"];
for (const source of added) { const response = await get(source); console.log(`  ${source} -> ${response.status} ${response.headers.get("location")}`); }
const query = await get("/workspace?source=welcome");
console.log(`  /workspace?source=welcome -> ${query.status} ${query.headers.get("location")}`);

console.log("2. Unknown addresses are 404");
for (const pathname of ["/$", "/&", "/sitemax.xml", "/blog/not-a-real-post", "/contact", "/worspace/home", "/some/unknown/page"]) {
  const response = await get(pathname);
  const info = head(await response.text());
  if (response.status !== 404) fail(`${pathname}: status ${response.status}`);
  if (info.canonical) fail(`${pathname}: carries a canonical`);
  console.log(`  ${pathname} -> ${response.status} | ${info.title} | ${info.robots}`);
}

console.log("3. App routes without their own page get the shell (200, noindex, no canonical)");
for (const pathname of ["/long-form/project/abc123/scenes", "/long-form/teaser/abc123", "/auth/callback", "/auth/confirm", "/auth/reset", "/billing/success", "/billing/cancel", "/login", "/signup", "/settings",
  "/unsubscribe", "/workspace/earn", "/admin/ops", "/help", "/help/feedback", "/support/policies/cookies", "/public-gallery", "/workspace/not-a-tool"]) {
  const response = await get(pathname);
  const html = await response.text();
  const info = head(html);
  const good = response.status === 200 && info.title === "Zyvo" && info.robots === "noindex, follow" && !info.canonical && html.includes('<div id="root"></div>') && /<script type="module"[^>]*src="\/assets\//.test(html);
  if (!good) fail(`${pathname}: ${response.status} | ${info.title} | ${info.robots} | canonical ${info.canonical}`);
}
console.log("  checked 18 paths");

console.log("4. Pages with their own HTML");
const expect = [
  ["/", "index", "/"], ["/long-form", "index", "/long-form"], ["/long-form/create", "noindex", "/long-form/create"], ["/long-form/create?niche=history", "noindex", "/long-form/create"],
  ["/pricing", "index", "/pricing"], ["/blog", "index", "/blog"], ["/clay-rescue-maker", "index", "/clay-rescue-maker"], ["/image-generator", "index", "/image-generator"],
  ["/support", "index", "/support"], ["/support/contact", "index", "/support/contact"], ["/support/policies/privacy", "index", "/support/policies/privacy"], ["/support/policies/tos", "index", "/support/policies/tos"],
  ["/blog/what-is-zyvo-publish", "noindex", "/blog/what-is-zyvo-publish"], ["/blog/social-media-scheduler-for-creators", "index", "/blog/social-media-scheduler-for-creators"],
  ["/workspace/creations", "noindex", "/workspace/creations"], ["/ai-stickman-video-generator", "index", "/ai-stickman-video-generator"],
];
for (const [pathname, robots, canonicalPath] of expect) {
  const response = await get(pathname);
  const html = await response.text();
  const info = head(html);
  const good = response.status === 200 && (info.robots ?? "").startsWith(robots) && info.canonical === `https://www.tryzyvo.com${canonicalPath}` && !html.includes('"/$"');
  if (!good) fail(`${pathname}: ${response.status} | ${info.robots} | ${info.canonical}`);
  console.log(`  ${pathname} -> ${response.status} | ${info.robots} | ${info.title}`);
}

console.log("5. Files");
for (const [pathname, type] of [["/robots.txt", "text/plain"], ["/sitemap.xml", "xml"], ["/favicon.ico", "image"], ["/og-image.png", "image/png"]]) {
  const response = await get(pathname);
  const body = pathname.endsWith(".png") || pathname.endsWith(".ico") ? "" : await response.text();
  if (response.status !== 200 || !(response.headers.get("content-type") ?? "").includes(type)) fail(`${pathname}: ${response.status} ${response.headers.get("content-type")}`);
  if (pathname === "/robots.txt") console.log(`  robots.txt has the prompt rule: ${body.includes("Disallow: /*?prompt=")}`);
  if (pathname === "/sitemap.xml") console.log(`  sitemap.xml: ${(body.match(/<loc>/g) || []).length} URLs`);
}
const api = await fetch(ORIGIN + "/api/stripe-webhook", { method: "GET", redirect: "manual", headers: HEADERS });
console.log(`  /api/stripe-webhook (GET) -> ${api.status} (anything but 404 means the function is still routed)`);
if (api.status === 404) fail("/api/stripe-webhook is 404");

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
