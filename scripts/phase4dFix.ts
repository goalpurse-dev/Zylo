// deno-lint-ignore-file no-explicit-any
// Phase 4d — fix the V2 faults found in the by-eye review, re-render ONLY the
// tagged beats (paid, step cap $0.20).
// Usage:
//   npx -y deno@2.9.6 run -A --no-check scripts/phase4dFix.ts --director      # one batched Sonnet 5 call for the concept beats
//   npx -y deno@2.9.6 run -A --no-check scripts/phase4dFix.ts --render [N]    # re-render the tagged beats, most severe first
// Concept beats (IP, filler, repeat, wrong concept) get a fresh contract from
// the director; every other tagged beat is only recompiled under the new
// compiler rules (no people, no faces, cases, no text). Resumable; never retries.
import { runV2Beat, root, admin, PROJECT_ID, SUPABASE_URL, SERVICE_KEY } from "./lib/v2Runner.ts";
import { canonicalSetFromBible, plantFrameFor, compileBeatPrompt } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { compileOptionsFor } from "../supabase/functions/_shared/stickman/renderTiers.ts";
import { buildBibleIndex, buildBeatSchema, directorSystemPrompt, redirectUserPrompt, parseBeatsOutput, normalizeBeat, contentIssues, sonnetCostUsd, BEAT_DIRECTOR_MODEL } from "../supabase/functions/_shared/stickman/beatDirector.ts";

const STEP_CAP = 0.27; // raised by the user (covers all 68 re-renders + the director call)
const PER_BEAT = 0.0035; // V2 render + upscale with headroom ($0.00307 measured)
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const write = (p: string, v: any) => Deno.writeTextFile(new URL(p, root), JSON.stringify(v, null, 1));
const base = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase4c3.json");
const props = await read("tests/fixtures/stickman/bibles/myth-vs-reality.phase4d-props.json");
const tags: Record<string, number[]> = (await read("docs/phase4/fullset/review-tags.json")).tags;
const DIR = "docs/phase4/fix4d";
await Deno.mkdir(new URL(`${DIR}/`, root), { recursive: true });
const statePath = `${DIR}/state.json`;
let st: any = {};
try { st = await read(statePath); } catch { st = {}; }
st.beats ??= {};
const save = () => write(statePath, st);

// ---- bible: the prop patch (plain-word blocks for named objects) ----
const bible = structuredClone(base.bible);
bible.objectLanguage = bible.objectLanguage.map((o: any) => props.replace[o.id] ? { ...o, promptBlock: props.replace[o.id] } : o);
for (const a of props.add) bible.objectLanguage.push({ id: a.id, promptBlock: a.promptBlock, canonicalDescription: a.promptBlock, whyRecurring: "Phase 4d: a named object the script depends on." });
// Hand-written cast the script needs (beat 50: the 1942 bog workers).
for (const a of props.addCast ?? []) bible.roleArchetypes.push({ id: a.id, role: a.role, canonicalAppearance: `${a.identity.displayName}: a stickman wearing ${a.identity.outfit}.`, usedFor: "Phase 4d hand fix.", identity: a.identity, outfitVariants: [] });

// ---- targets ----
const tagsOf = (n: number) => Object.entries(tags).filter(([, v]) => v.includes(n)).map(([k]) => k);
const all = [...new Set(Object.values(tags).flat())].sort((a, b) => a - b);
const CONCEPT_TAGS = ["REAL_BRAND_IP", "FILLER", "REPEAT", "WRONG_CONCEPT"];
const directorBeats = all.filter((n) => tagsOf(n).some((t) => CONCEPT_TAGS.includes(t)));
const SPECIFIC: Record<number, string> = {
  23: "the image drew a literal skull — show the helmet fragment object instead (no skull, no bones)",
  44: "the image drew live people fighting — show a flat stone slab carving (an object) of warriors without horns; nobody alive in the frame",
  50: "the workers were drawn as the priest and the warrior — show only workers' hands (or tiny distant figures) lifting two bronze helmets from bog mud, never the priest or warrior",
};
const TAG_FIX: Record<string, string> = {
  REAL_BRAND_IP: "it showed a real team logo / copyrighted character — use a generic equivalent (the team_horned_logo prop; a 1930s comic-book space hero), never the real mark",
  FILLER: "it rendered as a person standing with a headline — carry the idea with an object, comparison, scale, gesture or before/after that works with NO text in the picture",
  REPEAT: "it repeats its neighbours' composition (a person beside a display case) — change the subject, viewpoint or place",
  WRONG_CONCEPT: "the picture missed the line",
  FIGURE_IN_CASE: "a stickman appeared where an object should be — objects only, omit cast unless a person is truly needed",
  OBJECT_HAS_FACE: "an object got a face — objects never have faces or limbs",
  STRAY_TEXT: "letters appeared in the picture — nothing that needs text",
};
const fixFor = (n: number) => [SPECIFIC[n], ...tagsOf(n).filter((t) => !(t === "WRONG_CONCEPT" && SPECIFIC[n])).map((t) => TAG_FIX[t])].filter(Boolean).join("; ");

// ---- director: ONE batched call for the concept beats ----
async function runDirector() {
  if (st.director) { console.log(`director already ran ($${st.director.cost})`); return; }
  const index = buildBibleIndex(bible);
  const system = directorSystemPrompt(index, bible, base.callback);
  const user = redirectUserPrompt(base.beats, directorBeats.map((sequence) => ({ sequence, fix: fixFor(sequence) })), index);
  const r = await fetch(`${SUPABASE_URL}/functions/v1/anthropic-director-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: BEAT_DIRECTOR_MODEL, system, user, schema: buildBeatSchema(index), toolName: "direct_beats", maxTokens: 6000 }) });
  const res = await r.json();
  // Test project: the exchange is recorded for offline diagnosis.
  await write("tests/fixtures/stickman/beats/myth-vs-reality.phase4d.redirect.cassette.json", { recordedAt: new Date().toISOString(), targets: directorBeats, ...res });
  const u = res.response?.usage ?? {};
  const usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
  const cost = sonnetCostUsd(usage);
  await admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage: "beats", provider: "anthropic", model: BEAT_DIRECTOR_MODEL, units: { calls: 1, ...usage, beats: directorBeats.length }, usd: cost, estimated: false, source_table: "phase4d_redirect" });
  if (!res.ok) throw new Error(`director call failed ${res.status}: ${JSON.stringify(res.response).slice(0, 300)} ($${cost})`);
  await processDirector(res, cost, usage);
}

// Re-reads the recorded response (no new call) — used after an offline fix.
async function reparseDirector() {
  const res = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase4d.redirect.cassette.json");
  const u = res.response?.usage ?? {};
  const usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
  await processDirector(res, sonnetCostUsd(usage), usage);
}

async function processDirector(res: any, cost: number, usage: any) {
  const { out, hard } = contractsFrom(res, directorBeats, cost);
  // Same rule as the director's fill: a rewrite the model skipped keeps its
  // old contract with a warning (the first run skipped B46) — never HARD.
  const kept = directorBeats.filter((n) => !out[n]);
  st.director = { cost, usage, latencyMs: res.latencyMs, beats: out, hard, keptOld: kept };
  await save();
  if (hard.length) throw new Error(`director HARD issues (no retry): ${hard.join("; ")}`);
  console.log(`director ok: ${Object.keys(out).length} contracts, kept old ${kept.length ? kept.join(",") : "none"}, $${cost} (${JSON.stringify(usage)}), ${res.latencyMs}ms`);
}

// Phase 5a: ONE automatic re-ask for the beats the director skipped (just those).
async function reaskSkipped() {
  const targets: number[] = st.director?.keptOld ?? [];
  if (!targets.length || st.reask) { console.log(`re-ask: nothing to do (${st.reask ? "already ran" : "no skipped beats"})`); return; }
  const index = buildBibleIndex(bible);
  const system = directorSystemPrompt(index, bible, base.callback);
  const user = redirectUserPrompt(base.beats, targets.map((sequence) => ({ sequence, fix: fixFor(sequence) })), index);
  const r = await fetch(`${SUPABASE_URL}/functions/v1/anthropic-director-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: BEAT_DIRECTOR_MODEL, system, user, schema: buildBeatSchema(index), toolName: "direct_beats", maxTokens: 1500, cache: false }) });
  const res = await r.json();
  await write("tests/fixtures/stickman/beats/myth-vs-reality.phase5a.reask.cassette.json", { recordedAt: new Date().toISOString(), targets, ...res });
  const u = res.response?.usage ?? {};
  const usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
  const cost = sonnetCostUsd(usage);
  await admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage: "beats", provider: "anthropic", model: BEAT_DIRECTOR_MODEL, units: { calls: 1, ...usage, beats: targets.length }, usd: cost, estimated: false, source_table: "phase5a_reask" });
  if (!res.ok) throw new Error(`re-ask failed ${res.status}: ${JSON.stringify(res.response).slice(0, 300)} ($${cost})`);
  const { out, hard } = contractsFrom(res, targets, cost);
  st.reask = { cost, usage, beats: out, hard, stillMissing: targets.filter((n) => !out[n]) };
  Object.assign(st.director.beats, out);
  st.director.keptOld = st.reask.stillMissing;
  await save();
  if (hard.length) throw new Error(`re-ask HARD issues (no retry): ${hard.join("; ")}`);
  console.log(`re-ask ok: ${Object.keys(out).length}/${targets.length} contracts, still missing ${st.reask.stillMissing.join(",") || "none"}, $${cost}`);
}

function contractsFrom(res: any, targets: number[], cost: number) {
  const index = buildBibleIndex(bible);
  const block = (res.response?.content ?? []).find((c: any) => c.type === "tool_use");
  const parsed = parseBeatsOutput(block?.input);
  if (parsed.error) throw new Error(`director output unparseable: ${parsed.error} ($${cost})`);
  const castIds = new Set(index.cast.map((c) => c.id)), settingIds = new Set(index.settings.map((s) => s.id)), propIds = new Set(index.props.map((p) => p.id));
  const out: Record<number, any> = {};
  const hard: string[] = [];
  for (const raw of parsed.beats) {
    const n = normalizeBeat(raw, index);
    const seq = n.startChunk;
    if (!targets.includes(seq)) { hard.push(`unexpected beat B${seq}`); continue; }
    const { startChunk: _s, endChunk: _e, ...contract } = n;
    for (const s of contract.subjects ?? []) if (!castIds.has(s.castId)) hard.push(`B${seq}: unknown cast ${s.castId}`);
    if (contract.settingId != null && !settingIds.has(contract.settingId)) hard.push(`B${seq}: unknown setting ${contract.settingId}`);
    for (const p of contract.propIds ?? []) if (!propIds.has(p)) hard.push(`B${seq}: unknown prop ${p}`);
    const b = base.beats.find((x: any) => x.sequence === seq);
    const issues = contentIssues(contract, b.narrationText);
    if (issues.some((i) => i.code === "real_ip")) hard.push(`B${seq}: still shows real IP`);
    out[seq] = { ...contract, chunkRange: b.contract.chunkRange, warnings: issues.map((i) => i.code) };
  }
  return { out, hard };
}

// ---- the 4d plan: redirected contracts + props linked by name on recompiled beats ----
function plan4d() {
  const beats = base.beats.map((b: any) => {
    const redirected = st.director?.beats?.[b.sequence];
    let contract = redirected ? (({ warnings: _w, ...c }) => ({ ...b.contract, ...c }))(redirected) : b.contract;
    // Hand fixes the director didn't make (beat 50 kept the warrior).
    const override = props.contractOverrides?.[String(b.sequence)];
    if (override) { const { _note, ...o } = override; contract = { ...contract, ...o, handFixed: true }; }
    if (!redirected && all.includes(b.sequence)) {
      const concept = String(contract.visualConcept ?? "").toLowerCase();
      const carried = new Set([...(contract.propIds ?? []), ...(contract.subjects ?? []).flatMap((s: any) => [...(s.wearing ?? []), ...(s.holding ?? [])])]);
      const linked = props.add.filter((a: any) => !carried.has(a.id) && a.aliases.some((x: string) => concept.includes(x))).map((a: any) => a.id);
      if (linked.length) contract = { ...contract, propIds: [...(contract.propIds ?? []), ...linked] };
    }
    return { ...b, contract };
  });
  return { ...base, bible, beats, phase4d: { redirected: directorBeats, recompiled: all.filter((n) => !directorBeats.includes(n)), propsPatch: "tests/fixtures/stickman/bibles/myth-vs-reality.phase4d-props.json" } };
}

// Most severe first, so the cap cuts the mildest beats.
const SEVERITY: Record<string, number> = { REAL_BRAND_IP: 7, WRONG_CONCEPT: 6, OBJECT_HAS_FACE: 5, FIGURE_IN_CASE: 4, FILLER: 3, STRAY_TEXT: 2, REPEAT: 1 };
const score = (n: number) => Math.max(...tagsOf(n).map((t) => SEVERITY[t])) + tagsOf(n).length * 0.1;
const order = [...all].sort((a, b) => score(b) - score(a) || a - b);

async function render(limit: number) {
  if (!st.director) throw new Error("run --director first");
  const plan = plan4d();
  await write("tests/fixtures/stickman/beats/myth-vs-reality.phase4d.json", plan);
  const set = canonicalSetFromBible(plan.bible);
  const plantFrame = plantFrameFor(plan.beats, set);
  // Offline lint pre-check of every target: a HARD lint stops before any spend.
  const lint = order.map((n) => { const b = plan.beats.find((x: any) => x.sequence === n); return [n, compileBeatPrompt(b, set, { plantFrame, ...compileOptionsFor("V2") }).lintErrors] as const; }).filter(([, e]) => e.length);
  if (lint.length) throw new Error(`lint failures (no spend): ${JSON.stringify(lint)}`);
  if (limit <= 0) { console.log(`lint ok for all ${order.length} targets (no spend)`); return; }
  const spent = () => (st.director?.cost ?? 0) + Object.values(st.beats).reduce((s: number, r: any) => s + (r.cost ?? 0), 0);
  const oi = Deno.args.indexOf("--only");
  const only = oi >= 0 ? Deno.args[oi + 1].split(",").map(Number) : null;
  const queue = (only ?? order).filter((n) => !st.beats[n]).slice(0, limit);
  console.log(`targets ${order.length} (director ${directorBeats.length}), to render now ${queue.length}, spent $${spent().toFixed(4)}`);
  st.startedAt ??= Date.now();
  let saving = Promise.resolve();
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const n = queue.shift()!;
      if (spent() + PER_BEAT > STEP_CAP) { console.log(`CAP: skipping beat ${n}`); st.skipped = [...new Set([...(st.skipped ?? []), n])]; continue; }
      const beat = plan.beats.find((x: any) => x.sequence === n);
      const out = await runV2Beat(beat, set, { dir: DIR, source: "phase4d_fix", plantFrame });
      st.beats[n] = { ...out, tags: tagsOf(n), redirected: directorBeats.includes(n), before: `docs/phase4/fullset/beat-${String(n).padStart(3, "0")}.jpg`, narration: beat.narrationText, startMs: beat.startMs, endMs: beat.endMs, treatment: beat.contract.treatment, conceptBefore: base.beats.find((x: any) => x.sequence === n).contract.visualConcept, conceptAfter: beat.contract.visualConcept };
      console.log(`${out.failed ? "✗" : "✓"} beat ${n} $${out.cost.toFixed(5)}${out.retries ? ` retries ${out.retries}` : ""}${out.error ? ` ${out.error.slice(0, 160)}` : ""}`);
      saving = saving.then(save);
      await saving;
    }
  }));
  st.finishedAt = Date.now();
  await save();
  const rs = Object.values(st.beats) as any[];
  console.log(`DONE rendered ${rs.length}/${order.length} · failed ${rs.filter((r) => r.failed).length} · retries ${rs.reduce((s, r) => s + (r.retries ?? 0), 0)} · skipped ${(st.skipped ?? []).length} · spent $${spent().toFixed(4)}`);
}

// Phase 5a: last image fixes — re-render a hand-picked list into fix5a
// (cap $0.06 including the re-ask). Never retries beyond V2's code-check retry.
async function round2(list: number[], key = "round2", DIR2 = "docs/phase4/fix5a", CAP = 0.06, extraSpent = () => st.reask?.cost ?? 0) {
  await Deno.mkdir(new URL(`${DIR2}/`, root), { recursive: true });
  const plan = plan4d();
  await write(`tests/fixtures/stickman/beats/myth-vs-reality.${key === "round2" ? "phase5a" : "phase5b"}.json`, plan);
  const set = canonicalSetFromBible(plan.bible);
  const plantFrame = plantFrameFor(plan.beats, set);
  const lint = list.map((n) => [n, compileBeatPrompt(plan.beats.find((x: any) => x.sequence === n), set, { plantFrame, ...compileOptionsFor("V2") }).lintErrors] as const).filter(([, e]) => e.length);
  if (lint.length) throw new Error(`lint failures (no spend): ${JSON.stringify(lint)}`);
  st[key] ??= { beats: {} };
  const spent = () => extraSpent() + Object.values(st[key].beats).reduce((s: number, r: any) => s + (r.cost ?? 0), 0);
  const queue = list.filter((n) => !st[key].beats[n]);
  console.log(`round 2: ${queue.length} beats, spent $${spent().toFixed(4)} of $${CAP}`);
  let saving = Promise.resolve();
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const n = queue.shift()!;
      if (spent() + PER_BEAT > CAP) { console.log(`CAP: skipping beat ${n}`); continue; }
      const beat = plan.beats.find((x: any) => x.sequence === n);
      const out = await runV2Beat(beat, set, { dir: DIR2, source: "phase5a_fix", plantFrame });
      st[key].beats[n] = { ...out, previous: (key === "round3" ? st.round2?.beats?.[n]?.files?.preview : null) ?? st.beats[n]?.files?.preview ?? `docs/phase4/fullset/beat-${String(n).padStart(3, "0")}.jpg`, concept: beat.contract.visualConcept };
      console.log(`${out.failed ? "✗" : "✓"} beat ${n} $${out.cost.toFixed(5)}${out.retries ? ` retries ${out.retries}` : ""}${out.error ? ` ${out.error.slice(0, 160)}` : ""}`);
      saving = saving.then(save);
      await saving;
    }
  }));
  await save();
  const rs = Object.values(st[key].beats) as any[];
  console.log(`ROUND 2 DONE ${rs.length}/${list.length} · failed ${rs.filter((r) => r.failed).length} · retries ${rs.reduce((s, r) => s + (r.retries ?? 0), 0)} · spent $${spent().toFixed(4)}`);
}

if (Deno.args.includes("--director")) await runDirector();
if (Deno.args.includes("--reask")) await reaskSkipped();
const r2 = Deno.args.indexOf("--round2");
if (r2 >= 0) await round2(Deno.args[r2 + 1].split(",").map(Number));
// Phase 5b: the last four fixes + the near-blank beat (cap $0.03).
const r3 = Deno.args.indexOf("--round3");
if (r3 >= 0) await round2(Deno.args[r3 + 1].split(",").map(Number), "round3", "docs/phase4/fix5b", 0.03, () => 0);
if (Deno.args.includes("--round2-lint")) {
  const plan = plan4d();
  const set = canonicalSetFromBible(plan.bible);
  const plantFrame = plantFrameFor(plan.beats, set);
  for (const n of (Deno.env.get("LINT") ?? "17,24,41,42,46,58,98,103,119,125,128,131,136").split(",").map(Number)) {
    const p = compileBeatPrompt(plan.beats.find((x: any) => x.sequence === n), set, { plantFrame, ...compileOptionsFor("V2") });
    console.log(`${n} [${p.lintErrors.join(";")}] ${p.positivePrompt.split("\n")[1].slice(0, 230)}`);
  }
}
if (Deno.args.includes("--reparse")) await reparseDirector();
const ri = Deno.args.indexOf("--render");
if (ri >= 0) await render(Number(Deno.args[ri + 1]) || Infinity);
if (Deno.args.includes("--check")) await render(0);
// Header contract over ALL 136 prompts ($0): stickman paragraph iff cast.
if (Deno.args.includes("--lint-all")) {
  const plan = plan4d();
  const set = canonicalSetFromBible(plan.bible);
  const plantFrame = plantFrameFor(plan.beats, set);
  const ps = plan.beats.map((b: any) => ({ b, p: compileBeatPrompt(b, set, { plantFrame, ...compileOptionsFor("V2") }) }));
  const withCast = ps.filter(({ b }) => (b.contract.subjects ?? []).length);
  const noCast = ps.filter(({ b }) => !(b.contract.subjects ?? []).length);
  const bad = ps.filter(({ p }) => p.lintErrors.length).map(({ b, p }) => [b.sequence, p.lintErrors]);
  const warn = ps.filter(({ p }) => p.lintWarnings.includes("people_named_without_cast")).map(({ b }) => b.sequence);
  console.log(`136 prompts: cast ${withCast.length} (stickman paragraph ${withCast.filter(({ p }) => p.positivePrompt.includes("Every person is a stickman")).length}), empty cast ${noCast.length} (stickman paragraph ${noCast.filter(({ p }) => p.positivePrompt.includes("Every person is a stickman")).length}, no-people sentence ${noCast.filter(({ p }) => p.positivePrompt.includes("no stick figures")).length})`);
  console.log(`lint errors: ${JSON.stringify(bad)}; empty cast but people named: [${warn.join(",")}]`);
}
if (Deno.args.includes("--dry")) {
  console.log(`targets ${all.length}: director ${directorBeats.length} [${directorBeats.join(",")}]`);
  console.log(`order: ${order.join(",")}`);
  const index = buildBibleIndex(bible);
  const user = redirectUserPrompt(base.beats, directorBeats.map((sequence) => ({ sequence, fix: fixFor(sequence) })), index);
  const system = directorSystemPrompt(index, bible, base.callback);
  console.log(`system ${system.length} chars, user ${user.length} chars (~${Math.round((system.length + user.length) / 4)} tokens in)`);
  console.log(user.split("\n").slice(0, 8).join("\n"));
}
