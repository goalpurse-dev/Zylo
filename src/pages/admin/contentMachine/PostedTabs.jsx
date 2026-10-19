// Content Machine, Part 2: the Posted and Analytics tabs (owner, 2026-10-18), and "Mark as posted".
//   Posted     every posted slideshow: thumbnail, platform, posted time (Helsinki), latest views, a "needs
//              stats" badge at 24 h / 7 d; per post its stats snapshots (each with its own editable time), Edit /
//              Delete, Ctrl+V a screenshot (the fast model reads the numbers, you check them, then Save; the
//              screenshot is kept), and a growth chart.
//   Analytics  totals overall and per platform, total views over time, a sortable posts table, the top 5 with
//              their recipes, averages per format / style / hook, and the score formula.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { utcToLocal } from "../../../../supabase/functions/_shared/contentMachine/localTime.js";
import { STAT_FIELDS } from "../../../../supabase/functions/_shared/contentMachine/statsReader.js";
import { api, money } from "./cmApi";
import { FreshImg, OpenFileButton } from "./freshFiles";

const TZ = "Europe/Helsinki";
const PLATFORMS = [["tiktok", "TikTok"], ["instagram", "Instagram"], ["youtube", "YouTube"]];
const PLATFORM_NAME = Object.fromEntries(PLATFORMS);
const input = "rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[14px] text-white outline-none focus:border-lime-300/60";
const button = "rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/15 disabled:opacity-40";
const primary = "rounded-lg bg-lime-300 px-3 py-1.5 text-[13px] font-semibold text-[#071006] disabled:opacity-40";
const nice = (k) => String(k ?? "").replace(/_/g, " ");
const nowLocal = () => utcToLocal(new Date().toISOString(), TZ);
const fmt = (n, d = 0) => (n == null ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d }));
const pct = (r) => (r == null ? "–" : `${(r * 100).toFixed(1)} %`);
const showLocal = (l) => (l ? l.replace("T", " ") : "–");
const Badge = ({ children, tone = "bg-white/10 text-white/70" }) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tone}`}>{children}</span>;

function Card({ title, children, right, testid }) {
  return (
    <section data-testid={testid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      {(title || right) && <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}

/* ─── Mark as posted (on a slideshow card) ───────────────────────────── */

export function MarkPosted({ idea, onDone }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ platform: "tiktok", postUrl: "", postedAt: "", account: idea.account ?? "creator" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  if (!["done", "approved", "posted"].includes(idea.status)) return null;
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try { await api("markPosted", { ideaId: idea.id, ...f }); setOpen(false); onDone(); } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  if (!open) return <button type="button" onClick={() => { setF({ ...f, postedAt: nowLocal() }); setOpen(true); }} data-testid="cm-mark-posted" className={primary}>Mark as posted</button>;
  return (
    <form onSubmit={save} className="flex w-full flex-col gap-2 rounded-xl border border-lime-300/30 bg-lime-300/[0.05] p-3 sm:flex-row sm:flex-wrap sm:items-end" data-testid="cm-post-form">
      <label className="text-[12px] text-white/60">Account<select value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} className={`${input} mt-1 block w-full`} data-testid="cm-post-account"><option value="zyvo">Zyvo</option><option value="creator">Creator</option></select></label>
      <label className="text-[12px] text-white/60">Platform<select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className={`${input} mt-1 block w-full`}>{PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="min-w-0 flex-1 text-[12px] text-white/60">Post URL<input required value={f.postUrl} onChange={(e) => setF({ ...f, postUrl: e.target.value })} placeholder="https://www.tiktok.com/@…/photo/…" className={`${input} mt-1 block w-full`} /></label>
      <label className="text-[12px] text-white/60">Posted at (Helsinki)<input type="datetime-local" required value={f.postedAt} onChange={(e) => setF({ ...f, postedAt: e.target.value })} className={`${input} mt-1 block w-full`} /></label>
      <div className="flex items-center gap-2"><button type="submit" disabled={busy} className={primary}>{busy ? "Saving…" : "Save"}</button><button type="button" onClick={() => setOpen(false)} className="text-[13px] text-white/60 underline">Cancel</button></div>
      {note && <p className="w-full text-[12.5px] text-red-200">{note}</p>}
    </form>
  );
}

/* ─── a small line chart (SVG, no library) ───────────────────────────── */

export function LineChart({ points, xLabel = (x) => x, yLabel = (y) => fmt(y), height = 150, testid }) {
  if (!points.length) return <p className="text-[12.5px] text-white/45">No data yet.</p>;
  const W = 600, H = height, P = { l: 52, r: 12, t: 10, b: 24 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || 1, y1 = Math.max(1, ...ys);
  const X = (x) => P.l + ((x - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const Y = (y) => H - P.b - (y / y1) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[720px]" role="img" aria-label="chart" data-testid={testid}>
      <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} stroke="rgba(255,255,255,.15)" />
      <text x={P.l - 6} y={P.t + 8} textAnchor="end" fontSize="11" fill="rgba(255,255,255,.5)">{yLabel(y1)}</text>
      <text x={P.l - 6} y={H - P.b} textAnchor="end" fontSize="11" fill="rgba(255,255,255,.5)">0</text>
      <text x={P.l} y={H - 6} fontSize="11" fill="rgba(255,255,255,.5)">{xLabel(x0)}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="11" fill="rgba(255,255,255,.5)">{xLabel(x1)}</text>
      <path d={d} fill="none" stroke="#bef264" strokeWidth="2.5" />
      {points.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="3.5" fill="#bef264"><title>{`${xLabel(p.x)}: ${yLabel(p.y)}`}</title></circle>)}
    </svg>
  );
}

/* ─── a stats snapshot form: typed, or read off a pasted screenshot ──── */

/** A screenshot → base64 JPEG, at most 1600 px on its longer side (small enough to send and keep). */
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.88);
    return { contentType: "image/jpeg", dataBase64: dataUrl.split(",")[1], preview: dataUrl };
  } finally { URL.revokeObjectURL(url); }
}

function StatsForm({ post, existing, onSaved, onCancel }) {
  const [f, setF] = useState(() => ({ takenAt: existing?.taken_local ?? nowLocal(), ...Object.fromEntries(STAT_FIELDS.map(([k]) => [k, existing?.[k] ?? ""])) }));
  const [shot, setShot] = useState(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const box = useRef(null);
  useEffect(() => { box.current?.focus(); }, []);
  const readImage = async (file) => {
    if (!file) return;
    setNote(null); setReading(true);
    try {
      const img = await shrinkImage(file);
      setShot(img);
      const r = await api("readStatsScreenshot", { contentType: img.contentType, dataBase64: img.dataBase64 });
      const n = r.numbers ?? {};
      setF((old) => ({ ...old, ...Object.fromEntries(STAT_FIELDS.map(([k]) => [k, n[k] ?? ""])) }));
      setNote(`Read from the screenshot${r.costUsd != null ? ` (${money(r.costUsd, 4)})` : ""}${n.note ? `: ${n.note}` : ""}. Check the numbers, then Save.`);
    } catch (e) { setNote(e.message); }
    setReading(false);
  };
  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); readImage(item.getAsFile()); }
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try {
      const { takenAt, ...stats } = f;
      await api("saveStats", { postId: post.id, id: existing?.id, takenAt, stats, screenshot: shot ? { contentType: shot.contentType, dataBase64: shot.dataBase64 } : undefined });
      onSaved();
    } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={save} onPaste={onPaste} ref={box} tabIndex={-1} className="space-y-3 rounded-xl border border-white/15 bg-black/25 p-3 outline-none focus:border-lime-300/50" data-testid="cm-stats-form">
      <div className="rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-[12.5px] text-white/65">
        {reading ? "Reading the screenshot…" : <>Paste a screenshot of the post's analytics here (<b>Ctrl+V</b>), or <label className="cursor-pointer underline">choose one<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => readImage(e.target.files?.[0])} /></label>. The numbers are read for you; nothing is saved until you press Save.</>}
        {shot && <img src={shot.preview} alt="Pasted screenshot" className="mt-2 max-h-48 rounded-lg border border-white/10" />}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="col-span-2 text-[12px] text-white/60">Taken at (Helsinki)<input type="datetime-local" required value={f.takenAt} onChange={(e) => setF({ ...f, takenAt: e.target.value })} className={`${input} mt-1 block w-full`} /></label>
        {STAT_FIELDS.map(([k, label]) => (
          <label key={k} className="text-[12px] text-white/60">{label}<input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={`${input} mt-1 block w-full`} aria-label={label} /></label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || reading} className={primary}>{busy ? "Saving…" : existing ? "Save changes" : "Save snapshot"}</button>
        <button type="button" onClick={onCancel} className="text-[13px] text-white/60 underline">Cancel</button>
        {note && <span className="text-[12.5px] text-white/70">{note}</span>}
      </div>
    </form>
  );
}

/* ─── the account switch (Posted, Analytics) ─────────────────────────── */

const ACCOUNT_VIEWS = [["both", "Both"], ["zyvo", "Zyvo"], ["creator", "Creator"]];
function useAccountView(key) {
  const [v, setV] = useState(() => { try { return localStorage.getItem(key) || "both"; } catch { return "both"; } });
  const pick = (x) => { setV(x); try { localStorage.setItem(key, x); } catch { /* private window */ } };
  const control = (
    <div className="inline-flex gap-1 rounded-xl border border-white/10 bg-black/25 p-1" role="tablist" aria-label="Account" data-testid="cm-account-switch">
      {ACCOUNT_VIEWS.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={v === k} onClick={() => pick(k)}
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${v === k ? (k === "zyvo" ? "bg-violet-300/20 text-violet-100" : k === "creator" ? "bg-sky-300/15 text-sky-100" : "bg-white/15 text-white") : "text-white/55"}`}>{l}</button>
      ))}
    </div>
  );
  return [v, control];
}
const accountBadge = (a) => <Badge tone={a === "zyvo" ? "bg-violet-300/20 text-violet-100" : "bg-sky-300/15 text-sky-100"}>{a === "zyvo" ? "Zyvo" : "Creator"}</Badge>;

/* ─── Posted ─────────────────────────────────────────────────────────── */

function PostCard({ post, onChanged }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);       // null | "new" | a snapshot
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState(null);
  const m = post.metrics;
  const run = async (fn) => { setNote(null); try { await fn(); onChanged(); } catch (e) { setNote(e.message); } };
  const chart = [{ x: 0, y: 0 }, ...post.stats.filter((s) => s.views != null).map((s) => ({ x: Number(s.hours_since_post), y: s.views }))];
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04]" data-testid="cm-post">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full gap-3 p-3 text-left sm:p-4">
        <div className="h-[96px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-black">{post.thumbnail && <FreshImg src={post.thumbnail} path={post.thumbnail_path} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {accountBadge(post.account)}
            <Badge tone="bg-white/10 text-white/80">{PLATFORM_NAME[post.platform]}</Badge>
            {m.needs.map((k) => <Badge key={k} tone="bg-amber-300/20 text-amber-100">needs {k === "24h" ? "24 h" : "7 d"} stats</Badge>)}
            {post.idea?.recipe && <><Badge>{nice(post.idea.recipe.format)}</Badge><Badge>{nice(post.idea.recipe.style)}</Badge></>}
          </div>
          <div className="text-[15px] font-semibold leading-snug text-white">{post.idea?.title ?? "(slideshow)"}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-white/60">
            <span>Posted {showLocal(post.posted_local)} (Helsinki)</span>
            <span className="font-semibold text-white/85">{m.views == null ? "no stats yet" : `${fmt(m.views)} views`}</span>
            {m.engagementRate != null && <span>engagement {pct(m.engagementRate)}</span>}
            <span>{post.stats.length} snapshot{post.stats.length === 1 ? "" : "s"}</span>
            <span className="ml-auto text-white/40">{open ? "Hide ▲" : "Open ▼"}</span>
          </div>
        </div>
      </button>
      {open && (
        <div className="space-y-4 border-t border-white/10 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <a href={post.post_url} target="_blank" rel="noreferrer" className="truncate text-sky-200 underline">{post.post_url}</a>
            <button type="button" onClick={() => setEdit({ platform: post.platform, postUrl: post.post_url, postedAt: post.posted_local })} className={button}>Edit post</button>
            <button type="button" onClick={() => { if (window.confirm("Undo this post? Its stats snapshots are deleted; the slideshow goes back to Today if it has no other post.")) run(() => api("deletePost", { id: post.id })); }} className="text-white/60 underline">Undo post</button>
          </div>
          {edit && (
            <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api("savePost", { id: post.id, ...edit }); setEdit(null); }); }} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <select value={edit.platform} onChange={(e) => setEdit({ ...edit, platform: e.target.value })} className={input}>{PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input value={edit.postUrl} onChange={(e) => setEdit({ ...edit, postUrl: e.target.value })} className={`${input} flex-1`} aria-label="Post URL" />
              <input type="datetime-local" value={edit.postedAt} onChange={(e) => setEdit({ ...edit, postedAt: e.target.value })} className={input} aria-label="Posted at (Helsinki)" />
              <button type="submit" className={primary}>Save</button><button type="button" onClick={() => setEdit(null)} className="text-[13px] text-white/60 underline">Cancel</button>
            </form>
          )}
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Views since posting (hours)</div>
            <LineChart points={chart} xLabel={(h) => `${Math.round(h)} h`} testid="cm-growth" />
            <div className="mt-1 flex flex-wrap gap-x-4 text-[12px] text-white/55">
              <span>at 24 h: {fmt(m.views24)}</span><span>at 7 d: {fmt(m.views7d)}</span><span>views / hour: {fmt(m.viewsPerHour, 1)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="text-white/45"><tr><th className="py-1 pr-3 font-semibold">Taken (Helsinki)</th><th className="pr-3 font-semibold">Hours</th>{STAT_FIELDS.map(([k, l]) => <th key={k} className="pr-3 font-semibold">{l.replace(/ \(.*\)/, "")}</th>)}<th /></tr></thead>
              <tbody className="divide-y divide-white/[0.06] text-white/85">
                {post.stats.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-3">{showLocal(s.taken_local)}</td><td className="pr-3">{fmt(s.hours_since_post, 1)}</td>
                    {STAT_FIELDS.map(([k]) => <td key={k} className="pr-3 tabular-nums">{fmt(s[k], 2)}</td>)}
                    <td className="whitespace-nowrap">
                      {s.screenshot_path && <OpenFileButton path={s.screenshot_path} className="mr-2 underline">screenshot</OpenFileButton>}
                      <button type="button" onClick={() => setForm(s)} className="mr-2 underline">Edit</button>
                      <button type="button" onClick={() => { if (window.confirm("Delete this snapshot?")) run(() => api("deleteStats", { id: s.id })); }} className="text-red-200 underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {form ? <StatsForm key={form === "new" ? "new" : form.id} post={post} existing={form === "new" ? null : form} onSaved={() => { setForm(null); onChanged(); }} onCancel={() => setForm(null)} />
            : <button type="button" onClick={() => setForm("new")} data-testid="cm-add-stats" className={primary}>Add stats</button>}
          {note && <p className="text-[12.5px] text-red-200">{note}</p>}
        </div>
      )}
    </article>
  );
}

export function PostedTab() {
  const [data, setData] = useState(null);
  const [note, setNote] = useState(null);
  const [filter, setFilter] = useState("");
  const [account, accountControl] = useAccountView("cm.postedAccount");
  const load = useCallback(async () => { try { setData(await api("posts")); } catch (e) { setNote(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <p className="text-[13px] text-white/50">{note ?? "Loading…"}</p>;
  const mine = data.posts.filter((p) => account === "both" || p.account === account);
  const due = mine.filter((p) => p.metrics.needs.length);
  const shown = mine.filter((p) => !filter || (filter === "needs" ? p.metrics.needs.length : p.platform === filter));
  const pill = (on) => `rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${on ? "border-lime-300/60 bg-lime-300/15 text-lime-100" : "border-white/10 bg-white/[0.03] text-white/70"}`;
  return (
    <div className="space-y-4" data-testid="cm-posted">
      <Card title="Posted" right={accountControl}>
        <p className="text-[12.5px] text-white/55">Every slideshow you marked as posted. Add stats after 24 hours and again after 7 days: each update is its own snapshot, so the growth shows. All times are Helsinki time.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter("")} className={pill(!filter)}>All {mine.length}</button>
          <button type="button" onClick={() => setFilter("needs")} className={pill(filter === "needs")}>Needs stats {due.length}</button>
          {PLATFORMS.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={pill(filter === k)}>{l} {mine.filter((p) => p.platform === k).length}</button>)}
        </div>
      </Card>
      {shown.length === 0 && <p className="text-[13.5px] text-white/60">{data.posts.length ? "Nothing here." : "Nothing posted yet. Use \"Mark as posted\" on a slideshow in the Queue."}</p>}
      <div className="space-y-3">{shown.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)}</div>
    </div>
  );
}

/* ─── Analytics ──────────────────────────────────────────────────────── */

const COLUMNS = [
  ["posted_at", "Posted"], ["views", "Views"], ["engagementRate", "Engagement"], ["score", "Score"], ["viewsPerHour", "Views / h"], ["views24", "At 24 h"], ["views7d", "At 7 d"],
];

export function AnalyticsTab({ extra = null }) {
  const [account, accountControl] = useAccountView("cm.analyticsAccount");
  const [f, setF] = useState({ platform: "", format: "", style: "", hook: "", from: "", to: "" });
  const [sort, setSort] = useState(["score", "desc"]);
  const [data, setData] = useState(null);
  const [lib, setLib] = useState(null);
  const [note, setNote] = useState(null);
  const load = useCallback(async () => {
    try { setData(await api("analytics", { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), account })); } catch (e) { setNote(e.message); }
  }, [f, account]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("library").then((r) => setLib(r.rows)).catch(() => {}); }, []);
  const opts = (kind) => (lib ?? []).filter((r) => r.kind === kind);
  const table = useMemo(() => {
    if (!data) return [];
    const [k, dir] = sort;
    const v = (r) => (k === "posted_at" ? Date.parse(r.posted_at) : r.m[k]);
    return [...data.table].sort((a, b) => { const x = v(a), y = v(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (dir === "asc" ? 1 : -1) * (x - y); });
  }, [data, sort]);
  const cell = (k, r) => (k === "posted_at" ? showLocal(utcToLocal(r.posted_at, TZ)) : k === "engagementRate" ? pct(r.m[k]) : fmt(r.m[k], k === "viewsPerHour" ? 1 : 0));
  return (
    <div className="space-y-4" data-testid="cm-analytics">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[12.5px] text-white/55">Each account learns from its own posts: its own medians, winners and playbook. Both = a combined view.</span>{accountControl}</div>
      <LearningCard key={account} account={account} />
      <Card title="Filter">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className={input} aria-label="Platform"><option value="">all platforms</option>{PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })} className={input} aria-label="Format"><option value="">all formats</option>{opts("format").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
          <select value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} className={input} aria-label="Style"><option value="">all styles</option>{opts("style").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
          <select value={f.hook} onChange={(e) => setF({ ...f, hook: e.target.value })} className={input} aria-label="Hook"><option value="">all hooks</option>{opts("hook").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
          <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input} aria-label="Posted from" />
          <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input} aria-label="Posted to" />
        </div>
      </Card>
      {!data ? <p className="text-[13px] text-white/50">{note ?? "Loading…"}</p> : (
        <>
          <Card title={`Totals · ${data.filtered} of ${data.total} posts`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Views", data.totals.views], ["Likes", data.totals.likes], ["Saves", data.totals.saves], ["New followers", data.totals.newFollowers]].map(([l, v]) => (
                <div key={l}><div className="text-[12px] text-white/50">{l}</div><div className="text-[20px] font-bold tabular-nums">{fmt(v)}</div></div>
              ))}
            </div>
            {Object.keys(data.byPlatform).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-white/65">
                {Object.entries(data.byPlatform).map(([k, t]) => <span key={k}><b className="text-white/85">{PLATFORM_NAME[k]}</b>: {t.posts} posts · {fmt(t.views)} views · {fmt(t.saves)} saves</span>)}
              </div>
            )}
          </Card>
          <Card title="Total views over time">
            <LineChart points={data.series.map((s, i) => ({ x: i, y: s.views, day: s.day }))} xLabel={(i) => data.series[Math.round(i)]?.day ?? ""} testid="cm-views-chart" />
          </Card>
          <Card title="Posts" right={<span className="text-[12px] text-white/45">click a column to sort</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[12.5px]" data-testid="cm-posts-table">
                <thead className="text-white/45"><tr>
                  <th className="py-1 pr-3 font-semibold">Slideshow</th>
                  {COLUMNS.map(([k, l]) => <th key={k} className="pr-3 font-semibold"><button type="button" onClick={() => setSort([k, sort[0] === k && sort[1] === "desc" ? "asc" : "desc"])} className="hover:text-white">{l}{sort[0] === k ? (sort[1] === "desc" ? " ▼" : " ▲") : ""}</button></th>)}
                </tr></thead>
                <tbody className="divide-y divide-white/[0.06] text-white/85">
                  {table.map((r) => (
                    <tr key={r.id}>
                      <td className="max-w-[260px] py-1.5 pr-3"><a href={r.post_url} target="_blank" rel="noreferrer" className="line-clamp-2 hover:underline">{r.title}</a><span className="text-white/45">{PLATFORM_NAME[r.platform]} · {nice(r.recipe.format)} · {nice(r.recipe.style)}</span></td>
                      {COLUMNS.map(([k]) => <td key={k} className="pr-3 tabular-nums">{cell(k, r)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11.5px] text-white/45">{data.formula}</p>
          </Card>
          <Card title="Top 5">
            {data.top5.length === 0 ? <p className="text-[12.5px] text-white/50">No post has 24 h stats yet.</p> : (
              <ol className="space-y-2 text-[13px]">
                {data.top5.map((r, i) => (
                  <li key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <div className="font-semibold text-white">{i + 1}. {r.title} <span className="font-normal text-white/50">· score {r.m.score} · {fmt(r.m.views24)} views at 24 h</span></div>
                    <div className="mt-0.5 text-[12px] text-white/55">Recipe: {["format", "style", "hook_type", "zyvo_position", "cta_type", "text_density", "platform", "post_time"].filter((k) => r.recipe[k]).map((k) => `${nice(k)} ${nice(r.recipe[k])}`).join(" · ")}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            {[["format", "By format"], ["style", "By style"], ["hook", "By hook"]].map(([k, title]) => (
              <Card key={k} title={title}>
                <table className="w-full text-left text-[12.5px]"><thead className="text-white/45"><tr><th className="py-1 font-semibold" /><th className="font-semibold">Posts</th><th className="font-semibold">At 24 h</th><th className="font-semibold">Score</th></tr></thead>
                  <tbody className="divide-y divide-white/[0.06] text-white/85">{data.averages[k].map((g) => <tr key={g.key}><td className="py-1 pr-2">{nice(g.key)}</td><td>{g.posts}</td><td className="tabular-nums">{fmt(g.views24)}</td><td className="tabular-nums">{fmt(g.score)}</td></tr>)}</tbody>
                </table>
              </Card>
            ))}
          </div>
        </>
      )}
      {extra}
    </div>
  );
}

/* ─── Phase 3: the learning loop (top of Analytics) ──────────────────── */

export function LearningCard({ account = "creator" }) {
  const [d, setD] = useState(null);
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [lib, setLib] = useState(null);
  const load = useCallback(async () => { try { const r = await api("learning", { account }); setD(r); setText((t) => (t == null ? r.playbook : t)); } catch (e) { setNote(e.message); } }, [account]);
  useEffect(() => { load(); api("library").then((r) => setLib(r.rows)).catch(() => {}); }, [load]);
  const latest = d?.analyses?.[0];
  const running = Boolean(latest && ["queued", "running"].includes(latest.status));
  useEffect(() => { if (!running) return undefined; const t = setInterval(load, 5000); return () => clearInterval(t); }, [running, load]);
  const act = async (label, fn) => { setBusy(label); setNote(null); try { await fn(); await load(); } catch (e) { setNote(e.message); } setBusy(null); };
  if (!d) return <Card title="Learning">{note ?? "Loading…"}</Card>;
  const shown = d.analyses.find((a) => a.status === "done") ?? null;
  const r = shown?.report;
  const libRow = (kind, key) => lib?.find((x) => x.kind === kind && x.key === key);
  return (
    <Card title={`Learning · ${{ zyvo: "Zyvo account", creator: "Creator account", both: "both accounts" }[account]}`} testid="cm-learning" right={
      <button type="button" disabled={!!busy || running} data-testid="cm-analyze" onClick={() => { if (window.confirm("Let the agent analyze every post's stats and propose a playbook? One paid call to the main model, about $0.05–0.15, within the caps.")) act("analyze", () => api("analyze", { account })); }} className={primary}>
        {running ? "Analyzing…" : "Let the agent analyze"}
      </button>}>
      <div className="space-y-4 text-[13px] text-white/80">
        {d.suggest && <div role="status" className="rounded-xl border border-lime-300/40 bg-lime-300/10 px-3 py-2 text-lime-100">{d.sinceLast} posts have new stats since the last analysis: a good moment to let the agent analyze.</div>}
        {latest?.status === "failed" && <p className="text-red-200">The last analysis failed: {latest.error}</p>}
        <p className="text-[12px] text-white/50">{d.rules} {d.settings.winners_per_day} winners + {d.settings.experiments_per_day} experiments a day once the {d.settings.experiment_days}-day experiment phase is over{d.settings.experiment_started_on ? ` (started ${d.settings.experiment_started_on})` : " (not started yet)"}; change it in Settings.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Winners ({d.learned.scored} scored posts)</div>
            {d.learned.winners.length === 0 ? <p className="text-white/50">None yet: a recipe needs {d.settings.winner_min_successes} posts above the median.</p>
              : <ul className="space-y-1">{d.learned.winners.map((w) => <li key={w.key}>{w.key.split("|").map(nice).join(" × ")} · {w.successes}/{w.posts} successes · score {w.score}</li>)}</ul>}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Below the median</div>
            {d.learned.retire.length === 0 ? <p className="text-white/50">Nothing to retire yet.</p>
              : <ul className="space-y-1">{d.learned.retire.map((x) => {
                const row = libRow(x.kind, x.key);
                return (
                  <li key={`${x.kind}:${x.key}`} className="flex flex-wrap items-center gap-2">{x.kind} {nice(x.key)} · {x.posts} posts · score {x.score}
                    {row?.status === "active" && <button type="button" disabled={!!busy} onClick={() => act("retire", () => api("saveLibrary", { ...row, status: "retired" }))} className="text-white/70 underline">Retire</button>}
                    {row?.status === "retired" && <span className="text-white/40">retired</span>}
                  </li>
                );
              })}</ul>}
          </div>
        </div>
        {d.features && (
          <div className="rounded-xl border border-violet-300/25 bg-violet-300/[0.04] p-3" data-testid="cm-features">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">What drives profile visits and link clicks (Zyvo account)</div>
            {d.features.features.length === 0 ? <p className="text-white/50">No posted Zyvo slideshows with stats yet.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[["features", "Features (the facts the slides cite)"], ["hooks", "Hooks"]].map(([k, title]) => (
                  <table key={k} className="w-full text-left text-[12.5px]"><thead className="text-white/45"><tr><th className="py-1 font-semibold">{title}</th><th className="font-semibold">Posts</th><th className="font-semibold">Visits / 1k views</th><th className="font-semibold">Link clicks</th><th className="font-semibold">Score</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.06]">{d.features[k].slice(0, 8).map((g) => <tr key={g.key}><td className="py-1 pr-2">{nice(g.key)}</td><td>{g.posts}</td><td className="tabular-nums">{fmt(g.visitsPer1k, 1)}</td><td className="tabular-nums">{fmt(g.linkClicks)}</td><td className="tabular-nums">{fmt(g.score)}</td></tr>)}</tbody>
                  </table>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11.5px] text-white/45">Link clicks are entered with the stats (the site doesn't record UTM visits per post yet).</p>
          </div>
        )}
        {r && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="cm-analysis">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">The agent's analysis · {showLocal(utcToLocal(shown.created_at, TZ))} · {shown.posts_count} posts · confidence {r.confidence} · {money(shown.cost_usd, 3)}</div>
            <p className="text-white/90">{r.summary}</p>
            {r.what_works?.length > 0 && <div><b className="text-lime-200">Works:</b> {r.what_works.join(" · ")}</div>}
            {r.what_doesnt?.length > 0 && <div><b className="text-red-200">Doesn&apos;t work:</b> {r.what_doesnt.join(" · ")}</div>}
            {r.experiments?.length > 0 && <div><b>Next experiments:</b> {r.experiments.map((e) => `${nice(e.format)} × ${nice(e.style)} × ${nice(e.hook_type)} (${e.why})`).join(" · ")}</div>}
            {r.retire?.length > 0 && <div><b>Retire:</b> {r.retire.map((e) => `${e.kind} ${nice(e.key)} (${e.why})`).join(" · ")}</div>}
            {r.trend_notes && <div><b>Trends:</b> {r.trend_notes}</div>}
            <details><summary className="cursor-pointer text-white/70">Proposed playbook</summary><pre className="mt-1 whitespace-pre-wrap font-sans text-[12.5px] text-white/80">{r.playbook}</pre></details>
            {account !== "both" && <button type="button" disabled={!!busy} onClick={() => { if (window.confirm("Replace this account's playbook with this proposal? You can still edit it after.")) act("apply", async () => { const x = await api("applyAnalysis", { id: shown.id }); setText(x.playbook); }); }} className={button}>{shown.applied_at ? "Applied ✓ (apply again)" : "Apply this playbook"}</button>}
          </div>
        )}
        {d.playbook != null && <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Playbook of this account (its writer follows it){d.playbookUpdatedAt ? ` · saved ${showLocal(utcToLocal(d.playbookUpdatedAt, TZ))}` : ""}</div>
          <textarea rows={8} value={text ?? ""} onChange={(e) => setText(e.target.value)} placeholder="Empty: the writer uses only the library and the brand rules. Let the agent analyze to get a first proposal." className={`${input} w-full font-mono text-[12.5px]`} aria-label="Playbook" data-testid="cm-playbook" />
          <button type="button" disabled={!!busy || text === d.playbook} onClick={() => act("save", () => api("savePlaybook", { account, text }))} className={`${primary} mt-2`}>Save playbook</button>
        </div>}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Scout</span>
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={d.settings.daily_scout} disabled={!!busy} onChange={(e) => act("scout-toggle", () => api("saveSettings", { patch: { daily_scout: e.target.checked } }))} className="h-4 w-4 accent-lime-300" />Daily scout at the run time (about $0.10 a day)</label>
            <button type="button" disabled={!!busy} onClick={() => { if (window.confirm("Scout today's trends now? One paid call with web search, about $0.10.")) act("scout", () => api("scoutNow")); }} className={button}>Scout now</button>
          </div>
          {d.scouts.length === 0 ? <p className="text-white/50">No scout report yet.</p> : (
            <div className="space-y-1">
              <div className="text-[12px] text-white/50">{showLocal(utcToLocal(d.scouts[0].created_at, TZ))}{d.scouts[0].cost_usd != null ? ` · ${money(d.scouts[0].cost_usd, 3)}` : ""}</div>
              <pre className="whitespace-pre-wrap font-sans text-[12.5px] text-white/80">{d.scouts[0].trend_brief}</pre>
              {(d.scouts[0].raw_sources ?? []).length > 0 && <details><summary className="cursor-pointer text-[12px] text-white/60">Sources ({d.scouts[0].raw_sources.length})</summary><ul className="mt-1 space-y-0.5 text-[12px]">{d.scouts[0].raw_sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title || s.url}</a></li>)}</ul></details>}
            </div>
          )}
        </div>
        {busy && <p className="text-white/50">Working…</p>}
        {note && <p className="text-red-200">{note}</p>}
      </div>
    </Card>
  );
}
