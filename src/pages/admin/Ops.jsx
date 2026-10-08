// /admin/ops — the owner's page (2026-10-07). One read-only screen: the provider
// balance, failures per hour, everything stuck right now, and today's provider
// spend against the credits charged. The server (ops-status) decides who may
// see it; anyone else gets "not allowed" and no data. Refreshes every 30 s.
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const money = (n) => (n == null ? "–" : `$${Number(n).toFixed(2)}`);
const num = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US"));
const hourLabel = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const short = (id) => String(id ?? "").slice(0, 8);

function Card({ title, children, tone = "plain", testid }) {
  const border = tone === "bad" ? "border-red-300/40" : tone === "warn" ? "border-amber-300/40" : "border-white/10";
  return (
    <section data-testid={testid} className={`rounded-2xl border ${border} bg-white/[0.04] p-5`}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
const Stat = ({ label, value, sub }) => (
  <div className="min-w-0">
    <div className="text-[12px] text-white/50">{label}</div>
    <div className="text-[24px] font-bold tabular-nums text-white">{value}</div>
    {sub && <div className="text-[12px] text-white/45">{sub}</div>}
  </div>
);
const SERIES = [["tools", "Image and video tools"], ["scenes", "Long Form scenes"], ["fruit", "Fruit Story"], ["renders", "Renders"], ["voice", "Voice"]];

function StuckTable({ title, rows, cols }) {
  if (!rows?.length) return null;
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-1 text-[13px] font-semibold text-white">{title} · {rows.length}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[12.5px] tabular-nums text-white/75">
          <thead><tr className="text-white/45">{cols.map(([k, label]) => <th key={k} className="py-1 pr-4 font-medium">{label}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-white/[0.06]">{cols.map(([k, , fmt]) => <td key={k} className="py-1 pr-4">{fmt ? fmt(r[k], r) : String(r[k] ?? "–")}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// Blocky Stories' alarm (its own function, blocky-story-api: the same owner check on the server). The switch
// for paid calls, what users cost us against what they were charged, and any open alert.
function BlockyCard({ b }) {
  if (!b) return <Card title="Blocky Stories · alarm" testid="ops-blocky"><p className="text-[14px] text-white/60">Couldn't load Blocky's numbers.</p></Card>;
  const w = b.watch;
  const spendAlert = b.alerts.find((a) => a.kind === "spend");
  const off = { switch_off: "switched off", cap_reached: "today's cap is reached", unreadable: "the switch couldn't be read" }[b.offReason] ?? "switched off";
  return (
    <Card title="Blocky Stories · alarm" tone={spendAlert ? "bad" : b.alerts.length ? "warn" : "plain"} testid="ops-blocky">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Paid calls" value={b.paidCalls ? "On" : spendAlert ? "Paused" : "Off"} sub={b.paidCalls ? "stories can be made" : spendAlert ? "paused by the alarm" : off} />
        <Stat label={`Spent on users · last ${w.hours} h`} value={money(w.spendUsd)} sub={`all of Blocky today, tests too: ${money(b.today.spentUsd)}${b.today.inFlightUsd > 0 ? ` · ${money(b.today.inFlightUsd)} running` : ""}`} />
        <Stat label="Charged to users" value={money(w.chargedUsd)} sub={`${num(w.chargedCredits)} credits, net of refunds`} />
        <Stat label="Spend ahead of charges" value={w.aheadUsd > 0 ? money(w.aheadUsd) : "None"} sub={`the alarm pauses paid calls above ${money(w.alarmAtUsd)}`} />
      </div>
      {b.alerts.length === 0 && <p className="mt-3 text-[12.5px] text-white/55">No alarm. Limits: {money(b.limits.userDailyUsd)} of our cost per user per day; {b.today.capUsd == null ? "no daily cap on Blocky as a whole" : `${money(b.today.capUsd)} a day for Blocky as a whole`}.</p>}
      {b.alerts.map((a) => (
        <p key={a.kind} className={`mt-3 text-[12.5px] ${a.kind === "spend" ? "text-red-200" : "text-amber-200"}`}>
          {a.kind === "spend" ? "Spending alarm" : "A job keeps being sent again"} (last seen {new Date(a.lastSeen).toLocaleString()}): {a.message}
          {a.kind === "spend" && " Paid calls stay off until you switch them back on."}
        </p>
      ))}
    </Card>
  );
}

export default function Ops() {
  const [data, setData] = useState(null);
  const [blocky, setBlocky] = useState(null);
  const [state, setState] = useState("loading"); // loading | ok | denied | error
  const load = useCallback(async () => {
    const { data: d, error } = await supabase.functions.invoke("ops-status", { body: {} });
    if (error) { const status = error?.context?.status; setState(status === 401 || status === 403 ? "denied" : "error"); return; }
    setData(d); setState("ok");
    // Blocky's card has its own source; a failure there never hides the rest of the page.
    const { data: b, error: blockyError } = await supabase.functions.invoke("blocky-story-api", { body: { action: "opsStatus" } });
    setBlocky(!blockyError && b?.ok ? b.data : null);
  }, []);
  useEffect(() => { document.title = "Ops | Zyvo"; load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  if (state === "loading") return <div className="p-6 text-white/70">Loading…</div>;
  if (state === "denied") return <div className="p-6 text-white/70" data-testid="ops-denied">This page is for the site owner. Sign in with the owner's account to see it.</div>;
  if (state === "error" || !data) return <div className="p-6 text-white/70">Couldn't load the numbers. <button type="button" className="underline" onClick={load}>Try again</button></div>;

  const { provider: p, failures: f, stuck: s, today: t } = data;
  const maxHour = Math.max(1, ...f.hours.map((h) => SERIES.reduce((a, [k]) => a + h[k], 0)));
  const stuckCount = s.jobs.length + s.scenes.length + s.renders.length + s.voice.filter((v) => !v.paused).length + s.fruit.length + s.twoAm.length;
  const rate = (x) => (x.ok + x.failed ? `${Math.round((x.failed / (x.ok + x.failed)) * 100)} % of ${num(x.ok + x.failed)}` : "no work");
  const margin = t.credits.valueUsd - t.spend.knownUsd;

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-6 text-white">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">Ops</h1>
        <p className="text-[12px] text-white/45">Updated {new Date(data.at).toLocaleTimeString()} · refreshes every 30 s</p>
      </div>

      <Card title="Provider balance" tone={p.paused ? "bad" : p.freeUsd != null && p.thresholdUsd != null && p.freeUsd < p.thresholdUsd * 2 ? "warn" : "plain"} testid="ops-provider">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={`${p.name} balance`} value={money(p.balanceUsd)} sub={p.balanceIsLive ? "read just now" : "last saved reading"} />
          <Stat label="Needed by work in flight" value={money(p.inFlightUsd)} sub={`${p.inFlight.jobs} jobs · ${p.inFlight.fruit} Fruit · ${p.inFlight.scenes} scenes (estimate)`} />
          <Stat label="Free" value={money(p.freeUsd)} sub={`new work pauses below ${money(p.thresholdUsd)}`} />
          <Stat label="New work" value={p.paused ? "Paused" : "Running"} sub={p.paused && p.pausedSince ? `since ${new Date(p.pausedSince).toLocaleTimeString()}` : "users are not held up"} />
        </div>
        {p.paused && p.lastError && <p className="mt-3 text-[12.5px] text-red-200">Why: {p.lastError}</p>}
        {p.providerUsageToday && <p className="mt-3 text-[12.5px] text-white/55">Runware's own count for today: {num(p.providerUsageToday.requests)} requests, {num(p.providerUsageToday.credits)} in its usage units.</p>}
      </Card>

      <BlockyCard b={blocky} />

      <Card title="Failures per hour · last 24 hours" testid="ops-failures">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Image and video tools" value={num(f.last24h.tools.failed)} sub={rate(f.last24h.tools)} />
          <Stat label="Long Form scenes" value={num(f.last24h.scenes.failed)} sub={rate(f.last24h.scenes)} />
          <Stat label="Fruit Story" value={num(f.last24h.fruit.failed)} sub={rate(f.last24h.fruit)} />
          <Stat label="Renders" value={num(f.last24h.renders.failed)} />
          <Stat label="Voice" value={num(f.last24h.voice.failed)} />
        </div>
        <div className="mt-4 flex h-28 items-end gap-[3px]" role="img" aria-label="Failures per hour, last 24 hours">
          {f.hours.map((h) => {
            const total = SERIES.reduce((a, [k]) => a + h[k], 0);
            return <div key={h.hour} title={`${hourLabel(h.hour)} · ${total} failed (${SERIES.map(([k, label]) => `${label} ${h[k]}`).join(", ")})`} className="flex-1 rounded-t bg-red-300/70" style={{ height: `${total ? Math.max(4, (total / maxHour) * 100) : 1}%`, opacity: total ? 1 : 0.25 }} />;
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-white/40"><span>{hourLabel(f.hours[0].hour)}</span><span>now</span></div>
        {f.topFailingTools.length > 0 && <p className="mt-3 text-[12.5px] text-white/60">Most failures: {f.topFailingTools.map((x) => `${x.tool} (${x.failed})`).join(" · ")}</p>}
      </Card>

      <Card title="Stuck right now" tone={stuckCount ? "warn" : "plain"} testid="ops-stuck">
        {stuckCount === 0 && s.voice.length === 0 && <p className="text-[14px] text-white/75">Nothing is stuck.</p>}
        <StuckTable title="Image and video jobs (15 min or more)" rows={s.jobs} cols={[["tool", "Tool"], ["status", "State"], ["minutes", "Minutes"], ["credits", "Credits held"], ["id", "Job", short]]} />
        <StuckTable title="Long Form scenes past their time" rows={s.scenes} cols={[["scene", "Scene"], ["minutes", "Minutes"], ["project", "Project", short]]} />
        <StuckTable title="Renders (30 min or more)" rows={s.renders} cols={[["status", "State"], ["attempt", "Attempt"], ["minutes", "Minutes"], ["lastHeartbeatMinutes", "Last sign of life (min)"], ["project", "Project", short]]} />
        <StuckTable title="Voice" rows={s.voice} cols={[["paused", "State", (v) => (v ? "paused, retrying by itself" : "stuck")], ["tries", "Tries"], ["minutes", "Minutes"], ["project", "Project", short]]} />
        <StuckTable title="Fruit Story jobs (15 min or more)" rows={s.fruit} cols={[["kind", "Kind"], ["status", "State"], ["minutes", "Minutes"], ["credits", "Credits"], ["id", "Job", short]]} />
        <StuckTable title="2AM stories never settled" rows={s.twoAm} cols={[["status", "State"], ["minutes", "Minutes"], ["credits", "Credits held"], ["id", "Story", short]]} />
        {s.oldBacklog.jobs > 0 && <p className="mt-4 text-[12.5px] text-white/55">Old backlog, left alone on purpose (made before {s.oldBacklog.since.slice(0, 10)}): {num(s.oldBacklog.jobs)} unfinished jobs, {num(s.oldBacklog.chargedJobs)} of them charged ({num(s.oldBacklog.chargedCredits)} credits).</p>}
      </Card>

      <Card title={`Today (${t.day}, UTC) · provider spend vs credits charged`} testid="ops-today">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Provider spend we recorded" value={money(t.spend.knownUsd)} sub={`Long Form ${money(t.spend.longFormUsd)} · Fruit ${money(t.spend.fruitUsd)}`} />
          <Stat label="Credits charged (net of refunds)" value={num(t.credits.total)} sub={`tools ${num(t.credits.tools)} · Fruit ${num(t.credits.fruit)} · Long Form ${num(t.credits.longFormSettled)}`} />
          <Stat label="Worth, at the cheapest credit" value={money(t.credits.valueUsd)} sub={`$${t.credits.usdPerCredit} a credit`} />
          <Stat label="Difference" value={money(margin)} sub="charged minus recorded spend" />
        </div>
        <p className="mt-3 text-[12.5px] text-white/55">Refunded today: {num(t.credits.refundedToday)} credits. Long Form credits on hold from today: {num(t.credits.longFormHeldToday)}; released today: {num(t.credits.longFormReleasedToday)}.</p>
        <p className="mt-1 text-[12.5px] text-white/45">{t.spend.note}</p>
      </Card>
    </div>
  );
}
