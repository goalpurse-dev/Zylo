// Phase 7 pricing model ($0): the per-tier cost of a video (from the ledger's
// measured unit costs, see docs/phase7/pricing-proposal.md) and the proposed
// prices, printed as markdown tables. Change a number here, re-run, paste.
//   node scripts/phase7PricingModel.mjs
const USD_PER_CREDIT_LOW = 16 / 750; // Starter, billed yearly — the cheapest credit we sell
const USD_PER_CREDIT_PACK = 19.99 / 900; // the biggest one-time pack
const SCENES_PER_MIN = 148 / 9.61; // f90160bc: 148 beats in 9.61 min
const CHARS_PER_MIN = 8332 / 9.61; // f90160bc narration
const VOICE_USD_PER_CHAR = 0.2 * (6 / 30000); // measured 0.2 ElevenLabs credits/char (header), Starter $6/30k credits
const RENDER_1080_USD_PER_MIN = 0.1002 / 9.61; // f90160bc Fly render (4 machines), measured
// Per scene, all-in (generate + upscale + QA), incl. the tier's retry behaviour.
const IMG = {
  V2: 0.00247 + 0.0006, // FLUX.2 klein 9B (8 steps) + Real-ESRGAN; code QA ($0)
  V3: 0.0337 + 0.0006 + 0.0022, // Nano Banana 2 Lite + upscale + gpt-4o-mini QA at 768 px (calibrated $0.0022)
};
const perSceneUsd = {
  V2: IMG.V2 * 1.15, // one code-QA retry on ~15% of scenes
  V3: IMG.V3 * 1.05, // stray-text retry on ~5%
  V4: IMG.V3 + 0.2 * (0.0337 + 0.0006) + 0.15 * IMG.V3, // best-of-2 on hook + SHORT_TEXT (~20%), strict QA retry ~15%
};
// Fixed per video (measured on f90160bc unless noted): research-lite, one script (draft + verify + 2 critics + revision),
// bible, beat plan (one build), YouTube text, thumbnail concepts, 3 included thumbnails (1.5 renders each).
const FIXED = { research: 0.18, script: 0.48, bible: 0.02, beats: 0.25, ytText: 0.018, thumbConcepts: 0.014, thumbnails: 3 * (0.0337 + 0.0006 + 0.0056) * 1.5 };
// Overhead on top of a clean run: extra script drafts (ledger avg 0.41/project), abandoned projects (15% x ~$1 LLM
// released to the user), failed renders (~10% of render), failed thumbnail concept calls.
const OVERHEAD = { extraDrafts: 0.1, abandoned: 0.15, renderFailures: 0.01, thumbConceptFailures: 0.005 };
const SAVINGS_PROVEN = { draftCap: 0.06, thumbLook768: 0.015 };
const SAVINGS_UNPROVEN = { haikuCritic: 0.07, haikuBeats: 0.125, factCache: 0.02 };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const fixedClean = sum(FIXED), fixedAll = fixedClean + sum(OVERHEAD), fixedAfter = fixedAll - sum(SAVINGS_PROVEN);
const perMin = (t) => SCENES_PER_MIN * perSceneUsd[t] + CHARS_PER_MIN * VOICE_USD_PER_CHAR + RENDER_1080_USD_PER_MIN;
const cost = (t, m, fixed = fixedAfter) => fixed + perMin(t) * m;
const PRICE_CR_PER_MIN = { V2: 25, V3: 75, V4: 90 };
const CURRENT_CR_10MIN = { V2: 304, V3: 456, V4: 608 };
const $ = (x) => `$${x.toFixed(2)}`;
const pct = (x) => `${Math.round(x * 100)}%`;

console.log(`\nper 10 min: ${Math.round(SCENES_PER_MIN * 10)} scenes, ${Math.round(CHARS_PER_MIN * 10)} narration chars; fixed clean ${$(fixedClean)}, overhead ${$(sum(OVERHEAD))}, proven savings ${$(sum(SAVINGS_PROVEN))}\n`);
console.log("| Tier | Images | Voice | Render 1080p | LLM + thumbs | Clean total | + overhead | $/min | After proven savings |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const t of ["V2", "V3", "V4"]) {
  const img = SCENES_PER_MIN * 10 * perSceneUsd[t], voice = CHARS_PER_MIN * 10 * VOICE_USD_PER_CHAR, rnd = RENDER_1080_USD_PER_MIN * 10;
  const clean = fixedClean + img + voice + rnd, all = clean + sum(OVERHEAD);
  console.log(`| ${t} | ${$(img)} | ${$(voice)} | ${$(rnd)} | ${$(fixedClean)} | ${$(clean)} | ${$(all)} (+${pct(sum(OVERHEAD) / clean)}) | ${$(all / 10)} | ${$(cost(t, 10))} |`);
}
console.log(`\n| Tier | Minutes | Credits (${Object.entries(PRICE_CR_PER_MIN).map(([k, v]) => `${k} ${v}/min`).join(", ")}) | $ at lowest ($${USD_PER_CREDIT_LOW.toFixed(4)}/cr) | $ at biggest pack | Our cost | Margin (lowest $/cr) |`);
console.log("|---|---|---|---|---|---|---|");
for (const t of ["V2", "V3", "V4"]) for (const m of [8, 10, 12, 15]) {
  const cr = PRICE_CR_PER_MIN[t] * m, rev = cr * USD_PER_CREDIT_LOW, c = cost(t, m);
  console.log(`| ${t} | ${m} | ${cr} | ${$(rev)} | ${$(cr * USD_PER_CREDIT_PACK)} | ${$(c)} | ${pct(1 - c / rev)} |`);
}
console.log("\n| Tier | Current 10-min quote | Revenue (lowest) | Our cost | Current margin | Proposed | Proposed margin |");
console.log("|---|---|---|---|---|---|---|");
for (const t of ["V2", "V3", "V4"]) {
  const cur = CURRENT_CR_10MIN[t], c = cost(t, 10, fixedAll), p = PRICE_CR_PER_MIN[t] * 10;
  console.log(`| ${t} | ${cur} cr | ${$(cur * USD_PER_CREDIT_LOW)} | ${$(c)} | ${pct(1 - c / (cur * USD_PER_CREDIT_LOW))} | ${p} cr | ${pct(1 - cost(t, 10) / (p * USD_PER_CREDIT_LOW))} |`);
}
// Add-ons: real cost per click -> ~2x -> credits.
const addons = [
  ["1440p render (10-min video; est. 1.7x the measured 1080p)", 1.7 * RENDER_1080_USD_PER_MIN * 10, 20, "free"],
  ["Thumbnail regenerate, per image (gen + upscale + look + 50% re-render + concept share)", 0.0337 + 0.0006 + 0.0056 + 0.5 * 0.04 + 0.0133 / 3, 6, "3"],
  ["Scene regenerate V2", perSceneUsd.V2, 1, "2"],
  ["Scene regenerate V3", perSceneUsd.V3, 4, "3"],
  ["Scene regenerate V4 (strict QA retry, no best-of)", IMG.V3 * 1.15, 5, "4"],
  ["Voice re-record, after the free one (10-min video)", CHARS_PER_MIN * 10 * VOICE_USD_PER_CHAR, 40, "blocked (no paid path)"],
];
console.log("\n| Add-on | Our cost | Proposed credits | $ (lowest) | Margin | Current |");
console.log("|---|---|---|---|---|---|");
for (const [name, c, cr, cur] of addons) console.log(`| ${name} | ${$(c)} | ${cr} | ${$(cr * USD_PER_CREDIT_LOW)} | ${pct(1 - c / (cr * USD_PER_CREDIT_LOW))} | ${cur} |`);
// Voice plans (elevenlabs.io/pricing, fetched 2026-09-29).
const plans = [["Starter", 6, 30000], ["Creator", 22, 121000], ["Pro", 99, 600000], ["Scale", 299, 1800000], ["Business", 990, 6000000]];
const cr10 = CHARS_PER_MIN * 10 * 0.2, cr10list = CHARS_PER_MIN * 10 * 0.5;
console.log(`\n| ElevenLabs plan | $/month | Credits | $ per 10-min video (0.2 cr/char measured) | Videos/month (measured) | Videos/month (0.5 cr/char list rate) |`);
console.log("|---|---|---|---|---|---|");
for (const [n, p, c] of plans) console.log(`| ${n} | $${p} | ${c.toLocaleString()} | ${$(p / c * cr10)} | ${Math.floor(c / cr10)} | ${Math.floor(c / cr10list)} |`);
