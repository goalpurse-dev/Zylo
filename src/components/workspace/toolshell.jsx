import { useNavigate, useLocation } from "react-router-dom";
import Logo from "../../assets/Logo.png";
import { useState } from "react";
import { DesktopCreatePanel, DesktopWorkspacePanel, DesktopPublishPanel } from "./CreateMenu";

import {
  Home,
  Folder,
  LayoutGrid,
  Send,
} from "lucide-react";

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        ftg-nav-item
        w-full flex flex-col items-center gap-1 py-3 rounded-xl
        transition-all duration-200
        ${active
          ? "bg-white text-black"
          : "text-white/50 hover:text-white hover:bg-white/5"}
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

export default function ToolShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const isActive = (path) => location.pathname.startsWith(path);

  // Only one nav item is ever "active" at a time. While a panel is open, its
  // own button wins and everything else (including route-matched items like
  // Home) turns off — otherwise you'd see two highlighted at once.
  const anyPanelOpen = createOpen || workspaceOpen || publishOpen;

  return (
    <>
    <DesktopCreatePanel open={createOpen} onClose={() => setCreateOpen(false)} />
    <DesktopWorkspacePanel open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
    <DesktopPublishPanel open={publishOpen} onClose={() => setPublishOpen(false)} />
    <div className="h-full flex flex-col items-center py-4 px-2 bg-[#090A0A] border-r border-white/5">

      {/* LOGO */}
      <div className="mb-6">
       <img
  src={Logo}
  className="
    w-10 h-10
    object-contain

    drop-shadow-[0_0_10px_rgba(122,59,255,0.6)]
  "
/>
      </div>

      {/* NAV */}
      <div className="flex flex-col items-center gap-2 w-full">
        <NavItem
          icon={Home}
          label="Home"
          active={!anyPanelOpen && isActive("/workspace/home")}
          onClick={() => { setCreateOpen(false); setWorkspaceOpen(false); setPublishOpen(false); navigate("/workspace/home"); }}
        />

        <button
          onClick={() => { setPublishOpen((v) => !v); setWorkspaceOpen(false); setCreateOpen(false); }}
          className={`ftg-nav-item w-full flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 ${
            publishOpen || (!anyPanelOpen && (isActive("/workspace/publish") || isActive("/workspace/stats") || isActive("/workspace/connections")))
              ? "bg-white text-black"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Send className="w-5 h-5" />
          <span className="text-[11px] font-medium">Publish</span>
        </button>

        {/* Create — opens viral tools panel */}
        <button
          onClick={() => { setCreateOpen((v) => !v); setWorkspaceOpen(false); setPublishOpen(false); }}
          className={`ftg-nav-item w-full flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 ${
            createOpen || (!anyPanelOpen && (isActive("/workspace/ai-fruit-story") || isActive("/workspace/face-asmr") || isActive("/workspace/micro-camera-animal") || isActive("/workspace/clay-rescue") || isActive("/workspace/ai-cooking-matic") || isActive("/workspace/footballer-nationality-swap")))
              ? "bg-white text-black"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 2C11.175 2 10.5 2.675 10.5 3.5V10.5H3.5C2.675 10.5 2 11.175 2 12C2 12.825 2.675 13.5 3.5 13.5H10.5V20.5C10.5 21.325 11.175 22 12 22C12.825 22 13.5 21.325 13.5 20.5V13.5H20.5C21.325 13.5 22 12.825 22 12C22 11.175 21.325 10.5 20.5 10.5H13.5V3.5C13.5 2.675 12.825 2 12 2Z"/>
          </svg>
          <span className="text-[11px] font-medium">Create</span>
        </button>

        {/* Workspace — opens Image / Video panel */}
        <button
          onClick={() => { setWorkspaceOpen((v) => !v); setCreateOpen(false); setPublishOpen(false); }}
          className={`ftg-nav-item w-full flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 ${
            workspaceOpen || (!anyPanelOpen && (
              isActive("/workspace/image-generator") ||
              isActive("/workspace/video-generator")
            ))
              ? "bg-white text-black"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[11px] font-medium">Workspace</span>
        </button>

        <NavItem
          icon={Folder}
          label="Creations"
          active={!anyPanelOpen && isActive("/workspace/creations")}
          onClick={() => { setCreateOpen(false); setWorkspaceOpen(false); setPublishOpen(false); navigate("/workspace/creations"); }}
        />
      </div>

      {/* SPACER */}
      <div className="flex-1" />
    </div>
    </>
  );
}
