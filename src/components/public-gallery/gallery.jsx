import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 12;

function optimizeUrl(url, width = 480) {
  if (!url) return url;
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    ) + `?width=${width}&quality=55&format=webp`;
  }
  return url;
}

function SkeletonCard({ height = 200 }) {
  return (
    <div
      className="mb-3 break-inside-avoid rounded-xl bg-[#191B1C] animate-pulse"
      style={{ height }}
    />
  );
}

export default function PublicGallery() {
  const [images, setImages]       = useState([]);
  const [likedImages, setLikedImages] = useState(new Set());
  const [hasMore, setHasMore]     = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageRef       = useRef(0);
  const loadingRef    = useRef(false); // guards against concurrent fetches
  const sentinelRef   = useRef(null);
  const navigate      = useNavigate();

  /* ── fetch one page ── */
  const fetchPage = useCallback(async (pageIndex) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    const from = pageIndex * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("public_images")
      .select("id,image_url,runware_url,prompt,likes,uses,created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    loadingRef.current = false;

    if (error || !data || data.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      setInitialLoading(false);
      return;
    }

    setImages(prev => {
      if (pageIndex === 0) return data;
      const existing = new Set(prev.map(i => i.id));
      return [...prev, ...data.filter(i => !existing.has(i.id))];
    });

    pageRef.current = pageIndex;
    if (data.length < PAGE_SIZE) setHasMore(false);
    setLoadingMore(false);
    setInitialLoading(false);
  }, []);

  /* ── initial load + likes ── */
  useEffect(() => {
    fetchPage(0);

    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      supabase
        .from("image_likes")
        .select("image_id")
        .eq("user_id", data.user.id)
        .then(({ data: likes }) => {
          if (likes) setLikedImages(new Set(likes.map(l => l.image_id)));
        });
    });
  }, []);

  /* ── IntersectionObserver for pagination (no scroll listener) ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current && hasMore) {
          setLoadingMore(true);
          fetchPage(pageRef.current + 1);
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, fetchPage]);

  /* ── like ── */
  const handleLike = useCallback(async (imageId) => {
    if (likedImages.has(imageId)) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const { error } = await supabase
      .from("image_likes")
      .insert({ user_id: user.user.id, image_id: imageId });
    if (error) return;

    await supabase.rpc("increment_likes", { image_id: imageId });
    setLikedImages(prev => new Set(prev).add(imageId));
    setImages(prev =>
      prev.map(img =>
        img.id === imageId ? { ...img, likes: (img.likes || 0) + 1 } : img
      )
    );
  }, [likedImages]);

  /* ── use prompt ── */
  const handleUsePrompt = useCallback(async (img) => {
    await supabase.rpc("increment_uses", { image_id: img.id });
    setImages(prev =>
      prev.map(i => i.id === img.id ? { ...i, uses: (i.uses || 0) + 1 } : i)
    );
    navigate("/workspace/image-generator", { state: { prompt: img.prompt } });
  }, [navigate]);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">

      <h1 className="text-3xl font-bold mb-6 text-white">
        Zyvo <span className="text-purple-500">Community Creations</span>
      </h1>

      {/* Skeleton on first load */}
      {initialLoading ? (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} height={120 + (i % 4) * 40} />
          ))}
        </div>
      ) : (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3">
          {images.map((img) => (
            <GalleryCard
              key={img.id}
              img={img}
              liked={likedImages.has(img.id)}
              onLike={handleLike}
              onUsePrompt={handleUsePrompt}
            />
          ))}
        </div>
      )}

      {/* Pagination sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} height={140 + (i % 3) * 30} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Memoised card so re-renders don't repaint the whole grid ── */
import { memo } from "react";

const GalleryCard = memo(function GalleryCard({ img, liked, onLike, onUsePrompt }) {
  const src = optimizeUrl(img.image_url || img.runware_url, 480);

  return (
    <div
      className="relative mb-3 break-inside-avoid rounded-xl overflow-hidden group shadow-lg shadow-black/40"
      style={{ contain: "layout paint" }}
    >
      <img
        src={src}
        loading="lazy"
        decoding="async"
        className="w-full rounded-xl transition-transform duration-300 group-hover:scale-[1.02]"
        style={{ background: "#0f1117", display: "block" }}
        onError={(e) => {
          if (img.runware_url && e.currentTarget.src !== img.runware_url) {
            e.currentTarget.src = img.runware_url;
          }
        }}
      />

      <div className="absolute top-2 left-2 text-[10px] bg-black/50 text-white px-2 py-[2px] rounded pointer-events-none">
        Created with Zyvo
      </div>

      <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={() => onLike(img.id)}
          className={`text-[10px] md:text-xs px-2 py-[3px] md:px-2 md:py-1 rounded-md backdrop-blur-md border border-white/20 shadow-sm transition active:scale-90 ${
            liked ? "bg-purple-500/70 text-white" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          ❤️ {img.likes || 0}
        </button>

        <button
          onClick={() => onUsePrompt(img)}
          className="text-[10px] md:text-xs px-2 py-[3px] md:px-2 md:py-1 rounded-md bg-[#7A3BFF]/70 text-white backdrop-blur-md border border-white/20 hover:bg-[#7A3BFF]/90 transition"
        >
          Use Prompt
        </button>
      </div>
    </div>
  );
});
