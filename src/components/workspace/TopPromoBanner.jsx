import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

export default function TopPromoBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
   const dismissed = sessionStorage.getItem("promo_closed");
    if (!dismissed) setVisible(true);
  }, []);

  const handleClose = () => {
    sessionStorage.setItem("promo_closed", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
<div className="w-full bg-[#090A0A]">
  <div
    className="
      relative overflow-hidden
      bg-[#090A0A]
    "
  >
    {/* 🔥 CENTER GRADIENT (controlled, not too bright) */}
<div
  className="
    absolute inset-0
    bg-[linear-gradient(90deg,#090A0A_0%,#090A0A_18%,rgba(168,85,247,0.25)_32%,rgba(168,85,247,0.45)_45%,rgba(232,121,249,0.45)_55%,rgba(168,85,247,0.45)_68%,rgba(168,85,247,0.25)_80%,#090A0A_92%,#090A0A_100%)]
    sm:bg-[linear-gradient(90deg,#090A0A_0%,#090A0A_30%,rgba(168,85,247,0.35)_45%,rgba(232,121,249,0.35)_55%,#090A0A_70%,#090A0A_100%)]
  "
/>
    {/* subtle glow */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.12),transparent_70%)] pointer-events-none" />

    {/* ❌ CLOSE */}
    <button
      onClick={handleClose}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition z-10"
    >
      ✕
    </button>

    {/* CENTER CONTENT */}
    <div className="relative mx-auto flex items-center justify-center gap-2 px-4 pr-10 py-2.5 text-white overflow-hidden">

      <span className="text-base leading-none shrink-0">⚡</span>

      {/* Mobile: short. Desktop: full */}
      <span className="text-white/90 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0">
        Pro plan
      </span>

      <span className="text-purple-300 font-bold text-xs whitespace-nowrap shrink-0 sm:hidden">
        25% off
      </span>

      <span className="text-purple-300 font-bold text-sm whitespace-nowrap shrink-0 hidden sm:inline">
        25% off — this week only
      </span>

      <span className="hidden lg:inline text-white/30 shrink-0">—</span>
      <span className="hidden lg:inline text-white/60 text-sm whitespace-nowrap shrink-0">
        1,200 credits/mo · AI images, videos &amp; scripts.
      </span>

      <button
        onClick={() => navigate("/workspace/pricing")}
        className="shrink-0 ml-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 hover:opacity-90 transition whitespace-nowrap"
      >
        Get the deal →
      </button>
    </div>
  </div>
</div>
  );
}