import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { createPortal } from "react-dom";

import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";

import Logo from "../../assets/Logo.png";
import Credit from "../../assets/toolshell/credit.png";

ArrowLeft
LogOut

/* Icons */

Settings
CreditCard
Info


import {
  ToolCase,
  Folder,
  BadgeQuestionMark,
  Settings,
  CreditCard,
  Info,
  ArrowLeft,
  LogOut,
} from "lucide-react";

export default function ToolShell({
  activePanel,
  setActivePanel,
  isCreationsRoute,
  onClose,
}) {
  const { user } = useAuth();
  const menuRef = useRef(null);
  const credits = useProfileCredits();

  const [planCode, setPlanCode] = useState("free");

  useEffect(() => {
  const loadPlan = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("plan_code")
      .eq("id", user.id)
      .single();

    setPlanCode((data?.plan_code || "free").toLowerCase());
  };

  loadPlan();
}, [user]);
  
const isPaidPlan = user && planCode !== "free";
const showCredits = user && isPaidPlan;
const showAddCredits = user && !isPaidPlan;
  const formattedCredits = Intl.NumberFormat().format(credits);
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
     if (
  !profileRef.current?.contains(e.target) &&
  !menuRef.current?.contains(e.target)
) {
  setProfileOpen(false);
}
    };

    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileOpen]);

  const initials = user
    ? (user.user_metadata?.full_name || user.email || "")
        .slice(0, 2)
        .toUpperCase()
    : null;

  return (
    <aside
      className={`fixed top-0 left-0 z-50
        h-[100dvh] w-[80px]
        bg-[#090A0A] flex flex-col
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
      <div className="flex-1 px-2">
        <div className="flex flex-col gap-2">

  <button
  onClick={() => {
    navigate("/workspace/home");
    setActivePanel("tools");
  }}
  className="relative flex flex-col gap-1 items-center px-6 py-3 transition-all duration-300"
>
  {/* Futuristic beam glow */}
  {activePanel === "tools" && (
  <>
    {/* Animated purple aura */}
    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-6 bg-[#7A3BFF]/40 blur-xl rounded-full pointer-events-none animate-aura" />

    {/* White beam */}
    <div className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-8 h-[2px]  rounded-full pointer-events-none animate-beam" />
  </>
)}
  <ToolCase
    className={`h-6 w-6 transition-all duration-300 ${
      activePanel === "tools"
        ? "text-[#7A3BFF] drop-shadow-[0_0_10px_#7A3BFF]"
        : "text-[#8A8F9C]"
    }`}
  />

  <p
    className={`text-[12px] transition-all duration-300 ${
      activePanel === "tools"
        ? "text-[#7A3BFF] font-semibold tracking-wide"
        : "text-[#8A8F9C]"
    }`}
  >
    Tools
  </p>
</button>

          <NavLink
    to="/workspace/creations"
  onClick={() => {
    if (window.innerWidth < 1024) {
      onClose?.();
    }
  }}
  className="relative flex flex-col gap-1 items-center px-6 py-3 transition-all duration-300"
>
  {({ isActive }) => (
    <>
      {isActive && (
        <>
          {/* Purple aura */}
          <div className="absolute -bottom-2 left-1/2 animate-aura -translate-x-1/2 w-10 h-6 bg-[#7A3BFF]/30 blur-xl rounded-full pointer-events-none" />

          {/* Sharp white beam */}
          <div className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-8 h-[2px] animate-beam  rounded-full pointer-events-none" />
        </>
      )}

      <Folder
        className={`h-6 w-6 transition-all duration-300 ${
          isActive
            ? "text-[#7A3BFF] drop-shadow-[0_0_10px_#7A3BFF]"
            : "text-[#8A8F9C]"
        }`}
      />

      <p
        className={`text-[12px] transition-all duration-300 ${
          isActive
            ? "text-[#7A3BFF] font-semibold tracking-wide"
            : "text-[#8A8F9C]"
        }`}
      >
        Creations
      </p>
    </>
  )}
</NavLink>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="pb-6 flex flex-col gap-4 items-center">

{/* Credits / Add Credits */}
{showCredits && (
  <Link
    to="/workspace/pricing"
    onClick={() => {
      if (window.innerWidth < 1024) {
        onClose?.();
      }
    }}
    className="flex flex-col items-center gap-1 group"
  >
    <div className="border border-white/20 rounded-lg h-10 w-10 flex items-center justify-center hover:border-purple-500/40 transition">
      <img src={Credit} className="h-6 w-6" />
    </div>

    <p className="text-[#B7BBC6] text-[12px] font-semibold">
      {formattedCredits}
    </p>
  </Link>
)}

{showAddCredits && (
  <Link
    to="/workspace/pricing"
    onClick={() => {
      if (window.innerWidth < 1024) {
        onClose?.();
      }
    }}
    className="flex flex-col items-center gap-1 group"
  >
    <div
      className="
        border border-purple-400/30
        rounded-lg
        h-10 w-10
        flex items-center justify-center
        transition-all duration-300
        group-hover:scale-[1.05]
        shadow-[0_0_10px_rgba(168,85,247,0.35)]
      "
    >
      <span className="text-purple-500 text-lg font-bold leading-none">
        +
      </span>
    </div>

    <p className="text-[#B7BBC6] text-[11px] font-medium text-center leading-tight">
      Add<br />Credits
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

        {/* Auth buttons */}
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

        {/* PROFILE */}
        {user && (
          <div className="relative mt-2" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="bg-[#B7BBC6] rounded-full w-10 h-10 flex items-center justify-center"
            >
              <span className="text-[#110829] text-[14px] font-semibold">
                {initials}
              </span>
            </button>

        {profileOpen &&
  createPortal(
 <div
  ref={menuRef}
  className="
        fixed
        left-[90px]
        bottom-[calc(env(safe-area-inset-bottom)+30px)]
        w-[260px]
        bg-[#1A1D2B]
        border border-white/10
        rounded-2xl
        shadow-2xl
        p-3
        z-[9999]
      "
    >
      {/* Header */}
      <div className="pb-3 border-b border-white/10 mb-3">
        <p className="text-white text-sm font-medium">
          {user.user_metadata?.full_name || "User"}
        </p>
        <p className="text-white/40 text-xs">
          {user.email}
        </p>
      </div>

      {/* Menu */}
      <div className="flex flex-col gap-1 text-sm">

        <button
          onClick={() => {
            navigate("/workspace/pricing");
            setProfileOpen(false);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left text-white/80"
        >
          <CreditCard className="w-4 h-4 text-white/60" />
          Subscriptions
        </button>

        <button
          onClick={() => {
            navigate("/settings");
            setProfileOpen(false);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left text-white/80"
        >
          <Settings className="w-4 h-4 text-white/60" />
          Manage Account
        </button>

        <button
          onClick={() => {
            navigate("/about");
            setProfileOpen(false);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left text-white/80"
        >
          <Info className="w-4 h-4 text-white/60" />
          About
        </button>

        <div className="border-t border-white/10 my-2"></div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/");
          }}
          className="
            flex items-center gap-2
            px-3 py-2
            rounded-lg
            border border-red-500/40
            bg-red-500/10
            text-red-400
            hover:bg-red-500/20
            hover:border-red-500/60
            transition-all duration-200
          "
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>

      </div>
    </div>,
    document.body
  )}
          </div>
        )}

      </div>

      <div className="shrink-0 pb-6 px-2"></div>
    </aside>
  );
}
