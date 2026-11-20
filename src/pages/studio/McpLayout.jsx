import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutTemplate, Loader2, MonitorPlay, Plug } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { MockBanner } from "../../components/studio-kit/StudioKitUI";
import { DISPLAY, FOCUS, MCP_CARD, MCP_SECONDARY, useDisplayFont, useStudioOpen } from "../../components/studio-kit/studioKitShared";
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
      <div className="mx-auto w-full max-w-[960px] px-4 pt-5 sm:px-6 sm:pt-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-baseline gap-2.5">
            <h1 style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">MCP</h1>
            <p className="text-[11.5px] font-black uppercase tracking-[0.14em] text-lime-300">Claude × Roblox Studio</p>
          </div>
          {open === "open" && (
            <nav aria-label="MCP" className="grid grid-cols-3 rounded-xl border border-white/10 bg-white/[0.04] p-1 md:min-w-[380px]" data-testid="mcp-tabs">
              {MCP_TABS.map(({ id, label, path, icon: Icon }) => (
                <NavLink key={id} to={path} data-testid={`mcp-tab-${id}`}
                  className={({ isActive }) => `flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[13.5px] font-bold transition ${isActive ? "bg-lime-300 font-black text-[#11150D]" : "text-white/70 hover:bg-white/[0.06] hover:text-white"} ${FOCUS}`}>
                  <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden="true" /><span className="whitespace-nowrap">{label}</span>
                </NavLink>
              ))}
            </nav>
          )}
        </header>

        {open === "loading" ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-label="Loading" /></div>
        ) : open === "closed" ? (
          <div className={`${MCP_CARD} mt-6 max-w-[520px] p-5`}>
            <p className="text-[15px] font-bold text-white">Coming soon</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">Zyvo's MCP tools for Claude are being tested before launch.{user ? " They aren't open for this account yet." : " Signed up already? Sign in to check."}</p>
            {!user && <button type="button" className={`${MCP_SECONDARY} mt-3`} onClick={() => setSignIn(true)}>Sign in</button>}
          </div>
        ) : (
          <Outlet />
        )}
      </div>
      {signIn && <AuthModal mode="login" title="Sign in to Zyvo" subtitle="Zyvo's MCP tools for Claude." returnTo={typeof window !== "undefined" ? window.location.pathname : MCP_CONNECT_PATH} onClose={() => setSignIn(false)} />}
    </div>
  );
}
