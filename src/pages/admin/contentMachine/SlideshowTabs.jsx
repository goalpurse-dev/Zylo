// Content Machine, Phase 2: the Queue, All and Library tabs. Slides are previewed with the SAME templates
// the renderer uses (_shared/contentMachine/slides/templates.js), so a dry run already shows what would be
// posted; once rendered, the real PNGs and the MP4 replace the live preview. Download and copy work on a
// phone: the owner often posts from it.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AVOID, FONT_CSS, SAFE, SAFE_PROFILES, slideHtml } from "../../../../supabase/functions/_shared/contentMachine/slides/templates.js";
import { api, copyText, money, when } from "./cmApi";
import { MarkPosted } from "./PostedTabs";
import { DownloadButton, FreshImg, FreshVideo } from "./freshFiles";
import { QUEUE_FILTERS, groupByDay, queueView } from "./queueView";
import { ideaState } from "../../../../supabase/functions/_shared/contentMachine/ideaState.js";

const STATUS_TONE = {
  done: "bg-lime-300/15 text-lime-200", producing: "bg-sky-300/15 text-sky-200", proposed: "bg-white/10 text-white/70", approved: "bg-lime-300/25 text-lime-100",
  rejected: "bg-white/10 text-white/40", posted: "bg-sky-300/25 text-sky-100", failed: "bg-red-400/15 text-red-200", skipped_budget: "bg-amber-300/15 text-amber-200",
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

// A platform's safe zone on a 1080×1920 slide, in % (templates.js SAFE_PROFILES), drawn over any preview.
// "export": the zone every platform leaves free, which is what the slides are laid out in.
const ZONE_PICKS = [["export", "All platforms (the export)"], ...Object.entries(SAFE_PROFILES).map(([k, p]) => [k, p.label])];
function ZoneOverlay({ profile }) {
  const z = profile === "export" ? { ...SAFE, avoid: AVOID } : SAFE_PROFILES[profile] ?? { ...SAFE, avoid: AVOID };
  const x = (v) => `${(v / 1080) * 100}%`, y = (v) => `${(v / 1920) * 100}%`;
  const band = "absolute bg-rose-500/20";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="cm-zone-overlay">
      <div className={band} style={{ left: 0, top: 0, bottom: 0, width: x(z.left) }} />
      <div className={band} style={{ right: 0, top: 0, bottom: 0, width: x(z.right) }} />
      <div className={band} style={{ left: x(z.left), right: x(z.right), top: 0, height: y(z.top) }} />
      <div className={band} style={{ left: x(z.left), right: x(z.right), bottom: 0, height: y(z.bottom) }} />
      {(z.avoid ?? []).map((a) => <div key={a.name} title={a.name} className="absolute bg-orange-400/35" style={{ left: x(a.x0), top: y(a.y0), width: x(a.x1 - a.x0), height: y(a.y1 - a.y0) }} />)}
      <div className="absolute border border-dashed border-rose-400" style={{ left: x(z.left), right: x(z.right), top: y(z.top), bottom: y(z.bottom) }} />
    </div>
  );
}

function SlidePreview({ slide, index, total, style, images, zyvoShot, logos, png, pngPath, safeZones, width = 216 }) {
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
      {png ? <FreshImg src={png} path={pngPath} alt={`Slide ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
        : <iframe ref={frame} title={`Slide ${index + 1}`} srcDoc={html} sandbox="allow-scripts" className="pointer-events-none origin-top-left border-0" style={{ width: 1080, height: 1920, transform: `scale(${scale})` }} />}
      {safeZones && <ZoneOverlay profile={safeZones} />}
      {!bad && layout?.warnings?.length > 0 && <div className="absolute inset-x-1 bottom-1 rounded-md bg-amber-500/90 px-2 py-1 text-[10.5px] font-semibold leading-tight text-black" title={layout.warnings.join("; ")}>Space: {layout.warnings[0]}</div>}
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
    try { await api("savePackage", { id: p.id, caption: edit.caption, title: p.platform !== "instagram" ? edit.title : undefined, hashtags: edit.hashtags }); setEdit(null); onSaved(); }
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
            {p.platform !== "instagram" && <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={`${input} w-full`} aria-label="Title" />}
            <textarea rows={4} value={edit.caption} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} className={`${input} w-full`} aria-label="Caption" />
            <input value={edit.hashtags} onChange={(e) => setEdit({ ...edit, hashtags: e.target.value })} className={`${input} w-full`} aria-label="Hashtags" />
            <div className="flex gap-2"><button type="button" onClick={save} className="rounded-lg bg-lime-300 px-3 py-1.5 text-[13px] font-semibold text-[#071006]">Save</button><button type="button" onClick={() => setEdit(null)} className="text-[13px] text-white/60 underline">Cancel</button>{note && <span className="text-[12.5px] text-red-200">{note}</span>}</div>
          </div>
        ) : (
          <>
            {p.title && <Row label="Title" text={p.title} />}
            {p.platform === "tiktok"
              ? <Row label="Description (caption + hashtags)" text={[p.caption, tags].filter(Boolean).join("\n\n")} />
              : <><Row label={p.platform === "youtube" ? "Description" : "Caption"} text={p.caption} /><Row label="Hashtags" text={tags} /></>}
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

const PLATFORM_NAMES = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
const day = (iso) => (iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }) : "");

/** The slideshow's state (ideaState.js): green Posted (+ where and when), grey Not posted, red Rejected, amber Flagged. */
function StateBadge({ idea }) {
  const s = ideaState(idea);
  if (s === "posted") {
    const where = [...new Set((idea.posts ?? []).map((p) => PLATFORM_NAMES[p.platform] ?? p.platform))].join(", ");
    const at = idea.posts?.[0]?.posted_at;
    return <span data-testid="cm-state" data-state={s}><Badge tone="bg-lime-400/25 text-lime-100">Posted{where ? ` · ${where}` : ""}{at ? ` · ${day(at)}` : ""}</Badge></span>;
  }
  const look = { rejected: ["Rejected", "bg-red-500/25 text-red-100"], flagged: ["Flagged", "bg-amber-300/25 text-amber-100"], not_posted: ["Not posted", "bg-white/10 text-white/70"] }[s];
  return <span data-testid="cm-state" data-state={s}><Badge tone={look[1]}>{look[0]}</Badge></span>;
}

/** A readable file name for downloads: the title, made safe, plus the date. */
const fileStem = (idea) => `${String(idea.title ?? "slideshow").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "slideshow"}-${String(idea.created_at ?? "").slice(0, 10)}`;

export function IdeaCard({ idea, styles, zyvoShot, logos, safeZones, onChanged, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const r = idea.recipe ?? {};
  const g = idea.generation;
  const style = styles?.[r.style];
  const images = (i) => ({ background: g?.images?.background ?? null, hero: g?.images?.heroes?.[i] ?? null, collage: g?.images?.collages?.[i] ?? null, gallery: g?.images?.galleries?.[i] ?? null });
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
          <StateBadge idea={idea} />
          {!["done", "approved", "posted", "rejected"].includes(idea.status) && <Badge tone={STATUS_TONE[idea.status]}>{nice(idea.status)}</Badge>}
          {idea.status === "approved" && <Badge tone={STATUS_TONE.approved}>approved</Badge>}
          <Badge tone={idea.account === "zyvo" ? "bg-violet-300/20 text-violet-100" : "bg-sky-300/15 text-sky-100"}>{idea.account === "zyvo" ? "Zyvo account" : "Creator account"}</Badge>
          {idea.kind === "video" && <Badge tone="bg-lime-300/20 text-lime-100" title="A Zyvo Studio video (how I made this with Zyvo)">Studio video</Badge>}
          {idea.kind === "video" && r.cta && <Badge title="The CTA variant (A/B tested in Analytics)">CTA: {nice(r.cta)}</Badge>}
          {idea.outdated && <Badge tone="bg-orange-300/20 text-orange-100" title="Rendered with older slide templates">Outdated</Badge>}
          {idea.dry_run && <Badge tone="bg-sky-300/15 text-sky-200" title="Mocked: nothing was spent">dry run</Badge>}
          <Badge>{nice(r.format)}</Badge><Badge>{nice(r.style)}</Badge><Badge>hook: {nice(r.hook_type)}</Badge>
          <Badge>Zyvo: {nice(r.zyvo_position)}</Badge><Badge>{r.platform} {r.post_time}</Badge>
          {r.mode === "winner" && <Badge tone="bg-lime-300/20 text-lime-100">winner</Badge>}
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
          {idea.error && <p className="text-[13px] text-red-200" data-testid="cm-idea-error">{idea.error}</p>}
          {idea.compliance?.needsNewFormat && <p className="text-[13px] text-amber-200">This format couldn't be made to fit, even after the program shortened it. Remaking it the same way would fail again: use <b>Remake with different format</b> below.</p>}
          {idea.compliance?.shortened?.length > 0 && <p className="text-[12px] text-white/50">Shortened by the program to fit: {idea.compliance.shortened.join(" · ")}</p>}
          {flagged && <p className="text-[13px] text-amber-200">The compliance check still found: {idea.compliance.problems.join(" · ")}. Fix it or reject it before posting.</p>}
          {idea.slides.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" data-testid="cm-slides">
              {idea.slides.map((s, i) => <SlidePreview key={i} slide={s} index={i} total={idea.slides.length} style={style} images={images(i)} zyvoShot={zyvoShot} logos={logos} safeZones={safeZones} png={g?.pngs?.[i]} pngPath={g?.paths?.pngs?.[i]} />)}
            </div>
          )}
          {g?.dryRun && <p className="text-[12.5px] text-white/50">Dry run: these previews are drawn live in your browser; nothing was rendered or spent.</p>}
          {g && !g.dryRun && g.status !== "done" && <p className="text-[12.5px] text-white/50">Rendering… ({g.status}){g.error ? `: ${g.error}` : ""}</p>}
          {(g?.mp4 || g?.zip) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {g.mp4 && <FreshVideo src={g.mp4} path={g.paths?.mp4} controls playsInline preload="metadata" className="w-full max-w-[260px] rounded-xl border border-white/10 bg-black" />}
              <div className="flex flex-wrap gap-2">
                {g.paths?.zip && <DownloadButton path={g.paths.zip} filename={`${fileStem(idea)}-slides.zip`} testid="cm-download-zip" className="rounded-lg bg-lime-300 px-3 py-2 text-[13px] font-semibold text-[#071006]">Download slides (ZIP)</DownloadButton>}
                {g.paths?.mp4 && <DownloadButton path={g.paths.mp4} filename={`${fileStem(idea)}.mp4`} testid="cm-download-mp4" className="rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white">Download MP4</DownloadButton>}
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
            <MarkPosted idea={idea} onDone={onChanged} />
            {idea.status === "posted" && <button type="button" disabled={!!busy} data-testid="cm-undo-posted" onClick={() => { if (window.confirm(`Undo posted? Its ${idea.posts?.length || ""} post${idea.posts?.length === 1 ? "" : "s"} and their stats are removed, and it goes back to Not posted (in the Queue).`)) act("unmarkPosted", { ideaId: idea.id }, "undo"); }} className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">Undo posted</button>}
            {idea.outdated && ["done", "approved"].includes(idea.status) && <button type="button" disabled={!!busy} onClick={() => { if (window.confirm("Render this slideshow again with today's slide templates? The same words and pictures; a render and its QA check, about $0.005.")) act("rerender", { id: idea.id }, "rerender"); }} className="rounded-lg bg-orange-300/20 px-3 py-1.5 text-[13px] font-semibold text-orange-100 disabled:opacity-40">Render again</button>}
            {idea.status !== "approved" && idea.status === "done" && <button type="button" disabled={!!busy} onClick={() => act("setIdeaStatus", { id: idea.id, status: "approved" }, "approve")} className="rounded-lg bg-lime-300/90 px-3 py-1.5 text-[13px] font-semibold text-[#071006] disabled:opacity-40">Approve</button>}
            {!["rejected", "posted"].includes(idea.status) && <button type="button" disabled={!!busy} onClick={() => act("setIdeaStatus", { id: idea.id, status: "rejected" }, "reject")} className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">Reject</button>}
            {idea.kind !== "video" && idea.recipe?.format && <button type="button" disabled={!!busy} onClick={() => { if (window.confirm("Write the same idea again as a new slideshow? One paid write (about $0.10–0.25), within the caps.")) act("remakeIdea", { id: idea.id, mode: "same" }, "remake"); }} className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">Remake same idea</button>}
            {idea.kind !== "video" && idea.recipe?.format && <button type="button" disabled={!!busy} data-testid="cm-remake-format" onClick={() => { if (window.confirm("Remake it in a DIFFERENT format (same topic and account)? One paid write (about $0.10–0.25), within the caps.")) act("remakeIdea", { id: idea.id, mode: "format" }, "remake"); }} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40 ${idea.compliance?.needsNewFormat ? "bg-lime-300 text-[#071006]" : "bg-white/10 text-white"}`}>Remake with different format</button>}
            {busy && <span className="text-[12.5px] text-white/50">Working…</span>}
            {note && <span className="text-[12.5px] text-red-200">{note}</span>}
          </div>
        </div>
      )}
    </article>
  );
}

/* ─── Today ──────────────────────────────────────────────────────────── */

/** "Show safe zones": a platform's UI areas drawn over every preview (remembered in this browser). */
function useSafeZones() {
  const [on, setOn] = useState(() => { try { const v = localStorage.getItem("cm.safeZones"); return v === "1" ? "export" : v && v !== "0" ? v : ""; } catch { return ""; } });
  const pick = (v) => { setOn(v); try { localStorage.setItem("cm.safeZones", v || "0"); } catch { /* private window */ } };
  const control = (
    <label className="flex items-center gap-2 text-[12.5px] text-white/70">
      Show safe zones
      <select value={on} onChange={(e) => pick(e.target.value)} data-testid="cm-safe-zones" className="rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1 text-[12.5px] text-white">
        <option value="">off</option>
        {ZONE_PICKS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
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

// The two accounts (content lanes): each has its own section, colour, button, progress and list.
const LANES = {
  zyvo: { title: "Zyvo account", word: "Zyvo", hint: "Product carousels about Zyvo: real outputs, rebuilt UI, claims only from the fact sheet.", defaultCount: 2,
    ring: "border-violet-400/40", bg: "bg-violet-400/[0.06]", accent: "text-violet-200", button: "bg-violet-300 text-[#14092b] enabled:hover:bg-violet-200", pillOn: "border-violet-300/60 bg-violet-300/15 text-violet-100" },
  creator: { title: "Creator account", word: "Creator", hint: "Go-viral and faceless-creator education with one soft Zyvo mention.", defaultCount: 3,
    ring: "border-sky-400/40", bg: "bg-sky-400/[0.05]", accent: "text-sky-200", button: "bg-sky-300 text-[#04131c] enabled:hover:bg-sky-200", pillOn: "border-sky-300/60 bg-sky-300/15 text-sky-100" },
};

function LaneSection({ lane, st, runs, zones, onChanged, reloadRuns, className = "" }) {
  const L = LANES[lane];
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(String(L.defaultCount));
  const [filter, setFilter] = useState("");
  const [data, setData] = useState(null);
  const [est, setEst] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const load = useCallback(async () => {
    // Every unposted slideshow of this account, from any day (owner, 2026-10-23).
    try { setData(await api("ideas", { queue: true, account: lane, limit: 200 })); } catch (e) { setNote(e.message); }
  }, [lane]);
  useEffect(() => { load(); }, [load]);
  const n = Number(count);
  useEffect(() => {
    let alive = true;
    api("batchEstimate", { account: lane, count: n }).then((r) => { if (alive) setEst(r); }).catch(() => { if (alive) setEst(null); });
    return () => { alive = false; };
  }, [lane, n, st.spend.day.usedUsd]);
  const active = runs?.find((r) => r.account === lane && RUN_ACTIVE.has(r.status));
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [active, load]);

  const make = async (e) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try {
      const r = await api("makeSlideshows", { account: lane, topic: topic.trim() || null, count: n });
      setTopic("");
      setNote(`Started ${r.count} ${L.word} slideshow${r.count > 1 ? "s" : ""}${r.dryRun ? " as a dry run (nothing is spent)" : ` (about $${r.estimateUsd.toFixed(2)})`}.`);
      await reloadRuns(); await load(); onChanged();
    } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  const { shown, counts, total } = queueView(data?.ideas, filter);
  const days = groupByDay(shown, new Date(), st.settings.timezone || "Europe/Helsinki");
  const pill = (on) => `shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${on ? L.pillOn : "border-white/10 bg-white/[0.03] text-white/70"}`;
  const tooMuch = est && !est.fits;
  return (
    <section className={`space-y-3 rounded-2xl border-2 ${L.ring} ${L.bg} p-3 sm:p-4 ${className}`} data-testid={`cm-lane-${lane}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`text-[15px] font-extrabold uppercase tracking-[0.1em] ${L.accent}`}>{L.title}</h2>
        <p className="text-[12px] text-white/55">{L.hint}</p>
      </div>
      <form onSubmit={make} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="Topic (optional)" className={`${input} w-full sm:flex-1`} aria-label={`${L.word} topic`} data-testid={`cm-topic-${lane}`} />
        <select value={count} onChange={(e) => setCount(e.target.value)} className={input} aria-label={`How many ${L.word} slideshows`} data-testid={`cm-count-${lane}`}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
        <button type="submit" disabled={busy || st.settings.kill_switch || Boolean(active) || tooMuch} data-testid={`cm-make-${lane}`}
          className={`rounded-xl px-5 py-3 text-[15px] font-bold transition disabled:opacity-40 ${L.button}`}>{busy ? "Starting…" : `Make ${n} ${L.word} slideshow${n > 1 ? "s" : ""}`}</button>
      </form>
      {est && <p className={`text-[12px] ${tooMuch ? "font-semibold text-red-200" : "text-white/50"}`} data-testid={`cm-estimate-${lane}`}>{tooMuch ? est.message : est.leftUsd == null ? `About $${est.estimateUsd.toFixed(2)}.` : `About $${est.estimateUsd.toFixed(2)} (≈ $${est.perUsd.toFixed(2)} each) · fits today's caps.`}</p>}
      {note && <p role="status" className="text-[13px] text-white/75">{note}</p>}
      {active && <RunProgress runId={active.id} onTick={load} onDone={() => { reloadRuns(); load(); onChanged(); }} />}
      <div className="flex flex-wrap items-center gap-2" data-testid={`cm-filters-${lane}`}>
        {QUEUE_FILTERS.map(([k, label]) => <button key={k || "all"} type="button" onClick={() => setFilter(k)} className={pill(filter === k)}>{label} {counts[k]}</button>)}
      </div>
      {data && shown.length === 0 && <p className="text-[13px] text-white/55">{total ? "Nothing with this status." : "No unposted slideshows."}</p>}
      {data && !filter && (counts.rejected > 0 || counts.outdated > 0) && <p className="text-[12px] text-white/45">Rejected and Outdated are hidden here (pick them above, or see the All tab).</p>}
      {data?.more && <p className="text-[12px] text-amber-200">Showing the newest {data.ideas.length}; older unposted ones are in the All tab.</p>}
      <div className="space-y-4" data-testid={`cm-list-${lane}`}>
        {days.map((d, n) => (
          <div key={d.key} className="space-y-3" data-testid="cm-day">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-white/50" data-testid="cm-day-label">{d.label} <span className="font-semibold text-white/35">· {d.ideas.length}</span></h3>
            {d.ideas.map((i, k) => <IdeaCard key={i.id} idea={i} styles={data.styles} zyvoShot={data.zyvoShot} logos={data.logos} safeZones={zones} onChanged={load} startOpen={n === 0 && k === 0} />)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function QueueTab({ st, onChanged }) {
  const [zones, zoneControl] = useSafeZones();
  const [runs, setRuns] = useState(null);
  const [deskLane, setDeskLane] = useState(() => { try { return localStorage.getItem("cm.lane") || "zyvo"; } catch { return "zyvo"; } });
  const pickLane = (l) => { setDeskLane(l); try { localStorage.setItem("cm.lane", l); } catch { /* private window */ } };
  const reloadRuns = useCallback(async () => { try { setRuns((await api("runs")).runs); } catch { /* the sections show their own errors */ } }, []);
  useEffect(() => { reloadRuns(); const t = setInterval(reloadRuns, 10_000); return () => clearInterval(t); }, [reloadRuns]);
  const [auto, setAuto] = useState(Boolean(st.settings.daily_auto_run));
  const [autoBusy, setAutoBusy] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => { setAuto(Boolean(st.settings.daily_auto_run)); }, [st.settings.daily_auto_run]);
  const flipAuto = async (on) => {
    setAutoBusy(true); setNote(null);
    try { await api("saveSettings", { patch: { daily_auto_run: on } }); setAuto(on); onChanged(); } catch (e) { setNote(e.message); }
    setAutoBusy(false);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <button type="button" role="switch" aria-checked={auto} aria-label="Automatic" disabled={autoBusy} onClick={() => flipAuto(!auto)} data-testid="cm-automatic"
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${auto ? "bg-lime-300" : "bg-white/15"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${auto ? "left-6" : "left-1"}`} />
        </button>
        <div className="text-[13.5px]">
          <span className="font-semibold text-white">Automatic {auto ? "ON" : "OFF"}</span>
          <span className="text-white/55"> · {auto ? `makes each account's daily count by itself at ${st.settings.run_time_local} (Helsinki)` : "no daily run; use the buttons below"}. Counts per account and the time are in Settings.</span>
        </div>
        <div className="ml-auto">{zoneControl}</div>
        {note && <p className="w-full text-[12.5px] text-red-200">{note}</p>}
      </div>
      <div className="hidden gap-1 rounded-xl border border-white/10 bg-black/20 p-1 lg:flex" role="tablist" aria-label="Account">
        {Object.entries(LANES).map(([k, L]) => (
          <button key={k} type="button" role="tab" aria-selected={deskLane === k} onClick={() => pickLane(k)} className={`flex-1 rounded-lg px-4 py-2 text-[13.5px] font-bold ${deskLane === k ? `${L.bg} ${L.accent} ring-1 ${L.ring}` : "text-white/55 hover:text-white/80"}`}>{L.title}</button>
        ))}
      </div>
      {Object.keys(LANES).map((k) => (
        <LaneSection key={k} lane={k} st={st} runs={runs} zones={zones} onChanged={onChanged} reloadRuns={reloadRuns} className={deskLane === k ? "" : "lg:hidden"} />
      ))}
    </div>
  );
}

/* ─── All: every slideshow ever made, both accounts (owner, 2026-10-23) ─── */

const STATE_PICKS = [["", "any status"], ["posted", "Posted"], ["not_posted", "Not posted"], ["rejected", "Rejected"], ["flagged", "Flagged"], ["outdated", "Outdated"]];

/** One line of the All tab: thumbnail, title, account, format/style, date made, cost, state. Opens the full card. */
function AllRow({ idea, data, zones, onChanged }) {
  const [open, setOpen] = useState(false);
  const r = idea.recipe ?? {};
  const g = idea.generation;
  if (open) {
    return (
      <div className="space-y-1" data-testid="cm-all-open">
        <button type="button" onClick={() => setOpen(false)} className="text-[12.5px] text-white/55 underline">Close ▲</button>
        <IdeaCard idea={idea} styles={data.styles} zyvoShot={data.zyvoShot} logos={data.logos} safeZones={zones} onChanged={onChanged} startOpen />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setOpen(true)} data-testid="cm-all-row" className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left hover:bg-white/[0.07]">
      <div className="h-[86px] w-[48px] shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
        {g?.pngs?.[0] && <FreshImg src={g.pngs[0]} path={g.paths?.pngs?.[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <StateBadge idea={idea} />
          {idea.outdated && <Badge tone="bg-orange-300/20 text-orange-100">Outdated</Badge>}
          {!["done", "approved", "posted", "rejected"].includes(idea.status) && <Badge tone={STATUS_TONE[idea.status]}>{nice(idea.status)}</Badge>}
          {idea.dry_run && <Badge tone="bg-sky-300/15 text-sky-200">dry run</Badge>}
        </div>
        <div className="truncate text-[15px] font-semibold text-white">{idea.title}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-white/50">
          <span className={idea.account === "zyvo" ? "text-violet-200" : "text-sky-200"}>{idea.account === "zyvo" ? "Zyvo" : "Creator"}</span>
          <span>{nice(r.format)} · {nice(r.style)}</span>
          <span>made {when(idea.created_at)}</span>
          <span>{idea.dry_run ? `would cost ${money(idea.cost.wouldUsd, 3)}` : money(idea.cost.usd, 3)}</span>
        </div>
      </div>
    </button>
  );
}

export function AllTab() {
  const [zones, zoneControl] = useSafeZones();
  const [f, setF] = useState({ account: "", state: "", from: "", to: "", format: "", style: "", q: "" });
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [lib, setLib] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Search waits for a short pause in typing.
  useEffect(() => { const t = setTimeout(() => setF((x) => (x.q === q.trim() ? x : { ...x, q: q.trim() })), 350); return () => clearTimeout(t); }, [q]);
  const params = useMemo(() => ({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), limit: 60 }), [f]);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await api("ideas", params)); } catch (e) { setError(e.message); }
  }, [params]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("library").then((r) => setLib(r.rows)).catch(() => {}); }, []);
  const more = async () => {
    setBusy(true);
    try { const r = await api("ideas", { ...params, before: data.oldest }); setData({ ...r, ideas: [...data.ideas, ...r.ideas] }); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const opts = (kind) => (lib ?? []).filter((r) => r.kind === kind);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-4" data-testid="cm-all">
      <Card title="Every slideshow ever made">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles" className={`${input} col-span-2`} aria-label="Search titles" data-testid="cm-all-search" />
          <select value={f.account} onChange={set("account")} className={input} aria-label="Account"><option value="">both accounts</option><option value="zyvo">Zyvo</option><option value="creator">Creator</option></select>
          <select value={f.state} onChange={set("state")} className={input} aria-label="Status" data-testid="cm-all-state">{STATE_PICKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label className="flex flex-col text-[11px] text-white/50">Made from<input type="date" value={f.from} onChange={set("from")} className={`${input} mt-0.5`} /></label>
          <label className="flex flex-col text-[11px] text-white/50">Made until<input type="date" value={f.to} onChange={set("to")} className={`${input} mt-0.5`} /></label>
          <select value={f.format} onChange={set("format")} className={input} aria-label="Format"><option value="">all formats</option>{opts("format").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
          <select value={f.style} onChange={set("style")} className={input} aria-label="Style"><option value="">all styles</option>{opts("style").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
        </div>
      </Card>
      <div className="flex justify-end">{zoneControl}</div>
      {error && <p className="text-[13px] text-red-200">{error}</p>}
      {!data ? <p className="text-[13px] text-white/50">Loading…</p> : data.ideas.length === 0 && !data.more ? <p className="text-[13.5px] text-white/60">No slideshows match.</p>
        : <div className="space-y-2" data-testid="cm-all-list">{data.ideas.map((i) => <AllRow key={i.id} idea={i} data={data} zones={zones} onChanged={load} />)}</div>}
      {data?.more && <button type="button" disabled={busy} onClick={more} className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-40">{busy ? "Loading…" : "Show older"}</button>}
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
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white p-2">{row.url ? <FreshImg src={row.url} path={row.logo_path} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-black/40">no file</span>}</div>
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

const ASSET_TONE = { active: "bg-lime-300/15 text-lime-200", excluded: "bg-amber-300/15 text-amber-200", blocked: "bg-red-400/15 text-red-200", flawed: "bg-orange-400/15 text-orange-200", pending: "bg-white/10 text-white/60" };

/** The prompt that really made this output (for "Prompt → result" slides); empty when unknown. */
function PromptField({ row, onSaved }) {
  const [v, setV] = useState(row.prompt ?? "");
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-white/55 underline">{row.prompt ? "Prompt ✓" : "Add its prompt"}</button>;
  return (
    <div className="space-y-1">
      <textarea rows={2} value={v} onChange={(e) => setV(e.target.value)} maxLength={300} placeholder="The exact prompt that made it" className="w-full rounded-md border border-white/15 bg-white/[0.05] p-1.5 text-[11.5px] text-white" />
      <button type="button" onClick={async () => { await api("setAssetPrompt", { id: row.id, prompt: v }); setOpen(false); onSaved(); }} className="text-lime-200 underline">Save</button>
    </div>
  );
}

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
        <p className="text-[12.5px] text-white/55">Real Zyvo outputs and UI from the repo, in the private bucket. The writer can put any <b>active</b> one on a slide ("made with Zyvo" proof, showcases, the screenshot collage style). The fast model tagged each one and excluded anything with a realistic human, a real person or lookalike, or a third-party character or brand. Block anything you don't want used. When the vision QA finds an artifact in an asset (distorted hands, garbled text…), it is marked <b>flawed</b> and no longer offered; Unflag it if you disagree.</p>
        {data && <p className="mt-2 text-[13px] text-white/75">{Object.entries(data.counts).map(([k, v]) => `${v} ${k}`).join(" · ") || "No assets yet."}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input} aria-label="Status"><option value="">any status</option>{["active", "flawed", "excluded", "blocked", "pending"].map((s) => <option key={s}>{s}</option>)}</select>
          <select value={f.tool} onChange={(e) => setF({ ...f, tool: e.target.value })} className={input} aria-label="Tool"><option value="">any tool</option>{tools.map((t) => <option key={t} value={t}>{nice(t)}</option>)}</select>
        </div>
        {note && <p className="mt-2 text-[12.5px] text-red-200">{note}</p>}
      </Card>
      {!data ? <p className="text-[13px] text-white/50">Loading…</p> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {data.rows.map((r) => (
            <figure key={r.id} data-testid="cm-asset" className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
              <div className="aspect-square bg-black">{r.url && <FreshImg src={r.url} path={r.path} alt={r.subject ?? ""} loading="lazy" className={`h-full w-full object-cover ${r.status === "active" ? "" : "opacity-40"}`} />}</div>
              <figcaption className="space-y-1 p-2 text-[11.5px]">
                <div className="flex flex-wrap items-center gap-1"><Badge tone={ASSET_TONE[r.status]}>{r.status}</Badge>{r.tool && <Badge>{nice(r.tool)}</Badge>}</div>
                <div className="line-clamp-2 text-white/75" title={r.source_path}>{r.subject ?? r.source_path}</div>
                {r.exclude_reason && <div className="text-amber-200/80">{r.exclude_reason}</div>}
                {r.status === "flawed" && r.flaw_reason && <div className="text-orange-200/80">QA: {r.flaw_reason}</div>}
                <PromptField row={r} onSaved={load} />
                {r.status === "flawed" ? <button type="button" onClick={() => setStatus(r, "active")} className="text-white/70 underline">Unflag</button>
                  : r.status === "blocked"
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
