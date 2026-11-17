import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowRight, PlayCircle, X } from "lucide-react";
import { fetchShowcase, LONG_FORM_PREVIEW, showcaseThumb, trackLaunch } from "./launch";
import { BLOCKY_WORLDS_PATH } from "../../data/blockyWorlds";
import "./townAnnouncement.css";
import { tutorialFor, tutorialThumb } from "../../lib/tutorials";

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

// "New here? Watch the tutorial": the tool's newest tutorial from the one list (src/lib/tutorials.js); hidden
// until the tool has one.
export function TutorialCard({ tool = "long_form", className = "" }) {
  const t = tutorialFor(tool);
  if (!t) return null;
  const video = { id: t.url, title: t.title, youtube_url: t.url }, thumb = tutorialThumb(t);
  return (
    // A distinct "New here?" row: small heading, the thumbnail with a play icon, the title,
    // and "Watch the tutorial" (YouTube, new tab).
    <div className={`border-t border-white/[0.08] pt-3 ${className}`} data-testid="tutorial-row">
      <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">New here?</p>
      <a
        href={video.youtube_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackLaunch("tutorial_click", { placement: tool, target: video.youtube_url })}
        className="group flex items-center gap-3 rounded-[14px] p-2 transition hover:bg-white/[0.04]"
        data-testid="tutorial-card"
      >
        <div className="relative aspect-video w-[132px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.05] sm:w-[148px]">
          {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />}
          <span className="absolute inset-0 grid place-items-center bg-black/15"><PlayCircle className="h-9 w-9 text-white drop-shadow" strokeWidth={1.5} /></span>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">{video.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-lime-300 group-hover:text-lime-200"><YouTubeMark /> Watch the tutorial</p>
        </div>
      </a>
    </div>
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

export function WhatsNewModal({ onClose, onPreferenceChange }) {
  const navigate = useNavigate();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const tutorial = tutorialFor("in_this_town");
  const close = () => onClose(dontShowAgain);

  return (
    <Dialog open onClose={close} className="relative z-[300]">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="town-dialog-viewport">
        <DialogPanel data-testid="whats-new" className="town-dialog">
          <button type="button" aria-label="Close" onClick={close} className="town-dialog-close"><X size={19} /></button>
          <div className="town-dialog-art" aria-hidden="true">
            <img className="town-dialog-print town-dialog-back" src="/media/how-its-built/in-this-town-card-9x16-clean.webp" alt="" />
            <img className="town-dialog-print town-dialog-front" src="/blocky-worlds/showcase/milo.jpg" alt="" />
          </div>
          <div className="town-dialog-copy">
            <p className="town-dialog-kicker">New on Zyvo</p>
            <DialogTitle className="town-dialog-title">In This <em>Town.</em></DialogTitle>
            <p className="town-dialog-hook">“In this town, everyone has to tell the truth. Except the mayor.”</p>
            <p className="town-dialog-description">Give your town one strange rule. Turn it into a narrated, blocky story video with a twist.</p>
            <button type="button" data-testid="whats-new-try" className="town-dialog-make" onClick={() => { close(); navigate(BLOCKY_WORLDS_PATH); }}>
              Make my town video <ArrowRight size={18} />
            </button>
            {tutorial && <a className="town-dialog-tutorial" href={tutorial.url} target="_blank" rel="noopener noreferrer" onClick={close}><PlayCircle size={17} /> Watch the tutorial</a>}
            <label className="town-dialog-optout" data-testid="whats-new-dont-show">
              <input type="checkbox" checked={dontShowAgain} onChange={e => { setDontShowAgain(e.target.checked); onPreferenceChange(e.target.checked); }} />
              Don't show this again
            </label>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
