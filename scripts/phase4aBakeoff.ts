// deno-lint-ignore-file no-explicit-any
// Phase 4a — image model bake-off (paid, cap $2.20). Usage:
//   npx -y deno@2.9.6 run -A scripts/phase4aBakeoff.ts
// Round A: 10 compiled Myth vs Reality prompts x 5 models, text-to-image only.
// Round B: Nano Banana 2 Lite + ONE character reference on the 4 viewer beats.
// Every image: Real-ESRGAN 2x upscale + exact 1920x1080 (the pipeline step),
// gpt-4o-mini QA (detail low), cost + latency into the cost ledger.
// State is saved after every call (docs/phase4/bakeoff-state.json): a re-run
// never pays twice for work that already finished.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { postProcessSceneImage, type SceneTier } from "../supabase/functions/_shared/stickman/sceneImagePost.ts";

const root = new URL("../", import.meta.url);
const env: Record<string, string> = {};
for (const f of [".env", ".env.local"]) {
  try {
    for (const line of (await Deno.readTextFile(new URL(f, root))).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch { /* optional */ }
}
const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = env.OPENAI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) throw new Error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY");
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const CAP_USD = 2.2;

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const compiled = await read("docs/phase3/myth-vs-reality.prompts.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const canon = await read("tests/fixtures/stickman/bibles/myth-vs-reality.canonical.json");

export const BEATS = [117, 69, 7, 18, 12, 21, 57, 10, 111, 125];
export const VIEWER_BEATS = [117, 57, 10, 111]; // full-body viewer_viking (125 shows the viewer tiny)
export const MODELS = [
  { key: "flux2-klein-9b-kv", label: "FLUX.2 [klein] 9B KV", model: "runware:400@6", width: 1376, height: 768, negative: true, extra: { steps: 4, CFGScale: 3.5, acceleration: "high" }, expected: 0.0017, tier: "V2" as SceneTier, role: "V2 candidate" },
  { key: "qwen-image-2512", label: "Qwen-Image-2512", model: "alibaba:qwen-image@2512", width: 1376, height: 768, negative: true, extra: { steps: 20, CFGScale: 4 }, expected: 0.005, tier: "V2" as SceneTier, role: "V2 backup" },
  { key: "nano-banana-2-lite", label: "Nano Banana 2 Lite", model: "google:nano-banana@2-lite", width: 1376, height: 768, negative: false, extra: {}, expected: 0.034, tier: "V3" as SceneTier, role: "V3 candidate" },
  { key: "nano-banana-2", label: "Nano Banana 2", model: "google:4@3", width: 1376, height: 768, negative: false, extra: {}, expected: 0.07, tier: "V4" as SceneTier, role: "quality benchmark" },
  { key: "recraft-v4", label: "Recraft V4", model: "recraft:v4@0", width: 1344, height: 768, negative: false, extra: {}, expected: 0.04, tier: "V4" as SceneTier, role: "V4 challenger" },
];

const statePath = new URL("docs/phase4/bakeoff-state.json", root);
await Deno.mkdir(new URL("docs/phase4/images/", root), { recursive: true });
let state: any = {};
try { state = JSON.parse(await Deno.readTextFile(statePath)); } catch { state = {}; }
state.renders ??= {}; state.upscales ??= {}; state.qa ??= {}; state.extra ??= {};
const save = () => Deno.writeTextFile(statePath, JSON.stringify(state, null, 1));
const spent = () => [...Object.values(state.renders), ...Object.values(state.upscales), ...Object.values(state.qa), ...Object.values(state.extra)].reduce((s: number, r: any) => s + (Number(r?.cost) || 0), 0);
const guard = (next: number, what: string) => {
  if (spent() + next > CAP_USD) throw new Error(`CAP: $${spent().toFixed(4)} spent + ~$${next} for ${what} would exceed $${CAP_USD}`);
};

async function ledger(stage: string, provider: string, model: string, units: any, usd: number, estimated: boolean) {
  const { error } = await admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage, provider, model, units, usd: Number((usd || 0).toFixed(6)), estimated, source_table: "phase4a_bakeoff" });
  if (error) console.error("ledger insert failed:", error.message);
}

async function runware(task: any): Promise<{ ok: boolean; latencyMs: number; result?: any; error?: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
  return await res.json();
}
const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()!); }));
}

const safe = (label: string, fn: () => Promise<void>) => fn().catch((e) => { console.log(`  ✗ ${label}: ${String(e).slice(0, 300)}`); state.extra[`error:${label}`] = String(e).slice(0, 500); return save(); });
const promptOf = (seq: number) => compiled.prompts.find((p: any) => p.sequence === seq);
const beatOf = (seq: number) => retimed.beats.find((b: any) => b.sequence === seq);

/* ---------------- Round A / B renders ---------------- */
async function render(round: "A" | "B", m: typeof MODELS[number], seq: number, referenceImage?: string) {
  const key = `${round}:${m.key}:${seq}`;
  if (state.renders[key]?.imageURL || state.renders[key]?.error) return;
  const p = promptOf(seq);
  guard(m.expected * 1.5, key);
  const task: any = {
    taskType: "imageInference", model: m.model, width: m.width, height: m.height, numberResults: 1,
    outputType: "URL", outputFormat: "JPG", outputQuality: 95, deliveryMethod: "sync", includeCost: true,
    positivePrompt: m.negative ? p.positivePrompt : p.prompt,
    ...(m.negative ? { negativePrompt: p.negativePrompt } : {}),
    ...m.extra,
    ...(referenceImage ? { inputs: { referenceImages: [referenceImage] } } : {}),
  };
  const r = await runware(task);
  if (!r.ok) {
    state.renders[key] = { round, model: m.key, seq, error: JSON.stringify(r.error).slice(0, 600), latencyMs: r.latencyMs, cost: 0 };
    console.log(`  ✗ ${key}: ${state.renders[key].error.slice(0, 200)}`);
  } else {
    const cost = Number(r.result.cost ?? m.expected);
    const bytes = await fetchBytes(r.result.imageURL);
    const file = `docs/phase4/images/${round}-${m.key}-${seq}.jpg`;
    await Deno.writeFile(new URL(file, root), bytes);
    state.renders[key] = { round, model: m.key, seq, imageURL: r.result.imageURL, file, cost, costReported: r.result.cost != null, latencyMs: r.latencyMs };
    await ledger("image_bakeoff", "runware", m.model, { calls: 1, images: 1, round, beat: seq, latencyMs: r.latencyMs, referenceImages: referenceImage ? 1 : 0 }, cost, r.result.cost == null);
    console.log(`  ✓ ${key} $${cost} ${r.latencyMs}ms`);
  }
  await save();
}

/* ---------------- QA (gpt-4o-mini vision, detail low) ---------------- */
const QA_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["flatStyle", "castPresent", "viewerIdentity", "textRule", "noCollage", "showsConcept", "readableText"],
  properties: Object.fromEntries(["flatStyle", "castPresent", "viewerIdentity", "textRule", "noCollage", "showsConcept"].map((k) => [k, { type: "object", additionalProperties: false, required: ["pass", "note"], properties: { pass: { type: "boolean" }, note: { type: "string" } } }]).concat([["readableText", { type: "string" }]])),
};
function contractBrief(seq: number) {
  const b = beatOf(seq).contract;
  const p = promptOf(seq);
  const cast = (b.subjects ?? []).map((s: any) => { const c = canon.cast[s.castId]; return `${c.displayName} (${s.presence}): ${c.hair}; ${c.outfitShort}; ${c.signature}`; });
  return { treatment: b.treatment, frame: p.prompt.split("\n")[1], cast, text: p.textIntent, viewer: (b.subjects ?? []).some((s: any) => s.castId === "viewer_viking") };
}
async function openai(messages: any[], schema: any, name: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, messages, response_format: { type: "json_schema", json_schema: { name, strict: true, schema } } }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`openai ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const u = j.usage ?? {};
  const cost = ((u.prompt_tokens ?? 0) * 0.15 + (u.completion_tokens ?? 0) * 0.6) / 1_000_000;
  return { out: JSON.parse(j.choices[0].message.content), cost, usage: u };
}
async function qa(key: string) {
  const r = state.renders[key];
  if (!r?.imageURL || state.qa[key]) return;
  guard(0.002, `qa ${key}`);
  const c = contractBrief(r.seq);
  const rules = [
    `Beat contract — treatment ${c.treatment}. Intended picture: ${c.frame}`,
    c.cast.length ? `People who must appear: ${c.cast.join(" | ")}` : "No specific people are required.",
    c.text.mode === "SHORT_TEXT" ? `TEXT RULE: exactly one piece of text reading "${c.text.text}", spelled correctly, and no other text.` : "TEXT RULE: no readable text at all (letters, numbers, labels). A lone drawn ? or ! symbol is allowed.",
    c.viewer ? "viewerIdentity: the viewer is a stickman with short dark-brown hair with a fringe, a forest-green tunic and a round wooden shield. Pass only if those features are visible." : "viewerIdentity: not applicable — pass with note 'n/a'.",
    "flatStyle: flat-color 2D doodle/stickman style — circle heads, stick limbs, mitten hands; FAIL on shading, 3D, realistic faces, visible fingers or photorealism.",
    "noCollage: FAIL if it looks like a collage, a character sheet, a turnaround or multiple panels (unless the intended picture is a split/comparison).",
    "showsConcept: does it show the intended picture? castPresent: are the required people there (count and look)? readableText: transcribe any readable text exactly, or '' if none.",
  ].join("\n");
  const { out, cost, usage } = await openai([
    { role: "system", content: "You are a strict visual QA checker for a flat 2D stickman explainer video. Judge only what is visible. One short note per check." },
    { role: "user", content: [{ type: "text", text: rules }, { type: "image_url", image_url: { url: r.imageURL, detail: "low" } }] },
  ], QA_SCHEMA, "image_qa");
  state.qa[key] = { ...out, cost };
  await ledger("qa", "openai", "gpt-4o-mini", { calls: 1, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, image: key }, cost, true);
  await save();
}

/* ---------------- Upscale + 1920x1080 (the pipeline step) ---------------- */
async function upscale(key: string, tier: SceneTier) {
  const r = state.renders[key];
  if (!r?.imageURL || state.upscales[key]) return;
  guard(0.002, `upscale ${key}`);
  const res = await postProcessSceneImage({
    originalUrl: r.imageURL, tier, fetchBytes,
    upscale: async (task) => {
      const u = await runware(task);
      if (!u.ok) throw new Error(`upscale failed: ${JSON.stringify(u.error).slice(0, 300)}`);
      return { imageURL: u.result.imageURL, cost: u.result.cost ?? null, latencyMs: u.latencyMs };
    },
  });
  const file = `docs/phase4/images/final-${key.replaceAll(":", "-")}.jpg`;
  await Deno.writeFile(new URL(file, root), res.final.bytes);
  const cost = Number(res.upscaled?.cost ?? 0.0006);
  state.upscales[key] = { upscaledURL: res.upscaled?.url, file, cost, costReported: res.upscaled?.cost != null, latencyMs: res.upscaled?.latencyMs, fit: res.final.fit };
  await ledger("image_upscale", "runware", "runware:504@1", { calls: 1, images: 1, factor: 2, image: key, latencyMs: res.upscaled?.latencyMs }, cost, res.upscaled?.cost == null);
  await save();
}

/* ---------------- Round B reference: a clean single-character crop ---------------- */
async function buildReference(): Promise<string> {
  if (state.extra.reference?.dataUri) return state.extra.reference.dataUri;
  const candidates = VIEWER_BEATS.filter((s) => (beatOf(s).contract.subjects ?? []).length === 1).map((s) => `A:nano-banana-2-lite:${s}`).filter((k) => state.renders[k]?.imageURL);
  const score = (k: string) => { const q = state.qa[k]; return q ? ["viewerIdentity", "flatStyle", "castPresent", "noCollage", "showsConcept"].filter((c) => q[c]?.pass).length : 0; };
  const best = candidates.sort((a, b) => score(b) - score(a))[0];
  if (!best) throw new Error("no Nano Banana 2 Lite viewer image to use as a reference");
  const BOX = { type: "object", additionalProperties: false, required: ["x", "y", "w", "h"], properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } } };
  const { out, cost } = await openai([{ role: "user", content: [{ type: "text", text: "Give the bounding box of the main stickman character (the one in a green tunic with a round shield), including head, feet and shield, as fractions 0-1 of the image width/height (x, y = top-left)." }, { type: "image_url", image_url: { url: state.renders[best].imageURL, detail: "low" } }] }], BOX, "bbox");
  const img = await Image.decode(await Deno.readFile(new URL(state.renders[best].file, root)));
  const pad = 0.06;
  const x = Math.max(0, Math.floor((out.x - pad) * img.width));
  const y = Math.max(0, Math.floor((out.y - pad) * img.height));
  const w = Math.min(img.width - x, Math.ceil((out.w + 2 * pad) * img.width));
  const h = Math.min(img.height - y, Math.ceil((out.h + 2 * pad) * img.height));
  img.crop(x, y, w, h);
  const bytes = await img.encodeJPEG(92);
  await Deno.writeFile(new URL("docs/phase4/images/reference-viewer_viking.jpg", root), bytes);
  const dataUri = `data:image/jpeg;base64,${btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))}`;
  state.extra.reference = { from: best, box: out, crop: { x, y, w, h }, cost, dataUri };
  await ledger("qa", "openai", "gpt-4o-mini", { calls: 1, purpose: "reference bbox" }, cost, true);
  await save();
  return dataUri;
}

/* ---------------- Comparisons ---------------- */
async function liteVsFull(seq: number) {
  const k = `cmp:${seq}`;
  const a = state.renders[`A:nano-banana-2-lite:${seq}`], b = state.renders[`A:nano-banana-2:${seq}`];
  if (state.extra[k] || !a?.imageURL || !b?.imageURL) return;
  const S = { type: "object", additionalProperties: false, required: ["verdict", "note"], properties: { verdict: { type: "string", enum: ["as good", "slightly worse", "clearly worse"] }, note: { type: "string" } } };
  const c = contractBrief(seq);
  const { out, cost } = await openai([{ role: "user", content: [{ type: "text", text: `Intended picture: ${c.frame}\nImage 1 is the candidate, image 2 the benchmark. Compared with image 2, is image 1 "as good", "slightly worse" or "clearly worse" as a flat 2D stickman explainer frame showing that picture (style, clarity, correctness, text)? One short note.` }, { type: "image_url", image_url: { url: a.imageURL, detail: "low" } }, { type: "image_url", image_url: { url: b.imageURL, detail: "low" } }] }], S, "cmp");
  state.extra[k] = { ...out, cost };
  await ledger("qa", "openai", "gpt-4o-mini", { calls: 1, purpose: `lite vs nb2 beat ${seq}` }, cost, true);
  await save();
}
async function consistency(label: string, keys: string[]) {
  const k = `consistency:${label}`;
  const urls = keys.map((x) => state.renders[x]?.imageURL).filter(Boolean);
  if (state.extra[k] || urls.length < 2) return;
  const S = { type: "object", additionalProperties: false, required: ["score", "note"], properties: { score: { type: "integer", minimum: 1, maximum: 5 }, note: { type: "string" } } };
  const { out, cost } = await openai([{ role: "user", content: [{ type: "text", text: "Each image should show the SAME stickman character (the viewer: short dark-brown hair with a fringe, forest-green tunic, round wooden shield). Score identity consistency across all images 1-5 (5 = clearly the same character everywhere). Also note any leakage: copied pose or background between images, collage or character-sheet look." }, ...urls.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } }))] }], S, "consistency");
  state.extra[k] = { ...out, images: urls.length, cost };
  await ledger("qa", "openai", "gpt-4o-mini", { calls: 1, purpose: `consistency ${label}` }, cost, true);
  await save();
}

/* ---------------- Run ---------------- */
console.log(`start: spent so far $${spent().toFixed(4)}`);
console.log("ROUND A");
await pool(MODELS.flatMap((m) => BEATS.map((s) => [m, s] as const)), 5, async ([m, s]) => render("A", m, s));
console.log(`after A: $${spent().toFixed(4)}`);
console.log("QA A");
await pool(Object.keys(state.renders).filter((k) => k.startsWith("A:")), 6, (k) => safe(`qa ${k}`, () => qa(k)));
console.log("ROUND B");
const ref = await buildReference();
const lite = MODELS.find((m) => m.key === "nano-banana-2-lite")!;
await pool(VIEWER_BEATS, 4, async (s) => render("B", lite, s, ref));
await pool(Object.keys(state.renders).filter((k) => k.startsWith("B:")), 4, (k) => safe(`qa ${k}`, () => qa(k)));
console.log("UPSCALE");
await pool(Object.keys(state.renders).filter((k) => state.renders[k].imageURL), 5, async (k) => safe(`upscale ${k}`, () => upscale(k, MODELS.find((m) => m.key === state.renders[k].model)!.tier)));
console.log("COMPARE");
await pool(BEATS, 5, (s) => safe(`cmp ${s}`, () => liteVsFull(s)));
for (const m of MODELS) await consistency(`A:${m.key}`, VIEWER_BEATS.map((s) => `A:${m.key}:${s}`));
await consistency("B:nano-banana-2-lite+ref", VIEWER_BEATS.map((s) => `B:nano-banana-2-lite:${s}`));
console.log(`DONE: total $${spent().toFixed(4)}`);
