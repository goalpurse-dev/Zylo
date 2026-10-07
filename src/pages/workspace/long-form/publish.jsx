// publish.jsx — The Stickman Publish step: watch and download the FULL render
// (1080p, plus 1440p on request), pick a thumbnail, copy the YouTube title /
// description / tags. Everything is server-driven: leave and come back (or
// refresh), finished work is shown as it is and nothing restarts. Desktop:
// two columns; phones: one column, a slim top bar (no footer), like the editor.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, Copy, Download, Film, Image as ImageIcon, Loader2, RefreshCw, RotateCcw, Sparkles, Type, X } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { CreditsError, LongFormActionFooter, LongFormCreationHeader } from "./shared";
import { cachedStickmanProject } from "./StickmanRouteGuard";
import { useOverlayFont } from "./sceneVisuals";
import { fileSlug, limitTags, TITLE_MAX, TAGS_MAX_CHARS } from "../../../lib/publishText";
import { renderStatus, startRender, startPublish, downloadRender, listThumbnails, startThumbnails, retryThumbnails, setThumbnailHeadline, selectThumbnail, getYoutubeText, generateYoutubeText, saveYoutubeText } from "./publish/publishApi";

const STAGE = { queued: "Waiting for a render machine…", drawing: "Drawing the text and captions…", rendering: "Rendering the scenes…", finishing: "Joining the scenes and the voice…", uploading: "Uploading your video…" };
const mins = (s) => (s < 90 ? `${Math.max(1, Math.round(s / 10) * 10)} s` : `${Math.round(s / 60)} min`);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const LIME_BTN = "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 text-[15px] font-bold text-[#11150D] shadow-[0_0_40px_rgba(190,242,100,0.18)] hover:bg-lime-200 disabled:opacity-60";
const GHOST_BTN = "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-[14px] font-semibold text-white hover:bg-white/[0.09] disabled:opacity-60";
// Save a file at once (no new tab): fetch -> blob -> a[download]. Storage is another
// origin, where the download attribute alone is ignored; if the fetch fails, open it.
async function downloadFile(url, name) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const href = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement("a"), { href, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch { window.open(url, "_blank", "noopener"); }
}
const SMALL_BTN = "inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11.5px] font-semibold text-white/75 hover:bg-white/[0.08] disabled:opacity-40";

function Card({ title, icon: Icon, children, right, testid }) {
  return (
    <section data-testid={testid} className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#121416] p-4 sm:p-5">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-lime-300" />
        <h2 className="min-w-0 flex-1 text-[15px] font-bold text-white">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
function CopyBtn({ text, label = "Copy", testid, className = SMALL_BTN }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" data-testid={testid} onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }} className={className}>
      {done ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />}{done ? "Copied" : label}
    </button>
  );
}

// ======================================================= the video

// The autopilot starts the 1080p render server-side; its job row appears after
// the edit is compiled (up to about a minute), so the page waits for it.
const AUTOPILOT_WAIT_MS = 120_000;

// The player plays the FULL render (a faststart MP4 starts at once); the 360p
// proxy is only its fallback if the full file can't load.
function Player({ video }) {
  const [src, setSrc] = useState(video.videoUrl ?? video.previewUrl);
  useEffect(() => { setSrc(video.videoUrl ?? video.previewUrl); }, [video.videoUrl, video.previewUrl]);
  return <video data-testid="publish-player" data-quality={src === video.videoUrl ? video.resolution : "360p"} src={src} controls playsInline preload="metadata" onError={() => { if (src !== video.previewUrl && video.previewUrl) setSrc(video.previewUrl); }} className="h-full w-full" />;
}

function RenderCard({ projectId, autopilot }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [since] = useState(() => Date.now());
  const load = useCallback(async () => { const r = await renderStatus(projectId); if (r.ok) setState(r); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const job = state?.job;
  const byRes = state?.doneByRes ?? {};
  const cur1080 = byRes["1080p"] ?? null, cur1440 = byRes["1440p"] ?? null;
  const live = job && ["queued", "rendering"].includes(job.status);
  // A 1440p render next to a finished 1080p of the same edit is an UPGRADE, not a re-render.
  const upgrading = live && job.resolution === "1440p" && !!cur1080;
  const hasCurrent = job && job.status !== "failed" && job.editVersion === job.latestEditVersion;
  const [starting, setStarting] = useState(!!autopilot);
  useEffect(() => { if (starting && state && (hasCurrent || cur1080 || Date.now() - since > AUTOPILOT_WAIT_MS)) setStarting(false); }, [starting, state, hasCurrent, cur1080, since]);
  useEffect(() => { if (!live && !starting) return; const id = setInterval(load, 3000); return () => clearInterval(id); }, [live, starting, load]);
  // Opened with no render at all (from a project card, not from the editor's
  // "Continue to Publish"): start the render, the YouTube text and the
  // thumbnails once, server-side. The server makes the edit from the scenes if
  // the editor was never opened. A failed or an outdated render is never
  // restarted from here: those keep their own button.
  const kicked = useRef(false);
  useEffect(() => {
    if (!state || kicked.current || autopilot || state.job || state.lastDone) return;
    kicked.current = true;
    setStarting(true);
    startPublish(projectId).then(load);
  }, [state, autopilot, projectId, load]);
  const start = async (resolution) => { setBusy(true); setMsg(null); const r = await startRender(projectId, resolution); setBusy(false); if (!r.ok) setMsg(r.message); load(); };
  const download = async (j) => { const r = await downloadRender(projectId, j.id); if (r.ok) window.location.href = r.url; else setMsg(r.message); };
  const current = cur1440 || cur1080;
  // An older finished render (a previous edit version), when nothing current exists.
  const previous = !current ? (job?.status === "done" ? job : state?.lastDone) : null;
  const video = cur1440 ?? cur1080 ?? previous;
  // ONE status box at a time: error > rendering > stale edits (an upgrade has its own small row).
  const status = (live && !upgrading) || (starting && !current) ? "rendering" : job?.status === "failed" && !current ? "failed" : previous?.outdated ? "stale" : null;
  return (
    <Card testid="render-card" title="Your video" icon={Film}>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {video?.videoUrl || video?.previewUrl ? <Player video={video} />
          : <div className="grid h-full place-items-center px-4 text-center text-[13px] text-white/45">{status === "rendering" ? "Your video is being rendered…" : "Render your video to watch it here."}</div>}
      </div>
      {/* A render that failed on our side is being fixed and starts again by itself: calm words, never a raw error. */}
      {status === "failed" && job.fixing && <div data-testid="render-fixing" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-[12.5px] text-amber-100"><RefreshCw className="mt-px h-4 w-4 shrink-0" /><span>{job.reason}</span></div>}
      {status === "failed" && !job.fixing && <div data-testid="render-failed" className="mt-3 flex items-start gap-2 rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-[12.5px] text-red-100"><AlertTriangle className="mt-px h-4 w-4 shrink-0" /><span>{job.reason} <span className="text-red-200/70">Retry is free.</span></span></div>}
      {status === "rendering" && (live ? (
        <div className="mt-3 grid gap-2" data-testid="render-progress">
          <div className="flex justify-between text-[12.5px] text-white/70"><span>{STAGE[job.stage] ?? "Rendering…"}</span><span className="tabular-nums">{job.progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-[width] duration-700" style={{ width: `${Math.max(2, job.progress)}%` }} /></div>
          <div className="flex flex-wrap justify-between gap-x-3 text-[11.5px] text-white/45"><span>{job.etaSeconds ? `About ${mins(job.etaSeconds[0])}–${mins(job.etaSeconds[1])} left` : ""}</span><span className="tabular-nums">{job.status === "rendering" ? `Rendering for ${clock(job.elapsedSeconds)}` : `Queued ${clock(job.queuedSeconds)}`}</span></div>
          <p className="text-[11.5px] text-white/40">You can leave this page — the render keeps going and this page shows it when you come back.</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-2" data-testid="render-starting">
          <div className="flex items-center gap-2 text-[12.5px] text-white/70"><Loader2 className="h-4 w-4 animate-spin text-lime-300" /> Starting your render (1080p, included)…</div>
          <div className="zyvo-shimmer h-2 rounded-full bg-white/10" />
        </div>
      ))}
      {status === "stale" && <div data-testid="render-outdated" className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[12.5px] text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" /> Your edits aren't in this video yet. Render it again to include them (free).</div>}
      <div className="mt-3 grid gap-2.5">
        {cur1440 && <button type="button" data-testid="download-1440" onClick={() => download(cur1440)} className={LIME_BTN}><Download className="h-5 w-5" /> Download 1440p <span className="text-[12.5px] font-semibold opacity-70">best for YouTube</span></button>}
        {cur1080 && <button type="button" data-testid="download-full" onClick={() => download(cur1080)} className={cur1440 ? GHOST_BTN : LIME_BTN}><Download className={cur1440 ? "h-4 w-4" : "h-5 w-5"} /> {cur1440 ? "Download 1080p" : "Download video (1080p)"}</button>}
        {cur1080 && !cur1440 && (upgrading ? (
          <div data-testid="upgrade-progress" className="grid gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2">
            <div className="flex justify-between text-[12px] text-white/70"><span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-lime-300" /> Making 1440p…</span><span className="tabular-nums">{job.progress}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300/80 transition-[width] duration-700" style={{ width: `${Math.max(2, job.progress)}%` }} /></div>
          </div>
        ) : (
          <button type="button" data-testid="make-1440p" disabled={busy || live} onClick={() => start("1440p")} className={GHOST_BTN}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Make 1440p version <span data-testid="price-1440" className="text-[11.5px] font-normal text-white/45">sharper on YouTube · {state?.price1440 === 0 ? "free on V4" : state?.price1440 ? `${state.price1440} credits` : "…"}</span>
          </button>
        ))}
        {!current && status !== "rendering" && (
          <button type="button" data-testid="render-button" disabled={busy} onClick={() => start("1080p")} className={LIME_BTN}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : status === "failed" ? <RefreshCw className="h-5 w-5" /> : <Film className="h-5 w-5" />}
            {status === "failed" ? "Retry (free)" : "Render video"}
          </button>
        )}
        {previous && <button type="button" data-testid="download-previous" onClick={() => download(previous)} className="inline-flex items-center gap-1.5 justify-self-start text-[12.5px] font-semibold text-white/55 underline decoration-white/20 underline-offset-4 hover:text-white"><Download className="h-3.5 w-3.5" /> Download previous version ({previous.resolution})</button>}
      </div>
      <CreditsError message={msg} className="mt-2 text-[12px] text-red-200" />
    </Card>
  );
}

// ======================================================= thumbnails

function ThumbModal({ t, projectId, onClose, onChanged, slug }) {
  const [headline, setHeadline] = useState(t.headline ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const save = async () => { setSaving(true); setMsg(null); const r = await setThumbnailHeadline(projectId, t.id, headline); setSaving(false); if (!r.ok) setMsg(r.message); else onChanged(); };
  const pick = async () => { await selectThumbnail(projectId, t.id); onChanged(); onClose(); };
  return (
    <div data-testid="thumb-modal" role="dialog" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="grid w-full max-w-[960px] gap-3 rounded-2xl border border-white/10 bg-[#121416] p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><span className="text-[13px] font-bold text-white">Thumbnail preview</span><button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10"><X className="h-5 w-5" /></button></div>
        <img src={t.fullUrl ?? t.pngUrl} alt="" className="aspect-video w-full rounded-lg bg-black object-cover" />
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Headline" value={headline} maxLength={40} onChange={(e) => setHeadline(e.target.value.toUpperCase())} className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-[13px] font-bold text-white outline-none focus:border-lime-300/50" />
          <button type="button" disabled={saving || headline === t.headline} onClick={save} className={SMALL_BTN}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save headline</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={pick} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-lime-300 px-4 text-[13.5px] font-bold text-[#11150D] hover:bg-lime-200"><Check className="h-4 w-4" /> Use this thumbnail</button>
          <button type="button" data-testid="modal-download-720" onClick={() => downloadFile(t.pngUrl, `${slug}-thumbnail.png`)} className={GHOST_BTN}><Download className="h-4 w-4" /> 1280×720</button>
          {t.fullUrl && <button type="button" onClick={() => downloadFile(t.fullUrl, `${slug}-thumbnail-1920x1080.jpg`)} className={GHOST_BTN}><Download className="h-4 w-4" /> 1920×1080</button>}
        </div>
        <p className="text-[11.5px] text-white/40">Edit the headline for free (1–3 words, 4 for a question). The 1280×720 file is under YouTube's 2 MB limit.</p>
        {msg && <p className="text-[12px] text-red-200">{msg}</p>}
      </div>
    </div>
  );
}

function ThumbnailsCard({ projectId, slug }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(null);
  const [acting, setActing] = useState(false);
  const asked = useRef(false);
  const load = useCallback(async () => { const r = await listThumbnails(projectId); if (r.ok) setS(r); return r; }, [projectId]);
  // First open with nothing made yet: ask for the included batch once (the autopilot usually already did).
  useEffect(() => { load().then((r) => { if (r.ok && !r.thumbnails.length && !asked.current) { asked.current = true; startThumbnails(projectId).then(load); } }); }, [load, projectId]);
  const thumbs = s?.thumbnails ?? [];
  const busy = thumbs.some((t) => t.status === "queued" || t.status === "rendering");
  const empty = !!s && !thumbs.length;
  useEffect(() => { if (!busy && !empty) return; const id = setInterval(load, 3000); return () => clearInterval(id); }, [busy, empty, load]);
  const anyFailed = thumbs.some((t) => t.status === "failed");
  const allReady = thumbs.length > 0 && thumbs.every((t) => t.status === "ready");
  const retry = async (id) => { setActing(true); setMsg(null); const r = await retryThumbnails(projectId, id); setActing(false); if (!r.ok) setMsg(r.message); load(); };
  const regenerate = async () => { setActing(true); setMsg(null); const r = await startThumbnails(projectId, true); setActing(false); if (!r.ok) setMsg(r.message); load(); };
  const selected = thumbs.find((t) => t.selected) ?? s?.selected;
  // Failed ones are retried free; the paid "Regenerate 3" only when all 3 are there and you want new ones.
  const headerBtn = anyFailed
    ? <button type="button" data-testid="thumbs-retry-all" disabled={acting || busy} onClick={() => retry()} className={SMALL_BTN}><RotateCcw className="h-3.5 w-3.5" /> Try all again · free</button>
    : <button type="button" data-testid="thumbs-regenerate" disabled={!allReady || acting} title={!allReady ? "Wait for these thumbnails to finish" : undefined} onClick={regenerate} className={SMALL_BTN}><RefreshCw className="h-3.5 w-3.5" /> Regenerate 3 · {s?.regenerateCredits ?? "…"} credits</button>;
  const tile = (t) => (
    <div key={t.id} data-testid="thumb" className={`relative min-w-0 overflow-hidden rounded-lg border ${t.selected ? "border-lime-300/80" : "border-white/[0.08]"} max-md:w-[72%] max-md:shrink-0 max-md:snap-start`}>
      {t.status === "ready" ? (
        <button type="button" onClick={() => setOpen(t)} aria-label={`Preview "${t.headline}"`} className="block aspect-video w-full bg-black"><img src={t.pngUrl} alt="" className="h-full w-full object-cover" loading="lazy" /></button>
      ) : t.status === "failed" ? (
        <div className="grid aspect-video w-full place-items-center gap-1 bg-black/40 p-2 text-center">
          <span className="text-[11px] text-red-200/90">Couldn't draw this one</span>
          <button type="button" data-testid="thumb-retry" disabled={acting} onClick={() => retry(t.id)} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[11px] font-semibold text-white hover:bg-white/15 disabled:opacity-50"><RotateCcw className="h-3 w-3" /> Try again · free</button>
        </div>
      ) : <div className="zyvo-shimmer grid aspect-video w-full place-items-center bg-white/[0.04]"><Loader2 className="h-4 w-4 animate-spin text-white/50" /></div>}
      {t.selected && <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-lime-300 px-1.5 py-0.5 text-[9.5px] font-bold text-[#11150D]">Picked</span>}
    </div>
  );
  return (
    <Card testid="thumbnails-card" title="Thumbnail" icon={ImageIcon} right={headerBtn}>
      {/* Desktop: 3 small tiles in a row. Phones: a swipeable row. */}
      <div data-testid="thumb-row" className="grid grid-cols-3 gap-2 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto max-md:pb-1">
        {thumbs.length ? thumbs.map(tile) : [0, 1, 2].map((i) => <div key={i} data-testid="thumb-skeleton" className="zyvo-shimmer aspect-video min-w-0 rounded-lg bg-white/[0.04] max-md:w-[72%] max-md:shrink-0" />)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {selected?.pngUrl && <button type="button" data-testid="thumb-download" onClick={() => downloadFile(selected.pngUrl, `${slug}-thumbnail.png`)} className={GHOST_BTN}><Download className="h-4 w-4" /> Download thumbnail</button>}
        <span className="text-[11.5px] text-white/40">{empty ? "Drawing 3 thumbnails from your video (included)…" : busy ? "Drawing…" : selected ? "1280×720 PNG, under 2 MB." : "Tap one to preview, edit its headline and pick it."}</span>
      </div>
      <CreditsError message={msg} className="mt-2 text-[12px] text-red-200" />
      {open && <ThumbModal t={open} slug={slug} projectId={projectId} onClose={() => setOpen(null)} onChanged={load} />}
    </Card>
  );
}

// ======================================================= title, description, tags

function useAutoHeight(ref, value) {
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; }, [ref, value]);
}
function Toggle({ label, on, onChange, testid }) {
  return (
    <button type="button" role="switch" aria-checked={on} data-testid={testid} onClick={() => onChange(!on)} className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold ${on ? "border-lime-300/50 bg-lime-300/10 text-lime-100" : "border-white/10 bg-transparent text-white/45"}`}>
      <span className={`h-2 w-2 rounded-full ${on ? "bg-lime-300" : "bg-white/25"}`} />{label}
    </button>
  );
}

function TextCard({ projectId, onTitle }) {
  const [t, setT] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tagsText, setTagsText] = useState("");
  const [desc, setDesc] = useState("");
  const descRef = useRef(null);
  useAutoHeight(descRef, desc);
  const asked = useRef(false);
  const apply = (x) => { setT(x); setTagsText((x?.tags ?? []).join(", ")); setDesc(x?.description ?? ""); if (x?.title) onTitle?.(x.title); };
  // Written server-side by the Publish autopilot: while it's being written, poll; a page opened without any text writes it once.
  const [waiting, setWaiting] = useState(false);
  useEffect(() => { getYoutubeText(projectId).then((r) => { if (r.ok && r.text) apply(r.text); else if (r.ok && r.generating) setWaiting(true); else if (r.ok && !asked.current) { asked.current = true; setBusy(true); generateYoutubeText(projectId).then((g) => { setBusy(false); if (g.ok && g.text) apply(g.text); else if (g.ok && g.generating) setWaiting(true); else setMsg(g.message); }); } }); }, [projectId]);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => getYoutubeText(projectId).then((r) => { if (r.ok && r.text) { apply(r.text); setWaiting(false); } else if (r.ok && !r.generating) { setWaiting(false); setMsg("Couldn't write the YouTube text. Tap Rewrite to try again."); } }), 3000);
    return () => clearInterval(id);
  }, [waiting, projectId]);
  const save = async (patch) => { const r = await saveYoutubeText(projectId, patch); if (r.ok) apply(r.text); else setMsg(r.message); };
  const regenerate = async () => { setBusy(true); setMsg(null); const g = await generateYoutubeText(projectId); setBusy(false); if (g.ok) apply(g.text); else setMsg(g.message); };
  const saveDesc = () => { if (!t || desc === t.description) return; save({ description: desc === t.generatedDescription ? null : desc }); };
  const tags = limitTags(tagsText.split(","));
  const all = t ? `${t.title}\n\n${desc}\n\nTags: ${tags.join(", ")}` : "";
  return (
    <Card testid="text-card" title="YouTube title, description & tags" icon={Type}
      right={<div className="flex gap-1.5">{t && <CopyBtn testid="copy-all" text={all} label="Copy all" />}<button type="button" disabled={busy} onClick={regenerate} className={SMALL_BTN}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Rewrite</button></div>}>
      {!t ? (
        <div className="grid gap-3" data-testid="text-skeleton">
          <p className="flex items-center gap-2 text-[12.5px] text-white/50">{(busy || waiting) && <Loader2 className="h-4 w-4 animate-spin" />}Writing your title, description and tags…</p>
          {["h-11", "h-8 w-3/4", "h-40", "h-12"].map((c, i) => <div key={i} className={`zyvo-shimmer rounded-lg bg-white/[0.04] ${c}`} />)}
        </div>
      ) : (
        <div className="grid min-w-0 gap-4">
          <div className="grid min-w-0 gap-1.5">
            <div className="flex items-center justify-between gap-2"><label htmlFor="yt-title" className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">Title</label><span className="flex items-center gap-2 text-[11px] tabular-nums text-white/35">{t.title?.length ?? 0}/{TITLE_MAX}<CopyBtn text={t.title ?? ""} testid="copy-title" /></span></div>
            <input id="yt-title" data-testid="yt-title" value={t.title ?? ""} maxLength={TITLE_MAX} onChange={(e) => setT({ ...t, title: e.target.value })} onBlur={() => save({ title: t.title })} className="min-h-[44px] min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 text-[14px] font-semibold text-white outline-none focus:border-lime-300/50" />
            <div className="flex flex-wrap gap-1.5">{(t.alternatives ?? []).map((a) => <button key={a} type="button" onClick={() => save({ title: a })} className="min-h-[32px] max-w-full rounded-full border border-white/10 bg-white/[0.03] px-3 text-left text-[11.5px] text-white/70 hover:border-lime-300/40">{a}</button>)}</div>
          </div>
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="yt-description" className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">Description</label>
              <div className="flex flex-wrap gap-1.5">
                <Toggle testid="toggle-chapters" label="Chapters" on={t.includeChapters !== false} onChange={(v) => save({ includeChapters: v })} />
                <Toggle testid="toggle-sources" label="Sources" on={t.includeSources !== false} onChange={(v) => save({ includeSources: v })} />
                <Toggle testid="toggle-zyvo" label="Zyvo line" on={t.includeCredit !== false} onChange={(v) => save({ includeCredit: v })} />
              </div>
            </div>
            {t.edited && <p className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-amber-100/80">You edited this text — the toggles apply to the generated version. <button type="button" data-testid="reset-description" onClick={() => save({ description: null })} className="font-semibold text-lime-200 underline underline-offset-2">Reset to generated</button></p>}
            <div className="relative min-w-0">
              {/* The Copy button stays at the field's top-right while you scroll through it. */}
              <div className="sticky top-16 z-10 flex h-0 justify-end pr-2 pt-2"><CopyBtn testid="copy-description" text={desc} className={`${SMALL_BTN} bg-[#1b1e21]`} /></div>
              <textarea id="yt-description" ref={descRef} data-testid="yt-description" value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={saveDesc} spellCheck={false}
                className="block w-full min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/30 p-3 pr-24 text-[13px] leading-relaxed text-white outline-none focus:border-lime-300/50" />
            </div>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <div className="flex items-center justify-between gap-2"><label htmlFor="yt-tags" className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">Tags</label><span className="flex items-center gap-2 text-[11px] tabular-nums text-white/35">{tags.join(",").length}/{TAGS_MAX_CHARS}<CopyBtn text={tags.join(", ")} testid="copy-tags" /></span></div>
            <textarea id="yt-tags" data-testid="yt-tags" value={tagsText} rows={3} onChange={(e) => setTagsText(e.target.value)} onBlur={() => save({ tags })} className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-2.5 text-[12.5px] text-white outline-none focus:border-lime-300/50" />
          </div>
        </div>
      )}
      <CreditsError message={msg} className="mt-2 text-[12px] text-red-200" />
    </Card>
  );
}

// ======================================================= page

export default function LongFormPublish() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  // Arrived via "Continue to Publish": the render is being started server-side.
  const autopilot = useLocation().state?.autopilot === true;
  useOverlayFont();
  const [project, setProject] = useState(cachedStickmanProject(projectId)?.project ?? null);
  const [ytTitle, setYtTitle] = useState(null);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 767px)"); const on = () => setMobile(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  useEffect(() => { document.title = "Publish | Zyvo"; fetchLongFormProject(projectId).then((p) => p && setProject((o) => ({ ...(o ?? {}), ...p }))); }, [projectId]);
  const cards = (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start" data-testid="publish-page">
      <div className="grid min-w-0 gap-4 lg:sticky lg:top-3"><RenderCard projectId={projectId} autopilot={autopilot} /></div>
      <div className="grid min-w-0 gap-4"><ThumbnailsCard projectId={projectId} slug={fileSlug(ytTitle ?? project?.selected_title ?? "zyvo-video")} /><TextCard projectId={projectId} onTitle={setYtTitle} /></div>
    </div>
  );
  if (mobile) return (
    <div className="overflow-x-hidden pb-6" data-testid="publish-mobile">
      <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-white/[0.06] bg-[#0b0d0e]/95 px-1 backdrop-blur">
        <button type="button" aria-label="Back to Edit" onClick={() => navigate(`/long-form/project/${projectId}/edit`)} className="grid h-11 w-11 place-items-center rounded-full text-white/80"><ArrowLeft className="h-5 w-5" /></button>
        <span className="flex-1 text-[15px] font-bold text-white">Publish</span>
      </div>
      <div className="px-3 pt-3">{cards}</div>
    </div>
  );
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1280px] px-4 py-6 pb-32 lg:px-8">
      <LongFormCreationHeader current="publish" project={project} stickman />
      <div className="mt-4 min-w-0">{cards}</div>
      <LongFormActionFooter secondaryLabel="Back to Edit" onSecondary={() => navigate(`/long-form/project/${projectId}/edit`)} maxWidthClassName="max-w-[880px]" />
    </div>
  );
}
