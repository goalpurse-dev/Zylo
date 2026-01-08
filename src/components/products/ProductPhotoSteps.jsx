// src/components/products/ProductPhotoSteps.jsx
import React, { useEffect, useRef, useState } from "react";

import step1Img from "../../assets/products/step1.png";
import step2Img from "../../assets/products/step2.png";
import step3Img from "../../assets/products/step3.png";

const STEPS = [
  {
    label: "STEP 1",
    title: "Product",
    text: "Upload your product image once. Zylo keeps it ready for every new scene.",
    img: step1Img,
  },
  {
    label: "STEP 2",
    title: "AI background removal",
    text: "Our advanced AI precisely removes the background so your product is perfectly isolated.",
    img: step2Img,
  },
  {
    label: "STEP 3",
    title: "Generate & scale",
    text: "Pick a background, generate multiple on-brand photos, and export in HD for every channel.",
    img: step3Img,
  },
];

const card =
  "relative flex flex-col rounded-[22px] border border-white/10 " +
  "bg-[#0e1319] shadow-[0_14px_40px_rgba(0,0,0,0.65)] " +
  "px-5 pt-5 pb-5 transition-all duration-400 " +
  "ease-[cubic-bezier(0.22,0.61,0.36,1)] " +
  "hover:-translate-y-1.5 hover:shadow-[0_22px_60px_rgba(0,0,0,0.85)] " +
  "hover:border-[#A855F7]/70";

function SquareImg({ src, alt }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[16px]">
      <div className="relative w-full" style={{ paddingBottom: "100%" }}>
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </div>
  );
}

export default function ProductPhotoSteps() {
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (setVisible(true), io.disconnect())),
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

 return (
  <section ref={wrapRef} className="relative mx-auto mt-14 max-w-7xl px-3 text-white">
    <div className="mb-8 text-center">
      <h2 className="text-[28px] font-semibold tracking-tight">
        3 simple steps. <span className="text-[#A855F7]">Perfect product photos.</span>
      </h2>
      <p className="mt-1 text-sm text-white/60 max-w-2xl mx-auto">
        From raw product shot to fully branded scenes in seconds.
      </p>
    </div>

    {/* ── MOBILE PANEL (stacked) ─────────────────────────────────────────── */}
    <div className="steps-panel md:hidden">
      <div className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${card} ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
          >
            <div className="text-[8px] font-semibold tracking-[0.18em] text-[#A855F7] uppercase">
              {STEPS[i].label}
            </div>
            <h3 className="mt-1 text-[18px] font-semibold">{STEPS[i].title}</h3>
            <p className="mt-1 text-[11px] text-white/70">{STEPS[i].text}</p>
            <SquareImg src={STEPS[i].img} alt={STEPS[i].title} />
          </div>
        ))}
      </div>
    </div>

    {/* ── DESKTOP/TABLET PANEL (side-by-side + connectors) ──────────────── */}
    <div className="steps-panel hidden md:block">
      <div
        className="mt-1 grid md:gap-6"
        style={{ gridTemplateColumns: "1fr 100px 1fr 100px 1fr", alignItems: "center" }}
      >
        {/* Left card */}
        <div className={`${card} ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          <div className="text-[8px] font-semibold tracking-[0.18em] text-[#A855F7] uppercase">
            {STEPS[0].label}
          </div>
          <h3 className="mt-1 text-[20px] font-semibold">{STEPS[0].title}</h3>
          <p className="mt-1 text-[12px] text-white/70">{STEPS[0].text}</p>
          <SquareImg src={STEPS[0].img} alt={STEPS[0].title} />
        </div>

        {/* Connector col: Left -> Middle */}
        <div className="relative h-full">
          <div className="connector-line top" />
          <div className="connector-line bottom" />
          <div className="pulse-ltr top" />
          <div className="pulse-ltr bottom delay-200" />
        </div>

        {/* Middle card */}
        <div className={`${card} ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          <div className="text-[8px] font-semibold tracking-[0.18em] text-[#A855F7] uppercase">
            {STEPS[1].label}
          </div>
          <h3 className="mt-1 text-[20px] font-semibold">{STEPS[1].title}</h3>
          <p className="mt-1 text-[12px] text-white/70">{STEPS[1].text}</p>
          <SquareImg src={STEPS[1].img} alt={STEPS[1].title} />
        </div>

        {/* Connector col: Middle -> Right */}
        <div className="relative h-full">
          <div className="connector-line top" />
          <div className="connector-line bottom" />
          <div className="pulse-ltr top" />
          <div className="pulse-ltr bottom delay-200" />
        </div>

        {/* Right card */}
        <div className={`${card} ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          <div className="text-[8px] font-semibold tracking-[0.18em] text-[#A855F7] uppercase">
            {STEPS[2].label}
          </div>
          <h3 className="mt-1 text-[20px] font-semibold">{STEPS[2].title}</h3>
          <p className="mt-1 text-[12px] text-white/70">{STEPS[2].text}</p>
          <SquareImg src={STEPS[2].img} alt={STEPS[2].title} />
        </div>
      </div>
    </div>
  </section>
);
}
