// $0 check of the built Long Form landing page (dist/, after `npm run build`):
// head tags, one H1, word count of the visible copy, JSON-LD types, image
// rules (alt, size, lazy), keyword use.
//   node scripts/stickmanLandingCheck.mjs [path]
import fs from "node:fs";
import { STICKMAN_LANDING_PAGES } from "../src/data/stickmanLandingPages.js";

const target = process.argv[2] ?? STICKMAN_LANDING_PAGES[0].path;
const page = STICKMAN_LANDING_PAGES.find((p) => p.path === target);
const html = fs.readFileSync(`dist${target}.html`, "utf8");
const head = html.slice(0, html.indexOf("</head>"));
const main = html.slice(html.indexOf("data-landing-content"), html.indexOf("data-landing-footer"));
const text = main.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, "'").replace(/\s+/g, " ").trim();
const words = text.split(" ").filter((w) => /[A-Za-z0-9]/.test(w));
const tag = (re) => (head.match(re) || [])[1] ?? null;
const imgs = [...main.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const ld = JSON.parse(tag(/<script type="application\/ld\+json" id="page-ld">([\s\S]*?)<\/script>/));
const count = (phrase) => (text.toLowerCase().match(new RegExp(phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
console.log(JSON.stringify({
  title: tag(/<title>([^<]*)<\/title>/),
  description: tag(/<meta name="description" content="([^"]*)"/),
  canonical: tag(/<link rel="canonical" href="([^"]*)"/),
  robots: tag(/<meta name="robots" content="([^"]*)"/),
  ogImage: tag(/<meta property="og:image" content="([^"]*)"/),
  ogSize: [tag(/og:image:width" content="([^"]*)"/), tag(/og:image:height" content="([^"]*)"/)],
  twitterCard: tag(/<meta name="twitter:card" content="([^"]*)"/),
  twitterImage: tag(/<meta name="twitter:image" content="([^"]*)"/),
  preload: tag(/<link rel="preload" as="image" href="([^"]*)"/),
  h1: (main.match(/<h1\b/g) || []).length,
  h2: [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")),
  words: words.length,
  images: imgs.length,
  imagesWithoutAlt: imgs.filter((i) => !/alt="[^"]+"/.test(i)).length,
  imagesWithoutSize: imgs.filter((i) => !/width="\d+"/.test(i) || !/height="\d+"/.test(i)).length,
  eagerImages: imgs.filter((i) => !/loading="lazy"/.test(i)).length,
  nonWebp: imgs.filter((i) => !/src="[^"]*\.webp"/.test(i)).length,
  jsonLd: ld["@graph"].map((n) => n["@type"]),
  hasRating: JSON.stringify(ld).includes("aggregateRating"),
  keywords: Object.fromEntries([page.keywords.primary, ...page.keywords.secondary].map((k) => [k, count(k)])),
}, null, 1));
