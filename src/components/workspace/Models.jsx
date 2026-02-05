import { useEffect } from "react";
import Nanobanana1 from "../../assets/models/nanobanana.png"
import Nanobanana2 from "../../assets/models/nanobanana2.png"

import Juggernaut from "../../assets/models/juggernaut.png"
import Juggernaut2 from "../../assets/models/juggernaut2.png"

import HiDream from "../../assets/models/hidream.png"
import HiDream2 from "../../assets/models/hidream2.png"

import Zyvo from "../../assets/models/zyvo.png"
import Zyvo2 from "../../assets/models/zyvo2.png"

import { Link, NavLink } from "react-router-dom";

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
  <Link
  to="/image-generator"
    className="
      absolute left-4 right-4 bottom-4
      text-center
      bg-gradient-to-r from-[#7A3BFF] to-[#7A3BFF]/60
      text-white text-sm py-2 rounded-md font-medium
      opacity-0 translate-y-2
      transition-all duration-300
      group-hover:opacity-100 group-hover:translate-y-0
    "
  >
    {buttonText}
  </Link>
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
          hoverImage={Nanobanana2}
          badge="Nano Banana Pro"
          title="Nano Banana Pro × OpenArt"
          description="4K generations on the best image model yet"
          buttonText="Use Nano Banana"
        />

        <ModelCard
          image={Juggernaut}
          hoverImage={Juggernaut2}
          badge="Juggernaut"
          title="Juggernaut Pro Flux by RunDiffusion"
          description="Ultra-detailed creative image generation"
          buttonText="Use Juggernaut"
        />

        <ModelCard
          image={Zyvo}
          hoverImage={Zyvo2}
          badge="OpenAI"
          title="OpenAI Image 1.5"
          description="Super advanced image generation from OpenAI"
          buttonText="Use OpenAI"
        />

        <ModelCard
          image={HiDream}
          hoverImage={HiDream2}
          badge="HiDream"
          title="HiDream-i1 Fast"
          description="Stylized worlds and characters in seconds"
          buttonText="Use HiDream-i1"
        />

      </div>
    </section>
  );
}
