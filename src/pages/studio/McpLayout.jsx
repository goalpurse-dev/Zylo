import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutTemplate, Loader2, MonitorPlay, Plug } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { MockBanner } from "../../components/studio-kit/StudioKitUI";
import { CARD, DISPLAY, FOCUS, SECONDARY, useDisplayFont, useStudioOpen } from "../../components/studio-kit/studioKitShared";
import { MCP_CONNECT_PATH, MCP_STUDIO_PATH, MCP_TEMPLATES_PATH } from "../../data/studioKit";
import "../../components/studio-kit/studioKit.css";

export const MCP_TABS = [
  { id: "connect", label: "Connect", path: MCP_CONNECT_PATH, icon: Plug },
  { id: "templates", label: "Templates", path: MCP_TEMPLATES_PATH, icon: LayoutTemplate },
  { id: "studio", label: "MCP Studio", path: MCP_STUDIO_PATH, icon: MonitorPlay },
];

/**
 * /workspace/mcp/*: the MCP section (owner 2026-11-20). One header and three tabs: Connect (connect Zyvo to Claude),
 * Templates (the kits, each with its own tutorial page) and MCP Studio (the projects made with them). Owner-only like
 * the rest of the Studio kit until STUDIO_KIT_PUBLIC (data/studioKit.js); the server decides who is open.
 */
export default function McpLayout() {
  useDisplayFont();
  const open = useStudioOpen();
  const { user } = useAuth() ?? {};
  const [signIn, setSignIn] = useState(false);

  return (
    <div className="min-h-full w-full bg-[#0B0D0F] pb-16">
      <MockBanner />
      <div className="mx-auto w-full max-w-[1040px] px-4 pt-6 sm:px-6 sm:pt-10">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.16em] text-lime-300">Claude × Roblox Studio</p>
            <h1 style={DISPLAY} className="mt-1 text-[48px] font-extrabold uppercase leading-[0.9] text-white sm:text-[64px]">MCP</h1>
          </div>
          {open === "open" && (
            <nav aria-label="MCP" className="grid grid-cols-3 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 md:min-w-[470px]" data-testid="mcp-tabs">
              {MCP_TABS.map(({ id, label, path, icon: Icon }) => (
                <NavLink key={id} to={path} data-testid={`mcp-tab-${id}`}
                  className={({ isActive }) => `flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-[14.5px] font-black transition sm:text-[15.5px] ${isActive ? "bg-lime-300 text-[#11150D]" : "text-white/70 hover:bg-white/[0.06] hover:text-white"} ${FOCUS}`}>
                  <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" /><span className="whitespace-nowrap">{label}</span>
                </NavLink>
              ))}
            </nav>
          )}
        </header>

        {open === "loading" ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-label="Loading" /></div>
        ) : open === "closed" ? (
          <div className={`${CARD} mt-8 max-w-[560px] p-6`}>
            <p className="text-[18px] font-black text-white">Coming soon</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">Zyvo's MCP tools for Claude are being tested before launch.{user ? " They aren't open for this account yet." : " Signed up already? Sign in to check."}</p>
            {!user && <button type="button" className={`${SECONDARY} mt-4`} onClick={() => setSignIn(true)}>Sign in</button>}
          </div>
        ) : (
          <Outlet />
        )}
      </div>
      {signIn && <AuthModal mode="login" title="Sign in to Zyvo" subtitle="Zyvo's MCP tools for Claude." returnTo={typeof window !== "undefined" ? window.location.pathname : MCP_CONNECT_PATH} onClose={() => setSignIn(false)} />}
    </div>
  );
}
