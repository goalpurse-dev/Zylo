import { useLocation, useNavigate } from "react-router-dom";
import { createElement, useEffect, useState } from "react";
import { ChevronRight, Folder, Home, LayoutGrid, Pin, Sparkles } from "lucide-react";
import Logo from "../../assets/Logo.png";
import { ALL_PINNABLE_TOOLS, DesktopCreatePanel, DesktopWorkspacePanel } from "./CreateMenu";
import "../../styles/workspace-shell.css";

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

function NavItem({ icon, iconSrc, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-left transition-all duration-200 active:scale-[0.985] ${active ? "zyvo-nav-active text-white" : NAV_IDLE}`}
    >
      <span className="zyvo-nav-icon grid h-5 w-5 shrink-0 place-items-center transition">
        {iconSrc
          ? <img src={iconSrc} alt="" className="h-5 w-5 object-contain" />
          : createElement(icon, { className: "h-[16px] w-[16px]", strokeWidth: 2 })}
      </span>
      <span className="text-[13.5px] font-semibold">{label}</span>
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
          <img src={tool.preview} alt="" className={`h-full w-full object-contain ${tool.previewPosition ?? "object-top"} ${tool.imageClassName ?? ""}`} />
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

  const isActive = (path) => location.pathname.startsWith(path);
  const anyPanelOpen = createOpen || workspaceOpen;
  const createActive = createOpen || (!anyPanelOpen && (
    isActive("/workspace/two-am") ||
    isActive("/workspace/cartoon-drive-by") ||
    isActive("/workspace/ai-fruit-story") ||
    isActive("/workspace/face-asmr") ||
    isActive("/workspace/micro-camera-animal") ||
    isActive("/workspace/clay-rescue") ||
    isActive("/workspace/ai-cooking-matic") ||
    isActive("/workspace/footballer-nationality-swap") ||
    isActive("/workspace/behind-the-scenes")
  ));
  const workspaceActive = workspaceOpen || (!anyPanelOpen && (
    isActive("/workspace/image-generator") || isActive("/workspace/video-generator")
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
    .filter(Boolean);
  const pinLimitReached = pinnedIds.length >= 4;

  return (
    <>
      <DesktopCreatePanel open={createOpen} onClose={() => setCreateOpen(false)} pinnedIds={pinnedIds} onTogglePin={togglePin} pinLimitReached={pinLimitReached} />
      <DesktopWorkspacePanel open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} pinnedIds={pinnedIds} onTogglePin={togglePin} pinLimitReached={pinLimitReached} />
      <div className="h-full p-3 pr-2">
        <div className="zyvo-compact-shell relative flex h-full flex-col overflow-hidden rounded-[24px] px-3 py-4">
          <div className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/35 to-transparent" />

          <div className="relative mb-6 flex items-center gap-2.5 px-1.5">
            <img src={Logo} alt="Zyvo" className="h-8 w-8 object-contain" />
            <span className="text-[18px] font-black tracking-[-0.035em] text-white">Zyvo</span>
          </div>

          <nav className="relative flex flex-col gap-1.5">
            <NavItem
              icon={Home}
              label="Home"
              active={!anyPanelOpen && isActive("/workspace/home")}
              onClick={() => go("/workspace/home")}
            />

            <NavItem
              icon={Sparkles}
              label="Create"
              active={createActive}
              onClick={() => {
                setCreateOpen((value) => !value);
                setWorkspaceOpen(false);
              }}
            />

            <NavItem
              icon={LayoutGrid}
              label="Workspace"
              active={workspaceActive}
              onClick={() => {
                setWorkspaceOpen((value) => !value);
                setCreateOpen(false);
              }}
            />

            <NavItem
              icon={Folder}
              label="Creations"
              active={!anyPanelOpen && isActive("/workspace/creations")}
              onClick={() => go("/workspace/creations")}
            />
          </nav>

          <section className="mt-6 min-h-0 flex-1 overflow-y-auto px-1">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Pin className="h-3 w-3 text-white/25" />
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/25">Pinned tools</p>
            </div>

            <div className="space-y-0.5">
              {pinnedTools.length > 0 ? pinnedTools.map((tool) => (
                <PinnedToolItem
                  key={tool.id}
                  tool={tool}
                  active={isActive(tool.path)}
                  onClick={() => go(tool.path)}
                />
              )) : (
                <div className="rounded-[11px] border border-dashed border-white/[0.07] px-3 py-3 text-[10px] leading-relaxed text-white/25">
                  Pin tools from any menu to keep them here.
                </div>
              )}
            </div>
          </section>

          <div className="relative mx-1 mb-1 rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/25">Zyvo workspace</p>
            <p className="mt-0.5 text-[10px] text-white/40">Create. Grow. Repeat.</p>
          </div>
        </div>
      </div>
    </>
  );
}
