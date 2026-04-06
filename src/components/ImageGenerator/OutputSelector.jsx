import React, { useRef } from "react";
import { ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";

const OutputSelector = ({
  currentSize,
  selectedResolution,
  open,
  setOpen,
  selectedModel,
  children,
}) => {
  const buttonRef = useRef(null);
  const rect = buttonRef.current?.getBoundingClientRect();

  return (
    <>
      {/* BUTTON */}
      <div className="relative w-full">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation(); // 🔥 prevents weird bubbling
            setOpen((p) => !p);
          }}
          className="
            w-full rounded-xl border border-white/10
            bg-[#16181A]
            px-4 py-3 text-left
            transition-colors duration-200
            hover:border-[#7A3BFF]/70
          "
        >
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs text-white/40">Output</span>

              <div className="text-white font-medium">
                {currentSize.label}
                {selectedModel?.supportsResolutions && (
                  <span className="text-white/50">
                    {" "}
                    | {selectedResolution.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight
              className={`
                w-4 h-4 transition
                ${open ? "rotate-90 text-purple-400" : "text-white/50"}
              `}
            />
          </div>
        </button>
      </div>

      {/* =========================
         💻 DESKTOP FIXED ✅
      ========================= */}
      {open && rect &&
        createPortal(
          <div
            className="hidden md:block fixed inset-0 z-[999]"
            data-selector-portal
          >
            {/* 🔥 CLICK OUTSIDE BACKDROP */}
            <div
              className="absolute inset-0"
              onClick={() => setOpen(false)}
            />

            {/* PANEL POSITION */}
            <div
              className="absolute pointer-events-auto"
              style={{
                top: rect.top,
                left: rect.right + 10,
              }}
            >
              {/* ARROW */}
              <div className="absolute left-[-6px] top-8 w-3 h-3 rotate-45 bg-[#111318]" />

              {/* PANEL */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="
                  w-[420px] max-w-[calc(100vw-40px)]
                  bg-[#111318]
                  border border-white/10
                  rounded-2xl
                  p-5
                  shadow-[0_20px_60px_rgba(0,0,0,0.6)]
                  transition-all duration-200 ease-out
                  origin-left
                  animate-in fade-in zoom-in-95
                "
              >
                {children}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* =========================
         📱 MOBILE (UNCHANGED ✅)
      ========================= */}
      {open &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 z-[999]"
            data-selector-portal
          >
            {/* BACKDROP */}
            <div
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60"
            />

            {/* SHEET */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="
                absolute bottom-0 left-0 right-0
                bg-[#111318]
                border-t border-white/10
                rounded-t-2xl
                p-5
                animate-in slide-in-from-bottom duration-300
              "
              style={{
                paddingBottom:
                  "calc(env(safe-area-inset-bottom) + 20px)",
              }}
            >
              {/* HANDLE */}
              <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />

              {/* HEADER */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-white font-medium">
                  Output Settings
                </span>

                <button onClick={() => setOpen(false)}>
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {children}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default OutputSelector;