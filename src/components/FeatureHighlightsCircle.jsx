// src/components/PremiumAppsCarousel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function PremiumAppsCarousel({
  items = [],
  cardW = 260,
  cardH = 380,
  visible = 4,          // how many cards we want visible
  gap = 16,
  speedPx = 60,         // autoplay speed (px/sec)
  edgeFadePct = 8,      // % of the viewport masked on the left/right
}) {
  const rafRef = useRef(null);
  const [pos, setPos] = useState(0); // track translateX in px

  if (!items.length) return null;

  // Create a long loop so we can scroll forever
  const loop = useMemo(() => [...items, ...items, ...items], [items]);

  const slot = cardW + gap;                    // start-to-start distance
  const viewportW = visible * slot - gap;      // width of visible area
  const trackW = loop.length * slot;           // total width of the track

  // Autoplay
  useEffect(() => {
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setPos((p) => {
        let nxt = p + speedPx * dt;
        // wrap after one original cycle (items.length * slot)
        const oneCycle = items.length * slot;
        if (nxt >= oneCycle) nxt -= oneCycle;
        return nxt;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [items.length, slot, speedPx]);

  const getBadge = (title) => (/cartoon/i.test(title) ? "🔥 Trending" : null);

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-12">
        {/* Viewport with soft edge fade */}
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{
            width: "100%",
            maxWidth: viewportW,
            margin: "0 auto",
            WebkitMaskImage: `linear-gradient(to right,
              transparent 0%,
              black ${edgeFadePct}%,
              black ${100 - edgeFadePct}%,
              transparent 100%)`,
            maskImage: `linear-gradient(to right,
              transparent 0%,
              black ${edgeFadePct}%,
              black ${100 - edgeFadePct}%,
              transparent 100%)`,
          }}
        >
          {/* Track: left-anchored, only translateX(-pos) */}
          <div
            className="relative"
            style={{
              width: trackW,
              height: cardH,
              transform: `translateX(${-pos}px)`,
              willChange: "transform",
            }}
          >
            {loop.map((item, i) => {
              const x = i * slot;
              // Compute each card's center vs viewport center (which is viewportW/2)
              const cardCenter = (x - pos) + cardW / 2;
              const viewCenter = viewportW / 2;
              const dist = Math.abs(cardCenter - viewCenter);    // px distance from center
              const norm = Math.min(1, dist / (viewportW / 2));  // 0..1
              const scale = 0.92 + (1 - norm) * 0.16;            // edge 0.92 -> center 1.08
              const opacity = 0.55 + (1 - norm) * 0.45;          // edge 0.55 -> center 1.0
              const badge = getBadge(item.title);

              return (
                <Link
                  key={`${i}-${item.title}`}
                  to={item.to || "#"}
                  className="absolute top-0 bg-white border border-gray-700 rounded-xl shadow-md overflow-hidden transition-transform duration-300 hover:shadow-[0_0_30px_#3EFECF33]"
                  style={{
                    left: x,
                    width: cardW,
                    height: cardH,
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    opacity,
                  }}
                >
                  {/* Image area */}
                  <div className="relative w-full" style={{ height: cardH - 110 }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : item.icon ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <img
                          src={item.icon}
                          alt={item.title}
                          className="w-20 h-20 object-contain"
                        />
                      </div>
                    ) : null}

                    {badge && (
                      <div className="absolute top-2 left-2 text-[11px] px-2 py-1 rounded-full font-semibold bg-black/70 text-white">
                        {badge}
                      </div>
                    )}
                  </div>

                  {/* Text block */}
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-[#007BFF] text-center leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-black text-sm text-center mt-2 px-2 leading-snug min-h-[36px]">
                      {item.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
