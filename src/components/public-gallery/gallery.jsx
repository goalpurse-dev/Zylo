import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY NICHES DATA
// To add a video to a niche: set src to the video URL, thumbnail to a still image (optional)
// To add a new niche: add an entry to COMMUNITY_NICHES below, same shape as existing ones
// ─────────────────────────────────────────────────────────────────────────────
const COMMUNITY_NICHES = [
  {
    id: "clay-rescue",
    category: "Clay Rescue",
    title: "Clay Rescue",
    description:
      "Tiny clay people face huge disasters until a giant human hand applies a simple rescue fix. The clear before-and-after reaction makes it feel instantly viral.",
    prompt:
      "Miniature clay village disaster, tiny clay people panicking, giant realistic human hand enters frame and solves the problem, joyful celebration, cinematic 9:16 vertical video.",
    route: "/workspace/clay-rescue",
    videos: [
      { id: "cr-1", src: "/clayrescue/homevideo.mp4", thumbnail: "/community-posters/cr-1.jpg", title: "Giant Hand Rescue" },
      { id: "cr-2", src: "/clayrescue/homevideo2.mp4", thumbnail: "/community-posters/cr-2.jpg", title: "Clay Disaster Fix" },
    ],
  },
  {
    id: "skeleton-ai",
    category: "Skeleton AI",
    title: "Skeleton AI",
    description:
      "Dramatic skeleton characters living out chaotic life situations — betrayals, breakups, and shocking plot twists. Perfect for viral drama content.",
    prompt:
      "A skeleton character in a modern setting, dramatic soap opera scene, cinematic lighting, emotional music overlay, 9:16 vertical format.",
    route: "/home",
    videos: [
      { id: "sk-1", src: "/library/skeleton.mp4", thumbnail: "/community-posters/sk-1.jpg", title: "Skeleton Drama" },
      { id: "sk-2", src: "/library/skeleton2.mp4", thumbnail: "/community-posters/sk-2.jpg", title: "Skeleton Betrayal" },
    ],
  },
  {
    id: "ai-fruit-story",
    category: "AI Fruit Story",
    title: "AI Fruit Story",
    description:
      "Animated fruit characters in cinematic soap opera storylines. Perfect for viral drama content that gets millions of views.",
    prompt:
      "Animated fruit characters — mango boss and strawberry mom — in a dramatic argument scene, cinematic lighting, emotional close-ups, 9:16 vertical format.",
    route: "/home",
    videos: [
      { id: "fs-1", src: "/library/aifruit.mp4", thumbnail: "/community-posters/fs-1.jpg", title: "Fruit Catches Cheating" },
      { id: "fs-2", src: "/library/aifruit2.mp4", thumbnail: "/community-posters/fs-2.jpg", title: "Fruit Secret Twin" },
    ],
  },
  {
    id: "lego",
    category: "Lego",
    title: "Lego Stories",
    description:
      "LEGO-style characters acting out funny and dramatic scenes in stunning cinematic quality. Hugely viral on all platforms.",
    prompt:
      "LEGO mini-figures in a dramatic real-world setting, cinematic camera angles, vibrant colors, 9:16 vertical format.",
    route: "/home",
    videos: [
      { id: "lg-1", src: "/library/lego.mp4", thumbnail: "/community-posters/lg-1.jpg", title: "Lego Argument" },
      { id: "lg-2", src: "/library/lego2.mp4", thumbnail: "/community-posters/lg-2.jpg", title: "Lego Drama" },
    ],
  },
  {
    id: "face-asmr",
    category: "Face ASMR",
    title: "Face ASMR",
    description:
      "Upload any face and place it into satisfying ASMR scenes. Viral content that gets millions of views on TikTok and Reels.",
    prompt:
      "A face placed into a satisfying ASMR scene with cinematic close-ups, soft lighting, and trending audio, 9:16 vertical format.",
    route: "/workspace/face-asmr",
    videos: [
      { id: "fa-1", src: "/face/preview.mp4", thumbnail: "/community-posters/fa-1.jpg", title: "Face ASMR Scene" },
      { id: "fa-2", src: "/face/1.mp4",       thumbnail: "/community-posters/fa-2.jpg", title: "Face ASMR Reveal" },
      { id: "fa-3", src: "/face/2.mp4",       thumbnail: "/community-posters/fa-3.jpg", title: "Face ASMR Drama" },
    ],
  },
  {
    id: "micro-camera",
    category: "Micro Camera",
    title: "Micro Camera Animal",
    description:
      "A tiny bodycam strapped to any small animal as it descends underground — cinematic POV footage that stops the scroll every time.",
    prompt:
      "Micro-camera mounted on an ant's back, descending into an underground colony, narrow LED beam, realistic macro footage, 9:16 vertical format.",
    route: "/workspace/micro-camera-animal",
    videos: [
      { id: "mc-1", src: "/viral-builder/micro-camera/video.mp4",  thumbnail: "/community-posters/mc-1.jpg", title: "Bodycam Underground" },
      { id: "mc-2", src: "/viral-builder/micro-camera/video2.mp4", thumbnail: "/community-posters/mc-2.jpg", title: "Micro Camera POV" },
      { id: "mc-3", src: null, thumbnail: "/viral-builder/micro-camera/preview1.png", title: "Scene Preview" },
    ],
  },
  {
    id: "skeleton-dog",
    category: "Skeleton Dog",
    title: "Skeleton Dog",
    description:
      "A lovable skeleton dog navigating hilarious and emotional everyday situations that viewers can't stop rewatching.",
    prompt:
      "An expressive skeleton dog character in everyday home situations, cute and emotional, cinematic quality, 9:16 vertical format.",
    route: "/home",
    videos: [
      { id: "sd-1", src: "/library/xraydog.mp4", thumbnail: "/community-posters/sd-1.jpg", title: "Skeleton Dog Story" },
      { id: "sd-2", src: null, thumbnail: null, title: "Skeleton Dog Drama" },
    ],
  },
  {
    id: "cartoon",
    category: "Cartoon",
    title: "Cartoon Stories",
    description:
      "Family Guy-style cartoon characters in relatable and chaotic life moments that go viral every time.",
    prompt:
      "Cartoon characters in a dramatic home setting, Family Guy animation style, expressive reactions, 9:16 vertical format.",
    route: "/home",
    videos: [
      { id: "ct-1", src: null, thumbnail: "/library/cartoon.webp", title: "Cartoon Argument" },
      { id: "ct-2", src: null, thumbnail: null, title: "Cartoon Drama" },
    ],
  },
  {
    id: "anime",
    category: "Anime",
    title: "Anime Stories",
    description:
      "Stunning anime-style characters in emotional and action-packed viral scenes that hook viewers instantly.",
    prompt:
      "Anime-style character in an emotional dramatic scene, Studio Ghibli inspired lighting, cinematic composition, 9:16 vertical format.",
    route: "/home",
    videos: [
      { id: "an-1", src: null, thumbnail: "/library/anime.webp", title: "Anime Drama" },
      { id: "an-2", src: null, thumbnail: null, title: "Anime Story" },
    ],
  },
];

// Flat list of all videos with a reference back to their niche
const ALL_VIDEOS = COMMUNITY_NICHES.flatMap((niche) =>
  niche.videos.map((v) => ({ ...v, niche }))
);

// ─── Video card ───────────────────────────────────────────────────────────────

function VideoCard({ item, onClick }) {
  const { niche } = item;
  const videoRef = useRef(null);
  const [videoActive, setVideoActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (!videoActive || !videoRef.current) return;
    videoRef.current.play().catch(() => {});
  }, [videoActive]);

  const startPreview = () => {
    if (!item.src) return;
    setVideoReady(false);
    setVideoActive(true);
  };

  const stopPreview = () => {
    if (!item.src) return;
    setVideoActive(false);
    setVideoReady(false);
  };

  return (
    <div
      className="group relative aspect-[9/16] cursor-pointer overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#0d0f10] transition hover:border-white/20"
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Thumbnail image (used for image-only cards or as poster for videos) */}
      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt={niche.category}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Video bytes are requested only after hover/focus; the lightweight poster handles idle cards. */}
      {item.src && videoActive && (
        <video
          ref={videoRef}
          src={item.src}
          poster={item.thumbnail || undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
          muted
          playsInline
          loop
          preload="metadata"
          onCanPlay={() => setVideoReady(true)}
        />
      )}

      {/* The play affordance disappears once the inline preview starts. */}
      {item.src && !videoActive && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm">
            <span className="ml-0.5 text-sm text-white">▶</span>
          </div>
        </div>
      )}

      {item.src && videoActive && !videoReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-white/90" />
        </div>
      )}

      {/* Bottom gradient + label */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-white/60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <span className="text-[11px] font-semibold text-white/75">{niche.category}</span>
      </div>
    </div>
  );
}

// ─── Modal (click-to-open side panel) ────────────────────────────────────────

function NicheModal({ item, onClose }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  useEffect(() => {
    if (item && videoRef.current && item.src) {
      videoRef.current.play().catch(() => {});
    }
  }, [item]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;
  const { niche } = item;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#0d0f10] shadow-[0_32px_100px_rgba(0,0,0,0.75)] md:flex-row"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: video */}
        <div className="w-full flex-shrink-0 bg-black md:w-[45%]">
          {item.src ? (
            <video
              ref={videoRef}
              src={item.src}
              poster={item.thumbnail || undefined}
              className="h-full max-h-[55dvh] w-full object-contain md:max-h-none"
              controls
              playsInline
              loop
              preload="metadata"
            />
          ) : (
            <div className="flex aspect-[9/16] max-h-[45dvh] items-center justify-center bg-[#0a0b0d] md:max-h-none md:h-full md:aspect-auto">
              <div className="text-center">
                <div className="text-4xl opacity-20">🎬</div>
                <div className="mt-2 text-sm font-medium text-white/25">Coming soon</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: niche info */}
        <div className="flex flex-col justify-center gap-5 p-7 md:p-8">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">
              Niche
            </span>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">{niche.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/50">{niche.description}</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => { onClose(); navigate(niche.route); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-white py-3.5 text-sm font-bold text-black transition hover:bg-white/90 active:scale-[0.98]"
            >
              Use this niche →
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold text-white/55 transition hover:bg-white/[0.08]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function PublicGallery() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedItem, setSelectedItem] = useState(null);

  const categories = ["All", ...COMMUNITY_NICHES.map((n) => n.category)];

  const filteredVideos = (
    activeCategory === "All"
      ? ALL_VIDEOS
      : ALL_VIDEOS.filter((v) => v.niche.category === activeCategory)
  ).filter((v) => v.src || v.thumbnail);

  return (
    <section className="w-full px-4 md:px-[50px]">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <span>👥</span> Community Creations
          </h2>
          <p className="mt-1 text-sm text-white/40">
            Watch how the community uses different niches to create engaging content.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              activeCategory === cat
                ? "bg-white text-black"
                : "border border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {filteredVideos.map((item) => (
          <VideoCard
            key={item.id}
            item={item}
            onClick={() => setSelectedItem(item)}
          />
        ))}
      </div>

      {/* Click modal */}
      <NicheModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </section>
  );
}
