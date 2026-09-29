import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight, Clapperboard, Play, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { fetchShowcase, isLongFormNew, showcaseThumb, trackLaunch } from "../launch/launch";
import { NICHE_GROUPS } from "../../pages/workspace/long-form/niches";
import { FeatureCard, SHOWCASE_ITEMS } from "../workspace/ViralShowcase.jsx";
import { TRENDING_MODELS } from "../workspace/LatestModels.jsx";
import CreatorRewardsModal from "../CreatorRewardsModal.jsx";
import { fetchUserLongFormProjects } from "../../pages/workspace/long-form/project";
import cartoonDrivePreview from "../../assets/home/latest/image9.16-fast.webp";
import shipClip from "../../assets/home/latest/video9.16-fast.mp4";

const STORAGE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase`;
export const HUNT_THUMBS = [`${STORAGE}/launch/spear-or-patience.jpg`, `${STORAGE}/launch/how-did-this-kill.jpg`, `${STORAGE}/launch/what-does-it-prove.jpg`];
const HUNT_CLIP = { src: `${STORAGE}/preview/hunt-lab-960.mp4`, poster: `${STORAGE}/preview/hunt-lab-poster.jpg` };
const SECTION_X = "px-4 md:px-[50px]";

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
export function LazyLoopVideo({ src, poster, className = "" }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (reduced || !ref.current) return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "150px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [reduced]);
  useEffect(() => {
    const v = ref.current?.querySelector("video");
    if (!v) return;
    if (inView) v.play().catch(() => {}); else v.pause();
  }, [inView]);
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <img src={poster} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      {!reduced && (inView || ready) && (
        <video src={src} poster={poster} muted loop playsInline autoPlay preload="none" onCanPlay={() => setReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />
      )}
    </div>
  );
}

/* ─── 2. Hero path cards ─────────────────────────────────────── */
function PathCard({ onClick, media, icon: Icon, name, line, cta, primary, isNew, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className={`group relative h-[230px] w-full overflow-hidden rounded-[24px] border bg-[#101312] text-left shadow-[0_24px_80px_rgba(0,0,0,.45)] transition duration-300 hover:-translate-y-0.5 sm:h-[270px] lg:h-[300px] ${
        primary ? "border-lime-300/30 hover:border-lime-300/55" : "border-white/10 hover:border-white/25"}`}>
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]">{media}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
      {primary && <div className="pointer-events-none absolute -bottom-16 left-1/2 h-40 w-3/4 -translate-x-1/2 rounded-full bg-lime-300/15 blur-3xl" />}
      {isNew && <NewPill className="absolute left-4 top-4 shadow-[0_0_18px_rgba(190,242,100,.35)]" />}
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
    </button>
  );
}

export function PathCards() {
  const navigate = useNavigate();
  return (
    <div className={`relative z-10 mx-auto mt-7 grid w-full max-w-[1240px] gap-4 md:mt-9 md:grid-cols-2 md:gap-5 ${SECTION_X}`}>
      <PathCard
        testId="path-short"
        onClick={() => { trackLaunch("path_short_form", { placement: "home_hero" }); window.dispatchEvent(new CustomEvent("zyvo:open-create-menu")); }}
        icon={Sparkles} name="Short Form" line="Viral 9:16 clips for TikTok, Reels & Shorts" cta="Browse templates"
        media={(
          <div className="grid h-full grid-cols-3 gap-1.5">
            <img src="/behind-the-scenes/poster.webp" alt="" className="h-full w-full object-cover" />
            <LazyLoopVideo src={shipClip} poster={cartoonDrivePreview} className="h-full" />
            <img src="/viral-builder/ai-fruit/presets/kicked-out.webp" alt="" className="h-full w-full object-cover" />
          </div>
        )}
      />
      <PathCard
        testId="path-long"
        primary isNew={isLongFormNew()}
        onClick={() => { trackLaunch("try_long_form", { placement: "home_hero" }); navigate("/long-form"); }}
        icon={Clapperboard} name="Long Form" line="8–15 min YouTube explainers from one idea" cta="Start a video"
        media={<LazyLoopVideo src={HUNT_CLIP.src} poster={HUNT_CLIP.poster} className="h-full" />}
      />
    </div>
  );
}

/* ─── 3. What's new row ───────────────────────────────────────── */
function FanArt() {
  return (
    <div className="absolute inset-0 bg-[#0C0F0D]">
      <div className="absolute left-[42%] top-[38%] h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-300/20 blur-3xl" />
      {HUNT_THUMBS.map((src, i) => (
        <img key={src} src={src} alt="" loading="lazy"
          className={`absolute top-[14%] w-[40%] rounded-[10px] border border-white/20 shadow-[0_14px_34px_rgba(0,0,0,.55)] ${
            i === 0 ? "left-[8%] -rotate-[8deg]" : i === 1 ? "left-[22%] z-10 w-[44%] -translate-y-1" : "left-[40%] rotate-[8deg]"}`} />
      ))}
    </div>
  );
}

function CreditsArt() {
  return (
    <div className="absolute inset-0 bg-[#0C0D10]">
      <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#7A3BFF]/30 blur-3xl" />
      <div className="absolute right-6 top-[22%] flex items-center gap-2 text-lime-300">
        <span aria-hidden="true" className="block h-10 w-10 bg-current" style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
        <span className="text-[44px] font-black tracking-tight drop-shadow-[0_0_24px_rgba(190,242,100,.35)]">+1,500</span>
      </div>
    </div>
  );
}

function BannerCard({ art, title, sub, cta, onClick, href, testId }) {
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
  const cls = "group relative block h-[180px] w-[84%] shrink-0 snap-start overflow-hidden rounded-[20px] border border-white/10 bg-[#101312] text-left transition hover:border-white/25 md:h-[196px] md:w-auto";
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls} data-testid={testId}>{inner}</a>
    : <button type="button" onClick={onClick} className={cls} data-testid={testId}>{inner}</button>;
}

export function WhatsNewRow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hunt, setHunt] = useState(null);
  const [tutorial, setTutorial] = useState(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  useEffect(() => {
    let live = true;
    fetchShowcase("home").then((rows) => live && setHunt(rows.find((r) => /hunt/i.test(r.title)) ?? rows[0] ?? null));
    fetchShowcase("home", "tutorial").then((rows) => live && setTutorial(rows[0] ?? null));
    return () => { live = false; };
  }, []);
  const cards = [
    <BannerCard key="lf" testId="wn-long-form" art={<FanArt />} title="Long Form is here" sub="A full YouTube video from one idea" cta="Try it"
      onClick={() => { trackLaunch("try_long_form", { placement: "whats_new_row" }); navigate("/long-form"); }} />,
    hunt && <BannerCard key="yt" testId="wn-showcase" art={<img src={showcaseThumb(hunt)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />}
      title={`Made with Zyvo: ${hunt.title}`} cta="Watch on YouTube" href={hunt.youtube_url}
      onClick={() => trackLaunch("showcase_click", { placement: "whats_new_row", target: hunt.youtube_url, videoId: hunt.id })} />,
    tutorial && <BannerCard key="tut" testId="wn-tutorial" art={<img src={showcaseThumb(tutorial)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      title="Watch the tutorial" sub={tutorial.title} cta="Watch" href={tutorial.youtube_url}
      onClick={() => trackLaunch("tutorial_click", { placement: "whats_new_row", target: tutorial.youtube_url })} />,
    <BannerCard key="earn" testId="wn-earn" art={<CreditsArt />} title="Earn free credits" sub="Post about Zyvo and earn credits for every view" cta="Learn more"
      onClick={() => { trackLaunch("earn_credits_click", { placement: "whats_new_row" }); setRewardsOpen(true); }} />,
  ].filter(Boolean);
  return (
    <section className={`mt-10 w-full ${SECTION_X}`} data-testid="whats-new-row">
      <SectionHeader title="What's new" subtitle="Fresh on Zyvo this week." />
      <div className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden ${cards.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {cards}
      </div>
      {rewardsOpen && <CreatorRewardsModal onClose={() => { if (user) localStorage.setItem(`zyvo_creator_rewards_seen:${user.id}`, "1"); setRewardsOpen(false); }} />}
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
      // Cover: the picked YouTube thumbnail (covers RPC, own projects only),
      // else the same cover the Long Form lobby shows.
      const [projects, { data: covers }, { data: jobs }] = await Promise.all([
        fetchUserLongFormProjects(user.id),
        supabase.rpc("long_form_project_covers"),
        supabase.from("jobs").select("id, result_url, prompt, created_at, tool_key").eq("user_id", user.id).not("result_url", "is", null).order("created_at", { ascending: false }).limit(8),
      ]);
      const coverOf = new Map((covers ?? []).map((c) => [c.project_id, c.url]));
      const long = (projects ?? []).slice(0, 8).map((p) => ({ key: `lf-${p.id}`, kind: "long", at: p.updated_at, title: sentence(p.topic), meta: LF_STATUS[p.status] ?? sentence(String(p.status).replace(/_/g, " ")), image: coverOf.get(p.id) ?? p._thumbnailUrl ?? null, go: `/long-form/project/${p.id}` }));
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
                : <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(190,242,100,.12),transparent_60%)] text-lime-300/60"><Clapperboard className="h-8 w-8" strokeWidth={1.5} /></div>}
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

export function LongFormSection() {
  const navigate = useNavigate();
  return (
    <section className={`mt-12 w-full ${SECTION_X}`} data-testid="long-form-section">
      <SectionHeader title="Make a YouTube video with Long Form" subtitle="8–15 minute explainers. You pick the idea, Zyvo does the rest." badge={isLongFormNew() ? <NewPill /> : null}
        action="Start a video" onAction={() => { trackLaunch("try_long_form", { placement: "home_how_it_works" }); navigate("/long-form"); }} />
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
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
              <img src={s.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 mt-9 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-[17px] font-bold tracking-tight text-white md:text-[20px]">Pick a niche</h3>
          <p className="mt-0.5 text-sm text-white/40">Tap one to start a video in it.</p>
        </div>
      </div>
      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-[50px] md:scroll-px-[50px] md:gap-4 md:px-[50px] [&::-webkit-scrollbar]:hidden" data-testid="niche-row">
        {ALL_NICHES.map((n) => (
          <button key={n.id} type="button" onClick={() => { trackLaunch("niche_pick", { placement: "home", target: n.id }); navigate(`/long-form/create?niche=${n.id}`); }}
            className="group w-[190px] shrink-0 snap-start text-left md:w-[232px]">
            <div className="aspect-video overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10] transition group-hover:border-lime-300/45">
              <img src={`/images/niches/${n.id}.webp`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            </div>
            <p className="mt-2 truncate text-[13px] font-semibold text-white/85 group-hover:text-white">{n.label}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ─── 6. Short Form templates for the zyvo suite coverflow ─────── */
// Merged "zyvo suite" + "Most Viral Templates", one entry each. Templates whose
// current art shows a real person, character or brand are left out until they
// have new art (2AM Worlds, 30 Days, Face ASMR, Nationality Swap). "NEW" comes
// only from `addedAt` (the last 30 days), never set by hand.
const TEMPLATES = [
  { name: "Behind the Scenes", desc: "Miniature cities destroyed by real practical FX", image: "/behind-the-scenes/poster.webp", path: "/workspace/behind-the-scenes", addedAt: "2026-08-13" },
  { name: "Cartoon Drive By", desc: "Drive past cartoon worlds in real life", image: cartoonDrivePreview, path: "/workspace/cartoon-drive-by", addedAt: "2026-08-05" },
  { name: "AI Fruit Story", desc: "Characters, stories, viral content & more", image: "/viral-builder/ai-fruit/presets/kicked-out.webp", path: "/workspace/ai-fruit-story", addedAt: "2026-05-12" },
  { name: "Micro Camera", desc: "Animal bodycam goes underground", image: "/viral-builder/micro-camera/preview1.png", path: "/workspace/micro-camera-animal", addedAt: "2026-05-27" },
  { name: "Video Generator", desc: "Create cinematic videos in seconds", image: "/home/videogen.png", path: "/workspace/video-generator", addedAt: null },
  { name: "Clay Rescue", desc: "Giant hands save tiny clay worlds", image: "/clayrescue/smallpreview.webp", path: "/workspace/clay-rescue", addedAt: "2026-06-01" },
  { name: "AI Cooking Matic", desc: "Viral cooking videos on autopilot", image: "/templates/AICOOKING/thumbnail.png", path: "/workspace/ai-cooking-matic", addedAt: "2026-06-17" },
];
export function suiteTemplates(now = Date.now()) {
  return TEMPLATES.map((t) => ({ ...t, badge: t.addedAt && now - Date.parse(t.addedAt) < 30 * 86_400_000 ? "NEW" : null }));
}

/* ─── 7. Tools + trending models (compact) ─────────────────────── */
const TOOL_PATHS = ["/workspace/video-generator", null, "/workspace/image-generator"];
export function ToolsCompact() {
  const navigate = useNavigate();
  const open = (i) => (TOOL_PATHS[i] ? navigate(TOOL_PATHS[i]) : window.dispatchEvent(new CustomEvent("zyvo:open-create-menu")));
  return (
    <section className={`mt-12 w-full ${SECTION_X}`} data-testid="tools">
      <SectionHeader title="Tools" subtitle="Image and video generators, and the models trending now." onAction={() => navigate("/workspace/image-generator")} />
      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-[1.45fr_1fr_1fr] md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {SHOWCASE_ITEMS.map((item, i) => (
          <div key={item.title} role="button" tabIndex={0} onClick={() => open(i)} onKeyDown={(e) => { if (e.key === "Enter") open(i); }}
            className="h-[180px] w-[86%] shrink-0 snap-start md:h-[210px] md:w-auto">
            <FeatureCard {...item} />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 md:gap-4">
        {TRENDING_MODELS.map((m) => (
          <button key={m.name} type="button" onClick={() => navigate(m.path)}
            className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#090A0A] p-2.5 text-left transition hover:border-purple-500/30">
            <div className="relative aspect-video w-[112px] shrink-0 overflow-hidden rounded-xl">
              <img src={m.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded-full border border-white/10 bg-black/60 px-1.5 py-px text-[9.5px] text-purple-300 backdrop-blur">{m.tag}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate bg-gradient-to-r from-white via-purple-100 to-purple-500 bg-clip-text text-[16px] font-bold leading-tight text-transparent">{m.name}</p>
              <p className="mt-0.5 truncate text-xs text-white/40">{m.desc}</p>
            </div>
            <Play className="ml-auto mr-1 h-4 w-4 shrink-0 text-white/25 transition group-hover:text-white/60" />
          </button>
        ))}
      </div>
    </section>
  );
}
