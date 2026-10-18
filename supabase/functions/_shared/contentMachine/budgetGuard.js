// Content Machine: the Budget Guard. EVERY paid call the machine makes goes through it. The provider
// modules (providers/*.js) refuse to run without a ticket, and only the guard hands tickets out, after
// the database has reserved the money (cm_reserve_spend). scripts/contentMachine/checkPaidCalls.mjs
// fails if a provider's host appears anywhere else.
//
//   spend(provider, operation, estimatedUsd, fn, { lane, runId, ideaId, mock })    a call that answers now
//     1. Reserve: kill switch, daily, monthly, per-provider and per-lane caps. A refusal throws
//        BudgetStopped and fn is never called.
//     2. Dry run (the DRY_RUN secret, or dry_run in the settings): fn is NOT called; mock() is (if given),
//        the row holds $0 and records what the call would have cost.
//     3. Otherwise fn(ticket) runs and returns { result, actualUsd, requestRef }; actualUsd is the
//        provider's own figure (Runware includeCost, Anthropic usage × price). The row is settled with it.
//     4. fn throws: the row is marked failed. Its estimate keeps counting unless the error carries
//        actualUsd (e.g. 0 when the request never left).
//
//   reserve(provider, operation, estimatedUsd, opts) → { ticket, ledgerId, dryRun }     a call that answers later
//   settle(ledgerId, { actualUsd, status, requestRef, error })                          (a batch, a render)
//     The same reservation, settled when the result arrives. Until then the estimate counts.

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

const TICKET = Symbol("cm.budget.ticket");

/** Provider modules call this first: no ticket from the guard, no call. */
export function assertTicket(ticket, provider) {
  if (!ticket || ticket[TICKET] !== true) throw new Error(`A paid ${provider} call was attempted outside the Budget Guard.`);
  if (ticket.provider !== provider) throw new Error(`A ${ticket.provider} ticket can't pay for a ${provider} call.`);
  if (ticket.dryRun) throw new Error(`A dry-run ticket can't make a real ${provider} call.`);
}

const toBool = (v) => /^(1|true|yes|on)$/i.test(String(v ?? "").trim());

/** store: { reserve(args) → row, settle(args) → bool, readSettings() → {dry_run, kill_switch} } (see store.js). */
export function createBudgetGuard({ store, envDryRun = false }) {
  const envDry = toBool(envDryRun);

  async function reserve(provider, operation, estimatedUsd, opts = {}) {
    if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider: ${provider}`);
    if (!operation) throw new Error("operation is required");
    const est = Number(estimatedUsd);
    const settings = await store.readSettings();
    if (settings.kill_switch) throw new BudgetStopped("kill_switch");
    // opts.live: a job the owner ordered to run for real while the machine's dry run is on (the asset
    // tagging, the style samples). It never beats the DRY_RUN secret, the kill switch or any cap.
    const dryRun = envDry || (Boolean(settings.dry_run) && !opts.live) || Boolean(opts.forceDryRun);
    const r = await store.reserve({
      provider, operation, estimatedUsd: Number.isFinite(est) ? est : -1,
      lane: opts.lane ?? null, runId: opts.runId ?? null, ideaId: opts.ideaId ?? null, dryRun,
    });
    if (!r?.ok) throw new BudgetStopped(r?.reason ?? "unknown", r ?? {});
    const ticket = Object.freeze({ [TICKET]: true, provider, operation, ledgerId: r.ledger_id, dryRun });
    return { ticket, ledgerId: r.ledger_id, dryRun, estimatedUsd: est };
  }

  async function settle(ledgerId, { actualUsd = null, status = "settled", requestRef = null, error = null } = {}) {
    const actual = Number.isFinite(actualUsd) && actualUsd >= 0 ? actualUsd : null;
    return store.settle({ ledgerId, actualUsd: actual, status, requestRef, error: error == null ? null : String(error).slice(0, 500) });
  }

  async function spend(provider, operation, estimatedUsd, fn, opts = {}) {
    const r = await reserve(provider, operation, estimatedUsd, opts);
    if (r.dryRun) {
      const result = opts.mock ? await opts.mock() : null;
      await settle(r.ledgerId, { actualUsd: 0, requestRef: "dry-run" });
      return { result, dryRun: true, ledgerId: r.ledgerId, actualUsd: 0, wouldCostUsd: r.estimatedUsd };
    }
    let out;
    try {
      out = await fn(r.ticket);
    } catch (e) {
      await settle(r.ledgerId, { actualUsd: Number.isFinite(e?.actualUsd) ? e.actualUsd : null, status: "failed", error: e?.message ?? e }).catch(() => {});
      throw e;
    }
    const actualUsd = Number.isFinite(out?.actualUsd) && out.actualUsd >= 0 ? out.actualUsd : null;
    await settle(r.ledgerId, { actualUsd, requestRef: out?.requestRef ?? null });
    return { result: out?.result, dryRun: false, ledgerId: r.ledgerId, actualUsd };
  }

  return { spend, reserve, settle, envDryRun: envDry };
}
