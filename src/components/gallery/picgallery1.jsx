import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import v1 from "../../assets/grid/01_talker_front_9x16.jpg";
import v2 from "../../assets/grid/001_talker_front_9x16.jpg";
import v3 from "../../assets/grid/04_gamer_desk_9x16.jpg";
import v4 from "../../assets/grid/05_fullbody_studio_9x16.jpg";
import v6 from "../../assets/grid/avatar.png";

const IMAGES = [v1, v2, v3, v4, v6];
const zyloGrad = "bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]";

export default function ShowcaseGallery({
  title = "Shots generated with Zylo",
  ctaTo = "/avatar-studio",
}) {
  return (
    <section className="relative pb-14">
      <div className="max-w-7xl mx-auto px-6">
        <h3 className="text-2xl md:text-3xl font-bold text-center text-white">{title}</h3>

        <div className="mt-8 overflow-x-auto overflow-y-hidden
                        [mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]
                        [-webkit-mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]">
          <div className="flex gap-4 min-w-max px-6">
            {IMAGES.map((src, i) => (
              <div
                key={src}
                className="relative w-[160px] h-[284px] md:w-[200px] md:h-[356px]
                           rounded-xl overflow-hidden border border-white/10 bg-white/5
                           hover:shadow-[0_0_22px_rgba(62,254,207,0.18)] transition-shadow duration-300"
              >
                <img src={src} alt={`Showcase ${i + 1}`} className="absolute inset-0 w-full h-full object-cover object-center" loading="lazy" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link to={ctaTo} className="group">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm md:text-base font-semibold text-white
                          shadow-sm ring-1 ring-white/10 ${zyloGrad}
                          hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#7A3BFF]`}
            >
              Create ad with avatar now
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
