// Builds a self-contained results page (Zyvo "Home Polish" style: dark ground,
// lime accent, stat tiles, captioned media cards, decisions at the bottom) for
// the AI Fruit Story Phase 3 checkpoints. Images are embedded as data URIs
// (artifact pages can't load external images); videos are referenced by a
// relative path and published alongside the page.
//
// spec: {title, intro, stats:[{value, label, tone?}], sections:[{heading, text?, html? (raw block, e.g. a table), layout?: "grid"|"list",
//        cards:[{image?: localPathOrUrl, video?: relPath, title, tone?, body?: [lines], meta?: [[k,v]], prompt?, note?}]}],
//        decisions:[string]}
import fs from "fs";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function dataUri(src, mime = "image/jpeg") {
  const buf = /^https?:/.test(src) ? Buffer.from(await (await fetch(src)).arrayBuffer()) : fs.readFileSync(src);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function card(c) {
  const media = c.video
    ? `<video src="${esc(c.video)}" controls playsinline preload="metadata"></video>`
    : c.image ? `<img alt="${esc(c.title)}" src="${c.image.startsWith("data:") ? c.image : await dataUri(c.image)}">` : "";
  const strip = c.stripUri ? `<img class="strip" alt="Frames every 0.5 s: ${esc(c.title)}" src="${c.stripUri}">` : "";
  const body = (c.body ?? []).map((l) => `<li>${l}</li>`).join("");
  const meta = (c.meta ?? []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  return `<figure class="card${c.tone ? ` ${c.tone}` : ""}">${media ? `<div class="media">${media}</div>` : ""}${strip ? `<div class="media stripbox">${strip}<span>frames every 0.5 s</span></div>` : ""}
<figcaption><b>${esc(c.title)}</b>${body ? `<ul class="lines">${body}</ul>` : ""}${meta ? `<dl>${meta}</dl>` : ""}${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}${c.prompt ? `<details open><summary>Exact prompt sent (${c.prompt.length} chars)</summary><pre>${esc(c.prompt)}</pre></details>` : ""}</figcaption></figure>`;
}

export async function renderResultsPage(spec) {
  const stats = spec.stats.map((s) => `<div class="stat${s.tone ? ` ${s.tone}` : ""}"><b>${esc(s.value)}</b>${esc(s.label)}</div>`).join("");
  const sections = [];
  for (const s of spec.sections) {
    const cards = [];
    for (const c of s.cards ?? []) cards.push(await card(c));
    sections.push(`<section><h2>${esc(s.heading)}</h2>${s.text ? `<p>${s.text}</p>` : ""}${s.html ? `<div class="htmlblock">${s.html}</div>` : ""}${cards.length ? `<div class="${s.layout === "list" ? "list" : "grid"}">${cards.join("\n")}</div>` : ""}</section>`);
  }
  const decisions = (spec.decisions ?? []).map((d) => `<li>${d}</li>`).join("");
  return `<title>${esc(spec.title)}</title>
<style>
:root{color-scheme:dark;--ground:#090A0A;--panel:#101312;--line:rgba(255,255,255,.10);--text:#F4F6FB;--muted:rgba(244,246,251,.60);--lime:#BEF264;--warn:#FBBF24;--bad:#F87171;--ui:system-ui,-apple-system,"Segoe UI",Roboto,Avenir,Helvetica,Arial,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);font-family:var(--ui)}
.wrap{max-width:1500px;margin:0 auto;padding-inline:20px;padding-block:26px 60px}
h1{margin:0;font-size:24px;font-weight:900;letter-spacing:-.02em;text-wrap:balance}
h2{margin:34px 0 6px;font-size:16px;font-weight:800}
p{margin:0 0 10px;color:var(--muted);font-size:13px;line-height:1.55;max-width:75ch}
p b,li b{color:var(--text)}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 4px}
.stat{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:10px 14px;font-size:12.5px;color:var(--muted)}
.stat b{display:block;font-size:20px;color:var(--text);font-variant-numeric:tabular-nums}
.stat.good b{color:var(--lime)}.stat.warn b{color:var(--warn)}.stat.bad b{color:var(--bad)}
.grid{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.grid .card{flex:1 1 340px;max-width:470px}
.list{display:flex;flex-direction:column;gap:14px}
.card{margin:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:10px;min-width:0}
.card.good{border-color:rgba(190,242,100,.45)}.card.warn{border-color:rgba(251,191,36,.5)}.card.bad{border-color:rgba(248,113,113,.55)}
.media{border-radius:8px;overflow:hidden;background:#050606}
.media img,.media video{display:block;width:100%;height:auto;max-height:640px;object-fit:contain;margin:0 auto}
.stripbox{margin-top:8px;position:relative}.stripbox span{position:absolute;right:6px;bottom:6px;font-size:10.5px;color:var(--text);background:rgba(0,0,0,.6);padding:1px 6px;border-radius:6px}
figcaption{margin-top:9px;font-size:12.5px;color:var(--muted);line-height:1.5}
figcaption>b{display:block;color:var(--text);font-size:13.5px;margin-bottom:4px}
.lines{margin:6px 0 8px;padding-left:18px}.lines li{margin:3px 0;color:var(--text)}
.lines li i{color:var(--muted);font-style:normal}
dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:6px 0}
dl div{display:contents}dt{color:var(--muted)}dd{margin:0;color:var(--text);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.note{color:var(--warn);margin:6px 0 0}
details{margin-top:8px}summary{cursor:pointer;color:var(--lime);font-size:12px}
summary:focus-visible{outline:2px solid var(--lime);outline-offset:2px}
pre{margin:6px 0 0;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#0B0D0C;color:var(--text);font:11.5px/1.5 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}
.htmlblock{margin:10px 0 14px;overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.htmlblock table{border-collapse:collapse;width:100%;min-width:640px;font-size:12.5px;font-variant-numeric:tabular-nums}
.htmlblock th,.htmlblock td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.htmlblock th:first-child,.htmlblock td:first-child{text-align:left;white-space:normal}
.htmlblock th{color:var(--muted);font-weight:700;font-size:11.5px}
.htmlblock td.bad{color:var(--bad);font-weight:800}.htmlblock tr.group td{background:rgba(255,255,255,.03);color:var(--text);font-weight:800;text-align:left}
.htmlblock .sub{color:var(--muted);font-size:11px}
.decisions{margin-top:34px;border:1px solid rgba(190,242,100,.35);border-radius:12px;background:var(--panel);padding:14px 18px}
.decisions h2{margin-top:0;color:var(--lime)}
.decisions ol{margin:0;padding-left:20px;color:var(--text);font-size:13.5px;line-height:1.65}
</style>
<div class="wrap"><h1>${esc(spec.title)}</h1>
${spec.intro ? `<p>${spec.intro}</p>` : ""}
<div class="stats">${stats}</div>
${sections.join("\n")}
${decisions ? `<div class="decisions"><h2>Decisions for you</h2><ol>${decisions}</ol></div>` : ""}
</div>`;
}
