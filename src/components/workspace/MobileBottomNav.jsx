import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Image,
  Video,
  PenLine,
  Folder,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Home",      icon: Home,    path: "/workspace/home" },
  { name: "Image",     icon: Image,   path: "/workspace/image-generator", ftg: "image-nav" },
  { name: "Video",     icon: Video,   path: "/workspace/video-generator" },
  { name: "Script",    icon: PenLine, path: "/workspace/viral-script" },
  { name: "Creations", icon: Folder,  path: "/workspace/creations" },
];

export default function MobileBottomNav({ isSelectorOpen }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div
      className={`
        ftg-bottom-nav
        fixed bottom-0 left-0 right-0
        z-[100]
        lg:hidden
        bg-[#191B1C]
        border-t border-white/5
        transition-opacity duration-300
        ${isSelectorOpen ? "opacity-0 pointer-events-none" : "opacity-100"}
      `}
      style={{
        height: "calc(70px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="ftg-nav-item flex-1 flex justify-center"
              {...(item.ftg ? { "data-ftg": item.ftg } : {})}
            >
              <div
                className={`
                  flex flex-col items-center justify-center
                  w-[64px] h-[52px]
                  rounded-xl
                  transition-all duration-200 active:scale-95
                  ${isActive ? "bg-white text-black" : "text-white/60"}
                `}
              >
                <Icon size={20} />
                <span className="text-[10px] mt-[2px]">{item.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
