// /admin/checkout-reminders — the unfinished-checkout emails: per email sent / opened / clicked / paid after, the switch,
// a dry run and proof copies to the owner. The server (checkout-reminders) decides who may see it: the owner only.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const call = (body) => supabase.functions.invoke("checkout-reminders", { body }).then(({ data, error }) => {
  if (error) throw new Error(error.message || "request failed");
  if (data?.error) throw new Error(data.error);
  return data;
});
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const BTN = "inline-flex min-h-[40px] items-center justify-center rounded-xl px-4 text-[13.5px] font-bold transition disabled:opacity-50";

function Card({ title, note, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-[15px] font-bold text-white">{title}</h2>
      {note && <p className="mt-0.5 text-[12px] leading-snug text-white/50">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function CheckoutReminders() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(() => call({ action: "stats" }).then(setData, (e) => setError(e.message)), []);
  useEffect(() => { document.title = "Checkout reminders | Zyvo admin"; load(); }, [load]);

  const run = async (key, body, after) => {
    setBusy(key); setNote(null);
    try { const r = await call(body); setNote(after(r)); await load(); } catch (e) { setNote(`Failed: ${e.message}`); } finally { setBusy(null); }
  };

  if (error) return <div className="min-h-screen bg-[#0B0D0F] p-6 text-white/70">{/not found/i.test(error) ? "Not allowed." : error}</div>;
  if (!data) return <div className="min-h-screen bg-[#0B0D0F] p-6 text-white/50">Loading…</div>;
  const s = data.settings;

  return (
    <div className="min-h-screen bg-[#0B0D0F] px-4 py-6 text-white" data-testid="checkout-reminders-admin">
      <div className="mx-auto grid max-w-[980px] gap-4">
        <h1 className="text-[24px] font-black">Unfinished-checkout emails</h1>

        <Card title={s.on ? "Switched ON" : "Switched OFF"} note={s.startsAt ? `Counts only checkouts opened after ${when(s.startsAt)}. At most ${s.perTick} emails every 10 minutes and ${s.dailyCap} a day, from notify.tryzyvo.com.` : "Never switched on. The first time it goes on, only checkouts opened from that moment count: never older ones."}>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy != null} onClick={() => run("switch", { action: "switch", on: !s.on }, (r) => (r.on ? "Switched on." : "Switched off."))}
              className={`${BTN} ${s.on ? "border border-white/20 text-white/80" : "bg-lime-300 text-[#11150D]"}`} data-testid="reminders-switch">{busy === "switch" ? "…" : s.on ? "Switch off" : "Switch on"}</button>
            <button type="button" disabled={busy != null} onClick={() => run("dry", { action: "dry" }, (r) => `Dry run (nothing sent): ${r.created} new checkout(s) found${r.newByReason ? ` (${Object.entries(r.newByReason).map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`).join(", ")})` : ""}, ${r.due?.length ?? 0} email(s) due now, ${r.waiting} waiting, ${r.skipped} skipped.${s.startsAt ? "" : " (As if it had been switched on 3 days ago.)"}`)}
              className={`${BTN} border border-white/20 text-white/80`}>{busy === "dry" ? "…" : "Dry run"}</button>
            <button type="button" disabled={busy != null} onClick={() => run("test", { action: "test" }, (r) => `Test copies to ${r.to}: ${r.sent.map((x) => `#${x.step} ${x.ok ? "sent" : x.error ?? "failed"}`).join(", ")}.`)}
              className={`${BTN} border border-white/20 text-white/80`}>{busy === "test" ? "…" : "Send me the 3 test emails"}</button>
          </div>
          {note && <p className="mt-3 text-[13px] text-lime-200" role="status">{note}</p>}
        </Card>

        <Card title="Per email" note="Opened after 1 min leaves out most machine opens. Clicked = opened our checkout link. Paid = paid after that email.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px] tabular-nums" data-testid="checkout-reminder-stats">
              <thead className="text-white/50"><tr>{["Email", "Sent", "Opened", "After 1 min", "Clicked", "Paid after", "Bounced"].map((h, i) => <th key={h} className={`py-1 font-semibold ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {data.steps.map((r) => (
                  <tr key={r.step} className="border-t border-white/10">
                    <td className="py-1.5 text-white/80">{r.label}</td>
                    <td className="py-1.5 text-right font-bold">{r.sent}</td>
                    <td className="py-1.5 text-right">{r.opened} <span className="text-white/45">({r.openPct}%)</span></td>
                    <td className="py-1.5 text-right">{r.openedLater}</td>
                    <td className="py-1.5 text-right">{r.clicked} <span className="text-white/45">({r.clickPct}%)</span></td>
                    <td className="py-1.5 text-right font-bold text-lime-200">{r.paid} <span className="font-normal text-white/45">({r.paidPct}%)</span></td>
                    <td className="py-1.5 text-right">{r.bounced + r.spam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="People" note={`${data.sequences.total} checkout(s) followed, ${data.sequences.running} still running, ${data.sequences.paid} paid.`}>
          <ul className="grid gap-1 text-[13px] text-white/75">{data.sequences.stops.map((x) => <li key={x.reason}>{x.label}: <b className="text-white">{x.n}</b></li>)}</ul>
        </Card>

        <Card title="Latest">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="text-white/50"><tr>{["Who", "Plan", "From", "Opened", "Emails", "Status"].map((h) => <th key={h} className="py-1 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {data.latest.map((r, i) => (
                  <tr key={i} className="border-t border-white/10 align-top">
                    <td className="py-1.5 text-white/80">{r.email}</td>
                    <td className="py-1.5">{r.plan}{r.deal ? " (deal)" : ""}</td>
                    <td className="py-1.5 text-white/60">{r.source}</td>
                    <td className="py-1.5 text-white/60">{when(r.openedAt)}</td>
                    <td className="py-1.5">{r.steps.length ? r.steps.map((x) => `#${x.step} ${x.sentAt ? `${when(x.sentAt)}${x.clicked ? " ✓click" : ""}` : `skipped (${x.skipped})`}`).join(" · ") : "—"}</td>
                    <td className="py-1.5">{r.paidAt ? `paid ${when(r.paidAt)}` : r.stop ?? "running"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
