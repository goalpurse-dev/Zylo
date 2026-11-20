// Shared constants and hooks of the Studio Kit pages (kept out of the .jsx component file for fast refresh).
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, studioOpenFor } from "../../lib/zyvoConnector";
import { STUDIO_KIT_PUBLIC } from "../../data/studioKit";
import { STICKMAN_FONT_HREF } from "../../data/stickmanLandingPages.js";

export const DISPLAY = { fontFamily: "'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif", fontStretch: "condensed" };
export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D0F]";
export const PRIMARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-[15px] font-black text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const SECONDARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.05] px-4 py-2.5 text-[14px] font-bold text-white transition hover:border-white/35 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const CARD = "rounded-2xl border border-white/10 bg-white/[0.03]";

/** "loading" | "open" | "closed": may this visitor see the Studio Kit bits? (public flag, or the server says yes) */
export function useStudioOpen() {
  const { user, loading } = useAuth() ?? {};
  const [state, setState] = useState(STUDIO_KIT_PUBLIC || CONNECTOR_MOCK ? "open" : "loading");
  useEffect(() => {
    if (STUDIO_KIT_PUBLIC || CONNECTOR_MOCK) return undefined;
    if (loading) return undefined;
    let on = true;
    studioOpenFor(user?.id ?? "guest").then((open) => { if (on) setState(open ? "open" : "closed"); });
    return () => { on = false; };
  }, [user?.id, loading]);
  return state;
}

/** The Barlow Condensed headings (the landing pages load the same stylesheet). */
export function useDisplayFont() {
  useEffect(() => {
    const href = STICKMAN_FONT_HREF;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, []);
}
