import { Video, Image as ImageIcon, Folder, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function ToolSelector() {
  const navigate = useNavigate();

  const tools = [
    { name: "Image",     icon: ImageIcon, path: "/workspace/image-generator" },
    { name: "Video",     icon: Video,     path: "/workspace/video-generator" },
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
        {tools.slice(0, 2).map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(item.path)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#191B1C] border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-all"
            >
              <Icon size={16} className="text-white" />
              {item.name}
              <ChevronDown size={14} className="opacity-60" />
            </motion.button>
          );
        })}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(tools[2].path)}
          className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#191B1C] border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-all"
        >
          <Folder size={16} />
          Creations
          <ChevronDown size={14} className="opacity-60" />
        </motion.button>
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex items-center justify-center mt-2">
        <div className="w-full max-w-[650px] flex items-center justify-between bg-[#191B1C] border border-white/10 rounded-full px-6 py-3">
          {tools.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 px-4 text-white text-md font-extrabold hover:text-purple-300 transition"
              >
                <Icon size={18} className="text-white" />
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
