// /admin/funnel — how far new users get and what they click. The owner's page: the server (funnel-dashboard) decides who may
// see it; anyone else gets "not allowed" and no data. Made to read on a phone.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const PERIODS = [
  { key: "today", label: "Today", range: () => [startOfDay(new Date()), new Date(Date.now() + 60000)] },
  { key: "yesterday", label: "Yesterday", range: () => { const t = startOfDay(new Date()); return [new Date(t.getTime() - DAY), t]; } },
  { key: "7", label: "7 days", range: () => [new Date(Date.now() - 7 * DAY), new Date(Date.now() + 60000)] },
  { key: "30", label: "30 days", range: () => [new Date(Date.now() - 30 * DAY), new Date(Date.now() + 60000)] },
];

function Card({ title, children, note }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-[15px] font-bold text-white">{title}</h2>
      {note && <p className="mt-0.5 text-[12px] leading-snug text-white/50">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// The welcome email's open rate per day, last 14 days (Finnish time), only days with emails.
function WelcomeDaily({ rows }) {
  const shown = (rows ?? []).filter((r) => r.delivered > 0);
  if (!shown.length) return <p className="text-[13px] text-white/45">No welcome emails delivered in the last 14 days.</p>;
  const label = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <table className="w-full text-left text-[13px] tabular-nums" data-testid="welcome-daily">
      <thead className="text-white/50">
        <tr>
          <th className="py-1 font-semibold">Day</th>
          <th className="py-1 text-right font-semibold">Delivered</th>
          <th className="py-1 text-right font-semibold">Opened</th>
          <th className="py-1 text-right font-semibold">After 1 min</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.day} className="border-t border-white/10">
            <td className="py-1.5 text-white/80">{label(r.day)}</td>
            <td className="py-1.5 text-right">{r.delivered}</td>
            <td className="py-1.5 text-right font-bold text-white">{r.openPct}% <span className="font-normal text-white/45">({r.opened})</span></td>
            <td className="py-1.5 text-right">{r.laterPct}% <span className="text-white/45">({r.openedLater})</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The follow-up reminders (_shared/signupReminders.js reminderStats), one row each.
function Reminders({ rows }) {
  if (!rows) return <p className="text-[13px] text-white/45">Not set up yet.</p>;
  const cols = [["Sent", "sent"], ["Opened", "opened"], ["After 1 min", "openedLater"], ["Clicked", "clicked"], ["Came back", "cameBack"], ["Made preview", "madePreview"], ["Paid", "paid"]];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13px] tabular-nums" data-testid="reminder-stats">
        <thead className="text-white/50">
          <tr><th className="py-1 font-semibold">Reminder</th>{cols.map(([label]) => <th key={label} className="py-1 text-right font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind} className="border-t border-white/10">
              <td className="py-1.5 pr-2 text-white/80">{r.label}</td>
              {cols.map(([label, key]) => (
                <td key={label} className="py-1.5 text-right">{r[key]}{key !== "sent" && r.sent > 0 && <span className="text-white/45"> {Math.round((r[key] / r.sent) * 100)}%</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bars({ rows, of, empty = "Nothing yet." }) {
  if (!rows?.length) return <p className="text-[13px] text-white/45">{empty}</p>;
  const top = of ?? Math.max(...rows.map((r) => r.n));
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]"><span className="min-w-0 break-words text-white/85">{r.label}</span><span className="shrink-0 font-bold tabular-nums text-white">{r.n}{of ? <span className="ml-1.5 font-medium text-white/50">{Math.round((r.n / of) * 100)}%</span> : null}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${top ? Math.max(2, (r.n / top) * 100) : 0}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Steps({ steps, surveyEnds }) {
  return (
    <ol className="grid gap-2.5" data-testid="funnel-steps">
      {steps.map((s, i) => (
        <li key={s.key} className="min-w-0" data-step={s.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-[14px] font-semibold text-white">{s.label}</span>
            {s.notTracked
              ? <span className="shrink-0 text-[12.5px] font-semibold text-white/50">Not tracked yet</span>
              : <span className="shrink-0 text-[15px] font-black tabular-nums text-white">{s.users}<span className="ml-1.5 text-[12.5px] font-semibold text-white/55">{s.pctOfSignups}%</span></span>}
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${Math.max(s.users ? 2 : 0, s.pctOfSignups)}%` }} /></div>
          {i > 0 && s.lostFromPrevious > 0 && <p className="mt-0.5 text-[12px] font-semibold text-amber-200/90">{s.lostFromPrevious} dropped off here</p>}
          {s.key === "survey_done" && <p className="mt-0.5 text-[12px] text-white/55">{surveyEnds.completed} completed, {surveyEnds.skipped} skipped</p>}
        </li>
      ))}
    </ol>
  );
}

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

function Hopes({ hopes, total }) {
  const [all, setAll] = useState(false);
  if (!hopes?.length) return <p className="text-[13px] text-white/45">No answers yet.</p>;
  const shown = all ? hopes : hopes.slice(0, 15);
  return (
    <>
      <ul className="grid gap-2.5" data-testid="hope-list">
        {shown.map((h, i) => (
          <li key={`${h.at}-${i}`} className="min-w-0 rounded-xl bg-white/[0.05] p-3">
            <p className="break-words text-[14.5px] font-semibold leading-snug text-white">“{h.text}”</p>
            <p className="mt-1 text-[12px] leading-snug text-white/50">
              {when(h.at)}
              {h.goals.length > 0 && <> · {h.goals.join(", ")}</>}
              {h.experience && <> · Made videos: {h.experience}</>}
              {h.heard && <> · Heard via {h.heard}{h.creator ? ` (${h.creator})` : ""}</>}
            </p>
          </li>
        ))}
      </ul>
      {hopes.length > shown.length && <button type="button" onClick={() => setAll(true)} className="mt-3 min-h-[40px] w-full rounded-xl border border-white/15 text-[13.5px] font-bold text-white/80">Show all {hopes.length}</button>}
      {total > hopes.length && <p className="mt-2 text-[12px] text-white/45">The newest {hopes.length} of {total}.</p>}
    </>
  );
}

const Stat = ({ label, value, sub, bad }) => (
  <div className="rounded-xl bg-white/[0.05] p-3">
    <div className="text-[12px] text-white/55">{label}</div>
    <div className={`text-[22px] font-black tabular-nums ${bad && value > 0 ? "text-red-300" : "text-white"}`}>{value ?? "–"}</div>
    {sub && <div className="text-[11.5px] text-white/50">{sub}</div>}
  </div>
);

export default function Funnel() {
  const [period, setPeriod] = useState("7");
  const [day, setDay] = useState("");
  const [state, setState] = useState({ status: "loading" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    const [from, to] = day ? [new Date(`${day}T00:00:00`), new Date(new Date(`${day}T00:00:00`).getTime() + DAY)] : PERIODS.find((p) => p.key === period).range();
    const { data, error } = await supabase.functions.invoke("funnel-dashboard", { body: { from: from.toISOString(), to: to.toISOString() } });
    if (error || !data?.steps) { setState({ status: error?.context?.status === 404 || error?.context?.status === 401 ? "denied" : "error" }); return; }
    setState({ status: "ready", data });
  }, [period, day]);
  useEffect(() => { document.title = "Funnel | Zyvo"; load(); }, [load]);

  const d = state.data, e = d?.email, sent = e?.sent ?? 0;
  if (state.status === "denied") return <div className="grid min-h-[100dvh] place-items-center bg-[#090A0A] text-[15px] text-white/70">Not allowed.</div>;
  return (
    <div className="min-h-[100dvh] bg-[#090A0A] px-4 pb-16 pt-5 text-white" data-testid="admin-funnel">
      <div className="mx-auto grid w-full max-w-[720px] gap-4">
        <header>
          <h1 className="text-[24px] font-black tracking-tight">New user funnel</h1>
          <p className="text-[13px] text-white/55">People who signed up in this period, and how far they got. You and test accounts are left out.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" onClick={() => { setDay(""); setPeriod(p.key); }} data-testid={`period-${p.key}`} className={`min-h-[40px] rounded-full border px-3.5 text-[13.5px] font-bold transition ${!day && period === p.key ? "border-lime-300 bg-lime-300 text-[#11150D]" : "border-white/15 text-white/80"}`}>{p.label}</button>
            ))}
            <input type="date" value={day} onChange={(ev) => setDay(ev.target.value)} aria-label="Pick a day" className="min-h-[40px] rounded-full border border-white/15 bg-transparent px-3 text-[13.5px] text-white/80 [color-scheme:dark]" />
          </div>
        </header>

        {state.status === "error" && <p className="text-[14px] text-red-300">Couldn't load the numbers. <button type="button" onClick={load} className="underline">Try again</button></p>}
        {state.status === "loading" && !d && <p className="text-[14px] text-white/55">Loading…</p>}
        {d && (
          <div className={`grid gap-4 transition-opacity ${state.status === "loading" ? "opacity-50" : ""}`}>
            <Card title="Step by step" note="% of everyone who signed up in this period.">
              <Steps steps={d.steps} surveyEnds={d.surveyEnds} />
            </Card>
            <Card title="On the upgrade screen" note={`What people pressed. ${d.steps.find((s) => s.key === "upgrade_screen_shown")?.users ?? 0} saw it.`}>
              <Bars rows={d.clicks} of={d.steps.find((s) => s.key === "upgrade_screen_shown")?.users || undefined} empty="No clicks recorded yet: this starts when the new tracking is live." />
              {d.comparePlans.length > 0 && <div className="mt-4"><h3 className="mb-2 text-[13px] font-bold text-white/70">Plans chosen inside Compare plans</h3><Bars rows={d.comparePlans} /></div>}
            </Card>
            <Card title="Which video they generate"><Bars rows={d.topics} /></Card>
            <Card title="What they want to create" note={`${d.survey.answered} answered. They can pick several.`}><Bars rows={d.survey.goals} of={d.survey.answered || undefined} /></Card>
            <Card title="Have they made videos before"><Bars rows={d.survey.experience} of={d.survey.answered || undefined} /></Card>
            <Card title="How they heard about Zyvo"><Bars rows={d.survey.heard} of={d.survey.answered || undefined} /></Card>
            <Card title="Creators they named"><Bars rows={d.survey.creators} empty="No names typed in yet." /></Card>
            <Card title="What they hope Zyvo helps them create" note={`${d.survey.hopeCount ?? 0} of ${d.survey.answered} wrote something. Grouped by the words they used; one answer can be in two groups.`}>
              <Bars rows={d.survey.hopeGroups} empty="No answers yet." />
              <h3 className="mb-2 mt-5 text-[13px] font-bold text-white/70">Every answer, newest first</h3>
              <Hopes hopes={d.survey.hopes} total={d.survey.hopeCount} />
            </Card>
            <Card title="Email opt-in"><p className="text-[28px] font-black tabular-nums" data-testid="optin-pct">{d.survey.optInPct}%</p><p className="text-[13px] text-white/55">{d.survey.optedIn} of the {d.survey.answered} who finished the survey</p></Card>
            <Card title="Welcome email" note={d.welcomeOn ? "On. Emails sent in this period." : "Off for users until you say so."}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="welcome-stats">
                <Stat label="Sent" value={sent} />
                <Stat label="Delivered" value={e.delivered} sub={sent ? `${Math.round((e.delivered / sent) * 100)}%` : null} />
                <Stat label="Opened" value={e.opened} sub={sent ? `${Math.round((e.opened / sent) * 100)}%` : null} />
                <Stat label="Clicked" value={e.clicked} sub={sent ? `${Math.round((e.clicked / sent) * 100)}%` : null} />
                <Stat label="Bounced" value={e.bounced} bad />
                <Stat label="Marked as spam" value={e.spam} bad />
                <Stat label="Replied" value={e.replies} sub="In your inbox" />
              </div>
              <h3 className="mb-2 mt-4 text-[13px] font-bold text-white/70">Open rate per day (last 14 days)</h3>
              <WelcomeDaily rows={d.welcomeDaily} />
              <p className="mt-2 text-[12px] leading-snug text-white/50">Each day counts the emails delivered that day and whether they were opened since. "After 1 min" leaves out opens in the first minute, which are mostly mail software, not people.</p>
              <h3 className="mb-2 mt-4 text-[13px] font-bold text-white/70">"Check your spam" note</h3>
              <div className="grid grid-cols-2 gap-2" data-testid="spam-note-stats">
                <Stat label="Note shown" value={e.noteShown ?? 0} />
                <Stat label="Tapped “I found it”" value={e.noteFound ?? 0} sub={e.noteShown ? `${Math.round(((e.noteFound ?? 0) / e.noteShown) * 100)}%` : null} />
              </div>
              <p className="mt-2 text-[12px] leading-snug text-white/50">Gmail doesn't report spam clicks to us, so "Marked as spam" misses Gmail. For that, use Google Postmaster Tools. Replies go straight to your inbox, so they aren't counted here.</p>
            </Card>
            <Card title="Follow-up reminders" note={d.remindersOn ? "On. Reminders sent in this period, and what those people did after their own email." : "Off for users until you say so."}>
              <Reminders rows={d.reminders} />
              <p className="mt-2 text-[12px] leading-snug text-white/50">"After 1 min" leaves out opens in the first minute (mostly mail software). "Came back" is anything they did on the site after the email; reminders are never sent while someone is on the site.</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
