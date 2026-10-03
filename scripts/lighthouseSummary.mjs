// Prints the scores, lab metrics and failed audits of a Lighthouse JSON report.
//   npx lighthouse <url> --output=json --output-path=report.json --chrome-flags="--headless=new"
//   node scripts/lighthouseSummary.mjs report.json
import fs from "node:fs";

const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = r.audits;
console.log(r.lighthouseVersion, r.configSettings.formFactor, JSON.stringify(Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k, Math.round(v.score * 100)]))));
console.log(["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"].map((k) => `${k} ${a[k].displayValue}`).join(" | "));
const m = a.metrics.details.items[0];
console.log(`observed: FCP ${m.observedFirstContentfulPaint} ms, LCP ${m.observedLargestContentfulPaint} ms`);
for (const [cat, c] of Object.entries(r.categories)) {
  const bad = c.auditRefs.filter((x) => x.weight > 0 && a[x.id].score !== null && a[x.id].score < 1).map((x) => `${x.id}(${x.weight}:${a[x.id].score})`);
  if (bad.length) console.log(`${cat} <1: ${bad.join(", ")}`);
}
const lcp = a["largest-contentful-paint-element"]?.details?.items ?? [];
console.log("LCP:", JSON.stringify(lcp.map((i) => (i.items ?? []).map((x) => (x.node ? x.node.snippet.slice(0, 90) : `${x.phase} ${Math.round(x.timing)}`)))).slice(0, 420));
const blocking = (a["render-blocking-resources"] ?? a["render-blocking-insight"])?.details?.items ?? [];
console.log("render-blocking:", JSON.stringify(blocking.map((i) => [i.url.slice(0, 70), i.totalBytes, i.wastedMs])));
const contrast = a["color-contrast"]?.details?.items ?? [];
if (contrast.length) console.log("contrast:", JSON.stringify(contrast.slice(0, 10).map((i) => i.node.snippet.slice(0, 110))));
