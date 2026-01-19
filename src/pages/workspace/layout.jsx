import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import ToolShell from "../../components/workspace/toolshell.jsx";
import TopRow from "../../components/workspace/toprow.jsx";

export default function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const scrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const [showTopRow, setShowTopRow] = useState(true);

  // Scroll hide/show logic (LG+ only)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const currentY = el.scrollTop;

      if (window.innerWidth >= 1024) {
        if (currentY > lastScrollY.current && currentY > 60) {
          setShowTopRow(false); // scrolling down
        } else {
          setShowTopRow(true); // scrolling up
        }
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
  };

  const title = titleMap[location.pathname] || "Workspace";

  return (
    <div className="flex w-full min-h-screen bg-[#F7F5FA]">
      
      {/* Sidebar (sticky, non-scrolling) */}
      <aside className="hidden lg:block sticky top-0 h-screen">
        <ToolShell />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <aside className="fixed inset-0 z-50 lg:hidden">
          <ToolShell onClose={() => setSidebarOpen(false)} />
        </aside>
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex flex-col flex-1 overflow-y-auto h-screen"
      >
        {/* TopRow */}
        <div
          className={`
            sticky top-0 lg:static z-40
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

        {/* Page content */}
        <Outlet />
      </div>
    </div>
  );
}
