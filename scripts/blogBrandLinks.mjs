// $0, READ-ONLY by default: brand links in the blog posts (anchor text that is
// just the brand: "Zyvo", "ZyvoAI", "Zyvo AI", "TryZyvo" ...) and where they
// point. With --fix, every one that doesn't point at the homepage is set to "/".
// Tool links ("Try the image generator" -> its tool page) are never touched.
//   node scripts/blogBrandLinks.mjs [--fix]
import fs from "node:fs";
import path from "node:path";

const FIX = process.argv.includes("--fix");
const ROOTS = ["src/app/blog", "src/pages/blog", "src/components/blog", "src/data"];
const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(jsx?|tsx?)$/.test(e.name) ? [path.join(dir, e.name).replace(/\\/g, "/")] : [])) : []);
// <Link to="X" ...>TEXT</Link> and <a href="X" ...>TEXT</a>, across lines.
const ANCHOR = /<(Link|a)\b([^>]*?)\b(to|href)=(\{?)(["'`])([^"'`]*)\5(\}?)([^>]*)>([\s\S]*?)<\/\1>/g;
const text = (inner) => inner.replace(/\{\s*["'`]([^"'`]*)["'`]\s*\}/g, "$1").replace(/<[^>]+>/g, " ").replace(/\{[^}]*\}/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
// Brand-only anchor text.
const BRAND = /^(try\s?zyvo|zyvo\s?ai|zyvo|zyvo\.ai|tryzyvo\.com|zylo\s?ai|zylo)(['’]s)?( ai)?$/i;
const isHome = (url) => /^(\/|https?:\/\/(www\.)?tryzyvo\.com\/?)$/.test(url);
const table = {}, changed = {};
let total = 0, fixed = 0;
for (const file of ROOTS.flatMap(walk)) {
  const raw = fs.readFileSync(file, "utf8");
  let out = raw;
  out = out.replace(ANCHOR, (whole, tag, pre, attr, ob, q, url, cb, post, inner) => {
    const t = text(inner);
    if (!BRAND.test(t)) return whole;
    total += 1;
    const key = `${t}  ->  ${url}`;
    table[key] = (table[key] ?? 0) + 1;
    if (isHome(url) && url !== "https://tryzyvo.com" && url !== "https://tryzyvo.com/") return whole;
    if (!FIX) return whole;
    fixed += 1;
    changed[file] = (changed[file] ?? 0) + 1;
    const home = tag === "a" ? "https://www.tryzyvo.com/" : "/";
    return `<${tag}${pre}${attr}=${ob}${q}${home}${q}${cb}${post}>${inner}</${tag}>`;
  });
  if (FIX && out !== raw) fs.writeFileSync(file, out);
}
console.log(`brand links: ${total}${FIX ? `, fixed: ${fixed} in ${Object.keys(changed).length} files` : ""}`);
for (const [k, v] of Object.entries(table).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
