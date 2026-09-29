import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowRight, Clapperboard, FileText, Images, Lightbulb, Mic, PlayCircle, X } from "lucide-react";
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

// "What's new" — shown once per user (the layout decides when). Three real
// f90160bc thumbnails deal in like cards, the five steps light up once, then
// only a slow float remains; reduced motion shows the finished state.
const SHOWCASE_STORAGE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase`;
const FAN = [`${SHOWCASE_STORAGE}/launch/spear-or-patience.jpg`, `${SHOWCASE_STORAGE}/launch/how-did-this-kill.jpg`, `${SHOWCASE_STORAGE}/launch/what-does-it-prove.jpg`];
const PROOF = [[Lightbulb, "Idea"], [FileText, "Script"], [Mic, "Voice"], [Clapperboard, "150 scenes"], [Images, "Thumbnails"]];
const CHIPS = ["8–15 min", "Voice + captions", "3 thumbnails", "YouTube-ready"];
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
const FAN_POSE = ["translateX(-66%) translateY(8px) rotate(-8deg)", "scale(1.14)", "translateX(66%) translateY(8px) rotate(8deg)"];
const WN_CSS = `
.wn-deal{opacity:0;transform:translateY(46px) scale(.82);animation:wnDeal .62s cubic-bezier(.34,1.5,.64,1) forwards}
@keyframes wnDeal{60%{opacity:1}to{opacity:1;transform:none}}
.wn-float{animation:wnFloat 6s ease-in-out infinite}
@keyframes wnFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.wn-step{animation:wnLit .35s ease-out forwards}
@keyframes wnLit{to{background:rgba(190,242,100,.12);border-color:rgba(190,242,100,.5);color:#BEF264}}
.wn-label{animation:wnLabel .35s ease-out forwards}
@keyframes wnLabel{to{color:rgba(255,255,255,.9)}}
.wn-link::after{content:"";position:absolute;inset:0;background:#BEF264;transform:scaleX(0);transform-origin:left;animation:wnFill .3s ease-out forwards;animation-delay:inherit}
@keyframes wnFill{to{transform:scaleX(1)}}
.wn-card{transition:transform .28s cubic-bezier(.2,.8,.2,1),box-shadow .28s}
@media (hover:hover){.wn-slot:hover{z-index:20!important}.wn-slot:hover .wn-card{transform:translateY(-12px) scale(1.06);box-shadow:0 24px 50px rgba(0,0,0,.6),0 0 0 1px rgba(190,242,100,.45)}}
.wn-still .wn-deal,.wn-still .wn-float{animation:none;opacity:1;transform:none}
.wn-still .wn-step{animation:none;background:rgba(190,242,100,.12);border-color:rgba(190,242,100,.5);color:#BEF264}
.wn-still .wn-label{animation:none;color:rgba(255,255,255,.9)}
.wn-still .wn-link::after{animation:none;transform:scaleX(1)}
`;

export function WhatsNewModal({ open, onClose }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [huntUrl, setHuntUrl] = useState(null);
  useEffect(() => {
    if (!open) return;
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    fetchShowcase("home").then((rows) => setHuntUrl(rows.find((r) => /hunt/i.test(r.title))?.youtube_url ?? null));
  }, [open]);
  const close = () => { trackLaunch("whats_new_dismiss", { placement: "whats_new" }); onClose(); };
  const make = () => { trackLaunch("try_long_form", { placement: "whats_new" }); onClose(); navigate("/long-form/create"); };
  const stepDelay = (k) => `${(1.0 + k * 0.3).toFixed(2)}s`;
  return (
    <Dialog open={open} onClose={close} className="relative z-[300]">
      <style>{WN_CSS}</style>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4">
        <DialogPanel
          data-testid="whats-new"
          className={`relative w-full max-w-[560px] overflow-hidden rounded-[28px] border border-lime-300/[0.13] bg-[#0C0F0D] px-5 pb-5 pt-6 text-center shadow-2xl shadow-black/30 sm:px-8 sm:pb-7 sm:pt-8 ${reduced ? "wn-still" : ""}`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_50%_0%,rgba(190,242,100,.14),transparent_70%)]" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[#7A3BFF]/20 blur-3xl" />
          <button type="button" aria-label="Close" onClick={close} className="absolute right-3 top-3 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/55 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <p className="relative text-[11px] font-bold uppercase tracking-widest text-lime-300">New · Long Form</p>
          <DialogTitle className="relative mx-auto mt-2 max-w-[15ch] text-[31px] leading-[1.04] text-white sm:text-[44px]" style={{ fontFamily: "'Lilita One', system-ui, sans-serif" }}>
            Your next YouTube video, made for you.
          </DialogTitle>

          <div className="relative mx-auto mt-3 h-[150px] w-full sm:mt-5 sm:h-[208px]">
            <div className="absolute left-1/2 top-1/2 h-[80%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-300/25 blur-3xl" />
            {FAN.map((src, k) => (
              <div key={src} className="wn-slot absolute left-1/2 top-1/2 aspect-video w-[138px] sm:w-[208px]"
                style={{ zIndex: k === 1 ? 3 : k + 1, transform: `translate(-50%,-50%) ${FAN_POSE[k]}` }}>
                <div className="wn-deal h-full w-full" style={{ animationDelay: `${(0.1 + k * 0.12).toFixed(2)}s` }}>
                  <div className="wn-float h-full w-full" style={{ animationDelay: `${1 + k * 0.6}s` }}>
                    <img src={src} alt="" className="wn-card h-full w-full rounded-[12px] border border-white/20 object-cover shadow-[0_14px_34px_rgba(0,0,0,.55),0_2px_8px_rgba(0,0,0,.4)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mx-auto mt-3 flex max-w-[470px] items-start justify-center">
            {PROOF.map(([Icon, label], k) => (
              <div key={label} className="contents">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="wn-step grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/35 sm:h-9 sm:w-9" style={{ animationDelay: stepDelay(k) }}>
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  <span className="wn-label whitespace-nowrap text-[9.5px] font-semibold text-white/35 sm:text-[11px]" style={{ animationDelay: stepDelay(k) }}>{label}</span>
                </div>
                {k < PROOF.length - 1 && (
                  <span className="wn-link relative mx-1 mt-3.5 h-0.5 min-w-[8px] flex-1 overflow-hidden rounded-full bg-white/10 sm:mt-[18px]" style={{ animationDelay: `${(1.15 + k * 0.3).toFixed(2)}s` }} />
                )}
              </div>
            ))}
          </div>

          <div className="relative mt-4 flex flex-wrap justify-center gap-1.5 sm:mt-5">
            {CHIPS.map((c) => <span key={c} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/70 sm:text-[12px]">{c}</span>)}
          </div>

          <div className="relative mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:justify-center">
            <button type="button" onClick={make} data-testid="whats-new-try"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-6 text-sm font-black text-[#11150D] shadow-[0_0_28px_rgba(190,242,100,.22)] transition hover:bg-lime-200">
              Make my first video <ArrowRight className="h-4 w-4" />
            </button>
            {huntUrl && (
              <a href={huntUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackLaunch("showcase_click", { placement: "whats_new", target: huntUrl })}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white">
                <svg viewBox="0 0 24 17" className="h-3 w-4" aria-hidden="true"><rect width="24" height="17" rx="4.5" fill="#FF0033" /><path d="M9.6 4.8v7.4l6.2-3.7z" fill="#fff" /></svg>
                Watch one on YouTube
              </a>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
