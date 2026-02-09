import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";

import Logo from "../../assets/Logo.png";
import Credit from "../../assets/toolshell/credit.png";

import {
  ToolCase,
  Folder,
  BadgeQuestionMark,
} from "lucide-react";

export default function ToolShell({
  activePanel,
  setActivePanel,
  isCreationsRoute,
  onClose,
}) {

  const { user } = useAuth();
  const credits = useProfileCredits();
  const formattedCredits = Intl.NumberFormat().format(credits);
  const navigate = useNavigate();


  const initials = user
    ? (user.user_metadata?.full_name || user.email || "")
        .slice(0, 2)
        .toUpperCase()
    : null;

  return (
    <aside
  className={`fixed top-0 left-0 z-50 h-screen w-[80px] bg-[#12141A] flex flex-col border-r-2 
    ${
      isCreationsRoute && activePanel !== "tools"
        ? "border-white/15"
        : "border-transparent"
    }
  `}
>


      {/* LOGO */}
      <div className="flex justify-center pt-6 mb-6 shrink-0">
        <img src={Logo} className="h-12 w-12" />
      </div>

      {/* TOP */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex flex-col gap-2">

          <button
           onClick={() => {
  navigate("/workspace/home");   // ← force Home
  setActivePanel("tools");  // ← open tools panel
}}

            className={`
              flex flex-col gap-1 items-center px-6 py-2 rounded-lg
              transition-all
              hover:bg-[#7A3BFF]/10
              ${activePanel === "tools" ? "bg-[#7A3BFF]/20 scale-[1.04]" : ""}
            `}
          >
            <ToolCase className="text-[#B7BBC6] h-6 w-6" />
            <p className="text-[#B7BBC6] text-[12px]">Tools</p>
          </button>

          <NavLink
  to="/workspace/creations"
  onClick={() => {
    if (window.innerWidth < 1024) {
      setActivePanel(null);
      onClose?.();
    }
  }}
  className={({ isActive }) =>
    `flex flex-col gap-1 items-center px-6 py-2 rounded-lg
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>

            <Folder className="text-[#B7BBC6] h-6 w-6" />
            <p className="text-[#B7BBC6] text-[12px]">Creations</p>
          </NavLink>

        </div>
      </div>

      {/* BOTTOM */}
      <div className="pb-6 flex flex-col gap-4 items-center">

        <Link to="/workspace/pricing" className="flex flex-col items-center gap-1">
          <div className="border border-white/20 rounded-lg h-10 w-10 flex items-center justify-center">
            <img src={Credit} className="h-6 w-6" />
          </div>
          <p className="text-[#B7BBC6] text-[12px] font-semibold">
            {formattedCredits}
          </p>
        </Link>

        <Link to="/support" className="flex flex-col items-center gap-1">
          <BadgeQuestionMark className="text-[#B7BBC6]" />
          <p className="text-[#B7BBC6] text-[12px]">Help</p>
        </Link>

        {user && (
          <Link
            to="/settings"
            className="bg-[#B7BBC6] rounded-full w-10 h-10 flex items-center justify-center"
          >
            <span className="text-[#110829] text-[14px] font-semibold">
              {initials}
            </span>
          </Link>
        )}

      </div>
    </aside>
  );
}
