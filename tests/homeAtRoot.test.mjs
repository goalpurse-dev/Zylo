import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicSeoMetadata, canonicalFor, SITE_URL } from "../src/data/publicSeoMetadata.js";
import { structuredDataFor, BRAND } from "../src/data/structuredData.js";
import { HOME_SEO, getWorkspaceRouteSeoPolicy, getNoindexWorkspaceRoutes, getPublicWorkspaceRoutes, publicLandingFor } from "../src/data/routeSeoPolicy.js";

// Home lives at the site root ("/"): public, prerendered, canonical
// https://www.tryzyvo.com/. /workspace/home is only a 301 to it.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const vercel = JSON.parse(read("vercel.json"));

test("server: /workspace/home 301s to /, and nothing redirects / away", () => {
  const old = vercel.redirects.filter((r) => r.source === "/workspace/home");
  assert.deepEqual(old, [{ source: "/workspace/home", destination: "/", statusCode: 301 }]);
  assert.ok(!vercel.redirects.some((r) => r.source === "/"), "the root must be served, not redirected");
  assert.deepEqual(vercel.redirects.filter((r) => r.source === "/home"), [{ source: "/home", destination: "/", statusCode: 301 }]);
});

test("app: Home is the root route inside the app layout; the old path redirects and keeps its query", () => {
  const app = read("src/App.jsx");
  assert.match(app, /<Route path="\/" element=\{USE_LEGACY_HOME \? <Workspace \/> : <HomeV2 \/>\} \/>/);
  assert.match(app, /<Route path="\/workspace\/home" element=\{<OldHomeRedirect \/>\} \/>/);
  assert.match(app, /<Navigate to=\{\{ pathname: "\/", search, hash \}\} replace \/>/);
  assert.equal((app.match(/<Route path="\/" /g) || []).length, 1, "one root route");
});

test("no internal link still points at /workspace/home", () => {
  const allowed = new Set(["src/App.jsx"]); // the redirect route
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(jsx?|tsx?)$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  const left = [...walk("src"), ...walk("api")].filter((f) => !allowed.has(f) && /["'`/]workspace\/home["'`?#]/.test(read(f)));
  assert.deepEqual(left, []);
  // The older /home address too: only its redirect route in App.jsx may name it.
  assert.deepEqual([...walk("src"), ...walk("api")].filter((f) => f !== "src/App.jsx" && read(f).includes('"/home"')), []);
  // The sidebar's Home highlight is an exact match: a prefix test on "/" would light it on every page.
  assert.match(read("src/components/workspace/toolshell.jsx"), /active=\{!anyPanelOpen && location\.pathname === "\/"\}/);
  assert.match(read("src/components/workspace/MobileBottomNav.jsx"), /location\.pathname === "\/"\}/);
});

test("SEO: title starts with Zyvo, canonical is the www root, indexable, in the sitemap; the old path is gone", () => {
  assert.equal(HOME_SEO.title, "Zyvo AI – AI Video Generator for YouTube, TikTok & Reels");
  assert.ok(HOME_SEO.title.length <= 60 && HOME_SEO.description.length <= 160);
  assert.equal(getPublicSeoMetadata("/").title, HOME_SEO.title);
  assert.equal(canonicalFor("/"), "https://www.tryzyvo.com/");
  assert.equal(getWorkspaceRouteSeoPolicy("/").seoVisibility, "public");
  assert.ok(getPublicWorkspaceRoutes().some((p) => p.path === "/"));
  assert.equal(getWorkspaceRouteSeoPolicy("/workspace/home"), null);
  assert.ok(!getNoindexWorkspaceRoutes().some((p) => p.path === "/workspace/home"));
  const sitemap = read("public/sitemap.xml");
  assert.match(sitemap, /<loc>https:\/\/www\.tryzyvo\.com\/<\/loc>/);
  assert.ok(!sitemap.includes("/workspace/home"));
  const robots = read("public/robots.txt");
  assert.match(robots, /^User-agent: \*\r?\nAllow: \/\r?$/m);
  assert.ok(!/^Disallow: \/\r?$/m.test(robots));
  // Home itself must not overwrite the tab title.
  assert.ok(!/document\.title\s*=/.test(read("src/pages/workspace/HomeV2.jsx")));
});

test("JSON-LD on /: Organization + WebSite named Zyvo, with logo, and no sameAs until the owner sends the links", () => {
  const ld = structuredDataFor("/", getPublicSeoMetadata("/"), canonicalFor("/"));
  const [org, site] = ld["@graph"];
  assert.deepEqual(ld["@graph"].map((n) => n["@type"]), ["Organization", "WebSite"]);
  assert.equal(org.name, "Zyvo");
  assert.deepEqual(org.alternateName, ["Zyvo AI", "ZyvoAI", "TryZyvo"]);
  assert.equal(org.url, `${SITE_URL}/`);
  assert.equal(org.logo.url, `${SITE_URL}/logo.png`);
  assert.ok(existsSync(join(root, "public/logo.png")));
  // The owner sends the official social links later (2026-10-11): no sameAs key at all until then.
  assert.deepEqual(BRAND.sameAs, []);
  assert.equal("sameAs" in org, false);
  assert.equal(site.name, "Zyvo");
  assert.deepEqual(site.alternateName, ["Zyvo AI", "ZyvoAI", "TryZyvo"]);
  assert.equal(site.url, `${SITE_URL}/`);
  assert.equal(site.publisher["@id"], org["@id"]);
});

test("Home's cards are real links crawlers can follow (path, What's new, niches, templates), same behaviour", () => {
  const home = read("src/components/home-v2/HomeV2Sections.jsx");
  assert.match(home, /const Tag = to \? Link : "button";/);
  assert.match(home, /testId="path-long"[\s\S]{0,120}to="\/long-form" onClick=\{\(\) => trackLaunch\("try_long_form", \{ placement: "home_hero" \}\)\}/);
  assert.match(home, /if \(to\) return <Link to=\{to\} draggable=\{false\} onClick=\{onClick\}/);
  assert.match(home, /testId="wn-long-form"[\s\S]{0,200}to="\/long-form"/);
  // Niche cards link to /long-form; the click opens the (noindex) setup with the niche picked.
  assert.match(home, /<Link key=\{n\.id\} to="\/long-form" draggable=\{false\} onClick=\{\(event\) => openNiche\(event, n\.id\)\}/);
  assert.match(home, /event\.preventDefault\(\);\s+navigate\(`\/long-form\/create\?niche=\$\{id\}`\);/);
  assert.doesNotMatch(home, /to=\{`\/long-form\/create/);
  assert.match(home, /<ToolLink to=\{t\.path\} onClick=\{track\}/);
  const suite = read("src/components/workspace/ZyvoSuiteCarousel.jsx");
  assert.ok(!/useNavigate|<button\s+onClick=\{onClick\}/.test(suite), "template cards are links, not buttons");
  assert.equal((suite.match(/<ToolLink\s+to=\{item\.path\}/g) || []).length, 2, "mobile card and carousel card");
  // A side card still turns the carousel instead of navigating.
  assert.match(suite, /if \(Math\.abs\(item\.offset\) < 0\.32\) return;[^\n]*\n\s+event\.preventDefault\(\);/);
});

test("Home's template links and the blog footer point at indexable pages, not the noindex tool pages", () => {
  const sitemap = read("public/sitemap.xml");
  const inSitemap = (path) => sitemap.includes(`<loc>${SITE_URL}${path}</loc>`);
  // ToolLink: href = the tool's public page, a plain click opens the tool, a cancelled click does nothing.
  const link = read("src/components/seo/ToolLink.jsx");
  assert.match(link, /const landing = publicLandingFor\(to\);/);
  assert.match(link, /if \(!landing \|\| event\.defaultPrevented\) return;/);
  assert.match(link, /event\.preventDefault\(\);\s+navigate\(to\);/);
  assert.match(link, /<Link to=\{landing \?\? to\} onClick=\{open\}/);
  for (const [tool, landing] of [
    ["/workspace/clay-rescue", "/clay-rescue-maker"], ["/workspace/two-am", "/2am-worlds-ai-generator"],
    ["/workspace/micro-camera-animal", "/micro-camera-animal-maker"], ["/workspace/cartoon-drive-by", "/cartoon-drive-by-video-maker"],
    ["/workspace/behind-the-scenes", "/behind-the-scenes-video-maker"], ["/workspace/ai-fruit-story", "/ai-fruit-story-maker"],
    ["/workspace/face-asmr", "/face-asmr-maker"], ["/workspace/kit-swap", "/kit-swap-ai"], ["/workspace/thirty-days", "/30-days-video-maker"],
  ]) assert.equal(publicLandingFor(tool), landing);
  // Every public page a tool points at is a real, indexable page.
  for (const { path, publicLanding } of getNoindexWorkspaceRoutes()) {
    if (publicLanding) assert.ok(inSitemap(publicLanding), `${path} -> ${publicLanding} is in the sitemap`);
  }
  assert.equal(publicLandingFor("/workspace/video-generator"), null, "no public page yet: the card keeps its tool link");
  // The blog footer (two layouts): no /workspace/ link, and every link it has is in the sitemap or a help page.
  const footer = read("src/components/workspace/footer.jsx");
  assert.doesNotMatch(footer, /to="\/workspace\//);
  assert.equal((footer.match(/to="\/image-generator"/g) || []).length, 2);
  for (const [, to] of footer.matchAll(/<Link to="([^"]+)"/g)) {
    assert.ok(inSitemap(to) || /^\/(support|help)(\/|$)/.test(to), `footer link ${to}`);
  }
});

test("brand search: ZyvoAI is in Home's own text once, and blog brand links go to the homepage", () => {
  const home = read("src/pages/workspace/HomeV2.jsx");
  assert.equal((home.match(/ZyvoAI/g) || []).length, 1);
  assert.ok(home.includes("Zyvo (ZyvoAI)"));
  // An anchor whose whole text is the brand never points at a tool page.
  const anchor = /<(Link|a)\b[^>]*?\b(?:to|href)=\{?["'`]([^"'`]*)["'`]\}?[^>]*>([\s\S]*?)<\/\1>/g;
  const brand = /^(try\s?zyvo|zyvo\s?ai|zyvo)$/i;
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.jsx$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  const wrong = [];
  let found = 0;
  for (const f of walk("src/app/blog")) {
    for (const m of read(f).matchAll(anchor)) {
      const text = m[3].replace(/<[^>]+>/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
      if (!brand.test(text)) continue;
      found += 1;
      if (m[2] !== "/" && m[2] !== "https://www.tryzyvo.com/") wrong.push(`${f}: "${text}" -> ${m[2]}`);
    }
  }
  assert.ok(found >= 15, `brand links found: ${found}`);
  assert.deepEqual(wrong, []);
});

test("the Home snapshot is also the fallback HTML for app routes: its content and head never show there", () => {
  assert.equal(getPublicSeoMetadata("/").shellGuard, true);
  const gen = read("scripts/generateSeoHtml.js");
  assert.match(gen, /if \(head\.shellGuard\) tags\.push\(`<script>\$\{SHELL_GUARD\}<\/script>`\);/);
  assert.match(gen, /#root\{visibility:hidden\}/);
  assert.match(gen, /link\[rel=canonical\]","script#page-ld"/);
  const entry = read("src/main.jsx");
  assert.match(entry, /dataset\.shell === "true"\) \{\s+container\.replaceChildren\(\);\s+document\.getElementById\("shell-hide"\)\?\.remove\(\);/);
  // The live site no longer serves Home's HTML for other URLs: app routes get dist/app-shell.html and unknown
  // addresses a 404 (vercel.json). The guard stays for a local `vite preview`, which still falls back to index.html.
  assert.equal(vercel.rewrites.some((r) => r.source === "/(.*)"), false);
  assert.ok(vercel.rewrites.some((r) => r.source === "/workspace/(.*)" && r.destination === "/app-shell"));
});
