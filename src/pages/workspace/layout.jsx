import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import ToolsPanel from "../../components/workspace/ToolsPanel.jsx";

export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);

  const scrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);

 const TOOL_ROUTES = [
  "/workspace/productphoto",
  "/workspace/myproduct",
  "/workspace/library",
  "/workspace/image-generator",
  "/workspace/video-generator",
  "/workspace/viral-script",
  "/workspace/home"

  
];
const isCreationsRoute = location.pathname.startsWith("/workspace/creations");


  const isToolRoute = TOOL_ROUTES.some(route =>
    location.pathname.startsWith(route)
  );

  const closeMobilePanels = () => {
  if (window.innerWidth < 1024) {
    setSidebarOpen(false);
    setActivePanel(null);
  }
};

useEffect(() => {
  const run = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    // 🔹 Get plan
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

  // 🔹 Auto-open tools on tool routes
useEffect(() => {
  if (isToolRoute && !isCreationsRoute) {
    setActivePanel("tools");
  } else {
    setActivePanel(null);
  }
}, [isToolRoute, isCreationsRoute]);


  // 🔹 HARD OVERRIDE: Creations always closes tools
  useEffect(() => {
    if (location.pathname.startsWith("/workspace/creations")) {
      setActivePanel(null);
    }
  }, [location.pathname]);

  /* Reset top row on route change */
  useEffect(() => {
    setShowTopRow(true);
    lastScrollY.current = 0;
  }, [location.pathname]);

  /* Hide / show top row on scroll (desktop only) */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const currentY = el.scrollTop;
      if (window.innerWidth >= 1024) {
        setShowTopRow(!(currentY > lastScrollY.current && currentY > 60));
      }
      lastScrollY.current = currentY;
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
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
    <div className="flex w-full min-h-[100svh] bg-[#12141A]">


      {/* DESKTOP TOOL SHELL */}
      <aside className="hidden lg:block h-screen w-[80px] flex-shrink-0 z-50">
        <ToolShell
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          isCreationsRoute={location.pathname.startsWith("/workspace/creations")}
        />
      </aside>

      {/* DESKTOP TOOLS PANEL */}
      {activePanel === "tools" && (
        <aside className="hidden lg:block h-screen w-[220px] flex-shrink-0 bg-[#12141A] border-r border-white/10">
         <ToolsPanel onNavigate={closeMobilePanels} />

        </aside>
      )}

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => {
              setSidebarOpen(false);
              setActivePanel(null);
            }}
          />

          <aside className="fixed top-0 left-0 z-50 h-screen w-[80px] bg-[#12141A] lg:hidden">
            <ToolShell
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              isCreationsRoute={location.pathname.startsWith("/workspace/creations")}
              onClose={() => {
                setSidebarOpen(false);
                setActivePanel(null);
              }}
            />
          </aside>

          {activePanel === "tools" && (
            <aside
              className="
                fixed top-[64px] left-[80px]
                z-50 h-[calc(100vh-64px)]
                w-[220px] bg-[#12141A]
                animate-[panelIn_0.25s_ease-out]
                lg:hidden rounded-tr-lg
              "
            >
              <ToolsPanel onNavigate={closeMobilePanels} />

            </aside>
          )}
        </>
      )}

      {/* MAIN CONTENT */}
     <div
  ref={scrollRef}
  id="workspace-scroll"
  className="relative z-10 flex flex-col flex-1 h-[100svh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
>
        <div
          className={`
            sticky top-0 z-50
            transition-transform duration-300
            ${showTopRow ? "translate-y-0" : "-translate-y-full"}
            lg:translate-y-0
          `}
        >
          <TopRow
            onMenuClick={() => {
              setSidebarOpen(prev => {
                const next = !prev;

                if (window.innerWidth < 1024) {
                  if (next && isToolRoute) {
                    setActivePanel("tools");
                  }

                  if (next && !isToolRoute) {
                    setActivePanel(null);
                  }
                }

                return next;
              });
            }}
            title={title}
          />
        </div>

 {showWelcome && (
  <div className="fixed bottom-6 right-6 z-[9999] animate-[slideUp_0.35s_ease-out]">
    <div
      className="
        relative
        flex items-start gap-4
        max-w-sm
        rounded-2xl
        border border-[#7A3BFF]/30
        bg-[#0B0E1A]/80
        backdrop-blur-xl
        shadow-[0_0_40px_rgba(122,59,255,0.25)]
        px-5 py-4
      "
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <img
          src="/assets/ai/robot.webp"
          alt="Zyvo AI"
          className="w-10 h-10 rounded-full border border-white/10"
        />

        {/* Subtle pulse glow */}
        <div className="absolute inset-0 rounded-full bg-[#7A3BFF]/30 blur-md opacity-60 animate-pulse" />
      </div>

      {/* Text */}
      <div className="flex-1">
        <div className="text-white font-semibold text-sm">
          Zyvo AI
        </div>

        <div className="text-white/70 text-sm mt-1 leading-relaxed">
          You’ve got 3 free image creations this week. Let’s build something.
        </div>
      </div>

      {/* Close */}
      <button
        onClick={() => setShowWelcome(false)}
        className="absolute top-3 right-3 text-white/40 hover:text-white transition text-sm"
      >
        ✕
      </button>
    </div>

    <style>{`
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  </div>
)}

        <Outlet />
      </div>
    </div>
  );
}
