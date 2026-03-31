import { NavLink } from "react-router-dom";
import { Image, Box, PaintBucket, LucideImagePlus, HomeIcon, LucideVideo  } from "lucide-react";
HomeIcon
const TOOLS = [
  { label: "Home", to: "/workspace/home", icon: HomeIcon },
  { label: "Image Generator", to: "/workspace/image-generator", icon: LucideImagePlus } ,
  { label: "Video Generator", to: "/workspace/video-generator", icon: LucideVideo } ,

];

function ToolRow({ to, label, Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => {
        onNavigate?.();
      }}
    >
      {({ isActive }) => (
        <div
          className={`
            group relative flex items-center gap-3 px-3 py-2 rounded-lg
            cursor-pointer
            transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]
            ${isActive ? "bg-white/5 translate-y-[-1px]" : "hover:bg-white/5"}
          `}
        >
          {/* Soft bottom glow */}
          <div
            className={`
              absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-4
              bg-white/40 blur-xl pointer-events-none
              transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]
              ${isActive ? "opacity-70 scale-100" : "opacity-0 scale-95"}
            `}
          />

          {/* Active indicator */}
          <span
            className={`
              absolute left-0 top-1/2 -translate-y-1/2
              h-6 w-[3px] rounded-full bg-[#7A3BFF]
              transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]
              ${
                isActive
                  ? "opacity-100 scale-y-100"
                  : "opacity-0 scale-y-75 group-hover:opacity-30"
              }
            `}
          />

          {/* Icon */}
          <Icon
            className={`
              h-4 w-4
              transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]
              ${
                isActive
                  ? "text-[#7A3BFF] drop-shadow-[0_0_6px_#7A3BFF] scale-105"
                  : "text-[#B7BBC6] group-hover:text-white"
              }
            `}
          />

          {/* Label */}
          <span
            className={`
              text-[14px]
              transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]
              ${
                isActive
                  ? "text-[#7A3BFF] font-semibold"
                  : "text-[#B7BBC6] group-hover:text-white"
              }
            `}
          >
            {label}
          </span>
        </div>
      )}
    </NavLink>
  );
}

export default function ToolsPanel({ onNavigate }) {

  return (
    <div className="h-full w-full bg-[#090A0A] px-4 py-4 border border-white/10">
      <h1 className="text-[#F4F6FB] text-[12px] font-semibold mb-4">
        Create with tools
      </h1>

      <div className="flex flex-col gap-1 ">
      {TOOLS.map((tool) => (
  <ToolRow
    key={tool.to}
    to={tool.to}
    label={tool.label}
    Icon={tool.icon}
    end={tool.to === "/workspace"}
    onNavigate={onNavigate}
  />
))}

      </div>
    </div>
  );
}
