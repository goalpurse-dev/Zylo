// THE OWNER'S COPY of the side menu (Studio v2, owner-only 2026-11-27). Customers get toolshell.jsx.
import { useLocation, useNavigate } from "react-router-dom";
import { createElement, useEffect, useState } from "react";
import { ChevronRight, DollarSign, Folder, HandCoins, Home, Plug, Plus, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import { useStudioOpen } from "../studio-kit/useStudioOpen";
import { MCP_PATH } from "../../data/studioKit";
import { AFFILIATE_PATH } from "../../lib/affiliate";
import { REWARDS_PATH } from "../../lib/rewards";
import { LIVE } from "../../../supabase/functions/_shared/liveFeatures.js";
import { Gift } from "lucide-react";
import Logo from "../../assets/logo-mark.webp";
import { optImg } from "../../lib/optImage";
import { ALL_PINNABLE_TOOLS, DesktopCreatePanel, DesktopWorkspacePanel, useShortFormTools } from "./CreateMenu";
import { BLOCKY_STORIES_PATH } from "../../data/blockyStories";
import { CUTAWAY_PATH } from "../../data/cutawayExplainer";
import "../../styles/workspace-shell.css";
import { NewBadge } from "../launch/LaunchUI.jsx";
import { SHOW_EARN_IN_NAV } from "../../data/homeContent";
import { AI_STUDIO_PATH, CREATE_PATH, MAESTRO_PATH, STUDIOS, maestroChatPath, studioPath } from "../../data/styles";
import { useMaestroChats } from "../maestro/useMaestroChats";
import { MAESTRO_AVATAR } from "../maestro/avatar";
import { RecentRows } from "../create/RecentList";

const NAV_IDLE = "text-white/[0.88] hover:text-white hover:bg-white/[0.045] border border-transparent";
const PINNED_TOOLS_KEY = "zyvo:pinned-tools:v1";
const DEFAULT_PINNED_TOOLS = ["ai-cooking-matic"];
const TEMPORARILY_HIDDEN_TOOL_IDS = new Set(["post-schedule", "stats"]);

function getInitialPinnedTools() {
  if (typeof window === "undefined") return DEFAULT_PINNED_TOOLS;
  try {
    const saved = window.localStorage.getItem(PINNED_TOOLS_KEY);
    if (saved === null) return DEFAULT_PINNED_TOOLS;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((id) => !TEMPORARILY_HIDDEN_TOOL_IDS.has(id)).slice(0, 4)
      : DEFAULT_PINNED_TOOLS;
  } catch {
    return DEFAULT_PINNED_TOOLS;
  }
}

// the menu is narrow: long badge words get their short form here (the full words stay in the code and other menus)
const SHORT_EARN = { "Free credits": "Free" };

function NavItem({ icon, iconSrc, label, active, onClick, badge, earn }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full min-w-0 items-center gap-2 rounded-[10px] px-3 py-1.5 text-left transition-all duration-200 active:scale-[0.985] ${active ? "zyvo-nav-active text-white" : NAV_IDLE}`}
    >
      {/* plain icons, no colour tiles (owner 2026-11-26) */}
      <span className="zyvo-nav-icon grid h-5 w-5 shrink-0 place-items-center transition">
        {iconSrc
          ? <img src={iconSrc} alt="" className="h-5 w-5 object-contain" />
          : createElement(icon, { className: "h-[16px] w-[16px]", strokeWidth: 2 })}
      </span>
      <span className="min-w-0 truncate text-[13.5px] font-semibold">{label}</span>
      {badge && <NewBadge className="ml-auto" />}
      {/* the EarnBadge text, as a small pill that always fits the menu */}
      {earn && <span className="ml-auto shrink-0 rounded-full bg-lime-300 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-wide text-[#11150D]" data-earn-label>{typeof earn === "string" ? (SHORT_EARN[earn] ?? earn) : "Earn"}</span>}
    </button>
  );
}

function PinnedToolItem({ tool, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`zyvo-pinned-item group flex w-full items-center gap-2.5 rounded-[11px] px-2 py-1.5 text-left transition ${active ? "is-active" : ""}`}
    >
      <span className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden text-white/50 ${tool.transparentIcon ? "" : "rounded-[8px] border border-white/[0.07] bg-white/[0.035]"}`}>
        {tool.preview ? (
          <img {...optImg(tool.preview, "64px", 96)} alt="" className={`h-full w-full object-contain ${tool.previewPosition ?? "object-top"} ${tool.imageClassName ?? ""}`} />
        ) : (
          tool.icon
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-white/[0.86] transition group-hover:text-white">
        {tool.pinnedLabel ?? tool.label}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-lime-300/70" />
    </button>
  );
}

export default function ToolShell({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(getInitialPinnedTools);
  const shortFormTools = useShortFormTools();
  const mcpOpen = useStudioOpen() === "open"; // owner-only until STUDIO_KIT_PUBLIC (the server decides)

  const isActive = (path) => location.pathname.startsWith(path);
  const anyPanelOpen = createOpen || workspaceOpen;
  const createActive = createOpen || (!anyPanelOpen && (
    location.pathname === CREATE_PATH ||
    isActive(`${CREATE_PATH}/director`) ||
    isActive("/workspace/two-am") ||
    isActive("/workspace/thirty-days") ||
    isActive("/workspace/cartoon-drive-by") ||
    isActive("/workspace/ai-fruit-story") ||
    isActive(BLOCKY_STORIES_PATH) ||
    isActive(CUTAWAY_PATH) ||
    isActive("/workspace/face-asmr") ||
    isActive("/workspace/micro-camera-animal") ||
    isActive("/workspace/clay-rescue") ||
    isActive("/workspace/ai-cooking-matic") ||
    isActive("/workspace/kit-swap") ||
    isActive("/workspace/behind-the-scenes")
  ));

  const closePanels = () => {
    setCreateOpen(false);
    setWorkspaceOpen(false);
  };

  useEffect(() => {
    const openCreate = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      setWorkspaceOpen(false);
      setCreateOpen(true);
    };
    window.addEventListener("zyvo:open-create-menu", openCreate);
    return () => window.removeEventListener("zyvo:open-create-menu", openCreate);
  }, []);

  const go = (path) => {
    closePanels();
    onClose?.();
    navigate(path);
  };

  const togglePin = (toolId) => {
    setPinnedIds((current) => {
      if (!current.includes(toolId) && current.length >= 4) return current;
      const next = current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : [...current, toolId];
      try {
        window.localStorage.setItem(PINNED_TOOLS_KEY, JSON.stringify(next));
      } catch {
        // Keep the current-session UI working if storage is unavailable.
      }
      return next;
    });
  };

  const pinnedTools = pinnedIds
    .map((id) => ALL_PINNABLE_TOOLS.find((tool) => tool.id === id))
    .filter(Boolean)
    // A hidden template (database flag or build switch) stays pinned only while it is on for this viewer.
    .filter((tool) => !(tool.flag || "enabled" in tool) || shortFormTools.some((t) => t.id === tool.id));
  const pinLimitReached = pinnedIds.length >= 4;

  // the new nav (2026-11-26): Create (the studios) + AI Studio (image & video) + your Library (Creations + Recent) + Earn
  const maestroChats = useMaestroChats(4);
  const aiStudioActive = !anyPanelOpen && (isActive(AI_STUDIO_PATH) || isActive("/workspace/image-generator") || isActive("/workspace/video-generator"));

  const maestroActive = !anyPanelOpen && location.pathname.startsWith(MAESTRO_PATH);
  return (
    <>
      <DesktopCreatePanel open={createOpen} onClose={() => setCreateOpen(false)} pinnedIds={pinnedIds} onTogglePin={togglePin} pinLimitReached={pinLimitReached} />
      <DesktopWorkspacePanel open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} pinnedIds={pinnedIds} onTogglePin={togglePin} pinLimitReached={pinLimitReached} />
      <div className="h-full p-3 pr-2">
        <div className="zyvo-compact-shell relative flex h-full flex-col overflow-hidden rounded-[24px] px-3 py-4">
          <div className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="relative mb-4 flex items-center gap-2.5 px-1.5">
            <img src={Logo} alt="Zyvo" className="h-8 w-8 object-contain" />
            <span className="text-[18px] font-black tracking-[-0.035em] text-white">Zyvo</span>
          </div>

          {/* Home at the very top, then MAESTRO (only the current page gets the active style) (owner 2026-11-26): the chat that plans and makes anything + its chats */}
          <div className="mb-2">
            <NavItem
              icon={Home}
              label="Home"
              active={!anyPanelOpen && location.pathname === "/"}
              onClick={() => go("/")}
            />
          </div>
          {/* MAESTRO (owner 2026-11-26, round 3): a dark card like the other surfaces, a 1 px lime-to-violet border (the
              robot's purple), glow on hover only; on /maestro a lime accent on the left. Idle it is never lime-filled, so
              Home's active border right above never reads as a second highlighted button. */}
          <div className={`group relative mb-1 mt-1 rounded-[15px] p-px transition ${maestroActive ? "bg-gradient-to-r from-lime-300/80 to-violet-500/80" : "bg-gradient-to-r from-lime-300/35 to-violet-500/35 hover:from-lime-300/60 hover:to-violet-500/60"} hover:shadow-[0_0_24px_rgba(190,242,100,.18)]`} data-testid="nav-maestro-card" data-active={maestroActive ? "true" : "false"}>
            <button
              type="button"
              onClick={() => go(MAESTRO_PATH)}
              aria-current={maestroActive ? "page" : undefined}
              className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-[14px] px-2.5 py-2 text-left transition active:scale-[0.985] ${maestroActive ? "bg-[#1a1d1e]" : "bg-[#131516] group-hover:bg-[#171a1b]"}`}
              data-testid="nav-maestro"
            >
              {maestroActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-lime-300" aria-hidden="true" />}
              <img src={MAESTRO_AVATAR} alt="" width="32" height="32" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-violet-400/40" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-black leading-tight text-white">Maestro</span>
                <span className="block truncate text-[11px] font-medium text-white/55">Ask, plan, make anything</span>
              </span>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-lime-300/40 bg-lime-300/10 text-lime-300 transition group-hover:bg-lime-300 group-hover:text-[#11150D]" title="New chat">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-label="New chat" />
              </span>
            </button>
          </div>
          <div className="mb-3 flex flex-col" data-testid="nav-maestro-chats">
            {maestroChats.map((c) => (
              <button key={c.id} type="button" onClick={() => go(maestroChatPath(c.id))}
                className={`truncate rounded-lg px-2.5 py-1 text-left text-[12.5px] transition ${isActive(maestroChatPath(c.id)) ? "text-lime-300" : "text-white/60 hover:text-white"}`}>
                {c.title}
              </button>
            ))}
          </div>

          <nav className="relative -mr-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.12)_transparent]">
            <NavSection label="Make" />
            <NavItem
              icon={Sparkles}
              label="Create"
              active={createActive || (!anyPanelOpen && isActive("/long-form"))}
              onClick={() => go(CREATE_PATH)}
            />
            {/* the studios: Long Form lives here now (no separate Long Form item) */}
            <div className="-mt-0.5 mb-1 ml-[22px] flex flex-col border-l border-white/[0.07] pl-2" data-testid="nav-studios">
              {[...STUDIOS].sort((a, b) => a.sort - b.sort).map((studio) => (
                <button
                  key={studio.id}
                  type="button"
                  onClick={() => go(studioPath(studio.id))}
                  className={`rounded-lg px-2 py-1 text-left text-[12.5px] font-medium transition ${!anyPanelOpen && isActive(studioPath(studio.id)) ? "text-lime-300" : "text-white/55 hover:text-white"}`}
                >
                  {studio.name.replace(/ Studio$/, "")}
                </button>
              ))}
            </div>
            <NavItem
              icon={Wand2}
              label="Quick Generate"
              active={aiStudioActive}
              onClick={() => go(AI_STUDIO_PATH)}
            />
            {mcpOpen && (
              <NavItem
                icon={Plug}
                label="Use with Claude"
                active={!anyPanelOpen && isActive(MCP_PATH)}
                onClick={() => go(MCP_PATH)}
              />
            )}

            <NavSection label="Library" />
            <NavItem
              icon={Folder}
              label="Creations"
              active={!anyPanelOpen && isActive("/workspace/creations")}
              onClick={() => go("/workspace/creations")}
            />
            <div className="ml-1 mt-0.5">
              <p className="px-2 pb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Recent</p>
              <RecentRows limit={4} onGo={() => { closePanels(); onClose?.(); }} />
            </div>

            <NavSection label="Earn" />
            {LIVE.rewards && <NavItem
              icon={Gift}
              label="Rewards"
              earn="Free credits"
              active={!anyPanelOpen && isActive(REWARDS_PATH)}
              onClick={() => go(REWARDS_PATH)}
            />}
            {LIVE.affiliate && <NavItem
              icon={HandCoins}
              label="Affiliate"
              earn
              active={!anyPanelOpen && isActive(AFFILIATE_PATH)}
              onClick={() => go(AFFILIATE_PATH)}
            />}
            <NavItem
              icon={TrendingUp}
              label="Earnings"
              active={!anyPanelOpen && isActive("/workspace/earnings")}
              onClick={() => go("/workspace/earnings")}
            />
            {SHOW_EARN_IN_NAV && (
              <NavItem
                icon={DollarSign}
                label="Earn"
                active={!anyPanelOpen && (location.pathname === "/workspace/earn" || isActive("/workspace/earn/"))}
                onClick={() => go("/workspace/earn")}
              />
            )}

            {pinnedTools.length > 0 && (
              <>
                <NavSection label="Pinned" />
                <div className="space-y-0.5">
                  {pinnedTools.map((tool) => (
                    <PinnedToolItem
                      key={tool.id}
                      tool={tool}
                      active={isActive(tool.path)}
                      onClick={() => go(tool.path)}
                    />
                  ))}
                </div>
              </>
            )}
          </nav>

          <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] px-1.5 pt-3 text-[12px] text-white/40">
            <button type="button" onClick={() => go("/pricing")} className="hover:text-white">Pricing</button>
            <button type="button" onClick={() => go("/support")} className="hover:text-white">Help</button>
            <button type="button" onClick={() => go("/settings")} className="hover:text-white">Settings</button>
          </div>
        </div>
      </div>
    </>
  );
}

function NavSection({ label }) {
  return <p className="mt-3 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-lime-200/60">{label}</p>;
}
