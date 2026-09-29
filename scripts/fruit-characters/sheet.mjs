// Builds the local Approve / Reject review sheet for a generated folder.
//   node scripts/fruit-characters/sheet.mjs [--out data/fruit-characters/refs]
// Decisions are kept in the browser (per id + attempt, so a regenerated image
// starts as pending again). "Save decisions" downloads fruit-decisions.json,
// which retry.mjs reads to regenerate the rejected ones.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outArg = process.argv.indexOf("--out");
const OUT = path.resolve(ROOT, outArg > 0 ? process.argv[outArg + 1] : "data/fruit-characters/refs");
const MAX_ATTEMPTS = 4;

const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fruit-characters/characters.json"), "utf8"));
const ledger = JSON.parse(fs.readFileSync(path.join(OUT, "ledger.json"), "utf8"));
const qaPath = path.join(OUT, "qa.json");
const qa = fs.existsSync(qaPath) ? JSON.parse(fs.readFileSync(qaPath, "utf8")) : {};

const cards = lib.characters.map((c) => {
  const oks = ledger.filter((r) => r.ok && r.id === c.id);
  const last = oks.at(-1);
  return {
    id: c.id, name: c.name, collection: c.collection ?? "core", fruit: c.fruit, emoji: c.emoji, gender: c.gender, age: c.age, tag: c.tag, role: c.role,
    outfit: c.outfit, checkFirst: Boolean(c.checkFirst), existing: Boolean(c.existing),
    attempt: last?.attempt ?? 0, attempts: oks.length, seed: last?.seed ?? null,
    cost: ledger.filter((r) => r.id === c.id).reduce((s, r) => s + (r.cost ?? 0), 0),
    file: last ? `${c.id}.jpg?v=${last.attempt}` : null,
    history: oks.slice(0, -1).map((r) => ({ attempt: r.attempt, file: `attempts/${c.id}-${r.attempt}.jpg`, note: qa[`${c.id}@${r.attempt}`]?.reason ?? "" })),
    qa: last ? qa[`${c.id}@${last.attempt}`] ?? null : null,
    failed: ledger.some((r) => !r.ok && r.id === c.id),
  };
});
const total = ledger.reduce((s, r) => s + (r.cost ?? 0), 0);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fruit Character Review</title>
<style>
:root{--bg:#0c0d0b;--card:#141612;--line:#ffffff14;--text:#eef2e8;--mute:#9aa392;--lime:#c7f36b;--red:#ff8a7a;--amber:#ffc46b;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,Segoe UI,sans-serif;padding:0 16px 64px}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding-block:14px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
h1{font-size:18px;margin:0}.stats{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--mute);font-variant-numeric:tabular-nums}.stats b{color:var(--text)}
.filters,.actions{display:flex;flex-wrap:wrap;gap:6px}button{font:inherit;font-size:12px;border:1px solid var(--line);background:#1b1e18;color:var(--text);border-radius:999px;padding:5px 12px;cursor:pointer}
button[aria-pressed=true]{background:var(--lime);color:#11150d;border-color:var(--lime);font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;margin-top:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:6px}
.card.approved{border-color:#c7f36b88}.card.rejected{border-color:#ff8a7a88}.card img{width:100%;aspect-ratio:768/1376;object-fit:cover;border-radius:9px;background:#fff;display:block}
.name{font-weight:700}.meta{font-size:11px;color:var(--mute);font-variant-numeric:tabular-nums}.badges{display:flex;flex-wrap:wrap;gap:4px}
.badge{font-size:10px;font-weight:700;border-radius:999px;padding:1px 7px;background:#ffffff12;color:var(--mute)}.badge.check{background:#ffc46b26;color:var(--amber)}.badge.flag{background:#ff8a7a26;color:var(--red)}.badge.ex{background:#c7f36b1f;color:var(--lime)}
.qa{font-size:11px;color:var(--amber)}.row{display:grid;grid-template-columns:1fr 1fr;gap:6px}.row button{border-radius:9px;padding:7px}
.approve[aria-pressed=true]{background:var(--lime);color:#11150d}.reject[aria-pressed=true]{background:var(--red);color:#1a0b08;border-color:var(--red)}
details{font-size:11px;color:var(--mute)}details .hist{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px}details figure{margin:0}details figcaption{font-size:10px}
.empty{display:grid;place-items:center;aspect-ratio:768/1376;border:1px dashed var(--line);border-radius:9px;color:var(--mute)}
#ids{width:100%;min-height:40px;margin-top:8px;background:#111;color:var(--text);border:1px solid var(--line);border-radius:8px;font:12px ui-monospace,monospace;padding:6px}
</style></head><body>
<header>
 <h1>Fruit character review</h1>
 <div class="stats"><span><b>${cards.filter((c) => c.attempts).length}</b>/${cards.length} generated</span><span>Spent <b>$${total.toFixed(4)}</b> in this folder</span><span id="tally"></span></div>
 <div class="filters" role="group" aria-label="Filter">
  <button data-f="core" aria-pressed="false">Core (${cards.filter((c) => c.collection === "core").length})</button>
  <button data-f="uk-roadman" aria-pressed="false">UK roadman (${cards.filter((c) => c.collection === "uk-roadman").length})</button>
  <button data-f="check" aria-pressed="false">Check first (${cards.filter((c) => c.checkFirst).length})</button>
  <button data-f="all" aria-pressed="true">All</button><button data-f="pending" aria-pressed="false">Pending</button>
  <button data-f="rejected" aria-pressed="false">Rejected</button><button data-f="flagged" aria-pressed="false">Flagged</button>
 </div>
 <div class="actions"><button id="approveRest">Approve all pending</button><button id="save">Save decisions</button></div>
 <textarea id="ids" readonly aria-label="Decisions JSON" hidden></textarea>
</header>
<main class="grid" id="grid"></main>
<script>
const CARDS = ${JSON.stringify(cards)};
const MAX = ${MAX_ATTEMPTS};
const KEY = "fruit-review-v1";
let state = {}; try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
const k = (c) => c.id + "@" + c.attempt;
const dec = (c) => state[k(c)] || "pending";
const flagged = (c) => c.attempts >= MAX && dec(c) === "rejected";
let filter = "all";
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);
function render() {
  const list = CARDS.filter((c) => filter === "all" || c.collection === filter || (filter === "check" && c.checkFirst) || (filter === "pending" && c.attempts && dec(c) === "pending") || (filter === "rejected" && dec(c) === "rejected") || (filter === "flagged" && flagged(c)));
  list.sort((a, b) => (b.checkFirst - a.checkFirst));
  document.getElementById("grid").innerHTML = list.map((c) => {
    const d = dec(c);
    return '<article class="card ' + d + '" data-id="' + c.id + '">' +
      (c.file ? '<a href="' + c.file + '" target="_blank"><img loading="lazy" src="' + c.file + '" alt="' + esc(c.name) + '"></a>' : '<div class="empty">' + (c.failed ? "failed, not generated" : "not generated") + '</div>') +
      '<div class="name">' + c.emoji + ' ' + esc(c.name) + '</div>' +
      '<div class="meta">' + esc(c.fruit) + ' · ' + (c.gender === "female" ? "F" : "M") + ' ' + c.age + ' · ' + esc(c.tag) + '</div>' +
      '<div class="meta">Attempt ' + c.attempt + '/' + MAX + ' · $' + c.cost.toFixed(4) + (c.seed != null ? ' · seed ' + c.seed : '') + '</div>' +
      '<div class="badges">' + (c.checkFirst ? '<span class="badge check">Check first: brown body</span>' : '') + (c.existing ? '<span class="badge ex">Existing</span>' : '') + (c.collection !== "core" ? '<span class="badge ex">' + esc(c.collection) + '</span>' : '') + (flagged(c) ? '<span class="badge flag">Flagged: ' + MAX + ' tries</span>' : '') + '</div>' +
      (c.qa ? '<div class="qa">Auto check: ' + esc(c.qa.reason) + '</div>' : '') +
      (c.attempts ? '<div class="row"><button class="approve" aria-pressed="' + (d === "approved") + '">Approve</button><button class="reject" aria-pressed="' + (d === "rejected") + '">Reject</button></div>' : '') +
      (c.history.length ? '<details><summary>' + c.history.length + ' earlier attempt(s)</summary><div class="hist">' + c.history.map((h) => '<figure><a href="' + h.file + '" target="_blank"><img loading="lazy" src="' + h.file + '" alt="attempt ' + h.attempt + '"></a><figcaption>#' + h.attempt + (h.note ? ' · ' + esc(h.note) : '') + '</figcaption></figure>').join("") + '</div></details>' : '') +
      '<details><summary>Outfit</summary>' + esc(c.outfit) + '</details></article>';
  }).join("");
  const n = { approved: 0, rejected: 0, pending: 0 };
  for (const c of CARDS) if (c.attempts) n[dec(c)]++;
  document.getElementById("tally").innerHTML = '<b>' + n.approved + '</b> approved · <b>' + n.rejected + '</b> rejected · <b>' + n.pending + '</b> pending · <b>' + CARDS.filter(flagged).length + '</b> flagged';
}
document.getElementById("grid").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const c = CARDS.find((x) => x.id === b.closest(".card").dataset.id);
  const want = b.classList.contains("approve") ? "approved" : "rejected";
  state[k(c)] = dec(c) === want ? "pending" : want; persist(); render();
});
document.querySelector(".filters").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  filter = b.dataset.f; document.querySelectorAll(".filters button").forEach((x) => x.setAttribute("aria-pressed", x === b)); render();
});
document.getElementById("approveRest").onclick = () => { for (const c of CARDS) if (c.attempts && dec(c) === "pending") state[k(c)] = "approved"; persist(); render(); };
document.getElementById("save").onclick = () => {
  const out = { savedAt: new Date().toISOString(), decisions: CARDS.filter((c) => c.attempts).map((c) => ({ id: c.id, attempt: c.attempt, decision: dec(c) })) };
  const json = JSON.stringify(out, null, 1);
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = "fruit-decisions.json"; a.click();
  const t = document.getElementById("ids"); t.hidden = false; t.value = json;
};
render();
</script></body></html>`;
fs.writeFileSync(path.join(OUT, "review.html"), html);
console.log(path.join(OUT, "review.html"));
