// deno-lint-ignore-file no-explicit-any
// Phase 4b — QA judge calibration (paid, <= $0.25). Usage:
//   npx -y deno@2.9.6 run -A --no-check scripts/phase4bQaCalibration.ts
// The 50 Round A bake-off images, labeled by eye (style / cast / text / concept),
// judged by gpt-4o-mini (detail "high") and Claude Haiku 4.5 on the SAME 768 px
// downscale. Agreement with the labels + cost per image -> docs/phase4/qa-calibration.json.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const root = new URL("../", import.meta.url);
const env: Record<string, string> = {};
for (const f of [".env", ".env.local"]) {
  try { for (const line of (await Deno.readTextFile(new URL(f, root))).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; } } catch { /* optional */ }
}
const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY, OPENAI_KEY = env.OPENAI_API_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const CAP = 0.25;
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const s = await read("docs/phase4/bakeoff-state.json");
const compiled = await read("docs/phase3/myth-vs-reality.prompts.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const canon = await read("tests/fixtures/stickman/bibles/myth-vs-reality.canonical.json");

const MODELS = ["flux2-klein-9b-kv", "qwen-image-2512", "nano-banana-2-lite", "nano-banana-2", "recraft-v4"];
const BEATS = [117, 69, 7, 18, 12, 21, 57, 10, 111, 125];
// By-eye labels (from full-size review of every Round A image). Listed beats FAIL; others pass.
const FAIL: Record<string, Record<string, number[]>> = {
  style: { "flux2-klein-9b-kv": [117, 18, 12, 57, 10, 111, 125], "qwen-image-2512": [117, 18, 12, 57, 10, 111, 125], "nano-banana-2-lite": [117, 12, 57, 10, 111, 125], "nano-banana-2": [117, 12, 57, 10, 111, 125], "recraft-v4": [117, 7, 18, 12, 21, 57, 10, 111, 125] },
  cast: { "flux2-klein-9b-kv": [], "qwen-image-2512": [], "nano-banana-2-lite": [], "nano-banana-2": [], "recraft-v4": [] },
  text: { "flux2-klein-9b-kv": [117, 21, 10], "qwen-image-2512": [], "nano-banana-2-lite": [21], "nano-banana-2": [69, 21], "recraft-v4": [21] },
  concept: { "flux2-klein-9b-kv": [69, 7, 57, 125], "qwen-image-2512": [69, 7, 57, 125], "nano-banana-2-lite": [7, 125], "nano-banana-2": [7, 125], "recraft-v4": [69, 7, 18, 21, 125] },
};
const label = (dim: string, m: string, b: number) => !FAIL[dim][m].includes(b);

const statePath = new URL("docs/phase4/qa-calibration-state.json", root);
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = {}; }
st.openai ??= {}; st.haiku ??= {};
const save = () => Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
const spent = () => [...Object.values(st.openai), ...Object.values(st.haiku)].reduce((a: number, r: any) => a + (r.cost ?? 0), 0);

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["style", "cast", "text", "concept"],
  properties: {
    style: { type: "object", additionalProperties: false, required: ["pass", "note"], properties: { pass: { type: "boolean" }, note: { type: "string" } } },
    cast: { type: "object", additionalProperties: false, required: ["pass", "note"], properties: { pass: { type: "boolean" }, note: { type: "string" } } },
    text: { type: "object", additionalProperties: false, required: ["pass", "ocr", "note"], properties: { pass: { type: "boolean" }, ocr: { type: "string" }, note: { type: "string" } } },
    concept: { type: "object", additionalProperties: false, required: ["pass", "note"], properties: { pass: { type: "boolean" }, note: { type: "string" } } },
  },
};
function promptFor(seq: number) {
  const b = retimed.beats.find((x: any) => x.sequence === seq).contract;
  const p = compiled.prompts.find((x: any) => x.sequence === seq);
  const cast = (b.subjects ?? []).map((x: any) => `${canon.cast[x.castId].displayName} (${x.presence})`);
  return [
    `Check this frame from a flat 2D stickman explainer video against its brief. Judge only what is visible.`,
    `Intended picture: ${p.prompt.split("\n")[1]}`,
    cast.length ? `Required people: ${cast.join("; ")}.` : "No specific people are required.",
    p.textIntent.mode === "SHORT_TEXT" ? `Text rule: exactly one piece of text reading "${p.textIntent.text}", spelled correctly, and NO other text anywhere.` : "Text rule: no readable text at all. A lone drawn ? or ! symbol is fine.",
    `style: PASS only if every person is a true stickman — circle head, arms and legs as THIN BLACK STICK LINES (not filled trouser legs, sleeves or chunky cartoon bodies), mitten hands without fingers — and the art is flat (no shading, 3D or realistic faces).`,
    `cast: the required people are present. text: transcribe ALL readable text into ocr exactly as written, then pass/fail the text rule. concept: the frame shows the intended picture.`,
  ].join("\n");
}

async function small(file: string) {
  const img = await Image.decode(await Deno.readFile(new URL(file, root)));
  img.resize(768, Image.RESIZE_AUTO);
  return encodeBase64(await img.encodeJPEG(85));
}

async function judgeOpenAI(key: string, b64: string, prompt: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" } }] }], response_format: { type: "json_schema", json_schema: { name: "qa", strict: true, schema: SCHEMA } } }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`openai ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
  const u = j.usage;
  const cost = (u.prompt_tokens * 0.15 + u.completion_tokens * 0.6) / 1e6;
  st.openai[key] = { ...JSON.parse(j.choices[0].message.content), cost, inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens };
  await admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage: "qa", provider: "openai", model: "gpt-4o-mini", units: { calls: 1, inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens, purpose: "qa calibration", detail: "high" }, usd: cost, estimated: true, source_table: "phase4b_qa_calibration" });
}
async function judgeHaiku(key: string, b64: string, prompt: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/anthropic-vision-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", imageBase64: b64, prompt, schema: SCHEMA }) });
  const j: any = await res.json();
  if (!j.ok) throw new Error(`haiku ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  const cost = (j.usage.input_tokens * 1 + j.usage.output_tokens * 5) / 1e6;
  st.haiku[key] = { ...j.input, cost, inputTokens: j.usage.input_tokens, outputTokens: j.usage.output_tokens, latencyMs: j.latencyMs };
  await admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage: "qa", provider: "anthropic", model: "claude-haiku-4-5", units: { calls: 1, inputTokens: j.usage.input_tokens, outputTokens: j.usage.output_tokens, purpose: "qa calibration" }, usd: cost, estimated: true, source_table: "phase4b_qa_calibration" });
}

const keys = MODELS.flatMap((m) => BEATS.map((b) => ({ m, b, key: `A:${m}:${b}` })));
const q = [...keys];
await Promise.all(Array.from({ length: 5 }, async () => {
  while (q.length) {
    const { b, key } = q.shift()!;
    if (st.openai[key] && st.haiku[key]) continue;
    if (spent() + 0.006 > CAP) { console.log("CAP reached — stopping"); return; }
    const b64 = await small(s.renders[key].file);
    const prompt = promptFor(b);
    try { if (!st.openai[key]) await judgeOpenAI(key, b64, prompt); } catch (e) { console.log(`openai ${key}: ${e}`); }
    try { if (!st.haiku[key]) await judgeHaiku(key, b64, prompt); } catch (e) { console.log(`haiku ${key}: ${e}`); }
    await save();
  }
}));

const dims = ["style", "cast", "text", "concept"];
const result: any = { labels: "by eye, Round A", n: keys.length, judges: {} };
for (const [name, J] of [["gpt-4o-mini (detail high)", st.openai], ["claude-haiku-4.5", st.haiku]] as const) {
  const agree: any = {};
  for (const d of dims) { const ks = keys.filter((k) => J[k.key]); agree[d] = ks.filter((k) => J[k.key][d].pass === label(d, k.m, k.b)).length / ks.length; }
  const ks = keys.filter((k) => J[k.key]);
  const cost = ks.reduce((a, k) => a + J[k.key].cost, 0) / ks.length;
  const falsePassText = keys.filter((k) => J[k.key] && J[k.key].text.pass && !label("text", k.m, k.b)).map((k) => k.key);
  result.judges[name] = { judged: ks.length, agreement: agree, costPerImage: cost, falsePassText };
}
result.spent = spent();
await Deno.writeTextFile(new URL("docs/phase4/qa-calibration.json", root), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
