// M3: which fields each part kind's builder really reads (scene language v2, phase 1b).
// Reads the source of every kind in m2/parts.js (inline kinds and the ones imported from cityParts, clarityParts,
// vending, rig) and follows the helpers it hands its params to (rain(ctx, p) -> kit/weather.js), nesting one level per
// object field handed on (p.opts handed to arrows() -> opts.<field>). Prints, per kind, the fields read.
// Used to write m2/fields.js and to keep it honest (tests/cutawayLanguage.test.mjs runs the same scan).
//   node m3/fieldScan.mjs [--json out.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["m2/parts.js", "m2/cityParts.js", "m2/clarityParts.js", "m2/vending.js", "m2/rig.js", "kit/weather.js", "kit/overlay.js", "kit/fx.js", "kit/props.js", "kit/fill.js", "kit/pipe.js", "kit/sheet.js", "kit/digCut.js", "kit/models.js"];
const SRC = Object.fromEntries(FILES.filter((f) => fs.existsSync(path.join(ROOT, f))).map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]));
const IDENT = /^[A-Za-z_$][\w$]*$/;
const METHODS = new Set(["map", "length", "forEach", "slice", "every", "some", "filter", "find", "reduce", "flatMap", "includes", "indexOf", "concat", "join", "push", "split", "toLowerCase", "trim", "replace", "startsWith"]);

// the body of a brace block starting at index i (the "{")
function block(src, i) {
  let d = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  return src.slice(i);
}
// split on commas outside brackets: "ctx, { a = [1, 2], b }" -> ["ctx", " { a = [1, 2], b }"]
function topSplit(t) {
  const out = []; let d = 0, cur = "";
  for (const c of t) {
    if ("([{".includes(c)) d++;
    if (")]}".includes(c)) d--;
    if (c === "," && d === 0) { out.push(cur); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
// a parameter: a plain name, or a destructured object { a, b = 1, c: d } (its field names)
function param(s) {
  s = s.trim();
  if (s.startsWith("{")) return { fields: topSplit(s.slice(1, s.lastIndexOf("}"))).map((x) => x.trim().split(/[:=\s]/)[0]).filter((x) => IDENT.test(x)) };
  const m = /^[A-Za-z_$][\w$]*/.exec(s);
  return m ? m[0] : null;
}
// a function's parameters and body: "function name(a, b) {" or the method form "  name(a, b) {". A name the calling
// file imports is looked up in the file it comes from first (kit/weather.js's stream, not another file's stream).
function findFn(name, notBody = null, fromFile = null) {
  const imp = fromFile && SRC[fromFile] ? [...SRC[fromFile].matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)].find((m) => m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).includes(name)) : null;
  const first = imp ? path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, fromFile)), imp[2])).split(path.sep).join("/") : null;
  const order = Object.entries(SRC).sort(([a], [b]) => (b === first) - (a === first));
  for (const [file, src] of order) {
    const re = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:function\\s+)?${name}\\s*\\(((?:[^()]|\\([^()]*\\))*)\\)\\s*\\{`, "g");
    let m, body = null;
    while ((m = re.exec(src))) { body = block(src, m.index + m[0].length - 1); if (body !== notBody) break; }
    if (!m) continue;
    return { file, params: topSplit(m[1]).map(param), body };
  }
  return null;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// the fields read from variable v in body: v.x, v?.x, ...v.x, v["x"], const { a, b: c, d = 1 } = v; an object field
// held in a local (const o = v.opts ?? {}) reads as opts.<field>; helpers handed v or v.field are followed
function readsOf(body, v, prefix, out, depth, seen, file) {
  const V = esc(v);
  for (const m of body.matchAll(new RegExp(`(?:\\.\\.\\.|(?<![\\w$.]))${V}\\??\\.([A-Za-z_$][\\w$]*)(?![\\w$]|\\s*\\()`, "g"))) out.add(prefix + m[1]);
  for (const m of body.matchAll(new RegExp(`(?<![\\w$.])${V}\\??\\[\\s*["']([A-Za-z_$][\\w$]*)["']\\s*\\]`, "g"))) out.add(prefix + m[1]);
  for (const m of body.matchAll(new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*${V}(?![\\w$.?])`, "g")))
    for (const f of topSplit(m[1])) { const k = f.trim().split(/[:=\s]/)[0]; if (IDENT.test(k)) out.add(prefix + k); }
  for (const m of body.matchAll(new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${V}\\??\\.([A-Za-z_$][\\w$]*)\\s*(?:(?:\\?\\?|\\|\\|)\\s*\\{\\s*\\})?\\s*[,;\\n]`, "g")))
    readsOf(body, m[1], `${prefix}${m[2]}.`, out, depth, seen, file);
  if (depth <= 0) return;
  for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(((?:[^()]|\([^()]*\))*)\)/g)) {
    const [, fn, argText] = m;
    if (["if", "for", "while", "switch", "return", "function", "catch"].includes(fn)) continue;
    topSplit(argText).map((s) => s.trim()).forEach((a, i) => {
      const am = new RegExp(`^${V}(?:\\??\\.([A-Za-z_$][\\w$]*))?(?:\\s*(?:\\?\\?|\\|\\|)\\s*\\{\\s*\\})?$`).exec(a);
      if (!am) return;
      const pre = am[1] ? `${prefix}${am[1]}.` : prefix, key = `${fn}#${i}#${pre}`;
      if (seen.has(key)) return; seen.add(key);
      const h = findFn(fn, body, file), hp = h?.params?.[i];
      if (!hp) return;
      if (hp.fields) { for (const x of hp.fields) out.add(pre + x); return; }
      readsOf(h.body, hp, pre, out, depth - 1, seen, h.file);
    });
  }
}

/** kind -> the sorted field paths its builder reads ("opts.r" for a field of an object field), or null (no builder) */
export function scanKinds(kinds) {
  const res = {};
  for (const k of kinds) {
    const f = findFn(k);
    if (!f) { res[k] = null; continue; }
    const pv = typeof f.params[1] === "string" ? f.params[1] : "p", out = new Set();
    readsOf(f.body, pv, "", out, 3, new Set(), f.file);
    res[k] = [...out].filter((x) => !METHODS.has(x.split(".").at(-1))).sort();
  }
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { REGISTRY } = await import("../m2/language.js");
  const res = scanKinds(Object.keys(REGISTRY.kinds));
  const i = process.argv.indexOf("--json");
  if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(res, null, 1));
  for (const [k, f] of Object.entries(res)) console.log(`${k}: ${f ? f.join(", ") : "(builder not found)"}`);
}
