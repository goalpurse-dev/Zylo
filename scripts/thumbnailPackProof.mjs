// Thumbnail pack proof (PAID, ~$0.21 + re-renders): renders pack prompts EXACTLY
// as written (docs/thumbnails/thumbnail-pack.md) through the real
// long-form-thumbnails draw path — Nano Banana 2 Lite, upscale, the top-third
// code fix, the checks (+ one re-render), the headline drawn by code — as a new
// batch on the internal TEST project. Prints each result.
//   node --env-file=.env.local scripts/thumbnailPackProof.mjs 1,13,16,29,31,40
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const nums = (process.argv[2] ?? "1,13,16,29,31,40").split(",").map(Number);
// People in each prompt (for the face / extras checks) and its main object (for the look).
const META = {
  1: { people: 2, hook: "a hunter-gatherer hugging a child beside a pile of cold sticks" }, 13: { people: 2, hook: "a helmet with two huge curved horns" },
  16: { people: 1, hook: "a gigantic flat red alarm clock with angry eyebrows" }, 29: { people: 1, hook: "a giant woolly mammoth" },
  31: { people: 1, hook: "an enormous orange-and-yellow star" }, 40: { people: 2, hook: "a giant pile of gold coins" },
};
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { PACK } = await import("../supabase/functions/_shared/stickman/thumbnailPack.gen.ts").catch(async () => {
  // Node can't import .ts: read the generated file's JSON.
  const src = (await import("node:fs")).readFileSync("supabase/functions/_shared/stickman/thumbnailPack.gen.ts", "utf8");
  return { PACK: JSON.parse(src.slice(src.indexOf("export const PACK: PackExample[] = ") + 35).replace(/;\s*$/, "")) };
});
const out = execSync(`npx supabase db query --linked "select decrypted_secret as s from vault.decrypted_secrets where name='long_form_autopilot_secret' order by created_at desc limit 1;"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const secret = JSON.parse(out.slice(out.indexOf("{"))).rows[0].s;
const { data: last } = await admin.from("long_form_thumbnails").select("batch").eq("project_id", TEST_PROJECT).order("batch", { ascending: false }).limit(1).maybeSingle();
const batch = (last?.batch ?? 0) + 1;
const rows = nums.map((n, slot) => { const e = PACK.find((x) => x.n === n); return { project_id: TEST_PROJECT, batch, slot, status: "queued", version: 2, prompt: e.prompt, headline: e.headline, concept: { pack: n, archetype: e.archetype, niche: e.niche, hookObject: META[n]?.hook ?? "", cast: Array(META[n]?.people ?? 1).fill("pack") }, credits_charged: 0 }; });
const { data: made, error } = await admin.from("long_form_thumbnails").insert(rows).select("id, slot, concept");
if (error) throw error;
console.log(`batch ${batch}: ${made.length} rows`);
const t0 = Date.now();
await Promise.all(made.map(async (r) => {
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/long-form-thumbnails`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "x-autopilot-secret": secret }, body: JSON.stringify({ action: "draw", id: r.id }) });
  console.log(`#${r.concept.pack} draw ${res.status} ${(await res.text()).slice(0, 80)} (${Math.round((Date.now() - t0) / 1000)}s)`);
}));
const { data: done } = await admin.from("long_form_thumbnails").select("id, slot, status, headline, flagged, cost_usd, checks, full_url, png_url, error, concept").eq("project_id", TEST_PROJECT).eq("batch", batch).order("slot");
for (const d of done) console.log(JSON.stringify({ n: d.concept.pack, status: d.status, headline: d.headline, flagged: d.flagged, cost: Number(d.cost_usd), tries: d.checks?.tries, topFix: d.checks?.topFix, face: d.checks?.faceShare, contrast: d.checks?.contrast, grey: d.checks?.grey, subjH: d.checks?.subjectHeight, topRow: d.checks?.topClear, people: d.checks?.people, hook: d.checks?.hookVisible, ocr: d.checks?.ocr, id: d.id, error: d.error }));
