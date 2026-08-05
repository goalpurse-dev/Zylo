import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import TopPromoBanner from "../../components/workspace/TopPromoBanner";
import MobileBottomNav from "../../components/workspace/MobileBottomNav";
import WelcomeScreen from "../../components/WelcomeScreen";
import CreatorRewardsModal from "../../components/CreatorRewardsModal";
import WorkspaceRouteSeo from "../../components/seo/WorkspaceRouteSeo.jsx";

// ── Promo banner ──────────────────────────────────────────────
export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const noticeRef = useRef(null);

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
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

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
    "/workspace/creations": "Creations",
    "/workspace/creations/viral-videos": "Viral Videos",
    "/workspace/pricing": "Pricing",
    "/workspace/image-generator": "Image Generator",
    "/workspace/video-generator": "Video Generator",
    "/workspace/viral-script": "Video Generator",
    "/workspace/skeleton-shorts": "Skeleton Shorts",
    "/workspace/ai-fruit-story": "AI Fruit Story",
    "/workspace/face-asmr": "Face ASMR",
    "/workspace/micro-camera-animal": "Micro Camera",
    "/workspace/clay-rescue":        "Clay Rescue",
    "/workspace/ai-cooking-matic":   "AI Cooking Matic",
    "/workspace/two-am":             "2AM In...",
    "/workspace/cartoon-drive-by":   "Cartoon Drive By",
    "/workspace/publishv":           "Publish",
    "/workspace/stats":              "Stats",
    "/workspace/connections":        "Connections",
  };

  const title = titleMap[location.pathname] || "Workspace";

  useEffect(() => {
    const notice = noticeRef.current;
    if (!notice) return;

    const syncNoticeHeight = () => {
      document.documentElement.style.setProperty("--zyvo-notice-height", `${notice.getBoundingClientRect().height}px`);
    };

    syncNoticeHeight();
    const observer = new ResizeObserver(syncNoticeHeight);
    observer.observe(notice);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--zyvo-notice-height");
    };
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#090A0A]">
      <WorkspaceRouteSeo />
      <div ref={noticeRef} className="relative z-[70] w-full shrink-0">
        <TopPromoBanner />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden h-full w-[220px] flex-shrink-0 lg:block z-50">
        <ToolShell />
      </aside>

      {/* MOBILE SIDEBAR */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />

          <aside className="fixed bottom-0 left-0 z-50 w-[220px] max-w-[88vw] lg:hidden" style={{ top: "var(--zyvo-notice-height, 0px)" }}>
            <ToolShell onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* MAIN */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">

        {/* HEADER — always sticky */}
        <div className="relative z-[60] w-full shrink-0">
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

   
    </div>
  );
}
