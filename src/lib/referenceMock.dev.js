// DEV ONLY (?mock=1 on localhost; references.js imports this only when import.meta.env.DEV): a fake scan that walks
// through the real progress steps and answers with the real test breakdowns made by scripts/reference/scanLocal.mjs
// (content/reference-tests/<name>/breakdown.json). The file name picks the breakdown: a name with "town", "explain" or
// "meme" in it; anything else gets the first one.
import { cardSummary } from "../../supabase/functions/_shared/reference/breakdown.js";
import { SCAN_STEPS } from "../../supabase/functions/_shared/reference/job.js";

const found = import.meta.glob("../../content/reference-tests/*/breakdown.json", { eager: true, import: "default" });
const byName = Object.fromEntries(Object.entries(found).map(([p, b]) => [p.split("/").at(-2), b]));
const scans = new Map();
// local keyframe paths -> files the dev server can show
const local = (p) => (p ? `/@fs/${String(p).replace(/\\/g, "/")}` : null);

function pick(name) {
  const n = String(name).toLowerCase();
  const key = n.includes("town") ? "in-this-town" : n.includes("explain") || n.includes("3d") ? "3d-explainer" : n.includes("meme") ? "meme-edit" : Object.keys(byName)[0];
  return byName[key] ?? null;
}
function view(s) {
  const done = s.calls >= SCAN_STEPS.length - 1;
  const step = SCAN_STEPS[Math.min(s.calls, SCAN_STEPS.length - 1)];
  const breakdown = done && s.breakdown ? { ...s.breakdown, shots: s.breakdown.shots.map((x) => ({ ...x, keyframes: (x.keyframes ?? []).map(local) })) } : null;
  const card = breakdown ? cardSummary(breakdown) : null;
  if (card) card.thumbs = breakdown.shots.filter((x) => x.what).map((x) => x.keyframes[1] ?? x.keyframes[0]).filter(Boolean).slice(0, 24);
  return { id: s.id, status: done ? (breakdown ? "done" : "failed") : "scanning", step: step.id, pct: step.pct, label: step.label, error: done && !breakdown ? "No test breakdown on this computer (run scripts/reference/scanLocal.mjs)." : null, card, breakdown };
}

export async function mockReference(body) {
  await new Promise((r) => setTimeout(r, 250));
  if (body.action === "start") {
    const id = crypto.randomUUID();
    scans.set(id, { id, calls: 0, breakdown: pick(body.path ?? body.link ?? "") });
    return { scan: view(scans.get(id)) };
  }
  const s = scans.get(body.id);
  if (!s) throw new Error("no such scan");
  s.calls += 1;
  return { scan: view(s) };
}
