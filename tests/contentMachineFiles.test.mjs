// Content Machine: downloads and previews ask for a FRESH signed link when used (owner, 2026-10-19). Links made when
// the page rendered had expired by the click ("exp" claim timestamp check failed).
import test from "node:test";
import assert from "node:assert/strict";
import { apiFor, depsFor, drain, fakeProviders, fakeWorld, startRun } from "./helpers/contentMachineFakes.mjs";
import { FRESH_PATH, FRESH_SECONDS } from "../supabase/functions/_shared/contentMachine/apiSlideshows.js";

function withFiles(world, { missing = new Set() } = {}) {
  const calls = [];
  const files = {
    signedUrls: async (ps) => Object.fromEntries(ps.map((p) => [p, `https://signed/${p}`])),
    signedUrl: async (p, seconds, opts = {}) => { calls.push({ p, seconds, opts }); return missing.has(p) ? null : `https://signed/${p}?fresh=1${opts.download ? `&download=${opts.download}` : ""}`; },
  };
  return { ...apiFor(world, { files }), calls };
}

test("a fresh 5-minute link per click, named for the download; the page gets the files' paths", async () => {
  const world = fakeWorld();
  await startRun(world, { count: 1 });
  await drain(world, depsFor(world, fakeProviders(world)));
  const { call, calls } = withFiles(world);
  const idea = (await call({ action: "ideas" })).data.ideas[0];
  const paths = idea.generation.paths;
  assert.match(paths.zip, /^slideshows\/.+\/slides\.zip$/);
  assert.match(paths.mp4, /slideshow\.mp4$/);
  assert.equal(paths.pngs.length, idea.slides.length);
  const r = await call({ action: "freshUrl", path: paths.zip, download: "my slideshow/../x.zip" });
  assert.equal(r.ok, true, r.message);
  assert.equal(calls.at(-1).seconds, FRESH_SECONDS);
  assert.equal(FRESH_SECONDS, 300);
  assert.equal(calls.at(-1).opts.download, "my slideshow_.._x.zip", "the file name is made safe");
  assert.match(r.data.url, /fresh=1/);
  // Each click makes a new link (none is cached from the page).
  await call({ action: "freshUrl", path: paths.mp4 });
  assert.equal(calls.filter((c) => c.p === paths.mp4).length, 1);
});

test("only Content Machine files; a missing file gives a clear message, not a broken page", async () => {
  const world = fakeWorld();
  const { call } = withFiles(world, { missing: new Set(["slideshows/2026-10-20/x/slides.zip"]) });
  for (const bad of ["../secrets.txt", "slideshows/../../etc/passwd", "https://evil.example/x.zip", "users/abc/avatar.png", ""]) {
    const r = await call({ action: "freshUrl", path: bad });
    assert.equal(r.ok, false, bad);
    assert.match(r.message, /isn't a Content Machine file/);
  }
  for (const okPath of ["slideshows/2026-10-20/a/slide-01.png", "posts/p1/s1.jpg", "library/aaaa1111.webp", "logos/tryzyvo.com.png", "assets/zyvo-ui-picker.png"]) assert.ok(FRESH_PATH.test(okPath), okPath);
  const gone = await call({ action: "freshUrl", path: "slideshows/2026-10-20/x/slides.zip" });
  assert.equal(gone.ok, false);
  assert.match(gone.message, /isn't available any more/);
});
