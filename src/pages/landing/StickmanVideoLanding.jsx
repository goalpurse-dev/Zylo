import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Play, Plus } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import { NICHE_GROUPS, findNiche } from "../workspace/long-form/niches.js";
import { optImg } from "../../lib/optImage.js";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import GALLERY from "../../data/stickmanLandingGallery.json";
import {
  APP_VIEWPORT, STICKMAN_ASSETS, STICKMAN_FONT_HREF, STICKMAN_LANDING_PAGES, STICKMAN_PRICING, STICKMAN_VIDEOS, STICKMAN_VIEWPORT,
  stickmanGroupPage, stickmanNicheHref, stickmanVideoUrl,
} from "../../data/stickmanLandingPages.js";

// Long Form SEO landing page. Everything on it comes from one entry of
// src/data/stickmanLandingPages.js (`page`), so a niche page is a new entry.
// Same display font as the Pricing page (Barlow Condensed); the fallback face
// is sized to match it so the swap doesn't move the layout.

const DISPLAY = { fontFamily: "'Barlow Condensed', 'Barlow Condensed Fallback', 'Arial Narrow', system-ui, sans-serif", fontStretch: "condensed" };
const FALLBACK_FACE = "@font-face{font-family:'Barlow Condensed Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Arial');size-adjust:74%;ascent-override:118%;descent-override:30%;line-gap-override:0%}";
const LOOPS = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase/loops`;
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

// This page allows pinch-zoom (the app's viewport tag doesn't). While a text
// field has focus (the sign-up dialog) the app's tag is put back, so iOS
// doesn't zoom into the 14 px field; it is also put back on leaving the page.
function useZoomableViewport() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return undefined;
    const isField = (el) => el instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    const lock = (e) => { if (isField(e.target)) meta.setAttribute("content", APP_VIEWPORT); };
    const unlock = (e) => { if (isField(e.target)) meta.setAttribute("content", STICKMAN_VIEWPORT); };
    meta.setAttribute("content", STICKMAN_VIEWPORT);
    document.addEventListener("touchstart", lock, { passive: true });
    document.addEventListener("focusin", lock);
    document.addEventListener("focusout", unlock);
    return () => {
      document.removeEventListener("touchstart", lock);
      document.removeEventListener("focusin", lock);
      document.removeEventListener("focusout", unlock);
      meta.setAttribute("content", APP_VIEWPORT);
    };
  }, []);
}

function SectionTitle({ id, children, lead, center = false }) {
  return (
    <div className={center ? "mx-auto max-w-[720px] text-center" : "max-w-[760px]"}>
      <h2 id={id} style={DISPLAY} className="text-balance text-[34px] font-extrabold uppercase leading-none text-white sm:text-[44px]">{children}</h2>
      {lead && <p className="mt-3 text-[15px] leading-7 text-white/65 sm:text-base">{lead}</p>}
    </div>
  );
}

function MakeVideoLink({ slug, placement, children = "Make your first video" }) {
  return (
    <Link to="/long-form" onClick={() => trackSeoEvent("seo_cta_clicked", { slug, placement })} className={PRIMARY}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

// Poster first (it is the page's largest picture, preloaded in the head). The
// muted loop is fetched only once the page has finished loading, and never
// when the visitor asked for reduced motion.
function HeroLoop({ hero }) {
  const [play, setPlay] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    let timer;
    const start = () => { timer = setTimeout(() => setPlay(true), 2500); };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
    return () => { clearTimeout(timer); window.removeEventListener("load", start); };
  }, []);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0f10] shadow-[0_30px_90px_rgba(0,0,0,.55)]">
      <img src={hero.poster} alt={hero.posterAlt} width="1280" height="720" loading="eager" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      {play && (
        <video muted loop playsInline autoPlay preload="auto" aria-hidden="true" tabIndex={-1} onCanPlay={() => setReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
          <source src={`${LOOPS}/${hero.loop}.webm`} type='video/webm; codecs="vp9"' />
          <source src={`${LOOPS}/${hero.loop}.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

// Click-to-play: the thumbnail is a button; the YouTube iframe exists only after the click.
function LiteYouTube({ video, slug }) {
  const [on, setOn] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-white/10 bg-black">
      {on ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`} title={video.title} allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" className="absolute inset-0 h-full w-full" />
      ) : (
        <button type="button" onClick={() => { trackSeoEvent("seo_tutorial_played", { slug }); setOn(true); }} aria-label={`Play the video: ${video.title}`} className={`group absolute inset-0 h-full w-full ${FOCUS}`}>
          <img src={video.thumb} alt={video.alt} width="960" height="540" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/10" />
          <span className="absolute left-1/2 top-1/2 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-[0_12px_40px_rgba(0,0,0,.5)] transition group-hover:scale-105">
            <Play className="h-7 w-7 translate-x-0.5 fill-current" aria-hidden="true" />
          </span>
          <span className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2 py-1 text-[12px] font-bold tabular-nums text-white">{video.length}</span>
        </button>
      )}
    </div>
  );
}

function Gallery({ gallery }) {
  const [all, setAll] = useState(false);
  const hidden = GALLERY.filter((g) => gallery.groups.some((group) => group.id === g.group)).length - gallery.groups.reduce((n, group) => n + Math.min(gallery.initialPerGroup, GALLERY.filter((g) => g.group === group.id).length), 0);
  return (
    <div className="mt-10 flex flex-col gap-10">
      {gallery.groups.map((group) => {
        const items = GALLERY.filter((g) => g.group === group.id);
        return (
          <div key={group.id}>
            <h3 className="text-[17px] font-bold text-white sm:text-[19px]">{group.title}</h3>
            <ul className={`mt-4 grid grid-cols-2 gap-2.5 sm:gap-4 ${gallery.initialPerGroup % 3 === 0 ? "sm:grid-cols-3" : "lg:grid-cols-4"}`}>
              {(all ? items : items.slice(0, gallery.initialPerGroup)).map((item) => (
                <li key={item.file} className="overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10]">
                  <img src={`${STICKMAN_ASSETS}/${item.file}`} alt={item.alt} width="640" height="360" loading="lazy" decoding="async" className="aspect-video h-auto w-full object-cover" />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {!all && hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className={`${SECONDARY} self-center`}>
          Show {hidden} more scenes <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function StickmanVideoLanding({ page }) {
  useDisplayFont();
  useZoomableViewport();
  const slug = page.path.replace(/^\//, "");
  const tutorial = STICKMAN_VIDEOS[page.tutorial.video];
  const parent = page.slug ? STICKMAN_LANDING_PAGES[0] : null; // a niche page links up to the main page
  const nicheGroups = NICHE_GROUPS.filter((group) => !page.niches.groupIds || page.niches.groupIds.includes(group.id));
  const featuresInThrees = page.features.items.length % 3 === 0;
  return (
    <div className="min-h-screen overflow-x-clip bg-[#0B0D0F] text-white">
      <style dangerouslySetInnerHTML={{ __html: FALLBACK_FACE }} />
      {/* No main element here: the app shell already provides it. */}
      <div data-landing-content>
        {/* 1. Hero */}
        <section className="border-b border-white/[0.07]">
          <div className={`${WRAP} grid items-center gap-10 py-12 md:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-14`}>
            <div>
              {parent && (
                <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-white/60">
                  <Link to={parent.path} className={`rounded font-semibold text-white/75 underline-offset-4 hover:text-lime-300 hover:underline ${FOCUS}`}>{parent.breadcrumb}</Link>
                  <span className="mx-2 text-white/30" aria-hidden="true">/</span>
                  <span aria-current="page">{page.breadcrumb}</span>
                </nav>
              )}
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-300">{page.eyebrow ?? "Zyvo Long Form"}</p>
              <h1 style={DISPLAY} className="mt-3 text-balance text-[46px] font-extrabold uppercase leading-[0.95] text-white sm:text-[64px] lg:text-[72px]">{page.h1}</h1>
              <p className="mt-5 max-w-[56ch] text-[16px] leading-7 text-white/70 sm:text-[18px] sm:leading-8">{page.subhead}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <MakeVideoLink slug={slug} placement="hero" />
                <a href="#tutorial" className={SECONDARY}><Play className="h-4 w-4 fill-current" aria-hidden="true" /> Watch the tutorial</a>
              </div>
              <p className="mt-4 text-[13px] text-white/60">{page.heroNote}</p>
            </div>
            <HeroLoop hero={page.hero} />
          </div>
        </section>

        {/* 2. Made with Zyvo */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="made-with-zyvo">
          <SectionTitle id="made-with-zyvo" lead={page.showcase.lead}>{page.showcase.title}</SectionTitle>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {page.showcase.videos.map((key) => {
              const video = STICKMAN_VIDEOS[key];
              return (
                <a key={key} href={stickmanVideoUrl(key)} target="_blank" rel="noopener noreferrer" onClick={() => trackSeoEvent("seo_showcase_clicked", { slug, video: video.id })}
                  className={`group overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03] transition hover:border-lime-300/40 ${FOCUS}`}>
                  <div className="relative aspect-video overflow-hidden bg-[#0d0f10]">
                    <img src={video.thumb} alt={video.alt} width="640" height="360" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-1 text-[12px] font-bold tabular-nums text-white">{video.length}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 p-5">
                    <h3 className="text-[17px] font-bold leading-snug text-white">{video.title}</h3>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-lime-300">Watch on YouTube <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* 3. How it works */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="how-it-works">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="how-it-works">{page.how.title}</SectionTitle>
            <div className="mt-4 grid max-w-[1000px] gap-4 text-[15px] leading-7 text-white/65 sm:text-base md:grid-cols-2 md:gap-8">
              {page.how.intro.map((text) => <p key={text.slice(0, 24)}>{text}</p>)}
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {page.how.steps.map((step, i) => (
                <li key={step.title} className="flex flex-col rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-300 text-[15px] font-black text-[#11150D]">{i + 1}</span>
                    <h3 className="text-[18px] font-bold leading-snug text-white">{step.title}</h3>
                  </div>
                  <p className="mt-3 text-[14px] leading-6 text-white/65">{step.text}</p>
                  <div className="mt-5 aspect-video overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10] md:mt-auto">
                    <img {...optImg(step.image, "(max-width: 768px) 92vw, 360px", 960)} alt={step.alt} width="960" height="540" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. Gallery */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="gallery">
          <SectionTitle id="gallery" lead={page.gallery.lead}>{page.gallery.title}</SectionTitle>
          <Gallery gallery={page.gallery} />
        </section>

        {/* 5. Video ideas (niche pages) + pick your niche */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="niches">
          <div className={`${WRAP} py-14 md:py-20`}>
            {page.ideas && (
              <div className="mb-16" data-testid="ideas">
                <SectionTitle id="ideas" lead={page.ideas.lead}>{page.ideas.title}</SectionTitle>
                <ol className="mt-9 grid gap-3 md:grid-cols-2">
                  {page.ideas.items.map((idea) => (
                    <li key={idea.title}>
                      <Link to={stickmanNicheHref(idea.niche)} onClick={() => trackSeoEvent("seo_idea_clicked", { slug, niche: idea.niche })}
                        className={`group flex h-full items-center justify-between gap-4 rounded-[16px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-lime-300/40 ${FOCUS}`}>
                        <span>
                          <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-lime-300">{findNiche(idea.niche)?.label}</span>
                          <span className="mt-1 block text-[16px] font-bold leading-snug text-white">{idea.title}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-white/40 transition group-hover:text-lime-300" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <SectionTitle id="niches" lead={page.niches.lead}>{page.niches.title}</SectionTitle>
            <div className="mt-9 flex flex-col gap-9">
              {nicheGroups.map((group) => {
                const groupPage = stickmanGroupPage(group.id);
                return (
                <div key={group.id}>
                  {nicheGroups.length > 1 && (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-[17px] font-bold text-white sm:text-[19px]">{group.label}</h3>
                      {groupPage && groupPage.path !== page.path && (
                        <Link to={groupPage.path} className={`inline-flex items-center gap-1 rounded text-[13px] font-bold text-lime-300 underline-offset-4 hover:underline ${FOCUS}`}>
                          {groupPage.linkLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  )}
                  <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
                    {group.niches.map((niche) => (
                      <li key={niche.id}>
                        <Link to={stickmanNicheHref(niche.id)} onClick={() => trackSeoEvent("seo_niche_clicked", { slug, niche: niche.id })} className={`group block rounded-[14px] ${FOCUS}`}>
                          <div className="aspect-video overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10] transition group-hover:border-lime-300/45">
                            <img {...optImg(`/images/niches/${niche.id}.webp`, "(max-width: 640px) 46vw, 280px", 480)} alt={`${niche.label} stickman video niche`} width="480" height="270" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                          </div>
                          <p className="mt-2.5 text-[14px] font-bold leading-snug text-white group-hover:text-lime-300">{niche.label}</p>
                          <p className="mt-1 text-[13px] leading-5 text-white/60">{niche.description}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6. Features */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="features">
          <SectionTitle id="features">{page.features.title}</SectionTitle>
          <ul className={`mt-9 grid gap-4 sm:grid-cols-2 ${featuresInThrees ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {page.features.items.map((item, i) => (
              <li key={item.title} className={`rounded-[18px] border border-white/10 bg-white/[0.03] p-5 ${i === 0 && !featuresInThrees ? "sm:col-span-2" : ""}`}>
                <h3 className="flex items-start gap-2.5 text-[16px] font-bold leading-snug text-white">
                  <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-lime-300" strokeWidth={3} aria-hidden="true" /> {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-6 text-white/65">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Guide */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="guide">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="guide" lead={page.guide.lead}>{page.guide.title}</SectionTitle>
            <ol className="mt-9 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {page.guide.items.map((item, i) => (
                <li key={item.title} className="flex gap-4">
                  <span style={DISPLAY} className="w-8 shrink-0 text-[34px] font-extrabold leading-none text-lime-300" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3 className="text-[17px] font-bold leading-snug text-white">{item.title}</h3>
                    <p className="mt-2 text-[14.5px] leading-7 text-white/65">{item.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 7. Tutorial */}
        <section id="tutorial" className={`${WRAP} scroll-mt-20 py-14 md:py-20`} aria-labelledby="tutorial-title">
          <SectionTitle id="tutorial-title" lead={page.tutorial.lead} center>{page.tutorial.title}</SectionTitle>
          <div className="mx-auto mt-8 max-w-[880px]"><LiteYouTube video={tutorial} slug={slug} /></div>
        </section>

        {/* 8. Pricing */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="pricing">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="pricing" lead={page.pricing.lead}>{page.pricing.title}</SectionTitle>
            <ul className="mt-9 grid gap-4 sm:grid-cols-3">
              {STICKMAN_PRICING.plans.map((plan) => (
                <li key={plan.id} className={`rounded-[20px] border p-6 ${plan.id === "pro" ? "border-lime-300/35 bg-lime-300/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
                  <h3 style={DISPLAY} className={`text-[30px] font-extrabold uppercase leading-none ${plan.id === "pro" ? "text-lime-300" : "text-white"}`}>{plan.name}</h3>
                  <p className="mt-3 text-[15px] text-white/65"><span className="text-[26px] font-black tabular-nums text-white">€{plan.price}</span> / month</p>
                  <p className="mt-3 text-[14.5px] leading-6 text-white/75">About <span className="font-bold text-white">{plan.videos} ten-minute videos</span> a month</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-[760px] text-[13px] leading-6 text-white/60">{page.pricing.note}</p>
            <Link to="/workspace/pricing" className={`${SECONDARY} mt-6`}>See all plans and prices <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </section>

        {/* 9. FAQ */}
        <section className="mx-auto w-full max-w-[820px] px-4 py-14 sm:px-6 md:py-20" aria-labelledby="faq">
          <SectionTitle id="faq" center>{page.faqTitle ?? "Questions and answers"}</SectionTitle>
          <div className="mt-9 flex flex-col gap-3">
            {page.faq.map((item) => (
              <details key={item.q} className="group rounded-[16px] border border-white/10 bg-white/[0.03] px-5 py-4">
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-[16px] font-bold text-white [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                  <h3 className="text-[16px] font-bold">{item.q}</h3>
                  <Plus className="h-4 w-4 shrink-0 text-lime-300 transition group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-[14.5px] leading-7 text-white/65">{item.a}</p>
              </details>
            ))}
          </div>
          <nav className="mt-10" aria-label={page.related.title}>
            <h3 className="text-[13px] font-black uppercase tracking-[0.16em] text-white/60">{page.related.title}</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {page.related.links.map((link) => (
                <li key={link.to}><Link to={link.to} className={`rounded text-[15px] font-semibold text-lime-300 underline-offset-4 hover:underline ${FOCUS}`}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
        </section>

        {/* 10. Final CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1000px] rounded-[28px] border border-lime-300/20 bg-lime-300/[0.05] px-6 py-12 text-center sm:px-10">
            <h2 style={DISPLAY} className="text-balance text-[38px] font-extrabold uppercase leading-none text-white sm:text-[50px]">{page.cta.title}</h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-7 text-white/65">{page.cta.text}</p>
            <div className="mt-7 flex justify-center"><MakeVideoLink slug={slug} placement="final" /></div>
          </div>
        </section>
      </div>
      <div data-landing-footer><Footer /></div>
    </div>
  );
}
