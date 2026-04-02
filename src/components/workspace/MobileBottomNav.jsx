import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Image,
  Video,
  Folder,
} from "lucide-react";



export default function MobileBottomNav({ isSelectorOpen }) {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { name: "Home", icon: Home, path: "/workspace/home" },
    { name: "Image", icon: Image, path: "/workspace/image-generator" },
    { name: "Video", icon: Video, path: "/workspace/video-generator" },
    { name: "Creations", icon: Folder, path: "/workspace/creations" },
  ];

  return (
<div
  className={`
    fixed bottom-0 left-0 right-0
    z-[100]
    lg:hidden
    bg-[#191B1C]
    border-t border-white/5
    h-[70px]

    transition-all duration-300

   ${isSelectorOpen ? "opacity-0 pointer-events-none translate-y-full" : "opacity-100"}
  `}
  style={{
    paddingBottom: "env(safe-area-inset-bottom)",
    "--bottom-nav-height": "68px"
  }}
>
      <div className="flex items-center justify-between px-3 py-2">

        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex-1 flex justify-center"
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
                <span className="text-[10px] mt-[2px]">
                  {item.name}
                </span>
              </div>
            </button>
          );
        })}

      </div>
    </div>
  );
}