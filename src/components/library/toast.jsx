import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function BackgroundCard({ item, onSelect, selectedId }) {
  const isSelected = selectedId === item.id;

  return (
    <div
      className={`relative w-[150px] aspect-square rounded-xl overflow-hidden cursor-pointer
        ${item.locked ? "cursor-not-allowed" : ""}
        ${isSelected ? "ring-2 ring-[#7A3BFF]" : ""}
      `}
      onClick={() => {
        if (item.locked) return;
        onSelect(item);
      }}
    >
      {/* Image */}
      <img
        src={item.src}
        alt={item.label}
        className={`w-full h-full object-cover transition
          ${item.locked ? "blur-sm brightness-75" : ""}
        `}
      />

      {/* LOCK OVERLAY */}
      {item.locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 bg-black/30">
          <Lock size={20} className="text-white mb-2" />

          <p className="text-white text-[12px] font-medium leading-tight">
            Available on
            <br />
            <span className="font-semibold">Generative Plan</span>
          </p>

          <Link
            to="/pricing"
            className="mt-2 text-[11px] text-white underline opacity-90 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            Upgrade →
          </Link>
        </div>
      )}
    </div>
  );
}
