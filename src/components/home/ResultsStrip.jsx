// src/components/ResultsStrip.jsx
import React, { useEffect, useRef, useState } from "react";

const STATS = [
  { label: "More leads vs. static image ads", value: 3.1, suffix: "x" },
  { label: "Higher ROI from campaigns", value: 1.9, suffix: "x" },
  { label: "Lower creative production cost", value: 88, suffix: "%" },
];

export default function ResultsStrip() {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [counts, setCounts] = useState(STATS.map(() => 0));

  // Observe enter/leave to re-trigger animation
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
          } else {
            // when user scrolls past -> reset so it can play again
            setVisible(false);
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Count-up when visible
  useEffect(() => {
    if (!visible) {
      setCounts(STATS.map(() => 0));
      return;
    }

    const duration = 900;
    const start = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);

      setCounts(
        STATS.map((s) => {
          const target = s.value;
          const raw = target * eased;
          return Number.isInteger(target)
            ? Math.round(raw)
            : Math.round(raw * 10) / 10;
        })
      );

      if (progress < 1 && visible) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [visible]);

  return (
    // outer section uses your global dark bg (no custom color override)
    <section ref={sectionRef} className="w-full py-20">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="rounded-[32px] bg-[#070a0f] border border-white/5 px-10 py-10 shadow-[0_40px_120px_rgba(0,0,0,0.9)]">
          {/* Title */}
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-white/40 uppercase">
              Real Results
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white">
              Brands use Zylo to turn scrolls into customers.
            </h2>
          </div>

          {/* Stats row */}
          <div
            className={[
              "grid gap-6 sm:grid-cols-3",
              "transform transition-all duration-700",
              visible
                ? "translate-y-0 opacity-100"
                : "-translate-y-4 opacity-0",
            ].join(" ")}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.10),_rgba(7,10,15,1))] border border-white/6 px-6 py-7"
              >
                {/* soft glow */}
                <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-40 -translate-x-1/2 rounded-full bg-white/7 blur-3xl" />

                <div
                  className="text-4xl sm:text-5xl font-semibold text-white leading-none"
                  style={{
                    textShadow:
                      "0 0 14px rgba(255,255,255,0.9), 0 0 34px rgba(255,255,255,0.35)",
                  }}
                >
                  {counts[i]}
                  {stat.suffix}
                </div>
                <p className="mt-3 text-sm text-white/70">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[9px] text-white/30">
            *Based on internal Zylo AI benchmarks from early adopter
            campaigns.
          </p>
        </div>
      </div>
    </section>
  );
}
