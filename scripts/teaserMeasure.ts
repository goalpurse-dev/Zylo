// PAID (about $0.008, hard cap $0.02): runs ONE real Long Form teaser exactly
// as the long-form-teaser function does (_shared/stickman/teaser.ts: one
// gpt-4o-mini call + 3 V2 scenes, no upscale, no AI check) and prints the real
// cost of every step. Writes nothing to the database; the 3 pictures and the
// result are saved to <outDir> (used for the local screenshots).
//   npx -y deno@2.9.6 run -A --no-check --env-file=.env.local scripts/teaserMeasure.ts <outDir> "<topic>" [nicheId] [nicheLabel]
import { runTeaser, teaserBudget, teaserSceneTask, writeTeaserPlan, TEASER_CAP_USD } from "../supabase/functions/_shared/stickman/teaser.ts";

const [OUT, TOPIC, NICHE = "myth_vs_reality", NICHE_LABEL = "Myth vs Reality"] = Deno.args;
if (!OUT || !TOPIC) { console.error("usage: teaserMeasure.ts <outDir> <topic> [nicheId] [nicheLabel]"); Deno.exit(1); }
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
await Deno.mkdir(OUT, { recursive: true });
const input = { topic: TOPIC, nicheId: NICHE, nicheLabel: NICHE_LABEL };
const budget = teaserBudget(input);
console.log("before:", JSON.stringify(budget));
if (!budget.fits) { console.error("estimate is over the cap: not started"); Deno.exit(1); }

const steps: any[] = [];
const t0 = Date.now();
const result = await runTeaser(input, {
  writePlan: async (i) => { const t = Date.now(); const r = await writeTeaserPlan(OPENAI_KEY, i); steps.push({ step: "plan", ms: Date.now() - t, usd: r.usd, inputTokens: r.inputTokens, outputTokens: r.outputTokens }); return r; },
  drawScene: async (description, index) => {
    const t = Date.now();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task: teaserSceneTask(description) }) });
    const j: any = await r.json().catch(() => null);
    if (!j?.ok) throw new Error(`runware ${r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 160)}`);
    const bytes = new Uint8Array(await (await fetch(j.result.imageURL)).arrayBuffer());
    await Deno.writeFile(`${OUT}/scene-${index + 1}.jpg`, bytes);
    steps.push({ step: `scene ${index + 1}`, ms: Date.now() - t, usd: Number(j.result.cost ?? 0), costReported: j.result.cost != null, bytes: bytes.length });
    return { imageUrl: `scene-${index + 1}.jpg`, usd: Number(j.result.cost ?? 0), costKnown: j.result.cost != null };
  },
});
for (const s of steps) console.log(JSON.stringify(s));
const out = { topic: TOPIC, niche: NICHE, title: (result as any).plan?.title, hook: (result as any).plan?.hook, scenes: (result as any).scenes, spentUsd: result.spentUsd, capUsd: TEASER_CAP_USD, underCap: (result as any).underCap, seconds: Math.round((Date.now() - t0) / 100) / 10 };
await Deno.writeTextFile(`${OUT}/teaser.json`, JSON.stringify(out, null, 1));
console.log("result:", JSON.stringify(out, null, 1));
