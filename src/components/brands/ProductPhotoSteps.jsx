// src/components/products/ProductPhotoSteps.jsx
import React, { useEffect, useRef, useState } from "react";

// ⬇️ Replace these with your own imports / URLs
// or pass them via props if you want.
import step1Img from "../../assets/products/step1.png";
import step2Img from "../../assets/products/step2.png";
import step3Img from "../../assets/products/step3.png";

const STEPS = [
  {
    label: "STEP 1",
    title: "Upload & isolate your product",
    text: "Upload your product image and remove the background in one click so Zylo can perfectly cut it out for pro-grade scenes.",
    img: step1Img,
  },
  {
    label: "STEP 2",
    title: "Pick style, mood & scene",
    text: "Choose from studio, lifestyle, e-commerce or custom scenes. Adjust lighting, angle and colors in seconds.",
    img: step2Img,
  },
  {
    label: "STEP 3",
    title: "Generate, review & scale",
    text: "Generate multiple on-brand variations, swap scenes instantly, download in HD and duplicate across your catalog.",
    img: step3Img,
  },
];

function ProductPhotoSteps() {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative mx-auto mt-24 max-w-6xl px-4 pb-6 text-white"
    >
      {/* Heading */}
      <div className="mb-10 text-center">
        <h2 className="text-[32px] font-semibold tracking-tight">
          3 simple steps. <span className="text-[#A855F7]">Perfect product photos.</span>
        </h2>
        <p className="mt-3 text-sm text-white/60 max-w-xl mx-auto">
          Turn raw product shots into scroll-stopping visuals without studios,
          props or retouching.
        </p>
      </div>

      {/* Connector lines behind cards */}
      <div className="pointer-events-none absolute left-0 right-0 top-[132px] flex justify-center">
        <div className="flex w-[70%] max-w-4xl items-center justify-between">
          {/* line: step 1 -> step 2 */}
          <div className="relative flex-1 h-[2px] bg-white/6 rounded-full overflow-hidden">
            <div className="heartbeat-line" />
          </div>

          {/* small gap under middle card */}
          <div className="w-10" />

          {/* line: step 2 -> step 3 */}
          <div className="relative flex-1 h-[2px] bg-white/6 rounded-full overflow-hidden">
            <div className="heartbeat-line heartbeat-delay" />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const baseCard =
            "relative flex flex-col rounded-[26px] border border-white/10 " +
            "bg-gradient-to-b from-white/4 to-white/[0.02] px-6 pt-6 pb-5 " +
            "shadow-[0_18px_60px_rgba(0,0,0,0.75)]/40 " +
            "backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] " +
            "hover:-translate-y-3 hover:shadow-[0_26px_80px_rgba(0,0,0,0.9)] hover:border-[#A855F7]/70";

          const enterStates = [
            visible
              ? "opacity-100 translate-y-0 translate-x-0"
              : "opacity-0 translate-y-6 -translate-x-10",
            visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6",
            visible
              ? "opacity-100 translate-y-0 translate-x-0"
              : "opacity-0 translate-y-6 translate-x-10",
          ];

          return (
            <div
              key={step.label}
              className={`${baseCard} ${enterStates[i]} ${
                visible ? `delay-[${i * 80}ms]` : ""
              }`}
            >
              {/* Top stripe */}
              <div className="absolute inset-x-4 top-0 h-[6px] translate-y-[-3px] rounded-full bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#22C55E]" />

              <div className="text-[10px] font-semibold tracking-[0.18em] text-[#A855F7] uppercase">
                {step.label}
              </div>

              <h3 className="mt-2 text-[20px] font-semibold leading-snug">
                {step.title}
              </h3>

              <p className="mt-2 text-[12px] leading-relaxed text-white/65">
                {step.text}
              </p>

              {/* Image slot */}
              <div className="mt-5 overflow-hidden rounded-[20px]">
                <img
                  src={step.img}
                  alt={step.title}
                  className="h-44 w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ProductPhotoSteps;
