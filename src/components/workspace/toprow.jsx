import Logo from "../../assets/Logo.png";
import Credit from "/icons/credits.png";

import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { supabase } from "../../lib/supabaseClient";

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

import {
  Settings,
  CreditCard,
  Info,
  LogOut,
  HelpCircle,
  ChevronDown
} from "lucide-react";

export default function TopRow() {
  const { user, loading } = useAuth();
  const credits = useProfileCredits();
  const navigate = useNavigate();

  const [planCode, setPlanCode] = useState("free");
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef(null);
  const menuRef = useRef(null);

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

  if (loading) return null;

  const formattedCredits = Intl.NumberFormat().format(credits);

  const initials = user
    ? (user.user_metadata?.full_name || user.email || "")
        .slice(0, 2)
        .toUpperCase()
    : null;

 return (
  <section className="lg:hidden w-full z-[60] bg-[#090A0A] border-b border-white/5">
    <div className="flex items-center justify-between px-4 py-3">

      {/* LEFT */}
      <div className="flex items-center gap-2">
        <img src={Logo} className="w-9 h-9" />

        {user && (
          <>
            <div className="
              px-2 py-[2px] hidden sm:block
              rounded-full
              bg-gradient-to-r from-[#7A3BFF]/20 to-[#9F5CFF]/20
              border border-purple-400/30
              text-purple-300 text-[11px] font-semibold
            ">
              {planCode}
            </div>

            <div className="hidden sm:flex items-center gap-1 ml-1">
              <span className="text-white/80 text-sm font-medium">
                Workspace
              </span>
              <ChevronDown className="w-4 h-4 text-white/40" />
            </div>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">

        {/* NOT LOGGED IN */}
        {!user && (
          <>
            <button
              onClick={() => navigate("/login")}
              className="text-white/70 text-sm hover:text-white border rounded-full px-3 py-1.5 border-white/20 hover:border-white/40 transition"
            >
              Log in
            </button>

            <button
              onClick={() => navigate("/signup")}
              className="
                px-3 py-1.5
                rounded-full
                bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF]
                text-white text-sm font-semibold
              "
            >
              Sign up
            </button>
          </>
        )}

        {/* LOGGED IN */}
        {user && (
          <>
            {/* Add Credits */}
            <button
              onClick={() => navigate("/workspace/pricing")}
              className="
                flex items-center gap-1.5
                px-3 py-1.5
                rounded-full
                bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF]
                text-white text-sm font-semibold
                hover:scale-[1.04]
                transition
              "
            >
              Add Credits
            </button>

            {/* Credits */}
            <button
              onClick={() => navigate("/workspace/pricing")}
              className="
                flex items-center gap-2
                px-3 py-1.5
                rounded-full
                bg-[#14161C]
                border border-white/10
                hover:border-[#7A3BFF]/40
                hover:bg-[#181A22]
                transition
              "
            >
              <img
                src={Credit}
                className="h-5 w-auto object-contain scale-125 brightness-125 contrast-125"
              />

              <span className="text-[#9F5CFF] text-sm font-semibold tracking-wide">
                {formattedCredits}
              </span>
            </button>

            {/* Help */}
            <button
              onClick={() => navigate("/support")}
              className="
                w-9 h-9 sm:flex hidden
                rounded-full
                bg-[#191B1C]
                border border-white/10
                items-center justify-center
                hover:border-purple-500/40
              "
            >
              <HelpCircle className="w-4 h-4 text-white/70" />
            </button>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((prev) => !prev)}
                className="w-9 h-9 rounded-full bg-[#B7BBC6] flex items-center justify-center"
              >
                <span className="text-[#110829] text-sm font-semibold">
                  {initials}
                </span>
              </button>

              {profileOpen &&
                createPortal(
                  <div
                    ref={menuRef}
                    className="fixed right-4 top-[70px] w-[240px] bg-[#1A1D2B] border border-white/10 rounded-2xl shadow-2xl p-3 z-[9999]"
                  >
                    <div className="pb-3 border-b border-white/10 mb-3">
                      <p className="text-white text-sm font-medium">
                        {user.user_metadata?.full_name || "User"}
                      </p>
                      <p className="text-white/40 text-xs">
                        {user.email}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 text-sm">
                      <button
                        onClick={() => navigate("/workspace/pricing")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-white/80"
                      >
                        <CreditCard className="w-4 h-4 text-white/60" />
                        Subscriptions
                      </button>

                      <button
                        onClick={() => navigate("/settings")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-white/80"
                      >
                        <Settings className="w-4 h-4 text-white/60" />
                        Manage Account
                      </button>

                      <button
                        onClick={() => navigate("/about")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-white/80"
                      >
                        <Info className="w-4 h-4 text-white/60" />
                        About
                      </button>

                      <button
                        onClick={() => navigate("/support")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-white/80"
                      >
                        <HelpCircle className="w-4 h-4 text-white/60" />
                        Help
                      </button>

                      <div className="border-t border-white/10 my-2"></div>

                      <button
                        onClick={async () => {
                          await supabase.auth.signOut();
                          navigate("/");
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400"
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

    </div>
  </section>
);
}