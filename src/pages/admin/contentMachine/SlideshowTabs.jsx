// Content Machine, Phase 2: the Today, Ideas and Library tabs. Slides are previewed with the SAME templates
// the renderer uses (_shared/contentMachine/slides/templates.js), so a dry run already shows what would be
// posted; once rendered, the real PNGs and the MP4 replace the live preview. Download and copy work on a
// phone: the owner often posts from it.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FONT_CSS, SAFE, slideHtml } from "../../../../supabase/functions/_shared/contentMachine/slides/templates.js";
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

// The platforms' safe zone on a 1080×1920 slide, in % (templates.js SAFE): drawn over a rendered PNG.
const ZONE = { left: (SAFE.left / 1080) * 100, right: (SAFE.right / 1080) * 100, top: (SAFE.top / 1920) * 100, bottom: (SAFE.bottom / 1920) * 100 };
function ZoneOverlay() {
  const band = "absolute bg-rose-500/20";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className={band} style={{ left: 0, top: 0, bottom: 0, width: `${ZONE.left}%` }} />
      <div className={band} style={{ right: 0, top: 0, bottom: 0, width: `${ZONE.right}%` }} />
      <div className={band} style={{ left: `${ZONE.left}%`, right: `${ZONE.right}%`, top: 0, height: `${ZONE.top}%` }} />
      <div className={band} style={{ left: `${ZONE.left}%`, right: `${ZONE.right}%`, bottom: 0, height: `${ZONE.bottom}%` }} />
      <div className="absolute border border-dashed border-rose-400" style={{ left: `${ZONE.left}%`, right: `${ZONE.right}%`, top: `${ZONE.top}%`, bottom: `${ZONE.bottom}%` }} />
    </div>
  );
}

function SlidePreview({ slide, index, total, style, images, zyvoShot, logos, png, safeZones, width = 216 }) {
  const scale = width / 1080;
  const frame = useRef(null);
  const [layout, setLayout] = useState(null);
  const html = useMemo(() => (png || !style ? null : slideHtml({ slide, index, total, style, images, zyvoShot, logos, fontCss: FONT_CSS.google })), [png, slide, index, total, style, images, zyvoShot, logos]);
  // The slide checks its own layout (overlaps, safe zone, missing images) and reports it here.
  useEffect(() => {
    const onMessage = (e) => { if (e.source && e.source === frame.current?.contentWindow && e.data?.cmLayout) setLayout(e.data.cmLayout); };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const bad = layout && !layout.ok;
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl border bg-black ${bad ? "border-red-400" : "border-white/10"}`} style={{ width, height: width * (16 / 9) }} data-testid="cm-slide" data-layout-ok={layout ? String(layout.ok) : undefined}>
      {png ? <img src={png} alt={`Slide ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
        : <iframe ref={frame} title={`Slide ${index + 1}`} srcDoc={html} sandbox="allow-scripts" className="pointer-events-none origin-top-left border-0" style={{ width: 1080, height: 1920, transform: `scale(${scale})` }} />}
      {safeZones && <ZoneOverlay />}
      {bad && <div className="absolute inset-x-1 bottom-1 rounded-md bg-red-500/90 px-2 py-1 text-[10.5px] font-semibold leading-tight text-white" title={layout.problems.join("\n")}>Layout: {layout.problems[0]}{layout.problems.length > 1 ? ` (+${layout.problems.length - 1})` : ""}</div>}
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

export function IdeaCard({ idea, styles, zyvoShot, logos, safeZones, onChanged, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const r = idea.recipe ?? {};
  const g = idea.generation;
  const style = styles?.[r.style];
  const images = (i) => ({ background: g?.images?.background ?? null, hero: g?.images?.heroes?.[i] ?? null });
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
              {idea.slides.map((s, i) => <SlidePreview key={i} slide={s} index={i} total={idea.slides.length} style={style} images={images(i)} zyvoShot={zyvoShot} logos={logos} safeZones={safeZones} png={g?.pngs?.[i]} />)}
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

/** "Show safe zones": the platforms' UI areas drawn over every preview (remembered in this browser). */
function useSafeZones() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem("cm.safeZones") === "1"; } catch { return false; } });
  const toggle = (v) => { setOn(v); try { localStorage.setItem("cm.safeZones", v ? "1" : "0"); } catch { /* private window */ } };
  const control = (
    <label className="flex items-center gap-2 text-[12.5px] text-white/70">
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} data-testid="cm-safe-zones" className="h-4 w-4 accent-rose-400" />
      Show safe zones
    </label>
  );
  return [on, control];
}

/** A running batch: the steps, a bar, about how long is left, and Cancel. Slideshows appear as they finish. */
function RunProgress({ runId, onTick, onDone }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const seen = useRef(-1);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await api("runProgress", { runId });
        if (!alive) return;
        setP(r);
        if (r.done + r.failed + r.cancelled !== seen.current) { seen.current = r.done + r.failed + r.cancelled; onTick(); }
        if (!r.active) onDone();
      } catch (e) { if (alive) setNote(e.message); }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancel = async () => {
    if (!window.confirm("Cancel this batch? Nothing new is paid for from now on; slideshows already finished are kept.")) return;
    setBusy(true);
    try { await api("cancelRun", { runId }); onDone(); } catch (e) { setNote(e.message); }
    setBusy(false);
  };
  if (!p) return null;
  const mins = Math.max(1, Math.round(p.leftSec / 60));
  return (
    <Card title="Making today's batch" testid="cm-progress" right={p.active && <button type="button" onClick={cancel} disabled={busy} data-testid="cm-cancel" className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-red-400/30 disabled:opacity-40">Cancel</button>}>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {p.steps.map((s) => (
          <li key={s.key} className={s.now ? "font-semibold text-sky-200" : s.passed === p.total ? "text-lime-200" : "text-white/45"}>
            {s.label} {s.passed}/{p.total}{s.now ? ` · ${s.now} now` : ""}
          </li>
        ))}
        <li className="text-white/70">Done {p.done}/{p.total}{p.failed ? ` · ${p.failed} stopped` : ""}{p.cancelled ? ` · ${p.cancelled} cancelled` : ""}</li>
      </ol>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuenow={Math.round(p.share * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${Math.max(2, p.share * 100)}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] text-white/55">{p.active ? `About ${mins} min left (from past runs) · ${Math.round(p.elapsedSec / 60)} min so far.` : `Finished: ${p.status}.`} Each slideshow appears below as soon as it's done.</p>
      {note && <p className="mt-1 text-[12.5px] text-red-200">{note}</p>}
    </Card>
  );
}

export function TodayTab({ st, onChanged }) {
  const [zones, zoneControl] = useSafeZones();
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
      setNote(`Started ${r.count} slideshow${r.count > 1 ? "s" : ""}${r.dryRun ? " as a dry run (nothing is spent)" : ""}.`);
      await load(r.runId); onChanged();
    } catch (err) { setNote(err.message); }
    setBusy(false);
  };

  const [auto, setAuto] = useState(Boolean(st.settings.daily_auto_run));
  const [autoBusy, setAutoBusy] = useState(false);
  useEffect(() => { setAuto(Boolean(st.settings.daily_auto_run)); }, [st.settings.daily_auto_run]);
  const flipAuto = async (on) => {
    setAutoBusy(true); setNote(null);
    try { await api("saveSettings", { patch: { daily_auto_run: on } }); setAuto(on); onChanged(); } catch (e) { setNote(e.message); }
    setAutoBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="Today" testid="cm-make">
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <button type="button" role="switch" aria-checked={auto} aria-label="Automatic" disabled={autoBusy} onClick={() => flipAuto(!auto)} data-testid="cm-automatic"
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${auto ? "bg-lime-300" : "bg-white/15"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${auto ? "left-6" : "left-1"}`} />
          </button>
          <div className="text-[13.5px]">
            <span className="font-semibold text-white">Automatic {auto ? "ON" : "OFF"}</span>
            <span className="text-white/55"> · {auto ? `makes ${st.settings.slideshows_per_day} slideshows by itself every day at ${st.settings.run_time_local} (Helsinki)` : "no daily run; use Start whenever you want"}. The time is in Settings.</span>
          </div>
        </div>
        <form onSubmit={make} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder='Topic (optional), e.g. "AI tools that replace a video editor"' className={`${input} w-full sm:flex-1`} aria-label="Topic" data-testid="cm-topic" />
          <select value={count} onChange={(e) => setCount(e.target.value)} className={input} aria-label="How many">{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} slideshow{i ? "s" : ""}</option>)}</select>
          <button type="submit" disabled={busy || st.settings.kill_switch || Boolean(run && RUN_ACTIVE.has(run.status))} data-testid="cm-make-button"
            className="rounded-xl bg-lime-300 px-8 py-3 text-[17px] font-bold text-[#071006] transition enabled:hover:bg-lime-200 disabled:opacity-40">{busy ? "Starting…" : "Start"}</button>
        </form>
        <p className="mt-2 text-[12px] text-white/45">{st.dryRun.effective ? "Dry run: mocked, $0." : "Live: about $0.10–0.25 a slideshow, within the caps."} Empty topic: Claude picks. Start works whether Automatic is on or off.</p>
        {note && <p role="status" className="mt-2 text-[13px] text-white/70">{note}</p>}
      </Card>

      {run && RUN_ACTIVE.has(run.status) && <RunProgress runId={run.id} onTick={() => load(run.id)} onDone={() => { load(run.id); onChanged(); }} />}

      {runs && runs.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {runs.slice(0, 12).map((r) => (
            <button key={r.id} type="button" onClick={() => load(r.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-[12px] ${r.id === runId ? "border-lime-300/60 bg-lime-300/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="font-semibold text-white">{{ daily: "Daily run", manual: "Remake", samples: "Style samples" }[r.kind] ?? "Slideshows"} · {r.run_date}</div>
              <div className="text-white/55">{nice(r.status)}{r.dry_run ? " · dry run" : ""} · {money(r.spend_usd, 3)}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end">{zoneControl}</div>
      {data?.ideas?.length === 0 && <p className="text-[13.5px] text-white/60">{runs?.length ? "No slideshows in this run yet." : "Nothing made yet. Press Make slideshows."}</p>}
      <div className="space-y-3">{data?.ideas?.map((i, n) => <IdeaCard key={i.id} idea={i} styles={data.styles} zyvoShot={data.zyvoShot} logos={data.logos} safeZones={zones} onChanged={() => load(runId)} startOpen={n === 0} />)}</div>
    </div>
  );
}

/* ─── Ideas: all history with filters ────────────────────────────────── */

export function IdeasTab() {
  const [zones, zoneControl] = useSafeZones();
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
      <div className="flex justify-end">{zoneControl}</div>
      {error && <p className="text-[13px] text-red-200">{error}</p>}
      {!data ? <p className="text-[13px] text-white/50">Loading…</p> : data.ideas.length === 0 ? <p className="text-[13.5px] text-white/60">No ideas match.</p>
        : <div className="space-y-3">{data.ideas.map((i) => <IdeaCard key={i.id} idea={i} styles={data.styles} zyvoShot={data.zyvoShot} logos={data.logos} safeZones={zones} onChanged={load} />)}</div>}
    </div>
  );
}

/* ─── Library: formats, styles and hooks ─────────────────────────────── */

const EMPTY = { kind: "format", key: "", name: "", description: "", spec: '{"slides": [5, 7]}' };

/* ─── the logo library: official files, approved one by one ─── */

const readBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
  r.onerror = reject;
  r.readAsDataURL(file);
});

function LogoRow({ row, onSaved }) {
  const [source, setSource] = useState(row.source_url ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const run = async (fn) => { setBusy(true); setNote(null); try { await fn(); await onSaved(); } catch (e) { setNote(e.message); } setBusy(false); };
  const upload = (file) => run(async () => {
    if (!file) return;
    await api("uploadLogo", { id: row.id, contentType: file.type, dataBase64: await readBase64(file) });
  });
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid="cm-logo">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white p-2">{row.url ? <img src={row.url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-black/40">no file</span>}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-white">{row.name} <span className="text-[12px] font-normal text-white/45">{row.domain}</span>{row.display && row.display !== "logo" && <span className="ml-2"><Badge tone="bg-sky-300/15 text-sky-200">{row.display === "name" ? "Name only (your rule)" : "Initials tile (your rule)"}</Badge></span>}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Press / brand kit page (https://…)" className={`${input} w-full py-1.5 text-[12.5px] sm:w-80`} aria-label={`${row.name} source page`} />
          {source !== (row.source_url ?? "") && <button type="button" disabled={busy} onClick={() => run(() => api("saveLogo", { id: row.id, source_url: source }))} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white">Save source</button>}
          <label className="cursor-pointer rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white">{row.logo_path ? "Replace file" : "Upload official file"}
            <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
        {row.notes && <div className="mt-1 text-[11.5px] text-white/45">{row.notes}</div>}
        {note && <div className="mt-1 text-[12px] text-red-200">{note}</div>}
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-white/80">
        <input type="checkbox" checked={row.approved} disabled={busy || (!row.approved && (!row.logo_path || !row.source_url))} onChange={(e) => run(() => api("approveLogo", { id: row.id, approved: e.target.checked }))} className="h-4 w-4 accent-lime-300" />
        {row.approved ? "Approved" : "Approve"}
      </label>
    </li>
  );
}

function LogosCard() {
  const [rows, setRows] = useState(null);
  const [add, setAdd] = useState({ name: "", domain: "" });
  const [note, setNote] = useState(null);
  const load = useCallback(async () => { try { setRows((await api("logos")).rows); } catch (e) { setNote(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const create = async (e) => {
    e.preventDefault(); setNote(null);
    try { await api("saveLogo", add); setAdd({ name: "", domain: "" }); await load(); } catch (err) { setNote(err.message); }
  };
  return (
    <Card title="Logo library" testid="cm-logos">
      <p className="mb-2 text-[12.5px] text-white/55">Only official files from each company's press or brand kit page, unaltered. A logo appears small next to the tool's name, and only once you approve it; a new file needs approving again. Without an approved logo, the slide shows the initials tile. Never implies a partnership.</p>
      {!rows ? <p className="text-[13px] text-white/50">{note ?? "Loading…"}</p> : <ul className="divide-y divide-white/[0.06]">{rows.map((r) => <LogoRow key={r.id} row={r} onSaved={load} />)}</ul>}
      <form onSubmit={create} className="mt-3 flex flex-wrap gap-2">
        <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Tool name" className={input} aria-label="New tool name" />
        <input value={add.domain} onChange={(e) => setAdd({ ...add, domain: e.target.value })} placeholder="domain.com" className={input} aria-label="New tool domain" />
        <button type="submit" className="rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white">Add tool</button>
        {note && rows && <span className="text-[12.5px] text-red-200">{note}</span>}
      </form>
    </Card>
  );
}

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
      <LogosCard />
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

/* ─── Assets: real Zyvo outputs and UI the writer may use ────────────── */

const ASSET_TONE = { active: "bg-lime-300/15 text-lime-200", excluded: "bg-amber-300/15 text-amber-200", blocked: "bg-red-400/15 text-red-200", pending: "bg-white/10 text-white/60" };

export function AssetsTab() {
  const [f, setF] = useState({ status: "", tool: "" });
  const [data, setData] = useState(null);
  const [note, setNote] = useState(null);
  const load = useCallback(async () => {
    try { setData(await api("assets", Object.fromEntries(Object.entries(f).filter(([, v]) => v)))); } catch (e) { setNote(e.message); }
  }, [f]);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (row, status) => {
    setNote(null);
    try { await api("setAssetStatus", { id: row.id, status }); await load(); } catch (e) { setNote(e.message); }
  };
  const tools = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.tool).filter(Boolean))].sort(), [data]);
  return (
    <div className="space-y-4">
      <Card title="Asset library" testid="cm-assets">
        <p className="text-[12.5px] text-white/55">Real Zyvo outputs and UI from the repo, in the private bucket. The writer can put any <b>active</b> one on a slide ("made with Zyvo" proof, showcases, the screenshot collage style). The fast model tagged each one and excluded anything with a realistic human, a real person or lookalike, or a third-party character or brand. Block anything you don't want used.</p>
        {data && <p className="mt-2 text-[13px] text-white/75">{Object.entries(data.counts).map(([k, v]) => `${v} ${k}`).join(" · ") || "No assets yet."}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input} aria-label="Status"><option value="">any status</option>{["active", "excluded", "blocked", "pending"].map((s) => <option key={s}>{s}</option>)}</select>
          <select value={f.tool} onChange={(e) => setF({ ...f, tool: e.target.value })} className={input} aria-label="Tool"><option value="">any tool</option>{tools.map((t) => <option key={t} value={t}>{nice(t)}</option>)}</select>
        </div>
        {note && <p className="mt-2 text-[12.5px] text-red-200">{note}</p>}
      </Card>
      {!data ? <p className="text-[13px] text-white/50">Loading…</p> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {data.rows.map((r) => (
            <figure key={r.id} data-testid="cm-asset" className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
              <div className="aspect-square bg-black">{r.url && <img src={r.url} alt={r.subject ?? ""} loading="lazy" className={`h-full w-full object-cover ${r.status === "active" ? "" : "opacity-40"}`} />}</div>
              <figcaption className="space-y-1 p-2 text-[11.5px]">
                <div className="flex flex-wrap items-center gap-1"><Badge tone={ASSET_TONE[r.status]}>{r.status}</Badge>{r.tool && <Badge>{nice(r.tool)}</Badge>}</div>
                <div className="line-clamp-2 text-white/75" title={r.source_path}>{r.subject ?? r.source_path}</div>
                {r.exclude_reason && <div className="text-amber-200/80">{r.exclude_reason}</div>}
                {r.status === "blocked"
                  ? <button type="button" onClick={() => setStatus(r, "active")} className="text-white/70 underline">Unblock</button>
                  : r.status !== "pending" && <button type="button" onClick={() => setStatus(r, r.status === "excluded" ? "active" : "blocked")} className="text-white/70 underline">{r.status === "excluded" ? "Use anyway" : "Block"}</button>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
