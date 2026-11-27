// The workspace pages' title, description and links (WorkspaceRouteSeo), loaded on its own: it brings the whole SEO
// data set (~200 KB) with it. A first visit to Home already has its head in the server HTML, so there it waits until
// the visitor moves to another page; everywhere else it loads at once.
import { Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { preloadableLazy } from "../../lib/preloadableLazy.js";

export const WorkspaceRouteSeoImpl = preloadableLazy(() => import("./WorkspaceRouteSeo.jsx"));

export default function LazyWorkspaceRouteSeo() {
  const { pathname } = useLocation();
  const [go, setGo] = useState(pathname !== "/");
  useEffect(() => { if (pathname !== "/") setGo(true); }, [pathname]);
  return go ? <Suspense fallback={null}><WorkspaceRouteSeoImpl /></Suspense> : null;
}
