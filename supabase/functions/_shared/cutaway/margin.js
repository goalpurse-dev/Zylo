// Cutaway margin per video type (owner, 2026-11-12: "the credit price each type needs to be exactly 2x our true cost").
//
// True cost per FINISHED video = every dollar spent on that type in the window (planner, checks, voice, GPU / Fly, and
// the runs that failed and were refunded) / the videos that finished. Revenue per finished video = the credits it kept
// (charged - refunded) x what we really earn per credit. Read-only: nothing here changes a price.

// What a credit really earns: the paid invoices and top-ups of the last 120 days in Stripe (361 purchases, 327,450
// credits), after card fees, Stripe Billing usage fees and chargebacks (13 lost, 4 won back); no VAT (the owner is not
// VAT-registered). Settled in EUR; dollars at Stripe's own USD->EUR rate on our USD payments (0.8766).
// Measured 2026-11-12 (scratchpad stripeRev.mjs, read-only). Re-measure when prices, plans or the VAT status change.
export const EARNED_PER_CREDIT = Object.freeze({ usd: 0.0206, eur: 0.0181, measuredAt: "2026-11-12", basis: "Stripe, last 120 days: 361 purchases after card + Billing fees and chargebacks, no VAT" });
export const TARGET_MULTIPLE = 2;
export const WINDOWS = Object.freeze([7, 30]);

/** the type of a run: the four priced kinds, and the two free ones (the new-user preview and the gift finish) */
export function marginType(run) {
  if (run?.free_preview) return "free_preview";
  if (run?.gift_finish) return "gift_finish";
  return `${run?.kind === "custom" ? "custom" : "premade"}-${Number(run?.length_sec) === 60 ? 60 : 30}`;
}
export const PAID_TYPES = Object.freeze(["premade-30", "premade-60", "custom-30", "custom-60"]);
export const TYPE_LABELS = Object.freeze({ "premade-30": "Premade 30 s", "premade-60": "Premade 60 s", "custom-30": "Custom 30 s", "custom-60": "Custom 60 s", free_preview: "Free preview (10 s, new users)", gift_finish: "Gift finish (after upgrade)" });

const r2 = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(d)));

/**
 * One row per type and window. runs: production runs (status, kind, length_sec, free_preview, gift_finish, cost_usd,
 * credits_charged, credits_refunded, created_at). A run still going counts its cost so far but is neither finished
 * nor failed.
 */
export function marginRows(runs, { now = Date.now(), earnedUsd = EARNED_PER_CREDIT.usd, target = TARGET_MULTIPLE, windows = WINDOWS } = {}) {
  const out = [];
  for (const days of windows) {
    const since = now - days * 86400e3, acc = new Map();
    for (const r of runs ?? []) {
      if (Date.parse(r.created_at) < since) continue;
      const t = marginType(r), a = acc.get(t) ?? { finished: 0, failed: 0, running: 0, costUsd: 0, failedUsd: 0, creditsKept: 0 };
      const cost = Number(r.cost_usd) || 0;
      a.costUsd += cost;
      if (r.status === "done") a.finished++;
      else if (r.status === "failed") { a.failed++; a.failedUsd += cost; }
      else a.running++;
      a.creditsKept += Math.max(0, (Number(r.credits_charged) || 0) - (Number(r.credits_refunded) || 0));
      acc.set(t, a);
    }
    for (const type of [...PAID_TYPES, "free_preview", "gift_finish"]) {
      const a = acc.get(type);
      if (!a) continue;
      const paid = PAID_TYPES.includes(type);
      const costPer = a.finished ? a.costUsd / a.finished : null;
      const creditsPer = a.finished ? a.creditsKept / a.finished : null;
      const revenuePer = creditsPer == null ? null : creditsPer * earnedUsd;
      const multiple = paid && costPer && revenuePer != null ? revenuePer / costPer : null;
      const marginPct = paid && revenuePer ? ((revenuePer - costPer) / revenuePer) * 100 : null;
      // money spent with nothing finished is below target too
      const below = paid && (multiple == null ? a.costUsd > 0 : multiple < target);
      out.push({
        type, label: TYPE_LABELS[type], days, paid, finished: a.finished, failed: a.failed, running: a.running,
        costUsd: r2(a.costUsd), failedUsd: r2(a.failedUsd), costPerFinished: r2(costPer), creditsPerFinished: r2(creditsPer, 1),
        revenuePerFinished: r2(revenuePer), multiple: r2(multiple, 2), marginPct: r2(marginPct, 1), below,
        // the credits that would make this type exactly `target` times its true cost
        creditsForTarget: paid && costPer ? Math.ceil((target * costPer) / earnedUsd) : null,
      });
    }
  }
  return out;
}
