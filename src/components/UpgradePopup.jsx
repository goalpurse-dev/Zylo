import React from "react";
import { X } from "lucide-react";

export default function UpgradePopup({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 animate-fadeIn relative">

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TITLE */}
        <h2 className="text-xl font-bold text-[#0A0F1C]">
          Feature coming soon
        </h2>

        {/* DESCRIPTION */}
        <p className="mt-2 text-sm text-[#5B6275] leading-relaxed">
          This feature isn't available yet — we're working hard to release it soon!
        </p>

        {/* BUTTON */}
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl px-5 py-3 font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
        >
          Okay, got it
        </button>

      </div>
    </div>
  );
}
