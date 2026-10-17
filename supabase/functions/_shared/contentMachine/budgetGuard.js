// Content Machine: the Budget Guard. EVERY paid call the machine makes goes through spend(); nothing in
// _shared/contentMachine/ calls a provider any other way (scripts/contentMachine/checkPaidCalls.mjs).
//
//   spend(provider, operation, estimatedUsd, fn, { lane, runId, ideaId, mock })
//     1. The database reserves the estimate under a lock (cm_reserve_spend): kill switch, daily, monthly,
//        per-provider and per-lane caps. A refusal throws BudgetStopped and fn is never called.
//     2. Dry run (the DRY_RUN secret, or dry_run in the settings): fn is NOT called; mock() is (if given),
//        the row holds $0 and records what the call would have cost.
//     3. Otherwise fn() runs. It returns { result, actualUsd, requestRef }; actualUsd is the provider's
//        own figure (Runware includeCost, Anthropic usage × price). The row is settled with it.
//     4. fn throws: the row is marked failed. Its estimate keeps counting unless the error carries
//        actualUsd (e.g. 0 when the request never left).

export class BudgetStopped extends Error {
  constructor(reason, detail = {}) {
    super(`Budget stop: ${reason}`);
    this.name = "BudgetStopped";
    this.reason = reason;
    this.detail = detail;
  }
}

export const PROVIDERS = ["runware", "anthropic", "apify", "youtube", "fly", "other"];

export const REASON_TEXT = {
  kill_switch: "The kill switch is on: nothing runs.",
  daily_cap: "Today's budget would be exceeded.",
  monthly_cap: "This month's budget would be exceeded.",
  provider_cap: "Today's cap for this provider would be exceeded.",
  lane_cap: "Today's cap for this kind of work would be exceeded.",
  bad_estimate: "The call had no valid cost estimate.",
};

const toBool = (v) => /^(1|true|yes|on)$/i.test(String(v ?? "").trim());

/** store: { reserve(args) → row, settle(args) → bool, readSettings() → {dry_run, kill_switch} } (see store.js). */
export function createBudgetGuard({ store, envDryRun = false }) {
  const envDry = toBool(envDryRun);

  async function spend(provider, operation, estimatedUsd, fn, opts = {}) {
    if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider: ${provider}`);
    if (!operation) throw new Error("operation is required");
    const est = Number(estimatedUsd);
    const settings = await store.readSettings();
    if (settings.kill_switch) throw new BudgetStopped("kill_switch");
    const dryRun = envDry || Boolean(settings.dry_run) || Boolean(opts.forceDryRun);

    const r = await store.reserve({
      provider, operation, estimatedUsd: Number.isFinite(est) ? est : -1,
      lane: opts.lane ?? null, runId: opts.runId ?? null, ideaId: opts.ideaId ?? null, dryRun,
    });
    if (!r?.ok) throw new BudgetStopped(r?.reason ?? "unknown", r ?? {});
    const ledgerId = r.ledger_id;

    if (dryRun) {
      const result = opts.mock ? await opts.mock() : null;
      await store.settle({ ledgerId, actualUsd: 0, status: "settled", requestRef: "dry-run" });
      return { result, dryRun: true, ledgerId, actualUsd: 0, wouldCostUsd: est };
    }

    let out;
    try {
      out = await fn();
    } catch (e) {
      const actual = Number.isFinite(e?.actualUsd) ? e.actualUsd : null;
      await store.settle({ ledgerId, actualUsd: actual, status: "failed", error: String(e?.message ?? e) }).catch(() => {});
      throw e;
    }
    const actualUsd = Number.isFinite(out?.actualUsd) && out.actualUsd >= 0 ? out.actualUsd : null;
    await store.settle({ ledgerId, actualUsd, status: "settled", requestRef: out?.requestRef ?? null });
    return { result: out?.result, dryRun: false, ledgerId, actualUsd };
  }

  return { spend, envDryRun: envDry };
}
