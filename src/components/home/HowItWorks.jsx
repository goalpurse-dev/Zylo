import React from "react";
import { Link } from "react-router-dom";
import ZyloLogo from "../../assets/zylo.png";
import Zylo1 from "../../assets/zylo1.png";
import Work1 from "../../assets/home/work1.png";


const steps = [
  {
    title: "Create Brand",
    desc: "Name, colors, and voice. We guide you to a clean, consistent identity.",
    img: Zylo1,
  },
  {
    title: "Generate Kit",
    desc: "Instant logo, palette, and avatar—plus basic guidelines to keep everything on-brand.",
    img: ZyloLogo,
  },
  {
    title: "Launch Assets",
    desc: "Turn your kit into ads, product photos, and thumbnails in minutes.",
    img: Work1,
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-transparent py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white text-center">
          How it works
        </h2>
        <p className="mt-3 text-lg text-zinc-300 text-center">
          Three simple steps from idea to launch.
        </p>

        <div className="mt-16 space-y-20">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-10 md:gap-16 md:flex-row ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Text block */}
              <div className="md:w-1/2">
                <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                <p className="mt-4 text-zinc-300">{step.desc}</p>
              </div>

              {/* Image block */}
              <div className="md:w-1/2 w-full">
                <div className="rounded-[22px] shadow-md">
                  <div className="p-[1.5px] rounded-[22px] bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]">
                    <div className="rounded-[20px] bg-[#0c1218] flex items-center justify-center">
                      <img
                        src={step.img}
                        alt={step.title}
                        className="w-auto h-[120px] sm:h-[140px] md:h-[160px] max-w-[90%] object-contain rounded-[20px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 flex justify-center">
          <Link
            to="/brands"
            className="inline-flex items-center justify-center rounded-full px-7 h-12 font-semibold text-white
                       bg-gradient-to-r from-[#1677FF] to-[#7A3BFF] shadow-sm hover:opacity-95
                       focus:outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:ring-offset-0"
          >
            Create a Brand
          </Link>
        </div>
      </div>
    </section>
  );
}
