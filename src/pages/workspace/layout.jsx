import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import ToolsPanel from "../../components/workspace/ToolsPanel.jsx";

export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const location = useLocation();

  const scrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);

 const TOOL_ROUTES = [
  "/workspace/productphoto",
  "/workspace/myproduct",
  "/workspace/library",
  "/workspace/image-generator",
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
  };

  const title = titleMap[location.pathname] || "Workspace";

  return (
    <div className="flex w-full min-h-screen bg-[#12141A]">

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
        className="flex flex-col flex-1 h-screen overflow-y-auto"
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

        <Outlet />
      </div>
    </div>
  );
}
