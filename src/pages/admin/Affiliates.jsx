// /admin/affiliates — the owner's affiliate desk, next to the Content Machine. Who may see it is decided by
// the server (affiliate-api, ADMIN_EMAILS); anyone else gets NOT_FOUND and this page shows the normal 404.
//   Payout queue (cash ≥ the minimum) → "Mark as paid" after sending it by PayPal/Wise
//   Flagged referrals → approve / reject
//   All affiliates → disable/enable, rates, code
//   Test tools → a made-up payment, its refund, "30 days later" (no money moves; rows are marked test)
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { affiliateApi } from "../../lib/affiliate";
import { eur } from "../../../supabase/functions/_shared/affiliate/rules.js";
import NotFoundRedirect from "../../components/NotFoundRedirect";

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
const pctOf = (r) => `${Math.round(Number(r) * 100)}%`;

function Card({ title, right, children, testid }) {
  return (
    <section data-testid={testid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">{title}</h2>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
const btn = "rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition disabled:opacity-40";
const lime = `${btn} bg-lime-300 text-[#11150D] hover:bg-lime-200`;
const ghost = `${btn} border border-white/15 text-white/80 hover:bg-white/10`;

function AffiliateRow({ a, onChanged }) {
  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState(String(Math.round(a.cashRate * 100)));
  const [credit, setCredit] = useState(String(Math.round(a.creditRate * 100)));
  const [code, setCode] = useState(a.code);
  const [busy, setBusy] = useState(false);
  const update = async (patch, msg) => {
    setBusy(true);
    try {
      const r = await affiliateApi("adminUpdate", { affiliateId: a.id, ...patch });
      if (r.ok) { toast.success(msg); onChanged(); } else toast.error(String(r.problem ?? "Not saved"));
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <>
      <tr className="border-t border-white/[0.06] align-top">
        <td className="px-2 py-2 font-black tracking-wide text-white">{a.code}</td>
        <td className="px-2 py-2 text-white/70"><div>{a.displayName}</div><div className="text-[11.5px] text-white/40">{a.email ?? "–"}</div></td>
        <td className="px-2 py-2 text-right tabular-nums">{a.clicks}</td>
        <td className="px-2 py-2 text-right tabular-nums">{a.signups}</td>
        <td className="px-2 py-2 text-right tabular-nums">{a.buyers}</td>
        <td className="px-2 py-2 text-right tabular-nums">{eur(a.pendingCents, { decimals: 2 })}</td>
        <td className="px-2 py-2 text-right tabular-nums text-lime-200">{eur(a.availableCents, { decimals: 2 })}</td>
        <td className="px-2 py-2 text-right tabular-nums">{eur(a.paidCents, { decimals: 2 })}</td>
        <td className={`px-2 py-2 text-right tabular-nums ${a.flagged ? "font-bold text-amber-300" : "text-white/40"}`}>{a.flagged}</td>
        <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.status === "active" ? "bg-lime-300/15 text-lime-200" : "bg-red-400/15 text-red-200"}`}>{a.status}</span>
          <div className="mt-1 text-[11px] text-white/40">{pctOf(a.cashRate)} cash · {pctOf(a.creditRate)} credits · pays in {a.payoutType}</div></td>
        <td className="px-2 py-2 text-right"><button type="button" className={ghost} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Edit"}</button></td>
      </tr>
      {open && (
        <tr className="bg-white/[0.02]">
          <td colSpan={11} className="px-2 pb-3 pt-1">
            <div className="flex flex-wrap items-end gap-3 text-[12.5px]">
              <button type="button" disabled={busy} className={a.status === "active" ? `${btn} bg-red-400/80 text-white` : lime}
                onClick={() => { if (window.confirm(`${a.status === "active" ? "Disable" : "Enable"} ${a.code}?`)) update({ status: a.status === "active" ? "disabled" : "active" }, a.status === "active" ? "Disabled" : "Enabled"); }}>
                {a.status === "active" ? "Disable" : "Enable"}
              </button>
              <label className="text-white/60">Cash %<input value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" className="ml-1.5 h-8 w-16 rounded-md border border-white/15 bg-black/30 px-2 text-white" /></label>
              <label className="text-white/60">Credits %<input value={credit} onChange={(e) => setCredit(e.target.value)} inputMode="decimal" className="ml-1.5 h-8 w-16 rounded-md border border-white/15 bg-black/30 px-2 text-white" /></label>
              <button type="button" disabled={busy} className={ghost} onClick={() => update({ cashRate: Number(cash) / 100, creditRate: Number(credit) / 100 }, "Rates saved")}>Save rates</button>
              <label className="text-white/60">Code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="ml-1.5 h-8 w-32 rounded-md border border-white/15 bg-black/30 px-2 font-bold text-white" /></label>
              <button type="button" disabled={busy || code === a.code} className={ghost} onClick={() => update({ code }, "Code changed")}>Save code</button>
              <button type="button" disabled={busy} className={ghost}
                onClick={() => { if (window.confirm(`TEST: end the 30-day hold now for all of ${a.code}'s pending commissions?`)) affiliateApi("adminTestAge", { affiliateId: a.id }).then((r) => { toast.success(`Test: ${r.released} commission(s) released`); onChanged(); }).catch((e) => toast.error(e.message)); }}>
                Test: skip 30 days
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-white/40">Payout: {a.payoutMethod ? `${a.payoutMethod} · ${a.payoutEmail}` : "no payout email yet"} · joined {when(a.createdAt)}. Rate changes apply to commissions from new buyers.</p>
          </td>
        </tr>
      )}
    </>
  );
}

function TestTools({ onChanged }) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("38");
  const [plan, setPlan] = useState("pro");
  const run = async (action, extra, ok) => {
    try {
      const r = await affiliateApi(action, { email, ...extra });
      if (r.ok) { toast.success(ok(r)); onChanged(); } else toast.error(String(r.problem ?? r.result ?? "Didn't work"));
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card title="Test tools (no money moves)" testid="aff-test-tools">
      <p className="text-[12.5px] text-white/50">For testing on the preview: a made-up FIRST payment for a referred account (marked test), its refund, and "skip 30 days" per affiliate (Edit in the table).</p>
      <div className="mt-3 flex flex-wrap items-end gap-2 text-[12.5px]">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="referred user's email" className="h-9 min-w-[220px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-white" />
        <label className="text-white/60">€<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="ml-1 h-9 w-16 rounded-lg border border-white/15 bg-black/30 px-2 text-white" /></label>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 rounded-lg border border-white/15 bg-black/30 px-2 text-white">
          {["starter", "pro", "generative", "topup"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="button" disabled={!email} className={lime} onClick={() => run("adminTestPayment", { amountEur: Number(amount), plan }, (r) => `Test payment: ${r.result}${r.amount != null ? ` · ${eur(r.amount, { decimals: 2 })}` : ""}`)}>Simulate payment</button>
        <button type="button" disabled={!email} className={ghost} onClick={() => run("adminTestRefund", {}, (r) => `Refund: ${r.reversed} reversed${r.already_paid ? `, ${r.already_paid} already paid` : ""}`)}>Simulate refund</button>
      </div>
    </Card>
  );
}

export default function AffiliatesAdmin() {
  const [data, setData] = useState(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { setData(await affiliateApi("adminOverview")); setError(null); } catch (e) {
      if (e.status === 404 || e.status === 401) setDenied(true); else setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = "Affiliates · Admin"; }, []);

  if (denied) return <NotFoundRedirect />;
  if (!data) return <div className="min-h-screen bg-[#090A0A] p-6 text-white/60">{error ?? "Loading…"}</div>;

  const markPaid = async (q) => {
    const reference = window.prompt(`Sent ${eur(q.amountCents, { decimals: 2 })} to ${q.payoutEmail} by ${q.payoutMethod}? Add the transfer reference (optional):`, "");
    if (reference === null) return;
    try {
      const r = await affiliateApi("adminMarkPaid", { affiliateId: q.id, reference });
      if (r.ok) toast.success(`Marked ${eur(r.amount, { decimals: 2 })} paid`); else toast.error(r.result === "no_payout_details" ? "This affiliate has no payout email." : `Not paid: ${r.result}`);
      load();
    } catch (e) { toast.error(e.message); }
  };
  const resolve = async (f, approve) => {
    if (!window.confirm(`${approve ? "Approve" : "Reject"} this referral for ${f.affiliateCode}?${approve ? "" : " Its commission is cancelled."}`)) return;
    try { await affiliateApi("adminResolveFlag", { referralId: f.id, approve }); toast.success(approve ? "Approved" : "Rejected"); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-[#090A0A] text-white">
      <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-black tracking-tight">Affiliates</h1>
            <p className="text-[13px] text-white/50">{data.affiliates.length} affiliates · {pctOf(data.config.cashRate)} cash / {pctOf(data.config.creditRate)} credits by default · {data.config.holdDays}-day hold · cash from {eur(data.config.minCashPayoutCents)}</p>
          </div>
          <nav className="flex gap-2 text-[13px]">
            <Link to="/admin/content-machine" className={ghost}>Content Machine</Link>
            <Link to="/admin/ops" className={ghost}>Ops</Link>
            <button type="button" onClick={load} className={ghost}>Refresh</button>
          </nav>
        </header>

        <Card title={`Payout queue (${data.payoutQueue.length})`} testid="aff-payout-queue">
          {data.payoutQueue.length === 0 ? <p className="text-[13px] text-white/45">Nobody has {eur(data.config.minCashPayoutCents)} of available cash yet.</p> : (
            <ul className="divide-y divide-white/[0.06]">
              {data.payoutQueue.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="w-28 font-black">{q.code}</span>
                  <span className="flex-1 text-[13px] text-white/70">{q.payoutMethod ? `${q.payoutMethod === "wise" ? "Wise" : "PayPal"} · ${q.payoutEmail}` : <span className="text-amber-300">no payout email</span>}</span>
                  <span className="text-[16px] font-black tabular-nums text-lime-200">{eur(q.amountCents, { decimals: 2 })}</span>
                  <button type="button" className={lime} disabled={!q.payoutEmail} onClick={() => markPaid(q)}>Mark as paid</button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Flagged referrals (${data.flagged.length})`} testid="aff-flagged">
          {data.flagged.length === 0 ? <p className="text-[13px] text-white/45">Nothing to review.</p> : (
            <ul className="divide-y divide-white/[0.06]">
              {data.flagged.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
                  <span className="w-28 font-black">{f.affiliateCode}</span>
                  <span className="flex-1 text-white/70">{f.referredEmail ?? "unknown account"} · via {f.source} · <span className="text-amber-300">{f.reason === "same_ip_as_affiliate" ? "same IP as the affiliate" : "many sign-ups from one IP"}</span> · {when(f.createdAt)}</span>
                  <button type="button" className={lime} onClick={() => resolve(f, true)}>Approve</button>
                  <button type="button" className={`${btn} bg-red-400/80 text-white`} onClick={() => resolve(f, false)}>Reject</button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="All affiliates" testid="aff-table">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wide text-white/45">
                <tr>{["Code", "User", "Clicks", "Sign-ups", "Buyers", "Pending", "Available", "Paid", "Flagged", "Status", ""].map((h, i) => <th key={h || i} className={`px-2 py-2 font-semibold ${i >= 2 && i <= 8 ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody>{data.affiliates.map((a) => <AffiliateRow key={`${a.id}-${a.code}-${a.status}-${a.cashRate}-${a.creditRate}`} a={a} onChanged={load} />)}</tbody>
            </table>
            {data.affiliates.length === 0 && <p className="py-4 text-[13px] text-white/45">No affiliates yet.</p>}
          </div>
        </Card>

        <Card title="Recent cash payouts">
          {data.payouts.length === 0 ? <p className="text-[13px] text-white/45">None yet.</p> : (
            <ul className="divide-y divide-white/[0.06] text-[13px]">
              {data.payouts.map((p) => <li key={p.id} className="flex flex-wrap gap-3 py-2"><span className="w-28 font-bold">{p.code}</span><span className="tabular-nums">{eur(p.amount, { decimals: 2 })}</span><span className="text-white/55">{p.method} · {p.paid_to}</span><span className="text-white/40">{p.reference}</span><span className="ml-auto text-white/40">{when(p.paid_at)}</span></li>)}
            </ul>
          )}
        </Card>

        <TestTools onChanged={load} />
      </div>
    </div>
  );
}
