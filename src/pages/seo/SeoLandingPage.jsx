import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getSeoLandingPage, resolveRelatedLandingPages, SITE_URL } from "../../data/seoLandingPages.js";
import { getSeoBlogPost } from "../../data/seoBlogPosts.js";
import { useSEO } from "../../hooks/useSEO.js";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { captureFirstTouch } from "../../lib/firstTouch.js";
import SeoBreadcrumbs from "../../components/seo/SeoBreadcrumbs.jsx";
import SeoGeneratorHero from "../../components/seo/SeoGeneratorHero.jsx";
import SeoIntro from "../../components/seo/SeoIntro.jsx";
import SeoHowItWorks from "../../components/seo/SeoHowItWorks.jsx";
import SeoPromptExamples from "../../components/seo/SeoPromptExamples.jsx";
import SeoExampleGallery from "../../components/seo/SeoExampleGallery.jsx";
import SeoFaq from "../../components/seo/SeoFaq.jsx";
import SeoRelatedTools from "../../components/seo/SeoRelatedTools.jsx";
import SeoRelatedArticles from "../../components/seo/SeoRelatedArticles.jsx";
import SeoFinalCTA from "../../components/seo/SeoFinalCTA.jsx";
import Footer from "../../components/workspace/footer.jsx";

const GALLERY_QUALIFIERS = [
  "cinematic late-night scene",
  "nostalgic night-time frame",
  "AI generated 2AM moment",
  "liminal late-night atmosphere",
  "moody nighttime scene",
  "quiet 2AM slideshow frame",
];

function buildGalleryImages(config) {
  const previews = config.assets?.previews || [];
  return previews.map((src, index) => ({
    src,
    alt: `${config.seo.primaryKeyword} — ${GALLERY_QUALIFIERS[index % GALLERY_QUALIFIERS.length]}`,
  }));
}

function buildStructuredData(config, canonical) {
  const graph = [
    {
      "@type": "SoftwareApplication",
      name: config.hero?.heading || config.seo.title,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    },
  ];

  if (config.sections?.faq?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: config.sections.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  if (config.breadcrumb?.length > 1) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: config.breadcrumb.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
        item: `${SITE_URL}${item.to}`,
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export default function SeoLandingPage({ slug }) {
  const config = getSeoLandingPage(slug);
  const [searchParams] = useSearchParams();
  // Deep-link support (e.g. from a blog post's "Try this prompt" link):
  // the canonical URL stays clean/query-free, only the initial input value
  // is seeded from ?prompt=, per the brief's "query state, clean canonical" rule.
  const [prompt, setPrompt] = useState(() => searchParams.get("prompt") || "");

  const canonical = config ? `${SITE_URL}/${config.slug}` : SITE_URL;

  useSEO({
    title: config?.seo.title,
    description: config?.seo.description,
    canonical,
    ogImage: config?.seo.ogImage,
    robots: config?.published ? "index, follow, max-image-preview:large" : "noindex, nofollow",
    structuredData: config ? buildStructuredData(config, canonical) : null,
  });

  useEffect(() => {
    if (!config) return;
    captureFirstTouch(config.slug);
    const params = new URLSearchParams(window.location.search);
    trackSeoEvent("seo_landing_view", {
      slug: config.slug,
      templateId: config.templateId,
      referrer: document.referrer || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    });
  }, [config]);

  if (!config) return null;

  const relatedPages = resolveRelatedLandingPages(config);
  const relatedPosts = (config.relatedBlogPosts || []).map(getSeoBlogPost).filter(Boolean);

  const selectPrompt = (text) => {
    setPrompt(text);
    document.getElementById("seo-hero")?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("seo-hero-prompt")?.focus();
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white">
      <SeoBreadcrumbs items={config.breadcrumb} />

      <main className="mx-auto max-w-[1200px] px-4 pb-6 pt-8 sm:px-6">
        <SeoGeneratorHero config={config} prompt={prompt} onPromptChange={setPrompt} variant="hero" id="seo-hero" />
      </main>

      <SeoIntro text={config.sections?.intro} />
      <SeoHowItWorks steps={config.sections?.howItWorks} />
      <SeoPromptExamples prompts={config.examplePrompts} onSelect={selectPrompt} />
      <SeoExampleGallery images={buildGalleryImages(config)} />
      <SeoFaq items={config.sections?.faq} />
      <SeoRelatedTools pages={relatedPages} />
      <SeoRelatedArticles posts={relatedPosts} />
      <SeoFinalCTA config={config} prompt={prompt} onPromptChange={setPrompt} />

      <Footer />
    </div>
  );
}
