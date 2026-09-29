// deno-lint-ignore-file no-explicit-any
// Phase 4b — verification renders (paid, <= $0.40). Usage:
//   npx -y deno@2.9.6 run -A --no-check scripts/phase4bVerify.ts
// Beats 7, 69, 125 (concept recipes, handwritten) + 117, 10, 111 (style fix),
// each on V3 (Nano Banana 2 Lite, model text + OCR check) and V2 (FLUX +
// programmatic overlay), through the real tier pipeline (renderTiers.renderBeat):
// render -> QA (gpt-4o-mini high, text verdict from OCR in code) -> upscale ->
// 1920x1080 -> overlay. State is saved after every beat; no retries of a run.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { renderBeat, STICKMAN_QA, textMatches, normalizeText, type Tier, type QaVerdict } from "../supabase/functions/_shared/stickman/renderTiers.ts";
import { compileBeatPrompt, compilePlan, canonicalSetFromBible, plantFrameFor } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { postProcessSceneImage } from "../supabase/functions/_shared/stickman/sceneImagePost.ts";
import { overlayText } from "../supabase/functions/_shared/stickman/textOverlay.ts";

const root = new URL("../", import.meta.url);
const env: Record<string, string> = {};
for (const f of [".env", ".env.local"]) {
  try { for (const line of (await Deno.readTextFile(new URL(f, root))).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; } } catch { /* optional */ }
}
const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY, OPENAI_KEY = env.OPENAI_API_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const CAP = 0.4;
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const recorded = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const fixture = await read("tests/fixtures/stickman/bibles/myth-vs-reality.canonical.json");
const { _note: _a, ...annotations } = await read("tests/fixtures/stickman/beats/myth-vs-reality.annotations.json");
const { _note: _b, ...concepts } = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase4b-concepts.json");
for (const [k, v] of Object.entries(concepts)) annotations[k] = { ...(annotations[k] ?? {}), ...(v as any) };

const BEATS = [7, 69, 125, 117, 10, 111];
const TIERS: Tier[] = ["V3", "V2"];
const set = canonicalSetFromBible(recorded.bible, fixture);
// Beats with their annotations applied (worn helmet, handwritten concepts) — via compilePlan's own path.
const applied = new Map<number, any>();
{
  const ann = annotations as Record<string, any>;
  for (const b of retimed.beats) {
    const a = ann[String(b.sequence)];
    const contract = a ? { ...b.contract, ...(a._contract ?? {}) } : b.contract;
    applied.set(b.sequence, { ...b, contract: { ...contract, subjects: (contract.subjects ?? []).map((s: any) => ({ ...s, ...((a ?? {})[s.castId] ?? {}) })) } });
  }
}
const plantFrame = plantFrameFor(retimed.beats, set);
const planCheck = compilePlan(retimed.beats, recorded.bible, { fixture, annotations });
if (planCheck.prompts.some((p) => p.lintErrors.length)) throw new Error("lint errors in the recompiled plan: " + JSON.stringify(planCheck.prompts.filter((p) => p.lintErrors.length).map((p) => [p.sequence, p.lintErrors])));

const statePath = new URL("docs/phase4/verify-4b-state.json", root);
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = {}; }
st.runs ??= {};
const spent = () => Object.values(st.runs).reduce((a: number, r: any) => a + (r.cost ?? 0), 0) + (st.qaCost ?? 0);
const save = () => Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
const ledger = (stage: string, provider: string, model: string, units: any, usd: number, estimated: boolean) => admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage, provider, model, units, usd, estimated, source_table: "phase4b_verify" });

const proxy = async (task: any) => { const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) }); return await r.json(); };
const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

const QA_SCHEMA = { type: "object", additionalProperties: false, required: ["ocr", "style", "cast", "concept"], properties: { ocr: { type: "string" }, style: { type: "boolean" }, cast: { type: "boolean" }, concept: { type: "boolean" } } };
async function qa(imageURL: string, contract: any): Promise<QaVerdict & { cost: number }> {
  const img = await Image.decode(await fetchBytes(imageURL));
  img.resize(STICKMAN_QA.imageWidth, Image.RESIZE_AUTO);
  const b64 = encodeBase64(await img.encodeJPEG(85));
  const cast = (contract.subjects ?? []).map((s: any) => set.cast[s.castId]?.displayName).filter(Boolean);
  const prompt = [
    `Frame from a flat 2D stickman explainer. Intended picture: ${contract.visualConcept}`,
    cast.length ? `Required people: ${cast.join("; ")}.` : "No specific people required.",
    "ocr: transcribe ALL readable text exactly as written ('' if none; ignore a lone ? or !).",
    "style: true stickmen — circle heads, arms and legs as thin black stick lines (not filled trouser legs or sleeves), mitten hands; flat, no shading or 3D.",
    "cast: the required people are present. concept: it shows the intended picture.",
  ].join("\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: STICKMAN_QA.model, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: STICKMAN_QA.detail } }] }], response_format: { type: "json_schema", json_schema: { name: "qa", strict: true, schema: QA_SCHEMA } } }) });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`qa ${res.status}`);
  const out = JSON.parse(j.choices[0].message.content);
  const cost = (j.usage.prompt_tokens * 0.15 + j.usage.completion_tokens * 0.6) / 1e6;
  await ledger("qa", "openai", STICKMAN_QA.model, { calls: 1, inputTokens: j.usage.prompt_tokens, outputTokens: j.usage.completion_tokens, purpose: "phase4b verify" }, cost, true);
  // Text verdict in code from the OCR (the gating check); the rest is advisory.
  const t = contract.textIntent ?? { mode: "NO_TEXT" };
  const ocr = String(out.ocr ?? "").replace(/[?!]/g, " ").trim();
  const textOk = t.mode === "SHORT_TEXT" ? normalizeText(ocr) === normalizeText(t.text) : normalizeText(ocr) === "";
  const score = (textOk ? 2 : 0) + [out.style, out.cast, out.concept].filter(Boolean).length;
  return { pass: textOk, score: score / 5, ocrText: t.mode === "SHORT_TEXT" && !textOk ? ocr : (t.mode === "SHORT_TEXT" ? String(t.text) : ocr), notes: JSON.stringify({ ocr: out.ocr, style: out.style, cast: out.cast, concept: out.concept }), cost };
}

for (const tier of TIERS) for (const seq of BEATS) {
  const key = `${tier}:${seq}`;
  if (st.runs[key]?.file || st.runs[key]?.error) continue;
  if (spent() + (tier === "V3" ? 0.12 : 0.02) > CAP) { console.log(`CAP: stop before ${key} ($${spent().toFixed(4)} spent)`); break; }
  const beat = applied.get(seq);
  const log: any[] = [];
  try {
    const r = await renderBeat(tier, { startMs: beat.startMs, contract: beat.contract }, {
      compile: (c) => { const p = compileBeatPrompt({ ...beat, contract: c }, set, { plantFrame }); if (p.lintErrors.length) throw new Error(`lint ${p.lintErrors}`); log.push({ prompt: p.prompt }); return p; },
      render: async (task) => { const r = await proxy(task); if (!r.ok) throw new Error(`render ${JSON.stringify(r.error).slice(0, 200)}`); await ledger("images", "runware", task.model, { calls: 1, images: 1, purpose: "phase4b verify", tier, beat: seq, latencyMs: r.latencyMs }, r.result.cost, false); return { imageURL: r.result.imageURL, cost: r.result.cost }; },
      qa: (url, c) => qa(url, c),
      postProcess: async (url) => { const p = await postProcessSceneImage({ originalUrl: url, tier, fetchBytes, upscale: async (task) => { const u = await proxy(task); if (!u.ok) throw new Error("upscale"); await ledger("image_upscale", "runware", task.model, { calls: 1, images: 1, purpose: "phase4b verify" }, u.result.cost, false); return { imageURL: u.result.imageURL, cost: u.result.cost, latencyMs: u.latencyMs }; } }); return { bytes: p.final.bytes, cost: p.upscaled?.cost ?? 0 }; },
      overlay: async (bytes, text) => (await overlayText(bytes, text)).bytes,
    });
    const file = `docs/phase4/images/4b-${tier}-${seq}.jpg`;
    await Deno.writeFile(new URL(file, root), r.final);
    st.runs[key] = { tier, seq, file, imageURL: r.imageURL, overlayText: r.overlayText, cost: r.cost, steps: r.log.map((l) => ({ step: l.step, cost: l.cost, qa: l.qa ? { pass: l.qa.pass, score: l.qa.score, notes: l.qa.notes } : undefined })), prompt: log.at(-1)?.prompt };
    console.log(`✓ ${key} $${r.cost.toFixed(4)} ${r.log.map((l) => l.step).join(" → ")}`);
  } catch (e) {
    st.runs[key] = { tier, seq, error: String(e).slice(0, 400), cost: 0 };
    console.log(`✗ ${key}: ${String(e).slice(0, 200)}`);
  }
  await save();
}
console.log(`DONE $${spent().toFixed(4)}`);
