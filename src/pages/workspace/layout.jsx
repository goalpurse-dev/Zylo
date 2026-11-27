import { lazy as studioLazy, Suspense as StudioSuspense } from "react";
import { useStudioV2 } from "../../lib/studioV2.js";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import MobileBottomNav from "../../components/workspace/MobileBottomNav";
import WelcomeScreen from "../../components/WelcomeScreen";
import WorkspaceRouteSeo from "../../components/seo/WorkspaceRouteSeo.jsx";
import { WhatsNewModal } from "../../components/launch/LaunchUI.jsx";
import AnnouncementBar from "../../components/launch/AnnouncementBar.jsx";
import { OfferBar } from "../../components/offer/OfferBanners.jsx";
import { useOffer } from "../../lib/useOffer";
import PastDueNotice from "../../components/billing/PastDueNotice.jsx";
import { trackLaunch } from "../../components/launch/launch";
import { COOKIE_CONSENT_EVENT, hasCookieConsent } from "../../lib/cookieConsent";
import { BLOCKY_STORIES_NAME, BLOCKY_STORIES_PATH } from "../../data/blockyStories";
import { useAuth } from "../../context/AuthContext";
import { fetchOnboardingStatus } from "../../lib/onboarding";

import useBlockyWorldsAccess from "../../components/viral-tools/blocky-worlds/api/blockyWorldsAccess";

const TOWN_ANNOUNCEMENT = "in_this_town_launch";

// ── Promo banner ──────────────────────────────────────────────
function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const noticeRef = useRef(null);

  const location = useLocation();
  const { user: authUser, loading: authLoading } = useAuth();
  const userId = authUser?.id;
  const visitor = userId || "guest";
  const preferenceKey = `zyvo:whats-new:${TOWN_ANNOUNCEMENT}:${visitor}`;
  const townAccess = useBlockyWorldsAccess();
  const offer = useOffer();
  // Phase 6d-1: the mobile Edit page is a full-screen editor — no promo banner there.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 767px)"); const on = () => setNarrow(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  const hidePromo = narrow && /\/long-form\/project\/[^/]+\/(edit|publish)\/?$/.test(location.pathname);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  // Track eligibility per visitor so an account switch cannot reuse the previous preference.
  const [whatsNew, setWhatsNew] = useState(null);

  // Clean up trailing # left by Supabase OAuth token exchange
  useEffect(() => {
    if (window.location.hash === "#") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  /* ================= WELCOME / WHAT'S NEW ================= */
  useEffect(() => {
    let live = true;
    setWhatsNew(null);
    setShowWhatsNew(false);
    setShowWelcome(false);
    if (authLoading) return;
    async function loadPreferences() {
      let optedOut = false;
      try { optedOut = localStorage.getItem(preferenceKey) === "1"; } catch { /* storage unavailable */ }
      if (userId) {
        const [{ data: profile }, { enrolled }] = await Promise.all([
          supabase.from("profiles").select("plan_code, seen_announcements").eq("id", userId).single(),
          fetchOnboardingStatus(userId),
        ]);
        if (!live) return;
        const welcomeKey = `zyvo_workspace_welcome:${userId}`;
        if (!enrolled && (profile?.plan_code || "free").toLowerCase() === "free" && !localStorage.getItem(welcomeKey)) setShowWelcome(true);
        if (profile?.seen_announcements?.includes(TOWN_ANNOUNCEMENT)) optedOut = true;
        else if (optedOut) supabase.rpc("mark_announcement_seen", { p_key: TOWN_ANNOUNCEMENT }).then(() => {}, () => {});
      }
      if (live && !optedOut) setWhatsNew(visitor);
    }
    loadPreferences();
    return () => { live = false; };
  }, [authLoading, userId, visitor, preferenceKey]);

  // Setting up a video or watching its free preview (a new account lands here
  // straight after the sign-up): the Welcome screen waits for the next page.
  const makingVideo = location.pathname === "/long-form/create" || location.pathname.startsWith("/long-form/teaser/");

  // The cookie banner comes first: "What's new" waits until it has been answered.
  const [cookieAnswered, setCookieAnswered] = useState(() => hasCookieConsent());
  useEffect(() => {
    const on = () => setCookieAnswered(true);
    window.addEventListener(COOKIE_CONSENT_EVENT, on);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, on);
  }, []);

  // A normal dismissal lasts for this visit to Home. Returning or reloading opens it again.
  useEffect(() => {
    setShowWhatsNew(false);
    if (whatsNew !== visitor || location.pathname !== "/" || townAccess !== "allowed" || !cookieAnswered || showWelcome) return;
    let timer;
    const show = () => {
      if (document.querySelector("[data-zyvo-modal], [role='dialog']")) {
        timer = setTimeout(show, 600);
        return;
      }
      setShowWhatsNew(true);
      trackLaunch("whats_new_shown", { placement: TOWN_ANNOUNCEMENT, guest: !userId });
    };
    timer = setTimeout(show, 600);
    return () => clearTimeout(timer);
  }, [whatsNew, visitor, userId, location.pathname, townAccess, cookieAnswered, showWelcome]);

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
    "/": "Home",
    "/workspace/creations": "Creations",
    "/workspace/creations/viral-videos": "Viral Videos",
    "/pricing": "Pricing",
    "/workspace/image-generator": "Image Generator",
    "/workspace/video-generator": "Video Generator",
    "/workspace/viral-script": "Video Generator",
    "/workspace/skeleton-shorts": "Skeleton Shorts",
    "/workspace/ai-fruit-story": "AI Fruit Story",
    [BLOCKY_STORIES_PATH]: BLOCKY_STORIES_NAME,
    "/workspace/face-asmr": "Face ASMR",
    "/workspace/micro-camera-animal": "Micro Camera",
    "/workspace/clay-rescue":        "Clay Rescue",
    "/workspace/ai-cooking-matic":   "AI Cooking Matic",
    "/workspace/two-am":             "2AM In...",
    "/workspace/thirty-days":        "30 Days",
    "/workspace/cartoon-drive-by":   "Cartoon Drive By",
    "/workspace/behind-the-scenes":  "Behind the Scenes",
    "/workspace/publishv":           "Publish",
    "/workspace/stats":              "Stats",
    "/workspace/connections":        "Connections",
    "/workspace/earn":               "Earn",
    "/workspace/earn/submissions":   "Earn",
    "/workspace/earn/referrals":     "Earn",
    "/workspace/earn/payouts":       "Earn",
    "/workspace/earn/leaderboard":   "Earn",
    "/workspace/earn/rules":         "Earn",
    "/workspace/earnings":           "Earnings Calculator",
    "/long-form":                    "Long Form",
    "/long-form/new":                "Long Form",
  };

  const title = titleMap[location.pathname] || (location.pathname.startsWith("/long-form/") ? "Long Form" : "Workspace");

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

  // How much of the real viewport is consumed above #workspace-scroll (promo
  // banner + top row) — pages nested inside that scroll container need this
  // to size anything against 100dvh (e.g. a sticky sidebar's own height), since
  // 100dvh is the whole browser viewport, not this scroll container's box.
  // Resizes with #workspace-scroll itself, which already shrinks/grows in sync
  // with the notice banner above it (same flex column), so one observer covers both.
  useEffect(() => {
    const scrollEl = document.getElementById("workspace-scroll");
    if (!scrollEl) return;

    const syncContentTop = () => {
      document.documentElement.style.setProperty("--zyvo-content-top", `${scrollEl.getBoundingClientRect().top}px`);
    };

    syncContentTop();
    // On some Windows setups (taskbar auto-hide, per-monitor DPI, external
    // displays) the very first layout pass reports a viewport height that
    // still includes space the taskbar visually covers — it only corrects
    // once a real resize event fires. Re-check a couple of times right after
    // mount so pages don't need the user to resize the window to fix it.
    const settleTimers = [50, 300, 1000].map((ms) => setTimeout(syncContentTop, ms));
    window.addEventListener("resize", syncContentTop);
    window.visualViewport?.addEventListener("resize", syncContentTop);
    const observer = new ResizeObserver(syncContentTop);
    observer.observe(scrollEl);
    return () => {
      settleTimers.forEach(clearTimeout);
      window.removeEventListener("resize", syncContentTop);
      window.visualViewport?.removeEventListener("resize", syncContentTop);
      observer.disconnect();
      document.documentElement.style.removeProperty("--zyvo-content-top");
    };
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#090A0A]">
      <WorkspaceRouteSeo />
      <div ref={noticeRef} className="relative z-[70] w-full shrink-0">
        {/* Home: the +50 bonus offer's news bar replaces the usual announcement while it runs. */}
        {!hidePromo && (location.pathname === "/" && offer.live ? <OfferBar /> : <AnnouncementBar />)}
        <PastDueNotice />
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
        {showWelcome && !makingVideo && (
          <WelcomeScreen onClose={async () => {
            const { data } = await supabase.auth.getUser();
            const uid = data?.user?.id;
            if (uid) localStorage.setItem(`zyvo_workspace_welcome:${uid}`, "1");
            setShowWelcome(false);
          }} />
        )}

        {showWhatsNew && whatsNew === visitor && location.pathname === "/" && <WhatsNewModal
          onPreferenceChange={checked => {
            try {
              if (checked) localStorage.setItem(preferenceKey, "1");
              else localStorage.removeItem(preferenceKey);
            } catch { /* profile storage still works for signed-in users */ }
          }}
          onClose={dontShowAgain => {
            setShowWhatsNew(false);
            if (dontShowAgain) {
              setWhatsNew(null);
              if (userId) supabase.rpc("mark_announcement_seen", { p_key: TOWN_ANNOUNCEMENT }).then(() => {}, () => {});
            }
          }}
        />}

        {/* MOBILE NAV */}
        <MobileBottomNav hidden={isSelectorOpen} />
      </div>
      </div>

   
    </div>
  );
}

// Studio v2, OWNER-ONLY (owner 2026-11-27): the owner's account (asked on the server, src/lib/studioV2.js) gets the
// new version; everyone else, signed out or in, gets the function above exactly as before.
const LayoutStudio = studioLazy(() => import("./layoutStudio.jsx"));
export default function WorkspaceLayoutSwitch(props) {
  const { on } = useStudioV2();
  if (on) return <StudioSuspense fallback={null}><LayoutStudio {...props} /></StudioSuspense>;
  return <WorkspaceLayout {...props} />;
}
