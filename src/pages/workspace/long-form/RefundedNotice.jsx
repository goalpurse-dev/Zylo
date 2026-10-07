// RefundedNotice.jsx — a video we could not make at all (2026-10-07). Every
// credit held for it went back by itself, so there is nothing to retry here:
// the only action is a new video. The words come from the server
// (REFUNDED_COPY, stickman/autopilot.ts); this is their fallback.
import { useNavigate } from "react-router-dom";
import { Coins, Plus } from "lucide-react";

export const REFUNDED_FALLBACK = "We couldn't make this video, so every credit for it is back in your account. Start it again whenever you like.";

export function RefundedNotice({ message, className = "" }) {
  const navigate = useNavigate();
  return (
    <div data-testid="refunded-notice" className={`rounded-2xl border border-white/10 bg-[#151719] p-6 text-center ${className}`}>
      <Coins className="mx-auto h-6 w-6 text-lime-300" />
      <p className="mt-2 text-[16px] font-bold text-white">Your credits are back</p>
      <p className="mt-1 text-[13px] text-white/60">{message || REFUNDED_FALLBACK}</p>
      <button type="button" onClick={() => navigate("/long-form/new")} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-bold text-[#11150D]">
        <Plus className="h-4 w-4" /> Start a new video
      </button>
    </div>
  );
}
