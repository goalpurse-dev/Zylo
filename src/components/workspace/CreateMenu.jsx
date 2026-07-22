import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Pin, X } from "lucide-react";

// ─── Add new tools here as they launch ───────────────────────────────────────
export const CREATE_TOOLS = [
  {
    id: "ai-fruit-story",
    label: "AI Fruit Story",
    sublabel: "",
    path: "/workspace/ai-fruit-story",
    preview: "/viral-builder/ai-fruit/characters/bossmango.png",
    color: "#bef264",
  },
  {
    id: "face-asmr",
    label: "Face ASMR",
    sublabel: "",
    path: "/workspace/face-asmr",
    preview: "/face/ronaldo.png",
    previewPosition: "object-center",
    color: "#bef264",
  },
  {
    id: "micro-camera-animal",
    label: "Micro Camera",
    sublabel: "",
    path: "/workspace/micro-camera-animal",
    preview: "/viral-builder/micro-camera/preview1.png",
    previewPosition: "object-center",
    color: "#bef264",
  },
  {
    id: "clay-rescue",
    label: "Clay Rescue",
    sublabel: "",
    path: "/workspace/clay-rescue",
    preview: "/clayrescue/smallpreview.webp",
    previewPosition: "object-center",
    color: "#bef264",
  },
  {
    id: "ai-cooking-matic",
    label: "AI Cooking Matic",
    sublabel: "",
    path: "/workspace/ai-cooking-matic",
    preview: "/templates/AICOOKING/thumbnail.png",
    previewPosition: "object-center",
    color: "#bef264",
  },
  {
    id: "footballer-nationality-swap",
    label: "Nationality Swap",
    sublabel: "",
    path: "/workspace/footballer-nationality-swap",
    preview: "/template/nationality-swap/preview.png",
    previewPosition: "object-center",
    color: "#bef264",
  },
  // { id: "ai-voice-story", label: "AI Voice Story", ... },
];

export const PUBLISH_TOOLS = [
  {
    id: "post-schedule",
    label: "Post / Schedule",
    pinnedLabel: "Publish",
    sublabel: "",
    path: "/workspace/publish",
    preview: "/icons/publish-transparent.png",
    previewPosition: "object-center",
    imageClassName: "scale-[1.35]",
    transparentIcon: true,
    color: "#bef264",
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
    pinnedLabel: "Stats",
    sublabel: "",
    path: "/workspace/stats",
    preview: "/icons/stats-transparent.png",
    previewPosition: "object-center",
    imageClassName: "scale-[1.35]",
    transparentIcon: true,
    color: "#bef264",
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
    preview: "/icons/connection-transparent.png",
    previewPosition: "object-center",
    transparentIcon: true,
    color: "#bef264",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/* ─── Shared panel shell ──────────────────────────────────────────────────── */
function DesktopPanel({ open, onClose, title, subtitle, sectionLabel, grid, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <>
      {open && <div className="zyvo-panel-dismiss-layer fixed bottom-0 right-0 z-[149]" onClick={onClose} />}
      <div
        className="zyvo-popover-panel fixed z-[150] w-[260px] flex flex-col overflow-hidden rounded-[22px]"
        style={{
          top: "calc(var(--zyvo-notice-height, 0px) + 12px)",
          left: "224px",
          height: "calc(100dvh - var(--zyvo-notice-height, 0px) - 24px)",
          opacity: open ? 1 : 0,
          transform: open ? "scale(1) translateX(0)" : "scale(0.97) translateX(-8px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
        }}
      >
        <div className="zyvo-popover-accent absolute left-6 right-6 top-0 h-px" />

        <div className="relative flex items-center justify-between border-b border-white/[0.06] px-5 pb-4 pt-5">
          <div>
            <h2 className="text-[15px] font-bold text-white">{title}</h2>
            {subtitle && <p className="text-[11px] text-white/35 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white transition text-sm"
          >✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sectionLabel && (
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/25">{sectionLabel}</p>
          )}
          <div className={grid ? "grid grid-cols-1 gap-2" : "space-y-2"}>{children}</div>
        </div>
      </div>
    </>,
    document.body
  );
}

// One accent across the shell and every opened panel.
const LIME_DOT = <span className="h-2 w-2 flex-shrink-0 rounded-full bg-lime-300" style={{ boxShadow: "0 0 8px 1px #bef264" }} />;

function PinToggle({ pinned, onToggle, label, disabled = false }) {
  const toggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    onToggle?.();
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") toggle(event);
      }}
      className={`zyvo-pin-toggle ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] transition ${pinned ? "is-pinned" : ""} ${disabled ? "is-disabled" : ""}`}
      aria-label={`${pinned ? "Unpin" : "Pin"} ${label}`}
      aria-disabled={disabled}
      title={disabled ? "Maximum 4 pinned tools" : `${pinned ? "Unpin" : "Pin"} ${label}`}
    >
      <Pin className="h-3.5 w-3.5" fill={pinned ? "currentColor" : "none"} />
    </span>
  );
}

/* ─── Shared tool row — used by the Publish panel (and anywhere a full-width
   single-column list makes more sense than a grid). Handles both card
   shapes: an image preview (CREATE_TOOLS) or an inline SVG icon
   (WORKSPACE_TOOLS / PUBLISH_TOOLS). The left accent bar and icon glow are
   color-matched to the tool's own brand color so rows feel distinct rather
   than a flat repeated list; the active indicator itself is always the
   lime spark, an inset white top-highlight gives active rows the same
   glassy "lit up" look as the rail. ─── */
function ToolRow({ tool, active, onClick, pinned, onTogglePin, pinDisabled }) {
  return (
    <button
      onClick={onClick}
      className={`zyvo-panel-item group relative w-full flex items-center gap-3 overflow-hidden rounded-[15px] border p-3 text-left transition-all duration-200 active:scale-[0.98] ${
        active
          ? "is-active border-white/[0.16] bg-white/[0.08]"
          : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06] hover:-translate-y-0.5"
      }`}
      style={active ? { boxShadow: `0 0 24px -6px ${tool.color}80, inset 0 1px 0 rgba(255,255,255,0.16)` } : undefined}
    >
      {active && (
        <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${tool.color}, ${tool.color}00)` }} />
      )}
      {!active && (
        <div
          className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
          style={{ background: tool.color }}
        />
      )}

      {tool.preview ? (
        <div
          className={`relative flex-shrink-0 overflow-hidden transition ${tool.transparentIcon ? "h-8 w-8" : "h-[52px] w-[52px] rounded-[12px] ring-1 ring-white/10 group-hover:ring-white/20"}`}
          style={{
            background: tool.transparentIcon ? "transparent" : `linear-gradient(135deg, ${tool.color}55, ${tool.color}22)`,
            boxShadow: active && !tool.transparentIcon ? `0 0 16px -2px ${tool.color}99` : undefined,
          }}
        >
          <img src={tool.preview} alt={tool.label} className={`h-full w-full object-contain ${tool.previewPosition ?? "object-top"} ${tool.imageClassName ?? ""}`} />
        </div>
      ) : (
        <div
          className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[12px] border transition ${
            active ? "border-white/10 text-white" : "border-white/[0.07] bg-white/[0.04] text-white/50 group-hover:text-white"
          }`}
          style={active ? { background: `linear-gradient(135deg, ${tool.color}55, ${tool.color}22)`, boxShadow: `0 0 16px -2px ${tool.color}99` } : undefined}
        >
          {tool.icon}
        </div>
      )}

      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-white">{tool.label}</div>
          <PinToggle pinned={pinned} onToggle={onTogglePin} label={tool.label} disabled={pinDisabled} />
        </div>
        {tool.sublabel && <div className="text-[11px] text-white/40 mt-0.5">{tool.sublabel}</div>}
      </div>

      {active ? LIME_DOT : (
        <svg className="h-4 w-4 text-white/25 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ─── Compact grid cell — used by Create / Workspace panels, arranged
   2-up per row (the "put a couple on the same row" OpenArt treatment)
   instead of one item per line. Corner color-glow on hover + the same
   lime spark + glassy highlight when active as ToolRow. ─── */
function ToolGridItem({ tool, active, onClick, pinned, onTogglePin, pinDisabled }) {
  return (
    <button
      onClick={onClick}
      className={`zyvo-panel-item group relative flex items-center gap-3 overflow-hidden rounded-[15px] border p-3 text-left transition-all duration-200 active:scale-[0.97] ${
        active
          ? "is-active border-white/[0.16] bg-white/[0.08]"
          : "border-white/[0.07] bg-white/[0.035] hover:border-white/[0.18] hover:bg-white/[0.07] hover:-translate-y-0.5"
      }`}
      style={{ boxShadow: active ? `0 0 22px -6px ${tool.color}80, inset 0 1px 0 rgba(255,255,255,0.16)` : undefined }}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-35"
        style={{ background: tool.color }}
      />

      {tool.preview ? (
        <div
          className={`relative flex-shrink-0 overflow-hidden transition ${tool.transparentIcon ? "h-8 w-8" : "h-9 w-9 rounded-[10px] ring-1 ring-white/10 group-hover:ring-white/20"}`}
          style={{ background: tool.transparentIcon ? "transparent" : `linear-gradient(135deg, ${tool.color}55, ${tool.color}22)`, boxShadow: active && !tool.transparentIcon ? `0 0 14px -2px ${tool.color}99` : undefined }}
        >
          <img src={tool.preview} alt={tool.label} className={`h-full w-full object-cover ${tool.previewPosition ?? "object-top"}`} />
        </div>
      ) : (
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border transition ${
            active ? "border-white/10 text-white" : "border-white/[0.07] bg-white/[0.04] text-white/50 group-hover:text-white"
          }`}
          style={active ? { background: `linear-gradient(135deg, ${tool.color}55, ${tool.color}22)`, boxShadow: `0 0 14px -2px ${tool.color}99` } : undefined}
        >
          {tool.icon}
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-tight text-white">{tool.label}</span>
        <PinToggle pinned={pinned} onToggle={onTogglePin} label={tool.label} disabled={pinDisabled} />
      </div>
    </button>
  );
}

/* ─── Desktop Create panel ────────────────────────────────────────────────── */
export function DesktopCreatePanel({ open, onClose, pinnedIds = [], onTogglePin, pinLimitReached = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path) => { onClose(); navigate(path); };

  return (
    <DesktopPanel open={open} onClose={onClose} title="Create" subtitle="Choose a tool to start" sectionLabel="Viral Tools" grid>
      {CREATE_TOOLS.map((tool) => (
        <ToolGridItem key={tool.id} tool={tool} active={location.pathname.startsWith(tool.path)} onClick={() => go(tool.path)} pinned={pinnedIds.includes(tool.id)} onTogglePin={() => onTogglePin?.(tool.id)} pinDisabled={pinLimitReached && !pinnedIds.includes(tool.id)} />
      ))}
      <div className="mt-0.5 rounded-[14px] border border-dashed border-white/[0.07] py-5 text-center">
        <div className="text-[11px] text-white/20 font-medium">More tools coming soon</div>
      </div>
    </DesktopPanel>
  );
}

/* ─── Desktop Workspace panel (Image / Video) ─────────────────────────────── */
export const WORKSPACE_TOOLS = [
  {
    id: "image",
    label: "Image Generator",
    sublabel: "",
    path: "/workspace/image-generator",
    preview: "/icons/image-generator-transparent.png",
    previewPosition: "object-center",
    transparentIcon: true,
    color: "#bef264",
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
    preview: "/icons/video-generator-transparent.png",
    previewPosition: "object-center",
    transparentIcon: true,
    color: "#bef264",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14" strokeLinecap="round"/>
        <rect x="3" y="7" width="12" height="10" rx="2"/>
      </svg>
    ),
  },
];

export const ALL_PINNABLE_TOOLS = [...CREATE_TOOLS, ...WORKSPACE_TOOLS, ...PUBLISH_TOOLS];

export function DesktopWorkspacePanel({ open, onClose, pinnedIds = [], onTogglePin, pinLimitReached = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = (path) => { onClose(); navigate(path); };

  return (
    <DesktopPanel open={open} onClose={onClose} title="Workspace" subtitle="Your creation tools" sectionLabel="Generators" grid>
      {WORKSPACE_TOOLS.map((tool) => (
        <ToolGridItem key={tool.id} tool={tool} active={location.pathname.startsWith(tool.path)} onClick={() => go(tool.path)} pinned={pinnedIds.includes(tool.id)} onTogglePin={() => onTogglePin?.(tool.id)} pinDisabled={pinLimitReached && !pinnedIds.includes(tool.id)} />
      ))}
    </DesktopPanel>
  );
}

/* ─── Desktop Publish panel ────────────────────────────────────────────────── */
export function DesktopPublishPanel({ open, onClose, pinnedIds = [], onTogglePin, pinLimitReached = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = (path) => { onClose(); navigate(path); };

  return (
    <DesktopPanel key={location.pathname} open={open} onClose={onClose} title="Publish" sectionLabel="Distribution">
      {PUBLISH_TOOLS.map((tool) => (
        <ToolRow key={tool.id} tool={tool} active={location.pathname.startsWith(tool.path)} onClick={() => go(tool.path)} pinned={pinnedIds.includes(tool.id)} onTogglePin={() => onTogglePin?.(tool.id)} pinDisabled={pinLimitReached && !pinnedIds.includes(tool.id)} />
      ))}
    </DesktopPanel>
  );
}

/* ─── Mobile fan menu (CapCut style) ─────────────────────────────────────── */
export default function MobileCreateMenu({ open, onClose, anchorBottom = 72 }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const go = (path) => { onClose(); navigate(path); };
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[199]" role="presentation">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close Create menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/[0.74] backdrop-blur-[7px]"
      />

      {/* Fan items — positioned above the center of the nav */}
      <section
        aria-label="Create menu"
        className="absolute left-1/2 w-[calc(100%-28px)] max-w-[380px] -translate-x-1/2 overflow-hidden rounded-[24px] border border-white/[0.11] bg-[#121416]/[0.98] p-3.5 shadow-[0_22px_70px_rgba(0,0,0,.62),inset_0_1px_0_rgba(255,255,255,.06)]"
        style={{
          bottom: `calc(${anchorBottom}px + env(safe-area-inset-bottom) + 14px)`,
          animation: "zyvoCreateMenuIn 180ms cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/60 to-transparent" />
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-[15px] font-bold tracking-[-0.02em] text-white">Create</p>
            <p className="mt-0.5 text-[10px] font-medium text-white/35">Pick a tool and start creating</p>
          </div>
          <button
            type="button"
            aria-label="Close Create menu"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/55 transition active:scale-90 active:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
            {CREATE_TOOLS.map((tool, i) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => go(tool.path)}
                aria-current={location.pathname.startsWith(tool.path) ? "page" : undefined}
                className={`relative flex min-h-[72px] items-center gap-2.5 overflow-hidden rounded-[18px] border p-2.5 text-left transition active:scale-[0.97] ${
                  location.pathname.startsWith(tool.path)
                    ? "border-lime-300/40 bg-lime-300/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_24px_rgba(190,242,100,.08)]"
                    : "border-white/[0.08] bg-white/[0.035] hover:border-white/[0.14] hover:bg-white/[0.06]"
                }`}
                style={{
                  animation: `zyvoCreateItemIn 200ms ${i * 30}ms cubic-bezier(.2,.8,.2,1) both`,
                }}
              >
                <div className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-[14px] border ${
                  location.pathname.startsWith(tool.path) ? "border-lime-300/35" : "border-white/10"
                }`}>
                  <img
                    src={tool.preview}
                    alt={tool.label}
                    className={`h-full w-full object-cover ${tool.previewPosition ?? "object-top"}`}
                  />
                </div>
                <span className={`min-w-0 text-[11px] font-semibold leading-[14px] ${
                  location.pathname.startsWith(tool.path) ? "text-lime-300" : "text-white/80"
                }`}>
                  {tool.label}
                </span>
                {location.pathname.startsWith(tool.path) && (
                  <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_#bef264]" />
                )}
              </button>
            ))}
        </div>

        <style>{`
          @keyframes zyvoCreateMenuIn {
            from { opacity: 0; transform: translate(-50%, 12px) scale(.98); }
            to { opacity: 1; transform: translate(-50%, 0) scale(1); }
          }
          @keyframes zyvoCreateItemIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </section>
    </div>,
    document.body
  );
}
