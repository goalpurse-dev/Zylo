import Glow from "../../components/workspace/Glow.jsx";
import Features from "../../components/workspace/features.jsx";
import ZyvoSuiteCarousel from "../../components/workspace/ZyvoSuiteCarousel.jsx";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

const ViralShowcase = lazy(() => import("../../components/workspace/ViralShowcase.jsx"));
const LatestTrends = lazy(() => import("../../components/workspace/LatestTrends.jsx"));
const JumpBackIn = lazy(() => import("../../components/workspace/JumpBackIn.jsx"));
const LatestModels = lazy(() => import("../../components/workspace/LatestModels.jsx"));
const PopularStyles = lazy(() => import("../../components/workspace/popularstyles.jsx"));
const WhatsHot = lazy(() => import("../../components/workspace/WhatsHot.jsx"));
const PublicGallery = lazy(() => import("../../components/public-gallery/gallery.jsx"));

function DeferredSection({ children, minHeight = 280, className = "" }) {
  const sectionRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return undefined;
    if (!("IntersectionObserver" in window)) {
      setShouldRender(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin: "500px 0px" },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={sectionRef} className={className} style={{ minHeight: shouldRender ? undefined : minHeight }}>
      {shouldRender && (
        <Suspense fallback={<div aria-hidden="true" style={{ minHeight }} />}>
          {children}
        </Suspense>
      )}
    </div>
  );
}

function useDeferredHeroVideo() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = navigator.connection?.saveData;

    if (!desktop.matches || reducedMotion.matches || saveData) return undefined;

    let idleId;
    let timeoutId;

    const startVideo = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => setShouldLoad(true), { timeout: 2000 });
      } else {
        timeoutId = window.setTimeout(() => setShouldLoad(true), 700);
      }
    };

    if (document.readyState === "complete") startVideo();
    else window.addEventListener("load", startVideo, { once: true });

    return () => {
      window.removeEventListener("load", startVideo);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return shouldLoad;
}

export default function WorkspaceHome() {
  const shouldLoadHeroVideo = useDeferredHeroVideo();
  const [heroVideoReady, setHeroVideoReady] = useState(false);

  useEffect(() => {
    document.title = "Create Visuals Faster";
  }, []);

  return (
    <div className="flex-1 pb-24 lg:pb-12">

      {/* 1 — HERO */}
      <div className="relative isolate flex min-h-[350px] flex-col justify-center overflow-hidden bg-[#090A0A] pb-4 sm:min-h-[390px] sm:pb-6 md:min-h-[440px] md:pb-4">
        <div className="absolute inset-0 -z-40 bg-[radial-gradient(circle_at_50%_18%,#4a1f70_0%,#18101f_36%,#090A0A_72%)]" />
        {shouldLoadHeroVideo && (
          <video
            className={`absolute inset-0 -z-30 hidden h-full w-full object-cover transition-opacity duration-700 md:block ${heroVideoReady ? "opacity-100" : "opacity-0"}`}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            onCanPlay={() => setHeroVideoReady(true)}
          >
            <source src="/home/zyvo-hero.webm" type="video/webm" />
            <source src="/home/zyvo-hero.mp4" type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(9,10,10,.38)_0%,rgba(9,10,10,.08)_32%,rgba(9,10,10,.32)_64%,#090A0A_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,rgba(9,10,10,.14)_42%,rgba(9,10,10,.66)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-gradient-to-t from-[#090A0A] via-[#090A0A]/85 to-transparent" />
        <Glow />

      {/* 2 — CATEGORY TABS */}
        <Features />
      </div>

      {/* 3 — ZYVO SUITE */}
      <ZyvoSuiteCarousel />

      {/* 4 — SHOWCASE CARDS */}
      <DeferredSection minHeight={280}>
        <ViralShowcase />
      </DeferredSection>

      {/* 5 — LATEST TRENDS */}
      <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 620 }} />}>
        <LatestTrends />
      </Suspense>

      {/* 6 — JUMP BACK IN */}
      <DeferredSection minHeight={240}>
        <JumpBackIn />
      </DeferredSection>

      {/* 7 — MOST VIRAL TEMPLATES */}
      <DeferredSection minHeight={360}>
        <WhatsHot />
      </DeferredSection>

      {/* 8 — LATEST AI MODELS */}
      <DeferredSection minHeight={340}>
        <LatestModels />
      </DeferredSection>

      {/* 9 — POPULAR STYLES */}
      <DeferredSection minHeight={360}>
        <PopularStyles />
      </DeferredSection>

      {/* 10 — INSPIRATION GALLERY */}
      <DeferredSection minHeight={900} className="mt-8">
        <PublicGallery />
      </DeferredSection>

    </div>
  );
}
