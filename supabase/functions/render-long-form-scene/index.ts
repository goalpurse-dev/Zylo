// deno-lint-ignore-file no-explicit-any
// render-long-form-scene/index.ts — internal (x-autopilot-secret) (Phase 6c).
//
// Draws ONE Stickman scene per invocation (so a scene's image work never
// shares the edge CPU budget with another): claim the next queued scene (or
// a given one) with a lease -> compile (style, cast, IP guard) -> render on
// the project's tier (free code checks on V2, AI QA on V3/V4, the tier's
// retries) -> Runware 2x upscale -> the text as an editable layer (never
// burned in). The upscaled master is stored as-is (no re-encode at the edge);
// the renderer scales it at render time. Credits are drawn from the project's
// reservation per finished scene. Every finished scene nudges the autopilot,
// which dispatches the next one at once; the cron watchdog re-queues a scene
// whose worker died (lease expired), then marks it failed.
//
// 2026-10-07, a scene never fails on its first error (stickman/sceneLadder.ts):
// retries with growing waits -> the safe prompt -> a backup model -> COVERED
// (marked failed; the picture before it stays on screen, so nothing waits).
// A failed UPSCALE never fails a scene: one retry, then the original picture is kept.
//
// POST { projectId, userId, sceneId? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { renderBeat, STICKMAN_RENDER_TIERS, STICKMAN_QA, compileOptionsFor, normalizeText, type QaVerdict } from "../_shared/stickman/renderTiers.ts";
import { compileBeatPrompt, canonicalSetFromBible, plantFrameFor, wantsTwoHalves } from "../_shared/stickman/promptCompiler.ts";
import { codeCheckImage, imageDHash } from "../_shared/stickman/imageChecks.ts";
import { overlayText, scaleLayer, type OverlayLayer } from "../_shared/stickman/textOverlay.ts";
import { placeTextLayer } from "../_shared/stickman/textPlacement.ts";
import { DEFAULT_POSTPROCESS } from "../_shared/stickman/sceneImagePost.ts";
import { SCENE_LEASE_S, SCENES_TOTAL_MAX } from "../_shared/stickman/scenes.ts";
import { refundAddon } from "../_shared/stickman/addons.ts";
import { needsTextFreeComposition, safeFallbackContract } from "../_shared/stickman/sceneFallback.ts";
import { BACKUP_TIER, climbLadder, HARD_BUDGET_S, ladderOf, outageDecision, OUTAGE_WINDOW_S, PROVIDER_TIMEOUT_MS, type RungKind } from "../_shared/stickman/sceneLadder.ts";
import { gate, overloadedTooLong, readBreaker, recordOverload, recordSuccess } from "../_shared/modelOverload.ts";
import { alertOnce } from "../_shared/adminAlert.ts";
import { mandatoryStatIntent } from "../_shared/stickman/headlines.ts";
import { checkRunwareGuard, markOutOfBalance, markProviderDown } from "../_shared/runwareBalance.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { nudgeAutopilot } from "../_shared/stickman/autopilotNudge.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const FONT_URL = `${SUPABASE_URL}/storage/v1/object/public/generated/assets/fonts/LilitaOne-Regular.ttf`;
let fontBytes: Uint8Array | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fetchBytes = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
const runware = async (task: any) => {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }), signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  const j: any = await r.json().catch(() => null);
  // The provider's own status and the whole error (its retryAfter is read from it).
  if (!j?.ok) throw new Error(`runware ${j?.status ?? r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 400)}`);
  return j as { result: { imageURL: string; cost: number | null }; latencyMs: number };
};

// V3/V4 AI QA (the Phase 4b calibrated check): OCR decides text in code, the
// rest is advisory. The image URL goes straight to the model (no decode here).
const QA_SCHEMA = { type: "object", additionalProperties: false, required: ["ocr", "style", "cast", "concept"], properties: { ocr: { type: "string" }, style: { type: "boolean" }, cast: { type: "boolean" }, concept: { type: "boolean" } } };
async function aiQa(imageURL: string, contract: any, castNames: string[]): Promise<QaVerdict & { cost: number }> {
  const prompt = [
    `Frame from a flat 2D stickman explainer. Intended picture: ${contract.visualConcept}`,
    castNames.length ? `Required people: ${castNames.join("; ")}.` : "No specific people required.",
    "ocr: transcribe ALL readable text exactly as written ('' if none; ignore a lone ? or !).",
    "style: true stickmen — circle heads, arms and legs as thin black stick lines (not filled trouser legs or sleeves), mitten hands; flat, no shading or 3D.",
    "cast: the required people are present. concept: it shows the intended picture.",
  ].join("\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: STICKMAN_QA.model, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageURL, detail: STICKMAN_QA.detail } }] }], response_format: { type: "json_schema", json_schema: { name: "qa", strict: true, schema: QA_SCHEMA } } }) });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`qa ${res.status}`);
  const out = JSON.parse(j.choices[0].message.content);
  const cost = (j.usage.prompt_tokens * 0.15 + j.usage.completion_tokens * 0.6) / 1e6;
  const t = contract.textIntent ?? { mode: "NO_TEXT" };
  const ocr = String(out.ocr ?? "").replace(/[?!]/g, " ").trim();
  const textOk = t.mode === "SHORT_TEXT" ? normalizeText(ocr) === normalizeText(t.text) : normalizeText(ocr) === "";
  const score = (textOk ? 2 : 0) + [out.style, out.cast, out.concept].filter(Boolean).length;
  return { pass: textOk, score: score / 5, ocrText: t.mode === "SHORT_TEXT" && !textOk ? ocr : (t.mode === "SHORT_TEXT" ? String(t.text) : ocr), notes: JSON.stringify({ style: out.style, cast: out.cast, concept: out.concept }), cost };
}

// A 768 px copy for the AI QA check: upload the render once, then read it
// through a Supabase image transform (no decode/encode at the edge).
async function qaCopyUrl(bytes: Uint8Array, name: string): Promise<string | null> {
  const path = `long-form/qa/${name}.jpg`;
  const { error } = await admin.storage.from("generated").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) return null;
  const url = `${SUPABASE_URL}/storage/v1/render/image/public/generated/${path}?width=${STICKMAN_QA.imageWidth}&height=${Math.round((STICKMAN_QA.imageWidth * 9) / 16)}&resize=contain&quality=85`;
  // Warm the transform first: OpenAI gives up on slow downloads (a cold full-size
  // storage URL timed out in the 6c-polish check); a warmed, cached copy is instant.
  const warm = await fetch(url).catch(() => null);
  if (!warm?.ok) return null;
  await warm.body?.cancel();
  return url;
}

// A paid redraw (add-on) that fails is refunded exactly once.
async function refundSceneAddon(scene: any) {
  const credits = Number(scene.addon_credits ?? 0);
  if (!credits) return;
  const { data: p } = await admin.from("long_form_projects").select("user_id").eq("id", scene.project_id).maybeSingle();
  if (!p) return;
  await admin.from("long_form_scene_images").update({ addon_credits: 0 }).eq("id", scene.id);
  await refundAddon(admin, p.user_id, credits, "scene_failed", logEvent, { projectId: scene.project_id, sceneId: scene.id });
}

async function drawScene(scene: any) {
  const projectId = scene.project_id;
  const tier = scene.tier as "V2" | "V3" | "V4";
  // The tier the picture is really drawn on: the scene's own, or the backup model's at the last step.
  let cfg = STICKMAN_RENDER_TIERS[tier];
  const { data: plan } = await admin.from("long_form_beat_plan_versions").select("id, production_bible_id").eq("id", scene.beat_plan_version_id).single();
  const { data: bible } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan.production_bible_id).single();
  const { data: beats } = await admin.from("long_form_beats").select("sequence, start_word, end_word, start_ms, end_ms, narration_text, contract").eq("beat_plan_version_id", plan.id).order("sequence");
  const toBeat = (b: any) => ({ sequence: b.sequence, startWord: b.start_word, endWord: b.end_word, startMs: b.start_ms, endMs: b.end_ms, narrationText: b.narration_text, contract: b.contract });
  const all = (beats ?? []).map(toBeat);
  const beat = all.find((b: any) => b.sequence === scene.beat_sequence);
  if (!beat) throw new Error("beat not found");
  // "Edit description": the user's words become the picture, through the same compiler.
  if (scene.description_override) beat.contract = { ...beat.contract, visualConcept: scene.description_override, userSummary: scene.description_override };
  // A number/date/stat said over a timeline/chart/symbol is always on screen (plans made before the rule too).
  const stat = mandatoryStatIntent(beat.contract, beat.narrationText);
  if (stat) beat.contract = { ...beat.contract, textIntent: stat };
  const set = canonicalSetFromBible(bible.bible);
  const plantFrame = plantFrameFor(all, set);
  const castNames = (beat.contract.subjects ?? []).map((s: any) => set.cast?.[s.castId]?.displayName).filter(Boolean);
  // One continuous frame unless the beat really asks for two halves.
  const singleFrame = !wantsTwoHalves(beat.contract);

  let original: { url: string; bytes: Uint8Array } | null = null;
  let masterUrl: string | null = null;
  let upscaleSkipped: string | null = null;
  let layer: OverlayLayer | null = null;
  let textBlocked = false;
  // real: the provider returned the price (Runware `cost`) or the real token usage (OpenAI) — not an estimate.
  const costs: { stage: string; model: string; usd: number; real: boolean }[] = [];
  let qaCalls = 0;
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const timed = async <T>(k: string, f: () => Promise<T>): Promise<T> => { const s = Date.now(); try { return await f(); } finally { timings[k] = (timings[k] ?? 0) + Date.now() - s; } };

  const depsFor = (drawTier: "V2" | "V3" | "V4"): Parameters<typeof renderBeat>[2] => ({
    compile: (c) => { const p = compileBeatPrompt({ ...beat, contract: c }, set, { plantFrame, ...compileOptionsFor(drawTier, c) }); if (p.lintErrors.length) throw new Error(`prompt check: ${p.lintErrors.join("; ")}`); return p; },
    render: async (task) => { const res = await timed("renderMs", () => runware(task)); costs.push({ stage: "images", model: task.model, usd: Number(res.result.cost ?? 0), real: res.result.cost != null }); return { imageURL: res.result.imageURL, cost: Number(res.result.cost ?? 0) }; },
    codeCheck: async (url) => {
      const bytes = await timed("fetchOriginalMs", () => fetchBytes(url));
      original = { url, bytes };
      const c = await timed("codeCheckMs", () => codeCheckImage(bytes, { width: cfg.width, height: cfg.height }));
      return { split: singleFrame && c.splitAt != null, pass: c.pass, soft: c.soft, score: c.pass ? 1 : c.soft ? Number((0.5 * (1 - (c.uniformShare ?? 1))).toFixed(3)) : 0, ocrText: "", notes: c.reasons.join("; "), cost: 0 };
    },
    // QA sees a 768 px copy (the Phase 4b calibration size): the full 1376 px
    // render cost ~2.5x more ($0.0056 vs ~$0.0022 per check on f90160bc).
    qa: async (url, contract) => {
      const bytes = await timed("fetchOriginalMs", () => fetchBytes(url));
      original = { url, bytes };
      const small = await timed("qaCopyMs", () => qaCopyUrl(bytes, `${scene.id}-${++qaCalls}`));
      // Fall back to the original render URL if the small copy can't be read.
      const q = small ? await aiQa(small, contract, castNames).catch(() => aiQa(url, contract, castNames)) : await aiQa(url, contract, castNames);
      costs.push({ stage: "qa", model: STICKMAN_QA.model, usd: q.cost, real: true });
      // One continuous frame: the same divider check as V2 ($0, on the original bytes).
      if (singleFrame) { try { const c = await codeCheckImage(bytes, { width: cfg.width, height: cfg.height }); if (c.splitAt != null) return { ...q, split: true }; } catch { /* optional */ } }
      return q;
    },
    // A scene never fails because only the upscale failed: one retry, then the
    // original (non-upscaled) picture is kept and the scene goes on. Logged, to see how often.
    postProcess: async (url) => {
      const up = DEFAULT_POSTPROCESS.upscale[drawTier];
      masterUrl = null; upscaleSkipped = null;
      const errors: string[] = [];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await timed("upscaleMs", () => runware({ taskType: "upscale", model: up.model, upscaleFactor: up.factor, inputs: { image: url }, outputType: "URL", outputFormat: "JPG", outputQuality: 95, includeCost: true }));
          costs.push({ stage: "image_upscale", model: up.model, usd: Number(res.result.cost ?? 0), real: res.result.cost != null });
          const bytes = await timed("fetchMasterMs", () => fetchBytes(res.result.imageURL));
          masterUrl = res.result.imageURL;
          return { bytes, cost: Number(res.result.cost ?? 0) };
        } catch (e) {
          errors.push(String(e).slice(0, 160));
          if (attempt === 1) await sleep(2000);
        }
      }
      upscaleSkipped = errors.at(-1) ?? "upscale failed";
      await logEvent("render-long-form-scene", "warn", "scene_upscale_skipped", { projectId, sceneId: scene.id, beat: beat.sequence, tier: drawTier, model: up.model, errors });
      const kept = original && (original as any).url === url && (original as any).bytes?.length ? (original as any).bytes as Uint8Array : await fetchBytes(url);
      return { bytes: kept, cost: 0 };
    },
    // The text is an editable layer, placed on the small original (cheap), scaled to 1920x1080.
    // Text upgrade: the contract's style (BIG STAT / QUESTION / CALLOUT / HEADLINE),
    // placed clear of faces after one cheap look; no clear spot = no text.
    overlay: async (bytes, text) => {
      fontBytes ??= await fetchBytes(FONT_URL);
      const src = original?.bytes?.length ? original.bytes : await fetchBytes(original!.url);
      const p = await timed("overlayMs", () => placeTextLayer({ bytes: src, imageUrl: original!.url, text, intent: beat.contract.textIntent, font: fontBytes!, openaiKey: OPENAI_KEY }));
      if (p.costUsd) costs.push({ stage: "qa", model: STICKMAN_QA.model, usd: p.costUsd, real: true });
      layer = p.layer;
      textBlocked = p.blocked;
      return bytes;
    },
  });
  // Never leave a hole, never stop on the first error (stickman/sceneLadder.ts): the normal
  // prompt, 3 retries with growing waits, the simplified safe prompt (no in-scene text; words
  // go to the overlay), then the safe prompt on the backup model. The step is kept on the row.
  let r: Awaited<ReturnType<typeof renderBeat>> | null = null;
  let used: RungKind | null = null;
  // V2: a scene built around a screen/card/label is drawn text-free from the start (words -> overlay).
  const textFree = needsTextFreeComposition(tier, beat.contract, set);
  const ladder = ladderOf(scene.qa);
  const failures = ladder.failures;
  // Only a current scene is watched by the autopilot; a split scene's own picture does all its steps here.
  const canDefer = scene.is_current !== false;
  // 2026-10-08, an overloaded model (_shared/modelOverload.ts): while its circuit breaker is open this
  // scene waits (the row keeps its lease until the pause is over; not an attempt, not a ladder step);
  // it resumes 1 at a time, then 2, then normal. Overloaded for more than 5 minutes: this scene is
  // drawn on the backup model (V2 <-> V3) and the owner is emailed.
  const tierModel = STICKMAN_RENDER_TIERS[tier].model;
  const breaker = await readBreaker(admin, tierModel);
  const useBackupModel = overloadedTooLong(breaker, Date.now());
  if (useBackupModel) {
    const backupModel = STICKMAN_RENDER_TIERS[BACKUP_TIER[tier]].model;
    await logEvent("render-long-form-scene", "warn", "overloaded_model_switched_to_backup", { projectId, sceneId: scene.id, beat: beat.sequence, from: tierModel, to: backupModel, since: breaker.since });
    await alertOnce(admin, `overload_switch:${tierModel}`, 1800, `Zyvo: ${tierModel} has been overloaded for over 5 minutes — scenes use ${backupModel}`, `Runware keeps answering "serviceOverloaded" for the Long Form scene model ${tierModel} (since ${breaker.since ?? "?"}).\n\nNew scenes are drawn on its backup model ${backupModel} until it answers again. Nothing failed; videos keep going.`).catch(() => {});
  } else if (canDefer) {
    const { count: ahead } = await admin.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("status", "rendering").eq("tier", tier).gt("lease_until", new Date().toISOString()).lt("started_at", scene.started_at).is("qa->>waiting", null).neq("id", scene.id);
    const g = gate(breaker, Date.now(), ahead ?? 0);
    if (!g.allow) {
      await admin.from("long_form_scene_images").update({ lease_until: new Date(Date.now() + g.waitS * 1000).toISOString(), attempts: Math.max(0, Number(scene.attempts ?? 1) - 1), qa: { ...(scene.qa ?? {}), waiting: "high_demand" } }).eq("id", scene.id);
      return { failed: false, waiting: true };
    }
  }
  // Drawing now: no longer "waiting" (the rows that wait are not counted as in flight).
  if (scene.qa?.waiting) { const { waiting: _w, ...rest } = scene.qa; await admin.from("long_form_scene_images").update({ qa: rest }).eq("id", scene.id); }
  const climb = () => climbLadder({
    state: ladder, canDefer, sleep, elapsedS: () => (Date.now() - t0) / 1000,
    draw: (rung) => {
      const drawTier = rung === "backup" || useBackupModel ? BACKUP_TIER[tier] : tier;
      cfg = STICKMAN_RENDER_TIERS[drawTier];
      const contract = rung !== "normal" || textFree ? safeFallbackContract(beat.contract, set) : beat.contract;
      return renderBeat(drawTier, { startMs: beat.startMs, contract }, depsFor(drawTier));
    },
    // Still this worker's scene: the watchdog must not hand it to a second one.
    renewLease: async () => { await admin.from("long_form_scene_images").update({ lease_until: new Date(Date.now() + SCENE_LEASE_S * 1000).toISOString() }).eq("id", scene.id).eq("status", "rendering"); },
  });
  let out: Awaited<ReturnType<typeof climb>> = await climb();
  // Overloaded: the model's breaker is opened for everyone and this scene waits the provider's
  // retryAfter (+ jitter). A scene the autopilot watches hands itself on; a split scene waits here.
  let overloadWaitS: number | null = null;
  while (out.kind === "overloaded") {
    const opened = await recordOverload(admin, cfg.model, out.retryAfterS, `scene: serviceOverloaded, retryAfter ${out.retryAfterS}`);
    const waitS = Math.max(1, Math.ceil(((opened.until ? Date.parse(opened.until) : Date.now()) - Date.now()) / 1000));
    await logEvent("render-long-form-scene", "warn", "model_overloaded_scene_waits", { projectId, sceneId: scene.id, beat: beat.sequence, model: cfg.model, retryAfterS: out.retryAfterS, waitS });
    if (canDefer) { overloadWaitS = waitS; break; }
    if ((Date.now() - t0) / 1000 + waitS > HARD_BUDGET_S) { out = { kind: "covered", result: null }; break; }
    await sleep(waitS * 1000);
    await admin.from("long_form_scene_images").update({ lease_until: new Date(Date.now() + SCENE_LEASE_S * 1000).toISOString() }).eq("id", scene.id).eq("status", "rendering");
    out = await climb();
  }
  r = out.result;
  used = out.kind === "drawn" ? out.rung : null;
  const outOfBalance = out.kind === "balance" ? out.message : null;
  const deferS = out.kind === "deferred" ? out.waitS : overloadWaitS;
  const ladderState = { step: ladder.step, checks: ladder.checks, failures: failures.slice(-12) };
  // How often this scene already waited for the provider: kept through every wait (or it would wait for ever).
  const keepOutage = scene.qa?.outage ? { outage: scene.qa.outage } : {};
  if (used && used !== "normal") await logEvent("render-long-form-scene", "warn", used === "backup" ? "scene_backup_model" : "scene_safe_fallback", { projectId, sceneId: scene.id, beat: beat.sequence, failures, ...(used === "backup" ? { model: cfg.model } : {}) });
  else if (used && failures.length) await logEvent("render-long-form-scene", "info", "scene_retried_ok", { projectId, sceneId: scene.id, beat: beat.sequence, step: ladder.step, failures });

  for (const c of costs) await recordCost(admin, { projectId, stage: c.stage, provider: c.stage === "qa" ? "openai" : "runware", model: c.model, units: { calls: 1, images: c.stage === "qa" ? 0 : 1, beat: beat.sequence }, usd: c.usd, estimated: !c.real, sourceTable: "long_form_scene_images", sourceId: scene.id });
  // Every attempt's spend (failed tries included, and the tries of earlier workers on this scene).
  const costUsd = Number((Number(scene.cost_usd ?? 0) + costs.reduce((a, c) => a + c.usd, 0)).toFixed(5));
  const notCounted = Math.max(0, Number(scene.attempts ?? 1) - 1);
  if (outOfBalance) {
    // Our Runware account can't pay: the scene WAITS (back to queued, attempt not counted) and drawing pauses.
    await admin.from("long_form_scene_images").update({ status: "queued", lease_until: null, attempts: notCounted, cost_usd: costUsd, qa: { waiting: "provider_balance", ladder: ladderState, ...keepOutage } }).eq("id", scene.id);
    await markOutOfBalance(admin, outOfBalance);
    return { failed: false, waiting: true };
  }
  if (deferS != null) {
    // The next step (or its wait) doesn't fit in this worker: the row keeps its lease until the
    // wait is over, then the watchdog queues it and the next worker carries on from qa.ladder.step.
    await admin.from("long_form_scene_images").update({ lease_until: new Date(Date.now() + deferS * 1000).toISOString(), attempts: notCounted, cost_usd: costUsd, qa: { waiting: overloadWaitS != null ? "high_demand" : "retry", ladder: ladderState, ...keepOutage } }).eq("id", scene.id);
    await logEvent("render-long-form-scene", "info", "scene_retry_deferred", { projectId, sceneId: scene.id, beat: beat.sequence, step: ladder.step, waitS: deferS, last: failures.at(-1) ?? null });
    return { failed: false, waiting: true };
  }
  if (!r || r.failed || !used) {
    // Every step failed. One bad scene is covered (below); a provider that is DOWN is waited out:
    // the scene goes back to the queue from the first step and drawing pauses, then resumes by itself.
    if (canDefer && out.kind === "covered") {
      const { count: readyLately } = await admin.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("status", "ready").gte("ready_at", new Date(Date.now() - OUTAGE_WINDOW_S * 1000).toISOString());
      const { count: pendingOthers } = await admin.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("is_current", true).in("status", ["queued", "rendering"]).neq("id", scene.id);
      const od = outageDecision({ failures: ladderState.failures, readyLately: readyLately ?? 0, pendingOthers: pendingOthers ?? 0, outage: scene.qa?.outage ?? null, nowMs: Date.now() });
      if (od.kind === "wait") {
        await admin.from("long_form_scene_images").update({ status: "queued", lease_until: null, attempts: notCounted, cost_usd: costUsd, qa: { waiting: "provider_outage", outage: od.outage, lastFailures: ladderState.failures.slice(-3) } }).eq("id", scene.id);
        await markProviderDown(admin, ladderState.failures.at(-1) ?? "provider error");
        await logEvent("render-long-form-scene", "warn", "scene_waits_for_provider", { projectId, sceneId: scene.id, beat: beat.sequence, outage: od.outage, last: ladderState.failures.at(-1) ?? null });
        return { failed: false, waiting: true };
      }
    }
    // COVERED: every step failed. The scene is marked failed; the picture before it stays on
    // screen over its time (the edit does it), so the video, the editor and Publish never wait.
    await admin.from("long_form_scene_images").update({ status: "failed", error: "image_failed", cost_usd: costUsd, qa: { covered: true, steps: r?.log.map((l) => l.step) ?? [], failures: ladderState.failures, ladder: ladderState, wallMs: Date.now() - t0 }, lease_until: null }).eq("id", scene.id);
    await logEvent("render-long-form-scene", "error", "scene_covered", { projectId, sceneId: scene.id, beat: beat.sequence, tier, failures: ladderState.failures, costUsd });
    await refundSceneAddon(scene);
    return { failed: true };
  }
  const usedFallback = used !== "normal";
  const path = `long-form/scenes/${projectId}/${String(beat.sequence).padStart(3, "0")}-v${scene.version}.jpg`;
  let upErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    ({ error: upErr } = await timed("uploadMs", () => admin.storage.from("generated").upload(path, r!.base, { contentType: "image/jpeg", upsert: true })));
    if (!upErr) break;
    if (attempt < 3) await sleep(attempt * 2000);
  }
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  const imageUrl = admin.storage.from("generated").getPublicUrl(path).data.publicUrl;
  const soft = r.log.some((l) => l.qa?.soft && !l.qa?.pass);
  // Phase 6c-polish: the only user-facing flags are real image problems.
  // text_mismatch: on V3/V4 the chosen render's words still failed the OCR check.
  const finalQa = [...r.log].reverse().find((l) => l.imageURL === r.imageURL && l.qa)?.qa;
  const textMismatch = cfg.qa !== "code" && finalQa != null && !finalQa.pass;
  // A difference hash of the chosen render, for true near-duplicate flags.
  let dhash: string | null = null;
  try { const ob = original && (original as any).url === r.imageURL && (original as any).bytes?.length ? (original as any).bytes : await fetchBytes(r.imageURL); dhash = await timed("hashMs", () => imageDHash(ob)); } catch { /* optional */ }
  // A regenerated scene keeps the words the user set (the free text edit), re-placed on the new picture.
  let finalText = textBlocked ? null : r.overlayText;
  if (scene.source !== "autopilot" && scene.overlay_text != null && scene.overlay_text !== r.overlayText && original) {
    fontBytes ??= await fetchBytes(FONT_URL);
    const src = (original as any).bytes?.length ? (original as any).bytes : await fetchBytes((original as any).url);
    // The user's own words: always kept (re-placed, no look needed to decide).
    layer = scaleLayer((await overlayText(src, scene.overlay_text, { font: fontBytes })).layer, 1920 / cfg.width);
    finalText = scene.overlay_text;
  }
  // Phase 7 fixed quote: the first pass is included in the video's quote (settled in full at
  // render completion); a regenerate/split was paid at click time (addon_credits). The scene
  // worker never touches the reservation.
  const billed = Number(scene.addon_credits ?? 0) > 0 ? "ADDON_PREPAID" : "INCLUDED";
  await admin.from("long_form_scene_images").update({
    status: "ready", image_url: imageUrl, master_url: masterUrl, original_url: r.imageURL, overlay: layer, overlay_text: finalText,
    warnings: [...(soft ? ["image_check_soft"] : []), ...(textMismatch ? ["text_mismatch"] : []), ...((r as any).split ? ["split_frame"] : [])], cost_usd: costUsd, credits_charged: Number(scene.addon_credits ?? 0),
    qa: { steps: r.log.map((l) => l.step), retries: r.retries, wallMs: Date.now() - t0, timings, billed, dhash, ...(textFree ? { textFree: true } : {}), ...(usedFallback ? { safeFallback: true } : {}), ...(used === "backup" ? { backupModel: cfg.model } : {}), ...(failures.length ? { failures: ladderState.failures, ladderStep: ladder.step } : {}), ...(upscaleSkipped ? { upscaleSkipped } : {}) }, ready_at: new Date().toISOString(), lease_until: null, error: null,
  }).eq("id", scene.id);
  // A picture came back from this model: its breaker (if it was open) lets the next ones through, gradually.
  await recordSuccess(admin, cfg.model).catch(() => {});
  return { failed: false, billed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (!SECRET || req.headers.get("x-autopilot-secret") !== SECRET) return err(req, "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "");
  if (!projectId) return err(req, "Missing projectId", 400);
  // Runware balance guard: below the threshold nothing is claimed — queued scenes wait, then resume.
  const guard = await checkRunwareGuard(admin);
  if (guard.paused) return ok(req, { ok: true, claimed: false, paused: true });
  // The cap across ALL videos (config LONG_FORM_SCENES_TOTAL): over it, this scene waits in the queue.
  const { count: drawingNow } = await admin.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("status", "rendering").gt("lease_until", new Date().toISOString());
  if ((drawingNow ?? 0) >= SCENES_TOTAL_MAX) return ok(req, { ok: true, claimed: false, busy: true });
  const { data: claimed, error } = await admin.rpc("claim_long_form_scene_image", { p_project_id: projectId, p_scene_id: body?.sceneId ?? null, p_lease_seconds: SCENE_LEASE_S });
  if (error) return err(req, "claim failed", 500, { reason: error.message });
  const scene = (claimed ?? [])[0];
  if (!scene) return ok(req, { ok: true, claimed: false });
  const work = drawScene(scene)
    .catch(async (e) => {
      console.error("[render-long-form-scene]", scene.id, String(e));
      // A first-pass scene is never charged (the fixed quote); a paid redraw is refunded. The watchdog
      // does not retry an explicit failure; the review page offers a free Regenerate for failed scenes.
      await admin.from("long_form_scene_images").update({ status: "failed", error: "image_failed", qa: { covered: true, error: String(e).slice(0, 300) }, lease_until: null }).eq("id", scene.id);
      await logEvent("render-long-form-scene", "error", "scene_covered", { projectId, sceneId: scene.id, beat: scene.beat_sequence, tier: scene.tier, failures: [String(e).slice(0, 300)], unexpected: true });
      await refundSceneAddon(scene);
    })
    .finally(() => nudgeAutopilot(projectId));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work); else await work;
  return ok(req, { ok: true, claimed: true, sceneId: scene.id, beatSequence: scene.beat_sequence }, 202);
});
