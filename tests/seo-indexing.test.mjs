import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getNoindexWorkspaceRoutes,
  getPublicWorkspaceRoutes,
  getWorkspaceRouteSeoPolicy,
} from "../src/data/routeSeoPolicy.js";

const read = (pathname) => readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");

test("paid and private workspace routes use one central noindex policy", () => {
  const policies = getNoindexWorkspaceRoutes();
  assert.ok(policies.length > 0);
  assert.equal(getWorkspaceRouteSeoPolicy("/workspace/ai-fruit-story")?.seoVisibility, "noindex");
  assert.equal(getWorkspaceRouteSeoPolicy("/workspace/ai-fruit-story")?.publicLanding, "/ai-fruit-story-maker");
  assert.equal(getPublicWorkspaceRoutes().some(({ path }) => path === "/workspace/pricing"), true);
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

test("AI Fruit has one public canonical target and a noindex paid application", () => {
  const app = read("src/App.jsx");
  const sitemap = read("public/sitemap.xml");
  assert.match(app, /path="\/ai-fruit-story-maker" element=\{<AIFruitStoryLanding/);
  assert.match(app, /path="\/blog\/ai-fruit-story-maker" element=\{<Navigate to="\/ai-fruit-story-maker" replace/);
  assert.equal((sitemap.match(/https:\/\/www\.tryzyvo\.com\/ai-fruit-story-maker/g) || []).length, 1);
  assert.equal(sitemap.includes("/blog/ai-fruit-story-maker"), false);
  assert.equal(sitemap.includes("/workspace/ai-fruit-story"), false);
});

test("retired Product Photo routes and navigational targets stay removed", () => {
  const app = read("src/App.jsx");
  const footer = read("src/components/Figma/Footer.jsx");
  assert.doesNotMatch(app, /path="\/workspace\/productphoto/i);
  assert.doesNotMatch(footer, /to="\/workspace\/productphoto/i);
});
