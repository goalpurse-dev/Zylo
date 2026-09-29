// deno-lint-ignore-file no-explicit-any
// Phase 4d — two contact sheets: before/after for the re-rendered beats only,
// and the updated full V2 set (4d frames replace the 4c ones where re-rendered).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const full = await read("docs/phase4/fullset/state.json");
const fix = await read("docs/phase4/fix4d/state.json");
const review = await read("docs/phase4/fullset/review-tags.json");
const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const thumb = async (p: string) => {
  const img = await Image.decode(await Deno.readFile(new URL(p, root)));
  img.resize(480, Image.RESIZE_AUTO);
  return `data:image/jpeg;base64,${encodeBase64(await img.encodeJPEG(70))}`;
};
const tagsIn = (set: Record<string, number[]>, n: number) => Object.entries(set).filter(([, v]) => v.includes(n)).map(([k]) => k);
const LABEL: Record<string, string> = { OBJECT_HAS_FACE: "Face on object", FIGURE_IN_CASE: "Stickman as object", REAL_BRAND_IP: "Real IP", STRAY_TEXT: "Stray text", FILLER: "Filler", REPEAT: "Repeat", WRONG_CONCEPT: "Wrong concept" };
const TAGS = Object.keys(LABEL);
const count = (set: Record<string, number[]>, k: string, only?: number[]) => (set[k] ?? []).filter((n) => !only || only.includes(n)).length;

const changed = (Object.values(fix.beats) as any[]).sort((a, b) => a.seq - b.seq);
const changedSeqs = changed.map((r) => r.seq);
const fixCost = changed.reduce((s, r) => s + r.cost, 0);
const directorCost = fix.director.cost;

const HEAD = (title: string) => `<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;700&family=Public+Sans:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{--paper:#F2F3F5;--panel:#FFFFFF;--ink:#1B1D22;--muted:#5D6470;--line:#D9DCE2;--accent:#2F5BD3;--accentbg:#E6ECFB;--bad:#B53A26;--badbg:#F8E4DF;--good:#1F7A4A;--goodbg:#DDF1E6;--warn:#9A6412;--warnbg:#F6ECD9;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--accentbg:#222B45;--bad:#F08E7B;--badbg:#3A221D;--good:#6FD19C;--goodbg:#18322A;--warn:#E3B462;--warnbg:#382C17;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#16181C;--panel:#1F2228;--ink:#E8EAEE;--muted:#9AA1AD;--line:#343842;--accent:#7E9BF0;--accentbg:#222B45;--bad:#F08E7B;--badbg:#3A221D;--good:#6FD19C;--goodbg:#18322A;--warn:#E3B462;--warnbg:#382C17;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.5 "Public Sans",system-ui,sans-serif;padding-inline:16px;padding-block:24px 48px}
main{max-width:1500px;margin:0 auto;display:grid;gap:28px}
h1{font-family:"Archivo Narrow","Arial Narrow",system-ui,sans-serif;font-size:34px;line-height:1.1;margin:0;text-wrap:balance}
p{margin:0}.muted{color:var(--muted)}.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:12.5px}
header{display:grid;gap:12px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.fact{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.fact b{display:block;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:18px;font-variant-numeric:tabular-nums}
.fact span{font-size:12.5px;color:var(--muted)}
.tally{border-collapse:collapse;font-size:13.5px;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.tally th,.tally td{padding:6px 12px;border-bottom:1px solid var(--line);text-align:left}.tally td.n{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;text-align:right}
.tablewrap{overflow-x:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.pairs{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:14px}
@media (max-width:600px){.pairs{grid-template-columns:1fr}}
.beat{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
.imgs{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--line)}
.imgs figure{margin:0;position:relative}.imgs figcaption{position:absolute;top:6px;left:6px;font-size:11px;font-weight:600;padding:1px 6px;border-radius:3px;background:var(--panel)}
.beat img{display:block;width:100%;max-width:100%;aspect-ratio:16/9;object-fit:cover;cursor:zoom-in}
.beat img:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.cap{padding:8px 10px 10px;display:grid;gap:5px}
.head{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;font-size:13.5px}
.tr{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 5px}
.cap p{font-size:13px}.concept{font-size:12.5px;color:var(--muted)}
.flags{display:flex;flex-wrap:wrap;gap:4px}
.flag{font-size:11px;border-radius:3px;padding:1px 6px;background:var(--accentbg);color:var(--accent)}
.flag.bad{background:var(--badbg);color:var(--bad)}.flag.good{background:var(--goodbg);color:var(--good)}.flag.old{background:transparent;border:1px solid var(--line);color:var(--muted);text-decoration:line-through}
.callout{border-left:3px solid var(--accent);padding:10px 14px;background:var(--panel);border-radius:0 6px 6px 0;max-width:90ch}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,1400px)}dialog::backdrop{background:rgba(10,12,16,.85)}dialog img{display:block;max-width:100%;max-height:90vh;border-radius:6px}dialog p{color:#E8EAEE;font-size:13px;margin-top:6px}
</style>`;
const LIGHTBOX = `<dialog id="lb"><img id="lbImg" alt=""><p id="lbCap"></p></dialog>
<script>
const lb=document.getElementById('lb'),li=document.getElementById('lbImg'),lc=document.getElementById('lbCap');
document.querySelectorAll('.beat img').forEach(i=>{const open=()=>{li.src=i.src;lc.textContent=i.alt;lb.showModal();};i.addEventListener('click',open);i.addEventListener('keydown',e=>{if(e.key==='Enter')open();});});
lb.addEventListener('click',()=>lb.close());
</script>`;
const tallyTable = (only: number[] | null) => `<div class="tablewrap"><table class="tally"><thead><tr><th>Fault</th><th>Before</th><th>After</th></tr></thead><tbody>${TAGS.map((k) => `<tr><td>${LABEL[k]}</td><td class="n">${count(review.tags, k, only ?? undefined)}</td><td class="n">${count(review.afterPhase4d.tags, k)}</td></tr>`).join("")}</tbody></table></div>`;
const stillTagged = new Set(Object.values(review.afterPhase4d.tags as Record<string, number[]>).flat());

// ---------- before / after ----------
const pairCards: string[] = [];
for (const r of changed) {
  const before = await thumb(r.before), after = await thumb(r.files.preview);
  const was = tagsIn(review.tags, r.seq), now = tagsIn(review.afterPhase4d.tags, r.seq);
  const flags = [
    ...was.map((t) => `<span class="flag ${now.includes(t) ? "bad" : "old"}">${LABEL[t]}</span>`),
    ...now.filter((t) => !was.includes(t)).map((t) => `<span class="flag bad">${LABEL[t]} (new)</span>`),
    now.length ? "" : `<span class="flag good">Clean</span>`,
    r.redirected ? `<span class="flag">New concept from the director</span>` : `<span class="flag">Recompiled only</span>`,
  ].filter(Boolean).join("");
  const note = review.afterPhase4d.notes[String(r.seq)];
  pairCards.push(`<article class="beat" id="b${r.seq}">
  <div class="imgs"><figure><img src="${before}" alt="Beat ${r.seq} before: ${esc(r.narration)}" loading="lazy" tabindex="0"><figcaption>Before</figcaption></figure><figure><img src="${after}" alt="Beat ${r.seq} after: ${esc(r.narration)}" loading="lazy" tabindex="0"><figcaption>After</figcaption></figure></div>
  <div class="cap"><div class="head"><b>Beat ${r.seq}</b> · <span class="mono">${fmt(r.startMs)}</span> <span class="tr">${esc(r.treatment)}</span></div>
  <p>‘${esc(r.narration)}’</p>
  ${r.redirected && r.conceptAfter !== r.conceptBefore ? `<p class="concept">Concept: ${esc(r.conceptBefore)} → <b>${esc(r.conceptAfter)}</b></p>` : ""}
  ${note ? `<p class="concept">Still wrong: ${esc(note)}</p>` : ""}
  <div class="flags">${flags}</div></div>
</article>`);
}
const clean = changed.filter((r) => !stillTagged.has(r.seq)).length;
const beforeAfter = `${HEAD("Myth vs Reality 4d Fixes")}
<main>
<header>
  <h1>Myth vs Reality: the ${changed.length} re-rendered frames, before and after</h1>
  <p class="muted">Every frame tagged in the by-eye review of the V2 set, re-rendered on V2 after the Phase 4d fixes: no stickman paragraph and a no-people sentence on beats without cast, objects without faces, cases that hold only their object, no letters or numbers in V2 images, an IP guard, and a new concept from the director for the ${fix.director ? Object.keys(fix.director.beats).length : 0} filler, repeat, wrong-concept and IP beats. Tags were re-checked by eye on the new frames.</p>
  <div class="facts">
    <div class="fact"><b>${clean} / ${changed.length}</b><span>re-rendered frames now clean</span></div>
    <div class="fact"><b>${changed.filter((r) => r.failed).length} / ${changed.reduce((a, r) => a + (r.retries ?? 0), 0)}</b><span>failures / code-check retries</span></div>
    <div class="fact"><b>$${(fixCost + directorCost).toFixed(3)}</b><span>renders $${fixCost.toFixed(3)} + director $${directorCost.toFixed(3)}</span></div>
  </div>
  ${tallyTable(changedSeqs)}
  <div class="callout"><p><b>Still wrong on ${stillTagged.size} frames.</b> Faces on objects in two cast beats (24, 128) and on a carved sun (58) and a sketch (119); a figure in a case (24, 46, 136); letters on a beer label, a manuscript, a drawn zero, a stamp and a sign (17, 41, 42, 125, 131); and beat 98's generic hero now looks a lot like Marvel's Loki. Beat 46 kept its old concept because the director skipped it.</p></div>
</header>
<section class="pairs">${pairCards.join("")}</section>
</main>
${LIGHTBOX}`;
await Deno.writeTextFile(new URL("docs/phase4/fix4d.html", root), beforeAfter);

// ---------- updated full set ----------
const rows = (Object.values(full.beats) as any[]).sort((a, b) => a.seq - b.seq);
const cards: string[] = [];
for (const r of rows) {
  const f = fix.beats[r.seq];
  const src = await thumb(f ? f.files.preview : r.files.preview);
  const now = f ? tagsIn(review.afterPhase4d.tags, r.seq) : [];
  const flags = [
    f ? `<span class="flag">Re-rendered in 4d</span>` : "",
    ...now.map((t) => `<span class="flag bad">${LABEL[t]}</span>`),
  ].filter(Boolean).join("");
  cards.push(`<article class="beat" id="b${r.seq}">
  <img src="${src}" alt="Beat ${r.seq}: ${esc(f?.narration ?? r.narration)}" loading="lazy" tabindex="0">
  <div class="cap"><div class="head"><b>Beat ${r.seq}</b> · <span class="mono">${fmt(r.startMs)}</span> <span class="tr">${esc(f?.treatment ?? r.treatment)}</span></div>
  <p>‘${esc(r.narration)}’</p>
  ${flags ? `<div class="flags">${flags}</div>` : ""}</div>
</article>`);
}
const fullCost = rows.reduce((s, r) => s + r.cost, 0);
const fullSheet = `${HEAD("Myth vs Reality V2 Set")}
<main>
<header>
  <h1>Myth vs Reality: every V2 frame after Phase 4d</h1>
  <p class="muted">All ${rows.length} beats in order on the V2 tier (FLUX.2 [klein] 9B KV, 8 steps, Real-ESRGAN 2× to 1920×1080, text as an editable overlay). ${changed.length} frames were re-rendered in Phase 4d; the rest are the Phase 4c frames. Red tags are faults still visible after the by-eye re-check. Click a frame to enlarge.</p>
  <div class="facts">
    <div class="fact"><b>${rows.length - stillTagged.size} / ${rows.length}</b><span>frames with no tagged fault</span></div>
    <div class="fact"><b>${changed.length}</b><span>re-rendered in 4d</span></div>
    <div class="fact"><b>$${(fullCost + fixCost + directorCost).toFixed(3)}</b><span>images: 4c set $${fullCost.toFixed(3)} + 4d fixes $${(fixCost + directorCost).toFixed(3)}</span></div>
  </div>
  ${tallyTable(null)}
</header>
<section class="grid">${cards.join("")}</section>
</main>
${LIGHTBOX}`;
await Deno.writeTextFile(new URL("docs/phase4/fullset-4d.html", root), fullSheet);
console.log(`before/after ${(beforeAfter.length / 1e6).toFixed(2)} MB (${changed.length} beats, clean ${clean}) · full ${(fullSheet.length / 1e6).toFixed(2)} MB · renders $${fixCost.toFixed(4)} director $${directorCost}`);
