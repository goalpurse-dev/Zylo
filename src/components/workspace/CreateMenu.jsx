import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";

// ─── Add new tools here as they launch ───────────────────────────────────────
export const CREATE_TOOLS = [
  {
    id: "ai-fruit-story",
    label: "AI Fruit Story",
    sublabel: "",
    path: "/workspace/ai-fruit-story",
    preview: "/viral-builder/ai-fruit/characters/bossmango.png",
    color: "#7A3BFF",
  },
  {
    id: "face-asmr",
    label: "Face ASMR",
    sublabel: "",
    path: "/workspace/face-asmr",
    preview: "/face/ronaldo.png",
    previewPosition: "object-center",
    color: "#A855F7",
  },
  {
    id: "micro-camera-animal",
    label: "Micro Camera",
    sublabel: "",
    path: "/workspace/micro-camera-animal",
    preview: "/viral-builder/micro-camera/preview1.png",
    previewPosition: "object-center",
    color: "#16a34a",
  },
  {
    id: "clay-rescue",
    label: "Clay Rescue",
    sublabel: "",
    path: "/workspace/clay-rescue",
    preview: "/clayrescue/smallpreview.webp",
    previewPosition: "object-center",
    color: "#7A3BFF",
  },
  {
    id: "ai-cooking-matic",
    label: "AI Cooking Matic",
    sublabel: "",
    path: "/workspace/ai-cooking-matic",
    preview: "/templates/AICOOKING/thumbnail.png",
    previewPosition: "object-center",
    color: "#EA580C",
  },
  {
    id: "footballer-nationality-swap",
    label: "Nationality Swap",
    sublabel: "",
    path: "/workspace/footballer-nationality-swap",
    preview: "/face/ronaldo.png",
    previewPosition: "object-center",
    color: "#F59E0B",
  },
  // { id: "ai-voice-story", label: "AI Voice Story", ... },
];

export const PUBLISH_TOOLS = [
  {
    id: "post-schedule",
    label: "Post / Schedule",
    sublabel: "",
    path: "/workspace/publish",
    color: "#7A3BFF",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "stats",
    label: "Analyze Stats",
    sublabel: "",
    path: "/workspace/stats",
    color: "#22C55E",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 19V5" strokeLinecap="round" />
        <path d="M4 19H20" strokeLinecap="round" />
        <path d="M8 16V11" strokeLinecap="round" />
        <path d="M12 16V7" strokeLinecap="round" />
        <path d="M16 16V9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "connections",
    label: "Connections",
    sublabel: "",
    path: "/workspace/connections",
    color: "#F97316",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/* ─── Shared panel shell ──────────────────────────────────────────────────── */
function DesktopPanel({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <>
      {open && <div className="fixed inset-0 z-[149]" onClick={onClose} />}
      <div
        className="fixed top-0 z-[150] h-full w-[260px] flex flex-col bg-[#0d0f10] border-r border-white/[0.07]"
        style={{
          left: "80px",
          opacity: open ? 1 : 0,
          transform: open ? "scale(1) translateX(0)" : "scale(0.97) translateX(-8px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-[15px] font-bold text-white">{title}</h2>
            {subtitle && <p className="text-[11px] text-white/35 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white transition text-sm"
          >✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─── Desktop Create panel ────────────────────────────────────────────────── */
export function DesktopCreatePanel({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path) => { onClose(); navigate(path); };

  return (
    <DesktopPanel open={open} onClose={onClose} title="Create" subtitle="Choose a tool to start">
      {CREATE_TOOLS.map((tool) => {
        const active = location.pathname.startsWith(tool.path);
        return (
          <button
            key={tool.id}
            onClick={() => go(tool.path)}
            className={`relative w-full flex items-center gap-3.5 overflow-hidden rounded-[16px] border p-3.5 text-left transition active:scale-[0.98] group ${
              active
                ? "border-white/14 bg-white/[0.06]"
                : "border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
            }`}
          >
            {active && (
              <div className="absolute inset-y-0 left-0 w-1" style={{ background: "rgba(190,242,100,0.55)" }} />
            )}
            <div
              className="relative h-[52px] w-[42px] flex-shrink-0 overflow-hidden rounded-[12px]"
              style={{ background: `linear-gradient(135deg, ${tool.color}55, ${tool.color}22)` }}
            >
              <img src={tool.preview} alt={tool.label} className={`h-full w-full object-cover ${tool.previewPosition ?? "object-top"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold leading-tight text-white">{tool.label}</div>
              {tool.sublabel && <div className="text-[11px] text-white/40 mt-0.5">{tool.sublabel}</div>}
            </div>
            {active
              ? <div className="h-2 w-2 flex-shrink-0 rounded-full bg-lime-300/80" />
              : <svg className="h-4 w-4 text-white/25 group-hover:text-white/60 transition flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            }
          </button>
        );
      })}
      <div className="mt-2 rounded-[14px] border border-dashed border-white/[0.07] py-5 text-center">
        <div className="text-[11px] text-white/20 font-medium">More tools coming soon</div>
      </div>
    </DesktopPanel>
  );
}

/* ─── Desktop Workspace panel (Image / Video) ─────────────────────────────── */
const WORKSPACE_TOOLS = [
  {
    id: "image",
    label: "Image Generator",
    sublabel: "",
    path: "/workspace/image-generator",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "video",
    label: "Video Generator",
    sublabel: "",
    path: "/workspace/video-generator",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14" strokeLinecap="round"/>
        <rect x="3" y="7" width="12" height="10" rx="2"/>
      </svg>
    ),
  },
];

export function DesktopWorkspacePanel({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = (path) => { onClose(); navigate(path); };

  return (
    <DesktopPanel open={open} onClose={onClose} title="Workspace" subtitle="Your creation tools">
      {WORKSPACE_TOOLS.map((tool) => {
        const active = location.pathname.startsWith(tool.path);
        return (
          <button
            key={tool.id}
            onClick={() => go(tool.path)}
            className={`relative w-full flex items-center gap-3.5 overflow-hidden rounded-[16px] border p-3.5 text-left transition active:scale-[0.98] group ${
              active
                ? "border-white/14 bg-white/[0.06]"
                : "border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
            }`}
          >
            {active && (
              <div className="absolute inset-y-0 left-0 w-1" style={{ background: "rgba(190,242,100,0.55)" }} />
            )}
            <div className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[12px] border ${
              active ? "border-white/12 bg-white/[0.06] text-lime-100" : "border-white/[0.07] bg-white/[0.04] text-white/50 group-hover:text-white"
            }`}>
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white leading-tight">{tool.label}</div>
              {tool.sublabel && <div className="text-[11px] text-white/40 mt-0.5">{tool.sublabel}</div>}
            </div>
            {active
              ? <div className="h-2 w-2 flex-shrink-0 rounded-full bg-lime-300/80" />
              : <svg className="h-4 w-4 text-white/25 group-hover:text-white/60 transition flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        );
      })}
    </DesktopPanel>
  );
}

/* ─── Mobile fan menu (CapCut style) ─────────────────────────────────────── */
export function DesktopPublishPanel({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = (path) => { onClose(); navigate(path); };

  return (
    <DesktopPanel key={location.pathname} open={open} onClose={onClose} title="Publish" subtitle="">
      {PUBLISH_TOOLS.map((tool) => {
        const active = location.pathname.startsWith(tool.path);
        return (
          <button
            key={tool.id}
            onClick={() => go(tool.path)}
            className={`relative w-full flex items-center gap-3.5 overflow-hidden rounded-[16px] border p-3.5 text-left transition active:scale-[0.98] group ${
              active
                ? "border-white/14 bg-white/[0.06]"
                : "border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
            }`}
          >
            {active && (
              <div
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: "rgba(190,242,100,0.55)" }}
              />
            )}
            <div
              className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[12px] border ${
                active ? "border-white/12 bg-white/[0.06] text-lime-100" : "border-white/[0.07] bg-white/[0.04] text-white/50 group-hover:text-white"
              }`}
            >
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-white leading-tight">{tool.label}</div>
              {tool.sublabel && <div className="text-[11px] text-white/40 mt-0.5">{tool.sublabel}</div>}
            </div>
            {active
              ? <div className="h-2 w-2 flex-shrink-0 rounded-full bg-lime-300/80" />
              : <svg className="h-4 w-4 text-white/25 group-hover:text-white/60 transition flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        );
      })}
    </DesktopPanel>
  );
}

export default function MobileCreateMenu({ open, onClose, anchorBottom = 72 }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const go = (path) => { onClose(); navigate(path); };

  const useGridLayout = CREATE_TOOLS.length >= 4;
  const total = CREATE_TOOLS.length;
  const fanAngles = total === 1
    ? [0]
    : Array.from({ length: total }, (_, i) => {
        const spread = total === 2 ? 64 : Math.min(96, (total - 1) * 40);
        return -spread / 2 + (spread / (total - 1)) * i;
      });

  const FAN_RADIUS = 154; // px from center of close button

  return createPortal(
    <div
      className={`fixed inset-0 z-[199] transition-all duration-300 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
      />

      {/* Fan items — positioned above the center of the nav */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: anchorBottom + 8 }}
      >
        {useGridLayout ? (
          <div
            className="absolute left-1/2 grid w-[244px] -translate-x-1/2 grid-cols-2 gap-x-8 gap-y-5 transition-all duration-300"
            style={{
              bottom: 82,
              transform: `translateX(-50%) ${open ? "scale(1)" : "scale(0.92)"}`,
              opacity: open ? 1 : 0,
            }}
          >
            {CREATE_TOOLS.map((tool, i) => (
              <button
                key={tool.id}
                onClick={() => go(tool.path)}
                className="flex w-[106px] flex-col items-center gap-1.5 active:scale-90 transition-transform"
                style={{
                  transitionDelay: open ? `${i * 40}ms` : "0ms",
                }}
              >
                <div
                  className="relative h-[62px] w-[62px] overflow-hidden rounded-full border-2 border-white/20"
                  style={{ background: `linear-gradient(135deg, ${tool.color}, ${tool.color}99)` }}
                >
                  <img
                    src={tool.preview}
                    alt={tool.label}
                    className={`h-full w-full object-cover scale-110 ${tool.previewPosition ?? "object-top"}`}
                  />
                </div>
                <span className="max-w-full text-center text-[11px] font-semibold leading-tight text-white/90 drop-shadow-lg">
                  {tool.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          CREATE_TOOLS.map((tool, i) => {
          const angleDeg = fanAngles[i] - 90; // -90 so 0deg = straight up
          const angleRad = (angleDeg * Math.PI) / 180;
          const x = Math.cos(angleRad) * FAN_RADIUS;
          const y = Math.sin(angleRad) * FAN_RADIUS;

          return (
            <div
              key={tool.id}
              className="absolute transition-all duration-300"
              style={{
                left: `calc(50% + ${x}px)`,
                bottom: `calc(0px - ${y}px)`,
                transform: `translate(-50%, 50%) ${open ? "scale(1)" : "scale(0.5)"}`,
                opacity: open ? 1 : 0,
                transitionDelay: open ? `${i * 50}ms` : "0ms",
              }}
            >
              <button
                onClick={() => go(tool.path)}
                className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
              >
                {/* Icon circle */}
                <div
                  className="relative h-[62px] w-[62px] overflow-hidden rounded-full border-2 border-white/20"
                  style={{ background: `linear-gradient(135deg, ${tool.color}, ${tool.color}99)` }}
                >
                  <img
                    src={tool.preview}
                    alt={tool.label}
                    className={`h-full w-full object-cover scale-110 ${tool.previewPosition ?? "object-top"}`}
                  />
                </div>
                {/* Label */}
                <span className="text-[11px] font-semibold text-white/90 whitespace-nowrap drop-shadow-lg">
                  {tool.label}
                </span>
              </button>
            </div>
          );
          })
        )}

        {/* Close / Create button at anchor */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2">
          <button
            onClick={onClose}
            className={`flex h-[54px] w-[54px] items-center justify-center rounded-full border-2 transition-all duration-300 ${
              open
                ? "border-white/30 bg-[#1a1c20] rotate-45 scale-100"
                : "opacity-0 scale-50"
            }`}
          >
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C11.175 2 10.5 2.675 10.5 3.5V10.5H3.5C2.675 10.5 2 11.175 2 12C2 12.825 2.675 13.5 3.5 13.5H10.5V20.5C10.5 21.325 11.175 22 12 22C12.825 22 13.5 21.325 13.5 20.5V13.5H20.5C21.325 13.5 22 12.825 22 12C22 11.175 21.325 10.5 20.5 10.5H13.5V3.5C13.5 2.675 12.825 2 12 2Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
