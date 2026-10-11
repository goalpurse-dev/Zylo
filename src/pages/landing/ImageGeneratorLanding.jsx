import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Wand2 } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { STICKMAN_FONT_HREF } from "../../data/stickmanLandingPages.js";
import {
  IMAGE_FAQ, IMAGE_GALLERY, IMAGE_GENERATOR_SEO, IMAGE_GUIDES, IMAGE_HERO, IMAGE_PROMPTS, IMAGE_STEPS, IMAGE_TOOL_PATH, IMAGE_USE_CASES, imageSrc,
} from "../../data/imageGeneratorLanding.js";

// /image-generator: the product page of the AI image generator. Its content
// lives in src/data/imageGeneratorLanding.js. Layout follows the Long Form
// landing page (StickmanVideoLanding.jsx); the display font and the colors are
// the Pricing page's (Barlow Condensed, lime on near-black).

const SLUG = "image-generator";
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

// WebP at two widths; the browser takes the one that fits. width/height hold the place before it loads.
function Picture({ item, sizes, eager = false, className = "" }) {
  return (
    <img
      src={imageSrc(item.file, 960)}
      srcSet={`${imageSrc(item.file, 480)} 480w, ${imageSrc(item.file, 960)} 960w`}
      sizes={sizes}
      alt={item.alt}
      width={item.size[0]}
      height={item.size[1]}
      loading={eager ? "eager" : "lazy"}
      {...(eager ? { fetchPriority: "high" } : {})}
      decoding="async"
      className={className}
    />
  );
}

function StartLink({ placement, children = IMAGE_GENERATOR_SEO.cta }) {
  return (
    <Link to={IMAGE_TOOL_PATH} onClick={() => trackSeoEvent("seo_cta_clicked", { slug: SLUG, placement })} className={PRIMARY}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export default function ImageGeneratorLanding() {
  useDisplayFont();
  const navigate = useNavigate();
  // The prompt travels in the navigation state (the tool reads it), never in the URL.
  const tryPrompt = (prompt, index) => {
    trackSeoEvent("seo_prompt_clicked", { slug: SLUG, prompt: index });
    navigate(IMAGE_TOOL_PATH, { state: { prompt } });
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0B0D0F] text-white">
      <style dangerouslySetInnerHTML={{ __html: FALLBACK_FACE }} />
      {/* No main element here: the app shell already provides it. */}
      <div data-landing-content>
        {/* 1. Hero */}
        <section className="border-b border-white/[0.07]">
          <div className={`${WRAP} grid items-center gap-10 py-12 md:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-14`}>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-300">Zyvo image generator</p>
              <h1 style={DISPLAY} className="mt-3 text-balance text-[46px] font-extrabold uppercase leading-[0.95] text-white sm:text-[64px] lg:text-[72px]">{IMAGE_GENERATOR_SEO.h1}</h1>
              <p className="mt-5 max-w-[56ch] text-[16px] leading-7 text-white/70 sm:text-[18px] sm:leading-8">
                Describe a picture and get it in seconds: cinematic scenes, illustrations, realistic shots and 3D renders, sized for TikTok, YouTube thumbnails, product photos and ads.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <StartLink placement="hero" />
                <a href="#gallery" className={SECONDARY}>See what it makes</a>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/60">
                {["5 free images every 30 days", "No card needed", "Square, 16:9 and 9:16"].map((text) => (
                  <li key={text} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" />{text}</li>
                ))}
              </ul>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0f10] shadow-[0_30px_90px_rgba(0,0,0,.55)]">
              <Picture item={IMAGE_HERO} sizes="(max-width: 1024px) 92vw, 600px" eager className="absolute inset-0 h-full w-full object-cover" />
            </div>
          </div>
        </section>

        {/* 2. Style gallery */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="gallery">
          <SectionTitle id="gallery" lead="Every picture here was made with Zyvo from a text prompt. Shown as generated, only resized for this page.">Made with the image generator</SectionTitle>
          <div className="mt-10 flex flex-col gap-10">
            {IMAGE_GALLERY.map((group) => (
              <div key={group.id}>
                <h3 className="text-[17px] font-bold text-white sm:text-[19px]">{group.title}</h3>
                <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
                  {group.items.map((item) => (
                    <li key={item.file} className="overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10]">
                      <Picture item={item} sizes="(max-width: 1024px) 46vw, 280px" className="aspect-video h-auto w-full object-cover" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 3. How it works */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="how-it-works">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="how-it-works">How it works</SectionTitle>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {IMAGE_STEPS.map((step, i) => (
                <li key={step.title} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-300 text-[15px] font-black text-[#11150D]">{i + 1}</span>
                    <h3 className="text-[18px] font-bold leading-snug text-white">{step.title}</h3>
                  </div>
                  <p className="mt-3 text-[14px] leading-6 text-white/65">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-9"><StartLink placement="how" /></div>
          </div>
        </section>

        {/* 4. Use cases */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="use-cases">
          <SectionTitle id="use-cases" lead="One generator for the pictures a channel or a shop needs every week.">What people make with it</SectionTitle>
          <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {IMAGE_USE_CASES.map((item) => (
              <li key={item.title} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-[17px] font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-white/65">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Example prompts next to their results */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="prompts">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="prompts" lead="Four prompts and the picture each one made. Open any of them in the generator and change it to your own idea.">Example prompts and their results</SectionTitle>
            <ul className="mt-9 grid gap-5 md:grid-cols-2">
              {IMAGE_PROMPTS.map((item, index) => (
                <li key={item.file} className="flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
                  <Picture item={item} sizes="(max-width: 768px) 92vw, 560px" className="aspect-video h-auto w-full object-cover" />
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-lime-300">{item.style}</p>
                    <p className="mt-2 text-[14px] leading-6 text-white/75">{item.prompt}</p>
                    <button type="button" onClick={() => tryPrompt(item.prompt, index)} className={`${SECONDARY} mt-5 self-start md:mt-auto`}>
                      <Wand2 className="h-4 w-4" aria-hidden="true" /> Try this prompt
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. FAQ */}
        <section className={`${WRAP} py-14 md:py-20`} aria-labelledby="faq">
          <SectionTitle id="faq">Questions and answers</SectionTitle>
          <div className="mt-8 max-w-[860px] space-y-3">
            {IMAGE_FAQ.map((item) => (
              <details key={item.q} className="group rounded-[16px] border border-white/10 bg-white/[0.03] px-5 py-4">
                <summary className={`cursor-pointer list-none rounded text-[16px] font-bold text-white ${FOCUS}`}>{item.q}</summary>
                <p className="pt-3 text-[14px] leading-6 text-white/65">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 7. Guides */}
        <section className="border-y border-white/[0.07] bg-[#0E1113]" aria-labelledby="guides">
          <div className={`${WRAP} py-14 md:py-20`}>
            <SectionTitle id="guides" lead="Short reads from the Zyvo blog on prompts, styles and common mistakes.">Guides for better images</SectionTitle>
            <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {IMAGE_GUIDES.map((guide) => (
                <li key={guide.to}>
                  <Link to={guide.to} className={`group flex h-full flex-col rounded-[18px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-lime-300/40 ${FOCUS}`}>
                    <span className="text-[16px] font-bold leading-snug text-white group-hover:text-lime-300">{guide.title}</span>
                    <span className="mt-2 text-[14px] leading-6 text-white/60">{guide.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 8. Final call */}
        <section className={`${WRAP} py-16 text-center md:py-24`} aria-labelledby="start">
          <h2 id="start" style={DISPLAY} className="mx-auto max-w-[760px] text-balance text-[38px] font-extrabold uppercase leading-none text-white sm:text-[52px]">Make your first image now</h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-7 text-white/65 sm:text-base">A free account gets 5 image generations every 30 days. No card needed.</p>
          <div className="mt-7 flex justify-center"><StartLink placement="final" /></div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
