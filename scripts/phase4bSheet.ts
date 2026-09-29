// deno-lint-ignore-file no-explicit-any
// Phase 4b — before/after contact sheet (self-contained HTML, embedded images).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { STICKMAN_RENDER_TIERS, STICKMAN_QA } from "../supabase/functions/_shared/stickman/renderTiers.ts";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const a = await read("docs/phase4/bakeoff-state.json");
const v = await read("docs/phase4/verify-4b-state.json");
const cal = await read("docs/phase4/qa-calibration-state.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const concepts = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase4b-concepts.json");

const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
async function thumb(file: string, w = 760, q = 72) {
  const img = await Image.decode(await Deno.readFile(new URL(file, root)));
  img.resize(w, Image.RESIZE_AUTO);
  return `data:image/jpeg;base64,${encodeBase64(await img.encodeJPEG(q))}`;
}
const BEATS: [number, string, string][] = [
  [7, "Concept recipe: SYMBOLIC", "Before, every model drew a stickman wearing a helmet. Now the viewer has a thought bubble containing the helmet, on both tiers."],
  [69, "Concept recipe: ESTABLISHING", "The opera house facade is now the subject. V3 renders “BAYREUTH, 1876” itself (OCR-checked); V2 leaves the marquee blank and the text is overlaid in code."],
  [125, "Concept recipe: POV", "Before, both models produced confusing close-ups. Now the viewer’s hands hold a lunchbox in the foreground, with a horned mascot on a stadium banner in the middle distance."],
  [117, "Style fix", "Arms and legs are thin stick lines now, not trousers and boots. The ‘labeled MYTH’ phrase was stripped in this per-beat compile, so both tiers correctly render no text."],
  [10, "Style fix + text", "The viewer’s legs are stick lines on both tiers. V3 spells the question right; V2 (FLUX) gets it from the overlay, so no more ‘Vickings’."],
  [111, "Style fix (callback)", "The viewer wears the horned helmet. On V2 the legs are clearly stick lines; FLUX still adds flames to the horns, as the firelight concept invites."],
];
const img: Record<string, string> = {};
for (const [b] of BEATS) {
  img[`A-lite-${b}`] = await thumb(a.renders[`A:nano-banana-2-lite:${b}`].file);
  img[`A-flux-${b}`] = await thumb(a.renders[`A:flux2-klein-9b-kv:${b}`].file);
  img[`V3-${b}`] = await thumb(v.runs[`V3:${b}`].file);
  img[`V2-${b}`] = await thumb(v.runs[`V2:${b}`].file);
}
const verifyCost = Object.values(v.runs).reduce((s: number, r: any) => s + r.cost, 0);
const calCost = [...Object.values(cal.openai), ...Object.values(cal.haiku)].reduce((s: number, r: any) => s + r.cost, 0);
const steps = (r: any) => r.steps.map((x: any) => x.step).join(" → ");
const qaFlags = (r: any) => { const q = r.steps.find((x: any) => x.qa)?.qa; if (!q) return ""; const n = JSON.parse(q.notes); return `<span class="chk ${q.pass ? "ok" : "no"}">${q.pass ? "✓" : "✕"} text</span>` + ["style", "cast", "concept"].map((k) => `<span class="chk adv ${n[k] ? "ok" : "no"}" title="advisory">${n[k] ? "✓" : "✕"} ${k}</span>`).join(""); };
const t = STICKMAN_RENDER_TIERS;
const beatTime = (seq: number) => { const b = retimed.beats.find((x: any) => x.sequence === seq); return { narration: b.narrationText, time: `${Math.floor(b.startMs / 60000)}:${String(Math.floor((b.startMs % 60000) / 1000)).padStart(2, "0")}` }; };

const html = `<title>Stickman Tier Verification</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;700&family=Public+Sans:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{--paper:#F2F3F5;--panel:#FFFFFF;--ink:#1B1D22;--muted:#5D6470;--line:#D9DCE2;--accent:#2F5BD3;--ok:#1E7F4A;--okbg:#E3F3EA;--no:#B53A26;--nobg:#F8E4DF;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--ok:#6CCB94;--okbg:#1C3327;--no:#F08E7B;--nobg:#3A221D;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--ok:#6CCB94;--okbg:#1C3327;--no:#F08E7B;--nobg:#3A221D;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.5 "Public Sans",system-ui,sans-serif;padding-inline:16px;padding-block:24px 48px}
main{max-width:1400px;margin:0 auto;display:grid;gap:36px}
h1,h2,h3{font-family:"Archivo Narrow","Arial Narrow",system-ui,sans-serif;text-wrap:balance;margin:0;line-height:1.1}
h1{font-size:34px}h2{font-size:24px}h3{font-size:19px}
p{margin:0;max-width:75ch}.muted{color:var(--muted)}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:12.5px}
header,section{display:grid;gap:12px}
.facts{display:flex;flex-wrap:wrap;gap:6px 20px;color:var(--muted)}.facts b{color:var(--ink)}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--line);text-align:left;vertical-align:top;padding:9px 12px}
thead th{font-family:"Archivo Narrow",system-ui,sans-serif;font-size:15px}
.beat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;display:grid;gap:10px}
.beat .head{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
.tag{font-size:11px;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:0 6px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media (max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:480px){.grid{grid-template-columns:1fr}}
figure{margin:0;display:grid;gap:4px}
figure img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;border:1px solid var(--line);cursor:zoom-in}
figure.after img{border:2px solid var(--accent)}
figcaption{font-size:12.5px;color:var(--muted)}figcaption b{color:var(--ink);font-weight:600}
.chk{font-size:11px;border-radius:3px;padding:1px 5px;margin-right:4px}.chk.ok{background:var(--okbg);color:var(--ok)}.chk.no{background:var(--nobg);color:var(--no)}.chk.adv{opacity:.8}
.callout{border-left:3px solid var(--accent);padding:10px 14px;background:var(--panel);border-radius:0 6px 6px 0}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,1400px)}dialog::backdrop{background:rgba(10,12,16,.85)}dialog img{display:block;max-width:100%;max-height:90vh;border-radius:6px}
button:focus-visible,img:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
<main>
<header>
  <h1>Stickman tiers: style and concept fixes, before and after</h1>
  <p class="muted">Six Myth vs Reality beats rendered through the locked tier pipeline: render, QA (text verdict from OCR), Real-ESRGAN 2× upscale to 1920×1080, then the programmatic text overlay where the tier needs it. “Before” images are the Phase 4a bake-off renders of the same beats.</p>
  <div class="facts mono"><span>Verification renders <b>$${verifyCost.toFixed(4)}</b></span><span>QA calibration <b>$${calCost.toFixed(4)}</b></span><span>Phase 4b total <b>$${(verifyCost + calCost).toFixed(4)}</b> of $0.80</span></div>
</header>

<section>
  <h2>Locked tiers</h2>
  <div class="scroll"><table>
    <thead><tr><th>Tier</th><th>Model</th><th>On-screen text</th><th>Premium</th><th>Post</th></tr></thead>
    <tbody>
      <tr><th>V2</th><td class="mono">${t.V2.model} · ${t.V2.width}×${t.V2.height} · steps 4 · CFG 3.5</td><td>Always a programmatic overlay; FLUX never draws text</td><td>—</td><td rowspan="3">Real-ESRGAN 2× → 1920×1080; original kept</td></tr>
      <tr><th>V3</th><td class="mono">${t.V3.model} · ${t.V3.width}×${t.V3.height}</td><td>Rendered by the model and OCR-checked. On a mismatch: one retry, then a clean re-render plus overlay</td><td>—</td></tr>
      <tr><th>V4</th><td class="mono">${t.V4.model} (V3 + premium)</td><td>As V3</td><td>Best-of-2 for hook beats (first 30 s) and SHORT_TEXT beats; strict QA with one auto-retry</td></tr>
    </tbody>
  </table></div>
  <p class="muted" style="font-size:13.5px">Not used for Stickman: Nano Banana 2, Recraft V4, Qwen-Image, Kling, Seedream. No reference images.</p>
</section>

<section>
  <h2>QA judge calibration</h2>
  <div class="callout"><p><b>Default: ${STICKMAN_QA.model}, detail ${STICKMAN_QA.detail}, on a ${STICKMAN_QA.imageWidth} px downscale.</b> Its OCR is accurate: a text verdict computed in code from the transcription agrees with my labels on 93% of the 45 images it judged. Its own pass/fail calls agree far less (27%). Claude Haiku 4.5 agreed 90% on text but returned malformed output on 24 of 45 images and costs more ($0.0035 vs $0.0022 per image). Neither judge reached 80% on style (69% and 48%), so style, cast and concept are advisory: logged and used to rank best-of-2 candidates, never used to block an image.</p></div>
</section>

<section>
  <h2>Before and after</h2>
  ${BEATS.map(([b, label, note]) => { const bt = beatTime(b); const r3 = v.runs[`V3:${b}`], r2 = v.runs[`V2:${b}`]; return `<div class="beat">
    <div class="head"><h3>Beat ${b}</h3><span class="tag">${esc(label)}</span><span class="muted" style="font-size:13px">${bt.time} · ‘${esc(bt.narration)}’</span></div>
    ${concepts[String(b)] ? `<p class="muted" style="font-size:13px">Handwritten recipe concept for this check: ${esc(concepts[String(b)]._contract.visualConcept)}.</p>` : ""}
    <p style="font-size:14px">${esc(note)}</p>
    <div class="grid">
      <figure><img src="${img[`A-lite-${b}`]}" alt="Before, Nano Banana 2 Lite" tabindex="0"><figcaption><b>Before</b> · Nano Banana 2 Lite (4a)</figcaption></figure>
      <figure class="after"><img src="${img[`V3-${b}`]}" alt="After, V3" tabindex="0"><figcaption><b>After · V3</b> · ${qaFlags(r3)}<br><span class="mono">$${r3.cost.toFixed(4)} · ${esc(steps(r3))}</span></figcaption></figure>
      <figure><img src="${img[`A-flux-${b}`]}" alt="Before, FLUX" tabindex="0"><figcaption><b>Before</b> · FLUX.2 klein (4a)</figcaption></figure>
      <figure class="after"><img src="${img[`V2-${b}`]}" alt="After, V2" tabindex="0"><figcaption><b>After · V2</b> · ${qaFlags(r2)}<br><span class="mono">$${r2.cost.toFixed(4)} · ${esc(steps(r2))}</span></figcaption></figure>
    </div></div>`; }).join("")}
</section>
</main>
<dialog id="lb"><img id="lbImg" alt=""></dialog>
<script>
const lb=document.getElementById('lb'),li=document.getElementById('lbImg');
document.querySelectorAll('figure img').forEach(i=>{const open=()=>{li.src=i.src;li.alt=i.alt;lb.showModal();};i.addEventListener('click',open);i.addEventListener('keydown',e=>{if(e.key==='Enter')open();});});
lb.addEventListener('click',()=>lb.close());
</script>`;
await Deno.writeTextFile(new URL("docs/phase4/verify-4b.html", root), html);
console.log(`${(html.length / 1e6).toFixed(2)} MB · verify $${verifyCost.toFixed(4)} · calibration $${calCost.toFixed(4)}`);
