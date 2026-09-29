// deno-lint-ignore-file no-explicit-any
// costLedger.ts — Phase 3b per-project cost ledger (long_form_cost_ledger).
//
// Every paid call writes provider, model, stage, units and USD so the total
// per stage per project can be read back (and later quoted up front). A
// ledger write NEVER fails the stage that made the call: errors are logged
// and swallowed. The script and research engines keep their own per-call
// ledgers in meta.callLedger; long_form_project_cost_by_stage reads those.

export type CostStage = "story_plan" | "research" | "script" | "bible" | "beats" | "narration" | "images" | "qa" | "render" | "other";
export type CostUnits = { calls?: number; seconds?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number; characters?: number; providerCredits?: number | null; images?: number };
// projectId, or userId for account-level rows (idea generation runs before a project exists).
export type CostEntry = { projectId?: string | null; userId?: string | null; stage: CostStage; provider: string; model?: string | null; units: CostUnits; usd: number; estimated?: boolean; sourceTable?: string; sourceId?: string | null };

// Phase 6d-1 (config): ElevenLabs is priced from ITS OWN character-cost header
// (the credits it actually charged) at our plan's $/credit — not the old
// per-character USD guess. Measured: 0.20 credits per character on our model.
export const ELEVENLABS_USD_PER_CREDIT = 0.0002;
export const ELEVENLABS_CREDITS_PER_CHARACTER_FALLBACK = 0.2;
export function narrationCost(characters: number, providerCredits: number | null | undefined): { usd: number; credits: number; estimated: boolean } {
  const known = providerCredits != null && Number.isFinite(Number(providerCredits)) && Number(providerCredits) > 0;
  const credits = known ? Number(providerCredits) : characters * ELEVENLABS_CREDITS_PER_CHARACTER_FALLBACK;
  return { usd: Number((credits * ELEVENLABS_USD_PER_CREDIT).toFixed(6)), credits, estimated: !known };
}

export function ledgerRow(e: CostEntry) {
  return {
    project_id: e.projectId ?? null, user_id: e.userId ?? null, stage: e.stage, provider: e.provider, model: e.model ?? null,
    units: Object.fromEntries(Object.entries(e.units).filter(([, v]) => v != null)),
    usd: Number((Number(e.usd) || 0).toFixed(6)), estimated: e.estimated ?? true,
    source_table: e.sourceTable ?? null, source_id: e.sourceId ?? null,
  };
}

export async function recordCost(admin: any, e: CostEntry): Promise<void> {
  try {
    const { error } = await admin.from("long_form_cost_ledger").insert(ledgerRow(e));
    if (error) console.error("[costLedger] insert failed (stage continues):", e.stage, error.message);
  } catch (err) {
    console.error("[costLedger] insert threw (stage continues):", e.stage, err);
  }
}

export type StageCost = { stage: string; usd: number; calls: number; sources: string[] };

// Total per stage for one project (ledger + script/research callLedgers).
export async function costByStage(admin: any, projectId: string): Promise<{ stages: StageCost[]; totalUsd: number }> {
  const { data, error } = await admin.rpc("long_form_project_cost_by_stage", { p_project_id: projectId });
  if (error) throw new Error(`cost summary failed: ${error.message}`);
  return summarizeStageRows(data ?? []);
}

export function summarizeStageRows(rows: { stage: string; usd: number | string; calls: number | string; source: string }[]) {
  const by = new Map<string, StageCost>();
  for (const r of rows) {
    const cur = by.get(r.stage) ?? { stage: r.stage, usd: 0, calls: 0, sources: [] };
    cur.usd = Number((cur.usd + Number(r.usd)).toFixed(6));
    cur.calls += Number(r.calls);
    if (Number(r.calls) > 0 || Number(r.usd) > 0) cur.sources.push(r.source);
    by.set(r.stage, cur);
  }
  const order = ["story_plan", "research", "script", "bible", "beats", "narration", "images", "qa", "render", "other"];
  const stages = [...by.values()].filter((s) => s.calls > 0 || s.usd > 0).sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  return { stages, totalUsd: Number(stages.reduce((s, x) => s + x.usd, 0).toFixed(6)) };
}
