// /admin/content-machine — the owner's Content Machine (content/CONTENT_MACHINE_SPEC.md). Phase 1: the
// top bar (spend against the caps, the kill switch, dry run), the Budget tab and the Settings tab.
// The server (content-machine-api) decides who may see it: anyone but the verified admin gets a 404 from
// it, and this page then shows the site's normal "Page Not Found", so nothing reveals the page exists.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import NotFoundRedirect from "../../components/NotFoundRedirect";

const money = (n, d = 2) => (n == null ? "–" : `$${Number(n).toFixed(d)}`);
const pct = (share) => (share == null ? "" : `${Math.round(share * 100)} %`);
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
const PROVIDERS = ["runware", "anthropic", "apify", "youtube", "fly", "other"];
const FORMATS = [
  ["zyvo_native", "Zyvo tool (result + making-of)"], ["listicle_slideshow", "Listicle slideshow"], ["long_form_cutdown", "Long Form cut-down"],
  ["pov_skit", "POV skit"], ["before_after", "Before / after"], ["series_episode", "Series episode"], ["challenge", "Challenge"],
];
const REASONS = { kill_switch: "kill switch", daily_cap: "daily cap", monthly_cap: "monthly cap", provider_cap: "provider cap", lane_cap: "cap for this kind of work", bad_estimate: "no valid estimate" };

async function api(action, body = {}) {
  const { data, error } = await supabase.functions.invoke("content-machine-api", { body: { action, ...body } });
  if (error) {
    const status = error?.context?.status;
    let message = "Couldn't reach the server. Try again.";
    try { const j = await error.context.json(); if (j?.message && j.code !== "NOT_FOUND") message = j.message; } catch { /* no body */ }
    const e = new Error(message);
    e.status = status;
    throw e;
  }
  if (!data?.ok) throw new Error(data?.message ?? "Something went wrong.");
  return data.data;
}

function Card({ title, children, tone = "plain", testid, right }) {
  const border = tone === "bad" ? "border-red-300/40" : tone === "warn" ? "border-amber-300/40" : "border-white/10";
  return (
    <section data-testid={testid} className={`rounded-2xl border ${border} bg-white/[0.04] p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">{title}</h2>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Meter({ label, m, sub }) {
  const share = m.capUsd == null ? 0 : Math.min(1, m.share ?? 0);
  const bar = m.full ? "bg-red-300" : m.warn ? "bg-amber-300" : "bg-lime-300";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[12px] text-white/50"><span>{label}</span><span className="tabular-nums">{pct(m.share)}</span></div>
      <div className="text-[20px] font-bold tabular-nums text-white">{money(m.usedUsd)} <span className="text-[13px] font-medium text-white/45">of {m.capUsd == null ? "no cap" : money(m.capUsd)}</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.08]" role="img" aria-label={`${label}: ${money(m.usedUsd)} of ${money(m.capUsd)}`}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(share * 100, m.usedUsd > 0 ? 2 : 0)}%` }} />
      </div>
      {sub && <div className="mt-1 text-[11.5px] text-white/45">{sub}</div>}
    </div>
  );
}

function Toggle({ on, onChange, label, disabled, testid, tone = "lime" }) {
  const onBg = tone === "red" ? "bg-red-400" : "bg-lime-300";
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} data-testid={testid} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${on ? onBg : "bg-white/15"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

/* ─── top bar ────────────────────────────────────────────────────────── */

function TopBar({ st, onStatus }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const kill = st.settings.kill_switch;
  const flip = async (on) => {
    if (on && !window.confirm("Turn the kill switch ON? Nothing will run (not even dry runs) until you turn it off.")) return;
    if (!on && !window.confirm("Turn the kill switch OFF? Work can run again, within the caps.")) return;
    setBusy(true); setNote(null);
    try { onStatus(await api("setKillSwitch", { on })); } catch (e) { setNote(e.message); }
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5" data-testid="cm-topbar">
        <Meter label={`Today (${st.spend.today})`} m={st.spend.day} sub={st.spend.reservedUsd > 0 ? `${money(st.spend.reservedUsd)} of it still reserved` : null} />
        <Meter label="This month" m={st.spend.month} />
        <div className="min-w-0">
          <div className="text-[12px] text-white/50">Run</div>
          <div className="text-[15px] font-semibold text-white">No runs yet</div>
          <button type="button" disabled title="Comes with the slideshow MVP (Phase 2)" className="mt-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/50">Run now</button>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] text-white/50">Kill switch</div>
          <div className="mt-1 flex items-center gap-3">
            <Toggle on={kill} onChange={flip} disabled={busy} label="Kill switch" testid="cm-kill" tone="red" />
            <span className={`text-[14px] font-semibold ${kill ? "text-red-200" : "text-white/80"}`}>{kill ? "ON: nothing runs" : "Off"}</span>
          </div>
          <div className="mt-1 text-[11.5px] text-white/45">
            {st.dryRun.effective ? <>Dry run: paid calls are mocked at $0{st.dryRun.env ? " (DRY_RUN secret)" : ""}</> : <span className="text-amber-200">Paid calls are LIVE (within the caps)</span>}
          </div>
          {note && <div role="status" className="mt-1 text-[12px] text-red-200">{note}</div>}
        </div>
      </div>
      {st.spend.warnings.length > 0 && (
        <div role="alert" data-testid="cm-warning" className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2.5 text-[13px] text-amber-100">
          {st.spend.warnings.join(" ")}
        </div>
      )}
    </div>
  );
}

/* ─── Budget tab ─────────────────────────────────────────────────────── */

function SpendChart({ days }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(0.01, ...days.map((d) => d.totalUsd));
  const h = hover == null ? null : days[hover];
  return (
    <div>
      <div className="relative">
        <div className="flex h-32 items-end gap-[2px] border-b border-white/15" role="img" aria-label="Spend per day, last 30 days">
          {days.map((d, i) => (
            <div key={d.day} className="flex h-full flex-1 cursor-default items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <div className={`w-full rounded-t-[4px] ${hover === i ? "bg-lime-200" : "bg-lime-300/80"}`} style={{ height: d.totalUsd > 0 ? `${Math.max(3, (d.totalUsd / max) * 100)}%` : "1px", opacity: d.totalUsd > 0 ? 1 : 0.3 }} />
            </div>
          ))}
        </div>
        {h && (
          <div style={{ left: `${Math.min(80, Math.max(20, ((hover + 0.5) / days.length) * 100))}%` }} className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/15 bg-[#11131a] px-3 py-2 text-[12px] text-white/80 shadow-lg">
            <div className="font-semibold text-white">{h.day} · {money(h.totalUsd, 3)}</div>
            {Object.entries(h.byProvider).map(([p, v]) => <div key={p} className="tabular-nums">{p} {money(v, 3)}</div>)}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-white/40"><span>{days[0]?.day}</span><span>max {money(max)}</span><span>today</span></div>
    </div>
  );
}

function GuardTest({ onDone }) {
  const [provider, setProvider] = useState("runware");
  const [usd, setUsd] = useState("0.50");
  const [lane, setLane] = useState("");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e.preventDefault(); setBusy(true); setOut(null);
    try {
      const r = await api("guardTest", { provider, estimatedUsd: Number(usd), lane: lane || null });
      setOut(r.allowed ? { ok: true, text: "Allowed. A $0 dry-run row was written to the ledger." } : { ok: false, text: `Refused: ${REASONS[r.reason] ?? r.reason}. ${r.message}` });
      onDone();
    } catch (err) { setOut({ ok: false, text: err.message }); }
    setBusy(false);
  };
  const input = "rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-white outline-none focus:border-lime-300/60";
  return (
    <form onSubmit={run} className="flex flex-wrap items-center gap-2 text-[13px] text-white/70">
      <select value={provider} onChange={(e) => setProvider(e.target.value)} className={input} aria-label="Provider">{PROVIDERS.map((p) => <option key={p}>{p}</option>)}</select>
      <span className="flex items-center gap-1">$<input type="number" inputMode="decimal" min="0" step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)} className={`${input} w-24 tabular-nums`} aria-label="Estimated cost in dollars" /></span>
      <input value={lane} onChange={(e) => setLane(e.target.value)} placeholder="lane (e.g. slideshow)" className={`${input} w-44`} aria-label="Lane" />
      <button type="submit" disabled={busy} className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/15 disabled:opacity-40">{busy ? "Checking…" : "Check"}</button>
      {out && <span role="status" className={out.ok ? "text-lime-200" : "text-amber-200"}>{out.text}</span>}
    </form>
  );
}

function BudgetTab({ st, reloadKey, onChanged }) {
  const [days, setDays] = useState(null);
  const [rows, setRows] = useState(null);
  const [audit, setAudit] = useState(null);
  const [filter, setFilter] = useState({ provider: "", day: "" });
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, l, a] = await Promise.all([
        api("history"),
        api("ledger", { provider: filter.provider || null, day: filter.day || null, limit: 200 }),
        api("auditLog", { limit: 30 }),
      ]);
      setDays(h.days); setRows(l.rows); setAudit(a.rows);
    } catch (e) { setError(e.message); }
  }, [filter]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const s = st.spend;
  const input = "rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-[13px] text-white outline-none focus:border-lime-300/60";
  return (
    <div className="space-y-4">
      {error && <p className="text-[13px] text-red-200">{error} <button type="button" className="underline" onClick={load}>Try again</button></p>}
      <Card title="Today by provider and by kind of work">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(s.provider).map(([p, m]) => <Meter key={p} label={p} m={m} />)}
          {Object.entries(s.lane).map(([l, m]) => <Meter key={l} label={`lane: ${l}`} m={m} />)}
        </div>
        {s.dryCalls > 0 && <p className="mt-3 text-[12.5px] text-white/55">Dry runs today: {s.dryCalls} calls, which would have cost {money(s.dryWouldCostUsd, 3)}.</p>}
      </Card>

      <Card title="Spend per day · last 30 days">{days ? <SpendChart days={days} /> : <p className="text-[13px] text-white/50">Loading…</p>}</Card>

      <Card title="Try the guard" right={<span className="text-[11.5px] text-white/45">always a dry run · costs nothing</span>}>
        <p className="mb-2 text-[12.5px] text-white/55">Ask the Budget Guard whether a call of this size would be allowed right now, against the live caps and today's spend.</p>
        <GuardTest onDone={() => { load(); onChanged(); }} />
      </Card>

      <Card title="Ledger" right={
        <div className="flex flex-wrap gap-2">
          <select value={filter.provider} onChange={(e) => setFilter((f) => ({ ...f, provider: e.target.value }))} className={input} aria-label="Filter by provider">
            <option value="">all providers</option>{PROVIDERS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input type="date" value={filter.day} onChange={(e) => setFilter((f) => ({ ...f, day: e.target.value }))} className={input} aria-label="Filter by day" />
        </div>
      }>
        {!rows ? <p className="text-[13px] text-white/50">Loading…</p> : rows.length === 0 ? <p className="text-[13px] text-white/60">No calls yet{filter.provider || filter.day ? " for this filter" : ""}.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px] tabular-nums text-white/75" data-testid="cm-ledger">
              <thead><tr className="text-white/45">{["When", "Provider", "Operation", "Lane", "Estimate", "Actual", "State"].map((h) => <th key={h} className="py-1 pr-4 font-medium">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.06]">
                  <td className="py-1 pr-4">{when(r.created_at)}</td>
                  <td className="py-1 pr-4">{r.provider}</td>
                  <td className="py-1 pr-4">{r.operation}</td>
                  <td className="py-1 pr-4">{r.lane ?? "–"}</td>
                  <td className="py-1 pr-4">{r.dry_run ? <span title="dry run: would have cost">({money(r.would_cost_usd, 4)})</span> : money(r.estimated_usd, 4)}</td>
                  <td className="py-1 pr-4">{r.actual_usd == null ? "–" : money(r.actual_usd, 4)}</td>
                  <td className="py-1 pr-4">{r.dry_run ? "dry run" : r.status}{r.error ? ` · ${r.error}` : ""}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="What you changed (audit log)">
        {!audit ? <p className="text-[13px] text-white/50">Loading…</p> : audit.length === 0 ? <p className="text-[13px] text-white/60">Nothing yet.</p> : (
          <ul className="space-y-1 text-[12.5px] text-white/70">
            {audit.map((a) => (
              <li key={a.id} className="break-words"><span className="tabular-nums text-white/45">{when(a.created_at)}</span> · <span className="font-semibold text-white/85">{a.action}</span>
                {a.action === "settings.save" && a.payload?.changes ? ` · ${Object.entries(a.payload.changes).map(([k, [b, n]]) => `${k}: ${JSON.stringify(b)} → ${JSON.stringify(n)}`).join("; ")}` : ""}
                {a.action === "guard.test" ? ` · ${a.payload.provider} ${money(a.payload.estimatedUsd)} → ${a.payload.allowed ? "allowed" : REASONS[a.payload.reason] ?? a.payload.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ─── Settings tab ───────────────────────────────────────────────────── */

const toForm = (s, models) => ({
  daily_budget_usd: String(s.daily_budget_usd), monthly_budget_usd: String(s.monthly_budget_usd),
  per_provider_daily_caps: Object.fromEntries(Object.entries(s.per_provider_daily_caps ?? {}).map(([k, v]) => [k, String(v)])),
  lane_daily_caps: Object.fromEntries(Object.entries(s.lane_daily_caps ?? {}).map(([k, v]) => [k, String(v)])),
  daily_video_target: String(s.daily_video_target), slideshows_per_day: String(s.slideshows_per_day),
  format_mix: Object.fromEntries(FORMATS.map(([k]) => [k, String(s.format_mix?.[k] ?? 0)])),
  auto_produce: s.auto_produce, end_card: s.end_card, dry_run: s.dry_run,
  run_time_local: s.run_time_local, timezone: s.timezone, brand_rules: s.brand_rules,
  models: { main: s.models?.main ?? "", fast: s.models?.fast ?? "" }, modelsInUse: models,
});
const capsOut = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => k && v !== "").map(([k, v]) => [k, Number(v)]));
const fromForm = (f) => ({
  daily_budget_usd: Number(f.daily_budget_usd), monthly_budget_usd: Number(f.monthly_budget_usd),
  per_provider_daily_caps: capsOut(f.per_provider_daily_caps), lane_daily_caps: capsOut(f.lane_daily_caps),
  daily_video_target: Number(f.daily_video_target), slideshows_per_day: Number(f.slideshows_per_day),
  format_mix: Object.fromEntries(Object.entries(f.format_mix).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])),
  auto_produce: f.auto_produce, end_card: f.end_card, dry_run: f.dry_run,
  run_time_local: f.run_time_local, timezone: f.timezone, brand_rules: f.brand_rules, models: f.models,
});

function Field({ label, hint, children, htmlFor }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[12.5px] font-semibold text-white/80">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11.5px] text-white/45">{hint}</p>}
    </div>
  );
}

function CapsEditor({ caps, onChange, fixed, idPrefix }) {
  const keys = [...new Set([...fixed, ...Object.keys(caps)])];
  const [extra, setExtra] = useState("");
  const input = "w-24 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 tabular-nums text-white outline-none focus:border-lime-300/60";
  return (
    <div className="space-y-1.5">
      {keys.map((k) => (
        <div key={k} className="flex items-center gap-2 text-[13px] text-white/75">
          <label htmlFor={`${idPrefix}-${k}`} className="w-28 shrink-0">{k}</label>$
          <input id={`${idPrefix}-${k}`} type="number" inputMode="decimal" min="0" step="0.01" value={caps[k] ?? ""} placeholder="no cap" onChange={(e) => onChange({ ...caps, [k]: e.target.value })} className={input} />
        </div>
      ))}
      <div className="flex items-center gap-2 text-[12.5px]">
        <input value={extra} onChange={(e) => setExtra(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="add a name" className="w-28 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-white outline-none" aria-label="New cap name" />
        <button type="button" disabled={!extra} onClick={() => { onChange({ ...caps, [extra]: "" }); setExtra(""); }} className="rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white disabled:opacity-40">Add</button>
      </div>
    </div>
  );
}

function SettingsTab({ st, onStatus }) {
  const initial = useMemo(() => toForm(st.settings, st.models), [st.settings, st.models]);
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => { setF(initial); }, [initial]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(fromForm(f)) !== JSON.stringify(fromForm(initial));

  const save = async (e) => {
    e.preventDefault();
    const patch = fromForm(f);
    if (initial.dry_run && !patch.dry_run && !window.confirm("Turn dry run OFF? From now on the machine makes real, paid calls (within the caps).")) return;
    setBusy(true); setNote(null);
    try { onStatus(await api("saveSettings", { patch })); setNote({ ok: true, text: "Saved." }); } catch (err) { setNote({ ok: false, text: err.message }); }
    setBusy(false);
  };
  const input = "w-full rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[14px] text-white outline-none focus:border-lime-300/60";
  const num = (k, props = {}) => <input id={`cm-${k}`} type="number" inputMode="decimal" value={f[k]} onChange={(e) => set(k)(e.target.value)} className={`${input} tabular-nums`} {...props} />;
  const toggleRow = (k, label, hint, tone) => (
    <div className="flex items-start justify-between gap-3 py-1">
      <div><div className="text-[13.5px] font-semibold text-white/85">{label}</div><div className="text-[11.5px] text-white/45">{hint}</div></div>
      <Toggle on={f[k]} onChange={set(k)} label={label} testid={`cm-${k}`} tone={tone} />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-4" data-testid="cm-settings">
      <Card title="Budget">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Daily budget, all providers" htmlFor="cm-daily_budget_usd">{num("daily_budget_usd", { min: 0, step: "0.01" })}</Field>
          <Field label="Monthly budget" htmlFor="cm-monthly_budget_usd">{num("monthly_budget_usd", { min: 0, step: "0.01" })}</Field>
          <Field label="Daily cap per provider" hint="Empty: no cap of its own (the daily and monthly budgets still apply).">
            <CapsEditor caps={f.per_provider_daily_caps} onChange={set("per_provider_daily_caps")} fixed={["runware", "anthropic", "apify"]} idPrefix="cm-provider" />
          </Field>
          <Field label="Daily cap per kind of work" hint="slideshow: everything a slideshow costs, whatever the provider.">
            <CapsEditor caps={f.lane_daily_caps} onChange={set("lane_daily_caps")} fixed={["slideshow"]} idPrefix="cm-lane" />
          </Field>
        </div>
      </Card>

      <Card title="Production">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slideshows per day" htmlFor="cm-slideshows_per_day" hint="Kept low while we check quality.">{num("slideshows_per_day", { min: 0, max: 50, step: 1 })}</Field>
          <Field label="Daily video target (full machine)" htmlFor="cm-daily_video_target">{num("daily_video_target", { min: 0, max: 100, step: 1 })}</Field>
          <Field label="Run time (local)" htmlFor="cm-run_time_local"><input id="cm-run_time_local" type="time" value={f.run_time_local} onChange={(e) => set("run_time_local")(e.target.value)} className={input} /></Field>
          <Field label="Time zone" htmlFor="cm-timezone" hint="Days and caps are counted in this time zone."><input id="cm-timezone" value={f.timezone} onChange={(e) => set("timezone")(e.target.value)} className={input} /></Field>
        </div>
        <div className="mt-4">
          <div className="text-[12.5px] font-semibold text-white/80">Format mix (ideas per day)</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {FORMATS.map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-2 text-[13px] text-white/75">
                <span>{label}</span>
                <input type="number" min="0" max="30" step="1" value={f.format_mix[k]} onChange={(e) => set("format_mix")({ ...f.format_mix, [k]: e.target.value })} className="w-20 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 tabular-nums text-white outline-none" />
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {toggleRow("dry_run", "Dry run", st.dryRun.env ? "The DRY_RUN secret is also on, so calls stay mocked whatever this says." : "On: every paid call is mocked at $0. Off: real, paid calls.", "lime")}
          {toggleRow("auto_produce", "Auto-produce", "Make ideas without waiting for your approval.")}
          {toggleRow("end_card", "End card", "\"made with Zyvo · tryzyvo.com\" in the last 1.5 s.")}
        </div>
      </Card>

      <Card title="Writing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Main model (scout, ideas)" htmlFor="cm-model-main" hint={`Empty: ${f.modelsInUse.main} (the function secret or the default).`}>
            <input id="cm-model-main" value={f.models.main} placeholder={f.modelsInUse.main} onChange={(e) => set("models")({ ...f.models, main: e.target.value })} className={input} />
          </Field>
          <Field label="Fast model (captions, checks)" htmlFor="cm-model-fast" hint={`Empty: ${f.modelsInUse.fast}.`}>
            <input id="cm-model-fast" value={f.models.fast} placeholder={f.modelsInUse.fast} onChange={(e) => set("models")({ ...f.models, fast: e.target.value })} className={input} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Brand rules" htmlFor="cm-brand_rules" hint="Given to every prompt and the final compliance check.">
            <textarea id="cm-brand_rules" rows={8} value={f.brand_rules} onChange={(e) => set("brand_rules")(e.target.value)} className={`${input} font-mono text-[12.5px] leading-relaxed`} />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-white/10 bg-[#0b0c10]/95 px-4 py-3 backdrop-blur">
        <button type="submit" disabled={busy || !dirty} data-testid="cm-save" className="rounded-lg bg-lime-300 px-4 py-2 text-[14px] font-semibold text-[#071006] transition enabled:hover:bg-lime-200 disabled:opacity-40">{busy ? "Saving…" : "Save settings"}</button>
        {dirty && <button type="button" onClick={() => { setF(initial); setNote(null); }} className="text-[13px] text-white/60 underline">Undo changes</button>}
        {note && <span role="status" className={`text-[13px] ${note.ok ? "text-lime-200" : "text-red-200"}`}>{note.text}</span>}
        {st.settings.updated_by && <span className="ml-auto text-[11.5px] text-white/40">Last saved {when(st.settings.updated_at)} by {st.settings.updated_by}</span>}
      </div>
    </form>
  );
}

/* ─── page ───────────────────────────────────────────────────────────── */

const TABS = [["budget", "Budget"], ["settings", "Settings"]];

export default function ContentMachine() {
  const [st, setSt] = useState(null);
  const [state, setState] = useState("loading"); // loading | ok | notfound | error
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("budget");
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(async () => {
    try { setSt(await api("status")); setState("ok"); }
    catch (e) { if (e.status === 404 || e.status === 401) setState("notfound"); else { setError(e.message); setState((s) => (s === "ok" ? "ok" : "error")); } }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (state === "ok") document.title = "Content Machine | Zyvo"; }, [state]);

  if (state === "loading") return <div className="min-h-screen" />;
  if (state === "notfound") return <NotFoundRedirect />;
  if (state === "error") return <div className="p-6 text-white/70">{error} <button type="button" className="underline" onClick={load}>Try again</button></div>;
  const onStatus = (s) => { setSt(s); setReloadKey((k) => k + 1); };

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-6 text-white" data-testid="cm-page">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">Content Machine</h1>
        <p className="text-[12px] text-white/45">refreshes every 30 s</p>
      </div>
      <TopBar st={st} onStatus={onStatus} />
      <nav className="flex gap-1 overflow-x-auto border-b border-white/10" aria-label="Content Machine tabs">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] font-semibold transition ${tab === k ? "border-lime-300 text-white" : "border-transparent text-white/50 hover:text-white/80"}`}>{label}</button>
        ))}
      </nav>
      {tab === "budget" && <BudgetTab st={st} reloadKey={reloadKey} onChanged={load} />}
      {tab === "settings" && <SettingsTab st={st} onStatus={onStatus} />}
    </div>
  );
}
