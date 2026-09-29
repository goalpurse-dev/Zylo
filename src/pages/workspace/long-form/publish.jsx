// publish.jsx — Phase 6f. The Stickman Publish step: render the edit (1080p
// or 1440p), watch the preview, download the FULL video, pick a thumbnail,
// and copy the YouTube title / description / tags. Everything is
// server-driven: leave and come back, the render keeps going and the page
// shows its live state. Desktop: two columns; phones: one column, a slim top
// bar (no footer), like the editor.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, Copy, Download, Film, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Type } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import { cachedStickmanProject } from "./StickmanRouteGuard";
import { useOverlayFont } from "./sceneVisuals";
import { composeDescription, fmtChapter, limitTags, TITLE_MAX, TAGS_MAX_CHARS } from "../../../lib/publishText";
import { renderStatus, startRender, downloadRender, listThumbnails, startThumbnails, setThumbnailHeadline, selectThumbnail, getYoutubeText, generateYoutubeText, saveYoutubeText } from "./publish/publishApi";

const STAGE = { queued: "Waiting for a render machine…", drawing: "Drawing the text and captions…", rendering: "Rendering the scenes…", finishing: "Joining the scenes and the voice…", uploading: "Uploading your video…" };
const mins = (s) => (s < 90 ? `${Math.max(1, Math.round(s / 10) * 10)} s` : `${Math.round(s / 60)} min`);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Card({ title, icon: Icon, children, right, testid }) {
  return (
    <section data-testid={testid} className="rounded-2xl border border-white/[0.08] bg-[#121416] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-lime-300" />
        <h2 className="flex-1 text-[15px] font-bold text-white">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
function CopyBtn({ text, label = "Copy", testid }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" data-testid={testid} onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }}
      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11.5px] font-semibold text-white/75 hover:bg-white/[0.08]">
      {done ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />}{done ? "Copied" : label}
    </button>
  );
}

// The autopilot starts the 1080p render server-side; its job row appears after
// the edit is compiled (up to about a minute), so the page waits for it.
const AUTOPILOT_WAIT_MS = 120_000;

function RenderCard({ projectId, autopilot }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [since] = useState(() => Date.now());
  const load = useCallback(async () => { const r = await renderStatus(projectId); if (r.ok) setState(r); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const job = state?.job, done = job?.status === "done" ? job : state?.lastDone;
  const live = job && ["queued", "rendering"].includes(job.status);
  // Continue to Publish started a render that isn't in the list yet.
  const hasCurrent = job && job.status !== "failed" && job.editVersion === job.latestEditVersion;
  const [starting, setStarting] = useState(!!autopilot);
  useEffect(() => { if (starting && state && (hasCurrent || Date.now() - since > AUTOPILOT_WAIT_MS)) setStarting(false); }, [starting, state, hasCurrent, since]);
  useEffect(() => { if (!live && !starting) return; const id = setInterval(load, 3000); return () => clearInterval(id); }, [live, starting, load]);
  const start = async (resolution) => { setBusy(true); setMsg(null); const r = await startRender(projectId, resolution); setBusy(false); if (!r.ok) setMsg(r.message); load(); };
  const download = async (j) => { const r = await downloadRender(projectId, j.id); if (r.ok) window.location.href = r.url; else setMsg(r.message); };
  // The page's one state: error > rendering > stale edits > current (the latest render matches the edit) > none.
  const status = live || starting ? "rendering" : job?.status === "failed" ? "failed" : done?.outdated ? "stale" : null;
  const current = !!done && job?.status === "done" && !done.outdated;
  return (
    <Card testid="render-card" title="Your video" icon={Film}>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {done?.previewUrl ? <video data-testid="publish-player" src={done.previewUrl} controls playsInline className="h-full w-full" />
          : <div className="grid h-full place-items-center text-center text-[13px] text-white/45">{live || starting ? "Your video is being rendered…" : "Render your video to watch it here."}</div>}
      </div>
      {/* ONE status box at a time: error > rendering > stale edits. */}
      {status === "failed" && <div data-testid="render-failed" className="mt-3 flex items-start gap-2 rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-[12.5px] text-red-100"><AlertTriangle className="mt-px h-4 w-4 shrink-0" /><span>{job.reason} <span className="text-red-200/70">Retry is free.</span></span></div>}
      {status === "rendering" && (live ? (
        <div className="mt-3 grid gap-2" data-testid="render-progress">
          <div className="flex justify-between text-[12.5px] text-white/70"><span>{STAGE[job.stage] ?? "Rendering…"}</span><span className="tabular-nums">{job.progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-[width] duration-700" style={{ width: `${Math.max(2, job.progress)}%` }} /></div>
          <div className="flex justify-between text-[11.5px] text-white/45"><span>{job.etaSeconds ? `About ${mins(job.etaSeconds[0])}–${mins(job.etaSeconds[1])} left` : ""}</span><span className="tabular-nums">{job.status === "rendering" ? `Rendering for ${clock(job.elapsedSeconds)}` : `Queued ${clock(job.queuedSeconds)}`}</span></div>
          <p className="text-[11.5px] text-white/40">You can leave this page — the render keeps going and this page shows it when you come back.</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-2" data-testid="render-starting">
          <div className="flex items-center gap-2 text-[12.5px] text-white/70"><Loader2 className="h-4 w-4 animate-spin text-lime-300" /> Starting your render (1080p, included)…</div>
          <div className="zyvo-shimmer h-2 rounded-full bg-white/10" />
        </div>
      ))}
      {status === "stale" && <div data-testid="render-outdated" className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[12.5px] text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" /> Your edits aren't in this video yet. Render it again to include them (free).</div>}
      <div className="mt-3 grid gap-3">
        {current ? (
          <>
            <button type="button" data-testid="download-full" onClick={() => download(done)} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-lime-300 text-[15px] font-bold text-[#11150D] shadow-[0_0_40px_rgba(190,242,100,0.18)] hover:bg-lime-200"><Download className="h-5 w-5" /> Download video ({done.resolution})</button>
            {done.resolution === "1080p" && (
              <button type="button" data-testid="make-1440p" disabled={busy} onClick={() => start("1440p")} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] text-[14px] font-semibold text-white hover:bg-white/[0.09] disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Make 1440p version <span className="text-[11.5px] font-normal text-white/45">sharper on YouTube · free</span>
              </button>
            )}
          </>
        ) : status !== "rendering" && (
          <button type="button" data-testid="render-button" disabled={busy} onClick={() => start("1080p")} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-lime-300 text-[15px] font-bold text-[#11150D] shadow-[0_0_40px_rgba(190,242,100,0.18)] hover:bg-lime-200 disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : status === "failed" ? <RefreshCw className="h-5 w-5" /> : <Film className="h-5 w-5" />}
            {status === "failed" ? "Retry (free)" : "Render video"}
          </button>
        )}
        {!current && done && <button type="button" data-testid="download-previous" onClick={() => download(done)} className="inline-flex items-center gap-1.5 justify-self-start text-[12.5px] font-semibold text-white/55 underline decoration-white/20 underline-offset-4 hover:text-white"><Download className="h-3.5 w-3.5" /> Download previous version ({done.resolution})</button>}
      </div>
      {msg && <p className="mt-2 text-[12px] text-red-200">{msg}</p>}
    </Card>
  );
}

function ThumbnailsCard({ projectId }) {
  const [s, setS] = useState(null);
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState(null);
  const started = useRef(false);
  const load = useCallback(async () => { const r = await listThumbnails(projectId); if (r.ok) setS(r); return r; }, [projectId]);
  useEffect(() => { load().then((r) => { if (r.ok && (!r.thumbnails.length || r.thumbnails.every((t) => t.status === "failed")) && !started.current) { started.current = true; startThumbnails(projectId).then(load); } }); }, [load, projectId]);
  const busy = s?.thumbnails?.some((t) => t.status === "queued" || t.status === "rendering");
  // Also poll while empty: the autopilot's batch appears a moment after the page opens.
  const empty = !!s && !s.thumbnails?.length;
  useEffect(() => { if (!busy && !empty) return; const id = setInterval(load, 3000); return () => clearInterval(id); }, [busy, empty, load]);
  const [regenerating, setRegenerating] = useState(false);
  const regenerate = async () => { setMsg(null); setRegenerating(true); const r = await startThumbnails(projectId, true); setRegenerating(false); if (!r.ok) setMsg(r.message); load(); };
  // No second batch while one is being made (the included one, or a paid regenerate).
  const generating = busy || empty || regenerating;
  const saveHeadline = async (t) => { const r = await setThumbnailHeadline(projectId, t.id, edit[t.id]); if (!r.ok) setMsg(r.message); else { setEdit((e) => { const { [t.id]: _x, ...rest } = e; return rest; }); load(); } };
  const selected = s?.thumbnails?.find((t) => t.selected) ?? s?.selected;
  return (
    <Card testid="thumbnails-card" title="Thumbnail" icon={ImageIcon}
      right={<button type="button" data-testid="thumbs-regenerate" disabled={generating} title={generating ? "Wait for these thumbnails to finish" : undefined} onClick={regenerate} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11.5px] font-semibold text-white/75 hover:bg-white/[0.08] disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" /> Regenerate 3 · {s?.regenerateCredits ?? "…"} credits</button>}>
      <div className="grid gap-3 sm:grid-cols-3">
        {(s?.thumbnails ?? []).map((t) => (
          <div key={t.id} data-testid="thumb" className={`grid min-w-0 grid-cols-1 gap-2 rounded-xl border p-1.5 ${t.selected ? "border-lime-300/70" : "border-white/[0.08]"}`}>
            <button type="button" onClick={() => t.status === "ready" && selectThumbnail(projectId, t.id).then(load)} className="relative block aspect-video w-full overflow-hidden rounded-lg bg-black">
              {t.status === "ready" ? <img src={t.pngUrl} alt="" className="h-full w-full object-cover" /> : t.status === "failed" ? <span className="grid h-full place-items-center text-[11px] text-red-200">Couldn't draw this one</span> : <span className="zyvo-shimmer absolute inset-0 grid place-items-center text-[11px] text-white/50"><Loader2 className="h-4 w-4 animate-spin" /></span>}
              {t.selected && <span className="absolute right-1.5 top-1.5 rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-bold text-[#11150D]">Picked</span>}
            </button>
            {t.status === "ready" && (
              <div className="flex gap-1">
                <input aria-label="Headline" value={edit[t.id] ?? t.headline ?? ""} maxLength={40} onChange={(e) => setEdit((x) => ({ ...x, [t.id]: e.target.value.toUpperCase() }))} className="min-h-[36px] min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 text-[12px] font-bold text-white outline-none focus:border-lime-300/50" />
                {edit[t.id] != null && <button type="button" onClick={() => saveHeadline(t)} className="min-h-[36px] rounded-lg bg-lime-300 px-2 text-[11px] font-bold text-[#11150D]">Save</button>}
              </div>
            )}
          </div>
        ))}
        {!s?.thumbnails?.length && [0, 1, 2].map((i) => <div key={i} data-testid="thumb-skeleton" className="min-w-0 rounded-xl border border-white/[0.08] p-1.5"><div className="zyvo-shimmer aspect-video rounded-lg bg-white/[0.04]" /><div className="zyvo-shimmer mt-2 h-9 rounded-lg bg-white/[0.04]" /></div>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {selected?.pngUrl && <a data-testid="thumb-download" href={selected.pngUrl} download="thumbnail.png" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-[13px] font-semibold text-white hover:bg-white/[0.09]"><Download className="h-4 w-4" /> Download thumbnail (PNG)</a>}
        <span className="text-[11.5px] text-white/40">{!s?.thumbnails?.length ? "Drawing 3 thumbnails from your video (included)…" : selected ? "1280×720, under 2 MB (YouTube's limit)." : "Tap one to pick it. Edit its headline for free (1–3 words)."}</span>
      </div>
      {msg && <p className="mt-2 text-[12px] text-red-200">{msg}</p>}
    </Card>
  );
}

function TextCard({ projectId }) {
  const [t, setT] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tagsText, setTagsText] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const started = useRef(false);
  const apply = (x) => { setT(x); setTagsText((x?.tags ?? []).join(", ")); setHashtagsText((x?.hashtags ?? []).join(" ")); };
  // Written server-side by the Publish autopilot: while it's being written, poll; a page opened without it writes it once.
  const [waiting, setWaiting] = useState(false);
  useEffect(() => { getYoutubeText(projectId).then((r) => { if (r.ok && r.text) apply(r.text); else if (r.ok && r.generating) setWaiting(true); else if (r.ok && !started.current) { started.current = true; setBusy(true); generateYoutubeText(projectId).then((g) => { setBusy(false); if (g.ok && g.text) apply(g.text); else if (g.ok && g.generating) setWaiting(true); else setMsg(g.message); }); } }); }, [projectId]);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => getYoutubeText(projectId).then((r) => { if (r.ok && r.text) { apply(r.text); setWaiting(false); } else if (r.ok && !r.generating) { setWaiting(false); setMsg("Couldn't write the YouTube text. Tap Rewrite to try again."); } }), 3000);
    return () => clearInterval(id);
  }, [waiting, projectId]);
  const save = async (patch) => { const r = await saveYoutubeText(projectId, patch); if (r.ok) apply(r.text); else setMsg(r.message); };
  const regenerate = async () => { setBusy(true); setMsg(null); const g = await generateYoutubeText(projectId); setBusy(false); if (g.ok) apply(g.text); else setMsg(g.message); };
  const description = t ? composeDescription(t) : "";
  const tags = limitTags(tagsText.split(","));
  const all = t ? `${t.title}\n\n${description}\n\nTags: ${tags.join(", ")}` : "";
  return (
    <Card testid="text-card" title="YouTube title, description & tags" icon={Type}
      right={<div className="flex gap-1.5">{t && <CopyBtn testid="copy-all" text={all} label="Copy all" />}<button type="button" disabled={busy} onClick={regenerate} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11.5px] font-semibold text-white/75 hover:bg-white/[0.08] disabled:opacity-40">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Rewrite</button></div>}>
      {!t ? (
        <div className="grid gap-3" data-testid="text-skeleton">
          <p className="flex items-center gap-2 text-[12.5px] text-white/50">{(busy || waiting) && <Loader2 className="h-4 w-4 animate-spin" />}Writing your title, description and tags…</p>
          {["h-11", "h-8 w-3/4", "h-16", "h-24", "h-12"].map((c, i) => <div key={i} className={`zyvo-shimmer rounded-lg bg-white/[0.04] ${c}`} />)}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between"><label className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">Title</label><span className="flex items-center gap-2 text-[11px] tabular-nums text-white/35">{t.title?.length ?? 0}/{TITLE_MAX}<CopyBtn text={t.title ?? ""} testid="copy-title" /></span></div>
            <input data-testid="yt-title" value={t.title ?? ""} maxLength={TITLE_MAX} onChange={(e) => setT({ ...t, title: e.target.value })} onBlur={() => save({ title: t.title })} className="min-h-[44px] rounded-lg border border-white/10 bg-black/30 px-3 text-[14px] font-semibold text-white outline-none focus:border-lime-300/50" />
            <div className="flex flex-wrap gap-1.5">{(t.alternatives ?? []).map((a) => <button key={a} type="button" onClick={() => save({ title: a })} className="min-h-[32px] rounded-full border border-white/10 bg-white/[0.03] px-3 text-left text-[11.5px] text-white/70 hover:border-lime-300/40">{a}</button>)}</div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between"><label className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">Description</label><CopyBtn text={description} testid="copy-description" /></div>
            <textarea data-testid="yt-hook" aria-label="Intro (hook, what we look at, the thesis)" value={t.hook ?? ""} rows={9} onChange={(e) => setT({ ...t, hook: e.target.value })} onBlur={() => save({ hook: t.hook })} className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[13px] text-white outline-none focus:border-lime-300/50" />
            <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5 text-[12px] leading-relaxed text-white/60">
              {t.chapters?.length ? t.chapters.map((c, i) => <div key={i} className="flex gap-2"><span className="w-12 shrink-0 tabular-nums text-white/40">{fmtChapter(c.ms)}</span><input aria-label={`Chapter ${i + 1}`} value={c.title} onChange={(e) => setT({ ...t, chapters: t.chapters.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} onBlur={() => save({ chapters: t.chapters })} className="min-w-0 flex-1 bg-transparent text-white/80 outline-none" /></div>) : <span className="text-white/40">No chapters (YouTube needs 3 or more sections of 10 s+).</span>}
              {t.sources?.length > 0 && <div className="mt-2 border-t border-white/[0.06] pt-2"><span className="text-white/40">Sources</span>{t.sources.map((s) => <div key={s.url} className="truncate">• {s.title ? `${s.title} — ` : ""}<a href={s.url} target="_blank" rel="noreferrer" className="text-lime-200/80 underline">{s.url}</a></div>)}</div>}
            </div>
            <textarea data-testid="yt-disclaimer" aria-label="Disclaimer" value={t.disclaimer ?? ""} rows={2} onChange={(e) => setT({ ...t, disclaimer: e.target.value })} onBlur={() => save({ disclaimer: t.disclaimer })} className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[12px] text-white/75 outline-none focus:border-lime-300/50" />
            <label className="flex min-h-[40px] items-center justify-between gap-2 text-[12px] text-white/65"><span>End with "🎬 Made with tryzyvo.com — turn any idea into a video like this"</span><input data-testid="yt-credit" type="checkbox" checked={t.includeCredit !== false} onChange={(e) => save({ includeCredit: e.target.checked })} className="h-4 w-4 accent-lime-300" /></label>
            <input data-testid="yt-hashtags" aria-label="Hashtags (3-5, at the very end)" value={hashtagsText} onChange={(e) => setHashtagsText(e.target.value)} onBlur={() => save({ hashtags: hashtagsText.split(/[\s,]+/).filter(Boolean) })} className="min-h-[40px] rounded-lg border border-white/10 bg-black/30 px-2.5 text-[12.5px] text-lime-100/80 outline-none focus:border-lime-300/50" />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between"><label className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">Tags</label><span className="flex items-center gap-2 text-[11px] tabular-nums text-white/35">{tags.join(",").length}/{TAGS_MAX_CHARS}<CopyBtn text={tags.join(", ")} testid="copy-tags" /></span></div>
            <textarea data-testid="yt-tags" value={tagsText} rows={2} onChange={(e) => setTagsText(e.target.value)} onBlur={() => save({ tags })} className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[12.5px] text-white outline-none focus:border-lime-300/50" />
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-[12px] text-red-200">{msg}</p>}
    </Card>
  );
}

export default function LongFormPublish() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  // Arrived via "Continue to Publish": the render is being started server-side.
  const autopilot = useLocation().state?.autopilot === true;
  useOverlayFont();
  const [project, setProject] = useState(cachedStickmanProject(projectId)?.project ?? null);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 767px)"); const on = () => setMobile(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  useEffect(() => { document.title = "Publish | Zyvo"; fetchLongFormProject(projectId).then((p) => p && setProject((o) => ({ ...(o ?? {}), ...p }))); }, [projectId]);
  const cards = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start" data-testid="publish-page">
      <div className="grid gap-4 lg:sticky lg:top-3"><RenderCard projectId={projectId} autopilot={autopilot} /></div>
      <div className="grid gap-4"><ThumbnailsCard projectId={projectId} /><TextCard projectId={projectId} /></div>
    </div>
  );
  if (mobile) return (
    <div className="pb-6" data-testid="publish-mobile">
      <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-white/[0.06] bg-[#0b0d0e]/95 px-1 backdrop-blur">
        <button type="button" aria-label="Back to Edit" onClick={() => navigate(`/long-form/project/${projectId}/edit`)} className="grid h-11 w-11 place-items-center rounded-full text-white/80"><ArrowLeft className="h-5 w-5" /></button>
        <span className="flex-1 text-[15px] font-bold text-white">Publish</span>
      </div>
      <div className="px-3 pt-3">{cards}</div>
    </div>
  );
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 pb-32 lg:px-8">
      <LongFormCreationHeader current="publish" project={project} stickman />
      <div className="mt-4">{cards}</div>
      <LongFormActionFooter secondaryLabel="Back to Edit" onSecondary={() => navigate(`/long-form/project/${projectId}/edit`)} maxWidthClassName="max-w-[880px]" />
    </div>
  );
}
