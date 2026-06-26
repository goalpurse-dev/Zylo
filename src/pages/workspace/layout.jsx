import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import TopPromoBanner from "../../components/workspace/TopPromoBanner";
import MobileBottomNav from "../../components/workspace/MobileBottomNav";
import WelcomeScreen from "../../components/WelcomeScreen";
import CreatorRewardsModal from "../../components/CreatorRewardsModal";

// ── Promo banner ──────────────────────────────────────────────
function VideoOutageBanner({ onDismiss }) {
  return (
    <div className="relative w-full bg-purple-500/8 border-b border-purple-400/20 px-4 py-2">
      <div className="relative mx-auto flex max-w-5xl items-center justify-center gap-2">
        <span className="text-sm leading-none">🎉</span>
        <span className="text-[12px] text-purple-200/70 text-center">
          <span className="font-semibold text-purple-300">Pro Plan — 25% off for a limited time.</span>
          {" "}Upgrade now to unlock unlimited generations.
        </span>
        <button
          onClick={onDismiss}
          className="absolute right-0 shrink-0 text-purple-400/40 hover:text-purple-300 transition text-base leading-none px-1"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}


export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [rewardsUserId, setRewardsUserId] = useState(null);

  // Clean up trailing # left by Supabase OAuth token exchange
  useEffect(() => {
    if (window.location.hash === "#") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);
  const isHomeRoute = location.pathname === "/workspace/home";
  const [bannerVisible, setBannerVisible] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [outageDismissed, setOutageDismissed] = useState(false);

  /* ================= PROMO ================= */
  useEffect(() => {
    if (!isHomeRoute) return;
    const dismissed = localStorage.getItem("promo_closed");
    setBannerVisible(!dismissed);
  }, [isHomeRoute]);

  /* ================= WELCOME / CREATOR REWARDS ================= */
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      setRewardsUserId(user.id);
      const rewardsKey = `zyvo_creator_rewards_seen:${user.id}`;
      const hasSeenRewards = !!localStorage.getItem(rewardsKey);

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_code")
        .eq("id", user.id)
        .single();

      const isFree = (profile?.plan_code || "free").toLowerCase() === "free";
      const welcomeKey = `zyvo_workspace_welcome:${user.id}`;

      if (isFree && !localStorage.getItem(welcomeKey)) {
        // Brand new account — Welcome screen comes first. The creator
        // rewards popup follows right after it's dismissed (see onClose below),
        // so it always lands as the *second* popup for new users.
        // Don't set the key yet — only mark as seen when the user actually
        // dismisses it. This way a page reload before interaction will show it again.
        setShowWelcome(true);
      } else if (!hasSeenRewards) {
        setShowRewards(true);
      }
    };

    run();
  }, []);

  /* ================= RESET HEADER ================= */
  useEffect(() => {
    setShowTopRow(true);
    lastScrollY.current = 0;
  }, [location.pathname]);

  /* ================= SCROLL (FIXED) ================= */
useEffect(() => {
  const el = document.getElementById("workspace-scroll");
  if (!el) return;

  let ticking = false;

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const currentY = el.scrollTop;

        if (window.innerWidth >= 1024) {
          setShowTopRow(!(currentY > lastScrollY.current && currentY > 60));
        } else {
          setShowTopRow(true);
        }

        lastScrollY.current = currentY;
        ticking = false;
      });

      ticking = true;
    }
  };

  el.addEventListener("scroll", onScroll, { passive: true });

  return () => el.removeEventListener("scroll", onScroll);
}, []);

  /* ================= TITLE ================= */
  const titleMap = {
    "/workspace": "Home",
    "/workspace/productphoto": "Product Photos",
    "/workspace/myproduct": "Product",
    "/workspace/library": "Bg Library",
    "/workspace/creations": "Creations",
    "/workspace/pricing": "Pricing",
    "/workspace/image-generator": "Image Generator",
    "/workspace/video-generator": "Video Generator",
    "/workspace/viral-script": "Video Generator",
    "/workspace/skeleton-shorts": "Skeleton Shorts",
    "/workspace/ai-fruit-story": "AI Fruit Story",
    "/workspace/face-asmr": "Face ASMR",
    "/workspace/micro-camera-animal": "Micro Camera",
    "/workspace/clay-rescue": "Clay Rescue",
    "/workspace/publish":     "Publish",
  };

  const title = titleMap[location.pathname] || "Workspace";

  return (
    <div className="flex w-full h-[100dvh] bg-[#090A0A] overflow-x-hidden overflow-y-hidden">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:block h-full w-[80px] flex-shrink-0 z-50">
        <ToolShell />
      </aside>

      {/* MOBILE SIDEBAR */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />

          <aside className="fixed top-0 left-0 z-50 h-full w-[80px] bg-[#090A0A] lg:hidden">
            <ToolShell onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* MAIN */}
      <div className="flex flex-col flex-1 h-[100dvh] overflow-x-hidden">

        {/* HEADER — always sticky */}
        <div className="relative z-[60] w-full shrink-0">
          {!outageDismissed && <VideoOutageBanner onDismiss={() => setOutageDismissed(true)} />}

          {isHomeRoute && bannerVisible && (
            <TopPromoBanner onClose={() => setBannerVisible(false)} />
          )}

          <TopRow
            onMenuClick={() => setSidebarOpen(prev => !prev)}
            title={title}
          />
        </div>

        {/* 🔥 SCROLL AREA (ONLY THIS SCROLLS) */}
        <div
          id="workspace-scroll"
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          <Outlet />
        </div>

        {/* WELCOME SCREEN — only dismissed by user action, never by page reload */}
        {showWelcome && (
          <WelcomeScreen onClose={async () => {
            const { data } = await supabase.auth.getUser();
            const uid = data?.user?.id;
            if (uid) localStorage.setItem(`zyvo_workspace_welcome:${uid}`, "1");
            setShowWelcome(false);

            // Chain the creator rewards popup right after — second popup for new users
            if (uid && !localStorage.getItem(`zyvo_creator_rewards_seen:${uid}`)) {
              setShowRewards(true);
            }
          }} />
        )}

        {/* CREATOR REWARDS POPUP — shown once per user, ever */}
        {showRewards && (
          <CreatorRewardsModal onClose={() => {
            if (rewardsUserId) localStorage.setItem(`zyvo_creator_rewards_seen:${rewardsUserId}`, "1");
            setShowRewards(false);
          }} />
        )}

        {/* MOBILE NAV */}
        <MobileBottomNav hidden={isSelectorOpen} />
      </div>

   
    </div>
  );
}
