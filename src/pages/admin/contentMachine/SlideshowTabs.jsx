// Content Machine, Phase 2: the Today, Ideas and Library tabs. Slides are previewed with the SAME templates
// the renderer uses (_shared/contentMachine/slides/templates.js), so a dry run already shows what would be
// posted; once rendered, the real PNGs and the MP4 replace the live preview. Download and copy work on a
// phone: the owner often posts from it.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FONT_CSS, slideHtml } from "../../../../supabase/functions/_shared/contentMachine/slides/templates.js";
import { api, copyText, money, when } from "./cmApi";

const STATUS_TONE = {
  done: "bg-lime-300/15 text-lime-200", producing: "bg-sky-300/15 text-sky-200", proposed: "bg-white/10 text-white/70", approved: "bg-lime-300/25 text-lime-100",
  rejected: "bg-white/10 text-white/40", failed: "bg-red-400/15 text-red-200", skipped_budget: "bg-amber-300/15 text-amber-200",
  pending: "bg-white/10 text-white/70", ideating: "bg-sky-300/15 text-sky-200", budget_stopped: "bg-amber-300/15 text-amber-200",
};
const RUN_ACTIVE = new Set(["pending", "scouting", "ideating", "producing", "packaging"]);
const Badge = ({ children, tone = "bg-white/10 text-white/70", title }) => <span title={title} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tone}`}>{children}</span>;
const nice = (k) => String(k ?? "").replace(/_/g, " ");
const input = "rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[14px] text-white outline-none focus:border-lime-300/60";

function Card({ title, children, right, testid }) {
  return (
    <section data-testid={testid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      {(title || right) && <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}

function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1500); } }}
      className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/15">{done ? "Copied ✓" : label}</button>
  );
}

/* ─── one slide: the rendered PNG, or the live preview from the templates ─── */

function SlidePreview({ slide, index, total, style, images, zyvoShot, png, width = 216 }) {
  const scale = width / 1080;
  const html = useMemo(() => (png || !style ? null : slideHtml({ slide, index, total, style, images, zyvoShot, fontCss: FONT_CSS.google })), [png, slide, index, total, style, images, zyvoShot]);
  return (
    <div className="shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black" style={{ width, height: width * (16 / 9) }}>
      {png ? <img src={png} alt={`Slide ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
        : <iframe title={`Slide ${index + 1}`} srcDoc={html} sandbox="allow-scripts" className="pointer-events-none origin-top-left border-0" style={{ width: 1080, height: 1920, transform: `scale(${scale})` }} />}
    </div>
  );
}

function PackageTabs({ packages, onSaved }) {
  const [tab, setTab] = useState(packages[0]?.platform ?? "tiktok");
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState(null);
  const p = packages.find((x) => x.platform === tab);
  if (!p) return null;
  const tags = (p.hashtags ?? []).join(" ");
  const full = [p.title, p.caption, tags].filter(Boolean).join("\n\n");
  const save = async () => {
    setNote(null);
    try { await api("savePackage", { id: p.id, caption: edit.caption, title: p.platform === "youtube" ? edit.title : undefined, hashtags: edit.hashtags }); setEdit(null); onSaved(); }
    catch (e) { setNote(e.message); }
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <div className="flex border-b border-white/10">
        {packages.map((x) => (
          <button key={x.platform} type="button" onClick={() => { setTab(x.platform); setEdit(null); }}
            className={`flex-1 px-3 py-2 text-[13px] font-semibold ${tab === x.platform ? "border-b-2 border-lime-300 text-white" : "text-white/50"}`}>
            {{ tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" }[x.platform]}
          </button>
        ))}
      </div>
      <div className="space-y-3 p-3 text-[13.5px] text-white/85">
        {edit ? (
          <div className="space-y-2">
            {p.platform === "youtube" && <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={`${input} w-full`} aria-label="Title" />}
            <textarea rows={4} value={edit.caption} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} className={`${input} w-full`} aria-label="Caption" />
            <input value={edit.hashtags} onChange={(e) => setEdit({ ...edit, hashtags: e.target.value })} className={`${input} w-full`} aria-label="Hashtags" />
            <div className="flex gap-2"><button type="button" onClick={save} className="rounded-lg bg-lime-300 px-3 py-1.5 text-[13px] font-semibold text-[#071006]">Save</button><button type="button" onClick={() => setEdit(null)} className="text-[13px] text-white/60 underline">Cancel</button>{note && <span className="text-[12.5px] text-red-200">{note}</span>}</div>
          </div>
        ) : (
          <>
            {p.title && <Row label="Title" text={p.title} />}
            <Row label={p.platform === "youtube" ? "Description" : "Caption"} text={p.caption} />
            <Row label="Hashtags" text={tags} />
            {p.compliance?.link && <Row label="Tracked link" text={p.compliance.link} small />}
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={full} label="Copy all" />
              <button type="button" onClick={() => setEdit({ caption: p.caption ?? "", title: p.title ?? "", hashtags: tags })} className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white/70 underline">Edit</button>
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/55">
          {p.suggested_post_time && <span>Post at {p.suggested_post_time} (Helsinki)</span>}
          {p.sound_suggestion && <span>Sound: {p.sound_suggestion}</span>}
          {p.ai_label_required && <span className="font-semibold text-amber-200">Turn on the AI-generated label</span>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, text, small }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1"><div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</div><div className={`whitespace-pre-wrap break-words ${small ? "text-[12px] text-white/60" : ""}`}>{text}</div></div>
      <CopyButton text={text ?? ""} />
    </div>
  );
}

export function IdeaCard({ idea, styles, zyvoShot, onChanged, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const r = idea.recipe ?? {};
  const g = idea.generation;
  const style = styles?.[r.style];
  const images = (i) => ({ background: g?.images?.background ?? null, illustration: g?.images?.illustrations?.[i] ?? null });
  const act = async (action, body, label) => {
    setBusy(label); setNote(null);
    try { await api(action, body); onChanged(); } catch (e) { setNote(e.message); }
    setBusy(null);
  };
  const flagged = idea.compliance?.flagged;
  return (
    <article data-testid="cm-idea" className={`rounded-2xl border ${flagged ? "border-amber-300/40" : "border-white/10"} bg-white/[0.04]`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full flex-col gap-2 p-4 text-left sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[idea.status]}>{nice(idea.status)}</Badge>
          {idea.dry_run && <Badge tone="bg-sky-300/15 text-sky-200" title="Mocked: nothing was spent">dry run</Badge>}
          <Badge>{nice(r.format)}</Badge><Badge>{nice(r.style)}</Badge><Badge>hook: {nice(r.hook_type)}</Badge>
          <Badge>Zyvo: {nice(r.zyvo_position)}</Badge><Badge>{r.platform} {r.post_time}</Badge>
          {r.mode === "winner" && <Badge tone="bg-lime-300/20 text-lime-100">winner</Badge>}
          {flagged && <Badge tone="bg-amber-300/20 text-amber-100">check flagged</Badge>}
        </div>
        <div className="text-[17px] font-semibold leading-snug text-white">{idea.title}</div>
        {idea.hypothesis && <div className="text-[13px] text-white/60">Testing: {idea.hypothesis}</div>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/50">
          <span>{idea.dry_run ? `would cost ${money(idea.cost.wouldUsd, 3)}` : `cost ${money(idea.cost.usd, 3)}`}</span>
          {idea.virality_score && <span>virality {idea.virality_score}/10</span>}
          {idea.topic && <span>topic: {idea.topic}</span>}
          <span>{when(idea.created_at)}</span>
          <span className="ml-auto text-white/40">{open ? "Hide ▲" : "Open ▼"}</span>
        </div>
      </button>
      {open && (
        <div className="space-y-4 border-t border-white/10 p-4 sm:p-5">
          {idea.error && <p className="text-[13px] text-red-200">{idea.error}</p>}
          {flagged && <p className="text-[13px] text-amber-200">The compliance check still found: {idea.compliance.problems.join(" · ")}. Fix it or reject it before posting.</p>}
          {idea.slides.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" data-testid="cm-slides">
              {idea.slides.map((s, i) => <SlidePreview key={i} slide={s} index={i} total={idea.slides.length} style={style} images={images(i)} zyvoShot={zyvoShot} png={g?.pngs?.[i]} />)}
            </div>
          )}
          {g?.dryRun && <p className="text-[12.5px] text-white/50">Dry run: these previews are drawn live in your browser; nothing was rendered or spent.</p>}
          {g && !g.dryRun && g.status !== "done" && <p className="text-[12.5px] text-white/50">Rendering… ({g.status}){g.error ? `: ${g.error}` : ""}</p>}
          {(g?.mp4 || g?.zip) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {g.mp4 && <video src={g.mp4} controls playsInline preload="metadata" className="w-full max-w-[260px] rounded-xl border border-white/10 bg-black" />}
              <div className="flex flex-wrap gap-2">
                {g.zip && <a href={g.zip} download className="rounded-lg bg-lime-300 px-3 py-2 text-[13px] font-semibold text-[#071006]">Download slides (ZIP)</a>}
                {g.mp4 && <a href={g.mp4} download className="rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white">Download MP4</a>}
              </div>
            </div>
          )}
          {idea.packages.length > 0 && <PackageTabs packages={idea.packages} onSaved={onChanged} />}
          {idea.tools_checked.length > 0 && (
            <details className="text-[12.5px] text-white/60"><summary className="cursor-pointer">Tools checked with web search ({idea.tools_checked.length})</summary>
              <ul className="mt-1 space-y-0.5">{idea.tools_checked.map((t) => <li key={t.name}>{t.name} · <a className="underline" href={t.source_url} target="_blank" rel="noreferrer">{t.source_url}</a></li>)}</ul>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {idea.status !== "approved" && idea.status === "done" && <button type="button" disabled={!!busy} onClick={() => act("setIdeaStatus", { id: idea.id, status: "approved" }, "approve")} className="rounded-lg bg-lime-300/90 px-3 py-1.5 text-[13px] font-semibold text-[#071006] disabled:opacity-40">Approve</button>}
            {idea.status !== "rejected" && <button type="button" disabled={!!busy} onClick={() => act("setIdeaStatus", { id: idea.id, status: "rejected" }, "reject")} className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">Reject</button>}
            {idea.recipe?.format && <button type="button" disabled={!!busy} onClick={() => { if (window.confirm("Write this recipe again as a new slideshow? It costs a new write.")) act("remakeIdea", { id: idea.id }, "remake"); }} className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">Remake</button>}
            {busy && <span className="text-[12.5px] text-white/50">Working…</span>}
            {note && <span className="text-[12.5px] text-red-200">{note}</span>}
          </div>
        </div>
      )}
    </article>
  );
}

/* ─── Today ──────────────────────────────────────────────────────────── */

export function TodayTab({ st, onChanged }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(String(st.settings.slideshows_per_day ?? 5));
  const [runs, setRuns] = useState(null);
  const [runId, setRunId] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const load = useCallback(async (pick = null) => {
    try {
      const r = await api("runs");
      setRuns(r.runs);
      const target = pick ?? runId ?? r.runs[0]?.id ?? null;
      setRunId(target);
      if (target) setData(await api("ideas", { runId: target }));
      else setData({ ideas: [], styles: {}, zyvoShot: null });
    } catch (e) { setNote(e.message); }
  }, [runId]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = runs?.find((r) => r.id === runId);
  useEffect(() => {
    if (!run || !RUN_ACTIVE.has(run.status)) return undefined;
    const t = setInterval(() => load(run.id), 8000);
    return () => clearInterval(t);
  }, [run, load]);

  const make = async (e) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try {
      const r = await api("makeSlideshows", { topic: topic.trim() || null, count: Number(count) });
      setTopic("");
      setNote(`Started ${r.count} slideshow${r.count > 1 ? "s" : ""}${r.dryRun ? " as a dry run (nothing is spent)" : ""}. They appear below as they're made.`);
      await load(r.runId); onChanged();
    } catch (err) { setNote(err.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="Make slideshows" testid="cm-make">
        <form onSubmit={make} className="space-y-3">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder='Topic (optional), e.g. "AI tools that replace a video editor"' className={`${input} w-full`} aria-label="Topic" data-testid="cm-topic" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[13px] text-white/70">How many
              <select value={count} onChange={(e) => setCount(e.target.value)} className={input} aria-label="How many">{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
            </label>
            <button type="submit" disabled={busy || st.settings.kill_switch} data-testid="cm-make-button" className="rounded-lg bg-lime-300 px-4 py-2 text-[14px] font-semibold text-[#071006] transition enabled:hover:bg-lime-200 disabled:opacity-40">{busy ? "Starting…" : "Make slideshows"}</button>
            <span className="text-[12px] text-white/45">{st.dryRun.effective ? "Dry run: mocked, $0." : "Live: each costs about $0.10–0.20, within the caps."} Empty topic: Claude picks.</span>
          </div>
          {note && <p role="status" className="text-[13px] text-white/70">{note}</p>}
        </form>
      </Card>

      {runs && runs.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {runs.slice(0, 12).map((r) => (
            <button key={r.id} type="button" onClick={() => load(r.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-[12px] ${r.id === runId ? "border-lime-300/60 bg-lime-300/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="font-semibold text-white">{r.kind === "daily" ? "Daily run" : r.kind === "manual" ? "Remake" : "Slideshows"} · {r.run_date}</div>
              <div className="text-white/55">{nice(r.status)}{r.dry_run ? " · dry run" : ""} · {money(r.spend_usd, 3)}</div>
            </button>
          ))}
        </div>
      )}

      {run && RUN_ACTIVE.has(run.status) && <p className="text-[13px] text-sky-200">This run is working ({nice(run.status)})… the page refreshes by itself.</p>}
      {data?.ideas?.length === 0 && <p className="text-[13.5px] text-white/60">{runs?.length ? "No slideshows in this run yet." : "Nothing made yet. Press Make slideshows."}</p>}
      <div className="space-y-3">{data?.ideas?.map((i, n) => <IdeaCard key={i.id} idea={i} styles={data.styles} zyvoShot={data.zyvoShot} onChanged={() => load(runId)} startOpen={n === 0} />)}</div>
    </div>
  );
}

/* ─── Ideas: all history with filters ────────────────────────────────── */

export function IdeasTab() {
  const [f, setF] = useState({ from: "", to: "", format: "", style: "", status: "" });
  const [data, setData] = useState(null);
  const [lib, setLib] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await api("ideas", { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), limit: 60 })); } catch (e) { setError(e.message); }
  }, [f]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("library").then((r) => setLib(r.rows)).catch(() => {}); }, []);
  const opts = (kind) => (lib ?? []).filter((r) => r.kind === kind);
  return (
    <div className="space-y-4">
      <Card title="Filter">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input} aria-label="From" />
          <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input} aria-label="To" />
          <select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })} className={input} aria-label="Format"><option value="">all formats</option>{opts("format").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
          <select value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} className={input} aria-label="Style"><option value="">all styles</option>{opts("style").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input} aria-label="Status"><option value="">any status</option>{["done", "approved", "rejected", "producing", "failed", "skipped_budget"].map((s) => <option key={s} value={s}>{nice(s)}</option>)}</select>
        </div>
      </Card>
      {error && <p className="text-[13px] text-red-200">{error}</p>}
      {!data ? <p className="text-[13px] text-white/50">Loading…</p> : data.ideas.length === 0 ? <p className="text-[13.5px] text-white/60">No ideas match.</p>
        : <div className="space-y-3">{data.ideas.map((i) => <IdeaCard key={i.id} idea={i} styles={data.styles} zyvoShot={data.zyvoShot} onChanged={load} />)}</div>}
    </div>
  );
}

/* ─── Library: formats, styles and hooks ─────────────────────────────── */

const EMPTY = { kind: "format", key: "", name: "", description: "", spec: '{"slides": [5, 7]}' };

export function LibraryTab() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [note, setNote] = useState(null);
  const load = useCallback(async () => { try { setData(await api("library")); } catch (e) { setNote(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (row) => {
    setNote(null);
    try { await api("saveLibrary", row); await load(); return true; } catch (e) { setNote(e.message); return false; }
  };
  const add = async (e) => {
    e.preventDefault();
    let spec;
    try { spec = JSON.parse(form.spec || "{}"); } catch { setNote("The spec must be JSON."); return; }
    if (await save({ ...form, spec, status: "active" })) { setForm(EMPTY); setNote("Added."); }
  };
  if (!data) return <p className="text-[13px] text-white/50">{note ?? "Loading…"}</p>;
  const c = data.coverage;
  return (
    <div className="space-y-4">
      <Card title="Experiment coverage">
        <p className="text-[14px] text-white/80">{c.tried} of {c.total} format × style pairs tried in real posts ({Math.round(c.share * 100)} %). The planner tries the untried ones first.</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-lime-300" style={{ width: `${Math.max(c.share * 100, c.tried ? 2 : 0)}%` }} /></div>
      </Card>
      {["format", "style", "hook"].map((kind) => (
        <Card key={kind} title={{ format: "Formats", style: "Visual styles", hook: "Hook types" }[kind]}>
          <ul className="divide-y divide-white/[0.06]">
            {data.rows.filter((r) => r.kind === kind).map((r) => (
              <li key={r.key} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-white">{r.name} <span className="text-[11.5px] font-normal text-white/40">{r.key}{r.source !== "seed" ? ` · ${r.source}` : ""}</span></div>
                  <div className="text-[12.5px] text-white/55">{r.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === "active" ? "bg-lime-300/15 text-lime-200" : r.status === "proposed" ? "bg-sky-300/15 text-sky-200" : "bg-white/10 text-white/40"}>{r.status}</Badge>
                  {r.status !== "active" && <button type="button" onClick={() => save({ ...r, status: "active" })} className="rounded-lg bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white">{r.status === "proposed" ? "Accept" : "Use again"}</button>}
                  {r.status === "active" && <button type="button" onClick={() => save({ ...r, status: "retired" })} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-white/60 underline">Retire</button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Card title="Add to the library">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-2">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, spec: e.target.value === "style" ? '{"bg_prompt": "…, no text", "bg": "#0b0b0f", "fg": "#ffffff", "accent": "#a855f7", "highlight": "#facc15", "font": "anton"}' : e.target.value === "format" ? '{"slides": [5, 7]}' : "{}" })} className={input} aria-label="Kind"><option value="format">Format</option><option value="style">Visual style</option><option value="hook">Hook type</option></select>
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="key, e.g. duet_reaction" className={input} aria-label="Key" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className={input} aria-label="Name" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What it is, in one line" className={input} aria-label="Description" />
          <textarea rows={3} value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} className={`${input} font-mono text-[12px] sm:col-span-2`} aria-label="Spec (JSON)" />
          <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className="rounded-lg bg-lime-300 px-4 py-2 text-[14px] font-semibold text-[#071006]">Add</button>{note && <span role="status" className="text-[13px] text-white/70">{note}</span>}</div>
        </form>
      </Card>
    </div>
  );
}
