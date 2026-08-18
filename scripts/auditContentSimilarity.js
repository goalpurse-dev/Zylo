// Content-similarity / cannibalization report for the blog.
//
//   node scripts/auditContentSimilarity.js        — audits local dist/ build
//
// Read-only: flags candidate near-duplicate / thin articles for a human
// decision. Does NOT delete, merge, or redirect anything.
//
// For every pair of public /blog/* articles, computes two similarity scores
// over the isolated article body text:
//   - 4-word shingle Jaccard — catches near-verbatim duplication.
//   - unigram (bag-of-words) Jaccard — catches "same boilerplate template,
//     different keywords swapped" duplication, which shingle-overlap alone
//     misses since reworded sentences share few identical 4-grams even when
//     the paragraph structure and vocabulary are otherwise near-identical.
//     Thresholds were calibrated against confirmed cases found by manual
//     review (two Product Photos template pairs) against confirmed-distinct
//     same-niche pairs, to keep the floor above genuine topical overlap.
// A pair is flagged if EITHER score clears its threshold. Also flags
// thin-content articles and groups sharing overlapping title keywords, as a
// cheap proxy for "same search intent."

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THIN_CONTENT_WORDS = 250;
const SHINGLE_THRESHOLD = 0.35;
const SHINGLE_SIZE = 4;
// Unigram Jaccard alone is too noisy for a hard "flag for merge" threshold at
// this corpus size — legitimately distinct same-cluster articles (e.g. two
// different 2AM Worlds character guides) naturally land in the 0.40-0.65
// range too. Score distribution instead shows a clear cliff between the one
// confirmed near-duplicate pair (0.925) and everything else (<=0.63), so
// unigram results are reported as a capped, explicitly lower-confidence
// "candidates for manual review" list rather than an auto-flagged bucket.
const UNIGRAM_REVIEW_CAP = 20;

function readSitemapBlogPaths() {
  const xml = readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>https:\/\/www\.tryzyvo\.com([^<]*)<\/loc>/g)]
    .map((m) => m[1] || "/")
    .filter((p) => p.startsWith("/blog/"));
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Isolates the page's own prose from the shared PublicContentHeader nav (every
// page repeats "Sign up" in its desktop + mobile nav) and the shared Footer
// (every page repeats "Contact Us"). Without this, the site-wide chrome text
// shared by ~all 150+ pages swamps genuine body-text overlap in the Jaccard
// score, hiding real near-duplicates. Falls back to the full root text if
// either marker is missing (defensive — shouldn't happen given the shared
// layout, but avoids silently producing empty text on a formatting change).
function isolateArticleBody(rootHtml) {
  const lastSignUp = rootHtml.lastIndexOf("Sign up");
  const contactUs = rootHtml.indexOf("Contact Us");
  if (lastSignUp === -1 || contactUs === -1 || contactUs <= lastSignUp) return rootHtml;
  return rootHtml.slice(lastSignUp, contactUs);
}

function extractPageText(pathname) {
  const file = path.join(root, "dist", pathname.replace(/^\/+/, ""), "index.html");
  if (!existsSync(file)) return null;
  const html = readFileSync(file, "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || null;
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || null;
  const category = html.match(/<meta\s+name=["']article:section["']\s+content=["']([^"']*)["']/i)?.[1] || null;
  const rootMatch = html.match(/<div id="root">([\s\S]*)<\/body>/i);
  const articleHtml = isolateArticleBody(rootMatch ? rootMatch[1] : html);
  const bodyText = stripTags(articleHtml);
  return { title, description, category, bodyText, wordCount: bodyText ? bodyText.split(" ").filter(Boolean).length : 0 };
}

const STOPWORDS = new Set(["a","an","the","for","to","with","and","of","in","on","is","are","your","you","how","best","top","why","what","these","that","this","most","it","or","be","as","from","by"]);

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

function shingles(words, n = SHINGLE_SIZE) {
  const set = new Set();
  for (let i = 0; i <= words.length - n; i++) {
    set.add(words.slice(i, i + n).join(" "));
  }
  return set;
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function titleKeywords(title) {
  return new Set(normalizeWords(title || ""));
}

async function main() {
  if (!existsSync(path.join(root, "dist", ".seo-prerender-complete"))) {
    console.error("No local prerendered build found. Run `npm run build` first.");
    process.exit(1);
  }

  const paths = readSitemapBlogPaths();
  const pages = [];
  for (const pathname of paths) {
    const data = extractPageText(pathname);
    if (!data) continue;
    const words = normalizeWords(data.bodyText);
    pages.push({
      pathname,
      title: data.title,
      description: data.description,
      wordCount: data.wordCount,
      wordSet: new Set(words),
      shingleSet: shingles(words),
      titleWords: titleKeywords(data.title),
    });
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`CONTENT SIMILARITY / CANNIBALIZATION REPORT — ${pages.length} blog articles`);
  console.log(`${"=".repeat(70)}\n`);

  // ---- Thin content ----
  const thin = pages.filter((p) => p.wordCount > 0 && p.wordCount < THIN_CONTENT_WORDS);
  console.log(`THIN CONTENT (< ${THIN_CONTENT_WORDS} words): ${thin.length}`);
  for (const p of thin) console.log(`  ${p.pathname} — ${p.wordCount} words`);

  // ---- Duplicate / near-duplicate titles & descriptions ----
  const titleOwners = new Map();
  const descOwners = new Map();
  for (const p of pages) {
    if (p.title) titleOwners.set(p.title, [...(titleOwners.get(p.title) || []), p.pathname]);
    if (p.description) descOwners.set(p.description, [...(descOwners.get(p.description) || []), p.pathname]);
  }
  const dupTitles = [...titleOwners.entries()].filter(([, urls]) => urls.length > 1);
  const dupDescs = [...descOwners.entries()].filter(([, urls]) => urls.length > 1);
  console.log(`\nDUPLICATE TITLES: ${dupTitles.length}`);
  for (const [title, urls] of dupTitles) console.log(`  "${title}"\n    ${urls.join("\n    ")}`);
  console.log(`\nDUPLICATE DESCRIPTIONS: ${dupDescs.length}`);
  for (const [desc, urls] of dupDescs) console.log(`  "${desc.slice(0, 90)}…"\n    ${urls.join("\n    ")}`);

  // ---- Pairwise body-text similarity: two confidence tiers ----
  const allPairs = [];
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const shingleScore = jaccard(pages[i].shingleSet, pages[j].shingleSet);
      const unigramScore = jaccard(pages[i].wordSet, pages[j].wordSet);
      allPairs.push({ a: pages[i].pathname, b: pages[j].pathname, shingleScore, unigramScore });
    }
  }

  const highConfidence = allPairs.filter((p) => p.shingleScore >= SHINGLE_THRESHOLD).sort((x, y) => y.shingleScore - x.shingleScore);
  console.log(`\nHIGH-CONFIDENCE NEAR-DUPLICATES (shingle Jaccard >= ${SHINGLE_THRESHOLD}): ${highConfidence.length}`);
  for (const pair of highConfidence) {
    console.log(`  ${(pair.shingleScore * 100).toFixed(1)}% near-verbatim   ${pair.a}  <->  ${pair.b}`);
  }

  const highConfidenceKeys = new Set(highConfidence.map((p) => `${p.a}|${p.b}`));
  const reviewCandidates = allPairs
    .filter((p) => !highConfidenceKeys.has(`${p.a}|${p.b}`))
    .sort((x, y) => y.unigramScore - x.unigramScore)
    .slice(0, UNIGRAM_REVIEW_CAP);
  console.log(`\nLOWER-CONFIDENCE REVIEW CANDIDATES (top ${UNIGRAM_REVIEW_CAP} by vocabulary overlap — needs human judgment, not auto-flagged):`);
  for (const pair of reviewCandidates) {
    console.log(`  ${(pair.unigramScore * 100).toFixed(1)}% vocabulary overlap   ${pair.a}  <->  ${pair.b}`);
  }

  const similarPairs = [...highConfidence, ...reviewCandidates];

  // ---- Same search-intent groups (category-agnostic here since dist HTML
  // doesn't carry category directly; approximate via shared title keywords) ----
  const intentGroups = new Map();
  for (const p of pages) {
    const key = [...p.titleWords].sort().slice(0, 3).join("|");
    if (!key) continue;
    intentGroups.set(key, [...(intentGroups.get(key) || []), p.pathname]);
  }
  const overlappingIntent = [...intentGroups.entries()].filter(([, urls]) => urls.length > 1);
  console.log(`\nSHARED TITLE-KEYWORD GROUPS (possible same search intent): ${overlappingIntent.length}`);
  for (const [key, urls] of overlappingIntent) console.log(`  [${key.split("|").join(", ")}]\n    ${urls.join("\n    ")}`);

  // ---- Merge candidates: only high-confidence pairs + confirmed duplicate
  // titles/descriptions. Lower-confidence review candidates are reported
  // separately and are NOT counted here — they need a human read, not an
  // automatic merge recommendation.
  const mergeCandidateSet = new Set();
  for (const pair of highConfidence) { mergeCandidateSet.add(pair.a); mergeCandidateSet.add(pair.b); }
  for (const [, urls] of dupTitles) urls.forEach((u) => mergeCandidateSet.add(u));
  for (const [, urls] of dupDescs) urls.forEach((u) => mergeCandidateSet.add(u));

  console.log(`\n${"-".repeat(70)}\nSUMMARY\n${"-".repeat(70)}`);
  console.log(`Articles audited:            ${pages.length}`);
  console.log(`Thin content:                ${thin.length}`);
  console.log(`Duplicate title clusters:    ${dupTitles.length}`);
  console.log(`Duplicate desc clusters:     ${dupDescs.length}`);
  console.log(`High-confidence duplicates:  ${highConfidence.length}`);
  console.log(`Lower-confidence candidates: ${reviewCandidates.length} (needs manual review)`);
  console.log(`Confirmed merge candidates:  ${mergeCandidateSet.size}`);

  const reportDir = path.join(root, "scripts", "reports");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "content-similarity-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        articlesAudited: pages.length,
        thinContent: thin.map((p) => ({ url: p.pathname, wordCount: p.wordCount })),
        duplicateTitles: dupTitles.map(([title, urls]) => ({ title, urls })),
        duplicateDescriptions: dupDescs.map(([description, urls]) => ({ description, urls })),
        highConfidenceDuplicates: highConfidence,
        lowerConfidenceReviewCandidates: reviewCandidates,
        mergeCandidates: [...mergeCandidateSet],
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${path.relative(root, reportPath)}`);
}

main();
