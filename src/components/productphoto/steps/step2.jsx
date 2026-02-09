import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import Library from "../../../pages/workspace/library.jsx";

/* =======================
   TOP PICKS ONLY (WORKING)
======================= */

const TOPPICKS_BASE =
  "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/public-assets/products/toppicks";

const TOPPICKS = Array.from({ length: 21 }, (_, i) => {
  const index = String(i + 1).padStart(2, "0");
  return {
    id: `toppicks-${i + 1}`,
    label: `Top pick ${i + 1}`,
    category: "toppicks",
    src: `${TOPPICKS_BASE}/toppicks-${index}.png`,
  };
});

/* EXACTLY TWO ROWS */
const rows = [
  TOPPICKS.slice(0, Math.ceil(TOPPICKS.length / 2)),
  TOPPICKS.slice(Math.ceil(TOPPICKS.length / 2)),
];

export default function Step2({ onNext, onBack }) {
  const [selectedBg, setSelectedBg] = useState(null);
  const [librarySelectedId, setLibrarySelectedId] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const rowRefs = useRef([]);

  /* 🔒 lock page scroll when modal open */
  useEffect(() => {
    document.body.style.overflow = showLibrary ? "hidden" : "auto";
    return () => (document.body.style.overflow = "auto");
  }, [showLibrary]);

  const scrollRow = (index, dir) => {
    rowRefs.current[index]?.scrollBy({
      left: dir * 240,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex justify-center py-6">
      <div className="bg-[#141622] mt-4 w-full max-w-6xl  rounded-lg">

        <div className="flex justify-center mt-2">
          <div className="bg-[#1A1D2B] border border-[#2A2F45]  w-[240px] h-[35px] rounded-lg flex items-center gap-3 px-3">
            <StepCircle active>1</StepCircle>
            <StepLine />
            <StepLine />
            <StepCircle active>2</StepCircle>
            <StepLine />
            <StepLine />
            <StepCircle>3</StepCircle>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center py-6">
          <h1 className="text-[#F4F6FB] font-semibold text-[18px]">
            Choose Background
          </h1>
        </div>

        {/* 🔁 TWO ROWS – TOP PICKS ONLY */}
        <div className="mt-2 px-6 space-y-6">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="relative">

              <button
                onClick={() => scrollRow(rowIndex, -1)}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10
                           bg-[#B7BBC6] shadow-md rounded-full p-2"
              >
                <ArrowLeft className="w-4 h-4 text-[#110829]" />
              </button>

              <div
                ref={(el) => (rowRefs.current[rowIndex] = el)}
                className="flex gap-3 overflow-x-auto scrollbar-hide py-2 px-8"
              >
                {row.map((bg) => {
                  const active =
                    selectedBg &&
                    (selectedBg.id === bg.id || selectedBg.src === bg.src);

                  return (
                    <button
                      key={bg.id}
                      onClick={() => setSelectedBg(bg)}
                      className={`flex-shrink-0 w-[100px] h-[140px] rounded-lg
                        overflow-hidden border-2 transition
                        ${
                          active
                            ? "border-[#7A3BFF]"
                            : "border-transparent"
                        }`}
                    >
                      <img
                        src={bg.src}
                        alt={bg.label}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => scrollRow(rowIndex, 1)}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10
                           bg-[#B7BBC6] shadow-md rounded-full p-2"
              >
                <ArrowRight className="w-4 h-4 text-[#110829]" />
              </button>
            </div>
          ))}
        </div>

        {/* Check all */}
        <div className="flex justify-center mt-6">
          <button
            onClick={() => {
              setSelectedBg(null);
              setShowLibrary(true);
            }}
            className="bg-[#7A3BFF] rounded-xl
                       px-6 py-2 text-white font-semibold shadow-lg"
          >
            Check All
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-between px-5 lg:px-20 py-10">
          <button
            onClick={onBack}
            className="py-1 px-8 bg-[#1A1D2B] border-[#2A2F45] border-2 rounded-lg shadow-lg"
          >
            Back
          </button>

          <button
            disabled={!selectedBg}
            onClick={() => onNext(selectedBg)}
            className={`py-1 px-8 rounded-lg shadow-lg
              ${
                selectedBg
                  ? " bg-[#7A3BFF] text-white"
                  : "border-gray-300 text-[#7A7F8C] cursor-not-allowed"
              }`}
          >
            Next
          </button>
        </div>
      </div>

      {/* 🔲 BACKGROUND LIBRARY MODAL */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-center px-4">
          <div className="relative bg-[#141622] w-full max-w-6xl h-[90vh]
                          rounded-xl overflow-hidden flex flex-col">

            <div className="relative px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-[#F4F6FB] font-semibold text-center">
                Background Library
              </h2>

              <button
                onClick={() => {
                  setShowLibrary(false);
                  setSelectedBg(null);
                  setLibrarySelectedId(null);
                }}
                className="absolute top-4 right-4"
              >
                <X className="text-[#F4F6FB]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Library
                selectedId={librarySelectedId}
                onSelect={(bg) => {
                  setLibrarySelectedId(bg.id);
                  setSelectedBg({ ...bg, source: "library" });
                }}
              />
            </div>

            {selectedBg && selectedBg.source === "library" && (
              <div className="border-t bg-[#1A1D2B] px-6 py-4
                              flex justify-between items-center">
                <p className="text-sm text-[#F4F6FB] font-medium">
                  Selected background
                </p>
                <button
                  onClick={() => {
                    setShowLibrary(false);
                    onNext(selectedBg);
                  }}
                  className="bg-[#7A3BFF] text-white
                             px-6 py-2 rounded-lg font-semibold"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function StepCircle({ children, active }) {
  return (
    <div
      className={`rounded-full h-6 w-6 flex items-center justify-center
        ${active ? "bg-purple-400" : "bg-[#B7BBC6]"}`}
    >
      <p className="text-[#110829] text-sm">{children}</p>
    </div>
  );
}

function StepLine() {
  return <div className="bg-[#B7BBC6] h-[8px] w-[20px] rounded-lg" />;
}
