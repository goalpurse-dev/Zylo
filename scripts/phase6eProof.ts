// deno-lint-ignore-file no-explicit-any
// Phase 6e-fix PROOF (paid, cap $0.60): re-direct ONLY the worst 15 scenes of
// f90160bc (neighbours as context) under the new rules, recompile them with the
// new compiler rules, and re-render them on V3 (stray-text retry, QA on a
// 768 px copy, 2x upscale). NON-DESTRUCTIVE: the project's scenes are not
// changed — new images go to generated/long-form/proof/<project>/ and a JSON.
// Resumable (state file): nothing is ever paid for twice. Stops before the cap.
//   npx -y deno@2.9.6 run -A --no-check scripts/phase6eProof.ts <outDir>
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildBibleIndex, buildBeatSchema, directorSystemPrompt, redirectUserPrompt, parseBeatsOutput, normalizeBeat, sonnetCostUsd, BEAT_DIRECTOR_MODEL } from "../supabase/functions/_shared/stickman/beatDirector.ts";
import { canonicalSetFromBible, plantFrameFor, compileBeatPrompt } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { renderBeat, compileOptionsFor, STICKMAN_QA, normalizeText, type QaVerdict } from "../supabase/functions/_shared/stickman/renderTiers.ts";
import { DEFAULT_POSTPROCESS } from "../supabase/functions/_shared/stickman/sceneImagePost.ts";

const PROJECT = "f90160bc-8e3c-4210-890f-91b383b5dd81";
const CAP = 0.60;
const WORST_CASE_SCENE = 0.08; // render + stray-text retry + QA x2 + upscale
const WORST: [number, string][] = [
  [35, "a six-panel comic collage — ONE continuous frame: the researcher's hand tracing the tight bone cluster on the ground"],
  [7, "a four-panel collage with three different people — ONE frame: the viewer's own face close, breath fogging in the cold"],
  [22, "garbled model-drawn labels on the lab table — no writing anywhere; show Ian Hodder tilting the spear to show its thrust angle"],
  [139, "garbled labels — no writing anywhere; a person marks the spear's position among the clustered bones at the dig"],
  [54, "model-drawn captions cut off at the edge — no text; the contrast shown inside one frame by someone holding the two points"],
  [106, "model-drawn captions — no text; a researcher kneels over a dense packed bone layer beside one lone bone"],
  [108, "model-drawn words 'NOT JUST LUCK' — no writing in the picture (the headline is an overlay)"],
  [87, "a split frame showing the same researcher twice + labels — one frame, one researcher, no writing"],
  [88, "a split frame showing the same researcher twice + labels — one frame, no writing"],
  [4, "a realistic skin-coloured arm plus two mitten hands — only the viewer's two black mitten hands on thin stick arms"],
  [76, "a lion's head for 'a panting animal' — name the species of this passage (a horse or antelope panting)"],
  [103, "a floating face above mitten hands — a complete person or none; a researcher and the viewer at the bone cluster"],
  [30, "an uninvited split and no prey drawn — one frame: a hunter standing close to a named animal (bison)"],
  [64, "the same pair of hunters duplicated side by side — ONE pair, one frame"],
  [133, "the dying animal is an unreadable blue blob — name the species (a dying bison) and draw it clearly"],
];

const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, OPENAI = env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY;
const admin = createClient(URL_, KEY, { auth: { persistSession: false } });
const outDir = Deno.args[0];
await Deno.mkdir(`${outDir}/after`, { recursive: true });
const statePath = `${outDir}/proof-state.json`;
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = { scenes: {} }; }
const save = () => Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
const spent = () => Number(((st.director?.cost ?? 0) + Object.values(st.scenes).reduce((a: number, s: any) => a + (s.cost ?? 0), 0)).toFixed(5));
const ledger = (stage: string, provider: string, model: string, units: any, usd: number) => admin.from("long_form_cost_ledger").insert({ project_id: PROJECT, stage, provider, model, units: { ...units, purpose: "phase6e proof (non-destructive)" }, usd, estimated: false, source_table: "phase6e_proof" });

const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", PROJECT).single();
const planId = p.autopilot.scenes.planId;
const { data: plan } = await admin.from("long_form_beat_plan_versions").select("production_bible_id, script_version_id").eq("id", planId).single();
const { data: bibleRow } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan.production_bible_id).single();
const { data: script } = await admin.from("long_form_script_versions").select("script_document").eq("id", plan.script_version_id).single();
const bible = bibleRow.bible;
const { data: rows } = await admin.from("long_form_beats").select("sequence, start_word, end_word, start_ms, end_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
const beats = (rows ?? []).map((b: any) => ({ sequence: b.sequence, startWord: b.start_word, endWord: b.end_word, startMs: b.start_ms, endMs: b.end_ms, narrationText: b.narration_text, contract: b.contract }));
const index = buildBibleIndex(bible);
const doc = script.script_document;
const callback = { key: doc?.callbackKey ?? null, plantSegmentId: doc?.plantSegmentIndex != null ? doc.narrationSegments?.[doc.plantSegmentIndex]?.id ?? null : null, payoffSegmentId: doc?.payoffSegmentIndex != null ? doc.narrationSegments?.[doc.payoffSegmentIndex]?.id ?? null : null };

const transform = (path: string, w: number) => `${URL_}/storage/v1/render/image/public/generated/${path}?width=${w}&height=${Math.round((w * 9) / 16)}&resize=contain&quality=85`;

// ---- 0. --dry: offline checks, no spend ----
if (Deno.args.includes("--dry")) {
  const system = directorSystemPrompt(index, bible, callback);
  const user = redirectUserPrompt(beats, WORST.map(([sequence, fix]) => ({ sequence, fix })), index);
  console.log(`beats ${beats.length}, system ${system.length} chars, user ${user.length} chars (~${Math.round((system.length + user.length) / 4)} tokens in); openai key ${OPENAI ? "yes" : "NO"}`);
  const set0 = canonicalSetFromBible(bible);
  const pf = plantFrameFor(beats, set0);
  for (const [n] of WORST) { const b = beats.find((x: any) => x.sequence === n); const o = compileBeatPrompt(b, set0, { plantFrame: pf, ...compileOptionsFor("V3", b.contract) }); console.log(`${n} lint[${o.lintErrors.join(";")}] ${o.prompt.length} chars`); }
  Deno.exit(0);
}

// ---- 1. One targeted re-direct for the 15 (new director rules in the system prompt) ----
if (!st.director) {
  const targets = WORST.map(([sequence, fix]) => ({ sequence, fix }));
  const system = directorSystemPrompt(index, bible, callback);
  const user = redirectUserPrompt(beats, targets, index);
  const r = await fetch(`${URL_}/functions/v1/anthropic-director-proxy`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: BEAT_DIRECTOR_MODEL, system, user, schema: buildBeatSchema(index), toolName: "direct_beats", maxTokens: 4000 }) });
  const res = await r.json();
  const u = res.response?.usage ?? {};
  const usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
  const cost = sonnetCostUsd(usage);
  await ledger("beats", "anthropic", BEAT_DIRECTOR_MODEL, { calls: 1, ...usage, beats: targets.length }, cost);
  await Deno.writeTextFile(`${outDir}/director.cassette.json`, JSON.stringify({ user, response: res.response }));
  if (!res.ok) throw new Error(`director failed ${res.status} ($${cost})`);
  const block = (res.response?.content ?? []).find((c: any) => c.type === "tool_use");
  const parsed = parseBeatsOutput(block?.input);
  if (parsed.error) throw new Error(`director output unparseable: ${parsed.error}`);
  const castIds = new Set(index.cast.map((c) => c.id)), settingIds = new Set(index.settings.map((s) => s.id)), propIds = new Set(index.props.map((x) => x.id));
  const contracts: Record<number, any> = {};
  for (const raw of parsed.beats) {
    const nb = normalizeBeat(raw, index);
    const { startChunk: seq, endChunk: _e, ...contract } = nb;
    const old = beats.find((b: any) => b.sequence === seq);
    if (!old || !WORST.some(([n]) => n === seq)) continue;
    const bad = (contract.subjects ?? []).some((s: any) => !castIds.has(s.castId)) || (contract.settingId != null && !settingIds.has(contract.settingId)) || (contract.propIds ?? []).some((x: string) => !propIds.has(x));
    if (bad) continue;
    contracts[seq] = { ...contract, chunkRange: old.contract.chunkRange, motionIntent: contract.motionIntent ?? old.contract.motionIntent };
  }
  st.director = { cost, usage, contracts, missing: WORST.map(([n]) => n).filter((n) => !contracts[n]) };
  await save();
  console.log(`director: ${Object.keys(contracts).length}/15 contracts, missing ${st.director.missing.join(",") || "none"}, $${cost.toFixed(4)}`);
}

// ---- 2. Recompile + re-render on V3 (new compiler rules, stray-text retry), budget-guarded ----
const set = canonicalSetFromBible(bible);
const newBeats = beats.map((b: any) => (st.director.contracts[b.sequence] ? { ...b, contract: st.director.contracts[b.sequence] } : b));
const plantFrame = plantFrameFor(newBeats, set);
const proxy = async (task: any) => { const r = await fetch(`${URL_}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) }); const j = await r.json(); if (!j.ok) throw new Error(`runware: ${JSON.stringify(j.error ?? j).slice(0, 160)}`); return j; };
const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
const QA_SCHEMA = { type: "object", additionalProperties: false, required: ["ocr", "style", "cast", "concept"], properties: { ocr: { type: "string" }, style: { type: "boolean" }, cast: { type: "boolean" }, concept: { type: "boolean" } } };

for (const [seq] of WORST) {
  if (st.scenes[seq]?.done) continue;
  if (spent() + WORST_CASE_SCENE > CAP) { console.log(`CAP: stopping before scene ${seq} (spent $${spent().toFixed(4)})`); break; }
  const beat = newBeats.find((b: any) => b.sequence === seq);
  const cast = (beat.contract.subjects ?? []).map((s: any) => set.cast?.[s.castId]?.displayName).filter(Boolean);
  let cost = 0;
  const steps: string[] = [];
  const ocrs: string[] = [];
  let prompt = "";
  try {
    const r = await renderBeat("V3", { startMs: beat.startMs, contract: beat.contract }, {
      compile: (c) => { const out = compileBeatPrompt({ ...beat, contract: c }, set, { plantFrame, ...compileOptionsFor("V3", c) }); if (out.lintErrors.length) throw new Error(`prompt check: ${out.lintErrors.join("; ")}`); prompt = out.prompt; return out; },
      render: async (task) => { const res = await proxy(task); const c = Number(res.result.cost ?? 0); cost += c; await ledger("images", "runware", task.model, { calls: 1, images: 1, beat: seq }, c); return { imageURL: res.result.imageURL, cost: c }; },
      qa: async (url, contract): Promise<QaVerdict & { cost: number }> => {
        // Same 768 px copy as the worker: upload once, read through a warmed storage transform.
        const qaPath = `long-form/qa/proof-${seq}-${ocrs.length + 1}.jpg`;
        await admin.storage.from("generated").upload(qaPath, await fetchBytes(url), { contentType: "image/jpeg", upsert: true });
        const small = transform(qaPath, STICKMAN_QA.imageWidth);
        const warm = await fetch(small); await warm.body?.cancel();
        const text = [`Frame from a flat 2D stickman explainer. Intended picture: ${contract.visualConcept}`, cast.length ? `Required people: ${cast.join("; ")}.` : "No specific people required.", "ocr: transcribe ALL readable text exactly as written ('' if none; ignore a lone ? or !).", "style: true stickmen — circle heads, arms and legs as thin black stick lines (not filled trouser legs or sleeves), mitten hands; flat, no shading or 3D.", "cast: the required people are present. concept: it shows the intended picture."].join("\n");
        const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: STICKMAN_QA.model, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: warm.ok ? small : url, detail: STICKMAN_QA.detail } }] }], response_format: { type: "json_schema", json_schema: { name: "qa", strict: true, schema: QA_SCHEMA } } }) });
        const j: any = await res.json();
        if (!res.ok) throw new Error(`qa ${res.status}`);
        const out = JSON.parse(j.choices[0].message.content);
        const qc = (j.usage.prompt_tokens * 0.15 + j.usage.completion_tokens * 0.6) / 1e6;
        cost += qc;
        await ledger("qa", "openai", STICKMAN_QA.model, { calls: 1, beat: seq }, qc);
        const ocr = String(out.ocr ?? "").replace(/[?!]/g, " ").trim();
        ocrs.push(ocr);
        const t = contract.textIntent ?? { mode: "NO_TEXT" };
        const textOk = t.mode === "SHORT_TEXT" ? normalizeText(ocr) === normalizeText(t.text) : normalizeText(ocr) === "";
        return { pass: textOk, score: ((textOk ? 2 : 0) + [out.style, out.cast, out.concept].filter(Boolean).length) / 5, ocrText: ocr, notes: JSON.stringify(out), cost: qc };
      },
      postProcess: async (url) => {
        const up = DEFAULT_POSTPROCESS.upscale.V3;
        const res = await proxy({ taskType: "upscale", model: up.model, upscaleFactor: up.factor, inputs: { image: url }, outputType: "URL", outputFormat: "JPG", outputQuality: 95 });
        const c = Number(res.result.cost ?? 0);
        cost += c;
        await ledger("image_upscale", "runware", up.model, { calls: 1, images: 1, beat: seq }, c);
        return { bytes: await fetchBytes(res.result.imageURL), cost: c };
      },
      overlay: async (b) => b,
    });
    for (const l of r.log) steps.push(l.step);
    const path = `long-form/proof/${PROJECT}/${String(seq).padStart(3, "0")}.jpg`;
    await admin.storage.from("generated").upload(path, r.base, { contentType: "image/jpeg", upsert: true });
    await Deno.writeFile(`${outDir}/after/${String(seq).padStart(3, "0")}.jpg`, await fetchBytes(transform(path, 480)));
    st.scenes[seq] = { done: true, cost: Number(cost.toFixed(5)), steps, ocrs, retries: r.retries, url: admin.storage.from("generated").getPublicUrl(path).data.publicUrl, concept: beat.contract.visualConcept, treatment: beat.contract.treatment, prompt: prompt.slice(0, 1600) };
  } catch (e) {
    st.scenes[seq] = { done: true, failed: String(e).slice(0, 300), cost: Number(cost.toFixed(5)), steps, ocrs };
  }
  await save();
  console.log(`scene ${seq}: ${st.scenes[seq].failed ? "FAILED " + st.scenes[seq].failed : steps.join(" > ")} $${st.scenes[seq].cost} (total $${spent().toFixed(4)})`);
}
console.log(JSON.stringify({ spent: spent(), rendered: Object.values(st.scenes).filter((s: any) => s.done && !s.failed).length, failed: Object.entries(st.scenes).filter(([, s]: any) => s.failed).map(([k]) => k) }));
