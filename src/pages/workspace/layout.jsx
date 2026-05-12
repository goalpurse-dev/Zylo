import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import TopPromoBanner from "../../components/workspace/TopPromoBanner";
import MobileBottomNav from "../../components/workspace/MobileBottomNav";
import WelcomeScreen from "../../components/WelcomeScreen";


export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);

  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);
  const isHomeRoute = location.pathname === "/workspace/home";
  const [bannerVisible, setBannerVisible] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  /* ================= PROMO ================= */
  useEffect(() => {
    if (!isHomeRoute) return;
    const dismissed = localStorage.getItem("promo_closed");
    setBannerVisible(!dismissed);
  }, [isHomeRoute]);

  /* ================= WELCOME ================= */
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_code")
        .eq("id", user.id)
        .single();

      if ((profile?.plan_code || "free").toLowerCase() !== "free") return;

      const key = `zyvo_workspace_welcome:${user.id}`;
      if (localStorage.getItem(key)) return;

      // Don't set the key yet — only mark as seen when the user actually dismisses it.
      // This way a page reload before interaction will show it again.
      setShowWelcome(true);
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
  };

  const title = titleMap[location.pathname] || "Workspace";

  return (
    <div className="flex w-full h-[100dvh] bg-[#090A0A] overflow-hidden">

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
      <div className="flex flex-col flex-1 h-[100dvh] overflow-hidden">

        {/* HEADER */}
        <div
          className={`
            relative z-[60]
            w-full shrink-0
            lg:transition-transform lg:duration-300
            ${showTopRow ? "lg:translate-y-0" : "lg:-translate-y-full"}
          `}
        >
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
          }} />
        )}

        {/* MOBILE NAV */}
        <MobileBottomNav hidden={isSelectorOpen} />
      </div>

   
    </div>
  );
}
