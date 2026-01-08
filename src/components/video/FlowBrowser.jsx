// src/components/video/FlowBrowser.jsx
import React, { useRef, useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import InlineToolSheet from "./InlineToolSheet";
import { useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom"; // ✅ deep-linking

// Showcase pictures
import disneyThumb from "../../assets/thumbs/disney.jpg";
import animeThumb from "../../assets/thumbs/anime.jpg";
import clayThumb from "../../assets/thumbs/clay.jpg";
import lowpolyThumb from "../../assets/thumbs/lowpoly.jpg";
import neonThumb from "../../assets/thumbs/neon.jpg";
import noirThumb from "../../assets/thumbs/noir.jpg";
import legoThumb from "../../assets/thumbs/lego.jpg";
import top10png from "../../assets/thumbs/top10.jpg";
import facelessvideo from "../../assets/thumbs/facelessvideo.jpg";
import facelessBanner from "../../assets/thumbs/facelessvideobanner.jpg";
import top10Banner from "../../assets/thumbs/top10banner.jpg";
import logocreator from "../../assets/thumbs/logocreator.png";
import ugcavatar from "../../assets/thumbs/avatar.png";
import scriptadd from "../../assets/thumbs/scriptadd.png";
import pixarugc from "../../assets/thumbs/3dugc.png";
import dcartoon from "../../assets/thumbs/3dcartoon.png";
import comic from "../../assets/thumbs/comic.png";



// Inside banners
import disneyBanner from "../../assets/thumbs/disney.jpg";

/** Order: Top picks → Create faceless videos → Create UGC ads → Image Enhancement → Video Enhancement Suite → Animated & stylized */
const CATEGORIES = [
  {
    title: "Top picks",
    items: [
      { id: "image-to-video", title: "Image → Video", subtitle: "Animate a single image" },
      { id: "explainer", title: "Explainer video", subtitle: "Clear, structured, educational" },
      { id: "use-my-script", title: "Use my script", subtitle: "Paste a full script and render" },
      { id: "animated-video", title: "Animated video", subtitle: "Stylized motion graphics" },
    ],
  },
  {
    title: "Create faceless videos",
    items: [
      { id: "viral-short",     title: "Viral short video",  subtitle: "Kinetic captions, b-roll, SFX", thumb: facelessvideo, banner: facelessBanner },
      { id: "prompt-to-video", title: "Prompt to video",    subtitle: "Auto-edit with captions" },
      { id: "top10-video",     title: "Top 10 video",       subtitle: "Listicle format", thumb: top10png, banner: top10Banner },
      { id: "reddit-story",    title: "Reddit story video", subtitle: "Narrate posts with b-roll", redirect: "/tools/reddit-story" },
      { id: "fake-text-story", title: "Fake text story",    subtitle: "Messaging-style stories",    redirect: "/tools/fake-text-story" },
      { id: "ai-comic-maker",  title: "AI Comic Maker",     subtitle: "Scrollable comic / webtoon", thumb: comic},
      { id: "cartoon-generator", title: "3D Cartoon generator", subtitle: "Anime / Pixar-ish / low-poly", thumb : dcartoon},
    ],
  },
  {
    title: "Create UGC ads",
    items: [
      { id: "logo-creator",  title: "Logo creator",       subtitle: "Quick brand marks", thumb: logocreator, banner: logocreator },
      { id: "avatar-ads",    title: "Ads w/ avatar",      subtitle: "Human presenter + captions", thumb: ugcavatar, banner: ugcavatar },
      { id: "script-to-ugc", title: "Script → UGC Ad",    subtitle: "Turn screenplay into hooks", thumb: scriptadd, banner: scriptadd },
      { id: "ugc-3d-video",  title: "3D video for UGC Ad",subtitle: "Stylized animated ad", thumb: pixarugc, banner: pixarugc },
    ],
  },
  {
    title: "Image Enhancement",
    items: [
      { id: "upscale",      title: "Upscaler (HD boost)",     subtitle: "Sharper, larger images" },
      { id: "face-retouch", title: "Retouch / Restore faces", subtitle: "Fix skin & restore details" },
      { id: "denoise",      title: "Blur / Noise fixer",      subtitle: "Reduce grain & blur" },
    ],
  },
  {
    title: "Video Enhancement Suite",
    items: [
      { id: "lip-sync",     title: "AI Lip Sync",           subtitle: "Perfectly synced voices" },
      { id: "green-screen", title: "AI Green Screen",       subtitle: "Replace backgrounds instantly" },
      { id: "stock-video",  title: "Stock Video Generator", subtitle: "Cinematic AI b-roll" },
      { id: "deepfake",     title: "Deepfake",              subtitle: "Meme-ready face swaps" },
    ],
  },
  {
    title: "Animated & stylized",
    items: [
      { id: "pixar-style",      title: "Disney/Pixar style",   subtitle: "Soft shading + cinematic", thumb: disneyThumb },
      { id: "claymation-style", title: "Claymation style",     subtitle: "Stop-motion look", thumb: clayThumb },
      { id: "lego-style",       title: "Lego style",           subtitle: "Plastic bricks vibe", thumb: legoThumb },
      { id: "anime-style",      title: "Anime style",          subtitle: "High-contrast ink lines", thumb: animeThumb },
      { id: "lowpoly-style",    title: "Low-poly style",       subtitle: "Flat facets, simple shapes", thumb: lowpolyThumb },
      { id: "neon-glitch-style",title: "Neon/Glitch style",    subtitle: "Vaporwave & chromatic", thumb: neonThumb },
      { id: "noir-style",       title: "Noir style",           subtitle: "Moody B/W, hard shadows", thumb: noirThumb },
    ],
  },
];

// Style cards -> preselected theme for VideoGenerator
const STYLE_TO_THEME = {
  "pixar-style": "pixar",
  "lego-style": "lego",
  "claymation-style": "claymation",
  "anime-style": "anime",
  "lowpoly-style": "lowpoly",
  "neon-glitch-style": "neon",
  "noir-style": "noir",
};

/** Chips to show per tool (match InlineToolSheet CHIP_DEFS) */
const DEFAULT_CHIPS = ["language", "subtitles", "voice", "watermark", "bgm"];
const CHIPS_BY_TOOL = {
  "cartoon-generator": ["language", "subtitles", "voice", "watermark", "bgm"],
  "avatar-ads": ["language", "subtitles", "voice", "watermark", "bgm"],
  "logo-creator": ["watermark"],
  upscale: ["watermark"],
  "face-retouch": ["watermark"],
  denoise: ["watermark"],
};

/** Cards that should hard-redirect */
const REDIRECT_IDS = new Map([
  ["reddit-story", "/tools/reddit-story"],
  ["fake-text-story", "/tools/fake-text-story"],
]);

export default function FlowBrowser({ open, onClose, onSubmit: onSubmitProp, onPick }) {
  const onSubmit = onSubmitProp || onPick;
  const [activeItem, setActiveItem] = useState(null);

  // ✅ Hooks that must run on every render (place BEFORE any early return)
  const ALL_ITEMS = useMemo(() => CATEGORIES.flatMap((cat) => cat.items || []), []);
  const [searchParams] = useSearchParams();

  // Lock page scroll while the browser is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => { if (!open) setActiveItem(null); }, [open]);

  // Deep-link: /create?tool=<id>
  useEffect(() => {
    if (!open) return;
    const slug = searchParams.get("tool");
    if (!slug) return;
    const match = ALL_ITEMS.find((it) => it.id === slug);
    if (match) handleCardClick(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchParams, ALL_ITEMS]);

  if (!open) return null;

  const handleCloseOverlay = () => {
    setActiveItem(null);
    onClose?.();
  };

  const handleCardClick = (item) => {
    // Cartoon styles -> go to Video Generator with theme preselected
    if (item.id === "cartoon-generator" || item.id === "short-animated" || STYLE_TO_THEME[item.id]) {
  const themeId = STYLE_TO_THEME[item.id]; // undefined for generic cards
 const url =
    "/tools/video-generator?tool=cartoon" +
    (themeId ? `&theme=${encodeURIComponent(themeId)}&themeId=${encodeURIComponent(themeId)}` : "") +
    "&openDrawer=1";
  window.location.href = url;
      return;
    }

    if (item.redirect || REDIRECT_IDS.has(item.id)) {
      const route = item.redirect || REDIRECT_IDS.get(item.id);
      onSubmit?.({ navigateTo: route, templateId: item.id });
      handleCloseOverlay();
      return;
    }
    setActiveItem(item); // open inline settings sheet in-place
  };

  const chipsForItem = (item) => CHIPS_BY_TOOL[item.id] || DEFAULT_CHIPS;

  return (
    <div
      className="relative z-[61] flex items-center justify-center p-4"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-6xl rounded-2xl bg-[#121212] text-white shadow-[0_30px_80px_rgba(0,0,0,.55)] ring-1 ring-white/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-lg font-extrabold">
              {activeItem ? activeItem.title : "Browse Library"}
            </h3>
            <button
              onClick={handleCloseOverlay}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15"
            >
              <X className="h-4 w-4" /> Close
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[72vh] overflow-y-auto px-5 py-5 space-y-10">
            {CATEGORIES.map((cat) => (
              <Row key={cat.title} cat={cat} onPick={handleCardClick} />
            ))}
          </div>
        </div>
      </div>

      {/* Inline settings sheet (white, centered a bit above middle) */}
      {activeItem && (
        <InlineToolSheet
          open
          title={activeItem.title}
          chips={chipsForItem(activeItem)}
          bannerImage={activeItem.banner} // optional
          onClose={() => setActiveItem(null)}
          onProceed={(payload) => {
            onSubmit?.({
              templateId: activeItem.id,
              title: activeItem.title,
              ...payload,
            });
            handleCloseOverlay();
          }}
        />
      )}
    </div>
  );
}

function Row({ cat, onPick }) {
  const scrollerRef = useRef(null);
  const scrollBy = (dx) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-white/70 uppercase tracking-wide">
          {cat.title}
        </h4>
        <div className="flex items-center gap-2">
          <IconButton onClick={() => scrollBy(-520)}><ChevronLeft className="h-4 w-4" /></IconButton>
          <IconButton onClick={() => scrollBy(520)}><ChevronRight className="h-4 w-4" /></IconButton>
        </div>
      </div>

      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
        {cat.items.map((item) => (
          <Card key={item.id} item={item} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

function Card({ item, onPick }) {
  return (
    <button
      onClick={() => onPick?.(item)}
      className="relative h-40 w-[300px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-black/70 text-left hover:shadow-[0_10px_28px_rgba(0,0,0,.45)] transition"
      title={item.subtitle || ""}
    >
      {item.thumb && (
        <img
          src={item.thumb}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_30%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      <div className="relative z-10 h-full w-full p-4 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="text-white font-extrabold leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,.55)]">
            {item.title}
          </div>
          {!!item.subtitle && (
            <div className="text-[12px] text-white/80 drop-shadow-[0_1px_1px_rgba(0,0,0,.45)]">
              {item.subtitle}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function IconButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 p-1.5 text-white hover:bg-white/15"
    >
      {children}
    </button>
  );
}
