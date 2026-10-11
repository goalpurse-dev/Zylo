import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Play, Volume2, VolumeX } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import useBlockyPrices from "../../components/viral-tools/blocky-stories/pricing/useBlockyPrices.js";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { useFirstInteraction } from "../../lib/firstInteraction.js";
import { STICKMAN_FONT_HREF } from "../../data/stickmanLandingPages.js";
import {
  BLOCKY_AUDIENCES, BLOCKY_EXAMPLES, BLOCKY_FAQ, BLOCKY_FEATURES, BLOCKY_HERO_VIDEO, BLOCKY_INTRO, BLOCKY_LANDING_SEO, BLOCKY_NOTICE, BLOCKY_RELATED,
  BLOCKY_STEPS, BLOCKY_STORY_SECONDS, BLOCKY_TOOL_PATH, BLOCKY_TUTORIAL, blockyPlanRows, posterSrc,
} from "../../data/blockyStoryLanding.js";

// /blocky-story-video-maker: the public page of Blocky Stories. Its content lives in
// src/data/blockyStoryLanding.js (the JSON-LD reads the same file, and so does the one constant that holds
// the genre's name). Layout, display font and colours are the image generator page's and the Long Form
// landing page's: Barlow Condensed headings, lime on near-black, the same section rhythm.

const SLUG = "blocky-story-video-maker";
const DISPLAY = { fontFamily: "'Barlow Condensed', 'Barlow Condensed Fallback', 'Arial Narrow', system-ui, sans-serif", fontStretch: "condensed" };
const FALLBACK_FACE = "@font-face{font-family:'Barlow Condensed Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Arial');size-adjust:74%;ascent-override:118%;descent-override:30%;line-gap-override:0%}";
const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D0F]";
const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 py-3 text-[15px] font-black text-[#11150D] transition hover:bg-lime-200 ${FOCUS}`;
const SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-[15px] font-bold text-white transition hover:border-white/30 hover:bg-white/[0.08] ${FOCUS}`;

function useDisplayFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${STICKMAN_FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STICKMAN_FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

function SectionTitle({ id, children, lead }) {
  return (
    <div className="max-w-[760px]">
      <h2 id={id} style={DISPLAY} className="text-balance text-[34px] font-extrabold uppercase leading-none text-white sm:text-[44px]">{children}</h2>
      {lead && <p className="mt-3 text-[15px] leading-7 text-white/65 sm:text-base">{lead}</p>}
    </div>
  );
}

function StartLink({ placement, children = BLOCKY_LANDING_SEO.cta }) {
  return (
    <Link to={BLOCKY_TOOL_PATH} onClick={() => trackSeoEvent("seo_cta_clicked", { slug: SLUG, placement })} className={PRIMARY}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

/**
 * A tall clip: its poster first (a real <img>, sized, so nothing shifts), and the video file only once the
 * visitor has done something on the page and the clip is on screen. `soon` (the hero) also starts by
 * itself a moment after the page has loaded. Plays without sound, looping; `sound` adds a button for it.
 * With "reduce motion" set nothing plays by itself: the poster stays.
 */
function LoopClip({ clip, sizes, eager = false, soon = false, sound = false, className = "" }) {
  const box = useRef(null);
  const interacted = useFirstInteraction();
  const [idle, setIdle] = useState(false);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [audible, setAudible] = useState(false);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

  useEffect(() => {
    if (!soon) return undefined;
    let timer;
    const later = () => { timer = setTimeout(() => setIdle(true), 2500); };
    if (document.readyState === "complete") later(); else window.addEventListener("load", later, { once: true });
    return () => { clearTimeout(timer); window.removeEventListener("load", later); };
  }, [soon]);
  useEffect(() => {
    if (still || !box.current || typeof IntersectionObserver === "undefined") return undefined;
    const seen = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    seen.observe(box.current);
    return () => seen.disconnect();
  }, [still]);
  useEffect(() => {
    const video = box.current?.querySelector("video");
    if (!video) return;
    if (inView) video.play().catch(() => {}); else video.pause();
  }, [inView, ready, interacted, idle]);

  const widest = clip.posterWidths.at(-1);
  const load = !still && (interacted || idle) && (inView || ready);
  return (
    <div ref={box} className={`relative aspect-[9/16] overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0f10] ${className}`}>
      <img
        src={posterSrc(clip.poster, widest)}
        {...(eager ? {} : { srcSet: clip.posterWidths.map((w) => `${posterSrc(clip.poster, w)} ${w}w`).join(", "), sizes })}
        alt={clip.alt}
        width={clip.size[0]}
        height={clip.size[1]}
        loading={eager ? "eager" : "lazy"}
        {...(eager ? { fetchPriority: "high" } : {})}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {load && (
        <video
          src={clip.url}
          muted={!audible}
          loop
          playsInline
          autoPlay
          preload="none"
          onCanPlay={() => setReady(true)}
          aria-hidden="true"
          tabIndex={-1}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {!load && !still && (
        <span className="pointer-events-none absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm" aria-hidden="true"><Play className="h-3.5 w-3.5 fill-current" /></span>
      )}
      {sound && load && (
        <button
          type="button"
          onClick={() => setAudible((on) => !on)}
          aria-pressed={audible}
          className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold backdrop-blur-sm transition ${FOCUS} ${audible ? "bg-lime-300 text-[#11150D]" : "bg-black/60 text-white hover:bg-black/75"}`}
        >
          {audible ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
          {audible ? "Sound on" : "Sound off"}
        </button>
      )}
    </div>
  );
}

/** Asks the server for the live price rows, once the page is in a browser (nothing of this runs in the build). */
function LivePrices({ onPrices }) {
  const { prices, status } = useBlockyPrices("9:16");
  useEffect(() => {
    const complete = status === "ready" && prices.image != null && prices.script != null && ["v2", "v3", "v4"].every((id) => prices[`clip:${id}`] != null);
    if (complete) onPrices(prices);
  }, [prices, status, onPrices]);
  return null;
}

/** The tutorial: a picture and a button until the visitor asks for it, then YouTube's own player. */
function Tutorial({ video }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-9 aspect-video w-full max-w-[860px] overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0f10]">
      {open ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => { trackSeoEvent("seo_tutorial_opened", { slug: SLUG }); setOpen(true); }} className={`group absolute inset-0 h-full w-full ${FOCUS}`} aria-label={`Play the tutorial: ${video.title}`}>
          <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" width="480" height="360" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-lime-300 text-[#11150D] transition group-hover:scale-105"><Play className="h-6 w-6 fill-current" aria-hidden="true" /></span>
        </button>
      )}
    </div>
  );
}

export default function BlockyStoriesLanding() {
  useDisplayFont();
  // The build's HTML shows the repo's price rows; a browser then asks for the live ones and shows those.
  const [mounted, setMounted] = useState(false);
  const [livePrices, setLivePrices] = useState(null);
  useEffect(() => setMounted(true), []);
  const plans = blockyPlanRows(livePrices ?? undefined);
  const v2Story = plans[0].tiers[0].storyCredits;

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0B0D0F] text-white">
      <style dangerouslySetInnerHTML={{ __html: FALLBACK_FACE }} />
      {mounted && <LivePrices onPrices={setLivePrices} />}
      {/* No main element here: the app shell already provides it. */}
      <div data-landing-content>
        {/* 1. Hero */}
        <section className="border-b border-white/[0.07]">
          <div className={`${WRAP} grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.25fr_.75fr] lg:gap-14`}>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-300">Zyvo Blocky Stories</p>
              <h1 style={DISPLAY} className="mt-3 text-balance text-[46px] font-extrabold uppercase leading-[0.95] text-white sm:text-[64px] lg:text-[72px]">{BLOCKY_LANDING_SEO.h1}</h1>
              <p className="mt-5 max-w-[56ch] text-[16px] leading-7 text-white/70 sm:text-[18px] sm:leading-8">
                Give it one idea and get a finished vertical video: blocky characters act out the story and say every line, with lip sync, captions and the text for your post.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <StartLink placement="hero" />
                <a href="#examples" className={SECONDARY}>See real examples</a>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/60">
                {["50+ characters with their own voice", "Captions and post text included", "9:16 for Shorts, TikTok and Reels"].map((text) => (
                  <li key={text} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" />{text}</li>
                ))}
              </ul>
            </div>
            <figure className="mx-auto w-full max-w-[250px] sm:max-w-[290px] lg:max-w-[320px]">
              <LoopClip clip={BLOCKY_HERO_VIDEO} eager soon sound className="shadow-[0_30px_90px_rgba(0,0,0,.55)]" />
              <figcaption className="mt-3 text-center text-[12px] text-white/50">&ldquo;{BLOCKY_HERO_VIDEO.title}&rdquo;, a {BLOCKY_HERO_VIDEO.seconds}-second story made with the tool</figcaption>
            </figure>
          </div>
        </section>

        {/* 2. Real examples */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="examples">
          <SectionTitle id="examples" lead="Scenes from stories made with the tool, shown as they came out: one caption track, the characters' own voices, nothing edited afterwards. The clips here play without sound.">Real stories made with Blocky Stories</SectionTitle>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {BLOCKY_EXAMPLES.map((clip) => (
              <li key={clip.id}>
                <LoopClip clip={clip} sizes="(max-width: 1024px) 46vw, 270px" />
                <h3 className="mt-3 text-[16px] font-bold text-white">{clip.title}</h3>
                <p className="mt-1 text-[13px] leading-5 text-white/55">{clip.lines.map((line) => `“${line}”`).join(" ")}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. What it is, and how it works */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="how-it-works">
          <div className={`${WRAP} py-14 md:py-20`}>
            <div className="max-w-[760px]">
              <h2 style={DISPLAY} className="text-balance text-[34px] font-extrabold uppercase leading-none text-white sm:text-[44px]">{BLOCKY_INTRO.title}</h2>
              {BLOCKY_INTRO.paragraphs.map((text) => <p key={text.slice(0, 24)} className="mt-4 text-[15px] leading-7 text-white/70 sm:text-base">{text}</p>)}
            </div>
            <h2 id="how-it-works" style={DISPLAY} className="mt-14 text-balance text-[30px] font-extrabold uppercase leading-none text-white sm:text-[38px]">How it works, in five steps</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {BLOCKY_STEPS.map((step, i) => (
                <li key={step.title} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-lime-300 text-[15px] font-black text-[#11150D]">{i + 1}</span>
                  <h3 className="mt-3 text-[17px] font-bold leading-snug text-white">{step.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-white/65">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-9"><StartLink placement="how" /></div>
          </div>
        </section>

        {/* 4. Features */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="features">
          <SectionTitle id="features" lead="What makes a talking character video hold together from the first scene to the last.">What is in every story</SectionTitle>
          {/* Seven cards: four and three across, the last one double width so no row ends short. */}
          <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BLOCKY_FEATURES.map((item, i) => (
              <li key={item.title} className={`rounded-[18px] border border-white/10 bg-white/[0.03] p-5 ${i === BLOCKY_FEATURES.length - 1 ? "sm:col-span-2" : ""}`}>
                <h3 className="text-[17px] font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-white/65">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Who it is for */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="who-its-for">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="who-its-for">Who it is for</SectionTitle>
            <ul className="mt-9 grid gap-4 md:grid-cols-3">
              {BLOCKY_AUDIENCES.map((item) => (
                <li key={item.title} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-[18px] font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-white/65">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. Pricing summary: which plan gets which quality, and about how many stories */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="plans">
          <SectionTitle id="plans" lead={`Every paid plan can make stories. The plan decides which quality tiers you can pick, and its monthly credits decide how many. A ${BLOCKY_STORY_SECONDS}-second story costs about ${v2Story} credits on V2; writing the three versions is free.`}>Plans and what they make</SectionTitle>
          <ul className="mt-9 grid gap-4 md:grid-cols-3" data-testid="blocky-plans">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-col rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-[20px] font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-[14px] text-white/55">{plan.credits.toLocaleString("en-US")} credits a month</p>
                <ul className="mt-4 space-y-2">
                  {plan.tiers.map((tier) => (
                    <li key={tier.id} className="flex items-baseline justify-between gap-3 border-t border-white/[0.07] pt-2 text-[14px]">
                      <span className="font-bold text-white">{tier.label} <span className="font-medium text-white/50">· {tier.tag.toLowerCase()}</span></span>
                      <span className="shrink-0 text-right text-white/75">about <span className="font-black text-lime-300">{tier.stories}</span> stories</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[760px] text-[13px] leading-6 text-white/50">Stories of {BLOCKY_STORY_SECONDS} seconds, counted from the current price of a scene picture, the script and each tier's video. A free account can ask for story ideas; making videos starts on Starter.</p>
          <div className="mt-6"><Link to="/pricing" className={SECONDARY}>See plans and prices</Link></div>
        </section>

        {/* 7. Tutorial (only once there is one) */}
        {BLOCKY_TUTORIAL?.id && (
          <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="tutorial">
            <div className={`${WRAP} py-14 md:py-20`}>
              <SectionTitle id="tutorial" lead="From one idea to a finished video, step by step.">Watch the tutorial</SectionTitle>
              <Tutorial video={BLOCKY_TUTORIAL} />
            </div>
          </section>
        )}

        {/* 8. FAQ */}
        <section className={`${BLOCKY_TUTORIAL?.id ? "" : "border-t border-white/[0.07] "}${WRAP} py-14 md:py-20`} aria-labelledby="faq">
          <SectionTitle id="faq">Questions and answers</SectionTitle>
          <div className="mt-8 max-w-[860px] space-y-3">
            {BLOCKY_FAQ.map((item) => (
              <details key={item.q} className="group rounded-[16px] border border-white/10 bg-white/[0.03] px-5 py-4">
                <summary className={`cursor-pointer list-none rounded text-[16px] font-bold text-white ${FOCUS}`}>{item.q}</summary>
                <p className="pt-3 text-[14px] leading-6 text-white/65">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 9. Other tools */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="more-tools">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="more-tools" lead="Other ways to make video with Zyvo.">More from Zyvo</SectionTitle>
            <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BLOCKY_RELATED.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={`group flex h-full flex-col rounded-[18px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-lime-300/40 ${FOCUS}`}>
                    <span className="text-[16px] font-bold leading-snug text-white group-hover:text-lime-300">{item.title}</span>
                    <span className="mt-2 text-[14px] leading-6 text-white/60">{item.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10. Final call */}
        <section className={`${WRAP} py-16 text-center md:py-24`} aria-labelledby="start">
          <h2 id="start" style={DISPLAY} className="mx-auto max-w-[760px] text-balance text-[38px] font-extrabold uppercase leading-none text-white sm:text-[52px]">Make your first story today</h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-7 text-white/65 sm:text-base">Pick an idea, pick your characters, and watch them act it out. You see every picture before you pay for video.</p>
          <div className="mt-7 flex justify-center"><StartLink placement="final" /></div>
        </section>

        {BLOCKY_NOTICE && (
          <p className={`${WRAP} border-t border-white/[0.07] py-6 text-center text-[12px] leading-5 text-white/45`} data-testid="blocky-notice">{BLOCKY_NOTICE}</p>
        )}
      </div>
      <Footer />
    </div>
  );
}
