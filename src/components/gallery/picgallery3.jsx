import React from "react";
import v01 from "../../assets/grid/image/astronaut.jpg";
import v02 from "../../assets/grid/image/dragob.jpg";
import v03 from "../../assets/grid/image/horse.jpg";
import v04 from "../../assets/grid/image/land.jpg";
import v05 from "../../assets/grid/image/samurai.jpg";
import v06 from "../../assets/grid/image/wolf.jpg";

const IMAGES = [v01, v02, v03, v04, v05, v06];

export default function ShowcaseGallery({ title = "Shots generated with Zylo" }) {
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
                key={i}
                className="relative w-[200px] h-[200px] md:w-[240px] md:h-[240px]
                           rounded-xl overflow-hidden border border-white/10 bg-white/5
                           hover:shadow-[0_0_22px_rgba(62,254,207,0.18)] transition-shadow duration-300"
              >
                <img src={src} alt={`Showcase ${i + 1}`} className="absolute inset-0 w-full h-full object-cover object-center" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
