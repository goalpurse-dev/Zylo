// deno-lint-ignore-file no-explicit-any
// Phase 4c — contact sheet for the full V2 image set (every beat, in order).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const st = await read("docs/phase4/fullset/state.json");
const plan = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase4c3.json");
const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const rows = (Object.values(st.beats) as any[]).sort((a, b) => a.seq - b.seq);
const thumbs: Record<number, string> = {};
for (const r of rows) {
  if (!r.files?.preview) continue;
  const img = await Image.decode(await Deno.readFile(new URL(r.files.preview, root)));
  img.resize(480, Image.RESIZE_AUTO);
  thumbs[r.seq] = `data:image/jpeg;base64,${encodeBase64(await img.encodeJPEG(70))}`;
}
const cost = rows.reduce((s, r) => s + r.cost, 0);
const lat = rows.map((r) => r.renderLatencyMs).sort((a, b) => a - b);
const wall = Math.round((st.finishedAt - st.startedAt) / 1000);
const overlays = rows.filter((r) => r.overlay).length;
const warned = rows.filter((r) => (r.warnings ?? []).length).length;
const s = plan.stats ?? {};

const card = (r: any) => {
  const flags = [
    r.failed ? `<span class="flag bad">Failed${r.error ? `: ${esc(r.error.slice(0, 60))}` : ""}</span>` : "",
    r.retries ? `<span class="flag warn">Retried ${r.retries}×</span>` : "",
    r.overlay ? `<span class="flag">Text layer: “${esc(r.overlay.text)}”${r.overlay.band === "bottom" ? " · bottom" : ""}${r.overlay.darkBand ? " · dark band" : ""}</span>` : "",
    ...(r.warnings ?? []).map((w: any) => `<span class="flag soft" title="${esc(w.message)}">${esc(w.code)}</span>`),
  ].filter(Boolean).join("");
  return `<article class="beat" id="b${r.seq}">
  ${thumbs[r.seq] ? `<img src="${thumbs[r.seq]}" alt="Beat ${r.seq}" loading="lazy" tabindex="0">` : `<div class="noimg">No image</div>`}
  <div class="cap"><div class="head"><b>Beat ${r.seq}</b> · <span class="mono">${fmt(r.startMs)}</span> <span class="tr">${esc(r.treatment)}</span></div>
  <p>‘${esc(r.narration)}’</p>
  ${flags ? `<div class="flags">${flags}</div>` : ""}</div>
</article>`;
};

const html = `<title>Myth vs Reality V2 Frames</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;700&family=Public+Sans:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{--paper:#F2F3F5;--panel:#FFFFFF;--ink:#1B1D22;--muted:#5D6470;--line:#D9DCE2;--accent:#2F5BD3;--accentbg:#E6ECFB;--bad:#B53A26;--badbg:#F8E4DF;--warn:#9A6412;--warnbg:#F6ECD9;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--accentbg:#222B45;--bad:#F08E7B;--badbg:#3A221D;--warn:#E3B462;--warnbg:#382C17;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--accentbg:#222B45;--bad:#F08E7B;--badbg:#3A221D;--warn:#E3B462;--warnbg:#382C17;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.5 "Public Sans",system-ui,sans-serif;padding-inline:16px;padding-block:24px 48px}
main{max-width:1500px;margin:0 auto;display:grid;gap:28px}
h1{font-family:"Archivo Narrow","Arial Narrow",system-ui,sans-serif;font-size:34px;line-height:1.1;margin:0;text-wrap:balance}
p{margin:0}.muted{color:var(--muted)}.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:12.5px}
header{display:grid;gap:10px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.fact{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.fact b{display:block;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:18px;font-variant-numeric:tabular-nums}
.fact span{font-size:12.5px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.beat{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
.beat img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;cursor:zoom-in}
.beat img:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.noimg{aspect-ratio:16/9;display:grid;place-items:center;background:var(--badbg);color:var(--bad)}
.cap{padding:8px 10px 10px;display:grid;gap:5px}
.head{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;font-size:13.5px}
.tr{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 5px}
.cap p{font-size:13px}
.flags{display:flex;flex-wrap:wrap;gap:4px}
.flag{font-size:11px;border-radius:3px;padding:1px 6px;background:var(--accentbg);color:var(--accent)}
.flag.bad{background:var(--badbg);color:var(--bad)}.flag.warn{background:var(--warnbg);color:var(--warn)}.flag.soft{background:transparent;border:1px solid var(--line);color:var(--muted);cursor:help}
.callout{border-left:3px solid var(--accent);padding:10px 14px;background:var(--panel);border-radius:0 6px 6px 0;max-width:90ch}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,1400px)}dialog::backdrop{background:rgba(10,12,16,.85)}dialog img{display:block;max-width:100%;max-height:90vh;border-radius:6px}dialog p{color:#E8EAEE;font-size:13px;margin-top:6px}
</style>
<main>
<header>
  <h1>Myth vs Reality: every V2 frame, in order</h1>
  <p class="muted">The full beat plan (Claude Sonnet 5 director on the real voice timings) rendered on the V2 tier: FLUX.2 [klein] 9B KV at 8 steps, free code checks with one retry, Real-ESRGAN 2× to 1920×1080, and on-screen text as an editable overlay layer. Thumbnails are 480 px; click to enlarge.</p>
  <div class="facts">
    <div class="fact"><b>${rows.length}</b><span>beats · ${fmt(rows.at(-1).endMs)} of narration</span></div>
    <div class="fact"><b>${rows.filter((r) => r.failed).length} / ${rows.reduce((a, r) => a + (r.retries ?? 0), 0)}</b><span>failures / code-check retries</span></div>
    <div class="fact"><b>$${cost.toFixed(3)}</b><span>images incl. upscale (director $${Number(plan.costUsd).toFixed(3)})</span></div>
    <div class="fact"><b>${(lat[Math.floor(lat.length / 2)] / 1000).toFixed(1)} s</b><span>median render latency</span></div>
    <div class="fact"><b>${Math.floor(wall / 60)}m ${wall % 60}s</b><span>wall-clock for all images (6 at a time)</span></div>
    <div class="fact"><b>${overlays}</b><span>text overlays (editable layers)</span></div>
  </div>
  <div class="callout"><p><b>What to look for.</b> ${warned} beats carry a director warning (grey tags, hover for the note): mostly names the image can’t show, concepts without a visual device, crowds without a group, and a few repeated subjects. Only a sample of frames has been reviewed by eye; the rest passed the free code checks (decodes, size, not blank), not an image-quality review.</p></div>
</header>
<section class="grid">${rows.map(card).join("")}</section>
</main>
<dialog id="lb"><img id="lbImg" alt=""><p id="lbCap"></p></dialog>
<script>
const lb=document.getElementById('lb'),li=document.getElementById('lbImg'),lc=document.getElementById('lbCap');
document.querySelectorAll('.beat img').forEach(i=>{const open=()=>{li.src=i.src;lc.textContent=i.closest('.beat').querySelector('.cap p').textContent;lb.showModal();};i.addEventListener('click',open);i.addEventListener('keydown',e=>{if(e.key==='Enter')open();});});
lb.addEventListener('click',()=>lb.close());
</script>`;
await Deno.writeTextFile(new URL("docs/phase4/fullset.html", root), html);
console.log(`${(html.length / 1e6).toFixed(2)} MB · ${rows.length} beats · $${cost.toFixed(4)} · warned ${warned} · overlays ${overlays}`);
