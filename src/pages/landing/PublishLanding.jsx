import { createElement, useEffect } from "react";
import { Link } from "react-router-dom";
import publishCalendarVisual from "../../assets/blog/publish/publish-landing-hero-wide.png";
import publishAnalyticsVisual from "../../assets/blog/publish/analytics-landing-hero-wide.png";
import publishHubVisual from "../../assets/blog/publish/publish-hub-square.png";
import calendarVisual from "../../assets/blog/publish/calendar-28-days-square.png";
import uploadOnceVisual from "../../assets/blog/publish/upload-once-square.png";
import publishSleepingVisual from "../../assets/blog/publish/publish-while-sleeping-vertical.png";
import manualVsAutomatedVisual from "../../assets/blog/publish/manual-vs-automated-wide.png";
import multiPlatformDistributionVisual from "../../assets/blog/publish/multi-platform-distribution-wide.png";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  History,
  Link2,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

const CANONICAL_URL = "https://www.tryzyvo.com/publish";

const FAQS = [
  {
    question: "What is a social media publishing tool?",
    answer:
      "A social media publishing tool lets you prepare, schedule, and publish content from one dashboard instead of uploading it separately in every social app. Zyvo Publish is built for short-form video creators who want one simple workflow for Instagram, TikTok, and YouTube.",
  },
  {
    question: "Which social media platforms does Zyvo Publish support?",
    answer:
      "Zyvo Publish connects Instagram, TikTok, and YouTube. You can choose one platform or send the same video to all three in a single publishing workflow.",
  },
  {
    question: "How far in advance can I schedule posts?",
    answer:
      "You can plan and schedule supported posts up to 28 days in advance. The posting queue gives you a clear view of what is coming next, so you can fill gaps before they become missed posting days.",
  },
  {
    question: "Can I publish one video to Instagram, TikTok, and YouTube at the same time?",
    answer:
      "Yes. Select your connected Instagram, TikTok, and YouTube accounts when you create a post, add the platform details, and publish from one screen. Zyvo handles the separate platform jobs in the background.",
  },
  {
    question: "Can I use videos I already made?",
    answer:
      "Yes. Pick a finished video from your Zyvo Creations library or upload your own vertical video. You do not need to generate the video in Zyvo before publishing it.",
  },
  {
    question: "Do I need a business account to publish to Instagram?",
    answer:
      "Instagram direct publishing requires an Instagram Creator or Business account. Switching is free in Instagram settings. You stay in control of the accounts you connect and can disconnect them whenever you want.",
  },
  {
    question: "What happens after I publish a post?",
    answer:
      "Zyvo shows the status of each platform job as it moves from queued to preparing, processing, publishing, and published. Your past publications stay together with their captions, dates, and links.",
  },
  {
    question: "Does every TikTok post go live immediately?",
    answer:
      "Depending on your account and the post settings, a TikTok video can either publish directly or be sent to your TikTok Drafts for a final review before it goes live — Zyvo shows you which one happened.",
  },
  {
    question: "What happens if a post fails?",
    answer:
      "Zyvo marks the job as failed and tells you which platform it happened on, so you can review and retry it instead of wondering whether it silently went live.",
  },
];

const PLATFORM_STYLES = {
  instagram:
    "bg-gradient-to-br from-[#833AB4] via-[#C13584] to-[#F77737] shadow-[0_10px_30px_rgba(193,53,132,0.28)]",
  tiktok: "bg-[#111318] shadow-[3px_2px_0_rgba(238,29,82,.38),-3px_-2px_0_rgba(37,244,238,.3)]",
  youtube: "bg-[#FF0000] shadow-[0_10px_30px_rgba(255,0,0,0.25)]",
};

function InstagramIcon({ className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.67 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07ZM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.7 21.31.27 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.89 1.44 1.44 0 0 0 0-2.89Z" />
    </svg>
  );
}

function TikTokIcon({ className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.88-3.28c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 1 0 6.33 6.34V8.79a8.18 8.18 0 0 0 4.78 1.52V6.85c-.34 0-.68-.06-1.01-.16Z" />
    </svg>
  );
}

function YouTubeIcon({ className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 6.21a3 3 0 0 0-2.09-2.09c-1.87-.5-9.4-.5-9.4-.5s-7.5-.01-9.4.5A3 3 0 0 0 .53 6.21 31.25 31.25 0 0 0 0 12.01c0 1.96.18 3.9.52 5.78a3 3 0 0 0 2.09 2.09c1.87.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.09-2.09c.33-1.88.5-3.82.5-5.78 0-1.97-.17-3.91-.5-5.8ZM9.61 15.6V8.41l6.26 3.6-6.26 3.59Z" />
    </svg>
  );
}

function PlatformIcon({ platform, className = "h-5 w-5" }) {
  if (platform === "instagram") return <InstagramIcon className={className} />;
  if (platform === "tiktok") return <TikTokIcon className={className} />;
  return <YouTubeIcon className={className} />;
}

function FeatureCard({ icon: Icon, eyebrow, title, children, className = "" }) {
  return (
    <article className={`group relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-400/25 hover:bg-white/[0.04] ${className}`}>
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/[0.05] blur-3xl transition group-hover:bg-violet-500/10" />
      <div className="relative">
        <span className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-400/[0.09] text-violet-300 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
          {createElement(Icon, { className: "h-5 w-5" })}
        </span>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-300/80">{eyebrow}</p>
        <h3 className="mt-2 text-xl font-extrabold tracking-tight text-white">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-white/45">{children}</p>
      </div>
    </article>
  );
}

function InternalLinkCard({ to, eyebrow, title, description, cta = "Open tool" }) {
  return (
    <Link
      to={to}
      className="group rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-white/[0.045]"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300/70">{eyebrow}</p>
      <h3 className="mt-2 text-[15px] font-bold text-white transition group-hover:text-violet-200">{title}</h3>
      <p className="mt-2 text-[12px] leading-5 text-white/38">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-300">
        {cta}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export default function PublishLanding() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Social Media Scheduler for Instagram, TikTok & YouTube | Zyvo Publish";

    const upsertMeta = (attribute, key, content) => {
      let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    const description =
      "Schedule social media posts up to 28 days ahead and publish videos to Instagram, TikTok, and YouTube at the same time with Zyvo Publish.";

    upsertMeta("name", "description", description);
    upsertMeta("name", "keywords", "social media scheduler, social media publishing tool, schedule social media posts, Instagram scheduler, TikTok scheduler, YouTube scheduler, cross post social media, video scheduling tool");
    upsertMeta("name", "robots", "index, follow, max-image-preview:large");
    upsertMeta("property", "og:title", "Zyvo Publish â€” Social Media Scheduler for Short-Form Video");
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", CANONICAL_URL);
    upsertMeta("property", "og:image", "https://www.tryzyvo.com/og-image.png");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", "Zyvo Publish â€” Schedule Once, Post Everywhere");
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", "https://www.tryzyvo.com/og-image.png");

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = CANONICAL_URL;

    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          "@id": `${CANONICAL_URL}#software`,
          name: "Zyvo Publish",
          url: CANONICAL_URL,
          description,
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "Social Media Management Software",
          operatingSystem: "Web",
          featureList: [
            "Publish videos to Instagram, TikTok, and YouTube",
            "Schedule supported posts up to 28 days in advance",
            "Multi-platform video publishing",
            "Social media posting queue",
            "Publishing status and history",
          ],
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "EUR",
            description: "Free plan available",
          },
          publisher: {
            "@type": "Organization",
            name: "Zyvo",
            url: "https://www.tryzyvo.com/",
          },
        },
        {
          "@type": "FAQPage",
          "@id": `${CANONICAL_URL}#faq`,
          mainEntity: FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Zyvo",
              item: "https://www.tryzyvo.com/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Publish",
              item: CANONICAL_URL,
            },
          ],
        },
      ],
    };

    let schema = document.getElementById("publish-landing-schema");
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "publish-landing-schema";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify(structuredData);

    return () => {
      document.title = previousTitle;
      schema?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#08090b] font-['Inter',sans-serif] text-white selection:bg-violet-500/35">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Zyvo home">
            <img src="/favicon.png" alt="" className="h-8 w-8 rounded-[10px]" />
            <span className="text-lg font-black tracking-[-0.04em]">Zyvo</span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-[13px] font-semibold text-white/50 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#guides" className="transition hover:text-white">Guides</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/workspace/pricing" className="hidden rounded-xl px-3.5 py-2 text-[12px] font-bold text-white/55 transition hover:bg-white/[0.05] hover:text-white sm:block">
              Pricing
            </Link>
            <Link
              to="/workspace/publish"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[12px] font-extrabold text-[#090a0c] transition hover:bg-violet-100"
            >
              Open Publish
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pb-20 pt-16 sm:pb-28 sm:pt-24 lg:pb-32">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-18rem] h-[52rem] w-[52rem] -translate-x-1/2 rounded-full bg-violet-600/[0.12] blur-[150px]" />
            <div className="absolute right-[-12rem] top-[14rem] h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/[0.07] blur-[140px]" />
            <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/[0.08] px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-200">New Â· Zyvo Publish</span>
                </div>

                <h1 className="text-balance text-[42px] font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-[62px] lg:text-[68px]">
                  Schedule once.
                  <span className="block bg-gradient-to-r from-[#b7a4ff] via-[#d9b8ff] to-[#ffb4d9] bg-clip-text text-transparent">
                    Show up everywhere.
                  </span>
                </h1>

                <p className="mt-7 max-w-xl text-[16px] leading-7 text-white/50 sm:text-[18px]">
                  The social media scheduler built for video creators. Plan posts up to{" "}
                  <strong className="font-bold text-white/80">28 days ahead</strong> and publish to{" "}
                  <strong className="font-bold text-white/80">Instagram, TikTok, and YouTube</strong>{" "}
                  from one focused workspace.
                </p>

                <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
                  <Link
                    to="/workspace/publish"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7448ff] to-[#9d6bff] px-7 py-4 text-[14px] font-extrabold text-white shadow-[0_18px_55px_rgba(116,72,255,.35)] transition hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
                  >
                    Start publishing free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    to="/blog/schedule-auto-publish-ai-videos"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-7 py-4 text-[14px] font-bold text-white/65 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:w-auto"
                  >
                    See the publishing guide
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-white/35">
                  {["Free to start", "No credit card required", "Connect in minutes"].map((item) => (
                    <span key={item} className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-300/80" />
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">Publish short-form video across</p>
                  <div className="mt-5 flex flex-wrap items-center gap-3 sm:gap-4">
                    {[
                      { platform: "instagram", label: "Instagram Reels" },
                      { platform: "tiktok", label: "TikTok" },
                      { platform: "youtube", label: "YouTube Shorts" },
                    ].map(({ platform, label }) => (
                      <div key={platform} className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] text-white ${PLATFORM_STYLES[platform]}`}>
                          <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[12px] font-bold text-white/65">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-[380px] lg:max-w-none">
                <div className="absolute -inset-10 rounded-full bg-violet-500/15 blur-[90px]" />
                <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#090a0d] p-1.5 shadow-[0_40px_110px_rgba(0,0,0,.58)] sm:rounded-[34px] sm:p-2">
                  <img
                    src={publishSleepingVisual}
                    alt="A desk at night with a phone showing content flowing up into Instagram, TikTok, and YouTube panels on the wall, representing publishing while you sleep"
                    className="aspect-[3/4] w-full rounded-[22px] object-cover sm:rounded-[27px]"
                    loading="eager"
                    fetchPriority="high"
                  />
                  <div className="pointer-events-none absolute inset-1.5 rounded-[22px] ring-1 ring-inset ring-white/[0.05] sm:inset-2 sm:rounded-[27px]" />
                </div>
                <div className="pointer-events-none absolute -bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#101116]/90 px-3 py-2 shadow-2xl backdrop-blur-xl sm:flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[9px] font-bold text-white">Queued while you're offline</span>
                    <span className="block text-[8px] text-white/30">Instagram Â· TikTok Â· YouTube</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-white/[0.06] bg-[#0b0c0f] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">A calmer publishing workflow</p>
              <h2 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[50px]">
                Less tab-hopping.
                <span className="block text-white/35">More consistent posting.</span>
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-white/42">
                Zyvo Publish removes the repetitive work between a finished video and a live post, so your content calendar keeps moving even when your day gets busy.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={Send} eyebrow="Cross-post" title="Post to all 3 at once">
                Select Instagram, TikTok, and YouTube in the same composer. Upload once and start every platform job from one screen.
              </FeatureCard>
              <FeatureCard icon={CalendarDays} eyebrow="Plan ahead" title="Schedule up to 28 days">
                Turn a batch of finished videos into nearly a month of planned content. See busy days and empty gaps before they affect consistency.
              </FeatureCard>
              <FeatureCard icon={WandSparkles} eyebrow="Create faster" title="AI-assisted captions">
                Move past the blank caption box with on-demand caption support, then refine the copy and platform details before anything goes live.
              </FeatureCard>
              <FeatureCard icon={Link2} eyebrow="Connect once" title="Your channels, together">
                Keep connected Instagram, TikTok, and YouTube accounts in one place and choose exactly where each video should be published.
              </FeatureCard>
              <FeatureCard icon={History} eyebrow="Stay informed" title="Live status and history">
                Follow each post from queued to published. Past Publications keeps your captions, dates, statuses, and live links easy to find.
              </FeatureCard>
              <FeatureCard icon={ShieldCheck} eyebrow="Stay in control" title="Nothing posts by accident">
                Empty schedule slots stay empty. You select the video, account, copy, privacy options, and time before Zyvo starts publishing.
              </FeatureCard>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { src: uploadOnceVisual, alt: "Upload one video and distribute it to multiple social platforms" },
                { src: calendarVisual, alt: "Visual 28-day social media content calendar" },
                { src: publishHubVisual, alt: "Central multi-platform social media publishing hub" },
              ].map((visual) => (
                <figure key={visual.alt} className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#090a0d] p-1.5">
                  <img src={visual.src} alt={visual.alt} className="aspect-square w-full rounded-[19px] object-cover" loading="lazy" />
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">How Zyvo Publish works</p>
                <h2 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[48px]">
                  From finished video to live post in three steps.
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-7 text-white/42">
                  A short workflow designed around the way creators actually batch, caption, and distribute vertical video.
                </p>
                <Link to="/workspace/publish" className="mt-8 inline-flex items-center gap-2 text-[13px] font-extrabold text-violet-300 hover:text-violet-200">
                  Open the Publish workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <figure className="mt-10 hidden overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.4)] lg:block">
                  <img
                    src={publishCalendarVisual}
                    alt="Zyvo Publish calendar showing scheduled videos for Instagram, TikTok, and YouTube"
                    className="aspect-[1376/768] w-full rounded-[17px] object-cover"
                    loading="lazy"
                  />
                </figure>
              </div>

              <div className="space-y-4">
                {[
                  {
                    n: "01",
                    icon: Link2,
                    title: "Connect your social accounts",
                    body: "Link Instagram, TikTok, and YouTube once through the Connections workspace. Your accounts are then ready to select whenever you publish.",
                    link: "/workspace/connections",
                    linkLabel: "Connect accounts",
                  },
                  {
                    n: "02",
                    icon: Play,
                    title: "Choose a video and prepare each post",
                    body: "Pick a video from Creations or upload your own. Select the channels, write captions, add a YouTube title, and review platform options in one composer.",
                    link: "/workspace/creations",
                    linkLabel: "View Creations",
                  },
                  {
                    n: "03",
                    icon: Zap,
                    title: "Publish now or plan ahead",
                    body: "Send the video to all three platforms now, or add supported posts to your calendar up to 28 days ahead. Zyvo tracks every job while it publishes.",
                    link: "/workspace/publish",
                    linkLabel: "Schedule a post",
                  },
                ].map((step) => (
                  <article key={step.n} className="group grid gap-5 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-6 transition hover:border-violet-400/25 hover:bg-white/[0.04] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#101116] text-violet-300">
                      {createElement(step.icon, { className: "h-5 w-5" })}
                      <span className="absolute -right-2 -top-2 rounded-full border border-white/10 bg-[#19131f] px-1.5 py-0.5 text-[8px] font-black text-white/35">{step.n}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold tracking-tight text-white">{step.title}</h3>
                      <p className="mt-2 text-[13px] leading-6 text-white/42">{step.body}</p>
                    </div>
                    <Link to={step.link} aria-label={step.linkLabel} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-white/35 transition group-hover:border-violet-300/25 group-hover:text-violet-300">
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-[#0b0c0f] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">One source of truth</p>
              <h2 className="mt-4 text-[34px] font-black leading-[1.06] tracking-[-0.04em] sm:text-[48px]">
                Your content calendar should tell you what happens next.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-white/42">
                Replace scattered notes, alarms, and half-finished uploads with a queue you can understand at a glance.
              </p>
            </div>

            <figure className="relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#090a0d] p-1.5 shadow-[0_30px_90px_rgba(0,0,0,.38)] sm:rounded-[30px] sm:p-2">
              <img
                src={manualVsAutomatedVisual}
                alt="A cluttered desk of scattered manual reminders and clocks next to a clean automated pipeline flowing into Instagram, TikTok, and YouTube"
                className="aspect-[688/384] w-full rounded-[19px] object-cover sm:rounded-[23px]"
                loading="lazy"
              />
            </figure>

            <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.02] p-6 sm:p-8">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/25">Posting manually</p>
                <ul className="mt-6 space-y-4">
                  {[
                    "Upload the same file three times",
                    "Rewrite and paste captions in every app",
                    "Set reminders for every posting time",
                    "Check each platform to confirm it went live",
                    "Lose track of what was already posted",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[13px] leading-6 text-white/35">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-violet-400/25 bg-violet-500/[0.075] p-6 shadow-[0_24px_90px_rgba(113,70,255,.12)] sm:p-8">
                <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
                <p className="relative text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-300">Publishing with Zyvo</p>
                <ul className="relative mt-6 space-y-4">
                  {[
                    "Choose one video once",
                    "Prepare all platform details in one composer",
                    "Publish to Instagram, TikTok, and YouTube together",
                    "Plan supported posts up to 28 days ahead",
                    "See status and publication history in one place",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[13px] font-medium leading-6 text-white/70">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-emerald-300">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <figure className="relative mx-auto mt-6 max-w-5xl overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#090a0d] p-1.5 shadow-[0_30px_90px_rgba(0,0,0,.38)] sm:rounded-[30px] sm:p-2">
              <img
                src={publishAnalyticsVisual}
                alt="Zyvo content analytics dashboard showing views and audience growth"
                className="aspect-[1376/768] w-full rounded-[19px] object-cover sm:rounded-[23px]"
                loading="lazy"
              />
            </figure>
          </div>
        </section>

        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">Built per platform</p>
              <h2 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[46px]">
                Every platform has its own rules. Zyvo handles them separately.
              </h2>
            </div>
            <figure className="relative mx-auto mb-12 max-w-4xl overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#090a0d] p-1.5 shadow-[0_30px_90px_rgba(0,0,0,.38)] sm:rounded-[30px] sm:p-2">
              <img
                src={multiPlatformDistributionVisual}
                alt="A single content pipeline branching out into separate Instagram, TikTok, and YouTube panels"
                className="aspect-[688/384] w-full rounded-[19px] object-cover sm:rounded-[23px]"
                loading="lazy"
              />
            </figure>
            <div className="grid gap-5 lg:grid-cols-3">
              {[
                {
                  platform: "instagram",
                  title: "Instagram Reels publishing",
                  description: "Send finished vertical videos to your connected Instagram Creator or Business account without leaving Zyvo.",
                  bullets: ["Direct Reel publishing", "Caption and hashtags", "Publication status"],
                },
                {
                  platform: "tiktok",
                  title: "TikTok video publishing",
                  description: "Prepare your TikTok post, review account posting options, and send it through Zyvo's focused publishing flow.",
                  bullets: ["Direct post or draft flow", "Privacy controls", "Caption support"],
                },
                {
                  platform: "youtube",
                  title: "YouTube Shorts publishing",
                  description: "Upload short-form videos to YouTube with a required title and dedicated description from the same composer.",
                  bullets: ["Title and description", "Background upload", "Channel status"],
                },
              ].map((card) => (
                <article key={card.platform} className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${PLATFORM_STYLES[card.platform]}`}>
                    <PlatformIcon platform={card.platform} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-7 text-xl font-extrabold tracking-tight">{card.title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-white/42">{card.description}</p>
                  <ul className="mt-6 space-y-2.5">
                    {card.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-2 text-[12px] font-medium text-white/55">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/80" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="guides" className="border-y border-white/[0.06] bg-[#0b0c0f] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">Keep learning, keep creating</p>
                <h2 className="mt-4 text-[34px] font-black tracking-[-0.04em] sm:text-[46px]">Tools and guides for your next post.</h2>
              </div>
              <Link to="/blog" className="inline-flex items-center gap-2 text-[12px] font-bold text-white/45 transition hover:text-white">
                Explore the Zyvo blog
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-12 text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">Publishing &amp; growth guides</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <InternalLinkCard
                to="/blog/schedule-auto-publish-ai-videos"
                eyebrow="8 min guide"
                title="How to schedule and auto-publish AI videos"
                description="A practical walkthrough for connecting accounts, preparing posts, and building a reliable publishing routine."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/one-click-publishing-playbook"
                eyebrow="Publishing strategy"
                title="Why consistency beats chasing one viral hit"
                description="Turn posting into a repeatable system that keeps working after the first burst of motivation."
                cta="Read playbook"
              />
              <InternalLinkCard
                to="/blog/social-media-scheduler-for-creators"
                eyebrow="Complete guide"
                title="Choose a scheduler built for creators"
                description="Learn which scheduling features matter for short-form video and how to build a sustainable workflow."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/what-is-zyvo-publish"
                eyebrow="Explained"
                title="What is Zyvo Publish?"
                description="A deeper look at the scheduling and posting tool, written for creators comparing options."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/28-day-social-media-content-calendar"
                eyebrow="Content planning"
                title="Build a 28-day content calendar"
                description="A practical structure for planning a month of posts at once instead of deciding daily."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/how-often-should-you-post"
                eyebrow="Growth"
                title="How often should you actually post?"
                description="A realistic answer based on where your account is right now, not a generic daily rule."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/content-slump-recovery"
                eyebrow="Growth"
                title="Recover from a content slump"
                description="What actually gets posting moving again after a gap — it isn't motivation."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/repurpose-one-video-ten-pieces"
                eyebrow="Tutorial"
                title="Turn one video into 10 pieces of content"
                description="Four ways to split a single multi-scene generation into a full week of posts."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/multi-format-weekly-calendar"
                eyebrow="Growth"
                title="Build a multi-format weekly lineup"
                description="A sample week that spreads several Zyvo formats across different moods, ready to schedule."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/cross-promote-zyvo-formats"
                eyebrow="Growth"
                title="Turn one audience into many"
                description="How a viewer of one format becomes a viewer of another, without making any new content."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/tiktok-algorithm-explained"
                eyebrow="Algorithm"
                title="What actually gets TikTok videos seen"
                description="What consistently correlates with reach, and three myths worth retiring."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/instagram-reels-algorithm-explained"
                eyebrow="Algorithm"
                title="How Reels reach actually works"
                description="Four real differences between Reels and TikTok distribution, and how to plan for each."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/how-to-cross-post-instagram-tiktok-youtube"
                eyebrow="Tutorial"
                title="Cross-post without tripling your work"
                description="One video, three platforms, prepared once instead of uploaded three separate times."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/blog/short-form-video-metrics-that-matter"
                eyebrow="Analytics"
                title="The metrics that actually matter"
                description="Views, watch time, retention, and engagement — read together instead of in isolation."
                cta="Read guide"
              />
              <InternalLinkCard
                to="/stats"
                eyebrow="Creator analytics"
                title="Measure what happens after publishing"
                description="Track YouTube views, watch time, subscribers, daily trends, and top-performing videos."
                cta="Explore Stats"
              />
              <InternalLinkCard
                to="/connections"
                eyebrow="Account management"
                title="Connect Instagram, TikTok, and YouTube"
                description="Keep publishing destinations organized and ready before you prepare the next post."
                cta="Explore Connections"
              />
            </div>

            <p className="mt-14 text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">Or start with a new video</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <InternalLinkCard
                to="/workspace/video-generator"
                eyebrow="AI video tool"
                title="Create your next vertical video"
                description="Generate short-form AI video, then move the finished result directly into your publishing workflow."
              />
              <InternalLinkCard
                to="/workspace/viral-script"
                eyebrow="AI writing tool"
                title="Start with a stronger viral script"
                description="Build hooks, structure, and scenes for TikTok, Reels, and Shorts before you generate the video."
              />
              <InternalLinkCard
                to="/ai-fruit-story-maker"
                eyebrow="Viral video format"
                title="Make an AI fruit story"
                description="Create a complete talking fruit drama video designed for short-form social feeds."
              />
              <InternalLinkCard
                to="/face-asmr-maker"
                eyebrow="Viral video format"
                title="Create a Face ASMR video"
                description="Generate tactile, curiosity-driven ASMR clips and prepare them for your posting calendar."
              />
              <InternalLinkCard
                to="/micro-camera-animal-maker"
                eyebrow="Viral video format"
                title="Make an animal bodycam video"
                description="Build underground animal POV scenes for TikTok, Instagram Reels, and YouTube Shorts."
              />
              <InternalLinkCard
                to="/clay-rescue-maker"
                eyebrow="Viral video format"
                title="Create a Clay Rescue video"
                description="Generate tiny-world rescue stories with a satisfying visual problem and payoff."
              />
              <InternalLinkCard
                to="/behind-the-scenes-video-maker"
                eyebrow="Viral video format"
                title="Create a Behind the Scenes video"
                description="A giant practical disaster hitting a handcrafted miniature city, shot like real movie-set footage."
              />
              <InternalLinkCard
                to="/blog/every-zyvo-video-format-compared"
                eyebrow="Comparison hub"
                title="Every Zyvo video format compared"
                description="Six format-specific AI video tools, side by side, with what each one actually outputs."
                cta="Compare formats"
              />
            </div>
          </div>
        </section>

        <section id="faq" className="py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">Social media scheduler FAQ</p>
              <h2 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[46px]">Questions before you publish?</h2>
              <p className="mt-5 max-w-sm text-[14px] leading-7 text-white/42">
                The essentials on supported platforms, scheduling, accounts, videos, and what happens after you click publish.
              </p>
              <Link to="/support" className="mt-7 inline-flex items-center gap-2 text-[12px] font-bold text-violet-300 hover:text-violet-200">
                Visit the Support Center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group rounded-[20px] border border-white/[0.08] bg-white/[0.025] px-5 py-4 open:border-violet-400/20 open:bg-violet-400/[0.04]">
                  <summary className="flex list-none items-center justify-between gap-5 text-[14px] font-bold text-white/78">
                    {faq.question}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/35 transition group-open:rotate-45 group-open:text-violet-300">
                      <span className="text-lg font-light leading-none">+</span>
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-2 pt-4 text-[13px] leading-6 text-white/45">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-violet-300/15 bg-gradient-to-br from-[#171126] via-[#100d18] to-[#0b0c0f] px-6 py-14 text-center shadow-[0_35px_110px_rgba(80,44,170,.18)] sm:px-10 sm:py-20">
            <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-500/20 blur-[100px]" />
            <div className="relative">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
                <Send className="h-5 w-5" />
              </span>
              <h2 className="mx-auto mt-7 max-w-3xl text-[34px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[52px]">
                Your next 28 days of content can start today.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-white/45">
                Connect your channels, choose a finished video, and turn publishing into the easiest part of your creative workflow.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/workspace/publish"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-[14px] font-extrabold text-[#090a0c] transition hover:-translate-y-0.5 hover:bg-violet-100 sm:w-auto"
                >
                  Open Zyvo Publish
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/workspace/pricing"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-4 text-[14px] font-bold text-white/65 transition hover:bg-white/[0.07] hover:text-white sm:w-auto"
                >
                  View plans
                </Link>
              </div>
              <p className="mt-5 text-[10px] font-medium text-white/25">Free to start Â· No credit card required</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#060709]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-[1.2fr_.8fr_.8fr_.8fr] sm:px-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <img src="/favicon.png" alt="" className="h-8 w-8 rounded-[10px]" />
              <span className="text-lg font-black tracking-[-0.04em]">Zyvo</span>
            </Link>
            <p className="mt-4 max-w-xs text-[12px] leading-5 text-white/30">Create, schedule, and publish short-form content from one AI-powered workspace.</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/25">Publish</p>
            <div className="mt-4 flex flex-col gap-3 text-[12px] text-white/45">
              <Link to="/workspace/publish" className="hover:text-white">Publishing workspace</Link>
              <Link to="/connections" className="hover:text-white">Connect accounts</Link>
              <Link to="/stats" className="hover:text-white">Content stats</Link>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/25">Create</p>
            <div className="mt-4 flex flex-col gap-3 text-[12px] text-white/45">
              <Link to="/workspace/video-generator" className="hover:text-white">AI video generator</Link>
              <Link to="/workspace/image-generator" className="hover:text-white">AI image generator</Link>
              <Link to="/workspace/viral-script" className="hover:text-white">Viral script builder</Link>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/25">Learn</p>
            <div className="mt-4 flex flex-col gap-3 text-[12px] text-white/45">
              <Link to="/blog" className="hover:text-white">Blog</Link>
              <Link to="/support" className="hover:text-white">Support</Link>
              <Link to="/workspace/pricing" className="hover:text-white">Pricing</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.05]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[10px] text-white/20 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>Â© 2026 Zyvo. All rights reserved.</span>
            <span>Built for creators who keep showing up.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
