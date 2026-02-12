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
  className={`fixed top-0 left-0 z-50
    h-[100dvh] w-[80px]
    bg-[#12141A] flex flex-col
    border-r-2
    overflow-y-auto overscroll-contain
    pb-[calc(env(safe-area-inset-bottom)+16px)]
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
      <div className="flex-1  px-2">
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
      {/* BOTTOM */}
<div className="pb-6 flex flex-col gap-4 items-center">

  {/* Credits – only if logged in */}
  {user && (
    <Link
      to="/workspace/pricing"
      className="flex flex-col items-center gap-1"
    >
      <div className="border border-white/20 rounded-lg h-10 w-10 flex items-center justify-center hover:border-purple-500/40 transition">
        <img src={Credit} className="h-6 w-6" />
      </div>
      <p className="text-[#B7BBC6] text-[12px] font-semibold">
        {formattedCredits}
      </p>
    </Link>
  )}

  {/* Help */}
  <Link
    to="/support"
    className="flex flex-col items-center gap-1 hover:text-white transition"
  >
    <BadgeQuestionMark className="text-[#B7BBC6]" />
    <p className="text-[#B7BBC6] text-[12px]">Help</p>
  </Link>

  {/* If NOT logged in → show auth buttons */}
  {!user && (
    <div className="flex flex-col gap-2 w-full px-3 mt-2">
      <Link
        to="/signup"
        className="w-full text-center py-2 rounded-lg bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white text-[12px] font-medium hover:scale-[1.03] transition"
      >
        Sign Up
      </Link>

      <Link
        to="/login"
        className="w-full text-center py-2 rounded-lg border border-white/20 text-[#B7BBC6] text-[12px] font-medium hover:border-purple-500/40 hover:text-white transition"
      >
        Log In
      </Link>
    </div>
  )}

  {/* Profile circle – only if logged in */}
  {user && (
    <Link
      to="/settings"
      className="bg-[#B7BBC6] rounded-full w-10 h-10 flex items-center justify-center mt-2"
    >
      <span className="text-[#110829] text-[14px] font-semibold">
        {initials}
      </span>
    </Link>
  )}

</div>
{/* BOTTOM (always visible but scroll-safe) */}
<div className="shrink-0 pb-6 px-2 flex flex-col gap-4 items-center"></div>
    </aside>
  );
}
