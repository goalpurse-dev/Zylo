import { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PublicContentHeader from "./PublicContentHeader.jsx";
import { getPublicSeoMetadata, SITE_URL } from "../../data/publicSeoMetadata.js";
import { structuredDataFor } from "../../data/structuredData.js";
import { useSEO } from "../../hooks/useSEO.js";

const TEMPLATE_PREFIXES = [
  { prefixes: ["/ai-fruit-story-maker", "/blog/viral-ai-fruit", "/blog/ai-fruit", "/blog/best-ai-fruit", "/blog/how-to-go-viral-tiktok-fruit"], id: "ai-fruit-story" },
  { prefixes: ["/face-asmr-maker", "/blog/face-asmr", "/blog/viral-face-asmr", "/blog/asmr-video", "/blog/how-to-start-asmr", "/blog/best-face-asmr"], id: "face-asmr" },
  { prefixes: ["/micro-camera-animal-maker", "/blog/micro-camera", "/blog/viral-animal-bodycam"], id: "micro-camera-animal" },
  { prefixes: ["/clay-rescue-maker", "/blog/clay-rescue", "/blog/why-giant-hand-rescue"], id: "clay-rescue" },
  { prefixes: ["/cartoon-drive-by-video-maker", "/blog/cartoon-drive-by"], id: "cartoon-drive-by" },
  { prefixes: ["/footballer-nationality-swap-ai", "/blog/footballer-nationality-swap"], id: "footballer-nationality-swap" },
  { prefixes: ["/2am-", "/blog/what-is-the-2am", "/blog/best-2am", "/blog/how-to-create-2am", "/blog/ai-world", "/blog/how-to-make-ai-nostalgia"], id: "two-am" },
];

function templateForPath(pathname) {
  return TEMPLATE_PREFIXES.find((entry) => entry.prefixes.some((prefix) => pathname.startsWith(prefix)))?.id;
}

function usePublicMetadataGuard(pathname, canonical) {
  useEffect(() => {
    const touched = [];
    const setHeadValue = (selector, tag, attribute, value, identity) => {
      let element = document.querySelector(selector);
      const created = !element;
      if (!element) {
        element = document.createElement(tag);
        Object.entries(identity).forEach(([key, identityValue]) => element.setAttribute(key, identityValue));
        document.head.appendChild(element);
      }
      touched.push({ element, attribute, created, previous: element.getAttribute(attribute) });
      element.setAttribute(attribute, value);
    };

    setHeadValue('link[rel="canonical"]', "link", "href", canonical, { rel: "canonical" });
    setHeadValue('meta[name="robots"]', "meta", "content", "index, follow, max-image-preview:large", { name: "robots" });
    setHeadValue('meta[property="og:url"]', "meta", "content", canonical, { property: "og:url" });

    const improveLegacyMetadata = () => {
      const heading = document.querySelector("h1")?.textContent?.trim().replace(/\s+/g, " ");
      if (!heading) return;
      if (!document.title || document.title === "Zyvo – Go Viral With AI Content Creation") {
        document.title = `${heading} | Zyvo`;
      }
      const description = document.querySelector('meta[name="description"]');
      const paragraph = document.querySelector("main p, article p")?.textContent?.trim().replace(/\s+/g, " ");
      if (description && paragraph && description.content.startsWith("Go viral with AI.")) {
        description.content = paragraph.slice(0, 157).replace(/\s+\S*$/, "") + (paragraph.length > 157 ? "…" : "");
      }
    };

    improveLegacyMetadata();
    const observer = new MutationObserver(improveLegacyMetadata);
    const root = document.getElementById("root");
    if (root) observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      [...touched].reverse().forEach(({ element, attribute, created, previous }) => {
        if (created) element.remove();
        else if (previous === null) element.removeAttribute(attribute);
        else element.setAttribute(attribute, previous);
      });
    };
  }, [canonical, pathname]);
}

export default function PublicContentLayout() {
  const { pathname } = useLocation();
  const metadata = getPublicSeoMetadata(pathname);
  const canonical = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
  const structuredData = useMemo(
    () => structuredDataFor(pathname, metadata, canonical),
    [canonical, metadata, pathname],
  );
  usePublicMetadataGuard(pathname, canonical);

  useSEO({
    enabled: Boolean(metadata),
    title: metadata?.title,
    description: metadata?.description,
    canonical,
    ogImage: metadata?.image || `${SITE_URL}/og-image.png`,
    ogType: metadata?.type || "website",
    robots: "index, follow, max-image-preview:large",
    structuredData,
  });

  return (
    <>
      <PublicContentHeader templateId={templateForPath(pathname)} slug={pathname.replace(/^\//, "")} />
      <Outlet />
    </>
  );
}
