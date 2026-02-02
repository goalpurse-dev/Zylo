import { useEffect } from "react";
import Nanobanana1 from "../../assets/models/nanobanana.png"

/* ============================
   REUSABLE MODEL CARD
============================ */
function ModelCard({
  image,
  hoverImage,
  badge,
  title,
  description,
  buttonText,
}) {
 return (
  <div className="
    group
    relative
    w-full
    aspect-[2/3]
    sm:aspect-[5/3]
    rounded-xl
    overflow-hidden
    cursor-pointer
  ">

      {/* DEFAULT IMAGE */}
      <img
        src={image}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-0"
      />

      {/* HOVER IMAGE */}
      <img
        src={hoverImage}
        className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* TOP RIGHT BADGE */}
      <div className="absolute top-3 right-3 z-20">
        <div className="flex items-center justify-center backdrop-blur-md bg-white/40 rounded-md px-3 py-1">
          <p className="text-black/40 text-xs font-medium">
            {badge}
          </p>
        </div>
      </div>

{/* BOTTOM OVERLAY */}
<div
  className="
    absolute bottom-0 left-0 right-0
    p-4
    bg-gradient-to-t from-black/80 via-black/50 to-transparent
    transition-all duration-300
    group-hover:pb-16
  "
>
  <p className="text-white font-medium text-[15px]">
    {title}
  </p>

  <p className="text-white/80 text-xs mt-1">
    {description}
  </p>

  {/* BUTTON */}
  <button
    className="
      absolute left-4 right-4 bottom-4
      bg-gradient-to-r from-[#7A3BFF] to-[#492399]
      text-white text-sm py-2 rounded-md font-medium
      opacity-0 translate-y-2
      transition-all duration-300
      group-hover:opacity-100 group-hover:translate-y-0
    "
  >
    {buttonText}
  </button>
</div>


    </div>
  );
}

/* ============================
   PAGE
============================ */
export default function Model() {
  useEffect(() => {
    // SEO / analytics hooks if needed
  }, []);

  return (
    <section className="w-full px-4">

      <div>
        <h1 className="text-[#110829] font-semibold text-[26px]">
          Latest AI Models
        </h1>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-6 mt-4">

        <ModelCard
          image={Nanobanana1}
          hoverImage="/models/nano-banana-hover.png"
          badge="Nano Banana Pro"
          title="Nano Banana Pro × OpenArt"
          description="4K generations on the best image model yet"
          buttonText="Use Nano Banana"
        />

        <ModelCard
          image="/models/openart.png"
          hoverImage="/models/openart-hover.png"
          badge="OpenArt"
          title="OpenArt XL"
          description="Ultra-detailed creative image generation"
          buttonText="Use OpenArt"
        />

        <ModelCard
          image="/models/vision.png"
          hoverImage="/models/vision-hover.png"
          badge="Vision"
          title="Vision Ultra"
          description="Photorealistic AI with cinematic lighting"
          buttonText="Use Vision"
        />

        <ModelCard
          image="/models/fantasy.png"
          hoverImage="/models/fantasy-hover.png"
          badge="Fantasy"
          title="Fantasy World Builder"
          description="Stylized worlds and characters in seconds"
          buttonText="Use Fantasy"
        />

      </div>
    </section>
  );
}
