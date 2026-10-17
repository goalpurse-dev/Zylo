// Content Machine: the database calls, on the service-role client. Thin on purpose: the rules live in
// the SQL (cm_reserve_spend) and in the pure modules next to this one.

const must = ({ data, error }, what) => {
  if (error) throw new Error(`[content-machine] ${what}: ${error.message}`);
  return data;
};

export function createStore(db) {
  return {
    async readSettings() {
      return must(await db.from("cm_settings").select("*").eq("id", true).single(), "read settings");
    },
    async updateSettings(patch, actorEmail) {
      return must(await db.from("cm_settings")
        .update({ ...patch, updated_at: new Date().toISOString(), updated_by: actorEmail })
        .eq("id", true).select("*").single(), "update settings");
    },
    async reserve({ provider, operation, estimatedUsd, lane, runId, ideaId, dryRun }) {
      return must(await db.rpc("cm_reserve_spend", {
        p_provider: provider, p_operation: operation, p_estimated_usd: estimatedUsd,
        p_lane: lane, p_run_id: runId, p_idea_id: ideaId, p_dry_run: dryRun,
      }), "reserve spend");
    },
    async settle({ ledgerId, actualUsd, status, requestRef = null, error = null }) {
      return must(await db.rpc("cm_settle_spend", {
        p_ledger_id: ledgerId, p_actual_usd: actualUsd, p_status: status, p_request_ref: requestRef, p_error: error,
      }), "settle spend");
    },
    /** Ledger rows from `fromDay` (a YYYY-MM-DD local day) on, newest first. */
    async ledgerSince(fromDay, { provider = null, day = null, limit = 5000 } = {}) {
      let q = db.from("cm_spend_ledger").select("*").gte("local_day", fromDay).order("created_at", { ascending: false }).limit(limit);
      if (provider) q = q.eq("provider", provider);
      if (day) q = q.eq("local_day", day);
      return must(await q, "read ledger");
    },
    async audit(actorEmail, action, payload = {}) {
      must(await db.from("cm_audit_log").insert({ actor_email: actorEmail, action, payload }), "write audit log");
    },
    async auditLog(limit = 50) {
      return must(await db.from("cm_audit_log").select("*").order("created_at", { ascending: false }).limit(limit), "read audit log");
    },
  };
}
