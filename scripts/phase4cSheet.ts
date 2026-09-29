// deno-lint-ignore-file no-explicit-any
// Phase 4c — FLUX V2 tuning contact sheet (self-contained HTML, embedded images).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const s = await read("docs/phase4/flux-tune-state.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const uri = async (file: string, w: number | null, crop?: [number, number, number, number], q = 74) => {
  const img = await Image.decode(await Deno.readFile(new URL(file, root)));
  if (crop) img.crop(...crop);
  if (w) img.resize(w, Image.RESIZE_AUTO);
  return `data:image/jpeg;base64,${encodeBase64(await img.encodeJPEG(q))}`;
};
const V = [
  { key: "a", label: "KV · 4 steps", sub: "1376×768 + Real-ESRGAN 2×", verdict: "Chunkier bodies, duplicate shields on 7, 10 and 111, and flames on 111. Clean lines after upscaling." },
  { key: "b", label: "KV · 8 steps", sub: "1376×768 + Real-ESRGAN 2×", verdict: "Winner. One shield on 7, 111 and 117 (two on 10), no flames anywhere, viewer on-model, clean thin limbs, sharp lines.", win: true },
  { key: "c", label: "9B Base · 28 steps", sub: "1376×768 + Real-ESRGAN 2×", verdict: "Thinnest, most stick-like limbs and no duplicates, but it drew the viewer bald on 117 and takes 14–29 s at 2.5× the price." },
  { key: "d", label: "KV · 2048×1152 native", sub: "4 steps, no upscale", verdict: "No upscale needed, but it gave the viewer grey filled sleeves (the chunky-limb failure), duplicate shields and flames on 111, and slightly wobblier lines." },
];
const BEATS = [7, 10, 111, 117];
const BEAT_NOTES: Record<number, string> = { 7: "Symbolic recipe: thought bubble", 10: "Text via overlay", 111: "Callback; concept mentions firelight, so fire is not negated", 117: "Two cast, layout" };
const cells: Record<string, string> = {};
for (const v of V) for (const b of BEATS) cells[`${v.key}:${b}`] = await uri(s.runs[`${v.key}:${b}`].file, 720);
const crops: Record<string, string> = {};
for (const v of V) crops[v.key] = await uri(s.runs[`${v.key}:111`].file, null, [700, 330, 520, 300], 90);
const med = (a: number[]) => { const x = [...a].sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
const stats = V.map((v) => {
  const rs = BEATS.map((b) => s.runs[`${v.key}:${b}`]);
  const render = rs.reduce((a, r) => a + r.renderCost, 0) / rs.length, up = rs.reduce((a, r) => a + r.upscaleCost, 0) / rs.length;
  return { ...v, render, up, total: render + up, perVideo: 150 * 1.15 * (render + up), latency: med(rs.map((r) => r.latencyMs)) };
});
const spent = Object.values(s.runs).reduce((a: number, r: any) => a + r.renderCost + r.upscaleCost, 0);
const nar = (b: number) => retimed.beats.find((x: any) => x.sequence === b).narrationText;

const html = `<title>FLUX V2 Tuning</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;700&family=Public+Sans:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{--paper:#F2F3F5;--panel:#FFFFFF;--ink:#1B1D22;--muted:#5D6470;--line:#D9DCE2;--accent:#2F5BD3;--accentbg:#E6ECFB;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--accentbg:#222B45;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--accentbg:#222B45;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.5 "Public Sans",system-ui,sans-serif;padding-inline:16px;padding-block:24px 48px}
main{max-width:1400px;margin:0 auto;display:grid;gap:32px}
h1,h2{font-family:"Archivo Narrow","Arial Narrow",system-ui,sans-serif;text-wrap:balance;margin:0;line-height:1.1}h1{font-size:34px}h2{font-size:24px}
p{margin:0;max-width:78ch}.muted{color:var(--muted)}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:12.5px}
header,section{display:grid;gap:12px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--line);text-align:left;vertical-align:top;padding:9px 12px}
thead th{font-family:"Archivo Narrow",system-ui,sans-serif;font-size:15px}thead th small{display:block;font-family:"Public Sans",system-ui,sans-serif;font-weight:400;color:var(--muted);font-size:12px}
tr.win{background:var(--accentbg)}
.badge{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:var(--accent);color:var(--panel);border-radius:4px;padding:1px 6px;margin-left:6px}
.cell{min-width:240px}.cell img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;border:1px solid var(--line);cursor:zoom-in;display:block}
th.win,td.win{background:var(--accentbg)}
.beat{min-width:170px;max-width:220px;font-weight:400;font-size:13px}.beat b{display:block;font-size:14px}
.crops{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:900px){.crops{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.crops{grid-template-columns:1fr}}
figure{margin:0;display:grid;gap:4px}figure img{width:100%;border-radius:4px;border:1px solid var(--line)}figure.win img{border:2px solid var(--accent)}figcaption{font-size:12.5px;color:var(--muted)}
.callout{border-left:3px solid var(--accent);padding:10px 14px;background:var(--panel);border-radius:0 6px 6px 0}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,1400px)}dialog::backdrop{background:rgba(10,12,16,.85)}dialog img{display:block;max-width:100%;max-height:90vh;border-radius:6px}
img:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
<main>
<header>
  <h1>FLUX V2 tuning: four settings, four beats</h1>
  <p class="muted">FLUX.2 [klein] on the V2 pipeline: text as a code overlay, “flames, fire” added to the negative prompt unless the concept mentions fire, and a final 1920×1080 image. Judged by eye on stickman fidelity, viewer consistency, clutter or duplicate artifacts, and line sharpness.</p>
  <p class="mono muted">Spend <b style="color:var(--ink)">$${spent.toFixed(4)}</b> of the $0.10 cap · 16 renders, 12 upscales</p>
</header>

<section>
  <h2>Summary</h2>
  <div class="callout"><p><b>New V2 config: klein 9B KV at 8 steps, plus the Real-ESRGAN upscale.</b> It costs $${stats[1].total.toFixed(5)} per image including upscaling, or about $${stats[1].perVideo.toFixed(2)} for a 150-scene video with 15% retries (plus about $0.38 if V2 runs QA).</p></div>
  <div class="scroll"><table>
    <thead><tr><th>Variant</th><th>Render</th><th>Upscale</th><th>Per image<small>incl. upscale</small></th><th>150-scene video<small>+15% retries</small></th><th>Median latency</th><th>Verdict (by eye)</th></tr></thead>
    <tbody>${stats.map((v) => `<tr class="${v.win ? "win" : ""}"><th scope="row">(${v.key}) ${esc(v.label)}${v.win ? '<span class="badge">V2</span>' : ""}<br><span class="muted" style="font-weight:400;font-size:12.5px">${esc(v.sub)}</span></th><td class="mono">$${v.render.toFixed(5)}</td><td class="mono">$${v.up.toFixed(4)}</td><td class="mono"><b>$${v.total.toFixed(5)}</b></td><td class="mono">$${v.perVideo.toFixed(2)}</td><td class="mono">${(v.latency / 1000).toFixed(1)} s</td><td style="min-width:280px;font-size:13.5px">${esc(v.verdict)}</td></tr>`).join("")}</tbody>
  </table></div>
</section>

<section>
  <h2>Renders</h2>
  <p class="muted">Click an image to enlarge it.</p>
  <div class="scroll"><table>
    <thead><tr><th>Beat</th>${V.map((v) => `<th class="${v.win ? "win" : ""}">(${v.key}) ${esc(v.label)}<small>${esc(v.sub)}</small></th>`).join("")}</tr></thead>
    <tbody>${BEATS.map((b) => `<tr><th class="beat" scope="row"><b>Beat ${b}</b>${esc(BEAT_NOTES[b])}<br><span class="muted">‘${esc(nar(b))}’</span></th>${V.map((v) => `<td class="cell ${v.win ? "win" : ""}"><img src="${cells[`${v.key}:${b}`]}" alt="Variant ${v.key}, beat ${b}" tabindex="0"><div class="mono muted" style="margin-top:4px">$${(s.runs[`${v.key}:${b}`].renderCost + s.runs[`${v.key}:${b}`].upscaleCost).toFixed(5)} · ${(s.runs[`${v.key}:${b}`].latencyMs / 1000).toFixed(1)} s</div></td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>
</section>

<section>
  <h2>Line sharpness at full resolution</h2>
  <p class="muted">The same 520×300 region of each final 1920×1080 image (beat 111), shown pixel for pixel.</p>
  <div class="crops">${V.map((v) => `<figure class="${v.win ? "win" : ""}"><img src="${crops[v.key]}" alt="Crop, variant ${v.key}"><figcaption>(${v.key}) ${esc(v.label)} · ${esc(v.sub)}</figcaption></figure>`).join("")}</div>
</section>
</main>
<dialog id="lb"><img id="lbImg" alt=""></dialog>
<script>
const lb=document.getElementById('lb'),li=document.getElementById('lbImg');
document.querySelectorAll('.cell img').forEach(i=>{const open=()=>{li.src=i.src;li.alt=i.alt;lb.showModal();};i.addEventListener('click',open);i.addEventListener('keydown',e=>{if(e.key==='Enter')open();});});
lb.addEventListener('click',()=>lb.close());
</script>`;
await Deno.writeTextFile(new URL("docs/phase4/flux-tune.html", root), html);
console.log(`${(html.length / 1e6).toFixed(2)} MB · $${spent.toFixed(4)} · b per image $${stats[1].total.toFixed(5)} · per video $${stats[1].perVideo.toFixed(2)}`, JSON.stringify(stats.map((v) => [v.key, v.total.toFixed(5), v.perVideo.toFixed(2), v.latency])));
