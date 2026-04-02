import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import TopPromoBanner from "../../components/workspace/TopPromoBanner";
import MobileBottomNav from "../../components/workspace/MobileBottomNav";

export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);

  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);
  const isHomeRoute = location.pathname === "/workspace/home";
  const [bannerVisible, setBannerVisible] = useState(false);
const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  useEffect(() => {
    if (!isHomeRoute) return;
    const dismissed = localStorage.getItem("promo_closed");
    setBannerVisible(!dismissed);
  }, [isHomeRoute]);

  const TOOL_ROUTES = [
    "/workspace/productphoto",
    "/workspace/myproduct",
    "/workspace/library",
    "/workspace/image-generator",
    "/workspace/video-generator",
    "/workspace/viral-script",
    "/workspace/home",
  ];

  const isCreationsRoute = location.pathname.startsWith("/workspace/creations");

  const isToolRoute = TOOL_ROUTES.some(route =>
    location.pathname.startsWith(route)
  );

  const closeMobilePanels = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

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

      setShowWelcome(true);
      localStorage.setItem(key, "1");

      setTimeout(() => {
        setShowWelcome(false);
      }, 25000);
    };

    run();
  }, []);

  /* Reset top row on route change */
  useEffect(() => {
    setShowTopRow(true);
    lastScrollY.current = 0;
  }, [location.pathname]);

  /* ✅ FIXED SCROLL HANDLER (WINDOW SCROLL) */
  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;

      if (window.innerWidth >= 1024) {
        setShowTopRow(!(currentY > lastScrollY.current && currentY > 60));
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <div className="flex w-full min-h-screen bg-[#090A0A]">

      {/* DESKTOP TOOL SHELL */}
      <aside className="hidden lg:block h-screen w-[80px] flex-shrink-0 z-50">
        <ToolShell
          isCreationsRoute={location.pathname.startsWith("/workspace/creations")}
        />
      </aside>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => {
              setSidebarOpen(false);
            }}
          />

          <aside className="fixed top-0 left-0 z-50 h-screen w-[80px] bg-[#090A0A] lg:hidden">
            <ToolShell
              isCreationsRoute={location.pathname.startsWith("/workspace/creations")}
              onClose={() => {
                setSidebarOpen(false);
              }}
            />
          </aside>
        </>
      )}

      {/* MAIN CONTENT */}
      <div
        id="workspace-scroll"
       className="flex flex-col flex-1 h-screen overflow-y-auto pb-[90px]"
      >
        {/* ✅ FIXED HEADER (NO WRAPPER BUG) */}
      <div
  className={`
    sticky top-0 z-[60]
    w-full
    will-change-transform
    transition-transform duration-300
    ${showTopRow ? "translate-y-0" : "-translate-y-full"}
    lg:translate-y-0
  `}
  style={{
    position: "sticky",
    top: 0
  }}
>
          {/* PROMO */}
          {isHomeRoute && bannerVisible && (
            <div className="w-full animate-[slideDown_0.3s_ease-out]">
              <TopPromoBanner onClose={() => setBannerVisible(false)} />
            </div>
          )}

          <TopRow
            onMenuClick={() => {
              setSidebarOpen(prev => !prev);
            }}
            title={title}
          />
        </div>

        {/* WELCOME */}
        {showWelcome && (
          <div className="fixed bottom-6 right-6 z-[9999] animate-[slideUp_0.35s_ease-out]">
            <div className="relative flex items-start gap-4 max-w-sm rounded-2xl border border-[#7A3BFF]/30 bg-[#0B0E1A]/80 backdrop-blur-xl shadow-[0_0_40px_rgba(122,59,255,0.25)] px-5 py-4">

              <div className="relative shrink-0">
                <img
                  src="/assets/ai/robot.webp"
                  alt="Zyvo AI"
                  className="w-10 h-10 rounded-full border border-white/10"
                />
                <div className="absolute inset-0 rounded-full bg-[#7A3BFF]/30 blur-md opacity-60 animate-pulse" />
              </div>

              <div className="flex-1">
                <div className="text-white font-semibold text-sm">
                  Zyvo AI
                </div>

                <div className="text-white/70 text-sm mt-1 leading-relaxed">
                  You’ve got 3 free image creations this week. Let’s build something.
                </div>
              </div>

              <button
                onClick={() => setShowWelcome(false)}
                className="absolute top-3 right-3 text-white/40 hover:text-white transition text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        )}

       <MobileBottomNav isSelectorOpen={isSelectorOpen} />
        <Outlet />
      </div>
    </div>
  );
}