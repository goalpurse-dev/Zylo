// deno-lint-ignore-file no-explicit-any
// Phase 4a — contact sheet (self-contained HTML, images embedded as data URIs).
// Usage: npx -y deno@2.9.6 run -A scripts/phase4aContactSheet.ts
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const s = await read("docs/phase4/bakeoff-state.json");
const compiled = await read("docs/phase3/myth-vs-reality.prompts.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");

const BEATS = [117, 69, 7, 18, 12, 21, 57, 10, 111, 125];
const VIEWER = [117, 57, 10, 111];
const TEXT_BEATS = [117, 69, 21, 10];
const MODELS = [
  { key: "flux2-klein-9b-kv", label: "FLUX.2 [klein] 9B KV", id: "runware:400@6", role: "V2 candidate" },
  { key: "qwen-image-2512", label: "Qwen-Image-2512", id: "alibaba:qwen-image@2512", role: "V2 backup" },
  { key: "nano-banana-2-lite", label: "Nano Banana 2 Lite", id: "google:nano-banana@2-lite", role: "V3 candidate" },
  { key: "nano-banana-2", label: "Nano Banana 2", id: "google:4@3", role: "Quality benchmark" },
  { key: "recraft-v4", label: "Recraft V4", id: "recraft:v4@0", role: "V4 challenger" },
];
// Visual review by eye (the automated gpt-4o-mini QA runs at low detail and is noisy on style and fine text).
const EYE: Record<string, { text: string; consistency: string; note: string }> = {
  "flux2-klein-9b-kv": { text: "2/4", consistency: "High", note: "On-model viewer and cheapest by far, but weak on text: dropped MYTH on 117 and spelled 'Vickings' on 10. Adds flames nobody asked for." },
  "qwen-image-2512": { text: "4/4", consistency: "High", note: "Spells every string right, but misses concepts: 57 shows the viewer twice with no bar fight, 125 is unreadable." },
  "nano-banana-2-lite": { text: "4/4", consistency: "High", note: "Cleanest overall: all four strings right, the only correct 57 split besides Nano Banana 2, viewer on-model everywhere." },
  "nano-banana-2": { text: "4/4*", consistency: "High", note: "Close to Lite, not clearly better. *Beat 69 adds a second BAYREUTH on the marquee. Twice the price, about 2.6x slower." },
  "recraft-v4": { text: "4/4", consistency: "Medium", note: "Good text, but the style drifts: thicker lines, different faces, and wild results on 7 and 125. Slowest." },
};
const EYE_CMP: Record<number, string> = {
  117: "As good", 69: "Lite better (no duplicate text)", 7: "As good", 18: "As good", 12: "As good", 21: "Lite cleaner", 57: "As good", 10: "As good", 111: "As good", 125: "Both weak",
};

const CHECKS = [["flatStyle", "Style"], ["castPresent", "Cast"], ["viewerIdentity", "Viewer"], ["textRule", "Text"], ["noCollage", "Panels"], ["showsConcept", "Concept"]];
const med = (a: number[]) => { const x = [...a].sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function thumb(file: string, w = 800, q = 72) {
  const img = await Image.decode(await Deno.readFile(new URL(file, root)));
  img.resize(w, Image.RESIZE_AUTO);
  return `data:image/jpeg;base64,${encodeBase64(await img.encodeJPEG(q))}`;
}
async function crop(file: string, x: number, y: number, w: number, h: number, outW: number, q = 85) {
  const img = await Image.decode(await Deno.readFile(new URL(file, root)));
  img.crop(x, y, w, h);
  if (w !== outW) img.resize(outW, Image.RESIZE_AUTO, Image.RESIZE_NEAREST_NEIGHBOR);
  return `data:image/jpeg;base64,${encodeBase64(await img.encodeJPEG(q))}`;
}

const uri: Record<string, string> = {};
for (const k of Object.keys(s.renders)) if (s.renders[k].file) uri[k] = await thumb(s.renders[k].file);
const refUri = await thumb("docs/phase4/images/reference-viewer_viking.jpg", 320, 80);

// Upscale check: the same 640x360 region of the 1920x1080 final and of the original (enlarged, nearest-neighbour).
const UPSCALE_SAMPLES = ["A:flux2-klein-9b-kv:10", "A:nano-banana-2-lite:117", "A:recraft-v4:12"];
const upscaleRows: any[] = [];
for (const k of UPSCALE_SAMPLES) {
  const r = s.renders[k], u = s.upscales[k];
  const fin = await Image.decode(await Deno.readFile(new URL(u.file, root)));
  const orig = await Image.decode(await Deno.readFile(new URL(r.file, root)));
  const fx = 640, fy = 180, fw = 640, fh = 360;
  const scale = u.fit.scale * 2; // original px -> final px (2x upscale, then cover-fit scale)
  const ox = Math.round((fx + u.fit.cropX) / scale), oy = Math.round((fy + u.fit.cropY) / scale), ow = Math.round(fw / scale), oh = Math.round(fh / scale);
  upscaleRows.push({ k, model: r.model, seq: r.seq, orig: await crop(r.file, ox, oy, ow, oh, fw), fin: await crop(u.file, fx, fy, fw, fh, fw), origSize: `${orig.width}×${orig.height}`, finSize: `${fin.width}×${fin.height}`, cost: u.cost, latency: u.latencyMs });
}

const beatInfo = (seq: number) => {
  const b = retimed.beats.find((x: any) => x.sequence === seq);
  const p = compiled.prompts.find((x: any) => x.sequence === seq);
  const t = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  return { seq, time: t(b.startMs), narration: b.narrationText, summary: b.contract.userSummary, treatment: b.contract.treatment, text: p.textIntent, viewer: (b.contract.subjects ?? []).some((x: any) => x.castId === "viewer_viking") };
};

const summary = MODELS.map((m) => {
  const ks = BEATS.map((b) => `A:${m.key}:${b}`).filter((k) => s.renders[k]);
  const qs = ks.map((k) => s.qa[k]).filter(Boolean);
  const cost = ks.reduce((a, k) => a + s.renders[k].cost, 0) / ks.length;
  const up = ks.reduce((a, k) => a + (s.upscales[k]?.cost ?? 0), 0) / ks.length;
  return {
    ...m,
    passAll: qs.filter((q) => CHECKS.every(([c]) => q[c].pass)).length, n: qs.length,
    perCheck: Object.fromEntries(CHECKS.map(([c]) => [c, qs.filter((q) => q[c].pass).length])),
    autoText: `${TEXT_BEATS.filter((b) => s.qa[`A:${m.key}:${b}`]?.textRule.pass).length}/4`,
    autoConsistency: s.extra[`consistency:A:${m.key}`]?.score,
    latency: med(ks.map((k) => s.renders[k].latencyMs)),
    cost, up, perVideo: 150 * 1.15 * (cost + up),
  };
});

const total = [...Object.values(s.renders), ...Object.values(s.upscales), ...Object.values(s.qa), ...Object.values(s.extra)].reduce((a: number, r: any) => a + (Number(r?.cost) || 0), 0);
const spendRender = Object.values(s.renders).reduce((a: number, r: any) => a + r.cost, 0);
const spendUp = Object.values(s.upscales).reduce((a: number, r: any) => a + r.cost, 0);
const spendQa = total - spendRender - spendUp;

const badge = (q: any) => q ? `<div class="checks">${CHECKS.map(([c, l]) => `<span class="chk ${q[c].pass ? "ok" : "no"}" title="${esc(l)}: ${esc(q[c].note)}">${q[c].pass ? "✓" : "✕"} ${l}</span>`).join("")}</div>${q.readableText ? `<div class="read">Reads: “${esc(q.readableText)}”</div>` : ""}` : `<div class="checks"><span class="chk">no QA</span></div>`;
const cell = (k: string) => {
  const r = s.renders[k];
  if (!r) return `<td class="cell empty">—</td>`;
  if (r.error) return `<td class="cell empty">Failed: ${esc(r.error.slice(0, 120))}</td>`;
  return `<td class="cell"><button class="shot" data-full="${k}" aria-label="Enlarge ${esc(k)}"><img src="${uri[k]}" alt="${esc(k)}" loading="lazy"></button>${badge(s.qa[k])}<div class="meta mono">$${r.cost.toFixed(4)} · ${(r.latencyMs / 1000).toFixed(1)} s</div></td>`;
};
const beatHead = (seq: number, extra = "") => {
  const b = beatInfo(seq);
  return `<th class="beat" scope="row"><div class="bn">Beat ${seq} <span class="tag">${b.treatment}</span>${b.viewer ? ' <span class="tag viewer">viewer</span>' : ""}${b.text.mode === "SHORT_TEXT" ? ` <span class="tag txt">“${esc(b.text.text)}”</span>` : ""}</div><div class="nar">${b.time} · ‘${esc(b.narration)}’</div><div class="sum">${esc(b.summary)}</div>${extra}</th>`;
};

const html = `<title>Stickman Image Bake-off</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;700&family=Public+Sans:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{--paper:#F2F3F5;--panel:#FFFFFF;--ink:#1B1D22;--muted:#5D6470;--line:#D9DCE2;--accent:#2F5BD3;--ok:#1E7F4A;--okbg:#E3F3EA;--no:#B53A26;--nobg:#F8E4DF;--warn:#9A6412;--warnbg:#F6ECD9;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--ok:#6CCB94;--okbg:#1C3327;--no:#F08E7B;--nobg:#3A221D;--warn:#E3B462;--warnbg:#382C17;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--ok:#6CCB94;--okbg:#1C3327;--no:#F08E7B;--nobg:#3A221D;--warn:#E3B462;--warnbg:#382C17;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.5 "Public Sans",system-ui,sans-serif;padding-inline:16px;padding-block:24px 48px}
main{max-width:1500px;margin:0 auto;display:grid;gap:40px}
h1,h2,h3{font-family:"Archivo Narrow","Arial Narrow",system-ui,sans-serif;text-wrap:balance;margin:0;line-height:1.1}
h1{font-size:34px}h2{font-size:24px}h3{font-size:18px}
p{margin:0;max-width:72ch}.muted{color:var(--muted)}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:12.5px}
header{display:grid;gap:10px}
.facts{display:flex;flex-wrap:wrap;gap:8px 20px;color:var(--muted)}
.facts b{color:var(--ink)}
section{display:grid;gap:14px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid var(--line);vertical-align:top;text-align:left;padding:10px 12px}
thead th{font-family:"Archivo Narrow",system-ui,sans-serif;font-size:15px;position:sticky;top:0;background:var(--panel);z-index:1}
thead th small{display:block;font-family:"Public Sans",system-ui,sans-serif;font-weight:400;color:var(--muted);font-size:12px}
.sum-table td,.sum-table th{white-space:nowrap}.sum-table td.note{white-space:normal;min-width:280px;max-width:420px;font-size:13.5px}
.beat{min-width:210px;max-width:250px;font-weight:400}
.bn{font-weight:600;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.nar{font-size:13px;margin-top:4px}.sum{font-size:12.5px;color:var(--muted);margin-top:2px}
.tag{font-size:11px;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--line);border-radius:4px;padding:0 5px;color:var(--muted);font-weight:600}
.tag.viewer{color:var(--accent);border-color:var(--accent)}.tag.txt{text-transform:none;letter-spacing:0}
.cell{min-width:230px;width:230px}.cell.empty{color:var(--muted);font-size:13px}
.shot{display:block;padding:0;border:0;background:none;cursor:zoom-in;width:100%}
.shot img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;border:1px solid var(--line)}
.shot:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.checks{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.chk{font-size:11px;border-radius:3px;padding:1px 5px;background:var(--line);color:var(--muted);cursor:help}
.chk.ok{background:var(--okbg);color:var(--ok)}.chk.no{background:var(--nobg);color:var(--no)}
.read{font-size:11.5px;color:var(--muted);margin-top:4px}
.meta{margin-top:4px;color:var(--muted)}
.cmp{margin-top:8px;font-size:12px;display:grid;gap:2px}
.pill{display:inline-block;font-size:11.5px;border-radius:10px;padding:1px 8px;font-weight:600}
.p-good{background:var(--okbg);color:var(--ok)}.p-slight{background:var(--warnbg);color:var(--warn)}.p-bad{background:var(--nobg);color:var(--no)}
.callout{border-left:3px solid var(--accent);padding:10px 14px;background:var(--panel);border-radius:0 6px 6px 0}
.ups{display:grid;gap:18px}
.up{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.up figure{margin:0}.up img{width:100%;border-radius:4px;border:1px solid var(--line);image-rendering:auto}
.up figcaption{font-size:12.5px;color:var(--muted);margin-top:4px}
@media (max-width:640px){.up{grid-template-columns:1fr}h1{font-size:28px}}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,1400px)}
dialog::backdrop{background:rgba(10,12,16,.85)}
dialog img{display:block;max-width:100%;max-height:88vh;border-radius:6px}
dialog p{color:#E8EAEE;font-size:13px;margin-top:6px}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<main>
<header>
  <h1>Stickman image bake-off: Myth vs Reality</h1>
  <p class="muted">Ten compiled prompts, five models via Runware, text-to-image only. Every image was then upscaled 2× with Real-ESRGAN and cropped to exactly 1920×1080, and checked by gpt-4o-mini against its beat contract.</p>
  <div class="facts mono"><span>Total spend <b>$${total.toFixed(4)}</b></span><span>Renders <b>$${spendRender.toFixed(4)}</b> (54)</span><span>Upscales <b>$${spendUp.toFixed(4)}</b> (54)</span><span>QA and comparisons <b>$${spendQa.toFixed(4)}</b></span><span>Cap $2.20</span></div>
</header>

<section>
  <h2>Per-model summary</h2>
  <div class="callout"><p><b>How to read the QA columns.</b> The automated QA runs gpt-4o-mini at low image detail, which keeps it cheap but makes it noisy on style and fine text. It gave nearly every model 5/5 for consistency. The “by eye” columns come from a manual look at every image. Style fails everywhere for the same reason: all five models draw chunky cartoon people rather than stick limbs, likely because the canonical outfits (tunic, trousers, boots) pull them there. That is a prompt fix for Phase 4b.</p></div>
  <div class="scroll"><table class="sum-table">
    <thead><tr><th>Model</th><th>QA all checks<small>auto, of 10</small></th><th>Style / cast / concept<small>auto pass counts</small></th><th>Text<small>auto · by eye</small></th><th>Viewer consistency<small>auto 1–5 · by eye</small></th><th>Median latency</th><th>Cost / image<small>reported</small></th><th>+ upscale</th><th>150-scene video<small>+15% retries, + upscale</small></th><th>Notes</th></tr></thead>
    <tbody>${summary.map((m) => `<tr><th scope="row">${m.label}<small>${m.role} · <span class="mono">${m.id}</span></small></th><td class="mono">${m.passAll}/${m.n}</td><td class="mono">${m.perCheck.flatStyle} / ${m.perCheck.castPresent} / ${m.perCheck.showsConcept}</td><td class="mono">${m.autoText} · ${EYE[m.key].text}</td><td class="mono">${m.autoConsistency} · ${EYE[m.key].consistency}</td><td class="mono">${(m.latency / 1000).toFixed(1)} s</td><td class="mono">$${m.cost.toFixed(5)}</td><td class="mono">$${m.up.toFixed(4)}</td><td class="mono"><b>$${m.perVideo.toFixed(2)}</b></td><td class="note">${esc(EYE[m.key].note)}</td></tr>`).join("")}</tbody>
  </table></div>
</section>

<section>
  <h2>Round A: no reference images</h2>
  <p class="muted">Rows are the ten beats; the last column compares Nano Banana 2 Lite with Nano Banana 2 (automated verdict, then by eye). Hover a badge for the QA note; click an image to enlarge it.</p>
  <div class="scroll"><table>
    <thead><tr><th>Beat</th>${MODELS.map((m) => `<th>${m.label}<small>${m.role}</small></th>`).join("")}<th>Lite vs Nano Banana 2</th></tr></thead>
    <tbody>${BEATS.map((b) => {
      const c = s.extra[`cmp:${b}`];
      const cls = c?.verdict === "as good" ? "p-good" : c?.verdict === "slightly worse" ? "p-slight" : "p-bad";
      return `<tr>${beatHead(b)}${MODELS.map((m) => cell(`A:${m.key}:${b}`)).join("")}<td class="cmp" style="min-width:170px"><span><span class="pill ${cls}">${esc(c?.verdict ?? "—")}</span> <span class="muted">auto</span></span><span class="muted">${esc(c?.note ?? "")}</span><span><b>By eye:</b> ${esc(EYE_CMP[b])}</span></td></tr>`;
    }).join("")}</tbody>
  </table></div>
</section>

<section>
  <h2>Round B: one character reference (Nano Banana 2 Lite)</h2>
  <div class="callout"><p><b>Verdict: the reference adds little here.</b> Nano Banana 2 Lite already kept the viewer on-model without it (by eye, and 5/5 automated consistency with and without). With the reference there is no leakage: no copied pose or background and no sheet or collage look. Cost is unchanged ($${(VIEWER.reduce((a, b) => a + s.renders[`B:nano-banana-2-lite:${b}`].cost, 0) / 4).toFixed(4)} vs $${(VIEWER.reduce((a, b) => a + s.renders[`A:nano-banana-2-lite:${b}`].cost, 0) / 4).toFixed(4)} per image), and median latency is higher. Four beats is thin evidence; a longer episode with more outfit changes is the real test.</p></div>
  <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><img src="${refUri}" alt="Reference crop" style="width:120px;border:1px solid var(--line);border-radius:4px"><p class="muted" style="font-size:13px">Reference: a crop of the viewer from Round A Nano Banana 2 Lite, beat ${esc(s.extra.reference.from.split(":")[2])} (the best-scoring single-character viewer image), passed as <span class="mono">inputs.referenceImages</span>.</p></div>
  <div class="scroll"><table>
    <thead><tr><th>Beat</th><th>Lite, no reference<small>Round A</small></th><th>Lite + reference<small>Round B</small></th><th>Nano Banana 2<small>benchmark</small></th></tr></thead>
    <tbody>${VIEWER.map((b) => `<tr>${beatHead(b)}${cell(`A:nano-banana-2-lite:${b}`)}${cell(`B:nano-banana-2-lite:${b}`)}${cell(`A:nano-banana-2:${b}`)}</tr>`).join("")}</tbody>
  </table></div>
</section>

<section>
  <h2>Upscale check: Real-ESRGAN 2× then 1920×1080</h2>
  <div class="callout"><p><b>Verdict: keep it on for every tier.</b> All 54 images upscaled without a failure at <span class="mono">$0.0006</span> each (Runware-reported), median <span class="mono">${(med(Object.values(s.upscales).map((u: any) => u.latencyMs)) / 1000).toFixed(1)} s</span>. The 1920×1080 cover-crop trims 15 px of width from 1376×768 renders and 17 px of height from Recraft’s 1344×768. Below, the same 640×360 region at final size: the original enlarged pixel-for-pixel on the left, the upscaled result on the right.</p></div>
  <div class="ups">${upscaleRows.map((u) => `<div><h3>${esc(MODELS.find((m) => m.key === u.model)!.label)}, beat ${u.seq}</h3><div class="up"><figure><img src="${u.orig}" alt="Original crop"><figcaption>Original ${u.origSize}, enlarged to the final scale</figcaption></figure><figure><img src="${u.fin}" alt="Upscaled crop"><figcaption>Upscaled and cropped to ${u.finSize} · <span class="mono">$${u.cost.toFixed(4)} · ${(u.latency / 1000).toFixed(1)} s</span></figcaption></figure></div></div>`).join("")}</div>
</section>
</main>
<dialog id="lb"><img id="lbImg" alt=""><p id="lbCap"></p></dialog>
<script>
const lb=document.getElementById('lb'),li=document.getElementById('lbImg'),lc=document.getElementById('lbCap');
document.querySelectorAll('.shot').forEach(b=>b.addEventListener('click',()=>{li.src=b.querySelector('img').src;lc.textContent=b.dataset.full;lb.showModal();}));
lb.addEventListener('click',()=>lb.close());
</script>`;
await Deno.writeTextFile(new URL("docs/phase4/contact-sheet.html", root), html);
console.log(`contact sheet: ${(html.length / 1e6).toFixed(2)} MB, total spend $${total.toFixed(4)}`);
