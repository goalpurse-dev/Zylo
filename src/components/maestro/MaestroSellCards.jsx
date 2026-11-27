import { useNavigate } from "react-router-dom";
import { Check, Coins, Loader2, Sparkles } from "lucide-react";
import usePlanCode from "../../hooks/usePlanCode";
import usePaymentAction from "../../hooks/usePaymentAction";
import { startCheckout } from "../../lib/payments";
import { subscribe } from "../pricing/PlanCards";
import { formatMoney } from "../../lib/pricingMath";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { trackCreate } from "../create/useCatalog";

const n = (v) => Number(v).toLocaleString("en-US");

/**
 * Maestro's plan card (owner 2026-11-26): the plan's real price, monthly credits and what they make, from the server
 * (the same data as the pricing page). "Choose plan" runs the pricing page's own subscribe(): checkout for a new plan,
 * the billing portal for someone who already pays, sign-up first for a guest. Maestro never takes a payment.
 */
export function PlanOfferCard({ card }) {
  const navigate = useNavigate();
  const account = usePlanCode();
  const pay = usePaymentAction();
  const current = account.signedIn && !account.lapsed && account.plan === card.plan;
  const choose = () => {
    trackCreate("maestro_choose_plan", { target: card.plan, placement: "maestro" });
    pay.run(`plan:${card.plan}`, () => subscribe({ planId: card.plan, billing: card.billing, account, onAskDowngrade: () => navigate("/pricing") }));
  };
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-lime-300/25 bg-gradient-to-br from-lime-300/[0.07] to-transparent p-4" data-testid="maestro-plan-offer">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[17px] font-black text-white">{card.name}</p>
        {card.price != null && (
          <p className="text-[15px] font-black text-white">
            {formatMoney(card.perMonth, card.currency)}<span className="text-[12px] font-semibold text-white/60"> / month{card.billing === "yearly" ? `, ${formatMoney(card.price, card.currency)} a year` : ""}</span>
          </p>
        )}
      </div>
      {card.reason && <p className="mt-1 text-[13.5px] text-white/85">{card.reason}</p>}
      <ul className="mt-2.5 space-y-1 text-[13px] text-white/85">
        <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" /><span><b className="text-white">{n(card.credits)} credits</b> every month</span></li>
        {card.theirs && <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" /><span>{card.theirs.exact ? "" : "About "}<b className="text-white">{card.theirs.count} {card.theirs.name} videos</b> ({card.theirs.length}) a month{card.theirs.needed ? (card.theirs.count >= card.theirs.needed ? `, enough for the ${card.theirs.needed} you need` : "") : ""}</span></li>}
        {card.theirs?.extra && <li className="rounded-lg bg-amber-300/[0.08] px-2.5 py-1.5 text-[12.5px] text-amber-100" data-testid="maestro-plan-short">You need about {card.theirs.needed} a month: add {card.theirs.extra.count === 1 ? "a" : card.theirs.extra.count} {card.theirs.extra.name} pack{card.theirs.extra.count === 1 ? "" : "s"} ({n(card.theirs.extra.credits)} credits each) for the rest. No plan is bigger than Generative.</li>}
        <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" /><span>≈ {card.town} In This Town videos or ≈ {n(card.images)} quick images</span></li>
        <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" /><span>{card.line} Cancel anytime.</span></li>
      </ul>
      {current ? (
        <p className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-center text-[13.5px] font-bold text-white">You're on {card.name} now</p>
      ) : (
        <button type="button" onClick={choose} disabled={pay.busy != null} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-[15px] font-black text-[#11150D] hover:bg-lime-200 disabled:opacity-70" data-testid="maestro-choose-plan">
          {pay.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Choose {card.name}
        </button>
      )}
      <p className="mt-1.5 text-center text-[11.5px] text-white/55">Opens Zyvo's secure checkout. {account.signedIn ? "" : "You'll create a free account first. "}Nothing is charged until you confirm there.</p>
    </div>
  );
}

/** Maestro's credits card: the balance, what's needed, and the credit packs with a Buy button each (normal checkout) */
export function CreditsCard({ card }) {
  const live = useProfileCredits();
  const account = usePlanCode();
  const pay = usePaymentAction();
  const have = account.signedIn ? live : card.have;
  const buy = (pack) => { trackCreate("maestro_buy_credits", { target: pack, placement: "maestro" }); pay.run(`pack:${pack}`, () => startCheckout({ type: "topup", pack })); };
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03] p-4" data-testid="maestro-credits">
      <p className="flex items-center gap-2 text-[15px] font-black text-white"><Coins className="h-4 w-4 text-lime-300" />Buy credits</p>
      {card.needed != null && have != null && <p className="mt-1 text-[13.5px] text-white/85">This costs <b>{n(card.needed)}</b>, you have <b>{n(have)}</b>{card.needed > have ? <>. You need <b>{n(card.needed - have)}</b> more.</> : "."}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {card.packs.map((p) => {
          const enough = card.needed == null || have == null || have + p.credits >= card.needed;
          const best = card.smallest === p.pack;
          return (
            <button key={p.pack} type="button" onClick={() => buy(p.pack)} disabled={pay.busy != null}
              className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-70 ${enough ? "border-lime-300/40 bg-lime-300/[0.07] hover:border-lime-300" : "border-white/10 bg-white/[0.03] hover:border-white/30"}`} data-testid={`maestro-pack-${p.pack}`}>
              <span className="block text-[14px] font-black text-white">{n(p.credits)} credits{best && <span className="ml-1.5 rounded-full bg-lime-300 px-1.5 py-0.5 text-[10px] font-black text-[#11150D]">Enough</span>}</span>
              <span className="block text-[12.5px] text-white/75">{p.price != null ? formatMoney(p.price, p.currency) : "See price"} · {p.name}{enough ? "" : " (not enough alone)"}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-lime-300">{pay.busy === `pack:${p.pack}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}Buy</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11.5px] text-white/55">One-time packs, they never expire. Opens Zyvo's secure checkout{account.signedIn ? "" : " (a free account first)"}.</p>
    </div>
  );
}
