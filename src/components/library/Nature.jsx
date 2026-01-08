import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef } from "react";

export default function Nature({ items = [], onSelect, selectedId }) {
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  return (
    <section className="px-10 w-full overflow-x-hidden">
      <div className="mt-10 flex justify-center items-center">
        <h2 className="text-[#110829] font-semibold text-[16px]">Nature</h2>
      </div>

      {/* Mobile arrows */}
      <div className="flex justify-end w-full max-w-[260px] sm:max-w-[560px] sm:px-4 gap-2 mx-auto">
        <button
          onClick={scrollLeft}
          className="bg-white shadow-md rounded-full p-2 block md:hidden"
        >
          <ArrowLeft className="w-3 h-3 text-[#110829]" />
        </button>
        <button
          onClick={scrollRight}
          className="bg-white shadow-md rounded-full p-2 block md:hidden"
        >
          <ArrowRight className="w-3 h-3 text-[#110829]" />
        </button>
      </div>

      <div className="flex justify-center relative items-center max-w-[1100px] mx-auto">
        <div
          ref={scrollRef}
          className="overflow-x-auto overscroll-x-contain scrollbar-hide
                     w-[260px] sm:w-[530px] md:w-[690px] lg:w-[730px] xl:w-[960px]"
        >
          {/* Desktop arrows */}
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2
                       bg-white shadow-md rounded-full p-2 hidden md:block"
          >
            <ArrowLeft className="w-5 h-5 text-[#110829]" />
          </button>

          <div className="flex gap-4 w-max py-3">
            {items.map((bg) => {
              const active = selectedId === bg.id;

              return (
                <button
                  key={bg.id}
                  onClick={() => {
                    if (bg.locked) return;
                    onSelect?.(bg);
                  }}
                  className={`relative h-[140px] w-[120px] rounded-md overflow-hidden border-2 transition
                    ${active ? "border-[#7A3BFF]" : "border-transparent"}
                    ${bg.locked ? "cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  <img
                    src={bg.src}
                    alt={bg.id}
                    className={`h-full w-full object-cover transition
                      ${bg.locked ? "grayscale brightness-75" : ""}
                    `}
                  />

                  {/* 🔒 LOCKED OVERLAY */}
                  {bg.locked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-[11px] font-semibold bg-black/60 px-2 py-1 rounded">
          {bg.lockReason === "starter"
        ? "Upgrade to Starter"
        : bg.lockReason === "pro"
        ? "Upgrade to Pro"
        : "Upgrade to Generative"}

                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2
                       bg-white shadow-md rounded-full p-2 hidden md:block"
          >
            <ArrowRight className="w-5 h-5 text-[#110829]" />
          </button>
        </div>
      </div>
    </section>
  );
}
