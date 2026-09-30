// Margin table from REAL logged costs (read-only, $0):
//   Fruit v2 stories (fruit_jobs + fruit_ai_calls) at 20 s and 30 s on V2/V3/V4,
//   Long Form 10 min (long_form_cost_ledger of finished videos) on V2/V3/V4,
//   and the top-up packs.
// Revenue per credit from the live Stripe prices and the credits new
// subscriptions get (_shared/stripePlanPrices.js), after Stripe's ~1.5% + €0.25
// per charge. NOW = no VAT (not VAT-registered); LATER = prices unchanged but
// 25.5% Finnish VAT included in them.
//   node scripts/fruit-story/margins.mjs <out.json> <usdPerEur>
import fs from "fs";
import { admin } from "./lib.mjs";
import { PLAN_CREDITS, EARLY_PLAN_CREDITS, TOPUP_CREDITS } from "../../supabase/functions/_shared/stripePlanPrices.js";

const [out, usdPerEurArg] = process.argv.slice(2);
const USD_PER_EUR = Number(usdPerEurArg);
const EUR = (usd) => usd / USD_PER_EUR;
const a = admin();
const VAT = 0.255;
const FLAG = 0.35;

async function all(table, select, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(a.from(table).select(select)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/* ─── Fruit unit costs (USD) ─── */
const jobs = await all("fruit_jobs", "kind,tool_key,cost_usd,request", (q) => q.eq("status", "succeeded"));
const clipRate = {};
// By model, not tool key: the V3 bake-off clips (Seedance 2.0 Mini) ran under the V2 key.
const TIER_MODEL = { v2: "alibaba:wan@2.6-flash", v3: "bytedance:seedance@2.0-mini", v4: "google:3@3" };
for (const tier of ["v2", "v3", "v4"]) {
  const js = jobs.filter((j) => j.kind === "clip" && j.request?.model === TIER_MODEL[tier]);
  const usd = js.reduce((s, j) => s + Number(j.cost_usd || 0), 0);
  const sec = js.reduce((s, j) => s + Number(j.request?.duration ?? 0), 0);
  clipRate[tier] = { perSec: usd / sec, clips: js.length, sec, model: js[0]?.request?.model };
}
const pics = jobs.filter((j) => j.kind === "image");
const picture = pics.reduce((s, j) => s + Number(j.cost_usd || 0), 0) / pics.length;
const calls = await all("fruit_ai_calls", "purpose,cost_usd");
const avg = (p) => { const c = calls.filter((x) => x.purpose === p); return c.length ? c.reduce((s, x) => s + Number(x.cost_usd || 0), 0) / c.length : 0; };
const count = (p) => calls.filter((x) => x.purpose === p).length;
const plannerRuns = count("planner");
const fruitUnit = {
  picture, check: avg("picture_check"), planner: avg("planner"),
  plannerRepairPerStory: plannerRuns ? (count("planner_repair") * avg("planner_repair")) / plannerRuns : 0,
  captionPerClip: avg("caption_words"), final: avg("final"), uploadPackage: avg("upload_package"), clipRate,
};
const fruitStory = (sec, tier) => {
  const scenes = Math.max(3, Math.round(sec / 5));
  const usd = scenes * (fruitUnit.picture + fruitUnit.check + fruitUnit.captionPerClip)
    + sec * clipRate[tier].perSec + fruitUnit.planner + fruitUnit.plannerRepairPerStory + fruitUnit.final + fruitUnit.uploadPackage;
  const credits = scenes * 4 + sec * { v2: 5, v3: 9, v4: 16 }[tier];
  return { scenes, usd, credits };
};

/* ─── Long Form unit costs (USD) from finished videos ─── */
const finished = await all("long_form_projects", "id,topic,final_duration_ms", (q) => q.not("final_video_path", "is", null).eq("status", "complete"));
const lf = [];
for (const p of finished) {
  const rows = await all("long_form_cost_ledger", "stage,model,usd,estimated", (q) => q.eq("project_id", p.id));
  const minutes = p.final_duration_ms / 60000;
  const sum = (f) => rows.filter(f).reduce((s, r) => s + Number(r.usd || 0), 0);
  const n = (f) => rows.filter(f).length;
  lf.push({
    topic: p.topic, minutes,
    nonImage: sum((r) => !["images", "image_upscale", "image_bakeoff", "qa"].includes(r.stage)),
    bakeoff: sum((r) => r.stage === "image_bakeoff"),
    flux: { usd: sum((r) => r.stage === "images" && r.model === "runware:400@6"), n: n((r) => r.stage === "images" && r.model === "runware:400@6") },
    nano: { usd: sum((r) => r.stage === "images" && r.model === "google:nano-banana@2-lite"), n: n((r) => r.stage === "images" && r.model === "google:nano-banana@2-lite") },
    upscale: { usd: sum((r) => r.stage === "image_upscale"), n: n((r) => r.stage === "image_upscale") },
    qa: { usd: sum((r) => r.stage === "qa"), n: n((r) => r.stage === "qa") },
    total: sum(() => true),
    estimatedShare: sum((r) => r.estimated) / Math.max(sum(() => true), 1e-9),
  });
}
const per = (k) => { const u = lf.reduce((s, x) => s + x[k].usd, 0); const c = lf.reduce((s, x) => s + x[k].n, 0); return c ? u / c : 0; };
const lfUnit = {
  nonImagePer10: lf.reduce((s, x) => s + (x.nonImage / x.minutes) * 10, 0) / lf.length,
  scenesPer10: (() => { const imgs = lf.reduce((s, x) => s + x.flux.n + x.nano.n, 0); const mins = lf.reduce((s, x) => s + x.minutes, 0); return (imgs / mins) * 10; })(),
  flux: per("flux"), nano: per("nano"), upscale: per("upscale"), qaCall: per("qa"),
  qaPerNanoImage: (() => { const x = lf.find((p) => p.nano.n > 100) ?? lf[0]; return x.qa.n / Math.max(x.nano.n, 1); })(),
};
// V4 = V3 + best-of-2 on hook beats (first 30 s ≈ 7.5 beats) and SHORT_TEXT beats
// (assumed 30%) + one strict-QA retry on ~10%: an ESTIMATE (no V4 video logged).
const lfScene = {
  v2: lfUnit.flux + lfUnit.upscale,
  v3: lfUnit.nano + lfUnit.upscale + lfUnit.qaPerNanoImage * lfUnit.qaCall,
};
const lfVideo = (tier) => {
  const s = lfUnit.scenesPer10;
  if (tier === "v4") {
    const extra = 7.5 + 0.3 * s + 0.1 * s;
    return { usd: lfUnit.nonImagePer10 + (s + extra) * lfScene.v3, credits: 900, estimate: true };
  }
  return { usd: lfUnit.nonImagePer10 + s * lfScene[tier], credits: tier === "v2" ? 250 : 750, estimate: false };
};

/* ─── Revenue per credit ─── */
const prices = { starter: [18, 180], pro: [38, 384], generative: [78, 780] };
const packs = { mini: 6.99, standard: 11.99, max: 19.99 };
const fee = (gross) => gross * 0.015 + 0.25;
const perCredit = (gross, credits, vat) => ((vat ? gross / (1 + VAT) : gross) - fee(gross)) / credits;
const sources = [];
for (const [plan, [m, y]] of Object.entries(prices)) {
  sources.push({ id: `${plan}-monthly`, label: `${plan[0].toUpperCase() + plan.slice(1)} monthly (€${m}, ${PLAN_CREDITS[plan]} cr)`, plan, gross: m, credits: PLAN_CREDITS[plan] });
  sources.push({ id: `${plan}-yearly`, label: `${plan[0].toUpperCase() + plan.slice(1)} yearly (€${y}, ${PLAN_CREDITS[plan] * 12} cr)`, plan, gross: y, credits: PLAN_CREDITS[plan] * 12 });
}
for (const [pack, p] of Object.entries(packs)) sources.push({ id: `pack-${pack}`, label: `${pack} pack (€${p}, ${TOPUP_CREDITS[pack]} cr)`, plan: "any", gross: p, credits: TOPUP_CREDITS[pack] });
for (const s of sources) { s.now = perCredit(s.gross, s.credits, false); s.later = perCredit(s.gross, s.credits, true); }
// Early subscribers (before the cutoff) get 900 / 1,900 / 3,900: the worst case today.
const early = Object.entries(prices).map(([plan, [m, y]]) => ({
  plan, monthlyNow: perCredit(m, EARLY_PLAN_CREDITS[plan], false), yearlyNow: perCredit(y, EARLY_PLAN_CREDITS[plan] * 12, false),
  monthlyLater: perCredit(m, EARLY_PLAN_CREDITS[plan], true), yearlyLater: perCredit(y, EARLY_PLAN_CREDITS[plan] * 12, true),
}));

/* ─── Products × sources ─── */
const tierMin = { v2: 0, v3: 1, v4: 2 };
const rank = { starter: 0, pro: 1, generative: 2, any: 0 };
const products = [];
for (const sec of [20, 30]) for (const tier of ["v2", "v3", "v4"]) {
  const f = fruitStory(sec, tier);
  products.push({ id: `fruit-${sec}-${tier}`, label: `AI Fruit Story ${sec} s · ${tier.toUpperCase()}`, tier, credits: f.credits, usd: f.usd, eur: EUR(f.usd), note: `${f.scenes} scenes · clips ${clipRate[tier].model} at $${clipRate[tier].perSec.toFixed(4)}/s (${clipRate[tier].clips} real clips)` });
}
for (const tier of ["v2", "v3", "v4"]) {
  const v = lfVideo(tier);
  products.push({ id: `lf-10-${tier}`, label: `Long Form 10 min · ${tier.toUpperCase()}`, tier, credits: v.credits, usd: v.usd, eur: EUR(v.usd), estimate: v.estimate, note: v.estimate ? "V4 is an estimate (no V4 video logged)" : "" });
}
for (const p of products) {
  p.rows = sources.filter((s) => s.plan === "any" || rank[s.plan] >= tierMin[p.tier]).map((s) => {
    const revNow = p.credits * s.now, revLater = p.credits * s.later;
    return { source: s.label, revNow, revLater, marginNow: (revNow - p.eur) / revNow, marginLater: (revLater - p.eur) / revLater };
  });
  p.minNow = Math.min(...p.rows.map((r) => r.marginNow));
  p.minLater = Math.min(...p.rows.map((r) => r.marginLater));
}

const result = { usdPerEur: USD_PER_EUR, rateDate: "2026-09-30 (ECB)", vat: VAT, flag: FLAG, fruitUnit, lfUnit, lfScene, lfProjects: lf, sources, early, products };
fs.writeFileSync(out, JSON.stringify(result, null, 1));
const pct = (x) => `${(x * 100).toFixed(0)}%`;
for (const p of products) {
  console.log(`${p.label.padEnd(32)} ${String(p.credits).padStart(4)} cr  cost €${p.eur.toFixed(2).padStart(5)}  worst NOW ${pct(p.minNow).padStart(4)}  worst LATER ${pct(p.minLater).padStart(4)}${p.minLater < FLAG || p.minNow < FLAG ? "  ⚠" : ""}`);
}
console.log("per credit NOW/LATER:", sources.map((s) => `${s.id} €${s.now.toFixed(4)}/€${s.later.toFixed(4)}`).join(" · "));
