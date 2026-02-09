import { NavLink } from "react-router-dom";
import { Image, Box, PaintBucket, LucideImagePlus, HomeIcon } from "lucide-react";
HomeIcon
const TOOLS = [
  { label: "Home", to: "/workspace/home", icon: HomeIcon },
  { label: "Image Generator", to: "/workspace/image-generator", icon: LucideImagePlus } ,
  { label: "Product Photos", to: "/workspace/productphoto", icon: Image },
  { label: "Own Products", to: "/workspace/myproduct", icon: Box },
  { label: "Background Library", to: "/workspace/library", icon: PaintBucket },
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
          className={`group relative flex items-center gap-3 px-2 py-2 rounded-lg
            transition-colors duration-150 cursor-pointer
            ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
        >
          {/* Active indicator */}
          <span
            className={`
              absolute left-0 top-1/2 -translate-y-1/2
              h-6 w-[3px] rounded-full bg-[#7A3BFF]
              ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30 "}
            `}
          />

          {/* Icon */}
          <Icon
            className={`h-4 w-4 transition-colors
              ${isActive ? "text-[#F4F6FB]" : "text-[#B7BBC6]"}
            `}
          />

          {/* Label */}
          <span
            className={`text-[14px]
              ${isActive ? "text-[#F4F6FB] font-semibold" : "text-[#B7BBC6]"}
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
    <div className="h-full w-full bg-[#12141A] px-4 py-4 border border-white/10">
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
