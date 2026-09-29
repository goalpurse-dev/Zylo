import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowRight, Clapperboard, PlayCircle, X } from "lucide-react";
import { fetchShowcase, LONG_FORM_PREVIEW, showcaseThumb, trackLaunch } from "./launch";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// A few seconds of a real Long Form render, muted and looping; a still image
// for reduced motion (and until the video can play).
export function LongFormPreview({ className = "" }) {
  const reduced = useReducedMotion();
  return (
    <div className={`relative aspect-video w-full max-w-full overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#15171a] ${className}`}>
      {reduced ? (
        <img src={LONG_FORM_PREVIEW.poster} alt="A scene from a Long Form video made with Zyvo" className="h-full w-full object-cover" data-testid="lf-preview-still" />
      ) : (
        <video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={LONG_FORM_PREVIEW.poster} aria-label="A few seconds of a Long Form video made with Zyvo" data-testid="lf-preview-video">
          <source src={LONG_FORM_PREVIEW.webm} type="video/webm" />
          <source src={LONG_FORM_PREVIEW.mp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

export function NewBadge({ className = "" }) {
  return <span className={`inline-flex items-center rounded-full bg-lime-300 px-1.5 py-px text-[8.5px] font-extrabold uppercase leading-[13px] tracking-[0.08em] text-[#11150D] ${className}`} data-testid="new-badge">New</span>;
}

function YouTubeMark({ className = "h-3.5 w-3.5" }) {
  return (
    <svg viewBox="0 0 24 17" className={className} aria-hidden="true">
      <rect width="24" height="17" rx="4.5" fill="#FF0033" />
      <path d="M9.6 4.8v7.4l6.2-3.7z" fill="#fff" />
    </svg>
  );
}

function ShowcaseCard({ video, placement }) {
  const thumb = showcaseThumb(video);
  return (
    <a
      href={video.youtube_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackLaunch("showcase_click", { placement, target: video.youtube_url, videoId: video.id, title: video.title })}
      className="group flex w-[78%] shrink-0 snap-start flex-col gap-2.5 sm:w-[300px]"
      data-testid="showcase-card"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.04]">
        {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />}
        <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
          <PlayCircle className="h-11 w-11 text-white drop-shadow" strokeWidth={1.5} />
        </span>
      </div>
      <div className="px-0.5">
        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">{video.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium text-white/45 transition group-hover:text-white/70">
          <YouTubeMark /> Watch on YouTube
        </p>
      </div>
    </a>
  );
}

// A swipeable row of showcase cards; renders nothing when there are no active rows.
export function ShowcaseRow({ placement, title, subtitle, id, className = "" }) {
  const [videos, setVideos] = useState(null);
  useEffect(() => { let live = true; fetchShowcase(placement).then((v) => live && setVideos(v)); return () => { live = false; }; }, [placement]);
  if (!videos?.length) return null;
  return (
    <section id={id} className={`scroll-mt-24 ${className}`} data-testid={`showcase-${placement}`}>
      <div className="mb-3 px-1">
        <h2 className="text-balance text-[17px] font-bold tracking-[-0.01em] text-white lg:text-[19px]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-white/40">{subtitle}</p>}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
        {videos.map((v) => <ShowcaseCard key={v.id} video={v} placement={placement} />)}
      </div>
    </section>
  );
}

// "Watch the tutorial" — the first active tutorial; hidden until one exists.
export function TutorialCard({ className = "" }) {
  const [video, setVideo] = useState(null);
  useEffect(() => { let live = true; fetchShowcase("long_form", "tutorial").then((v) => live && setVideo(v[0] ?? null)); return () => { live = false; }; }, []);
  if (!video) return null;
  const thumb = showcaseThumb(video);
  return (
    <a
      href={video.youtube_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackLaunch("tutorial_click", { placement: "long_form", target: video.youtube_url, videoId: video.id })}
      className={`group flex items-center gap-4 rounded-[16px] border border-white/[0.08] bg-white/[0.03] p-3 transition hover:border-white/[0.16] hover:bg-white/[0.05] ${className}`}
      data-testid="tutorial-card"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-[10px] bg-white/[0.05] sm:w-40">
        {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <span className="absolute inset-0 grid place-items-center"><PlayCircle className="h-8 w-8 text-white/90 drop-shadow" strokeWidth={1.5} /></span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-300/80">Watch the tutorial</p>
        <p className="mt-1 line-clamp-2 text-[14px] font-semibold text-white">{video.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/45"><YouTubeMark /> Watch on YouTube</p>
      </div>
    </a>
  );
}

// Home launch banner.
export function LongFormLaunchBanner() {
  const navigate = useNavigate();
  const tryIt = () => { trackLaunch("try_long_form", { placement: "home_banner" }); navigate("/long-form"); };
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(135deg,#151a10_0%,#111315_55%,#0d0e10_100%)] p-5 sm:p-7" data-testid="lf-launch-banner">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/50 to-transparent" />
      <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-lime-300/10 blur-3xl" />
      <div className="relative grid items-center gap-5 md:grid-cols-[1fr_minmax(0,420px)] md:gap-8">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-lime-300">
            <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] text-[#11150D]">New</span> Long Form
          </p>
          <h2 className="mt-3 text-balance text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white sm:text-[30px]">
            Full YouTube explainer videos from one idea
          </h2>
          <p className="mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-white/55">
            Research, script, voiceover, 2D cartoon scenes and a thumbnail — ready to upload.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={tryIt} className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-[14px] font-bold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]" data-testid="try-long-form">
              Try Long Form <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#made-with-zyvo" onClick={(e) => { e.preventDefault(); trackLaunch("see_examples", { placement: "home_banner" }); document.getElementById("made-with-zyvo")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }} className="text-[13px] font-semibold text-white/60 underline-offset-4 transition hover:text-white hover:underline">See examples</a>
          </div>
        </div>
        <LongFormPreview />
      </div>
    </section>
  );
}

// "What's new" — shown once per user (the layout decides when).
export function WhatsNewModal({ open, onClose }) {
  const navigate = useNavigate();
  const go = (event, path) => { trackLaunch(event, { placement: "whats_new" }); onClose(); navigate(path); };
  return (
    <Dialog open={open} onClose={() => { trackLaunch("whats_new_dismiss", { placement: "whats_new" }); onClose(); }} className="relative z-[300]">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-[6px]" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel className="relative w-full max-w-[460px] overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#121416] p-5 shadow-[0_24px_80px_rgba(0,0,0,.6)] sm:p-6" data-testid="whats-new">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/60 to-transparent" />
          <button type="button" aria-label="Close" onClick={() => { trackLaunch("whats_new_dismiss", { placement: "whats_new" }); onClose(); }} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/55 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-lime-300"><Clapperboard className="h-3.5 w-3.5" /> What's new</p>
          <DialogTitle className="mt-2 text-[21px] font-extrabold tracking-[-0.02em] text-white">Long Form is here</DialogTitle>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">Turn one idea into a full YouTube explainer video — script, voice, scenes and thumbnail.</p>
          <LongFormPreview className="mt-4" />
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => go("whats_new_examples", "/long-form#made-with-zyvo")} className="rounded-xl border border-white/[0.12] px-4 py-2.5 text-[13.5px] font-semibold text-white/80 transition hover:bg-white/[0.06] hover:text-white">See examples</button>
            <button type="button" onClick={() => go("try_long_form", "/long-form")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-[13.5px] font-bold text-[#11150D] transition hover:bg-lime-200" data-testid="whats-new-try">Try Long Form <ArrowRight className="h-4 w-4" /></button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
