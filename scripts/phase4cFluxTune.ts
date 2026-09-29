// deno-lint-ignore-file no-explicit-any
// Phase 4c — FLUX V2 tuning mini-test (paid, <= $0.10). Usage:
//   npx -y deno@2.9.6 run -A --no-check scripts/phase4cFluxTune.ts
// Beats 7, 10, 111, 117 (with the 4b concept + worn-helmet annotations) on:
//   a) klein 9B KV 1376x768, 4 steps + Real-ESRGAN 2x
//   b) klein 9B KV 1376x768, 8 steps + upscale
//   c) klein 9B Base (runware:400@3) 1376x768, default steps + upscale
//   d) klein 9B KV 2048x1152 native, 4 steps, no upscale (resize to 1920x1080)
// V2 text policy (overlay) and the new "flames, fire" negative rule apply to all.
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderTask, contractForTier } from "../supabase/functions/_shared/stickman/renderTiers.ts";
import { compileBeatPrompt, canonicalSetFromBible, plantFrameFor } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { postProcessSceneImage, toTarget } from "../supabase/functions/_shared/stickman/sceneImagePost.ts";
import { overlayText } from "../supabase/functions/_shared/stickman/textOverlay.ts";

const root = new URL("../", import.meta.url);
const env: Record<string, string> = {};
for (const f of [".env", ".env.local"]) {
  try { for (const line of (await Deno.readTextFile(new URL(f, root))).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; } } catch { /* optional */ }
}
const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const CAP = 0.1;
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const recorded = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const fixture = await read("tests/fixtures/stickman/bibles/myth-vs-reality.canonical.json");
const { _note: _a, ...ann } = await read("tests/fixtures/stickman/beats/myth-vs-reality.annotations.json");
const { _note: _b, ...concepts } = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase4b-concepts.json");
for (const [k, v] of Object.entries(concepts)) (ann as any)[k] = { ...((ann as any)[k] ?? {}), ...(v as any) };
const set = canonicalSetFromBible(recorded.bible, fixture);
const plantFrame = plantFrameFor(retimed.beats, set);
const applied = (seq: number) => {
  const b = retimed.beats.find((x: any) => x.sequence === seq);
  const a = (ann as any)[String(seq)];
  const contract = a ? { ...b.contract, ...(a._contract ?? {}) } : b.contract;
  return { ...b, contract: { ...contract, subjects: (contract.subjects ?? []).map((s: any) => ({ ...s, ...((a ?? {})[s.castId] ?? {}) })) } };
};

export const VARIANTS = [
  { key: "a", label: "KV · 4 steps · upscale", override: { model: "runware:400@6", width: 1376, height: 768, steps: 4 }, upscale: true },
  { key: "b", label: "KV · 8 steps · upscale", override: { model: "runware:400@6", width: 1376, height: 768, steps: 8 }, upscale: true },
  { key: "c", label: "9B Base · default steps · upscale", override: { model: "runware:400@3", width: 1376, height: 768, steps: undefined }, upscale: true },
  { key: "d", label: "KV · 2048×1152 native · 4 steps · no upscale", override: { model: "runware:400@6", width: 2048, height: 1152, steps: 4 }, upscale: false },
];
export const BEATS = [7, 10, 111, 117];

const statePath = new URL("docs/phase4/flux-tune-state.json", root);
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = {}; }
st.runs ??= {};
const spent = () => Object.values(st.runs).reduce((s: number, r: any) => s + (r.renderCost ?? 0) + (r.upscaleCost ?? 0), 0);
const save = () => Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
const proxy = async (task: any) => { const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) }); return await r.json(); };
const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
const ledger = (stage: string, model: string, units: any, usd: number) => admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage, provider: "runware", model, units, usd, estimated: false, source_table: "phase4c_flux_tune" });

for (const v of VARIANTS) for (const seq of BEATS) {
  const key = `${v.key}:${seq}`;
  if (st.runs[key]?.file || st.runs[key]?.error) continue;
  if (spent() + 0.012 > CAP) { console.log(`CAP: stop before ${key}`); break; }
  const beat = applied(seq);
  const { contract, overlayText: text } = contractForTier("V2", beat.contract);
  const compiled = compileBeatPrompt({ ...beat, contract }, set, { plantFrame });
  if (compiled.lintErrors.length) throw new Error(`lint ${key}: ${compiled.lintErrors}`);
  const task: any = { ...renderTask("V2", compiled, contract), ...v.override };
  if (task.steps === undefined) delete task.steps;
  try {
    const r = await proxy(task);
    if (!r.ok) throw new Error(JSON.stringify(r.error).slice(0, 300));
    await ledger("images", task.model, { calls: 1, images: 1, variant: v.key, beat: seq, width: task.width, height: task.height, steps: task.steps ?? "default", latencyMs: r.latencyMs }, r.result.cost);
    const original = await fetchBytes(r.result.imageURL);
    await Deno.writeFile(new URL(`docs/phase4/images/4c-${v.key}-${seq}-original.jpg`, root), original);
    let bytes: Uint8Array, upscaleCost = 0;
    if (v.upscale) {
      const p = await postProcessSceneImage({ originalUrl: r.result.imageURL, tier: "V2", fetchBytes, upscale: async (t) => { const u = await proxy(t); if (!u.ok) throw new Error("upscale"); await ledger("image_upscale", t.model, { calls: 1, images: 1, variant: v.key, beat: seq }, u.result.cost); return { imageURL: u.result.imageURL, cost: u.result.cost, latencyMs: u.latencyMs }; } });
      bytes = p.final.bytes; upscaleCost = p.upscaled?.cost ?? 0;
    } else bytes = (await toTarget(original)).bytes;
    if (text) bytes = (await overlayText(bytes, text)).bytes;
    const file = `docs/phase4/images/4c-${v.key}-${seq}.jpg`;
    await Deno.writeFile(new URL(file, root), bytes);
    st.runs[key] = { variant: v.key, seq, file, imageURL: r.result.imageURL, renderCost: r.result.cost, upscaleCost, latencyMs: r.latencyMs, negativeHasFire: String(task.negativePrompt).includes("flames, fire"), prompt: compiled.positivePrompt, negativePrompt: task.negativePrompt };
    console.log(`✓ ${key} render $${r.result.cost} + upscale $${upscaleCost} · ${r.latencyMs}ms · fire-negative ${st.runs[key].negativeHasFire}`);
  } catch (e) {
    st.runs[key] = { variant: v.key, seq, error: String(e).slice(0, 300) };
    console.log(`✗ ${key}: ${String(e).slice(0, 200)}`);
  }
  await save();
}
console.log(`DONE $${spent().toFixed(4)}`);
