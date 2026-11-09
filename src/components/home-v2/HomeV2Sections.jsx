import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ToolLink from "../seo/ToolLink.jsx";
import { useFirstInteraction } from "../../lib/firstInteraction.js";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight, Clapperboard, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { fetchShowcase, isLongFormNew, showcaseThumb, trackLaunch } from "../launch/launch";
import { liveTutorials, tutorialThumb } from "../../lib/tutorials";
import { NICHE_GROUPS } from "../../pages/workspace/long-form/niches";
import CreatorRewardsModal from "../CreatorRewardsModal.jsx";
import { CUTAWAY_PATH } from "../../data/cutawayExplainer";
import { fetchUserLongFormProjects } from "../../pages/workspace/long-form/project";
import { coverFor, fetchProjectCovers, projectTitle } from "../../pages/workspace/long-form/projectCovers";
import { NeutralCover } from "../../pages/workspace/long-form/shared";
import { BLOCKY_TEMPLATE, FEATURED_TEMPLATE, HIDDEN_TEMPLATES } from "../../data/homeContent";
import { optImg } from "../../lib/optImage";
import cartoonDrivePreview from "../../assets/home/latest/image9.16-fast.webp";
import shipClip from "../../assets/home/latest/video9.16-fast.mp4";

const STORAGE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase`;
// Served with the site, so they load even when the storage server can't be reached.
export const HUNT_THUMBS = ["/home/launch/spear-or-patience.jpg", "/home/launch/how-did-this-kill.jpg", "/home/launch/what-does-it-prove.jpg"];
// Baked scene loops (scripts/bakeSceneLoop.mjs): 7 caption-free f90160bc
// scenes, 3.5 s each with a slow zoom and crossfades, seamless, silent.
// Same scenes, different order per card so the two never match.
const sceneLoop = (name) => ({ src: `${STORAGE}/loops/${name}.mp4`, webm: `${STORAGE}/loops/${name}.webm`, poster: `${STORAGE}/loops/${name}.webp` });
export const LONG_FORM_LOOP = sceneLoop("lf-card"); // 063 101 036 091 058 086 041 (Home path card + lobby create card)
const MADE_WITH_ZYVO_LOOP = sceneLoop("made-with-zyvo"); // 036 086 091 063 041 101 058
const SECTION_X = "px-4 md:px-[50px]";
// Home's content column: centred, and no wider than this on big screens.
export const HOME_MAX_W = "max-w-[1440px]";

// Today's Home section header, one component: title + one-line subtitle + "See all →".
export function SectionHeader({ title, subtitle, action = "See all", onAction, badge }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 text-[20px] font-bold tracking-tight text-white md:text-[28px]">
          {title}
          {badge}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-white/40">{subtitle}</p>}
      </div>
      {onAction && (
        <button type="button" onClick={onAction} className="shrink-0 text-sm text-white/50 transition hover:text-white">
          {action} →
        </button>
      )}
    </div>
  );
}

const NewPill = ({ className = "" }) => (
  <span className={`rounded-full bg-lime-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#11150D] ${className}`}>New</span>
);

// Poster first; the clip loads and plays only while on screen (never with reduced motion).
// `webm` (VP9) is offered first when given; the MP4 (H.264) is the fallback.
// The poster shows first. The video file is fetched only once the visitor has scrolled, tapped or moved
// (useFirstInteraction) AND the card is on screen, so a first load never pays for video.
// `priority`: the poster is one of the first pictures on screen (fetched early, not lazily).
export function LazyLoopVideo({ src, webm, poster, className = "", priority = false }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const interacted = useFirstInteraction();
  useEffect(() => {
    if (reduced || !ref.current) return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(ref.current);
    return () => io.disconnect();
  }, [reduced]);
  useEffect(() => {
    const v = ref.current?.querySelector("video");
    if (!v) return;
    if (inView) v.play().catch(() => {}); else v.pause();
  }, [inView, interacted]);
  return (
    <div ref={ref} className={`overflow-hidden bg-[#0d0f10] ${className.split(" ").includes("absolute") ? "" : "relative"} ${className}`}>
      <img src={poster} alt="" decoding="async" loading={priority ? "eager" : "lazy"} {...(priority ? { fetchPriority: "high" } : {})} className="absolute inset-0 h-full w-full object-cover" />
      {!reduced && interacted && (inView || ready) && (
        <video poster={poster} muted loop playsInline autoPlay preload="none" onCanPlay={() => setReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
          {webm && <source src={webm} type='video/webm; codecs="vp9"' />}
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

/* ─── 2. Hero path cards ─────────────────────────────────────── */
// A card with a destination (`to`) is a real <a href>, so crawlers and
// "open in new tab" can follow it; one that opens a menu stays a button.
function PathCard({ onClick, to, media, icon: Icon, name, line, cta, primary, isNew, testId }) {
  const Tag = to ? Link : "button";
  return (
    <Tag {...(to ? { to, draggable: false } : { type: "button" })} onClick={onClick} data-testid={testId}
      className={`group relative block h-[230px] w-full overflow-hidden rounded-[24px] border bg-[#101312] text-left shadow-[0_24px_80px_rgba(0,0,0,.45)] transition duration-300 hover:-translate-y-0.5 sm:h-[250px] lg:h-[270px] 2xl:h-[300px] ${
        primary ? "border-lime-300/30 hover:border-lime-300/55" : "border-white/10 hover:border-white/25"}`}>
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]">{media}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
      {isNew && <NewPill className="absolute left-4 top-4" />}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5 md:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border backdrop-blur-md ${primary ? "border-lime-300/35 bg-lime-300/15 text-lime-300" : "border-white/15 bg-white/10 text-white"}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[20px] font-black leading-tight tracking-tight text-white sm:text-[24px]">{name}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-white/70 sm:text-sm">{line}</span>
          </span>
        </div>
        <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold transition sm:inline-flex ${
          primary ? "bg-lime-300 text-[#11150D] group-hover:bg-lime-200" : "border border-white/20 bg-white/10 text-white backdrop-blur-md group-hover:bg-white/20"}`}>
          {cta} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Tag>
  );
}

// Phones: four compact tiles instead of the two big cards, everything visible at once.
const PHONE_TOOLS = [
  { name: "Short Form", line: "Viral 9:16 clips", image: "/viral-builder/ai-fruit/presets/kicked-out.webp", open: true, testId: "tool-short" },
  { name: "Long Form", line: "8–15 min YouTube videos", image: "/home/long-form-card.webp", to: "/long-form", testId: "tool-long" },
  { name: "3D Explainers", line: "See how things work", image: "/onboarding/demo/landfill.jpg", to: CUTAWAY_PATH, testId: "tool-explainers" },
  { name: "Images", line: "5 free images", image: "/template/2am-world/preview.png", to: "/workspace/image-generator", testId: "tool-images" },
];
export function PhoneTools() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 px-4 md:hidden" data-testid="phone-tools">
      {PHONE_TOOLS.map((t) => {
        const Tag = t.to ? Link : "button";
        return (
          <Tag key={t.name} {...(t.to ? { to: t.to, draggable: false } : { type: "button" })} data-testid={t.testId}
            onClick={t.open ? () => { trackLaunch("path_short_form", { placement: "home_tools" }); window.dispatchEvent(new CustomEvent("zyvo:open-create-menu")); } : undefined}
            className="relative block h-[118px] overflow-hidden rounded-2xl border border-white/10 bg-[#101312] text-left">
            <img src={t.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-2.5">
              <span className="block text-[15.5px] font-black leading-tight text-white">{t.name}</span>
              <span className="block text-[11.5px] leading-snug text-white/75">{t.line}</span>
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

// Phones: the first templates as tiles (the coverflow is for larger screens).
export function PhoneTemplates({ items }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 px-4 md:hidden" data-testid="phone-templates">
      {items.slice(0, 6).map((t) => (
        <ToolLink key={t.name} to={t.path} className="relative block aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-[#101312]">
          <img src={t.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
          <span className="absolute inset-x-0 bottom-0 p-2.5 text-[14px] font-black leading-tight text-white">{t.name}</span>
        </ToolLink>
      ))}
    </div>
  );
}

export function PathCards() {
  return (
    <div className={`relative z-10 mx-auto mt-5 hidden w-full ${HOME_MAX_W} gap-4 md:mt-6 md:grid md:grid-cols-2 md:gap-5 ${SECTION_X}`}>
      <PathCard
        testId="path-short"
        onClick={() => { trackLaunch("path_short_form", { placement: "home_hero" }); window.dispatchEvent(new CustomEvent("zyvo:open-create-menu")); }}
        icon={Sparkles} name="Short Form" line="Viral 9:16 clips for TikTok, Reels & Shorts" cta="Browse templates"
        media={(
          <div className="grid h-full grid-cols-3 gap-1.5">
            <img {...optImg("/behind-the-scenes/poster.webp", "200px", 480)} alt="" className="h-full w-full object-cover" />
            <LazyLoopVideo src={shipClip} poster={cartoonDrivePreview} className="h-full" />
            <img {...optImg("/viral-builder/ai-fruit/presets/kicked-out.webp", "200px", 480)} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      />
      <PathCard
        testId="path-long"
        primary isNew={isLongFormNew()}
        to="/long-form" onClick={() => trackLaunch("try_long_form", { placement: "home_hero" })}
        icon={Clapperboard} name="Long Form" line="8–15 min YouTube explainers from one idea" cta="Start a video"
        media={<img src="/home/long-form-card.webp" alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />}
      />
    </div>
  );
}

/* ─── 3. What's new row ───────────────────────────────────────── */
function FanArt() {
  return (
    <div className="absolute inset-0 bg-[#0C0F0D]">
      {HUNT_THUMBS.map((src, i) => (
        <img key={src} src={src} alt="" loading="lazy"
          className={`absolute top-[14%] w-[40%] rounded-[10px] border border-white/20 shadow-[0_14px_34px_rgba(0,0,0,.55)] ${
            i === 0 ? "left-[8%] -rotate-[8deg]" : i === 1 ? "left-[22%] z-10 w-[44%] -translate-y-1" : "left-[40%] rotate-[8deg]"}`} />
      ))}
    </div>
  );
}

// Illustrated credits: lime coin stacks, one coin in the air, sparkles.
const COIN_STACKS = [{ x: 150, n: 4 }, { x: 206, n: 7 }, { x: 262, n: 5 }];
function Coin({ cx, cy, rx = 24, ry = 9, h = 7 }) {
  return (
    <g>
      <path d={`M${cx - rx} ${cy} v${h} a${rx} ${ry} 0 0 0 ${rx * 2} 0 v-${h} z`} fill="#4D7C0F" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#coinTop)" stroke="#65A30D" strokeWidth="1" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={ry * 0.58} fill="none" stroke="#3F6212" strokeOpacity=".45" strokeWidth="1.5" />
    </g>
  );
}
function CreditsArt() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0C0D10]">
      <svg viewBox="0 0 320 170" className="absolute -right-2 top-0 h-[88%] w-auto" aria-hidden="true">
        <defs>
          <linearGradient id="coinTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ECFCCB" /><stop offset=".45" stopColor="#BEF264" /><stop offset="1" stopColor="#84CC16" /></linearGradient>
        </defs>
        <ellipse cx="206" cy="150" rx="110" ry="10" fill="#000" opacity=".45" />
        {COIN_STACKS.map(({ x, n }) => Array.from({ length: n }, (_, i) => <Coin key={`${x}-${i}`} cx={x} cy={140 - i * 9} />))}
        <g transform="rotate(-24 104 58)"><Coin cx={104} cy={58} rx={22} ry={12} h={6} /></g>
        {[[64, 30, 7], [288, 34, 6], [240, 16, 4], [128, 104, 4]].map(([x, y, r]) => (
          <path key={`${x}`} d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`} fill="#D9F99D" />
        ))}
      </svg>
      <span className="absolute left-4 top-4 rounded-full border border-lime-300/30 bg-black/40 px-2.5 py-1 text-[12px] font-black text-lime-300 backdrop-blur-sm">+1,500 credits</span>
    </div>
  );
}

function BannerCard({ art, title, sub, cta, onClick, href, to, testId, display = "block" }) {
  const inner = (
    <>
      {art}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
      <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-lime-300 px-3 py-1.5 text-[12px] font-bold text-[#11150D] shadow-[0_6px_18px_rgba(0,0,0,.35)] transition group-hover:bg-lime-200">
        {cta} <ChevronRight className="h-3.5 w-3.5" />
      </span>
      <div className="absolute inset-x-0 bottom-0 z-10 p-4">
        <p className="max-w-[92%] text-[18px] font-black leading-tight tracking-tight text-white md:text-[19px]">{title}</p>
        {sub && <p className="mt-1 text-[12.5px] text-white/60">{sub}</p>}
      </div>
    </>
  );
  const cls = `group relative ${display} h-[132px] w-full shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#101312] text-left transition hover:border-white/25 md:h-[196px] md:w-auto`;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls} data-testid={testId}>{inner}</a>;
  if (to) return <Link to={to} draggable={false} onClick={onClick} className={cls} data-testid={testId}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls} data-testid={testId}>{inner}</button>;
}

export function WhatsNewRow() {
  const { user } = useAuth();
  const [hunt, setHunt] = useState(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  useEffect(() => {
    let live = true;
    fetchShowcase("home").then((rows) => live && setHunt(rows.find((r) => /hunt/i.test(r.title)) ?? rows[0] ?? null));
    return () => { live = false; };
  }, []);
  // the newest tutorial, from the one list (src/lib/tutorials.js)
  const newest = liveTutorials()[0], tutorial = newest && { title: newest.title, youtube_url: newest.url, thumbnail_url: tutorialThumb(newest) };
  const cards = [
    <BannerCard key="lf" testId="wn-long-form" display="hidden md:block" art={<FanArt />} title="Long Form is here" sub="A full YouTube video from one idea" cta="Try it"
      to="/long-form" onClick={() => trackLaunch("try_long_form", { placement: "whats_new_row" })} />,
    hunt && <BannerCard key="yt" testId="wn-showcase" art={<LazyLoopVideo {...MADE_WITH_ZYVO_LOOP} className="absolute inset-0" />}
      title={`Made with Zyvo: ${hunt.title}`} cta="Watch on YouTube" href={hunt.youtube_url}
      onClick={() => trackLaunch("showcase_click", { placement: "whats_new_row", target: hunt.youtube_url, videoId: hunt.id })} />,
    tutorial && <BannerCard key="tut" testId="wn-tutorial" art={<img src={showcaseThumb(tutorial)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      title="Watch the tutorial" sub={tutorial.title} cta="Watch" href={tutorial.youtube_url}
      onClick={() => trackLaunch("tutorial_click", { placement: "whats_new_row", target: tutorial.youtube_url })} />,
    <BannerCard key="earn" testId="wn-earn" display="hidden min-[1920px]:block" art={<CreditsArt />} title="Earn free credits" sub="Post about Zyvo and earn credits for every view" cta="Learn more"
      onClick={() => { trackLaunch("earn_credits_click", { placement: "whats_new_row" }); setRewardsOpen(true); }} />,
  ].filter(Boolean);
  // Columns = the cards on screen: every card but "Earn" below 1920 px, all of them from there up.
  const columns = { 1: "md:grid-cols-1 min-[1920px]:grid-cols-2", 2: "md:grid-cols-2 min-[1920px]:grid-cols-3", 3: "md:grid-cols-3 min-[1920px]:grid-cols-4" }[cards.length - 1];
  return (
    // (phones leave out the Long Form card: with nothing else to show, no empty heading)
    <section className={`mt-8 w-full ${SECTION_X} ${!hunt && !tutorial ? "hidden md:block" : ""}`} data-testid="whats-new-row">
      <SectionHeader title="What's new" subtitle="Fresh on Zyvo this week." />
      <div className={`flex flex-col gap-3 md:grid md:gap-4 ${columns}`}>
        {cards}
      </div>
      {rewardsOpen && <CreatorRewardsModal onClose={() => { if (user) localStorage.setItem(`zyvo_creator_rewards_seen:${user.id}`, "1"); setRewardsOpen(false); }} />}
    </section>
  );
}

/* ─── Tutorials: every tutorial on the one list (src/lib/tutorials.js), newest first ── */
const YT_ICON = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true"><path fill="#FF0033" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z" /><path fill="#fff" d="m9.6 15.6 6.3-3.6-6.3-3.6v7.2Z" /></svg>
);
export function TutorialsRow() {
  const list = liveTutorials();
  if (!list.length) return null;
  return (
    <section className={`mt-10 w-full ${SECTION_X}`} data-testid="tutorials-row">
      <SectionHeader title="Tutorials" subtitle="Step by step, from idea to finished video." />
      {/* phones: a row you swipe; wider screens: a grid */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {list.map((t) => (
          <a key={t.url} href={t.url} target="_blank" rel="noopener noreferrer" data-testid="tutorial-tile"
            onClick={() => trackLaunch("tutorial_click", { placement: "home_tutorials", target: t.url, tool: t.tool })}
            className="group w-[78vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.05] md:w-auto md:max-w-none">
            <div className="relative aspect-video w-full overflow-hidden bg-white/[0.05]">
              <img src={tutorialThumb(t)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
              <span className="absolute inset-0 grid place-items-center bg-black/15"><span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 backdrop-blur-sm transition group-hover:scale-110"><svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-white" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span></span>
            </div>
            <div className="p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime-300/80">{t.toolName}</p>
              <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-white">{t.title}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/55 group-hover:text-white">{YT_ICON} Watch on YouTube</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ─── 4. Jump back in (real projects only) ────────────────────── */
function timeAgo(iso) {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const LF_STATUS = { complete: "Ready to publish", story_ready: "Story ready", researching: "Researching", scripting: "Writing the script", generating: "Drawing scenes" };
const sentence = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Untitled video");

export function JumpBackInV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!user?.id) { setItems([]); return undefined; }
    let live = true;
    (async () => {
      // Cover: chosen thumbnail -> first finished scene -> the chosen idea's thumbnail -> a neutral title cover.
      const [projects, coverOf, { data: jobs }] = await Promise.all([
        fetchUserLongFormProjects(user.id),
        fetchProjectCovers(),
        supabase.from("jobs").select("id, result_url, prompt, created_at, tool_key").eq("user_id", user.id).not("result_url", "is", null).order("created_at", { ascending: false }).limit(8),
      ]);
      const long = (projects ?? []).slice(0, 8).map((p) => ({ key: `lf-${p.id}`, kind: "long", at: p.updated_at, title: sentence(p.topic), meta: LF_STATUS[p.status] ?? sentence(String(p.status).replace(/_/g, " ")), image: coverFor(coverOf, p), coverTitle: projectTitle(p), go: `/long-form/project/${p.id}` }));
      const short = (jobs ?? []).map((j) => ({ key: `job-${j.id}`, kind: "short", at: j.created_at, title: sentence(String(j.prompt ?? "").slice(0, 60)), meta: "Short Form", image: j.result_url, go: "/workspace/creations" }));
      if (live) setItems([...long, ...short].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 8));
    })();
    return () => { live = false; };
  }, [user?.id]);
  if (!items.length) return null;
  return (
    <section className={`mt-10 w-full ${SECTION_X}`} data-testid="jump-back-in">
      <SectionHeader title="Jump back in" subtitle="Pick up where you left off." onAction={() => navigate("/workspace/creations")} />
      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:gap-4 md:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <button key={it.key} type="button" onClick={() => navigate(it.go)}
            className="group w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#101312] text-left transition hover:border-white/25 md:w-[290px]">
            <div className="relative aspect-video overflow-hidden bg-[#0d0f10]">
              {it.image
                ? <img src={it.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                : it.coverTitle ? <NeutralCover title={it.coverTitle} />
                : <div className="grid h-full place-items-center text-white/30"><Clapperboard className="h-8 w-8" strokeWidth={1.5} /></div>}
              <span className={`absolute left-2.5 top-2.5 rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide backdrop-blur-sm ${
                it.kind === "long" ? "border-lime-300/35 bg-black/60 text-lime-300" : "border-white/15 bg-black/60 text-white/80"}`}>{it.kind === "long" ? "Long" : "Short"}</span>
            </div>
            <div className="p-3">
              <p className="truncate text-[13.5px] font-semibold text-white">{it.title}</p>
              <p className="mt-0.5 text-[11.5px] text-white/40">{it.meta} · {timeAgo(it.at)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ─── 5. Long Form: how it works + pick a niche ───────────────── */
const STEPS = [
  { title: "Pick a niche & idea", line: "Choose one of 25 niches and an idea, or type your own topic.", image: "/home/v2/step-idea.jpg" },
  { title: "Zyvo writes, voices and draws it", line: "Research, script, voiceover and about 150 cartoon scenes, each one checked.", image: "/home/v2/step-scenes.jpg" },
  { title: "Edit & publish to YouTube", line: "Change any scene, then download the video, 3 thumbnails and the YouTube text.", image: "/home/v2/step-publish.jpg" },
];
const ALL_NICHES = NICHE_GROUPS.flatMap((g) => g.niches);

export function HowItWorks({ className = "" }) {
  return (
      <div className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden ${className}`} data-testid="how-it-works">
        {STEPS.map((s, i) => (
          <div key={s.title} className="w-[86%] shrink-0 snap-start rounded-[22px] border border-white/10 bg-white/[0.03] p-4 md:w-auto md:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-300 text-[14px] font-black text-[#11150D]">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[16px] font-bold leading-snug text-white md:text-[17px]">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/45">{s.line}</p>
              </div>
            </div>
            <div className="mt-4 aspect-[16/9] overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10]">
              <img {...optImg(s.image, "(max-width: 768px) 86vw, 33vw", 960)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
            </div>
          </div>
        ))}
      </div>
  );
}

export function LongFormSection() {
  const navigate = useNavigate();
  // A niche card's link is /long-form, the page crawlers follow: the setup
  // (/long-form/create?niche=<id>) is noindex (routeSeoPolicy.js). A plain
  // click still opens the setup with that niche picked.
  const openNiche = (event, id) => {
    trackLaunch("niche_pick", { placement: "home", target: id });
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(`/long-form/create?niche=${id}`);
  };
  return (
    <section className={`mt-12 w-full ${SECTION_X}`} data-testid="long-form-section">
      <SectionHeader title="Make a YouTube video with Long Form" subtitle="8–15 minute explainers. You pick the idea, Zyvo does the rest." badge={isLongFormNew() ? <NewPill /> : null}
        action="Start a video" onAction={() => { trackLaunch("try_long_form", { placement: "home_how_it_works" }); navigate("/long-form"); }} />
      <div className="hidden md:block"><HowItWorks /></div>
      <Link to="/ai-stickman-video-generator" className="inline-block text-[13px] md:mt-4 font-semibold text-white/55 underline-offset-4 transition hover:text-lime-300 hover:underline">How the AI stickman video generator works →</Link>

      <div className="mb-3 mt-9 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-[17px] font-bold tracking-tight text-white md:text-[20px]">Pick a niche</h3>
          <p className="mt-0.5 text-sm text-white/40">Tap one to start a video in it.</p>
        </div>
      </div>
      {/* phones: four whole cards, nothing cut off; larger screens: the full row to scroll */}
      <div className="grid grid-cols-2 gap-3 pb-2 md:-mx-[50px] md:flex md:snap-x md:scroll-px-[50px] md:gap-4 md:overflow-x-auto md:px-[50px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="niche-row">
        {ALL_NICHES.map((n, i) => (
          <Link key={n.id} to="/long-form" draggable={false} onClick={(event) => openNiche(event, n.id)}
            className={`group min-w-0 shrink-0 snap-start text-left md:block md:w-[232px] ${i < 4 ? "block" : "hidden"}`}>
            <div className="aspect-video overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10] transition group-hover:border-lime-300/45">
              <img {...optImg(`/images/niches/${n.id}.webp`, "232px", 480)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            </div>
            <p className="mt-2 truncate text-[13px] font-semibold text-white/85 group-hover:text-white">{n.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── 6. Short Form templates for the zyvo suite coverflow ─────── */
// Merged "zyvo suite" + "Most Viral Templates", one entry each. Names listed in
// HIDDEN_TEMPLATES (src/data/homeContent.js) stay hidden until their art is
// replaced. "NEW" comes only from `addedAt` (the last 30 days), never by hand.
const TEMPLATES = [
  { name: "Behind the Scenes", desc: "Miniature cities destroyed by real practical FX", image: "/behind-the-scenes/poster.webp", path: "/workspace/behind-the-scenes", addedAt: "2026-08-13" },
  { name: "Cartoon Drive By", desc: "Drive past cartoon worlds in real life", image: cartoonDrivePreview, path: "/workspace/cartoon-drive-by", addedAt: "2026-08-05" },
  { name: "AI Fruit Story", desc: "Characters, stories, viral content & more", image: "/viral-builder/ai-fruit/presets/kicked-out.webp", path: "/workspace/ai-fruit-story", addedAt: "2026-05-12" },
  { name: "Micro Camera", desc: "Animal bodycam goes underground", image: "/viral-builder/micro-camera/preview1.png", path: "/workspace/micro-camera-animal", addedAt: "2026-05-27" },
  { name: "Video Generator", desc: "Create cinematic videos in seconds", image: "/home/videogen.png", path: "/workspace/video-generator", addedAt: null },
  { name: "Clay Rescue", desc: "Giant hands save tiny clay worlds", image: "/clayrescue/smallpreview.webp", path: "/workspace/clay-rescue", addedAt: "2026-06-01" },
  { name: "AI Cooking Matic", desc: "Viral cooking videos on autopilot", image: "/templates/AICOOKING/thumbnail.png", path: "/workspace/ai-cooking-matic", addedAt: "2026-06-17" },
  { name: "30 Days", desc: "Thirty days inside any world", image: "/template/thirty-days/preview.png", path: "/workspace/thirty-days", addedAt: "2026-09-27" },
  { name: "2AM Worlds", desc: "TikTok slideshows of worlds at 2AM", image: "/template/2am-world/preview.png", path: "/workspace/two-am", addedAt: "2026-07-26" },
  { name: "Face ASMR", desc: "Viral face reveal ASMR videos", image: "/face/face-preview.png", path: "/workspace/face-asmr", addedAt: "2026-05-24" },
  { name: "Kit Swap", desc: "Swap a player's kit for any country", image: "/template/kit-swap/preview.png", path: "/workspace/kit-swap", addedAt: "2026-07-12" },
];
// blocky: Blocky Stories is switched on for everyone. Its card then leads the row (the newest template).
export function suiteTemplates(now = Date.now(), { blocky = false } = {}) {
  const all = blocky ? [{ name: BLOCKY_TEMPLATE.name, path: BLOCKY_TEMPLATE.path, ...BLOCKY_TEMPLATE.suite }, ...TEMPLATES] : TEMPLATES;
  return all.filter((t) => !HIDDEN_TEMPLATES.includes(t.name)).map((t) => ({ ...t, badge: t.addedAt && now - Date.parse(t.addedAt) < 30 * 86_400_000 ? "NEW" : null }));
}

/* ─── Featured Short Form template (under the short form suite) ─── */
// template: another template shown the same way (Blocky Stories, right above this one, once it is launched).
export function FeaturedTemplate({ template = FEATURED_TEMPLATE, testId = "featured-template" }) {
  const t = template;
  if (!t?.examples?.length) return null;
  const track = () => trackLaunch("featured_template", { placement: "home_featured", target: t.path });
  return (
    <section className={`relative mt-10 w-full overflow-hidden py-8 md:py-10 ${SECTION_X}`} data-testid={testId}>
      <div className="pointer-events-none absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="relative mx-auto max-w-[1380px]">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-lime-300">{t.eyebrow}</p>
              <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                <span className="text-[9px] font-bold tracking-widest text-red-400">LIVE</span>
              </span>
            </div>
            <h2 className="text-[28px] font-black tracking-[-0.045em] text-white sm:text-[34px] md:text-[42px]">{t.name}</h2>
          </div>
          <ToolLink to={t.path} onClick={track} className="flex shrink-0 items-center gap-1.5 rounded-full bg-lime-300 px-4 py-2.5 text-[13px] font-black text-[#11150D] transition hover:bg-lime-200 active:scale-95">
            Try Template <ArrowRight className="h-4 w-4" />
          </ToolLink>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:gap-3 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {t.examples.map((ex) => (
            <ToolLink key={ex.video ?? ex.image} to={t.path} draggable={false} onClick={track} aria-label={`Try the ${t.name} template`}
              className="group relative block aspect-[9/16] w-[clamp(150px,52vw,220px)] shrink-0 snap-start overflow-hidden rounded-[14px] border border-white/[0.11] bg-[#0d0f10] text-left shadow-[0_22px_65px_rgba(0,0,0,.38)] transition duration-500 hover:-translate-y-1 hover:border-white/20 sm:w-[240px] lg:w-[280px]">
              {ex.video
                ? <LazyLoopVideo src={ex.video} poster={ex.poster} className="absolute inset-0" />
                : <img src={ex.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/[0.06]" />
            </ToolLink>
          ))}
        </div>
      </div>
    </section>
  );
}
