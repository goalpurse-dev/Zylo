import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Play, RefreshCw, Shuffle, Sparkles, Volume2, X } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import CreditIcon from "../../components/ui/zyvo/CreditIcon.jsx";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { useFirstInteraction } from "../../lib/firstInteraction.js";
import { stashTownTopic } from "../../lib/promptHandoff.js";
import { STICKMAN_FONT_HREF } from "../../data/stickmanLandingPages.js";
import { TutorialGrid } from "./TownTutorials.jsx";
import StudioKitSection from "../../components/studio-kit/StudioKitSection.jsx";
import {
  GENRE, IN_THIS_TOWN_PRICE, IN_THIS_TOWN_SEO, IN_THIS_TOWN_TOOL_PATH, TOWN_BLOG, TOWN_FAQ, TOWN_FEATURES, TOWN_IDEAS, TOWN_NOTICE,
  TOWN_STEPS, TOWN_STORIES, TOWN_WALL, townPreview,
} from "../../data/inThisTownLanding.js";
import "./inThisTownLanding.css";

// /in-this-town-story-video-maker: the public page of In This Town (the Blender engine). Content, FAQ, ideas and the
// toy's templates live in src/data/inThisTownLanding.js (the JSON-LD reads the same file). Layout and display font
// follow the other landing pages (Barlow Condensed headings, lime on near-black). Videos: posters first, the files
// only after the visitor's first interaction and only while on screen (Lighthouse on phones).

const SLUG = "in-this-town-story-video-maker";
const DISPLAY = { fontFamily: "'Barlow Condensed', 'Barlow Condensed Fallback', 'Arial Narrow', system-ui, sans-serif", fontStretch: "condensed" };
const FALLBACK_FACE = "@font-face{font-family:'Barlow Condensed Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Arial');size-adjust:74%;ascent-override:118%;descent-override:30%;line-gap-override:0%}";
const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D0F]";
const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 py-3 text-[16px] font-black text-[#11150D] transition hover:-translate-y-0.5 hover:bg-lime-200 ${FOCUS}`;
const SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.05] px-5 py-3 text-[15px] font-bold text-white transition hover:border-white/35 hover:bg-white/[0.09] ${FOCUS}`;
const DEFAULT_RULE = TOWN_IDEAS[2].rule;

function useDisplayFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${STICKMAN_FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STICKMAN_FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

const useReducedMotion = () => {
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true); }, []);
  return still;
};

function useInView(ref, threshold = 0.35) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

function SectionTitle({ id, kicker, children, lead }) {
  return (
    <div className="max-w-[780px]">
      {kicker && <p className="mb-2 text-[13px] font-black uppercase tracking-[0.16em] text-lime-300">{kicker}</p>}
      <h2 id={id} style={DISPLAY} className="text-balance text-[36px] font-extrabold uppercase leading-[0.95] text-white sm:text-[50px]">{children}</h2>
      {lead && <p className="mt-3 text-[16px] leading-7 text-white/70">{lead}</p>}
    </div>
  );
}

function StartLink({ placement, topic, children = IN_THIS_TOWN_SEO.cta, className = PRIMARY }) {
  return (
    <Link
      to={IN_THIS_TOWN_TOOL_PATH}
      onClick={() => { if (topic) stashTownTopic(topic); trackSeoEvent("seo_cta_clicked", { slug: SLUG, placement }); }}
      className={className}
    >
      {children} <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
}

function Price({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-black text-white ${className}`}>
      <CreditIcon className="h-[1em] w-[1em] text-lime-300" />{IN_THIS_TOWN_PRICE.credits}<span className="font-semibold text-white/60"> credits per video</span>
    </span>
  );
}

/** A silent looping clip: the poster first; the file once the visitor has interacted and the clip is on screen
 *  (or hovered). Under "reduce motion" the poster stays. */
function LoopClip({ src, poster, alt, eager = false, className = "", label }) {
  const box = useRef(null);
  const interacted = useFirstInteraction();
  const still = useReducedMotion();
  const inView = useInView(box, 0.5);
  const [hover, setHover] = useState(false);
  const active = !still && (hover || (interacted && inView));
  useEffect(() => {
    const v = box.current?.querySelector("video");
    if (!v) return;
    if (active) v.play().catch(() => {}); else v.pause();
  }, [active]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (active) setLoaded(true); }, [active]);
  return (
    <div ref={box} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
      className={`relative aspect-[9/16] overflow-hidden rounded-[18px] border-2 border-white/10 bg-[#0d0f10] ${className}`}>
      <img src={poster} alt={alt} width={360} height={640} loading={eager ? "eager" : "lazy"} {...(eager ? { fetchPriority: "high" } : {})}
        decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      {loaded && <video src={src} muted loop playsInline autoPlay preload="none" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
      {label && <span className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[12px] font-bold text-white">{label}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ hero */
function HeroPlayer() {
  const [pick, setPick] = useState(TOWN_STORIES[0].id);
  const [sound, setSound] = useState(false);
  const story = TOWN_STORIES.find((s) => s.id === pick);
  return (
    <div className="mx-auto w-full max-w-[330px]">
      <div className="relative rounded-[30px] border-[6px] border-[#1d2124] bg-black p-1 shadow-[0_30px_80px_-20px_rgba(190,242,100,.35)]">
        {sound ? (
          <div className="relative aspect-[9/16] overflow-hidden rounded-[22px]">
            <video key={story.id} src={story.video} poster={story.poster} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-cover"
              aria-label={`${story.title}: the first 30 seconds with sound`} />
            <button type="button" onClick={() => setSound(false)} className={`absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white ${FOCUS}`} aria-label="Close the video with sound"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <LoopClip key={story.id} src={story.loop} poster={story.poster} alt={story.alt} eager className="!rounded-[22px] !border-0" />
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Choose an example story">
        {TOWN_STORIES.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === pick} onClick={() => { setPick(s.id); setSound(false); }}
            className={`min-h-10 rounded-full border-2 px-3.5 text-[14px] font-bold transition ${FOCUS} ${s.id === pick ? "border-lime-300 bg-lime-300 text-[#11150D]" : "border-white/15 text-white/80 hover:border-white/35"}`}>
            {s.id === "milo" ? "Milo" : s.id === "tower" ? "Coin tower" : "Plane town"}
          </button>
        ))}
      </div>
      {!sound && (
        <button type="button" onClick={() => { setSound(true); trackSeoEvent("seo_video_sound", { slug: SLUG, story: pick }); }}
          className={`mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-bold text-lime-200 hover:text-lime-100 ${FOCUS}`}>
          <Volume2 className="h-5 w-5" aria-hidden="true" /> Watch 30 seconds with sound
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ the toy */
const COLORS = ["#fca5a5", "#fde68a", "#a5b4fc", "#86efac", "#f9a8d4"];
function ToyScene({ preview }) {
  const [w, setW] = useState(0);
  const words = preview?.words ?? [];
  useEffect(() => { setW(0); }, [preview?.rule]);
  useEffect(() => {
    if (!words.length) return undefined;
    const t = setInterval(() => setW((i) => (i + 1) % words.length), 520);
    return () => clearInterval(t);
  }, [words.length]);
  const theme = preview?.theme ?? "any";
  const drops = theme === "rain" || theme === "coins";
  return (
    <div className="itt-scene" data-theme={theme} role="img" aria-label={preview ? `A blocky town scene for the rule: ${preview.rule}` : "A blocky town scene"}>
      <div className="itt-sun" /><div className="itt-cloud c1" /><div className="itt-cloud c2" />
      <div className="itt-city">{[48, 82, 60, 95, 70].map((h, i) => <div key={i} className="itt-bld" style={{ height: `${h}%`, "--c": COLORS[i] }} />)}</div>
      <div className="itt-road" />
      <div className="itt-npc n1"><div className="itt-head" /><div className="itt-body" /><div className="itt-legs"><span /><span /></div></div>
      <div className="itt-npc n2"><div className="itt-head" /><div className="itt-body" /><div className="itt-legs"><span /><span /></div></div>
      <div className="itt-kid" style={{ "--shirt": "#84cc16" }}><div className="itt-head"><div className="itt-mouth" /></div><div className="itt-body" /><div className="itt-legs"><span /><span /></div></div>
      {drops && <div className={`itt-drops ${theme === "coins" ? "coins" : ""}`}>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 0.23)}s` }} />)}</div>}
      {words.length > 0 && <p className="itt-caption" aria-hidden="true"><span key={`${w}-${preview.rule}`} className={w % 4 === 2 ? "hot" : ""}>{words[w]}</span></p>}
    </div>
  );
}

function RuleToy({ text, setText, inputRef }) {
  const [shuffle, setShuffle] = useState(0);
  const preview = useMemo(() => townPreview(text, shuffle), [text, shuffle]);
  return (
    <div className="grid items-start gap-6 rounded-[28px] border-2 border-lime-300/25 bg-[#11150d] p-4 sm:p-6 lg:grid-cols-[260px_1fr] lg:gap-8">
      <div className="mx-auto w-full max-w-[170px] sm:max-w-[220px] lg:max-w-none"><ToyScene preview={preview} /></div>
      <div className="min-w-0">
        <label htmlFor="itt-rule" className="text-[15px] font-black text-white">In this town…</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="itt-rule" ref={inputRef} value={text} onChange={(e) => { setText(e.target.value); setShuffle(0); }} maxLength={140}
            placeholder="every time you sneeze, you teleport" autoComplete="off"
            className={`min-h-[52px] w-full min-w-0 rounded-xl border-2 border-white/20 bg-black/40 px-4 text-[17px] font-semibold text-white placeholder:text-white/35 focus:border-lime-300 ${FOCUS}`} />
          <button type="button" onClick={() => setShuffle((s) => s + 1)} disabled={!preview}
            className={`${SECONDARY} shrink-0 disabled:opacity-40`}><Shuffle className="h-5 w-5" aria-hidden="true" />Shuffle</button>
        </div>
        <p className="mt-2 text-[13px] text-white/50">Free and instant: a quick sketch from story templates, no AI. The real video gets a full script written for your rule.</p>
        <div aria-live="polite" className="mt-5">
          {preview ? (
            <ol className="space-y-2.5">
              {preview.beats.map(([label, line], i) => (
                <li key={`${label}-${line}`} className="itt-beat rounded-2xl border border-white/10 bg-black/35 px-4 py-3" style={{ "--i": i }}>
                  <span className="text-[12px] font-black uppercase tracking-[0.14em] text-lime-300">{label}</span>
                  <p className={`mt-0.5 font-bold leading-snug text-white ${i === 0 ? "text-[19px]" : "text-[16px]"}`}>{line}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-[15px] text-white/55">Type a rule for your town and your story starts here.</p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <StartLink placement="toy" topic={preview ? `In this town, ${preview.rule}` : ""}>Make the real video</StartLink>
          <Price className="text-[15px]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */
export default function InThisTownLanding() {
  useDisplayFont();
  const [text, setText] = useState(DEFAULT_RULE);
  const inputRef = useRef(null);
  const toyRef = useRef(null);
  const stepsRef = useRef(null);
  const stepsOn = useInView(stepsRef, 0.4);
  const [stepsSeen, setStepsSeen] = useState(false);
  useEffect(() => { if (stepsOn) setStepsSeen(true); }, [stepsOn]);

  const tryIdea = (rule) => {
    setText(rule);
    trackSeoEvent("seo_prompt_interaction", { slug: SLUG, templateId: "in-this-town" });
    toyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 500);
  };

  return (
    <div className="itt-page min-h-screen overflow-x-hidden bg-[#0B0D0F] text-white">
      <style>{FALLBACK_FACE}</style>

      {/* HERO */}
      <section className="relative" aria-labelledby="itt-h1">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,rgba(190,242,100,.16),transparent_70%)]" />
        <div className={`${WRAP} relative grid items-center gap-8 pb-14 pt-6 sm:gap-10 sm:pt-14 lg:grid-cols-[1.15fr_.85fr] lg:pb-20`}>
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1.5 text-[13px] font-black uppercase tracking-[0.12em] text-lime-300">
              <Sparkles className="h-4 w-4" aria-hidden="true" />{GENRE ? `${GENRE.style} story videos` : "Blocky story videos"}
            </p>
            <h1 id="itt-h1" style={DISPLAY} className="mt-4 text-balance text-[44px] font-extrabold uppercase leading-[0.9] sm:text-[72px] lg:text-[84px]">
              Turn one sentence into a viral <span className="text-lime-300">&ldquo;In this town&hellip;&rdquo;</span> story video
            </h1>
            <p className="mt-4 max-w-[560px] text-[17px] leading-7 text-white/75 sm:mt-5 sm:text-[18px] sm:leading-8">
              Type a strange rule for a town. Zyvo writes the story, voices it, and directs every shot in blocky 3D, with captions and a twist ending. Faceless, vertical, ready for TikTok and Shorts.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
              <StartLink placement="hero" className={`${PRIMARY} !min-h-14 !px-6 !text-[18px] sm:!px-8`} />
              <a href="#try" className={SECONDARY}>Try a rule free <ArrowRight className="h-4 w-4 rotate-90" aria-hidden="true" /></a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-white/70">
              <li className="flex items-center gap-1.5"><Price /></li>
              <li className="flex items-center gap-1.5"><Check className="h-4 w-4 text-lime-300" aria-hidden="true" />Refund if it fails</li>
              <li className="flex items-center gap-1.5"><Check className="h-4 w-4 text-lime-300" aria-hidden="true" />No Blender, no mic</li>
            </ul>
          </div>
          <HeroPlayer />
        </div>
      </section>

      {/* TOY */}
      <section id="try" ref={toyRef} className={`${WRAP} scroll-mt-6 py-12 sm:py-16`} aria-labelledby="itt-toy">
        <SectionTitle id="itt-toy" kicker="Try it now, free" lead="Type any rule. You get a hook, the rule line and how the story could turn, plus a tiny town acting it out.">Type a rule. Watch your town react.</SectionTitle>
        <div className="mt-8"><RuleToy text={text} setText={setText} inputRef={inputRef} /></div>
      </section>

      {/* HOW IT WORKS */}
      <section className={`${WRAP} py-12 sm:py-16`} aria-labelledby="itt-how">
        <SectionTitle id="itt-how" kicker="How it works" lead="Three steps. You only write one sentence and read one script.">Topic → script → video</SectionTitle>
        <ol ref={stepsRef} className={`itt-steps mt-8 grid gap-4 md:grid-cols-3 ${stepsSeen ? "on" : ""}`}>
          {TOWN_STEPS.map((s, i) => (
            <li key={s.n} className="itt-step rounded-[24px] border-2 border-white/10 bg-white/[0.03] p-5" style={{ "--i": i }}>
              <div className="flex items-center gap-3">
                <span style={DISPLAY} className="grid h-12 w-12 place-items-center rounded-xl bg-lime-300 text-[30px] font-extrabold text-[#11150D]">{s.n}</span>
                <h3 className="text-[22px] font-black">{s.title}</h3>
              </div>
              <div className="itt-step-bar mt-4" style={{ "--i": i }}><i /></div>
              <p className="mt-4 text-[15.5px] leading-7 text-white/70">{s.text}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {TOWN_FEATURES.map(([t, d]) => (
            <li key={t} className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <Check className="mt-1 h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />
              <div><h3 className="text-[16px] font-black">{t}</h3><p className="mt-1 text-[14.5px] leading-6 text-white/65">{d}</p></div>
            </li>
          ))}
        </ul>
      </section>

      {/* TUTORIALS (the owner's YouTube videos) */}
      <section className={`${WRAP} py-12 sm:py-16`} aria-labelledby="itt-tutorials">
        <SectionTitle id="itt-tutorials" kicker="Video tutorials" lead="Prefer to watch? Four short tutorials from our channel: the free Roblox Studio kit with Claude, the full workflow with Claude, the phone version, and a test of an AI maker.">Watch how it&rsquo;s done</SectionTitle>
        <div className="mt-8"><TutorialGrid slug={SLUG} /></div>
      </section>

      {/* WALL */}
      <section className={`${WRAP} py-12 sm:py-16`} aria-labelledby="itt-wall">
        <SectionTitle id="itt-wall" kicker="Made with Zyvo" lead="Moments from three stories made with this tool. Nothing here is edited by hand. Hover or scroll to play.">Real videos, straight out of the maker</SectionTitle>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {TOWN_WALL.map((c, i) => (
            <LoopClip key={c.video} src={c.video} poster={c.poster} alt={c.alt} label={c.title} className={`itt-wiggle ${i === 8 ? "hidden sm:block lg:hidden" : ""}`} />
          ))}
        </div>
        <p className="mt-4 text-center"><Play className="mr-1 inline h-4 w-4 text-lime-300" aria-hidden="true" /><a href="#itt-h1" className="font-bold text-lime-200 underline-offset-4 hover:underline">Watch a whole opening with sound at the top</a></p>
      </section>

      {/* IDEAS */}
      <section className={`${WRAP} py-12 sm:py-16`} aria-labelledby="itt-ideas">
        <SectionTitle id="itt-ideas" kicker="Idea library" lead="Our own rules, ready to go. Tap one to try it in the box above.">Steal one of these towns</SectionTitle>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOWN_IDEAS.map((idea) => (
            <li key={idea.rule}>
              <button type="button" onClick={() => tryIdea(idea.rule)}
                className={`group flex h-full w-full flex-col justify-between gap-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4 text-left transition hover:-translate-y-1 hover:border-lime-300/60 ${FOCUS}`}>
                <span className="text-[16.5px] font-bold leading-snug text-white">In this town, {idea.rule}.</span>
                <span className="flex items-center justify-between text-[13px] font-black uppercase tracking-[0.1em]">
                  <span className={idea.style === "Dark twist" ? "text-violet-300" : "text-amber-300"}>{idea.style}</span>
                  <span className="text-lime-300 group-hover:translate-x-0.5">Try it →</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[15px] text-white/65">Want 50 more? <Link to={`/blog/${TOWN_BLOG[1].slug}`} className="font-bold text-lime-200 underline underline-offset-4">{TOWN_BLOG[1].title}</Link></p>
      </section>

      {/* PRICE */}
      <section className={`${WRAP} py-12 sm:py-16`} aria-labelledby="itt-price">
        <div className="grid gap-6 rounded-[28px] border-2 border-lime-300/30 bg-gradient-to-br from-[#16200c] to-[#0B0D0F] p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <SectionTitle id="itt-price" kicker="Price">One video, one price</SectionTitle>
            <ul className="mt-5 space-y-2 text-[16px] text-white/80">
              <li className="flex gap-2"><Check className="mt-1 h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />Script, rewrites, voice, 3D render and captions included</li>
              <li className="flex gap-2"><Check className="mt-1 h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />If the video fails, every credit comes back</li>
              <li className="flex gap-2"><Check className="mt-1 h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />Changed your mind after the script? All but {IN_THIS_TOWN_PRICE.keepCredits} credits come back after {IN_THIS_TOWN_PRICE.expireDays} days</li>
            </ul>
            <p className="mt-4 text-[14px] text-white/55">Credits come with a Zyvo plan. <Link to="/pricing" className="font-bold text-lime-200 underline underline-offset-4">See plans</Link></p>
          </div>
          <div className="text-center">
            <p style={DISPLAY} className="flex items-center justify-center gap-2 text-[84px] font-extrabold leading-none text-white">
              <CreditIcon className="h-[62px] w-[62px] text-lime-300" />{IN_THIS_TOWN_PRICE.credits}
            </p>
            <p className="mt-1 text-[15px] font-bold text-white/65">credits per video</p>
            <div className="mt-5"><StartLink placement="price" /></div>
          </div>
        </div>
      </section>

      {/* MAKE IT IN ROBLOX STUDIO (free kit): only for open accounts until launch, never in the prerendered HTML */}
      <StudioKitSection slug={SLUG} />

      {/* FAQ */}
      <section className={`${WRAP} py-12 sm:py-16`} aria-labelledby="itt-faq">
        <SectionTitle id="itt-faq" kicker="FAQ">Questions people ask</SectionTitle>
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {TOWN_FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border-2 border-white/10 bg-white/[0.03] px-5 py-4 open:border-lime-300/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[16.5px] font-black text-white">
                {q}<span className="text-[22px] text-lime-300 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="pt-3 text-[15px] leading-7 text-white/70">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* GUIDES */}
      <section className={`${WRAP} py-12 sm:py-16`} aria-labelledby="itt-guides">
        <SectionTitle id="itt-guides" kicker="Guides">Learn the format</SectionTitle>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {TOWN_BLOG.map((b) => (
            <li key={b.slug}>
              <Link to={`/blog/${b.slug}`} className={`group flex h-full items-center justify-between gap-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] p-5 transition hover:border-lime-300/50 ${FOCUS}`}>
                <span className="text-[16.5px] font-bold leading-snug text-white group-hover:text-lime-200">{b.title}</span>
                <ArrowRight className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* FINAL CTA */}
      <section className={`${WRAP} pb-16 pt-6`}>
        <div className="rounded-[28px] bg-lime-300 p-8 text-center text-[#11150D] sm:p-12">
          <h2 style={DISPLAY} className="text-balance text-[40px] font-extrabold uppercase leading-[0.95] sm:text-[56px]">Your town has a rule. Go tell the story.</h2>
          <Link to={IN_THIS_TOWN_TOOL_PATH} onClick={() => trackSeoEvent("seo_cta_clicked", { slug: SLUG, placement: "final" })}
            className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-xl bg-[#0B0D0F] px-8 text-[18px] font-black text-white transition hover:-translate-y-0.5">
            {IN_THIS_TOWN_SEO.cta} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[15px] font-bold"><RefreshCw className="h-4 w-4" aria-hidden="true" />Refund if it fails</p>
        </div>
        {TOWN_NOTICE && <p className="mt-8 text-center text-[13px] text-white/50">{TOWN_NOTICE} {GENRE ? `"${GENRE.style}" describes the look only.` : ""}</p>}
      </section>
      <Footer />
    </div>
  );
}
