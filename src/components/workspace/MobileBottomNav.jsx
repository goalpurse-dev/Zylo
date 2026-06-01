import { useState, isValidElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, PenLine, Folder, LayoutGrid } from "lucide-react";
import { createPortal } from "react-dom";
import MobileCreateMenu from "./CreateMenu";

/* ─── Workspace pop-up menu (image + video) ──────────────────────────────── */
const WORKSPACE_ITEMS = [
  {
    id: "image",
    label: "Image",
    path: "/workspace/image-generator",
    icon: (
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "video",
    label: "Video",
    path: "/workspace/video-generator",
    icon: (
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14" strokeLinecap="round" />
        <rect x="3" y="7" width="12" height="10" rx="2" />
      </svg>
    ),
  },
  {
    id: "script",
    label: "Script",
    path: "/workspace/viral-script",
    icon: (
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function WorkspacePopup({ open, onClose, anchorRef }) {
  const navigate = useNavigate();
  if (!open) return null;

  const go = (path) => { onClose(); navigate(path); };

  return createPortal(
    <div className="fixed inset-0 z-[190]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Fan of 2 items above Workspace nav item */}
      <div
        className="absolute"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom) + 12px)", left: "calc(10%)" }}
      >
        <div className="flex gap-5" onClick={(e) => e.stopPropagation()}>
          {WORKSPACE_ITEMS.map((item, i) => (
            <div
              key={item.id}
              className="flex flex-col items-center gap-2 transition-all"
              style={{
                animation: `popUp 0.22s ${i * 60}ms cubic-bezier(0.34,1.56,0.64,1) both`,
              }}
            >
              <button
                onClick={() => go(item.path)}
                className="h-[56px] w-[56px] flex items-center justify-center rounded-full bg-[#1a1c24] border border-white/15 active:scale-90 transition-transform"
              >
                {item.icon}
              </button>
              <span className="text-[11px] font-semibold text-white/80">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes popUp {
          from { opacity: 0; transform: translateY(18px) scale(0.7); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}

/* ─── Nav item ───────────────────────────────────────────────────────────── */
function NavItem({ name, icon: Icon, path, active, onClick }) {
  return (
    <button
      onClick={onClick || undefined}
      className="ftg-nav-item flex flex-1 justify-center"
    >
      <div className={`flex flex-col items-center justify-center w-[60px] h-[50px] rounded-xl transition-all duration-200 active:scale-95 ${
        active ? "bg-white text-black" : "text-white/55"
      }`}>
        {isValidElement(Icon) ? Icon : <Icon size={20} />}
        <span className="text-[10px] mt-[2px] font-medium">{name}</span>
      </div>
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function MobileBottomNav({ hidden }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const NAV_HEIGHT = 72;

  return (
    <>
      <MobileCreateMenu
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        anchorBottom={NAV_HEIGHT}
      />
      <WorkspacePopup
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
      />

      <div
        className={`ftg-bottom-nav fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-[#0e1012] border-t border-white/[0.07] transition-opacity duration-300 ${
          hidden ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{
          height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className={`flex items-center justify-between px-2 h-[${NAV_HEIGHT}px]`} style={{ height: NAV_HEIGHT }}>

          {/* Home */}
          <NavItem
            name="Home"
            icon={Home}
            path="/workspace/home"
            active={location.pathname === "/workspace/home"}
            onClick={() => { setCreateOpen(false); setWorkspaceOpen(false); navigate("/workspace/home"); }}
          />

          {/* Workspace */}
          <button
            className="ftg-nav-item flex flex-1 justify-center"
            onClick={() => { setCreateOpen(false); setWorkspaceOpen((v) => !v); }}
          >
            <div className={`flex flex-col items-center justify-center w-[60px] h-[50px] rounded-xl transition-all duration-200 active:scale-95 ${
              workspaceOpen ||
              location.pathname.includes("image-generator") ||
              location.pathname.includes("video-generator") ||
              location.pathname.includes("viral-script")
                ? "bg-white text-black"
                : "text-white/55"
            }`}>
              <LayoutGrid size={20} />
              <span className="text-[10px] mt-[2px] font-medium">Workspace</span>
            </div>
          </button>

          {/* Create */}
          <button
            className="ftg-nav-item flex flex-1 justify-center"
            onClick={() => { setWorkspaceOpen(false); setCreateOpen((v) => !v); }}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <div className={`flex flex-col items-center justify-center w-[60px] h-[50px] rounded-xl transition-all duration-200 active:scale-95 ${
              location.pathname.startsWith("/workspace/ai-fruit-story") ||
              location.pathname.startsWith("/workspace/face-asmr") ||
              location.pathname.startsWith("/workspace/micro-camera-animal") ||
              location.pathname.startsWith("/workspace/clay-rescue")
                ? "bg-white text-black" : "text-white/55"
            }`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C11.175 2 10.5 2.675 10.5 3.5V10.5H3.5C2.675 10.5 2 11.175 2 12C2 12.825 2.675 13.5 3.5 13.5H10.5V20.5C10.5 21.325 11.175 22 12 22C12.825 22 13.5 21.325 13.5 20.5V13.5H20.5C21.325 13.5 22 12.825 22 12C22 11.175 21.325 10.5 20.5 10.5H13.5V3.5C13.5 2.675 12.825 2 12 2Z"/>
              </svg>
              <span className="text-[10px] mt-[2px] font-medium">Create</span>
            </div>
          </button>

          {/* Creations */}
          <NavItem
            name="Creations"
            icon={Folder}
            path="/workspace/creations"
            active={location.pathname.startsWith("/workspace/creations")}
            onClick={() => { setCreateOpen(false); setWorkspaceOpen(false); navigate("/workspace/creations"); }}
          />

        </div>
      </div>
    </>
  );
}
