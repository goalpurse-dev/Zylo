import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // 1️⃣ Try workspace scroll container
    const workspaceScroller = document.getElementById("workspace-scroll");

    if (workspaceScroller) {
      workspaceScroller.scrollTop = 0;
      return;
    }

    // 2️⃣ Fallback to window scroll (blogs, landing pages, etc.)
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}
