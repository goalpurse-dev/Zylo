import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import CreatorRewardsModal from "../CreatorRewardsModal.jsx";

export default function TopPromoBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);

  useEffect(() => {
   const dismissed = sessionStorage.getItem("free_credits_banner_closed");
    if (!dismissed) setVisible(true);
  }, []);

  const handleClose = () => {
    sessionStorage.setItem("free_credits_banner_closed", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
<>
<div className="w-full bg-[#090A0A]">
  <div
    className="
      relative overflow-hidden
      bg-[#090A0A]
    "
  >
    {/* Purple announcement wash */}
<div
  className="
    absolute inset-0
    bg-[linear-gradient(90deg,#090A0A_0%,#090A0A_18%,rgba(168,85,247,0.25)_32%,rgba(168,85,247,0.45)_45%,rgba(232,121,249,0.45)_55%,rgba(168,85,247,0.45)_68%,rgba(168,85,247,0.25)_80%,#090A0A_92%,#090A0A_100%)]
    sm:bg-[linear-gradient(90deg,#090A0A_0%,#090A0A_30%,rgba(168,85,247,0.35)_45%,rgba(232,121,249,0.35)_55%,#090A0A_70%,#090A0A_100%)]
  "
/>
    {/* subtle glow */}
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.12),transparent_70%)]" />

    {/* ❌ CLOSE */}
    <button
      onClick={handleClose}
      aria-label="Dismiss free credits announcement"
      className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm text-white/45 transition hover:bg-white/5 hover:text-white sm:right-3"
    >
      ✕
    </button>

    {/* CENTER CONTENT */}
    <div className="relative mx-auto flex min-h-8 items-center justify-center gap-1.5 overflow-hidden px-2 py-1 pr-9 text-white sm:min-h-9 sm:gap-2 sm:px-4 sm:pr-11">

      <span className="shrink-0 text-[13px] leading-none sm:text-sm">🔥</span>

      <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-white/90 sm:text-xs">
        Free Zyvo Credits
      </span>

      <span className="hidden shrink-0 whitespace-nowrap text-[10px] font-bold text-purple-300 min-[440px]:inline sm:hidden">
        up for grabs
      </span>

      <span className="hidden shrink-0 whitespace-nowrap text-xs font-bold text-purple-300 sm:inline">
        up to 1,500 available
      </span>

      <span className="hidden shrink-0 text-white/30 lg:inline">—</span>
      <span className="hidden shrink-0 whitespace-nowrap text-xs text-white/60 lg:inline">
        Post about Zyvo on socials and earn free credits for every view.
      </span>

      <button
        onClick={() => setRewardsModalOpen(true)}
        className="ml-0.5 shrink-0 whitespace-nowrap rounded-md bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 px-2 py-1 text-[10px] font-semibold text-white transition hover:opacity-90 sm:ml-1 sm:px-2.5 sm:text-xs"
      >
        Learn more <span className="hidden min-[380px]:inline">→</span>
      </button>
    </div>
  </div>
</div>

  {rewardsModalOpen && (
    <CreatorRewardsModal onClose={() => {
      if (user) localStorage.setItem(`zyvo_creator_rewards_seen:${user.id}`, "1");
      setRewardsModalOpen(false);
    }} />
  )}
  </>
  );
}
