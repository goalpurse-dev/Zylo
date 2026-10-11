// Checks the built HTML of Blocky Stories' public page (dist/blocky-story-video-maker.html, after
// `npm run build`): its tags, headings, word count, the trademark rules, and its structured data against
// what Google's rich results need for each type. Reads files and asks the video and picture addresses with
// HEAD requests; changes nothing.
//   node scripts/blocky/checkLanding.mjs
import fs from "fs";
import path from "path";
import { ROOT } from "./lib.mjs";
import { BLOCKY_LANDING_PATH, BLOCKY_LANDING_SEO, GENRE } from "../../src/data/blockyStoryLanding.js";

const SITE = "https://www.tryzyvo.com";
const file = path.join(ROOT, "dist", `${BLOCKY_LANDING_PATH.slice(1)}.html`);
if (!fs.existsSync(file)) { console.error(`${file} is missing: run npm run build first.`); process.exit(1); }
const html = fs.readFileSync(file, "utf8");
const results = [];
const ok = (name, pass, detail = "") => { results.push(Boolean(pass)); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const meta = (attr, value) => { const m = html.match(new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*>`, "i")); return m ? unescape(m[0].match(/content="([^"]*)"/i)?.[1] ?? "") : null; };

// ── Tags ──
const title = unescape(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
const description = meta("name", "description");
const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
ok("title: the page's own, 60 characters or fewer", title === BLOCKY_LANDING_SEO.title && title.length <= 60, `${title.length}: ${title}`);
ok("description: the page's own, 155 characters or fewer", description === BLOCKY_LANDING_SEO.description && description.length <= 155, `${description?.length}`);
ok("canonical points at the page itself", canonical === `${SITE}${BLOCKY_LANDING_PATH}`, canonical);
ok("robots: indexable", /index, follow/.test(meta("name", "robots") ?? "") && !/noindex/.test(meta("name", "robots") ?? ""), meta("name", "robots"));
const og = { title: meta("property", "og:title"), description: meta("property", "og:description"), url: meta("property", "og:url"), image: meta("property", "og:image"), type: meta("property", "og:type"), w: meta("property", "og:image:width"), h: meta("property", "og:image:height") };
const tw = { card: meta("name", "twitter:card"), title: meta("name", "twitter:title"), image: meta("name", "twitter:image") };
const ogFile = path.join(ROOT, "dist", (og.image ?? "").replace(SITE, ""));
ok("Open Graph: title, description, url, type and a 1200 x 630 picture that is in the build", og.title === title && og.description === description && og.url === canonical && og.type === "website" && og.w === "1200" && og.h === "630" && fs.existsSync(ogFile), og.image);
ok("Twitter: a large-picture card with the same title and picture", tw.card === "summary_large_image" && tw.title === title && tw.image === og.image);
ok("the hero poster is preloaded and the display font does not block the first paint", /<link rel="preload" as="image" href="\/lp\/blocky-stories\/story-no-hats-allowed\.w540\.webp" fetchpriority="high"/.test(html) && /media="print" onload="this\.media='all'"/.test(html));

// ── Content ──
const body = html.slice(html.indexOf("<body"));
const content = body.slice(body.indexOf("data-landing-content"));
const text = (s) => unescape(s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const h1 = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1]));
const h2 = [...content.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => text(m[1]));
const h3 = [...content.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => text(m[1]));
const footerAt = content.indexOf('<section class="w-full bg-[#090A0A] text-[#B8BAC5]">');   // the site footer (components/workspace/footer.jsx)
if (footerAt < 0) { console.error("The footer's start was not found in the HTML: the word count and picture checks need it."); process.exit(1); }
const pageText = text(footerAt > 0 ? content.slice(0, footerAt) : content);
const words = pageText.split(" ").filter(Boolean).length;
ok("one H1, the page's own", h1.length === 1 && h1[0] === BLOCKY_LANDING_SEO.h1, h1.join(" | "));
ok("headings in order: sections are H2, items under them H3", h2.length >= 8 && h3.length >= 15 && content.indexOf("<h3") > content.indexOf("<h2"), `${h2.length} H2, ${h3.length} H3`);
ok("about 1,200 to 1,800 words of real content", words >= 1200 && words <= 1800, `${words} words`);
console.log(`      H2: ${h2.join(" · ")}`);
const links = [...content.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map((m) => m[1]);
ok("links to the tool and to pricing", links.filter((l) => l === "/workspace/blocky-stories").length >= 3 && links.includes("/pricing"), `${links.filter((l) => l === "/workspace/blocky-stories").length} to the tool`);
const imgs = [...content.slice(0, footerAt > 0 ? footerAt : undefined).matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
const alts = imgs.map((i) => unescape(i.match(/alt="([^"]*)"/)?.[1] ?? ""));
ok("every picture has a size, and every content picture a descriptive alt text", imgs.length >= 5 && imgs.every((i) => /width="\d+"/.test(i) && /height="\d+"/.test(i)) && alts.every((a) => a.length >= 40), `${imgs.length} pictures`);
ok("only the hero poster loads eagerly; no video file is in the first HTML", imgs.filter((i) => /loading="eager"/.test(i)).length === 1 && imgs.filter((i) => /loading="lazy"/.test(i)).length === imgs.length - 1 && !/<video\b/i.test(content));

// ── Trademark rules ──
const name = GENRE?.short ?? "Roblox";
const count = (s, needle) => s.split(needle).length - 1;
const srcs = [...html.matchAll(/(?:src|href|srcset|content)="([^"]*)"/gi)].map((m) => m[1]).join(" ");
ok(`"${name}" is not in the URL, the title, the description, the H1, an alt text or any file address`, ![BLOCKY_LANDING_PATH, title, description, og.title, og.description, ...h1, ...alts, srcs].some((s) => new RegExp(name, "i").test(s ?? "")));
if (GENRE) {
  const styleMentions = count(pageText, GENRE.style);
  const notice = text(content.match(/<p[^>]*data-testid="blocky-notice"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const bare = count(pageText, name) - styleMentions;   // the question, its answer's company name, the notice
  ok(`descriptive mentions: 2 or 3, always as "${GENRE.style}"`, styleMentions >= 2 && styleMentions <= 3, `${styleMentions}`);
  ok("the notice above the footer, word for word", notice === `Blocky Stories is an independent Zyvo tool and is not affiliated with, endorsed by or sponsored by ${GENRE.owner}.`, notice);
  ok("every other mention is the question \"is this affiliated\", its answer and the notice", bare === 3, `${bare}`);
  ok("no heading names it", ![...h2, ...h3].some((h) => new RegExp(name, "i").test(h)));
} else {
  ok("the genre's name is switched off: it is nowhere on the page", !/roblox/i.test(html));
}

// ── Structured data ──
const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => JSON.parse(m[1]));
const graph = ld.flatMap((d) => d["@graph"] ?? [d]);
const of = (type) => graph.filter((n) => n["@type"] === type);
ok("one JSON-LD block that parses, with schema.org as its context", ld.length === 1 && ld[0]["@context"] === "https://schema.org", graph.map((n) => n["@type"]).join(", "));
const app = of("SoftwareApplication")[0];
ok("SoftwareApplication: name, category, operating system, and an offer with a price and a currency per plan", Boolean(app?.name && app.applicationCategory && app.operatingSystem && app.url === canonical) && app.offers?.length === 3 && app.offers.every((o) => o["@type"] === "Offer" && /^\d+(\.\d+)?$/.test(o.price) && /^[A-Z]{3}$/.test(o.priceCurrency) && o.url === `${SITE}/pricing`), app?.offers?.map((o) => `${o.price} ${o.priceCurrency}`).join(", "));
const faq = of("FAQPage")[0];
const visibleQuestions = [...content.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi)].map((m) => text(m[1]));
ok("FAQPage: 6 to 8 questions, each with an answer, the same ones the page shows", faq?.mainEntity?.length >= 6 && faq.mainEntity.length <= 8 && faq.mainEntity.every((q) => q["@type"] === "Question" && q.name && q.acceptedAnswer?.["@type"] === "Answer" && q.acceptedAnswer.text.length > 40) && JSON.stringify(faq.mainEntity.map((q) => q.name)) === JSON.stringify(visibleQuestions), `${faq?.mainEntity?.length} questions`);
const crumbs = of("BreadcrumbList")[0];
ok("BreadcrumbList: Home, then this page", crumbs?.itemListElement?.length === 2 && crumbs.itemListElement[1].item === canonical && crumbs.itemListElement.every((c, i) => c.position === i + 1 && c.name && c.item));
const videos = of("VideoObject");
const iso = (d) => /^P(T(\d+H)?(\d+M)?(\d+S)?)$/.test(d);
ok("VideoObject for the hero and each example: name, description, thumbnailUrl, uploadDate (what Google requires), plus duration and contentUrl", videos.length === 5 && videos.every((v) => v.name && v.description && Array.isArray(v.thumbnailUrl) && v.thumbnailUrl.length && /^\d{4}-\d{2}-\d{2}/.test(v.uploadDate) && iso(v.duration) && /^https:\/\/.+\.mp4$/.test(v.contentUrl)), `${videos.length} videos`);
ok("no structured data names the genre except the FAQ", !/roblox/i.test(JSON.stringify(graph.filter((n) => n["@type"] !== "FAQPage"))));
// Every address the structured data and the page point at answers.
const head = async (url) => { try { return (await fetch(url, { method: "HEAD" })).status; } catch { return 0; } };
const videoStatus = await Promise.all(videos.map((v) => head(v.contentUrl)));
ok("every video address answers", videoStatus.every((s) => s === 200), videoStatus.join(" "));
const thumbs = videos.flatMap((v) => v.thumbnailUrl).map((u) => path.join(ROOT, "dist", u.replace(SITE, "")));
ok("every thumbnail is a file in the build", thumbs.every((f) => fs.existsSync(f)), `${thumbs.length} files`);

// ── Indexing ──
const sitemap = fs.readFileSync(path.join(ROOT, "public", "sitemap.xml"), "utf8");
ok("the page is in the sitemap", sitemap.includes(`<loc>${SITE}${BLOCKY_LANDING_PATH}</loc>`));
const home = fs.readFileSync(path.join(ROOT, "dist", "index.html"), "utf8");
const pricing = fs.readFileSync(path.join(ROOT, "dist", "pricing.html"), "utf8");
const homeLinks = home.split(`href="${BLOCKY_LANDING_PATH}"`).length - 1;
ok("Home's HTML links to it: the card in the short form suite, and Try Template and the clips of the Blocky section", homeLinks >= 6 && home.includes('data-testid="featured-blocky"'), `${homeLinks} links`);
ok("the pricing page's HTML links to it", pricing.includes(`href="${BLOCKY_LANDING_PATH}"`));
ok("llms.txt lists it", fs.readFileSync(path.join(ROOT, "public", "llms.txt"), "utf8").includes(`${SITE}${BLOCKY_LANDING_PATH}`));

console.log(`\n${results.filter(Boolean).length} of ${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
