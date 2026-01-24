import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";
import ToolsPanel from "../../components/workspace/ToolsPanel.jsx";

export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const [activePanel, setActivePanel] = useState(null);

  const scrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);

  useEffect(() => {
    setShowTopRow(true);
    lastScrollY.current = 0;
  }, [location.pathname]);

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
    "/image-generator": "Image Generator",

  };

  const title = titleMap[location.pathname] || "Workspace";

  return (
    <div className="flex w-full min-h-screen bg-[#F7F5FA]">

      {/* LEFT ICON BAR */}
      <aside className="hidden lg:block h-screen w-[90px] flex-shrink-0 z-50">
        <ToolShell
          activePanel={activePanel}
          setActivePanel={setActivePanel}
        />
      </aside>

      {/* MOBILE TOOL SHELL OVERLAY */}
{sidebarOpen && (
  <aside className="
    fixed inset-0 z-50
    bg-black/20 backdrop-blur-sm
    lg:hidden
  ">
    <ToolShell
      activePanel={activePanel}
      setActivePanel={setActivePanel}
      onClose={() => setSidebarOpen(false)}
    />
  </aside>
)}

      {/* 🧰 TOOLS PANEL (PUSHES CONTENT) */}
      {activePanel === "tools" && (
       <aside
  className={`
    hidden lg:block
    h-screen
    flex-shrink-0
    w-[220px]
    overflow-hidden
    transition-all duration-300 ease-out
    ${activePanel === "tools"
      ? "opacity-100 translate-x-0"
      : "opacity-0 -translate-x-6 pointer-events-none"}
  `}
>
  <ToolsPanel />
</aside>

      )}

      {/* MAIN CONTENT */}
      <div
        ref={scrollRef}
        className="flex flex-col flex-1 h-screen overflow-y-auto"
      >
        <div
          className={`
            sticky top-0 lg:static z-30
            transition-transform duration-300
            ${showTopRow ? "translate-y-0" : "-translate-y-full"}
            lg:translate-y-0
          `}
        >
          <TopRow
            onMenuClick={() => setSidebarOpen(true)}
            title={title}
          />
        </div>

        <Outlet />
      </div>

    </div>
  );
}
