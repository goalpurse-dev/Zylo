import { useEffect } from "react";
import { getWorkspaceRouteSeoPolicy, SITE_URL } from "../data/routeSeoPolicy.js";

const DEFAULT_TITLE = "Zyvo – Go Viral With AI Content Creation";
const DEFAULT_DESC  =
  "Go viral with AI. Create scroll-stopping images, product photos, backgrounds, and social media content instantly with Zyvo AI.";

export function useSEO({
  enabled = true,
  title,
  description,
  canonical,
  structuredData,
  ogImage,
  ogType = "website",
  keywords,
  twitterCard = "summary_large_image",
  robots = "index, follow, max-image-preview:large",
} = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    const routePolicy = getWorkspaceRouteSeoPolicy(window.location.pathname);
    const effectiveRobots = routePolicy?.seoVisibility === "noindex"
      ? "noindex, follow"
      : routePolicy?.seoVisibility === "public"
        ? "index, follow, max-image-preview:large"
        : robots;
    const effectiveCanonical = routePolicy ? `${SITE_URL}${routePolicy.path}` : canonical;
    const prevTitle = document.title;
    const touched = [];

    // Title
    document.title = title || DEFAULT_TITLE;

    // Helper to upsert a <meta> tag (by name or property), creating it if absent
    const setMeta = (selector, attr, value) => {
      if (!value) return;
      let el = document.querySelector(selector);
      const created = !el;
      if (!el) {
        el = document.createElement("meta");
        const match = selector.match(/\[([a-z]+)="([^"]+)"\]/);
        if (match) el.setAttribute(match[1], match[2]);
        document.head.appendChild(el);
      }
      touched.push({ el, attr, created, previous: el.getAttribute(attr) });
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]',         "content", description || DEFAULT_DESC);
    setMeta('meta[name="keywords"]',            "content", keywords);
    setMeta('meta[name="robots"]',               "content", effectiveRobots);
    setMeta('meta[property="og:title"]',         "content", title       || DEFAULT_TITLE);
    setMeta('meta[property="og:description"]',   "content", description || DEFAULT_DESC);
    setMeta('meta[property="og:type"]',          "content", ogType);
    if (effectiveCanonical) setMeta('meta[property="og:url"]', "content", effectiveCanonical);
    if (ogImage) setMeta('meta[property="og:image"]', "content", ogImage);
    setMeta('meta[name="twitter:card"]',         "content", twitterCard);
    setMeta('meta[name="twitter:title"]',        "content", title       || DEFAULT_TITLE);
    setMeta('meta[name="twitter:description"]',  "content", description || DEFAULT_DESC);
    if (ogImage) setMeta('meta[name="twitter:image"]', "content", ogImage);

    // Canonical link
    if (effectiveCanonical) {
      let canon = document.querySelector('link[rel="canonical"]');
      const created = !canon;
      if (!canon) {
        canon = document.createElement("link");
        canon.setAttribute("rel", "canonical");
        document.head.appendChild(canon);
      }
      touched.push({ el: canon, attr: "href", created, previous: canon.getAttribute("href") });
      canon.setAttribute("href", effectiveCanonical);
    }

    // Structured data (JSON-LD) — inject/replace a script tag with id="page-ld"
    if (structuredData) {
      let ld = document.getElementById("page-ld");
      const created = !ld;
      if (!ld) {
        ld = document.createElement("script");
        ld.id = "page-ld";
        ld.type = "application/ld+json";
        document.head.appendChild(ld);
      }
      touched.push({ el: ld, attr: "textContent", created, previous: ld.textContent });
      ld.textContent = JSON.stringify(structuredData);
    }

    return () => {
      document.title = prevTitle || DEFAULT_TITLE;
      [...touched].reverse().forEach(({ el, attr, created, previous }) => {
        if (created) {
          el.remove();
        } else if (attr === "textContent") {
          el.textContent = previous || "";
        } else if (previous === null) {
          el.removeAttribute(attr);
        } else {
          el.setAttribute(attr, previous);
        }
      });
    };
  }, [enabled, title, description, canonical, structuredData, ogImage, ogType, keywords, twitterCard, robots]);
}
