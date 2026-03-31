import { useEffect, useRef, useState } from "react";

export default function ViralShowcase() {
  const intervalRef = useRef(null);
  const scrollRef = useRef(null);
const [autoIndex, setAutoIndex] = useState(0);

  const items = [
    {
      title: "Create Viral Video",
      button: "Create Video",
      video: "/showcase/bigcard.mp4",
      image: "/showcase/bigcard.webp",
      big: true,
    },
    {
      title: "Millions of Views Per Week",
      button: "Start Creating",
      image: "/showcase/card2.webp",
      hoverVideo: "/showcase/card2.mp4",
    },
    {
      title: "Create Unmatched Images",
      button: "Create Image",
      image: "/showcase/card3.webp",
      hoverVideo: "/showcase/card3.mp4",
    },
  ];

  // 🔥 AUTO SCROLL (REAL SCROLL, NOT STATE)
 const isUserInteracting = useRef(false);
 
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  const scrollNext = () => {
    if (isUserInteracting.current) return;

    const card = el.querySelector("div > div");
    if (!card) return;

    const gap = 12;
    const width = card.offsetWidth + gap;

    const maxScroll = el.scrollWidth - el.clientWidth;

    // 👉 LAST CARD → RESET PROPERLY
    if (el.scrollLeft + width >= maxScroll - 5) {
      // disable snap (IMPORTANT)
      el.style.scrollSnapType = "none";

      // instant reset
      el.scrollTo({ left: 0, behavior: "auto" });

      // re-enable snap + continue
      setTimeout(() => {
        el.style.scrollSnapType = "x mandatory";

        el.scrollBy({
          left: width,
          behavior: "smooth",
        });
      }, 60);

      return;
    }

    // 👉 NORMAL STEP
    el.scrollBy({
      left: width,
      behavior: "smooth",
    });
  };

  intervalRef.current = setInterval(scrollNext, 6000);

  return () => clearInterval(intervalRef.current);
}, []);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 md:px-6 mt-6 md:mt-12">

      {/* DESKTOP */}
      <div className="hidden md:flex gap-4 w-full">

        {/* BIG CARD */}
        <div className="w-[60%] xl:w-[45%]">
          <div className="w-full aspect-[2.35/1]">
            <FeatureCard {...items[0]} />
          </div>
        </div>

        {/* SECOND CARD */}
        <div className="w-[40%] xl:w-[27.5%] flex">
          <FeatureCard {...items[1]} />
        </div>

        {/* THIRD CARD */}
        <div className="hidden xl:block w-[27.5%]">
          <FeatureCard {...items[2]} />
        </div>

      </div>

      {/* MOBILE SLIDER */}
      <div className="md:hidden overflow-hidden relative mt-4">
     <div
  ref={scrollRef}
  onTouchStart={() => (isUserInteracting.current = true)}
  onTouchEnd={() => {
    setTimeout(() => {
      isUserInteracting.current = false;
    }, 1500);
  }}
  onMouseEnter={() => (isUserInteracting.current = true)}
  onMouseLeave={() => (isUserInteracting.current = false)}
  className="
    flex gap-3 px-1
    overflow-x-auto snap-x snap-mandatory
    scroll-smooth
    [scrollbar-width:none]
    [-ms-overflow-style:none]
    [&::-webkit-scrollbar]:hidden
  "
>
         {items.map((item, i) => (
            <div
              key={i}
              className="
                snap-start shrink-0
                w-[96%]
                max-w-[96%]
              "
            >
              <div className="h-[220px]">
                <FeatureCard {...item} mobile />
              </div>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}

function FeatureCard({
  title,
  button,
  video,
  image,
  hoverVideo,
  big,
  mobile,
}) {
  const [hovered, setHovered] = useState(false);

  const showVideo =
    !mobile && ((big && video) || (hoverVideo && hovered));

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        border border-white/10
        bg-[#141416]
        group cursor-pointer
        h-full w-full
        ${mobile ? "h-[220px]" : ""}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >

      {/* MEDIA */}
      {showVideo ? (
        <video
          src={big ? video : hoverVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* GRADIENT */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* CONTENT */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 z-10">

        <h3
          className="
            text-white font-bold leading-tight
            text-[16px]
            sm:text-[17px]
            md:text-[18px]
            lg:text-[17px]
            xl:text-[16px]
            2xl:text-[20px]
          "
        >
          {title}
        </h3>

        <button
          className="
            mt-3 w-fit
            px-3 py-1.5
            rounded-full
            bg-white/20 hover:bg-white/30
            text-white text-sm
            transition
          "
        >
          {button}
        </button>

      </div>
    </div>
  );
}