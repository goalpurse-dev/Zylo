import { X, Sparkles, Image as ImageIcon } from "lucide-react";
import { createPortal } from "react-dom";

export default function GuestGenerateModal({ open, onClose, onSignup }) {
  if (!open) return null;

  return createPortal(
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      {/* MODAL */}
      <div className="fixed z-[9999] left-1/2 -translate-x-1/2 top-[18%] md:top-1/2 md:-translate-y-1/2 w-[92%] md:w-[720px] bg-[#141722] border border-white/10 rounded-sm shadow-2xl p-7">

        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div>

            <h2 className="text-white text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Generate AI Images
            </h2>

            <p className="text-white/60 text-sm mt-1">
              Create stunning images in seconds.
            </p>

          </div>

          <button
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FREE HIGHLIGHT */}
        <div className="mb-6 p-4 rounded-sm border border-purple-500/30 bg-purple-500/10">

          <p className="text-sm text-white/80">
            Sign up now and get
          </p>

          <p className="text-2xl font-semibold text-purple-400 mt-1">
            3 FREE image generations
          </p>

          <p className="text-xs text-white/50 mt-1">
            Every week • No credit card required
          </p>

        </div>

        {/* EXAMPLES */}
     <div className="grid  md:grid-cols-4 grid-cols-2 gap-2 mb-6">

  {/* Always visible */}
  <ImageItem src="/assets/toast/1.webp" />
   <ImageItem src="/assets/toast/4.webp" />

  {/* md and up */}
  <ImageItem src="/assets/toast/5.webp" className="hidden md:block" />
   <ImageItem src="/assets/toast/2.webp" className="hidden md:block" />



</div>

        {/* BENEFITS */}
        <div className="flex justify-between text-xs text-white/60 mb-6">

          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-purple-400"/>
            High quality AI images
          </div>

          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400"/>
            Multiple styles
          </div>

          <div className="flex items-center gap-2">
            ⚡
            Generate in seconds
          </div>

        </div>

        {/* CTA */}
        <button
          onClick={onSignup}
          className="
          w-full
          py-3
          rounded-sm
          font-semibold
          text-white
          bg-gradient-to-r
          from-[#7A3BFF]
          to-[#6F3AE6]
          hover:scale-[1.02]
          shadow-lg
          shadow-purple-600/30
          transition
          "
        >
          Create Free Account
        </button>

       </div>
  </>,
  document.body
  );
}
function ImageItem({ src, className = "" }) {
  return (
    <div
      className={`aspect-square rounded-sm overflow-hidden border border-white/10 hover:border-purple-500/40 hover:scale-105 transition ${className}`}
    >
      <img
        src={src}
        className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
      />
    </div>
  );
}
