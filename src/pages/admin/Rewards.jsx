// /admin/rewards — the owner's Rewards desk, next to /admin/affiliates. The server (rewards-api, ADMIN_EMAILS) decides who
// may see it; anyone else gets NOT_FOUND and this page shows the normal 404.
//   Review queue: open the link, check the views by hand, pick the tier → Approve (credits at once; a re-check pays only
//   the difference to the new tier) or Reject with a reason.
//   Invites: who invited whom, the status, Cancel (a rewarded one gives back what is unspent).
//   Test tools: an invited friend's made-up first purchase and its refund (no money moves).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { rewardsApi } from "../../lib/rewards";
import { PLATFORM_NAMES, upgradeCredits, viewsLabel } from "../../../supabase/functions/_shared/rewards/rules.js";
import NotFoundRedirect from "../../components/NotFoundRedirect";

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString("en"));
const btn = "rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition disabled:opacity-40";
const lime = `${btn} bg-lime-300 text-[#11150D] hover:bg-lime-200`;
const ghost = `${btn} border border-white/15 text-white/80 hover:bg-white/10`;

function Card({ title, right, children, testid }) {
  return (
    <section data-testid={testid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">{title}</h2>{right}</div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function QueueItem({ s, tiers, onDone }) {
  const [tier, setTier] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = tiers.find((t) => t.views === tier);
  const decide = async (approve) => {
    if (!approve && !reason.trim()) { toast.error("Write a reason for the user."); return; }
    setBusy(true);
    try {
      const r = await rewardsApi("adminReview", { id: s.id, approve, tierViews: tier, reason });
      if (r.ok) { toast.success(approve ? `Approved · +${fmt(r.credits_added)} credits` : "Rejected"); onDone(); } else toast.error(String(r.problem ?? r.result));
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <li className="py-3" data-testid="rewards-queue-item">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 items-center gap-1 font-bold text-lime-200 hover:underline">
          <span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
        <span className="text-white/70">{s.email ?? "unknown user"}</span>
        <span className="text-white/50">{PLATFORM_NAMES[s.platform]}</span>
        <span className="text-white/50">claims {fmt(s.claimedViews)} views</span>
        <span className="text-white/40">{when(s.createdAt)}</span>
        {s.recheck && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-bold text-amber-200">Re-check · paid so far: {s.tierViews ? `${viewsLabel(s.tierViews)} tier, ` : ""}{fmt(s.creditsPaid)} credits</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tiers.map((t) => {
          const add = upgradeCredits(t.credits, s.creditsPaid);
          return (
            <button key={t.views} type="button" onClick={() => setTier(t.views)} aria-pressed={tier === t.views}
              className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${tier === t.views ? "border-lime-300 bg-lime-300/15 text-white" : "border-white/15 text-white/70"}`}>
              {viewsLabel(t.views)} · {fmt(t.credits)}{s.creditsPaid > 0 ? ` (+${fmt(add)})` : ""}
            </button>
          );
        })}
        <button type="button" className={lime} disabled={busy || !tier} onClick={() => decide(true)}>Approve{pick ? ` · +${fmt(upgradeCredits(pick.credits, s.creditsPaid))}` : ""}</button>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (for a rejection)" className="h-8 min-w-[180px] flex-1 rounded-lg border border-white/15 bg-black/30 px-2.5 text-[12.5px] text-white" />
        <button type="button" className={`${btn} bg-red-400/80 text-white`} disabled={busy} onClick={() => decide(false)}>Reject</button>
      </div>
    </li>
  );
}

export default function RewardsAdmin() {
  const [data, setData] = useState(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const load = useCallback(async () => {
    try { setData(await rewardsApi("adminOverview")); setError(null); } catch (e) { if (e.status === 404 || e.status === 401) setDenied(true); else setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = "Rewards · Admin"; }, []);
  if (denied) return <NotFoundRedirect />;
  if (!data) return <div className="min-h-screen bg-[#090A0A] p-6 text-white/60">{error ?? "Loading…"}</div>;

  const cancel = async (i) => {
    if (!window.confirm(`Cancel this invite (${i.inviter} → ${i.friend})?${i.status === "rewarded" ? " Unspent reward credits are taken back from both." : ""}`)) return;
    try { const r = await rewardsApi("adminCancelInvite", { id: i.id }); toast.success(String(r.result)); load(); } catch (e) { toast.error(e.message); }
  };
  const test = async (action, label) => {
    try { const r = await rewardsApi(action, { email }); if (r.ok) toast.success(`${label}: ${r.result ?? `${r.reversed} reversed`}${r.reason ? ` (${r.reason})` : ""}`); else toast.error(String(r.problem)); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-[#090A0A] text-white">
      <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-black tracking-tight">Rewards</h1>
            <p className="text-[13px] text-white/50">Tiers: {data.config.tiers.map((t) => `${viewsLabel(t.views)} → ${fmt(t.credits)}`).join(" · ")} · invites +{fmt(data.config.invite.inviterCredits)} / +{fmt(data.config.invite.friendCredits)}</p>
          </div>
          <nav className="flex gap-2 text-[13px]">
            <Link to="/admin/affiliates" className={ghost}>Affiliates</Link>
            <Link to="/admin/content-machine" className={ghost}>Content Machine</Link>
            <button type="button" onClick={load} className={ghost}>Refresh</button>
          </nav>
        </header>

        <Card title={`Review queue (${data.queue.length})`} testid="rewards-queue">
          {data.queue.length === 0 ? <p className="text-[13px] text-white/45">Nothing to review.</p> : (
            <ul className="divide-y divide-white/[0.06]">{data.queue.map((s) => <QueueItem key={`${s.id}-${s.updatedAt}`} s={s} tiers={data.config.tiers} onDone={load} />)}</ul>
          )}
        </Card>

        <Card title="Recently decided">
          {data.decided.length === 0 ? <p className="text-[13px] text-white/45">None yet.</p> : (
            <ul className="divide-y divide-white/[0.06] text-[13px]">
              {data.decided.map((s) => (
                <li key={s.id} className="flex flex-wrap gap-3 py-2">
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="max-w-[340px] truncate text-white/80 hover:underline">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</a>
                  <span className="text-white/55">{s.email}</span>
                  <span className={s.status === "approved" ? "text-lime-300" : "text-red-300"}>{s.status === "approved" ? `${viewsLabel(s.tierViews)} · ${fmt(s.creditsPaid)} credits` : `rejected: ${s.rejectReason}`}</span>
                  <span className="ml-auto text-white/40">{when(s.reviewedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Invites (${data.invites.length})`} testid="rewards-invites">
          {data.invites.length === 0 ? <p className="text-[13px] text-white/45">No invites yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead className="text-[11.5px] uppercase tracking-wide text-white/45"><tr>{["Inviter", "Friend", "Status", "Credits", "Joined", ""].map((h, i) => <th key={h || i} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {data.invites.map((i) => (
                    <tr key={i.id} className="border-t border-white/[0.06]">
                      <td className="px-2 py-2 text-white/80">{i.inviter ?? "–"}</td>
                      <td className="px-2 py-2 text-white/80">{i.friend ?? "–"}</td>
                      <td className="px-2 py-2"><span className={i.status === "rewarded" ? "text-lime-300" : i.status === "joined" ? "text-white/70" : "text-white/45"}>{i.status}</span>{i.reason && <div className="text-[11.5px] text-white/40">{i.reason}</div>}</td>
                      <td className="px-2 py-2 tabular-nums text-white/70">{i.status === "rewarded" || i.status === "reversed" || i.status === "cancelled" ? `+${fmt(i.inviterCredits)} / +${fmt(i.friendCredits)}` : "–"}</td>
                      <td className="px-2 py-2 text-white/45">{when(i.createdAt)}</td>
                      <td className="px-2 py-2 text-right">{(i.status === "joined" || i.status === "rewarded") && <button type="button" className={ghost} onClick={() => cancel(i)}>Cancel</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Test tools (no money moves)">
          <p className="text-[12.5px] text-white/50">The invited friend's made-up first purchase (rewards both if the rules allow), and its refund (takes back what is unspent).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="invited friend's email" className="h-9 min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-[13px] text-white" />
            <button type="button" disabled={!email} className={lime} onClick={() => test("adminTestInvitePayment", "Test purchase")}>Simulate first purchase</button>
            <button type="button" disabled={!email} className={ghost} onClick={() => test("adminTestInviteRefund", "Test refund")}>Simulate refund</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
