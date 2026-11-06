// "Made with Zyvo" on Home: Latest arrivals (the 3 newest templates), one chip per template, and a 9:16 grid of
// the owner's own Zyvo videos. Picks live in src/data/communityShowcase.json (file names in the public showcase
// bucket, folder community/), so videos can be swapped without code changes.
//
// Performance (Home is the first page people see): posters first and lazily; a video element exists only while
// its card is playing (preload="none" until then) and only after the visitor's first scroll / tap / move;
// at most 3 videos play at once (playerPool.js); anything off screen pauses. Fixed aspect boxes: no layout shift.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion as Motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import ToolLink from "../../seo/ToolLink.jsx";
import { useFirstInteraction } from "../../../lib/firstInteraction.js";
import { trackLaunch } from "../../launch/launch";
import showcase from "../../../data/communityShowcase.json";
import { HIDDEN_TEMPLATES } from "../../../data/homeContent";
import { CUTAWAY_ENABLED } from "../../../data/cutawayExplainer";
import { showcaseTemplates, flatVideos } from "./showcaseData.js";
import { claim, release, stopAll } from "./playerPool.js";
import "./madeWithZyvo.css";

const ShowcaseViewer = lazy(() => import("./ShowcaseViewer.jsx"));
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase/community`;
const POSTER_MS = 3200; // an "All" card shows each of its videos' posters this long while it isn't playing
const LONG_FORM = "long-form";

/* ─── hooks ──────────────────────────────────────────────────────────────── */

// Desktop (a real mouse): cards play on hover. Phones: cards play while on screen.
function useHoverDevice() {
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const set = () => setHover(mq.matches);
    set();
    mq.addEventListener?.("change", set);
    return () => mq.removeEventListener?.("change", set);
  }, []);
  return hover;
}

function useInView(ref, threshold = 0.55) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

// want → a slot in the 3-video pool. Returns whether this card may play right now.
function usePlaySlot(id, want) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!want) { setAllowed(false); return undefined; }
    claim(id, () => setAllowed(false));
    setAllowed(true);
    return () => release(id);
  }, [id, want]);
  return allowed;
}

/* ─── media pieces ───────────────────────────────────────────────────────── */

function Poster({ src, className = "", eager = false, onLoad }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="mwz-skeleton absolute inset-0" />}
      <img
        src={src}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => { setLoaded(true); onLoad?.(); }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      />
    </>
  );
}

// The <video> exists only while it may play; it fades in over the poster once frames arrive.
function ClipVideo({ src, play, loop = true, onEnded }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (play) v.play().catch(() => {}); else v.pause();
  }, [play, src]);
  useEffect(() => setReady(false), [src]);
  if (!play && !ready) return null;
  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      loop={loop}
      autoPlay
      preload="none"
      onPlaying={() => setReady(true)}
      onEnded={onEnded}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready && play ? "opacity-100" : "opacity-0"}`}
    />
  );
}

/* ─── grid card ──────────────────────────────────────────────────────────── */

// One template ("All": cycles through its videos with a crossfade and dots) or one video (a template chip).
function ShowcaseCard({ template, videos, label, onOpen, index }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const hoverDevice = useHoverDevice();
  const interacted = useFirstInteraction();
  const inView = useInView(ref);
  const [hovered, setHovered] = useState(false);
  const [i, setI] = useState(0);
  const cycling = videos.length > 1;
  const want = interacted && !reduced && (hoverDevice ? hovered : inView);
  const playing = usePlaySlot(`card:${template.id}:${videos[0].id}`, want);

  // Not playing: the posters take turns while the card is on screen.
  useEffect(() => {
    if (!cycling || playing || !inView || reduced || !interacted) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % videos.length), POSTER_MS);
    return () => clearInterval(t);
  }, [cycling, playing, inView, reduced, interacted, videos.length]);

  const current = videos[i];
  return (
    <Motion.button
      ref={ref}
      type="button"
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.96 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : (index % 5) * 0.06 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onOpen(current)}
      aria-label={`Watch ${template.name} examples`}
      className="group relative block aspect-[9/16] w-full overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0d0f10] text-left shadow-[0_18px_50px_-20px_rgba(0,0,0,.7)] transition-[transform,border-color,box-shadow] duration-300 md:hover:-translate-y-1.5 md:hover:scale-[1.02] md:hover:border-white/20 md:hover:shadow-[0_28px_60px_-18px_rgba(0,0,0,.85)]"
      data-testid="mwz-card"
    >
      {/* posters: the new one fades in on top while the previous one stays fully visible underneath (a
          crossfade with no dip to black); the others wait, hidden. Own layer (z-0), so the video and labels stay above. */}
      <div className="absolute inset-0 z-0">
      {videos.map((v, n) => (
        (n === i || (cycling && interacted)) && (
          <div key={v.id} className={`absolute inset-0 transition-opacity duration-700 ${n === i ? "z-[2] opacity-100" : n === (i - 1 + videos.length) % videos.length ? "z-[1] opacity-100" : "z-0 opacity-0"}`}>
            <Poster src={v.poster} />
          </div>
        )
      ))}
      </div>
      <ClipVideo key={current.id} src={current.src} play={playing} loop={!cycling} onEnded={() => setI((n) => (n + 1) % videos.length)} />

      <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/[0.06]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
      <span className="pointer-events-none absolute left-2.5 top-2.5 max-w-[calc(100%-20px)] truncate rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold text-white/90 backdrop-blur-md">
        {label}
      </span>
      {!playing && (
        <span className="pointer-events-none absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white/90 opacity-80 backdrop-blur transition group-hover:opacity-100">
          <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
        </span>
      )}
      {cycling && (
        <span className="pointer-events-none absolute bottom-3.5 left-3 flex items-center gap-1">
          {videos.map((v, n) => (
            <span key={v.id} className={`relative h-1 overflow-hidden rounded-full bg-white/35 transition-all duration-300 ${n === i ? "w-5" : "w-1.5"}`}>
              {n === i && !reduced && <span key={`${i}-${playing}`} className={`absolute inset-0 rounded-full bg-white ${playing ? "" : "mwz-dot-fill"}`} style={{ "--mwz-dot": `${POSTER_MS}ms` }} />}
              {n === i && reduced && <span className="absolute inset-0 rounded-full bg-white" />}
            </span>
          ))}
        </span>
      )}
    </Motion.button>
  );
}

/* ─── Latest arrivals ────────────────────────────────────────────────────── */

function LatestCard({ template, index, onOpen }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const interacted = useFirstInteraction();
  const inView = useInView(ref, 0.4);
  const playing = usePlaySlot(`latest:${template.id}`, interacted && !reduced && inView);
  const [hero, side] = template.videos;
  const track = () => trackLaunch("community_try_template", { placement: "community_latest", target: template.path });

  return (
    <Motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : index * 0.08 }}
      className="group relative aspect-[5/4] w-[84vw] max-w-[440px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0d0f10] shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] md:w-auto md:max-w-none"
      data-testid="mwz-latest"
    >
      {/* blurred backdrop from the poster */}
      <img src={hero.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_85%_40%,transparent,rgba(9,10,10,.55)_55%,rgba(9,10,10,.92))]" />

      {/* floating thumbnails: a small second clip behind, the playing clip in front */}
      {side && (
        // up in the empty corner above the title, so it never sits under the text
        <div className="mwz-float-slow pointer-events-none absolute right-[43%] top-[7%] aspect-[9/16] h-[30%] overflow-hidden rounded-[10px] border border-white/15 opacity-85 shadow-2xl" style={{ "--mwz-rot": "-8deg" }}>
          <Poster src={side.poster} />
        </div>
      )}
      <button
        type="button"
        onClick={() => onOpen(hero)}
        aria-label={`Watch ${template.name} examples`}
        className="mwz-float absolute right-[6%] top-[9%] aspect-[9/16] h-[82%] overflow-hidden rounded-[16px] border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,.6)] transition-transform duration-300 group-hover:scale-[1.03]"
        style={{ "--mwz-rot": "4deg" }}
      >
        <Poster src={hero.poster} />
        <ClipVideo src={hero.src} play={playing} />
      </button>

      <div className="absolute bottom-0 left-0 top-0 z-10 flex w-[56%] flex-col justify-end p-5 md:p-6">
        <span className="mb-2.5 w-fit rounded-full bg-lime-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#11150D]">New</span>
        <h3 className="text-[20px] font-black leading-[1.05] tracking-[-0.03em] text-white md:text-[24px]">{template.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-white/60">{template.desc}</p>
        <ToolLink
          to={template.path}
          onClick={track}
          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-black transition hover:bg-lime-200 active:scale-95"
        >
          Try it <ArrowRight className="h-3.5 w-3.5" />
        </ToolLink>
      </div>
    </Motion.div>
  );
}

/* ─── Long Form chip (YouTube cards, as before) ──────────────────────────── */

function LongFormCard({ item }) {
  return (
    <a
      href={item.youtube_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackLaunch("showcase_click", { placement: "community", target: item.youtube_url, videoId: item.id })}
      className="group relative block aspect-video overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#0d0f10] transition hover:border-white/20"
    >
      <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2">
        <svg viewBox="0 0 24 17" className="h-3 w-4 shrink-0" aria-hidden="true"><rect width="24" height="17" rx="4.5" fill="#FF0033" /><path d="M9.6 4.8v7.4l6.2-3.7z" fill="#fff" /></svg>
        <span className="truncate text-[12px] font-semibold text-white/85">{item.title}</span>
      </div>
    </a>
  );
}

/* ─── the section ────────────────────────────────────────────────────────── */

// blocky: Blocky Stories is switched on for everyone (Home's rule). longFormItems: Home's Long Form showcase.
export default function MadeWithZyvo({ blocky = true, longFormItems = [] }) {
  const templates = useMemo(() => showcaseTemplates(showcase, {
    base: BASE,
    hidden: HIDDEN_TEMPLATES,
    off: [...(blocky ? [] : ["blocky-stories"]), ...(CUTAWAY_ENABLED ? [] : ["cutaway-explainer"])],
  }), [blocky]);
  const longForm = longFormItems.filter((v) => v.thumbnail_url && v.youtube_url);
  const [filter, setFilter] = useState("all");
  const [viewer, setViewer] = useState(null); // { items, start }
  const chipsRef = useRef(null);

  if (!templates.length) return null;
  const latest = templates.slice(0, 3);
  const chips = [{ id: "all", name: "All" }, ...templates, ...(longForm.length ? [{ id: LONG_FORM, name: "Long Form" }] : [])];
  const shown = filter === "all" ? templates : templates.filter((t) => t.id === filter);

  const open = (list, video) => {
    stopAll();
    const start = Math.max(0, list.findIndex((v) => v.id === video.id));
    trackLaunch("community_open", { placement: "community", target: video.template?.path ?? null, videoId: video.id });
    setViewer({ items: list, start });
  };
  const pick = (id, el) => {
    setFilter(id);
    el?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  // Cards: "All" = one per template (cycling); a template = one card per video.
  const cards = filter === "all"
    ? shown.map((t) => ({ key: t.id, template: t, videos: t.videos, label: t.name }))
    : shown.flatMap((t) => t.videos.map((v) => ({ key: v.id, template: t, videos: [v], label: t.name })));
  const viewerList = flatVideos(shown);

  return (
    <section className="w-full px-4 md:px-[50px]" data-testid="made-with-zyvo">
      <div className="mb-5 md:mb-6">
        <h2 className="text-[20px] font-bold tracking-tight text-white md:text-[28px]">Made with Zyvo</h2>
        <p className="mt-1 text-sm text-white/40">Watch how people use Zyvo to make content that performs.</p>
      </div>

      {/* Latest arrivals */}
      <div className="mb-8 md:mb-10">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-lime-300">Latest arrivals</p>
        <div className="mwz-noscroll -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
          {latest.map((t, n) => (
            <LatestCard key={t.id} template={t} index={n} onOpen={(video) => open(flatVideos([t]), { ...video, template: t })} />
          ))}
        </div>
      </div>

      {/* Filter chips: one row, scrolls on phones, the white highlight slides between chips */}
      <LayoutGroup id="mwz-chips">
        <div ref={chipsRef} className="mwz-noscroll -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="Filter by template">
          {chips.map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={(e) => pick(c.id, e.currentTarget)}
                className={`relative shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors duration-200 ${active ? "border-transparent text-black" : "border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
                data-testid="mwz-chip"
              >
                {active && <Motion.span layoutId="mwz-chip-active" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className="relative">{c.name}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {filter === LONG_FORM ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3" data-testid="community-long-form">
          {longForm.map((item) => <LongFormCard key={item.id} item={item} />)}
        </div>
      ) : (
        <LayoutGroup id="mwz-grid">
          <Motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {cards.map((c, n) => (
                <ShowcaseCard
                  key={c.key}
                  index={n}
                  template={c.template}
                  videos={c.videos}
                  label={c.label}
                  onOpen={(video) => open(viewerList, { ...video, template: c.template })}
                />
              ))}
            </AnimatePresence>
          </Motion.div>
        </LayoutGroup>
      )}

      {viewer && (
        <Suspense fallback={null}>
          <ShowcaseViewer items={viewer.items} start={viewer.start} onClose={() => setViewer(null)} />
        </Suspense>
      )}
    </section>
  );
}
