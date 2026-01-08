// src/components/ShowcaseGallery.jsx
import React from "react";
import v36 from "../assets/library/v36.png";
import v41 from "../assets/library/v41.png";
import v42 from "../assets/library/v42.png";
import v43 from "../assets/library/v43.png";
import v44 from "../assets/library/v44.png";
import v45 from "../assets/library/v45.png";
import v46 from "../assets/library/v46.png";

const IMAGES = [v36, v41, v42, v43, v44, v45, v46];

export default function ShowcaseGallery({ title = "Shots generated with Zylo" }) {
  return (
    <section className="relative pb-14">
      <div className="max-w-7xl mx-auto px-6">
        <h3 className="text-2xl md:text-3xl font-bold text-center text-black">
          {title}
        </h3>

        <div className="mt-8 overflow-x-auto overflow-y-hidden
                        [mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]
                        [-webkit-mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]">
          <div className="flex gap-4 min-w-max px-6">
            {IMAGES.map((src, i) => (
              <div
                key={i}
                className="relative w-[260px] h-[148px] md:w-[320px] md:h-[182px]
                           rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]
                           hover:shadow-[0_0_22px_rgba(62,254,207,0.18)] transition-shadow duration-300"
              >
                {/* Crop toward the RIGHT side */}
                <img
                  src={src}
                  alt={`Showcase ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover object-right"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
