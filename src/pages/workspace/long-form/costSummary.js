// Internal-only aggregate cost view for a Long Form project. Never shown to
// the user (see the Script Readiness Repair Loop milestone: "Do not show
// '$0.14 spent' to normal users. But record... for us."). This is
// deliberately a thin query+sum layer, not a new billing/telemetry system —
// every version table (research, script) already persists a `meta` jsonb
// with `estimatedTotalCostUsd`; this just adds them up per project so we
// can eventually answer "what did this entire video cost Zyvo?" without
// duplicating that telemetry anywhere.
//
// Not wired into any UI. Intended for ad-hoc use (a support/ops script, a
// future internal admin view) — call computeProjectCostSummary(projectId)
// directly with a Supabase client that has read access to these tables.
import { supabase } from "../../../lib/supabaseClient";

function sumCost(rows) {
  return (rows ?? []).reduce((sum, r) => sum + (r.meta?.estimatedTotalCostUsd ?? 0), 0);
}

// Pure function (given already-fetched rows) so this is trivially unit
// testable without a DB — see the static tests for the Repair Loop
// milestone. Research repair rows are distinguished by repair_round > 0;
// everything else in that table is an original/full research pass.
export function summarizeCosts({ researchVersions = [], scriptVersions = [] } = {}) {
  const originalResearch = researchVersions.filter((r) => (r.repair_round ?? 0) === 0);
  const repairResearch = researchVersions.filter((r) => (r.repair_round ?? 0) > 0);

  const researchUsd = sumCost(originalResearch);
  const researchRepairUsd = sumCost(repairResearch);
  const scriptUsd = sumCost(scriptVersions);

  return {
    // Not yet tracked anywhere — these stages don't persist cost telemetry
    // yet. Kept as explicit nulls (not omitted) so a caller summing "total"
    // never silently forgets a stage that simply hasn't shipped telemetry
    // yet, and so this shape is stable once those stages do add it.
    storyUsd: null,
    visualUsd: null,
    audioUsd: null,
    researchUsd: Number(researchUsd.toFixed(4)),
    researchRepairUsd: Number(researchRepairUsd.toFixed(4)),
    scriptUsd: Number(scriptUsd.toFixed(4)),
    totalUsd: Number((researchUsd + researchRepairUsd + scriptUsd).toFixed(4)),
    researchVersionCount: originalResearch.length,
    researchRepairCount: repairResearch.length,
    scriptVersionCount: scriptVersions.length,
  };
}

// Fetches every research/script version ever created for a project
// (regardless of current/stale) and sums their real recorded cost — the
// simplest honest answer to "what did this project cost so far," including
// abandoned/regenerated attempts, not just the current versions.
export async function computeProjectCostSummary(projectId) {
  const [{ data: researchVersions }, { data: scriptVersions }] = await Promise.all([
    supabase.from("long_form_research_versions").select("meta, repair_round").eq("project_id", projectId),
    supabase.from("long_form_script_versions").select("meta").eq("project_id", projectId),
  ]);
  return summarizeCosts({ researchVersions: researchVersions ?? [], scriptVersions: scriptVersions ?? [] });
}
