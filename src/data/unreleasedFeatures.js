// Publish, Stats and Connections are not released yet (decided 2026-10-11).
// While this is false, the site does not promote them:
//   - the blog posts below, which are only about those features, are noindex,
//     out of the sitemap and out of the blog index and "related" lists;
//   - other posts keep their how-to content but leave out the feature pitch,
//     its buttons and its FAQ lines (every such block checks this flag);
//   - the app menu leaves out "Post / Schedule", which has no page to open.
//
// TO RELEASE THEM, in this order:
//   1. set PUBLISH_SUITE_RELEASED to true (brings back everything listed above);
//   2. vercel.json: delete the three 302 redirects (/publish, /stats, /connections)
//      and the 301 from /workspace/publish;
//   3. src/App.jsx: put the PublishLanding / StatsLanding / ConnectionsLanding
//      routes back (the page files are still in src/pages/landing/), and point
//      /workspace/publish at the tool;
//   4. src/data/routeSeoPolicy.js: put publicLanding back on /workspace/publishv,
//      /workspace/stats and /workspace/connections;
//   5. scripts/generateSitemap.js: add "/publish", "/stats", "/connections" to
//      REQUIRED_PUBLIC_PAGES; src/components/workspace/footer.jsx: add the links.
//   tests/seo-indexing.test.mjs describes the "off" state and fails until all
//   of it is switched, so nothing is half released.
export const PUBLISH_SUITE_RELEASED = false;

// The landing pages of the three features.
export const PUBLISH_SUITE_PAGES = ["/publish", "/stats", "/connections"];

// Blog posts that are only about those features.
const FEATURE_ONLY_POSTS = [
  "/blog/what-is-zyvo-publish",
  "/blog/what-is-zyvo-stats",
  "/blog/what-is-zyvo-connections",
  "/blog/one-click-publishing-playbook",
  "/blog/schedule-auto-publish-ai-videos",
  "/blog/zyvo-content-workflow",
];
export const HIDDEN_BLOG_POSTS = PUBLISH_SUITE_RELEASED ? [] : FEATURE_ONLY_POSTS;

export const isHiddenBlogPost = (slug) => HIDDEN_BLOG_POSTS.includes(slug);

// A line of copy that pitches one of the features by name.
export const pitchesUnreleasedFeature = (text) => !PUBLISH_SUITE_RELEASED && /Zyvo (Publish|Stats|Connections)/.test(String(text ?? ""));
