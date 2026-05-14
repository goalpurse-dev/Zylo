import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { supabase } from "../../lib/supabaseClient";
import Logo from "../../assets/Logo.png";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { DesktopCreatePanel, DesktopWorkspacePanel } from "./CreateMenu";

import {
  Home,
  Image,
  Video,
  PenLine,
  Folder,
  LayoutGrid,
  CreditCard,
  Settings,
  Info,
  LogOut,
  HelpCircle
} from "lucide-react";

import Credit from "/icons/credits.png";

export default function ToolShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const credits = useProfileCredits();

  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const menuRef = useRef(null);
const [planCode, setPlanCode] = useState("free");
  const formattedCredits = Intl.NumberFormat().format(credits);

  const initials = user
    ? (user.user_metadata?.full_name || user.email || "")
        .slice(0, 2)
        .toUpperCase()
    : null;

  const isActive = (path) => location.pathname.startsWith(path);

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

  const Item = ({ icon: Icon, label, path, ftg }) => {
    const active = isActive(path);

    return (
      <button
        onClick={() => navigate(path)}
        className={`
          ftg-nav-item
          w-full flex flex-col items-center gap-1 py-3 rounded-xl
          transition-all duration-200
          ${active
            ? "bg-white text-black"
            : "text-white/50 hover:text-white hover:bg-white/5"}
        `}
        {...(ftg ? { "data-ftg": ftg } : {})}
      >
        <Icon className="w-5 h-5" />
        <span className="text-[11px] font-medium">{label}</span>
      </button>
    );
  };

  // close dropdown
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

  return (
    <>
    <DesktopCreatePanel open={createOpen} onClose={() => setCreateOpen(false)} />
    <DesktopWorkspacePanel open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
    <div className="h-full flex flex-col items-center py-4 px-2 bg-[#090A0A] border-r border-white/5">

      {/* LOGO */}
      <div className="mb-6">
       <img
  src={Logo}
  className="
    w-10 h-10
    object-contain

    drop-shadow-[0_0_10px_rgba(122,59,255,0.6)]
  "
/>
      </div>

      {/* NAV */}
      <div className="flex flex-col items-center gap-2 w-full">
        <Item icon={Home} label="Home" path="/workspace/home" />

        {/* Workspace — opens Image / Video / Script panel */}
        <button
          onClick={() => { setWorkspaceOpen((v) => !v); setCreateOpen(false); }}
          className={`ftg-nav-item w-full flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 ${
              isActive("/workspace/image-generator") ||
            isActive("/workspace/video-generator") ||
            isActive("/workspace/viral-script")
              ? "bg-white text-black"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[11px] font-medium">Workspace</span>
        </button>

        {/* Create — active only on create-tool routes, matches nav style */}
        <button
          onClick={() => { setCreateOpen((v) => !v); setWorkspaceOpen(false); }}
          className={`ftg-nav-item w-full flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 ${
            isActive("/workspace/ai-fruit-story")
              ? "bg-white text-black"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 2C11.175 2 10.5 2.675 10.5 3.5V10.5H3.5C2.675 10.5 2 11.175 2 12C2 12.825 2.675 13.5 3.5 13.5H10.5V20.5C10.5 21.325 11.175 22 12 22C12.825 22 13.5 21.325 13.5 20.5V13.5H20.5C21.325 13.5 22 12.825 22 12C22 11.175 21.325 10.5 20.5 10.5H13.5V3.5C13.5 2.675 12.825 2 12 2Z"/>
          </svg>
          <span className="text-[11px] font-medium">Create</span>
        </button>

        <Item icon={Folder} label="Creations" path="/workspace/creations" />
      </div>

      {/* SPACER */}
      <div className="flex-1" />



      {/* NOT LOGGED IN */}
{!user && (
  <div className="flex flex-col items-center gap-2 w-full mb-3">

    <button
      onClick={() => navigate("/login")}
      className="
        w-[90%]
        h-[36px]

        text-white/70 text-sm
        border border-white/20
        rounded-xl

        flex items-center justify-center

        hover:text-white
        hover:border-white/40
        transition
      "
    >
      Log in
    </button>

    <button
      onClick={() => navigate("/signup")}
      className="
        w-[90%]
        h-[36px]

        rounded-xl
        bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF]

        text-white text-sm font-semibold

        flex items-center justify-center


      "
    >
      Sign up
    </button>

  </div>
)}

      {/* LOGGED IN */}
      {user && (
        <>
          {/* ADD CREDITS */}
          {planCode === "free" && (
<button
  onClick={() => navigate("/workspace/pricing")}
  className="
    w-[90%]
    mx-auto

    flex items-center justify-center
    px-3 py-2

    rounded-xl

    bg-[#7A3BFF]/20
    border border-[#7A3BFF]/50

    text-[#C4A3FF] text-[12px] font-semibold

    hover:bg-[#7A3BFF]/30
    hover:border-[#9F5CFF]
    hover:text-white

    transition
  "
>
  Upgrade
</button>
)}

          {/* CREDITS */}
          <button
            onClick={() => navigate("/workspace/pricing")}
            className="
              mt-2 w-full flex items-center justify-center gap-1
              px-3 py-2 rounded-xl
              bg-[#14161C]
              border border-white/10
              hover:border-[#7A3BFF]/40
              hover:bg-[#181A22]
              transition
            "
          >
            <img
              src={Credit}
              className="h-5 w-auto object-contain scale-125 brightness-125"
            />

            <span className="text-[#9F5CFF] text-[13px] font-semibold">
              {formattedCredits}
            </span>
          </button>



          {/* PROFILE */}
          <div className="relative mt-4" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="w-10 h-10 rounded-full bg-[#B7BBC6] flex items-center justify-center"
            >
              <span className="text-[#110829] text-sm font-semibold">
                {initials}
              </span>
            </button>

            {profileOpen &&
              createPortal(
             <div
  ref={menuRef}
  className="
    fixed left-[100px] bottom-6
    w-[200px]

    bg-[#171923]
    border border-white/10
    rounded-xl

    shadow-[0_10px_30px_rgba(0,0,0,0.5)]

    p-2
    z-[9999]
  "
>
  <div className="pb-2 border-b border-white/10 mb-2">
    <p className="text-white text-[13px] font-medium">
      {user.user_metadata?.full_name || "User"}
    </p>
    <p className="text-white/40 text-[11px] truncate">
      {user.email}
    </p>
  </div>

  <div className="flex flex-col gap-1 text-[13px]">

    <button
      onClick={() => navigate("/workspace/pricing")}
      className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-white/80"
    >
      <CreditCard className="w-4 h-4 text-white/60" />
      Subscriptions
    </button>

    <button
      onClick={() => navigate("/settings")}
      className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-white/80"
    >
      <Settings className="w-4 h-4 text-white/60" />
      Account
    </button>

    <button
      onClick={() => navigate("/about")}
      className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-white/80"
    >
      <Info className="w-4 h-4 text-white/60" />
      About
    </button>

    <button
      onClick={() => navigate("/support")}
      className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-white/80"
    >
      <HelpCircle className="w-4 h-4 text-white/60" />
      Help
    </button>

    <div className="border-t border-white/10 my-1"></div>

    <button
      onClick={async () => {
        await supabase.auth.signOut();
        navigate("/");
      }}
      className="
        flex items-center gap-2 px-2 py-2
        rounded-lg
        border border-red-500/30
        bg-red-500/10
        text-red-400
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
        </>
      )}
    </div>
    </>
  );
}
