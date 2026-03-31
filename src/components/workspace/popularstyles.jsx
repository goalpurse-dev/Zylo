import React from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const styles = [

     {
    title: "Viral Skeleton",
    description: "Scroll-stopping viral skeleton visuals with cinematic vibe.",
    image: "/styles/skeleton2.webp",
  },
  {
    title: "Cinematic",
    description: "High-impact scenes with dramatic lighting and bold detail.",
    image: "/styles/cinematic2.webp",
  },
  {
    title: "Dynamic",
    description: "Energetic visuals with motion, contrast, and punch.",
    image: "/styles/dynamic2.webp",
  },
  {
    title: "3D Cartoon",
    description: "Clean 3D character style with playful polished rendering.",
    image: "/styles/cartoon2.webp",
  },

  {
    title: "Lego",
    description: "Blocky cinematic scenes with toy-like charm and clarity.",
    image: "/styles/lego2.webp",
  },

  {
    title: "Dog Skeleton",
    description: "Eye-catching science style with strong viral potential.",
    image: "/styles/x-ray dog.webp",
  },
  {
    title: "Vintage Portrait",
    description: "Timeless portrait look with elegant old-film atmosphere.",
    image: "/styles/vintage2.webp",
  },
  {
    title: "Minecraft",
    description: "Blocky stylized scenes inspired by voxel worlds.",
    image: "/styles/minecraft2.webp",
  },
  {
    title: "Realistic",
    description: "Natural, detailed visuals with grounded photoreal feel.",
    image: "/styles/realistic2.webp",
  },
  {
    title: "Anime",
    description: "Expressive anime-inspired scenes with strong visual appeal.",
    image: "/styles/anime2.webp",
  },
  {
    title: "Clay",
    description: "Soft handcrafted clay look with playful depth.",
    image: "/styles/clay2.webp",
  },
  {
    title: "Comic",
    description: "Bold illustrated frames with graphic novel energy.",
    image: "/styles/comic2.webp",
  },
  {
    title: "Disney",
    description: "Family-friendly cinematic charm with polished characters.",
    image: "/styles/disney2.webp",
  },
  {
    title: "Ghibli",
    description: "Soft storybook worlds with warm, dreamy composition.",
    image: "/styles/ghibli2.webp",
  },
  
  {
    title: "Cyberpunk",
    description: "Neon-lit futuristic visuals with depth and atmosphere.",
    image: "/styles/cyberpunk2.webp",
  },
  {
    title: "Lowpoly",
    description: "Clean geometric style with simplified modern shapes.",
    image: "/styles/lowpoly2.webp",
  },
];

export default function PopularStyles() {
  const mobileRailItems = styles.slice(0, 8);
  const desktopItems = styles.slice(0, 8);
const navigate = useNavigate();

  return (
    <section className="w-full max-w-7xl mx-auto px-4 md:px-6 mt-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-white text-[20px] md:text-[28px] font-bold tracking-tight">
        Popular Styles
          </h2>
        </div>

    <button
  onClick={() => navigate("/workspace/image-generator")}
  className="
    shrink-0 flex items-center gap-1
    text-white/70 hover:text-white
    text-sm md:text-base font-semibold
    transition-colors
  "
>
  More
  <ChevronRight size={16} />
</button>
      </div>

      {/* MOBILE: rail behavior */}
      <div className="md:hidden overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-rows-4 grid-flow-col gap-4 w-max snap-x snap-mandatory">
          {mobileRailItems.map((style) => (
            <StyleCard key={style.title} style={style} mobile />
          ))}
        </div>
      </div>

      {/* MD+: fixed grid behavior */}
      <div
        className="
          hidden md:grid gap-4
          md:grid-cols-2
          lg:grid-cols-2
          2xl:grid-cols-4
        "
      >
        {desktopItems.map((style, index) => {
          const hideOnMd = index >= 4;
          const hideOnLgXl = index >= 6;
          const hideOn2xl = index >= 8;

          return (
            <div
              key={style.title}
              className={`
                ${hideOnMd ? "md:hidden" : ""}
                ${index < 6 ? "lg:block" : "lg:hidden"}
                ${index < 6 ? "xl:block" : "xl:hidden"}
                ${index < 8 ? "2xl:block" : "2xl:hidden"}
              `}
            >
              <StyleCard style={style} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StyleCard({ style, mobile = false }) {
  return (
    <button
      className={`
        group relative overflow-hidden text-left
        rounded-[24px] border border-white/10 bg-[#090A0A]
        transition-all duration-300
        hover:border-purple-400/50
        hover:shadow-[0_0_30px_rgba(168,85,247,0.16)]
        ${mobile ? "snap-start w-[calc(50vw-16px)] min-w-[240px] h-[128px]" : "w-full h-[128px] md:h-[136px]"}
      `}
    >
      {/* purple corner accents */}
      <div className="pointer-events-none absolute inset-0 rounded-[24px]">
        <div className="absolute left-0 top-0 h-[1.5px] w-24 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-transparent" />
        <div className="absolute left-0 top-0 h-20 w-[1.5px] bg-gradient-to-b from-purple-500 via-fuchsia-400 to-transparent" />
        <div className="absolute bottom-0 right-0 h-[1.5px] w-24 bg-gradient-to-l from-purple-500 via-fuchsia-400 to-transparent" />
        <div className="absolute bottom-0 right-0 h-20 w-[1.5px] bg-gradient-to-t from-purple-500 via-fuchsia-400 to-transparent" />
      </div>

      {/* soft glow */}
      <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-2xl" />

      <div className="relative z-10 flex h-full items-center justify-between gap-4 p-4 md:p-5">
        <div className="min-w-0 flex-1">
 <h3
  className="
    text-[18px] md:text-[20px] font-bold leading-tight
    bg-gradient-to-r from-white via-purple-100 to-purple-500
    bg-clip-text text-transparent
    inline-block
  "
>
  {style.title}
</h3>

          <p
            className="mt-2 text-white/55 text-sm leading-6 max-w-[220px]"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {style.description}
          </p>
        </div>

        <div className="relative shrink-0 w-[100px] h-[100px] md:w-[115px] md:h-[115px]">
          <img
            src={style.image}
            alt={style.title}
            className="
              h-full w-full rounded-[18px] object-cover
              transition-transform duration-300
              group-hover:scale-[1.03]
            "
          />
        </div>
      </div>
    </button>
  );
}