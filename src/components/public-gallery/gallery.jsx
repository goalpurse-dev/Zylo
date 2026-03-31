import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function PublicGallery() {

  

  const [images, setImages] = useState([]);
  const navigate = useNavigate();
  const [likedImages, setLikedImages] = useState(new Set());
  const PAGE_SIZE = 12;
const [hasMore, setHasMore] = useState(true);
const loadMoreRef = useRef(null);

const [page, setPage] = useState(0);
const [loadingMore, setLoadingMore] = useState(false);

const loadImages = async (pageIndex = 0) => {

  const from = pageIndex * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data } = await supabase
    .from("public_images")
    .select("id,image_url,runware_url,prompt,likes,uses,created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!data || data.length === 0) {
  setHasMore(false);
  setLoadingMore(false);
  return;
}

 setImages(prev =>
  pageIndex === 0 ? data : [...prev, ...data]
);

setPage(pageIndex);

};

useEffect(() => {
  const handleScroll = () => {
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 1200
    ) {
      if (!loadingMore && hasMore) {
        loadNextPage();
      }
    }
  };

  window.addEventListener("scroll", handleScroll);

  return () => window.removeEventListener("scroll", handleScroll);
}, [loadingMore, hasMore, page]);

useEffect(() => {

  async function load() {

    await loadImages(0);

    const { data: user } = await supabase.auth.getUser();

    if (user?.user) {

      const { data: likes } = await supabase
        .from("image_likes")
        .select("image_id")
        .eq("user_id", user.user.id);

      const likedSet = new Set(likes?.map(l => l.image_id));

      setLikedImages(likedSet);
    }

  }

  load();

}, []);

useEffect(() => {
  const el = loadMoreRef.current;
  if (!el) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !loadingMore && hasMore) {
        loadNextPage();
      }
    },
    {
      rootMargin: "1200px"
    }
  );

  observer.observe(el);

  return () => observer.disconnect();
}, [loadingMore, hasMore, page]);
const loadNextPage = async () => {

  if (loadingMore || !hasMore) return;

  setLoadingMore(true);

  const nextPage = page + 1;

  const from = nextPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data } = await supabase
    .from("public_images")
    .select("id,image_url,runware_url,prompt,likes,uses,created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!data || data.length === 0) {
    setHasMore(false);
    setLoadingMore(false);
    return;
  }

  setImages(prev => {

  const existing = new Set(prev.map(i => i.id));
  const newImages = data.filter(i => !existing.has(i.id));

  return [...prev, ...newImages];
});
  setPage(nextPage);

  // if less than page size → no more pages
  if (data.length < PAGE_SIZE) {
    setHasMore(false);
  }

  setLoadingMore(false);
};

function optimizeSupabaseImage(url, width = 500) {
  if (!url) return url;

  // only optimize Supabase storage images
  if (url.includes("/storage/v1/object/public/")) {
    const optimized = url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );

    return `${optimized}?width=${width}&quality=60`;
  }

  // external image (runware etc)
  return url;
}
const handleLike = async (imageId) => {

  if (likedImages.has(imageId)) return;

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  const { error } = await supabase
    .from("image_likes")
    .insert({
      user_id: user.user.id,
      image_id: imageId
    });

  if (error) return;

  await supabase.rpc("increment_likes", {
    image_id: imageId
  });

  setLikedImages(prev => new Set(prev).add(imageId));

  setImages(prev =>
    prev.map(img =>
      img.id === imageId
        ? { ...img, likes: (img.likes || 0) + 1 }
        : img
    )
  );
};

  const usePrompt = (prompt) => {
    navigate("/workspace/image-generator", {
      state: { prompt }
    });
  };

  return (
 <section className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">

      <h1 className="text-3xl font-bold mb-6 text-white">
        Zyvo <span className="text-purple-500">Community Creations</span>
      </h1>

    <div className="
  columns-2
  md:columns-3
  lg:columns-3
  xl:columns-4
  2xl:columns-4
  gap-3
">

        {images.map((img) => (

          <div
            key={img.id}
            className="relative mb-3 break-inside-avoid rounded-xl overflow-hidden group shadow-lg shadow-black/40"
          >

 <img
  src={optimizeSupabaseImage(img.image_url || img.runware_url, 500)}
  loading="lazy"
  fetchPriority="low"
  decoding="async"
  className="w-full rounded-xl transition-transform duration-300 group-hover:scale-[1.03]"
  style={{ background: "#0f1117", contentVisibility: "auto" }}
 onError={(e) => {
  if (img.runware_url && e.currentTarget.src !== img.runware_url) {
    e.currentTarget.src = img.runware_url;
  }
}}
/>

            {/* watermark */}
            <div className="absolute top-2 left-2 text-[10px] bg-black/50 text-white px-2 py-[2px] rounded">
              Created with Zyvo
            </div>

            {/* buttons */}
   <div className="absolute bottom-3 left-3 flex flex-col gap-1">

  <div className="flex gap-2">

<button
  onClick={() => handleLike(img.id)}
  className={`text-[10px] md:text-xs px-2 py-[3px] md:px-2 md:py-1 rounded-md
  backdrop-blur-md border border-white/20 shadow-sm
  transition active:scale-90
  ${
    likedImages.has(img.id)
      ? "bg-purple-500/70 text-white"
      : "bg-white/10 text-white hover:bg-white/20"
  }`}
>
  ❤️ {img.likes || 0} <span className="font-semibold">Likes</span>
</button>

    <button
      onClick={async () => {

        await supabase.rpc("increment_uses", {
          image_id: img.id
        });

        setImages(prev =>
          prev.map(i =>
            i.id === img.id
              ? { ...i, uses: (i.uses || 0) + 1 }
              : i
          )
        );

        usePrompt(img.prompt);
      }}
     className="text-[10px] md:text-xs px-2 py-[3px] md:px-2 md:py-1 rounded-md
bg-[#7A3BFF]/70 text-white
backdrop-blur-md border border-white/20
hover:bg-[#7A3BFF]/90
transition"
    >
      📥 Use Prompt
    </button>

  </div>



</div>

          </div>

        ))}

      </div>

      <div
  ref={loadMoreRef}
  style={{ height: "1px" }}
/>

{loadingMore && (
  <div className="text-center text-white/60 mt-6">
    Loading more images...
  </div>
)}
    </section>
  );
}