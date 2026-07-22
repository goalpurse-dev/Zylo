import { createElement, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Sparkles } from "lucide-react";

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function FeatureCard({ feature }) {
  return (
    <article className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-violet-400/25 hover:bg-white/[0.04]">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-400/[0.09] text-violet-300">
        {createElement(feature.icon, { className: "h-5 w-5" })}
      </span>
      <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-300/75">{feature.eyebrow}</p>
      <h3 className="mt-2 text-xl font-extrabold tracking-tight text-white">{feature.title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/45">{feature.description}</p>
    </article>
  );
}

export default function CreatorSuiteLanding({ config }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = config.seoTitle;
    upsertMeta("name", "description", config.metaDescription);
    upsertMeta("name", "keywords", config.keywords);
    upsertMeta("name", "robots", "index, follow, max-image-preview:large");
    upsertMeta("property", "og:title", config.seoTitle);
    upsertMeta("property", "og:description", config.metaDescription);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", config.canonical);
    upsertMeta("property", "og:image", config.socialImage);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", config.seoTitle);
    upsertMeta("name", "twitter:description", config.metaDescription);
    upsertMeta("name", "twitter:image", config.socialImage);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = config.canonical;

    const schema = document.createElement("script");
    schema.id = `${config.slug}-landing-schema`;
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: config.productName,
          url: config.canonical,
          description: config.metaDescription,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          featureList: config.features.map((feature) => feature.title),
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Free plan available" },
          publisher: { "@type": "Organization", name: "Zyvo", url: "https://www.tryzyvo.com/" },
        },
        {
          "@type": "FAQPage",
          mainEntity: config.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        },
      ],
    });
    document.head.appendChild(schema);

    return () => {
      document.title = previousTitle;
      schema.remove();
    };
  }, [config]);

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
          <Link to={config.primaryPath} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[12px] font-extrabold text-[#090a0c] transition hover:bg-violet-100">
            {config.shortCta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-20rem] h-[58rem] w-[58rem] -translate-x-1/2 rounded-full bg-violet-600/[0.14] blur-[160px]" />
            <div className="absolute right-[-14rem] top-40 h-[34rem] w-[34rem] rounded-full bg-fuchsia-500/[0.07] blur-[150px]" />
            <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/[0.08] px-3.5 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-200">{config.badge}</span>
              </div>
              <h1 className="text-balance text-[42px] font-black leading-[0.98] tracking-[-0.055em] sm:text-[62px] lg:text-[76px]">
                {config.title}
                <span className="block bg-gradient-to-r from-[#b7a4ff] via-[#d9b8ff] to-[#ffb4d9] bg-clip-text text-transparent">
                  {config.gradientTitle}
                </span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-[16px] leading-7 text-white/50 sm:text-[18px]">{config.description}</p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to={config.primaryPath} className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7448ff] to-[#9d6bff] px-7 py-4 text-[14px] font-extrabold shadow-[0_18px_55px_rgba(116,72,255,.35)] transition hover:-translate-y-0.5 hover:brightness-110 sm:w-auto">
                  {config.primaryCta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to={config.secondaryPath} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-7 py-4 text-[14px] font-bold text-white/65 transition hover:bg-white/[0.06] hover:text-white sm:w-auto">
                  {config.secondaryCta}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-white/35">
                {config.trust.map((item) => (
                  <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300/80" />{item}</span>
                ))}
              </div>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:mt-16 lg:grid-cols-4">
              {config.proof.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-4 text-center">
                  <p className="text-lg font-black text-white">{item.value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/30">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-white/[0.06] bg-[#0b0c0f] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">{config.featuresEyebrow}</p>
              <h2 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[50px]">{config.featuresTitle}</h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/42">{config.featuresDescription}</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {config.features.map((feature) => <FeatureCard key={feature.title} feature={feature} />)}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {config.visuals.map((visual) => (
                <figure key={visual.alt} className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#090a0d] p-1.5">
                  <img src={visual.src} alt={visual.alt} className="aspect-square w-full rounded-[19px] object-cover" loading="lazy" />
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr]">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">How it works</p>
                <h2 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[48px]">{config.workflowTitle}</h2>
                <p className="mt-5 max-w-md text-[15px] leading-7 text-white/42">{config.workflowDescription}</p>
              </div>
              <div className="space-y-4">
                {config.workflow.map((step, index) => (
                  <article key={step.title} className="grid gap-5 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-400/[0.08] text-sm font-black text-violet-300">0{index + 1}</span>
                    <div>
                      <h3 className="text-lg font-extrabold">{step.title}</h3>
                      <p className="mt-2 text-[13px] leading-6 text-white/42">{step.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="guides" className="border-y border-white/[0.06] bg-[#0b0c0f] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">Practical guides</p>
            <h2 className="mt-4 text-[34px] font-black tracking-[-0.04em] sm:text-[46px]">{config.guidesTitle}</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {config.guides.map((guide) => (
                <Link key={guide.to} to={guide.to} className="group rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/30">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300/70">{guide.eyebrow}</p>
                  <h3 className="mt-2 text-[16px] font-bold transition group-hover:text-violet-200">{guide.title}</h3>
                  <p className="mt-2 text-[12px] leading-5 text-white/38">{guide.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-300">Read guide <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">{config.faqEyebrow}</p>
              <h2 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[46px]">{config.faqTitle}</h2>
            </div>
            <div className="space-y-3">
              {config.faqs.map((faq) => (
                <details key={faq.question} className="group rounded-[20px] border border-white/[0.08] bg-white/[0.025] px-5 py-4 open:border-violet-400/20">
                  <summary className="flex list-none items-center justify-between gap-5 text-[14px] font-bold text-white/78">
                    {faq.question}
                    <span className="text-xl font-light text-white/35 transition group-open:rotate-45 group-open:text-violet-300">+</span>
                  </summary>
                  <p className="max-w-2xl pb-2 pt-4 text-[13px] leading-6 text-white/45">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-violet-300/15 bg-gradient-to-br from-[#171126] via-[#100d18] to-[#0b0c0f] px-6 py-14 text-center sm:px-10 sm:py-20">
            <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-500/20 blur-[100px]" />
            <div className="relative">
              <h2 className="mx-auto max-w-3xl text-[34px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[52px]">{config.finalTitle}</h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-white/45">{config.finalDescription}</p>
              <Link to={config.primaryPath} className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-[14px] font-extrabold text-[#090a0c] transition hover:bg-violet-100">
                {config.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#060709]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 text-[12px] text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-white"><img src="/favicon.png" alt="" className="h-8 w-8 rounded-[10px]" /><span className="font-black">Zyvo</span></Link>
          <div className="flex flex-wrap gap-5">
            <Link to="/publish" className="hover:text-white">Publish</Link>
            <Link to="/stats" className="hover:text-white">Stats</Link>
            <Link to="/connections" className="hover:text-white">Connections</Link>
            <Link to="/blog" className="hover:text-white">Blog</Link>
            <Link to="/workspace/pricing" className="hover:text-white">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
