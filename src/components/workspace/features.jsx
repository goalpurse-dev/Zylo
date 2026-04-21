import { Video, Image as ImageIcon, Folder, ChevronDown, PenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function ToolSelector() {
  const navigate = useNavigate();

  const tools = [
    { name: "Image",     icon: ImageIcon, path: "/workspace/image-generator" },
    { name: "Video",     icon: Video,     path: "/workspace/video-generator" },
    { name: "Script",    icon: PenLine,   path: "/workspace/viral-script", badge: "NEW" },
    { name: "Creations", icon: Folder,    path: "/workspace/creations" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
      className="w-full mt-4 px-4"
    >
      {/* MOBILE */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {tools.map((item, i) => {
          const Icon = item.icon;
          const isScript = item.badge;
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(item.path)}
              className={`relative flex items-center justify-center gap-2 py-3 rounded-xl border text-white text-sm font-semibold transition-all ${
                isScript
                  ? "bg-[#7A3BFF]/10 border-[#7A3BFF]/30 hover:bg-[#7A3BFF]/20"
                  : "bg-[#191B1C] border-white/10 hover:bg-white/5"
              }`}
            >
              {isScript && (
                <span className="absolute -top-2 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#7A3BFF] text-white leading-none">NEW</span>
              )}
              <Icon size={16} className={isScript ? "text-[#A07BFF]" : "text-white"} />
              <span className={isScript ? "text-[#C4A3FF]" : ""}>{item.name}</span>
              <ChevronDown size={14} className="opacity-60" />
            </motion.button>
          );
        })}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex items-center justify-center mt-2">
        <div className="w-full max-w-[780px] flex items-center justify-between bg-[#191B1C] border border-white/10 rounded-full px-6 py-3">
          {tools.map((item, i) => {
            const Icon = item.icon;
            const isScript = item.badge;
            return (
              <button
                key={i}
                onClick={() => navigate(item.path)}
                className={`relative flex items-center gap-3 px-4 text-md font-extrabold transition ${
                  isScript
                    ? "text-[#C4A3FF] hover:text-white"
                    : "text-white hover:text-purple-300"
                }`}
              >
                {isScript && (
                  <span className="absolute -top-3.5 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#7A3BFF] text-white leading-none tracking-wide">NEW</span>
                )}
                <Icon size={18} className={isScript ? "text-[#9B6DFF]" : "text-white"} />
                {item.name}
                <ChevronDown size={14} className="opacity-60" />
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
