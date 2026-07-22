import { createElement, useEffect, useRef, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Folder, Home, LayoutGrid, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CREATE_TOOLS, WORKSPACE_TOOLS } from "./CreateMenu";

const groups = [
  { name: "Home", icon: Home, path: "/workspace/home" },
  { name: "Create", icon: Sparkles, items: CREATE_TOOLS },
  { name: "Workspace", icon: LayoutGrid, items: WORKSPACE_TOOLS },
  { name: "Creations", icon: Folder, path: "/workspace/creations" },
];

function GroupIcon({ group, compact = false }) {
  const size = compact ? "h-[17px] w-[17px]" : "h-[23px] w-[23px]";

  if (group.iconSrc) {
    return (
      <img
        src={group.iconSrc}
        alt=""
        aria-hidden="true"
        className={`${size} shrink-0 object-contain`}
      />
    );
  }

  return createElement(group.icon, {
    className: `${size} shrink-0 text-white/90`,
    strokeWidth: 1.9,
  });
}

function SubmenuIcon({ tool }) {
  if (tool.preview) {
    return (
      <img
        src={tool.preview}
        alt=""
        className={`h-full w-full object-contain ${tool.previewPosition ?? "object-center"}`}
      />
    );
  }
  return tool.icon ?? null;
}

export default function ToolSelector() {
  const navigate = useNavigate();
  const navRef = useRef(null);
  const [openGroup, setOpenGroup] = useState(null);
  const activeGroup = groups.find((group) => group.name === openGroup);

  useEffect(() => {
    if (!openGroup) return;
    const closeOnOutsideClick = (event) => {
      if (!navRef.current?.contains(event.target)) setOpenGroup(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openGroup]);

  const selectGroup = (group) => {
    if (group.path) {
      setOpenGroup(null);
      navigate(group.path);
      return;
    }
    setOpenGroup((current) => current === group.name ? null : group.name);
  };

  const selectTool = (path) => {
    setOpenGroup(null);
    navigate(path);
  };

  return (
    <Motion.nav
      ref={navRef}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Zyvo tools"
      className="relative z-30 mx-auto mt-5 w-full max-w-[780px] px-3 sm:mt-7 sm:px-4 md:mt-8 md:px-3"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:hidden">
        {groups.map((group) => {
          const isOpen = openGroup === group.name;
          return (
            <button
              key={group.name}
              type="button"
              onClick={() => selectGroup(group)}
              aria-expanded={group.items ? isOpen : undefined}
              className={`group flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[17px] border px-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b78aff] ${
                isOpen
                  ? "border-[#b78aff]/35 bg-[#21192a]/95"
                  : "border-white/[0.09] bg-[#18171a]/92 active:bg-white/[0.08]"
              }`}
            >
              <GroupIcon group={group} />
              <span className="text-[12px] font-semibold leading-none tracking-[-0.01em] text-white/90">
                {group.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="hidden grid-cols-4 gap-0 rounded-full border border-white/[0.09] bg-[#100c14]/68 p-1 shadow-[0_18px_60px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.035)] backdrop-blur-2xl sm:grid">
        {groups.map((group) => {
          const isOpen = openGroup === group.name;
          return (
            <button
              key={group.name}
              type="button"
              onClick={() => selectGroup(group)}
              aria-expanded={group.items ? isOpen : undefined}
              className={`group flex min-h-[48px] items-center justify-center gap-2 rounded-[17px] px-2.5 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b78aff] sm:rounded-full ${
                isOpen ? "bg-white/[0.085] shadow-[inset_0_1px_0_rgba(255,255,255,.055)]" : "hover:bg-white/[0.05]"
              }`}
            >
              <GroupIcon group={group} compact />
              <span className="text-[13px] font-semibold tracking-[-0.01em] text-white">{group.name}</span>
              {group.items && (
                <ChevronDown
                  className={`h-3 w-3 text-white/35 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  strokeWidth={2}
                />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeGroup?.items && (
          <Motion.div
            key={activeGroup.name}
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-2 overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#100c14]/88 p-2 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-2xl"
          >
            <div className={`grid gap-1 ${activeGroup.items.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
              {activeGroup.items.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => selectTool(tool.path)}
                  className="group flex min-h-[62px] items-center gap-3 rounded-[16px] px-3 py-2 text-left transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b78aff]"
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden text-white ${tool.transparentIcon ? "" : "rounded-xl border border-white/10 bg-white/[0.055] p-0.5"}`}>
                    <SubmenuIcon tool={tool} />
                  </span>
                  <span className="text-[13px] font-semibold text-white/85 transition group-hover:text-white">
                    {tool.label}
                  </span>
                </button>
              ))}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.nav>
  );
}
