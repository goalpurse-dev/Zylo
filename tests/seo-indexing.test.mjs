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
    ["/blog/clean-product-backgrounds", "/blog/best-ai-product-backgrounds-to-use"],
    ["/blog/ai-product-photography-ecommerce", "/blog/best-ai-tools-for-ecommerce"],
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
  const files = [new URL("../src/components/workspace/footer.jsx", import.meta.url), new URL("../src/data/blogArticles.js", import.meta.url)];
  // The three unreleased landing pages are not served (they redirect), so their own links are not on the site.
  const off = ["PublishLanding.jsx", "StatsLanding.jsx", "ConnectionsLanding.jsx", "CreatorSuiteLanding.jsx"];
  for (const folder of folders) {
    const url = new URL(folder, import.meta.url);
    for (const name of readdirSync(url)) if (/\.jsx?$/.test(name) && !off.includes(name)) files.push(new URL(name, url));
  }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const source of sources) {
      for (const quote of ['"', "'", "`"]) {
        assert.equal(text.includes(`${quote}${source}${quote}`), false, `${file.pathname.split("/src/")[1]} links to ${source}, which redirects`);
      }
    }
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
