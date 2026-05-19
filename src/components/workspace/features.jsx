import { useState, useRef, useEffect } from "react";
import { Video, Image as ImageIcon, Folder, ChevronDown, PenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tools = [
  {
    name: "Image",
    icon: ImageIcon,
    path: "/workspace/image-generator",
    items: [
      { label: "Image Generator",  path: "/workspace/image-generator", emoji: "🖼️" },
      { label: "AI Fruit Story",   path: "/workspace/ai-fruit-story",  emoji: "🍊" },
    ],
  },
  {
    name: "Video",
    icon: Video,
    path: "/workspace/video-generator",
    items: [
      { label: "Video Generator",  path: "/workspace/video-generator", emoji: "🎬" },
      { label: "AI Fruit Story",   path: "/workspace/ai-fruit-story",  emoji: "🍊" },
    ],
  },
  {
    name: "Script",
    icon: PenLine,
    path: "/workspace/viral-script",
    items: [
      { label: "Script Builder",   path: "/workspace/viral-script",    emoji: "✍️" },
      { label: "AI Fruit Story",   path: "/workspace/ai-fruit-story",  emoji: "🍊" },
    ],
  },
  {
    name: "AI Fruit",
    icon: null,
    emoji: "🍊",
    path: "/workspace/ai-fruit-story",
  },
  {
    name: "Creations",
    icon: Folder,
    path: "/workspace/creations",
  },
];

function ToolDropdown({ tool, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const Icon = tool.icon;
  const hasItems = tool.items?.length > 0;
  const isFruit = !!tool.emoji;

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleClick = () => {
    if (hasItems) setOpen((v) => !v);
    else onNavigate(tool.path);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleClick}
        className={`relative flex items-center gap-2 px-4 py-2 text-[14px] font-extrabold rounded-full transition select-none ${
          isFruit ? "text-orange-300 hover:text-orange-200" : "text-white hover:text-purple-300"
        }`}
      >
        {/* "AI Fruit Story dropped" announcement pill */}
        {tool.drop && (
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] px-2.5 py-[3px] text-[8px] font-bold tracking-wide text-white leading-none shadow-[0_0_10px_rgba(122,59,255,0.5)]">
            {tool.drop}
          </span>
        )}
        {isFruit
          ? <span className="text-[17px] leading-none">{tool.emoji}</span>
          : <Icon size={17} className="text-white" />
        }
        {tool.name}
        {hasItems && (
          <ChevronDown size={13} className={`opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {/* Dropdown */}
      {hasItems && open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-[200px] -translate-x-1/2 overflow-hidden rounded-[16px] border border-white/10 bg-[#111315] shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          {tool.items.map((item) => (
            <button
              key={item.path + item.label}
              onClick={() => { setOpen(false); onNavigate(item.path); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-semibold text-white/80 transition hover:bg-white/[0.06] hover:text-white"
            >
              <span className="text-base">{item.emoji}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-[#7A3BFF]/20 px-2 py-0.5 text-[9px] font-bold text-purple-300">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ToolSelector() {
  const navigate = useNavigate();
  const [openMobile, setOpenMobile] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
      className="w-full mt-4 px-5 md:px-8"
    >
      {/* MOBILE — 2-col grid; Creations is last and alone so it spans full width */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {tools.map((tool, i) => {
          const Icon = tool.icon;
          const hasItems = tool.items?.length > 0;
          const isOpen = openMobile === i;
          const isAlone = i === tools.length - 1 && tools.length % 2 !== 0;

          return (
            <div key={i} className={`relative ${isAlone ? "col-span-2" : ""}`}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (hasItems) setOpenMobile(isOpen ? null : i);
                  else navigate(tool.path);
                }}
                className="relative w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-[#191B1C] text-white text-sm font-semibold transition-all hover:bg-white/5"
              >
                {tool.emoji
                  ? <span className="text-base">{tool.emoji}</span>
                  : <Icon size={16} className="text-white" />
                }
                <span>{tool.name}</span>
                {hasItems && <ChevronDown size={13} className={`opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
              </motion.button>

              {/* Mobile dropdown */}
              {hasItems && isOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[14px] border border-white/10 bg-[#111315] shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
                  {tool.items.map((item) => (
                    <button
                      key={item.path + item.label}
                      onClick={() => { setOpenMobile(null); navigate(item.path); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-semibold text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <span>{item.emoji}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-[#7A3BFF]/20 px-2 py-0.5 text-[9px] font-bold text-purple-300">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex items-center justify-center mt-2">
        <div className="w-full max-w-[780px] flex items-center justify-between bg-[#191B1C] border border-white/10 rounded-full px-6 py-2">
          {tools.map((tool, i) => (
            <ToolDropdown key={i} tool={tool} onNavigate={navigate} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
