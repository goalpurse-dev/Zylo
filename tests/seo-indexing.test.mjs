import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import {
  getNoindexWorkspaceRoutes,
  getPublicWorkspaceRoutes,
  getWorkspaceRouteSeoPolicy,
  publicRobotsFor,
} from "../src/data/routeSeoPolicy.js";
import { getPublicSeoMetadata } from "../src/data/publicSeoMetadata.js";
import { blogArticles } from "../src/data/blogArticles.js";
import { HIDDEN_BLOG_POSTS, PUBLISH_SUITE_PAGES, PUBLISH_SUITE_RELEASED } from "../src/data/unreleasedFeatures.js";

const read = (pathname) => readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");

test("paid and private workspace routes use one central noindex policy", () => {
  const policies = getNoindexWorkspaceRoutes();
  assert.ok(policies.length > 0);
  assert.equal(getWorkspaceRouteSeoPolicy("/workspace/ai-fruit-story")?.seoVisibility, "noindex");
  assert.equal(getWorkspaceRouteSeoPolicy("/workspace/ai-fruit-story")?.publicLanding, "/ai-fruit-story-maker");
  assert.equal(getPublicWorkspaceRoutes().some(({ path }) => path === "/pricing"), true);
  assert.match(read("src/components/seo/WorkspaceRouteSeo.jsx"), /noindex, follow/);
  assert.match(read("src/pages/workspace/layout.jsx"), /<WorkspaceRouteSeo \/>/);
});

test("sitemap excludes noindex, redirects, duplicates, and query URLs", () => {
  const sitemap = read("public/sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.some((url) => url.includes("?")), false);
  for (const { path } of getNoindexWorkspaceRoutes()) {
    assert.equal(urls.includes(`https://www.tryzyvo.com${path}`), false, `${path} must not be in the sitemap`);
  }
  const redirects = JSON.parse(read("vercel.json")).redirects;
  for (const { source } of redirects) {
    assert.equal(urls.includes(`https://www.tryzyvo.com${source}`), false, `${source} redirect must not be in the sitemap`);
  }
});

test("the Long Form setup (/long-form/create?niche=…) is noindex with its own snapshot, never Home's HTML", () => {
  const policy = getWorkspaceRouteSeoPolicy("/long-form/create");
  assert.equal(policy?.seoVisibility, "noindex");
  assert.notEqual(policy.title, getWorkspaceRouteSeoPolicy("/").title);
  // Every noindex policy route gets a prerendered snapshot with robots "noindex, follow".
  assert.match(read("scripts/generateSeoHtml.js"), /getNoindexWorkspaceRoutes\(\)\.forEach\(\(\{ path: pathname \}\) => jobsByPath\.set\(pathname, \{ pathname, seoVisibility: "noindex" \}\)\)/);
  assert.equal(read("public/sitemap.xml").includes("/long-form/create"), false);
});

test("AI Fruit has one public canonical target and a noindex paid application", () => {
  const app = read("src/App.jsx");
  const sitemap = read("public/sitemap.xml");
  assert.match(app, /path="\/ai-fruit-story-maker" element=\{<AIFruitStoryLanding/);
  assert.match(app, /path="\/blog\/ai-fruit-story-maker" element=\{<Navigate to="\/ai-fruit-story-maker" replace/);
  assert.equal((sitemap.match(/https:\/\/www\.tryzyvo\.com\/ai-fruit-story-maker/g) || []).length, 1);
  assert.equal(sitemap.includes("/blog/ai-fruit-story-maker"), false);
  assert.equal(sitemap.includes("/workspace/ai-fruit-story"), false);
});

test("robots.txt: ?prompt= URLs are not crawled, and nothing that needs crawling is blocked", () => {
  const rules = [...read("public/robots.txt").matchAll(/^Disallow:\s*(\S+)/gim)].map((match) => match[1]);
  assert.deepEqual(rules, ["/settings", "/auth/", "/*?prompt="]);
  // Google's matching: * is any run of characters, the rule is a prefix of path + query.
  const blocked = (url) => rules.some((rule) => new RegExp(`^${rule.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}`).test(url));
  assert.ok(blocked("/workspace/image-generator?prompt=a%20red%20car"));
  assert.ok(blocked("/2am-worlds-ai-generator?prompt=tokyo&style=neon"));
  // A noindex page must stay crawlable, or Google never sees its noindex tag.
  for (const { path } of getNoindexWorkspaceRoutes()) assert.equal(blocked(path), false, `${path} is crawlable`);
  assert.equal(blocked("/long-form/create?niche=history"), false);
  for (const url of [...read("public/sitemap.xml").matchAll(/<loc>https:\/\/www\.tryzyvo\.com([^<]*)<\/loc>/g)].map((match) => match[1] || "/")) {
    assert.equal(blocked(url), false, `${url} is crawlable`);
  }
});

test("blog posts only link to blog posts that exist; three addresses that never existed 301 to the real post", () => {
  const app = read("src/App.jsx");
  const redirects = JSON.parse(read("vercel.json")).redirects;
  const sitemap = read("public/sitemap.xml");
  const isPage = (slug) => app.includes(`path="${slug}"`) || redirects.some((r) => r.source === slug);
  for (const [dead, real] of [
    ["/blog/ai-image-generator-dark-moody-cinematic", "/blog/ai-image-generator-for-dark-visuals"],
    ["/blog/clean-product-backgrounds", "/blog/ai-product-photo-generator"],
    ["/blog/ai-product-photography-ecommerce", "/blog/zyvo-vs-midjourney-product-photos"],
  ]) {
    assert.deepEqual(redirects.find((r) => r.source === dead), { source: dead, destination: real, statusCode: 301 });
    assert.ok(sitemap.includes(`<loc>https://www.tryzyvo.com${real}</loc>`), `${real} is a real, indexable post`);
  }
  // Every "/blog/…" link written in a blog post is a route or a redirect (a missing one shows "Page Not Found", noindex).
  for (const dir of ["imagegenerator", "productphotos"]) {
    const folder = new URL(`../src/app/blog/${dir}/`, import.meta.url);
    for (const file of readdirSync(folder).filter((name) => name.endsWith(".jsx"))) {
      const source = readFileSync(new URL(file, folder), "utf8");
      for (const [, slug] of source.matchAll(/(?:slug:\s*|to=|href[:=]\s*)"(\/blog\/[^"#?]+)"/g)) {
        assert.ok(isPage(slug), `${dir}/${file} links to ${slug}, which is not a page`);
      }
    }
  }
});

test("pricing has one URL: /workspace/pricing 301s to /pricing", () => {
  const redirects = JSON.parse(read("vercel.json")).redirects;
  const sitemap = read("public/sitemap.xml");
  // A 301, not a canonical tag: the old URL is not a page of its own any more.
  assert.deepEqual(redirects.find((r) => r.source === "/workspace/pricing"), { source: "/workspace/pricing", destination: "/pricing", statusCode: 301 });
  assert.ok(sitemap.includes("<loc>https://www.tryzyvo.com/pricing</loc>"));
  assert.equal(sitemap.includes("/workspace/pricing"), false);
  assert.equal(getWorkspaceRouteSeoPolicy("/workspace/pricing"), null);
});

test("Publish, Stats and Connections are unreleased: their landing pages go Home and nothing links to them", () => {
  const redirects = JSON.parse(read("vercel.json")).redirects;
  const sitemap = read("public/sitemap.xml");
  const app = read("src/App.jsx");
  for (const page of ["/publish", "/stats", "/connections"]) {
    // 302: the page comes back at the same address when the feature is released.
    assert.deepEqual(redirects.find((r) => r.source === page), { source: page, destination: "/", statusCode: 302 });
    assert.ok(app.includes(`<Route path="${page}" element={<Navigate to="/" replace />} />`), `${page} goes Home inside the app`);
    assert.equal(sitemap.includes(`https://www.tryzyvo.com${page}<`), false, `${page} is out of the sitemap`);
    assert.equal(getNoindexWorkspaceRoutes().some((policy) => policy.publicLanding === page), false, `no tool link leads to ${page}`);
    assert.equal(blogArticles.some((article) => article.relatedTool?.href === page), false, `no blog "Try" button leads to ${page}`);
    assert.doesNotMatch(read("scripts/generateSitemap.js"), new RegExp(`"${page}"`));
    assert.doesNotMatch(read("src/components/workspace/footer.jsx"), new RegExp(`to="${page}"`));
  }
  // The old tool URL goes Home too (as it does inside the app).
  assert.deepEqual(redirects.find((r) => r.source === "/workspace/publish"), { source: "/workspace/publish", destination: "/", statusCode: 301 });
  assert.match(app, /<Route path="\/workspace\/publish"\s+element=\{<Navigate to="\/" replace \/>\} \/>/);
  // A public page that IS listed as noindex keeps that tag in the browser as well.
  assert.equal(publicRobotsFor("/workspace/creations"), "noindex, follow");
  assert.equal(publicRobotsFor("/clay-rescue-maker"), "index, follow, max-image-preview:large");
  assert.match(read("src/components/seo/PublicContentLayout.jsx"), /"content", publicRobotsFor\(pathname\), \{ name: "robots" \}/);
});

test("public pages link straight to the final URL, never to an address that redirects", () => {
  const sources = JSON.parse(read("vercel.json")).redirects.map((r) => r.source);
  const folders = ["../src/app/blog/", "../src/app/blog/imagegenerator/", "../src/app/blog/productphotos/", "../src/pages/landing/", "../src/components/home-v2/", "../src/components/blog/", "../src/components/seo/"];
  const files = [new URL("../src/components/workspace/footer.jsx", import.meta.url)];
  // Not on the site while the features are unreleased: the three landing pages (they redirect) and the hidden posts.
  const off = ["PublishLanding.jsx", "StatsLanding.jsx", "ConnectionsLanding.jsx", "CreatorSuiteLanding.jsx", ...HIDDEN_BLOG_POSTS.map((slug) => `${slug.replace("/blog/", "")}.jsx`)];
  for (const folder of folders) {
    const url = new URL(folder, import.meta.url);
    for (const name of readdirSync(url)) if (/\.jsx?$/.test(name) && !off.includes(name)) files.push(new URL(name, url));
  }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // A post that keeps its Publish/Stats/Connections pitch behind the release flag may name those pages there.
    const gated = text.includes("PUBLISH_SUITE_RELEASED");
    for (const source of sources) {
      if (gated && [...PUBLISH_SUITE_PAGES, "/workspace/publish"].includes(source)) continue;
      for (const quote of ['"', "'", "`"]) {
        assert.equal(text.includes(`${quote}${source}${quote}`), false, `${file.pathname.split("/src/")[1]} links to ${source}, which redirects`);
      }
    }
  }
  // The build checks the same on the finished pages (scripts/validateSeoIndexing.js).
  assert.match(read("scripts/validateSeoIndexing.js"), /links to \$\{target\}, which redirects/);
});

test("unreleased features: six feature-only posts are hidden, other posts drop the pitch, one flag restores it all", () => {
  assert.equal(PUBLISH_SUITE_RELEASED, false);
  assert.deepEqual(HIDDEN_BLOG_POSTS, [
    "/blog/what-is-zyvo-publish", "/blog/what-is-zyvo-stats", "/blog/what-is-zyvo-connections",
    "/blog/one-click-publishing-playbook", "/blog/schedule-auto-publish-ai-videos", "/blog/zyvo-content-workflow",
  ]);
  const sitemap = read("public/sitemap.xml");
  for (const slug of HIDDEN_BLOG_POSTS) {
    assert.equal(getWorkspaceRouteSeoPolicy(slug)?.seoVisibility, "noindex", `${slug} is noindex`);
    assert.equal(publicRobotsFor(slug), "noindex, follow");
    assert.equal(sitemap.includes(`${slug}<`), false, `${slug} is out of the sitemap`);
    assert.equal(blogArticles.some((article) => article.slug === slug), false, `${slug} is out of the blog index`);
    assert.ok(read("src/App.jsx").includes(`path="${slug}"`), `${slug} still has its route (the post is kept for release)`);
  }
  // The general how-to posts stay.
  for (const slug of ["/blog/how-to-cross-post-instagram-tiktok-youtube", "/blog/social-media-scheduler-for-creators", "/blog/youtube-analytics-for-creators", "/blog/best-time-to-post-ai-content"]) {
    assert.ok(blogArticles.some((article) => article.slug === slug), `${slug} is in the blog index`);
    assert.ok(sitemap.includes(`<loc>https://www.tryzyvo.com${slug}</loc>`), `${slug} is in the sitemap`);
    assert.equal(getWorkspaceRouteSeoPolicy(slug), null);
  }
  // Related lists never offer a hidden post, and no kept post links to one outside a flagged block.
  assert.match(read("src/app/blog/RelatedArticles.jsx"), /listed\.filter\(\(article\) => !isHiddenBlogPost\(article\.slug\)\)/);
  const folder = new URL("../src/app/blog/imagegenerator/", import.meta.url);
  const hiddenFiles = HIDDEN_BLOG_POSTS.map((slug) => `${slug.replace("/blog/", "")}.jsx`);
  for (const name of readdirSync(folder).filter((file) => file.endsWith(".jsx") && !hiddenFiles.includes(file))) {
    const text = readFileSync(new URL(name, folder), "utf8");
    for (const slug of HIDDEN_BLOG_POSTS) {
      if (text.includes(`to="${slug}"`)) assert.ok(text.includes("PUBLISH_SUITE_RELEASED"), `${name} links to the hidden ${slug} outside a flagged block`);
    }
    if (/Explore Zyvo Publish|Open Zyvo Stats/.test(text)) assert.ok(text.includes("PUBLISH_SUITE_RELEASED"), `${name} has a feature button outside a flagged block`);
  }
  // The six shared guides filter the pitch; the app menu leaves out the tool that has no page.
  const guides = read("src/app/blog/CreatorGrowthGuide.jsx");
  assert.match(guides, /const GUIDES = PUBLISH_SUITE_RELEASED \? ALL_GUIDES : /);
  assert.equal((guides.match(/\{PUBLISH_SUITE_RELEASED && \(/g) || []).length, 2, "the two open-the-tool blocks");
  assert.match(read("src/components/workspace/CreateMenu.jsx"), /ALL_PUBLISH_TOOLS\.filter\(\(tool\) => PUBLISH_SUITE_RELEASED \|\| tool\.id !== "post-schedule"\)/);
  // The steps to release are written down next to the flag.
  assert.match(read("src/data/unreleasedFeatures.js"), /TO RELEASE THEM, in this order:/);
});

test("unknown addresses are a real 404; only app routes get the app shell, which is noindex with no canonical", () => {
  const config = JSON.parse(read("vercel.json"));
  // No catch-all: nothing rewrites an unknown path to a page (Vercel then answers 404 with dist/404.html).
  assert.equal(config.rewrites.some((r) => r.source === "/(.*)" || r.source === "/:path*"), false);
  const shellSources = config.rewrites.filter((r) => r.destination === "/app-shell").map((r) => r.source);
  assert.ok(shellSources.length > 0);
  assert.deepEqual(config.rewrites.filter((r) => r.destination !== "/app-shell"), [{ source: "/api/(.*)", destination: "/api/$1" }]);
  const toShell = (pathname) => shellSources.some((source) => new RegExp(`^${source.replace(/\(\.\*\)/g, ".*")}$`).test(pathname));
  for (const stray of ["/$", "/&", "/blog/not-a-post", "/sitemax.xml", "/contact", "/worspace/home", "/anything"]) assert.equal(toShell(stray), false, `${stray} must be a 404`);

  // Every route of the app is served: its own HTML (sitemap or noindex list), a redirect, or the app shell.
  const app = read("src/App.jsx");
  const sitemap = read("public/sitemap.xml");
  const redirects = new Set(config.redirects.map((r) => r.source));
  const hasOwnHtml = (pathname) => sitemap.includes(`<loc>https://www.tryzyvo.com${pathname === "/" ? "/" : pathname}</loc>`) || getNoindexWorkspaceRoutes().some((policy) => policy.path === pathname);
  const routes = [...app.matchAll(/path="(\/[^"]*)"/g)].map((match) => match[1]);
  assert.ok(routes.length > 300);
  for (const route of routes) {
    const sample = route.replace(/:[A-Za-z]+/g, "abc123");
    assert.ok(hasOwnHtml(sample) || redirects.has(sample) || toShell(sample), `${route} would be a 404`);
  }
  // Paths the app, emails and payment returns send people to.
  for (const used of ["/auth/callback", "/auth/confirm", "/auth/reset", "/billing/success", "/billing/cancel", "/unsubscribe", "/login", "/signup", "/settings",
    "/long-form/create", "/long-form/project/abc123/scenes", "/long-form/teaser/abc123", "/workspace/earn", "/workspace/stats", "/admin/ops", "/help/feedback", "/support/article/abc123", "/support/policies/cookies"]) {
    assert.ok(hasOwnHtml(used) || toShell(used), `${used} is served`);
  }
  assert.deepEqual(config.redirects.find((r) => r.source === "/workspace"), { source: "/workspace", destination: "/", statusCode: 301 });
  // The build writes both files, neither with a canonical, both noindex.
  const gen = read("scripts/generateSeoHtml.js");
  assert.match(gen, /const APP_SHELL_FILE = "app-shell\.html";/);
  assert.match(gen, /const NOT_FOUND_FILE = "404\.html";/);
  assert.match(gen, /if \(\/rel="canonical"\/i\.test\(html\)\) throw new Error/);
  assert.match(gen, /await writeShellAndNotFound\(template, renderApp\);/);
});

test("/long-form and the support pages in every footer have their own indexable HTML", () => {
  const sitemap = read("public/sitemap.xml");
  const longForm = getWorkspaceRouteSeoPolicy("/long-form");
  assert.equal(longForm.seoVisibility, "public");
  assert.ok(longForm.title.length <= 60 && longForm.description.length >= 80 && longForm.description.length <= 160);
  assert.notEqual(longForm.title, getWorkspaceRouteSeoPolicy("/").title);
  assert.equal(getWorkspaceRouteSeoPolicy("/long-form/create").seoVisibility, "noindex");
  const pages = ["/long-form", "/support", "/support/contact", "/support/policies/privacy", "/support/policies/tos"];
  for (const page of pages) assert.ok(sitemap.includes(`<loc>https://www.tryzyvo.com${page}</loc>`), `${page} is in the sitemap, so the build writes its HTML`);
  const titles = pages.map((page) => getPublicSeoMetadata(page)?.title ?? getWorkspaceRouteSeoPolicy(page)?.title);
  assert.equal(new Set(titles).size, pages.length);
  // A signed-out visitor (and the prerendered page) gets real content on /long-form.
  const lobby = read("src/pages/workspace/long-form/index.jsx");
  assert.ok(lobby.includes("const signedOut = !user && (!authLoading || import.meta.env.SSR);"));
  assert.match(lobby, /data-testid="lobby-niches"/);
  // The stickman pages' niche cards and blog links to the image tool point at indexable pages too.
  assert.equal(read("src/pages/landing/StickmanVideoLanding.jsx").includes("/long-form/create"), false);
  for (const dir of ["imagegenerator", "productphotos"]) {
    const folder = new URL(`../src/app/blog/${dir}/`, import.meta.url);
    for (const name of readdirSync(folder)) assert.equal(readFileSync(new URL(name, folder), "utf8").includes('"/workspace/image-generator"'), false, `${name} links to the noindex image tool`);
  }
});

test("the blog \"maker\" copies 301 to their landing pages, which carry the copies' sections", () => {
  const moves = [
    ["/blog/micro-camera-animal-maker", "/micro-camera-animal-maker", "src/pages/landing/MicroCameraAnimalLanding.jsx", ["Which Animals Work Best?", "Tips for Getting Maximum Views"]],
    ["/blog/face-asmr-maker", "/face-asmr-maker", "src/pages/landing/FaceAsmrLanding.jsx", ["How Many Scenes Should You Generate?", "How to Post Face ASMR Videos for Maximum Reach"]],
    ["/blog/clay-rescue-ai-video-maker", "/clay-rescue-maker", "src/pages/landing/ClayRescueLanding.jsx", ["The 7-Second Structure That Works", "Scenario Ideas That Fit the Format"]],
  ];
  const app = read("src/App.jsx");
  const sitemap = read("public/sitemap.xml");
  const redirects = JSON.parse(read("vercel.json")).redirects;
  for (const [from, to, landing, headings] of moves) {
    assert.deepEqual(redirects.find((r) => r.source === from), { source: from, destination: to, statusCode: 301 });
    assert.ok(app.includes(`<Route path="${from}" element={<Navigate to="${to}" replace />} />`), `${from} route redirects in the app`);
    assert.equal(sitemap.includes(`${from}<`), false, `${from} is out of the sitemap`);
    assert.ok(sitemap.includes(`<loc>https://www.tryzyvo.com${to}</loc>`));
    assert.equal(blogArticles.some((article) => article.slug === from), false, `${from} is out of the blog index`);
    assert.equal(getPublicSeoMetadata(from), null);
    const page = read(landing);
    for (const heading of headings) assert.ok(page.includes(heading), `${to} has "${heading}"`);
    assert.equal(page.includes(`"${from}"`), false, `${to} no longer links to ${from}`);
    // The landing page has its own title and description (it used to borrow them from its H1).
    const metadata = getPublicSeoMetadata(to);
    assert.ok(metadata.title.endsWith("| Zyvo") && metadata.title.length <= 60, metadata.title);
    assert.ok(metadata.description.length >= 80 && metadata.description.length <= 160, String(metadata.description.length));
  }
  // No page links to a redirected URL.
  const blogDir = new URL("../src/app/blog/imagegenerator/", import.meta.url);
  for (const file of readdirSync(blogDir)) {
    const source = readFileSync(new URL(file, blogDir), "utf8");
    for (const [from] of moves) assert.equal(source.includes(`"${from}"`), false, `${file} links to ${from}`);
  }
});

test("retired Product Photo routes and navigational targets stay removed", () => {
  const app = read("src/App.jsx");
  const footer = read("src/components/Figma/Footer.jsx");
  assert.doesNotMatch(app, /path="\/workspace\/productphoto/i);
  assert.doesNotMatch(footer, /to="\/workspace\/productphoto/i);
});
