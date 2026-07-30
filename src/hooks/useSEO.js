import { useEffect } from "react";

const DEFAULT_TITLE = "Zyvo – Go Viral With AI Content Creation";
const DEFAULT_DESC  =
  "Go viral with AI. Create scroll-stopping images, product photos, backgrounds, and social media content instantly with Zyvo AI.";

export function useSEO({
  title,
  description,
  canonical,
  structuredData,
  ogImage,
  twitterCard = "summary_large_image",
  robots = "index, follow, max-image-preview:large",
} = {}) {
  useEffect(() => {
    const prevTitle = document.title;

    // Title
    document.title = title || DEFAULT_TITLE;

    // Helper to upsert a <meta> tag (by name or property), creating it if absent
    const setMeta = (selector, attr, value) => {
      if (!value) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const match = selector.match(/\[([a-z]+)="([^"]+)"\]/);
        if (match) el.setAttribute(match[1], match[2]);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]',         "content", description || DEFAULT_DESC);
    setMeta('meta[name="robots"]',               "content", robots);
    setMeta('meta[property="og:title"]',         "content", title       || DEFAULT_TITLE);
    setMeta('meta[property="og:description"]',   "content", description || DEFAULT_DESC);
    setMeta('meta[property="og:type"]',          "content", "website");
    if (canonical) setMeta('meta[property="og:url"]', "content", canonical);
    if (ogImage) setMeta('meta[property="og:image"]', "content", ogImage);
    setMeta('meta[name="twitter:card"]',         "content", twitterCard);
    setMeta('meta[name="twitter:title"]',        "content", title       || DEFAULT_TITLE);
    setMeta('meta[name="twitter:description"]',  "content", description || DEFAULT_DESC);
    if (ogImage) setMeta('meta[name="twitter:image"]', "content", ogImage);

    // Canonical link
    if (canonical) {
      let canon = document.querySelector('link[rel="canonical"]');
      if (!canon) {
        canon = document.createElement("link");
        canon.setAttribute("rel", "canonical");
        document.head.appendChild(canon);
      }
      canon.setAttribute("href", canonical);
    }

    // Structured data (JSON-LD) — inject/replace a script tag with id="page-ld"
    if (structuredData) {
      let ld = document.getElementById("page-ld");
      if (!ld) {
        ld = document.createElement("script");
        ld.id = "page-ld";
        ld.type = "application/ld+json";
        document.head.appendChild(ld);
      }
      ld.textContent = JSON.stringify(structuredData);
    }

    return () => {
      document.title = prevTitle || DEFAULT_TITLE;
      setMeta('meta[name="description"]',       "content", DEFAULT_DESC);
      setMeta('meta[name="robots"]',             "content", "index, follow");
      setMeta('meta[property="og:title"]',       "content", DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', "content", DEFAULT_DESC);
      const ld = document.getElementById("page-ld");
      if (ld) ld.remove();
    };
  }, [title, description, canonical, structuredData, ogImage, twitterCard, robots]);
}
