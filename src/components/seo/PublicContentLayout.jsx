import { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PublicContentHeader from "./PublicContentHeader.jsx";
import { getPublicSeoMetadata, SITE_URL } from "../../data/publicSeoMetadata.js";
import { useSEO } from "../../hooks/useSEO.js";

const TEMPLATE_PREFIXES = [
  { prefixes: ["/ai-fruit-story-maker", "/blog/viral-ai-fruit", "/blog/ai-fruit", "/blog/best-ai-fruit", "/blog/how-to-go-viral-tiktok-fruit"], id: "ai-fruit-story" },
  { prefixes: ["/face-asmr-maker", "/blog/face-asmr", "/blog/viral-face-asmr", "/blog/asmr-video", "/blog/how-to-start-asmr", "/blog/best-face-asmr"], id: "face-asmr" },
  { prefixes: ["/micro-camera-animal-maker", "/blog/micro-camera", "/blog/viral-animal-bodycam"], id: "micro-camera-animal" },
  { prefixes: ["/clay-rescue-maker", "/blog/clay-rescue", "/blog/why-giant-hand-rescue"], id: "clay-rescue" },
  { prefixes: ["/cartoon-drive-by-video-maker"], id: "cartoon-drive-by" },
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

function structuredDataFor(pathname, metadata, canonical) {
  if (!metadata) return null;
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/workspace/home` },
      ...(pathname.startsWith("/blog/")
        ? [{ "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` }]
        : []),
      { "@type": "ListItem", position: pathname.startsWith("/blog/") ? 3 : 2, name: metadata.title.replace(/ \| Zyvo$/, ""), item: canonical },
    ],
  };
  let page = pathname.startsWith("/blog/")
    ? { "@type": "BlogPosting", headline: metadata.title.replace(/ \| Zyvo$/, ""), description: metadata.description, mainEntityOfPage: canonical, publisher: { "@type": "Organization", name: "Zyvo", url: SITE_URL } }
    : { "@type": "WebPage", name: metadata.title, description: metadata.description, url: canonical };
  const graph = [page, breadcrumb];

  if (pathname === "/ai-fruit-story-maker") {
    page = {
      "@type": "SoftwareApplication",
      name: "Zyvo AI Fruit Story Generator",
      description: metadata.description,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    };
    graph[0] = page;
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is an AI Fruit Story?", "An AI Fruit Story is a short-form fictional drama video in which stylized 3D fruit characters act out a simple conflict, reveal, or surprise across multiple scenes."],
        ["How long does it take to make a fruit drama video?", "Generation time varies with story length, scene count, selected models, and queue conditions. Zyvo shows progress in the workspace while the story is being created."],
        ["Do I need editing or design skills?", "No timeline editing or design software is required for the core workflow. You provide the idea, choose characters and settings, then review the generated scenes and video."],
        ["Can I make 1-minute long fruit videos?", "Yes. The tool supports a 60-second option with up to 10 scenes, subject to the settings available in the workspace."],
        ["What drama styles can I create?", "You can start with cheating-reveal, baby-surprise, secret-twin, revenge, and kicked-out presets, or describe a custom fictional story."],
        ["Do the characters speak in the videos?", "Yes. Animated scenes can include AI-generated English dialogue with mouth-synced character animation."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/cartoon-drive-by-video-maker") {
    page = {
      "@type": "SoftwareApplication",
      name: "Zyvo Cartoon Drive-By Video Maker",
      description: metadata.description,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    };
    graph[0] = page;
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is a cartoon drive-by video?", "It is a fictional, stylized travel shot that passes a cartoon- or game-inspired destination from inside a moving vehicle. It is an entertainment format, not a depiction of violence."],
        ["How long is the generated video?", "The current Cartoon Drive-By workflow creates a continuous 10-second video in a vertical 9:16 format."],
        ["Which vehicles can I choose?", "The current tool supports car, train, bus, and plane viewpoints, with motion and framing adjusted for the selected vehicle."],
        ["Can I create a video for TikTok or Reels?", "Yes. The tool is designed around a 9:16 vertical frame suitable for TikTok, Instagram Reels, and YouTube Shorts."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
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
