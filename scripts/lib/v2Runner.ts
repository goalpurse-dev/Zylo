// deno-lint-ignore-file no-explicit-any
// V2 scene-image runner for local test scripts (Phase 4c): the real tier
// pipeline (renderTiers.renderBeat) wired to Runware via the service-only
// proxy. render -> free code checks (1 retry) -> Real-ESRGAN 2x -> 1920x1080
// -> text overlay stored as an editable layer (base.jpg + layer JSON) plus a
// composited preview. Every paid call goes into the cost ledger.
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderBeat, STICKMAN_RENDER_TIERS, compileOptionsFor } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { compileBeatPrompt, type CanonicalSet } from "../../supabase/functions/_shared/stickman/promptCompiler.ts";
import { postProcessSceneImage } from "../../supabase/functions/_shared/stickman/sceneImagePost.ts";
import { overlayText, type OverlayLayer } from "../../supabase/functions/_shared/stickman/textOverlay.ts";
import { codeCheckImage } from "../../supabase/functions/_shared/stickman/imageChecks.ts";

export const root = new URL("../../", import.meta.url);
export const env: Record<string, string> = {};
for (const f of [".env", ".env.local"]) {
  try { for (const line of (await Deno.readTextFile(new URL(f, root))).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; } } catch { /* optional */ }
}
export const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
export const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
export const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";

export const proxy = async (task: any) => { const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) }); return await r.json(); };
export const fetchBytes = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };

export type V2Output = { seq: number; failed: boolean; retries: number; cost: number; renderLatencyMs: number; wallMs: number; steps: string[]; overlay: OverlayLayer | null; files: { original?: string; base?: string; preview?: string; layer?: string; master?: string }; prompt: string; negativePrompt: string; error?: string };

// One beat through V2. `dir` is relative to the repo root.
export async function runV2Beat(beat: { sequence: number; startMs: number; endMs: number; narrationText: string; contract: any }, set: CanonicalSet, opts: { dir: string; source: string; plantFrame?: string | null }): Promise<V2Output> {
  const t0 = Date.now();
  const cfg = STICKMAN_RENDER_TIERS.V2;
  let renderLatencyMs = 0, lastPrompt = "", lastNegative = "", layer: OverlayLayer | null = null, masterFile: string | null = null;
  const ledger = (stage: string, model: string, units: any, usd: number) => admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage, provider: "runware", model, units, usd, estimated: false, source_table: opts.source });
  const stem = `${opts.dir}/beat-${String(beat.sequence).padStart(3, "0")}`;
  try {
    const r = await renderBeat("V2", { startMs: beat.startMs, contract: beat.contract }, {
      compile: (c) => { const p = compileBeatPrompt({ ...beat, contract: c }, set, { plantFrame: opts.plantFrame ?? null, ...compileOptionsFor("V2") }); if (p.lintErrors.length) throw new Error(`lint: ${p.lintErrors.join("; ")}`); lastPrompt = p.positivePrompt; lastNegative = p.negativePrompt; return p; },
      render: async (task) => {
        const res = await proxy(task);
        if (!res.ok) throw new Error(`render: ${JSON.stringify(res.error).slice(0, 200)}`);
        renderLatencyMs += res.latencyMs;
        await ledger("images", task.model, { calls: 1, images: 1, beat: beat.sequence, latencyMs: res.latencyMs, steps: task.steps }, res.result.cost);
        lastNegative = task.negativePrompt ?? lastNegative;
        return { imageURL: res.result.imageURL, cost: res.result.cost };
      },
      qa: async () => { throw new Error("V2 has no AI QA"); },
      codeCheck: async (url) => {
        const bytes = await fetchBytes(url);
        const c = await codeCheckImage(bytes, { width: cfg.width, height: cfg.height });
        await Deno.writeFile(new URL(`${stem}-original.jpg`, root), bytes);
        // Soft (near-blank) fails score by how much they show, so the retry keeps the fuller frame.
        return { pass: c.pass, soft: c.soft, score: c.pass ? 1 : c.soft ? Number((0.5 * (1 - (c.uniformShare ?? 1))).toFixed(3)) : 0, ocrText: "", notes: c.reasons.join("; "), cost: 0 };
      },
      postProcess: async (url) => {
        const p = await postProcessSceneImage({ originalUrl: url, tier: "V2", fetchBytes, upscale: async (t) => { const u = await proxy(t); if (!u.ok) throw new Error("upscale failed"); await ledger("image_upscale", t.model, { calls: 1, images: 1, beat: beat.sequence }, u.result.cost); return { imageURL: u.result.imageURL, cost: u.result.cost, latencyMs: u.latencyMs }; } });
        if (p.master) { await Deno.writeFile(new URL(`${stem}-full.jpg`, root), p.master.bytes); masterFile = `${stem}-full.jpg`; }
        return { bytes: p.final.bytes, cost: p.upscaled?.cost ?? 0 };
      },
      overlay: async (bytes, text) => { const o = await overlayText(bytes, text); layer = o.layer; return o.bytes; },
    });
    const files: V2Output["files"] = { original: `${stem}-original.jpg` };
    if (!r.failed) {
      await Deno.writeFile(new URL(`${stem}-base.jpg`, root), r.base);
      files.base = `${stem}-base.jpg`;
      await Deno.writeFile(new URL(`${stem}.jpg`, root), r.final);
      files.preview = `${stem}.jpg`;
      if (masterFile) files.master = masterFile;
      if (layer) { await Deno.writeTextFile(new URL(`${stem}-overlay.json`, root), JSON.stringify(layer, null, 1)); files.layer = `${stem}-overlay.json`; }
    }
    return { seq: beat.sequence, failed: r.failed, retries: r.retries, cost: r.cost, renderLatencyMs, wallMs: Date.now() - t0, steps: r.log.map((l) => l.step + (l.qa?.notes ? ` (${l.qa.notes})` : "")), overlay: layer, files, prompt: lastPrompt, negativePrompt: lastNegative };
  } catch (e) {
    return { seq: beat.sequence, failed: true, retries: 0, cost: 0, renderLatencyMs, wallMs: Date.now() - t0, steps: [], overlay: null, files: {}, prompt: lastPrompt, negativePrompt: lastNegative, error: String(e).slice(0, 300) };
  }
}
